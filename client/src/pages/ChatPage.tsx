import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PanelLeftOpen, PanelLeftClose, RefreshCw, Mic } from 'lucide-react';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { ChatInput } from '../components/Chat/ChatInput';
import { useChatHistory } from '../hooks/useChatHistory';
import { useChat } from '../hooks/useChat';
import { useVoice } from '../hooks/useVoice';
import { useLanguage, useTranslation } from '../context/LanguageContext';
import { useVoiceModal } from '../context/VoiceModalContext';

export function ChatPage() {
  const location = useLocation();
  const initialPromptSent = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [speakingMessageId] = useState<string | undefined>(undefined);
  const { language, voiceLocale } = useLanguage();
  const { openVoiceModal } = useVoiceModal();
  const { t } = useTranslation();

  const {
    conversations,
    activeConversation,
    activeConversationId,
    createConversation,
    selectConversation,
    addMessage,
    updateMessage,
    renameConversation,
    deleteConversation,
  } = useChatHistory();

  const { sendMessage, isLoading } = useChat(
    activeConversation,
    addMessage,
    updateMessage,
    createConversation,
    language,
  );

  const {
    voiceState,
    transcript,
    errorMessage: voiceError,
    isSTTSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    resetTranscript,
  } = useVoice();

  const handleSend = async (message: string) => {
    resetTranscript();
    await sendMessage(message);
  };

  useEffect(() => {
    const initialPrompt = (location.state as any)?.initialPrompt;
    if (initialPrompt && !initialPromptSent.current) {
      initialPromptSent.current = true;
      handleSend(initialPrompt);
    }
  }, [location.state]);

  const handleCategorySelect = (question: string) => {
    handleSend(question);
  };

  // Get last detected language for TTS
  const lastAssistantMsg = activeConversation?.messages
    .filter(m => m.role === 'assistant' && m.detectedLanguage)
    .at(-1);
  const lastDetectedLang = lastAssistantMsg?.detectedLanguage?.displayName;

  const messages = activeConversation?.messages ?? [];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-neutral-50 overflow-hidden relative">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewConversation={createConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onCategorySelect={handleCategorySelect}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0 bg-white">
        {/* Chat toolbar */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-neutral-200 bg-white">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              className="btn-ghost p-1.5 text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100"
            >
              {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>

            {activeConversation ? (
              <span className="text-xs font-semibold text-neutral-800 truncate max-w-[140px] sm:max-w-xs">
                {activeConversation.title}
              </span>
            ) : (
              <span className="text-xs text-neutral-400">
                {t('chat.newChat', 'New Conversation')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Talk to Sahkar Sathi Real-time Voice Button */}
            <button
              onClick={() => openVoiceModal(language)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-brand-700 hover:from-emerald-700 hover:to-brand-800 text-white text-xs font-bold shadow-soft transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
              title="Open Hands-free Voice Conversation"
            >
              <Mic size={13} className="animate-pulse text-emerald-200" />
              <span className="hidden sm:inline">🎙 Talk to Sahkar Sathi</span>
              <span className="sm:hidden font-semibold">🎙 Voice</span>
            </button>

            {messages.length > 0 && (
              <button
                onClick={createConversation}
                className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-brand-700 px-1.5 sm:px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors"
                title={t('chat.newChat', 'New Chat')}
              >
                <RefreshCw size={12} />
                <span className="hidden sm:inline">{t('chat.newChat', 'New Chat')}</span>
              </button>
            )}

            {lastDetectedLang && (
              <span className="badge badge-green text-[10px] hidden md:inline-flex">
                {lastDetectedLang}
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <ChatWindow
          messages={messages}
          onQuestionClick={handleSend}
          onSpeak={(text, lang) => speak(text, lang)}
          onStopSpeak={stopSpeaking}
          isSpeaking={voiceState === 'speaking'}
          speakingMessageId={speakingMessageId}
        />

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          voiceState={voiceState}
          isSTTSupported={isSTTSupported}
          transcript={transcript}
          voiceError={voiceError}
          onStartListening={() => startListening(language)}
          onStopListening={stopListening}
        />
      </div>
    </div>
  );
}
