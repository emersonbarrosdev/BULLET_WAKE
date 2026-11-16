import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA, SOLAR, FAMILY } from '../src/game/arcade/content.ts';
import {
    PELAGIC_BOSS_BASE_CLEAR,
    PELAGIC_SECTOR_SURVIVAL_BONUS,
    bossPerformanceBonus,
    formationBonusPoints,
    sectorSurvivalBonus,
} from '../src/game/arcade/PelagicScoring.ts';
import { TIDE_ARCH_CHECKPOINT_BONUS, TIDE_ARCH_CLEAN_BONUS } from '../src/game/arcade/PelagicTideArch.ts';
import { stageFlightSnapshot } from '../src/game/systems/campaignFlight.ts';
import { readArcadeProgress, recordArcadeClear } from '../src/game/arcade/progress.ts';

function isolatedFenda(encounters = [], hard = false) {
    const w = new ArcadeWorld({ ...FENDA, encounters });
    w.state = 'play';
    w.hard = hard;
    w.player.invulnerable = 0;
    return w;
}

function advance(w, seconds, dt = 1 / 60) {
    const steps = Math.ceil(seconds / dt);
    for (let i = 0; i < steps; i++) w.step(dt);
}

test('pelagic scoring formulas match documented Normal and Hard tiers with solo exclusion', () => {
    assert.equal(formationBonusPoints(1, false), 0);
    assert.equal(formationBonusPoints(2, false), 200);
    assert.equal(formationBonusPoints(3, false), 300);
    assert.equal(formationBonusPoints(4, false), 500);
    assert.equal(formationBonusPoints(5, false), 700);
    assert.equal(formationBonusPoints(8, false), 1000);
    assert.equal(formationBonusPoints(3, true), 360);
    assert.equal(formationBonusPoints(8, true), 1200);

    for (let s = 0; s < PELAGIC_SECTOR_SURVIVAL_BONUS.length; s++) {
        assert.equal(sectorSurvivalBonus(s, false), PELAGIC_SECTOR_SURVIVAL_BONUS[s]);
        assert.equal(sectorSurvivalBonus(s, true), Math.round((PELAGIC_SECTOR_SURVIVAL_BONUS[s] * 1.2) / 10) * 10);
    }
    assert.equal(sectorSurvivalBonus(99, false), 0);

    // Performance bonus rewards clean and brisk clears rather than stalling
    assert.equal(bossPerformanceBonus(true, true, 18, false), 1500);
    assert.equal(bossPerformanceBonus(true, true, 32, false), 1250);
    assert.equal(bossPerformanceBonus(true, true, 60, false), 1000);
    assert.equal(bossPerformanceBonus(true, false, 60, false), 0);
    assert.equal(bossPerformanceBonus(false, true, 80, false), 4500);
    assert.equal(bossPerformanceBonus(false, true, 80, true), 5400);
    assert.equal(bossPerformanceBonus(false, false, 160, false), 0);
});

test('formation clear awards unique bonus even on simultaneous kills, and pays zero on incomplete squads or solos', () => {
    // 1) Full trio killed simultaneously in a single bomb/frame -> exactly ONE formation bonus
    const trioWave = { at: 1, family: 'fighter', formation: 'trio', motion: 'straight', lane: .5 };
    const w = isolatedFenda([trioWave]);
    advance(w, 1.2); // spawn wave at route >= 1 and let actors settle onscreen
    assert.equal(w.enemies.length, 3);
    const squadId = w.enemies[0].squadId;
    assert(squadId, 'trio must share a valid squadId');
    assert.equal(w.enemies.every(e => e.squadId === squadId), true);

    w.events.length = 0;
    for (const e of w.enemies) {
        e.y = 140;
        w.bullet(e.x, e.y - 8, 0, 500, 999, 6);
    }
    w.updateBullets(0.05);

    const expectedTrio = 3 * FAMILY.fighter.score + formationBonusPoints(3, false);
    assert.equal(w.score, expectedTrio, 'simultaneous wipe must award formation bonus exactly once');
    assert.equal(w.pelagicScoring.snapshot().formationsCleared, 1);
    const bonusEvents = w.events.filter(ev => ev.type === 'bonus' && ev.text === 'FORMAÇÃO');
    assert.equal(bonusEvents.length, 1);

    // 2) Incomplete squad: one enemy escapes offscreen, remaining killed -> ZERO formation bonus
    const wEsc = isolatedFenda([trioWave]);
    advance(wEsc, 1.2);
    assert.equal(wEsc.enemies.length, 3);
    wEsc.enemies[0].y = 500; // escapes bottom offscreen cleanly while still alive
    wEsc.step(1 / 60);
    assert.equal(wEsc.enemies.length, 2);
    wEsc.events.length = 0;
    for (const e of wEsc.enemies) {
        wEsc.bullet(e.x, e.y - 8, 0, 500, 999, 6);
    }
    wEsc.updateBullets(0.05);
    assert.equal(wEsc.score, 2 * FAMILY.fighter.score, 'escaped squad member must forfeit formation bonus');
    assert.equal(wEsc.pelagicScoring.snapshot().formationsCleared, 0);

    // 3) Solo encounter never receives a formation bonus
    const soloWave = { at: 1, family: 'interceptor', formation: 'solo', motion: 'straight', lane: .5 };
    const wSolo = isolatedFenda([soloWave]);
    advance(wSolo, 1.2);
    assert.equal(wSolo.enemies.length, 1);
    assert.equal(wSolo.enemies[0].squadId, undefined);
    wSolo.bullet(wSolo.enemies[0].x, wSolo.enemies[0].y - 8, 0, 500, 999, 6);
    wSolo.updateBullets(0.05);
    assert.equal(wSolo.score, FAMILY.interceptor.score);
});

test('survival bonus rewards clean sector crossings, never penalizes score on death, and recovers cleanly on later sectors', () => {
    const w = isolatedFenda([]);
    w.player.invulnerable = 0;

    // Cross Sector 0 -> Sector 1 (at 45s) cleanly without dying
    w.route = 44.95;
    w.step(0.05);
    const afterS0 = w.score;
    assert.equal(afterS0, sectorSurvivalBonus(0, false));
    assert.equal(w.pelagicScoring.snapshot().sectorsClean, 1);

    // Trigger genuine player death inside Sector 1
    w.bullet(w.player.x, w.player.y - 12, 0, 400, 1, 4, true);
    w.updateBullets(0.05);
    assert.equal(w.deaths, 1);
    assert.equal(w.score, afterS0, 'death must never deduct already-earned score');

    // Cross Sector 1 -> Sector 2 (at 90s): Sector 1 bonus forfeited, score unchanged
    w.route = 89.95;
    w.step(0.05);
    assert.equal(w.score, afterS0, 'dirty sector awards 0 survival bonus');
    assert.equal(w.pelagicScoring.snapshot().sectorsClean, 1);

    // Survive Sector 2 cleanly -> Sector 3 (at 135s): survival bonus resumes!
    w.route = 134.95;
    w.step(0.05);
    assert.equal(w.score, afterS0 + sectorSurvivalBonus(2, false));
    assert.equal(w.pelagicScoring.snapshot().sectorsClean, 2);
});

test('Arco das Mares checkpoint and Colosso Abissal sections award non-exploitable bonuses and performance rewards', () => {
    // Arco das Marés checkpoint awards clean + completion bonuses once, with zero reload farming
    const wArch = isolatedFenda([]);
    wArch.player.invulnerable = 10;
    wArch.devJumpTideArch('checkpoint', true);
    const afterArch = wArch.score;
    assert.equal(afterArch, TIDE_ARCH_CHECKPOINT_BONUS + TIDE_ARCH_CLEAN_BONUS);
    assert.ok(wArch.checkpoint);
    const snap = wArch.checkpoint;

    const resumed = isolatedFenda([]);
    assert.equal(resumed.restartFromCheckpoint(snap), true);
    assert.equal(resumed.score, afterArch, 'reloading checkpoint must not duplicate arch bonus score');
    resumed.step(1 / 60);
    assert.equal(resumed.score, afterArch, 'continuing from checkpoint never re-awards checkpoint bonus');

    // Colosso Abissal 5-section defeat + broken module/hull guard + death removes no-death performance bonus
    const wBoss = isolatedFenda([]);
    wBoss.player.invulnerable = 10;
    wBoss.tideArch.jumpTo('complete', wBoss.scroll, wBoss.playerHomeY);
    wBoss.route = 300;
    wBoss.step(1 / 60);
    assert(wBoss.boss?.sub, 'Colosso Abissal should spawn at route 300 after Tide Arch');
    const sub = wBoss.boss.sub;
    wBoss.player.invulnerable = 0;

    // Lose one life during boss battle so noDeath performance bonus is forfeited cleanly
    wBoss.bullet(wBoss.player.x, wBoss.player.y - 12, 0, 400, 1, 4, true);
    wBoss.updateBullets(0.05);
    assert.equal(wBoss.deaths, 1);

    // Advance out of enter phase quickly and destroy all 5 sections cleanly
    for (let secIdx = 0; secIdx < sub.sections.length; secIdx++) {
        for (let i = 0; i < 60 * 5 && sub.phase !== 'fight'; i++) {
            wBoss.player.invulnerable = 9;
            wBoss.step(1 / 60);
        }
        const sec = sub.sections[sub.activeSection];
        for (const p of sec.parts) {
            wBoss.bullet(p.x, p.y + 18, 0, -500, p.hp + 50, 8);
            wBoss.updateBullets(0.05);
            // Re-fire into dead module to verify zero farming
            wBoss.bullet(p.x, p.y + 18, 0, -500, 500, 8);
            wBoss.updateBullets(0.05);
        }
        // Destroy section hull cleanly
        const secY = wBoss.boss.y;
        while (sec.hullHp > 0) {
            wBoss.bullet(wBoss.boss.x, secY + 40, 0, -600, 500, 8);
            wBoss.updateBullets(0.05);
        }
        const beforeIdleHullShots = wBoss.score;
        wBoss.bullet(wBoss.boss.x, secY + 40, 0, -600, 500, 8);
        wBoss.updateBullets(0.05);
        assert.equal(wBoss.score, beforeIdleHullShots, 'destroyed hull section cannot be farmed');
        wBoss.step(1 / 60);
    }

    // Complete collapse + exit cleanly to victory
    for (let i = 0; i < 60 * 9 && wBoss.state !== 'victory'; i++) wBoss.step(1 / 60);
    assert.equal(wBoss.state, 'victory');

    // Calculate expected boss clear total: all 17 modules + 5 hulls (650 each) + 5 section clears (1800 each) + collapse base + lives + speed-only perf (0 noDeath)
    assert(wBoss.score >= PELAGIC_BOSS_BASE_CLEAR + wBoss.lives * 1000 + 5 * (650 + 1800));
    assert(wBoss.score > 30000);

    // Stage completion snapshot + persistence round-trip preserves exact Fenda Pelágica total
    const flight = stageFlightSnapshot(1, wBoss.weapons, wBoss.lives, wBoss.score);
    const saved = recordArcadeClear(readArcadeProgress(null), flight);
    const reloaded = readArcadeProgress(JSON.stringify(saved));
    assert.equal(reloaded.flights[1]?.score, wBoss.score);

    // SOLAR (Cidade Solar) must remain unaffected by Pelagic scoring systems
    const solar = new ArcadeWorld({ ...SOLAR, encounters: [] });
    solar.state = 'play';
    solar.route = 44.95;
    solar.step(0.05);
    assert.equal(solar.score, 0, 'Cidade Solar must not award Fenda Pelágica sector bonuses');
});
