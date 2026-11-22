import { describe, expect, it } from 'vitest';
import { bestOf, rateActivity, rateCamping } from './rating';
import type { DayWeather } from './weather';

const day = (p: Partial<DayWeather>): DayWeather => ({ date: '2026-11-27', source: 'forecast', tmax: 15, tmin: 5, rain: 0, snowfall: 0, windMax: 10, gustMax: 20, code: 1, sunshineH: 6, snowDepthCm: 0, ...p });

describe('Camping-Wetter', () => {
  it('Regen bestimmt die Farbe, Temperatur nicht', () => {
    expect(rateCamping(day({ rain: 0.5, tmax: -5 })).level).toBe('green');
    expect(rateCamping(day({ rain: 1 })).level).toBe('yellow');
    expect(rateCamping(day({ rain: 4.9 })).level).toBe('yellow');
    expect(rateCamping(day({ rain: 5 })).level).toBe('red');
  });
  it('Schnee ist ideal', () => {
    const r = rateCamping(day({ snowfall: 12, rain: 0, code: 75 }));
    expect(r.level).toBe('green');
    expect(r.reason).toContain('Schnee');
  });
  it('Gewitter und Sturmböen sind immer rot', () => {
    expect(rateCamping(day({ code: 95 })).level).toBe('red');
    expect(rateCamping(day({ gustMax: 60 })).reason).toBe('Sturmböen 60 km/h');
  });
});

describe('Aktivitäten', () => {
  it('Wandern: grün, gelb, rot mit Begründung', () => {
    expect(rateActivity('hiking', day({ tmax: 18 })).level).toBe('green');
    const y = rateActivity('hiking', day({ tmax: 18, rain: 3 }));
    expect(y).toEqual({ level: 'yellow', reason: '3 mm Regen' });
    expect(rateActivity('hiking', day({ tmax: -3 })).level).toBe('red');
  });
  it('Radfahren ist windempfindlicher als Wandern', () => {
    const d = day({ tmax: 18, windMax: 28 });
    expect(rateActivity('hiking', d).level).toBe('green');
    expect(rateActivity('cycling', d).level).toBe('yellow');
  });
  it('Langlauf braucht Schnee und Frost', () => {
    expect(rateActivity('xc_ski', day({ snowDepthCm: 30, tmax: -3, tmin: -8 })).level).toBe('green');
    expect(rateActivity('xc_ski', day({ snowDepthCm: 15, tmax: -3, tmin: -8 })).level).toBe('yellow');
    expect(rateActivity('xc_ski', day({ snowDepthCm: 30, tmax: 2, tmin: -2 })).level).toBe('yellow');
    expect(rateActivity('xc_ski', day({ snowDepthCm: 5, tmax: -3 })).level).toBe('red');
    expect(rateActivity('xc_ski', day({ snowDepthCm: 30, tmax: -1, rain: 2 })).level).toBe('red');
  });
  it('ohne Stadt bzw. Loipe grau', () => {
    expect(rateActivity('city', day({}), false).level).toBe('grey');
  });
});

describe('bestOf', () => {
  it('nimmt den besten Tag', () => {
    const r = bestOf([{ level: 'red', reason: 'a' }, { level: 'green', reason: 'b' }, { level: 'yellow', reason: 'c' }]);
    expect(r).toEqual({ level: 'green', reason: 'b', dayIndex: 1 });
  });
});
