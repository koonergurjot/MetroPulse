/**
 * The orchestrator: one address in, one merged JSON document out.
 *
 * The whole point of the service is here — five public APIs from four
 * different levels of government, each with its own shape, auth model and
 * reliability, fanned out concurrently behind a single request budget and
 * merged into something a frontend can render without knowing any of that.
 */
import { hasControlCharacters, normalizeAddress } from './address.ts';
import { cache } from './cache.ts';
import { config } from './config.ts';
import { isValidLatLng, METRO_VANCOUVER_BBOX, withinBBox } from './geo.ts';
import { loadStopIndex } from './gtfs/stopProvider.ts';
import { computePulseScore } from './score.ts';
import { BURNABY_META, fetchBurnabyBuildingPermits, fetchSurreyBuildingPermits, SURREY_META } from './sources/arcgis.ts';
import { DRIVEBC_META, fetchRoadEvents } from './sources/drivebc.ts';
import { GEOCODER_META, geocodeAddress } from './sources/geocoder.ts';
import { runSource, skippedSource, toPublicMessage } from './sources/base.ts';
import { fetchAlerts, fetchTripUpdates, summariseNearby, TRANSLINK_META } from './sources/translink.ts';
import type { RtFeed } from './gtfs/realtime.ts';
import {
  fetchBuildingPermits,
  fetchRentalIssues,
  fetchServiceRequests,
  VANCOUVER_META,
} from './sources/vancouver.ts';
import type {
  CivicRecord,
  LatLng,
  PulseResponse,
  ResolvedLocation,
  SourceMeta,
  SourceResult,
  TransitSnapshot,
} from './types.ts';

/** Stands in for the realtime feed when it is unreachable. */
const EMPTY_FEED: RtFeed = { version: null, timestamp: null, entities: [] };

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export interface PulseQuery {
  address?: string;
  lat?: number;
  lng?: number;
  radiusM?: number;
}

/** Cache policies, tuned to how fast each feed actually changes. */
const POLICY = {
  realtime: { ttlMs: 20_000, staleMs: 60_000 },
  alerts: { ttlMs: 120_000, staleMs: 300_000 },
  /** Civic datasets refresh daily at best; a rounded key makes them shareable. */
  civic: { ttlMs: 15 * 60_000, staleMs: 60 * 60_000 },
  roads: { ttlMs: 3 * 60_000, staleMs: 15 * 60_000 },
  geocode: { ttlMs: 24 * 60 * 60_000, staleMs: 7 * 24 * 60 * 60_000 },
} as const;

/**
 * Rounds a point to ~100 m so nearby users share a cache entry. This is the
 * single biggest lever on upstream request volume for the civic datasets.
 */
const geoKey = (lat: number, lng: number, radiusM: number): string =>
  `${lat.toFixed(3)},${lng.toFixed(3)},${radiusM}`;

/** The three civic dataset shapes `PulseResponse.civic` exposes; every municipal adapter maps into these. */
export type CivicCategory = 'serviceRequests' | 'permits' | 'rentalIssues';

type CategoryLoader = (centre: LatLng, radiusM: number, signal?: AbortSignal) => Promise<CivicRecord[]>;

export interface LocalityEntry {
  /** Human name used in labels and skip reasons, e.g. "Vancouver". */
  cityLabel: string;
  /** Attribution/licence for this municipality's portal. */
  base: SourceMeta;
  /** Cache-key and source-id prefix, e.g. "van". */
  cachePrefix: string;
  categories: Partial<Record<CivicCategory, CategoryLoader>>;
}

const CATEGORY_SUFFIX: Record<CivicCategory, string> = {
  serviceRequests: '311',
  permits: 'permits',
  rentalIssues: 'rental',
};

const CATEGORY_LABEL: Record<CivicCategory, string> = {
  serviceRequests: '311 service requests',
  permits: 'building permits',
  rentalIssues: 'rental standards',
};

/**
 * One entry per municipality this app has an adapter for. A locality with no
 * entry here, or an entry missing a category, still produces a `skipped`
 * `SourceResult` with a clear reason — never a silent empty array, which
 * reads to a user as "nothing is happening here".
 */
const LOCALITY_REGISTRY: LocalityEntry[] = [
  {
    cityLabel: 'Vancouver',
    base: VANCOUVER_META,
    cachePrefix: 'van',
    categories: {
      serviceRequests: fetchServiceRequests,
      permits: fetchBuildingPermits,
      rentalIssues: fetchRentalIssues,
    },
  },
  {
    cityLabel: 'Surrey',
    base: SURREY_META,
    cachePrefix: 'surrey',
    categories: {
      permits: fetchSurreyBuildingPermits,
    },
  },
  {
    cityLabel: 'Burnaby',
    base: BURNABY_META,
    cachePrefix: 'burnaby',
    categories: {
      permits: fetchBurnabyBuildingPermits,
    },
  },
];

export function findLocalityEntry(locality: string | null): LocalityEntry | undefined {
  const normalized = locality?.trim().toLowerCase();
  if (!normalized) return undefined;
  return LOCALITY_REGISTRY.find((entry) => entry.cityLabel.toLowerCase() === normalized);
}

function categoryMeta(entry: LocalityEntry | undefined, category: CivicCategory): SourceMeta {
  if (!entry) {
    return { id: `civic.${CATEGORY_SUFFIX[category]}`, label: CATEGORY_LABEL[category], attribution: '', licence: '' };
  }
  return {
    ...entry.base,
    id: `${entry.cachePrefix}.${CATEGORY_SUFFIX[category]}`,
    label: `${entry.cityLabel} ${CATEGORY_LABEL[category]}`,
  };
}

/** Runs a municipal adapter's category through `runSource`, or produces a `skipped` result with a clear reason. */
export function categoryResult(
  entry: LocalityEntry | undefined,
  category: CivicCategory,
  centre: LatLng,
  radiusM: number,
  key: string,
  locality: string | null,
  signal?: AbortSignal,
): Promise<SourceResult<CivicRecord[]>> {
  const meta = categoryMeta(entry, category);
  const loader = entry?.categories[category];
  if (!loader) {
    const reason = entry
      ? `${entry.cityLabel} does not publish ${CATEGORY_LABEL[category]} through this adapter yet.`
      : locality
        ? `Not yet wired up for ${locality}.`
        : 'Municipality unknown for this location; only coordinates were provided.';
    return Promise.resolve(skippedSource<CivicRecord[]>(meta, reason));
  }
  return runSource(meta, `${entry!.cachePrefix}:${CATEGORY_SUFFIX[category]}:${key}`, POLICY.civic, () =>
    loader(centre, radiusM, signal),
  );
}

async function resolveLocation(query: PulseQuery, signal?: AbortSignal): Promise<ResolvedLocation> {
  if (isValidLatLng({ lat: query.lat, lng: query.lng })) {
    const point = { lat: query.lat as number, lng: query.lng as number };
    if (!withinBBox(point, METRO_VANCOUVER_BBOX)) {
      throw new BadRequestError('MetroPulse only covers Metro Vancouver right now.');
    }
    return { ...point, address: null, locality: null, confidence: null, source: 'coordinates' };
  }

  const rawAddress = query.address;
  if (!rawAddress || !rawAddress.trim()) throw new BadRequestError('Provide either an address or lat/lng.');
  if (hasControlCharacters(rawAddress)) throw new BadRequestError('Address contains invalid characters.');

  // Collapse whitespace before it reaches the cache key so "  Main  St " and
  // "Main St" share one entry instead of two upstream geocoder calls.
  const address = normalizeAddress(rawAddress);
  if (!address) throw new BadRequestError('Provide either an address or lat/lng.');
  if (address.length > 200) throw new BadRequestError('That address is too long.');

  // Addresses are re-typed constantly (autocomplete, shared links, refreshes)
  // and the geocoder answer for a given string never changes, so cache hard.
  const hit = await cache.resolve(`geocode:${address.toLowerCase()}`, POLICY.geocode, () =>
    geocodeAddress(address, signal),
  );
  const resolved = hit.value;
  if (!withinBBox(resolved, METRO_VANCOUVER_BBOX)) {
    throw new BadRequestError('That address is outside Metro Vancouver.');
  }
  return resolved;
}

export async function buildPulse(query: PulseQuery, signal?: AbortSignal): Promise<PulseResponse> {
  const startedAt = Date.now();

  const radiusM = Math.min(
    Math.max(Number(query.radiusM) || config.limits.defaultRadiusM, 100),
    config.limits.maxRadiusM,
  );

  const location = await resolveLocation(query, signal);
  const centre = { lat: location.lat, lng: location.lng };
  const key = geoKey(centre.lat, centre.lng, radiusM);

  // One budget for the whole fan-out, so a single slow portal cannot hold the
  // response open past what a user will wait for.
  const budget = new AbortController();
  const budgetTimer = setTimeout(() => budget.abort(new Error('fanout budget exceeded')), config.limits.fanoutBudgetMs);
  const fanoutSignal = signal
    ? ((AbortSignal as { any?: (s: AbortSignal[]) => AbortSignal }).any?.([budget.signal, signal]) ?? budget.signal)
    : budget.signal;

  // Locality is null when the caller supplied raw coordinates, so it never
  // matches a registry entry — we genuinely don't know which municipality's
  // portal to query. `categoryResult` reports that as a clear skip reason.
  const localityEntry = findLocalityEntry(location.locality);

  try {
    const [tripUpdates, alerts, serviceRequests, permits, rentalIssues, roadEvents] = await Promise.all([
      runSource(TRANSLINK_META, 'translink:trip-updates', POLICY.realtime, () => fetchTripUpdates(fanoutSignal)),
      runSource({ ...TRANSLINK_META, id: 'translink.alerts', label: 'TransLink service alerts' }, 'translink:alerts', POLICY.alerts, () =>
        fetchAlerts(fanoutSignal),
      ),
      categoryResult(localityEntry, 'serviceRequests', centre, radiusM, key, location.locality, fanoutSignal),
      categoryResult(localityEntry, 'permits', centre, radiusM, key, location.locality, fanoutSignal),
      categoryResult(localityEntry, 'rentalIssues', centre, radiusM, key, location.locality, fanoutSignal),
      runSource(DRIVEBC_META, `drivebc:${key}`, POLICY.roads, () => fetchRoadEvents(centre, radiusM, fanoutSignal)),
    ]);

    let transit: TransitSnapshot | null = null;
    let transitResult: SourceResult<unknown> = tripUpdates;
    try {
      const stopIndex = await loadStopIndex();
      // The stop index is local, so even with the realtime feed down we can
      // still answer "what serves this address" — an empty feed yields stops
      // with null delays rather than no transit section at all.
      transit = summariseNearby(
        tripUpdates.data ?? EMPTY_FEED,
        alerts.data,
        stopIndex,
        centre,
        radiusM,
      );
    } catch (err) {
      // The stop index itself is unusable; that is a real outage on our side.
      transitResult = { ...tripUpdates, status: 'error', error: toPublicMessage(err) };
    }

    const score = computePulseScore({
      transit,
      serviceRequests: serviceRequests.data ?? [],
      permits: permits.data ?? [],
      rentalIssues: rentalIssues.data ?? [],
      roadEvents: roadEvents.data ?? [],
      availability: {
        civic: serviceRequests.status === 'ok' || serviceRequests.status === 'stale',
        permits: permits.status === 'ok' || permits.status === 'stale',
        rental: rentalIssues.status === 'ok' || rentalIssues.status === 'stale',
      },
    });

    const sources = [
      geocoderSourceResult(location),
      transitResult,
      alerts,
      serviceRequests,
      permits,
      rentalIssues,
      roadEvents,
    ].map(({ data: _data, ...rest }) => rest);

    return {
      location,
      radiusM,
      score,
      transit,
      civic: {
        serviceRequests: serviceRequests.data ?? [],
        permits: permits.data ?? [],
        rentalIssues: rentalIssues.data ?? [],
        roadEvents: roadEvents.data ?? [],
      },
      sources,
      generatedAt: new Date().toISOString(),
      tookMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(budgetTimer);
  }
}

/** The geocoder has already succeeded by the time we get here, by construction. */
function geocoderSourceResult(location: ResolvedLocation): SourceResult<null> {
  return {
    meta: GEOCODER_META,
    status: location.source === 'geocoder' ? 'ok' : 'skipped',
    data: null,
    fetchedAt: new Date().toISOString(),
    ageMs: 0,
    error: location.source === 'coordinates' ? 'Coordinates supplied directly; geocoder not called.' : undefined,
  };
}
