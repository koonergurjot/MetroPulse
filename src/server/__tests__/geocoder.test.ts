import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from '../sources/geocoder.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('geocodeAddress', () => {
  it('maps the first feature, reading GeoJSON coordinates as [lng, lat]', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({
        features: [
          {
            geometry: { coordinates: [-123.1207, 49.2827] },
            properties: { fullAddress: '555 W Hastings St, Vancouver, BC', localityName: 'Vancouver', score: 92 },
          },
        ],
      }),
    ) as unknown as typeof fetch;

    await expect(geocodeAddress('555 W Hastings St')).resolves.toEqual({
      lng: -123.1207,
      lat: 49.2827,
      address: '555 W Hastings St, Vancouver, BC',
      locality: 'Vancouver',
      confidence: 92,
      source: 'geocoder',
    });
  });

  it('queries the BC geocoder with the address, a province filter and a minimum score', async () => {
    const fetchMock = vi.fn(async () =>
      json({ features: [{ geometry: { coordinates: [-123, 49] }, properties: {} }] }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await geocodeAddress('1 Main St');

    const url = new URL((fetchMock.mock.calls[0] as unknown as [string])[0]);
    expect(url.pathname).toBe('/addresses.json');
    expect(url.searchParams.get('addressString')).toBe('1 Main St');
    expect(url.searchParams.get('provinceCode')).toBe('BC');
    expect(url.searchParams.get('outputSRS')).toBe('4326');
    expect(url.searchParams.get('minScore')).toBe('50');
  });

  it('returns null locality and confidence when the geocoder omits them', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({ features: [{ geometry: { coordinates: [-123, 49] }, properties: {} }] }),
    ) as unknown as typeof fetch;

    const result = await geocodeAddress('somewhere');
    expect(result.locality).toBeNull();
    expect(result.address).toBeNull();
    expect(result.confidence).toBeNull();
  });

  it('reports a non-retryable 404 when nothing matches', async () => {
    const fetchMock = vi.fn(async () => json({ features: [] }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(geocodeAddress('asdf qwer')).rejects.toMatchObject({
      name: 'UpstreamError',
      status: 404,
      retryable: false,
    });
    // A "no match" is an answer, not an outage: it must not be retried.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a feature without usable coordinates as no match', async () => {
    globalThis.fetch = vi.fn(async () =>
      json({ features: [{ geometry: { coordinates: [-123] }, properties: {} }] }),
    ) as unknown as typeof fetch;

    await expect(geocodeAddress('broken')).rejects.toMatchObject({ status: 404 });
  });
});
