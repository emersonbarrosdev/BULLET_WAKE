/**
 * Tipos e interfaces compartilhadas para os chefes das 5 fases do BULLET WAKE.
 * Simulação pura em TypeScript desacoplada de Phaser e DOM.
 */

export interface BossModule {
  id: string;
  name: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface BossShot {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
}

export interface BossSpawnEvent {
  kind: 'scout' | 'lancer';
  x: number;
  y: number;
}

export interface BossTick {
  phase: string;
  phaseChanged: boolean;
  shots: BossShot[];
  spawns: BossSpawnEvent[];
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  telegraph: boolean;
  defeated: boolean;
}

export interface BossHitResult {
  bossDamage: number;
  moduleDestroyed: string | null;
  killed: boolean;
}

export interface StageBoss {
  name: string;
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  phase: string;
  isTelegraphing: boolean;
  modules?: BossModule[];
  update(dt: number, playerX: number, playerY: number): BossTick;
  damage(amount: number, hitX: number, hitY: number): BossHitResult;
}

