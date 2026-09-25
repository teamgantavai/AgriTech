// ============================================================
// Permission Layer — Enforce L1/L2/L3 action permissions
// Branch: agent-control
// ============================================================

import { PermissionLevel, ActionType, type ConfirmationRequest, AgentState } from './agentTypes';
import { auditLogger } from './auditLogger';

export interface PermissionCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
  confirmationRequest?: ConfirmationRequest;
}

/**
 * Static permission table — maps every ActionType to its PermissionLevel.
 * CONSEQUENTIAL actions always require confirmation.
 * USER_DATA actions ask once per session (or per significant action).
 * SAFE actions auto-execute.
 */
const ACTION_PERMISSIONS: Record<ActionType, { level: PermissionLevel; alwaysConfirm: boolean }> = {
  // ── SAFE — auto-execute ────────────────────────────────────
  navigate:              { level: PermissionLevel.SAFE, alwaysConfirm: false },
  open_page:             { level: PermissionLevel.SAFE, alwaysConfirm: false },
  scroll:                { level: PermissionLevel.SAFE, alwaysConfirm: false },
  search:                { level: PermissionLevel.SAFE, alwaysConfirm: false },
  search_government:     { level: PermissionLevel.SAFE, alwaysConfirm: false },
  search_scheme:         { level: PermissionLevel.SAFE, alwaysConfirm: false },
  navigate_to_scheme:    { level: PermissionLevel.SAFE, alwaysConfirm: false },
  highlight:             { level: PermissionLevel.SAFE, alwaysConfirm: false },
  read_content:          { level: PermissionLevel.SAFE, alwaysConfirm: false },
  read_form:             { level: PermissionLevel.SAFE, alwaysConfirm: false },
  get_ui_state:          { level: PermissionLevel.SAFE, alwaysConfirm: false },
  get_scheme_details:    { level: PermissionLevel.SAFE, alwaysConfirm: false },
  get_crop_calendar:     { level: PermissionLevel.SAFE, alwaysConfirm: false },
  get_agriculture_news:  { level: PermissionLevel.SAFE, alwaysConfirm: false },
  get_myscheme_results:  { level: PermissionLevel.SAFE, alwaysConfirm: false },
  go_back:               { level: PermissionLevel.SAFE, alwaysConfirm: false },
  go_forward:            { level: PermissionLevel.SAFE, alwaysConfirm: false },
  refresh_page:          { level: PermissionLevel.SAFE, alwaysConfirm: false },
  close_modal:           { level: PermissionLevel.SAFE, alwaysConfirm: false },
  show_source:           { level: PermissionLevel.SAFE, alwaysConfirm: false },
  ask_confirmation:      { level: PermissionLevel.SAFE, alwaysConfirm: false },

  // ── USER_DATA — ask when filling personal info ─────────────
  fill_field:            { level: PermissionLevel.USER_DATA, alwaysConfirm: false },
  clear_field:           { level: PermissionLevel.USER_DATA, alwaysConfirm: false },
  select_option:         { level: PermissionLevel.USER_DATA, alwaysConfirm: false },
  open_modal:            { level: PermissionLevel.USER_DATA, alwaysConfirm: false },
  open_external:         { level: PermissionLevel.USER_DATA, alwaysConfirm: false },

  // ── CONSEQUENTIAL — ALWAYS require explicit confirmation ────
  submit_form:           { level: PermissionLevel.CONSEQUENTIAL, alwaysConfirm: true },
  click_action:          { level: PermissionLevel.CONSEQUENTIAL, alwaysConfirm: true },
};

/**
 * Check whether an action is permitted given current session state.
 * Session-level L2 consent can be granted once to avoid repeated prompts.
 */
export function checkPermission(
  actionType: ActionType,
  sessionId: string,
  sessionConsentedToL2: boolean,
  options: {
    confirmationMessage?: string;
    confirmationMessageHi?: string;
    reviewData?: Record<string, string>;
    taskId?: string;
    stepIndex?: number;
  } = {}
): PermissionCheckResult {
  const permEntry = ACTION_PERMISSIONS[actionType];
  if (!permEntry) {
    // Unknown actions are blocked
    auditLogger.logDenied(sessionId, actionType as ActionType, 'Unknown action type');
    return { allowed: false, requiresConfirmation: false, reason: `Unknown action: ${actionType}` };
  }

  const { level, alwaysConfirm } = permEntry;

  // SAFE → always allowed
  if (level === PermissionLevel.SAFE) {
    return { allowed: true, requiresConfirmation: false };
  }

  // CONSEQUENTIAL → always require confirmation
  if (level === PermissionLevel.CONSEQUENTIAL || alwaysConfirm) {
    const confirmationRequest: ConfirmationRequest = {
      confirmationId: `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId,
      taskId: options.taskId,
      stepIndex: options.stepIndex,
      actionType,
      message: options.confirmationMessage || getDefaultConfirmationMessage(actionType),
      messageHi: options.confirmationMessageHi || getDefaultConfirmationMessageHi(actionType),
      reviewData: options.reviewData,
      createdAt: Date.now(),
      expiresAt: Date.now() + 120_000, // 2 minutes
    };
    return {
      allowed: false,
      requiresConfirmation: true,
      confirmationRequest,
    };
  }

  // USER_DATA → allowed if session consent given, else ask once
  if (level === PermissionLevel.USER_DATA) {
    if (sessionConsentedToL2) {
      return { allowed: true, requiresConfirmation: false };
    }
    const confirmationRequest: ConfirmationRequest = {
      confirmationId: `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId,
      taskId: options.taskId,
      stepIndex: options.stepIndex,
      actionType,
      message: options.confirmationMessage || getDefaultConfirmationMessage(actionType),
      messageHi: options.confirmationMessageHi || getDefaultConfirmationMessageHi(actionType),
      reviewData: options.reviewData,
      createdAt: Date.now(),
      expiresAt: Date.now() + 120_000,
    };
    return {
      allowed: false,
      requiresConfirmation: true,
      confirmationRequest,
    };
  }

  return { allowed: false, requiresConfirmation: false, reason: 'Permission denied' };
}

function getDefaultConfirmationMessage(actionType: ActionType): string {
  const messages: Partial<Record<ActionType, string>> = {
    submit_form: 'The form is ready. Do you want me to submit it? This action cannot be undone.',
    fill_field: 'I will fill in your personal information. Is that okay?',
    open_external: 'I will open an official government website. Do you want to proceed?',
    click_action: 'I am about to perform an action on your behalf. Please confirm.',
    select_option: 'I will select an option in the form. Should I proceed?',
  };
  return messages[actionType] || 'This action requires your confirmation. Do you want to proceed?';
}

function getDefaultConfirmationMessageHi(actionType: ActionType): string {
  const messages: Partial<Record<ActionType, string>> = {
    submit_form: 'फ़ॉर्म तैयार है। क्या आप इसे जमा करना चाहते हैं? यह क्रिया वापस नहीं होगी।',
    fill_field: 'मैं आपकी व्यक्तिगत जानकारी भरूँगा। क्या यह ठीक है?',
    open_external: 'मैं एक सरकारी वेबसाइट खोलूँगा। क्या आप आगे बढ़ना चाहते हैं?',
    click_action: 'मैं आपकी ओर से एक कार्य करने वाला हूँ। कृपया पुष्टि करें।',
    select_option: 'मैं फ़ॉर्म में एक विकल्प चुनूँगा। क्या मैं आगे बढ़ूँ?',
  };
  return messages[actionType] || 'इस कार्य के लिए आपकी पुष्टि चाहिए। क्या आप आगे बढ़ना चाहते हैं?';
}

export function getActionPermissionLevel(actionType: ActionType): PermissionLevel {
  return ACTION_PERMISSIONS[actionType]?.level ?? PermissionLevel.CONSEQUENTIAL;
}
