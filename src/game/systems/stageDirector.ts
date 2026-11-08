/**
 * Diretor do primeiro trecho da fase Cinturão de Ferrugem.
 *
 * Sem rounds, ondas recorrentes, contagem regressiva ou arena fechada:
 * eventos únicos são disparados pela distância percorrida pelo cenário.
 * Simulação pura, sem dependência de Phaser ou DOM.
 */
import type { BossTick, StageBoss } from './bosses/types.ts';
import { createStageBoss } from './bosses/factory.ts';

export type EnemyKind = 'scout' | 'lancer';
export type EnemyPhase = 'approach' | 'telegraph' | 'attack' | 'recover' | 'exit';
export type SectorId = 'evacuacao' | 'destrocos' | 'industria' | 'aproximacao';

export interface EnemyModel {
  id: number;
  kind: EnemyKind;
  phase: EnemyPhase;
  x: number;
  y: number;
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
export const DEMO_DISTANCE = 4250; // cerca de um minuto de trecho roteirizado
const SPAWN_X_PADDING = 42;

// Roteiro por posição percorrida. Pares e trios são formações de passagem,
// NÃO ondas em arena. Nenhum evento reaparece automaticamente.
export const STAGE_EVENTS: readonly { distance: number; kind: EnemyKind; y: number }[] = [
  { distance: 125, kind: 'scout', y: 130 },
  { distance: 210, kind: 'scout', y: 210 },
  { distance: 295, kind: 'scout', y: 285 },
  { distance: 490, kind: 'lancer', y: 175 },
  { distance: 630, kind: 'scout', y: 112 },
  { distance: 695, kind: 'scout', y: 152 },
  { distance: 760, kind: 'scout', y: 195 },
  { distance: 960, kind: 'lancer', y: 280 },
  { distance: 1100, kind: 'scout', y: 268 },
  { distance: 1170, kind: 'scout', y: 205 },
  { distance: 1240, kind: 'scout', y: 142 },
  { distance: 1400, kind: 'lancer', y: 135 },
  { distance: 1540, kind: 'scout', y: 112 },
  { distance: 1630, kind: 'scout', y: 278 },
  { distance: 1800, kind: 'lancer', y: 232 },
  { distance: 1990, kind: 'scout', y: 166 },
  { distance: 2055, kind: 'scout', y: 210 },
  { distance: 2120, kind: 'scout', y: 254 },
  { distance: 2290, kind: 'lancer', y: 150 },
  { distance: 2420, kind: 'scout', y: 275 },
  { distance: 2480, kind: 'scout', y: 228 },
  { distance: 2670, kind: 'lancer', y: 290 },
  { distance: 2870, kind: 'scout', y: 122 },
  { distance: 2940, kind: 'scout', y: 174 },
  { distance: 3100, kind: 'lancer', y: 170 },
  { distance: 3240, kind: 'scout', y: 275 },
  { distance: 3300, kind: 'scout', y: 230 },
  { distance: 3360, kind: 'scout', y: 185 },
  { distance: 3520, kind: 'lancer', y: 240 },
  { distance: 3690, kind: 'scout', y: 140 },
  { distance: 3760, kind: 'scout', y: 190 },
  { distance: 3850, kind: 'lancer', y: 267 },
];

const SPEED: Readonly<Record<EnemyKind, number>> = { scout: 146, lancer: 98 };
const CHARGE_MS: Readonly<Record<EnemyKind, number>> = { scout: 650, lancer: 950 };
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
  private eventIndex = 0;
  private nextId = 1;
  private currentSector: SectorId = 'evacuacao';
  private readonly viewportWidth: number;
  private readonly enableBoss: boolean;
  readonly stageNumber: number;

  constructor(viewportWidth = 768, enableBoss = false, stageNumber = 1) {
    this.viewportWidth = viewportWidth;
    this.enableBoss = enableBoss;
    this.stageNumber = stageNumber;
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

    // Spawna chefe correspondente à fase se habilitado e ao atingir a distância final
    if (this.enableBoss && this.scrollPx >= DEMO_DISTANCE && !this.boss && this.enemies.length === 0) {
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

    while (this.eventIndex < STAGE_EVENTS.length
      && this.scrollPx >= STAGE_EVENTS[this.eventIndex].distance) {
      const event = STAGE_EVENTS[this.eventIndex++];
      const enemy: EnemyModel = {
        id: this.nextId++,
        kind: event.kind,
        phase: 'approach',
        x: this.viewportWidth + SPAWN_X_PADDING,
        y: event.y,
        baseY: event.y,
        ageMs: 0,
        phaseMs: 0,
        hp: event.kind === 'scout' ? 1 : 3,
        maxHp: event.kind === 'scout' ? 1 : 3,
        secondShotFired: false,
      };
      this.enemies.push(enemy);
      spawned.push(enemy);
    }

    for (const enemy of this.enemies) {
      enemy.ageMs += dt;
      const speed = SPEED[enemy.kind];
      switch (enemy.phase) {
        case 'approach':
          enemy.x -= speed * dt / 1000;
          if (enemy.kind === 'scout') {
            enemy.y = clamp(enemy.baseY + Math.sin(enemy.ageMs / 280) * 23, 96, 320);
          } else {
            enemy.y += clamp(playerY - enemy.y, -37 * dt / 1000, 37 * dt / 1000);
            enemy.y = clamp(enemy.y, 96, 320);
          }
          if (enemy.x <= this.viewportWidth * (enemy.kind === 'scout' ? 0.74 : 0.79)) {
            enemy.phase = 'telegraph';
            enemy.phaseMs = CHARGE_MS[enemy.kind];
          }
          break;
        case 'telegraph':
          enemy.x -= speed * 0.32 * dt / 1000;
          enemy.phaseMs -= dt;
          if (enemy.phaseMs <= 0) {
            enemy.phase = 'attack';
            enemy.phaseMs = enemy.kind === 'scout' ? 240 : 500;
            shots.push(this.aim(enemy, playerX, playerY, enemy.kind === 'scout' ? 180 : 190));
          }
          break;
        case 'attack':
          enemy.x -= speed * 0.48 * dt / 1000;
          enemy.phaseMs -= dt;
          if (enemy.kind === 'lancer' && !enemy.secondShotFired && enemy.phaseMs <= 230) {
            enemy.secondShotFired = true;
            shots.push(this.aim(enemy, playerX, playerY, 190));
          }
          if (enemy.phaseMs <= 0) {
            enemy.phase = 'recover';
            enemy.phaseMs = enemy.kind === 'scout' ? 230 : 330;
          }
          break;
        case 'recover':
          enemy.x -= speed * dt / 1000;
          enemy.phaseMs -= dt;
          if (enemy.phaseMs <= 0) enemy.phase = 'exit';
          break;
        case 'exit':
          enemy.x -= speed * 1.8 * dt / 1000;
          break;
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].x < -60) this.enemies.splice(i, 1);
    }

    const isCompleted = this.enableBoss
      ? (this.boss !== null && this.boss.phase === 'defeated')
      : (this.scrollPx >= DEMO_DISTANCE && this.enemies.length === 0);

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
    return { killed: true, score: enemy.kind === 'scout' ? 100 : 300 };
  }

  damageBoss(amount: number, hitX: number, hitY: number) {
    if (!this.boss) return { bossDamage: 0, moduleDestroyed: null, killed: false };
    return this.boss.damage(amount, hitX, hitY);
  }

  remove(id: number): void {
    const index = this.enemies.findIndex(enemy => enemy.id === id);
    if (index >= 0) this.enemies.splice(index, 1);
  }

  private aim(enemy: EnemyModel, x: number, y: number, speed: number): EnemyShotEvent {
    const dx = x - enemy.x;
    const dy = y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: enemy.x - 18,
      y: enemy.y,
      velocityX: speed * dx / length,
      velocityY: speed * dy / length,
    };
  }
}
