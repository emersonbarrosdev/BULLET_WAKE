import {BurstController} from './BurstController.ts';
import {FAMILY,ENEMY_SHOTS,formationOffsets,regionAt,SUPPLIES,type Mission,type Family,type Motion} from './content.ts';
import {clamp,sweepEllipse,type Box} from './geometry.ts';
import {collectPowerItem,createPlayerWeapons,getPrimaryProjectiles,getSecondaryProjectiles,type PlayerWeaponsState} from '../systems/weaponSystem.ts';
import {enterStage,type CampaignFlight} from '../systems/campaignFlight.ts';
import {prepareSurface,moveSurface,surfaceMount,waterCorridor,type SurfaceRoute} from './PelagicEnvironment.ts';

export interface Controls {x:number;y:number;fire:boolean;special:boolean;}
export interface SubmarineState {phase:'emerge'|'hold'|'submerge';exposure:number;side:-1|1;}
export interface Actor {id:number;x:number;y:number;size:number;hp:number;maxHp:number;age:number;flash:number;family:Family;motion:Motion;lane:number;offset:number;speed:number;cooldown:number;warning:number;ground:boolean;navigation?:SurfaceRoute;submarine?:SubmarineState;}
export interface ArcadeBomb {x:number;y:number;age:number;phase:'flight'|'blast';radius:number;}
export interface Bullet {active:boolean;x:number;y:number;px:number;py:number;vx:number;vy:number;damage:number;radius:number;enemy:boolean;missile:boolean;homing:boolean;age:number;scale:number;color:number;}
export interface Cargo {id:number;x:number;y:number;vx:number;vy:number;kind:'power'|'life'|'special';crate:boolean;hp:number;age:number;}
export interface Component {id:number;x:number;y:number;dx:number;dy:number;hp:number;maxHp:number;radius:number;flash:number;warning:number;angle:number;}
export interface Boss {mini:boolean;x:number;y:number;size:number;age:number;phase:'enter'|'fight'|'retreat'|'absent'|'return'|'sink';configuration:number;timer:number;attack:number;attackTime:number;volley:number;aimX:number;aimY:number;parts:Component[];flash?:number;}
export interface Obstacle {id:number;x:number;y:number;width:number;height:number;kind:'roof'|'gate'|'barrier';warning:number;hp:number;age:number;}
/** A destroyed coastal emplacement remains attached to its original terrain. */
export interface CoastalWreck {anchor?:number;family?:'tank'|'tower';id:number;x:number;y:number;worldY:number;size:number;age:number;}
export interface WorldEvent {type:'shot'|'missile'|'enemy-shot'|'impact'|'explosion'|'pickup'|'death'|'special'|'boss'|'return'|'mini'|'victory'|'defeat'|'radio';x:number;y:number;size?:number;text?:string;}
export type BossContactQuery=(boss:Boss,ax:number,ay:number,bx:number,by:number,radius:number)=>number|null;
export type ContactQuery=(actor:Actor,ax:number,ay:number,bx:number,by:number,radius:number)=>number|null;
const TAU=Math.PI*2;
const BASE_CONTROL:Controls={x:0,y:0,fire:false,special:false};
/** Fixed-step deterministic simulation. Rendering quality never enters these rules. */
export class ArcadeWorld {
 readonly arena:Box;readonly bullets:Bullet[]=Array.from({length:640},()=>({active:false,x:0,y:0,px:0,py:0,vx:0,vy:0,damage:0,radius:0,enemy:false,missile:false,homing:false,age:0,scale:1,color:0}));
 enemies:Actor[]=[];cargo:Cargo[]=[];obstacles:Obstacle[]=[];wrecks:CoastalWreck[]=[];boss?:Boss;bomb?:ArcadeBomb;events:WorldEvent[]=[];
 weapons:PlayerWeaponsState=createPlayerWeapons('nolan');lives=3;score=0;kills=0;deaths=0;collected=0;elapsed=0;route=0;scroll=0;scrollSpeed=38;region=0;player={x:384,y:368,invulnerable:2.5,bank:0};
 state:'intro'|'play'|'exit'|'victory'|'defeat'='intro';introTime=2.2;exitTime=0;specialTime=0;missileTime=0;specialEdge=false;specialImpact?:{x:number;y:number};
 contact?:ContactQuery;bossContact?:BossContactQuery;accessibility=false;hard=false;
 private burst=new BurstController();private sequence=0;private waveIndex=0;private supplyIndex=0;private miniStarted=false;private bossStarted=false;private nextObstacle=98;
 readonly mission:Mission;
 constructor(mission:Mission,carry?:CampaignFlight){
  this.mission=mission;
  this.arena=mission.perspective==='UP'?{left:192,right:576,top:38,bottom:420}:{left:16,right:752,top:40,bottom:414};
  const restored=enterStage('nolan',mission.id,carry);this.weapons=restored.weapons;this.lives=restored.health.lives;this.score=restored.score;
  this.player.x=this.up?384:100;this.player.y=this.up?376:228;
 }
 get up():boolean{return this.mission.perspective==='UP';}
 emit(type:WorldEvent['type'],x=this.player.x,y=this.player.y,size=1,text?:string):void{this.events.push({type,x,y,size,text});}
 step(seconds:number,input:Controls=BASE_CONTROL):void{
  const dt=clamp(seconds,0,.05);if(this.state==='victory'||this.state==='defeat')return;
  if(this.state==='intro'){this.introTime-=dt;this.scroll+=25*dt;if(this.introTime<=0){this.state='play';this.emit('radio',0,0,1,this.up?'Mar aberto. Vamos abrir caminho!':'Cidade Solar, a RIVET chegou!');}return;}
  if(this.state==='exit'){this.exitTime+=dt;this.scroll+=30*dt;this.updateWrecks(dt);if(this.up)this.player.y-=130*dt;else this.player.x+=250*dt;if(this.exitTime>=3.4)this.state='victory';return;}
  this.elapsed+=dt;this.route=Math.min(300,this.route+dt);this.region=regionAt(this.route);
  this.player.invulnerable=Math.max(0,this.player.invulnerable-dt);
  const n=Math.max(1,Math.hypot(input.x,input.y)),speed=174;
  this.player.x=clamp(this.player.x+input.x/n*speed*dt,this.arena.left+14,this.arena.right-14);
  this.player.y=clamp(this.player.y+input.y/n*speed*dt,this.arena.top+16,this.arena.bottom-15);
  this.player.bank+=((this.up?input.x:-input.y)-this.player.bank)*Math.min(1,dt*12);
  for(let i=this.burst.update(dt*1000,input.fire,this.accessibility);i>0;i--)this.firePrimary();
  this.missileTime-=dt;if(input.fire&&this.weapons.weaponLevel>=3&&this.missileTime<=0){this.fireMissiles();this.missileTime=this.weapons.weaponLevel===5?1.1:1.5;}
  if(input.special&&!this.specialEdge&&this.weapons.specialCharges>0&&this.specialTime<=0){this.weapons.specialCharges--;this.specialTime=2.75;this.bomb={x:this.player.x,y:this.player.y,age:0,phase:'flight',radius:0};this.emit('special');}
  this.specialEdge=input.special;
  if(this.specialTime>0){this.specialTime=Math.max(0,this.specialTime-dt);this.specialImpact=undefined;this.applySpecial(dt);}
  while(this.waveIndex<this.mission.encounters.length&&this.route>=this.mission.encounters[this.waveIndex].at){const e=this.mission.encounters[this.waveIndex++];if(e.at!==155){this.spawnEncounter(e);if(this.hard&&e.formation==='solo'&&e.family!=='tower')this.spawnEncounter({...e,family:'interceptor',formation:'pair',motion:'curve',lane:1-e.lane});}}
  while(this.supplyIndex<SUPPLIES.length&&this.route>=SUPPLIES[this.supplyIndex].at){const c=SUPPLIES[this.supplyIndex++];const lane=.25+(this.supplyIndex%3)*.24;this.cargo.push({id:++this.sequence,x:this.up?this.arena.left+lane*(this.arena.right-this.arena.left):this.arena.right+15,y:this.up?-25:85+lane*250,vx:this.up?20:-32,vy:this.up?25:0,kind:c.kind,crate:true,hp:3,age:0});}
  if(this.route>=155&&!this.miniStarted){this.miniStarted=true;this.startBoss(true);}
  if(this.route>=300&&!this.bossStarted&&!this.boss){this.bossStarted=true;this.enemies=[];this.clearHostileBullets();this.startBoss(false);}
  if(!this.up&&this.route>=this.nextObstacle&&this.route<270){this.spawnObstacle();this.nextObstacle+=this.route<135?12:33;}
  let targetScroll=!this.up&&this.region===3?85:38;
  if(this.boss&&!this.boss.mini)targetScroll=this.boss.phase==='absent'?20:0;
  else if(this.boss)targetScroll=16;
  this.scrollSpeed+=(targetScroll-this.scrollSpeed)*Math.min(1,dt*1.5);this.scroll+=this.scrollSpeed*dt;
  this.updateWrecks(dt);this.updateEnemies(dt);this.updateBoss(dt);this.updateCargo(dt);this.updateObstacles(dt);this.updateBullets(dt);
 }
 private spawnEncounter(e:Mission['encounters'][number]):void{
  formationOffsets(e.formation).forEach(([offset,delay],i)=>{
   const family=e.formation==='escort'&&i>0?'fighter':e.family;const def=FAMILY[family];const ground=(this.up?['boat','ship','tank','tower','submarine']:['tank','tower']).includes(family);
   const lane=clamp(e.lane+offset,.09,.91),cross=this.up?this.arena.left+lane*(this.arena.right-this.arena.left):ground?390:this.arena.top+lane*350;
   const baseSpeed=family==='interceptor'?128:family==='acrobat'?100:family==='fighter'?92:family==='alien'?95:family==='bomber'?72:family==='airship'?62:ground?24:80;
   this.enemies.push({id:++this.sequence,x:this.up?cross:800-delay*220,y:this.up?-30+delay*220:cross,size:def.size,hp:def.hp,maxHp:def.hp,age:0,flash:0,family,motion:e.motion,lane:cross,offset:i*.7,speed:e.speed??baseSpeed,cooldown:1.6+i*.2,warning:0,ground});
   if(this.up&&family==='submarine'){
    const actor=this.enemies[this.enemies.length-1],solo=e.formation==='solo';
    let y=solo?120:80+i*100,corridor=waterCorridor(y-this.scroll,actor.size*.52),span=corridor.right-corridor.left;
    if(solo){
     for(const candidateY of [90,115,140,165]){
      const c=waterCorridor(candidateY-this.scroll,actor.size*.52);
      if(c.right-c.left>span){y=candidateY;corridor=c;span=c.right-c.left;}
     }
    }
    const side:(-1|1)=solo?(e.lane<.5?-1:1):(i%2===0?-1:1);
    actor.x=solo?(corridor.left+corridor.right)/2+side*Math.min(26,span*.16):(side<0?corridor.left+span*.16:corridor.right-span*.16);
    actor.y=y;
    actor.navigation={worldY:y-this.scroll,heading:side<0?Math.PI/2:-Math.PI/2,entry:0,phase:'hold'};
    actor.submarine={phase:'emerge',exposure:0,side};actor.cooldown=1.6+i*.3;
   }else if(this.up&&ground){const occupied=new Set([...this.enemies.map(actor=>actor.navigation?.anchor),...this.wrecks.map(w=>w.anchor)].filter((id):id is number=>id!==undefined));prepareSurface(this.enemies[this.enemies.length-1],this.scroll,family==='boat'?(e.formation==='solo'?0:(i%2===0?-1:1)):0,occupied);}
  });
 }
 private updateEnemies(dt:number):void{
  for(const e of this.enemies){if(e.hp<=0)continue;e.age+=dt;e.flash=Math.max(0,e.flash-dt);const t=e.age;
   let advance=e.speed,cross=0;
   switch(e.motion){case'sine':cross=Math.sin(t*2.6+e.offset)*26;break;case'curve':cross=Math.sin(t*1.25+e.offset)*58;break;case'zigzag':cross=2/Math.PI*Math.asin(Math.sin(t*2.8))*32;break;case'diagonal':cross=(e.lane<(this.up?384:216)?1:-1)*t*36;break;case'turn':cross=Math.sin(Math.min(Math.PI,t*1.05))*66;advance=t>3.2?-42:e.speed*1.08;break;case'dive':advance=e.speed*1.1+Math.min(175,t*t*32);cross=Math.sin(t*2.2)*32;break;case'accelerate':advance=e.speed*.85+Math.min(155,t*42);break;case'retreat':advance=t>3.8?-65:e.speed*.9;cross=Math.sin(t*1.6)*16;break;case'stationary':advance=t<1.8?62:16;break;}
   if(e.submarine){
    const sub=e.submarine;sub.phase=t<1.2?'emerge':t<8.2?'hold':'submerge';
    sub.exposure=clamp(t<1.2?t/1.2:t<8.2?1:1-(t-8.2)/1.2,0,1);
    e.y=e.navigation!.worldY+this.scroll;
   }else if(this.up&&e.ground)moveSurface(e,this.scroll,dt);
   else if(this.up){advance=Math.max(this.scrollSpeed+16,advance);e.y+=advance*dt;e.x=clamp(e.lane+cross,this.arena.left+12,this.arena.right-12);}else{e.x-=Math.max(32,advance)*dt;e.y=clamp(e.lane+cross,this.arena.top+12,this.arena.bottom-12);}
   e.cooldown-=dt;e.warning=e.cooldown<.6&&e.cooldown>0?1-e.cooldown/.6:0;
   if(e.cooldown<=0&&(!e.submarine||e.submarine.phase==='hold')&&e.x>this.arena.left&&e.x<this.arena.right&&e.y>this.arena.top&&e.y<this.arena.bottom){
    const behind=this.up?e.y>this.player.y-28:e.x<this.player.x+28;
    if(!behind){const mount=e.submarine?{x:e.x,y:e.y}:this.up&&e.ground?surfaceMount(e):{x:e.x,y:e.y+(e.ground?-e.size*.09:0)},aim=Math.atan2(this.player.y-mount.y,this.player.x-mount.x),angles=e.family==='bomber'?[-.28,0,.28]:e.family==='ship'||e.submarine?[-.16,.16]:[0];const muzzle=e.ground?e.size*.2:5,shot=ENEMY_SHOTS[e.family];for(const a of angles)this.hostile(mount.x+Math.cos(aim)*muzzle,mount.y+Math.sin(aim)*muzzle,aim+a,shot.speed+(this.hard?25:0),shot.radius,shot.color);this.emit('enemy-shot',e.x,e.y);}
    e.cooldown=FAMILY[e.family].fire*(this.hard?.78:1);
   }
   if(!e.ground&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<e.size*.28+7)this.hurtPlayer();
  }
  this.enemies=this.enemies.filter(e=>e.hp>0&&(!e.submarine||e.age<9.4)&&(e.navigation?.anchor!==undefined||e.age<23)&&e.y<470&&(e.navigation?.anchor!==undefined||e.y>-160)&&e.x>-80&&e.x<930);
 }
 private bullet(x:number,y:number,vx:number,vy:number,damage:number,radius:number,enemy=false,missile=false,scale=1,homing=false,color?:number):void{
  const b=this.bullets.find(b=>!b.active);if(!b)return;
  Object.assign(b,{active:true,x,y,px:x,py:y,vx,vy,damage,radius,enemy,missile,scale,homing,age:0,color:color??(radius>7?2:radius>4?1:0)});
 }
 private firePrimary():void{
  for(const p of getPrimaryProjectiles('nolan',this.weapons.weaponLevel,0,0)){
   const x=this.player.x+(this.up?p.x:17-p.y),y=this.player.y+(this.up?p.y-15:p.x);
   this.bullet(x,y,this.up?p.velocityX:-p.velocityY,this.up?p.velocityY:p.velocityX,p.damage,3.6,false,false,p.scale);
  }this.emit('shot');
 }
 private fireMissiles():void{for(const p of getSecondaryProjectiles('nolan',0,0,this.weapons.weaponLevel))this.bullet(this.player.x+(this.up?p.x:-p.y),this.player.y+(this.up?p.y:p.x),this.up?p.velocityX:-p.velocityY,this.up?p.velocityY:p.velocityX,p.damage,p.hitRadius,false,true,p.scale,p.homing);this.emit('missile');}
 private hostile(x:number,y:number,angle:number,speed:number,radius:number,color?:number):void{this.bullet(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,1,radius,true,false,1,false,color);}
 private updateBullets(dt:number):void{
  for(const b of this.bullets){if(!b.active)continue;b.px=b.x;b.py=b.y;b.age+=dt;
   if(b.homing){const targets=[...this.enemies.filter(e=>e.hp>0&&e.x>=this.arena.left&&e.x<=this.arena.right&&e.y>=this.arena.top&&e.y<=this.arena.bottom&&(!e.submarine||e.submarine.exposure>=.6)),...(this.boss?.parts.filter(p=>p.hp>0)??[])];let best:typeof targets[number]|undefined,d=Infinity;for(const e of targets){const distance=Math.hypot(e.x-b.x,e.y-b.y);if(distance<d){d=distance;best=e;}}if(best){const a=Math.atan2(best.y-b.y,best.x-b.x);b.vx+=(Math.cos(a)*330-b.vx)*dt*4;b.vy+=(Math.sin(a)*330-b.vy)*dt*4;}}
   b.x+=b.vx*dt;b.y+=b.vy*dt;
   if(b.enemy){if(this.bomb?.phase==='blast'&&Math.hypot(b.x-this.bomb.x,b.y-this.bomb.y)<this.bomb.radius){b.active=false;continue;}if(sweepEllipse(b.px,b.py,b.x,b.y,this.player.x,this.player.y,5+b.radius,7+b.radius)!==null){b.active=false;this.hurtPlayer();}}
   else this.collideFriendly(b);
   if(b.age>9||b.x<this.arena.left-35||b.x>this.arena.right+35||b.y<this.arena.top-60||b.y>this.arena.bottom+40)b.active=false;
  }
 }
 private collideFriendly(b:Bullet):void{
  let nearest=Infinity;let target:Actor|Component|Cargo|Obstacle|Boss|undefined;
  for(const e of this.enemies){if(e.hp<=0||(e.submarine&&e.submarine.exposure<.6)||Math.abs(e.x-b.x)>e.size||Math.abs(e.y-b.y)>e.size+40)continue;const t=this.contact?this.contact(e,b.px,b.py,b.x,b.y,b.radius):sweepEllipse(b.px,b.py,b.x,b.y,e.x,e.y,e.size*.32+b.radius,e.size*.37+b.radius);if(t!==null&&t<nearest){nearest=t;target=e;}}
  if(this.boss?.phase==='fight'){
   const boss=this.boss,t=this.bossContact?this.bossContact(boss,b.px,b.py,b.x,b.y,b.radius):sweepEllipse(b.px,b.py,b.x,b.y,boss.x,boss.y,boss.size*.43+b.radius,boss.size*(this.up?.37:.29)+b.radius);
   if(t!==null&&t<nearest){nearest=t;target=boss;}
  }
  for(const c of this.cargo){if(!c.crate)continue;const t=sweepEllipse(b.px,b.py,b.x,b.y,c.x,c.y,12+b.radius,12+b.radius);if(t!==null&&t<nearest){nearest=t;target=c;}}
  for(const o of this.obstacles){if(o.kind!=='barrier'||o.hp<=0)continue;const t=sweepEllipse(b.px,b.py,b.x,b.y,o.x,o.y,o.width/2+b.radius,o.height/2+b.radius);if(t!==null&&t<nearest){nearest=t;target=o;}}
  if(!target)return;b.x=b.px+(b.x-b.px)*nearest;b.y=b.py+(b.y-b.py)*nearest;b.active=false;
  if('parts'in target){this.damageBossAt(b.x,b.y,b.damage);}
  else if('crate'in target){target.hp-=b.damage;if(target.hp<=0){target.crate=false;target.age=0;target.vx=this.up?58:-58;target.vy=this.up?37:35;this.emit('explosion',target.x,target.y,.35);}}
  else if('kind'in target){target.hp-=b.damage;if(target.hp<=0)this.emit('explosion',target.x,target.y,1);}
  else this.damage(target,b.damage,b.x,b.y);
 }
 private damage(target:Actor|Component,amount:number,x:number,y:number):void{
  if(target.hp<=0)return;target.hp=Math.max(0,target.hp-amount);target.flash=.095;this.emit('impact',x,y,.3);
  if(target.hp===0){
   if('family'in target&&this.up&&target.navigation?.anchor!==undefined){
    this.wrecks.push({anchor:target.navigation.anchor,family:target.family==='tower'?'tower':'tank',id:target.id,x:target.x,y:target.y,worldY:target.y-this.scroll,size:target.size,age:0});
   }
   const size='family'in target?target.size/30:1.3;this.emit('explosion',x,y,size,'family'in target?target.family:undefined);this.score+='family'in target?FAMILY[target.family].score:1500;this.kills++;
  }
 }
 private updateWrecks(dt:number):void{
  for(const wreck of this.wrecks){wreck.age+=dt;wreck.y=wreck.worldY+this.scroll;}
  // Smoke has headroom above its base; recycle only once the entire remnant has passed the bottom.
  this.wrecks=this.wrecks.filter(wreck=>wreck.y-wreck.size*2<432);
 }
 /** Every hull point belongs to one of three physical weapon sectors. */
 private damageBossAt(x:number,y:number,amount:number):void{
  const boss=this.boss;if(!boss||boss.phase!=='fight')return;
  const sector=(dx:number)=>dx<-boss.size*.065?-1:dx>boss.size*.065?1:0;
  const hitSector=sector(x-boss.x),local=boss.parts.filter(p=>sector(p.dx)===hitSector&&p.hp>0);
  boss.flash=.095;
  if(local.length){const target=local.sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y))[0];this.damage(target,amount,x,y);}
  else{
   const remaining=boss.parts.filter(p=>p.hp>0);if(!remaining.length)return;
   const reduced=amount*.25/remaining.length;
   for(const target of remaining)this.damage(target,reduced,x,y);
  }
 }
 private applySpecial(dt:number):void{
  const bomb=this.bomb;if(!bomb)return;
  const before=bomb.age;bomb.age+=dt;
  if(bomb.phase==='flight'){
   const travel=Math.min(dt,Math.max(0,.65-before))*280;
   if(this.up)bomb.y=Math.max(this.arena.top+65,bomb.y-travel);else bomb.x=Math.min(this.arena.right-65,bomb.x+travel);
   if(bomb.age>=.65){bomb.phase='blast';this.emit('explosion',bomb.x,bomb.y,3);}
  }
  if(bomb.phase==='blast'){
   const age=bomb.age-.65,blastDt=Math.min(dt,Math.max(0,bomb.age-.65));
   bomb.radius=(this.up?155:180)*Math.min(1,age/.35);this.specialImpact={x:bomb.x,y:bomb.y};
   for(const target of this.enemies){
    if(target.hp<=0||(target.submarine&&target.submarine.exposure<.6))continue;
    const d=Math.hypot(target.x-bomb.x,target.y-bomb.y);
    if(d<bomb.radius+target.size*.3)this.damage(target,90*blastDt,target.x,target.y);
   }
   if(this.boss?.phase==='fight')for(const target of this.boss.parts){
    if(target.hp>0&&Math.hypot(target.x-bomb.x,target.y-bomb.y)<bomb.radius+target.radius)this.damage(target,90*blastDt,target.x,target.y);
   }
   for(const shot of this.bullets)if(shot.active&&shot.enemy&&Math.hypot(shot.x-bomb.x,shot.y-bomb.y)<bomb.radius)shot.active=false;
  }
  if(bomb.age>=2.75){this.bomb=undefined;this.specialTime=0;}
 }
 private hurtPlayer():void{
  if(this.player.invulnerable>0||this.specialTime>0||this.state!=='play')return;
  this.lives--;this.deaths++;this.emit('death');this.emit('explosion',this.player.x,this.player.y,1.2);
  if(this.weapons.weaponLevel>1||this.weapons.powerMeter>0)this.cargo.push({id:++this.sequence,x:this.player.x,y:this.player.y-20,vx:55,vy:-35,kind:'power',crate:false,hp:1,age:0});
  this.weapons.weaponLevel=1;this.weapons.powerMeter=0;this.specialTime=0;this.bomb=undefined;this.burst.reset();this.player.invulnerable=3;
  if(this.lives<=0){this.state='defeat';this.emit('defeat');return;}
  this.player.x=this.up?384:80;this.player.y=this.up?375:230;
  for(const b of this.bullets)if(b.enemy&&Math.hypot(b.x-this.player.x,b.y-this.player.y)<75)b.active=false;
 }
 private updateCargo(dt:number):void{
  for(const c of this.cargo){c.age+=dt;c.x+=c.vx*dt;c.y+=c.vy*dt;
   if(!c.crate){if(c.x<this.arena.left+12||c.x>this.arena.right-12){c.vx*=-1;c.x=clamp(c.x,this.arena.left+12,this.arena.right-12);}if(c.y<this.arena.top+18||c.y>this.arena.bottom-12){c.vy*=-1;c.y=clamp(c.y,this.arena.top+18,this.arena.bottom-12);}
    if(Math.hypot(c.x-this.player.x,c.y-this.player.y)<22){if(c.kind==='power'){const result=collectPowerItem(this.weapons);this.weapons=result.state;this.score+=result.meterIncreased?100:5000;}else if(c.kind==='life'){this.score+=this.lives===5?5000:250;this.lives=Math.min(5,this.lives+1);}else{this.score+=this.weapons.specialCharges===5?5000:250;this.weapons.specialCharges=Math.min(5,this.weapons.specialCharges+1);}c.age=100;this.collected++;this.emit('pickup',c.x,c.y,1,c.kind);}
   }else if(this.up&&(c.x<this.arena.left+20||c.x>this.arena.right-20))c.vx*=-1;
  }this.cargo=this.cargo.filter(c=>c.age<(c.crate?23:24)&&c.y<465&&c.x>this.arena.left-60);
 }
 private startBoss(mini:boolean):void{
  const boss:Boss={mini,x:this.up?384:820,y:this.up?-140:215,size:mini?(this.up?132:175):(this.up?216:310),age:0,phase:'enter',configuration:1,timer:0,attack:0,attackTime:0,volley:0,aimX:384,aimY:370,parts:[]};
  this.boss=boss;this.installParts(boss,3);this.emit(mini?'mini':'boss',0,0,1,mini?'PATRULHA PESADA':this.mission.boss);
 }
 private installParts(b:Boss,count:number):void{
  // Sockets are registered to the painted atlas, not distributed over an arbitrary circle.
  const mounts=this.up?(count===6?[[-.143,.015],[0,.015],[.143,.015],[-.143,.17],[0,.17],[.143,.17]]:b.mini?[[-.19,0],[.19,0],[0,.135]]:[[-.17,.07],[.17,.07],[0,.14]]):[[-.24,.23],[-.04,.23],[.16,.23]];
  b.parts=mounts.map(([mx,my])=>{const dx=mx*b.size,dy=my*b.size,hp=b.mini?95:this.up?(b.configuration===1?200:90):200;return{id:++this.sequence,x:b.x+dx,y:b.y+dy,dx,dy,hp,maxHp:hp,radius:b.mini?10:13,flash:0,warning:0,angle:this.up?Math.PI/2:Math.PI};});
 }
 private updateBoss(dt:number):void{
  const b=this.boss;if(!b)return;b.age+=dt;b.timer+=dt;b.flash=Math.max(0,(b.flash??0)-dt);
  if(b.phase==='enter'||b.phase==='return'){
   const t=clamp(b.timer/2.5,0,1),ease=1-(1-t)**3;
   if(this.up){b.x=384;b.y=-170+ease*(b.mini?300:b.configuration===1?336:350);}else{b.x=830-ease*250;b.y=215;}
   if(t>=1){b.phase='fight';b.timer=0;}
  }else if(b.phase==='retreat'){
   if(this.up)b.y-=85*dt;else b.x+=85*dt;
   if(b.timer>2.8){b.phase='absent';b.timer=0;this.emit('radio',0,0,1,'Ei... aquilo está voltando por baixo!');}
  }else if(b.phase==='absent'){
   if(b.timer>=5){b.configuration=2;b.size=this.up?236:324;b.phase='return';b.timer=0;this.installParts(b,6);this.emit('return');}
  }else if(b.phase==='sink'){
   if(b.timer<.42&&Math.floor(b.timer*10)!==Math.floor((b.timer-dt)*10))this.emit('explosion',b.x+Math.sin(b.timer*31)*b.size*.3,b.y+Math.cos(b.timer*23)*b.size*.25,b.mini?1.2:1.6);
   if(b.timer>.75){const mini=b.mini;this.boss=undefined;this.clearHostileBullets();if(!mini){this.state='exit';this.exitTime=0;this.specialTime=0;this.bomb=undefined;this.cargo=[];this.enemies=[];this.obstacles=[];for(const shot of this.bullets)shot.active=false;this.score+=10000+this.lives*1000;this.emit('victory');}else{this.score+=3000;this.emit('radio',0,0,1,this.up?'A pista está livre. Próxima parada: a fenda!':'Patrulha vencida! Vamos ao distrito das cores!');}}return;
  }else{
   if(this.up)b.x=384+Math.sin(b.age*.65)*14;else b.y=210+Math.sin(b.age*.65)*65;
   const alive=b.parts.filter(p=>p.hp>0);
   if(!alive.length){if(!b.mini&&this.up&&b.configuration===1){b.phase='retreat';b.timer=0;this.clearHostileBullets();this.emit('explosion',b.x,b.y,2);}else{b.phase='sink';b.timer=0;this.clearHostileBullets();this.emit('explosion',b.x,b.y,b.mini?2.5:3.3);for(const a of [.55,2.15,3.7,5.25]){const r=b.size*.34;this.emit('explosion',b.x+Math.cos(a)*r,b.y+Math.sin(a)*r*.75,b.mini?1.5:2);}}return;}
   b.attackTime+=dt;const warning=b.attack%4===3?1.35:.8,shootEnd=warning+(b.attack%4===2?1.2:.65),cycle=shootEnd+(b.mini?1.2:1.05);
   if(b.attackTime<warning){for(const [i,p] of alive.entries()){const active=b.attack%4===3?i===b.attack%alive.length:alive.length<=2||i%2===b.attack%2;p.warning=active?b.attackTime/warning:0;}b.aimX=this.player.x;b.aimY=this.player.y;}
   else if(b.attackTime<shootEnd){const volley=Math.floor((b.attackTime-warning)/.3);if(volley>=b.volley){b.volley=volley+1;this.bossVolley(b,alive,volley);}for(const p of alive)p.warning=0;}
   if(b.attackTime>=cycle){b.attack++;b.attackTime=0;b.volley=0;}
  }
  for(const p of b.parts){p.x=b.x+p.dx;p.y=b.y+p.dy;p.flash=Math.max(0,p.flash-dt);p.angle=b.attack%4===0?(this.up?Math.PI/2:Math.PI):Math.atan2(b.aimY-p.y,b.aimX-p.x);}
 }
 private bossVolley(b:Boss,parts:Component[],volley:number):void{
  const forward=this.up?Math.PI/2:Math.PI,pattern=b.attack%4;
  parts.forEach((p,i)=>{if(i%2!==b.attack%2&&parts.length>2&&pattern!==3)return;
   const aim=Math.atan2(b.aimY-p.y,b.aimX-p.x),mx=p.x+Math.cos(pattern===0?forward:aim)*p.radius*1.1,my=p.y+Math.sin(pattern===0?forward:aim)*p.radius*1.1;
   if(!this.up){
    // Giro builds moving horizontal lanes; Pula-Onda owns the radial naval pattern below.
    if(pattern===0)for(const a of[-.32,0,.32])this.hostile(mx,my,forward+a+(volley-1)*.08,102+(this.hard?20:0),4.4);
    else if(pattern===1)for(const a of[-.13,.13])this.hostile(mx,my,aim+a,145+volley*12,3.8);
    else if(pattern===2)for(const a of[-.09,.09])this.hostile(mx,my,aim+Math.sin(volley*1.7)*.24+a,170,3.3);
    else if(i===b.attack%parts.length)for(const a of[-.28,0,.28])this.hostile(mx,my,aim+a,88+volley*8,9.5);
    return;
   }
   if(pattern===0){for(const a of[-.48,-.24,0,.24,.48])this.hostile(mx,my,forward+a,125+(this.hard?20:0),4.4);}
   else if(pattern===1){for(const a of[-.10,.10])this.hostile(mx,my,aim+a,155+(this.hard?25:0),3.8);}
   else if(pattern===2)this.hostile(mx,my,aim+(volley-1)*.16,180,3.3);
   else if(i===b.attack%parts.length){for(let j=0;j<12;j++)this.hostile(mx,my,TAU*j/12+volley*.14,105,8.5);}
  });this.emit('enemy-shot',b.x,b.y);
 }
 private spawnObstacle():void{
  const bottom=Math.floor(this.nextObstacle)%2===0,h=this.nextObstacle<140?106:85;
  this.obstacles.push({id:++this.sequence,x:820,y:bottom?414-h/2:40+h/2,width:80,height:h,kind:bottom?'roof':'gate',warning:1.5,hp:Infinity,age:0});
  if(this.nextObstacle>108&&this.nextObstacle<135)this.obstacles.push({id:++this.sequence,x:900,y:bottom?72:372,width:140,height:64,kind:bottom?'gate':'roof',warning:1.5,hp:Infinity,age:0});
  if(this.nextObstacle>200)this.obstacles.push({id:++this.sequence,x:940,y:220,width:32,height:58,kind:'barrier',warning:1.5,hp:8,age:0});
 }
 private updateObstacles(dt:number):void{for(const o of this.obstacles){o.age+=dt;o.warning=Math.max(0,o.warning-dt);o.x-=42*dt;if(o.kind==='gate')o.y=70+Math.sin(o.age*.7)*16;if(o.warning<=0&&o.hp>0&&Math.abs(this.player.x-o.x)<o.width/2+5&&Math.abs(this.player.y-o.y)<o.height/2+6)this.hurtPlayer();}this.obstacles=this.obstacles.filter(o=>o.x>-80&&o.hp>0);}
 private clearHostileBullets():void{for(const b of this.bullets)if(b.enemy)b.active=false;}
}

