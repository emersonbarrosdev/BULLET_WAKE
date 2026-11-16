import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { BurstController } from '../src/game/arcade/BurstController.ts';
import { MISSIONS, FAMILY, formationOffsets, FUTURE_ROUTES } from '../src/game/arcade/content.ts';
import { readArcadeProgress, recordArcadeClear } from '../src/game/arcade/progress.ts';
import { stageFlightSnapshot } from '../src/game/systems/campaignFlight.ts';
import { defaultSaveData } from '../src/game/systems/saveSystem.ts';

const live = (index = 0) => { const w = new ArcadeWorld(MISSIONS[index]); w.state = 'play'; w.player.invulnerable = 0; return w; };
const tick = (w, seconds, input) => { for (let n = 0; n < Math.round(seconds * 120); n++)w.step(1 / 120, input); };
test('arcade burst commits three pulses on tap, does not repeat while held, and accessibility enables auto-repeat', () => {
    const b = new BurstController(); assert.equal(b.update(0, true), 1); assert.equal(b.update(41, false), 0); assert.equal(b.update(1, false), 1); assert.equal(b.update(42, false), 1); assert.equal(b.update(10, false), 0); assert.equal(b.update(1, true), 1);
    const count = accessible => { const c = new BurstController(); let n = 0; for (let t = 0; t < 2000; t++)n += c.update(1, true, accessible); return n; };
    assert.equal(count(false), 3);
    assert(count(true) > count(false));
    b.reset(); assert.equal(b.update(0, true), 1);
});
test('resources cap at five and overflow gives points without an invisible reserve', () => {
    const w = live(); assert.equal(w.lives, 3); assert.equal(w.weapons.specialCharges, 2); w.lives = 5; w.weapons.specialCharges = 5; w.weapons.weaponLevel = 5;
    for (const [id, kind] of ['life', 'special', 'power'].entries()) w.cargo.push({ id, x: w.player.x, y: w.player.y, vx: 0, vy: 0, kind, crate: false, hp: 1, age: 0 });
    w.step(1 / 120); assert.equal(w.lives, 5); assert.equal(w.weapons.specialCharges, 5); assert.equal(w.weapons.weaponLevel, 5); assert.equal(w.score, 15000); assert.equal(w.cargo.length, 0);
});
test('death drops one ordinary P and cannot immediately restore full power', () => {
    const w = live(); w.weapons.weaponLevel = 5; w.weapons.specialCharges = 1; w.hurtPlayer(); assert.equal(w.lives, 2); assert.equal(w.weapons.weaponLevel, 1); assert.equal(w.weapons.specialCharges, 1); assert.equal(w.cargo.length, 1);
    const p = w.cargo[0]; p.x = w.player.x; p.y = w.player.y; p.vx = p.vy = 0; w.step(1 / 120); assert.equal(w.weapons.weaponLevel, 1); assert.equal(w.weapons.powerMeter, 1); assert.equal(w.deaths, 1);
});
test('whole boss hull takes local sector damage on SIDE and direct module vs hull on UP', () => {
    const side = live(1); side.startBoss(false); const boss = side.boss; boss.phase = 'fight'; boss.x = 580; boss.y = 215; side.updateBoss(0);
    const top = boss.parts[0], mid = boss.parts[1];
    side.bullet(450, boss.y - boss.size * .24, 1000, 0, 10, 2); side.updateBullets(.3);
    assert(boss.parts.some(p => p.hp < p.maxHp));
    const w = live(0); w.startBoss(false); const sub = w.boss.sub; sub.phase = 'fight'; sub.anchorY = 148; w.updateBoss(0);
    const p0 = sub.sections[0].parts[0], hullBefore = sub.sections[0].hullHp;
    // Direct hit on living left turret damages turret only, not hull
    w.bullet(p0.x, 320, 0, -1000, 15, 2); w.updateBullets(.25);
    assert.equal(p0.hp, p0.maxHp - 15); assert.equal(sub.sections[0].hullHp, hullBefore);
    // Shot into exposed deck lane damages hull directly without redirecting to distant turret
    const p1Before = sub.sections[0].parts[1].hp;
    w.bullet(w.boss.x - 22, 320, 0, -1000, 15, 2); w.updateBullets(.25);
    assert.equal(sub.sections[0].hullHp, hullBefore - 15); assert.equal(sub.sections[0].parts[1].hp, p1Before);
    assert.ok(top.maxHp > 0 && mid.maxHp > 0);
});

test('native silhouette rejection is respected instead of falling back to the sprite rectangle', () => {
    const w = live(); w.spawnEncounter({ family: 'bomber', formation: 'solo', motion: 'straight', lane: .5 }); const e = w.enemies[0]; e.x = 380; e.y = 200; w.contact = () => null; w.bullet(380, 220, 0, -500, 3, 2); w.updateBullets(.05); assert.equal(e.hp, FAMILY.bomber.hp);
    w.contact = () => .5; w.bullet(380, 220, 0, -500, 3, 2); w.updateBullets(.05); assert(e.hp < FAMILY.bomber.hp);
});
test('UP surface units are not contact hazards while aircraft are', () => {
    for (const family of ['boat', 'fighter']) { const w = live(); w.spawnEncounter({ family, formation: 'solo', motion: 'straight', lane: .5 }); const e = w.enemies[0]; e.x = e.lane = w.player.x; e.y = w.player.y; e.speed = 0; e.cooldown = 9; w.updateEnemies(.01); assert.equal(w.lives, family === 'boat' ? 3 : 2); }
});
test('Colosso Abissal progresses smoothly across five distinct destructible sections', () => {
    const w = live(); w.startBoss(false); const sub = w.boss.sub; assert.equal(sub.sections.length, 5); assert.equal(sub.activeSection, 0);
    sub.phase = 'fight'; sub.anchorY = 148; w.updateBoss(.01);
    assert.equal(sub.phase, 'fight');
    sub.sections[0].hullHp = 0; sub.sections[0].parts.forEach(p => p.hp = 0);
    w.updateBoss(.01);
    assert.equal(sub.activeSection, 1); assert.equal(sub.phase, 'transition');
    for (let i = 0; i < 220; i++)w.updateBoss(.01);
    assert.equal(sub.phase, 'fight'); assert.equal(w.boss.parts.length, sub.sections[1].parts.length);
});
test('boss warnings precede spherical volleys and a broken mount never fires', () => {
    const w = live(); w.startBoss(false); const sub = w.boss.sub; sub.phase = 'fight'; sub.anchorY = 148;
    sub.sections[0].parts[0].hp = 0; sub.sections[0].parts[1].cooldown = .9; sub.sections[0].parts[2].cooldown = 2;
    w.updateBoss(.4); assert(sub.sections[0].parts.some(p => p.warning > 0)); assert.equal(w.bullets.filter(p => p.active).length, 0);
    w.updateBoss(.6); assert(w.bullets.some(p => p.active && p.enemy)); assert(w.bullets.filter(p => p.active).every(p => p.radius > 0));
    sub.sections[0].parts.forEach(p => p.hp = 0); w.clearHostileBullets(); w.updateBoss(1.0); assert.equal(w.bullets.filter(p => p.active).length, 0);
});
test('special launches a bomb then expands an area blast with a finite damage budget', () => {
    const results = [];
    for (const fps of [60, 120]) {
        const w = live(); w.waveIndex = 999; w.supplyIndex = 999;
        w.spawnEncounter({ family: 'bomber', formation: 'solo', motion: 'straight', lane: .5 });
        const target = w.enemies[0]; target.x = w.player.x + 70; target.y = w.player.y - 182; target.hp = target.maxHp = 1000;
        w.bomb = { x: w.player.x, y: w.player.y, age: 0, phase: 'flight', radius: 0 }; w.specialTime = 2.75;
        for (let i = 0; i < Math.round(.5 * fps); i++)w.applySpecial(1 / fps);
        assert.equal(w.bomb.phase, 'flight'); assert.equal(target.hp, 1000);
        w.bullet(target.x, target.y, 0, 0, 1, 3, true);
        for (let i = 0; i < Math.round(2.5 * fps); i++)w.applySpecial(1 / fps);
        assert.equal(w.bomb, undefined); assert(w.bullets.every(b => !b.active));
        assert(target.hp < 850 && target.hp > 800, 'blast must damage lateral targets, with a finite budget');
        results.push(target.hp);
    }
    assert(Math.abs(results[0] - results[1]) < 2, 'blast timing must remain stable across update rates');
    const w = live(); const input = { x: 0, y: 0, fire: false, special: true }; w.step(.01, input); w.step(.01, input);
    assert.equal(w.weapons.specialCharges, 1, 'holding special cannot spend two charges');
    assert.equal(w.bomb.phase, 'flight');
});

test('FULL fires three guided missiles; moving ship emits from its current nose in either view', () => {
    for (const index of [0, 1]) {
        const w = live(index); w.weapons.weaponLevel = 5; w.fireMissiles(); assert.equal(w.bullets.filter(b => b.active && b.missile && b.homing).length, 3);
        w.bullets.forEach(b => b.active = false); w.weapons.weaponLevel = 1; const before = w.player.x; w.step(1 / 120, { x: 1, y: 0, fire: true, special: false }); const b = w.bullets.find(b => b.active); assert(w.player.x > before); assert(index ? b.x > w.player.x : b.y < w.player.y); assert(index ? Math.abs(b.y - w.player.y) < 1 : Math.abs(b.x - w.player.x) < 1);
    }
});
test('stage save retains both boundaries and preserves weak as well as strong loadouts', () => {
    for (const level of [1, 5]) {
        const w = live(); w.weapons.weaponLevel = level; w.weapons.powerMeter = level === 1 ? 1 : 0; w.weapons.specialCharges = 0; w.lives = 1; w.score = 12000;
        const f1 = stageFlightSnapshot(1, w.weapons, w.lives, w.score); let p = recordArcadeClear(readArcadeProgress(null), f1); p = recordArcadeClear(p, stageFlightSnapshot(2, w.weapons, 3, 20000)); p = readArcadeProgress(JSON.stringify(p));
        const next = new ArcadeWorld(MISSIONS[1], p.flights[1]); assert.equal(next.weapons.weaponLevel, level); assert.equal(next.lives, 1); assert.equal(next.weapons.specialCharges, 0); assert.equal(next.score, 12000); assert.equal(p.flights[2].lives, 3); assert.deepEqual(p.cleared, [1, 2]);
    }
});
test('malformed saves fail closed; legacy single boundary is migrated', () => {
    for (const raw of ['null', '{', '{"cleared":"all"}', '{"flights":[{}]}']) assert.deepEqual(readArcadeProgress(raw), { cleared: [], flights: {} });
    const w = live(), flight = stageFlightSnapshot(1, w.weapons, 3, 300); assert.equal(readArcadeProgress(JSON.stringify({ cleared: [1], flight })).flights[1].score, 300);
});
test('hard adds an escort without inflating HP; both routes have distinct late content and ten formations', () => {
    const normal = live(), hard = live(); hard.hard = true; normal.route = hard.route = 79; normal.step(.01); hard.step(.01); assert(hard.enemies.length > normal.enemies.length); assert.equal(hard.enemies.find(e => e.family === 'ship').maxHp, normal.enemies.find(e => e.family === 'ship').maxHp);
    for (const mission of MISSIONS) { assert(mission.encounters.some(e => e.at > 290)); assert.equal(new Set(mission.encounters.map(e => e.family)).has('alien'), true); }
    for (const name of ['solo', 'pair', 'trio', 'quartet', 'v', 'stagger', 'horde', 'escort', 'pincer', 'successive']) assert(formationOffsets(name).length > 0); assert.equal(FUTURE_ROUTES.filter(r => r.kind === 'secret').length, 3);
});
test('SIDE obstacles collide only in occupied space and destructible barriers take projectile damage', () => {
    const w = live(1); w.nextObstacle = 110; w.spawnObstacle(); assert(w.obstacles.length === 2); w.obstacles[0].x = w.player.x; w.obstacles[0].warning = 0; w.player.y = 230; w.updateObstacles(0); assert.equal(w.lives, 3);
    w.player.y = w.obstacles[0].y; w.updateObstacles(0); assert.equal(w.lives, 2);
    w.obstacles = [{ id: 9, x: 300, y: 210, width: 32, height: 58, kind: 'barrier', warning: 0, hp: 8, age: 0 }]; w.bullet(270, 210, 500, 0, 8, 2); w.updateBullets(.1); assert.equal(w.obstacles[0].hp, 0);
});
test('music defaults to background level below effects', () => { const s = defaultSaveData().settings; assert.equal(s.musicVolume, .18); assert(s.musicVolume < s.sfxVolume); });
test('victory clears residual shots and the automatic flyout leaves both arenas', () => {
    for (const index of [0, 1]) { const w = live(index); w.player.x = w.arena.left + 14; w.player.y = w.arena.bottom - 15; w.startBoss(false); if (w.boss.sub) { w.boss.sub.phase = 'collapse'; w.boss.sub.timer = 3.59; } else { w.boss.phase = 'sink'; w.boss.timer = 2.6; } w.bullet(300, 200, 0, -400, 1, 2); w.updateBoss(.02); assert.equal(w.state, 'exit'); assert.equal(w.bullets.filter(b => b.active).length, 0); tick(w, 3.5); assert.equal(w.state, 'victory'); assert(w.up ? w.player.y < w.arena.top - 20 : w.player.x > w.arena.right + 20); }
});
test('Giro has an aimed heavy fan distinct from the naval radial special', () => {
    const counts = []; for (const index of [0, 1]) { const w = live(index); w.startBoss(false); w.boss.attack = 3; w.bossVolley(w.boss, w.boss.parts, 0); counts.push(w.bullets.filter(b => b.active && b.enemy && b.radius > 7).length); } assert.deepEqual(counts, [12, 3]);
});
