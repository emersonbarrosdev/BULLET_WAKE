/**
 * BULLET WAKE V2 — Sistema de Dash (Propulsão de Emergência)
 * 
 * Regra Canônica Oficial:
 * - Exatamente 3 utilizações disponíveis por fase (fixas).
 * - Não regenera por tempo, abates, chefes ou power-ups.
 * - Não recupera ao morrer se a fase continuar.
 * - Restaura para 3 apenas quando a fase reinicia do zero ou inicia nova fase.
 * - Concede arrancada rápida (~2.8x) com janela de invulnerabilidade de 130ms.
 */

export interface DashState {
  remainingDashes: number;
  maxDashes: number;
  activeTimerMs: number;
  invulnerableTimerMs: number;
  dashDurationMs: number;
  dashDirX: number;
  dashDirY: number;
  dashSpeedMultiplier: number;
}

export const MAX_STAGE_DASHES = 3;
export const DASH_DURATION_MS = 160;
export const DASH_INVULNERABLE_MS = 130;
export const DASH_SPEED_MULTIPLIER = 2.8;

export function createInitialDashState(): DashState {
  return {
    remainingDashes: MAX_STAGE_DASHES,
    maxDashes: MAX_STAGE_DASHES,
    activeTimerMs: 0,
    invulnerableTimerMs: 0,
    dashDurationMs: DASH_DURATION_MS,
    dashDirX: 0,
    dashDirY: -1, // Padrão: impulso para a frente (norte)
    dashSpeedMultiplier: DASH_SPEED_MULTIPLIER,
  };
}

export function canDash(state: DashState): boolean {
  return state.remainingDashes > 0 && state.activeTimerMs <= 0;
}

export function triggerDash(
  state: DashState,
  currentMoveX = 0,
  currentMoveY = -1,
): { state: DashState; triggered: boolean } {
  if (!canDash(state)) {
    return { state, triggered: false };
  }

  // Direção do dash: vetor de movimento atual ou para a frente (-Y / norte) se estiver parado
  let dirX = currentMoveX;
  let dirY = currentMoveY;
  if (dirX === 0 && dirY === 0) {
    dirX = 0;
    dirY = -1; // Avança para o topo da tela
  } else {
    const mag = Math.hypot(dirX, dirY);
    dirX /= mag;
    dirY /= mag;
  }

  return {
    state: {
      ...state,
      remainingDashes: state.remainingDashes - 1,
      activeTimerMs: DASH_DURATION_MS,
      invulnerableTimerMs: DASH_INVULNERABLE_MS,
      dashDirX: dirX,
      dashDirY: dirY,
    },
    triggered: true,
  };
}

export function advanceDash(state: DashState, deltaMs: number): DashState {
  const dt = Math.max(0, deltaMs);
  return {
    ...state,
    activeTimerMs: Math.max(0, state.activeTimerMs - dt),
    invulnerableTimerMs: Math.max(0, state.invulnerableTimerMs - dt),
  };
}

export function isDashActive(state: DashState): boolean {
  return state.activeTimerMs > 0;
}

export function isDashInvulnerable(state: DashState): boolean {
  return state.invulnerableTimerMs > 0;
}

/** Formata o contador visual do HUD: '◆ ◆ ◆' -> '◆ ◆ ◇' -> '◆ ◇ ◇' -> '◇ ◇ ◇' */
export function formatDashIndicator(remaining: number, max = MAX_STAGE_DASHES): string {
  const pips: string[] = [];
  for (let i = 0; i < max; i++) {
    pips.push(i < remaining ? '◆' : '◇');
  }
  return pips.join(' ');
}

export const formatDashDots = formatDashIndicator;
