import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent, ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Vite bündelt den MapLibre-Worker als eigene Datei; ohne das findet MapLibre ihn nach dem Build nicht.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import { circleBounds, radiusCircle, type CellProps, type LatLng } from '../lib/geo';
import type { Level } from '../lib/rating';

maplibregl.setWorkerUrl(workerUrl);

// Kostenlose Vektorkarte ohne API-Key (OpenStreetMap-Daten).
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export type MapCellProps = CellProps & { level?: Level | 'none'; level2?: Level | 'none' };

export const LEVEL_COLORS: Record<Level, string> = { green: '#2e9d5b', yellow: '#e2b02a', red: '#d24b3e', grey: '#9aa0a6' };

const levelColor = (prop: string): ExpressionSpecification => [
  'match', ['get', prop],
  'green', LEVEL_COLORS.green, 'yellow', LEVEL_COLORS.yellow, 'red', LEVEL_COLORS.red, 'grey', LEVEL_COLORS.grey,
  '#6b8f7d',
];

export type MapPlace = { key: string; lat: number; lng: number; icon: string; title: string; state: 'open' | 'closed' | 'unknown' };

type Props = {
  places: MapPlace[];
  selectedPlaceKey: string | null;
  onSelectPlace: (key: string) => void;
  /** Karte auf diesen Rahmen [W, S, O, N] einpassen, sobald sich `seq` ändert */
  fitTo: { bbox: [number, number, number, number]; seq: number } | null;
  center: LatLng;
  radiusKm: number;
  cells: FeatureCollection<Polygon, MapCellProps>;
  selectedCellId: string | null;
  focus: { lat: number; lng: number; seq: number } | null;
  onSelectCell: (cell: CellProps | null) => void;
};

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export function MapView({ places, selectedPlaceKey, onSelectPlace, fitTo, center, radiusKm, cells, selectedCellId, focus, onSelectCell }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelectCell);
  onSelectRef.current = onSelectCell;
  const onPlaceRef = useRef(onSelectPlace);
  onPlaceRef.current = onSelectPlace;
  const placeMarkers = useRef(new Map<string, maplibregl.Marker>());
  const latest = useRef({ center, radiusKm, cells, selectedCellId });
  latest.current = { center, radiusKm, cells, selectedCellId };

  // Karte einmalig anlegen
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom: 7,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    mapRef.current = map;

    map.on('load', () => {
      germanLabels(map);
      map.addSource('radius', { type: 'geojson', data: EMPTY });
      map.addSource('grid', { type: 'geojson', data: EMPTY });
      map.addSource('rank2', { type: 'geojson', data: EMPTY });

      map.addLayer({ id: 'grid-fill', type: 'fill', source: 'grid', paint: {
        'fill-color': levelColor('level'),
        // Beim Hineinzoomen transparenter, damit Straßen und Orte lesbar bleiben
        'fill-opacity': ['interpolate', ['linear'], ['zoom'],
          9, ['case', ['==', ['get', 'level'], 'none'], 0.08, ['==', ['get', 'level'], 'grey'], 0.3, 0.5],
          11.5, ['case', ['==', ['get', 'level'], 'none'], 0.03, 0.12]],
      } });
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid', paint: {
        'line-color': '#ffffff', 'line-opacity': 0.7, 'line-width': 0.8,
      } });
      map.addLayer({ id: 'grid-selected', type: 'line', source: 'grid', filter: ['==', ['get', 'id'], ''], paint: {
        'line-color': '#11231a', 'line-width': 3.5,
      } });
      map.addLayer({ id: 'rank2-dot', type: 'circle', source: 'rank2', paint: {
        'circle-color': levelColor('level2'),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 9, 7],
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
      } });
      map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: {
        'line-color': '#1f4a36', 'line-width': 2, 'line-dasharray': [3, 2],
      } });

      map.on('click', 'grid-fill', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        onSelectRef.current(f ? (f.properties as CellProps) : null);
      });
      map.on('mouseenter', 'grid-fill', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'grid-fill', () => (map.getCanvas().style.cursor = ''));

      readyRef.current = true;
      syncCells(map, latest.current.cells, latest.current.selectedCellId);
      syncFrame(map, latest.current.center, latest.current.radiusKm);
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mittelpunkt/Radius → Kreis zeichnen und Karte einpassen
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'center-marker';
      el.setAttribute('aria-label', 'Suchmittelpunkt');
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([center.lng, center.lat]).addTo(map);
    } else {
      markerRef.current.setLngLat([center.lng, center.lat]);
    }
    if (readyRef.current) syncFrame(map, center, radiusKm);
  }, [center, radiusKm]);

  // Färbung und Auswahl
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) syncCells(map, cells, selectedCellId);
  }, [cells, selectedCellId]);

  // Fokus auf ein Gebiet (z. B. aus dem Infofeld)
  useEffect(() => {
    const map = mapRef.current;
    if (map && focus) map.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 8), padding: { top: 0, left: 0, right: 0, bottom: overlayHeight() }, duration: 700 });
  }, [focus]);

  // Platz-Symbole als HTML-Marker (Emoji, gut antippbar)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = placeMarkers.current;
    const keep = new Set(places.map((p) => p.key));
    for (const [k, m] of current) if (!keep.has(k)) { m.remove(); current.delete(k); }
    for (const p of places) {
      let m = current.get(p.key);
      if (!m) {
        const el = document.createElement('button');
        el.type = 'button';
        el.addEventListener('click', (e) => { e.stopPropagation(); onPlaceRef.current(p.key); });
        m = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        current.set(p.key, m);
      }
      const el = m.getElement();
      el.className = `place-marker ${p.state}${p.key === selectedPlaceKey ? ' selected' : ''}`;
      el.textContent = p.icon;
      el.title = p.title;
      el.setAttribute('aria-label', p.title);
    }
  }, [places, selectedPlaceKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && fitTo) map.fitBounds(fitTo.bbox, { padding: { top: 40, left: 40, right: 40, bottom: 40 + overlayHeight() }, duration: 700, maxZoom: 12 });
  }, [fitTo]);

  return <div ref={containerRef} className="map" role="application" aria-label="Karte" />;
}

function syncFrame(map: MLMap, center: LatLng, radiusKm: number) {
  (map.getSource('radius') as GeoJSONSource).setData(radiusCircle(center, radiusKm));
  map.fitBounds(circleBounds(center, radiusKm), { padding: { top: 24, left: 24, right: 24, bottom: 24 + overlayHeight() }, duration: 600 });
}

function syncCells(map: MLMap, cells: FeatureCollection<Polygon, MapCellProps>, selectedCellId: string | null) {
  (map.getSource('grid') as GeoJSONSource).setData(cells);
  const dots: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: cells.features
      .filter((f) => f.properties.level2 && f.properties.level2 !== 'none' && f.properties.level2 !== 'grey')
      .map((f) => ({ type: 'Feature', properties: { level2: f.properties.level2 }, geometry: { type: 'Point', coordinates: [f.properties.lng, f.properties.lat] } })),
  };
  (map.getSource('rank2') as GeoJSONSource).setData(dots);
  map.setFilter('grid-selected', ['==', ['get', 'id'], selectedCellId ?? '']);
}

/** Höhe des Bottom-Sheets, falls es die Karte überlagert (iPad hoch) – sonst 0. */
function overlayHeight(): number {
  const panel = document.querySelector<HTMLElement>('.panel');
  if (!panel || getComputedStyle(panel).position !== 'absolute') return 0;
  return Math.min(panel.offsetHeight, window.innerHeight * 0.6);
}

/** Ortsnamen auf Deutsch (Kartenstil zeigt sonst teils englische Namen). */
function germanLabels(map: MLMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const tf = map.getLayoutProperty(layer.id, 'text-field');
    const src = JSON.stringify(tf ?? '');
    if (!src.includes('name') || src.includes('ref')) continue; // Straßennummern unverändert lassen
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:de'], ['get', 'name']]);
  }
}
