import { Bath, BedDouble, Ruler } from 'lucide-react';
import { money } from '../api';
import type { Listing } from '../server/listings/types';
import { DealBadge } from './Badges';

const TYPE_LABEL = { condo: 'Condo', townhouse: 'Townhouse', house: 'House', duplex: 'Duplex' } as const;

export default function ListingCard({
  listing: l,
  active,
  onSelect,
  onHover,
}: {
  listing: Listing;
  active: boolean;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(l.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(l.id)}
      onBlur={() => onHover(null)}
      className={`group rise flex w-full gap-3 rounded-2xl border p-2.5 text-left transition ${
        active ? 'border-emerald-400/60 bg-emerald-400/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.045]'
      }`}
    >
      <div className="relative h-[92px] w-[116px] shrink-0 overflow-hidden rounded-xl bg-slate-800">
        <img src={l.photos[0]} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        {l.deal.score >= 70 && (
          <span className="tnum absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 backdrop-blur">
            {l.deal.score}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="tnum text-[17px] font-semibold tracking-tight text-white">{money(l.price, l.kind)}</p>
          <p className="shrink-0 text-[11px] text-slate-500">{l.daysOnMarket === 0 ? 'Today' : `${l.daysOnMarket}d`}</p>
        </div>
        <p className="mt-0.5 flex items-center gap-2.5 text-[12px] text-slate-300">
          <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-slate-500" aria-hidden />{l.beds}</span>
          <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5 text-slate-500" aria-hidden />{l.baths}</span>
          {l.sqft && <span className="tnum inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5 text-slate-500" aria-hidden />{l.sqft.toLocaleString('en-CA')}</span>}
        </p>
        <p className="mt-1 truncate text-[12px] text-slate-400">
          {TYPE_LABEL[l.propertyType]} · {l.neighbourhood}, {l.municipality}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {l.deal.flags.slice(0, 2).map((f) => (
            <DealBadge key={f} flag={f} compact />
          ))}
        </div>
      </div>
    </button>
  );
}
