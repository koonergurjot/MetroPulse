/**
 * Reachability check for every upstream this service depends on.
 *
 * Endpoint paths and dataset ids in `config.ts` come from each portal's
 * documentation. Portals move things. Run this from a machine with open
 * internet access before a deploy, and after any portal migration notice.
 */
import { config } from '../src/server/config.ts';

interface Check {
  name: string;
  url: string;
  /** Some feeds are protobuf; a JSON parse would fail on a healthy response. */
  binary?: boolean;
  requires?: string | null;
}

const centre = { lat: 49.2827, lng: -123.1207 };
const radius = 500;

const odsUrl = (dataset: string): string => {
  const url = new URL(`${config.vancouver.base}/catalog/datasets/${dataset}/records`);
  url.searchParams.set('where', `distance(geom, geom'POINT(${centre.lng} ${centre.lat})', ${radius}m)`);
  url.searchParams.set('limit', '1');
  return url.toString();
};

const withKey = (base: string): string => {
  const url = new URL(base);
  if (config.translink.apiKey) url.searchParams.set('apikey', config.translink.apiKey);
  return url.toString();
};

const checks: Check[] = [
  {
    name: 'BC Address Geocoder',
    url: `${config.geocoder.base}/addresses.json?addressString=555%20W%20Hastings%20St%20Vancouver%20BC&maxResults=1&outputSRS=4326`,
  },
  { name: 'Vancouver 311', url: odsUrl(config.vancouver.datasets.serviceRequests) },
  { name: 'Vancouver building permits', url: odsUrl(config.vancouver.datasets.buildingPermits) },
  { name: 'Vancouver rental standards', url: odsUrl(config.vancouver.datasets.rentalStandards) },
  {
    name: 'DriveBC Open511',
    url: `${config.drivebc.base}/events?bbox=-123.2,49.2,-123.0,49.35&status=ACTIVE&format=json`,
  },
  {
    name: 'TransLink trip updates',
    url: withKey(config.translink.tripUpdates),
    binary: true,
    requires: config.translink.apiKey ? null : 'TRANSLINK_API_KEY',
  },
  {
    name: 'TransLink alerts',
    url: withKey(config.translink.alerts),
    binary: true,
    requires: config.translink.apiKey ? null : 'TRANSLINK_API_KEY',
  },
];

let failures = 0;

for (const check of checks) {
  if (check.requires) {
    console.log(`SKIP  ${check.name.padEnd(30)} needs ${check.requires}`);
    continue;
  }
  const startedAt = Date.now();
  try {
    const res = await fetch(check.url, { signal: AbortSignal.timeout(12_000) });
    const bytes = (await res.arrayBuffer()).byteLength;
    const ms = Date.now() - startedAt;
    if (!res.ok) {
      failures++;
      console.log(`FAIL  ${check.name.padEnd(30)} HTTP ${res.status} (${ms} ms)`);
    } else if (bytes === 0) {
      failures++;
      console.log(`FAIL  ${check.name.padEnd(30)} empty response (${ms} ms)`);
    } else {
      console.log(`OK    ${check.name.padEnd(30)} ${res.status}, ${bytes} bytes, ${ms} ms`);
    }
  } catch (err) {
    failures++;
    console.log(`FAIL  ${check.name.padEnd(30)} ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(failures === 0 ? '\nAll reachable endpoints passed.' : `\n${failures} endpoint(s) need attention.`);
process.exit(failures === 0 ? 0 : 1);
