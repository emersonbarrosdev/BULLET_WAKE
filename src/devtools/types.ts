import type { ArcadeScene } from '../game/arcade/ArcadeScene';
import type { StageEventCategory, StageEventRepeatPolicy, StageEventTriggerKind } from '../game/arcade/ArcadeStageDirector';
import type { GameDifficulty } from '../game/arcade/PelagicDifficulty';
import type { Encounter, EntrySide, Family, Formation, Motion, Perspective } from '../game/arcade/content';

export type DevPanelTab =
  | 'stages'
  | 'bosses'
  | 'enemies'
  | 'player'
  | 'collisions'
  | 'events'
  | 'performance'
  | 'visual';

export type DevScenarioCategory =
  | 'checkpoint'
  | 'enemy'
  | 'wave'
  | 'miniboss'
  | 'boss'
  | 'boss-section'
  | 'event'
  | 'stress';

export interface DevScenarioOptions {
  seed?: number;
  difficulty?: GameDifficulty | 'arcade';
  assisted?: boolean;
  rapidFire?: boolean;
  weaponLevel?: number;
  powerMeter?: number;
  lives?: number;
  specialCharges?: number;
  invincible?: boolean;
  pauseDirector?: boolean;
}

export interface DevScenario {
  id: string;
  stageId: number;
  missionIndex: number;
  name: string;
  category: DevScenarioCategory;
  description?: string;
  initialize(scene: ArcadeScene, options?: DevScenarioOptions): void;
  cleanup(scene: ArcadeScene): void;
}

export interface DevCheckpointSpec {
  id: string;
  label: string;
  atSeconds: number;
  regionIndex: number;
  regionName: string;
  kind: 'start' | 'region' | 'miniboss' | 'boss';
}

export interface DevBossSectionSpec {
  index: number;
  id: string;
  name: string;
  radio: string;
  hullMaxHp: number;
  partCount: number;
}

export interface DevBossSpec {
  id: string;
  stageId: number;
  missionIndex: number;
  name: string;
  mini: boolean;
  sections: DevBossSectionSpec[];
}

export interface DevEventSpec {
  id: string;
  stageId: number;
  missionIndex: number;
  name: string;
  triggerKind: StageEventTriggerKind;
  atSeconds?: number;
  preJumpSeconds: number;
  conditionLabel: string;
  dependencies: readonly string[];
  entities: readonly string[];
  repeatPolicy: StageEventRepeatPolicy;
  kind: StageEventCategory | 'special-event' | 'encounter' | 'supply' | 'region' | 'comms';
  description: string;
  trigger(scene: ArcadeScene, opts?: { action?: 'go-to' | 'before' | 'run'; isolated?: boolean; leadSeconds?: number; seed?: number }): string;
}

export interface DevEnemySpawnConfig {
  missionIndex: number;
  family: Family;
  quantity: number;
  formation: Formation;
  motion: Motion;
  entry: EntrySide;
  lane: number;
  speed?: number;
  spawnX?: number;
  spawnY?: number;
  fireRateScale: number;
  shotSpeedScale: number;
  difficulty: GameDifficulty;
  keepExisting: boolean;
}

export interface DevStageAdapter {
  readonly stageId: number;
  readonly missionIndex: number;
  readonly name: string;
  readonly perspective: Perspective;
  readonly durationSeconds: number;
  readonly checkpoints: DevCheckpointSpec[];
  readonly bosses: DevBossSpec[];
  readonly events: DevEventSpec[];
  readonly allowedFamilies: Family[];
  readonly allowedMotions: Motion[];
  readonly allowedEntries: EntrySide[];
}

export interface DevCollisionFlags {
  enabled: boolean;
  player: boolean;
  enemies: boolean;
  bullets: boolean;
  bulletVectors: boolean;
  bosses: boolean;
  mounts: boolean;
  armorAndHull: boolean;
  obstaclesAndCargo: boolean;
  specialRadius: boolean;
  sensorsAndTriggers: boolean;
  spawnZones: boolean;
}

export interface DevPerfReport {
  generatedAt: string;
  measurementKind: 'interactive' | 'controlled-simulation';
  scenarioName: string;
  missionId: number | null;
  quality: number;
  resolution: string;
  durationSeconds: number;
  frames: number;
  currentFps: number;
  avgFps: number;
  avgMs: number;
  medianMs: number;
  p95Ms: number;
  p99Ms: number;
  enemies: number;
  bullets: number;
  objects: number;
  effects: number;
  heapMb: number | null;
  rendererInfo: string;
}

export interface DevToolsPrefs {
  open: boolean;
  minimized: boolean;
  activeTab: DevPanelTab;
  x: number;
  y: number;
  seed: number;
  sandboxIsolated?: boolean;
}

export interface DevEnemyPreset {
  id: string;
  label: string;
  config: Partial<DevEnemySpawnConfig>;
}

export interface DevEncounterSummary {
  index: number;
  encounter: Encounter;
}
