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

test('returning a wide mobile sortie to portrait keeps charge and joystick aligned with camera coordinates', () => {
  const controller = new TouchInputController();
  const scale = 735 / 384, offsetX = 16.5;
  controller.configure(defaultTouchSettings(), undefined, 826, true, { scale, offsetY: 0, offsetX });
  const layout = controller.getLayout();
  assert(layout.charge.x > offsetX + 735 / 2);
  assert(layout.charge.x + layout.charge.radius < offsetX + 735);
  assert.equal(controller.onPointerDown(1, layout.charge.x, layout.charge.y), 'charge');
  assert.equal(controller.onPointerDown(2, layout.joystick.x, layout.joystick.y), 'move');
  controller.onPointerMove(2, layout.joystick.x + scale * 25, layout.joystick.y);
  assert(controller.peek().x > 0);
  assert(controller.peek().charge);
});

test('mobile movement starts neutral exactly under the finger in either half at any camera scale', () => {
  for (const handedness of ['left', 'right']) {
    for (const scale of [336 / 384, 1, 2]) {
      const c = new TouchInputController();
      c.configure({ ...defaultTouchSettings(), handedness }, undefined, 826, true, { scale, offsetY: 12, offsetX: 16 });
      for (const [px, py] of [[20, 150], [160, 650], [280, 450], [370, 250], [192, 790]]) {
        const x = px * scale + 16, y = py * scale + 12;
        assert.equal(c.onPointerDown(1, x, y), 'move');
        const o = c.peek();
        assert.equal(o.x, 0, 'touchdown must never move the ship');
        assert.equal(o.y, 0, 'portrait input must not clamp to the 432-high PC arena');
        assert.equal(o.stickOriginX, x);
        assert.equal(o.stickOriginY, y);
        c.onPointerUp(1);
      }
    }
  }
});

test('free movement preserves shallow angles, follows long drags and stops on release', () => {
  for (const scale of [336 / 384, 1, 2]) {
    const c = new TouchInputController();
    c.configure(defaultTouchSettings(), undefined, 826, true, { scale, offsetY: 0 });
    c.onPointerDown(1, 100 * scale, 500 * scale);
    c.onPointerMove(1, 120 * scale, 501 * scale);
    let o = c.peek();
    assert(o.x > .6 && o.x < .8);
    assert(o.y > 0, 'shallow angle must not snap to horizontal');
    assert(Math.abs(o.y / o.x - .05) < 1e-9);
    c.onPointerMove(1, 300 * scale, 501 * scale);
    o = c.peek();
    assert(Math.hypot(o.x, o.y) <= 1 + 1e-9);
    assert(o.stickOriginX > 260 * scale, 'origin follows the finger outside the travel radius');
    c.onPointerMove(1, 260 * scale, 501 * scale);
    assert(c.peek().x < 0, 'reverse does not require returning to the initial anchor');
    c.onPointerUp(1);
    assert.equal(c.peek().x, 0);
    assert.equal(c.peek().y, 0);
    assert.equal(c.peek().stickActive, false);
  }
});

test('free drags cross action buttons without firing them and retain independent multitouch ownership', () => {
  const c = new TouchInputController();
  c.configure(defaultTouchSettings(), undefined, 826, true);
  const l = c.getLayout();
  c.onPointerDown(1, 280, 300);
  c.onPointerMove(1, l.special.x, l.special.y);
  assert.equal(c.peek().special, false);
  c.onPointerMove(1, l.charge.x, l.charge.y);
  assert.equal(c.peek().charge, false);
  assert.equal(c.onPointerDown(2, l.charge.x, l.charge.y), 'charge');
  assert.equal(c.onPointerDown(3, 100, 200), 'none');
  c.onPointerMove(3, 10, 100);
  c.onPointerUp(3);
  assert(c.peek().stickActive && c.peek().charge);
  c.onPointerUp(1);
  assert.equal(c.onPointerDown(4, l.charge.x, l.charge.y), 'none', 'occupied action cannot become movement');
  assert.equal(c.peek().stickActive, false);
  c.clearAll();
  assert.equal(c.peek().charge, false);
  assert.equal(c.peek().special, false);
  assert.equal(c.peek().x, 0);
});
