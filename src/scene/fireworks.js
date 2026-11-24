import * as THREE from 'three';
import { glowUniforms } from '../util/common.js';

const MAX = 16000;

const vert = /* glsl */ `
  attribute vec3 color;
  attribute float aSize;
  attribute float aBright;
  uniform float uScale;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = color;
    vBright = aBright;
    gl_PointSize = aBright < 0.003 ? 0.0 : clamp(aSize * uScale / -mv.z, 1.2, 90.0) * uPixelRatio;
  }
`;
const frag = /* glsl */ `
  varying vec3 vColor;
  varying float vBright;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = (smoothstep(0.35, 0.0, d) + exp(-d * d * 4.0) * (1.0 - d) * 0.8) * vBright;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

// Kinds of particle
const SPARK = 0, WILLOW = 1, GLITTER = 2, FLASH = 3, TRAIL = 4;

const COLORS = [
  [1.0, 0.12, 0.06], [1.0, 0.55, 0.1], [1.0, 0.85, 0.35], [0.25, 1.0, 0.35], [0.2, 0.5, 1.0],
  [0.65, 0.25, 1.0], [1.0, 0.3, 0.65], [0.3, 0.95, 1.0], [1.0, 1.0, 1.0],
];
const GOLD = [1.0, 0.6, 0.18];
const TYPES = ['peony', 'peony', 'ring', 'willow', 'glitter', 'palm', 'double'];

/** Particle fireworks: rockets with trails, then peony / ring / willow / glitter / palm / double bursts. */
export class Fireworks {
  constructor() {
    this.pos = new Float32Array(MAX * 3);
    this.vel = new Float32Array(MAX * 3);
    this.base = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 3);
    this.size = new Float32Array(MAX);
    this.bright = new Float32Array(MAX);
    this.age = new Float32Array(MAX).fill(1);
    this.life = new Float32Array(MAX).fill(1);
    this.drag = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.kind = new Uint8Array(MAX);
    this.cursor = 0;
    this.rockets = [];
    this.onBurst = null; // (x, y, z, type) => void  — used for sound

    const g = new THREE.BufferGeometry();
    const dyn = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', dyn(this.pos, 3));
    g.setAttribute('color', dyn(this.col, 3));
    g.setAttribute('aSize', dyn(this.size, 1));
    g.setAttribute('aBright', dyn(this.bright, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uScale: glowUniforms.uScale, uPixelRatio: glowUniforms.uPixelRatio },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(this.points);
  }

  _spawn(x, y, z, vx, vy, vz, rgb, life, size, kind, drag, grav) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.base[i3] = rgb[0]; this.base[i3 + 1] = rgb[1]; this.base[i3 + 2] = rgb[2];
    this.age[i] = 0; this.life[i] = life; this.size[i] = size;
    this.kind[i] = kind; this.drag[i] = drag; this.grav[i] = grav;
  }

  /**
   * Launch one rocket. opts.center = {x,y,z} of the drone show so bursts frame it.
   * opts.palette = optional array of THREE.Color to mix in.
   */
  launch(opts = {}) {
    const cx = opts.center?.x ?? 0, cy = opts.center?.y ?? 210, cz = opts.center?.z ?? -130;
    const side = Math.random() < 0.5 ? -1 : 1;
    const behind = Math.random() < 0.3;
    const ex = behind ? cx + (Math.random() - 0.5) * 300 : cx + side * (150 + Math.random() * 260);
    const ey = cy - 30 + Math.random() * 170 + (behind ? 80 : 0);
    const ez = cz - (behind ? 260 : 20) - Math.random() * 230;
    const sx = ex + (Math.random() - 0.5) * 40, sz = ez + (Math.random() - 0.5) * 40;
    const pick = () => {
      if (opts.palette && Math.random() < 0.5) {
        const c = opts.palette[(Math.random() * opts.palette.length) | 0];
        return [c.r, c.g, c.b];
      }
      return COLORS[(Math.random() * COLORS.length) | 0];
    };
    this.rockets.push({
      sx, sy: 3, sz, ex, ey, ez,
      t: 0, T: 1.4 + Math.random() * 0.7, emit: 0,
      type: opts.type || TYPES[(Math.random() * TYPES.length) | 0],
      c1: pick(), c2: pick(),
    });
  }

  /** A burst at an exact point (used by fireworks balloons). */
  burstAt(x, y, z, type = 'peony') {
    const pick = () => COLORS[(Math.random() * COLORS.length) | 0];
    this._burst({ ex: x, ey: y, ez: z, type, c1: pick(), c2: pick() });
  }

  /** A cascade of sparks spraying out and down (fireworks hanging under a balloon). */
  spray(x, y, z, n = 24) {
    const cols = [[2.6, 1.6, 0.5], [2.6, 2.4, 2.0], [2.6, 0.5, 0.25], [0.6, 2.4, 0.9]];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 14 + Math.random() * 26;
      const c = cols[(Math.random() * cols.length) | 0];
      this._spawn(x, y, z, Math.cos(a) * sp * 0.7, 4 - Math.random() * 22, Math.sin(a) * sp * 0.7,
        c, 1.1 + Math.random() * 0.9, 2.2, Math.random() < 0.5 ? GLITTER : SPARK, 1.0, 13);
    }
  }

  /** A small glowing ember drifting down from a balloon's burner. */
  ember(x, y, z) {
    this._spawn(x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 1.5, -2 - Math.random() * 3, (Math.random() - 0.5) * 1.5,
      [2.2, 0.9, 0.2], 1.0 + Math.random() * 0.8, 1.3, TRAIL, 0.6, 2);
  }

  volley(n = 5, opts = {}) {
    for (let k = 0; k < n; k++) setTimeout(() => this.launch(opts), k * 180 + Math.random() * 120);
  }

  _burst(r) {
    const { ex: x, ey: y, ez: z, type } = r;
    const hdr = 2.6;
    const scale = (c, k = hdr) => [c[0] * k, c[1] * k, c[2] * k];
    const sphereDir = () => {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      return [s * Math.cos(a), u, s * Math.sin(a)];
    };
    const c1 = scale(r.c1), c2 = scale(r.c2);
    this._spawn(x, y, z, 0, 0, 0, [1.1, 0.95, 0.8], 0.2, 34, FLASH, 0, 0);

    if (type === 'peony' || type === 'double' || type === 'glitter') {
      const n = type === 'glitter' ? 150 : 170;
      const speed = 46 + Math.random() * 14;
      for (let k = 0; k < n; k++) {
        const d = sphereDir();
        const v = speed * (0.85 + Math.random() * 0.25);
        const col = type === 'double' && k % 2 ? c2 : type === 'glitter' ? scale([1, 0.85, 0.55]) : c1;
        this._spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, col, 1.7 + Math.random() * 0.7, 2.6,
          type === 'glitter' ? GLITTER : SPARK, 1.3, 14);
      }
      if (type === 'double') {
        for (let k = 0; k < 60; k++) {
          const d = sphereDir(), v = speed * 0.45;
          this._spawn(x, y, z, d[0] * v, d[1] * v, d[2] * v, c2, 1.5, 2.8, SPARK, 1.2, 12);
        }
      }
    } else if (type === 'ring') {
      const nrm = sphereDir();
      const t1 = new THREE.Vector3(...nrm).cross(new THREE.Vector3(0, 1, 0.3)).normalize();
      const t2 = new THREE.Vector3(...nrm).cross(t1).normalize();
      const n = 120, v = 52;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const dx = t1.x * Math.cos(a) + t2.x * Math.sin(a);
        const dy = t1.y * Math.cos(a) + t2.y * Math.sin(a);
        const dz = t1.z * Math.cos(a) + t2.z * Math.sin(a);
        this._spawn(x, y, z, dx * v, dy * v, dz * v, c1, 1.9, 2.8, SPARK, 1.2, 10);
      }
      for (let k = 0; k < 30; k++) {
        const d = sphereDir();
        this._spawn(x, y, z, d[0] * 12, d[1] * 12, d[2] * 12, c2, 1.4, 2.4, GLITTER, 1, 8);
      }
    } else if (type === 'willow') {
      for (let k = 0; k < 120; k++) {
        const d = sphereDir(), v = 34 * (0.8 + Math.random() * 0.3);
        this._spawn(x, y, z, d[0] * v, d[1] * v + 6, d[2] * v, scale(GOLD), 3.4 + Math.random(), 2.6, WILLOW, 1.7, 9);
      }
    } else if (type === 'palm') {
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const v = 60;
        this._spawn(x, y, z, Math.cos(a) * v * 0.8, v * 0.55, Math.sin(a) * v * 0.8, c1, 2.6, 5, WILLOW, 1.1, 16);
      }
    }
    this.onBurst?.(x, y, z, type);
  }

  update(now, dt) {
    // rockets
    for (let k = this.rockets.length - 1; k >= 0; k--) {
      const r = this.rockets[k];
      r.t += dt;
      const p = Math.min(1, r.t / r.T);
      const e = 1 - (1 - p) * (1 - p);
      const x = r.sx + (r.ex - r.sx) * e + Math.sin(r.t * 9) * 0.6;
      const y = r.sy + (r.ey - r.sy) * e;
      const z = r.sz + (r.ez - r.sz) * e;
      r.emit += dt;
      while (r.emit > 0.012) {
        r.emit -= 0.012;
        this._spawn(x, y, z, (Math.random() - 0.5) * 4, -6 - Math.random() * 6, (Math.random() - 0.5) * 4,
          [2.2, 1.1, 0.35], 0.45 + Math.random() * 0.3, 1.8, TRAIL, 2, 6);
      }
      if (p >= 1) {
        this._burst(r);
        this.rockets.splice(k, 1);
      }
    }

    // particles
    const P = this.pos, V = this.vel, B = this.base, C = this.col;
    for (let i = 0; i < MAX; i++) {
      const life = this.life[i];
      let a = this.age[i];
      if (a >= life) { this.bright[i] = 0; continue; }
      a += dt;
      this.age[i] = a;
      const i3 = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      V[i3] *= dr; V[i3 + 1] = V[i3 + 1] * dr - this.grav[i] * dt; V[i3 + 2] *= dr;
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      const f = Math.min(1, a / life); // never > 1: pow() of a negative number is NaN
      const kind = this.kind[i];
      let b;
      if (kind === FLASH) b = Math.pow(1 - f, 3);
      else {
        b = Math.pow(1 - f, 1.4);
        if (kind === GLITTER && f > 0.35) b *= Math.sin(now * 55 + i * 1.7) > 0.3 ? 1.6 : 0.08;
        if (kind === WILLOW && Math.random() < dt * 22) {
          this._spawn(P[i3], P[i3 + 1], P[i3 + 2], 0, -1.5, 0, [B[i3] * 0.6, B[i3 + 1] * 0.6, B[i3 + 2] * 0.6],
            1.1, 1.9, TRAIL, 1, 3);
        }
      }
      this.bright[i] = b;
      // sparks cool from white-hot to their color
      const hot = Math.max(0, 1 - f * 4) * 0.6;
      C[i3] = B[i3] + hot; C[i3 + 1] = B[i3 + 1] + hot; C[i3 + 2] = B[i3 + 2] + hot;
    }
    const g = this.points.geometry.attributes;
    g.position.needsUpdate = true;
    g.color.needsUpdate = true;
    g.aSize.needsUpdate = true;
    g.aBright.needsUpdate = true;
  }
}
