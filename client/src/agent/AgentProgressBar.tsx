// ============================================================
// AgentProgressBar — Multi-step task progress display
// Shows the user what the AI is doing step by step
// Branch: agent-control
// ============================================================

import type { TaskProgress } from '../agent/agentStateMachine';
import { AgentState } from '../agent/agentStateMachine';

interface Props {
  task: TaskProgress | null;
  agentState: AgentState;
  langCode?: string;
}

const STATE_SPINNER_LABELS: Record<string, { hi: string; en: string }> = {
  [AgentState.LISTENING]:              { hi: '🎙 सुन रहा हूँ...', en: '🎙 Listening...' },
  [AgentState.UNDERSTANDING]:          { hi: '🧠 समझ रहा हूँ...', en: '🧠 Understanding...' },
  [AgentState.PLANNING]:               { hi: '📋 योजना बना रहा हूँ...', en: '📋 Planning...' },
  [AgentState.EXECUTING]:              { hi: '⚙️ काम कर रहा हूँ...', en: '⚙️ Working...' },
  [AgentState.WAITING_FOR_USER]:       { hi: '⏳ आपकी प्रतीक्षा में...', en: '⏳ Waiting for you...' },
  [AgentState.WAITING_FOR_CONFIRMATION]: { hi: '⚠️ पुष्टि की प्रतीक्षा...', en: '⚠️ Awaiting confirmation...' },
  [AgentState.COMPLETED]:              { hi: '✅ पूरा हो गया', en: '✅ Completed' },
  [AgentState.FAILED]:                 { hi: '❌ त्रुटि हुई', en: '❌ Error occurred' },
};

const STEP_STATUS_ICONS = {
  pending: '○',
  executing: '⟳',
  completed: '✓',
  failed: '✗',
  waiting_confirmation: '⚠',
};

export function AgentProgressBar({ task, agentState, langCode = 'hi' }: Props) {
  const isHindi = langCode === 'hi' || langCode === 'pa';
  const isActive = agentState !== AgentState.IDLE && agentState !== AgentState.COMPLETED && agentState !== AgentState.FAILED && agentState !== AgentState.CANCELLED;
  const stateLabel = STATE_SPINNER_LABELS[agentState];
  const displayLabel = isHindi ? stateLabel?.hi : stateLabel?.en;

  if (agentState === AgentState.IDLE) return null;

  return (
    <div
      id="agent-progress-bar"
      className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-sm animate-slide-down"
    >
      {/* State indicator + label */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Spinner */}
        {isActive && (
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        )}
        {agentState === AgentState.COMPLETED && (
          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[8px] font-bold">✓</span>
          </div>
        )}
        {agentState === AgentState.FAILED && (
          <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[8px] font-bold">✗</span>
          </div>
        )}

        {/* Label */}
        <span className="text-sm font-medium text-slate-700 flex-1 min-w-0 truncate">
          {displayLabel || (isHindi ? 'ग्राम साथी काम कर रहा है...' : 'Gram Sathi is working...')}
        </span>

        {/* Task step counter */}
        {task && (
          <span className="text-xs text-slate-400 flex-shrink-0">
            {task.currentStep + 1}/{task.steps.length}
          </span>
        )}
      </div>

      {/* Step list — shown when task has multiple steps */}
      {task && task.steps.length > 1 && (
        <div className="px-4 pb-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {task.steps.map((step, i) => (
            <div key={step.index} className="flex items-center gap-1 flex-shrink-0">
              <span
                className={`text-xs font-medium rounded-full px-2 py-0.5 border transition-all ${
                  step.status === 'completed'
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : step.status === 'executing'
                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                    : step.status === 'failed'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : step.status === 'waiting_confirmation'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}
              >
                <span className="mr-1">{STEP_STATUS_ICONS[step.status] || '○'}</span>
                {isHindi && step.labelHi ? step.labelHi : step.label}
              </span>
              {i < task.steps.length - 1 && (
                <span className="text-slate-300 text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Linear progress bar */}
      {task && (
        <div className="h-0.5 bg-slate-100">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{
              width: `${((task.steps.filter((s) => s.status === 'completed').length) / task.steps.length) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
