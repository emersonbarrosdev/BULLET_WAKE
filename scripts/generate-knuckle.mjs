/**
 * BULLET WAKE — Gerador Modern Pixel Art da KNUCKLE (Harlan Greer).
 * Canhoneira maciça em cunha, nariz truncado, blindagem reforçada e canhões duplos.
 * Gera folhas PNG transparentes RGBA 100% nativas em Node 22 (sem dependências).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const WIDTH = 144, HEIGHT = 88;

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
  steelDark: [42, 50, 60, 255],
  steelMid: [88, 105, 120, 255],
  steelLight: [142, 160, 175, 255],
  orangeRust: [182, 105, 55, 255],
  goldArmor: [246, 175, 85, 255],
  cyanLight: [65, 220, 235, 255],
  white: [255, 255, 255, 255],
  fireOrange: [255, 110, 35, 255],
  fireYellow: [255, 220, 75, 255],
};

function knuckleHull(pitch = 0, bob = 0, flick = 0) {
  const im = image(WIDTH, HEIGHT);
  const cy = 44 + bob;
  const angle = (pitch * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  function rot(x, y) {
    const dx = x - 72;
    const dy = y - cy;
    return [Math.round(72 + dx * cos - dy * sin), Math.round(cy + dx * sin + dy * cos)];
  }

  // Corpo principal em cunha pesada: de x = 25 até x = 118
  for (let x = 25; x <= 118; x++) {
    const progress = (x - 25) / 93;
    // Nariz truncado: altura não zera na ponta! Permanece larga (16px de altura)
    const halfH = Math.round(8 + (1 - progress) * 22);
    for (let y = cy - halfH; y <= cy + halfH; y++) {
      const [rx, ry] = rot(x, y);
      const isDorsal = y < cy;
      const col = isDorsal ? (y < cy - halfH + 4 ? C.steelLight : C.steelMid) : C.steelDark;
      paint(im, rx, ry, ...col);
    }
  }

  // Nariz truncado quadrado (canhão duplo frontal blindado)
  for (let y = cy - 8; y <= cy + 8; y++) {
    for (let x = 118; x <= 126; x++) {
      const [rx, ry] = rot(x, y);
      paint(im, rx, ry, ...C.steelDark);
    }
  }
  // Bocas dos canhões pesados
  const [b1x, b1y] = rot(126, cy - 4);
  const [b2x, b2y] = rot(126, cy + 4);
  paint(im, b1x, b1y, ...C.orangeRust);
  paint(im, b2x, b2y, ...C.orangeRust);

  // Placas de blindagem angular laranja/dourada
  for (let x = 45; x <= 95; x++) {
    const [px1, py1] = rot(x, cy - 12);
    paint(im, px1, py1, ...C.orangeRust);
    paint(im, px1, py1 - 1, ...C.goldArmor);

    const [px2, py2] = rot(x, cy + 12);
    paint(im, px2, py2, ...C.orangeRust);
  }

  // Ventilação dorsal e cabine blindada
  for (let x = 55; x <= 75; x++) {
    const [vx, vy] = rot(x, cy - 18);
    paint(im, vx, vy, ...C.steelDark);
  }
  const [cxPos, cyPos] = rot(85, cy - 6);
  paint(im, cxPos, cyPos, ...C.cyanLight);

  // Duas turbinas largas embutidas na traseira
  const flameLen = 10 + (flick % 4) * 4;
  for (const offset of [-14, 14]) {
    for (let x = 24 - flameLen; x <= 24; x++) {
      const [fx, fy] = rot(x, cy + offset);
      paint(im, fx, fy, ...C.fireYellow);
      paint(im, fx, fy - 1, ...C.fireOrange);
      paint(im, fx, fy + 1, ...C.fireOrange);
    }
  }

  return im;
}

function knuckle(state, frame) {
  const flick = frame % 4;

  if (state === 'destruction') {
    const im = image(WIDTH, HEIGHT);
    const source = knuckleHull(0, 0, flick);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const from = (y * WIDTH + x) * 4;
        if (source.data[from + 3] < 60) continue;
        const cell = (Math.floor(x / 8) * 7 + Math.floor(y / 8) * 11 + frame * 3) % 13;
        if (cell < frame) continue;
        const ox = Math.round((x - 72) * (frame / 26));
        const oy = Math.round((y - 44) * (frame / 22));
        paint(im, x + ox, y + oy, source.data[from], source.data[from + 1], source.data[from + 2], source.data[from + 3]);
      }
    }
    for (let j = 0; j < frame * 6; j++) {
      const x = 72 + Math.cos(j * 2.1 + frame) * (frame * 3.5);
      const y = 44 + Math.sin(j * 1.9 + frame) * (frame * 2.5);
      paint(im, x, y, ...(j % 2 ? C.fireYellow : C.fireOrange));
    }
    return im;
  }

  const pitch = state === 'climb' ? [-2, -4, -6, -4][flick] : state === 'dive' ? [2, 4, 6, 4][flick] : 0;
  const im = knuckleHull(pitch, [-1, 0, 1, 0][flick], flick);

  if (state === 'fire') {
    // Clarão massivo de disparo no canhão
    circle(im, 128, 40, 5, C.white, true);
    circle(im, 128, 48, 5, C.white, true);
    line(im, 128, 40, 138, 40, C.fireYellow);
    line(im, 128, 48, 138, 48, C.fireYellow);
  }

  if (state === 'hit') {
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      line(im, 80, 44, 80 + Math.cos(a) * 10, 44 + Math.sin(a) * 10, j % 2 ? C.fireYellow : C.steelLight);
    }
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
  ih[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ih),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const defs = [
  ['public/assets/ships/knuckle/v2/idle.png', 4, (f) => knuckle('idle', f)],
  ['public/assets/ships/knuckle/v2/climb.png', 4, (f) => knuckle('climb', f)],
  ['public/assets/ships/knuckle/v2/dive.png', 4, (f) => knuckle('dive', f)],
  ['public/assets/ships/knuckle/v2/fire.png', 4, (f) => knuckle('fire', f)],
  ['public/assets/ships/knuckle/v2/hit.png', 4, (f) => knuckle('hit', f)],
  ['public/assets/ships/knuckle/v2/destruction.png', 8, (f) => knuckle('destruction', f)],
];

for (const [dest, count, draw] of defs) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, makePNG(Array.from({ length: count }, (_, i) => draw(i))));
  console.log(dest);
}

