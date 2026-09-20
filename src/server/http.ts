/**
 * Fetch wrapper with per-request timeouts, jittered retries and typed failures.
 *
 * Every upstream call in this service goes through here. Public open-data
 * endpoints are generous but not fast, and several are rate limited, so the
 * defaults are deliberately conservative.
 */

export class UpstreamError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;
  constructor(message: string, status: number | null, retryable: boolean) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
    this.retryable = retryable;
  }
}

export interface FetchPolicy {
  timeoutMs?: number;
  /** Number of *additional* attempts after the first. */
  retries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const DEFAULTS = {
  timeoutMs: 4_000,
  retries: 2,
  baseBackoffMs: 150,
  maxBackoffMs: 2_000,
} as const;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function combineSignals(signals: AbortSignal[]): AbortSignal {
  const usable = signals.filter(Boolean);
  if (usable.length === 1) return usable[0];
  // AbortSignal.any is available on Node 20+, Deno, Bun and modern workers.
  const anyFn = (AbortSignal as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === 'function') return anyFn(usable);
  const controller = new AbortController();
  for (const s of usable) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

/** Full-jitter exponential backoff (AWS architecture blog flavour). */
function backoffMs(attempt: number, base: number, max: number): number {
  const ceiling = Math.min(max, base * 2 ** attempt);
  return Math.random() * ceiling;
}

function retryAfterMs(res: Response): number | null {
  const header = res.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

export async function fetchWithPolicy(url: string, policy: FetchPolicy = {}): Promise<Response> {
  const { timeoutMs, retries, baseBackoffMs, maxBackoffMs } = { ...DEFAULTS, ...policy };
  let lastError: UpstreamError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const timer = new AbortController();
    const timeoutId = setTimeout(() => timer.abort(new Error('timeout')), timeoutMs);
    const signal = policy.signal ? combineSignals([timer.signal, policy.signal]) : timer.signal;

    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', ...policy.headers },
        signal,
        redirect: 'follow',
      });

      if (res.ok) return res;

      const retryable = RETRYABLE_STATUS.has(res.status);
      lastError = new UpstreamError(`upstream responded ${res.status}`, res.status, retryable);
      // Drain the body so the connection can be reused.
      await res.arrayBuffer().catch(() => undefined);
      if (!retryable || attempt === retries) throw lastError;
      await sleep(retryAfterMs(res) ?? backoffMs(attempt, baseBackoffMs, maxBackoffMs));
    } catch (err) {
      if (err instanceof UpstreamError) {
        if (!err.retryable || attempt === retries) throw err;
        continue;
      }
      // The caller aborted us deliberately: do not burn retries on it.
      if (policy.signal?.aborted) throw new UpstreamError('request cancelled', null, false);
      lastError = new UpstreamError(
        err instanceof Error && err.message === 'timeout' ? 'upstream timed out' : 'network error',
        null,
        true,
      );
      if (attempt === retries) throw lastError;
      await sleep(backoffMs(attempt, baseBackoffMs, maxBackoffMs));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new UpstreamError('request failed', null, false);
}

export async function fetchJson<T>(url: string, policy: FetchPolicy = {}): Promise<T> {
  const res = await fetchWithPolicy(url, policy);
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError('upstream returned malformed JSON', res.status, false);
  }
}

export async function fetchBinary(url: string, policy: FetchPolicy = {}): Promise<Uint8Array> {
  const res = await fetchWithPolicy(url, {
    ...policy,
    headers: { accept: 'application/octet-stream', ...policy.headers },
  });
  return new Uint8Array(await res.arrayBuffer());
}

export async function fetchText(url: string, policy: FetchPolicy = {}): Promise<string> {
  const res = await fetchWithPolicy(url, { ...policy, headers: { accept: 'text/plain', ...policy.headers } });
  return await res.text();
}
