import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA, SOLAR, SUPPLIES, FAMILY, formationOffsets } from '../src/game/arcade/content.ts';
import { TIDE_ARCH_CANNONS, TIDE_ARCH_BOATS } from '../src/game/arcade/PelagicTideArch.ts';
import { steer, runRoute } from '../scripts/arcade-route.mjs';

const SECTORS = [
    { name: '0-60', start: 0, end: 60 },
    { name: '60-115', start: 60, end: 115 },
    { name: '115-160', start: 115, end: 160 },
    { name: '160-180', start: 160, end: 180 },
    { name: '240-300', start: 240, end: 300 },
    { name: '300-360', start: 300, end: 360 },
];

test('Fenda Pelagica covers all progression slices including Arco das Mares (180-240), expressway (160-180), and 11 preserved Solar crates', () => {
    assert.equal(SUPPLIES.length, 11);
    assert.equal(SUPPLIES.filter(s => s.kind === 'power').length, 9);
    assert.equal(SUPPLIES.filter(s => s.kind === 'special').length, 1);
    assert.equal(SUPPLIES.filter(s => s.kind === 'life').length, 1);

    for (const s of SECTORS) {
        const list = FENDA.encounters.filter(e => e.at >= s.start && e.at < s.end);
        assert(list.length >= 3, `sector ${s.name} needs varied encounters`);
    }
    assert(TIDE_ARCH_CANNONS.length >= 8 && TIDE_ARCH_BOATS.length >= 6, '180-240 Arco das Mares sector must replace legacy miniboss with cannons and patrol boats');

    const expressEncounters = FENDA.encounters.filter(e => e.at >= 160 && e.at < 180);
    const expressShipCount = expressEncounters.reduce((sum, e) => sum + formationOffsets(e.formation).length, 0);
    assert(expressShipCount <= 12, `160-180 express sector must stay controlled, got ${expressShipCount}`);
    const lastBeforeArch = Math.max(...expressEncounters.map(e => e.at));
    assert(180 - lastBeforeArch >= 3, 'must preserve a clear breathing window before 180s Arco das Mares');

    const families = new Set(FENDA.encounters.map(e => e.family));
    for (const req of ['fighter', 'interceptor', 'acrobat', 'bomber', 'boat', 'ship', 'tank', 'tower', 'alien', 'submarine']) {
        assert(families.has(req), `Fenda missing enemy family ${req}`);
    }
    assert.equal(SOLAR.perspective, 'SIDE');
    assert.equal(SOLAR.encounters.length, 39);
});

test('every formation and motion executes cleanly without offscreen traps or simultaneous squad bullet walls', () => {
    const formations = ['solo', 'pair', 'trio', 'quartet', 'v', 'stagger', 'horde', 'escort', 'pincer', 'successive'];
    const motions = ['straight', 'diagonal', 'curve', 'sine', 'zigzag', 'turn', 'dive', 'accelerate', 'retreat', 'stationary'];

    for (const formation of formations) {
        for (const motion of motions) {
            const w = new ArcadeWorld(FENDA);
            w.state = 'play';
            w.waveIndex = 999;
            w.supplyIndex = 999;
            w.player.invulnerable = 1000;
            w.spawnEncounter({ family: 'fighter', formation, motion, lane: 0.5 });
            assert.equal(w.enemies.length, formationOffsets(formation).length);

            if (w.enemies.length > 1) {
                const cooldowns = new Set(w.enemies.map(e => Number(e.cooldown.toFixed(2))));
                assert(cooldowns.size === w.enemies.length, `${formation} must stagger initial shot cooldowns`);
            }

            for (let f = 0; f < 180; f++) {
                w.step(1 / 60);
                for (const e of w.enemies) {
                    assert(e.x >= w.arena.left - 10 && e.x <= w.arena.right + 10);
                }
            }
        }
    }
});

test('UP enemies do not release shots from the top screen edge or point-blank behind the player', () => {
    const w = new ArcadeWorld(FENDA);
    w.state = 'play';
    w.waveIndex = 999;
    w.supplyIndex = 999;
    w.spawnEncounter({ family: 'interceptor', formation: 'solo', motion: 'straight', lane: 0.5 });
    const e = w.enemies[0];
    e.x = 384;
    e.y = w.arena.top + 8; // Top edge -> must not shoot yet
    e.cooldown = 0;
    w.updateEnemies(1 / 60);
    assert.equal(w.bullets.filter(b => b.active && b.enemy).length, 0, 'must not fire right at top border');

    e.y = w.player.y - 36; // Point-blank close behind safe cutoff (44 px)
    e.cooldown = 0;
    w.updateEnemies(1 / 60);
    assert.equal(w.bullets.filter(b => b.active && b.enemy).length, 0, 'must not fire point-blank near player');
});

test('Fenda Pelagica Normal and Hard both progress cleanly without HP inflation, unavoidable traps, or enemy overload', () => {
    const run = hard => {
        const w = new ArcadeWorld(FENDA);
        w.hard = hard;
        let maxActiveEnemies = 0;
        let maxHostileBullets = 0;
        let routeDeaths = 0;
        const familyMaxHp = new Map();
        const regionPeaks = new Map();

        for (let tick = 0; tick < 120 * 520 && !['victory', 'defeat'].includes(w.state); tick++) {
            const input = steer(w, { collect: true, evade: true, special: true });
            w.step(1 / 120, input);
            for (const ev of w.events) if (ev.type === 'death' && w.route < 360) routeDeaths++;
            w.events = [];

            for (const e of w.enemies) {
                const prev = familyMaxHp.get(e.family) ?? e.maxHp;
                assert.equal(e.maxHp, prev);
                assert.equal(e.maxHp, FAMILY[e.family].hp);
                familyMaxHp.set(e.family, e.maxHp);
            }
            const enemies = w.enemies.length;
            const enemyBullets = w.bullets.filter(b => b.active && b.enemy).length;
            maxActiveEnemies = Math.max(maxActiveEnemies, enemies);
            maxHostileBullets = Math.max(maxHostileBullets, enemyBullets);
            regionPeaks.set(w.region, Math.max(regionPeaks.get(w.region) ?? 0, enemies));
        }
        return { state: w.state, route: w.route, elapsed: w.elapsed, deaths: w.deaths, routeDeaths, lives: w.lives, score: w.score, maxActiveEnemies, maxHostileBullets, regionPeaks };
    };

    const normal = run(false);
    const hardCheck = runRoute(0, { hard: true, invincible: true });
    const hardReal = run(true);
    assert.equal(normal.route, 360, `Normal must reach final boss at 360s (stopped at ${normal.route}s)`);
    assert(normal.routeDeaths <= 3, `Normal stage should remain dodgeable without heavy casualties, got ${normal.routeDeaths}`);
    assert(normal.maxActiveEnemies <= 18, `Too many simultaneous enemies on Normal: ${normal.maxActiveEnemies}`);
    assert.equal(hardCheck.result.state, 'victory');
    assert(hardCheck.result.maxActors <= 26, `Too many simultaneous enemies on Hard: ${hardCheck.result.maxActors}`);
    assert((normal.regionPeaks.get(3) ?? 0) <= 7, 'Expressway region 3 (160-180) should keep simultaneous enemies controlled');
    assert(hardReal.route >= 210, `Hard pressure must remain fair and playable through Tide Arch, got ${hardReal.route}s (state=${hardReal.state})`);
});
