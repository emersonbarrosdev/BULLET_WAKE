/**
 * T05: diretor determinístico de ondas e estados de inimigos.
 * Independente de Phaser: lógica testável sem Canvas.
 */
export type EnemyKind = 'scout' | 'lancer';
export type EnemyPhase = 'approach' | 'telegraph' | 'attack' | 'recover' | 'exit';

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
  speed: number;
}
export interface EnemyTickResult {
  spawned: EnemyModel[];
  shots: EnemyShotEvent[];
  waveChanged: boolean;
  wave: number;
}
interface SpawnEntry { atMs: number; kind: EnemyKind; y: number }

// Eventos roteirizados, repetidos apenas no sandbox até existir a primeira fase completa.
const WAVE_MS = 23000;
const SCRIPT: readonly SpawnEntry[] = [
  { atMs: 550, kind: 'scout', y: 78 },
  { atMs: 1350, kind: 'scout', y: 143 },
  { atMs: 3400, kind: 'lancer', y: 107 },
  { atMs: 5850, kind: 'scout', y: 88 },
  { atMs: 6250, kind: 'scout', y: 159 },
  { atMs: 8500, kind: 'lancer', y: 159 },
  { atMs: 11000, kind: 'scout', y: 107 },
  { atMs: 11500, kind: 'scout', y: 68 },
  { atMs: 13900, kind: 'lancer', y: 76 },
  { atMs: 16600, kind: 'scout', y: 154 },
  { atMs: 17000, kind: 'scout', y: 108 },
  { atMs: 18000, kind: 'lancer', y: 130 },
];
const SPEED: Readonly<Record<EnemyKind, number>> = { scout: 74, lancer: 47 };
const TARGET_X: Readonly<Record<EnemyKind, number>> = { scout: 312, lancer: 292 };
const CHARGE_MS: Readonly<Record<EnemyKind, number>> = { scout: 640, lancer: 950 };

function limit(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

export class EnemyDirector {
  readonly enemies: EnemyModel[] = [];
  elapsedMs = 0;
  wave = 1;
  private eventIndex = 0;
  private cycleIndex = 0;
  private nextId = 1;

  update(deltaMs: number, playerX: number, playerY: number): EnemyTickResult {
    const dt = limit(deltaMs, 0, 50);
    this.elapsedMs += dt;
    const newWave = Math.floor(this.elapsedMs / WAVE_MS) + 1;
    const waveChanged = this.wave !== newWave;
    this.wave = newWave;

    const spawned: EnemyModel[] = [];
    const shots: EnemyShotEvent[] = [];
    // Timeline independente de FPS: eventos atrasados são consumidos em ordem.
    while (this.eventIndex < SCRIPT.length) {
      const entry = SCRIPT[this.eventIndex];
      const scheduledAt = this.cycleIndex * WAVE_MS + entry.atMs;
      if (this.elapsedMs < scheduledAt) break;
      const model: EnemyModel = {
        id: this.nextId++,
        kind: entry.kind,
        phase: 'approach',
        x: entry.kind === 'scout' ? 399 : 409,
        y: entry.y,
        baseY: entry.y,
        ageMs: 0,
        phaseMs: 0,
        hp: entry.kind === 'scout' ? 1 : 3,
        maxHp: entry.kind === 'scout' ? 1 : 3,
        secondShotFired: false,
      };
      this.enemies.push(model);
      spawned.push(model);
      this.eventIndex += 1;
      if (this.eventIndex === SCRIPT.length) {
        this.eventIndex = 0;
        this.cycleIndex += 1;
        break;
      }
    }

    for (const enemy of this.enemies) {
      enemy.ageMs += dt;
      const baseSpeed = SPEED[enemy.kind];
      switch (enemy.phase) {
        case 'approach':
          enemy.x -= baseSpeed * dt / 1000;
          if (enemy.kind === 'scout') {
            enemy.y = limit(enemy.baseY + Math.sin(enemy.ageMs / 275) * 12, 56, 179);
          } else {
            const diff = playerY - enemy.y;
            enemy.y += limit(diff, -30 * dt / 1000, 30 * dt / 1000);
            enemy.y = limit(enemy.y, 56, 179);
          }
          if (enemy.x <= TARGET_X[enemy.kind]) {
            enemy.phase = 'telegraph';
            enemy.phaseMs = CHARGE_MS[enemy.kind];
          }
          break;
        case 'telegraph':
          enemy.x -= baseSpeed * 0.18 * dt / 1000;
          enemy.phaseMs -= dt;
          if (enemy.phaseMs <= 0) {
            enemy.phase = 'attack';
            enemy.phaseMs = enemy.kind === 'scout' ? 240 : 500;
            shots.push(this.aimAt(enemy, playerX, playerY, enemy.kind === 'scout' ? 116 : 130));
          }
          break;
        case 'attack':
          enemy.x -= baseSpeed * 0.26 * dt / 1000;
          enemy.phaseMs -= dt;
          if (enemy.kind === 'lancer' && !enemy.secondShotFired && enemy.phaseMs <= 230) {
            shots.push(this.aimAt(enemy, playerX, playerY, 130));
            enemy.secondShotFired = true;
          }
          if (enemy.phaseMs <= 0) {
            enemy.phase = 'recover';
            enemy.phaseMs = enemy.kind === 'scout' ? 180 : 310;
          }
          break;
        case 'recover':
          enemy.x -= baseSpeed * 0.7 * dt / 1000;
          enemy.phaseMs -= dt;
          if (enemy.phaseMs <= 0) enemy.phase = 'exit';
          break;
        case 'exit':
          enemy.x -= baseSpeed * 1.6 * dt / 1000;
          break;
      }
    }

    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (this.enemies[i].x < -35) this.enemies.splice(i, 1);
    }
    return { spawned, shots, waveChanged, wave: this.wave };
  }

  damage(id: number, amount: number): { killed: boolean; score: number } {
    const index = this.enemies.findIndex(enemy => enemy.id === id);
    if (index < 0) return { killed: false, score: 0 };
    const enemy = this.enemies[index];
    enemy.hp = Math.max(0, enemy.hp - Math.max(0, amount));
    if (enemy.hp > 0) return { killed: false, score: 0 };
    this.enemies.splice(index, 1);
    return { killed: true, score: enemy.kind === 'scout' ? 100 : 300 };
  }

  remove(id: number): void {
    const index = this.enemies.findIndex(enemy => enemy.id === id);
    if (index >= 0) this.enemies.splice(index, 1);
  }

  private aimAt(enemy: EnemyModel, playerX: number, playerY: number, speed: number): EnemyShotEvent {
    const dx = playerX - enemy.x;
    const dy = playerY - enemy.y;
    const magnitude = Math.hypot(dx, dy) || 1;
    return {
      x: enemy.x - 12, y: enemy.y,
      velocityX: dx / magnitude * speed,
      velocityY: dy / magnitude * speed,
      speed,
    };
  }
}
