# MetroPulse playbook: who it helps, how it earns, what is safe

## What exists today
- Map-first search of Metro Vancouver with **demo** listings, deal flags, 3D buildings, transit and planned SkyTrain.
- **Block report**: a Pulse Score from transit, permits, 311, rental issues and road events (each source degrades independently).
- **Consumer tools**: saved homes with private notes, side-by-side compare (up to 3), a monthly-cost estimate with the Canadian stress test, shareable URLs (filters, camera, selection).
- **Business tools**: portfolio check (up to 100 addresses to a scored CSV), embeddable report widget (`/embed/<slug>`), a market snapshot by municipality.

## Consumer value
| Need | Feature |
|---|---|
| "Can I afford this?" | Cost estimate: min down payment, insurance premium, stress-test rate, income needed |
| "Is it priced fairly?" | $/sqft vs comparable listings (not an appraisal) |
| "What's the block like?" | Block report with a visible reason for each score component |
| "Show my partner" | Shareable link, saved list with notes, compare view |

## Business value
| Who | Use | Feature |
|---|---|---|
| Landlords, property managers | Screen sites or buildings | Portfolio check + CSV |
| Retail / clinics / franchises | Site selection | Transit and street activity score per address |
| Brokerages, mortgage brokers | Add neighbourhood context to their own site | Embed widget |
| Investors | Spot pricing outliers | Deal flags + market snapshot |

## Data and legal guardrails (from research)
- **Do not scrape MLS/portal listings.** ToS and copyright risk. Real listings need a licence: CREA DDF through a brokerage partner, board IDX, or a vendor such as Repliers. Plug it in behind `ListingProvider`.
- BCFSA bars **paid per-lead referrals** to realtors by unlicensed sites. Do not sell leads to agents unless a licensed brokerage is the operator.
- The Mortgage Services Act takes effect Oct 13, 2026. Calculators here are estimates; do not take mortgage referral fees without checking the rules.
- Open Government Licence municipal data is commercially reusable. VPD GeoDASH crime, Fraser Institute rankings, BC Assessment bulk and MapTiler free tier are **not** cleared for commercial use.

## Monetization paths (in order of legal ease)
1. **Business subscriptions**: portfolio checks, higher API limits, white-label embeds.
2. **Data/API access** for the block-report score (OGL-based).
3. **Brokerage partnership**: a licensed brokerage supplies the feed and operates lead handling; revenue share is theirs to structure.
4. Display ads on report pages (low value, last resort).

## Next steps
1. Sign a brokerage partner and swap the demo provider for DDF/IDX.
2. Add accounts (server-side saved homes and alerts) when there is real inventory to alert on.
3. Add a TransLink API key for realtime departures in the transit score.
4. Rate-limit keys per customer before selling API access.
