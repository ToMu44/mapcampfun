import { cellToLatLng, cellToParent } from 'h3-js';
import { addDays, diffDays, isForecastDay, toIso } from './period';

export type DayWeather = {
  date: string;
  source: 'forecast' | 'climate';
  tmax: number | null;
  tmin: number | null;
  /** Regen + Schauer in mm (Schneeregen zählt über seinen Regenanteil) */
  rain: number | null;
  /** Neuschnee in cm */
  snowfall: number | null;
  windMax: number | null;
  gustMax: number | null;
  /** WMO-Wettercode, nur bei Prognose */
  code: number | null;
  sunshineH: number | null;
  /** Schneehöhe (Tagesmaximum) in cm */
  snowDepthCm: number | null;
};

export type CellPoint = { id: string; lat: number; lng: number };

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const DAILY = ['temperature_2m_max', 'temperature_2m_min', 'rain_sum', 'showers_sum', 'snowfall_sum', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'weather_code', 'sunshine_duration'];
const CHUNK = 100;
const CLIMATE_YEARS = 3;
const TTL = { forecast: 60 * 60 * 1000, climate: 7 * 24 * 60 * 60 * 1000 };

type OmResponse = {
  daily: Record<string, (number | null)[]> & { time: string[] };
  hourly?: { time: string[]; snow_depth: (number | null)[] };
};

const cache = new Map<string, { t: number; v: DayWeather }>();

/**
 * Wetter für alle Zellen und Tage. Tage bis heute + 15 kommen aus der Prognose,
 * spätere Tage aus dem Mittel der letzten Jahre (Klimatologie, auf gröberem Raster).
 */
export type WeatherResult = { data: Map<string, DayWeather[]>; error: WeatherError | null };
export class WeatherError extends Error {
  constructor(message: string, readonly rateLimited = false) { super(message); }
}

/**
 * Wie loadWeather, bricht aber bei einem Fehler nicht ab: Bereits geladene Gebiete
 * werden trotzdem zurückgegeben, der Fehler steht in `error`.
 */
export async function fetchWeather(cells: CellPoint[], dates: string[], signal?: AbortSignal): Promise<WeatherResult> {
  let error: WeatherError | null = null;
  try {
    await loadWeather(cells, dates, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    error = err instanceof WeatherError ? err : new WeatherError(err instanceof Error ? err.message : String(err));
  }
  return { data: collect(cells, dates), error };
}

async function loadWeather(cells: CellPoint[], dates: string[], signal?: AbortSignal): Promise<void> {
  const fc = dates.filter((d) => isForecastDay(d));
  const cl = dates.filter((d) => !isForecastDay(d) && diffDays(toIso(new Date()), d) > 0);
  if (fc.length) {
    const missing = cells.filter((c) => fc.some((d) => !fromCache(`f:${c.id}:${d}`, 'forecast')));
    for (const part of chunks(missing, CHUNK)) {
      const data = await request(FORECAST_URL, part, fc[0], fc[fc.length - 1], signal);
      data.forEach((r, i) => parse(r, 'forecast').forEach((day) => putCache(`f:${part[i].id}:${day.date}`, day)));
    }
  }

  if (cl.length) {
    // Klimawerte auf Elternzellen (Auflösung 4, ca. 7 Zellen zusammengefasst) – schont das Abfragekontingent
    const parents = new Map<string, CellPoint>();
    for (const c of cells) {
      const pid = cellToParent(c.id, 4);
      if (!parents.has(pid)) { const [lat, lng] = cellToLatLng(pid); parents.set(pid, { id: pid, lat, lng }); }
    }
    const missing = [...parents.values()].filter((p) => cl.some((d) => !fromCache(`c:${p.id}:${d}`, 'climate')));
    if (missing.length) {
      const offsets = climateYearOffsets(cl[cl.length - 1]);
      const perYear: DayWeather[][][] = [];
      for (const off of offsets) {
        const rows: DayWeather[][] = [];
        for (const part of chunks(missing, CHUNK)) {
          const data = await request(ARCHIVE_URL, part, shiftYears(cl[0], -off), shiftYears(cl[cl.length - 1], -off), signal);
          rows.push(...data.map((r) => parse(r, 'climate')));
        }
        perYear.push(rows);
      }
      missing.forEach((p, i) => {
        cl.forEach((d, j) => putCache(`c:${p.id}:${d}`, average(d, perYear.map((y) => y[i]?.[j]).filter(Boolean) as DayWeather[])));
      });
    }
  }
}

/** Alles, was im Cache liegt, je Gebiet zusammenstellen (nur vollständige Gebiete). */
function collect(cells: CellPoint[], dates: string[]): Map<string, DayWeather[]> {
  const out = new Map<string, DayWeather[]>();
  for (const c of cells) {
    const pid = cellToParent(c.id, 4);
    const days = dates.map((d) => fromCache(`f:${c.id}:${d}`, 'forecast') ?? fromCache(`c:${pid}:${d}`, 'climate'));
    if (days.every(Boolean)) out.set(c.id, days as DayWeather[]);
  }
  return out;
}

async function request(base: string, pts: CellPoint[], start: string, end: string, signal?: AbortSignal): Promise<OmResponse[]> {
  const params = new URLSearchParams({
    latitude: pts.map((p) => p.lat.toFixed(3)).join(','),
    longitude: pts.map((p) => p.lng.toFixed(3)).join(','),
    daily: DAILY.join(','),
    hourly: 'snow_depth',
    timezone: 'Europe/Berlin',
    start_date: start,
    end_date: end,
  });
  let res: Response;
  try {
    res = await fetch(`${base}?${params}`, { signal });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new WeatherError('Wetterdienst nicht erreichbar – Internetverbindung prüfen.');
  }
  if (!res.ok) {
    if (res.status === 429) throw new WeatherError('Abfragelimit des Wetterdienstes erreicht – neuer Versuch in einer Minute.', true);
    throw new WeatherError(`Wetterdienst nicht erreichbar (HTTP ${res.status}).`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [json];
}

export function parse(r: OmResponse, source: DayWeather['source']): DayWeather[] {
  const d = r.daily;
  const depth = new Map<string, number>();
  if (r.hourly) {
    r.hourly.time.forEach((t, i) => {
      const v = r.hourly!.snow_depth[i];
      if (v == null) return;
      const day = t.slice(0, 10);
      depth.set(day, Math.max(depth.get(day) ?? 0, v * 100));
    });
  }
  return d.time.map((date, i) => {
    const rain = d.rain_sum?.[i];
    const showers = d.showers_sum?.[i];
    return {
      date,
      source,
      tmax: d.temperature_2m_max?.[i] ?? null,
      tmin: d.temperature_2m_min?.[i] ?? null,
      rain: rain == null && showers == null ? null : (rain ?? 0) + (showers ?? 0),
      snowfall: d.snowfall_sum?.[i] ?? null,
      windMax: d.wind_speed_10m_max?.[i] ?? null,
      gustMax: d.wind_gusts_10m_max?.[i] ?? null,
      code: source === 'forecast' ? (d.weather_code?.[i] ?? null) : null,
      sunshineH: d.sunshine_duration?.[i] == null ? null : d.sunshine_duration[i]! / 3600,
      snowDepthCm: depth.has(date) ? depth.get(date)! : null,
    };
  });
}

/** Mittel über mehrere Jahre. Wettercode (Gewitter) ist im Mittel nicht sinnvoll und entfällt. */
export function average(date: string, days: DayWeather[]): DayWeather {
  const avg = (k: keyof DayWeather) => {
    const v = days.map((d) => d[k]).filter((x): x is number => typeof x === 'number');
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  return { date, source: 'climate', tmax: avg('tmax'), tmin: avg('tmin'), rain: avg('rain'), snowfall: avg('snowfall'), windMax: avg('windMax'), gustMax: avg('gustMax'), code: null, sunshineH: avg('sunshineH'), snowDepthCm: avg('snowDepthCm') };
}

/** Die letzten Jahre, für die der Zeitraum sicher im Archiv liegt (Archiv hat einige Tage Verzug). */
export function climateYearOffsets(lastDate: string, today: Date = new Date()): number[] {
  const limit = addDays(toIso(today), -7);
  const out: number[] = [];
  for (let off = 1; out.length < CLIMATE_YEARS && off < 10; off++) if (shiftYears(lastDate, -off) <= limit) out.push(off);
  return out;
}

function shiftYears(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const day = m === 2 && d === 29 ? 28 : d;
  return `${y + n}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function chunks<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function fromCache(key: string, kind: keyof typeof TTL): DayWeather | undefined {
  const e = cache.get(key);
  return e && Date.now() - e.t < TTL[kind] ? e.v : undefined;
}
function putCache(key: string, v: DayWeather) {
  cache.set(key, { t: Date.now(), v });
}

const WMO: Record<number, string> = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 48: '🌫️', 51: '🌦️', 53: '🌦️', 55: '🌧️', 56: '🌧️', 57: '🌧️', 61: '🌦️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️', 71: '🌨️', 73: '🌨️', 75: '❄️', 77: '🌨️', 80: '🌦️', 81: '🌧️', 82: '🌧️', 85: '🌨️', 86: '❄️', 95: '⛈️', 96: '⛈️', 99: '⛈️' };
export function weatherIcon(day: DayWeather): string {
  if (day.code != null) return WMO[day.code] ?? '·';
  if ((day.snowfall ?? 0) >= 1) return '🌨️';
  if ((day.rain ?? 0) >= 1) return '🌧️';
  return (day.sunshineH ?? 0) >= 5 ? '🌤️' : '⛅';
}
