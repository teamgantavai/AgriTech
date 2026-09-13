import React from 'react';
import { VoiceAssistant } from './VoiceAssistant';

interface VoiceConversationModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialLanguage?: string;
}

/**
 * VoiceConversationModal
 * Legacy wrapper: VoiceAssistant is now a persistent floating assistant
 * managed globally via VoiceModalContext.
 */
export function VoiceConversationModal(_props: VoiceConversationModalProps) {
  return <VoiceAssistant />;
}
