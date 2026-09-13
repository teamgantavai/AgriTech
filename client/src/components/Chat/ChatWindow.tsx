import { useEffect, useRef } from 'react';
import { Message, LanguageCode } from '../../types';
import { MessageBubble } from './MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';

interface ChatWindowProps {
  messages: Message[];
  onQuestionClick: (q: string) => void;
  onSpeak: (text: string, lang: LanguageCode) => void;
  onStopSpeak: () => void;
  isSpeaking: boolean;
  speakingMessageId?: string;
}

export function ChatWindow({ messages, onQuestionClick, onSpeak, onStopSpeak, isSpeaking }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {!hasMessages ? (
        <WelcomeScreen onQuestionClick={onQuestionClick} />
      ) : (
        <div className="px-4 py-6 space-y-5 max-w-3xl mx-auto">
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSpeak={onSpeak}
              onStopSpeak={onStopSpeak}
              isSpeaking={isSpeaking}
              onQuestionClick={onQuestionClick}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
