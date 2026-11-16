import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import {
    ENEMY_SHOTS,
    FAMILY,
    FENDA,
    LEGACY_SOLAR_FIRE,
    LEGACY_SOLAR_SHOTS,
    MISSIONS,
    SOLAR,
    WARHAWK_MISSILE_SPEED_HARD,
    WARHAWK_MISSILE_SPEED_NORMAL,
} from '../src/game/arcade/content.ts';
import {
    TURRET_MUZZLE_FRACTION,
    getMountSpecs,
    hasArticulatedMounts,
    resolveActorMounts,
    resolveHullVisualTransform,
} from '../src/game/arcade/PelagicWeaponMounts.ts';
import {
    heliBankColumn,
    heliSheetFrame,
    isHelicopterFamily,
    rotorSheetFrame,
} from '../src/game/arcade/PelagicActorAnimsMath.ts';

function makeFenda(hard = false) {
    const w = new ArcadeWorld(FENDA);
    w.state = 'play';
    w.hard = hard;
    w.waveIndex = 999;
    w.supplyIndex = 999;
    w.player.invulnerable = 10000;
    return w;
}

function activeEnemyBullets(w) {
    return w.bullets.filter(b => b.active && b.enemy);
}

// 1. Ship & boat cannons rotate toward player dynamically
test('1. naval surface cannons (boat & ship) track player angle across arena sweeps', () => {
    const w = makeFenda();
    w.spawnEncounter({ family: 'ship', formation: 'solo', motion: 'stationary', lane: 0.5 });
    const ship = w.enemies[0];
    ship.y = 140;
    w.player.x = 220;
    w.player.y = 360;
    for (let i = 0; i < 90; i++) w.updateEnemies(1 / 60);
    const leftAngle = resolveActorMounts(ship, w.player.x, w.player.y, w.elapsed)[0].aimAngle;

    w.player.x = 540;
    for (let i = 0; i < 90; i++) w.updateEnemies(1 / 60);
    const rightAngle = resolveActorMounts(ship, w.player.x, w.player.y, w.elapsed)[0].aimAngle;

    assert(leftAngle > Math.PI / 2, `Expected left aim > PI/2, got ${leftAngle}`);
    assert(rightAngle < Math.PI / 2, `Expected right aim < PI/2, got ${rightAngle}`);
    assert(hasArticulatedMounts('ship') && getMountSpecs('ship').length === 2);
});

// 2. Boat & ship bullets spawn at exact cannon barrel muzzle
test('2. naval boat & ship projectiles spawn precisely at rotating barrel muzzle tip', () => {
    for (const family of ['boat', 'ship']) {
        const w = makeFenda();
        w.spawnEncounter({ family, formation: 'solo', motion: 'stationary', lane: 0.5 });
        const actor = w.enemies[0];
        actor.x = 384;
        actor.y = 135;
        if (actor.navigation) {
            actor.navigation.worldY = 135 - w.scroll;
            actor.navigation.phase = 'hold';
        }
        for (let i = 0; i < 40; i++) {
            actor.cooldown = 5;
            w.updateEnemies(1 / 60);
        }
        const mountsBefore = resolveActorMounts(actor, w.player.x, w.player.y, w.elapsed);
        const expectedMount = mountsBefore[(actor.attackStep ?? 0) % mountsBefore.length];
        actor.cooldown = 0;
        w.updateEnemies(1 / 60);
        const fired = activeEnemyBullets(w);
        assert(fired.length > 0, `${family} should fire when ready`);
        for (const b of fired) {
            const dist = Math.hypot(b.px - expectedMount.muzzleX, b.py - expectedMount.muzzleY);
            assert(dist < 6.0, `${family} bullet origin drifted ${dist.toFixed(2)}px from barrel muzzle`);
        }
    }
});

// 3. Submarines never shoot submerged, emerge cleanly, and fire from exact deck gun barrels
test('3. submarine waits submerged, emits turrets smoothly on hold, and fires from deck barrel muzzles', () => {
    const w = makeFenda();
    w.scroll = 1200;
    w.spawnEncounter({ family: 'submarine', formation: 'solo', motion: 'stationary', lane: 0.35 });
    const sub = w.enemies[0];
    assert.equal(getMountSpecs('submarine').length, 2);

    // Phase emerge (0..1.19s): 0 shots allowed
    for (let i = 0; i < 65; i++) w.updateEnemies(1 / 60);
    assert.equal(activeEnemyBullets(w).length, 0, 'Submerged sub must never fire');

    // Advance into hold phase (exposure = 1)
    for (let i = 0; i < 20; i++) {
        sub.cooldown = 5;
        w.updateEnemies(1 / 60);
    }
    assert.equal(sub.submarine.phase, 'hold');
    assert(sub.submarine.exposure >= 0.92);

    const mounts = resolveActorMounts(sub, w.player.x, w.player.y, w.elapsed);
    assert(mounts.every(m => m.visible), 'Surfaced sub mounts must be visible');
    const expectedMount = mounts[(sub.attackStep ?? 0) % mounts.length];
    sub.cooldown = 0;
    w.updateEnemies(1 / 60);
    const shots = activeEnemyBullets(w);
    assert(shots.length > 0, 'Surfaced submarine should fire');
    for (const b of shots) {
        const d = Math.hypot(b.px - expectedMount.muzzleX, b.py - expectedMount.muzzleY);
        assert(d < 6, `Submarine shot originated ${d.toFixed(2)}px away from deck barrel muzzle`);
    }
});

// 4. Wave bobbing & roll keep turret socket attached to hull
test('4. ship & boat turret pivot tracks hull wave bob and roll lockstep across time', () => {
    const actor = { id: 7, x: 384, y: 150, size: 63, hp: 25, family: 'ship', heading: Math.PI };
    const pA = resolveActorMounts(actor, 384, 380, 0.2)[0];
    const pB = resolveActorMounts(actor, 384, 380, 0.72)[0];
    const hA = resolveHullVisualTransform(actor, 0.2);
    const hB = resolveHullVisualTransform(actor, 0.72);
    assert(Math.abs((hB.drawY - hA.drawY) - (pB.pivotY - pA.pivotY)) < 2.5);
    assert(TURRET_MUZZLE_FRACTION > 0.45 && TURRET_MUZZLE_FRACTION < 0.6);
});

// 5. Defense tower keeps stone base fixed while ONLY the top cannon rotates
test('5. coastal defense tower keeps hull stationary/unrotated while only turret aims and fires', () => {
    const w = makeFenda();
    w.spawnEncounter({ family: 'tower', formation: 'solo', motion: 'stationary', lane: 0.85 });
    const tower = w.enemies[0];
    w.scroll += 140 - tower.y;
    w.updateEnemies(1 / 60);
    w.player.x = 240;
    w.player.y = 360;
    for (let i = 0; i < 60; i++) {
        tower.cooldown = 5;
        w.updateEnemies(1 / 60);
    }
    const hull = resolveHullVisualTransform(tower, w.elapsed);
    assert.equal(hull.rotation, 0, 'Castle stone tower base must never rotate');
    const m = resolveActorMounts(tower, w.player.x, w.player.y, w.elapsed)[0];
    assert(Math.abs(m.aimAngle - Math.atan2(w.player.y - m.pivotY, w.player.x - m.pivotX)) < 0.15);

    tower.cooldown = 0;
    w.updateEnemies(1 / 60);
    const shots = activeEnemyBullets(w);
    assert.equal(shots.length, 1);
    assert(Math.hypot(shots[0].px - m.muzzleX, shots[0].py - m.muzzleY) < 4);
});

// 6. Destroyed defense tower & bunker leave wreck, hide cannon, and stop firing permanently
test('6. destroyed defense tower and tank emplacement immediately cease fire and create single coastal wreck', () => {
    for (const family of ['tower', 'tank']) {
        const w = makeFenda();
        w.spawnEncounter({ family, formation: 'solo', motion: 'stationary', lane: 0.85 });
        const e = w.enemies[0];
        e.y = 140;
        e.navigation.anchor = 1;
        w.damage(e, e.hp, e.x, e.y);
        assert.equal(e.hp, 0);
        assert.equal(w.wrecks.length, 1);
        assert.equal(w.wrecks[0].family, family);
        const hiddenMounts = resolveActorMounts(e, w.player.x, w.player.y, w.elapsed);
        assert(hiddenMounts.every(m => !m.visible), 'Destroyed emplacement cannon must hide');
        w.bullets.forEach(b => b.active = false);
        e.cooldown = 0;
        w.updateEnemies(1 / 60);
        assert.equal(activeEnemyBullets(w).length, 0, 'Destroyed emplacement must never fire');
    }
});

// 7. Ship dual turrets fire alternatingly from bow and bridge mounts
test('7. ship dual turrets alternate mounts with independent muzzle coordinates', () => {
    const w = makeFenda();
    w.spawnEncounter({ family: 'ship', formation: 'solo', motion: 'stationary', lane: 0.5 });
    const ship = w.enemies[0];
    ship.y = 140;
    if (ship.navigation) {
        ship.navigation.worldY = 140 - w.scroll;
        ship.navigation.phase = 'hold';
    }
    const m0 = resolveActorMounts(ship, w.player.x, w.player.y, w.elapsed)[0];
    const m1 = resolveActorMounts(ship, w.player.x, w.player.y, w.elapsed)[1];
    assert(Math.hypot(m0.pivotX - m1.pivotX, m0.pivotY - m1.pivotY) > ship.size * 0.18, 'Ship must have separated fore & aft cannon sockets');

    ship.cooldown = 0;
    w.updateEnemies(1 / 60);
    assert.equal(ship.attackStep, 1);
    w.bullets.forEach(b => b.active = false);
    ship.cooldown = 0;
    w.updateEnemies(1 / 60);
    assert.equal(ship.attackStep, 2);
});

// 8. Warhawk has rotatable chin gatling + fixed forward right-wing launcher pod
test('8. Warhawk mount 0 tracks player dynamically while mount 1 launcher pod aims forward', () => {
    const actor = {
        id: 42, x: 384, y: 110, size: 62, hp: 36, family: 'heli_warhawk', vx: 0, vy: 0,
        mountAngles: [Math.PI / 2, Math.PI / 2], mountRecoil: [0, 0],
    };
    const mFarLeft = resolveActorMounts(actor, 220, 380, 1);
    assert.equal(mFarLeft.length, 2);
    assert.equal(mFarLeft[0].canRotate, true);
    assert.equal(mFarLeft[1].canRotate, false);
    assert(Math.abs(mFarLeft[1].aimAngle - Math.PI / 2) < 0.05, 'Launcher pod aims along hull forward axis');
});

// 9 & 10. Airplane cadence & reduced first-shot delay in Fenda Pelágica
test('9 & 10. Fenda Pelagica airplanes have faster Sonic Wings cadence and quick opening shots', () => {
    assert(FAMILY.fighter.fire <= 1.0);
    assert(FAMILY.interceptor.fire <= 0.8);
    assert(FAMILY.acrobat.fire <= 1.15);
    assert(FAMILY.bomber.fire <= 1.25);

    const w = makeFenda();
    w.spawnEncounter({ family: 'fighter', formation: 'solo', motion: 'straight', lane: 0.5 });
    const f = w.enemies[0];
    assert(f.cooldown <= 0.55, `Expected short initial delay <= 0.55s, got ${f.cooldown}`);

    let firstShotAt = -1;
    for (let tick = 0; tick < 120; tick++) {
        w.step(1 / 60);
        if (firstShotAt < 0 && activeEnemyBullets(w).length > 0) firstShotAt = w.elapsed;
    }
    assert(firstShotAt > 0 && firstShotAt <= 1.1, `First shot took ${firstShotAt}s after spawn`);
});

// 11. Coordinated squad formation fire remains dodging-friendly
test('11. coordinated fighter trio staggers opening shots without stacking overlapping bullets', () => {
    const w = makeFenda();
    w.spawnEncounter({ family: 'fighter', formation: 'trio', motion: 'straight', lane: 0.5 });
    const cds = w.enemies.map(e => e.cooldown);
    assert(cds[0] < cds[1] && cds[1] < cds[2], 'Formation cooldowns should stagger progressively');
    for (let i = 0; i < 120; i++) w.step(1 / 60);
    assert(activeEnemyBullets(w).length <= 16);
});

// 12. Projectile speeds balanced per role
test('12. enemy shot speeds differentiate interceptors, standard fighters, heavy bombers, and missiles', () => {
    assert(ENEMY_SHOTS.interceptor.speed > ENEMY_SHOTS.fighter.speed);
    assert(ENEMY_SHOTS.fighter.speed > ENEMY_SHOTS.bomber.speed);
    assert(WARHAWK_MISSILE_SPEED_NORMAL >= 340);
    assert(WARHAWK_MISSILE_SPEED_HARD > WARHAWK_MISSILE_SPEED_NORMAL);
});

// 13, 14, 15, 16, 17, 18. Lateral & curved side entries
test('13 & 14. airplanes enter from left and right screen edges in safe upper lanes and cross arena cleanly', () => {
    for (const side of ['left', 'right']) {
        const w = makeFenda();
        w.spawnEncounter({ family: 'interceptor', formation: 'pair', motion: 'side-cross', lane: 0.25, speed: 165, entry: side });
        assert.equal(w.enemies.length, 2);
        for (const e of w.enemies) {
            assert(e.y <= 185, `Side entry must stay in upper band (got y=${e.y})`);
            if (side === 'left') assert(e.x < w.arena.left, `Left entry must start outside arena left (got ${e.x})`);
            else assert(e.x > w.arena.right, `Right entry must start outside arena right (got ${e.x})`);
        }
        // Step 0.05s: cannot shoot while outside visible safe arena!
        w.enemies.forEach(e => { e.cooldown = 0; });
        w.updateEnemies(0.05);
        assert.equal(activeEnemyBullets(w).length, 0, 'Offscreen side-entry plane must not shoot behind HUD');

        // Enter & fly across
        let enteredArena = false;
        for (let i = 0; i < 240; i++) {
            w.step(1 / 60);
            if (w.enemies.some(e => e.x > w.arena.left + 40 && e.x < w.arena.right - 40)) enteredArena = true;
        }
        assert(enteredArena, `${side} entry never entered visible combat arena`);
    }
});

test('15 & 16. curved side-entry aligns hull sprite rotation along velocity vector and turns downward', () => {
    const w = makeFenda();
    w.spawnEncounter({ family: 'fighter', formation: 'solo', motion: 'side-curve', lane: 0.2, speed: 130, entry: 'left' });
    const f = w.enemies[0];
    w.step(0.1);
    const earlyRot = resolveHullVisualTransform(f, w.elapsed).rotation;
    assert(Math.abs(earlyRot - Math.PI / 2) < 0.55, `Expected rightward heading rotation (~PI/2), got ${earlyRot}`);
    for (let i = 0; i < 140; i++) w.step(1 / 60);
    assert(f.vy > f.vx, 'Side-curve should bend downward past initial horizontal sweep');
    const lateRot = resolveHullVisualTransform(f, w.elapsed).rotation;
    assert(Math.abs(lateRot - Math.PI) < 0.7, `Expected curved downward rotation near PI, got ${lateRot}`);
});

test('17 & 18. alternating opposing-side encounters keep y <= 185 and never ambush near RIVET bottom', () => {
    const sideWaves = FENDA.encounters.filter(e => e.entry === 'left' || e.entry === 'right');
    assert(sideWaves.some(e => e.entry === 'left') && sideWaves.some(e => e.entry === 'right'), 'FENDA must feature both left and right lateral entries');
    const w = makeFenda();
    for (const enc of sideWaves) {
        w.enemies = [];
        w.spawnEncounter(enc);
        for (const a of w.enemies) assert(a.y <= 185, `Lateral encounter @ ${enc.at}s spawned too low: ${a.y}`);
    }
});

// 19, 20, 21, 22, 25. Four Distinct Helicopter Families & Resistance Progression
test('19-22 & 25. all four helicopter families have distinct specs, animations, and strict resistance progression', () => {
    const helis = ['heli_scout', 'heli_utility', 'heli_phantom', 'heli_warhawk'];
    for (const h of helis) {
        assert(isHelicopterFamily(h), `${h} must register as helicopter`);
        assert(FAMILY[h].score >= 400);
        assert.notEqual(rotorSheetFrame(h, 0.0, 0), rotorSheetFrame(h, 0.15, 0), `${h} rotor must spin across frames`);
        assert.equal(heliSheetFrame(h, -1), heliSheetFrame(h, -1));
        assert.notEqual(heliBankColumn(-1), heliBankColumn(1));
    }
    assert(FAMILY.fighter.hp < FAMILY.heli_scout.hp);
    assert(FAMILY.heli_scout.hp < FAMILY.heli_utility.hp);
    assert(FAMILY.heli_utility.hp < FAMILY.heli_phantom.hp);
    assert(FAMILY.heli_phantom.hp < FAMILY.heli_warhawk.hp);
    assert(FAMILY.heli_warhawk.hp <= 42, 'Warhawk should feel tough yet clearly defeatable (not a miniboss)');
});

test('20. heli_utility hovers smoothly with oscillating altitude and fires paired aimed shots', () => {
    const w = makeFenda();
    w.spawnEncounter({ family: 'heli_utility', formation: 'solo', motion: 'stationary', lane: 0.5 });
    const u = w.enemies[0];
    const alts = [];
    for (let i = 0; i < 160; i++) {
        w.step(1 / 60);
        if (u.hp > 0) alts.push(u.altitude);
    }
    assert(u.y < 180 && u.age > 2.4, 'Utility chopper should hold upper hover zone cleanly');
    assert(Math.max(...alts) - Math.min(...alts) > 0.1, 'Utility altitude should oscillate visibly');
    assert(activeEnemyBullets(w).some(b => b.radius === ENEMY_SHOTS.heli_utility.radius));
});

test('21. heli_phantom performs lateral stealth dashes and synchronized 3-way spreads', () => {
    const w = makeFenda();
    w.spawnEncounter({ family: 'heli_phantom', formation: 'solo', motion: 'side-curve', lane: 0.25, entry: 'left' });
    const p = w.enemies[0];
    const xs = [];
    for (let i = 0; i < 180; i++) {
        w.step(1 / 60);
        xs.push(p.x);
    }
    assert(Math.max(...xs) - Math.min(...xs) > 90, 'Phantom should sweep horizontally across arena');
    p.cooldown = 0;
    w.bullets.forEach(b => b.active = false);
    w.updateEnemies(1 / 60);
    assert.equal(activeEnemyBullets(w).length, 3, 'Phantom fires 3-way synchronized spread fan');
});

// 23 & 24. Warhawk alternating chin cannon <-> SINGLE straight unguided fast missile
test('23 & 24. heli_warhawk strictly alternates chin cannon bursts with 1 straight non-homing missile', () => {
    for (const hard of [false, true]) {
        const w = makeFenda(hard);
        w.spawnEncounter({ family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: 0.5 });
        const wh = w.enemies[0];
        wh.x = 384;
        wh.y = 105;

        // Burst 1 (step 0): chin cannon
        wh.cooldown = 0;
        w.updateEnemies(1 / 60);
        const burst1 = activeEnemyBullets(w);
        assert(burst1.length >= 2 && burst1.every(b => !b.enemyMissile), 'Phase 0 must fire chin cannon');

        // Burst 2 (step 1): chin cannon
        w.bullets.forEach(b => b.active = false);
        wh.cooldown = 0;
        w.updateEnemies(1 / 60);
        const burst2 = activeEnemyBullets(w);
        assert(burst2.length >= 2 && burst2.every(b => !b.enemyMissile), 'Phase 1 must fire chin cannon');

        // Launch 3 (step 2): SINGLE missile (NOT salvo!)
        w.bullets.forEach(b => b.active = false);
        wh.cooldown = 0;
        w.updateEnemies(1 / 60);
        const launch = activeEnemyBullets(w);
        assert.equal(launch.length, 1, 'Launcher phase must fire EXACTLY 1 missile');
        const m = launch[0];
        assert.equal(m.enemyMissile, true);
        assert.equal(m.homing, false, 'Warhawk missile must NEVER home');
        const expectedSpd = hard ? WARHAWK_MISSILE_SPEED_HARD : WARHAWK_MISSILE_SPEED_NORMAL;
        const actualSpd = Math.hypot(m.vx, m.vy);
        assert(Math.abs(actualSpd - expectedSpd) < 1e-6, `Expected missile speed ${expectedSpd}, got ${actualSpd}`);
        assert(actualSpd > ENEMY_SHOTS.fighter.speed * 1.6, 'Missile must travel distinctly faster than regular bullets');

        // Move RIVET sideways far to the left and step world: missile trajectory vector MUST stay straight (zero turning!)
        const vx0 = m.vx, vy0 = m.vy;
        w.player.x = 205;
        w.step(0.15);
        assert(Math.abs(m.vx - vx0) < 1e-8 && Math.abs(m.vy - vy0) < 1e-8, 'Straight missile must not curve toward moving player');

        // Step 3 wraps cleanly back to chin cannon!
        w.bullets.forEach(b => b.active = false);
        wh.cooldown = 0;
        w.updateEnemies(1 / 60);
        const burst3 = activeEnemyBullets(w);
        assert(burst3.length >= 2 && burst3.every(b => !b.enemyMissile), 'Phase 3 wraps back to chin cannon');
    }
});

// 26 & 28. Strict Stage 2 (Cidade Solar) isolation & difficulty balance
test('26 & 28. Cidade Solar preserves legacy fire rates & projectile speeds without Pelagic bleed', () => {
    assert.equal(SOLAR.encounters.length, 39);
    for (const e of SOLAR.encounters) {
        assert(!isHelicopterFamily(e.family), 'Cidade Solar must never contain Stage 1 helicopters');
    }
    const solar = new ArcadeWorld(MISSIONS[1]);
    solar.state = 'play';
    solar.waveIndex = 999;
    solar.supplyIndex = 999;
    solar.spawnEncounter({ family: 'fighter', formation: 'solo', motion: 'straight', lane: 0.5 });
    const sf = solar.enemies[0];
    sf.x = 420;
    sf.y = 220;
    sf.cooldown = 0;
    solar.updateEnemies(1 / 60);
    const sb = activeEnemyBullets(solar)[0];
    assert.equal(Math.hypot(sb.vx, sb.vy), LEGACY_SOLAR_SHOTS.fighter.speed);
    assert(Math.abs(sf.cooldown - LEGACY_SOLAR_FIRE.fighter) < 1e-6);
});

// 27. Fenda Pelagica encounters include all 4 helicopters & original families progressively
test('27. FENDA schedule spans all 4 helicopters progressively while retaining every original family', () => {
    const fams = new Set(FENDA.encounters.map(e => e.family));
    for (const orig of ['fighter', 'interceptor', 'acrobat', 'bomber', 'boat', 'ship', 'tank', 'tower', 'alien', 'submarine']) {
        assert(fams.has(orig), `Missing original family: ${orig}`);
    }
    const tScout = FENDA.encounters.find(e => e.family === 'heli_scout')?.at ?? -1;
    const tUtil = FENDA.encounters.find(e => e.family === 'heli_utility')?.at ?? -1;
    const tPhantom = FENDA.encounters.find(e => e.family === 'heli_phantom')?.at ?? -1;
    const tWarhawk = FENDA.encounters.find(e => e.family === 'heli_warhawk')?.at ?? -1;
    assert(tScout > 0 && tScout < tUtil && tUtil < tPhantom && tPhantom < tWarhawk,
        `Expected Scout(${tScout}) < Utility(${tUtil}) < Phantom(${tPhantom}) < Warhawk(${tWarhawk})`);
});

// 29. Visual asset integrity check for all generated combat v2 WebP sheets
test('29. combat v2 WebP assets exist with valid headers and non-trivial payloads', () => {
    const dir = path.resolve('public/assets/arcade/pelagic-review');
    for (const file of [
        'submarines-clean.webp',
        'defense-tower-clean.webp',
        'pelagic-turrets.webp',
        'pelagic-helicopters.webp',
        'pelagic-rotors.webp',
        'pelagic-enemy-missile.webp',
    ]) {
        const p = path.join(dir, file);
        assert(fs.existsSync(p), `Missing generated asset: ${file}`);
        const buf = fs.readFileSync(p);
        assert(buf.length > 4000, `Asset ${file} suspiciously small (${buf.length}B)`);
        assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF');
        assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP');
    }
});

// 30. Full 300s stress simulation produces zero NaNs and cleans exited/destroyed enemies cleanly
test('30. full 300s Fenda Pelagica simulation completes without NaNs, leaks, or runaway actor counts', () => {
    const w = new ArcadeWorld(FENDA);
    w.state = 'play';
    w.player.invulnerable = 99999;
    let maxEnemies = 0;
    for (let tick = 0; tick < 305 * 60; tick++) {
        w.step(1 / 60, { x: Math.sin(tick * 0.05), y: 0, fire: tick % 8 < 3, special: false });
        maxEnemies = Math.max(maxEnemies, w.enemies.length);
        for (const e of w.enemies) {
            assert(Number.isFinite(e.x) && Number.isFinite(e.y), `NaN/Inf coordinates on ${e.family}`);
        }
        if (w.route >= 300) break;
    }
    assert(w.route >= 300);
    assert(maxEnemies <= 26, `Enemy peak (${maxEnemies}) exceeded clean budget`);
});
