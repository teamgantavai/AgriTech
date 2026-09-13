import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  MessageSquare,
  Sprout,
  Sparkles,
  Volume2,
  ChevronRight,
  HelpCircle,
  Award,
} from 'lucide-react';
import { useVoiceModal } from '../context/VoiceModalContext';
import { stopSpeaking } from '../services/textToSpeech';
import {
  PERSONALIZED_CATEGORIES,
  PersonalizedCategory,
  PersonalizedService,
  UserRole,
} from '../types';
import { clsx } from 'clsx';

export function LandingPage() {
  const navigate = useNavigate();

  const {
    isVoiceModalOpen,
    openVoiceModal,
    expandAssistant,
    isAssistantActive,
    isLiveConnected,
    connectionState,
    sendUserPrompt,
    interruptAI,
  } = useVoiceModal();

  // Active Category state synced with localStorage
  const [activeCategoryId, setActiveCategoryId] = useState<UserRole>(() => {
    try {
      const stored = localStorage.getItem('sahkar_user_role') as UserRole;
      if (stored && PERSONALIZED_CATEGORIES.some((c) => c.id === stored)) {
        return stored;
      }
    } catch { }
    return 'farmer';
  });

  // Keep in sync with external role updates (from voice assistant or onboarding)
  useEffect(() => {
    const handleRoleUpdate = (e: any) => {
      if (e.detail?.role && PERSONALIZED_CATEGORIES.some((c) => c.id === e.detail.role)) {
        setActiveCategoryId(e.detail.role);
      }
    };
    window.addEventListener('user-role-updated', handleRoleUpdate);
    return () => window.removeEventListener('user-role-updated', handleRoleUpdate);
  }, []);

  const handleCategorySelect = (role: UserRole) => {
    setActiveCategoryId(role);
    try {
      localStorage.setItem('sahkar_user_role', role);
      window.dispatchEvent(new CustomEvent('user-role-updated', { detail: { role } }));
    } catch { }
  };

  const activeCategory: PersonalizedCategory =
    PERSONALIZED_CATEGORIES.find((c) => c.id === activeCategoryId) ||
    PERSONALIZED_CATEGORIES[0];

  const isConnecting = connectionState === 'connecting';

  // Big Voice Button handler on landing screen: opens voice assistant
  const handleVoiceButtonClick = () => {
    openVoiceModal();
  };

  // Clicking any personalized service card navigates and asks the assistant
  const handleServiceClick = (schemeId: string, prompt: string) => {
    stopSpeaking();
    interruptAI();
    sessionStorage.setItem('sahkar_skip_welcome', 'true');
    if (!isAssistantActive) {
      openVoiceModal();
    }
    navigate(`/schemes/${schemeId}`);
    sendUserPrompt(prompt);
  };

  // Quick speech prompt click
  const handlePromptClick = (prompt: string) => {
    stopSpeaking();
    interruptAI();
    sessionStorage.setItem('sahkar_skip_welcome', 'true');
    if (!isAssistantActive) {
      openVoiceModal();
    }
    sendUserPrompt(prompt);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/40 via-white to-amber-50/30 text-neutral-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Friendly Ambient Glows */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-emerald-200/30 via-teal-200/20 to-amber-200/20 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Clean Minimal Top Bar */}
      <header className="px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-800 text-white flex items-center justify-center shadow-md shadow-emerald-800/15">
            <Sprout size={22} className="text-emerald-200" />
          </div>
          <div>
            <span className="font-black text-lg sm:text-xl text-neutral-900 tracking-tight">
              सहकार साथी
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate('/chat')}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-white border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50 text-neutral-700 hover:text-emerald-800 shadow-xs transition-all cursor-pointer"
        >
          <MessageSquare size={14} className="text-emerald-700" />
          <span>लिखकर पूछें</span>
        </button>
      </header>

      {/* Main Center Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-3 sm:py-4 max-w-4xl mx-auto w-full text-center">
        {/* Dynamic Status Pill */}
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white border border-emerald-200 shadow-xs text-[11px] sm:text-xs font-extrabold text-emerald-900 mb-2 sm:mb-3 animate-fade-in max-w-full">
          <Sparkles size={13} className="text-emerald-600 shrink-0" />
          <span className="truncate">किसान, दुकानदार व कारीगरों हेतु सीधा वॉइस सहायक</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-neutral-900 tracking-tight leading-tight px-1">
          बोलिए, हम सुन रहे हैं! 🎙️
        </h1>

        <p className="text-xs sm:text-sm md:text-base text-neutral-600 mt-1.5 sm:mt-2 font-medium max-w-xl mx-auto px-2">
          माइक दबाएं और सीधे बोलें — सारी जानकारी आसान भाषा में पाएं!
        </p>

        {/* Center Voice Button - Active when modal is closed */}
        <div className="relative my-4 sm:my-6 flex flex-col items-center justify-center">
          {!isVoiceModalOpen ? (
            /* Huge Inviting Voice Button (Image 1) - Reactivates instantly when window is closed */
            <div className="relative flex items-center justify-center">
              <div className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-emerald-500/10 animate-ping pointer-events-none" />
              <div className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-emerald-500/15 animate-pulse pointer-events-none" />

              <button
                onClick={handleVoiceButtonClick}
                id="voice-assistant-main-btn"
                className={clsx(
                  'relative z-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all duration-300',
                  'bg-gradient-to-tr from-emerald-600 via-emerald-700 to-emerald-900 hover:from-emerald-700 hover:to-emerald-950',
                  'hover:scale-105 active:scale-95 border-4 border-white shadow-emerald-800/30 cursor-pointer'
                )}
                aria-label="Start Voice Conversation"
              >
                <Mic size={32} className="animate-bounce [animation-duration:2.5s]" />
                <span className="text-[10px] sm:text-[11px] font-black mt-0.5 tracking-wider uppercase">
                  बोलें
                </span>
              </button>
            </div>
          ) : (
            /* Friendly badge indicating floating assistant is active - Clickable to restore/expand window */
            <div
              onClick={() => expandAssistant()}
              className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-white border border-emerald-200 shadow-md max-w-sm text-center animate-fade-in space-y-1.5 cursor-pointer hover:border-emerald-400 hover:shadow-lg transition-all group"
              title="सहायक विंडो देखने हेतु क्लिक करें"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <Volume2 size={18} className="animate-pulse" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-neutral-800">
                वॉइस सहायक स्क्रीन पर सक्रिय है
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500">
                सहायक विंडो देखने या बातचीत जारी रखने के लिए यहां क्लिक करें।
              </p>
              <span className="inline-block text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                सहायक खोलें 🎙️
              </span>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* NEW: Personalized Categories Section (Clean & Minimalist) */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        <section className="w-full mt-2 mb-6">
          {/* Clean Header */}
          <div className="flex items-center justify-between gap-2 mb-3 px-1">
            <h2 className="text-base sm:text-lg font-black text-neutral-900 flex items-center gap-2">
              <span>🎯</span>
              <span>आपके लिए योजनाएं</span>
            </h2>
            <span className="text-xs font-bold text-neutral-400">
              श्रेणी चुनें 👇
            </span>
          </div>

          {/* Big Friendly Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none w-full">
            {PERSONALIZED_CATEGORIES.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  className={clsx(
                    'px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black whitespace-nowrap transition-all duration-200 flex items-center gap-2 cursor-pointer border',
                    isActive
                      ? cat.color.activeTab
                      : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-700 hover:bg-neutral-50 shadow-2xs'
                  )}
                >
                  <span className="text-lg">{cat.emoji}</span>
                  <span>{cat.titleHi}</span>
                </button>
              );
            })}
          </div>

          {/* Active Category Services Cards Grid (Clean, Direct, 5-Year-Old Simple) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 mt-3 text-left">
            {activeCategory.services.map((srv) => (
              <div
                key={srv.id}
                onClick={() => navigate(`/schemes/${srv.schemeId}`)}
                className="p-4 sm:p-5 rounded-3xl bg-white border border-neutral-200/90 hover:border-emerald-500 hover:shadow-md transition-all duration-200 flex flex-col justify-between cursor-pointer group shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      {srv.emoji}
                    </div>
                    <div>
                      <h3 className="font-black text-base text-neutral-900 leading-tight">
                        {srv.titleHi}
                      </h3>
                      <p className="text-xs sm:text-sm font-bold text-emerald-700 mt-1">
                        {srv.benefitHi}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Clean Bottom Action Row */}
                <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <span className="text-xs text-neutral-400 font-semibold group-hover:text-emerald-700 flex items-center gap-0.5 transition-colors">
                    विवरण <ChevronRight size={14} />
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServiceClick(srv.schemeId, srv.voicePrompt);
                    }}
                    className="py-1.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                    title="बोलकर समझें"
                  >
                    <Mic size={13} />
                    <span>बोलकर समझें</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Clean Quick Voice Prompts */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-bold text-neutral-500 flex items-center gap-1">
              <Sparkles size={13} className="text-emerald-600" />
              बोलकर पूछें:
            </span>
            {activeCategory.quickQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handlePromptClick(q)}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-white hover:bg-emerald-50 border border-neutral-200 hover:border-emerald-300 text-neutral-700 hover:text-emerald-900 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Mic size={12} className="text-emerald-600 shrink-0" />
                <span>"{q}"</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* Simple Footer */}
      <footer className="py-3 px-4 text-center text-[11px] text-neutral-400 font-medium">
        सहकार साथी · किसान, दुकानदार व कारीगरों के लिए भारत सरकार एवं सहकारिता मंत्रालय से प्रेरित पहल
      </footer>
    </div>
  );
}

