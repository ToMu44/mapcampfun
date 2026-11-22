import { PLACE_TYPES, type PlaceType } from '../lib/places';
import { PORTAL_LINKS } from '../lib/tours';

export type PlaceRow = { key: string; name: string; icon: string; type: PlaceType; state: 'open' | 'closed' | 'unknown' };

type Props = {
  loading: boolean;
  error: string | null;
  rows: PlaceRow[] | null;
  hidden: PlaceType[];
  onToggleType: (t: PlaceType) => void;
  onSelect: (key: string) => void;
  onRetry: () => void;
};

const STATE = { open: 'offen', closed: 'geschlossen', unknown: 'Öffnung unbekannt' };

export function CellPlaces({ loading, error, rows, hidden, onToggleType, onSelect, onRetry }: Props) {
  const counts = new Map<PlaceType, number>();
  rows?.forEach((r) => counts.set(r.type, (counts.get(r.type) ?? 0) + 1));
  const visible = rows?.filter((r) => !hidden.includes(r.type)) ?? [];
  const order = { open: 0, unknown: 1, closed: 2 };

  return (
    <div className="cell-places">
      <h4>Übernachtungsplätze im Gebiet</h4>
      {loading && <p className="muted">Plätze werden aus OpenStreetMap geladen …</p>}
      {error && <p className="status">{error} <button className="link inline" onClick={onRetry}>Erneut versuchen</button></p>}
      {rows && (
        <>
          <div className="type-chips" role="group" aria-label="Platztypen ein- und ausblenden">
            {PLACE_TYPES.map((t) => (
              <button key={t.id} className={hidden.includes(t.id) ? 'chip off' : 'chip'} aria-pressed={!hidden.includes(t.id)} onClick={() => onToggleType(t.id)} title={t.label}>
                {t.icon} {counts.get(t.id) ?? 0}
              </button>
            ))}
          </div>
          {rows.length === 0 ? <p className="muted">In OpenStreetMap sind hier keine Plätze für Wohnmobile erfasst.</p> : (
            <ul className="place-list">
              {[...visible].sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name, 'de')).map((r) => (
                <li key={r.key}>
                  <button className="link" onClick={() => onSelect(r.key)}>
                    <span aria-hidden>{r.icon}</span> {r.name} <small className={`st ${r.state}`}>{STATE[r.state]}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="links">Weitere Plätze in dieser Region: {PORTAL_LINKS.map((l, i) => (<span key={l.url}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></span>))}</p>
    </div>
  );
}
