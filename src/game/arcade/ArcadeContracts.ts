import { PILOTS, getPilot, type PilotDefinition, type PilotId } from '../data/pilots.ts';
import type { SpecialType, WeaponLevel } from '../systems/weaponSystem.ts';

export type { PilotId };

export const PILOT_IDS: readonly PilotId[] = ['nolan', 'cora', 'lyra', 'harlan', 'bento'] as const;

export interface PilotCombatContract {
  readonly id: PilotId;
  readonly name: string;
  readonly callsign: string;
  readonly shipName: string;
  readonly nationality: string;
  readonly weaponName: string;
  readonly specialType: SpecialType;
  readonly specialName: string;
  readonly specialDescription: string;
  readonly bio: string;
  /** Portrait frame inside `arc-pilots` spritesheet. */
  readonly portraitFrame: number;
  /** Base arcade movement speed in virtual px/s. */
  readonly moveSpeed: number;
  /** Focus (precision slow-move) multiplier. */
  readonly focusSpeedFactor: number;
  /** Maximum evolving weapon level for this pilot's primary kit. */
  readonly maxWeaponLevel: WeaponLevel;
  /** Duration of the active special ability in seconds. */
  readonly specialDurationSec: number;
  /** Radius of the special blast/field in virtual px. */
  readonly specialRadius: number;
  /** Visual colors used for ship accents, projectiles, and charge effects. */
  readonly accentColor: number;
  readonly accentHex: string;
  readonly hullColor: number;
  readonly projectileTint: number;
  readonly chargeColor: number;
  /** 1..5 UI stat bars shown on Pilot Select & Hangar. */
  readonly stats: { readonly speed: number; readonly firepower: number; readonly armor: number };
  /** True for Bayek; other pilots unlock via gameplay milestones or Hangar credits. */
  readonly defaultUnlocked: boolean;
  readonly creditCost: number;
  readonly unlockHint: string;
  readonly isSecret?: boolean;
}

const PILOT_CONTRACTS_LIST: readonly PilotCombatContract[] = [
  {
    id: 'nolan',
    name: 'Bayek',
    callsign: 'VANGUARDA',
    shipName: 'RIVET',
    nationality: 'Egípcio',
    weaponName: 'RAJADA ESCARLATE',
    specialType: 'scarlet',
    specialName: 'TORMENTA ESCARLATE',
    specialDescription: 'Bomba tática frontal que explode em onda escarlate, limpando projéteis e causando alto dano em área.',
    bio: getPilot('nolan').bio,
    portraitFrame: 0,
    moveSpeed: 174,
    focusSpeedFactor: 0.58,
    maxWeaponLevel: 5,
    specialDurationSec: 2.75,
    specialRadius: 155,
    accentColor: 0x3ce6ff,
    accentHex: '#3ce6ff',
    hullColor: 0xe63946,
    projectileTint: 0xffffff,
    chargeColor: 0xfef08a,
    stats: { speed: 4, firepower: 5, armor: 3 },
    defaultUnlocked: true,
    creditCost: 0,
    unlockHint: 'Disponível desde o início.',
  },
  {
    id: 'cora',
    name: 'Tita',
    callsign: 'TECELÃ',
    shipName: 'MOTH',
    nationality: 'Origem desconhecida',
    weaponName: 'ONDAS VIOLETAS',
    specialType: 'phantom',
    specialName: 'SALTO FANTASMA',
    specialDescription: 'Deslocamento de fase invulnerável com pós-imagens que neutralizam projéteis e cortam esquadrões.',
    bio: getPilot('cora').bio,
    portraitFrame: 4,
    moveSpeed: 198,
    focusSpeedFactor: 0.56,
    maxWeaponLevel: 4,
    specialDurationSec: 2.4,
    specialRadius: 118,
    accentColor: 0xc084fc,
    accentHex: '#c084fc',
    hullColor: 0x7e22ce,
    projectileTint: 0xd8b4fe,
    chargeColor: 0xe879f9,
    stats: { speed: 5, firepower: 4, armor: 2 },
    defaultUnlocked: false,
    creditCost: 500,
    unlockHint: 'Desbloqueie com 500 CR.',
  },
  {
    id: 'lyra',
    name: 'Leona',
    callsign: 'SENTINELA',
    shipName: 'KESTREL',
    nationality: 'Brasileira',
    weaponName: 'LANÇA ESMERALDA',
    specialType: 'orbital',
    specialName: 'COROA ORBITAL',
    specialDescription: 'Lanças orbitais convergem sobre alvos prioritários e abrem um corredor seguro de passagem.',
    bio: getPilot('lyra').bio,
    portraitFrame: 5,
    moveSpeed: 184,
    focusSpeedFactor: 0.55,
    maxWeaponLevel: 4,
    specialDurationSec: 2.5,
    specialRadius: 145,
    accentColor: 0x34d399,
    accentHex: '#34d399',
    hullColor: 0x059669,
    projectileTint: 0x6ee7b7,
    chargeColor: 0x34d399,
    stats: { speed: 4, firepower: 4, armor: 4 },
    defaultUnlocked: false,
    creditCost: 750,
    unlockHint: 'Desbloqueie com 750 CR.',
  },
  {
    id: 'harlan',
    name: 'Osvald',
    callsign: 'BALUARTE',
    shipName: 'KNUCKLE',
    nationality: 'Russo',
    weaponName: 'FLUXO ÂMBAR',
    specialType: 'nova',
    specialName: 'RUPTURA NOVA',
    specialDescription: 'Detonação cinética radial centrada na nave que anula balas hostis e esmaga alvos blindados.',
    bio: getPilot('harlan').bio,
    portraitFrame: 6,
    moveSpeed: 156,
    focusSpeedFactor: 0.62,
    maxWeaponLevel: 4,
    specialDurationSec: 2.35,
    specialRadius: 175,
    accentColor: 0xf59e0b,
    accentHex: '#f59e0b',
    hullColor: 0xb45309,
    projectileTint: 0xfcd34d,
    chargeColor: 0xfb923c,
    stats: { speed: 2, firepower: 5, armor: 5 },
    defaultUnlocked: false,
    creditCost: 750,
    unlockHint: 'Desbloqueie com 750 CR.',
  },
  {
    id: 'bento',
    name: 'Hien',
    callsign: 'VENTO',
    shipName: 'PEREGRINE',
    nationality: 'Japonês',
    weaponName: 'CHUVA CELESTE',
    specialType: 'comet',
    specialName: 'CHUVA DE COMETAS',
    specialDescription: 'Esquadrilha remota varre a arena em diagonais, suprimindo projéteis e bombardeando múltiplos alvos.',
    bio: getPilot('bento').bio,
    portraitFrame: 7,
    moveSpeed: 188,
    focusSpeedFactor: 0.58,
    maxWeaponLevel: 4,
    specialDurationSec: 2.55,
    specialRadius: 165,
    accentColor: 0x60a5fa,
    accentHex: '#60a5fa',
    hullColor: 0x1d4ed8,
    projectileTint: 0x93c5fd,
    chargeColor: 0x38bdf8,
    stats: { speed: 5, firepower: 4, armor: 3 },
    defaultUnlocked: false,
    creditCost: 1200,
    unlockHint: 'Desbloqueie com 1200 CR.',
    isSecret: true,
  },
];

export const PILOT_CONTRACTS: Readonly<Record<PilotId, PilotCombatContract>> = Object.freeze({
  nolan: PILOT_CONTRACTS_LIST[0],
  cora: PILOT_CONTRACTS_LIST[1],
  lyra: PILOT_CONTRACTS_LIST[2],
  harlan: PILOT_CONTRACTS_LIST[3],
  bento: PILOT_CONTRACTS_LIST[4],
});

export function getPilotContract(id?: string): PilotCombatContract {
  if (id && id in PILOT_CONTRACTS) return PILOT_CONTRACTS[id as PilotId];
  return PILOT_CONTRACTS.nolan;
}

export function isValidPilotId(id: unknown): id is PilotId {
  return typeof id === 'string' && PILOT_IDS.includes(id as PilotId);
}

export function listPilotContracts(): readonly PilotCombatContract[] {
  return PILOT_CONTRACTS_LIST;
}

export function perspectiveLabelPt(perspective: 'UP' | 'SIDE'): string {
  return perspective === 'UP' ? '↑ VERTICAL' : '→ HORIZONTAL';
}

export { PILOTS, getPilot, type PilotDefinition };
