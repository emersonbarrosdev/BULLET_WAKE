import {
    collectPowerItem,
    maxWeaponLevel,
    powerProgress,
    type PlayerWeaponsState,
    type WeaponLevel,
} from '../systems/weaponSystem.ts';

/**
 * Balanced Assisted recovery rules exclusive to Fenda Pelágica (Stage 1 / UP).
 * Normal and Hard retain exact arcade rules; Stage 2 (CIDADE SOLAR) is never modified.
 */

export const ASSISTED_RESPAWN_INVULNERABLE = 4.2;
export const ASSISTED_RESPAWN_BULLET_CLEAR_RADIUS = 175;
export const ASSISTED_LOWER_LANE_ENEMY_COOLDOWN = 1.1;

export interface AssistedDeathRecovery {
    nextLevel: WeaponLevel;
    nextMeter: number;
    dropP: number;
    priorProgress: number;
}

/**
 * Softens weapon power loss on death while guaranteeing monotonic reduction at
 * higher tiers: players still lose power and must physically collect the dropped
 * recovery P capsule rather than receiving automatic level restores.
 */
export function computeAssistedDeathRecovery(
    prevLevel: WeaponLevel,
    prevMeter: number,
): AssistedDeathRecovery {
    const priorProgress = powerProgress('nolan', prevLevel, prevMeter);
    if (priorProgress <= 0) {
        return { nextLevel: 1, nextMeter: 0, dropP: 0, priorProgress: 0 };
    }
    if (prevLevel <= 1) {
        return { nextLevel: 1, nextMeter: 0, dropP: 1, priorProgress };
    }
    if (prevLevel === 2) {
        return { nextLevel: 1, nextMeter: 0, dropP: 2, priorProgress };
    }
    if (prevLevel === 3) {
        return { nextLevel: 1, nextMeter: 0, dropP: 3, priorProgress };
    }
    if (prevLevel === 4) {
        return { nextLevel: 2, nextMeter: 0, dropP: 2, priorProgress };
    }
    return { nextLevel: 3, nextMeter: 0, dropP: 2, priorProgress };
}

/**
 * Applies bounded recovery P steps from a death-dropped Assisted capsule.
 * Never overflows into +5000 bonus score or exceeds the weapon cap.
 */
export function applyRecoveryPower(
    state: PlayerWeaponsState,
    steps: number,
): { state: PlayerWeaponsState; appliedSteps: number; levelIncreased: boolean } {
    let cur = state;
    let appliedSteps = 0;
    let levelIncreased = false;
    const cap = maxWeaponLevel(cur.pilotId);
    const limit = Math.max(0, Math.floor(steps));
    for (let i = 0; i < limit && cur.weaponLevel < cap; i++) {
        const res = collectPowerItem(cur);
        cur = res.state;
        if (res.meterIncreased) appliedSteps++;
        if (res.levelIncreased) levelIncreased = true;
    }
    return { state: cur, appliedSteps, levelIncreased };
}
