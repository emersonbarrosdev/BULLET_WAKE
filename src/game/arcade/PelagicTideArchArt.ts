import Phaser from 'phaser';
import type { ArcadeWorld } from './ArcadeWorld';
import { computeArchOpening, TIDE_ARCH_CANNONS } from './PelagicTideArch';
import { clamp } from './geometry';

export const TIDE_ARCH_BRIDGE_TEX = 'pelagic-tide-arch-bridge';
export const TIDE_ARCH_CLIFFS_TEX = 'pelagic-tide-arch-cliffs';
export const TIDE_ARCH_WATERFALL_TEX = 'pelagic-tide-arch-waterfalls';

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

interface PierSlot {
  side: -1 | 1;
  relWorldY: number;
  widthScale: number;
  height: number;
  isMainButtress: boolean;
}

const PIER_LAYOUT: readonly PierSlot[] = [
  { side: -1, relWorldY: 515, widthScale: 1.24, height: 148, isMainButtress: false },
  { side: 1, relWorldY: 475, widthScale: 1.24, height: 148, isMainButtress: false },
  { side: -1, relWorldY: 335, widthScale: 1.28, height: 156, isMainButtress: false },
  { side: 1, relWorldY: 295, widthScale: 1.28, height: 156, isMainButtress: false },
  { side: -1, relWorldY: 175, widthScale: 1.32, height: 162, isMainButtress: false },
  { side: 1, relWorldY: 145, widthScale: 1.32, height: 162, isMainButtress: false },
  { side: -1, relWorldY: 82, widthScale: 1.44, height: 186, isMainButtress: true },
  { side: 1, relWorldY: 70, widthScale: 1.44, height: 186, isMainButtress: true },
  { side: -1, relWorldY: -92, widthScale: 1.3, height: 158, isMainButtress: false },
  { side: 1, relWorldY: -116, widthScale: 1.3, height: 158, isMainButtress: false },
];

/**
 * Renders the 2.5D natural stone Tide Arch, anchored coastal gun cliffs, animated waterfalls,
 * ocean arch shadow, and wingtip locator beacon when RIVET passes underneath the stone span.
 */
export class PelagicTideArchRenderer {
  private readonly piers: Phaser.GameObjects.Image[] = [];
  private readonly waterfalls: Phaser.GameObjects.Sprite[] = [];
  private readonly archShadowGfx: Phaser.GameObjects.Graphics;
  private readonly waterSurfGfx: Phaser.GameObjects.Graphics;
  private readonly archBridge: Phaser.GameObjects.Image;
  private readonly rivetBeaconGfx: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.waterSurfGfx = scene.add.graphics().setDepth(1.25).setVisible(false);
    for (let i = 0; i < PIER_LAYOUT.length; i++) {
      const slot = PIER_LAYOUT[i];
      this.piers.push(
        scene.add
          .image(0, 0, TIDE_ARCH_CLIFFS_TEX, slot.side < 0 ? 0 : 1)
          .setDepth(1.42)
          .setVisible(false),
      );
    }
    for (let i = 0; i < 4; i++) {
      this.waterfalls.push(
        scene.add
          .sprite(0, 0, TIDE_ARCH_WATERFALL_TEX, i % 4)
          .setDepth(1.55)
          .setVisible(false),
      );
    }
    this.archShadowGfx = scene.add.graphics().setDepth(15.6).setVisible(false);
    this.archBridge = scene.add
      .image(0, 0, TIDE_ARCH_BRIDGE_TEX)
      .setDepth(18.9)
      .setVisible(false);
    this.rivetBeaconGfx = scene.add.graphics().setDepth(19.15).setVisible(false);
  }

  hide(): void {
    this.waterSurfGfx.clear().setVisible(false);
    this.archShadowGfx.clear().setVisible(false);
    this.rivetBeaconGfx.clear().setVisible(false);
    this.archBridge.setVisible(false);
    for (const p of this.piers) p.setVisible(false);
    for (const wf of this.waterfalls) wf.setVisible(false);
  }

  destroy(): void {
    this.waterSurfGfx.destroy();
    this.archShadowGfx.destroy();
    this.rivetBeaconGfx.destroy();
    this.archBridge.destroy();
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
      this.scene.textures.exists(TIDE_ARCH_WATERFALL_TEX);
    if (!ready) {
      this.hide();
      return;
    }

    const archY = world.tideArch.archScreenY(world.scroll);
    const opening = computeArchOpening(world.arena.left, world.arena.right);
    const viewH = world.arena.bottom + 80;
    const t = world.elapsed;

    // 1. Anchored rock piers along both canyon banks + waterline foam (never floating over water!)
    const surf = this.waterSurfGfx;
    surf.clear().setVisible(true);

    for (let i = 0; i < PIER_LAYOUT.length; i++) {
      const slot = PIER_LAYOUT[i];
      const sprite = this.piers[i];
      const cannonSpec = TIDE_ARCH_CANNONS[i];
      const sy = archY + slot.relWorldY;
      if (sy < -160 || sy > viewH + 130) {
        sprite.setVisible(false);
        continue;
      }

      const outerX = slot.side < 0 ? world.arena.left : world.arena.right;
      const innerX = slot.side < 0 ? opening.left : opening.right;
      const pierSpan = Math.abs(innerX - outerX);
      const dispW = pierSpan * slot.widthScale;
      const cannonX = cannonSpec ? outerX + (innerX - outerX) * cannonSpec.pierDepth : outerX - slot.side * pierSpan * 0.72;
      const centerX = cannonX - slot.side * dispW * 0.14;

      sprite
        .setTexture(TIDE_ARCH_CLIFFS_TEX, slot.side < 0 ? 0 : 1)
        .setPosition(centerX, sy)
        .setDisplaySize(dispW, slot.height)
        .setVisible(true);

      // Soft submerged sea-foam collar at cliff foot (no harsh vertical strokes)
      const waveBeat = Math.sin(t * 3.2 + i * 1.1) * 3;
      const foamX = cannonX + slot.side * 6;
      surf.fillStyle(0x2ad2f4, 0.22).fillEllipse(foamX, sy + slot.height * 0.34, 46 + waveBeat, 18);
      surf.fillStyle(0xd8ffff, 0.24).fillEllipse(foamX, sy + slot.height * 0.30, 28 + waveBeat * 0.5, 9);
    }

    // 2. Animated waterfalls on cliff flanks pouring into bubbling coastal foam pools (clear of center lane)
    const wfFrame = Math.floor(t * 10) % 4;
    const wfPositions = [
      { x: opening.left - 14, y: archY + 62, w: 34, h: 74, vis: archY > -150 && archY < viewH + 100 },
      { x: opening.right + 14, y: archY + 56, w: 34, h: 74, vis: archY > -150 && archY < viewH + 100 },
      { x: opening.left - 22, y: archY + 260, w: 28, h: 62, vis: archY + 260 > -100 && archY + 260 < viewH + 100 },
      { x: opening.right + 22, y: archY + 235, w: 28, h: 62, vis: archY + 235 > -100 && archY + 235 < viewH + 100 },
    ];
    for (let i = 0; i < this.waterfalls.length; i++) {
      const cfg = wfPositions[i];
      const sprite = this.waterfalls[i];
      if (!cfg.vis || quality === 0 && i >= 2) {
        sprite.setVisible(false);
        continue;
      }
      sprite
        .setTexture(TIDE_ARCH_WATERFALL_TEX, (wfFrame + i) % 4)
        .setPosition(cfg.x, cfg.y)
        .setDisplaySize(cfg.w, cfg.h)
        .setAlpha(0.92)
        .setVisible(true);
    }

    // 3. Projected sea shadow directly underneath the stone arch bridge + across passing RIVET
    const bridgeW = world.arenaWidth + 28;
    const bridgeH = world.arenaWidth >= 500 ? 182 : 148;
    const bridgeOnScreen = archY > -bridgeH && archY < viewH + bridgeH;

    const shadow = this.archShadowGfx;
    shadow.clear();
    if (bridgeOnScreen) {
      shadow.setVisible(true);
      const shadowY = archY + 22;
      shadow.fillStyle(0x031838, 0.36).fillEllipse(opening.center, shadowY, opening.width * 0.96, bridgeH * 0.44);
      shadow.fillStyle(0x02122b, 0.24).fillRect(opening.left - 18, shadowY - 22, opening.width + 36, 44);
    } else {
      shadow.setVisible(false);
    }

    // 4. Monumental natural stone arch span rendering ABOVE RIVET (`depth 18.9 > RIVET 16.4..18`)
    if (bridgeOnScreen) {
      this.archBridge
        .setPosition(opening.center, archY - 12)
        .setDisplaySize(bridgeW, bridgeH)
        .setAlpha(1)
        .setVisible(true);
    } else {
      this.archBridge.setVisible(false);
    }

    // 5. Crisp wingtip aerodynamic locator so RIVET stays 100% readable while passing beneath opaque arch stone
    const beacon = this.rivetBeaconGfx;
    beacon.clear();
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
