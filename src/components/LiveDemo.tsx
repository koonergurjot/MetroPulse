import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  MapPin,
  Bus,
  AlertTriangle,
  RefreshCw,
  LocateFixed,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  Info,
  Loader2,
  ClipboardList,
  Building2,
  Home,
  Construction,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { PulseResponse, ScoreComponent, SourceResult, SourceStatus } from '../server/types';

type SourceCard = Omit<SourceResult<unknown>, 'data'>;
type Query = { address: string } | { lat: number; lng: number };

const EXAMPLE_ADDRESSES = [
  '800 Robson St, Vancouver, BC',
  '4949 Canada Way, Burnaby, BC',
  '10153 King George Blvd, Surrey, BC',
];

function buildSearch(query: Query): string {
  const params = new URLSearchParams();
  if ('address' in query) params.set('address', query.address);
  else {
    params.set('lat', String(query.lat));
    params.set('lng', String(query.lng));
  }
  return params.toString();
}

function formatAge(ms: number): string {
  if (ms < 1000) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function formatDelay(delaySec: number | null): { text: string; color: string } {
  if (delaySec === null) return { text: 'No prediction', color: 'text-slate-500' };
  const minutes = Math.round(delaySec / 60);
  if (minutes <= 0) return { text: minutes < 0 ? `${Math.abs(minutes)} min early` : 'On time', color: 'text-emerald-400' };
  if (minutes <= 5) return { text: `+${minutes} min`, color: 'text-amber-400' };
  return { text: `+${minutes} min`, color: 'text-red-400' };
}

const STATUS_STYLES: Record<
  SourceStatus,
  { icon: typeof CheckCircle2; label: string; text: string; card: string }
> = {
  ok: { icon: CheckCircle2, label: 'Live', text: 'text-emerald-400', card: 'border-slate-800 bg-slate-900/50' },
  stale: { icon: Clock, label: 'Cached', text: 'text-amber-400', card: 'border-slate-800 bg-slate-900/50' },
  error: { icon: XCircle, label: 'Unavailable', text: 'text-red-400', card: 'border-slate-800/60 bg-slate-900/20 opacity-60' },
  skipped: { icon: MinusCircle, label: 'Skipped', text: 'text-slate-500', card: 'border-slate-800/60 bg-slate-900/20 opacity-60' },
};

function sourceMessage(source: SourceCard): string {
  if (source.status === 'error' || source.status === 'skipped') return source.error ?? 'Unavailable.';
  if (source.status === 'stale') return `Showing cached data, ${formatAge(source.ageMs)}.`;
  return `Updated ${formatAge(source.ageMs)}.`;
}

function ScoreRing({ score, size = 140 }: { score: number | null; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - ((score ?? 0) / 100) * circumference;
  const color = score === null ? '#475569' : score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        {score !== null && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score === null ? '—' : score}</span>
        <span className="text-xs text-slate-500">Pulse Score</span>
      </div>
    </div>
  );
}

function ComponentRow({ component }: { component: ScoreComponent }) {
  const barColor = !component.available
    ? 'bg-slate-700'
    : component.score >= 75
      ? 'bg-emerald-500'
      : component.score >= 50
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div
      className={`p-3 rounded-lg border ${
        component.available ? 'border-slate-800 bg-slate-800/30' : 'border-slate-800/50 bg-slate-900/20 opacity-70'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-sm font-medium text-slate-200">{component.label}</span>
        <span className="text-xs font-mono text-slate-400 shrink-0">
          {component.available ? component.score : 'N/A'}
          <span className="text-slate-600"> · {Math.round(component.weight * 100)}% weight</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-2">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${component.available ? component.score : 0}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{component.reason}</p>
    </div>
  );
}

function SourceChip({ source }: { source: SourceCard }) {
  const style = STATUS_STYLES[source.status];
  const Icon = style.icon;
  return (
    <div className={`p-3 rounded-lg border ${style.card}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-slate-200 truncate">{source.meta.label}</span>
        <span className={`flex items-center gap-1 text-[11px] font-medium shrink-0 ${style.text}`}>
          <Icon className="w-3 h-3" /> {style.label}
        </span>
      </div>
      <p className="text-xs text-slate-500 leading-snug">{sourceMessage(source)}</p>
      {source.meta.attribution && (
        <p className="text-[10px] text-slate-600 mt-1.5 leading-snug border-t border-slate-800/60 pt-1.5">
          {source.meta.attribution}
        </p>
      )}
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-800/60 ${className}`} />;
}

function LoadingState() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 p-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col items-center gap-4">
        <Skeleton className="w-[140px] h-[140px] rounded-full" />
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-24 h-3" />
      </div>
      <div className="md:col-span-2 space-y-4">
        <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center rounded-2xl bg-slate-900/50 border border-red-500/20">
      <AlertTriangle className="w-8 h-8 text-red-400" />
      <p className="text-slate-200 font-medium max-w-md">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 px-4 py-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
      >
        Try again
      </button>
    </div>
  );
}

function IdleState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center rounded-2xl bg-slate-900/50 border border-slate-800">
      <Search className="w-8 h-8 text-slate-600" />
      <p className="text-slate-400 text-sm">Enter a Metro Vancouver address, or use your location, to build a report.</p>
    </div>
  );
}

export default function LiveDemo() {
  const [addressInput, setAddressInput] = useState('');
  const [data, setData] = useState<PulseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const requestId = useRef(0);

  const runQuery = useCallback(async (query: Query) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pulse?${buildSearch(query)}`);
      const body = await res.json().catch(() => null);
      if (id !== requestId.current) return;
      if (!res.ok) {
        setError(body && typeof body.error === 'string' ? body.error : 'Something went wrong building this report.');
        setData(null);
        return;
      }
      setData(body as PulseResponse);
    } catch {
      if (id !== requestId.current) return;
      setError('Could not reach the MetroPulse API. Is `npm run dev:api` running?');
      setData(null);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = addressInput.trim();
    if (!trimmed) return;
    runQuery({ address: trimmed });
  };

  const handleUseLocation = () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setAddressInput('');
        runQuery({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        // Denied, unavailable, or timed out — fail silently and let the
        // address field keep working.
        setLocating(false);
      },
      { timeout: 10_000 },
    );
  };

  const handleRefresh = () => {
    if (!data) return;
    if (data.location.address) runQuery({ address: data.location.address });
    else runQuery({ lat: data.location.lat, lng: data.location.lng });
  };

  const departures = data?.transit?.departures.slice(0, 5) ?? [];
  const alerts = data?.transit?.alerts.slice(0, 4) ?? [];

  const civicStats = data
    ? [
        { label: '311 requests', count: data.civic.serviceRequests.length, icon: ClipboardList },
        { label: 'Building permits', count: data.civic.permits.length, icon: Building2 },
        { label: 'Rental issues', count: data.civic.rentalIssues.length, icon: Home },
        { label: 'Road events', count: data.civic.roadEvents.length, icon: Construction },
      ]
    : [];

  return (
    <section className="min-h-screen pt-24 pb-16 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-emerald-400 font-medium text-sm uppercase tracking-wider">Live Demo</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">MetroPulse Dashboard</h2>
          <p className="text-xl text-slate-400 mb-8 max-w-3xl">
            Real address report — pulled live from TransLink, BC civic open data, and DriveBC.
          </p>

          {/* Address form */}
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="123 Main St, Vancouver, BC"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-700/50 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !addressInput.trim()}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Get report
            </button>
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating || loading}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800/50 text-slate-300 border border-slate-700/50 hover:text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {locating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
              Use my location
            </button>
          </form>

          <div className="flex flex-wrap gap-2 mb-8">
            {EXAMPLE_ADDRESSES.map((addr) => (
              <button
                key={addr}
                onClick={() => {
                  setAddressInput(addr);
                  runQuery({ address: addr });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-slate-200 transition-colors flex items-center gap-1.5"
              >
                <MapPin className="w-3 h-3" />
                {addr}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" exit={{ opacity: 0 }}>
                <LoadingState />
              </motion.div>
            ) : error ? (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ErrorState message={error} onRetry={() => (addressInput.trim() ? runQuery({ address: addressInput.trim() }) : undefined)} />
              </motion.div>
            ) : data ? (
              <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>{data.location.address ?? `${data.location.lat.toFixed(5)}, ${data.location.lng.toFixed(5)}`}</span>
                    {data.location.confidence !== null && data.location.confidence < 70 && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                        <Info className="w-3 h-3" /> Low-confidence match
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {/* Main Score Card */}
                  <div className="md:col-span-1 p-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col items-center">
                    <ScoreRing score={data.score.value} />
                    <div className="mt-4 text-center">
                      <p className="text-xs text-slate-500">
                        {Math.round(data.score.coverage * 100)}% of the score's weight was available
                      </p>
                    </div>
                    {data.score.value === null && (
                      <div className="mt-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg text-center leading-relaxed">
                        Composite score withheld — fewer than half of the weighted components had data for this
                        address. The components below are still shown individually.
                      </div>
                    )}
                    <p className="text-xs text-slate-600 mt-3">
                      Generated {new Date(data.generatedAt).toLocaleTimeString()} · {data.tookMs}ms
                    </p>
                  </div>

                  {/* Score Breakdown */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                      <h4 className="text-sm font-bold text-white mb-4">Score Breakdown</h4>
                      <div className="space-y-2.5">
                        {data.score.components.map((component) => (
                          <ComponentRow key={component.key} component={component} />
                        ))}
                      </div>
                    </div>

                    {civicStats.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {civicStats.map((stat) => (
                          <div key={stat.label} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                            <stat.icon className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
                            <div className="text-lg font-bold text-white">{stat.count}</div>
                            <div className="text-[11px] text-slate-500">{stat.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {(departures.length > 0 || alerts.length > 0) && (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {departures.length > 0 && (
                          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                            <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                              <Bus className="w-3.5 h-3.5 text-emerald-400" /> Next departures
                            </h4>
                            <div className="space-y-2">
                              {departures.map((dep, i) => {
                                const delay = formatDelay(dep.delaySec);
                                return (
                                  <div key={`${dep.tripId ?? i}-${i}`} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 truncate pr-2">
                                      {dep.stopName}
                                      {dep.routeId ? ` · ${dep.routeId}` : ''}
                                    </span>
                                    <span className={`font-mono shrink-0 ${delay.color}`}>{delay.text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {alerts.length > 0 && (
                          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                            <h4 className="text-xs font-bold text-white mb-3 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Service alerts
                            </h4>
                            <div className="space-y-2">
                              {alerts.map((alert) => (
                                <div key={alert.id} className="text-xs p-2 rounded bg-slate-800/50">
                                  <span className="text-slate-300">{alert.header}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sources */}
                <div className="mt-6 p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Data sources</h4>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.sources.map((source) => (
                      <SourceChip key={source.meta.id} source={source} />
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <IdleState />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
