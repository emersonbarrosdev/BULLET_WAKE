import { mkdirSync, writeFileSync } from 'node:fs';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA, regionAt } from '../src/game/arcade/content.ts';
import { steer } from './arcade-route.mjs';

export function runPacingAudit(opts) {
  const w = new ArcadeWorld(FENDA, undefined, { upLayout: opts.upLayout ?? 'pc' });
  w.hard = !!opts.hard;
  if (opts.startWeaponLevel) w.weapons.weaponLevel = opts.startWeaponLevel;

  const families = {};
  const trackedActors = new Map();
  const ensureFamily = (f) => (families[f] ??= {
    spawned: 0, firedAtLeastOnce: 0, escapedWithoutFiring: 0, totalLifespan: 0,
  });

  const sectorStats = {};
  for (let s = 0; s <= 6; s++) {
    sectorStats[s] = { ticks: 0, enemyTicks: 0, curGap: 0, maxGap: 0, shots: 0, peakEnemies: 0, peakBullets: 0 };
  }

  let routeTicks = 0;
  let visibleEnemyTicks = 0;
  let bulletOrWarnTicks = 0;
  let threatTicks = 0;
  let curEnemyGap = 0;
  let maxEnemyGap = 0;
  let maxEnemyGapAt = 0;
  let curThreatGap = 0;
  let maxThreatGap = 0;
  let maxThreatGapAt = 0;
  let idleGapsOver2s = 0;
  let idleGapsOver3s = 0;
  let inGap2 = false;
  let inGap3 = false;
  let sumEnemies = 0;
  let peakEnemies = 0;
  let peakBullets = 0;
  let totalRouteShots = 0;
  let specialsUsed = 0;

  let bossTicks = 0;
  let bossShots = 0;
  let bossPeakBullets = 0;
  let curBossBulletGap = 0;
  let maxBossBulletGap = 0;

  const stepSec = 1 / 60;
  for (let tick = 0; tick < 60 * 560 && !['victory', 'defeat'].includes(w.state); tick++) {
    if (opts.invincible) w.player.invulnerable = 2;
    const baseInput = steer(w, { collect: true, evade: true, special: !opts.invincible });
    const fire = opts.aggressive ? (tick % 6 < 2) : baseInput.fire;
    w.step(stepSec, { ...baseInput, fire });

    let frameEnemyShots = 0;
    for (const ev of w.events) {
      if (ev.type === 'enemy-shot') frameEnemyShots++;
      if (ev.type === 'special') specialsUsed++;
    }
    w.events = [];

    if (w.state !== 'play') continue;

    const curIds = new Set();
    for (const e of w.enemies) {
      curIds.add(e.id);
      if (!trackedActors.has(e.id)) {
        trackedActors.set(e.id, { family: e.family, age: e.age, fired: false, maxHp: e.maxHp });
        ensureFamily(e.family).spawned++;
      }
      const tr = trackedActors.get(e.id);
      tr.age = e.age;
      if (e.mountRecoil?.some(r => r > 0.9) || (e.cooldown > 0 && e.age > 0.15 && (e.attackStep ?? 0) > 0)) {
        tr.fired = true;
      }
    }
    if (frameEnemyShots > 0) {
      for (const e of w.enemies) {
        if (e.warning === 0 && e.age > 0.1 && e.x >= w.arena.left && e.x <= w.arena.right && e.y >= w.arena.top && e.y <= w.arena.bottom) {
          const tr = trackedActors.get(e.id);
          if (tr && !tr.fired && e.cooldown > 0.3) tr.fired = true;
        }
      }
    }
    for (const [id, tr] of trackedActors) {
      if (!curIds.has(id)) {
        const fa = ensureFamily(tr.family);
        fa.totalLifespan += tr.age;
        if (tr.fired) fa.firedAtLeastOnce++;
        if (!tr.fired && tr.age >= 1.0) fa.escapedWithoutFiring++;
        trackedActors.delete(id);
      }
    }

    const visibleEnemies = w.enemies.filter(
      e => e.hp > 0 && e.x > w.arena.left - 12 && e.x < w.arena.right + 12 && e.y > w.arena.top - 12 && e.y < w.arena.bottom + 12,
    );
    const activeBullets = w.bullets.filter(b => b.active && b.enemy);
    const hasWarn = visibleEnemies.some(e => e.warning > 0.05);

    if (!w.boss && w.route < 300) {
      routeTicks++;
      const sec = sectorStats[regionAt(w.route)];
      sec.ticks++;
      sec.shots += frameEnemyShots;
      sec.peakEnemies = Math.max(sec.peakEnemies, visibleEnemies.length);
      sec.peakBullets = Math.max(sec.peakBullets, activeBullets.length);

      totalRouteShots += frameEnemyShots;
      sumEnemies += visibleEnemies.length;
      peakEnemies = Math.max(peakEnemies, visibleEnemies.length);
      peakBullets = Math.max(peakBullets, activeBullets.length);

      if (visibleEnemies.length > 0) {
        visibleEnemyTicks++;
        curEnemyGap = 0;
        sec.enemyTicks++;
        sec.curGap = 0;
      } else {
        curEnemyGap += stepSec;
        if (curEnemyGap > maxEnemyGap) {
          maxEnemyGap = curEnemyGap;
          maxEnemyGapAt = Number(w.route.toFixed(1));
        }
        sec.curGap += stepSec;
        sec.maxGap = Math.max(sec.maxGap, sec.curGap);
      }

      if (activeBullets.length > 0 || hasWarn) bulletOrWarnTicks++;

      const hasThreat = visibleEnemies.length > 0 || activeBullets.length > 0 || hasWarn;
      if (hasThreat) {
        threatTicks++;
        curThreatGap = 0;
        inGap2 = false;
        inGap3 = false;
      } else {
        curThreatGap += stepSec;
        if (curThreatGap > maxThreatGap) {
          maxThreatGap = curThreatGap;
          maxThreatGapAt = Number(w.route.toFixed(1));
        }
        if (curThreatGap >= 2 && !inGap2) { idleGapsOver2s++; inGap2 = true; }
        if (curThreatGap >= 3 && !inGap3) { idleGapsOver3s++; inGap3 = true; }
      }
    } else if (w.boss) {
      bossTicks++;
      bossShots += frameEnemyShots;
      bossPeakBullets = Math.max(bossPeakBullets, activeBullets.length);
      if (activeBullets.length > 0 || w.boss.sub?.sections[w.boss.sub.activeSection]?.parts.some(p => p.warning > 0.05)) {
        curBossBulletGap = 0;
      } else {
        curBossBulletGap += stepSec;
        maxBossBulletGap = Math.max(maxBossBulletGap, curBossBulletGap);
      }
    }
  }

  const playableSeconds = routeTicks * stepSec;
  const sectorsOut = {};
  for (let s = 0; s <= 6; s++) {
    const st = sectorStats[s];
    const sSec = st.ticks * stepSec;
    sectorsOut[s] = {
      seconds: Number(sSec.toFixed(1)),
      pctWithVisibleEnemy: sSec > 0 ? Number(((st.enemyTicks / st.ticks) * 100).toFixed(1)) : 0,
      maxEnemyGapSec: Number(st.maxGap.toFixed(2)),
      enemyShots: st.shots,
      shotsPerMin: sSec > 0 ? Number(((st.shots / sSec) * 60).toFixed(1)) : 0,
      peakEnemies: st.peakEnemies,
      peakBullets: st.peakBullets,
    };
  }

  const extra = w.devPacingReport?.();

  return {
    label: opts.label,
    hard: !!opts.hard,
    upLayout: opts.upLayout ?? 'pc',
    weaponLevel: opts.startWeaponLevel ?? 1,
    state: w.state,
    routeReached: Number(w.route.toFixed(1)),
    totalElapsed: Number(w.elapsed.toFixed(1)),
    deaths: w.deaths,
    livesRemaining: w.lives,
    score: w.score,
    specialsUsed,
    routeStats: {
      playableSeconds: Number(playableSeconds.toFixed(1)),
      pctWithVisibleEnemy: Number(((visibleEnemyTicks / Math.max(1, routeTicks)) * 100).toFixed(1)),
      pctWithEnemyBulletOrWarning: Number(((bulletOrWarnTicks / Math.max(1, routeTicks)) * 100).toFixed(1)),
      pctWithAnyThreat: Number(((threatTicks / Math.max(1, routeTicks)) * 100).toFixed(1)),
      maxEnemyGapSec: Number(maxEnemyGap.toFixed(2)),
      maxEnemyGapAt,
      maxThreatGapSec: Number(maxThreatGap.toFixed(2)),
      maxThreatGapAt,
      idleGapsOver2s,
      idleGapsOver3s,
      totalEnemyShots: totalRouteShots,
      shotsPerMinute: Number(((totalRouteShots / Math.max(1, playableSeconds)) * 60).toFixed(1)),
      peakSimultaneousBullets: peakBullets,
      peakSimultaneousEnemies: peakEnemies,
      avgSimultaneousEnemies: Number((sumEnemies / Math.max(1, routeTicks)).toFixed(2)),
      directorReinforcements: extra?.reinforcementsSpawned ?? 0,
      directorAnticipations: extra?.wavesAnticipated ?? 0,
    },
    sectors: sectorsOut,
    bossStats: {
      durationSec: Number((bossTicks * stepSec).toFixed(1)),
      shotsFired: bossShots,
      shotsPerMin: Number(((bossShots / Math.max(1, bossTicks * stepSec)) * 60).toFixed(1)),
      peakBullets: bossPeakBullets,
      maxGapWithoutBulletsSec: Number(maxBossBulletGap.toFixed(2)),
    },
    families,
  };
}

if (process.argv[1]?.endsWith('pelagic-pacing-audit.mjs')) {
  const tag = process.argv.includes('--after') ? 'after' : 'before';
  const reports = [
    runPacingAudit({ label: 'NORMAL-PC-NV1', hard: false, upLayout: 'pc', startWeaponLevel: 1 }),
    runPacingAudit({ label: 'NORMAL-PC-NV3', hard: false, upLayout: 'pc', startWeaponLevel: 3 }),
    runPacingAudit({ label: 'NORMAL-PC-FULL', hard: false, upLayout: 'pc', startWeaponLevel: 5, aggressive: true }),
    runPacingAudit({ label: 'HARD-PC-NV1', hard: true, upLayout: 'pc', startWeaponLevel: 1, invincible: true }),
    runPacingAudit({ label: 'HARD-PC-FULL', hard: true, upLayout: 'pc', startWeaponLevel: 5, aggressive: true }),
    runPacingAudit({ label: 'ANDROID-PORTRAIT-NV1', hard: false, upLayout: 'portrait', startWeaponLevel: 1 }),
  ];
  mkdirSync('tmp/pacing-audit', { recursive: true });
  writeFileSync(`tmp/pacing-audit/${tag}.json`, JSON.stringify(reports, null, 2));
  console.log(`=== PELAGIC PACING AUDIT (${tag.toUpperCase()}) ===`);
  for (const r of reports) {
    console.log(
      `${r.label}: state=${r.state} route=${r.routeReached}s deaths=${r.deaths} | visibleEnemy=${r.routeStats.pctWithVisibleEnemy}% threat=${r.routeStats.pctWithAnyThreat}% | maxEnemyGap=${r.routeStats.maxEnemyGapSec}s(@${r.routeStats.maxEnemyGapAt}s) maxThreatGap=${r.routeStats.maxThreatGapSec}s(@${r.routeStats.maxThreatGapAt}s) gaps>2s=${r.routeStats.idleGapsOver2s} gaps>3s=${r.routeStats.idleGapsOver3s} | shots/min=${r.routeStats.shotsPerMinute} peakBullets=${r.routeStats.peakSimultaneousBullets} peakEnemies=${r.routeStats.peakSimultaneousEnemies} | archPct=${r.sectors[4].pctWithVisibleEnemy}% archMaxGap=${r.sectors[4].maxEnemyGapSec}s | bossShots/min=${r.bossStats.shotsPerMin}`,
    );
  }
}
