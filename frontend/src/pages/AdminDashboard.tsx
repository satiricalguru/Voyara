import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { ErrorBox, Img, Lines, Modal, Stars, StatusPill } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { adminService, type AdminStats } from '../services/admin';
import { errorMessage } from '../services/api';
import type { Addon, Coupon } from '../types';
import { sized } from '../utils/destinations';
import { compact, date, dateLong, money, relTime, statusLabel } from '../utils/format';

const TABS = ['overview', 'bookings', 'hotels', 'users', 'payments', 'reviews', 'coupons', 'add-ons'] as const;
type Tab = (typeof TABS)[number];

export default function AdminDashboard() {
  useDocumentTitle('Admin');
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'overview';
  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Admin) · Voyara console</span>
        <div className="row-end">
          <Lines lines={['The whole', 'operation.']} />
          <Link to="/admin/hotels/new" className="btn">New hotel <span className="arrow">→</span></Link>
        </div>
      </header>
      <div className="tabs" role="tablist" style={{ marginBottom: 31 }}>
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'is-active' : ''}`} onClick={() => setParams({ tab: t })}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'bookings' && <Bookings />}
      {tab === 'hotels' && <Hotels />}
      {tab === 'users' && <Users />}
      {tab === 'payments' && <Payments />}
      {tab === 'reviews' && <Reviews />}
      {tab === 'coupons' && <Coupons />}
      {tab === 'add-ons' && <Addons />}
    </div>
  );
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="row" style={{ marginTop: 18 }}>
      <button className="btn-ghost subtle" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
      <span className="micro dim">{page} / {pages}</span>
      <button className="btn-ghost subtle" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
    </div>
  );
}

/* ── Overview ─────────────────────────────────────────────── */

function Overview() {
  const { data, error, loading, reload } = useAsync(() => adminService.stats(), []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading || !data) return <div className="grid-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ height: 120 }} />)}</div>;
  const t = data.totals;
  const tiles: [string, string, string?][] = [
    ['Revenue', `₹${compact(t.revenue)}`, `${money(t.revenue)} total · ${money(t.revenueThisMonth)} this month`],
    ['Bookings', String(t.bookings), `${t.checkedIn} in house now`],
    ['Occupancy tonight', `${t.occupancy}%`, `${t.rooms} rooms across ${t.hotels} hotels`],
    ['Travellers', String(t.users), `${t.subscribers} newsletter subscribers`],
    ['Itineraries', String(t.itineraries), 'architected trips'],
    ['Rentals', String(t.rentals), 'vehicle bookings'],
  ];
  const statuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'];
  const sTotal = statuses.reduce((s, k) => s + (data.byStatus[k] ?? 0), 0);
  return (
    <div className="stack-lg">
      <div className="stat-grid">
        {tiles.map(([l, v, s]) => (
          <div key={l} className="stat">
            <span className="micro dim">{l}</span>
            <span className="stat-value tabular">{v}</span>
            {s && <span className="micro dim">{s}</span>}
          </div>
        ))}
      </div>
      <div className="admin-two">
        <div className="card stack">
          <div className="row-between">
            <span className="label">Revenue by booking month</span>
            <span className="micro dim">Last 6 months · excl. cancelled</span>
          </div>
          <hr className="rule" />
          <RevenueChart monthly={data.monthly} />
        </div>
        <div className="card stack">
          <span className="label">Bookings by status</span>
          <hr className="rule" />
          {statuses.map((s) => {
            const n = data.byStatus[s] ?? 0;
            return (
              <div key={s} className="status-row">
                <span className="micro">{statusLabel(s)}</span>
                <span className="bar"><span style={{ width: `${sTotal ? (n / sTotal) * 100 : 0}%` }} /></span>
                <span className="label tabular">{n}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="admin-two">
        <div className="card stack">
          <span className="label">Top hotels by revenue</span>
          <hr className="rule" />
          {data.topHotels.map((h, i) => (
            <div key={h._id} className="row-between">
              <span className="row"><span className="micro dim tabular">{String(i + 1).padStart(2, '0')}</span><span className="label">{h.name}</span><span className="micro dim">{h.city}</span></span>
              <span className="row"><span className="micro dim">{h.bookings} bookings</span><span className="label tabular">{money(h.revenue)}</span></span>
            </div>
          ))}
        </div>
        <div className="card stack">
          <span className="label">Latest bookings</span>
          <hr className="rule" />
          {data.recent.map((b) => (
            <Link key={b.id} to={`/bookings/${b.id}`} className="row-between">
              <span className="stack-sm" style={{ gap: 2 }}>
                <span className="label">{b.reference} · {b.hotel?.name}</span>
                <span className="micro dim">{typeof b.user === 'object' ? b.user.name : b.guestName} · {relTime(b.createdAt)}</span>
              </span>
              <StatusPill status={b.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevenueChart({ monthly }: { monthly: AdminStats['monthly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!monthly.length) return <p className="copy dim">No bookings yet.</p>;
  const W = 600;
  const H = 220;
  const pad = { l: 44, r: 8, t: 12, b: 26 };
  const max = Math.max(...monthly.map((m) => m.revenue)) * 1.1 || 1;
  const bw = (W - pad.l - pad.r) / monthly.length;
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const label = (k: string) => new Date(`${k}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase();
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly revenue bar chart">
        {ticks.map((v) => {
          const y = pad.t + (H - pad.t - pad.b) * (1 - v / max);
          return (
            <g key={v}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--line)" strokeDasharray="2 4" />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" className="chart-axis">{compact(v)}</text>
            </g>
          );
        })}
        {monthly.map((m, i) => {
          const h = ((H - pad.t - pad.b) * m.revenue) / max;
          const x = pad.l + i * bw + 2;
          const w = Math.max(4, bw - 4);
          const y = H - pad.b - h;
          const r = Math.min(4, w / 2, h);
          return (
            <g key={m._id} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <path
                d={`M${x},${H - pad.b} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${H - pad.b} Z`}
                fill="var(--ink)"
                opacity={hover == null || hover === i ? 1 : 0.45}
              />
              <text x={x + w / 2} y={H - 8} textAnchor="middle" className="chart-axis">{label(m._id)}</text>
            </g>
          );
        })}
      </svg>
      {hover != null && (
        <div className="chart-tip" style={{ left: `${((pad.l + (hover + 0.5) * bw) / W) * 100}%` }}>
          <span className="micro dim">{label(monthly[hover]._id)}</span>
          <span className="label tabular">{money(monthly[hover].revenue)}</span>
          <span className="micro dim">{monthly[hover].bookings} bookings</span>
        </div>
      )}
    </div>
  );
}

/* ── Bookings ─────────────────────────────────────────────── */

function Bookings() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAsync(() => adminService.bookings({ status: status || undefined, q: q || undefined, page, limit: 20 }), [status, q, page]);
  return (
    <div className="stack">
      <div className="row">
        <select className="select" style={{ width: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="">All statuses</option>
          {['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <input className="input" style={{ width: 260 }} placeholder="Reference, guest, email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search" />
        <span className="micro dim">{data?.total ?? '—'} total</span>
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Ref</th><th>Guest</th><th>Hotel</th><th>Dates</th><th>Status</th><th>Payment</th><th className="num">Total</th><th>Created</th></tr></thead>
          <tbody>
            {loading && !data && <tr><td colSpan={8}><div className="skeleton" style={{ height: 40 }} /></td></tr>}
            {data?.items.map((b) => (
              <tr key={b.id}>
                <td><Link className="label" to={`/bookings/${b.id}`}>{b.reference}</Link></td>
                <td>{b.guestName}<div className="micro dim">{b.guestEmail}</div></td>
                <td>{b.hotel?.name}<div className="micro dim">{b.room?.name}</div></td>
                <td className="nowrap">{date(b.checkIn)} → {date(b.checkOut)}</td>
                <td><StatusPill status={b.status} /></td>
                <td className="micro">{statusLabel(b.paymentStatus)}</td>
                <td className="num">{money(b.pricing.total)}</td>
                <td className="micro dim nowrap">{relTime(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={data?.pages ?? 1} onPage={setPage} />
    </div>
  );
}

/* ── Hotels ───────────────────────────────────────────────── */

function Hotels() {
  const toast = useToast();
  const { data, error, loading, reload } = useAsync(() => adminService.hotels(), []);
  const archive = async (id: string, name: string) => {
    if (!window.confirm(`Archive ${name}? It will disappear from search.`)) return;
    try {
      await adminService.archiveHotel(id);
      toast('Hotel archived');
      void reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Hotel</th><th>City</th><th>Category</th><th className="num">From</th><th>Rating</th><th>Featured</th><th /></tr></thead>
        <tbody>
          {loading && !data && <tr><td colSpan={7}><div className="skeleton" style={{ height: 40 }} /></td></tr>}
          {data?.items.map((h) => (
            <tr key={h.id}>
              <td>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <div className="media rounded" style={{ width: 56, height: 40, flex: 'none' }}><Img src={sized(h.images[0], 200)} alt="" /></div>
                  <Link to={`/hotels/${h.slug}`} className="label">{h.name}</Link>
                </div>
              </td>
              <td>{h.city}, {h.country}</td>
              <td className="micro">{h.category} · {h.stars}★</td>
              <td className="num">{money(h.priceFrom)}</td>
              <td><span className="row"><Stars value={h.rating} size={9} /><span className="micro dim">{h.reviewCount}</span></span></td>
              <td className="micro">{h.featured ? 'Yes' : '—'}</td>
              <td className="num nowrap">
                <Link to={`/admin/hotels/${h.id}`} className="btn-ghost subtle"><Icon name="edit" size={12} /> Edit</Link>{' '}
                <button className="btn-icon" onClick={() => archive(h.id, h.name)} aria-label={`Archive ${h.name}`}><Icon name="trash" size={13} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Users ────────────────────────────────────────────────── */

function Users() {
  const toast = useToast();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, reload, setData } = useAsync(() => adminService.users({ role: role || undefined, q: q || undefined, page, limit: 20 }), [role, q, page]);
  const patch = async (id: string, body: { role?: string; isActive?: boolean }) => {
    try {
      const u = await adminService.updateUser(id, body);
      setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === id ? u : x)) } : d));
      toast('User updated');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  return (
    <div className="stack">
      <div className="row">
        <select className="select" style={{ width: 160 }} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
          <option value="">All roles</option>
          {['CUSTOMER', 'STAFF', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}
        </select>
        <input className="input" style={{ width: 260 }} placeholder="Name or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search users" />
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Last sign-in</th></tr></thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id}>
                <td>{u.name}<div className="micro dim">{u.homeCity}</div></td>
                <td>{u.email}</td>
                <td>
                  <select className="select" style={{ width: 130 }} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })} aria-label={`Role for ${u.name}`}>
                    {['CUSTOMER', 'STAFF', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td>
                  <button className={`chip ${u.isActive !== false ? 'is-active' : ''}`} onClick={() => patch(u.id, { isActive: u.isActive === false })}>
                    {u.isActive !== false ? 'Active' : 'Disabled'}
                  </button>
                </td>
                <td className="micro dim">{dateLong(u.createdAt)}</td>
                <td className="micro dim">{u.lastLoginAt ? relTime(u.lastLoginAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={data?.pages ?? 1} onPage={setPage} />
    </div>
  );
}

/* ── Payments ─────────────────────────────────────────────── */

function Payments() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, reload } = useAsync(() => adminService.payments({ status: status || undefined, page, limit: 20 }), [status, page]);
  return (
    <div className="stack">
      <select className="select" style={{ width: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Payment status">
        <option value="">All payments</option>
        {['SUCCEEDED', 'PENDING', 'FAILED', 'REFUNDED'].map((s) => <option key={s}>{s}</option>)}
      </select>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Transaction</th><th>Booking</th><th>Payer</th><th>Method</th><th>Status</th><th className="num">Amount</th><th>When</th></tr></thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id}>
                <td className="micro">{p.transactionId ?? '—'}</td>
                <td>{typeof p.booking === 'object' && p.booking ? <Link className="label" to={`/bookings/${p.booking.id}`}>{p.booking.reference}</Link> : '—'}</td>
                <td>{p.user?.name}<div className="micro dim">{p.user?.email}</div></td>
                <td className="micro">{p.method.replace(/_/g, ' ')} {p.last4 && `•••• ${p.last4}`}</td>
                <td><StatusPill status={p.status} /></td>
                <td className="num">{money(p.amount, p.currency)}</td>
                <td className="micro dim nowrap">{relTime(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={data?.pages ?? 1} onPage={setPage} />
    </div>
  );
}

/* ── Reviews ──────────────────────────────────────────────── */

function Reviews() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, error, reload, setData } = useAsync(() => adminService.reviews({ page, limit: 20 }), [page]);
  const toggle = async (id: string, hidden: boolean) => {
    try {
      await adminService.moderateReview(id, hidden);
      setData((d) => (d ? { ...d, items: d.items.map((r) => (r.id === id ? { ...r, isHidden: hidden } : r)) } : d));
      toast(hidden ? 'Review hidden' : 'Review restored');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div className="stack">
      {data?.items.map((r) => (
        <div key={r.id} className={`card review-admin ${r.isHidden ? 'is-hidden' : ''}`}>
          <div className="row-between">
            <span className="row">
              <Stars value={r.rating} />
              <span className="label">{r.title}</span>
              <span className="micro dim">{r.user?.name} · {typeof r.hotel === 'object' ? r.hotel.name : ''} · {relTime(r.createdAt)}</span>
            </span>
            <button className="btn-ghost subtle" onClick={() => toggle(r.id, !r.isHidden)}>
              <Icon name={r.isHidden ? 'eye' : 'eye-off'} size={12} /> {r.isHidden ? 'Restore' : 'Hide'}
            </button>
          </div>
          <p className="copy-sm dim" style={{ marginTop: 10 }}>{r.comment}</p>
        </div>
      ))}
      <Pager page={page} pages={data?.pages ?? 1} onPage={setPage} />
    </div>
  );
}

/* ── Coupons ──────────────────────────────────────────────── */

const emptyCoupon: Partial<Coupon> = { code: '', description: '', type: 'PERCENT', value: 10, minAmount: 0, isActive: true };

function Coupons() {
  const toast = useToast();
  const { data, error, reload } = useAsync(() => adminService.coupons(), []);
  const [edit, setEdit] = useState<Partial<Coupon> | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const { id, usedCount: _u, ...body } = edit as Coupon;
    void _u;
    try {
      const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== '' && v !== undefined && v !== null)) as Partial<Coupon>;
      if (id) await adminService.updateCoupon(id, clean);
      else await adminService.createCoupon(clean);
      toast('Coupon saved');
      setEdit(null);
      void reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  const remove = async (c: Coupon) => {
    if (!window.confirm(`Delete ${c.code}?`)) return;
    try {
      await adminService.deleteCoupon(c.id);
      void reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div className="stack">
      <div><button className="btn-ghost" onClick={() => setEdit({ ...emptyCoupon })}><Icon name="plus" size={12} /> New coupon</button></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Code</th><th>Offer</th><th>Min spend</th><th>Valid until</th><th>Used</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.map((c) => {
              const expired = c.validTo && new Date(c.validTo) < new Date();
              return (
                <tr key={c.id}>
                  <td className="label">{c.code}<div className="micro dim" style={{ textTransform: 'none' }}>{c.description}</div></td>
                  <td>{c.type === 'PERCENT' ? `${c.value}%` : money(c.value)}{c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ''}</td>
                  <td>{money(c.minAmount)}</td>
                  <td className={expired ? 'dimmer' : ''}>{c.validTo ? dateLong(c.validTo) : 'No expiry'}</td>
                  <td className="tabular">{c.usedCount ?? 0}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</td>
                  <td><span className={`pill ${c.isActive && !expired ? 's-confirmed' : 's-cancelled'}`}>{expired ? 'Expired' : c.isActive ? 'Active' : 'Paused'}</span></td>
                  <td className="num nowrap">
                    <button className="btn-ghost subtle" onClick={() => setEdit({ ...c, validTo: c.validTo?.slice(0, 10) })}>Edit</button>{' '}
                    <button className="btn-icon" onClick={() => remove(c)} aria-label={`Delete ${c.code}`}><Icon name="trash" size={13} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.code}` : 'New coupon'}>
        {edit && (
          <form className="stack-lg" onSubmit={save}>
            <div className="form-grid">
              <label className="field"><span className="label">Code</span><input className="input" required value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></label>
              <label className="field"><span className="label">Type</span><select className="select" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Coupon['type'] })}><option value="PERCENT">Percent</option><option value="FLAT">Flat ₹</option></select></label>
              <label className="field"><span className="label">Value</span><input className="input" type="number" min={0} required value={edit.value} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value) })} /></label>
              <label className="field"><span className="label">Min spend</span><input className="input" type="number" min={0} value={edit.minAmount ?? 0} onChange={(e) => setEdit({ ...edit, minAmount: Number(e.target.value) })} /></label>
              <label className="field"><span className="label">Max discount</span><input className="input" type="number" min={0} value={edit.maxDiscount ?? ''} onChange={(e) => setEdit({ ...edit, maxDiscount: e.target.value ? Number(e.target.value) : undefined })} /></label>
              <label className="field"><span className="label">Valid until</span><input className="input" type="date" value={edit.validTo ?? ''} onChange={(e) => setEdit({ ...edit, validTo: e.target.value || undefined })} /></label>
              <label className="field"><span className="label">Usage limit</span><input className="input" type="number" min={1} value={edit.usageLimit ?? ''} onChange={(e) => setEdit({ ...edit, usageLimit: e.target.value ? Number(e.target.value) : undefined })} /></label>
            </div>
            <label className="field"><span className="label">Description</span><input className="input" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
            <label className="check"><input type="checkbox" checked={!!edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Active</label>
            <button className="btn">Save coupon</button>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ── Add-ons ──────────────────────────────────────────────── */

function Addons() {
  const toast = useToast();
  const { data, error, reload } = useAsync(() => adminService.addons(), []);
  const [edit, setEdit] = useState<Partial<Addon> | null>(null);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const { id, ...body } = edit;
    try {
      if (id) await adminService.updateAddon(id, body);
      else await adminService.createAddon(body);
      toast('Add-on saved');
      setEdit(null);
      void reload();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  return (
    <div className="stack">
      <div><button className="btn-ghost" onClick={() => setEdit({ name: '', price: 1000, unit: 'PER_STAY', isActive: true })}><Icon name="plus" size={12} /> New add-on</button></div>
      <div className="grid-3">
        {data?.map((a) => (
          <div key={a.id} className={`card stack-sm ${a.isActive === false ? 'is-muted' : ''}`}>
            <div className="row-between"><span className="label">{a.name}</span><span className="label tabular">{money(a.price)}</span></div>
            <span className="copy-sm dim">{a.description}</span>
            <div className="row-between">
              <span className="micro dim">{a.unit.replace('_', ' ')} · {a.isActive === false ? 'archived' : 'live'}</span>
              <button className="link" onClick={() => setEdit(a)}>Edit</button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : 'New add-on'}>
        {edit && (
          <form className="stack-lg" onSubmit={save}>
            <label className="field"><span className="label">Name</span><input className="input" required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="field"><span className="label">Description</span><input className="input" value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
            <div className="form-grid">
              <label className="field"><span className="label">Price</span><input className="input" type="number" min={0} value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} /></label>
              <label className="field"><span className="label">Unit</span><select className="select" value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value as Addon['unit'] })}><option value="PER_STAY">Per stay</option><option value="PER_NIGHT">Per night</option><option value="PER_GUEST">Per guest</option></select></label>
            </div>
            <label className="check"><input type="checkbox" checked={edit.isActive !== false} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Live</label>
            <button className="btn">Save add-on</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
