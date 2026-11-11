import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlayerWeapons,
  upgradeWeapon,
  collectSpecialCharge,
  canActivateSpecial,
  activateSpecial,
  setShield,
  advanceWeapons,
  resetWeaponsOnRespawn,
  getPrimaryProjectiles,
  getSecondaryProjectiles,
  MAX_WEAPON_LEVEL,
  MAX_SPECIAL_CHARGES,
} from '../src/game/systems/weaponSystem.ts';
import {
  PickupSystem,
  determineEnemyDrop,
} from '../src/game/systems/pickupSystem.ts';
import {
  initialScoreCombo,
  registerKill,
  advanceCombo,
  getComboMultiplier,
  COMBO_WINDOW_MS,
} from '../src/game/systems/scoreComboSystem.ts';

test('weapons start at LV1 with two special charges', () => {
  const w = createPlayerWeapons('nolan');
  assert.equal(w.weaponLevel, 1);
  assert.equal(w.specialCharges, 2);
  assert.equal(w.hasShield, false);
  assert.equal(w.specialActiveMs, 0);
  assert.equal(w.specialType, 'prism');
});

test('RIVET upgrades to FULL LV5 and no further', () => {
  let w = createPlayerWeapons('nolan');
  const u1 = upgradeWeapon(w);
  assert.equal(u1.upgraded, true);
  assert.equal(u1.state.weaponLevel, 2);

  const u2 = upgradeWeapon(u1.state);
  assert.equal(u2.upgraded, true);
  assert.equal(u2.state.weaponLevel, 3);

  const u3 = upgradeWeapon(u2.state);
  assert.equal(u3.upgraded, true);
  assert.equal(u3.state.weaponLevel, 4);

  const u4 = upgradeWeapon(u3.state);
  assert.equal(u4.upgraded, true);
  assert.equal(u4.state.weaponLevel, 5);
  assert.equal(upgradeWeapon(u4.state).upgraded,false);
});

test('special consumes one charge, cannot retrigger active, caps at five, and empties', () => {
  let w = createPlayerWeapons('nolan');
  assert.equal(canActivateSpecial(w), true);
  w = collectSpecialCharge(w);
  for (let i=0;i<15;i++) w = collectSpecialCharge(w);
  assert.equal(w.specialCharges, MAX_SPECIAL_CHARGES);
  assert.equal(MAX_SPECIAL_CHARGES,5);
  for(let i=5;i>0;i--){
    const activation=activateSpecial(w);
    assert.equal(activation.activated,true);
    assert.equal(activation.state.specialCharges,i-1);
    assert.equal(activateSpecial(activation.state).activated,false);
    w=advanceWeapons(activation.state,4000);
  }
  assert.equal(w.specialCharges,0);
  assert.equal(activateSpecial(w).activated,false);
  assert.equal(resetWeaponsOnRespawn(w).specialCharges,0,'Continue cannot farm charges');
});

test('primary projectiles scale with weapon levels for all three pilots', () => {
  for (const pilotId of ['nolan', 'cora', 'harlan']) {
    const lv1 = getPrimaryProjectiles(pilotId, 1, 100, 200);
    const lv2 = getPrimaryProjectiles(pilotId, 2, 100, 200);
    const lv3 = getPrimaryProjectiles(pilotId, 3, 100, 200);

    assert.ok(lv1.length >= 1, `${pilotId} LV1 has projectiles`);
    assert.ok(lv2.length > lv1.length, `${pilotId} LV2 has more or split projectiles`);
    assert.ok(lv3.length >= lv2.length, `${pilotId} LV3 has peak volume`);

    const totalDmg1 = lv1.reduce((sum, p) => sum + p.damage, 0);
    const totalDmg2 = lv2.reduce((sum, p) => sum + p.damage, 0);
    const totalDmg3 = lv3.reduce((sum, p) => sum + p.damage, 0);

    assert.ok(totalDmg2 > totalDmg1, `${pilotId} LV2 deals more total damage than LV1`);
    assert.ok(totalDmg3 > totalDmg2, `${pilotId} LV3 deals more total damage than LV2`);
  }
});

test('secondary weapons exist for all pilots', () => {
  for (const pilotId of ['nolan', 'cora', 'harlan']) {
    const secs = getSecondaryProjectiles(pilotId, 100, 200);
    assert.ok(secs.length >= 1, `${pilotId} secondary weapon produces projectiles`);
    assert.ok(secs[0].damage > 1.0, `${pilotId} secondary weapon has solid damage`);
  }
});

test('reset on respawn restores weapon to LV1 and removes shield', () => {
  let w = createPlayerWeapons('nolan');
  w = upgradeWeapon(w).state;
  w = upgradeWeapon(w).state;
  w = setShield(w, true);
  w = { ...w, specialCharges: 1 };
  assert.equal(w.weaponLevel, 3);
  assert.equal(w.hasShield, true);

  const reset = resetWeaponsOnRespawn(w);
  assert.equal(reset.weaponLevel, 1);
  assert.equal(reset.hasShield, false);
  assert.equal(reset.specialCharges, 1);
});

test('pickup system spawns, drifts, and collects power-ups', () => {
  const sys = new PickupSystem();
  sys.spawn('power', 300, 200);
  sys.spawn('health', 300, 100);
  assert.equal(sys.pickups.length, 2);

  // Player far away - pickup moves down naturally in vertical top-down
  sys.update(100, 50, 50);
  assert.ok(sys.pickups[0].y > 200);

  // Nearby player cannot attract the capsule
  const beforeY = sys.pickups[0].y;
  sys.update(100, sys.pickups[0].x, beforeY - 40);
  assert.equal(sys.pickups[0].y, beforeY + 2.4);

  // Collection
  const collected = sys.checkCollection(sys.pickups[0].x, sys.pickups[0].y, 30);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].type, 'power');
  assert.equal(collected[0].collected, true);

  // Next update removes collected pickups
  sys.update(50, 0, 0);
  assert.equal(sys.pickups.length, 1);
});

test('regular kills cannot farm power or weapon changes', () => {
  for (const kind of ['scout', 'dart', 'lancer', 'cutter', 'carrier']) {
    for (let kill = 1; kill <= 200; kill++) {
      assert.ok(!['power', 'full_power', 'weapon_ion', 'weapon_red', 'weapon_green'].includes(determineEnemyDrop(kind, kill)));
    }
  }
  assert.equal(determineEnemyDrop('miniboss', 100), null);
});

test('score combo system multiplies consecutive kills and decays after window', () => {
  let sc = initialScoreCombo();
  assert.equal(getComboMultiplier(0), 1.0);
  assert.equal(getComboMultiplier(1), 1.0);
  assert.equal(getComboMultiplier(3), 1.2);
  assert.equal(getComboMultiplier(6), 1.5);
  assert.equal(getComboMultiplier(12), 2.0);
  assert.equal(getComboMultiplier(25), 3.0);

  const k1 = registerKill(sc, 100);
  assert.equal(k1.pointsEarned, 100);
  assert.equal(k1.state.comboCount, 1);
  assert.equal(k1.state.comboTimerMs, COMBO_WINDOW_MS);

  const k2 = registerKill(k1.state, 100);
  assert.equal(k2.pointsEarned, 120); // 100 * 1.2
  assert.equal(k2.state.comboCount, 2);

  // Advance time partially - combo remains
  const active = advanceCombo(k2.state, 1000);
  assert.equal(active.comboCount, 2);
  assert.equal(active.comboTimerMs, COMBO_WINDOW_MS - 1000);

  // Advance time past window - combo resets to 0
  const decayed = advanceCombo(active, 2000);
  assert.equal(decayed.comboCount, 0);
  assert.equal(decayed.comboTimerMs, 0);
  assert.equal(decayed.score, 220); // Pontuação preservada
  assert.equal(decayed.maxCombo, 2);
});
