import { ArrowLeft, X } from 'lucide-react';
import { money } from '../api';
import type { Listing } from '../server/listings/types';

type Row = { label: string; get: (l: Listing) => string; num?: (l: Listing) => number | null; best?: 'low' | 'high' };

const ROWS: Row[] = [
  { label: 'Price', get: (l) => money(l.price, l.kind), num: (l) => l.price, best: 'low' },
  { label: '$/sqft', get: (l) => (l.deal.ppsf === null ? '—' : `$${l.deal.ppsf.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`), num: (l) => l.deal.ppsf, best: 'low' },
  { label: 'vs similar', get: (l) => (l.deal.vsMedianPct === null ? '—' : `${l.deal.vsMedianPct > 0 ? '+' : ''}${l.deal.vsMedianPct}%`), num: (l) => l.deal.vsMedianPct, best: 'low' },
  { label: 'Deal score', get: (l) => `${l.deal.score}/100`, num: (l) => l.deal.score, best: 'high' },
  { label: 'Beds', get: (l) => String(l.beds), num: (l) => l.beds, best: 'high' },
  { label: 'Baths', get: (l) => String(l.baths), num: (l) => l.baths, best: 'high' },
  { label: 'Size (sqft)', get: (l) => (l.sqft ? l.sqft.toLocaleString('en-CA') : '—'), num: (l) => l.sqft, best: 'high' },
  { label: 'Year built', get: (l) => String(l.yearBuilt ?? '—'), num: (l) => l.yearBuilt, best: 'high' },
  { label: 'Days on market', get: (l) => String(l.daysOnMarket), num: (l) => l.daysOnMarket },
  { label: 'Type', get: (l) => l.propertyType },
  { label: 'Area', get: (l) => `${l.neighbourhood}, ${l.municipality}` },
];

export default function Compare({ listings, onBack, onRemove, onOpen }: { listings: Listing[]; onBack: () => void; onRemove: (id: string) => void; onOpen: (l: Listing) => void }) {
  return (
    <div className="rise space-y-4 p-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> Back</button>
      <h2 className="text-[16px] font-semibold text-white">Compare homes</h2>
      {listings.length < 2 && <p className="text-[13px] text-slate-400">Pick at least two homes to compare.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[340px] border-separate border-spacing-y-1 text-left text-[12px]">
          <thead>
            <tr>
              <th className="w-[84px]" />
              {listings.map((l) => (
                <th key={l.id} className="align-top font-normal">
                  <div className="relative">
                    <button type="button" onClick={() => onOpen(l)} className="block w-full overflow-hidden rounded-lg"><img src={l.photos[0]} alt="" className="aspect-[4/3] w-full object-cover" /></button>
                    <button type="button" aria-label="Remove from comparison" onClick={() => onRemove(l.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 hover:bg-black/80"><X className="h-3 w-3" /></button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const nums = r.num ? listings.map((l) => r.num!(l)) : [];
              const valid = nums.filter((n): n is number => n !== null);
              const target = r.best && valid.length > 1 ? (r.best === 'low' ? Math.min(...valid) : Math.max(...valid)) : null;
              return (
                <tr key={r.label}>
                  <th scope="row" className="py-1.5 pr-2 align-top text-[11px] font-medium uppercase tracking-wider text-slate-500">{r.label}</th>
                  {listings.map((l, i) => {
                    const win = target !== null && nums[i] === target && new Set(valid).size > 1;
                    return <td key={l.id} className={`tnum rounded-md px-2 py-1.5 align-top ${win ? 'bg-emerald-400/10 font-semibold text-emerald-200' : 'bg-white/[0.03] text-slate-200'}`}>{r.get(l)}</td>;
                  })}
                </tr>
              );
            })}
            <tr>
              <th scope="row" className="py-1.5 pr-2 align-top text-[11px] font-medium uppercase tracking-wider text-slate-500">Features</th>
              {listings.map((l) => <td key={l.id} className="rounded-md bg-white/[0.03] px-2 py-1.5 align-top text-slate-300">{l.features.join(', ') || '—'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">Green marks the stronger value in each row where “better” is clear. A comparison aid, not advice.</p>
    </div>
  );
}
