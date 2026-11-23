import { describe, expect, it, vi } from 'vitest';
import { SUPABASE_CONFLICT_COLUMNS, SupabaseSink } from '../snapshot/sinks.ts';
import type { DelayObservation } from '../snapshot/types.ts';

const obs = (n: number): DelayObservation => ({
  stopId: `S${n}`,
  routeId: '99',
  tripId: `T${n}`,
  scheduledTime: '2026-01-01T00:00:00.000Z',
  predictedTime: '2026-01-01T00:02:00.000Z',
  delaySec: 120,
  observedAt: '2026-01-01T00:00:30.000Z',
});

function fakeClient(error: { message: string } | null = null) {
  const upsert = vi.fn(async () => ({ error }));
  const from = vi.fn(() => ({ upsert }));
  return { client: { from } as never, from, upsert };
}

describe('SupabaseSink', () => {
  it('upserts into delay_observations and ignores duplicate predictions', async () => {
    const { client, from, upsert } = fakeClient();
    await new SupabaseSink('https://x.test', 'key', client).write([obs(1)]);

    expect(from).toHaveBeenCalledWith('delay_observations');
    expect(upsert).toHaveBeenCalledWith(
      [expect.objectContaining({ stop_id: 'S1', trip_id: 'T1', delay_sec: 120 })],
      { onConflict: SUPABASE_CONFLICT_COLUMNS, ignoreDuplicates: true },
    );
  });

  it('chunks large writes so one bad row cannot sink a whole poll', async () => {
    const { client, upsert } = fakeClient();
    await new SupabaseSink('https://x.test', 'key', client).write(Array.from({ length: 1001 }, (_, i) => obs(i)));
    expect(upsert).toHaveBeenCalledTimes(3);
  });

  it('surfaces a Supabase error', async () => {
    const { client } = fakeClient({ message: 'boom' });
    await expect(new SupabaseSink('https://x.test', 'key', client).write([obs(1)])).rejects.toThrow(/boom/);
  });

  it('matches the unique index declared in schema.sql', async () => {
    const { readFile } = await import('node:fs/promises');
    const sql = await readFile(new URL('../../../supabase/schema.sql', import.meta.url), 'utf8');
    expect(sql).toContain('(trip_id, stop_id, predicted_time)');
    expect(SUPABASE_CONFLICT_COLUMNS).toBe('trip_id,stop_id,predicted_time');
    expect(sql).toMatch(/enable row level security/i);
  });
});
