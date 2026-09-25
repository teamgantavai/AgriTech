// ============================================================
// ConversationView — Scrollable transcript with clean light bubbles
// ============================================================

import { useEffect, useRef } from 'react';
import type { ConversationTurn } from '../../types/voice';

interface ConversationViewProps {
  turns: ConversationTurn[];
  className?: string;
}

export function ConversationView({ turns, className = '' }: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  if (turns.length === 0) return null;

  return (
    <div className={`overflow-y-auto px-1 py-2 space-y-3 ${className}`}>
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`
              max-w-[85%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed
              ${turn.role === 'user'
                ? 'bg-neutral-900 text-white rounded-br-sm font-medium'
                : 'bg-neutral-100 text-neutral-800 border border-neutral-200/80 rounded-bl-sm'
              }
              ${turn.isPartial ? 'opacity-80' : 'opacity-100'}
            `}
          >
            <div className="font-semibold text-[10px] text-neutral-400 mb-0.5">
              {turn.role === 'user' ? 'You' : 'gram Sathi AI'}
            </div>
            <span>{turn.text}</span>
            {turn.isPartial && (
              <span className="inline-flex gap-0.5 ml-1.5 align-middle">
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
