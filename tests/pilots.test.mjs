import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getPilot, PILOTS, shotIntervalMs } from '../src/game/data/pilots.ts';

test('three approved pilot and ship names are preserved', () => {
  assert.deepEqual(PILOTS.map(p => [p.name, p.shipName]), [
    ['Nolan Fitch', 'Rivet'],
    ['Cora Wren', 'Moth'],
    ['Harlan Greer', 'Knuckle'],
  ]);
  assert.equal(new Set(PILOTS.map(p => p.id)).size, 3);
});

test('pilots have different speed, cadence and damage', () => {
  const [nolan, cora, harlan] = PILOTS;
  assert.ok(cora.speed > nolan.speed && nolan.speed > harlan.speed);
  assert.ok(nolan.shotsPerSecond > cora.shotsPerSecond);
  assert.ok(cora.shotsPerSecond > harlan.shotsPerSecond);
  assert.ok(harlan.damage > cora.damage && cora.damage > nolan.damage);
});

test('base theoretical DPS remains approximately equivalent', () => {
  const dps = PILOTS.map(p => p.shotsPerSecond * p.damage);
  for (const value of dps) assert.ok(Math.abs(value - 8) < 0.05);
});

test('fire intervals reflect cadence, with three valid distinct pilots', () => {
  assert.equal(shotIntervalMs(PILOTS[0]), 125);
  assert.ok(shotIntervalMs(PILOTS[1]) > shotIntervalMs(PILOTS[0]));
  assert.ok(shotIntervalMs(PILOTS[2]) > shotIntervalMs(PILOTS[1]));
  assert.equal(getPilot('cora').shipName, 'Moth');
  assert.equal(getPilot('harlan').shipName, 'Knuckle');
  assert.equal(getPilot('missing').shipName, 'Rivet');
});

test('each pilot keeps own color and planned special name', () => {
  assert.equal(new Set(PILOTS.map(p => p.specialName)).size, 3);
  assert.equal(new Set(PILOTS.map(p => p.accentColor)).size, 3);
});

test('each pilot has complete tactical profile, callsign, and valid 64x64 portrait PNG', () => {
  for (const pilot of PILOTS) {
    assert.ok(pilot.callsign && pilot.callsign.length > 3, `${pilot.id} has callsign`);
    assert.ok(pilot.bio && pilot.bio.length > 10, `${pilot.id} has bio`);
    assert.ok(pilot.specialDescription && pilot.specialDescription.length > 10, `${pilot.id} has specialDescription`);
    assert.ok(pilot.portraitKey && pilot.portraitKey.startsWith('portrait-'), `${pilot.id} has portraitKey`);

    const pngPath = `public/assets/pilots/${pilot.id}.png`;
    const buffer = readFileSync(pngPath);
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${pngPath} is valid PNG`);
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    assert.equal(width, 64, `${pngPath} width is 64px`);
    assert.equal(height, 64, `${pngPath} height is 64px`);
  }
});
