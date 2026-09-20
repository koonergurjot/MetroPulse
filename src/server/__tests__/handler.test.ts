import { beforeEach, describe, expect, it } from 'vitest';
import { handleHealthRequest, handlePulseRequest } from '../handler.ts';
import { rateLimiter } from '../rateLimit.ts';

// Any request the rate limiter admits still 400s here (no address/lat/lng),
// which is fine — the limiter runs before the query is even parsed, so this
// never touches the network.
const req = (ip: string): Request => new Request('http://x.test/api/pulse', { headers: { 'cf-connecting-ip': ip } });

describe('handlePulseRequest rate limiting', () => {
  beforeEach(() => {
    rateLimiter.reset();
  });

  it('returns 429 with Retry-After once the per-IP limit is exceeded', async () => {
    let last: Response | undefined;
    for (let i = 0; i < 31; i++) {
      last = await handlePulseRequest(req('rl-test-1'));
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get('retry-after')).toBeTruthy();
  });

  it('tracks separate IPs independently', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await handlePulseRequest(req('rl-test-a'));
      expect(res.status).not.toBe(429);
    }
    const blocked = await handlePulseRequest(req('rl-test-a'));
    expect(blocked.status).toBe(429);

    const other = await handlePulseRequest(req('rl-test-b'));
    expect(other.status).not.toBe(429);
  });
});

describe('handleHealthRequest', () => {
  it('returns a status and a sources array', async () => {
    const res = await handleHealthRequest(new Request('http://x.test/api/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(['ok', 'degraded']).toContain(body.status);
    expect(Array.isArray(body.sources)).toBe(true);
  });

  it('rejects non-GET methods', async () => {
    const res = await handleHealthRequest(new Request('http://x.test/api/health', { method: 'POST' }));
    expect(res.status).toBe(405);
  });
});
