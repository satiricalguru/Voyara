import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { applyLivery } from './livery';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * A regional electric airliner in the spirit of the Heart ES-30: high wing, four props,
 * upswept tail cone, T-tail. Built procedurally (no model files). Nose points +Z, up is +Y.
 */

function shape(pts: [number, number][]) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([x, y]) => s.lineTo(x, y));
  s.closePath();
  return s;
}

/** Airfoil-ish slab: extruded planform, slightly rounded edges. */
function surface(pts: [number, number][], thickness: number) {
  const g = new THREE.ExtrudeGeometry(shape(pts), { depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.45, bevelSize: thickness * 0.6, bevelSegments: 3, curveSegments: 4 });
  g.translate(0, 0, -thickness / 2);
  return g;
}

export interface Aircraft {
  group: THREE.Group;
  props: THREE.Object3D[];
  dispose: () => void;
}

export function buildAircraft(): Aircraft {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const keep = <T extends THREE.BufferGeometry>(g: T) => (geos.push(g), g);

  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf3f5f8, roughness: 0.26, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 });
  const belly = new THREE.MeshPhysicalMaterial({ color: 0xc9d2dd, roughness: 0.38, metalness: 0.1, clearcoat: 0.6 });
  const livery = new THREE.MeshPhysicalMaterial({ color: 0x0b2a8f, roughness: 0.3, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1220, roughness: 0.05, metalness: 0.4, clearcoat: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa6b2, roughness: 0.25, metalness: 0.85 });
  const blade = new THREE.MeshStandardMaterial({ color: 0x2a3340, roughness: 0.6, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false });
  const blur = new THREE.MeshBasicMaterial({ color: 0xb8c4d1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const mats = [paint, belly, livery, glass, metal, blade, blur];

  /* Fuselage — lathe, then sculpted: rounded nose, upswept tail cone */
  const prof: [number, number][] = [
    [0.0, -2.25], [0.05, -2.22], [0.1, -2.12], [0.15, -1.95], [0.21, -1.65], [0.27, -1.25], [0.3, -0.85], [0.31, -0.4], [0.31, 0.6],
    [0.305, 1.1], [0.29, 1.45], [0.26, 1.72], [0.21, 1.93], [0.15, 2.07], [0.08, 2.16], [0.0, 2.2],
  ];
  const fus = keep(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 72));
  fus.rotateX(Math.PI / 2); // lathe Y → +Z (nose)
  const pos = fus.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    let y = pos.getY(i);
    if (z < -0.9) y += Math.pow((-0.9 - z) / 1.35, 2) * 0.3; // tail sweeps up
    if (z > 1.55) y -= Math.pow((z - 1.55) / 0.65, 2) * 0.06; // nose droops
    pos.setY(i, y * (y < 0 ? 0.94 : 1)); // slightly flatter belly
  }
  fus.computeVertexNormals();
  // Two-tone: white upper hull blending into a cool-grey belly.
  const cols = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0xf4f6f9);
  const low = new THREE.Color(0xc3cdd8);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep(pos.getY(i), -0.2, -0.05);
    c.copy(low).lerp(top, t);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  fus.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const hull = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.24, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 });
  mats.push(hull);
  group.add(new THREE.Mesh(fus, hull));

  // Belly fairing (darker), sits on the lower hull under the wing
  const fairing = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.17, 1.3, 8, 20)), belly);
  fairing.rotation.x = Math.PI / 2;
  fairing.scale.set(1.5, 1, 0.55);
  fairing.position.set(0, -0.23, -0.1);
  group.add(fairing);

  // Cockpit: a wrap-around windshield band that follows the nose surface (same sculpt as the hull).
  const radiusAt = (y: number) => {
    for (let i = 1; i < prof.length; i++) {
      const [r0, y0] = prof[i - 1];
      const [r1, y1] = prof[i];
      if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
    }
    return 0;
  };
  const wsProf: THREE.Vector2[] = [];
  for (let y = 1.66; y <= 1.9; y += 0.03) wsProf.push(new THREE.Vector2(radiusAt(y) + 0.004, y));
  const ws = keep(new THREE.LatheGeometry(wsProf, 48, Math.PI - 1.15, 2.3));
  ws.rotateX(Math.PI / 2);
  const wp = ws.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < wp.count; i++) {
    const z = wp.getZ(i);
    let y = wp.getY(i);
    if (z > 1.55) y -= Math.pow((z - 1.55) / 0.65, 2) * 0.06;
    wp.setY(i, y);
  }
  ws.computeVertexNormals();
  // keep only the upper band (the lathe arc spans the top of the nose)
  const windshield = new THREE.Mesh(ws, glass);
  windshield.position.y = 0.012;
  group.add(windshield);

  // Cabin windows
  const win = keep(new THREE.CapsuleGeometry(0.022, 0.03, 4, 8));
  const rows = new THREE.InstancedMesh(win, glass, 36);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) {
    const z = 1.32 - i * 0.135;
    m.makeTranslation(0.302, 0.06, z);
    rows.setMatrixAt(i, m);
    m.makeTranslation(-0.302, 0.06, z);
    rows.setMatrixAt(18 + i, m);
  }
  group.add(rows);

  /* High wing — long, gently tapered, mounted on top of the fuselage */
  const wingPlan: [number, number][] = [[0, 0.28], [2.8, 0.1], [2.86, -0.08], [0, -0.3]];
  for (const side of [1, -1]) {
    const g = keep(surface(wingPlan, 0.05));
    g.rotateX(-Math.PI / 2);
    const w = new THREE.Mesh(g, paint);
    w.position.set(0, 0.29, 0.12);
    w.scale.x = side;
    w.rotation.z = side * 0.025; // dihedral
    group.add(w);
    // wing-to-body fairing
  }
  const root = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.11, 0.5, 6, 16)), paint);
  root.rotation.x = Math.PI / 2;
  root.scale.set(2.4, 1, 0.75);
  root.position.set(0, 0.26, 0.05);
  group.add(root);

  /* Four nacelles with six-blade props */
  const props: THREE.Object3D[] = [];
  const nacGeo = keep(new THREE.CapsuleGeometry(0.085, 0.62, 8, 24));
  nacGeo.rotateX(Math.PI / 2);
  const spinGeo = keep(new THREE.ConeGeometry(0.07, 0.17, 24));
  spinGeo.rotateX(Math.PI / 2);
  const bladeGeo = keep(new THREE.BoxGeometry(0.03, 0.36, 0.008));
  bladeGeo.translate(0, 0.18, 0);
  const discGeo = keep(new THREE.RingGeometry(0.05, 0.38, 48));
  for (const x of [0.78, 1.62, -0.78, -1.62]) {
    const nac = new THREE.Group();
    nac.add(new THREE.Mesh(nacGeo, paint));
    const lip = new THREE.Mesh(keep(new THREE.TorusGeometry(0.08, 0.012, 8, 24)), metal);
    lip.position.z = 0.39;
    nac.add(lip);
    const prop = new THREE.Group();
    prop.add(new THREE.Mesh(spinGeo, paint));
    for (let b = 0; b < 6; b++) {
      const bl = new THREE.Mesh(bladeGeo, blade);
      bl.rotation.z = (b / 6) * Math.PI * 2;
      bl.rotation.y = 0.35; // pitch
      prop.add(bl);
    }
    const disc = new THREE.Mesh(discGeo, blur);
    prop.add(disc);
    prop.position.z = 0.48;
    nac.add(prop);
    props.push(prop);
    nac.position.set(x, 0.2 - Math.abs(x) * 0.012, 0.18);
    group.add(nac);
  }

  /* T-tail */
  const finG = keep(surface([[0, 0], [0.62, 0], [0.98, 1.0], [0.72, 1.02]], 0.045));
  finG.rotateY(Math.PI / 2); // shape +x → aft (−Z)
  const fin = new THREE.Mesh(finG, livery);
  fin.position.set(0, 0.22, -1.38);
  group.add(fin);
  for (const side of [1, -1]) {
    const g = keep(surface([[0, 0.08], [0.95, -0.06], [0.98, -0.24], [0, -0.3]], 0.035));
    g.rotateX(-Math.PI / 2);
    const h = new THREE.Mesh(g, paint);
    h.position.set(0, 1.23, -2.2);
    h.scale.x = side;
    group.add(h);
  }

  // Fin flash: a cream chevron (brand mark) on both sides of the fin
  const chev = keep(new THREE.ShapeGeometry(shape([[0, 0], [0.18, 0.14], [0, 0.28], [0.07, 0.14]])));
  for (const side of [1, -1]) {
    const c = new THREE.Mesh(chev, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    c.position.set(side * 0.03, 0.72, -1.95);
    c.rotation.y = side * (Math.PI / 2);
    group.add(c);
  }

  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return {
    group,
    props,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((mt) => mt.dispose());
    },
  };
}

/** Studio reflections so the clear-coat paint reads as real metal and lacquer. */
export function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

/* ── High-fidelity model: Boeing 777-200 (NASA Airborne Science Program 3D library) ─────── */

let airlinerTemplate: Promise<THREE.Group> | null = null;

/**
 * Loads, repaints and liveries the 777 exactly once; every view gets a cheap clone that shares
 * geometry, materials and textures (so the hero and the top-down reveal don't redo the work).
 */
export function preloadAirliner() {
  airlinerTemplate ??= buildAirlinerTemplate().catch((e) => {
    airlinerTemplate = null;
    throw e;
  });
  return airlinerTemplate;
}

export async function loadAirliner(): Promise<Aircraft> {
  const template = await preloadAirliner();
  return { group: template.clone(true), props: [], dispose: () => undefined }; // shared resources live for the session
}

async function buildAirlinerTemplate(url = '/models/b777.glb'): Promise<THREE.Group> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;
  const mats = new Set<THREE.Material>();

  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list as THREE.MeshPhysicalMaterial[]) {
      mats.add(m);
      if (/paint/i.test(m.name)) {
        m.map = null; // drop the NASA livery artwork…
        m.color.set(0xf4f6f9); // plain white — the secondary paint layer carried the agency insignia
        m.clearcoat = Math.max(m.clearcoat ?? 0, 0.8);
        m.clearcoatRoughness = 0.12;
        m.roughness = 0.3;
        m.needsUpdate = true;
      }
    }
  });

  // Normalise: centre, nose → +Z, span → 5.6 units.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const pivot = new THREE.Group();
  pivot.add(model);
  if (size.x > size.z * 1.15) pivot.rotation.y = Math.PI / 2; // length was along X
  pivot.scale.setScalar(5.6 / Math.max(size.x, size.z));
  const group = new THREE.Group();
  group.add(pivot);
  await applyLivery(group).catch(() => undefined);
  return group;
}
