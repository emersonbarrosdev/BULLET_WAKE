import assert from 'node:assert/strict';
import test from 'node:test';
import { stageFlightSnapshot, enterStage } from '../src/game/systems/campaignFlight.ts';
import { createPlayerWeapons } from '../src/game/systems/weaponSystem.ts';
import { SaveSystem, STORAGE_KEY } from '../src/game/systems/saveSystem.ts';
import { readArcadeProgress, recordArcadeClear } from '../src/game/arcade/progress.ts';
import { ArcadeProfileStore, PROFILE_STORAGE_KEY, defaultProfileV4, recordKey } from '../src/game/arcade/ArcadeProfileStore.ts';
import { evaluateArcadeRun } from '../src/game/arcade/ArcadeRanking.ts';
import { evaluateSimulationAchievements } from '../src/game/arcade/ArcadeAchievements.ts';
import { ReplayRecorder, ReplayPlayer, REPLAY_FORMAT_VERSION } from '../src/game/arcade/ArcadeReplay.ts';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('replay v2 preserves precise analog axes while v1 still decodes tenths', () => {
  const rec = new ReplayRecorder({ missionId: 1, pilotId: 'nolan', difficulty: 'normal', assisted: false, seed: 7, survivalRule: 'hull-v1' });
  const input = { x: .137891234, y: -.72843218, fire: true, special: false, charge: false, focus: true };
  rec.record(input);
  assert.deepEqual(new ReplayPlayer(rec.finish()).nextInput(), input);
  const old = { ...rec.finish(), version: 1, survivalRule: 'classic-v1', runs: [{ qx: 7, qy: -3, flags: 1, count: 1 }] };
  assert.deepEqual(new ReplayPlayer(old).nextInput(), { x: .7, y: -.3, fire: true, special: false, charge: false, focus: false });
});

const survival = { rule: 'hull-v1', current: 1, maximum: 4 };
const makeFlight = () => stageFlightSnapshot(1, { ...createPlayerWeapons('nolan'), weaponLevel: 3, powerMeter: 1, specialCharges: 2 }, 2, 42000, survival);

test('hull carry is detached and preserved across arcade progress JSON without repairing damage', () => {
  const flight = makeFlight();
  assert.notEqual(flight.survival, survival);
  const progress = recordArcadeClear({ cleared: [], flights: {} }, flight);
  flight.survival.current = 4;
  const restored = readArcadeProgress(JSON.stringify(progress)).flights[1];
  assert.deepEqual(restored.survival, survival);
  assert.equal(restored.weapons.weaponLevel, 3);
  assert.equal(restored.lives, 2);
  const entry = enterStage('nolan', 2, restored);
  assert.equal(entry.weapons.weaponLevel, 3);
  assert.equal(entry.health.lives, 2);
  assert.equal(entry.score, 42000);
  const legacy = stageFlightSnapshot(1, createPlayerWeapons('nolan'), 2, 100);
  assert.equal('survival' in legacy, false);
  assert.equal(readArcadeProgress(JSON.stringify({ cleared: [1], flight: legacy })).flights[1].survival, undefined);
  const invalid = { ...restored, survival: { rule: 'hull-v1', current: 8, maximum: 4 } };
  assert.equal(readArcadeProgress(JSON.stringify({ cleared: [1], flights: { 1: invalid } })).flights[1].survival, undefined);
});

test('SaveSystem persists hull survival and retains legacy carry through reload', () => {
  const previous = globalThis.window;
  const storage = memoryStorage();
  try {
    globalThis.window = { localStorage: storage };
    const save = new SaveSystem();
    const flight = makeFlight();
    save.recordStageClear(1, 'nolan', flight.score, flight);
    flight.survival.current = 4;
    const loaded = new SaveSystem();
    assert.deepEqual(loaded.getPilotProgress('nolan').flight.survival, survival);
    const raw = JSON.parse(storage.getItem(STORAGE_KEY));
    delete raw.pilotProgress.nolan.flight.survival;
    storage.setItem(STORAGE_KEY, JSON.stringify(raw));
    const legacy = new SaveSystem().getPilotProgress('nolan').flight;
    assert.equal(legacy.survival, undefined);
    assert.equal(legacy.score, 42000);
    assert.equal(legacy.weapons.weaponLevel, 3);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});

function record(overrides = {}) {
  return { runId: 'run', missionId: 1, pilotId: 'nolan', difficulty: 'normal', score: 1000, rank: 'B', victory: true,
    competitiveEligible: true, assisted: false, noMiss: false, noBomb: false, oneCC: true, creditsEarned: 100, achievements: [], ...overrides };
}

test('profile keeps classic and hull records separate, preserving existing v4 records and wallet', () => {
  const storage = memoryStorage();
  const legacy = defaultProfileV4();
  delete legacy.settings.survivalRule;
  legacy.wallet.credits = 321;
  legacy.records[recordKey(1, 'nolan', 'normal', true)] = { score: 9000, rank: 'A', achievedAt: 1 };
  legacy.achievements.first_clear = 12;
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(legacy));
  const store = new ArcadeProfileStore(storage);
  assert.equal(store.getSettings().survivalRule, 'hull-v1');
  assert.equal(store.getProfile().wallet.credits, 321);
  assert.equal(store.getProfile().achievements.first_clear, 12);
  store.recordRunResult(record({ runId: 'hull', score: 15000, rank: 'S', survivalRule: 'hull-v1', flight: makeFlight() }));
  store.recordRunResult(record({ runId: 'classic', score: 10000, rank: 'A' }));
  assert.equal(recordKey(1, 'nolan', 'normal', true), 'm1:nolan:normal:pure');
  assert.equal(recordKey(1, 'nolan', 'normal', true, 'hull-v1'), 'm1:nolan:normal:pure:hull-v1');
  assert.equal(store.bestScoreForMission(1), 10000);
  assert.equal(store.bestScoreForMission(undefined, undefined, 'hull-v1'), 15000);
  assert.equal(store.bestRankForMission(1), 'A');
  assert.equal(store.bestRankForMission(1, 'nolan', 'hull-v1'), 'S');
  const loaded = new ArcadeProfileStore(storage);
  assert.deepEqual(loaded.getProfile().flights['nolan:1'].survival, survival);
  assert.equal(loaded.bestScoreForMission(1, 'nolan'), 10000);
  assert.equal(loaded.bestScoreForMission(1, 'nolan', 'hull-v1'), 15000);
  store.updateSettings({ survivalRule: 'classic-v1' });
  assert.equal(new ArcadeProfileStore(storage).getSettings().survivalRule, 'classic-v1');
  store.updateSettings({ survivalRule: 'future-rule' });
  assert.equal(store.getSettings().survivalRule, 'hull-v1');
  assert.equal(store.getProfile().wallet.credits, 521);
});

const run = { missionId: 1, pilotId: 'nolan', difficulty: 'normal', score: 300000, deaths: 0, specialsUsed: 0,
  continuesUsed: 0, assisted: false, practiceMode: false, formationsCleared: 10, sectorsClean: 7, totalSectors: 7,
  bossSeconds: 60, grazeCount: 30, maxChain: 30, victory: true, progressRatio: 1 };

test('rank and achievements use actual hits for hull runs and retain death fallback for classics', () => {
  assert.equal(evaluateArcadeRun(run).rank, 'S+');
  assert.ok(evaluateArcadeRun(run).badges.includes('NO-MISS'));
  assert.equal(evaluateArcadeRun({ ...run, hitsReceived: 1 }).rank, 'S');
  assert.equal(evaluateArcadeRun({ ...run, hitsReceived: 2 }).rank, 'A');
  assert.equal(evaluateArcadeRun({ ...run, hitsReceived: 3 }).rank, 'B');
  assert.equal(evaluateArcadeRun({ ...run, hitsReceived: 1 }).badges.includes('NO-MISS'), false);
  const signals = { ...run, competitiveEligible: true, archClean: true, rank: 'S+' };
  assert.ok(evaluateSimulationAchievements(signals).includes('no_miss'));
  assert.equal(evaluateSimulationAchievements({ ...signals, hitsReceived: 1 }).includes('no_miss'), false);
  assert.equal(evaluateSimulationAchievements({ ...signals, deaths: 1 }).includes('no_miss'), false);
  assert.ok(evaluateSimulationAchievements({ ...signals, hitsReceived: 0 }).includes('no_miss'));
});

test('replay v2 captures survival and initial conditions; v1 is explicitly classic and unsupported versions fail', () => {
  const meta = { missionId: 1, pilotId: 'nolan', difficulty: 'normal', assisted: false, seed: 1337 };
  const flight = makeFlight();
  const recorder = new ReplayRecorder({ ...meta, survivalRule: 'hull-v1', maxHull: 4, carry: flight,
    upLayout: 'pc', arena: { left: 160, right: 608, top: 18, bottom: 424 }, rapidFire: true });
  flight.survival.current = 4;
  const control = { x: 0.5, y: -1, fire: true, special: false, charge: false, focus: true };
  recorder.record(control);
  const replay = recorder.finish();
  assert.equal(REPLAY_FORMAT_VERSION, 2);
  assert.equal(replay.version, 2);
  assert.equal(replay.rapidFire, true);
  assert.equal(replay.upLayout, 'pc');
  assert.deepEqual(replay.carry.survival, survival);
  assert.equal(replay.arena.left, 160);
  const player = new ReplayPlayer(replay);
  assert.equal(player.survivalRule, 'hull-v1');
  assert.deepEqual(player.nextInput(), control);
  assert.equal(player.finished, true);
  replay.carry.survival.current = 4;
  assert.equal(recorder.finish().carry.survival.current, 1);
  const classic = new ReplayRecorder(meta).finish();
  assert.equal(classic.survivalRule, 'classic-v1');
  assert.equal(new ReplayPlayer({ ...classic, version: 1, survivalRule: undefined }).survivalRule, 'classic-v1');
  assert.throws(() => new ReplayPlayer({ ...replay, version: 99 }), /Unsupported replay format/);
  assert.throws(() => new ReplayPlayer({ ...replay, version: 1 }), /survival rule/);
  assert.throws(() => new ReplayPlayer({ ...replay, survivalRule: 'future-rule' }), /survival rule/);
  assert.throws(() => new ReplayPlayer({ ...replay, maxHull: 20 }), /hull capacity/);
});
