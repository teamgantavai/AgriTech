// ============================================================
// Audit Logger — Immutable action audit trail
// In-memory with optional file persistence
// Branch: agent-control
// ============================================================

import fs from 'fs';
import path from 'path';
import type { AuditEntry, ActionType, PermissionLevel } from './agentTypes';

const AUDIT_LOG_PATH = path.resolve(process.cwd(), 'logs', 'agent_audit.jsonl');

class AuditLogger {
  private entries: AuditEntry[] = [];
  private logToFile: boolean;

  constructor() {
    this.logToFile = process.env.AUDIT_LOG_FILE === 'true';
    if (this.logToFile) {
      // Ensure logs directory exists
      const logsDir = path.dirname(AUDIT_LOG_PATH);
      if (!fs.existsSync(logsDir)) {
        try { fs.mkdirSync(logsDir, { recursive: true }); } catch { /* ignore */ }
      }
    }
  }

  private createEntry(
    sessionId: string,
    tool: string,
    actionType: ActionType,
    permissionLevel: PermissionLevel,
    params: Record<string, unknown>,
    extra: Partial<AuditEntry> = {}
  ): AuditEntry {
    const entry: AuditEntry = {
      entryId: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sessionId,
      timestamp: Date.now(),
      tool,
      actionType,
      permissionLevel,
      params: this.sanitizeParamsForLog(params),
      ...extra,
    };
    return entry;
  }

  /**
   * Remove sensitive fields from params before logging.
   */
  private sanitizeParamsForLog(params: Record<string, unknown>): Record<string, unknown> {
    const SENSITIVE_KEYS = ['password', 'otp', 'pin', 'secret', 'token', 'aadhaar', 'pan', 'account'];
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private persist(entry: AuditEntry): void {
    this.entries.push(entry);
    // Keep last 1000 entries in memory
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-1000);
    }
    if (this.logToFile) {
      try {
        fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
      } catch {
        // Non-fatal — logging failure should not break the application
      }
    }
    console.log(`[Audit] ${entry.result?.toUpperCase() || 'LOG'} | ${entry.tool} | session=${entry.sessionId.slice(0, 8)} | ${JSON.stringify(entry.params).slice(0, 120)}`);
  }

  logSuccess(
    sessionId: string,
    tool: string,
    actionType: ActionType,
    permissionLevel: PermissionLevel,
    params: Record<string, unknown>,
    confirmedByUser?: boolean
  ): void {
    const entry = this.createEntry(sessionId, tool, actionType, permissionLevel, params, {
      result: 'success',
      confirmedByUser,
    });
    this.persist(entry);
  }

  logFailure(
    sessionId: string,
    tool: string,
    actionType: ActionType,
    permissionLevel: PermissionLevel,
    params: Record<string, unknown>,
    errorMessage: string
  ): void {
    const entry = this.createEntry(sessionId, tool, actionType, permissionLevel, params, {
      result: 'failure',
      errorMessage,
    });
    this.persist(entry);
  }

  logDenied(
    sessionId: string,
    actionType: ActionType,
    reason: string
  ): void {
    const entry = this.createEntry(sessionId, 'permission_check', actionType, 'SAFE' as PermissionLevel, {}, {
      result: 'denied',
      errorMessage: reason,
    });
    this.persist(entry);
  }

  logConfirmationRequested(
    sessionId: string,
    actionType: ActionType,
    confirmationId: string
  ): void {
    const entry = this.createEntry(
      sessionId,
      'confirmation_request',
      actionType,
      'CONSEQUENTIAL' as PermissionLevel,
      { confirmationId },
      { result: 'success' }
    );
    this.persist(entry);
  }

  getEntriesForSession(sessionId: string): AuditEntry[] {
    return this.entries.filter((e) => e.sessionId === sessionId);
  }

  getStats(): { total: number; byResult: Record<string, number> } {
    const byResult: Record<string, number> = {};
    for (const e of this.entries) {
      const r = e.result || 'unknown';
      byResult[r] = (byResult[r] || 0) + 1;
    }
    return { total: this.entries.length, byResult };
  }
}

// Singleton
export const auditLogger = new AuditLogger();
