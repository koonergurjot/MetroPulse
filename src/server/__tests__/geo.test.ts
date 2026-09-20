import { describe, expect, it } from 'vitest';
import { bboxAround, haversineM, isValidLatLng, METRO_VANCOUVER_BBOX, withinBBox } from '../geo.ts';

describe('geo', () => {
  it('measures a known Metro Vancouver distance', () => {
    // Waterfront Station to Metrotown Station is roughly 10 km as the crow flies.
    const waterfront = { lat: 49.2859, lng: -123.1118 };
    const metrotown = { lat: 49.2262, lng: -123.0038 };
    const d = haversineM(waterfront, metrotown);
    expect(d).toBeGreaterThan(9_000);
    expect(d).toBeLessThan(11_500);
  });

  it('returns zero for identical points', () => {
    expect(haversineM({ lat: 49.28, lng: -123.12 }, { lat: 49.28, lng: -123.12 })).toBe(0);
  });

  it('builds a bbox that contains the radius in both axes', () => {
    const centre = { lat: 49.2827, lng: -123.1207 };
    const box = bboxAround(centre, 800);
    expect(withinBBox(centre, box)).toBe(true);
    // A point 700 m due north must be inside; 900 m due north must not be.
    const north700 = { lat: centre.lat + 700 / 111_320, lng: centre.lng };
    const north900 = { lat: centre.lat + 900 / 111_320, lng: centre.lng };
    expect(withinBBox(north700, box)).toBe(true);
    expect(withinBBox(north900, box)).toBe(false);
  });

  it('widens longitude span with latitude', () => {
    const near = bboxAround({ lat: 0, lng: 0 }, 1000);
    const far = bboxAround({ lat: 60, lng: 0 }, 1000);
    expect(far.maxLng - far.minLng).toBeGreaterThan(near.maxLng - near.minLng);
  });

  it('validates coordinates', () => {
    expect(isValidLatLng({ lat: 49.2, lng: -123.1 })).toBe(true);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: 49.2 })).toBe(false);
  });

  it('bounds the service area to Metro Vancouver', () => {
    expect(withinBBox({ lat: 49.1913, lng: -122.8490 }, METRO_VANCOUVER_BBOX)).toBe(true);
    expect(withinBBox({ lat: 48.4284, lng: -123.3656 }, METRO_VANCOUVER_BBOX)).toBe(false); // Victoria
    expect(withinBBox({ lat: 43.6532, lng: -79.3832 }, METRO_VANCOUVER_BBOX)).toBe(false); // Toronto
  });
});
