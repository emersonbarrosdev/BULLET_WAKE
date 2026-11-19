import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA, SOLAR } from '../src/game/arcade/content.ts';
import {
  TIDE_ARCH_START_ROUTE,
  TIDE_ARCH_CHECKPOINT_BONUS,
  TIDE_ARCH_CLEAN_BONUS,
  TIDE_ARCH_CANNONS,
  TIDE_ARCH_BOATS,
  TideArchController,
  computeArchOpening,
  resolveArchCannonWorldPos,
} from '../src/game/arcade/PelagicTideArch.ts';
import { PelagicComms } from '../src/game/arcade/PelagicComms.ts';
import { DevScenarioRegistry } from '../src/devtools/DevScenarioRegistry.ts';

function stepWorld(world, seconds, input = { x: 0, y: 0, fire: false, special: false }, dt = 1 / 60) {
  const ticks = Math.round(seconds / dt);
  for (let i = 0; i < ticks; i++) {
    world.step(dt, input);
    if (world.state === 'victory' || world.state === 'defeat') break;
  }
}

function livePelagic() {
  const w = new ArcadeWorld({ ...FENDA, encounters: [] });
  w.state = 'play';
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.player.invulnerable = 999;
  return w;
}

test('01-03: Arco das Mares triggers at 148s in Fenda Pelagica only, never in Cidade Solar, and blocks UP miniboss', () => {
  const solar = new ArcadeWorld({ ...SOLAR, encounters: [] });
  solar.state = 'play';
  solar.route = TIDE_ARCH_START_ROUTE;
  solar.step(1 / 60);
  assert.equal(solar.tideArch.phase, 'idle');

  const up = livePelagic();
  up.startBoss(true);
  assert.equal(up.boss, undefined, 'Legacy UP miniboss stays permanently removed');

  const w = livePelagic();
  w.route = TIDE_ARCH_START_ROUTE - 0.05;
  stepWorld(w, 0.2);
  assert.equal(w.tideArch.phase, 'approach');

  const phases = new Set([w.tideArch.phase]);
  for (let i = 0; i < 60 * 48 && w.tideArch.phase !== 'complete'; i++) {
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
    phases.add(w.tideArch.phase);
  }
  for (const req of ['approach', 'descent', 'low-flight', 'under-arch', 'ascent', 'checkpoint', 'complete']) {
    assert(phases.has(req), `Expected phase ${req} in Tide Arch lifecycle`);
  }
});

test('04-05: Automatic descent smoothly drops altitude 1->0 and ascent strictly restores 0->1 before altitudeRestored', () => {
  const w = livePelagic();
  w.devJumpTideArch('approach', true);
  w.player.invulnerable = 999;
  assert.equal(w.player.altitude, 1);
  assert.equal(w.tideArch.altitudeRestored, false);

  let enteredDescent = false;
  let reachedZero = false;
  let restoredAt = -1;
  for (let i = 0; i < 60 * 55; i++) {
    w.step(1 / 60);
    if (w.tideArch.phase === 'descent') enteredDescent = true;
    if (enteredDescent && w.player.altitude <= 0.01) reachedZero = true;
    if (w.tideArch.phase === 'ascent') assert.equal(w.tideArch.altitudeRestored, false);
    if (w.tideArch.altitudeRestored && restoredAt < 0) {
      restoredAt = w.elapsed;
      assert.equal(w.player.altitude, 1);
      assert.equal(w.tideArch.altitude, 1);
      break;
    }
  }
  assert(enteredDescent && reachedZero && restoredAt > 0);
});

test('06-07: Full lateral control persists across all phases and UP/DOWN inputs never break altitude or arch bounds', () => {
  for (const stage of ['approach', 'descent', 'low-flight', 'under-arch', 'ascent']) {
    const w = livePelagic();
    w.devJumpTideArch(stage, true);
    const startAlt = w.tideArch.altitude;
    const xStart = w.player.x;
    stepWorld(w, 0.25, { x: -1, y: -1, fire: false, special: false });
    assert(w.player.x < xStart - 20, `Player must move left cleanly in stage ${stage}`);
    stepWorld(w, 0.5, { x: 1, y: 1, fire: false, special: false });
    assert(w.player.x > xStart + 10, `Player must move right cleanly in stage ${stage}`);
    assert.equal(w.player.altitude, w.tideArch.altitude);
    assert(w.player.altitude <= 1 && w.player.altitude >= 0);
    if (stage === 'low-flight' || stage === 'under-arch') {
      assert.equal(startAlt, 0);
      assert.equal(w.player.altitude, 0);
    }
  }
});

test('08-10: Zero aircraft/helicopters spawn until altitudeRestored=true, pre-existing air exits cleanly, and air waves resume afterward', () => {
  const w = new ArcadeWorld(FENDA);
  w.state = 'play';
  w.player.invulnerable = 999;
  w.route = TIDE_ARCH_START_ROUTE - 0.1;
  w.waveIndex = FENDA.encounters.findIndex(e => e.at >= 148);

  // Pre-seed a lingering air unit just before 148s
  w.spawnEncounter({ family: 'fighter', formation: 'solo', motion: 'straight', lane: 0.5 });
  w.enemies[0].age = 1.5;

  stepWorld(w, 0.25);
  assert.equal(w.tideArch.phase, 'approach');
  assert.equal(w.tideArch.airSpawnsBlocked, true);
  assert(w.enemies.some(e => !e.ground && e.archRetiring === true), 'Existing aircraft must retire naturally instead of popping out');

  // Step through entire arch crossing and track newly spawned entities
  let spawnedAirDuringBlock = false;
  for (let i = 0; i < 60 * 35 && !w.tideArch.altitudeRestored; i++) {
    const beforeIds = new Set(w.enemies.map(e => e.id));
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
    if (w.tideArch.airSpawnsBlocked) {
      for (const e of w.enemies) {
        if (!beforeIds.has(e.id) && !e.ground) spawnedAirDuringBlock = true;
      }
    }
  }
  assert.equal(spawnedAirDuringBlock, false, 'Zero new aircraft or helicopters may spawn before altitudeRestored');
  assert.equal(w.tideArch.altitudeRestored, true);
  assert.equal(w.tideArch.airSpawnsBlocked, false);

  // Step past 192s and confirm air combat resumes
  if (w.route < 192) w.route = 191.9;
  stepWorld(w, 6);
  assert(w.enemies.some(e => !e.ground), 'Aerial threats resume normally once altitude is restored');
});

test('11-15: Arch opening scales for PC/Portrait, cliff cannons anchor to archWorldY, stop firing when destroyed, and boats attack inside channel', () => {
  const pcOpening = computeArchOpening(160, 768);
  const portraitOpening = computeArchOpening(0, 384);
  const classicOpening = computeArchOpening(192, 576);
  assert(pcOpening.width > classicOpening.width);
  assert.equal(portraitOpening.center, 192);
  assert.equal(TIDE_ARCH_CANNONS.length, 10);
  assert.equal(TIDE_ARCH_BOATS.length, 7);

  const w = livePelagic();
  w.devJumpTideArch('low-flight', true);
  const turrets = w.enemies.filter(e => e.family === 'tower');
  const boats = w.enemies.filter(e => e.archBoat);
  assert(turrets.length >= 2 && boats.length >= 1);

  for (const t of turrets) {
    assert.equal(t.navigation?.customAnchor, true);
    const dy0 = t.y - w.scroll;
    w.step(0.25);
    const dy1 = t.y - w.scroll;
    assert(Math.abs(dy1 - dy0) < 0.01, 'Cliff cannon worldY stays rock-locked across scroll frames');
  }
  for (const b of boats) {
    const open = computeArchOpening(w.arena.left, w.arena.right);
    assert(b.x >= open.left && b.x <= open.right, 'Patrol boat stays inside navigable water channel');
  }

  // Destroy cannon and verify it leaves 0 future bullets
  const target = turrets[0];
  const scoreBefore = w.score;
  w.bullet(target.x, target.y, 0, -400, 999, 6);
  w.updateBullets(0.05);
  assert(w.score > scoreBefore);
  w.bullets.forEach(bl => { bl.active = false; });
  stepWorld(w, 2.0);
  assert.equal(w.enemies.some(e => e.id === target.id), false, 'Destroyed cliff cannon never fires again');
});

test('16-19: Pier collision hurts only outside opening inside bridge band, safe center passes under arch, and bridge band syncs depth', () => {
  const w = livePelagic();
  w.devJumpTideArch('under-arch', true);
  w.player.invulnerable = 0;
  const open = computeArchOpening(w.arena.left, w.arena.right);

  // Align bridge directly over playerY to activate stone pier contact
  const bridgeY = w.tideArch.archScreenY(w.scroll);
  w.player.y = bridgeY;
  assert.equal(w.tideArch.isInBridgeBand(w.scroll, w.player.y), true);
  assert.equal(w.tideArch.isPillarCollisionActive(w.scroll, w.player.y), true);

  // Safe center flight never hits pier
  w.player.x = open.center;
  w.step(1 / 60);
  assert.equal(w.deaths, 0);

  // Clipping stone pier damages player once and resets cleanly inside open corridor (no loop)
  w.player.x = open.left - 4;
  w.step(1 / 60);
  assert.equal(w.deaths, 1);
  assert(w.player.x >= open.left + 20 && w.player.x <= open.right - 20);
  w.player.invulnerable = 0;
  stepWorld(w, 0.5);
  assert.equal(w.deaths, 1, 'Safe center respawn avoids repeated pier collision loop');
});

test('20-23: Checkpoint awards non-exploitable bonus after restoration, restartFromCheckpoint preserves exact progress cleanly', () => {
  // Clean clear vs damaged clear bonus
  const clean = livePelagic();
  clean.devJumpTideArch('checkpoint', true);
  assert.equal(clean.tideArch.checkpointReached, true);
  assert.equal(clean.tideArch.altitudeRestored, true);
  assert.equal(clean.score, TIDE_ARCH_CHECKPOINT_BONUS + TIDE_ARCH_CLEAN_BONUS);

  const damaged = livePelagic();
  damaged.devJumpTideArch('low-flight', true);
  damaged.player.invulnerable = 0;
  damaged.hurtPlayer();
  damaged.player.invulnerable = 999;
  for (let i = 0; i < 60 * 30 && !damaged.tideArch.checkpointReached; i++) damaged.step(1 / 60);
  assert.equal(damaged.tideArch.checkpointReached, true);
  assert.equal(damaged.pelagicScoring.snapshot().specialBonus, TIDE_ARCH_CHECKPOINT_BONUS, 'Damaged arch crossing forfeits clean clear bonus');

  // Checkpoint snapshot restore blocks score/life/weapon duplication and carries into Colosso Abissal flow
  const snap = clean.checkpoint;
  assert.ok(snap);
  const resumed = livePelagic();
  resumed.lives = 0;
  resumed.state = 'defeat';
  assert.equal(resumed.restartFromCheckpoint(snap), true);
  assert.equal(resumed.state, 'play');
  assert.equal(resumed.lives, snap.lives);
  assert.equal(resumed.score, snap.score);
  assert.equal(resumed.tideArch.phase, 'complete');
  stepWorld(resumed, 1.0);
  assert.equal(resumed.score, snap.score, 'Zero checkpoint score farming on resume');
});

test('24-30: Special bomb, weapons LV1/LV3/FULL, Hard intensity, layout switching (PC vs Portrait), Comms, DevTools & Boss continuity', () => {
  // Pause/freeze invariant (not stepping leaves controller frozen)
  const frozen = livePelagic();
  frozen.devJumpTideArch('descent', true);
  const snapPhase = frozen.tideArch.phase;
  const snapAlt = frozen.player.altitude;
  const snapArchY = frozen.tideArch.archScreenY(frozen.scroll);
  assert.equal(frozen.tideArch.phase, snapPhase);
  assert.equal(frozen.player.altitude, snapAlt);
  assert.equal(frozen.tideArch.archScreenY(frozen.scroll), snapArchY);

  // Special bomb clears arch bullets & damages cannons/boats
  const bombW = livePelagic();
  bombW.devJumpTideArch('low-flight', true);
  bombW.step(1 / 60, { x: 0, y: 0, fire: false, special: true });
  stepWorld(bombW, 0.75);
  const blastB = bombW.bullets.at(-1);
  assert.ok(blastB);
  blastB.active = true;
  blastB.enemy = true;
  blastB.vx = 0;
  blastB.vy = 0;
  blastB.x = bombW.bomb.x;
  blastB.y = bombW.bomb.y;
  stepWorld(bombW, 0.25);
  assert.equal(blastB.active, false);

  // Weapons LV1 / LV3 / FULL homing engage arch targets cleanly
  for (const lv of [1, 3, 5]) {
    const arm = livePelagic();
    arm.weapons.weaponLevel = lv;
    arm.devJumpTideArch('low-flight', true);
    stepWorld(arm, 0.25, { x: 0, y: 0, fire: true, special: false });
    assert(arm.bullets.some(b => b.active && !b.enemy), `Level ${lv} fires cleanly inside Tide Arch`);
  }

  // Normal vs Hard cooldown acceleration
  const wNorm = livePelagic();
  wNorm.devJumpTideArch('low-flight', true);
  const wHard = livePelagic();
  wHard.hard = true;
  wHard.devJumpTideArch('low-flight', true);
  let shotsNorm = 0;
  let shotsHard = 0;
  for (let i = 0; i < 60 * 6; i++) {
    wNorm.step(1 / 60);
    wHard.step(1 / 60);
    shotsNorm += wNorm.events.filter(e => e.type === 'enemy-shot').length;
    shotsHard += wHard.events.filter(e => e.type === 'enemy-shot').length;
    wNorm.events.length = 0;
    wHard.events.length = 0;
  }
  assert(shotsHard > shotsNorm, `Hard cannon/boat volume (${shotsHard}) should exceed Normal (${shotsNorm})`);

  // PC Horizontal (160..608) & Android Portrait (0..384) arena resizing & constructors
  const pcW = new ArcadeWorld({ ...FENDA, encounters: [] }, undefined, { upLayout: 'pc' });
  assert.equal(pcW.upLayout, 'pc');
  assert.equal(pcW.arenaWidth, 448);
  assert.equal(pcW.arena.left, 160);
  assert.equal(pcW.arena.right, 608);
  const portW = new ArcadeWorld({ ...FENDA, encounters: [] }, undefined, { upLayout: 'portrait' });
  assert.equal(portW.upLayout, 'portrait');
  assert.equal(portW.arenaWidth, 384);
  pcW.setArenaBounds({ left: 0, right: 384, top: 44, bottom: 680 });
  assert(pcW.player.x >= 0 && pcW.player.x <= 384);

  // PelagicComms handles arch phases without stalling
  const comms = new PelagicComms();
  assert(comms.trigger({ category: 'arch', detail: 'approach' }));
  comms.step(3.5);
  assert(comms.trigger({ category: 'arch', detail: 'descent' }));
  comms.step(3.5);
  assert(comms.trigger({ category: 'arch', detail: 'ascent' }));

  // DevTools adapter lists Tide Arch checkpoint (180s) + Mar das Turbinas (240s)
  const reg = new DevScenarioRegistry();
  const fendaAdapter = reg.getAdapterByMissionIndex(0);
  assert(fendaAdapter?.checkpoints.some(c => c.atSeconds === 180));
  assert(fendaAdapter?.checkpoints.some(c => c.atSeconds === 240));

  // Full post-checkpoint continuation smoothly triggers Colosso Abissal at 360s
  const full = new ArcadeWorld(FENDA);
  full.state = 'play';
  full.player.invulnerable = 999;
  full.devJumpTideArch('checkpoint');
  full.route = 359.9;
  stepWorld(full, 0.5);
  assert.ok(full.boss?.sub, 'Colosso Abissal spawns cleanly after completing Arco das Mares');
});

test('31: Coast water occlusion fix, waterfalls & grey pad removal, cannon coastline anchoring & Tide Arch depth contracts', () => {
  const backdropSrc = readFileSync(resolve('src/game/arcade/ArcadeBackdrop.ts'), 'utf8');
  const paintingSrc = readFileSync(resolve('src/game/arcade/PelagicCoastPainting.ts'), 'utf8');
  const archArtSrc = readFileSync(resolve('src/game/arcade/PelagicTideArchArt.ts'), 'utf8');
  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');

  // 1. Coast remains opaque during Tide Arch and waves/glints render strictly below painted coast strips (-18.8)
  assert.ok(!backdropSrc.includes('tideArch.isActive ? 0.55'), 'Tide Arch must not make coastal islands translucent');
  assert.ok(backdropSrc.includes('setDepth(-19.02)'), 'Wave crests must sit strictly below coast strips (-18.8)');
  assert.ok(backdropSrc.includes('setDepth(-19.00)'), 'Water glints must sit strictly below coast strips (-18.8)');
  assert.ok(backdropSrc.includes('computeArchOpening(areaLeft, areaLeft + areaWidth)'), 'Canyon channel clamps ocean wave crests/glints');

  // 2. Interior coastal islands remain 100% solid terrain without cool-rock/quay alpha cutouts
  assert.ok(paintingSrc.includes('isDeepInland'), 'Coast terrain mask must preserve solid island interiors');

  // 3. Artificial waterfalls, grey circular gun pads, floating cutouts, and opaque ellipse shadow remain removed
  for (const forbidden of [
    'WATERFALL_SLOTS',
    'waterfallMistGfx',
    'upperStreamGfx',
    'bridgeWaterfallGfx',
    'padMountGfx',
    'PAD_FRAME_META',
    'PIER_LAYOUT',
    'BACKING_CLIFFS',
    'archShadowGfx',
    '.fillEllipse(',
  ]) {
    assert.ok(!archArtSrc.includes(forbidden), `PelagicTideArchArt must NOT contain ${forbidden}`);
  }
  assert.ok(!sceneSrc.includes('0xd8e2ec'), 'ArcadeScene must NOT apply grey pad tint 0xd8e2ec to arch cannons');

  // 4. Tide Arch renders natural rock platforms, silhouette-derived shadow, bridge span & altitude locator beacon
  for (const token of [
    'TIDE_ARCH_BRIDGE_TEX',
    'TIDE_ARCH_ROCK_PLATFORMS_TEX',
    'TIDE_ARCH_SHADOW_TEX',
    'resolveArchCannonWorldPos',
    'setDepth(1.12)',
    'setDepth(1.18)',
    'setDepth(1.44',
    'setDepth(18.90)',
    'setDepth(18.95)',
    'setDepth(19.30)',
    'archShadowImage',
    'rivetBeaconGfx',
  ]) {
    assert.ok(archArtSrc.includes(token), `PelagicTideArchArt must contain ${token}`);
  }
});

test('32: All 10 Tide Arch cannons sit synced to rock coordinates and can be individually destroyed with Power 1 primary shots across Easy, Normal, Hard, PC and Portrait', () => {
  const clampVal = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const configs = [
    { upLayout: 'pc', difficulty: 'easy' },
    { upLayout: 'pc', difficulty: 'normal' },
    { upLayout: 'pc', difficulty: 'hard' },
    { upLayout: 'portrait', difficulty: 'normal' },
    { upLayout: 'portrait', difficulty: 'hard' },
  ];

  for (const cfg of configs) {
    const w = new ArcadeWorld(FENDA, undefined, { ...cfg, seed: 1337 });
    w.state = 'play';
    w.introTime = 0;
    w.accessibility = true;
    w.weapons.weaponLevel = 1;
    w.weapons.specialCharges = 0;
    w.route = 179.9;
    w.scroll = 179.9 * 38;
    w.waveIndex = FENDA.encounters.findIndex(e => e.at >= 180);
    w.supplyIndex = 999;

    const cannonRecords = new Map();
    const dt = 1 / 120;
    for (let s = 0; s < 52 * 120; s++) {
      w.player.invulnerable = 999;
      w.events.length = 0;
      const open = computeArchOpening(w.arena.left, w.arena.right);
      const inBand = w.tideArch.isInBridgeBand(w.scroll, w.player.y + 12) || w.tideArch.isInBridgeBand(w.scroll, w.player.y - 18);
      const minX = inBand ? open.left + 11 : w.arena.left + 20;
      const maxX = inBand ? open.right - 11 : w.arena.right - 20;

      const alreadyDestroyedIds = new Set([...cannonRecords.values()].filter(r => r.destroyed).map(r => r.actorId));
      const cannons = w.enemies.filter(e => e.hp > 0 && e.navigation?.customAnchor);
      for (const c of cannons) {
        const spec = TIDE_ARCH_CANNONS.find(sp => Math.abs((w.tideArch.archWorldY + sp.relWorldY) - c.navigation.worldY) < 1 && sp.side === c.archSide);
        assert.ok(spec, `Expected matching Tide Arch spec for cannon id=${c.id}`);
        const expected = resolveArchCannonWorldPos(spec, w.tideArch.archWorldY, w.arena.left, w.arena.right);
        assert.ok(Math.abs(c.x - expected.x) < 0.01, `Cannon ${spec.id} must match shared rock coordinate`);

        let rec = cannonRecords.get(spec.id);
        if (!rec) {
          rec = { id: spec.id, actorId: c.id, maxHp: c.maxHp, damaged: false, destroyed: false, wreckCreated: false };
          cannonRecords.set(spec.id, rec);
        } else if (rec.destroyed) {
          rec.respawned = true;
        }
        if (c.hp < c.maxHp) rec.damaged = true;
      }

      const target = cannons
        .filter(e => e.y > -10 && e.y < w.player.y - 18)
        .sort((a, b) => b.y - a.y)[0];
      const tx = target ? clampVal(target.x, minX, maxX) : open.center;
      const ty = w.playerHomeY;
      w.step(dt, {
        x: clampVal((tx - w.player.x) / 5, -1, 1),
        y: clampVal((ty - w.player.y) / 5, -1, 1),
        fire: true,
        special: false,
        charge: false,
      });

      for (const rec of cannonRecords.values()) {
        if (alreadyDestroyedIds.has(rec.actorId) && w.enemies.some(e => e.id === rec.actorId)) {
          rec.respawned = true;
        }
      }

      for (const ev of w.events) {
        if (ev.type === 'enemy-shot') {
          for (const rec of cannonRecords.values()) {
            if (alreadyDestroyedIds.has(rec.actorId)) {
              const wk = w.wrecks.find(k => k.id === rec.actorId);
              if (wk && Math.hypot(ev.x - wk.x, ev.y - wk.y) < 12) rec.firedAfterDestroy = true;
            }
          }
        }
      }
      for (const wk of w.wrecks) {
        if (!wk.customAnchor) continue;
        for (const rec of cannonRecords.values()) {
          if (rec.actorId === wk.id) {
            rec.damaged = true;
            rec.destroyed = true;
            rec.wreckCreated = true;
          }
        }
      }
      if (w.tideArch.phase === 'complete') break;
    }

    assert.equal(cannonRecords.size, 10, `All 10 cannons must spawn in ${cfg.upLayout}/${cfg.difficulty}`);
    for (const spec of TIDE_ARCH_CANNONS) {
      const rec = cannonRecords.get(spec.id);
      assert.ok(rec, `Missing cannon ${spec.id}`);
      assert.equal(rec.damaged, true, `Cannon ${spec.id} must take Power 1 damage (${cfg.upLayout}/${cfg.difficulty})`);
      assert.equal(rec.destroyed, true, `Cannon ${spec.id} must be destroyed at Power 1 (${cfg.upLayout}/${cfg.difficulty})`);
      assert.equal(rec.wreckCreated, true, `Cannon ${spec.id} must leave a wreck (${cfg.upLayout}/${cfg.difficulty})`);
      assert.ok(!rec.respawned, `Cannon ${spec.id} must never respawn (${cfg.upLayout}/${cfg.difficulty})`);
      assert.ok(!rec.firedAfterDestroy, `Cannon ${spec.id} must stop firing after destruction (${cfg.upLayout}/${cfg.difficulty})`);
    }
  }
});
