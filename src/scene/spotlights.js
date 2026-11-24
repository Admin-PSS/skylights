import * as THREE from 'three';
import { makeGlowPoints } from '../util/common.js';
import { LAYOUT } from './city.js';

const LEN = 560;

const beamVertex = /* glsl */ `
  varying float vH;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vH = position.y / ${LEN.toFixed(1)};
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying float vH;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float facing = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
    float h = clamp(vH, 0.0, 1.0);
    float fade = pow(1.0 - h, 1.7) * smoothstep(0.0, 0.02, h);
    float a = facing * fade * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** Sweeping searchlight beams along the riverfront, colored by the show palette. */
export class Spotlights {
  constructor() {
    this.group = new THREE.Group();
    this.beams = [];
    const geo = new THREE.CylinderGeometry(34, 1.4, LEN, 28, 1, true);
    geo.translate(0, LEN / 2, 0);

    const xs = [-390, -270, -160, -70, 70, 160, 270, 390];
    const flareP = [], flareC = [], flareS = [];
    xs.forEach((x, i) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uIntensity: { value: 0.14 } },
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const pivot = new THREE.Group();
      pivot.position.set(x, LAYOUT.bankHeight + 1, LAYOUT.cityBankZ - 8);
      pivot.add(mesh);
      this.group.add(pivot);
      this.beams.push({ pivot, mat, phase: i * 0.9, dir: i % 2 ? 1 : -1, color: new THREE.Color(1, 1, 1) });
      flareP.push(x, LAYOUT.bankHeight + 2, LAYOUT.cityBankZ - 8);
      flareC.push(1, 1, 1);
      flareS.push(5);
    });
    this.flares = makeGlowPoints(flareP, flareC, flareS);
    this.group.add(this.flares);
    this.flareColors = this.flares.geometry.getAttribute('color');
    this.flash = 0;
  }

  /** palette: array of THREE.Color; energy: 0..1+ music energy; beat: boolean */
  update(t, dt, palette, energy = 0, beat = false) {
    if (!this.group.visible) return;
    this.flash = beat ? 1 : this.flash * Math.exp(-dt * 6);
    const k = 1 - Math.exp(-dt * 3);
    this.beams.forEach((b, i) => {
      const s = 0.35 + energy * 0.25;
      b.pivot.rotation.z = Math.sin(t * s + b.phase) * 0.5 * b.dir;
      b.pivot.rotation.x = 0.12 + Math.cos(t * s * 0.73 + b.phase * 1.3) * 0.3;
      const target = palette[i % palette.length];
      b.color.lerp(target, k);
      b.mat.uniforms.uColor.value.copy(b.color);
      b.mat.uniforms.uIntensity.value = 0.16 + energy * 0.16 + this.flash * 0.14;
      this.flareColors.setXYZ(i, b.color.r * 2, b.color.g * 2, b.color.b * 2);
    });
    this.flareColors.needsUpdate = true;
  }
}
