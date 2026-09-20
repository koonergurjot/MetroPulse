/**
 * Address slugs, e.g. `555-w-hastings-st-vancouver`.
 *
 * The slug is not a hash or a stored id — there is no database here, and
 * Workers isolates don't share memory across regions, so anything a slug
 * needs to resolve to has to be derivable from the slug text alone.
 * `addressQueryFromSlug` turns it back into a free-text query and hands it
 * to the same geocoder the address flow uses, which is deterministic for a
 * given input string (and cached — see `pulse.ts`'s `POLICY.geocode`). That
 * is what makes the same address always yield the same URL: geocoding
 * normalizes "555 w hastings st" and "555 West Hastings Street" to the same
 * canonical address, which slugifies to the same slug.
 */
import { normalizeAddress } from './address.ts';

/** Collapses to lowercase words joined by single hyphens, dropping anything that isn't alphanumeric. */
export function slugifyAddress(address: string): string {
  return normalizeAddress(address)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Inverse of the hyphenation step, for feeding back into the geocoder as a search string. */
export function addressQueryFromSlug(slug: string): string {
  return normalizeAddress(slug.replace(/-+/g, ' '));
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 200 && SLUG_PATTERN.test(slug);
}
