# Adding a municipality

MetroPulse covers each city through a small adapter plus one entry in a
registry. Adding Richmond, New Westminster, Coquitlam or any other Metro
Vancouver city is the best first contribution: it is self-contained, testable
offline, and immediately makes reports better for people in that city.

You do not need a TransLink key. Tests use fixtures and never hit the network.

## How it fits together

```
address → BC Address Geocoder → locality ("Surrey")
                                    │
                    LOCALITY_REGISTRY (src/server/pulse.ts)
                                    │
              ┌─────────────────────┼─────────────────────┐
         serviceRequests         permits            rentalIssues
              │                     │                     │
        each is a function (centre, radiusM, signal) → CivicRecord[]
```

- The geocoder returns the city name; `findLocalityEntry` matches it
  (case-insensitively) against `cityLabel`.
- A city can implement any subset of the three categories. Missing categories
  are reported as **skipped with a reason** (“Surrey does not publish 311
  service requests through this adapter yet”), never as an empty list. Keep it
  that way: an empty array reads as “nothing is happening here”.
- Every adapter returns `CivicRecord[]` (`src/server/types.ts`), sorted nearest
  first and trimmed to the requested radius.
- Calls go through `runSource`, which adds caching, health tracking and error
  handling. An adapter just fetches and maps; it should throw on upstream
  failure and let `runSource` decide what the user sees.

## Step by step

### 1. Find the data

Look on the city's open-data portal for building permits, 311 / service
requests, and rental or property-standards records. Note for each dataset:

- the platform (Opendatasoft or Esri ArcGIS FeatureServer cover most BC cities),
- the dataset or layer id,
- the field names for title, address/detail, date and id,
- the licence, which you will need for attribution.

### 2. Add config

In `src/server/config.ts`, add a block next to `surrey` and `burnaby`:

```ts
richmond: {
  base: env('RICHMOND_ARCGIS_BASE', 'https://example.richmond.ca/arcgis/rest/services/.../FeatureServer'),
  layers: { buildingPermits: env('RICHMOND_PERMITS_LAYER', '0') },
  attribution: 'Contains information licensed under the City of Richmond Open Data Licence',
  licence: 'Richmond-ODL',
},
```

Keep URLs overridable through environment variables, because portals move
things without notice.

### 3. Write the adapter

**ArcGIS portals** can reuse `queryArcGis` and the mapping helper in
`src/server/sources/arcgis.ts`. Copy `fetchSurreyBuildingPermits`, point it at
your config block, and list the candidate field names for title, detail, date
and id. Several spellings per field are fine; the first non-empty one wins.

**Opendatasoft portals** can follow `src/server/sources/vancouver.ts`, which
uses a server-side `distance(...)` filter.

Rules for adapters:

- Use `fetchJson` from `src/server/http.ts` (timeouts, retries, typed errors).
- Validate the response shape with `requireCollection` so a renamed field fails
  loudly instead of yielding records titled `"permit"`.
- Set `kind` to a short lowercase noun (`permit`, `request`, `rental`).
- Do not add Node-only APIs; this code also runs on Cloudflare Workers.

### 4. Register it

In `src/server/pulse.ts`, add an entry to `LOCALITY_REGISTRY`:

```ts
{
  cityLabel: 'Richmond', // must match the geocoder's locality name
  base: RICHMOND_META,
  cachePrefix: 'richmond',
  categories: {
    permits: fetchRichmondBuildingPermits,
  },
},
```

### 5. Test it

Add tests under `src/server/__tests__/`. `arcgis.test.ts` is a good template:
mock `globalThis.fetch`, return a small GeoJSON (or Opendatasoft) body, and
assert the mapped `CivicRecord`s, their ordering and the radius trimming. Also
add a case where a record is outside the radius, and one where the response is
malformed.

```bash
npm test && npm run typecheck && npm run build
```

### 6. Update the docs

- Add the city to the coverage table in the README.
- Add the new datasets to `scripts/verify-sources.ts` so the daily source check
  notices when the portal changes.

## Before you open the pull request

- [ ] The licence allows reuse and the attribution text is correct.
- [ ] Field names were checked against the live portal (say how in the PR).
- [ ] Unsupported categories are left out of `categories` (so they show as
      skipped) rather than returning empty arrays.
- [ ] Tests cover the happy path, radius trimming and a malformed response.

Not sure a dataset is usable? Open an issue with the
[Add a municipality](../../issues/new?template=new_municipality.yml) template
and we will help you scope it.
