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
  trail?: Array<{x:number;y:number}>;
}
/** Animated raster flames follow the same geometry used by damage calculations. */
export class CrimsonLaserRenderer {
  private readonly sprites: Phaser.GameObjects.Sprite[] = [];
  private readonly ribbons: Phaser.GameObjects.Graphics;
  constructor(
    private readonly scene: Phaser.Scene,
    _paintedShots = false,
  ) {this.ribbons=scene.add.graphics().setDepth(8);}
  render(
    state: CrimsonLaserState,
    _shots: readonly RenderableShotTrail[] = [],
    _family: WeaponFamily = 'green',
    _level: WeaponLevel = 1,
    _time = 0,
  ): void {
    let used = 0;
    this.ribbons.clear();
    // The moving green head leaves a continuous luminous wave, never isolated dots.
    for(const shot of _shots)if(shot.waveAmplitude&&shot.trail&&shot.trail.length>1){
      for(const [width,color,alpha] of [[9,0x14943d,.2],[4,0x35ef67,.65],[1.4,0xe0ffad,.9]]) {
        this.ribbons.lineStyle(width,color,alpha).beginPath();
        shot.trail.forEach((p,i)=>i===0?this.ribbons.moveTo(p.x,p.y):this.ribbons.lineTo(p.x,p.y));
        this.ribbons.strokePath();
      }
    }
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
              .sprite(0, 0, 'polish-fire', 0)
              .setDepth(8);
            this.sprites.push(sprite);
          }
          sprite
            .setVisible(true)
            .setPosition((a.x + b.x) / 2, (a.y + b.y) / 2)
            .setFrame(Math.floor(state.phaseMs / 50 + i) % 8)
            .setDisplaySize(beam.outerWidth * 2.7, Math.max(38, distance * 3.6))
            .setRotation(Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2)
            .setAlpha(state.intensity * 0.85);
          used++;
        }
    for (let i = used; i < this.sprites.length; i++)
      this.sprites[i].setVisible(false);
  }
  clear(): void {
    this.ribbons.clear();
    for (const sprite of this.sprites) sprite.setVisible(false);
  }
  destroy(): void {
    this.ribbons.destroy();
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites.length = 0;
  }
}
