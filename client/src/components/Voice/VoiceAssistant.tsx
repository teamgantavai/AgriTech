import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  X,
  Minus,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Hand,
  Volume2,
  ChevronUp,
  ChevronDown,
  Award,
} from 'lucide-react';
import { useVoiceModal } from '../../context/VoiceModalContext';
import { cleanSpokenText } from '../../hooks/useGeminiLive';
import { speakText, stopSpeaking } from '../../services/textToSpeech';
import { streamChatMessage } from '../../services/api';
import {
  PERSONALIZED_CATEGORIES,
  PersonalizedCategory,
  PersonalizedService,
  UserRole,
  USER_ROLES,
  LanguageCode,
} from '../../types';
import {
  FEATURED_LANGUAGES,
  LANG_META,
  VOICE_PROMPTS,
  ROLE_INTEREST_MAP,
  InterestOption,
} from './VoiceOnboardingModal';
import { VoiceVisualizer } from './VoiceVisualizer';
import { clsx } from 'clsx';

const WELCOME_GREETINGS: Record<string, string> = {
  hi: 'नमस्ते! आपकी पसंद के अनुसार सहकार साथी तैयार है। आप सीधे बोलकर सवाल पूछ सकते हैं।',
  en: 'Hello! Sahkar Sathi is personalized and ready for you. You can speak your questions directly.',
  'hi-Latn': 'Namaste! Aapki pasand ke anusaar Sahkar Saathi taiyar hai. Aap seedhe bolkar sawaal pooch sakte hain.',
  pa: 'ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ! ਤੁਹਾਡੀ ਪਸੰਦ ਅਨੁਸਾਰ ਸਹਿਕਾਰ ਸਾਥੀ ਤਿਆਰ ਹੈ। ਤੁਸੀਂ ਸਿੱਧਾ ਬੋਲ ਕੇ ਸਵਾਲ ਪੁੱਛ ਸਕਦੇ ਹੋ।',
  mr: 'नमस्कार! आपल्या आवडीनुसार सहकार साथी सज्ज आहे. आपण थेट बोलून प्रश्न विचारू शकता.',
  gu: 'નમસ્તે! તમારી પસંદગી મુજબ સહકાર સાથી તૈયાર છે. તમે સીધા બોલીને પ્રશ્ન પૂછી શકો છો.',
  bn: 'নমস্কার! আপনার পছন্দ অনুযায়ী সহকার সাথী প্রস্তুত। আপনি সরাসরি কথা বলে প্রশ্ন করতে পারেন।',
  ta: 'வணக்கம்! உங்கள் விருப்பப்படி சஹ்கார் சாதி தயாராக உள்ளது. நீங்கள் நேரடியாகப் பேசி கேள்வி கேட்கலாம்.',
  te: 'నమస్కారం! మీ ప్రాధాన్యతల ప్రకారం సహకార్ సాథీ సిద్ధంగా ఉంది. మీరు నేరుగా మాట్లాడి ప్రశ్నలు అడగవచ్చు.',
  kn: 'ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಆಯ್ಕೆಯಂತೆ ಸಹಕಾರ ಸಾಥಿ ಸಿದ್ಧವಾಗಿದೆ. ನೀವು ನೇರವಾಗಿ ಮಾತನಾಡಿ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಬಹುದು.',
  ml: 'നമസ്കാരം! നിങ്ങളുടെ മുൻഗണന അനുസരിച്ച് സഹകാർ സാഥി തയ്യാറാണ്. നിങ്ങൾക്ക് നേരിട്ട് സംസാരിച്ച് ചോദ്യങ്ങൾ ചോദിക്കാം.',
  or: 'ନମସ୍କାର! ଆପଣଙ୍କ ପସନ୍ଦ ଅନୁସାରେ ସହକାର ସାଥୀ ପ୍ରସ୍ତୁତ। ଆପଣ ସିଧା କଥା କହି ପ୍ରଶ୍ନ ପଚାରିପାରିବେ।',
  as: 'নমস্কাৰ! আপোনাৰ পছন্দ অনুসৰি সহকাৰ সাথী সাজু হৈছে। আপুনি পোনপটীয়াকৈ কথা কৈ প্ৰশ্ন সুধিব পাৰে।',
  ur: 'آداب! آپ کی ترجیح के مطابق سہکار ساتھی تیار ہے۔ آپ براہ راست بول کر سوال پوچھ سکتے ہیں۔',
};

export function VoiceAssistant() {
  const navigate = useNavigate();
  const {
    isVoiceModalOpen,
    isAssistantActive,
    isMinimized,
    closeVoiceModal,
    minimizeAssistant,
    expandAssistant,
    position,
    setPosition,
    connectionState,
    isMicMuted,
    userVolume,
    aiVolume,
    errorMessage,
    currentAssistantText,
    currentUserText,
    toggleMicMute,
    interruptAI,
    reconnect,
    sendUserPrompt,
    startPushToTalk,
    stopPushToTalk,
    isPushToTalkActive,
  } = useVoiceModal();

  // Selected category state for personalized services inside the voice assistant
  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    try {
      const stored = localStorage.getItem('sahkar_user_role') as UserRole;
      if (stored && PERSONALIZED_CATEGORIES.some((c) => c.id === stored)) {
        return stored;
      }
    } catch { }
    return 'farmer';
  });
  const [selectedInterest, setSelectedInterest] = useState<string>(() => {
    try {
      return localStorage.getItem('sahkar_user_interest') || '';
    } catch {
      return '';
    }
  });
  const [userLang, setUserLang] = useState<string>(() => {
    try {
      return localStorage.getItem('sahkar_user_lang') || 'hi';
    } catch {
      return 'hi';
    }
  });

  // 3-Question Voice Interview State:
  // 1 = Question 1 (Language), 2 = Question 2 (Occupation/Role), 3 = Question 3 (Interest), 0 = Conversational Mode
  const [interviewStep, setInterviewStep] = useState<number>(() => {
    try {
      if (sessionStorage.getItem('sahkar_voice_interview_done') === 'true') {
        return 0;
      }
      return 1;
    } catch {
      return 1;
    }
  });

  const [fastAssistantText, setFastAssistantText] = useState<string>('');
  const [fastUserText, setFastUserText] = useState<string>('');
  const [isFastAnswering, setIsFastAnswering] = useState<boolean>(false);
  const [isServicesExpanded, setIsServicesExpanded] = useState<boolean>(true);

  // Sync category & interest with external updates
  useEffect(() => {
    const handleRoleUpdate = (e: any) => {
      if (e.detail?.role && PERSONALIZED_CATEGORIES.some((c) => c.id === e.detail.role)) {
        setSelectedRole(e.detail.role);
      }
      if (e.detail?.interest) {
        setSelectedInterest(e.detail.interest);
      }
      if (e.detail?.lang) {
        setUserLang(e.detail.lang);
      }
    };
    window.addEventListener('user-role-updated', handleRoleUpdate);
    return () => window.removeEventListener('user-role-updated', handleRoleUpdate);
  }, []);

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    try {
      localStorage.setItem('sahkar_user_role', role);
      window.dispatchEvent(new CustomEvent('user-role-updated', { detail: { role } }));
    } catch { }
  };

  const currentCategory: PersonalizedCategory =
    PERSONALIZED_CATEGORIES.find((c) => c.id === selectedRole) ||
    PERSONALIZED_CATEGORIES[0];

  // Ultra-fast voice query executor (answers in < 1 second using streaming SSE + pipelined TTS)
  const handleFastVoiceAsk = useCallback(async (promptText: string) => {
    if (!promptText || !promptText.trim()) return;
    const cleanPrompt = promptText.trim();
    const startMs = performance.now();

    // Stop any existing speech or live audio immediately to prevent overlap
    stopSpeaking();
    interruptAI();

    setFastUserText(cleanPrompt);
    setFastAssistantText('');
    setIsFastAnswering(true);

    const sentenceQueue: string[] = [];
    let isSpeakingQueue = false;
    let firstTokenLogged = false;
    let firstPlaybackLogged = false;
    let accumulatedText = '';
    let sentenceBuffer = '';

    const playNextInQueue = () => {
      if (sentenceQueue.length === 0) {
        isSpeakingQueue = false;
        return;
      }
      isSpeakingQueue = true;
      const sentence = sentenceQueue.shift()!;
      speakText(sentence, userLang, {
        rate: 1.02,
        pitch: 1.0,
        onStart: () => {
          if (!firstPlaybackLogged) {
            firstPlaybackLogged = true;
            const latency = performance.now() - startMs;
            console.log(`🔊 [AUDIO PLAYBACK START] Fast Ask started playback at +${latency.toFixed(1)}ms`);
            console.log(`🚀 [TOTAL LATENCY] Query dispatched -> AI audio playing: ${latency.toFixed(1)}ms`);
          }
          setIsFastAnswering(true);
        },
        onEnd: () => {
          playNextInQueue();
        },
        onError: () => {
          playNextInQueue();
        },
      });
    };

    try {
      await streamChatMessage(
        {
          message: cleanPrompt,
          voiceMode: true,
          role: selectedRole,
          interest: selectedInterest,
          forceLanguage: userLang as LanguageCode,
        },
        {
          onChunk: (chunk) => {
            if (!firstTokenLogged) {
              firstTokenLogged = true;
              console.log(`⏱️ [LLM FIRST TOKEN] Fast Ask received first chunk at +${(performance.now() - startMs).toFixed(1)}ms`);
            }

            accumulatedText += chunk;
            sentenceBuffer += chunk;
            const cleanDisplay = cleanSpokenText(accumulatedText);
            setFastAssistantText(cleanDisplay);

            // Look for sentence boundaries (., ?, !, ।, newline)
            const match = sentenceBuffer.match(/^([\s\S]+?[.?!।\n]+)([\s\S]*)$/);
            if (match && match[1].trim().length > 3) {
              const sentence = cleanSpokenText(match[1].trim());
              sentenceBuffer = match[2].trimStart();
              if (sentence) {
                sentenceQueue.push(sentence);
                if (!isSpeakingQueue) {
                  playNextInQueue();
                }
              }
            }
          },
        }
      );

      // Flush remainder
      const remaining = cleanSpokenText(sentenceBuffer.trim());
      if (remaining.length > 0) {
        sentenceQueue.push(remaining);
        if (!isSpeakingQueue) {
          playNextInQueue();
        }
      }
    } catch (err) {
      console.warn('[VoiceAssistant] Fast ask error:', err);
    } finally {
      setIsFastAnswering(false);
    }
  }, [selectedRole, selectedInterest, userLang, interruptAI]);

  const handleServiceVoiceAsk = (srv: PersonalizedService) => {
    navigate(`/schemes/${srv.schemeId}`);
    stopSpeaking();
    interruptAI();
    handleFastVoiceAsk(srv.voicePrompt);
  };

  // Handle Step 1 -> Language Selection
  const handleSelectLanguage = useCallback((code: LanguageCode) => {
    stopSpeaking();
    interruptAI();
    setUserLang(code);
    try {
      localStorage.setItem('sahkar_user_lang', code);
      window.dispatchEvent(new CustomEvent('language-changed', { detail: { language: code } }));
    } catch { }

    setInterviewStep(2);
    const q2 = VOICE_PROMPTS.step2[code] || VOICE_PROMPTS.step2.hi;
    setFastAssistantText(q2);
    speakText(q2, code, { rate: 1.02 });
  }, [interruptAI]);

  // Handle Step 2 -> Occupation / Role Selection
  const handleSelectRoleFromInterview = useCallback((role: UserRole) => {
    stopSpeaking();
    interruptAI();
    setSelectedRole(role);
    try {
      localStorage.setItem('sahkar_user_role', role);
      window.dispatchEvent(new CustomEvent('user-role-updated', { detail: { role } }));
    } catch { }

    setInterviewStep(3);
    const q3 = VOICE_PROMPTS.step3[userLang as LanguageCode] || VOICE_PROMPTS.step3.hi;
    setFastAssistantText(q3);
    speakText(q3, userLang, { rate: 1.02 });
  }, [interruptAI, userLang]);

  // Handle Step 3 -> Interest Selection & Final Confirmation
  const handleSelectInterestFromInterview = useCallback((interest: InterestOption) => {
    stopSpeaking();
    interruptAI();
    setSelectedInterest(interest.titleHi);
    try {
      localStorage.setItem('sahkar_user_interest', interest.titleHi);
      localStorage.setItem('sahkar_onboarding_completed', 'true');
      sessionStorage.setItem('sahkar_voice_interview_done', 'true');
      window.dispatchEvent(new CustomEvent('user-role-updated', { detail: { interest: interest.titleHi } }));
    } catch { }

    setInterviewStep(0);
    const conf = VOICE_PROMPTS.confirm[userLang as LanguageCode] || VOICE_PROMPTS.confirm.hi;
    setFastAssistantText(conf);
    speakText(conf, userLang, { rate: 1.02 });
  }, [interruptAI, userLang]);

  // Restart 3 Questions anytime
  const handleRestartInterview = useCallback(() => {
    stopSpeaking();
    interruptAI();
    sessionStorage.removeItem('sahkar_voice_interview_done');
    setInterviewStep(1);
    const q1 = VOICE_PROMPTS.step1[userLang as LanguageCode] || VOICE_PROMPTS.step1.hi;
    setFastAssistantText(q1);
    speakText(q1, userLang, { rate: 1.02 });
  }, [interruptAI, userLang]);

  // Initial speech when Voice Assistant opens: AI MUST ask the 3 questions!
  const hasSpokenWelcomeRef = useRef(false);
  useEffect(() => {
    if (isVoiceModalOpen) {
      if (!hasSpokenWelcomeRef.current) {
        hasSpokenWelcomeRef.current = true;

        if (sessionStorage.getItem('sahkar_skip_welcome') === 'true') {
          sessionStorage.removeItem('sahkar_skip_welcome');
          return;
        }

        if (interviewStep > 0) {
          // Speak Question 1 immediately!
          const q1 = VOICE_PROMPTS.step1[userLang as LanguageCode] || VOICE_PROMPTS.step1.hi;
          setFastAssistantText(q1);
          speakText(q1, userLang, { rate: 1.02 });
        } else {
          // Regular welcome if interview already completed in this session
          const welcome = WELCOME_GREETINGS[userLang] || WELCOME_GREETINGS.hi;
          setFastAssistantText(welcome);
          speakText(welcome, userLang, { rate: 1.02 });
        }
      }
    } else {
      hasSpokenWelcomeRef.current = false;
    }
  }, [isVoiceModalOpen, interviewStep, userLang]);

  // Spoken voice keyword recognition during interview steps 1, 2, 3
  const lastProcessedSpeechRef = useRef<string>('');
  useEffect(() => {
    const textToCheck = (currentUserText || fastUserText || '').toLowerCase().trim();
    if (!textToCheck || interviewStep === 0 || textToCheck === lastProcessedSpeechRef.current) return;

    if (interviewStep === 1) {
      for (const [code, meta] of Object.entries(LANG_META)) {
        if (meta.spokenKeywords.some((kw) => textToCheck.includes(kw.toLowerCase()))) {
          lastProcessedSpeechRef.current = textToCheck;
          handleSelectLanguage(code as LanguageCode);
          return;
        }
      }
    } else if (interviewStep === 2) {
      for (const role of USER_ROLES) {
        if (
          role.speechKeywords.some((kw) => textToCheck.includes(kw.toLowerCase())) ||
          textToCheck.includes(role.titleHi.toLowerCase()) ||
          textToCheck.includes((role.titleEn || role.title).toLowerCase())
        ) {
          lastProcessedSpeechRef.current = textToCheck;
          handleSelectRoleFromInterview(role.id);
          return;
        }
      }
    } else if (interviewStep === 3) {
      const interests = ROLE_INTEREST_MAP[selectedRole] || [];
      for (const item of interests) {
        if (
          item.speechKeywords.some((kw) => textToCheck.includes(kw.toLowerCase())) ||
          textToCheck.includes(item.titleHi.toLowerCase()) ||
          textToCheck.includes(item.titleEn.toLowerCase())
        ) {
          lastProcessedSpeechRef.current = textToCheck;
          handleSelectInterestFromInterview(item);
          return;
        }
      }
    }
  }, [
    currentUserText,
    fastUserText,
    interviewStep,
    selectedRole,
    userLang,
    handleSelectLanguage,
    handleSelectRoleFromInterview,
    handleSelectInterestFromInterview,
  ]);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize position to bottom-right if not set
  useEffect(() => {
    if (position.x === -1 || position.y === -1) {
      const defaultX = Math.max(16, window.innerWidth - 380);
      const defaultY = Math.max(16, window.innerHeight - 440);
      setPosition({ x: defaultX, y: defaultY });
    }
  }, [position, setPosition]);

  // Mouse / Touch Drag handlers
  const handlePointerDown = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x === -1 ? Math.max(16, window.innerWidth - 380) : position.x,
      initialY: position.y === -1 ? Math.max(16, window.innerHeight - 440) : position.y,
    };
  }, [position]);

  const onMouseDownHeader = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    handlePointerDown(e.clientX, e.clientY);
  };

  const onTouchStartHeader = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const touch = e.touches[0];
    handlePointerDown(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (clientX: number, clientY: number) => {
      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      const newX = dragStartRef.current.initialX + deltaX;
      const newY = dragStartRef.current.initialY + deltaY;

      // Keep within bounds
      const containerW = isMinimized ? 220 : 360;
      const containerH = isMinimized ? 60 : 380;
      const boundedX = Math.max(10, Math.min(window.innerWidth - containerW, newX));
      const boundedY = Math.max(10, Math.min(window.innerHeight - containerH, newY));

      setPosition({ x: boundedX, y: boundedY });
    };

    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handlePointerMove(touch.clientX, touch.clientY);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, isMinimized, setPosition]);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Don't render if voice modal is closed
  if (!isVoiceModalOpen) {
    return null;
  }

  const isSpeaking = connectionState === 'speaking' || isFastAnswering;
  const isListening = connectionState === 'listening' && !isFastAnswering;
  const isConnecting = connectionState === 'connecting';
  const isDisconnected = connectionState === 'disconnected';
  const isError = connectionState === 'error';

  // State Labels for Rural Users
  const stateBadge = isError ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
      <AlertCircle size={12} />
      <span>आवाज़ समझ नहीं आई, फिर से बोलें</span>
    </span>
  ) : isSpeaking ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold animate-pulse">
      <Volume2 size={12} className="text-amber-700" />
      <span>बता रहे हैं...</span>
    </span>
  ) : isConnecting ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
      <span>समझ रहे हैं...</span>
    </span>
  ) : isListening ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold">
      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
      <span>सुन रहे हैं...</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-800 text-[11px] font-bold">
      <Mic size={12} />
      <span>बोलिए</span>
    </span>
  );

  const posX = position.x === -1 ? Math.max(16, window.innerWidth - 380) : position.x;
  const posY = position.y === -1 ? Math.max(16, window.innerHeight - 440) : position.y;

  // ─────────────────────────────────────────────────────────────────────────
  // Minimized Compact Pill Floating Widget
  // ─────────────────────────────────────────────────────────────────────────
  if (isMinimized) {
    return (
      <div
        ref={containerRef}
        style={isMobile ? undefined : { left: `${posX}px`, top: `${posY}px` }}
        onMouseDown={isMobile ? undefined : onMouseDownHeader}
        onTouchStart={isMobile ? undefined : onTouchStartHeader}
        className={clsx(
          'fixed z-50 flex items-center gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-full bg-emerald-800 text-white shadow-xl border-2 border-emerald-500/40 select-none hover:bg-emerald-900 transition-colors',
          isMobile ? 'bottom-4 right-4 max-w-[calc(100vw-32px)]' : 'cursor-grab active:cursor-grabbing',
          isDragging && 'opacity-90 scale-105'
        )}
      >
        <button
          onClick={expandAssistant}
          className="flex items-center gap-2 focus:outline-none text-left"
          title="Restore voice assistant"
        >
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
            {isSpeaking ? (
              <Volume2 size={15} className="text-amber-300 animate-bounce" />
            ) : isListening ? (
              <Mic size={15} className="text-white animate-pulse" />
            ) : (
              <Sparkles size={15} className="text-emerald-200" />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-tight leading-tight">सहकार साथी</span>
              <span className="text-xs">{currentCategory.emoji}</span>
            </div>
            <span className="text-[10px] text-emerald-200 font-medium">
              {isSpeaking ? 'बता रहे हैं...' : isListening ? 'सुन रहे हैं...' : currentCategory.titleHi}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1 ml-1 pl-2 border-l border-emerald-700/60">
          <button
            onClick={expandAssistant}
            className="p-1 rounded-full hover:bg-white/15 text-emerald-200 hover:text-white transition-colors"
            title="Expand"
          >
            <ChevronUp size={15} />
          </button>
          <button
            onClick={closeVoiceModal}
            className="p-1 rounded-full hover:bg-rose-500/30 text-rose-200 hover:text-white transition-colors"
            title="Close voice"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Active Floating Assistant Window (Draggable on desktop, neatly docked on mobile)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={isMobile ? undefined : { left: `${posX}px`, top: `${posY}px` }}
      className={clsx(
        'fixed z-50 bg-white shadow-2xl border border-emerald-200 overflow-hidden flex flex-col select-none transition-shadow duration-200',
        isMobile
          ? 'inset-x-2 bottom-2 max-h-[85vh] rounded-2xl'
          : 'w-[340px] sm:w-[380px] max-h-[90vh] rounded-3xl',
        isDragging && 'shadow-emerald-900/30 ring-2 ring-emerald-500/40'
      )}
    >
      {/* Draggable Top Bar */}
      <div
        onMouseDown={onMouseDownHeader}
        onTouchStart={onTouchStartHeader}
        className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-brand-900 text-white px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-emerald-600/30 shrink-0"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center border border-white/20">
            <Sparkles size={15} className="text-emerald-200 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-white">सहकार साथी AI</span>
              <span className="text-xs">{currentCategory.emoji}</span>
            </div>
            <p className="text-[10px] text-emerald-200 font-medium -mt-0.5">{currentCategory.titleHi} सहायता</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={minimizeAssistant}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-emerald-100 hover:text-white transition-colors"
            title="Minimize"
          >
            <Minus size={15} />
          </button>
          <button
            onClick={closeVoiceModal}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-rose-600/80 text-white transition-colors"
            title="Close voice"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* State Badge Row */}
      <div className="bg-neutral-50 border-b border-neutral-100 px-4 py-2 flex items-center justify-between shrink-0">
        {stateBadge}
        <span className="text-[10px] font-bold text-neutral-400">
          ड्रैग करके कहीं भी ले जाएं ✥
        </span>
      </div>

      {/* Error Alert if any */}
      {errorMessage && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 flex items-center justify-between text-xs text-rose-800 shrink-0">
          <span className="line-clamp-1">{errorMessage}</span>
          <button
            onClick={reconnect}
            className="ml-2 px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700"
          >
            फिर से जोड़ें
          </button>
        </div>
      )}

      {/* Scrollable Middle Container */}
      <div className="overflow-y-auto flex-1 flex flex-col">
        {/* Main Body: Voice Visualizer & Spoken Output */}
        <div className="p-3.5 flex flex-col items-center justify-center bg-gradient-to-b from-white to-emerald-50/20 shrink-0">
          <VoiceVisualizer
            state={connectionState}
            userVolume={userVolume}
            aiVolume={aiVolume}
            isMuted={isMicMuted}
          />

          {/* Real-time Spoken Text Snippet */}
          {(currentAssistantText || fastAssistantText || currentUserText || fastUserText) && (
            <div className="w-full mt-2.5 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs text-neutral-800 shadow-xs max-h-24 overflow-y-auto">
              {(currentAssistantText || fastAssistantText) ? (
                <div>
                  <span className="font-bold text-emerald-800">सहकार साथी: </span>
                  <span>{cleanSpokenText(currentAssistantText || fastAssistantText)}</span>
                </div>
              ) : (
                <div>
                  <span className="font-bold text-neutral-600">आप: </span>
                  <span>{currentUserText || fastUserText}</span>
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* 3 MANDATORY QUESTIONS FLOW: Audibly asked by Sahkar Sathi */}
          {/* ───────────────────────────────────────────────────────────── */}
          {interviewStep > 0 ? (
            <div className="w-full mt-3 p-3.5 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-brand-900 text-white shadow-lg border-2 border-amber-400/40 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-200">
              {/* Question Progress Header */}
              <div className="flex items-center justify-between border-b border-white/15 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-400 text-emerald-950 font-black text-xs flex items-center justify-center shadow-xs">
                    {interviewStep}
                  </span>
                  <div>
                    <span className="text-xs font-black text-amber-300 block">
                      {interviewStep === 1 && 'पहला सवाल: अपनी भाषा चुनें'}
                      {interviewStep === 2 && 'दूसरा सवाल: आपका व्यवसाय क्या है?'}
                      {interviewStep === 3 && 'तीसरा सवाल: आप क्या ढूंढ रहे हैं?'}
                    </span>
                    <span className="text-[10px] text-emerald-200 font-medium">
                      {interviewStep === 1 && 'Question 1: Choose your language'}
                      {interviewStep === 2 && 'Question 2: What is your occupation?'}
                      {interviewStep === 3 && 'Question 3: What are you looking for?'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/20">
                  3 में से {interviewStep}
                </span>
              </div>

              {/* Spoken instructions */}
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-100 bg-white/10 px-2.5 py-1.5 rounded-xl border border-white/10">
                <Mic size={13} className="text-amber-300 shrink-0 animate-pulse" />
                <span className="font-medium">
                  {interviewStep === 1 && 'सीधे बोलें या नीचे अपनी भाषा पर क्लिक करें:'}
                  {interviewStep === 2 && 'सीधे बोलें (किसान, व्यापारी, आदि) या नीचे चुनें:'}
                  {interviewStep === 3 && 'सीधे बोलें (ऋण, सब्सिडी, आदि) या नीचे चुनें:'}
                </span>
              </div>

              {/* Step 1: Language Options */}
              {interviewStep === 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {FEATURED_LANGUAGES.map((code) => {
                    const meta = LANG_META[code];
                    return (
                      <button
                        key={code}
                        onClick={() => handleSelectLanguage(code)}
                        className={clsx(
                          'p-2 rounded-xl text-left text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer border',
                          userLang === code
                            ? 'bg-amber-400 text-emerald-950 border-amber-300 shadow-xs font-black'
                            : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                        )}
                      >
                        <span className="text-sm">{meta?.flag || '🇮🇳'}</span>
                        <span className="truncate">{meta?.greeting || code}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step 2: Role / Profession Options */}
              {interviewStep === 2 && (
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {USER_ROLES.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => handleSelectRoleFromInterview(role.id)}
                      className={clsx(
                        'p-2 rounded-xl text-left flex items-center gap-2 transition-all active:scale-95 cursor-pointer border',
                        selectedRole === role.id
                          ? 'bg-amber-400 text-emerald-950 border-amber-300 shadow-xs'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                      )}
                    >
                      <span className="text-xl shrink-0">{role.emoji}</span>
                      <div className="min-w-0">
                        <span className="text-xs font-black block truncate">{role.titleHi}</span>
                        <span className={clsx('text-[10px] block truncate', selectedRole === role.id ? 'text-emerald-950 font-bold' : 'text-emerald-200')}>
                          {role.titleEn || role.title}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 3: Interest / Need Options */}
              {interviewStep === 3 && (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {(ROLE_INTEREST_MAP[selectedRole] || []).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectInterestFromInterview(item)}
                      className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-left flex items-center justify-between gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{item.emoji}</span>
                        <div className="min-w-0">
                          <span className="text-xs font-black text-white block truncate">{item.titleHi}</span>
                          <span className="text-[10px] text-emerald-200 block truncate">{item.benefitHi}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-amber-400 text-emerald-950 shrink-0">
                        चुनें
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Active Personalization Profile Badges */
            <div className="w-full mt-2 flex items-center justify-between gap-1 p-2 rounded-xl bg-neutral-50 border border-neutral-200/80 text-[10px]">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="font-bold px-2 py-0.5 rounded-full bg-white text-emerald-900 border border-emerald-200">
                  🌐 {userLang === 'hi' ? 'हिन्दी' : userLang === 'en' ? 'English' : userLang === 'pa' ? 'ਪੰਜਾਬੀ' : userLang === 'mr' ? 'मराठी' : userLang === 'gu' ? 'ગુજરાતી' : userLang}
                </span>
                <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                  {currentCategory.emoji} {currentCategory.titleHi}
                </span>
                {selectedInterest && (
                  <span className="font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 truncate max-w-[130px]">
                    🎯 {selectedInterest}
                  </span>
                )}
              </div>
              <button
                onClick={handleRestartInterview}
                className="text-[10px] font-black text-emerald-700 hover:text-emerald-900 underline flex items-center gap-0.5 shrink-0 cursor-pointer"
                title="3 सवाल फिर से पूछें"
              >
                3 सवाल फिर से 🔄
              </button>
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* NEW: Personalized Category Services inside Voice Assistant Window */}
        {/* ───────────────────────────────────────────────────────────────── */}
        <div className="bg-neutral-50/90 border-t border-neutral-200/80 flex flex-col">
          {/* Header & Toggle */}
          <div className="px-3.5 py-2 flex items-center justify-between border-b border-neutral-200/60 bg-white">
            <div className="flex items-center gap-1.5 min-w-0">
              <Award size={13} className="text-emerald-700 shrink-0" />
              <span className="text-xs font-black text-neutral-800 truncate">
                आपकी श्रेणी अनुसार सेवाएं:
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                {currentCategory.emoji} {currentCategory.titleHi}
              </span>
            </div>

            <button
              onClick={() => setIsServicesExpanded(!isServicesExpanded)}
              className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 text-[10px] font-bold flex items-center gap-0.5 transition-colors shrink-0"
              title={isServicesExpanded ? 'छुपाएं' : 'दिखाएं'}
            >
              <span>{isServicesExpanded ? 'छुपाएं' : 'देखें'}</span>
              {isServicesExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {isServicesExpanded && (
            <div className="p-2.5 flex flex-col gap-2 bg-gradient-to-b from-neutral-50 to-emerald-50/30">
              {/* Category Switcher Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {PERSONALIZED_CATEGORIES.map((cat) => {
                  const isActive = cat.id === selectedRole;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectRole(cat.id)}
                      className={clsx(
                        'px-2.5 py-1 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all border flex items-center gap-1 cursor-pointer shrink-0',
                        isActive
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs ring-1 ring-emerald-500/40'
                          : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                      )}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.titleHi}</span>
                    </button>
                  );
                })}
              </div>

              {/* List of top services for active category */}
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-0.5">
                {currentCategory.services.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-2 rounded-xl bg-white border border-neutral-200/80 hover:border-emerald-300 shadow-2xs flex items-center justify-between gap-2 transition-all hover:bg-emerald-50/20"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-lg shrink-0">{srv.emoji}</span>
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-neutral-900 truncate block">
                          {srv.titleHi}
                        </span>
                        <p className="text-[10px] text-emerald-700 font-bold truncate">
                          {srv.benefitHi}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleServiceVoiceAsk(srv)}
                      className="py-1 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black flex items-center gap-1 shrink-0 shadow-2xs active:scale-95 transition-all cursor-pointer"
                      title="इस योजना के बारे में पूछें"
                    >
                      <Mic size={11} />
                      <span>पूछें</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Controls & Push-to-Talk Fallback */}
      <div className="bg-white border-t border-neutral-100 p-3.5 flex flex-col gap-2.5">
        {/* Push-to-Talk Button: “बटन दबाकर बोलें” */}
        <button
          onMouseDown={startPushToTalk}
          onMouseUp={stopPushToTalk}
          onMouseLeave={stopPushToTalk}
          onTouchStart={startPushToTalk}
          onTouchEnd={stopPushToTalk}
          className={clsx(
            'w-full py-2.5 px-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 select-none',
            isPushToTalkActive
              ? 'bg-rose-600 text-white ring-4 ring-rose-200'
              : 'bg-gradient-to-r from-emerald-600 to-emerald-800 text-white hover:from-emerald-700 hover:to-emerald-900 shadow-emerald-700/20'
          )}
          title="प्रेस करके रखें और बोलें"
        >
          <Mic size={16} className={isPushToTalkActive ? 'animate-bounce' : ''} />
          <span>{isPushToTalkActive ? '🔴 बोलते रहें (छोड़ने पर प्रोसेस होगा)...' : '🎙️ बटन दबाकर बोलें (Push-to-Talk)'}</span>
        </button>

        {/* Secondary Buttons Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Mute Mic */}
          <button
            onClick={toggleMicMute}
            className={clsx(
              'flex-1 py-1.5 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-colors',
              isMicMuted
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
            )}
          >
            {isMicMuted ? <MicOff size={13} /> : <Mic size={13} />}
            <span>{isMicMuted ? 'माइक बंद' : 'माइक म्यूट'}</span>
          </button>

          {/* Interrupt AI if speaking */}
          {isSpeaking && (
            <button
              onClick={interruptAI}
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
            >
              <Hand size={13} />
              <span>रोकें (Interrupt)</span>
            </button>
          )}

          {/* Reconnect if disconnected */}
          {(isDisconnected || isError) && (
            <button
              onClick={reconnect}
              className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
            >
              <RotateCcw size={13} />
              <span>पुनः जोड़ें</span>
            </button>
          )}

          {/* End Call */}
          <button
            onClick={closeVoiceModal}
            className="py-1.5 px-3 rounded-xl bg-neutral-100 hover:bg-rose-50 text-neutral-600 hover:text-rose-700 border border-neutral-200 text-[11px] font-bold transition-colors"
            title="बातचीत समाप्त करें"
          >
            बंद करें
          </button>
        </div>
      </div>
    </div>
  );
}
