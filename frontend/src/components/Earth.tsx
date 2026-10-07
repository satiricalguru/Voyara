import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface EarthMarker {
  name: string;
  lat: number;
  lng: number;
}

export interface EarthStop extends EarthMarker {
  pending?: boolean;
}

export const EARTH_MARKERS: EarthMarker[] = [
  { name: 'Goa', lat: 15.49, lng: 73.83 },
  { name: 'Jaipur', lat: 26.91, lng: 75.79 },
  { name: 'Udaipur', lat: 24.59, lng: 73.71 },
  { name: 'Manali', lat: 32.24, lng: 77.19 },
  { name: 'Kochi', lat: 9.93, lng: 76.27 },
  { name: 'Mumbai', lat: 19.08, lng: 72.88 },
  { name: 'Paris', lat: 48.86, lng: 2.35 },
  { name: 'Lisbon', lat: 38.72, lng: -9.14 },
  { name: 'Tokyo', lat: 35.68, lng: 139.65 },
  { name: 'Kyoto', lat: 35.01, lng: 135.77 },
  { name: 'Bali', lat: -8.51, lng: 115.26 },
];

const DEG = Math.PI / 180;

/** Matches three.js SphereGeometry UVs for an equirectangular texture. */
export function toVec(lat: number, lng: number, r = 1) {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function toLatLng(v: THREE.Vector3) {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, n.y))) / DEG;
  let lng = Math.atan2(n.z, -n.x) / DEG - 180;
  if (lng < -180) lng += 360;
  return { lat, lng };
}

/** Group rotation that turns (lat, lng) to face the camera. */
function facing(lat: number, lng: number) {
  const v = toVec(0, lng);
  return { x: lat * DEG, y: -Math.atan2(v.x, v.z) };
}

/** Great-circle arc lifted above the surface — higher for longer hops. */
function arcCurve(a: EarthMarker, b: EarthMarker) {
  const va = toVec(a.lat, a.lng);
  const vb = toVec(b.lat, b.lng);
  const angle = va.angleTo(vb);
  const lift = 0.04 + angle * 0.22;
  const s = Math.sin(angle);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    const p =
      angle > 0.001
        ? va.clone().multiplyScalar(Math.sin((1 - t) * angle) / s).add(vb.clone().multiplyScalar(Math.sin(t * angle) / s))
        : va.clone();
    pts.push(p.multiplyScalar(1.003 + Math.sin(Math.PI * t) * lift));
  }
  return new THREE.CatmullRomCurve3(pts);
}

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

// Daylight "atlas" grade: pale land with soft relief, light-sky oceans, a faint
// engineering graticule, soft key light from the upper right.
const earthFrag = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uWater;
  uniform vec3 uSun;
  uniform float uReady;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPos;

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPos);
    vec3 day = texture2D(uDay, vUv).rgb;
    float water = smoothstep(0.35, 0.65, texture2D(uWater, vUv).r);
    float lum = dot(day, vec3(0.299, 0.587, 0.114));

    vec3 land = mix(vec3(0.80, 0.85, 0.90), vec3(0.985, 0.99, 1.0), smoothstep(0.08, 0.7, lum));
    vec3 ocean = mix(vec3(0.44, 0.62, 0.82), vec3(0.62, 0.77, 0.91), smoothstep(-0.2, 0.9, dot(n, uSun)));
    vec3 col = mix(land, ocean, water);

    // graticule every 15°
    vec2 q = vec2(vUv.x * 24.0, vUv.y * 12.0);
    vec2 g = abs(fract(q + 0.5) - 0.5) / fwidth(q);
    float grid = 1.0 - min(min(g.x, g.y), 1.0);
    col = mix(col, vec3(0.0, 0.08, 0.54), grid * 0.08);

    float light = 0.62 + 0.38 * smoothstep(-0.6, 0.9, dot(n, uSun));
    col *= light;

    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    col = mix(col, vec3(0.86, 0.93, 1.0), fres * 0.6);

    gl_FragColor = vec4(col, uReady);
  }
`;

const atmoFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPos;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPos);
    float rim = pow(max(0.0, 0.66 - dot(n, viewDir)), 2.2);
    gl_FragColor = vec4(vec3(0.6, 0.78, 0.96), rim * 0.85);
  }
`;

/** A tiny arrowhead "plane" that flies along each arc. */
function planeMesh() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.034);
  shape.lineTo(0.017, -0.02);
  shape.lineTo(0, -0.01);
  shape.lineTo(-0.017, -0.02);
  shape.closePath();
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0x001489, side: THREE.DoubleSide }));
}

export interface EarthProps {
  markers?: EarthMarker[];
  stops?: EarthStop[];
  focus?: { lat: number; lng: number } | null;
  zoom?: number;
  onPick?: (p: { lat: number; lng: number }) => void;
  onMarker?: (m: EarthMarker) => void;
  onFail?: () => void;
  wheelZoom?: boolean;
  autoRotate?: boolean;
}

type ZoomEl = HTMLDivElement & { __zoom?: (d: number) => void };

export function Earth({ markers = EARTH_MARKERS, stops = [], focus = null, zoom = 0, onPick, onMarker, onFail, wheelZoom = false, autoRotate = true }: EarthProps) {
  const wrap = useRef<ZoomEl>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const live = useRef({ focus, zoom, stops, onPick, onMarker, autoRotate });
  live.current = { focus, zoom, stops, onPick, onMarker, autoRotate };
  const api = useRef<{ setStops: (s: EarthStop[]) => void } | null>(null);

  useEffect(() => {
    const el = wrap.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      onFail?.();
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    el.prepend(renderer.domElement);
    renderer.domElement.className = 'earth-canvas';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const sun = new THREE.Vector3(0.6, 0.6, 0.55).normalize();
    const uniforms = {
      uDay: { value: null as THREE.Texture | null },
      uWater: { value: null as THREE.Texture | null },
      uSun: { value: sun },
      uReady: { value: 0 },
    };
    let loaded = 0;
    const loader = new THREE.TextureLoader();
    (['uDay', 'uWater'] as const).forEach((k) =>
      loader.load(
        k === 'uDay' ? '/textures/earth-day.jpg' : '/textures/earth-water.jpg',
        (t) => {
          t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          uniforms[k].value = t;
          loaded++;
        },
        undefined,
        () => onFail?.(),
      ),
    );

    const globe = new THREE.Group();
    globe.rotation.order = 'XYZ';
    scene.add(globe);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 128), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: earthFrag, uniforms, transparent: true }));
    globe.add(earth);
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.08, 64, 64), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: atmoFrag, side: THREE.BackSide, transparent: true, depthWrite: false })));

    /* Routes: arcs + flying planes, rebuilt when stops change */
    const routeGroup = new THREE.Group();
    globe.add(routeGroup);
    let flights: { curve: THREE.CatmullRomCurve3; plane: THREE.Mesh; phase: number; speed: number }[] = [];
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x001489, transparent: true, opacity: 0.9 });
    const rebuildRoutes = (s: EarthStop[]) => {
      routeGroup.children.slice().forEach((c) => {
        routeGroup.remove(c);
        (c as THREE.Mesh).geometry?.dispose();
      });
      flights = [];
      const real = s.filter((x) => !x.pending);
      for (let i = 1; i < real.length; i++) {
        const curve = arcCurve(real[i - 1], real[i]);
        routeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.0035, 6, false), arcMat));
        const plane = planeMesh();
        routeGroup.add(plane);
        flights.push({ curve, plane, phase: (i * 0.37) % 1, speed: 0.0028 / Math.max(0.4, curve.getLength()) });
      }
    };

    /* HTML labels — curated markers (clickable) and numbered stops */
    const labelBox = labelsRef.current!;
    labelBox.innerHTML = '';
    type Pin = { node: HTMLElement; v: THREE.Vector3 };
    const markerPins = markers.map((m) => {
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'earth-pin';
      node.setAttribute('aria-label', `Add ${m.name}`);
      node.innerHTML = `<span class="earth-pin-dot"></span><span class="earth-pin-name">${m.name}</span>`;
      node.addEventListener('click', (e) => {
        e.stopPropagation();
        live.current.onMarker?.(m);
      });
      labelBox.appendChild(node);
      return { node, v: toVec(m.lat, m.lng, 1.004), name: m.name };
    });
    let stopPins: Pin[] = [];
    let pins: Pin[] = [...markerPins];
    const rebuildStops = (s: EarthStop[]) => {
      stopPins.forEach((p) => p.node.remove());
      stopPins = s.map((st, i) => {
        const node = document.createElement('div');
        node.className = `earth-stop ${st.pending ? 'is-pending' : ''}`;
        node.innerHTML = `<span class="earth-stop-n">${st.pending ? '·' : i + 1}</span><span class="earth-stop-name">${st.pending ? 'Locating…' : st.name.replace(/</g, '&lt;')}</span>`;
        labelBox.appendChild(node);
        return { node, v: toVec(st.lat, st.lng, 1.006) };
      });
      markerPins.forEach((mp) => mp.node.classList.toggle('is-used', s.some((st) => st.name === mp.name)));
      pins = [...markerPins, ...stopPins];
      rebuildRoutes(s);
    };
    rebuildStops(live.current.stops);
    api.current = { setStops: rebuildStops };

    const start = facing(28, 40);
    const cur = { x: start.x, y: start.y, dist: 4.6 };
    const target = { x: start.x, y: start.y };
    let userZoom = 0;
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let idle = 0;
    let lastInteract = 0;
    let w = 0;
    let h = 0;
    let minDist = 4.4;

    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      const halfV = (camera.fov * DEG) / 2;
      const halfH = Math.atan(Math.tan(halfV) * camera.aspect);
      minDist = 1.12 / Math.sin(Math.min(halfV, halfH));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '120px' });
    io.observe(el);

    const tmp = new THREE.Vector3();
    const tan = new THREE.Vector3();
    const up = new THREE.Vector3();
    const mat = new THREE.Matrix4();
    let raf = 0;
    let lastT = performance.now();
    let lastFocusKey = '';

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(64, t - lastT) / 16.67;
      lastT = t;
      if (!visible) return;
      if (loaded === 2 && uniforms.uReady.value < 1) uniforms.uReady.value = Math.min(1, uniforms.uReady.value + 0.04 * dt);

      const { focus: f, zoom: z, autoRotate: spin } = live.current;
      const fk = f ? `${f.lat.toFixed(3)},${f.lng.toFixed(3)}` : '';
      if (!dragging) {
        if (f && fk !== lastFocusKey) {
          const g = facing(f.lat, f.lng);
          let ty = g.y;
          while (ty - cur.y > Math.PI) ty -= Math.PI * 2;
          while (ty - cur.y < -Math.PI) ty += Math.PI * 2;
          target.y = ty;
          target.x = g.x * 0.85;
          lastFocusKey = fk;
        } else if (spin && !reduce && t - lastInteract > 3500) {
          idle = Math.min(1, idle + 0.01 * dt);
          target.y += 0.0011 * dt * idle;
        }
      }
      if (!f) lastFocusKey = '';
      const k = 1 - Math.pow(1 - 0.07, dt);
      cur.x += (target.x - cur.x) * k;
      cur.y += (target.y - cur.y) * k;
      const base = Math.max(minDist * 1.04, 4.2);
      const want = Math.max(1.55, base * (1 - 0.3 * z) - userZoom);
      cur.dist += (want - cur.dist) * k;
      globe.rotation.set(cur.x, cur.y, 0);
      camera.position.set(0, 0, cur.dist);

      for (const fl of flights) {
        fl.phase = (fl.phase + fl.speed * dt) % 1;
        fl.curve.getPointAt(fl.phase, tmp);
        fl.curve.getTangentAt(fl.phase, tan);
        fl.plane.position.copy(tmp);
        up.copy(tmp).normalize();
        // shape's +Y = nose → tangent, shape's normal (+Z) → away from the earth
        mat.makeBasis(new THREE.Vector3().crossVectors(tan, up).normalize(), tan.normalize(), up);
        fl.plane.quaternion.setFromRotationMatrix(mat);
      }
      renderer.render(scene, camera);

      for (const p of pins) {
        tmp.copy(p.v).applyEuler(globe.rotation);
        const front = tmp.z;
        tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * w;
        const y = (-tmp.y * 0.5 + 0.5) * h;
        const vis = Math.max(0, Math.min(1, (front - 0.08) * 6)) * uniforms.uReady.value;
        p.node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        p.node.style.opacity = String(vis);
        p.node.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
      }
    };
    raf = requestAnimationFrame(frame);

    const canvas = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const down = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteract = performance.now();
      idle = 0;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      const s = 0.005 * (cur.dist / 4.4);
      target.y += dx * s;
      target.x = Math.max(-1.25, Math.min(1.25, target.x + dy * s * 0.8));
      lastX = e.clientX;
      lastY = e.clientY;
      lastInteract = performance.now();
    };
    const upH = (e: PointerEvent) => {
      if (dragging && moved < 6 && live.current.onPick) {
        const r = canvas.getBoundingClientRect();
        raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const hit = raycaster.intersectObject(earth)[0];
        if (hit) live.current.onPick(toLatLng(globe.worldToLocal(hit.point.clone())));
      }
      dragging = false;
    };
    const cancel = () => (dragging = false);
    const wheel = (e: WheelEvent) => {
      if (!wheelZoom) return;
      e.preventDefault();
      userZoom = Math.max(-0.8, Math.min(2.4, userZoom - e.deltaY * 0.0025));
      lastInteract = performance.now();
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', upH);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('wheel', wheel, { passive: false });
    el.__zoom = (d: number) => {
      userZoom = Math.max(-0.8, Math.min(2.4, userZoom + d));
      lastInteract = performance.now();
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', upH);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('wheel', wheel);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
      uniforms.uDay.value?.dispose();
      uniforms.uWater.value?.dispose();
      renderer.dispose();
      canvas.remove();
      labelBox.innerHTML = '';
      api.current = null;
      delete el.__zoom;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, wheelZoom]);

  // Stops change without rebuilding the scene.
  useEffect(() => {
    api.current?.setStops(stops);
  }, [stops]);

  return (
    <div ref={wrap} className="earth" role="application" aria-label="Interactive globe — drag to rotate, click to drop a stop">
      <div ref={labelsRef} className="earth-labels" />
    </div>
  );
}

/** Zoom the Earth inside `container` by `delta` (positive = closer). */
export function zoomEarth(container: HTMLElement | null, delta: number) {
  (container?.querySelector('.earth') as ZoomEl | null)?.__zoom?.(delta);
}

export default Earth;
