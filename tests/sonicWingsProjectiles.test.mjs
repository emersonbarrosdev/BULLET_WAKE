import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { ENEMY_SHOTS, MISSIONS } from '../src/game/arcade/content.ts';
import {
  DIFFICULTY_PROFILES,
  ENEMY_PROJECTILE_SPEED_MULTIPLIERS,
} from '../src/game/arcade/PelagicDifficulty.ts';

function spawnAndFire(family, difficulty, opts = {}) {
  const w = new ArcadeWorld(MISSIONS[0], undefined, { difficulty, upLayout: 'pc', seed: 1337 });
  w.state = 'play';
  w.introTime = 0;
  w.waveIndex = 999;
  w.supplyIndex = 999;
  w.player.invulnerable = 999;
  if (opts.assisted) w.assisted = true;
  if (opts.devShotScale !== undefined) w.enemyShotSpeedScale = opts.devShotScale;
  w.spawnEncounter({ family, formation: 'solo', motion: 'straight', lane: 0.5 });
  const e = w.enemies[0];
  assert.ok(e, `Expected enemy for family ${family}`);
  e.x = 384;
  e.y = 110;
  if (e.navigation) {
    e.navigation.anchor = undefined;
    e.navigation.worldY = 110 - w.scroll;
    e.navigation.phase = 'hold';
    if (family === 'tower' || family === 'tank') {
      e.navigation.customAnchor = true;
      e.navigation.anchorX = 384;
      e.navigation.anchorY = 0;
    }
  }
  if (e.submarine) {
    e.age = 2.0;
    e.submarine.phase = 'hold';
    e.submarine.exposure = 1;
  }
  e.cooldown = 0;
  w.updateEnemies(1 / 60);
  const shots = w.bullets.filter(b => b.active && b.enemy && !b.enemyMissile);
  assert.ok(shots.length > 0, `Expected conventional enemy projectiles for ${family} on ${difficulty}`);
  return { world: w, enemy: e, shots };
}

test('01. Configurable projectile multipliers match 0.75x Easy, 1.00x Normal, 1.30x Hard with zero stacked bonus', () => {
  assert.equal(ENEMY_PROJECTILE_SPEED_MULTIPLIERS.easy, 0.75);
  assert.equal(ENEMY_PROJECTILE_SPEED_MULTIPLIERS.normal, 1.0);
  assert.equal(ENEMY_PROJECTILE_SPEED_MULTIPLIERS.hard, 1.3);
  for (const d of ['easy', 'normal', 'hard']) {
    assert.equal(DIFFICULTY_PROFILES[d].shotSpeedMultiplier, ENEMY_PROJECTILE_SPEED_MULTIPLIERS[d]);
    assert.equal(DIFFICULTY_PROFILES[d].shotSpeedBonus, 0);
  }
});

test('02. All 9 enemy categories fire conventional orbs with differentiated radius and difficulty-scaled speeds', () => {
  const families = [
    'fighter',
    'interceptor',
    'bomber',
    'heli_scout',
    'heli_utility',
    'heli_phantom',
    'heli_warhawk',
    'tower',
    'boat',
    'ship',
    'submarine',
  ];

  const collectedRadii = new Map();
  for (const family of families) {
    const easy = spawnAndFire(family, 'easy');
    const normal = spawnAndFire(family, 'normal');
    const hard = spawnAndFire(family, 'hard');

    const base = ENEMY_SHOTS[family].speed;
    const sEasy = Math.hypot(easy.shots[0].vx, easy.shots[0].vy);
    const sNormal = Math.hypot(normal.shots[0].vx, normal.shots[0].vy);
    const sHard = Math.hypot(hard.shots[0].vx, hard.shots[0].vy);

    assert(Math.abs(sNormal - base) < 1e-6, `${family} normal speed mismatch: ${sNormal} vs ${base}`);
    assert(Math.abs(sEasy - base * 0.75) < 1e-6, `${family} easy speed mismatch: ${sEasy} vs ${base * 0.75}`);
    assert(Math.abs(sHard - base * 1.3) < 1e-6, `${family} hard speed mismatch: ${sHard} vs ${base * 1.3}`);
    assert(sEasy < sNormal && sNormal < sHard);

    // Hitbox radius stays identical across difficulties (only visual glow added smoothly in renderer)
    assert.equal(easy.shots[0].radius, ENEMY_SHOTS[family].radius);
    assert.equal(normal.shots[0].radius, ENEMY_SHOTS[family].radius);
    assert.equal(hard.shots[0].radius, ENEMY_SHOTS[family].radius);
    collectedRadii.set(family, normal.shots[0].radius);
  }

  assert(collectedRadii.get('fighter') < collectedRadii.get('bomber'));
  assert(collectedRadii.get('heli_scout') < collectedRadii.get('heli_utility'));
  assert(collectedRadii.get('fighter') < collectedRadii.get('ship'));
  assert(collectedRadii.get('interceptor') < collectedRadii.get('tower'));
});

test('03. Standard boss and Colosso Abissal submarine modules preserve difficulty scaling & size variety', () => {
  // Submarine Boss (Fenda Pelagica)
  const subSpeeds = {};
  const subRadii = new Set();
  for (const diff of ['easy', 'normal', 'hard']) {
    const w = new ArcadeWorld(MISSIONS[0], undefined, { difficulty: diff, upLayout: 'pc', seed: 1337 });
    w.state = 'play';
    w.introTime = 0;
    w.devStartBoss(false, 2);
    w.player.invulnerable = 999;
    w.boss.sub.phase = 'fight';
    for (const p of w.boss.sub.sections[2].parts) {
      if (p.hp > 0) p.cooldown = 0.01;
    }
    w.step(1 / 60);
    const bullets = w.bullets.filter(b => b.active && b.enemy);
    assert(bullets.length > 0, `Expected submarine boss bullets in ${diff}`);
    subSpeeds[diff] = bullets.map(b => Math.hypot(b.vx, b.vy)).sort((a, b) => a - b);
    for (const b of bullets) subRadii.add(b.radius);
  }
  assert(subRadii.size >= 2, 'Boss attacks must preserve varied projectile radii');
  assert(subSpeeds.easy[0] < subSpeeds.normal[0] && subSpeeds.normal[0] < subSpeeds.hard[0]);
  assert(Math.abs(subSpeeds.easy[0] / subSpeeds.normal[0] - 0.75) < 1e-4);
  assert(Math.abs(subSpeeds.hard[0] / subSpeeds.normal[0] - 1.3) < 1e-4);

  // Classic Boss (Cidade Solar): stays untouched at legacy 1.0x calibration across difficulty presets
  const classicSpeeds = {};
  for (const diff of ['easy', 'normal', 'hard']) {
    const w = new ArcadeWorld(MISSIONS[1], undefined, { difficulty: diff, seed: 1337 });
    w.state = 'play';
    w.introTime = 0;
    w.devStartBoss(false);
    w.player.invulnerable = 999;
    w.boss.phase = 'fight';
    w.boss.attack = 0;
    w.boss.attackTime = 0.81;
    w.step(1 / 60);
    const bullets = w.bullets.filter(b => b.active && b.enemy);
    assert(bullets.length > 0, `Expected classic boss bullets in ${diff}`);
    classicSpeeds[diff] = Math.hypot(bullets[0].vx, bullets[0].vy);
  }
  assert.equal(classicSpeeds.easy, classicSpeeds.normal);
  assert.equal(classicSpeeds.hard, classicSpeeds.normal);
});

test('04. Arena crossing time comparison strictly satisfies T_easy > T_normal > T_hard', () => {
  const distance = 300;
  const times = {};
  for (const diff of ['easy', 'normal', 'hard']) {
    const { world, shots } = spawnAndFire('fighter', diff);
    const b = shots[0];
    const x0 = b.x;
    const y0 = b.y;
    const dt = 1 / 120;
    let t = 0;
    while (b.active && Math.hypot(b.x - x0, b.y - y0) < distance && t < 5) {
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      t += dt;
    }
    times[diff] = t;
    world.clearBullets();
  }
  assert(times.easy > times.normal * 1.25, `Easy crossing (${times.easy.toFixed(3)}s) must be noticeably slower than Normal (${times.normal.toFixed(3)}s)`);
  assert(times.hard < times.normal * 0.82, `Hard crossing (${times.hard.toFixed(3)}s) must be faster than Normal (${times.normal.toFixed(3)}s)`);
});

test('05. Assisted mode & DEV enemyShotSpeedScale integrate cleanly without corrupting difficulty profiles', () => {
  const normal = spawnAndFire('fighter', 'normal');
  const assisted = spawnAndFire('fighter', 'normal', { assisted: true });
  const scaled = spawnAndFire('fighter', 'normal', { devShotScale: 1.5 });
  const spd = b => Math.hypot(b.vx, b.vy);
  assert(Math.abs(spd(assisted.shots[0]) - spd(normal.shots[0]) * 0.75) < 1e-6);
  assert(Math.abs(spd(scaled.shots[0]) - spd(normal.shots[0]) * 1.5) < 1e-6);
  assert.equal(DIFFICULTY_PROFILES.normal.shotSpeedMultiplier, 1.0);
});

test('06. Warhawk missile preserves distinct missile identity and Sonic Wings orb palette avoids blue/green/pink/purple', () => {
  const sceneSrc = readFileSync(resolve('src/game/arcade/ArcadeScene.ts'), 'utf8');
  assert.ok(sceneSrc.includes('#5c0602'), 'Conventional orb texture must have crisp dark-crimson edge contrast');
  assert.ok(sceneSrc.includes('#ff8c14') || sceneSrc.includes('#ff7c10'), 'Conventional orb texture must use Sonic Wings orange-red spectrum');
  assert.ok(!sceneSrc.includes('#182948'), 'Legacy blue border #182948 must not remain in makeOrbTextures');

  // Warhawk firing cycle still emits both circular bullets and distinct straight missile
  const wh = new ArcadeWorld(MISSIONS[0], undefined, { difficulty: 'hard', upLayout: 'pc' });
  wh.state = 'play';
  wh.spawnEncounter({ family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: 0.5 });
  const enemy = wh.enemies[0];
  enemy.y = 130;
  enemy.cooldown = 0;
  wh.updateEnemies(1 / 60);
  const volleyOrb = wh.bullets.find(b => b.active && b.enemy && !b.enemyMissile);
  assert.ok(volleyOrb, 'Warhawk burst fires circular energy orbs');
  wh.bullets.forEach(b => (b.active = false));
  enemy.cooldown = 0;
  wh.updateEnemies(1 / 60);
  wh.bullets.forEach(b => (b.active = false));
  enemy.cooldown = 0;
  wh.updateEnemies(1 / 60);
  const missile = wh.bullets.find(b => b.active && b.enemy && b.enemyMissile);
  assert.ok(missile, 'Warhawk launcher preserves physical missile identity');
});
