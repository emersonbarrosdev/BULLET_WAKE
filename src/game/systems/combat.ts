/** Regras de sobrevivência sem dependência do Phaser. */
export interface PlayerHealth {
  hp: number;
  lives: number;
  invulnerableMs: number;
  gameOver: boolean;
}

export type HitEvent = 'ignored' | 'damaged' | 'respawn' | 'game-over';

export const MAX_HP = 100;
export const START_LIVES = 3;
export const HIT_INVULNERABILITY_MS = 1500;
export const RESPAWN_INVULNERABILITY_MS = 2000;

export function initialPlayerHealth(): PlayerHealth {
  return { hp: MAX_HP, lives: START_LIVES, invulnerableMs: 0, gameOver: false };
}

export function advanceHealth(state: PlayerHealth, deltaMs: number): PlayerHealth {
  return {
    ...state,
    invulnerableMs: Math.max(0, state.invulnerableMs - Math.max(0, deltaMs)),
  };
}

export function applyPlayerHit(
  state: PlayerHealth,
  damage = 20,
): { state: PlayerHealth; event: HitEvent } {
  if (state.gameOver || state.invulnerableMs > 0) {
    return { state, event: 'ignored' };
  }

  if (damage <= 0) return { state, event: 'ignored' };
  const lives = Math.max(0, state.lives - 1);
  return {
    state: { hp: lives ? MAX_HP : 0, lives, invulnerableMs: lives ? RESPAWN_INVULNERABILITY_MS : 0, gameOver: lives === 0 },
    event: lives ? 'respawn' : 'game-over',
  };
}
