import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchBurnabyBuildingPermits, fetchSurreyBuildingPermits, queryArcGis } from '../sources/arcgis.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const centre = { lat: 49.1913, lng: -122.849 }; // Surrey City Hall, roughly

const geojson = (features: Array<{ lng: number; lat: number; properties: Record<string, unknown> }>) =>
  new Response(
    JSON.stringify({
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
        properties: f.properties,
      })),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('fetchSurreyBuildingPermits', () => {
  it('maps GeoJSON features into CivicRecord, sorted nearest first', async () => {
    const fetchMock = vi.fn(async () =>
      geojson([
        {
          lng: centre.lng + 0.002,
          lat: centre.lat,
          properties: {
            PERMIT_NO: 'BP-002',
            PERMIT_TYPE: 'New Building',
            ADDRESS: '200 Some St',
            ISSUED_DATE: '2026-01-02',
          },
        },
        {
          lng: centre.lng + 0.001,
          lat: centre.lat,
          properties: {
            PERMIT_NO: 'BP-001',
            PERMIT_TYPE: 'Renovation',
            ADDRESS: '100 Some St',
            ISSUED_DATE: '2026-01-01',
          },
        },
      ]),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const records = await fetchSurreyBuildingPermits(centre, 500);

    expect(records.map((r) => r.id)).toEqual(['BP-001', 'BP-002']);
    expect(records[0]).toMatchObject({
      kind: 'permit',
      title: 'Renovation',
      detail: '100 Some St',
      date: '2026-01-01',
    });
    expect(records[0].distanceM).toBeLessThan(records[1].distanceM);
  });

  it('falls back to an index-based id and null detail/date when fields are missing', async () => {
    globalThis.fetch = vi.fn(async () =>
      geojson([{ lng: centre.lng, lat: centre.lat, properties: {} }]),
    ) as unknown as typeof fetch;

    const records = await fetchSurreyBuildingPermits(centre, 500);

    expect(records).toEqual([
      expect.objectContaining({ id: 'permit:0', title: 'permit', detail: null, date: null }),
    ]);
  });

  it('trims the envelope back to a true circle: a point in the bbox corner outside the radius is dropped', async () => {
    // ~500m north and ~500m east puts this comfortably inside the square
    // envelope around a 500m radius but outside the circle itself.
    const dLat = 500 / 111_320;
    const dLng = dLat / Math.cos((centre.lat * Math.PI) / 180);
    globalThis.fetch = vi.fn(async () =>
      geojson([
        {
          lng: centre.lng + dLng * 0.95,
          lat: centre.lat + dLat * 0.95,
          properties: { PERMIT_NO: 'BP-CORNER' },
        },
      ]),
    ) as unknown as typeof fetch;

    const records = await fetchSurreyBuildingPermits(centre, 500);

    expect(records).toEqual([]);
  });

  it('ignores non-Point geometry', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
                properties: { PERMIT_NO: 'BP-POLY' },
              },
            ],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const records = await fetchSurreyBuildingPermits(centre, 500);
    expect(records).toEqual([]);
  });
});

describe('fetchBurnabyBuildingPermits', () => {
  it('maps GeoJSON features into CivicRecord', async () => {
    globalThis.fetch = vi.fn(async () =>
      geojson([
        {
          lng: centre.lng,
          lat: centre.lat,
          properties: { PERMIT_NO: 'BBY-1', PERMIT_TYPE: 'Addition', ADDRESS: '1 Test Ave' },
        },
      ]),
    ) as unknown as typeof fetch;

    const records = await fetchBurnabyBuildingPermits(centre, 500);
    expect(records).toEqual([
      expect.objectContaining({ id: 'BBY-1', title: 'Addition', detail: '1 Test Ave', kind: 'permit' }),
    ]);
  });
});

describe('queryArcGis', () => {
  it('sends an envelope query with the expected parameters', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(geojson([]));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await queryArcGis({ layerUrl: 'https://example.test/FeatureServer/0', centre, radiusM: 500 });

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.pathname).toBe('/FeatureServer/0/query');
    expect(calledUrl.searchParams.get('geometryType')).toBe('esriGeometryEnvelope');
    expect(calledUrl.searchParams.get('f')).toBe('geojson');
    expect(calledUrl.searchParams.get('where')).toBe('1=1');
    expect(calledUrl.searchParams.get('geometry')?.split(',')).toHaveLength(4);
  });
});
