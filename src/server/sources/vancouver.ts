/**
 * City of Vancouver Open Data, via the Opendatasoft Explore API v2.1.
 *
 * One adapter covers four datasets because Opendatasoft gives every dataset
 * the same query surface, including a server-side `distance()` geo filter —
 * so the radius search happens upstream and we never page through a city's
 * worth of records. New Westminster and Richmond run the same platform, so
 * this adapter is reused for them by swapping the base URL.
 */
import { config } from '../config.ts';
import { fetchJson } from '../http.ts';
import { haversineM } from '../geo.ts';
import type { CivicRecord, LatLng, SourceMeta } from '../types.ts';

export const VANCOUVER_META: SourceMeta = {
  id: 'vancouver.opendata',
  label: 'City of Vancouver Open Data',
  attribution: config.vancouver.attribution,
  licence: config.vancouver.licence,
};

interface OdsResponse {
  total_count?: number;
  results?: Array<Record<string, unknown>>;
}

const asString = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
};

/**
 * Opendatasoft returns geo fields in more than one shape depending on the
 * dataset: a `{lat, lon}` object, a GeoJSON geometry, or bare columns.
 */
function extractPoint(record: Record<string, unknown>): LatLng | null {
  for (const key of ['geom', 'geo_point_2d', 'point', 'geo_local_area_point']) {
    const value = record[key];
    if (!value) continue;
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (typeof obj.lat === 'number' && typeof obj.lon === 'number') {
        return { lat: obj.lat, lng: obj.lon };
      }
      const geometry = (obj.geometry ?? obj) as Record<string, unknown>;
      const coords = geometry.coordinates;
      if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        return { lng: coords[0], lat: coords[1] };
      }
    }
    if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
      // ODS v1 emitted [lat, lon] for geo_point_2d.
      return { lat: value[0], lng: value[1] };
    }
  }
  const lat = record.latitude ?? record.lat;
  const lng = record.longitude ?? record.lon ?? record.long;
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng };
  return null;
}

/** First key present on the record whose value is a non-empty string. */
const pick = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
};

export interface OdsQuery {
  dataset: string;
  centre: LatLng;
  radiusM: number;
  /** Extra ODQL appended with AND, e.g. a recency filter. */
  where?: string;
  limit?: number;
  orderBy?: string;
  geoField?: string;
  signal?: AbortSignal;
  base?: string;
}

export async function queryOds(query: OdsQuery): Promise<Array<Record<string, unknown>>> {
  const base = query.base ?? config.vancouver.base;
  const url = new URL(`${base}/catalog/datasets/${encodeURIComponent(query.dataset)}/records`);
  const geoField = query.geoField ?? 'geom';
  const clauses = [
    `distance(${geoField}, geom'POINT(${query.centre.lng} ${query.centre.lat})', ${Math.round(query.radiusM)}m)`,
  ];
  if (query.where) clauses.push(`(${query.where})`);

  url.searchParams.set('where', clauses.join(' AND '));
  url.searchParams.set('limit', String(Math.min(query.limit ?? config.limits.maxRecordsPerSource, 100)));
  if (query.orderBy) url.searchParams.set('order_by', query.orderBy);

  const body = await fetchJson<OdsResponse>(url.toString(), { signal: query.signal, timeoutMs: 4_000 });
  return body.results ?? [];
}

function toRecords(
  raw: Array<Record<string, unknown>>,
  centre: LatLng,
  kind: string,
  titleKeys: string[],
  detailKeys: string[],
  dateKeys: string[],
  idKeys: string[],
): CivicRecord[] {
  const out: CivicRecord[] = [];
  raw.forEach((record, i) => {
    const point = extractPoint(record);
    if (!point) return;
    out.push({
      id: pick(record, idKeys) ?? `${kind}:${i}`,
      kind,
      title: pick(record, titleKeys) ?? kind,
      detail: pick(record, detailKeys),
      date: pick(record, dateKeys),
      distanceM: Math.round(haversineM(centre, point)),
      lat: point.lat,
      lng: point.lng,
    });
  });
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

/** Open 311 cases near a point, newest first. */
export async function fetchServiceRequests(centre: LatLng, radiusM: number, signal?: AbortSignal): Promise<CivicRecord[]> {
  const raw = await queryOds({
    dataset: config.vancouver.datasets.serviceRequests,
    centre,
    radiusM,
    orderBy: 'service_request_open_timestamp DESC',
    signal,
  });
  return toRecords(
    raw,
    centre,
    '311',
    ['service_request_type', 'servicerequesttype', 'type'],
    ['status', 'department', 'channel'],
    ['service_request_open_timestamp', 'opendate', 'date'],
    ['service_request_id', 'id'],
  );
}

/** Issued building permits — the "is a tower going up next door" signal. */
export async function fetchBuildingPermits(centre: LatLng, radiusM: number, signal?: AbortSignal): Promise<CivicRecord[]> {
  const raw = await queryOds({
    dataset: config.vancouver.datasets.buildingPermits,
    centre,
    radiusM,
    orderBy: 'issuedate DESC',
    signal,
  });
  return toRecords(
    raw,
    centre,
    'permit',
    ['typeofwork', 'projectvalue', 'permitnumber'],
    ['specificusecategory', 'propertyuse', 'address'],
    ['issuedate', 'permitelapseddays'],
    ['permitnumber', 'id'],
  );
}

/**
 * Rental Standards open issues: outstanding bylaw violations on rental
 * buildings. Small dataset, disproportionately useful — this is the one
 * signal a listing will never tell a renter.
 */
export async function fetchRentalIssues(centre: LatLng, radiusM: number, signal?: AbortSignal): Promise<CivicRecord[]> {
  const raw = await queryOds({
    dataset: config.vancouver.datasets.rentalStandards,
    centre,
    radiusM,
    signal,
  });
  return toRecords(
    raw,
    centre,
    'rental-issue',
    ['streetnumber', 'street', 'businessoperator'],
    ['totaloutstanding', 'totalunits'],
    ['lastinspectiondate'],
    ['folderid', 'id'],
  );
}
