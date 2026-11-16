import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { PelagicCombatDirector } from '../src/game/arcade/PelagicCombatDirector.ts';
import {
    FENDA,
    LEGACY_SOLAR_FIRE,
    LEGACY_SOLAR_SHOTS,
    SOLAR,
    WARHAWK_MISSILE_SPEED_HARD,
    WARHAWK_MISSILE_SPEED_NORMAL,
} from '../src/game/arcade/content.ts';

function stepFor(world, seconds, input = { x: 0, y: 0, fire: false, special: false }) {
    const dt = 1 / 60;
    const n = Math.round(seconds / dt);
    for (let i = 0; i < n; i++) {
        world.step(dt, input);
        world.events = [];
        if (world.state === 'victory' || world.state === 'defeat') break;
    }
}

test('PelagicCombatDirector anticipates next scripted wave smoothly without telescoping across Tide Arch or Boss boundaries', () => {
    const dir = new PelagicCombatDirector();
    const ctxBase = {
        up: true,
        dt: 0.25,
        route: 14,
        region: 0,
        upLayout: 'pc',
        arenaWidth: 608,
        effectiveHard: false,
        isAssisted: false,
        inBossFight: false,
        tideArchActive: false,
        tideArchPhase: 'idle',
        playerInvulnerable: 0,
        playerX: 464,
        arenaCenterX: 464,
        visibleEnemies: 0,
        approachingEnemies: 0,
        activeEnemyBullets: 0,
        hasActiveWarning: false,
        frameEnemyShots: 0,
        nextEncounter: { at: 15.8, family: 'fighter', formation: 'pair', motion: 'curve', lane: 0.4 },
        specialEventActive: false,
    };

    const first = dir.evaluate(ctxBase);
    assert.equal(first.kind, 'none');

    // Once empty duration >= 0.40s and lead <= 2.6s, anticipates upcoming wave cleanly
    const second = dir.evaluate({ ...ctxBase, route: 14.25 });
    assert.equal(second.kind, 'anticipate');

    // Never anticipates across 148s Tide Arch boundary
    const boundary = dir.evaluate({
        ...ctxBase,
        route: 146.5,
        region: 3,
        nextEncounter: { at: 180.5, family: 'fighter', formation: 'pair', motion: 'curve', lane: 0.5 },
    });
    assert.equal(boundary.kind, 'none');
});

test('PelagicCombatDirector respects post-death recovery, Assisted restraint, high-density caps, and Tide Arch air-block', () => {
    const dir = new PelagicCombatDirector();
    const base = {
        up: true,
        dt: 0.5,
        route: 30,
        region: 0,
        upLayout: 'portrait',
        arenaWidth: 384,
        effectiveHard: false,
        isAssisted: false,
        inBossFight: false,
        tideArchActive: false,
        tideArchPhase: 'idle',
        playerInvulnerable: 0,
        playerX: 192,
        arenaCenterX: 192,
        visibleEnemies: 0,
        approachingEnemies: 0,
        activeEnemyBullets: 0,
        hasActiveWarning: false,
        frameEnemyShots: 0,
        nextEncounter: { at: 42, family: 'acrobat', formation: 'trio', motion: 'curve', lane: 0.5 },
        specialEventActive: false,
    };

    // Suppresses during post-death invulnerability recovery
    for (let i = 0; i < 4; i++) {
        const res = dir.evaluate({ ...base, playerInvulnerable: 2.0 });
        assert.equal(res.kind, 'none');
        assert.equal(res.reason, 'post-death-recovery');
    }

    // Suppresses when arena density already meets Android portrait soft cap
    const dense = dir.evaluate({ ...base, visibleEnemies: 7, activeEnemyBullets: 14 });
    assert.equal(dense.kind, 'none');
    assert.equal(dense.reason, 'high-density');

    // Suppresses reinforcements throughout extended Assisted respawn recovery window (4.2s)
    const assistedDir = new PelagicCombatDirector();
    for (let i = 0; i < 6; i++) {
        const aRes = assistedDir.evaluate({ ...base, isAssisted: true, playerInvulnerable: Math.max(1.3, 4.2 - i * 0.5) });
        assert.notEqual(aRes.kind, 'reinforce');
    }

    // During Tide Arch active crossing, never returns aircraft reinforcements
    const archDir = new PelagicCombatDirector();
    for (let i = 0; i < 6; i++) {
        const archRes = archDir.evaluate({
            ...base,
            route: 162 + i * 0.5,
            region: 4,
            tideArchActive: true,
            tideArchPhase: 'under-arch',
        });
        assert.ok(archRes.kind === 'none' || archRes.kind === 'arch-boat');
    }
});

test('Director reinforcements are strictly capped per sector to prevent infinite score farming', () => {
    const dir = new PelagicCombatDirector();
    let reinforcements = 0;
    for (let step = 0; step < 90; step++) {
        const res = dir.evaluate({
            up: true,
            dt: 0.5,
            route: 10 + step * 0.5,
            region: step * 0.5 < 35 ? 0 : 1,
            upLayout: 'pc',
            arenaWidth: 608,
            effectiveHard: false,
            isAssisted: false,
            inBossFight: false,
            tideArchActive: false,
            tideArchPhase: 'idle',
            playerInvulnerable: 0,
            playerX: 464,
            arenaCenterX: 464,
            visibleEnemies: 0,
            approachingEnemies: 0,
            activeEnemyBullets: 0,
            hasActiveWarning: false,
            frameEnemyShots: 0,
            nextEncounter: undefined,
            specialEventActive: false,
        });
        if (res.kind === 'reinforce') reinforcements++;
    }
    assert.ok(reinforcements >= 3 && reinforcements <= 8, `Expected bounded reinforcements across sectors 0-1 (<= 2*sectorCap), got ${reinforcements}`);
});

test('Fenda Pelagica 280-300s open-ocean biome clears coastal land threats while keeping naval/air buildup', () => {
    const openOcean = FENDA.encounters.filter(e => e.at >= 280 && e.at < 300);
    assert.ok(openOcean.length >= 4, 'Open ocean segment should sustain final buildup encounters');
    for (const e of openOcean) {
        assert.notEqual(e.family, 'tank', 'Open ocean (>=280s) must not spawn coastal tanks');
        assert.notEqual(e.family, 'tower', 'Open ocean (>=280s) must not spawn coastal towers');
    }
    assert.ok(WARHAWK_MISSILE_SPEED_NORMAL > 340 && WARHAWK_MISSILE_SPEED_HARD > WARHAWK_MISSILE_SPEED_NORMAL);
});

test('Live ArcadeWorld pacing metrics deliver continuous action in PC and Android Portrait while leaving Cidade Solar untouched', () => {
    const pc = new ArcadeWorld(FENDA, undefined, { upLayout: 'pc' });
    pc.devInvincible = true;
    stepFor(pc, 90, { x: 0, y: 0, fire: false, special: false });
    const pcMetrics = pc.devPacingReport();
    assert.ok(pcMetrics.pctWithThreat >= 80, `Expected PC threat presence >= 80%, got ${pcMetrics.pctWithThreat}%`);
    assert.ok(pcMetrics.enemyShotsPerMinute >= 65, `Expected PC enemy shots/min >= 65, got ${pcMetrics.enemyShotsPerMinute}`);
    assert.ok(pcMetrics.idleGapsOver3s <= 1, `Expected <= 1 long gap (>3s) in first 90s, got ${pcMetrics.idleGapsOver3s}`);

    const android = new ArcadeWorld(FENDA, undefined, { upLayout: 'portrait' });
    android.devInvincible = true;
    stepFor(android, 90, { x: 0, y: 0, fire: false, special: false });
    const androidMetrics = android.devPacingReport();
    assert.ok(androidMetrics.pctWithThreat >= 78, `Expected Android Portrait threat presence >= 78%, got ${androidMetrics.pctWithThreat}%`);

    // Verify Cidade Solar stays completely isolated
    assert.equal(SOLAR.encounters.length, 39);
    assert.equal(LEGACY_SOLAR_FIRE.fighter, 2.4);
    assert.equal(LEGACY_SOLAR_SHOTS.fighter?.speed, 145);
    const solar = new ArcadeWorld(SOLAR);
    stepFor(solar, 25);
    assert.equal(solar.devPacingReport().totalEncounters, 0);
});
