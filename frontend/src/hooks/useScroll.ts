import { useEffect, useRef, type RefObject } from 'react';

/* One shared rAF-throttled scroll/resize loop for every scroll-driven effect on the page. */
type Sub = () => void;
const subs = new Set<Sub>();
let ticking = false;
const flush = () => {
  ticking = false;
  subs.forEach((f) => f());
};
const schedule = () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(flush);
  }
};
let bound = false;
function bind() {
  if (bound) return;
  bound = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 0 when the element's top reaches the viewport top, 1 when its bottom reaches the viewport bottom — for sticky/pinned sections. */
export function pinnedProgress(el: Element) {
  const r = el.getBoundingClientRect();
  return clamp01(-r.top / Math.max(1, r.height - window.innerHeight));
}

/** 0 as the element enters from below, 1 once it has fully left the top. */
export function passProgress(el: Element) {
  const r = el.getBoundingClientRect();
  return clamp01((window.innerHeight - r.top) / (window.innerHeight + r.height));
}

/** Calls `cb(el)` on every animation frame in which the page scrolled or resized. */
export function useScrollFrame<T extends HTMLElement>(cb: (el: T) => void, ref?: RefObject<T | null>) {
  const own = useRef<T>(null);
  const target = ref ?? own;
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    bind();
    const run = () => target.current && cbRef.current(target.current);
    subs.add(run);
    run();
    return () => {
      subs.delete(run);
    };
  }, [target]);
  return target;
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
