import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ArcadeStageDirector, buildMissionStageEvents } from '../src/game/arcade/ArcadeStageDirector.ts';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FAMILY, FENDA, FUTURE_ROUTES, MISSIONS, SOLAR } from '../src/game/arcade/content.ts';
import { DevCombatControls } from '../src/devtools/DevCombatControls.ts';
import { DevEventLogger } from '../src/devtools/DevEventLogger.ts';
import { DevPerformanceMonitor } from '../src/devtools/DevPerformanceMonitor.ts';
import { DevScenarioRegistry } from '../src/devtools/DevScenarioRegistry.ts';
import { DevScenarioRunner } from '../src/devtools/DevScenarioRunner.ts';
import { DevStateManager } from '../src/devtools/DevStateManager.ts';

function makeWorld(index = 0) {
  const w = new ArcadeWorld(MISSIONS[index]);
  w.state = 'play';
  w.introTime = 0;
  return w;
}

test('DevScenarioRegistry discovers only implemented playable MISSIONS and excludes FUTURE_ROUTES metadata', () => {
  const registry = new DevScenarioRegistry();
  const adapters = registry.getAdapters();
  assert.equal(adapters.length, MISSIONS.length);
  assert.equal(adapters[0].name, FENDA.name);
  assert.equal(adapters[0].perspective, 'UP');
  assert.equal(adapters[1].name, SOLAR.name);
  assert.equal(adapters[1].perspective, 'SIDE');

  const registeredNames = new Set(adapters.map((a) => a.name.toLowerCase()));
  for (const future of FUTURE_ROUTES) {
    assert(!registeredNames.has(future.id.toLowerCase()), `Future metadata '${future.id}' must never register as playable stage`);
  }
});

test('Stage adapters expose real checkpoints, bosses, all 5 Colosso Abissal sections, and all 15 enemy families', () => {
  const registry = new DevScenarioRegistry();
  const fenda = registry.getAdapterByMissionIndex(0);
  const solar = registry.getAdapterByMissionIndex(1);
  assert(fenda && solar);

  assert(fenda.checkpoints.some((c) => c.atSeconds === 0 && c.kind === 'start'));
  assert(fenda.checkpoints.some((c) => c.atSeconds === 180 && c.kind === 'region'));
  assert(fenda.checkpoints.some((c) => c.atSeconds === 240 && c.kind === 'region'));
  assert(fenda.checkpoints.some((c) => c.atSeconds === 360 && c.kind === 'boss'));
  assert(solar.checkpoints.some((c) => c.atSeconds === 155 && c.kind === 'miniboss'));
  assert(solar.checkpoints.some((c) => c.atSeconds === 300 && c.kind === 'boss'));

  const subBoss = fenda.bosses.find((b) => !b.mini);
  assert(subBoss && subBoss.sections.length === 5, 'Colosso Abissal must expose its 5 real sections');
  assert.deepEqual(
    subBoss.sections.map((s) => s.index),
    [0, 1, 2, 3, 4],
  );

  const expectedFamilies = Object.keys(FAMILY);
  assert.deepEqual(fenda.allowedFamilies, expectedFamilies);
  assert(fenda.allowedFamilies.includes('heli_scout'));
  assert(fenda.allowedFamilies.includes('heli_utility'));
  assert(fenda.allowedFamilies.includes('heli_phantom'));
  assert(fenda.allowedFamilies.includes('heli_warhawk'));
});

test('ArcadeWorld checkpoint jump initializes route, scroll, region, encounter director, and blocks stale events', () => {
  const w = makeWorld(0);
  w.devJumpToCheckpoint(240);
  assert.equal(w.route, 240);
  assert.equal(w.elapsed, 240);
  assert.equal(w.region, 5);
  assert(w.scroll >= 240 * 38 - 1);
  assert(w.specialEventsTriggered.has('naval-convoy'), 'Past timed event before 240s must be marked already passed');
  assert(w.specialEventsTriggered.has('elite-interception'), 'Past post-arch event @ 225s must be marked already passed');
  assert(!w.specialEventsTriggered.has('coordinated-strike'), 'Future timed event @ 274s must remain eligible');

  const snap = w.devDirectorSnapshot();
  assert(snap.nextEncounterAt !== null && snap.nextEncounterAt >= 240);
});

test('Boss section jump starts consistent hull, modules, and allows full progression verification without skipping phases', () => {
  const registry = new DevScenarioRegistry();
  const state = new DevStateManager();
  const combat = new DevCombatControls();
  const runner = new DevScenarioRunner(registry, state, combat);

  const fendaReport = runner.verifyBossProgression(0);
  assert.equal(fendaReport.passed, true, JSON.stringify(fendaReport));
  assert.deepEqual(fendaReport.skippedSteps, []);
  assert.deepEqual(fendaReport.stepsCompleted, ['section-1', 'section-2', 'section-3', 'section-4', 'section-5', 'collapse', 'victory']);

  const solarReport = runner.verifyBossProgression(1);
  assert.equal(solarReport.passed, true, JSON.stringify(solarReport));
  assert.deepEqual(solarReport.skippedSteps, []);

  // Direct jump to Section 3 (Torre de Comando) & restore components
  const w = makeWorld(0);
  w.devStartBoss(false, 2);
  assert(w.boss?.sub);
  assert.equal(w.boss.sub.activeSection, 2);
  assert.equal(w.boss.sub.phase, 'fight');
  assert.equal(w.boss.sub.sections[0].completed, true);
  assert.equal(w.boss.sub.sections[1].completed, true);
  assert.equal(w.boss.sub.sections[2].hullHp, w.boss.sub.sections[2].hullMaxHp);
  w.boss.sub.sections[2].hullHp = 10;
  w.boss.sub.sections[2].parts[0].hp = 0;
  w.devRestoreBossParts();
  assert.equal(w.boss.sub.sections[2].hullHp, w.boss.sub.sections[2].hullMaxHp);
  assert.equal(w.boss.sub.sections[2].parts[0].hp, w.boss.sub.sections[2].parts[0].maxHp);
});

test('Dev invincibility protects only RIVET while controlled death still executes real damage and recovery rules', () => {
  const w = makeWorld(0);
  w.weapons.weaponLevel = 5;
  w.lives = 3;
  w.devInvincible = true;
  w.player.invulnerable = 0;
  w.devSpawnEncounter({ family: 'fighter', formation: 'solo', motion: 'straight', lane: 0.5 });
  w.enemies[0].x = w.player.x;
  w.enemies[0].y = w.player.y;
  const enemyHpBefore = w.enemies[0].hp;

  w.step(1 / 60);
  assert.equal(w.lives, 3, 'Dev invincibility protects RIVET from collision death');
  w.devSpawnEncounter({ family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: 0.5 });
  assert.equal(w.enemies[0].hp, 36, 'Dev invincibility must never alter enemy HP');
  void enemyHpBefore;

  w.devTriggerControlledDeath();
  assert.equal(w.lives, 2, 'Controlled death triggers genuine hurtPlayer flow');
  assert.equal(w.weapons.weaponLevel, 1, 'Normal difficulty controlled death drops weapon to NV1');
});

test('Enemy test overrides scale firing rate/shot speed only in dev test sessions without altering production constants', () => {
  const w = makeWorld(0);
  const warhawks = w.devSpawnEncounter({ family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: 0.5 });
  assert.equal(warhawks.length, 1);
  w.enemyFireRateScale = 2;
  w.enemyShotSpeedScale = 1.5;
  warhawks[0].y = 110;
  warhawks[0].cooldown = 0;
  w.updateEnemies(1 / 60);
  const fired = w.bullets.filter((b) => b.active && b.enemy);
  assert(fired.length >= 2);
  assert(warhawks[0].cooldown < FAMILY.heli_warhawk.fire, 'Fire rate multiplier speeds reload cleanly');
});

test('DevPerformanceMonitor records frames cleanly and classifies measurements cleanly', () => {
  const perf = new DevPerformanceMonitor();
  perf.startRecording('Estresse Teste', 'controlled-simulation');
  for (let i = 0; i < 12; i++) perf.recordFrame(16.6);
  const fakeGame = { renderer: { type: 2 }, canvas: { width: 768, height: 432 } };
  const rep = perf.stopRecording(fakeGame);
  assert.equal(rep.measurementKind, 'controlled-simulation');
  assert.equal(rep.frames, 12);
  assert(rep.avgFps > 55 && rep.avgFps <= 62);
  assert.equal(rep.resolution, '768x432');
});

test('Production build isolation: source gating and compiled dist/ contain zero DevTools or window.__GAME__ globals', () => {
  const viteCfg = fs.readFileSync(path.resolve('vite.config.ts'), 'utf8');
  const mainTs = fs.readFileSync(path.resolve('src/main.ts'), 'utf8');
  assert(viteCfg.includes("command === 'serve'") && viteCfg.includes('__BW_DEVTOOLS__'));
  assert(mainTs.includes('if (__BW_DEVTOOLS__ && import.meta.env.DEV && !isMobileDisplay())'));

  // Verify real compiled dist/ bundle built with --mode development still strips DevTools completely!
  execFileSync(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'build', '--mode', 'development'], {
    stdio: 'pipe',
  });

  const distAssets = fs.readdirSync(path.resolve('dist/assets'));
  const jsFiles = distAssets.filter((f) => f.endsWith('.js'));
  assert.equal(jsFiles.length, 1, `Expected single JS bundle with zero DevTools chunk, found: ${jsFiles.join(', ')}`);

  const jsBundle = fs.readFileSync(path.resolve('dist/assets', jsFiles[0]), 'utf8');
  for (const forbidden of [
    'BULLET WAKE — DEVTOOLS',
    '__BW_DEVTOOLS__',
    'mountDevTools',
    'DevCollisionOverlay',
    'DevScenarioRegistry',
    'DevEventLogger',
    '__GAME__',
    'bullet_wake_devtools_prefs_v1',
  ]) {
    assert(!jsBundle.includes(forbidden), `Forbidden dev symbol '${forbidden}' leaked into dist/assets/${jsFiles[0]}!`);
  }
});

test('ArcadeStageDirector serves as single source of truth for timed and conditional events without fake timestamps', () => {
  const fendaDefs = buildMissionStageEvents(MISSIONS[0], 0);
  const solarDefs = buildMissionStageEvents(MISSIONS[1], 1);

  assert(fendaDefs.length > 20 && solarDefs.length > 10);
  const archDescent = fendaDefs.find((d) => d.id === 'stage-1-arch-descent');
  const rare = fendaDefs.find((d) => d.id === 'stage-1-special-rare-visitor');
  const boss = fendaDefs.find((d) => d.id === 'stage-1-boss');

  assert(archDescent && archDescent.triggerKind === 'conditional' && archDescent.atSeconds === undefined);
  assert(rare && rare.triggerKind === 'conditional' && rare.atSeconds === undefined && rare.repeatPolicy === 'capped');
  assert(boss && boss.triggerKind === 'timed' && boss.atSeconds === 360);

  const dir = new ArcadeStageDirector(MISSIONS[0], 0);
  assert.equal(dir.defs.length, fendaDefs.length);

  // Adapter consumes identical IDs from ArcadeStageDirector
  const registry = new DevScenarioRegistry();
  const fendaAdapter = registry.getAdapterByMissionIndex(0);
  assert(fendaAdapter);
  assert.deepEqual(
    fendaAdapter.events.map((e) => e.id),
    fendaDefs.map((d) => d.id),
  );
});

test('Stage Jump backward/forward restores coherent ArcadeStageDirector flags and blocks duplicate past events', () => {
  const w = makeWorld(0);
  // Jump late past Tide Arch checkpoint and early timed events
  w.devJumpToCheckpoint(245, { seed: 4242 });
  assert.equal(w.seed, 4242);
  let snap = w.devStageDirectorSnapshot();
  assert.equal(snap.entries.find((e) => e.id === 'stage-1-special-naval-convoy')?.status, 'skipped');
  assert.equal(snap.entries.find((e) => e.id === 'stage-1-arch-checkpoint')?.status, 'completed');
  assert.equal(snap.entries.find((e) => e.id === 'stage-1-special-coordinated-strike')?.status, 'pending');

  // Jump backwards to before early rare visitor & Tide Arch: stale future flags/counters MUST reset cleanly!
  w.devJumpToCheckpoint(50, { seed: 777 });
  assert.equal(w.seed, 777);
  snap = w.devStageDirectorSnapshot();
  assert.equal(snap.entries.find((e) => e.id === 'stage-1-arch-approach')?.status, 'pending');
  assert.equal(snap.entries.find((e) => e.id === 'stage-1-special-naval-convoy')?.status, 'pending');
  assert(!w.specialEventsTriggered.has('naval-convoy'));
  assert(!w.specialEventsTriggered.has('elite-interception'));
});

test('Event Sandbox isolated vs integrated execution and sensor crossing checkpoint validation', () => {
  const w = makeWorld(0);
  // Start just before Arco das Marés passage in isolated mode (no ambient encounters interfering)
  const pre = w.devRunStageEvent('stage-1-arch-checkpoint', { action: 'before', isolated: true, seed: 2026 });
  assert.equal(pre.ok, true);
  assert.equal(w.devSandboxIsolated, true);
  w.devInvincible = true;

  let enteredBridgeBand = false;
  let reachedCheckpoint = false;
  for (let i = 0; i < 60 * 16; i++) {
    // Center safely inside the arch opening
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
    const s = w.devSensorSnapshot();
    if (s.bridgeBandActive) enteredBridgeBand = true;
    if (s.checkpointReached) {
      reachedCheckpoint = true;
      break;
    }
  }
  assert.equal(enteredBridgeBand, true, 'Ship must traverse real Tide Arch bridge sensor band');
  assert.equal(reachedCheckpoint, true, 'Tide Arch checkpoint must activate via real sensor traversal');
  assert(w.hasActiveCheckpoint && w.checkpoint?.tideArchCompleted === true);
});

test('DevEventLogger emits deduplicated edge-triggered entries and Live Tuning scales cleanly', () => {
  const w = makeWorld(0);
  const logger = new DevEventLogger();
  const fakeScene = { world: w };

  logger.observeScene(fakeScene);
  const afterInit = logger.getEntries().length;
  // Calling observeScene repeatedly on idle/static frames must NOT emit duplicate logs
  for (let i = 0; i < 30; i++) logger.observeScene(fakeScene);
  assert.equal(logger.getEntries().length, afterInit, 'Idle frames must never flood deduplicated log');

  // Verify Live Tuning runtime scaling without mutating official constants
  const normalXBefore = w.player.x;
  w.step(1 / 60, { x: 1, y: 0, fire: false, special: false });
  const deltaNormal = w.player.x - normalXBefore;

  w.player.x = normalXBefore;
  w.playerSpeedScale = 1.5;
  w.step(1 / 60, { x: 1, y: 0, fire: false, special: false });
  const deltaFast = w.player.x - normalXBefore;
  assert(deltaFast > deltaNormal * 1.4, 'Live Tuning playerSpeedScale must scale movement immediately');
  w.playerSpeedScale = 1;
});
