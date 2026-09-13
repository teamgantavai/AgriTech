import React from 'react';
import { Mic, MicOff, Volume2, RotateCcw, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GeminiLiveState } from '../../hooks/useGeminiLive';

interface VoiceButtonProps {
  state: GeminiLiveState;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function VoiceButton({
  state,
  onClick,
  className,
  size = 'md',
}: VoiceButtonProps) {
  const getButtonContent = () => {
    switch (state) {
      case 'connecting':
        return {
          icon: <Loader2 size={16} className="animate-spin" />,
          label: 'Connecting...',
          bg: 'bg-emerald-800 text-white',
        };
      case 'listening':
        return {
          icon: <Mic size={16} className="animate-pulse text-emerald-200" />,
          label: 'Listening...',
          bg: 'bg-gradient-to-r from-emerald-600 to-brand-700 text-white shadow-emerald-500/20',
        };
      case 'speaking':
        return {
          icon: <Volume2 size={16} className="animate-bounce text-amber-200" />,
          label: 'Speaking...',
          bg: 'bg-gradient-to-r from-amber-600 to-emerald-700 text-white shadow-amber-500/20',
        };
      case 'disconnected':
      case 'error':
        return {
          icon: <RotateCcw size={16} />,
          label: 'Tap to reconnect',
          bg: 'bg-neutral-800 hover:bg-neutral-900 text-white',
        };
      case 'idle':
      default:
        return {
          icon: <Mic size={16} className="text-emerald-200" />,
          label: 'Talk to Sahkar Saathi',
          bg: 'bg-gradient-to-r from-emerald-600 to-brand-700 hover:from-emerald-700 hover:to-brand-800 text-white',
        };
    }
  };

  const { icon, label, bg } = getButtonContent();

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-xl',
    md: 'px-5 py-2.5 text-sm gap-2 rounded-2xl',
    lg: 'px-7 py-3.5 text-base gap-3 rounded-2xl',
  }[size];

  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center font-bold transition-all duration-200 shadow-md hover:shadow-xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
        sizeClasses,
        bg,
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
