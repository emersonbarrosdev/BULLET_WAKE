import test from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeWorld} from '../src/game/arcade/ArcadeWorld.ts';
import {MISSIONS,ENEMY_SHOTS} from '../src/game/arcade/content.ts';
import {touchesCoast} from '../src/game/arcade/PelagicEnvironment.ts';

const fixture=()=>{const w=new ArcadeWorld(MISSIONS[0]);w.state='play';w.waveIndex=999;w.supplyIndex=999;w.player.invulnerable=10000;return w;};

test('RIVET round projectiles keep the same physical size through all power levels',()=>{
 for(let level=1;level<=5;level++){
  const w=fixture();w.weapons.weaponLevel=level;w.firePrimary();
  const bullets=w.bullets.filter(b=>b.active);assert(bullets.length>0);
  assert(bullets.every(b=>b.radius===3.6));
 }
});

test('native boss silhouette rejection does not fall back to a rectangular or elliptical hit',()=>{
 const w=fixture();w.startBoss(false);w.boss.phase='fight';w.boss.x=384;w.boss.y=160;w.updateBoss(.01);
 w.bossContact=()=>null;
 const hp=w.boss.parts.map(p=>p.hp);
 w.bullet(384,220,0,-500,10,3.6);w.updateBullets(.05);
 assert.deepEqual(w.boss.parts.map(p=>p.hp),hp);
 assert(w.bullets.some(b=>b.active));
});

test('turning and withdrawing aircraft keep forward motion at every region and scroll speed',()=>{
 for(const motion of['turn','retreat','stationary','straight'])for(const scrollSpeed of[0,16,38,85]){
  const w=fixture();w.scrollSpeed=scrollSpeed;w.spawnEncounter({family:'bomber',formation:'solo',motion,lane:.5});
  const e=w.enemies[0];
  for(let frame=0;frame<600;frame++){
   e.y=120; // Exercise the late turn/retreat state before offscreen culling.
   const before=e.y;w.updateEnemies(1/60);
   assert(e.y-before>scrollSpeed/60,'aircraft must not drift backward relative to the scenery');
  }
 }
 const w=fixture();w.route=135;for(let i=0;i<600;i++)w.step(1/120);
 assert(w.scrollSpeed<=38,'approach to the mini boss must not accelerate the coast');
});

test('aircraft keep a fixed bullet size and family color across repeated volleys',()=>{
 for(const family of['fighter','interceptor','acrobat','bomber','alien','airship']){
  const w=fixture();w.spawnEncounter({family,formation:'solo',motion:'straight',lane:.5});
  const e=w.enemies[0];e.y=120;e.cooldown=0;
  w.updateEnemies(.01);const first=w.bullets.filter(b=>b.active&&b.enemy).map(b=>({...b}));
  assert(first.length>0);w.bullets.forEach(b=>b.active=false);e.cooldown=0;w.updateEnemies(.01);
  const second=w.bullets.filter(b=>b.active&&b.enemy),spec=ENEMY_SHOTS[family];
  for(const b of[...first,...second]){assert.equal(b.radius,spec.radius);assert.equal(b.color,spec.color);assert(Math.abs(Math.hypot(b.vx,b.vy)-spec.speed)<1e-8);}
 }
 assert(ENEMY_SHOTS.fighter.radius<ENEMY_SHOTS.bomber.radius);
 assert(new Set(['fighter','interceptor','acrobat'].map(f=>ENEMY_SHOTS[f].color)).size===3);
});

test('submarines emerge on opposite sides, hold position in the water, fire and submerge',()=>{
 for(const scroll of[0,650,1300,2100,4700]){
  const w=fixture();w.scroll=scroll;w.spawnEncounter({family:'submarine',formation:'pair',motion:'stationary',lane:.5});
  const pair=[...w.enemies];assert.deepEqual(pair.map(e=>e.submarine.side),[-1,1]);
  const starts=pair.map(e=>({x:e.x,y:e.y,worldY:e.navigation.worldY}));
  assert(pair.every(e=>e.submarine.phase==='emerge'&&e.submarine.exposure===0));
  for(let i=0;i<60;i++)w.updateEnemies(1/60);
  assert.equal(w.bullets.filter(b=>b.active).length,0,'submerged hulls must not shoot');
  for(let i=0;i<120;i++)w.updateEnemies(1/60);
  assert(w.bullets.some(b=>b.active&&b.enemy));
  pair.forEach((e,i)=>{assert.equal(e.submarine.phase,'hold');assert.equal(e.x,starts[i].x);assert.equal(e.y,starts[i].y);assert(!touchesCoast(e.x,e.navigation.worldY,e.size*.3));});
  w.scroll+=24;w.updateEnemies(.01);pair.forEach((e,i)=>assert.equal(e.y,starts[i].y+24));
  for(let i=0;i<650;i++)w.updateEnemies(1/60);
  assert(w.enemies.every(e=>e.family!=='submarine'));
 }
});

test('final boss defeat flies upward automatically even with contrary movement input',()=>{
 const w=fixture();w.startBoss(false);w.boss.phase='sink';w.boss.timer=2.6;w.updateBoss(.01);
 const before=w.player.y;for(let i=0;i<410;i++)w.step(1/120,{x:0,y:1,fire:true,special:true});
 assert.equal(w.state,'victory');assert(w.player.y<before&&w.player.y<0);assert(w.bullets.every(b=>!b.active));
});
