import type { PulseResponse } from './server/types';
import type { Listing, ListingsResponse, MarketSnapshot, ProviderInfo } from './server/listings/types';

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface ListingFilters {
  kind: 'sale' | 'rent';
  types: Array<'condo' | 'townhouse' | 'house' | 'duplex'>;
  maxPrice: number | null;
  minBeds: number;
  sort: 'deal' | 'price-asc' | 'price-desc' | 'newest';
}

export interface StopsResponse {
  stops: Array<{ id: string; name: string; lat: number; lng: number }>;
  attribution: string;
  placeholder: boolean;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfterSec: number | null) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const retry = Number(res.headers.get('retry-after'));
    throw new ApiError(body && typeof body.error === 'string' ? body.error : 'Request failed.', res.status, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return body as T;
}

const bbox = (b: Bounds): string => `west=${b.west.toFixed(5)}&south=${b.south.toFixed(5)}&east=${b.east.toFixed(5)}&north=${b.north.toFixed(5)}`;

export function fetchListings(b: Bounds, f: ListingFilters, signal?: AbortSignal): Promise<ListingsResponse> {
  const p = new URLSearchParams({ kind: f.kind, sort: f.sort, limit: '300' });
  if (f.types.length > 0 && f.types.length < 4) p.set('types', f.types.join(','));
  if (f.maxPrice !== null) p.set('maxPrice', String(f.maxPrice));
  if (f.minBeds > 0) p.set('minBeds', String(f.minBeds));
  return getJson(`/api/listings?${bbox(b)}&${p}`, signal);
}

export function fetchStops(b: Bounds, signal?: AbortSignal): Promise<StopsResponse> {
  return getJson(`/api/stops?${bbox(b)}`, signal);
}

export type PulseQuery =
  | { address: string }
  | { slug: string }
  | { lat: number; lng: number; locality?: string };

export function fetchPulse(q: PulseQuery, signal?: AbortSignal): Promise<PulseResponse> {
  const p = new URLSearchParams();
  if ('address' in q) p.set('address', q.address);
  else if ('slug' in q) p.set('slug', q.slug);
  else {
    p.set('lat', String(q.lat));
    p.set('lng', String(q.lng));
    if (q.locality) p.set('locality', q.locality);
  }
  return getJson(`/api/pulse?${p}`, signal);
}

export const money = (n: number, kind: 'sale' | 'rent'): string =>
  kind === 'rent' ? `$${n.toLocaleString('en-CA')}/mo` : `$${n.toLocaleString('en-CA')}`;

export const compactMoney = (n: number, kind: 'sale' | 'rent'): string => {
  if (kind === 'rent') return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}M`;
  return `$${Math.round(n / 1000)}k`;
};

export function fetchListingsByIds(ids: string[], signal?: AbortSignal): Promise<{ listings: Listing[]; provider: ProviderInfo }> {
  return getJson(`/api/listings/batch?ids=${encodeURIComponent(ids.join(','))}`, signal);
}

export function fetchMarket(b: Bounds, kind: 'sale' | 'rent', signal?: AbortSignal): Promise<MarketSnapshot> {
  return getJson(`/api/market?${bbox(b)}&kind=${kind}`, signal);
}
