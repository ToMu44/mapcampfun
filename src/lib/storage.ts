import { get, set } from 'idb-keyval';
import type { LatLng } from './geo';
import type { Activity } from './rating';
import type { PlaceType } from './places';

export type Place = LatLng & { label: string; fullLabel?: string };

export type Settings = {
  home: Place | null;
  radiusKm: number;
  /** H3-Auflösung des Rasters (5 ≈ 17 km Zellen) */
  hexResolution: number;
  rank1: Activity | null;
  rank2: Activity | null;
  /** Mindest-Einwohnerzahl für „Städtebesuch“ */
  cityMinPopulation: number;
  /** ausgeblendete Platztypen */
  hiddenTypes: PlaceType[];
};

export const DEFAULT_SETTINGS: Settings = { home: null, radiusKm: 150, hexResolution: 5, rank1: null, rank2: null, cityMinPopulation: 20000, hiddenTypes: [] };

const KEY = 'settings-v1';

/** Lesen ist fehlertolerant: ohne Speicher (z. B. privates Fenster) gelten die Standardwerte. */
export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await get<Partial<Settings>>(KEY);
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await set(KEY, s);
  } catch {
    /* Speichern nicht möglich – App läuft trotzdem weiter */
  }
}
