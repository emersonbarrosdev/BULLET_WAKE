import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchInputController, defaultTouchSettings } from '../src/game/arcade/TouchControls.ts';

test('Android actions reserve the primary position for charge while movement and special remain independent', () => {
  for (const handedness of ['left', 'right']) {
    const controller = new TouchInputController();
    controller.configure({ ...defaultTouchSettings(), handedness }, undefined, 826, true);
    const layout = controller.getLayout();
    assert(layout.automaticFire);
    assert(layout.charge);
    assert.equal(controller.onPointerDown(1, layout.charge.x, layout.charge.y), 'charge');
    assert.equal(controller.onPointerDown(2, layout.joystick.x, layout.joystick.y), 'move');
    controller.onPointerMove(2, layout.joystick.x + 20, layout.joystick.y - 20);
    assert.equal(controller.onPointerDown(3, layout.special.x, layout.special.y), 'special');
    const output = controller.consumeStep();
    assert(output.charge && output.special && output.x > 0 && output.y < 0);
    assert.equal(output.fire, false, 'no held primary-fire pointer is needed or latched');
    controller.onPointerUp(1);
    assert.equal(controller.peek().charge, false);
    assert(controller.peek().stickActive);
    controller.clearAll();
    assert.equal(controller.peek().stickActive, false);
  }
});

test('SIDE portrait controls preserve physical targets in the letterboxed battlefield camera', () => {
  const controller = new TouchInputController();
  controller.configure(defaultTouchSettings(), undefined, 826, true, { scale: 2, offsetY: 0 });
  const layout = controller.getLayout();
  assert.equal(controller.onPointerDown(1, layout.charge.x, layout.charge.y), 'charge');
  assert.equal(controller.onPointerDown(2, layout.special.x, layout.special.y), 'special');
  assert(layout.charge.radius >= 50);
  assert(layout.charge.y > 432, 'actions occupy the portrait space below the SIDE arena');
  assert.equal(controller.onPointerDown(3, layout.pause.x, layout.pause.y), 'pause');
  assert.equal(controller.peek().charge, false);
});
