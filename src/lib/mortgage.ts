/**
 * Canadian mortgage maths for the affordability card.
 *
 * Estimates for orientation only. Rules below reflect the federal insured-
 * mortgage framework as understood in late 2025 and CHANGE: lenders decide.
 *  - Fixed-rate mortgages compound semi-annually (Interest Act).
 *  - Minimum down payment: 5% of the first $500k + 10% of the part up to $1.5M;
 *    20% at or above $1.5M.
 *  - Default-insurance (CMHC-style) premium on the loan: 4.00% (LTV 90.01-95%),
 *    3.10% (85.01-90%), 2.80% (80.01-85%), none at 80% or less. Added to the loan.
 *  - Stress test: qualify at the greater of contract rate + 2% and 5.25%.
 *  - Debt-service ceilings: GDS 39%.
 */

export const GDS_LIMIT = 0.39;
export const STRESS_FLOOR_PCT = 5.25;
export const INSURED_PRICE_CAP = 1_500_000;

/** Effective monthly rate for a nominal annual rate compounded semi-annually. */
export function monthlyRate(annualPct: number): number {
  const semi = annualPct / 100 / 2;
  return (1 + semi) ** (2 / 12) - 1;
}

/** Level monthly payment on `principal` over `years`. */
export function monthlyPayment(principal: number, annualPct: number, years: number): number {
  if (principal <= 0) return 0;
  const n = years * 12;
  const r = monthlyRate(annualPct);
  if (r === 0) return principal / n;
  return (principal * r) / (1 - (1 + r) ** -n);
}

export function minDownPayment(price: number): number {
  if (price >= INSURED_PRICE_CAP) return price * 0.2;
  if (price <= 500_000) return price * 0.05;
  return 500_000 * 0.05 + (price - 500_000) * 0.1;
}

/** Premium rate on the base loan for a given loan-to-value ratio (0-1). */
export function insurancePremiumRate(ltv: number): number {
  if (ltv <= 0.8) return 0;
  if (ltv <= 0.85) return 0.028;
  if (ltv <= 0.9) return 0.031;
  return 0.04;
}

export const stressRate = (contractPct: number): number => Math.max(contractPct + 2, STRESS_FLOOR_PCT);

export interface CostInputs {
  price: number;
  downPaymentPct: number;
  ratePct: number;
  amortYears: number;
  /** Annual property tax as a share of price (e.g. 0.003). */
  propertyTaxPct: number;
  /** Monthly strata/maintenance fees in dollars. */
  monthlyFees: number;
  /** Monthly heat/utilities allowance used for the GDS calculation. */
  monthlyHeat: number;
}

export interface CostBreakdown {
  downPayment: number;
  baseLoan: number;
  premium: number;
  loan: number;
  /** False when the down payment is below the legal minimum for this price. */
  meetsMinDown: boolean;
  minDown: number;
  mortgage: number;
  tax: number;
  fees: number;
  total: number;
  /** Payment at the stress-test rate, used for qualifying. */
  stressMortgage: number;
  stressRatePct: number;
  /** Household gross income needed to pass GDS at the stress rate. */
  incomeNeeded: number;
  cashNeeded: number;
}

export function computeCost(i: CostInputs): CostBreakdown {
  const downPayment = (i.price * i.downPaymentPct) / 100;
  const baseLoan = Math.max(0, i.price - downPayment);
  const ltv = i.price > 0 ? baseLoan / i.price : 0;
  const minDown = minDownPayment(i.price);
  const meetsMinDown = downPayment + 0.5 >= minDown;
  const insuredEligible = ltv > 0.8 && i.price < INSURED_PRICE_CAP;
  const premium = insuredEligible ? baseLoan * insurancePremiumRate(ltv) : 0;
  const loan = baseLoan + premium;
  const mortgage = monthlyPayment(loan, i.ratePct, i.amortYears);
  const tax = (i.price * i.propertyTaxPct) / 12;
  const stressRatePct = stressRate(i.ratePct);
  const stressMortgage = monthlyPayment(loan, stressRatePct, i.amortYears);
  const gdsCosts = stressMortgage + tax + i.monthlyHeat + i.monthlyFees * 0.5;
  return {
    downPayment,
    baseLoan,
    premium,
    loan,
    meetsMinDown,
    minDown,
    mortgage,
    tax,
    fees: i.monthlyFees,
    total: mortgage + tax + i.monthlyFees,
    stressMortgage,
    stressRatePct,
    incomeNeeded: (gdsCosts * 12) / GDS_LIMIT,
    // Down payment plus ~1.5% for legal, inspection and adjustments. Excludes property transfer tax.
    cashNeeded: downPayment + i.price * 0.015,
  };
}
