// ============================================================
// Agent Controller — Main HTTP API for agent actions
// Routes: POST /api/agent/action, GET /api/agent/state, etc.
// Branch: agent-control
// ============================================================

import { Router, type Request, type Response } from 'express';
import { AgentState, PermissionLevel, type ConfirmationResponse } from './agentTypes';
import { auditLogger } from './auditLogger';
import { taskMemoryStore } from './taskMemory';
import { validateToolCall, getToolEntry } from './toolRegistry';
import { detectAndMaskPII, assessPIISensitivity } from './piiGuard';
import { isTrustedGovDomain } from './trustedDomainRegistry';
import { getAgricultureNews } from './agricultureNewsService';
import { searchWebAndKnowledge } from '../services/internetSearch';

export const agentRouter = Router();

// ── In-memory session consent store (L2 consent granted once per session) ──
const sessionL2Consent = new Map<string, boolean>();

// ── Agent state per session ───────────────────────────────────
const sessionAgentState = new Map<string, AgentState>();

function getAgentState(sessionId: string): AgentState {
  return sessionAgentState.get(sessionId) ?? AgentState.IDLE;
}
function setAgentState(sessionId: string, state: AgentState): void {
  sessionAgentState.set(sessionId, state);
}

// ── Helper: generate unique IDs ───────────────────────────────
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Rate limiting (simple in-memory) ─────────────────────────
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per minute per session
const RATE_WINDOW_MS = 60_000;

function isRateLimited(sessionId: string): boolean {
  const now = Date.now();
  const entry = requestCounts.get(sessionId);
  if (!entry || now > entry.resetAt) {
    requestCounts.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// ══════════════════════════════════════════════════════════════
// POST /api/agent/action
// Execute a controlled agent action
// ══════════════════════════════════════════════════════════════
agentRouter.post('/action', async (req: Request, res: Response) => {
  const { sessionId, tool, params = {}, taskId, stepIndex } = req.body as {
    sessionId: string;
    tool: string;
    params?: Record<string, unknown>;
    taskId?: string;
    stepIndex?: number;
  };

  const sessionIdStr = String(sessionId || '');
  const toolStr = String(tool || '');

  if (!sessionIdStr || !toolStr) {
    return res.status(400).json({ error: 'sessionId and tool are required' });
  }

  if (isRateLimited(sessionIdStr)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please slow down.' });
  }

  // 1. Validate tool exists in registry
  const validationError = validateToolCall(toolStr, params);
  if (validationError) {
    auditLogger.logDenied(sessionIdStr, toolStr as any, validationError);
    return res.status(400).json({ error: validationError });
  }

  const toolEntry = getToolEntry(toolStr)!;

  // 2. PII check on params
  const paramStr = JSON.stringify(params);
  const piiAssessment = assessPIISensitivity(paramStr);
  if (piiAssessment.shouldBlock) {
    return res.status(400).json({
      error: 'Sensitive information detected in parameters.',
      warning: piiAssessment.warning,
      types: piiAssessment.sensitiveTypes,
    });
  }

  // 3. Mask PII in params before processing
  const maskedParamStr = detectAndMaskPII(paramStr).masked;
  const safeParams: Record<string, unknown> = JSON.parse(maskedParamStr);

  // 4. Permission enforcement — based on tool registry permissionLevel
  const sessionConsentedToL2 = sessionL2Consent.get(sessionIdStr) ?? false;
  const { permissionLevel, requiresConfirmation } = toolEntry;

  let permAllowed = false;
  let needsConfirmation = false;
  let confirmationRequest: import('./agentTypes').ConfirmationRequest | undefined;

  if (permissionLevel === PermissionLevel.SAFE) {
    permAllowed = true;
  } else if (permissionLevel === PermissionLevel.USER_DATA) {
    if (sessionConsentedToL2 && !requiresConfirmation) {
      permAllowed = true;
    } else {
      needsConfirmation = true;
    }
  } else if (permissionLevel === PermissionLevel.CONSEQUENTIAL) {
    // Always require explicit confirmation
    needsConfirmation = true;
  }

  if (needsConfirmation) {
    const isConsequential = permissionLevel === PermissionLevel.CONSEQUENTIAL;
    confirmationRequest = {
      confirmationId: `confirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId: sessionIdStr,
      taskId,
      stepIndex,
      actionType: toolStr as any,
      message: `I need to ${toolEntry.description.toLowerCase()}. Do you confirm?`,
      messageHi: isConsequential
        ? 'यह एक महत्वपूर्ण कार्य है। क्या आप पुष्टि करते हैं?'
        : 'मुझे आपकी व्यक्तिगत जानकारी भरनी है। क्या यह ठीक है?',
      reviewData: safeParams as Record<string, string>,
      createdAt: Date.now(),
      expiresAt: Date.now() + 120_000,
    };
  }

  // 5. If needs confirmation — pause and return confirmation request
  if (needsConfirmation && confirmationRequest) {
    setAgentState(sessionIdStr, AgentState.WAITING_FOR_CONFIRMATION);
    taskMemoryStore.setPendingConfirmation(sessionIdStr, confirmationRequest);
    auditLogger.logConfirmationRequested(sessionIdStr, toolStr as any, confirmationRequest.confirmationId);

    return res.json({
      status: 'needs_confirmation',
      agentState: AgentState.WAITING_FOR_CONFIRMATION,
      confirmation: confirmationRequest,
    });
  }

  // 6. If not allowed
  if (!permAllowed) {
    auditLogger.logDenied(sessionIdStr, toolStr as any, 'Permission denied by policy');
    return res.status(403).json({ error: 'Action not permitted by security policy' });
  }

  // 7. Execute tool
  setAgentState(sessionIdStr, AgentState.EXECUTING);
  try {
    const result = await executeToolAction(toolStr, safeParams, sessionIdStr);

    auditLogger.logSuccess(
      sessionIdStr,
      toolStr,
      toolStr as any,
      toolEntry.permissionLevel,
      safeParams
    );

    setAgentState(sessionIdStr, AgentState.COMPLETED);

    // Track memory
    if (toolStr === 'navigate_to_scheme' && safeParams.schemeId) {
      taskMemoryStore.addRecentScheme(sessionIdStr, String(safeParams.schemeId));
    }
    if (toolStr === 'search_government' && safeParams.query) {
      taskMemoryStore.addRecentSearch(sessionIdStr, String(safeParams.query));
    }

    return res.json({
      status: 'success',
      agentState: AgentState.COMPLETED,
      result,
    });
  } catch (err: any) {
    auditLogger.logFailure(
      sessionIdStr,
      toolStr,
      toolStr as any,
      toolEntry.permissionLevel,
      safeParams,
      err?.message || 'Tool execution failed'
    );
    setAgentState(sessionIdStr, AgentState.FAILED);
    return res.status(500).json({
      status: 'failed',
      agentState: AgentState.FAILED,
      error: err?.message || 'Tool execution failed',
    });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/agent/confirm
// Respond to a pending confirmation request
// ══════════════════════════════════════════════════════════════
agentRouter.post('/confirm', async (req: Request, res: Response) => {
  const { sessionId, confirmationId, response: userResponse } = req.body as {
    sessionId: string;
    confirmationId: string;
    response: ConfirmationResponse;
  };

  if (!sessionId || !confirmationId || !userResponse) {
    return res.status(400).json({ error: 'sessionId, confirmationId, and response are required' });
  }

  const mem = taskMemoryStore.get(sessionId);
  const pending = mem.pendingConfirmation;

  if (!pending || pending.confirmationId !== confirmationId) {
    return res.status(404).json({ error: 'No pending confirmation found for this session' });
  }

  // Check expiry
  if (Date.now() > pending.expiresAt) {
    taskMemoryStore.setPendingConfirmation(sessionId, undefined);
    setAgentState(sessionId, AgentState.IDLE);
    return res.status(410).json({ error: 'Confirmation request has expired. Please start the action again.' });
  }

  // Clear pending
  taskMemoryStore.setPendingConfirmation(sessionId, undefined);

  if (userResponse === 'confirmed') {
    // Grant L2 consent for USER_DATA actions during this session
    const toolEntry = getToolEntry(pending.actionType as string);
    if (toolEntry?.permissionLevel === PermissionLevel.USER_DATA) {
      sessionL2Consent.set(sessionId, true);
    }

    setAgentState(sessionId, AgentState.EXECUTING);
    return res.json({
      status: 'confirmed',
      agentState: AgentState.EXECUTING,
      message: 'User confirmed. Proceeding with action.',
    });
  } else {
    setAgentState(sessionId, AgentState.IDLE);
    return res.json({
      status: 'denied',
      agentState: AgentState.IDLE,
      message: 'Action cancelled by user.',
    });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/agent/state/:sessionId
// Get current agent state for a session
// ══════════════════════════════════════════════════════════════
agentRouter.get('/state/:sessionId', (req: Request, res: Response) => {
  const sessionId = String(req.params.sessionId || '');
  const state = getAgentState(sessionId);
  const mem = taskMemoryStore.get(sessionId);

  return res.json({
    sessionId,
    agentState: state,
    userContext: mem.userContext,
    currentTask: mem.currentTask ? {
      taskId: mem.currentTask.taskId,
      intent: mem.currentTask.intent,
      status: mem.currentTask.status,
      currentStep: mem.currentTask.currentStepIndex,
      totalSteps: mem.currentTask.steps.length,
    } : null,
    pendingConfirmation: mem.pendingConfirmation ? {
      confirmationId: mem.pendingConfirmation.confirmationId,
      actionType: mem.pendingConfirmation.actionType,
      message: mem.pendingConfirmation.message,
      messageHi: mem.pendingConfirmation.messageHi,
      reviewData: mem.pendingConfirmation.reviewData,
    } : null,
    recentSchemes: mem.recentSchemes.slice(0, 5),
  });
});

// ══════════════════════════════════════════════════════════════
// POST /api/agent/memory
// Update task memory (user context from frontend)
// ══════════════════════════════════════════════════════════════
agentRouter.post('/memory', (req: Request, res: Response) => {
  const { sessionId, userContext, recentSchemes, extractFromText } = req.body as {
    sessionId: string;
    userContext?: Record<string, string>;
    recentSchemes?: string[];
    extractFromText?: string;
  };

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  if (userContext) {
    taskMemoryStore.updateUserContext(sessionId, userContext);
  }
  if (recentSchemes?.length) {
    for (const s of recentSchemes) taskMemoryStore.addRecentScheme(sessionId, s);
  }
  if (extractFromText) {
    const extracted = taskMemoryStore.extractAndUpdateContext(sessionId, extractFromText);
    return res.json({ status: 'ok', extracted });
  }

  return res.json({ status: 'ok' });
});

// ══════════════════════════════════════════════════════════════
// GET /api/agent/memory/:sessionId
// Read task memory
// ══════════════════════════════════════════════════════════════
agentRouter.get('/memory/:sessionId', (req: Request, res: Response) => {
  const mem = taskMemoryStore.get(String(req.params.sessionId || ''));
  return res.json({
    sessionId: mem.sessionId,
    userContext: mem.userContext,
    recentSchemes: mem.recentSchemes,
    recentSearches: mem.recentSearches,
    lastSources: mem.lastSources,
    hasCurrentTask: Boolean(mem.currentTask),
  });
});

// ══════════════════════════════════════════════════════════════
// GET /api/agent/news/agri
// Agriculture news retrieval
// ══════════════════════════════════════════════════════════════
agentRouter.get('/news/agri', async (req: Request, res: Response) => {
  const { state, category, lang } = req.query as Record<string, string>;
  try {
    const news = await getAgricultureNews(state, category, lang || 'hi');
    return res.json(news);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to retrieve agriculture news' });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/agent/search/gov
// Government-restricted search
// ══════════════════════════════════════════════════════════════
agentRouter.post('/search/gov', async (req: Request, res: Response) => {
  const { query, state, category, sessionId } = req.body as {
    query: string;
    state?: string;
    category?: string;
    sessionId?: string;
  };

  if (!query) return res.status(400).json({ error: 'query is required' });

  if (sessionId) taskMemoryStore.addRecentSearch(sessionId, query);

  try {
    const govQuery = `${query}${state ? ` in ${state}` : ''} site:gov.in OR site:nic.in OR site:icar.org.in`;
    const result = await searchWebAndKnowledge(govQuery);

    // Filter to trusted domains only
    const trustedResults = result.results.filter((r) => {
      const { trusted } = isTrustedGovDomain(r.url);
      return trusted || r.url.includes('myscheme.gov.in') || r.url.includes('scholarships.gov.in');
    });

    return res.json({
      query,
      results: trustedResults,
      summary: result.summary,
      sources: result.sources,
      retrievedAt: new Date().toISOString(),
      warning: trustedResults.length === 0
        ? 'Could not verify results from official government sources. Please check directly on gov.in portals.'
        : undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Government search failed' });
  }
});

// ══════════════════════════════════════════════════════════════
// GET /api/agent/audit/:sessionId (admin only)
// ══════════════════════════════════════════════════════════════
agentRouter.get('/audit/:sessionId', (req: Request, res: Response) => {
  // In production: verify admin role here
  const entries = auditLogger.getEntriesForSession(String(req.params.sessionId || ''));
  return res.json({ entries, stats: auditLogger.getStats() });
});

// ══════════════════════════════════════════════════════════════
// Internal: Execute a tool action
// ══════════════════════════════════════════════════════════════
async function executeToolAction(
  tool: string,
  params: Record<string, unknown>,
  sessionId: string
): Promise<unknown> {
  switch (tool) {
    case 'search_government':
    case 'get_myscheme_results': {
      const query = String(params.query || '');
      const state = params.state ? String(params.state) : undefined;
      const govQuery = `${query}${state ? ` ${state}` : ''} site:gov.in OR site:nic.in`;
      const result = await searchWebAndKnowledge(govQuery);
      taskMemoryStore.addRecentSearch(sessionId, query);
      return result;
    }

    case 'get_agriculture_news': {
      const state = params.state ? String(params.state) : undefined;
      const category = params.category ? String(params.category) : undefined;
      return await getAgricultureNews(state, category);
    }

    case 'navigate_to_scheme': {
      const schemeId = String(params.schemeId || '');
      taskMemoryStore.addRecentScheme(sessionId, schemeId);
      // Navigation is handled client-side via AgentBridge
      return { navigated: true, schemeId, clientAction: 'NAVIGATE_TO_SCHEME' };
    }

    case 'open_external_service': {
      const url = String(params.url || '');
      const { trusted, reason } = isTrustedGovDomain(url);
      if (!trusted) {
        throw new Error(`Cannot open external URL: ${reason}`);
      }
      return { url, trusted: true, clientAction: 'OPEN_EXTERNAL', siteName: params.siteName };
    }

    case 'get_ui_state':
    case 'read_visible_content':
    case 'read_form_structure':
    case 'navigate_to_route':
    case 'open_page':
    case 'scroll_to_section':
    case 'highlight_element':
    case 'fill_field':
    case 'clear_field':
    case 'select_option':
    case 'go_back':
    case 'go_forward':
    case 'show_source':
    case 'request_confirmation':
      // These are client-side actions — return the action descriptor
      // The AgentBridge on the client executes these
      return { clientAction: tool.toUpperCase(), params };

    case 'submit_form':
      // Always goes through confirmation — should not reach here without it
      throw new Error('Form submission requires explicit user confirmation first.');

    default:
      throw new Error(`Tool "${tool}" has no server-side executor.`);
  }
}
