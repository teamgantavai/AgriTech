import { useState, useCallback, useRef, useEffect } from 'react';
import { Conversation, Message } from '../types';

const STORAGE_KEY = 'sahkar_sathi_conversations';
const MAX_CONVERSATIONS = 20;

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function loadConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as Conversation[];
    // Rehydrate dates
    return parsed.map(c => ({
      ...c,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
      messages: c.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })),
    }));
  } catch {
    return [];
  }
}

function saveConversations(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    console.warn('Failed to save conversations to localStorage');
  }
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback((convs: Conversation[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveConversations(convs), 500);
  }, []);

  useEffect(() => {
    debouncedSave(conversations);
  }, [conversations, debouncedSave]);

  const activeConversation = conversations.find(c => c.id === activeConversationId) ?? null;

  const createConversation = useCallback((): string => {
    const id = generateId();
    const newConv: Conversation = {
      id,
      title: 'New Conversation',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };
    setConversations(prev => {
      const next = [newConv, ...prev].slice(0, MAX_CONVERSATIONS);
      return next;
    });
    setActiveConversationId(id);
    return id;
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const addMessage = useCallback((conversationId: string, message: Message) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== conversationId) return c;
      const messages = [...c.messages, message];
      // Auto-title: use first user message (truncated)
      let title = c.title;
      if (title === 'New Conversation' && message.role === 'user') {
        title = message.content.slice(0, 40) + (message.content.length > 40 ? '…' : '');
      }
      return { ...c, messages, title, updatedAt: new Date() };
    }));
  }, []);

  const updateMessage = useCallback((conversationId: string, messageId: string, updates: Partial<Message>) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== conversationId) return c;
      return {
        ...c,
        updatedAt: new Date(),
        messages: c.messages.map(m => m.id === messageId ? { ...m, ...updates } : m),
      };
    }));
  }, []);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id);
      return next;
    });
    setActiveConversationId(prev => {
      if (prev !== id) return prev;
      return null;
    });
  }, []);

  const clearAll = useCallback(() => {
    setConversations([]);
    setActiveConversationId(null);
  }, []);

  return {
    conversations,
    activeConversation,
    activeConversationId,
    createConversation,
    selectConversation,
    addMessage,
    updateMessage,
    renameConversation,
    deleteConversation,
    clearAll,
  };
}
