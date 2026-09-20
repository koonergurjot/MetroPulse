import { describe, expect, it } from 'vitest';
import { addressQueryFromSlug, isValidSlug, slugifyAddress } from '../slug.ts';

describe('slugifyAddress', () => {
  it('lowercases and hyphenates a typical address', () => {
    expect(slugifyAddress('555 W Hastings St, Vancouver, BC')).toBe('555-w-hastings-st-vancouver-bc');
  });

  it('is deterministic for the same input', () => {
    const address = '4949 Canada Way, Burnaby, BC';
    expect(slugifyAddress(address)).toBe(slugifyAddress(address));
  });

  it('collapses whitespace and punctuation runs into single hyphens', () => {
    expect(slugifyAddress('  10153   King George Blvd,,  Surrey , BC  ')).toBe('10153-king-george-blvd-surrey-bc');
  });

  it('produces the same slug for differently-formatted equivalents of the same address', () => {
    expect(slugifyAddress('800 Robson St, Vancouver, BC')).toBe(slugifyAddress('800 robson st vancouver bc'));
  });

  it('has no leading or trailing hyphens even with leading/trailing punctuation', () => {
    const slug = slugifyAddress('#200 - 555 W Hastings St.');
    expect(slug.startsWith('-')).toBe(false);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('addressQueryFromSlug', () => {
  it('turns hyphens back into spaces', () => {
    expect(addressQueryFromSlug('555-w-hastings-st-vancouver-bc')).toBe('555 w hastings st vancouver bc');
  });

  it('collapses runs of hyphens the same way whitespace is collapsed', () => {
    expect(addressQueryFromSlug('555--w---hastings-st')).toBe('555 w hastings st');
  });
});

describe('round-tripping', () => {
  const addresses = [
    '555 W Hastings St, Vancouver, BC',
    '4949 Canada Way, Burnaby, BC',
    '10153 King George Blvd, Surrey, BC',
    '#200 - 800 Robson St.',
  ];

  it.each(addresses)('slug -> query -> slug is stable for %s', (address) => {
    const slug = slugifyAddress(address);
    const query = addressQueryFromSlug(slug);
    // Re-slugifying the de-slugified query must land back on the exact same
    // slug: this is what lets `/report/<slug>` resolve through the geocoder
    // (via the query) and still agree with the URL a user was given.
    expect(slugifyAddress(query)).toBe(slug);
  });

  it('is idempotent: slugifying an already-deslugified query changes nothing further', () => {
    const slug = slugifyAddress('555 W Hastings St, Vancouver, BC');
    const query = addressQueryFromSlug(slug);
    expect(addressQueryFromSlug(slugifyAddress(query))).toBe(query);
  });
});

describe('isValidSlug', () => {
  it('accepts lowercase alphanumeric segments joined by single hyphens', () => {
    expect(isValidSlug('555-w-hastings-st-vancouver-bc')).toBe(true);
    expect(isValidSlug('4949-canada-way-burnaby-bc')).toBe(true);
  });

  it('rejects empty strings, uppercase, doubled hyphens, and leading/trailing hyphens', () => {
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug('Vancouver')).toBe(false);
    expect(isValidSlug('555--hastings')).toBe(false);
    expect(isValidSlug('-hastings')).toBe(false);
    expect(isValidSlug('hastings-')).toBe(false);
  });

  it('rejects a slug over 200 characters', () => {
    expect(isValidSlug('a-'.repeat(150))).toBe(false);
  });
});
