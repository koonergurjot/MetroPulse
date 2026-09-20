# MetroPulse

**Know the block before you sign.** A unified data engine for Metro Vancouver that merges
live TransLink reliability, municipal open data and regional road/park feeds into a single
scored report for any address in the Lower Mainland.

- **[docs/BLUEPRINT.md](docs/BLUEPRINT.md)** — the business case, data architecture, MVP
  scope, stack and go-to-market plan.
- **`src/server/`** — the working backend: concurrent fan-out across five public APIs,
  merged into one JSON document.
- **`src/components/`** — the blueprint presentation site (`npm run dev`).

## Quick start

```bash
npm install
npm test          # 53 tests, no network required
npm run typecheck

# Local API
TRANSLINK_API_KEY=your-key npm run dev:api
curl 'http://localhost:8787/api/pulse?address=555+W+Hastings+St+Vancouver'
curl 'http://localhost:8787/api/pulse?lat=49.2827&lng=-123.1207&radius=600'
```

The endpoint answers with `200` even when every upstream is unreachable: the score is
withheld and each source reports its own `status`. Partial failure is the expected case, not
an exception.

## Before you deploy

Endpoint paths and dataset ids in `src/server/config.ts` are transcribed from each portal's
documentation and are **not** verified against the live services in this repository's tests.
Check them from a machine with open internet access:

```bash
npm run verify:sources
```

Run it in CI daily. Municipal portals rename datasets without notice.

## Stop index

The realtime feed carries `stop_id` but no coordinates, so nearby-stop lookups need the
static GTFS stop table. It is baked at build time rather than unzipped per request:

```bash
curl -fL https://gtfs-static.translink.ca/gtfs/google_transit.zip -o /tmp/gtfs.zip
unzip -o -d /tmp/gtfs /tmp/gtfs.zip stops.txt
npm run build:stops /tmp/gtfs/stops.txt data/stops.csv
STOP_INDEX_PATH=data/stops.csv npm run dev:api
```

`data/stops.sample.csv` is a ten-row development fixture with placeholder ids. It will not
match real feed data — generate the real index before testing transit output.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `TRANSLINK_API_KEY` | for transit | Free key from developer.translink.ca |
| `BC_GEOCODER_API_KEY` | no | Raises DataBC geocoder rate limits |
| `STOP_INDEX_PATH` | no | Path or https URL to the baked stops CSV |
| `DEFAULT_RADIUS_M` / `MAX_RADIUS_M` | no | Search radius bounds (800 / 2000) |
| `FANOUT_BUDGET_MS` | no | Wall-clock budget for the whole fan-out (6000) |

Every upstream base URL in `src/server/config.ts` is also overridable by environment
variable, so a portal migration is a config change rather than a deploy.

## Attribution

Every API response carries a `sources` array with each provider's attribution and licence
string. Most BC open-data licences require that attribution be displayed — the UI must
render it. TransLink's Open API is governed by its own Terms of Use, not an Open Government
Licence; read it before launching a paid tier.

## Deploying to Cloudflare Workers

`wrangler.jsonc` serves the built Vite site from the assets binding and routes
`/api/pulse` to the same handler the dev server uses.

```bash
npm run deploy:dry     # bundle and validate without deploying
npm run deploy         # vite build, then wrangler deploy
npx wrangler secret put TRANSLINK_API_KEY
```

If the Cloudflare project is connected through the Git integration, set its
**build command** to `npm run build` and its **deploy command** to
`npx wrangler deploy`. Without a build step there is no `dist/` for the assets
binding to serve.

Workers have no filesystem, so `STOP_INDEX_PATH` must be an **https URL** in
this environment — upload the output of `npm run build:stops` and point the var
at it. The local file path only works for the Node dev server.
