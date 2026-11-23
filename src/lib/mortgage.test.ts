import { describe, expect, it } from 'vitest';
import { computeCost, insurancePremiumRate, minDownPayment, monthlyPayment, stressRate } from './mortgage.ts';

describe('monthlyPayment', () => {
  it('matches the published Canadian figure for $500k @ 5% / 25y (≈ $2,908)', () => {
    expect(monthlyPayment(500_000, 5, 25)).toBeCloseTo(2907.9, 0);
  });
  it('is zero for no principal and handles a 0% rate', () => {
    expect(monthlyPayment(0, 5, 25)).toBe(0);
    expect(monthlyPayment(120_000, 0, 10)).toBeCloseTo(1000, 6);
  });
});

describe('down payment and insurance rules', () => {
  it('computes the tiered minimum down payment', () => {
    expect(minDownPayment(400_000)).toBe(20_000);
    expect(minDownPayment(1_000_000)).toBe(75_000);
    expect(minDownPayment(1_500_000)).toBe(300_000);
    expect(minDownPayment(2_000_000)).toBe(400_000);
  });
  it('picks the premium tier by LTV', () => {
    expect(insurancePremiumRate(0.8)).toBe(0);
    expect(insurancePremiumRate(0.84)).toBe(0.028);
    expect(insurancePremiumRate(0.9)).toBe(0.031);
    expect(insurancePremiumRate(0.95)).toBe(0.04);
  });
  it('stress-tests at the greater of +2% and 5.25%', () => {
    expect(stressRate(4)).toBe(6);
    expect(stressRate(3)).toBe(5.25);
  });
});

describe('computeCost', () => {
  const base = { ratePct: 4.5, amortYears: 25, propertyTaxPct: 0.003, monthlyFees: 400, monthlyHeat: 100 };

  it('adds the premium to the loan for a 10%-down purchase', () => {
    const c = computeCost({ ...base, price: 800_000, downPaymentPct: 10 });
    expect(c.downPayment).toBe(80_000);
    expect(c.premium).toBeCloseTo(720_000 * 0.031, 2);
    expect(c.loan).toBeCloseTo(720_000 * 1.031, 2);
    expect(c.meetsMinDown).toBe(true);
    expect(c.total).toBeCloseTo(c.mortgage + c.tax + 400, 6);
    expect(c.stressRatePct).toBe(6.5);
    expect(c.incomeNeeded).toBeGreaterThan(c.total * 12 / 0.39 * 0.8);
  });

  it('charges no premium at 20% down and flags a too-small down payment', () => {
    expect(computeCost({ ...base, price: 800_000, downPaymentPct: 20 }).premium).toBe(0);
    expect(computeCost({ ...base, price: 800_000, downPaymentPct: 5 }).meetsMinDown).toBe(false);
  });

  it('never insures a purchase at or above $1.5M', () => {
    const c = computeCost({ ...base, price: 1_800_000, downPaymentPct: 20 });
    expect(c.premium).toBe(0);
    expect(computeCost({ ...base, price: 1_800_000, downPaymentPct: 10 }).meetsMinDown).toBe(false);
  });
});
