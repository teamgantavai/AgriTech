import { useState, useCallback } from 'react';
import { Message, LanguageCode, ChatRequest, Conversation } from '../types';
import { sendChatMessage } from '../services/api';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function buildGeminiHistory(messages: Message[]) {
  return messages
    .filter(m => !m.isLoading && m.content)
    .map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));
}

export function useChat(
  activeConversation: Conversation | null,
  addMessage: (conversationId: string, message: Message) => void,
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void,
  createConversation: () => string,
  preferredLanguage: LanguageCode,
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);

    // Ensure there's an active conversation
    let conversationId = activeConversation?.id;
    if (!conversationId) {
      conversationId = createConversation();
    }

    const userMessageId = generateId();
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };
    addMessage(conversationId, userMessage);

    // Add loading placeholder
    const loadingMessageId = generateId();
    const loadingMessage: Message = {
      id: loadingMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };
    addMessage(conversationId, loadingMessage);
    setIsLoading(true);

    try {
      const currentMessages = activeConversation?.messages ?? [];
      const history = buildGeminiHistory(currentMessages);

      const payload: ChatRequest = {
        message: content.trim(),
        history,
        forceLanguage: preferredLanguage !== 'auto' ? preferredLanguage : undefined,
      };

      const response = await sendChatMessage(payload);

      const assistantLang = response.language || response.detectedLanguage?.code || (preferredLanguage !== 'auto' ? preferredLanguage : 'en');
      const assistantMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        isLoading: false,
        language: assistantLang,
        detectedLanguage: response.detectedLanguage,
        sourceType: response.sourceType,
        hasKBContext: response.hasKBContext,
        suggestions: response.suggestions,
      };

      updateMessage(conversationId, loadingMessageId, assistantMessage);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      const errMsg = error?.response?.data?.error || error?.message || 'Failed to get a response. Please check your connection and try again.';
      setError(errMsg);
      updateMessage(conversationId, loadingMessageId, {
        content: `⚠️ ${errMsg}`,
        isLoading: false,
        sourceType: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeConversation, addMessage, updateMessage, createConversation, isLoading, preferredLanguage]);

  return { sendMessage, isLoading, error, setError };
}
