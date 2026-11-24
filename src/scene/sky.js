import * as THREE from 'three';
import { mulberry32 } from '../util/common.js';

export const HORIZON = new THREE.Color(0x2a1d3d);

/** Night sky dome with a city-glow horizon and twinkling stars. */
export function createSky() {
  const group = new THREE.Group();

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(3200, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x010208) },
        uMid: { value: new THREE.Color(0x070b22) },
        uHorizon: { value: HORIZON },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uMid, uHorizon;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.2, h));
          c = mix(c, uTop, smoothstep(0.18, 0.75, h));
          if (h < 0.0) c = uHorizon * 0.5;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  dome.renderOrder = -10;
  group.add(dome);

  // Stars
  const rnd = mulberry32(42);
  const COUNT = 2600;
  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const u = rnd() * Math.PI * 2;
    const y = 0.06 + rnd() * 0.94;
    const r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(u) * r * 3000, y * 3000, Math.sin(u) * r * 3000], i * 3);
    size[i] = Math.pow(rnd(), 4) * 3 + 0.6;
    phase[i] = rnd() * 100;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aPhase;
      uniform float uTime; uniform float uPixelRatio;
      varying float vA;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float tw = 0.65 + 0.35 * sin(uTime * (0.8 + fract(aPhase) * 2.5) + aPhase);
        vA = tw * smoothstep(0.0, 0.35, normalize(position).y);
        gl_PointSize = aSize * uPixelRatio;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, d) * vA * 0.7;
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a, a);
      }`,
  });
  const stars = new THREE.Points(g, starMat);
  stars.frustumCulled = false;
  group.add(stars);

  return {
    group,
    update(t, pixelRatio) {
      starMat.uniforms.uTime.value = t;
      starMat.uniforms.uPixelRatio.value = pixelRatio;
    },
  };
}
