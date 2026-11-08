/**
 * BULLET WAKE — Gerador de Portraits em Pixel Art dos 3 Pilotos Oficiais
 * Inspirado em Sonic Wings / Aero Fighters: foco na identidade humana dos operadores.
 * - Nolan Fitch (Callsign: CORRIDOR VANGUARD)
 * - Cora Wren (Callsign: WAKE WEAVER)
 * - Harlan Greer (Callsign: IRON BULWARK)
 * 100% nativo em Node 22 (sem dependências externas).
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

// NOLAN FITCH — Homem adulto jovem, cabelo escuro curto, uniforme militar cinza-azulado com detalhes ciano
function makeNolanPortrait() {
  const im = image(64, 64);
  const skinBase = [225, 175, 140, 255];
  const skinShadow = [185, 130, 100, 255];
  const hairDark = [30, 24, 28, 255];
  const hairLight = [60, 48, 55, 255];
  const suitBase = [32, 54, 76, 255];
  const suitShadow = [18, 32, 48, 255];
  const cyanLight = [0, 240, 255, 255];
  const white = [245, 250, 255, 255];

  // Moldura de ombros / Uniforme de voo
  for (let y = 42; y < 64; y++) {
    for (let x = 8; x < 56; x++) {
      paint(im, x, y, ...suitShadow);
    }
  }
  rect(im, 14, 46, 36, 18, suitBase);
  // Gola e comunicador no pescoço
  rect(im, 24, 38, 16, 8, [24, 40, 58, 255]);
  rect(im, 20, 45, 24, 3, [45, 75, 105, 255]);
  rect(im, 28, 46, 8, 2, cyanLight); // Led do comunicador

  // Pescoço
  rect(im, 26, 30, 12, 10, skinShadow);
  rect(im, 28, 30, 8, 9, skinBase);

  // Rosto / Cabeça (perfil 3/4 determinado)
  circle(im, 32, 22, 14, skinShadow, true);
  circle(im, 31, 21, 13, skinBase, true);

  // Mandíbula e queixo
  for (let y = 24; y <= 33; y++) {
    const w = 33 - y;
    rect(im, 25 + (33 - y) / 2, y, 14 - (y - 24) * 0.7, 1, skinBase);
  }

  // Olhos resolutos e sobrancelha
  rect(im, 24, 18, 5, 2, hairDark); // Sobrancelha direita
  rect(im, 33, 18, 6, 2, hairDark); // Sobrancelha esquerda
  paint(im, 26, 21, ...white);
  paint(im, 27, 21, 20, 80, 140, 255); // Íris azul/aço
  paint(im, 35, 21, ...white);
  paint(im, 36, 21, 20, 80, 140, 255);

  // Nariz e boca
  paint(im, 31, 23, ...skinShadow);
  paint(im, 31, 24, ...skinShadow);
  rect(im, 29, 28, 5, 1, [150, 95, 75, 255]); // Boca séria

  // Cabelo escuro curto com mechas recortadas
  circle(im, 31, 13, 13, hairDark, true);
  for (let x = 18; x <= 44; x++) {
    const depth = Math.sin(((x - 18) / 26) * Math.PI) * 8;
    rect(im, x, 7, 1, depth + 6, hairDark);
    if (x % 3 === 0) paint(im, x, 9, ...hairLight);
  }
  // Franja curta militar
  rect(im, 22, 14, 18, 3, hairDark);

  // Auricular / fone de ouvido de piloto ciano
  rect(im, 18, 20, 3, 7, [20, 35, 50, 255]);
  paint(im, 19, 23, ...cyanLight);

  return im;
}

// CORA WREN — Mulher de cabelo prateado curto, uniforme ametista/prata com interface neural menta
function makeCoraPortrait() {
  const im = image(64, 64);
  const skinBase = [240, 195, 170, 255];
  const skinShadow = [195, 145, 125, 255];
  const hairSilver = [210, 220, 235, 255];
  const hairShade = [155, 170, 190, 255];
  const suitAmetista = [65, 35, 85, 255];
  const suitShadow = [35, 18, 50, 255];
  const mintGreen = [110, 230, 185, 255];
  const white = [255, 255, 255, 255];

  // Ombros elegantes / traje de alta mobilidade
  for (let y = 43; y < 64; y++) {
    for (let x = 10; x < 54; x++) {
      paint(im, x, y, ...suitShadow);
    }
  }
  rect(im, 16, 47, 32, 17, suitAmetista);
  // Colarinho com acabamento prata e sensor neural
  rect(im, 23, 40, 18, 7, [48, 25, 65, 255]);
  rect(im, 20, 46, 24, 2, [180, 150, 205, 255]);
  rect(im, 27, 46, 10, 2, mintGreen); // Led menta de sincronização

  // Pescoço gracioso
  rect(im, 27, 31, 10, 10, skinShadow);
  rect(im, 28, 31, 8, 9, skinBase);

  // Rosto em 3/4
  circle(im, 32, 21, 12, skinShadow, true);
  circle(im, 31, 20, 11, skinBase, true);

  // Queixo afinado
  for (let y = 25; y <= 33; y++) {
    rect(im, 27 + (33 - y) * 0.4, y, 9 - (y - 25) * 0.8, 1, skinBase);
  }

  // Olhos afiados e expressivos
  rect(im, 24, 18, 5, 1, hairShade); // Sobrancelha
  rect(im, 33, 18, 5, 1, hairShade);
  paint(im, 25, 20, ...white);
  paint(im, 26, 20, 60, 200, 160, 255); // Olhos esmeralda
  paint(im, 34, 20, ...white);
  paint(im, 35, 20, 60, 200, 160, 255);

  // Nariz e lábios
  paint(im, 31, 23, ...skinShadow);
  rect(im, 29, 27, 4, 1, [200, 110, 115, 255]);

  // Cabelo prateado curto com franja assimétrica moderna
  circle(im, 32, 13, 13, hairSilver, true);
  for (let x = 18; x <= 45; x++) {
    const depth = Math.sin(((x - 18) / 27) * Math.PI) * 9;
    rect(im, x, 6, 1, depth + 7, hairSilver);
    if (x % 2 === 0) paint(im, x, 8, ...white);
  }
  // Franja caindo na lateral
  for (let y = 14; y <= 24; y++) {
    paint(im, 21 + (y - 14) * 0.3, y, ...hairSilver);
    paint(im, 22 + (y - 14) * 0.3, y, ...hairShade);
  }

  // Visor neural lateral no ouvido
  circle(im, 19, 21, 3, [35, 25, 45, 255], true);
  paint(im, 19, 21, ...mintGreen);

  return im;
}

// HARLAN GREER — Homem maduro veterano, cabeça raspada, pele bronzeada, uniforme reforçado cinza e laranja
function makeHarlanPortrait() {
  const im = image(64, 64);
  const skinBase = [190, 130, 95, 255];
  const skinShadow = [145, 95, 65, 255];
  const skinHighlight = [215, 155, 120, 255];
  const stubble = [125, 85, 60, 255];
  const suitCharcoal = [45, 40, 42, 255];
  const suitShadow = [25, 22, 24, 255];
  const orangeHazard = [245, 115, 25, 255];
  const amberGlow = [250, 190, 50, 255];
  const white = [240, 245, 250, 255];

  // Ombros robustos e blindados
  for (let y = 41; y < 64; y++) {
    for (let x = 6; x < 58; x++) {
      paint(im, x, y, ...suitShadow);
    }
  }
  rect(im, 12, 45, 40, 19, suitCharcoal);
  // Placas de armadura e gola pesada
  rect(im, 20, 38, 24, 9, [32, 28, 30, 255]);
  rect(im, 16, 44, 32, 3, orangeHazard); // Faixa industrial laranja
  rect(im, 28, 44, 8, 3, amberGlow);

  // Pescoço forte e musculoso
  rect(im, 24, 30, 16, 11, skinShadow);
  rect(im, 27, 30, 10, 10, skinBase);

  // Cabeça raspada imponente e mandíbula forte
  circle(im, 32, 19, 14, skinShadow, true);
  circle(im, 32, 18, 13, skinBase, true);
  // Brilho no crânio raspado
  circle(im, 30, 12, 6, skinHighlight, true);

  // Mandíbula quadrada
  for (let y = 24; y <= 33; y++) {
    rect(im, 24, y, 16, 1, skinBase);
  }
  // Barba cerrada / stubble de veterano
  for (let y = 26; y <= 33; y++) {
    for (let x = 24; x <= 40; x++) {
      if ((x + y) % 2 === 0) paint(im, x, y, ...stubble);
    }
  }

  // Olhos calmos e experientes de veterano
  rect(im, 23, 17, 6, 2, [100, 70, 50, 255]); // Sobrancelha espessa
  rect(im, 34, 17, 6, 2, [100, 70, 50, 255]);
  paint(im, 25, 20, ...white);
  paint(im, 26, 20, 160, 95, 40, 255); // Olhos castanho-âmbar
  paint(im, 36, 20, ...white);
  paint(im, 37, 20, 160, 95, 40, 255);

  // Cicatriz de combate sutil na bochecha esquerda
  paint(im, 26, 24, 210, 140, 110, 255);
  paint(im, 27, 25, 210, 140, 110, 255);

  // Nariz robusto e boca firme
  rect(im, 30, 22, 3, 3, skinShadow);
  rect(im, 28, 28, 7, 1, [120, 75, 55, 255]);

  // Headset tático militar no ouvido
  rect(im, 17, 19, 4, 8, [30, 26, 28, 255]);
  rect(im, 18, 21, 2, 4, orangeHazard);

  return im;
}

function makePNG(im) {
  const w = im.w, h = im.h;
  const pw = w, raw = Buffer.alloc((pw * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (pw * 4 + 1);
    im.data.copy(raw, row + 1, y * w * 4, (y + 1) * w * 4);
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

const pilots = [
  ['public/assets/pilots/nolan.png', makeNolanPortrait],
  ['public/assets/pilots/cora.png', makeCoraPortrait],
  ['public/assets/pilots/harlan.png', makeHarlanPortrait],
];

for (const [dest, draw] of pilots) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, makePNG(draw()));
  console.log(dest);
}

