import { Download, Play, Square, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MAX_PORTFOLIO_ROWS, parsePortfolioInput, toCsv } from '../portfolio/csv';
import type { PortfolioResult } from '../portfolio/usePortfolio';

const band = (s: number | null): string => (s === null ? 'text-slate-500' : s >= 75 ? 'text-emerald-300' : s >= 50 ? 'text-amber-300' : 'text-rose-300');

export default function PortfolioDialog({
  open,
  onClose,
  results,
  running,
  onRun,
  onStop,
  onShow,
}: {
  open: boolean;
  onClose: () => void;
  results: PortfolioResult[];
  running: boolean;
  onRun: (rows: Array<{ name: string; address: string }>) => void;
  onStop: () => void;
  onShow: () => void;
}) {
  const [text, setText] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const start = () => {
    const { rows, warnings: w } = parsePortfolioInput(text);
    setWarnings(w);
    if (rows.length > 0) onRun(rows);
  };

  const exportCsv = () => {
    const csv = toCsv(['name', 'address', 'municipality', 'pulse_score', 'weakest_factor', 'status'], results.map((r) => [r.name, r.address, r.locality, r.score, r.weakest, r.status === 'error' ? r.error : r.status]));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'metropulse-portfolio.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const done = results.filter((r) => r.status === 'done' || r.status === 'error').length;

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="pf-title" className="glass m-auto w-[min(720px,calc(100vw-24px))] rounded-3xl p-0 text-slate-200 backdrop:bg-black/60">
      <div className="max-h-[85vh] space-y-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pf-title" className="text-[18px] font-semibold text-white">Portfolio check</h2>
            <p className="mt-1 text-[13px] text-slate-400">Paste or upload up to {MAX_PORTFOLIO_ROWS} addresses (one per line, or a CSV with an “address” column). Each gets a block report and score. Built for landlords, property managers, retailers and lenders comparing sites.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 hover:bg-white/5"><X className="h-5 w-5" /></button>
        </div>

        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={'address,name\n1055 W Georgia St, Vancouver,Office\n13450 102 Ave, Surrey,Site B'} aria-label="Addresses" className="w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[12px] text-slate-200 placeholder:text-slate-600" />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-[13px] hover:bg-white/5">
            <Upload className="h-4 w-4" aria-hidden /> Upload CSV
            <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f && f.size < 500_000) setText(await f.text()); e.target.value = ''; }} />
          </label>
          {running ? (
            <button type="button" onClick={onStop} className="inline-flex items-center gap-2 rounded-xl bg-rose-400 px-4 py-2 text-[13px] font-semibold text-rose-950"><Square className="h-4 w-4" aria-hidden /> Stop</button>
          ) : (
            <button type="button" onClick={start} disabled={!text.trim()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-[13px] font-semibold text-emerald-950 disabled:opacity-40"><Play className="h-4 w-4" aria-hidden /> Run reports</button>
          )}
          {results.length > 0 && (
            <>
              <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-[13px] hover:bg-white/5"><Download className="h-4 w-4" aria-hidden /> Export CSV</button>
              <button type="button" onClick={() => { onShow(); onClose(); }} className="rounded-xl border border-white/12 px-3 py-2 text-[13px] hover:bg-white/5">Show on map</button>
            </>
          )}
        </div>
        {warnings.map((w) => <p key={w} className="text-[12px] text-amber-300">{w}</p>)}

        {results.length > 0 && (
          <div aria-live="polite">
            <p className="mb-2 text-[12px] text-slate-400">{done} of {results.length} complete{running && ' (about 2 seconds each, to respect rate limits)'}</p>
            <table className="w-full text-left text-[12px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="py-1">Site</th><th>Area</th><th className="pr-2 text-right">Score</th><th className="pl-3">Weakest</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-t border-white/[0.06]">
                    <td className="max-w-[200px] truncate py-1.5 pr-2" title={r.address}>{r.name}</td>
                    <td className="text-slate-400">{r.locality ?? '—'}</td>
                    <td className={`tnum pr-2 text-right font-semibold ${band(r.score)}`} title={r.status === "done" && r.score === null ? "Score withheld: too few data sources responded" : undefined}>{r.status === 'done' ? r.score ?? 'n/a' : r.status === 'error' ? '!' : '…'}</td>
                    <td className="pl-3 text-slate-400">{r.status === 'error' ? <span className="text-rose-300">{r.error}</span> : r.weakest ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </dialog>
  );
}
