import { AlertTriangle, ArrowLeft, Bus, Check, CheckCircle2, Clock, Copy, MinusCircle, Share2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { CivicRecord, PulseResponse, ScoreComponent, SourceResult, SourceStatus } from '../server/types';

type SourceCard = Omit<SourceResult<unknown>, 'data'>;

const formatAge = (ms: number): string => {
  if (ms < 1000) return 'just now';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
};

const STATUS: Record<SourceStatus, { icon: typeof CheckCircle2; label: string; cls: string }> = {
  ok: { icon: CheckCircle2, label: 'Live', cls: 'text-emerald-400' },
  stale: { icon: Clock, label: 'Cached', cls: 'text-amber-400' },
  error: { icon: XCircle, label: 'Unavailable', cls: 'text-rose-400' },
  skipped: { icon: MinusCircle, label: 'Skipped', cls: 'text-slate-500' },
};

function sourceMessage(s: SourceCard): string {
  if (s.status === 'error' || s.status === 'skipped') return s.error ?? 'Unavailable.';
  if (s.status === 'stale') return `Showing cached data, ${formatAge(s.ageMs)}.`;
  return `Updated ${formatAge(s.ageMs)}.`;
}

function ScoreRing({ score }: { score: number | null }) {
  const size = 124;
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const color = score === null ? '#475569' : score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#fb7185';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={score === null ? 'Pulse Score withheld' : `Pulse Score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#17233a" strokeWidth="9" />
        {score !== null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 8px ${color}88)` }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[32px] font-semibold leading-none text-white">{score ?? '—'}</span>
        <span className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">Pulse</span>
      </div>
    </div>
  );
}

function Component({ c }: { c: ScoreComponent }) {
  const color = !c.available ? 'bg-slate-700' : c.score >= 75 ? 'bg-emerald-400' : c.score >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 ${c.available ? '' : 'opacity-60'}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-slate-100">{c.label}</span>
        <span className="tnum text-[12px] text-slate-400">{c.available ? c.score : 'N/A'}<span className="text-slate-600"> · {Math.round(c.weight * 100)}%</span></span>
      </div>
      <div className="my-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${c.available ? c.score : 0}%`, transition: 'width .7s ease-out' }} />
      </div>
      <p className="text-[12px] leading-snug text-slate-400">{c.reason}</p>
    </div>
  );
}

function Civic({ label, dot, records, source }: { label: string; dot: string; records: CivicRecord[]; source?: SourceCard }) {
  const ok = source?.status === 'ok' || source?.status === 'stale';
  return (
    <details className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-medium text-slate-100">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
        {label}
        <span className="ml-auto text-[12px] font-normal text-slate-400">{ok ? `${records.length}${source?.status === 'stale' ? ' · cached' : ''}` : 'Unavailable'}</span>
      </summary>
      <div className="mt-3 space-y-3 text-[12px] text-slate-400">
        {source && <p>{sourceMessage(source)}</p>}
        {ok && records.length === 0 && <p>No matching records returned by this source.</p>}
        {ok && records.map((r, i) => (
          <article key={`${r.id}-${i}`} className="border-t border-white/[0.06] pt-2.5">
            <p className="font-medium text-slate-200">{r.title}</p>
            {r.detail && <p className="mt-0.5">{r.detail}</p>}
            <p className="tnum mt-0.5 text-slate-500">{r.distanceM} m · {r.date ?? 'date not provided'}</p>
          </article>
        ))}
      </div>
    </details>
  );
}

export default function ReportPanel({
  data,
  loading,
  error,
  onBack,
  onRetry,
}: {
  data: PulseResponse | null;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3 p-4" aria-busy="true" aria-live="polite">
        <div className="shimmer h-32 rounded-2xl" />
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
        <p className="text-center text-[12px] text-slate-500">Querying TransLink, DriveBC and municipal open data…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-rose-400" aria-hidden />
        <p className="text-[14px] text-slate-200">{error}</p>
        <button type="button" onClick={onRetry} className="rounded-lg border border-white/15 px-4 py-2 text-[13px] text-white hover:bg-white/5">Try again</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-8 text-center text-[13px] leading-relaxed text-slate-400">
        Search an address, open a listing’s block report, or switch on <span className="text-white">Drop pin</span> and click the map to investigate any block.
      </div>
    );
  }

  const title = data.location.address ?? `${data.location.lat.toFixed(4)}, ${data.location.lng.toFixed(4)}`;
  const shareUrl = data.location.slug ? `${window.location.origin}/report/${data.location.slug}` : null;
  const src = (id: string) => data.sources.find((s) => s.meta.id === id);
  const civicSrc = (suffix: string) => data.sources.find((s) => s.meta.id.endsWith(suffix));

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable: leave the button unconfirmed */
    }
  };

  return (
    <div className="rise space-y-4 p-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to homes
      </button>

      <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-emerald-400/[0.07] to-transparent p-4">
        <ScoreRing score={data.score.value} />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-slate-500">Block report</p>
          <h2 className="mt-1 text-[16px] font-semibold leading-snug text-white">{title}</h2>
          <p className="mt-1 text-[12px] text-slate-400">
            {data.location.locality ?? 'Municipality unknown'} · within {data.radiusM} m
            {data.location.confidence !== null && data.location.confidence < 70 && <span className="text-amber-300"> · low match confidence</span>}
          </p>
          {data.score.value === null && <p className="mt-2 text-[12px] text-amber-300">Score withheld: not enough sources responded.</p>}
        </div>
      </div>

      {shareUrl && (
        <div className="flex gap-2">
          <button type="button" onClick={copy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/12 px-3 py-2.5 text-[13px] text-slate-200 hover:bg-white/5">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />} {copied ? 'Link copied' : 'Copy report link'}
          </button>
          {typeof navigator.share === 'function' && (
            <button type="button" aria-label="Share" onClick={() => navigator.share({ title: `MetroPulse: ${title}`, url: shareUrl }).catch(() => undefined)} className="rounded-xl border border-white/12 px-3 text-slate-200 hover:bg-white/5"><Share2 className="h-4 w-4" /></button>
          )}
        </div>
      )}

      <section className="space-y-2" aria-label="Score breakdown">
        <h3 className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">Why this score</h3>
        {data.score.components.map((c) => <Component key={c.key} c={c} />)}
        <p className="text-[11px] leading-snug text-slate-500">Experimental summary of available signals, not a guarantee about an address. Predictions are current, not historical reliability.</p>
      </section>

      <section className="space-y-2" aria-label="Transit">
        <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-slate-500"><Bus className="h-3.5 w-3.5" aria-hidden /> Transit nearby</h3>
        {data.transit && data.transit.stops.length > 0 ? (
          <div className="space-y-1.5">
            {data.transit.stops.slice(0, 5).map((s) => (
              <div key={s.stopId} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px]">
                <span className="truncate text-slate-200">{s.name}</span>
                <span className="tnum ml-3 shrink-0 text-slate-500">{s.distanceM} m</span>
              </div>
            ))}
            {data.transit.alerts.length > 0 && <p className="text-[12px] text-amber-300">{data.transit.alerts.length} active service alert(s) nearby.</p>}
          </div>
        ) : (
          <p className="text-[12px] text-slate-500">No stops matched. {data.sources.find((s) => s.meta.id.startsWith('translink'))?.error ?? 'The stop index may be a placeholder in this environment.'}</p>
        )}
      </section>

      <section className="space-y-2" aria-label="What is happening nearby">
        <h3 className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">What’s happening nearby</h3>
        <Civic label="Building permits" dot="#a78bfa" records={data.civic.permits} source={civicSrc('permits')} />
        <Civic label="311 service requests" dot="#fb923c" records={data.civic.serviceRequests} source={civicSrc('311')} />
        <Civic label="Rental standards" dot="#f472b6" records={data.civic.rentalIssues} source={civicSrc('rental')} />
        <Civic label="Road events (DriveBC)" dot="#f87171" records={data.civic.roadEvents} source={src('drivebc.open511')} />
        <p className="text-[11px] leading-snug text-slate-500">A permit is a clue to investigate, not proof of active construction. Nearby rental issues don’t establish a violation at a specific building.</p>
      </section>

      <section className="space-y-2" aria-label="Sources">
        <h3 className="text-[12px] font-semibold uppercase tracking-widest text-slate-500">Sources</h3>
        {data.sources.map((s) => {
          const st = STATUS[s.status];
          const Icon = st.icon;
          return (
            <div key={s.meta.id} className="rounded-lg border border-white/[0.05] px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-slate-200">{s.meta.label}</span>
                <span className={`inline-flex shrink-0 items-center gap-1 ${st.cls}`}><Icon className="h-3 w-3" aria-hidden />{st.label}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">{sourceMessage(s)}</p>
              <p className="mt-1 border-t border-white/[0.05] pt-1 text-[10px] leading-snug text-slate-600">{s.meta.attribution}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
