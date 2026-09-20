/**
 * Spatial index over GTFS `stops.txt`.
 *
 * The realtime feed only carries `stop_id`, so turning "delays near this
 * address" into an answer needs the static stop table. Static GTFS changes
 * roughly weekly, so it is baked at build time (`npm run build:stops`) rather
 * than fetched per request — unzipping a multi-megabyte archive inside a
 * request handler is exactly the kind of thing that blows a serverless budget.
 */
import { haversineM, type BBox, bboxAround, withinBBox } from '../geo.ts';
import type { NearbyStop } from '../types.ts';

export interface GtfsStop {
  stopId: string;
  code: string | null;
  name: string;
  lat: number;
  lng: number;
}

/** Grid cell size in degrees, ~1.1 km of latitude. Cheap and good enough. */
const CELL_DEG = 0.01;

const cellKey = (lat: number, lng: number): string =>
  `${Math.floor(lat / CELL_DEG)}:${Math.floor(lng / CELL_DEG)}`;

export class StopIndex {
  readonly #byCell = new Map<string, GtfsStop[]>();
  readonly #byId = new Map<string, GtfsStop>();

  constructor(stops: Iterable<GtfsStop>) {
    for (const stop of stops) {
      this.#byId.set(stop.stopId, stop);
      const key = cellKey(stop.lat, stop.lng);
      const bucket = this.#byCell.get(key);
      if (bucket) bucket.push(stop);
      else this.#byCell.set(key, [stop]);
    }
  }

  get size(): number {
    return this.#byId.size;
  }

  get(stopId: string): GtfsStop | undefined {
    return this.#byId.get(stopId);
  }

  /** Stops within `radiusM`, nearest first, capped at `limit`. */
  near(centre: { lat: number; lng: number }, radiusM: number, limit = 12): NearbyStop[] {
    const box: BBox = bboxAround(centre, radiusM);
    const found: NearbyStop[] = [];

    const latStart = Math.floor(box.minLat / CELL_DEG);
    const latEnd = Math.floor(box.maxLat / CELL_DEG);
    const lngStart = Math.floor(box.minLng / CELL_DEG);
    const lngEnd = Math.floor(box.maxLng / CELL_DEG);

    for (let y = latStart; y <= latEnd; y++) {
      for (let x = lngStart; x <= lngEnd; x++) {
        const bucket = this.#byCell.get(`${y}:${x}`);
        if (!bucket) continue;
        for (const stop of bucket) {
          if (!withinBBox(stop, box)) continue;
          const distanceM = haversineM(centre, stop);
          if (distanceM > radiusM) continue;
          found.push({
            stopId: stop.stopId,
            code: stop.code,
            name: stop.name,
            lat: stop.lat,
            lng: stop.lng,
            distanceM: Math.round(distanceM),
          });
        }
      }
    }

    found.sort((a, b) => a.distanceM - b.distanceM);
    return found.slice(0, limit);
  }
}

/**
 * RFC 4180-ish CSV row splitter: handles quoted fields and escaped quotes,
 * which real GTFS feeds do contain (stop names with commas).
 */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

export function parseStopsCsv(csv: string): GtfsStop[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Strip a UTF-8 BOM, which transit agencies ship more often than you'd hope.
  const header = splitCsvRow(lines[0].replace(/^﻿/, '')).map((h) => h.trim());
  const col = (name: string): number => header.indexOf(name);
  const idIdx = col('stop_id');
  const latIdx = col('stop_lat');
  const lngIdx = col('stop_lon');
  if (idIdx < 0 || latIdx < 0 || lngIdx < 0) {
    throw new Error('stops.txt is missing stop_id/stop_lat/stop_lon');
  }
  const nameIdx = col('stop_name');
  const codeIdx = col('stop_code');

  // `Number('')` is 0, not NaN, so blank coordinate cells have to be rejected
  // before parsing or an unplaced stop lands in the Gulf of Guinea.
  const toCoord = (raw: string | undefined): number => {
    const trimmed = (raw ?? '').trim();
    return trimmed === '' ? Number.NaN : Number(trimmed);
  };

  const stops: GtfsStop[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = splitCsvRow(lines[i]);
    const lat = toCoord(row[latIdx]);
    const lng = toCoord(row[lngIdx]);
    const stopId = (row[idIdx] ?? '').trim();
    if (!stopId || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    stops.push({
      stopId,
      lat,
      lng,
      name: (nameIdx >= 0 ? row[nameIdx] : '')?.trim() || stopId,
      code: (codeIdx >= 0 ? row[codeIdx] : '')?.trim() || null,
    });
  }
  return stops;
}
