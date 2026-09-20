/**
 * Process-local cache with single-flight, stale-while-revalidate and
 * stale-if-error.
 *
 * Why this matters here: TransLink's GTFS-RT feed is one request that serves
 * every user in the region, and the open-data portals are rate limited. One
 * warm instance therefore turns thousands of page views into a handful of
 * upstream calls. On a serverless platform each instance keeps its own copy,
 * which is fine — worst case is N times the upstream traffic, where N is the
 * number of warm instances.
 */

export interface CacheEntry<T> {
  value: T;
  storedAt: number;
}

export interface CachePolicy {
  /** Serve from cache without revalidating below this age. */
  ttlMs: number;
  /**
   * Above `ttlMs` but below `ttlMs + staleMs`, serve the cached value
   * immediately and refresh in the background.
   */
  staleMs?: number;
}

export interface CacheHit<T> {
  value: T;
  ageMs: number;
  /** True when the value served was past its TTL. */
  stale: boolean;
}

type Clock = () => number;

export class SwrCache {
  readonly #entries = new Map<string, CacheEntry<unknown>>();
  readonly #inflight = new Map<string, Promise<unknown>>();
  readonly #now: Clock;
  readonly #maxEntries: number;

  constructor(options: { now?: Clock; maxEntries?: number } = {}) {
    this.#now = options.now ?? Date.now;
    this.#maxEntries = options.maxEntries ?? 500;
  }

  peek<T>(key: string): CacheHit<T> | null {
    const entry = this.#entries.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    return { value: entry.value, ageMs: this.#now() - entry.storedAt, stale: true };
  }

  set<T>(key: string, value: T): void {
    if (this.#entries.size >= this.#maxEntries && !this.#entries.has(key)) {
      // Map preserves insertion order, so the first key is the oldest write.
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
    this.#entries.set(key, { value, storedAt: this.#now() });
  }

  clear(): void {
    this.#entries.clear();
    this.#inflight.clear();
  }

  /**
   * Resolve `key`, calling `loader` at most once per key across concurrent
   * callers. If `loader` throws and a stale value exists, the stale value is
   * served rather than propagating the failure.
   */
  async resolve<T>(key: string, policy: CachePolicy, loader: () => Promise<T>): Promise<CacheHit<T>> {
    const entry = this.#entries.get(key) as CacheEntry<T> | undefined;
    const ageMs = entry ? this.#now() - entry.storedAt : Infinity;

    if (entry && ageMs <= policy.ttlMs) {
      return { value: entry.value, ageMs, stale: false };
    }

    const staleWindow = policy.staleMs ?? 0;
    if (entry && ageMs <= policy.ttlMs + staleWindow) {
      // Kick off a refresh but answer from cache right now.
      void this.#load(key, loader).catch(() => undefined);
      return { value: entry.value, ageMs, stale: true };
    }

    try {
      const value = await this.#load(key, loader);
      return { value, ageMs: 0, stale: false };
    } catch (err) {
      if (entry) return { value: entry.value, ageMs, stale: true };
      throw err;
    }
  }

  #load<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.#inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.#inflight.delete(key);
      });

    this.#inflight.set(key, promise);
    return promise;
  }
}

/** Default cache shared by every source adapter in this process. */
export const cache = new SwrCache();
