import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerWeapons, collectPowerItem, collectWeaponCapsule, resetWeaponsOnRespawn, collectSpeedItem, WEAPON_FAMILY_SPECS } from '../src/game/systems/weaponSystem.ts';
import { StageDirector, STAGE_EVENTS, SUPPLY_EVENTS, SCROLL_SPEED, SURFACE_SCROLL_FACTOR } from '../src/game/systems/stageDirector.ts';
import { PickupSystem } from '../src/game/systems/pickupSystem.ts';
import { PICKUP_GUIDE, NORMAL_GUIDE_ITEMS, pickupSvg } from '../src/game/data/pickupGuide.ts';

test('colors change immediately at level one; duplicates award points without adding P', () => {
  let state = collectPowerItem(createPlayerWeapons('nolan', 'ion')).state;
  for (const family of ['red', 'green', 'ion']) {
    state = collectWeaponCapsule(state, family).state;
    assert.equal(state.weaponFamily, family);
    assert.equal(state.weaponLevel, 1);
    assert.equal(state.powerMeter, 1);
    const same = collectWeaponCapsule(state, family);
    assert.equal(same.bonusPoints, 5000);
    assert.deepEqual(same.state, state);
  }
});

test('nine P reach max; three additional P build a real reserve for the next life', () => {
  let state = createPlayerWeapons('nolan', 'red');
  for (let i = 1; i <= 9; i++) {
    state = collectPowerItem(state).state;
    assert.equal(state.weaponLevel, 1 + Math.floor(i / 3));
    assert.equal(state.powerMeter, i % 3);
  }
  assert.equal(resetWeaponsOnRespawn(state).weaponLevel, 1, 'reaching maximum does not create a free reserve');
  for (let i = 1; i <= 3; i++) {
    state = collectPowerItem(state).state;
    assert.equal(state.powerMeter, i);
    assert.equal(state.weaponLevel, 4);
  }
  assert.equal(collectPowerItem(state).meterIncreased, false);
  const reset = resetWeaponsOnRespawn({ ...state, speedLevel: 3, bombs: 0 });
  assert.equal(reset.weaponLevel, 2);
  assert.equal(reset.powerMeter, 0);
  assert.equal(reset.weaponFamily, 'ion');
  assert.equal(reset.speedLevel, 0);
  assert.equal(reset.bombs, 3);
  const partial = resetWeaponsOnRespawn({ ...state, powerMeter: 2 });
  assert.equal(partial.powerMeter, 2);
  assert.equal(partial.weaponLevel, 1);
});

test('Normal supply progression cannot reach level two in the opening seconds', () => {
  const powers = SUPPLY_EVENTS.filter(e => e.drop === 'power');
  assert.equal(powers.length, 9);
  assert.ok(powers[2].distance / SCROLL_SPEED > 20);
  assert.ok(powers[5].distance / SCROLL_SPEED > 40);
  assert.ok(powers[8].distance / SCROLL_SPEED > 60);
  assert.ok(!STAGE_EVENTS.some(e => e.drop === 'full_power'));
  for (const family of ['ion', 'green']) assert.equal(WEAPON_FAMILY_SPECS[family].autoIntervalMs, WEAPON_FAMILY_SPECS[family].burstIntervalMs);
});

test('a coordinated flock follows one curved route, is fragile, exits, and never fires', () => {
  const director = new StageDirector();
  director.scrollPx = 359;
  const ids = new Set(); let peak = 0;
  for (let i = 0; i < 140; i++) {
    const tick = director.update(50, 384, 350);
    for (const e of tick.spawned.filter(e => e.flight)) {
      ids.add(e.id); assert.equal(e.hp, .3); assert.equal(e.drop, null);
    }
    const flock = director.enemies.filter(e => ids.has(e.id));
    peak = Math.max(peak, flock.length);
    for (const e of flock) {
      assert.equal(e.phase, 'approach');
      assert.ok(!tick.shots.some(s => s.x === e.x && s.y === e.y + 16));
    }
  }
  assert.ok(ids.size >= 5); assert.ok(peak >= 5);
  assert.ok(!director.enemies.some(e => ids.has(e.id) && e.ageMs > 3400));
});

test('surface enemies stay anchored to the scrolling background and warn before firing upward', () => {
  const d = new StageDirector(); d.scrollPx = 819;
  let target; let observedWarning = false; let surfaceShots = 0;
  for (let i = 0; i < 150; i++) {
    const tick = d.update(50, 384, 350);
    target ??= tick.spawned.find(e => e.layer === 'surface');
    if (!target) continue;
    assert.ok(Math.abs(target.y - (-35 + (d.scrollPx - target.spawnScroll) * SURFACE_SCROLL_FACTOR)) < .001);
    observedWarning ||= target.phase === 'telegraph';
    surfaceShots += tick.shots.filter(s => s.sourceLayer === 'surface').length;
  }
  assert.ok(observedWarning); assert.ok(surfaceShots >= 2);
});

test('capsules cannot pull toward a nearby ship, and require actual contact', () => {
  const p = new PickupSystem(); const item = p.spawn('weapon_red', 300, 200);
  assert.equal(p.checkCollection(330, 200).length, 0);
  p.update(100, 300, 160); assert.equal(item.y, 202.4); assert.ok(Math.abs(item.baseX - 300) <= 4);
  assert.equal(p.checkCollection(item.x, item.y).length, 1);
});

test('every item has its own color, silhouette and symbol, shared with the guide', () => {
  const entries = Object.values(PICKUP_GUIDE);
  for (const property of ['color', 'shape', 'glyph']) assert.equal(new Set(entries.map(e => e[property])).size, entries.length);
  for (const type of NORMAL_GUIDE_ITEMS) { assert.ok(pickupSvg(type).includes(PICKUP_GUIDE[type].glyph)); assert.ok(PICKUP_GUIDE[type].description.length > 30); }
  assert.ok(!NORMAL_GUIDE_ITEMS.includes('full_power'));
  let w = createPlayerWeapons(); for (let i = 0; i < 5; i++) w = collectSpeedItem(w); assert.equal(w.speedLevel, 3);
});
