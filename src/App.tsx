import { Info, Layers, ListFilter, Loader2, MapPinned, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchListings, fetchPulse, fetchStops, type Bounds, type ListingFilters, type PulseQuery, type StopsResponse } from './api';
import MapCanvas, { type FlyTarget, type LayerState, type MapCanvasHandle } from './map/MapCanvas';
import type { ListingsResponse } from './server/listings/types';
import type { PulseResponse } from './server/types';
import AboutDialog from './ui/AboutDialog';
import { FilterBar, LayerMenu, MapControls, SearchBox } from './ui/Controls';
import ListingCard from './ui/ListingCard';
import ListingDetail from './ui/ListingDetail';
import ReportPanel from './ui/ReportPanel';

const REPORT_PREFIX = '/report/';

const DEFAULT_FILTERS: ListingFilters = { kind: 'sale', types: ['condo', 'townhouse', 'house', 'duplex'], maxPrice: null, minBeds: 0, sort: 'deal' };
const DEFAULT_LAYERS: LayerState = { listings: true, heat: true, transit: true, planned: true, civic: true, rings: true, buildings: true };

type Tab = 'homes' | 'report';

const compact = (n: number | null, kind: 'sale' | 'rent'): string => {
  if (n === null) return '—';
  if (kind === 'rent') return `$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`;
};

export default function App() {
  const mapRef = useRef<MapCanvasHandle>(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [zoom, setZoom] = useState(10);
  const [data, setData] = useState<ListingsResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [stops, setStops] = useState<StopsResponse['stops']>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('homes');
  const [report, setReport] = useState<PulseResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<PulseQuery | null>(null);
  const [fly, setFly] = useState<FlyTarget | null>(null);
  const [tilt, setTilt] = useState(false);
  const [inspect, setInspect] = useState(false);
  const [locating, setLocating] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const reqId = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const flyNonce = useRef(0);

  const flyTo = useCallback((lng: number, lat: number, zoomLevel?: number) => {
    setFly({ lng, lat, zoom: zoomLevel, nonce: ++flyNonce.current });
  }, []);

  // Listings follow the viewport + filters.
  useEffect(() => {
    if (!bounds) return;
    const ctl = new AbortController();
    setListLoading(true);
    fetchListings(bounds, filters, ctl.signal)
      .then((r) => { setData(r); setListError(null); })
      .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') setListError('Could not load listings. Pan the map to retry.'); })
      .finally(() => { if (!ctl.signal.aborted) setListLoading(false); });
    return () => ctl.abort();
  }, [bounds, filters]);

  // Transit stops once the map is close enough to show them.
  useEffect(() => {
    if (!bounds || zoom < 12.5 || !layers.transit) return;
    const ctl = new AbortController();
    // The bundled sample index uses placeholder stop ids at made-up positions: never draw them.
    fetchStops(bounds, ctl.signal).then((r) => setStops(r.placeholder ? [] : r.stops)).catch(() => undefined);
    return () => ctl.abort();
  }, [bounds, zoom, layers.transit]);

  const runReport = useCallback(async (q: PulseQuery, opts: { fly?: boolean; pushUrl?: boolean } = {}) => {
    const id = ++reqId.current;
    setLastQuery(q);
    setTab('report');
    setSheetOpen(true);
    setReportLoading(true);
    setReportError(null);
    try {
      const r = await fetchPulse(q);
      if (id !== reqId.current) return;
      setReport(r);
      if (opts.fly !== false) { flyTo(r.location.lng, r.location.lat, 15.4); }
      if (opts.pushUrl !== false && r.location.slug) window.history.replaceState(null, '', `${REPORT_PREFIX}${r.location.slug}`);
    } catch (e) {
      if (id !== reqId.current) return;
      setReport(null);
      setReportError(e instanceof Error ? e.message : 'Something went wrong building this report.');
    } finally {
      if (id === reqId.current) setReportLoading(false);
    }
  }, [flyTo]);

  // Deep link: /report/<slug>
  useEffect(() => {
    const path = window.location.pathname;
    if (!path.startsWith(REPORT_PREFIX)) return;
    const slug = decodeURIComponent(path.slice(REPORT_PREFIX.length).replace(/\/+$/, ''));
    if (slug) void runReport({ slug }, { pushUrl: false });
  }, [runReport]);

  const selected = useMemo(() => data?.listings.find((l) => l.id === selectedId) ?? null, [data, selectedId]);
  // Keep a selected listing alive even if a pan/filter drops it from the response.
  const selectedRef = useRef(selected);
  if (selected) selectedRef.current = selected;
  const shownSelected = selectedId ? selected ?? (selectedRef.current?.id === selectedId ? selectedRef.current : null) : null;

  const selectListing = useCallback((id: string | null) => {
    setSelectedId(id);
    setTab('homes');
    setSheetOpen(true);
    if (id) {
      const l = data?.listings.find((x) => x.id === id);
      if (l) flyTo(l.lng, l.lat, 16.2);
    }
  }, [data, flyTo]);

  const locate = () => {
    if (!navigator.geolocation) { setReportError('Location is not available in this browser.'); setTab('report'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); void runReport({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setLocating(false); setReportError('Could not get your location. Check browser permissions.'); setTab('report'); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  // A new view (detail, report, list) always starts at the top.
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [tab, selectedId]);

  const headline = data?.stats;
  const listings = data?.listings ?? [];

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink text-slate-200">
      <MapCanvas
        ref={mapRef}
        listings={listings}
        selectedId={selectedId}
        hoveredId={hoveredId}
        stops={stops}
        report={report}
        layers={layers}
        fly={fly}
        tilt={tilt}
        inspectMode={inspect}
        onViewport={(b, z) => { setBounds(b); setZoom(z); }}
        onSelectListing={selectListing}
        onInspect={(lng, lat) => { setInspect(false); void runReport({ lat, lng }, { fly: false, pushUrl: false }); }}
      />

      {/* Left panel (bottom sheet on small screens) */}
      <aside
        className={`glass absolute z-10 flex flex-col overflow-hidden rounded-3xl transition-[height] duration-300 max-lg:inset-x-2 max-lg:bottom-2 ${sheetOpen ? 'max-lg:h-[58vh]' : 'max-lg:h-[132px]'} lg:bottom-4 lg:left-4 lg:top-4 lg:w-[420px]`}
        aria-label="Search and results"
      >
        <button type="button" onClick={() => setSheetOpen((o) => !o)} aria-label={sheetOpen ? 'Collapse panel' : 'Expand panel'} className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/20 lg:hidden" />

        <header className="shrink-0 space-y-3 px-4 pb-3 pt-3 lg:pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-cyan-400 shadow-[0_0_24px_rgba(52,211,153,0.35)]">
                <MapPinned className="h-5 w-5 text-slate-950" aria-hidden />
              </div>
              <div>
                <h1 className="text-[17px] font-semibold leading-none tracking-tight text-white">MetroPulse</h1>
                <p className="mt-1 text-[11px] leading-none text-slate-500">Know the block before you sign</p>
              </div>
            </div>
            <button type="button" onClick={() => setAboutOpen(true)} aria-label="About and data sources" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><Info className="h-5 w-5" /></button>
          </div>
          <SearchBox busy={reportLoading} onSearch={(address) => void runReport({ address })} />
        </header>

        <nav className="shrink-0 border-y border-white/[0.06] px-4" aria-label="Panel view">
          <div className="flex gap-6" role="tablist">
            {([['homes', 'Homes', ListFilter], ['report', 'Block report', Layers]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setSheetOpen(true); }} className={`relative inline-flex items-center gap-2 py-3 text-[13px] font-medium transition ${tab === k ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                <Icon className="h-4 w-4" aria-hidden /> {label}
                {k === 'report' && report && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-label="report ready" />}
                {tab === k && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-400" />}
              </button>
            ))}
          </div>
        </nav>

        <div ref={scroller} className="scroll-y min-h-0 flex-1">
          {tab === 'report' ? (
            <ReportPanel data={report} loading={reportLoading} error={reportError} onBack={() => setTab('homes')} onRetry={() => lastQuery && void runReport(lastQuery)} />
          ) : shownSelected ? (
            <ListingDetail
              listing={shownSelected}
              provider={data?.provider ?? null}
              onBack={() => setSelectedId(null)}
              onReport={() => void runReport({ lat: shownSelected.lat, lng: shownSelected.lng, locality: shownSelected.municipality }, { fly: false, pushUrl: false })}
              onFocus={() => { setTilt(true); flyTo(shownSelected.lng, shownSelected.lat, 17.2); }}
            />
          ) : (
            <div className="space-y-3 p-4">
              <FilterBar filters={filters} onChange={setFilters} />
              {data?.provider.demo && (
                <button type="button" onClick={() => setAboutOpen(true)} className="flex w-full items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-left text-[12px] text-amber-100/90 hover:bg-amber-400/10">
                  <Sparkles className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                  Demo listings: generated samples, not real properties.
                </button>
              )}
              <div className="flex items-center justify-between text-[12px] text-slate-400" aria-live="polite">
                <span>
                  <span className="tnum font-semibold text-white">{headline?.count ?? '…'}</span> in view
                  {headline?.medianPrice != null && <> · median <span className="tnum text-slate-200">{compact(headline.medianPrice, filters.kind)}</span></>}
                  {headline?.medianPpsf != null && <> · <span className="tnum text-slate-200">${Math.round(headline.medianPpsf)}</span>/sqft</>}
                </span>
                {listLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" aria-label="Loading" />}
              </div>
              {listError && <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-[12px] text-rose-200">{listError}</p>}
              <div className="space-y-2">
                {listings.slice(0, 60).map((l) => (
                  <ListingCard key={l.id} listing={l} active={l.id === selectedId} onSelect={() => selectListing(l.id)} onHover={setHoveredId} />
                ))}
                {!listLoading && listings.length === 0 && !listError && (
                  <p className="py-10 text-center text-[13px] text-slate-500">No homes match here. Zoom out or loosen the filters.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Top-right: layers */}
      <div className="absolute right-3 top-3 z-10 lg:right-4 lg:top-4"><LayerMenu layers={layers} onToggle={(k) => setLayers((s) => ({ ...s, [k]: !s[k] }))} /></div>

      {/* Right: controls */}
      <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2 max-lg:top-[68px] max-lg:translate-y-0 lg:right-4">
        <MapControls
          tilt={tilt}
          inspect={inspect}
          locating={locating}
          onZoom={(d) => mapRef.current?.zoomBy(d)}
          onTilt={() => setTilt((t) => !t)}
          onInspect={() => setInspect((i) => !i)}
          onLocate={locate}
          onReset={() => { setTilt(false); mapRef.current?.resetView(); }}
        />
      </div>

      {inspect && (
        <div className="glass pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] text-emerald-200 max-lg:top-16" role="status">
          Click anywhere on the map to build a block report
        </div>
      )}

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
