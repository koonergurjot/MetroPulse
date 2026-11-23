import { Box, Compass, Crosshair, Layers, LocateFixed, MapPin, Minus, Plus, Search, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { ListingFilters } from '../api';
import type { LayerState } from '../map/MapCanvas';

const btn =
  'glass grid h-11 w-11 place-items-center rounded-xl text-slate-200 transition hover:text-white active:scale-95 data-[on=true]:border-emerald-400/70 data-[on=true]:text-emerald-300';

export function MapControls(props: {
  tilt: boolean;
  inspect: boolean;
  onZoom: (d: number) => void;
  onTilt: () => void;
  onInspect: () => void;
  onLocate: () => void;
  onReset: () => void;
  locating: boolean;
}) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Map controls">
      <div className="glass flex flex-col overflow-hidden rounded-xl">
        <button type="button" aria-label="Zoom in" onClick={() => props.onZoom(1)} className="grid h-11 w-11 place-items-center text-slate-200 hover:bg-white/5 hover:text-white"><Plus className="h-5 w-5" /></button>
        <span className="h-px bg-white/10" />
        <button type="button" aria-label="Zoom out" onClick={() => props.onZoom(-1)} className="grid h-11 w-11 place-items-center text-slate-200 hover:bg-white/5 hover:text-white"><Minus className="h-5 w-5" /></button>
      </div>
      <button type="button" data-on={props.tilt} aria-pressed={props.tilt} aria-label="Toggle 3D view" title="3D view" onClick={props.onTilt} className={btn}><Box className="h-5 w-5" /></button>
      <button type="button" data-on={props.inspect} aria-pressed={props.inspect} aria-label="Drop pin to inspect a block" title="Drop pin: click the map to build a block report" onClick={props.onInspect} className={btn}><MapPin className="h-5 w-5" /></button>
      <button type="button" aria-label="Use my location" title="Use my location" onClick={props.onLocate} className={btn}><LocateFixed className={`h-5 w-5 ${props.locating ? 'animate-pulse text-emerald-300' : ''}`} /></button>
      <button type="button" aria-label="Reset view" title="Reset view" onClick={props.onReset} className={btn}><Compass className="h-5 w-5" /></button>
    </div>
  );
}

const LAYER_ROWS: Array<{ key: keyof LayerState; label: string; hint: string; dot: string }> = [
  { key: 'listings', label: 'Listings', hint: 'Price pins & clusters', dot: '#34d399' },
  { key: 'heat', label: 'Deal heat', hint: 'Where good deals concentrate', dot: '#fbbf24' },
  { key: 'buildings', label: '3D buildings', hint: 'Footprints & heights', dot: '#6b86b8' },
  { key: 'transit', label: 'Transit stops', hint: 'TransLink GTFS', dot: '#22d3ee' },
  { key: 'planned', label: 'Planned SkyTrain', hint: 'Schematic, approximate', dot: '#c4b5fd' },
  { key: 'portfolio', label: 'My portfolio', hint: 'Sites from the batch tool', dot: '#f472b6' },
  { key: 'civic', label: 'Permits & 311', hint: 'Shown with a block report', dot: '#a78bfa' },
  { key: 'rings', label: 'Walk rings', hint: '5 / 10 / 15 minute radii', dot: '#34d399' },
];

export function LayerMenu({ layers, onToggle }: { layers: LayerState; onToggle: (k: keyof LayerState) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" data-on={open} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)} className="glass inline-flex h-11 items-center gap-2 rounded-xl px-3.5 text-[13px] font-medium text-slate-100 hover:text-white data-[on=true]:border-emerald-400/70">
        <Layers className="h-4.5 w-4.5" aria-hidden /> Layers
      </button>
      {open && (
        <div className="glass rise absolute right-0 top-13 z-20 w-64 rounded-2xl p-2" role="menu">
          {LAYER_ROWS.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.dot, boxShadow: `0 0 10px ${r.dot}99` }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-slate-100">{r.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{r.hint}</span>
              </span>
              <input type="checkbox" checked={layers[r.key]} onChange={() => onToggle(r.key)} className="h-4 w-4 accent-emerald-400" />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const EXAMPLES = ['800 Robson St, Vancouver', '4949 Canada Way, Burnaby', '10153 King George Blvd, Surrey'];

export function SearchBox({ busy, onSearch }: { busy: boolean; onSearch: (address: string) => void }) {
  const [value, setValue] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };
  return (
    <div>
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor="mp-search" className="sr-only">Search an address in Metro Vancouver</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-500" aria-hidden />
        <input
          id="mp-search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search an address for a block report…"
          autoComplete="street-address"
          className="h-12 w-full rounded-xl border border-white/10 bg-black/30 pl-11 pr-24 text-[14px] text-white placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
        />
        {value && (
          <button type="button" aria-label="Clear" onClick={() => setValue('')} className="absolute right-[78px] top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
        )}
        <button type="submit" disabled={busy || !value.trim()} className="absolute right-1.5 top-1.5 h-9 rounded-lg bg-emerald-400 px-3.5 text-[13px] font-semibold text-emerald-950 transition enabled:hover:bg-emerald-300 disabled:opacity-40">
          {busy ? '…' : 'Go'}
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5 max-lg:hidden">
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" onClick={() => { setValue(ex); onSearch(ex); }} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-400 hover:border-white/25 hover:text-white">
            {ex.split(',')[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

const TYPES: Array<{ key: ListingFilters['types'][number]; label: string }> = [
  { key: 'condo', label: 'Condo' },
  { key: 'townhouse', label: 'Townhome' },
  { key: 'house', label: 'House' },
  { key: 'duplex', label: 'Duplex' },
];

const SALE_PRICES = [null, 600_000, 800_000, 1_000_000, 1_500_000, 2_500_000];
const RENT_PRICES = [null, 2000, 2500, 3000, 4000];

function priceLabel(p: number | null): string {
  if (p === null) return 'Any price';
  if (p >= 1_000_000) return `Up to $${p / 1_000_000}M`;
  if (p >= 10_000) return `Up to $${p / 1000}k`;
  return `Up to $${p.toLocaleString('en-CA')}`;
}

export function FilterBar({ filters, onChange }: { filters: ListingFilters; onChange: (f: ListingFilters) => void }) {
  const prices = filters.kind === 'sale' ? SALE_PRICES : RENT_PRICES;
  const toggleType = (t: ListingFilters['types'][number]) => {
    const has = filters.types.includes(t);
    const next = has ? filters.types.filter((x) => x !== t) : [...filters.types, t];
    onChange({ ...filters, types: next.length === 0 ? [t] : next });
  };
  const sel = 'h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-[12px] text-slate-200 focus:border-emerald-400/60 focus:outline-none';
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/25 p-1" role="tablist" aria-label="Buy or rent">
        {(['sale', 'rent'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={filters.kind === k} onClick={() => onChange({ ...filters, kind: k, maxPrice: null })} className={`h-9 rounded-lg text-[13px] font-semibold transition ${filters.kind === k ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'}`}>
            {k === 'sale' ? 'Buy' : 'Rent'}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Property types">
        {TYPES.map((t) => {
          const on = filters.types.includes(t.key);
          return (
            <button key={t.key} type="button" aria-pressed={on} onClick={() => toggleType(t.key)} className={`rounded-full border px-3 py-1 text-[12px] transition ${on ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200' : 'border-white/10 text-slate-400 hover:text-white'}`}>
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="sr-only" htmlFor="f-price">Max price</label>
        <select id="f-price" className={sel} value={filters.maxPrice ?? ''} onChange={(e) => onChange({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : null })}>
          {prices.map((p) => <option key={String(p)} value={p ?? ''}>{priceLabel(p)}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-beds">Minimum bedrooms</label>
        <select id="f-beds" className={sel} value={filters.minBeds} onChange={(e) => onChange({ ...filters, minBeds: Number(e.target.value) })}>
          {[0, 1, 2, 3, 4].map((b) => <option key={b} value={b}>{b === 0 ? 'Any beds' : `${b}+ beds`}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-sort">Sort</label>
        <select id="f-sort" className={sel} value={filters.sort} onChange={(e) => onChange({ ...filters, sort: e.target.value as ListingFilters['sort'] })}>
          <option value="deal">Best deals</option>
          <option value="newest">Newest</option>
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
        </select>
      </div>
    </div>
  );
}

export { Crosshair };
