// ============================================================
// VoiceAssistantApp — Clean White Voice Assistant (Zero Gradients)
// Full 14-Language Support & Mobile-First Responsive Design
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { VoiceState } from '../types/voice';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { VoicePanel } from './VoicePanel/VoicePanel';
import { DebugPanel } from './DebugPanel/DebugPanel';
import { AnimatedGlobe } from './AudioVisualizer/AnimatedGlobe';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, setFarmerContext } from '../services/sessionManager';
import { VOICE_TOOL_EVENT, type VoiceToolEvent, updateActiveFarmerContext } from '../services/toolManager';
import { prefetchToken } from '../services/tokenService';
import { CropCalendar } from './crop-calendar/CropCalendar';

const CATEGORY_TAGS = [
  { id: 'pmkisan', label: '🌾 PM-Kisan Samman', query: 'PM-Kisan installment and eKYC' },
  { id: 'kusum', label: '⚡ Solar Pumps (KUSUM)', query: 'PM-KUSUM solar pump subsidy' },
  { id: 'kcc', label: '💳 Kisan Credit Card', query: 'KCC loan limits and application' },
  { id: 'pmfby', label: '🛡️ Crop Insurance (PMFBY)', query: 'PMFBY crop loss claim 72 hours' },
  { id: 'subsidy', label: '🚜 Tractor Subsidy (SMAM)', query: 'Tractor and farm machinery subsidy' },
  { id: 'pacs', label: '🏢 PACS & Cooperatives', query: 'PACS cooperative membership and benefits' },
];

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

export function VoiceAssistantApp() {
  const [activeTab, setActiveTab] = useState<'calendar' | 'schemes'>('calendar');
  const [panelOpen, setPanelOpen] = useState(false);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);
  const [micRms, setMicRms] = useState(0);
  const [toolNotification, setToolNotification] = useState<string | null>(null);
  const toolNotifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          msg = `Searching: "${args.query}"`;
          break;
        case 'openPage':
          msg = `Opening page: ${args.page}`;
          if (args.page === 'calendar') setActiveTab('calendar');
          else if (args.page === 'schemes' || args.page === 'home') setActiveTab('schemes');
          break;
        case 'cropCalendar':
          msg = `Checking crop calendar for ${args.state || ''}`;
          setActiveTab('calendar');
          break;
        case 'setCropCalendarState':
          msg = `Updated state to ${args.state || ''}`;
          setActiveTab('calendar');
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

  // Determine current active language code
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

      // If user hasn't explicitly selected a language yet, inherit active calendar language (e.g. Hindi)
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

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex flex-col items-center justify-between relative selection:bg-emerald-100">
      {/* ── Top Header Navigation Bar ── */}
      {!panelOpen && (
        <header className="w-full border-b border-neutral-200 bg-white/95 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
              🌾
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
                Sahkar Sathi · सहकार साथी
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold">
                {currentLangCode === 'hi'
                  ? 'भारत सरकार UPAg फसल कैलेंडर एवं कृषि AI'
                  : 'Govt of India UPAg Crop Calendar & Agri-AI'}
              </span>
            </div>
          </div>

          {/* Feature Switcher Tabs */}
          <nav className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'calendar'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>🌾</span>
              <span>{currentLangCode === 'hi' ? 'फसल कैलेंडर' : 'Crop Calendar'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schemes')}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'schemes'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>🏛️</span>
              <span>{currentLangCode === 'hi' ? 'सरकारी योजनाएं' : 'Schemes & Voice'}</span>
            </button>
          </nav>
        </header>
      )}

      {/* ── Active Voice Talking Screen ── */}
      {panelOpen ? (
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
      ) : activeTab === 'calendar' ? (
        /* ── 🌾 Farmer Crop Calendar View ── */
        <main className="w-full flex-1 py-4 sm:py-6">
          <CropCalendar
            onOpenVoiceAssistant={handleOpenVoiceWithCrop}
            isHindi={currentLangCode === 'hi'}
            languageCode={currentLangCode}
          />
        </main>
      ) : (
        /* ── Minimalist White Landing Page (Zero Gradients, High-Def Typography) ── */
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col items-center text-center gap-6 sm:gap-7 animate-fade-up my-auto">
          {/* Top Brand Tag */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 border border-neutral-200">
            <span className="text-base">🌾</span>
            <span className="text-xs font-semibold text-neutral-800 tracking-wide">
              Sahkar Sathi · सहकार साथी
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Heading */}
          <div className="space-y-2.5 max-w-xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
              AI Voice Companion for Agriculture
            </h1>
            <p className="text-neutral-500 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              Real-time spoken answers for government farming schemes, subsidies, crop insurance, and cooperatives in 14 Indian languages.
            </p>
          </div>

          {/* ── 14-Language Selector Ribbon ── */}
          <div className="w-full">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-xs font-bold text-neutral-500 tracking-wide flex items-center gap-1.5">
                <span>🌐</span> SELECT YOUR LANGUAGE:
              </span>
              <span className="text-[11px] text-neutral-400 font-medium">
                {profile.language ? `Selected: ${profile.language}` : 'Auto-Detect Active'}
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5 p-2 bg-neutral-50 rounded-2xl border border-neutral-200 max-h-32 sm:max-h-none overflow-y-auto">
              {/* Auto-detect button */}
              <button
                onClick={() => setLanguage(null)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  !profile.language
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
                }`}
              >
                ✨ Auto-Detect
              </button>

              {/* 14 supported language pills */}
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected =
                  profile.language === lang.name || profile.languageCode === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-neutral-900 text-white font-bold shadow-sm'
                        : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200 font-medium'
                    }`}
                    title={`${lang.name} (${lang.nativeName})`}
                  >
                    <span>{lang.nativeName}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-neutral-300' : 'text-neutral-400'}`}>
                      {lang.code.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Animated Globe Preview */}
          <button
            onClick={handleStart}
            className="cursor-pointer group relative flex flex-col items-center justify-center p-2 rounded-full focus:outline-none"
            aria-label="Tap to talk"
          >
            <AnimatedGlobe
              isActive={false}
              isSpeaking={false}
              size={210}
              className="group-hover:scale-105 transition-transform duration-300"
            />
            <span className="mt-2 text-xs font-semibold text-neutral-400 group-hover:text-neutral-700 transition-colors duration-150">
              Tap globe to start talking
            </span>
          </button>

          {/* Scheme Category Badges */}
          <div className="flex flex-wrap justify-center gap-1.5 max-w-lg">
            {CATEGORY_TAGS.map((cat) => (
              <button
                key={cat.id}
                onClick={handleStart}
                className="voice-pill hover:border-neutral-400 active:scale-95 cursor-pointer text-xs"
                title={`Ask about ${cat.label}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Primary CTA Button */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              id="start-voice-analysis-btn"
              onClick={handleStart}
              className="flex items-center gap-3 px-8 py-3.5 rounded-full bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all duration-150 cursor-pointer"
            >
              <span className="w-3 h-3 rounded-full bg-rose-400 animate-pulse" />
              <span>Start Voice Analysis</span>
            </button>
            <p className="text-neutral-400 text-xs">
              Direct real-time speech via Google Gemini Live Multimodal Audio
            </p>
          </div>

          {/* Localized Prompt Suggestions */}
          <div className="w-full pt-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-bold text-neutral-400 tracking-wide">
                TOP QUESTIONS TO ASK:
              </p>
              <span className="text-[11px] text-neutral-400">
                1-tap to start
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {currentPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={handleStart}
                  className="p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200 text-neutral-800 text-xs font-medium transition-all text-left flex items-center justify-between cursor-pointer"
                >
                  <span className="pr-2">{prompt}</span>
                  <span className="text-neutral-400 text-xs font-bold">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
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

      {/* ── Minimalist White Footer ── */}
      {!panelOpen && (
        <footer className="w-full py-4 text-center border-t border-neutral-100 bg-white">
          <p className="text-neutral-400 text-xs tracking-tight">
            हिन्दी · ਪੰਜਾਬੀ · English · मराठी · বাংলা · ગુજરાતી · తెలుగు · தமிழ் · ಕನ್ನಡ · മലയാളം · ଓଡ଼ିଆ · অসমীয়া · اردو · Hinglish
          </p>
        </footer>
      )}
    </div>
  );
}
