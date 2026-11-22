import { distanceKm, type LatLng } from './geo';
import type { CellData, Route, Town } from './osm';
import type { Activity } from './rating';

const NETWORK: Record<string, string> = { lwn: 'lokal', rwn: 'regional', nwn: 'national', iwn: 'international', lcn: 'lokal', rcn: 'regional', ncn: 'national', icn: 'international' };
const MAX_KM = 10;

/** Abstand Punkt → Rechteck der Route (0, wenn der Punkt darin liegt). */
function distToBounds(p: LatLng, b: NonNullable<Route['bounds']>): number {
  const lat = Math.min(Math.max(p.lat, b.minlat), b.maxlat);
  const lng = Math.min(Math.max(p.lng, b.minlon), b.maxlon);
  return distanceKm(p, { lat, lng });
}

/** Lokale/regionale Rundtouren vor Fernwegen; dann nach Nähe. */
function routeRank(r: Route, d: number): number {
  const n = r.network ?? '';
  const scope = n.startsWith('l') ? 0 : n.startsWith('r') ? 1 : n.startsWith('n') ? 3 : n.startsWith('i') ? 4 : 2;
  return scope * 5 + d;
}

/** Kurzer Tourenvorschlag (1–2 Einträge) für eine Aktivität am Platz – oder null. */
export function tourHint(a: Activity, site: LatLng, data: CellData, towns: Town[] | null): string | null {
  if (a === 'city') {
    const t = (towns ?? []).filter((x) => !x.oldTown && x.population >= 20000)
      .map((x) => ({ x, d: distanceKm(site, x) })).sort((p, q) => p.d - q.d)[0];
    return t && t.d <= 40 ? `${t.x.name} (${Math.round(t.d)} km)` : null;
  }
  if (a === 'xc_ski') {
    const near = data.pistes.map((p) => ({ p, d: distanceKm(site, p) })).filter((x) => x.d <= MAX_KM).sort((p, q) => p.d - q.d);
    const seen = new Set<string>();
    const names = near.filter(({ p }) => !seen.has(p.name) && seen.add(p.name)).slice(0, 2)
      .map(({ p, d }) => `Loipe „${p.name}“${p.difficulty ? `, ${difficulty(p.difficulty)}` : ''} (${d < 1 ? 'direkt am Platz' : `${Math.round(d)} km`})`);
    return names.length ? names.join(' · ') : null;
  }
  const kind = a === 'cycling' ? 'cycling' : 'hiking';
  const list = data.routes.filter((r) => r.kind === kind && r.bounds)
    .map((r) => ({ r, d: distToBounds(site, r.bounds!) })).filter((x) => x.d <= MAX_KM)
    .sort((p, q) => routeRank(p.r, p.d) - routeRank(q.r, q.d));
  const seen = new Set<string>();
  const top = list.filter(({ r }) => !seen.has(r.name) && seen.add(r.name)).slice(0, 2);
  if (!top.length) return null;
  const label = a === 'cycling' ? 'Radweg' : 'Wanderweg';
  return top.map(({ r, d }) => {
    const parts = [r.distanceKm ? `${Math.round(r.distanceKm)} km` : null, r.network ? NETWORK[r.network] : null, d < 0.5 ? 'ab Platz' : `Einstieg ca. ${Math.round(d)} km`].filter(Boolean);
    return `${label} „${r.name}“ (${parts.join(', ')})`;
  }).join(' · ');
}

function difficulty(d: string): string {
  return ({ novice: 'sehr leicht', easy: 'leicht', intermediate: 'mittel', advanced: 'schwer', expert: 'sehr schwer' } as Record<string, string>)[d] ?? d;
}

/** Links zur Tourensuche in externen Portalen (nur Startseiten, keine Einbindung). */
export const TOUR_LINKS = [
  { label: 'Komoot', url: 'https://www.komoot.com/de-de' },
  { label: 'Outdooractive', url: 'https://www.outdooractive.com/de/' },
];
export const PORTAL_LINKS = [
  { label: 'park4night', url: 'https://park4night.com/de' },
  { label: 'Landvergnügen', url: 'https://www.landvergnuegen.com' },
  { label: 'Alpaca Camping', url: 'https://www.alpacacamping.de' },
];
