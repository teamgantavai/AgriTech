// ============================================================
// VoiceAssistantApp — Gram Sathi: Chat + Voice + Crop Calendar
// Full 14-Language Support & Mobile-First Responsive Design
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { VoiceState } from '../types/voice';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { VoicePanel } from './VoicePanel/VoicePanel';
import { DebugPanel } from './DebugPanel/DebugPanel';
import { AnimatedGlobe } from './AudioVisualizer/AnimatedGlobe';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, setFarmerContext, setActiveServiceContext } from '../services/sessionManager';
import { VOICE_TOOL_EVENT, type VoiceToolEvent, updateActiveFarmerContext } from '../services/toolManager';
import { prefetchToken } from '../services/tokenService';
import { CropCalendar } from './crop-calendar/CropCalendar';
import { ChatAssistant } from './ChatAssistant/ChatAssistant';
import { AgentProgressBar } from '../agent/AgentProgressBar';
import { AgentConfirmationModal } from '../agent/AgentConfirmationModal';
import { ExternalWebsiteBoundary } from '../agent/ExternalWebsiteBoundary';
import { AgentStateMachine, AgentState, type ConfirmationRequest, type TaskProgress, type SourceInfo } from '../agent/agentStateMachine';
import { updateUIState } from '../agent/agentBridge';

// Simple example prompts for the voice landing — localized

const LOCALIZED_SUGGESTIONS: Record<string, string[]> = {
  hi: [
    'पीएम-किसान 16वीं किस्त की स्थिति कैसे चेक करें?',
    'सोलर पंप (PM-KUSUM) पर 60% सब्सिडी कैसे मिलेगी?',
    'किसान क्रेडिट कार्ड (KCC) की ब्याज दर और आवेदन प्रक्रिया?',
    'फसल नुकसान होने पर बीमा क्लेम 72 घंटे में कैसे दर्ज करें?',
  ],
  pa: [
    'ਪੀਐਮ-ਕਿਸਾਨ 16ਵੀਂ ਕਿਸ਼ਤ ਬਾਰੇ ਜਾਣਕਾਰੀ ਦਿਓ',
    "ਸੋਲਰ ਖੇਤੀ ਪੰਪ (ਕੁਸੁਮ) 'ਤੇ ਕਿੰਨੀ ਸਬਸਿਡੀ ਮਿਲਦੀ ਹੈ?",
    'ਕਿਸਾਨ ਕ੍ਰੈਡਿਟ ਕਾਰਡ (KCC) ਲਈ ਕਿਵੇਂ ਅਪਲਾਈ ਕਰੀਏ?',
    'ਫਸਲ ਦੇ ਨੁਕਸਾਨ ਦਾ ਬੀਮਾ ਕਲੇਮ ਕਿਵੇਂ ਦਰਜ ਕਰਨਾ ਹੈ?',
  ],
  mr: [
    'पीएम-किसान योजनेचा पुढील हप्ता कधी जमा होणार?',
    'कुसुम सोलर कृषी पंपासाठी अनुदान कसे मिळवायचे?',
    'किसान क्रेडिट कार्ड (KCC) साठी लागणारी कागदपत्रे कोणती?',
    'पिक नुकसान भरपाईसाठी ७२ तासांत तक्रार कशी करावी?',
  ],
  gu: [
    'પીએમ કિસાન યોજનાનો આગામી હપ્તો કેવી રીતે ચેક કરવો?',
    'સોલાર પંપ સબસિડી (કુસુમ) માટે કેવી રીતે અરજી કરવી?',
    'કિસાન ક્રેડિટ કાર્ડ (KCC) ના ફાયદા અને વ્યાજ દર?',
    'પાક નુકસાની માટે પીએમએફબીવાય ક્લેમ પ્રક્રિયા શું છે?',
  ],
  bn: [
    'পিএম-কিষাণ সম্মান নিধির কিস্তি কীভাবে চেক করব?',
    'সৌর সেচ পাম্পে (কুসুম) কী সরকারি ভর্তুকি পাওয়া যায়?',
    'কিসান ক্রেডিট কার্ডের (KCC) সুদের হার ও আবেদন পদ্ধতি?',
    'ফসল নষ্ট হলে ৭২ ঘণ্টার মধ্যে কীভাবে বিমা ক্লেম করবেন?',
  ],
  te: [
    'పీఎం-కిసాన్ 16వ విడత డబ్బులు ఎప్పుడు వస్తాయి?',
    'సోలార్ పంపుల (కుసుమ్) సబ్సిడీ కోసం ఎలా దరఖాస్తు చేసుకోవాలి?',
    'కిసాన్ క్రెడిట్ కార్డు (KCC) వడ్డీ రేట్లు మరియు అర్హతలు?',
    'పంట నష్ట పరిహారం కోసం 72 గంటల్లో క్లెయిమ్ ఎలా చేయాలి?',
  ],
  ta: [
    'பிஎம்-கிசான் 16வது தவணை நிலையை எவ்வாறு சரிபார்ப்பது?',
    'சூரிய சக்தி பம்பு செட்டுகளுக்கு (குசும்) மானியம் பெறுவது எப்படி?',
    'கிசான் கிரெடிட் கார்டு (KCC) விண்ணப்பிக்கும் முறை?',
    'பயிர் சேத இழப்பீடு கோர 72 மணி நேரத்திற்குள் என்ன செய்ய வேண்டும்?',
  ],
  kn: [
    'ಪಿಎಂ-ಕಿಸಾನ್ ಮುಂದಿನ ಕಂತಿನ ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸುವುದು ಹೇಗೆ?',
    'ಸೌರ ಪಂಪ್‌ಗಳಿಗೆ (ಕುಸುಮ್) ಸಬ್ಸಿಡಿ ಪಡೆಯುವುದು ಹೇಗೆ?',
    'ಕಿಸಾನ್ ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್ (KCC) ಬಡ್ಡಿದರ ಮತ್ತು ಅರ್ಜಿ ವಿಧಾನ?',
    'ಬೆಳೆ ಹಾನಿಯಾದಾಗ 72 ಗಂಟೆಗಳಲ್ಲಿ ವಿಮೆ ಕ್ಲೈಮ್ ಮಾಡುವುದು ಹೇಗೆ?',
  ],
  en: [
    'Tell me about PM-Kisan 16th installment and eKYC',
    'What subsidy is available for solar pumps under PM-KUSUM?',
    'How to apply for Kisan Credit Card (KCC) with low interest?',
    'How to report crop loss claim within 72 hours on PMFBY?',
  ],
};

interface VoiceAssistantAppProps {
  defaultTab?: 'calendar' | 'schemes' | 'chat';
}

export function VoiceAssistantApp({ defaultTab = 'chat' }: VoiceAssistantAppProps) {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'calendar' | 'schemes' | 'chat'>(() => {
    if (location.pathname === '/voice' || searchParams.get('start') === 'true') return 'schemes';
    if (location.pathname === '/calendar') return 'calendar';
    if (location.pathname === '/chat') return 'chat';
    return defaultTab;
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);
  const [micRms, setMicRms] = useState(0);
  const [toolNotification, setToolNotification] = useState<string | null>(null);
  const toolNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartHandledRef = useRef(false);

  // ── Agent-control state ──────────────────────────────────────
  const [agentState, setAgentState] = useState<AgentState>(AgentState.IDLE);
  const [agentConfirmation, setAgentConfirmation] = useState<ConfirmationRequest | null>(null);
  const [agentTask, setAgentTask] = useState<TaskProgress | null>(null);
  const [externalNav, setExternalNav] = useState<{ url: string; siteName: string } | null>(null);
  const [agentSources, setAgentSources] = useState<SourceInfo[]>([]);

  // Synchronize tab state with router URL for browser back/forward
  useEffect(() => {
    if (location.pathname === '/voice') setActiveTab('schemes');
    else if (location.pathname === '/calendar') setActiveTab('calendar');
    else if (location.pathname === '/chat' || (location.pathname === '/' && !searchParams.get('start'))) setActiveTab('chat');
  }, [location.pathname, searchParams]);

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
      console.log('[VoiceAssistantApp] Tool call:', tool, args);
    },
  });

  // Auto-start voice if start=true query param or serviceContext passed
  useEffect(() => {
    const isVoiceStart = searchParams.get('start') === 'true' || location.pathname === '/voice';
    const state = location.state as { serviceContext?: any; startVoice?: boolean } | null;

    if (state?.serviceContext) {
      setActiveServiceContext(state.serviceContext);
    }

    if ((isVoiceStart || state?.startVoice) && !autoStartHandledRef.current) {
      autoStartHandledRef.current = true;
      setActiveTab('schemes');
      setPanelOpen(true);
      connect();
    }
  }, [searchParams, location.pathname, location.state, connect]);

  // Handle tool events from toolManager
  useEffect(() => {
    const handler = (e: Event) => {
      const { tool, args } = (e as CustomEvent<VoiceToolEvent>).detail;
      let msg = '';
      switch (tool) {
        case 'navigateToScheme':
          msg = `Opening scheme: ${args.schemeId}`;
          break;
        case 'searchScheme':
          msg = `Searching schemes: "${args.query}"`;
          break;
        case 'searchInternet':
          msg = `🌐 Searching web: "${args.query}"`;
          break;
        case 'openPage':
          msg = `Opening page: ${args.page}`;
          if (args.page === 'calendar') setActiveTab('calendar');
          else if (args.page === 'schemes' || args.page === 'home') setActiveTab('schemes');
          else if (args.page === 'chat') setActiveTab('chat');
          break;
        case 'cropCalendar':
          msg = `Checking crop calendar for ${args.state || ''}`;
          setActiveTab('calendar');
          break;
        case 'setCropCalendarState':
          msg = `Updated state to ${args.state || ''}`;
          setActiveTab('calendar');
          break;
        // ── Phase 1 agent-control tool notifications ──────────
        case 'navigateToRoute':
          msg = `📍 Opening: ${args.route}`;
          AgentStateMachine.forceTransition(AgentState.EXECUTING);
          break;
        case 'searchGovernment':
          msg = `🏛️ Searching government sources: "${args.query}"`;
          AgentStateMachine.forceTransition(AgentState.EXECUTING);
          break;
        case 'getAgricultureNews':
          msg = `📰 Getting agriculture news${args.state ? ` for ${args.state}` : ''}`;
          AgentStateMachine.forceTransition(AgentState.EXECUTING);
          break;
        case 'fillField':
          msg = `✏️ Filling: ${args.fieldLabel || args.fieldId}`;
          break;
        case 'requestConfirmation':
          msg = `⚠️ Confirmation needed`;
          break;
        case 'openExternalService':
          msg = `🔗 Opening: ${args.siteName}`;
          break;
        case 'openFormCopilot':
          msg = `⚡ Opening Form Copilot: ${String(args.portalId || 'nsp').toUpperCase()}`;
          AgentStateMachine.forceTransition(AgentState.EXECUTING);
          break;
        default:
          msg = `Action: ${tool}`;
      }
      setToolNotification(msg);
      if (toolNotifTimerRef.current) clearTimeout(toolNotifTimerRef.current);
      toolNotifTimerRef.current = setTimeout(() => setToolNotification(null), 3000);
    };
    window.addEventListener(VOICE_TOOL_EVENT, handler);
    return () => window.removeEventListener(VOICE_TOOL_EVENT, handler);
  }, []);

  // Pre-warm token in background on page load
  useEffect(() => {
    prefetchToken();
  }, []);

  // ── Agent state machine subscription ────────────────────────
  useEffect(() => {
    const unsubscribe = AgentStateMachine.subscribe((event) => {
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
        default:
          break;
      }
    });
    // Sync route to UIState
    updateUIState({ route: window.location.pathname, isLoading: false, hasError: false });
    return unsubscribe;
  }, []);

  // Reset completed/failed agent state after 3 seconds
  useEffect(() => {
    if (agentState === AgentState.COMPLETED || agentState === AgentState.FAILED) {
      const t = setTimeout(() => {
        AgentStateMachine.forceTransition(AgentState.IDLE);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [agentState]);

  const currentLangCode = profile.languageCode || 'hi';
  const currentPrompts = LOCALIZED_SUGGESTIONS[currentLangCode] || LOCALIZED_SUGGESTIONS['en'];

  const handleStart = useCallback(() => {
    setPanelOpen(true);
    connect();
  }, [connect]);

  const handleOpenVoiceWithCrop = useCallback(
    (cropName?: string, stateName?: string, monthNum?: number) => {
      const ctxUpdates: any = {
        currentCrop: cropName || null,
      };
      if (stateName) ctxUpdates.selectedState = stateName;
      if (monthNum) ctxUpdates.selectedMonth = monthNum;

      updateActiveFarmerContext(ctxUpdates);
      setFarmerContext(ctxUpdates);

      if (!profile.selectedLanguage && !profile.language) {
        const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];
        setLanguage(langObj);
      }

      handleStart();
    },
    [handleStart, profile.selectedLanguage, profile.language, currentLangCode, setLanguage]
  );

  const handleStop = useCallback(() => {
    disconnect();
    setPanelOpen(false);
    setAnalyserData(null);
    setMicRms(0);
  }, [disconnect]);

  const handleRetry = useCallback(async () => {
    await connect();
  }, [connect]);

  // Switch to voice from chat
  const handleSwitchToVoice = useCallback(() => {
    setActiveTab('schemes');
    handleStart();
  }, [handleStart]);

  return (
    <div className="h-screen w-full bg-[#fafaf9] text-slate-900 flex flex-col overflow-hidden relative">
      {/* ── ONE Clean Top Navigation ── */}
      {!panelOpen && (
        <header className="w-full border-b border-slate-200 bg-white z-30 px-4 sm:px-6 py-2.5 flex items-center justify-between flex-shrink-0">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center text-sm shadow-xs">
              🏛️
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 leading-tight">Gram Sathi</div>
              <div className="text-[11px] text-slate-500 hidden sm:block">
                {currentLangCode === 'hi' ? 'सरकारी सेवाएं सहायक' : 'Government Services AI'}
              </div>
            </div>
          </div>

          {/* Tab switcher: Calendar | Chat | Voice */}
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('calendar');
                if (location.pathname !== '/calendar') window.history.replaceState({}, '', '/calendar');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'calendar' ? 'bg-white text-green-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🌾</span>
              <span className="hidden sm:inline">{currentLangCode === 'hi' ? 'फसल कैलेंडर' : 'Calendar'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('chat');
                if (location.pathname !== '/chat') window.history.replaceState({}, '', '/chat');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'chat' ? 'bg-white text-green-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>💬</span>
              <span className="hidden sm:inline">{currentLangCode === 'hi' ? 'AI चैट' : 'Chat'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('schemes');
                if (location.pathname !== '/voice') window.history.replaceState({}, '', '/voice');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'schemes' ? 'bg-white text-green-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🎙️</span>
              <span className="hidden sm:inline">Voice</span>
            </button>
          </nav>
        </header>
      )}

      {/* ── Active Voice Talking Screen ── */}
      {panelOpen && (
        <main className="w-full flex-1 flex flex-col items-center justify-center animate-fade-up">
          <VoicePanel
            voiceState={voiceState}
            onboardingState={onboardingState}
            profile={profile}
            turns={turns}
            error={error}
            metrics={metrics}
            analyserData={analyserData}
            micRms={micRms}
            onStop={handleStop}
            onRetry={voiceState === VoiceState.ERROR ? handleRetry : undefined}
            onLanguageChange={setLanguage}
          />
        </main>
      )}

      {/* ── 🌾 Farmer Crop Calendar View ── */}
      <main
        className={`w-full flex-1 min-h-0 overflow-y-auto py-4 sm:py-6 ${
          panelOpen || activeTab !== 'calendar' ? 'hidden' : ''
        }`}
      >
        <CropCalendar
          onOpenVoiceAssistant={handleOpenVoiceWithCrop}
          isHindi={currentLangCode === 'hi'}
          languageCode={currentLangCode}
        />
      </main>

      {/* ── 💬 Gram Sathi AI Chat (Preserved across tab switches) ── */}
      <main
        className={`w-full flex-1 min-h-0 overflow-hidden flex flex-col ${
          panelOpen || activeTab !== 'chat' ? 'hidden' : ''
        }`}
      >
        <ChatAssistant onSwitchToVoice={handleSwitchToVoice} />
      </main>

      {/* ── 🎙️ Voice Landing — Simple & Friendly ── */}
      {!panelOpen && activeTab === 'schemes' && (
        <main className="w-full flex-1 min-h-0 overflow-y-auto">
          <div className="w-full max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center text-center gap-8 my-auto">

          {/* Heading */}
          <div>
            <div className="text-5xl mb-4">🎙️</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2 leading-tight">
              Talk to Gram Sathi
            </h1>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
              Tap below and ask about government schemes, loans, certificates or any service — in your language.
            </p>
          </div>

          {/* Globe + Tap CTA */}
          <div className="flex flex-col items-center gap-4">
            <button
              id="start-voice-analysis-btn"
              onClick={handleStart}
              className="cursor-pointer group flex flex-col items-center gap-3 focus:outline-none"
              aria-label="Tap to talk"
            >
              <AnimatedGlobe
                isActive={false}
                isSpeaking={false}
                size={200}
                className="group-hover:scale-105 transition-transform duration-300"
              />
              <span className="text-sm font-semibold text-slate-500 group-hover:text-green-700 transition-colors">
                Tap to start talking
              </span>
            </button>
          </div>

          {/* Or use Chat */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-slate-400">Prefer typing? Use the chat instead.</span>
            <button
              onClick={() => setActiveTab('chat')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-green-600 text-green-700 font-semibold text-sm hover:bg-green-50 transition-all cursor-pointer active:scale-95"
            >
              <span>💬</span>
              <span>Open AI Chat</span>
            </button>
          </div>

          {/* Language selector */}
          <div className="w-full">
            <p className="text-xs text-slate-400 mb-2">
              🌐 {profile.language ? `Speaking in: ${profile.language}` : 'Language auto-detected from your speech'}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              <button
                onClick={() => setLanguage(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                  !profile.language ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'
                }`}
              >
                Auto
              </button>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = profile.language === lang.name || profile.languageCode === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600 border-slate-200 hover:border-green-300'
                    }`}
                  >
                    {lang.nativeName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sample questions */}
          <div className="w-full">
            <p className="text-xs font-semibold text-slate-400 mb-3">Try saying:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {currentPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={handleStart}
                  className="p-3 rounded-xl bg-white border border-slate-200 hover:border-green-300 hover:bg-green-50 text-slate-700 text-xs font-medium transition-all text-left flex items-center justify-between cursor-pointer"
                >
                  <span className="pr-2">{prompt}</span>
                  <span className="text-slate-400">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    )}

      {/* ── Tool notification toast ── */}
      {toolNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-neutral-900 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-neutral-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {toolNotification}
          </div>
        </div>
      )}

      {/* ── Debug Panel (Ctrl+Shift+D) ── */}
      <DebugPanel metrics={metrics} voiceState={voiceState} />

      {/* ── Footer ── */}
      {!panelOpen && activeTab !== 'chat' && (
        <footer className="w-full py-3 text-center border-t border-slate-100 bg-white">
          <p className="text-slate-400 text-xs">
            🔒 Gram Sathi never asks for OTP, Aadhaar number or passwords.
          </p>
        </footer>
      )}

      {/* ══ AGENT-CONTROL LAYER ══════════════════════════════════ */}

      {/* Agent progress bar — fixed to top when agent is active */}
      <AgentProgressBar
        task={agentTask}
        agentState={agentState}
        langCode={currentLangCode}
      />

      {/* L2/L3 Confirmation modal — blocks until user responds */}
      <AgentConfirmationModal
        confirmation={agentConfirmation}
        langCode={currentLangCode}
        onResponse={(response) => {
          setAgentConfirmation(null);
          if (response === 'denied') {
            AgentStateMachine.forceTransition(AgentState.IDLE);
          }
        }}
      />

      {/* External website boundary warning */}
      {externalNav && (
        <ExternalWebsiteBoundary
          url={externalNav.url}
          siteName={externalNav.siteName}
          langCode={currentLangCode}
          onProceed={() => {
            window.open(externalNav.url, '_blank', 'noopener,noreferrer');
            setExternalNav(null);
          }}
          onCancel={() => setExternalNav(null)}
        />
      )}
    </div>
  );
}
