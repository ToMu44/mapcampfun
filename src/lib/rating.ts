import type { DayWeather } from './weather';

export type Level = 'green' | 'yellow' | 'red' | 'grey';
export type Activity = 'hiking' | 'cycling' | 'xc_ski' | 'city';
export type Rating = { level: Level; reason: string };

export const ACTIVITIES: { id: Activity; label: string; icon: string }[] = [
  { id: 'hiking', label: 'Wandern', icon: '🥾' },
  { id: 'cycling', label: 'Radfahren', icon: '🚲' },
  { id: 'xc_ski', label: 'Ski-Langlauf', icon: '⛷️' },
  { id: 'city', label: 'Städtebesuch', icon: '🏛️' },
];
export const activityLabel = (a: Activity) => ACTIVITIES.find((x) => x.id === a)!.label;

export const LEVEL_TEXT: Record<Level, string> = { green: 'sehr gut', yellow: 'mäßig', red: 'nicht empfehlenswert', grey: 'nicht möglich' };
export const CAMPING_TEXT: Record<Level, string> = { green: 'ideal', yellow: 'so lala', red: 'schlecht', grey: '–' };

/** Schwellwerte (Konzept 6.1 / 6.2). In Stufe 5 über die Einstellungen änderbar. */
export type Band = { tMin?: number; tMax?: number; rain?: number; wind?: number; snowMin?: number; tminMin?: number };
export const RULES: Record<Activity, { green: Band; yellow: Band }> = {
  hiking: { green: { tMin: 8, tMax: 24, rain: 1, wind: 30 }, yellow: { tMin: 0, tMax: 30, rain: 5, wind: 50 } },
  cycling: { green: { tMin: 12, tMax: 26, rain: 0.5, wind: 25 }, yellow: { tMin: 5, tMax: 30, rain: 3, wind: 40 } },
  xc_ski: { green: { snowMin: 20, tMax: 0, tminMin: -12, rain: 0.5 }, yellow: { snowMin: 10, tMax: 3, rain: 0.5 } },
  city: { green: { tMin: 5, tMax: 28, rain: 2 }, yellow: { rain: 8 } },
};
export const CAMPING = { greenRain: 1, redRain: 5, stormGust: 60 };

const THUNDER = new Set([95, 96, 99]);
const f1 = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

/** Gewitter oder Sturmböen → immer rot (Sicherheit). */
function storm(d: DayWeather): string | null {
  if (d.code != null && THUNDER.has(d.code)) return 'Gewitter';
  if (d.gustMax != null && d.gustMax >= CAMPING.stormGust) return `Sturmböen ${Math.round(d.gustMax)} km/h`;
  return null;
}

/** Camping-Wetter ohne Aktivität: nur Regen, Gewitter und Sturm zählen; Schnee ist ideal. */
export function rateCamping(d: DayWeather): Rating {
  const s = storm(d);
  if (s) return { level: 'red', reason: s };
  const rain = d.rain ?? 0;
  if (rain >= CAMPING.redRain) return { level: 'red', reason: `${f1(rain)} mm Regen` };
  if (rain >= CAMPING.greenRain) return { level: 'yellow', reason: `${f1(rain)} mm Regen` };
  if ((d.snowfall ?? 0) >= 0.5) return { level: 'green', reason: `trocken, ${f1(d.snowfall!)} cm Schnee` };
  return { level: 'green', reason: rain > 0 ? `kaum Regen (${f1(rain)} mm)` : 'trocken' };
}

/** Erste nicht erfüllte Bedingung eines Bandes – oder null, wenn alles passt. */
function failing(d: DayWeather, b: Band): string | null {
  const t = d.tmax;
  if (b.snowMin != null && (d.snowDepthCm ?? 0) < b.snowMin) return d.snowDepthCm == null ? 'keine Schneedaten' : `nur ${Math.round(d.snowDepthCm)} cm Schnee`;
  if (b.rain != null && (d.rain ?? 0) >= b.rain) return `${f1(d.rain ?? 0)} mm Regen`;
  if (t != null && b.tMin != null && t < b.tMin) return `kühl (max. ${Math.round(t)} °C)`;
  if (t != null && b.tMax != null && t > b.tMax) return b.snowMin != null ? `Tauwetter (max. ${Math.round(t)} °C)` : `heiß (max. ${Math.round(t)} °C)`;
  if (b.tminMin != null && d.tmin != null && d.tmin < b.tminMin) return `sehr kalt (min. ${Math.round(d.tmin)} °C)`;
  if (b.wind != null && (d.windMax ?? 0) >= b.wind) return `Wind ${Math.round(d.windMax ?? 0)} km/h`;
  return null;
}

/**
 * Bewertung einer Aktivität an einem Tag. `available = false` → grau
 * (z. B. keine Stadt für Städtebesuch, keine Loipe für Langlauf).
 */
export function rateActivity(a: Activity, d: DayWeather, available = true): Rating {
  if (!available) return { level: 'grey', reason: a === 'city' ? 'keine größere Stadt im Gebiet' : 'keine Loipe im Gebiet' };
  const s = storm(d);
  if (s) return { level: 'red', reason: s };
  const r = RULES[a];
  const g = failing(d, r.green);
  if (!g) return { level: 'green', reason: greenReason(a, d) };
  const y = failing(d, r.yellow);
  if (!y) return { level: 'yellow', reason: g };
  return { level: 'red', reason: y };
}

function greenReason(a: Activity, d: DayWeather): string {
  if (a === 'xc_ski') return `${Math.round(d.snowDepthCm ?? 0)} cm Schnee`;
  const t = d.tmax != null ? `${Math.round(d.tmax)} °C` : '';
  return (d.rain ?? 0) < 0.2 ? `trocken, ${t}` : `${t}, ${f1(d.rain ?? 0)} mm Regen`;
}

const ORDER: Record<Level, number> = { green: 3, yellow: 2, red: 1, grey: 0 };

/** Mehrere Tage → Gesamtbewertung nach dem besten Tag (Konzept 6.3). */
export function bestOf(ratings: Rating[]): Rating & { dayIndex: number } {
  let best = -1;
  ratings.forEach((r, i) => { if (best < 0 || ORDER[r.level] > ORDER[ratings[best].level]) best = i; });
  return best < 0 ? { level: 'grey', reason: 'keine Daten', dayIndex: -1 } : { ...ratings[best], dayIndex: best };
}

export const levelScore = (l: Level) => ORDER[l];
