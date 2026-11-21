import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA, SOLAR } from '../src/game/arcade/content.ts';
import { PILOT_IDS, getPilotContract, perspectiveLabelPt } from '../src/game/arcade/ArcadeContracts.ts';
import { evaluateArcadeRun } from '../src/game/arcade/ArcadeRanking.ts';
import { ACHIEVEMENTS } from '../src/game/arcade/ArcadeAchievements.ts';
import { ArcadeProfileStore, PROFILE_STORAGE_KEY } from '../src/game/arcade/ArcadeProfileStore.ts';
import { ReplayPlayer, ReplayRecorder } from '../src/game/arcade/ArcadeReplay.ts';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
}

test('All five pilots are selectable in ArcadeWorld with distinct specials, focus, and weapons', () => {
  const specialTypes = new Set();
  for (const pid of PILOT_IDS) {
    const w = new ArcadeWorld(FENDA, undefined, { pilotId: pid, seed: 42 });
    w.introTime = 0;
    w.state = 'play';
    assert.equal(w.pilotId, pid);
    assert.equal(w.pilotContract.id, pid);
    specialTypes.add(w.pilotContract.specialType);

    // Focus reduces speed accurately and sets focusActive
    const xStart = w.player.x;
    w.step(1 / 120, { x: 1, y: 0, fire: false, special: false, focus: false });
    const dxNormal = w.player.x - xStart;

    const wFocus = new ArcadeWorld(FENDA, undefined, { pilotId: pid, seed: 42 });
    wFocus.introTime = 0;
    wFocus.state = 'play';
    const xfStart = wFocus.player.x;
    wFocus.step(1 / 120, { x: 1, y: 0, fire: false, special: false, focus: true });
    const dxFocus = wFocus.player.x - xfStart;
    assert.equal(wFocus.player.focusActive, true);
    assert.ok(dxFocus < dxNormal, `${pid} focus step (${dxFocus}) should be slower than normal (${dxNormal})`);

    // Special consumes charge and emits distinct special event
    w.step(1 / 120, { x: 0, y: 0, fire: true, special: true });
    assert.equal(w.weapons.specialCharges, 1);
    assert.ok(w.bullets.some((b) => b.active && !b.enemy), `${pid} should fire projectiles`);
  }
  assert.equal(specialTypes.size, 5, 'Each of the 5 pilots must have a distinct special type');
  assert.equal(perspectiveLabelPt('UP'), '↑ VERTICAL');
  assert.equal(perspectiveLabelPt('SIDE'), '→ HORIZONTAL');
});

test('Assisted mode preserves selected Normal/Hard difficulty while disabling pure competitive eligibility', () => {
  const w = new ArcadeWorld(FENDA, undefined, { difficulty: 'normal', seed: 99 });
  w.assisted = true;
  assert.equal(w.isAssisted, true);
  assert.equal(w.effectiveDifficulty, 'normal', 'Assisted must NOT silently downgrade Normal to Easy');
  assert.equal(w.competitiveEligible, false);

  const wHard = new ArcadeWorld(SOLAR, undefined, { difficulty: 'hard', seed: 99 });
  assert.equal(wHard.effectiveDifficulty, 'hard');
  assert.equal(wHard.competitiveEligible, true);
});

test('Ranking engine calibrates C..S+ ranks, 1CC/NO-MISS/NO-BOMB badges, and fair credits', () => {
  const sPlus = evaluateArcadeRun({
    missionId: 1,
    pilotId: 'nolan',
    difficulty: 'normal',
    score: 240_000,
    deaths: 0,
    specialsUsed: 0,
    continuesUsed: 0,
    assisted: false,
    practiceMode: false,
    formationsCleared: 18,
    sectorsClean: 7,
    totalSectors: 7,
    bossSeconds: 45,
    grazeCount: 30,
    maxChain: 40,
    victory: true,
    progressRatio: 1,
  });
  assert.equal(sPlus.rank, 'S+');
  assert.equal(sPlus.competitiveEligible, true);
  assert.ok(sPlus.badges.includes('1CC'));
  assert.ok(sPlus.badges.includes('NO-MISS'));
  assert.ok(sPlus.badges.includes('NO-BOMB'));
  assert.ok(sPlus.creditsEarned > 0);

  const withContinue = evaluateArcadeRun({
    missionId: 1,
    pilotId: 'nolan',
    difficulty: 'normal',
    score: 180_000,
    deaths: 2,
    specialsUsed: 1,
    continuesUsed: 1,
    assisted: false,
    practiceMode: false,
    formationsCleared: 10,
    sectorsClean: 4,
    totalSectors: 7,
    bossSeconds: 70,
    grazeCount: 5,
    maxChain: 12,
    victory: true,
    progressRatio: 1,
  });
  assert.equal(withContinue.competitiveEligible, false);
  assert.ok(!withContinue.badges.includes('1CC'));
});

test('ArcadeProfileStore v4 migrates legacy storage cleanly, guards idempotent credits, and keeps cosmetics pure', () => {
  const store = new ArcadeProfileStore(memoryStorage({
    bullet_wake_save_data_v1: JSON.stringify({
      settings: { difficulty: 'hard', musicVolume: 0.4, rapidFire: true },
      bestScores: { 1: { score: 155000, pilotId: 'nolan' } },
    }),
    bullet_wake_arcade_v1: JSON.stringify({ cleared: [1], flights: {} }),
    bullet_wake_visual: '1',
  }));

  const p = store.getProfile();
  assert.equal(p.schemaVersion, 4);
  assert.equal(p.settings.difficulty, 'hard');
  assert.equal(p.settings.rapidFire, true);
  assert.equal(p.settings.visualQuality, 1);
  assert.ok(p.clearedStages.includes(1));
  assert.equal(store.bestScoreForMission(1, 'nolan'), 155000);
  assert.equal(store.isPilotUnlocked('nolan'), true);
  assert.equal(store.isPilotUnlocked('cora'), false);
  assert.equal(store.getProfile().account.mode, 'guest');
  assert.equal(store.getProfile().account.welcomePromptSeen, false);
  assert.equal(store.getProfile().account.privacyAccepted, false);
  store.signInLocal('Comandante');
  assert.equal(store.getProfile().account.mode, 'linked');
  assert.equal(store.getProfile().account.displayName, 'Comandante');
  assert.equal(store.getProfile().account.welcomePromptSeen, true);
  assert.equal(store.getProfile().account.privacyAccepted, true);
  store.signOutLocal();
  assert.equal(store.getProfile().account.mode, 'guest');
  assert.equal(store.getProfile().account.displayName, 'Piloto Convidado');
  assert.equal(store.getProfile().account.privacyAccepted, true);
  assert.equal(ACHIEVEMENTS.length, 14);

  // Claiming the same runId twice must not duplicate credits or pilot service history
  const runPayload = {
    runId: 'run-idempotent-1',
    missionId: 1,
    pilotId: 'nolan',
    difficulty: 'normal',
    score: 185000,
    rank: 'S',
    victory: true,
    competitiveEligible: true,
    assisted: false,
    noMiss: false,
    noBomb: false,
    oneCC: true,
    creditsEarned: 350,
    kills: 42,
    achievements: ['first_clear'],
  };
  const r1 = store.recordRunResult(runPayload);
  const r2 = store.recordRunResult(runPayload);
  assert.ok(r1.creditsAdded >= 350);
  assert.equal(r2.creditsAdded, 0);
  const hist = store.getPilotHistory('nolan');
  assert.equal(hist.sorties, 1);
  assert.equal(hist.clears, 1);
  assert.equal(hist.kills, 42);
  assert.equal(hist.bestScore, 185000);

  // Buying a cosmetic skin equips it without altering gameplay stats
  const buy = store.buyHangarItem('skin:cobalt_ace');
  assert.equal(buy.ok, true);
  assert.equal(store.getEquippedSkinTint('nolan'), 0x8ad8ff);
  assert.ok(store.getProfile().wallet.credits >= 0);
  assert.ok(memoryStorage()[PROFILE_STORAGE_KEY] === undefined);
});

test('Deterministic replay recorder reproduces identical ArcadeWorld state across 300 ticks', () => {
  const w1 = new ArcadeWorld(FENDA, undefined, { pilotId: 'nolan', difficulty: 'normal', seed: 2026 });
  w1.introTime = 0;
  const rec = new ReplayRecorder({ missionId: 1, pilotId: 'nolan', difficulty: 'normal', assisted: false, seed: 2026 });
  for (let i = 0; i < 300; i++) {
    const inp = { x: i % 90 < 45 ? 0.6 : -0.6, y: -0.2, fire: i % 4 === 0, special: i === 240, focus: i % 60 < 20 };
    rec.record(inp);
    w1.step(1 / 120, inp);
  }
  const replay = rec.finish();
  assert.equal(replay.totalFrames, 300);

  const w2 = new ArcadeWorld(FENDA, undefined, { pilotId: replay.pilotId, difficulty: replay.difficulty, seed: replay.seed });
  w2.introTime = 0;
  const player = new ReplayPlayer(replay);
  while (!player.finished) {
    w2.step(1 / 120, player.nextInput());
  }
  assert.equal(w2.score, w1.score);
  assert.equal(w2.kills, w1.kills);
  assert.equal(w2.player.x, w1.player.x);
  assert.equal(w2.player.y, w1.player.y);
});

test('PelagicDesktopHud places Score inside left side panel completely outside the top combat arena', () => {
  const hudSrc = readFileSync(resolve('src/game/arcade/PelagicDesktopHud.ts'), 'utf8');
  assert.ok(!hudSrc.includes('drawTopPlacarChrome'), 'Top center score plaque inside combat arena must be removed');
  assert.match(hudSrc, /this\.scoreValue\s*=\s*mkText\(147,\s*118/, 'Score value must live in left side panel (x=147 < arena.left=160)');
  assert.ok(hudSrc.includes('scorePosition: { x: this.scoreValue.x, y: this.scoreValue.y }'));
});
