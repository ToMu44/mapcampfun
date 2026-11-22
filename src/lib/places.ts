import OpeningHours from 'opening_hours';
import { distanceKm, type LatLng } from './geo';

export type PlaceType = 'camping' | 'stellplatz' | 'privat' | 'bauernhof' | 'weingut' | 'sonstiges';

export const PLACE_TYPES: { id: PlaceType; label: string; icon: string }[] = [
  { id: 'camping', label: 'Campingplatz', icon: '⛺' },
  { id: 'stellplatz', label: 'Stellplatz / Reisemobilhafen', icon: '🚐' },
  { id: 'privat', label: 'Privater Stellplatz', icon: '🏠' },
  { id: 'bauernhof', label: 'Bauernhof', icon: '🐄' },
  { id: 'weingut', label: 'Weingut', icon: '🍇' },
  { id: 'sonstiges', label: 'Sonstiges (z. B. Tiercamping)', icon: '✨' },
];
export const placeTypeInfo = (t: PlaceType) => PLACE_TYPES.find((x) => x.id === t)!;

export type Tags = Record<string, string>;
export type OpenStatus = { state: 'open' | 'closed' | 'unknown'; text: string };

export type CampPlace = LatLng & {
  /** z. B. "node/123" – eindeutig und direkt als OSM-Link verwendbar */
  key: string;
  name: string;
  type: PlaceType;
  tags: Tags;
  lastEdit: string | null;
};

/** Nachbarobjekte im Umkreis (Weingüter, Höfe) für die Typ-Zuordnung */
export type Neighbours = { wineries: LatLng[]; farms: LatLng[] };
const NEAR_KM = 0.2;

const isYes = (v?: string) => v === 'yes' || v === 'designated';
const isNo = (v?: string) => v === 'no';

/**
 * Nur Plätze, die ausdrücklich als Übernachtungsplatz erfasst sind und auf denen ein
 * Wohnmobil erlaubt ist. Zelt-/Trekkingplätze, Gruppenplätze und Stillgelegtes fallen raus.
 */
export function isUsable(t: Tags): boolean {
  if (t.tourism !== 'camp_site' && t.tourism !== 'caravan_site') return false;
  if (t.disused || t['disused:tourism'] || t.abandoned || isNo(t.access)) return false;
  if (isNo(t.motorhome)) return false;
  if (t.tourism === 'camp_site') {
    if (isYes(t.backcountry) || t.camp_site === 'backcountry' || isYes(t.group_only) || isYes(t.scout)) return false;
    if (isNo(t.caravans) && !isYes(t.motorhome)) return false;
  }
  return true;
}

const FARM_NAME = /(bauernhof|hofgut|ferienhof|erlebnishof|reiterhof|biohof|bio-hof|landhof|gutshof|hofladen)/i;
const WINE_NAME = /(weingut|winzer|weinhof|weinbau|sektgut|weinkeller)/i;
const OTHER_NAME = /(alpaka|alpaca|lama|tierpark|glamping|tipi|baumhaus|wildpark)/i;

/**
 * Typ-Zuordnung (Konzept 7.1). Reihenfolge: Weingut > Bauernhof > Sonstiges > privat > Stellplatz/Camping.
 * Weingut/Hof wird über eigene Merkmale, den Namen oder ein Weingut/einen Hof in max. 200 m erkannt.
 */
export function classify(t: Tags, pos: LatLng, n: Neighbours): PlaceType {
  const name = t.name ?? '';
  const near = (list: LatLng[]) => list.some((p) => distanceKm(pos, p) <= NEAR_KM);
  if (t.craft === 'winery' || t.shop === 'wine' || WINE_NAME.test(name) || near(n.wineries)) return 'weingut';
  if (isYes(t.farm) || t.shop === 'farm' || t.place === 'farm' || FARM_NAME.test(name) || near(n.farms)) return 'bauernhof';
  if (OTHER_NAME.test(name) || isYes(t.animals)) return 'sonstiges';
  if (t['operator:type'] === 'private' || t.access === 'customers' || t.access === 'private' || t.access === 'permit') return 'privat';
  return t.tourism === 'caravan_site' ? 'stellplatz' : 'camping';
}

export function defaultName(type: PlaceType): string {
  return placeTypeInfo(type).label.split(' /')[0] + ' (ohne Namen)';
}

/**
 * Geöffnet im Zeitraum? Ausgewertet wird `opening_hours` (inkl. Saisonangaben wie „Apr-Oct“).
 * „offen“, wenn an mindestens einem Tag geöffnet; „geschlossen“, wenn an keinem Tag.
 */
export function openStatus(t: Tags, dates: string[], pos: LatLng): OpenStatus {
  const raw = t.opening_hours;
  if (!raw) return { state: 'unknown', text: t.seasonal && t.seasonal !== 'no' ? `saisonal (${t.seasonal})` : 'Öffnung unbekannt' };
  try {
    const oh = new OpeningHours(raw, { lat: String(pos.lat), lon: String(pos.lng), address: { country_code: 'de', state: '' } });
    let unknownOnly = true;
    const openDays = dates.filter((d) => {
      const [y, m, day] = d.split('-').map(Number);
      // Intervall = [von, bis, unbekannt, Kommentar]; „unbekannt“ z. B. bei „nach Absprache“
      const iv = oh.getOpenIntervals(new Date(y, m - 1, day, 0, 0), new Date(y, m - 1, day, 23, 59));
      if (iv.some((x) => !x[2])) unknownOnly = false;
      return iv.length > 0;
    });
    if (openDays.length > 0 && unknownOnly) return { state: 'unknown', text: `laut Angabe: ${raw}` };
    if (openDays.length === 0) return { state: 'closed', text: `im Zeitraum geschlossen (${raw})` };
    if (openDays.length < dates.length) return { state: 'open', text: `teilweise geöffnet (${raw})` };
    return { state: 'open', text: raw === '24/7' ? 'ganzjährig, rund um die Uhr' : `geöffnet (${raw})` };
  } catch {
    return { state: 'unknown', text: `Angabe nicht auswertbar: ${raw}` };
  }
}

export type Facility = { label: string; value: boolean | null; detail?: string };

const yn = (v?: string): boolean | null => (v == null ? null : v === 'no' ? false : true);

export function facilities(t: Tags): Facility[] {
  return [
    { label: 'Strom', value: yn(t.power_supply) },
    { label: 'Frischwasser', value: yn(t.drinking_water ?? t.water_point) },
    { label: 'Entsorgung', value: yn(t.sanitary_dump_station ?? t['waste_disposal']) },
    { label: 'WC', value: yn(t.toilets) },
    { label: 'Dusche', value: yn(t.shower) },
    { label: 'WLAN', value: yn(t.internet_access && t.internet_access !== 'no' ? 'yes' : t.internet_access) },
    { label: 'Hunde', value: yn(t.dog), detail: t.dog === 'leashed' ? 'an der Leine' : undefined },
  ];
}

export function costText(t: Tags): string | null {
  if (t.charge) return t.charge;
  if (t.fee === 'no') return 'kostenlos';
  if (t.fee === 'yes') return 'kostenpflichtig (Betrag unbekannt)';
  return null;
}

export function bookingText(t: Tags): string | null {
  const r = t.reservation;
  if (!r) return null;
  return ({ required: 'Reservierung erforderlich', recommended: 'Reservierung empfohlen', yes: 'Reservierung möglich', no: 'keine Reservierung' } as Record<string, string>)[r] ?? r;
}

export function website(t: Tags): string | null {
  const w = t.website ?? t['contact:website'] ?? t.url;
  if (!w) return null;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

export function capacityText(t: Tags): string | null {
  const c = t['capacity:motorhomes'] ?? t['capacity:caravans'] ?? t.capacity;
  return c ? `${c} Plätze` : null;
}

export const osmUrl = (key: string) => `https://www.openstreetmap.org/${key}`;
export const appleMapsUrl = (p: LatLng) => `https://maps.apple.com/?daddr=${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
