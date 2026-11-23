# Contributing to MetroPulse

Thanks for wanting to help. MetroPulse tells people what is going on around an
address before they sign a lease, using only public data. Every number has to
be explainable, and a missing source has to look missing rather than reassuring.
Contributions that make the data more complete, more correct, or easier to
inspect are the most valuable ones.

## Quick start

You need **Node 22.6+** (the TypeScript scripts run with
`--experimental-strip-types`).

```bash
git clone https://github.com/koonergurjot/MetroPulse.git
cd MetroPulse
npm ci
npm test          # unit tests (no network, no API keys needed)
npm run typecheck
npm run build
```

Tests use fixtures and never touch the network, so you can contribute without a
TransLink key. To run the app against live data, copy `.env.example`, get a free
key from <https://developer.translink.ca>, and follow
[Try it locally](README.md#-try-it-locally).

## Where to start

Good first contributions, roughly easiest first:

| Idea | Where | Notes |
| --- | --- | --- |
| Add a municipality (Richmond, New Westminster, Coquitlam…) | [`docs/ADDING_A_MUNICIPALITY.md`](docs/ADDING_A_MUNICIPALITY.md) | One adapter plus one registry entry. Most portals reuse the Opendatasoft or ArcGIS helpers already in the repo. |
| Add tests for the Vancouver adapter | `src/server/sources/vancouver.ts` | The geocoder, DriveBC and `runSource` have fixture tests now; Vancouver's three datasets do not. Use `drivebc.test.ts` as a template. |
| Add a field-level check to `verify:sources` | `scripts/verify-sources.ts` | Today it only checks reachability. Assert that the fields the adapters read still exist. |
| Add status and date filters to permit and 311 queries | `src/server/sources/vancouver.ts`, `arcgis.ts` | The score talks about "recent" permits and "open" requests; the queries do not filter yet. |
| Map municipality for coordinate-only queries | `src/server/pulse.ts` | Coordinates currently skip civic categories because there is no reverse lookup. |
| Show the raw records on the map | `src/map/`, `src/components/` | Part of the "inspect, don't trust" promise. |
| Implement a licensed `ListingProvider` | `src/server/listings/types.ts` | Listings are demo data. See the licensing note in the README before writing one. |

Check the open issues for anything labelled `good first issue`. If you want to
take something larger, open an issue first so we can agree on the approach.

## What a good change looks like

- **Small and focused.** One concern per pull request.
- **Tested.** Add or update a test in `src/server/__tests__/`. Bug fixes should
  include a test that fails without the fix.
- **Honest about missing data.** A failed or unsupported source must produce an
  `unavailable` or `skipped` result with a reason, never an empty array that
  reads as "nothing here".
- **Explainable.** Anything that changes the Pulse Score must keep each
  component's plain-language reason accurate.
- **Portable.** The server code is framework-free and uses web-standard
  `fetch`, so it runs on Cloudflare Workers, Vercel, Netlify and Node. Avoid
  Node-only APIs in `src/server/` (scripts and tests may use them).

Before you push, run:

```bash
npm test && npm run typecheck && npm run build
```

CI runs the same three commands on every pull request.

## Data and licensing rules

These are not negotiable, because they protect the project and its users:

1. **Do not scrape listing sites** or add data copied from them. Real listings
   must come through a licensed feed implementing `ListingProvider`.
2. **Keep attribution.** Every source carries `attribution` and `licence` in
   its `SourceMeta`. New sources must set both and respect the provider's
   terms.
3. **Never commit secrets.** API keys come from environment variables. The
   Supabase service key must never reach frontend code.
4. **No tracking or personal data.** Addresses people search are not logged or
   stored beyond short-lived caches.

## Pull request checklist

The pull request template walks through this, but in short: tests pass, the
change is explained, new sources are attributed, and any user-visible change
includes a screenshot.

## Reporting bugs and security issues

Use the issue templates for bugs and feature ideas. For security problems,
follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of Conduct

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licence

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
