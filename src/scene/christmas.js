import * as THREE from 'three';
import { glowUniforms, mulberry32 } from '../util/common.js';
import { LAYOUT } from './city.js';

// ---------- twinkling bulbs (tree lights, rooftop string lights) ----------
const twinkleVertex = /* glsl */ `
  attribute vec3 color;
  attribute float aSize;
  attribute float aPhase;
  uniform float uScale;
  uniform float uPixelRatio;
  uniform float uTime;
  varying vec3 vColor;
  varying float vB;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // gentle twinkle; phases < 0 stay steady
    vB = aPhase < 0.0 ? 1.0 : 0.45 + 0.55 * (0.5 + 0.5 * sin(uTime * (1.6 + fract(aPhase) * 2.5) + aPhase * 6.0));
    vColor = color;
    gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 40.0) * uPixelRatio;
  }
`;
const twinkleFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vB;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = (smoothstep(0.45, 0.0, d) * 1.3 + exp(-d * d * 5.0) * 0.5) * vB;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export function makeTwinklePoints(pos, col, size, phase) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: glowUniforms,
    vertexShader: twinkleVertex,
    fragmentShader: twinkleFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
}

const BULBS = [
  [1.6, 0.12, 0.08], // red
  [0.2, 1.3, 0.35], // green
  [1.7, 1.15, 0.3], // gold
  [0.3, 0.55, 1.7], // blue
  [1.5, 1.45, 1.3], // warm white
];

// ---------- snow ----------
function createSnow(count) {
  const rnd = mulberry32(2512);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const box = { x0: -750, x1: 750, y0: 0, y1: 620, z0: -800, z1: 270 };
  for (let i = 0; i < count; i++) {
    pos[i * 3] = box.x0 + rnd() * (box.x1 - box.x0);
    pos[i * 3 + 1] = box.y0 + rnd() * (box.y1 - box.y0);
    // more flakes close to the viewer so the snowfall reads in the foreground
    pos[i * 3 + 2] = box.z1 - Math.pow(rnd(), 1.8) * (box.z1 - box.z0);
    seed[i] = rnd();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: glowUniforms.uScale, uPixelRatio: glowUniforms.uPixelRatio },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime, uScale, uPixelRatio;
      varying float vA;
      void main() {
        vec3 p = position;
        float speed = 7.0 + aSeed * 7.0;
        p.y = mod(p.y - uTime * speed, ${(box.y1 - box.y0).toFixed(1)}) + ${box.y0.toFixed(1)};
        p.x += sin(uTime * (0.4 + aSeed) + aSeed * 40.0) * (4.0 + aSeed * 6.0);
        p.z += cos(uTime * (0.3 + aSeed * 0.7) + aSeed * 20.0) * 3.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.1 + aSeed * 1.4) * uScale / -mv.z, 1.0, 9.0) * uPixelRatio;
        vA = 0.55 + 0.35 * aSeed;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float a = smoothstep(1.0, 0.2, d) * vA;
        gl_FragColor = vec4(vec3(0.82, 0.88, 1.0) * a * 0.75, a);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return { points: pts, material: m };
}

// ---------- giant Christmas tree on the hill site ----------
function createGiantTree() {
  const { x: X, z: Z } = LAYOUT.shwedagon;
  const base = LAYOUT.bankHeight;
  const H = 300, R = 95;
  const group = new THREE.Group();
  const rnd = mulberry32(1225);

  const green = new THREE.MeshBasicMaterial({ color: 0x07200f });
  const tiers = 6;
  for (let k = 0; k < tiers; k++) {
    const t0 = k / tiers;
    const h = (H * 0.9) / tiers * 1.7;
    const r = R * (1 - t0 * 0.82);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24, 1, true), green);
    cone.position.set(X, base + 18 + t0 * H * 0.85 + h / 2, Z);
    group.add(cone);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 22, 12), new THREE.MeshBasicMaterial({ color: 0x1c1008 }));
  trunk.position.set(X, base + 11, Z);
  group.add(trunk);

  const pos = [], col = [], size = [], phase = [];
  const radiusAt = (y) => R * (1 - (y - 18) / (H - 4)) * 1.02 + 1.5;
  // three spiral garlands of bulbs
  for (let s = 0; s < 3; s++) {
    const n = 260;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const y = 22 + t * (H - 30);
      const a = t * Math.PI * 2 * 6 + (s * Math.PI * 2) / 3;
      const r = Math.max(2, radiusAt(y));
      pos.push(X + Math.cos(a) * r, base + y, Z + Math.sin(a) * r);
      const c = BULBS[(i + s * 2) % BULBS.length];
      col.push(c[0], c[1], c[2]);
      size.push(2.6);
      phase.push(rnd() * 10);
    }
  }
  // big ornaments
  for (let i = 0; i < 70; i++) {
    const y = 26 + rnd() * (H - 60);
    const a = rnd() * Math.PI * 2;
    const r = Math.max(2, radiusAt(y) * 0.98);
    pos.push(X + Math.cos(a) * r, base + y, Z + Math.sin(a) * r);
    const c = BULBS[(Math.random() * 4) | 0];
    col.push(c[0] * 0.9, c[1] * 0.9, c[2] * 0.9);
    size.push(5.5);
    phase.push(-1);
  }
  // star on top (a five-point outline facing the river) + bright core
  const sy = base + H + 14;
  for (let k = 0; k < 10; k++) {
    const r1 = k % 2 ? 8 : 20, r2 = (k + 1) % 2 ? 8 : 20;
    const a1 = -Math.PI / 2 + (k * Math.PI) / 5, a2 = -Math.PI / 2 + ((k + 1) * Math.PI) / 5;
    for (let j = 0; j < 6; j++) {
      const t = j / 6;
      const px = Math.cos(a1) * r1 * (1 - t) + Math.cos(a2) * r2 * t;
      const py = Math.sin(a1) * r1 * (1 - t) + Math.sin(a2) * r2 * t;
      pos.push(X + px, sy - py, Z + 4);
      col.push(1.9, 1.4, 0.45);
      size.push(3.2);
      phase.push(-1);
    }
  }
  pos.push(X, sy, Z + 4); col.push(2.6, 2.2, 1.2); size.push(26); phase.push(-1);
  // a ring of warm lamps around the tree
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * Math.PI * 2;
    pos.push(X + Math.cos(a) * 150, base + 3, Z + Math.sin(a) * 150);
    col.push(1.2, 0.7, 0.3); size.push(2); phase.push(-1);
  }
  group.add(makeTwinklePoints(pos, col, size, phase));
  return group;
}

// ---------- colored string lights along rooftops ----------
export function createRoofLights(lots, bulbs = BULBS) {
  const rnd = mulberry32(2412);
  const pos = [], col = [], size = [], phase = [];
  const MAX = 5200;
  const sorted = lots
    .filter((b) => b.z > -900 && b.h > 18 && Math.hypot(b.x - LAYOUT.shwedagon.x, b.z - LAYOUT.shwedagon.z) > 200)
    .sort((a, b) => b.z - a.z); // riverfront first
  for (const b of sorted) {
    if (rnd() < 0.45) continue;
    const y = LAYOUT.bankHeight + b.h + 0.6;
    const hw = b.w / 2, hd = b.d / 2;
    const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]];
    const palette = rnd() < 0.3 ? null : bulbs[(rnd() * bulbs.length) | 0]; // some buildings one color, others multicolor
    let k = 0;
    for (let e = 0; e < 4; e++) {
      const [ax, az] = corners[e], [bx, bz] = corners[e + 1];
      const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 3.2));
      for (let j = 0; j < n; j++) {
        const t = j / n;
        pos.push(b.x + ax + (bx - ax) * t, y, b.z + az + (bz - az) * t);
        const c = palette || bulbs[k % bulbs.length];
        col.push(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8);
        size.push(1.5);
        phase.push(rnd() * 10);
        k++;
      }
    }
    if (pos.length / 3 > MAX) break;
  }
  return makeTwinklePoints(pos, col, size, phase);
}

/** Christmas scenery: snowfall, rooftop string lights and a giant lit tree where the stupa stands. */
export function createChristmasScene(lots, { mobile = false } = {}) {
  const snow = createSnow(mobile ? 1800 : 4200);
  const decor = new THREE.Group();
  decor.add(createGiantTree(), createRoofLights(lots));
  return {
    snow: snow.points,
    decor,
    update(t) {
      snow.material.uniforms.uTime.value = t;
    },
  };
}
