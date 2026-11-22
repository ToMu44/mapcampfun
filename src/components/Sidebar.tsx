import { useState, type FormEvent, type ReactNode } from 'react';
import type { Place } from '../lib/storage';

type Props = {
  center: Place;
  home: Place | null;
  radiusKm: number;
  cellCount: number;
  /** Oben im Bedienfeld (gewähltes Gebiet) */
  details?: ReactNode;
  children?: ReactNode;
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
        {p.status && <p className="status" role="status">{p.status}</p>}
        {p.details}
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

        {p.children}

      </div>
    </aside>
  );
}
