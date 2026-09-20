/**
 * Address normalization shared by request validation and the geocoder cache
 * key.
 *
 * Without this, "  Main  St " and "Main St" geocode identically but land in
 * separate cache entries and burn two calls against a rate-limited upstream.
 */

/** ASCII control characters, excluding the whitespace ones `normalizeAddress` collapses (tab, LF, VT, FF, CR). */
const CONTROL_CHARS = /[\u0000-\u0008\u000E-\u001F\u007F]/;

export function hasControlCharacters(raw: string): boolean {
  return CONTROL_CHARS.test(raw);
}

/** Collapses any run of whitespace (including tabs/newlines) to a single space and trims the ends. */
export function normalizeAddress(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}
