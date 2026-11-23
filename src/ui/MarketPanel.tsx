import { BarChart3, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchMarket, type Bounds } from '../api';
import type { MarketSnapshot } from '../server/listings/types';

const usd = (n: number | null, kind: 'sale' | 'rent'): string => (n === null ? '—' : kind === 'rent' ? `$${Math.round(n).toLocaleString('en-CA')}` : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);

export default function MarketPanel({ bounds, kind }: { bounds: Bounds | null; kind: 'sale' | 'rent' }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || !bounds) return;
    const ctl = new AbortController();
    setError(false);
    fetchMarket(bounds, kind, ctl.signal).then(setData).catch((e: unknown) => { if ((e as Error).name !== 'AbortError') setError(true); });
    return () => ctl.abort();
  }, [open, bounds, kind]);

  const rows = (data?.rows ?? []).slice(0, 8);
  const max = Math.max(1, ...rows.map((r) => r.medianPpsf ?? 0));

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-slate-100">
        <BarChart3 className="h-4 w-4 text-cyan-300" aria-hidden /> Market snapshot
        <ChevronDown className={`ml-auto h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {error && <p className="text-[12px] text-rose-300">Could not load market data.</p>}
          {!data && !error && <div className="shimmer h-24 rounded-lg" />}
          {rows.map((r) => (
            <div key={r.municipality} className="text-[12px]">
              <div className="flex items-baseline justify-between text-slate-300">
                <span>{r.municipality} <span className="text-slate-500">· {r.count}</span></span>
                <span className="tnum text-slate-200">{usd(r.medianPrice, kind)} · ${Math.round(r.medianPpsf ?? 0)}/sqft</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${((r.medianPpsf ?? 0) / max) * 100}%` }} /></div>
              <p className="tnum mt-0.5 text-[11px] text-slate-500">{Math.round(r.medianDaysOnMarket ?? 0)} days on market · {Math.round(r.priceCutShare * 100)}% price cuts</p>
            </div>
          ))}
          {data?.provider.demo && <p className="text-[11px] text-amber-200/80">Computed from demo listings.</p>}
        </div>
      )}
    </div>
  );
}
