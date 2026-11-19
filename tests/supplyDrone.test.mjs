import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';
import {
  SUPPLY_DRONE_DESCENT_SPEED,
  SUPPLY_DRONE_DISPLAY_SIZE,
  SUPPLY_DRONE_PROP_SIZE,
} from '../src/game/arcade/SupplyDrone.ts';

function readPngDimensions(rel) {
  const buf = readFileSync(resolve(rel));
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${rel} must be a valid PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
}

function makeWorld() {
  const w = new ArcadeWorld(MISSIONS[0]);
  w.setDifficulty('normal');
  w.state = 'play';
  w.introTime = 0;
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.player.invulnerable = 0;
  return w;
}

test('Supply drone separate PNG assets exist, drone size is compact (smaller than player ship), and balloon frames are removed', () => {
  for (const rel of [
    'public/assets/arcade/pelagic-review/supply-drone-body.png',
    'public/assets/arcade/pelagic-review/supply-drone-propeller.png',
  ]) {
    assert.ok(existsSync(resolve(rel)), `Missing asset: ${rel}`);
    const info = readPngDimensions(rel);
    assert.equal(info.width, 256, `${rel} width`);
    assert.equal(info.height, 256, `${rel} height`);
    assert.ok(info.bytes > 8000, `${rel} should be high quality (${info.bytes} bytes)`);
  }

  assert.ok(SUPPLY_DRONE_DISPLAY_SIZE <= 30, `Drone size (${SUPPLY_DRONE_DISPLAY_SIZE}px) must be plane-sized / smaller than player ship`);
  assert.ok(SUPPLY_DRONE_PROP_SIZE <= SUPPLY_DRONE_DISPLAY_SIZE, 'Propeller size must match compact drone body');

  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  const renderBlock = sceneSrc.slice(
    sceneSrc.indexOf('private renderCargo(): void'),
    sceneSrc.indexOf('private renderObstacles('),
  );
  assert.ok(renderBlock.includes('SUPPLY_DRONE_BODY_ART'), 'renderCargo must render separate drone body');
  assert.ok(renderBlock.includes('SUPPLY_DRONE_PROP_ART'), 'renderCargo must render separate spinning propeller');
  assert.ok(renderBlock.includes('setRotation(rotorAngle)'), 'propeller must rotate independently');
  assert.ok(!renderBlock.includes('c.crate ? 0 :'), 'balloon row 0 must never be used for supply carriers');
});

test('Supply drone always enters from the top and descends slowly almost straight down with gentle horizontal nuance', () => {
  const w = makeWorld();
  w.devInvincible = true;
  const startXs = new Set();

  for (let n = 0; n < 4; n++) {
    w.cargo = [];
    const carrier = w.devSpawnSupplyDrone('power');
    assert.ok(carrier.drone, 'carrier must have drone state');
    assert.equal(carrier.drone.entrySide, 'top', 'drone must always enter from top');
    assert.ok(carrier.y < w.arena.top, 'drone starts cleanly above top edge');
    assert.ok(carrier.x >= w.arena.left + 20 && carrier.x <= w.arena.right - 20, 'drone starts inside horizontal corridor');
    startXs.add(Math.round(carrier.x));

    const startX = carrier.x;
    const startY = carrier.y;
    const initialRotor = carrier.drone.rotorAngle;

    // Step 4 seconds of calm descent
    for (let i = 0; i < 240; i++) {
      w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
      assert.ok(Math.abs(carrier.vx) <= 32, `Horizontal drift (${carrier.vx.toFixed(1)} px/s) must stay gentle and subtle`);
      assert.ok(carrier.vy > 0 && carrier.vy <= 45, `Vertical descent (${carrier.vy.toFixed(1)} px/s) must stay calm and steady`);
    }

    const avgVy = (carrier.y - startY) / 4;
    assert.ok(
      Math.abs(avgVy - SUPPLY_DRONE_DESCENT_SPEED) < 2,
      `Average descent speed (${avgVy.toFixed(1)} px/s) should match calm delivery speed ${SUPPLY_DRONE_DESCENT_SPEED} px/s`,
    );
    assert.notEqual(Math.round(carrier.x), Math.round(startX), 'Drone should have gentle lateral nuance while descending');
    assert.notEqual(carrier.drone.rotorAngle, initialRotor, 'Propeller must spin continuously');
  }

  assert.ok(startXs.size >= 3, 'Top entry should vary horizontal lanes across consecutive supplies');
});

test('Destroying supply drone drops power/life/special item and collection works consistently', () => {
  for (const kind of /** @type {const} */ (['power', 'life', 'special'])) {
    const w = makeWorld();
    w.devInvincible = true;
    const startLives = w.lives;
    const startSpec = w.weapons.specialCharges;
    const startMeter = w.weapons.powerMeter;

    const carrier = w.devSpawnSupplyDrone(kind);
    // Let drone descend into shooting range
    for (let i = 0; i < 240; i++) {
      w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
    }
    assert.equal(carrier.crate, true);

    // Position player underneath and shoot drone down
    w.player.x = carrier.x;
    w.player.y = Math.min(w.arena.bottom - 36, carrier.y + 88);
    for (let i = 0; i < 60 && carrier.crate; i++) {
      w.player.x = carrier.x;
      w.step(1 / 60, { x: 0, y: 0, fire: true, special: false });
    }
    assert.equal(carrier.crate, false, `${kind}: shooting drone must release item`);
    assert.equal(carrier.drone, undefined, `${kind}: destroyed drone detaches carrier state`);
    assert.ok((carrier.dropPop ?? 0) > 0, `${kind}: released item triggers lively pop-out`);

    // Collect the dropped item
    w.player.x = carrier.x;
    w.player.y = carrier.y;
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });

    assert.equal(w.collected, 1, `${kind}: item collected`);
    if (kind === 'power') assert.equal(w.weapons.powerMeter, startMeter + 1);
    if (kind === 'life') assert.equal(w.lives, startLives + 1);
    if (kind === 'special') assert.equal(w.weapons.specialCharges, startSpec + 1);
  }
});

test('Undestroyed drone exits bottom of screen without dropping any item', () => {
  const w = makeWorld();
  w.devInvincible = true;
  w.devSpawnSupplyDrone('power');

  for (let i = 0; i < 60 * 18 && w.cargo.length > 0; i++) {
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  }

  assert.equal(w.cargo.length, 0, 'Undestroyed drone must exit off bottom without leaving an item');
  assert.equal(w.collected, 0, 'No item collected when drone passes untouched');
});

test('Colliding with supply drone destroys drone, drops item, and applies player collision rules', () => {
  const w = makeWorld();
  w.lives = 3;
  w.player.invulnerable = 0;
  const carrier = w.devSpawnSupplyDrone('special');
  for (let i = 0; i < 180; i++) {
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  }

  w.player.x = carrier.x;
  w.player.y = carrier.y;
  w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });

  assert.equal(carrier.crate, false, 'Player contact must destroy drone and release item');
  assert.equal(w.lives, 2, 'Player contact with drone must apply consistent collision damage');
  assert.equal(w.deaths, 1, 'Collision increments deaths cleanly');
  assert.ok(w.player.invulnerable > 0, 'Standard post-hit invulnerability granted');
});
