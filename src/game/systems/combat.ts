/** Regras de sobrevivência sem dependência do Phaser. */
export interface PlayerHealth {
  hp: number;
  lives: number;
  invulnerableMs: number;
  gameOver: boolean;
}

export type HitEvent = 'ignored' | 'damaged' | 'respawn' | 'game-over';

export const MAX_HP = 3;
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
): { state: PlayerHealth; event: HitEvent } {
  if (state.gameOver || state.invulnerableMs > 0) {
    return { state, event: 'ignored' };
  }

  if (state.hp > 1) {
    return {
      state: { ...state, hp: state.hp - 1, invulnerableMs: HIT_INVULNERABILITY_MS },
      event: 'damaged',
    };
  }

  if (state.lives > 1) {
    return {
      state: {
        hp: MAX_HP,
        lives: state.lives - 1,
        invulnerableMs: RESPAWN_INVULNERABILITY_MS,
        gameOver: false,
      },
      event: 'respawn',
    };
  }

  return {
    state: { hp: 0, lives: 0, invulnerableMs: 0, gameOver: true },
    event: 'game-over',
  };
}
