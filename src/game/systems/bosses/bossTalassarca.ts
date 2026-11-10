import type { StageBoss, BossTick, BossShot, BossHitResult } from './types.ts';
import { PLAYFIELD_X, PLAYFIELD_WIDTH } from '../../constants.ts';

/** Bullet Wake calibration, not damage values attributed to Fire Shark. */
export const SPECIAL_BOSS_DAMAGE = 120;
export const SHELL_HP = SPECIAL_BOSS_DAMAGE * 5;
export const INNER_HP = SPECIAL_BOSS_DAMAGE * 3;
export const METAMORPHOSIS_MS = 2400;

export class BossTalassarca implements StageBoss {
  name = 'TALASSARCA';
  hp = SHELL_HP;
  layer: 'shell' | 'inner' = 'shell';
  phase: 'intro' | 'shell' | 'metamorphosis' | 'inner' | 'defeated' = 'intro';
  x = PLAYFIELD_X + PLAYFIELD_WIDTH / 2;
  y = -160;
  isTelegraphing = true;
  metamorphosisMs = 0;
  private elapsedMs = 0;
  private introMs = 1800;
  private attackMs = 0;
  private cycle = 0;
  private aimX = 384;
  private aimY = 350;
  /** Readable safe lane for the inner curtain; never an invisible full-screen wall. */
  safeLaneX = 384;
  attackPattern: 'fan' | 'curtain' | 'aimed' = 'fan';
  get maxHp(): number { return this.layer === 'shell' ? SHELL_HP : INNER_HP; }
  get bodyRadiusX(): number { return this.layer === 'shell' ? 164 : 208; }
  get bodyRadiusY(): number { return this.layer === 'shell' ? 128 : 155; }
  get displayWidth(): number { return PLAYFIELD_WIDTH * (this.layer === 'shell' ? .8 : 1); }

  update(dt: number, playerX: number, playerY: number): BossTick {
    dt = Math.max(0, dt);
    this.elapsedMs += dt;
    const shots: BossShot[] = [];
    let phaseChanged = false;
    if (this.phase === 'intro') {
      this.introMs = Math.max(0, this.introMs - dt);
      this.y = -160 + (1 - this.introMs / 1800) * 265;
      if (!this.introMs) { this.phase = 'shell'; phaseChanged = true; }
    } else if (this.phase === 'metamorphosis') {
      this.metamorphosisMs = Math.min(METAMORPHOSIS_MS, this.metamorphosisMs + dt);
      if (this.metamorphosisMs >= METAMORPHOSIS_MS) {
        this.layer = 'inner'; this.phase = 'inner'; this.hp = INNER_HP;
        this.attackMs = 0; this.cycle = 0; phaseChanged = true;
      }
    } else if (this.phase !== 'defeated') {
      const inner = this.layer === 'inner';
      // Full-width inner appendages cannot translate across the HUD.
      this.x = PLAYFIELD_X + PLAYFIELD_WIDTH / 2 + Math.sin(this.elapsedMs / 1450) * (inner ? 0 : 30);
      this.y = 105 + Math.sin(this.elapsedMs / 1100) * (inner ? 8 : 4);
      const interval = inner ? 1400 : 1450;
      const warning = inner ? 550 : 450;
      const previous = this.attackMs;
      this.attackMs += dt;
      this.attackPattern = inner ? (this.cycle%2===0?'curtain':'aimed') : 'fan';
      this.safeLaneX=PLAYFIELD_X+PLAYFIELD_WIDTH*[.28,.72,.5][Math.floor(this.cycle/2)%3];
      if(previous<interval-warning&&this.attackMs>=interval-warning){this.aimX=playerX;this.aimY=playerY;}
      this.isTelegraphing = this.attackMs >= interval - warning;
      while (this.attackMs >= interval) {
        this.attackMs -= interval; this.cycle++;
        const originY = this.y + (inner ? 75 : 55);
        const side = this.cycle % 2 ? -1 : 1;
        const ox = this.x + side * (inner ? 105 : 78);
        const aim = Math.atan2(this.aimY - originY, this.aimX - ox);
        if(inner&&this.attackPattern==='curtain') {
          for(let lane=0;lane<11;lane++){
            const x=PLAYFIELD_X+24+lane*(PLAYFIELD_WIDTH-48)/10;
            if(Math.abs(x-this.safeLaneX)<58)continue;
            shots.push({x,y:originY,velocityX:0,velocityY:205,damage:1});
          }
        } else for (const offset of (inner ? [-.18,0,.18] : [-.28, 0, .28])) {
          const angle = aim + offset;
          shots.push({ x: ox, y: originY, velocityX: Math.cos(angle) * (inner ? 230 : 205), velocityY: Math.sin(angle) * (inner ? 230 : 205), damage: 1 });
        }
        this.isTelegraphing=false;
      }
    }
    return { phase: this.phase, phaseChanged, shots, spawns: [], hp: this.hp, maxHp: this.maxHp, x: this.x, y: this.y, telegraph: this.isTelegraphing, defeated: this.phase === 'defeated' };
  }

  damage(amount: number, _hitX = this.x, _hitY = this.y): BossHitResult {
    if (!Number.isFinite(amount) || amount <= 0 || !['shell', 'inner'].includes(this.phase)) return { bossDamage: 0, moduleDestroyed: null, killed: false };
    const applied = Math.min(amount, this.hp);
    this.hp = Math.max(0, this.hp - applied);
    if (!this.hp && this.layer === 'shell') {
      this.phase = 'metamorphosis'; this.metamorphosisMs = 0; this.isTelegraphing = false;
      return { bossDamage: applied, moduleDestroyed: 'Casca rompida', killed: false };
    }
    if (!this.hp) this.phase = 'defeated';
    return { bossDamage: applied, moduleDestroyed: null, killed: this.phase === 'defeated' };
  }
}
