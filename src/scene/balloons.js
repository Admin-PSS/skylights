import * as THREE from 'three';
import { makeGlowPoints } from '../util/common.js';
import { LAYOUT } from './city.js';

/** Envelope profile (radius, height), normalised to height 1 — an onion/teardrop shape, open at the mouth. */
const PROFILE = [
  [0.16, 0.0], [0.22, 0.06], [0.31, 0.16], [0.4, 0.28], [0.47, 0.41], [0.5, 0.55],
  [0.48, 0.68], [0.42, 0.8], [0.31, 0.9], [0.17, 0.97], [0.0, 1.0],
];
const radiusAt = (h) => {
  for (let i = 1; i < PROFILE.length; i++) {
    const [r1, y1] = PROFILE[i], [r0, y0] = PROFILE[i - 1];
    if (h <= y1) return r0 + ((h - y0) / (y1 - y0)) * (r1 - r0);
  }
  return 0;
};

const envVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const envFragment = /* glsl */ `
  uniform vec3 uC1, uC2, uC3;
  uniform float uPanels;
  uniform float uFlick;
  uniform float uKind;   // 0 paper, 1 lantern (dark envelope), 2 fireworks
  uniform float uFade;
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    float p = floor(vUv.x * uPanels);
    float m = mod(p, 3.0);
    vec3 col = m < 0.5 ? uC1 : (m < 1.5 ? uC2 : uC3);
    // decorative bands and dotted rows
    float band = step(0.93, fract(vUv.y * 6.0));
    col = mix(col, vec3(1.0, 0.95, 0.8), band * 0.6);
    float seam = smoothstep(0.0, 0.04, fract(vUv.x * uPanels)) * smoothstep(1.0, 0.96, fract(vUv.x * uPanels));
    col *= 0.55 + 0.45 * seam;
    // lit from the flame inside: brightest low down and where the paper faces us
    float h = vUv.y;
    float glow = (0.35 + 0.95 * pow(1.0 - h, 1.6)) * (0.55 + 0.45 * vFacing) * uFlick;
    vec3 c = col * glow * 1.15;
    if (uKind > 0.5 && uKind < 1.5) c = col * 0.06 + vec3(0.06, 0.03, 0.01) * glow; // lantern balloon: dark paper
    gl_FragColor = vec4(c * uFade, 1.0);
  }
`;

const PALETTES = [
  ['#ff3b30', '#ffcc33', '#2fd27a'],
  ['#ff8a1c', '#ffffff', '#e0262e'],
  ['#2f8bff', '#ffd45a', '#ff5ca8'],
  ['#ffd45a', '#e8601a', '#7a3cff'],
  ['#ff4e6a', '#ffe08a', '#30c0ff'],
];

/**
 * မီးပုံးပျံ — Tazaungdaing fire balloons rising into the night.
 * Kinds: paper (colorful glowing panels), lantern ("sein na ban": dark envelope covered in candle lanterns),
 * fireworks (releases spark cascades when high up).
 */
export class FireBalloons {
  constructor(fireworks, { pool = 16, ambient = 6 } = {}) {
    this.fireworks = fireworks;
    this.group = new THREE.Group();
    this.ambient = ambient;
    this.target = ambient;
    this.nextLaunch = 0;
    this.balloons = [];
    const H = 26;
    const geo = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r * H, y * H)), 32);

    for (let i = 0; i < pool; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() },
          uPanels: { value: 12 }, uFlick: { value: 1 }, uKind: { value: 0 }, uFade: { value: 1 },
        },
        vertexShader: envVertex,
        fragmentShader: envFragment,
        side: THREE.DoubleSide,
      });
      const env = new THREE.Mesh(geo, mat);

      // candle lanterns on the envelope (used by lantern balloons)
      const lp = [], lc = [], ls = [], lb = [];
      for (let row = 0; row < 7; row++) {
        const hN = 0.14 + row * 0.11;
        const r = radiusAt(hN) * H * 1.06;
        const n = Math.max(6, Math.round(r * 1.4));
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + row * 0.3;
          lp.push(Math.cos(a) * r, hN * H, Math.sin(a) * r);
          const warm = (row + k) % 5 === 0 ? [1.2, 0.3, 0.2] : [1.3, 0.7, 0.25];
          lc.push(...warm);
          ls.push(1.5);
          lb.push(-1);
        }
      }
      const lanterns = makeGlowPoints(lp, lc, ls, lb);
      // flame at the mouth
      const flame = makeGlowPoints([0, 1.5, 0], [2.4, 1.1, 0.3], [7]);

      const g = new THREE.Group();
      g.add(env, lanterns, flame);
      g.visible = false;
      this.group.add(g);
      this.balloons.push({ g, mat, lanterns, flame, flameCol: flame.geometry.getAttribute('color'), active: false });
    }
  }

  _launch(b, inAir = false) {
    const fromCity = Math.random() < 0.55;
    const x = fromCity ? 125 + Math.random() * 140 : -320 + Math.random() * 220;
    const z = fromCity ? LAYOUT.cityBankZ - 12 - Math.random() * 25 : LAYOUT.nearBankZ + 8 + Math.random() * 25;
    b.pos = new THREE.Vector3(x, LAYOUT.bankHeight, z);
    b.wind = new THREE.Vector3((Math.random() - 0.45) * 1.2, 0, -2.4 - Math.random() * 1.4);
    b.age = 0;
    b.rise = 3 + Math.random() * 2.5;
    b.spin = (Math.random() - 0.5) * 0.15;
    b.phase = Math.random() * 100;
    const r = Math.random();
    b.kind = r < 0.45 ? 0 : r < 0.75 ? 1 : 2;
    b.fired = 0;
    b.nextSpray = 0;
    const pal = PALETTES[(Math.random() * PALETTES.length) | 0];
    b.mat.uniforms.uC1.value.set(pal[0]);
    b.mat.uniforms.uC2.value.set(pal[1]);
    b.mat.uniforms.uC3.value.set(pal[2]);
    b.mat.uniforms.uPanels.value = [9, 12, 15][(Math.random() * 3) | 0];
    b.mat.uniforms.uKind.value = b.kind;
    b.lanterns.visible = b.kind === 1;
    const s = 0.8 + Math.random() * 0.5;
    b.scale = s;
    if (inAir) {
      const t = 10 + Math.random() * 90;
      b.age = t;
      b.pos.addScaledVector(b.wind, t);
      b.pos.y += b.rise * t;
    }
    b.active = true;
    b.g.visible = true;
  }

  /** Launch one balloon right now (e.g. from a key press). */
  launchOne() {
    const b = this.balloons.find((x) => !x.active);
    if (b) this._launch(b);
  }

  /** mode: 'off' | 'few' (ambient) | 'launch' (mass launch) */
  setMode(mode) {
    this.target = mode === 'launch' ? this.balloons.length : mode === 'off' ? 0 : this.ambient;
  }

  /** Put a few balloons in the sky at startup so the scene is alive straight away. */
  seed() {
    for (let i = 0; i < this.ambient; i++) this._launch(this.balloons[i], true);
  }

  update(now, dt) {
    if (!this.group.visible) return;
    let active = 0;
    for (const b of this.balloons) {
      if (!b.active) continue;
      active++;
      b.age += dt;
      // inflate on the ground, then lift off and drift with the wind
      const inflate = Math.min(1, b.age / 2.5);
      const lift = b.age < 2.5 ? 0 : Math.min(1, (b.age - 2.5) / 6);
      b.pos.y += b.rise * lift * dt;
      b.pos.addScaledVector(b.wind, lift * dt);
      b.pos.x += Math.sin(now * 0.3 + b.phase) * 0.6 * dt;
      b.g.position.copy(b.pos);
      b.g.rotation.y += b.spin * dt;
      b.g.rotation.z = Math.sin(now * 0.5 + b.phase) * 0.04 * lift;
      const sc = b.scale * (0.55 + 0.45 * inflate);
      b.g.scale.set(sc, b.scale * (0.35 + 0.65 * inflate), sc);

      const flick = 0.85 + 0.1 * Math.sin(now * 13 + b.phase) + 0.07 * Math.sin(now * 29 + b.phase * 2);
      const fade = Math.min(1, Math.max(0, (1100 - b.pos.y) / 300));
      b.mat.uniforms.uFlick.value = flick;
      b.mat.uniforms.uFade.value = fade;
      const f = 2.2 * flick * fade;
      b.flameCol.setXYZ(0, f * 1.1, f * 0.5, f * 0.12);
      b.flameCol.needsUpdate = true;

      // embers from the burner
      if (Math.random() < dt * 6 * fade) this.fireworks.ember(b.pos.x, b.pos.y + 1, b.pos.z);
      // fireworks balloon: spark cascades once it is high
      if (b.kind === 2 && b.pos.y > 180 && b.fired < 14 && now > b.nextSpray) {
        this.fireworks.spray(b.pos.x, b.pos.y - 4, b.pos.z, 26);
        if (b.fired % 4 === 3) this.fireworks.burstAt(b.pos.x, b.pos.y - 15, b.pos.z, Math.random() < 0.5 ? 'glitter' : 'peony');
        b.fired++;
        b.nextSpray = now + 0.45 + Math.random() * 0.4;
      }

      if (b.pos.y > 1150 || b.pos.z < -2200) {
        b.active = false;
        b.g.visible = false;
        active--;
      }
    }
    // keep the sky populated (staggered launches)
    if (active < this.target && now > this.nextLaunch) {
      this.launchOne();
      this.nextLaunch = now + (this.target > this.ambient ? 0.9 : 6) + Math.random() * 1.5;
    }
  }
}
