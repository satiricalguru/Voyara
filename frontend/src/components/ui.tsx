import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { statusLabel } from '../utils/format';
import { Icon } from './Icon';

export function Rule({ tone = 'cork', className = '' }: { tone?: 'cork' | 'drift' | 'cream'; className?: string }) {
  return <hr className={`rule ${tone === 'drift' ? 'rule-drift' : tone === 'cream' ? 'rule-cream' : ''} ${className}`} />;
}

export function SectionHead({ index, title, right, sub }: { index?: string; title: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="section-head">
      <div className="stack-sm">
        {index && <span className="label index">({index})</span>}
        <h2 className="heading">{title}</h2>
        {sub && <p className="copy dim" style={{ maxWidth: 560 }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Display headline whose lines slide up from a mask. Pass lines as an array. */
export function Lines({ lines, className = 'display', as: Tag = 'h1' }: { lines: ReactNode[]; className?: string; as?: 'h1' | 'h2' | 'h3' }) {
  const inView = useInView<HTMLHeadingElement>(0.05);
  return (
    <Tag ref={inView.ref as never} className={`${className} lines ${inView.on ? 'is-in' : ''}`}>
      {lines.map((l, i) => (
        <span key={i}>
          <span>{l}</span>
        </span>
      ))}
    </Tag>
  );
}

/** One-shot "has this scrolled into view" flag, kept in React state. */
function useInView<T extends HTMLElement>(threshold = 0.12) {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || on) return;
    if (!('IntersectionObserver' in window)) return setOn(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold, rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [on, threshold]);
  return { ref, on };
}

export function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: 0 | 1 | 2 | 3 }) {
  const inView = useInView<HTMLDivElement>();
  return (
    <div ref={inView.ref} className={`reveal ${delay ? `reveal-d${delay}` : ''} ${inView.on ? 'is-in' : ''} ${className}`}>
      {children}
    </div>
  );
}

const UNSPLASH = 'images.unsplash.com';
const WIDTHS = [360, 540, 720, 960, 1280, 1680, 2200];
const withW = (url: string, w: number, q = 72) => {
  const u = new URL(url);
  u.searchParams.set('w', String(w));
  u.searchParams.set('q', String(q));
  u.searchParams.set('auto', 'format');
  u.searchParams.set('fit', 'crop');
  return u.toString();
};

/**
 * Fast image: responsive srcset for Unsplash (AVIF/WebP via auto=format), a tiny blurred
 * placeholder that paints immediately, then a fade to the full image.
 */
export function Img({ src, alt, className = '', eager = false, sizes = '(max-width: 720px) 100vw, 50vw' }: { src?: string; alt: string; className?: string; eager?: boolean; sizes?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    setFailed(false);
    // Cached images can finish before React attaches onLoad.
    setLoaded(!!ref.current?.complete && !!ref.current.naturalWidth);
  }, [src]);
  if (!src || failed) return <div className={`img-fallback ${className}`} aria-label={alt}><span className="micro dimmer">VOYARA · NO IMAGE</span></div>;
  const isU = src.includes(UNSPLASH);
  return (
    <>
      {isU && !loaded && <span className="lqip" aria-hidden="true" style={{ backgroundImage: `url("${withW(src, 32, 30)}")` }} />}
      <img
        ref={ref}
        src={isU ? withW(src, 1280) : src}
        srcSet={isU ? WIDTHS.map((w) => `${withW(src, w)} ${w}w`).join(', ') : undefined}
        sizes={isU ? sizes : undefined}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        decoding="async"
        className={`img-fade ${loaded ? 'is-loaded' : ''} ${className}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </>
  );
}

export function Stars({ value, size = 11 }: { value: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name="star" size={size} filled className={i <= Math.round(value) ? '' : 'off'} strokeWidth={0} />
      ))}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill s-${status.toLowerCase()}`}>{statusLabel(status)}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="row label dim">
      <span className="spinner" /> {label && <span className="dots">{label}</span>}
    </span>
  );
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="page-loader">
      <Spinner label={label} />
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: { to: string; label: string } | ReactNode }) {
  return (
    <div className="empty">
      <p className="heading-sm">{title}</p>
      {body && <p className="copy dim" style={{ maxWidth: 520 }}>{body}</p>}
      {action && typeof action === 'object' && 'to' in action ? (
        <Link to={action.to} className="btn-ghost">
          {action.label} <span className="arrow">→</span>
        </Link>
      ) : (
        action
      )}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <p className="tag">Error</p>
      <p className="copy">{message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          <Icon name="refresh" size={14} /> Try again
        </button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between" style={{ marginBottom: 24 }}>
          <span className="label">{title}</span>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 12, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="row-between" style={{ gap: 18 }}>
      <span className="label">{label}</span>
      <span className="stepper">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Fewer ${label}`} disabled={value <= min}>
          <Icon name="minus" size={12} />
        </button>
        <span className="label tabular" style={{ minWidth: 14, textAlign: 'center' }}>{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label={`More ${label}`} disabled={value >= max}>
          <Icon name="plus" size={12} />
        </button>
      </span>
    </div>
  );
}

export function Kv({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
