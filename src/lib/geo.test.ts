import { describe, expect, it } from 'vitest';
import { buildGrid, distanceKm, isInGermany } from './geo';

describe('distanceKm', () => {
  it('Berlin → München ≈ 504 km', () => {
    expect(distanceKm({ lat: 52.52, lng: 13.405 }, { lat: 48.137, lng: 11.575 })).toBeCloseTo(504, -1);
  });
});

describe('isInGermany', () => {
  it('erkennt Orte in und außerhalb Deutschlands', () => {
    expect(isInGermany({ lat: 50.94, lng: 6.96 })).toBe(true); // Köln
    expect(isInGermany({ lat: 47.56, lng: 7.59 })).toBe(false); // Basel
    expect(isInGermany({ lat: 48.86, lng: 2.35 })).toBe(false); // Paris
  });
});

describe('buildGrid', () => {
  it('150 km um Kassel: ca. 280 Zellen, alle im Radius', () => {
    const center = { lat: 51.31, lng: 9.48 };
    const grid = buildGrid(center, 150, 5);
    expect(grid.features.length).toBeGreaterThan(220);
    expect(grid.features.length).toBeLessThan(340);
    for (const f of grid.features) expect(f.properties.distanceKm).toBeLessThanOrEqual(150);
  });

  it('schneidet an der Grenze ab: Freiburg hat deutlich weniger Zellen', () => {
    const inner = buildGrid({ lat: 51.31, lng: 9.48 }, 150, 5).features.length;
    const border = buildGrid({ lat: 47.99, lng: 7.85 }, 150, 5).features.length;
    expect(border).toBeLessThan(inner * 0.6);
    for (const f of buildGrid({ lat: 47.99, lng: 7.85 }, 150, 5).features) {
      expect(isInGermany({ lat: f.properties.lat, lng: f.properties.lng })).toBe(true);
    }
  });
});
