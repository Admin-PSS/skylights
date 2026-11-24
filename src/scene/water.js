import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { LAYOUT } from './city.js';

const WaterShader = {
  name: 'RiverShader',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vec2 p = vWorld.xz;
      float w1 = sin(p.x * 0.05 + uTime * 0.7) * 0.5 + sin(p.y * 0.15 - uTime * 1.2) * 0.3 + sin((p.x + p.y) * 0.23 + uTime * 1.6) * 0.2;
      float w2 = sin(p.x * 0.31 - uTime * 2.0) * sin(p.y * 0.42 + uTime * 1.1);
      vec4 uv = vUv;
      uv.x += (w1 * 0.003 + w2 * 0.0015) * uv.w;
      uv.y += (w2 * 0.012 + w1 * 0.004) * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      // never let an invalid (NaN/Inf) reflection pixel reach the glow pass — it would blot out the screen
      // (comparisons with NaN are false, so this also catches NaN without isnan(), which some drivers drop)
      if (!(refl.r < 1e4 && refl.g < 1e4 && refl.b < 1e4 && refl.r >= 0.0 && refl.g >= 0.0 && refl.b >= 0.0)) refl = vec3(0.0);
      refl = min(refl, vec3(30.0));
      gl_FragColor = vec4(refl * color + vec3(0.003, 0.006, 0.012), 1.0);
    }`,
};

/** The river between the two banks: a rippled reflection, or a dark plane when reflections are off. */
export function createWater(renderer, quality = 0.5) {
  const width = 5200;
  const depth = LAYOUT.nearBankZ - LAYOUT.cityBankZ;
  const geo = new THREE.PlaneGeometry(width, depth);
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);

  const mirror = new Reflector(geo, {
    shader: WaterShader,
    textureWidth: Math.floor(size.x * quality),
    textureHeight: Math.floor(size.y * quality),
    clipBias: 0.003,
    color: new THREE.Color(0x6f7f99),
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.set(0, 0, (LAYOUT.cityBankZ + LAYOUT.nearBankZ) / 2);

  const plain = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x03050a }));
  plain.rotation.x = -Math.PI / 2;
  plain.position.copy(mirror.position);
  plain.visible = false;

  const group = new THREE.Group();
  group.add(mirror, plain);

  return {
    group,
    setReflections(on) {
      mirror.visible = on;
      plain.visible = !on;
    },
    update(t) {
      mirror.material.uniforms.uTime.value = t;
    },
  };
}
