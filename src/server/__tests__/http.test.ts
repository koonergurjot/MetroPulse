import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchWithPolicy, UpstreamError } from '../http.ts';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('fetchWithPolicy', () => {
  it('returns the first successful response', async () => {
    const fetchMock = vi.fn(async () => ok({ hello: 'world' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchJson<{ hello: string }>('https://example.test/x')).resolves.toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 503 and succeeds', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(ok({ ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchJson('https://example.test/x', { baseBackoffMs: 1, maxBackoffMs: 2 }),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchWithPolicy('https://example.test/x', { baseBackoffMs: 1 })).rejects.toBeInstanceOf(
      UpstreamError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget and reports the status', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 500 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchWithPolicy('https://example.test/x', { retries: 2, baseBackoffMs: 1, maxBackoffMs: 2 }),
    ).rejects.toMatchObject({ status: 500, retryable: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('honours a numeric Retry-After header', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(ok({ ok: true }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchJson('https://example.test/x', { baseBackoffMs: 1 })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('times out a hanging upstream', async () => {
    globalThis.fetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('timeout')));
      })) as unknown as typeof fetch;

    await expect(
      fetchWithPolicy('https://example.test/slow', { timeoutMs: 10, retries: 0 }),
    ).rejects.toMatchObject({ message: 'upstream timed out' });
  });

  it('stops immediately when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = fetchWithPolicy('https://example.test/x', {
      signal: controller.signal,
      retries: 3,
      baseBackoffMs: 1,
    });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ message: 'request cancelled' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces malformed JSON as an upstream error', async () => {
    globalThis.fetch = (async () =>
      new Response('not json', { status: 200 })) as unknown as typeof fetch;

    await expect(fetchJson('https://example.test/x')).rejects.toMatchObject({
      message: 'upstream returned malformed JSON',
    });
  });
});
