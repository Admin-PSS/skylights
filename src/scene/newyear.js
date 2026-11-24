import * as THREE from 'three';
import { glowUniforms, mulberry32 } from '../util/common.js';
import { createRoofLights } from './christmas.js';

const GOLD_SILVER = [
  [1.7, 1.2, 0.35], // gold
  [1.5, 1.5, 1.6], // silver-white
  [1.6, 0.95, 0.4], // champagne
  [1.2, 1.3, 1.7], // cool silver
];

/** Falling confetti that flutters (size pulses as each piece turns over). */
function createConfetti(count) {
  const rnd = mulberry32(2027);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const colors = [[1, 0.8, 0.2], [1, 0.25, 0.6], [0.25, 0.85, 1], [0.95, 0.95, 1], [0.55, 1, 0.4], [1, 0.45, 0.15]];
  const H = 460;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rnd() - 0.5) * 900;
    pos[i * 3 + 1] = rnd() * H;
    pos[i * 3 + 2] = 230 - Math.pow(rnd(), 1.5) * 650;
    seed[i] = rnd();
    const c = colors[(rnd() * colors.length) | 0];
    col.set(c, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uScale: glowUniforms.uScale, uPixelRatio: glowUniforms.uPixelRatio },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute vec3 color;
      uniform float uTime, uAmount, uScale, uPixelRatio;
      varying vec3 vColor;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y - uTime * (10.0 + aSeed * 12.0), ${H.toFixed(1)}) + 10.0;
        p.x += sin(uTime * (0.8 + aSeed * 1.5) + aSeed * 50.0) * 10.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float flip = 0.3 + 0.7 * abs(sin(uTime * (3.0 + aSeed * 6.0) + aSeed * 30.0));
        gl_PointSize = clamp(2.4 * flip * uScale / -mv.z, 1.0, 12.0) * uPixelRatio * step(0.01, uAmount);
        vColor = color;
        vA = uAmount * (0.6 + 0.4 * flip);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vA;
      void main() {
        vec2 q = abs(gl_PointCoord - 0.5);
        if (max(q.x, q.y * 1.6) > 0.5) discard; // small rectangles, not dots
        gl_FragColor = vec4(vColor * vA * 0.9, vA);
      }`,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  return { points: pts, material: m };
}

/** New Year scenery: gold & silver rooftop lights, and confetti that falls when a step asks for it. */
export function createNewYearScene(lots, { mobile = false } = {}) {
  const confetti = createConfetti(mobile ? 1500 : 3500);
  const decor = new THREE.Group();
  decor.add(createRoofLights(lots, GOLD_SILVER));
  let amount = 0;
  return {
    decor,
    confetti: confetti.points,
    /** on: whether the current step wants confetti */
    update(t, dt, on) {
      amount += ((on ? 1 : 0) - amount) * (1 - Math.exp(-dt * (on ? 2.5 : 0.6)));
      confetti.material.uniforms.uTime.value = t;
      confetti.material.uniforms.uAmount.value = amount;
      confetti.points.visible = amount > 0.01;
    },
  };
}
