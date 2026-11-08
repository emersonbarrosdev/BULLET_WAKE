/**
 * Diretor da fase com progressão contínua e roteiro cinematográfico do BULLET WAKE.
 *
 * Sem rounds, ondas repetitivas em arena fechada:
 * eventos únicos e composições táticas disparados pela distância percorrida pelo cenário.
 * Simulação pura desacoplada do motor de renderização.
 */
import type { BossTick, StageBoss } from './bosses/types.ts';
import { createStageBoss } from './bosses/factory.ts';
import { MinibossRaiaDente } from './bosses/minibossRaiaDente.ts';
import { PLAYFIELD_X, PLAYFIELD_WIDTH, PLAYFIELD_RIGHT } from '../constants.ts';

export type EnemyKind = 'scout' | 'dart' | 'lancer' | 'cutter';
export type EnemyPhase = 'approach' | 'telegraph' | 'attack' | 'recover' | 'exit';
export type SectorId = 'evacuacao' | 'destrocos' | 'industria' | 'aproximacao';
export type DifficultyMode = 'normal' | 'hard' | 'arcade';

export interface EnemyModel {
  id: number;
  kind: EnemyKind;
  phase: EnemyPhase;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  ageMs: number;
  phaseMs: number;
  hp: number;
  maxHp: number;
  secondShotFired: boolean;
}

export interface EnemyShotEvent {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface StageTick {
  spawned: EnemyModel[];
  shots: EnemyShotEvent[];
  scrollPx: number;
  progress: number;
  sector: SectorId;
  sectorChanged: boolean;
  completed: boolean;
  bossTick?: BossTick;
  bossActive?: boolean;
}

export const SCROLL_SPEED = 68; // pixels lógicos/s (cenário permanece avançando)
export const DEMO_DISTANCE = 4250; // distância total até a arena do chefe

// Roteiro por posição percorrida. Combinações táticas de passagem contínua.
// Nenhum evento reaparece como round de arena.
export const STAGE_EVENTS: readonly { distance: number; kind: EnemyKind; y: number }[] = [
  // --- SETOR 1: EVACUAÇÃO (0m - 1000m) ---
  { distance: 125, kind: 'scout', y: 125 },
  { distance: 210, kind: 'scout', y: 180 },
  { distance: 295, kind: 'scout', y: 235 },
  { distance: 380, kind: 'dart', y: 80 },
  { distance: 490, kind: 'lancer', y: 190 },
  { distance: 590, kind: 'scout', y: 110 },
  { distance: 650, kind: 'scout', y: 160 },
  { distance: 710, kind: 'scout', y: 210 },
  { distance: 810, kind: 'dart', y: 310 },
  { distance: 920, kind: 'lancer', y: 260 },

  // --- SETOR 2: DESTROÇOS (1000m - 2100m) ---
  { distance: 1050, kind: 'cutter', y: 180 },
  { distance: 1160, kind: 'scout', y: 270 },
  { distance: 1220, kind: 'scout', y: 210 },
  { distance: 1280, kind: 'scout', y: 150 },
  { distance: 1390, kind: 'dart', y: 95 },
  { distance: 1480, kind: 'lancer', y: 160 },
  { distance: 1590, kind: 'cutter', y: 260 },
  { distance: 1700, kind: 'scout', y: 120 },
  { distance: 1760, kind: 'scout', y: 280 },
  { distance: 1870, kind: 'lancer', y: 220 },
  { distance: 1980, kind: 'dart', y: 290 },
  { distance: 2070, kind: 'cutter', y: 170 },

  // --- SETOR 3: INDÚSTRIA (2100m - 3200m) ---
  { distance: 2180, kind: 'lancer', y: 140 },
  { distance: 2260, kind: 'lancer', y: 260 },
  { distance: 2380, kind: 'dart', y: 85 },
  { distance: 2450, kind: 'dart', y: 315 },
  { distance: 2580, kind: 'scout', y: 120 },
  { distance: 2640, kind: 'scout', y: 170 },
  { distance: 2700, kind: 'scout', y: 220 },
  { distance: 2820, kind: 'cutter', y: 220 },
  { distance: 2930, kind: 'lancer', y: 180 },
  { distance: 3050, kind: 'dart', y: 110 },
  { distance: 3140, kind: 'cutter', y: 270 },

  // --- SETOR 4: APROXIMAÇÃO DO CHEFE (3200m - 4250m) ---
  { distance: 3260, kind: 'cutter', y: 140 },
  { distance: 3330, kind: 'cutter', y: 260 },
  { distance: 3460, kind: 'lancer', y: 210 },
  { distance: 3560, kind: 'dart', y: 95 },
  { distance: 3640, kind: 'dart', y: 285 },
  { distance: 3760, kind: 'scout', y: 150 },
  { distance: 3820, kind: 'scout', y: 210 },
  { distance: 3940, kind: 'lancer', y: 170 },
  { distance: 4050, kind: 'cutter', y: 216 },
];

const SPEED: Readonly<Record<EnemyKind, number>> = {
  scout: 165,
  dart: 235,
  lancer: 115,
  cutter: 135,
};

const CHARGE_MS: Readonly<Record<EnemyKind, number>> = {
  scout: 420,
  dart: 260,
  lancer: 620,
  cutter: 450,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export function getSector(distancePx: number): SectorId {
  if (distancePx < 1000) return 'evacuacao';
  if (distancePx < 2100) return 'destrocos';
  if (distancePx < 3200) return 'industria';
  return 'aproximacao';
}

export class StageDirector {
  readonly enemies: EnemyModel[] = [];
  boss: StageBoss | null = null;
  scrollPx = 0;
  minibossSpawned = false;
  minibossActive = false;
  private eventIndex = 0;
  private nextId = 1;
  private currentSector: SectorId = 'evacuacao';
  private readonly enableBoss: boolean;
  readonly stageNumber: number;
  readonly difficulty: DifficultyMode;

  constructor(_viewportWidth = 768, enableBoss = false, stageNumber = 1, difficulty: DifficultyMode = 'normal') {
    this.enableBoss = enableBoss;
    this.stageNumber = stageNumber;
    this.difficulty = difficulty;
  }

  update(deltaMs: number, playerX: number, playerY: number): StageTick {
    const dt = clamp(deltaMs, 0, 50);
    if (!this.boss) {
      this.scrollPx += (SCROLL_SPEED * dt) / 1000;
    } else {
      this.scrollPx += (SCROLL_SPEED * 0.25 * dt) / 1000;
    }

    const sector = getSector(this.scrollPx);
    const sectorChanged = sector !== this.currentSector;
    this.currentSector = sector;
    const spawned: EnemyModel[] = [];
    const shots: EnemyShotEvent[] = [];

    // 1. Spawna Miniboss Raia-Dente na metade da fase 1 (~1800m)
    if (this.enableBoss && this.stageNumber === 1 && this.scrollPx >= 1800 && !this.minibossSpawned && !this.boss) {
      this.boss = new MinibossRaiaDente();
      this.minibossSpawned = true;
      this.minibossActive = true;
    }

    // Se o miniboss foi derrotado, limpa-o e permite que a fase avance até o chefe colossal
    if (this.boss && this.minibossActive && this.boss.phase === 'defeated') {
      this.minibossActive = false;
      this.boss = null;
    }

    // 2. Spawna chefe final da fase ao atingir a distância final
    if (this.enableBoss && this.scrollPx >= DEMO_DISTANCE && !this.boss && !this.minibossActive && this.enemies.length === 0) {
      this.boss = createStageBoss(this.stageNumber);
    }

    let bossTick: BossTick | undefined;
    if (this.boss) {
      bossTick = this.boss.update(dt, playerX, playerY);
      for (const shot of bossTick.shots) {
        shots.push({
          x: shot.x,
          y: shot.y,
          velocityX: shot.velocityX,
          velocityY: shot.velocityY,
        });
      }
      for (const sp of bossTick.spawns) {
        const drone: EnemyModel = {
          id: this.nextId++,
          kind: sp.kind,
          phase: 'approach',
          x: sp.x,
          y: sp.y,
          baseX: sp.x,
          baseY: sp.y,
          ageMs: 0,
          phaseMs: 0,
          hp: 1,
          maxHp: 1,
          secondShotFired: false,
        };
        this.enemies.push(drone);
        spawned.push(drone);
      }
    }

    while (
      this.eventIndex < STAGE_EVENTS.length &&
      this.scrollPx >= STAGE_EVENTS[this.eventIndex].distance
    ) {
      const event = STAGE_EVENTS[this.eventIndex++];
      const hp = event.kind === 'lancer' ? 3 : event.kind === 'cutter' ? 2 : 1;
      // Distribui a coordenada X ao longo do corredor central (PLAYFIELD_X até PLAYFIELD_RIGHT)
      const eventX = PLAYFIELD_X + 28 + ((event.y - 80) / 235) * (PLAYFIELD_WIDTH - 56);
      const enemy: EnemyModel = {
        id: this.nextId++,
        kind: event.kind,
        phase: 'approach',
        x: eventX,
        y: -35,
        baseX: eventX,
        baseY: event.y,
        ageMs: 0,
        phaseMs: 0,
        hp,
        maxHp: hp,
        secondShotFired: false,
      };
      this.enemies.push(enemy);
      spawned.push(enemy);
    }

    const bulletSpeedMult = this.difficulty === 'arcade' ? 1.22 : this.difficulty === 'hard' ? 1.12 : 1.0;
    const chargeMult = this.difficulty === 'arcade' ? 0.78 : this.difficulty === 'hard' ? 0.88 : 1.0;

    for (const enemy of this.enemies) {
      enemy.ageMs += dt;
      const speed = SPEED[enemy.kind];

      switch (enemy.kind) {
        case 'scout': {
          switch (enemy.phase) {
            case 'approach':
              enemy.y += (speed * dt) / 1000;
              enemy.x = clamp(enemy.baseX + Math.sin(enemy.ageMs / 220) * 28, PLAYFIELD_X + 24, PLAYFIELD_RIGHT - 24);
              if (enemy.y >= 90) {
                enemy.phase = 'telegraph';
                enemy.phaseMs = Math.round(CHARGE_MS.scout * chargeMult);
              }
              break;
            case 'telegraph':
              enemy.y += (speed * 0.35 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) {
                enemy.phase = 'attack';
                enemy.phaseMs = 220;
                shots.push(this.aim(enemy, playerX, playerY, 225 * bulletSpeedMult));
              }
              break;
            case 'attack':
              enemy.y += (speed * 0.5 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) {
                enemy.phase = 'recover';
                enemy.phaseMs = 180;
              }
              break;
            case 'recover':
              enemy.y += (speed * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) enemy.phase = 'exit';
              break;
            case 'exit':
              enemy.y += (speed * 1.6 * dt) / 1000;
              enemy.x += ((enemy.baseX < (PLAYFIELD_X + PLAYFIELD_WIDTH / 2) ? -40 : 40) * dt) / 1000;
              break;
          }
          break;
        }

        case 'dart': {
          const dirX = enemy.baseX < (PLAYFIELD_X + PLAYFIELD_WIDTH / 2) ? 1 : -1;
          switch (enemy.phase) {
            case 'approach':
              enemy.y += (speed * dt) / 1000;
              enemy.x = clamp(enemy.x + (dirX * 60 * dt) / 1000, PLAYFIELD_X + 20, PLAYFIELD_RIGHT - 20);
              if (enemy.y >= 85) {
                enemy.phase = 'telegraph';
                enemy.phaseMs = Math.round(CHARGE_MS.dart * chargeMult);
              }
              break;
            case 'telegraph':
              enemy.y += (speed * 0.5 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) {
                enemy.phase = 'attack';
                enemy.phaseMs = 200;
                shots.push(this.aim(enemy, playerX, playerY, 235 * bulletSpeedMult, -0.16));
                shots.push(this.aim(enemy, playerX, playerY, 235 * bulletSpeedMult, 0.16));
              }
              break;
            case 'attack':
              enemy.y += (speed * 1.1 * dt) / 1000;
              enemy.x += (dirX * 45 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) {
                enemy.phase = 'recover';
                enemy.phaseMs = 150;
              }
              break;
            case 'recover':
              enemy.y += (speed * 1.3 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) enemy.phase = 'exit';
              break;
            case 'exit':
              enemy.y += (speed * 1.8 * dt) / 1000;
              enemy.x += (dirX * 50 * dt) / 1000;
              break;
          }
          break;
        }

        case 'lancer': {
          switch (enemy.phase) {
            case 'approach':
              enemy.y += (speed * dt) / 1000;
              enemy.x += clamp(playerX - enemy.x, (-65 * dt) / 1000, (65 * dt) / 1000);
              enemy.x = clamp(enemy.x, PLAYFIELD_X + 24, PLAYFIELD_RIGHT - 24);
              if (enemy.y >= 95) {
                enemy.phase = 'telegraph';
                enemy.phaseMs = Math.round(CHARGE_MS.lancer * chargeMult);
              }
              break;
            case 'telegraph':
              enemy.y += (speed * 0.3 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) {
                enemy.phase = 'attack';
                enemy.phaseMs = 450;
                if (this.difficulty === 'arcade') {
                  // Leque quíntuplo no modo Arcade
                  for (const ang of [-0.38, -0.19, 0, 0.19, 0.38]) {
                    shots.push(this.aim(enemy, playerX, playerY, 215 * bulletSpeedMult, ang));
                  }
                } else {
                  // Leque triplo de contenção
                  shots.push(this.aim(enemy, playerX, playerY, 215 * bulletSpeedMult, 0));
                  shots.push(this.aim(enemy, playerX, playerY, 215 * bulletSpeedMult, -0.28));
                  shots.push(this.aim(enemy, playerX, playerY, 215 * bulletSpeedMult, 0.28));
                }
              }
              break;
            case 'attack':
              enemy.y += (speed * 0.4 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (!enemy.secondShotFired && enemy.phaseMs <= 200) {
                enemy.secondShotFired = true;
                shots.push(this.aim(enemy, playerX, playerY, 225 * bulletSpeedMult, 0));
              }
              if (enemy.phaseMs <= 0) {
                enemy.phase = 'recover';
                enemy.phaseMs = 280;
              }
              break;
            case 'recover':
              enemy.y += (speed * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) enemy.phase = 'exit';
              break;
            case 'exit':
              enemy.y += (speed * 1.5 * dt) / 1000;
              break;
          }
          break;
        }

        case 'cutter': {
          switch (enemy.phase) {
            case 'approach':
              enemy.y += (speed * dt) / 1000;
              enemy.x += clamp(playerX - enemy.x, (-80 * dt) / 1000, (80 * dt) / 1000);
              enemy.x = clamp(enemy.y, PLAYFIELD_X + 28, PLAYFIELD_RIGHT - 28);
              if (enemy.y >= 105) {
                enemy.phase = 'telegraph';
                enemy.phaseMs = Math.round(CHARGE_MS.cutter * chargeMult);
              }
              break;
            case 'telegraph':
              enemy.y += (speed * 0.2 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) {
                enemy.phase = 'attack';
                enemy.phaseMs = 550;
                // Disparo de fagulhas laterais no início da investida
                shots.push({ x: enemy.x - 16, y: enemy.y + 12, velocityX: -60 * bulletSpeedMult, velocityY: 180 * bulletSpeedMult });
                shots.push({ x: enemy.x + 16, y: enemy.y + 12, velocityX: 60 * bulletSpeedMult, velocityY: 180 * bulletSpeedMult });
              }
              break;
            case 'attack':
              // Investida veloz para frente cortando a rota vertical
              const chargeSpeed = this.difficulty === 'arcade' ? 340 : this.difficulty === 'hard' ? 325 : 310;
              enemy.y += (chargeSpeed * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) {
                enemy.phase = 'recover';
                enemy.phaseMs = 300;
              }
              break;
            case 'recover':
              enemy.y += (speed * 0.6 * dt) / 1000;
              enemy.phaseMs -= dt;
              if (enemy.phaseMs <= 0) enemy.phase = 'exit';
              break;
            case 'exit':
              enemy.y += (speed * 1.6 * dt) / 1000;
              break;
          }
          break;
        }
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].y > 480 || this.enemies[i].y < -90) this.enemies.splice(i, 1);
    }

    const isCompleted = this.enableBoss
      ? Boolean(this.boss !== null && !this.minibossActive && this.boss.phase === 'defeated')
      : Boolean(this.scrollPx >= DEMO_DISTANCE && this.enemies.length === 0);

    return {
      spawned,
      shots,
      scrollPx: this.scrollPx,
      progress: clamp(this.scrollPx / DEMO_DISTANCE, 0, 1),
      sector,
      sectorChanged,
      completed: isCompleted,
      bossTick,
      bossActive: Boolean(this.boss && this.boss.phase !== 'defeated'),
    };
  }

  damage(id: number, amount: number): { killed: boolean; score: number } {
    const index = this.enemies.findIndex(enemy => enemy.id === id);
    if (index === -1) return { killed: false, score: 0 };
    const enemy = this.enemies[index];
    enemy.hp = Math.max(0, enemy.hp - Math.max(0, amount));
    if (enemy.hp > 0) return { killed: false, score: 0 };
    this.enemies.splice(index, 1);
    const scoreMap: Record<EnemyKind, number> = {
      scout: 100,
      dart: 150,
      cutter: 250,
      lancer: 300,
    };
    return { killed: true, score: scoreMap[enemy.kind] || 100 };
  }

  damageBoss(amount: number, hitX: number, hitY: number) {
    if (!this.boss) return { bossDamage: 0, moduleDestroyed: null, killed: false };
    return this.boss.damage(amount, hitX, hitY);
  }

  remove(id: number): void {
    const index = this.enemies.findIndex(enemy => enemy.id === id);
    if (index >= 0) this.enemies.splice(index, 1);
  }

  private aim(enemy: EnemyModel, x: number, y: number, speed: number, angleOffsetRad = 0): EnemyShotEvent {
    const dx = x - enemy.x;
    const dy = y - enemy.y;
    const baseAngle = Math.atan2(dy, dx);
    const finalAngle = baseAngle + angleOffsetRad;
    return {
      x: enemy.x,
      y: enemy.y + 16,
      velocityX: speed * Math.cos(finalAngle),
      velocityY: speed * Math.sin(finalAngle),
    };
  }
}
