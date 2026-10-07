import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { HotelMap } from '../components/HotelMap';
import { Icon } from '../components/Icon';
import { Empty, ErrorBox, Img, Lines, Modal, SectionHead, Stepper } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CURATED_DESTINATIONS, IMAGES, VEHICLE_LABEL } from '../data/voyara';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { guideService } from '../services/guide';
import { tripService } from '../services/trips';
import type { RentalShop } from '../types';
import { sized } from '../utils/destinations';
import { addDays, isoDay, money, nightsBetween, plural } from '../utils/format';

export default function Rentals() {
  useDocumentTitle('Rentals');
  const [params, setParams] = useSearchParams();
  const destination = params.get('destination') ?? 'Goa';
  const [type, setType] = useState('');
  const { data, error, loading, reload } = useAsync(() => guideService.rentals(destination), [destination]);
  const [booking, setBooking] = useState<{ shop: RentalShop; vehicle: RentalShop['vehicles'][number] } | null>(null);
  const [q, setQ] = useState('');

  const shops = (data?.bookable ?? []).filter((s) => !type || s.vehicles.some((v) => v.type === type));
  const types = useMemo(() => [...new Set((data?.bookable ?? []).flatMap((s) => s.vehicles.map((v) => v.type)))], [data]);
  const points = useMemo(
    () => [
      ...shops.filter((s) => s.location).map((s) => ({ id: s.id, lat: s.location!.coordinates[1], lng: s.location!.coordinates[0], label: s.name, title: s.name, sub: s.address })),
      ...(data?.live ?? []).slice(0, 30).map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, kind: 'dot' as const, title: r.name, sub: `Live · ${r.vehicleTypes.join(', ').toLowerCase()}` })),
    ],
    [shops, data],
  );

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) setParams({ destination: q.trim() });
  };

  return (
    <div className="page bleed">
      <header className="page-head rentals-head">
        <div className="stack">
          <span className="micro dim">(Rentals) · {destination}</span>
          <Lines lines={['Two wheels,', 'four, or a 4×4.']} />
          <form className="input-action" onSubmit={search} style={{ maxWidth: 520 }}>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search another city (now: ${destination})`} aria-label="Destination" />
            <button className="label">Go →</button>
          </form>
          <div className="chips">
            {CURATED_DESTINATIONS.map((d) => (
              <button key={d.slug} className={`chip ${destination === d.name ? 'is-active' : ''}`} onClick={() => setParams({ destination: d.name })}>{d.name}</button>
            ))}
          </div>
        </div>
        <div className="media rounded rentals-media hide-sm"><Img src={IMAGES.moto} alt="" /></div>
      </header>

      {error && <ErrorBox message={error} onRetry={reload} />}

      <div className="day-layout">
        <div className="stack-lg">
          <SectionHead
            index="01"
            title="Book instantly"
            right={
              types.length > 1 && (
                <div className="chips">
                  <button className={`chip ${!type ? 'is-active' : ''}`} onClick={() => setType('')}>All</button>
                  {types.map((t) => <button key={t} className={`chip ${type === t ? 'is-active' : ''}`} onClick={() => setType(t)}>{VEHICLE_LABEL[t] ?? t}</button>)}
                </div>
              )
            }
          />
          {loading && !data && <div className="skeleton" style={{ height: 260 }} />}
          {!loading && !shops.length && <Empty title={`No Voyara partners in ${destination} yet.`} body="Live rental shops from OpenStreetMap are listed below — contact them directly." />}
          {shops.map((s) => (
            <article key={s.id} className="card shop">
              <div className="shop-head">
                <div className="media rounded shop-media"><Img src={sized(s.image, 400)} alt={s.name} /></div>
                <div className="stack-sm grow">
                  <span className="heading-sm">{s.name}</span>
                  <span className="micro dim">{s.address} {s.distanceKm != null && `· ${s.distanceKm} km from centre`} · ★ {s.rating?.toFixed(1)}</span>
                </div>
              </div>
              <ul className="vehicles">
                {s.vehicles.filter((v) => !type || v.type === type).map((v) => (
                  <li key={v.type}>
                    <Icon name={v.type === 'CAR' || v.type === 'JEEP' ? 'car' : 'bike'} size={18} />
                    <span className="stack-sm grow" style={{ gap: 3 }}>
                      <span className="label">{VEHICLE_LABEL[v.type] ?? v.type}</span>
                      <span className="micro dim">{v.model} · {v.available} in fleet</span>
                    </span>
                    <span className="label tabular">{money(v.pricePerDay)}<span className="dim"> / day</span></span>
                    <button className="btn-ghost" onClick={() => setBooking({ shop: s, vehicle: v })}>Book</button>
                  </li>
                ))}
              </ul>
            </article>
          ))}

          {!!data?.live.length && (
            <>
              <SectionHead index="02" title="Also nearby" sub="Live from OpenStreetMap — not bookable through Voyara." />
              <ul className="live-list">
                {data.live.slice(0, 20).map((r) => (
                  <li key={r.id} className="row-between">
                    <span className="label truncate">{r.name}</span>
                    <span className="micro dim nowrap">
                      {r.vehicleTypes.map((t) => VEHICLE_LABEL[t] ?? t).join(' · ')} · {r.distanceKm} km
                      {r.website && <> · <a className="link" href={r.website} target="_blank" rel="noreferrer">site ↗</a></>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="sticky">
          <HotelMap points={points} height="min(70vh, 600px)" center={data ? [data.destination.lat, data.destination.lng] : undefined} />
        </div>
      </div>

      {booking && <RentalModal shop={booking.shop} vehicle={booking.vehicle} onClose={() => setBooking(null)} />}
    </div>
  );
}

function RentalModal({ shop, vehicle, onClose }: { shop: RentalShop; vehicle: RentalShop['vehicles'][number]; onClose: () => void }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [start, setStart] = useState(addDays(isoDay(), 7));
  const [end, setEnd] = useState(addDays(isoDay(), 10));
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const days = Math.max(1, nightsBetween(start, end));

  const book = async () => {
    if (!user) return nav('/login', { state: { from: `/rentals?destination=${shop.destination}` } });
    setBusy(true);
    try {
      const r = await tripService.bookRental({ shopId: shop.id, vehicleType: vehicle.type, quantity: qty, startDate: start, endDate: end });
      toast(`Booked · ${r.reference}`);
      onClose();
      nav('/bookings');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`${VEHICLE_LABEL[vehicle.type] ?? vehicle.type} · ${shop.name}`}>
      <div className="stack-lg">
        <p className="copy dim">{vehicle.model}. Helmets included for two-wheelers. Bring a valid licence.</p>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <label className="field"><span className="label">Pick-up</span><input className="input" type="date" min={isoDay()} value={start} onChange={(e) => { setStart(e.target.value); if (end <= e.target.value) setEnd(addDays(e.target.value, 1)); }} /></label>
          <label className="field"><span className="label">Return</span><input className="input" type="date" min={addDays(start, 1)} value={end} onChange={(e) => setEnd(e.target.value)} /></label>
        </div>
        <Stepper label="Vehicles" value={qty} onChange={setQty} min={1} max={Math.min(6, vehicle.available)} />
        <hr className="rule" />
        <div className="row-between">
          <span className="label">{plural(days, 'day')} × {money(vehicle.pricePerDay)} × {qty}</span>
          <span className="heading-sm tabular">{money(days * vehicle.pricePerDay * qty)}</span>
        </div>
        <button className="btn btn-lg" onClick={book} disabled={busy}>{busy ? 'Booking…' : user ? 'Confirm rental' : 'Sign in to book'} <span className="arrow">→</span></button>
        <p className="legal dimmer">Pay at pick-up. Free cancellation until the day before.</p>
      </div>
    </Modal>
  );
}
