import { useState, type FormEvent } from 'react';
import type { CellProps } from '../lib/geo';
import type { Place } from '../lib/storage';

type Props = {
  center: Place;
  home: Place | null;
  radiusKm: number;
  cellCount: number;
  selectedCell: CellProps | null;
  status: string | null;
  busy: boolean;
  onLocate: () => void;
  onSearch: (q: string) => Promise<Place[]>;
  onPick: (p: Place) => void;
  onUseHome: () => void;
  onSaveHome: () => void;
  onRadius: (km: number) => void;
};

export function Sidebar(p: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(true);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setResults(await p.onSearch(query.trim()));
  }

  const isHome = p.home && p.home.lat === p.center.lat && p.home.lng === p.center.lng;

  return (
    <aside className={`panel ${open ? 'open' : 'closed'}`}>
      <button className="sheet-handle" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? 'Bedienfeld einklappen' : 'Bedienfeld ausklappen'}>
        <span />
      </button>
      <header className="panel-head">
        <h1>MapCampFun</h1>
        <p className="muted">Mittelpunkt: <strong>{p.center.label}</strong></p>
      </header>

      <div className="panel-body">
        <section>
          <h2>Mittelpunkt</h2>
          <div className="row">
            <button onClick={p.onLocate} disabled={p.busy}>📍 Mein Standort</button>
            <button onClick={p.onUseHome} disabled={!p.home || p.busy} title={p.home ? p.home.label : 'Noch keine Heimatadresse gespeichert'}>🏠 Heimat</button>
          </div>
          <form onSubmit={submit} className="row">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ort oder Adresse in Deutschland" aria-label="Adresse suchen" enterKeyHint="search" />
            <button type="submit" disabled={p.busy || !query.trim()}>Suchen</button>
          </form>
          {results.length > 0 && (
            <ul className="results">
              {results.map((r) => (
                <li key={`${r.lat},${r.lng}`}>
                  <button className="link" onClick={() => { p.onPick(r); setResults([]); setQuery(''); }}>{r.fullLabel ?? r.label}</button>
                </li>
              ))}
            </ul>
          )}
          <button className="secondary" onClick={p.onSaveHome} disabled={!!isHome}>
            {isHome ? '✓ Ist Heimatadresse' : 'Als Heimatadresse speichern'}
          </button>
        </section>

        <section>
          <h2>Suchradius</h2>
          <label className="radius">
            <input type="range" min={25} max={400} step={5} value={p.radiusKm} onChange={(e) => p.onRadius(+e.target.value)} aria-label="Radius in km" />
            <output>{p.radiusKm} km</output>
          </label>
          <p className="muted">{p.cellCount} Gebiete in Deutschland</p>
        </section>

        <section>
          <h2>Gewähltes Gebiet</h2>
          {p.selectedCell ? (
            <dl className="facts">
              <dt>Mittelpunkt</dt><dd>{p.selectedCell.lat.toFixed(3)}, {p.selectedCell.lng.toFixed(3)}</dd>
              <dt>Luftlinie</dt><dd>{Math.round(p.selectedCell.distanceKm)} km</dd>
            </dl>
          ) : (
            <p className="muted">Tippe auf ein Gebiet der Karte.</p>
          )}
          <p className="hint">Wetterfärbung folgt in Stufe 2, Stellplätze in Stufe 3.</p>
        </section>

        {p.status && <p className="status" role="status">{p.status}</p>}
      </div>
    </aside>
  );
}
