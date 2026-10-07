import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

/**
 * Voyara gold livery — painted on as projected decals so it wraps the fuselage like real paint.
 * Typeface: Cormorant Garamond (a free, high-contrast calligraphic serif).
 */

const GOLD = 0xc9a04e;
const FONT = '"Cormorant Garamond", "Times New Roman", serif';

async function fontReady() {
  try {
    await document.fonts.load(`700 200px ${FONT}`);
  } catch {
    /* fall back to the serif stack */
  }
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function wordmark() {
  return canvasTexture(2048, 420, (g) => {
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 330px ${FONT}`;
    g.fillText('Voyara', 1024, 200);
  });
}

/** The tail emblem: a gold "V" flight-path monogram inside a fine ring. */
function emblem() {
  return canvasTexture(1024, 1024, (g) => {
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.lineWidth = 22;
    g.beginPath();
    g.arc(512, 512, 430, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 8;
    g.beginPath();
    g.arc(512, 512, 395, 0, Math.PI * 2);
    g.stroke();
    g.font = `italic 700 640px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('V', 512, 540);
    // swept contrail through the monogram
    g.lineWidth = 18;
    g.beginPath();
    g.moveTo(190, 700);
    g.quadraticCurveTo(520, 520, 860, 300);
    g.stroke();
  });
}

function goldMaterial(map: THREE.Texture) {
  return new THREE.MeshPhysicalMaterial({
    map,
    color: GOLD,
    metalness: 0.95,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    alphaTest: 0.35,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });
}

/**
 * DecalGeometry clips every triangle of its target. On a 130k-triangle airliner that froze the
 * page, so we hand it only the triangles within `radius` of the decal (a few hundred).
 */
function localPatch(mesh: THREE.Mesh, center: THREE.Vector3, radius: number) {
  const src = mesh.geometry;
  const pos = src.attributes.position as THREE.BufferAttribute;
  const nor = src.attributes.normal as THREE.BufferAttribute | undefined;
  const idx = src.index;
  const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
  const c = center.clone().applyMatrix4(inv);
  const scale = new THREE.Vector3().setFromMatrixScale(mesh.matrixWorld).x || 1;
  const r2 = (radius / scale) ** 2;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const outP: number[] = [];
  const outN: number[] = [];
  const v = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3;
    v.fromBufferAttribute(pos, a);
    if (v.distanceToSquared(c) > r2) continue;
    for (let k = 0; k < 3; k++) {
      const i = idx ? idx.getX(t * 3 + k) : t * 3 + k;
      outP.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      if (nor) outN.push(nor.getX(i), nor.getY(i), nor.getZ(i));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(outP, 3));
  if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(outN, 3));
  else g.computeVertexNormals();
  const patch = new THREE.Mesh(g);
  patch.matrixWorld.copy(mesh.matrixWorld);
  patch.matrix.copy(mesh.matrix);
  return patch;
}

/** Basis whose X runs along `along`, Y up, Z out of the surface — Euler for DecalGeometry. */
function orientation(along: THREE.Vector3, out: THREE.Vector3) {
  const z = out.clone().normalize();
  const x = along.clone().normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  x.crossVectors(y, z).normalize();
  return new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

/**
 * Applies the livery to an aircraft group whose nose points +Z and up is +Y.
 * Positions are found by ray-casting onto the real hull, so it fits any model.
 */
export async function applyLivery(root: THREE.Object3D) {
  await fontReady();
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const ray = new THREE.Raycaster();
  const hit = (from: THREE.Vector3, dir: THREE.Vector3) => {
    ray.set(from, dir.clone().normalize());
    return ray.intersectObjects(meshes, false)[0];
  };

  const wordTex = wordmark();
  const embTex = emblem();
  const wordMat = goldMaterial(wordTex);
  const embMat = goldMaterial(embTex);
  const added: THREE.Mesh[] = [];
  const yieldFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const project = async (mesh: THREE.Mesh, at: THREE.Vector3, rot: THREE.Euler, dims: THREE.Vector3, mat: THREE.Material) => {
    await yieldFrame(); // keep scrolling smooth while the livery is painted
    const g = new DecalGeometry(localPatch(mesh, at, dims.length() * 0.6), at, rot, dims);
    const d = new THREE.Mesh(g, mat);
    d.renderOrder = 2;
    // DecalGeometry is in world space; bring it back into the root's space.
    d.applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert());
    root.add(d);
    added.push(d);
  };

  // Wordmark: both sides, ahead of the wing, on the upper cabin above the window line.
  const len = size.z;
  const zWord = box.max.z - len * 0.31;
  const yWord = box.min.y + size.y * 0.405;
  for (const side of [1, -1]) {
    const h = hit(new THREE.Vector3(side * size.x, yWord, zWord), new THREE.Vector3(-side, 0, 0));
    if (!h) continue;
    // Read nose-to-tail on the visible (port) side, mirrored on starboard like real liveries.
    const along = new THREE.Vector3(0, 0, side > 0 ? -1 : 1);
    const rot = orientation(along, new THREE.Vector3(side, 0, 0));
    const w = len * 0.33;
    // Shallow projector so it only paints the near side of the hull.
    await project(h.object as THREE.Mesh, h.point, rot, new THREE.Vector3(w, w * 0.205, len * 0.035), wordMat);
  }

  // Tail emblem: both faces of the vertical fin.
  const zFin = box.min.z + len * 0.07;
  const yFin = box.max.y - size.y * 0.3;
  for (const side of [1, -1]) {
    const h = hit(new THREE.Vector3(side * size.x, yFin, zFin), new THREE.Vector3(-side, 0, 0));
    if (!h) continue;
    const along = new THREE.Vector3(0, 0, side > 0 ? -1 : 1);
    const rot = orientation(along, new THREE.Vector3(side, 0, 0));
    const s = size.y * 0.32;
    await project(h.object as THREE.Mesh, h.point, rot, new THREE.Vector3(s, s, len * 0.012), embMat);
  }

  return () => {
    added.forEach((d) => d.geometry.dispose());
    [wordMat, embMat].forEach((m) => m.dispose());
    [wordTex, embTex].forEach((t) => t.dispose());
  };
}
