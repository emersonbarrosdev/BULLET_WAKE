import type { GameDifficulty } from './PelagicDifficulty.ts';
import type { PilotId } from './ArcadeContracts.ts';

export type ArcadeRank = 'C' | 'B' | 'A' | 'S' | 'S+';

export interface RunEvaluationInput {
  readonly missionId: number;
  readonly pilotId: PilotId;
  readonly difficulty: GameDifficulty;
  readonly score: number;
  readonly deaths: number;
  readonly specialsUsed: number;
  readonly continuesUsed: number;
  readonly assisted: boolean;
  readonly practiceMode: boolean;
  readonly formationsCleared: number;
  readonly sectorsClean: number;
  readonly totalSectors: number;
  readonly bossSeconds: number;
  readonly grazeCount: number;
  readonly maxChain: number;
  readonly victory: boolean;
  readonly progressRatio: number;
}

export interface RunEvaluationResult {
  readonly rank: ArcadeRank;
  readonly competitiveEligible: boolean;
  readonly competitiveReason: string;
  readonly creditsEarned: number;
  readonly badges: readonly ('1CC' | 'NO-MISS' | 'NO-BOMB' | 'ALL-SECTORS' | 'SPEEDKILL')[];
}

interface RankThresholds {
  readonly bScore: number;
  readonly aScore: number;
  readonly sScore: number;
  readonly sPlusScore: number;
}

const STAGE1_THRESHOLDS: Readonly<Record<GameDifficulty, RankThresholds>> = {
  easy: { bScore: 95_000, aScore: 145_000, sScore: 178_000, sPlusScore: 999_999_999 },
  normal: { bScore: 110_000, aScore: 165_000, sScore: 200_000, sPlusScore: 225_000 },
  hard: { bScore: 145_000, aScore: 205_000, sScore: 245_000, sPlusScore: 280_000 },
};

const STAGE2_THRESHOLDS: Readonly<Record<GameDifficulty, RankThresholds>> = {
  easy: { bScore: 22_000, aScore: 38_000, sScore: 52_000, sPlusScore: 999_999_999 },
  normal: { bScore: 28_000, aScore: 46_000, sScore: 64_000, sPlusScore: 82_000 },
  hard: { bScore: 36_000, aScore: 58_000, sScore: 78_000, sPlusScore: 98_000 },
};

export function rankWeight(rank: ArcadeRank): number {
  switch (rank) {
    case 'S+': return 5;
    case 'S': return 4;
    case 'A': return 3;
    case 'B': return 2;
    default: return 1;
  }
}

export function evaluateArcadeRun(input: RunEvaluationInput): RunEvaluationResult {
  const competitiveEligible = !input.assisted && !input.practiceMode && input.continuesUsed === 0;
  const competitiveReason = input.practiceMode
    ? 'Modo Prática (não elegível para ranking oficial)'
    : input.assisted
      ? 'Modo Assistido ativo (elegível para campanha, excluído do ranking puro)'
      : input.continuesUsed > 0
        ? 'Continue utilizado (fora de 1CC competitivo)'
        : 'Arcade Puro (elegível para ranking oficial)';

  const table = input.missionId === 1 ? STAGE1_THRESHOLDS[input.difficulty] : STAGE2_THRESHOLDS[input.difficulty];
  const cleanRatio = input.totalSectors > 0 ? input.sectorsClean / input.totalSectors : 0;

  let rank: ArcadeRank = 'C';
  if (input.victory) {
    if (
      competitiveEligible &&
      input.difficulty !== 'easy' &&
      input.deaths === 0 &&
      input.score >= table.sPlusScore &&
      (input.missionId !== 1 || cleanRatio >= 6 / 7)
    ) {
      rank = 'S+';
    } else if (
      !input.assisted &&
      input.continuesUsed === 0 &&
      input.deaths <= (input.difficulty === 'easy' ? 0 : 1) &&
      input.score >= table.sScore
    ) {
      rank = 'S';
    } else if (input.score >= table.aScore && input.deaths <= 2) {
      rank = 'A';
    } else if (input.score >= table.bScore) {
      rank = 'B';
    } else {
      rank = 'C';
    }
    // Assisted mode caps rank at A so S / S+ always preserve skill prestige
    if (input.assisted && (rank === 'S' || rank === 'S+')) {
      rank = 'A';
    }
  } else {
    rank = input.score >= table.aScore ? 'B' : 'C';
  }

  const badges: Array<'1CC' | 'NO-MISS' | 'NO-BOMB' | 'ALL-SECTORS' | 'SPEEDKILL'> = [];
  if (input.victory && competitiveEligible) {
    badges.push('1CC');
    if (input.deaths === 0) badges.push('NO-MISS');
    if (input.specialsUsed === 0) badges.push('NO-BOMB');
    if (input.totalSectors > 0 && input.sectorsClean >= input.totalSectors) badges.push('ALL-SECTORS');
    if (input.bossSeconds > 0 && input.bossSeconds <= 75) badges.push('SPEEDKILL');
  }

  // Fair campaign credits earned even on partial defeats so casuals always feel forward momentum.
  let creditsEarned = 0;
  if (!input.practiceMode) {
    const diffBonus = input.difficulty === 'hard' ? 1.35 : input.difficulty === 'normal' ? 1.15 : 1.0;
    const progressBase = Math.round(Math.max(0, Math.min(1, input.progressRatio)) * 120);
    const victoryBase = input.victory ? 180 : 0;
    const rankBonus = rank === 'S+' ? 160 : rank === 'S' ? 110 : rank === 'A' ? 70 : rank === 'B' ? 35 : 10;
    const squadBonus = Math.min(90, Math.floor(input.formationsCleared / 4) * 5);
    const raw = (progressBase + victoryBase + rankBonus + squadBonus) * diffBonus;
    creditsEarned = Math.min(650, Math.max(15, Math.round(raw / 5) * 5));
  }

  return {
    rank,
    competitiveEligible,
    competitiveReason,
    creditsEarned,
    badges,
  };
}
