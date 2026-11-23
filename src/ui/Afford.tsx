import { Calculator } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { computeCost } from '../lib/mortgage';
import { loadJson, saveJson } from '../lib/storage';
import type { Listing } from '../server/listings/types';

const KEY = 'mp.afford.v1';
const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-CA')}`;

interface Assumptions {
  downPct: number;
  rate: number;
  amort: 25 | 30;
}

const defaultFees = (l: Listing): number =>
  l.propertyType === 'condo' ? Math.round(((l.sqft ?? 700) * 0.6) / 5) * 5 : l.propertyType === 'townhouse' ? 300 : 0;

export default function Afford({ listing: l }: { listing: Listing }) {
  const [a, setA] = useState<Assumptions>(() => loadJson(KEY, { downPct: 20, rate: 4.5, amort: 25 }));
  const [fees, setFees] = useState(() => defaultFees(l));
  useEffect(() => saveJson(KEY, a), [a]);
  useEffect(() => setFees(defaultFees(l)), [l.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = useMemo(
    () => computeCost({ price: l.price, downPaymentPct: a.downPct, ratePct: a.rate, amortYears: a.amort, propertyTaxPct: 0.003, monthlyFees: fees, monthlyHeat: 100 }),
    [l.price, a, fees],
  );
  const minPct = Math.ceil((c.minDown / l.price) * 100);
  const label = 'text-[11px] uppercase tracking-wider text-slate-500';

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4" aria-label="Monthly cost estimate">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-white"><Calculator className="h-4 w-4 text-emerald-300" aria-hidden /> Monthly cost estimate</h3>

      <p className="tnum mt-3 text-[28px] font-semibold leading-none tracking-tight text-white">{usd(c.total)}<span className="text-[13px] font-normal text-slate-500"> /month</span></p>
      <dl className="tnum mt-3 space-y-1.5 text-[12px] text-slate-300">
        <div className="flex justify-between"><dt>Mortgage ({usd(c.loan)} loan)</dt><dd>{usd(c.mortgage)}</dd></div>
        <div className="flex justify-between"><dt>Property tax (≈0.3%/yr, estimate)</dt><dd>{usd(c.tax)}</dd></div>
        {fees > 0 && <div className="flex justify-between"><dt>Strata / maintenance</dt><dd>{usd(c.fees)}</dd></div>}
        {c.premium > 0 && <div className="flex justify-between text-slate-500"><dt>Includes default-insurance premium</dt><dd>{usd(c.premium)}</dd></div>}
      </dl>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="flex justify-between text-[12px] text-slate-300"><span>Down payment</span><span className="tnum">{a.downPct}% · {usd(c.downPayment)}</span></span>
          <input type="range" min={5} max={40} step={1} value={a.downPct} onChange={(e) => setA({ ...a, downPct: Number(e.target.value) })} className="mt-1 w-full accent-emerald-400" aria-label="Down payment percent" />
        </label>
        <label className="block">
          <span className="flex justify-between text-[12px] text-slate-300"><span>Interest rate</span><span className="tnum">{a.rate.toFixed(2)}%</span></span>
          <input type="range" min={3} max={8} step={0.05} value={a.rate} onChange={(e) => setA({ ...a, rate: Number(e.target.value) })} className="mt-1 w-full accent-emerald-400" aria-label="Interest rate percent" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className={label}>Amortization</span>
            <select value={a.amort} onChange={(e) => setA({ ...a, amort: Number(e.target.value) as 25 | 30 })} className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-[12px] text-slate-200">
              <option value={25}>25 years</option>
              <option value={30}>30 years (eligibility limits)</option>
            </select>
          </label>
          <label className="block"><span className={label}>Strata $/mo</span>
            <input type="number" min={0} step={10} value={fees} onChange={(e) => setFees(Math.max(0, Number(e.target.value) || 0))} className="tnum mt-1 h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-[12px] text-slate-200" />
          </label>
        </div>
      </div>

      {!c.meetsMinDown && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 p-2.5 text-[12px] text-rose-200">
          The minimum down payment for this price is about {usd(c.minDown)} ({minPct}%). Raise it to see a valid estimate.
        </p>
      )}

      <div className="mt-3 rounded-xl bg-black/25 p-3 text-[12px] leading-snug text-slate-300">
        <p>Lenders test you at <span className="tnum font-semibold text-white">{c.stressRatePct.toFixed(2)}%</span> ({usd(c.stressMortgage)}/mo). To pass at that rate you’d need roughly <span className="tnum font-semibold text-emerald-300">{usd(c.incomeNeeded)}</span> household income, and about <span className="tnum font-semibold text-white">{usd(c.cashNeeded)}</span> cash on closing (before BC property transfer tax).</p>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">Estimate only, not advice. Rules change and lenders decide. Assumes a fixed rate compounded semi-annually, 39% GDS and $100/mo heat.</p>
    </section>
  );
}
