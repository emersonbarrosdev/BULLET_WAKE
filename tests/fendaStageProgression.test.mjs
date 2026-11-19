import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FAMILY, FENDA, MISSIONS, SOLAR, regionAt } from '../src/game/arcade/content.ts';
import {
  FENDA_COASTAL_CUTOFF_ROUTE,
  FENDA_FAMILY_MIN_ROUTE,
  FENDA_FAMILY_UNLOCK_REGION,
  FENDA_REGION_STARTS,
  FENDA_STAGE_DURATION,
  SOLAR_REGION_STARTS,
  SOLAR_STAGE_DURATION,
  isFamilyUnlockedAtFendaRoute,
} from '../src/game/arcade/PelagicProgression.ts';
import {
  FENDA_HARD_EXTRA_ENCOUNTERS,
  FENDA_NORMAL_EXTRA_ENCOUNTERS,
  FENDA_NORMAL_SUPPLIES,
  buildMissionEncounters,
} from '../src/game/arcade/PelagicDifficulty.ts';
import { PELAGIC_RARE_EARLY_AT, PELAGIC_RARE_FALLBACK_AT, PELAGIC_TIMED_EVENTS } from '../src/game/arcade/PelagicSpecialEvents.ts';
import { TIDE_ARCH_START_ROUTE } from '../src/game/arcade/PelagicTideArch.ts';
import { createPlayableStageAdapters } from '../src/devtools/DevStageAdapter.ts';
import { steer } from '../scripts/arcade-route.mjs';

test('01. Stage 1 duration is 360s with exact 7 region boundaries, DevStageAdapter matches without extra buttons, Stage 2 stays 300s', () => {
  assert.equal(FENDA_STAGE_DURATION, 360);
  assert.equal(SOLAR_STAGE_DURATION, 300);
  assert.deepEqual([...FENDA_REGION_STARTS], [0, 60, 115, 160, 180, 240, 300]);
  assert.deepEqual([...SOLAR_REGION_STARTS], [0, 45, 90, 135, 155, 200, 255]);
  assert.equal(TIDE_ARCH_START_ROUTE, 180);

  // Verify regionAt boundaries for UP (Fenda) and SIDE (Solar)
  assert.equal(regionAt(0, 'UP'), 0);
  assert.equal(regionAt(59.9, 'UP'), 0);
  assert.equal(regionAt(60, 'UP'), 1);
  assert.equal(regionAt(114.9, 'UP'), 1);
  assert.equal(regionAt(115, 'UP'), 2);
  assert.equal(regionAt(159.9, 'UP'), 2);
  assert.equal(regionAt(160, 'UP'), 3);
  assert.equal(regionAt(179.9, 'UP'), 3);
  assert.equal(regionAt(180, 'UP'), 4);
  assert.equal(regionAt(239.9, 'UP'), 4);
  assert.equal(regionAt(240, 'UP'), 5);
  assert.equal(regionAt(299.9, 'UP'), 5);
  assert.equal(regionAt(300, 'UP'), 6);
  assert.equal(regionAt(359.9, 'UP'), 6);

  assert.equal(regionAt(45, 'SIDE'), 1);
  assert.equal(regionAt(155, 'SIDE'), 4);
  assert.equal(SOLAR.encounters.length, 39, 'Stage 2 Cidade Solar encounters preserved');

  const adapters = createPlayableStageAdapters();
  const fendaAdapter = adapters[0];
  const solarAdapter = adapters[1];
  assert.equal(fendaAdapter.durationSeconds, 360);
  assert.equal(fendaAdapter.checkpoints.length, 8, 'Exact 7 region buttons + 1 boss button (no extra buttons)');
  assert.deepEqual(
    fendaAdapter.checkpoints.map((c) => c.atSeconds),
    [0, 60, 115, 160, 180, 240, 300, 360],
  );
  assert.equal(solarAdapter.durationSeconds, 300);
  assert.deepEqual(
    solarAdapter.checkpoints.map((c) => c.atSeconds),
    [0, 45, 90, 135, 155, 200, 255, 300],
  );
});

test('02. Static audit: ALL base, Normal extra, Hard extra, and special events strictly respect cumulative family unlocks & coastal cutoff', () => {
  const tables = [
    ['FENDA base', FENDA.encounters],
    ['NORMAL extra', FENDA_NORMAL_EXTRA_ENCOUNTERS],
    ['HARD extra', FENDA_HARD_EXTRA_ENCOUNTERS],
  ];

  for (const [label, list] of tables) {
    for (const enc of list) {
      assert.ok(enc.at > 0 && enc.at < FENDA_STAGE_DURATION, `${label}: wave @ ${enc.at}s must be inside 0..360s`);
      assert.ok(
        isFamilyUnlockedAtFendaRoute(enc.family, enc.at),
        `${label}: family '${enc.family}' @ ${enc.at}s (region ${regionAt(enc.at, 'UP')}) violates unlock rule (region >= ${FENDA_FAMILY_UNLOCK_REGION[enc.family]}, route >= ${FENDA_FAMILY_MIN_ROUTE[enc.family]}s)`,
      );
      if (enc.family === 'tower' || enc.family === 'tank') {
        assert.ok(
          enc.at <= FENDA_COASTAL_CUTOFF_ROUTE,
          `${label}: coastal '${enc.family}' @ ${enc.at}s must not spawn in open ocean (> ${FENDA_COASTAL_CUTOFF_ROUTE}s)`,
        );
      }
      assert.ok(
        !(enc.at >= 180 && enc.at < 214),
        `${label}: authored wave @ ${enc.at}s must not conflict with Tide Arch traversal (180-214s)`,
      );
    }
  }

  for (const ev of PELAGIC_TIMED_EVENTS) {
    for (const m of [...ev.members, ...(ev.hardExtra ?? [])]) {
      assert.ok(
        isFamilyUnlockedAtFendaRoute(m.family, ev.at),
        `Special event '${ev.id}' @ ${ev.at}s spawns '${m.family}' before unlock!`,
      );
    }
  }
  assert.ok(PELAGIC_RARE_EARLY_AT >= 240, 'Rare visitor UFO must not appear before Region 6 (240s)');
  assert.ok(PELAGIC_RARE_FALLBACK_AT >= 240 && PELAGIC_RARE_FALLBACK_AT < 360);

  // Verify progressive helicopter rollout order in FENDA
  const firstHeliAt = (fam) => FENDA.encounters.find((e) => e.family === fam)?.at ?? 999;
  assert.ok(firstHeliAt('heli_scout') >= 240);
  assert.ok(firstHeliAt('heli_scout') < firstHeliAt('heli_utility'), 'Scout must precede Utility');
  assert.ok(firstHeliAt('heli_utility') < firstHeliAt('heli_phantom'), 'Utility must precede Phantom');
  assert.ok(firstHeliAt('heli_phantom') < firstHeliAt('heli_warhawk'), 'Phantom must precede Warhawk');

  // Verify supplies stay strictly outside Tide Arch traversal (180-214s)
  assert.equal(FENDA_NORMAL_SUPPLIES.some((s) => s.at >= 180 && s.at <= 214), false);

  // Verify 1, 2, and 3 submarine formations exist cleanly from 160s onward
  const subWaves = FENDA.encounters.filter((e) => e.family === 'submarine');
  assert.ok(subWaves.some((e) => e.formation === 'solo'), '1-submarine encounter exists');
  assert.ok(subWaves.some((e) => e.formation === 'pair'), '2-submarine encounter exists');
  assert.ok(subWaves.some((e) => e.formation === 'trio'), '3-submarine encounter exists');
});

test('03. Helicopter proportions preserve hierarchy (Scout < Utility < Phantom < Warhawk) and remain smaller than warship', () => {
  assert.ok(FAMILY.heli_scout.size < FAMILY.heli_utility.size);
  assert.ok(FAMILY.heli_utility.size < FAMILY.heli_phantom.size);
  assert.ok(FAMILY.heli_phantom.size < FAMILY.heli_warhawk.size);
  assert.ok(FAMILY.heli_warhawk.size <= 46, `Warhawk (${FAMILY.heli_warhawk.size}) must be proportional to boat (41), never ship-sized (63)`);
  assert.ok(FAMILY.heli_scout.size <= 32, `Scout (${FAMILY.heli_scout.size}) must stay compact near fighters`);
});

test('04. 3-submarine formation spawns with distinct non-overlapping positions and reachable turrets', () => {
  const w = new ArcadeWorld(MISSIONS[0]);
  w.devJumpToCheckpoint(168, { pauseDirector: true, isolated: true, seed: 1337 });
  w.devSpawnEncounter({ family: 'submarine', formation: 'trio', motion: 'stationary', lane: 0.5 }, { keepExisting: false });
  assert.equal(w.enemies.length, 3);
  for (let i = 0; i < 3; i++) {
    const a = w.enemies[i];
    assert.ok(a.y >= 65 && a.y <= 235, `Submarine #${i} y=${a.y} must be reachable above player`);
    assert.ok(a.x >= w.arena.left + 28 && a.x <= w.arena.right - 28);
    for (let j = i + 1; j < 3; j++) {
      const b = w.enemies[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(dist >= 58, `Submarines ${i} and ${j} must not overlap (dist=${dist.toFixed(1)}px)`);
    }
  }
});

test('05. Full continuous 360s campaign simulation across Easy, Normal, and Hard enforces zero premature family spawns and boss at 360s', () => {
  for (const diff of /** @type {const} */ (['easy', 'normal', 'hard'])) {
    const w = new ArcadeWorld(MISSIONS[0]);
    w.setDifficulty(diff);
    w.devInvincible = true;

    const seenIds = new Set();
    const violations = [];
    const seenFamilies = new Set();
    let bossStartedAt = -1;
    let archStartedAt = -1;
    let checkpointAt = -1;

    const dt = 1 / 60;
    for (let step = 0; step < 60 * 520; step++) {
      const inp = steer(w, { collect: true, evade: true, special: true });
      w.step(dt, inp);

      if (archStartedAt < 0 && w.tideArch.isActive) archStartedAt = w.route;
      if (checkpointAt < 0 && w.checkpoint) checkpointAt = w.route;
      if (bossStartedAt < 0 && w.boss) bossStartedAt = w.route;

      for (const e of w.enemies) {
        if (seenIds.has(e.id)) continue;
        seenIds.add(e.id);
        seenFamilies.add(e.family);
        // Tide Arch cliff cannons ('tower' / 'boat' with archPattern/archBoat) are valid in Region 4 (180s >= 115s unlock)
        if (!isFamilyUnlockedAtFendaRoute(e.family, w.route)) {
          violations.push(`${diff}: '${e.family}' spawned at route=${w.route.toFixed(2)}s (region=${w.region})`);
        }
      }

      if (w.state === 'victory') break;
    }

    assert.equal(violations.length, 0, `Progression violations in ${diff}: ${violations.slice(0, 5).join('; ')}`);
    assert.ok(archStartedAt >= 180 && archStartedAt < 181, `${diff}: Tide Arch must start at 180s (got ${archStartedAt})`);
    assert.ok(checkpointAt >= 204 && checkpointAt <= 220, `${diff}: Tide Arch checkpoint must activate after crossing (got ${checkpointAt})`);
    assert.ok(bossStartedAt >= 360, `${diff}: Colosso Abissal must not start before 360s (got ${bossStartedAt})`);
    assert.equal(w.state, 'victory', `${diff}: full 360s campaign + Colosso Abissal must reach victory`);

    // Verify all main families actually appeared across the full run
    for (const fam of ['fighter', 'acrobat', 'bomber', 'boat', 'ship', 'interceptor', 'tower', 'tank', 'submarine', 'heli_scout', 'heli_utility', 'heli_phantom', 'heli_warhawk']) {
      assert.ok(seenFamilies.has(fam), `${diff}: expected family '${fam}' to appear during full 360s run`);
    }
  }
});

test('06. Tide Arch checkpoint save/restart preserves state cleanly without duplicating supplies, and manual DEV spawn remains unrestricted', () => {
  const w = new ArcadeWorld(MISSIONS[0]);
  w.setDifficulty('normal');
  w.devJumpTideArch('checkpoint', false, false);
  assert.ok(w.checkpoint, 'Checkpoint snapshot created');
  assert.ok(w.checkpoint.route >= 210 && w.checkpoint.route <= 216);
  const snap = structuredClone(w.checkpoint);
  assert.equal(w.restartFromCheckpoint(snap), true);
  assert.equal(w.region, 4);
  assert.equal(FENDA_NORMAL_SUPPLIES[w.supplyIndex]?.at, 220, 'Next supply after checkpoint is 220s (no duplicates)');

  // Manual DEV spawner can still create any family at 0s for isolated debugging
  const devW = new ArcadeWorld(MISSIONS[0]);
  devW.devJumpToCheckpoint(0, { pauseDirector: true, isolated: true });
  devW.devSpawnEncounter({ family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: 0.5 });
  assert.equal(devW.enemies.length, 1);
  assert.equal(devW.enemies[0].family, 'heli_warhawk');
});

test('07. Build encounters returns rich 360s wave counts scaling cleanly across Easy < Normal < Hard', () => {
  const easyCount = buildMissionEncounters(FENDA, 'easy').length;
  const normalCount = buildMissionEncounters(FENDA, 'normal').length;
  const hardCount = buildMissionEncounters(FENDA, 'hard').length;
  assert.ok(easyCount >= 85, `Expected dense 360s base waves >= 85, got ${easyCount}`);
  assert.ok(normalCount > easyCount, `Normal (${normalCount}) > Easy (${easyCount})`);
  assert.ok(hardCount > normalCount, `Hard (${hardCount}) > Normal (${normalCount})`);
});
