// ============================================================
// conversationStore.ts — localStorage-based conversation persistence
// ============================================================

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  suggestions?: string[];
  isStreaming?: boolean;
  language?: string;
  clientMessageId?: string;
  conversationId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessageRecord[];
}

const STORAGE_KEY = 'gram_sathi_conversations';
const ACTIVE_CONV_KEY = 'gram_sathi_active_conv_id';
const MAX_CONVERSATIONS = 50;

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadAll(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Conversation[];
    // Ensure conversations have unique IDs
    const seen = new Set<string>();
    return list.filter((c) => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  } catch {
    return [];
  }
}

function saveAll(conversations: Conversation[]): void {
  try {
    // Keep only the most recent MAX_CONVERSATIONS
    const trimmed = conversations
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_CONVERSATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable or quota exceeded — continue without persistence
  }
}

/** Get the last active conversation ID stored in session */
export function getLastActiveConversationId(): string | null {
  try {
    const id = sessionStorage.getItem(ACTIVE_CONV_KEY);
    if (id && getConversation(id)) return id;
    const recent = listConversations();
    // Return most recent with messages
    const withMsgs = recent.find((c) => c.messages.length > 0);
    return withMsgs ? withMsgs.id : null;
  } catch {
    return null;
  }
}

/** Persist the active conversation ID in session */
export function setLastActiveConversationId(id: string | null): void {
  try {
    if (id) {
      sessionStorage.setItem(ACTIVE_CONV_KEY, id);
    } else {
      sessionStorage.removeItem(ACTIVE_CONV_KEY);
    }
  } catch {}
}

/** List all conversations with messages, sorted by most recently updated */
export function listConversations(): Conversation[] {
  return loadAll()
    .filter(c => c.messages && c.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Create a new empty conversation */
export function createConversation(customId?: string): Conversation {
  const conv: Conversation = {
    id: customId || generateId(),
    title: 'New Conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  const all = loadAll();
  all.push(conv);
  saveAll(all);
  setLastActiveConversationId(conv.id);
  return conv;
}

/** Get a single conversation by ID */
export function getConversation(id: string): Conversation | null {
  return loadAll().find(c => c.id === id) ?? null;
}

/** Add a message to a conversation with strict clientMessageId idempotency */
export function addMessage(
  conversationId: string,
  message: Omit<ChatMessageRecord, 'id' | 'timestamp'> & { clientMessageId?: string },
): ChatMessageRecord {
  const all = loadAll();
  const idx = all.findIndex(c => c.id === conversationId);
  if (idx === -1) throw new Error(`Conversation ${conversationId} not found`);

  // Idempotency: if a message with this clientMessageId already exists, do not duplicate
  if (message.clientMessageId) {
    const existing = all[idx].messages.find(m => m.clientMessageId === message.clientMessageId);
    if (existing) {
      console.log(`[CHAT] Message idempotency hit: ${message.clientMessageId} already exists`);
      return existing;
    }
  }

  const msg: ChatMessageRecord = {
    ...message,
    id: message.clientMessageId || generateId(),
    clientMessageId: message.clientMessageId,
    conversationId,
    timestamp: Date.now(),
  };

  all[idx].messages.push(msg);
  all[idx].updatedAt = Date.now();

  // Auto-title from first user message
  if ((all[idx].title === 'New Conversation' || !all[idx].title) && message.role === 'user') {
    all[idx].title = message.content.slice(0, 60) + (message.content.length > 60 ? '…' : '');
  }

  saveAll(all);
  setLastActiveConversationId(conversationId);
  return msg;
}

/** Update the last assistant message (for streaming) */
export function updateLastAssistantMessage(
  conversationId: string,
  updates: Partial<ChatMessageRecord>,
): void {
  const all = loadAll();
  const idx = all.findIndex(c => c.id === conversationId);
  if (idx === -1) return;

  const msgs = all[idx].messages;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') {
      all[idx].messages[i] = { ...msgs[i], ...updates };
      all[idx].updatedAt = Date.now();
      break;
    }
  }

  saveAll(all);
}

/** Rename a conversation */
export function renameConversation(id: string, newTitle: string): void {
  const all = loadAll();
  const idx = all.findIndex(c => c.id === id);
  if (idx === -1) return;
  all[idx].title = newTitle.trim().slice(0, 80) || 'Conversation';
  all[idx].updatedAt = Date.now();
  saveAll(all);
}

/** Delete a conversation */
export function deleteConversation(id: string): void {
  const all = loadAll().filter(c => c.id !== id);
  saveAll(all);
}

/** Delete all conversations */
export function clearAllConversations(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Search conversations by title or message content */
export function searchConversations(query: string): Conversation[] {
  if (!query.trim()) return listConversations();
  const q = query.toLowerCase();
  return loadAll()
    .filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
