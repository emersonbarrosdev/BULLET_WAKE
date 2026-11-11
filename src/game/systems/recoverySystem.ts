import { powerProgress, type PlayerWeaponsState } from './weaponSystem.ts';

/** A lost life drops at most ONE ordinary P, never a snapshot of the old weapon. */
export function deathPowerDropCount(state: PlayerWeaponsState): 0 | 1 {
  return powerProgress(state.pilotId, state.weaponLevel, state.powerMeter) > 0 ? 1 : 0;
}
