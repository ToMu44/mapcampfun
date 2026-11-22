/** Datumshilfen. Alle Daten als ISO-Strings „JJJJ-MM-TT“ in lokaler Zeit. */

export const FORECAST_DAYS = 16; // Open-Meteo: heute + 15 Tage
export const MAX_SPAN_DAYS = 14;

export function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86400000);
}

/**
 * „Kommendes Wochenende“ (Fr–So):
 * Mo–Do → Fr–So dieser Woche · Fr/Sa → heute bis So · So → Fr–So der nächsten Woche.
 */
export function nextWeekend(today: Date = new Date()): { start: string; end: string } {
  const t = toIso(today);
  const wd = today.getDay(); // 0 = So … 6 = Sa
  if (wd === 5 || wd === 6) return { start: t, end: addDays(t, 7 - wd) };
  const toFriday = wd === 0 ? 5 : 5 - wd;
  const start = addDays(t, toFriday);
  return { start, end: addDays(start, 2) };
}

export function daysBetween(start: string, end: string): string[] {
  const n = diffDays(start, end);
  return Array.from({ length: Math.max(0, n) + 1 }, (_, i) => addDays(start, i));
}

/** Liegt der Tag im Prognosezeitraum (heute bis heute + 15)? */
export function isForecastDay(iso: string, today: Date = new Date()): boolean {
  const d = diffDays(toIso(today), iso);
  return d >= 0 && d < FORECAST_DAYS;
}

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export function dayLabel(iso: string): string {
  const d = fromIso(iso);
  return `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
}
