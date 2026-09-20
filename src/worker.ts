/**
 * Cloudflare Workers entry point.
 *
 * Serves the built Vite site from the assets binding and routes `/api/pulse`
 * to the same framework-free handler used by the Node dev server and the
 * Vercel/Netlify entry in `api/pulse.ts`.
 */
import { handleHealthRequest, handlePulseRequest } from './server/handler.ts';

interface Env {
  /** Static assets binding, configured in wrangler.jsonc. */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/pulse') return handlePulseRequest(request);
    if (url.pathname === '/api/health') return handleHealthRequest(request);
    return env.ASSETS.fetch(request);
  },
};
