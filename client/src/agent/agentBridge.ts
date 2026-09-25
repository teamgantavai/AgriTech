// ============================================================
// Agent Bridge — Frontend ↔ Agent communication layer
// Executes client-side actions dispatched by the agent
// Branch: agent-control
// ============================================================

import { AgentStateMachine, AgentState, type ConfirmationRequest } from './agentStateMachine';
import { eventBus } from '../services/eventBus';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let appNavigator: ((route: string) => void) | null = null;

/**
 * Register React Router's useNavigate function so navigation is instantaneous
 * without causing full page reloads or unmounting persistent overlays.
 */
export function registerAppNavigator(nav: (route: string) => void): () => void {
  appNavigator = nav;
  return () => {
    if (appNavigator === nav) appNavigator = null;
  };
}

export type AgentBridgeEvent =
  | 'navigate'
  | 'open_page'
  | 'scroll_to_section'
  | 'highlight_element'
  | 'fill_field'
  | 'clear_field'
  | 'select_option'
  | 'show_source'
  | 'open_external_service'
  | 'request_confirmation'
  | 'get_ui_state'
  | 'read_visible_content';

export interface AgentBridgeAction {
  type: AgentBridgeEvent;
  params: Record<string, unknown>;
}

/** Custom event dispatched on window for UI to react */
export const AGENT_BRIDGE_EVENT = 'agent:bridge';

export interface AgentBridgePayload {
  action: AgentBridgeAction;
  sessionId: string;
}

// ── UI State (client reports to agent) ───────────────────────
let currentUIState = {
  route: window.location.pathname,
  pageName: document.title,
  activeTab: '',
  visibleSections: [] as string[],
  visibleActions: [] as string[],
  currentFormId: '',
  isLoading: false,
  hasError: false,
};

export function updateUIState(partial: Partial<typeof currentUIState>): void {
  currentUIState = { ...currentUIState, ...partial };
  AgentStateMachine.updateUIState(currentUIState);
  eventBus.emit({
    type: 'UI_STATE_UPDATE',
    route: currentUIState.route,
    title: currentUIState.pageName,
    data: { ...currentUIState },
  });
}

export function getCurrentUIState(): typeof currentUIState {
  return { ...currentUIState };
}

// ── Session ID management ─────────────────────────────────────
function getSessionId(): string {
  let sid = sessionStorage.getItem('agent_session_id');
  if (!sid) {
    sid = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    sessionStorage.setItem('agent_session_id', sid);
  }
  return sid;
}

// ── Execute a client-side agent action ───────────────────────
export function executeClientAction(action: AgentBridgeAction): Record<string, any> {
  const { type, params } = action;

  // Dispatch to UI via custom event — components subscribe to this
  const event = new CustomEvent<AgentBridgePayload>(AGENT_BRIDGE_EVENT, {
    detail: { action, sessionId: getSessionId() },
    bubbles: true,
  });
  window.dispatchEvent(event);

  switch (type) {
    case 'navigate': {
      const route = String(params.route || '/');
      eventBus.emit({
        type: 'NAVIGATION_START',
        route,
        action: 'navigate',
        target: route,
        message: `Navigating to ${route}`,
      });

      if (appNavigator) {
        try {
          appNavigator(route);
        } catch (err) {
          console.warn('[AgentBridge] appNavigator error, fallback to pushState:', err);
          window.history.pushState({}, '', route);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      } else {
        window.history.pushState({}, '', route);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }

      eventBus.emit({
        type: 'NAVIGATION_COMPLETE',
        route,
        action: 'navigate',
        target: route,
        message: `Navigated to ${route}`,
      });
      return { navigated: true, route };
    }


    case 'get_ui_state':
      return getCurrentUIState();

    case 'read_visible_content': {
      const main = document.querySelector('main');
      const text = main?.innerText?.slice(0, 2000) || document.body.innerText.slice(0, 2000);
      return { content: text, route: window.location.pathname };
    }

    case 'scroll_to_section': {
      const sectionId = String(params.sectionId || '');
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return { scrolled: true, sectionId };
      }
      return { scrolled: false, error: `Element not found: ${sectionId}` };
    }

    case 'highlight_element': {
      const elementId = String(params.elementId || '');
      const el = document.getElementById(elementId);
      if (el) {
        el.style.outline = '3px solid #16a34a';
        el.style.outlineOffset = '2px';
        setTimeout(() => {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }, 2500);
        return { highlighted: true };
      }
      return { highlighted: false, error: `Element not found: ${elementId}` };
    }

    case 'fill_field': {
      const fieldId = String(params.fieldId || '');
      const value = String(params.value || '');
      const el = document.getElementById(fieldId) as HTMLInputElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
        // Use React-compatible value setting
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          el.value = value;
        }
        return { filled: true, fieldId, value };
      }
      return { filled: false, error: `Field not found or not fillable: ${fieldId}` };
    }

    case 'clear_field': {
      const fieldId = String(params.fieldId || '');
      const el = document.getElementById(fieldId) as HTMLInputElement | null;
      if (el) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return { cleared: true };
      }
      return { cleared: false, error: `Field not found: ${fieldId}` };
    }

    case 'select_option': {
      const fieldId = String(params.fieldId || '');
      const value = String(params.value || '');
      const el = document.getElementById(fieldId) as HTMLSelectElement | null;
      if (el && el.tagName === 'SELECT') {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { selected: true, value };
      }
      return { selected: false, error: `Select field not found: ${fieldId}` };
    }

    default:
      // Other actions (show_source, open_external, etc.) are handled by UI components
      return { dispatched: true, type };
  }
}

// ── Server-side tool execution via agent API ──────────────────
export async function callAgentAction(
  tool: string,
  params: Record<string, unknown>
): Promise<Record<string, any>> {
  const sessionId = getSessionId();
  AgentStateMachine.transition(AgentState.EXECUTING);

  try {
    const response = await fetch(`${API_BASE}/api/agent/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, tool, params }),
    });

    const data = await response.json();

    if (data.status === 'needs_confirmation') {
      // Agent needs user confirmation — update state machine
      AgentStateMachine.setConfirmation(data.confirmation as ConfirmationRequest);
      return data;
    }

    if (!response.ok || data.status === 'failed') {
      AgentStateMachine.forceTransition(AgentState.FAILED);
      return { error: data.error || 'Agent action failed' };
    }

    AgentStateMachine.forceTransition(AgentState.COMPLETED);

    // Handle client-side actions from server response
    if (data.result?.clientAction) {
      return executeClientAction({
        type: data.result.clientAction.toLowerCase() as AgentBridgeEvent,
        params: data.result.params || data.result,
      });
    }

    return data.result;
  } catch (err: any) {
    AgentStateMachine.forceTransition(AgentState.FAILED);
    return { error: err?.message || 'Network error' };
  }
}

// ── Confirm or deny a pending confirmation ───────────────────
export async function respondToConfirmation(
  confirmationId: string,
  response: 'confirmed' | 'denied'
): Promise<void> {
  const sessionId = getSessionId();
  AgentStateMachine.clearConfirmation();

  try {
    await fetch(`${API_BASE}/api/agent/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, confirmationId, response }),
    });
  } catch (err) {
    console.error('[AgentBridge] Confirmation response failed:', err);
  }

  if (response === 'confirmed') {
    AgentStateMachine.forceTransition(AgentState.EXECUTING);
  } else {
    AgentStateMachine.forceTransition(AgentState.IDLE);
  }
}

// ── Sync UI state to agent memory ────────────────────────────
export async function syncToAgentMemory(
  data: { userContext?: Record<string, string>; extractFromText?: string }
): Promise<void> {
  const sessionId = getSessionId();
  try {
    await fetch(`${API_BASE}/api/agent/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...data }),
    });
  } catch {
    // Non-fatal
  }
}

export { getSessionId };
