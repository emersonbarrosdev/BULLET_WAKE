import type { StageBoss, BossTick, BossShot, BossHitResult, BossModule } from './types.ts';
import { PLAYFIELD_X, PLAYFIELD_WIDTH } from '../../constants.ts';

/** Bullet Wake calibration, not damage values attributed to Fire Shark. */
export const SPECIAL_BOSS_DAMAGE = 120;
export const SHELL_HP = SPECIAL_BOSS_DAMAGE * 5;
export const INNER_HP = SPECIAL_BOSS_DAMAGE * 3;
export const METAMORPHOSIS_MS = 2400;

export class BossTalassarca implements StageBoss {
  name = 'TALASSARCA';
  hp = SHELL_HP;
  modules:BossModule[]=this.makeModules(false);
  private makeModules(inner:boolean):BossModule[]{
    const hp=(inner?INNER_HP:SHELL_HP)/3;
    const scale=PLAYFIELD_WIDTH*(inner?1.30:1.02)/512;
    return [['left','Órgão esquerdo',inner?-49:-68,inner?-111:-94],['right','Órgão direito',inner?49:64,inner?-111:-97],['vent','Ventre dorsal',0,74]].map(([id,name,x,y])=>({id:String(id),name:String(name),offsetX:Number(x)*scale,offsetY:Number(y)*scale,width:52,height:52,hp,maxHp:hp,destroyed:false}));
  }
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
  get displayWidth(): number { return PLAYFIELD_WIDTH * (this.layer === 'shell' ? 1.02 : 1.30); }

  update(dt: number, playerX: number, playerY: number): BossTick {
    dt = Math.max(0, dt);
    this.elapsedMs += dt;
    const shots: BossShot[] = [];
    let phaseChanged = false;
    if (this.phase === 'intro') {
      this.introMs = Math.max(0, this.introMs - dt);
      this.y = -160 + (1 - this.introMs / 1800) * 385;
      if (!this.introMs) { this.phase = 'shell'; phaseChanged = true; }
    } else if (this.phase === 'metamorphosis') {
      this.metamorphosisMs = Math.min(METAMORPHOSIS_MS, this.metamorphosisMs + dt);
      if (this.metamorphosisMs >= METAMORPHOSIS_MS) {
        this.layer = 'inner'; this.phase = 'inner'; this.hp = INNER_HP;
        this.attackMs = 0; this.cycle = 0; this.modules=this.makeModules(true);phaseChanged = true;
      }
    } else if (this.phase !== 'defeated') {
      const inner = this.layer === 'inner';
      // Full-width inner appendages cannot translate across the HUD.
      this.x = PLAYFIELD_X + PLAYFIELD_WIDTH / 2 + Math.sin(this.elapsedMs / 1450) * (inner ? 0 : 30);
      this.y = (inner?240:225) + Math.sin(this.elapsedMs / 7200) * (inner ? 20 : 35);
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
        // Dorsal organs fire independently. Broken organs stay silent until metamorphosis.
        const organs=this.modules.filter(m=>!m.destroyed);
        const chosen=organs[(this.cycle-1)%Math.max(1,organs.length)];
        if(chosen){
          const ox=this.x+chosen.offsetX,originY=this.y+chosen.offsetY;
          const aim=Math.atan2(this.aimY-originY,this.aimX-ox);
          if(inner&&this.attackPattern==='curtain'){
            for(const organ of organs){
              for(const offset of [-.38,0,.38]){
                const x=this.x+organ.offsetX;
                if(Math.abs(x-this.safeLaneX)<40)continue;
                const y=this.y+organ.offsetY,vx=Math.sin(offset)*100;
                if(Math.abs(x+vx*Math.max(0,380-y)/190-this.safeLaneX)<34)continue;
                shots.push({x,y,velocityX:vx,velocityY:190,damage:1});
              }
            }
          }else for(const offset of(inner?[-.18,0,.18]:[-.24,0,.24])){
            shots.push({x:ox,y:originY,velocityX:Math.cos(aim+offset)*(inner?230:205),velocityY:Math.sin(aim+offset)*(inner?230:205),damage:1});
          }
        }
        this.isTelegraphing=false;
      }
    }
    return { phase: this.phase, phaseChanged, shots, spawns: [], hp: this.hp, maxHp: this.maxHp, x: this.x, y: this.y, telegraph: this.isTelegraphing, defeated: this.phase === 'defeated' };
  }

  damage(amount: number, hitX = this.x, hitY = this.y): BossHitResult {
    if (!Number.isFinite(amount) || amount <= 0 || !['shell', 'inner'].includes(this.phase)) return { bossDamage: 0, moduleDestroyed: null, killed: false };
    const applied = Math.min(amount, this.hp);
    let remaining=applied;let broken:string|null=null;
    const organs=this.modules.filter(m=>!m.destroyed).sort((a,b)=>Math.hypot(hitX-this.x-a.offsetX,hitY-this.y-a.offsetY)-Math.hypot(hitX-this.x-b.offsetX,hitY-this.y-b.offsetY));
    for(const organ of organs){const hit=Math.min(remaining,organ.hp);organ.hp-=hit;remaining-=hit;if(organ.hp<=0){organ.destroyed=true;broken=organ.name;}if(remaining<=0)break;}
    this.hp = Math.max(0, this.hp - applied);
    if (!this.hp && this.layer === 'shell') {
      this.phase = 'metamorphosis'; this.metamorphosisMs = 0; this.isTelegraphing = false;
      return { bossDamage: applied, moduleDestroyed: 'Casca rompida', killed: false };
    }
    if (!this.hp) this.phase = 'defeated';
    return { bossDamage: applied, moduleDestroyed: broken, killed: this.phase === 'defeated' };
  }
}
