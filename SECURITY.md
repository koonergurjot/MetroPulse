# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Use GitHub's private reporting: open the repository's **Security** tab and choose
**Report a vulnerability**. If that option is not available, contact the
maintainer through their GitHub profile (<https://github.com/koonergurjot>) and
ask for a private channel before sharing details.

Please include what you found, how to reproduce it, and the impact you expect.
You can expect an acknowledgement within a few days. This is a volunteer
project, so fix times vary with severity.

## Scope

In scope:

- The API handlers in `src/server/` and the Worker entry point (`src/worker.ts`).
- Handling of API keys and other secrets (TransLink, BC Geocoder, Supabase).
- Rate limiting and abuse of the shared upstream budget.
- The transit-delay archive schema in `supabase/schema.sql`.
- The web app in `src/`.

Out of scope: vulnerabilities in the upstream data providers themselves, and
findings that need a compromised maintainer account or machine.

## Things worth knowing when you deploy

- **Supabase service key.** `SUPABASE_SERVICE_KEY` bypasses row level security.
  Use it only in the snapshot job (GitHub Actions secret) and never in frontend
  code or a public environment variable.
- **Row level security.** `supabase/schema.sql` enables RLS on
  `delay_observations` with no policies, so only the service key can read or
  write it. Add an explicit `select` policy only if you intend to publish the
  archive.
- **API keys in URLs.** TransLink requires its key as a query parameter. The
  fetch layer refuses to follow redirects for those requests so the key cannot
  be forwarded to another host. Do not log full upstream URLs.
- **Rate limiting is best effort.** The limiter is per-isolate on Workers. Put a
  platform-level rate limit in front of a production deployment.

## Supported versions

Only the `main` branch is supported.
