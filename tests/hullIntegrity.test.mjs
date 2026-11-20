import assert from 'node:assert/strict';
import test from 'node:test';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';
import { HULL_RULES, HULL_REPAIR_OPPORTUNITY } from '../src/game/arcade/HullIntegrity.ts';
import { buildMissionSupplies } from '../src/game/arcade/PelagicDifficulty.ts';
import { maxWeaponLevel, powerItemsForNextLevel } from '../src/game/systems/weaponSystem.ts';
import { stageFlightSnapshot } from '../src/game/systems/campaignFlight.ts';
import { SaveSystem } from '../src/game/systems/saveSystem.ts';

const pilots = ['nolan', 'cora', 'lyra', 'harlan', 'bento'];
function live(index, pilotId = 'nolan', maxHull = 4, rule = 'hull-v1') {
  const w = new ArcadeWorld(MISSIONS[index], undefined, { pilotId, maxHull, survivalRule: rule, upLayout: 'pc' });
  w.state = 'play'; w.introTime = 0; w.player.invulnerable = 0; w.directorPaused = true; w.devSandboxIsolated = true;
  return w;
}
function tick(w, seconds, hz, input) {
  for (let i = 0; i < Math.round(seconds * hz); i++) w.step(1 / hz, input);
}
function pickup(w, kind, hz = 120) {
  w.devSpawnCargoItem(kind);
  Object.assign(w.cargo.at(-1), { x: w.player.x, y: w.player.y, vx: 0, vy: 0 });
  w.step(1 / hz);
}

for (const index of [0, 1]) for (const pilot of pilots) for (const hz of [30, 60, 120]) {
  test(`${MISSIONS[index].perspective}/${pilot}/${hz}Hz: impacts preserve position and reduce power one level with finite protection`, () => {
    for (let level = maxWeaponLevel(pilot); level >= 1; level--) for (const meter of [0, 1, 2]) {
      const w = live(index, pilot);
      w.weapons.weaponLevel = level; w.weapons.powerMeter = meter;
      const position = { x: w.player.x - 20, y: w.player.y - 20 };
      Object.assign(w.player, position);
      w.hurtPlayer();
      assert.equal(w.hull, 3); assert.equal(w.lives, 1); assert.equal(w.deaths, 0); assert.equal(w.hitsReceived, 1);
      assert.equal(w.player.x, position.x); assert.equal(w.player.y, position.y);
      const nextLevel = Math.max(1, level - 1);
      assert.equal(w.weapons.weaponLevel, nextLevel);
      assert.equal(w.weapons.powerMeter, Math.min(meter, powerItemsForNextLevel(pilot, nextLevel) - 1));
      assert.equal(w.player.invulnerable, HULL_RULES.protectionSeconds);
      w.hurtPlayer();
      tick(w, 1.7, hz);
      w.hurtPlayer();
      assert.equal(w.hull, 3); assert.equal(w.hitsReceived, 1);
      tick(w, .2, hz); w.hurtPlayer();
      assert.equal(w.hull, 2); assert.equal(w.hitsReceived, 2);
      assert.equal(w.events.filter(e => e.type === 'damage').length, 2);
    }
  });

  test(`${MISSIONS[index].perspective}/${pilot}/${hz}Hz: destruction happens once, repairs heal without restoring power or protection`, () => {
    const w = live(index, pilot);
    w.weapons.weaponLevel = Math.min(3, maxWeaponLevel(pilot));
    w.hurtPlayer();
    tick(w, 2, hz);
    const power = w.weapons.weaponLevel, meter = w.weapons.powerMeter;
    pickup(w, 'repair', hz);
    assert.equal(w.hull, 4); assert.equal(w.repairsCollected, 1);
    assert.equal(w.weapons.weaponLevel, power); assert.equal(w.weapons.powerMeter, meter);
    assert.equal(w.player.invulnerable, 0);
    const score = w.score;
    pickup(w, 'repair', hz);
    assert.equal(w.hull, 4); assert.equal(w.score - score, HULL_RULES.fullRepairScore);
    assert.equal(w.player.invulnerable, 0);
    for (let hit = 0; hit < 4; hit++) { w.hurtPlayer(); tick(w, 2, hz); }
    assert.equal(w.state, 'defeat'); assert.equal(w.hull, 0); assert.equal(w.lives, 0); assert.equal(w.deaths, 1);
    assert.equal(w.hullState, 'destroyed');
    const hits = w.hitsReceived, deadScore = w.score, repairs = w.repairsCollected;
    w.hurtPlayer(); pickup(w, 'repair', hz); w.hurtPlayer();
    assert.equal(w.state, 'defeat'); assert.equal(w.hull, 0); assert.equal(w.deaths, 1);
    assert.equal(w.hitsReceived, hits); assert.equal(w.score, deadScore); assert.equal(w.repairsCollected, repairs);
    assert.equal(w.events.filter(e => e.type === 'death').length, 1);
    assert.equal(w.events.filter(e => e.type === 'defeat').length, 1);
  });
}

for (const index of [0, 1]) for (const pilot of pilots) for (const maxHull of [3, 4, 5]) {
  test(`${MISSIONS[index].perspective}/${pilot}: ${maxHull} hull never changes movement or creates extra lives`, () => {
    const intact = live(index, pilot, maxHull), damaged = live(index, pilot, maxHull);
    damaged.hurtPlayer();
    assert.equal(damaged.hullMaximum, maxHull); assert.equal(damaged.hull, maxHull - 1);
    for (const input of [{ x: .6, y: -.8, fire: false, special: false }, { x: -1, y: 0, fire: false, special: false, focus: true }]) {
      tick(intact, .2, 120, input); tick(damaged, .2, 120, input);
      assert.equal(damaged.player.x, intact.player.x); assert.equal(damaged.player.y, intact.player.y);
    }
    assert.equal(damaged.lives, 1);
    pickup(damaged, 'life'); assert.equal(damaged.hull, maxHull); assert.equal(damaged.lives, 1);
  });
}

for (const index of [0, 1]) for (const difficulty of ['easy', 'normal', 'hard']) {
  test(`${MISSIONS[index].perspective}/${difficulty}: only two planned repair deliveries, no repeated spawn at same route`, () => {
    const w = new ArcadeWorld(MISSIONS[index], undefined, { survivalRule: 'hull-v1', difficulty });
    w.state = 'play'; w.devInvincible = true;
    const opportunities = [HULL_REPAIR_OPPORTUNITY[w.mission.perspective], ...buildMissionSupplies(w.mission, difficulty).filter(s => s.kind === 'life').map(s => s.at)].sort((a, b) => a - b);
    assert.equal(opportunities.length, 2);
    const delivered = new Set();
    for (const at of opportunities) {
      w.devJumpToCheckpoint(at - .01);
      tick(w, .1, 120);
      for (const c of w.cargo.filter(c => c.kind === 'repair')) delivered.add(c.id);
      assert.equal(w.cargo.filter(c => c.kind === 'life').length, 0);
      const ids = w.cargo.filter(c => c.kind === 'repair').map(c => c.id);
      tick(w, .2, 120);
      assert.deepEqual(w.cargo.filter(c => c.kind === 'repair').map(c => c.id), ids);
    }
    assert.equal(delivered.size, 2);
  });
}

for (const index of [0, 1]) test(`${MISSIONS[index].perspective}: default API retains classic lives and death behavior`, () => {
  const w = new ArcadeWorld(MISSIONS[index]); w.state = 'play'; w.player.invulnerable = 0;
  assert.equal(w.survivalRule, 'classic-v1'); assert.equal(w.lives, 3); assert.equal(w.survivalSnapshot, undefined);
  w.hurtPlayer(); assert.equal(w.lives, 2); assert.equal(w.deaths, 1);
});

test('hull campaign carry preserves damage and skips legacy record tables', () => {
  const first = live(0, 'cora'); first.hurtPlayer();
  const flight = stageFlightSnapshot(1, first.weapons, first.lives, 42000, first.survivalSnapshot);
  const second = new ArcadeWorld(MISSIONS[1], flight, { pilotId: 'cora', survivalRule: 'hull-v1' });
  assert.equal(second.hull, 3); assert.equal(second.hullMaximum, 4); assert.equal(second.lives, 1);
  assert.equal(second.weapons.pilotId, 'cora');
  const save = new SaveSystem(); save.resetProgress(); save.recordStageClear(1, 'cora', 42000, flight);
  assert.equal(save.getData().bestScores[1], undefined);
  assert.equal(save.getPilotProgress('cora').bestScores[1], undefined);
  assert.deepEqual(save.getPilotProgress('cora').flight.survival, flight.survival);
  assert.ok(save.getData().unlockedStages.includes(2));
});

for (const pilot of pilots) test(`${pilot}: checkpoint recovery keeps pilot and makes the run noncompetitive`, () => {
  const w = live(0, pilot);
  w.devJumpTideArch('checkpoint', true, true);
  w.tideArch.crossedArch = true; w.tideArch.altitudeRestored = true;
  w.activateTideArchCheckpoint();
  const checkpoint = w.checkpoint;
  assert.ok(checkpoint);
  w.player.invulnerable = 0; w.hurtPlayer();
  assert.equal(w.restartFromCheckpoint(checkpoint), true);
  assert.equal(w.continuesUsed, 1); assert.equal(w.competitiveEligible, false);
  assert.equal(w.pilotId, pilot); assert.equal(w.weapons.pilotId, pilot);
  assert.equal(w.hull, w.hullMaximum); assert.equal(w.lives, 1);
  assert.equal(w.hitsReceived, 1);
});

for (const index of [0, 1]) test(`${MISSIONS[index].perspective}: power recovery records elapsed time only after an actual level loss`, () => {
  const w = live(index);
  w.hurtPlayer(); tick(w, 2, 120);
  assert.deepEqual(w.powerRecoverySeconds, []);
  w.weapons.weaponLevel = 3; w.weapons.powerMeter = 0;
  w.hurtPlayer(); tick(w, 1, 120);
  assert.equal(w.weapons.weaponLevel, 2);
  pickup(w, 'power'); pickup(w, 'power'); w.step(1 / 120);
  assert.equal(w.weapons.weaponLevel, 3);
  assert.equal(w.powerRecoverySeconds.length, 1);
  assert.ok(w.powerRecoverySeconds[0] >= 1 && w.powerRecoverySeconds[0] < 1.1);
});
