import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { errorMessage } from '../services/api';
import { hotelService } from '../services/hotel';
import type { Hotel } from '../types';
import { initials, relTime } from '../utils/format';
import { Icon } from './Icon';
import { SectionHead, Stars } from './ui';

export function ReviewsSection({ hotel, breakdown, onChanged }: { hotel: Hotel; breakdown: Record<string, number>; onChanged?: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useAsync(() => hotelService.reviews(hotel.id, { page, sort }), [hotel.id, page, sort, user?.id]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: '', comment: '', tripType: 'COUPLE' });
  const [busy, setBusy] = useState(false);

  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await hotelService.addReview({ hotelId: hotel.id, ...form });
      toast('Thanks — your review is live');
      setOpen(false);
      setForm({ rating: 5, title: '', comment: '', tripType: 'COUPLE' });
      await reload();
      onChanged?.();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await hotelService.deleteReview(id);
      toast('Review deleted');
      await reload();
      onChanged?.();
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <section id="reviews">
      <SectionHead
        index="05"
        title="Guest notes"
        right={
          <div className="row">
            <select className="select" style={{ width: 150 }} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort reviews">
              <option value="recent">Most recent</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </select>
            {data?.canReview && (
              <button className="btn-ghost" onClick={() => setOpen((o) => !o)}>
                {open ? 'Close' : 'Write a review'}
              </button>
            )}
          </div>
        }
      />
      <div className="reviews-grid">
        <aside className="stack">
          <div className="row" style={{ alignItems: 'flex-end', gap: 14 }}>
            <span className="display tabular">{hotel.rating ? hotel.rating.toFixed(1) : '—'}</span>
            <div className="stack-sm" style={{ paddingBottom: 4 }}>
              <Stars value={hotel.rating} />
              <span className="micro dim">{hotel.reviewCount} verified stays</span>
            </div>
          </div>
          <div className="stack-sm">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = breakdown[n] ?? 0;
              return (
                <div key={n} className="bar-row">
                  <span className="micro tabular">{n}</span>
                  <span className="bar">
                    <span style={{ width: `${total ? (c / total) * 100 : 0}%` }} />
                  </span>
                  <span className="micro dim tabular">{c}</span>
                </div>
              );
            })}
          </div>
          {!user && (
            <p className="copy-sm dim">
              <Link to="/login" className="link">Sign in</Link> after your stay to leave a note.
            </p>
          )}
          {user && data && !data.canReview && <p className="micro dimmer">Reviews open once you have a confirmed stay here.</p>}
        </aside>

        <div className="stack">
          {open && (
            <form className="card stack" onSubmit={submit}>
              <div className="row-between">
                <span className="label">Your rating</span>
                <div className="row" style={{ gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => setForm({ ...form, rating: n })} aria-label={`${n} stars`} className={n <= form.rating ? '' : 'dimmer'}>
                      <Icon name="star" size={20} filled strokeWidth={0} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span className="label">Headline</span>
                  <input className="input" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Felt like home" />
                </label>
                <label className="field">
                  <span className="label">Trip type</span>
                  <select className="select" value={form.tripType} onChange={(e) => setForm({ ...form, tripType: e.target.value })}>
                    {['COUPLE', 'SOLO', 'FAMILY', 'FRIENDS', 'BUSINESS'].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
              </div>
              <label className="field">
                <span className="label">Your note</span>
                <textarea className="textarea" required minLength={10} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="What should the next guest know?" />
              </label>
              <div>
                <button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Post review'}</button>
              </div>
            </form>
          )}

          {loading && !data && <div className="skeleton" style={{ height: 160 }} />}
          {data?.reviews.length === 0 && <p className="voice dim">No notes yet. Be the first to stay and tell.</p>}
          {data?.reviews.map((r) => (
            <article key={r.id} className="review">
              <div className="row-between">
                <div className="row">
                  <span className="avatar micro">{initials(r.user?.name)}</span>
                  <div className="stack-sm" style={{ gap: 4 }}>
                    <span className="label">{r.user?.name ?? 'Guest'}</span>
                    <span className="micro dim">
                      {r.user?.homeCity ?? 'Traveller'} · {r.tripType} · {relTime(r.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="row">
                  <Stars value={r.rating} />
                  {(user?.role === 'ADMIN' || user?.id === r.user?.id) && (
                    <button className="btn-icon" onClick={() => remove(r.id)} aria-label="Delete review">
                      <Icon name="trash" size={13} />
                    </button>
                  )}
                </div>
              </div>
              {r.title && <h4 className="label" style={{ marginTop: 16 }}>{r.title}</h4>}
              <p className="copy dim" style={{ marginTop: 8 }}>{r.comment}</p>
            </article>
          ))}
          {data && data.pages > 1 && (
            <div className="row">
              <button className="btn-ghost subtle" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Newer</button>
              <span className="micro dim">{page} / {data.pages}</span>
              <button className="btn-ghost subtle" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Older →</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
