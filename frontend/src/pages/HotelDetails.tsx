import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { HotelCard } from '../components/HotelCard';
import { HotelMap } from '../components/HotelMap';
import { Icon } from '../components/Icon';
import { PriceBreakdown } from '../components/PriceBreakdown';
import { ReviewsSection } from '../components/ReviewsSection';
import { ErrorBox, Img, Modal, PageLoader, SectionHead, Stars, Stepper } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AMENITY_LABEL } from '../data/voyara';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { bookingService } from '../services/booking';
import { hotelService } from '../services/hotel';
import type { Pricing } from '../types';
import { sized } from '../utils/destinations';
import { addDays, isoDay, money, nightsBetween, plural } from '../utils/format';

type Quote = Awaited<ReturnType<typeof bookingService.quote>>;

export default function HotelDetails() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user, wishlist, toggleWish } = useAuth();

  const defIn = addDays(isoDay(), 14);
  const checkIn = params.get('checkIn') ?? defIn;
  const checkOut = params.get('checkOut') ?? addDays(checkIn, 3);
  const [adults, setAdults] = useState(Math.max(1, Number(params.get('guests') ?? 2)));
  const [children, setChildren] = useState(0);
  const [roomsCount, setRoomsCount] = useState(1);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [addonSel, setAddonSel] = useState<Record<string, number>>({});
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [details, setDetails] = useState({ guestName: '', guestEmail: '', guestPhone: '', specialRequests: '' });
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<number | null>(null);

  const { data, error, loading, reload } = useAsync(() => hotelService.get(slug, { checkIn, checkOut }), [slug, checkIn, checkOut]);
  const addons = useAsync(() => hotelService.addons(), []);
  const coupons = useAsync(() => bookingService.publicCoupons(), []);
  const hotel = data?.hotel;
  useDocumentTitle(hotel?.name);

  useEffect(() => {
    if (user) setDetails((d) => ({ ...d, guestName: d.guestName || user.name, guestEmail: d.guestEmail || user.email, guestPhone: d.guestPhone || user.phone || '' }));
  }, [user]);

  // Default to the cheapest room that fits.
  useEffect(() => {
    if (!data) return;
    const fits = data.rooms.filter((r) => (r.available ?? r.quantity) > 0);
    if (!roomId || !data.rooms.some((r) => r.id === roomId)) setRoomId((fits.find((r) => r.capacity >= adults + children) ?? fits[0])?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const room = data?.rooms.find((r) => r.id === roomId);
  const nights = nightsBetween(checkIn, checkOut);

  // Live quote
  useEffect(() => {
    if (!roomId || nights < 1) return;
    let cancelled = false;
    setQuoteErr(null);
    const body = {
      roomId,
      checkIn,
      checkOut,
      guests: { adults, children },
      roomsCount,
      addons: Object.entries(addonSel).map(([addonId, quantity]) => ({ addonId, quantity })),
      couponCode: appliedCoupon,
    };
    const t = setTimeout(() => {
      bookingService
        .quote(body)
        .then((q) => !cancelled && setQuote(q))
        .catch((e) => {
          if (cancelled) return;
          setQuote(null);
          const msg = errorMessage(e);
          setQuoteErr(msg);
          if (appliedCoupon && /coupon|spend/i.test(msg)) setAppliedCoupon(undefined);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [roomId, checkIn, checkOut, adults, children, roomsCount, addonSel, appliedCoupon, nights]);

  const setDates = (ci: string, co: string) => {
    const next = new URLSearchParams(params);
    next.set('checkIn', ci);
    next.set('checkOut', co <= ci ? addDays(ci, 1) : co);
    setParams(next, { replace: true });
  };

  const points = useMemo(() => {
    if (!hotel?.location) return [];
    return [
      { id: hotel.id, lat: hotel.location.coordinates[1], lng: hotel.location.coordinates[0], label: hotel.name, title: hotel.name, sub: hotel.address },
      ...(data?.nearby ?? []).filter((h) => h.location).map((h) => ({ id: h.id, lat: h.location!.coordinates[1], lng: h.location!.coordinates[0], label: money(h.priceFrom), kind: 'label-alt' as const, title: h.name, href: `/hotels/${h.slug}` })),
    ];
  }, [hotel, data?.nearby]);

  if (loading && !data) return <PageLoader label="Opening the doors" />;
  if (error || !hotel) return <div className="page wrap"><ErrorBox message={error ?? 'Hotel not found'} onRetry={reload} /></div>;

  const saved = wishlist.has(hotel.id);
  const onWish = async () => {
    if (!user) return nav('/login', { state: { from: `/hotels/${slug}` } });
    try {
      toast((await toggleWish(hotel.id)) ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const applyCoupon = (e?: FormEvent) => {
    e?.preventDefault();
    setAppliedCoupon(coupon.trim().toUpperCase() || undefined);
  };

  const reserve = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return nav('/login', { state: { from: `/hotels/${slug}?${params.toString()}` } });
    if (!roomId) return;
    setBusy(true);
    try {
      const b = await bookingService.create({
        roomId,
        checkIn,
        checkOut,
        guests: { adults, children },
        roomsCount,
        addons: Object.entries(addonSel).map(([addonId, quantity]) => ({ addonId, quantity })),
        couponCode: appliedCoupon,
        ...details,
      });
      nav(`/pay/${b.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const imgs = hotel.images.length ? hotel.images : [undefined];

  return (
    <div className="page hotel-page">
      <div className="bleed">
        <div className="crumbs micro" style={{ marginBottom: 18 }}>
          <Link to="/explore">Stays</Link>
          <span>/</span>
          <Link to={`/explore?location=${hotel.city}`}>{hotel.city}</Link>
          <span>/</span>
          <span>{hotel.name}</span>
        </div>
        <div className="hotel-title row-end">
          <div className="stack-sm">
            <span className="micro dim">{hotel.category} · {'★'.repeat(hotel.stars)} · {hotel.city}, {hotel.country}</span>
            <h1 className="display">{hotel.name}</h1>
          </div>
          <div className="row">
            <a href="#reviews" className="row label"><Stars value={hotel.rating} /> {hotel.rating.toFixed(1)} · {hotel.reviewCount} reviews</a>
            <button className={`btn-icon ${saved ? 'is-on' : ''}`} onClick={onWish} aria-label="Save to wishlist" aria-pressed={saved}>
              <Icon name="heart" size={14} filled={saved} />
            </button>
          </div>
        </div>
      </div>

      <div className="gallery bleed">
        {imgs.slice(0, 4).map((src, i) => (
          <button key={i} className={`media gallery-cell g-${i}`} onClick={() => setGallery(i)} aria-label={`Open photo ${i + 1}`}>
            <Img src={sized(src, i === 0 ? 1800 : 900)} alt={`${hotel.name} photo ${i + 1}`} eager={i === 0} />
          </button>
        ))}
        {hotel.images.length > 1 && <span className="gallery-count micro">{hotel.images.length} photos</span>}
      </div>

      <div className="split bleed hotel-body">
        <div className="stack-lg">
          <section className="stack">
            {hotel.tagline && <p className="voice">{hotel.tagline}</p>}
            <p className="copy dim" style={{ maxWidth: 760 }}>{hotel.description}</p>
            <div className="hotel-facts">
              <div><span className="micro dim">Check-in</span><span className="label">from {hotel.checkInTime}</span></div>
              <div><span className="micro dim">Check-out</span><span className="label">until {hotel.checkOutTime}</span></div>
              <div><span className="micro dim">Address</span><span className="label">{hotel.address}</span></div>
              {hotel.contact?.phone && <div><span className="micro dim">Front desk</span><span className="label">{hotel.contact.phone}</span></div>}
            </div>
          </section>

          <section>
            <SectionHead index="01" title="In the house" />
            <ul className="amenities">
              {hotel.amenities.map((a) => (
                <li key={a} className="label">— {AMENITY_LABEL[a] ?? a}</li>
              ))}
            </ul>
          </section>

          <section>
            <SectionHead index="02" title="Rooms" sub={`Live availability for ${plural(nights, 'night')} · ${checkIn} → ${checkOut}`} />
            <div className="rooms">
              {data!.rooms.map((r) => {
                const left = r.available ?? r.quantity;
                const sel = r.id === roomId;
                return (
                  <button key={r.id} className={`room ${sel ? 'is-on' : ''} ${left <= 0 ? 'is-out' : ''}`} onClick={() => left > 0 && setRoomId(r.id)} disabled={left <= 0} aria-pressed={sel}>
                    <div className="media room-media">
                      <Img src={sized(r.images[0] ?? hotel.images[0], 600)} alt={r.name} />
                    </div>
                    <div className="stack-sm grow" style={{ textAlign: 'left' }}>
                      <span className="micro dim">{r.type} · {r.size} m² · sleeps {r.capacity}</span>
                      <span className="heading-sm">{r.name}</span>
                      <span className="copy-sm dim">{r.beds}. {r.description}</span>
                    </div>
                    <div className="room-price">
                      <span className="label">{money(r.pricePerNight)}</span>
                      <span className="micro dim">per night</span>
                      <span className={`micro ${left <= 2 ? 'accent-text' : 'dim'}`}>{left <= 0 ? 'Sold out' : `${left} left`}</span>
                      <span className={`room-radio ${sel ? 'is-on' : ''}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <SectionHead index="03" title="Good to know" />
            <div className="grid-3">
              {[
                ['Cancellation', hotel.policies?.cancellation],
                ['Children', hotel.policies?.children],
                ['Pets', hotel.policies?.pets],
              ].map(([t, b]) => (
                <div key={t} className="card stack-sm">
                  <span className="label">{t}</span>
                  <span className="copy-sm dim">{b}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <SectionHead index="04" title="Where it is" right={<Link to={`/architect?destination=${encodeURIComponent(hotel.city)}`} className="btn-ghost subtle">Plan {hotel.city} around it →</Link>} />
            <HotelMap points={points} height={420} zoom={14} />
          </section>

          <ReviewsSection hotel={hotel} breakdown={data!.ratingBreakdown} onChanged={reload} />
        </div>

        <aside className="sticky">
          <form className="card stack book-panel" onSubmit={reserve}>
            <div className="row-between">
              <span className="heading-sm">{room ? money(room.pricePerNight) : money(hotel.priceFrom)}<span className="label dim"> / night</span></span>
              <span className="micro dim">{plural(nights, 'night')}</span>
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field">
                <span className="label">Check-in</span>
                <input className="input" type="date" min={isoDay()} value={checkIn} onChange={(e) => setDates(e.target.value, checkOut)} />
              </label>
              <label className="field">
                <span className="label">Check-out</span>
                <input className="input" type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setDates(checkIn, e.target.value)} />
              </label>
            </div>
            <div className="stack-sm">
              <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={12} />
              <Stepper label="Children" value={children} onChange={setChildren} min={0} max={8} />
              <Stepper label="Rooms" value={roomsCount} onChange={setRoomsCount} min={1} max={5} />
            </div>
            <hr className="rule" />
            <div className="stack-sm">
              <span className="field-label">Add to your stay</span>
              {addons.data?.map((a) => (
                <label key={a.id} className="check addon">
                  <input type="checkbox" checked={!!addonSel[a.id]} onChange={(e) => setAddonSel((s) => { const n = { ...s }; if (e.target.checked) n[a.id] = 1; else delete n[a.id]; return n; })} />
                  <span className="grow">{a.name}</span>
                  <span className="micro dim">{money(a.price)} {a.unit === 'PER_NIGHT' ? '/night' : a.unit === 'PER_GUEST' ? '/guest' : ''}</span>
                </label>
              ))}
            </div>
            <div className="input-action">
              <input className="input" placeholder="COUPON CODE" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && applyCoupon(e as never)} aria-label="Coupon code" />
              <button type="button" className="label" onClick={() => applyCoupon()}>{appliedCoupon ? 'Applied ✓' : 'Apply'}</button>
            </div>
            {!!coupons.data?.length && !appliedCoupon && (
              <div className="chips">
                {coupons.data.slice(0, 3).map((c) => (
                  <button type="button" key={c.code} className="chip" title={c.description} onClick={() => { setCoupon(c.code); setAppliedCoupon(c.code); }}>{c.code}</button>
                ))}
              </div>
            )}
            <hr className="rule" />
            {quote ? (
              <PriceBreakdown pricing={quote.pricing as Pricing} nights={quote.nights} roomName={room?.name} roomsCount={roomsCount} addons={quote.addons} couponCode={quote.coupon?.code} />
            ) : quoteErr ? (
              <p className="field-error">{quoteErr}</p>
            ) : (
              <div className="skeleton" style={{ height: 120 }} />
            )}
            <details className="guest-details">
              <summary className="label">Guest details {user ? `· ${details.guestName}` : ''}</summary>
              <div className="stack" style={{ marginTop: 18 }}>
                <label className="field"><span className="label">Full name</span><input className="input" value={details.guestName} onChange={(e) => setDetails({ ...details, guestName: e.target.value })} /></label>
                <label className="field"><span className="label">Email</span><input className="input" type="email" value={details.guestEmail} onChange={(e) => setDetails({ ...details, guestEmail: e.target.value })} /></label>
                <label className="field"><span className="label">Phone</span><input className="input" value={details.guestPhone} onChange={(e) => setDetails({ ...details, guestPhone: e.target.value })} /></label>
                <label className="field"><span className="label">Requests</span><textarea className="textarea" rows={2} value={details.specialRequests} onChange={(e) => setDetails({ ...details, specialRequests: e.target.value })} placeholder="Late arrival, quiet room…" /></label>
              </div>
            </details>
            <button className="btn btn-lg" disabled={busy || !quote}>
              {busy ? 'Holding your room…' : user ? 'Reserve' : 'Sign in to reserve'} <span className="arrow">→</span>
            </button>
            <p className="micro dimmer" style={{ textAlign: 'center' }}>You won’t be charged yet</p>
          </form>
        </aside>
      </div>

      {!!data?.nearby.length && (
        <section className="bleed section">
          <SectionHead index="06" title={`More in ${hotel.city}`} />
          <div className="grid-4">
            {data.nearby.map((h) => <HotelCard key={h.id} hotel={h} query={`?checkIn=${checkIn}&checkOut=${checkOut}`} />)}
          </div>
        </section>
      )}

      <Modal open={gallery !== null} onClose={() => setGallery(null)} title={`${hotel.name} · ${(gallery ?? 0) + 1} / ${hotel.images.length}`}>
        {gallery !== null && (
          <div className="stack">
            <div className="media ratio-3-2 rounded"><Img src={sized(hotel.images[gallery], 1600)} alt="" /></div>
            <div className="row-between">
              <button className="btn-ghost subtle" onClick={() => setGallery((g) => ((g ?? 0) - 1 + hotel.images.length) % hotel.images.length)}>← Prev</button>
              <button className="btn-ghost subtle" onClick={() => setGallery((g) => ((g ?? 0) + 1) % hotel.images.length)}>Next →</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
