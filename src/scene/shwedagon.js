import * as THREE from 'three';
import { makeGlowPoints, mulberry32 } from '../util/common.js';
import { LAYOUT } from './city.js';

const goldVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const goldFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uCam;
  uniform float uBright;
  uniform float uBaseY;
  uniform float uHeight;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vW;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(uCam - vW);
    // floodlights: mostly from the river side, plus a cooler fill from behind
    vec3 L1 = normalize(vec3(0.35, 0.3, 1.0));
    vec3 L2 = normalize(vec3(-0.9, 0.25, -0.4));
    float diff = max(dot(n, L1), 0.0) * 0.75 + max(dot(n, L2), 0.0) * 0.3 + 0.28;
    float spec = pow(max(dot(reflect(-L1, n), v), 0.0), 16.0);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float h = clamp((vW.y - uBaseY) / uHeight, 0.0, 1.0);
    float flood = mix(1.0, 0.85, h); // lamps at the base light the lower body most
    vec3 col = uColor * diff * flood * uBright;
    col += vec3(1.0, 0.86, 0.55) * spec * 0.5 * uBright;
    col += uColor * rim * 0.45 * uBright;
    // tiny gold-leaf glints that come and go
    float g = hash(floor(vW * 1.3));
    col += vec3(1.0, 0.9, 0.65) * pow(max(0.0, sin(uTime * (0.6 + g * 2.0) + g * 40.0)), 60.0) * step(0.94, g) * 1.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Stupa profile (radius, height) normalised to total height 1 — terraces, bell, bands, lotus, banana bud, hti. */
const PROFILE = [
  [0.0, 0.0], [0.3, 0.0], [0.3, 0.03], [0.27, 0.03], [0.27, 0.06], [0.24, 0.06], [0.24, 0.09],
  [0.22, 0.09], [0.215, 0.15], [0.2, 0.22], [0.178, 0.29], [0.15, 0.35], [0.122, 0.395], [0.11, 0.41],
  [0.118, 0.41], [0.118, 0.44], [0.098, 0.44], [0.098, 0.47], [0.083, 0.47], [0.083, 0.5],
  [0.088, 0.5], [0.08, 0.525], [0.07, 0.55], // lotus petals
  [0.064, 0.56], [0.058, 0.61], [0.047, 0.67], [0.034, 0.74], [0.02, 0.81], [0.012, 0.84], // banana bud
  [0.03, 0.845], [0.03, 0.86], [0.014, 0.86], [0.024, 0.875], [0.024, 0.885], [0.011, 0.885],
  [0.018, 0.9], [0.018, 0.908], [0.008, 0.908], [0.006, 0.95], [0.0, 0.955], // hti umbrella
];

function stupaGeometry(segments = 48) {
  const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, segments);
}

/**
 * A Shwedagon-style night landmark: wooded hill, terrace platform, the great golden stupa,
 * a ring of smaller stupas, lit covered stairways and a sparkling diamond orb.
 */
export function createShwedagon() {
  const { x: X, z: Z } = LAYOUT.shwedagon;
  const base = LAYOUT.bankHeight;
  const HILL = 80, PLAT = 8, H = 260;
  const topY = base + HILL + PLAT;
  const group = new THREE.Group();
  const rnd = mulberry32(1372);

  const materials = [];
  const goldMat = (color, bright, baseY, height) => {
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uCam: { value: new THREE.Vector3() },
        uBright: { value: bright },
        uBaseY: { value: baseY },
        uHeight: { value: height },
        uTime: { value: 0 },
      },
      vertexShader: goldVertex,
      fragmentShader: goldFragment,
    });
    materials.push(m);
    return m;
  };

  // Hill (Singuttara-style) and platform
  const hill = new THREE.Mesh(
    new THREE.CylinderGeometry(165, 270, HILL, 40, 1),
    new THREE.MeshBasicMaterial({ color: 0x050806 })
  );
  hill.position.set(X, base + HILL / 2, Z);
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(160, 165, PLAT, 8, 1),
    goldMat('#5a4a36', 0.35, base + HILL, PLAT)
  );
  platform.position.set(X, base + HILL + PLAT / 2, Z);
  platform.rotation.y = Math.PI / 8;
  group.add(hill, platform);

  // Main stupa
  const geo = stupaGeometry(56);
  const main = new THREE.Mesh(geo, goldMat('#ffa62b', 0.55, topY, H));
  main.scale.set(H, H, H);
  main.position.set(X, topY, Z);
  group.add(main);

  // Ring of smaller stupas (most gilded, a few white-washed)
  const smallGold = goldMat('#ffa62b', 0.5, topY, 50);
  const smallWhite = goldMat('#e8e2d6', 0.45, topY, 50);
  const smallGeo = stupaGeometry(20);
  const nRing = 28;
  for (let i = 0; i < nRing; i++) {
    const a = (i / nRing) * Math.PI * 2 + 0.06;
    const r = 118 + (i % 2) * 18;
    const s = (i % 7 === 0 ? 62 : 34) + rnd() * 10;
    const m = new THREE.Mesh(smallGeo, rnd() < 0.2 ? smallWhite : smallGold);
    m.scale.set(s, s, s);
    m.position.set(X + Math.cos(a) * r, topY, Z + Math.sin(a) * r);
    group.add(m);
  }

  // Lights: platform edge, covered stairways, floodlights, diamond-orb sparkle
  const P = [], C = [], S = [], B = [];
  const add = (x, y, z, c, s, blink = -1) => { P.push(x, y, z); C.push(c[0], c[1], c[2]); S.push(s); B.push(blink); };
  const warm = [1.0, 0.55, 0.2];
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2;
    add(X + Math.cos(a) * 162, topY + 1, Z + Math.sin(a) * 162, warm, 1.6);
  }
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    for (let j = 0; j <= 36; j++) {
      const t = j / 36;
      const r = 300 - t * 135;
      const y = base + 4 + t * (HILL - 2) + 6;
      [-7, 7].forEach((o) => add(X + dx * r + px * o, y, Z + dz * r + pz * o, warm, 1.5));
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add(X + Math.cos(a) * 96, topY + 2, Z + Math.sin(a) * 96, [0.9, 0.65, 0.4], 3.5);
  }
  const orbY = topY + 0.965 * H;
  add(X, orbY, Z, [2.2, 2.2, 2.2], 5);
  const gem = [[2, 0.3, 0.3], [0.3, 2, 0.6], [0.4, 0.6, 2.2], [2, 2, 2], [2, 1.2, 0.3]];
  for (let i = 0; i < 10; i++) {
    const a = rnd() * Math.PI * 2;
    add(X + Math.cos(a) * 2.5, orbY + (rnd() - 0.5) * 4, Z + Math.sin(a) * 2.5, gem[i % gem.length], 3.2, rnd() * 6);
  }
  const lights = makeGlowPoints(P, C, S, B);
  group.add(lights);

  return {
    group,
    update(t, camera) {
      materials.forEach((m) => {
        m.uniforms.uCam.value.copy(camera.position);
        m.uniforms.uTime.value = t;
      });
    },
  };
}
