/**
 * Bakes the runtime stop index from TransLink's static GTFS feed.
 *
 * Run weekly (a scheduled CI job is enough) and commit or upload the result:
 *
 *   curl -fL https://gtfs-static.translink.ca/gtfs/google_transit.zip -o /tmp/gtfs.zip
 *   unzip -o -d /tmp/gtfs /tmp/gtfs.zip stops.txt
 *   node --experimental-strip-types scripts/build-stops.ts /tmp/gtfs/stops.txt data/stops.csv
 *
 * Keeping the unzip out of the service is intentional: a request handler
 * should never be inflating a multi-megabyte archive.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseStopsCsv } from '../src/server/gtfs/stopIndex.ts';
import { METRO_VANCOUVER_BBOX, withinBBox } from '../src/server/geo.ts';

const [, , input, output = 'data/stops.csv'] = process.argv;

if (!input) {
  console.error('usage: build-stops.ts <path-to-stops.txt> [output.csv]');
  process.exit(1);
}

const csv = await readFile(input, 'utf8');
const stops = parseStopsCsv(csv).filter((s) => withinBBox(s, METRO_VANCOUVER_BBOX));

if (stops.length === 0) {
  console.error('no stops parsed — is this really a GTFS stops.txt?');
  process.exit(1);
}

const escape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const rows = [
  'stop_id,stop_code,stop_name,stop_lat,stop_lon',
  ...stops.map((s) =>
    [s.stopId, s.code ?? '', s.name, s.lat.toFixed(6), s.lng.toFixed(6)].map(escape).join(','),
  ),
];

await writeFile(output, `${rows.join('\n')}\n`, 'utf8');
console.log(`wrote ${stops.length} stops to ${output}`);
