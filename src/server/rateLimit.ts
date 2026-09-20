/**
 * Per-IP sliding-window rate limiter.
 *
 * The public endpoint fans out to several free, rate-limited government APIs
 * on a shared key; one caller hammering it can exhaust that budget for
 * everyone. This is a lightweight, per-process defense (no external store, no
 * added dependency), which is the same tradeoff `SwrCache` makes: on a
 * multi-instance deployment each instance enforces its own limit, which is
 * fine — worst case is N times the configured rate, where N is the number of
 * warm instances.
 */

/**
 * Resolves the caller's IP address for a given request. Kept as a small,
 * swappable interface: the Cloudflare default reads the edge-supplied
 * header, and a Node deployment with no such proxy in front of it can supply
 * its own (e.g. reading the raw socket address).
 */
export type ClientIpResolver = (request: Request) => string;

export const UNKNOWN_CLIENT_IP = 'unknown';

/** Default resolver: Cloudflare's `cf-connecting-ip`, falling back to the first hop of `x-forwarded-for`. */
export const headerClientIp: ClientIpResolver = (request) => {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return UNKNOWN_CLIENT_IP;
};

export interface RateLimitPolicy {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying. 0 when allowed. */
  retryAfterSec: number;
  /** Requests left in the current window after this one. */
  remaining: number;
}

type Clock = () => number;

/**
 * Exact sliding-window limiter: keeps a timestamp log per key, trimmed to the
 * current window on every check. Memory per key is bounded by `maxRequests`,
 * and the number of distinct keys is bounded by `maxKeys` (an LRU-ish evict
 * of the oldest-inserted key), so a burst of spoofed IPs cannot grow this
 * unbounded.
 */
export class SlidingWindowRateLimiter {
  readonly #hits = new Map<string, number[]>();
  readonly #now: Clock;
  readonly #maxKeys: number;

  constructor(options: { now?: Clock; maxKeys?: number } = {}) {
    this.#now = options.now ?? Date.now;
    this.#maxKeys = options.maxKeys ?? 10_000;
  }

  check(key: string, policy: RateLimitPolicy): RateLimitResult {
    const now = this.#now();
    const cutoff = now - policy.windowMs;

    let timestamps = this.#hits.get(key);
    if (timestamps) {
      let start = 0;
      while (start < timestamps.length && timestamps[start] <= cutoff) start++;
      if (start > 0) timestamps = timestamps.slice(start);
    } else {
      if (this.#hits.size >= this.#maxKeys) {
        // Map preserves insertion order, so the first key is the oldest.
        const oldest = this.#hits.keys().next();
        if (!oldest.done) this.#hits.delete(oldest.value);
      }
      timestamps = [];
    }

    if (timestamps.length >= policy.maxRequests) {
      this.#hits.set(key, timestamps);
      const retryAfterMs = timestamps[0] + policy.windowMs - now;
      return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)), remaining: 0 };
    }

    timestamps.push(now);
    this.#hits.set(key, timestamps);
    return { allowed: true, retryAfterSec: 0, remaining: policy.maxRequests - timestamps.length };
  }

  reset(): void {
    this.#hits.clear();
  }
}

/** Default limiter shared by every request the process handles. */
export const rateLimiter = new SlidingWindowRateLimiter();
