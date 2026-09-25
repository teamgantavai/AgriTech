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
import {
  setFarmerContext,
  setActiveServiceContext,
  setProfileCollectionContext,
  isProfileCollectionActive,
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from '../services/sessionManager';
import {
  getProfile,
  confirmProfileField,
  rejectProfileField,
  skipProfileField,
} from '../services/profileService';
import {
  ProfileInterviewController,
  getFriendlyFieldLabel,
  formatFieldValueForCitizen,
} from '../services/profileInterviewController';
import type { CitizenProfile } from '../types/profile';
import { prefetchToken } from '../services/tokenService';
import { voiceManager } from '../services/VoiceSessionManager';
import { semanticScroll } from '../services/semanticScroll';

export interface ActiveDetectedField {
  fieldName: string;
  value: any;
  status: 'CONFIRMING' | 'CONFIRMED' | 'REJECTED' | 'SKIPPED';
  confidence: number;
  confirmationPrompt?: string;
  timestamp: number;
}

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
  startVoice: (options?: { defaultMode?: AssistantUIMode; serviceContext?: any; profileMode?: boolean }) => Promise<void>;
  stopVoice: () => void;
  retryVoice: () => Promise<void>;
  setLanguage: (lang: SupportedLanguage | null) => void;
  handleConfirmationResponse: (response: 'confirmed' | 'denied') => void;
  closeExternalNav: () => void;
  proceedExternalNav: () => void;
  clearAction: () => void;

  // Profile Collection Mode
  isProfileMode: boolean;
  activeDetectedField: ActiveDetectedField | null;
  startProfileCollection: (baselineProfile?: Partial<CitizenProfile>) => Promise<void>;
  confirmDetectedField: (field: string, value: any) => Promise<void>;
  rejectDetectedField: (field: string) => Promise<void>;
  skipDetectedField: (field: string) => Promise<void>;
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

  // Profile Collection Mode state
  const [activeDetectedField, setActiveDetectedField] = useState<ActiveDetectedField | null>(null);
  const interviewControllerRef = useRef<ProfileInterviewController | null>(null);
  const isProfileMode = isProfileCollectionActive();

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
        // Automatically minimize expanded voice window to compact so the newly opened page is visible
        setUiMode((current) => (current === 'expanded' ? 'compact' : current));

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

        case 'openFormCopilot': {
          const pid = String(args.portalId || 'nsp').toUpperCase();
          setLiveAction({
            type: 'form',
            status: 'in_progress',
            target: `/copilot/${args.portalId || 'nsp'}`,
            label: `Opening Government Form Copilot: ${pid}`,
            icon: '⚡',
            timestamp: now,
          });
          break;
        }

        case 'scroll_to_section': {
          const section = String(args.section || 'section');
          const reason = String(args.reason || '');
          setLiveAction({
            type: 'scroll',
            status: 'completed',
            target: section,
            label: `Viewing ${section.charAt(0).toUpperCase() + section.slice(1)}`,
            icon: '📜',
            timestamp: now,
          }, 2500);
          break;
        }

        // ── Citizen Profile Collection Event Handlers (Section 5, 24) ─────────
        case 'profile_extract_field': {
          const fieldName = String(args.fieldName || '');
          const value = args.value;
          const confidence = Number(args.confidence || 0.95);
          const friendly = getFriendlyFieldLabel(fieldName, 'en');
          const formattedVal = formatFieldValueForCitizen(fieldName, value);
          const confirmationPrompt = String(args.spokenConfirmation || `You said your ${friendly.toLowerCase()} is ${formattedVal}. Is that correct?`);

          setActiveDetectedField({
            fieldName,
            value,
            status: 'CONFIRMING',
            confidence,
            confirmationPrompt,
            timestamp: now,
          });

          setLiveAction({
            type: 'profile_detect',
            status: 'waiting_confirmation',
            label: `Please confirm ${friendly}: ${formattedVal}`,
            icon: '🎙️',
            timestamp: now,
          }, 0);
          break;
        }

        case 'profile_confirm_field': {
          const fieldName = String(args.fieldName || '');
          const value = args.value;
          const friendly = getFriendlyFieldLabel(fieldName, 'en');
          const formattedVal = formatFieldValueForCitizen(fieldName, value);

          setActiveDetectedField({
            fieldName,
            value,
            status: 'CONFIRMED',
            confidence: 1.0,
            timestamp: now,
          });

          setLiveAction({
            type: 'profile_confirm',
            status: 'completed',
            label: `✓ Saved ${friendly}: ${formattedVal}`,
            icon: '✅',
            timestamp: now,
          }, 4000);
          break;
        }

        case 'profile_reject_field': {
          const fieldName = String(args.fieldName || '');
          const friendly = getFriendlyFieldLabel(fieldName, 'en');
          setActiveDetectedField(null);

          setLiveAction({
            type: 'profile_reject',
            status: 'failed',
            label: `Please provide your ${friendly.toLowerCase()} again`,
            icon: '✎',
            timestamp: now,
          }, 3000);
          break;
        }

        case 'profile_skip_field': {
          const fieldName = String(args.fieldName || '');
          const friendly = getFriendlyFieldLabel(fieldName, 'en');
          setActiveDetectedField(null);

          setLiveAction({
            type: 'profile_skip',
            status: 'completed',
            label: `Skipped ${friendly}`,
            icon: '⏭️',
            timestamp: now,
          }, 2500);
          break;
        }

        case 'profile_verify_summary': {
          setLiveAction({
            type: 'profile_verify',
            status: 'in_progress',
            label: 'Verifying stored profile details',
            icon: '📋',
            timestamp: now,
          }, 4000);
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
        // Automatically minimize expanded window to compact with animation when navigating
        setUiMode('compact');
        setLiveAction({
          type: 'navigate',
          status: 'in_progress',
          target: ev.route,
          label: `Opening ${ev.route || 'page'}`,
          icon: '→',
          timestamp: Date.now(),
        });
      }
 else if (ev.type === 'NAVIGATION_COMPLETE') {
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
      const lastUser = [...turns].reverse().find((t) => t.role === 'user');
      const lastAi = [...turns].reverse().find((t) => t.role === 'assistant');
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
    async (options?: { defaultMode?: AssistantUIMode; serviceContext?: any; profileMode?: boolean }) => {
      const isProfileRoute = Boolean(
        location.pathname === '/profile' ||
        options?.profileMode ||
        (typeof window !== 'undefined' && window.location.pathname.includes('/profile'))
      );

      if (isProfileRoute) {
        let baseline: Partial<CitizenProfile> = {};
        try {
          const p = await getProfile();
          if (p) baseline = p;
        } catch {
          // continue with empty baseline
        }
        const controller = new ProfileInterviewController(baseline);
        interviewControllerRef.current = controller;
        const nextStep = controller.getNextStep();

        setProfileCollectionContext({
          active: true,
          currentField: nextStep ? String(nextStep.field) : 'full_name',
          currentFieldLabel: nextStep ? nextStep.label : 'Full Name',
          currentFieldQuestion: nextStep ? nextStep.spokenHindiQuestion : 'Sabse pehle, aapka poora naam kya hai?',
          completedFields: [],
          remainingFields: ['full_name', 'date_of_birth', 'gender', 'mobile', 'state', 'district', 'village_city', 'pin_code', 'address', 'occupation', 'highest_qualification', 'category', 'annual_family_income'],
        });
      }

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
    [connect, location.pathname]
  );

  // Trigger Profile Collection Mode (Section 1, 2, 3, 20)
  const startProfileCollection = useCallback(async (baselineProfile?: Partial<CitizenProfile>) => {
    const controller = new ProfileInterviewController(baselineProfile || {});
    interviewControllerRef.current = controller;

    const nextStep = controller.getNextStep();
    if (!nextStep) {
      setLiveAction({
        type: 'profile_complete',
        status: 'completed',
        label: '✓ Your profile is already complete!',
        icon: '🎉',
        timestamp: Date.now(),
      }, 4000);
      return;
    }

    const intro = controller.getIntroductoryMessage('hi');

    setProfileCollectionContext({
      active: true,
      currentField: String(nextStep.field),
      currentFieldLabel: nextStep.label,
      currentFieldQuestion: nextStep.spokenHindiQuestion,
      introGreeting: `${intro.greeting} ${intro.questionText}`,
      completedFields: [],
      remainingFields: [],
    });

    if (location.pathname !== '/profile') {
      navigate('/profile');
    }
    await startVoice({ defaultMode: 'expanded', profileMode: true });
  }, [location.pathname, navigate, startVoice]);

  // Touch confirmation actions (Section 21, 22: Optimistic UI & non-blocking background persistence)
  const confirmDetectedField = useCallback(
    async (field: string, value: any) => {
      const friendly = getFriendlyFieldLabel(field, 'en');
      const formatted = formatFieldValueForCitizen(field, value);

      // 1. Instant Optimistic UI Update (Section 22)
      setActiveDetectedField({
        fieldName: field,
        value,
        status: 'CONFIRMED',
        confidence: 1.0,
        timestamp: Date.now(),
      });

      setLiveAction({
        type: 'profile_confirm',
        status: 'completed',
        label: `✓ Saved ${friendly}: ${formatted}`,
        icon: '✅',
        timestamp: Date.now(),
      }, 3500);

      // 2. Advance Interview Controller to next field (Section 20)
      if (interviewControllerRef.current) {
        interviewControllerRef.current.confirmField(field, value);
        const nextStep = interviewControllerRef.current.getNextStep();
        if (nextStep) {
          setProfileCollectionContext({
            active: true,
            currentField: String(nextStep.field),
            currentFieldLabel: nextStep.label,
            currentFieldQuestion: nextStep.spokenHindiQuestion,
          });
        } else {
          setProfileCollectionContext({ active: false });
        }
      }

      // 3. Background Database Persistence (Section 21: Non-blocking)
      confirmProfileField(field as any, value, 'voice', 1.0).catch((err) => {
        console.warn('Background profile save warning:', err);
      });
    },
    [setLiveAction]
  );

  const rejectDetectedField = useCallback(
    async (field: string) => {
      const friendly = getFriendlyFieldLabel(field, 'en');
      setActiveDetectedField(null);

      setLiveAction({
        type: 'profile_reject',
        status: 'failed',
        label: `Please provide your ${friendly.toLowerCase()} again`,
        icon: '✎',
        timestamp: Date.now(),
      }, 3000);

      // Background rejection recording
      rejectProfileField(field as any, 'User tapped change').catch((err) => {
        console.warn('Background reject warning:', err);
      });
    },
    [setLiveAction]
  );

  const skipDetectedField = useCallback(
    async (field: string) => {
      const friendly = getFriendlyFieldLabel(field, 'en');
      setActiveDetectedField(null);

      setLiveAction({
        type: 'profile_skip',
        status: 'completed',
        label: `Skipped ${friendly}`,
        icon: '⏭️',
        timestamp: Date.now(),
      }, 2500);

      // Advance interview controller past this skipped field
      if (interviewControllerRef.current) {
        interviewControllerRef.current.skipField(field);
        const nextStep = interviewControllerRef.current.getNextStep();
        if (nextStep) {
          setProfileCollectionContext({
            active: true,
            currentField: String(nextStep.field),
            currentFieldLabel: nextStep.label,
            currentFieldQuestion: nextStep.spokenHindiQuestion,
          });
        } else {
          setProfileCollectionContext({ active: false });
        }
      }

      // Background skip recording
      skipProfileField(field as any).catch((err) => {
        console.warn('Background skip warning:', err);
      });
    },
    [setLiveAction]
  );

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


  // Stop voice assistant
  const stopVoice = useCallback(() => {
    disconnect();
    voiceManager.interrupt();
    semanticScroll.cancelScrolling();
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
      isProfileMode,
      activeDetectedField,
      startProfileCollection,
      confirmDetectedField,
      rejectDetectedField,
      skipDetectedField,
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
      isProfileMode,
      activeDetectedField,
      startProfileCollection,
      confirmDetectedField,
      rejectDetectedField,
      skipDetectedField,
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
