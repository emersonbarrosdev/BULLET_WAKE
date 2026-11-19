import type { PilotId } from './ArcadeContracts.ts';
import type { GameDifficulty } from './PelagicDifficulty.ts';
import type { ArcadeRank } from './ArcadeRanking.ts';

export type AchievementId =
  | 'first_clear'
  | 'clear_nolan'
  | 'clear_cora'
  | 'clear_lyra'
  | 'clear_harlan'
  | 'clear_bento'
  | 'one_cc'
  | 'no_miss'
  | 'no_bomb'
  | 'all_sectors_clean'
  | 'arch_flawless'
  | 'boss_speedkill'
  | 'score_200k'
  | 'graze_master';

export interface AchievementDef {
  readonly id: AchievementId;
  readonly title: string;
  readonly description: string;
  readonly rewardCredits: number;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_clear', title: 'Rota Aberta', description: 'Conclua qualquer missão no modo Campanha/Arcade.', rewardCredits: 100 },
  { id: 'clear_nolan', title: 'Asas da Vanguarda', description: 'Conclua uma missão pilotando Bayek (RIVET).', rewardCredits: 80 },
  { id: 'clear_cora', title: 'Eco Fantasma', description: 'Conclua uma missão pilotando Tita (MOTH).', rewardCredits: 100 },
  { id: 'clear_lyra', title: 'Lança Precisa', description: 'Conclua uma missão pilotando Leona (KESTREL).', rewardCredits: 100 },
  { id: 'clear_harlan', title: 'Muralha de Ferro', description: 'Conclua uma missão pilotando Osvald (KNUCKLE).', rewardCredits: 100 },
  { id: 'clear_bento', title: 'Vento Escarlate', description: 'Conclua uma missão pilotando Hien (PEREGRINE).', rewardCredits: 120 },
  { id: 'one_cc', title: '1CC Clássico', description: 'Vença uma missão sem usar continue nem modo Assistido.', rewardCredits: 150 },
  { id: 'no_miss', title: 'Casco Intacto', description: 'Vença uma missão competitiva sem perder nenhuma vida.', rewardCredits: 220 },
  { id: 'no_bomb', title: 'Mão Firme', description: 'Vença uma missão competitiva sem acionar o Especial.', rewardCredits: 200 },
  { id: 'all_sectors_clean', title: 'Domínio Total', description: 'Atravesse todos os 7 setores da Fenda Pelágica sem morrer.', rewardCredits: 200 },
  { id: 'arch_flawless', title: 'Piloto das Marés', description: 'Atravesse o Arco das Marés sem sofrer dano.', rewardCredits: 100 },
  { id: 'boss_speedkill', title: 'Demolição Rápida', description: 'Derrote o Colosso Abissal em até 75 segundos.', rewardCredits: 150 },
  { id: 'score_200k', title: 'Ás dos Mares', description: 'Ultrapasse 200.000 pontos em uma única missão.', rewardCredits: 150 },
  { id: 'graze_master', title: 'Fio da Navalha', description: 'Acumule 25 raspões (Graze) em projéteis inimigos na mesma missão.', rewardCredits: 120 },
];

export interface SimulationAchievementSignals {
  readonly missionId: number;
  readonly pilotId: PilotId;
  readonly difficulty: GameDifficulty;
  readonly victory: boolean;
  readonly competitiveEligible: boolean;
  readonly deaths: number;
  readonly specialsUsed: number;
  readonly sectorsClean: number;
  readonly totalSectors: number;
  readonly archClean: boolean;
  readonly bossSeconds: number;
  readonly score: number;
  readonly grazeCount: number;
  readonly rank: ArcadeRank;
}

export function evaluateSimulationAchievements(sig: SimulationAchievementSignals): AchievementId[] {
  const earned: AchievementId[] = [];
  if (sig.archClean && sig.missionId === 1) earned.push('arch_flawless');
  if (sig.grazeCount >= 25) earned.push('graze_master');
  if (sig.score >= 200_000) earned.push('score_200k');

  if (!sig.victory) return earned;

  earned.push('first_clear');
  earned.push(`clear_${sig.pilotId}` as AchievementId);

  if (sig.competitiveEligible) {
    earned.push('one_cc');
    if (sig.deaths === 0) earned.push('no_miss');
    if (sig.specialsUsed === 0) earned.push('no_bomb');
    if (sig.missionId === 1 && sig.totalSectors > 0 && sig.sectorsClean >= sig.totalSectors) {
      earned.push('all_sectors_clean');
    }
    if (sig.missionId === 1 && sig.bossSeconds > 0 && sig.bossSeconds <= 75) {
      earned.push('boss_speedkill');
    }
  }
  return earned;
}

export function getAchievementDef(id: AchievementId): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
