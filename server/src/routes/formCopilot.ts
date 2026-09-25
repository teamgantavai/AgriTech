// ================================================================
// formCopilotRouter.ts — HTTP & Streaming endpoints for real browser session
// Provides: session start, action controls, and live SSE stream
// ================================================================

import { Router, type Request, type Response } from 'express';
import { browserSessionManager } from '../services/formCopilot/browserSessionManager';
import { governmentPortalRegistry } from '../services/formCopilot/governmentPortalRegistry';

export const formCopilotRouter = Router();

// ── GET /api/form-copilot/portals ─────────────────────────────
formCopilotRouter.get('/portals', (_req: Request, res: Response) => {
  const portals = governmentPortalRegistry.getAll().map((p) => ({
    id: p.id,
    name: p.name,
    nameHi: p.nameHi,
    officialDomain: p.officialDomain,
    officialUrl: p.officialUrl,
    category: p.category,
    categoryIcon: p.categoryIcon,
    description: p.description,
    descriptionHi: p.descriptionHi,
    mode: p.mode,
    status: p.status,
    capabilities: p.capabilities,
    loginUrl: p.loginUrl,
    applicationUrl: p.applicationUrl,
  }));
  res.json({ portals });
});

// ── POST /api/form-copilot/session/start ──────────────────────
formCopilotRouter.post('/session/start', async (req: Request, res: Response) => {
  try {
    const { portalId, profileData } = req.body as {
      portalId: string;
      profileData?: Record<string, string>;
    };

    if (!portalId) {
      res.status(400).json({ error: 'portalId is required' });
      return;
    }

    const portal = governmentPortalRegistry.getById(portalId);
    if (!portal) {
      res.status(404).json({ error: `Portal "${portalId}" is not in the verified government registry.` });
      return;
    }

    // Create an isolated session
    const { sessionId, session } = await browserSessionManager.createSession(portalId, profileData || {});

    // Begin opening the official government portal
    session.openPortal(portalId, profileData || {}).catch((err) => {
      console.error('[FormCopilot] openPortal error:', err);
    });

    res.json({
      sessionId,
      portal: {
        id: portal.id,
        name: portal.name,
        officialDomain: portal.officialDomain,
        officialUrl: portal.officialUrl,
        mode: portal.mode,
        status: portal.status,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to start browser session' });
  }
});

// ── GET /api/form-copilot/session/:sessionId/snapshot ──────────
formCopilotRouter.get('/session/:sessionId/snapshot', (req: Request<{ sessionId: string }>, res: Response) => {
  const session = browserSessionManager.getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired', sessionId: req.params.sessionId });
    return;
  }
  res.json(session.getSnapshot());
});

// ── POST /api/form-copilot/session/:sessionId/action ─────────
formCopilotRouter.post('/session/:sessionId/action', async (req: Request<{ sessionId: string }>, res: Response) => {
  try {
    const session = browserSessionManager.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found or expired', sessionId: req.params.sessionId });
      return;
    }

    const body = req.body || {};
    const { action } = body;

    switch (action) {
      case 'inspect_form':
        await session.inspectRealForm();
        break;
      case 'start_filling':
        session.startFilling().catch(console.error);
        break;
      case 'pause':
        session.pause();
        break;
      case 'resume':
        session.resume();
        break;
      case 'stop':
        session.stop();
        break;
      case 'resume_after_user':
        await session.resumeAfterUserAction();
        break;
      case 'submit':
        session.submitApplication().catch(console.error);
        break;
      case 'field_user_modified':
        if (body.fieldId) session.handleUserModifiedField(body.fieldId);
        break;
      case 'click':
        if (typeof body.x === 'number' && typeof body.y === 'number') {
          await session.userClick(body.x, body.y);
        }
        break;
      case 'dblclick':
        if (typeof body.x === 'number' && typeof body.y === 'number') {
          await session.userDblClick(body.x, body.y);
        }
        break;
      case 'scroll':
        if (typeof body.deltaY === 'number') {
          await session.userScroll(body.deltaY);
        }
        break;
      case 'scroll_to':
        if (typeof body.y === 'number') {
          await session.userScrollTo(body.y);
        }
        break;
      case 'type':
        if (typeof body.text === 'string') {
          await session.userType(body.text);
        }
        break;
      case 'key_press':
        if (typeof body.key === 'string') {
          await session.userKeyPress(body.key);
        }
        break;
      case 'navigate':
        if (typeof body.url === 'string') {
          await session.navigate(body.url);
        }
        break;
      case 'go_back':
        await session.goBack();
        break;
      case 'go_forward':
        await session.goForward();
        break;
      case 'reload':
        await session.reload();
        break;
      case 'go_to_login':
        await session.goToLogin();
        break;
      case 'go_to_application':
        await session.goToApplication();
        break;
      case 'toggle_full_page':
        if (typeof body.fullPage === 'boolean') {
          session.setCaptureMode(body.fullPage);
        }
        break;
      case 'destroy':
        await browserSessionManager.destroySession(req.params.sessionId);
        res.json({ success: true });
        return;
      default:
        res.status(400).json({ error: `Unknown action: ${action}` });
        return;
    }

    res.json({ success: true, snapshot: session.getSnapshot() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Action failed' });
  }
});

// ── GET /api/form-copilot/session/:sessionId/stream ──────────
// Server-Sent Events stream with heartbeat pings and auto-snapshot emission
formCopilotRouter.get('/session/:sessionId/stream', (req: Request<{ sessionId: string }>, res: Response) => {
  const session = browserSessionManager.getSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found or expired', sessionId: req.params.sessionId });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendSnapshot = (snapshot: any) => {
    try {
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch {}
  };

  // 1. Send initial snapshot immediately
  sendSnapshot(session.getSnapshot());

  // 2. Subscribe to session events (clicks, scrolls, navigation, filling)
  const unsub = session.subscribe((snapshot) => {
    sendSnapshot(snapshot);
  });

  // 3. Heartbeat ping every 15s to keep proxy connection alive
  const pingTimer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {}
  }, 15000);

  // 4. Background screenshot check for smooth visual stream
  const pollTimer = setInterval(() => {
    const snap = session.getSnapshot();
    if (snap.screenshotBase64) {
      sendSnapshot(snap);
    }
  }, 1000);

  req.on('close', () => {
    unsub();
    clearInterval(pingTimer);
    clearInterval(pollTimer);
  });
});

// ── DELETE /api/form-copilot/session/:sessionId ──────────────
formCopilotRouter.delete('/session/:sessionId', async (req: Request<{ sessionId: string }>, res: Response) => {
  await browserSessionManager.destroySession(req.params.sessionId);
  res.json({ success: true });
});
