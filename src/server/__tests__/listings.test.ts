import { describe, expect, it } from 'vitest';
import { listingArtSvg } from '../listings/art.ts';
import { median, scoreListings } from '../listings/deals.ts';
import { generateDemoListings } from '../listings/demoProvider.ts';
import { searchListings } from '../listings/service.ts';
import { handleArtRequest, handleListingsRequest, handleStopsRequest, parseBounds } from '../mapHandlers.ts';
import type { RawListing } from '../listings/types.ts';

const base: RawListing = {
  id: 'x', kind: 'sale', propertyType: 'condo', address: 'a', neighbourhood: 'n', municipality: 'Vancouver',
  lat: 49.28, lng: -123.12, price: 800_000, beds: 2, baths: 1, sqft: 800, yearBuilt: 2000, daysOnMarket: 20,
  priceDrop: null, features: [], photos: [], brokerage: null,
};
const mk = (over: Partial<RawListing>, i: number): RawListing => ({ ...base, id: `l${i}`, ...over });

describe('median', () => {
  it('handles empty, odd and even inputs', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('scoreListings', () => {
  const cohort = [1000, 1000, 1000, 1000, 1000].map((ppsf, i) => mk({ price: ppsf * 800 }, i));

  it('flags a listing well below comparable $/sqft', () => {
    const cheap = mk({ id: 'cheap', price: 700 * 800 }, 99);
    const [scored] = scoreListings([cheap], [...cohort, cheap]);
    expect(scored.deal.vsMedianPct).toBeLessThanOrEqual(-8);
    expect(scored.deal.flags).toContain('below-market');
    expect(scored.deal.headline).toMatch(/below comparable/);
    expect(scored.deal.score).toBeGreaterThan(70);
  });

  it('does not invent a comparison with fewer than four comparables', () => {
    const [scored] = scoreListings([cohort[0]], cohort.slice(0, 2));
    expect(scored.deal.vsMedianPct).toBeNull();
    expect(scored.deal.cohortMedianPpsf).toBeNull();
  });

  it('falls back to the regional cohort when the municipality is thin', () => {
    const elsewhere = [1, 2, 3, 4, 5].map((i) => mk({ municipality: 'Burnaby', price: 900_000 }, i));
    const lonely = mk({ id: 'lonely', municipality: 'Delta', price: 900_000 }, 50);
    const [scored] = scoreListings([lonely], [...elsewhere, lonely]);
    expect(scored.deal.cohortMedianPpsf).not.toBeNull();
  });

  it('flags new listings, price drops and long-on-market sales, but not negotiable rentals', () => {
    const [a] = scoreListings([mk({ daysOnMarket: 1 }, 1)], cohort);
    expect(a.deal.flags).toContain('new');
    const [b] = scoreListings([mk({ priceDrop: { fromPrice: 850_000, pct: 5.9 } }, 2)], cohort);
    expect(b.deal.flags).toContain('price-drop');
    const [c] = scoreListings([mk({ daysOnMarket: 60 }, 3)], cohort);
    expect(c.deal.flags).toContain('negotiable');
    const [d] = scoreListings([mk({ kind: 'rent', daysOnMarket: 60, price: 2500 }, 4)], cohort);
    expect(d.deal.flags).not.toContain('negotiable');
  });

  it('keeps score within 0-100', () => {
    for (const l of scoreListings(generateDemoListings())) {
      expect(l.deal.score).toBeGreaterThanOrEqual(0);
      expect(l.deal.score).toBeLessThanOrEqual(100);
    }
  });
});

describe('demo provider + service', () => {
  it('is deterministic and clearly labelled as demo', async () => {
    expect(generateDemoListings()).toEqual(generateDemoListings());
    const res = await searchListings({ west: -123.3, south: 49.0, east: -122.6, north: 49.4 });
    expect(res.provider.demo).toBe(true);
    expect(res.listings.length).toBeGreaterThan(50);
    expect(res.listings.every((l) => l.address.startsWith('Sample listing'))).toBe(true);
  });

  it('applies filters and sorting', async () => {
    const res = await searchListings({
      west: -123.3, south: 49.0, east: -122.6, north: 49.4,
      kind: 'sale', propertyTypes: ['condo'], maxPrice: 900_000, minBeds: 2, sort: 'price-asc',
    });
    expect(res.listings.length).toBeGreaterThan(0);
    for (const l of res.listings) {
      expect(l.kind).toBe('sale');
      expect(l.propertyType).toBe('condo');
      expect(l.price).toBeLessThanOrEqual(900_000);
      expect(l.beds).toBeGreaterThanOrEqual(2);
    }
    const prices = res.listings.map((l) => l.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('respects bounds and limit', async () => {
    const res = await searchListings({ west: -123.14, south: 49.26, east: -123.1, north: 49.3, limit: 3 });
    expect(res.listings.length).toBeLessThanOrEqual(3);
    for (const l of res.listings) {
      expect(l.lng).toBeGreaterThanOrEqual(-123.14);
      expect(l.lat).toBeLessThanOrEqual(49.3);
    }
  });
});

describe('art', () => {
  it('is deterministic SVG for every variant and kind', () => {
    for (const kind of ['condo', 'house', 'townhouse', 'duplex'] as const) {
      for (const v of [0, 1, 2]) {
        const svg = listingArtSvg('demo-a1', v, kind);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toBe(listingArtSvg('demo-a1', v, kind));
      }
    }
  });
});

describe('map handlers', () => {
  const get = (path: string) => new Request(`http://x${path}`);

  it('rejects missing and inverted bounds, and clamps out-of-region bounds', async () => {
    expect((await handleListingsRequest(get('/api/listings'))).status).toBe(400);
    expect((await handleListingsRequest(get('/api/listings?west=-122&east=-123&south=49&north=50'))).status).toBe(400);
    const clamped = parseBounds(new URL('http://x/?west=-180&east=-100&south=0&north=89'));
    expect(clamped.south).toBeCloseTo(48.7, 6);
    expect(clamped.north).toBeCloseTo(49.8, 6);
  });

  it('rejects non-numeric params and bad kind', async () => {
    expect((await handleListingsRequest(get('/api/listings?west=a&east=1&south=1&north=2'))).status).toBe(400);
    expect((await handleListingsRequest(get('/api/listings?west=-123.3&south=49&east=-122.6&north=49.4&kind=lease'))).status).toBe(400);
  });

  it('returns listings JSON with cache headers', async () => {
    const res = await handleListingsRequest(get('/api/listings?west=-123.3&south=49&east=-122.6&north=49.4&kind=rent'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage');
    const body = await res.json();
    expect(body.provider.demo).toBe(true);
    expect(body.listings.every((l: { kind: string }) => l.kind === 'rent')).toBe(true);
  });

  it('serves art and 404s on bad paths', async () => {
    const ok = await handleArtRequest(get('/api/art/demo-a1.svg?v=1&t=house'));
    expect(ok.headers.get('content-type')).toContain('image/svg+xml');
    expect((await handleArtRequest(get('/api/art/..%2Fx.svg'))).status).toBe(404);
  });

  it('serves stops for a bbox', async () => {
    const res = await handleStopsRequest(get('/api/stops?west=-123.2&south=49.2&east=-123.0&north=49.3'));
    expect(res.status).toBe(200);
    expect(Array.isArray((await res.json()).stops)).toBe(true);
  });
});
