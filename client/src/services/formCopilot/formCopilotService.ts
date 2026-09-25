// ================================================================
// formCopilotService.ts — Client-side service for Form Copilot backend API
// Communicates with the real isolated Playwright session on the server
// ================================================================

const API_BASE = import.meta.env.VITE_API_URL ? (import.meta.env.VITE_API_URL as string).replace(/\/$/, '') : '';

export type PortalStatus = 'supported' | 'coming_soon' | 'guidance_mode';
export type PortalMode = 'browser_assist' | 'guidance';

export interface PortalInfo {
  id: string;
  name: string;
  nameHi: string;
  officialDomain: string;
  officialUrl: string;
  category: string;
  categoryIcon: string;
  description: string;
  descriptionHi: string;
  mode: PortalMode;
  status: PortalStatus;
  capabilities: {
    formInspection: boolean;
    fieldFilling: boolean;
    documentUpload: boolean;
    multiPage: boolean;
  };
  loginUrl?: string;
  applicationUrl?: string;
}

export type SessionState =
  | 'CREATING'
  | 'READY'
  | 'NAVIGATING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'WAITING_FOR_USER'
  | 'CLOSED'
  | 'ERROR'
  | 'GUIDANCE_MODE'
  | 'FILLING'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTING'
  | 'COMPLETED';

export type FieldStatus = 'CONFIRMED' | 'UNCONFIRMED' | 'SENSITIVE' | 'DOCUMENT_DERIVED' | 'MISSING' | 'USER_MODIFIED';

export interface PageDetectionState {
  portal: string;
  currentStep: string;
  pageTitle: string;
  formDetected: boolean;
  loginRequired: boolean;
  captchaDetected: boolean;
  otpRequired: boolean;
  userActionRequired: boolean;
}

export interface MappedField {
  fieldId: string;
  label: string;
  type: string;
  stepIndex: number;
  profileKey?: string;
  resolvedValue?: string;
  displayValue: string;
  status: FieldStatus;
  source: 'profile' | 'document' | 'user_input' | 'empty';
  sourceLabel: string;
  confidence: number;
  isUserModified: boolean;
}

export interface FillingProgress {
  fieldId: string;
  label: string;
  status: 'pending' | 'filling' | 'done' | 'skipped' | 'user_modified' | 'error';
  displayValue?: string;
}

export interface SecurityStop {
  type: string;
  title: string;
  message: string;
  resumeLabel: string;
}

export interface SessionSnapshot {
  sessionId: string;
  state: SessionState;
  portalId: string | null;
  portal: PortalInfo | null;
  currentUrl: string;
  pageTitle: string;
  screenshotBase64: string | null;
  pageDetection: PageDetectionState;
  inspectedFields: any[];
  mappedFields: MappedField[];
  fillingProgress: FillingProgress[];
  currentlyFillingFieldId: string | null;
  securityStop: SecurityStop | null;
  error: string | null;
  guidanceSteps: string[];
  totalFieldsCount: number;
  completedFieldsCount: number;
  userControlActive: boolean;
  actionQueueLength: number;
  submissionResult: {
    referenceNumber?: string;
    message: string;
    url?: string;
  } | null;
}

// ── Portal Registry ───────────────────────────────────────────

export async function fetchPortals(): Promise<PortalInfo[]> {
  const res = await fetch(`${API_BASE}/api/form-copilot/portals`);
  if (!res.ok) throw new Error('Failed to fetch portals');
  const data = await res.json();
  return data.portals;
}

// ── Session Lifecycle ─────────────────────────────────────────

export async function startBrowserSession(
  portalId: string,
  profileData: Record<string, string>
): Promise<{ sessionId: string; portal: Partial<PortalInfo> }> {
  const res = await fetch(`${API_BASE}/api/form-copilot/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portalId, profileData }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start browser session');
  }
  return res.json();
}

export async function getSnapshot(sessionId: string): Promise<SessionSnapshot> {
  const res = await fetch(`${API_BASE}/api/form-copilot/session/${sessionId}/snapshot`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Session not found or expired');
  }
  return res.json();
}

export async function sendSessionAction(
  sessionId: string,
  action: string,
  extra?: Record<string, any>
): Promise<{ success: boolean; snapshot?: SessionSnapshot }> {
  const res = await fetch(`${API_BASE}/api/form-copilot/session/${sessionId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Action failed');
  }
  return res.json();
}

export async function destroySession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/api/form-copilot/session/${sessionId}`, { method: 'DELETE' }).catch(() => {});
}

// ── Controlled Browser Interaction Helpers ────────────────────

export async function inspectFormSession(sessionId: string) {
  return sendSessionAction(sessionId, 'inspect_form');
}

export async function startFillingSession(sessionId: string) {
  return sendSessionAction(sessionId, 'start_filling');
}

export async function pauseSession(sessionId: string) {
  return sendSessionAction(sessionId, 'pause');
}

export async function resumeSession(sessionId: string) {
  return sendSessionAction(sessionId, 'resume');
}

export async function stopSession(sessionId: string) {
  return sendSessionAction(sessionId, 'stop');
}

export async function scrollSession(sessionId: string, deltaY: number) {
  return sendSessionAction(sessionId, 'scroll', { deltaY });
}

export async function scrollToSession(sessionId: string, y: number) {
  return sendSessionAction(sessionId, 'scroll_to', { y });
}

export async function clickSession(sessionId: string, x: number, y: number) {
  return sendSessionAction(sessionId, 'click', { x, y });
}

export async function dblClickSession(sessionId: string, x: number, y: number) {
  return sendSessionAction(sessionId, 'dblclick', { x, y });
}

export async function typeSession(sessionId: string, text: string) {
  return sendSessionAction(sessionId, 'type', { text });
}

export async function keyPressSession(sessionId: string, key: string) {
  return sendSessionAction(sessionId, 'key_press', { key });
}

export async function reloadSession(sessionId: string) {
  return sendSessionAction(sessionId, 'reload');
}

export async function goBackSession(sessionId: string) {
  return sendSessionAction(sessionId, 'go_back');
}

export async function goForwardSession(sessionId: string) {
  return sendSessionAction(sessionId, 'go_forward');
}

export async function navigateSession(sessionId: string, url: string) {
  return sendSessionAction(sessionId, 'navigate', { url });
}

export async function goToLoginSession(sessionId: string) {
  return sendSessionAction(sessionId, 'go_to_login');
}

export async function goToApplicationSession(sessionId: string) {
  return sendSessionAction(sessionId, 'go_to_application');
}

export async function toggleFullPageSession(sessionId: string, fullPage: boolean) {
  return sendSessionAction(sessionId, 'toggle_full_page', { fullPage });
}

// ── Stream Subscription (SSE with Adaptive Polling Fallback) ───

export function createSnapshotStream(
  sessionId: string,
  onSnapshot: (snap: SessionSnapshot) => void,
  onError?: (err: Error) => void
): () => void {
  let isClosed = false;
  let eventSource: EventSource | null = null;
  let pollTimeout: ReturnType<typeof setTimeout> | null = null;

  // Fallback Polling (polls fast during active states, slower when idle)
  const startPolling = () => {
    if (isClosed) return;

    const poll = async () => {
      if (isClosed) return;
      try {
        const snap = await getSnapshot(sessionId);
        if (isClosed) return;
        onSnapshot(snap);

        if (snap.state === 'CLOSED' || snap.state === 'COMPLETED') {
          return;
        }

        const interval =
          snap.state === 'FILLING' || snap.state === 'NAVIGATING' || snap.state === 'CREATING' ? 800 : 2000;
        pollTimeout = setTimeout(poll, interval);
      } catch (err: any) {
        if (!isClosed) {
          onError?.(err);
          // Only retry if not a 404 session not found
          if (!err?.message?.includes('404') && !err?.message?.includes('not found')) {
            pollTimeout = setTimeout(poll, 3000);
          }
        }
      }
    };

    poll();
  };

  // Try Server-Sent Events first
  try {
    const streamUrl = `${API_BASE}/api/form-copilot/session/${sessionId}/stream`;
    eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      if (isClosed) return;
      try {
        const snap = JSON.parse(event.data);
        onSnapshot(snap);
      } catch {}
    };

    eventSource.onerror = () => {
      if (isClosed) return;
      // Close broken SSE connection and fall back to adaptive polling cleanly
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      startPolling();
    };
  } catch {
    startPolling();
  }

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollTimeout = null;
    }
  };
}

// ── Profile Data Resolver — Least Privilege ───────────────────

const SENSITIVE_FIELDS = new Set(['aadhaar_number', 'bank_account_number', 'bank_ifsc', 'pan_number']);

export function resolveProfileForForm(
  profile: Record<string, any>
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [key, value] of Object.entries(profile || {})) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    if (SENSITIVE_FIELDS.has(key)) continue;

    resolved[key] = String(value).trim();
  }

  return resolved;
}
