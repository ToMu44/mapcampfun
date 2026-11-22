# Wohnmobil-Wochenendplaner (MapCampFun) – Konzeptpapier

**Stand:** 22.11.2026 · **Status:** Stufen 1–3 umgesetzt und online, Stufen 4–5 offen
**App:** https://tomu44.github.io/mapcampfun/ · **Repository:** https://github.com/ToMu44/mapcampfun

---

## 1. Ziel

Eine Web-App für **iPad Air und MacBook Pro**. Für einen frei wählbaren Zeitraum (Standard: kommendes Wochenende) zeigt sie:

1. **wo** im Umkreis des Wohnorts das Wetter für Camping bzw. die gewählten Freizeitaktivitäten gut ist (farbige Karte),
2. **welche Übernachtungsplätze** für Wohnmobile es in einem gewählten Gebiet gibt (Symbole und Details),
3. **welche Aktivität und Tour** dort empfehlenswert ist.

Ausgewählte Plätze kommen auf eine **Merkliste** und werden dort mit aktuellem Wetter verglichen.

## 2. Rahmenbedingungen

| Thema | Entscheidung |
|---|---|
| Plattform | Progressive Web App (PWA) in Safari, auf iPad und Mac zum Home-Bildschirm bzw. Dock hinzufügbar |
| Nutzer | Einzelnutzer, kein Login, kein Backend |
| Gebiet | nur **Deutschland**; Suchradius wird an der Landesgrenze abgeschnitten |
| Kosten | **0 €**, nur kostenlose Dienste ohne API-Key |
| Hosting | **GitHub Pages** (öffentliches Repository, 2FA), Deployment per GitHub Actions bei jedem Push auf `main` |
| Datenhaltung | nur lokal im Browser (IndexedDB); Abgleich iPad ↔ Mac per JSON-Export/-Import (Stufe 5) |
| Sprache | Deutsch (auch die Kartenbeschriftung) |
| Bewusst nicht enthalten | Google-Bewertungen, Fahrtzeitberechnung, Sync, Offline-Karten, KI-Texte |

## 3. Datenquellen

| Zweck | Dienst | Hinweise aus der Umsetzung |
|---|---|---|
| Kartenhintergrund | **OpenFreeMap** (Stil „liberty“, ohne Key) | Ortsnamen werden auf `name:de` umgestellt; Straßennummern bleiben unverändert |
| Plätze, Touren, Loipen, Städte | OpenStreetMap über **Overpass API** | Hauptserver `overpass-api.de` ist oft ausgelastet; als Ersatz dient der Spiegel `overpass.private.coffee`. Ergebnisse werden je Sitzung zwischengespeichert. |
| Wetter (bis 16 Tage) | **Open-Meteo** Forecast API | Limit ca. **600 Orte pro Minute** und 10 000 pro Tag (ein Gebiet = ein Ort). Bei 150 km Radius sind das rund 300 pro Abfrage. |
| Klimawerte (> 16 Tage) | Open-Meteo Archive API | Mittel der letzten 3 Jahre auf gröberem Raster, gekennzeichnet als „Klimamittel, keine Prognose“ |
| Adresssuche, Ortsname des Standorts | **Nominatim** | nur auf ausdrückliche Suche (max. 1 Anfrage/s) |
| Landesgrenze | Natural Earth 1:50m (über `world-atlas`), in der App mitgeliefert | Bodensee gehört nicht zum Polygon. Gebiete am Ufer können daher fehlen. |
| Externe Portale | park4night, Landvergnügen, Alpaca Camping, Komoot, Outdooractive | nur Startseiten verlinkt; ob die Regionssuche per URL geht, ist nicht geprüft |
| Route / Fahrtzeit | Link „Route in Apple Karten öffnen“ | Apple Karten zeigt die Fahrtzeit |

**Grenze der Vollständigkeit:**
- Kosten, Buchung, Ausstattung und Öffnungszeiten fehlen in OSM oft. Sie erscheinen dann als „keine Angabe“ bzw. „Öffnung unbekannt“ und werden nie ausgeblendet.
- Die Datenqualität hängt von der OSM-Community ab. Fehler lassen sich direkt in OpenStreetMap korrigieren.

## 4. Bedienablauf

```
Start → Standort ermitteln (erst danach wird geladen)
      → Karte: Hexagon-Raster nach Wetter gefärbt, Infofeld mit Vorschlägen
      → Gebiet antippen → Karte zoomt hinein, Plätze werden geladen (Symbole + Liste)
      → Platz antippen → Details im Bedienfeld
      → „Auf die Merkliste“ → Merkliste (eigene Ansicht, Stufe 4)
```

### 4.1 Bedienfeld (Reihenfolge von oben)

1. Hinweise (z. B. Abfragelimit, Dienst nicht erreichbar)
2. **Gewähltes Gebiet** bzw. **Platzdetails** (mit „Zurück zum Gebiet“)
3. **Mittelpunkt:** Mein Standort (Standard) · Adresssuche · Heimat; „Als Heimatadresse speichern“
4. **Suchradius:** 25–400 km, Standard **150 km**
5. **Zeitraum:**
   - Standard ist das kommende Wochenende: Mo–Do → Fr–So dieser Woche; Fr/Sa → heute bis So; So → Fr–So der nächsten Woche.
   - Höchstens **14 Tage** am Stück, Beginn frühestens heute.
6. **Aktivität:** Rang 1 und Rang 2 per Auswahlliste; ohne Rang 1 gilt das Camping-Wetter.
7. **Ansicht:** „Gesamt“ (bester Tag) oder ein einzelner Tag
8. **Vorschläge** (nur ohne Aktivität)

Die **Legende** liegt oben rechts auf der Karte. Während des Ladens erscheint oben mittig der Hinweis „Wetter wird geladen …“.

### 4.2 Layout

| Gerät / Ausrichtung | Layout |
|---|---|
| Mac, iPad quer | Karte links, Seitenleiste rechts (360 px) |
| iPad hoch, schmale Fenster | Karte im Vollbild, Bedienfeld als einklappbares Bottom-Sheet. Beim Einpassen und Zoomen der Karte wird die Höhe des Sheets berücksichtigt, damit nichts verdeckt wird. |
| Merkliste | eigene Ansicht (Stufe 4) |

Bedienelemente sind mindestens 44 pt groß und kommen ohne Hover aus. Hell- und Dunkelmodus werden unterstützt.

## 5. Kartenraster

- **H3-Hexagone, Auflösung 5** (ca. 250 km² bzw. 17 km pro Zelle). Bei 150 km Radius sind das z. B. **301 Gebiete** um Würzburg und **113** um Freiburg (Grenzlage).
- Eine Zelle gehört dazu, wenn ihr Mittelpunkt im Radius **und** in Deutschland liegt.
- Das Wetter wird am Zellmittelpunkt abgefragt. Die Klimawerte kommen von den Elternzellen (Auflösung 4, je ca. 7 Zellen zusammengefasst), um das Kontingent zu schonen.
- **Grau** heißt „Aktivität hier nicht möglich“:
  - Städtebesuch braucht eine Stadt ab **20 000 Einwohnern** (`place=city|town`) oder einen als „Altstadt“ benannten Stadtteil.
  - Langlauf braucht eine Loipe (`piste:type=nordic`).
  - Solange diese Daten fehlen, gilt die Aktivität als möglich. Die Vorschläge zeigen „Städtebesuch“ erst nach der Prüfung.
- Beim Hineinzoomen wird die Gebietsfarbe durchsichtiger (Zoom 9 → 11,5), damit Straßen und Orte lesbar bleiben.

## 6. Bewertungslogik

### 6.1 Tagesbewertung je Aktivität

Die Startwerte sollen in Stufe 5 änderbar werden. Temperatur bedeutet hier immer den **Tageshöchstwert**.

| Aktivität | 🟢 sehr gut | 🟡 mäßig | 🔴 nicht empfehlenswert |
|---|---|---|---|
| Wandern | 8–24 °C, Regen < 1 mm, Wind < 30 km/h | 0–30 °C, Regen < 5 mm, Wind < 50 km/h | sonst |
| Radfahren | 12–26 °C, Regen < 0,5 mm, Wind < 25 km/h | 5–30 °C, Regen < 3 mm, Wind < 40 km/h | sonst |
| Ski-Langlauf | Schneehöhe ≥ 20 cm, max. ≤ 0 °C **und** min. ≥ −12 °C, Regen < 0,5 mm | Schneehöhe ≥ 10 cm, max. ≤ 3 °C, Regen < 0,5 mm | sonst |
| Städtebesuch | Regen < 2 mm, 5–28 °C | Regen < 8 mm | sonst |

Für alle Aktivitäten gilt: **Gewitter** (WMO-Code 95/96/99) oder **Sturmböen ≥ 60 km/h** ergeben immer rot.

Eine Stufe gilt nur, wenn alle ihre Bedingungen erfüllt sind. Als Begründung wird die erste nicht erfüllte Bedingung angezeigt, z. B. „3 mm Regen“ oder „kühl (max. 0 °C)“.

### 6.2 Camping-Wetter (ohne Aktivität)

| Farbe | Regel (pro Tag) |
|---|---|
| 🟢 ideal | Regen < 1 mm (Schneefall in jeder Menge ist ideal) |
| 🟡 so lala | Regen 1–5 mm |
| 🔴 schlecht | Regen ≥ 5 mm **oder** Gewitter **oder** Sturmböen ≥ 60 km/h |

- **Regen** ist die Summe aus Regen und Schauern. Schneeregen zählt über seinen Regenanteil.
- Temperatur und Sonnenscheindauer werden nur angezeigt.
- Bei Klimawerten entfällt die Gewitter-Erkennung, weil der Wettercode im Mittel nicht sinnvoll ist.

### 6.3 Mehrere Tage

Die **Gesamtfarbe** richtet sich nach dem besten Tag. Über die Tagesauswahl lässt sich jeder Tag einzeln ansehen.

### 6.4 Zwei Aktivitäten

- **Rang 1** färbt die Fläche.
- **Rang 2** erscheint als farbiger Punkt, aber **nur wo die Aktivität möglich ist**. Graue Punkte werden ausgeblendet, weil sie die Karte unruhig machen.
- Gebietsdetails und Platzdetails zeigen beide Bewertungen getrennt.

### 6.5 Vorschläge (ohne Aktivität)

- Für jede Aktivität wird gezählt, in wie vielen Gebieten sie „sehr gut“ ist (ersatzweise „mäßig“).
- Vorgeschlagen wird das **nächstgelegene** passende Gebiet, mit dem nächsten Ort als Name. Es gibt höchstens 3 Vorschläge.
- Langlauf wird nur von November bis April geprüft.
- Ein Tipp auf einen Vorschlag setzt die Aktivität als Rang 1, wählt das Gebiet aus und zentriert die Karte darauf.

### 6.6 Wetterwerte (Open-Meteo)

Täglich: `temperature_2m_max/min`, `rain_sum`, `showers_sum`, `snowfall_sum`, `wind_speed_10m_max`, `wind_gusts_10m_max`, `weather_code`, `sunshine_duration`.
Stündlich: `snow_depth` (für die Schneehöhe zählt das Tagesmaximum). Zeitzone Europe/Berlin.

## 7. Übernachtungsplätze

### 7.1 Auswahl und Typen

**Berücksichtigt:** `tourism=camp_site` und `tourism=caravan_site` innerhalb des Zellumrisses.

**Ausgeschlossen**, weil für das Wohnmobil ungeeignet:
- `motorhome=no`
- Zeltplätze mit `caravans=no`, sofern nicht `motorhome=yes`
- Trekking- und Wildnisplätze (`backcountry=yes`, `camp_site=backcountry`)
- Gruppen- und Pfadfinderplätze
- stillgelegte Plätze und `access=no`

**Typ-Zuordnung**, Vorrang von oben nach unten:

| Typ | Symbol | Erkennung |
|---|---|---|
| Weingut | 🍇 | `craft=winery` / `shop=wine`, Name enthält Weingut, Winzer, Weinhof, Weinbau, Sektgut oder Weinkeller, **oder** ein Weingut in max. 200 m |
| Bauernhof | 🐄 | `farm=yes`, `shop=farm`, `place=farm`, Name enthält Bauernhof, Ferienhof, Hofgut, Erlebnishof, Reiterhof, Biohof, Landhof, Gutshof oder Hofladen, **oder** ein Hof (`shop=farm`, `place=farm`, `landuse=farmyard`) in max. 200 m |
| Sonstiges | ✨ | Name enthält Alpaka, Lama, Tierpark, Glamping, Tipi, Baumhaus oder Wildpark |
| Privater Stellplatz | 🏠 | `operator:type=private` oder `access=customers|private|permit` |
| Stellplatz / Reisemobilhafen | 🚐 | übrige `caravan_site` |
| Campingplatz | ⛺ | übrige `camp_site` |

Ein Name, der nur „Hof“ enthält (z. B. „Campingplatz Seehof“), führt bewusst **nicht** zu 🐄.

### 7.2 Öffnungsstatus

- Ausgewertet wird `opening_hours` mit der Bibliothek `opening_hours` für **jeden Tag des Zeitraums**, einschließlich Saisonangaben wie „Apr-Oct“.
- **offen** heißt an mindestens einem Tag geöffnet (sonst „teilweise geöffnet“), **geschlossen** heißt an keinem Tag.
- Freitext wie „nach Absprache“, fehlende oder nicht auswertbare Angaben ergeben **unbekannt**.
- Auf der Karte erscheinen geschlossene Plätze blass mit rot gestricheltem Rand, unbekannte mit grauem Rand.

### 7.3 Laden

- Die Plätze werden **beim Antippen eines Gebiets** geladen. Eine einzige Overpass-Abfrage holt die Plätze im Zellumriss sowie Weingüter, Höfe, Wander- und Radrouten und Loipen im Rahmen der Zelle (plus ca. 5 km).
- Danach zoomt die Karte auf das Gebiet (höchstens Zoomstufe 12).
- Das Gebiet zeigt Typ-Knöpfe mit Anzahl (ein- und ausblendbar, wird gespeichert), eine Platzliste (offene zuerst) und Links zu den externen Portalen.

### 7.4 Platzdetails

Die Details erscheinen im Bedienfeld statt als Karten-Popup, weil sie auf dem iPad im Hochformat so besser lesbar sind.

| Abschnitt | Inhalt |
|---|---|
| Kopf | Symbol, Name (ohne Namen: „Stellplatz (ohne Namen)“), Typ, nächster Ort, Luftlinie, Öffnungsstatus |
| Merkliste | ☆ Auf die Merkliste bzw. ★ entfernen |
| Basisdaten | Kosten (`charge`, sonst `fee`), Plätze (`capacity…`), Buchung (`reservation`), Webseite, Telefon |
| Ausstattung | Strom, Frischwasser, Entsorgung, WC, Dusche, WLAN, Hunde, jeweils ✓, ✗ oder ? |
| Quelle | OpenStreetMap mit Datum der letzten Bearbeitung und Link „in OSM ansehen“ |
| Freizeitaktivitäten | alle 4 Aktivitäten mit Bewertung (bester Tag) und Grund; Rang 1/2 zuerst |
| Tourenvorschlag | für bis zu 2 empfehlenswerte Aktivitäten, siehe 7.5 |
| Aktionen | Links zu Komoot und Outdooractive, „Route in Apple Karten öffnen“ |

### 7.5 Tourenvorschläge

- **Wandern/Rad:** OSM-Routenrelationen (`hiking|foot` bzw. `bicycle|mtb`), deren Ausdehnung max. 10 km vom Platz entfernt liegt. Lokale Wege kommen vor regionalen und Fernwegen, danach entscheidet die Nähe. Text z. B. „Wanderweg ‚Rundweg Weinberge‘ (10 km, lokal, Einstieg ca. 1 km)“.
- **Langlauf:** benannte Loipen im Umkreis von 10 km, mit Schwierigkeit.
- **Städtebesuch:** nächste Stadt ab 20 000 Einwohnern im Umkreis von 40 km.

## 8. Merkliste (Stufe 4)

- **Bereits umgesetzt:** Speichern und Entfernen aus den Platzdetails. Gespeichert werden Name, Typ, Position, Ort, Gebiet, Webseite, Datum und Notiz (IndexedDB).
- **Ansicht:** eigene Tabelle mit den Spalten Name · Typ · Ort · Luftlinie · Wetter je Tag (Symbol, max/min, Regen) · Ampel und empfohlene Aktivität (Rang 1/2) · Notiz · Löschen.
- Das Wetter wird beim Öffnen **live** geladen. Offline erscheint der letzte Stand mit Zeitstempel.
- Sortierbar nach Ampel und Entfernung, Export als CSV.

## 9. Einstellungen (Stufe 5)

- **Bereits gespeichert:** Heimatadresse, Radius, Rang 1/2, ausgeblendete Platztypen
- **Noch einzurichten:**
  - Einstellungsseite für Hexagon-Größe, Schwellwerte je Aktivität und Camping-Wetter sowie Mindestgröße der Stadt
  - JSON-Export/-Import von Merkliste und Einstellungen (Backup und Abgleich iPad ↔ Mac, z. B. über iCloud Drive)

## 10. Technik

| Baustein | Wahl |
|---|---|
| Build | Vite + TypeScript, Tests mit Vitest |
| UI | React |
| Karte | MapLibre GL JS. Der Worker wird über `?worker&url` eingebunden und per `setWorkerUrl` gesetzt, sonst lädt die Karte nach dem Build nicht. |
| Raster | h3-js |
| Geometrie | Turf (Kreis, Punkt-in-Polygon) |
| Öffnungszeiten | opening_hours |
| Speicher | IndexedDB über idb-keyval (Einstellungen, Merkliste), jeder Zugriff fehlertolerant |
| PWA | Manifest + Service Worker (Stufe 5) |
| Deployment | GitHub Actions → GitHub Pages (Tests und Build laufen vor jedem Deployment) |

**Wichtig, Speicher in Safari:** Bei reiner Browsernutzung kann Safari lokale Daten nach einigen Wochen ohne Nutzung löschen. Als Home-Bildschirm-App passiert das nicht. Deshalb gilt:
- auf beiden Geräten installieren,
- regelmäßig ein JSON-Backup machen (Stufe 5).

## 11. Sicherheit und Datenschutz

- Kein Backend, keine API-Keys, keine Geheimnisse im Code.
- Heimatadresse und Merkliste liegen nur auf dem Gerät.
- Externe Dienste sehen IP-Adresse und abgefragte Koordinaten, aber kein Konto.
- Hauptrisiko ist die Übernahme des GitHub-Accounts, daher ist 2FA Pflicht.

## 12. Umsetzung in Stufen

| Stufe | Umfang | Status |
|---|---|---|
| 1 | Projektgerüst, Deployment, Karte, Standort/Adresse/Heimat, Radius, Hexagon-Raster, Landesgrenze | ✅ online |
| 2 | Wetter, Camping-Wetter, Aktivitätsregeln, Rang 1/2, Tagesauswahl, Begründungen, Vorschläge, graue Gebiete | ✅ online |
| 3 | Plätze je Gebiet, Typ-Zuordnung, Symbole, Platzliste, Details, Öffnungsstatus, Touren, externe Links, Merkliste speichern | ✅ online |
| 4 | Merkliste als Tabelle mit Live-Wetter, Sortierung, Notizen, CSV-Export | offen |
| 5 | Einstellungsseite, JSON-Backup, PWA-Installation, Offline-Cache | offen |

## 13. Erfahrungen aus der Umsetzung

1. **Abfragelimit Open-Meteo:** Beim Start wurde das Wetter zunächst doppelt geladen, einmal für den Ersatz-Mittelpunkt und einmal für den Standort. Das hat das Limit erreicht. Die Abhilfe:
   - Es wird erst nach dem Ortungsversuch geladen.
   - Radius-Änderungen werden entprellt (400 ms).
   - Bereits geladene Gebiete werden zwischengespeichert (Prognose 1 h, Klima 7 Tage).
   - Bei einem Fehler bleiben die geladenen Gebiete sichtbar, und nach einem Limit wird nach 65 s automatisch nachgeladen.

   Häufiges Verstellen von Radius oder Mittelpunkt kann das Limit trotzdem kurz auslösen.
2. **Overpass ist unzuverlässig:** Der Hauptserver ist oft ausgelastet, deshalb gibt es den Ersatzserver. Aus Rechenzentren (z. B. der Entwicklungsumgebung) brechen Overpass und Geofabrik die Verbindung ab. Die OSM-Funktionen wurden deshalb mit realistischen Testdaten geprüft und auf dem iPad bestätigt.
3. **MapLibre-Worker:** Nach dem Build fand MapLibre seinen Worker nicht. Behoben durch explizites Einbinden.
4. **Bottom-Sheet:** Im Hochformat verdeckte das Sheet den Mittelpunkt. Behoben, indem Einpassen und Zoomen die Sheet-Höhe berücksichtigen.
5. **Kartenstil:** Die Ortsnamen waren teils englisch. Umgestellt auf `name:de`.
6. **Freitext-Öffnungszeiten:** Ein Wert wie „nach Absprache“ wurde zunächst als „geöffnet“ gewertet. Jetzt ergibt er „unbekannt“.
7. **Lesbarkeit:** Graue Rang-2-Punkte werden ausgeblendet, und die Flächen werden beim Zoomen transparent.

## 14. Offene Punkte

1. Die **Typ-Zuordnung** (privat, Bauernhof, Weingut, Sonstiges) ist noch nicht an echten OSM-Auszügen geprüft. Fehlzuordnungen bitte mit dem Link „in OSM ansehen“ melden, dann werden die Regeln nachgeschärft.
2. **Regionslinks** zu park4night, Landvergnügen, Alpaca Camping, Komoot und Outdooractive sind ungeprüft, im Moment sind nur die Startseiten verlinkt.
3. **Hexagon-Größe:** Auflösung 5 hat sich bewährt, wird in Stufe 5 aber einstellbar.
4. **Wetter-Kontingent:** Bei großen Radien (> 250 km, also mehr als 600 Gebiete) greift das Minutenlimit sicher. Ein Hinweis in der App oder eine automatische Vergröberung des Rasters wäre denkbar.

## 15. Spätere Ausbaustufen (nicht Teil des MVP)

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
| Q13 | Mehrere Tage | bester Tag + Tagesauswahl |
| Q14/Q21 | Gewichtung | max. 2 Aktivitäten, Rang 1 färbt, Rang 2 als Punkt |
| Q15/Q22 | Ohne Aktivität | Camping-Wetter nach Regen; Schnee ideal; Gewitter/Sturm rot; Temperatur nur Anzeige |
| Q16 | Stadt / Loipe | nur Gebiete mit Stadt bzw. Loipe, sonst grau |
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
| Q30 | Dokumentation | dieses Papier |
| – | Umsetzung | Platzdetails im Bedienfeld statt Karten-Popup (bessere Lesbarkeit auf dem iPad) |
