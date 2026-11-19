import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';
import {
  SUPPLY_DRONE_DELIVER_DURATION,
  SUPPLY_DRONE_RETRY_DELAY,
  pickSupplyEntrySide,
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

test('Supply drone separate PNG assets exist in crisp resolution and balloon frames are removed from renderCargo', () => {
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

test('Supply drone enters briskly from all 4 directions (left, right, top, bottom) into central delivery region', () => {
  const sides = /** @type {const} */ (['left', 'right', 'top', 'bottom']);
  for (const side of sides) {
    const w = makeWorld();
    w.player.x = w.arenaCenterX - 60;
    const carrier = w.devSpawnSupplyDrone('power', side);
    assert.ok(carrier.drone, `${side}: carrier must have drone state`);
    assert.equal(carrier.drone.entrySide, side);
    assert.equal(carrier.drone.phase, 'enter');

    // Verify off-edge start matches direction
    if (side === 'left') assert.ok(carrier.x < w.arena.left, 'left entry starts left of arena');
    if (side === 'right') assert.ok(carrier.x > w.arena.right, 'right entry starts right of arena');
    if (side === 'top') assert.ok(carrier.y < w.arena.top, 'top entry starts above arena');
    if (side === 'bottom') {
      assert.ok(carrier.y > w.arena.bottom, 'bottom entry starts below arena');
      assert.ok(Math.abs(carrier.x - w.player.x) >= 60, 'bottom entry stays safely separated from player X');
    }

    const startX = carrier.x;
    const startY = carrier.y;
    const initialRotor = carrier.drone.rotorAngle;

    // Step until delivery hover begins — must complete briskly (<= 1.3s)
    let elapsed = 0;
    while (carrier.drone.phase === 'enter' && elapsed < 2.0) {
      w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
      elapsed += 1 / 60;
    }
    assert.equal(carrier.drone.phase, 'deliver', `${side}: drone must reach deliver phase cleanly`);
    assert.ok(elapsed <= 1.25, `${side}: drone entry must be fast arcade pace (took ${elapsed.toFixed(2)}s)`);

    const dist = Math.hypot(carrier.x - startX, carrier.y - startY);
    const avgSpeed = dist / elapsed;
    assert.ok(avgSpeed >= 120, `${side}: entry speed (${avgSpeed.toFixed(0)} px/s) must be significantly faster than legacy slow balloon`);

    // Must arrive inside mid/central delivery region
    assert.ok(carrier.x >= w.arena.left + 40 && carrier.x <= w.arena.right - 40, `${side}: delivery X inside arena`);
    assert.ok(carrier.y >= w.arena.top + 80 && carrier.y <= w.arena.bottom - 140, `${side}: delivery Y in central corridor`);

    // Propeller must rotate continuously
    assert.notEqual(carrier.drone.rotorAngle, initialRotor, `${side}: propeller angle must rotate continuously`);
  }
});

test('Supply entry rotation provides variety across all 4 directions without immediate repeats', () => {
  const picked = new Set();
  let prev;
  for (let i = 0; i < 8; i++) {
    const s = pickSupplyEntrySide(i, true);
    picked.add(s);
    if (prev) assert.notEqual(s, prev, `Consecutive spawns ${i - 1}->${i} should not repeat ${s}`);
    prev = s;
  }
  assert.deepEqual([...picked].sort(), ['bottom', 'left', 'right', 'top']);
});

test('Destroying supply drone drops power/life/special item and collection works consistently', () => {
  for (const kind of /** @type {const} */ (['power', 'life', 'special'])) {
    const w = makeWorld();
    const startLives = w.lives;
    const startSpec = w.weapons.specialCharges;
    const startMeter = w.weapons.powerMeter;

    const carrier = w.devSpawnSupplyDrone(kind, 'left');
    // Let drone arrive at delivery point
    for (let i = 0; i < 90 && carrier.drone?.phase === 'enter'; i++) {
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

test('Undestroyed drone retreats without dropping item, and a new drone appears later from a different direction', () => {
  const w = makeWorld();
  w.devInvincible = true;
  const carrier = w.devSpawnSupplyDrone('power', 'left');

  // Step through enter + deliver + retreat without shooting
  let sawRetreat = false;
  for (let i = 0; i < Math.ceil((1.4 + SUPPLY_DRONE_DELIVER_DURATION + 3.0) * 60); i++) {
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
    if (carrier.drone?.phase === 'retreat') sawRetreat = true;
    if (w.cargo.length === 0) break;
  }

  assert.equal(sawRetreat, true, 'Undestroyed drone must enter retreat phase');
  assert.equal(w.cargo.length, 0, 'Retreated drone must exit without dropping an item');
  assert.equal(w.collected, 0, 'No item collected when drone escapes');

  // Advance through retry delay (~7.5s) and verify a replacement drone enters from a different direction
  for (let i = 0; i < Math.ceil((SUPPLY_DRONE_RETRY_DELAY + 0.5) * 60) && w.cargo.length === 0; i++) {
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  }
  assert.equal(w.cargo.length, 1, 'Replacement supply drone should appear after cooldown');
  assert.equal(w.cargo[0].crate, true, 'Replacement enters as a drone carrier');
  assert.notEqual(w.cargo[0].drone?.entrySide, 'left', 'Replacement enters from a different direction');
});

test('Colliding with supply drone destroys drone, drops item, and applies player collision rules', () => {
  const w = makeWorld();
  w.lives = 3;
  w.player.invulnerable = 0;
  const carrier = w.devSpawnSupplyDrone('special', 'top');
  for (let i = 0; i < 80 && carrier.drone?.phase === 'enter'; i++) {
    w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  }

  // Fly player directly into the drone
  w.player.x = carrier.x;
  w.player.y = carrier.y;
  w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });

  assert.equal(carrier.crate, false, 'Player contact must destroy drone and release item');
  assert.equal(w.lives, 2, 'Player contact with drone must apply consistent collision damage');
  assert.equal(w.deaths, 1, 'Collision increments deaths cleanly');
  assert.ok(w.player.invulnerable > 0, 'Standard post-hit invulnerability granted');
});
