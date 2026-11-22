import { describe, expect, it } from 'vitest';
import { displayLevel, evaluateCell, suggestions } from './evaluate';
import type { DayWeather } from './weather';
import type { CellProps } from './geo';

const day = (p: Partial<DayWeather>): DayWeather => ({ date: '2026-11-27', source: 'forecast', tmax: 15, tmin: 5, rain: 0, snowfall: 0, windMax: 10, gustMax: 20, code: 1, sunshineH: 6, snowDepthCm: 0, ...p });
const cell = (id: string, km: number): CellProps => ({ id, lat: 50, lng: 10, distanceKm: km });

describe('evaluateCell', () => {
  it('ohne Aktivität: Camping-Wetter; Rang 2 nur mit Rang 1', () => {
    const e = evaluateCell('a', [day({ rain: 3 })], null, 'hiking', { city: null, loipe: null });
    expect(e.primary[0].level).toBe('yellow');
    expect(e.secondary).toBeNull();
  });
  it('Städtebesuch ohne Stadt im Gebiet → grau', () => {
    const e = evaluateCell('a', [day({})], 'hiking', 'city', { city: new Set(['b']), loipe: null });
    expect(e.primary[0].level).toBe('green');
    expect(e.secondary![0].level).toBe('grey');
  });
});

describe('displayLevel', () => {
  it('Gesamt = bester Tag, sonst gewählter Tag', () => {
    const r = [{ level: 'red' as const, reason: '' }, { level: 'yellow' as const, reason: '' }];
    expect(displayLevel(r, -1)).toBe('yellow');
    expect(displayLevel(r, 0)).toBe('red');
    expect(displayLevel(null, -1)).toBe('none');
  });
});

describe('suggestions', () => {
  it('sortiert nach Gebieten mit „sehr gut“ und schlägt das nächstgelegene vor', () => {
    const cells = [cell('a', 80), cell('b', 20)];
    const w = new Map([['a', [day({ tmax: 18 })]], ['b', [day({ tmax: 18 })]]]);
    const s = suggestions(cells, w, { city: new Set(['a']), loipe: null }, [{ name: 'Testort', lat: 50, lng: 10, population: 30000, oldTown: false }], true);
    expect(s.map((x) => x.activity)).toEqual(['hiking', 'cycling', 'city']);
    expect(s[0].cell.id).toBe('b');
    expect(s[2]).toMatchObject({ activity: 'city', count: 1, place: 'Testort' });
  });
});
