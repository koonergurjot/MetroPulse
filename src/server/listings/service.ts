import { demoProvider } from './demoProvider.ts';
import { median, ppsfOf, scoreListings } from './deals.ts';
import type { Listing, ListingKind, ListingProvider, ListingQuery, ListingsResponse, MarketRow, MarketSnapshot, RawListing } from './types.ts';

/** Single seam to swap in a licensed provider (DDF via brokerage partner, Repliers, ...). */
export function getProvider(): ListingProvider {
  return demoProvider;
}

const MAX_LIMIT = 300;

function matches(l: RawListing, q: ListingQuery): boolean {
  if (q.kind && l.kind !== q.kind) return false;
  if (q.propertyTypes && q.propertyTypes.length > 0 && !q.propertyTypes.includes(l.propertyType)) return false;
  if (q.minPrice !== undefined && l.price < q.minPrice) return false;
  if (q.maxPrice !== undefined && l.price > q.maxPrice) return false;
  if (q.minBeds !== undefined && l.beds < q.minBeds) return false;
  return true;
}

function sortListings(list: Listing[], key: ListingQuery['sort']): Listing[] {
  const sorted = [...list];
  switch (key) {
    case 'price-asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'newest':
      return sorted.sort((a, b) => a.daysOnMarket - b.daysOnMarket);
    default:
      return sorted.sort((a, b) => b.deal.score - a.deal.score);
  }
}

export async function searchListings(
  query: ListingQuery,
  provider: ListingProvider = getProvider(),
  signal?: AbortSignal,
): Promise<ListingsResponse> {
  const raw = await provider.fetch(query, signal);
  // Score against the whole viewport result so filters don't change what "market" means.
  const scored = scoreListings(raw.filter((l) => matches(l, query)), raw);
  const limit = Math.min(Math.max(1, query.limit ?? 150), MAX_LIMIT);
  const listings = sortListings(scored, query.sort).slice(0, limit);

  return {
    listings,
    stats: {
      count: scored.length,
      medianPrice: median(scored.map((l) => l.price)),
      medianPpsf: median(scored.map((l) => ppsfOf(l)).filter((p): p is number => p !== null)),
    },
    provider: provider.info,
    generatedAt: new Date().toISOString(),
  };
}

/** Whole-region bounds used as the comparison population for lookups by id. */
const REGION = { west: -124, south: 48.7, east: -121.5, north: 49.8 };

/** Looks listings up by id (saved homes, compare, deep links). Scored against the whole region so the numbers match the map. */
export async function getListingsByIds(
  ids: string[],
  provider: ListingProvider = getProvider(),
  signal?: AbortSignal,
): Promise<{ listings: Listing[]; provider: ListingsResponse['provider'] }> {
  const wanted = new Set(ids);
  const population = await provider.fetch({ ...REGION }, signal);
  const scored = scoreListings(population.filter((l) => wanted.has(l.id)), population);
  // Preserve the caller's order.
  const order = new Map(ids.map((id, i) => [id, i]));
  scored.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return { listings: scored, provider: provider.info };
}

/** Pure aggregation, exported for tests. */
export function summariseMarket(listings: RawListing[]): MarketRow[] {
  const by = new Map<string, RawListing[]>();
  for (const l of listings) {
    const bucket = by.get(l.municipality);
    if (bucket) bucket.push(l);
    else by.set(l.municipality, [l]);
  }
  return [...by.entries()]
    .map(([municipality, items]): MarketRow => ({
      municipality,
      count: items.length,
      medianPrice: median(items.map((l) => l.price)),
      medianPpsf: median(items.map((l) => ppsfOf(l)).filter((p): p is number => p !== null)),
      medianDaysOnMarket: median(items.map((l) => l.daysOnMarket)),
      priceCutShare: items.filter((l) => l.priceDrop !== null).length / items.length,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function marketSnapshot(
  query: Pick<ListingQuery, 'west' | 'south' | 'east' | 'north'> & { kind: ListingKind },
  provider: ListingProvider = getProvider(),
  signal?: AbortSignal,
): Promise<MarketSnapshot> {
  const raw = (await provider.fetch(query, signal)).filter((l) => l.kind === query.kind);
  return { kind: query.kind, rows: summariseMarket(raw), provider: provider.info, generatedAt: new Date().toISOString() };
}
