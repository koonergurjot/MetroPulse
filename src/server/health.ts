/**
 * Per-source health registry backing `GET /api/health`.
 *
 * `SwrCache` entries are keyed by request shape (address, coordinates,
 * radius), so there is no single cache entry that means "TransLink's feed" —
 * a given source can have zero, one or many keys live at once. This registry
 * instead tracks, per source id, the last time its loader actually reached
 * upstream successfully or failed, independent of which cache key that call
 * happened to use. A source only appears here after its first invocation in
 * this process.
 */
import type { SourceMeta } from './types.ts';

export interface SourceHealthSnapshot {
  id: string;
  label: string;
  lastSuccessAt: string | null;
  lastSuccessAgeMs: number | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

interface HealthRecord {
  label: string;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
}

type Clock = () => number;

export class SourceHealthRegistry {
  readonly #entries = new Map<string, HealthRecord>();
  readonly #now: Clock;

  constructor(now: Clock = Date.now) {
    this.#now = now;
  }

  #entryFor(meta: SourceMeta): HealthRecord {
    const existing = this.#entries.get(meta.id);
    if (existing) {
      existing.label = meta.label;
      return existing;
    }
    const created: HealthRecord = { label: meta.label, lastSuccessAt: null, lastErrorAt: null, lastError: null };
    this.#entries.set(meta.id, created);
    return created;
  }

  recordSuccess(meta: SourceMeta): void {
    this.#entryFor(meta).lastSuccessAt = this.#now();
  }

  recordError(meta: SourceMeta, message: string): void {
    const entry = this.#entryFor(meta);
    entry.lastErrorAt = this.#now();
    entry.lastError = message;
  }

  snapshot(): SourceHealthSnapshot[] {
    const now = this.#now();
    return Array.from(this.#entries.entries())
      .map(([id, entry]) => ({
        id,
        label: entry.label,
        lastSuccessAt: entry.lastSuccessAt !== null ? new Date(entry.lastSuccessAt).toISOString() : null,
        lastSuccessAgeMs: entry.lastSuccessAt !== null ? now - entry.lastSuccessAt : null,
        lastErrorAt: entry.lastErrorAt !== null ? new Date(entry.lastErrorAt).toISOString() : null,
        lastError: entry.lastError,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  clear(): void {
    this.#entries.clear();
  }
}

/** Default registry shared by every source adapter in this process. */
export const sourceHealth = new SourceHealthRegistry();
