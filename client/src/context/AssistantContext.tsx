// ================================================================
// AssistantContext.tsx — Global Realtime Voice & Agent Provider
// Persists voice session, state, action timeline, and router awareness
// NEVER unmounts during route changes
// ================================================================

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { VoiceState, OnboardingState, type ConversationTurn, type VoiceMetrics, type SessionProfile } from '../types/voice';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { AgentStateMachine, AgentState, type ConfirmationRequest, type TaskProgress, type SourceInfo } from '../agent/agentStateMachine';
import { registerAppNavigator, updateUIState } from '../agent/agentBridge';
import { eventBus, type AgentRealtimeEvent, type TimelineEntry } from '../services/eventBus';
import { VOICE_TOOL_EVENT, type VoiceToolEvent, updateActiveFarmerContext } from '../services/toolManager';
import { setFarmerContext, setActiveServiceContext, type SupportedLanguage, SUPPORTED_LANGUAGES } from '../services/sessionManager';
import { prefetchToken } from '../services/tokenService';

export type AssistantUIMode = 'minimized' | 'compact' | 'expanded';

export interface CurrentActionState {
  type: string;
  status: 'starting' | 'in_progress' | 'completed' | 'waiting_confirmation' | 'failed';
  target?: string;
  label: string;
  icon?: string;
  timestamp: number;
}

export interface AssistantContextType {
  isOpen: boolean;
  uiMode: AssistantUIMode;
  setUiMode: (mode: AssistantUIMode) => void;
  voiceState: VoiceState;
  onboardingState: OnboardingState;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  isConnecting: boolean;
  isError: boolean;
  currentTranscript: string;
  assistantResponse: string;
  currentAction: CurrentActionState | null;
  navigationState: {
    currentRoute: string;
    previousRoute: string;
  };
  timeline: TimelineEntry[];
  turns: ConversationTurn[];
  metrics: VoiceMetrics;
  profile: SessionProfile;
  analyserData: Uint8Array | null;
  micRms: number;
  error: string | null;
  
  // Agent state
  agentState: AgentState;
  agentConfirmation: ConfirmationRequest | null;
  agentTask: TaskProgress | null;
  agentSources: SourceInfo[];
  externalNav: { url: string; siteName: string } | null;

  // Actions
  startVoice: (options?: { defaultMode?: AssistantUIMode; serviceContext?: any }) => Promise<void>;
  stopVoice: () => void;
  retryVoice: () => Promise<void>;
  setLanguage: (lang: SupportedLanguage | null) => void;
  handleConfirmationResponse: (response: 'confirmed' | 'denied') => void;
  closeExternalNav: () => void;
  proceedExternalNav: () => void;
  clearAction: () => void;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Assistant UI overlay state
  const [isOpen, setIsOpen] = useState(false);
  const [uiMode, setUiMode] = useState<AssistantUIMode>('compact');

  // Audio / visualizer state
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);
  const [micRms, setMicRms] = useState(0);

  // Realtime action & streaming state
  const [currentAction, setCurrentAction] = useState<CurrentActionState | null>(null);
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [assistantResponse, setAssistantResponse] = useState('');
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  // Navigation tracking
  const [navState, setNavState] = useState({
    currentRoute: location.pathname,
    previousRoute: '',
  });

  // Agent State Machine states
  const [agentState, setAgentState] = useState<AgentState>(AgentState.IDLE);
  const [agentConfirmation, setAgentConfirmation] = useState<ConfirmationRequest | null>(null);
  const [agentTask, setAgentTask] = useState<TaskProgress | null>(null);
  const [agentSources, setAgentSources] = useState<SourceInfo[]>([]);
  const [externalNav, setExternalNav] = useState<{ url: string; siteName: string } | null>(null);

  // Connect React Router navigate directly to agentBridge
  useEffect(() => {
    const unregister = registerAppNavigator((to) => {
      navigate(to);
    });
    return unregister;
  }, [navigate]);

  // Pre-fetch auth token in background
  useEffect(() => {
    prefetchToken();
  }, []);

  // Auto-start voice if start=true query param or /voice path
  const autoStartTriggeredRef = useRef(false);
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const isVoiceStart = searchParams.get('start') === 'true' || location.pathname === '/voice';
    if (isVoiceStart && !autoStartTriggeredRef.current) {
      autoStartTriggeredRef.current = true;
      startVoice({ defaultMode: 'expanded' });
    }
  }, [location.pathname, location.search, startVoice]);


  // Update route tracker and emit route changes
  useEffect(() => {
    setNavState((prev) => {
      if (prev.currentRoute !== location.pathname) {
        eventBus.emit({
          type: 'ROUTE_CHANGED',
          route: location.pathname,
          target: location.pathname,
          message: `User is now viewing ${location.pathname}`,
        });
        // Update UI State for agent
        updateUIState({
          route: location.pathname,
          pageName: document.title,
          isLoading: false,
        });
        eventBus.emit({
          type: 'PAGE_READY',
          route: location.pathname,
          title: document.title,
        });
        return {
          currentRoute: location.pathname,
          previousRoute: prev.currentRoute,
        };
      }
      return prev;
    });
  }, [location.pathname]);

  // Hook into Gemini Live WebRTC / Audio
  const {
    voiceState,
    onboardingState,
    profile,
    turns,
    error,
    metrics,
    connect,
    disconnect,
    setLanguage,
  } = useGeminiLive({
    onAnalyserData: (data) => setAnalyserData(new Uint8Array(data)),
    onMicAnalyserData: (rms) => setMicRms(rms),
    onToolCall: (tool, args) => {
      console.log('[AssistantContext] Live Tool Call:', tool, args);
      eventBus.emit({
        type: 'ACTION_STARTED',
        action: tool,
        data: args,
        message: `Executing ${tool}`,
      });
    },
  });

  // Set action helper with auto-clear
  const setLiveAction = useCallback((action: CurrentActionState, durationMs = 4000) => {
    if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current);
    setCurrentAction(action);
    if (durationMs > 0) {
      actionTimeoutRef.current = setTimeout(() => {
        setCurrentAction((prev) => (prev?.timestamp === action.timestamp ? null : prev));
      }, durationMs);
    }
  }, []);

  // Listen to Tool Manager Events
  useEffect(() => {
    const handler = (e: Event) => {
      const { tool, args } = (e as CustomEvent<VoiceToolEvent>).detail;
      const now = Date.now();

      switch (tool) {
        case 'navigateToRoute': {
          const route = String(args.route || '/');
          setLiveAction({
            type: 'navigate',
            status: 'in_progress',
            target: route,
            label: `Opening ${route}`,
            icon: '📍',
            timestamp: now,
          });
          break;
        }

        case 'navigateToScheme': {
          const schemeId = String(args.schemeId || '');
          setLiveAction({
            type: 'navigate',
            status: 'in_progress',
            target: `/services/${schemeId}`,
            label: `Opening Scheme: ${schemeId}`,
            icon: '📄',
            timestamp: now,
          });
          break;
        }

        case 'searchScheme':
        case 'searchGovernment': {
          const query = String(args.query || '');
          setLiveAction({
            type: 'search',
            status: 'in_progress',
            target: query,
            label: `Searching: "${query}"`,
            icon: '🏛️',
            timestamp: now,
          });
          break;
        }

        case 'getAgricultureNews': {
          setLiveAction({
            type: 'news',
            status: 'in_progress',
            label: `Loading Agriculture Updates`,
            icon: '📰',
            timestamp: now,
          });
          break;
        }

        case 'fillField': {
          const label = String(args.fieldLabel || args.fieldId || 'field');
          setLiveAction({
            type: 'form',
            status: 'in_progress',
            label: `Filling ${label}`,
            icon: '✍️',
            timestamp: now,
          });
          break;
        }

        case 'requestConfirmation': {
          setLiveAction({
            type: 'confirmation',
            status: 'waiting_confirmation',
            label: `Waiting for your confirmation`,
            icon: '⚠️',
            timestamp: now,
          }, 0);
          break;
        }

        case 'openExternalService': {
          const site = String(args.siteName || 'Government Portal');
          setLiveAction({
            type: 'external',
            status: 'in_progress',
            target: String(args.url || ''),
            label: `Opening ${site}`,
            icon: '🔗',
            timestamp: now,
          });
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener(VOICE_TOOL_EVENT, handler);
    return () => window.removeEventListener(VOICE_TOOL_EVENT, handler);
  }, [setLiveAction]);

  // Subscribe to realtime event bus
  useEffect(() => {
    const unsub = eventBus.subscribe((ev) => {
      setTimeline(eventBus.getTimeline());

      if (ev.type === 'NAVIGATION_START') {
        setLiveAction({
          type: 'navigate',
          status: 'in_progress',
          target: ev.route,
          label: `Opening ${ev.route || 'page'}`,
          icon: '→',
          timestamp: Date.now(),
        });
      } else if (ev.type === 'NAVIGATION_COMPLETE') {
        setLiveAction({
          type: 'navigate',
          status: 'completed',
          target: ev.route,
          label: `Opened ${ev.route || 'page'}`,
          icon: '✓',
          timestamp: Date.now(),
        }, 3000);
      }
    });
    return unsub;
  }, [setLiveAction]);

  // Subscribe to AgentStateMachine
  useEffect(() => {
    const unsub = AgentStateMachine.subscribe((event) => {
      switch (event.type) {
        case 'STATE_CHANGED':
          setAgentState(event.state);
          break;
        case 'CONFIRMATION_REQUIRED':
          setAgentConfirmation(event.request);
          break;
        case 'TASK_PROGRESS':
          setAgentTask(event.progress);
          break;
        case 'SOURCE_RECEIVED':
          setAgentSources((prev) => [event.source, ...prev].slice(0, 5));
          break;
        case 'EXTERNAL_NAVIGATION':
          setExternalNav({ url: event.url, siteName: event.siteName });
          break;
      }
    });
    return unsub;
  }, []);

  // Update streaming transcript from turns
  useEffect(() => {
    if (turns.length > 0) {
      const lastUser = [...turns].reverse().find((t) => t.speaker === 'user');
      const lastAi = [...turns].reverse().find((t) => t.speaker === 'assistant');
      if (lastUser?.text) setCurrentTranscript(lastUser.text);
      if (lastAi?.text) setAssistantResponse(lastAi.text);
    }
  }, [turns]);

  // Status flags
  const isListening =
    voiceState === VoiceState.LISTENING ||
    voiceState === VoiceState.READY_FOR_USER;
  const isSpeaking = voiceState === VoiceState.AI_SPEAKING;
  const isConnecting =
    voiceState === VoiceState.CONNECTING ||
    voiceState === VoiceState.RECOVERING ||
    voiceState === VoiceState.PREPARING;
  const isProcessing = voiceState === VoiceState.PROCESSING;
  const isError = voiceState === VoiceState.ERROR;

  // Start voice assistant
  const startVoice = useCallback(
    async (options?: { defaultMode?: AssistantUIMode; serviceContext?: any }) => {
      if (options?.serviceContext) {
        setActiveServiceContext(options.serviceContext);
      }
      setIsOpen(true);
      if (options?.defaultMode) {
        setUiMode(options.defaultMode);
      }
      eventBus.emit({
        type: 'ASSISTANT_LISTENING',
        message: 'Voice assistant session starting',
      });
      await connect();
    },
    [connect]
  );

  // Stop voice assistant
  const stopVoice = useCallback(() => {
    disconnect();
    setIsOpen(false);
    setAnalyserData(null);
    setMicRms(0);
    setCurrentAction(null);
    eventBus.emit({
      type: 'ASSISTANT_IDLE',
      message: 'Voice assistant session closed',
    });
  }, [disconnect]);

  // Retry voice connection
  const retryVoice = useCallback(async () => {
    await connect();
  }, [connect]);

  // Confirmation handling
  const handleConfirmationResponse = useCallback((response: 'confirmed' | 'denied') => {
    setAgentConfirmation(null);
    if (response === 'denied') {
      AgentStateMachine.forceTransition(AgentState.IDLE);
      setCurrentAction(null);
    }
  }, []);


  const closeExternalNav = useCallback(() => {
    setExternalNav(null);
  }, []);

  const proceedExternalNav = useCallback(() => {
    if (externalNav?.url) {
      window.open(externalNav.url, '_blank', 'noopener,noreferrer');
    }
    setExternalNav(null);
  }, [externalNav]);

  const clearAction = useCallback(() => {
    setCurrentAction(null);
  }, []);

  const contextValue = useMemo<AssistantContextType>(
    () => ({
      isOpen,
      uiMode,
      setUiMode,
      voiceState,
      onboardingState,
      isListening,
      isSpeaking,
      isProcessing,
      isConnecting,
      isError,
      currentTranscript,
      assistantResponse,
      currentAction,
      navigationState: navState,
      timeline,
      turns,
      metrics,
      profile,
      analyserData,
      micRms,
      error,
      agentState,
      agentConfirmation,
      agentTask,
      agentSources,
      externalNav,
      startVoice,
      stopVoice,
      retryVoice,
      setLanguage,
      handleConfirmationResponse,
      closeExternalNav,
      proceedExternalNav,
      clearAction,
    }),
    [
      isOpen,
      uiMode,
      voiceState,
      onboardingState,
      isListening,
      isSpeaking,
      isProcessing,
      isConnecting,
      isError,
      currentTranscript,
      assistantResponse,
      currentAction,
      navState,
      timeline,
      turns,
      metrics,
      profile,
      analyserData,
      micRms,
      error,
      agentState,
      agentConfirmation,
      agentTask,
      agentSources,
      externalNav,
      startVoice,
      stopVoice,
      retryVoice,
      setLanguage,
      handleConfirmationResponse,
      closeExternalNav,
      proceedExternalNav,
      clearAction,
    ]
  );

  return <AssistantContext.Provider value={contextValue}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
