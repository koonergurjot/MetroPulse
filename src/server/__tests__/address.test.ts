import { describe, expect, it } from 'vitest';
import { hasControlCharacters, normalizeAddress } from '../address.ts';

describe('normalizeAddress', () => {
  it('collapses internal whitespace runs to a single space', () => {
    expect(normalizeAddress('123  Main   St')).toBe('123 Main St');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeAddress('  Main St ')).toBe('Main St');
  });

  it('produces the same key for equivalent-looking addresses', () => {
    expect(normalizeAddress('  Main  St ')).toBe(normalizeAddress('Main St'));
  });

  it('collapses tabs and newlines along with spaces', () => {
    expect(normalizeAddress('123\tMain\nSt')).toBe('123 Main St');
  });

  it('leaves an already-normalized address untouched', () => {
    expect(normalizeAddress('555 W Hastings St')).toBe('555 W Hastings St');
  });
});

describe('hasControlCharacters', () => {
  it('is false for ordinary addresses', () => {
    expect(hasControlCharacters('555 W Hastings St')).toBe(false);
  });

  it('is false for whitespace that normalizeAddress collapses (tab, LF, CR, VT, FF)', () => {
    expect(hasControlCharacters('123\tMain\nSt\r\x0b\x0c')).toBe(false);
  });

  it('is true for a NUL byte', () => {
    expect(hasControlCharacters('123 Main\u0000St')).toBe(true);
  });

  it('is true for other ASCII control characters', () => {
    expect(hasControlCharacters('123 Main\u001bSt')).toBe(true); // ESC
    expect(hasControlCharacters('123 Main\u0007St')).toBe(true); // BEL
  });

  it('is true for the DEL character', () => {
    expect(hasControlCharacters('123 Main\u007fSt')).toBe(true);
  });
});
