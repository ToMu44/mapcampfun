import { get, set } from 'idb-keyval';
import type { PlaceType } from './places';

export type WatchItem = {
  key: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  /** nächster Ort, z. B. „bei Lohr a. Main“ */
  place: string | null;
  cellId: string;
  website: string | null;
  addedAt: string;
  note: string;
};

const KEY = 'watchlist-v1';

export async function loadWatchlist(): Promise<WatchItem[]> {
  try {
    return (await get<WatchItem[]>(KEY)) ?? [];
  } catch {
    return [];
  }
}

export async function saveWatchlist(items: WatchItem[]): Promise<void> {
  try {
    await set(KEY, items);
  } catch {
    /* Speichern nicht möglich (z. B. privates Fenster) */
  }
}
