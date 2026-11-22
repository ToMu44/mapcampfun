import type { CampPlace, OpenStatus } from '../lib/places';
import { appleMapsUrl, bookingText, capacityText, costText, facilities, osmUrl, placeTypeInfo, website } from '../lib/places';
import { ACTIVITIES, bestOf, LEVEL_TEXT, type Activity, type Rating } from '../lib/rating';
import { TOUR_LINKS } from '../lib/tours';
import { LEVEL_COLORS } from './MapView';

export type ActivityLine = { activity: Activity; rating: Rating; tour: string | null; rank: 1 | 2 | null };

type Props = {
  place: CampPlace;
  status: OpenStatus;
  distanceKm: number;
  near: string | null;
  activities: ActivityLine[] | null;
  saved: boolean;
  onToggleSave: () => void;
  onBack: () => void;
};

const NA = <span className="na">keine Angabe</span>;

export function PlaceDetails({ place, status, distanceKm, near, activities, saved, onToggleSave, onBack }: Props) {
  const t = place.tags;
  const info = placeTypeInfo(place.type);
  const web = website(t);
  const fac = facilities(t);
  const known = fac.filter((f) => f.value !== null);
  const recommended = activities?.filter((a) => a.rating.level === 'green' || a.rating.level === 'yellow') ?? [];
  const withTour = recommended.filter((a) => a.tour);

  return (
    <section className="place">
      <button className="link back" onClick={onBack}>‹ Zurück zum Gebiet</button>
      <header className="place-head">
        <span className="place-icon" aria-hidden>{info.icon}</span>
        <div>
          <h3>{place.name}</h3>
          <p className="muted">{info.label}{near ? ` · bei ${near}` : ''} · {Math.round(distanceKm)} km Luftlinie</p>
        </div>
      </header>
      <p className={`open-state ${status.state}`}>{status.state === 'open' ? '● ' : status.state === 'closed' ? '○ ' : '? '}{status.text}</p>

      <button className={saved ? 'secondary saved' : 'primary-wide'} onClick={onToggleSave} aria-pressed={saved}>
        {saved ? '★ Auf der Merkliste – entfernen' : '☆ Auf die Merkliste'}
      </button>

      <dl className="facts">
        <dt>Kosten</dt><dd>{costText(t) ?? NA}</dd>
        <dt>Plätze</dt><dd>{capacityText(t) ?? NA}</dd>
        <dt>Buchung</dt><dd>{bookingText(t) ?? NA}</dd>
        <dt>Webseite</dt><dd>{web ? <a href={web} target="_blank" rel="noopener noreferrer">{web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : NA}</dd>
        {(t.phone || t['contact:phone']) && (<><dt>Telefon</dt><dd><a href={`tel:${(t.phone ?? t['contact:phone']).replace(/\s/g, '')}`}>{t.phone ?? t['contact:phone']}</a></dd></>)}
        <dt>Ausstattung</dt>
        <dd>
          {known.length === 0 ? NA : (
            <ul className="fac">
              {fac.map((f) => (
                <li key={f.label} className={f.value === null ? 'unknown' : f.value ? 'yes' : 'no'}>
                  {f.value === null ? '?' : f.value ? '✓' : '✗'} {f.label}{f.detail ? ` (${f.detail})` : ''}
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Quelle</dt>
        <dd>OpenStreetMap{place.lastEdit ? `, Stand ${new Date(place.lastEdit).toLocaleDateString('de-DE')}` : ''} · <a href={osmUrl(place.key)} target="_blank" rel="noopener noreferrer">in OSM ansehen</a></dd>
      </dl>

      <h4>Freizeitaktivitäten</h4>
      {!activities ? <p className="muted">Wetter wird geladen …</p> : (
        <ul className="acts">
          {activities.map((a) => {
            const meta = ACTIVITIES.find((x) => x.id === a.activity)!;
            return (
              <li key={a.activity}>
                <i style={{ background: LEVEL_COLORS[a.rating.level] }} />
                <span><strong>{meta.icon} {meta.label}{a.rank ? ` (Rang ${a.rank})` : ''}: {LEVEL_TEXT[a.rating.level]}</strong><br /><small>{a.rating.reason}</small></span>
              </li>
            );
          })}
        </ul>
      )}

      <h4>Tourenvorschlag</h4>
      {withTour.length === 0 ? (
        <p className="muted">{recommended.length ? 'Keine markierten Routen in OSM in der Nähe gefunden.' : 'Im Zeitraum ist keine Aktivität empfehlenswert.'}</p>
      ) : (
        <ul className="tours">
          {withTour.slice(0, 2).map((a) => (
            <li key={a.activity}><strong>{ACTIVITIES.find((x) => x.id === a.activity)!.label}:</strong> {a.tour}</li>
          ))}
        </ul>
      )}
      <p className="links">Mehr Touren: {TOUR_LINKS.map((l, i) => (<span key={l.url}>{i > 0 && ' · '}<a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a></span>))}</p>

      <a className="button-link" href={appleMapsUrl(place)} target="_blank" rel="noopener noreferrer">Route in Apple Karten öffnen</a>
    </section>
  );
}

/** Beste Tagesbewertung je Aktivität, Rang 1/2 zuerst. */
export function activityLines(per: Record<Activity, Rating[]>, rank1: Activity | null, rank2: Activity | null, tour: (a: Activity) => string | null): ActivityLine[] {
  const order = (a: Activity) => (a === rank1 ? 0 : a === rank2 ? 1 : 2);
  return ACTIVITIES.map(({ id }) => ({ activity: id, rating: bestOf(per[id]), tour: tour(id), rank: (id === rank1 ? 1 : id === rank2 ? 2 : null) as 1 | 2 | null }))
    .sort((x, y) => order(x.activity) - order(y.activity) || ['green', 'yellow', 'red', 'grey'].indexOf(x.rating.level) - ['green', 'yellow', 'red', 'grey'].indexOf(y.rating.level));
}
