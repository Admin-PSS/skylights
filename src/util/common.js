import * as THREE from 'three';

/** Deterministic pseudo-random generator so the city and shapes look the same every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Uniforms shared by every glowing point material (drones, city lights, flares),
 * so a single resize/tick updates them all.
 */
export const glowUniforms = {
  uScale: { value: 1 },
  uPixelRatio: { value: 1 },
  uTime: { value: 0 },
};

const glowVertex = /* glsl */ `
  attribute vec3 color;
  attribute float aSize;
  attribute float aBlink;
  uniform float uScale;
  uniform float uPixelRatio;
  uniform float uTime;
  varying vec3 vColor;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float b = 1.0;
    if (aBlink >= 0.0) b = 0.05 + 1.6 * pow(max(0.0, sin(uTime * 2.6 + aBlink)), 10.0);
    vBright = b;
    vColor = color;
    gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 48.0) * uPixelRatio;
  }
`;

const glowFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vBright;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d > 1.0) discard;
    float a = (smoothstep(0.45, 0.0, d) * 1.4 + exp(-d * d * 6.0) * 0.5) * vBright;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

/**
 * Static glowing points (street lamps, bridge lights, aviation beacons).
 * blink: per-point phase (>= 0 blinks, -1 = steady).
 */
export function makeGlowPoints(positions, colors, sizes, blink) {
  const n = positions.length / 3;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  g.setAttribute('aBlink', new THREE.Float32BufferAttribute(blink || new Array(n).fill(-1), 1));
  const m = new THREE.ShaderMaterial({
    uniforms: glowUniforms,
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
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

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
