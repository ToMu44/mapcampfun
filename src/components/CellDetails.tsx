import type { CellProps } from '../lib/geo';
import type { CellEval } from '../lib/evaluate';
import { bestOf, CAMPING_TEXT, LEVEL_TEXT, activityLabel, type Activity, type Rating } from '../lib/rating';
import { dayLabel } from '../lib/period';
import { weatherIcon } from '../lib/weather';
import { LEVEL_COLORS } from './MapView';

const n0 = (v: number | null, unit: string) => (v == null ? '–' : `${Math.round(v)}${unit}`);
const n1 = (v: number | null, unit: string) => (v == null ? '–' : `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })}${unit}`);

type Props = { cell: CellProps; place: string | null; ev: CellEval | null; rank1: Activity | null; rank2: Activity | null; loading: boolean };

export function CellDetails({ cell, place, ev, rank1, rank2, loading }: Props) {
  return (
    <section>
      <h2>Gewähltes Gebiet</h2>
      <p className="cell-title"><strong>{place ? `bei ${place}` : 'Gebiet'}</strong> · {Math.round(cell.distanceKm)} km Luftlinie</p>
      {!ev ? <p className="muted">{loading ? 'Wetter wird geladen …' : 'Keine Wetterdaten.'}</p> : (
        <>
          <Summary label={rank1 ? activityLabel(rank1) : 'Camping-Wetter'} ratings={ev.primary} dates={ev.days.map((d) => d.date)} camping={!rank1} />
          {ev.secondary && rank2 && <Summary label={activityLabel(rank2)} ratings={ev.secondary} dates={ev.days.map((d) => d.date)} camping={false} />}
          <div className="table-wrap">
            <table className="wx">
              <thead><tr><th>Tag</th><th></th><th>max/min</th><th>Regen</th><th>Schnee</th><th>Böen</th><th>Sonne</th></tr></thead>
              <tbody>
                {ev.days.map((d, i) => (
                  <tr key={d.date}>
                    <td>{dayLabel(d.date)}{d.source === 'climate' && <sup title="Klimamittel">K</sup>}</td>
                    <td aria-hidden>{weatherIcon(d)}</td>
                    <td>{n0(d.tmax, '°')}/{n0(d.tmin, '°')}</td>
                    <td>{n1(d.rain, ' mm')}</td>
                    <td>{d.snowDepthCm ? `${Math.round(d.snowDepthCm)} cm` : (d.snowfall ?? 0) >= 0.5 ? `+${n1(d.snowfall, '')}` : '–'}</td>
                    <td>{n0(d.gustMax, '')}</td>
                    <td>{n0(d.sunshineH, ' h')}</td>
                    <td className="dots">
                      <Dot r={ev.primary[i]} />
                      {ev.secondary && <Dot r={ev.secondary[i]} small />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Böen in km/h. Schnee: Schneehöhe bzw. +Neuschnee in cm.{ev.days.some((d) => d.source === 'climate') && ' K = Klimamittel der letzten 3 Jahre, keine Prognose.'}</p>
        </>
      )}
      <p className="hint">Stellplätze im Gebiet folgen in Stufe 3.</p>
    </section>
  );
}

function Summary({ label, ratings, dates, camping }: { label: string; ratings: Rating[]; dates: string[]; camping: boolean }) {
  const b = bestOf(ratings);
  return (
    <p className="summary">
      <i style={{ background: LEVEL_COLORS[b.level] }} />
      <span><strong>{label}: {(camping ? CAMPING_TEXT : LEVEL_TEXT)[b.level]}</strong>{b.dayIndex >= 0 && ratings.length > 1 && b.level !== 'grey' ? ` (bester Tag: ${dayLabel(dates[b.dayIndex])})` : ''}<br /><small>{b.reason}</small></span>
    </p>
  );
}

function Dot({ r, small }: { r?: Rating; small?: boolean }) {
  if (!r) return null;
  return <i className={small ? 'dot small' : 'dot'} style={{ background: LEVEL_COLORS[r.level] }} title={r.reason} />;
}
