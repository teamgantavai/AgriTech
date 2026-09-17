// ================================================================
// ChatMessageList.tsx — Warm, readable conversational messages
// Single source of truth for streaming. No duplicate bubbles or indicators.
// ================================================================

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessageRecord } from '../../services/conversationStore';

interface ChatMessageListProps {
  messages: ChatMessageRecord[];
  streamingContent: string;
  isStreaming: boolean;
  onSuggestionSelect: (suggestion: string) => void;
}

// ── Copy button ──────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

function sanitizeExternalUrl(rawHref?: string): string {
  if (!rawHref) return '#';
  let url = rawHref.trim();

  // Strip accidental quotes or markdown formatting
  url = url.replace(/^[<"']+|[>"']+$/g, '');
  // Strip trailing punctuation often accidentally included at end of sentence
  url = url.replace(/[.,;:)]+$/, '');

  // If protocol missing (e.g. "www.myscheme.gov.in" or "pmkisan.gov.in"), add https://
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !/^tel:/i.test(url)) {
    url = `https://${url.replace(/^\/+/, '')}`;
  }

  // Canonicalize known broken or legacy government URLs to verified 200 OK myScheme endpoints
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('kviconline.gov.in')) {
      return 'https://www.myscheme.gov.in/schemes/pmegp';
    }
    if (host.includes('pmkusum.mnre.gov.in')) {
      return 'https://www.myscheme.gov.in/schemes/pm-kusum';
    }
    if (host.includes('pmsvanidhi.mohua.gov.in')) {
      return 'https://www.myscheme.gov.in/schemes/pm-svanidhi';
    }
    if (host.includes('pmaymis.gov.in')) {
      return 'https://www.myscheme.gov.in/schemes/pmay-g';
    }
    if (host.includes('mudra.org.in')) {
      return 'https://www.myscheme.gov.in/schemes/pmmy';
    }
    if (host.includes('beneficiary.nha.gov.in')) {
      return 'https://www.myscheme.gov.in/schemes/ab-pmjay';
    }
  } catch {
    return url;
  }

  return url;
}

// ── Markdown renderer — simple, readable ────────────────────
function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          const safeHref = sanitizeExternalUrl(href);
          return (
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-700 underline underline-offset-2 hover:text-emerald-900 font-medium break-all"
            >
              <span>{children}</span>
              <svg className="w-3 h-3 inline-block shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          );
        },
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900">{children}</strong>
        ),
        p: ({ children }) => (
          <p className="mb-2.5 last:mb-0 leading-relaxed text-slate-800">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-2.5 pl-4 space-y-1 list-disc last:mb-0 text-slate-800">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2.5 pl-4 space-y-1 list-decimal last:mb-0 text-slate-800">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h3: ({ children }) => <h3 className="font-bold text-slate-900 text-sm mt-3 mb-1.5 first:mt-0">{children}</h3>,
        h4: ({ children }) => <h4 className="font-semibold text-slate-900 text-sm mt-2 mb-1 first:mt-0">{children}</h4>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-slate-100 font-semibold text-left px-3 py-1.5 border border-slate-200 text-xs text-slate-800">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-1.5 border border-slate-200 text-xs text-slate-700">
            {children}
          </td>
        ),
        code: ({ inline, children }: any) =>
          inline ? (
            <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono text-slate-800">
              {children}
            </code>
          ) : (
            <code className="block bg-slate-50 rounded-xl p-3 text-xs font-mono overflow-x-auto my-2 text-slate-800">
              {children}
            </code>
          ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-green-500 pl-3 italic text-slate-600 my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-slate-200 my-3" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── User message ─────────────────────────────────────────────
function UserMessage({ message }: { message: ChatMessageRecord }) {
  return (
    <div className="flex justify-end px-4 sm:px-6 py-2">
      <div className="max-w-[85%] sm:max-w-[75%]">
        <div className="bg-slate-900 text-white rounded-2xl rounded-br-sm px-4 py-3 text-[15px] leading-relaxed shadow-xs break-words [overflow-wrap:anywhere]">
          {message.content}
        </div>
        <div className="flex justify-end mt-1 px-1">
          <span className="text-[10px] text-slate-400">
            {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Gram Sathi (AI) message ──────────────────────────────────
function AssistantMessage({
  message,
  isStreaming,
  streamContent,
  onSuggestionSelect,
}: {
  message: ChatMessageRecord;
  isStreaming?: boolean;
  streamContent?: string;
  onSuggestionSelect: (s: string) => void;
}) {
  const activeContent = streamContent !== undefined ? streamContent : message.content;
  const isTyping = isStreaming && activeContent.trim().length === 0;

  const rawContent = activeContent || (!isStreaming ? "Sorry, I couldn't complete that answer. Please try again." : '');
  const finalContent = isStreaming ? rawContent : rawContent.replace(/(\n\s*[-*•]\s*)+$/, '').trim();

  return (
    <div className="flex justify-start px-4 sm:px-6 py-2 group">
      <div className="max-w-[90%] sm:max-w-[80%]">
        {/* Subtle name label — no repeated bulky icon */}
        <div className="text-xs font-semibold text-green-700 mb-1 px-1 flex items-center gap-1.5">
          <span>Gram Sathi</span>
          {isStreaming && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>

        {/* Bubble */}
        <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-xs text-[15px] leading-relaxed break-words [overflow-wrap:anywhere]">
          {isTyping ? (
            /* ONE subtle typing indicator inside the single bubble */
            <div className="flex items-center gap-2 text-slate-500 py-1 text-sm font-normal">
              <span className="text-xs text-slate-500">Gram Sathi is typing</span>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : (
            <div>
              <MarkdownContent content={finalContent} />
              {isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-green-600 ml-1 align-middle animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Actions row */}
        {!isStreaming && finalContent && (
          <div className="flex items-center gap-2 mt-1 px-1">
            <CopyButton text={finalContent} />
            <span className="text-[10px] text-slate-400 ml-auto">
              {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}

        {/* Suggestions */}
        {!isStreaming && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-3 px-1 flex flex-wrap gap-2">
            <span className="w-full text-xs text-slate-400 font-medium">You can also ask:</span>
            {message.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggestionSelect(s)}
                className="inline-flex items-center px-3 py-1.5 rounded-full border border-green-200 bg-green-50 hover:bg-green-100 text-green-800 text-xs font-medium transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────
export function ChatMessageList({
  messages,
  streamingContent,
  isStreaming,
  onSuggestionSelect,
}: ChatMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Monitor user scroll position: don't aggressively yank down if they scroll up
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = fromBottom < 100;
  };

  useEffect(() => {
    if (isAtBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) return null;

  // Find index of the assistant message being streamed
  const lastAssistantIdx = messages.reduceRight((acc, m, i) => {
    if (acc === -1 && m.role === 'assistant') return i;
    return acc;
  }, -1);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto py-4 bg-[#fafaf9] scroll-smooth"
    >
      <div className="max-w-2xl mx-auto">
        {messages.map((message, idx) => {
          if (message.role === 'user') {
            return <UserMessage key={message.id} message={message} />;
          }
          const isThisStreaming = isStreaming && idx === lastAssistantIdx;
          return (
            <AssistantMessage
              key={message.id}
              message={message}
              isStreaming={isThisStreaming}
              streamContent={isThisStreaming ? streamingContent : undefined}
              onSuggestionSelect={onSuggestionSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
