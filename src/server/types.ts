/**
 * Shared types for the MetroPulse data engine.
 *
 * Every upstream source is wrapped in a `SourceResult` so a single flaky
 * endpoint degrades one card in the UI instead of failing the whole request.
 */

export type SourceStatus = 'ok' | 'stale' | 'error' | 'skipped';

export interface SourceMeta {
  /** Stable id used as the key in the merged response, e.g. `translink.trip_updates`. */
  id: string;
  /** Human label shown in the UI when a source is degraded. */
  label: string;
  /** Attribution string. Most BC open data licences require this be displayed. */
  attribution: string;
  /** Licence identifier, for the /legal page and for audit. */
  licence: string;
}

export interface SourceResult<T> {
  meta: SourceMeta;
  status: SourceStatus;
  /** Null whenever status is `error` or `skipped`. */
  data: T | null;
  /** When the upstream response we served was actually fetched. */
  fetchedAt: string;
  /** Age of the served payload in ms. 0 for a fresh fetch. */
  ageMs: number;
  /** Populated for `error`; safe to show to end users (no URLs, no keys). */
  error?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ResolvedLocation extends LatLng {
  /** Fully qualified address from the BC Address Geocoder, when available. */
  address: string | null;
  /** Municipality, used to pick the municipal adapter (Vancouver, Surrey, ...). */
  locality: string | null;
  /** Geocoder confidence 0-100. Below ~70 we warn the user in the UI. */
  confidence: number | null;
  source: 'geocoder' | 'coordinates';
}

export interface NearbyStop extends LatLng {
  stopId: string;
  code: string | null;
  name: string;
  distanceM: number;
}

export interface StopDeparture {
  stopId: string;
  stopName: string;
  distanceM: number;
  routeId: string | null;
  tripId: string | null;
  /** Seconds late. Negative means early. Null when the feed gives no prediction. */
  delaySec: number | null;
  /** Predicted departure, ISO-8601. */
  predictedAt: string | null;
}

export interface TransitSnapshot {
  stops: NearbyStop[];
  departures: StopDeparture[];
  /** Median delay across nearby departures, in seconds. Null when no data. */
  medianDelaySec: number | null;
  /** Share of nearby departures running more than 5 minutes late, 0-1. */
  lateShare: number | null;
  alerts: ServiceAlert[];
  feedTimestamp: string | null;
}

export interface ServiceAlert {
  id: string;
  header: string;
  description: string | null;
  routeIds: string[];
  stopIds: string[];
  url: string | null;
}

/** A point-shaped civic record: a 311 case, a permit, a road closure, a park. */
export interface CivicRecord extends LatLng {
  id: string;
  kind: string;
  title: string;
  detail: string | null;
  /** ISO-8601 date the record was opened/issued, when the dataset provides one. */
  date: string | null;
  distanceM: number;
  /** Free-form extras kept for the detail drawer; never used for scoring. */
  extra?: Record<string, unknown>;
}

export interface ScoreComponent {
  key: string;
  label: string;
  /** 0-100. */
  score: number;
  /** Relative weight within the composite. */
  weight: number;
  /** One sentence the UI shows verbatim, so the score is never a black box. */
  reason: string;
  /** False when the underlying source failed; the component is then excluded. */
  available: boolean;
}

export interface PulseScore {
  /** 0-100 composite, or null when too few components were available. */
  value: number | null;
  components: ScoreComponent[];
  /** Fraction of total weight that was actually available, 0-1. */
  coverage: number;
}

export interface PulseResponse {
  location: ResolvedLocation;
  radiusM: number;
  score: PulseScore;
  transit: TransitSnapshot | null;
  civic: {
    serviceRequests: CivicRecord[];
    permits: CivicRecord[];
    rentalIssues: CivicRecord[];
    roadEvents: CivicRecord[];
  };
  sources: Array<Omit<SourceResult<unknown>, 'data'>>;
  generatedAt: string;
  /** Wall-clock ms spent building this response. */
  tookMs: number;
}
