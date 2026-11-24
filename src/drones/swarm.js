import * as THREE from 'three';
import { glowUniforms, easeInOut } from '../util/common.js';
import { EFFECTS } from './effects.js';

const droneVertex = /* glsl */ `
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
    gl_PointSize = aBright < 0.004 ? 0.0 : clamp(aSize * uScale / -mv.z, 1.6, 60.0) * uPixelRatio;
  }
`;

const droneFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vBright;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.3, 0.0, d);
    float halo = exp(-d * d * 4.0) * (1.0 - d) * 0.9;
    float a = (core * 1.1 + halo) * vBright;
    // hot white center like a real LED
    vec3 c = mix(vColor, vec3(1.0), core * 0.35);
    gl_FragColor = vec4(c * a, a);
  }
`;

/**
 * The drone swarm: N glowing points that fly between formations.
 * Each transition assigns every target spot to the nearest free drone so paths don't tangle.
 * Drones not needed by a formation fade out and hover in place (like real shows).
 */
export class DroneSwarm {
  constructor(scene, count, center) {
    this.scene = scene;
    this.center = new THREE.Vector3(center.x, center.y, center.z);
    this.build(count);
  }

  build(count) {
    if (this.points) {
      this.scene.remove(this.points);
      this.points.geometry.dispose();
    }
    const N = (this.count = count);
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3).fill(1);
    this.size = new Float32Array(N);
    this.bright = new Float32Array(N); // value sent to the GPU
    this.level = new Float32Array(N); // smoothed effect brightness
    this.start = new Float32Array(N * 3);
    this.local = new Float32Array(N * 3);
    this.baseCol = new Float32Array(N * 3);
    this.active = new Uint8Array(N);
    this.role = new Uint8Array(N).fill(255);
    this.delay = new Float32Array(N);
    this.arc = new Float32Array(N);
    this.phase = new Float32Array(N);
    this.rand = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.phase[i] = Math.random() * Math.PI * 2;
      this.rand[i] = Math.random();
      this.size[i] = 3.4 + Math.random() * 0.6;
    }

    const g = new THREE.BufferGeometry();
    const attr = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', attr(this.pos, 3));
    g.setAttribute('color', attr(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aBright', attr(this.bright, 1));

    this.material ??= new THREE.ShaderMaterial({
      uniforms: { uScale: glowUniforms.uScale, uPixelRatio: glowUniforms.uPixelRatio },
      vertexShader: droneVertex,
      fragmentShader: droneFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    this.formation = null;
    this.transStart = -1e9;
    this.transDur = 3;
    this.spinAngle = 0;
    this._tmp = new THREE.Color();
    this._d = {};
  }

  /** 0..1 progress of the current flight (1 = drones have arrived). */
  progress(now) {
    return Math.min(1, Math.max(0, (now - this.transStart) / (this.transDur * 1.3)));
  }

  /** World position of a formation point at spin angle 0. */
  _targetWorld(f, k, out, o) {
    const lx = f.points[k * 3], ly = f.points[k * 3 + 1], lz = f.points[k * 3 + 2];
    const ct = Math.cos(f.tilt), st = Math.sin(f.tilt);
    out[o] = this.center.x + lx;
    out[o + 1] = this.center.y + ly * ct - lz * st;
    out[o + 2] = this.center.z + ly * st + lz * ct;
  }

  /** Jump straight into a formation (used at startup). */
  place(f) {
    this._assign(f);
    for (let d = 0; d < this.count; d++) {
      if (this.active[d]) {
        const tmp = [0, 0, 0];
        const k = this._map[d];
        this._targetWorld(f, k, tmp, 0);
        this.pos.set(tmp, d * 3);
      }
    }
    this.start.set(this.pos);
    this.transStart = -1e9;
    this.formation = f;
    this.spinAngle = 0;
  }

  /** Fly to a new formation over `duration` seconds. */
  goTo(f, now, duration = 3.5) {
    this.start.set(this.pos);
    this._assign(f);
    for (let d = 0; d < this.count; d++) {
      this.delay[d] = this.rand[d] * duration * 0.22;
      this.arc[d] = 2 + Math.random() * 10;
    }
    this.transDur = duration * 0.78;
    this.transStart = now;
    this.formation = f;
    this.spinAngle = 0;
  }

  _assign(f) {
    const N = this.count;
    const M = Math.min(f.count, N);
    const T = new Float32Array(M * 3);
    for (let k = 0; k < M; k++) this._targetWorld(f, k, T, k * 3);

    // centroid of current drones; place outer targets first for cleaner paths
    let cx = 0, cy = 0, cz = 0;
    for (let d = 0; d < N; d++) { cx += this.pos[d * 3]; cy += this.pos[d * 3 + 1]; cz += this.pos[d * 3 + 2]; }
    cx /= N; cy /= N; cz /= N;
    const order = new Array(M);
    const dist = new Float32Array(M);
    for (let k = 0; k < M; k++) {
      order[k] = k;
      const dx = T[k * 3] - cx, dy = T[k * 3 + 1] - cy, dz = T[k * 3 + 2] - cz;
      dist[k] = dx * dx + dy * dy + dz * dz;
    }
    order.sort((a, b) => dist[b] - dist[a]);

    const used = new Uint8Array(N);
    const map = new Int32Array(N).fill(-1);
    const P = this.pos;
    for (let oi = 0; oi < M; oi++) {
      const k = order[oi];
      const tx = T[k * 3], ty = T[k * 3 + 1], tz = T[k * 3 + 2];
      let best = -1, bd = Infinity;
      for (let d = 0; d < N; d++) {
        if (used[d]) continue;
        const dx = P[d * 3] - tx, dy = P[d * 3 + 1] - ty, dz = P[d * 3 + 2] - tz;
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd < bd) { bd = dd; best = d; }
      }
      used[best] = 1;
      map[best] = k;
    }

    this._map = map;
    this.hasBase = !!f.colors;
    this.meta = f.meta;
    for (let d = 0; d < N; d++) {
      const k = map[d];
      if (k >= 0) {
        this.active[d] = 1;
        this.local[d * 3] = f.points[k * 3];
        this.local[d * 3 + 1] = f.points[k * 3 + 1];
        this.local[d * 3 + 2] = f.points[k * 3 + 2];
        this.role[d] = f.roles ? f.roles[k] : 255;
        if (f.colors) {
          this.baseCol[d * 3] = f.colors[k * 3];
          this.baseCol[d * 3 + 1] = f.colors[k * 3 + 1];
          this.baseCol[d * 3 + 2] = f.colors[k * 3 + 2];
        }
      } else {
        this.active[d] = 0;
      }
    }
  }

  /**
   * look = { effect, colors (palette), shift, bass (0..1+), flash (0..1) }
   */
  update(now, dt, look) {
    const f = this.formation;
    if (!f) return;
    const N = this.count;
    const P = this.pos, S = this.start, L = this.local, C = this.col;
    this.spinAngle += f.spin * dt;
    const cs = Math.cos(this.spinAngle), sn = Math.sin(this.spinAngle);
    const ct = Math.cos(f.tilt), st = Math.sin(f.tilt);
    const { x: cx, y: cy, z: cz } = this.center;
    const elapsed = now - this.transStart;
    const effect = (EFFECTS[look.effect] || EFFECTS.palette).fn;
    const d = this._d;
    d.t = now; d.pal = look.colors; d.shift = look.shift; d.R = f.radius; d.hasBase = this.hasBase;
    d.meta = this.meta; d.st = now - this.transStart; d.dur = look.duration || 10;
    const o = this._tmp;
    const kCol = 1 - Math.exp(-dt * 5);
    const kLvl = 1 - Math.exp(-dt * 4);
    const gain = 1 + look.bass * 1.1 + look.flash * 0.9;
    const fb = f.brightness;

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      let tx, ty, tz;
      const act = this.active[i];
      if (act) {
        const lx = L[i3], ly = L[i3 + 1];
        let lz = L[i3 + 2];
        if (f.wave) lz += Math.sin(lx * 0.045 + now * 2.2) * 9 + Math.sin(ly * 0.05 + lx * 0.02 + now * 1.4) * 4;
        const x = lx * cs + lz * sn;
        const z = -lx * sn + lz * cs;
        tx = cx + x;
        ty = cy + ly * ct - z * st;
        tz = cz + ly * st + z * ct;
      } else {
        tx = S[i3]; ty = S[i3 + 1]; tz = S[i3 + 2];
      }

      let p = (elapsed - this.delay[i]) / this.transDur;
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      const e = easeInOut(p);
      const sx = S[i3], sy = S[i3 + 1], sz = S[i3 + 2];
      let y = sy + (ty - sy) * e + Math.sin(Math.PI * e) * this.arc[i];
      const ph = this.phase[i];
      const hover = Math.min(1, Math.max(0, (y - 4) / 12)); // drones on the ground don't wobble
      P[i3] = sx + (tx - sx) * e + Math.sin(now * 0.8 + ph) * 0.3 * hover;
      P[i3 + 1] = y + Math.sin(now * 1.1 + ph * 1.7) * 0.35 * hover;
      P[i3 + 2] = sz + (tz - sz) * e + Math.cos(now * 0.7 + ph * 1.3) * 0.3 * hover;

      let target = 0;
      if (act) {
        d.lx = L[i3]; d.ly = L[i3 + 1]; d.lz = L[i3 + 2];
        d.rand = this.rand[i]; d.phase = ph; d.role = this.role[i];
        if (this.hasBase) { d.br = this.baseCol[i3]; d.bg = this.baseCol[i3 + 1]; d.bb = this.baseCol[i3 + 2]; }
        target = effect(o, d) * fb;
        C[i3] += (o.r - C[i3]) * kCol;
        C[i3 + 1] += (o.g - C[i3 + 1]) * kCol;
        C[i3 + 2] += (o.b - C[i3 + 2]) * kCol;
      }
      this.level[i] += (target - this.level[i]) * kLvl;
      this.bright[i] = this.level[i] * gain;
    }

    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.aBright.needsUpdate = true;
  }
}
