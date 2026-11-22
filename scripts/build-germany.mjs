// Erzeugt src/data/germany.json (Landesgrenze Deutschland) aus world-atlas (Natural Earth 1:50m).
import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url)));
const fc = feature(topo, topo.objects.countries);
const de = fc.features.find((f) => f.id === '276');
if (!de) throw new Error('Deutschland (276) nicht gefunden');
const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(4), +c[1].toFixed(4)] : c.map(round));
const out = { type: 'Feature', properties: { name: 'Deutschland' }, geometry: { type: de.geometry.type, coordinates: round(de.geometry.coordinates) } };
writeFileSync(new URL('../src/data/germany.json', import.meta.url), JSON.stringify(out));
console.log('germany.json:', de.geometry.type, JSON.stringify(out).length, 'Bytes');
