import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { makeGlowPoints } from '../util/common.js';
import { samplePalette } from '../drones/effects.js';
import { LAYOUT } from './city.js';

const BEAMS_PER = 4;
const WEB_MAX = 160;
const BEAM_LEN = 1600;

/**
 * Laser show. Modes:
 *  fan    – beams from the riverfront fan and sweep over the city, rooftop emitters spin like lighthouses
 *  target – every beam locks onto a drone in the formation and re-targets on the beat
 *  web    – "string art" lines stretched between drones around the formation
 */
export class Lasers {
  constructor() {
    this.group = new THREE.Group();
    const y = LAYOUT.bankHeight + 2;
    this.emitters = [
      { p: new THREE.Vector3(-300, y, LAYOUT.cityBankZ - 10), roof: false, ph: 0 },
      { p: new THREE.Vector3(-120, y, LAYOUT.cityBankZ - 10), roof: false, ph: 1.3 },
      { p: new THREE.Vector3(120, y, LAYOUT.cityBankZ - 10), roof: false, ph: 2.1 },
      { p: new THREE.Vector3(300, y, LAYOUT.cityBankZ - 10), roof: false, ph: 3.4 },
      { p: new THREE.Vector3(90, LAYOUT.bankHeight + 343, -600), roof: true, ph: 0.5 }, // landmark tower tops
      { p: new THREE.Vector3(-140, LAYOUT.bankHeight + 303, -520), roof: true, ph: 2.5 },
    ];
    this.beamCount = this.emitters.length * BEAMS_PER;
    this.maxSeg = this.beamCount + WEB_MAX;
    this.pos = new Float32Array(this.maxSeg * 6);
    this.col = new Float32Array(this.maxSeg * 6);

    this.geo = new LineSegmentsGeometry();
    this.geo.setPositions(this.pos);
    this.geo.setColors(this.col);
    this.material = new LineMaterial({
      vertexColors: true,
      linewidth: 1.6,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lines = new LineSegments2(this.geo, this.material);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    const fp = [], fc = [], fs = [];
    this.emitters.forEach((e) => { fp.push(e.p.x, e.p.y, e.p.z); fc.push(0, 0, 0); fs.push(6); });
    this.flares = makeGlowPoints(fp, fc, fs);
    this.group.add(this.flares);

    this.targets = new Int32Array(this.beamCount).fill(-1);
    this.retargetAt = 0;
    this.level = 0;
    this.flash = 0;
    this.mode = 'fan';
    this.webFor = null;
    this.hubs = [];
    this._c = new THREE.Color();
  }

  setResolution(w, h) {
    this.material.resolution.set(w, h);
  }

  _pickTargets(sw) {
    const N = sw.count;
    for (let b = 0; b < this.beamCount; b++) {
      let d = -1;
      for (let tries = 0; tries < 30; tries++) {
        const k = (Math.random() * N) | 0;
        if (sw.active[k]) { d = k; break; }
      }
      this.targets[b] = d;
    }
  }

  _buildHubs(sw) {
    const act = [];
    for (let d = 0; d < sw.count; d++) if (sw.active[d]) act.push(d);
    const L = sw.local;
    act.sort((a, b) => Math.atan2(L[a * 3 + 1], L[a * 3]) - Math.atan2(L[b * 3 + 1], L[b * 3]));
    const K = Math.min(WEB_MAX, Math.max(12, Math.floor(act.length / 8)));
    this.hubs = [];
    for (let i = 0; i < K && act.length; i++) this.hubs.push(act[Math.floor((i * act.length) / K)]);
    this.webFor = sw.formation;
  }

  /** o = { mode, colors, swarm, energy, beat, shift } */
  update(now, dt, o) {
    const on = o.mode && o.mode !== 'off';
    if (on) this.mode = o.mode;
    this.level += ((on ? 1 : 0) - this.level) * (1 - Math.exp(-dt * 3));
    this.group.visible = this.level > 0.01;
    if (!this.group.visible) return;

    this.flash = o.beat ? 1 : this.flash * Math.exp(-dt * 7);
    const I = this.level * (0.45 + o.energy * 0.4 + this.flash * 0.5);
    const P = this.pos, C = this.col, sw = o.swarm, c = this._c;
    const pal = o.colors;
    let seg = 0;

    const put = (ax, ay, az, bx, by, bz, r, g, b, k0, k1) => {
      const i = seg * 6;
      P[i] = ax; P[i + 1] = ay; P[i + 2] = az; P[i + 3] = bx; P[i + 4] = by; P[i + 5] = bz;
      C[i] = r * k0; C[i + 1] = g * k0; C[i + 2] = b * k0; C[i + 3] = r * k1; C[i + 4] = g * k1; C[i + 5] = b * k1;
      seg++;
    };

    const mode = this.mode;
    if (mode === 'target' && (now > this.retargetAt || o.beat)) {
      this._pickTargets(sw);
      this.retargetAt = now + 1.5;
    }

    if (mode === 'fan' || mode === 'target') {
      this.emitters.forEach((e, ei) => {
        for (let j = 0; j < BEAMS_PER; j++) {
          const b = ei * BEAMS_PER + j;
          samplePalette(pal, b / this.beamCount + o.shift, c);
          let ex, ey, ez, k1;
          if (mode === 'fan') {
            let el, az;
            if (e.roof) {
              el = 0.08 + Math.sin(now * 0.4 + e.ph) * 0.07;
              az = now * 0.45 + e.ph + (j * Math.PI * 2) / BEAMS_PER;
            } else {
              const spread = 0.9 * (0.55 + 0.45 * Math.sin(now * 0.8 + e.ph));
              el = 1.05 + Math.sin(now * 0.5 + e.ph) * 0.3;
              az = Math.sin(now * 0.35 + e.ph) * 0.5 + (j / (BEAMS_PER - 1) - 0.5) * spread;
            }
            const ce = Math.cos(el);
            ex = e.p.x + ce * Math.sin(az) * BEAM_LEN;
            ey = e.p.y + Math.sin(el) * BEAM_LEN;
            ez = e.p.z - ce * Math.cos(az) * BEAM_LEN;
            k1 = 0.04;
          } else {
            const d = this.targets[b];
            if (d < 0) continue;
            ex = sw.pos[d * 3]; ey = sw.pos[d * 3 + 1]; ez = sw.pos[d * 3 + 2];
            k1 = 1.6;
          }
          put(e.p.x, e.p.y, e.p.z, ex, ey, ez, c.r, c.g, c.b, (e.roof ? 1.2 : 2) * I, k1 * I);
        }
      });
    }

    if (mode === 'web' && sw.formation) {
      if (this.webFor !== sw.formation) this._buildHubs(sw);
      const prog = sw.progress(now);
      const wI = I * prog * prog * 0.55;
      const K = this.hubs.length;
      const stepK = Math.max(1, Math.floor(K * 0.17)); // short chords: a star outline, not a white-hot center
      for (let i = 0; i < K && seg < this.maxSeg; i++) {
        const a = this.hubs[i], b = this.hubs[(i + stepK) % K];
        samplePalette(pal, i / K + o.shift + now * 0.05, c);
        put(sw.pos[a * 3], sw.pos[a * 3 + 1], sw.pos[a * 3 + 2], sw.pos[b * 3], sw.pos[b * 3 + 1], sw.pos[b * 3 + 2],
          c.r, c.g, c.b, wI, wI);
      }
    }

    // clear unused segments
    P.fill(0, seg * 6);
    C.fill(0, seg * 6);
    this.geo.attributes.instanceStart.data.needsUpdate = true;
    this.geo.attributes.instanceColorStart.data.needsUpdate = true;

    // emitter flares
    const fcol = this.flares.geometry.getAttribute('color');
    const showFlares = mode !== 'web';
    this.emitters.forEach((e, ei) => {
      samplePalette(pal, (ei * BEAMS_PER) / this.beamCount + o.shift, c);
      const k = showFlares ? 3 * I : 0;
      fcol.setXYZ(ei, c.r * k, c.g * k, c.b * k);
    });
    fcol.needsUpdate = true;
  }
}
