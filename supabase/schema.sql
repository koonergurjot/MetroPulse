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
