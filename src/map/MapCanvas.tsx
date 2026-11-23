import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap, MapGeoJSONFeature, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import { compactMoney, type Bounds, type StopsResponse } from '../api';
import type { Listing } from '../server/listings/types';
import type { PulseResponse } from '../server/types';
import { PLANNED_LINES, PLANNED_STATIONS } from './plannedTransit';
import { COLORS, mapStyle } from './style';

export interface LayerState {
  listings: boolean;
  heat: boolean;
  transit: boolean;
  planned: boolean;
  civic: boolean;
  rings: boolean;
  buildings: boolean;
}

export interface FlyTarget {
  lng: number;
  lat: number;
  zoom?: number;
  pitch?: number;
  nonce: number;
}

export interface MapCanvasHandle {
  zoomBy: (delta: number) => void;
  resetView: () => void;
}

interface Props {
  listings: Listing[];
  selectedId: string | null;
  hoveredId: string | null;
  stops: StopsResponse['stops'];
  report: PulseResponse | null;
  layers: LayerState;
  fly: FlyTarget | null;
  tilt: boolean;
  inspectMode: boolean;
  onViewport: (bounds: Bounds, zoom: number) => void;
  onSelectListing: (id: string | null) => void;
  onInspect: (lng: number, lat: number) => void;
}

const REGION_CENTER: [number, number] = [-122.98, 49.2];
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Geodesic-ish circle polygon (fine at city scale). */
export function circlePolygon(lng: number, lat: number, radiusM: number, steps = 72): Feature<Polygon> {
  const coords: Array<[number, number]> = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}

function pillImage(fill: string, stroke: string): { image: ImageData; width: number; height: number } {
  const w = 60;
  const h = 40;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const x = 4;
  const y = 4;
  const rw = w - 8;
  const rh = h - 12;
  const r = rh / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + rw, y, x + rw, y + rh, r);
  ctx.arcTo(x + rw, y + rh, x, y + rh, r);
  ctx.arcTo(x, y + rh, x, y, r);
  ctx.arcTo(x, y, x + rw, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 2;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  return { image: ctx.getImageData(0, 0, w, h), width: w, height: h };
}

function addPill(map: MLMap, name: string, fill: string, stroke: string): void {
  const { image } = pillImage(fill, stroke);
  map.addImage(name, image, {
    pixelRatio: 2,
    stretchX: [[18, 42]],
    stretchY: [[14, 18]],
    content: [18, 10, 42, 22],
  });
}

const listingFeatures = (listings: Listing[]): FeatureCollection<Point> => ({
  type: 'FeatureCollection',
  features: listings.map((l) => ({
    type: 'Feature',
    properties: {
      id: l.id,
      label: compactMoney(l.price, l.kind),
      hot: l.deal.flags.includes('below-market') || l.deal.flags.includes('price-drop'),
      score: l.deal.score,
    },
    geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
  })),
});

const MapCanvas = forwardRef<MapCanvasHandle, Props>(function MapCanvas(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const moveTimer = useRef<number | undefined>(undefined);

  useImperativeHandle(ref, () => ({
    zoomBy: (d) => mapRef.current?.easeTo({ zoom: (mapRef.current.getZoom() ?? 10) + d, duration: 350 }),
    resetView: () => mapRef.current?.flyTo({ center: REGION_CENTER, zoom: 9.9, pitch: 0, bearing: 0, duration: 1400 }),
  }));

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: mapStyle,
      center: REGION_CENTER,
      zoom: 9.9,
      minZoom: 8,
      maxZoom: 19.5,
      maxPitch: 75,
      attributionControl: { compact: true },
      dragRotate: true,
      pitchWithRotate: true,
      maxBounds: [[-124.6, 48.6], [-121.0, 49.9]],
    });
    mapRef.current = map;
    // Keep the focal point clear of the results panel (left on desktop, bottom sheet on mobile).
    map.setPadding({ left: window.innerWidth >= 1024 ? 440 : 0, top: 0, right: 0, bottom: window.innerWidth < 1024 ? 260 : 0 });
    if (import.meta.env.DEV) (window as unknown as { __mpMap?: MLMap }).__mpMap = map;

    const report = () => {
      const b = map.getBounds();
      propsRef.current.onViewport(
        { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
        map.getZoom(),
      );
    };

    map.on('load', () => {
      addPill(map, 'pill', '#0f1a2e', '#34d399');
      addPill(map, 'pill-hot', '#3a2a06', '#fbbf24');
      addPill(map, 'pill-sel', '#ffffff', '#34d399');

      map.addSource('listings', { type: 'geojson', data: EMPTY, cluster: true, clusterRadius: 46, clusterMaxZoom: 13 });
      map.addSource('listings-heat', { type: 'geojson', data: EMPTY });
      map.addSource('stops', { type: 'geojson', data: EMPTY });
      map.addSource('planned-lines', { type: 'geojson', data: PLANNED_LINES });
      map.addSource('planned-stations', { type: 'geojson', data: PLANNED_STATIONS });
      map.addSource('civic', { type: 'geojson', data: EMPTY });
      map.addSource('rings', { type: 'geojson', data: EMPTY });

      // Deal heat: density of listings weighted by "worth a look" score.
      map.addLayer({
        id: 'listing-heat',
        type: 'heatmap',
        source: 'listings-heat',
        maxzoom: 14,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'score'], 30, 0.15, 60, 0.5, 90, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 13, 2.2],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 14, 13, 46],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(8,13,23,0)', 0.2, 'rgba(34,211,238,0.28)', 0.5, 'rgba(52,211,153,0.55)',
            0.8, 'rgba(251,191,36,0.75)', 1, 'rgba(253,230,138,0.92)',
          ],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 11.5, 0.9, 14, 0],
        },
      });

      map.addLayer({
        id: 'rings-fill',
        type: 'fill',
        source: 'rings',
        filter: ['==', ['get', 'role'], 'area'],
        paint: { 'fill-color': COLORS.accent, 'fill-opacity': 0.06 },
      });
      map.addLayer({
        id: 'rings-line',
        type: 'line',
        source: 'rings',
        paint: {
          'line-color': COLORS.accent,
          'line-opacity': ['match', ['get', 'role'], 'area', 0.7, 0.35],
          'line-width': ['match', ['get', 'role'], 'area', 1.6, 1],
          'line-dasharray': [2, 2],
        },
      });
      map.addLayer({
        id: 'rings-label',
        type: 'symbol',
        source: 'rings',
        filter: ['has', 'label'],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, -0.7],
          'text-keep-upright': true,
        },
        paint: { 'text-color': COLORS.accent, 'text-halo-color': COLORS.halo, 'text-halo-width': 1.4, 'text-opacity': 0.85 },
      });

      map.addLayer({
        id: 'planned-line',
        type: 'line',
        source: 'planned-lines',
        paint: { 'line-color': '#c4b5fd', 'line-width': 3, 'line-dasharray': [1.2, 1.4], 'line-opacity': 0.9 },
      });
      map.addLayer({
        id: 'planned-station',
        minzoom: 10.5,
        type: 'circle',
        source: 'planned-stations',
        paint: { 'circle-radius': 5, 'circle-color': '#0b1220', 'circle-stroke-color': '#c4b5fd', 'circle-stroke-width': 2 },
      });
      map.addLayer({
        id: 'planned-label',
        type: 'symbol',
        source: 'planned-stations',
        minzoom: 11,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
        paint: { 'text-color': '#c4b5fd', 'text-halo-color': COLORS.halo, 'text-halo-width': 1.5 },
      });

      map.addLayer({
        id: 'stops',
        type: 'circle',
        source: 'stops',
        minzoom: 13,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.5, 17, 6],
          'circle-color': COLORS.transit,
          'circle-stroke-color': COLORS.bg,
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'stops-label',
        type: 'symbol',
        source: 'stops',
        minzoom: 16,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-max-width': 10 },
        paint: { 'text-color': COLORS.transit, 'text-halo-color': COLORS.halo, 'text-halo-width': 1.4 },
      });

      map.addLayer({
        id: 'civic',
        type: 'circle',
        source: 'civic',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 9],
          'circle-color': [
            'match', ['get', 'kind'],
            'permit', COLORS.permit, 'request', COLORS.request, 'rental', COLORS.rental, 'road', COLORS.road_event, '#94a3b8',
          ],
          'circle-stroke-color': COLORS.bg,
          'circle-stroke-width': 2,
          'circle-opacity': 0.95,
        },
      });

      // Clusters
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'listings',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#0f2a2a', 8, '#0e3b36', 20, '#0f5a4b'],
          'circle-radius': ['step', ['get', 'point_count'], 17, 8, 23, 20, 30],
          'circle-stroke-color': COLORS.accent,
          'circle-stroke-width': 2,
          'circle-stroke-opacity': 0.85,
        },
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'listings',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true },
        paint: { 'text-color': '#ecfdf5' },
      });

      // Hover / selection halo underneath the pills
      map.addLayer({
        id: 'listing-halo-hover',
        type: 'circle',
        source: 'listings',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 26, 'circle-color': COLORS.accent, 'circle-opacity': 0.22, 'circle-blur': 0.6 },
      });
      map.addLayer({
        id: 'listing-halo-selected',
        type: 'circle',
        source: 'listings',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 32, 'circle-color': '#ffffff', 'circle-opacity': 0.2, 'circle-blur': 0.5 },
      });

      const pillLayout = {
        'icon-image': ['case', ['get', 'hot'], 'pill-hot', 'pill'],
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [2, 6, 2, 6],
        'icon-allow-overlap': false,
        'text-allow-overlap': false,
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'symbol-sort-key': ['-', 100, ['get', 'score']],
      } as const;
      map.addLayer({
        id: 'listing-pill',
        type: 'symbol',
        source: 'listings',
        filter: ['!', ['has', 'point_count']],
        layout: pillLayout as never,
        paint: { 'text-color': ['case', ['get', 'hot'], '#fde68a', '#d1fae5'] },
      });
      map.addLayer({
        id: 'listing-pill-selected',
        type: 'symbol',
        source: 'listings',
        filter: ['==', ['get', 'id'], ''],
        layout: { ...pillLayout, 'icon-image': 'pill-sel', 'icon-allow-overlap': true, 'text-allow-overlap': true } as never,
        paint: { 'text-color': '#04120d' },
      });

      readyRef.current = true;
      syncAll();
      report();
    });

    map.on('moveend', () => {
      window.clearTimeout(moveTimer.current);
      moveTimer.current = window.setTimeout(report, 280);
    });

    map.on('click', (e: MapMouseEvent) => {
      const p = propsRef.current;
      const hits = map.queryRenderedFeatures(e.point, { layers: ['clusters', 'listing-pill', 'listing-pill-selected'] });
      const hit: MapGeoJSONFeature | undefined = hits[0];
      if (hit && hit.layer.id === 'clusters') {
        const src = map.getSource('listings') as GeoJSONSource;
        const clusterId = hit.properties?.cluster_id as number;
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({ center: (hit.geometry as Point).coordinates as [number, number], zoom: zoom + 0.3, duration: 600 });
        });
        return;
      }
      if (hit) {
        p.onSelectListing(String(hit.properties?.id));
        return;
      }
      if (p.inspectMode) p.onInspect(e.lngLat.lng, e.lngLat.lat);
    });

    const pointer = (on: boolean) => () => {
      map.getCanvas().style.cursor = on ? 'pointer' : propsRef.current.inspectMode ? 'crosshair' : '';
    };
    for (const id of ['clusters', 'listing-pill', 'listing-pill-selected']) {
      map.on('mouseenter', id, pointer(true));
      map.on('mouseleave', id, pointer(false));
    }

    return () => {
      window.clearTimeout(moveTimer.current);
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncAll(): void {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const p = propsRef.current;

    (map.getSource('listings') as GeoJSONSource).setData(listingFeatures(p.listings));
    (map.getSource('listings-heat') as GeoJSONSource).setData(listingFeatures(p.listings));
    (map.getSource('stops') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: p.stops.map((s) => ({ type: 'Feature', properties: { name: s.name }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] } })),
    });

    const civic: Array<Feature<Point>> = [];
    const rings: Array<Feature> = [];
    if (p.report) {
      const { civic: c, location, radiusM } = p.report;
      const add = (kind: string, rs: typeof c.permits) =>
        rs.forEach((r) =>
          civic.push({ type: 'Feature', properties: { kind, title: r.title }, geometry: { type: 'Point', coordinates: [r.lng, r.lat] } }),
        );
      add('permit', c.permits);
      add('request', c.serviceRequests);
      add('rental', c.rentalIssues);
      add('road', c.roadEvents);
      const area = circlePolygon(location.lng, location.lat, radiusM);
      area.properties = { role: 'area' };
      rings.push(area);
      for (const [m, label] of [[400, '5 min walk'], [800, '10 min walk'], [1200, '15 min walk']] as const) {
        if (m > radiusM + 450) continue;
        const ring = circlePolygon(location.lng, location.lat, m);
        ring.geometry = { type: 'LineString', coordinates: (ring.geometry as Polygon).coordinates[0] } as never;
        ring.properties = { role: 'ring', label };
        rings.push(ring);
      }
    }
    (map.getSource('civic') as GeoJSONSource).setData({ type: 'FeatureCollection', features: civic });
    (map.getSource('rings') as GeoJSONSource).setData({ type: 'FeatureCollection', features: rings });

    const vis = (id: string, on: boolean) => map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('listing-heat', p.layers.heat);
    for (const id of ['clusters', 'cluster-count', 'listing-pill', 'listing-pill-selected', 'listing-halo-hover', 'listing-halo-selected']) vis(id, p.layers.listings);
    for (const id of ['stops', 'stops-label']) vis(id, p.layers.transit);
    for (const id of ['planned-line', 'planned-station', 'planned-label']) vis(id, p.layers.planned);
    vis('civic', p.layers.civic);
    for (const id of ['rings-fill', 'rings-line', 'rings-label']) vis(id, p.layers.rings);
    for (const id of ['building-3d', 'building-flat']) vis(id, p.layers.buildings);

    const sel = ['==', ['get', 'id'], p.selectedId ?? ''] as never;
    map.setFilter('listing-pill-selected', sel);
    map.setFilter('listing-halo-selected', sel);
    map.setFilter('listing-halo-hover', ['==', ['get', 'id'], p.hoveredId ?? ''] as never);
  }

  useEffect(() => {
    syncAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.listings, props.stops, props.report, props.layers, props.selectedId, props.hoveredId]);

  // Pulsing marker at the active report location.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    markerRef.current = null;
    if (!props.report) return;
    const el = document.createElement('div');
    el.className = 'mp-pin';
    el.innerHTML = '<span class="mp-pin-ring"></span><span class="mp-pin-dot"></span>';
    markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([props.report.location.lng, props.report.location.lat]).addTo(map);
  }, [props.report]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !props.fly) return;
    map.flyTo({
      center: [props.fly.lng, props.fly.lat],
      zoom: props.fly.zoom ?? 15.6,
      pitch: props.fly.pitch ?? (propsRef.current.tilt ? 58 : 0),
      bearing: propsRef.current.tilt ? -17 : 0,
      duration: 2000,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fly?.nonce]);

  useEffect(() => {
    mapRef.current?.easeTo({ pitch: props.tilt ? 58 : 0, bearing: props.tilt ? -17 : 0, duration: 900 });
  }, [props.tilt]);

  useEffect(() => {
    const c = mapRef.current?.getCanvas();
    if (c) c.style.cursor = props.inspectMode ? 'crosshair' : '';
  }, [props.inspectMode]);

  // MapLibre's stylesheet sets `position: relative` on its container (and wins over
  // utility classes), so the container fills an absolutely positioned wrapper instead.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" data-testid="map" />
    </div>
  );
});

export default MapCanvas;
