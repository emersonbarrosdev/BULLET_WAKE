import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';
import { PelagicComms } from '../src/game/arcade/PelagicComms.ts';
import {
    CENTER_ARENA_LEFT,
    CENTER_ARENA_RIGHT,
    computeTouchLayout,
    defaultTouchSettings,
} from '../src/game/arcade/TouchControls.ts';

const FENDA = MISSIONS[0];
const SOLAR = MISSIONS[1];

test('PC Desktop Pelagic uses approved 184/400/184 horizontal arena with no top/bottom HUD border', () => {
    const pc = new ArcadeWorld(FENDA, undefined, { upLayout: 'pc' });
    assert.equal(pc.upLayout, 'pc');
    assert.equal(pc.arena.left, 184);
    assert.equal(pc.arena.right, 584);
    assert.equal(pc.arena.top, 28);
    assert.equal(pc.arena.bottom, 420);
    assert.equal(pc.arenaWidth, 400);
    assert.equal(pc.arena.left, CENTER_ARENA_LEFT);
    assert.equal(pc.arena.right, CENTER_ARENA_RIGHT);
});

test('Android Portrait Pelagic and Cidade Solar layouts remain strictly unchanged', () => {
    const android = new ArcadeWorld(FENDA, undefined, { upLayout: 'portrait' });
    assert.equal(android.arena.left, 0);
    assert.equal(android.arena.right, 384);
    assert.equal(android.arenaWidth, 384);
    assert.ok(android.arena.bottom >= 600);

    const solar = new ArcadeWorld(SOLAR);
    assert.equal(solar.up, false);
    assert.equal(solar.arena.left, 16);
    assert.equal(solar.arena.right, 752);
});

test('Pause button touch layout sits cleanly in the right-panel top header away from center gameplay', () => {
    const layout = computeTouchLayout(defaultTouchSettings());
    assert.ok(layout.pause.x >= 730, `Pause x (${layout.pause.x}) must stay in top-right panel corner`);
    assert.ok(layout.pause.y >= 14 && layout.pause.y <= 32, `Pause y (${layout.pause.y}) must sit in right top header`);
    assert.ok(layout.pause.x > CENTER_ARENA_RIGHT, 'Pause target must never enter center gameplay arena');
});

test('PelagicComms updates expressions/lines dynamically and returns cleanly to quiet rest', () => {
    const comms = new PelagicComms();
    assert.equal(comms.current(), null);

    assert.equal(comms.trigger({ category: 'start' }), true);
    const startMsg = comms.current();
    assert.ok(startMsg && startMsg.text.length > 0);
    assert.equal(startMsg.expression, 0);

    // Expire comm cleanly to quiet resting state
    comms.step(startMsg.duration + 0.2);
    assert.equal(comms.current(), null, 'Radio must stay silent after message expires');

    // Damage sets hurt expression (2) and pickup joy expression (1)
    assert.equal(comms.trigger({ category: 'damage' }), true);
    assert.equal(comms.current()?.expression, 2);
    comms.step(4);
    assert.equal(comms.current(), null);

    assert.equal(comms.trigger({ category: 'pickup', detail: 'special' }), true);
    assert.equal(comms.current()?.expression, 1);
    comms.step(4);
    assert.equal(comms.current(), null);
});
