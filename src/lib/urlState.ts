import type { ListingFilters } from '../api';

export interface UrlState {
  filters: Partial<ListingFilters>;
  listing: string | null;
  view: { lng: number; lat: number; zoom: number } | null;
  layersOff: string[];
}

const TYPES = ['condo', 'townhouse', 'house', 'duplex'] as const;
const SORTS = ['deal', 'price-asc', 'price-desc', 'newest'] as const;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const finite = (n: number): boolean => Number.isFinite(n);

export function parseUrlState(search: string): UrlState {
  const q = new URLSearchParams(search);
  const filters: Partial<ListingFilters> = {};
  const kind = q.get('k');
  if (kind === 'sale' || kind === 'rent') filters.kind = kind;
  const types = (q.get('t') ?? '').split(',').filter((t): t is (typeof TYPES)[number] => (TYPES as readonly string[]).includes(t));
  if (types.length > 0) filters.types = types;
  const beds = Number(q.get('b'));
  if (q.get('b') !== null && finite(beds) && beds >= 0 && beds <= 6) filters.minBeds = Math.floor(beds);
  const max = Number(q.get('p'));
  if (q.get('p') !== null && finite(max) && max > 0 && max < 1e8) filters.maxPrice = Math.floor(max);
  const sort = q.get('s');
  if (sort && (SORTS as readonly string[]).includes(sort)) filters.sort = sort as ListingFilters['sort'];

  const l = q.get('l');
  const listing = l && ID.test(l) ? l : null;

  let view: UrlState['view'] = null;
  const v = q.get('v');
  if (v) {
    const [lng, lat, zoom] = v.split(',').map(Number);
    if ([lng, lat, zoom].every(finite) && lat > 48 && lat < 50.2 && lng > -125 && lng < -121 && zoom >= 8 && zoom <= 20) view = { lng, lat, zoom };
  }
  const layersOff = (q.get('off') ?? '').split(',').filter((s) => /^[a-z]{1,12}$/.test(s));
  return { filters, listing, view, layersOff };
}

export function serializeUrlState(
  filters: ListingFilters,
  defaults: ListingFilters,
  listing: string | null,
  view: { lng: number; lat: number; zoom: number } | null,
  layersOff: string[],
): string {
  const q = new URLSearchParams();
  if (filters.kind !== defaults.kind) q.set('k', filters.kind);
  if (filters.types.length !== 4) q.set('t', filters.types.join(','));
  if (filters.minBeds !== defaults.minBeds) q.set('b', String(filters.minBeds));
  if (filters.maxPrice !== null) q.set('p', String(filters.maxPrice));
  if (filters.sort !== defaults.sort) q.set('s', filters.sort);
  if (listing) q.set('l', listing);
  if (view) q.set('v', `${view.lng.toFixed(4)},${view.lat.toFixed(4)},${view.zoom.toFixed(1)}`);
  if (layersOff.length > 0) q.set('off', layersOff.join(','));
  const s = q.toString();
  return s ? `?${s}` : '';
}
