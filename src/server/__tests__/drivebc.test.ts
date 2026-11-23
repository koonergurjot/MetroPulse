import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRoadEvents } from '../sources/drivebc.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const centre = { lat: 49.2827, lng: -123.1207 };

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const point = (dLng: number, dLat = 0) => ({ type: 'Point', coordinates: [centre.lng + dLng, centre.lat + dLat] });

describe('fetchRoadEvents', () => {
  it('maps Open511 events, lowercases the kind and sorts nearest first', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({
        events: [
          {
            id: 'far',
            headline: 'Lane closure',
            description: 'Right lane closed',
            event_type: 'CONSTRUCTION',
            severity: 'MODERATE',
            updated: '2026-01-02T00:00:00Z',
            geography: point(0.004),
          },
          { id: 'near', headline: 'Crash', event_type: 'INCIDENT', geography: point(0.001) },
        ],
      }),
    ) as unknown as typeof fetch;

    const records = await fetchRoadEvents(centre, 800);

    expect(records.map((r) => r.id)).toEqual(['near', 'far']);
    expect(records[1]).toMatchObject({
      kind: 'construction',
      title: 'Lane closure',
      detail: 'Right lane closed',
      date: '2026-01-02T00:00:00Z',
      extra: { severity: 'MODERATE' },
    });
    expect(records[0].extra).toBeUndefined();
  });

  it('uses the first vertex of a LineString geography', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({
        events: [
          {
            id: 'line',
            event_type: 'ROAD_CONDITION',
            geography: {
              type: 'LineString',
              coordinates: [
                [centre.lng + 0.001, centre.lat],
                [centre.lng + 0.5, centre.lat + 0.5],
              ],
            },
          },
        ],
      }),
    ) as unknown as typeof fetch;

    const [record] = await fetchRoadEvents(centre, 800);
    expect(record.id).toBe('line');
    expect(record.lng).toBeCloseTo(centre.lng + 0.001);
  });

  it('trims the square bounding box back to a true circle', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({
        events: [
          { id: 'inside', geography: point(0.002) },
          // Inside the bbox corner but well past 800 m from the centre.
          { id: 'corner', geography: point(0.0075, 0.0072) },
        ],
      }),
    ) as unknown as typeof fetch;

    const records = await fetchRoadEvents(centre, 800);
    expect(records.map((r) => r.id)).toEqual(['inside']);
  });

  it('skips events with no usable geography and fills defaults', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({ events: [{ id: 'no-geo' }, { geography: point(0.001) }] }),
    ) as unknown as typeof fetch;

    const records = await fetchRoadEvents(centre, 800);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'road-event', title: 'Road event', detail: null, date: null });
    expect(records[0].id).toMatch(/^open511:/);
  });

  it('asks Open511 for active events inside a bounding box', async () => {
    const fetchMock = vi.fn(async () => json({ events: [] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchRoadEvents(centre, 800);

    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.pathname).toBe('/events');
    expect(url.searchParams.get('status')).toBe('ACTIVE');
    expect(url.searchParams.get('bbox')?.split(',')).toHaveLength(4);
  });

  it('fails loudly when the response is not an events collection', async () => {
    globalThis.fetch = vi.fn(async () => json({ something: 'else' })) as unknown as typeof fetch;
    await expect(fetchRoadEvents(centre, 800)).rejects.toThrow();
  });
});
