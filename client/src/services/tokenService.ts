// ============================================================
// Token Service — Ephemeral token pre-warming & caching
// ============================================================

interface CachedToken {
  token: string;
  model: string;
  expiresAt: number; // Unix timestamp in ms
}

let memoryTokenCache: CachedToken | null = null;
let inflightTokenPromise: Promise<{ token: string; model: string }> | null = null;

const STORAGE_KEY = 'sahkar_sathi_ephemeral_token';

export function clearCachedToken(): void {
  memoryTokenCache = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function loadCachedToken(): CachedToken | null {
  if (memoryTokenCache && memoryTokenCache.expiresAt > Date.now()) {
    return memoryTokenCache;
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: CachedToken = JSON.parse(raw);
      if (parsed.expiresAt > Date.now()) {
        memoryTokenCache = parsed;
        return parsed;
      }
    }
  } catch {
    // sessionStorage error — ignore
  }
  return null;
}

function saveCachedToken(token: string, model: string, validSeconds: number = 120): void {
  // Cache for at most 2 minutes to guarantee newSessionExpireTime deadline is always fresh
  const expiresAt = Date.now() + validSeconds * 1000;
  const cached: CachedToken = { token, model, expiresAt };
  memoryTokenCache = cached;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // ignore
  }
}

/**
 * Fetch a fresh ephemeral token from the backend /api/live/token
 */
async function fetchFreshToken(maxRetries = 2): Promise<{ token: string; model: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const resp = await fetch('/api/live/token');
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.details || data.error || `Server responded with ${resp.status}`);
      }
      const data = await resp.json();
      if (!data.token) {
        throw new Error('Server returned empty live session token');
      }
      saveCachedToken(data.token, data.model, 120);
      return { token: data.token, model: data.model };
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt <= maxRetries) {
        console.warn(`[TokenService] Ephemeral token fetch attempt ${attempt} failed (${lastError.message}). Retrying...`);
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
    }
  }

  throw lastError || new Error('Failed to get session token from server');
}

/**
 * Get a valid ephemeral token. Uses cache if valid, or dedupes concurrent requests.
 * @param forceFresh - If true, bypasses cache to obtain a guaranteed brand-new token
 */
export async function getLiveToken(forceFresh = false): Promise<{ token: string; model: string }> {
  if (forceFresh) {
    clearCachedToken();
  }

  const cached = forceFresh ? null : loadCachedToken();
  if (cached) {
    return { token: cached.token, model: cached.model };
  }

  if (inflightTokenPromise) {
    return inflightTokenPromise;
  }

  inflightTokenPromise = fetchFreshToken().finally(() => {
    inflightTokenPromise = null;
  });

  return inflightTokenPromise;
}

/**
 * Pre-warm the token on page load or when voice button is rendered/hovered
 */
export function prefetchToken(): void {
  const cached = loadCachedToken();
  if (!cached && !inflightTokenPromise) {
    getLiveToken().catch((err) => {
      console.warn('[TokenService] Prefetch token warning:', err);
    });
  }
}
