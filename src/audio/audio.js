/**
 * Music input + analysis. Sources: a synthesized demo beat, a local music file, or the microphone.
 * Exposes smoothed bass / mid / high energy and a simple beat detector.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.mode = 'none'; // none | demo | file | mic
    this.bass = 0; this.mid = 0; this.high = 0; this.level = 0;
    this.beat = false;
    this.avgBass = 0;
    this.lastBeat = 0;
    this.onchange = null;
    this.sfxOn = true;
  }

  /** Audio stream (music + firework sounds, never the microphone) for video recording. */
  getRecordStream() {
    this._ensure();
    if (!this.recDest) {
      this.recDest = this.ctx.createMediaStreamDestination();
      this.bus.connect(this.recDest);
      this.sfx.connect(this.recDest);
    }
    return this.recDest.stream;
  }

  /** Countdown tick (higher for the last three seconds). */
  tick(n) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(n <= 3 ? 1500 : 1050, t);
    o.frequency.exponentialRampToValueAtTime(n <= 3 ? 900 : 620, t + 0.09);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(n <= 3 ? 0.5 : 0.32, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g); g.connect(this.sfx);
    o.start(t); o.stop(t + 0.16);
  }

  /** A crowd cheer at midnight (filtered noise swell). */
  cheer() {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    [[1300, 0.8, 0.45], [600, 0.5, 0.3], [2600, 2, 0.12]].forEach(([f, q, peak]) => {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noise; s.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.35);
      g.gain.setValueAtTime(peak, t + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
      s.connect(bp); bp.connect(g); g.connect(this.sfx);
      s.start(t, Math.random() * 0.5); s.stop(t + 3.8);
    });
  }

  /** Create/resume the audio context (must happen inside a user gesture). */
  unlock() {
    this._ensure();
  }

  /** Firework explosion sound, delayed like real sound travelling from far away. */
  boom(delay = 0, type = 'peony', loud = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxOn) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const env = (peak, decay) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      g.connect(this.sfx);
      return g;
    };
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + 1.2);
    src.connect(lp);
    lp.connect(env(0.8 * loud, 1.5));
    src.start(t, Math.random() * 0.3);
    src.stop(t + 1.6);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(75, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    o.connect(env(0.6 * loud, 0.7));
    o.start(t);
    o.stop(t + 0.8);
    if (type === 'glitter' || type === 'ring' || type === 'willow') {
      for (let k = 0; k < 22; k++) {
        const tc = t + 0.45 + Math.random() * 1.1;
        const s = ctx.createBufferSource();
        s.buffer = this.noise;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2500 + Math.random() * 3000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, tc);
        g.gain.exponentialRampToValueAtTime(0.07 * loud, tc + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, tc + 0.035);
        s.connect(hp); hp.connect(g); g.connect(this.sfx);
        s.start(tc, Math.random() * 0.5);
        s.stop(tc + 0.05);
      }
    }
  }

  _ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.7;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      this.bus = this.ctx.createGain();
      this.bus.connect(this.ctx.destination);
      this.bus.connect(this.analyser);
      // sound effects bypass the analyser so firework booms don't trigger "beats"
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.sfx.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _set(mode, label) {
    this.mode = mode;
    this.label = label;
    this.onchange?.(mode, label);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this.el) { this.el.pause(); this.el = null; }
    if (this.fileSource) { this.fileSource.disconnect(); this.fileSource = null; }
    if (this.micStream) { this.micStream.getTracks().forEach((t) => t.stop()); this.micStream = null; }
    if (this.micSource) { this.micSource.disconnect(); this.micSource = null; }
    if (this.demoOut) { this.demoOut.disconnect(); this.demoOut = null; }
    this._set('none', 'No music playing.');
  }

  async playFile(file) {
    this.stop();
    this._ensure();
    const el = new Audio();
    el.src = URL.createObjectURL(file);
    el.loop = true;
    this.el = el;
    this.fileSource = this.ctx.createMediaElementSource(el);
    this.fileSource.connect(this.bus);
    await el.play();
    this._set('file', `Playing: ${file.name}`);
  }

  async startMic() {
    this.stop();
    this._ensure();
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
    } catch (e) {
      this._set('none', 'Microphone not available or permission denied.');
      return;
    }
    this.micSource = this.ctx.createMediaStreamSource(this.micStream);
    this.micSource.connect(this.analyser); // analyse only — never route the mic to speakers
    this._set('mic', 'Listening to microphone…');
  }

  // ---------- Demo beat (synthesized, no files needed) ----------
  /** style: 'festival' (122 BPM groove) or 'jingle' (Jingle Bells, a public-domain 1857 melody, with sleigh bells). */
  startDemo(style = 'festival') {
    this.stop();
    this._ensure();
    this.demoOut = this.ctx.createGain();
    this.demoOut.gain.value = 0.55;
    this.demoOut.connect(this.bus);
    this.style = style;
    this.tempo = style === 'jingle' ? 132 : 122;
    this.loopLen = style === 'jingle' ? 256 : 64;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 25);
    this._set('demo', style === 'jingle' ? 'Playing: Jingle Bells demo (132 BPM)' : 'Playing: demo beat (122 BPM)');
  }

  _jingleStep(s, t, sp) {
    if (!this._melody) {
      // [midi, length in 16ths] — chorus of Jingle Bells
      const A = [[64, 4], [64, 4], [64, 8], [64, 4], [64, 4], [64, 8], [64, 4], [67, 4], [60, 6], [62, 2], [64, 16],
        [65, 4], [65, 4], [65, 6], [65, 2], [65, 4], [64, 4], [64, 4], [64, 2], [64, 2]];
      const end1 = [[64, 4], [62, 4], [62, 4], [64, 4], [62, 8], [67, 8]];
      const end2 = [[67, 4], [67, 4], [65, 4], [62, 4], [60, 16]];
      const seq = [...A, ...end1, ...A, ...end2];
      this._melody = new Map();
      let pos = 0;
      for (const [m, d] of seq) { this._melody.set(pos, [m, d]); pos += d; }
      this._roots = [48, 48, 48, 48, 41, 48, 50, 43, 48, 48, 48, 48, 41, 48, 43, 48];
    }
    const inBar = s % 16, bar = Math.floor(s / 16) % 16;
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    if (inBar === 0 || inBar === 8) this._kick(t);
    if (inBar === 4 || inBar === 12) this._snare(t);
    if (s % 2 === 0) this._sleigh(t);
    if (inBar % 4 === 0) {
      const root = this._roots[bar] + (inBar === 4 || inBar === 12 ? 7 : 0);
      this._bass(t, hz(root) * 2, sp * 3);
    }
    const note = this._melody.get(s);
    if (note) this._bellNote(t, hz(note[0] + 12), Math.min(1.2, note[1] * sp * 1.4));
  }

  _sleigh(t) {
    for (let k = 0; k < 2; k++) this._noise(t + k * 0.03, 0.04, 'highpass', 6500 + Math.random() * 2000, 0.07);
  }

  _bellNote(t, f, dur) {
    [[1, 0.16], [2, 0.06], [3.01, 0.03]].forEach(([mult, peak]) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      o.connect(this._env(t, peak, 0.004, 0.25 + dur));
      o.start(t);
      o.stop(t + dur + 0.35);
    });
  }

  _schedule() {
    const spStep = 60 / this.tempo / 4;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      if (this.style === 'jingle') this._jingleStep(this.step, this.nextTime, spStep);
      else this._playStep(this.step, this.nextTime, spStep);
      this.nextTime += spStep;
      this.step = (this.step + 1) % (this.loopLen || 64);
    }
  }

  _playStep(s, t, sp) {
    const inBar = s % 16;
    const bar = Math.floor(s / 16) % 4;
    const roots = [110, 87.31, 130.81, 98];
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [261.63, 329.63, 392],
      [196, 246.94, 293.66],
    ];
    if (inBar % 4 === 0) this._kick(t);
    if (inBar === 4 || inBar === 12) this._snare(t);
    if (inBar % 4 === 2) this._hat(t, 0.16);
    else if (s % 2 === 1) this._hat(t, 0.05);
    if ([0, 3, 6, 8, 11, 14].includes(inBar)) this._bass(t, roots[bar], sp * 1.6);
    if (inBar === 0) this._pad(t, chords[bar], sp * 16);
    if (inBar === 0 || inBar === 7 || inBar === 10) this._pluck(t, chords[bar][(inBar / 3) % 3 | 0] * 2, sp * 2);
  }

  _env(t, peak, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.demoOut);
    return g;
  }

  _kick(t) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    o.connect(this._env(t, 1.0, 0.003, 0.38));
    o.start(t); o.stop(t + 0.45);
  }

  _noise(t, dur, type, freq, peak) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    src.connect(f);
    f.connect(this._env(t, peak, 0.002, dur));
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  _snare(t) {
    this._noise(t, 0.18, 'bandpass', 1900, 0.45);
    const o = this.ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = 190;
    o.connect(this._env(t, 0.25, 0.002, 0.1));
    o.start(t); o.stop(t + 0.15);
  }

  _hat(t, v) { this._noise(t, 0.05, 'highpass', 7500, v); }

  _bass(t, f, dur) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f / 2;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380;
    o.connect(lp); lp.connect(this._env(t, 0.32, 0.01, dur));
    o.start(t); o.stop(t + dur + 0.05);
  }

  _pad(t, freqs, dur) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1400, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(600, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.4);
    g.gain.setValueAtTime(0.06, t + dur - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g); g.connect(this.demoOut);
    freqs.forEach((f) => [-6, 6].forEach((det) => {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }));
  }

  _pluck(t, f, dur) {
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    o.connect(lp); lp.connect(this._env(t, 0.07, 0.005, dur));
    o.start(t); o.stop(t + dur + 0.05);
  }

  // ---------- Analysis ----------
  update(now) {
    this.beat = false;
    if (this.mode === 'none' || !this.analyser) {
      this.bass *= 0.9; this.mid *= 0.9; this.high *= 0.9; this.level *= 0.9;
      return;
    }
    const a = this.data;
    this.analyser.getByteFrequencyData(a);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    const avg = (f0, f1) => {
      const i0 = Math.max(1, Math.floor(f0 / binHz)), i1 = Math.min(a.length - 1, Math.ceil(f1 / binHz));
      let s = 0;
      for (let i = i0; i <= i1; i++) s += a[i];
      return s / ((i1 - i0 + 1) * 255);
    };
    const bass = avg(30, 180), mid = avg(180, 2000), high = avg(2000, 9000);
    // fast attack, slow release
    this.bass = Math.max(bass, this.bass * 0.88);
    this.mid = Math.max(mid, this.mid * 0.9);
    this.high = Math.max(high, this.high * 0.9);
    this.level = (this.bass + this.mid + this.high) / 3;
    this.avgBass = this.avgBass * 0.96 + bass * 0.04;
    if (bass > this.avgBass * 1.18 + 0.04 && bass > 0.25 && now - this.lastBeat > 0.24) {
      this.beat = true;
      this.lastBeat = now;
    }
  }
}
