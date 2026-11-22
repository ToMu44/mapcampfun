import { describe, expect, it } from 'vitest';
import { daysBetween, nextWeekend } from './period';
import { climateYearOffsets } from './weather';

describe('nextWeekend', () => {
  it('Sonntag → Fr–So der nächsten Woche', () => {
    expect(nextWeekend(new Date(2026, 10, 22))).toEqual({ start: '2026-11-27', end: '2026-11-29' });
  });
  it('Mittwoch → Fr–So derselben Woche', () => {
    expect(nextWeekend(new Date(2026, 10, 25))).toEqual({ start: '2026-11-27', end: '2026-11-29' });
  });
  it('Samstag → heute bis Sonntag', () => {
    expect(nextWeekend(new Date(2026, 10, 28))).toEqual({ start: '2026-11-28', end: '2026-11-29' });
  });
});

describe('daysBetween', () => {
  it('über den Monatswechsel', () => {
    expect(daysBetween('2026-11-29', '2026-12-01')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });
});

describe('climateYearOffsets', () => {
  it('nimmt die letzten 3 Jahre, deren Daten im Archiv liegen', () => {
    expect(climateYearOffsets('2027-01-10', new Date(2026, 10, 22))).toEqual([1, 2, 3]);
    expect(climateYearOffsets('2027-11-20', new Date(2026, 10, 22))).toEqual([2, 3, 4]);
  });
});
