import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CENTER_ARENA_LEFT,
    CENTER_ARENA_RIGHT,
    TouchInputController,
    WORLD_HEIGHT,
    WORLD_WIDTH,
    computeStickVector,
    computeTouchLayout,
    computeWorldSafeInsets,
    defaultTouchSettings,
    sanitizeTouchSettings,
} from '../src/game/arcade/TouchControls.ts';
import { SaveSystem, defaultSaveData } from '../src/game/systems/saveSystem.ts';

test('computeStickVector handles deadzone, 8-way precision, and smooth analog magnitude', () => {
    const travel = 30;
    // Deadzone (~14% of 30 = 4.2px) prevents resting thumb jitter
    assert.deepEqual(computeStickVector(2, -2, travel), { x: 0, y: 0, knobOffsetX: 0, knobOffsetY: 0 });

    // Partial tilt scales analog speed smoothly (~50% deflection)
    const halfRight = computeStickVector(17, 0, travel);
    assert.ok(halfRight.x > 0.45 && halfRight.x < 0.6);
    assert.equal(Math.abs(halfRight.y) < 1e-6, true);

    // Exact 8-way sectors at full deflection
    const dirs = [
        [30, 0, 1, 0],
        [-30, 0, -1, 0],
        [0, -30, 0, -1],
        [0, 30, 0, 1],
        [30, -30, Math.SQRT1_2, -Math.SQRT1_2],
        [-30, -30, -Math.SQRT1_2, -Math.SQRT1_2],
        [30, 30, Math.SQRT1_2, Math.SQRT1_2],
        [-30, 30, -Math.SQRT1_2, Math.SQRT1_2],
    ];
    for (const [dx, dy, ex, ey] of dirs) {
        const v = computeStickVector(dx, dy, travel);
        assert.ok(Math.abs(v.x - ex) < 0.01, `x mismatch for (${dx},${dy}): ${v.x} vs ${ex}`);
        assert.ok(Math.abs(v.y - ey) < 0.01, `y mismatch for (${dx},${dy}): ${v.y} vs ${ey}`);
    }
});

test('computeTouchLayout respects right/left handedness, presets, cutouts, and never overlaps center arena', () => {
    const sizes = ['compact', 'standard', 'large'];
    const positions = ['corner', 'raised', 'wide'];
    const hands = ['right', 'left'];
    const cutoutInsets = { top: 24, right: 38, bottom: 26, left: 38 };

    for (const handedness of hands) {
        for (const size of sizes) {
            for (const position of positions) {
                const layout = computeTouchLayout({ ...defaultTouchSettings(), handedness, size, position }, cutoutInsets);
                for (const pad of [layout.joystick, layout.fire, layout.special]) {
                    assert.ok(pad.x - pad.radius >= cutoutInsets.left - 0.1, 'Left edge must clear cutout');
                    assert.ok(pad.x + pad.radius <= WORLD_WIDTH - cutoutInsets.right + 0.1, 'Right edge must clear cutout');
                    assert.ok(pad.y + pad.radius <= WORLD_HEIGHT - cutoutInsets.bottom + 0.1, 'Bottom edge must clear cutout');
                    const outsideCenter = pad.x + pad.radius <= CENTER_ARENA_LEFT || pad.x - pad.radius >= CENTER_ARENA_RIGHT;
                    assert.ok(outsideCenter, `Control (${handedness}/${size}/${position}) must stay outside center arena`);
                }
                const sep = Math.hypot(layout.fire.x - layout.special.x, layout.fire.y - layout.special.y);
                assert.ok(sep >= layout.fire.radius + layout.special.radius + 19, 'TIRO and ESP must stay separated');
            }
        }
    }

    const mapped = computeWorldSafeInsets(
        { left: 0, top: 0, width: 915, height: 412 },
        { width: 915, height: 412 },
        { left: 40, right: 40, top: 18, bottom: 24 },
    );
    assert.ok(mapped.left > 25 && mapped.right > 25 && mapped.bottom > 20);
});

test('TouchInputController supports simultaneous movement + fire + special without accidental special triggers', () => {
    const ctrl = new TouchInputController(defaultTouchSettings());
    const l = ctrl.getLayout();

    // Dragging finger from movement half across right half never activates Special or Fire
    assert.equal(ctrl.onPointerDown(1, l.joystick.x, l.joystick.y), 'move');
    ctrl.onPointerMove(1, l.special.x, l.special.y); // Drag over Special with pointer 1 still moving
    let step = ctrl.consumeStep();
    assert.equal(step.special, false);
    assert.equal(step.fire, false);
    assert.ok(step.x > 0.9);

    // Move stick to Up-Right diagonal, then hold FIRE with finger 2
    ctrl.onPointerMove(1, l.joystick.x + 28, l.joystick.y - 28);
    assert.equal(ctrl.onPointerDown(2, l.fire.x, l.fire.y), 'fire');
    step = ctrl.consumeStep();
    assert.equal(step.fire, true);
    assert.equal(step.special, false);
    assert.ok(step.x > 0.6 && step.y < -0.6);

    // Quick third-finger tap on SPECIAL (<1 frame) still delivers latched special edge cleanly
    assert.equal(ctrl.onPointerDown(3, l.special.x, l.special.y), 'special');
    ctrl.onPointerUp(3);
    step = ctrl.consumeStep();
    assert.equal(step.special, true);
    assert.equal(step.fire, true);
    assert.ok(step.x > 0.6 && step.y < -0.6);

    // Next step clears latched special pulse while keeping movement + held fire intact
    step = ctrl.consumeStep();
    assert.equal(step.special, false);
    assert.equal(step.fire, true);

    // Releasing FIRE stops shooting while joystick stays active; Pause/blur clears everything
    ctrl.onPointerUp(2);
    assert.equal(ctrl.consumeStep().fire, false);
    assert.equal(ctrl.onPointerDown(4, l.pause.x, l.pause.y), 'pause');
    const paused = ctrl.consumeStep();
    assert.equal(paused.x, 0);
    assert.equal(paused.y, 0);
    assert.equal(paused.fire, false);
    assert.equal(paused.special, false);
});

test('TouchInputController avoids near-miss triggers outside ESP hit zone and supports left-handed layout', () => {
    const ctrl = new TouchInputController({ ...defaultTouchSettings(), handedness: 'left', opacity: 0.45 });
    const l = ctrl.getLayout();
    assert.ok(l.joystick.x > CENTER_ARENA_RIGHT);
    assert.ok(l.fire.x < CENTER_ARENA_LEFT);
    assert.ok(l.special.x < CENTER_ARENA_LEFT);

    // Tapping empty space near ESP (outside hitRadius) does not trigger special
    assert.equal(ctrl.onPointerDown(10, l.special.x + l.special.hitRadius + 10, l.special.y - 25), 'none');
    assert.equal(ctrl.consumeStep().special, false);
});

test('SaveSystem persists touch control layout preferences and sanitizes invalid values', () => {
    const prevWindow = globalThis.window;
    const mem = new Map();
    globalThis.window = {
        localStorage: {
            getItem: k => (mem.has(k) ? mem.get(k) : null),
            setItem: (k, v) => mem.set(k, v),
            removeItem: k => mem.delete(k),
        },
    };
    try {
        const legacy = defaultSaveData();
        delete legacy.settings.touch;
        mem.set('bullet_wake_save_v1', JSON.stringify(legacy));

        const save = new SaveSystem();
        assert.deepEqual(save.getSettings().touch, defaultTouchSettings());

        save.updateSettings({
            touch: sanitizeTouchSettings({ handedness: 'left', size: 'large', position: 'raised', opacity: 0.45, offsetY: -12 }),
        });
        const reloaded = new SaveSystem();
        assert.equal(reloaded.getSettings().touch.handedness, 'left');
        assert.equal(reloaded.getSettings().touch.size, 'large');
        assert.equal(reloaded.getSettings().touch.position, 'raised');
        assert.equal(reloaded.getSettings().touch.opacity, 0.45);
        assert.equal(reloaded.getSettings().touch.offsetY, -12);

        save.updateSettings({ touch: defaultTouchSettings() });
        assert.deepEqual(new SaveSystem().getSettings().touch, defaultTouchSettings());
    } finally {
        globalThis.window = prevWindow;
    }
});

test('Pause touch target avoids overlapping Fenda Pelagica HUD score under landscape safe-area cutouts', () => {
    for (const insets of [
        { top: 0, right: 0, bottom: 0, left: 0 },
        { top: 24, right: 38, bottom: 26, left: 38 },
        { top: 42, right: 48, bottom: 38, left: 48 },
    ]) {
        const l = computeTouchLayout(defaultTouchSettings(), insets);
        const insideScoreBox = l.pause.x >= 624 && l.pause.x <= 730 && l.pause.y >= 26 && l.pause.y <= 64;
        assert.equal(insideScoreBox, false, `Pause (${l.pause.x}, ${l.pause.y}) must not cover HUD score box`);
    }
});

test('HUD Pause button renders as an actual interactive button away from PONTUAÇÃO on desktop', () => {
    const l = computeTouchLayout(defaultTouchSettings(), { top: 0, right: 0, bottom: 0, left: 0 });
    assert.ok(l.pause.x + 20 <= WORLD_WIDTH, 'Compact touch pause pill fits inside world right edge');
    assert.ok(l.pause.x >= 732, 'Compact touch pause stays outside score box');
});
