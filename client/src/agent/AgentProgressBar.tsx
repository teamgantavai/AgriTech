// ============================================================
// AgentProgressBar — Inert component
// Multi-step tasks and actions are surfaced directly through
// GlobalVoiceAssistant, preventing any navbar overlap or white bars.
// ============================================================

import type { TaskProgress } from '../agent/agentStateMachine';
import { AgentState } from '../agent/agentStateMachine';

interface Props {
  task: TaskProgress | null;
  agentState: AgentState;
  langCode?: string;
}

export function AgentProgressBar(_props: Props) {
  return null;
}
