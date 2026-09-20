/**
 * Web-standard request handler.
 *
 * Deliberately framework-free: the same function runs on Vercel Functions,
 * Cloudflare Workers, Netlify, Deno Deploy, Bun and plain Node 18+. Keeping
 * the entry point portable is what makes "move off the free tier that just
 * changed its pricing" a config change instead of a rewrite.
 */
import { config } from './config.ts';
import { sourceHealth } from './health.ts';
import { BadRequestError, buildPulse, type PulseQuery } from './pulse.ts';
import { headerClientIp, rateLimiter, type ClientIpResolver } from './rateLimit.ts';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function parseQuery(url: URL): PulseQuery {
  const num = (key: string): number | undefined => {
    const raw = url.searchParams.get(key);
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new BadRequestError(`\`${key}\` must be a number.`);
    return value;
  };
  return {
    address: url.searchParams.get('address') ?? undefined,
    lat: num('lat'),
    lng: num('lng'),
    radiusM: num('radius'),
  };
}

export interface HandlePulseOptions {
  /**
   * Resolves the caller's IP for rate limiting. Defaults to reading
   * Cloudflare's `cf-connecting-ip` header (falling back to
   * `x-forwarded-for`). A Node deployment with no such edge proxy in front
   * of it can supply its own, e.g. reading the raw socket address — see
   * `scripts/dev-api.ts`.
   */
  clientIp?: ClientIpResolver;
}

export async function handlePulseRequest(request: Request, options: HandlePulseOptions = {}): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);

  if (config.limits.rateLimitMaxRequests > 0) {
    const resolveClientIp = options.clientIp ?? headerClientIp;
    const limit = rateLimiter.check(resolveClientIp(request), {
      windowMs: config.limits.rateLimitWindowMs,
      maxRequests: config.limits.rateLimitMaxRequests,
    });
    if (!limit.allowed) {
      return json({ error: 'Too many requests.' }, 429, { 'retry-after': String(limit.retryAfterSec) });
    }
  }

  try {
    const query = parseQuery(new URL(request.url));
    const pulse = await buildPulse(query, request.signal);

    // Let the CDN absorb repeat traffic for the same address. The numbers
    // mirror the shortest upstream TTL so the edge never serves something
    // meaningfully staler than the origin would.
    const degraded = pulse.sources.some((s) => s.status === 'error');
    return json(pulse, 200, {
      'cache-control': degraded
        ? 'public, max-age=0, s-maxage=15, stale-while-revalidate=60'
        : 'public, max-age=15, s-maxage=30, stale-while-revalidate=120',
    });
  } catch (err) {
    if (err instanceof BadRequestError) return json({ error: err.message }, 400);
    if (err instanceof Error && err.name === 'AbortError') return json({ error: 'Request cancelled.' }, 499);
    // Log server-side, return nothing that reveals upstream shape.
    console.error('[pulse] unhandled error', err);
    return json({ error: 'Something went wrong building this report.' }, 500);
  }
}

/**
 * Lightweight liveness probe: per-source last-success age from the process's
 * health registry, so a monitor can catch a portal outage without watching
 * logs. Never fans out to upstream itself.
 */
export async function handleHealthRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);

  const sources = sourceHealth.snapshot();
  const degraded = sources.some(
    (s) => s.lastErrorAt !== null && (s.lastSuccessAt === null || s.lastErrorAt > s.lastSuccessAt),
  );

  return json(
    { status: degraded ? 'degraded' : 'ok', generatedAt: new Date().toISOString(), sources },
    200,
    { 'cache-control': 'no-store' },
  );
}
