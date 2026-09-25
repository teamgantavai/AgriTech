// ============================================================
// Task Memory — In-memory session task memory store
// Short-term: lives for the duration of the session only
// Branch: agent-control
// ============================================================

import type { AgentTaskMemory, UserContext, AgentTask, ConfirmationRequest, SourceAttribution } from './agentTypes';

const DEFAULT_MEMORY = (): AgentTaskMemory => ({
  sessionId: '',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  userContext: {},
  recentSchemes: [],
  recentSearches: [],
  lastSources: [],
  pendingConfirmation: undefined,
});

class TaskMemoryStore {
  private store: Map<string, AgentTaskMemory> = new Map();
  private readonly MAX_SESSIONS = 500;
  private readonly TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

  private evict(): void {
    const now = Date.now();
    for (const [sid, mem] of this.store) {
      if (now - mem.updatedAt > this.TTL_MS) {
        this.store.delete(sid);
      }
    }
    // Hard cap
    if (this.store.size > this.MAX_SESSIONS) {
      const oldest = [...this.store.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
      for (const [sid] of oldest.slice(0, 50)) {
        this.store.delete(sid);
      }
    }
  }

  get(sessionId: string): AgentTaskMemory {
    this.evict();
    if (!this.store.has(sessionId)) {
      const mem = { ...DEFAULT_MEMORY(), sessionId };
      this.store.set(sessionId, mem);
    }
    return this.store.get(sessionId)!;
  }

  update(sessionId: string, partial: Partial<AgentTaskMemory>): AgentTaskMemory {
    const current = this.get(sessionId);
    const updated: AgentTaskMemory = {
      ...current,
      ...partial,
      sessionId,
      updatedAt: Date.now(),
    };
    this.store.set(sessionId, updated);
    return updated;
  }

  updateUserContext(sessionId: string, ctx: Partial<UserContext>): AgentTaskMemory {
    const current = this.get(sessionId);
    return this.update(sessionId, {
      userContext: { ...current.userContext, ...ctx },
    });
  }

  setCurrentTask(sessionId: string, task: AgentTask): AgentTaskMemory {
    return this.update(sessionId, { currentTask: task });
  }

  setPendingConfirmation(sessionId: string, req: ConfirmationRequest | undefined): AgentTaskMemory {
    return this.update(sessionId, { pendingConfirmation: req });
  }

  addRecentScheme(sessionId: string, schemeId: string): void {
    const mem = this.get(sessionId);
    const updated = [schemeId, ...mem.recentSchemes.filter((s) => s !== schemeId)].slice(0, 10);
    this.update(sessionId, { recentSchemes: updated });
  }

  addRecentSearch(sessionId: string, query: string): void {
    const mem = this.get(sessionId);
    const updated = [query, ...mem.recentSearches.filter((q) => q !== query)].slice(0, 20);
    this.update(sessionId, { recentSearches: updated });
  }

  addSources(sessionId: string, sources: SourceAttribution[]): void {
    const mem = this.get(sessionId);
    const allSources = [...sources, ...mem.lastSources];
    // Deduplicate by URL
    const seen = new Set<string>();
    const deduped = allSources.filter((s) => {
      if (seen.has(s.url)) return false;
      seen.add(s.url);
      return true;
    });
    this.update(sessionId, { lastSources: deduped.slice(0, 10) });
  }

  clear(sessionId: string): void {
    this.store.delete(sessionId);
  }

  /**
   * Extract user context mentions from natural language text.
   * Supplements the LLM's own context extraction.
   */
  extractAndUpdateContext(sessionId: string, text: string): Partial<UserContext> {
    const extracted: Partial<UserContext> = {};

    // State detection (Indian states)
    const STATES = [
      'Punjab', 'Haryana', 'Rajasthan', 'UP', 'Uttar Pradesh', 'Bihar',
      'Maharashtra', 'Gujarat', 'Madhya Pradesh', 'MP', 'Karnataka',
      'Telangana', 'Andhra Pradesh', 'Tamil Nadu', 'Kerala', 'West Bengal',
      'Odisha', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand', 'Himachal Pradesh',
      'HP', 'Assam', 'Goa', 'Delhi', 'Jammu', 'J&K',
    ];
    for (const state of STATES) {
      if (text.toLowerCase().includes(state.toLowerCase())) {
        extracted.state = state;
        break;
      }
    }

    // Occupation detection
    if (/kisan|farmer|खेती|किसान|ਕਿਸਾਨ/i.test(text)) extracted.occupation = 'farmer';
    if (/student|छात्र|विद्यार्थी|ਵਿਦਿਆਰਥੀ/i.test(text)) extracted.occupation = 'student';
    if (/shopkeeper|व्यापारी|दुकान|ਦੁਕਾਨਦਾਰ/i.test(text)) extracted.occupation = 'shopkeeper';

    // Name extraction (simple heuristic — agent LLM handles complex cases)
    const nameMatch = text.match(/(?:my name is|naam|mera naam|मेरा नाम|ਮੇਰਾ ਨਾਮ)\s+([A-Za-z\u0900-\u097F\u0A00-\u0A7F]+(?:\s+[A-Za-z\u0900-\u097F\u0A00-\u0A7F]+)?)/i);
    if (nameMatch) extracted.name = nameMatch[1].trim();

    if (Object.keys(extracted).length > 0) {
      this.updateUserContext(sessionId, extracted);
    }
    return extracted;
  }
}

// Singleton
export const taskMemoryStore = new TaskMemoryStore();
