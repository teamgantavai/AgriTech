// ================================================================
// GlobalVoiceAssistant.tsx — Persistent Overlay Voice Interface
// Supports MINIMIZED (floating FAB), COMPACT (docked bar), and
// EXPANDED (docked drawer). Underlying website remains 100% visible & active.
// ================================================================

import { useState } from 'react';
import { useAssistant } from '../../context/AssistantContext';
import { VoiceState } from '../../types/voice';
import { AnimatedGlobe } from '../AudioVisualizer/AnimatedGlobe';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../services/sessionManager';

export function GlobalVoiceAssistant() {
  const {
    isOpen,
    uiMode,
    setUiMode,
    voiceState,
    isListening,
    isSpeaking,
    isProcessing,
    isConnecting,
    isError,
    currentTranscript,
    assistantResponse,
    currentAction,
    timeline,
    profile,
    setLanguage,
    startVoice,
    stopVoice,
    retryVoice,
    turns,
    error,
  } = useAssistant();

  const [showTimeline, setShowTimeline] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // If not open, display small floating FAB to start talking anytime
  if (!isOpen) {
    return (
      <aside aria-label="Voice Assistant Controls" className="fixed bottom-5 right-5 z-40">
        <button
          id="global-voice-fab"
          onClick={() => startVoice({ defaultMode: 'compact' })}
          className="group relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-500 hover:to-green-600 text-white rounded-full shadow-xl shadow-green-900/20 hover:shadow-2xl hover:shadow-green-900/30 transition-all duration-200 active:scale-95 cursor-pointer border border-emerald-400/30"
          aria-label="Talk to Gram Sathi AI"
        >
          {/* Animated pulse ring */}
          <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping pointer-events-none" />
          <span className="text-xl">🎙️</span>
          <span className="text-sm font-semibold tracking-tight pr-1">Talk to AI</span>
        </button>
      </aside>
    );
  }

  // ── 1. MINIMIZED MODE (Compact floating mic bubble) ────────────
  if (uiMode === 'minimized') {
    return (
      <aside aria-label="Voice Assistant Controls" className="fixed bottom-5 right-5 z-40">
        <div className="relative group">
          <button
            onClick={() => setUiMode('compact')}
            className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all transform active:scale-95 cursor-pointer border-2 ${
              isSpeaking
                ? 'bg-emerald-600 text-white border-white animate-pulse shadow-emerald-500/50'
                : isListening
                ? 'bg-blue-600 text-white border-white animate-bounce shadow-blue-500/50'
                : 'bg-neutral-900 text-white border-emerald-400'
            }`}
            title="Click to expand assistant"
            aria-label="Expand voice assistant"
          >
            {isConnecting ? '⏳' : isSpeaking ? '🔊' : '🎙️'}
          </button>
          
          {/* Status Tooltip on hover */}
          <div className="absolute bottom-16 right-0 bg-neutral-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {currentAction?.label || (isSpeaking ? 'AI Speaking...' : isListening ? 'Listening...' : 'Gram Sathi')}
          </div>
        </div>
      </aside>
    );
  }

  // ── 2. COMPACT MODE (Docked floating bar) ──────────────────────
  if (uiMode === 'compact') {
    return (
      <aside aria-label="Voice Assistant Controls" className="fixed bottom-5 right-4 sm:right-6 z-40 max-w-md w-[calc(100vw-2rem)] sm:w-auto">
        <div className="bg-white/95 backdrop-blur-md text-neutral-800 rounded-2xl shadow-2xl border border-neutral-200/80 p-3 sm:p-3.5 flex flex-col gap-2 transition-all">
          
          {/* Header Row: Live status + Controls */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Animated status orb */}
              <div
                className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                  isSpeaking
                    ? 'bg-emerald-500 animate-ping'
                    : isListening
                    ? 'bg-blue-500 animate-pulse'
                    : isConnecting
                    ? 'bg-amber-500 animate-pulse'
                    : isError
                    ? 'bg-red-500'
                    : 'bg-emerald-600'
                }`}
              />
              <div className="min-w-0">
                <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5 truncate">
                  <span>Gram Sathi AI</span>
                  {profile.language && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-medium">
                      {profile.language}
                    </span>
                  )}
                </div>
                {/* Live State or Action Label */}
                <div className="text-[11px] font-medium text-emerald-700 truncate">
                  {currentAction ? (
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <span>{currentAction.icon || '→'}</span>
                      <span>{currentAction.label}</span>
                    </span>
                  ) : isSpeaking ? (
                    'AI Speaking...'
                  ) : isListening ? (
                    '🎙 Listening to you...'
                  ) : isConnecting ? (
                    'Connecting...'
                  ) : isProcessing ? (
                    'Thinking...'
                  ) : (
                    'Ready for question'
                  )}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Expand to full drawer */}
              <button
                onClick={() => setUiMode('expanded')}
                className="w-8 h-8 rounded-lg hover:bg-neutral-100 text-neutral-600 flex items-center justify-center transition-colors text-xs font-bold"
                title="Expand panel"
                aria-label="Expand voice assistant"
              >
                ⤢
              </button>
              {/* Minimize to FAB */}
              <button
                onClick={() => setUiMode('minimized')}
                className="w-8 h-8 rounded-lg hover:bg-neutral-100 text-neutral-600 flex items-center justify-center transition-colors text-xs font-bold"
                title="Minimize"
                aria-label="Minimize voice assistant"
              >
                —
              </button>
              {/* Close / Disconnect */}
              <button
                onClick={stopVoice}
                className="w-8 h-8 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 flex items-center justify-center transition-colors text-sm font-bold"
                title="End session"
                aria-label="Close voice assistant"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Realtime streaming speech snippet */}
          {(currentTranscript || assistantResponse) && (
            <div className="bg-neutral-50 rounded-xl p-2 border border-neutral-100 text-[11px] text-neutral-700 max-h-16 overflow-y-auto leading-relaxed">
              {currentTranscript && (
                <div className="truncate text-neutral-600">
                  <span className="font-semibold text-neutral-800">You: </span>
                  "{currentTranscript}"
                </div>
              )}
              {assistantResponse && (
                <div className="truncate text-emerald-800 mt-0.5">
                  <span className="font-semibold text-emerald-900">AI: </span>
                  {assistantResponse}
                </div>
              )}
            </div>
          )}

          {/* Error & Retry */}
          {isError && (
            <div className="flex items-center justify-between bg-red-50 text-red-700 text-xs px-2.5 py-1.5 rounded-lg border border-red-200">
              <span className="truncate">{error || 'Connection problem'}</span>
              <button
                onClick={retryVoice}
                className="text-[11px] font-bold text-red-800 underline ml-2 flex-shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  }

  // ── 3. EXPANDED MODE (Docked side drawer on desktop, bottom sheet on mobile) ──
  return (
    <aside aria-label="Voice Assistant Controls" className="fixed top-0 right-0 h-full w-full sm:w-[420px] max-w-full z-40 bg-white/95 backdrop-blur-xl border-l border-neutral-200/90 shadow-2xl flex flex-col justify-between transition-all duration-300 animate-slide-left">
      {/* ── Drawer Header ── */}
      <header className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 bg-white/50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-xs">
            🎙️
          </div>
          <div>
            <h2 className="text-sm font-bold text-neutral-900 leading-tight">Gram Sathi AI</h2>
            <div className="text-[11px] text-emerald-700 font-medium">
              {isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Active Session'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Language Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu((p) => !p)}
              className="text-xs px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>🌐</span>
              <span className="max-w-[70px] truncate">{profile.language || 'Auto'}</span>
              <span>▾</span>
            </button>

            {showLangMenu && (
              <div className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-xl border border-neutral-200 py-1.5 z-50 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    setLanguage(null);
                    setShowLangMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 text-neutral-800"
                >
                  🌐 Auto-Detect
                </button>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang);
                      setShowLangMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 ${
                      profile.language === lang.name ? 'font-bold text-emerald-700 bg-emerald-50/50' : 'text-neutral-700'
                    }`}
                  >
                    {lang.nativeName} ({lang.name})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dock down to compact mode */}
          <button
            onClick={() => setUiMode('compact')}
            className="w-8 h-8 rounded-lg hover:bg-neutral-100 text-neutral-600 flex items-center justify-center transition-colors text-xs font-bold"
            title="Dock to compact"
            aria-label="Dock voice assistant"
          >
            ↙
          </button>
          {/* Close session */}
          <button
            onClick={stopVoice}
            className="w-8 h-8 rounded-lg hover:bg-red-50 text-neutral-500 hover:text-red-600 flex items-center justify-center transition-colors text-sm font-bold"
            title="End session"
            aria-label="Close voice assistant"
          >
            ✕
          </button>
        </div>
      </header>

      {/* ── Live Action Indicator Banner ── */}
      {currentAction && (
        <div className="px-5 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 flex items-center justify-between animate-fade-down flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 truncate">
            <span className="text-base">{currentAction.icon || '→'}</span>
            <span className="truncate">{currentAction.label}</span>
          </div>
          <span className="text-[10px] text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            Live
          </span>
        </div>
      )}

      {/* ── Central Visualizer & Conversation Log ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {/* Animated Globe / Voice Pulse */}
        <div className="flex flex-col items-center justify-center py-2 flex-shrink-0">
          <AnimatedGlobe
            isActive={isListening || isSpeaking || isProcessing}
            isSpeaking={isSpeaking}
            size={140}
          />
          <div className="mt-2 text-xs font-semibold text-neutral-500 text-center">
            {isSpeaking
              ? 'AI Speaking...'
              : isListening
              ? 'Listening... Speak naturally in your language'
              : isProcessing
              ? 'Processing...'
              : isConnecting
              ? 'Connecting to Gemini Live...'
              : 'Connected'}
          </div>
        </div>

        {/* Realtime Conversation Turns */}
        <div className="flex-1 flex flex-col gap-3 min-h-[160px]">
          {turns.length === 0 ? (
            <div className="text-center my-auto p-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
              <div className="text-2xl mb-1">🌾</div>
              <div className="text-xs font-semibold text-neutral-700">Try saying:</div>
              <div className="text-[11px] text-neutral-500 mt-1 flex flex-col gap-1">
                <span>"Open agriculture schemes"</span>
                <span>"Tell me about PM-Kisan eKYC"</span>
                <span>"Check crop calendar for Punjab"</span>
              </div>
            </div>
          ) : (
            turns.slice(-6).map((turn, idx) => (
              <div
                key={idx}
                className={`flex flex-col text-xs p-3 rounded-2xl ${
                  turn.speaker === 'user'
                    ? 'bg-emerald-50/70 border border-emerald-100 text-emerald-950 ml-6'
                    : 'bg-neutral-100/80 border border-neutral-200 text-neutral-900 mr-6'
                }`}
              >
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-0.5">
                  {turn.speaker === 'user' ? 'You' : 'Gram Sathi'}
                </span>
                <p className="leading-relaxed whitespace-pre-wrap">{turn.text}</p>
              </div>
            ))
          )}
        </div>

        {/* Action Timeline Toggle */}
        <div className="pt-2 border-t border-neutral-100 flex-shrink-0">
          <button
            onClick={() => setShowTimeline((p) => !p)}
            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 flex items-center gap-1.5 transition-colors"
          >
            <span>⏱️</span>
            <span>{showTimeline ? 'Hide Action Timeline' : 'View Action Timeline'}</span>
            <span className="text-[9px] bg-neutral-100 px-1.5 py-0.5 rounded-full">{timeline.length}</span>
          </button>

          {showTimeline && (
            <div className="mt-2 p-2.5 bg-neutral-900 text-neutral-200 rounded-xl text-[10px] font-mono max-h-40 overflow-y-auto space-y-1">
              {timeline.length === 0 ? (
                <div className="text-neutral-500">No events logged yet.</div>
              ) : (
                timeline.slice(0, 15).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 border-b border-neutral-800 pb-1">
                    <span className="text-neutral-500">{entry.timestamp}</span>
                    <span className="text-emerald-400 font-bold">{entry.type}</span>
                    <span className="text-neutral-300 truncate">{entry.target || entry.message || ''}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Drawer Footer ── */}
      <footer className="p-4 border-t border-neutral-100 bg-neutral-50/80 flex items-center justify-between gap-3 flex-shrink-0">
        <button
          onClick={() => setUiMode('compact')}
          className="flex-1 py-2 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold text-center transition-all cursor-pointer"
        >
          Dock & View Site
        </button>
        <button
          onClick={stopVoice}
          className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all cursor-pointer"
        >
          End Talk
        </button>
      </footer>
    </aside>
  );
}
