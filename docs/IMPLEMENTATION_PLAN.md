# MetroPulse implementation plan

Goal: help renters and buyers investigate an address before signing, with evidence they can inspect and clear limits on what is known.

## First pass implemented

- Make address search the default view and distinguish report navigation from the project overview.
- Correct the inverted transit-choice score; require more than half coverage before publishing the composite.
- Exclude the disruption component if either civic requests or road events are unavailable.
- Stop calling unfiltered civic records “open” or “recent” in score explanations.
- Replace civic count tiles with expandable records showing titles, details, dates, distances, identifiers, and coordinates. Unavailable sources do not display zero.
- Use Node 22 for the archive workflow and fail scheduled collection when durable storage is absent.
- Add automated tests, typecheck, and build checks for pull requests and pushes.
- Set the HTML language to Canadian English and remove unused sandbox scripts and external icon CSS.
- Refresh the GitHub README with expandable exploration, coverage, setup, and the remaining roadmap.

## Second pass implemented

- Reject missing/non-array civic collections, non-object records, and provider error objects instead of treating them as empty results. ODS, ArcGIS, and DriveBC use the same response-boundary check; genuine empty collections remain valid.
- Bound stale-if-error fallback by the source policy, including elapsed time during failed refreshes. Expired evidence now becomes unavailable through the source boundary.
- Add regression coverage for malformed HTTP-200 responses, genuine empty results, source error reporting, and expired cache entries.

Field-level mappings, geometry completeness, status/date filters, provider totals, and live contract checks remain pending. This pass validates collection structure, not every record field.

## 1. Verify the evidence before launch

Implement adapter-specific response validation. Treat unexpected schemas and ArcGIS error objects as source failures rather than empty results. Add confirmed date/status filters and preserve provider totals, truncation, and pagination metadata in the report contract. Verify Surrey and Burnaby with locations inside their boundaries. Bound stale-if-error by source age; expired evidence must not contribute to scores.

Acceptance: recorded provider fixtures demonstrate correct mappings; closed requests and out-of-window permits are excluded; malformed responses cannot produce “no issues”; partial counts are labeled; old evidence is excluded from scoring. A daily source check validates semantics as well as reachability.

## 2. Finish transit and coordinate coverage

Automate static GTFS download, stop-index generation, and hosting with atomic replacement and a last-updated marker. Reject empty or placeholder-only indexes in production. Add municipality resolution for coordinates, with confidence and boundary handling. Generate the public coverage matrix from the locality registry. Refresh the legacy presentation content to match the housing product.

Acceptance: real stop IDs match a live fixture; index failures visibly degrade transit; coordinate and address queries for the same point select the same municipality; unsupported categories remain explicit.

## 3. Make the archive useful and durable

Define two distinct concepts: archived predictions and derived journey outcomes. Preserve service date, trip start time, stop sequence, feed timestamp, and observation time where available. Choose an idempotency key that distinguishes service instances and repeated observations; add uniqueness and retry-safe writes. Add RLS/access policy migrations, retention, aggregation, collection-gap monitoring, and duplicate-feed detection. Keep raw predictions from being marketed as observed actual arrivals.

Acceptance: retrying one poll creates no duplicate observations; recurring trips across service days stay distinct; rollups carry sample counts, collection coverage, and explicit prediction semantics; missing storage fails loudly. Validate sampling frequency against the proposed reliability claims before moving beyond best-effort five-minute collection.

## 4. Make investigation visual

Add a filterable nearby activity map and synchronized record list. Confirm ambiguous geocoder matches before scoring; add accessible search suggestions, usable retry behavior, and browser navigation. Ensure score explanations, missing categories, and source age stay visible on mobile. Protect all report-building routes, including OG and report HTML, with consistent rate limiting and shared caching. Validate social preview cards on target platforms and use a supported image format.

Acceptance: a user can inspect the exact record behind a map pin, recover a failed search, distinguish missing from empty data, and navigate shared reports without losing context. Exercise address → report → inspect → share with browser tests and accessibility checks.

## 5. Add retention once history is reliable

Implement saved addresses and departure windows with authentication and RLS, then weekly commute summaries and civic-change notifications. Keep the public report usable without an account. Validate commercial source terms before paid APIs or realtor branding. Define branding rules that preserve adverse findings and link to the complete public report.

Acceptance: users only access their own saved data; digests disclose the observation window and sample size; branded reports preserve all components and source attribution.

## Validation and boundaries

First-pass automated checks cover backend scoring, TypeScript, and the frontend build. They do not prove live source availability, archive database permissions, browser behavior, or deployed Worker routing. No production deployment or database migration is part of this pass. The existing SQL schema remains a starting point pending the archive design above.
