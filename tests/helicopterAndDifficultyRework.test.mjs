import assert from 'node:assert/strict';
import test from 'node:test';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FAMILY, MISSIONS } from '../src/game/arcade/content.ts';
import { heliSheetFrame, rotorSheetFrame } from '../src/game/arcade/PelagicActorAnimsMath.ts';
import {
  DIFFICULTY_PROFILES,
  buildMissionEncounters,
  migrateLegacyDifficulty,
  normalizeGameDifficulty,
  resolveEnemyMaxHp,
  stepGameDifficulty,
} from '../src/game/arcade/PelagicDifficulty.ts';
import { computeHelicopterSlotLayout, isHelicopter } from '../src/game/arcade/PelagicHelicopterMovement.ts';
import { computeArchOpening } from '../src/game/arcade/PelagicTideArch.ts';
import { resolveHullVisualTransform } from '../src/game/arcade/PelagicWeaponMounts.ts';
import { CURRENT_SCHEMA_VERSION, SaveSystem } from '../src/game/systems/saveSystem.ts';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function runHeliScenario(spec, durationSec = 10, seed = 42, extra = []) {
  const w = new ArcadeWorld(MISSIONS[0], undefined, { seed, difficulty: 'normal' });
  w.devJumpToCheckpoint(10, { pauseDirector: true, isolated: true, seed });
  w.devInvincible = true;
  w.clearArenaEntities();
  const group = w.devSpawnEncounter(spec);
  for (const ex of extra) {
    w.devSpawnEncounter(ex, { keepExisting: true });
  }
  const ids = group.map(a => a.id);
  const dt = 1 / 60;
  const steps = Math.round(durationSec / dt);

  let crossings = 0;
  let minPairDist = Infinity;
  let maxStepVelJump = 0;
  let maxHoverYawRad = 0;
  let enteredArenaCount = 0;
  const enteredSet = new Set();
  const rotorFrames = new Set();

  let initialOrder = null;
  let prevVel = new Map();

  for (let s = 0; s < steps; s++) {
    w.step(dt, { x: 0, y: 0, fire: false, special: false });
    w.events.length = 0;

    const liveGroup = ids
      .map(id => w.enemies.find(e => e.id === id))
      .filter(e => e && e.hp > 0);

    for (const e of liveGroup) {
      if (e.x >= w.arena.left && e.x <= w.arena.right && e.y >= w.arena.top && e.y <= w.arena.bottom) {
        enteredSet.add(e.id);
      }
      rotorFrames.add(rotorSheetFrame(e.family, w.elapsed, e.offset, false));
      const tr = resolveHullVisualTransform(e, w.elapsed, s);
      const yaw = Math.abs(tr.rotation - Math.PI);
      if ((e.vy ?? e.speed) < 35 && e.age > 1.2) {
        maxHoverYawRad = Math.max(maxHoverYawRad, yaw);
      }

      const prev = prevVel.get(e.id);
      const vx = e.vx ?? 0;
      const vy = e.vy ?? e.speed;
      if (prev && e.age > 0.12) {
        const dv = Math.hypot(vx - prev.vx, vy - prev.vy);
        maxStepVelJump = Math.max(maxStepVelJump, dv);
      }
      prevVel.set(e.id, { vx, vy });
    }
    enteredArenaCount = enteredSet.size;

    const activeInside = liveGroup.filter(
      e => e.y > w.arena.top - 10 && e.y < w.arena.bottom + 10 && e.x > w.arena.left - 24 && e.x < w.arena.right + 24,
    );
    if (activeInside.length >= 2) {
      for (let i = 0; i < activeInside.length; i++) {
        for (let j = i + 1; j < activeInside.length; j++) {
          const d = Math.hypot(activeInside[i].x - activeInside[j].x, activeInside[i].y - activeInside[j].y);
          minPairDist = Math.min(minPairDist, d);
        }
      }
      if (!initialOrder && activeInside.length === liveGroup.length) {
        const sameX = activeInside.some((a, idx) => idx > 0 && Math.abs(a.x - activeInside[idx - 1].x) < 1);
        if (!sameX) {
          initialOrder = activeInside.map(a => a.id).sort((idA, idB) => {
            const a = activeInside.find(u => u.id === idA);
            const b = activeInside.find(u => u.id === idB);
            return a.x - b.x;
          });
        }
      }
      if (initialOrder && activeInside.length === initialOrder.length) {
        for (let k = 1; k < initialOrder.length; k++) {
          const leftUnit = activeInside.find(u => u.id === initialOrder[k - 1]);
          const rightUnit = activeInside.find(u => u.id === initialOrder[k]);
          if (leftUnit && rightUnit && leftUnit.x > rightUnit.x - 4) {
            crossings++;
          }
        }
      }
    }
  }

  return {
    spawnedCount: group.length,
    enteredArenaCount,
    crossings,
    minPairDist: Number.isFinite(minPairDist) ? minPairDist : 999,
    maxStepVelJump,
    maxHoverYawRad,
    rotorFrameCount: rotorFrames.size,
    remainingAfterDuration: ids.filter(id => w.enemies.some(e => e.id === id && e.hp > 0)).length,
  };
}

test('Helicopter movement overhaul: all 10 scenarios run smoothly with 0 trajectory crossings and bounded yaw', () => {
  const s1 = runHeliScenario({ family: 'heli_scout', formation: 'solo', motion: 'curve', lane: 0.50, speed: 118 }, 8);
  assert.equal(s1.spawnedCount, 1);
  assert.equal(s1.enteredArenaCount, 1);
  assert.equal(s1.remainingAfterDuration, 0, 'heli_scout solo exits cleanly');

  const s2 = runHeliScenario({ family: 'heli_scout', formation: 'pair', motion: 'sine', lane: 0.50, speed: 114 }, 8);
  assert.equal(s2.spawnedCount, 2);
  assert.equal(s2.crossings, 0, 'heli_scout top pair must never cross paths');
  assert.ok(s2.minPairDist >= 34, `min separation too tight: ${s2.minPairDist}`);
  assert.ok(s2.maxStepVelJump < 120, `velocity jump too abrupt: ${s2.maxStepVelJump}`);

  const s3 = runHeliScenario({ family: 'heli_scout', formation: 'pair', motion: 'side-curve', entry: 'left', lane: 0.30, speed: 120 }, 8);
  assert.equal(s3.spawnedCount, 2);
  assert.equal(s3.enteredArenaCount, 2);
  assert.equal(s3.crossings, 0, 'heli_scout left pair must never cross');
  assert.ok(s3.minPairDist >= 34, `left pair minDist=${s3.minPairDist}`);

  const s4 = runHeliScenario({ family: 'heli_scout', formation: 'pair', motion: 'side-curve', entry: 'right', lane: 0.30, speed: 120 }, 8);
  assert.equal(s4.spawnedCount, 2);
  assert.equal(s4.enteredArenaCount, 2);
  assert.equal(s4.crossings, 0, 'heli_scout right pair must never cross');

  const s5 = runHeliScenario({ family: 'heli_scout', formation: 'trio', motion: 'curve', lane: 0.50, speed: 118 }, 8);
  assert.equal(s5.spawnedCount, 3);
  assert.equal(s5.crossings, 0, 'heli_scout trio must preserve lane order');
  assert.ok(s5.minPairDist >= 34, `trio minDist=${s5.minPairDist}`);

  const s6 = runHeliScenario({ family: 'heli_utility', formation: 'pair', motion: 'stationary', lane: 0.50, speed: 76 }, 12);
  assert.equal(s6.spawnedCount, 2);
  assert.equal(s6.crossings, 0, 'heli_utility pair hover must never cross');
  assert.ok(s6.minPairDist >= 42, `heli_utility minDist=${s6.minPairDist}`);
  assert.ok(s6.maxHoverYawRad <= 0.25, `heli_utility hover yaw exceeded safe bound: ${s6.maxHoverYawRad}`);
  assert.equal(s6.remainingAfterDuration, 0, 'heli_utility departs cleanly after hover');

  const s7 = runHeliScenario({ family: 'heli_phantom', formation: 'pair', motion: 'side-curve', entry: 'left', lane: 0.28, speed: 128 }, 12);
  assert.equal(s7.spawnedCount, 2);
  assert.equal(s7.crossings, 0, 'heli_phantom side pair must sweep smoothly without crossing');
  assert.ok(s7.maxStepVelJump < 130, `heli_phantom max velocity jump=${s7.maxStepVelJump}`);

  const s8 = runHeliScenario({ family: 'heli_phantom', formation: 'trio', motion: 'curve', lane: 0.50, speed: 130 }, 12);
  assert.equal(s8.spawnedCount, 3);
  assert.equal(s8.crossings, 0, 'heli_phantom trio must never cross');
  assert.ok(s8.minPairDist >= 40, `heli_phantom trio minDist=${s8.minPairDist}`);

  const s9a = runHeliScenario({ family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: 0.50, speed: 82 }, 13);
  const s9b = runHeliScenario({ family: 'heli_warhawk', formation: 'pair', motion: 'stationary', lane: 0.50, speed: 82 }, 13);
  assert.equal(s9a.spawnedCount, 1);
  assert.equal(s9b.spawnedCount, 2);
  assert.equal(s9b.crossings, 0, 'heli_warhawk pair must never cross');
  assert.ok(s9b.maxHoverYawRad <= 0.18, `heli_warhawk yaw bound=${s9b.maxHoverYawRad}`);
  assert.ok(s9b.rotorFrameCount >= 8, 'rotor spritesheet cycles all 8 frames smoothly');

  const s10 = runHeliScenario(
    { family: 'heli_scout', formation: 'pair', motion: 'sine', lane: 0.50, speed: 118 },
    9,
    42,
    [
      { family: 'fighter', formation: 'trio', motion: 'curve', lane: 0.40, speed: 110 },
      { family: 'boat', formation: 'solo', motion: 'stationary', lane: 0.35 },
      { family: 'submarine', formation: 'solo', motion: 'stationary', lane: 0.65 },
    ],
  );
  assert.equal(s10.crossings, 0, 'mixed combat does not disturb helicopter formation ordering');

  const layout = computeHelicopterSlotLayout('heli_utility', 'pair', 2, 0, { left: 160, right: 608, top: 18, bottom: 424 }, 384);
  assert.ok(isHelicopter('heli_utility'));
  assert.equal(isHelicopter('fighter'), false);
  assert.ok(layout.state.slotOffsetX < 0);
  assert.ok(heliSheetFrame('heli_phantom', 0, false) >= 12);
});

test('Difficulty tiering, HP multipliers, menu cycling, and v1/v2->v3 save migration preserve progression', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, 3);
  assert.equal(migrateLegacyDifficulty('normal', 2), 'easy');
  assert.equal(migrateLegacyDifficulty('hard', 2), 'normal');
  assert.equal(migrateLegacyDifficulty('arcade', 2), 'arcade');
  assert.equal(migrateLegacyDifficulty(undefined, 1), 'easy');
  assert.equal(normalizeGameDifficulty('arcade'), 'hard');
  assert.equal(stepGameDifficulty('easy', 1), 'normal');
  assert.equal(stepGameDifficulty('normal', 1), 'hard');
  assert.equal(stepGameDifficulty('hard', 1), 'easy');

  for (const fam of Object.keys(FAMILY)) {
    const baseHp = FAMILY[fam].hp;
    assert.equal(resolveEnemyMaxHp(fam, 'easy'), baseHp);
    assert.equal(resolveEnemyMaxHp(fam, 'normal'), baseHp);
    assert.ok(resolveEnemyMaxHp(fam, 'hard') > baseHp, `Expected hard HP > base for ${fam}`);
  }

  const easyEnc = buildMissionEncounters(MISSIONS[0], 'easy');
  const normEnc = buildMissionEncounters(MISSIONS[0], 'normal');
  const hardEnc = buildMissionEncounters(MISSIONS[0], 'hard');
  assert.equal(easyEnc.length, MISSIONS[0].encounters.length);
  assert.ok(normEnc.length > easyEnc.length);
  assert.ok(hardEnc.length > normEnc.length);

  // New install defaults to 'normal'
  const previous = globalThis.window;
  try {
    delete globalThis.window;
    const fresh = new SaveSystem();
    assert.equal(fresh.getSettings().difficulty, 'normal');
    assert.equal(fresh.getSettings().assisted, false);

    // Assisted overrides effective difficulty without mutating saved setting
    const w = new ArcadeWorld(MISSIONS[0], undefined, { difficulty: 'hard' });
    w.assisted = true;
    assert.equal(w.difficulty, 'hard');
    assert.equal(w.effectiveDifficulty, 'easy');
    w.assisted = false;
    assert.equal(w.effectiveDifficulty, 'hard');
  } finally {
    if (previous !== undefined) globalThis.window = previous;
  }
});

const BOT_DIRS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0.707, 0.707],
  [0.707, -0.707],
  [-0.707, 0.707],
  [-0.707, -0.707],
];

function twoPlyAceBot(w) {
  const isHard = w.difficulty === 'hard';
  const archOpening = w.up && w.tideArch?.isActive ? computeArchOpening(w.arena.left, w.arena.right) : null;
  const minSafeX = archOpening ? archOpening.left + 22 : w.arena.left + 24;
  const maxSafeX = archOpening ? archOpening.right - 22 : w.arena.right - 24;
  let tx = 384;
  let ty = 376;
  const p = w.player;
  const b = w.boss;
  const parts = b?.phase === 'fight' ? b.parts.filter(pt => pt.hp > 0) : [];
  if (parts.length) {
    const part = [...parts].sort((a, q) => Math.abs(a.x - p.x) - Math.abs(q.x - p.x))[0];
    tx = clamp(part.x, minSafeX, maxSafeX);
    ty = 384;
  } else if (b?.sub?.phase === 'fight' && b.sub.sections[b.sub.activeSection].hullHp > 0) {
    tx = b.x;
    ty = 384;
  } else {
    const target = w.enemies
      .filter(e => e.y < p.y - 55 && e.y > 42)
      .sort((a, q) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(q.x - p.x, q.y - p.y))[0];
    if (target) {
      tx = clamp(target.x, minSafeX, maxSafeX);
      ty = 374;
    }
  }
  const openPickup = w.cargo.find(
    c => !c.crate && c.age < 21 && c.x > minSafeX && c.x < maxSafeX && c.y > 160 && c.y < w.arena.bottom - 14,
  );
  const cargo =
    openPickup ??
    w.cargo.find(c => c.age < 21 && c.x > minSafeX && c.x < maxSafeX && c.y > 80 && c.y < w.arena.bottom - 14);
  const nearBullets = w.bullets.filter(bl => bl.active && bl.enemy && Math.hypot(bl.x - p.x, bl.y - p.y) < 130);
  if (!b && nearBullets.length === 0 && cargo) {
    tx = clamp(cargo.x, minSafeX, maxSafeX);
    ty = cargo.crate ? Math.min(392, cargo.y + 92) : cargo.y;
  }
  const clx = v => clamp(v, w.arena.left + 14, w.arena.right - 14);
  const cly = v => clamp(v, w.arena.top + 16, w.arena.bottom - 15);
  const nearAir = w.enemies.filter(e => !e.ground && Math.hypot(e.x - p.x, e.y - p.y) < 120);
  const nearDrones = w.cargo.filter(c => c.crate && Math.hypot(c.x - p.x, c.y - p.y) < 100);

  const evalLeg = (x0, y0, dx, dy, tStart, tSteps) => {
    let cost = 0;
    if (isHard && tStart === 0) {
      for (const tImm of [1 / 120, 2 / 120]) {
        const px = clx(x0 + dx * 174 * tImm);
        const py = cly(y0 + dy * 174 * tImm);
        for (const bullet of nearBullets) {
          const d = Math.hypot(bullet.x + bullet.vx * tImm - px, bullet.y + bullet.vy * tImm - py);
          if (d < bullet.radius + 7.2) cost += 50000 / (d + 0.1);
        }
      }
    }
    for (const tRel of tSteps) {
      const t = tStart + tRel;
      const px = clx(x0 + dx * 174 * tRel);
      const py = cly(y0 + dy * 174 * tRel);
      for (const bullet of nearBullets) {
        const d = Math.hypot(bullet.x + bullet.vx * t - px, bullet.y + bullet.vy * t - py);
        if (d < bullet.radius + 11) cost += 6000 / (d + 0.5);
        else if (d < bullet.radius + 20) cost += 220 / (d + 1);
      }
      for (const e of nearAir) {
        const d = Math.hypot(e.x + (e.vx ?? 0) * t - px, e.y + (e.vy ?? e.speed) * t - py);
        if (d < e.size * 0.34 + 13) cost += 4000 / (d + 1);
      }
      for (const dr of nearDrones) {
        const d = Math.hypot(dr.x + dr.vx * t - px, dr.y + dr.vy * t - py);
        if (d < 26) cost += 4500 / (d + 1);
      }
      if (archOpening && (px < archOpening.left + 14 || px > archOpening.right - 14)) cost += 5000;
    }
    return cost;
  };

  let best = { x: 0, y: 0 };
  let bestCost = Infinity;
  const h1 = 0.09;
  for (const [dx1, dy1] of BOT_DIRS) {
    const x1 = clx(p.x + dx1 * 174 * h1);
    const y1 = cly(p.y + dy1 * 174 * h1);
    const c1 = evalLeg(p.x, p.y, dx1, dy1, 0, [0.025, 0.055, 0.09]);
    let minC2 = Infinity;
    for (const [dx2, dy2] of BOT_DIRS) {
      const x2 = clx(x1 + dx2 * 174 * 0.14);
      const y2 = cly(y1 + dy2 * 174 * 0.14);
      let c2 = evalLeg(x1, y1, dx2, dy2, h1, [0.04, 0.09, 0.14]);
      c2 += Math.hypot(x2 - tx, y2 - ty) * (openPickup ? 0.55 : 0.25);
      const edgeDist = Math.min(x2 - w.arena.left, w.arena.right - x2);
      if (isHard) {
        if (edgeDist < 46) c2 += (46 - edgeDist) * 4.0;
        const botDist = w.arena.bottom - y2;
        if (botDist < 28) c2 += (28 - botDist) * 3.5;
      } else if (edgeDist < 42) {
        c2 += (42 - edgeDist) * 2.5;
      }
      if (y2 < 290) c2 += (290 - y2) * 1.5;
      if (c2 < minC2) minC2 = c2;
    }
    const total = c1 + minC2;
    if (total < bestCost) {
      bestCost = total;
      best = { x: dx1, y: dy1 };
    }
  }
  const danger = nearBullets.filter(bl => Math.hypot(bl.x - p.x, bl.y - p.y) < 38).length;
  const spTrigger = isHard ? (danger >= 2 && bestCost > 3000) : (danger >= 4);
  return {
    ...best,
    fire: true,
    special:
      w.specialTime <= 0 &&
      w.weapons.specialCharges > 0 &&
      (spTrigger || (b?.sub?.phase === 'fight' && w.boss.parts.filter(pt => pt.hp > 0).length >= 3)),
  };
}

function benchmarkDifficulty(difficulty) {
  const w = new ArcadeWorld(MISSIONS[0], undefined, { difficulty, seed: 1337 });
  w.accessibility = true;
  let sumE = 0;
  let sumB = 0;
  let sumHp = 0;
  let frames = 0;
  let peakE = 0;
  let peakB = 0;
  let zeroEscapeFrames = 0;
  const seenIds = new Set();
  let totalHpSpawned = 0;
  const dt = 1 / 120;

  for (let s = 0; s < 780 * 120; s++) {
    for (const e of w.enemies) {
      if (!seenIds.has(e.id)) {
        seenIds.add(e.id);
        totalHpSpawned += e.maxHp;
      }
    }
    w.step(dt, twoPlyAceBot(w));
    const bCnt = w.bullets.filter(b => b.active && b.enemy).length;
    peakE = Math.max(peakE, w.enemies.length);
    peakB = Math.max(peakB, bCnt);
    if (!w.boss && ((w.route >= 5 && w.route < 135) || (w.route >= 180 && w.route < 296))) {
      sumE += w.enemies.length;
      sumB += bCnt;
      sumHp += w.enemies.reduce((acc, e) => acc + Math.max(0, e.hp), 0);
      frames++;
    }
    if (w.state === 'play' && w.player.invulnerable <= 0) {
      const nb = w.bullets.filter(b => b.active && b.enemy && Math.hypot(b.x - w.player.x, b.y - w.player.y) < 55);
      if (nb.length >= 4) {
        let safe = 0;
        for (const [dx, dy] of BOT_DIRS) {
          const cx = clamp(w.player.x + dx * 174 * 0.08, w.arena.left + 14, w.arena.right - 14);
          const cy = clamp(w.player.y + dy * 174 * 0.08, w.arena.top + 16, w.arena.bottom - 15);
          if (!nb.some(b => Math.hypot(b.x + b.vx * 0.08 - cx, b.y + b.vy * 0.08 - cy) < b.radius + 6)) safe++;
        }
        if (safe === 0) zeroEscapeFrames++;
      }
    }
    w.events.length = 0;
    if (w.state === 'victory' || w.state === 'defeat') {
      const snap = w.devDirectorSnapshot();
      return {
        difficulty,
        label: DIFFICULTY_PROFILES[difficulty].label,
        state: w.state,
        route: Number(w.route.toFixed(1)),
        deaths: w.deaths,
        kills: w.kills,
        totalSpawned: seenIds.size,
        totalHpSpawned: Math.round(totalHpSpawned),
        avgActiveEnemies: Number((sumE / Math.max(1, frames)).toFixed(2)),
        avgActiveBullets: Number((sumB / Math.max(1, frames)).toFixed(2)),
        avgActiveHp: Number((sumHp / Math.max(1, frames)).toFixed(2)),
        peakE,
        peakB,
        pctVisible: snap.pacing.pctWithVisibleEnemy,
        maxGap: snap.pacing.maxEnemyGapSeconds,
        zeroEscapeFrames,
      };
    }
  }
  throw new Error(`Simulation timed out on ${difficulty}`);
}

test('3-mode full run comparison verifies Normal density boost, >=3x Hard combat pressure, zero impossible frames, and winnability', () => {
  const easy = benchmarkDifficulty('easy');
  const normal = benchmarkDifficulty('normal');
  const hard = benchmarkDifficulty('hard');

  console.log('BENCHMARK_3_MODES', JSON.stringify({ easy, normal, hard }));

  assert.equal(easy.state, 'victory');
  assert.equal(normal.state, 'victory');
  assert.equal(hard.state, 'victory');
  assert.equal(easy.zeroEscapeFrames, 0);
  assert.equal(normal.zeroEscapeFrames, 0);
  assert.equal(hard.zeroEscapeFrames, 0);

  // Normal preserves denser enemy wave action than Easy while coordinating offensive fire fairly
  assert.ok(normal.totalSpawned > easy.totalSpawned, `normal spawned (${normal.totalSpawned}) > easy (${easy.totalSpawned})`);
  assert.ok(normal.kills > easy.kills, `normal kills (${normal.kills}) > easy (${easy.kills})`);
  assert.ok(normal.totalHpSpawned > easy.totalHpSpawned, `normal totalHp (${normal.totalHpSpawned}) > easy (${easy.totalHpSpawned})`);

  // Hard delivers >=3x simultaneous active HP / total combat HP pool and >=2.5x active units/bullets vs Normal
  const hpPoolRatio = hard.totalHpSpawned / normal.totalHpSpawned;
  const activeHpRatio = hard.avgActiveHp / normal.avgActiveHp;
  const activeEnemyRatio = hard.avgActiveEnemies / normal.avgActiveEnemies;
  const activeBulletRatio = hard.avgActiveBullets / normal.avgActiveBullets;

  assert.ok(hpPoolRatio >= 3.0, `Expected Hard total HP >= 3.0x Normal, got ${hpPoolRatio.toFixed(2)}x`);
  assert.ok(activeHpRatio >= 3.0, `Expected Hard avg active HP >= 3.0x Normal, got ${activeHpRatio.toFixed(2)}x`);
  assert.ok(activeEnemyRatio >= 2.5, `Expected Hard avg active enemies >= 2.5x Normal, got ${activeEnemyRatio.toFixed(2)}x`);
  assert.ok(activeBulletRatio >= 2.5, `Expected Hard avg active bullets >= 2.5x Normal, got ${activeBulletRatio.toFixed(2)}x`);
});
