import {BurstController} from './BurstController.ts';
import {FAMILY,formationOffsets,regionAt,SUPPLIES,type Mission,type Family,type Motion} from './content.ts';
import {clamp,sweepEllipse,type Box} from './geometry.ts';
import {collectPowerItem,createPlayerWeapons,getPrimaryProjectiles,getSecondaryProjectiles,type PlayerWeaponsState} from '../systems/weaponSystem.ts';
import {enterStage,type CampaignFlight} from '../systems/campaignFlight.ts';
import {prepareSurface,moveSurface,surfaceMount,type SurfaceRoute} from './PelagicEnvironment.ts';

export interface Controls {x:number;y:number;fire:boolean;special:boolean;}
export interface Actor {id:number;x:number;y:number;size:number;hp:number;maxHp:number;age:number;flash:number;family:Family;motion:Motion;lane:number;offset:number;speed:number;cooldown:number;warning:number;ground:boolean;navigation?:SurfaceRoute;}
export interface Bullet {active:boolean;x:number;y:number;px:number;py:number;vx:number;vy:number;damage:number;radius:number;enemy:boolean;missile:boolean;homing:boolean;age:number;scale:number;color:number;}
export interface Cargo {id:number;x:number;y:number;vx:number;vy:number;kind:'power'|'life'|'special';crate:boolean;hp:number;age:number;}
export interface Component {id:number;x:number;y:number;dx:number;dy:number;hp:number;maxHp:number;radius:number;flash:number;warning:number;angle:number;}
export interface Boss {mini:boolean;x:number;y:number;size:number;age:number;phase:'enter'|'fight'|'retreat'|'absent'|'return'|'sink';configuration:number;timer:number;attack:number;attackTime:number;volley:number;aimX:number;aimY:number;parts:Component[];}
export interface Obstacle {id:number;x:number;y:number;width:number;height:number;kind:'roof'|'gate'|'barrier';warning:number;hp:number;age:number;}
export interface WorldEvent {type:'shot'|'missile'|'enemy-shot'|'impact'|'explosion'|'pickup'|'death'|'special'|'boss'|'return'|'mini'|'victory'|'defeat'|'radio';x:number;y:number;size?:number;text?:string;}
export type ContactQuery=(actor:Actor,ax:number,ay:number,bx:number,by:number,radius:number)=>number|null;
const TAU=Math.PI*2;
const BASE_CONTROL:Controls={x:0,y:0,fire:false,special:false};
/** Fixed-step deterministic simulation. Rendering quality never enters these rules. */
export class ArcadeWorld {
 readonly arena:Box;readonly bullets:Bullet[]=Array.from({length:640},()=>({active:false,x:0,y:0,px:0,py:0,vx:0,vy:0,damage:0,radius:0,enemy:false,missile:false,homing:false,age:0,scale:1,color:0}));
 enemies:Actor[]=[];cargo:Cargo[]=[];obstacles:Obstacle[]=[];boss?:Boss;events:WorldEvent[]=[];
 weapons:PlayerWeaponsState=createPlayerWeapons('nolan');lives=3;score=0;kills=0;deaths=0;collected=0;elapsed=0;route=0;scroll=0;scrollSpeed=38;region=0;player={x:384,y:368,invulnerable:2.5,bank:0};
 state:'intro'|'play'|'exit'|'victory'|'defeat'='intro';introTime=2.2;exitTime=0;specialTime=0;missileTime=0;specialEdge=false;specialImpact?:{x:number;y:number};
 contact?:ContactQuery;accessibility=false;hard=false;
 private burst=new BurstController();private sequence=0;private waveIndex=0;private supplyIndex=0;private miniStarted=false;private bossStarted=false;private nextObstacle=98;
 readonly mission:Mission;
 constructor(mission:Mission,carry?:CampaignFlight){
  this.mission=mission;
  this.arena=mission.perspective==='UP'?{left:208,right:560,top:38,bottom:420}:{left:16,right:752,top:40,bottom:414};
  const restored=enterStage('nolan',mission.id,carry);this.weapons=restored.weapons;this.lives=restored.health.lives;this.score=restored.score;
  this.player.x=this.up?384:100;this.player.y=this.up?376:228;
 }
 get up():boolean{return this.mission.perspective==='UP';}
 emit(type:WorldEvent['type'],x=this.player.x,y=this.player.y,size=1,text?:string):void{this.events.push({type,x,y,size,text});}
 step(seconds:number,input:Controls=BASE_CONTROL):void{
  const dt=clamp(seconds,0,.05);if(this.state==='victory'||this.state==='defeat')return;
  if(this.state==='intro'){this.introTime-=dt;this.scroll+=25*dt;if(this.introTime<=0){this.state='play';this.emit('radio',0,0,1,this.up?'Mar aberto. Vamos abrir caminho!':'Cidade Solar, a RIVET chegou!');}return;}
  if(this.state==='exit'){this.exitTime+=dt;this.scroll+=30*dt;if(this.up)this.player.y-=130*dt;else this.player.x+=250*dt;if(this.exitTime>=3.4)this.state='victory';return;}
  this.elapsed+=dt;this.route=Math.min(300,this.route+dt);this.region=regionAt(this.route);
  this.player.invulnerable=Math.max(0,this.player.invulnerable-dt);
  const n=Math.max(1,Math.hypot(input.x,input.y)),speed=174;
  this.player.x=clamp(this.player.x+input.x/n*speed*dt,this.arena.left+14,this.arena.right-14);
  this.player.y=clamp(this.player.y+input.y/n*speed*dt,this.arena.top+16,this.arena.bottom-15);
  this.player.bank+=((this.up?input.x:-input.y)-this.player.bank)*Math.min(1,dt*12);
  for(let i=this.burst.update(dt*1000,input.fire,this.accessibility);i>0;i--)this.firePrimary();
  this.missileTime-=dt;if(input.fire&&this.weapons.weaponLevel>=3&&this.missileTime<=0){this.fireMissiles();this.missileTime=this.weapons.weaponLevel===5?1.1:1.5;}
  if(input.special&&!this.specialEdge&&this.weapons.specialCharges>0&&this.specialTime<=0){this.weapons.specialCharges--;this.specialTime=3;this.emit('special');}
  this.specialEdge=input.special;
  if(this.specialTime>0){this.specialTime=Math.max(0,this.specialTime-dt);this.specialImpact=undefined;this.applySpecial(dt);}
  while(this.waveIndex<this.mission.encounters.length&&this.route>=this.mission.encounters[this.waveIndex].at){const e=this.mission.encounters[this.waveIndex++];if(e.at!==155){this.spawnEncounter(e);if(this.hard&&e.formation==='solo'&&e.family!=='tower')this.spawnEncounter({...e,family:'interceptor',formation:'pair',motion:'curve',lane:1-e.lane});}}
  while(this.supplyIndex<SUPPLIES.length&&this.route>=SUPPLIES[this.supplyIndex].at){const c=SUPPLIES[this.supplyIndex++];const lane=.25+(this.supplyIndex%3)*.24;this.cargo.push({id:++this.sequence,x:this.up?this.arena.left+lane*352:this.arena.right+15,y:this.up?-25:85+lane*250,vx:this.up?20:-32,vy:this.up?25:0,kind:c.kind,crate:true,hp:3,age:0});}
  if(this.route>=155&&!this.miniStarted){this.miniStarted=true;this.startBoss(true);}
  if(this.route>=300&&!this.bossStarted&&!this.boss){this.bossStarted=true;this.enemies=[];this.clearHostileBullets();this.startBoss(false);}
  if(!this.up&&this.route>=this.nextObstacle&&this.route<270){this.spawnObstacle();this.nextObstacle+=this.route<135?12:33;}
  let targetScroll=this.region===3?85:38;
  if(this.boss&&!this.boss.mini)targetScroll=this.boss.phase==='absent'?20:0;
  else if(this.boss)targetScroll=16;
  this.scrollSpeed+=(targetScroll-this.scrollSpeed)*Math.min(1,dt*1.5);this.scroll+=this.scrollSpeed*dt;
  this.updateEnemies(dt);this.updateBoss(dt);this.updateCargo(dt);this.updateObstacles(dt);this.updateBullets(dt);
 }
 private spawnEncounter(e:Mission['encounters'][number]):void{
  formationOffsets(e.formation).forEach(([offset,delay],i)=>{
   const family=e.formation==='escort'&&i>0?'fighter':e.family;const def=FAMILY[family];const ground=(this.up?['boat','ship','tank','tower']:['tank','tower']).includes(family);
   const lane=clamp(e.lane+offset,.09,.91),cross=this.up?this.arena.left+lane*352:ground?390:this.arena.top+lane*350;
   this.enemies.push({id:++this.sequence,x:this.up?cross:800-delay*220,y:this.up?-30+delay*220:cross,size:def.size,hp:def.hp,maxHp:def.hp,age:0,flash:0,family,motion:e.motion,lane:cross,offset:i*.7,speed:e.speed??(family==='interceptor'?83:ground?24:52),cooldown:1.8+i*.22,warning:0,ground});
   if(this.up&&ground)prepareSurface(this.enemies[this.enemies.length-1],this.scroll,family==='boat'?(i%2===0?-1:1):0);
  });
 }
 private updateEnemies(dt:number):void{
  for(const e of this.enemies){e.age+=dt;e.flash=Math.max(0,e.flash-dt);const t=e.age;
   let advance=e.speed,cross=0;
   switch(e.motion){case'sine':cross=Math.sin(t*2+e.offset)*22;break;case'curve':cross=Math.sin(t*.85+e.offset)*55;break;case'zigzag':cross=2/Math.PI*Math.asin(Math.sin(t*2))*28;break;case'diagonal':cross=(e.lane<(this.up?384:216)?1:-1)*t*22;break;case'turn':cross=Math.sin(Math.min(Math.PI,t*.7))*64;advance=t>4?-42:56;break;case'dive':advance=35+Math.min(150,t*t*9);cross=Math.sin(t)*32;break;case'accelerate':advance=25+Math.min(130,t*12);break;case'retreat':advance=t>5?-65:30;cross=Math.sin(t)*15;break;case'stationary':advance=t<2?48:12;break;}
   if(this.up&&e.ground)moveSurface(e,this.scroll,dt);
   else if(this.up){e.y+=advance*dt;e.x=clamp(e.lane+cross,this.arena.left+12,this.arena.right-12);}else{e.x-=advance*dt;e.y=clamp(e.lane+cross,this.arena.top+12,this.arena.bottom-12);}
   e.cooldown-=dt;e.warning=e.cooldown<.6&&e.cooldown>0?1-e.cooldown/.6:0;
   if(e.cooldown<=0&&e.x>this.arena.left&&e.x<this.arena.right&&e.y>this.arena.top&&e.y<this.arena.bottom){
    const behind=this.up?e.y>this.player.y-28:e.x<this.player.x+28;
    if(!behind){const mount=this.up&&e.ground?surfaceMount(e):{x:e.x,y:e.y+(e.ground?-e.size*.09:0)},aim=Math.atan2(this.player.y-mount.y,this.player.x-mount.x),angles=e.family==='bomber'?[-.28,0,.28]:e.family==='ship'?[-.16,.16]:[0];const muzzle=e.ground?e.size*.2:5;for(const a of angles)this.hostile(mount.x+Math.cos(aim)*muzzle,mount.y+Math.sin(aim)*muzzle,aim+a,90+(this.hard?30:0)+(e.family==='interceptor'?35:0),e.ground?5:3.6);this.emit('enemy-shot',e.x,e.y);}
    e.cooldown=FAMILY[e.family].fire*(this.hard?.78:1);
   }
   if(!e.ground&&Math.hypot(e.x-this.player.x,e.y-this.player.y)<e.size*.28+7)this.hurtPlayer();
  }
  this.enemies=this.enemies.filter(e=>e.hp>0&&e.age<23&&e.y<470&&e.y>-160&&e.x>-80&&e.x<930);
 }
 private bullet(x:number,y:number,vx:number,vy:number,damage:number,radius:number,enemy=false,missile=false,scale=1,homing=false):void{
  const b=this.bullets.find(b=>!b.active);if(!b)return;
  Object.assign(b,{active:true,x,y,px:x,py:y,vx,vy,damage,radius,enemy,missile,scale,homing,age:0,color:radius>7?2:radius>4?1:0});
 }
 private firePrimary():void{
  for(const p of getPrimaryProjectiles('nolan',this.weapons.weaponLevel,0,0)){
   const x=this.player.x+(this.up?p.x:17-p.y),y=this.player.y+(this.up?p.y-15:p.x);
   this.bullet(x,y,this.up?p.velocityX:-p.velocityY,this.up?p.velocityY:p.velocityX,p.damage,p.hitRadius,false,false,p.scale);
  }this.emit('shot');
 }
 private fireMissiles():void{for(const p of getSecondaryProjectiles('nolan',0,0,this.weapons.weaponLevel))this.bullet(this.player.x+(this.up?p.x:-p.y),this.player.y+(this.up?p.y:p.x),this.up?p.velocityX:-p.velocityY,this.up?p.velocityY:p.velocityX,p.damage,p.hitRadius,false,true,p.scale,p.homing);this.emit('missile');}
 private hostile(x:number,y:number,angle:number,speed:number,radius:number):void{this.bullet(x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,1,radius,true);}
 private updateBullets(dt:number):void{
  for(const b of this.bullets){if(!b.active)continue;b.px=b.x;b.py=b.y;b.age+=dt;
   if(b.homing){const targets=[...this.enemies.filter(e=>e.hp>0),...(this.boss?.parts.filter(p=>p.hp>0)??[])];let best:typeof targets[number]|undefined,d=Infinity;for(const e of targets){const distance=Math.hypot(e.x-b.x,e.y-b.y);if(distance<d){d=distance;best=e;}}if(best){const a=Math.atan2(best.y-b.y,best.x-b.x);b.vx+=(Math.cos(a)*330-b.vx)*dt*4;b.vy+=(Math.sin(a)*330-b.vy)*dt*4;}}
   b.x+=b.vx*dt;b.y+=b.vy*dt;
   if(b.enemy){if(this.specialTime>0&&Math.hypot(b.x-this.player.x,b.y-this.player.y)<65){b.active=false;continue;}if(sweepEllipse(b.px,b.py,b.x,b.y,this.player.x,this.player.y,5+b.radius,7+b.radius)!==null){b.active=false;this.hurtPlayer();}}
   else this.collideFriendly(b);
   if(b.age>9||b.x<this.arena.left-35||b.x>this.arena.right+35||b.y<this.arena.top-60||b.y>this.arena.bottom+40)b.active=false;
  }
 }
 private collideFriendly(b:Bullet):void{
  let nearest=Infinity;let target:Actor|Component|Cargo|Obstacle|undefined;
  for(const e of this.enemies){if(e.hp<=0||Math.abs(e.x-b.x)>e.size||Math.abs(e.y-b.y)>e.size+40)continue;const t=this.contact?this.contact(e,b.px,b.py,b.x,b.y,b.radius):sweepEllipse(b.px,b.py,b.x,b.y,e.x,e.y,e.size*.32+b.radius,e.size*.37+b.radius);if(t!==null&&t<nearest){nearest=t;target=e;}}
  if(this.boss?.phase==='fight')for(const p of this.boss.parts){if(p.hp<=0)continue;const t=sweepEllipse(b.px,b.py,b.x,b.y,p.x,p.y,p.radius+b.radius,p.radius+b.radius);if(t!==null&&t<nearest){nearest=t;target=p;}}
  for(const c of this.cargo){if(!c.crate)continue;const t=sweepEllipse(b.px,b.py,b.x,b.y,c.x,c.y,12+b.radius,12+b.radius);if(t!==null&&t<nearest){nearest=t;target=c;}}
  for(const o of this.obstacles){if(o.kind!=='barrier'||o.hp<=0)continue;const t=sweepEllipse(b.px,b.py,b.x,b.y,o.x,o.y,o.width/2+b.radius,o.height/2+b.radius);if(t!==null&&t<nearest){nearest=t;target=o;}}
  if(!target)return;b.x=b.px+(b.x-b.px)*nearest;b.y=b.py+(b.y-b.py)*nearest;b.active=false;
  if('crate'in target){target.hp-=b.damage;if(target.hp<=0){target.crate=false;target.age=0;target.vx=this.up?58:-58;target.vy=this.up?37:35;this.emit('explosion',target.x,target.y,.35);}}
  else if('kind'in target){target.hp-=b.damage;if(target.hp<=0)this.emit('explosion',target.x,target.y,1);}
  else this.damage(target,b.damage,b.x,b.y);
 }
 private damage(target:Actor|Component,amount:number,x:number,y:number):void{
  if(target.hp<=0)return;target.hp=Math.max(0,target.hp-amount);target.flash=.095;this.emit('impact',x,y,.3);
  if(target.hp===0){const size='family'in target?target.size/30:1.3;this.emit('explosion',x,y,size,'family'in target?target.family:undefined);this.score+='family'in target?FAMILY[target.family].score:1500;this.kills++;}
 }
 private applySpecial(dt:number):void{
  const targets:(Actor|Component)[]=[...this.enemies.filter(e=>e.hp>0),...(this.boss?.phase==='fight'?this.boss.parts.filter(p=>p.hp>0):[])];
  const hit=targets.filter(e=>this.up?e.y<this.player.y&&Math.abs(e.x-this.player.x)<44:e.x>this.player.x&&Math.abs(e.y-this.player.y)<44).sort((a,b)=>this.up?b.y-a.y:a.x-b.x)[0];
  if(hit){this.specialImpact={x:hit.x,y:hit.y};this.damage(hit,40*dt,hit.x,hit.y);}
 }
 private hurtPlayer():void{
  if(this.player.invulnerable>0||this.specialTime>0||this.state!=='play')return;
  this.lives--;this.deaths++;this.emit('death');this.emit('explosion',this.player.x,this.player.y,1.2);
  if(this.weapons.weaponLevel>1||this.weapons.powerMeter>0)this.cargo.push({id:++this.sequence,x:this.player.x,y:this.player.y-20,vx:55,vy:-35,kind:'power',crate:false,hp:1,age:0});
  this.weapons.weaponLevel=1;this.weapons.powerMeter=0;this.specialTime=0;this.burst.reset();this.player.invulnerable=3;
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
  const boss:Boss={mini,x:this.up?384:820,y:this.up?-140:215,size:mini?(this.up?145:175):(this.up?286:310),age:0,phase:'enter',configuration:1,timer:0,attack:0,attackTime:0,volley:0,aimX:384,aimY:370,parts:[]};
  this.boss=boss;this.installParts(boss,3);this.emit(mini?'mini':'boss',0,0,1,mini?'PATRULHA PESADA':this.mission.boss);
 }
 private installParts(b:Boss,count:number):void{
  // Sockets are registered to the painted atlas, not distributed over an arbitrary circle.
  const mounts=this.up?(count===6?[[-.143,.015],[0,.015],[.143,.015],[-.143,.17],[0,.17],[.143,.17]]:b.mini?[[-.19,0],[.19,0],[0,.135]]:[[-.17,.07],[.17,.07],[0,.14]]):[[-.24,.23],[-.04,.23],[.16,.23]];
  b.parts=mounts.map(([mx,my])=>{const dx=mx*b.size,dy=my*b.size,hp=b.mini?95:this.up?(b.configuration===1?200:90):200;return{id:++this.sequence,x:b.x+dx,y:b.y+dy,dx,dy,hp,maxHp:hp,radius:b.mini?10:13,flash:0,warning:0,angle:this.up?Math.PI/2:Math.PI};});
 }
 private updateBoss(dt:number):void{
  const b=this.boss;if(!b)return;b.age+=dt;b.timer+=dt;
  if(b.phase==='enter'||b.phase==='return'){
   const t=clamp(b.timer/2.5,0,1),ease=1-(1-t)**3;
   if(this.up){b.x=384;b.y=-170+ease*(b.mini?300:b.configuration===1?354:375);}else{b.x=830-ease*250;b.y=215;}
   if(t>=1){b.phase='fight';b.timer=0;}
  }else if(b.phase==='retreat'){
   if(this.up)b.y-=85*dt;else b.x+=85*dt;
   if(b.timer>2.8){b.phase='absent';b.timer=0;this.emit('radio',0,0,1,'Ei... aquilo está voltando por baixo!');}
  }else if(b.phase==='absent'){
   if(b.timer>=5){b.configuration=2;b.size=324;b.phase='return';b.timer=0;this.installParts(b,6);this.emit('return');}
  }else if(b.phase==='sink'){
   if(Math.floor(b.timer*9)!==Math.floor((b.timer-dt)*9))this.emit('explosion',b.x+Math.sin(b.timer*31)*b.size*.3,b.y+Math.cos(b.timer*23)*b.size*.25,.6+b.timer*.12);
   if(b.timer>2.6){const mini=b.mini;this.boss=undefined;this.clearHostileBullets();if(!mini){this.state='exit';this.exitTime=0;this.specialTime=0;this.cargo=[];this.enemies=[];this.obstacles=[];for(const shot of this.bullets)shot.active=false;this.score+=10000+this.lives*1000;this.emit('victory');}else{this.score+=3000;this.emit('radio',0,0,1,this.up?'A pista está livre. Próxima parada: a fenda!':'Patrulha vencida! Vamos ao distrito das cores!');}}return;
  }else{
   if(this.up)b.x=384+Math.sin(b.age*.65)*20;else b.y=210+Math.sin(b.age*.65)*65;
   const alive=b.parts.filter(p=>p.hp>0);
   if(!alive.length){if(!b.mini&&this.up&&b.configuration===1){b.phase='retreat';b.timer=0;this.clearHostileBullets();this.emit('explosion',b.x,b.y,2);}else{b.phase='sink';b.timer=0;this.clearHostileBullets();}return;}
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
   if(pattern===0){for(const a of[-.48,-.24,0,.24,.48])this.hostile(mx,my,forward+a,90+(this.hard?20:0),4.4);}
   else if(pattern===1){for(const a of[-.10,.10])this.hostile(mx,my,aim+a,155+(this.hard?25:0),3.8);}
   else if(pattern===2)this.hostile(mx,my,aim+(volley-1)*.16,180,3.3);
   else if(i===b.attack%parts.length){for(let j=0;j<12;j++)this.hostile(mx,my,TAU*j/12+volley*.14,72,8.5);}
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

