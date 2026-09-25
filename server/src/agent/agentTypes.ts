// ============================================================
// Agent Types — Gram Sathi AI Agent Core Type Definitions
// Branch: agent-control
// ============================================================

// ── Agent State Machine ──────────────────────────────────────
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

// ── Permission Levels ────────────────────────────────────────
export enum PermissionLevel {
  /** Safe: navigation, search, reading public data — auto-execute */
  SAFE = 'SAFE',
  /** User data: fill fields, save profile — ask once per session */
  USER_DATA = 'USER_DATA',
  /** Consequential: submit, pay, sign, delete — ALWAYS confirm */
  CONSEQUENTIAL = 'CONSEQUENTIAL',
}

// ── Action Types ─────────────────────────────────────────────
export type ActionType =
  | 'navigate'
  | 'scroll'
  | 'search'
  | 'search_government'
  | 'open_page'
  | 'open_external'
  | 'highlight'
  | 'read_content'
  | 'read_form'
  | 'fill_field'
  | 'clear_field'
  | 'select_option'
  | 'click_action'
  | 'submit_form'
  | 'open_modal'
  | 'close_modal'
  | 'show_source'
  | 'ask_confirmation'
  | 'get_ui_state'
  | 'get_scheme_details'
  | 'search_scheme'
  | 'navigate_to_scheme'
  | 'get_crop_calendar'
  | 'get_agriculture_news'
  | 'get_myscheme_results'
  | 'go_back'
  | 'go_forward'
  | 'refresh_page';

// ── Agent Action (structured, no arbitrary code) ─────────────
export interface AgentAction {
  /** Unique action ID for audit trail */
  actionId: string;
  /** Action type from controlled enum */
  type: ActionType;
  /** Permission level required */
  permissionLevel: PermissionLevel;
  /** Human-readable reason for audit + user display */
  reason: string;
  /** Action-specific parameters (validated, not arbitrary) */
  params: Record<string, unknown>;
  /** Session / task correlation */
  sessionId: string;
  taskId?: string;
  stepIndex?: number;
  timestamp: number;
}

// ── Task Planning ────────────────────────────────────────────
export type TaskStepStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped' | 'waiting_confirmation';

export interface TaskStep {
  stepIndex: number;
  label: string;
  labelHi?: string;   // Hindi label for display
  action: ActionType;
  params: Record<string, unknown>;
  permissionLevel: PermissionLevel;
  status: TaskStepStatus;
  result?: unknown;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AgentTask {
  taskId: string;
  sessionId: string;
  intent: string;
  intentLanguage?: string;
  steps: TaskStep[];
  currentStepIndex: number;
  status: 'planning' | 'executing' | 'waiting_confirmation' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  /** The step index that triggered a confirmation request */
  pendingConfirmationStep?: number;
}

// ── Confirmation Request ─────────────────────────────────────
export interface ConfirmationRequest {
  confirmationId: string;
  sessionId: string;
  taskId?: string;
  stepIndex?: number;
  actionType: ActionType;
  /** Plain-language message shown to user before they confirm */
  message: string;
  messageHi?: string;   // Hindi version
  /** Summary of what will happen if confirmed */
  summary?: string;
  /** Data to be submitted / used — shown in review screen */
  reviewData?: Record<string, string>;
  createdAt: number;
  expiresAt: number;   // Auto-expire after 120 seconds
}

export type ConfirmationResponse = 'confirmed' | 'denied';

// ── Task Memory ───────────────────────────────────────────────
export interface UserContext {
  name?: string;
  state?: string;
  district?: string;
  occupation?: string;
  crops?: string[];
  landSize?: string;
  language?: string;
  languageCode?: string;
  category?: string; // SC/ST/OBC/General/EWS
}

export interface AgentTaskMemory {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  /** Accumulated user context across turns */
  userContext: UserContext;
  /** Currently active task */
  currentTask?: AgentTask;
  /** Recently viewed scheme IDs this session */
  recentSchemes: string[];
  /** Recent search queries this session */
  recentSearches: string[];
  /** Last government information sources retrieved */
  lastSources: SourceAttribution[];
  /** Pending confirmation request awaiting user response */
  pendingConfirmation?: ConfirmationRequest;
}

// ── Source Attribution ────────────────────────────────────────
export interface SourceAttribution {
  title: string;
  url: string;
  domain: string;
  isOfficialGov: boolean;
  retrievedAt: number;
  /** ISO date string for display */
  retrievedAtDisplay: string;
  confidence?: 'high' | 'medium' | 'low';
  status?: 'current' | 'cached' | 'unavailable';
}

// ── Tool Registry Entry ───────────────────────────────────────
export interface ToolRegistryEntry {
  name: string;
  description: string;
  descriptionHi?: string;
  permissionLevel: PermissionLevel;
  /** Requires explicit user confirmation before execution? */
  requiresConfirmation: boolean;
  /** Should be logged to audit trail? */
  auditLog: boolean;
  /** Parameter validation schema (simple key→type map) */
  paramSchema: Record<string, { type: string; required: boolean; description: string }>;
}

// ── Audit Log Entry ───────────────────────────────────────────
export interface AuditEntry {
  entryId: string;
  sessionId: string;
  taskId?: string;
  timestamp: number;
  tool: string;
  actionType: ActionType;
  permissionLevel: PermissionLevel;
  params: Record<string, unknown>;
  /** Was user confirmation obtained? */
  confirmedByUser?: boolean;
  result?: 'success' | 'failure' | 'denied';
  errorMessage?: string;
  ipAddress?: string;
}

// ── UI State (client reports to agent) ──────────────────────
export interface UIState {
  route: string;
  pageName: string;
  activeTab?: string;
  openModal?: string;
  visibleSections: string[];
  visibleActions: string[];
  currentFormId?: string;
  formFields?: FormFieldState[];
  isLoading: boolean;
  hasError: boolean;
  timestamp: number;
}

export interface FormFieldState {
  fieldId: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'file';
  currentValue?: string;
  required: boolean;
  hasValidationError: boolean;
  options?: string[];
}

// ── Government Search Request / Response ─────────────────────
export interface GovSearchRequest {
  query: string;
  state?: string;
  language?: string;
  category?: 'scheme' | 'news' | 'certificate' | 'agriculture' | 'scholarship';
  limit?: number;
}

export interface GovSearchResultItem {
  title: string;
  description: string;
  source: string;
  url: string;
  domain: string;
  isOfficialGov: boolean;
  lastChecked: string;
  relevance: number;
  category?: string;
}

export interface GovSearchResponse {
  query: string;
  results: GovSearchResultItem[];
  summary: string;
  sources: SourceAttribution[];
  retrievedAt: number;
  warning?: string;
}
