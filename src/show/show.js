import { buildFormation, FORMATIONS } from '../drones/formations.js';
import { EFFECTS, PALETTES, paletteColors } from '../drones/effects.js';


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

/** Christmas & New Year. The greeting step personalises itself: “MERRY CHRISTMAS | MYA”. */
export function christmasShow() {
  return [
    step('launch', 'solid', 'snow', 4),
    step('lift', 'wave', 'xmas', 6, { laser: 'fan' }),
    step('snowflake', 'twinkle', 'snow', 8),
    step('text', 'glitter', 'xmas', 9, { text: 'MERRY CHRISTMAS', greet: 'MERRY CHRISTMAS|{to}', laser: 'fan' }),
    step('xmastree', 'glitter', 'xmas', 12, { laser: 'target', fireworks: 'some' }),
    step('santa', 'image', 'xmas', 11),
    step('gift', 'glitter', 'xmas', 8, { laser: 'web' }),
    step('snowman', 'image', 'snow', 8),
    step('bells', 'glitter', 'xmas', 8, { fireworks: 'some' }),
    step('candycane', 'image', 'candy', 7),
    step('text', 'glitter', 'xmas', 8, { text: 'ပျော်ရွှင်ဖွယ်|ခရစ္စမတ်' }),
    step('text', 'pulse', 'royal', 9, { text: 'HAPPY NEW YEAR|{year}', laser: 'fan', fireworks: 'lots' }),
    step('burst', 'pulse', 'xmas', 8, { laser: 'fan', fireworks: 'lots' }),
    step('land', 'solid', 'snow', 7),
  ];
}

/**
 * New Year's Eve. The countdown and the year reveal are “midnight” steps: in live mode they wait
 * for real midnight, so 1 → 0 lands exactly on 00:00:00.
 */
export function newYearShow() {
  return [
    step('launch', 'solid', 'champagne', 4),
    step('lift', 'wave', 'champagne', 6, { laser: 'fan' }),
    step('text', 'glitter', 'royal', 9, { text: 'HAPPY|NEW YEAR', greet: 'HAPPY NEW YEAR|{to}', laser: 'fan' }),
    step('champagne', 'glitter', 'champagne', 9, { fireworks: 'some' }),
    step('clock', 'image', 'champagne', 8),
    step('countdown', 'pulse', 'party', 10, { from: 10, midnight: true, laser: 'fan' }),
    step('text', 'glitter', 'royal', 12, { text: '{year}', midnight: true, celebrate: true, confetti: true, laser: 'fan', fireworks: 'lots' }),
    step('burst', 'pulse', 'party', 8, { confetti: true, laser: 'fan', fireworks: 'lots' }),
    step('text', 'glitter', 'champagne', 8, { text: 'ပျော်ရွှင်ဖွယ်|နှစ်သစ်ကူး', confetti: true, fireworks: 'some' }),
    step('star', 'pulse', 'royal', 7, { laser: 'target' }),
    step('land', 'solid', 'champagne', 6),
  ];
}

/** The year that is about to begin — or, during January, the one that just began. */
export function upcomingYear(d = new Date()) {
  return d.getMonth() === 0 ? d.getFullYear() : d.getFullYear() + 1;
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

export const LASER_MODES = { off: 'Off', fan: 'Sweeping fans', target: 'Aim at drones', web: 'String-art web' };
export const FIREWORK_MODES = { off: 'Off', some: 'Some', lots: 'Finale (lots)' };
export const BALLOON_MODES = { few: 'A few drifting', launch: 'Mass launch', off: 'None' };

export function stepLabel(s) {
  if (s.formation === 'text') return `“${s.text.replace(/\|/g, ' ').replace('{year}', upcomingYear())}”${s.greet ? ' + name' : ''}`;
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
    this.themeId = 'tazaungdaing';
    this.build = festivalShow;
    this.defaults = { balloons: 'few' };
    this.greeting = { to: '', from: '' };
    this.steps = [];
    this.year = upcomingYear();
    this.liveMode = false; // New Year: hold midnight steps until real midnight
    this.midnightArmed = false;
    this._cd = null;
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

  /** Switch occasion: load this theme's saved show (or its default) and its scene defaults. */
  setTheme(id, build, defaults = {}) {
    this.themeId = id;
    this.build = build;
    this.defaults = { balloons: 'few', ...defaults };
    this.steps = this._load() || build();
    this.index = -1;
    this._emit('list');
  }

  /** Personal greeting (“To” / “From”); greeting steps re-render with the name. */
  setGreeting(to = '', from = '') {
    this.greeting = { to: to.trim(), from: from.trim() };
    if (this.current?.greet) this._show(this.current);
    this._emit('list');
  }

  /** The text a step shows, with the greeting name filled in where the step has one. */
  stepText(s) {
    const t = s.greet && this.greeting.to ? s.greet.replace('{to}', this.greeting.to.toUpperCase()) : s.text;
    return t && t.replace('{year}', this.year || upcomingYear());
  }

  async _formation(s) {
    const img = s.image ? `${s.image.length}:${s.image.slice(-48)}` : '';
    const text = this.stepText(s) || '';
    const key = `${s.formation}|${text}|${img}|${this.swarm.count}`;
    if (!this.cache.has(key)) this.cache.set(key, await buildFormation({ ...s, text }, this.swarm.count));
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
    this.look = { effect: s.effect, colors: paletteColors(s.palette), laser: s.laser || 'off', fireworks: s.fireworks || 'off', balloons: s.balloons || this.defaults.balloons, confetti: !!s.confetti, duration: s.duration };
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
    const s = this.steps[this.index];
    this._cd = null;
    await this._show(s);
    this._emit('step');
    if (s.formation === 'countdown') this._tick(s.from || 10);
  }

  /** Countdown: one drone digit per second (fast flights), with a tick each second. */
  _tick(n) {
    this._cd = n;
    this.lastTick = n;
    this._emit('tick');
  }
  async _showDigit(n) {
    const f = await this._formation({ formation: 'text', text: String(n) });
    if (this._cd === n) this.swarm.goTo(f, performance.now() / 1000, 0.8);
  }

  /** Live mode: start the countdown so that it reaches 0 exactly `msLeft` from now. */
  async startCountdownAt(msLeft) {
    const i = this.steps.findIndex((s) => s.formation === 'countdown');
    if (i < 0) return;
    const s = this.steps[i];
    await this.goTo(i);
    this.setPlaying(true);
    this.stepTime = Math.max(0, s.duration - msLeft / 1000);
    const n = (s.from || 10) - Math.floor(this.stepTime);
    if (n !== this._cd && n >= 1) { this._tick(n); this._showDigit(n); }
  }

  next() {
    let i = this.index + 1;
    // in live New Year mode, skip the countdown and year reveal until midnight arms them
    if (this.liveMode && !this.midnightArmed) {
      let guard = 0;
      while (this.steps[i % this.steps.length]?.midnight && guard++ < this.steps.length) i++;
    }
    if (i >= this.steps.length && !this.loop) {
      this.playing = false;
      this._emit('play');
      return;
    }
    this.goTo(i);
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
  /** Back to this theme's original show. */
  reset() {
    this.steps = this.build();
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
    const s = this.steps[this.index];
    if (s.formation === 'countdown' && this.current === s) {
      const n = (s.from || 10) - Math.floor(this.stepTime);
      if (n >= 1 && n !== this._cd) { this._tick(n); this._showDigit(n); }
    }
    if (this.stepTime >= s.duration) this.next();
  }

  get progress() {
    const s = this.steps[this.index];
    return s ? Math.min(1, this.stepTime / s.duration) : 0;
  }

  get _key() {
    // the Tazaungdaing show keeps its original storage key so earlier edits survive
    return this.themeId === 'tazaungdaing' ? 'skylights.show.v2' : `skylights.show.v2.${this.themeId}`;
  }

  _save() {
    try {
      localStorage.setItem(this._key, JSON.stringify(this.steps.map(({ id, ...rest }) => rest)));
    } catch { /* storage may be unavailable or full — the show still works */ }
  }
  _load() {
    try {
      const raw = localStorage.getItem(this._key);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || !arr.length) return null;
      return arr.filter((s) => FORMATIONS[s.formation]).map((s) => ({ ...s, id: uid++ }));
    } catch {
      return null;
    }
  }
}
