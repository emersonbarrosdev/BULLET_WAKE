import type { PilotId } from './ArcadeContracts.ts';
import type { GameDifficulty } from './PelagicDifficulty.ts';
import type { Controls } from './ArcadeWorld.ts';

export const REPLAY_FORMAT_VERSION = 1;

export interface ReplayInputRun {
  /** Quantized movement (-10..10), flags bitmask (fire=1, special=2, charge=4, focus=8), and frame count. */
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
}

function quantizeAxis(v: number): number {
  return Math.max(-10, Math.min(10, Math.round(v * 10)));
}

function packFlags(c: Controls): number {
  return (c.fire ? 1 : 0) | (c.special ? 2 : 0) | (c.charge ? 4 : 0) | (c.focus ? 8 : 0);
}

function unpackControl(r: ReplayInputRun): Controls {
  return {
    x: r.qx / 10,
    y: r.qy / 10,
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

  constructor(meta: { missionId: number; pilotId: PilotId; difficulty: GameDifficulty; assisted: boolean; seed: number }) {
    this.meta = {
      version: REPLAY_FORMAT_VERSION,
      missionId: meta.missionId,
      pilotId: meta.pilotId,
      difficulty: meta.difficulty,
      assisted: meta.assisted,
      seed: meta.seed,
      stepHz: 120,
    };
  }

  record(input: Controls): void {
    const qx = quantizeAxis(input.x);
    const qy = quantizeAxis(input.y);
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
      ...this.meta,
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
    this.replay = replay;
  }

  get finished(): boolean {
    return this.runIdx >= this.replay.runs.length;
  }

  nextInput(): Controls {
    if (this.finished) return { x: 0, y: 0, fire: false, special: false, charge: false, focus: false };
    const run = this.replay.runs[this.runIdx];
    const ctrl = unpackControl(run);
    this.offset++;
    if (this.offset >= run.count) {
      this.runIdx++;
      this.offset = 0;
    }
    return ctrl;
  }
}
