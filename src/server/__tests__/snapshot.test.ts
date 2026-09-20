import { describe, expect, it } from 'vitest';
import { flattenTripUpdates } from '../snapshot/flatten.ts';
import type { RtEntity, RtFeed } from '../gtfs/realtime.ts';

const NOW = 1_700_000_000; // fixed epoch seconds so timestamps are deterministic
const OBSERVED_AT = '2023-11-14T22:13:20.000Z';

function entity(
  id: string,
  opts: {
    tripId: string | null;
    routeId?: string | null;
    tripDelay?: number | null;
    stopTimeUpdates: Array<{
      stopId: string | null;
      arrivalDelaySec?: number | null;
      arrivalTime?: number | null;
      departureDelaySec?: number | null;
      departureTime?: number | null;
    }>;
  },
): RtEntity {
  return {
    id,
    vehicle: null,
    alert: null,
    tripUpdate: {
      trip: { tripId: opts.tripId, routeId: opts.routeId ?? null, startDate: null, startTime: null },
      timestamp: NOW,
      delaySec: opts.tripDelay ?? null,
      stopTimeUpdates: opts.stopTimeUpdates.map((stu) => ({
        stopId: stu.stopId,
        stopSequence: 1,
        arrivalDelaySec: stu.arrivalDelaySec ?? null,
        arrivalTime: stu.arrivalTime ?? null,
        departureDelaySec: stu.departureDelaySec ?? null,
        departureTime: stu.departureTime ?? null,
      })),
    },
  };
}

function feed(entities: RtEntity[]): RtFeed {
  return { version: '2.0', timestamp: NOW, entities };
}

describe('flattenTripUpdates', () => {
  it('flattens a stop-time update using the departure prediction', () => {
    const rows = flattenTripUpdates(
      feed([
        entity('e0', {
          tripId: 't1',
          routeId: '99',
          stopTimeUpdates: [{ stopId: 'S1', departureDelaySec: 120, departureTime: NOW + 300 }],
        }),
      ]),
      OBSERVED_AT,
    );

    expect(rows).toEqual([
      {
        stopId: 'S1',
        routeId: '99',
        tripId: 't1',
        scheduledTime: new Date((NOW + 300 - 120) * 1000).toISOString(),
        predictedTime: new Date((NOW + 300) * 1000).toISOString(),
        delaySec: 120,
        observedAt: OBSERVED_AT,
      },
    ]);
  });

  it('falls back to arrival, then to the trip-level delay', () => {
    const rows = flattenTripUpdates(
      feed([
        entity('e0', {
          tripId: 't1',
          stopTimeUpdates: [{ stopId: 'S1', arrivalDelaySec: 60, arrivalTime: NOW + 100 }],
        }),
        entity('e1', {
          tripId: 't2',
          tripDelay: 240,
          stopTimeUpdates: [{ stopId: 'S2', departureTime: NOW + 200 }],
        }),
      ]),
    );

    expect(rows.find((r) => r.tripId === 't1')?.delaySec).toBe(60);
    expect(rows.find((r) => r.tripId === 't2')?.delaySec).toBe(240);
  });

  it('dedupes within a run by (trip_id, stop_id, predicted_time)', () => {
    const rows = flattenTripUpdates(
      feed([
        entity('e0', {
          tripId: 't1',
          stopTimeUpdates: [
            { stopId: 'S1', departureDelaySec: 60, departureTime: NOW + 300 },
            { stopId: 'S1', departureDelaySec: 90, departureTime: NOW + 300 }, // same key, later value dropped
            { stopId: 'S1', departureDelaySec: 60, departureTime: NOW + 600 }, // different predicted time, kept
          ],
        }),
        // Same (trip_id, stop_id, predicted_time) repeated across entities.
        entity('e1', {
          tripId: 't1',
          stopTimeUpdates: [{ stopId: 'S1', departureDelaySec: 60, departureTime: NOW + 300 }],
        }),
      ]),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].delaySec).toBe(60);
    expect(rows.map((r) => r.predictedTime)).toEqual([
      new Date((NOW + 300) * 1000).toISOString(),
      new Date((NOW + 600) * 1000).toISOString(),
    ]);
  });

  it('drops delays beyond the plausible 3-hour window', () => {
    const rows = flattenTripUpdates(
      feed([
        entity('e0', {
          tripId: 't1',
          stopTimeUpdates: [
            { stopId: 'S1', departureDelaySec: 3 * 60 * 60 + 1, departureTime: NOW + 300 },
            { stopId: 'S1', departureDelaySec: 3 * 60 * 60, departureTime: NOW + 600 },
          ],
        }),
      ]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].delaySec).toBe(3 * 60 * 60);
  });

  it('skips stop-time updates missing a stop id, delay, or predicted time', () => {
    const rows = flattenTripUpdates(
      feed([
        entity('e0', {
          tripId: 't1',
          stopTimeUpdates: [
            { stopId: null, departureDelaySec: 60, departureTime: NOW + 300 },
            { stopId: 'S1', departureDelaySec: null, departureTime: null },
            { stopId: 'S2', departureDelaySec: 60, departureTime: null },
          ],
        }),
        entity('e1', { tripId: null, stopTimeUpdates: [{ stopId: 'S3', departureDelaySec: 60, departureTime: NOW }] }),
      ]),
    );

    expect(rows).toHaveLength(0);
  });

  it('ignores entities with no trip update', () => {
    const rows = flattenTripUpdates(feed([{ id: 'a0', tripUpdate: null, vehicle: null, alert: null }]));
    expect(rows).toHaveLength(0);
  });
});
