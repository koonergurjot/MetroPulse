/**
 * Flattens a raw TripUpdates feed into rows worth archiving.
 *
 * The feed itself is ephemeral — TransLink doesn't keep history and nobody
 * else in the region archives it — so this is the one place delay history
 * for Metro Vancouver transit gets created.
 */
import { MAX_PLAUSIBLE_DELAY_SEC } from '../sources/translink.ts';
import type { RtFeed } from '../gtfs/realtime.ts';
import type { DelayObservation } from './types.ts';

export function flattenTripUpdates(feed: RtFeed, observedAt: string = new Date().toISOString()): DelayObservation[] {
  const rows: DelayObservation[] = [];
  const seen = new Set<string>();

  for (const entity of feed.entities) {
    const update = entity.tripUpdate;
    if (!update?.trip.tripId) continue;
    const tripId = update.trip.tripId;

    for (const stu of update.stopTimeUpdates) {
      if (!stu.stopId) continue;

      // Prefer departure, fall back to arrival, then to the trip-level delay —
      // same precedence as summariseNearby, so archived and served delays agree.
      const delaySec = stu.departureDelaySec ?? stu.arrivalDelaySec ?? update.delaySec;
      const predictedSec = stu.departureTime ?? stu.arrivalTime;
      if (delaySec === null || predictedSec === null) continue;
      if (Math.abs(delaySec) > MAX_PLAUSIBLE_DELAY_SEC) continue;

      const key = `${tripId}\u0000${stu.stopId}\u0000${predictedSec}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const scheduledSec = predictedSec - delaySec;
      rows.push({
        stopId: stu.stopId,
        routeId: update.trip.routeId,
        tripId,
        scheduledTime: new Date(scheduledSec * 1000).toISOString(),
        predictedTime: new Date(predictedSec * 1000).toISOString(),
        delaySec,
        observedAt,
      });
    }
  }

  return rows;
}
