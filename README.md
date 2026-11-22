# MapCampFun – Wohnmobil-Wochenendplaner

Web-App (PWA) für iPad und Mac: Wo ist am Wochenende gutes Wetter für Camping und Outdoor-Aktivitäten, und welche Stellplätze gibt es dort?
Ausschließlich kostenlose, offene Datenquellen (OpenStreetMap, Open-Meteo, Nominatim). Kein Backend, alle persönlichen Daten bleiben auf dem Gerät.

Vollständige Spezifikation: [docs/KONZEPT.md](docs/KONZEPT.md)

## Stand

| Stufe | Inhalt | Status |
|---|---|---|
| 1 | Karte, Standort/Adresse/Heimat, Radius, Hexagon-Raster, Landesgrenze | ✅ |
| 2 | Wetter, Bewertung, Aktivitäten, Tages-Schieberegler, Infofeld | offen |
| 3 | Plätze aus OSM, Symbole, Popup, Touren | offen |
| 4 | Merkliste | offen |
| 5 | Einstellungen, Backup, PWA/Offline | offen |

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
