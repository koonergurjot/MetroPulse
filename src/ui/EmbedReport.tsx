import { useEffect, useState } from 'react';
import { fetchPulse } from '../api';
import type { PulseResponse } from '../server/types';

/** Compact, chrome-free block report for iframes: /embed/<slug>. */
export default function EmbedReport({ slug }: { slug: string }) {
  const [data, setData] = useState<PulseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetchPulse({ slug }).then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unavailable.'));
  }, [slug]);

  const score = data?.score.value ?? null;
  const color = score === null ? '#64748b' : score >= 75 ? '#34d399' : score >= 50 ? '#fbbf24' : '#fb7185';
  const full = `${window.location.origin}/report/${encodeURIComponent(slug)}`;

  return (
    <div className="flex h-full min-h-[200px] flex-col gap-3 bg-ink p-4 text-slate-200">
      {error && <p role="alert" className="text-[13px] text-rose-300">{error}</p>}
      {!data && !error && <div className="shimmer h-24 rounded-xl" />}
      {data && (
        <>
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[6px] text-[26px] font-semibold text-white" style={{ borderColor: color }} role="img" aria-label={score === null ? 'Score withheld' : `Pulse Score ${score} of 100`}>{score ?? '—'}</div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-slate-500">MetroPulse block report</p>
              <h1 className="truncate text-[15px] font-semibold text-white">{data.location.address ?? 'Selected location'}</h1>
              <p className="text-[12px] text-slate-400">{data.location.locality ?? 'Metro Vancouver'}</p>
            </div>
          </div>
          <ul className="space-y-1.5">
            {data.score.components.filter((c) => c.available).map((c) => (
              <li key={c.key} className="text-[12px]">
                <div className="flex justify-between"><span>{c.label}</span><span className="tnum text-slate-400">{Math.round(c.score)}</span></div>
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full" style={{ width: `${c.score}%`, background: color }} /></div>
              </li>
            ))}
          </ul>
          <a href={full} target="_top" rel="noopener" className="mt-auto text-[12px] font-medium text-emerald-300 hover:underline">Open the full report on MetroPulse →</a>
        </>
      )}
    </div>
  );
}
