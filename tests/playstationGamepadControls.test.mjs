import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';
import { TouchInputController, defaultTouchSettings } from '../src/game/arcade/TouchControls.ts';
import { processInputFrame } from '../src/game/systems/inputSystem.ts';
import {
  GamepadReader,
  STANDARD_GAMEPAD_BUTTON,
  TRIGGER_PRESS_THRESHOLD,
  padLabels,
} from '../src/game/systems/gamepadInput.ts';

function makePad(id = 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)') {
  return {
    id,
    mapping: 'standard',
    axes: [0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}

function liveWorld(missionIndex = 1, accessibility = false) {
  const w = new ArcadeWorld(MISSIONS[missionIndex]);
  w.state = 'play';
  w.accessibility = accessibility;
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.player.invulnerable = 0;
  return w;
}

test('1 & 2. Círculo (1) e R1 (5) disparam continuamente com cadência idêntica no armamento', () => {
  for (const btn of [STANDARD_GAMEPAD_BUTTON.CIRCLE, STANDARD_GAMEPAD_BUTTON.R1]) {
    const reader = new GamepadReader();
    const pad = makePad();
    const world = liveWorld(1); // Cidade Solar / continuous hold cadence
    let shots = 0;

    pad.buttons[btn] = { pressed: true, value: 1 };
    for (let i = 0; i < 90; i++) {
      const gp = reader.sample(pad);
      assert.equal(gp.firePrimary, true, `Button ${btn} must stay firing while held`);
      assert.equal(gp.firePrimaryTap, i === 0);
      world.step(1 / 60, { x: gp.moveX, y: gp.moveY, fire: gp.firePrimary, special: gp.special });
      shots += world.events.filter((e) => e.type === 'shot').length;
      world.events.length = 0;
    }
    assert.ok(shots >= 6, `Held button ${btn} must emit continuous weapon cadence (got ${shots})`);
  }
});

test('3. Círculo + R1 simultâneos não duplicam cadência nem disparam rajada dupla', () => {
  const readerOnlyCircle = new GamepadReader();
  const readerBoth = new GamepadReader();
  const padCircle = makePad();
  const padBoth = makePad();
  const worldCircle = liveWorld(0, true); // Fenda Pelágica + accessibility continuous hold
  const worldBoth = liveWorld(0, true);

  padCircle.buttons[STANDARD_GAMEPAD_BUTTON.CIRCLE] = { pressed: true, value: 1 };
  padBoth.buttons[STANDARD_GAMEPAD_BUTTON.CIRCLE] = { pressed: true, value: 1 };
  padBoth.buttons[STANDARD_GAMEPAD_BUTTON.R1] = { pressed: true, value: 1 };

  let shotsCircle = 0;
  let shotsBoth = 0;
  for (let i = 0; i < 120; i++) {
    const g1 = readerOnlyCircle.sample(padCircle);
    const g2 = readerBoth.sample(padBoth);
    assert.equal(g2.firePrimaryTap, i === 0);
    worldCircle.step(1 / 60, { x: 0, y: 0, fire: g1.firePrimary, special: false });
    worldBoth.step(1 / 60, { x: 0, y: 0, fire: g2.firePrimary, special: false });
    shotsCircle += worldCircle.events.filter((e) => e.type === 'shot').length;
    shotsBoth += worldBoth.events.filter((e) => e.type === 'shot').length;
    worldCircle.events.length = 0;
    worldBoth.events.length = 0;
  }
  assert.equal(shotsBoth, shotsCircle, 'Holding ○ + R1 together must match single-button fire rate');
});

test('4, 5, 6 & 7. Quadrado (2) e R2 (7) acionam o mesmo especial sem consumo múltiplo ou duplicação', () => {
  // 4 & 5: □ activates special, R2 above analog threshold activates same special
  const readerA = new GamepadReader();
  const padA = makePad();
  padA.buttons[STANDARD_GAMEPAD_BUTTON.SPECIAL_FACE] = { pressed: true, value: 1 };
  assert.equal(readerA.sample(padA).special, true);

  const readerB = new GamepadReader();
  const padB = makePad();
  // Below threshold does NOT misfire
  padB.buttons[STANDARD_GAMEPAD_BUTTON.R2] = { pressed: false, value: TRIGGER_PRESS_THRESHOLD - 0.1 };
  assert.equal(readerB.sample(padB).special, false);
  // Pulling R2 past threshold triggers 1 special
  padB.buttons[STANDARD_GAMEPAD_BUTTON.R2] = { pressed: false, value: TRIGGER_PRESS_THRESHOLD + 0.1 };
  assert.equal(readerB.sample(padB).special, true);

  // 6: Holding R2 across many frames never consumes multiple charges in ArcadeWorld
  const world = liveWorld(0);
  assert.equal(world.weapons.specialCharges, 2);
  const holdReader = new GamepadReader();
  const holdPad = makePad();
  holdPad.buttons[STANDARD_GAMEPAD_BUTTON.R2] = { pressed: true, value: 0.95 };
  for (let i = 0; i < 240; i++) {
    const gp = holdReader.sample(holdPad);
    assert.equal(gp.special, i === 0);
    world.step(1 / 60, { x: 0, y: 0, fire: false, special: gp.special });
  }
  assert.equal(world.weapons.specialCharges, 1, 'Holding R2 continuously must spend at most 1 charge');

  // 7: Simultaneous □ + R2 triggers only 1 special, and cannot retrigger until BOTH are released
  const duoReader = new GamepadReader();
  const duoPad = makePad();
  duoPad.buttons[STANDARD_GAMEPAD_BUTTON.SPECIAL_FACE] = { pressed: true, value: 1 };
  duoPad.buttons[STANDARD_GAMEPAD_BUTTON.R2] = { pressed: true, value: 1 };
  assert.equal(duoReader.sample(duoPad).special, true);
  // Release □ only while keeping R2 held -> re-pressing □ while R2 is still held must NOT fire a 2nd special
  duoPad.buttons[STANDARD_GAMEPAD_BUTTON.SPECIAL_FACE] = { pressed: false, value: 0 };
  assert.equal(duoReader.sample(duoPad).special, false);
  duoPad.buttons[STANDARD_GAMEPAD_BUTTON.SPECIAL_FACE] = { pressed: true, value: 1 };
  assert.equal(duoReader.sample(duoPad).special, false);
  // Release BOTH -> then pressing R2 triggers normally
  duoPad.buttons[STANDARD_GAMEPAD_BUTTON.SPECIAL_FACE] = { pressed: false, value: 0 };
  duoPad.buttons[STANDARD_GAMEPAD_BUTTON.R2] = { pressed: false, value: 0 };
  assert.equal(duoReader.sample(duoPad).special, false);
  duoPad.buttons[STANDARD_GAMEPAD_BUTTON.R2] = { pressed: true, value: 0.9 };
  assert.equal(duoReader.sample(duoPad).special, true);
});

test('8 & 9. Xis (0) confirma em menus sem função em combate; Círculo (1) volta em menus e atira em combate', () => {
  const reader = new GamepadReader();
  const pad = makePad();

  // Xis pressed: menu confirm = true, combat fire/special = false
  pad.buttons[STANDARD_GAMEPAD_BUTTON.CONFIRM] = { pressed: true, value: 1 };
  const xState = reader.sample(pad);
  assert.equal(xState.confirm, true);
  assert.equal(xState.firePrimary, false);
  assert.equal(xState.special, false);
  assert.equal(xState.cancel, false);

  // Release Xis, press Círculo: menu cancel/back = true, combat fire = true
  pad.buttons[STANDARD_GAMEPAD_BUTTON.CONFIRM] = { pressed: false, value: 0 };
  pad.buttons[STANDARD_GAMEPAD_BUTTON.CIRCLE] = { pressed: true, value: 1 };
  const oState = reader.sample(pad);
  assert.equal(oState.cancel, true);
  assert.equal(oState.back, true);
  assert.equal(oState.confirm, false);
  assert.equal(oState.firePrimary, true);
});

test('10 & 11. Start/Options (9) pausa/retoma normalmente e bloqueia disparo/especial enquanto pausado', () => {
  const reader = new GamepadReader();
  const pad = makePad();
  pad.buttons[STANDARD_GAMEPAD_BUTTON.PAUSE] = { pressed: true, value: 1 };
  const p1 = reader.sample(pad);
  assert.equal(p1.pause, true);
  assert.equal(p1.menuOrBack, true);
  assert.equal(reader.sample(pad).pause, false);

  // Verify ArcadeScene pause & unpause safety guards stay wired cleanly
  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  assert.ok(sceneSrc.includes("this.screen === 'pause' && (pausePressed || backPressed)"), 'Start/Options or ○ resumes pause');
  assert.ok(sceneSrc.includes("else if (escPressed || gp.pause) this.show('pause')"), 'Start/Options pauses gameplay');
  assert.ok(sceneSrc.includes("if (this.world && this.screen === 'play' && !resumedFromMenu)"), 'Gameplay world never steps while paused or on resume frame');
  assert.ok(sceneSrc.includes('suppressHeldFireUntilRelease'), 'Fire remains suppressed across pause resume until released');
  assert.ok(sceneSrc.includes('suppressSpecialUntilRelease'), 'Special remains suppressed across pause resume until released');
  assert.ok(!sceneSrc.includes('if (just(\'ENTER\') || gp.confirm) this.world.introTime = 0'), '× must have zero function during gameplay');
});

test('12. Movimentação simultânea com disparo (Analógico esquerdo e D-Pad + ○/R1)', () => {
  const reader = new GamepadReader();
  const pad = makePad();
  pad.axes = [0.9, -0.9];
  pad.buttons[STANDARD_GAMEPAD_BUTTON.R1] = { pressed: true, value: 1 };
  const gp = reader.sample(pad);
  assert.ok(gp.moveX > 0.5 && gp.moveY < -0.5);
  assert.ok(Math.hypot(gp.moveX, gp.moveY) <= 1.0001);
  assert.equal(gp.firePrimary, true);

  const world = liveWorld(0);
  const x0 = world.player.x;
  const y0 = world.player.y;
  world.step(1 / 60, { x: gp.moveX, y: gp.moveY, fire: gp.firePrimary, special: false });
  assert.ok(world.player.x > x0, 'Ship moves right while firing');
  assert.ok(world.player.y < y0, 'Ship moves up while firing');
  assert.ok(world.events.some((e) => e.type === 'shot'), 'Shot fires while moving');
});

test('13. Teclado e Mobile (TouchInputController) permanecem intactos', () => {
  const kb = processInputFrame({
    keyW: true, keyA: false, keyS: false, keyD: true,
    arrowUp: false, arrowDown: false, arrowLeft: false, arrowRight: false,
    keySpace: true, keySpaceJustDown: true,
    keyShift: false, keyShiftJustDown: false,
    keyC: false, keyCJustDown: false, keyCJustUp: false,
    keyX: false, keyXJustDown: true,
    keyV: false, keyVJustDown: false,
    keyM: false, keyMJustDown: false,
    keyB: false, keyBJustDown: false,
    keyR: false, keyRJustDown: false,
    keyEsc: false, keyEscJustDown: false,
    isTouch: false, touchPointerDown: false, touchX: 0, touchY: 0, shipX: 384, shipY: 360,
  });
  assert.ok(kb.moveX > 0.6 && kb.moveY < -0.6);
  assert.equal(kb.firePrimary, true);
  assert.equal(kb.special, true);

  const touch = new TouchInputController(defaultTouchSettings());
  const l = touch.getLayout();
  assert.equal(touch.onPointerDown(1, l.joystick.x, l.joystick.y), 'move');
  touch.onPointerMove(1, l.joystick.x + 20, l.joystick.y);
  assert.equal(touch.onPointerDown(2, l.fire.x, l.fire.y), 'fire');
  const cmd = touch.consumeStep();
  assert.equal(cmd.fire, true);
  assert.ok(cmd.x > 0.5);
});

test('14. Perfis visuais (PlayStation vs Xbox) e tela CONTROLES refletem mapeamento sem misturar plataformas', () => {
  const ps = padLabels('PS5 DualSense 054c');
  assert.equal(ps.profile, 'playstation');
  assert.equal(ps.shoot, '○ / R1');
  assert.equal(ps.special, '□ / R2');
  assert.equal(ps.confirm, '×');
  assert.equal(ps.cancel, '○');
  assert.equal(ps.pause, 'OPTIONS');

  const xb = padLabels('Xbox Series XInput 045e');
  assert.equal(xb.profile, 'xbox');
  assert.equal(xb.shoot, 'B / RB');
  assert.equal(xb.special, 'X / RT');
  assert.equal(xb.confirm, 'A');
  assert.equal(xb.cancel, 'B');
  assert.equal(xb.pause, 'START');

  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  assert.ok(sceneSrc.includes('PS5 DUALSENSE'));
  assert.ok(sceneSrc.includes('COMANDOS PLAYSTATION'));
  assert.ok(sceneSrc.includes('ATIRAR (disparo contínuo)'));
  assert.ok(sceneSrc.includes('ESPECIAL (Tormenta)'));
  assert.ok(sceneSrc.includes('CONFIRMAR (menus)'));
  assert.ok(sceneSrc.includes('VOLTAR (menus)'));
  assert.ok(sceneSrc.includes('PAUSAR / RETOMAR'));
});
