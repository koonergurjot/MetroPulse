/**
 * Listings contract.
 *
 * MetroPulse does NOT scrape listing sites. Canadian courts have enforced
 * site terms and awarded statutory copyright damages against scrapers of real
 * estate listings and photos (Century 21 v. Zoocasa, 2011 BCSC 1196), and
 * MLS(R) data is only licensed through CREA DDF / board IDX feeds sponsored by
 * a brokerage. Everything the UI knows about listings therefore flows through
 * the `ListingProvider` interface below. Today the only provider is a clearly
 * labelled demo generator; a licensed provider (DDF via a brokerage partner,
 * Repliers, user-submitted rentals) plugs in without any UI change.
 */
import type { LatLng } from '../types.ts';

export type ListingKind = 'sale' | 'rent';
export type PropertyType = 'condo' | 'townhouse' | 'house' | 'duplex';

export type DealFlag = 'new' | 'price-drop' | 'below-market' | 'negotiable';

export interface PriceDrop {
  fromPrice: number;
  /** Positive percentage, e.g. 4.2 means the price fell 4.2%. */
  pct: number;
}

export interface ListingDeal {
  flags: DealFlag[];
  /** Price per square foot (monthly for rentals). Null when sqft is unknown. */
  ppsf: number | null;
  /** Median $/sqft of comparable listings (same kind, type, municipality). */
  cohortMedianPpsf: number | null;
  /** Negative = cheaper than comparable listings. Null with no usable cohort. */
  vsMedianPct: number | null;
  /** 0-100 "worth a look" indicator. An indicator, not a valuation. */
  score: number;
  headline: string | null;
}

export interface Listing extends LatLng {
  id: string;
  kind: ListingKind;
  propertyType: PropertyType;
  /** Display address. Demo data uses an intersection hint, never a real civic address. */
  address: string;
  neighbourhood: string;
  municipality: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  yearBuilt: number | null;
  daysOnMarket: number;
  priceDrop: PriceDrop | null;
  features: string[];
  /** Absolute-path URLs (same origin) or https URLs the provider is licensed to display. */
  photos: string[];
  brokerage: string | null;
  deal: ListingDeal;
}

export interface ListingSort {
  key: 'deal' | 'price-asc' | 'price-desc' | 'newest';
}

export interface ListingQuery {
  west: number;
  south: number;
  east: number;
  north: number;
  kind?: ListingKind;
  propertyTypes?: PropertyType[];
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  sort?: ListingSort['key'];
  limit?: number;
}

export interface ProviderInfo {
  id: string;
  label: string;
  /** True when the data is synthetic. The UI must show this prominently. */
  demo: boolean;
  /** Plain-language licence / provenance line shown in the UI. */
  notice: string;
}

/** Listing before the comparison engine has scored it. */
export type RawListing = Omit<Listing, 'deal'>;

export interface ListingProvider {
  info: ProviderInfo;
  /** Return raw listings inside the query's bounds. Filtering/scoring/sorting happen downstream. */
  fetch(query: ListingQuery, signal?: AbortSignal): Promise<RawListing[]>;
}

export interface ListingStats {
  count: number;
  medianPrice: number | null;
  medianPpsf: number | null;
}

export interface ListingsResponse {
  listings: Listing[];
  stats: ListingStats;
  provider: ProviderInfo;
  generatedAt: string;
}
