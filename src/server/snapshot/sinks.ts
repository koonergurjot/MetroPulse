/**
 * Two sinks behind one interface, so the snapshot job runs the same way in
 * CI and on a laptop with no Supabase project configured.
 */
import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.ts';
import type { DelayObservation, SnapshotSink } from './types.ts';

/** Supabase accepts large payloads, but chunking keeps a bad row from failing a whole poll. */
const SUPABASE_CHUNK_SIZE = 500;

function toRow(observation: DelayObservation): Record<string, unknown> {
  return {
    stop_id: observation.stopId,
    route_id: observation.routeId,
    trip_id: observation.tripId,
    scheduled_time: observation.scheduledTime,
    predicted_time: observation.predictedTime,
    delay_sec: observation.delaySec,
    observed_at: observation.observedAt,
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export class SupabaseSink implements SnapshotSink {
  readonly name = 'supabase';
  // No generated Database type for this project, so the client is untyped:
  // https://supabase.com/docs/reference/javascript/typescript-support
  private readonly client: SupabaseClient<any, any, any>;

  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey);
  }

  async write(rows: DelayObservation[]): Promise<void> {
    for (const batch of chunk(rows, SUPABASE_CHUNK_SIZE)) {
      const { error } = await this.client.from('delay_observations').insert(batch.map(toRow));
      if (error) throw new Error(`supabase insert failed: ${error.message}`);
    }
  }
}

export class JsonlSink implements SnapshotSink {
  readonly name = 'jsonl';
  private readonly outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async write(rows: DelayObservation[]): Promise<void> {
    if (rows.length === 0) return;
    await mkdir(this.outputDir, { recursive: true });
    // One file per UTC day keeps individual files bounded without scattering
    // a five-minute cron across thousands of tiny files.
    const day = rows[0].observedAt.slice(0, 10);
    const file = path.join(this.outputDir, `${day}.jsonl`);
    const body = rows.map((row) => JSON.stringify(row)).join('\n') + '\n';
    await appendFile(file, body, 'utf8');
  }
}

export function createSink(): SnapshotSink {
  if (config.supabase.url && config.supabase.serviceKey) {
    return new SupabaseSink(config.supabase.url, config.supabase.serviceKey);
  }
  return new JsonlSink(config.snapshot.outputDir);
}
