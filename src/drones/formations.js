import { mulberry32 } from '../util/common.js';

/** Formations are built in local coordinates around the show center (see main.js). */
export const SHOW_CENTER = { x: 0, y: 210, z: -130 };
export const GROUND_LOCAL_Y = -208; // just above the plaza floor

export const FORMATIONS = {
  launch: { name: 'Launch pad', icon: '▦' },
  lift: { name: 'Lift-off grid', icon: '▤' },
  sphere: { name: 'Sphere', icon: '●' },
  heart: { name: 'Heart', icon: '♥' },
  star: { name: 'Star', icon: '★' },
  helix: { name: 'DNA helix', icon: '🧬' },
  galaxy: { name: 'Spiral galaxy', icon: '🌀' },
  ring: { name: 'Ring', icon: '◯' },
  cube: { name: 'Cube', icon: '▣' },
  flag: { name: 'Waving flag', icon: '⚑' },
  burst: { name: 'Starburst', icon: '✺' },
  text: { name: 'Custom text', icon: 'T' },
  image: { name: 'Image / logo', icon: '🖼' },
  pagoda: { name: 'Pagoda (zedi)', icon: '🛕' },
  buddha: { name: 'Buddha (meditation)', icon: '☸' },
  lotus: { name: 'Lotus flower', icon: '❀' },
  moon: { name: 'Full moon', icon: '🌕' },
  balloon: { name: 'Fire balloon', icon: '🎈' },
  loom: { name: 'Weaving loom (Matho Thingan)', icon: '🧵' },
  robe: { name: 'Robe offering (Thingan)', icon: '🟧' },
  xmastree: { name: 'Christmas tree', icon: '🎄' },
  santa: { name: 'Santa’s sleigh', icon: '🛷' },
  snowman: { name: 'Snowman', icon: '⛄' },
  gift: { name: 'Gift box', icon: '🎁' },
  bells: { name: 'Christmas bells', icon: '🔔' },
  snowflake: { name: 'Snowflake', icon: '❄' },
  candycane: { name: 'Candy cane', icon: '🍬' },
  countdown: { name: 'Countdown 10 → 1', icon: '⏱' },
  clock: { name: 'Midnight clock', icon: '🕛' },
  champagne: { name: 'Champagne toast', icon: '🥂' },
  land: { name: 'Landing', icon: '▁' },
};

function make(pts, opts = {}) {
  const points = pts instanceof Float32Array ? pts : new Float32Array(pts);
  let R = 1;
  for (let i = 0; i < points.length; i++) R = Math.max(R, Math.abs(points[i]));
  return {
    points,
    count: points.length / 3,
    colors: opts.colors || null,
    spin: opts.spin || 0,
    tilt: opts.tilt || 0,
    wave: !!opts.wave,
    brightness: opts.brightness ?? 1,
    radius: R,
    roles: opts.roles || null,
    drift: opts.drift || null,
    meta: opts.meta || null,
  };
}

/** Keep at most N points, evenly spread through the list. */
function limit(pts, N, colors) {
  const c = pts.length / 3;
  if (c <= N) return { pts, colors };
  const out = new Float32Array(N * 3);
  const outC = colors ? new Float32Array(N * 3) : null;
  for (let i = 0; i < N; i++) {
    const k = Math.floor((i * c) / N) * 3;
    out[i * 3] = pts[k]; out[i * 3 + 1] = pts[k + 1]; out[i * 3 + 2] = pts[k + 2];
    if (outC) { outC[i * 3] = colors[k]; outC[i * 3 + 1] = colors[k + 1]; outC[i * 3 + 2] = colors[k + 2]; }
  }
  return { pts: out, colors: outC };
}

function grid(N, y, maxWidth, spacing) {
  const side = Math.ceil(Math.sqrt(N));
  const sp = Math.min(spacing, maxWidth / side);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const gx = i % side, gz = Math.floor(i / side);
    pts.push((gx - (side - 1) / 2) * sp, y, (gz - (side - 1) / 2) * sp);
  }
  return pts;
}

/**
 * Turn the filled pixels of a canvas into ~N evenly spaced drone positions.
 * Adapts the sampling step until the point count is close to N.
 */
function canvasPoints(canvas, N, worldWidth, withColors = false) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  const filledAt = (x, y) => {
    const k = (y * w + x) * 4;
    return data[k + 3] > 110 && Math.max(data[k], data[k + 1], data[k + 2]) > 28;
  };
  let filled = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (filledAt(x, y)) filled++;
  if (!filled) return make([0, 0, 0]);

  let step = Math.max(1, Math.sqrt(filled / N));
  let px = [];
  for (let iter = 0; iter < 14; iter++) {
    px = [];
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) if (filledAt(x | 0, y | 0)) px.push(x | 0, y | 0);
    }
    const c = px.length / 2;
    if (c > N) step *= Math.sqrt(c / N) * 1.004;
    else if (c < N * 0.93 && step > 1) step = Math.max(1, step * Math.sqrt(c / N) * 0.998);
    else break;
  }

  const scale = worldWidth / w;
  const count = px.length / 2;
  const pts = new Float32Array(count * 3);
  const cols = withColors ? new Float32Array(count * 3) : null;
  for (let i = 0; i < count; i++) {
    const x = px[i * 2], y = px[i * 2 + 1];
    pts[i * 3] = (x - w / 2) * scale;
    pts[i * 3 + 1] = (h / 2 - y) * scale;
    pts[i * 3 + 2] = 0;
    if (cols) {
      const k = (y * w + x) * 4;
      // sRGB -> linear, slightly boosted so dark logo colors still glow
      cols[i * 3] = Math.pow(data[k] / 255, 2.2) * 1.3;
      cols[i * 3 + 1] = Math.pow(data[k + 1] / 255, 2.2) * 1.3;
      cols[i * 3 + 2] = Math.pow(data[k + 2] / 255, 2.2) * 1.3;
    }
  }
  const lim = limit(pts, N, cols);
  return make(lim.pts, { colors: lim.colors });
}

function blankCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  return [c, g];
}

function heart(N) {
  const [c, g] = blankCanvas(256, 256);
  g.beginPath();
  for (let k = 0; k <= 240; k++) {
    const t = (k / 240) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const px = 128 + x * 7, py = 122 - y * 7;
    k ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.fill();
  return canvasPoints(c, N, 200);
}

function star(N) {
  const [c, g] = blankCanvas(256, 256);
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 50 : 124;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const px = 128 + Math.cos(a) * r, py = 140 + Math.sin(a) * r;
    k ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  g.closePath();
  g.fill();
  return canvasPoints(c, N, 210);
}

function splitLines(text) {
  if (text.includes('|')) return text.split('|').map((s) => s.trim()).filter(Boolean);
  if (text.length > 11 && text.includes(' ')) {
    const mid = text.length / 2;
    let best = -1;
    for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return [text.slice(0, best), text.slice(best + 1)];
  }
  return [text];
}

function text(N, str) {
  const lines = splitLines((str || 'HELLO').trim() || 'HELLO');
  const fs = 120;
  const font = `900 ${fs}px "Arial Black", "Segoe UI Black", "Myanmar Text", "Noto Sans Myanmar", Padauk, Impact, sans-serif`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const tw = Math.max(...lines.map((l) => probe.measureText(l).width));
  const lh = /[\u1000-\u109f]/.test(lines.join('')) ? 1.55 : 1.05; // Myanmar script has tall stacked marks
  const w = Math.ceil(tw + 40), h = Math.ceil(lines.length * fs * lh + 30);
  const [c, g] = blankCanvas(w, h);
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, w / 2, 15 + fs * lh * (i + 0.5)));
  const aspect = w / h;
  return canvasPoints(c, N, Math.min(270, 95 * aspect));
}

async function image(N, src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const S = 240;
  const [c, g] = blankCanvas(S, S);
  const k = Math.min(S / img.width, S / img.height);
  const iw = img.width * k, ih = img.height * k;
  g.drawImage(img, (S - iw) / 2, (S - ih) / 2, iw, ih);
  return canvasPoints(c, N, 200, true);
}

function sphere(N) {
  const pts = [];
  const R = 85;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    pts.push(Math.cos(th) * r * R, y * R, Math.sin(th) * r * R);
  }
  return make(pts, { spin: 0.35 });
}

function ring(N) {
  const R = 82, r = 13;
  const tube = Math.max(6, Math.round(Math.sqrt((N * r) / R)));
  const rings = Math.floor(N / tube);
  const pts = [];
  for (let i = 0; i < rings; i++) {
    const u = (i / rings) * Math.PI * 2;
    for (let j = 0; j < tube; j++) {
      const v = (j / tube) * Math.PI * 2 + (i % 2) * (Math.PI / tube);
      const rr = R + r * Math.cos(v);
      pts.push(rr * Math.cos(u), rr * Math.sin(u), r * Math.sin(v));
    }
  }
  return make(pts, { spin: 0.45 });
}

function helix(N) {
  const H = 190, R = 34, turns = 2.6;
  const strand = Math.floor(N * 0.36);
  const pts = [];
  for (let s = 0; s < 2; s++) {
    for (let k = 0; k < strand; k++) {
      const t = k / (strand - 1);
      const a = t * turns * Math.PI * 2 + s * Math.PI;
      pts.push(Math.cos(a) * R, -H / 2 + t * H, Math.sin(a) * R);
    }
  }
  const rungs = 26;
  const per = Math.floor((N - strand * 2) / rungs);
  for (let k = 0; k < rungs; k++) {
    const t = (k + 0.5) / rungs;
    const a = t * turns * Math.PI * 2;
    const ax = Math.cos(a) * R, az = Math.sin(a) * R;
    for (let j = 0; j < per; j++) {
      const f = (j + 0.5) / per;
      pts.push(ax + (-2 * ax) * f, -H / 2 + t * H, az + (-2 * az) * f);
    }
  }
  return make(pts, { spin: 0.6 });
}

function galaxy(N) {
  const rnd = mulberry32(7);
  const pts = [];
  for (let i = 0; i < N; i++) {
    if (i < N * 0.16) {
      const r = 18 * Math.cbrt(rnd());
      const u = rnd() * Math.PI * 2, v = Math.acos(2 * rnd() - 1);
      pts.push(Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r * 0.45, Math.sin(v) * Math.sin(u) * r);
    } else {
      const arm = i % 3;
      const r = 16 + 92 * Math.pow(rnd(), 0.85);
      const a = arm * ((Math.PI * 2) / 3) + r * 0.05 + (rnd() - 0.5) * 0.55 * (1.25 - r / 110);
      pts.push(Math.cos(a) * r, (rnd() - 0.5) * 5, Math.sin(a) * r);
    }
  }
  return make(pts, { spin: 0.22, tilt: 1.15 });
}

function cube(N) {
  const S = 120, hs = S / 2;
  const per = Math.floor(N / 6);
  const g = Math.max(2, Math.floor(Math.sqrt(per)));
  const pts = [];
  const faces = [
    (a, b) => [hs, a, b], (a, b) => [-hs, a, b],
    (a, b) => [a, hs, b], (a, b) => [a, -hs, b],
    (a, b) => [a, b, hs], (a, b) => [a, b, -hs],
  ];
  faces.forEach((f) => {
    for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
      pts.push(...f(-hs + (S * i) / (g - 1), -hs + (S * j) / (g - 1)));
    }
  });
  return make(pts, { spin: 0.4, tilt: 0.42 });
}

function flag(N) {
  const W = 210, H = 120;
  const cols = Math.round(Math.sqrt((N * W) / H));
  const rows = Math.floor(N / cols);
  const pts = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    pts.push(-W / 2 + (W * c) / (cols - 1), -H / 2 + (H * r) / (rows - 1), 0);
  }
  return make(pts, { wave: true });
}

function burst(N) {
  const rays = 44;
  const core = Math.floor(N * 0.08);
  const per = Math.floor((N - core) / rays);
  const pts = [];
  for (let k = 0; k < rays; k++) {
    const y = 1 - (2 * (k + 0.5)) / rays;
    const r = Math.sqrt(1 - y * y);
    const th = k * 2.399963;
    const dx = Math.cos(th) * r, dy = y, dz = Math.sin(th) * r;
    for (let j = 0; j < per; j++) {
      const d = 14 + 92 * Math.pow(j / Math.max(1, per - 1), 0.9);
      pts.push(dx * d, dy * d, dz * d);
    }
  }
  for (let i = 0; i < core; i++) {
    const y = 1 - (2 * (i + 0.5)) / core;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.399963;
    pts.push(Math.cos(th) * r * 9, y * 9, Math.sin(th) * r * 9);
  }
  return make(pts, { spin: 0.2 });
}

// ---------------- Festival shapes (drawn in color; drones take the pixel colors) ----------------

const ell = (g, x, y, rx, ry, col, rot = 0) => {
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); g.fill();
};

/** Burmese zedi: terraces, bell, bands, lotus, banana bud, hti umbrella, vane and diamond orb. */
function pagoda(N) {
  const [c, g] = blankCanvas(300, 400);
  const X = 150;
  const D = '#d9921f', G = '#ffc23a', L = '#ffe08a';
  const rect = (hw, y0, y1, col, x = X) => { g.fillStyle = col; g.fillRect(x - hw, y0, hw * 2, y1 - y0); };
  // terraces
  rect(140, 372, 392, D); rect(120, 355, 370, G); rect(100, 339, 353, D);
  rect(86, 327, 337, G); rect(74, 316, 325, D); rect(64, 305, 314, G);
  // bell (khaung laung)
  g.fillStyle = G;
  g.beginPath();
  g.moveTo(X - 60, 305);
  g.bezierCurveTo(X - 62, 262, X - 48, 223, X - 34, 214);
  g.lineTo(X + 34, 214);
  g.bezierCurveTo(X + 48, 223, X + 62, 262, X + 60, 305);
  g.closePath();
  g.fill();
  rect(57, 283, 289, L); // ornamental band
  // inverted bowl and moldings
  rect(37, 204, 213, L); rect(30, 196, 203, G); rect(24, 189, 195, L);
  // lotus petals
  for (let k = -3; k <= 3; k++) ell(g, X + k * 7, 182, 4.5, 8, '#ffb347');
  // banana bud (nga pyaw bu)
  g.fillStyle = G;
  g.beginPath();
  g.moveTo(X - 17, 176);
  g.bezierCurveTo(X - 17, 140, X - 6, 112, X - 2, 97);
  g.lineTo(X + 2, 97);
  g.bezierCurveTo(X + 6, 112, X + 17, 140, X + 17, 176);
  g.closePath();
  g.fill();
  // hti umbrella tiers
  for (let k = 0; k < 6; k++) { const y = 93 - k * 7; rect(13 - k * 1.8, y - 4, y, L); }
  // vane (hngetmana) and diamond orb (sein bu)
  g.fillStyle = L; g.beginPath(); g.moveTo(X + 2, 46); g.lineTo(X + 14, 50); g.lineTo(X + 2, 54); g.fill();
  rect(1.5, 44, 54, L);
  ell(g, X, 37, 6, 6, '#ffffff');
  // two small stupas on the lower terrace
  [X - 108, X + 108].forEach((sx) => {
    rect(15, 344, 355, D, sx);
    g.fillStyle = G;
    g.beginPath(); g.moveTo(sx - 14, 344); g.bezierCurveTo(sx - 14, 330, sx - 9, 323, sx - 6, 321);
    g.lineTo(sx + 6, 321); g.bezierCurveTo(sx + 9, 323, sx + 14, 330, sx + 14, 344); g.fill();
    g.beginPath(); g.moveTo(sx - 5, 321); g.lineTo(sx, 297); g.lineTo(sx + 5, 321); g.fill();
    ell(g, sx, 294, 3, 3, '#ffffff');
  });
  return canvasPoints(c, N, 170, true);
}

/** Seated Buddha in meditation on a lotus throne, with a halo. A respectful silhouette, no facial detail. */
function buddha(N) {
  const [c, g] = blankCanvas(300, 380);
  const X = 150;
  const GOLD = '#ffc940', SHADE = '#9a5a0c', LIGHT = '#fff0c0', HALO = '#fff1c4';
  // halo
  g.strokeStyle = HALO; g.lineWidth = 5;
  g.beginPath(); g.arc(X, 98, 68, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    ell(g, X + Math.cos(a) * 80, 98 + Math.sin(a) * 80, 2.2, 2.2, HALO);
  }
  // lotus throne
  g.fillStyle = '#ffd0e2'; g.fillRect(X - 118, 338, 236, 22);
  for (let k = -4; k <= 4; k++) ell(g, X + k * 26, 322, 15, 24, k % 2 ? '#ff9fc6' : '#ffb5d3');
  // crossed legs
  ell(g, X, 290, 112, 30, GOLD);
  // arms
  [-1, 1].forEach((s) => {
    g.fillStyle = GOLD;
    g.beginPath();
    g.moveTo(X + s * 62, 160);
    g.quadraticCurveTo(X + s * 94, 214, X + s * 88, 268);
    g.lineTo(X + s * 60, 270);
    g.quadraticCurveTo(X + s * 70, 214, X + s * 52, 172);
    g.closePath();
    g.fill();
  });
  // torso
  g.fillStyle = GOLD;
  g.beginPath();
  g.moveTo(X - 20, 140);
  g.quadraticCurveTo(X - 62, 142, X - 66, 172);
  g.lineTo(X - 66, 266); g.lineTo(X + 66, 266); g.lineTo(X + 66, 172);
  g.quadraticCurveTo(X + 62, 142, X + 20, 140);
  g.closePath();
  g.fill();
  // arm separation and robe line (robe over the left shoulder)
  g.strokeStyle = SHADE; g.lineWidth = 7;
  [-1, 1].forEach((s) => {
    g.beginPath(); g.moveTo(X + s * 56, 176); g.quadraticCurveTo(X + s * 70, 220, X + s * 62, 266); g.stroke();
  });
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(X - 52, 150); g.quadraticCurveTo(X, 200, X + 46, 264); g.stroke();
  // hands in the lap (dhyana mudra)
  ell(g, X, 268, 34, 14, LIGHT);
  // neck, ears, head
  g.fillStyle = GOLD; g.fillRect(X - 11, 120, 22, 24);
  ell(g, X - 28, 104, 6, 18, SHADE); ell(g, X + 28, 104, 6, 18, SHADE);
  ell(g, X, 98, 27, 32, GOLD);
  g.fillStyle = SHADE; g.beginPath(); g.ellipse(X, 90, 28, 28, 0, Math.PI, Math.PI * 2); g.fill(); // hair
  ell(g, X, 106, 21, 23, LIGHT); // face
  ell(g, X, 60, 14, 13, SHADE); // ushnisha
  g.fillStyle = LIGHT; g.beginPath(); g.moveTo(X, 32); g.lineTo(X - 6, 50); g.lineTo(X + 6, 50); g.fill(); // finial
  return canvasPoints(c, N, 190, true);
}

function lotus(N) {
  const [c, g] = blankCanvas(300, 260);
  const bx = 150, by = 236;
  const petal = (ang, len, w) => {
    const dx = Math.sin(ang), dy = -Math.cos(ang);
    ell(g, bx + dx * len * 0.55, by + dy * len * 0.55, w, len * 0.55, '#fff', ang);
  };
  [-1.25, 1.25].forEach((a) => petal(a, 150, 26));
  [-0.85, 0.85].forEach((a) => petal(a, 190, 30));
  [-0.42, 0.42].forEach((a) => petal(a, 215, 32));
  petal(0, 225, 34);
  return canvasPoints(c, N, 190);
}

function moonDisk(N) {
  const [c, g] = blankCanvas(256, 256);
  const grad = g.createRadialGradient(118, 118, 10, 128, 128, 120);
  grad.addColorStop(0, '#fffbe8'); grad.addColorStop(0.8, '#ffeeb8'); grad.addColorStop(1, '#f2d78f');
  g.fillStyle = grad;
  g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
  // maria (darker "seas") for a recognisable moon face
  [[92, 92, 30], [140, 80, 22], [160, 130, 34], [110, 150, 24], [80, 130, 16], [150, 180, 18]].forEach(([x, y, r]) =>
    ell(g, x, y, r, r * 0.8, 'rgba(190,170,120,0.55)')
  );
  return canvasPoints(c, N, 175, true);
}

/** Taunggyi-style fire balloon with colorful panels and a glowing burner. */
function balloon(N) {
  const [c, g] = blankCanvas(260, 340);
  const X = 130;
  g.save();
  g.beginPath();
  g.arc(X, 125, 108, Math.PI * 0.85, Math.PI * 0.15);
  g.bezierCurveTo(X + 100, 190, X + 40, 250, X + 28, 285);
  g.lineTo(X - 28, 285);
  g.bezierCurveTo(X - 40, 250, X - 100, 190, X - 103, 168);
  g.closePath();
  g.clip();
  const stripes = ['#ff3b30', '#ffcc33', '#2fd27a', '#ffffff', '#ff3b30', '#ffcc33', '#2f8bff', '#ffffff', '#ff3b30'];
  stripes.forEach((col, i) => { g.fillStyle = col; g.fillRect(X - 117 + i * 26, 0, 26, 300); });
  g.fillStyle = 'rgba(255,240,200,0.9)';
  for (let y = 60; y < 260; y += 34) for (let x = X - 100; x <= X + 100; x += 26) { g.beginPath(); g.arc(x + 13, y, 4, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.fillStyle = '#ffd27a'; g.fillRect(X - 30, 285, 60, 6);
  ell(g, X, 306, 20, 13, '#ff7a00');
  ell(g, X, 304, 10, 8, '#ffe066');
  return canvasPoints(c, N, 165, true);
}

/**
 * Weaving loom for the Matho Thingan robe-weaving contest.
 * Points carry a role: 0 = wooden frame, 1 = warp thread, 2 = weft (cloth), 3 = lantern.
 * The "weave" light effect animates the cloth growing row by row with a running shuttle.
 */
function loom(N) {
  const pts = [], roles = [];
  const K = 0.8, OY = 8; // overall scale and lift so the whole loom fits the view
  const add = (x, y, r) => { pts.push(x * K, y * K + OY, 0); roles.push(r); };
  // frame polylines
  const segs = [
    [-100, -118, -100, 108], [100, -118, 100, 108], // posts
    [-108, 108, 108, 108], // top beam
    [-100, 90, 100, 90], // warp beam
    [-100, -96, 100, -96], // cloth beam
    [-122, -118, -78, -118], [78, -118, 122, -118], // feet
  ];
  const frameLen = segs.reduce((s, [a, b, c, d]) => s + Math.hypot(c - a, d - b), 0);
  const fs = Math.max(2.2, frameLen / Math.max(40, N * 0.22));
  segs.forEach(([a, b, c, d]) => {
    const n = Math.max(2, Math.round(Math.hypot(c - a, d - b) / fs));
    for (let k = 0; k <= n; k++) add(a + ((c - a) * k) / n, b + ((d - b) * k) / n, 0);
  });
  // two small lanterns hanging on the loom
  [-100, 100].forEach((lx) => {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      add(lx + Math.cos(a) * 4, 122 + Math.sin(a) * 5, 3);
    }
  });
  // cloth area: warp (even columns) and weft (odd columns)
  const x0 = -86, x1 = 86, y0 = -88, y1 = 82;
  const budget = N - roles.length;
  let s = Math.sqrt(((x1 - x0) * (y1 - y0)) / Math.max(1, budget));
  let nc, nr;
  for (let it = 0; it < 40; it++) {
    nc = Math.floor((x1 - x0) / s) + 1;
    nr = Math.floor((y1 - y0) / s) + 1;
    if (nc * nr <= budget) break;
    s *= 1.02;
  }
  for (let r = 0; r < nr; r++) {
    for (let c = 0; c < nc; c++) add(x0 + c * s, y0 + r * s, c % 2 === 0 ? 1 : 2);
  }
  return make(pts, {
    roles: new Uint8Array(roles),
    meta: { x0: x0 * K, x1: (x0 + (nc - 1) * s) * K, y0: y0 * K + OY, y1: (y0 + (nr - 1) * s) * K + OY, s: s * K, bands: 14 },
  });
}

/** The finished robe, folded on a golden pedestal offering tray. */
function robeOffering(N) {
  const [c, g] = blankCanvas(300, 300);
  const X = 150;
  const rrect = (x0, y0, x1, y1, r, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.roundRect(x0, y0, x1 - x0, y1 - y0, r);
    g.fill();
  };
  // pedestal tray (kalat)
  g.fillStyle = '#ffc23a';
  g.beginPath(); g.moveTo(X - 62, 292); g.lineTo(X + 62, 292); g.lineTo(X + 38, 262); g.lineTo(X - 38, 262); g.fill();
  rrect(X - 16, 228, X + 16, 264, 4, '#e0a020');
  ell(g, X, 224, 118, 15, '#ffd45a');
  // folded robe layers
  rrect(X - 98, 170, X + 98, 218, 10, '#ff8a1c');
  rrect(X - 86, 128, X + 86, 172, 10, '#e8601a');
  rrect(X - 74, 88, X + 74, 130, 10, '#ff9f3a');
  g.strokeStyle = '#9e3a0c'; g.lineWidth = 6;
  [[X - 92, 194, X + 92, 194], [X - 80, 150, X + 80, 150], [X - 68, 109, X + 68, 109]].forEach(([a, b, cc, d]) => {
    g.beginPath(); g.moveTo(a, b); g.lineTo(cc, d); g.stroke();
  });
  // gold band and a lotus on top
  g.fillStyle = '#ffd45a'; g.fillRect(X - 7, 88, 14, 130);
  for (let k = -2; k <= 2; k++) ell(g, X + k * 9, 74 + Math.abs(k) * 3, 6, 14, k % 2 ? '#ff9fc6' : '#ffc2db', k * 0.35);
  // soft glow of offering light
  for (let k = 0; k < 15; k++) {
    const a = Math.PI * (1.08 + (k / 14) * 0.84);
    ell(g, X + Math.cos(a) * 130, 150 + Math.sin(a) * 120, 2.4, 2.4, '#fff1c4');
  }
  return canvasPoints(c, N, 180, true);
}

// ---------------- Christmas shapes ----------------

/** A 3D drone Christmas tree: layered cone, gold garland spiral, ornaments, trunk and a star. */
function xmasTree(N) {
  const pts = [], cols = [];
  const add = (x, y, z, c) => { pts.push(x, y, z); cols.push(c[0], c[1], c[2]); };
  const H = 165, R = 72, y0 = -108; // star stays inside the riverbank view
  const starN = Math.floor(N * 0.07), garN = Math.floor(N * 0.2), ornN = Math.floor(N * 0.06), trunkN = Math.floor(N * 0.03);
  const bodyN = N - starN - garN - ornN - trunkN;
  const rnd = mulberry32(25);
  for (let i = 0; i < bodyN; i++) {
    const t = Math.sqrt((i + 0.5) / bodyN); // 0 at the top, 1 at the base; area grows with t²
    const tier = 0.86 + 0.14 * ((t * 5) % 1); // layered branches
    const r = R * t * tier, a = i * 2.399963;
    const g = 0.35 + 0.4 * rnd();
    add(Math.cos(a) * r, y0 + H * (1 - t), Math.sin(a) * r, [0.04, g, 0.1]);
  }
  for (let k = 0; k < garN; k++) {
    const t = k / garN, a = t * Math.PI * 2 * 5.5;
    const r = R * t * 1.05 + 1.5;
    add(Math.cos(a) * r, y0 + H * (1 - t), Math.sin(a) * r, [1.3, 0.85, 0.2]);
  }
  const orn = [[1.4, 0.08, 0.06], [0.25, 0.45, 1.5], [1.3, 1.3, 1.3], [1.4, 0.9, 0.15]];
  for (let k = 0; k < ornN; k++) {
    const t = 0.15 + 0.85 * rnd(), a = rnd() * Math.PI * 2, r = R * t * 1.03;
    add(Math.cos(a) * r, y0 + H * (1 - t), Math.sin(a) * r, orn[k % orn.length]);
  }
  for (let k = 0; k < trunkN; k++) {
    const a = rnd() * Math.PI * 2;
    add(Math.cos(a) * 9, y0 - 4 - rnd() * 16, Math.sin(a) * 9, [0.45, 0.22, 0.07]);
  }
  // star (in the x/y plane so it faces the viewer as the tree turns)
  const inStar = (x, y) => {
    let inside = false;
    const P = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 8 : 19, a = -Math.PI / 2 + (k * Math.PI) / 5;
      P.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  let made = 0, guard = 0;
  while (made < starN && guard++ < starN * 50) {
    const x = (rnd() - 0.5) * 40, y = (rnd() - 0.5) * 40;
    if (!inStar(x, y)) continue;
    add(x, y0 + H + 14 - y, 0, [1.8, 1.35, 0.35]);
    made++;
  }
  return make(pts, { colors: new Float32Array(cols), spin: 0.35 });
}

/** Santa in his sleigh pulled by three reindeer (Rudolph leads); flies across the sky. */
function santaSleigh(N) {
  const [c, g] = blankCanvas(380, 210);
  const brown = '#a8692e', antler = '#e0b06a', gold = '#ffd45a';
  // sparkle trail behind
  for (let k = 0; k < 18; k++) ell(g, 4 + k * 1.6 + Math.random() * 18, 95 + Math.sin(k) * 30, 1.8, 1.8, '#fff1c4');
  // runner
  g.strokeStyle = gold; g.lineWidth = 5;
  g.beginPath(); g.moveTo(26, 178); g.lineTo(140, 178); g.quadraticCurveTo(160, 178, 156, 160); g.stroke();
  [[50, 160, 50, 178], [118, 160, 118, 178]].forEach(([a, b, cc, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(cc, d); g.stroke(); });
  // sack
  ell(g, 44, 104, 20, 26, '#9c6a32');
  g.fillStyle = gold; g.fillRect(36, 78, 16, 5);
  // Santa
  ell(g, 78, 104, 24, 22, '#e0262e');
  g.fillStyle = '#ffffff'; g.fillRect(56, 120, 46, 6);
  ell(g, 84, 72, 11, 11, '#ffd2a8');
  ell(g, 86, 84, 12, 10, '#ffffff');
  g.fillStyle = '#e0262e'; g.beginPath(); g.moveTo(72, 66); g.lineTo(96, 66); g.lineTo(104, 46); g.closePath(); g.fill();
  g.fillStyle = '#ffffff'; g.fillRect(71, 64, 27, 5);
  ell(g, 106, 44, 4.5, 4.5, '#ffffff');
  // sleigh body
  g.fillStyle = '#d4202a';
  g.beginPath(); g.moveTo(30, 112); g.lineTo(126, 112); g.quadraticCurveTo(146, 112, 138, 138); g.lineTo(128, 162);
  g.lineTo(48, 162); g.quadraticCurveTo(26, 152, 30, 112); g.fill();
  g.strokeStyle = gold; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 114); g.lineTo(126, 114); g.stroke();
  ell(g, 84, 138, 9, 9, gold);
  // harness
  g.strokeStyle = gold; g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(136, 132); g.quadraticCurveTo(220, 150, 330, 112); g.stroke();
  // reindeer
  [[190, 0], [258, 1], [326, 2]].forEach(([x, i]) => {
    const y = 120 - i * 6;
    ell(g, x, y, 25, 11, brown);
    g.strokeStyle = brown; g.lineWidth = 5;
    [[-16, 1.2], [-8, 0.5], [10, -0.6], [18, -1.1]].forEach(([dx, sw]) => {
      g.beginPath(); g.moveTo(x + dx, y + 6); g.lineTo(x + dx + sw * 10, y + 30); g.stroke();
    });
    g.beginPath(); g.moveTo(x + 18, y - 4); g.lineTo(x + 28, y - 20); g.stroke(); // neck
    ell(g, x + 32, y - 23, 9, 7, brown, -0.3);
    g.strokeStyle = antler; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(x + 28, y - 29); g.lineTo(x + 22, y - 44); g.moveTo(x + 25, y - 37); g.lineTo(x + 16, y - 40);
    g.moveTo(x + 32, y - 30); g.lineTo(x + 34, y - 46); g.moveTo(x + 33, y - 39); g.lineTo(x + 41, y - 44); g.stroke();
    ell(g, x - 25, y - 6, 4, 3, '#f1e2c8');
    if (i === 2) ell(g, x + 41, y - 22, 4.5, 4.5, '#ff2020'); // Rudolph
  });
  const f = canvasPoints(c, N, 230, true);
  f.drift = { x0: -70, vx: 12 };
  return f;
}

function snowman(N) {
  const [c, g] = blankCanvas(240, 300);
  ell(g, 120, 290, 110, 8, '#dff1ff');
  ell(g, 120, 228, 62, 58, '#d6e2f0');
  ell(g, 120, 142, 46, 42, '#dfe9f5');
  ell(g, 120, 72, 32, 31, '#e4edf7');
  g.strokeStyle = '#a8692e'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(80, 135); g.lineTo(32, 98); g.moveTo(52, 114); g.lineTo(38, 132);
  g.moveTo(160, 135); g.lineTo(208, 98); g.moveTo(188, 114); g.lineTo(204, 128); g.stroke();
  g.fillStyle = '#5b6b8c'; g.fillRect(80, 38, 80, 8); g.fillRect(94, 2, 52, 38);
  g.fillStyle = '#e0262e'; g.fillRect(94, 28, 52, 8);
  ell(g, 108, 66, 4.5, 4.5, '#4fa3ff'); ell(g, 132, 66, 4.5, 4.5, '#4fa3ff');
  g.fillStyle = '#ff8a1c'; g.beginPath(); g.moveTo(118, 74); g.lineTo(152, 80); g.lineTo(118, 82); g.fill();
  for (let k = -2; k <= 2; k++) ell(g, 120 + k * 7, 90 + Math.abs(k) * -1.5 + 2, 2, 2, '#ffd45a');
  g.fillStyle = '#e0262e'; g.fillRect(82, 100, 76, 13);
  g.fillStyle = '#1fa64a'; g.fillRect(128, 106, 15, 44);
  g.fillStyle = '#e0262e'; [114, 124, 134].forEach((y) => g.fillRect(128, y, 15, 5));
  [130, 152, 174].forEach((y) => ell(g, 120, y, 5, 5, '#ffd45a'));
  return canvasPoints(c, N, 165, true);
}

function giftBox(N) {
  const [c, g] = blankCanvas(260, 260);
  g.fillStyle = '#d4202a'; g.fillRect(40, 112, 180, 132);
  g.fillStyle = '#ff3b44'; g.fillRect(30, 86, 200, 32);
  g.fillStyle = '#ffd45a'; g.fillRect(118, 86, 24, 158); g.fillRect(40, 164, 180, 20);
  ell(g, 100, 66, 34, 20, '#ffd45a', -0.45); ell(g, 160, 66, 34, 20, '#ffd45a', 0.45);
  ell(g, 100, 66, 18, 8, '#000', -0.45); ell(g, 160, 66, 18, 8, '#000', 0.45);
  ell(g, 130, 78, 12, 11, '#ffe08a');
  g.fillStyle = '#ffd45a';
  g.beginPath(); g.moveTo(124, 84); g.lineTo(100, 112); g.lineTo(112, 114); g.lineTo(130, 88); g.fill();
  g.beginPath(); g.moveTo(136, 84); g.lineTo(160, 112); g.lineTo(148, 114); g.lineTo(130, 88); g.fill();
  for (let k = 0; k < 12; k++) ell(g, 52 + (k % 4) * 52, 130 + Math.floor(k / 4) * 40 + (k % 2) * 8, 3, 3, '#ffffff');
  return canvasPoints(c, N, 170, true);
}

function christmasBells(N) {
  const [c, g] = blankCanvas(300, 260);
  const bell = (cx, cy, rot) => {
    // two separate bells, slightly smaller so they don't merge
    g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(0.86, 0.86);
    g.fillStyle = '#ffc23a';
    g.beginPath(); g.moveTo(-12, -60); g.bezierCurveTo(-46, -52, -42, 10, -56, 32); g.lineTo(56, 32);
    g.bezierCurveTo(42, 10, 46, -52, 12, -60); g.closePath(); g.fill();
    g.fillStyle = '#e09a1a'; g.fillRect(-60, 30, 120, 11);
    g.fillStyle = '#fff0b0'; g.fillRect(-30, -30, 8, 46);
    ell(g, 0, 50, 10, 10, '#ffe08a');
    g.restore();
  };
  bell(92, 165, -0.28);
  bell(208, 165, 0.28);
  ell(g, 150, 72, 9, 9, '#e0262e');
  ell(g, 126, 64, 24, 13, '#e0262e', -0.35); ell(g, 174, 64, 24, 13, '#e0262e', 0.35);
  g.fillStyle = '#e0262e';
  g.beginPath(); g.moveTo(146, 76); g.lineTo(126, 112); g.lineTo(136, 114); g.lineTo(150, 82); g.fill();
  g.beginPath(); g.moveTo(154, 76); g.lineTo(174, 112); g.lineTo(164, 114); g.lineTo(150, 82); g.fill();
  ell(g, 132, 92, 15, 7, '#1fa64a', 0.5); ell(g, 168, 92, 15, 7, '#1fa64a', -0.5);
  ell(g, 146, 92, 4, 4, '#ff2020'); ell(g, 154, 94, 4, 4, '#ff2020');
  return canvasPoints(c, N, 180, true);
}

function snowflake(N) {
  const [c, g] = blankCanvas(260, 260);
  g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineWidth = 9;
  for (let k = 0; k < 6; k++) {
    g.save(); g.translate(130, 130); g.rotate((k * Math.PI) / 3);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -112); g.stroke();
    [[-52, 30], [-82, 22]].forEach(([y, l]) => {
      g.beginPath(); g.moveTo(0, y); g.lineTo(-l, y - l); g.moveTo(0, y); g.lineTo(l, y - l); g.stroke();
    });
    g.restore();
  }
  g.lineWidth = 6;
  g.beginPath();
  for (let k = 0; k <= 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    const x = 130 + Math.cos(a) * 24, y = 130 + Math.sin(a) * 24;
    k ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  return canvasPoints(c, N, 190);
}

function candyCane(N) {
  const [c, g] = blankCanvas(200, 300);
  g.strokeStyle = '#ff2d55'; g.lineWidth = 34; g.lineCap = 'round';
  g.beginPath(); g.moveTo(128, 280); g.lineTo(128, 100); g.arc(88, 100, 40, 0, Math.PI, true); g.lineTo(48, 132); g.stroke();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = '#ffffff';
  for (let k = -12; k < 20; k++) {
    g.save(); g.translate(0, k * 30); g.rotate(-0.55); g.fillRect(-60, 0, 400, 13); g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  ell(g, 152, 60, 8, 4, '#1fa64a', 0.6); ell(g, 160, 72, 8, 4, '#1fa64a', -0.2); ell(g, 150, 70, 3.5, 3.5, '#ff2020');
  return canvasPoints(c, N, 130, true);
}

// ---------------- New Year shapes ----------------

/** Clock face a breath before midnight: hands almost at 12, second hand sweeping. */
function midnightClock(N) {
  const [c, g] = blankCanvas(260, 260);
  const X = 130, Y = 130;
  g.strokeStyle = '#ffc23a'; g.lineWidth = 9;
  g.beginPath(); g.arc(X, Y, 118, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#dfe6f2'; g.lineWidth = 3;
  g.beginPath(); g.arc(X, Y, 103, 0, Math.PI * 2); g.stroke();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 - Math.PI / 2;
    if (k % 3 === 0) {
      g.save(); g.translate(X + Math.cos(a) * 88, Y + Math.sin(a) * 88); g.rotate(a + Math.PI / 2);
      g.fillStyle = '#ffffff'; g.fillRect(-4, -11, 8, 22); g.restore();
    } else ell(g, X + Math.cos(a) * 90, Y + Math.sin(a) * 90, 4.5, 4.5, '#ffd45a');
  }
  const hand = (frac, len, w, col) => {
    const a = frac * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(X - Math.cos(a) * 12, Y - Math.sin(a) * 12); g.lineTo(X + Math.cos(a) * len, Y + Math.sin(a) * len); g.stroke();
  };
  hand(11.98 / 12, 56, 11, '#ffffff'); // hour
  hand(59 / 60, 86, 7, '#ffd45a'); // minute
  hand(48 / 60, 92, 3.5, '#ff3b44'); // second
  ell(g, X, Y, 9, 9, '#ffd45a');
  return canvasPoints(c, N, 175, true);
}

/** Two champagne flutes clinking, with bubbles and a burst of sparkle where they meet. */
function champagneToast(N) {
  const [c, g] = blankCanvas(300, 270);
  const flute = (cx, baseY, rot) => {
    g.save(); g.translate(cx, baseY); g.rotate(rot);
    ell(g, 0, 0, 32, 6, '#e8eef8');
    g.fillStyle = '#e8eef8'; g.fillRect(-3, -70, 6, 70);
    const bowl = () => {
      g.beginPath(); g.moveTo(-22, -205); g.lineTo(22, -205);
      g.quadraticCurveTo(25, -112, 4, -72); g.lineTo(-4, -72); g.quadraticCurveTo(-25, -112, -22, -205); g.closePath();
    };
    g.save(); bowl(); g.clip();
    g.fillStyle = '#ffcf4a'; g.fillRect(-30, -172, 60, 110);
    for (let k = 0; k < 9; k++) ell(g, -10 + ((k * 37) % 21), -90 - k * 9, 2.4, 2.4, '#fff6d8');
    g.restore();
    bowl(); g.strokeStyle = '#e8eef8'; g.lineWidth = 4; g.stroke();
    g.restore();
  };
  flute(98, 262, 0.08);
  flute(202, 262, -0.08); // a clear gap between the glasses, sparkle above it
  g.strokeStyle = '#ffd45a'; g.lineWidth = 3; g.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    const a = -Math.PI / 2 + (k - 4) * 0.33;
    g.beginPath(); g.moveTo(150 + Math.cos(a) * 14, 50 + Math.sin(a) * 14); g.lineTo(150 + Math.cos(a) * 34, 50 + Math.sin(a) * 34); g.stroke();
  }
  ell(g, 150, 50, 5, 5, '#ffffff');
  return canvasPoints(c, N, 175, true);
}

/** Build the formation for a show step. Returns a Promise (images decode asynchronously). */
export async function buildFormation(step, N) {
  switch (step.formation) {
    case 'launch':
    case 'land':
      return make(grid(N, GROUND_LOCAL_Y, 180, 2.6), { brightness: 0.35 });
    case 'lift':
      return make(grid(N, -45, 190, 5), {});
    case 'sphere': return sphere(N);
    case 'heart': return heart(N);
    case 'star': return star(N);
    case 'helix': return helix(N);
    case 'galaxy': return galaxy(N);
    case 'ring': return ring(N);
    case 'cube': return cube(N);
    case 'flag': return flag(N);
    case 'burst': return burst(N);
    case 'text': return text(N, step.text);
    case 'image': return step.image ? image(N, step.image) : text(N, '?');
    case 'pagoda': return pagoda(N);
    case 'buddha': return buddha(N);
    case 'lotus': return lotus(N);
    case 'moon': return moonDisk(N);
    case 'balloon': return balloon(N);
    case 'loom': return loom(N);
    case 'robe': return robeOffering(N);
    case 'xmastree': return xmasTree(N);
    case 'santa': return santaSleigh(N);
    case 'snowman': return snowman(N);
    case 'gift': return giftBox(N);
    case 'bells': return christmasBells(N);
    case 'snowflake': return snowflake(N);
    case 'candycane': return candyCane(N);
    case 'countdown': return text(N, String(step.from || 10));
    case 'clock': return midnightClock(N);
    case 'champagne': return champagneToast(N);
    default: return sphere(N);
  }
}
