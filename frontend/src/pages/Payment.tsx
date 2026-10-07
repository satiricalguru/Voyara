import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Icon } from '../components/Icon';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { ErrorBox, Img, Kv, PageLoader } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { bookingService, type PayMethod } from '../services/booking';
import { sized } from '../utils/destinations';
import { dateLong, money, plural } from '../utils/format';

const METHODS: { id: PayMethod; label: string; note: string; icon: string }[] = [
  { id: 'UPI', label: 'UPI', note: 'Approve on your UPI app (simulated)', icon: 'qr' },
  { id: 'CARD', label: 'Card', note: 'Voyara test card •••• 4242 (simulated)', icon: 'card' },
  { id: 'NETBANKING', label: 'Net banking', note: 'Redirect to your bank (simulated)', icon: 'shield' },
  { id: 'PAY_AT_HOTEL', label: 'Pay at hotel', note: 'Confirm now, settle at check-out', icon: 'bed' },
];

export default function Payment() {
  useDocumentTitle('Payment');
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => bookingService.get(id), [id]);
  const [method, setMethod] = useState<PayMethod>('UPI');
  const [decline, setDecline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <div className="page wrap"><ErrorBox message={error ?? 'Booking not found'} onRetry={reload} /></div>;
  const b = data.booking;

  if (b.paymentStatus === 'PAID' || b.paymentStatus === 'PAY_AT_HOTEL' || b.status === 'CANCELLED') {
    return (
      <div className="page wrap-narrow stack-lg">
        <span className="micro dim">{b.reference}</span>
        <h1 className="display">{b.status === 'CANCELLED' ? 'This booking was cancelled.' : 'Already confirmed.'}</h1>
        <Link className="btn" to={`/bookings/${b.id}`}>View booking →</Link>
      </div>
    );
  }

  const pay = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await new Promise((r) => setTimeout(r, 900)); // the gateway "thinks"
      await bookingService.pay(b.id, method, { last4: method === 'CARD' ? '4242' : undefined, simulateFailure: decline });
      toast(method === 'PAY_AT_HOTEL' ? 'Confirmed — pay at the front desk' : 'Payment received');
      nav(`/bookings/${b.id}`, { replace: true });
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Checkout) · Step 02 of 02 · {b.reference}</span>
        <h1 className="display">Confirm & pay.</h1>
      </header>
      <div className="split">
        <div className="stack-lg">
          <div className="stack-sm">
            <span className="field-label">Payment method</span>
            <div className="methods">
              {METHODS.map((m) => (
                <label key={m.id} className={`option method ${method === m.id ? 'is-on' : ''}`}>
                  <input type="radio" name="method" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <Icon name={m.icon} size={20} />
                  <span className="stack-sm grow" style={{ gap: 4 }}>
                    <span className="label">{m.label}</span>
                    <span className="copy-sm dim">{m.note}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {method !== 'PAY_AT_HOTEL' && (
            <div className="card stack-sm">
              <span className="label"><Icon name="shield" size={13} style={{ display: 'inline', verticalAlign: -2 }} /> Simulated gateway</span>
              <p className="copy-sm dim">This build never collects card numbers or UPI IDs. Approving below marks the booking paid and issues an invoice.</p>
              <label className="check" style={{ marginTop: 8 }}>
                <input type="checkbox" checked={decline} onChange={(e) => setDecline(e.target.checked)} /> Simulate a declined payment
              </label>
            </div>
          )}
          {failure && (
            <div className="empty" role="alert" style={{ padding: 24 }}>
              <span className="tag">Payment failed</span>
              <p className="copy">{failure}</p>
            </div>
          )}
          <div className="row">
            <button className="btn btn-lg" onClick={pay} disabled={busy}>
              {busy ? <><span className="spinner" /> Processing</> : method === 'PAY_AT_HOTEL' ? 'Confirm booking' : `Pay ${money(b.pricing.total, b.pricing.currency)}`}
            </button>
            <Link to={`/hotels/${b.hotel.slug}`} className="link">Change stay</Link>
          </div>
        </div>
        <aside className="card stack sticky">
          <div className="media ratio-16-9 rounded"><Img src={sized(b.hotel.images?.[0], 800)} alt={b.hotel.name} /></div>
          <div className="stack-sm">
            <span className="micro dim">{b.hotel.city}, {b.hotel.country}</span>
            <span className="heading-sm">{b.hotel.name}</span>
          </div>
          <Kv
            rows={[
              ['Room', `${b.room.name}${b.roomsCount > 1 ? ` × ${b.roomsCount}` : ''}`],
              ['Dates', `${dateLong(b.checkIn)} → ${dateLong(b.checkOut)}`],
              ['Guests', `${plural(b.guests.adults, 'adult')}${b.guests.children ? `, ${plural(b.guests.children, 'child', 'children')}` : ''}`],
              ['Lead guest', b.guestName],
            ]}
          />
          <hr className="rule" />
          <PriceBreakdown pricing={b.pricing} nights={b.nights} roomName={b.room.name} roomsCount={b.roomsCount} addons={b.addons} couponCode={b.couponCode} />
        </aside>
      </div>
    </div>
  );
}
