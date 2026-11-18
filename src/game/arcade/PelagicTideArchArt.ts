import Phaser from 'phaser';
import type { ArcadeWorld } from './ArcadeWorld';
import { TIDE_ARCH_CANNONS, computeArchOpening, resolveArchCannonWorldPos } from './PelagicTideArch';
import { clamp } from './geometry';

export const TIDE_ARCH_BRIDGE_TEX = 'pelagic-tide-arch-bridge';
export const TIDE_ARCH_CLIFFS_TEX = 'pelagic-tide-arch-cliffs';
export const TIDE_ARCH_ROCK_PLATFORMS_TEX = 'pelagic-tide-arch-rock-platforms';
export const TIDE_ARCH_SHADOW_TEX = 'pelagic-tide-arch-bridge-shadow';

/** Preloads the monumental stone arch span and coastal rock outcrop spritesheets (no waterfalls or circular pads). */
export function preloadTideArchArt(scene: Phaser.Scene, base: string): void {
  const dir = `${base}assets/arcade/pelagic-review/`;
  scene.load.image(TIDE_ARCH_BRIDGE_TEX, `${dir}tide-arch-bridge.png`);
  scene.load.spritesheet(TIDE_ARCH_CLIFFS_TEX, `${dir}tide-arch-cliffs.png`, {
    frameWidth: 512,
    frameHeight: 512,
  });
}

interface RockPlatformFrameMeta {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  offX: number;
  offY: number;
  widthScale: number;
  heightBase: number;
  tint: number;
}

const ROCK_FRAME_META: Record<0 | 1, RockPlatformFrameMeta> = {
  0: { cx: 377, cy: 217, rx: 98, ry: 49, offX: 0.2363, offY: -0.0762, widthScale: 1.02, heightBase: 76, tint: 0xffffff },
  1: { cx: 384, cy: 232, rx: 98, ry: 49, offX: 0.2500, offY: -0.0469, widthScale: 1.00, heightBase: 74, tint: 0xfaf3e8 },
};

const PLATFORM_SLOTS: ReadonlyArray<{ frame: 0 | 1; dispW: number; dispH: number; tint: number }> = [
  { frame: 0, dispW: 96, dispH: 72, tint: 0xfaf3e8 },
  { frame: 1, dispW: 94, dispH: 70, tint: 0xf8f0e4 },
  { frame: 1, dispW: 98, dispH: 74, tint: 0xfaf4ea },
  { frame: 0, dispW: 96, dispH: 72, tint: 0xf9f2e7 },
  { frame: 0, dispW: 102, dispH: 76, tint: 0xffffff },
  { frame: 1, dispW: 100, dispH: 75, tint: 0xfcf6ed },
  { frame: 1, dispW: 104, dispH: 78, tint: 0xffffff },
  { frame: 0, dispW: 104, dispH: 78, tint: 0xffffff },
  { frame: 0, dispW: 96, dispH: 72, tint: 0xf7efe4 },
  { frame: 1, dispW: 94, dispH: 70, tint: 0xf5ede1 },
];

const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/**
 * Builds natural rocky cliff outcrops (`1024x512`, 2 frames) from `tide-arch-cliffs.png`
 * by blending out the engraved circular gun-ring markings on each upper sandstone plateau
 * and tapering the outer rear border (`x < 34`) for continuous island integration.
 */
function ensureNaturalRockPlatforms(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(TIDE_ARCH_ROCK_PLATFORMS_TEX)) return true;
  if (!scene.textures.exists(TIDE_ARCH_CLIFFS_TEX)) return false;

  const srcImg = scene.textures.get(TIDE_ARCH_CLIFFS_TEX).getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!srcImg || !srcImg.width || !srcImg.height) return false;

  const tex = scene.textures.createCanvas(TIDE_ARCH_ROCK_PLATFORMS_TEX, 1024, 512);
  if (!tex) return false;
  const ctx = tex.context;
  ctx.clearRect(0, 0, 1024, 512);
  ctx.drawImage(srcImg, 0, 0, 1024, 512);

  const imgData = ctx.getImageData(0, 0, 1024, 512);
  const d = imgData.data;
  const srcCopy = new Uint8ClampedArray(d);

  // Sample average warm sunlit sandstone color cleanly from each flat inner plateau core
  const frameCenters: Array<{ f: 0 | 1; gx: number; gy: number; rx: number; ry: number }> = [
    { f: 0, gx: 377, gy: 217, rx: 98, ry: 49 },
    { f: 1, gx: 512 + 384, gy: 232, rx: 98, ry: 49 },
  ];

  for (const fc of frameCenters) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let samples = 0;
    for (let dy = -12; dy <= 12; dy++) {
      for (let dx = -22; dx <= 22; dx++) {
        const idx = ((fc.gy + dy) * 1024 + (fc.gx + dx)) * 4;
        if (srcCopy[idx + 3] > 220 && srcCopy[idx] > 160 && srcCopy[idx + 1] > 125) {
          sumR += srcCopy[idx];
          sumG += srcCopy[idx + 1];
          sumB += srcCopy[idx + 2];
          samples++;
        }
      }
    }
    const baseR = samples > 0 ? sumR / samples : 226;
    const baseG = samples > 0 ? sumG / samples : 192;
    const baseB = samples > 0 ? sumB / samples : 138;

    // Remove full circular stone curb ring (rx=98, ry=49) while keeping inner natural deck (nd <= 0.70)
    for (let y = fc.gy - fc.ry - 6; y <= fc.gy + fc.ry + 6; y++) {
      if (y < 0 || y >= 512) continue;
      for (let x = fc.gx - fc.rx - 8; x <= fc.gx + fc.rx + 8; x++) {
        if (x < fc.f * 512 || x >= (fc.f + 1) * 512) continue;
        const idx = (y * 1024 + x) * 4;
        if (srcCopy[idx + 3] < 40) continue;

        const nx = (x - fc.gx) / fc.rx;
        const ny = (y - fc.gy) / fc.ry;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1.04) continue;

        // Avoid erasing the rocky vertical drop below the south plateau rim
        if (ny > 0.72) continue;

        const nd = Math.sqrt(r2);
        const r = srcCopy[idx];
        const g = srcCopy[idx + 1];
        const b = srcCopy[idx + 2];
        const lum = (r + g + b) / 3;
        const isDarkSeam = lum < 160 || (r - b) < 30;
        const isOuterCurbRing = nd > 0.64 && nd <= 1.02;

        if (!isOuterCurbRing && !isDarkSeam && nd > 0.70) continue;
        if (nd <= 0.70 && !isDarkSeam && nd < 0.42) continue;

        const ox = Math.round(((x - fc.gx) * 0.24));
        const oy = Math.round(((y - fc.gy) * 0.24));
        const sx = clamp(fc.gx + ox, fc.f * 512, (fc.f + 1) * 512 - 1);
        const sy = clamp(fc.gy + oy, 0, 511);
        const sIdx = (sy * 1024 + sx) * 4;

        const grain = Math.sin(x * 0.27 + y * 0.19) * 5 + Math.cos(x * 0.13 - y * 0.31) * 4;
        const stoneR = clamp((srcCopy[sIdx + 3] > 220 ? srcCopy[sIdx] * 0.55 + baseR * 0.45 : baseR) + grain, 0, 255);
        const stoneG = clamp((srcCopy[sIdx + 3] > 220 ? srcCopy[sIdx + 1] * 0.55 + baseG * 0.45 : baseG) + grain * 0.85, 0, 255);
        const stoneB = clamp((srcCopy[sIdx + 3] > 220 ? srcCopy[sIdx + 2] * 0.55 + baseB * 0.45 : baseB) + grain * 0.65, 0, 255);

        const outerFalloff = 1 - smoothstep(clamp((nd - 0.86) / 0.18, 0, 1));
        const curbWeight = isOuterCurbRing ? 0.92 * outerFalloff : 0;
        const seamWeight = isDarkSeam ? 0.96 : 0;
        const wBlend = clamp(Math.max(curbWeight, seamWeight), 0, 0.98);
        if (wBlend <= 0.01) continue;

        d[idx] = Math.round(r * (1 - wBlend) + stoneR * wBlend);
        d[idx + 1] = Math.round(g * (1 - wBlend) + stoneG * wBlend);
        d[idx + 2] = Math.round(b * (1 - wBlend) + stoneB * wBlend);
      }
    }

    // Feather landward cliff edge & upper/lower vertical bounds for seamless coastal blending
    const baseCol = fc.f * 512;
    const fcLocalX = fc.gx - baseCol;
    for (let y = 0; y < 512; y++) {
      const nyBound = Math.abs((y - 256) / 210);
      const yFade = nyBound > 0.64 ? 1 - smoothstep(clamp((nyBound - 0.64) / 0.28, 0, 1)) : 1;
      for (let lx = 0; lx < 512; lx++) {
        const relOut = (lx - (fcLocalX - 180)) / 180;
        const landwardT = relOut < 0.04 ? clamp((0.04 - relOut) / 0.90, 0, 1) : 0;
        const xFade = 1 - smoothstep(landwardT);
        const fade = xFade * yFade;
        if (fade >= 0.999) continue;
        const idx = (y * 1024 + baseCol + lx) * 4 + 3;
        d[idx] = Math.round(d[idx] * fade);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  tex.refresh();
  tex.add(0, 0, 0, 0, 512, 512);
  tex.add(1, 0, 512, 0, 512, 512);
  return true;
}

/**
 * Generates an irregular soft-feathered bridge shadow texture (`512x220`) directly from the
 * silhouette alpha of `tide-arch-bridge.png` (no opaque ellipses or rectangular blocks).
 */
function ensureArchBridgeShadow(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(TIDE_ARCH_SHADOW_TEX)) return true;
  if (!scene.textures.exists(TIDE_ARCH_BRIDGE_TEX)) return false;

  const srcImg = scene.textures.get(TIDE_ARCH_BRIDGE_TEX).getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!srcImg || !srcImg.width || !srcImg.height) return false;

  const w = 512;
  const h = 220;
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = w;
  sampleCanvas.height = h;
  const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sctx) return false;

  // Compact the tall arch silhouette slightly to lie along the sea plane while preserving irregular contours
  sctx.clearRect(0, 0, w, h);
  sctx.drawImage(srcImg, 0, 0, srcImg.width, srcImg.height, 8, 22, w - 16, h - 64);
  const srcData = sctx.getImageData(0, 0, w, h).data;

  const bufA = new Float32Array(w * h);
  const bufB = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = srcData[(y * w + x) * 4 + 3] / 255;
      if (a <= 0.05) continue;
      // Offset central arch span slightly south according to arch elevation so shadow reads under the deck
      const u = x / (w - 1);
      const liftShiftY = Math.round(10 + Math.sin(u * Math.PI) * 14);
      const liftShiftX = Math.round(3 + Math.sin(u * Math.PI) * 3);
      const tx = clamp(x + liftShiftX, 0, w - 1);
      const ty = clamp(y + liftShiftY, 0, h - 1);
      bufA[ty * w + tx] = Math.max(bufA[ty * w + tx], a);
    }
  }

  // 3-pass separable blur (`radius = 11`) eliminates all sharp geometric borders smoothly
  const blurPass = (srcBuf: Float32Array, dstBuf: Float32Array, r: number, horizontal: boolean) => {
    const win = r * 2 + 1;
    if (horizontal) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let acc = 0;
        for (let k = -r; k <= r; k++) acc += srcBuf[row + clamp(k, 0, w - 1)];
        for (let x = 0; x < w; x++) {
          dstBuf[row + x] = acc / win;
          acc += srcBuf[row + clamp(x + r + 1, 0, w - 1)] - srcBuf[row + clamp(x - r, 0, w - 1)];
        }
      }
    } else {
      for (let x = 0; x < w; x++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) acc += srcBuf[clamp(k, 0, h - 1) * w + x];
        for (let y = 0; y < h; y++) {
          dstBuf[y * w + x] = acc / win;
          acc += srcBuf[clamp(y + r + 1, 0, h - 1) * w + x] - srcBuf[clamp(y - r, 0, h - 1) * w + x];
        }
      }
    }
  };

  for (let p = 0; p < 3; p++) {
    blurPass(bufA, bufB, 11, true);
    blurPass(bufB, bufA, 9, false);
  }

  const outTex = scene.textures.createCanvas(TIDE_ARCH_SHADOW_TEX, w, h);
  if (!outTex) return false;
  const octx = outTex.context;
  const outImg = octx.createImageData(w, h);
  const od = outImg.data;
  for (let y = 0; y < h; y++) {
    const edgeFadeY = y < 18 ? smoothstep(y / 18) : y > h - 18 ? smoothstep((h - 1 - y) / 18) : 1;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edgeFadeX = x < 18 ? smoothstep(x / 18) : x > w - 18 ? smoothstep((w - 1 - x) / 18) : 1;
      const curved = Math.pow(clamp(bufA[i], 0, 1), 1.25);
      const v = clamp(curved * 0.42 * edgeFadeX * edgeFadeY, 0, 0.40);
      if (v <= 0.002) continue;
      const p4 = i * 4;
      od[p4] = 2;
      od[p4 + 1] = 20;
      od[p4 + 2] = 44;
      od[p4 + 3] = Math.round(v * 255);
    }
  }
  octx.putImageData(outImg, 0, 0);
  outTex.refresh();
  return true;
}

/**
 * Renders O Arco das Marés with verified 2.5D layering:
 * 1. Coastal submerged shoals (`0.88`) & rock-lip sea surf (`1.12`)
 * 2. Silhouette-derived cast arch shadow on the ocean surface (`1.18`)
 * 3. Natural integrated coastal rock cannon platforms (`1.44..1.46`, zero grey circular pads)
 * 4. Overhead monumental stone arch span (`18.90`), warm sunlit ridge rim (`18.95`), and wingtip beacon (`19.30`).
 */
export class PelagicTideArchRenderer {
  private readonly canyonReefGfx: Phaser.GameObjects.Graphics;
  private readonly waterSurfGfx: Phaser.GameObjects.Graphics;
  private readonly archShadowImage: Phaser.GameObjects.Image | undefined;
  private readonly rockPlatforms: Phaser.GameObjects.Image[] = [];
  private readonly archBridge: Phaser.GameObjects.Image;
  private readonly canyonRimGfx: Phaser.GameObjects.Graphics;
  private readonly rivetBeaconGfx: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.canyonReefGfx = scene.add.graphics().setDepth(0.88).setVisible(false);
    this.waterSurfGfx = scene.add.graphics().setDepth(1.12).setVisible(false);
    const hasShadowTex = ensureArchBridgeShadow(scene);
    this.archShadowImage = hasShadowTex
      ? scene.add.image(0, 0, TIDE_ARCH_SHADOW_TEX).setDepth(1.18).setVisible(false)
      : undefined;

    ensureNaturalRockPlatforms(scene);
    const platKey = scene.textures.exists(TIDE_ARCH_ROCK_PLATFORMS_TEX)
      ? TIDE_ARCH_ROCK_PLATFORMS_TEX
      : TIDE_ARCH_CLIFFS_TEX;

    for (let i = 0; i < TIDE_ARCH_CANNONS.length; i++) {
      const slot = PLATFORM_SLOTS[i] ?? PLATFORM_SLOTS[0];
      this.rockPlatforms.push(
        scene.add
          .image(0, 0, platKey, slot.frame)
          .setDepth(1.44 + (i % 2) * 0.02)
          .setVisible(false),
      );
    }

    this.archBridge = scene.add
      .image(0, 0, TIDE_ARCH_BRIDGE_TEX)
      .setDepth(18.90)
      .setVisible(false);
    this.canyonRimGfx = scene.add.graphics().setDepth(18.95).setVisible(false);
    this.rivetBeaconGfx = scene.add.graphics().setDepth(19.30).setVisible(false);
  }

  hide(): void {
    for (const g of [
      this.canyonReefGfx,
      this.waterSurfGfx,
      this.canyonRimGfx,
      this.rivetBeaconGfx,
    ]) {
      g.clear().setVisible(false);
    }
    this.archShadowImage?.setVisible(false);
    for (const p of this.rockPlatforms) p.setVisible(false);
    this.archBridge.setVisible(false);
  }

  destroy(): void {
    this.hide();
    for (const g of [
      this.canyonReefGfx,
      this.waterSurfGfx,
      this.canyonRimGfx,
      this.rivetBeaconGfx,
    ]) {
      g.destroy();
    }
    this.archShadowImage?.destroy();
    for (const p of this.rockPlatforms) p.destroy();
    this.archBridge.destroy();
  }

  draw(world: ArcadeWorld, quality: number): void {
    if (!world.up || (!world.tideArch.isActive && world.tideArch.phase !== 'checkpoint')) {
      this.hide();
      return;
    }

    if (!this.scene.textures.exists(TIDE_ARCH_BRIDGE_TEX)) {
      this.hide();
      return;
    }

    const archY = world.tideArch.archScreenY(world.scroll);
    const opening = computeArchOpening(world.arena.left, world.arena.right);
    const viewH = world.arena.bottom + 80;
    const t = world.elapsed;
    const lowFactor = 1 - clamp(world.tideArch.altitude, 0, 1);

    const bridgeW = world.arenaWidth + 84;
    const bridgeH = Math.round(bridgeW * 0.425);
    const elevScale = 1 + lowFactor * 0.05;
    const parallaxY = -lowFactor * 6;
    const spanY = archY - 14 + parallaxY;
    const bridgeOnScreen = archY > -bridgeH * 1.15 && archY < viewH + bridgeH * 1.15;

    const reef = this.canyonReefGfx.clear().setVisible(true);
    const surf = this.waterSurfGfx.clear().setVisible(true);
    const rim = this.canyonRimGfx.clear();

    // 1. Natural rock gun platforms synced pixel-for-pixel via shared `resolveArchCannonWorldPos`
    const hasRockTex = ensureNaturalRockPlatforms(this.scene) && this.scene.textures.exists(TIDE_ARCH_ROCK_PLATFORMS_TEX);
    const widthFactor = clamp(world.arenaWidth / 448, 0.82, 1.0);
    for (let i = 0; i < TIDE_ARCH_CANNONS.length; i++) {
      const spec = TIDE_ARCH_CANNONS[i];
      const slot = PLATFORM_SLOTS[i] ?? PLATFORM_SLOTS[0];
      const sprite = this.rockPlatforms[i];
      if (!hasRockTex || !sprite) {
        sprite?.setVisible(false);
        continue;
      }

      const pos = resolveArchCannonWorldPos(spec, world.tideArch.archWorldY, world.arena.left, world.arena.right);
      const cannonScreenY = pos.worldY + world.scroll;
      const dispW = slot.dispW * widthFactor;
      const dispH = slot.dispH * widthFactor;
      if (cannonScreenY < -dispH || cannonScreenY > viewH + dispH) {
        sprite.setVisible(false);
        continue;
      }

      const meta = ROCK_FRAME_META[slot.frame];
      const flipX = spec.side > 0;
      const effOffX = flipX ? -meta.offX : meta.offX;
      const platX = pos.x - dispW * effOffX;
      const platY = cannonScreenY - dispH * meta.offY;

      sprite
        .setTexture(TIDE_ARCH_ROCK_PLATFORMS_TEX, slot.frame)
        .setFlipX(flipX)
        .setTint(slot.tint)
        .setPosition(platX, platY)
        .setDisplaySize(dispW, dispH)
        .setVisible(true);

      // Subtle organic reef shoaling strictly hugging submerged rock toe below cannon plateau
      const cliffToeX = pos.x - spec.side * 6;
      const cliffToeY = platY + dispH * 0.26;
      const waveBeat = Math.sin(t * 2.8 + i * 1.1) * 2.0;
      reef.fillStyle(0x032046, 0.14).fillRoundedRect(cliffToeX - dispW * 0.21, cliffToeY - 5, dispW * 0.42, 10, 5);
      if (quality > 0) {
        surf.fillStyle(0x9bf5ff, 0.12).fillRoundedRect(cliffToeX - (11 + waveBeat * 0.25), cliffToeY - 2, 22 + waveBeat * 0.5, 4, 2);
      }
    }

    // 2. Sea surf at bridge pillar bases + natural silhouette cast shadow + overhead bridge span
    if (bridgeOnScreen) {
      const pulseL = Math.sin(t * 2.4) * 3.0;
      const pulseR = Math.sin(t * 2.4 + 1.4) * 3.0;
      const leftBaseX = opening.left - opening.pierLeftWidth * 0.24;
      const leftBaseY = spanY + bridgeH * 0.22;
      const rightBaseX = opening.right + opening.pierRightWidth * 0.22;
      const rightBaseY = spanY + bridgeH * 0.25;

      surf.fillStyle(0x1cbce0, 0.20).fillRoundedRect(leftBaseX - opening.pierLeftWidth * 0.42, leftBaseY - 7, opening.pierLeftWidth * 0.90 + pulseL, 18, 9);
      surf.fillStyle(0x1cbce0, 0.20).fillRoundedRect(rightBaseX - opening.pierRightWidth * 0.48, rightBaseY - 7, opening.pierRightWidth * 0.90 + pulseR, 18, 9);
      if (quality > 0) {
        surf.fillStyle(0xdcfbff, 0.22).fillRoundedRect(leftBaseX - opening.pierLeftWidth * 0.26, leftBaseY - 4, opening.pierLeftWidth * 0.58 + pulseL * 0.5, 9, 4.5);
        surf.fillStyle(0xdcfbff, 0.22).fillRoundedRect(rightBaseX - opening.pierRightWidth * 0.30, rightBaseY - 4, opening.pierRightWidth * 0.58 + pulseR * 0.5, 9, 4.5);
      }

      if (this.archShadowImage && ensureArchBridgeShadow(this.scene)) {
        const shadowY = archY + 18 + lowFactor * 8;
        this.archShadowImage
          .setTexture(TIDE_ARCH_SHADOW_TEX)
          .setPosition(opening.center + 3, shadowY)
          .setDisplaySize(bridgeW * 0.98, bridgeH * 1.02)
          .setAlpha(0.76 + lowFactor * 0.22)
          .setVisible(true);
      }

      this.archBridge
        .setPosition(opening.center, spanY)
        .setDisplaySize(bridgeW * elevScale, bridgeH * elevScale)
        .setAlpha(1)
        .setVisible(true);

      rim.setVisible(true);
      rim.lineStyle(1.8, 0xffe8a3, 0.20 + (1 - lowFactor) * 0.14).beginPath();
      rim.moveTo(opening.left - 18, spanY - bridgeH * 0.15);
      rim.lineTo(opening.center, spanY - bridgeH * 0.25);
      rim.lineTo(opening.right + 18, spanY - bridgeH * 0.15);
      rim.strokePath();
    } else {
      this.archShadowImage?.setVisible(false);
      this.archBridge.setVisible(false);
      rim.setVisible(false);
    }

    // 3. Crisp aerodynamic locator chevron while RIVET passes beneath opaque overhead arch rock (`depth 19.30`)
    const beacon = this.rivetBeaconGfx.clear();
    if (
      bridgeOnScreen &&
      world.tideArch.isInBridgeBand(world.scroll, world.player.y) &&
      world.state !== 'defeat'
    ) {
      beacon.setVisible(true);
      const px = world.player.x;
      const py = world.player.y;
      const pulse = 0.48 + 0.24 * Math.sin(t * 14);
      beacon.lineStyle(1.4, 0x8ef9ff, clamp(pulse, 0.26, 0.68));
      beacon.beginPath().moveTo(px - 11, py - 2).lineTo(px, py - 14).lineTo(px + 11, py - 2).strokePath();
      beacon.fillStyle(0x7ff7ff, pulse * 0.34).fillCircle(px, py + 11, 3.2);
    } else {
      beacon.setVisible(false);
    }
  }
}
