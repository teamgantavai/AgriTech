import React from 'react';
import { Sparkles, Mic, Volume2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GeminiLiveState } from '../../hooks/useGeminiLive';

interface VoiceVisualizerProps {
  state: GeminiLiveState;
  userVolume: number;
  aiVolume: number;
  isMuted?: boolean;
}

export function VoiceVisualizer({
  state,
  userVolume,
  aiVolume,
  isMuted = false,
}: VoiceVisualizerProps) {
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isConnecting = state === 'connecting';

  // Volume scale for animated rings
  const activeVolume = isSpeaking ? aiVolume : userVolume;
  const pulseScale = 1 + Math.min(0.6, activeVolume * 1.2);

  return (
    <div className="relative flex flex-col items-center justify-center py-6 sm:py-8 select-none">
      {/* Outer Glowing Ripple Rings */}
      <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center">
        {/* Ambient background blur */}
        <div
          className={clsx(
            'absolute inset-0 rounded-full blur-2xl transition-all duration-300 opacity-60',
            isSpeaking
              ? 'bg-amber-400/40'
              : isListening
              ? 'bg-emerald-500/40'
              : isConnecting
              ? 'bg-blue-400/30'
              : 'bg-neutral-300/20'
          )}
        />

        {/* Dynamic Pulse Ring 1 */}
        {(isListening || isSpeaking) && (
          <div
            className={clsx(
              'absolute inset-0 rounded-full border-2 transition-transform duration-75',
              isSpeaking
                ? 'border-amber-400/60'
                : 'border-emerald-400/60'
            )}
            style={{
              transform: `scale(${pulseScale})`,
            }}
          />
        )}

        {/* Dynamic Pulse Ring 2 */}
        {(isListening || isSpeaking) && activeVolume > 0.1 && (
          <div
            className={clsx(
              'absolute inset-2 rounded-full border border-dashed transition-transform duration-100',
              isSpeaking ? 'border-amber-300/40' : 'border-emerald-300/40'
            )}
            style={{
              transform: `scale(${pulseScale * 1.15})`,
            }}
          />
        )}

        {/* Center Orb */}
        <div
          className={clsx(
            'relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300',
            isSpeaking
              ? 'bg-gradient-to-tr from-amber-500 via-amber-600 to-emerald-700 shadow-amber-500/30'
              : isListening
              ? 'bg-gradient-to-tr from-emerald-600 via-emerald-700 to-brand-800 shadow-emerald-600/40'
              : isConnecting
              ? 'bg-gradient-to-tr from-blue-600 to-emerald-700 animate-pulse'
              : 'bg-neutral-800 shadow-neutral-900/20'
          )}
        >
          {isSpeaking ? (
            <Volume2 size={38} className="text-white animate-bounce" />
          ) : isListening ? (
            <Mic size={38} className={clsx('text-white', isMuted && 'opacity-40')} />
          ) : isConnecting ? (
            <Sparkles size={34} className="text-white animate-spin [animation-duration:3s]" />
          ) : (
            <Mic size={34} className="text-neutral-400" />
          )}
        </div>
      </div>

      {/* Dynamic Animated Sound Wave Bars */}
      <div className="flex items-center gap-1.5 h-8 mt-5">
        {[40, 70, 100, 60, 90, 50, 80, 45, 75, 35].map((baseHeight, i) => {
          const height =
            isSpeaking || (isListening && !isMuted && activeVolume > 0.05)
              ? Math.max(12, Math.min(32, (baseHeight / 100) * 32 * (activeVolume * 2 + 0.3)))
              : 8;

          return (
            <div
              key={i}
              className={clsx(
                'w-1.5 rounded-full transition-all duration-75',
                isSpeaking
                  ? 'bg-gradient-to-t from-amber-500 to-emerald-600'
                  : isListening
                  ? 'bg-gradient-to-t from-emerald-500 to-emerald-700'
                  : isConnecting
                  ? 'bg-neutral-400 animate-pulse'
                  : 'bg-neutral-300'
              )}
              style={{
                height: `${height}px`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
