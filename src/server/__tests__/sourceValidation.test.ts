import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryOds } from '../sources/vancouver.ts';
import { queryArcGis } from '../sources/arcgis.ts';
import { fetchRoadEvents } from '../sources/drivebc.ts';
import { requireCollection } from '../sources/validation.ts';
import { runSource } from '../sources/base.ts';
import { cache } from '../cache.ts';
import { sourceHealth } from '../health.ts';

const centre = { lat: 49.28, lng: -123.12 };
const respond = (body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); cache.clear(); sourceHealth.clear(); });

describe('provider response validation', () => {
  it.each([null, {}, { results: null }, { results: [null] }, { results: ['record'] }, { error: { message: 'Bad query' }, results: [] }])('rejects malformed ODS collections: %j', async body => {
    respond(body);
    await expect(queryOds({ dataset: 'test', centre, radiusM: 500 })).rejects.toThrow('unexpected response shape');
  });

  it('accepts a genuine empty ODS collection', async () => {
    respond({ results: [] });
    await expect(queryOds({ dataset: 'test', centre, radiusM: 500 })).resolves.toEqual([]);
  });

  it('rejects ArcGIS errors returned with HTTP 200', async () => {
    respond({ error: { code: 400, message: 'Invalid query' } });
    await expect(queryArcGis({ layerUrl: 'https://example.test/0', centre, radiusM: 500 })).rejects.toThrow('unexpected response shape');
  });

  it('rejects missing road-event collections', async () => {
    respond({ message: 'Service unavailable' });
    await expect(fetchRoadEvents(centre, 500)).rejects.toThrow('unexpected response shape');
  });

  it('accepts a genuine empty road-event collection', async () => {
    respond({ events: [] });
    await expect(fetchRoadEvents(centre, 500)).resolves.toEqual([]);
  });

  it('reports invalid evidence as unavailable at the source boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await runSource({ id: 'test', label: 'Test provider', attribution: '', licence: '' }, 'invalid', { ttlMs: 10 }, async () => requireCollection({}, 'results'));
    expect(result.status).toBe('error');
    expect(result.data).toBeNull();
  });
});
