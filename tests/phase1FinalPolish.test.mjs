import test from 'node:test';
import assert from 'node:assert/strict';
import {BossTalassarca,METAMORPHOSIS_MS} from '../src/game/systems/bosses/bossTalassarca.ts';
import {PilotRadio} from '../src/game/systems/pilotRadioSystem.ts';
import {DamageRegions} from '../src/game/systems/damageRegions.ts';
import {MusicCursor} from '../src/game/audio/MusicCursor.ts';
import {PILOTS,getPilot} from '../src/game/data/pilots.ts';
import {collectPowerItem,createPlayerWeapons} from '../src/game/systems/weaponSystem.ts';
import {continueWeapons} from '../src/game/systems/normalBalance.ts';
import {PickupSystem} from '../src/game/systems/pickupSystem.ts';
import {recoverArmament} from '../src/game/systems/recoverySystem.ts';

test('canonical cast order keeps the protagonist and Japanese secret pilot on their own kits',()=>{
 assert.deepEqual(PILOTS.map(p=>p.name),['Bayek','Tita','Leona','Osvald','Hien']);
 assert.equal(getPilot('nolan').shipName,'Rivet');assert.equal(getPilot('nolan').nationality,'Egípcio');
 assert.equal(getPilot('lyra').nationality,'Brasileira');assert.equal(getPilot('harlan').nationality,'Russo');assert.equal(getPilot('bento').nationality,'Japonês');
});
test('body hits never damage distant organs; local overkill cannot spill into another piece',()=>{
 const b=new BossTalassarca();b.update(1800,384,350);const before=b.modules.map(m=>m.hp);
 b.damage(10,b.x,b.y+140);assert.deepEqual(b.modules.map(m=>m.hp),before);assert.equal(b.hp,600);
 const m=b.modules[0];b.damage(100,b.x+m.offsetX,b.y+m.offsetY);assert.equal(m.destroyed,true);
 assert.deepEqual(b.modules.slice(1).map(m=>m.hp),before.slice(1));
});
test('explicit alpha contact identifies the actual part; empty body contact cannot select a nearby gun',()=>{
 const b=new BossTalassarca();b.update(1800,384,350);const m=b.modules[3];
 b.damage(5,b.x+m.offsetX+16,b.y+m.offsetY+16,m.id);assert.equal(m.hp,m.maxHp-5);
 b.damage(5,b.x+m.offsetX,b.y+m.offsetY,null);assert.equal(m.hp,m.maxHp-5);
});
test('area specials retain five/three budgets, destroy local batteries, and cannot skip metamorphosis',()=>{
 const b=new BossTalassarca();b.update(1800,384,350);
 for(let i=0;i<5;i++)b.damageArea(120);assert.equal(b.phase,'metamorphosis');
 assert.equal(b.damageArea(120).bossDamage,0);b.update(METAMORPHOSIS_MS,384,350);
 for(let i=0;i<3;i++)b.damageArea(120);assert.equal(b.phase,'defeated');
});
test('music cursor retains position through long pauses, multiple resumes and loop boundaries',()=>{
 const c=new MusicCursor();assert.equal(c.start(10,60),0);c.pause(28);assert.equal(c.position(200),18);
 assert.equal(c.start(200,60),18);assert.equal(c.position(247),5);c.pause(247);assert.equal(c.start(300,60),5);
 c.reset();assert.equal(c.start(800,60),0);
});
test('Continue restores radio deaths and unused shuffle entries without sharing mutable bags',()=>{
 const old=new PilotRadio('nolan',()=>.3);old.death();old.death();const saved=old.snapshot();
 const next=new PilotRadio('nolan',()=>.3);next.restore(saved);assert.equal(next.deaths,2);
 next.death();assert.equal(next.deaths,3);assert.equal(old.deaths,2);
 const heard=new Set();for(let i=0;i<5;i++){next.offer('miniboss',true);heard.add(next.message);}assert.equal(heard.size,5);
});
test('destruction follows cumulative local damage, not the final weak hit or old world position',()=>{
 const heat=new DamageRegions();heat.add(-12,20,30);heat.add(-11,22,40);heat.add(100,-80,1);
 const p=heat.strongest();assert.ok(p.x<0&&p.y>=20);heat.add(NaN,0,1000);assert.deepEqual(heat.strongest(),p);
});
test('missing one, two or three scheduled P keeps reachable NV3; late Continue remains viable for every owner',()=>{
 for(const id of PILOTS.map(p=>p.id))for(const missed of [0,1,2,3]){
  let w=createPlayerWeapons(id);for(let i=0;i<9-missed;i++)w=collectPowerItem(w).state;
  assert.equal(w.weaponLevel,id==='nolan'?(missed===0?5:4):(missed===0?4:3));const resume=continueWeapons(w,3200);
  assert.equal(resume.pilotId,w.pilotId);assert.ok(resume.weaponLevel>=2);assert.equal(resume.specialCharges,w.specialCharges);
 }
});
test('collection uses the passed actual hull test instead of forcing the shared Rivet contour',()=>{
 const p=new PickupSystem();p.spawn('power',384,300);
 assert.equal(p.checkCollection(384,300,5,false,()=>false).length,0);
 assert.equal(p.checkCollection(500,400,5,false,(x,y)=>x===384&&y===300).length,1);
});
test('recovery cannot combine a lower milestone meter with the higher milestone level to invent P',()=>{
 const current={...createPlayerWeapons('lyra'),weaponLevel:2,powerMeter:2};
 const next=recoverArmament(current,{family:'ion',level:3,meter:0});assert.equal(next.weaponLevel,3);assert.equal(next.powerMeter,0);
 assert.equal(recoverArmament(next,{family:'ion',level:2,meter:2}),next);
});
