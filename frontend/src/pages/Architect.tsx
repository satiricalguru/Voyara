import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { Lines, Stepper } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { CURATED_DESTINATIONS, INTERESTS, PROMPT_IDEAS } from '../data/voyara';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { guideService, type ArchitectInput } from '../services/guide';
import { tripService } from '../services/trips';
import type { Budget, Pace } from '../types';
import { addDays, date, isoDay } from '../utils/format';

const STEPS = [
  'Reading your sentence',
  'Placing the destination on the map',
  'Pulling the day-by-day forecast',
  'Gathering places from OpenStreetMap & Wikipedia',
  'Clustering days by neighbourhood',
  'Pairing every outdoor stop with a rain-proof twin',
  'Matching stays and rentals',
  'Estimating costs & exchange rate',
];

export default function Architect() {
  useDocumentTitle('Architect');
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState(params.get('prompt') ?? '');
  const [tune, setTune] = useState(!!params.get('destination'));
  const [destination, setDestination] = useState(params.get('destination') ?? '');
  const [startDate, setStartDate] = useState(addDays(isoDay(), 14));
  const [days, setDays] = useState(4);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [budget, setBudget] = useState<Budget | ''>('');
  const [pace, setPace] = useState<Pace | ''>('');
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const auto = useRef(false);

  const recent = useAsync(() => (user ? tripService.mine() : Promise.resolve([])), [user?.id]);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const a = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 1400);
    const b = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, [busy]);

  const build = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() && !destination.trim()) {
      setError('Describe your trip, or open “Fine-tune” and pick a destination.');
      return;
    }
    setError(null);
    setBusy(true);
    setStep(0);
    setElapsed(0);
    const body: ArchitectInput = { prompt: prompt.trim() || undefined, save: true };
    if (tune) {
      Object.assign(body, {
        destination: destination.trim() || undefined,
        startDate,
        days,
        travelers: { adults, children },
        budget: budget || undefined,
        pace: pace || undefined,
        interests: interests.length ? interests : undefined,
      });
    }
    try {
      const it = await guideService.architect(body);
      nav(`/trip/${it.id}`, { state: { fresh: true } });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!auto.current && params.get('go') === '1' && prompt) {
      auto.current = true;
      void build();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleInterest = (i: string) => setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));

  if (busy) {
    return (
      <div className="page building bleed">
        <div className="building-inner">
          <span className="micro dim">Architecting · {elapsed}s</span>
          <p className="voice building-prompt">“{prompt || `${days} days in ${destination}`}”</p>
          <hr className="rule" />
          <ol className="building-steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
                <span className="micro tabular dim">{String(i + 1).padStart(2, '0')}</span>
                <span className="label">{s}</span>
                <span className="micro">{i < step ? 'Done' : i === step ? <span className="spinner" /> : ''}</span>
              </li>
            ))}
          </ol>
          <p className="micro dimmer">Live sources can take up to 15 seconds. Curated data fills any gaps.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page bleed">
      <div className="architect">
        <form className="architect-main" onSubmit={build}>
          <span className="micro dim">(Architect) · Step 01 of 02</span>
          <Lines lines={['Describe it', 'once.']} className="mega architect-title" />
          <label className="field">
            <span className="label">Your trip, in your words</span>
            <textarea
              className="textarea architect-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="5 relaxed days in Lisbon with my partner in May — food, tiles and sunsets, mid budget."
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void build();
              }}
            />
          </label>
          <div className="chips">
            {PROMPT_IDEAS.slice(0, 4).map((p) => (
              <button type="button" key={p} className="chip" onClick={() => setPrompt(p)}>
                {p.length > 42 ? `${p.slice(0, 42)}…` : p}
              </button>
            ))}
          </div>

          <button type="button" className="tune-toggle row-between" onClick={() => setTune((t) => !t)} aria-expanded={tune}>
            <span className="label">Fine-tune (optional)</span>
            <Icon name={tune ? 'minus' : 'plus'} size={14} />
          </button>

          {tune && (
            <div className="tune stack-lg">
              <div className="form-grid">
                <label className="field">
                  <span className="label">Destination</span>
                  <input className="input" list="dest-list" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Any city on earth" />
                  <datalist id="dest-list">
                    {CURATED_DESTINATIONS.map((d) => <option key={d.slug} value={d.name} />)}
                  </datalist>
                </label>
                <label className="field">
                  <span className="label">Start date</span>
                  <input className="input" type="date" min={isoDay()} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              </div>
              <div className="tune-steppers">
                <Stepper label="Days" value={days} onChange={setDays} min={1} max={14} />
                <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={12} />
                <Stepper label="Children" value={children} onChange={setChildren} min={0} max={8} />
              </div>
              <div className="stack-sm">
                <span className="field-label">Budget</span>
                <div className="chips">
                  {(['SHOESTRING', 'MODERATE', 'LUXURY'] as Budget[]).map((b) => (
                    <button type="button" key={b} className={`chip ${budget === b ? 'is-active' : ''}`} onClick={() => setBudget(budget === b ? '' : b)}>
                      {b === 'SHOESTRING' ? 'Shoestring' : b === 'MODERATE' ? 'Comfortable' : 'Luxury'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="stack-sm">
                <span className="field-label">Pace</span>
                <div className="chips">
                  {(['relaxed', 'balanced', 'packed'] as Pace[]).map((p) => (
                    <button type="button" key={p} className={`chip ${pace === p ? 'is-active' : ''}`} onClick={() => setPace(pace === p ? '' : p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="stack-sm">
                <span className="field-label">Interests</span>
                <div className="chips">
                  {INTERESTS.map((i) => (
                    <button type="button" key={i} className={`chip ${interests.includes(i) ? 'is-active' : ''}`} onClick={() => toggleInterest(i)} aria-pressed={interests.includes(i)}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <p className="micro dimmer">Anything you set here overrides what we read from your sentence.</p>
            </div>
          )}

          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="row">
            <button className="btn btn-lg" type="submit">
              Architect my trip <span className="arrow">→</span>
            </button>
            <span className="micro dimmer hide-sm"><span className="kbd">⌘</span> + <span className="kbd">Enter</span></span>
          </div>
        </form>

        <aside className="architect-side">
          <div className="card stack">
            <span className="label">What you get</span>
            <hr className="rule" />
            {[
              ['calendar', 'A day-by-day plan', 'Morning, lunch, afternoon, evening, dinner — clustered by neighbourhood.'],
              ['rain', 'Weather-aware swaps', 'Each outdoor stop has an indoor twin that swaps in when rain is likely.'],
              ['bed', 'Stays that fit', 'Bookable Voyara hotels ranked for your budget, plus live options nearby.'],
              ['bike', 'Rentals for the same dates', 'Scooters, e-bikes and cars — bookable alongside your room.'],
              ['map', 'Live map & costs', 'Every stop pinned, with a cost estimate and exchange rate.'],
            ].map(([icon, t, b]) => (
              <div key={t} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <Icon name={icon} size={18} />
                <div className="stack-sm" style={{ gap: 4 }}>
                  <span className="label">{t}</span>
                  <span className="copy-sm dim">{b}</span>
                </div>
              </div>
            ))}
          </div>
          {user && !!recent.data?.length && (
            <div className="card stack">
              <span className="label">Your recent trips</span>
              <hr className="rule" />
              {recent.data.slice(0, 4).map((t) => (
                <Link key={t.id} to={`/trip/${t.id}`} className="row-between recent-trip">
                  <span className="label truncate">{t.title}</span>
                  <span className="micro dim">{date(t.startDate)}</span>
                </Link>
              ))}
            </div>
          )}
          {!user && (
            <p className="copy-sm dim">
              No account needed to try. <Link className="link" to="/login" state={{ from: '/architect' }}>Sign in</Link> to save trips and book in one tap.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
