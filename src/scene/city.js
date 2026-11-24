import * as THREE from 'three';
import { mulberry32, makeGlowPoints } from '../util/common.js';
import { HORIZON } from './sky.js';

/** World layout (units ≈ meters). The river runs along X between these Z values. */
export const LAYOUT = {
  cityBankZ: -32, // edge of the city side
  nearBankZ: 172, // edge of the spectator side
  bankHeight: 1.5,
  park: { x0: -115, x1: 115, z0: -235, z1: -36 }, // open plaza where drones launch
  bridgeX: -430,
  shwedagon: { x: -430, z: -760, clear: 290 }, // hill with the great golden stupa
};

/** Keep the view from the riverbank to the stupa open: buildings in that corridor stay low. */
function corridorCap(x, z) {
  const cam = { x: 0, y: 7, z: 215 };
  const { x: sx, z: sz } = LAYOUT.shwedagon;
  const t = (z - cam.z) / (sz - cam.z);
  if (t <= 0 || t >= 1) return Infinity;
  const lineX = cam.x + (sx - cam.x) * t;
  if (Math.abs(x - lineX) > 110 * t + 25) return Infinity;
  return cam.y + (100 - cam.y) * t; // stays below the line of sight to the upper platform
}

const buildingVertex = /* glsl */ `
  attribute float aSeed;
  varying vec3 vLocal;
  varying vec3 vScale;
  varying vec3 vN;
  varying float vSeed;
  varying float vDist;
  void main() {
    vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
    vLocal = position;
    vN = normal;
    vSeed = aSeed;
    vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const buildingFragment = /* glsl */ `
  uniform vec3 uFog;
  uniform float uTime;
  varying vec3 vLocal;
  varying vec3 vScale;
  varying vec3 vN;
  varying float vSeed;
  varying float vDist;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 base = vec3(0.018, 0.022, 0.04) * (0.7 + 0.6 * hash(vec2(vSeed, 1.3)));
    vec3 col = base;
    if (abs(vN.y) < 0.5) {
      float u = abs(vN.x) > 0.5 ? vLocal.z * vScale.z : vLocal.x * vScale.x;
      float v = vLocal.y * vScale.y;
      vec2 cell = vec2(u / 3.0, v / 3.6);
      vec2 id = floor(cell);
      vec2 f = fract(cell);
      float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.22, f.y) * step(f.y, 0.78);
      float style = hash(vec2(vSeed, 7.1));
      float r = hash(id + vSeed * 13.7 + vN.xz * 5.3);
      float litThreshold = mix(0.45, 0.8, style);
      float lit = step(litThreshold, r);
      // a few windows slowly switch on/off
      float slow = hash(id + 91.0 + vSeed);
      if (slow > 0.985) lit = step(0.0, sin(uTime * 0.2 + slow * 60.0));
      float h = hash(id * 1.37 + vSeed);
      vec3 warm = vec3(1.0, 0.62, 0.28);
      vec3 cool = vec3(0.55, 0.75, 1.0);
      vec3 wc = mix(warm, cool, step(0.72, h)) * (0.25 + 0.45 * hash(id + 3.7));
      col += win * lit * wc;
      col += win * (1.0 - lit) * vec3(0.01, 0.014, 0.025);
      // warm street glow at the base
      col += vec3(0.35, 0.16, 0.06) * exp(-v * 0.12) * 0.25;
    } else {
      col *= 0.7;
    }
    float fog = smoothstep(250.0, 1700.0, vDist);
    col = mix(col, uFog * 0.9, fog);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createCity() {
  const group = new THREE.Group();
  const rnd = mulberry32(2024);
  const { park } = LAYOUT;

  // ---- Ground on both banks ----
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x06070c });
  const cityGround = new THREE.Mesh(new THREE.BoxGeometry(5200, 4, 2600), groundMat);
  cityGround.position.set(0, LAYOUT.bankHeight - 2, LAYOUT.cityBankZ - 1300);
  const nearGround = new THREE.Mesh(new THREE.BoxGeometry(5200, 4, 1400), groundMat);
  nearGround.position.set(0, LAYOUT.bankHeight - 2, LAYOUT.nearBankZ + 700);
  const plaza = new THREE.Mesh(
    new THREE.PlaneGeometry(park.x1 - park.x0, park.z1 - park.z0),
    new THREE.MeshBasicMaterial({ color: 0x0b0d16 })
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set((park.x0 + park.x1) / 2, LAYOUT.bankHeight + 0.05, (park.z0 + park.z1) / 2);
  group.add(cityGround, nearGround, plaza);

  // ---- Buildings (instanced boxes with procedural windows) ----
  const lots = [];
  const BLOCK = 62, STREET = 14;
  for (let bx = -1700; bx < 1700; bx += BLOCK + STREET) {
    for (let bz = LAYOUT.cityBankZ - 14; bz > -1700; bz -= BLOCK + STREET) {
      const x0 = bx, x1 = bx + BLOCK, z1 = bz, z0 = bz - BLOCK;
      if (x1 > park.x0 && x0 < park.x1 && z0 < park.z1 && z1 > park.z0) continue; // keep plaza open
      if (Math.abs((x0 + x1) / 2 - LAYOUT.bridgeX) < 30 && z1 > -120) continue; // bridge approach
      const split = rnd() < 0.35 ? 3 : 2;
      const lw = BLOCK / split;
      for (let i = 0; i < split; i++) {
        for (let j = 0; j < split; j++) {
          if (rnd() < 0.08) continue;
          const cx = x0 + lw * (i + 0.5);
          const cz = z0 + lw * (j + 0.5);
          const sw = LAYOUT.shwedagon;
          if (Math.hypot(cx - sw.x, cz - sw.z) < sw.clear) continue; // pagoda hill and its grounds
          const dist = Math.hypot(cx * 0.9, (cz + 470) * 1.1);
          const downtown = Math.exp(-Math.pow(dist / 380, 2));
          let h = 10 + rnd() * 22 + 230 * downtown * Math.pow(rnd(), 1.5);
          if (Math.abs(cx) > 1100 || cz < -1200) h *= 0.6;
          // keep the airspace right above the plaza readable
          if (Math.abs(cx) < 220 && cz > -330) h = Math.min(h, 55 + rnd() * 30);
          h = Math.min(h, Math.max(8, corridorCap(cx, cz)));
          const w = lw * (0.62 + rnd() * 0.3);
          const d = lw * (0.62 + rnd() * 0.3);
          lots.push({ x: cx, z: cz, w, d, h });
        }
      }
    }
  }
  // A few landmark towers downtown
  [[-140, -520, 300], [90, -600, 340], [260, -470, 260], [-720, -500, 280]].forEach(([x, z, h]) =>
    lots.push({ x, z, w: 34, d: 34, h })
  );

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const seeds = new Float32Array(lots.length);
  const buildingMat = new THREE.ShaderMaterial({
    uniforms: { uFog: { value: HORIZON }, uTime: { value: 0 } },
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
  });
  const buildings = new THREE.InstancedMesh(boxGeo, buildingMat, lots.length);
  const m = new THREE.Matrix4();
  lots.forEach((b, i) => {
    m.makeScale(b.w, b.h, b.d);
    m.setPosition(b.x, LAYOUT.bankHeight, b.z);
    buildings.setMatrixAt(i, m);
    seeds[i] = rnd() * 100;
  });
  boxGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  buildings.frustumCulled = false;
  group.add(buildings);

  // ---- Static lights: promenades, bridge, aviation beacons ----
  const P = [], C = [], S = [], B = [];
  const add = (x, y, z, col, size, blink = -1) => {
    P.push(x, y, z); C.push(col.r, col.g, col.b); S.push(size); B.push(blink);
  };
  const warm = new THREE.Color(1.0, 0.55, 0.22).multiplyScalar(0.9);
  const cool = new THREE.Color(0.45, 0.7, 1.0);
  const red = new THREE.Color(1.0, 0.05, 0.02);

  for (let x = -1600; x <= 1600; x += 12) {
    add(x, LAYOUT.bankHeight + 4, LAYOUT.cityBankZ - 3, warm, 1.6);
    add(x + 6, LAYOUT.bankHeight + 4, LAYOUT.nearBankZ + 4, warm, 1.4);
  }

  // Bridge
  const bx = LAYOUT.bridgeX;
  const deckY = 11;
  const z0 = LAYOUT.cityBankZ - 30, z1 = LAYOUT.nearBankZ + 30;
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x080a12 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 2.5, z1 - z0), darkMat);
  deck.position.set(bx, deckY, (z0 + z1) / 2);
  group.add(deck);
  const towers = [20, 120];
  towers.forEach((tz) => {
    [-8, 8].forEach((dx) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(2.5, 60, 2.5), darkMat);
      t.position.set(bx + dx, deckY + 30, tz);
      group.add(t);
      add(bx + dx, deckY + 61, tz, red, 2.4, rnd() * 6);
    });
  });
  for (let z = z0; z <= z1; z += 6) {
    add(bx - 9, deckY + 2, z, warm, 1.3);
    add(bx + 9, deckY + 2, z, warm, 1.3);
  }
  // Cable lights (parabolas between and beyond towers)
  const cable = (za, zb, ya, yb, sag) => {
    for (let k = 0; k <= 30; k++) {
      const t = k / 30;
      const z = za + (zb - za) * t;
      const y = ya + (yb - ya) * t - sag * 4 * t * (1 - t);
      add(bx - 8, y, z, cool, 1.1);
      add(bx + 8, y, z, cool, 1.1);
    }
  };
  cable(towers[0], towers[1], deckY + 60, deckY + 60, 45);
  cable(z0 + 5, towers[0], deckY + 3, deckY + 60, -6);
  cable(towers[1], z1 - 5, deckY + 60, deckY + 3, -6);

  // Aviation beacons on tall buildings
  lots.forEach((b) => {
    if (b.h > 140) add(b.x, LAYOUT.bankHeight + b.h + 1.5, b.z, red, 3.2, rnd() * 6);
  });

  const lights = makeGlowPoints(P, C, S, B);
  group.add(lights);

  return {
    group,
    update(t) {
      buildingMat.uniforms.uTime.value = t;
    },
  };
}
