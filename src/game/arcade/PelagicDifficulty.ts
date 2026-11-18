import {
  FAMILY,
  SUPPLIES,
  WARHAWK_MISSILE_SPEED_HARD,
  WARHAWK_MISSILE_SPEED_NORMAL,
  type Encounter,
  type EntrySide,
  type Family,
  type Formation,
  type Mission,
  type Motion,
} from './content.ts';
import type { WeaponLevel } from '../systems/weaponSystem.ts';

export type GameDifficulty = 'easy' | 'normal' | 'hard';
export type SavedDifficulty = GameDifficulty | 'arcade';
export type SupplyEntry = { readonly at: number; readonly kind: (typeof SUPPLIES)[number]['kind'] };

export const NORMAL_RESPAWN_INVULNERABLE = 3.5;
export const NORMAL_RESPAWN_BULLET_CLEAR_RADIUS = 130;
export const NORMAL_RESPAWN_LOWER_LANE_COOLDOWN = 0.95;
export const NORMAL_ATTACK_WINDOW_SECONDS = 0.65;
export const NORMAL_FAN_REGION_GAP_SECONDS = 0.55;
export const NORMAL_FAN_REGION_RADIUS_PX = 105;
export const NORMAL_SQUAD_STAGGER_SECONDS = 0.20;

export type EnemyHpCategory = 'lightAir' | 'mediumHeli' | 'heavyHeli' | 'naval' | 'submarine' | 'heavyAir' | 'coastal';

export interface DifficultyDirectorConfig {
  readonly softMaxEnemiesPc: number;
  readonly softMaxEnemiesPortrait: number;
  readonly softMaxBulletsPc: number;
  readonly softMaxBulletsPortrait: number;
  readonly maxLead: number;
  readonly minEmptyForAnticipate: number;
  readonly reinforceDelay: number;
  readonly minEnemiesForReinforcePc: number;
  readonly minEnemiesForReinforcePortrait: number;
  readonly sectorCap: number;
  readonly region3Cap: number;
  readonly region4Cap: number;
  readonly minSpacing: number;
  readonly maxArchBoats: number;
}

/**
 * Configurable relative speed multipliers for conventional enemy projectiles (0.75x Easy, 1.00x Normal reference, 1.30x Hard).
 * Normal serves as the classic Sonic Wings-inspired baseline; Easy and Hard scale cleanly without stacked bonuses.
 */
export const ENEMY_PROJECTILE_SPEED_MULTIPLIERS: Readonly<Record<GameDifficulty, number>> = {
  easy: 0.75,
  normal: 1.00,
  hard: 1.30,
};

export interface DifficultyProfile {
  readonly id: GameDifficulty;
  readonly label: string;
  readonly shortLabel: string;
  readonly pipCount: number;
  readonly cooldownFactor: number;
  readonly shotSpeedMultiplier: number;
  readonly shotSpeedBonus: number;
  readonly warhawkMissileSpeed: number;
  readonly useHardPatterns: boolean;
  readonly useExtremePatterns: boolean;
  readonly autoEscort: 'none' | 'standard' | 'heavy';
  readonly useHardSpecialExtras: boolean;
  readonly bossPaceMultiplier: number;
  readonly bossHpMultiplier: number;
  readonly maxNewFiringUnitsPerFrame: number;
  readonly hpMultipliers: Readonly<Record<EnemyHpCategory, number>>;
  readonly director: DifficultyDirectorConfig;
}

export const DIFFICULTY_ORDER: readonly GameDifficulty[] = ['easy', 'normal', 'hard'];

export const DIFFICULTY_PROFILES: Readonly<Record<GameDifficulty, DifficultyProfile>> = {
  easy: {
    id: 'easy',
    label: 'FÁCIL',
    shortLabel: 'FÁCIL',
    pipCount: 1,
    cooldownFactor: 1.0,
    shotSpeedMultiplier: ENEMY_PROJECTILE_SPEED_MULTIPLIERS.easy,
    shotSpeedBonus: 0,
    warhawkMissileSpeed: WARHAWK_MISSILE_SPEED_NORMAL,
    useHardPatterns: false,
    useExtremePatterns: false,
    autoEscort: 'none',
    useHardSpecialExtras: false,
    bossPaceMultiplier: 1.0,
    bossHpMultiplier: 1.0,
    maxNewFiringUnitsPerFrame: 4,
    hpMultipliers: {
      lightAir: 1.0,
      mediumHeli: 1.0,
      heavyHeli: 1.0,
      naval: 1.0,
      submarine: 1.0,
      heavyAir: 1.0,
      coastal: 1.0,
    },
    director: {
      softMaxEnemiesPc: 9,
      softMaxEnemiesPortrait: 7,
      softMaxBulletsPc: 18,
      softMaxBulletsPortrait: 13,
      maxLead: 2.6,
      minEmptyForAnticipate: 0.40,
      reinforceDelay: 1.05,
      minEnemiesForReinforcePc: 0,
      minEnemiesForReinforcePortrait: 0,
      sectorCap: 4,
      region3Cap: 2,
      region4Cap: 2,
      minSpacing: 3.6,
      maxArchBoats: 2,
    },
  },
  normal: {
    id: 'normal',
    label: 'NORMAL',
    shortLabel: 'NORMAL',
    pipCount: 2,
    cooldownFactor: 0.95,
    shotSpeedMultiplier: ENEMY_PROJECTILE_SPEED_MULTIPLIERS.normal,
    shotSpeedBonus: 0,
    warhawkMissileSpeed: WARHAWK_MISSILE_SPEED_HARD,
    useHardPatterns: true,
    useExtremePatterns: false,
    autoEscort: 'standard',
    useHardSpecialExtras: true,
    bossPaceMultiplier: 1.04,
    bossHpMultiplier: 1.0,
    maxNewFiringUnitsPerFrame: 3,
    hpMultipliers: {
      lightAir: 1.0,
      mediumHeli: 1.0,
      heavyHeli: 1.0,
      naval: 1.0,
      submarine: 1.0,
      heavyAir: 1.0,
      coastal: 1.0,
    },
    director: {
      softMaxEnemiesPc: 11,
      softMaxEnemiesPortrait: 8,
      softMaxBulletsPc: 20,
      softMaxBulletsPortrait: 15,
      maxLead: 3.1,
      minEmptyForAnticipate: 0.28,
      reinforceDelay: 0.82,
      minEnemiesForReinforcePc: 0,
      minEnemiesForReinforcePortrait: 0,
      sectorCap: 4,
      region3Cap: 2,
      region4Cap: 2,
      minSpacing: 3.1,
      maxArchBoats: 2,
    },
  },
  hard: {
    id: 'hard',
    label: 'DIFÍCIL',
    shortLabel: 'DIFÍCIL',
    pipCount: 3,
    cooldownFactor: 0.86,
    shotSpeedMultiplier: ENEMY_PROJECTILE_SPEED_MULTIPLIERS.hard,
    shotSpeedBonus: 0,
    warhawkMissileSpeed: 408,
    useHardPatterns: true,
    useExtremePatterns: true,
    autoEscort: 'standard',
    useHardSpecialExtras: true,
    bossPaceMultiplier: 1.10,
    bossHpMultiplier: 1.15,
    maxNewFiringUnitsPerFrame: 4,
    hpMultipliers: {
      lightAir: 1.28,
      mediumHeli: 1.40,
      heavyHeli: 1.52,
      naval: 1.40,
      submarine: 1.40,
      heavyAir: 1.48,
      coastal: 1.32,
    },
    director: {
      softMaxEnemiesPc: 15,
      softMaxEnemiesPortrait: 11,
      softMaxBulletsPc: 22,
      softMaxBulletsPortrait: 16,
      maxLead: 3.4,
      minEmptyForAnticipate: 0.18,
      reinforceDelay: 0.34,
      minEnemiesForReinforcePc: 5,
      minEnemiesForReinforcePortrait: 4,
      sectorCap: 12,
      region3Cap: 2,
      region4Cap: 6,
      minSpacing: 1.65,
      maxArchBoats: 2,
    },
  },
};

export function normalizeGameDifficulty(raw?: string | null): GameDifficulty {
  if (raw === 'easy') return 'easy';
  if (raw === 'hard' || raw === 'arcade') return 'hard';
  return 'normal';
}

/**
 * Safely migrates persisted legacy difficulty values when upgrading saves < v3:
 * - Old `normal` (or unset) becomes new `easy` (preserving original balance)
 * - Old `hard` becomes new `normal`
 * - Old `arcade` is preserved cleanly as `'arcade'`
 */
export function migrateLegacyDifficulty(raw: unknown, fromSchemaVersion: number): SavedDifficulty {
  if (fromSchemaVersion < 3) {
    if (raw === 'arcade') return 'arcade';
    if (raw === 'hard') return 'normal';
    if (raw === 'easy') return 'easy';
    return 'easy';
  }
  if (raw === 'easy' || raw === 'normal' || raw === 'hard' || raw === 'arcade') {
    return raw;
  }
  return 'normal';
}

export function stepGameDifficulty(current: string | undefined, dir = 1): GameDifficulty {
  const norm = normalizeGameDifficulty(current);
  const idx = DIFFICULTY_ORDER.indexOf(norm);
  const step = dir < 0 ? -1 : 1;
  return DIFFICULTY_ORDER[(idx + step + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length];
}

export function enemyHpCategory(family: Family): EnemyHpCategory {
  switch (family) {
    case 'heli_scout':
    case 'heli_utility':
      return 'mediumHeli';
    case 'heli_phantom':
    case 'heli_warhawk':
      return 'heavyHeli';
    case 'boat':
    case 'ship':
      return 'naval';
    case 'submarine':
      return 'submarine';
    case 'bomber':
    case 'airship':
      return 'heavyAir';
    case 'tank':
    case 'tower':
      return 'coastal';
    default:
      return 'lightAir';
  }
}

export function resolveEnemyMaxHp(family: Family, difficulty: GameDifficulty): number {
  const base = FAMILY[family].hp;
  const mult = DIFFICULTY_PROFILES[difficulty].hpMultipliers[enemyHpCategory(family)];
  return Math.max(1, Math.round(base * mult));
}

/**
 * Progressive Normal-mode supply timeline for Fenda Pelágica:
 * brings early POWER 2 forward (11s, 29s), bridges the 118s-201s gap with safe pre-arch (135s)
 * and post-arch (185s) drops, and preserves the exact Special (145s) and Life (239s) crates.
 */
export const FENDA_NORMAL_SUPPLIES: readonly SupplyEntry[] = [
  { at: 11, kind: 'power' },
  { at: 29, kind: 'power' },
  { at: 54, kind: 'power' },
  { at: 80, kind: 'power' },
  { at: 106, kind: 'power' },
  { at: 135, kind: 'power' },
  { at: 145, kind: 'special' },
  { at: 185, kind: 'power' },
  { at: 212, kind: 'power' },
  { at: 239, kind: 'life' },
  { at: 248, kind: 'power' },
  { at: 274, kind: 'power' },
];

export function buildMissionSupplies(
  mission: Mission,
  difficulty: GameDifficulty,
  assisted = false,
): readonly SupplyEntry[] {
  if (mission.perspective === 'UP' && difficulty === 'normal' && !assisted) {
    return FENDA_NORMAL_SUPPLIES;
  }
  return SUPPLIES;
}

/** Progressive Normal-mode offensive stage along the 300s Fenda Pelágica timeline. */
export function normalPatternStage(route: number): 0 | 1 | 2 | 3 {
  if (route < 45) return 0;
  if (route < 135) return 1;
  if (route < 255) return 2;
  return 3;
}

/** Maximum coordinated enemy units allowed to initiate volleys inside the Normal attack window. */
export function normalOffensiveWindowCap(route: number, tideArchActive: boolean): number {
  if (route < 45) return 3;
  if (route < 135) return 4;
  if (route < 180) return tideArchActive ? 3 : 3;
  if (route < 255) return 4;
  return 5;
}

/** Progressive hostile bullet pressure cap used exclusively in Normal to delay excess volleys smoothly. */
export function normalSoftBulletCap(route: number, narrowArena: boolean): number {
  if (narrowArena) {
    if (route < 45) return 11;
    if (route < 135) return 13;
    if (route < 180) return 10;
    if (route < 255) return 14;
    return 16;
  }
  if (route < 45) return 16;
  if (route < 135) return 18;
  if (route < 180) return 14;
  if (route < 255) return 20;
  return 22;
}

/**
 * Normal-mode death recovery rule: drops strictly 1 weapon level and resets partial meter
 * (5->4, 4->3, 3->2, 2->1, 1->1), never granting free power increases or exploitable drops.
 */
export function computeNormalDeathRecovery(prevLevel: WeaponLevel): {
  nextLevel: WeaponLevel;
  nextMeter: number;
} {
  const nextLevel = Math.max(1, prevLevel - 1) as WeaponLevel;
  return { nextLevel, nextMeter: 0 };
}

const w = (
  at: number,
  family: Family,
  formation: Formation,
  motion: Motion,
  lane: number,
  speed?: number,
  entry?: EntrySide,
): Encounter => ({ at, family, formation, motion, lane, ...(speed ? { speed } : {}), ...(entry ? { entry } : {}) });

/**
 * Additional waves layered onto Fenda Pelágica for the new NORMAL mode (old Hard difficulty + denser combat):
 * shrinks empty downtime and expands air/heli/naval variety without touching `135-148s` expressway calm or `148-178s` Tide Arch air-lock.
 */
export const FENDA_NORMAL_EXTRA_ENCOUNTERS: readonly Encounter[] = [
  w(9.4, 'heli_scout', 'pair', 'sine', .35, 112),
  w(13.8, 'interceptor', 'pair', 'diagonal', .68, 142),
  w(32.6, 'submarine', 'solo', 'stationary', .62),
  w(36.4, 'fighter', 'trio', 'sine', .50, 110),
  w(49.4, 'acrobat', 'pair', 'side-curve', .22, 128, 'right'),
  w(62.2, 'heli_utility', 'pair', 'stationary', .50, 76),
  w(71.8, 'acrobat', 'successive', 'curve', .66, 114),
  w(75.6, 'submarine', 'solo', 'stationary', .34),
  w(88.8, 'fighter', 'trio', 'sine', .52, 112),
  w(105.6, 'submarine', 'solo', 'stationary', .58),
  w(122.6, 'boat', 'pair', 'stationary', .50),
  w(126.8, 'fighter', 'pair', 'side-cross', .24, 136, 'right'),
  w(182.4, 'boat', 'pair', 'stationary', .50),
  w(189.8, 'heli_scout', 'pair', 'side-curve', .22, 120, 'right'),
  w(207.4, 'boat', 'pair', 'stationary', .50),
  w(229.8, 'ship', 'solo', 'stationary', .48),
  w(257.4, 'fighter', 'v', 'accelerate', .50, 118),
  w(272.2, 'boat', 'pair', 'stationary', .50),
  w(281.2, 'submarine', 'pair', 'stationary', .50),
];

/**
 * Heavy coordinated pressure waves for the new extreme HARD mode (~3x combat pressure vs Normal).
 * Opens readable at LV1 while surging progressively into multi-axis fighter Vs, helicopter pairs/trios,
 * naval ships/submarines, and side sweeps with clean evasion lanes and intact Tide Arch / Express boundaries.
 */
export const FENDA_HARD_EXTRA_ENCOUNTERS: readonly Encounter[] = [
  w(23.8, 'heli_utility', 'pair', 'stationary', .50, 76),
  w(27.0, 'fighter', 'v', 'curve', .56, 116),
  w(30.4, 'ship', 'solo', 'stationary', .46),
  w(34.6, 'heli_scout', 'trio', 'curve', .48, 120),
  w(39.4, 'acrobat', 'quartet', 'sine', .50, 122),
  w(43.2, 'heli_scout', 'pair', 'side-curve', .24, 122, 'left'),

  w(48.2, 'fighter', 'trio', 'sine', .46, 116),
  w(52.4, 'heli_scout', 'trio', 'curve', .52, 120),
  w(56.4, 'interceptor', 'trio', 'side-curve', .22, 152, 'right'),
  w(60.6, 'ship', 'solo', 'stationary', .56),
  w(65.4, 'fighter', 'v', 'curve', .36, 118),
  w(69.8, 'heli_phantom', 'pair', 'side-curve', .24, 128, 'right'),
  w(74.0, 'interceptor', 'trio', 'side-cross', .22, 158, 'left'),
  w(78.6, 'fighter', 'v', 'diagonal', .62, 118),
  w(82.8, 'heli_utility', 'pair', 'stationary', .50, 78),
  w(86.2, 'interceptor', 'quartet', 'dive', .50, 150),

  w(92.4, 'fighter', 'horde', 'curve', .50, 118),
  w(95.4, 'submarine', 'pair', 'stationary', .50),
  w(99.2, 'heli_scout', 'pair', 'side-curve', .24, 124, 'right'),
  w(103.0, 'ship', 'solo', 'stationary', .44),
  w(107.6, 'acrobat', 'quartet', 'turn', .50, 122),
  w(112.4, 'heli_phantom', 'trio', 'curve', .50, 130),
  w(121.6, 'interceptor', 'trio', 'side-cross', .22, 162, 'left'),
  w(125.6, 'acrobat', 'quartet', 'curve', .44, 122),
  w(129.6, 'ship', 'solo', 'stationary', .50),
  w(133.0, 'fighter', 'v', 'accelerate', .50, 120),

  w(183.8, 'heli_utility', 'pair', 'stationary', .48, 78),
  w(187.4, 'interceptor', 'trio', 'side-cross', .20, 162, 'left'),
  w(191.6, 'heli_phantom', 'pair', 'side-curve', .24, 132, 'left'),
  w(196.2, 'ship', 'solo', 'stationary', .46),
  w(199.6, 'heli_scout', 'pair', 'side-curve', .22, 124, 'right'),

  w(203.2, 'heli_warhawk', 'solo', 'stationary', .42, 82),
  w(206.4, 'interceptor', 'trio', 'side-cross', .20, 164, 'right'),
  w(210.8, 'acrobat', 'quartet', 'turn', .50, 124),
  w(218.2, 'heli_phantom', 'trio', 'curve', .50, 132),
  w(222.8, 'fighter', 'v', 'sine', .48, 120),
  w(226.8, 'interceptor', 'quartet', 'diagonal', .50, 156),
  w(232.6, 'heli_utility', 'pair', 'stationary', .50, 78),
  w(236.4, 'acrobat', 'trio', 'side-cross', .22, 134, 'left'),
  w(247.8, 'fighter', 'horde', 'sine', .50, 120),
  w(252.4, 'interceptor', 'trio', 'side-cross', .20, 164, 'right'),
  w(256.0, 'heli_phantom', 'pair', 'side-curve', .22, 132, 'left'),
  w(260.4, 'heli_warhawk', 'solo', 'stationary', .54, 82),
  w(264.6, 'acrobat', 'quartet', 'zigzag', .50, 124),
  w(268.6, 'heli_utility', 'pair', 'stationary', .50, 78),
  w(273.0, 'ship', 'solo', 'stationary', .50),
  w(276.6, 'interceptor', 'quartet', 'dive', .50, 158),
  w(282.4, 'heli_scout', 'trio', 'sine', .50, 126),
  w(284.4, 'ship', 'solo', 'stationary', .42),
  w(286.4, 'fighter', 'v', 'accelerate', .50, 122),
  w(288.8, 'submarine', 'solo', 'stationary', .62),
  w(291.2, 'ship', 'solo', 'stationary', .50),
  w(294.6, 'heli_phantom', 'trio', 'curve', .50, 132),
  w(298.4, 'ship', 'pair', 'stationary', .50),
];

function upgradeEncounterForHard(e: Encounter): Encounter {
  // Keep opening LV1 waves and the pre-arch expressway calm band (135-148s) clean & readable
  if (e.at < 22 || (e.at >= 135 && e.at < 148)) return e;
  let formation = e.formation;
  if (formation === 'solo') {
    if (e.family === 'fighter' || e.family === 'acrobat' || e.family === 'interceptor') formation = 'trio';
    else if (e.family === 'boat' || e.family === 'heli_scout' || e.family === 'heli_utility' || e.family === 'heli_phantom') formation = 'pair';
  } else if (formation === 'pair') {
    if (e.family === 'fighter' || e.family === 'acrobat') formation = 'quartet';
    else if (e.family === 'interceptor' || e.family === 'heli_scout' || e.family === 'heli_phantom') formation = 'trio';
  } else if (formation === 'trio' && e.family === 'fighter') {
    formation = 'v';
  }
  return { ...e, formation };
}

const cachedMissionEncounters = new Map<string, readonly Encounter[]>();

export function buildMissionEncounters(mission: Mission, difficulty: GameDifficulty): readonly Encounter[] {
  if (mission.perspective !== 'UP' || difficulty === 'easy') {
    return mission.encounters;
  }
  const cacheKey = `${mission.id}:${difficulty}`;
  const cached = cachedMissionEncounters.get(cacheKey);
  if (cached) return cached;

  const base = difficulty === 'hard'
    ? mission.encounters.map(upgradeEncounterForHard)
    : mission.encounters;

  const merged = difficulty === 'normal'
    ? [...base, ...FENDA_NORMAL_EXTRA_ENCOUNTERS]
    : [...base, ...FENDA_NORMAL_EXTRA_ENCOUNTERS, ...FENDA_HARD_EXTRA_ENCOUNTERS];

  merged.sort((a, b) => a.at - b.at);
  cachedMissionEncounters.set(cacheKey, merged);
  return merged;
}
