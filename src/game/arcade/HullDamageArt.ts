import type Phaser from 'phaser';
import { HULL_DAMAGE_SHEETS, HULL_SHIP_VISUALS, type HullVisualAnchor } from './HullDamageVisualConfig.ts';

export function preloadHullDamageArt(scene: Phaser.Scene, base: string): void {
  for (const sheet of HULL_DAMAGE_SHEETS) {
    scene.load.spritesheet(sheet.key, `${base}assets/arcade/hull/${sheet.key}.png`, { frameWidth: sheet.size, frameHeight: sheet.size });
  }
}

export interface HullArtWorld {
  survivalRule: 'hull-v1' | 'classic-v1';
  hull: number;
  hullMaximum: number;
  hullState: 'intact' | 'light' | 'damaged' | 'critical' | 'destroyed';
  player: { x: number; y: number; bank: number };
  elapsed: number;
  up: boolean;
  pilotId: string;
  state: string;
}

/** Presentation only: twelve fixed sprites, no bodies, no mutation of gameplay or hitboxes. */
export class HullDamageArt {
  private scars: Phaser.GameObjects.Sprite;
  private smoke: Phaser.GameObjects.Sprite[];
  private flame: Phaser.GameObjects.Sprite[];
  private sparks: Phaser.GameObjects.Sprite[];
  private repair: Phaser.GameObjects.Sprite;
  private destruction: Phaser.GameObjects.Sprite;
  private sprites: Phaser.GameObjects.Sprite[];
  private clock = 0;
  private repairAge = 99;
  private destructionAge = 99;
  private condition: HullArtWorld['hullState'] = 'intact';
  private destructionUp = true;
  private disposed = false;
  private readonly destructionSeconds = .88;

  constructor(scene: Phaser.Scene) {
    const make = (key: string) => scene.add.sprite(0, 0, key, 0).setDepth(18.1).setVisible(false);
    this.scars = make('hull-scars-up');
    this.smoke = Array.from({ length: 4 }, () => make('hull-smoke'));
    this.flame = Array.from({ length: 2 }, () => make('hull-flame'));
    this.sparks = Array.from({ length: 3 }, () => make('hull-spark'));
    this.repair = make('hull-repair');
    this.destruction = make('hull-destruction');
    this.sprites = [this.scars, ...this.smoke, ...this.flame, ...this.sparks, this.repair, this.destruction];
  }

  triggerRepair(): void { if (!this.disposed) this.repairAge = 0; }

  triggerDestruction(x: number, y: number, up: boolean): void {
    if (this.disposed || this.destructionAge < this.destructionSeconds) return;
    this.destructionAge = 0;
    this.destructionUp = up;
    this.destruction.setPosition(x, y).setRotation(up ? 0 : Math.PI / 2).setDisplaySize(96, 96).setDepth(21);
  }

  /** Map fractional anchors through the actual rendered frame, including origin, bank, recoil and flip. */
  private anchor(player: Phaser.GameObjects.Sprite, local: HullVisualAnchor, bank: number, up: boolean): { x: number; y: number } {
    const roll = up ? Math.max(.6, Math.cos(bank * .85)) : 1;
    const dx = (local.x * roll + .5 - player.originX) * player.displayWidth * (player.flipX ? -1 : 1);
    const dy = (local.y + .5 - player.originY) * player.displayHeight * (player.flipY ? -1 : 1);
    const c = Math.cos(player.rotation), s = Math.sin(player.rotation);
    return { x: player.x + dx * c - dy * s, y: player.y + dx * s + dy * c };
  }

  update(world: HullArtWorld, player: Phaser.GameObjects.Sprite, dt: number, visible = true): void {
    if (this.disposed) return;
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.clock += step;
    this.repairAge += step;
    this.destructionAge += step;
    for (const sprite of this.sprites) sprite.setVisible(false);
    if (world.survivalRule !== 'hull-v1') { this.condition = 'intact'; return; }
    if (world.hullState === 'destroyed' && this.condition !== 'destroyed') this.triggerDestruction(player.x, player.y, world.up);
    this.condition = world.hullState;
    if (!visible) return;

    const showShip = player.visible && world.hull > 0 && world.hullState !== 'destroyed';
    const cfg = HULL_SHIP_VISUALS[world.pilotId] ?? HULL_SHIP_VISUALS.nolan;
    const spec = world.up ? cfg.up : cfg.side;
    const scale = Math.max(player.displayWidth, player.displayHeight);
    const angle = player.rotation + spec.trailAngle;
    const frameAt = (fps: number, frames = 8, offset = 0) => Math.floor(this.clock * fps + offset) % frames;

    if (showShip && world.hullState !== 'intact') {
      const severity = world.hullState === 'critical' ? 2 : world.hullState === 'damaged' ? 1 : 0;
      this.scars.setTexture(world.up ? 'hull-scars-up' : 'hull-scars-side', severity)
        .setPosition(player.x, player.y).setOrigin(player.originX, player.originY).setDisplaySize(player.displayWidth * spec.scarsScale * (world.up ? Math.max(.6, Math.cos(world.player.bank * .85)) : 1), player.displayHeight * spec.scarsScale)
        .setRotation(player.rotation).setFlip(player.flipX, player.flipY).setDepth(player.depth + .04).setAlpha(player.alpha * .94).setVisible(true);

      const smokeCount = severity === 2 ? 4 : severity === 1 ? 2 : 0;
      this.smoke.forEach((sprite, i) => {
        if (i >= smokeCount) return;
        const a = spec.smoke[i % spec.smoke.length], pos = this.anchor(player, a, world.player.bank, world.up);
        const phase = ((this.clock * 1.2 + i * .31) % 1);
        const trail = scale * (.15 + phase * .65);
        const trailX = Math.sin(angle) * trail, trailY = -Math.cos(angle) * trail;
        const side = (i % 2 ? 1 : -1) * Math.sin(phase * Math.PI) * scale * .12;
        sprite.setPosition(pos.x + trailX + Math.cos(angle) * side, pos.y + trailY + Math.sin(angle) * side)
          .setRotation(angle).setDisplaySize(scale * a.scale * (.5 + phase * .5), scale * a.scale * (.65 + phase * .7))
          .setFrame(frameAt(11, 8, i * 2)).setDepth(player.depth - .04).setAlpha((severity === 2 ? .64 : .42) * (1 - phase * .7)).setVisible(true);
      });
      this.flame.forEach((sprite, i) => {
        if (severity !== 2) return;
        const a = spec.flame[i], pos = this.anchor(player, a, world.player.bank, world.up);
        sprite.setPosition(pos.x, pos.y).setOrigin(.5, .92).setRotation(angle)
          .setDisplaySize(scale * a.scale * .56, scale * a.scale * .95).setFrame(frameAt(17, 8, i * 3))
          .setDepth(player.depth + .06).setAlpha(.86).setVisible(true);
      });
      this.sparks.forEach((sprite, i) => {
        const cycle = (this.clock + i * .43) % (severity === 0 ? 2.4 : 1.3);
        if (cycle > .23 || i > severity) return;
        const a = spec.spark[i], pos = this.anchor(player, a, world.player.bank, world.up);
        sprite.setPosition(pos.x, pos.y).setOrigin(.5).setRotation(player.rotation + i * .7)
          .setDisplaySize(scale * a.scale, scale * a.scale).setFrame(Math.min(3, Math.floor(cycle / .06)))
          .setDepth(player.depth + .08).setAlpha(.9).setVisible(true);
      });
    }
    if (showShip && this.repairAge < .6) {
      this.repair.setPosition(player.x, player.y).setRotation(player.rotation).setOrigin(.5)
        .setDisplaySize(scale * 1.45, scale * 1.45).setFrame(Math.min(7, Math.floor(this.repairAge / .075)))
        .setDepth(player.depth + .1).setAlpha(.8).setVisible(true);
    }
    if (this.destructionAge < this.destructionSeconds) {
      this.destruction.setFrame(Math.min(7, Math.floor(this.destructionAge / (this.destructionSeconds / 8))))
        .setRotation(this.destructionUp ? 0 : Math.PI / 2).setAlpha(1).setVisible(true);
    }
  }

  clear(): void {
    for (const sprite of this.sprites) sprite.setVisible(false);
    this.clock = 0; this.repairAge = 99; this.destructionAge = 99; this.condition = 'intact';
  }

  snapshot(): { objects: number; visible: number; condition: HullArtWorld['hullState']; clock: number; repairActive: boolean; destructionActive: boolean } {
    return { objects: this.disposed ? 0 : this.sprites.length, visible: this.sprites.filter(s => s.visible).length, condition: this.condition, clock: this.clock, repairActive: this.repairAge < .6, destructionActive: this.destructionAge < this.destructionSeconds };
  }

  destroy(): void { if (!this.disposed) { this.clear(); for (const sprite of this.sprites) sprite.destroy(); this.disposed = true; } }
}
