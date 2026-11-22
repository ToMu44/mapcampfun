import { latLngToCell } from 'h3-js';

/** Hauptserver und öffentlicher Spiegel – der Hauptserver ist oft ausgelastet. */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

export type Town = { name: string; lat: number; lng: number; population: number; oldTown: boolean };
export type Bbox = [number, number, number, number]; // W, S, O, N

type El = { type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const cache = new Map<string, Promise<El[]>>();

async function overpass(query: string, signal?: AbortSignal): Promise<El[]> {
  const hit = cache.get(query);
  if (hit) return hit;
  const p = (async () => {
    let last: Error = new Error('OpenStreetMap (Overpass) nicht erreichbar.');
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal });
        if (res.ok) return ((await res.json()) as { elements: El[] }).elements;
        last = new Error(res.status === 429 || res.status === 504 ? 'OpenStreetMap-Abfrage ausgelastet – bitte gleich erneut versuchen.' : `OpenStreetMap-Abfrage fehlgeschlagen (HTTP ${res.status}).`);
      } catch (err) {
        if (signal?.aborted) throw err;
      }
    }
    throw last;
  })();
  cache.set(query, p);
  p.catch(() => cache.delete(query));
  return p;
}

/** Bbox auf 0,5° runden → gleiche Abfrage (und Cache-Treffer) bei kleinen Verschiebungen. */
function roundBbox([w, s, e, n]: Bbox): string {
  const f = (x: number) => Math.floor(x * 2) / 2;
  const c = (x: number) => Math.ceil(x * 2) / 2;
  return `${f(s)},${f(w)},${c(n)},${c(e)}`;
}

function point(el: El): { lat: number; lng: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/** Städte und Orte mit Einwohnerzahl sowie als „Altstadt“ benannte Stadtteile. */
export async function fetchTowns(bbox: Bbox, signal?: AbortSignal): Promise<Town[]> {
  const b = roundBbox(bbox);
  const q = `[out:json][timeout:60];
(
  node["place"~"^(city|town)$"](${b});
  nwr["place"~"^(quarter|suburb|neighbourhood)$"]["name"~"Altstadt"](${b});
);
out center tags;`;
  const els = await overpass(q, signal);
  const towns: Town[] = [];
  for (const el of els) {
    const p = point(el);
    const t = el.tags ?? {};
    if (!p || !t.name) continue;
    const oldTown = /^(quarter|suburb|neighbourhood)$/.test(t.place ?? '');
    towns.push({ name: t.name, ...p, population: parsePopulation(t.population), oldTown });
  }
  return towns;
}

export function parsePopulation(s?: string): number {
  if (!s) return 0;
  const n = parseInt(s.replace(/[.\s,']/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Zellen (H3), in denen Langlauf-Loipen erfasst sind. */
export async function fetchLoipenCells(bbox: Bbox, resolution: number, signal?: AbortSignal): Promise<Set<string>> {
  const q = `[out:json][timeout:90];
nwr["piste:type"="nordic"](${roundBbox(bbox)});
out center;`;
  const els = await overpass(q, signal);
  const cells = new Set<string>();
  for (const el of els) {
    const p = point(el);
    if (p) cells.add(latLngToCell(p.lat, p.lng, resolution));
  }
  return cells;
}

/** Zellen mit Stadt ≥ Mindestgröße oder Altstadt → Städtebesuch möglich. */
export function cityCells(towns: Town[], minPopulation: number, resolution: number): Set<string> {
  const cells = new Set<string>();
  for (const t of towns) if (t.oldTown || t.population >= minPopulation) cells.add(latLngToCell(t.lat, t.lng, resolution));
  return cells;
}

// ---------- Stufe 3: Plätze und Touren je Gebiet ----------

export type Route = {
  key: string;
  name: string;
  kind: 'hiking' | 'cycling';
  network: string | null;
  distanceKm: number | null;
  bounds: { minlat: number; minlon: number; maxlat: number; maxlon: number } | null;
};
export type Piste = { name: string; lat: number; lng: number; difficulty: string | null };
export type CellData = {
  sites: { key: string; lat: number; lng: number; tags: Record<string, string>; lastEdit: string | null }[];
  wineries: { lat: number; lng: number }[];
  farms: { lat: number; lng: number }[];
  routes: Route[];
  pistes: Piste[];
};

type ElFull = El & { id: number; timestamp?: string; bounds?: Route['bounds'] };

/** Alles für ein Gebiet in einer Abfrage. `ring` = Zellumriss als [lng, lat]-Paare. */
export async function fetchCellData(ring: number[][], signal?: AbortSignal): Promise<CellData> {
  const poly = ring.map(([lng, lat]) => `${lat.toFixed(5)} ${lng.toFixed(5)}`).join(' ');
  const lats = ring.map((p) => p[1]);
  const lngs = ring.map((p) => p[0]);
  // Etwas größerer Rahmen, damit Touren und Nachbarn am Rand mitkommen
  const pad = 0.05;
  const bb = `${(Math.min(...lats) - pad).toFixed(4)},${(Math.min(...lngs) - pad).toFixed(4)},${(Math.max(...lats) + pad).toFixed(4)},${(Math.max(...lngs) + pad).toFixed(4)}`;
  const q = `[out:json][timeout:90];
nwr["tourism"~"^(camp_site|caravan_site)$"](poly:"${poly}");
out center meta;
(
  nwr["craft"="winery"](${bb});
  nwr["shop"~"^(wine|farm)$"](${bb});
  nwr["place"="farm"](${bb});
  way["landuse"="farmyard"](${bb});
);
out center tags;
relation["route"~"^(hiking|foot|bicycle|mtb)$"](${bb});
out tags bb;
way["piste:type"="nordic"](${bb});
out center tags;`;
  const els = (await overpass(q, signal)) as ElFull[];
  const data: CellData = { sites: [], wineries: [], farms: [], routes: [], pistes: [] };
  for (const el of els) {
    const t = el.tags ?? {};
    const p = point(el);
    if (t.tourism === 'camp_site' || t.tourism === 'caravan_site') {
      if (p) data.sites.push({ key: `${el.type}/${el.id}`, ...p, tags: t, lastEdit: el.timestamp ?? null });
    } else if (t.route) {
      data.routes.push({
        key: `relation/${el.id}`,
        name: t.name ?? t.ref ?? 'ohne Namen',
        kind: t.route === 'bicycle' || t.route === 'mtb' ? 'cycling' : 'hiking',
        network: t.network ?? null,
        distanceKm: parseDistance(t.distance),
        bounds: el.bounds ?? null,
      });
    } else if (t['piste:type'] === 'nordic') {
      if (p && t.name) data.pistes.push({ name: t.name, ...p, difficulty: t['piste:difficulty'] ?? null });
    } else if (p && (t.craft === 'winery' || t.shop === 'wine')) {
      data.wineries.push(p);
    } else if (p) {
      data.farms.push(p);
    }
  }
  return data;
}

export function parseDistance(s?: string): number | null {
  if (!s) return null;
  const m = s.replace(',', '.').match(/[\d.]+/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return /m\b/.test(s) && !/km/.test(s) ? v / 1000 : v;
}
