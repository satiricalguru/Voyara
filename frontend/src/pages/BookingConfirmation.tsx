import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Icon } from '../components/Icon';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { QR } from '../components/QR';
import { ErrorBox, Kv, Lines, Modal, PageLoader, StatusPill } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { blobUrl, errorMessage } from '../services/api';
import { bookingService } from '../services/booking';
import { dateLong, money, plural, statusLabel, weekday } from '../utils/format';

export default function BookingConfirmation() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(() => bookingService.get(id), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useDocumentTitle(data ? `Booking ${data.booking.reference}` : 'Booking');

  if (loading && !data) return <PageLoader />;
  if (error || !data) return <div className="page wrap"><ErrorBox message={error ?? 'Booking not found'} onRetry={reload} /></div>;
  const b = data.booking;

  const invoice = async (download: boolean) => {
    setBusy('pdf');
    try {
      const url = await blobUrl(`${bookingService.invoicePath(b.id)}${download ? '?download=1' : ''}`);
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `voyara-${b.reference}.pdf`;
        a.click();
      } else window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    try {
      const nb = await bookingService.cancel(b.id, reason || undefined);
      setData({ ...data, booking: { ...b, status: nb.status, paymentStatus: nb.paymentStatus } });
      toast(nb.paymentStatus === 'REFUNDED' ? 'Cancelled · refund on its way' : 'Booking cancelled');
      setCancelOpen(false);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const headline =
    b.status === 'CANCELLED' ? ['Cancelled.'] : b.status === 'CHECKED_OUT' ? ['Hope it was', 'a good one.'] : b.status === 'CHECKED_IN' ? ['You’re in.', 'Enjoy.'] : b.status === 'PENDING' ? ['Almost', 'there.'] : ['You’re', 'going.'];

  return (
    <div className="page bleed">
      <header className="page-head">
        <div className="crumbs micro"><Link to="/bookings">My bookings</Link><span>/</span><span>{b.reference}</span></div>
        <div className="row-end">
          <Lines lines={headline} className="mega confirm-title" />
          <div className="stack-sm" style={{ alignItems: 'flex-end' }}>
            <StatusPill status={b.status} />
            <span className="micro dim">Payment · {statusLabel(b.paymentStatus)}</span>
          </div>
        </div>
      </header>

      <div className="confirm-grid">
        <div className="card-solid ticket inverse">
          <div className="ticket-top">
            <div className="stack-sm">
              <span className="micro">Reference</span>
              <span className="display tabular">{b.reference}</span>
            </div>
            <QR value={`${window.location.origin}/bookings/${b.reference}`} size={150} />
          </div>
          <hr className="rule rule-drift" />
          <div className="ticket-cols">
            <div><span className="micro dim">Check-in</span><span className="heading-sm">{weekday(b.checkIn)} {dateLong(b.checkIn)}</span><span className="micro dim">from {b.hotel.checkInTime ?? '14:00'}</span></div>
            <div><span className="micro dim">Check-out</span><span className="heading-sm">{weekday(b.checkOut)} {dateLong(b.checkOut)}</span><span className="micro dim">until {b.hotel.checkOutTime ?? '11:00'}</span></div>
            <div><span className="micro dim">Stay</span><span className="heading-sm">{plural(b.nights, 'night')}</span><span className="micro dim">{plural(b.roomsCount, 'room')}</span></div>
          </div>
          <hr className="rule rule-drift" />
          <div className="stack-sm">
            <Link to={`/hotels/${b.hotel.slug}`} className="heading">{b.hotel.name}</Link>
            <span className="copy-sm">{[b.hotel.address, b.hotel.city, b.hotel.country].filter(Boolean).join(', ')}</span>
          </div>
          <p className="micro">Show this code at the front desk — staff scan it to check you in.</p>
        </div>

        <div className="stack-lg">
          <div className="card stack">
            <span className="label">Details</span>
            <hr className="rule" />
            <Kv
              rows={[
                ['Room', b.room.name],
                ['Guests', `${plural(b.guests.adults, 'adult')}${b.guests.children ? ` · ${plural(b.guests.children, 'child', 'children')}` : ''}`],
                ['Lead guest', b.guestName],
                ['Email', b.guestEmail],
                ...(b.specialRequests ? ([['Requests', b.specialRequests]] as [string, string][]) : []),
                ...(b.hotel.contact?.phone ? ([['Front desk', b.hotel.contact.phone]] as [string, string][]) : []),
              ]}
            />
          </div>
          <div className="card stack">
            <span className="label">Price</span>
            <hr className="rule" />
            <PriceBreakdown pricing={b.pricing} nights={b.nights} roomName={b.room.name} roomsCount={b.roomsCount} addons={b.addons} couponCode={b.couponCode} />
            {data.payments.map((p) => (
              <div key={p.id} className="row-between">
                <span className="micro dim">{p.method.replace(/_/g, ' ')} {p.last4 ? `•••• ${p.last4}` : ''} {p.transactionId ?? ''}</span>
                <span className="row"><span className="micro">{money(p.amount)}</span><StatusPill status={p.status} /></span>
              </div>
            ))}
          </div>
          <div className="row">
            {b.paymentStatus === 'UNPAID' && b.status === 'PENDING' && <Link to={`/pay/${b.id}`} className="btn">Complete payment →</Link>}
            <button className="btn-ghost" onClick={() => invoice(true)} disabled={busy === 'pdf'}><Icon name="download" size={13} /> Invoice PDF</button>
            <button className="btn-ghost subtle" onClick={() => invoice(false)} disabled={busy === 'pdf'}><Icon name="eye" size={13} /> View</button>
            {b.itinerary && <Link to={`/trip/${b.itinerary}`} className="btn-ghost subtle">Open trip plan</Link>}
            {b.status === 'CHECKED_OUT' && <Link to={`/hotels/${b.hotel.slug}#reviews`} className="btn-ghost subtle">Write a review</Link>}
            {['PENDING', 'CONFIRMED'].includes(b.status) && <button className="link" onClick={() => setCancelOpen(true)}>Cancel booking</button>}
          </div>
        </div>
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${b.reference}`}>
        <div className="stack">
          <p className="copy dim">{b.hotel.policies?.cancellation ?? 'Free cancellation up to 48 hours before check-in.'}</p>
          {b.paymentStatus === 'PAID' && <p className="label">{money(b.pricing.total)} will be refunded to your original method.</p>}
          <label className="field"><span className="label">Reason (optional)</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <div className="row">
            <button className="btn" onClick={cancel} disabled={busy === 'cancel'}>{busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}</button>
            <button className="btn-ghost subtle" onClick={() => setCancelOpen(false)}>Keep it</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
