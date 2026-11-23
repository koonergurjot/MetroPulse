import { demoProvider } from './demoProvider.ts';
import { median, ppsfOf, scoreListings } from './deals.ts';
import type { Listing, ListingProvider, ListingQuery, ListingsResponse, RawListing } from './types.ts';

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
