/**
 * BULLET WAKE — Gerador de Sprites dos Chefes das Fases 02 a 05.
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
  glassDark: [24, 48, 62, 255],
  glassMid: [58, 122, 142, 255],
  glassLight: [142, 222, 235, 255],
  amberWarm: [235, 155, 65, 255],
  amberHot: [255, 215, 125, 255],
  bioStone: [45, 52, 60, 255],
  bioGlow: [75, 195, 165, 255],
  bioBright: [180, 245, 225, 255],
  stormChassis: [32, 40, 58, 255],
  stormMid: [62, 85, 125, 255],
  ionBlue: [85, 205, 255, 255],
  ionWhite: [225, 245, 255, 255],
  meshDark: [28, 24, 42, 255],
  meshPurple: [125, 68, 185, 255],
  meshPink: [235, 95, 195, 255],
  meshWhite: [255, 245, 255, 255],
};

// 1. Serpente de Extração - Cabeça (64x64, 4 frames)
function makeSerpentHeadFrame(f) {
  const im = image(64, 64);
  const jawAngle = Math.sin(f * (Math.PI / 2)) * 4;
  rect(im, 24, 16, 36, 32, C.glassDark);
  rect(im, 32, 20, 26, 24, C.glassMid);
  rect(im, 4, 22 - Math.round(jawAngle), 24, 8, C.amberWarm);
  rect(im, 4, 34 + Math.round(jawAngle), 24, 8, C.amberWarm);
  circle(im, 20, 32, 6 + (f % 2), C.amberHot, true);
  line(im, 8, 24, 28, 24, C.glassLight);
  line(im, 8, 40, 28, 40, C.glassLight);
  return im;
}

// 2. Serpente de Extração - Corpo (48x48, 4 frames)
function makeSerpentBodyFrame(f) {
  const im = image(48, 48);
  const pulse = Math.sin(f * (Math.PI / 2)) * 2;
  circle(im, 24, 24, 18 + pulse, C.glassDark, true);
  circle(im, 24, 24, 12, C.glassMid, true);
  circle(im, 24, 24, 5, C.glassLight, true);
  line(im, 10, 24, 38, 24, C.amberWarm);
  return im;
}

// 3. Fortaleza de Núcleos - Chassi (128x128, 4 frames)
function makeFortressChassisFrame(f) {
  const im = image(128, 128);
  rect(im, 40, 16, 75, 96, C.bioStone);
  rect(im, 60, 24, 52, 80, [32, 38, 46, 255]);
  for (let y = 30; y <= 98; y += 18) {
    line(im, 25, y, 75, y, C.bioGlow);
    circle(im, 85, y, 6, C.bioBright, true);
  }
  rect(im, 15, 48, 28, 32, C.bioStone);
  line(im, 15, 64, 43, 64, C.bioBright);
  return im;
}

// 4. Fortaleza de Núcleos - Núcleo (40x40, 4 frames)
function makeFortressCoreFrame(f) {
  const im = image(40, 40);
  const r = 12 + Math.sin(f * (Math.PI / 2)) * 3;
  circle(im, 20, 20, r + 2, C.bioGlow, false);
  circle(im, 20, 20, r, C.bioBright, true);
  circle(im, 20, 20, 4, [255, 255, 255, 255], true);
  return im;
}

// 5. Interceptador de Tempestade - Chassi (96x48, 4 frames)
function makeInterceptorChassisFrame(f) {
  const im = image(96, 48);
  rect(im, 30, 16, 58, 16, C.stormChassis);
  rect(im, 12, 20, 32, 8, C.stormMid);
  rect(im, 2, 22, 14, 4, C.ionBlue);
  line(im, 2, 24, 88, 24, C.ionWhite);
  const glow = (f % 2) * 2;
  rect(im, 86, 18, 6, 12 + glow, C.ionBlue);
  return im;
}

// 6. Interceptador de Tempestade - Asa (48x32, 4 frames)
function makeInterceptorWingFrame(f) {
  const im = image(48, 32);
  line(im, 4, 4, 44, 28, C.stormMid);
  line(im, 4, 6, 44, 30, C.stormChassis);
  const spark = (f * 7) % 24;
  circle(im, 10 + spark, 8 + Math.round(spark * 0.6), 2, C.ionWhite, true);
  return im;
}

// 7. Coração da MALHA - Monólito (112x112, 4 frames)
function makeMeshMonolithFrame(f) {
  const im = image(112, 112);
  rect(im, 28, 16, 68, 80, C.meshDark);
  rect(im, 40, 26, 44, 60, [18, 14, 30, 255]);
  for (let i = 0; i < 4; i++) {
    const offset = (f * 2 + i * 16) % 64;
    line(im, 32, 24 + offset, 80, 24 + offset, C.meshPurple);
  }
  rect(im, 12, 48, 20, 16, C.meshPink);
  rect(im, 84, 48, 20, 16, C.meshPink);
  return im;
}

// 8. Coração da MALHA - Coração do Wake (48x48, 4 frames)
function makeMeshHeartFrame(f) {
  const im = image(48, 48);
  const r = 14 + Math.sin(f * (Math.PI / 2)) * 3;
  circle(im, 24, 24, r + 4, C.meshPink, false);
  circle(im, 24, 24, r, C.meshPurple, true);
  circle(im, 24, 24, 6, C.meshWhite, true);
  return im;
}

// Montagem de spritesheet horizontal com PNG nativo
function writeSheet(frames, outPath) {
  const frameW = frames[0].w;
  const frameH = frames[0].h;
  const totalW = frameW * frames.length;
  const totalH = frameH;

  const raw = Buffer.alloc((totalW * 4 + 1) * totalH);
  let pos = 0;

  for (let y = 0; y < totalH; y++) {
    raw[pos++] = 0; // Filter: None
    for (let fi = 0; fi < frames.length; fi++) {
      const fr = frames[fi];
      const srcOffset = y * frameW * 4;
      fr.data.copy(raw, pos, srcOffset, srcOffset + frameW * 4);
      pos += frameW * 4;
    }
  }

  const compressed = deflateSync(raw);

  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(totalW, 0);
  ihdr.writeUInt32BE(totalH, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(outPath);
}

writeSheet([0, 1, 2, 3].map(makeSerpentHeadFrame), 'public/assets/bosses/serpent/head.png');
writeSheet([0, 1, 2, 3].map(makeSerpentBodyFrame), 'public/assets/bosses/serpent/body.png');
writeSheet([0, 1, 2, 3].map(makeFortressChassisFrame), 'public/assets/bosses/fortress/chassis.png');
writeSheet([0, 1, 2, 3].map(makeFortressCoreFrame), 'public/assets/bosses/fortress/core.png');
writeSheet([0, 1, 2, 3].map(makeInterceptorChassisFrame), 'public/assets/bosses/interceptor/chassis.png');
writeSheet([0, 1, 2, 3].map(makeInterceptorWingFrame), 'public/assets/bosses/interceptor/wing.png');
writeSheet([0, 1, 2, 3].map(makeMeshMonolithFrame), 'public/assets/bosses/mesh_core/monolith.png');
writeSheet([0, 1, 2, 3].map(makeMeshHeartFrame), 'public/assets/bosses/mesh_core/heart.png');
