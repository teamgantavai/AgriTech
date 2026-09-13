import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Mic, MicOff, AlertCircle, Radio } from 'lucide-react';
import { LanguageCode } from '../../types';
import { VoiceState } from '../../hooks/useVoice';
import { useTranslation, useLanguage } from '../../context/LanguageContext';
import { useVoiceModal } from '../../context/VoiceModalContext';
import { clsx } from 'clsx';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  voiceState: VoiceState;
  isSTTSupported: boolean;
  transcript: string;
  voiceError: string;
  onStartListening: (lang: LanguageCode) => void;
  onStopListening: () => void;
  preferredLanguage?: LanguageCode;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  isLoading,
  voiceState,
  isSTTSupported,
  transcript,
  voiceError,
  onStartListening,
  onStopListening,
  disabled,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTranscript = useRef('');
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { openVoiceModal } = useVoiceModal();

  // When transcript arrives from voice, fill the input
  useEffect(() => {
    if (transcript && transcript !== prevTranscript.current) {
      setValue(transcript);
      prevTranscript.current = transcript;
    }
  }, [transcript]);

  // Auto-submit when voice processing is done
  useEffect(() => {
    if (voiceState === 'processing' && transcript.trim()) {
      const tVal = transcript.trim();
      setValue('');
      prevTranscript.current = '';
      onSend(tVal);
    }
  }, [voiceState, transcript, onSend]);

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  }, [value]);

  const handleSend = () => {
    if (!value.trim() || isLoading) return;
    onSend(value.trim());
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isListening = voiceState === 'listening';
  const isProcessing = voiceState === 'processing' || isLoading;

  return (
    <div className="border-t border-neutral-200 bg-white px-3 sm:px-4 py-2 sm:py-3">
      {/* Top action bar: Talk to Sahkar Sathi Voice Mode Banner */}
      <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
        <button
          type="button"
          onClick={() => openVoiceModal(language)}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold shadow-soft transition-all active:scale-[0.98]"
          title="Open Real-time Voice Conversation"
        >
          <Mic size={13} className="animate-pulse text-emerald-600 flex-shrink-0" />
          <span className="hidden sm:inline">🎙 Talk to Sahkar Sathi (Voice Mode)</span>
          <span className="sm:hidden">🎙 Talk to Sahkar Sathi</span>
        </button>

        <span className="text-[11px] text-neutral-400 hidden sm:inline">
          Hands-free multi-turn voice supported
        </span>
      </div>

      {/* Voice error */}
      {voiceError && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 animate-fade-in">
          <AlertCircle size={13} className="flex-shrink-0" />
          <span className="break-words">{voiceError}</span>
        </div>
      )}

      {/* Listening state indicator */}
      {isListening && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 animate-fade-in font-medium">
          <div className="relative flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          </div>
          <span>{t('chat.listening', 'Listening... Speak now')}</span>
          <button onClick={onStopListening} className="ml-auto text-red-800 hover:text-red-950 font-bold text-xs underline">
            {t('chat.stop', 'Stop')}
          </button>
        </div>
      )}

      {/* Main input row */}
      <div className={clsx(
        'flex items-end gap-1.5 sm:gap-2.5 rounded-xl border transition-all duration-150',
        isListening
          ? 'border-red-400 ring-1 ring-red-300 bg-red-50/30'
          : 'border-neutral-300 bg-white focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-200 shadow-sm',
      )}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder', 'Ask about schemes, cooperative services or farming...')}
          rows={1}
          disabled={disabled || isProcessing}
          className="flex-1 resize-none bg-transparent px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none leading-relaxed disabled:opacity-50"
        />

        <div className="flex items-center gap-1 sm:gap-1.5 pr-2 pb-2">
          {/* Microphone button */}
          {isSTTSupported && (
            <button
              onClick={isListening ? onStopListening : () => onStartListening(language)}
              disabled={isProcessing}
              title={isListening ? t('chat.stopVoice', 'Stop Recording') : t('chat.voiceInput', 'Voice Input')}
              className={clsx(
                'relative w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1',
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-400'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 focus:ring-brand-400',
                isProcessing && 'opacity-40 cursor-not-allowed',
              )}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              {isListening && (
                <span className="absolute inset-0 rounded-lg border-2 border-red-400 animate-ping opacity-60" />
              )}
            </button>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!value.trim() || isProcessing}
            title={t('chat.send', 'Send')}
            className={clsx(
              'w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500',
              value.trim() && !isProcessing
                ? 'bg-brand-700 text-white hover:bg-brand-800 shadow-soft'
                : 'bg-neutral-100 text-neutral-400 cursor-not-allowed',
            )}
          >
            <Send size={14} className="sm:w-[15px] sm:h-[15px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
