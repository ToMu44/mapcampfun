import { ACTIVITIES, CAMPING_TEXT, LEVEL_TEXT, activityLabel, type Activity, type Level } from '../lib/rating';
import { addDays, dayLabel, diffDays, FORECAST_DAYS, MAX_SPAN_DAYS, nextWeekend, toIso } from '../lib/period';
import { LEVEL_COLORS } from './MapView';
import type { Suggestion } from '../lib/evaluate';

export type Period = { start: string; end: string };

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const today = toIso(new Date());
  const weekend = nextWeekend();
  const isWeekend = value.start === weekend.start && value.end === weekend.end;
  const beyond = diffDays(today, value.end) >= FORECAST_DAYS;

  function set(start: string, end: string) {
    if (!start || !end) return;
    if (start < today) start = today;
    if (end < start) end = start;
    if (diffDays(start, end) >= MAX_SPAN_DAYS) end = addDays(start, MAX_SPAN_DAYS - 1);
    onChange({ start, end });
  }

  return (
    <section>
      <h2>Zeitraum</h2>
      <div className="row dates">
        <label>von<input type="date" value={value.start} min={today} onChange={(e) => set(e.target.value, value.end)} /></label>
        <label>bis<input type="date" value={value.end} min={value.start} onChange={(e) => set(value.start, e.target.value)} /></label>
      </div>
      <button className="secondary" disabled={isWeekend} onClick={() => onChange(weekend)}>{isWeekend ? '✓ Kommendes Wochenende' : 'Kommendes Wochenende'}</button>
      {beyond && <p className="status">Ab dem {dayLabel(addDays(today, FORECAST_DAYS))} gibt es keine Prognose. Für diese Tage zeigt die Karte <strong>Klimamittel der letzten Jahre</strong> – keine Vorhersage.</p>}
    </section>
  );
}

export function ActivityPicker({ rank1, rank2, onChange }: { rank1: Activity | null; rank2: Activity | null; onChange: (r1: Activity | null, r2: Activity | null) => void }) {
  return (
    <section>
      <h2>Aktivität</h2>
      <label className="field">Rang 1 <small>(färbt die Fläche)</small>
        <select value={rank1 ?? ''} onChange={(e) => { const v = (e.target.value || null) as Activity | null; onChange(v, v && rank2 !== v ? rank2 : null); }}>
          <option value="">– keine: nur Camping-Wetter –</option>
          {ACTIVITIES.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
        </select>
      </label>
      <label className="field">Rang 2 <small>(Punkt im Gebiet)</small>
        <select value={rank2 ?? ''} disabled={!rank1} onChange={(e) => onChange(rank1, (e.target.value || null) as Activity | null)}>
          <option value="">– keine –</option>
          {ACTIVITIES.filter((a) => a.id !== rank1).map((a) => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
        </select>
      </label>
    </section>
  );
}

export function DaySlider({ days, value, onChange }: { days: string[]; value: number; onChange: (i: number) => void }) {
  if (days.length < 2) return null;
  return (
    <section>
      <h2>Ansicht</h2>
      <div className="days" role="radiogroup" aria-label="Tag wählen">
        <button role="radio" aria-checked={value < 0} className={value < 0 ? 'on' : ''} onClick={() => onChange(-1)}>Gesamt</button>
        {days.map((d, i) => (
          <button key={d} role="radio" aria-checked={value === i} className={value === i ? 'on' : ''} onClick={() => onChange(i)}>{dayLabel(d)}</button>
        ))}
      </div>
      <p className="muted">{value < 0 ? 'Gesamt = bester Tag im Zeitraum.' : `Nur ${dayLabel(days[value])}.`}</p>
    </section>
  );
}

export function Legend({ rank1, rank2 }: { rank1: Activity | null; rank2: Activity | null }) {
  const text = rank1 ? LEVEL_TEXT : CAMPING_TEXT;
  const levels: Level[] = rank1 === 'city' || rank1 === 'xc_ski' || rank2 === 'city' || rank2 === 'xc_ski' ? ['green', 'yellow', 'red', 'grey'] : ['green', 'yellow', 'red'];
  return (
    <div className="legend" aria-label="Legende">
      <strong>{rank1 ? activityLabel(rank1) : 'Camping-Wetter'}</strong>
      {levels.map((l) => <span key={l}><i style={{ background: LEVEL_COLORS[l] }} />{text[l]}</span>)}
      {rank2 && <span className="legend-dot"><i className="dot" />Punkt = {activityLabel(rank2)} (nur wo möglich)</span>}
    </div>
  );
}

export function InfoPanel({ items, onPick, loading }: { items: Suggestion[]; onPick: (s: Suggestion) => void; loading: boolean }) {
  return (
    <section className="info">
      <h2>Vorschläge für den Zeitraum</h2>
      {loading ? <p className="muted">Wird berechnet …</p> : items.length === 0 ? (
        <p className="muted">Bei diesem Wetter ist keine Aktivität empfehlenswert.</p>
      ) : (
        <ul className="suggest">
          {items.map((s) => {
            const a = ACTIVITIES.find((x) => x.id === s.activity)!;
            return (
              <li key={s.activity}>
                <button className="suggest-item" onClick={() => onPick(s)}>
                  <i style={{ background: LEVEL_COLORS[s.level] }} />
                  <span><strong>{a.icon} {a.label}</strong> – {s.level === 'green' ? 'sehr gut' : 'mit Einschränkungen'}<br />
                    <small>{s.place ? `bei ${s.place}, ` : ''}{Math.round(s.cell.distanceKm)} km · {s.count} Gebiete</small></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
