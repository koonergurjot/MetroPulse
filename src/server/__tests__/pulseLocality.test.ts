import { describe, expect, it, vi } from 'vitest';
import { categoryResult, findLocalityEntry, type LocalityEntry } from '../pulse.ts';
import type { CivicRecord } from '../types.ts';

const centre = { lat: 49.2827, lng: -123.1207 };

describe('findLocalityEntry', () => {
  it('matches a known locality, case- and whitespace-insensitively', () => {
    expect(findLocalityEntry('Vancouver')?.cityLabel).toBe('Vancouver');
    expect(findLocalityEntry('  surrey ')?.cityLabel).toBe('Surrey');
    expect(findLocalityEntry('BURNABY')?.cityLabel).toBe('Burnaby');
  });

  it('returns undefined for a locality with no adapter', () => {
    expect(findLocalityEntry('Richmond')).toBeUndefined();
    expect(findLocalityEntry('North Vancouver')).toBeUndefined();
  });

  it('returns undefined when locality is null or empty', () => {
    expect(findLocalityEntry(null)).toBeUndefined();
    expect(findLocalityEntry('')).toBeUndefined();
  });
});

describe('categoryResult', () => {
  const fakeRecords: CivicRecord[] = [
    { id: '1', kind: 'permit', title: 'Test', detail: null, date: null, distanceM: 10, lat: centre.lat, lng: centre.lng },
  ];

  const fakeEntry: LocalityEntry = {
    cityLabel: 'Testville',
    base: { id: 'testville.opendata', label: 'Testville Open Data', attribution: 'Testville', licence: 'Test-ODC' },
    cachePrefix: 'testville',
    categories: {
      permits: vi.fn(async () => fakeRecords),
    },
  };

  it('runs the loader and returns an ok result when the category has an adapter', async () => {
    const result = await categoryResult(fakeEntry, 'permits', centre, 500, 'k1', 'Testville');
    expect(result.status).toBe('ok');
    expect(result.data).toEqual(fakeRecords);
    expect(result.meta).toMatchObject({ id: 'testville.permits', label: 'Testville building permits' });
  });

  it('produces a skipped result with a locality-specific reason when the category has no adapter', async () => {
    const result = await categoryResult(fakeEntry, 'rentalIssues', centre, 500, 'k1', 'Testville');
    expect(result.status).toBe('skipped');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Testville does not publish rental standards through this adapter yet.');
  });

  it('produces a skipped result naming the municipality when no adapter entry exists at all', async () => {
    const result = await categoryResult(undefined, 'permits', centre, 500, 'k1', 'Richmond');
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('Not yet wired up for Richmond.');
  });

  it('produces a skipped result explaining unknown municipality when locality is null', async () => {
    const result = await categoryResult(undefined, 'permits', centre, 500, 'k1', null);
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('Municipality unknown for this location; only coordinates were provided.');
  });

  it('never returns an empty array in place of a skipped result', async () => {
    const result = await categoryResult(undefined, 'serviceRequests', centre, 500, 'k1', 'Richmond');
    expect(result.data).toBeNull();
    expect(result.status).not.toBe('ok');
  });
});
