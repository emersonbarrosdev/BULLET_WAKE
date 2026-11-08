/**
 * BULLET WAKE — Gerador autoral de sprites de Power-ups e Efeitos de Combate.
 * Gera folhas PNG transparentes RGBA 100% nativas em Node 22 (sem dependências).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function image(w, h) {
  return { w, h, data: Buffer.alloc(w * h * 4) };
}

function paint(im, x, y, r, g, b, a = 255) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= im.w || y >= im.h || a <= 0) return;
  const p = (y * im.w + x) * 4;
  im.data[p] = r;
  im.data[p + 1] = g;
  im.data[p + 2] = b;
  im.data[p + 3] = a;
}

function rect(im, x, y, w, h, col) {
  for (let v = 0; v < h; v++) {
    for (let u = 0; u < w; u++) {
      paint(im, x + u, y + v, ...col);
    }
  }
}

function line(im, x0, y0, x1, y1, col) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    paint(im, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, ...col);
  }
}

function circle(im, cx, cy, r, col, filled = false) {
  const minX = Math.floor(cx - r), maxX = Math.ceil(cx + r);
  const minY = Math.floor(cy - r), maxY = Math.ceil(cy + r);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (filled) {
        if (d <= r) paint(im, x, y, ...col);
      } else {
        if (Math.abs(d - r) <= 0.8) paint(im, x, y, ...col);
      }
    }
  }
}

const C = {
  white: [255, 255, 255, 255],
  cyan: [70, 225, 240, 245],
  cyanGlow: [35, 175, 205, 170],
  gold: [255, 210, 80, 245],
  goldGlow: [210, 150, 40, 180],
  green: [90, 245, 150, 245],
  greenGlow: [45, 180, 95, 170],
  red: [250, 85, 75, 245],
  redGlow: [195, 45, 45, 180],
  purple: [190, 105, 250, 245],
  purpleGlow: [130, 55, 200, 180],
  shieldCyan: [50, 210, 255, 160],
  shieldWhite: [220, 250, 255, 230],
  dark: [18, 24, 34, 230],
};

// Gerador de pickups (24x24, 4 frames cada)
function makePickupFrame(type, frame) {
  const im = image(24, 24);
  const cx = 12, cy = 12;
  const pulse = Math.sin((frame * Math.PI) / 2) * 1.2;

  // Borda hexagonal / circular com pulso
  circle(im, cx, cy, 9.5 + pulse, C.dark, true);

  if (type === 'upgrade') {
    // Hexágono dourado com 'P' / duplo chevron
    circle(im, cx, cy, 9.5, C.goldGlow);
    circle(im, cx, cy, 8.5, C.gold);
    // Símbolo 'P' e chevron
    rect(im, 9, 7, 2, 10, C.white);
    rect(im, 11, 7, 4, 2, C.white);
    rect(im, 11, 11, 4, 2, C.white);
    rect(im, 14, 8, 2, 4, C.white);
    // Brilho de canto
    paint(im, 6, 6 + frame % 2, ...C.white);
  } else if (type === 'repair') {
    // Cruz médica / nanites verdes
    circle(im, cx, cy, 9.5, C.greenGlow);
    circle(im, cx, cy, 8.5, C.green);
    rect(im, 10, 6, 4, 12, C.white);
    rect(im, 6, 10, 12, 4, C.white);
    rect(im, 11, 7, 2, 10, C.green);
    rect(im, 7, 11, 10, 2, C.green);
  } else if (type === 'bomb') {
    // Ogiva explosiva vermelha/laranja
    circle(im, cx, cy, 9.5, C.redGlow);
    circle(im, cx, cy, 8.5, C.red);
    circle(im, cx, cy + 1, 4.5, C.white, true);
    rect(im, 11, 4, 2, 3, C.gold);
    paint(im, 12 + (frame % 2), 3, ...C.white);
  } else if (type === 'resonance') {
    // Cristal de ressonância violeta com rastro Wake
    circle(im, cx, cy, 9.5, C.purpleGlow);
    circle(im, cx, cy, 8.5, C.purple);
    // Diamante central
    line(im, 12, 6, 17, 12, C.white);
    line(im, 17, 12, 12, 18, C.white);
    line(im, 12, 18, 7, 12, C.white);
    line(im, 7, 12, 12, 6, C.white);
    circle(im, cx, cy, 2, frame % 2 ? C.cyan : C.white, true);
  } else if (type === 'shield') {
    // Escudo hexagonal azul-ciano
    circle(im, cx, cy, 9.5, C.cyanGlow);
    circle(im, cx, cy, 8.5, C.cyan);
    circle(im, cx, cy, 5.5, C.white);
    circle(im, cx, cy, 2.5, C.cyan, true);
  } else if (type === 'score') {
    // Moeda / chip estelar dourado
    circle(im, cx, cy, 9.5, C.goldGlow);
    circle(im, cx, cy, 8.5, C.gold);
    circle(im, cx, cy, 5.5, C.white);
    rect(im, 11, 9, 2, 6, C.gold);
    paint(im, 12, 8, ...C.white);
  }

  return im;
}

// Escudo ativo em volta da nave (48x48, 4 frames)
function makeShieldFrame(f) {
  const im = image(48, 48);
  const cx = 24, cy = 24, angleOffset = (f * Math.PI) / 2;
  circle(im, cx, cy, 21, [50, 215, 255, 60], true);
  circle(im, cx, cy, 22, [80, 230, 255, 140]);
  circle(im, cx, cy, 21, [210, 250, 255, 210]);

  // 6 vértices hexagonais girando
  for (let i = 0; i < 6; i++) {
    const a = angleOffset + (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * 21;
    const y = cy + Math.sin(a) * 21;
    circle(im, x, y, 2.5, C.white, true);
  }
  return im;
}

// Bomba: onda de choque expansiva de tela (96x96, 8 frames)
function makeBombShockwave(frame) {
  const im = image(96, 96);
  const cx = 48, cy = 48;
  const radius = 6 + frame * 5.5;
  const alpha = Math.max(0, Math.floor(255 * (1 - frame / 8)));

  circle(im, cx, cy, radius, [255, 230, 140, alpha]);
  if (radius > 4) circle(im, cx, cy, radius - 3, [255, 100, 60, Math.floor(alpha * 0.85)]);
  if (radius > 8) circle(im, cx, cy, radius - 7, [200, 60, 220, Math.floor(alpha * 0.6)]);

  // Fragmentos de explosão
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 + frame * 0.2;
    const r = radius * 0.85;
    paint(im, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 255, 255, 255, alpha);
  }
  return im;
}

// Ruptura Nova de Harlan (128x128, 8 frames)
function makeNovaShockwave(frame) {
  const im = image(128, 128);
  const cx = 64, cy = 64;
  const radius = 8 + frame * 7.2;
  const alpha = Math.max(0, Math.floor(255 * (1 - frame / 8)));

  circle(im, cx, cy, radius, [255, 190, 60, alpha]);
  circle(im, cx, cy, Math.max(1, radius - 2), [255, 255, 255, alpha]);
  if (radius > 5) circle(im, cx, cy, radius - 5, [255, 90, 40, Math.floor(alpha * 0.75)]);

  // Arcos elétricos concentricos
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    line(
      im,
      cx + Math.cos(a) * (radius - 8),
      cy + Math.sin(a) * (radius - 8),
      cx + Math.cos(a + 0.15) * radius,
      cy + Math.sin(a + 0.15) * radius,
      [255, 240, 180, alpha]
    );
  }
  return im;
}

function makePNG(frames) {
  const w = frames[0].w, h = frames[0].h, count = frames.length;
  if (!frames.every((x) => x.w === w && x.h === h)) throw Error('Inconsistent frame size');
  const pw = w * count, raw = Buffer.alloc((pw * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (pw * 4 + 1);
    for (let f = 0; f < count; f++) {
      frames[f].data.copy(raw, row + 1 + f * w * 4, y * w * 4, (y + 1) * w * 4);
    }
  }
  function crc32(data) {
    let c = -1;
    for (const b of data) {
      c ^= b;
      for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ -1) >>> 0;
  }
  function chunk(type, data) {
    const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, crc]);
  }
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(pw, 0);
  ih.writeUInt32BE(h, 4);
  ih[8] = 8;
  ih[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ih),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const defs = [
  ['public/assets/pickups/upgrade.png', 4, (f) => makePickupFrame('upgrade', f)],
  ['public/assets/pickups/repair.png', 4, (f) => makePickupFrame('repair', f)],
  ['public/assets/pickups/bomb.png', 4, (f) => makePickupFrame('bomb', f)],
  ['public/assets/pickups/resonance.png', 4, (f) => makePickupFrame('resonance', f)],
  ['public/assets/pickups/shield.png', 4, (f) => makePickupFrame('shield', f)],
  ['public/assets/pickups/score.png', 4, (f) => makePickupFrame('score', f)],
  ['public/assets/fx/shield.png', 4, makeShieldFrame],
  ['public/assets/fx/bomb_wave.png', 8, makeBombShockwave],
  ['public/assets/fx/nova_wave.png', 8, makeNovaShockwave],
];

for (const [dest, count, draw] of defs) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, makePNG(Array.from({ length: count }, (_, i) => draw(i))));
  console.log(dest);
}

