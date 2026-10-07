import { HotelCard } from '../components/HotelCard';
import { Empty, ErrorBox, Lines } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { hotelService } from '../services/hotel';

export default function Wishlist() {
  useDocumentTitle('Wishlist');
  const { wishlist } = useAuth();
  const { data, error, loading, reload } = useAsync(() => hotelService.wishlist(), []);
  const items = data?.filter((h) => wishlist.has(h.id)) ?? [];
  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Account) · Wishlist · {items.length}</span>
        <Lines lines={['Saved for', 'someday.']} />
      </header>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <div className="skeleton" style={{ height: 300 }} />}
      {!loading && items.length === 0 && <Empty title="Nothing saved yet." body="Tap the heart on any stay to keep it here." action={{ to: '/explore', label: 'Browse stays' }} />}
      <div className="grid-4">
        {items.map((h, i) => <HotelCard key={h.id} hotel={h} index={i} />)}
      </div>
    </div>
  );
}
