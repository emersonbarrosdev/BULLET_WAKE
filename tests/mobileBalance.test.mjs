import assert from 'node:assert/strict';
import test from 'node:test';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { ReplayRecorder, ReplayPlayer } from '../src/game/arcade/ArcadeReplay.ts';
import { MISSIONS, FAMILY } from '../src/game/arcade/content.ts';
import { buildMissionSupplies } from '../src/game/arcade/PelagicDifficulty.ts';

for (const mission of MISSIONS) test(`${mission.perspective}: finite supplies arrive earlier, cover recovery and avoid traversal`, () => {
  for (const difficulty of ['easy', 'normal', 'hard']) {
    const old = buildMissionSupplies(mission, difficulty);
    const list = buildMissionSupplies(mission, difficulty, false, 'balanced-v2');
    const count = (items, kind) => items.filter(s => s.kind === kind).length;
    assert(count(list, 'power') > count(old, 'power'));
    assert.equal(count(list, 'life'), 2);
    assert.equal(count(list, 'special'), 4);
    assert.equal(list[0].at, 10); assert.equal(list[1].at, 26);
    assert(list.find(s => s.kind === 'life').at <= 80);
    assert(list.find(s => s.kind === 'special').at < 60);
    assert(list.every((s, i) => !i || s.at - list[i - 1].at >= 10));
    if (mission.perspective === 'UP') assert(!list.some(s => s.at >= 180 && s.at <= 214));
    const world = new ArcadeWorld(mission, undefined, { supplyBalance: 'balanced-v2', survivalRule: 'hull-v1' });
    assert.deepEqual(world.stageDirector.defs.filter(e => e.category === 'supply').map(e => ({ at: e.atSeconds, kind: e.payload.supplyKind })), list);
    world.state = 'play'; world.introTime = 0; world.player.invulnerable = 10000;
    world.devJumpToCheckpoint(75.99);
    for (let i = 0; i < 30; i++) world.step(1 / 120);
    if (mission.perspective === 'UP') {
      assert.equal(world.cargo.filter(c => c.kind === 'repair').length, 1);
      for (let i = 0; i < 30; i++) world.step(1 / 120);
      assert.equal(world.cargo.filter(c => c.kind === 'repair').length, 1, 'delivery cannot repeat each frame');
    }
  }
});

test('mobile aircraft enlargement is bounded, matches collision geometry and persists in replay', () => {
  const mission = { ...MISSIONS[0], encounters: [] };
  for (const scale of [1.08, 1.15]) {
    const meta = { missionId: mission.id, pilotId: 'nolan', difficulty: 'easy', assisted: false, seed: 1337,
      upLayout: 'portrait', arena: { left: 0, right: 336, top: 34, bottom: 708 },
      playerSidePadding: 24, aircraftScale: scale, supplyBalance: 'balanced-v2' };
    const world = new ArcadeWorld(mission, undefined, meta);
    world.state = 'play'; world.introTime = 0; world.player.invulnerable = 1000;
    const sizing = new ArcadeWorld(mission, undefined, meta);
    sizing.spawnEncounter({ at: 0, family: 'fighter', formation: 'solo', motion: 'sine', lane: .5 });
    assert.equal(sizing.enemies[0].size, FAMILY.fighter.size * scale);
    const recorder = new ReplayRecorder(meta);
    for (let i = 0; i < 3600; i++) { const input = { x: i % 480 < 240 ? .7 : -.7, y: 0, fire: false, special: false }; recorder.record(input); world.step(1 / 120, input); }
    const replay = recorder.finish();
    assert.equal(replay.aircraftScale, scale); assert.equal(replay.supplyBalance, 'balanced-v2');
    const restored = new ArcadeWorld(mission, undefined, replay), player = new ReplayPlayer(replay);
    restored.state = 'play'; restored.introTime = 0; restored.player.invulnerable = 1000;
    while (!player.finished) restored.step(1 / 120, player.nextInput());
    assert.deepEqual(restored.player, world.player); assert.deepEqual(restored.cargo, world.cargo);
  }
  const legacy = new ArcadeWorld(mission);
  assert.equal(legacy.aircraftScale, 1); assert.equal(legacy.supplyBalance, 'classic-v1');
});
