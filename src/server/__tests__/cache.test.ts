import { describe, expect, it, vi } from 'vitest';
import { SwrCache } from '../cache.ts';

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('SwrCache', () => {
  it('serves fresh values without re-calling the loader', async () => {
    let now = 1_000;
    const cache = new SwrCache({ now: () => now });
    const loader = vi.fn(async () => 'a');

    await cache.resolve('k', { ttlMs: 100 }, loader);
    now += 50;
    const second = await cache.resolve('k', { ttlMs: 100 }, loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second.stale).toBe(false);
    expect(second.ageMs).toBe(50);
  });

  it('serves stale immediately and refreshes in the background', async () => {
    let now = 1_000;
    const cache = new SwrCache({ now: () => now });
    let value = 'a';
    const loader = vi.fn(async () => value);

    await cache.resolve('k', { ttlMs: 100, staleMs: 1_000 }, loader);
    now += 500;
    value = 'b';

    const stale = await cache.resolve('k', { ttlMs: 100, staleMs: 1_000 }, loader);
    expect(stale.value).toBe('a');
    expect(stale.stale).toBe(true);

    await tick();
    const refreshed = await cache.resolve('k', { ttlMs: 100, staleMs: 1_000 }, loader);
    expect(refreshed.value).toBe('b');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('collapses concurrent misses into one upstream call', async () => {
    const cache = new SwrCache();
    const loader = vi.fn(async () => {
      await tick();
      return 'v';
    });

    const results = await Promise.all([
      cache.resolve('k', { ttlMs: 100 }, loader),
      cache.resolve('k', { ttlMs: 100 }, loader),
      cache.resolve('k', { ttlMs: 100 }, loader),
    ]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.value)).toEqual(['v', 'v', 'v']);
  });

  it('falls back to a stale value when the loader fails', async () => {
    let now = 1_000;
    const cache = new SwrCache({ now: () => now });
    const loader = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('good')
      .mockRejectedValue(new Error('upstream down'));

    await cache.resolve('k', { ttlMs: 10 }, loader);
    now += 10_000;

    const hit = await cache.resolve('k', { ttlMs: 10 }, loader);
    expect(hit.value).toBe('good');
    expect(hit.stale).toBe(true);
  });

  it('propagates the failure when there is nothing cached', async () => {
    const cache = new SwrCache();
    await expect(cache.resolve('k', { ttlMs: 10 }, async () => {
      throw new Error('upstream down');
    })).rejects.toThrow('upstream down');
  });

  it('retries after a failure rather than memoising it', async () => {
    const cache = new SwrCache();
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValue('ok');

    await expect(cache.resolve('k', { ttlMs: 10 }, loader)).rejects.toThrow('blip');
    const hit = await cache.resolve('k', { ttlMs: 10 }, loader);
    expect(hit.value).toBe('ok');
  });

  it('evicts the oldest entry once full', async () => {
    const cache = new SwrCache({ maxEntries: 2 });
    await cache.resolve('a', { ttlMs: 1_000 }, async () => 1);
    await cache.resolve('b', { ttlMs: 1_000 }, async () => 2);
    await cache.resolve('c', { ttlMs: 1_000 }, async () => 3);

    expect(cache.peek('a')).toBeNull();
    expect(cache.peek<number>('c')?.value).toBe(3);
  });
});
