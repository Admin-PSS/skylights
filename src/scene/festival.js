import * as THREE from 'three';
import { makeGlowPoints, mulberry32 } from '../util/common.js';

/** A large glowing full moon (Tazaungmon full moon) that always faces the camera. */
export function createMoon() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: { uGlow: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uGlow;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; } return v; }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        const float R = 0.34;
        vec3 col = vec3(0.0);
        if (r < R) {
          vec2 q = p / R;
          float maria = smoothstep(0.48, 0.72, fbm(q * 2.2 + 3.1));
          float craters = fbm(q * 9.0) * 0.12;
          float limb = sqrt(max(0.0, 1.0 - dot(q, q)));
          col = vec3(1.0, 0.9, 0.72) * (0.7 + 0.3 * limb) * (1.0 - 0.38 * maria - craters) * 0.62;
          col *= smoothstep(R, R - 0.006, r);
        }
        float halo = exp(-max(0.0, r - R) * 9.0) * 0.14 + exp(-max(0.0, r - R) * 2.5) * 0.04;
        col += vec3(1.0, 0.82, 0.55) * halo * step(R - 0.004, r) * smoothstep(1.0, 0.7, r);
        gl_FragColor = vec4(col * uGlow, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(820, 820), mat);
  mesh.position.set(-1050, 820, -2350);
  mesh.renderOrder = -5;
  return {
    mesh,
    update(camera) {
      mesh.quaternion.copy(camera.quaternion);
    },
  };
}

/** Sky lanterns and small fire balloons drifting up from the city and the riverbank. */
export function createLanterns(count = 90) {
  const rnd = mulberry32(99);
  const pos = [], col = [], size = [];
  const state = [];
  const respawn = (s, initial) => {
    const fromCrowd = rnd() < 0.35;
    s.x = (rnd() - 0.5) * (fromCrowd ? 900 : 2000);
    s.z = fromCrowd ? 185 + rnd() * 200 : -100 - rnd() * 1000;
    s.y = initial ? 10 + rnd() * 750 : 6 + rnd() * 10;
    s.speed = 3 + rnd() * 4;
    s.ph = rnd() * 100;
    s.big = rnd() < 0.12; // a few big fire balloons
  };
  for (let i = 0; i < count; i++) {
    const s = {};
    respawn(s, true);
    state.push(s);
    pos.push(s.x, s.y, s.z);
    col.push(1, 0.5, 0.15);
    size.push(s.big ? 9 : 4);
  }
  const points = makeGlowPoints(pos, col, size);
  const pAttr = points.geometry.getAttribute('position');
  const cAttr = points.geometry.getAttribute('color');
  const sAttr = points.geometry.getAttribute('aSize');

  return {
    points,
    update(t, dt) {
      if (!points.visible) return;
      state.forEach((s, i) => {
        s.y += s.speed * dt * (s.big ? 0.6 : 1);
        s.x += (2.5 + Math.sin(t * 0.2 + s.ph) * 1.5) * dt;
        s.z += Math.cos(t * 0.15 + s.ph) * 0.8 * dt;
        if (s.y > 820) { respawn(s, false); sAttr.setX(i, s.big ? 9 : 4); }
        pAttr.setXYZ(i, s.x, s.y, s.z);
        const flick = 0.75 + 0.15 * Math.sin(t * 9 + s.ph) + 0.1 * Math.sin(t * 23 + s.ph * 3);
        const fade = Math.min(1, (900 - s.y) / 300) * flick * (s.big ? 1.6 : 1.1);
        cAttr.setXYZ(i, 1.0 * fade, 0.45 * fade, 0.12 * fade);
      });
      pAttr.needsUpdate = true;
      cAttr.needsUpdate = true;
      sAttr.needsUpdate = true;
    },
  };
}
