import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPlayerWeapons,
  upgradeWeapon,
  addResonance,
  canActivateSpecial,
  activateSpecial,
  useBomb,
  addBomb,
  setShield,
  advanceWeapons,
  resetWeaponsOnRespawn,
  getPrimaryProjectiles,
  getSecondaryProjectiles,
  MAX_WEAPON_LEVEL,
  MAX_BOMBS,
  MAX_RESONANCE,
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

test('weapons start at LV1 with 2 bombs and 0 resonance', () => {
  const w = createPlayerWeapons('nolan');
  assert.equal(w.weaponLevel, 1);
  assert.equal(w.bombs, 2);
  assert.equal(w.resonance, 0);
  assert.equal(w.hasShield, false);
  assert.equal(w.specialActiveMs, 0);
  assert.equal(w.specialType, 'prism');
});

test('weapons upgrade up to LV4 and no further', () => {
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
  assert.equal(u4.upgraded, false);
  assert.equal(u4.state.weaponLevel, MAX_WEAPON_LEVEL);
});

test('resonance accumulates up to 100 and enables special', () => {
  let w = createPlayerWeapons('cora');
  assert.equal(w.specialType, 'phantom');
  assert.equal(canActivateSpecial(w), false);

  w = addResonance(w, 50);
  assert.equal(w.resonance, 50);
  assert.equal(canActivateSpecial(w), false);

  w = addResonance(w, 60);
  assert.equal(w.resonance, MAX_RESONANCE);
  assert.equal(canActivateSpecial(w), true);

  const act = activateSpecial(w);
  assert.equal(act.activated, true);
  assert.equal(act.state.resonance, 0);
  assert.ok(act.state.specialActiveMs > 0);
  assert.equal(canActivateSpecial(act.state), false);
});

test('bombs can be consumed and restored up to MAX_BOMBS', () => {
  let w = createPlayerWeapons('harlan');
  assert.equal(w.bombs, 2);

  const b1 = useBomb(w);
  assert.equal(b1.used, true);
  assert.equal(b1.state.bombs, 1);

  const b2 = useBomb(b1.state);
  assert.equal(b2.used, true);
  assert.equal(b2.state.bombs, 0);

  const b3 = useBomb(b2.state);
  assert.equal(b3.used, false);
  assert.equal(b3.state.bombs, 0);

  let full = addBomb(addBomb(addBomb(addBomb(addBomb(b3.state)))));
  assert.equal(full.bombs, MAX_BOMBS);
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
  w = addResonance(w, 80);
  assert.equal(w.weaponLevel, 3);
  assert.equal(w.hasShield, true);

  const reset = resetWeaponsOnRespawn(w);
  assert.equal(reset.weaponLevel, 1);
  assert.equal(reset.hasShield, false);
  assert.equal(reset.resonance, 40); // 50% conservada
});

test('pickup system spawns, attracts, and collects power-ups', () => {
  const sys = new PickupSystem();
  sys.spawn('power', 300, 200);
  sys.spawn('health', 300, 100);
  assert.equal(sys.pickups.length, 2);

  // Player far away - pickup moves down naturally in vertical top-down
  sys.update(100, 50, 50);
  assert.ok(sys.pickups[0].y > 200);

  // Player approaches pickup - magnetic attraction activates
  const beforeY = sys.pickups[0].y;
  sys.update(100, sys.pickups[0].x, beforeY - 40);
  assert.ok(sys.pickups[0].y < beforeY + 10);

  // Collection
  const collected = sys.checkCollection(sys.pickups[0].x, sys.pickups[0].y, 30);
  assert.equal(collected.length, 1);
  assert.equal(collected[0].type, 'power');
  assert.equal(collected[0].collected, true);

  // Next update removes collected pickups
  sys.update(50, 0, 0);
  assert.equal(sys.pickups.length, 1);
});

test('determineEnemyDrop produces expected rewards', () => {
  assert.equal(determineEnemyDrop('lancer', 1), 'power');
  assert.equal(determineEnemyDrop('lancer', 2), 'special');
  assert.equal(determineEnemyDrop('lancer', 3), 'bomb');
  assert.equal(determineEnemyDrop('carrier', 0), 'power');
  assert.equal(determineEnemyDrop('carrier', 1), 'weapon_ion');
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
