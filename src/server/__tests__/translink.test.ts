import { describe, expect, it } from 'vitest';
import { summariseNearby } from '../sources/translink.ts';
import { StopIndex } from '../gtfs/stopIndex.ts';
import type { RtFeed } from '../gtfs/realtime.ts';

const NOW = 1_700_000_000; // fixed epoch seconds so windowing is deterministic

const stopIndex = new StopIndex([
  { stopId: 'S1', code: '1', name: 'Near Stop', lat: 49.2827, lng: -123.1207 },
  { stopId: 'S2', code: '2', name: 'Also Near', lat: 49.2840, lng: -123.1207 },
  { stopId: 'S9', code: '9', name: 'Far Stop', lat: 49.2200, lng: -123.0000 },
]);

const centre = { lat: 49.2827, lng: -123.1207 };

function feed(
  updates: Array<{
    routeId: string;
    stopId: string;
    delaySec: number | null;
    offsetSec?: number;
    tripDelay?: number | null;
  }>,
): RtFeed {
  return {
    version: '2.0',
    timestamp: NOW,
    entities: updates.map((u, i) => ({
      id: `e${i}`,
      vehicle: null,
      alert: null,
      tripUpdate: {
        trip: { tripId: `t${i}`, routeId: u.routeId, startDate: null, startTime: null },
        timestamp: NOW,
        delaySec: u.tripDelay ?? null,
        stopTimeUpdates: [
          {
            stopId: u.stopId,
            stopSequence: 1,
            arrivalDelaySec: null,
            arrivalTime: null,
            departureDelaySec: u.delaySec,
            departureTime: NOW + (u.offsetSec ?? 300),
          },
        ],
      },
    })),
  };
}

describe('summariseNearby', () => {
  it('keeps only departures at stops inside the radius', () => {
    const snapshot = summariseNearby(
      feed([
        { routeId: '99', stopId: 'S1', delaySec: 60 },
        { routeId: '14', stopId: 'S9', delaySec: 900 },
      ]),
      null,
      stopIndex,
      centre,
      500,
      NOW,
    );

    expect(snapshot.departures.map((d) => d.stopId)).toEqual(['S1']);
    expect(snapshot.medianDelaySec).toBe(60);
  });

  it('computes the median delay and the late share', () => {
    const snapshot = summariseNearby(
      feed([
        { routeId: '99', stopId: 'S1', delaySec: 0 },
        { routeId: '99', stopId: 'S1', delaySec: 360 },
        { routeId: '4', stopId: 'S2', delaySec: 420 },
      ]),
      null,
      stopIndex,
      centre,
      500,
      NOW,
    );

    expect(snapshot.medianDelaySec).toBe(360);
    expect(snapshot.lateShare).toBeCloseTo(2 / 3, 5);
  });

  it('falls back to the trip-level delay when the stop has none', () => {
    const snapshot = summariseNearby(
      feed([{ routeId: '99', stopId: 'S1', delaySec: null, tripDelay: 240 }]),
      null,
      stopIndex,
      centre,
      500,
      NOW,
    );
    expect(snapshot.departures[0].delaySec).toBe(240);
  });

  it('discards implausible delays rather than skewing the median', () => {
    const snapshot = summariseNearby(
      feed([
        { routeId: '99', stopId: 'S1', delaySec: 120 },
        { routeId: '99', stopId: 'S1', delaySec: 86_400 },
      ]),
      null,
      stopIndex,
      centre,
      500,
      NOW,
    );
    expect(snapshot.medianDelaySec).toBe(120);
    expect(snapshot.lateShare).toBe(0);
  });

  it('drops stale and far-future predictions', () => {
    const snapshot = summariseNearby(
      feed([
        { routeId: '99', stopId: 'S1', delaySec: 60, offsetSec: -600 },
        { routeId: '99', stopId: 'S1', delaySec: 60, offsetSec: 4 * 3_600 },
        { routeId: '99', stopId: 'S1', delaySec: 60, offsetSec: 600 },
      ]),
      null,
      stopIndex,
      centre,
      500,
      NOW,
    );
    expect(snapshot.departures).toHaveLength(1);
  });

  it('reports no delay signal when nothing is nearby', () => {
    const snapshot = summariseNearby(feed([]), null, stopIndex, centre, 500, NOW);
    expect(snapshot.medianDelaySec).toBeNull();
    expect(snapshot.lateShare).toBeNull();
    expect(snapshot.stops.map((s) => s.stopId)).toEqual(['S1', 'S2']);
  });

  it('keeps only alerts that touch a nearby route or stop', () => {
    const alerts: RtFeed = {
      version: '2.0',
      timestamp: NOW,
      entities: [
        {
          id: 'a1',
          tripUpdate: null,
          vehicle: null,
          alert: {
            header: 'Detour on the 99',
            description: 'Broadway construction',
            url: null,
            routeIds: ['99'],
            stopIds: [],
          },
        },
        {
          id: 'a2',
          tripUpdate: null,
          vehicle: null,
          alert: {
            header: 'Elsewhere entirely',
            description: null,
            url: null,
            routeIds: ['555'],
            stopIds: ['S9'],
          },
        },
      ],
    };

    const snapshot = summariseNearby(
      feed([{ routeId: '99', stopId: 'S1', delaySec: 0 }]),
      alerts,
      stopIndex,
      centre,
      500,
      NOW,
    );

    expect(snapshot.alerts.map((a) => a.id)).toEqual(['a1']);
  });
});
