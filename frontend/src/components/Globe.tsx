import { useEffect, useRef } from 'react';

interface Marker {
  name: string;
  lat: number;
  lng: number;
}

const DEFAULT_MARKERS: Marker[] = [
  { name: 'Goa', lat: 15.49, lng: 73.83 },
  { name: 'Jaipur', lat: 26.91, lng: 75.79 },
  { name: 'Manali', lat: 32.24, lng: 77.19 },
  { name: 'Kochi', lat: 9.93, lng: 76.27 },
  { name: 'Paris', lat: 48.86, lng: 2.35 },
  { name: 'Lisbon', lat: 38.72, lng: -9.14 },
  { name: 'Tokyo', lat: 35.68, lng: 139.65 },
  { name: 'Kyoto', lat: 35.01, lng: 135.77 },
  { name: 'Bali', lat: -8.51, lng: 115.26 },
];

/**
 * The "product render" of the void sections: an orthographic dotted sphere,
 * rim-lit from the upper right, slowly rotating. Drag to spin.
 */
export function Globe({ markers = DEFAULT_MARKERS, size = 520, speed = 0.0018 }: { markers?: Marker[]; size?: number; speed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      canvas.width = w * dpr;
      canvas.height = w * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Fibonacci sphere points
    const N = 1600;
    const pts: [number, number, number][] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    const toVec = (lat: number, lng: number): [number, number, number] => {
      const phi = (lat * Math.PI) / 180;
      const lam = (lng * Math.PI) / 180;
      return [Math.cos(phi) * Math.sin(lam), Math.sin(phi), Math.cos(phi) * Math.cos(lam)];
    };
    const mk = markers.map((m) => ({ ...m, v: toVec(m.lat, m.lng) }));

    let rot = -1.35; // start facing India
    const tilt = 0.32;
    let vel = speed;
    let dragging = false;
    let lastX = 0;
    let raf = 0;

    const project = ([x, y, z]: [number, number, number]) => {
      const cr = Math.cos(rot);
      const sr = Math.sin(rot);
      const x1 = x * cr + z * sr;
      const z1 = -x * sr + z * cr;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const y2 = y * ct - z1 * st;
      const z2 = y * st + z1 * ct;
      return [x1, y2, z2] as const;
    };

    const draw = () => {
      const W = w * dpr;
      const R = W * 0.4;
      const cx = W / 2;
      const cy = W / 2;
      ctx.clearRect(0, 0, W, W);

      // Body: warm rim light from upper-right
      const g = ctx.createRadialGradient(cx + R * 0.45, cy - R * 0.5, R * 0.1, cx, cy, R * 1.05);
      g.addColorStop(0, 'rgba(111, 159, 208, 0.45)');
      g.addColorStop(0.45, 'rgba(169, 203, 236, 0.35)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Outline hairline
      ctx.strokeStyle = 'rgba(10, 20, 36, 0.14)';
      ctx.lineWidth = dpr;
      ctx.setLineDash([2 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const p of pts) {
        const [x, y, z] = project(p);
        if (z < -0.05) continue;
        const light = 0.45 + 0.75 * Math.max(0, x * 0.45 + y * 0.45 + z * 0.6);
        ctx.fillStyle = `rgba(10, 20, 36, ${Math.min(1, (0.18 + z * 0.75) * light)})`;
        const s = (1.1 + z * 1.3) * dpr;
        ctx.fillRect(cx + x * R - s / 2, cy - y * R - s / 2, s, s);
      }

      ctx.font = `500 ${11 * dpr}px "Inter Tight", system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      for (const m of mk) {
        const [x, y, z] = project(m.v);
        if (z < 0.08) continue;
        const px = cx + x * R;
        const py = cy - y * R;
        const a = Math.min(1, (z - 0.08) * 3);
        ctx.fillStyle = `rgba(10, 20, 36, ${a})`;
        ctx.beginPath();
        ctx.arc(px, py, 3.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(10, 20, 36, ${a * 0.35})`;
        ctx.beginPath();
        ctx.arc(px, py, 8 * dpr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(m.name.toUpperCase(), px + 12 * dpr, py);
      }
    };

    const tick = () => {
      if (!dragging) {
        rot += vel;
        vel += (speed - vel) * 0.02;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    if (reduce) draw();
    else raf = requestAnimationFrame(tick);

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      rot += dx * 0.006;
      vel = dx * 0.0008;
      if (reduce) draw();
    };
    const up = () => (dragging = false);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, [markers, speed]);

  return <canvas ref={ref} className="globe" style={{ width: '100%', maxWidth: size, aspectRatio: '1' }} aria-label="Rotating globe of Voyara destinations" role="img" />;
}
