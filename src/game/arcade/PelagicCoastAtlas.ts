import Phaser from 'phaser';
import {
  ARCHIPELAGO_SPECS,
  COAST_PERIOD,
  COAST_WIDTH,
  coastBoundary,
  type ArchipelagoFormationSpec,
  type CoastSide,
} from './PelagicCoastGeometry';

export { COAST_PERIOD, COAST_WIDTH } from './PelagicCoastGeometry';

export const COAST_TEXTURE = 'pelagic-continuous-shores';
export const OCEAN_DEPTH_TEXTURE = 'pelagic-ocean-depth';
export const OCEAN_CAUSTICS_TEXTURE = 'pelagic-ocean-caustics';
export const VORTEX_TEXTURE = 'pelagic-abyssal-vortex';

const TAU = Math.PI * 2;
const fract = (v: number): number => v - Math.floor(v);
const hash = (n: number): number => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);

function periodicNoise(x: number, y: number, yCycles: number, seed: number): number {
  const wy = (y / COAST_PERIOD) * TAU * yCycles;
  return (
    Math.sin(x * 0.045 + wy + seed) * 0.5 +
    Math.cos(x * 0.09 - wy * 2.0 + seed * 1.7) * 0.3 +
    Math.sin((x + y * 0.5) * 0.14 + seed * 2.3) * 0.2
  );
}

/**
 * Extrai uma célula 512x512 de um spritesheet e remove qualquer resquício de água/ciano
 * nas bordas externas, aplicando feathering suave nas extremidades do tile.
 */
function extractCleanCell(
  atlas: HTMLImageElement,
  frame: number,
  options: { stripWater?: boolean; keepInteriorBlue?: boolean; radialFeather?: boolean } = {},
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw Error('Contexto 2D indisponível para recorte de sprite costeiro');

  ctx.drawImage(atlas, (frame % 4) * 512, Math.floor(frame / 4) * 512, 512, 512, 0, 0, 512, 512);
  const img = ctx.getImageData(0, 0, 512, 512);
  const data = img.data;

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4;
      const a = data[i + 3];
      if (a === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (options.stripWater) {
        // Protege telhados azuis internos de estruturas (galpão portuário e casa do faroleiro)
        const inSafeRoofZone =
          options.keepInteriorBlue && x > 90 && x < 430 && y > 85 && y < 395;
        if (!inSafeRoofZone) {
          const isWaterOrCyan =
            (b > r * 1.14 && g > r * 0.98 && r < 145) ||
            (r < 32 && g < 48 && b < 68);
          if (isWaterOrCyan) {
            data[i + 3] = 0;
            continue;
          }
        }
      }

      if (options.radialFeather) {
        const dx = (x - 256) / 248;
        const dy = (y - 256) / 248;
        const dist = Math.hypot(dx, dy);
        const fade = Math.max(0, Math.min(1, (1 - dist) / 0.28));
        data[i + 3] = Math.round(a * fade * fade);
      } else {
        const edge = Math.min(x, 511 - x, y, 511 - y);
        const fade = Math.min(1, Math.max(0, (edge - 4) / 18));
        data[i + 3] = Math.round(a * fade);
      }
    }
  }

  // Suaviza contornos semi-transparentes eliminando halos cianos residuais
  for (let y = 1; y < 511; y++) {
    for (let x = 1; x < 511; x++) {
      const i = (y * 512 + x) * 4;
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Verifica se está na borda imediata (vizinho transparente)
      const n0 = data[((y - 1) * 512 + x) * 4 + 3];
      const n1 = data[((y + 1) * 512 + x) * 4 + 3];
      const n2 = data[(y * 512 + (x - 1)) * 4 + 3];
      const n3 = data[(y * 512 + (x + 1)) * 4 + 3];
      if (n0 === 0 || n1 === 0 || n2 === 0 || n3 === 0) {
        if (b > r * 1.18 && g > r * 1.08 && r < 135) {
          data[i + 3] = 0;
        } else {
          data[i + 3] = Math.round(data[i + 3] * 0.65);
        }
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Desenha um carimbo em (x, y, w, h) replicando automaticamente em y - COAST_PERIOD e y + COAST_PERIOD
 * quando cruza a costura cíclica vertical (0 / 2400).
 */
function drawWrapped(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1,
): void {
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  for (const shift of [0, -COAST_PERIOD, COAST_PERIOD]) {
    const yy = y + shift;
    if (yy + h >= 0 && yy <= COAST_PERIOD) {
      ctx.drawImage(source, x, yy, w, h);
    }
  }
  ctx.globalAlpha = prevAlpha;
}

/**
 * Desenha uma sub-região (sx, sy, sw, sh) de um carimbo com suporte a costura cíclica.
 */
function drawWrappedSub(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  alpha = 1,
): void {
  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  for (const shift of [0, -COAST_PERIOD, COAST_PERIOD]) {
    const yy = dy + shift;
    if (yy + dh >= 0 && yy <= COAST_PERIOD) {
      ctx.drawImage(source, sx, sy, sw, sh, dx, yy, dw, dh);
    }
  }
  ctx.globalAlpha = prevAlpha;
}

/**
 * Ancora cada formação costeira principal à borda do HUD (x = 0 na esquerda, x = 384 na direita)
 * APENAS dentro do intervalo [yStart, yEnd] daquela formação, evitando buracos ovais atrás
 * das falésias/praias sem jamais criar margens contínuas nos trechos de mar aberto.
 */
function paintFormationRootShoulder(
  ctx: CanvasRenderingContext2D,
  spec: ArchipelagoFormationSpec,
  foliageStamp: HTMLCanvasElement,
  rockStamp: HTMLCanvasElement,
): void {
  // Ilhotas e rochas costeiras menores mantêm contorno livre sem ombro largo
  if (spec.kind === 'rock-outcrop' || spec.kind === 'palm-islet') return;

  const pad = 16;
  const y0 = spec.yStart + pad;
  const y1 = spec.yEnd - pad;
  if (y1 <= y0) return;

  for (const shift of [0, -COAST_PERIOD, COAST_PERIOD]) {
    const startY = y0 + shift;
    const endY = y1 + shift;
    if (endY < 0 || startY > COAST_PERIOD) continue;

    ctx.save();
    ctx.beginPath();
    const clampedStart = Math.max(0, Math.floor(startY));
    const clampedEnd = Math.min(COAST_PERIOD, Math.ceil(endY));
    const side: CoastSide = spec.side;

    if (side < 0) {
      ctx.moveTo(0, clampedStart);
      for (let y = clampedStart; y <= clampedEnd; y += 4) {
        const u = (y - startY) / (endY - startY);
        const taper = Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
        const reach = Math.min(66, coastBoundary(y, -1) * 0.62) * Math.pow(taper, 0.55);
        ctx.lineTo(reach, y);
      }
      ctx.lineTo(0, clampedEnd);
    } else {
      ctx.moveTo(COAST_WIDTH, clampedStart);
      for (let y = clampedStart; y <= clampedEnd; y += 4) {
        const u = (y - startY) / (endY - startY);
        const taper = Math.sin(Math.PI * Math.max(0, Math.min(1, u)));
        const extent = COAST_WIDTH - coastBoundary(y, 1);
        const reach = Math.min(64, extent * 0.6) * Math.pow(taper, 0.55);
        ctx.lineTo(COAST_WIDTH - reach, y);
      }
      ctx.lineTo(COAST_WIDTH, clampedEnd);
    }
    ctx.closePath();
    ctx.clip();

    // Base rochosa/arenosa cálida sob a vegetação da encosta
    const grad =
      side < 0
        ? ctx.createLinearGradient(0, 0, 72, 0)
        : ctx.createLinearGradient(COAST_WIDTH, 0, COAST_WIDTH - 72, 0);
    grad.addColorStop(0, '#3a6234');
    grad.addColorStop(0.45, '#6e7f48');
    grad.addColorStop(0.8, '#c6a96e');
    grad.addColorStop(1, '#e8cb8e');
    ctx.fillStyle = grad;
    ctx.fillRect(
      side < 0 ? 0 : COAST_WIDTH - 78,
      clampedStart,
      78,
      clampedEnd - clampedStart,
    );

    // Carimba rochas e copa tropical ao longo da raiz da formação
    const step = 115;
    for (let yy = startY - 30; yy < endY + 20; yy += step) {
      const xPos = side < 0 ? -42 : COAST_WIDTH - 108;
      ctx.drawImage(rockStamp, xPos, yy, 150, 145);
      ctx.drawImage(foliageStamp, xPos + (side < 0 ? -8 : 8), yy + 18, 145, 140);
    }
    ctx.restore();
  }
}

/**
 * Compõe todas as 10 formações assimétricas do arquipélago (ARCHIPELAGO_SPECS)
 * combinando as peças dedicadas de `pelagic-archipelago` e `pelagic-coast`.
 */
function composeArchipelagoLand(
  landCtx: CanvasRenderingContext2D,
  reefCtx: CanvasRenderingContext2D,
  archAtlas: HTMLImageElement,
  coastAtlas: HTMLImageElement,
): void {
  // Extrai células limpas do novo atlas de arquipélago 2.5D
  const villageCove = extractCleanCell(archAtlas, 0);
  const harborMain = extractCleanCell(archAtlas, 1, { keepInteriorBlue: true });
  const lighthouseCliff = extractCleanCell(archAtlas, 2, { keepInteriorBlue: true });
  const rightCliffCove = extractCleanCell(archAtlas, 3);
  const seaStackRocks = extractCleanCell(archAtlas, 4);
  const coralShelf = extractCleanCell(archAtlas, 5);
  const palmIslet = extractCleanCell(archAtlas, 6);

  // Extrai células complementares sem água do atlas costeiro
  const tropicalIsland = extractCleanCell(coastAtlas, 0, { stripWater: true });
  const rockyPalms = extractCleanCell(coastAtlas, 1, { stripWater: true });
  const submergedReef = extractCleanCell(coastAtlas, 3, { stripWater: true });
  const harborBoatPier = extractCleanCell(coastAtlas, 4, { stripWater: true, keepInteriorBlue: true });
  const harborRightPier = extractCleanCell(coastAtlas, 5, { stripWater: true, keepInteriorBlue: true });
  const smallPalmRock = extractCleanCell(coastAtlas, 6, { stripWater: true });

  // 1. Camada de recifes de coral submersos nas zonas costeiras rasas (Camada 2 — Água intermediária)
  const coralPlacements: Array<{ x: number; y: number; w: number; h: number; alt?: boolean; alpha: number }> = [
    // Enseada da Vila (Esquerda, id = 0)
    { x: 18, y: -35, w: 112, h: 108, alpha: 0.84 },
    { x: 24, y: 185, w: 118, h: 112, alpha: 0.86 },
    // Afloramento Rochoso (Esquerda, id = 1)
    { x: 4, y: 542, w: 96, h: 96, alt: true, alpha: 0.82 },
    // Península de Palmeiras (Esquerda, id = 2)
    { x: 16, y: 1005, w: 114, h: 110, alpha: 0.84 },
    { x: 10, y: 1155, w: 104, h: 100, alt: true, alpha: 0.8 },
    // Complexo Portuário e Corais ao Sul (Esquerda, id = 3 — fiel às Referências 2 e 4!)
    { x: 14, y: 1475, w: 110, h: 104, alpha: 0.82 },
    { x: -6, y: 1755, w: 142, h: 136, alpha: 0.92 },
    { x: 18, y: 1825, w: 118, h: 112, alt: true, alpha: 0.86 },
    // Falésia Norte e Ilhota (Direita, id = 4 e id = 5)
    { x: COAST_WIDTH - 122, y: -60, w: 112, h: 106, alpha: 0.82 },
    { x: COAST_WIDTH - 110, y: 268, w: 104, h: 100, alt: true, alpha: 0.84 },
    // Atol Rochoso (Direita, id = 6)
    { x: COAST_WIDTH - 98, y: 742, w: 94, h: 90, alpha: 0.82 },
    // Píer Direito (Direita, id = 7)
    { x: COAST_WIDTH - 128, y: 1070, w: 116, h: 110, alpha: 0.82 },
    { x: COAST_WIDTH - 118, y: 1245, w: 110, h: 104, alt: true, alpha: 0.82 },
    // Promontório do Farol e Enseada de Corais Sul (Direita, id = 8 e id = 9 — fiel às Referências 2 e 4!)
    { x: COAST_WIDTH - 126, y: 1595, w: 116, h: 110, alpha: 0.85 },
    { x: COAST_WIDTH - 142, y: 1835, w: 136, h: 130, alpha: 0.92 },
    { x: COAST_WIDTH - 118, y: 1935, w: 114, h: 108, alt: true, alpha: 0.86 },
  ];

  for (const c of coralPlacements) {
    drawWrapped(reefCtx, c.alt ? submergedReef : coralShelf, c.x, c.y, c.w, c.h, c.alpha);
  }

  // 2. Ancora a raiz costeira de cada formação principal dentro do seu [yStart, yEnd]
  for (const spec of ARCHIPELAGO_SPECS) {
    paintFormationRootShoulder(landCtx, spec, tropicalIsland, rockyPalms);
  }

  // 3. Compõe as formações individuais com peças conectadas e sem repetição curta:

  // --- LADO ESQUERDO (-1) ---
  // id = 0: [-65 .. 295] Enseada da Vila Tropical (Cena 1 — Início da Fase & Ref 1)
  // Ponta rochosa/praia ao norte + enseada com cabanas de madeira, palmeiras, flores e rochas
  drawWrapped(landCtx, rockyPalms, -42, -68, 152, 148);
  drawWrapped(landCtx, tropicalIsland, -38, 8, 148, 144);
  drawWrapped(landCtx, villageCove, -26, 92, 156, 198);
  drawWrapped(landCtx, seaStackRocks, 44, 58, 66, 64);
  drawWrapped(landCtx, seaStackRocks, 34, 244, 72, 68);

  // id = 1: [535 .. 655] Afloramento Rochoso de Mar Aberto (Trecho de Mar Aberto)
  drawWrapped(landCtx, smallPalmRock, -24, 538, 102, 104);
  drawWrapped(landCtx, seaStackRocks, 12, 562, 78, 76);

  // id = 2: [985 .. 1245] Península Tropical & Enseada de Cabanas (Combate Intermediário & Ref 1)
  drawWrapped(landCtx, rockyPalms, -38, 982, 146, 142);
  drawWrapped(landCtx, villageCove, -28, 1055, 152, 182);
  drawWrapped(landCtx, seaStackRocks, 36, 1188, 68, 66);

  // id = 3: [1480 .. 1890] Complexo Portuário Conectado à Costa (Ref 2, Ref 3 e Ref 4)
  // Promontório tropical norte conectado ao cais -> Silo prateado, galpão azul, 2 guindastes amarelos,
  // contêineres, píeres sobre estacas, barco atracado e rochas/corais ao sul!
  drawWrapped(landCtx, tropicalIsland, -38, 1468, 146, 136);
  drawWrapped(landCtx, smallPalmRock, -24, 1522, 118, 112);
  // Complexo portuário principal (silo, galpão azul, guindaste superior, contêineres e píeres)
  drawWrapped(landCtx, harborMain, -16, 1544, 162, 224);
  // Segundo guindaste amarelo no píer inferior + barco atracado na dársena (fiel às Referências 2 e 4)
  drawWrappedSub(landCtx, harborMain, 195, 48, 220, 175, 44, 1654, 86, 72);
  drawWrappedSub(landCtx, harborBoatPier, 165, 295, 280, 195, 14, 1712, 110, 78);
  // Rochas oceânicas facetadas ao sul do píer (como nas Referências 2 e 4)
  drawWrapped(landCtx, seaStackRocks, 6, 1796, 86, 84);
  drawWrapped(landCtx, smallPalmRock, -32, 1830, 112, 98);

  // --- LADO DIREITO (+1) ---
  // id = 4: [-85 .. 85] Falésia Rochosa & Enseada Norte (Cena 1 — Topo Direito)
  drawWrapped(landCtx, rightCliffCove, COAST_WIDTH - 128, -86, 148, 172);
  drawWrapped(landCtx, seaStackRocks, COAST_WIDTH - 114, 28, 68, 64);

  // id = 5: [255 .. 385] Ilhota Tropical de Palmeiras & Rochas (Cena 1 & Ref 1 — Base Direita)
  drawWrapped(landCtx, seaStackRocks, COAST_WIDTH - 102, 232, 66, 62);
  drawWrapped(landCtx, palmIslet, COAST_WIDTH - 106, 262, 122, 124);

  // id = 6: [735 .. 855] Atol Rochoso de Mar Aberto (Trecho de Mar Aberto)
  drawWrapped(landCtx, seaStackRocks, COAST_WIDTH - 86, 738, 86, 84);
  drawWrapped(landCtx, smallPalmRock, COAST_WIDTH - 68, 772, 84, 82);

  // id = 7: [1065 .. 1330] Píer Auxiliar Direito Conectado à Falésia (Ref 1 — Direita)
  drawWrapped(landCtx, rockyPalms, COAST_WIDTH - 114, 1058, 138, 132);
  drawWrapped(landCtx, harborRightPier, COAST_WIDTH - 144, 1112, 168, 186);
  drawWrapped(landCtx, seaStackRocks, COAST_WIDTH - 112, 1272, 72, 68);

  // id = 8: [1485 .. 1695] Promontório Rochoso do Farol & Casa do Faroleiro (Ref 2, Ref 3 e Ref 4)
  drawWrapped(landCtx, rightCliffCove, COAST_WIDTH - 124, 1472, 138, 128);
  drawWrapped(landCtx, lighthouseCliff, COAST_WIDTH - 144, 1492, 148, 198);
  drawWrapped(landCtx, seaStackRocks, COAST_WIDTH - 122, 1642, 72, 68);

  // Rocha oceânica isolada na entrada sul da baía do farol (fiel às Referências 2 e 4)
  drawWrapped(landCtx, seaStackRocks, COAST_WIDTH - 112, 1802, 64, 60);

  // id = 9: [1850 .. 2040] Enseada de Praia Tropical, Palmeiras e Corais (Ref 2 e Ref 4 — Base Direita)
  drawWrapped(landCtx, rightCliffCove, COAST_WIDTH - 118, 1848, 138, 168);
  drawWrapped(landCtx, palmIslet, COAST_WIDTH - 108, 1912, 124, 126);
  drawWrapped(landCtx, seaStackRocks, COAST_WIDTH - 96, 1986, 70, 66);
}

/**
 * Calcula o campo de distância aproximado (em pixels, 0..maxDist) até a massa costeira mais próxima,
 * respeitando a periodicidade vertical (COAST_PERIOD = 2400).
 */
function computeCoastalDistanceField(landData: Uint8ClampedArray, maxDist = 36): Float32Array {
  const size = COAST_WIDTH * COAST_PERIOD;
  const dist = new Float32Array(size);
  const INF = maxDist + 10;

  for (let i = 0; i < size; i++) {
    dist[i] = landData[i * 4 + 3] > 72 ? 0 : INF;
  }

  // Passada 1: topo -> base (com wrap vertical)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < COAST_PERIOD; y++) {
      const ym1 = (y - 1 + COAST_PERIOD) % COAST_PERIOD;
      const row = y * COAST_WIDTH;
      const rowUp = ym1 * COAST_WIDTH;
      for (let x = 0; x < COAST_WIDTH; x++) {
        let d = dist[row + x];
        if (d === 0) continue;
        if (dist[rowUp + x] + 1 < d) d = dist[rowUp + x] + 1;
        if (x > 0 && dist[row + x - 1] + 1 < d) d = dist[row + x - 1] + 1;
        if (x > 0 && dist[rowUp + x - 1] + 1.414 < d) d = dist[rowUp + x - 1] + 1.414;
        if (x + 1 < COAST_WIDTH && dist[rowUp + x + 1] + 1.414 < d) d = dist[rowUp + x + 1] + 1.414;
        dist[row + x] = d;
      }
    }
  }

  // Passada 2: base -> topo (com wrap vertical)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = COAST_PERIOD - 1; y >= 0; y--) {
      const yp1 = (y + 1) % COAST_PERIOD;
      const row = y * COAST_WIDTH;
      const rowDown = yp1 * COAST_WIDTH;
      for (let x = COAST_WIDTH - 1; x >= 0; x--) {
        let d = dist[row + x];
        if (d === 0) continue;
        if (dist[rowDown + x] + 1 < d) d = dist[rowDown + x] + 1;
        if (x + 1 < COAST_WIDTH && dist[row + x + 1] + 1 < d) d = dist[row + x + 1] + 1;
        if (x + 1 < COAST_WIDTH && dist[rowDown + x + 1] + 1.414 < d) d = dist[rowDown + x + 1] + 1.414;
        if (x > 0 && dist[rowDown + x - 1] + 1.414 < d) d = dist[rowDown + x - 1] + 1.414;
        dist[row + x] = d;
      }
    }
  }

  return dist;
}

/**
 * Renderiza a transição natural Terra–Água em 4 estágios (Seção 5):
 * 1. Oceano profundo (transparente -> preserva as 3 camadas oceânicas)
 * 2. Transição gradual para água rasa azul-turquesa + recifes submersos
 * 3. Espuma branca irregular e interrompida acompanhando o contorno real de cada formação
 * 4. Sombra direcional 2.5D + Areia, rocha, falésia e estruturas costeiras
 */
function renderNaturalCoastalTransition(
  outCtx: CanvasRenderingContext2D,
  landCanvas: HTMLCanvasElement,
  reefCanvas: HTMLCanvasElement,
): void {
  const landCtx = landCanvas.getContext('2d', { willReadFrequently: true })!;
  const landPixels = landCtx.getImageData(0, 0, COAST_WIDTH, COAST_PERIOD);
  const landData = landPixels.data;
  const distField = computeCoastalDistanceField(landData, 32);

  const waterTransition = outCtx.createImageData(COAST_WIDTH, COAST_PERIOD);
  const out = waterTransition.data;
  const foamDataImg = outCtx.createImageData(COAST_WIDTH, COAST_PERIOD);
  const foam = foamDataImg.data;

  for (let y = 0; y < COAST_PERIOD; y++) {
    const row = y * COAST_WIDTH;
    for (let x = 0; x < COAST_WIDTH; x++) {
      const idx = row + x;
      const d = distField[idx];
      if (d > 28) continue;

      const n1 = periodicNoise(x, y, 6, 1.3);
      const n2 = periodicNoise(x * 1.7, y * 1.4, 11, 4.8);
      const maxShelf = 19 + n1 * 5.5;

      if (d > maxShelf) continue;

      const i = idx * 4;
      // Estágio 2: Água rasa azul-turquesa gradual com feathering orgânico
      const t = Math.max(0, Math.min(1, 1 - d / maxShelf));
      const smooth = t * t * (3 - 2 * t);

      let r = Math.round(9 + smooth * 42);
      let g = Math.round(102 + smooth * 114);
      let b = Math.round(158 + smooth * 76);
      let a = Math.round(smooth * 172);

      // Sombra direcional suave 2.5D (luz solar vinda do topo-esquerda -> sombra em +4, +5)
      const sx = x - 4;
      const sy = (y - 5 + COAST_PERIOD) % COAST_PERIOD;
      if (sx >= 0 && sx < COAST_WIDTH) {
        const shadowSourceAlpha = landData[(sy * COAST_WIDTH + sx) * 4 + 3];
        if (shadowSourceAlpha > 90 && d > 0 && d < 8.5) {
          const shadowStrength = (1 - d / 8.5) * 0.44;
          r = Math.round(r * (1 - shadowStrength) + 5 * shadowStrength);
          g = Math.round(g * (1 - shadowStrength) + 26 * shadowStrength);
          b = Math.round(b * (1 - shadowStrength) + 54 * shadowStrength);
          a = Math.max(a, Math.round(shadowSourceAlpha * 0.38));
        }
      }

      out[i] = r;
      out[i + 1] = g;
      out[i + 2] = b;
      out[i + 3] = a;

      // Estágio 3: Espuma branca irregular e interrompida ao longo do contorno real (camada separada acima dos corais)
      const foamWidth = 3.2 + (n2 + 0.5) * 2.5;
      const foamGapNoise =
        Math.sin(x * 0.21 + (y / COAST_PERIOD) * TAU * 38) * 0.5 +
        Math.cos(x * 0.13 - (y / COAST_PERIOD) * TAU * 23) * 0.5;

      if (d >= 0.2 && d <= foamWidth && foamGapNoise > -0.26) {
        const foamIntensity = Math.min(
          1,
          (1 - Math.abs(d - foamWidth * 0.4) / (foamWidth * 0.68)) *
            Math.min(1, (foamGapNoise + 0.26) * 2.1),
        );
        if (foamIntensity > 0.06) {
          foam[i] = 248;
          foam[i + 1] = 255;
          foam[i + 2] = 255;
          foam[i + 3] = Math.round(248 * foamIntensity);
        }
      } else if (d > foamWidth + 1.6 && d < foamWidth + 4.6 && foamGapNoise > 0.22) {
        const ripple = Math.min(1, (foamGapNoise - 0.22) * 1.35);
        foam[i] = 224;
        foam[i + 1] = 252;
        foam[i + 2] = 255;
        foam[i + 3] = Math.round(185 * ripple);
      }
    }
  }

  // 1) Desenha a água rasa turquesa + sombra direcional
  outCtx.putImageData(waterTransition, 0, 0);
  // 2) Desenha os recifes e corais submersos nítidos sobre a zona rasa
  outCtx.drawImage(reefCanvas, 0, 0);
  // 3) Desenha a espuma branca irregular e interrompida acompanhando o contorno costeiro
  const foamCanvas = document.createElement('canvas');
  foamCanvas.width = COAST_WIDTH;
  foamCanvas.height = COAST_PERIOD;
  foamCanvas.getContext('2d')!.putImageData(foamDataImg, 0, 0);
  outCtx.drawImage(foamCanvas, 0, 0);
  // 4) Compõe a massa costeira sólida 2.5D (areia, falésias, vegetação, porto e farol) no topo
  outCtx.drawImage(landCanvas, 0, 0);
}

/**
 * Camada 1 — Profundidade oceânica (512x1024 seamless):
 * Azul-cobalto profundo, manchas orgânicas abissais com transições suaves e recifes submersos discretos.
 */
export function installOceanDepthTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(OCEAN_DEPTH_TEXTURE)) return OCEAN_DEPTH_TEXTURE;
  const W = 512;
  const H = 1024;
  const tex = scene.textures.createCanvas(OCEAN_DEPTH_TEXTURE, W, H);
  if (!tex) throw Error('Não foi possível criar textura de profundidade oceânica');
  const ctx = tex.context;
  const img = ctx.createImageData(W, H);
  const data = img.data;

  for (let y = 0; y < H; y++) {
    const wy = (y / H) * TAU;
    for (let x = 0; x < W; x++) {
      const wx = (x / W) * TAU;
      // Manchas orgânicas periódicas em X e Y
      const n1 =
        Math.sin(wx * 2 + wy * 2 + 0.7) * 0.42 +
        Math.cos(wx * 3 - wy * 3 + 1.9) * 0.33 +
        Math.sin(wx * 5 + wy * 4 - 1.1) * 0.25;
      const n2 =
        Math.cos(wx * 4 + wy * 5 + 2.4) * 0.5 +
        Math.sin(wx * 7 - wy * 6 + 0.3) * 0.5;

      // Variação entre fossas abissais (#032552) e bancos oceânicos profundos (#0c589c)
      const depthFactor = Math.max(0, Math.min(1, 0.5 + n1 * 0.45));
      const reefHint = Math.max(0, n2 - 0.35) * 0.65;

      const i = (y * W + x) * 4;
      data[i] = Math.round(3 + depthFactor * 9 + reefHint * 14);
      data[i + 1] = Math.round(36 + depthFactor * 48 + reefHint * 42);
      data[i + 2] = Math.round(82 + depthFactor * 68 + reefHint * 44);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Estampa formações de recifes abissais discretas (baixa opacidade) no fundo oceânico
  if (scene.textures.exists('pelagic-archipelago')) {
    const archAtlas = scene.textures.get('pelagic-archipelago').getSourceImage() as HTMLImageElement;
    if (archAtlas && archAtlas.naturalWidth >= 2048) {
      const deepCoral = extractCleanCell(archAtlas, 5, { radialFeather: true });
      const spots = [
        { x: 32, y: 90, s: 150, a: 0.16 },
        { x: 295, y: 280, s: 165, a: 0.14 },
        { x: 110, y: 540, s: 140, a: 0.15 },
        { x: 310, y: 780, s: 155, a: 0.16 },
      ];
      ctx.save();
      for (const sp of spots) {
        ctx.globalAlpha = sp.a;
        ctx.drawImage(deepCoral, sp.x, sp.y, sp.s, sp.s);
      }
      ctx.restore();
    }
  }

  tex.refresh();
  return OCEAN_DEPTH_TEXTURE;
}

/**
 * Camada 2 — Água intermediária (512x512 seamless):
 * Malha de cáusticas submarinas animadas e variações suaves de luminosidade.
 */
export function installOceanCausticsTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(OCEAN_CAUSTICS_TEXTURE)) return OCEAN_CAUSTICS_TEXTURE;
  const S = 512;
  const tex = scene.textures.createCanvas(OCEAN_CAUSTICS_TEXTURE, S, S);
  if (!tex) throw Error('Não foi possível criar textura de cáusticas oceânicas');
  const ctx = tex.context;
  const img = ctx.createImageData(S, S);
  const data = img.data;

  for (let y = 0; y < S; y++) {
    const wy = (y / S) * TAU;
    for (let x = 0; x < S; x++) {
      const wx = (x / S) * TAU;
      // Interferência de ondas para formar filamentos de cáustica submarina
      const c1 = Math.sin(wx * 4 + Math.cos(wy * 3) * 1.4);
      const c2 = Math.cos(wy * 4 - Math.sin(wx * 3) * 1.4);
      const c3 = Math.sin((wx + wy) * 5 + Math.cos((wx - wy) * 4));
      const ridge = 1 - Math.abs(c1 + c2 * 0.85 + c3 * 0.55) / 1.4;
      const caustic = Math.pow(Math.max(0, ridge), 3.2);

      // Zonas suaves de luminosidade intermediária
      const swell = 0.5 + 0.5 * Math.sin(wx * 2 - wy * 2 + 1.1);
      const alpha = Math.min(255, Math.round(caustic * 95 + swell * 22));

      const i = (y * S + x) * 4;
      data[i] = 64;
      data[i + 1] = 218;
      data[i + 2] = 248;
      data[i + 3] = alpha;
    }
  }

  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return OCEAN_CAUSTICS_TEXTURE;
}

/**
 * Vórtice Abissal da Fenda Pelágica (512x512) para a aproximação e confronto com o chefe (Cena 3).
 * Aplica máscara radial estrita (r <= 185) para eliminar qualquer borda reta ao girar.
 */
export function installVortexTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(VORTEX_TEXTURE)) return VORTEX_TEXTURE;
  const tex = scene.textures.createCanvas(VORTEX_TEXTURE, 512, 512);
  if (!tex) throw Error('Não foi possível criar textura do vórtice pelágico');
  const ctx = tex.context;

  if (scene.textures.exists('pelagic-archipelago')) {
    const archAtlas = scene.textures.get('pelagic-archipelago').getSourceImage() as HTMLImageElement;
    if (archAtlas && archAtlas.naturalWidth >= 2048) {
      const rawCell = extractCleanCell(archAtlas, 7, { radialFeather: false });
      // Centraliza o núcleo do redemoinho e aplica feathering circular perfeito até r = 186
      const tmp = document.createElement('canvas');
      tmp.width = 512;
      tmp.height = 512;
      const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
      tctx.drawImage(rawCell, 16, 12, 480, 480);
      const img = tctx.getImageData(0, 0, 512, 512);
      const d = img.data;
      for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
          const i = (y * 512 + x) * 4;
          if (d[i + 3] === 0) continue;
          const r = Math.hypot(x - 256, y - 256);
          if (r >= 184) {
            d[i + 3] = 0;
          } else if (r > 115) {
            const fade = (184 - r) / (184 - 115);
            d[i + 3] = Math.round(d[i + 3] * fade * fade);
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    }
  }
  tex.refresh();
  return VORTEX_TEXTURE;
}

export function installCoastTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(COAST_TEXTURE)) return COAST_TEXTURE;
  const coastAtlas = scene.textures.get('pelagic-coast').getSourceImage() as HTMLImageElement;
  if (!coastAtlas || coastAtlas.naturalWidth < 2048) {
    throw Error('Spritesheet pelagic-coast não carregado');
  }
  const archAtlas = scene.textures.exists('pelagic-archipelago')
    ? (scene.textures.get('pelagic-archipelago').getSourceImage() as HTMLImageElement)
    : coastAtlas;

  const texture = scene.textures.createCanvas(COAST_TEXTURE, COAST_WIDTH, COAST_PERIOD);
  if (!texture) throw Error('Não foi possível montar o arquipélago costeiro da Fenda Pelágica');

  const landCanvas = document.createElement('canvas');
  landCanvas.width = COAST_WIDTH;
  landCanvas.height = COAST_PERIOD;
  const landCtx = landCanvas.getContext('2d', { willReadFrequently: true })!;

  const reefCanvas = document.createElement('canvas');
  reefCanvas.width = COAST_WIDTH;
  reefCanvas.height = COAST_PERIOD;
  const reefCtx = reefCanvas.getContext('2d', { willReadFrequently: true })!;

  composeArchipelagoLand(landCtx, reefCtx, archAtlas, coastAtlas);
  renderNaturalCoastalTransition(texture.context, landCanvas, reefCanvas);

  void hash;
  texture.refresh();
  return COAST_TEXTURE;
}
