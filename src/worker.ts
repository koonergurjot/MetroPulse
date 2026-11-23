/**
 * Cloudflare Workers entry point.
 *
 * Serves the built Vite site from the assets binding and routes `/api/pulse`
 * to the same framework-free handler used by the Node dev server and the
 * Vercel/Netlify entry in `api/pulse.ts`. `/report/<slug>` gets one extra
 * step: the SPA shell is fetched from assets as usual, then rewritten
 * in-flight with per-report OpenGraph/Twitter tags, since a link shared to
 * Reddit or a listing page is unfurled by a scraper that never runs the
 * React app.
 */
import { handleHealthRequest, handlePulseRequest, pulseCacheControl } from './server/handler.ts';
import { handleOgRequest } from './server/og.ts';
import { handleArtRequest, handleListingsBatchRequest, handleListingsRequest, handleMarketRequest, handleStopsRequest } from './server/mapHandlers.ts';
import { parseStopsCsv, StopIndex } from './server/gtfs/stopIndex.ts';
import { setStopIndex } from './server/gtfs/stopProvider.ts';
import { isValidSlug } from './server/slug.ts';
import { resolveReportMeta } from './server/reportMeta.ts';

interface Env {
  /** Static assets binding, configured in wrangler.jsonc. */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

let stopIndexLoad: Promise<void> | null = null;

/**
 * Workers have no filesystem, so the weekly-refreshed `public/stops.csv` is read
 * from the static assets binding once per isolate, unless STOP_INDEX_PATH
 * points at an https URL (then the stop provider loads that itself).
 */
function ensureStopIndex(env: Env, url: URL): Promise<void> {
  if ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.STOP_INDEX_PATH) return Promise.resolve();
  stopIndexLoad ??= env.ASSETS.fetch(new Request(new URL('/stops.csv', url)))
    .then(async (res) => {
      if (!res.ok || !(res.headers.get('content-type') ?? '').includes('csv')) throw new Error(`stops.csv ${res.status}`);
      setStopIndex(new StopIndex(parseStopsCsv(await res.text())));
    })
    .catch((err) => {
      stopIndexLoad = null; // retry on the next request
      console.error('[stops] could not load stop index from assets', err);
    });
  return stopIndexLoad;
}

const REPORT_PATH = /^\/report\/([^/]+)\/?$/;

/** Removes any existing `<title>`/`og:*`/`twitter:*` tags so a redeploy of the shell can't leave stale duplicates behind. */
class DropElement implements HTMLRewriterElementHandlers {
  element(element: HTMLRewriterElement): void {
    element.remove();
  }
}

class SetTitle implements HTMLRewriterElementHandlers {
  constructor(private readonly title: string) {}
  element(element: HTMLRewriterElement): void {
    element.setInnerContent(this.title);
  }
}

class AppendToHead implements HTMLRewriterElementHandlers {
  constructor(private readonly html: string) {}
  element(element: HTMLRewriterElement): void {
    element.append(this.html, { html: true });
  }
}

async function rewriteReportShell(response: Response, request: Request, slug: string): Promise<Response> {
  const { meta, degraded } = await resolveReportMeta(slug, request.signal);
  const origin = new URL(request.url).origin;
  const canonicalUrl = `${origin}${meta.canonicalPath}`;
  const imageUrl = `${origin}/api/og?slug=${encodeURIComponent(meta.slug || slug)}`;

  const escAttr = (s: string): string => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const tags = `
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="MetroPulse">
    <meta property="og:title" content="${escAttr(meta.title)}">
    <meta property="og:description" content="${escAttr(meta.description)}">
    <meta property="og:url" content="${escAttr(canonicalUrl)}">
    <meta property="og:image" content="${escAttr(imageUrl)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escAttr(meta.title)}">
    <meta name="twitter:description" content="${escAttr(meta.description)}">
    <meta name="twitter:image" content="${escAttr(imageUrl)}">
  `;

  const rewritten = new HTMLRewriter()
    .on('meta[property^="og:"]', new DropElement())
    .on('meta[name^="twitter:"]', new DropElement())
    .on('title', new SetTitle(meta.title))
    .on('head', new AppendToHead(tags))
    .transform(response);

  const headers = new Headers(rewritten.headers);
  headers.set('cache-control', pulseCacheControl(degraded));
  return new Response(rewritten.body, { status: rewritten.status, statusText: rewritten.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/pulse') return handlePulseRequest(request);
    if (url.pathname === '/api/health') return handleHealthRequest(request);
    if (url.pathname === '/api/og') return handleOgRequest(request);
    if (url.pathname.startsWith('/api/')) await ensureStopIndex(env, url);
    if (url.pathname === '/api/listings/batch') return handleListingsBatchRequest(request);
    if (url.pathname === '/api/market') return handleMarketRequest(request);
    if (url.pathname === '/api/listings') return handleListingsRequest(request);
    if (url.pathname === '/api/stops') return handleStopsRequest(request);
    if (url.pathname.startsWith('/api/art/')) return handleArtRequest(request);

    const reportMatch = url.pathname.match(REPORT_PATH);
    if (reportMatch && request.method === 'GET') {
      const slug = decodeURIComponent(reportMatch[1]);
      const assetResponse = await env.ASSETS.fetch(request);
      const contentType = assetResponse.headers.get('content-type') ?? '';
      if (isValidSlug(slug) && contentType.includes('text/html')) {
        return rewriteReportShell(assetResponse, request, slug);
      }
      return assetResponse;
    }

    return env.ASSETS.fetch(request);
  },
};
