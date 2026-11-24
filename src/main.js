import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { glowUniforms, easeInOut } from './util/common.js';
import { createSky } from './scene/sky.js';
import { createCity } from './scene/city.js';
import { createWater } from './scene/water.js';
import { Spotlights } from './scene/spotlights.js';
import { Lasers } from './scene/lasers.js';
import { Fireworks } from './scene/fireworks.js';
import { createMoon, createLanterns } from './scene/festival.js';
import { createShwedagon } from './scene/shwedagon.js';
import { TitleCard } from './scene/titlecard.js';
import { FireBalloons } from './scene/balloons.js';
import { createChristmasScene } from './scene/christmas.js';
import { createNewYearScene } from './scene/newyear.js';
import { THEMES, initialTheme, rememberThemeChoice, fillYear, nextMidnight } from './themes.js';
import { DroneSwarm } from './drones/swarm.js';
import { SHOW_CENTER } from './drones/formations.js';
import { ShowController } from './show/show.js';
import { AudioEngine } from './audio/audio.js';
import { initUI } from './ui/ui.js';

const isMobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;

// ---------- Renderer ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance' });
const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 1, 7000);

const CAMERAS = {
  riverbank: { pos: [0, 7, 215], target: [0, 128, -130] },
  aerial: { pos: [430, 330, 340], target: [0, 150, -160] },
  rooftop: { pos: [-200, 150, -10], target: [0, 205, -130] },
  bridge: { pos: [-430, 16, 150], target: [-60, 175, -130] },
  pagoda: { pos: [-215, 150, -600], target: [-430, 205, -760] },
};
camera.position.set(...CAMERAS.riverbank.pos);

const controls = new OrbitControls(camera, canvas);
controls.target.set(...CAMERAS.riverbank.target);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 40;
controls.maxDistance = 1500;
controls.maxPolarAngle = Math.PI * 0.53;
controls.autoRotateSpeed = 0.35;
controls.update();

// ---------- Scene ----------
const settings = {
  count: isMobile ? 800 : 1500,
  water: !isMobile,
  react: true,
  sensitivity: 1,
  lasers: true,
  fireworks: true,
};

const sky = createSky();
const city = createCity();
const water = createWater(renderer, isMobile ? 0.35 : 0.5);
water.setReflections(settings.water);
const spots = new Spotlights();
const lasers = new Lasers();
const fireworks = new Fireworks();
const moon = createMoon();
const lanterns = createLanterns(isMobile ? 50 : 90);
const shwedagon = createShwedagon();
const balloons = new FireBalloons(fireworks, isMobile ? { pool: 8, ambient: 3 } : { pool: 16, ambient: 6 });
balloons.seed();
const xmas = createChristmasScene(city.lots, { mobile: isMobile });
xmas.snow.visible = false;
xmas.decor.visible = false;
const newyear = createNewYearScene(city.lots, { mobile: isMobile });
newyear.decor.visible = false;
scene.add(sky.group, moon.mesh, city.group, shwedagon.group, water.group, spots.group, lasers.group, fireworks.group, lanterns.points, balloons.group, xmas.snow, xmas.decor, newyear.decor, newyear.confetti);
lasers.setResolution(window.innerWidth, window.innerHeight);

const swarm = new DroneSwarm(scene, settings.count, SHOW_CENTER);
const show = new ShowController(swarm);
const audio = new AudioEngine();

// Firework booms arrive later the farther away the burst is (sound is slower than light).
fireworks.onBurst = (x, y, z, type) => {
  const dist = camera.position.distanceTo(new THREE.Vector3(x, y, z));
  audio.boom(Math.min(2.2, dist / 420), type, Math.max(0.3, Math.min(1, 380 / dist)));
};
// Browsers only allow sound after a user interaction.
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

// ---------- Post-processing (glow) ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomScale = isMobile ? 0.5 : 1;
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth * bloomScale, window.innerHeight * bloomScale),
  0.9, 0.75, 0.5
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Title / end cards are drawn on top of the finished frame (so they are in recordings too)
const titleCard = new TitleCard();
const syncTitleSize = () => {
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  titleCard.resize(v.x, v.y);
};

// Render size: the window normally, or a fixed video size (1080p, vertical…) while recording.
let fixedSize = null;
const viewW = () => (fixedSize ? fixedSize[0] : window.innerWidth);
const viewH = () => (fixedSize ? fixedSize[1] : window.innerHeight);

function fitFov() {
  const aspect = viewW() / viewH();
  // keep at least ~62° horizontally so formations fit on portrait phones
  const minV = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(31)) / aspect));
  camera.fov = Math.min(95, Math.max(56, minV));
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
fitFov();

function updatePointScale() {
  glowUniforms.uScale.value = viewH() / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  glowUniforms.uPixelRatio.value = renderer.getPixelRatio();
}
updatePointScale();

function applySize() {
  const w = viewW(), h = viewH();
  const pr = fixedSize ? 1 : pixelRatio;
  fitFov();
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, !fixedSize); // a fixed size keeps the on-screen size; CSS letterboxes it
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  bloom.resolution.set(w * bloomScale, h * bloomScale);
  updatePointScale();
  lasers.setResolution(w, h);
  canvas.style.objectFit = fixedSize ? 'contain' : '';
  syncTitleSize();
}
window.addEventListener('resize', applySize);
syncTitleSize();

// ---------- Camera moves ----------
let tween = null;
function setCamera(name) {
  const c = CAMERAS[name];
  if (!c) return;
  tween = {
    t: 0,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(...c.pos),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(...c.target),
  };
}

// ---------- New Year: live countdown to real midnight ----------
let liveTarget = null; // epoch ms of the midnight we count down to
let liveIsPractice = false;
let celebrateUntil = 0;
const liveClock = document.getElementById('liveClock');
function setLiveMidnight(target, practice = false) {
  liveTarget = target;
  liveIsPractice = practice;
  show.liveMode = !!target;
  show.midnightArmed = false;
  if (target && !practice) show.year = new Date(target).getFullYear();
  liveClock.hidden = !target;
}
const fmtLeft = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(sec).padStart(2, '0')}`;
};
function updateLiveCountdown(now) {
  if (liveTarget) {
    const left = liveTarget - Date.now();
    const cd = show.steps.find((s) => s.formation === 'countdown');
    const lead = (cd ? cd.duration : 10) * 1000;
    if (!show.midnightArmed && left <= lead && left > 0) {
      show.midnightArmed = true;
      show.startCountdownAt(left);
    }
    if (left <= 0) {
      celebrateUntil = now + 60;
      liveClock.textContent = `🎆 Happy New Year ${show.year}!`;
      setLiveMidnight(null);
      liveClock.hidden = false;
      return;
    }
    liveClock.textContent = `⏳ ${fmtLeft(left)} to midnight${liveIsPractice ? ' (practice)' : ''}`;
  } else if (celebrateUntil && now > celebrateUntil) {
    celebrateUntil = 0;
    liveClock.hidden = true;
  }
}

const fx = { flash: 0, shift: 0, nextRocket: 0 };

// ---------- Occasion themes ----------
const params = new URLSearchParams(location.search);
const themeListeners = new Set();
function applyTheme(id, { manual = false } = {}) {
  const th = THEMES[id] || THEMES.tazaungdaing;
  settings.theme = id;
  shwedagon.group.visible = th.scene.pagoda;
  moon.mesh.visible = th.scene.moon;
  lanterns.points.visible = th.scene.lanterns;
  balloons.group.visible = th.scene.balloons !== 'off';
  xmas.snow.visible = th.scene.snow;
  xmas.decor.visible = th.scene.xmas;
  newyear.decor.visible = !!th.scene.party;
  show.setTheme(id, th.build, { balloons: th.scene.balloons });
  // title-card texts follow the theme, but only when the theme changes (so the viewer's own edits stay)
  const y = show.year;
  const titles = Object.fromEntries(Object.entries(th.title).map(([k, v]) => [k, fillYear(v, y)]));
  if (titleCard.text.theme !== id) titleCard.set({ ...titles, theme: id });
  if (id !== 'newyear') setLiveMidnight(null);
  if (audio.mode === 'demo' && audio.style !== th.music) audio.startDemo(th.music);
  if (manual) rememberThemeChoice(id);
  themeListeners.forEach((fn) => fn(id, th));
  return th;
}
applyTheme(initialTheme(params));
// A personal greeting link: ?theme=christmas&to=Mya&from=Ko%20Aung
if (params.get('to') || params.get('from')) {
  const to = (params.get('to') || '').slice(0, 24), from = (params.get('from') || '').slice(0, 40);
  show.setGreeting(to, from);
  const th = THEMES[settings.theme];
  titleCard.set({ title: to ? th.greeting.title.replace('{to}', to) : fillYear(th.title.title, show.year), presenter: from });
}

// ---------- App API used by the UI ----------
const app = {
  show, audio, settings, titleCard, themes: THEMES,
  onTheme: (fn) => themeListeners.add(fn),
  async setTheme(id) {
    const th = applyTheme(id, { manual: true });
    await show.start();
    show.setPlaying(true);
    return th;
  },
  setGreeting(to, from) {
    show.setGreeting(to, from);
    const th = THEMES[settings.theme];
    titleCard.set({ title: to ? th.greeting.title.replace('{to}', to) : fillYear(th.title.title, show.year), presenter: from || titleCard.text.presenter });
  },
  setSnow: (on) => (xmas.snow.visible = on),
  setPartyDecor: (on) => (newyear.decor.visible = on),
  /** New Year live mode: count down to the coming local midnight. */
  setLiveMidnight(on) {
    setLiveMidnight(on ? nextMidnight() : null);
    if (on) { show.setPlaying(true); }
  },
  /** Rehearse the midnight moment: “midnight” arrives in `seconds`. */
  practiceCountdown(seconds = 30) {
    audio.unlock();
    setLiveMidnight(Date.now() + seconds * 1000, true);
    show.setPlaying(true);
  },
  setXmasDecor: (on) => (xmas.decor.visible = on),
  setCamera,
  setOrbit: (on) => (controls.autoRotate = on),
  setSpotlights: (on) => (spots.group.visible = on),
  setWater: (on) => { settings.water = on; water.setReflections(on); },
  setBloom: (v) => (bloom.strength = v),
  setMoon: (on) => (moon.mesh.visible = on),
  setLanterns: (on) => (lanterns.points.visible = on),
  setPagoda: (on) => (shwedagon.group.visible = on),
  setBalloons: (on) => (balloons.group.visible = on),
  launchBalloon: () => balloons.launchOne(),
  /** [w, h] in pixels, or null to follow the window. */
  setRenderSize(size) {
    fixedSize = size;
    applySize();
  },
  fireVolley() {
    audio.unlock();
    fireworks.volley(6, { center: SHOW_CENTER, palette: show.look.colors });
  },
  async setDroneCount(n) {
    settings.count = n;
    swarm.build(n);
    await show.rebuild();
  },
};
const ui = initUI(app);

// countdown ticks, and the midnight celebration
show.on((type) => {
  if (type === 'tick') {
    audio.tick(show.lastTick);
    fx.flash = 1;
  }
  if (type === 'step' && show.current?.celebrate) {
    audio.cheer();
    fireworks.volley(12, { center: SHOW_CENTER, palette: show.look.colors });
  }
});

// ---------- Main loop ----------
let last = performance.now() / 1000;

function frame() {
  const now = performance.now() / 1000;
  const dt = Math.min(0.05, now - last);
  last = now;

  audio.update(now);
  const react = settings.react && audio.mode !== 'none';
  const sens = settings.sensitivity;
  fx.flash = audio.beat ? 1 : fx.flash * Math.exp(-dt * 5);
  if (audio.beat && react) fx.shift += 0.07;

  show.update(dt);
  swarm.update(now, dt, {
    effect: show.look.effect,
    colors: show.look.colors,
    duration: show.look.duration,
    shift: fx.shift,
    bass: react ? audio.bass * sens : 0,
    flash: react ? fx.flash * sens * 0.6 : 0,
  });
  spots.update(now, dt, show.look.colors, react ? audio.level * 2 * sens : 0, react && audio.beat);
  lasers.update(now, dt, {
    mode: settings.lasers ? show.look.laser : 'off',
    colors: show.look.colors,
    swarm,
    energy: react ? audio.level * 1.5 * sens : 0,
    beat: react && audio.beat,
    shift: fx.shift,
  });

  // Automatic fireworks for steps that ask for them (extra rockets on strong beats)
  const fwMode = settings.fireworks ? show.look.fireworks : 'off';
  if (fwMode !== 'off' && show.playing) {
    const lots = fwMode === 'lots';
    if (now > fx.nextRocket || (lots && react && audio.beat && Math.random() < 0.5)) {
      fireworks.launch({ center: SHOW_CENTER, palette: show.look.colors });
      fx.nextRocket = now + (lots ? 0.25 + Math.random() * 0.45 : 1.0 + Math.random() * 1.4);
    }
  }
  balloons.setMode(show.look.balloons || 'few');
  balloons.update(now, dt);
  fireworks.update(now, dt);
  moon.update(camera);
  shwedagon.update(now, camera);
  lanterns.update(now, dt);
  xmas.update(now);
  newyear.update(now, dt, show.look.confetti);
  updateLiveCountdown(now);

  glowUniforms.uTime.value = now;
  sky.update(now, renderer.getPixelRatio());
  city.update(now);
  water.update(now);

  if (tween) {
    tween.t = Math.min(1, tween.t + dt / 1.8);
    const e = easeInOut(tween.t);
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
    if (tween.t >= 1) tween = null;
  }
  controls.update();

  composer.render();
  titleCard.render(renderer);
  ui.frame();
  requestAnimationFrame(frame);
}

show.start(last).then(() => {
  // let the audience see the drones sitting on the launch pad, then begin
  requestAnimationFrame(frame);
});
// Offline support + home-screen install (production builds only; the dev server is never cached)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

if (import.meta.env.DEV) window.__app = { ...app, swarm, fireworks, balloons, lanterns };
