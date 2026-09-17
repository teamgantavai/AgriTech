// ================================================================
// ChatInput.tsx — Large, simple input. Easy on mobile.
// Language selector inline. Prominent voice button.
// ================================================================

import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  onOpenVoice?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const LANG_OPTIONS = [
  { code: 'en', label: 'EN', example: '' },
  { code: 'hi', label: 'हिं', example: '' },
  { code: 'pa', label: 'ਪੰ', example: '' },
];

export function ChatInput({ onSend, onStop, onOpenVoice, isStreaming, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, []);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus();
  }, [isStreaming]);

  const handleSend = () => {
    const t = value.trim();
    if (!t || isStreaming || disabled) return;
    onSend(t);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="bg-white border-t border-slate-200 px-3 sm:px-4 py-3 flex-shrink-0">
      <div className="max-w-2xl mx-auto">

        {/* ── Input row ── */}
        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white focus-within:border-green-600 focus-within:ring-2 focus-within:ring-green-100 px-3 py-2 transition-all duration-150 shadow-xs">

          {/* Voice button */}
          {onOpenVoice && (
            <button
              onClick={onOpenVoice}
              disabled={isStreaming}
              title="Talk to Gram Sathi"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-green-700 hover:bg-green-50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-lg"
            >
              🎙️
            </button>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Gram Sathi anything..."
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none text-[15px] text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none min-h-[38px] max-h-36 py-2 px-1 leading-snug"
            style={{ scrollbarWidth: 'none' }}
            aria-label="Ask Gram Sathi anything"
          />

          {/* Send / Stop */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-all active:scale-95"
              title="Stop response"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-150 ${
                canSend
                  ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer active:scale-95 shadow-xs'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
              title="Send"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Footer: hint + language ── */}
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-[10px] text-slate-400">
            🔒 Never share OTP or Aadhaar here
          </p>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 mr-0.5">Ask in:</span>
            {LANG_OPTIONS.map(l => (
              <span
                key={l.code}
                className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50"
                title={l.code}
              >
                {l.label}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
