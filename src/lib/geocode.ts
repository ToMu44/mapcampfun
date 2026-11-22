import type { Place } from './storage';

const BASE = 'https://nominatim.openstreetmap.org';

type NominatimResult = { lat: string; lon: string; display_name: string };

/**
 * Adresssuche über Nominatim, auf Deutschland beschränkt.
 * Wird nur auf ausdrückliche Suche ausgelöst (Enter/Button), damit die
 * Nutzungsregel von max. 1 Anfrage/s sicher eingehalten wird.
 */
export async function searchAddress(query: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL(`${BASE}/search`);
  url.search = new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'de', limit: '5', 'accept-language': 'de' }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Adresssuche fehlgeschlagen (HTTP ${res.status})`);
  const data = (await res.json()) as NominatimResult[];
  return data.map((r) => ({ lat: +r.lat, lng: +r.lon, label: shortLabel(r.display_name), fullLabel: r.display_name }));
}

/** Kurzname (Ort) für einen Punkt, z. B. für den Geolocation-Standort. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = new URL(`${BASE}/reverse`);
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', zoom: '12', 'accept-language': 'de' }).toString();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const d = (await res.json()) as { address?: Record<string, string>; display_name?: string };
    const a = d.address ?? {};
    return a.city ?? a.town ?? a.village ?? a.municipality ?? d.display_name ?? 'Aktueller Standort';
  } catch {
    return 'Aktueller Standort';
  }
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Ortung wird von diesem Browser nicht unterstützt.'));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  });
}

export function geolocationErrorText(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as GeolocationPositionError).code;
    if (code === 1) return 'Ortung nicht erlaubt. Bitte Adresse eingeben oder in Safari die Standortfreigabe erlauben.';
    if (code === 2) return 'Standort konnte nicht ermittelt werden.';
    if (code === 3) return 'Ortung hat zu lange gedauert.';
  }
  return err instanceof Error ? err.message : 'Ortung fehlgeschlagen.';
}

/** „Freiburg im Breisgau, Baden-Württemberg, Deutschland“ → „Freiburg im Breisgau, Baden-Württemberg“ */
export function shortLabel(displayName: string): string {
  return displayName.split(', ').filter((p) => p !== 'Deutschland').slice(0, 2).join(', ');
}
