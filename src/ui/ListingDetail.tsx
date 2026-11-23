import { ArrowLeft, Bath, BedDouble, Box, ChevronLeft, ChevronRight, MapPinned, Ruler, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { money } from '../api';
import type { Listing, ProviderInfo } from '../server/listings/types';
import { DealBadge } from './Badges';

function MarketBar({ pct }: { pct: number }) {
  // -30%..+30% mapped across the track; centre is the cohort median.
  const clamped = Math.max(-30, Math.min(30, pct));
  const left = ((clamped + 30) / 60) * 100;
  return (
    <div className="mt-3" aria-hidden>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-400/70 via-slate-600/60 to-rose-400/70">
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow-[0_0_14px_rgba(255,255,255,0.5)]" style={{ left: `${left}%` }} />
        <div className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-white/40" />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
        <span>Cheaper</span>
        <span>Typical</span>
        <span>Pricier</span>
      </div>
    </div>
  );
}

export default function ListingDetail({
  listing: l,
  provider,
  onBack,
  onReport,
  onFocus,
}: {
  listing: Listing;
  provider: ProviderInfo | null;
  onBack: () => void;
  onReport: () => void;
  onFocus: () => void;
}) {
  const [i, setI] = useState(0);
  const photo = l.photos[i] ?? l.photos[0];
  const unit = l.kind === 'rent' ? '/sqft/mo' : '/sqft';
  return (
    <div className="rise space-y-4 p-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All homes
      </button>

      <div className="relative overflow-hidden rounded-2xl bg-slate-900">
        <img src={photo} alt={`Illustration ${i + 1} of ${l.photos.length} for this sample listing`} className="aspect-[8/5] w-full object-cover" />
        {l.photos.length > 1 && (
          <>
            <button type="button" aria-label="Previous image" onClick={() => setI((i + l.photos.length - 1) % l.photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 backdrop-blur hover:bg-black/75"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" aria-label="Next image" onClick={() => setI((i + 1) % l.photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/55 p-1.5 backdrop-blur hover:bg-black/75"><ChevronRight className="h-4 w-4" /></button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {l.photos.map((_, k) => (
                <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-white' : 'w-1.5 bg-white/45'}`} />
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="tnum text-[28px] font-semibold leading-none tracking-tight text-white">{money(l.price, l.kind)}</h2>
          {l.priceDrop && (
            <p className="tnum text-right text-[12px] text-amber-300">
              <span className="line-through opacity-60">{money(l.priceDrop.fromPrice, l.kind)}</span>
              <br />−{l.priceDrop.pct}%
            </p>
          )}
        </div>
        <p className="mt-2 text-[13px] text-slate-300">{l.address}</p>
        <p className="text-[12px] text-slate-500">{l.neighbourhood}, {l.municipality}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {l.deal.flags.map((f) => <DealBadge key={f} flag={f} />)}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { Icon: BedDouble, v: l.beds, k: 'Beds' },
          { Icon: Bath, v: l.baths, k: 'Baths' },
          { Icon: Ruler, v: l.sqft ? l.sqft.toLocaleString('en-CA') : '—', k: 'Sq ft' },
          { Icon: Box, v: l.yearBuilt ?? '—', k: 'Built' },
        ].map(({ Icon, v, k }) => (
          <div key={k} className="rounded-xl border border-white/[0.06] bg-white/[0.025] py-2.5">
            <Icon className="mx-auto h-4 w-4 text-slate-500" aria-hidden />
            <p className="tnum mt-1 text-[15px] font-semibold text-white">{v}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4" aria-label="Price comparison">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-white">Price vs comparable listings</h3>
          <span className="tnum rounded-md bg-black/30 px-2 py-0.5 text-[12px] font-semibold text-amber-300">{l.deal.score}/100</span>
        </div>
        {l.deal.vsMedianPct !== null && l.deal.ppsf !== null && l.deal.cohortMedianPpsf !== null ? (
          <>
            <p className="mt-2 text-[13px] text-slate-300">
              <span className="tnum font-semibold text-white">${l.deal.ppsf.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</span>{unit} vs a median of{' '}
              <span className="tnum font-semibold text-white">${l.deal.cohortMedianPpsf.toLocaleString('en-CA', { maximumFractionDigits: 0 })}</span>{' '}
              for similar {l.propertyType}s (
              <span className={l.deal.vsMedianPct <= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                {l.deal.vsMedianPct > 0 ? '+' : ''}{l.deal.vsMedianPct}%
              </span>).
            </p>
            <MarketBar pct={l.deal.vsMedianPct} />
          </>
        ) : (
          <p className="mt-2 text-[13px] text-slate-400">Not enough comparable listings in view to compare. Zoom out to widen the comparison.</p>
        )}
        <p className="mt-3 text-[11px] leading-snug text-slate-500">A “worth a look” signal from listing prices only. It is not an appraisal and ignores condition, view, and layout.</p>
      </section>

      {l.features.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {l.features.map((f) => <span key={f} className="rounded-full border border-white/10 px-2.5 py-1 text-[12px] text-slate-300">{f}</span>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onReport} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-[13px] font-semibold text-emerald-950 transition hover:bg-emerald-300">
          <MapPinned className="h-4 w-4" aria-hidden /> Block report
        </button>
        <button type="button" onClick={onFocus} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-white/5">
          <Box className="h-4 w-4" aria-hidden /> Fly in 3D
        </button>
      </div>

      {provider?.demo && (
        <p className="flex gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-[12px] leading-snug text-amber-100/90">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <span>{provider.notice}</span>
        </p>
      )}
      {l.brokerage && <p className="text-[11px] text-slate-500">Listing brokerage: {l.brokerage}</p>}
    </div>
  );
}
