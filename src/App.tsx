import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeatureCollection, Polygon } from 'geojson';
import { MapView, type MapCellProps, type MapPlace } from './components/MapView';
import { CellPlaces } from './components/CellPlaces';
import { PlaceDetails, activityLines } from './components/PlaceDetails';
import { Sidebar } from './components/Sidebar';
import { ActivityPicker, DaySlider, InfoPanel, Legend, PeriodPicker, type Period } from './components/Controls';
import { CellDetails } from './components/CellDetails';
import { buildGrid, circleBounds, GERMANY_CENTER, isInGermany, type CellProps } from './lib/geo';
import { geolocationErrorText, getCurrentPosition, reverseGeocode, searchAddress } from './lib/geocode';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Place, type Settings } from './lib/storage';
import { daysBetween, fromIso, nextWeekend } from './lib/period';
import { fetchWeather, type DayWeather } from './lib/weather';
import { cityCells, fetchCellData, fetchLoipenCells, fetchTowns, type CellData, type Town } from './lib/osm';
import { classify, defaultName, isUsable, openStatus, placeTypeInfo, website, type CampPlace, type PlaceType } from './lib/places';
import { tourHint } from './lib/tours';
import { loadWatchlist, saveWatchlist, type WatchItem } from './lib/watchlist';
import { distanceKm } from './lib/geo';
import { displayLevel, evaluateCell, isAvailable, nearestTown, rateDays, suggestions, type Availability, type Suggestion } from './lib/evaluate';
import { ACTIVITIES, type Activity, type Rating } from './lib/rating';

const FALLBACK: Place = { ...GERMANY_CENTER, label: 'Mitte Deutschlands' };

/** Langlauf lohnt sich im Infofeld nur in der Wintersaison zu prüfen. */
const isWinter = (p: Period) => [10, 11, 0, 1, 2, 3].includes(fromIso(p.start).getMonth());

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [center, setCenter] = useState<Place>(FALLBACK);
  const [period, setPeriod] = useState<Period>(() => nextWeekend());
  const [dayIndex, setDayIndex] = useState(-1);
  const [selectedCell, setSelectedCell] = useState<CellProps | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; seq: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Erst nach dem ersten Ortungsversuch laden – sonst wird das Wetter doppelt abgefragt. */
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);

  const [weather, setWeather] = useState<Map<string, DayWeather[]> | null>(null);
  const [wxLoading, setWxLoading] = useState(false);
  const [wxError, setWxError] = useState<string | null>(null);
  const [towns, setTowns] = useState<Town[] | null>(null);
  const [loipen, setLoipen] = useState<Set<string> | null>(null);
  const [osmError, setOsmError] = useState<string | null>(null);

  const [cellData, setCellData] = useState<{ cellId: string; data: CellData | null; loading: boolean; error: string | null } | null>(null);
  const [cellReload, setCellReload] = useState(0);
  const [selectedPlaceKey, setSelectedPlaceKey] = useState<string | null>(null);
  const [fitTo, setFitTo] = useState<{ bbox: [number, number, number, number]; seq: number } | null>(null);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  useEffect(() => { void loadWatchlist().then(setWatchlist); }, []);

  const { rank1, rank2, radiusKm, hexResolution } = settings;

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  const moveTo = useCallback((p: Place) => {
    setCenter(p);
    setSelectedCell(null);
    setStatus(isInGermany(p) ? null : 'Hinweis: Der Mittelpunkt liegt außerhalb Deutschlands – es werden nur Gebiete in Deutschland gezeigt.');
  }, []);

  const locate = useCallback(async () => {
    setBusy(true);
    setStatus('Standort wird ermittelt …');
    try {
      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      moveTo({ lat, lng, label: await reverseGeocode(lat, lng) });
      return true;
    } catch (err) {
      setStatus(geolocationErrorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, [moveTo]);

  // Start: gespeicherte Einstellungen laden, dann Standort (Vorgabe), sonst Heimat, sonst Mitte DE
  useEffect(() => {
    void (async () => {
      const s = await loadSettings();
      setSettings(s);
      if (s.home) setCenter(s.home);
      const ok = await locate();
      if (!ok && !s.home) setCenter(FALLBACK);
      setReady(true);
    })();
  }, [locate]);

  const search = useCallback(async (q: string) => {
    setBusy(true);
    setStatus(null);
    try {
      const r = await searchAddress(q);
      if (r.length === 0) setStatus(`Keine Treffer für „${q}“ in Deutschland.`);
      return r;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Adresssuche fehlgeschlagen.');
      return [];
    } finally {
      setBusy(false);
    }
  }, []);

  const grid = useMemo(() => buildGrid(center, radiusKm, hexResolution), [center, radiusKm, hexResolution]);
  const days = useMemo(() => daysBetween(period.start, period.end), [period]);
  useEffect(() => setDayIndex(-1), [period]);

  // Wetter laden (entprellt, damit der Radius-Regler nicht bei jedem Schritt abfragt)
  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(async () => {
      setWxLoading(true);
      setWxError(null);
      try {
        const r = await fetchWeather(grid.features.map((f) => f.properties), days, ctrl.signal);
        setWeather(r.data);
        if (r.error) {
          setWxError(r.error.message);
          if (r.error.rateLimited) retryTimer = setTimeout(() => setRetry((n) => n + 1), 65000);
        }
      } catch {
        /* abgebrochen – neue Abfrage läuft */
      } finally {
        if (!ctrl.signal.aborted) setWxLoading(false);
      }
    }, 400);
    return () => { clearTimeout(t); clearTimeout(retryTimer); ctrl.abort(); };
  }, [ready, grid, days, retry]);

  // Orte (für Städtebesuch und Ortsnamen)
  const bbox = useMemo(() => circleBounds(center, radiusKm), [center, radiusKm]);
  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetchTowns(bbox, ctrl.signal).then((t) => { setTowns(t); setOsmError(null); }, (err) => !ctrl.signal.aborted && setOsmError(err instanceof Error ? err.message : String(err)));
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [ready, bbox]);

  // Loipen nur bei Bedarf (Langlauf gewählt oder Infofeld im Winter)
  const needLoipen = rank1 === 'xc_ski' || rank2 === 'xc_ski' || (!rank1 && isWinter(period));
  useEffect(() => {
    if (!needLoipen || !ready) return;
    const ctrl = new AbortController();
    setLoipen(null);
    const t = setTimeout(() => {
      fetchLoipenCells(bbox, hexResolution, ctrl.signal).then(setLoipen, (err) => !ctrl.signal.aborted && setOsmError(err instanceof Error ? err.message : String(err)));
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [ready, needLoipen, bbox, hexResolution]);

  const availability: Availability = useMemo(
    () => ({ city: towns ? cityCells(towns, settings.cityMinPopulation, hexResolution) : null, loipe: loipen }),
    [towns, loipen, settings.cityMinPopulation, hexResolution],
  );

  const evals = useMemo(() => {
    const m = new Map<string, ReturnType<typeof evaluateCell>>();
    if (!weather) return m;
    for (const f of grid.features) {
      const d = weather.get(f.properties.id);
      if (d?.length) m.set(f.properties.id, evaluateCell(f.properties.id, d, rank1, rank2, availability));
    }
    return m;
  }, [weather, grid, rank1, rank2, availability]);

  const cells: FeatureCollection<Polygon, MapCellProps> = useMemo(() => ({
    type: 'FeatureCollection',
    features: grid.features.map((f) => {
      const ev = evals.get(f.properties.id);
      return { ...f, properties: { ...f.properties, level: displayLevel(ev?.primary ?? null, dayIndex), level2: displayLevel(ev?.secondary ?? null, dayIndex) } };
    }),
  }), [grid, evals, dayIndex]);

  const infoItems = useMemo(
    () => (!rank1 && weather ? suggestions(grid.features.map((f) => f.properties), weather, availability, towns, !isWinter(period) || !loipen, dayIndex) : []),
    [rank1, weather, grid, availability, towns, period, loipen, dayIndex],
  );

  // ---------- Stufe 3: Plätze im gewählten Gebiet ----------
  const selectedPlaceName = selectedCell && towns ? nearestTown(selectedCell.lat, selectedCell.lng, towns)?.town.name ?? null : null;
  const selectedFeature = useMemo(() => (selectedCell ? grid.features.find((f) => f.properties.id === selectedCell.id) ?? null : null), [grid, selectedCell]);

  useEffect(() => {
    setSelectedPlaceKey(null);
    if (!selectedFeature) { setCellData(null); return; }
    const id = selectedFeature.properties.id;
    const ring = selectedFeature.geometry.coordinates[0];
    const ctrl = new AbortController();
    setCellData({ cellId: id, data: null, loading: true, error: null });
    fetchCellData(ring, ctrl.signal).then(
      (data) => {
        setCellData({ cellId: id, data, loading: false, error: null });
        const lngs = ring.map((p) => p[0]);
        const lats = ring.map((p) => p[1]);
        setFitTo({ bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], seq: Date.now() });
      },
      (err) => { if (!ctrl.signal.aborted) setCellData({ cellId: id, data: null, loading: false, error: err instanceof Error ? err.message : String(err) }); },
    );
    return () => ctrl.abort();
  }, [selectedFeature, cellReload]);

  const places: CampPlace[] = useMemo(() => {
    const d = cellData?.data;
    if (!d) return [];
    const n = { wineries: d.wineries, farms: d.farms };
    return d.sites.filter((s) => isUsable(s.tags)).map((s) => {
      const type = classify(s.tags, s, n);
      return { key: s.key, lat: s.lat, lng: s.lng, tags: s.tags, lastEdit: s.lastEdit, type, name: s.tags.name ?? defaultName(type) };
    });
  }, [cellData]);

  const statuses = useMemo(() => new Map(places.map((p) => [p.key, openStatus(p.tags, days, p)])), [places, days]);
  const hiddenTypes = settings.hiddenTypes;
  const mapPlaces: MapPlace[] = useMemo(() => places.filter((p) => !hiddenTypes.includes(p.type)).map((p) => ({
    key: p.key, lat: p.lat, lng: p.lng, icon: placeTypeInfo(p.type).icon, title: p.name, state: statuses.get(p.key)?.state ?? 'unknown',
  })), [places, hiddenTypes, statuses]);

  const selectedPlace = places.find((p) => p.key === selectedPlaceKey) ?? null;
  const toggleType = (t: PlaceType) => updateSettings({ hiddenTypes: hiddenTypes.includes(t) ? hiddenTypes.filter((x) => x !== t) : [...hiddenTypes, t] });

  const placeActivities = useMemo(() => {
    if (!selectedPlace || !selectedCell || !cellData?.data) return null;
    const wx = weather?.get(selectedCell.id);
    if (!wx?.length) return null;
    const per = Object.fromEntries(ACTIVITIES.map(({ id }) => [id, rateDays(id, wx, selectedCell.id, availability)])) as Record<Activity, Rating[]>;
    const data = cellData.data;
    return activityLines(per, rank1, rank2, (a) => (isAvailable(a, selectedCell.id, availability) ? tourHint(a, selectedPlace, data, towns) : null));
  }, [selectedPlace, selectedCell, cellData, weather, availability, rank1, rank2, towns]);

  const isSaved = (key: string) => watchlist.some((w) => w.key === key);
  const toggleSave = (p: CampPlace) => {
    const next = isSaved(p.key)
      ? watchlist.filter((w) => w.key !== p.key)
      : [...watchlist, { key: p.key, name: p.name, type: p.type, lat: p.lat, lng: p.lng, place: selectedPlaceName, cellId: selectedCell?.id ?? '', website: website(p.tags), addedAt: new Date().toISOString(), note: '' }];
    setWatchlist(next);
    void saveWatchlist(next);
  };

  const pickSuggestion = (s: Suggestion) => {
    updateSettings({ rank1: s.activity, rank2: null });
    setSelectedCell(s.cell);
    setFocus({ lat: s.cell.lat, lng: s.cell.lng, seq: Date.now() });
  };

  const setActivities = (r1: Activity | null, r2: Activity | null) => updateSettings({ rank1: r1, rank2: r2 });

  const loadingNote = wxLoading ? 'Wetter wird geladen …' : null;
  const errorNote = wxError ?? (osmError ? `${osmError} Städte/Loipen werden ohne OSM-Prüfung bewertet.` : null);

  return (
    <div className="app">
      <div className="map-wrap">
        <MapView places={mapPlaces} selectedPlaceKey={selectedPlaceKey} onSelectPlace={setSelectedPlaceKey} fitTo={fitTo} center={center} radiusKm={radiusKm} cells={cells} selectedCellId={selectedCell?.id ?? null} focus={focus} onSelectCell={setSelectedCell} />
        <Legend rank1={rank1} rank2={rank2} />
        {loadingNote && <div className="map-badge" role="status">{loadingNote}</div>}
      </div>
      <Sidebar
        center={center}
        home={settings.home}
        radiusKm={radiusKm}
        cellCount={grid.features.length}
        status={errorNote ?? status}
        busy={busy}
        onLocate={() => void locate()}
        onSearch={search}
        onPick={moveTo}
        onUseHome={() => settings.home && moveTo(settings.home)}
        onSaveHome={() => { updateSettings({ home: center }); setStatus('Heimatadresse gespeichert.'); }}
        onRadius={(r) => { updateSettings({ radiusKm: r }); setSelectedCell(null); }}
        details={selectedPlace ? (
          <PlaceDetails
            place={selectedPlace}
            status={statuses.get(selectedPlace.key)!}
            distanceKm={distanceKm(center, selectedPlace)}
            near={nearestTown(selectedPlace.lat, selectedPlace.lng, towns ?? [])?.town.name ?? null}
            activities={placeActivities}
            saved={isSaved(selectedPlace.key)}
            onToggleSave={() => toggleSave(selectedPlace)}
            onBack={() => setSelectedPlaceKey(null)}
          />
        ) : selectedCell && (
          <CellDetails cell={selectedCell} place={selectedPlaceName} ev={evals.get(selectedCell.id) ?? null} rank1={rank1} rank2={rank2} loading={wxLoading}>
            <CellPlaces
              loading={!!cellData?.loading}
              error={cellData?.error ?? null}
              rows={cellData?.data ? places.map((p) => ({ key: p.key, name: p.name, icon: placeTypeInfo(p.type).icon, type: p.type, state: statuses.get(p.key)?.state ?? 'unknown' })) : null}
              hidden={hiddenTypes}
              onToggleType={toggleType}
              onSelect={setSelectedPlaceKey}
              onRetry={() => setCellReload((n) => n + 1)}
            />
          </CellDetails>
        )}
      >
        <PeriodPicker value={period} onChange={setPeriod} />
        <ActivityPicker rank1={rank1} rank2={rank2} onChange={setActivities} />
        <DaySlider days={days} value={dayIndex} onChange={setDayIndex} />
        {!rank1 && <InfoPanel items={infoItems} onPick={pickSuggestion} loading={wxLoading && !weather} />}
      </Sidebar>
    </div>
  );
}
