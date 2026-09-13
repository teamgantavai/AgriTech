// ============================================================
// VoiceButton — Floating idle CTA button (Solid colors, no gradient)
// ============================================================

import { VoiceState } from '../../types/voice';

interface VoiceButtonProps {
  voiceState: VoiceState;
  onClick: () => void;
}

const STATE_CONFIG: Record<VoiceState, { label: string; icon: string; bg: string }> = {
  [VoiceState.IDLE]: {
    label: 'Talk with AI',
    icon: '🎙️',
    bg: 'bg-neutral-900 hover:bg-neutral-800 text-white',
  },
  [VoiceState.PREPARING]: {
    label: 'Preparing...',
    icon: '⟳',
    bg: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  [VoiceState.CONNECTING]: {
    label: 'Connecting...',
    icon: '⟳',
    bg: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  [VoiceState.LISTENING]: {
    label: 'Listening...',
    icon: '🎙️',
    bg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  [VoiceState.PROCESSING]: {
    label: 'Thinking...',
    icon: '✦',
    bg: 'bg-purple-600 hover:bg-purple-700 text-white',
  },
  [VoiceState.AI_SPEAKING]: {
    label: 'AI is speaking...',
    icon: '🔊',
    bg: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  [VoiceState.READY_FOR_USER]: {
    label: 'Ready for you...',
    icon: '🎙️',
    bg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  [VoiceState.RECONNECTING]: {
    label: 'Reconnecting...',
    icon: '⟳',
    bg: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  [VoiceState.ERROR]: {
    label: 'Try again',
    icon: '!',
    bg: 'bg-red-600 hover:bg-red-700 text-white',
  },
  [VoiceState.DISCONNECTED]: {
    label: 'Talk with AI',
    icon: '🎙️',
    bg: 'bg-neutral-900 hover:bg-neutral-800 text-white',
  },
};

export function VoiceButton({ voiceState, onClick }: VoiceButtonProps) {
  const cfg = STATE_CONFIG[voiceState] ?? STATE_CONFIG[VoiceState.IDLE];
  const isActive = voiceState !== VoiceState.IDLE && voiceState !== VoiceState.ERROR && voiceState !== VoiceState.DISCONNECTED;
  const isSpeaking = voiceState === VoiceState.AI_SPEAKING;
  const isSpinning = voiceState === VoiceState.CONNECTING || voiceState === VoiceState.RECONNECTING;

  return (
    <button
      id="voice-assistant-btn"
      aria-label={cfg.label}
      onClick={isSpeaking ? undefined : onClick}
      disabled={isSpeaking}
      className={`
        relative flex items-center gap-2.5 px-6 py-3.5
        rounded-full shadow-md font-semibold text-sm
        ${cfg.bg}
        transition-all duration-200 ease-out
        ${isSpeaking ? 'opacity-60 cursor-not-allowed' : 'hover:scale-105 active:scale-95 cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2
        select-none
      `}
    >
      {/* Icon */}
      <span
        className={`text-lg leading-none ${isSpinning ? 'animate-spin' : ''} ${isActive && !isSpinning ? 'animate-pulse' : ''}`}
        aria-hidden
      >
        {cfg.icon}
      </span>

      {/* Label */}
      <span className="tracking-wide">{cfg.label}</span>
    </button>
  );
}
