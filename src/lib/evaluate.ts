import type { CellProps } from './geo';
import { distanceKm } from './geo';
import type { Town } from './osm';
import { ACTIVITIES, bestOf, rateActivity, rateCamping, type Activity, type Level, type Rating } from './rating';
import type { DayWeather } from './weather';

export type CellEval = {
  days: DayWeather[];
  /** Camping-Wetter (ohne Aktivität) bzw. Rang 1 */
  primary: Rating[];
  secondary: Rating[] | null;
};

export type Availability = { city: Set<string> | null; loipe: Set<string> | null };

/** Verfügbarkeit unbekannt (noch nicht geladen) → als verfügbar behandeln. */
export function isAvailable(a: Activity, cellId: string, av: Availability): boolean {
  if (a === 'city') return av.city ? av.city.has(cellId) : true;
  if (a === 'xc_ski') return av.loipe ? av.loipe.has(cellId) : true;
  return true;
}

export function rateDays(a: Activity | null, days: DayWeather[], cellId: string, av: Availability): Rating[] {
  return a ? days.map((d) => rateActivity(a, d, isAvailable(a, cellId, av))) : days.map(rateCamping);
}

export function evaluateCell(id: string, days: DayWeather[], rank1: Activity | null, rank2: Activity | null, av: Availability): CellEval {
  return { days, primary: rateDays(rank1, days, id, av), secondary: rank1 && rank2 ? rateDays(rank2, days, id, av) : null };
}

/** Farbe für die Anzeige: Gesamt (bester Tag) oder ein bestimmter Tag. */
export function displayLevel(r: Rating[] | null, dayIndex: number): Level | 'none' {
  if (!r || r.length === 0) return 'none';
  return dayIndex < 0 ? bestOf(r).level : (r[dayIndex]?.level ?? 'none');
}

export function nearestTown(lat: number, lng: number, towns: Town[]): { town: Town; km: number } | null {
  let best: { town: Town; km: number } | null = null;
  for (const t of towns) {
    if (t.oldTown) continue;
    const km = distanceKm({ lat, lng }, t);
    if (!best || km < best.km) best = { town: t, km };
  }
  return best;
}

export type Suggestion = { activity: Activity; level: Level; count: number; cell: CellProps; place: string | null };

/**
 * Infofeld ohne Aktivität: Für jede Aktivität zählen, in wie vielen Gebieten sie
 * (am besten Tag) sehr gut bzw. möglich ist. Vorgeschlagen wird das nächstgelegene
 * passende Gebiet. Höchstens 3 Vorschläge.
 */
export function suggestions(cells: CellProps[], weather: Map<string, DayWeather[]>, av: Availability, towns: Town[] | null, skipSki: boolean, dayIndex = -1): Suggestion[] {
  const out: Suggestion[] = [];
  for (const { id: a } of ACTIVITIES) {
    if (a === 'xc_ski' && skipSki) continue;
    // Ohne geprüfte Städteliste keine Städte-Vorschläge (sonst wäre jedes Gebiet „möglich“)
    if (a === 'city' && !av.city) continue;
    const byLevel: Record<'green' | 'yellow', CellProps[]> = { green: [], yellow: [] };
    for (const c of cells) {
      const days = weather.get(c.id);
      if (!days?.length) continue;
      const lvl = displayLevel(rateDays(a, days, c.id, av), dayIndex);
      if (lvl === 'green' || lvl === 'yellow') byLevel[lvl].push(c);
    }
    const level: 'green' | 'yellow' | null = byLevel.green.length ? 'green' : byLevel.yellow.length ? 'yellow' : null;
    if (!level) continue;
    const list = byLevel[level];
    const cell = list.reduce((a, b) => (b.distanceKm < a.distanceKm ? b : a));
    const near = towns ? nearestTown(cell.lat, cell.lng, towns) : null;
    out.push({ activity: a, level, count: list.length, cell, place: near?.town.name ?? null });
  }
  return out.sort((x, y) => (x.level === y.level ? y.count - x.count : x.level === 'green' ? -1 : 1)).slice(0, 3);
}
