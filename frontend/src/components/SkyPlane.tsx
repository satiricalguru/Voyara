import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildAircraft, loadAirliner, studioEnvironment, type Aircraft } from './aircraft';

type Mode = 'cruise' | 'topdown';

/**
 * Real-time render of the Voyara airliner.
 * - cruise: side-on, nose right, gliding left → right over the cloud photo; scroll carries it off-frame.
 * - topdown: seen from above, nose up, rising from the bottom edge as `progress` goes 0 → 1.
 */
export function SkyPlane({ progressRef, mode = 'cruise' }: { progressRef: { current: number }; mode?: Mode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(mode === 'cruise');

  // Don't spin up a second WebGL context until the section is about to scroll into view.
  useEffect(() => {
    if (near) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: '100% 0px' });
    io.observe(wrap.current!);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    const el = wrap.current!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.className = 'sky-canvas';

    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    scene.environmentIntensity = 0.5;
    const camera = new THREE.PerspectiveCamera(mode === 'cruise' ? 26 : 30, 1, 0.1, 200);

    // Golden-hour key from upper left (matches the photo), cool sky fill, soft bounce off the cloud deck.
    const key = new THREE.DirectionalLight(0xfff0dc, 3.1);
    key.position.set(-4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const sc = key.shadow.camera;
    sc.left = sc.bottom = -6;
    sc.right = sc.top = 6;
    sc.near = 1;
    sc.far = 40;
    scene.add(key);
    scene.add(key.target);
    scene.add(new THREE.HemisphereLight(0xcfe0f2, 0x7d8a9b, 0.75));
    const rim = new THREE.DirectionalLight(0xcfe0f5, 1.1);
    rim.position.set(6, -1, -6);
    scene.add(rim);

    // Nothing renders until the real 777 is ready (no stand-in flash); the procedural
    // airliner is only a fallback if the model can't load.
    let craft: Aircraft | null = null;
    const body = new THREE.Group(); // local attitude (pitch / roll)
    let disposed = false;
    let readyAt = 0; // entrance clock starts when the model appears
    const mount = async (a: Aircraft) => {
      if (disposed) return a.dispose();
      // Compile shaders off the main thread (KHR_parallel_shader_compile) before the first frame.
      a.group.visible = false;
      body.add(a.group);
      try {
        await renderer.compileAsync(scene, camera);
      } catch {
        /* older drivers: compile on first render */
      }
      if (disposed) return;
      a.group.visible = true;
      craft = a;
      readyAt = performance.now();
    };
    loadAirliner().then(mount).catch(() => mount(buildAircraft()));
    const rig = new THREE.Group(); // heading + position
    rig.add(body);
    scene.add(rig);

    let w = 0;
    let h = 0;
    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '100px' });
    io.observe(el);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const DIST = mode === 'cruise' ? 13 : 16;
    let p = 0;
    let raf = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const time = readyAt ? (t - readyAt) / 1000 : 0;
      p += (progressRef.current - p) * 0.09;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      if (!craft) return;
      for (const pr of craft.props) pr.rotation.z += reduce ? 0 : 0.42;

      const halfH = DIST * Math.tan((camera.fov * Math.PI) / 360);
      const halfW = halfH * camera.aspect;
      const narrow = w < 760;

      if (mode === 'cruise') {
        // Size: span ~46% of the frame on desktop, ~78% on phones.
        const scale = Math.min(1.25, (halfW * 2 * (narrow ? 0.78 : 0.46)) / 5.6);
        rig.scale.setScalar(scale);
        // Enter from the left, settle left of centre, drift right; scrolling flies it out to the right.
        const enter = reduce ? 1 : 1 - Math.pow(1 - Math.min(1, time / 2.2), 3);
        const drift = reduce ? 0 : Math.sin(time * 0.18) * halfW * 0.04 + Math.min(time, 30) * 0.01;
        const x = -halfW * 1.35 + enter * halfW * (narrow ? 1.35 : 1.18) + drift + p * halfW * 1.6;
        const y = (narrow ? halfH * 0.12 : halfH * 0.18) + Math.sin(time * 0.7) * 0.06 + p * halfH * 0.5;
        rig.position.set(x, y, 0);
        // Nose right and a touch toward camera (three-quarter), gentle pointer parallax.
        rig.rotation.set(0, Math.PI / 2 - 0.42 + pointer.x * 0.08, 0);
        body.rotation.set(-0.04 + pointer.y * 0.04 - p * 0.12, 0, 0.05 + Math.sin(time * 0.45) * 0.025 - pointer.x * 0.05);
        // Slightly above the flight level so the long wing reads in plan, like an air-to-air shot.
        camera.position.set(0, 2.6, DIST);
        camera.lookAt(0, 0.35, 0);
      } else {
        // Top-down: camera above, nose to the top of the screen, climbing in from below.
        const scale = Math.min(1.6, (halfW * 2 * (narrow ? 0.8 : 0.42)) / 5.6);
        rig.scale.setScalar(scale);
        const ease = 1 - Math.pow(1 - Math.min(1, p * 1.25), 3);
        rig.position.set(pointer.x * 0.15, 0, -halfH * 1.6 + ease * halfH * 1.55);
        rig.rotation.set(0, pointer.x * -0.05, 0);
        body.rotation.set(0, 0, Math.sin(time * 0.6) * 0.03);
        camera.position.set(0, DIST, 0);
        camera.up.set(0, 0, 1);
        camera.lookAt(0, 0, 0);
      }
      // keep the shadow frustum on the aircraft
      key.position.copy(rig.position).add(new THREE.Vector3(-4, 8, 5));
      key.target.position.copy(rig.position);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onMove);
      disposed = true;
      craft?.dispose();
      scene.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [progressRef, mode, near]);

  return <div ref={wrap} className="sky-plane" aria-hidden="true" />;
}

export default SkyPlane;
