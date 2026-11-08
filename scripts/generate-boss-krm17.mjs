/**
 * BULLET WAKE — Gerador do Chefe da Fase 01: KRM-17 Excavator.
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
  steelDark: [35, 42, 54, 255],
  steelMid: [65, 78, 98, 255],
  steelLight: [125, 142, 168, 255],
  rustDark: [85, 45, 32, 255],
  rustMid: [145, 72, 48, 255],
  orangeIndustrial: [235, 120, 45, 255],
  yellowHazard: [245, 205, 55, 255],
  redCore: [240, 60, 60, 245],
  whiteHot: [255, 245, 225, 255],
  cyanLaser: [65, 225, 240, 245],
};

// Casco principal do KRM-17 (144x96, 4 frames: normal, broca armada, núcleo aberto, danificado)
function makeHullFrame(f) {
  const im = image(144, 96);
  const coreOpen = f === 2 || f === 3;
  const damaged = f === 3;

  // Silhueta industrial chanfrada
  // Placas traseiras e centrais
  rect(im, 40, 18, 95, 60, C.steelDark);
  rect(im, 50, 12, 75, 72, C.steelMid);
  rect(im, 65, 8, 55, 80, C.steelDark);

  // Listras amarelas/pretas de alerta industrial
  for (let i = 0; i < 5; i++) {
    line(im, 90 + i * 8, 14, 98 + i * 8, 22, C.yellowHazard);
    line(im, 90 + i * 8, 74, 98 + i * 8, 82, C.yellowHazard);
  }

  // Reforço dianteiro
  rect(im, 20, 28, 35, 40, C.steelMid);
  rect(im, 12, 34, 18, 28, C.steelDark);

  // Relevo de blindagem e rebites
  line(im, 50, 12, 125, 12, C.steelLight);
  line(im, 40, 84, 130, 84, C.rustMid);
  line(im, 20, 28, 55, 28, C.steelLight);
  line(im, 20, 68, 55, 68, C.rustMid);

  // Ponto de montagem da broca frontal
  rect(im, 2, 40, 14, 16, C.steelDark);
  rect(im, 0, 44, 6, 8, C.steelLight);

  // Núcleo central
  if (coreOpen) {
    // Portinholas abertas para os lados
    rect(im, 48, 38, 28, 20, [20, 10, 15, 255]);
    circle(im, 62, 48, 8, C.redCore, true);
    circle(im, 62, 48, 5, C.whiteHot, true);
    // Efeito de vapor / sobrecarga
    paint(im, 45, 48, ...C.orangeIndustrial);
  } else {
    // Portinhola blindada fechada
    rect(im, 52, 38, 22, 20, C.rustMid);
    rect(im, 56, 42, 14, 12, C.steelDark);
    line(im, 63, 38, 63, 58, C.steelLight);
  }

  // Se danificado, centelhas e fumaça
  if (damaged) {
    for (let j = 0; j < 8; j++) {
      paint(im, 40 + j * 11, 20 + (j % 3) * 22, ...C.yellowHazard);
    }
  }

  return im;
}

// Broca frontal rotativa (48x48, 4 frames)
function makeDrillFrame(f) {
  const im = image(48, 48);
  const cx = 24, cy = 24;
  const angle = (f * Math.PI) / 2;

  // Ponta cônica de tungstênio
  for (let x = 4; x <= 42; x++) {
    const halfH = Math.max(1, Math.round(((44 - x) / 44) * 18));
    for (let y = cy - halfH; y <= cy + halfH; y++) {
      const shade = (y - cy + halfH) / (halfH * 2 || 1);
      const col = shade < 0.3 ? C.steelLight : shade < 0.7 ? C.steelMid : C.steelDark;
      paint(im, x, y, ...col);
    }
  }

  // Dentes helicoidais em espiral rotativa
  for (let d = 0; d < 3; d++) {
    const a = angle + (d * 2 * Math.PI) / 3;
    const x = 12 + Math.cos(a) * 16;
    const y = cy + Math.sin(a) * 12;
    circle(im, x, y, 2.5, C.yellowHazard, true);
    paint(im, x - 2, y, ...C.whiteHot);
  }

  return im;
}

// Torre lateral com canhão (32x24, 4 frames)
function makeTurretFrame(f) {
  const im = image(32, 24);
  const cx = 16, cy = 12;
  // Base giratória
  circle(im, cx + 4, cy, 7.5, C.steelDark, true);
  circle(im, cx + 4, cy, 5.5, C.steelMid, true);

  // Cano duplo de disparo apontando para a esquerda
  rect(im, 0, cy - 4, 18, 3, C.steelMid);
  rect(im, 0, cy + 2, 18, 3, C.steelMid);
  rect(im, 0, cy - 3, 4, 2, C.orangeIndustrial);
  rect(im, 0, cy + 3, 4, 2, C.orangeIndustrial);

  if (f % 2 === 1) {
    // Muzzle flash no disparo
    circle(im, 0, cy - 3, 3, C.whiteHot, true);
    circle(im, 0, cy + 3, 3, C.whiteHot, true);
  }
  return im;
}

// Núcleo exposto (32x32, 4 frames)
function makeCoreFrame(f) {
  const im = image(32, 32);
  const cx = 16, cy = 16;
  const pulse = Math.sin((f * Math.PI) / 2) * 2;

  circle(im, cx, cy, 11 + pulse, [120, 25, 30, 200], true);
  circle(im, cx, cy, 8.5, C.redCore, true);
  circle(im, cx, cy, 5.5, C.orangeIndustrial, true);
  circle(im, cx, cy, 3, C.whiteHot, true);

  // Arcos de energia
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + f * 0.4;
    line(im, cx, cy, cx + Math.cos(a) * 13, cy + Math.sin(a) * 13, C.cyanLaser);
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
  ['public/assets/bosses/krm17/hull.png', 4, makeHullFrame],
  ['public/assets/bosses/krm17/drill.png', 4, makeDrillFrame],
  ['public/assets/bosses/krm17/turret.png', 4, makeTurretFrame],
  ['public/assets/bosses/krm17/core.png', 4, makeCoreFrame],
];

for (const [dest, count, draw] of defs) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, makePNG(Array.from({ length: count }, (_, i) => draw(i))));
  console.log(dest);
}

