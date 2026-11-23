/**
 * Custom dark cartographic style over OpenFreeMap's OpenMapTiles vector tiles
 * (free, no key, commercial use allowed; attribution required, see
 * `MAP_ATTRIBUTION`). Self-hosting a Protomaps PMTiles extract on R2 is the
 * production upgrade path; the style layers here are schema-compatible.
 */
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';

export const MAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

export const COLORS = {
  bg: '#080d17',
  land: '#0b1220',
  landAlt: '#0d1526',
  water: '#050b16',
  park: '#0e2a25',
  wood: '#0c2420',
  road: '#1b2638',
  roadMajor: '#2a3a55',
  roadHighway: '#3b4f72',
  label: '#8fa3c4',
  labelDim: '#5d7090',
  halo: '#080d17',
  accent: '#34d399',
  transit: '#22d3ee',
  deal: '#fbbf24',
  permit: '#a78bfa',
  request: '#fb923c',
  rental: '#f472b6',
  road_event: '#f87171',
} as const;

const SANS = ['Noto Sans Regular'];
const SANS_BOLD = ['Noto Sans Bold'];
const SANS_ITALIC = ['Noto Sans Italic'];

const roadWidth = (base: number) =>
  ['interpolate', ['exponential', 1.6], ['zoom'], 8, base * 0.25, 12, base * 0.8, 16, base * 3.4, 19, base * 9] as unknown as number;

const layers: LayerSpecification[] = [
  { id: 'background', type: 'background', paint: { 'background-color': COLORS.bg } },
  {
    id: 'landuse',
    type: 'fill',
    source: 'omt',
    'source-layer': 'landuse',
    filter: ['in', 'class', 'residential', 'suburb', 'neighbourhood', 'commercial', 'retail', 'industrial'],
    paint: {
      'fill-color': [
        'match', ['get', 'class'],
        'industrial', '#0c1119',
        'commercial', '#0f182a',
        'retail', '#0f182a',
        COLORS.landAlt,
      ],
      'fill-opacity': 0.9,
    },
  },
  {
    id: 'landcover',
    type: 'fill',
    source: 'omt',
    'source-layer': 'landcover',
    paint: {
      'fill-color': ['match', ['get', 'class'], 'wood', COLORS.wood, 'grass', COLORS.park, COLORS.land],
      'fill-opacity': 0.75,
    },
  },
  {
    id: 'park',
    type: 'fill',
    source: 'omt',
    'source-layer': 'park',
    paint: { 'fill-color': COLORS.park, 'fill-opacity': 0.85 },
  },
  { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': COLORS.water } },
  {
    id: 'waterway',
    type: 'line',
    source: 'omt',
    'source-layer': 'waterway',
    paint: { 'line-color': COLORS.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 16, 3] },
  },
  {
    id: 'boundary',
    type: 'line',
    source: 'omt',
    'source-layer': 'boundary',
    filter: ['all', ['<=', 'admin_level', 8], ['!=', 'maritime', 1]],
    paint: {
      'line-color': '#3a4a6a',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 1.2],
      'line-dasharray': [3, 2],
      'line-opacity': 0.6,
    },
  },
  {
    id: 'road-minor',
    type: 'line',
    source: 'omt',
    'source-layer': 'transportation',
    minzoom: 12,
    filter: ['all', ['in', 'class', 'minor', 'service', 'track', 'tertiary'], ['!=', 'brunnel', 'tunnel']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLORS.road, 'line-width': roadWidth(0.9) },
  },
  {
    id: 'road-secondary',
    type: 'line',
    source: 'omt',
    'source-layer': 'transportation',
    minzoom: 9,
    filter: ['all', ['in', 'class', 'secondary', 'primary'], ['!=', 'brunnel', 'tunnel']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLORS.roadMajor, 'line-width': roadWidth(1.5) },
  },
  {
    id: 'road-highway',
    type: 'line',
    source: 'omt',
    'source-layer': 'transportation',
    minzoom: 6,
    filter: ['all', ['in', 'class', 'trunk', 'motorway'], ['!=', 'brunnel', 'tunnel']],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': COLORS.roadHighway, 'line-width': roadWidth(2.2) },
  },
  {
    id: 'rapid-transit',
    type: 'line',
    source: 'omt',
    'source-layer': 'transportation',
    minzoom: 9,
    filter: ['in', 'class', 'transit', 'rail'],
    paint: {
      'line-color': COLORS.transit,
      'line-opacity': 0.55,
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 16, 3],
      'line-dasharray': [2, 1.2],
    },
  },
  {
    id: 'building-flat',
    type: 'fill',
    source: 'omt',
    'source-layer': 'building',
    minzoom: 13,
    maxzoom: 15,
    paint: { 'fill-color': '#16213a', 'fill-opacity': 0.8 },
  },
  {
    id: 'building-3d',
    type: 'fill-extrusion',
    source: 'omt',
    'source-layer': 'building',
    minzoom: 14.5,
    paint: {
      'fill-extrusion-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8],
        0, '#18233b', 30, '#223152', 90, '#2e4470', 180, '#3f5b92',
      ],
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.2, 0.92],
      'fill-extrusion-vertical-gradient': true,
    },
  },
  {
    id: 'road-label',
    type: 'symbol',
    source: 'omt',
    'source-layer': 'transportation_name',
    minzoom: 14,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': SANS,
      'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 13],
      'text-letter-spacing': 0.04,
    },
    paint: { 'text-color': COLORS.labelDim, 'text-halo-color': COLORS.halo, 'text-halo-width': 1.4 },
  },
  {
    id: 'water-label',
    type: 'symbol',
    source: 'omt',
    'source-layer': 'water_name',
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': SANS_ITALIC,
      'text-size': 12,
      'text-letter-spacing': 0.1,
    },
    paint: { 'text-color': '#3b5f8f', 'text-halo-color': COLORS.halo, 'text-halo-width': 1 },
  },
  {
    id: 'place-neighbourhood',
    type: 'symbol',
    source: 'omt',
    'source-layer': 'place',
    minzoom: 12.5,
    filter: ['in', 'class', 'suburb', 'neighbourhood', 'quarter'],
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': SANS_BOLD,
      'text-size': ['interpolate', ['linear'], ['zoom'], 12.5, 10, 16, 14],
      'text-transform': 'uppercase',
      'text-letter-spacing': 0.12,
      'text-max-width': 8,
    },
    paint: { 'text-color': COLORS.label, 'text-halo-color': COLORS.halo, 'text-halo-width': 1.6, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 13.5, 0.9] },
  },
  {
    id: 'place-city',
    type: 'symbol',
    source: 'omt',
    'source-layer': 'place',
    filter: ['in', 'class', 'city', 'town', 'village'],
    layout: {
      'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
      'text-font': SANS_BOLD,
      'text-size': ['interpolate', ['linear'], ['zoom'], 6, 11, 11, 17, 14, 20],
      'text-max-width': 8,
    },
    paint: { 'text-color': '#c4d2ec', 'text-halo-color': COLORS.halo, 'text-halo-width': 1.8 },
  },
];

export const mapStyle: StyleSpecification = {
  version: 8,
  name: 'MetroPulse Night',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: MAP_ATTRIBUTION },
  },
  layers,
};
