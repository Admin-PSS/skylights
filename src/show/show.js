import { buildFormation, FORMATIONS } from '../drones/formations.js';
import { EFFECTS, PALETTES, paletteColors } from '../drones/effects.js';

const STORAGE_KEY = 'skylights.show.v2';

let uid = 1;
const step = (formation, effect, palette, duration, extra = {}) => ({
  id: uid++, formation, effect, palette, duration, ...extra,
});

/** Tazaungdaing — the Festival of Lights on the full moon of Tazaungmon. */
export function festivalShow() {
  return [
    step('launch', 'solid', 'gold', 4),
    step('lift', 'wave', 'gold', 6, { laser: 'fan' }),
    step('moon', 'image', 'moon', 9),
    step('text', 'glitter', 'gold', 9, { text: 'တန်ဆောင်တိုင်', laser: 'fan' }),
    step('lotus', 'pulse', 'lotus', 8, { laser: 'web' }),
    step('pagoda', 'glitter', 'gold', 12, { laser: 'target', fireworks: 'some' }),
    // မီးပုံးပျံ — fire balloons: mass launch while the drones draw a balloon
    step('text', 'glitter', 'saffron', 7, { text: 'မီးပုံးပျံ', balloons: 'launch' }),
    step('balloon', 'image', 'saffron', 10, { fireworks: 'some', balloons: 'launch' }),
    // Matho Thingan: robes woven through the night, offered at dawn
    step('text', 'glitter', 'saffron', 7, { text: 'မသိုးသင်္ကန်း' }),
    step('loom', 'weave', 'robe', 16),
    step('robe', 'glitter', 'robe', 10),
    step('buddha', 'image', 'gold', 14), // calm and respectful: no lasers or fireworks
    step('text', 'wave', 'saffron', 9, { text: 'HAPPY TAZAUNGDAING', laser: 'fan', fireworks: 'some' }),
    step('burst', 'pulse', 'fire', 9, { laser: 'fan', fireworks: 'lots' }),
    step('land', 'solid', 'gold', 7),
  ];
}

export function demoShow() {
  return [
    step('launch', 'solid', 'ice', 4),
    step('lift', 'wave', 'ice', 6, { laser: 'fan' }),
    step('sphere', 'rainbow', 'neon', 9, { laser: 'target' }),
    step('heart', 'twinkle', 'love', 8),
    step('text', 'wave', 'neon', 8, { text: 'HELLO CITY' }),
    step('star', 'pulse', 'royal', 8),
    step('helix', 'palette', 'aurora', 9),
    step('galaxy', 'twinkle', 'ocean', 9),
    step('ring', 'chase', 'sunset', 8, { laser: 'web' }),
    step('flag', 'wave', 'sunset', 8),
    step('cube', 'rainbow', 'aurora', 8),
    step('burst', 'pulse', 'fire', 7, { laser: 'fan', fireworks: 'lots' }),
    step('text', 'palette', 'sunset', 8, { text: 'THANK YOU', fireworks: 'some' }),
    step('land', 'solid', 'ice', 7),
  ];
}

export const PRESETS = {
  tazaungdaing: { name: '🌕 Tazaungdaing Full Moon', build: festivalShow },
  city: { name: '🏙 City lights demo', build: demoShow },
};

export const LASER_MODES = { off: 'Off', fan: 'Sweeping fans', target: 'Aim at drones', web: 'String-art web' };
export const FIREWORK_MODES = { off: 'Off', some: 'Some', lots: 'Finale (lots)' };
export const BALLOON_MODES = { few: 'A few drifting', launch: 'Mass launch', off: 'None' };

export function stepLabel(s) {
  if (s.formation === 'text') return `“${s.text}”`;
  return FORMATIONS[s.formation]?.name ?? s.formation;
}
export function stepSub(s) {
  let sub = `${EFFECTS[s.effect]?.name ?? s.effect} · ${PALETTES[s.palette]?.name ?? s.palette} · ${s.duration}s`;
  if (s.laser && s.laser !== 'off') sub += ' · lasers';
  if (s.fireworks && s.fireworks !== 'off') sub += ' · fireworks';
  if (s.balloons === 'launch') sub += ' · fire balloons';
  return sub;
}

/** Plays a list of steps on the swarm, in order, with timing and looping. */
export class ShowController {
  constructor(swarm) {
    this.swarm = swarm;
    this.steps = this._load() || festivalShow();
    this.index = -1;
    this.playing = true;
    this.loop = true;
    this.stepTime = 0;
    this.current = null; // the step (or preview) currently displayed
    this.look = { effect: 'solid', colors: paletteColors('gold'), laser: 'off', fireworks: 'off' };
    this.cache = new Map();
    this.listeners = new Set();
    this._token = 0;
    this.ready = Promise.resolve();
  }

  on(fn) { this.listeners.add(fn); }
  _emit(type) { this.listeners.forEach((fn) => fn(type, this)); }

  async _formation(s) {
    const img = s.image ? `${s.image.length}:${s.image.slice(-48)}` : '';
    const key = `${s.formation}|${s.text || ''}|${img}|${this.swarm.count}`;
    if (!this.cache.has(key)) this.cache.set(key, await buildFormation(s, this.swarm.count));
    return this.cache.get(key);
  }

  /** Put drones directly into the first step's formation (no flight). */
  start(now) {
    this.ready = this._start(now);
    return this.ready;
  }

  async _start(now) {
    this.index = 0;
    const s = this.steps[0];
    this.swarm.place(await this._formation(s));
    this._applyLook(s);
    this.stepTime = 0;
    this._emit('step');
  }

  _applyLook(s) {
    this.current = s;
    this.look = { effect: s.effect, colors: paletteColors(s.palette), laser: s.laser || 'off', fireworks: s.fireworks || 'off', balloons: s.balloons || 'few', duration: s.duration };
  }

  async _show(s, now) {
    const token = ++this._token;
    await this.ready;
    const f = await this._formation(s);
    if (token !== this._token) return; // a newer request won
    const dur = Math.min(4, Math.max(2.5, s.duration * 0.45));
    this.swarm.goTo(f, now ?? performance.now() / 1000, dur);
    this._applyLook(s);
  }

  async goTo(i) {
    if (!this.steps.length) return;
    this.index = (i + this.steps.length) % this.steps.length;
    this.stepTime = 0;
    await this._show(this.steps[this.index]);
    this._emit('step');
  }

  next() {
    if (this.index + 1 >= this.steps.length && !this.loop) {
      this.playing = false;
      this._emit('play');
      return;
    }
    this.goTo(this.index + 1);
  }
  prev() { this.goTo(this.index - 1); }

  setPlaying(p) {
    this.playing = p;
    this._emit('play');
  }

  /** Show a step without adding it to the show; pauses playback so it stays visible. */
  async preview(s) {
    this.setPlaying(false);
    await this._show({ ...s, id: s.id ?? 'preview' });
    this._emit('step');
  }

  add(s) {
    const st = { ...s, id: uid++ };
    this.steps.push(st);
    this._save();
    this._emit('list');
    return st;
  }
  remove(i) {
    this.steps.splice(i, 1);
    if (this.index >= i) this.index = Math.max(0, this.index - 1);
    this._save();
    this._emit('list');
  }
  move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= this.steps.length) return;
    [this.steps[i], this.steps[j]] = [this.steps[j], this.steps[i]];
    if (this.index === i) this.index = j;
    else if (this.index === j) this.index = i;
    this._save();
    this._emit('list');
  }
  reset(preset = 'tazaungdaing') {
    this.steps = (PRESETS[preset] || PRESETS.tazaungdaing).build();
    this._save();
    this._emit('list');
    this.goTo(0);
  }

  /** Swarm size changed: rebuild formations and redisplay the current step. */
  async rebuild() {
    this.cache.clear();
    const s = this.current || this.steps[0];
    this.swarm.place(await this._formation(s));
    this._applyLook(s);
  }

  update(dt) {
    if (!this.playing || this.index < 0 || !this.steps.length) return;
    this.stepTime += dt;
    if (this.stepTime >= this.steps[this.index].duration) this.next();
  }

  get progress() {
    const s = this.steps[this.index];
    return s ? Math.min(1, this.stepTime / s.duration) : 0;
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.steps.map(({ id, ...rest }) => rest)));
    } catch { /* storage may be unavailable or full — the show still works */ }
  }
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return null;
      return arr.filter((s) => FORMATIONS[s.formation]).map((s) => ({ ...s, id: uid++ }));
    } catch {
      return null;
    }
  }
}
