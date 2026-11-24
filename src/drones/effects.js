import * as THREE from 'three';

/** Color palettes (sRGB hex). Gradients wrap around so animated sweeps are seamless. */
export const PALETTES = {
  aurora: { name: 'Aurora', colors: ['#00ffa3', '#00c2ff', '#7a5cff'] },
  sunset: { name: 'Sunset', colors: ['#ff4e6a', '#ffb347', '#ff2fa0'] },
  ice: { name: 'Ice', colors: ['#ffffff', '#8fd3ff', '#3a7bff'] },
  fire: { name: 'Fire', colors: ['#ff2200', '#ff8800', '#ffdd00'] },
  neon: { name: 'Neon', colors: ['#ff00e6', '#00f0ff', '#b6ff00'] },
  royal: { name: 'Royal', colors: ['#ffd24a', '#ffffff', '#7b2bff'] },
  love: { name: 'Love', colors: ['#ff0040', '#ff5c9a', '#ffc2d4'] },
  ocean: { name: 'Ocean', colors: ['#00e5ff', '#0066ff', '#00ffb3'] },
  gold: { name: 'Gold', colors: ['#ffd27a', '#ffb300', '#fff3c4'] },
  lotus: { name: 'Lotus', colors: ['#ff7fb0', '#ffd1e3', '#ffffff'] },
  saffron: { name: 'Saffron', colors: ['#ff9f1c', '#ffd166', '#ff5e00'] },
  moon: { name: 'Moonlight', colors: ['#fff6d6', '#ffe39a', '#ffffff'] },
  robe: { name: 'Robe saffron', colors: ['#ff8a1c', '#e0531a', '#ffb347'] },
  xmas: { name: 'Christmas', colors: ['#e0262e', '#1fa64a', '#ffd45a'] },
  snow: { name: 'Snow', colors: ['#ffffff', '#cfe9ff', '#8fc8ff'] },
  candy: { name: 'Candy', colors: ['#ff2d55', '#ffffff', '#ff8fab'] },
  champagne: { name: 'Champagne', colors: ['#ffd27a', '#fff6d8', '#c9d3e6'] },
  party: { name: 'Party', colors: ['#ffd24a', '#ff3db4', '#3dd6ff'] },
};

const cache = new Map();
export function paletteColors(id) {
  if (!cache.has(id)) {
    const p = PALETTES[id] || PALETTES.aurora;
    cache.set(id, p.colors.map((h) => new THREE.Color(h)));
  }
  return cache.get(id);
}

export function samplePalette(cols, t, out) {
  t = ((t % 1) + 1) % 1;
  const n = cols.length;
  const x = t * n;
  const i = Math.floor(x) % n;
  const j = (i + 1) % n;
  const f = x - Math.floor(x);
  const a = cols[i], b = cols[j];
  out.r = a.r + (b.r - a.r) * f;
  out.g = a.g + (b.g - a.g) * f;
  out.b = a.b + (b.b - a.b) * f;
  return out;
}

const WHITE = new THREE.Color(1, 1, 1);

/**
 * Light effects. Each writes a color into `o` and returns a brightness multiplier.
 * d = { lx, ly, lz (local position), R (formation radius), t (seconds), pal, shift,
 *       rand, phase (per drone), hasBase, br, bg, bb (point color from an image) }
 */
export const EFFECTS = {
  palette: {
    name: 'Color gradient',
    fn(o, d) {
      samplePalette(d.pal, (d.lx / d.R) * 0.35 + (d.ly / d.R) * 0.15 + d.t * 0.04 + d.shift, o);
      return 1;
    },
  },
  rainbow: {
    name: 'Rainbow sweep',
    fn(o, d) {
      o.setHSL((((d.lx / d.R) * 0.3 + (d.ly / d.R) * 0.15 - d.t * 0.12 + d.shift) % 1 + 1) % 1, 1, 0.55);
      return 1;
    },
  },
  wave: {
    name: 'Light wave',
    fn(o, d) {
      samplePalette(d.pal, (d.ly / d.R) * 0.3 + d.t * 0.05 + d.shift, o);
      const w = 0.5 + 0.5 * Math.sin((d.ly / d.R) * 6 + (d.lx / d.R) * 2 - d.t * 3);
      return 0.3 + 0.9 * w;
    },
  },
  twinkle: {
    name: 'Twinkle',
    fn(o, d) {
      samplePalette(d.pal, d.rand + d.shift, o);
      const spark = Math.pow(Math.max(0, Math.sin(d.t * (1.5 + d.rand * 3) + d.phase)), 24);
      o.lerp(WHITE, spark * 0.85);
      return 0.6 + spark * 0.8;
    },
  },
  pulse: {
    name: 'Pulse rings',
    fn(o, d) {
      const r = Math.sqrt(d.lx * d.lx + d.ly * d.ly + d.lz * d.lz) / d.R;
      samplePalette(d.pal, r * 0.7 - d.t * 0.2 + d.shift, o);
      return 0.35 + 0.85 * Math.pow(0.5 + 0.5 * Math.sin(r * 12 - d.t * 5), 2);
    },
  },
  chase: {
    name: 'Chase',
    fn(o, d) {
      const a = Math.atan2(d.ly, d.lx);
      samplePalette(d.pal, a / (Math.PI * 2) + d.shift, o);
      return 0.2 + 1.1 * Math.pow(0.5 + 0.5 * Math.sin(a * 3 - d.t * 4), 4);
    },
  },
  strobe: {
    name: 'Strobe',
    fn(o, d) {
      samplePalette(d.pal, d.rand * 0.999 + d.shift, o);
      const on = (d.t * 2.5 + (d.ly / d.R) * 0.15) % 1 < 0.22;
      return on ? 1.5 : 0.12;
    },
  },
  solid: {
    name: 'Solid color',
    fn(o, d) {
      samplePalette(d.pal, d.shift, o);
      return 1;
    },
  },
  glitter: {
    name: 'Golden glitter',
    fn(o, d) {
      if (d.hasBase) o.setRGB(d.br, d.bg, d.bb);
      else samplePalette(d.pal, (d.ly / d.R) * 0.25 + d.shift, o);
      const spark = Math.pow(Math.max(0, Math.sin(d.t * (3 + d.rand * 5) + d.phase * 3)), 40);
      o.lerp(WHITE, spark * 0.7);
      return 0.95 + spark * 1.3;
    },
  },
  weave: {
    name: 'Weaving (loom)',
    // d.role / d.meta come from the loom formation; d.st = seconds since this step began; d.dur = step length
    fn(o, d) {
      const m = d.meta;
      if (!m || d.role === 255) {
        samplePalette(d.pal, (d.lx / d.R) * 0.35 + d.shift, o);
        return 1;
      }
      if (d.role === 0) { o.setRGB(0.6, 0.3, 0.09); return 0.75; } // wooden frame
      if (d.role === 3) { o.setRGB(1.0, 0.55, 0.15); return 1.3 + 0.3 * Math.sin(d.t * 9 + d.phase); } // lanterns
      const nx = (d.lx - m.x0) / (m.x1 - m.x0);
      const ny = (d.ly - m.y0) / (m.y1 - m.y0);
      const p = Math.min(1, Math.max(0, (d.st - 3.2) / Math.max(3, d.dur - 5)));
      const bands = m.bands;
      const pos = p * bands;
      const cur = Math.floor(pos);
      const frac = pos - cur;
      const goingRight = cur % 2 === 0;
      const shuttle = goingRight ? frac : 1 - frac;
      const band = Math.min(bands - 1, Math.floor(ny * bands));
      const woven = () => {
        samplePalette(d.pal, ny * 0.12 + d.shift, o);
        const ci = Math.round((d.lx - m.x0) / m.s), ri = Math.round((d.ly - m.y0) / m.s);
        return (ci + ri) % 2 ? 0.78 : 1.0; // plain-weave checker texture
      };
      if (band < cur || p >= 1) return woven();
      if (band === cur) {
        if (Math.abs(nx - shuttle) < 0.06) { o.setRGB(1.0, 0.95, 0.8); return 3.0; } // the shuttle
        if (goingRight ? nx < shuttle : nx > shuttle) return woven();
      }
      if (d.role === 1) { o.setRGB(0.95, 0.88, 0.7); return 0.3; } // bare warp thread
      return 0; // weft not woven yet
    },
  },
  image: {
    name: 'Image colors',
    fn(o, d) {
      if (d.hasBase) o.setRGB(d.br, d.bg, d.bb);
      else samplePalette(d.pal, (d.lx / d.R) * 0.35 + d.shift, o);
      return 1.1;
    },
  },
};
