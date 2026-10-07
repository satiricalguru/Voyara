import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { ErrorBox, Lines, StatusPill } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { staffService, type StaffView } from '../services/staff';
import type { Booking } from '../types';
import { date, dateLong, isoDay, money, plural, statusLabel } from '../utils/format';

export default function Staff() {
  useDocumentTitle('Front desk');
  const toast = useToast();
  const [view, setView] = useState<StaffView>('arrivals');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [day, setDay] = useState(isoDay());
  const [busy, setBusy] = useState<string | null>(null);
  const { data, error, loading, reload } = useAsync(() => staffService.bookings(view, query, day), [view, query, day]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const act = async (b: Booking, kind: 'in' | 'out') => {
    setBusy(b.id);
    try {
      if (kind === 'in') await staffService.checkIn(b.id);
      else await staffService.checkOut(b.id);
      toast(`${b.guestName} checked ${kind}`);
      await reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
    }
  };

  const tabs: { id: StaffView; label: string; count?: number }[] = [
    { id: 'arrivals', label: 'Arrivals', count: data?.counts.arrivals },
    { id: 'departures', label: 'Departures', count: data?.counts.departures },
    { id: 'in-house', label: 'In house', count: data?.counts.inHouse },
    { id: 'all', label: 'All active' },
  ];

  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Front desk) · {dateLong(day)}</span>
        <div className="row-end">
          <Lines lines={['Today at', 'the desk.']} />
          <div className="desk-stats">
            {[['Arriving', data?.counts.arrivals], ['Departing', data?.counts.departures], ['In house', data?.counts.inHouse]].map(([l, n]) => (
              <div key={l as string}><span className="display tabular">{n ?? '—'}</span><span className="micro dim">{l}</span></div>
            ))}
          </div>
        </div>
      </header>
      <div className="row-between" style={{ marginBottom: 24 }}>
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={view === t.id} className={`tab ${view === t.id ? 'is-active' : ''}`} onClick={() => setView(t.id)}>
              {t.label}{t.count != null && <span className="count">{t.count}</span>}
            </button>
          ))}
        </div>
        <div className="row">
          <input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ width: 160 }} aria-label="Desk date" />
          <div className="input-action" style={{ width: 260 }}>
            <input className="input" placeholder="Reference, guest or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bookings" />
            <span style={{ position: 'absolute', right: 0, bottom: 10 }}><Icon name="search" size={14} /></span>
          </div>
        </div>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Ref</th><th>Guest</th><th>Stay</th><th>Dates</th><th>Status</th><th>Payment</th><th className="num">Total</th><th /></tr>
          </thead>
          <tbody>
            {loading && !data && <tr><td colSpan={8}><div className="skeleton" style={{ height: 40 }} /></td></tr>}
            {data?.bookings.length === 0 && <tr><td colSpan={8} className="dim">Nobody on this list. Quiet day.</td></tr>}
            {data?.bookings.map((b) => {
              const today = isoDay();
              const canIn = b.status === 'CONFIRMED' && b.checkIn.slice(0, 10) <= today;
              const canOut = b.status === 'CHECKED_IN';
              return (
                <tr key={b.id}>
                  <td><Link to={`/bookings/${b.id}`} className="label">{b.reference}</Link></td>
                  <td><div className="stack-sm" style={{ gap: 2 }}><span>{b.guestName}</span><span className="micro dim">{b.guestEmail}</span></div></td>
                  <td><div className="stack-sm" style={{ gap: 2 }}><span>{b.hotel?.name}</span><span className="micro dim">{b.room?.name} × {b.roomsCount} · {plural(b.guests.adults + b.guests.children, 'guest')}</span></div></td>
                  <td className="nowrap">{date(b.checkIn)} → {date(b.checkOut)}</td>
                  <td><StatusPill status={b.status} /></td>
                  <td><span className={`micro ${b.paymentStatus === 'PAY_AT_HOTEL' ? 'accent-text' : 'dim'}`}>{statusLabel(b.paymentStatus)}</span></td>
                  <td className="num">{money(b.pricing.total)}</td>
                  <td className="num">
                    {canIn && <button className="btn-ghost" disabled={busy === b.id} onClick={() => act(b, 'in')}>Check in</button>}
                    {canOut && <button className="btn" disabled={busy === b.id} onClick={() => act(b, 'out')}>Check out{b.paymentStatus === 'PAY_AT_HOTEL' ? ' & collect' : ''}</button>}
                    {!canIn && !canOut && <span className="micro dimmer">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="micro dimmer" style={{ marginTop: 14 }}>Tip: scan a guest’s QR to open their booking, or search by reference.</p>
    </div>
  );
}
