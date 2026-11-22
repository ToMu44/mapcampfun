import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap, MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Vite bündelt den MapLibre-Worker als eigene Datei; ohne das findet MapLibre ihn nach dem Build nicht.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection, Polygon } from 'geojson';
import { circleBounds, radiusCircle, type CellProps, type LatLng } from '../lib/geo';

// Kostenlose Vektorkarte ohne API-Key (OpenStreetMap-Daten).
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

type Props = {
  center: LatLng;
  radiusKm: number;
  grid: FeatureCollection<Polygon, CellProps>;
  selectedCellId: string | null;
  onSelectCell: (cell: CellProps | null) => void;
};

maplibregl.setWorkerUrl(workerUrl);

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export function MapView({ center, radiusKm, grid, selectedCellId, onSelectCell }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelectCell);
  onSelectRef.current = onSelectCell;
  const latest = useRef({ center, radiusKm, grid, selectedCellId });
  latest.current = { center, radiusKm, grid, selectedCellId };

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
      map.addSource('radius', { type: 'geojson', data: EMPTY });
      map.addSource('grid', { type: 'geojson', data: EMPTY });

      map.addLayer({ id: 'grid-fill', type: 'fill', source: 'grid', paint: {
        'fill-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#2f6b4f', '#6b8f7d'],
        'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.45, 0.12],
      } });
      map.addLayer({ id: 'grid-line', type: 'line', source: 'grid', paint: {
        'line-color': '#2f6b4f',
        'line-opacity': 0.55,
        'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 0.7],
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
      syncData(map, latest.current, true);
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Raster, Radius und Mittelpunkt aktualisieren
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
    if (readyRef.current) syncData(map, latest.current, true);
  }, [center, radiusKm, grid]);

  // Auswahl hervorheben
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) syncSelection(map, latest.current.grid, selectedCellId);
  }, [selectedCellId, grid]);

  return <div ref={containerRef} className="map" role="application" aria-label="Karte" />;
}

function syncData(map: MLMap, s: { center: LatLng; radiusKm: number; grid: FeatureCollection<Polygon, CellProps>; selectedCellId: string | null }, fit: boolean) {
  (map.getSource('radius') as GeoJSONSource).setData(radiusCircle(s.center, s.radiusKm));
  (map.getSource('grid') as GeoJSONSource).setData(s.grid);
  syncSelection(map, s.grid, s.selectedCellId);
  if (fit) map.fitBounds(circleBounds(s.center, s.radiusKm), { padding: { top: 24, left: 24, right: 24, bottom: 24 + overlayHeight() }, duration: 600 });
}

function syncSelection(map: MLMap, grid: FeatureCollection<Polygon, CellProps>, selectedCellId: string | null) {
  map.removeFeatureState({ source: 'grid' });
  const f = grid.features.find((x) => x.properties.id === selectedCellId);
  if (f && f.id !== undefined) map.setFeatureState({ source: 'grid', id: f.id }, { selected: true });
}

/** Höhe des Bottom-Sheets, falls es die Karte überlagert (iPad hoch) – sonst 0. */
function overlayHeight(): number {
  const panel = document.querySelector<HTMLElement>('.panel');
  if (!panel || getComputedStyle(panel).position !== 'absolute') return 0;
  return Math.min(panel.offsetHeight, window.innerHeight * 0.6);
}
