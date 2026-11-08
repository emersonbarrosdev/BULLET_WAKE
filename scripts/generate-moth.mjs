/**
 * BULLET WAKE — Gerador Modern Pixel Art da MOTH (Cora Wren).
 * Fuselagem esbelta como agulha, cauda em V, propulsor iônico ciano/prateado.
 * Gera folhas PNG transparentes RGBA 100% nativas em Node 22 (sem dependências).
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const WIDTH = 136, HEIGHT = 72;

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
  navyDark: [35, 52, 74, 255],
  silverMid: [140, 168, 188, 255],
  silverLight: [215, 235, 245, 255],
  cyanLaser: [85, 232, 238, 245],
  cyanGlow: [45, 180, 215, 180],
  white: [250, 255, 255, 255],
  goldMuzzle: [255, 215, 90, 245],
  redSpark: [245, 75, 75, 245],
};

function mothHull(pitch = 0, bob = 0, flick = 0) {
  const im = image(WIDTH, HEIGHT);
  const cy = 36 + bob;
  const angle = (pitch * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  function rot(x, y) {
    const dx = x - 68;
    const dy = y - cy;
    return [Math.round(68 + dx * cos - dy * sin), Math.round(cy + dx * sin + dy * cos)];
  }

  // Agulha esbelta central (nariz afunilado de 28 até 124)
  for (let x = 28; x <= 126; x++) {
    const progress = (x - 28) / 98;
    // Espessura muito fina: 3px no nariz até 12px no centro
    const halfH = Math.max(1, Math.round(Math.sin(progress * Math.PI * 0.85) * 6.5));
    for (let y = cy - halfH; y <= cy + halfH; y++) {
      const [rx, ry] = rot(x, y);
      const isDorsal = y < cy;
      const col = isDorsal ? (y < cy - halfH + 2 ? C.silverLight : C.silverMid) : C.navyDark;
      paint(im, rx, ry, ...col);
    }
  }

  // Ponta afilada de agulha
  for (let x = 126; x <= 132; x++) {
    const [rx, ry] = rot(x, cy);
    paint(im, rx, ry, ...C.silverLight);
  }

  // Cauda em V vazada (estabilizadores superior e inferior)
  for (let i = 0; i < 22; i++) {
    const x = 28 + i;
    // Aleta superior inclinada
    const [ux, uy] = rot(x, cy - 6 - Math.round(i * 0.45));
    paint(im, ux, uy, ...C.silverLight);
    paint(im, ux, uy + 1, ...C.silverMid);

    // Aleta inferior inclinada
    const [dx, dy] = rot(x, cy + 6 + Math.round(i * 0.45));
    paint(im, dx, dy, ...C.navyDark);
    paint(im, dx, dy - 1, ...C.silverMid);
  }

  // Canopy de cristal ciano longo e esguio
  for (let x = 75; x <= 98; x++) {
    const [cxPos, cyPos] = rot(x, cy - 2);
    paint(im, cxPos, cyPos, ...C.cyanLaser);
    paint(im, cxPos, cyPos - 1, ...C.white);
  }

  // Propulsor central iônico com rastro de pulsação
  const flameLen = 8 + (flick % 4) * 3;
  for (let x = 24 - flameLen; x <= 24; x++) {
    const [fx, fy] = rot(x, cy);
    paint(im, fx, fy, ...C.white);
    paint(im, fx, fy - 1, ...C.cyanLaser);
    paint(im, fx, fy + 1, ...C.cyanLaser);
  }

  return im;
}

function moth(state, frame) {
  const flick = frame % 4;

  if (state === 'destruction') {
    const im = image(WIDTH, HEIGHT);
    const source = mothHull(0, 0, flick);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        const from = (y * WIDTH + x) * 4;
        if (source.data[from + 3] < 60) continue;
        const cell = (Math.floor(x / 7) * 7 + Math.floor(y / 7) * 11 + frame * 3) % 13;
        if (cell < frame) continue;
        const ox = Math.round((x - 68) * (frame / 30));
        const oy = Math.round((y - 36) * (frame / 26));
        paint(im, x + ox, y + oy, source.data[from], source.data[from + 1], source.data[from + 2], source.data[from + 3]);
      }
    }
    for (let j = 0; j < frame * 5; j++) {
      const x = 68 + Math.cos(j * 2.3 + frame) * (frame * 3);
      const y = 36 + Math.sin(j * 1.8 + frame) * (frame * 2.2);
      paint(im, x, y, ...(j % 2 ? C.cyanLaser : C.white));
    }
    return im;
  }

  const pitch = state === 'climb' ? [-3, -6, -8, -5][flick] : state === 'dive' ? [3, 6, 8, 5][flick] : 0;
  const im = mothHull(pitch, [-1, 0, 1, 0][flick], flick);

  if (state === 'fire') {
    // Muzzle flash na ponta da agulha
    circle(im, 131, 36, 3, C.white, true);
    line(im, 131, 36, 135, 36, C.cyanLaser);
  }

  if (state === 'hit') {
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 3;
      line(im, 80, 36, 80 + Math.cos(a) * 8, 36 + Math.sin(a) * 8, j % 2 ? C.redSpark : C.white);
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
  ['public/assets/ships/moth/v2/idle.png', 4, (f) => moth('idle', f)],
  ['public/assets/ships/moth/v2/climb.png', 4, (f) => moth('climb', f)],
  ['public/assets/ships/moth/v2/dive.png', 4, (f) => moth('dive', f)],
  ['public/assets/ships/moth/v2/fire.png', 4, (f) => moth('fire', f)],
  ['public/assets/ships/moth/v2/hit.png', 4, (f) => moth('hit', f)],
  ['public/assets/ships/moth/v2/destruction.png', 8, (f) => moth('destruction', f)],
];

for (const [dest, count, draw] of defs) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, makePNG(Array.from({ length: count }, (_, i) => draw(i))));
  console.log(dest);
}
