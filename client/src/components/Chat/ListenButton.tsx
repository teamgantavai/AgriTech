import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Gauge } from 'lucide-react';
import { LanguageCode } from '../../types';
import { speakText, stopSpeaking, subscribeSpeech, getCurrentSpeakingId } from '../../services/textToSpeech';
import { useTranslation } from '../../context/LanguageContext';
import { clsx } from 'clsx';

interface ListenButtonProps {
  messageId: string;
  text: string;
  language?: LanguageCode | string;
  className?: string;
}

export function ListenButton({ messageId, text, language, className }: ListenButtonProps) {
  const [isThisSpeaking, setIsThisSpeaking] = useState<boolean>(() => getCurrentSpeakingId() === messageId);
  const [speed, setSpeed] = useState<number>(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false);
  const { t } = useTranslation();

  // Synchronize with global TTS state
  useEffect(() => {
    const unsubscribe = subscribeSpeech((activeId) => {
      setIsThisSpeaking(activeId === messageId);
    });
    return unsubscribe;
  }, [messageId]);

  const handleToggleSpeak = () => {
    if (isThisSpeaking) {
      stopSpeaking();
    } else {
      speakText(
        text,
        language || 'en',
        {
          rate: speed,
          pitch: 1.0,
          volume: 1.0,
          onError: () => setIsThisSpeaking(false),
        },
        messageId
      );
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [0.8, 1.0, 1.2];
    const nextIndex = (speeds.indexOf(speed) + 1) % speeds.length;
    setSpeed(speeds[nextIndex]);
  };

  return (
    <div className={clsx('inline-flex items-center gap-1.5', className)}>
      {/* Main Listen / Stop Button */}
      <button
        onClick={handleToggleSpeak}
        title={isThisSpeaking ? t('chat.stopSpeaking', 'Stop speaking') : t('chat.readAloud', 'Listen to answer')}
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1',
          isThisSpeaking
            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 focus:ring-red-400 shadow-sm'
            : 'bg-brand-50 text-brand-700 hover:bg-brand-100 hover:text-brand-800 border border-brand-200 focus:ring-brand-400'
        )}
      >
        {isThisSpeaking ? (
          <>
            {/* Subtle animated audio waveform */}
            <span className="flex items-center gap-0.5 h-3" aria-hidden="true">
              <span className="w-0.5 h-3 bg-red-600 rounded-full animate-pulse" style={{ animationDuration: '600ms' }}></span>
              <span className="w-0.5 h-2 bg-red-600 rounded-full animate-pulse" style={{ animationDuration: '400ms', animationDelay: '150ms' }}></span>
              <span className="w-0.5 h-3.5 bg-red-600 rounded-full animate-pulse" style={{ animationDuration: '500ms', animationDelay: '300ms' }}></span>
            </span>
            <VolumeX size={12} className="text-red-700 ml-0.5" />
            <span>{t('chat.stopSpeaking', 'Stop')}</span>
          </>
        ) : (
          <>
            <Volume2 size={13} className="text-brand-700" />
            <span>{t('chat.readAloud', 'Listen')}</span>
          </>
        )}
      </button>

      {/* Voice Speed Toggle */}
      <button
        onClick={cycleSpeed}
        title={`Voice Speed: ${speed}x (Click to change)`}
        className="px-1.5 py-1 text-[10px] font-semibold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded border border-neutral-200 transition-colors focus:outline-none"
      >
        {speed}x
      </button>
    </div>
  );
}
