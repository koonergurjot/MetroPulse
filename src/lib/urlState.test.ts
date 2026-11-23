import { describe, expect, it } from 'vitest';
import type { ListingFilters } from '../api';
import { parseUrlState, serializeUrlState } from './urlState.ts';

const defaults: ListingFilters = { kind: 'sale', types: ['condo', 'townhouse', 'house', 'duplex'], maxPrice: null, minBeds: 0, sort: 'deal' };

describe('url state', () => {
  it('round-trips filters, listing, view and layers', () => {
    const filters: ListingFilters = { kind: 'rent', types: ['condo', 'house'], maxPrice: 3000, minBeds: 2, sort: 'newest' };
    const qs = serializeUrlState(filters, defaults, 'demo-4a', { lng: -123.1207, lat: 49.2827, zoom: 15.6 }, ['heat', 'planned']);
    const back = parseUrlState(qs);
    expect(back.filters).toEqual(filters);
    expect(back.listing).toBe('demo-4a');
    expect(back.view).toEqual({ lng: -123.1207, lat: 49.2827, zoom: 15.6 });
    expect(back.layersOff).toEqual(['heat', 'planned']);
  });

  it('serialises defaults to an empty string', () => {
    expect(serializeUrlState(defaults, defaults, null, null, [])).toBe('');
  });

  it('rejects hostile or out-of-range values instead of trusting the URL', () => {
    const s = parseUrlState('?k=lease&t=castle,condo&b=99&p=-5&s=hack&l=../etc&v=0,0,99&off=<script>');
    expect(s.filters).toEqual({ types: ['condo'] });
    expect(s.listing).toBeNull();
    expect(s.view).toBeNull();
    expect(s.layersOff).toEqual([]);
  });
});
