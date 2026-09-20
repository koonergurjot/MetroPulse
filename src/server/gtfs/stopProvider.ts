/**
 * Loads the baked stop index once per process.
 *
 * `STOP_INDEX_PATH` may be a local file (Node) or an https URL (edge runtimes,
 * where the index is uploaded alongside the deploy). Either way it is read
 * once and kept in memory: it is a few MB of text and it changes weekly.
 */
import { config } from '../config.ts';
import { fetchText } from '../http.ts';
import { parseStopsCsv, StopIndex } from './stopIndex.ts';

let cached: Promise<StopIndex> | null = null;

async function readSource(path: string): Promise<string> {
  if (/^https?:\/\//.test(path)) {
    return await fetchText(path, { timeoutMs: 8_000, retries: 1 });
  }
  // Dynamic import keeps `node:fs` out of edge bundles, which reject it.
  const { readFile } = await import('node:fs/promises');
  return await readFile(path, 'utf8');
}

export function loadStopIndex(): Promise<StopIndex> {
  if (!cached) {
    cached = readSource(config.stops.path)
      .then((csv) => new StopIndex(parseStopsCsv(csv)))
      .catch((err) => {
        // Do not memoise a failure; the next request should try again.
        cached = null;
        throw err;
      });
  }
  return cached;
}

/** Test seam: inject a fixture index and skip disk/network entirely. */
export function setStopIndex(index: StopIndex): void {
  cached = Promise.resolve(index);
}

export function resetStopIndex(): void {
  cached = null;
}
