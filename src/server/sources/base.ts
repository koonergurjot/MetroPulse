import { cache, type CachePolicy } from '../cache.ts';
import { sourceHealth } from '../health.ts';
import { UpstreamError } from '../http.ts';
import type { SourceMeta, SourceResult } from '../types.ts';

/** JSON, one line per failure. Never includes the upstream URL or an API key — see `toPublicMessage`. */
function logUpstreamFailure(entry: { sourceId: string; status: number | null; durationMs: number; message: string }): void {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'upstream_failure',
      timestamp: new Date().toISOString(),
      ...entry,
    }),
  );
}

/**
 * Runs a source loader and normalises everything — success, cache-hit,
 * timeout, upstream 500 — into a `SourceResult`. Nothing in this service is
 * allowed to throw past this boundary: a dead municipal portal greys out one
 * card, it does not 500 the page.
 *
 * The loader is wrapped (rather than the whole cache resolution) so health
 * tracking and failure logging reflect real upstream calls even when
 * `cache.resolve` masks the failure by serving a stale value.
 */
export async function runSource<T>(
  meta: SourceMeta,
  cacheKey: string,
  policy: CachePolicy,
  loader: () => Promise<T>,
): Promise<SourceResult<T>> {
  const startedAt = Date.now();
  const trackedLoader = async (): Promise<T> => {
    try {
      const value = await loader();
      sourceHealth.recordSuccess(meta);
      return value;
    } catch (err) {
      const status = err instanceof UpstreamError ? err.status : null;
      const message = toPublicMessage(err);
      sourceHealth.recordError(meta, message);
      logUpstreamFailure({ sourceId: meta.id, status, durationMs: Date.now() - startedAt, message });
      throw err;
    }
  };

  try {
    const hit = await cache.resolve(cacheKey, policy, trackedLoader);
    return {
      meta,
      status: hit.stale ? 'stale' : 'ok',
      data: hit.value,
      fetchedAt: new Date(startedAt - hit.ageMs).toISOString(),
      ageMs: Math.round(hit.ageMs),
    };
  } catch (err) {
    return {
      meta,
      status: 'error',
      data: null,
      fetchedAt: new Date(startedAt).toISOString(),
      ageMs: 0,
      error: toPublicMessage(err),
    };
  }
}

export function skippedSource<T>(meta: SourceMeta, reason: string): SourceResult<T> {
  return {
    meta,
    status: 'skipped',
    data: null,
    fetchedAt: new Date().toISOString(),
    ageMs: 0,
    error: reason,
  };
}

/** Never leak an upstream URL or an API key into a user-facing message. */
export function toPublicMessage(err: unknown): string {
  if (err instanceof UpstreamError) {
    if (err.message.includes('not configured')) return 'This data source is not configured on the server.';
    if (err.status === 429) return 'Upstream rate limit reached; showing what we have.';
    if (err.status && err.status >= 500) return 'The data provider is having trouble right now.';
    if (err.message === 'upstream timed out') return 'The data provider did not respond in time.';
    return 'Could not reach the data provider.';
  }
  return 'Unexpected error while loading this source.';
}
