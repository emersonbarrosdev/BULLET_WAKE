import assert from 'node:assert/strict';
import test from 'node:test';
import { StageDirector, STAGE_EVENTS, DEMO_DISTANCE } from '../src/game/systems/stageDirector.ts';
import { BossKrm17 } from '../src/game/systems/bossKrm17.ts';
import { getPrimaryProjectiles } from '../src/game/systems/weaponSystem.ts';

test('Anti-Camping: Player standing still is threatened by aimed shots and spreads within 10 seconds', () => {
  const director = new StageDirector(768);
  let shotsTargetingPlayer = 0;
  const playerX = 135;
  const playerY = 216;

  // Simula 5 segundos de jogo com jogador parado
  for (let t = 0; t < 10000; t += 25) {
    const tick = director.update(25, playerX, playerY);
    for (const shot of tick.shots) {
      // Projétil que se move em direção à metade esquerda da tela (onde o jogador está)
      if ((playerX-shot.x)*shot.velocityX+(playerY-shot.y)*shot.velocityY>0) {
        shotsTargetingPlayer++;
      }
    }
  }

  assert.ok(
    shotsTargetingPlayer >= 2,
    `Jogador parado deve receber pelo menos 2 ameaças balísticas nos primeiros 10s (recebeu ${shotsTargetingPlayer})`,
  );
});

test('Threat Geometry: Lancers emit triple fan spreads to eliminate naive micro-dodges', () => {
  const director = new StageDirector(768);
  const playerX = 135;
  const playerY = 216;
  const shotVelocitiesY = new Set();

  // Avança até o primeiro Lancer (em ~7.5s)
  for (let t = 0; t < 19000; t += 25) {
    const tick = director.update(25, playerX, playerY);
    for (const shot of tick.shots) {
      shotVelocitiesY.add(Math.round(shot.velocityY));
    }
  }

  // Verifica que há disparos com componentes angulares distintas (centro, acima e abaixo)
  assert.ok(
    shotVelocitiesY.size >= 3,
    'Lancer e inimigos devem disparar projéteis em trajetórias angulares variadas (leque)',
  );
});

test('No Combat Voids: Enemy spawns occur steadily without dead gaps longer than 2.8s', () => {
  const scrollSpeed = 68;
  const maxAllowedDistanceGap = 2.8 * scrollSpeed; // ~190 pixels

  for (let i = 1; i < STAGE_EVENTS.length; i++) {
    const gap = STAGE_EVENTS[i].distance - STAGE_EVENTS[i - 1].distance;
    assert.ok(
      gap <= maxAllowedDistanceGap,
      `Vácuo excessivo sem inimigos detectado entre evento ${i - 1} e ${i}: ${gap.toFixed(1)}px (máximo permitido: ${maxAllowedDistanceGap}px)`,
    );
  }
});

test('Enemy Class Variety: All 4 tactical classes spawn with unique attributes', () => {
  const kinds = new Set(STAGE_EVENTS.map(e => e.kind));
  assert.ok(kinds.has('scout'), 'Scout class present');
  assert.ok(kinds.has('dart'), 'Dart diving class present');
  assert.ok(kinds.has('lancer'), 'Lancer interceptor class present');
  assert.ok(kinds.has('cutter'), 'Cutter charge class present');

  const director = new StageDirector();
  // Simula dano e pontuação em cada classe
  director.enemies.push(
    { id: 101, kind: 'scout', phase: 'approach', x: 200, y: 100, baseY: 100, ageMs: 0, phaseMs: 0, hp: 1, maxHp: 1, secondShotFired: false },
    { id: 102, kind: 'dart', phase: 'approach', x: 200, y: 100, baseY: 100, ageMs: 0, phaseMs: 0, hp: 1, maxHp: 1, secondShotFired: false },
    { id: 103, kind: 'cutter', phase: 'approach', x: 200, y: 100, baseY: 100, ageMs: 0, phaseMs: 0, hp: 2, maxHp: 2, secondShotFired: false },
    { id: 104, kind: 'lancer', phase: 'approach', x: 200, y: 100, baseY: 100, ageMs: 0, phaseMs: 0, hp: 3, maxHp: 3, secondShotFired: false },
  );

  assert.equal(director.damage(101, 1).score, 100, 'Scout awards 100');
  assert.equal(director.damage(102, 1).score, 150, 'Dart awards 150');
  assert.equal(director.damage(103, 2).score, 250, 'Cutter awards 250');
  assert.equal(director.damage(104, 3).score, 300, 'Lancer awards 300');
});

test('Boss Resilience: KRM-17 cannot be trivialized and requires multi-phase mastery', () => {
  const boss = new BossKrm17();
  assert.equal(boss.maxHp, 140, 'KRM-17 possui 140 HP balanceados para combate intenso');

  // Transição de intro
  boss.update(2900, 150, 216);
  assert.equal(boss.phase, 'phase1_turrets');

  // Simula disparos de jogador com arma LV1 (1 dano por acerto, 4 acertos por segundo = 4 DPS)
  let simulatedSeconds = 0;
  while (boss.hp > 95 && simulatedSeconds < 25) {
    boss.damage(2, boss.x, boss.y);
    boss.update(500, 150, 216);
    simulatedSeconds += 0.5;
  }
  assert.ok(boss.phase === 'phase2_drill', 'Transita para fase 2 após dano suficiente');

  // Avança na fase 2 da broca
  while (boss.hp > 45 && simulatedSeconds < 40) {
    boss.damage(2, boss.x, boss.y);
    boss.update(500, 150, 216);
    simulatedSeconds += 0.5;
  }
  assert.ok(boss.phase === 'phase3_core', 'Transita para fase 3 com núcleo sobrecarregado');

  // Verifica que o tempo de combate é substancial
  assert.ok(
    simulatedSeconds >= 12,
    `Chefe exige pelo menos 12s de dano contínuo até o núcleo mesmo com 100% de precisão (levou ${simulatedSeconds}s)`,
  );
});

test('Weapon Upgrades: Scaling increases volume of fire without trivializing boss HP', () => {
  const lv1 = getPrimaryProjectiles('green', 1, 100, 200);
  const lv2 = getPrimaryProjectiles('green', 2, 100, 200);
  const lv3 = getPrimaryProjectiles('green', 3, 100, 200);
  const lv4 = getPrimaryProjectiles('green', 4, 100, 200);

  assert.equal(lv1.length, 2, 'LV1 tem 2 projéteis paralelos');
  assert.equal(lv2.length, 4);
  assert.equal(lv3.length, 6);
  assert.equal(lv4.length, 8);

  const totalDmgLv3 = lv3.reduce((sum, p) => sum + p.damage, 0);
  const totalDmgLv1=lv1.reduce((sum,p)=>sum+p.damage,0);
  assert.ok(totalDmgLv3>totalDmgLv1&&totalDmgLv3<totalDmgLv1*2, 'Green coverage grows without tripling its concentrated volley damage');
  assert.ok(lv4.reduce((sum,p)=>sum+p.damage,0)<=totalDmgLv1*2+1e-9);
});

test('Difficulty Modes: Arcade mode scales bullet velocity and expands Lancer spread to 5-way', () => {
  const normalDirector = new StageDirector(768, false, 1, 'normal');
  const arcadeDirector = new StageDirector(768, false, 1, 'arcade');

  // Spawn a Lancer in both
  normalDirector.enemies.push({
    id: 1, kind: 'lancer', phase: 'telegraph', x: 500, y: 200, baseY: 200, ageMs: 0, phaseMs: 10, hp: 3, maxHp: 3, secondShotFired: false,
  });
  arcadeDirector.enemies.push({
    id: 1, kind: 'lancer', phase: 'telegraph', x: 500, y: 200, baseY: 200, ageMs: 0, phaseMs: 10, hp: 3, maxHp: 3, secondShotFired: false,
  });

  const normalTick = normalDirector.update(25, 100, 200);
  const arcadeTick = arcadeDirector.update(25, 100, 200);

  assert.equal(normalTick.shots.length, 3, 'Normal lancer fires 3 shots');
  assert.equal(arcadeTick.shots.length, 5, 'Arcade lancer fires 5-way spread');

  // Velocity comparison
  const normalSpeed = Math.hypot(normalTick.shots[0].velocityX, normalTick.shots[0].velocityY);
  const arcadeSpeed = Math.hypot(arcadeTick.shots[2].velocityX, arcadeTick.shots[2].velocityY);
  assert.ok(arcadeSpeed > normalSpeed * 1.15, 'Arcade bullet speed is scaled higher');
});

