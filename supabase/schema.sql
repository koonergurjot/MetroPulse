-- Delay observations archived from TransLink's GTFS-Realtime TripUpdates
-- feed by scripts/snapshot.ts. The upstream feed carries no history of its
-- own and is overwritten on every poll, so this table is the archive.

create table if not exists delay_observations (
  id bigint generated always as identity primary key,
  stop_id text not null,
  -- Nullable: GTFS-RT trip descriptors don't always carry a route_id.
  route_id text,
  trip_id text not null,
  scheduled_time timestamptz not null,
  predicted_time timestamptz not null,
  delay_sec integer not null,
  -- When this poll observed the prediction, not when the trip runs.
  observed_at timestamptz not null
);

-- Serves "delay history at this stop" queries, the primary read pattern for
-- a per-stop reliability view; observed_at as the second column keeps a
-- date-range scan within one stop's rows contiguous on disk.
create index if not exists delay_observations_stop_observed_idx
  on delay_observations (stop_id, observed_at);

-- Mirrors the above for "delay history on this route" queries.
create index if not exists delay_observations_route_observed_idx
  on delay_observations (route_id, observed_at);

-- The feed is forward-looking: one prediction is re-observed on many
-- consecutive polls. Keep the first observation of each (trip, stop,
-- predicted time) and drop repeats, so the archive grows with distinct
-- predictions instead of with poll count.
--
-- Existing deployments: collapse earlier duplicates (keeping the oldest row)
-- before the unique index can be built. A no-op on a fresh database.
delete from delay_observations a
  using delay_observations b
  where a.trip_id = b.trip_id
    and a.stop_id = b.stop_id
    and a.predicted_time = b.predicted_time
    and a.id > b.id;

create unique index if not exists delay_observations_dedup_idx
  on delay_observations (trip_id, stop_id, predicted_time);

-- Lock the table down. Supabase exposes the `public` schema through its REST
-- API to the `anon` and `authenticated` roles, so without row level security
-- anyone holding the publishable key could read, insert into or wipe the
-- archive. With RLS enabled and no policies, only the service-role key used by
-- scripts/snapshot.ts (which bypasses RLS) can touch it. Add an explicit
-- `select` policy later if you decide to publish the archive read-only.
alter table delay_observations enable row level security;
