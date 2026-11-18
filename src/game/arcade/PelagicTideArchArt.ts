import Phaser from 'phaser';
import type { ArcadeWorld } from './ArcadeWorld';
import { computeArchOpening, TIDE_ARCH_CANNONS } from './PelagicTideArch';
import { clamp } from './geometry';

export const TIDE_ARCH_BRIDGE_TEX = 'pelagic-tide-arch-bridge';
export const TIDE_ARCH_CLIFFS_TEX = 'pelagic-tide-arch-cliffs';
export const TIDE_ARCH_WATERFALL_TEX = 'pelagic-tide-arch-waterfalls';
export const TIDE_ARCH_WALLS_TEX = 'pelagic-canyon-wall-cliffs';

export function preloadTideArchArt(scene: Phaser.Scene, base: string): void {
  const dir = `${base}assets/arcade/pelagic-review/`;
  scene.load.image(TIDE_ARCH_BRIDGE_TEX, `${dir}tide-arch-bridge.png`);
  scene.load.spritesheet(TIDE_ARCH_CLIFFS_TEX, `${dir}tide-arch-cliffs.png`, {
    frameWidth: 512,
    frameHeight: 512,
  });
  scene.load.spritesheet(TIDE_ARCH_WATERFALL_TEX, `${dir}tide-arch-waterfalls.png`, {
    frameWidth: 128,
    frameHeight: 256,
  });
}

/**
 * Extracts strictly the circular-pad-free outer rock cliffs & palm strata (x: 0..244)
 * from `tide-arch-cliffs.png`, feathering the inner slice cleanly so backing headlands
 * never introduce empty duplicate cannon platforms.
 */
function ensureCanyonWallTexture(scene: Phaser.Scene): boolean {
  if (scene.textures.exists(TIDE_ARCH_WALLS_TEX)) return true;
  if (!scene.textures.exists(TIDE_ARCH_CLIFFS_TEX)) return false;

  const srcTex = scene.textures.get(TIDE_ARCH_CLIFFS_TEX);
  const srcImg = srcTex.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!srcImg || !srcImg.width || !srcImg.height) return false;

  const cropW = 244;
  const frameH = 512;
  const canvasTex = scene.textures.createCanvas(TIDE_ARCH_WALLS_TEX, cropW * 2, frameH);
  if (!canvasTex) return false;

  const ctx = canvasTex.context;
  ctx.clearRect(0, 0, cropW * 2, frameH);
  ctx.drawImage(srcImg, 0, 0, cropW, frameH, 0, 0, cropW, frameH);
  ctx.drawImage(srcImg, 512, 0, cropW, frameH, cropW, 0, cropW, frameH);

  // Softly taper the inner right edge of each 244px rock slice (x = 208..243) so cliff walls blend organically
  const imgData = ctx.getImageData(0, 0, cropW * 2, frameH);
  const d = imgData.data;
  for (let f = 0; f < 2; f++) {
    const xBase = f * cropW;
    for (let y = 0; y < frameH; y++) {
      for (let x = 206; x < cropW; x++) {
        const u = (x - 206) / (cropW - 206);
        const fade = Math.max(0, 1 - u * u * (3 - 2 * u));
        const idx = (y * (cropW * 2) + xBase + x) * 4 + 3;
        d[idx] = Math.round(d[idx] * fade);
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  canvasTex.refresh();
  canvasTex.add(0, 0, 0, 0, cropW, frameH);
  canvasTex.add(1, 0, cropW, 0, cropW, frameH);
  return true;
}

interface PierSlot {
  widthScale: number;
  height: number;
  frame: 0 | 1;
  isMainButtress: boolean;
  tint: number;
}

/** Normalized offsets from sprite center to the painted circular stone gun terrace in each cliff frame. */
const PAD_FRAME_META: Record<0 | 1, { x: number; y: number }> = {
  0: { x: 0.236, y: -0.076 },
  1: { x: 0.250, y: -0.047 },
};

/**
 * Ten canyon piers locked one-to-one with `TIDE_ARCH_CANNONS`:
 * alternating silhouettes, progressive gorge scale, and cool-to-warm elevation lighting.
 */
const PIER_LAYOUT: readonly PierSlot[] = [
  { widthScale: 1.56, height: 152, frame: 0, isMainButtress: false, tint: 0xf7eee2 },
  { widthScale: 1.54, height: 150, frame: 1, isMainButtress: false, tint: 0xf5ecdf },
  { widthScale: 1.62, height: 160, frame: 1, isMainButtress: false, tint: 0xebe5dc },
  { widthScale: 1.60, height: 158, frame: 0, isMainButtress: false, tint: 0xe8e2d9 },
  { widthScale: 1.66, height: 168, frame: 0, isMainButtress: false, tint: 0xdce0e8 },
  { widthScale: 1.64, height: 166, frame: 1, isMainButtress: false, tint: 0xd9dee8 },
  { widthScale: 1.74, height: 188, frame: 1, isMainButtress: true, tint: 0xcfd7e6 },
  { widthScale: 1.74, height: 188, frame: 0, isMainButtress: true, tint: 0xcdd5e4 },
  { widthScale: 1.56, height: 158, frame: 0, isMainButtress: false, tint: 0xf2ebe2 },
  { widthScale: 1.54, height: 156, frame: 1, isMainButtress: false, tint: 0xf0e9df },
];

interface BackingSlot {
  side: -1 | 1;
  relWorldY: number;
  widthScale: number;
  height: number;
  frame: 0 | 1;
  tint: number;
  anchorShift: number;
}

/**
 * Pad-free coastal headland cliffs anchoring outer flanks and forming continuous waterfall rock walls
 * between the artillery piers without creating duplicate empty turret platforms.
 */
const BACKING_CLIFFS: readonly BackingSlot[] = [
  { side: -1, relWorldY: 472, widthScale: 1.06, height: 176, frame: 1, tint: 0xe2dad0, anchorShift: 0.34 },
  { side: 1, relWorldY: 428, widthScale: 1.06, height: 176, frame: 0, tint: 0xe0d8cd, anchorShift: 0.34 },
  { side: -1, relWorldY: 392, widthScale: 1.18, height: 188, frame: 0, tint: 0xd2d6dc, anchorShift: 0.48 },
  { side: 1, relWorldY: 356, widthScale: 1.18, height: 186, frame: 1, tint: 0xcfd3da, anchorShift: 0.48 },
  { side: -1, relWorldY: 226, widthScale: 1.12, height: 184, frame: 1, tint: 0xc2cbd8, anchorShift: 0.42 },
  { side: 1, relWorldY: 192, widthScale: 1.12, height: 184, frame: 0, tint: 0xc0c9d6, anchorShift: 0.42 },
  { side: -1, relWorldY: 16, widthScale: 1.16, height: 196, frame: 0, tint: 0xb6c1d2, anchorShift: 0.42 },
  { side: 1, relWorldY: 6, widthScale: 1.16, height: 196, frame: 1, tint: 0xb4bfd0, anchorShift: 0.42 },
];

interface WaterfallSlot {
  side: -1 | 1;
  offsetFromOpening: number;
  relTopY: number;
  relBotY: number;
  width: number;
  isHighGorge: boolean;
}

/**
 * Four canyon waterfalls strictly embedded into rock walls and plunging into open sea water:
 * - Lower pair (`isHighGorge: false`): plunges off the dedicated rocky headland walls at `392` / `356` into sea coves.
 * - Upper pair (`isHighGorge: true`): pours off mossy spillover notches along the elevated stone Arch shoulders into the gorge.
 */
const WATERFALL_SLOTS: readonly WaterfallSlot[] = [
  { side: -1, offsetFromOpening: 8, relTopY: -12, relBotY: 33, width: 24, isHighGorge: true },
  { side: 1, offsetFromOpening: 8, relTopY: -14, relBotY: 31, width: 24, isHighGorge: true },
  { side: -1, offsetFromOpening: -22, relTopY: 378, relBotY: 446, width: 30, isHighGorge: false },
  { side: 1, offsetFromOpening: -22, relTopY: 342, relBotY: 406, width: 30, isHighGorge: false },
];

/**
 * Renders the 2.5D Pelagic Tide Arch gorge with strict vertical depth separation:
 * submerged shoal contours -> sea surf & waterfall basins -> pad-free backing cliffs ->
 * aligned gun piers -> lower waterfall chutes -> integrated turret collars ->
 * cast bridge shadow -> monumental stone arch -> high gorge cascades -> wingtip beacon.
 */
export class PelagicTideArchRenderer {
  private readonly canyonReefGfx: Phaser.GameObjects.Graphics;
  private readonly waterSurfGfx: Phaser.GameObjects.Graphics;
  private readonly backingCliffs: Phaser.GameObjects.Image[] = [];
  private readonly piers: Phaser.GameObjects.Image[] = [];
  private readonly upperStreamGfx: Phaser.GameObjects.Graphics;
  private readonly waterfalls: Phaser.GameObjects.Sprite[] = [];
  private readonly waterfallMistGfx: Phaser.GameObjects.Graphics;
  private readonly padMountGfx: Phaser.GameObjects.Graphics;
  private readonly archShadowGfx: Phaser.GameObjects.Graphics;
  private readonly archBridge: Phaser.GameObjects.Image;
  private readonly bridgeWaterfallGfx: Phaser.GameObjects.Graphics;
  private readonly canyonRimGfx: Phaser.GameObjects.Graphics;
  private readonly rivetBeaconGfx: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.canyonReefGfx = scene.add.graphics().setDepth(0.88).setVisible(false);
    this.waterSurfGfx = scene.add.graphics().setDepth(1.12).setVisible(false);
    for (let i = 0; i < BACKING_CLIFFS.length; i++) {
      this.backingCliffs.push(
        scene.add
          .image(0, 0, TIDE_ARCH_CLIFFS_TEX, 0)
          .setDepth(1.36)
          .setVisible(false),
      );
    }
    for (let i = 0; i < PIER_LAYOUT.length; i++) {
      const slot = PIER_LAYOUT[i];
      this.piers.push(
        scene.add
          .image(0, 0, TIDE_ARCH_CLIFFS_TEX, slot.frame)
          .setDepth(1.44 + (i % 2) * 0.02)
          .setVisible(false),
      );
    }
    this.upperStreamGfx = scene.add.graphics().setDepth(1.50).setVisible(false);
    for (let i = 0; i < WATERFALL_SLOTS.length; i++) {
      const slot = WATERFALL_SLOTS[i];
      this.waterfalls.push(
        scene.add
          .sprite(0, 0, TIDE_ARCH_WATERFALL_TEX, i % 4)
          .setDepth(slot.isHighGorge ? 18.92 : 1.52)
          .setVisible(false),
      );
    }
    this.waterfallMistGfx = scene.add.graphics().setDepth(1.54).setVisible(false);
    this.padMountGfx = scene.add.graphics().setDepth(1.92).setVisible(false);
    this.archShadowGfx = scene.add.graphics().setDepth(15.6).setVisible(false);
    this.archBridge = scene.add
      .image(0, 0, TIDE_ARCH_BRIDGE_TEX)
      .setDepth(18.90)
      .setVisible(false);
    this.bridgeWaterfallGfx = scene.add.graphics().setDepth(18.91).setVisible(false);
    this.canyonRimGfx = scene.add.graphics().setDepth(18.95).setVisible(false);
    this.rivetBeaconGfx = scene.add.graphics().setDepth(19.15).setVisible(false);
  }

  hide(): void {
    for (const g of [
      this.canyonReefGfx,
      this.waterSurfGfx,
      this.upperStreamGfx,
      this.waterfallMistGfx,
      this.padMountGfx,
      this.archShadowGfx,
      this.bridgeWaterfallGfx,
      this.canyonRimGfx,
      this.rivetBeaconGfx,
    ]) {
      g.clear().setVisible(false);
    }
    this.archBridge.setVisible(false);
    for (const s of this.backingCliffs) s.setVisible(false);
    for (const p of this.piers) p.setVisible(false);
    for (const wf of this.waterfalls) wf.setVisible(false);
  }

  destroy(): void {
    this.hide();
    for (const g of [
      this.canyonReefGfx,
      this.waterSurfGfx,
      this.upperStreamGfx,
      this.waterfallMistGfx,
      this.padMountGfx,
      this.archShadowGfx,
      this.bridgeWaterfallGfx,
      this.canyonRimGfx,
      this.rivetBeaconGfx,
    ]) {
      g.destroy();
    }
    this.archBridge.destroy();
    for (const s of this.backingCliffs) s.destroy();
    for (const p of this.piers) p.destroy();
    for (const wf of this.waterfalls) wf.destroy();
  }

  draw(world: ArcadeWorld, quality: number): void {
    if (!world.up || (!world.tideArch.isActive && world.tideArch.phase !== 'checkpoint')) {
      this.hide();
      return;
    }

    const ready =
      this.scene.textures.exists(TIDE_ARCH_BRIDGE_TEX) &&
      this.scene.textures.exists(TIDE_ARCH_CLIFFS_TEX) &&
      this.scene.textures.exists(TIDE_ARCH_WATERFALL_TEX) &&
      ensureCanyonWallTexture(this.scene);
    if (!ready) {
      this.hide();
      return;
    }

    const archY = world.tideArch.archScreenY(world.scroll);
    const opening = computeArchOpening(world.arena.left, world.arena.right);
    const viewH = world.arena.bottom + 80;
    const t = world.elapsed;
    const lowFactor = 1 - clamp(world.tideArch.altitude, 0, 1);

    const reef = this.canyonReefGfx.clear().setVisible(true);
    const surf = this.waterSurfGfx.clear().setVisible(true);
    const upper = this.upperStreamGfx.clear().setVisible(true);
    const mist = this.waterfallMistGfx.clear().setVisible(true);
    const padGfx = this.padMountGfx.clear().setVisible(true);
    const bridgeWf = this.bridgeWaterfallGfx.clear().setVisible(true);

    // 1. Pad-free backing canyon cliffs anchored directly to outer arena walls (`depth 1.36`)
    for (let i = 0; i < BACKING_CLIFFS.length; i++) {
      const slot = BACKING_CLIFFS[i];
      const sprite = this.backingCliffs[i];
      const sy = archY + slot.relWorldY;
      if (sy < -180 || sy > viewH + 170) {
        sprite.setVisible(false);
        continue;
      }
      const outerX = slot.side < 0 ? world.arena.left : world.arena.right;
      const innerX = slot.side < 0 ? opening.left : opening.right;
      const pierSpan = Math.abs(innerX - outerX);
      const dispW = pierSpan * slot.widthScale;
      const flipX = slot.side > 0;
      const centerX = outerX - slot.side * (dispW * slot.anchorShift);

      sprite
        .setTexture(TIDE_ARCH_WALLS_TEX, slot.frame)
        .setFlipX(flipX)
        .setTint(slot.tint)
        .setPosition(centerX, sy)
        .setDisplaySize(dispW, slot.height)
        .setVisible(true);

      // Organic shoal & surf contours tucked strictly below land strata (`depth 0.88` & `1.12`)
      const shoreX = centerX - slot.side * dispW * 0.14;
      const shoreY = sy + slot.height * 0.24;
      const foamBeat = Math.sin(t * 2.8 + i * 0.9) * 3;
      reef.fillStyle(0x032046, 0.28).fillEllipse(shoreX, shoreY + 4, dispW * 0.85, 34);
      reef.fillStyle(0x0d5c84, 0.18).fillEllipse(shoreX - slot.side * 6, shoreY + 6, dispW * 0.92, 42);
      surf.fillStyle(0x27cff0, 0.22).fillEllipse(shoreX - slot.side * 4, shoreY + 2, 56 + foamBeat, 18);
      surf.fillStyle(0xdcfbff, 0.24).fillEllipse(shoreX - slot.side * 4, shoreY, 34 + foamBeat * 0.6, 9);
    }

    // 2. Fortified cliff piers aligned pixel-for-pixel under every TIDE_ARCH_CANNONS mount (`depth 1.44..1.46`)
    for (let i = 0; i < PIER_LAYOUT.length; i++) {
      const slot = PIER_LAYOUT[i];
      const sprite = this.piers[i];
      const cannonSpec = TIDE_ARCH_CANNONS[i];
      const cannonY = archY + (cannonSpec?.relWorldY ?? 0);
      if (cannonY < -170 || cannonY > viewH + 150) {
        sprite.setVisible(false);
        continue;
      }

      const outerX = cannonSpec.side < 0 ? world.arena.left : world.arena.right;
      const innerX = cannonSpec.side < 0 ? opening.left : opening.right;
      const pierSpan = Math.abs(innerX - outerX);
      const dispW = pierSpan * slot.widthScale;
      const flipX = cannonSpec.side > 0;
      const padMeta = PAD_FRAME_META[slot.frame];
      const effPadX = flipX ? -padMeta.x : padMeta.x;
      const cannonX = outerX + (innerX - outerX) * cannonSpec.pierDepth;
      const centerX = cannonX - dispW * effPadX;
      const centerY = cannonY - slot.height * padMeta.y;

      sprite
        .setTexture(TIDE_ARCH_CLIFFS_TEX, slot.frame)
        .setFlipX(flipX)
        .setTint(slot.tint)
        .setPosition(centerX, centerY)
        .setDisplaySize(dispW, slot.height)
        .setVisible(true);

      const waveBeat = Math.sin(t * 3.1 + i * 1.15) * 3;
      const cliffToeX = cannonX + cannonSpec.side * 4;
      const cliffToeY = centerY + slot.height * 0.28;
      reef.fillStyle(0x031838, 0.28).fillEllipse(cliffToeX - cannonSpec.side * 6, cliffToeY + 4, dispW * 0.56, 26);
      surf.fillStyle(0x28d4f4, 0.28).fillEllipse(cliffToeX, cliffToeY + 4, 62 + waveBeat, 20);
      surf.fillStyle(0xe4ffff, 0.34).fillEllipse(cliffToeX, cliffToeY + 2, 38 + waveBeat * 0.6, 10);

      // Integrated recessed dark stone & steel gun ring directly on top of the painted circular terrace
      padGfx.fillStyle(0x1b2430, 0.42).fillEllipse(cannonX + 1.5, cannonY + 2.5, 36, 30);
      padGfx.lineStyle(2.2, 0x2c3b4c, 0.78).strokeEllipse(cannonX, cannonY, 34, 28);
      padGfx.fillStyle(0x475569, 0.52).fillEllipse(cannonX, cannonY, 27, 22);
      padGfx.lineStyle(1.1, 0x94a3b8, 0.46).strokeEllipse(cannonX, cannonY - 0.5, 25, 20);
    }

    // 3. Elevated stone Arch span (`depth 18.90`, calculated before high-gorge waterfalls so they align cleanly)
    const bridgeW = world.arenaWidth + 84;
    const bridgeH = Math.round(bridgeW * 0.425);
    const elevScale = 1 + lowFactor * 0.045;
    const parallaxY = -lowFactor * 6;
    const spanY = archY - 14 + parallaxY;
    const bridgeOnScreen = archY > -bridgeH * 1.15 && archY < viewH + bridgeH * 1.15;

    // 4. Waterfalls: recessed rock spillway cleft -> vertical wet cliff chute -> turbulent sea impact pool
    const wfFrame = Math.floor(t * 10) % 4;
    for (let i = 0; i < WATERFALL_SLOTS.length; i++) {
      const cfg = WATERFALL_SLOTS[i];
      const sprite = this.waterfalls[i];
      const dyOffset = cfg.isHighGorge ? parallaxY : 0;
      const topY = archY + cfg.relTopY + dyOffset;
      const botY = archY + cfg.relBotY + dyOffset;
      const fallH = botY - topY;
      const vis = (cfg.isHighGorge ? bridgeOnScreen : botY > -70 && topY < viewH + 70) && !(quality === 0 && !cfg.isHighGorge);
      if (!vis) {
        sprite.setVisible(false);
        continue;
      }

      const lipX = cfg.side < 0
        ? opening.left - cfg.offsetFromOpening
        : opening.right + cfg.offsetFromOpening;
      const streamCenterY = (topY + botY) * 0.5;
      const chuteGfx = cfg.isHighGorge ? bridgeWf : upper;

      // Dark eroded rock spillway notch nestled cleanly into the cliff face behind/above the fall
      chuteGfx.fillStyle(0x28211e, 0.62).fillRoundedRect(lipX - cfg.width * 0.48, topY - 4, cfg.width * 0.96, 12, 5);
      chuteGfx.fillStyle(0x162432, 0.46).fillRoundedRect(lipX - cfg.width * 0.36, topY - 1, cfg.width * 0.72, Math.max(12, fallH - 12), 4);
      chuteGfx.fillStyle(0x1cb4dc, 0.85).fillEllipse(lipX, topY - 1, cfg.width * 0.68, 7);
      chuteGfx.fillStyle(0xd8fcff, 0.88).fillEllipse(lipX, topY + 2, cfg.width * 0.52, 4.5);

      sprite
        .setTexture(TIDE_ARCH_WATERFALL_TEX, (wfFrame + i) % 4)
        .setPosition(lipX, streamCenterY)
        .setDisplaySize(cfg.width, fallH)
        .setFlipX(cfg.side > 0)
        .setAlpha(cfg.isHighGorge ? 0.96 : 0.92)
        .setVisible(true);

      // Sea-level impact foam + outward ripples + spray mist cleanly anchored in water
      const ripple = (t * 1.45 + i * 0.29) % 1;
      const poolY = botY - 3;
      const splashTarget = cfg.isHighGorge ? bridgeWf : surf;
      const mistTarget = cfg.isHighGorge ? bridgeWf : mist;
      splashTarget.fillStyle(0x1cbce0, 0.34).fillEllipse(lipX, poolY + 4, cfg.width * 1.85, 19);
      splashTarget.fillStyle(0xe6ffff, 0.44).fillEllipse(lipX, poolY + 2, cfg.width * 1.22, 10);
      splashTarget.lineStyle(1.4, 0xdcfbff, (1 - ripple) * 0.58).strokeEllipse(
        lipX,
        poolY + 3,
        cfg.width * (1.08 + ripple * 1.25),
        9 + ripple * 11,
      );
      mistTarget.fillStyle(0xffffff, 0.36 + 0.14 * Math.sin(t * 7 + i)).fillEllipse(lipX, poolY, cfg.width * 1.0, 7);
      if (quality > 0) {
        mistTarget.fillStyle(0xe4fcff, 0.34).fillCircle(lipX - 6 + Math.sin(t * 8 + i) * 3, poolY - 5, 2.0);
        mistTarget.fillStyle(0xe4fcff, 0.30).fillCircle(lipX + 6 + Math.cos(t * 7 + i) * 3, poolY - 4, 1.8);
      }
    }

    // 5. Cast canyon & arch shadow over sea + subtle altitude-linked gorge atmosphere (`depth 15.6`)
    const shadow = this.archShadowGfx.clear();
    if (bridgeOnScreen || lowFactor > 0.04) {
      shadow.setVisible(true);
      const wallShadeAlpha = 0.04 + lowFactor * 0.10;
      shadow.fillStyle(0x02122b, wallShadeAlpha).fillRect(world.arena.left, 0, opening.pierLeftWidth + 6, viewH);
      shadow.fillStyle(0x02122b, wallShadeAlpha).fillRect(opening.right - 6, 0, opening.pierRightWidth + 6, viewH);

      if (bridgeOnScreen) {
        const shadowY = archY + 26 + lowFactor * 10;
        shadow.fillStyle(0x021430, 0.34 + lowFactor * 0.12).fillEllipse(opening.center, shadowY, opening.width * 1.04, bridgeH * 0.42);
        shadow.fillStyle(0x010e24, 0.24 + lowFactor * 0.10).fillRect(opening.left - 14, shadowY - 18, opening.width + 28, 36);
      }
    } else {
      shadow.setVisible(false);
    }

    // 6. Monumental overhead stone Arch bridge (`depth 18.90`) + top stone highlight rim (`depth 18.95`)
    const rim = this.canyonRimGfx.clear();
    if (bridgeOnScreen) {
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
      this.archBridge.setVisible(false);
      rim.setVisible(false);
    }

    // 7. Crisp aerodynamic locator chevron while RIVET passes beneath opaque overhead arch rock
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
      beacon.fillStyle(0x7ff7ff, pulse * 0.34).fillEllipse(px, py + 11, 6, 4);
    } else {
      beacon.setVisible(false);
    }
  }
}
