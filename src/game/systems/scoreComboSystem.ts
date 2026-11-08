/**
 * Sistema de pontuação, combos e multiplicadores do BULLET WAKE.
 * Lógica pura e testável.
 */
export interface ScoreComboState {
  score: number;
  comboCount: number;
  comboTimerMs: number;
  maxCombo: number;
  kills: number;
}

export const COMBO_WINDOW_MS = 2400; // Tempo máximo entre abates para manter o combo

export function initialScoreCombo(): ScoreComboState {
  return {
    score: 0,
    comboCount: 0,
    comboTimerMs: 0,
    maxCombo: 0,
    kills: 0,
  };
}

export function getComboMultiplier(comboCount: number): number {
  if (comboCount >= 20) return 3.0;
  if (comboCount >= 10) return 2.0;
  if (comboCount >= 5) return 1.5;
  if (comboCount >= 2) return 1.2;
  return 1.0;
}

export function registerKill(
  state: ScoreComboState,
  baseScore: number,
): { state: ScoreComboState; pointsEarned: number } {
  const nextCombo = state.comboCount + 1;
  const multiplier = getComboMultiplier(nextCombo);
  const pointsEarned = Math.round(baseScore * multiplier);
  const nextScore = state.score + pointsEarned;
  const nextMaxCombo = Math.max(state.maxCombo, nextCombo);

  return {
    state: {
      score: nextScore,
      comboCount: nextCombo,
      comboTimerMs: COMBO_WINDOW_MS,
      maxCombo: nextMaxCombo,
      kills: state.kills + 1,
    },
    pointsEarned,
  };
}

export function addRawScore(state: ScoreComboState, amount: number): ScoreComboState {
  return { ...state, score: state.score + Math.max(0, amount) };
}

export function advanceCombo(state: ScoreComboState, deltaMs: number): ScoreComboState {
  if (state.comboCount === 0 || state.comboTimerMs <= 0) return state;
  const nextTimer = Math.max(0, state.comboTimerMs - Math.max(0, deltaMs));
  if (nextTimer === 0) {
    return {
      ...state,
      comboCount: 0,
      comboTimerMs: 0,
    };
  }
  return { ...state, comboTimerMs: nextTimer };
}

