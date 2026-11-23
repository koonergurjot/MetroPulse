import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpstreamError } from '../http.ts';
import { runSource, skippedSource, toPublicMessage } from '../sources/base.ts';
import type { SourceMeta } from '../types.ts';

const meta: SourceMeta = { id: 'test.source', label: 'Test source', attribution: 'A', licence: 'L' };
const policy = { ttlMs: 60_000 };

let n = 0;
// The shared cache is process-wide, so every test uses its own key.
const key = (): string => `runSource-test-${++n}`;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('runSource', () => {
  it('wraps a successful load as an ok result', async () => {
    const result = await runSource(meta, key(), policy, async () => ({ hello: 'world' }));
    expect(result).toMatchObject({ meta, status: 'ok', data: { hello: 'world' }, ageMs: 0 });
    expect(result.error).toBeUndefined();
  });

  it('serves the second call from cache without calling the loader again', async () => {
    const k = key();
    const loader = vi.fn(async () => 42);
    await runSource(meta, k, policy, loader);
    const second = await runSource(meta, k, policy, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(second.data).toBe(42);
  });

  it('never throws: an upstream failure becomes an error result with a safe message', async () => {
    const result = await runSource(meta, key(), policy, async () => {
      throw new UpstreamError('upstream responded 503 for https://x.test/?apikey=SECRET', 503, true);
    });
    expect(result.status).toBe('error');
    expect(result.data).toBeNull();
    expect(result.error).toBe('The data provider is having trouble right now.');
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });

  it('logs the failure without the upstream URL or key', async () => {
    await runSource(meta, key(), policy, async () => {
      throw new UpstreamError('upstream responded 500', 500, true);
    });
    const logged = String((console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]);
    expect(JSON.parse(logged)).toMatchObject({ event: 'upstream_failure', sourceId: 'test.source', status: 500 });
  });

  it('turns a non-upstream exception into a generic error result', async () => {
    const result = await runSource(meta, key(), policy, async () => {
      throw new TypeError('x is not a function');
    });
    expect(result.status).toBe('error');
    expect(result.error).toBe('Unexpected error while loading this source.');
  });
});

describe('skippedSource', () => {
  it('reports why a source was not queried instead of returning empty data', () => {
    const result = skippedSource(meta, 'Surrey does not publish 311 yet.');
    expect(result).toMatchObject({ meta, status: 'skipped', data: null, error: 'Surrey does not publish 311 yet.' });
  });
});

describe('toPublicMessage', () => {
  it.each([
    [new UpstreamError('TRANSLINK_API_KEY is not configured', null, false), 'This data source is not configured on the server.'],
    [new UpstreamError('upstream responded 429', 429, true), 'Upstream rate limit reached; showing what we have.'],
    [new UpstreamError('upstream responded 502', 502, true), 'The data provider is having trouble right now.'],
    [new UpstreamError('upstream timed out', null, true), 'The data provider did not respond in time.'],
    [new UpstreamError('upstream responded 404', 404, false), 'Could not reach the data provider.'],
    [new Error('boom'), 'Unexpected error while loading this source.'],
    ['a string', 'Unexpected error while loading this source.'],
  ])('maps %o to a user-safe message', (err, expected) => {
    expect(toPublicMessage(err)).toBe(expected);
  });
});
