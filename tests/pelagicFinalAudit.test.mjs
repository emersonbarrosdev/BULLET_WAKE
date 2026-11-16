import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS, SUPPLIES } from '../src/game/arcade/content.ts';
import { SUB_MAX_BOMB_SECTION_DAMAGE } from '../src/game/arcade/PelagicSubmarineBoss.ts';
import { computeArchOpening } from '../src/game/arcade/PelagicTideArch.ts';
import { steer } from '../scripts/arcade-route.mjs';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function advancedSteer(w) {
  const archOpening = w.up && w.tideArch?.isActive ? computeArchOpening(w.arena.left, w.arena.right) : null;
  const minSafeX = archOpening ? archOpening.left + 22 : w.arena.left + 14;
  const maxSafeX = archOpening ? archOpening.right - 22 : w.arena.right - 14;
  let tx = w.up ? 384 : 100;
  let ty = w.up ? 356 : 218;
  const p = w.player;
  const b = w.boss;
  const parts = b?.phase === 'fight' ? b.parts.filter(pt => pt.hp > 0) : [];
  if (parts.length) {
    const part = [...parts].sort((a, q) => Math.abs(a.x - p.x) - Math.abs(q.x - p.x))[0];
    tx = part.x;
    ty = b?.sub ? 374 : Math.min(386, part.y + 135);
  } else if (b?.sub?.phase === 'fight' && b.sub.sections[b.sub.activeSection].hullHp > 0) {
    tx = b.x;
    ty = 374;
  } else {
    const target = w.enemies
      .filter(e => e.y < p.y - 24 && e.y > 42)
      .sort((a, q) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(q.x - p.x, q.y - p.y))[0];
    if (target) {
      tx = clamp(target.x, minSafeX, maxSafeX);
      ty = 358;
    }
  }

  const nearbyThreat = w.bullets.some(bl => bl.active && bl.enemy && Math.hypot(bl.x - p.x, bl.y - p.y) < 95);
  if (!b && !nearbyThreat) {
    const cargo = w.cargo
      .filter(c => c.age < 21 && c.x > w.arena.left + 8 && c.x < w.arena.right - 8 && c.y > w.arena.top + 24 && c.y < w.arena.bottom - 10)
      .sort((a, q) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(q.x - p.x, q.y - p.y))[0];
    if (cargo) {
      tx = clamp(cargo.x, minSafeX, maxSafeX);
      ty = cargo.crate ? Math.min(392, cargo.y + 84) : cargo.y;
    }
  }

  const clx = v => clamp(v, w.arena.left + 14, w.arena.right - 14);
  const cly = v => clamp(v, w.arena.top + 16, w.arena.bottom - 15);
  const candidates = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.707, .707], [.707, -.707], [-.707, .707], [-.707, -.707]];
  let best = { x: 0, y: 0 };
  let bestCost = Infinity;

  for (const [dx, dy] of candidates) {
    const cx = clx(p.x + dx * 174 * 0.22);
    const cy = cly(p.y + dy * 174 * 0.22);
    let cost = Math.hypot(cx - tx, cy - ty) * (b?.sub?.phase === 'fight' ? 0.35 : 0.65);

    for (const bullet of w.bullets) {
      if (!bullet.active || !bullet.enemy) continue;
      for (const t of [0.03, 0.07, 0.13, 0.21, 0.31]) {
        const px = clx(p.x + dx * 174 * t);
        const py = cly(p.y + dy * 174 * t);
        const d = Math.hypot(bullet.x + bullet.vx * t - px, bullet.y + bullet.vy * t - py);
        if (d < bullet.radius + 17) cost += 1400 / (d + 1);
      }
    }
    for (const e of w.enemies) {
      if (e.ground) continue;
      for (const t of [0.03, 0.10, 0.20]) {
        const px = clx(p.x + dx * 174 * t);
        const py = cly(p.y + dy * 174 * t);
        const ey = e.y + (e.motion === 'stationary' ? 38 : e.speed * 0.65) * t;
        const d = Math.hypot(e.x - px, ey - py);
        if (d < e.size * 0.45 + 18) cost += 1200 / (d + 1);
      }
    }
    if (archOpening && (cx < archOpening.left + 14 || cx > archOpening.right - 14)) {
      cost += 3000;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = { x: dx, y: dy };
    }
  }

  const danger = w.bullets.filter(bl => bl.active && bl.enemy && Math.hypot(bl.x - p.x, bl.y - p.y) < 52).length;
  return {
    ...best,
    fire: Math.floor(w.elapsed * 1000) % 300 < 45,
    special: w.specialTime <= 0 && w.weapons.specialCharges > 0 && (danger >= 4 || (!b?.sub && parts.length > 0 && Math.abs(tx - p.x) < 16)),
  };
}

function makeBotInput(strategy, world) {
  if (strategy === 'passive') {
    return { x: 0, y: 0, fire: true, special: false };
  }
  if (strategy === 'edge-sweep') {
    const x = Math.sin(world.elapsed * 1.45) >= 0 ? 1 : -1;
    const targetY = world.boss ? 386 : 362;
    const y = Math.abs(world.player.y - targetY) < 4 ? 0 : (world.player.y < targetY ? 1 : -1);
    return { x, y, fire: Math.floor(world.elapsed * 1000) % 340 < 45, special: false };
  }
  if (strategy === 'weak') {
    // Late reaction within 26px + minimal item pursuit; avoids suicidal dodging without full lookahead.
    const urgent = world.bullets.find(b => b.active && b.enemy && Math.hypot(b.x - world.player.x, b.y - world.player.y) < 26);
    const slowTap = Math.floor(world.elapsed * 1000) % 120 < 45;
    if (urgent) {
      return { x: urgent.x >= world.player.x ? -1 : 1, y: 0.25, fire: slowTap, special: false };
    }
    const base = steer(world, { collect: true, evade: false, special: false });
    return { x: base.x * 0.45, y: base.y * 0.45, fire: slowTap, special: world.weapons.specialCharges > 0 && world.deaths >= 1 };
  }
  if (strategy === 'intermediate') {
    return steer(world, { collect: true, evade: true, special: false });
  }
  return advancedSteer(world);
}

function hasZeroEscapeCandidate(w) {
  const candidates = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.707, .707], [.707, -.707], [-.707, .707], [-.707, -.707]];
  const p = w.player;
  const activeBullets = w.bullets.filter(b => b.active && b.enemy && Math.hypot(b.x - p.x, b.y - p.y) < 55);
  if (activeBullets.length < 4) return false;
  let safe = 0;
  for (const [dx, dy] of candidates) {
    const cx = clamp(p.x + dx * 174 * 0.08, w.arena.left + 14, w.arena.right - 14);
    const cy = clamp(p.y + dy * 174 * 0.08, w.arena.top + 16, w.arena.bottom - 15);
    let hit = false;
    for (const b of activeBullets) {
      if (Math.hypot((b.x + b.vx * 0.08) - cx, (b.y + b.vy * 0.08) - cy) < b.radius + 6) {
        hit = true;
        break;
      }
    }
    if (!hit) safe++;
  }
  return safe === 0;
}

export function simulatePelagicRun(mode, strategy, maxSeconds = 520) {
  const w = new ArcadeWorld(MISSIONS[0]);
  w.hard = mode === 'hard';
  w.assisted = mode === 'assisted';

  // Exact parity with ArcadeScene.ts fixed simulation step (1 / 120s)
  const dt = 1 / 120;
  const maxSteps = Math.round(maxSeconds / dt);
  let peakBullets = 0;
  let peakEnemies = 0;
  let maxWeaponLevel = 1;
  let missilesFired = 0;
  let specialsUsed = 0;
  let submarinesSeen = 0;
  let miniSeen = false;
  let archSeen = false;
  let bossSeen = false;
  let zeroEscapeFrames = 0;
  const subSectionsSeen = new Set();
  const buckets = new Map();

  for (let step = 0; step < maxSteps; step++) {
    const input = makeBotInput(strategy, w);
    w.step(dt, input);

    for (const ev of w.events) {
      if (ev.type === 'missile') missilesFired++;
      if (ev.type === 'special') specialsUsed++;
      if (ev.type === 'mini') miniSeen = true;
      if (ev.type === 'arch') archSeen = true;
      if (ev.type === 'boss') bossSeen = true;
    }
    w.events.length = 0;

    let activeBullets = 0;
    for (const b of w.bullets) if (b.active && b.enemy) activeBullets++;
    const enemies = w.enemies.length;
    peakBullets = Math.max(peakBullets, activeBullets);
    peakEnemies = Math.max(peakEnemies, enemies);
    maxWeaponLevel = Math.max(maxWeaponLevel, w.weapons.weaponLevel);

    for (const e of w.enemies) {
      if (e.submarine) submarinesSeen++;
    }
    if (w.boss?.sub) {
      subSectionsSeen.add(w.boss.sub.activeSection);
    }

    const bucket = Math.floor(w.elapsed / 10) * 10;
    const prev = buckets.get(bucket) ?? { sec: bucket, peakBullets: 0, peakEnemies: 0 };
    prev.peakBullets = Math.max(prev.peakBullets, activeBullets);
    prev.peakEnemies = Math.max(prev.peakEnemies, enemies);
    buckets.set(bucket, prev);

    if (w.state === 'play' && w.player.invulnerable <= 0 && hasZeroEscapeCandidate(w)) {
      zeroEscapeFrames++;
    }
    if (w.state === 'victory' || w.state === 'defeat') break;
  }

  let peakWindow = { sec: 0, peakBullets: 0, peakEnemies: 0 };
  for (const b of buckets.values()) {
    if (b.peakBullets + b.peakEnemies * 2 > peakWindow.peakBullets + peakWindow.peakEnemies * 2) {
      peakWindow = b;
    }
  }

  return {
    mode,
    strategy,
    state: w.state,
    elapsed: Number(w.elapsed.toFixed(2)),
    route: Number(w.route.toFixed(1)),
    lives: w.lives,
    deaths: w.deaths,
    score: w.score,
    kills: w.kills,
    collected: w.collected,
    maxWeaponLevel,
    finalLevel: w.weapons.weaponLevel,
    missilesFired,
    specialsUsed,
    miniSeen,
    archSeen: archSeen || w.tideArch.checkpointReached,
    bossSeen,
    subSectionsReached: subSectionsSeen.size,
    specialEvents: [...w.specialEventsTriggered],
    scoring: w.pelagicScoring.snapshot(),
    peakBullets,
    peakEnemies,
    peakWindow,
    zeroEscapeFrames,
    submarinesSeen,
  };
}

test('Fenda Pelagica full deterministic lifecycle, weapons, Tormenta Escarlate caps, Colosso Abissal 5 sections, and reset', () => {
  const runA = simulatePelagicRun('normal', 'advanced');
  const runB = simulatePelagicRun('normal', 'advanced');

  // Bit-for-bit determinism across identical runs (quality-independent world rules)
  assert.deepEqual(runA, runB);
  assert.equal(runA.state, 'victory');
  assert.equal(runA.route, 300);
  assert.equal(runA.maxWeaponLevel, 5);
  assert.ok(runA.missilesFired > 0, 'Secondary homing missiles should fire at LV3+');
  assert.ok(runA.specialsUsed > 0, 'Tormenta Escarlate should be triggered');
  assert.equal(runA.miniSeen, false, 'Fenda Pelagica replaces legacy miniboss with Arco das Mares');
  assert.equal(runA.archSeen, true, 'Arco das Mares must run cleanly in mid-stage');
  assert.equal(runA.bossSeen, true);
  assert.equal(runA.subSectionsReached, 5, 'All 5 Colosso Abissal sections must be traversed');
  assert.equal(runA.collected, SUPPLIES.length, 'All 11 scripted supplies collectable on normal route');
  assert.ok(runA.specialEvents.includes('naval-convoy'));
  assert.ok(runA.specialEvents.includes('elite-interception'));
  assert.ok(runA.specialEvents.includes('coordinated-strike'));
  assert.ok(runA.specialEvents.includes('rare-visitor'));
  assert.ok(runA.scoring.formationsCleared > 0);
  assert.ok(runA.scoring.bossPartsDestroyed >= 10);

  // Verify special bomb caps on Colosso Abissal and defeat/reset isolation
  const w = new ArcadeWorld(MISSIONS[0]);
  w.state = 'play';
  w.miniStarted = true;
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.route = 299.98;
  w.elapsed = 299.98;
  w.player.invulnerable = 10;
  for (let i = 0; i < 4; i++) w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  assert.ok(w.boss?.sub, 'Colosso Abissal spawns at 300s');
  for (let i = 0; i < 600 && w.boss.sub.phase !== 'fight'; i++) {
    w.step(1 / 120, { x: 0, y: 0, fire: false, special: false });
  }
  assert.equal(w.boss.sub.phase, 'fight');
  w.weapons.specialCharges = 1;
  w.step(1 / 120, { x: 0, y: 0, fire: false, special: true });
  assert.equal(w.bomb?.phase, 'flight');
  for (let i = 0; i < 400 && w.bomb; i++) {
    w.step(1 / 120, { x: 0, y: 0, fire: false, special: false });
  }
  const recorded = Object.values(w.boss.sub.bombDamage)[0];
  assert.ok(recorded && recorded.total > 0 && recorded.total <= SUB_MAX_BOMB_SECTION_DAMAGE + 1e-6);

  // Defeat + clean new sortie reset
  w.player.invulnerable = 0;
  w.specialTime = 0;
  w.lives = 1;
  w.hurtPlayer();
  assert.equal(w.state, 'defeat');
  const fresh = new ArcadeWorld(MISSIONS[0]);
  assert.equal(fresh.state, 'intro');
  assert.equal(fresh.lives, 3);
  assert.equal(fresh.score, 0);
  assert.equal(fresh.deaths, 0);
  assert.equal(fresh.weapons.weaponLevel, 1);
});

test('Multi-strategy difficulty balance matrix across ASSISTED, NORMAL, and HARD (simulations only)', () => {
  const passiveAssisted = simulatePelagicRun('assisted', 'passive', 120);
  const passiveNormal = simulatePelagicRun('normal', 'passive', 120);
  const weakAssisted = simulatePelagicRun('assisted', 'weak');
  const weakNormal = simulatePelagicRun('normal', 'weak');
  const midAssisted = simulatePelagicRun('assisted', 'intermediate');
  const midNormal = simulatePelagicRun('normal', 'intermediate');
  const advNormal = simulatePelagicRun('normal', 'advanced');
  const advHard = simulatePelagicRun('hard', 'advanced');

  // Passive standing still fails cleanly across all modes
  assert.equal(passiveNormal.state, 'defeat');
  assert.equal(passiveAssisted.state, 'defeat');

  // Assisted genuinely preserves higher power/progress than Normal without making passive play immortal
  assert.ok(
    weakAssisted.route >= weakNormal.route,
    `Expected assisted weak bot (${weakAssisted.route}s) >= normal (${weakNormal.route}s)`,
  );
  assert.equal(midAssisted.state, 'victory');
  assert.equal(midNormal.state, 'victory');
  assert.ok(midAssisted.finalLevel >= midNormal.finalLevel, 'Assisted keeps stronger recovery weapon level after death');

  // Skilled play clears both Normal and Hard, with Hard imposing higher peak hostile pressure
  assert.equal(advNormal.state, 'victory');
  assert.equal(advHard.state, 'victory');
  assert.ok(advHard.peakBullets > advNormal.peakBullets, `Expected Hard peakBullets (${advHard.peakBullets}) > Normal (${advNormal.peakBullets})`);
  assert.equal(advNormal.zeroEscapeFrames, 0);
  assert.equal(advHard.zeroEscapeFrames, 0);
});

test('Cidade Solar (Stage 2) remains unmodified in core simulation invariants', () => {
  const solar = new ArcadeWorld(MISSIONS[1]);
  assert.equal(solar.up, false);
  assert.equal(solar.lives, 3);
  for (let i = 0; i < 120 * 110; i++) {
    solar.step(1 / 120, { x: 0, y: 0, fire: true, special: false });
    solar.events.length = 0;
    if (solar.state === 'defeat') break;
  }
  assert.ok(solar.elapsed > 0);
  assert.equal(solar.isAssisted, false);
});
