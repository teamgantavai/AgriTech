import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LanguageCode } from '../types';
import { useGeminiLive, GeminiLiveState } from '../hooks/useGeminiLive';
import { detectAndFetchScheme, SchemeIntentResult } from '../services/schemeIntent';
import { evaluateWebsiteControl, WebsiteAction } from '../services/websiteControl';

interface FloatingPosition {
  x: number;
  y: number;
}

const STORAGE_KEY_POS = 'sahkar_assistant_position';

function getStoredPosition(): FloatingPosition {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_POS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { x: -1, y: -1 }; // -1 indicates default bottom-right
}

interface VoiceModalContextType {
  // Modal / Visibility state
  isVoiceModalOpen: boolean;
  isAssistantActive: boolean;
  isMinimized: boolean;
  initialVoiceLanguage: LanguageCode;
  openVoiceModal: (initialLanguage?: LanguageCode, forceDirect?: boolean) => void;
  closeVoiceModal: () => void;
  minimizeAssistant: () => void;
  expandAssistant: () => void;

  // Floating Position & Dragging
  position: FloatingPosition;
  setPosition: (pos: FloatingPosition) => void;

  // Active Scheme & Page Awareness
  currentSchemeId: string | null;
  setCurrentSchemeId: (schemeId: string | null) => void;
  highlightSection: string | null;
  setHighlightSection: (section: string | null) => void;
  explainCurrentScheme: (schemeTitle: string, aboutText?: string) => Promise<void>;

  // Gemini Live Engine Controls & Audio States
  connectionState: GeminiLiveState;
  isLiveConnected: boolean;
  isMicMuted: boolean;
  userVolume: number;
  aiVolume: number;
  errorMessage: string | null;
  currentAssistantText: string;
  currentUserText: string;
  detectedLanguage: string;
  transcriptHistory: any[];

  // Actions
  startAssistant: () => Promise<void>;
  stopAssistant: () => void;
  toggleMicMute: () => void;
  interruptAI: () => void;
  reconnect: () => void;
  sendUserPrompt: (prompt: string) => Promise<void>;
  startPushToTalk: () => void;
  stopPushToTalk: () => void;
  isPushToTalkActive: boolean;
}

const VoiceModalContext = createContext<VoiceModalContextType | undefined>(undefined);

export function VoiceModalProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [initialVoiceLanguage, setInitialVoiceLanguage] = useState<LanguageCode>('auto');
  const [position, setPositionState] = useState<FloatingPosition>(getStoredPosition);

  // Scheme awareness
  const [currentSchemeId, setCurrentSchemeId] = useState<string | null>(() => {
    const match = location.pathname.match(/\/schemes\/([^/?#]+)/);
    return match ? match[1] : null;
  });
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);

  // Guard to prevent any async task from re-opening assistant after manual close
  const isClosedManuallyRef = useRef(false);

  // Keep location in sync with currentSchemeId
  useEffect(() => {
    const match = location.pathname.match(/\/schemes\/([^/?#]+)/);
    if (match) {
      setCurrentSchemeId(match[1]);
    } else if (location.pathname === '/' || location.pathname === '/chat') {
      setCurrentSchemeId(null);
      setHighlightSection(null);
    }
  }, [location.pathname]);

  // Unified Gemini Live session
  const {
    connectionState,
    isLiveConnected,
    isMicMuted,
    userVolume,
    aiVolume,
    errorMessage,
    transcriptHistory,
    currentAssistantText,
    currentUserText,
    detectedLanguage,
    startSession,
    endSession,
    toggleMicMute,
    interruptAI,
    reconnect,
    sendUserPrompt,
    setPushToTalkActive,
  } = useGeminiLive(false);

  const lastHandledUserTextRef = useRef<string>('');
  const schemeDebounceTimerRef = useRef<any>(null);

  // Save position to sessionStorage
  const setPosition = useCallback((pos: FloatingPosition) => {
    setPositionState(pos);
    try {
      sessionStorage.setItem(STORAGE_KEY_POS, JSON.stringify(pos));
    } catch {}
  }, []);

  const openVoiceModal = useCallback((initialLanguage: LanguageCode = 'auto') => {
    isClosedManuallyRef.current = false;
    setInitialVoiceLanguage(initialLanguage);
    setIsVoiceModalOpen(true);
    setIsMinimized(false);
    startSession();
  }, [startSession]);

  const closeVoiceModal = useCallback(() => {
    isClosedManuallyRef.current = true;
    clearTimeout(schemeDebounceTimerRef.current);
    lastHandledUserTextRef.current = '';
    setIsVoiceModalOpen(false);
    setIsMinimized(false);
    endSession();
  }, [endSession]);

  const minimizeAssistant = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const expandAssistant = useCallback(() => {
    isClosedManuallyRef.current = false;
    setIsMinimized(false);
    setIsVoiceModalOpen(true);
  }, []);

  const startPushToTalk = useCallback(() => {
    setIsPushToTalkActive(true);
    setPushToTalkActive(true);
  }, [setPushToTalkActive]);

  const stopPushToTalk = useCallback(() => {
    setIsPushToTalkActive(false);
    setPushToTalkActive(false);
  }, [setPushToTalkActive]);

  // Explain current scheme with clear, simple audio guidance directly from database
  const explainCurrentScheme = useCallback(
    async (schemeTitle: string, aboutText?: string) => {
      if (!isVoiceModalOpen || isClosedManuallyRef.current) return;
      const textToRead = aboutText || `यह ${schemeTitle} योजना है।`;
      const prompt = `Speak this verified database summary for ${schemeTitle} to the user in concise, spoken Hindi (2 sentences max): "${textToRead}"`;
      await sendUserPrompt(prompt);
    },
    [isVoiceModalOpen, sendUserPrompt]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Website Control Engine (Direct execution without turn collisions)
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // If modal is closed by user, do NOT process or trigger any actions
    if (isClosedManuallyRef.current || !isVoiceModalOpen) {
      return;
    }

    if (!currentUserText || currentUserText === lastHandledUserTextRef.current) {
      return;
    }

    // Fast, responsive debounce to allow user to complete phrases
    clearTimeout(schemeDebounceTimerRef.current);
    schemeDebounceTimerRef.current = setTimeout(async () => {
      if (isClosedManuallyRef.current || !isVoiceModalOpen) return;

      const userPhrase = currentUserText.trim();
      if (!userPhrase || userPhrase === lastHandledUserTextRef.current) return;

      lastHandledUserTextRef.current = userPhrase;
      console.log(`🔍 [WebsiteControl] Evaluating user speech: "${userPhrase}"`);

      // Evaluate website control action directly from speech
      const action: WebsiteAction = await evaluateWebsiteControl(userPhrase, currentSchemeId);
      console.log('⚡ [WebsiteControl] Action determined:', action);

      if (isClosedManuallyRef.current || !isVoiceModalOpen) return;

      switch (action.action) {
        case 'navigate': {
          if (action.targetPath === '-1') {
            console.log('🔙 [WebsiteControl] Navigating back');
            navigate(-1);
          } else if (action.targetPath && location.pathname !== action.targetPath) {
            console.log(`🚀 [WebsiteControl] Navigating to ${action.targetPath}`);
            navigate(action.targetPath);
          }
          break;
        }

        case 'open_scheme': {
          if (action.schemeId) {
            const targetPath = `/schemes/${action.schemeId}`;
            console.log(`🌾 [WebsiteControl] Opening scheme: ${targetPath}`);
            if (location.pathname !== targetPath) {
              navigate(targetPath);
            }
            setCurrentSchemeId(action.schemeId);
            if (action.targetSection) {
              setHighlightSection(action.targetSection);
            }
          }
          break;
        }

        case 'highlight_section': {
          if (action.targetSection) {
            console.log(`📌 [WebsiteControl] Highlighting section: ${action.targetSection}`);
            setHighlightSection(action.targetSection);
          }
          break;
        }

        case 'scroll_down': {
          console.log('⬇️ [WebsiteControl] Scrolling down');
          window.scrollBy({ top: 380, behavior: 'smooth' });
          break;
        }

        case 'scroll_up': {
          console.log('⬆️ [WebsiteControl] Scrolling up');
          window.scrollBy({ top: -380, behavior: 'smooth' });
          break;
        }

        case 'scroll_top': {
          console.log('🔝 [WebsiteControl] Scrolling to top');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        }

        case 'close_assistant': {
          console.log('❌ [WebsiteControl] Closing voice assistant');
          closeVoiceModal();
          break;
        }

        case 'minimize_assistant': {
          console.log('➖ [WebsiteControl] Minimizing assistant');
          minimizeAssistant();
          break;
        }

        case 'expand_assistant': {
          console.log('➕ [WebsiteControl] Expanding assistant');
          expandAssistant();
          break;
        }

        case 'mute_mic': {
          console.log('🔇 [WebsiteControl] Muting microphone');
          if (!isMicMuted) toggleMicMute();
          break;
        }

        case 'unmute_mic': {
          console.log('🎙️ [WebsiteControl] Unmuting microphone');
          if (isMicMuted) toggleMicMute();
          break;
        }

        case 'open_language_modal': {
          console.log('🌐 [WebsiteControl] Opening language modal');
          window.dispatchEvent(new CustomEvent('open-onboarding-modal'));
          break;
        }

        default:
          break;
      }
    }, 280);

    return () => clearTimeout(schemeDebounceTimerRef.current);
  }, [
    currentUserText,
    currentSchemeId,
    isVoiceModalOpen,
    location.pathname,
    navigate,
    closeVoiceModal,
    minimizeAssistant,
    expandAssistant,
    isMicMuted,
    toggleMicMute,
  ]);

  return (
    <VoiceModalContext.Provider
      value={{
        isVoiceModalOpen,
        isAssistantActive: isVoiceModalOpen || isLiveConnected,
        isMinimized,
        initialVoiceLanguage,
        openVoiceModal,
        closeVoiceModal,
        minimizeAssistant,
        expandAssistant,

        position,
        setPosition,

        currentSchemeId,
        setCurrentSchemeId,
        highlightSection,
        setHighlightSection,
        explainCurrentScheme,

        connectionState,
        isLiveConnected,
        isMicMuted,
        userVolume,
        aiVolume,
        errorMessage,
        currentAssistantText,
        currentUserText,
        detectedLanguage,
        transcriptHistory,

        startAssistant: startSession,
        stopAssistant: endSession,
        toggleMicMute,
        interruptAI,
        reconnect,
        sendUserPrompt,
        startPushToTalk,
        stopPushToTalk,
        isPushToTalkActive,
      }}
    >
      {children}
    </VoiceModalContext.Provider>
  );
}

export function useVoiceModal(): VoiceModalContextType {
  const context = useContext(VoiceModalContext);
  if (!context) {
    throw new Error('useVoiceModal must be used within a VoiceModalProvider');
  }
  return context;
}
