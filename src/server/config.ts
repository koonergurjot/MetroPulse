/**
 * Endpoint registry.
 *
 * Every upstream base URL lives here and can be overridden by environment
 * variable, so a portal moving a dataset is a config change, not a deploy of
 * new code. Attribution and licence strings live next to the endpoint on
 * purpose: most BC open-data licences require visible attribution, and the
 * only way that stays true is if adding a source forces you to fill it in.
 *
 * VERIFY BEFORE LAUNCH: dataset ids and API paths are transcribed from each
 * portal's documentation and are not checked against the live services in CI.
 * Run `npm run verify:sources` from a machine with open internet access; it
 * prints a pass/fail table for every endpoint below.
 */

const env = (key: string, fallback: string): string => {
  const value = globalThis.process?.env?.[key];
  return value && value.length > 0 ? value : fallback;
};

export const optionalEnv = (key: string): string | null => {
  const value = globalThis.process?.env?.[key];
  return value && value.length > 0 ? value : null;
};

export const config = {
  /** BC Address Geocoder (DataBC). No key required; a key raises rate limits. */
  geocoder: {
    base: env('BC_GEOCODER_BASE', 'https://geocoder.api.gov.bc.ca'),
    apiKey: optionalEnv('BC_GEOCODER_API_KEY'),
    attribution: 'Contains information licensed under the Open Government Licence – British Columbia',
    licence: 'OGL-BC-2.0',
  },

  /** TransLink GTFS-Realtime. Free developer key from developer.translink.ca. */
  translink: {
    tripUpdates: env('TRANSLINK_TRIP_UPDATES_URL', 'https://gtfsapi.translink.ca/v3/gtfsrealtime'),
    alerts: env('TRANSLINK_ALERTS_URL', 'https://gtfsapi.translink.ca/v3/gtfsalerts'),
    vehiclePositions: env('TRANSLINK_POSITIONS_URL', 'https://gtfsapi.translink.ca/v3/gtfsposition'),
    staticGtfs: env('TRANSLINK_STATIC_GTFS_URL', 'https://gtfs-static.translink.ca/gtfs/google_transit.zip'),
    apiKey: optionalEnv('TRANSLINK_API_KEY'),
    attribution: 'Transit data provided by TransLink',
    licence: 'TransLink Open API Terms of Use',
  },

  /** City of Vancouver Open Data (Opendatasoft Explore API v2.1). */
  vancouver: {
    base: env('VANCOUVER_ODS_BASE', 'https://opendata.vancouver.ca/api/explore/v2.1'),
    datasets: {
      serviceRequests: env('VANCOUVER_311_DATASET', '3-1-1-service-requests'),
      buildingPermits: env('VANCOUVER_PERMITS_DATASET', 'issued-building-permits'),
      rentalStandards: env('VANCOUVER_RENTAL_DATASET', 'rental-standards-current-issues'),
      parks: env('VANCOUVER_PARKS_DATASET', 'parks'),
    },
    attribution: 'Contains information licensed under the Open Government Licence – Vancouver',
    licence: 'OGL-Vancouver',
  },

  /** City of Surrey Open Data (ArcGIS REST FeatureServer). */
  surrey: {
    base: env('SURREY_ARCGIS_BASE', 'https://cosmos.surrey.ca/arcgis/rest/services/OpenData/BuildingPermits/FeatureServer'),
    layers: {
      buildingPermits: env('SURREY_PERMITS_LAYER', '0'),
    },
    attribution: 'Contains information licensed under the City of Surrey Open Data Licence',
    licence: 'Surrey-ODC',
  },

  /** City of Burnaby Open Data (ArcGIS REST FeatureServer). */
  burnaby: {
    base: env('BURNABY_ARCGIS_BASE', 'https://gis.burnaby.ca/arcgis/rest/services/OpenData/BuildingPermits/FeatureServer'),
    layers: {
      buildingPermits: env('BURNABY_PERMITS_LAYER', '0'),
    },
    attribution: 'Contains information licensed under the City of Burnaby Open Data Licence',
    licence: 'Burnaby-ODC',
  },

  /** DriveBC Open511 road events. No key, no rate limit published. */
  drivebc: {
    base: env('DRIVEBC_OPEN511_BASE', 'https://api.open511.gov.bc.ca'),
    attribution: 'Road event data provided by DriveBC',
    licence: 'OGL-BC-2.0',
  },

  /** Where the baked stop index is served from at runtime. */
  stops: {
    path: env('STOP_INDEX_PATH', 'data/stops.sample.csv'),
  },

  /** Durable sink for the delay-observation snapshotter. Supabase when both are set. */
  supabase: {
    url: optionalEnv('SUPABASE_URL'),
    serviceKey: optionalEnv('SUPABASE_SERVICE_KEY'),
  },

  /** Fallback sink when Supabase isn't configured: newline-delimited JSON on disk. */
  snapshot: {
    outputDir: env('SNAPSHOT_OUTPUT_DIR', 'data/snapshots'),
  },

  /** Request-level knobs. */
  limits: {
    defaultRadiusM: Number(env('DEFAULT_RADIUS_M', '800')),
    maxRadiusM: Number(env('MAX_RADIUS_M', '2000')),
    maxRecordsPerSource: Number(env('MAX_RECORDS_PER_SOURCE', '40')),
    /** Budget for the whole fan-out. Sources that miss it are reported degraded. */
    fanoutBudgetMs: Number(env('FANOUT_BUDGET_MS', '6000')),
    /** Per-IP sliding window for `/api/pulse`. Set to 0 to disable rate limiting. */
    rateLimitWindowMs: Number(env('RATE_LIMIT_WINDOW_MS', '60000')),
    rateLimitMaxRequests: Number(env('RATE_LIMIT_MAX_REQUESTS', '30')),
  },
} as const;

export type AppConfig = typeof config;
