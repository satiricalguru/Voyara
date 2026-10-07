import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../services/api';
import type { Hotel } from '../types';
import { money } from '../utils/format';
import { sized } from '../utils/destinations';
import { Icon } from './Icon';
import { Img } from './ui';

export function HotelCard({ hotel, query = '', index }: { hotel: Hotel; query?: string; index?: number }) {
  const { user, wishlist, toggleWish } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const saved = wishlist.has(hotel.id);

  const onWish = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return nav('/login', { state: { from: `/hotels/${hotel.slug}` } });
    try {
      const s = await toggleWish(hotel.id);
      toast(s ? `${hotel.name} saved to wishlist` : 'Removed from wishlist');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <Link to={`/hotels/${hotel.slug}${query}`} className="hotel-card">
      <div className="media ratio-4-5 rounded">
        <Img src={sized(hotel.images[0], 900)} alt={hotel.name} sizes="(max-width: 720px) 100vw, (max-width: 1200px) 33vw, 25vw" />
        <div className="hotel-card-top">
          {index != null && <span className="micro hotel-card-idx">{String(index + 1).padStart(2, '0')}</span>}
          <button className={`btn-icon hotel-card-wish ${saved ? 'is-on' : ''}`} onClick={onWish} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'} aria-pressed={saved}>
            <Icon name="heart" size={14} filled={saved} />
          </button>
        </div>
        {hotel.roomsLeft != null && hotel.roomsLeft <= 4 && <span className="hotel-card-flag micro">Only {hotel.roomsLeft} left</span>}
      </div>
      <div className="hotel-card-body">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div className="stack-sm grow">
            <span className="micro dim">
              {hotel.city}, {hotel.country} · {hotel.category}
            </span>
            <h3 className="heading-sm">{hotel.name}</h3>
          </div>
          <span className="label tabular nowrap">★ {hotel.rating ? hotel.rating.toFixed(1) : 'NEW'}</span>
        </div>
        {hotel.tagline && <p className="copy-sm dim">{hotel.tagline}</p>}
        <hr className="rule" />
        <div className="row-between">
          <span className="label">
            {money(hotel.priceFrom, hotel.currency)} <span className="dim">/ night</span>
          </span>
          {hotel.nights ? <span className="micro dim">{money(hotel.priceFrom * hotel.nights, hotel.currency)} · {hotel.nights} nights</span> : <span className="micro dim">{hotel.reviewCount} reviews</span>}
        </div>
      </div>
    </Link>
  );
}

export function HotelCardSkeleton() {
  return (
    <div className="hotel-card">
      <div className="skeleton ratio-4-5" />
      <div className="hotel-card-body">
        <div className="skeleton" style={{ height: 12, width: '50%' }} />
        <div className="skeleton" style={{ height: 22, width: '80%' }} />
        <div className="skeleton" style={{ height: 12, width: '40%' }} />
      </div>
    </div>
  );
}
