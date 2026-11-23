import { describe, expect, it } from 'vitest';
import { generateDemoListings } from '../listings/demoProvider.ts';
import { getListingsByIds, summariseMarket } from '../listings/service.ts';
import { handleListingsBatchRequest, handleMarketRequest } from '../mapHandlers.ts';

const get = (path: string) => new Request(`http://x${path}`);

describe('summariseMarket', () => {
  it('aggregates per municipality, sorted by count', () => {
    const rows = summariseMarket(generateDemoListings().filter((l) => l.kind === 'sale'));
    expect(rows.length).toBeGreaterThan(5);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].count).toBeGreaterThanOrEqual(rows[i].count);
    for (const r of rows) {
      expect(r.priceCutShare).toBeGreaterThanOrEqual(0);
      expect(r.priceCutShare).toBeLessThanOrEqual(1);
      expect(r.medianPrice).not.toBeNull();
    }
  });
});

describe('batch + market endpoints', () => {
  it('returns requested listings in order, ignoring unknown ids', async () => {
    const ids = generateDemoListings().slice(0, 3).map((l) => l.id).reverse();
    const { listings } = await getListingsByIds([...ids, 'nope']);
    expect(listings.map((l) => l.id)).toEqual(ids);
  });

  it('validates ids and caps batch size', async () => {
    expect((await handleListingsBatchRequest(get('/api/listings/batch'))).status).toBe(400);
    expect((await handleListingsBatchRequest(get('/api/listings/batch?ids=../etc'))).status).toBe(400);
    const many = Array.from({ length: 31 }, (_, i) => `a${i}`).join(',');
    expect((await handleListingsBatchRequest(get(`/api/listings/batch?ids=${many}`))).status).toBe(400);
    const ok = await handleListingsBatchRequest(get('/api/listings/batch?ids=demo-00,demo-01'));
    expect(ok.status).toBe(200);
    expect((await ok.json()).provider.demo).toBe(true);
  });

  it('serves a market snapshot and rejects a bad kind', async () => {
    const res = await handleMarketRequest(get('/api/market?west=-123.3&south=49&east=-122.6&north=49.4&kind=rent'));
    expect(res.status).toBe(200);
    expect((await res.json()).rows.length).toBeGreaterThan(0);
    expect((await handleMarketRequest(get('/api/market?west=-123.3&south=49&east=-122.6&north=49.4&kind=x'))).status).toBe(400);
  });
});
