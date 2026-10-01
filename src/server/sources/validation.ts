import { UpstreamError } from '../http.ts';

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A missing collection is a provider contract failure, not zero matching records. */
export function requireCollection(body: unknown, key: string): Record<string, unknown>[] {
  if (!isObject(body) || body.error || !Array.isArray(body[key]) || !body[key].every(isObject)) {
    throw new UpstreamError('upstream returned an unexpected response shape', null, false);
  }
  return body[key] as Record<string, unknown>[];
}
