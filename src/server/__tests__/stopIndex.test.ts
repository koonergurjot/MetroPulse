import { describe, expect, it } from 'vitest';
import { parseStopsCsv, splitCsvRow, StopIndex } from '../gtfs/stopIndex.ts';

const CSV = `stop_id,stop_code,stop_name,stop_lat,stop_lon
S1,101,"Hastings St @ Cambie St, EB",49.2827,-123.1100
S2,102,Granville Station,49.2827,-123.1180
S3,103,Far Away Stop,49.1000,-122.8000
BAD,,Missing coords,,
`;

describe('stops.txt parsing', () => {
  it('handles quoted fields containing commas', () => {
    expect(splitCsvRow('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('handles escaped quotes', () => {
    expect(splitCsvRow('a,"say ""hi""",c')).toEqual(['a', 'say "hi"', 'c']);
  });

  it('skips rows without usable coordinates', () => {
    const stops = parseStopsCsv(CSV);
    expect(stops.map((s) => s.stopId)).toEqual(['S1', 'S2', 'S3']);
    expect(stops[0].name).toBe('Hastings St @ Cambie St, EB');
  });

  it('tolerates a BOM on the header row', () => {
    expect(parseStopsCsv(`﻿${CSV}`)).toHaveLength(3);
  });

  it('rejects a file missing required columns', () => {
    expect(() => parseStopsCsv('a,b\n1,2\n')).toThrow(/stop_id/);
  });
});

describe('StopIndex.near', () => {
  const index = new StopIndex(parseStopsCsv(CSV));

  it('returns only stops inside the radius, nearest first', () => {
    const found = index.near({ lat: 49.2827, lng: -123.1100 }, 800);
    expect(found.map((s) => s.stopId)).toEqual(['S1', 'S2']);
    expect(found[0].distanceM).toBe(0);
    expect(found[1].distanceM).toBeGreaterThan(400);
  });

  it('excludes stops beyond the radius even when in the same grid row', () => {
    expect(index.near({ lat: 49.2827, lng: -123.11 }, 100).map((s) => s.stopId)).toEqual(['S1']);
  });

  it('respects the result limit', () => {
    expect(index.near({ lat: 49.2827, lng: -123.115 }, 5_000, 1)).toHaveLength(1);
  });

  it('returns an empty list far from any stop', () => {
    expect(index.near({ lat: 49.5, lng: -122.0 }, 500)).toEqual([]);
  });

  it('looks stops up by id', () => {
    expect(index.get('S2')?.name).toBe('Granville Station');
    expect(index.get('nope')).toBeUndefined();
    expect(index.size).toBe(3);
  });
});
