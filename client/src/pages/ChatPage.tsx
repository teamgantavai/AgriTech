// ================================================================
// ChatPage.tsx — Full Page AI Text Chat Assistant
// ================================================================

import { useEffect } from 'react';
import { ChatAssistant } from '../components/ChatAssistant/ChatAssistant';
import { useAssistant } from '../context/AssistantContext';
import { updateUIState } from '../agent/agentBridge';
import { eventBus } from '../services/eventBus';

export function ChatPage() {
  const { startVoice } = useAssistant();

  useEffect(() => {
    document.title = 'AI Chat Assistant — Gram Sathi';
    updateUIState({
      route: '/chat',
      pageName: 'Gram Sathi AI Chat',
      activeTab: 'chat',
      visibleActions: ['send_message', 'switch_to_voice'],
    });

    eventBus.emit({
      type: 'PAGE_READY',
      route: '/chat',
      title: 'Gram Sathi AI Chat',
    });
  }, []);

  return (
    <div className="h-[calc(100vh-65px)] w-full flex flex-col bg-slate-50 overflow-hidden">
      <ChatAssistant onSwitchToVoice={() => startVoice({ defaultMode: 'expanded' })} />
    </div>
  );
}
