import Phaser from 'phaser';
import type { CrimsonLaserState } from '../systems/crimsonLaserSystem';
import type { WeaponFamily, WeaponLevel } from '../systems/weaponSystem';
export interface RenderableShotTrail {
  x: number;
  y: number;
  baseX: number;
  ageMs: number;
  velocityX: number;
  velocityY: number;
  waveAmplitude?: number;
  waveFrequency?: number;
  wavePhase?: number;
}
/** Animated raster flames follow the same geometry used by damage calculations. */
export class CrimsonLaserRenderer {
  private readonly sprites: Phaser.GameObjects.Sprite[] = [];
  constructor(
    private readonly scene: Phaser.Scene,
    _paintedShots = false,
  ) {}
  render(
    state: CrimsonLaserState,
    _shots: readonly RenderableShotTrail[] = [],
    _family: WeaponFamily = 'green',
    _level: WeaponLevel = 1,
    _time = 0,
  ): void {
    let used = 0;
    if (state.isEmitting && state.intensity > 0.01)
      for (const beam of state.beams)
        for (let i = 1; i < beam.points.length; i++) {
          const a = beam.points[i - 1],
            b = beam.points[i],
            distance = Math.hypot(b.x - a.x, b.y - a.y);
          if (distance < 1) continue;
          let sprite = this.sprites[used];
          if (!sprite) {
            sprite = this.scene.add
              .sprite(0, 0, 'review-effects-fire', 0)
              .setDepth(8);
            this.sprites.push(sprite);
          }
          sprite
            .setVisible(true)
            .setPosition((a.x + b.x) / 2, (a.y + b.y) / 2)
            .setFrame(Math.floor(state.phaseMs / 70 + i) % 4)
            .setDisplaySize(beam.outerWidth * 2.1, Math.max(28, distance * 2.8))
            .setRotation(Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2)
            .setAlpha(state.intensity * 0.85);
          used++;
        }
    for (let i = used; i < this.sprites.length; i++)
      this.sprites[i].setVisible(false);
  }
  clear(): void {
    for (const sprite of this.sprites) sprite.setVisible(false);
  }
  destroy(): void {
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites.length = 0;
  }
}
