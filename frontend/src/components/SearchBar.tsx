import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { hotelService } from '../services/hotel';
import { addDays, isoDay } from '../utils/format';
import { Icon } from './Icon';

export interface SearchValue {
  location: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}

export function defaultSearch(): SearchValue {
  const ci = addDays(isoDay(), 14);
  return { location: '', checkIn: ci, checkOut: addDays(ci, 3), guests: 2 };
}

/** Underline-only stay search: where / in / out / guests. */
export function SearchBar({ value, onSubmit, compact = false }: { value?: Partial<SearchValue>; onSubmit?: (v: SearchValue) => void; compact?: boolean }) {
  const nav = useNavigate();
  const [v, setV] = useState<SearchValue>({ ...defaultSearch(), ...value });
  const [sugs, setSugs] = useState<{ type: string; label: string; sub?: string; slug?: string }[]>([]);
  const [focus, setFocus] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    setV((cur) => ({ ...cur, ...value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.location, value?.checkIn, value?.checkOut, value?.guests]);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (!focus || v.location.trim().length < 1) {
      setSugs([]);
      return;
    }
    timer.current = window.setTimeout(() => {
      hotelService.suggest(v.location).then(setSugs).catch(() => setSugs([]));
    }, 180);
  }, [v.location, focus]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const fixed = { ...v, checkOut: v.checkOut <= v.checkIn ? addDays(v.checkIn, 1) : v.checkOut };
    if (onSubmit) onSubmit(fixed);
    else nav(`/explore?${new URLSearchParams({ ...fixed, guests: String(fixed.guests) }).toString()}`);
  };

  return (
    <form className={`searchbar ${compact ? 'is-compact' : ''}`} onSubmit={submit} role="search">
      <label className="field searchbar-where">
        <span className="label">Where</span>
        <input
          className="input"
          placeholder="City, region or hotel"
          value={v.location}
          onChange={(e) => setV({ ...v, location: e.target.value })}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          autoComplete="off"
        />
        {focus && sugs.length > 0 && (
          <ul className="suggest" role="listbox">
            {sugs.map((s) => (
              <li key={`${s.type}${s.label}`}>
                <button
                  type="button"
                  onMouseDown={() => {
                    if (s.type === 'hotel' && s.slug) nav(`/hotels/${s.slug}?checkIn=${v.checkIn}&checkOut=${v.checkOut}`);
                    else setV({ ...v, location: s.label });
                  }}
                >
                  <Icon name={s.type === 'hotel' ? 'bed' : 'pin'} size={13} />
                  <span className="label">{s.label}</span>
                  {s.sub && <span className="micro dim">{s.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>
      <label className="field">
        <span className="label">Check-in</span>
        <input className="input" type="date" min={isoDay()} value={v.checkIn} onChange={(e) => setV({ ...v, checkIn: e.target.value, checkOut: v.checkOut <= e.target.value ? addDays(e.target.value, 1) : v.checkOut })} required />
      </label>
      <label className="field">
        <span className="label">Check-out</span>
        <input className="input" type="date" min={addDays(v.checkIn, 1)} value={v.checkOut} onChange={(e) => setV({ ...v, checkOut: e.target.value })} required />
      </label>
      <label className="field searchbar-guests">
        <span className="label">Guests</span>
        <select className="select" value={v.guests} onChange={(e) => setV({ ...v, guests: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6, 8].map((n) => (
            <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>
          ))}
        </select>
      </label>
      <button className="btn searchbar-go" type="submit">
        Search <span className="arrow">→</span>
      </button>
    </form>
  );
}
