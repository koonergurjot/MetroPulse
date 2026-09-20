/**
 * Surrey and Burnaby Open Data, via Esri ArcGIS REST FeatureServer.
 *
 * Unlike Opendatasoft, ArcGIS FeatureServer has no server-side radius filter —
 * only an envelope (bbox) spatial query — so every request sends a square
 * `geometryType=esriGeometryEnvelope` around the point and the client trims
 * the corners back to a true circle with `haversineM`, the same way
 * drivebc.ts does for Open511's bbox. Metro Vancouver runs the same platform
 * and can reuse this adapter by pointing `queryArcGis` at its FeatureServer
 * layer URL.
 *
 * VERIFY BEFORE LAUNCH: layer URLs and field names below are transcribed
 * from each portal's REST services directory and are not checked against the
 * live services in CI. Run `npm run verify:sources` before a deploy.
 */
import { config } from '../config.ts';
import { bboxAround, haversineM } from '../geo.ts';
import { fetchJson } from '../http.ts';
import type { CivicRecord, LatLng, SourceMeta } from '../types.ts';

export const SURREY_META: SourceMeta = {
  id: 'surrey.opendata',
  label: 'City of Surrey Open Data',
  attribution: config.surrey.attribution,
  licence: config.surrey.licence,
};

export const BURNABY_META: SourceMeta = {
  id: 'burnaby.opendata',
  label: 'City of Burnaby Open Data',
  attribution: config.burnaby.attribution,
  licence: config.burnaby.licence,
};

interface ArcGisFeature {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
}

interface ArcGisFeatureCollection {
  type?: string;
  features?: ArcGisFeature[];
}

const asString = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return null;
};

/** First key present on the record whose value is a non-empty string. */
const pick = (record: Record<string, unknown>, keys: string[]): string | null => {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
};

/** `f=geojson` always returns WGS84 Point geometry for a point layer; other geometry types are not handled. */
function extractPoint(geometry: ArcGisFeature['geometry']): LatLng | null {
  if (geometry?.type !== 'Point') return null;
  const coords = geometry.coordinates;
  if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return { lng: coords[0], lat: coords[1] };
  }
  return null;
}

export interface ArcGisQuery {
  /** Full FeatureServer layer URL, e.g. `${config.surrey.base}/0`. */
  layerUrl: string;
  centre: LatLng;
  radiusM: number;
  outFields?: string;
  /** Extra SQL-ish predicate ANDed onto the default `1=1`. */
  where?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface ArcGisRecord {
  point: LatLng;
  properties: Record<string, unknown>;
}

export async function queryArcGis(query: ArcGisQuery): Promise<ArcGisRecord[]> {
  const box = bboxAround(query.centre, query.radiusM);
  const url = new URL(`${query.layerUrl}/query`);
  url.searchParams.set('geometry', [box.minLng, box.minLat, box.maxLng, box.maxLat].join(','));
  url.searchParams.set('geometryType', 'esriGeometryEnvelope');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', query.outFields ?? '*');
  url.searchParams.set('where', query.where ?? '1=1');
  url.searchParams.set('resultRecordCount', String(Math.min(query.limit ?? config.limits.maxRecordsPerSource, 200)));
  url.searchParams.set('f', 'geojson');

  const body = await fetchJson<ArcGisFeatureCollection>(url.toString(), { signal: query.signal, timeoutMs: 4_000 });

  const out: ArcGisRecord[] = [];
  for (const feature of body.features ?? []) {
    const point = extractPoint(feature.geometry);
    if (!point) continue;
    out.push({ point, properties: feature.properties ?? {} });
  }
  return out;
}

function toRecords(
  raw: ArcGisRecord[],
  centre: LatLng,
  radiusM: number,
  kind: string,
  titleKeys: string[],
  detailKeys: string[],
  dateKeys: string[],
  idKeys: string[],
): CivicRecord[] {
  const out: CivicRecord[] = [];
  raw.forEach(({ point, properties }, i) => {
    const distanceM = Math.round(haversineM(centre, point));
    // The envelope is square; trim the corners so "within 800 m" means it.
    if (distanceM > radiusM) return;
    out.push({
      id: pick(properties, idKeys) ?? `${kind}:${i}`,
      kind,
      title: pick(properties, titleKeys) ?? kind,
      detail: pick(properties, detailKeys),
      date: pick(properties, dateKeys),
      distanceM,
      lat: point.lat,
      lng: point.lng,
    });
  });
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

/** Issued building permits, City of Surrey. Field names unverified — see file header. */
export async function fetchSurreyBuildingPermits(centre: LatLng, radiusM: number, signal?: AbortSignal): Promise<CivicRecord[]> {
  const layerUrl = `${config.surrey.base}/${config.surrey.layers.buildingPermits}`;
  const raw = await queryArcGis({ layerUrl, centre, radiusM, signal });
  return toRecords(
    raw,
    centre,
    radiusM,
    'permit',
    ['PERMIT_TYPE', 'PermitType', 'WORK_TYPE'],
    ['ADDRESS', 'SITE_ADDRESS', 'PROPERTY_USE'],
    ['ISSUED_DATE', 'IssueDate', 'ISSUEDATE'],
    ['PERMIT_NO', 'PermitNumber', 'PERMITNO'],
  );
}

/** Issued building permits, City of Burnaby. Field names unverified — see file header. */
export async function fetchBurnabyBuildingPermits(centre: LatLng, radiusM: number, signal?: AbortSignal): Promise<CivicRecord[]> {
  const layerUrl = `${config.burnaby.base}/${config.burnaby.layers.buildingPermits}`;
  const raw = await queryArcGis({ layerUrl, centre, radiusM, signal });
  return toRecords(
    raw,
    centre,
    radiusM,
    'permit',
    ['PERMIT_TYPE', 'PermitType', 'WORK_TYPE'],
    ['ADDRESS', 'SITE_ADDRESS', 'PROPERTY_USE'],
    ['ISSUED_DATE', 'IssueDate', 'ISSUEDATE'],
    ['PERMIT_NO', 'PermitNumber', 'PERMITNO'],
  );
}
