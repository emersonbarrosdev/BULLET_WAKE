import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS, SUPPLIES } from '../src/game/arcade/content.ts';
import { createPlayerWeapons, collectPowerItem } from '../src/game/systems/weaponSystem.ts';
import { SaveSystem, STORAGE_KEY, defaultSaveData } from '../src/game/systems/saveSystem.ts';
import {
    ASSISTED_LOWER_LANE_ENEMY_COOLDOWN,
    ASSISTED_RESPAWN_BULLET_CLEAR_RADIUS,
    ASSISTED_RESPAWN_INVULNERABLE,
    applyRecoveryPower,
    computeAssistedDeathRecovery,
} from '../src/game/arcade/PelagicAssist.ts';

function liveStage(index = 0, opts = {}) {
    const w = new ArcadeWorld(MISSIONS[index]);
    w.state = 'play';
    w.player.invulnerable = 0;
    w.assisted = Boolean(opts.assisted);
    w.hard = Boolean(opts.hard);
    return w;
}

test('PelagicAssist recovery table reduces power monotonically without free level-ups', () => {
    assert.deepEqual(computeAssistedDeathRecovery(1, 0), { nextLevel: 1, nextMeter: 0, dropP: 0, priorProgress: 0 });
    assert.deepEqual(computeAssistedDeathRecovery(1, 1), { nextLevel: 1, nextMeter: 0, dropP: 1, priorProgress: 1 });
    assert.deepEqual(computeAssistedDeathRecovery(2, 1), { nextLevel: 1, nextMeter: 0, dropP: 2, priorProgress: 3 });
    assert.deepEqual(computeAssistedDeathRecovery(3, 1), { nextLevel: 1, nextMeter: 0, dropP: 3, priorProgress: 5 });
    assert.deepEqual(computeAssistedDeathRecovery(4, 1), { nextLevel: 2, nextMeter: 0, dropP: 2, priorProgress: 7 });
    assert.deepEqual(computeAssistedDeathRecovery(5, 0), { nextLevel: 3, nextMeter: 0, dropP: 2, priorProgress: 9 });

    // Recovery capsule caps cleanly at max weapon level without overflow +5000 bonus exploit
    let st = createPlayerWeapons('nolan');
    for (let i = 0; i < 8; i++) st = collectPowerItem(st).state; // NV4, 1/2 to NV5
    const applied = applyRecoveryPower(st, 3);
    assert.equal(applied.state.weaponLevel, 5);
    assert.equal(applied.appliedSteps, 1);
    assert.equal(applied.levelIncreased, true);
});

test('Assisted mode in Fenda Pelágica drops bounded golden recovery P, limits stacking, and requires physical pickup', () => {
    const w = liveStage(0, { assisted: true });
    assert.equal(w.isAssisted, true);
    w.weapons.weaponLevel = 5;
    w.weapons.powerMeter = 0;

    w.hurtPlayer();
    assert.equal(w.lives, 2);
    assert.equal(w.weapons.weaponLevel, 3);
    assert.equal(w.weapons.powerMeter, 0);
    assert.equal(w.player.invulnerable, ASSISTED_RESPAWN_INVULNERABLE);
    assert.equal(w.cargo.length, 1);
    assert.equal(w.cargo[0].recoveryP, 2);

    // Consecutive uncollected deaths keep at most 1 active recovery capsule and reduce further
    w.player.invulnerable = 0;
    w.hurtPlayer();
    assert.equal(w.lives, 1);
    assert.equal(w.weapons.weaponLevel, 1);
    const recoveryDrops = w.cargo.filter(c => c.kind === 'power' && c.recoveryP);
    assert.equal(recoveryDrops.length, 1);
    assert.equal(recoveryDrops[0].recoveryP, 3);

    // Must physically collide to collect; proximity alone does not magnetize
    const cap = recoveryDrops[0];
    cap.vx = 0;
    cap.vy = 0;
    cap.x = w.player.x + 36;
    cap.y = w.player.y;
    w.step(1 / 120);
    assert.equal(w.weapons.weaponLevel, 1);

    cap.x = w.player.x;
    cap.y = w.player.y;
    w.player.invulnerable = 0;
    w.bullets[2] = { active: true, x: w.player.x + 24, y: w.player.y, px: w.player.x + 24, py: w.player.y, vx: 0, vy: 80, damage: 1, radius: 3, enemy: true, missile: false, homing: false, age: 0, scale: 1, color: 0 };
    w.step(1 / 120);
    assert.equal(w.weapons.weaponLevel, 2);
    assert.equal(w.weapons.powerMeter, 1);
    assert.ok(w.player.invulnerable >= 0.85);
    assert.equal(w.bullets[2].active, false);
    assert.ok(w.events.some(e => e.type === 'comms' && e.text === 'pickup:recovery'));

    // Death at LV1 0P drops no free recovery capsule; LV1 1P drops bounded +1 recoveryP
    const lv1Empty = liveStage(0, { assisted: true });
    lv1Empty.hurtPlayer();
    assert.equal(lv1Empty.weapons.weaponLevel, 1);
    assert.equal(lv1Empty.cargo.length, 0);

    const lv1Partial = liveStage(0, { assisted: true });
    lv1Partial.weapons.weaponLevel = 1;
    lv1Partial.weapons.powerMeter = 1;
    lv1Partial.hurtPlayer();
    assert.equal(lv1Partial.weapons.weaponLevel, 1);
    assert.equal(lv1Partial.weapons.powerMeter, 0);
    assert.equal(lv1Partial.cargo.length, 1);
    assert.equal(lv1Partial.cargo[0].recoveryP, 1);
});

test('Assisted mode respawn clears close hostile bullets and delays lower-lane enemy shots', () => {
    const w = liveStage(0, { assisted: true });
    w.weapons.weaponLevel = 2;
    // Near bullet (< 135px from spawn (384, 375)) and far bullet (> 135px)
    w.bullets[0] = { active: true, x: 384, y: 290, px: 384, py: 290, vx: 0, vy: 80, damage: 1, radius: 3, enemy: true, missile: false, homing: false, age: 0, scale: 1, color: 0 };
    w.bullets[1] = { active: true, x: 384, y: 120, px: 384, py: 120, vx: 0, vy: 80, damage: 1, radius: 3, enemy: true, missile: false, homing: false, age: 0, scale: 1, color: 0 };
    w.enemies.push({
        id: 99, x: 384, y: 290, size: 28, hp: 5, maxHp: 5, age: 1, flash: 0,
        family: 'fighter', motion: 'straight', lane: 384, offset: 0, speed: 60, cooldown: 0.1, warning: 0, ground: false,
    });

    w.hurtPlayer();
    assert.equal(w.bullets[0].active, false);
    assert.equal(w.bullets[1].active, true);
    assert.ok(w.enemies[0].cooldown >= ASSISTED_LOWER_LANE_ENEMY_COOLDOWN);
    assert.ok(ASSISTED_RESPAWN_BULLET_CLEAR_RADIUS > 75);
});

test('Game Over and fresh sortie restart clear Assisted state and preserve supply cap (11 crates)', () => {
    assert.equal(SUPPLIES.length, 11);
    const w = liveStage(0, { assisted: true });
    w.lives = 1;
    w.weapons.weaponLevel = 4;
    w.hurtPlayer();
    assert.equal(w.lives, 0);
    assert.equal(w.state, 'defeat');

    const fresh = new ArcadeWorld(MISSIONS[0]);
    fresh.assisted = true;
    assert.equal(fresh.lives, 3);
    assert.equal(fresh.weapons.weaponLevel, 1);
    assert.equal(fresh.weapons.powerMeter, 0);
    assert.equal(fresh.cargo.length, 0);
});

test('Comparison across Assisted, Easy, Normal, Hard, and Cidade Solar confirms exact isolation', () => {
    const assist = liveStage(0, { assisted: true, hard: true });
    assist.weapons.weaponLevel = 5;
    assist.hurtPlayer();

    const easy = liveStage(0, { assisted: false, hard: false });
    easy.weapons.weaponLevel = 5;
    easy.hurtPlayer();

    const normal = liveStage(0, { assisted: false, hard: true });
    normal.weapons.weaponLevel = 5;
    normal.hurtPlayer();

    const hard = liveStage(0, { assisted: false, hard: true });
    hard.setDifficulty('hard');
    hard.weapons.weaponLevel = 5;
    hard.hurtPlayer();

    const solar = liveStage(1, { assisted: true, hard: true });
    solar.weapons.weaponLevel = 5;
    solar.hurtPlayer();

    assert.equal(assist.weapons.weaponLevel, 3);
    assert.equal(assist.cargo[0].recoveryP, 2);
    assert.equal(assist.player.invulnerable, 4.2);

    assert.equal(easy.weapons.weaponLevel, 1);
    assert.equal(easy.cargo[0].recoveryP, undefined);
    assert.equal(easy.player.invulnerable, 3);

    // Rebalanced Normal: drops strictly 1 level (5 -> 4), 3.5s invulnerability, no exploitable extra P drop
    assert.equal(normal.weapons.weaponLevel, 4);
    assert.equal(normal.weapons.powerMeter, 0);
    assert.equal(normal.cargo.length, 0);
    assert.equal(normal.player.invulnerable, 3.5);

    // Hard keeps strict classic arcade penalty (5 -> 1, 3.0s invulnerability)
    assert.equal(hard.weapons.weaponLevel, 1);
    assert.equal(hard.cargo[0].recoveryP, undefined);
    assert.equal(hard.player.invulnerable, 3);

    assert.equal(solar.isAssisted, false);
    assert.equal(solar.weapons.weaponLevel, 1);
    assert.equal(solar.cargo[0].recoveryP, undefined);
    assert.equal(solar.player.invulnerable, 3);
});

test('SaveSystem defaults assisted=false for legacy saves and persists assisted toggle safely', () => {
    const prevWindow = globalThis.window;
    const mem = new Map();
    const storage = {
        getItem: k => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, v),
        removeItem: k => mem.delete(k),
    };
    globalThis.window = { localStorage: storage };
    try {
        const legacy = defaultSaveData();
        legacy.schemaVersion = 1;
        delete legacy.settings.assisted;
        storage.setItem(STORAGE_KEY, JSON.stringify(legacy));

        const save = new SaveSystem();
        assert.equal(save.getSettings().assisted, false);

        save.updateSettings({ difficulty: 'hard', assisted: true });
        const reloaded = new SaveSystem();
        assert.equal(reloaded.getSettings().assisted, true);
        assert.equal(reloaded.getSettings().difficulty, 'hard');
    } finally {
        globalThis.window = prevWindow;
    }
});
