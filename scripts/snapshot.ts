/**
 * Polls TransLink TripUpdates once and appends normalized delay observations
 * to durable storage — Supabase when SUPABASE_URL/SUPABASE_SERVICE_KEY are
 * set, otherwise newline-delimited JSON under data/snapshots/.
 *
 * Run on a schedule by .github/workflows/snapshot.yml. This is the only
 * place delay history for Metro Vancouver transit exists: TransLink's feed
 * has no history endpoint of its own.
 *
 *   node --experimental-strip-types scripts/snapshot.ts
 */
import { fetchTripUpdates } from '../src/server/sources/translink.ts';
import { flattenTripUpdates } from '../src/server/snapshot/flatten.ts';
import { createSink } from '../src/server/snapshot/sinks.ts';

const feed = await fetchTripUpdates();
const rows = flattenTripUpdates(feed);
const sink = createSink();
await sink.write(rows);

console.log(`${sink.name}: archived ${rows.length} delay observation(s)`);
