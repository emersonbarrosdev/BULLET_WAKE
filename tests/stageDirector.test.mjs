import assert from 'node:assert/strict';
import test from 'node:test';
import {
  StageDirector, SCROLL_SPEED, DEMO_DISTANCE, STAGE_EVENTS, getSector,
} from '../src/game/systems/stageDirector.ts';

function advance(director, durationMs, x = 135, y = 216) {
  const events = { spawned: [], shots: [] };
  for (let n = 0; n < durationMs; n += 25) {
    const tick = director.update(Math.min(25, durationMs - n), x, y);
    events.spawned.push(...tick.spawned);
    events.shots.push(...tick.shots);
  }
  return events;
}

test('progression advances continuously by distance and does not label waves', () => {
  const director = new StageDirector(768);
  const tick = director.update(50, 135, 216);
  assert.ok(Math.abs(director.scrollPx-director.travelSpeed*.05)<1e-6);
  assert.ok(tick.progress > 0);
  assert.equal('wave' in tick, false);
});

test('first passage spawns a formation and then a Lancer once', () => {
  const director = new StageDirector();
  const first={spawned:[]};while(director.scrollPx<320)first.spawned.push(...director.update(10,135,216).spawned);
  assert.deepEqual(first.spawned.filter(e => !e.carrier).map(e => e.kind), ['scout', 'scout', 'scout']);
  const later={spawned:[]};while(director.scrollPx<500)later.spawned.push(...director.update(10,135,216).spawned);
  assert.equal(later.spawned.filter(e => e.kind === 'lancer').length, 1);
});

test('Scout and Lancer announce attacks before releasing aimed shots', () => {
  const director = new StageDirector();
  advance(director, 135/SCROLL_SPEED*1000);
  const scout = director.enemies[0];
  assert.ok(scout);
  const shots = advance(director, 3900).shots;
  assert.ok(shots.length > 0);
  assert.ok(shots.some(s => s.velocityX < 0));
});

test('Lancer survives one volley; only elimination awards points', () => {
  const director = new StageDirector();
  advance(director, 510/SCROLL_SPEED*1000);
  const lancer = director.enemies.find(e => e.kind === 'lancer');
  assert.ok(lancer);
  assert.deepEqual(director.damage(lancer.id, 1), { killed: false, score: 0 });
  assert.deepEqual(director.damage(lancer.id, 1), { killed: false, score: 0 });
  assert.deepEqual(director.damage(lancer.id, 1), { killed: false, score: 0 });
  assert.deepEqual(director.damage(lancer.id, lancer.hp), { killed: true, score: 300 });
  assert.deepEqual(director.damage(lancer.id, 1), { killed: false, score: 0 });
});

test('a replay does not happen inside one stage; stage events occur exactly once', () => {
  const director = new StageDirector();
  let spawned = 0;
  let completed = false;
  for (let i = 0; i < 7200; i++) {
    const tick = director.update(25, 135, 216);
    spawned += tick.spawned.length;
    completed ||= tick.completed;
  }
  assert.equal(spawned, STAGE_EVENTS.length);
  assert.ok(director.scrollPx>=DEMO_DISTANCE);
  assert.ok(completed);
  assert.equal(director.update(25, 135, 216).spawned.length, 0);
});

test('sectors advance in scripted order', () => {
  assert.equal(getSector(0), 'evacuacao');
  assert.equal(getSector(1000), 'destrocos');
  assert.equal(getSector(2100), 'industria');
  assert.equal(getSector(3200), 'aproximacao');
  assert.ok(DEMO_DISTANCE > STAGE_EVENTS.at(-1).distance);
});

test('damage to removed enemy never scores twice', () => {
  const director = new StageDirector();
  advance(director, 130/SCROLL_SPEED*1000);
  const scout = director.enemies[0];
  assert.equal(director.damage(scout.id, 2).score, 100);
  assert.equal(director.damage(scout.id, 2).score, 0);
});
