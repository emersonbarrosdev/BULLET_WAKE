import assert from 'node:assert/strict';
import test from 'node:test';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS, SUPPLIES } from '../src/game/arcade/content.ts';
import {
  DIFFICULTY_PROFILES,
  FENDA_NORMAL_SUPPLIES,
  NORMAL_ATTACK_WINDOW_SECONDS,
  NORMAL_RESPAWN_BULLET_CLEAR_RADIUS,
  NORMAL_RESPAWN_INVULNERABLE,
  buildMissionEncounters,
  buildMissionSupplies,
  computeNormalDeathRecovery,
  normalOffensiveWindowCap,
  normalPatternStage,
  normalSoftBulletCap,
} from '../src/game/arcade/PelagicDifficulty.ts';
import { computeArchOpening } from '../src/game/arcade/PelagicTideArch.ts';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function makeNormalWorld(seed = 1337) {
  const w = new ArcadeWorld(MISSIONS[0], undefined, { difficulty: 'normal', seed });
  w.state = 'play';
  w.introTime = 0;
  w.player.invulnerable = 0;
  return w;
}

const BOT_DIRS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.707, 0.707], [0.707, -0.707], [-0.707, 0.707], [-0.707, -0.707],
];

function steerNormal(w, { useCharge = false, stepIdx = 0 } = {}) {
  const archOp = w.up && w.tideArch?.isActive ? computeArchOpening(w.arena.left, w.arena.right) : null;
  const minX = archOp ? archOp.left + 22 : w.arena.left + 22;
  const maxX = archOp ? archOp.right - 22 : w.arena.right - 22;
  const p = w.player;
  const b = w.boss;
  let tx = 384;
  let ty = 374;
  const parts = b?.phase === 'fight' ? b.parts.filter(pt => pt.hp > 0) : [];
  if (parts.length) {
    tx = clamp([...parts].sort((a, q) => Math.abs(a.x - p.x) - Math.abs(q.x - p.x))[0].x, minX, maxX);
    ty = 384;
  } else if (b?.sub?.phase === 'fight' && b.sub.sections[b.sub.activeSection].hullHp > 0) {
    tx = b.x;
    ty = 384;
  } else {
    const tgt = w.enemies
      .filter(e => e.y < p.y - 50 && e.y > 40)
      .sort((a, q) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(q.x - p.x, q.y - p.y))[0];
    if (tgt) tx = clamp(tgt.x, minX, maxX);
  }
  const nearB = w.bullets.filter(bl => bl.active && bl.enemy && Math.hypot(bl.x - p.x, bl.y - p.y) < 130);
  const openPickup = w.cargo.find(c => !c.crate && c.age < 21 && c.x > minX && c.x < maxX && c.y > 140 && c.y < w.arena.bottom - 14);
  const cargo = openPickup ?? w.cargo.find(c => c.age < 21 && c.x > minX && c.x < maxX && c.y > 80 && c.y < w.arena.bottom - 14);
  if (!b && nearB.length <= 2 && cargo) {
    tx = clamp(cargo.x, minX, maxX);
    ty = cargo.crate ? Math.min(392, cargo.y + 92) : cargo.y;
  }
  const nearAir = w.enemies.filter(e => !e.ground && Math.hypot(e.x - p.x, e.y - p.y) < 115);
  const clx = v => clamp(v, w.arena.left + 14, w.arena.right - 14);
  const cly = v => clamp(v, w.arena.top + 16, w.arena.bottom - 15);
  const evalLeg = (x0, y0, dx, dy, tStart, tSteps) => {
    let cost = 0;
    for (const tRel of tSteps) {
      const t = tStart + tRel;
      const px = clx(x0 + dx * 174 * tRel);
      const py = cly(y0 + dy * 174 * tRel);
      for (const bl of nearB) {
        const d = Math.hypot(bl.x + bl.vx * t - px, bl.y + bl.vy * t - py);
        if (d < bl.radius + 11) cost += 6000 / (d + 0.5);
        else if (d < bl.radius + 20) cost += 220 / (d + 1);
      }
      for (const e of nearAir) {
        const d = Math.hypot(e.x + (e.vx ?? 0) * t - px, e.y + (e.vy ?? e.speed) * t - py);
        if (d < e.size * 0.34 + 13) cost += 4000 / (d + 1);
      }
      if (archOp && (px < archOp.left + 14 || px > archOp.right - 14)) cost += 5000;
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
      if (edgeDist < 42) c2 += (42 - edgeDist) * 2.5;
      if (y2 < 290) c2 += (290 - y2) * 1.5;
      if (c2 < minC2) minC2 = c2;
    }
    if (c1 + minC2 < bestCost) {
      bestCost = c1 + minC2;
      best = { x: dx1, y: dy1 };
    }
  }
  const danger = nearB.filter(bl => Math.hypot(bl.x - p.x, bl.y - p.y) < 38).length;
  const chargeHeld = useCharge && (stepIdx % 210) < 105;
  const releaseAfterRespawn = w.player.invulnerable > 3.42;
  return {
    ...best,
    fire: !chargeHeld && !releaseAfterRespawn,
    charge: chargeHeld && !releaseAfterRespawn,
    special:
      w.specialTime <= 0 &&
      w.weapons.specialCharges > 0 &&
      (danger >= 4 || (b?.sub?.phase === 'fight' && w.boss.parts.filter(pt => pt.hp > 0).length >= 3)),
  };
}

test('01. Normal preserves all 91 scripted waves and fixes Easy > Normal > Hard cooldown consistency', () => {
  const normalEncounters = buildMissionEncounters(MISSIONS[0], 'normal');
  assert.equal(normalEncounters.length, 91, 'Normal must preserve all 91 programmed encounters');

  const easy = DIFFICULTY_PROFILES.easy;
  const normal = DIFFICULTY_PROFILES.normal;
  const hard = DIFFICULTY_PROFILES.hard;

  assert.equal(normal.cooldownFactor, 0.95);
  assert.equal(normal.shotSpeedMultiplier, 1.0);
  assert.equal(normal.bossHpMultiplier, 1.0);
  assert.ok(easy.cooldownFactor > normal.cooldownFactor, 'Easy cooldown must remain slower than Normal');
  assert.ok(normal.cooldownFactor > hard.cooldownFactor, 'Hard cooldown must be strictly more demanding than Normal');
  assert.ok(hard.maxNewFiringUnitsPerFrame >= normal.maxNewFiringUnitsPerFrame);
  assert.equal(easy.shotSpeedMultiplier, 0.75);
  assert.equal(hard.shotSpeedMultiplier, 1.3);
});

test('02. Normal supply schedule anticipates early POWER 2, bridges Tide Arch gap safely, and avoids checkpoint duplication', () => {
  const normalSupplies = buildMissionSupplies(MISSIONS[0], 'normal', false);
  assert.equal(normalSupplies, FENDA_NORMAL_SUPPLIES);
  assert.equal(buildMissionSupplies(MISSIONS[0], 'easy', false), SUPPLIES);
  assert.equal(buildMissionSupplies(MISSIONS[0], 'hard', false), SUPPLIES);
  assert.equal(buildMissionSupplies(MISSIONS[0], 'normal', true), SUPPLIES);
  assert.equal(buildMissionSupplies(MISSIONS[1], 'normal', false), SUPPLIES);

  const powerTimes = normalSupplies.filter(s => s.kind === 'power').map(s => s.at);
  assert.ok(powerTimes[0] >= 10 && powerTimes[0] <= 12, `First POWER should arrive at 10-12s (got ${powerTimes[0]}s)`);
  assert.ok(powerTimes[1] <= 32, `Second POWER should arrive early for POWER 2 (got ${powerTimes[1]}s)`);
  assert.ok(powerTimes.includes(135), 'Pre-arch POWER opportunity at 135s');
  assert.ok(powerTimes.includes(185), 'Post-arch POWER opportunity at 185s');
  assert.equal(normalSupplies.filter(s => s.kind === 'special').length, 1);
  assert.equal(normalSupplies.filter(s => s.kind === 'life').length, 1);
  assert.equal(normalSupplies.some(s => s.at >= 148 && s.at <= 178), false, 'Zero supplies inside Tide Arch traversal');

  // Verify real pickup collection across varied player positions and checkpoint non-duplication
  const w = makeNormalWorld();
  w.waveIndex = 999;
  w.route = 10.95;
  w.step(0.1, { x: 0, y: 0, fire: false, special: false });
  assert.equal(w.cargo.length, 1, 'First Normal POWER crate spawns at 11s');
  const crate = w.cargo[0];
  assert.ok(crate.drone, 'Supply carrier spawns as animated supply drone');
  assert.ok(crate.drone.targetX >= w.arena.left + 20 && crate.drone.targetX <= w.arena.right - 20);
  // Let drone fly briskly into central delivery point, then shoot it open and collect
  for (let i = 0; i < 80 && crate.drone?.phase === 'enter'; i++) w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  assert.ok(crate.x >= w.arena.left + 20 && crate.x <= w.arena.right - 20);
  w.player.x = crate.x;
  crate.y = w.player.y - 40;
  for (let i = 0; i < 40 && crate.crate; i++) w.step(1 / 60, { x: 0, y: 0, fire: true, special: false });
  assert.equal(crate.crate, false, 'Drone breaks cleanly from primary shots');
  w.player.x = crate.x;
  w.player.y = crate.y;
  w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  assert.equal(w.weapons.powerMeter, 1);

  // Verify ALL 12 Normal supplies spawn with accessible delivery targets and reach POWER 5 FULL cleanly
  const allW = makeNormalWorld();
  allW.waveIndex = 999;
  for (let idx = 0; idx < FENDA_NORMAL_SUPPLIES.length; idx++) {
    const sup = FENDA_NORMAL_SUPPLIES[idx];
    allW.route = sup.at - 0.02;
    allW.step(0.05, { x: 0, y: 0, fire: false, special: false });
    const c = allW.cargo.at(-1);
    assert.ok(c, `Supply #${idx + 1} (${sup.kind} @ ${sup.at}s) must spawn`);
    const targetX = c.drone ? c.drone.targetX : c.x;
    assert.ok(targetX >= allW.arena.left + 20 && targetX <= allW.arena.right - 20, `Supply @ ${sup.at}s must target playable arena`);
    c.crate = false;
    c.drone = undefined;
    c.x = targetX;
    allW.player.x = c.x;
    allW.player.y = allW.playerHomeY;
    c.y = allW.playerHomeY;
    allW.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  }
  assert.equal(allW.collected, FENDA_NORMAL_SUPPLIES.length, 'All 12 Normal supplies must be collectable');
  assert.equal(allW.weapons.weaponLevel, 5, 'Collecting all Normal POWER supplies reaches POWER 5 FULL');
  assert.equal(allW.lives, 4, 'Life crate at 239s preserved');
  assert.equal(allW.weapons.specialCharges, 3, 'Special crate at 145s preserved');

  // Checkpoint at 182s must resume strictly at 185s supply without re-spawning 11..145s supplies
  const cpWorld = makeNormalWorld();
  cpWorld.devJumpTideArch('checkpoint', true, true);
  assert.ok(cpWorld.checkpoint, 'Tide Arch checkpoint created');
  const snap = structuredClone(cpWorld.checkpoint);
  assert.equal(cpWorld.restartFromCheckpoint(snap), true);
  assert.equal(FENDA_NORMAL_SUPPLIES[cpWorld.supplyIndex]?.at, 185, 'Post-checkpoint next supply must be 185s (no duplicates)');
});

test('03. Normal death recovery drops strictly 1 POWER level (5->4..2->1, 1->1), 3.5s invulnerability, 130px clear, non-exploitable', () => {
  const expected = [
    [5, 4],
    [4, 3],
    [3, 2],
    [2, 1],
    [1, 1],
  ];
  for (const [before, after] of expected) {
    const rec = computeNormalDeathRecovery(before);
    assert.equal(rec.nextLevel, after);
    assert.equal(rec.nextMeter, 0);

    const w = makeNormalWorld();
    w.waveIndex = 999;
    w.supplyIndex = 999;
    w.weapons.weaponLevel = before;
    w.weapons.powerMeter = before < 5 ? 1 : 0;
    // Place hostile bullet inside 130px respawn radius and another outside
    w.bullet(w.arenaCenterX + 80, w.playerHomeY - 40, 0, 120, 1, 3, true);
    w.bullet(w.arenaCenterX, w.arena.top + 30, 0, 120, 1, 3, true);
    w.hurtPlayer();

    assert.equal(w.weapons.weaponLevel, after, `Normal death POWER ${before} -> ${after}`);
    assert.equal(w.weapons.powerMeter, 0);
    assert.equal(w.cargo.length, 0, 'Normal death must not drop exploitable extra P capsule');
    assert.equal(w.player.invulnerable, NORMAL_RESPAWN_INVULNERABLE);
    assert.equal(w.bullets.filter(b => b.active && b.enemy).length, 1, `Bullets within ${NORMAL_RESPAWN_BULLET_CLEAR_RADIUS}px cleared`);
  }

  // Easy & Hard keep original penalty untouched
  for (const diff of ['easy', 'hard']) {
    const w = new ArcadeWorld(MISSIONS[0], undefined, { difficulty: diff });
    w.state = 'play';
    w.player.invulnerable = 0;
    w.weapons.weaponLevel = 4;
    w.hurtPlayer();
    assert.equal(w.weapons.weaponLevel, 1, `${diff} preserves classic reset to POWER 1`);
    assert.equal(w.player.invulnerable, 3, `${diff} preserves 3s invulnerability`);
  }
});

test('04. Progressive Normal enemy attack patterns scale cleanly across 0-45s, 45-135s, 180-255s, and 255-300s', () => {
  assert.equal(normalPatternStage(10), 0);
  assert.equal(normalPatternStage(80), 1);
  assert.equal(normalPatternStage(210), 2);
  assert.equal(normalPatternStage(270), 3);

  const countVolley = (family, route) => {
    const w = makeNormalWorld();
    w.waveIndex = 999;
    w.supplyIndex = 999;
    w.route = route;
    w.spawnEncounter({ family, formation: 'solo', motion: 'stationary', lane: 0.5 });
    const e = w.enemies[0];
    e.x = 384;
    e.y = 110;
    if (e.navigation) {
      e.navigation.anchor = undefined;
      e.navigation.worldY = 110 - w.scroll;
      e.navigation.phase = 'hold';
      if (family === 'tower' || family === 'tank') {
        e.navigation.customAnchor = true;
        e.navigation.anchorX = 384;
        e.navigation.anchorY = 0;
      }
    }
    if (e.submarine) {
      e.age = 2.0;
      e.submarine.phase = 'hold';
      e.submarine.exposure = 1;
    }
    e.cooldown = 0;
    w.updateEnemies(1 / 60);
    return w.bullets.filter(b => b.active && b.enemy && !b.enemyMissile).length;
  };

  // Early 0-45s: legible, moderate spreads
  assert.equal(countVolley('boat', 20), 1, 'Normal boat fires 1 shot in 0-45s');
  assert.equal(countVolley('tower', 20), 1, 'Normal tower fires 1 shot in 0-45s');
  assert.equal(countVolley('ship', 20), 2, 'Normal ship fires 2 shots in 0-45s');
  assert.equal(countVolley('bomber', 20), 3, 'Normal bomber fires 3-way fan in 0-45s (not 5-way)');

  // Mid 45-135s & 180-255s: gradual escalation
  assert.equal(countVolley('ship', 80), 3, 'Normal ship upgrades to 3-way in 45-135s');
  assert.equal(countVolley('bomber', 110), 3, 'Normal bomber keeps readable 3-way fan in 45-135s');
  assert.equal(countVolley('submarine', 210), 3, 'Normal submarine fires 3-way in 180-255s');

  // Late 255-300s: full pre-boss intensity
  assert.equal(countVolley('ship', 270), 4, 'Normal ship reaches 4-way spread in 255-300s');
  assert.equal(countVolley('bomber', 270), 5, 'Normal bomber reaches 5-way fan in 255-300s');
  assert.equal(countVolley('boat', 270), 2, 'Normal boat reaches twin spread in 255-300s');
});

test('05. Normal offensive coordination enforces window caps (3/4/3/4/5), staggers helicopter pairs, and never deletes live bullets', () => {
  assert.equal(normalOffensiveWindowCap(20, false), 3);
  assert.equal(normalOffensiveWindowCap(90, false), 4);
  assert.equal(normalOffensiveWindowCap(160, true), 3);
  assert.equal(normalOffensiveWindowCap(210, false), 4);
  assert.equal(normalOffensiveWindowCap(275, false), 5);
  assert.ok(normalSoftBulletCap(20, false) < normalSoftBulletCap(275, false));

  // Spawn 8 fighters simultaneously at route=15s with cooldown=0 -> at most 3 initiate attacks in 0.65s window
  const w = makeNormalWorld();
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.route = 15;
  w.spawnEncounter({ family: 'fighter', formation: 'horde', motion: 'straight', lane: 0.5 });
  for (let i = 0; i < w.enemies.length; i++) {
    w.enemies[i].x = 220 + i * 45;
    w.enemies[i].y = 100;
    w.enemies[i].cooldown = 0;
  }
  let attacksInWindow = 0;
  for (let s = 0; s < Math.floor(NORMAL_ATTACK_WINDOW_SECONDS * 60) - 2; s++) {
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
    attacksInWindow += w.events.filter(ev => ev.type === 'enemy-shot').length;
    w.events.length = 0;
  }
  assert.ok(attacksInWindow <= 3, `Expected <= 3 coordinated attacks in 0-45s window, got ${attacksInWindow}`);

  // Helicopter pair staggers volleys cleanly without overlapping fans
  const hw = makeNormalWorld();
  hw.waveIndex = 999;
  hw.supplyIndex = 999;
  hw.route = 200;
  hw.spawnEncounter({ family: 'heli_phantom', formation: 'pair', motion: 'curve', lane: 0.5 });
  for (const h of hw.enemies) {
    h.y = 110;
    h.cooldown = 0;
  }
  hw.updateEnemies(1 / 60);
  const firstFrameShots = hw.events.filter(ev => ev.type === 'enemy-shot').length;
  assert.equal(firstFrameShots, 1, 'Phantom pair must alternate fans instead of overlapping on the same frame');

  // Pre-existing bullets are NEVER deleted when bullet pressure cap is exceeded
  const pw = makeNormalWorld();
  pw.waveIndex = 999;
  pw.supplyIndex = 999;
  pw.route = 20;
  for (let i = 0; i < 20; i++) {
    pw.bullet(240 + (i % 8) * 35, 80 + Math.floor(i / 8) * 18, 0, 20, 1, 3, true);
  }
  pw.spawnEncounter({ family: 'fighter', formation: 'solo', motion: 'straight', lane: 0.5 });
  pw.enemies[0].x = 384;
  pw.enemies[0].y = 100;
  pw.enemies[0].cooldown = 0;
  pw.updateEnemies(1 / 60);
  const stillActive = pw.bullets.filter(b => b.active && b.enemy).length;
  assert.equal(stillActive, 20, 'Pressure controller must delay new volleys without deleting existing bullets');
  assert.ok(pw.enemies[0].cooldown > 0.1, 'Excess enemy volley is softly deferred');
});

test('06. Full Normal end-to-end runs (auto-fire & charged shot) traverse Tide Arch, collect supplies, and clear Colosso Abissal', () => {
  for (const useCharge of [false, true]) {
    const w = new ArcadeWorld(MISSIONS[0], undefined, { difficulty: 'normal', seed: 1337 });
    const dt = 1 / 120;
    const recentAttackTimes = [];
    const maxWindowBySlice = { early: 0, mid: 0, arch: 0, post: 0, late: 0 };
    let bossSeen = false;
    let archSeen = false;

    for (let s = 0; s < 620 * 120; s++) {
      w.step(dt, steerNormal(w, { useCharge, stepIdx: s }));
      if (w.tideArch.isActive) archSeen = true;
      if (w.boss?.sub) bossSeen = true;
      if (!w.boss && w.state === 'play') {
        const shots = w.events.filter(ev => ev.type === 'enemy-shot').length;
        for (let k = 0; k < shots; k++) recentAttackTimes.push(w.elapsed);
        // 0.58s window stays strictly below shortest single-unit reload (0.64 * 0.95 = 0.608s) so it counts distinct units
        while (recentAttackTimes.length && recentAttackTimes[0] < w.elapsed - 0.58) {
          recentAttackTimes.shift();
        }
        const key = w.route < 45 ? 'early' : w.route < 135 ? 'mid' : w.route < 180 ? 'arch' : w.route < 255 ? 'post' : 'late';
        maxWindowBySlice[key] = Math.max(maxWindowBySlice[key], recentAttackTimes.length);
      }
      w.events.length = 0;
      if (w.state === 'victory' || w.state === 'defeat') break;
    }

    assert.equal(w.state, 'victory', `Normal run (useCharge=${useCharge}) must reach victory`);
    assert.equal(archSeen, true);
    assert.equal(bossSeen, true);
    assert.ok(w.collected >= 9, `Expected strong supply collection in Normal (useCharge=${useCharge}), got ${w.collected}`);
    assert.ok(maxWindowBySlice.early <= 3, `0-45s window cap exceeded: ${maxWindowBySlice.early}`);
    assert.ok(maxWindowBySlice.mid <= 4, `45-135s window cap exceeded: ${maxWindowBySlice.mid}`);
    assert.ok(maxWindowBySlice.arch <= 3, `135-180s arch window cap exceeded: ${maxWindowBySlice.arch}`);
    assert.ok(maxWindowBySlice.post <= 4, `180-255s window cap exceeded: ${maxWindowBySlice.post}`);
    assert.ok(maxWindowBySlice.late <= 5, `255-300s window cap exceeded: ${maxWindowBySlice.late}`);
  }
});
