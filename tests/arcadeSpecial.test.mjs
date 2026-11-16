import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeWorld } from '../src/game/arcade/ArcadeWorld.ts';
import { MISSIONS } from '../src/game/arcade/content.ts';

function liveWorld(missionIndex = 0) {
 const world = new ArcadeWorld(MISSIONS[missionIndex]);
 world.state = 'play';
 world.player.invulnerable = 0;
 world.waveIndex = 999;
 world.supplyIndex = 999;
 return world;
}

test('Tormenta Escarlate preserves weapon levels NV1-FULL and respects charge limits/no-stacking', () => {
 for (let level = 1; level <= 5; level++) {
  const world = liveWorld(0);
  world.weapons.weaponLevel = level;
  world.weapons.powerMeter = level === 5 ? 0 : 1;
  world.weapons.specialCharges = 2;
  world.step(1 / 60, { x: 0, y: 0, fire: false, special: true });
  assert.equal(world.weapons.specialCharges, 1);
  assert.equal(world.weapons.weaponLevel, level);
  assert.equal(world.weapons.powerMeter, level === 5 ? 0 : 1);
  assert.equal(world.bomb?.phase, 'flight');
  assert.equal(world.events.some(e => e.type === 'special'), true);

  // Release and re-press while active: must not consume another charge or replace the bomb.
  world.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
  const beforeAge = world.bomb.age;
  world.step(1 / 60, { x: 0, y: 0, fire: false, special: true });
  assert.equal(world.weapons.specialCharges, 1);
  assert.ok(world.bomb.age > beforeAge);
 }

 const empty = liveWorld(0);
 empty.weapons.specialCharges = 0;
 empty.step(1 / 60, { x: 0, y: 0, fire: false, special: true });
 assert.equal(empty.bomb, undefined);
 assert.equal(empty.specialTime, 0);
 assert.equal(empty.weapons.specialCharges, 0);
});

test('Bomb special flight, radius, deterministic blast budget across framerates, and clean termination', () => {
 for (const missionIndex of [0, 1]) {
  const expectedRadius = missionIndex === 0 ? 155 : 180;
  const fpsSamples = [];
  for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
   const world = liveWorld(missionIndex);
   world.player.x = missionIndex === 0 ? 384 : 180;
   world.player.y = missionIndex === 0 ? 350 : 215;
   const targetX = missionIndex === 0 ? 384 : Math.min(world.arena.right - 65, 180 + 280 * 0.65);
   const targetY = missionIndex === 0 ? Math.max(world.arena.top + 65, 350 - 280 * 0.65) : 215;
   world.spawnEncounter({ family: 'bomber', formation: 'solo', motion: 'stationary', lane: 0.5 });
   const target = world.enemies[0];
   target.hp = 1000;
   target.maxHp = 1000;
   target.x = targetX;
   target.y = targetY;

   world.step(dt, { x: 0, y: 0, fire: false, special: true });
   while (world.bomb && world.bomb.phase === 'flight') {
    assert.equal(target.hp, 1000, 'Flight must not deal blast damage early');
    target.x = targetX;
    target.y = targetY;
    world.step(dt, { x: 0, y: 0, fire: false, special: false });
   }

   const blastEvent = world.events.find(e => e.type === 'explosion' && e.text === 'special-blast');
   assert.ok(blastEvent, 'Detonation emits special-blast explosion event for boom SFX');
   assert.equal(blastEvent.size, 3);

   let peakRadius = 0;
   while (world.bomb) {
    peakRadius = Math.max(peakRadius, world.bomb.radius);
    target.x = targetX;
    target.y = targetY;
    world.step(dt, { x: 0, y: 0, fire: false, special: false });
   }
   assert.ok(Math.abs(peakRadius - expectedRadius) < 1e-6);
   assert.equal(world.bomb, undefined);
   assert.equal(world.specialTime, 0);
   assert.equal(world.specialImpact, undefined);
   fpsSamples.push(1000 - target.hp);
  }
  const spread = Math.max(...fpsSamples) - Math.min(...fpsSamples);
  assert.ok(spread < 2.5, `Damage budget across 30/60/120 Hz must stay consistent, got ${fpsSamples}`);
  assert.ok(fpsSamples.every(d => d > 165 && d <= 189 + 1e-6), `Expected blast damage in (165, 189], got ${fpsSamples}`);
 }
});

test('Blast damages exposed enemies, surfaced subs, miniboss and living boss parts without duplicate death or hitting broken parts', () => {
 const world = liveWorld(0);
 world.player.x = 384;
 world.player.y = 350;
 const blastX = 384;
 const blastY = 350 - 280 * 0.65;

 world.spawnEncounter({ family: 'fighter', formation: 'pair', motion: 'stationary', lane: 0.5 });
 const nearFighter = world.enemies[0];
 nearFighter.x = blastX + 40;
 nearFighter.y = blastY;
 nearFighter.hp = 2;

 const farFighter = world.enemies[1];
 farFighter.x = 205;
 farFighter.y = 405;
 farFighter.hp = 10;

 world.enemies.push({
  id: 9001, x: blastX - 20, y: blastY, size: 54, hp: 50, maxHp: 50, age: 0.1, flash: 0,
  family: 'submarine', motion: 'stationary', lane: 0.5, offset: 0, speed: 0, cooldown: 9, warning: 0, ground: true,
  submarine: { phase: 'emerge', exposure: 0.3, side: -1 },
  navigation: { worldY: blastY, heading: Math.PI / 2, entry: 0, phase: 'hold' },
 });
 world.enemies.push({
  id: 9002, x: blastX + 20, y: blastY, size: 54, hp: 50, maxHp: 50, age: 3, flash: 0,
  family: 'submarine', motion: 'stationary', lane: 0.5, offset: 0, speed: 0, cooldown: 9, warning: 0, ground: true,
  submarine: { phase: 'hold', exposure: 1, side: 1 },
  navigation: { worldY: blastY, heading: Math.PI / 2, entry: 0, phase: 'hold' },
 });

 // Multi-part boss (Colossal Submarine active section) in active fight with one part already destroyed.
 world.startBoss(false);
 world.boss.sub.phase = 'fight';
 world.boss.sub.anchorY = blastY - 10;
 world.boss.x = blastX;
 world.updateBoss(0);
 const sec0 = world.boss.sub.sections[0];
 sec0.parts[0].hp = 0;
 const part1InitialHp = sec0.parts[1].hp;
 const sec1HullBefore = world.boss.sub.sections[1].hullHp;
 const initialScoresBefore = world.score;

 // Invulnerable boss check during entry transition.
 world.boss.sub.phase = 'enter';
 world.bomb = { id: 777, x: blastX, y: blastY, age: 0.64, phase: 'flight', radius: 0 };
 world.specialTime = 2.11;
 world.applySpecial(0.05);
 assert.equal(sec0.parts[1].hp, part1InitialHp, 'Boss parts must not take bomb damage outside fight phase');

 // Active fight phase: living parts and active hull take capped bomb damage, broken part stays at 0, next section untouched.
 world.boss.sub.phase = 'fight';
 world.boss.phase = 'fight';
 const killsBefore = world.kills;
 for (let i = 0; i < 40; i++) {
  world.enemies.forEach(e => {
   if (e.id === 9001 || e.id === 9002) { e.x = blastX + (e.id === 9001 ? -20 : 20); e.y = blastY; }
  });
  world.applySpecial(0.05);
 }

 assert.equal(nearFighter.hp, 0);
 assert.equal(farFighter.hp, 10, 'Out-of-radius enemy stays untouched');
 assert.equal(world.enemies.find(e => e.id === 9001).hp, 50, 'Submerged sub stays protected');
 assert.equal(world.enemies.find(e => e.id === 9002).hp, 0, 'Surfaced sub takes full blast damage and is destroyed');
 assert.equal(sec0.parts[0].hp, 0, 'Destroyed boss part never goes negative');
 assert.ok(sec0.parts[1].hp < part1InitialHp && sec0.parts[2].hp < sec0.parts[2].maxHp, 'Living active section parts take capped blast damage');
 assert.ok(sec0.hullHp < sec0.hullMaxHp, 'Active section hull takes capped bomb damage');
 assert.equal(world.boss.sub.sections[1].hullHp, sec1HullBefore, 'Next submarine section remains completely untouched');
 assert.ok((world.boss.flash ?? 0) > 0, 'Boss hull flashes on bomb blast hit');
 assert.equal(world.kills - killsBefore, 2, 'Exactly two enemies died, with zero duplicate kill credit');
 assert.ok(world.score > initialScoresBefore);

 // Miniboss parts also take blast damage during fight (Cidade Solar).
 const miniWorld = liveWorld(1);
 miniWorld.startBoss(true);
 miniWorld.boss.phase = 'fight';
 miniWorld.boss.x = 460;
 miniWorld.boss.y = 216;
 miniWorld.boss.parts.forEach(p => { p.x = 460 + p.dx; p.y = 216 + p.dy; });
 miniWorld.bomb = { id: 778, x: 460, y: 216, age: 0.65, phase: 'blast', radius: 155 };
 miniWorld.specialTime = 2.1;
 miniWorld.applySpecial(0.5);
 assert.ok(miniWorld.boss.parts.every(p => p.hp < p.maxHp));

 // Tide Arch cannons and boats on Fenda Pelagica also take blast damage during special.
 const archWorld = liveWorld(0);
 archWorld.devJumpTideArch('low-flight', true);
 assert.ok(archWorld.enemies.length > 0);
 const archTarget = archWorld.enemies[0];
 const hpBeforeBlast = archTarget.hp;
 archWorld.bomb = { id: 779, x: archTarget.x, y: archTarget.y, age: 0.65, phase: 'blast', radius: 165 };
 archWorld.specialTime = 2.1;
 archWorld.applySpecial(0.5);
 assert.ok(archTarget.hp < hpBeforeBlast, 'Tide Arch enemies take Special blast damage');
});

test('Player stays invulnerable for the whole special and hostile bullets inside radius are cleared while friendly shots survive', () => {
 const world = liveWorld(0);
 world.weapons.weaponLevel = 4;
 world.step(1 / 60, { x: 0, y: 0, fire: false, special: true });
 const enemy = world.enemies;
 enemy.push({
  id: 8001, x: world.player.x, y: world.player.y, size: 40, hp: 20, maxHp: 20, age: 1, flash: 0,
  family: 'fighter', motion: 'stationary', lane: 0.5, offset: 0, speed: 0, cooldown: 9, warning: 0, ground: false,
 });
 // Direct contact bullet + body collision during flight phase must not hurt player.
 world.bullet(world.player.x, world.player.y, 0, 100, 1, 4, true);
 world.step(1 / 60, { x: 0, y: 0, fire: true, special: false });
 assert.equal(world.lives, 3);
 assert.equal(world.weapons.weaponLevel, 4);

 // Advance to peak blast and spawn hostile bullets both inside and far outside blast radius plus friendly shot.
 for (let i = 0; i < 65; i++) world.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
 assert.equal(world.bomb?.phase, 'blast');
 world.bullet(world.bomb.x + 25, world.bomb.y, 0, 80, 1, 4, true);
 world.bullet(205, 405, 0, 0, 1, 4, true);
 world.bullet(world.player.x, world.player.y - 20, 0, -400, 2, 3.6, false);
 world.step(1 / 60, { x: 0, y: 0, fire: false, special: false });

 const activeHostile = world.bullets.filter(b => b.active && b.enemy);
 const activeFriendly = world.bullets.filter(b => b.active && !b.enemy);
 assert.equal(activeHostile.length, 1, 'Only hostile bullet outside blast radius remains');
 assert.equal(activeFriendly.length, 1, 'Friendly shot inside arena is not cleared by special');
});
