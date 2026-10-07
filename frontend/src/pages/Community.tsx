import { useState } from 'react';
import { Link } from 'react-router';
import { Empty, ErrorBox, Img, Lines, Reveal } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { CURATED_DESTINATIONS } from '../data/voyara';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { tripService } from '../services/trips';
import type { Itinerary } from '../types';
import { findDestination, sized } from '../utils/destinations';
import { initials, money, plural } from '../utils/format';

export default function Community() {
  useDocumentTitle('Community');
  const toast = useToast();
  const [dest, setDest] = useState('');
  const { data, error, loading, reload, setData } = useAsync(() => tripService.community(dest || undefined), [dest]);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const like = async (t: Itinerary) => {
    if (liked.has(t.id)) return;
    try {
      const n = await tripService.like(t.id);
      setLiked((s) => new Set(s).add(t.id));
      setData((d) => d?.map((x) => (x.id === t.id ? { ...x, likes: n } : x)) ?? null);
    } catch {
      toast('Could not like right now', 'error');
    }
  };

  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Community) · Trips travellers chose to share</span>
        <Lines lines={['Borrow a', 'better plan.']} />
        <p className="voice dim" style={{ maxWidth: 640 }}>Real itineraries from the Voyara community. Open one, then make it yours — the architect re-plans it for your dates and forecast.</p>
      </header>
      <div className="chips" style={{ marginBottom: 31 }}>
        <button className={`chip ${!dest ? 'is-active' : ''}`} onClick={() => setDest('')}>Everywhere</button>
        {CURATED_DESTINATIONS.map((d) => (
          <button key={d.slug} className={`chip ${dest === d.name ? 'is-active' : ''}`} onClick={() => setDest(d.name)}>{d.name}</button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <div className="grid-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton ratio-4-5" />)}</div>}
      {data?.length === 0 && <Empty title="No shared trips here yet." body="Architect one and share it from the trip page." action={{ to: '/architect', label: 'Start a trip' }} />}
      <div className="community-grid">
        {data?.map((t, i) => {
          const by = typeof t.user === 'object' ? t.user : null;
          return (
            <Reveal key={t.id} className={`community-card ${i % 5 === 0 ? 'is-wide' : ''}`}>
              <Link to={t.shareToken ? `/shared/${t.shareToken}` : `/trip/${t.id}`} className="stack">
                <div className="media rounded community-media">
                  <Img src={sized(t.coverImage ?? findDestination(t.destination.name)?.image, 1200)} alt={t.destination.name} />
                  <span className="community-dest micro">{t.destination.name} · {plural(t.days.length, 'day')}</span>
                </div>
                <h3 className="heading-sm">{t.title}</h3>
              </Link>
              <p className="copy-sm dim">{t.summary?.slice(0, 140)}{(t.summary?.length ?? 0) > 140 ? '…' : ''}</p>
              <div className="row-between">
                <div className="row">
                  <span className="avatar micro">{initials(by?.name)}</span>
                  <span className="micro">{by?.name ?? 'Traveller'}<br /><span className="dim">{by?.homeCity}</span></span>
                </div>
                <div className="row">
                  <span className="micro dim">{money(t.estimate?.total)}</span>
                  <button className={`chip ${liked.has(t.id) ? 'is-active' : ''}`} onClick={() => like(t)} aria-label="Like this trip">♥ {t.likes ?? 0}</button>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
