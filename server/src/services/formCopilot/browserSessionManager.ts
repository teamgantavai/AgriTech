// ================================================================
// browserSessionManager.ts — Manages per-user isolated BrowserSession instances
// Each session receives an isolated browser context (cookies, localStorage, session)
// ================================================================

import { randomUUID } from 'crypto';
import { BrowserSession, type SessionSnapshot } from './browserSession';

const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes inactivity

interface ManagedSession {
  sessionId: string;
  session: BrowserSession;
  lastActivity: number;
  expiryTimer: ReturnType<typeof setTimeout>;
}

class BrowserSessionManager {
  private sessions: Map<string, ManagedSession> = new Map();

  /**
   * Creates a new isolated BrowserSession with a unique ID and dedicated context.
   */
  async createSession(portalId: string, profileData: Record<string, string> = {}): Promise<{ sessionId: string; session: BrowserSession }> {
    const sessionId = randomUUID();
    const session = new BrowserSession(sessionId);

    const expiryTimer = setTimeout(() => this.destroySession(sessionId), SESSION_EXPIRY_MS);

    this.sessions.set(sessionId, {
      sessionId,
      session,
      lastActivity: Date.now(),
      expiryTimer,
    });

    console.log(`[BrowserSessionManager] Created isolated session ${sessionId} for portal: ${portalId}`);
    return { sessionId, session };
  }

  /**
   * Retrieves an active session and refreshes its inactivity timer.
   */
  getSession(sessionId: string): BrowserSession | null {
    const managed = this.sessions.get(sessionId);
    if (!managed) return null;
    this.refreshExpiry(sessionId);
    return managed.session;
  }

  // Alias for backward compatibility
  get(sessionId: string): BrowserSession | null {
    return this.getSession(sessionId);
  }

  getOrCreate(sessionId: string): BrowserSession {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      this.refreshExpiry(sessionId);
      return existing.session;
    }

    const session = new BrowserSession(sessionId);
    const expiryTimer = setTimeout(() => this.destroySession(sessionId), SESSION_EXPIRY_MS);

    this.sessions.set(sessionId, {
      sessionId,
      session,
      lastActivity: Date.now(),
      expiryTimer,
    });

    return session;
  }

  /**
   * Navigate session to a specific URL
   */
  async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);
    await session.navigate(url);
  }

  /**
   * Pause automation in session
   */
  pauseSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) session.pause();
  }

  /**
   * Resume automation in session
   */
  resumeSession(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) session.resume();
  }

  /**
   * Close and destroy session
   */
  async closeSession(sessionId: string): Promise<void> {
    await this.destroySession(sessionId);
  }

  async destroySession(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;

    clearTimeout(managed.expiryTimer);
    try {
      await managed.session.destroy();
    } catch (err) {
      console.warn(`[BrowserSessionManager] Error destroying session ${sessionId}:`, err);
    }
    this.sessions.delete(sessionId);
    console.log(`[BrowserSessionManager] Session ${sessionId} cleanly destroyed.`);
  }

  private refreshExpiry(sessionId: string): void {
    const managed = this.sessions.get(sessionId);
    if (!managed) return;
    clearTimeout(managed.expiryTimer);
    managed.lastActivity = Date.now();
    managed.expiryTimer = setTimeout(() => this.destroySession(sessionId), SESSION_EXPIRY_MS);
  }

  async destroyAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.destroySession(id);
    }
  }
}

export const browserSessionManager = new BrowserSessionManager();
