import { describe, expect, it } from 'vitest';
import { SlidingWindowRateLimiter } from '../rateLimit.ts';

describe('SlidingWindowRateLimiter', () => {
  it('allows requests up to the limit within the window', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ now: () => now });
    const policy = { windowMs: 1_000, maxRequests: 3 };

    expect(limiter.check('a', policy)).toMatchObject({ allowed: true, remaining: 2 });
    expect(limiter.check('a', policy)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check('a', policy)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('rejects the request that exceeds the limit, with a retry-after', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ now: () => now });
    const policy = { windowMs: 1_000, maxRequests: 2 };

    limiter.check('a', policy);
    limiter.check('a', policy);
    now = 200;
    const blocked = limiter.check('a', policy);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    // Oldest hit was at t=0, window is 1000ms, so it expires at t=1000.
    expect(blocked.retryAfterSec).toBe(1);
  });

  it('lets a request through again once the oldest hit ages out of the window', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ now: () => now });
    const policy = { windowMs: 1_000, maxRequests: 2 };

    limiter.check('a', policy); // t=0
    now = 500;
    limiter.check('a', policy); // t=500
    now = 999;
    expect(limiter.check('a', policy).allowed).toBe(false); // both hits still in [0, 1000)

    now = 1_001; // the t=0 hit has now aged out
    const result = limiter.check('a', policy);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0); // t=500 hit plus this one
  });

  it('treats a hit exactly windowMs old as expired (half-open window)', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ now: () => now });
    const policy = { windowMs: 1_000, maxRequests: 1 };

    limiter.check('a', policy); // t=0
    now = 1_000; // exactly one window later
    expect(limiter.check('a', policy).allowed).toBe(true);
  });

  it('tracks separate IPs independently', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ now: () => now });
    const policy = { windowMs: 1_000, maxRequests: 1 };

    expect(limiter.check('1.1.1.1', policy).allowed).toBe(true);
    expect(limiter.check('1.1.1.1', policy).allowed).toBe(false);
    // A different key has its own budget, unaffected by 1.1.1.1's usage.
    expect(limiter.check('2.2.2.2', policy).allowed).toBe(true);
  });

  it('evicts the oldest key once the key cap is reached', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ now: () => now, maxKeys: 2 });
    const policy = { windowMs: 1_000, maxRequests: 1 };

    limiter.check('a', policy);
    limiter.check('b', policy);
    limiter.check('c', policy); // evicts 'a'

    // 'a' was evicted, so its budget was reset and it is allowed again.
    expect(limiter.check('a', policy).allowed).toBe(true);
  });

  it('reset clears all tracked keys', () => {
    let now = 0;
    const limiter = new SlidingWindowRateLimiter({ now: () => now });
    const policy = { windowMs: 1_000, maxRequests: 1 };

    limiter.check('a', policy);
    expect(limiter.check('a', policy).allowed).toBe(false);

    limiter.reset();
    expect(limiter.check('a', policy).allowed).toBe(true);
  });
});
