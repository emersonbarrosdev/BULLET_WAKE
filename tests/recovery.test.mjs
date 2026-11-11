import test from 'node:test';
import assert from 'node:assert/strict';
import { deathPowerDropCount } from '../src/game/systems/recoverySystem.ts';
import { createPlayerWeapons, resetWeaponsOnRespawn, collectPowerItem, powerProgress } from '../src/game/systems/weaponSystem.ts';
import { continueWeapons } from '../src/game/systems/normalBalance.ts';

for (const pilot of ['nolan', 'cora', 'lyra', 'harlan', 'bento']) {
 test(pilot + ': death drops one ordinary P, never the old level, and cannot generate power', () => {
  const initial = createPlayerWeapons(pilot);
  assert.equal(deathPowerDropCount(initial), 0);
  for (const earned of [1, 2, 3, 6, 9]) {
   let old = initial;
   for (let i=0; i<earned; i++) old=collectPowerItem(old).state;
   assert.equal(deathPowerDropCount(old), 1);
   const respawn=resetWeaponsOnRespawn(old);
   assert.equal(respawn.weaponLevel, 1); assert.equal(respawn.powerMeter, 0);
   const recovered=collectPowerItem(respawn).state;
   assert.equal(recovered.weaponLevel, 1); assert.equal(recovered.powerMeter, 1);
   assert.ok(powerProgress(pilot,recovered.weaponLevel,recovered.powerMeter)<=earned);
   if (earned>=3) assert.ok(recovered.weaponLevel<old.weaponLevel);
   assert.equal(resetWeaponsOnRespawn(recovered).powerMeter,0);
  }
 });
 test(pilot + ': Continue and stale reserve state cannot restore a level or refill special', () => {
  const old={...initialFor(pilot),weaponLevel:pilot==='nolan'?5:4,powerMeter:3,specialCharges:0,speedLevel:3};
  for (const checkpoint of [0,2100,4600]) {
   const next=continueWeapons(old,checkpoint);
   assert.equal(next.weaponLevel,1);assert.equal(next.powerMeter,0);
   assert.equal(next.weaponFamily,createPlayerWeapons(pilot).weaponFamily);
   assert.equal(next.specialCharges,0);assert.equal(next.speedLevel,0);
   assert.equal(next.hasShield,false);
  }
 });
}
function initialFor(pilot) { return createPlayerWeapons(pilot); }
