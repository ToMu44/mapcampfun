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
