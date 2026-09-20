/**
 * TransLink GTFS-Realtime.
 *
 * Deliberately region-wide, not per-stop: one poll of the TripUpdates feed
 * covers every rider in Metro Vancouver, so a cached feed plus a local stop
 * index answers "delays near me" without a per-user upstream call. That is
 * what keeps this inside a free API key's quota at a thousand users.
 */
import { config } from '../config.ts';
import { fetchBinary, UpstreamError } from '../http.ts';
import { decodeFeed, type RtFeed } from '../gtfs/realtime.ts';
import type { StopIndex } from '../gtfs/stopIndex.ts';
import type { LatLng, ServiceAlert, SourceMeta, StopDeparture, TransitSnapshot } from '../types.ts';

export const TRANSLINK_META: SourceMeta = {
  id: 'translink.gtfsrt',
  label: 'TransLink real-time',
  attribution: config.translink.attribution,
  licence: config.translink.licence,
};

function withKey(rawUrl: string): string {
  if (!config.translink.apiKey) {
    throw new UpstreamError('TRANSLINK_API_KEY is not configured', null, false);
  }
  const url = new URL(rawUrl);
  url.searchParams.set('apikey', config.translink.apiKey);
  return url.toString();
}

export async function fetchTripUpdates(signal?: AbortSignal): Promise<RtFeed> {
  // The full feed is a few MB of protobuf; give it a longer leash than JSON.
  const buffer = await fetchBinary(withKey(config.translink.tripUpdates), { signal, timeoutMs: 6_000, retries: 1 });
  return decodeFeed(buffer);
}

export async function fetchAlerts(signal?: AbortSignal): Promise<RtFeed> {
  const buffer = await fetchBinary(withKey(config.translink.alerts), { signal, timeoutMs: 4_000, retries: 1 });
  return decodeFeed(buffer);
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

/** Anything beyond this is a data error, not a delay, and would wreck the median. */
const MAX_PLAUSIBLE_DELAY_SEC = 3 * 60 * 60;

/**
 * Reduces the region-wide feed to the stops near one point.
 *
 * `nowSec` is injected so the windowing is testable and so a cached feed is
 * evaluated against request time rather than fetch time.
 */
export function summariseNearby(
  feed: RtFeed,
  alertFeed: RtFeed | null,
  stopIndex: StopIndex,
  centre: LatLng,
  radiusM: number,
  nowSec: number = Math.floor(Date.now() / 1000),
  lookaheadSec = 45 * 60,
): TransitSnapshot {
  const stops = stopIndex.near(centre, radiusM);
  const stopById = new Map(stops.map((s) => [s.stopId, s]));
  const departures: StopDeparture[] = [];

  for (const entity of feed.entities) {
    const update = entity.tripUpdate;
    if (!update) continue;

    for (const stu of update.stopTimeUpdates) {
      if (!stu.stopId) continue;
      const stop = stopById.get(stu.stopId);
      if (!stop) continue;

      // Prefer departure, fall back to arrival, then to the trip-level delay.
      const delayRaw = stu.departureDelaySec ?? stu.arrivalDelaySec ?? update.delaySec;
      const timeSec = stu.departureTime ?? stu.arrivalTime;

      // Drop predictions in the past or beyond the planning horizon.
      if (timeSec !== null && (timeSec < nowSec - 120 || timeSec > nowSec + lookaheadSec)) continue;

      const delaySec =
        delayRaw !== null && Math.abs(delayRaw) <= MAX_PLAUSIBLE_DELAY_SEC ? delayRaw : null;

      departures.push({
        stopId: stu.stopId,
        stopName: stop.name,
        distanceM: stop.distanceM,
        routeId: update.trip.routeId,
        tripId: update.trip.tripId,
        delaySec,
        predictedAt: timeSec !== null ? new Date(timeSec * 1000).toISOString() : null,
      });
    }
  }

  departures.sort((a, b) => {
    if (a.predictedAt && b.predictedAt) return a.predictedAt.localeCompare(b.predictedAt);
    return a.distanceM - b.distanceM;
  });

  const delays = departures.map((d) => d.delaySec).filter((d): d is number => d !== null);
  const nearbyRoutes = new Set(departures.map((d) => d.routeId).filter((r): r is string => !!r));

  const alerts: ServiceAlert[] = [];
  if (alertFeed) {
    for (const entity of alertFeed.entities) {
      const alert = entity.alert;
      if (!alert?.header) continue;
      const touchesRoute = alert.routeIds.some((r) => nearbyRoutes.has(r));
      const touchesStop = alert.stopIds.some((s) => stopById.has(s));
      if (!touchesRoute && !touchesStop) continue;
      alerts.push({
        id: entity.id,
        header: alert.header,
        description: alert.description,
        routeIds: alert.routeIds.filter((r) => nearbyRoutes.has(r)),
        stopIds: alert.stopIds.filter((s) => stopById.has(s)),
        url: alert.url,
      });
    }
  }

  return {
    stops,
    departures: departures.slice(0, config.limits.maxRecordsPerSource),
    medianDelaySec: median(delays),
    lateShare: delays.length > 0 ? delays.filter((d) => d > 300).length / delays.length : null,
    alerts,
    feedTimestamp: feed.timestamp ? new Date(feed.timestamp * 1000).toISOString() : null,
  };
}
