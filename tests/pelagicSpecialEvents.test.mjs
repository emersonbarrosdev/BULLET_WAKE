import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA, SOLAR, SUPPLIES, FAMILY } from '../src/game/arcade/content.ts';
import { touchesCoast } from '../src/game/arcade/PelagicEnvironment.ts';
import {
    PELAGIC_CONVOY_CLEAR_BONUS,
    PELAGIC_RARE_BONUS,
    PELAGIC_RARE_FALLBACK_AT,
    isRareVisitorEligible,
} from '../src/game/arcade/PelagicSpecialEvents.ts';
import { steer } from '../scripts/arcade-route.mjs';

function makeIsolatedFenda(hard = false) {
    const w = new ArcadeWorld({ ...FENDA, encounters: [] });
    w.state = 'play';
    w.hard = hard;
    w.player.invulnerable = 1000;
    return w;
}

test('isolated naval convoy aligns vessels safely inside navigable water corridors with staggered fire and capped clear bonus', () => {
    for (const hard of [false, true]) {
        const w = makeIsolatedFenda(hard);
        assert.equal(w.triggerSpecialEvent('naval-convoy'), true);
        assert.equal(w.triggerSpecialEvent('naval-convoy'), false, 'convoy must never spawn duplicate instances');

        const vessels = w.enemies.filter(e => e.eventRole === 'convoy-lead' || e.eventRole === 'convoy-escort');
        const air = w.enemies.filter(e => e.eventRole === 'convoy-air');
        assert.equal(vessels.length, 3);
        assert.equal(air.length, hard ? 3 : 2);

        for (let tick = 0; tick < 60 * 14; tick++) {
            w.step(1 / 60);
            for (const e of w.enemies) {
                assert.equal(e.maxHp, FAMILY[e.family].hp);
                if (e.eventRole === 'convoy-lead' || e.eventRole === 'convoy-escort') {
                    assert.equal(touchesCoast(e.x, e.navigation.worldY, e.size * 0.51), false, 'convoy vessel crossed coastal land');
                }
            }
        }
    }

    // Convoy dismantling awards bounded bonus exactly once
    const w2 = makeIsolatedFenda(false);
    w2.triggerSpecialEvent('naval-convoy');
    const scoreBefore = w2.score;
    for (const e of w2.enemies) {
        if (e.eventRole === 'convoy-lead' || e.eventRole === 'convoy-escort') {
            w2.bullet(e.x, e.y - 8, 0, 400, 999, 4);
            w2.updateBullets(0.05);
        }
    }
    const expectedVesselsScore = FAMILY.ship.score + 2 * FAMILY.boat.score + PELAGIC_CONVOY_CLEAR_BONUS;
    assert.equal(w2.score - scoreBefore, expectedVesselsScore);
    assert.equal(w2.cargo.length, 0, 'convoy must not alter planned supply item count');
});

test('isolated elite interception performs weaving strafe, pre-shot warning, and Normal vs Hard escalation', () => {
    for (const hard of [false, true]) {
        const w = makeIsolatedFenda(hard);
        assert.equal(w.triggerSpecialEvent('elite-interception'), true);
        const aces = w.enemies.filter(e => e.eventRole === 'elite-ace');
        assert.equal(aces.length, hard ? 4 : 3);

        let sawWarningBeforeShot = false;
        let maxBulletsSeen = 0;
        let minAceY = 999;

        for (let tick = 0; tick < 60 * 8; tick++) {
            const activeBefore = w.bullets.filter(b => b.active && b.enemy).length;
            w.step(1 / 60);
            const activeAfter = w.bullets.filter(b => b.active && b.enemy).length;
            maxBulletsSeen = Math.max(maxBulletsSeen, activeAfter);
            if (activeBefore === 0 && activeAfter > 0) {
                sawWarningBeforeShot = true;
            }
            if (aces.some(a => a.hp > 0 && a.warning > 0.2 && activeAfter === 0)) {
                sawWarningBeforeShot = true;
            }
            for (const a of aces) {
                if (a.age > 1.5 && a.age < 4.5 && a.hp > 0) minAceY = Math.min(minAceY, a.y);
            }
        }
        assert(sawWarningBeforeShot, 'elite aces must telegraph warnings before releasing twin darts');
        assert(minAceY < 185, 'elite aces should weave cleanly in upper engagement lane');
        assert(maxBulletsSeen <= (hard ? 22 : 16), `excessive elite bullet clutter: ${maxBulletsSeen}`);
    }
});

test('isolated coordinated strike alternates maritime submarine volleys and aerial wings to avoid bullet pile-up', () => {
    const w = makeIsolatedFenda(false);
    assert.equal(w.triggerSpecialEvent('coordinated-strike'), true);
    const sub = w.enemies.find(e => e.eventRole === 'coord-sub');
    const wings = w.enemies.filter(e => e.eventRole === 'coord-wing');
    assert(sub && wings.length === 2);
    assert.equal(touchesCoast(sub.x, sub.navigation.worldY, sub.size * 0.51), false);

    let subShotTicks = 0;
    let wingShotTicks = 0;
    let simultaneousVolleys = 0;
    let prevSubCd = sub.cooldown;
    let prevWingCds = wings.map(a => a.cooldown);

    for (let tick = 0; tick < 60 * 9; tick++) {
        w.step(1 / 60);
        const subFired = sub.hp > 0 && sub.cooldown > prevSubCd + 0.3;
        const wingFired = wings.some((a, idx) => a.hp > 0 && a.cooldown > prevWingCds[idx] + 0.3);
        if (subFired) subShotTicks++;
        if (wingFired) wingShotTicks++;
        if (subFired && wingFired) simultaneousVolleys++;
        prevSubCd = sub.cooldown;
        prevWingCds = wings.map(a => a.cooldown);
    }

    assert(subShotTicks >= 1 && wingShotTicks >= 1, 'both sea and air wings must engage');
    assert.equal(simultaneousVolleys, 0, 'sea and air fire phases must alternate cleanly without stacking');
});

test('rare visitor follows deterministic capped eligibility, never farms infinite score/items, and exits cleanly', () => {
    assert.equal(isRareVisitorEligible(false, 68, 0, 15, false, false), false, 'never in Cidade Solar');
    assert.equal(isRareVisitorEligible(true, 68, 0, 15, false, false), true, 'eligible cleanly at 66s with 0 deaths');
    assert.equal(isRareVisitorEligible(true, 68, 1, 15, false, false), false, 'early slot skipped if player died');
    assert.equal(isRareVisitorEligible(true, PELAGIC_RARE_FALLBACK_AT + 1, 1, 22, false, false), true, 'late fallback slot eligible if still untriggered');
    assert.equal(isRareVisitorEligible(true, PELAGIC_RARE_FALLBACK_AT + 1, 0, 22, true, false), false, 'strictly capped at 1 per sortie');

    // Verify clean kill bonus cap and non-duplication
    const w = makeIsolatedFenda(false);
    assert.equal(w.triggerSpecialEvent('rare-visitor'), true);
    assert.equal(w.triggerSpecialEvent('rare-visitor'), false, 'cannot trigger twice normally');
    const rare = w.enemies.find(e => e.eventRole === 'rare-probe');
    assert(rare);
    const before = w.score;
    w.bullet(rare.x, rare.y - 6, 0, 400, 999, 4);
    w.updateBullets(0.05);
    assert.equal(w.score - before, FAMILY.alien.score + PELAGIC_RARE_BONUS);
    assert.equal(w.cargo.length, 0, 'rare visitor must not spawn infinite supplies');

    // Verify full mission simulation triggers events at most once without mutating SOLAR, SUPPLIES, or HP
    assert.equal(SOLAR.encounters.length, 39);
    assert.equal(SUPPLIES.length, 11);

    for (const hard of [false, true]) {
        const sim = new ArcadeWorld(FENDA);
        sim.hard = hard;
        for (let tick = 0; tick < 120 * 440 && !['victory', 'defeat'].includes(sim.state); tick++) {
            if (hard) sim.player.invulnerable = 1;
            const input = steer(sim, { collect: true, evade: true, special: true });
            sim.step(1 / 120, input);
        }
        assert.equal(sim.specialEventsTriggered.has('naval-convoy'), true, `missing convoy in hard=${hard}`);
        assert.equal(sim.specialEventsTriggered.has('elite-interception'), true, `missing elite interception in hard=${hard}`);
        assert.equal(sim.specialEventsTriggered.has('coordinated-strike'), true, `missing coordinated strike in hard=${hard}`);
        assert.equal(sim.specialEventsTriggered.has('rare-visitor'), true, `missing rare visitor in hard=${hard}`);
        assert.equal(sim.state, 'victory', `full mission timeline must complete cleanly in hard=${hard}`);
    }
});
