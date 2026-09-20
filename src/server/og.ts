/**
 * Social preview cards for `/report/<slug>` links.
 *
 * Rendered as hand-built SVG rather than PNG: Workers has no canvas or image
 * library, and shelling out to a headless browser per link-share is neither
 * fast nor free. Every major scraper (Slack, Discord, Reddit, iMessage) will
 * happily unfurl an `image/svg+xml` og:image, so there is nothing to trade
 * off here beyond writing the markup by hand.
 */
import { BadRequestError, buildPulse, type PulseQuery } from './pulse.ts';
import { CORS_HEADERS, pulseCacheControl } from './handler.ts';
import type { PulseResponse, ScoreComponent } from './types.ts';

const WIDTH = 1200;
const HEIGHT = 630;

/** XML-escapes text dropped into the SVG so a `&` in an address can't break the document. */
function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Breaks `text` into at most `maxLines` lines of roughly `maxChars` characters, word-wrapped. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:]+$/, '')}…`;
  }
  return lines.slice(0, maxLines);
}

function scoreColor(score: number | null): string {
  if (score === null) return '#64748b';
  if (score >= 75) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

/** The components a card is worth bragging about: available, highest score first. */
export function strongestComponents(components: ScoreComponent[], count = 2): ScoreComponent[] {
  return components
    .filter((c) => c.available)
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

export interface OgCardData {
  address: string;
  score: number | null;
  components: ScoreComponent[];
}

/** Pure, network-free: takes the data a card needs and renders 1200x630 SVG. */
export function renderOgCard(data: OgCardData): string {
  const color = scoreColor(data.score);
  const addressLines = wrap(data.address, 34, 2);
  const highlights = strongestComponents(data.components, 2);

  const scoreText = data.score === null ? '—' : String(data.score);
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const offset = data.score === null ? circumference : circumference * (1 - data.score / 100);

  const highlightBlocks = highlights
    .map((component, i) => {
      const y = 400 + i * 92;
      const barWidth = Math.round((component.score / 100) * 380);
      return `
    <g transform="translate(64, ${y})">
      <text x="0" y="0" font-size="26" font-weight="700" fill="#e2e8f0" font-family="Arial, sans-serif">${esc(component.label)}</text>
      <text x="1000" y="0" font-size="26" font-weight="700" fill="${scoreColor(component.score)}" font-family="Arial, sans-serif" text-anchor="end">${component.score}</text>
      <rect x="0" y="16" width="1036" height="10" rx="5" fill="#1e293b" />
      <rect x="0" y="16" width="${barWidth}" height="10" rx="5" fill="${scoreColor(component.score)}" />
    </g>`;
    })
    .join('');

  const addressText = addressLines
    .map((line, i) => `<tspan x="64" dy="${i === 0 ? 0 : 44}">${esc(line)}</tspan>`)
    .join('');

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020617" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)" />
  <rect x="0" y="0" width="${WIDTH}" height="8" fill="${color}" />

  <text x="64" y="72" font-size="30" font-weight="700" fill="#34d399" font-family="Arial, sans-serif" letter-spacing="1">METROPULSE</text>
  <text x="64" y="150" font-size="38" font-weight="700" fill="#f8fafc" font-family="Arial, sans-serif">${addressText}</text>

  <g transform="translate(1000, 190)">
    <circle r="${radius}" fill="none" stroke="#1e293b" stroke-width="14" />
    <circle r="${radius}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90)" />
    <text x="0" y="14" font-size="54" font-weight="700" fill="#f8fafc" font-family="Arial, sans-serif" text-anchor="middle">${scoreText}</text>
    <text x="0" y="46" font-size="16" fill="#94a3b8" font-family="Arial, sans-serif" text-anchor="middle">PULSE SCORE</text>
  </g>

  <line x1="64" y1="350" x2="1136" y2="350" stroke="#1e293b" stroke-width="2" />
  ${highlightBlocks}

  <text x="64" y="600" font-size="20" fill="#64748b" font-family="Arial, sans-serif">Real-time transit, permits and civic data for Metro Vancouver</text>
</svg>`;
}

const FALLBACK_CARD = renderOgCard({
  address: 'Metro Vancouver',
  score: null,
  components: [],
});

function svgResponse(svg: string, cacheControl: string): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': cacheControl,
      ...CORS_HEADERS,
    },
  });
}

export function ogCardDataFromPulse(pulse: PulseResponse): OgCardData {
  return {
    address: pulse.location.address ?? `${pulse.location.lat.toFixed(5)}, ${pulse.location.lng.toFixed(5)}`,
    score: pulse.score.value,
    components: pulse.score.components,
  };
}

function parseOgQuery(url: URL): PulseQuery {
  const num = (key: string): number | undefined => {
    const raw = url.searchParams.get(key);
    if (raw === null || raw.trim() === '') return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  return {
    address: url.searchParams.get('address') ?? undefined,
    slug: url.searchParams.get('slug') ?? undefined,
    lat: num('lat'),
    lng: num('lng'),
  };
}

export async function handleOgRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'GET') return svgResponse(FALLBACK_CARD, pulseCacheControl(true));

  const query = parseOgQuery(new URL(request.url));
  if (!query.address && !query.slug && !(query.lat !== undefined && query.lng !== undefined)) {
    return svgResponse(FALLBACK_CARD, pulseCacheControl(true));
  }

  try {
    const pulse = await buildPulse(query, request.signal);
    const degraded = pulse.sources.some((s) => s.status === 'error');
    return svgResponse(renderOgCard(ogCardDataFromPulse(pulse)), pulseCacheControl(degraded));
  } catch (err) {
    // A bad slug/address still has to come back as a valid image — a broken
    // og:image is worse than a generic one when a link gets shared.
    const cacheControl = err instanceof BadRequestError ? pulseCacheControl(false) : pulseCacheControl(true);
    return svgResponse(FALLBACK_CARD, cacheControl);
  }
}
