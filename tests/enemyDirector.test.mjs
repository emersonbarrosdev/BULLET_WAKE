import assert from 'node:assert/strict';
import test from 'node:test';
import { EnemyDirector } from '../src/game/systems/enemyDirector.ts';

const frame = (director, ms, x = 64, y = 108) => {
  const events = { spawned: [], shots: [] };
  for (let elapsed = 0; elapsed < ms; elapsed += 25) {
    const tick = director.update(Math.min(25, ms - elapsed), x, y);
    events.spawned.push(...tick.spawned);
    events.shots.push(...tick.shots);
  }
  return events;
};

test('wave scripted spawns Scouts before Lancer', () => {
  const director = new EnemyDirector();
  const events = frame(director, 3450);
  assert.deepEqual(events.spawned.map(enemy => enemy.kind), ['scout', 'scout', 'lancer']);
  assert.equal(director.wave, 1);
});

test('both enemy types telegraph before firing aimed bullets', () => {
  const director = new EnemyDirector();
  frame(director, 1700);
  const first = director.enemies.find(enemy => enemy.kind === 'scout');
  assert.ok(first);
  assert.ok(['approach', 'telegraph'].includes(first.phase));
  const events = frame(director, 2500);
  assert.ok(events.shots.some(s => s.velocityX < 0), 'should shoot toward player');
});

test('Lancer requires 3 hits and awards points only once', () => {
  const director = new EnemyDirector();
  frame(director, 3450);
  const lancer = director.enemies.find(enemy => enemy.kind === 'lancer');
  assert.ok(lancer);
  assert.deepEqual(director.damage(lancer.id, 1), { killed: false, score: 0 });
  assert.deepEqual(director.damage(lancer.id, 1), { killed: false, score: 0 });
  assert.deepEqual(director.damage(lancer.id, 1), { killed: true, score: 300 });
  assert.deepEqual(director.damage(lancer.id, 1), { killed: false, score: 0 });
});

test('new cycle starts with new wave and a different enemy id', () => {
  const director = new EnemyDirector();
  const first = frame(director, 1000).spawned[0];
  assert.ok(first);
  frame(director, 23000);
  assert.ok(director.wave >= 2);
  assert.ok(director.enemies.some(enemy => enemy.id > first.id));
});

test('no additional HP or score after removed enemy', () => {
  const director = new EnemyDirector();
  frame(director, 650);
  const first = director.enemies[0];
  assert.equal(director.damage(first.id, 1).score, 100);
  assert.equal(director.damage(first.id, 1).score, 0);
});
