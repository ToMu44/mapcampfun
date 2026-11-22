import { describe, expect, it } from 'vitest';
import { classify, costText, isUsable, openStatus } from './places';

const pos = { lat: 49.8, lng: 10 };
const none = { wineries: [], farms: [] };

describe('isUsable', () => {
  it('nimmt Camping- und Stellplätze', () => {
    expect(isUsable({ tourism: 'camp_site' })).toBe(true);
    expect(isUsable({ tourism: 'caravan_site' })).toBe(true);
  });
  it('schließt Plätze ohne Wohnmobil aus', () => {
    expect(isUsable({ tourism: 'camp_site', backcountry: 'yes' })).toBe(false);
    expect(isUsable({ tourism: 'camp_site', caravans: 'no' })).toBe(false);
    expect(isUsable({ tourism: 'camp_site', caravans: 'no', motorhome: 'yes' })).toBe(true);
    expect(isUsable({ tourism: 'caravan_site', motorhome: 'no' })).toBe(false);
    expect(isUsable({ tourism: 'camp_site', group_only: 'yes' })).toBe(false);
    expect(isUsable({ tourism: 'camp_site', 'disused:tourism': 'camp_site' })).toBe(false);
    expect(isUsable({ amenity: 'parking' })).toBe(false);
  });
});

describe('classify', () => {
  it('Grundtypen', () => {
    expect(classify({ tourism: 'camp_site', name: 'Camping Mainblick' }, pos, none)).toBe('camping');
    expect(classify({ tourism: 'caravan_site', name: 'Wohnmobilstellplatz am Main' }, pos, none)).toBe('stellplatz');
  });
  it('privat über Betreiber oder Zugang', () => {
    expect(classify({ tourism: 'caravan_site', access: 'customers' }, pos, none)).toBe('privat');
    expect(classify({ tourism: 'caravan_site', 'operator:type': 'private' }, pos, none)).toBe('privat');
  });
  it('Weingut über Tag, Namen oder Nachbarschaft (≤ 200 m)', () => {
    expect(classify({ tourism: 'caravan_site', name: 'Weingut Müller' }, pos, none)).toBe('weingut');
    expect(classify({ tourism: 'caravan_site', craft: 'winery' }, pos, none)).toBe('weingut');
    expect(classify({ tourism: 'caravan_site' }, pos, { wineries: [{ lat: 49.8009, lng: 10 }], farms: [] })).toBe('weingut');
    expect(classify({ tourism: 'caravan_site' }, pos, { wineries: [{ lat: 49.81, lng: 10 }], farms: [] })).toBe('stellplatz');
  });
  it('Bauernhof, aber nicht jeder Name mit „hof“', () => {
    expect(classify({ tourism: 'caravan_site', name: 'Ferienhof Sonnenschein' }, pos, none)).toBe('bauernhof');
    expect(classify({ tourism: 'camp_site', name: 'Campingplatz Seehof' }, pos, none)).toBe('camping');
    expect(classify({ tourism: 'caravan_site' }, pos, { wineries: [], farms: [{ lat: 49.8005, lng: 10.001 }] })).toBe('bauernhof');
  });
  it('Sonstiges, z. B. Alpaka-Camping', () => {
    expect(classify({ tourism: 'camp_site', name: 'Alpaka-Hof Camping' }, pos, none)).toBe('sonstiges');
    expect(classify({ tourism: 'camp_site', name: 'Alpakacamping Waldrand' }, pos, none)).toBe('sonstiges');
  });
});

describe('openStatus', () => {
  const winter = ['2026-11-27', '2026-11-28', '2026-11-29'];
  it('Saisonbetrieb im Winter geschlossen', () => {
    expect(openStatus({ opening_hours: 'Apr-Oct' }, winter, pos).state).toBe('closed');
    expect(openStatus({ opening_hours: 'Apr-Oct' }, ['2026-06-05'], pos).state).toBe('open');
  });
  it('24/7 offen, fehlend oder fehlerhaft unbekannt', () => {
    expect(openStatus({ opening_hours: '24/7' }, winter, pos).state).toBe('open');
    expect(openStatus({}, winter, pos).state).toBe('unknown');
    expect(openStatus({ opening_hours: 'nach Absprache' }, winter, pos).state).toBe('unknown');
  });
});

describe('costText', () => {
  it('Betrag vor Ja/Nein', () => {
    expect(costText({ fee: 'yes', charge: '12 EUR/Nacht' })).toBe('12 EUR/Nacht');
    expect(costText({ fee: 'no' })).toBe('kostenlos');
    expect(costText({})).toBeNull();
  });
});
