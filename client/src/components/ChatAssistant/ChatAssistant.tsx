// ================================================================
// ChatAssistant.tsx — Gram Sathi Chat Orchestrator
// Clean layout, single source of truth streaming, no duplicate headers
// ================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatSidebar } from './ChatSidebar';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { WelcomeScreen } from './WelcomeScreen';
import { streamChatMessage, type ChatMessage } from '../../services/chatService';
import { getActiveServiceContext } from '../../services/sessionManager';
import {
  createConversation,
  addMessage,
  updateLastAssistantMessage,
  getConversation,
  getLastActiveConversationId,
  setLastActiveConversationId,
  type Conversation,
  type ChatMessageRecord,
} from '../../services/conversationStore';

interface ChatAssistantProps {
  onSwitchToVoice?: () => void;
}

const CONSUMED_PROMPTS_KEY = 'gram_sathi_consumed_prompts';

function isPromptConsumed(id: string): boolean {
  try {
    const raw = sessionStorage.getItem(CONSUMED_PROMPTS_KEY);
    if (!raw) return false;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.includes(id);
  } catch {
    return false;
  }
}

function markPromptConsumed(id: string): void {
  try {
    const raw = sessionStorage.getItem(CONSUMED_PROMPTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!arr.includes(id)) {
      arr.push(id);
      sessionStorage.setItem(CONSUMED_PROMPTS_KEY, JSON.stringify(arr.slice(-100)));
    }
  } catch {}
}

export function ChatAssistant({ onSwitchToVoice }: ChatAssistantProps) {
  const location = useLocation();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => getLastActiveConversationId());
  const [currentMessages, setCurrentMessages] = useState<ChatMessageRecord[]>(() => {
    const lastId = getLastActiveConversationId();
    if (lastId) {
      const conv = getConversation(lastId);
      return conv ? [...conv.messages] : [];
    }
    return [];
  });
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef('');
  const activeConvIdRef = useRef<string | null>(activeConversationId);
  const activeRequestRef = useRef<string | null>(null);
  const initialQueryHandledRef = useRef(false);

  useEffect(() => {
    activeConvIdRef.current = activeConversationId;
    setLastActiveConversationId(activeConversationId);
  }, [activeConversationId]);

  // Read-only restoration on mount if not already populated
  useEffect(() => {
    if (!activeConvIdRef.current) {
      const lastId = getLastActiveConversationId();
      if (lastId) {
        const conv = getConversation(lastId);
        if (conv && conv.messages.length > 0) {
          setActiveConversationId(conv.id);
          activeConvIdRef.current = conv.id;
          setCurrentMessages([...conv.messages]);
          console.log(`[CHAT] conversation restored: ${conv.id} (${conv.messages.length} messages)`);
        }
      }
    }
  }, []);

  const loadConversation = useCallback((id: string) => {
    const conv = getConversation(id);
    if (conv) {
      setActiveConversationId(id);
      activeConvIdRef.current = id;
      setLastActiveConversationId(id);
      setCurrentMessages([...conv.messages]);
      setStreamingContent('');
      setIsStreaming(false);
      setError(null);
      console.log(`[CHAT] conversation loaded: ${id}`);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveConversationId(null);
    activeConvIdRef.current = null;
    setLastActiveConversationId(null);
    setCurrentMessages([]);
    setStreamingContent('');
    setIsStreaming(false);
    setError(null);
    console.log('[CHAT] new conversation started');
  }, []);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    activeRequestRef.current = null;
    setIsStreaming(false);
    const content = streamingContentRef.current;
    const convId = activeConvIdRef.current;
    if (convId && content) {
      updateLastAssistantMessage(convId, { content, isStreaming: false, suggestions: [] });
      setCurrentMessages(getConversation(convId)?.messages ?? []);
    }
    setStreamingContent('');
  }, []);

  const sendMessage = useCallback(async (userText: string, customClientMsgId?: string) => {
    const trimmed = userText.trim();
    if (!trimmed) return;

    if (isStreaming || activeRequestRef.current) {
      console.warn('[CHAT] Request already in progress, ignoring duplicate send');
      return;
    }
    setError(null);

    const clientMessageId =
      customClientMsgId ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    activeRequestRef.current = requestId;

    let convId = activeConvIdRef.current;
    let conv: Conversation | null = convId ? getConversation(convId) : null;

    if (!convId || !conv) {
      conv = createConversation();
      convId = conv.id;
      setActiveConversationId(convId);
      setLastActiveConversationId(convId);
      activeConvIdRef.current = convId;
      console.log(`[CHAT] created conversation: ${convId}`);
    }

    console.log(`[CHAT] user message submitted: "${trimmed.slice(0, 40)}..." (clientMsgId: ${clientMessageId}, reqId: ${requestId})`);

    // 1. Add user message with clientMessageId
    const userMsg = addMessage(convId, { role: 'user', content: trimmed, clientMessageId });

    // 2. Add single assistant placeholder
    const assistantMsg = addMessage(convId, { role: 'assistant', content: '', isStreaming: true });
    setCurrentMessages(prev => {
      const filtered = prev.filter(m => m.id !== userMsg.id && m.id !== assistantMsg.id);
      return [...filtered, userMsg, assistantMsg];
    });

    const freshConv = getConversation(convId);
    const history: ChatMessage[] = (freshConv?.messages ?? [])
      .filter(m => !m.isStreaming && m.id !== assistantMsg.id)
      .slice(-16)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));

    // 3. Mark generating state
    setIsStreaming(true);
    setStreamingContent('');
    streamingContentRef.current = '';

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const activeService = getActiveServiceContext();
    let fullResponse = '';
    let suggestions: string[] = [];

    try {
      await streamChatMessage({
        message: trimmed,
        history,
        serviceContext: activeService ? {
          id: activeService.id,
          title: activeService.title,
          category: activeService.category,
          helpsWith: activeService.helpsWith,
          source: activeService.source,
          officialUrl: activeService.officialUrl,
        } : undefined,
        requestId,
        clientMessageId,
        signal: controller.signal,
        onChunk: (chunk) => {
          fullResponse += chunk;
          streamingContentRef.current = fullResponse;
          setStreamingContent(fullResponse);
        },
        onDone: () => {
          let cleanContent = fullResponse;
          if (fullResponse.includes('---SUGGESTIONS---')) {
            const parts = fullResponse.split('---SUGGESTIONS---');
            cleanContent = parts[0].trim();
            const rawSug = parts[1] || '';
            suggestions = rawSug
              .split('\n')
              .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim())
              .filter(line => line.length > 3 && !line.startsWith('---'))
              .slice(0, 3);
          }
          // Clean up any trailing empty bullet or orphaned dash/asterisk
          cleanContent = cleanContent.replace(/(\n\s*[-*•]\s*)+$/, '').trim();

          const currentConvId = activeConvIdRef.current;
          if (currentConvId) {
            updateLastAssistantMessage(currentConvId, { content: cleanContent, isStreaming: false, suggestions });
            const updated = getConversation(currentConvId);
            if (updated) setCurrentMessages([...updated.messages]);
          }
          setStreamingContent('');
          streamingContentRef.current = '';
          setIsStreaming(false);
          activeRequestRef.current = null;
          console.log(`[CHAT] request completed: ${requestId}`);
        },
        onError: (errMsg) => {
          setError(errMsg || 'Something went wrong. Please try again.');
          const currentConvId = activeConvIdRef.current;
          if (currentConvId) {
            updateLastAssistantMessage(currentConvId, {
              content: "Sorry, I couldn't complete that answer. Please try again.",
              isStreaming: false,
            });
            const updated = getConversation(currentConvId);
            if (updated) setCurrentMessages([...updated.messages]);
          }
          setStreamingContent('');
          streamingContentRef.current = '';
          setIsStreaming(false);
          activeRequestRef.current = null;
        },
      });
    } catch (e) {
      activeRequestRef.current = null;
      setIsStreaming(false);
    }
  }, [isStreaming]);

  // Handle incoming query from service page navigation — STRICT ONE-TIME EXECUTION
  useEffect(() => {
    const state = location.state as { initialQuery?: string; serviceContext?: any; promptId?: string } | null;
    if (!state || !state.initialQuery) return;
    const query = state.initialQuery.trim();
    if (!query) return;

    const promptId = state.promptId || `prompt_${query.slice(0, 30)}_${location.key || 'init'}`;

    if (isPromptConsumed(promptId) || initialQueryHandledRef.current) {
      console.log(`[CHAT] initial prompt already consumed, skipping: ${promptId}`);
      return;
    }

    initialQueryHandledRef.current = true;
    markPromptConsumed(promptId);

    // Clear location.state from browser history immediately
    try {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    } catch {}

    console.log(`[CHAT] submitting initial prompt once: ${promptId}`);
    sendMessage(query);
  }, [location.state, location.key, sendMessage]);

  const showWelcome = currentMessages.length === 0 && !isStreaming;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#fafaf9]">
      {/* Sidebar */}
      <ChatSidebar
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          loadConversation(id);
          setSidebarOpen(false);
        }}
        onNewConversation={() => {
          startNewConversation();
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden relative">

        {/* Minimal chat header — ONLY rendered during active conversation to avoid duplicate headers */}
        {!showWelcome && (
          <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0 z-10 shadow-2xs">
            <div className="flex items-center gap-2">
              {/* Mobile menu toggle */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                aria-label="Open chats"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-slate-700">Gram Sathi</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={startNewConversation}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <span>+</span>
                <span>New Chat</span>
              </button>

              {onSwitchToVoice && (
                <button
                  onClick={onSwitchToVoice}
                  className="flex items-center gap-1 px-3 py-1 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition-all cursor-pointer border border-green-200"
                >
                  <span>🎙️</span>
                  <span>Voice</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center gap-2 text-xs text-red-700 flex-shrink-0">
            <span>⚠️</span>
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-red-400 hover:text-red-700 cursor-pointer ml-2">✕</button>
          </div>
        )}

        {/* Content area */}
        {showWelcome ? (
          <WelcomeScreen
            onQuickAction={sendMessage}
            onOpenVoice={onSwitchToVoice}
            onSearchSubmit={sendMessage}
          />
        ) : (
          <ChatMessageList
            messages={currentMessages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            onSuggestionSelect={sendMessage}
          />
        )}

        {/* Input area (pinned to bottom during conversation) */}
        {!showWelcome && (
          <ChatInput
            onSend={sendMessage}
            onStop={stopStreaming}
            onOpenVoice={onSwitchToVoice}
            isStreaming={isStreaming}
          />
        )}
      </div>
    </div>
  );
}
