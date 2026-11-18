import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';
import {
  CHARGED_SHOT_CONFIG,
  ChargedShotController,
  buildChargedReleaseSpec,
} from '../src/game/arcade/ChargedShotSystem.ts';
import { TouchInputController, defaultTouchSettings } from '../src/game/arcade/TouchControls.ts';
import { GamepadReader, STANDARD_GAMEPAD_BUTTON } from '../src/game/systems/gamepadInput.ts';

function liveWorld(missionIndex = 0, level = 1, accessibility = false) {
  const w = new ArcadeWorld(MISSIONS[missionIndex]);
  w.state = 'play';
  w.weapons.weaponLevel = level;
  w.accessibility = accessibility;
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.player.invulnerable = 0;
  return w;
}

test('3, 4, 5, 6, 7 & 8. Ciclo de carga por tempo real: <0.35s cancela, 0.35-1.19s parcial, >=1.2s trava em 100%', () => {
  // Real-time accumulation across 30/60/120 FPS reaches same ratio
  for (const fps of [30, 60, 120]) {
    const c = new ChargedShotController();
    const dt = 1 / fps;
    const totalTicks = Math.round(0.6 * fps);
    for (let i = 0; i < totalTicks; i++) c.step(dt, true, 1);
    assert.ok(Math.abs(c.ratio - 0.5) < 0.03, `At ${fps} FPS after 0.6s expected ~50%, got ${c.ratio}`);
  }

  // < 0.35s release produces NO charged shot
  const ctrl = new ChargedShotController();
  ctrl.step(0.2, true, 1);
  assert.equal(ctrl.tier, 'none');
  const early = ctrl.step(0.016, false, 1);
  assert.equal(early.cancelledEarly, true);
  assert.equal(early.released, null);
  assert.equal(ctrl.snapshot().percent, 0);

  // 0.35..1.19s release fires partial attack
  ctrl.step(0.55, true, 1);
  assert.equal(ctrl.tier, 'partial');
  const partialRes = ctrl.step(0.016, false, 1);
  assert.ok(partialRes.released);
  assert.equal(partialRes.released.tier, 'partial');
  assert.equal(ctrl.snapshot().percent, 0);
  assert.equal(ctrl.inRecovery, true);

  // Clear recovery and hold >= 1.2s: reaches 100%, stays capped, emits justReachedFull once
  for (let i = 0; i < 20; i++) ctrl.step(0.02, false, 1);
  assert.equal(ctrl.inRecovery, false);

  let fullEvents = 0;
  for (let i = 0; i < 180; i++) {
    const s = ctrl.step(1 / 60, true, 1);
    if (s.justReachedFull) fullEvents++;
  }
  assert.equal(fullEvents, 1, 'Holding well past 1.2s must emit justReachedFull only once');
  assert.equal(ctrl.ratio, 1, 'Charge must cap cleanly at 100%');
  assert.equal(ctrl.snapshot().percent, 100);
  const fullRes = ctrl.step(1 / 60, false, 1);
  assert.ok(fullRes.released);
  assert.equal(fullRes.released.tier, 'full');
  assert.ok(fullRes.released.damage > partialRes.released.damage);
});

test('1, 2, 9 & 10. Carregamento suspende tiro automático em ○/R1 e respeita recuperação antes de retomar', () => {
  const reader = new GamepadReader();
  const pad = {
    id: 'DualSense 054c',
    mapping: 'standard',
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const world = liveWorld(1, 2); // Cidade Solar continuous auto-fire

  // Hold ○ (auto-fire): emits primary shots
  pad.buttons[STANDARD_GAMEPAD_BUTTON.CIRCLE] = { pressed: true, value: 1 };
  let autoShotsBefore = 0;
  for (let i = 0; i < 30; i++) {
    const gp = reader.sample(pad);
    world.step(1 / 60, { x: 0, y: 0, fire: gp.firePrimary, special: gp.special, charge: gp.chargeHeld });
    autoShotsBefore += world.events.filter((e) => e.type === 'shot').length;
    world.events.length = 0;
  }
  assert.ok(autoShotsBefore >= 2);

  // Start holding □ while STILL holding ○: auto-fire must be suspended cleanly!
  pad.buttons[STANDARD_GAMEPAD_BUTTON.CHARGE] = { pressed: true, value: 1 };
  let autoShotsWhileCharging = 0;
  for (let i = 0; i < 80; i++) {
    const gp = reader.sample(pad);
    world.step(1 / 60, { x: 0, y: 0, fire: gp.firePrimary, special: false, charge: gp.chargeHeld });
    autoShotsWhileCharging += world.events.filter((e) => e.type === 'shot').length;
    world.events.length = 0;
  }
  assert.equal(autoShotsWhileCharging, 0, 'Auto-fire must suspend while holding □');
  assert.equal(world.chargedShot.snapshot().isFull, true);

  // Release □ while keeping ○ held -> charged shot fires ONCE, recovery suspends auto-fire for 0.25s, then resumes
  pad.buttons[STANDARD_GAMEPAD_BUTTON.CHARGE] = { pressed: false, value: 0 };
  let chargedEvents = 0;
  let shotsDuringRecovery = 0;
  let shotsAfterRecovery = 0;
  const recFrames = Math.floor(CHARGED_SHOT_CONFIG.recoverySeconds * 60);

  for (let i = 0; i < recFrames + 35; i++) {
    const gp = reader.sample(pad);
    world.step(1 / 60, { x: 0, y: 0, fire: gp.firePrimary, special: false, charge: gp.chargeHeld });
    chargedEvents += world.events.filter((e) => e.type === 'charged-shot').length;
    const sCount = world.events.filter((e) => e.type === 'shot').length;
    if (i < recFrames) shotsDuringRecovery += sCount;
    else shotsAfterRecovery += sCount;
    world.events.length = 0;
  }
  assert.equal(chargedEvents, 1, 'Exactly one charged shot released');
  assert.equal(shotsDuringRecovery, 0, 'Auto-fire stays paused during recovery window');
  assert.ok(shotsAfterRecovery >= 1, 'Auto-fire resumes seamlessly after recovery if ○/R1 stays held');
});

test('11. Evolução com POWER (1..5) escala dano/tamanho/perfuração sem alterar o teto de POWER ou tiros normais', () => {
  const specs = [1, 2, 3, 4, 5].map((lv) => buildChargedReleaseSpec('full', 1, lv));
  for (let i = 1; i < specs.length; i++) {
    assert.ok(specs[i].damage > specs[i - 1].damage, `POWER ${i + 1} charged damage must exceed POWER ${i}`);
    assert.ok(specs[i].radius > specs[i - 1].radius, `POWER ${i + 1} charged radius must grow smoothly`);
  }
  assert.equal(specs[0].pierceCount, 1);
  assert.ok(specs[2].pierceCount >= 3, 'POWER 3+ charged shot must pierce multiple enemies');

  // At POWER 3+, one full charged bolt pierces 2 fighters cleanly without hitting same enemy twice
  const world = liveWorld(0, 3);
  const e1 = world.devSpawnEncounter({ family: 'fighter', formation: 'solo', motion: 'stationary', lane: 0.5 }, { x: world.arenaCenterX, y: 210 })[0];
  const e2 = world.devSpawnEncounter({ family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: 0.5 }, { x: world.arenaCenterX, y: 120, keepExisting: true })[0];
  e1.maxHp = 2; e1.hp = 2;
  e2.maxHp = 40; e2.hp = 40;
  world.chargedShot.step(CHARGED_SHOT_CONFIG.maxChargeSeconds, true, 3);
  world.step(1 / 60, { x: 0, y: 0, fire: false, special: false, charge: false });
  for (let i = 0; i < 45; i++) world.step(1 / 60, { x: 0, y: 0, fire: false, special: false, charge: false });
  assert.equal(e1.hp, 0, 'Front fighter eliminated');
  assert.ok(e2.hp < 40 && e2.hp >= 40 - specs[2].damage, `Pierced warhawk takes single-hit charged damage (${40 - e2.hp})`);
});

test('12, 13 & 14. Tiro carregado não gasta especiais, ×/R2 acionam especial e mísseis seguem normais', () => {
  const world = liveWorld(0, 4);
  assert.equal(world.weapons.specialCharges, 2);

  // Fire full charged shot -> special charges untouched
  world.chargedShot.step(CHARGED_SHOT_CONFIG.maxChargeSeconds, true, 4);
  world.step(1 / 60, { x: 0, y: 0, fire: false, special: false, charge: false });
  assert.equal(world.weapons.specialCharges, 2, 'Charged shot must NOT spend special charges');

  // Auto-fire missiles at POWER 4 still emit without ammo caps
  for (let i = 0; i < 20; i++) world.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  world.step(1 / 60, { x: 0, y: 0, fire: true, special: false });
  assert.ok(world.events.some((e) => e.type === 'missile'), 'Existing missiles continue operating normally');

  // Special via ×/R2 still works cleanly
  world.step(1 / 60, { x: 0, y: 0, fire: false, special: true });
  assert.equal(world.weapons.specialCharges, 1);
});

test('15, 16 & 17. Pausa congela carga, morte e reset/troca de fase cancelam carregamento', () => {
  // Death cancels charging immediately
  const wDeath = liveWorld(0, 2);
  wDeath.step(0.6, { x: 0, y: 0, fire: false, special: false, charge: true });
  assert.ok(wDeath.chargedShot.snapshot().percent > 0);
  // Spawn an active enemy bullet hitting player
  wDeath.step(1 / 60, { x: 0, y: 0, fire: false, special: false, charge: true });
  const eb = wDeath.bullets.find((b) => !b.active);
  assert.ok(eb);
  Object.assign(eb, { active: true, x: wDeath.player.x, y: wDeath.player.y, px: wDeath.player.x, py: wDeath.player.y, vx: 0, vy: 0, damage: 1, radius: 8, enemy: true, missile: false, homing: false, age: 0, scale: 1, color: 0 });
  wDeath.step(1 / 60, { x: 0, y: 0, fire: false, special: false, charge: true });
  assert.equal(wDeath.chargedShot.snapshot().percent, 0, 'Player death must cancel active charge');

  // Clearing arena / stage reset cancels charge cleanly
  const wReset = liveWorld(1, 3);
  wReset.step(0.8, { x: 0, y: 0, fire: false, special: false, charge: true });
  assert.ok(wReset.chargedShot.ratio > 0);
  wReset.clearArenaEntities();
  assert.equal(wReset.chargedShot.ratio, 0, 'clearArenaEntities / stage change must cancel charge');

  // ArcadeScene pause freezes charge and suppresses release across unpause
  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  assert.ok(sceneSrc.includes("if (this.world && this.screen === 'play' && !resumedFromMenu)"), 'World frozen while paused');
  assert.ok(sceneSrc.includes('suppressChargeUntilRelease'), 'Held charge button across unpause cannot accidentally fire');
});

test('18 & 19. Mobile touch CARGA e dano real contra Boss Colosso Abissal sem dano duplo indevido', () => {
  const touch = new TouchInputController(defaultTouchSettings());
  const l = touch.getLayout();
  assert.ok(l.charge, 'Touch layout provides dedicated CARGA button when space permits');
  assert.equal(touch.onPointerDown(3, l.charge.x, l.charge.y), 'charge');
  assert.equal(touch.consumeStep().charge, true);
  touch.onPointerUp(3);
  assert.equal(touch.consumeStep().charge, false);

  // Colosso Abissal boss respects enter invulnerability and takes exact single charged shot damage during fight
  const wBoss = liveWorld(0, 5);
  wBoss.devInvincible = true;
  wBoss.route = 300;
  wBoss.miniStarted = true;
  wBoss.step(1 / 60, { x: 0, y: 0, fire: false, special: false, charge: false });
  const sub = wBoss.boss.sub;
  assert.equal(sub.phase, 'enter');
  const sec0 = sub.sections[0];
  const sectionHp = () => sec0.hullHp + sec0.parts.reduce((s, p) => s + p.hp, 0);
  const targetMod = sec0.parts.find((p) => p.hp > 0);
  assert.ok(targetMod);
  const hpEnter = sectionHp();
  wBoss.player.x = targetMod.x;
  wBoss.chargedShot.step(CHARGED_SHOT_CONFIG.maxChargeSeconds, true, 5);
  wBoss.step(1 / 60, { x: 0, y: 0, fire: false, special: false, charge: false });
  for (let i = 0; i < 20; i++) wBoss.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  assert.equal(sectionHp(), hpEnter, 'Enter phase must stay invulnerable to charged shot');

  for (let i = 0; i < 200 && sub.phase !== 'fight'; i++) wBoss.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  assert.equal(sub.phase, 'fight');
  // Clear recovery and wait for cooldown before firing full charged shot cleanly into sec0
  for (let i = 0; i < 30; i++) wBoss.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  const hpBefore = sectionHp();
  wBoss.player.x = targetMod.x;
  wBoss.chargedShot.step(CHARGED_SHOT_CONFIG.maxChargeSeconds, true, 5);
  wBoss.step(1 / 60, { x: 0, y: 0, fire: false, special: false, charge: false });
  for (let i = 0; i < 40; i++) wBoss.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  const hpDelta = hpBefore - sectionHp();
  const expectedDmg = buildChargedReleaseSpec('full', 1, 5).damage;
  assert.ok(Math.abs(hpDelta - expectedDmg) < 0.01, `Boss section received exact single charged damage (${hpDelta} vs ${expectedDmg})`);
});
