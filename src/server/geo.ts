import type { LatLng } from './types.ts';

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in metres. Accurate to well under a metre at city scale. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/**
 * Square bounding box around a point. Used as a cheap prefilter before the
 * exact haversine pass, and to build `bbox=` query params for upstream APIs.
 */
export function bboxAround(centre: LatLng, radiusM: number): BBox {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  // Guard the cosine so a point near the poles cannot produce an infinite span.
  const cos = Math.max(Math.cos(toRad(centre.lat)), 1e-6);
  const dLng = dLat / cos;
  return {
    minLat: centre.lat - dLat,
    minLng: centre.lng - dLng,
    maxLat: centre.lat + dLat,
    maxLng: centre.lng + dLng,
  };
}

export function withinBBox(p: LatLng, box: BBox): boolean {
  return p.lat >= box.minLat && p.lat <= box.maxLat && p.lng >= box.minLng && p.lng <= box.maxLng;
}

export function isValidLatLng(p: Partial<LatLng>): p is LatLng {
  return (
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/** Rough Metro Vancouver envelope. Requests outside it are rejected early. */
export const METRO_VANCOUVER_BBOX: BBox = {
  minLat: 48.9,
  minLng: -123.6,
  maxLat: 49.6,
  maxLng: -121.9,
};
