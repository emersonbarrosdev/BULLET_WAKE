import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerWeapons,collectPowerItem,getPrimaryProjectiles,getSecondaryProjectiles} from '../src/game/systems/weaponSystem.ts';
import {recoveryPayloads,recoverArmament} from '../src/game/systems/recoverySystem.ts';
import {BossTalassarca} from '../src/game/systems/bosses/bossTalassarca.ts';
import {stepCrimsonLaser,createInitialCrimsonLaserState} from '../src/game/systems/crimsonLaserSystem.ts';

test('RIVET earns five increasingly dense stages with nine P and two/three automatic missiles',()=>{
 let w=createPlayerWeapons('nolan');const stages=[1];
 for(let i=0;i<9;i++){w=collectPowerItem(w).state;stages.push(w.weaponLevel);}
 assert.deepEqual(stages,[1,1,2,2,3,3,4,4,4,5]);assert.equal(collectPowerItem(w).meterIncreased,false);
 assert.deepEqual([1,2,3,4,5].map(l=>getPrimaryProjectiles('nolan',l,384,350).length),[1,2,3,6,7]);
 for(const level of [3,4,5]){const missiles=getSecondaryProjectiles('nolan',384,350,level);assert.equal(missiles.length,level===5?3:2);assert.ok(missiles.every(m=>m.homing===(level===5)));}
 const payloads=recoveryPayloads(w);assert.equal(payloads.length,3);
 let recovered={...createPlayerWeapons('nolan')};for(const p of payloads.reverse())recovered=recoverArmament(recovered,p);
 assert.equal(recovered.weaponLevel,5);assert.equal(recovered.powerMeter,0);
});
test('a boss shot can destroy only the piece actually hit; hull and broken pieces never consume HP',()=>{
 const b=new BossTalassarca();b.update(1800,384,350);
 assert.equal(b.damage(900,b.x,b.y+150).bossDamage,0);assert.equal(b.hp,600);
 const gun=b.modules[3],other=b.modules[4];
 assert.equal(b.damage(900,b.x+gun.offsetX,b.y+gun.offsetY,gun.id).bossDamage,100);
 assert.equal(b.hp,500);assert.equal(other.hp,100);
 assert.equal(b.damage(900,b.x+gun.offsetX,b.y+gun.offsetY,gun.id).bossDamage,0);
 b.damageArea(120);assert.equal(b.hp,380);assert.equal(b.hp,b.modules.reduce((n,m)=>n+m.hp,0));
 b.damageArea(9999);assert.equal(b.phase,'metamorphosis');b.update(2400,384,350);
 assert.equal(b.hp,360);assert.ok(b.modules.every(m=>m.hp===60&&!m.destroyed));
 for(const m of b.modules)b.damage(999,b.x+m.offsetX,b.y+m.offsetY,m.id);
 assert.equal(b.phase,'defeated');
});
test('continuous laser damage carries the exact front module identity through clipping',()=>{
 const result=stepCrimsonLaser(createInitialCrimsonLaserState(),{deltaMs:120,isHoldingFire:true,isRubyEquipped:true,level:1,shipX:384,shipY:350,targets:[
  {id:'boss:battery-left',x:384,y:240,radius:18,stopsBeam:true},
  {id:'boss:left',x:384,y:120,radius:18,stopsBeam:true},
 ]});
 assert.ok(result.damageEvents.length>0);assert.ok(result.damageEvents.every(e=>e.targetId==='boss:battery-left'));
});
