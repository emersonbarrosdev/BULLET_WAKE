import { captainRegions } from './combatBossRegions.ts';
/**
 * BULLET WAKE V2 — Miniboss da Fase 1 (Fenda Pelágica):
 * RAIA-DENTE
 * 
 * Grande criatura biomecânica alienígena de vista superior (top-down).
 * Desce na metade da fase (aprox. 1800m), com asas extensas e múltiplos padrões de tiro.
 */
import type { StageBoss, BossTick, BossShot, BossSpawnEvent, BossHitResult, BossModule } from './types.ts';
import { PLAYFIELD_X, PLAYFIELD_WIDTH } from '../../constants.ts';

export class MinibossRaiaDente implements StageBoss {
  name = 'RAIA-DENTE';
  readonly maxHp = 180;
  hp = 180;
  readonly displayWidth=136;
  readonly bodyRadiusX=54;
  readonly bodyRadiusY=42;
  modules:BossModule[]=captainRegions().map(r=>({...r,offsetX:(r.x-128)*136/256,offsetY:(r.y-128)*136/256,width:r.width*136/256,height:r.height*136/256,hp:60,maxHp:60,destroyed:false}));
  x = PLAYFIELD_X + PLAYFIELD_WIDTH / 2; // Centro do corredor: 384
  y = 85;

  phase: 'intro' | 'active' | 'defeated' = 'intro';
  isTelegraphing = false;

  private introTimerMs = 1200;
  private attackTimerMs = 0;
  private shotCycle = 0;
  private elapsedMs = 0;
  private aimX=384;
  private aimY=350;

  update(dt: number, playerX: number, playerY: number): BossTick {
    this.elapsedMs+=Math.max(0,dt);
    const shots: BossShot[] = [];
    const spawns: BossSpawnEvent[] = [];
    let phaseChanged = false;

    if (this.phase === 'intro') {
      this.introTimerMs -= dt;
      this.y = Math.min(85, -40 + (1 - this.introTimerMs / 1200) * 125);
      if (this.introTimerMs <= 0) {
        this.phase = 'active';
        phaseChanged = true;
      }
      return {
        phase: this.phase,
        phaseChanged,
        shots,
        spawns,
        hp: this.hp,
        maxHp: this.maxHp,
        x: this.x,
        y: this.y,
        telegraph: true,
        defeated: false,
      };
    }

    if (this.phase === 'defeated') {
      return {
        phase: this.phase,
        phaseChanged: false,
        shots,
        spawns,
        hp: 0,
        maxHp: this.maxHp,
        x: this.x,
        y: this.y,
        telegraph: false,
        defeated: true,
      };
    }

    // Movimentação sinusoidal lateral no corredor
    this.x = (PLAYFIELD_X + PLAYFIELD_WIDTH / 2) + Math.sin(this.elapsedMs / 1200) * 65;
    const previous=this.attackTimerMs;
    this.attackTimerMs += dt;
    if(previous<650&&this.attackTimerMs>=650){this.aimX=playerX;this.aimY=playerY;}
    this.isTelegraphing=this.attackTimerMs>=650;

    if (this.attackTimerMs >= 1100) {
      this.attackTimerMs -= 1100;
      this.shotCycle++;

      const pattern = this.shotCycle % 3;
      const left=this.modules[0],right=this.modules[1];

      const guns=[left,right].filter(m=>!m.destroyed);
      const core=this.modules[2];
      if(pattern===0){
        const gun=guns[this.shotCycle%Math.max(1,guns.length)];
        if(gun)for(const vx of [-70,0,70])shots.push({x:this.x+gun.offsetX,y:this.y+gun.offsetY,velocityX:vx,velocityY:220,damage:1,weight:'heavy'});
      }else if(pattern===1&&!core.destroyed){
        for(const vx of [-130,-50,50,130])shots.push({x:this.x+core.offsetX,y:this.y+core.offsetY,velocityX:vx,velocityY:200,damage:1,weight:'medium'});
      }else if(pattern===2){
        for(const gun of guns){
          const x=this.x+gun.offsetX,y=this.y+gun.offsetY;
          const dx=this.aimX-x,dy=this.aimY-y,dist=Math.hypot(dx,dy)||1;
          shots.push({x,y,velocityX:dx/dist*240,velocityY:dy/dist*240,damage:1,weight:'heavy'});
        }
      }

    }

    return {
      phase: this.phase,
      phaseChanged,
      shots,
      spawns,
      hp: this.hp,
      maxHp: this.maxHp,
      x: this.x,
      y: this.y,
      telegraph: this.isTelegraphing,
      defeated: false,
    };
  }

  damage(amount:number,hitX=this.x,hitY=this.y,moduleId?:string|null):BossHitResult {
    if(this.phase!=='active'||amount<=0||!Number.isFinite(amount))return {bossDamage:0,moduleDestroyed:null,killed:false};
    const part=moduleId!==undefined?this.modules.find(m=>m.id===moduleId&&!m.destroyed):this.modules.find(m=>!m.destroyed&&((hitX-this.x-m.offsetX)/(m.width/2))**2+((hitY-this.y-m.offsetY)/(m.height/2))**2<=1);
    if(!part)return {bossDamage:0,moduleDestroyed:null,killed:false};
    const applied=Math.min(part.hp,amount);part.hp-=applied;part.destroyed=part.hp<=0;
    this.hp=this.modules.reduce((n,m)=>n+m.hp,0);if(this.hp<=1e-7){this.hp=0;this.phase='defeated';}
    return {bossDamage:applied,moduleDestroyed:part.destroyed?part.name:null,killed:this.phase==='defeated'};
  }
  damageArea(amount:number):BossHitResult {
    if(this.phase!=='active')return {bossDamage:0,moduleDestroyed:null,killed:false};
    let applied=0,remaining=Math.min(this.hp,amount);
    while(remaining>1e-7){const live=this.modules.filter(m=>!m.destroyed);if(!live.length)break;const share=remaining/live.length;let spent=0;for(const m of live){const hit=this.damage(share,this.x+m.offsetX,this.y+m.offsetY,m.id);spent+=hit.bossDamage;}applied+=spent;remaining-=spent;}
    return {bossDamage:applied,moduleDestroyed:null,killed:this.hp<=0};
  }
  takeDamage(amount:number):BossHitResult{return this.damageArea(amount);}
}
