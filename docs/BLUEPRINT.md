# MetroPulse — Lower Mainland Data Engine Blueprint

> Status: strategy + working backend. The service in `src/server/` is real and tested;
> the endpoint paths and dataset ids in `src/server/config.ts` are transcribed from each
> portal's documentation and **have not been checked against the live services**. Run
> `npm run verify:sources` from a machine with open internet access before you trust them.

---

## 1. The business idea

### The friction point

The most expensive recurring decision a Metro Vancouver resident makes is **where to live** —
and the listing tells you almost nothing about it. A rental ad or an MLS page gives you
square footage, a Walk Score, and the number of SkyTrain stations within some radius. What it
never tells you:

- Whether the bus that serves that block is *actually* on time at 8:05am, or whether the
  99 B-Line at that stop has run a median seven minutes late every weekday for two months.
- That a 26-storey rezoning was approved for the lot behind the building.
- That the building itself has eleven outstanding bylaw violations on the city's Rental
  Standards register.
- That the street is about to be torn up for eighteen months of utility work.

Today, answering those questions means five browser tabs, two PDF council agendas, and
knowing that the Rental Standards database exists at all. Most people don't, so they sign
the lease and find out in March.

### The product

**MetroPulse: know the block before you sign.** Enter an address; get a Pulse Score (0–100)
and a one-page report that merges live transit reliability, municipal 311 activity, issued
building permits, rental-standards violations, and active road closures for that specific
point.

Two surfaces, one engine:

| Surface | Who | Purpose |
| --- | --- | --- |
| **Address report** (free, shareable link) | renters, buyers, relocators | The acquisition hook. Shareable by design — the link *is* the marketing. |
| **Commute watch** (account, free tier) | anyone who already lives there | The retention loop. "Your 8:12 departure has averaged 6 min late this week." A weekly email people actually open. |

### Why this is defensible: the archive

Everything above is available to anyone with the same API keys. The moat is **time**.

TransLink's GTFS-Realtime feed is ephemeral — it describes the next 45 minutes and is then
gone. Nobody in the region keeps it. If you snapshot TripUpdates every 30 seconds starting
on day one, then in six months you own something no competitor can buy or backfill:
**per-stop, per-route, per-time-of-day on-time performance history for Metro Vancouver.**
That archive is what turns "the bus is 4 minutes late right now" (a commodity) into "this
stop is late 61% of weekday mornings, worst in the region for its ridership" (a product, a
press release, and a licensable dataset).

The same trick applies to the civic datasets: they publish *current state*, not change
events. Diffing daily snapshots gives you **change detection** — "a new permit was issued
120 m from your address" — which is the alert people will pay for.

Storage cost for a year of compressed delay observations is single-digit gigabytes. This is
the highest-leverage thing in the whole plan and it costs approximately nothing. Build the
snapshotter in week one, even before the UI.

### Monetization

Ranked by expected revenue per unit of effort, not by how exciting they sound.

1. **Realtor / property-manager white-label — $39–79/mo.** The profit engine. Greater
   Vancouver has thousands of licensed realtors who each spend real money on listing
   collateral. A branded, embeddable MetroPulse report on a listing page is a differentiator
   they can show a seller. B2B pricing, annual billing, low churn, and they do the customer
   acquisition for you by putting your footer on every listing.
2. **Consumer Pro — $6/mo or $49/yr.** Unlimited reports, saved addresses, commute alerts,
   permit-change notifications, report PDF export. Free tier: three reports/day, no alerts.
3. **Data licensing — $250–2,000/mo.** The transit-reliability archive, as an API, to
   proptech, insurers, urban-planning consultancies and transportation researchers. No new
   product work; you already have the data.
4. **Lead referral.** Movers, internet providers, tenant insurance, storage. Contextual and
   genuinely useful at the exact moment someone is deciding to move. Disclose it plainly.
5. **The annual report as PR.** "Metro Vancouver's 20 least reliable bus stops, 2027." Free,
   public, media-friendly. This is a marketing line item that happens to look like a product.

**Deliberately not in scope at launch:** property valuations, crime data, and school
rankings. BC Assessment data is not open, VPD's crime feed carries real
ethical-and-liability weight when mapped next to addresses people are deciding whether to
live at, and school-catchment scoring drags you into arguments you cannot win. Ship without
them.

---

## 2. The banded data architecture

Nine agencies, four levels of government, six different API dialects. The architecture is
mostly about making that heterogeneity somebody else's problem — specifically, this
codebase's problem and not the frontend's.

### The join key

Everything hangs off one primitive: **a point**. The BC Address Geocoder turns free text
into a canonical `(lat, lng)` plus a `localityName`, and that locality is what routes the
request to the right municipal adapter. An address in Surrey must never be queried against
Vancouver's 311 dataset — it will return an honest empty list that reads to a user as
"nothing is happening here," which is worse than saying "not available yet."

```
  "1234 Main St"
        │
        ▼
┌───────────────────────┐
│ BC Address Geocoder   │  free, no key, province-wide
│ geocoder.api.gov.bc.ca│
└───────┬───────────────┘
        │ { lat, lng, locality, score }
        ▼
┌───────────────────────────────────────────────────────────────┐
│                     fan-out (concurrent)                      │
├───────────────┬──────────────────┬────────────────────────────┤
│ TransLink     │ Municipal        │ Regional                   │
│ GTFS-RT       │ adapter (by      │ (locality-independent)     │
│ (protobuf)    │  locality)       │                            │
│               │                  │                            │
│ TripUpdates   │ Vancouver → ODS  │ DriveBC Open511 (bbox)     │
│ Alerts        │ New West  → ODS  │ Metro Van parks (ArcGIS)   │
│               │ Richmond  → ODS  │ BC Parks advisories        │
│ stop_id ──────┤ Surrey    → ArcGIS                            │
│   │           │ Burnaby   → ArcGIS Hub                        │
│   ▼           │                  │                            │
│ StopIndex     │ distance() filter│ bbox filter                │
│ (static GTFS) │ server-side      │ + client-side circle trim  │
└───────┬───────┴─────────┬────────┴──────────────┬─────────────┘
        │                 │                       │
        └─────────────────┴───────────────────────┘
                          │  Promise.all over SourceResult<T>
                          ▼
                 ┌──────────────────┐
                 │  merge + score   │
                 └────────┬─────────┘
                          ▼
              one JSON document, per-source status
```

### The three dialects, and the adapter boundary

**Opendatasoft (Vancouver, New Westminster, Richmond).** The easy one. Explore API v2.1
gives every dataset the same query surface, including a server-side geo filter:

```
GET /api/explore/v2.1/catalog/datasets/{dataset}/records
    ?where=distance(geom, geom'POINT(-123.1207 49.2827)', 800m)
    &order_by=service_request_open_timestamp DESC
    &limit=40
```

The radius search happens upstream. One adapter (`sources/vancouver.ts`) serves four
datasets and three cities by swapping a base URL.

**ArcGIS (Surrey, Burnaby, Metro Vancouver Regional Parks).** FeatureServer queries with
`geometry` / `geometryType=esriGeometryEnvelope` / `f=geojson`. Different parameter names,
same shape of answer. This is a second adapter with the same interface, not a second
architecture.

**Open511 (DriveBC).** A bbox query, no key, uniform province-wide coverage. This is the
suburbs' safety net: where a municipal portal is thin, Open511 still answers "is something
happening on this street."

**GTFS-Realtime (TransLink).** The odd one out, and the one that dictates the design. It's
protobuf, it's region-wide, and it only carries `stop_id` — no coordinates. So:

- **Fetch it region-wide, once, and cache it.** One poll of TripUpdates serves every user in
  Metro Vancouver. This is what keeps a free API key viable at a thousand users: upstream
  request volume is a function of *time*, not of traffic.
- **Resolve `stop_id` locally.** The static GTFS `stops.txt` is baked into a spatial index at
  build time (`npm run build:stops`), not unzipped inside a request handler. Static GTFS
  changes weekly; a scheduled job regenerates the index.

### Failure is the normal case

Municipal open-data portals go down, get rate limited, and change dataset ids without
notice. Every source is therefore wrapped in a `SourceResult<T>` carrying
`status: ok | stale | error | skipped`, the age of the data, and its attribution string.
Nothing throws past that boundary. A dead portal greys out one card; it does not 500 the
page, and — critically — it does not silently score as "zero problems found."

The score handles this by **removing an unavailable component's weight** rather than scoring
it zero, and reporting the resulting `coverage`. Below 50% coverage the number is withheld
entirely and the UI shows the components it does have. A score a user can't interrogate is a
score they won't trust; a score that quietly lies when a feed is down is worse than no
product.

### Caching, by how fast each thing actually changes

| Source | TTL | Stale-while-revalidate | Why |
| --- | --- | --- | --- |
| GTFS-RT TripUpdates | 20 s | 60 s | The feed itself updates roughly every 30 s. |
| GTFS-RT Alerts | 2 min | 5 min | Service alerts are hours-long events. |
| 311 / permits / rental standards | 15 min | 60 min | Published daily at best. |
| DriveBC Open511 | 3 min | 15 min | Incidents appear and clear within the hour. |
| Geocoder | 24 h | 7 days | The answer for a given string never changes. |
| Static GTFS stop index | weekly, at build time | — | Not a request-path concern. |

Civic cache keys are rounded to ~100 m (`lat.toFixed(3)`), so neighbours share a cache entry.
That single line is the largest lever on upstream request volume in the whole system.

### Licensing — read this before you charge anyone

- **Vancouver, DataBC, DriveBC, most municipal portals:** Open Government Licence variants.
  Commercial use is permitted **with attribution**. That's why the attribution string lives
  in the config next to the endpoint: adding a source forces you to fill it in, and the
  `sources` array in every API response carries it to the frontend so the UI can display it.
- **TransLink:** governed by its own Open API Terms of Use, not an OGL. Read it before you
  bill. Derive and publish *statistics* rather than redistributing the raw feed, and get
  written confirmation from TransLink's open-data contact before launching a paid tier that
  is visibly built on their data. This is the single largest legal risk in the plan and it
  is cheap to de-risk early — an email now beats a cease-and-desist after you have paying
  realtors.
- **BC Assessment:** not open data. Do not plan around it.

---

## 3. Core features & MVP stack

### The five MVP features

1. **Address → Pulse Score report.** Free-text address in, scored one-pager out, with every
   component carrying the sentence that explains it. Shareable public URL — this is both the
   product and the growth mechanism.
2. **Live transit reliability panel.** Nearby stops, upcoming departures, median delay, share
   of departures more than five minutes late, and any service alert touching a route that
   actually serves this address.
3. **Nearby activity map.** 311 cases, issued building permits, rental-standards violations
   and active road closures within the radius, pinned and filterable, with the raw record
   behind each pin.
4. **Commute watch.** Save an address and a departure window; get a weekly email with the
   measured reliability of the stops that serve it. This is what converts a one-visit report
   into a retained user, and it's powered entirely by the archive.
5. **Realtor share card.** A branded, embeddable version of the report with the agent's name
   and photo, plus an OG image for social. The paid B2B feature, and the one that puts your
   name on other people's listings.

Feature 4 is the only one that requires accounts. Ship 1–3 with no login at all.

### The stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | **Vite + React + TypeScript + Tailwind** | Already in this repo. Static output, hosted free. Next.js is a reasonable alternative if you want file-based API routes and ISR, but it buys little here — the dynamic part is one endpoint. |
| API | **Web-standard `fetch` handler** (`src/server/handler.ts`) | Framework-free, so the same function runs on Vercel, Cloudflare Workers, Netlify, Deno Deploy or plain Node. Moving off a free tier that just changed its pricing becomes a config change. |
| Edge cache | Platform CDN via `Cache-Control` / `s-maxage` | The handler already emits the right headers. Repeat traffic to a popular address never reaches origin. |
| Database | **Supabase** (Postgres + PostGIS + auth) | Free tier covers the MVP. PostGIS for the archive's spatial queries, Auth for feature 4, and Row Level Security so saved addresses aren't a data-breach waiting to happen. |
| Archive job | **GitHub Actions cron** (or Supabase scheduled function) | A 30-second snapshotter doesn't need a server. Free minutes cover it. |
| Email | **Resend** free tier | 3,000/mo is more than a thousand weekly-digest users need at launch. |
| Maps | **MapLibre GL + free raster tiles** | No Mapbox bill, no token to leak. Swap in a paid tile provider only if traffic justifies it. |
| Analytics | **Plausible self-hosted** or Umami | Cheap, and it keeps you out of consent-banner territory. |

**Running cost at 1,000 users: effectively $0**, plus a domain. The only line item that
grows is Supabase storage as the archive accumulates, and that is measured in dollars per
year, not per month.

---

## 4. System architecture & code

### Data flow

```
                    ┌──────────────────────────────────────┐
  scheduled (30s)   │  snapshotter (GitHub Actions cron)    │
  ──────────────▶   │  GTFS-RT → normalise → Supabase       │  ← the moat
                    └──────────────────────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ Supabase        │
                            │ + PostGIS       │
                            │ delay_history   │
                            │ permit_snapshot │
                            │ saved_addresses │
                            └────────┬────────┘
                                     │ (historical context)
  browser                            │
     │  GET /api/pulse?address=…     ▼
     ├──────────────▶ CDN edge cache ──▶ pulse handler
     │                  (s-maxage)          │
     │                                      ├─▶ geocoder      (24h cache)
     │                                      ├─▶ GTFS-RT       (20s cache, region-wide)
     │                                      ├─▶ municipal ODS (15m cache, ~100m key)
     │                                      └─▶ Open511       (3m cache)
     │                                            │
     │◀───────────── one merged JSON ─────────────┘
     │               + per-source status
     ▼
  React report page
```

Three properties worth naming:

- **The browser talks to exactly one endpoint.** It never holds an API key, never learns that
  Surrey speaks ArcGIS, and never has to handle a partial failure itself — the `sources`
  array tells it which cards to grey out.
- **Upstream load is decoupled from user load.** Realtime is fetched region-wide on a timer;
  civic queries are keyed to a rounded point. Ten thousand page views do not become ten
  thousand upstream requests.
- **The archive is written by a separate process** from the one serving requests, so a slow
  or failed snapshot never touches request latency.

### The implementation

The concurrent fan-out and merge lives in [`src/server/pulse.ts`](../src/server/pulse.ts).
Its shape:

```ts
const [tripUpdates, alerts, serviceRequests, permits, rentalIssues, roadEvents] =
  await Promise.all([
    runSource(TRANSLINK_META, 'translink:trip-updates', POLICY.realtime,
      () => fetchTripUpdates(fanoutSignal)),
    runSource(TRANSLINK_ALERTS_META, 'translink:alerts', POLICY.alerts,
      () => fetchAlerts(fanoutSignal)),
    municipalOk
      ? runSource(VAN_311_META, `van:311:${key}`, POLICY.civic,
          () => fetchServiceRequests(centre, radiusM, fanoutSignal))
      : skippedSource(VAN_311_META, skipReason),
    // …permits, rental standards, DriveBC
  ]);
```

`Promise.all` is safe here — and preferable to `allSettled` — precisely because `runSource`
never rejects: it catches, classifies and returns a `SourceResult` with a user-safe message.
The failure handling is pushed to one place instead of being repeated at every call site.

Supporting pieces, each independently tested:

| Module | Responsibility |
| --- | --- |
| `http.ts` | Per-request timeouts, full-jitter retry, `Retry-After`, caller-abort propagation. |
| `cache.ts` | TTL + stale-while-revalidate + **single-flight** + stale-if-error. |
| `gtfs/protobuf.ts` | ~150-line protobuf wire reader — no `protobufjs`, so it bundles for edge runtimes. Unknown fields are preserved, not rejected. |
| `gtfs/realtime.ts` | GTFS-RT decode, limited to the fields actually read. |
| `gtfs/stopIndex.ts` | RFC-4180 CSV parsing + a grid spatial index over `stops.txt`. |
| `score.ts` | Pure, deterministic, explainable scoring with weight-dropping. |

Run it:

```bash
npm install
npm test                     # 53 tests
npm run typecheck
TRANSLINK_API_KEY=… npm run dev:api
curl 'http://localhost:8787/api/pulse?address=555+W+Hastings+St+Vancouver'
```

With every upstream unreachable, the endpoint still returns `200` with a withheld score and
six `status: "error"` sources — verified, not asserted.

### Build order

1. **Week 1 — the snapshotter.** Before any UI. Every day you don't run it is a day of
   archive you can never get back.
2. **Week 2 — the report page**, features 1–3, no accounts.
3. **Week 3 — share cards and OG images.** Growth depends on the link looking good in a
   Reddit preview.
4. **Week 4 — Surrey and Burnaby adapters.** Half the region's renters, and nobody else
   covers them.
5. **Week 6+ — accounts, commute watch, realtor tier** — once the archive has enough history
   to say something a live feed can't.

---

## 5. Local marketing & growth: first 1,000 users

Zero ad budget. The strategy is the same shape as the product: **be genuinely useful in
public, and let the artifact carry the link.**

### The one thing that matters

**Publish the transit reliability data before you launch the product.** Six weeks of
snapshots is enough to write "Metro Vancouver's least reliable bus stops, ranked." That post
is:

- irresistible to r/vancouver — it settles arguments people have been having for years,
  with data;
- pickup-ready for *Daily Hive*, *Vancouver Is Awesome*, *CityNews* and the *Sun*, because it
  is a local data story that costs them nothing to run;
- unarguable, because it's TransLink's own feed;
- and it ends with "we built this from the open data — check any address."

One post like this outperforms months of grinding. Everything below supports it.

### Community, done without getting banned

- **r/vancouver, r/SurreyBC, r/Burnaby, r/NewWest, r/vancouverhousing.** Do not post a launch
  ad. Spend a month answering "is this a good area?" and "how is the bus from here?" threads
  with an actual MetroPulse report link for *that specific address*. The link is the pitch.
  Read each subreddit's self-promotion rules, and message the mods before you post anything
  that looks like a launch — Vancouver mods are strict and a ban on r/vancouver costs you the
  single best channel in the region.
- **r/dataisbeautiful** for the reliability map. Different audience, national reach, feeds
  back local.
- **Facebook groups:** neighbourhood buy-nothing groups, "Vancouver Renters," "Surrey
  Community," strata and building-specific groups. Higher trust, lower volume, and where
  renters actually ask these questions. Same rule: answer questions, don't advertise.
- **Bluesky/X local accounts.** A daily automated "most-delayed stop yesterday" post is
  low-effort, on-brand, and occasionally goes local-viral.

### Distribution partners who need you

- **Realtors and rental property managers** are your paying customers *and* your
  distribution. Every branded report on a listing carries your footer. Cold-email 50 agents
  who post listings on Instagram with a free branded report for their current listing,
  already made. Conversion on "here is a thing I already built for you" is not comparable to
  a cold pitch.
- **Small-landlord and tenant advocacy groups** care about the rental-standards data
  specifically. Offer it to them free, permanently. Goodwill and credibility in a space where
  both are scarce.
- **UBC and SFU** — urban planning, geography, and the transportation research groups. Free
  API access for research. They will use it, cite it, and their citations are the
  highest-quality backlinks you can get.
- **VanHacks, Open Data Day, Vancouver Civic Tech, BC Dev Exchange.** This project is
  precisely the kind of thing that community exists to encourage. Demo it; don't sell it.

### Local SEO, which compounds while you sleep

Generate a static, indexable page per neighbourhood — "Transit reliability in Mount
Pleasant," "Commuting from Whalley" — built from the archive. Hundreds of pages that answer
a real long-tail query, each one linking to the live address lookup. This is slow for two
months and then it is most of your traffic.

### Milestones

| Users | Channel | Timeline |
| --- | --- | --- |
| 0–100 | Reddit answers, friends, civic-tech demo | weeks 1–3 |
| 100–400 | The reliability report + local media pickup | week 4–6 |
| 400–1,000 | Realtor reports in circulation + neighbourhood SEO | months 2–4 |

### The honest risks

- **TransLink's terms of use** are the real constraint on the paid tier. Resolve it in week
  one, by email, before you have revenue to lose.
- **Municipal portals change dataset ids** without notice. `npm run verify:sources` in CI,
  daily, is the cheap insurance.
- **Suburban coverage is genuinely thinner than Vancouver's.** Say so in the UI. "Not yet
  available for Coquitlam" keeps trust; an empty map destroys it.
- **A score attached to an address is a claim about a place people live.** Keep every
  component explainable, keep the raw records one click away, and stay out of crime and
  school rankings. The product's whole value is being the trustworthy one.
