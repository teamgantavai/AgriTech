// ============================================================
// Cache — Lightweight In-Memory Server Cache with TTL
// ============================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private defaultTtlMs: number;

  constructor(defaultTtlSeconds: number = 3600) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isStale = now > entry.expiresAt;
    return { data: entry.data, isStale };
  }

  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
    const now = Date.now();
    this.store.set(key, {
      data,
      cachedAt: now,
      expiresAt: now + ttl,
    });
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt + 24 * 3600 * 1000) {
        this.store.delete(key);
      }
    }
  }
}

export const cropCalendarCache = new MemoryCache(3600); // 1 hour default TTL
