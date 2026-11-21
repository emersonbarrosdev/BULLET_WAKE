import test from 'node:test';
import assert from 'node:assert/strict';
import { MobileDisplay, mobileLandscapeViewport, mobilePortraitViewport } from '../src/game/arcade/MobileDisplay.ts';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { FENDA } from '../src/game/arcade/content.ts';
import { SUB_HULL_DISPLAY_W } from '../src/game/arcade/PelagicSubmarineBoss.ts';
import { ReplayPlayer, ReplayRecorder } from '../src/game/arcade/ArcadeReplay.ts';

test('mobile controller detection waits for opening, announces once and allows reconnect', () => {
  globalThis.window = {};
  const display = new MobileDisplay();
  assert.equal(display.poll(0, true, false), undefined);
  assert.equal(display.poll(.01, true, true), 'connected');
  assert.equal(display.poll(.02, true, true), undefined);
  assert.equal(display.poll(.03, false, true), 'disconnected');
  assert.equal(display.poll(.04, true, true), 'connected');
});

test('native USB/Bluetooth presence works before browser activation, landscape requires a pad', async () => {
  let connected = false;
  const requests = [];
  globalThis.window = { BulletWakeAndroid: {
    isControllerConnected: () => connected,
    setOrientation: mode => { requests.push(mode); return mode === 'portrait' || connected; },
  } };
  const display = new MobileDisplay();
  display.poll(0, false, true);
  assert.equal(await display.orient('landscape'), false);
  assert.deepEqual(requests, []);
  connected = true;
  assert.equal(display.poll(.4, false, true), 'connected');
  assert.equal(await display.orient('landscape'), true);
  connected = false;
  assert.equal(display.poll(.8, false, true), 'disconnected');
  assert.equal(await display.orient('portrait'), true);
  assert.deepEqual(requests, ['landscape', 'portrait']);
});

test('landscape camera reserves sidebar and retains the entire current arena without distortion', () => {
  for (const [width, height] of [[640, 320], [800, 334], [915, 412]]) {
    for (const arena of [{ left: 0, right: 384, top: 34, bottom: 812 }, { left: 160, right: 608, top: 18, bottom: 424 }]) {
      const before = JSON.stringify(arena);
      const v = mobileLandscapeViewport(width, height, arena, true);
      const zoom = Math.min((width - v.sidebar) / v.w, height / v.h);
      assert(v.sidebar >= 136 && v.sidebar <= 184);
      assert((arena.right - arena.left) * zoom <= width - v.sidebar);
      assert((arena.bottom - arena.top) * zoom <= height);
      assert(v.cx - v.w / 2 <= arena.left && v.cx + v.w / 2 >= arena.right);
      assert.equal(JSON.stringify(arena), before);
    }
  }
});

test('portrait increases gameplay scale modestly while keeping ship edges and boss inside the field', () => {
  for (const [width, height] of [[320, 568], [360, 774], [360, 740], [412, 915], [480, 1080]]) {
    const v = mobilePortraitViewport(width, height);
    const arena = { left: 0, right: v.w, top: 34, bottom: v.h - 14 };
    const fitted = mobilePortraitViewport(width, height, arena);
    assert.deepEqual(fitted, v);
    const zoom = Math.min(width / v.w, height / v.h);
    assert(Math.abs(zoom / (width / 384) - 8 / 7) < 1e-9);
    assert(Math.abs(v.h * zoom - height) < 1e-9, 'fill the real safe-area host height');
    assert(SUB_HULL_DISPLAY_W < arena.right - arena.left, 'boss art fits inside the narrower field');
    const w = new ArcadeWorld({ ...FENDA, encounters: [] }, undefined, { upLayout: 'portrait', arena, playerSidePadding: 20 });
    w.state = 'play'; w.player.invulnerable = 1000; w.waveIndex = 999; w.supplyIndex = 999;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let tick = 0; tick < 300; tick++) w.step(1 / 60, { x, y, fire: false, special: false });
      assert(w.player.x - 20 >= 0 && w.player.x + 20 <= v.w, 'full player sprite fits at both lateral limits');
      assert(w.player.y - 21 >= 0 && w.player.y + 21 <= v.h, 'full player sprite fits at vertical limits');
    }
  }
});

test('portrait camera fits a returning landscape sortie without changing simulation geometry', () => {
  const arena = { left: 16.5, right: 751.5, top: 18, bottom: 424 };
  const before = JSON.stringify(arena);
  const v = mobilePortraitViewport(360, 740, arena);
  assert(v.cx - v.w / 2 <= arena.left && v.cx + v.w / 2 >= arena.right);
  assert(v.h >= arena.bottom + 14);
  assert.equal(JSON.stringify(arena), before);
});

test('mobile edge clearance survives replay while older recordings retain their original limits', () => {
  const meta = { missionId: FENDA.id, pilotId: 'nolan', difficulty: 'normal', assisted: false, seed: 1337,
    upLayout: 'portrait', arena: { left: 0, right: 336, top: 34, bottom: 708.4 }, playerSidePadding: 20 };
  const mission = { ...FENDA, encounters: [] };
  const original = new ArcadeWorld(mission, undefined, meta);
  original.state = 'play'; original.player.invulnerable = 1000;
  const recorder = new ReplayRecorder(meta);
  for (let i = 0; i < 600; i++) {
    const input = { x: i < 300 ? 1 : -1, y: -.05, fire: false, special: false };
    recorder.record(input); original.step(1 / 120, input);
  }
  const replay = recorder.finish();
  assert.equal(replay.playerSidePadding, 20);
  const restored = new ArcadeWorld(mission, undefined, replay), playback = new ReplayPlayer(replay);
  restored.state = 'play'; restored.player.invulnerable = 1000;
  while (!playback.finished) restored.step(1 / 120, playback.nextInput());
  assert.deepEqual(restored.player, original.player);
  const legacy = new ArcadeWorld(mission, undefined, { ...meta, playerSidePadding: undefined });
  assert.equal(legacy.playerSidePadding, 14);
});
