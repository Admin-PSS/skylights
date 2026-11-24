import * as THREE from 'three';

const STORAGE_KEY = 'skylights.title.v1';

export const DEFAULT_TITLE = {
  title: 'Happy Tazaungdaing',
  subtitle: 'တန်ဆောင်မုန်းလပြည့် · Festival of Lights',
  dateLine: 'Full Moon of Tazaungmon · 2026',
  presenter: '',
  endTitle: 'ကျေးဇူးတင်ပါတယ်',
  endSub: 'Thank you for watching',
  intro: true,
  outro: true,
  credit: false,
};

const FONT_STACK = '"Segoe UI", "Myanmar Text", "Noto Sans Myanmar", Padauk, system-ui, sans-serif';
const TITLE_STACK = 'Georgia, "Times New Roman", "Myanmar Text", "Noto Serif Myanmar", Padauk, serif';

/**
 * Title / end cards and an optional corner credit, drawn into the WebGL canvas after the 3D scene,
 * so they appear on screen and in recorded videos.
 */
export class TitleCard {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
    this.text = this._load();

    const layer = () => {
      const canvas = document.createElement('canvas');
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false })
      );
      mesh.visible = false;
      this.scene.add(mesh);
      return { canvas, tex, mesh };
    };
    this.card = layer();
    this.credit = layer();
    this.kind = 'intro';
    this.anim = null;
    this.w = 1; this.h = 1;
    this.dirty = true;
  }

  // ---------- settings ----------
  set(values) {
    Object.assign(this.text, values);
    this.dirty = true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.text)); } catch { /* optional */ }
  }
  _load() {
    try {
      return { ...DEFAULT_TITLE, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch {
      return { ...DEFAULT_TITLE };
    }
  }

  /** Size in drawing-buffer pixels. */
  resize(w, h) {
    this.w = w; this.h = h;
    Object.assign(this.camera, { left: 0, right: w, top: h, bottom: 0 });
    this.camera.updateProjectionMatrix();
    this.card.mesh.scale.set(w, h, 1);
    this.card.mesh.position.set(w / 2, h / 2, 0);
    this.dirty = true;
  }

  /** Play a card. kind: 'intro' | 'outro'. Resolves when it has faded out. */
  play(kind = 'intro', hold = 4.5) {
    this.kind = kind;
    this.dirty = true;
    this.anim?.resolve?.();
    return new Promise((resolve) => {
      this.anim = { t0: performance.now() / 1000, hold, resolve };
    });
  }
  get playing() { return !!this.anim; }
  cancel() { this.anim?.resolve?.(); this.anim = null; }

  // ---------- drawing ----------
  _fit(g, text, font, size, maxW) {
    let s = size;
    g.font = font(s);
    while (g.measureText(text).width > maxW && s > 10) { s *= 0.94; g.font = font(s); }
    return s;
  }

  _ornament(g, cx, y, half, s) {
    const grad = g.createLinearGradient(cx - half, 0, cx + half, 0);
    grad.addColorStop(0, 'rgba(255,200,90,0)');
    grad.addColorStop(0.5, 'rgba(255,214,120,0.95)');
    grad.addColorStop(1, 'rgba(255,200,90,0)');
    g.fillStyle = grad;
    g.fillRect(cx - half, y - 1.2 * s, half * 2, 2.4 * s);
    g.save();
    g.translate(cx, y);
    g.rotate(Math.PI / 4);
    g.fillStyle = '#ffe3a0';
    g.shadowColor = 'rgba(255,190,80,0.9)';
    g.shadowBlur = 14 * s;
    g.fillRect(-6 * s, -6 * s, 12 * s, 12 * s);
    g.restore();
  }

  _drawCard() {
    const { canvas } = this.card;
    const k = Math.min(1, 2048 / Math.max(this.w, this.h));
    const W = (canvas.width = Math.max(2, Math.round(this.w * k)));
    const H = (canvas.height = Math.max(2, Math.round(this.h * k)));
    const g = canvas.getContext('2d');
    const s = Math.min(W, H) / 1080;
    const cx = W / 2;
    const t = this.text;

    // darken the scene behind the text, more at the edges
    const vg = g.createRadialGradient(cx, H / 2, Math.min(W, H) * 0.15, cx, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(4,3,12,0.45)');
    vg.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const maxW = W * 0.86;
    const big = this.kind === 'intro' ? t.title : t.endTitle;
    const lines = String(big || '').split('|').map((x) => x.trim()).filter(Boolean);

    // layout from top to bottom, then centre the block vertically
    const items = [];
    if (this.kind === 'intro' && t.dateLine) items.push({ type: 'small', text: t.dateLine.toUpperCase(), size: 26 });
    items.push({ type: 'orn' });
    lines.forEach((l) => items.push({ type: 'title', text: l, size: lines.length > 1 ? 96 : 118 }));
    const sub = this.kind === 'intro' ? t.subtitle : t.endSub;
    if (sub) items.push({ type: 'sub', text: sub, size: 40 });
    items.push({ type: 'orn' });
    if (t.presenter) {
      items.push({ type: 'small', text: this.kind === 'intro' ? 'PRESENTED BY' : 'BY', size: 22 });
      items.push({ type: 'name', text: t.presenter, size: 42 });
    }
    if (this.kind === 'outro' && t.title) items.push({ type: 'small', text: t.title.replace(/\|/g, ' ').toUpperCase(), size: 24 });

    const gap = (it) => ({ small: 54, orn: 46, title: 150, sub: 76, name: 62 }[it.type] * s);
    let total = items.reduce((a, it) => a + gap(it), 0);
    let y = H / 2 - total / 2;

    for (const it of items) {
      const hgt = gap(it);
      const my = y + hgt / 2;
      if (it.type === 'orn') {
        this._ornament(g, cx, my, Math.min(W * 0.32, 300 * s), s);
      } else if (it.type === 'title') {
        const size = this._fit(g, it.text, (px) => `700 ${px}px ${TITLE_STACK}`, it.size * s, maxW);
        const grad = g.createLinearGradient(0, my - size / 2, 0, my + size / 2);
        grad.addColorStop(0, '#fff6d8');
        grad.addColorStop(0.45, '#ffd060');
        grad.addColorStop(1, '#e8901a');
        g.shadowColor = 'rgba(255,170,50,0.75)';
        g.shadowBlur = 36 * s;
        g.fillStyle = grad;
        g.fillText(it.text, cx, my);
        g.shadowBlur = 0;
        g.fillText(it.text, cx, my);
      } else {
        const weight = it.type === 'name' ? 600 : it.type === 'sub' ? 500 : 600;
        const color = it.type === 'small' ? 'rgba(255,226,170,0.85)' : it.type === 'name' ? '#ffffff' : '#fff0d0';
        if ('letterSpacing' in g) g.letterSpacing = it.type === 'small' ? `${6 * s}px` : '0px';
        this._fit(g, it.text, (px) => `${weight} ${px}px ${FONT_STACK}`, it.size * s, maxW);
        g.shadowColor = 'rgba(0,0,0,0.8)';
        g.shadowBlur = 10 * s;
        g.fillStyle = color;
        g.fillText(it.text, cx, my);
        g.shadowBlur = 0;
        if ('letterSpacing' in g) g.letterSpacing = '0px';
      }
      y += hgt;
    }
    this.card.tex.dispose(); // canvas size may have changed: re-create the GPU texture
    this.card.tex.needsUpdate = true;
  }

  _drawCredit() {
    const t = this.text;
    const label = [t.presenter, t.title.replace(/\|/g, ' ')].filter(Boolean).join('  ·  ');
    const { canvas, mesh, tex } = this.credit;
    const s = Math.min(this.w, this.h) / 1080;
    const fs = Math.round(24 * s);
    const g = canvas.getContext('2d');
    const font = `600 ${fs}px ${FONT_STACK}`;
    g.font = font;
    const tw = Math.ceil(g.measureText(label).width);
    canvas.width = Math.max(2, tw + Math.round(40 * s));
    canvas.height = Math.max(2, Math.round(fs * 2));
    g.font = font;
    g.textAlign = 'right';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 8 * s;
    g.fillStyle = 'rgba(255,232,190,0.85)';
    g.fillText(label, canvas.width - 10 * s, canvas.height / 2);
    tex.dispose(); // canvas size changes with the text: re-create the GPU texture
    tex.needsUpdate = true;
    const margin = 26 * s;
    mesh.scale.set(canvas.width, canvas.height, 1);
    mesh.position.set(this.w - margin - canvas.width / 2, margin + canvas.height / 2, 0);
  }

  // ---------- per frame ----------
  render(renderer) {
    if (this.dirty) {
      this._drawCard();
      this._drawCredit();
      this.dirty = false;
    }
    let a = 0, scale = 1;
    if (this.anim) {
      const e = performance.now() / 1000 - this.anim.t0;
      const fin = 0.9, fout = 1.1, hold = this.anim.hold;
      if (e < fin) a = e / fin;
      else if (e < fin + hold) a = 1;
      else if (e < fin + hold + fout) a = 1 - (e - fin - hold) / fout;
      else { a = 0; const r = this.anim.resolve; this.anim = null; r?.(); }
      a = a * a * (3 - 2 * a);
      scale = 1.035 - 0.035 * Math.min(1, e / (fin + hold));
    }
    this.card.mesh.visible = a > 0.001;
    this.card.mesh.material.opacity = a;
    this.card.mesh.scale.set(this.w * scale, this.h * scale, 1);
    const showCredit = this.text.credit && (this.text.presenter || this.text.title);
    this.credit.mesh.visible = !!showCredit && a < 0.98;
    this.credit.mesh.material.opacity = (1 - a) * 0.9;
    if (!this.card.mesh.visible && !this.credit.mesh.visible) return;
    const ac = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = ac;
  }
}
