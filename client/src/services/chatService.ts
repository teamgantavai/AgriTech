// ============================================================
// chatService.ts — SSE streaming client for Gram Sathi Chat
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface ServiceContext {
  id?: string;
  title?: string;
  category?: string;
  helpsWith?: string;
  source?: string;
  officialUrl?: string;
}

export interface ChatStreamOptions {
  message: string;
  history?: ChatMessage[];
  forceLanguage?: string;
  role?: string;
  interest?: string;
  state?: string;
  serviceContext?: ServiceContext;
  requestId?: string;
  clientMessageId?: string;
  onChunk: (text: string) => void;
  onMeta?: (meta: { language: string; displayName: string }) => void;
  onDone?: (language: string) => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
}

/**
 * Streams a chat response from the Gram Sathi backend.
 * Calls onChunk for each streamed token, onDone when complete.
 * Returns a cleanup function to cancel the request.
 */
export async function streamChatMessage(options: ChatStreamOptions): Promise<void> {
  const {
    message,
    history = [],
    forceLanguage,
    role,
    interest,
    state,
    serviceContext,
    requestId,
    clientMessageId,
    onChunk,
    onMeta,
    onDone,
    onError,
    signal,
  } = options;

  try {
    const body: Record<string, unknown> = {
      message,
      history,
      voiceMode: false,
    };
    if (forceLanguage) body.forceLanguage = forceLanguage;
    if (role) body.role = role;
    if (interest) body.interest = interest;
    if (state) body.state = state;
    if (serviceContext) body.serviceContext = serviceContext;
    if (requestId) body.requestId = requestId;
    if (clientMessageId) body.clientMessageId = clientMessageId;

    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server error ${response.status}: ${errText}`);
    }

    if (!response.body) {
      throw new Error('No response body from server');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processLines = (lines: string[]) => {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const jsonStr = trimmed.slice(6);
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);

          if (parsed.meta && onMeta) {
            onMeta(parsed.meta);
          } else if (parsed.chunk !== undefined) {
            onChunk(parsed.chunk);
          } else if (parsed.done) {
            onDone?.(parsed.language || '');
            return true;
          } else if (parsed.error) {
            onError?.(parsed.error);
            return true;
          }
        } catch {
          // Non-JSON line, skip
        }
      }
      return false;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush remaining buffer if any
        buffer += decoder.decode();
        if (buffer.trim()) {
          const remainingLines = buffer.split('\n');
          processLines(remainingLines);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      const shouldHalt = processLines(lines);
      if (shouldHalt) return;
    }

    onDone?.('');
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      // User cancelled — not an error
      return;
    }
    const message = err instanceof Error ? err.message : 'Network error. Please try again.';
    onError?.(message);
  }
}

/**
 * Non-streaming fallback — returns full response at once.
 */
export async function sendChatMessage(options: {
  message: string;
  history?: ChatMessage[];
  forceLanguage?: string;
  role?: string;
  interest?: string;
  state?: string;
}): Promise<{
  answer: string;
  language: string;
  suggestions: string[];
  sourceType: string;
}> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...options, voiceMode: false }),
  });

  if (!response.ok) {
    throw new Error(`Server error ${response.status}`);
  }

  return response.json();
}
