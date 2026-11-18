import Phaser from 'phaser';
import type { ArcadeWorld } from './ArcadeWorld';
import { computeArchOpening } from './PelagicTideArch';
import { clamp } from './geometry';

export const TIDE_ARCH_BRIDGE_TEX = 'pelagic-tide-arch-bridge';

/** Preloads strictly the monumental Tide Arch overhead rock bridge asset (artificial waterfalls & cliff cutouts removed). */
export function preloadTideArchArt(scene: Phaser.Scene, base: string): void {
  const dir = `${base}assets/arcade/pelagic-review/`;
  scene.load.image(TIDE_ARCH_BRIDGE_TEX, `${dir}tide-arch-bridge.png`);
}

/**
 * Renders the 2.5D Pelagic Tide Arch span integrated directly over the continuous painted coastline:
 * pillar coastal water surf (`1.12`) -> cast bridge shadow over sea/coast (`1.36`) ->
 * monumental stone arch span (`18.90`) -> sunlit arch rim (`18.95`) -> wingtip locator (`19.30`).
 */
export class PelagicTideArchRenderer {
  private readonly waterSurfGfx: Phaser.GameObjects.Graphics;
  private readonly archShadowGfx: Phaser.GameObjects.Graphics;
  private readonly archBridge: Phaser.GameObjects.Image;
  private readonly canyonRimGfx: Phaser.GameObjects.Graphics;
  private readonly rivetBeaconGfx: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    this.waterSurfGfx = scene.add.graphics().setDepth(1.12).setVisible(false);
    this.archShadowGfx = scene.add.graphics().setDepth(1.36).setVisible(false);
    this.archBridge = scene.add
      .image(0, 0, TIDE_ARCH_BRIDGE_TEX)
      .setDepth(18.90)
      .setVisible(false);
    this.canyonRimGfx = scene.add.graphics().setDepth(18.95).setVisible(false);
    this.rivetBeaconGfx = scene.add.graphics().setDepth(19.30).setVisible(false);
  }

  hide(): void {
    for (const g of [
      this.waterSurfGfx,
      this.archShadowGfx,
      this.canyonRimGfx,
      this.rivetBeaconGfx,
    ]) {
      g.clear().setVisible(false);
    }
    this.archBridge.setVisible(false);
  }

  destroy(): void {
    this.hide();
    for (const g of [
      this.waterSurfGfx,
      this.archShadowGfx,
      this.canyonRimGfx,
      this.rivetBeaconGfx,
    ]) {
      g.destroy();
    }
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
    const elevScale = 1 + lowFactor * 0.045;
    const parallaxY = -lowFactor * 6;
    const spanY = archY - 14 + parallaxY;
    const bridgeOnScreen = archY > -bridgeH * 1.15 && archY < viewH + bridgeH * 1.15;

    const surf = this.waterSurfGfx.clear();
    const shadow = this.archShadowGfx.clear();
    const rim = this.canyonRimGfx.clear();

    if (bridgeOnScreen) {
      // 1. Organic coastal surf & shallow turquoise shelf strictly at the left/right arch pillar bases (`depth 1.12`)
      surf.setVisible(true);
      const pulseL = Math.sin(t * 2.4) * 3.5;
      const pulseR = Math.sin(t * 2.4 + 1.4) * 3.5;
      const leftBaseX = opening.left - opening.pierLeftWidth * 0.24;
      const leftBaseY = spanY + bridgeH * 0.22;
      const rightBaseX = opening.right + opening.pierRightWidth * 0.22;
      const rightBaseY = spanY + bridgeH * 0.25;

      surf.fillStyle(0x1cbce0, 0.22).fillEllipse(leftBaseX + 6, leftBaseY + 3, opening.pierLeftWidth * 0.95 + pulseL, 26);
      surf.fillStyle(0x1cbce0, 0.22).fillEllipse(rightBaseX - 6, rightBaseY + 3, opening.pierRightWidth * 0.95 + pulseR, 26);
      if (quality > 0) {
        surf.fillStyle(0xdcfbff, 0.26).fillEllipse(leftBaseX + 10, leftBaseY, opening.pierLeftWidth * 0.62 + pulseL * 0.6, 11);
        surf.fillStyle(0xdcfbff, 0.26).fillEllipse(rightBaseX - 10, rightBaseY, opening.pierRightWidth * 0.62 + pulseR * 0.6, 11);
      }

      // 2. Coherent soft curved cast shadow of the arch span & flanking piers over the ocean surface (`depth 1.36`)
      shadow.setVisible(true);
      const shadowY = archY + 20 + lowFactor * 8;
      shadow.fillStyle(0x021430, 0.20 + lowFactor * 0.08).fillEllipse(opening.center, shadowY, opening.width * 1.12, bridgeH * 0.44);
      shadow.fillStyle(0x010e24, 0.24 + lowFactor * 0.08).fillEllipse(opening.center, shadowY - 2, opening.width * 0.86, bridgeH * 0.28);
      shadow.fillStyle(0x02122b, 0.22 + lowFactor * 0.08).fillEllipse(leftBaseX + 6, leftBaseY + 6, opening.pierLeftWidth * 0.92, 32);
      shadow.fillStyle(0x02122b, 0.22 + lowFactor * 0.08).fillEllipse(rightBaseX - 6, rightBaseY + 6, opening.pierRightWidth * 0.92, 32);

      // 3. Monumental overhead stone Arch bridge (`depth 18.90`) + top sunlit crown rim (`depth 18.95`)
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
      surf.setVisible(false);
      shadow.setVisible(false);
      this.archBridge.setVisible(false);
      rim.setVisible(false);
    }

    // 4. Crisp aerodynamic locator chevron while RIVET passes beneath opaque overhead arch rock (`depth 19.30`)
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
