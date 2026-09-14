// ============================================================
// VoicePanel — Clean White Voice Talking Screen matching reference
// Perfectly responsive for mobile and desktop viewports
// ============================================================

import { useState, useEffect } from 'react';
import { VoiceState, OnboardingState } from '../../types/voice';
import type { ConversationTurn, SessionProfile, VoiceMetrics } from '../../types/voice';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../services/sessionManager';
import { AnimatedGlobe } from '../AudioVisualizer/AnimatedGlobe';
import { ConversationView } from '../ConversationView/ConversationView';

interface VoicePanelProps {
  voiceState: VoiceState;
  onboardingState?: OnboardingState;
  profile: SessionProfile;
  turns: ConversationTurn[];
  error: string | null;
  metrics: VoiceMetrics;
  analyserData?: Uint8Array | null;
  micRms?: number;
  onStop: () => void;
  onRetry?: () => void;
  onLanguageChange?: (lang: SupportedLanguage | null) => void;
}

const STATE_LABEL: Record<VoiceState, string> = {
  [VoiceState.IDLE]: 'Ready',
  [VoiceState.PREPARING]: 'Preparing voice...',
  [VoiceState.CONNECTING]: 'Connecting...',
  [VoiceState.READY]: 'Ready',
  [VoiceState.LISTENING]: 'Listening...',
  [VoiceState.PROCESSING]: 'Thinking...',
  [VoiceState.AI_SPEAKING]: 'AI is speaking...',
  [VoiceState.RECOVERING]: 'Reconnecting...',
  [VoiceState.ERROR]: 'Voice connection problem',
  [VoiceState.DISCONNECTED]: 'Disconnected',
};

function cleanMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}

export function VoicePanel({
  voiceState,
  onboardingState,
  profile,
  turns,
  error,
  metrics,
  analyserData,
  micRms = 0,
  onStop,
  onRetry,
  onLanguageChange,
}: VoicePanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Responsive globe diameter to ensure zero overflow on mobile screens
  const [globeSize, setGlobeSize] = useState(() => {
    if (typeof window === 'undefined') return 240;
    const h = window.innerHeight;
    if (h < 660) return 180;
    if (h < 750) return 210;
    return 250;
  });

  useEffect(() => {
    const handleResize = () => {
      const h = window.innerHeight;
      if (h < 660) setGlobeSize(180);
      else if (h < 750) setGlobeSize(210);
      else setGlobeSize(250);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isListening =
    voiceState === VoiceState.LISTENING ||
    voiceState === VoiceState.READY_FOR_USER;
  const isSpeaking = voiceState === VoiceState.AI_SPEAKING;
  const isConnecting =
    voiceState === VoiceState.CONNECTING ||
    voiceState === VoiceState.RECOVERING;
  const isError = voiceState === VoiceState.ERROR;
  const isActive = isListening || isSpeaking || voiceState === VoiceState.PROCESSING;

  const activeLangObj = SUPPORTED_LANGUAGES.find(
    (l) =>
      l.name.toLowerCase() === (profile.selectedLanguage || profile.language)?.toLowerCase() ||
      l.code.toLowerCase() === profile.languageCode?.toLowerCase()
  );

  // Determine current active subtitle text
  const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  let subtitleText = activeLangObj
    ? `Listening in ${activeLangObj.nativeName}... Ask about any scheme`
    : 'Listening... Speak in Hindi, Punjabi, Marathi, English or your native language';

  if (isSpeaking && latestTurn?.role === 'assistant' && latestTurn?.text) {
    subtitleText = cleanMarkdown(latestTurn.text);
  } else if (isSpeaking) {
    subtitleText = 'AI is speaking...';
  } else if (voiceState === VoiceState.PROCESSING) {
    subtitleText = 'Thinking...';
  } else if (onboardingState === OnboardingState.LANGUAGE_QUESTION) {
    subtitleText = 'Which language would you like to speak in?';
  } else if (onboardingState === OnboardingState.WAITING_FOR_LANGUAGE) {
    subtitleText = 'Which language would you like to speak in? (Hindi, Punjabi, English...)';
  } else if (voiceState === VoiceState.PREPARING) {
    subtitleText = 'Preparing voice pipeline...';
  } else if (voiceState === VoiceState.RECOVERING) {
    subtitleText = 'Reconnecting...';
  } else if (isConnecting) {
    subtitleText = 'Connecting...';
  } else if (voiceState === VoiceState.READY_FOR_USER) {
    subtitleText = 'Ready! Speak whenever you want';
  } else if (isError) {
    subtitleText = error || 'Voice connection problem. Tap retry below.';
  } else if (latestTurn?.text) {
    subtitleText = cleanMarkdown(latestTurn.text);
  }

  const handleSelectLanguage = (lang: SupportedLanguage | null) => {
    onLanguageChange?.(lang);
    setShowLangModal(false);
  };

  return (
    <div className="w-full max-w-md mx-auto h-[100dvh] max-h-[100dvh] overflow-hidden bg-white flex flex-col justify-between px-5 sm:px-6 py-4 sm:py-5 select-none relative">
      {/* ── Top Header ── */}
      <header className="flex items-center justify-between w-full flex-shrink-0 pt-1">
        {/* Back Button */}
        <button
          onClick={onStop}
          aria-label="Back to home"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 flex items-center justify-center transition-all duration-150 cursor-pointer border border-neutral-200"
        >
          <svg className="w-5 h-5 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Center Title + Language Switcher Chip */}
        <div className="flex flex-col items-center">
          <h1 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight leading-tight">
            Voice Analysis
          </h1>
          <button
            onClick={() => setShowLangModal(true)}
            aria-label="Switch conversation language"
            className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-700 text-xs font-semibold transition-all duration-150 cursor-pointer border border-neutral-200"
            title="Click to switch language"
          >
            <span className="text-[11px]">🌐</span>
            <span className="max-w-[120px] truncate">
              {activeLangObj ? `${activeLangObj.nativeName} (${activeLangObj.name})` : 'Auto-Detect'}
            </span>
            <span className="text-[9px] text-neutral-400">▼</span>
          </button>
        </div>

        {/* Profile / Settings Button */}
        <button
          onClick={() => setShowProfile((p) => !p)}
          aria-label="View user profile"
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 flex items-center justify-center transition-all duration-150 cursor-pointer border border-neutral-200"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
      </header>

      {/* ── Status Text ── */}
      <div className="flex flex-col items-center justify-center flex-shrink-0 pt-2 pb-0.5">
        <p className="text-neutral-500 font-medium text-xs sm:text-sm tracking-normal text-center">
          {voiceState === VoiceState.PREPARING ? (
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold">
              <span>🎙️ Preparing voice...</span>
              <span className="voice-connecting-dots" />
            </span>
          ) : isConnecting ? (
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold">
              <span>Connecting to Gemini Live</span>
              <span className="voice-connecting-dots" />
            </span>
          ) : isError ? (
            <span className="text-red-500 font-semibold">Connection Issue</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-indigo-500 animate-pulse' : isListening ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
              <span>{STATE_LABEL[voiceState]}</span>
            </span>
          )}
        </p>
      </div>

      {/* ── Centerpiece: Animated Globe ── */}
      <div className="flex flex-col items-center justify-center flex-1 my-auto py-1">
        <AnimatedGlobe
          analyserData={analyserData}
          rms={isPaused ? 0 : isSpeaking ? 0 : micRms}
          isActive={isActive && !isPaused}
          isSpeaking={isSpeaking}
          size={globeSize}
        />
      </div>

      {/* ── Subtitle / Live Speech Text ── */}
      <div className="flex flex-col items-center justify-center px-3 min-h-[4.5rem] sm:min-h-[5.5rem] flex-shrink-0 my-1">
        <h2 className="text-xl sm:text-2xl font-semibold text-neutral-900 text-center leading-snug tracking-tight line-clamp-3">
          {subtitleText}
        </h2>
        {latestTurn?.isPartial && (
          <span className="inline-block w-2 h-2 rounded-full bg-neutral-400 animate-pulse mt-1.5" />
        )}
      </div>

      {/* ── Bottom Controls ── */}
      <div className="w-full pb-2 pt-1 flex-shrink-0">
        <div className="flex items-center justify-between max-w-[320px] mx-auto">
          {/* Pause / Mute Button ("00") */}
          <button
            onClick={() => setIsPaused((p) => !p)}
            aria-label={isPaused ? 'Resume listening' : 'Pause listening'}
            className={`
              w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-medium text-sm transition-all duration-150 active:scale-95 cursor-pointer border border-neutral-200
              ${isPaused
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }
            `}
            title={isPaused ? 'Resume listening' : 'Pause listening'}
          >
            {isPaused ? (
              <span className="text-base">▶</span>
            ) : (
              <span className="tracking-tighter font-bold text-sm">00</span>
            )}
          </button>

          {/* Main Microphone Button with Coral/Pink Ring (Matching Reference Photo) */}
          <div className="relative flex items-center justify-center">
            {/* Soft Coral/Pink Outer Halo Ring */}
            <div
              className={`
                w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-[#fca5a5]/80 flex items-center justify-center transition-all duration-300
                ${isListening && !isPaused ? 'mic-halo-active' : ''}
              `}
              style={{
                boxShadow: isListening && !isPaused ? '0 0 24px rgba(251, 113, 133, 0.4)' : 'none',
              }}
            >
              {/* Inner Dark Circular Button */}
              <button
                onClick={isError && onRetry ? onRetry : onStop}
                aria-label={isError ? 'Retry connection' : 'Stop voice session'}
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#18181b] hover:bg-neutral-800 active:scale-95 text-white flex items-center justify-center shadow-md transition-all duration-150 cursor-pointer"
              >
                {isError ? (
                  <span className="text-lg font-bold">↻</span>
                ) : (
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Transcript / Conversation History Button */}
          <button
            onClick={() => setShowHistory((h) => !h)}
            aria-label="Toggle conversation transcript"
            className={`
              w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer border border-neutral-200
              ${showHistory
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }
            `}
            title="Conversation History"
          >
            <svg className="w-5 h-5 stroke-[2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Slide-up Language Selector Modal ── */}
      {showLangModal && (
        <div className="absolute inset-x-0 bottom-0 top-16 bg-white rounded-t-3xl shadow-2xl border-t border-neutral-200 z-50 flex flex-col p-5 animate-slide-up">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
            <div>
              <h3 className="font-bold text-neutral-900 text-base">Select Spoken Language</h3>
              <p className="text-xs text-neutral-500">Choose from 14 Indian languages</p>
            </div>
            <button
              onClick={() => setShowLangModal(false)}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {/* Auto-detect option */}
            <button
              onClick={() => handleSelectLanguage(null)}
              className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                !profile.language
                  ? 'bg-neutral-900 text-white border-neutral-900 font-semibold shadow-sm'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">✨</span>
                <div>
                  <div className="text-sm font-bold">Auto-Detect</div>
                  <div className={`text-xs ${!profile.language ? 'text-neutral-300' : 'text-neutral-500'}`}>
                    Detects Indian languages & dialects naturally
                  </div>
                </div>
              </div>
              {!profile.language && <span className="text-emerald-400 font-bold text-sm">✓</span>}
            </button>

            {/* Supported languages list */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected =
                  profile.language === lang.name || profile.languageCode === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-neutral-900 font-semibold shadow-sm'
                        : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{lang.nativeName}</div>
                      <div className={`text-[11px] ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                        {lang.name}
                      </div>
                    </div>
                    {isSelected && <span className="text-emerald-400 font-bold text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Popover Modal ── */}
      {showProfile && (
        <div className="absolute top-18 right-6 z-50 w-72 bg-white rounded-2xl shadow-xl border border-neutral-200 p-4 animate-fade-up">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-3">
            <h3 className="font-bold text-sm text-neutral-900">Session Profile</h3>
            <button
              onClick={() => setShowProfile(false)}
              className="text-neutral-400 hover:text-neutral-600 text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2.5 text-xs text-neutral-600">
            <div className="flex justify-between items-center py-1">
              <span className="text-neutral-400">Language:</span>
              <button
                onClick={() => {
                  setShowProfile(false);
                  setShowLangModal(true);
                }}
                className="font-semibold text-emerald-600 underline cursor-pointer"
              >
                {activeLangObj ? `${activeLangObj.nativeName} (${activeLangObj.name})` : 'Auto-detect'}
              </button>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Detected Role:</span>
              <span className="font-semibold text-neutral-800 capitalize">{profile.occupation || 'Farmer / Citizen'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Total Turns:</span>
              <span className="font-semibold text-neutral-800">{turns.length}</span>
            </div>
            {metrics.ttfaMs && (
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">First Audio Latency:</span>
                <span className="font-semibold text-neutral-800">{metrics.ttfaMs}ms</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-neutral-400">Connection:</span>
              <span className="font-semibold text-emerald-600">Gemini Live Realtime</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Slide-up Full Conversation History Drawer ── */}
      {showHistory && (
        <div className="absolute inset-x-0 bottom-0 top-18 bg-white rounded-t-3xl shadow-2xl border-t border-neutral-200 z-40 flex flex-col p-5 animate-slide-up">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-2">
            <h3 className="font-bold text-neutral-900 text-base">Conversation Transcript</h3>
            <button
              onClick={() => setShowHistory(false)}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {turns.length === 0 ? (
              <p className="text-neutral-400 text-sm text-center pt-8">No dialogue yet. Speak to begin!</p>
            ) : (
              <ConversationView turns={turns} className="space-y-3" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
