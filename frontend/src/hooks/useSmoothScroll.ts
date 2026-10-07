import Lenis from 'lenis';
import { useEffect } from 'react';
import { prefersReducedMotion } from './useScroll';

/** Inertial wheel scrolling (Lenis) for the editorial pages. Native scroll events still fire. */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return;
    const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    let raf = requestAnimationFrame(function loop(t) {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [enabled]);
}
