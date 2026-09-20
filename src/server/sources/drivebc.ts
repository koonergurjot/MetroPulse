/**
 * DriveBC Open511 road events: closures, construction and incidents.
 *
 * Open511 is a bbox query with no key, and it is the one source that covers
 * every municipality in the region uniformly — which makes it the fallback
 * "is something happening here" signal for the suburbs whose open-data
 * portals are thinner than Vancouver's.
 */
import { config } from '../config.ts';
import { bboxAround, haversineM } from '../geo.ts';
import { fetchJson } from '../http.ts';
import type { CivicRecord, LatLng, SourceMeta } from '../types.ts';

export const DRIVEBC_META: SourceMeta = {
  id: 'drivebc.open511',
  label: 'DriveBC road events',
  attribution: config.drivebc.attribution,
  licence: config.drivebc.licence,
};

interface Open511Response {
  events?: Array<{
    id?: string;
    headline?: string;
    description?: string;
    event_type?: string;
    severity?: string;
    updated?: string;
    geography?: { type?: string; coordinates?: unknown };
  }>;
}

/** Open511 geographies are Point or LineString; take the first vertex either way. */
function firstVertex(geography: { type?: string; coordinates?: unknown } | undefined): LatLng | null {
  const coords = geography?.coordinates;
  if (!Array.isArray(coords)) return null;
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return { lng: coords[0], lat: coords[1] };
  }
  const first = coords[0];
  if (Array.isArray(first) && typeof first[0] === 'number' && typeof first[1] === 'number') {
    return { lng: first[0], lat: first[1] };
  }
  return null;
}

export async function fetchRoadEvents(centre: LatLng, radiusM: number, signal?: AbortSignal): Promise<CivicRecord[]> {
  const box = bboxAround(centre, radiusM);
  const url = new URL('/events', config.drivebc.base);
  url.searchParams.set('bbox', [box.minLng, box.minLat, box.maxLng, box.maxLat].join(','));
  url.searchParams.set('status', 'ACTIVE');
  url.searchParams.set('format', 'json');

  const body = await fetchJson<Open511Response>(url.toString(), { signal, timeoutMs: 4_000 });

  const out: CivicRecord[] = [];
  for (const event of body.events ?? []) {
    const point = firstVertex(event.geography);
    if (!point) continue;
    const distanceM = Math.round(haversineM(centre, point));
    // The bbox is square; trim the corners so "within 800 m" means it.
    if (distanceM > radiusM) continue;
    out.push({
      id: event.id ?? `open511:${out.length}`,
      kind: (event.event_type ?? 'road-event').toLowerCase(),
      title: event.headline ?? 'Road event',
      detail: event.description ?? null,
      date: event.updated ?? null,
      distanceM,
      lat: point.lat,
      lng: point.lng,
      extra: event.severity ? { severity: event.severity } : undefined,
    });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM).slice(0, config.limits.maxRecordsPerSource);
}
