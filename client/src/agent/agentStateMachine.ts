// ============================================================
// Agent State Machine — Client-side state tracking
// Maps to server AgentState enum
// Branch: agent-control
// ============================================================

export enum AgentState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  UNDERSTANDING = 'UNDERSTANDING',
  PLANNING = 'PLANNING',
  EXECUTING = 'EXECUTING',
  WAITING_FOR_USER = 'WAITING_FOR_USER',
  WAITING_FOR_CONFIRMATION = 'WAITING_FOR_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export type PermissionLevel = 'SAFE' | 'USER_DATA' | 'CONSEQUENTIAL';

export interface ConfirmationRequest {
  confirmationId: string;
  sessionId: string;
  taskId?: string;
  stepIndex?: number;
  actionType: string;
  message: string;
  messageHi?: string;
  reviewData?: Record<string, string>;
  expiresAt: number;
}

export type ConfirmationResponse = 'confirmed' | 'denied';

export interface TaskProgress {
  taskId: string;
  intent: string;
  steps: ProgressStep[];
  currentStep: number;
  status: 'planning' | 'executing' | 'waiting_confirmation' | 'completed' | 'failed';
}

export interface ProgressStep {
  index: number;
  label: string;
  labelHi?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'waiting_confirmation';
}

export interface UIState {
  route: string;
  pageName: string;
  activeTab?: string;
  visibleSections: string[];
  visibleActions: string[];
  currentFormId?: string;
  isLoading: boolean;
  hasError: boolean;
}

// ── Event types emitted by the state machine ─────────────────
export type AgentStateEvent =
  | { type: 'STATE_CHANGED'; state: AgentState; previous: AgentState }
  | { type: 'CONFIRMATION_REQUIRED'; request: ConfirmationRequest }
  | { type: 'TASK_PROGRESS'; progress: TaskProgress }
  | { type: 'TOOL_EXECUTED'; tool: string; result: unknown }
  | { type: 'SOURCE_RECEIVED'; source: SourceInfo }
  | { type: 'ERROR'; message: string; recoverable: boolean }
  | { type: 'EXTERNAL_NAVIGATION'; url: string; siteName: string };

export interface SourceInfo {
  title: string;
  url: string;
  retrievedAt: string;
  isOfficialGov: boolean;
}

type StateListener = (event: AgentStateEvent) => void;

class AgentStateMachineClass {
  private _state: AgentState = AgentState.IDLE;
  private _sessionId: string = '';
  private _listeners: Set<StateListener> = new Set();
  private _currentConfirmation: ConfirmationRequest | null = null;
  private _currentTask: TaskProgress | null = null;
  private _uiState: UIState = {
    route: '/',
    pageName: 'Home',
    visibleSections: [],
    visibleActions: [],
    isLoading: false,
    hasError: false,
  };

  // Valid state transitions
  private readonly TRANSITIONS: Partial<Record<AgentState, AgentState[]>> = {
    [AgentState.IDLE]: [AgentState.LISTENING, AgentState.UNDERSTANDING, AgentState.EXECUTING],
    [AgentState.LISTENING]: [AgentState.UNDERSTANDING, AgentState.IDLE, AgentState.FAILED],
    [AgentState.UNDERSTANDING]: [AgentState.PLANNING, AgentState.EXECUTING, AgentState.IDLE],
    [AgentState.PLANNING]: [AgentState.EXECUTING, AgentState.WAITING_FOR_USER, AgentState.FAILED],
    [AgentState.EXECUTING]: [AgentState.COMPLETED, AgentState.WAITING_FOR_CONFIRMATION, AgentState.FAILED, AgentState.IDLE],
    [AgentState.WAITING_FOR_USER]: [AgentState.EXECUTING, AgentState.CANCELLED, AgentState.IDLE],
    [AgentState.WAITING_FOR_CONFIRMATION]: [AgentState.EXECUTING, AgentState.CANCELLED, AgentState.IDLE],
    [AgentState.COMPLETED]: [AgentState.IDLE, AgentState.LISTENING],
    [AgentState.FAILED]: [AgentState.IDLE, AgentState.EXECUTING],
    [AgentState.CANCELLED]: [AgentState.IDLE],
  };

  get state(): AgentState { return this._state; }
  get sessionId(): string { return this._sessionId; }
  get currentConfirmation(): ConfirmationRequest | null { return this._currentConfirmation; }
  get currentTask(): TaskProgress | null { return this._currentTask; }
  get uiState(): UIState { return this._uiState; }

  init(sessionId: string): void {
    this._sessionId = sessionId;
    this._state = AgentState.IDLE;
  }

  transition(toState: AgentState): boolean {
    const allowed = this.TRANSITIONS[this._state]?.includes(toState) ?? false;
    if (!allowed) {
      console.warn(`[AgentFSM] Invalid transition: ${this._state} → ${toState}`);
      return false;
    }
    const previous = this._state;
    this._state = toState;
    this._emit({ type: 'STATE_CHANGED', state: toState, previous });
    return true;
  }

  forceTransition(toState: AgentState): void {
    const previous = this._state;
    this._state = toState;
    this._emit({ type: 'STATE_CHANGED', state: toState, previous });
  }

  setConfirmation(req: ConfirmationRequest | null): void {
    this._currentConfirmation = req;
    if (req) {
      this.forceTransition(AgentState.WAITING_FOR_CONFIRMATION);
      this._emit({ type: 'CONFIRMATION_REQUIRED', request: req });
    }
  }

  clearConfirmation(): void {
    this._currentConfirmation = null;
  }

  setTaskProgress(progress: TaskProgress | null): void {
    this._currentTask = progress;
    if (progress) {
      this._emit({ type: 'TASK_PROGRESS', progress });
    }
  }

  updateUIState(partial: Partial<UIState>): void {
    this._uiState = { ...this._uiState, ...partial };
  }

  emitSource(source: SourceInfo): void {
    this._emit({ type: 'SOURCE_RECEIVED', source });
  }

  emitError(message: string, recoverable = true): void {
    this._emit({ type: 'ERROR', message, recoverable });
    if (!recoverable) this.forceTransition(AgentState.FAILED);
  }

  emitExternalNavigation(url: string, siteName: string): void {
    this._emit({ type: 'EXTERNAL_NAVIGATION', url, siteName });
  }

  reset(): void {
    this._state = AgentState.IDLE;
    this._currentConfirmation = null;
    this._currentTask = null;
  }

  subscribe(listener: StateListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _emit(event: AgentStateEvent): void {
    this._listeners.forEach((l) => {
      try { l(event); } catch { /* listener errors don't propagate */ }
    });
  }

  /** Display label for current state */
  getStateLabel(langCode: string = 'hi'): string {
    const labels: Record<AgentState, { hi: string; en: string }> = {
      [AgentState.IDLE]: { hi: 'तैयार', en: 'Ready' },
      [AgentState.LISTENING]: { hi: 'सुन रहा हूँ...', en: 'Listening...' },
      [AgentState.UNDERSTANDING]: { hi: 'समझ रहा हूँ...', en: 'Understanding...' },
      [AgentState.PLANNING]: { hi: 'योजना बना रहा हूँ...', en: 'Planning...' },
      [AgentState.EXECUTING]: { hi: 'काम कर रहा हूँ...', en: 'Working...' },
      [AgentState.WAITING_FOR_USER]: { hi: 'आपकी प्रतीक्षा में...', en: 'Waiting for you...' },
      [AgentState.WAITING_FOR_CONFIRMATION]: { hi: 'पुष्टि की प्रतीक्षा...', en: 'Awaiting confirmation...' },
      [AgentState.COMPLETED]: { hi: 'पूरा हो गया ✓', en: 'Completed ✓' },
      [AgentState.FAILED]: { hi: 'त्रुटि हुई', en: 'Error occurred' },
      [AgentState.CANCELLED]: { hi: 'रद्द किया', en: 'Cancelled' },
    };
    const label = labels[this._state];
    return langCode === 'hi' ? label.hi : label.en;
  }
}

// Singleton
export const AgentStateMachine = new AgentStateMachineClass();
