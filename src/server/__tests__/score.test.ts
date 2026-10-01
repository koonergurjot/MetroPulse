import { describe, expect, it } from 'vitest';
import { computePulseScore, MIN_COVERAGE, type ScoreInputs } from '../score.ts';
import type { CivicRecord, TransitSnapshot } from '../types.ts';

const transit = (overrides: Partial<TransitSnapshot> = {}): TransitSnapshot => ({
  stops: [{ stopId: 'S1', code: '1', name: 'Stop', lat: 49.28, lng: -123.12, distanceM: 150 }],
  departures: [],
  medianDelaySec: 0,
  lateShare: 0,
  alerts: [],
  feedTimestamp: null,
  ...overrides,
});

const record = (distanceM: number): CivicRecord => ({
  id: `r${distanceM}`,
  kind: 'permit',
  title: 'Permit',
  detail: null,
  date: null,
  distanceM,
  lat: 49.28,
  lng: -123.12,
});

const inputs = (overrides: Partial<ScoreInputs> = {}): ScoreInputs => ({
  transit: transit(),
  serviceRequests: [],
  permits: [],
  rentalIssues: [],
  roadEvents: [],
  availability: { civic: true, roads: true, permits: true, rental: true },
  ...overrides,
});

describe('computePulseScore', () => {
  it('scores a quiet, well-served address near the top', () => {
    const score = computePulseScore(inputs());
    expect(score.value).toBeGreaterThan(85);
    expect(score.coverage).toBe(1);
  });

  it('penalises chronic lateness', () => {
    const onTime = computePulseScore(inputs()).value ?? 0;
    const late = computePulseScore(
      inputs({ transit: transit({ medianDelaySec: 600, lateShare: 0.6 }) }),
    ).value ?? 0;
    expect(late).toBeLessThan(onTime - 20);
  });

  it('does not reward buses that run early', () => {
    const onTime = computePulseScore(inputs()).value;
    const early = computePulseScore(inputs({ transit: transit({ medianDelaySec: -240 }) })).value;
    expect(early).toBe(onTime);
  });

  it('weights construction within 200 m more heavily than further out', () => {
    const close = computePulseScore(inputs({ permits: [record(50), record(80)] })).value ?? 0;
    const far = computePulseScore(inputs({ permits: [record(700), record(750)] })).value ?? 0;
    expect(close).toBeLessThan(far);
  });

  it('drops the weight of an unavailable source instead of scoring it zero', () => {
    const full = computePulseScore(inputs());
    const partial = computePulseScore(
      inputs({ availability: { civic: true, roads: true, permits: false, rental: true } }),
    );
    expect(partial.coverage).toBeLessThan(1);
    // Losing a source we would have scored well on must not tank the composite.
    expect(Math.abs((partial.value ?? 0) - (full.value ?? 0))).toBeLessThan(10);
  });

  it('withholds the number when coverage is too thin', () => {
    const score = computePulseScore(
      inputs({ transit: null, availability: { civic: false, roads: true, permits: false, rental: true } }),
    );
    expect(score.value).toBeNull();
    expect(score.coverage).toBeLessThan(MIN_COVERAGE);
    expect(score.components.every((c) => typeof c.reason === 'string' && c.reason.length > 0)).toBe(true);
  });

  it('keeps every component explainable, available or not', () => {
    const score = computePulseScore(inputs({ transit: null }));
    for (const component of score.components) {
      expect(component.reason).not.toBe('');
      expect(component.score).toBeGreaterThanOrEqual(0);
      expect(component.score).toBeLessThanOrEqual(100);
    }
  });

  it('rewards additional equally close stops', () => {
    const one = transit();
    const six = transit({ stops: Array.from({ length: 6 }, (_, i) => ({ ...one.stops[0], stopId: String(i) })) });
    const access = (t: TransitSnapshot) => computePulseScore(inputs({ transit: t })).components.find(c => c.key === 'transit_access')!.score;
    expect(access(six)).toBeGreaterThan(access(one));
  });

  it('withholds a civic-only score at exactly half coverage', () => {
    const score = computePulseScore(inputs({ transit: null }));
    expect(score.coverage).toBeCloseTo(0.5);
    expect(score.value).toBeNull();
  });

  it('excludes disruption when road data is unavailable', () => {
    const score = computePulseScore(inputs({ availability: { civic: true, roads: false, permits: true, rental: true } }));
    expect(score.components.find(c => c.key === 'quietness')!.available).toBe(false);
    expect(score.coverage).toBeCloseTo(0.8);
  });

  it('is deterministic', () => {
    const a = computePulseScore(inputs({ serviceRequests: [record(10), record(20)] }));
    const b = computePulseScore(inputs({ serviceRequests: [record(10), record(20)] }));
    expect(a).toEqual(b);
  });
});
