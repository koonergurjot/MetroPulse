/**
 * The orchestrator: one address in, one merged JSON document out.
 *
 * The whole point of the service is here — five public APIs from four
 * different levels of government, each with its own shape, auth model and
 * reliability, fanned out concurrently behind a single request budget and
 * merged into something a frontend can render without knowing any of that.
 */
import { cache } from './cache.ts';
import { config } from './config.ts';
import { isValidLatLng, METRO_VANCOUVER_BBOX, withinBBox } from './geo.ts';
import { loadStopIndex } from './gtfs/stopProvider.ts';
import { computePulseScore } from './score.ts';
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

const CIVIC_META = (label: string, id: string): SourceMeta => ({
  ...VANCOUVER_META,
  id,
  label,
});

async function resolveLocation(query: PulseQuery, signal?: AbortSignal): Promise<ResolvedLocation> {
  if (isValidLatLng({ lat: query.lat, lng: query.lng })) {
    const point = { lat: query.lat as number, lng: query.lng as number };
    if (!withinBBox(point, METRO_VANCOUVER_BBOX)) {
      throw new BadRequestError('MetroPulse only covers Metro Vancouver right now.');
    }
    return { ...point, address: null, locality: null, confidence: null, source: 'coordinates' };
  }

  const address = query.address?.trim();
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

/**
 * Vancouver's portal only holds Vancouver records. Rather than return an empty
 * list that reads as "nothing is happening here", suburbs get an explicit
 * `skipped` source so the UI can say which signals are not available yet.
 */
function usesVancouverDatasets(locality: string | null): boolean {
  return (locality ?? '').toLowerCase().includes('vancouver') && !(locality ?? '').toLowerCase().includes('north');
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

  const municipalOk = usesVancouverDatasets(location.locality) || location.source === 'coordinates';
  const skipReason = `Not yet wired up for ${location.locality ?? 'this municipality'}.`;

  try {
    const [tripUpdates, alerts, serviceRequests, permits, rentalIssues, roadEvents] = await Promise.all([
      runSource(TRANSLINK_META, 'translink:trip-updates', POLICY.realtime, () => fetchTripUpdates(fanoutSignal)),
      runSource({ ...TRANSLINK_META, id: 'translink.alerts', label: 'TransLink service alerts' }, 'translink:alerts', POLICY.alerts, () =>
        fetchAlerts(fanoutSignal),
      ),
      municipalOk
        ? runSource(CIVIC_META('Vancouver 311', 'vancouver.311'), `van:311:${key}`, POLICY.civic, () =>
            fetchServiceRequests(centre, radiusM, fanoutSignal),
          )
        : skippedSource<CivicRecord[]>(CIVIC_META('Vancouver 311', 'vancouver.311'), skipReason),
      municipalOk
        ? runSource(CIVIC_META('Vancouver building permits', 'vancouver.permits'), `van:permits:${key}`, POLICY.civic, () =>
            fetchBuildingPermits(centre, radiusM, fanoutSignal),
          )
        : skippedSource<CivicRecord[]>(CIVIC_META('Vancouver building permits', 'vancouver.permits'), skipReason),
      municipalOk
        ? runSource(CIVIC_META('Vancouver rental standards', 'vancouver.rental'), `van:rental:${key}`, POLICY.civic, () =>
            fetchRentalIssues(centre, radiusM, fanoutSignal),
          )
        : skippedSource<CivicRecord[]>(CIVIC_META('Vancouver rental standards', 'vancouver.rental'), skipReason),
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
