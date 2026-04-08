interface CacheEntry<T> {
  data: T;
  expires: number;
}

const MAX_CACHE_SIZE = 10_000;

export class Cache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Evict oldest entries if cache is full
    if (this.store.size >= MAX_CACHE_SIZE) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { data, expires: Date.now() + ttlMs });
  }

  async getOrFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const data = await fn();
    this.set(key, data, ttlMs);
    return data;
  }

  /** Remove all expired entries */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expires) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

export const cache = new Cache();

// Periodic cleanup every 10 minutes
setInterval(() => cache.cleanup(), 10 * 60 * 1000).unref();

// TTL constants
export const TTL = {
  FORECAST: 1 * 60 * 60 * 1000,    // 1 hour — forecasts update a few times daily
  SPOTS: 3 * 60 * 60 * 1000,       // 3 hours — spot status updates daily at 9 AM JST
  HISTORICAL: 24 * 60 * 60 * 1000, // 24 hours — historical data rarely changes
  WEATHER: 1 * 60 * 60 * 1000,     // 1 hour — weather changes frequently
  AREAS: 7 * 24 * 60 * 60 * 1000,  // 7 days — area definitions are static
};
