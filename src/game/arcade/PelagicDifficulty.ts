import {
  FAMILY,
  FENDA_BASE_SUPPLIES,
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
 * Progressive Normal-mode supply timeline for the 360s Fenda Pelágica campaign:
 * brings early POWER 2 forward (14s, 36s), bridges the Tide Arch window safely (164s pre-arch, 220s post-arch),
 * and preserves the exact Special (174s) and Life (286s) crates with zero drops inside Tide Arch traversal (180-214s).
 */
export const FENDA_NORMAL_SUPPLIES: readonly SupplyEntry[] = [
  { at: 14, kind: 'power' },
  { at: 36, kind: 'power' },
  { at: 66, kind: 'power' },
  { at: 96, kind: 'power' },
  { at: 130, kind: 'power' },
  { at: 164, kind: 'power' },
  { at: 174, kind: 'special' },
  { at: 220, kind: 'power' },
  { at: 244, kind: 'power' },
  { at: 268, kind: 'power' },
  { at: 294, kind: 'life' },
  { at: 322, kind: 'power' },
];

export function buildMissionSupplies(
  mission: Mission,
  difficulty: GameDifficulty,
  assisted = false,
): readonly SupplyEntry[] {
  if (mission.perspective === 'UP') {
    if (difficulty === 'normal' && !assisted) return FENDA_NORMAL_SUPPLIES;
    return FENDA_BASE_SUPPLIES;
  }
  return SUPPLIES;
}

/** Progressive Normal-mode offensive stage along the 360s Fenda Pelágica timeline. */
export function normalPatternStage(route: number): 0 | 1 | 2 | 3 {
  if (route < 60) return 0;
  if (route < 160) return 1;
  if (route < 300) return 2;
  return 3;
}

/** Maximum coordinated enemy units allowed to initiate volleys inside the Normal attack window. */
export function normalOffensiveWindowCap(route: number, tideArchActive: boolean): number {
  if (route < 60) return 3;
  if (route < 160) return 4;
  if (route < 240) return tideArchActive ? 3 : 3;
  if (route < 300) return 4;
  return 5;
}

/** Progressive hostile bullet pressure cap used exclusively in Normal to delay excess volleys smoothly. */
export function normalSoftBulletCap(route: number, narrowArena: boolean): number {
  if (narrowArena) {
    if (route < 60) return 11;
    if (route < 160) return 13;
    if (route < 240) return 10;
    if (route < 300) return 14;
    return 16;
  }
  if (route < 60) return 16;
  if (route < 160) return 18;
  if (route < 240) return 14;
  if (route < 300) return 20;
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
 * Additional waves layered onto the 360s Fenda Pelágica for NORMAL mode:
 * strictly obeys cumulative family unlocks per region and respects Tide Arch (180-214s) and open-ocean coastal cutoff (>336s).
 */
export const FENDA_NORMAL_EXTRA_ENCOUNTERS: readonly Encounter[] = [
  // Region 0 (0-60s): conventional aircraft only
  w(10.2, 'fighter', 'trio', 'sine', .44, 106),
  w(22.2, 'acrobat', 'pair', 'diagonal', .66, 114),
  w(34.6, 'fighter', 'trio', 'curve', .50, 110),
  w(47.4, 'acrobat', 'pair', 'side-curve', .22, 122, 'right'),
  // Region 1 (60-115s): conventional aircraft + boat/ship
  w(65.4, 'boat', 'solo', 'stationary', .64),
  w(76.2, 'acrobat', 'successive', 'curve', .66, 114),
  w(84.2, 'boat', 'pair', 'stationary', .50),
  w(103.6, 'fighter', 'trio', 'sine', .52, 112),
  // Region 2 (115-160s): adds interceptor, tower, tank
  w(123.8, 'fighter', 'pair', 'side-cross', .24, 136, 'right'),
  w(133.0, 'boat', 'pair', 'stationary', .50),
  w(140.4, 'interceptor', 'pair', 'diagonal', .66, 148),
  w(150.4, 'fighter', 'trio', 'sine', .46, 112),
  // Region 3 (160-180s): adds submarine
  w(165.4, 'interceptor', 'pair', 'diagonal', .32, 152),
  // Region 4 post-arch (214-240s): no helicopters yet
  w(216.2, 'boat', 'pair', 'stationary', .50),
  w(223.4, 'fighter', 'trio', 'side-curve', .22, 124, 'left'),
  w(231.6, 'interceptor', 'pair', 'side-cross', .22, 158, 'right'),
  // Region 5 (240-300s): progressive helicopters + alien
  w(245.8, 'heli_scout', 'pair', 'sine', .40, 114),
  w(256.4, 'boat', 'pair', 'stationary', .50),
  w(266.4, 'heli_utility', 'pair', 'stationary', .50, 76),
  w(281.0, 'ship', 'solo', 'stationary', .48),
  w(291.8, 'heli_phantom', 'solo', 'side-curve', .22, 128, 'left'),
  // Region 6 (300-360s): full escalation
  w(302.4, 'fighter', 'v', 'accelerate', .50, 118),
  w(315.4, 'boat', 'pair', 'stationary', .50),
  w(329.4, 'submarine', 'pair', 'stationary', .50),
  w(342.8, 'heli_scout', 'pair', 'side-curve', .24, 124, 'right'),
  w(349.2, 'submarine', 'pair', 'stationary', .50),
];

/**
 * Heavy coordinated pressure waves for HARD mode (~3x combat pressure vs Normal),
 * strictly honoring every region's cumulative family unlock rules and Tide Arch / open-ocean boundaries.
 */
export const FENDA_HARD_EXTRA_ENCOUNTERS: readonly Encounter[] = [
  // Region 0 (0-60s): conventional aircraft only (fighter, acrobat, bomber >= 42s)
  w(21.6, 'fighter', 'v', 'curve', .56, 114),
  w(26.4, 'acrobat', 'quartet', 'sine', .50, 118),
  w(30.8, 'fighter', 'trio', 'side-curve', .24, 122, 'left'),
  w(39.0, 'acrobat', 'trio', 'turn', .54, 120),
  w(43.2, 'bomber', 'escort', 'straight', .62, 82),
  w(48.0, 'bomber', 'pair', 'straight', .48, 82),
  w(51.4, 'bomber', 'escort', 'straight', .36, 82),
  w(55.0, 'acrobat', 'quartet', 'curve', .48, 120),

  // Region 1 (60-115s): adds boat & ship (still zero jets/coastal/subs/helis)
  w(62.2, 'fighter', 'trio', 'sine', .46, 116),
  w(69.2, 'boat', 'pair', 'stationary', .50),
  w(72.8, 'fighter', 'v', 'curve', .36, 118),
  w(76.8, 'ship', 'solo', 'stationary', .42),
  w(80.4, 'ship', 'solo', 'stationary', .56),
  w(84.4, 'bomber', 'pair', 'straight', .50, 84),
  w(87.8, 'acrobat', 'quartet', 'turn', .50, 120),
  w(91.2, 'ship', 'solo', 'stationary', .62),
  w(100.2, 'boat', 'pair', 'stationary', .50),
  w(103.6, 'bomber', 'pair', 'straight', .50, 84),
  w(107.0, 'ship', 'solo', 'stationary', .44),
  w(110.4, 'fighter', 'horde', 'curve', .50, 118),

  // Region 2 (115-160s): adds interceptor, tower, tank
  w(117.4, 'interceptor', 'trio', 'side-curve', .22, 152, 'right'),
  w(123.0, 'ship', 'solo', 'stationary', .52),
  w(125.0, 'bomber', 'pair', 'straight', .50, 84),
  w(127.0, 'interceptor', 'trio', 'side-cross', .22, 158, 'left'),
  w(133.2, 'acrobat', 'quartet', 'turn', .50, 122),
  w(137.0, 'interceptor', 'quartet', 'dive', .50, 150),
  w(140.4, 'ship', 'solo', 'stationary', .48),
  w(143.6, 'fighter', 'horde', 'curve', .50, 118),
  w(146.8, 'interceptor', 'trio', 'side-cross', .22, 160, 'left'),
  w(150.2, 'bomber', 'pair', 'straight', .50, 84),
  w(153.4, 'ship', 'solo', 'stationary', .46),
  w(156.0, 'fighter', 'v', 'accelerate', .50, 120),

  // Region 3 (160-180s): adds submarine
  w(162.4, 'submarine', 'pair', 'stationary', .50),
  w(165.8, 'ship', 'solo', 'stationary', .48),
  w(169.0, 'interceptor', 'trio', 'side-cross', .20, 162, 'left'),
  w(172.4, 'acrobat', 'quartet', 'curve', .44, 122),

  // Region 4 post-arch (214-240s): no helicopters/UFO yet
  w(215.8, 'interceptor', 'trio', 'side-cross', .20, 162, 'left'),
  w(219.6, 'ship', 'solo', 'stationary', .46),
  w(221.8, 'bomber', 'pair', 'straight', .50, 84),
  w(223.0, 'fighter', 'v', 'sine', .48, 120),
  w(228.0, 'interceptor', 'quartet', 'diagonal', .50, 156),
  w(232.0, 'ship', 'solo', 'stationary', .52),
  w(234.4, 'acrobat', 'quartet', 'turn', .50, 124),
  w(237.0, 'submarine', 'pair', 'stationary', .50),

  // Region 5 (240-300s): progressive helicopters (Scout >= 240, Utility >= 252, Phantom >= 266, Warhawk >= 282) + UFO
  w(242.8, 'heli_scout', 'pair', 'side-curve', .24, 122, 'right'),
  w(246.2, 'interceptor', 'trio', 'side-cross', .20, 164, 'right'),
  w(249.6, 'heli_scout', 'trio', 'curve', .50, 120),
  w(253.2, 'heli_utility', 'pair', 'stationary', .48, 78),
  w(256.8, 'fighter', 'horde', 'sine', .50, 120),
  w(260.0, 'heli_utility', 'pair', 'stationary', .50, 78),
  w(263.4, 'ship', 'solo', 'stationary', .48),
  w(265.2, 'bomber', 'escort', 'straight', .56, 84),
  w(267.0, 'heli_phantom', 'pair', 'side-curve', .24, 130, 'left'),
  w(271.2, 'interceptor', 'quartet', 'diagonal', .50, 158),
  w(277.4, 'heli_phantom', 'trio', 'curve', .50, 132),
  w(281.2, 'acrobat', 'trio', 'side-cross', .22, 134, 'left'),
  w(284.0, 'heli_warhawk', 'solo', 'stationary', .46, 82),
  w(288.4, 'fighter', 'horde', 'sine', .50, 120),
  w(292.0, 'heli_phantom', 'pair', 'side-curve', .22, 132, 'right'),
  w(295.4, 'ship', 'solo', 'stationary', .50),
  w(298.0, 'bomber', 'escort', 'straight', .42, 84),

  // Region 6 (300-360s): full final escalation (no coastal towers/tanks > 336s)
  w(302.0, 'heli_phantom', 'pair', 'side-curve', .22, 132, 'left'),
  w(306.0, 'heli_warhawk', 'solo', 'stationary', .54, 82),
  w(309.2, 'acrobat', 'quartet', 'zigzag', .50, 124),
  w(312.4, 'heli_utility', 'pair', 'stationary', .50, 78),
  w(316.0, 'ship', 'solo', 'stationary', .50),
  w(318.2, 'bomber', 'escort', 'straight', .44, 84),
  w(319.6, 'interceptor', 'quartet', 'dive', .50, 158),
  w(323.2, 'heli_scout', 'trio', 'sine', .50, 126),
  w(326.2, 'ship', 'solo', 'stationary', .46),
  w(330.0, 'fighter', 'v', 'accelerate', .50, 122),
  w(334.0, 'heli_phantom', 'trio', 'curve', .50, 132),
  w(336.8, 'bomber', 'escort', 'straight', .58, 84),
  w(339.2, 'ship', 'solo', 'stationary', .50),
  w(343.0, 'heli_warhawk', 'solo', 'stationary', .46, 82),
  w(346.2, 'submarine', 'pair', 'stationary', .50),
  w(349.8, 'heli_phantom', 'trio', 'curve', .50, 132),
  w(353.2, 'ship', 'pair', 'stationary', .50),
  w(355.8, 'interceptor', 'trio', 'dive', .50, 162),
];

function upgradeEncounterForHard(e: Encounter): Encounter {
  // Keep opening LV1 waves and the pre-arch expressway calm band (174-180s) clean & readable
  if (e.at < 22 || (e.at >= 174 && e.at < 180)) return e;
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
