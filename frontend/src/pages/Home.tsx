import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { HotelCard, HotelCardSkeleton } from '../components/HotelCard';
import { Icon } from '../components/Icon';
import { LiveDemo } from '../components/LiveDemo';
import { SearchBar } from '../components/SearchBar';
import { Img, Lines, Reveal, SectionHead, Stars } from '../components/ui';
import { IMAGES, PROMPT_IDEAS } from '../data/voyara';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { clamp01, passProgress, pinnedProgress, useScrollFrame } from '../hooks/useScroll';
import { useSmoothScroll } from '../hooks/useSmoothScroll';
import { guideService } from '../services/guide';
import { hotelService } from '../services/hotel';
import { mergeDestinations, sized } from '../utils/destinations';
import { initials, relTime } from '../utils/format';

const SkyPlane = lazy(() => import('../components/SkyPlane'));
const Earth = lazy(() => import('../components/Earth'));

export default function Home() {
  useDocumentTitle();
  // Start fetching + preparing the shared 777 immediately (both plane views reuse it).
  useEffect(() => {
    void import('../components/aircraft').then((m) => m.preloadAirliner()).catch(() => undefined);
  }, []);
  useSmoothScroll();
  return (
    <>
      <Hero />
      <Story />
      <GlobeBand />
      <Destinations />
      <FeaturedStays />
      <Numbers />
      <Voices />
      <FinalCta />
    </>
  );
}

function PromptForm({ big = false }: { big?: boolean }) {
  const nav = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [ph, setPh] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPh((p) => (p + 1) % PROMPT_IDEAS.length), 3800);
    return () => clearInterval(t);
  }, []);
  const go = (e: FormEvent) => {
    e.preventDefault();
    nav(`/architect?prompt=${encodeURIComponent(prompt.trim() || PROMPT_IDEAS[ph])}&go=1`);
  };
  return (
    <form className={`prompt ${big ? 'is-big' : ''}`} onSubmit={go}>
      <label className="micro" htmlFor={big ? 'prompt-big' : 'prompt-hero'}>Describe your trip once</label>
      <div className="input-action">
        <input id={big ? 'prompt-big' : 'prompt-hero'} className="input prompt-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={PROMPT_IDEAS[ph]} autoComplete="off" />
        <button type="submit" className="prompt-go" aria-label="Architect this trip">
          <Icon name="arrow" size={big ? 22 : 18} />
        </button>
      </div>
    </form>
  );
}

/* ── 00 · Hero — an airliner cruising above the clouds ───────── */

const HERO_SKY = 'https://images.unsplash.com/photo-1499346030926-9a72daac6c63?auto=format&fit=crop&w=2200&q=72';

function Hero() {
  const progress = useRef(0);
  const ref = useScrollFrame<HTMLElement>((el) => {
    const r = el.getBoundingClientRect();
    const p = clamp01(-r.top / r.height);
    progress.current = p;
    el.style.setProperty('--hp', p.toFixed(4));
  });
  return (
    <>
      <section className="hero hero-photo inverse" ref={ref}>
        <div className="hero-sky" aria-hidden="true">
          <Img src={HERO_SKY} alt="" eager sizes="100vw" />
        </div>
        <Suspense fallback={null}>
          <SkyPlane progressRef={progress} mode="cruise" />
        </Suspense>
        <div className="hero-inner bleed">
          <p className="label hero-tagline">Voyara — the whole-trip AI travel architect</p>
          <h1 className="hero-headline">
            <span>Describe it once.</span>
            <span>Travel all of it.</span>
          </h1>
        </div>
        <div className="hero-scroll micro" aria-hidden="true">
          <span>Scroll</span>
          <span className="hero-scroll-line" />
        </div>
      </section>
      <section className="prompt-band bleed">
        <p className="voice">Tell us the trip in a sentence. Voyara architects every day — stays, food, rentals, weather-proof backups — then books it in one tap.</p>
        <PromptForm />
        <LiveDemo />
      </section>
      <PlaneReveal />
    </>
  );
}

/* ── The ES-30 moment: monumental wordmark, airliner rising from below ── */

function PlaneReveal() {
  const progress = useRef(0);
  const ref = useScrollFrame<HTMLElement>((el) => {
    const p = pinnedProgress(el);
    progress.current = p;
    el.style.setProperty('--rp', p.toFixed(4));
  });
  return (
    <section className="reveal-band" ref={ref}>
      <div className="reveal-stage">
        <h2 className="reveal-word" aria-label="Voyara">Voyara</h2>
        <Suspense fallback={null}>
          <SkyPlane progressRef={progress} mode="topdown" />
        </Suspense>
        <p className="reveal-caption micro">One sentence · every day planned · booked in one tap</p>
      </div>
    </section>
  );
}

/* ── 01 · The story — scrolling types a trip and the product answers ── */

const STORY_PROMPT = '5 relaxed days in Lisbon with my partner — food, tiles and sunsets';
const STORY_CHIPS = [
  ['Destination', 'Lisbon, Portugal'],
  ['Length', '5 days · 4 nights'],
  ['Party', '2 travellers'],
  ['Pace', 'Relaxed'],
  ['Into', 'Food · Tiles · Sunsets'],
  ['Budget', 'Comfortable'],
];
const STORY_DAYS = [
  { d: 'Day 1', t: 'Alfama stairways & the castle', w: 'sun', temp: '24°' },
  { d: 'Day 2', t: 'Belém, pastéis & the river', w: 'sun', temp: '25°' },
  { d: 'Day 3', t: 'Sintra palaces & gardens', alt: 'National Tile Museum & LX Factory', w: 'rain', temp: '17°' },
  { d: 'Day 4', t: 'Cascais coast by e-bike', w: 'cloud', temp: '22°' },
  { d: 'Day 5', t: 'Miradouro sunset & fado', w: 'sun', temp: '23°' },
];
const PHASES = [
  { at: 0, k: '01 · Describe', h: ['Say it the way', 'you’d say it.'], b: 'No forms, no filters. One sentence carries the destination, the length, the people and the mood.' },
  { at: 0.2, k: '02 · Understand', h: ['Read like', 'a travel agent.'], b: 'Dates, party size, pace, budget and interests are parsed out — you can fine-tune any of them later.' },
  { at: 0.33, k: '03 · Route', h: ['The flight is', 'part of the plan.'], b: 'From your home city to the first stop: distance, door-to-door time and CO₂, before a single day is drawn.' },
  { at: 0.52, k: '04 · Architect', h: ['Every day,', 'by neighbourhood.'], b: 'Places from OpenStreetMap, Wikipedia and our editors, clustered into calm, walkable days with meals in between.' },
  { at: 0.7, k: '05 · Weather', h: ['It rains.', 'The plan doesn’t.'], b: 'Day 3 turns wet in the forecast, so Sintra swaps for its nearest indoor twin — automatically.' },
  { at: 0.84, k: '06 · Book', h: ['One tap.', 'Wheels up.'], b: 'Your stay and an e-bike for the same dates, confirmed together, with a boarding-pass invoice for the front desk.' },
];

function Story() {
  const stage = useRef<HTMLDivElement>(null);
  const routePath = useRef<SVGPathElement>(null);
  const planeG = useRef<SVGGElement>(null);
  const [p, setP] = useState(0);
  const ref = useScrollFrame<HTMLElement>((el) => {
    const v = pinnedProgress(el);
    stage.current?.style.setProperty('--sp', v.toFixed(4));
    setP((cur) => (Math.abs(cur - v) < 0.002 ? cur : v));
  });

  const seg = (a: number, b: number) => clamp01((p - a) / (b - a));
  const typed = STORY_PROMPT.slice(0, Math.round(seg(0.02, 0.18) * STORY_PROMPT.length));
  const chipsShown = Math.floor(seg(0.2, 0.31) * (STORY_CHIPS.length + 0.99));
  const fly = seg(0.35, 0.5);
  const daysShown = Math.floor(seg(0.53, 0.66) * (STORY_DAYS.length + 0.99));
  const rain = seg(0.71, 0.78);
  const swapped = p > 0.78;
  const book = seg(0.85, 0.95);
  const phase = PHASES.reduce((cur, ph, i) => (p >= ph.at ? i : cur), 0);
  const panel = p < 0.34 ? 'prompt' : p < 0.52 ? 'route' : p < 0.84 ? 'plan' : 'ticket';

  // Fly the SVG plane along the route and draw the line behind it.
  useEffect(() => {
    const path = routePath.current;
    const g = planeG.current;
    if (!path || !g) return;
    const len = path.getTotalLength();
    const at = Math.max(0.0001, fly) * len;
    const pt = path.getPointAtLength(at);
    const ahead = path.getPointAtLength(Math.min(len, at + 1));
    const ang = (Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180) / Math.PI;
    g.setAttribute('transform', `translate(${pt.x} ${pt.y}) rotate(${ang})`);
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len - at);
  }, [fly]);

  const ph = PHASES[phase];
  const hours = 10.8 * fly;
  return (
    <section className="story" ref={ref} style={{ height: '720svh' }}>
      <div className="story-stage bleed" ref={stage}>
        <div className="story-left">
          <span key={`k${phase}`} className="micro story-swap accent-text">{ph.k}</span>
          <h2 key={`h${phase}`} className="display story-swap story-title">{ph.h.map((l) => <span key={l}>{l}</span>)}</h2>
          <p key={`b${phase}`} className="voice dim story-swap">{ph.b}</p>
          <ol className="story-steps" aria-hidden="true">
            {PHASES.map((x, i) => <li key={x.k} className={i < phase ? 'is-done' : i === phase ? 'is-now' : ''} />)}
          </ol>
        </div>

        <div className="story-device" data-panel={panel}>
          <div className="story-bar">
            <span className="micro dim">Describe your trip once</span>
            <div className="story-input">
              <span className="story-typed">{typed}</span>
              <span className={`story-caret ${p > 0.19 ? 'is-off' : ''}`} />
              <span className={`story-go ${typed.length === STORY_PROMPT.length ? 'is-ready' : ''}`}><Icon name="arrow" size={16} /></span>
            </div>
            <div className="story-chips">
              {STORY_CHIPS.map(([k, v], i) => (
                <span key={k} className={`story-chip ${i < chipsShown ? 'is-in' : ''}`}>
                  <span className="micro dim">{k}</span>
                  <span className="label">{v}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="story-panels">
            <div className="story-panel story-idle" data-on={panel === 'prompt'}>
              <span className="micro dim">{p < 0.19 ? 'Listening…' : 'Understood — six details found'}</span>
              <span className={`story-wave ${p < 0.19 && p > 0.02 ? 'is-live' : ''}`} aria-hidden="true">
                {Array.from({ length: 32 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}
              </span>
            </div>

            <div className="story-panel story-route" data-on={panel === 'route'}>
              <svg viewBox="0 0 640 300" role="img" aria-label="Flight from Mumbai to Lisbon">
                <defs>
                  <pattern id="story-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.2" fill="#c3d6ea" /></pattern>
                </defs>
                <rect width="640" height="300" fill="url(#story-dots)" />
                <path d="M520 210 Q 330 -20 120 120" fill="none" stroke="#b9cfe6" strokeWidth="1.5" strokeDasharray="4 6" />
                <path ref={routePath} d="M520 210 Q 330 -20 120 120" fill="none" stroke="#001489" strokeWidth="2.5" />
                <circle cx="520" cy="210" r="7" fill="#001489" />
                <text x="520" y="240" textAnchor="middle" className="story-svg-label">Mumbai · BOM</text>
                <circle cx="120" cy="120" r="7" fill={fly > 0.98 ? '#001489' : '#fff'} stroke="#001489" strokeWidth="2" />
                <text x="120" y="150" textAnchor="middle" className="story-svg-label">Lisbon · LIS</text>
                <g ref={planeG}><path d="M13 0 L-8 -8 L-4 0 L-8 8 Z" fill="#001489" /></g>
              </svg>
              <div className="story-route-stats">
                <div><span className="heading-sm tabular">{Math.round(7890 * fly).toLocaleString('en-IN')}</span><span className="micro dim">km</span></div>
                <div><span className="heading-sm tabular">{Math.floor(hours)}h {String(Math.round((hours % 1) * 60)).padStart(2, '0')}m</span><span className="micro dim">door to door</span></div>
                <div><span className="heading-sm tabular">{Math.round(710 * fly)}</span><span className="micro dim">kg CO₂ each</span></div>
              </div>
            </div>

            <div className="story-panel story-plan" data-on={panel === 'plan'}>
              {STORY_DAYS.map((d, i) => {
                const isRain = d.w === 'rain';
                const wet = isRain && rain > 0;
                return (
                  <div key={d.d} className={`story-day ${i < daysShown ? 'is-in' : ''} ${wet ? 'is-wet' : ''} ${isRain && swapped ? 'is-swapped' : ''}`}>
                    <span className="micro dim">{d.d}</span>
                    <span className="story-day-title label">
                      <span className="a">{d.t}</span>
                      {d.alt && <span className="b">{d.alt}</span>}
                    </span>
                    <span className="story-day-wx micro">
                      <Icon name={wet ? 'rain' : d.w} size={14} /> {wet ? '17°' : d.temp}
                    </span>
                    {isRain && swapped && <span className="tag story-swapped">Rain plan</span>}
                  </div>
                );
              })}
              {rain > 0 && (
                <span className="story-rain" style={{ opacity: rain }} aria-hidden="true">
                  {Array.from({ length: 26 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.12}s` }} />)}
                </span>
              )}
            </div>

            <div className="story-panel story-ticket" data-on={panel === 'ticket'} style={{ ['--b' as string]: book }}>
              <div className="pass inverse">
                <div className="pass-top">
                  <div><span className="micro">From</span><span className="display">BOM</span><span className="micro">Mumbai</span></div>
                  <Icon name="arrow" size={28} />
                  <div><span className="micro">To</span><span className="display">LIS</span><span className="micro">Lisbon</span></div>
                </div>
                <div className="pass-rows">
                  <div><span className="micro">Stay</span><span className="label">Casa do Miradouro · 4 nights</span></div>
                  <div><span className="micro">Ride</span><span className="label">Hill-ready e-bike × 2</span></div>
                  <div><span className="micro">Ref</span><span className="label tabular">VYR-8K2M4Q</span></div>
                </div>
                <span className={`pass-stamp ${book > 0.6 ? 'is-on' : ''}`}>Booked</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 02 · Globe teaser — the full planner lives on its own tab ── */

const TEASER_STOPS = [
  { name: 'Lisbon', lat: 38.72, lng: -9.14 },
  { name: 'Paris', lat: 48.86, lng: 2.35 },
  { name: 'Goa', lat: 15.49, lng: 73.83 },
  { name: 'Tokyo', lat: 35.68, lng: 139.65 },
];

function GlobeBand() {
  const [near, setNear] = useState(false);
  const ref = useScrollFrame<HTMLElement>((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 1.5) setNear(true);
  });
  const stops = useMemo(() => TEASER_STOPS, []);
  const none = useMemo(() => [], []);
  return (
    <section className="globe-band" ref={ref}>
      <div className="globe-band-copy bleed">
        <span className="micro accent-text">(02) Globe</span>
        <Lines as="h2" className="display" lines={['Or draw it', 'on the planet.']} />
        <p className="voice dim">Spin the earth, tap two or more places, and Voyara flies the legs and architects every city — each with its own forecast, stays and rentals.</p>
        <Link to="/globe" className="btn btn-lg">Open the globe <span className="arrow">→</span></Link>
      </div>
      <div className="globe-band-earth">
        {near && (
          <Suspense fallback={<div className="earth-loading micro dim">Loading earth…</div>}>
            <Earth stops={stops} markers={none} autoRotate />
          </Suspense>
        )}
      </div>
    </section>
  );
}

/* ── 03 · Destinations — vertical scroll drives a horizontal gallery ── */

function Destinations() {
  const { data } = useAsync(() => guideService.destinations(), []);
  const list = mergeDestinations(data);
  const track = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [travel, setTravel] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px) and (pointer: fine)');
    const measure = () => {
      const t = track.current;
      if (t && !mq.matches) t.style.transform = '';
      setPinned(mq.matches);
      setTravel(t ? Math.max(0, t.scrollWidth - window.innerWidth) : 0);
    };
    measure();
    mq.addEventListener('change', measure);
    window.addEventListener('resize', measure);
    return () => {
      mq.removeEventListener('change', measure);
      window.removeEventListener('resize', measure);
    };
  }, [list.length]);

  const ref = useScrollFrame<HTMLElement>((el) => {
    if (!pinned || !track.current) return;
    const p = pinnedProgress(el);
    track.current.style.transform = `translate3d(${(-p * travel).toFixed(1)}px,0,0)`;
    el.style.setProperty('--dp', p.toFixed(4));
  });

  return (
    <section ref={ref} className={`dest ${pinned ? 'is-pinned' : ''}`} style={pinned ? { height: `calc(100svh + ${travel}px)` } : undefined}>
      <div className="dest-stage">
        <div className="bleed">
          <SectionHead index="03" title="Where people are going" right={<Link to="/guide" className="btn-ghost subtle">All destinations <span className="arrow">→</span></Link>} />
        </div>
        <div className={`dest-strip bleed ${pinned ? 'is-driven' : ''}`} ref={track} aria-label="Destinations">
          {list.map((d, i) => (
            <Link key={d.slug} to={`/guide/${encodeURIComponent(d.name)}`} className="dest-tile">
              <div className="media ratio-4-5"><Img src={sized(d.image, 800)} alt={d.name} sizes="(max-width: 900px) 70vw, 320px" /></div>
              <div className="row-between" style={{ marginTop: 14 }}>
                <span className="heading-sm">{d.name}</span>
                <span className="micro dim tabular">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <span className="micro dim">{d.country} · {d.tags?.slice(0, 2).join(' / ')}</span>
            </Link>
          ))}
        </div>
        {pinned && <div className="bleed dest-progress" aria-hidden="true"><span className="tour-bar"><span /></span></div>}
      </div>
    </section>
  );
}

function FeaturedStays() {
  const { data, loading } = useAsync(() => hotelService.list({ featured: true, limit: 4 }), []);
  return (
    <section className="section bleed">
      <SectionHead index="04" title="Stays worth the detour" sub="Hand-picked, bookable directly — or let the architect place you in the right neighbourhood." right={<Link to="/explore" className="btn-ghost subtle">Browse all stays <span className="arrow">→</span></Link>} />
      <div className="card search-card"><SearchBar /></div>
      <div className="grid-4" style={{ marginTop: 41 }}>
        {loading && !data && Array.from({ length: 4 }, (_, i) => <HotelCardSkeleton key={i} />)}
        {data?.items.map((h, i) => <HotelCard key={h.id} hotel={h} index={i} />)}
      </div>
    </section>
  );
}

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const done = useRef(false);
  const ref = useScrollFrame<HTMLSpanElement>((el) => {
    if (done.current) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.85) {
      done.current = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        setN(Math.round(to * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });
  return <span ref={ref} className="mega tabular">{n}</span>;
}

function Numbers() {
  const ref = useScrollFrame<HTMLElement>((el) => el.style.setProperty('--np', passProgress(el).toFixed(4)));
  const stats: [number, string][] = [[7, 'Live data sources'], [0, 'API keys required'], [1, 'Tap to book it all'], [6, 'Cities per route']];
  return (
    <section className="numbers inverse" ref={ref}>
      <div className="numbers-media" aria-hidden="true"><Img src={IMAGES.road} alt="" sizes="100vw" /></div>
      <div className="numbers-grid bleed">
        {stats.map(([n, l], i) => (
          <Reveal key={l} className="numbers-cell" delay={(i % 4) as 0 | 1 | 2 | 3}>
            <CountUp to={n} />
            <span className="label">{l}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Voices() {
  const { data } = useAsync(() => hotelService.latestReviews(), []);
  if (!data?.length) return null;
  return (
    <section className="section bleed">
      <SectionHead index="05" title="From the road" />
      <div className="voices">
        {data.slice(0, 6).map((r, i) => {
          const hotel = typeof r.hotel === 'object' ? r.hotel : null;
          return (
            <Reveal key={r.id} className="voice-card card" delay={(i % 3) as 0 | 1 | 2}>
              <Stars value={r.rating} />
              <p className="copy">“{r.comment}”</p>
              <hr className="rule" />
              <div className="row-between">
                <div className="row">
                  <span className="avatar micro">{initials(r.user?.name)}</span>
                  <div className="stack-sm" style={{ gap: 3 }}>
                    <span className="label">{r.user?.name}</span>
                    <span className="micro dim">{relTime(r.createdAt)}</span>
                  </div>
                </div>
                {hotel && <Link to={`/hotels/${hotel.slug}`} className="micro link">{hotel.name}</Link>}
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function FinalCta() {
  const ref = useScrollFrame<HTMLElement>((el) => el.style.setProperty('--fp', passProgress(el).toFixed(4)));
  return (
    <section className="void final sky-up" ref={ref}>
      <div className="final-inner bleed">
        <span className="micro accent-text">(06) Your turn</span>
        <Lines as="h2" className="mega final-title" lines={['Where to', 'next?']} />
        <PromptForm big />
      </div>
    </section>
  );
}
