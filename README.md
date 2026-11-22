# MapCampFun – Wohnmobil-Wochenendplaner

Web-App (PWA) für iPad und Mac: Wo ist am Wochenende gutes Wetter für Camping und Outdoor-Aktivitäten, und welche Stellplätze gibt es dort?
Ausschließlich kostenlose, offene Datenquellen (OpenStreetMap, Open-Meteo, Nominatim). Kein Backend, alle persönlichen Daten bleiben auf dem Gerät.

Vollständige Spezifikation: [docs/KONZEPT.md](docs/KONZEPT.md)

## Stand

| Stufe | Inhalt | Status |
|---|---|---|
| 1 | Karte, Standort/Adresse/Heimat, Radius, Hexagon-Raster, Landesgrenze | ✅ |
| 2 | Wetter, Bewertung, Aktivitäten, Tages-Schieberegler, Infofeld | ✅ |
| 3 | Plätze aus OSM, Symbole, Popup, Touren | offen |
| 4 | Merkliste | offen |
| 5 | Einstellungen, Backup, PWA/Offline | offen |

## Umsetzungsdetails Stufe 2

- Wetter: Open-Meteo, je Gebiet der Zellmittelpunkt; Tage ab heute + 16 aus dem Mittel der letzten 3 Jahre (Archiv, gröberes Raster). Zwischenspeicher: Prognose 1 h, Klimawerte 7 Tage.
- Abfragelimit (ca. 600 Gebiete/Minute): bei Überschreitung werden geladene Gebiete gezeigt und nach 65 s automatisch nachgeladen.
- Langlauf: „kein Regen“ = unter 0,5 mm; Temperaturbereich gilt für Tageshöchst- (≤ 0 °C) und Tiefstwert (≥ −12 °C).
- Städtebesuch: Orte (`place=city|town`) ab 20 000 Einwohnern oder als „Altstadt“ benannter Stadtteil im Gebiet. Loipen: `piste:type=nordic`.
- Overpass: Hauptserver, bei Fehler Spiegel `overpass.private.coffee`.
- Zeitraum: höchstens 14 Tage am Stück.

## Entwicklung

```bash
npm install
npm run dev      # lokaler Server
npm test         # Tests
npm run build    # Produktions-Build nach dist/
```

## Veröffentlichung

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages:
`https://tomu44.github.io/mapcampfun/`

Einmalig im Repository einstellen: **Settings → Pages → Source: „GitHub Actions“**.

## Datenquellen & Lizenzen

- Kartendaten © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende, Kacheln: [OpenFreeMap](https://openfreemap.org)
- Adresssuche: [Nominatim](https://nominatim.org) (max. 1 Anfrage/s)
- Landesgrenze: [Natural Earth](https://www.naturalearthdata.com) (gemeinfrei) über `world-atlas`
