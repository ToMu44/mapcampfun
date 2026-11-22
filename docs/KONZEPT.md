# Wohnmobil-Wochenendplaner – Konzeptpapier

**Stand:** 22.11.2026 · **Status:** Konzept abgestimmt, Umsetzung noch nicht freigegeben

---

## 1. Ziel

Eine Web-App für **iPad Air und MacBook Pro**, die für einen frei wählbaren Zeitraum (Standard: kommendes Wochenende) zeigt,

1. **wo** im Umkreis des Wohnorts das Wetter für Camping bzw. für gewählte Freizeitaktivitäten gut ist (farbige Karte),
2. **welche Übernachtungsplätze** für Wohnmobile es in einem gewählten Gebiet gibt (Symbole + Detail-Popup),
3. **welche Aktivität / Tour** dort empfehlenswert ist,

und ausgewählte Plätze auf einer **Merkliste** mit aktuellem Wetter vergleicht.

## 2. Rahmenbedingungen

| Thema | Entscheidung |
|---|---|
| Plattform | Progressive Web App (PWA) in Safari, auf iPad und Mac zum Home-Bildschirm bzw. Dock hinzufügbar |
| Nutzer | Einzelnutzer, kein Login, kein Backend |
| Gebiet | nur **Deutschland**; Suchradius wird an der Landesgrenze abgeschnitten |
| Kosten | **0 €** – ausschließlich kostenlose Dienste ohne API-Key |
| Hosting | **GitHub Pages**, öffentliches Repository, **2FA** auf dem GitHub-Account |
| Datenhaltung | nur lokal im Browser (IndexedDB); Abgleich iPad ↔ Mac manuell per JSON-Export/-Import |
| Sprache | Deutsch |
| Bewusst nicht enthalten | Google-Bewertungen, Fahrtzeitberechnung, Sync, Offline-Karten, KI-Texte |

## 3. Datenquellen

| Zweck | Dienst | Hinweise |
|---|---|---|
| Kartenhintergrund | OpenFreeMap (Vektorkacheln, ohne Key) bzw. OSM-Kacheln | Quellenangabe „© OpenStreetMap-Mitwirkende“ Pflicht |
| Plätze, Touren, Loipen, Städte | OpenStreetMap über **Overpass API** | Fair-Use-Grenzen → Ergebnisse cachen |
| Wetter (bis 16 Tage) | **Open-Meteo** Forecast API | mehrere Koordinaten pro Abfrage möglich |
| Klimawerte (> 16 Tage) | Open-Meteo Historical API (Mittel der Vorjahre) | klar als „Klimatologie, keine Prognose“ gekennzeichnet |
| Adresssuche | **Nominatim** | max. 1 Abfrage/s, Eingabe entprellt |
| Landesgrenze | vereinfachtes GeoJSON von Deutschland, in der App mitgeliefert | – |
| Externe Portale | Links zu park4night, Landvergnügen, Alpaca Camping, Komoot, Outdooractive | nur Verlinkung, keine Einbindung (keine offenen APIs) |
| Route / Fahrtzeit | Link „Route in Apple Karten öffnen“ (`maps.apple.com/?daddr=lat,lon`) | Fahrtzeit zeigt Apple Karten, nicht die App |

**Bekannte Grenze:** Vollständigkeit ist nicht erreichbar. Kosten, Buchung, Ausstattung und Öffnungszeiten fehlen in OSM bei einem großen Teil der Plätze. Fehlende Felder werden als **„keine Angabe“** angezeigt, nie ausgeblendet. Ein Platz mit unbekanntem Öffnungsstatus bleibt sichtbar und wird als „Öffnung unbekannt“ markiert.

## 4. Bedienablauf

```
Start → Karte (Mittelpunkt + Radius + Zeitraum + Aktivität)
      → Hexagon-Raster wird nach Wetter gefärbt, Infofeld zeigt Vorschläge
      → Klick auf Zelle → Plätze in der Zelle werden geladen (Symbole)
      → Klick auf Symbol → Popup mit Details, Aktivität, Tour
      → „Auf Merkliste“ → Merkliste (eigene Ansicht, Tabelle)
```

### 4.1 Steuerung (Seitenleiste bzw. Bottom-Sheet)

- **Mittelpunkt:** Geolocation (Standard) · Adresseingabe · Button „Heimatadresse“
- **Radius:** frei wählbar, Standard **150 km**
- **Zeitraum:** Standard **kommendes Wochenende (Fr–So)**; frei wählbar. Ab Tag 17 werden Klimawerte statt einer Prognose verwendet, mit Hinweis.
- **Aktivität:**
  - keine Auswahl → Färbung nach „Camping-Wetter“
  - Auswahl aus **Wandern, Radfahren, Ski-Langlauf, Städtebesuch**, höchstens 2 mit **Rang 1 / Rang 2**
- **Tages-Schieberegler:** Gesamtansicht oder ein einzelner Tag des Zeitraums
- **Legende:** Platztypen ein- und ausblendbar

### 4.2 Layout

| Gerät / Ausrichtung | Layout |
|---|---|
| Mac, iPad quer | Karte ca. 70 % links, Seitenleiste rechts (Filter, Infofeld, Details) |
| iPad hoch | Karte im Vollbild, Filter und Details als hochziehbares Bottom-Sheet |
| Merkliste | eigene Ansicht bzw. eigener Tab (volle Breite für die Tabelle) |

Alle Bedienelemente sind touch-tauglich (mindestens 44 pt) und brauchen keine Hover-Funktionen.

## 5. Kartenraster

- **Hexagon-Raster** mit der Bibliothek H3, Auflösung 5 (ca. 250 km² pro Zelle, etwa 17 km Durchmesser). Das Raster ist in den Einstellungen änderbar.
- 150 km Radius ergeben ca. **280 Zellen**. Das Wetter wird im Zellmittelpunkt abgefragt, gebündelt in wenigen Open-Meteo-Anfragen.
- Zellen außerhalb Deutschlands oder des Radius werden nicht dargestellt.
- **Graue Zelle** heißt „Aktivität hier nicht möglich“:
  - **Städtebesuch** ist nur in Zellen mit einer Stadt ab **20.000 Einwohnern** (einstellbar) oder mit einer touristischen Altstadt laut OSM möglich.
  - **Ski-Langlauf** ist nur in Zellen mit Loipen laut OSM (`piste:type=nordic`) möglich.

## 6. Bewertungslogik

### 6.1 Tagesbewertung je Aktivität (Startwerte, in den Einstellungen änderbar)

| Aktivität | 🟢 ideal | 🟡 möglich | 🔴 nicht empfehlenswert |
|---|---|---|---|
| Wandern | 8–24 °C, Regen < 1 mm, Wind < 30 km/h | 0–30 °C, Regen < 5 mm, Wind < 50 km/h | sonst / Gewitter |
| Radfahren | 12–26 °C, Regen < 0,5 mm, Wind < 25 km/h | 5–30 °C, Regen < 3 mm, Wind < 40 km/h | sonst / Gewitter |
| Ski-Langlauf | Schneehöhe ≥ 20 cm, −12 bis 0 °C, kein Regen | Schnee 10–20 cm oder bis +3 °C | < 10 cm Schnee / Regen |
| Städtebesuch | Regen < 2 mm, 5–28 °C | Regen < 8 mm | Unwetter / Starkregen |

Eine Stufe gilt nur, wenn **alle** ihre Bedingungen erfüllt sind. Sonst wird die nächstschlechtere Stufe geprüft.

### 6.2 Camping-Wetter (ohne Aktivitätsauswahl)

| Farbe | Regel (pro Tag) |
|---|---|
| 🟢 ideal | Regen < 1 mm – **Schneefall in jeder Menge zählt als ideal** |
| 🟡 so lala | Regen 1–5 mm |
| 🔴 schlecht | Regen ≥ 5 mm **oder** Gewitter **oder** Sturmböen ≥ 60 km/h |

- **Regen** ist die Summe aus Regen und Schauern (`rain_sum + showers_sum`). **Schneeregen** zählt über seinen Regenanteil als Regen.
- **Gewitter** wird über die WMO-Wettercodes 95, 96 und 99 erkannt.
- **Temperatur und Sonnenscheindauer** werden angezeigt, fließen aber **nicht** in die Farbe ein.

### 6.3 Zusammenfassung mehrerer Tage

- **Gesamtfarbe:** Es zählt der **beste Tag** im Zeitraum, denn ein guter Tag reicht.
- Mit dem **Tages-Schieberegler** wird jeder Tag einzeln angezeigt.

### 6.4 Zwei Aktivitäten (Rang 1 / Rang 2)

- Eine Aktivität entspricht 100 %.
- Bei zwei Aktivitäten **färbt Rang 1 die Fläche**. Rang 2 erscheint als **kleines farbiges Icon** in der Zelle.
- Popup und Merkliste zeigen beide Bewertungen getrennt, z. B. „Wandern: sehr gut · Ski-Langlauf: mäßig“.

### 6.5 Begründung

Zu jeder Farbe wird der ausschlaggebende Grund gespeichert und im Popup angezeigt, z. B. „🟡 Sa: 3,8 mm Regen“.

### 6.6 Infofeld (ohne Aktivitätsauswahl)

- Zeigt die **Top-3-Vorschläge** „Aktivität + Region“, z. B. „Wandern – Schwarzwald-Nord“.
- Ein Klick auf einen Vorschlag aktiviert die Aktivität und zentriert die Karte.

### 6.7 Benötigte Wetterwerte (Open-Meteo, täglich)

| Kategorie | Werte |
|---|---|
| Temperatur | `temperature_2m_max`, `temperature_2m_min` |
| Niederschlag | `rain_sum`, `showers_sum`, `snowfall_sum` |
| Wind | `wind_speed_10m_max`, `wind_gusts_10m_max` |
| Wetterlage | `weather_code`, `sunshine_duration` |
| Schnee (stündlich) | `snow_depth` (für Langlauf, Tageswert = Maximum) |

## 7. Übernachtungsplätze

### 7.1 Typen und Symbole

| # | Typ | Symbol | OSM-Zuordnung (vorläufig, in Stufe 3 an echten Daten prüfen) |
|---|---|---|---|
| 1 | Campingplatz | ⛺ | `tourism=camp_site` |
| 2 | Wohnmobilstellplatz / Reisemobilhafen | 🚐 | `tourism=caravan_site` |
| 3 | Privater Stellplatz | 🏠 | `caravan_site` / `camp_site` mit `operator:type=private` oder `access=customers` bzw. `access=private` |
| 4 | Bauernhof | 🐄 | Platz mit Hofbezug (z. B. `farm=yes`, Lage auf `landuse=farmyard`, Name enthält „Hof“) |
| 5 | Weingut | 🍇 | Platz mit Weingutbezug (z. B. `craft=winery` am selben Objekt oder direkt angrenzend) |
| 6 | Sonstiges | ✨ | übrige Übernachtungsplätze, z. B. Tiercamping |

- **Regel:** Es erscheinen nur Orte, die **ausdrücklich** als Übernachtungsplatz erfasst sind. Höfe und Weingüter ohne ausgewiesenen Platz werden nicht gezeigt.
- Zusätzlich bietet jede Zelle Links „Diese Region auf Landvergnügen / Alpaca Camping / park4night öffnen“.

### 7.2 Laden

- Die Plätze werden **erst beim Klick auf eine Zelle** per Overpass geladen, als Abfrage über die Bounding-Box der Zelle.
- Die Ergebnisse werden 24 h gecacht.

### 7.3 Popup

| Abschnitt | Inhalt |
|---|---|
| Kopf | Name, Typ (Symbol), Öffnungsstatus (offen / geschlossen / unbekannt) |
| Basisdaten | Ausstattung (Strom, Wasser, Entsorgung, WC, Dusche, WLAN, Hunde), Kosten, Webseite, Buchungsmöglichkeit, Luftlinie zum Mittelpunkt |
| Quelle | „OpenStreetMap, Stand TT.MM.JJJJ“ + Link „in OSM ansehen“ |
| Aktivität | Bewertung Rang 1 und Rang 2 getrennt, mit Farbe und Begründung; ohne Auswahl die geeigneten Aktivitäten |
| Tourenempfehlung | 1–3 Sätze aus OSM-Routen im Umkreis, z. B. „Rundwanderweg X, 12 km“ (Wander-, Rad- und Loipenrelationen); Links zu Komoot / Outdooractive |
| Aktionen | ☆ **Auf Merkliste** · **Route in Apple Karten öffnen** |

Fehlende Werte erscheinen immer als „keine Angabe“.

## 8. Merkliste

- Eigene Ansicht als **Tabelle**.
- **Spalten:** Name · Typ · Ort · Luftlinie · Wetter je Tag (Symbol, Temperatur min/max, Regen) · Ampel und empfohlene Aktivität (Rang 1/2) · Notiz · Löschen
- Das Wetter wird beim Öffnen **live neu geladen** und nicht als alter Stand gespeichert.
- **Offline** wird der letzte Stand mit Zeitstempel angezeigt.
- Sortierbar nach Ampel und Entfernung.
- **CSV-Export** der Tabelle.

## 9. Einstellungen

- Heimatadresse
- Standardradius
- Hexagon-Größe
- Schwellwerte je Aktivität und für das Camping-Wetter
- Mindestgröße der Stadt für Städtebesuch
- Sichtbare Platztypen
- **Export / Import** von Merkliste und Einstellungen als JSON, für Backup und Abgleich iPad ↔ Mac (z. B. über iCloud Drive)

## 10. Technik

| Baustein | Wahl |
|---|---|
| Build | Vite + TypeScript |
| UI | React |
| Karte | MapLibre GL JS |
| Raster | h3-js |
| Geometrie | Turf.js (Radius, Landesgrenze) |
| Speicher | IndexedDB (Merkliste, Einstellungen, Cache) |
| PWA | Web-App-Manifest + Service Worker (App-Hülle und Merkliste offline) |
| Deployment | GitHub Actions → GitHub Pages |

**Wichtig – Speicher in Safari:** Bei Websites, die nur im Browser-Tab genutzt werden, kann Safari lokal gespeicherte Daten nach einigen Wochen ohne Nutzung löschen. Als **Home-Bildschirm-App** installiert ist das nicht der Fall. Deshalb gilt:
- App auf beiden Geräten zum Home-Bildschirm bzw. Dock hinzufügen.
- Regelmäßig JSON-Backups erstellen.

## 11. Sicherheit und Datenschutz

- Kein Backend, keine API-Keys, keine Geheimnisse im Code. Das öffentliche Repository verrät nur, wie die App funktioniert.
- Heimatadresse und Merkliste liegen nur auf dem Gerät, nie im Repository.
- Externe Dienste sehen IP-Adresse und abgefragte Koordinaten, aber kein Konto und keinen Namen.
- Das Hauptrisiko ist die Übernahme des GitHub-Accounts. Deshalb ist **2FA** (Passkey oder Authenticator-App) Pflicht.
- Ein Wechsel zu Cloudflare Pages mit Zugriffsschutz ist später ohne Codeänderung möglich.

## 12. Umsetzung in Stufen

Nach jeder Stufe gibt es eine lauffähige, online erreichbare Version zum Testen.

| Stufe | Umfang | Ergebnis |
|---|---|---|
| 1 | Projektgerüst, Deployment, Karte, Geolocation/Adresse/Heimat, Radius, Hexagon-Raster, Landesgrenze | Karte mit Raster um den Standort |
| 2 | Wetterabruf, Camping-Wetter, Aktivitätsregeln, Rang 1/2, Tages-Schieberegler, Begründungen, Infofeld, graue Zellen | **Erster echter Nutzen:** Wo ist am Wochenende gutes Wetter? |
| 3 | Overpass-Abfrage pro Zelle, Typ-Zuordnung, Symbole, Legende, Popup, Tourenempfehlung, externe Links | Plätze finden und vergleichen |
| 4 | Merkliste mit Live-Wetter, Sortierung, Notizen, CSV-Export | Auswahl treffen |
| 5 | Einstellungsseite, JSON-Backup, PWA-Installation, Offline-Cache | alltagstauglich |

## 13. Offene Punkte zur Klärung während der Umsetzung

1. Die OSM-Zuordnung für die Typen 3–6 (privat, Bauernhof, Weingut, Sonstiges) wird in Stufe 3 an echten Daten geprüft und bei Bedarf angepasst.
2. Die Formate der Links zu park4night, Landvergnügen und Alpaca Camping werden geprüft. Wo es keine Regionssuche per URL gibt, wird auf die Startseite verlinkt.
3. Die Hexagon-Größe wird in Stufe 2 an echten Wetterdaten feinjustiert.

## 14. Spätere Ausbaustufen (nicht Teil des MVP)

- Sync zwischen iPad und Mac (z. B. über ein privates GitHub-Gist)
- KI-formulierte Tourenbeschreibungen
- Offline-Karten
- Ausweitung auf Österreich und die Schweiz

## Anhang: Entscheidungsprotokoll

| Nr. | Thema | Entscheidung |
|---|---|---|
| Q1 | Plattform | PWA |
| Q2 | Nutzer | Einzelnutzer, lokal |
| Q3 | Gebiet | nur Deutschland |
| Q4 | Budget | 0 €, keine Google-Bewertungen |
| Q5 | Vollständigkeit | OSM als Kern, „unbekannt“ statt ausblenden, externe Links |
| Q6 | Gebiet auf der Karte | Hexagon-Raster |
| Q7 | Zeitraum | Wochenende, bis 16 Tage Prognose, danach Klima |
| Q8 | Fahrtzeit | entfällt |
| Q9 | Touren | OSM-Routen + Links |
| Q10 | Offline | nur Merkliste und letzter Stand |
| Q11 | Entfernung | Luftlinie + Apple-Karten-Link |
| Q12 | Aktivitätsregeln | Tabelle 6.1 |
| Q13 | Mehrere Tage | bester Tag + Tages-Schieberegler |
| Q14/Q21 | Gewichtung | max. 2 Aktivitäten, Rang 1 färbt, Rang 2 als Icon |
| Q15/Q22 | Ohne Aktivität | Camping-Wetter nach Regen; Schnee ideal; Gewitter/Sturm rot; Temperatur nur Anzeige |
| Q16 | Stadt / Loipe | nur Zellen mit Stadt bzw. Loipe, sonst grau |
| Q17 | Höfe/Weingüter | nur ausdrücklich ausgewiesene Plätze |
| Q18 | Typen | 6 Kategorien |
| Q19 | Fehlende Felder | „keine Angabe“ |
| Q20 | Merkliste | Tabelle, Live-Wetter, CSV |
| Q23 | Infofeld | Top-3-Vorschläge |
| Q24 | Bezugspunkt | Suchmittelpunkt + Heimat-Button |
| Q25 | Hosting | GitHub Pages, öffentliches Repo, 2FA |
| Q26 | Layout | Seitenleiste / Bottom-Sheet, Merkliste separat |
| Q27 | Einstellungen | siehe Abschnitt 9 |
| Q28 | Sync | manuell per JSON |
| Q29 | MVP | 5 Stufen |
| Q30 | Dokumentation | dieses Papier als README / Spezifikation |
