import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { HotelMap, type MapPoint } from '../components/HotelMap';
import { Icon } from '../components/Icon';
import { WeatherChip } from '../components/Weather';
import { ErrorBox, Img, Kv, Modal, PageLoader, SectionHead, StatusPill } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SLOT_LABEL, VEHICLE_LABEL } from '../data/voyara';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import type { PayMethod } from '../services/booking';
import { tripService } from '../services/trips';
import type { Itinerary, ItineraryDay, TripDocument } from '../types';
import { findDestination, sized } from '../utils/destinations';
import { date, dateLong, fileSize, money, plural, weekday } from '../utils/format';

export default function LiveItinerary() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const loc = useLocation();
  const { data, error, loading, setData, reload } = useAsync(() => tripService.get(id), [id, user?.id]);
  const trip = data?.trip;
  useDocumentTitle(trip?.title);

  // Anonymous drafts are claimed automatically once the traveller is signed in.
  const claimed = useRef(false);
  useEffect(() => {
    if (trip && user && !trip.user && !claimed.current) {
      claimed.current = true;
      tripService
        .claim(trip.id)
        .then((t) => {
          setData((d) => (d ? { ...d, trip: { ...d.trip, user: t.user }, isOwner: true } : d));
          toast('Saved to your trips');
        })
        .catch(() => undefined);
    }
  }, [trip, user, setData, toast]);

  useEffect(() => {
    if ((loc.state as { fresh?: boolean } | null)?.fresh) toast('Your trip is architected');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) return <PageLoader label="Opening your trip" />;
  if (error || !trip) return <div className="page wrap"><ErrorBox message={error ?? 'Trip not found'} onRetry={reload} /></div>;

  const update = (t: Itinerary) => setData((d) => (d ? { ...d, trip: { ...t, bookings: d.trip.bookings, rentalBookings: d.trip.rentalBookings } } : d));
  return <TripView trip={trip} isOwner={!!data?.isOwner} documents={data?.documents ?? []} onUpdate={update} onReload={reload} />;
}

export function TripView({ trip, isOwner, documents, onUpdate, onReload, readOnly = false }: {
  trip: Itinerary;
  isOwner: boolean;
  documents: TripDocument[];
  onUpdate?: (t: Itinerary) => void;
  onReload?: () => void;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [activeDay, setActiveDay] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const canEdit = !readOnly && isOwner;

  const day = trip.days[activeDay] ?? trip.days[0];
  const cover = trip.coverImage ?? findDestination(trip.destination.name)?.image ?? trip.overview?.thumbnail;
  const pax = trip.travelers.adults + trip.travelers.children;
  const wetDays = trip.days.filter((d) => d.weather?.wet).length;
  const swaps = trip.days.reduce((s, d) => s + d.items.filter((i) => i.swapped).length, 0);

  const points: MapPoint[] = useMemo(
    () =>
      (day?.items ?? [])
        .filter((i) => i.place?.lat)
        .map((i, n) => ({
          id: i._id,
          lat: i.place!.lat,
          lng: i.place!.lng,
          label: String(n + 1),
          kind: i.slot === 'LUNCH' || i.slot === 'DINNER' ? 'num-ghost' : 'num',
          title: i.title,
          sub: `${i.time ?? ''} · ${SLOT_LABEL[i.slot]}`,
        })),
    [day],
  );

  const swap = async (dayId: string, itemId: string) => {
    if (!canEdit) return;
    setBusy(itemId);
    try {
      onUpdate?.(await tripService.swap(trip.id, dayId, itemId));
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const refreshWeather = async () => {
    setBusy('weather');
    try {
      const r = await tripService.refreshWeather(trip.id);
      onUpdate?.(r.trip);
      toast(r.swaps ? `Forecast updated · ${plural(r.swaps, 'stop')} re-planned` : 'Forecast updated · plan still holds');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const openBook = () => {
    if (!user) return nav('/login', { state: { from: `/trip/${trip.id}` } });
    setBookOpen(true);
  };

  return (
    <div className="trip">
      <header className="trip-hero inverse">
        <div className="trip-hero-media" aria-hidden="true">
          <Img src={sized(cover, 2000)} alt="" eager />
        </div>
        <div className="trip-hero-inner bleed">
          <div className="crumbs micro">
            <Link to={readOnly ? '/community' : user ? '/trips' : '/architect'}>{readOnly ? 'Community' : user ? 'My trips' : 'Architect'}</Link>
            <span>/</span>
            <span>{trip.destination.name}</span>
          </div>
          <h1 className={`mega trip-title ${(trip.stops?.length ?? 0) > 1 ? 'is-route' : ''}`}>{trip.destination.name}</h1>
          <div className="trip-meta">
            <span className="label">{trip.title}</span>
            <span className="label dim">{dateLong(trip.startDate)} — {dateLong(trip.endDate)}</span>
            <span className="label dim">{plural(pax, 'traveller')} · {trip.pace} · {trip.budget.toLowerCase()}</span>
            <StatusPill status={trip.status} />
          </div>
        </div>
      </header>

      <div className="trip-actions bleed">
        <div className="row">
          {trip.interests.map((i) => <span key={i} className="chip" style={{ pointerEvents: 'none' }}>{i}</span>)}
        </div>
        <div className="row">
          {canEdit && (
            <button className="btn-ghost subtle" onClick={refreshWeather} disabled={busy === 'weather'}>
              <Icon name="refresh" size={13} /> {busy === 'weather' ? 'Checking sky…' : 'Refresh forecast'}
            </button>
          )}
          {canEdit && user && (
            <button className="btn-ghost subtle" onClick={() => setShareOpen(true)}>
              <Icon name="share" size={13} /> Share
            </button>
          )}
          {readOnly ? (
            <Link to={`/architect?destination=${encodeURIComponent(trip.destination.name)}&prompt=${encodeURIComponent(trip.prompt ?? '')}`} className="btn">
              Make it mine <span className="arrow">→</span>
            </Link>
          ) : (
            <button className="btn" onClick={openBook} disabled={!trip.stays.some((s) => s.bookable)}>
              {trip.status === 'BOOKED' ? 'Book again' : 'Book whole trip'} <span className="arrow">→</span>
            </button>
          )}
        </div>
      </div>

      {(trip.stops?.length ?? 0) > 1 && (
        <section className="route-strip bleed" aria-label="Route">
          {trip.stops!.map((s, i) => (
            <div key={s.name + i} className="route-strip-item">
              {i > 0 && trip.legs?.[i - 1] && (
                <span className="route-strip-leg micro">
                  ✈ {trip.legs[i - 1].km.toLocaleString('en-IN')} km · {Math.floor(trip.legs[i - 1].minutes / 60)}h {trip.legs[i - 1].minutes % 60}m
                </span>
              )}
              <span className="route-strip-city">
                <span className="route-n label">{i + 1}</span>
                <span className="stack-sm" style={{ gap: 2 }}>
                  <span className="label">{s.name}</span>
                  <span className="micro dim">{date(s.startDate)} · {plural(s.days, 'day')}</span>
                </span>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="trip-summary bleed">
        <div className="stack">
          <span className="micro dim">(01) The brief</span>
          <p className="voice">{trip.summary}</p>
          {trip.prompt && <p className="copy-sm dim">You asked: “{trip.prompt}”</p>}
          {wetDays > 0 && (
            <p className="label">
              <Icon name="rain" size={14} style={{ display: 'inline', verticalAlign: -2 }} /> {plural(wetDays, 'wet day')} ahead · {plural(swaps, 'stop')} already moved indoors
            </p>
          )}
        </div>
        <div className="card stack">
          <span className="label">Estimated spend</span>
          <hr className="rule" />
          {trip.estimate && (
            <Kv
              rows={[
                ['Stay', money(trip.estimate.stay)],
                ['Food', money(trip.estimate.food)],
                ['Activities', money(trip.estimate.activities)],
                ['Getting around', money(trip.estimate.transport)],
              ]}
            />
          )}
          <hr className="rule" />
          <div className="row-between">
            <span className="label">Total</span>
            <span className="heading-sm tabular">{money(trip.estimate?.total)}</span>
          </div>
          {trip.fx && trip.fx.quote !== trip.fx.base && (
            <p className="micro dim">
              ≈ {money((trip.estimate?.total ?? 0) * trip.fx.rate, trip.fx.quote)} · 1 {trip.fx.base} = {trip.fx.rate.toFixed(4)} {trip.fx.quote}
            </p>
          )}
          <p className="legal dimmer">
            Engine: {trip.engine === 'rules' ? 'Voyara rules' : trip.engine} {trip.sources && `· ${trip.sources.places} places · weather ${trip.sources.weather}`}
          </p>
        </div>
      </section>

      {trip.overview?.extract && (
        <section className="bleed trip-overview">
          <span className="micro dim">About {trip.destination.name}</span>
          <p className="copy dim">{trip.overview.extract}</p>
          {trip.overview.url && <a className="micro link" href={trip.overview.url} target="_blank" rel="noreferrer">Wikipedia ↗</a>}
        </section>
      )}

      <section className="bleed section" style={{ paddingTop: 41 }}>
        <SectionHead index="02" title="Day by day" />
        <div className="days-nav" role="tablist">
          {trip.days.map((d, i) => (
            <button key={d._id} role="tab" aria-selected={i === activeDay} className={`day-tab ${i === activeDay ? 'is-active' : ''} ${d.weather?.wet ? 'is-wet' : ''}`} onClick={() => { setActiveDay(i); setFocus(null); }}>
              <span className="micro dim">{weekday(d.date)} {date(d.date)}</span>
              <span className="label">Day {String(d.dayNumber).padStart(2, '0')}</span>
              <Icon name={d.weather?.wet ? 'rain' : 'sun'} size={14} />
            </button>
          ))}
        </div>

        <div className="day-layout">
          {day && <DayPlan key={day._id} day={day} canEdit={canEdit} busy={busy} onSwap={swap} onFocus={setFocus} focus={focus} />}
          <div className="day-map sticky">
            <HotelMap points={points} height="min(70vh, 620px)" route focus={focus} />
            <p className="micro dimmer" style={{ marginTop: 10 }}>Numbered in order · hollow pins are meals</p>
          </div>
        </div>
      </section>

      <section className="bleed section">
        <SectionHead index="03" title="Where to sleep" sub="Voyara stays book instantly. Live options come from OpenStreetMap for inspiration." />
        <div className="grid-3">
          {trip.stays.map((s, i) => (
            <div key={`${s.name}${i}`} className={`card stay-card ${s.bookable ? '' : 'is-live'}`}>
              {s.image && (
                <div className="media ratio-3-2 rounded">
                  <Img src={sized(s.image, 800)} alt={s.name} />
                </div>
              )}
              <div className="row-between">
                <span className="label">{s.name}</span>
                {s.rating ? <span className="micro">★ {Number(s.rating).toFixed(1)}</span> : null}
              </div>
              <div className="row-between">
                <span className="micro dim">{s.bookable ? 'Voyara · instant booking' : 'Live · OpenStreetMap'}</span>
                {s.pricePerNight ? <span className="label">{money(s.pricePerNight)} / night</span> : null}
              </div>
            </div>
          ))}
          {!trip.stays.length && <p className="copy dim">No stays found nearby yet — try <Link className="link" to={`/explore?location=${trip.destination.name}`}>searching stays</Link>.</p>}
        </div>
      </section>

      <section className="bleed section">
        <SectionHead index="04" title="Getting around" />
        <div className="grid-3">
          {trip.rentals.map((r, i) => (
            <div key={`${r.name}${i}`} className="card rental-row">
              <Icon name={r.vehicleType === 'CAR' || r.vehicleType === 'JEEP' ? 'car' : 'bike'} size={22} />
              <div className="stack-sm grow" style={{ gap: 4 }}>
                <span className="label">{r.name}</span>
                <span className="micro dim">{VEHICLE_LABEL[r.vehicleType ?? ''] ?? r.vehicleType} · {r.bookable ? 'bookable' : 'live listing'}</span>
              </div>
              {r.pricePerDay ? <span className="label nowrap">{money(r.pricePerDay)}/day</span> : null}
            </div>
          ))}
          {!trip.rentals.length && <p className="copy dim">No rental shops nearby — <Link className="link" to={`/rentals?destination=${trip.destination.name}`}>search rentals</Link>.</p>}
        </div>
      </section>

      {!!(trip.bookings?.length || trip.rentalBookings?.length) && canEdit && (
        <section className="bleed section">
          <SectionHead index="05" title="Booked" />
          <div className="stack">
            {trip.bookings?.map((b) => (
              <Link key={b.id} to={`/bookings/${b.id}`} className="card card-link row-between">
                <span className="label">{b.hotel?.name} · {b.room?.name}</span>
                <span className="row"><span className="micro dim">{b.reference}</span><StatusPill status={b.status} /></span>
              </Link>
            ))}
            {trip.rentalBookings?.map((r) => (
              <div key={r.id} className="card row-between">
                <span className="label">{r.shop?.name} · {VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType} × {r.quantity}</span>
                <span className="row"><span className="micro dim">{r.reference}</span><StatusPill status={r.status} /></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {canEdit && user && <Documents tripId={trip.id} initial={documents} />}

      {bookOpen && <BookTripModal trip={trip} onClose={() => setBookOpen(false)} onBooked={() => onReload?.()} />}
      {shareOpen && <ShareModal trip={trip} onClose={() => setShareOpen(false)} onUpdate={(t) => onUpdate?.({ ...trip, ...t })} />}
    </div>
  );
}

function DayPlan({ day, canEdit, busy, onSwap, onFocus, focus }: {
  day: ItineraryDay;
  canEdit: boolean;
  busy: string | null;
  onSwap: (dayId: string, itemId: string) => void;
  onFocus: (id: string) => void;
  focus: string | null;
}) {
  return (
    <div className="day-plan">
      <div className="day-head">
        <div className="stack-sm">
          <span className="micro dim">Day {String(day.dayNumber).padStart(2, '0')} · {weekday(day.date)} {dateLong(day.date)}</span>
          <h3 className="heading">{day.theme}</h3>
        </div>
        <WeatherChip w={day.weather} showSource />
      </div>
      {day.notes && <p className="copy-sm dim day-notes">Local tips · {day.notes}</p>}
      <ol className="timeline">
        {day.items.map((it, n) => (
          <li key={it._id} className={`stop ${it.swapped ? 'is-swapped' : ''} ${focus === it._id ? 'is-focus' : ''}`}>
            <button className="stop-main" onClick={() => onFocus(it._id)}>
              <span className="stop-n micro tabular">{String(n + 1).padStart(2, '0')}</span>
              <span className="stop-time">
                <span className="label tabular">{it.time}</span>
                <span className="micro dim">{SLOT_LABEL[it.slot]}</span>
              </span>
              <span className="stop-body">
                <span className="label stop-title">{it.title}</span>
                {it.description && <span className="copy-sm dim">{it.description}</span>}
                <span className="row" style={{ gap: 8, marginTop: 4 }}>
                  {it.category && <span className="micro dimmer">{it.category.toLowerCase()}</span>}
                  <span className="micro dimmer">· {it.indoor ? 'indoor' : 'outdoor'}</span>
                  {it.durationMins ? <span className="micro dimmer">· {Math.round(it.durationMins / 15) * 15} min</span> : null}
                  {it.estCost ? <span className="micro dimmer">· ~{money(it.estCost)}</span> : null}
                  {it.swapped && <span className="tag">· Rain plan</span>}
                </span>
              </span>
            </button>
            {it.alternative?.title && (
              <div className="stop-alt">
                <span className="micro dim">{it.swapped ? 'Original plan' : 'If it rains'}</span>
                <span className="copy-sm">{it.alternative.title}</span>
                {canEdit && (
                  <button className="btn-ghost subtle" onClick={() => onSwap(day._id, it._id)} disabled={busy === it._id}>
                    <Icon name="swap" size={12} /> {busy === it._id ? '…' : 'Swap'}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BookTripModal({ trip, onClose, onBooked }: { trip: Itinerary; onClose: () => void; onBooked: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const stays = trip.stays.map((s, i) => ({ ...s, i })).filter((s) => s.bookable);
  const rentals = trip.rentals.map((r, i) => ({ ...r, i })).filter((r) => r.bookable);
  const multi = (trip.stops?.length ?? 0) > 1;
  const [allStops, setAllStops] = useState(multi);
  const [stayIndex, setStayIndex] = useState(stays[0]?.i ?? 0);
  const [includeRental, setIncludeRental] = useState(rentals.length > 0);
  const [rentalIndex, setRentalIndex] = useState(rentals[0]?.i);
  const [method, setMethod] = useState<PayMethod>('PAY_AT_HOTEL');
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState(false);
  const nights = Math.max(1, trip.days.length - 1);
  const stay = trip.stays[stayIndex];
  const rental = rentalIndex != null ? trip.rentals[rentalIndex] : undefined;

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await tripService.book(trip.id, { stayIndex, includeRental: includeRental && !allStops, rentalIndex, couponCode: coupon || undefined, method, allStops: multi && allStops });
      toast(r.bookings && r.bookings.length > 1 ? `${r.bookings.length} stays booked${r.skipped?.length ? ` · no Voyara stay in ${r.skipped.join(', ')}` : ''}` : r.rentalBooking ? 'Stay + rental booked' : 'Stay booked');
      onBooked();
      onClose();
      nav(`/bookings/${r.booking.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Book the whole trip">
      <div className="stack-lg">
        {multi && (
          <label className="check">
            <input type="checkbox" checked={allStops} onChange={(e) => setAllStops(e.target.checked)} /> Book a stay in every city, for that city’s dates
          </label>
        )}
        {!(multi && allStops) && <div className="stack-sm">
          <span className="field-label">Stay · {dateLong(trip.startDate)} → {plural(nights, 'night')}</span>
          {stays.map((s) => (
            <label key={s.i} className={`option ${stayIndex === s.i ? 'is-on' : ''}`}>
              <input type="radio" name="stay" checked={stayIndex === s.i} onChange={() => setStayIndex(s.i)} />
              <span className="label grow">{s.name}{s.city ? <span className="dim"> · {s.city}</span> : null}</span>
              <span className="label">{money(s.pricePerNight)} <span className="dim">/ night</span></span>
            </label>
          ))}
        </div>}
        {rentals.length > 0 && !(multi && allStops) && (
          <div className="stack-sm">
            <label className="check">
              <input type="checkbox" checked={includeRental} onChange={(e) => setIncludeRental(e.target.checked)} /> Add a rental for the same dates
            </label>
            {includeRental &&
              rentals.map((r) => (
                <label key={r.i} className={`option ${rentalIndex === r.i ? 'is-on' : ''}`}>
                  <input type="radio" name="rental" checked={rentalIndex === r.i} onChange={() => setRentalIndex(r.i)} />
                  <span className="label grow">{r.name} · {VEHICLE_LABEL[r.vehicleType ?? ''] ?? r.vehicleType}</span>
                  <span className="label">{money(r.pricePerDay)} <span className="dim">/ day</span></span>
                </label>
              ))}
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            <span className="label">Pay with</span>
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
              <option value="PAY_AT_HOTEL">Pay at hotel</option>
              <option value="UPI">UPI (simulated)</option>
              <option value="CARD">Card (simulated)</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Coupon</span>
            <input className="input" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="VOYARA10" />
          </label>
        </div>
        <hr className="rule" />
        <Kv
          rows={[
            ['Room estimate', stay?.pricePerNight ? money(stay.pricePerNight * nights) : '—'],
            ...(includeRental && rental?.pricePerDay ? ([['Rental estimate', money(rental.pricePerDay * nights)]] as [string, string][]) : []),
            ['Taxes', 'Calculated at confirmation'],
          ]}
        />
        <button className="btn btn-lg" onClick={confirm} disabled={busy || !stays.length}>
          {busy ? 'Booking…' : 'Confirm in one tap'} <span className="arrow">→</span>
        </button>
        <p className="legal dimmer">Payments are simulated in this build — no real money moves.</p>
      </div>
    </Modal>
  );
}

function ShareModal({ trip, onClose, onUpdate }: { trip: Itinerary; onClose: () => void; onUpdate: (t: Partial<Itinerary>) => void }) {
  const toast = useToast();
  const [token, setToken] = useState(trip.shareToken);
  const [isPublic, setIsPublic] = useState(trip.isPublic);
  useEffect(() => {
    tripService.share(trip.id).then((r) => setToken(r.shareToken)).catch(() => undefined);
  }, [trip.id]);
  const url = token ? `${window.location.origin}/shared/${token}` : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast('Copy failed — select the link manually', 'error');
    }
  };
  const togglePublic = async (v: boolean) => {
    try {
      const r = await tripService.share(trip.id, v);
      setIsPublic(r.isPublic);
      onUpdate({ isPublic: r.isPublic });
      toast(r.isPublic ? 'Listed on Community' : 'Removed from Community');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title="Share this trip">
      <div className="stack-lg">
        <p className="copy dim">Anyone with the link can view this itinerary (not your bookings or documents).</p>
        <div className="input-action">
          <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
          <button className="label" onClick={copy}>Copy</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={isPublic} onChange={(e) => togglePublic(e.target.checked)} /> List on the Community page
        </label>
      </div>
    </Modal>
  );
}

function Documents({ tripId, initial }: { tripId: string; initial: TripDocument[] }) {
  const toast = useToast();
  const [docs, setDocs] = useState(initial);
  const [kind, setKind] = useState('TICKET');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setDocs(initial), [initial]);

  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const d = await tripService.addDocument(tripId, f, kind);
      setDocs((x) => [d, ...x]);
      toast('Document added');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async (docId: string) => {
    try {
      await tripService.removeDocument(tripId, docId);
      setDocs((x) => x.filter((d) => d.id !== docId));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <section className="bleed section">
      <SectionHead
        index="06"
        title="Trip wallet"
        sub="Tickets, visas, insurance — kept with the plan. Images or PDFs up to 8 MB."
        right={
          <div className="row">
            <select className="select" style={{ width: 140 }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Document type">
              {['TICKET', 'VISA', 'PASSPORT', 'INSURANCE', 'VOUCHER', 'OTHER'].map((k) => <option key={k}>{k}</option>)}
            </select>
            <button className="btn-ghost" onClick={() => input.current?.click()} disabled={busy}>
              <Icon name="upload" size={13} /> {busy ? 'Uploading…' : 'Add file'}
            </button>
            <input ref={input} type="file" hidden accept="image/*,application/pdf" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        }
      />
      {docs.length === 0 ? (
        <p className="copy dim">Nothing here yet.</p>
      ) : (
        <div className="grid-3">
          {docs.map((d) => (
            <div key={d.id} className="card row" style={{ flexWrap: 'nowrap' }}>
              <Icon name="doc" size={20} />
              <a href={d.url} target="_blank" rel="noreferrer" className="stack-sm grow" style={{ gap: 4, minWidth: 0 }}>
                <span className="label truncate">{d.name}</span>
                <span className="micro dim">{d.kind} · {fileSize(d.size)}</span>
              </a>
              <button className="btn-icon" onClick={() => remove(d.id)} aria-label="Remove document">
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
