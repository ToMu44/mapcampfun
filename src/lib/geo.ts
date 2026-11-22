import circle from '@turf/circle';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { polygonToCells, cellToLatLng, cellToBoundary } from 'h3-js';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import germanyJson from '../data/germany.json';

export type LatLng = { lat: number; lng: number };

export const GERMANY = germanyJson as Feature<MultiPolygon>;
/** Geografischer Mittelpunkt Deutschlands – Rückfall, wenn kein Standort bekannt ist. */
export const GERMANY_CENTER: LatLng = { lat: 51.163, lng: 10.447 };

export type CellProps = {
  id: string;
  lat: number;
  lng: number;
  /** Luftlinie Zellmittelpunkt → Suchmittelpunkt in km */
  distanceKm: number;
};

/** Großkreis-Entfernung in km (Haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371.0088;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isInGermany(p: LatLng): boolean {
  return booleanPointInPolygon([p.lng, p.lat], GERMANY);
}

export function radiusCircle(center: LatLng, radiusKm: number): Feature<Polygon> {
  return circle([center.lng, center.lat], radiusKm, { steps: 96, units: 'kilometers' });
}

/**
 * Hexagon-Raster (H3) im Suchradius. Eine Zelle gehört dazu, wenn ihr Mittelpunkt
 * im Radius UND in Deutschland liegt (Konzept Abschnitt 5).
 */
export function buildGrid(center: LatLng, radiusKm: number, resolution = 5): FeatureCollection<Polygon, CellProps> {
  const ring = radiusCircle(center, radiusKm).geometry.coordinates;
  const ids = polygonToCells(ring, resolution, true);
  const features: Feature<Polygon, CellProps>[] = [];
  for (const id of ids) {
    const [lat, lng] = cellToLatLng(id);
    if (!isInGermany({ lat, lng })) continue;
    const boundary = cellToBoundary(id, true);
    boundary.push(boundary[0]);
    features.push({
      type: 'Feature',
      id: features.length,
      properties: { id, lat, lng, distanceKm: distanceKm(center, { lat, lng }) },
      geometry: { type: 'Polygon', coordinates: [boundary] },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Bounding-Box [W, S, O, N] eines Kreises – für das Einpassen der Karte. */
export function circleBounds(center: LatLng, radiusKm: number): [number, number, number, number] {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat];
}
