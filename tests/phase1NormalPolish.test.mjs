import test from 'node:test';
import assert from 'node:assert/strict';
import {StageDirector,SUPPLY_EVENTS,SCROLL_SPEED} from '../src/game/systems/stageDirector.ts';
import {BossTalassarca} from '../src/game/systems/bosses/bossTalassarca.ts';
import {MinibossRaiaDente} from '../src/game/systems/bosses/minibossRaiaDente.ts';
import {continueWeapons,segmentEllipseHit} from '../src/game/systems/normalBalance.ts';
import {createPlayerWeapons,WEAPON_FAMILY_SPECS} from '../src/game/systems/weaponSystem.ts';

test('Normal supplies are scarce: three earned upgrades, one extra life and one special refill',()=>{
  assert.equal(SUPPLY_EVENTS.length,11);
  const p=SUPPLY_EVENTS.filter(e=>e.drop==='power');
  assert.equal(p.length,9);
  assert.ok(p[2].distance/SCROLL_SPEED>=40);
  assert.ok(p[5].distance/SCROLL_SPEED>=85);
  assert.ok(p[8].distance/SCROLL_SPEED>=130);
  assert.equal(SUPPLY_EVENTS.filter(e=>e.drop==='special').length,1);
  assert.equal(SUPPLY_EVENTS.filter(e=>e.drop==='life').length,1);
  assert.ok(SUPPLY_EVENTS.every(e=>e.drop!=='bomb'&&e.drop!=='full_power'));
  for(let i=1;i<SUPPLY_EVENTS.length;i++)assert.ok((SUPPLY_EVENTS[i].distance-SUPPLY_EVENTS[i-1].distance)/SCROLL_SPEED>=5);
});

test('boss encounters stop stage events and preserve the next carrier until the fight ends',()=>{
  const d=new StageDirector(768,true);d.seekCheckpoint(1799);
  d.update(50,384,350);const distance=d.scrollPx;
  assert.ok(d.minibossActive);
  for(let i=0;i<400;i++){assert.equal(d.update(50,384,350).spawned.filter(e=>e.carrier).length,0);assert.equal(d.scrollPx,distance);}
  d.boss.damage(1000,384,80);d.update(50,384,350);d.update(50,384,350);
  assert.ok(d.scrollPx>distance);
});

test('inner Talassarca alternates a generous moving corridor with aimed salvos, never a closed curtain',()=>{
  const b=new BossTalassarca();b.update(1800,384,350);b.damageArea(600);b.update(2400,384,350);
  const bursts=[],gaps=new Set();let warned=false;
  for(let i=0;i<350;i++){
    const tick=b.update(25,384,380);warned ||= tick.telegraph;
    if(tick.shots.length){assert.ok(warned);warned=false;bursts.push(tick.shots);if(b.attackPattern==='curtain'){gaps.add(b.safeLaneX);assert.ok(tick.shots.every(s=>Math.abs(s.x-b.safeLaneX)>=38));}}
  }
  assert.ok(bursts.some(s=>s.length===3));assert.ok(bursts.some(s=>s.length>3));assert.equal(gaps.size,3);
});

test('Raia uses simulation time and announces its attacks; one special cannot skip the fight',()=>{
  const a=new MinibossRaiaDente(),b=new MinibossRaiaDente();let warns=0;
  for(let i=0;i<200;i++){const tick=a.update(25,384,350);b.update(25,384,350);assert.equal(a.x,b.x);if(tick.telegraph)warns++;}
  assert.ok(warns>0);assert.equal(a.damage(120).killed,false);assert.equal(a.hp,60);
});

test('Continue returns to the owner kit at NV1 with zero P and cannot farm special or speed',()=>{
  const old={...createPlayerWeapons(),weaponFamily:'green',weaponLevel:1,powerMeter:2,specialCharges:0,speedLevel:2};
  const late=continueWeapons(old,3200);
  assert.equal(late.weaponFamily,'ion');assert.equal(late.weaponLevel,1);assert.equal(late.powerMeter,0);assert.equal(late.specialCharges,0);assert.equal(late.speedLevel,0);
  assert.deepEqual(continueWeapons(late,3200),late);
  assert.equal(continueWeapons(old,1000).weaponLevel,1);
});

test('fast blue/missile/charge paths intersect targets without granting near-miss damage',()=>{
  assert.ok(segmentEllipseHit(384,400,384,200,384,300,15,15)!==null);
  assert.equal(segmentEllipseHit(410,400,410,200,384,300,15,15),null);
  assert.equal(segmentEllipseHit(384,300,384,300,384,300,15,15),0);
  const near=segmentEllipseHit(384,400,384,0,384,300,15,15),far=segmentEllipseHit(384,400,384,0,384,100,15,15);
  assert.ok(near<far);
});

test('held fire matches fast tapping without repetitive input',()=>{
  for(const f of ['ion','green']){const s=WEAPON_FAMILY_SPECS[f];assert.ok(s.burstIntervalMs>=160);assert.equal(s.autoIntervalMs,s.burstIntervalMs);assert.ok(s.autoIntervalMs/s.burstIntervalMs<2);}
});
