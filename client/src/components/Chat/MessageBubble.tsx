import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Volume2, VolumeX, Globe, BookOpen, Sparkles, User, AlertCircle, Copy, Check } from 'lucide-react';
import { Message, SourceType, LanguageCode } from '../../types';
import { useTranslation } from '../../context/LanguageContext';
import { ListenButton } from './ListenButton';
import { clsx } from 'clsx';

interface MessageBubbleProps {
  message: Message;
  onSpeak: (text: string, lang: LanguageCode) => void;
  onStopSpeak: () => void;
  isSpeaking: boolean;
  onQuestionClick?: (q: string) => void;
}

function SourceBadge({ sourceType, hasKBContext }: { sourceType?: SourceType; hasKBContext?: boolean }) {
  const { t } = useTranslation();
  if (!sourceType || sourceType === 'error') return null;

  if (sourceType === 'knowledge_base' || (sourceType === 'knowledge_base_and_ai' && hasKBContext)) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-brand-700 font-semibold">
        <BookOpen size={10} />
        <span>{t('chat.sourceVerified', 'Knowledge Base Verified')}</span>
      </div>
    );
  }

  if (sourceType === 'knowledge_base_and_ai') {
    return (
      <div className="flex items-center gap-1 text-[10px] text-purple-700 font-semibold">
        <Sparkles size={10} />
        <span>{t('chat.sourceHybrid', 'Knowledge Base + AI')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-[10px] text-neutral-500 font-medium">
      <Sparkles size={10} />
      <span>{t('chat.sourceAi', 'General AI Guidance')}</span>
    </div>
  );
}

function TypingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="flex items-end gap-3 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center flex-shrink-0">
        <span className="text-brand-700 text-[10px] font-bold">SS</span>
      </div>
      <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-soft flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
          <div className="typing-dot"></div>
        </div>
        <span className="text-xs text-neutral-400 italic">
          {t('chat.processing', 'Thinking & retrieving verified information...')}
        </span>
      </div>
    </div>
  );
}

export function MessageBubble({ message, onSpeak, onStopSpeak, isSpeaking, onQuestionClick }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  if (message.isLoading) return <TypingIndicator />;

  const isUser = message.role === 'user';
  const isError = message.sourceType === 'error';
  const langCode = (message.detectedLanguage?.code as LanguageCode) ?? 'en';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="flex items-end gap-2 max-w-[92%] sm:max-w-[85%]">
          <div className="bg-brand-700 text-white rounded-2xl rounded-br-sm px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-soft break-words">
            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0">
            <User size={13} className="text-neutral-600" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex items-end gap-2 sm:gap-3 animate-slide-up">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-brand-100 border border-brand-200 flex items-center justify-center flex-shrink-0">
        <span className="text-brand-700 text-[10px] font-bold">SS</span>
      </div>

      <div className={clsx(
        'flex-1 max-w-[94%] sm:max-w-[85%] rounded-2xl rounded-bl-sm shadow-soft overflow-hidden',
        isError
          ? 'bg-red-50 border border-red-200'
          : 'bg-white border border-neutral-200',
      )}>
        {/* Message content */}
        <div className="px-3.5 sm:px-4 py-2.5 sm:py-3 break-words">
          {isError ? (
            <div className="flex items-start gap-2 text-red-700">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <p className="text-xs sm:text-sm leading-relaxed">{message.content}</p>
            </div>
          ) : (
            <div className="chat-prose text-xs sm:text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Follow-up / Related Scheme Suggestions */}
          {!isError && message.suggestions && message.suggestions.length > 0 && onQuestionClick && (
            <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-neutral-100">
              <div className="text-[10px] sm:text-[11px] font-bold text-neutral-500 mb-1.5 flex items-center gap-1.5">
                <Sparkles size={11} className="text-brand-600" />
                <span>संबंधित प्रश्न व सुझाव / Suggested Follow-ups:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onQuestionClick(suggestion)}
                    className="text-[11px] sm:text-xs text-left px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-800 font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xs"
                  >
                    {suggestion} →
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer bar */}
        {!isError && (
          <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 border-t border-neutral-100 bg-neutral-50/60 rounded-b-2xl flex-wrap gap-1.5">
            {/* Left: source + language badge */}
            <div className="flex items-center gap-2">
              <SourceBadge sourceType={message.sourceType} hasKBContext={message.hasKBContext} />

              {message.detectedLanguage && (
                <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                  <Globe size={9} />
                  <span>{message.detectedLanguage.displayName}</span>
                </div>
              )}
            </div>

            {/* Right: Copy & TTS actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
              <button
                onClick={handleCopy}
                title={copied ? t('chat.copied', 'Copied!') : t('chat.copyText', 'Copy answer')}
                className="flex items-center gap-1 text-[10px] sm:text-[11px] text-neutral-500 hover:text-neutral-800 px-1.5 sm:px-2 py-1 rounded-md hover:bg-neutral-100 transition-all font-medium"
              >
                {copied ? <Check size={12} className="text-brand-600" /> : <Copy size={12} />}
                <span>{copied ? t('chat.copied', 'Copied!') : t('chat.copyText', 'Copy')}</span>
              </button>

              <ListenButton
                messageId={message.id}
                text={message.content}
                language={message.language || message.detectedLanguage?.code}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
