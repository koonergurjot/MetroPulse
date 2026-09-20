/**
 * Vercel / Netlify / Cloudflare entry point.
 * Platforms that expect a default-exported fetch handler will pick this up as
 * `GET /api/pulse?address=...`.
 */
import { handlePulseRequest } from '../src/server/handler.ts';

export const config = { runtime: 'edge' };

export default function handler(request: Request): Promise<Response> {
  return handlePulseRequest(request);
}
