/**
 * Map-facing endpoints: viewport listings, viewport transit stops, and the
 * generated demo artwork. Same framework-free Request/Response shape as
 * `handler.ts`, so Workers and the Node dev server share them.
 */
import { guardRequest, json, type HandlePulseOptions } from './handler.ts';
import { METRO_VANCOUVER_BBOX, type BBox } from './geo.ts';
import { loadStopIndex } from './gtfs/stopProvider.ts';
import { listingArtSvg, type ArtKind } from './listings/art.ts';
import { searchListings } from './listings/service.ts';
import type { ListingKind, ListingQuery, PropertyType } from './listings/types.ts';

const PROPERTY_TYPES: readonly PropertyType[] = ['condo', 'townhouse', 'house', 'duplex'];

/** Pads the Metro Vancouver envelope slightly so edge-of-region panning still works. */
const ALLOWED: BBox = {
  minLat: METRO_VANCOUVER_BBOX.minLat - 0.2,
  maxLat: METRO_VANCOUVER_BBOX.maxLat + 0.2,
  minLng: METRO_VANCOUVER_BBOX.minLng - 0.2,
  maxLng: METRO_VANCOUVER_BBOX.maxLng + 0.2,
};

class BadParam extends Error {}

function num(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (raw === null || raw.trim() === '') return undefined;
  const v = Number(raw);
  if (!Number.isFinite(v)) throw new BadParam(`\`${key}\` must be a number.`);
  return v;
}

export function parseBounds(url: URL): { west: number; south: number; east: number; north: number } {
  const west = num(url, 'west');
  const south = num(url, 'south');
  const east = num(url, 'east');
  const north = num(url, 'north');
  if (west === undefined || south === undefined || east === undefined || north === undefined) {
    throw new BadParam('`west`, `south`, `east` and `north` are required.');
  }
  if (west >= east || south >= north) throw new BadParam('Bounds are inverted.');
  if (south < ALLOWED.minLat || north > ALLOWED.maxLat || west < ALLOWED.minLng || east > ALLOWED.maxLng) {
    // Clamp rather than reject: a user zoomed out past the region still gets the region.
    return {
      west: Math.max(west, ALLOWED.minLng),
      east: Math.min(east, ALLOWED.maxLng),
      south: Math.max(south, ALLOWED.minLat),
      north: Math.min(north, ALLOWED.maxLat),
    };
  }
  return { west, south, east, north };
}

export function parseListingQuery(url: URL): ListingQuery {
  const kindRaw = url.searchParams.get('kind');
  if (kindRaw && kindRaw !== 'sale' && kindRaw !== 'rent') throw new BadParam('`kind` must be sale or rent.');
  const typesRaw = url.searchParams.get('types');
  const propertyTypes = typesRaw
    ? typesRaw.split(',').filter((t): t is PropertyType => (PROPERTY_TYPES as readonly string[]).includes(t))
    : undefined;
  const sortRaw = url.searchParams.get('sort');
  const sort = sortRaw === 'price-asc' || sortRaw === 'price-desc' || sortRaw === 'newest' || sortRaw === 'deal' ? sortRaw : undefined;
  return {
    ...parseBounds(url),
    kind: (kindRaw as ListingKind | null) ?? undefined,
    propertyTypes,
    minPrice: num(url, 'minPrice'),
    maxPrice: num(url, 'maxPrice'),
    minBeds: num(url, 'minBeds'),
    sort,
    limit: num(url, 'limit'),
  };
}

export async function handleListingsRequest(request: Request, options: HandlePulseOptions = {}): Promise<Response> {
  const blocked = guardRequest(request, options);
  if (blocked) return blocked;
  try {
    const result = await searchListings(parseListingQuery(new URL(request.url)), undefined, request.signal);
    return json(result, 200, { 'cache-control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300' });
  } catch (err) {
    if (err instanceof BadParam) return json({ error: err.message }, 400);
    console.error('[listings] unhandled error', err);
    return json({ error: 'Could not load listings.' }, 500);
  }
}

export async function handleStopsRequest(request: Request, options: HandlePulseOptions = {}): Promise<Response> {
  const blocked = guardRequest(request, options);
  if (blocked) return blocked;
  try {
    const b = parseBounds(new URL(request.url));
    const index = await loadStopIndex();
    const stops = index
      .inBox({ minLat: b.south, maxLat: b.north, minLng: b.west, maxLng: b.east }, 800)
      .map((s) => ({ id: s.stopId, name: s.name, lat: s.lat, lng: s.lng }));
    return json(
      {
        stops,
        attribution: 'Transit data provided by TransLink',
        placeholder: stops.some((s) => s.id.startsWith('DEV')),
      },
      200,
      { 'cache-control': 'public, max-age=300, s-maxage=3600' },
    );
  } catch (err) {
    if (err instanceof BadParam) return json({ error: err.message }, 400);
    console.error('[stops] unhandled error', err);
    return json({ error: 'Could not load transit stops.' }, 500);
  }
}

const ART_PATH = /\/api\/art\/([A-Za-z0-9_-]{1,40})\.svg$/;

export async function handleArtRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const m = url.pathname.match(ART_PATH);
  if (!m) return json({ error: 'Not found.' }, 404);
  const variant = Math.min(2, Math.max(0, Math.floor(Number(url.searchParams.get('v') ?? 0)) || 0));
  const t = url.searchParams.get('t');
  const kind: ArtKind = t === 'house' || t === 'townhouse' || t === 'duplex' ? t : 'condo';
  return new Response(listingArtSvg(m[1], variant, kind), {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400, immutable',
      'access-control-allow-origin': '*',
    },
  });
}
