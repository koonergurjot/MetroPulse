/**
 * Planned SkyTrain extensions, drawn as schematic overlays.
 *
 * IMPORTANT: coordinates are approximate and hand-placed for orientation, not
 * surveyed alignments. Service dates are provincial targets as of Nov 2026 and
 * have slipped before. Replace with TransLink/BC Transit Projects GIS data
 * (check its licence) before presenting this as authoritative.
 */
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

interface Station {
  name: string;
  lng: number;
  lat: number;
}

const broadway: Station[] = [
  { name: 'VCC–Clark (existing)', lng: -123.0786, lat: 49.2658 },
  { name: 'Great Northern Way–Emily Carr', lng: -123.0912, lat: 49.2663 },
  { name: 'Mount Pleasant', lng: -123.1005, lat: 49.2625 },
  { name: 'Broadway–City Hall (existing)', lng: -123.1147, lat: 49.2627 },
  { name: 'Oak–VGH', lng: -123.1268, lat: 49.2627 },
  { name: 'South Granville', lng: -123.1385, lat: 49.2637 },
  { name: 'Arbutus', lng: -123.1553, lat: 49.2637 },
];

const surreyLangley: Station[] = [
  { name: 'King George (existing)', lng: -122.8447, lat: 49.1829 },
  { name: 'Langley Centre (approx.)', lng: -122.6603, lat: 49.1044 },
];

const line = (id: string, name: string, stations: Station[], status: string): Feature<LineString> => ({
  type: 'Feature',
  properties: { id, name, status },
  geometry: { type: 'LineString', coordinates: stations.map((s) => [s.lng, s.lat]) },
});

const points = (lineId: string, stations: Station[]): Array<Feature<Point>> =>
  stations.map((s) => ({
    type: 'Feature',
    properties: { name: s.name, line: lineId },
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
  }));

export const PLANNED_LINES: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [
    line('broadway', 'Broadway Subway', broadway, 'Targeted for late 2027'),
    line('surrey-langley', 'Surrey–Langley SkyTrain (schematic corridor)', surreyLangley, 'Targeted for late 2029'),
  ],
};

export const PLANNED_STATIONS: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [...points('broadway', broadway), ...points('surrey-langley', surreyLangley)],
};

export const PLANNED_NOTE =
  'Schematic only. Station positions are approximate and service dates are government targets that may change.';
