import type { PilotId } from './ArcadeContracts.ts';
import type { GameDifficulty, SupplyBalance } from './PelagicDifficulty.ts';
import type { Controls, UpLayoutMode } from './ArcadeWorld.ts';
import type { CampaignFlight } from '../systems/campaignFlight.ts';
import type { SurvivalRule } from './HullIntegrity.ts';

export const REPLAY_FORMAT_VERSION = 2;

export interface ReplayInputRun {
  /** Version 2 stores exact axes (-1..1); v1 used tenths (-10..10). Flags: fire=1, special=2, charge=4, focus=8. */
  readonly qx: number;
  readonly qy: number;
  readonly flags: number;
  readonly count: number;
}

export interface DeterministicReplay {
  readonly version: number;
  readonly missionId: number;
  readonly pilotId: PilotId;
  readonly difficulty: GameDifficulty;
  readonly assisted: boolean;
  readonly seed: number;
  readonly stepHz: 120;
  readonly totalFrames: number;
  readonly runs: readonly ReplayInputRun[];
  readonly survivalRule?: SurvivalRule;
  readonly maxHull?: number;
  readonly carry?: CampaignFlight;
  readonly upLayout?: UpLayoutMode;
  readonly arena?: { left: number; right: number; top: number; bottom: number };
  readonly playerSidePadding?: number;
  readonly aircraftScale?: number;
  readonly supplyBalance?: SupplyBalance;
  readonly rapidFire?: boolean;
}

export type ReplayMetadata = Pick<DeterministicReplay, 'missionId' | 'pilotId' | 'difficulty' | 'assisted' | 'seed' |
  'survivalRule' | 'maxHull' | 'carry' | 'upLayout' | 'arena' | 'playerSidePadding' | 'aircraftScale' | 'supplyBalance' | 'rapidFire'>;

function sanitizeAxis(v: number): number {
  return Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
}

function packFlags(c: Controls): number {
  return (c.fire ? 1 : 0) | (c.special ? 2 : 0) | (c.charge ? 4 : 0) | (c.focus ? 8 : 0);
}

function unpackControl(r: ReplayInputRun, version: number): Controls {
  const divisor = version === 1 ? 10 : 1;
  return {
    x: r.qx / divisor,
    y: r.qy / divisor,
    fire: Boolean(r.flags & 1),
    special: Boolean(r.flags & 2),
    charge: Boolean(r.flags & 4),
    focus: Boolean(r.flags & 8),
  };
}

export class ReplayRecorder {
  private readonly meta: Omit<DeterministicReplay, 'totalFrames' | 'runs'>;
  private runs: Array<{ qx: number; qy: number; flags: number; count: number }> = [];
  private totalFrames = 0;

  constructor(meta: ReplayMetadata) {
    if (meta.survivalRule !== undefined && meta.survivalRule !== 'classic-v1' && meta.survivalRule !== 'hull-v1') {
      throw new Error('Unsupported replay survival rule');
    }
    if (meta.maxHull !== undefined && (!Number.isInteger(meta.maxHull) || meta.maxHull < 3 || meta.maxHull > 5)) {
      throw new Error('Invalid replay hull capacity');
    }
    this.meta = {
      version: REPLAY_FORMAT_VERSION,
      missionId: meta.missionId,
      pilotId: meta.pilotId,
      difficulty: meta.difficulty,
      assisted: meta.assisted,
      seed: meta.seed,
      stepHz: 120,
      survivalRule: meta.survivalRule ?? 'classic-v1',
      ...(meta.survivalRule === 'hull-v1' || meta.maxHull !== undefined ? { maxHull: meta.maxHull ?? 4 } : {}),
      ...(meta.carry ? { carry: structuredClone(meta.carry) } : {}),
      ...(meta.upLayout ? { upLayout: meta.upLayout } : {}),
      ...(meta.arena ? { arena: { ...meta.arena } } : {}),
      ...(meta.playerSidePadding !== undefined ? { playerSidePadding: meta.playerSidePadding } : {}),
      ...(meta.aircraftScale !== undefined ? { aircraftScale: meta.aircraftScale } : {}),
      ...(meta.supplyBalance ? { supplyBalance: meta.supplyBalance } : {}),
      rapidFire: meta.rapidFire ?? false,
    };
  }

  record(input: Controls): void {
    const qx = sanitizeAxis(input.x);
    const qy = sanitizeAxis(input.y);
    const flags = packFlags(input);
    const last = this.runs.at(-1);
    if (last && last.qx === qx && last.qy === qy && last.flags === flags) {
      last.count++;
    } else {
      this.runs.push({ qx, qy, flags, count: 1 });
    }
    this.totalFrames++;
  }

  finish(): DeterministicReplay {
    return {
      ...structuredClone(this.meta),
      totalFrames: this.totalFrames,
      runs: this.runs.map((r) => ({ ...r })),
    };
  }
}

export class ReplayPlayer {
  private readonly replay: DeterministicReplay;
  private runIdx = 0;
  private offset = 0;

  constructor(replay: DeterministicReplay) {
    if (replay.version !== 1 && replay.version !== REPLAY_FORMAT_VERSION) {
      throw new Error(`Unsupported replay format version: ${replay.version}`);
    }
    if ((replay.survivalRule !== undefined && replay.survivalRule !== 'classic-v1' && replay.survivalRule !== 'hull-v1') ||
        (replay.version === 1 && replay.survivalRule === 'hull-v1')) {
      throw new Error('Unsupported replay survival rule');
    }
    if (replay.stepHz !== 120) throw new Error('Unsupported replay step rate');
    if (replay.maxHull !== undefined && (!Number.isInteger(replay.maxHull) || replay.maxHull < 3 || replay.maxHull > 5)) {
      throw new Error('Invalid replay hull capacity');
    }
    this.replay = structuredClone({ ...replay, survivalRule: replay.version === 1 ? 'classic-v1' : replay.survivalRule ?? 'classic-v1' });
  }

  get survivalRule(): SurvivalRule { return this.replay.survivalRule ?? 'classic-v1'; }

  get finished(): boolean {
    return this.runIdx >= this.replay.runs.length;
  }

  nextInput(): Controls {
    if (this.finished) return { x: 0, y: 0, fire: false, special: false, charge: false, focus: false };
    const run = this.replay.runs[this.runIdx];
    const ctrl = unpackControl(run, this.replay.version);
    this.offset++;
    if (this.offset >= run.count) {
      this.runIdx++;
      this.offset = 0;
    }
    return ctrl;
  }
}
