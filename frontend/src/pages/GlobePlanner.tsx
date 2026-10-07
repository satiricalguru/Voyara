import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { EarthMarker, EarthStop } from '../components/Earth';
import { zoomEarth } from '../components/Earth';
import { Icon, weatherIcon } from '../components/Icon';
import { Stepper } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { INTERESTS } from '../data/voyara';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { guideService, type Place } from '../services/guide';
import type { Budget, Pace, WeatherDay } from '../types';
import { addDays, date, isoDay, money, plural } from '../utils/format';

const Earth = lazy(() => import('../components/Earth'));

interface Stop extends Place {
  key: string;
  days: number;
  pending?: boolean;
  weather?: WeatherDay | null;
}

const PRESETS: { label: string; stops: Place[] }[] = [
  { label: 'Lisbon → Paris', stops: [{ name: 'Lisbon', lat: 38.72, lng: -9.14, country: 'Portugal' }, { name: 'Paris', lat: 48.86, lng: 2.35, country: 'France' }] },
  { label: 'Goa → Kochi → Bali', stops: [{ name: 'Goa', lat: 15.49, lng: 73.83, country: 'India' }, { name: 'Kochi', lat: 9.93, lng: 76.27, country: 'India' }, { name: 'Bali', lat: -8.51, lng: 115.26, country: 'Indonesia' }] },
  { label: 'Tokyo → Kyoto', stops: [{ name: 'Tokyo', lat: 35.68, lng: 139.65, country: 'Japan' }, { name: 'Kyoto', lat: 35.01, lng: 135.77, country: 'Japan' }] },
  { label: 'Jaipur → Udaipur → Mumbai', stops: [{ name: 'Jaipur', lat: 26.91, lng: 75.79, country: 'India' }, { name: 'Udaipur', lat: 24.59, lng: 73.71, country: 'India' }, { name: 'Mumbai', lat: 19.08, lng: 72.88, country: 'India' }] },
];

const R = 6371;
function km(a: Place, b: Place) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
const legInfo = (a: Place, b: Place) => {
  const d = km(a, b);
  const mins = Math.round((d / 780) * 60 + 40);
  return { km: d, mins, co2: Math.round(d * 0.09), flight: d >= 350 };
};
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

let seq = 0;

export default function GlobePlanner() {
  useDocumentTitle('Globe');
  const nav = useNavigate();
  const toast = useToast();
  const stage = useRef<HTMLDivElement>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [startDate, setStartDate] = useState(addDays(isoDay(), 21));
  const [adults, setAdults] = useState(2);
  const [budget, setBudget] = useState<Budget>('MODERATE');
  const [pace, setPace] = useState<Pace>('balanced');
  const [interests, setInterests] = useState<string[]>(['food', 'culture']);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const add = useCallback(
    (p: Place) => {
      setStops((cur) => {
        if (cur.length >= 6) {
          toast('Up to six stops per route', 'error');
          return cur;
        }
        if (cur.some((s) => !s.pending && s.name === p.name)) {
          toast(`${p.name} is already on the route`);
          return cur;
        }
        return [...cur, { ...p, key: `s${++seq}`, days: 3, weather: undefined }];
      });
      setFocus({ lat: p.lat, lng: p.lng });
    },
    [toast],
  );

  // Clicking open ground: drop a pending pin, then resolve it to a named place.
  const pick = useCallback(
    async (pt: { lat: number; lng: number }) => {
      const key = `p${++seq}`;
      setStops((cur) => (cur.length >= 6 ? cur : [...cur, { name: '…', lat: pt.lat, lng: pt.lng, key, days: 3, pending: true }]));
      try {
        const place = await guideService.reverse(pt.lat, pt.lng);
        setStops((cur) => {
          const without = cur.filter((s) => s.key !== key);
          if (without.some((s) => s.name === place.name)) {
            toast(`${place.name} is already on the route`);
            return without;
          }
          return cur.map((s) => (s.key === key ? { ...place, key, days: 3 } : s));
        });
        setFocus({ lat: place.lat, lng: place.lng });
      } catch (err) {
        setStops((cur) => cur.filter((s) => s.key !== key));
        toast(errorMessage(err), 'error');
      }
    },
    [toast],
  );

  const onMarker = useCallback(
    (m: EarthMarker) => {
      add({ ...m, curated: true });
      // Curated pins snap server-side — this just fills in the country.
      guideService
        .reverse(m.lat, m.lng)
        .then((p) => setStops((cur) => cur.map((s) => (s.name === m.name && !s.country ? { ...s, country: p.country } : s))))
        .catch(() => undefined);
    },
    [add],
  );

  // Live "today" weather for each resolved stop
  useEffect(() => {
    stops.forEach((s) => {
      if (s.pending || s.weather !== undefined) return;
      setStops((cur) => cur.map((x) => (x.key === s.key ? { ...x, weather: null } : x)));
      guideService
        .weatherToday(s.name)
        .then((w) => setStops((cur) => cur.map((x) => (x.key === s.key ? { ...x, weather: w ?? null } : x))))
        .catch(() => undefined);
    });
  }, [stops]);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      add(await guideService.geocode(query.trim()));
      setQuery('');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setSearching(false);
    }
  };

  const move = (i: number, d: -1 | 1) =>
    setStops((cur) => {
      const j = i + d;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const real = stops.filter((s) => !s.pending);
  const legs = real.slice(1).map((s, i) => ({ from: real[i], to: s, ...legInfo(real[i], s) }));
  const totalDays = real.reduce((s, x) => s + x.days, 0);
  const totalKm = legs.reduce((s, l) => s + l.km, 0);
  const totalCo2 = legs.reduce((s, l) => s + l.co2, 0);
  const fare = budget === 'LUXURY' ? 14 : budget === 'SHOESTRING' ? 4.5 : 7;
  const airfare = legs.reduce((s, l) => s + (l.flight ? l.km * fare : l.km * 3) * adults, 0);
  const earthStops: EarthStop[] = useMemo(() => stops.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, pending: s.pending })), [stops]);

  const architect = async () => {
    if (real.length < 2) return;
    if (totalDays > 21) return toast('Routes are limited to 21 days', 'error');
    setBusy(true);
    try {
      const it = await guideService.route({
        stops: real.map((s) => ({ name: s.name, lat: s.lat, lng: s.lng, country: s.country, days: s.days })),
        startDate,
        travelers: { adults, children: 0 },
        budget,
        pace,
        interests,
      });
      nav(`/trip/${it.id}`, { state: { fresh: true } });
    } catch (err) {
      toast(errorMessage(err), 'error');
      setBusy(false);
    }
  };

  return (
    <div className="globe-page">
      <aside className="globe-panel">
        <div className="stack">
          <span className="micro dim">Globe · route planner</span>
          <h1 className="display globe-title">Draw the trip.</h1>
          <p className="copy dim">Spin the earth and tap two or more places. We’ll fly the legs, then architect every city — with its own forecast, stays and rentals.</p>
        </div>

        <form className="input-action" onSubmit={search}>
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a city — Hanoi, Leh, Porto…" aria-label="Add a city" />
          <button className="label" disabled={searching}>{searching ? '…' : 'Add'}</button>
        </form>

        {stops.length === 0 ? (
          <div className="globe-empty">
            <span className="micro dim">Try a route</span>
            <div className="chips">
              {PRESETS.map((p) => (
                <button key={p.label} className="chip" onClick={() => p.stops.forEach((s) => add({ ...s, curated: true }))}>{p.label}</button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="route-list">
            {stops.map((s, i) => {
              const leg = !s.pending && i > 0 ? legs.find((l) => l.to.key === s.key) : null;
              return (
                <li key={s.key}>
                  {leg && (
                    <div className="route-leg micro">
                      <Icon name={leg.flight ? 'arrow-up-right' : 'car'} size={12} />
                      <span>{leg.km.toLocaleString('en-IN')} km · {hm(leg.mins)} · {leg.co2} kg CO₂</span>
                    </div>
                  )}
                  <div className={`route-stop ${s.pending ? 'is-pending' : ''}`}>
                    <button className="route-n label" onClick={() => setFocus({ lat: s.lat, lng: s.lng })} aria-label={`Focus ${s.name}`}>{i + 1}</button>
                    <div className="stack-sm grow" style={{ gap: 3, minWidth: 0 }}>
                      <span className="label truncate">{s.pending ? 'Locating…' : s.name}</span>
                      <span className="micro dim truncate">
                        {s.country ?? `${s.lat.toFixed(2)}, ${s.lng.toFixed(2)}`}
                        {s.weather && <> · <Icon name={weatherIcon(s.weather.code, s.weather.wet)} size={11} style={{ display: 'inline', verticalAlign: -1 }} /> {s.weather.tMax}°</>}
                      </span>
                    </div>
                    {!s.pending && (
                      <span className="stepper route-days">
                        <button type="button" onClick={() => setStops((c) => c.map((x) => (x.key === s.key ? { ...x, days: Math.max(1, x.days - 1) } : x)))} aria-label="Fewer days"><Icon name="minus" size={11} /></button>
                        <span className="label tabular">{s.days}d</span>
                        <button type="button" onClick={() => setStops((c) => c.map((x) => (x.key === s.key ? { ...x, days: Math.min(10, x.days + 1) } : x)))} aria-label="More days"><Icon name="plus" size={11} /></button>
                      </span>
                    )}
                    <span className="route-tools">
                      <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                      <button onClick={() => move(i, 1)} disabled={i === stops.length - 1} aria-label="Move down">↓</button>
                      <button onClick={() => setStops((c) => c.filter((x) => x.key !== s.key))} aria-label={`Remove ${s.name}`}><Icon name="close" size={12} /></button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {real.length >= 1 && (
          <div className="stack globe-settings">
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field"><span className="field-label">Depart</span><input className="input" type="date" min={isoDay()} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
              <div className="field"><span className="field-label">Travellers</span><Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={8} /></div>
            </div>
            <div className="chips">
              {(['SHOESTRING', 'MODERATE', 'LUXURY'] as Budget[]).map((b) => (
                <button key={b} className={`chip ${budget === b ? 'is-active' : ''}`} onClick={() => setBudget(b)}>{b === 'SHOESTRING' ? 'Shoestring' : b === 'MODERATE' ? 'Comfortable' : 'Luxury'}</button>
              ))}
              {(['relaxed', 'balanced', 'packed'] as Pace[]).map((p) => (
                <button key={p} className={`chip ${pace === p ? 'is-active' : ''}`} onClick={() => setPace(p)}>{p[0].toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
            <div className="chips">
              {INTERESTS.slice(0, 8).map((i) => (
                <button key={i} className={`chip ${interests.includes(i) ? 'is-active' : ''}`} onClick={() => setInterests((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))}>{i}</button>
              ))}
            </div>
          </div>
        )}

        <div className="globe-total">
          <div className="globe-stats">
            <div><span className="heading-sm tabular">{real.length}</span><span className="micro dim">Stops</span></div>
            <div><span className="heading-sm tabular">{totalDays}</span><span className="micro dim">Days</span></div>
            <div><span className="heading-sm tabular">{totalKm.toLocaleString('en-IN')}</span><span className="micro dim">Km</span></div>
            <div><span className="heading-sm tabular">{totalCo2}</span><span className="micro dim">Kg CO₂</span></div>
          </div>
          {real.length >= 2 && (
            <p className="micro dim">
              {date(startDate)} → {date(addDays(startDate, Math.max(0, totalDays - 1)))} · est. fares {money(airfare)} for {plural(adults, 'traveller')}
            </p>
          )}
          <button className="btn btn-lg" disabled={real.length < 2 || busy} onClick={architect}>
            {busy ? <><span className="spinner" /> Architecting {real.length} cities…</> : real.length < 2 ? 'Pick at least two places' : <>Architect this route <span className="arrow">→</span></>}
          </button>
        </div>
      </aside>

      <div className="globe-stage" ref={stage}>
        {failed ? (
          <div className="empty" style={{ margin: 40 }}><p className="heading-sm">3D isn’t available in this browser.</p><p className="copy dim">Use the search box to add cities instead.</p></div>
        ) : (
          <Suspense fallback={<div className="earth-loading micro dim">Loading earth…</div>}>
            <Earth stops={earthStops} focus={focus} onPick={pick} onMarker={onMarker} onFail={() => setFailed(true)} wheelZoom autoRotate={stops.length === 0} />
          </Suspense>
        )}
        <div className="globe-hud">
          <span className="micro">Drag to spin · tap to drop a stop · scroll to zoom</span>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn-icon" onClick={() => zoomEarth(stage.current, 0.5)} aria-label="Zoom in"><Icon name="plus" size={14} /></button>
            <button className="btn-icon" onClick={() => zoomEarth(stage.current, -0.5)} aria-label="Zoom out"><Icon name="minus" size={14} /></button>
            {stops.length > 0 && <button className="btn-ghost subtle" onClick={() => { setStops([]); setFocus(null); }}>Clear route</button>}
          </span>
        </div>
      </div>
    </div>
  );
}
