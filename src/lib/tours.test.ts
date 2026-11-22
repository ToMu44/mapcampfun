import { describe, expect, it } from 'vitest';
import { tourHint } from './tours';
import { parseDistance, type CellData } from './osm';

const site = { lat: 49.8, lng: 10 };
const base: CellData = { sites: [], wineries: [], farms: [], routes: [], pistes: [] };

describe('tourHint', () => {
  it('bevorzugt lokale Wege vor Fernwegen', () => {
    const data: CellData = { ...base, routes: [
      { key: 'r/1', name: 'Fränkischer Rotwein-Wanderweg', kind: 'hiking', network: 'rwn', distanceKm: 70, bounds: { minlat: 49.7, minlon: 9.9, maxlat: 49.9, maxlon: 10.1 } },
      { key: 'r/2', name: 'Rundweg Am Mainufer', kind: 'hiking', network: 'lwn', distanceKm: 8.5, bounds: { minlat: 49.81, minlon: 10, maxlat: 49.83, maxlon: 10.02 } },
      { key: 'r/3', name: 'Mainradweg', kind: 'cycling', network: 'rcn', distanceKm: 600, bounds: { minlat: 49, minlon: 9, maxlat: 50.5, maxlon: 11 } },
    ] };
    const h = tourHint('hiking', site, data, null)!;
    expect(h.startsWith('Wanderweg „Rundweg Am Mainufer“ (9 km, lokal')).toBe(true);
    expect(h).toContain('Rotwein-Wanderweg');
    expect(tourHint('cycling', site, data, null)).toBe('Radweg „Mainradweg“ (600 km, regional, ab Platz)');
  });
  it('null, wenn nichts in der Nähe', () => {
    expect(tourHint('hiking', site, base, null)).toBeNull();
  });
  it('Städtebesuch: nächste Stadt ≥ 20 000 Einwohner', () => {
    const towns = [{ name: 'Kitzingen', lat: 49.74, lng: 10.16, population: 22000, oldTown: false }, { name: 'Dettelbach', lat: 49.8, lng: 10.16, population: 7000, oldTown: false }];
    expect(tourHint('city', site, base, towns)).toBe('Kitzingen (13 km)');
  });
});

describe('parseDistance', () => {
  it('liest km und m', () => {
    expect(parseDistance('12,5 km')).toBe(12.5);
    expect(parseDistance('8')).toBe(8);
    expect(parseDistance('800 m')).toBe(0.8);
  });
});
