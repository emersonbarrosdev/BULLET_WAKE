import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialPlayerHealth,
  applyPlayerHit,
  advanceHealth,
} from '../src/game/systems/combat.ts';
import { circleHitsHull } from '../src/game/systems/hullCollision.ts';
import { stepTriggerCadence } from '../src/game/systems/fireCadence.ts';
import {
  StageDirector,
  enemyBodyRadius,
} from '../src/game/systems/stageDirector.ts';
import { getPrimaryProjectiles } from '../src/game/systems/weaponSystem.ts';

test('one integrity pool reaches game over, without automatic extra lives', () => {
  let h = initialPlayerHealth();
  assert.equal(h.hp, 100);
  assert.equal(h.lives, 1);
  for (let i = 1; i <= 5; i++) {
    const hit = applyPlayerHit(h, 20);
    assert.equal(hit.event, i < 5 ? 'damaged' : 'game-over');
    h = advanceHealth(hit.state, 2000);
  }
  assert.equal(h.hp, 0);
  assert.equal(h.gameOver, true);
});
test('visible nose and wings take hits; empty sprite corners do not', () => {
  assert.equal(circleHitsHull(100, 80, 1, 100, 100), true);
  assert.equal(circleHitsHull(117, 110, 1, 100, 100), true);
  assert.equal(circleHitsHull(118, 81, 1, 100, 100), false);
  assert.equal(circleHitsHull(100, 125, 1, 100, 100), false);
});
test('RAPID off rewards tapping; RAPID on restores held cadence across frame rates', () => {
  const count=(fps, mode)=>{
    let clock={holdMs:0,tapMs:0},n=0;
    for(let i=0;i<fps*6;i++){
      const tap = mode==='tap' && i % Math.round(fps*.15)===0;
      const result=stepTriggerCadence(clock,1000/fps,mode!=='tap'||tap,tap,mode==='rapid',380,125);
      clock=result;n+=result.volleys;
    }return n;
  };
  for(const fps of [30,60,120]){
    const slow=count(fps,'hold'),tap=count(fps,'tap'),rapid=count(fps,'rapid');
    assert.ok(slow>=15&&slow<=17,JSON.stringify({fps,slow}));
    assert.ok(tap>slow*1.7,JSON.stringify({fps,slow,tap}));
    assert.ok(rapid>=43&&rapid<=49,JSON.stringify({fps,rapid}));
  }
});

test('blue fan originates at one muzzle, expands by level and keeps constant speed', () => {
  let previous = 0;
  for (const level of [1, 2, 3, 4]) {
    const shots = getPrimaryProjectiles('ion', level, 384, 330);
    assert.equal(shots.length, [3, 5, 9, 16][level - 1]);
    assert.ok(Math.abs(shots[0].velocityX) >= previous);
    previous = Math.abs(shots[0].velocityX);
    for (const s of shots) {
      assert.equal(s.x, 384);
      assert.equal(s.y, 330);
      assert.ok(Math.abs(Math.hypot(s.velocityX, s.velocityY) - 640) < 0.001);
    }
  }
});
test('coordinated routes remain separated through normal and miniboss passages', () => {
  for (const boss of [false, true]) {
    const d = new StageDirector(768, boss);
    for (let i = 0; i < 2400; i++) {
      d.update(50, 384, 350);
      const visible = d.enemies.filter(
        (e) => e.y > 0 && e.y < 432 && e.x > 168 && e.x < 600,
      );
      for (let a = 0; a < visible.length; a++)
        for (let b = a + 1; b < visible.length; b++) {
          const one = visible[a],
            two = visible[b];
          assert.ok(
            Math.hypot(one.x - two.x, one.y - two.y) >=
              enemyBodyRadius(one) + enemyBodyRadius(two) + 2,
            'Overlapping routes',
          );
        }
    }
  }
});
test('continue resumes the sector without replaying or farming old supply events', () => {
  const d = new StageDirector(768, true);
  d.seekCheckpoint(2100);
  assert.equal(d.scrollPx, 2100);
  assert.equal(d.minibossSpawned, true);
  const spawned = [];
  for (let i = 0; i < 40; i++) spawned.push(...d.update(50, 384, 350).spawned);
  assert.ok(spawned.length > 0);
  assert.ok(spawned.every((e) => e.spawnScroll > 2100));
});
