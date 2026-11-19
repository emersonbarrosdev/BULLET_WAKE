import type { Family, Perspective } from './content.ts';

export const FENDA_STAGE_DURATION = 360;
export const SOLAR_STAGE_DURATION = 300;

export const FENDA_REGION_STARTS = [0, 60, 115, 160, 180, 240, 300] as const;
export const SOLAR_REGION_STARTS = [0, 45, 90, 135, 155, 200, 255] as const;

export const FENDA_OPEN_OCEAN_START = 342;
export const FENDA_COASTAL_CUTOFF_ROUTE = 336;

export function stageDurationFor(perspective: Perspective): number {
  return perspective === 'UP' ? FENDA_STAGE_DURATION : SOLAR_STAGE_DURATION;
}

export function regionStartsFor(perspective: Perspective): readonly number[] {
  return perspective === 'UP' ? FENDA_REGION_STARTS : SOLAR_REGION_STARTS;
}

export function regionIndexForRoute(time: number, perspective: Perspective = 'UP'): number {
  const starts = regionStartsFor(perspective);
  for (let i = starts.length - 1; i >= 0; i--) {
    if (time >= starts[i]) return i;
  }
  return 0;
}

/**
 * Cumulative enemy family unlock table for Stage 1 — Fenda Pelágica:
 * - Region 0 (0-60s, Céu Aberto): conventional propeller aircraft only (`fighter`, `acrobat`, `bomber`).
 * - Region 1 (60-115s, Costa Coral): adds surface naval craft (`boat`, `ship`).
 * - Region 2 (115-160s, Arquipélago): adds yellow jet (`interceptor`) + all coastal defenses (`tower`, `tank`).
 * - Region 3 (160-180s, Corrente Expressa): adds `submarine` (1, 2, and 3 unit formations).
 * - Region 4 (180-240s, Arco das Marés): mid-stage arch crossing + post-arch combat (still no helicopters/UFO).
 * - Region 5 (240-300s, Mar das Turbinas): unlocks all 4 helicopters progressively + `alien` (UFO / rare probe).
 * - Region 6 (300-360s, Fenda Pelágica): full roster final escalation before Colosso Abissal at 360s.
 */
export const FENDA_FAMILY_UNLOCK_REGION: Readonly<Record<Family, number>> = {
  fighter: 0,
  acrobat: 0,
  bomber: 0,
  boat: 1,
  ship: 1,
  interceptor: 2,
  tower: 2,
  tank: 2,
  submarine: 3,
  heli_scout: 5,
  heli_utility: 5,
  heli_phantom: 5,
  heli_warhawk: 5,
  alien: 5,
  airship: 6,
};

/**
 * Minimum route time (seconds) for each family in Fenda Pelágica.
 * Includes gradual sub-region staging for bombers in Region 0 and progressive helicopter rollout in Region 5
 * (Scout -> Utility -> Phantom -> Warhawk, never dumping all 4 helicopters simultaneously at 240s).
 */
export const FENDA_FAMILY_MIN_ROUTE: Readonly<Record<Family, number>> = {
  fighter: 0,
  acrobat: 0,
  bomber: 42,
  boat: 60,
  ship: 76,
  interceptor: 115,
  tower: 115,
  tank: 115,
  submarine: 160,
  heli_scout: 240,
  heli_utility: 252,
  heli_phantom: 266,
  heli_warhawk: 282,
  alien: 248,
  airship: 300,
};

export function isFamilyUnlockedInFendaRegion(family: Family, region: number): boolean {
  return region >= FENDA_FAMILY_UNLOCK_REGION[family];
}

export function isFamilyUnlockedAtFendaRoute(family: Family, route: number): boolean {
  const region = regionIndexForRoute(route, 'UP');
  return region >= FENDA_FAMILY_UNLOCK_REGION[family] && route >= FENDA_FAMILY_MIN_ROUTE[family];
}

export function unlockedFendaFamiliesAtRegion(region: number): Family[] {
  return (Object.keys(FENDA_FAMILY_UNLOCK_REGION) as Family[]).filter(
    (fam) => fam !== 'airship' && FENDA_FAMILY_UNLOCK_REGION[fam] <= region,
  );
}
