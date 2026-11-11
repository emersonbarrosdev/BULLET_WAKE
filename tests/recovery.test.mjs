import test from 'node:test';
import assert from 'node:assert/strict';
import {recoveryPayloads,recoverArmament} from '../src/game/systems/recoverySystem.ts';
import {createPlayerWeapons,resetWeaponsOnRespawn} from '../src/game/systems/weaponSystem.ts';
test('earned families and levels return as finite physical milestones; duplicates cannot mint upgrades',()=>{
 for(const family of ['ion','green','red'])for(const level of [1,2,3,4]){
  const old={...createPlayerWeapons('nolan'),weaponFamily:family,weaponLevel:level,powerMeter:2};
  const drops=recoveryPayloads(old);assert.ok(drops.length<=4);
  let state={...resetWeaponsOnRespawn(old),weaponLevel:1,powerMeter:0};
  for(const item of [...drops].reverse())state=recoverArmament(state,item);
  assert.equal(state.weaponFamily,family);assert.equal(state.weaponLevel,level);assert.equal(state.powerMeter,2);
  for(const item of drops)state=recoverArmament(state,item);
  assert.equal(state.weaponLevel,level);assert.equal(state.powerMeter,2);
 }
});
test('old recovery cannot downgrade a more advanced family',()=>{
 const red={...createPlayerWeapons('nolan'),weaponFamily:'red',weaponLevel:2};
 assert.equal(recoverArmament(red,{family:'green',level:4,meter:3}),red);
 assert.deepEqual(recoveryPayloads(createPlayerWeapons('nolan')),[]);
});
