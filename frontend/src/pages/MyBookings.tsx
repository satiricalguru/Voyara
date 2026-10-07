import { useState } from 'react';
import { Link } from 'react-router';
import { Empty, ErrorBox, Img, Lines, StatusPill } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { VEHICLE_LABEL } from '../data/voyara';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { bookingService } from '../services/booking';
import { tripService } from '../services/trips';
import { sized } from '../utils/destinations';
import { dateLong, money, plural, range } from '../utils/format';

type Tab = 'upcoming' | 'past' | 'cancelled' | 'rentals';

export default function MyBookings() {
  useDocumentTitle('My bookings');
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('upcoming');
  const stays = useAsync(() => (tab === 'rentals' ? Promise.resolve([]) : bookingService.mine(tab)), [tab]);
  const rentals = useAsync(() => (tab === 'rentals' ? tripService.myRentals() : Promise.resolve([])), [tab]);

  const cancelRental = async (id: string) => {
    try {
      await tripService.cancelRental(id);
      toast('Rental cancelled');
      void rentals.reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Account) · Bookings</span>
        <Lines lines={['Where you’re', 'staying.']} />
      </header>
      <div className="tabs" role="tablist" style={{ marginBottom: 31 }}>
        {(['upcoming', 'past', 'cancelled', 'rentals'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab !== 'rentals' && (
        <>
          {stays.error && <ErrorBox message={stays.error} onRetry={stays.reload} />}
          {stays.loading && <div className="stack">{[0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 160 }} />)}</div>}
          {!stays.loading && stays.data?.length === 0 && (
            <Empty title={tab === 'upcoming' ? 'Nothing booked yet.' : `No ${tab} stays.`} body="Plan a whole trip with the architect, or book a stay directly." action={{ to: '/architect', label: 'Open the architect' }} />
          )}
          <div className="stack">
            {!stays.loading && stays.data?.map((b) => (
              <Link key={b.id} to={`/bookings/${b.id}`} className="booking-row card card-link">
                <div className="media rounded booking-thumb"><Img src={sized(b.hotel?.images?.[0], 500)} alt={b.hotel?.name} /></div>
                <div className="stack-sm grow">
                  <span className="micro dim">{b.reference} · {b.hotel?.city}</span>
                  <span className="heading-sm">{b.hotel?.name}</span>
                  <span className="label dim">{range(b.checkIn, b.checkOut)} · {plural(b.nights, 'night')} · {b.room?.name}</span>
                </div>
                <div className="stack-sm booking-row-end">
                  <StatusPill status={b.status} />
                  <span className="label tabular">{money(b.pricing.total, b.pricing.currency)}</span>
                  {b.status === 'PENDING' && b.paymentStatus === 'UNPAID' && <span className="micro accent-text">Payment due</span>}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {tab === 'rentals' && (
        <>
          {rentals.loading && <div className="skeleton" style={{ height: 120 }} />}
          {!rentals.loading && rentals.data?.length === 0 && <Empty title="No rentals yet." body="Scooters, e-bikes and cars for the days you need them." action={{ to: '/rentals', label: 'Find a rental' }} />}
          <div className="stack">
            {rentals.data?.map((r) => (
              <div key={r.id} className="booking-row card">
                <div className="media rounded booking-thumb"><Img src={sized(r.shop?.image, 500)} alt={r.shop?.name} /></div>
                <div className="stack-sm grow">
                  <span className="micro dim">{r.reference} · {r.shop?.destination}</span>
                  <span className="heading-sm">{VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType} × {r.quantity} · {r.model}</span>
                  <span className="label dim">{r.shop?.name} · {dateLong(r.startDate)} → {dateLong(r.endDate)} · {plural(r.days, 'day')}</span>
                </div>
                <div className="stack-sm booking-row-end">
                  <StatusPill status={r.status} />
                  <span className="label tabular">{money(r.total)}</span>
                  {r.status === 'CONFIRMED' && <button className="link" onClick={() => cancelRental(r.id)}>Cancel</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
