import test from 'node:test';
import assert from 'node:assert/strict';
import {enterStage,stageFlightSnapshot} from '../src/game/systems/campaignFlight.ts';
import {createPlayerWeapons,collectPowerItem,getPrimaryProjectiles} from '../src/game/systems/weaponSystem.ts';
import {BossTalassarca} from '../src/game/systems/bosses/bossTalassarca.ts';
import {MinibossRaiaDente} from '../src/game/systems/bosses/minibossRaiaDente.ts';
import {StageDirector} from '../src/game/systems/stageDirector.ts';
import {combatVoiceSamples} from '../src/game/audio/combatVoices.ts';
import {returnFromOcean} from './bossFlightHelper.mjs';

for(const id of ['nolan','cora','lyra','harlan','bento'])test(id+': stage boundary preserves full OR weak equipment, lives and remaining special stock',()=>{
  for(const full of [false,true]){
    let w=createPlayerWeapons(id);if(full)for(let i=0;i<9;i++)w=collectPowerItem(w).state;
    else w={...w,powerMeter:1};w={...w,speedLevel:2,specialCharges:1,specialActiveMs:1000};
    const carry=stageFlightSnapshot(1,w,2,43120),next=enterStage(id,2,carry);
    assert.equal(next.weapons.weaponLevel,w.weaponLevel);assert.equal(next.weapons.powerMeter,w.powerMeter);
    assert.equal(next.weapons.speedLevel,2);assert.equal(next.weapons.specialCharges,1);
    assert.equal(next.health.lives,2);assert.equal(next.score,43120);assert.equal(next.weapons.specialActiveMs,0);
    next.weapons.powerMeter=0;assert.equal(carry.weapons.powerMeter,w.powerMeter,'Snapshot is not shared mutable state');
    assert.equal(enterStage(id,1,carry).weapons.weaponLevel,1,'Replay starts a new run');
    assert.equal(enterStage(id,3,carry).score,0,'Cannot skip a stage using old carry');
  }
});
test('aerial defeat flees, remains absent for five seconds, emerges protected and restores only the new form',()=>{
  const b=new BossTalassarca();b.update(1800,384,350);b.damageArea(600);
  assert.equal(b.phase,'escape');const y=b.y;b.update(500,384,350);assert.ok(b.y<y);
  b.update(500,384,350);assert.equal(b.visible,false);assert.equal(b.damageArea(999).bossDamage,0);
  b.update(4999,384,350);assert.equal(b.phase,'submerged');b.update(1,384,350);
  assert.equal(b.phase,'emerge');assert.equal(b.hp,360);assert.equal(b.damageArea(999).bossDamage,0);
  b.update(1800,384,350);assert.equal(b.phase,'inner');
});
test('Eclipse warns before firing, pauses normal shots, preserves the central corridor and recovers',()=>{
  const b=new BossTalassarca();b.update(1800,384,350);b.damageArea(600);returnFromOcean(b);
  const phases=new Set();let warned=0;
  for(let t=0;t<15000;t+=25){const tick=b.update(25,384,380);if(!b.eclipse)continue;phases.add(b.eclipse.phase);assert.equal(tick.shots.length,0);assert.ok(b.eclipse.lanes.every(x=>Math.abs(x-384)>55));if(b.eclipse.phase==='warning')warned+=25;if(b.eclipse.phase==='fire')assert.ok(warned>=1350);}
  assert.deepEqual([...phases],['warning','fire','recover']);
});
test('inner arena stops visible scrolling smoothly; aerial form continues travel',()=>{
  const d=new StageDirector(768,true);d.minibossSpawned=true;d.scrollPx=4600;d.update(0,384,350);
  const b=d.boss;b.update(1800,384,350);const before=d.backgroundScrollPx;
  for(let i=0;i<100;i++)d.update(20,384,350);assert.ok(d.backgroundScrollPx>before);
  b.damageArea(600);returnFromOcean(b);const speeds=[];
  for(let i=0;i<250;i++){d.update(20,384,350);speeds.push(d.travelSpeed);}
  assert.ok(speeds[0]>20&&speeds.at(-1)<.02);assert.equal(d.scrollPx,4600);
});
test('destroyed captain guns no longer emit precision or alternate fire',()=>{
  const b=new MinibossRaiaDente();b.update(1200,384,350);const gun=b.modules[0];b.damage(1000,b.x+gun.offsetX,b.y+gun.offsetY,gun.id);
  let shots=0;for(let i=0;i<300;i++){const tick=b.update(25,384,350);for(const s of tick.shots){shots++;assert.ok(Math.abs(s.x-(b.x+gun.offsetX))>1);}}
  assert.ok(shots>0);assert.equal(b.hp,120);
});
test('four new primaries have distinct motion/geometry and grow without changing RIVET salvos',()=>{
  const ids=['cora','lyra','harlan','bento'];
  const first=ids.map(id=>getPrimaryProjectiles(id,1,384,350));
  assert.equal(new Set(first.map(p=>p[0].presentation)).size,4);
  assert.ok(first[0].every(p=>p.waveAmplitude>0));assert.ok(first[1].every(p=>p.velocityY<-800));assert.ok(first[2][0].damage>=4);
  for(const id of ids)assert.ok(getPrimaryProjectiles(id,4,384,350).length>getPrimaryProjectiles(id,1,384,350).length);
  assert.deepEqual([1,2,3,4,5].map(l=>getPrimaryProjectiles('nolan',l,384,350).length),[1,2,3,6,7]);
});
test('nine exclusive PCM effects are deterministic, audible, distinct, finite and have headroom',()=>{
  const signatures=new Set();for(const name of ['violet','emerald','amber','celestial','scarlet','phantom','orbital','nova','comet']){
    const pcm=combatVoiceSamples(name,22050);let peak=0,power=0,hash=0;
    for(let i=0;i<pcm.length;i++){assert.ok(Number.isFinite(pcm[i]));peak=Math.max(peak,Math.abs(pcm[i]));power+=pcm[i]**2;if(i%101===0)hash+=pcm[i]*(i+1);}
    assert.ok(peak>.05&&peak<.5);assert.ok(Math.sqrt(power/pcm.length)>.025);signatures.add(hash.toFixed(4));
    assert.deepEqual(combatVoiceSamples(name,22050),pcm);
  }assert.equal(signatures.size,9);
});
test('contact safety timeout interrupts the operation without awarding a false boss kill',()=>{
  const d=new StageDirector(768,true);d.scrollPx=4600;d.minibossSpawned=true;d.update(0,384,350);
  d.boss.update(1800,384,350);d.boss.update(180000,384,350);
  const tick=d.update(20,384,350);assert.equal(tick.failed,true);assert.equal(tick.completed,false);assert.equal(d.boss.hp,600);
});
