/**
 * The Pulse Score.
 *
 * Design rules, in priority order:
 *  1. Every component carries the sentence that explains it. A score a user
 *     cannot interrogate is a score they will not trust or share.
 *  2. A missing source removes its weight rather than scoring zero, and the
 *     response reports the resulting coverage. Silently scoring a dead feed as
 *     "bad" is how these products lose credibility.
 *  3. Pure and deterministic: same inputs, same number, so it is testable and
 *     so two users at the same address never see different answers.
 */
import type { CivicRecord, PulseScore, ScoreComponent, TransitSnapshot } from './types.ts';

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

/** Maps a value to 0-100 where `best` scores 100 and `worst` scores 0. */
const ramp = (value: number, best: number, worst: number): number => {
  if (worst === best) return value <= best ? 100 : 0;
  return clamp(100 * (1 - (value - best) / (worst - best)));
};

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

function transitReliability(transit: TransitSnapshot | null): ScoreComponent {
  const base = { key: 'transit_reliability', label: 'Transit reliability', weight: 0.35 };
  if (!transit || transit.medianDelaySec === null || transit.lateShare === null) {
    return { ...base, score: 0, available: false, reason: 'No live predictions for nearby stops right now.' };
  }
  const minutes = transit.medianDelaySec / 60;
  // 0 min late scores 100; 12 min late scores 0. Early buses are not a bonus.
  const delayScore = ramp(Math.max(0, minutes), 0, 12);
  const consistencyScore = ramp(transit.lateShare, 0, 0.5);
  const score = Math.round(0.6 * delayScore + 0.4 * consistencyScore);
  const latePct = Math.round(transit.lateShare * 100);
  return {
    ...base,
    score,
    available: true,
    reason:
      minutes < 1
        ? `Nearby service is running on time; ${latePct}% of upcoming departures are more than 5 minutes late.`
        : `Nearby service is running about ${minutes.toFixed(0)} ${plural(Math.round(minutes), 'minute', 'minutes')} late, with ${latePct}% of departures more than 5 minutes behind.`,
  };
}

function transitAccess(transit: TransitSnapshot | null): ScoreComponent {
  const base = { key: 'transit_access', label: 'Transit access', weight: 0.15 };
  if (!transit) {
    return { ...base, score: 0, available: false, reason: 'Stop data unavailable.' };
  }
  const stops = transit.stops;
  if (stops.length === 0) {
    return { ...base, score: 0, available: true, reason: 'No transit stops within the search radius.' };
  }
  // Walking distance to the closest stop dominates; a second stop is a bonus.
  const nearest = stops[0].distanceM;
  const proximity = ramp(nearest, 150, 900);
  const choice = ramp(stops.length, 6, 1);
  const score = Math.round(clamp(0.75 * proximity + 0.25 * (100 - choice)));
  return {
    ...base,
    score,
    available: true,
    reason: `${stops.length} ${plural(stops.length, 'stop', 'stops')} nearby; the closest is about ${nearest} m away.`,
  };
}

function quietness(serviceRequests: CivicRecord[], roadEvents: CivicRecord[], available: boolean): ScoreComponent {
  const base = { key: 'quietness', label: 'Street-level disruption', weight: 0.2 };
  if (!available) {
    return { ...base, score: 0, available: false, reason: 'Municipal service-request data unavailable.' };
  }
  const closures = roadEvents.filter((e) => e.kind.includes('construction') || e.kind.includes('closure'));
  const signals = serviceRequests.length + closures.length * 2;
  const score = Math.round(ramp(signals, 0, 25));
  return {
    ...base,
    score,
    available: true,
    reason:
      signals === 0
        ? 'No open service requests or road closures within the radius.'
        : `${serviceRequests.length} open service ${plural(serviceRequests.length, 'request', 'requests')} and ${closures.length} road ${plural(closures.length, 'closure', 'closures')} nearby.`,
  };
}

function constructionPressure(permits: CivicRecord[], available: boolean): ScoreComponent {
  const base = { key: 'construction', label: 'Construction pressure', weight: 0.2 };
  if (!available) {
    return { ...base, score: 0, available: false, reason: 'Building permit data unavailable for this municipality.' };
  }
  // Permits within 200 m are the ones you hear; weight them heavily.
  const closeRange = permits.filter((p) => p.distanceM <= 200).length;
  const score = Math.round(ramp(closeRange * 3 + permits.length, 0, 30));
  return {
    ...base,
    score,
    available: true,
    reason:
      permits.length === 0
        ? 'No recently issued building permits within the radius.'
        : `${permits.length} recent ${plural(permits.length, 'permit', 'permits')} nearby, ${closeRange} of them within 200 m.`,
  };
}

function buildingCare(rentalIssues: CivicRecord[], available: boolean): ScoreComponent {
  const base = { key: 'building_care', label: 'Rental building standards', weight: 0.1 };
  if (!available) {
    return { ...base, score: 0, available: false, reason: 'Rental standards data is only published by some municipalities.' };
  }
  const score = Math.round(ramp(rentalIssues.length, 0, 8));
  return {
    ...base,
    score,
    available: true,
    reason:
      rentalIssues.length === 0
        ? 'No rental buildings with outstanding bylaw issues nearby.'
        : `${rentalIssues.length} nearby rental ${plural(rentalIssues.length, 'building has', 'buildings have')} outstanding bylaw issues.`,
  };
}

export interface ScoreInputs {
  transit: TransitSnapshot | null;
  serviceRequests: CivicRecord[];
  permits: CivicRecord[];
  rentalIssues: CivicRecord[];
  roadEvents: CivicRecord[];
  availability: {
    civic: boolean;
    permits: boolean;
    rental: boolean;
  };
}

/** Below this share of available weight, we show components but withhold the number. */
export const MIN_COVERAGE = 0.5;

export function computePulseScore(inputs: ScoreInputs): PulseScore {
  const components: ScoreComponent[] = [
    transitReliability(inputs.transit),
    transitAccess(inputs.transit),
    quietness(inputs.serviceRequests, inputs.roadEvents, inputs.availability.civic),
    constructionPressure(inputs.permits, inputs.availability.permits),
    buildingCare(inputs.rentalIssues, inputs.availability.rental),
  ];

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const availableWeight = components.reduce((sum, c) => (c.available ? sum + c.weight : sum), 0);
  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;

  if (availableWeight === 0 || coverage < MIN_COVERAGE) {
    return { value: null, components, coverage };
  }

  const weighted = components.reduce((sum, c) => (c.available ? sum + c.score * c.weight : sum), 0);
  return { value: Math.round(weighted / availableWeight), components, coverage };
}
