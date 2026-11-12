/**
 * Tipos e interfaces compartilhadas para os chefes das 5 fases do BULLET WAKE.
 * Simulação pura em TypeScript desacoplada de Phaser e DOM.
 */

export interface BossModule {
  kind?:'organic'|'weapon';
  firedMs?:number;
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
  weight?: 'weak'|'medium'|'heavy'|'special';
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
  layer?: 'shell' | 'inner';
  metamorphosisMs?: number;
  readonly bodyRadiusX?: number;
  readonly bodyRadiusY?: number;
  readonly displayWidth?: number;
  modules?: BossModule[];
  transitionMs?:number;
  eclipse?: { phase:'warning'|'fire'|'recover'; lanes:number[]; elapsed:number };
  visible?:boolean;
  timedOut?:boolean;
  update(dt: number, playerX: number, playerY: number): BossTick;
  damageArea?(amount:number):BossHitResult;
  damage(amount: number, hitX: number, hitY: number, moduleId?:string|null): BossHitResult;
}

