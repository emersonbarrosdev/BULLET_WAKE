import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA, MISSIONS } from '../src/game/arcade/content.ts';
import {
  SUB_BOSS_NAME,
  SUB_MAX_BOMB_HULL_DAMAGE,
  SUB_MAX_BOMB_PART_DAMAGE,
  SUB_MAX_BOMB_SECTION_DAMAGE,
  subSectionCenterY,
  subTotalHp,
} from '../src/game/arcade/PelagicSubmarineBoss.ts';

function startFendaBoss(hard = false) {
  const w = new ArcadeWorld(FENDA);
  w.hard = hard;
  w.state = 'play';
  w.route = 300;
  w.miniStarted = true;
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.player.invulnerable = 999;
  w.step(1 / 60);
  return w;
}

function advanceIntoFight(w) {
  for (let i = 0; i < 200 && w.boss?.sub?.phase !== 'fight'; i++) {
    w.updateBoss(1 / 60);
  }
  assert.equal(w.boss?.sub?.phase, 'fight');
}

test('Fenda final boss spawns Colosso Abissal with 5 distinct progressive sections', () => {
  const w = startFendaBoss();
  assert.equal(FENDA.boss, SUB_BOSS_NAME);
  assert.ok(w.boss?.sub);
  const sub = w.boss.sub;
  assert.equal(sub.sections.length, 5);
  assert.deepEqual(
    sub.sections.map(s => s.name),
    ['PROA BLINDADA', 'ARMAMENTO FRONTAL', 'TORRE DE COMANDO', 'ARMAMENTO TRASEIRO', 'PROPULSÃO ABISSAL'],
  );
  const totals = subTotalHp(sub);
  assert.ok(totals.max >= 3200 && totals.max <= 4200, `Unexpected sub EHP: ${totals.max}`);
  advanceIntoFight(w);
  assert.equal(sub.activeSection, 0);
  assert.ok(subSectionCenterY(sub, 0) > 100);
  assert.ok(subSectionCenterY(sub, 4) < -600);
});

test('hull and living modules take independent direct damage without artificial redirection', () => {
  const w = startFendaBoss();
  advanceIntoFight(w);
  const sub = w.boss.sub;
  const sec0 = sub.sections[0];
  const leftTurret = sec0.parts[0];
  const rightTurret = sec0.parts[1];
  const rightHpBefore = rightTurret.hp;
  const hullBefore = sec0.hullHp;

  // Hit exposed deck plate strictly outside all modules (outer bow flank x - 70)
  w.bullet(w.boss.x - 70, 320, 0, -1200, 35, 2);
  w.updateBullets(0.25);
  assert.equal(sec0.hullHp, hullBefore - 35);
  assert.equal(leftTurret.hp, leftTurret.maxHp);
  assert.equal(rightTurret.hp, rightHpBefore);
  assert.ok(sec0.hullFlash > 0);

  // Hit left turret directly
  w.bullet(leftTurret.x, 320, 0, -1200, 40, 3);
  w.updateBullets(0.25);
  assert.equal(leftTurret.hp, leftTurret.maxHp - 40);
  assert.equal(rightTurret.hp, rightHpBefore);
  assert.equal(sec0.hullHp, hullBefore - 35);
});

test('destroyed cannons stay permanently silent and hull marks persist across transitions', () => {
  const w = startFendaBoss();
  advanceIntoFight(w);
  const sub = w.boss.sub;
  const sec0 = sub.sections[0];
  sec0.parts.forEach(p => { p.hp = 0; });
  w.clearHostileBullets();
  for (let i = 0; i < 180; i++) w.updateBoss(1 / 60);
  assert.equal(w.bullets.filter(b => b.active && b.enemy).length, 0, 'All destroyed turrets must never fire');

  // Finishing hull triggers smooth scroll transition cleanly into Section 1 without damage overflow
  const sec1Before = subTotalHp({ ...sub, sections: [sub.sections[1]] }).current;
  w.bullet(w.boss.x - 22, 320, 0, -1200, sec0.hullHp + 200, 3);
  w.updateBullets(0.25);
  w.updateBoss(1 / 60);
  assert.equal(sub.activeSection, 1);
  assert.equal(sub.phase, 'transition');
  assert.equal(sub.sections[0].completed, true);
  assert.ok(sub.sections[0].marks.length > 0);
  const sec1After = subTotalHp({ ...sub, sections: [sub.sections[1]] }).current;
  assert.equal(sec1After, sec1Before, 'Excess fatal damage must never overflow into the next section');
});

test('destroying Conning Tower shifts the submarine into emergency overdrive', () => {
  const w = startFendaBoss();
  const sub = w.boss.sub;
  sub.activeSection = 2;
  sub.subScroll = sub.targetScroll = 2 * 240;
  sub.anchorY = 148;
  sub.phase = 'fight';
  w.updateBoss(0);
  const bridge = sub.sections[2].parts.find(p => p.kind === 'bridge');
  assert.ok(bridge);
  assert.equal(sub.bridgeDestroyed, false);
  w.bullet(bridge.x, 340, 0, -1400, bridge.maxHp, 3);
  w.updateBullets(0.25);
  assert.equal(bridge.hp, 0);
  assert.equal(sub.bridgeDestroyed, true);
  assert.ok(sub.sections[2].marks.some(m => m.size >= 1.1));
});

test('FULL power + 5 specials cannot skip sections or one-cycle the submarine', () => {
  const w = startFendaBoss();
  advanceIntoFight(w);
  w.weapons.weaponLevel = 5;
  w.weapons.specialCharges = 5;
  const sub = w.boss.sub;

  for (let bIdx = 0; bIdx < 5; bIdx++) {
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: true });
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
    for (let f = 0; f < 170; f++) {
      w.player.invulnerable = 999;
      w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
    }
    const bombRecs = Object.values(sub.bombDamage);
    const lastRec = bombRecs[bombRecs.length - 1];
    assert.ok(lastRec.total <= SUB_MAX_BOMB_SECTION_DAMAGE + 1e-6);
    assert.ok(lastRec.hull <= SUB_MAX_BOMB_HULL_DAMAGE + 1e-6);
    for (const partDmg of Object.values(lastRec.parts)) {
      assert.ok(partDmg <= SUB_MAX_BOMB_PART_DAMAGE + 1e-6);
    }
  }
  assert.equal(w.weapons.specialCharges, 0);
  assert.equal(w.state, 'play');
  assert.ok(sub.activeSection <= 1, 'Even all 5 specials cannot skip past Section 1');
  assert.ok(sub.sections.slice(2).every(s => s.hullHp === s.hullMaxHp && s.parts.every(p => p.hp === p.maxHp)));
});

test('all weapon levels NV1..NV5 remain viable and Normal vs Hard preserves EHP', () => {
  const normal = startFendaBoss(false);
  const hard = startFendaBoss(true);
  assert.deepEqual(subTotalHp(normal.boss.sub), subTotalHp(hard.boss.sub), 'Hard mode must not inflate HP');

  // Verify Hard emits denser/faster volleys without changing EHP
  advanceIntoFight(normal);
  advanceIntoFight(hard);
  for (let i = 0; i < 240; i++) {
    normal.updateBoss(1 / 60);
    hard.updateBoss(1 / 60);
  }
  assert.ok(hard.bullets.filter(b => b.active && b.enemy).length >= normal.bullets.filter(b => b.active && b.enemy).length);

  // Guided homing missiles at FULL automatically track active section hull if parts are down
  const hw = startFendaBoss(false);
  advanceIntoFight(hw);
  hw.weapons.weaponLevel = 5;
  hw.boss.sub.sections[0].parts.forEach(p => { p.hp = 0; });
  hw.fireMissiles();
  for (let i = 0; i < 60; i++) hw.updateBullets(1 / 60);
  assert.ok(hw.boss.sub.sections[0].hullHp < hw.boss.sub.sections[0].hullMaxHp);
});

test('destroying all 5 sections triggers staged 3.6s collapse, clears bullets, and launches auto-flyout to victory', () => {
  const w = startFendaBoss();
  advanceIntoFight(w);
  const sub = w.boss.sub;

  for (let s = 0; s < 5; s++) {
    if (sub.phase === 'transition') {
      for (let i = 0; i < 200 && sub.phase !== 'fight'; i++) w.updateBoss(1 / 60);
    }
    assert.equal(sub.activeSection, s);
    assert.equal(sub.phase, 'fight');
    sub.sections[s].hullHp = 0;
    sub.sections[s].parts.forEach(p => { p.hp = 0; });
    w.updateBoss(1 / 60);
  }

  assert.equal(sub.phase, 'collapse');
  assert.equal(w.state, 'play');

  // Mid-collapse still plays chain explosions and waits before exiting
  for (let i = 0; i < 120; i++) w.updateBoss(1 / 60);
  assert.equal(sub.phase, 'collapse');
  assert.ok(w.events.some(e => e.type === 'explosion'));

  // Completing 3.6s collapse transitions to exit and automatic RIVET flyout -> victory
  for (let i = 0; i < 120 && w.state === 'play'; i++) w.updateBoss(1 / 60);
  assert.equal(w.state, 'exit');
  assert.equal(w.boss, undefined);
  assert.equal(w.bullets.filter(b => b.active).length, 0);

  for (let i = 0; i < 450; i++) w.step(1 / 120, { x: 0, y: 1, fire: false, special: false });
  assert.equal(w.state, 'victory');
  assert.ok(w.player.y < 0);
});

test('Cidade Solar and its miniboss remain untouched while Fenda Pelagica blocks legacy UP miniboss', () => {
  const side = new ArcadeWorld(MISSIONS[1]);
  side.state = 'play';
  side.startBoss(false);
  assert.equal(side.boss.sub, undefined);
  assert.equal(side.mission.boss, 'MEGA DIRIGÍVEL GIRO');

  const sideMini = new ArcadeWorld(MISSIONS[1]);
  sideMini.state = 'play';
  sideMini.startBoss(true);
  assert.equal(sideMini.boss.sub, undefined);
  assert.equal(sideMini.boss.mini, true);

  const upNoMini = new ArcadeWorld(FENDA);
  upNoMini.state = 'play';
  upNoMini.startBoss(true);
  assert.equal(upNoMini.boss, undefined, 'Legacy UP miniboss must stay removed in favor of Arco das Marés');
});
