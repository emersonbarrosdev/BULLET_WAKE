import {returnFromOcean} from './bossFlightHelper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BossTalassarca, SPECIAL_BOSS_DAMAGE } from '../src/game/systems/bosses/bossTalassarca.ts';
import { StageDirector, SUPPLY_EVENTS } from '../src/game/systems/stageDirector.ts';
import { PickupSystem, determineEnemyDrop } from '../src/game/systems/pickupSystem.ts';
import { createPlayerWeapons, activateSpecial, resetWeaponsOnRespawn } from '../src/game/systems/weaponSystem.ts';

test('outer overkill cannot defeat Talassarca or spill damage across metamorphosis',()=>{
  const b=new BossTalassarca();b.update(1800,384,350);
  assert.equal(b.displayWidth,432*.72);
  assert.equal(b.damageArea(100000).killed,false);
  assert.equal(b.phase,'escape');
  assert.equal(b.damageArea(100000).bossDamage,0);
  returnFromOcean(b);
  assert.equal(b.hp,3*SPECIAL_BOSS_DAMAGE);
  assert.equal(b.displayWidth,432*1.3);
  assert.equal(b.damage(-100).bossDamage,0);
  assert.equal(b.damage(NaN).bossDamage,0);
});

test('inner form varies dorsal attack origins while retaining dodging space, at 30/60/120Hz',()=>{
  for(const fps of [30,60,120]){
    const b=new BossTalassarca();b.update(1800,384,350);
    let outer=0,inner=0;
    for(let i=0;i<fps*6;i++)outer+=b.update(1000/fps,384,350).shots.length;
    b.damageArea(600);returnFromOcean(b);
    for(let i=0;i<fps*6;i++){
      const tick=b.update(1000/fps,384,350);inner+=tick.shots.length;
      assert.ok(b.y>0&&b.y<280,'Aquatic body is overflown while its organs remain in reach');
      assert.equal(b.x,384,'Full-width fins cannot cross the HUD');
    }
    assert.ok(inner>=outer,{fps,outer,inner});
  }
});

test('no ordinary alien drops items; rare biological carriers have one explicit cargo',()=>{
  assert.ok(SUPPLY_EVENTS.length<=14);
  assert.ok(SUPPLY_EVENTS.every(e=>e.carrier&&e.drop&&e.drop!=='bomb'));
  for(const kind of ['scout','dart','lancer','cutter','boss','miniboss'])for(let k=1;k<200;k++)assert.equal(determineEnemyDrop(kind,k),null);
  const d=new StageDirector();const supplies=[];
  for(let i=0;i<3000;i++)supplies.push(...d.update(50,384,350).spawned.filter(e=>e.drop));
  assert.equal(supplies.length,SUPPLY_EVENTS.length);
  assert.ok(supplies.every(e=>e.carrier));
});

test('capsule touches visible nose, records collection once, and expires without attracting',()=>{
  const p=new PickupSystem();p.spawn('weapon_green',384,330);
  assert.equal(p.checkCollection(384,350,5,true).length,1);
  assert.equal(p.checkCollection(384,350,5,true).length,0);
  p.clear();p.spawn('special',300,100);p.update(16001,300,100);
  assert.equal(p.pickups.length,0);
});

test('Continue preserves remaining specials, no passive or death refill',()=>{
  let w=createPlayerWeapons();w=activateSpecial(w).state;
  const next=resetWeaponsOnRespawn(w);
  assert.equal(next.specialCharges,1);assert.equal(next.specialActiveMs,0);
  assert.equal('bombs' in next,false);assert.equal('resonance' in next,false);
});
