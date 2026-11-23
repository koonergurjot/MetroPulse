import { useCallback, useRef, useState } from 'react';
import { ApiError, fetchPulse } from '../api';
import type { PortfolioInput } from './csv';

export interface PortfolioResult {
  name: string;
  address: string;
  status: 'pending' | 'running' | 'done' | 'error';
  score: number | null;
  locality: string | null;
  lng?: number;
  lat?: number;
  weakest?: string;
  error?: string;
}

const SPACING_MS = 2100; // stays under the 30 req/min per-IP limit
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Runs block reports for a list of addresses one at a time, politely. */
export function usePortfolio() {
  const [results, setResults] = useState<PortfolioResult[]>([]);
  const [running, setRunning] = useState(false);
  const cancel = useRef(false);

  const patch = (i: number, p: Partial<PortfolioResult>) => setResults((cur) => cur.map((r, k) => (k === i ? { ...r, ...p } : r)));

  const run = useCallback(async (rows: PortfolioInput[]) => {
    cancel.current = false;
    setRunning(true);
    setResults(rows.map((r) => ({ name: r.name, address: r.address, status: 'pending', score: null, locality: null })));
    for (let i = 0; i < rows.length; i++) {
      if (cancel.current) break;
      patch(i, { status: 'running' });
      let attempts = 0;
      for (;;) {
        try {
          const r = await fetchPulse({ address: rows[i].address });
          const weakest = r.score.components.filter((c) => c.available).sort((a, b) => a.score - b.score)[0];
          patch(i, { status: 'done', score: r.score.value, locality: r.location.locality, lng: r.location.lng, lat: r.location.lat, weakest: weakest?.label });
          break;
        } catch (e) {
          if (e instanceof ApiError && e.status === 429 && attempts++ < 2 && !cancel.current) {
            await sleep(((e.retryAfterSec ?? 10) + 1) * 1000);
            continue;
          }
          patch(i, { status: 'error', error: e instanceof Error ? e.message : 'Failed.' });
          break;
        }
      }
      if (i < rows.length - 1) await sleep(SPACING_MS);
    }
    setRunning(false);
  }, []);

  return { results, running, run, stop: () => { cancel.current = true; }, clear: () => setResults([]) };
}
