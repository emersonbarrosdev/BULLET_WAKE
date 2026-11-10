/** Regras de sobrevivência sem dependência do Phaser. */
export interface PlayerHealth {
  hp: number;
  lives: number;
  invulnerableMs: number;
  gameOver: boolean;
}

export type HitEvent = 'ignored' | 'damaged' | 'respawn' | 'game-over';

export const MAX_HP = 100;
export const START_LIVES = 1;
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

  const remaining = Math.max(0,state.hp-Math.max(0,damage));
  if (remaining > 0) {
    return {
      state: { ...state, hp: remaining, invulnerableMs: HIT_INVULNERABILITY_MS },
      event: 'damaged',
    };
  }

  return {
    state: { hp: 0, lives: 0, invulnerableMs: 0, gameOver: true },
    event: 'game-over',
  };
}
