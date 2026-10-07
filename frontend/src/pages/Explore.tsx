import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { HotelCard, HotelCardSkeleton } from '../components/HotelCard';
import { HotelMap } from '../components/HotelMap';
import { Icon } from '../components/Icon';
import { SearchBar, defaultSearch, type SearchValue } from '../components/SearchBar';
import { Empty, ErrorBox, Lines } from '../components/ui';
import { AMENITY_LABEL } from '../data/voyara';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { hotelService } from '../services/hotel';
import { money, nightsBetween, plural, range } from '../utils/format';

const CATEGORIES = ['HOTEL', 'RESORT', 'BOUTIQUE', 'VILLA', 'HERITAGE', 'HOSTEL'];
const FILTER_AMENITIES = ['pool', 'spa', 'breakfast', 'wifi', 'beach-access', 'mountain-view', 'pet-friendly', 'workspace'];

export default function Explore() {
  useDocumentTitle('Stays');
  const [params, setParams] = useSearchParams();
  const def = defaultSearch();
  const q: SearchValue = {
    location: params.get('location') ?? '',
    checkIn: params.get('checkIn') ?? def.checkIn,
    checkOut: params.get('checkOut') ?? def.checkOut,
    guests: Number(params.get('guests') ?? 2),
  };
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const sort = params.get('sort') ?? 'recommended';
  const category = params.get('category') ?? '';
  const stars = params.get('stars') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const amenities = params.get('amenities')?.split(',').filter(Boolean) ?? [];

  const { data, error, loading, reload } = useAsync(
    () =>
      hotelService.search({
        ...q,
        sort: sort === 'recommended' ? undefined : sort,
        category: category || undefined,
        stars: stars ? Number(stars) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        amenities: amenities.join(',') || undefined,
      }),
    [params.toString()],
  );

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next, { replace: true });
  };

  const nights = nightsBetween(q.checkIn, q.checkOut);
  const qs = `?checkIn=${q.checkIn}&checkOut=${q.checkOut}&guests=${q.guests}`;
  const points = useMemo(
    () =>
      (data?.items ?? [])
        .filter((h) => h.location?.coordinates)
        .map((h) => ({ id: h.id, lat: h.location!.coordinates[1], lng: h.location!.coordinates[0], label: money(h.priceFrom), title: h.name, sub: `${h.city} · ★ ${h.rating}`, href: `/hotels/${h.slug}${qs}` })),
    [data, qs],
  );

  const toggleAmenity = (a: string) => set({ amenities: (amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a]).join(',') });
  const activeFilters = [category, stars, maxPrice, ...amenities].filter(Boolean).length;

  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Stays) · {q.location || 'Everywhere'} · {range(q.checkIn, q.checkOut)}</span>
        <div className="row-end">
          <Lines lines={[q.location ? `Stays in ${q.location}` : 'Find a stay', `${plural(nights, 'night')}, ${plural(q.guests, 'guest')}.`]} />
        </div>
        <div className="card search-card">
          <SearchBar value={q} onSubmit={(v) => set({ location: v.location, checkIn: v.checkIn, checkOut: v.checkOut, guests: String(v.guests) })} />
        </div>
      </header>

      <div className="explore-bar">
        <div className="chips">
          <button className={`chip ${!category ? 'is-active' : ''}`} onClick={() => set({ category: null })}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${category === c ? 'is-active' : ''}`} onClick={() => set({ category: category === c ? null : c })}>
              {c.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="row">
          <select className="select" style={{ width: 120 }} value={stars} onChange={(e) => set({ stars: e.target.value })} aria-label="Minimum stars">
            <option value="">Any stars</option>
            {[3, 4, 5].map((s) => <option key={s} value={s}>{s}+ stars</option>)}
          </select>
          <select className="select" style={{ width: 150 }} value={maxPrice} onChange={(e) => set({ maxPrice: e.target.value })} aria-label="Max price">
            <option value="">Any price</option>
            {[3000, 6000, 10000, 15000, 25000].map((p) => <option key={p} value={p}>Under {money(p)}</option>)}
          </select>
          <select className="select" style={{ width: 160 }} value={sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
            <option value="recommended">Recommended</option>
            <option value="price_asc">Price · low to high</option>
            <option value="price_desc">Price · high to low</option>
            <option value="rating">Top rated</option>
          </select>
          <div className="row" style={{ gap: 6 }}>
            <button className={`btn-icon ${view === 'grid' ? 'is-on' : ''}`} onClick={() => setView('grid')} aria-label="Grid view"><Icon name="grid" size={14} /></button>
            <button className={`btn-icon ${view === 'map' ? 'is-on' : ''}`} onClick={() => setView('map')} aria-label="Map view"><Icon name="map" size={14} /></button>
          </div>
        </div>
      </div>
      <div className="chips" style={{ marginBottom: 31 }}>
        {FILTER_AMENITIES.map((a) => (
          <button key={a} className={`chip ${amenities.includes(a) ? 'is-active' : ''}`} onClick={() => toggleAmenity(a)} aria-pressed={amenities.includes(a)}>
            {AMENITY_LABEL[a] ?? a}
          </button>
        ))}
        {activeFilters > 0 && (
          <button className="link" onClick={() => set({ category: null, stars: null, maxPrice: null, amenities: null })}>Clear {activeFilters}</button>
        )}
      </div>

      <div className="row-between" style={{ marginBottom: 18 }}>
        <span className="label">{loading ? 'Searching…' : `${plural(data?.total ?? 0, 'stay')} available`}</span>
        <span className="micro dim">Live availability for your dates</span>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!error && view === 'map' && <div style={{ marginBottom: 41 }}><HotelMap points={points} height="70vh" /></div>}
      {!error && (
        <div className="grid-4">
          {loading && !data && Array.from({ length: 8 }, (_, i) => <HotelCardSkeleton key={i} />)}
          {data?.items.map((h, i) => <HotelCard key={h.id} hotel={h} query={qs} index={i} />)}
        </div>
      )}
      {!loading && data?.items.length === 0 && (
        <Empty
          title="Nothing free for those dates."
          body="Try different dates, fewer filters, or let the architect find you a neighbourhood instead."
          action={{ to: `/architect?destination=${encodeURIComponent(q.location)}`, label: 'Ask the architect' }}
        />
      )}
    </div>
  );
}
