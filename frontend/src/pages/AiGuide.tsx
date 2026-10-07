import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { HotelCard } from '../components/HotelCard';
import { HotelMap } from '../components/HotelMap';
import { Icon, weatherIcon } from '../components/Icon';
import { ErrorBox, Img, Lines, Reveal, SectionHead } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { guideService } from '../services/guide';
import { findDestination, mergeDestinations, sized } from '../utils/destinations';
import { date, weekday } from '../utils/format';

export default function AiGuide() {
  const { name } = useParams();
  return name ? <DestinationGuide name={decodeURIComponent(name)} /> : <GuideIndex />;
}

function GuideIndex() {
  useDocumentTitle('Destination guide');
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const { data } = useAsync(() => guideService.destinations(), []);
  const list = mergeDestinations(data);
  const go = (e: FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/guide/${encodeURIComponent(q.trim())}`);
  };
  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Guide) · Live overview for any city</span>
        <Lines lines={['Read a place', 'before you go.']} />
        <form onSubmit={go} className="input-action" style={{ maxWidth: 640 }}>
          <input className="input prompt-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type any city — Porto, Hanoi, Leh…" aria-label="City" />
          <button className="prompt-go" aria-label="Open guide"><Icon name="arrow" size={18} /></button>
        </form>
      </header>
      <div className="guide-index">
        {list.map((d, i) => (
          <Reveal key={d.slug} delay={(i % 3) as 0 | 1 | 2}>
            <Link to={`/guide/${encodeURIComponent(d.name)}`} className="guide-tile">
              <div className="media ratio-3-2"><Img src={sized(d.image, 900)} alt={d.name} /></div>
              <div className="row-between">
                <span className="heading">{d.name}</span>
                <span className="micro dim tabular">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <p className="copy-sm dim">{d.summary}</p>
              <span className="micro">Best · {d.bestMonths?.join(' ')}</span>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

const KINDS = ['ALL', 'SIGHT', 'MUSEUM', 'TEMPLE', 'NATURE', 'VIEWPOINT', 'BEACH', 'FOOD', 'CAFE', 'SHOPPING', 'NIGHTLIFE', 'ACTIVITY'];

function DestinationGuide({ name }: { name: string }) {
  useDocumentTitle(`${name} guide`);
  const { data, error, loading, reload } = useAsync(() => guideService.overview(name), [name]);
  const stays = useAsync(() => guideService.stays(name), [name]);
  const [kind, setKind] = useState('ALL');
  const [focus, setFocus] = useState<string | null>(null);
  const curated = findDestination(name);

  const places = useMemo(() => (data?.places ?? []).filter((p) => kind === 'ALL' || p.kind === kind).slice(0, 40), [data, kind]);
  const kinds = useMemo(() => KINDS.filter((k) => k === 'ALL' || data?.places.some((p) => p.kind === k)), [data]);
  const points = places.filter((p) => p.lat).map((p, i) => ({ id: `${p.name}${i}`, lat: p.lat, lng: p.lng, kind: 'dot' as const, title: p.name, sub: `${p.kind.toLowerCase()} · ${p.source}` }));

  const image = data?.destination.image ?? curated?.image ?? data?.overview?.thumbnail;

  if (error) return <div className="page wrap"><ErrorBox message={error} onRetry={reload} /></div>;

  return (
    <div className="guide">
      <header className="trip-hero inverse">
        <div className="trip-hero-media" aria-hidden="true"><Img src={sized(image, 2000)} alt="" eager /></div>
        <div className="trip-hero-inner bleed">
          <div className="crumbs micro"><Link to="/guide">Guide</Link><span>/</span><span>{name}</span></div>
          <h1 className="mega trip-title">{data?.destination.name ?? name}</h1>
          <div className="trip-meta">
            {data?.destination.country && <span className="label">{data.destination.country}</span>}
            {data?.fx && data.fx.quote !== data.fx.base && <span className="label dim">₹100 = {(100 * data.fx.rate).toFixed(2)} {data.fx.quote}</span>}
            {data?.destination.bestMonths?.length ? <span className="label dim">Best · {data.destination.bestMonths.join(' ')}</span> : null}
          </div>
        </div>
      </header>

      <div className="trip-actions bleed">
        <span className="micro dim">{loading ? 'Reading live sources…' : `${data?.places.length ?? 0} places · forecast · exchange rate`}</span>
        <Link to={`/architect?destination=${encodeURIComponent(name)}`} className="btn">Architect {name} <span className="arrow">→</span></Link>
      </div>

      <section className="trip-summary bleed">
        <div className="stack">
          <span className="micro dim">(01) Overview</span>
          {loading && !data ? (
            <div className="stack-sm">{[90, 100, 70].map((w) => <div key={w} className="skeleton" style={{ height: 22, width: `${w}%` }} />)}</div>
          ) : (
            <p className="voice">{data?.destination.summary ?? data?.overview?.extract?.split('. ').slice(0, 2).join('. ')}</p>
          )}
          {data?.overview?.extract && <p className="copy dim">{data.overview.extract}</p>}
          {data?.overview?.url && <a className="micro link" href={data.overview.url} target="_blank" rel="noreferrer">Wikipedia ↗</a>}
        </div>
        <div className="card stack">
          <span className="label">Next 7 days</span>
          <hr className="rule" />
          {loading && !data && <div className="skeleton" style={{ height: 200 }} />}
          <ul className="forecast">
            {data?.weather.map((w) => (
              <li key={w.date} className={w.wet ? 'is-wet' : ''}>
                <span className="micro dim">{weekday(w.date)} {date(w.date)}</span>
                <Icon name={weatherIcon(w.code, w.wet)} size={16} />
                <span className="micro truncate">{w.summary}</span>
                <span className="label tabular">{w.tMax}°<span className="dim">/{w.tMin}°</span></span>
              </li>
            ))}
          </ul>
          {data?.weather[0] && <span className="legal dimmer">Source · {data.weather[0].source}</span>}
        </div>
      </section>

      <section className="bleed section" style={{ paddingTop: 41 }}>
        <SectionHead index="02" title="What’s here" sub="Curated picks first, then live places from OpenStreetMap and Wikipedia." />
        <div className="chips" style={{ marginBottom: 24 }}>
          {kinds.map((k) => (
            <button key={k} className={`chip ${kind === k ? 'is-active' : ''}`} onClick={() => setKind(k)}>{k.toLowerCase()}</button>
          ))}
        </div>
        <div className="day-layout">
          <ol className="place-list">
            {loading && !data && Array.from({ length: 6 }, (_, i) => <li key={i} className="skeleton" style={{ height: 56 }} />)}
            {places.map((p, i) => (
              <li key={`${p.name}${i}`}>
                <button className={`place ${focus === `${p.name}${i}` ? 'is-focus' : ''}`} onClick={() => setFocus(`${p.name}${i}`)}>
                  <span className="micro dim tabular">{String(i + 1).padStart(2, '0')}</span>
                  <span className="stack-sm grow" style={{ gap: 4, textAlign: 'left' }}>
                    <span className="label">{p.name}</span>
                    {p.description && <span className="copy-sm dim">{p.description}</span>}
                  </span>
                  <span className="micro dimmer nowrap">{p.kind.toLowerCase()}{p.source === 'curated' ? ' · pick' : ''}</span>
                </button>
              </li>
            ))}
            {!loading && !places.length && <li className="copy dim">No places in this category yet.</li>}
          </ol>
          <div className="sticky">
            <HotelMap points={points} height="min(70vh, 620px)" focus={focus} center={data ? [data.destination.lat, data.destination.lng] : undefined} />
          </div>
        </div>
      </section>

      <section className="bleed section">
        <SectionHead index="03" title={`Stay in ${name}`} right={<Link className="btn-ghost subtle" to={`/explore?location=${encodeURIComponent(name)}`}>Search dates →</Link>} />
        {stays.loading && <div className="skeleton" style={{ height: 240 }} />}
        {!!stays.data?.bookable.length && (
          <div className="grid-4" style={{ marginBottom: 41 }}>
            {stays.data.bookable.map((h, i) => <HotelCard key={h.id} hotel={h} index={i} />)}
          </div>
        )}
        {!!stays.data?.live.length && (
          <>
            <span className="field-label">Also nearby · OpenStreetMap</span>
            <ul className="live-list">
              {stays.data.live.slice(0, 18).map((s) => (
                <li key={s.id} className="row-between">
                  <span className="label truncate">{s.name}</span>
                  <span className="micro dim">{s.kind.replace('_', ' ')}{s.stars ? ` · ${s.stars}★` : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {!stays.loading && !stays.data?.bookable.length && !stays.data?.live.length && <p className="copy dim">No stays found yet for {name}.</p>}
      </section>
    </div>
  );
}
