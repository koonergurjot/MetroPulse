/**
 * Comparison engine behind the "deals" badges.
 *
 * Deliberately simple and explainable: a listing is compared with the median
 * $/sqft of comparable listings in the same municipality (same kind and
 * property type). It is a "worth a look" signal, never an appraisal; the UI
 * says so.
 */
import type { DealFlag, Listing, ListingDeal, RawListing } from './types.ts';

/** Fewer comparables than this and we fall back to the regional cohort. */
const MIN_COHORT = 4;
const BELOW_MARKET_PCT = -8;
const NEW_DAYS = 3;
const NEGOTIABLE_DAYS = 45;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const ppsfOf = (l: Pick<RawListing, 'price' | 'sqft'>): number | null =>
  l.sqft && l.sqft > 0 ? l.price / l.sqft : null;

const cohortKey = (l: RawListing, scope: 'local' | 'region'): string =>
  scope === 'local'
    ? `${l.kind}|${l.propertyType}|${l.municipality}`
    : `${l.kind}|${l.propertyType}`;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Scores every listing against the cohort formed by `population` (usually the whole provider result). */
export function scoreListings(listings: RawListing[], population: RawListing[] = listings): Listing[] {
  const buckets = new Map<string, number[]>();
  for (const l of population) {
    const p = ppsfOf(l);
    if (p === null) continue;
    for (const scope of ['local', 'region'] as const) {
      const key = cohortKey(l, scope);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(p);
      else buckets.set(key, [p]);
    }
  }

  return listings.map((l) => {
    const ppsf = ppsfOf(l);
    const local = buckets.get(cohortKey(l, 'local')) ?? [];
    const region = buckets.get(cohortKey(l, 'region')) ?? [];
    const cohort = local.length >= MIN_COHORT ? local : region;
    const cohortMedian = cohort.length >= MIN_COHORT ? median(cohort) : null;
    const vsMedianPct =
      ppsf !== null && cohortMedian !== null && cohortMedian > 0
        ? Math.round(((ppsf - cohortMedian) / cohortMedian) * 1000) / 10
        : null;

    const flags: DealFlag[] = [];
    if (l.daysOnMarket <= NEW_DAYS) flags.push('new');
    if (l.priceDrop) flags.push('price-drop');
    if (vsMedianPct !== null && vsMedianPct <= BELOW_MARKET_PCT) flags.push('below-market');
    if (l.daysOnMarket >= NEGOTIABLE_DAYS && l.kind === 'sale') flags.push('negotiable');

    let score = 50;
    if (vsMedianPct !== null) score += clamp(-vsMedianPct * 2.5, -30, 35);
    if (l.priceDrop) score += clamp(l.priceDrop.pct * 2, 0, 10);
    if (flags.includes('negotiable')) score += 5;
    if (flags.includes('new')) score += 3;

    let headline: string | null = null;
    if (vsMedianPct !== null && vsMedianPct <= BELOW_MARKET_PCT) {
      headline = `${Math.abs(vsMedianPct).toFixed(0)}% below comparable $/sqft`;
    } else if (l.priceDrop) {
      headline = `Price cut ${l.priceDrop.pct.toFixed(1)}%`;
    } else if (flags.includes('negotiable')) {
      headline = `${l.daysOnMarket} days on market`;
    } else if (flags.includes('new')) {
      headline = 'Just listed';
    }

    const deal: ListingDeal = {
      flags,
      ppsf: ppsf === null ? null : Math.round(ppsf * 100) / 100,
      cohortMedianPpsf: cohortMedian === null ? null : Math.round(cohortMedian * 100) / 100,
      vsMedianPct,
      score: Math.round(clamp(score, 0, 100)),
      headline,
    };
    return { ...l, deal };
  });
}
