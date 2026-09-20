/**
 * BC Address Geocoder (DataBC).
 *
 * This is the join key for the whole product: a free-text address in, a
 * province-wide canonical point and locality out. The locality is what picks
 * the municipal adapter downstream — an address that geocodes to "Surrey" must
 * not be queried against Vancouver's 311 dataset.
 */
import { config } from '../config.ts';
import { fetchJson, UpstreamError } from '../http.ts';
import type { ResolvedLocation, SourceMeta } from '../types.ts';

export const GEOCODER_META: SourceMeta = {
  id: 'databc.geocoder',
  label: 'BC Address Geocoder',
  attribution: config.geocoder.attribution,
  licence: config.geocoder.licence,
};

interface GeocoderResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: {
      fullAddress?: string;
      localityName?: string;
      score?: number;
// The geocoder also returns matchPrecision/faults, kept out of the type
// because we deliberately do not branch on them.
    };
  }>;
}

export async function geocodeAddress(
  addressString: string,
  signal?: AbortSignal,
): Promise<Omit<ResolvedLocation, 'slug'>> {
  const url = new URL('/addresses.json', config.geocoder.base);
  url.searchParams.set('addressString', addressString);
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('outputSRS', '4326');
  url.searchParams.set('provinceCode', 'BC');
  // Cut obvious noise: without this a typo can match a locality centroid.
  url.searchParams.set('minScore', '50');

  const headers: Record<string, string> = {};
  if (config.geocoder.apiKey) headers.apikey = config.geocoder.apiKey;

  const body = await fetchJson<GeocoderResponse>(url.toString(), { headers, signal, timeoutMs: 3_500 });
  const feature = body.features?.[0];
  const coords = feature?.geometry?.coordinates;

  if (!coords || coords.length < 2) {
    throw new UpstreamError('no match for that address', 404, false);
  }

  // GeoJSON order is [longitude, latitude].
  return {
    lng: coords[0],
    lat: coords[1],
    address: feature?.properties?.fullAddress ?? null,
    locality: feature?.properties?.localityName ?? null,
    confidence: typeof feature?.properties?.score === 'number' ? feature.properties.score : null,
    source: 'geocoder',
  };
}
