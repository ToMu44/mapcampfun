import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeatureCollection, Polygon } from 'geojson';
import { MapView, type MapCellProps } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { ActivityPicker, DaySlider, InfoPanel, Legend, PeriodPicker, type Period } from './components/Controls';
import { CellDetails } from './components/CellDetails';
import { buildGrid, circleBounds, GERMANY_CENTER, isInGermany, type CellProps } from './lib/geo';
import { geolocationErrorText, getCurrentPosition, reverseGeocode, searchAddress } from './lib/geocode';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Place, type Settings } from './lib/storage';
import { daysBetween, fromIso, nextWeekend } from './lib/period';
import { fetchWeather, type DayWeather } from './lib/weather';
import { cityCells, fetchLoipenCells, fetchTowns, type Town } from './lib/osm';
import { displayLevel, evaluateCell, nearestTown, suggestions, type Availability, type Suggestion } from './lib/evaluate';
import type { Activity } from './lib/rating';

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

  const pickSuggestion = (s: Suggestion) => {
    updateSettings({ rank1: s.activity, rank2: null });
    setSelectedCell(s.cell);
    setFocus({ lat: s.cell.lat, lng: s.cell.lng, seq: Date.now() });
  };

  const setActivities = (r1: Activity | null, r2: Activity | null) => updateSettings({ rank1: r1, rank2: r2 });

  const selectedPlace = selectedCell && towns ? nearestTown(selectedCell.lat, selectedCell.lng, towns)?.town.name ?? null : null;
  const loadingNote = wxLoading ? 'Wetter wird geladen …' : null;
  const errorNote = wxError ?? (osmError ? `${osmError} Städte/Loipen werden ohne OSM-Prüfung bewertet.` : null);

  return (
    <div className="app">
      <div className="map-wrap">
        <MapView center={center} radiusKm={radiusKm} cells={cells} selectedCellId={selectedCell?.id ?? null} focus={focus} onSelectCell={setSelectedCell} />
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
        details={selectedCell && (
          <CellDetails cell={selectedCell} place={selectedPlace} ev={evals.get(selectedCell.id) ?? null} rank1={rank1} rank2={rank2} loading={wxLoading} />
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
