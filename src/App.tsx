import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { buildGrid, GERMANY_CENTER, isInGermany, type CellProps } from './lib/geo';
import { geolocationErrorText, getCurrentPosition, reverseGeocode, searchAddress } from './lib/geocode';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Place, type Settings } from './lib/storage';

const FALLBACK: Place = { ...GERMANY_CENTER, label: 'Mitte Deutschlands' };

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [center, setCenter] = useState<Place>(FALLBACK);
  const [selectedCell, setSelectedCell] = useState<CellProps | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const grid = useMemo(() => buildGrid(center, settings.radiusKm, settings.hexResolution), [center, settings.radiusKm, settings.hexResolution]);

  return (
    <div className="app">
      <MapView center={center} radiusKm={settings.radiusKm} grid={grid} selectedCellId={selectedCell?.id ?? null} onSelectCell={setSelectedCell} />
      <Sidebar
        center={center}
        home={settings.home}
        radiusKm={settings.radiusKm}
        cellCount={grid.features.length}
        selectedCell={selectedCell}
        status={status}
        busy={busy}
        onLocate={() => void locate()}
        onSearch={search}
        onPick={moveTo}
        onUseHome={() => settings.home && moveTo(settings.home)}
        onSaveHome={() => { updateSettings({ home: center }); setStatus('Heimatadresse gespeichert.'); }}
        onRadius={(radiusKm) => { updateSettings({ radiusKm }); setSelectedCell(null); }}
      />
    </div>
  );
}
