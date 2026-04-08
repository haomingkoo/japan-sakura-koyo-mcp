interface CacheEntry<T> {
  data: T;
  expires: number;
}

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
    this.store.set(key, { data, expires: Date.now() + ttlMs });
  }

  async getOrFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const data = await fn();
    this.set(key, data, ttlMs);
    return data;
  }
}

export const cache = new Cache();

// TTL constants
export const TTL = {
  FORECAST: 3 * 60 * 60 * 1000,    // 3 hours — forecasts update a few times daily
  SPOTS: 6 * 60 * 60 * 1000,       // 6 hours — spot status changes slowly
  HISTORICAL: 24 * 60 * 60 * 1000, // 24 hours — historical data rarely changes
  WEATHER: 1 * 60 * 60 * 1000,     // 1 hour — weather changes frequently
  AREAS: 7 * 24 * 60 * 60 * 1000,  // 7 days — area definitions are static
};
