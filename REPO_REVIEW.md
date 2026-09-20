# MetroPulse — Repository Review

Read-only audit, 2026-09-20. Branch `claude/nifty-davinci-w3we89` @ `f5f39c2`.
Verified by running `npm install`, `npm test` (117 pass), `npm run typecheck` (clean),
`npm run build` (clean), `npm audit`, and by executing the scorer directly.

---

## 1. Executive summary

The backend is genuinely good — better than most seed-stage code I see. ~2,500 lines of
framework-free TypeScript that fans out across five government APIs, degrades per-source
instead of failing, caches by how fast each feed actually changes, and hand-rolls a
protobuf reader so it bundles for edge runtimes. 117 tests, all passing, all meaningful.

Everything around it is unfinished or wrong. The default branch (`main`) contains none of
it. The landing page pitches a *different product* ("Should I go out today?", BC Parks,
Vercel) than the one that was built. The stop index ships as a 10-row placeholder whose
IDs match nothing real, so the flagship transit panel is empty on every fresh deploy. The
"moat" — the delay archive — will exhaust a Supabase free tier in roughly a day because
it re-inserts the entire forward-looking feed every five minutes with no dedup key, and
its table has no row-level security. The share-card growth mechanism emits SVG, which
Facebook, X and LinkedIn will not render.

Business-wise: the blueprint's #1 monetization pick (realtor white-label) is the wrong
first bet and its #2 (consumer $6/mo) should be cut. The only thing here nobody else has
is the transit-reliability archive. Build that, publish it free, sell the data and the
analysis. Top 5 actions are in §7.

---

## 2. What the app is, and its mission

**What it does.** You type a Metro Vancouver address. It geocodes it against the free
BC Address Geocoder, uses the returned *locality* to pick a municipal adapter, then fans
out concurrently to TransLink's GTFS-Realtime feed (trip updates + service alerts), the
city's open-data portal (311 cases, issued building permits, rental-standards violations)
and DriveBC's Open511 road events. It merges them into one JSON document with a 0–100
"Pulse Score" broken into five explainable components, and a per-source status array so
the UI can grey out whatever's down.

**Who it's for.** Renters, buyers and relocators in Metro Vancouver — people about to
commit money to a specific address who currently get square footage and a Walk Score and
nothing else.

**The problem it solves.** The listing doesn't tell you the 99 B-Line at your stop has
run seven minutes late every weekday for two months, that a 26-storey rezoning was
approved behind the building, that the building has eleven outstanding bylaw violations,
or that the street is about to be torn up for eighteen months. Today that's five browser
tabs, two PDF council agendas, and knowing the Rental Standards register exists at all.

**Apparent mission.** *Close the information gap between the person signing the lease and
the person holding the pen* — using only public data, with every number interrogable.

**Stack.** Vite + React 18 + TypeScript + Tailwind v4 frontend; framework-free web-standard
`fetch` handler as the API (`src/server/handler.ts`), deployed on Cloudflare Workers with
a static-assets binding (`wrangler.jsonc`), with parallel Vercel/Netlify entry points in
`api/`. Vitest for tests. Supabase (Postgres) as the archive sink. GitHub Actions cron as
the snapshotter. No server, no container, no framework lock-in — the portability is real
and it is the best architectural decision in the repo.

**Architecture.** One join key: a point. Three upstream dialects behind one adapter
interface — Opendatasoft (Vancouver, and reusable for New West/Richmond by swapping a base
URL), ArcGIS FeatureServer (Surrey, Burnaby), Open511 (DriveBC) — plus GTFS-Realtime, which
is fetched *region-wide once* and cached, so upstream load is a function of time, not
traffic. Civic cache keys are rounded to ~100 m so neighbours share an entry. Nothing
throws past `runSource` (`src/server/sources/base.ts:28`); a dead portal greys one card.

**Current state: half-built, and split in two.**

- **Backend:** working, tested, deployable. ~90% done for an MVP.
- **Frontend:** a pitch deck about the business idea with the actual product hidden behind
  a nav tab labelled "Live Demo". Six of seven screens describe a product that does not
  exist.
- **Archive (the stated moat):** code exists, schema exists, cron exists — and it has
  never been run, would not survive contact with the free tier if it were, and is the one
  thing whose value is strictly a function of *when you start*.
- **`main` (the default branch) has none of the backend.** It is the original pitch deck
  only. PRs #2–#7 all merged into the feature branch. A Cloudflare Git integration
  pointed at `main` deploys a marketing site with no API.

---

## 3. Technical issues

Severity: **C**ritical / **H**igh / **M**edium / **L**ow. Effort: **S**mall (<½ day),
**M**edium (½–3 days), **L**arge (>3 days).

### Critical

| # | Issue | Location | Sev | Eff | Suggested fix |
|---|---|---|---|---|---|
| 1 | **The default branch has no product.** `main` contains only the React pitch deck — no `src/server/`, no `api/`, no `src/worker.ts`, no `wrangler.jsonc`. All backend work merged into `claude/nifty-davinci-w3we89`. Any Git-integration deploy of `main` ships a site whose "Live Demo" fetches a 404. | `git ls-tree -r origin/main` vs. working tree | C | S | Merge the feature branch to `main` and make `main` the deploy source. Nothing else in this list matters until this is done. |
| 2 | **The archive will destroy the free tier inside a day, and stores ~9× duplicate rows.** Every 5-minute poll flattens the *entire forward-looking* TripUpdates feed and `insert`s it. A prediction 45 min out is re-archived on ~9 consecutive polls under a new synthetic `id`. Order of magnitude: ~50–120k stop-time-updates per poll × 288 polls/day ≈ **15–35M rows/day**, several GB/day with indexes, against a 500 MB free tier. | `src/server/snapshot/sinks.ts:44` (`insert`, not `upsert`); `supabase/schema.sql:5`; `.github/workflows/snapshot.yml:15` | C | M | Add `unique (trip_id, stop_id, predicted_time)` and switch to `upsert(..., { onConflict, ignoreDuplicates: true })`; archive only the **next** unserved stop per trip rather than the whole horizon; add a retention/rollup job (raw rows → hourly per-stop aggregates after 30 days). Do this *before* the cron is ever enabled. |
| 3 | **Supabase table has no RLS.** `delay_observations` is created with no `enable row level security` and no policies. Supabase grants the `anon` role access to `public` by default, so the table is readable — and writable — by anyone holding the publishable anon key, which ships in client bundles by design. | `supabase/schema.sql:5-26` | C | S | `alter table delay_observations enable row level security;` plus a read-only policy for `anon` (or none at all, and serve reads through a view/RPC). Service key stays server-side only. |
| 4 | **Two unrated-limited paths into the full fan-out.** `/api/pulse` was hardened (PR #6) but `/api/og` and `/report/<slug>` both call `buildPulse` with an attacker-controlled address/slug and never touch the rate limiter. Anyone can burn the shared TransLink key and the DataBC geocoder quota with a loop over `/report/<random>`. | `src/worker.ts:84`, `src/worker.ts:92`; `src/server/og.ts:163`; limiter only in `src/server/handler.ts:74` | C | S | Extract the limiter into a wrapper applied to all three routes. Additionally: reject slugs that don't geocode with a cheap negative cache so repeat junk never re-hits upstream. |
| 5 | **Transit is empty on every fresh deploy.** `STOP_INDEX_PATH` defaults to `data/stops.sample.csv` — ten rows with placeholder IDs (`DEV1001`…) that match nothing in the real feed. The real index is gitignored, built by a manual three-command recipe in the README, and has no scheduled job. Workers additionally requires it as an HTTPS URL, and `wrangler.jsonc` ships that var as `""`. So the flagship panel — the whole reason the product exists — renders blank until someone reads step 4 of the README. | `.env.example:9`; `data/stops.sample.csv`; `wrangler.jsonc:27`; `src/server/config.ts:88` | C | M | Add a weekly GitHub Actions job that downloads static GTFS, runs `build:stops`, and uploads the CSV to R2/a release asset; point `STOP_INDEX_PATH` at it. Until then, make an unset/sample index a loud `status: "error"` on the transit card with a real message, not a silent empty list. |

### High

| # | Issue | Location | Sev | Eff | Suggested fix |
|---|---|---|---|---|---|
| 6 | **Transit-access scoring is inverted: more stops lowers the score.** `choice = ramp(stops.length, 6, 1)` is 100 at six stops and 0 at one; the composite then uses `(100 - choice)`. The comment says "a second stop is a bonus." Verified by running the scorer: 1 stop @150 m → **100**; 3 stops → 90; 10 stops → **75**. A downtown corner scores worse than a cul-de-sac. | `src/server/score.ts:59-60` | H | S | Use `choice` directly: `0.75 * proximity + 0.25 * choice`. Add a regression test asserting monotonic non-decrease in stop count at fixed distance — the current suite fixture has exactly one stop, which is why this passed. |
| 7 | **The share card won't unfurl where sharing happens.** `og:image` is served as `image/svg+xml`. Facebook does not render SVG og:images; X/Twitter cards accept JPG/PNG/WEBP/GIF only; LinkedIn does not render SVG. The file comment asserts the opposite. The share link *is* the growth strategy, per the blueprint. | `src/server/og.ts:1-9`, `src/server/og.ts:133` | H | M | Rasterize to PNG. On Workers: `@cf-wasm/satori` + `resvg-wasm`, or render the SVG once and cache the PNG in R2/KV keyed by slug. Keep the SVG path as a fallback. |
| 8 | **No CI for tests, typecheck or build.** `.github/workflows/` contains only `snapshot.yml`. The README instructs "Run it [`verify:sources`] in CI daily. Municipal portals rename datasets without notice." No such workflow exists. Nothing stops a red build from merging. | `.github/workflows/` | H | S | Add `ci.yml` (push + PR: `npm ci`, `test`, `typecheck`, `build`) and `verify-sources.yml` (daily cron, opens an issue on failure). |
| 9 | **The landing page describes a product that does not exist.** Six of seven screens are the original "Should I Go Out?" deck: "BC Parks APIs" in the H1 subhead, a BC Parks adapter card, a New Westminster card, an import of `@/lib/bcparks` (no such file), and Vercel deployment copy in a repo that deploys to Cloudflare. Stat tiles claim "7+ Free APIs Banded" (actual: 5) and "6+ Municipalities" (actual: 3, two of them permits-only and unverified). | `src/components/Hero.tsx:44-47,150-153`; `BusinessIdea.tsx:22,56`; `DataArchitecture.tsx:42,51`; `SystemArchitecture.tsx:12,269,320` | H | M | Delete or move the deck behind `/about`. Make `/` the address search. Any stat that stays must be computed or correct. |
| 10 | **`index.html` is unshipped scaffolding.** `lang="zh-CN"` on an English Vancouver product (real SEO + a11y harm); Chinese comments; an iframe sandbox error-reporter that `postMessage`s stack traces to `window.parent` with target `"*"`; a theme listener that accepts any origin's message; a FontAwesome CDN stylesheet that is render-blocking and entirely unused (the app uses `lucide-react`); no `og:*`, no `meta description`, no favicon, no canonical. | `index.html:2,9,12,31-91` | H | S | Rewrite the shell: `lang="en-CA"`, drop both sandbox scripts and the CDN link, add description/OG/Twitter/favicon/canonical defaults for `/`. |
| 11 | **The score claims freshness the queries don't provide.** `constructionPressure` reasons about "recent permits" and `quietness` about "open service requests", but `fetchBuildingPermits` and `fetchServiceRequests` pass no date or status predicate. Vancouver's issued-permits dataset spans years; a 2019 permit counts identically to one issued last week. `queryOds` already supports `where`. | `src/server/sources/vancouver.ts:130,150`; `score.ts:88-104,69-86` | H | S | Pass `where: "issuedate > date'…'"` (rolling 12 months) and a `status` filter for 311; reflect the window in the reason string ("in the last 12 months"). |
| 12 | **Two vulnerable dependencies, both unused; nine unused dependencies total.** `npm audit`: 3 moderate — `react-router-dom` (open redirect via backslash in `<Link>`/`useNavigate`; arbitrary constructor injection in `deserializeErrors()`) and `uuid` (missing buffer bounds check). Neither is imported anywhere. Unused: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `canvas-confetti`, `date-fns`, `react-router-dom`, `recharts`, `uuid`, `@types/canvas-confetti`, `@types/uuid`. | `package.json:18-30` | H | S | Remove all ten. Audit goes clean and the dependency surface halves without a single code change. |

### Medium

| # | Issue | Location | Sev | Eff | Suggested fix |
|---|---|---|---|---|---|
| 13 | Workers cancels background work after the response returns unless it's in `ctx.waitUntil`. The stale-while-revalidate refresh is fire-and-forget, so on Workers SWR mostly degrades to "serve stale, never refresh" under low traffic. | `src/server/cache.ts:84` | M | M | Thread `ExecutionContext` through and `ctx.waitUntil()` the refresh promise. |
| 14 | Cache and rate limiter are per-isolate. Workers runs many short-lived isolates across colos, so "one poll serves the whole region" and "30 req/min per IP" are both per-isolate, not global. Real upstream volume and real rate limits are both N× the documented figures. | `src/server/cache.ts:1-11`; `src/server/rateLimit.ts:1-11` | M | M | Back both with KV (or Durable Objects for the limiter) in production. The in-memory versions stay as the local/dev implementation behind the same interface. |
| 15 | **No map, and the raw records are never shown.** The blueprint names "nearby activity map" as MVP feature 3 and states the trust promise as "keep the raw records one click away." `LiveDemo` renders only four count tiles; the `civic.*` arrays come down the wire complete and are then discarded. | `src/components/LiveDemo.tsx:354-361` | M | M | Render each record as an expandable row (title, date, distance) before building the map. That's an afternoon and it delivers most of the trust value. |
| 16 | `/api/og` has no Vercel/Netlify entry point — `api/og.ts` doesn't exist. Cards work on Workers only, silently. | `api/` vs `src/worker.ts:84` | M | S | Add `api/og.ts` mirroring `api/pulse.ts`. |
| 17 | The Refresh button can't refresh. It re-issues the same query; civic TTL is 15 min and geocode is 24 h, so it returns the identical cached payload with no indication why. | `LiveDemo.tsx:345-349`; `pulse.ts:58-65` | M | S | Either remove it, or accept a `?fresh=1` that bypasses TTL and is itself rate-limited more tightly. |
| 18 | Surrey/Burnaby ArcGIS base URLs *and field names* are transcribed from docs and unverified. `verify:sources` only checks HTTP-OK and non-empty bytes — it never asserts `PERMIT_TYPE` or `ISSUED_DATE` exist. A renamed field yields records titled `"permit"` with null dates, `status: "ok"`, and no signal that anything is wrong. Half the region's renters are in these two cities. | `sources/arcgis.ts:149-152,165-168`; `scripts/verify-sources.ts:92-100` | M | M | Have `verify:sources` assert that each check returns ≥1 feature and that the first feature carries at least one key from each `titleKeys`/`dateKeys`/`idKeys` list. Fail the run otherwise. |
| 19 | `snapshot.ts` is four unguarded top-level awaits. One upstream blip fails the workflow and emails you; a partial Supabase chunk failure throws mid-write leaving the poll half-archived. | `scripts/snapshot.ts:16-19` | M | S | Wrap in try/catch, retry the fetch once, log a structured result, exit 0 on transient upstream failure so the cron doesn't spam. |
| 20 | TransLink API key is passed as a URL query parameter with `redirect: 'follow'`. A redirect to another host forwards the full URL, key included. | `sources/translink.ts:22-29`; `http.ts:86` | M | S | Use `redirect: 'manual'` for keyed requests, or move the key to a header if TransLink accepts one. |
| 21 | Routing is `useState` + `window.location.pathname` read once at module scope. No back-button support; navigating away from `/report/<slug>` leaves the URL stale; `react-router-dom` is installed and unused. | `App.tsx:12,15`; `LiveDemo.tsx:302-318` | M | M | Once `/` becomes the product (issue 9) this mostly dissolves. Use the History API properly or adopt the router that's already in `package.json`. |
| 22 | `parseStopsCsv` splits on newlines before parsing quotes, so a quoted field containing a newline corrupts that row and every field after it. The quote handling in `splitCsvRow` is otherwise correct, which makes this easy to miss. | `gtfs/stopIndex.ts:120` | M | S | Tokenize the whole document in one pass rather than pre-splitting lines. |
| 23 | Every caller without `cf-connecting-ip` or `x-forwarded-for` shares the bucket `'unknown'`. On any deployment without a trusted edge header, all traffic shares one 30/min limit. | `rateLimit.ts:21-35`; `handler.ts:75` | M | S | Fail closed only when a resolver was explicitly configured; otherwise log loudly at boot and fall back to a per-deployment global limit that's sized as such. |
| 24 | No `/legal` or attribution page, though `SourceMeta.licence` is documented as being "for the /legal page". Attribution renders only inside source chips, which only appear *after* a successful query. Most BC open-data licences require visible attribution. | `types.ts:17`; `LiveDemo.tsx:181-185` | M | S | Add a static `/legal` listing every source, attribution and licence. This is a compliance item, not a polish item. |

### Low

| # | Issue | Location | Sev | Eff | Suggested fix |
|---|---|---|---|---|---|
| 25 | No tests for `geocoder.ts`, `vancouver.ts`, `drivebc.ts`, `base.ts`, `realtime.ts`, or any React component. The tested modules are tested well; the untested ones are the adapters most likely to break on a portal change. | `src/server/__tests__/` | L | M | Fixture-based tests for each adapter's response→`CivicRecord` mapping. |
| 26 | Unreachable `continue` — nothing inside the `try` throws `UpstreamError` except the path already handled two lines above. | `http.ts:100` | L | S | Delete. |
| 27 | `config` is frozen at module load from `globalThis.process.env`, which only works on Workers because of the `nodejs_compat` + `compatibility_date >= 2025-04-01` combination noted in `wrangler.jsonc`. Moving that date silently turns every key into "not configured". | `config.ts:16-24`; `wrangler.jsonc:7-11` | L | M | Make config a function of an injected env object; pass `env` from the Worker fetch handler. Removes the footgun entirely. |
| 28 | The snapshot cron is `*/5 * * * *` ≈ 8,640 Actions-minutes/month (`npm ci` runs every time). Free on a public repo; ~4× the free allowance on a private one. | `.github/workflows/snapshot.yml:15` | L | S | Cache `node_modules` properly, or move the poll to a Supabase scheduled function / Cloudflare Cron Trigger. |
| 29 | `README.md` says "53 tests"; the suite has 117. Small thing, but it's the first number a technical reader checks. | `README.md:12` | L | S | Update, or drop the count. |
| 30 | `cache.peek()` always returns `stale: true` regardless of age, and has no callers. | `cache.ts:48-52` | L | S | Delete or fix. |

---

## 4. Feature and UX recommendations

### The one thing stopping a stranger from using this

They land on `/` and get a pitch deck about a business idea. To reach the product they
must notice that one of seven nav items is called "Live Demo." Then, on a fresh deploy,
the transit panel — the differentiator — is empty, because the stop index is a placeholder.

Fix those two and the product exists. Nothing in this section matters more.

### Double down on

- **Per-source degradation with honest reasons.** `skippedSource` producing *"Surrey does
  not publish 311 through this adapter yet"* instead of an empty list is the single most
  trust-building thing in the codebase, and no competitor does it. Surface it harder —
  a coverage map on the landing page showing exactly which datasets exist per municipality
  turns your biggest weakness into a credibility signal.
- **The explainable score.** Every component carries its sentence and its weight, and the
  number is withheld below 50% coverage. Keep both. Make the withheld state feel
  deliberate rather than broken — right now it reads as an error.
- **The shareable `/report/<slug>` URL.** Correct instinct, correctly built (canonical
  slug derived from the *geocoded* address, so spelling variants converge). It just needs
  a PNG card (#7) and a page worth landing on.
- **The delay archive.** The only asset here that compounds and cannot be bought. See §5.

### Cut

- **The blueprint deck as the primary site.** Move to `/about`, or delete. It is six
  screens of claims about unbuilt features, and it is actively costing you credibility
  with anyone technical who reads it against the repo.
- **BC Parks, "Should I go out today", the Go Score.** That product is gone. Every
  reference to it should go with it.
- **Consumer Pro at $6/mo.** See §5 — this is the wrong monetization and it will cost more
  in support and Stripe plumbing than it returns.

### Build next (ranked by value per day of work)

1. **Raw records under each count tile** (½ day). Expandable rows: title, date, distance,
   source. This is the "one click away" promise the blueprint makes and the product
   currently breaks.
2. **A real onboarding path** (1 day). `/` is a search box, three example addresses with
   *actually interesting* results, and one line explaining what a Pulse Score is. No nav
   tabs, no gradient orbs.
3. **Coverage transparency page** (½ day). A matrix: municipality × dataset × status.
   Generated from `LOCALITY_REGISTRY`, so it can never drift from reality.
4. **Map** (2 days). MapLibre + free raster tiles, pins for every civic record, click for
   the raw record. Feature 3 of the MVP as written.
5. **Reliability history panel** (2 days, gated on the archive). "This stop has been more
   than 5 minutes late on 61% of weekday mornings over the last 30 days." This is the one
   thing on the page a competitor cannot replicate by calling the same public APIs. It is
   the entire moat, rendered.
6. **Neighbourhood pages** (2 days, gated on the archive). Static, indexable, one per
   neighbourhood, generated from archive aggregates. Slow for two months, then most of
   your organic traffic.
7. **Richmond + New Westminster** (½ day). They run Opendatasoft; the adapter already
   exists; it is a config entry and a registry row each. Cheapest coverage you will ever
   buy — it takes you from 3 municipalities to 5 for an afternoon's work.
8. **PDF export** (1 day). The thing a realtor or a renter actually hands to someone else.

### UX gaps worth naming

- No address autocomplete. The DataBC geocoder has a `/addresses.json` suggestion mode;
  typing a full address correctly on a phone is the highest-friction moment in the flow.
- No empty-state distinction. "No permits within 800 m" and "Burnaby doesn't publish
  permits through this adapter" must never look alike — the data supports the distinction
  (`status: skipped` carries a reason) and the UI collapses it into a `0` tile.
- No radius control, despite the API accepting 100–2000 m.
- Score changes aren't dated. A report shared today and opened next week shows different
  numbers with no indication that it's live rather than a snapshot.
- Mobile nav is seven unlabelled icons in a horizontal scroll.

---

## 5. Business and monetization options

### The honest read on the current plan

The blueprint ranks realtor white-label first and consumer Pro second. I think that's
backwards on the second and premature on the first.

**Why consumer Pro ($6/mo) should be cut outright.** People move every 1–3 years. The
address report is used intensely for two weeks and then never again — that is the
canonical anti-subscription usage curve. The retention feature (commute watch) requires
accounts, email infrastructure, and an archive you don't have yet, and it competes with
Google Maps notifications for free. Walk Score already owns this mental slot and costs
nothing. At $6/mo you need ~700 paying subscribers to clear $4k MRR, from a metro of 2.8M
where maybe 40k people are actively apartment-hunting in any given month. The support
load and the Stripe/auth/billing surface will cost you more engineering weeks than the
revenue justifies. Keep the consumer report free forever and use it as top-of-funnel.

**Why realtor white-label is premature, not wrong.** It's the only option with a
repeatable sales motion, and I'd get there — but not first, for four specific reasons:
(1) TransLink's Open API Terms of Use explicitly gate a paid tier visibly built on their
data, and that's unresolved; (2) your differentiator is reliability *history*, which
doesn't exist until the archive has run for two months; (3) coverage outside Vancouver is
permits-only, and a large share of Greater Vancouver listings are in Surrey, Burnaby,
Coquitlam and Richmond; (4) there is a structural mission conflict — see §6.

### The options, ranked

#### 1 — Transit reliability: free public index → licensed data + API ★ **TOP PICK**

- **Target customer.** Transportation consultancies with Vancouver practices (Stantec,
  WSP, Arcadis/IBI, Urban Systems, Bunt, Watt); municipal transportation planning
  departments (Vancouver, Burnaby, New West, Surrey); TransLink's own planning group;
  academic transport labs (UBC SCARP/REACT, SFU City Program); BIAs and developers who
  commission access studies; later, proptech and insurers.
- **Pricing.** Free tier (attribution, academic/nonprofit/journalist). $199/mo Startup —
  100k calls, 12 months history. $749/mo Business — 1M calls, full history, bulk export.
  $2,500–5,000/mo or annual contract for agency/consultancy with SLA and custom
  aggregations. Plus $8k–25k one-off reliability audits — realistically your *first*
  revenue.
- **Code reuse.** ~40% directly (`gtfs/protobuf.ts`, `gtfs/realtime.ts`, `gtfs/stopIndex.ts`,
  `snapshot/*`, `http.ts`, `cache.ts`). Needs a time-series store, a rollup pipeline, and
  an analytics query layer that doesn't exist yet.
- **Effort to launch.** Free index: ~3 weeks after the archive starts (2 weeks of data +
  1 week of page). Paid API: 6–8 weeks.
- **Revenue potential: HIGH.** Two consultancy contracts and one municipal engagement is
  a $60–100k year for one person.
- **Why it wins.** It is the only asset here that cannot be replicated by someone who
  reads your README and gets the same API keys. TransLink's feed describes the next 45
  minutes and is then gone forever; nobody in the region archives it. Every day you don't
  run the snapshotter is a day of moat you can never buy back. Storage for a year of
  compressed observations is single-digit gigabytes. The economics are absurd in your
  favour. It is also the only option where the buyer has a procurement budget and a
  reason to answer a cold email.

#### 2 — Done-for-you civic data engineering

- **Target.** Regional transit agencies and regional districts outside Metro Vancouver;
  proptech and relocation startups that need multi-jurisdiction civic data; corporate
  mobility firms.
- **Pricing.** $8k–40k per project; $2–5k/mo maintenance retainers.
- **Reuse.** ~70% — the adapter pattern, `SourceResult` degradation model, the fan-out
  budget, and the portable handler transplant to any region with open data.
- **Effort.** Small — the repo *is* the portfolio piece. Weeks, not months.
- **Revenue: HIGH per deal, LOW leverage.** This is a job, not a company. But it's the
  cash bridge that funds option 1, and the projects generate adapters you keep.

#### 3 — Realtor / property-manager white-label

- **Target.** Greater Vancouver realtors, boutique property managers, rental platforms.
- **Pricing.** $39–79/mo, annual billing.
- **Reuse.** ~85% — branding, PDF, embed widget, a light account system.
- **Effort.** Medium, 4–6 weeks. Plus a Stripe/auth surface you currently don't have.
- **Revenue: MEDIUM.** 50 agents at $59 = $2,950 MRR. Realistic ceiling for a solo
  operator with no sales team is maybe 150–250 agents; realtor SaaS churn runs high.
- **Verdict.** Do it in month 4+, after the ToU answer and after the archive has history
  worth branding. Not first.

#### 4 — Regional template / licensed deployment ("MetroPulse for Calgary")

- **Target.** Civic-tech groups, municipal innovation offices, solo operators in other
  metros.
- **Pricing.** $2–5k setup + $200–500/mo hosted, or $499 one-time source licence.
- **Reuse.** ~90%.
- **Effort.** Medium — requires genuinely extracting region-specific config, which the
  architecture already anticipates.
- **Revenue: LOW–MEDIUM.** Small market, high support burden per dollar.

#### 5 — Lead referral (movers, internet, tenant insurance, storage)

- **Target.** Referral partners, not customers.
- **Revenue: LOW**, and it is the option I'd argue hardest against. See §6.

### Monetization plan for the top pick

**Phase 0 — weeks 1–2, prerequisite.** Fix the archive (issue #2), enable RLS (#3), start
the snapshotter. Email TransLink's open-data contact on day one asking specifically about
(a) publishing derived reliability statistics and (b) a paid API tier over derived
statistics. This is one email and it gates every dollar below.

**Phase 1 — weeks 3–6, free and public.** Ship "The Late Index": every stop and route in
Metro Vancouver ranked by measured on-time performance, updated weekly, free forever,
downloadable as CSV with attribution. No login, no email gate. This is simultaneously the
product, the proof, the press release and the lead magnet.

**Phase 2 — weeks 6–12, paid API.**

| Tier | Price | Included |
|---|---|---|
| Public | Free | Web index, weekly CSV, attribution required |
| Research | Free | API key, 10k calls/mo, academic/nonprofit/journalist, citation required |
| Startup | $199/mo | 100k calls/mo, 12 months history |
| Business | $749/mo | 1M calls/mo, full history, bulk export, email support |
| Agency | $2,500+/mo or annual | Unlimited, SLA, custom aggregations, named contact |

**Phase 3 — month 4+.** Reliability audits ($8–25k) as the high-margin service layer, and
the realtor tier once the ToU answer is in hand and the archive can say something a live
feed can't.

**Getting the first paying customers.** Not self-serve. The free index gets you a media
story; the media story gets you inbound from exactly the five consultancies in town who
do transit work; the first paid engagement is a scoped audit, not a subscription. Price
the first one at $8k and treat it as a case study you're allowed to publish.

### Branding and positioning

**MetroPulse** is fine but generic — several products use it, and it says nothing about
what you do. My recommendation is a two-brand structure, because you have two audiences:

- **MetroPulse** stays the consumer product and the company.
  - *Tagline:* **"Know the block before you sign."** (This is already in the README and
    it's genuinely good — specific, verb-driven, names the moment of decision.)
  - *One-line pitch:* "MetroPulse merges live transit, permits, 311 and road work into one
    scored report for any Metro Vancouver address — the things the listing leaves out."
- **The Late Index** launches as the public data artifact and the B2B front door.
  - *Tagline:* **"Every bus stop in Metro Vancouver, ranked by how late it actually is."**
  - *One-line pitch:* "We archive TransLink's real-time feed — which nobody else keeps — so
    we can tell you which stops are chronically late, and what that means for the address
    you're about to sign for."
  - The name is a headline. That is the entire point: it is designed to be the thing a
    journalist quotes.

**Landing page messaging (`/`), in order:**

1. H1: *Know the block before you sign.*
2. Sub: *Live transit reliability, building permits, 311 cases and road closures for any
   Metro Vancouver address. Free, no account, every number explained.*
3. The search box. Above the fold. Nothing between the sub and the box.
4. Three example addresses that produce genuinely interesting reports — one great, one
   mediocre, one with real problems. Do not cherry-pick only good ones; the product's
   value is that it tells you bad news.
5. *"Where does this come from?"* — the coverage matrix, honestly.
6. *"Why we don't score crime or schools."* — a short, principled paragraph. This is the
   trust differentiator and it should be visible, not buried.
7. Footer: attribution, licences, `/legal`.

---

## 6. Go-to-market: the first 5–10 paying clients

The blueprint's growth section is good for *users* and silent on *clients*. Those are
different motions. Below is the client motion.

### What you need before you send a single email

1. **Six weeks of continuous archive.** Non-negotiable. It is the only thing you're
   selling that they can't get themselves.
2. **The Late Index, live and public.** The artifact *is* the pitch.
3. **One written case.** Pick the single most counterintuitive finding in your data —
   ideally a stop with high ridership and terrible reliability — and write 800 words on it.
4. **A one-page capability sheet.** What you have, how far back, at what granularity, and
   under what licence terms.

### The named first-ten list

**Consultancies (highest willingness to pay, fastest close).** Stantec, WSP, Arcadis/IBI,
Urban Systems, Bunt & Associates, Watt Consulting — all have Vancouver transportation
practices, all bill clients for exactly this analysis, all currently do it by hand or not
at all.
> *"I've been archiving TransLink's GTFS-RT feed since [date] — per-stop, per-route,
> per-time-of-day on-time performance for the whole region. Nobody else in BC has this;
> TransLink's feed doesn't keep history. If you're scoping anything that needs measured
> reliability rather than scheduled, I'll run the query for free once so you can see the
> shape of it."*

**Municipal planning.** City of Vancouver Transportation Planning, New Westminster,
Burnaby, Surrey. Slower, larger, and they need a vendor number. Lead with the free index
and offer a no-cost briefing. One of these becomes a $15–30k engagement in year one.

**TransLink itself.** Genuinely a prospect, not just a licensing risk. They have the feed
and no archive of it. Approach the open-data contact first, on terms, and let the
capability become apparent. Do not lead with a sales pitch to the organization whose ToU
you need.

**Academic.** UBC SCARP, UBC REACT Lab, SFU City Program. Free API keys, permanently, no
negotiation. They will use it, publish with it, and cite it — and academic citations are
the highest-quality backlinks and the strongest credibility signal you can get for the
commercial conversations above.

**BIAs and developers.** Downtown Vancouver BIA, Mount Pleasant BIA, Robson Street BIA.
They commission neighbourhood studies and have discretionary budget in the $5–15k range.
Offer a free one-page reliability profile for their catchment; sell the full study.

**Media (free, and the engine for all of the above).** Daily Hive, Vancouver Is Awesome,
CityNews 1130, The Tyee, Vancouver Sun, CBC BC. Pitch the index, not the company. A local
data story that costs them nothing to run and settles an argument their readers have been
having for years is close to an auto-yes.

### Lead magnets

- The Late Index itself — free, permanent, no email gate. Gating it would be the single
  worst decision available.
- "Metro Vancouver's 20 Least Reliable Bus Stops" — an annual PDF. Press bait that
  doubles as a capability demo.
- A free per-neighbourhood reliability one-pager for any BIA or community association
  that asks.
- Free API keys for academics and journalists, forever.

### Low-cost channels

- **r/vancouver, r/SurreyBC, r/Burnaby, r/NewWest, r/vancouverhousing.** Spend a month
  answering "is this a good area?" with a real report link for *that specific address*,
  before you ever post a launch. Message the mods first — a ban on r/vancouver costs you
  the best channel in the region.
- **r/dataisbeautiful** for the reliability map. National reach, feeds back local.
- **Vancouver Civic Tech, Open Data Day, VanHacks, BC Dev Exchange.** Demo it; don't sell.
- **Neighbourhood SEO pages** from archive aggregates. Compounds while you sleep.
- **A daily "most-delayed stop yesterday" post** on a local Bluesky/X account. Low effort,
  occasionally goes local-viral, and it makes the archive visible as a living thing.

### Partnerships worth pursuing

- **liv.rent** (Vancouver-based rental platform) — an embedded reliability score per
  listing is a real differentiator for them and a distribution channel for you.
- **Tenant advocacy groups (TRAC, VTU).** Give them the rental-standards data free,
  permanently. Goodwill and credibility in a space where both are scarce, and they talk
  to journalists constantly.
- **Small-landlord associations.** Same data, different framing.

---

## 7. Prioritized 30-day action plan

### Week 1 — unblock, and start the clock on the moat

The archive is the only thing here where delay is *permanently* destructive. Everything
in this week exists to get it running safely.

1. **Email TransLink open data about commercial terms.** Day 1, ten minutes, gates
   everything downstream. (§5, Phase 0)
2. **Fix the archive before enabling the cron** — unique constraint, `upsert`, archive
   only the next unserved stop per trip, retention/rollup plan. *(issue #2)*
3. **Enable RLS on `delay_observations`.** *(issue #3)*
4. **Turn the snapshotter on.** Every day from here is archive you own.
5. **Merge the feature branch to `main`; make `main` the deploy source.** *(issue #1)*
6. **Add `ci.yml` and `verify-sources.yml`.** *(issue #8)*
7. **Build and host the real stop index; automate it weekly.** *(issue #5)*
8. **`npm uninstall` the ten unused packages.** Clears the audit in one command.
   *(issue #12)*

### Week 2 — make the product exist for a stranger

9. **Rate-limit `/api/og` and `/report/<slug>`.** *(issue #4)*
10. **Fix the inverted transit-access score** + regression test. *(issue #6)*
11. **Replace the pitch deck with the product.** `/` is the search box; deck moves to
    `/about` or dies. *(issue #9)*
12. **Rewrite `index.html`.** `lang="en-CA"`, OG/description/favicon/canonical, strip both
    sandbox scripts and the unused CDN stylesheet. *(issue #10)*
13. **Render raw civic records** under the count tiles. *(issue #15)*
14. **PNG og:images.** *(issue #7)*
15. **Add `/legal`.** *(issue #24)*

### Week 3 — make the data honest and the coverage wider

16. **Date/status filters on the civic queries** so "recent" and "open" are true.
    *(issue #11)*
17. **Harden `verify:sources`** to assert field names, then actually run it against
    Surrey and Burnaby and fix what it finds. *(issue #18)*
18. **Add Richmond and New Westminster** — one config entry and one registry row each.
    Three municipalities becomes five in an afternoon.
19. **Coverage transparency page**, generated from `LOCALITY_REGISTRY`.
20. **Ship the map.** *(§4, item 4)*
21. **Generate neighbourhood SEO pages.** They need two months to compound — start now.

### Week 4 — first revenue motion

22. **Publish The Late Index v0** from three weeks of archive. Partial is fine; label the
    window honestly.
23. **Pitch four outlets** — Daily Hive, Vancouver Is Awesome, The Tyee, CityNews.
24. **Send ten named outreach emails** to the consultancies and BIAs in §6, offering a
    free first query.
25. **Free API keys to UBC SCARP, UBC REACT, SFU City Program.**
26. **Start the r/vancouver month** — answer address questions with real report links, no
    launch post, mods messaged first.

### Explicitly *not* in the 30 days

Accounts, auth, Stripe, commute watch, email digests, the realtor tier, PDF export. None
of them can be sold before the archive has history and the ToU answer is in hand, and
each one is a week you're not spending on the thing that compounds.

---

## 8. Mission alignment

**The mission, as I read it:** *Close the information gap between the person signing the
lease and the person holding the pen — using only public data, with every number
interrogable.*

The codebase largely honours this, deliberately and in ways that cost effort:

- The score **drops an unavailable component's weight** instead of scoring it zero, and
  withholds the number entirely below 50% coverage (`score.ts:153`). A score that quietly
  lies when a feed is down is worse than no product, and the code knows it.
- Every component carries **the sentence that explains it**. No black box.
- A locality with no adapter produces a **skip with a stated reason**, never a silent
  empty list that reads as "nothing is happening here" (`pulse.ts:166-171`).
- **Crime and school rankings are deliberately out of scope.** Correct, and for the right
  reasons — mapping crime data next to addresses people are deciding whether to live at
  carries real ethical weight, and school-catchment scoring is an argument you cannot win.
- **Attribution lives next to the endpoint in config**, so adding a source forces you to
  fill it in. That's mission encoded as a type constraint.

### Where making money conflicts with the mission

**Lead referral is the sharpest conflict, and I'd cut it.** The moment a mover, an
insurer or an ISP pays for placement on a report about where someone should live, every
number on that page is suspect — including the ones you didn't touch. The revenue is low
(§5, option 5) and the cost is the only asset you actually have. If you keep it: no
revenue share that varies by score, disclosed inline and not in a footer, and never on a
report where the score is withheld.

**The realtor white-label is structurally adversarial and you should decide the rules
now.** The person paying is the listing agent; the person reading is the buyer or renter;
the agent's interest is that the block looks good. The first time an agent asks you to
suppress eleven outstanding bylaw violations, you will either have a policy or you will
have a negotiation. Write the policy first: an agent may add their branding and contact
details and may not alter, reorder or suppress any component; every branded report carries
"Commissioned by [agent]" above the fold; the underlying public report at
`/report/<slug>` is always reachable and always unbranded. If that makes the product
unsellable to agents, that is useful information about the product, not about the policy.

**Gating the reliability index would be the mission-breaking version of the top pick.**
Selling API access to derived statistics is fine. Putting the public index behind an email
wall is not — it is a regional public good built from a public feed, and its being free is
what makes the paid tier credible. Charge for volume, freshness, history depth and
support. Never for access to the truth.

**A third, quieter conflict: the score itself.** A number attached to an address is a
claim about a place real people live, and it will eventually be used in ways you didn't
intend — in a rent negotiation, in a listing, against a tenant. The existing mitigations
(explainability, raw records, withholding below coverage) are the right ones; issue #15
means the "raw records one click away" half of that promise is currently unkept. Fix it
before the report gets popular, not after.

### Where the mission could be sharpened

"Know the block before you sign" is a good tagline and a slightly passive mission. The
sharper version is adversarial in the right direction: **you are building the thing the
listing leaves out.** That framing does three useful things — it names an opponent
(incomplete listings, not renters or realtors), it explains why crime and schools are
excluded (they aren't *omitted* from listings; they're contested), and it makes the free
public index obviously part of the mission rather than a marketing expense.

Stated that way, the recommendations in §5 line up cleanly: the free consumer report and
the free Late Index *are* the mission; the paid data, API and audits are sold to
institutions who are not the people the information asymmetry is being used against. The
two options I've argued against — lead referral and unpoliced white-labelling — are
precisely the two that invert that relationship.
