import type { Family, Formation, Motion } from './content.ts';

export type PelagicSpecialEventId = 'naval-convoy' | 'elite-interception' | 'coordinated-strike' | 'rare-visitor';

export type PelagicEventRole =
    | 'convoy-lead'
    | 'convoy-escort'
    | 'convoy-air'
    | 'elite-ace'
    | 'coord-sub'
    | 'coord-wing'
    | 'rare-probe';

export interface PelagicEventMember {
    family: Family;
    formation: Formation;
    motion: Motion;
    lane: number;
    speed?: number;
    role: PelagicEventRole;
    /** Optional initial firing cooldown stagger in seconds. */
    cooldown?: number;
}

export interface PelagicSpecialEventSpec {
    id: PelagicSpecialEventId;
    at: number;
    radio: string;
    members: readonly PelagicEventMember[];
    hardExtra?: readonly PelagicEventMember[];
}

export const PELAGIC_RARE_BONUS = 1850;
export const PELAGIC_CONVOY_CLEAR_BONUS = 600;
export const PELAGIC_RARE_EARLY_AT = 248;
export const PELAGIC_RARE_FALLBACK_AT = 286;

/**
 * Deterministic, rate-capped scripted special events exclusive to Fenda Pelágica (UP).
 * Each timed event triggers at most once per sortie, obeys cumulative region unlocks,
 * and never alters mission length or supply count.
 */
export const PELAGIC_TIMED_EVENTS: readonly PelagicSpecialEventSpec[] = [
    {
        id: 'naval-convoy',
        at: 96,
        radio: 'COMBOIO NAVAL À VISTA!\nQUEBREM A ESCOLTA!',
        members: [
            { family: 'ship', formation: 'solo', motion: 'stationary', lane: 0.50, role: 'convoy-lead', cooldown: 1.9 },
            { family: 'boat', formation: 'solo', motion: 'stationary', lane: 0.30, role: 'convoy-escort', cooldown: 2.35 },
            { family: 'boat', formation: 'solo', motion: 'stationary', lane: 0.70, role: 'convoy-escort', cooldown: 2.75 },
            { family: 'fighter', formation: 'pair', motion: 'curve', lane: 0.50, speed: 84, role: 'convoy-air', cooldown: 1.85 },
        ],
        hardExtra: [
            { family: 'acrobat', formation: 'solo', motion: 'curve', lane: 0.24, speed: 118, role: 'convoy-air', cooldown: 2.0 },
        ],
    },
    {
        id: 'elite-interception',
        at: 225,
        radio: 'ESQUADRÃO ÁS DETECTADO!\nATENÇÃO AOS RASTROS!',
        members: [
            { family: 'interceptor', formation: 'solo', motion: 'curve', lane: 0.50, speed: 124, role: 'elite-ace', cooldown: 1.55 },
            { family: 'interceptor', formation: 'solo', motion: 'curve', lane: 0.28, speed: 124, role: 'elite-ace', cooldown: 2.1 },
            { family: 'interceptor', formation: 'solo', motion: 'curve', lane: 0.72, speed: 124, role: 'elite-ace', cooldown: 2.65 },
        ],
        hardExtra: [
            { family: 'interceptor', formation: 'solo', motion: 'curve', lane: 0.60, speed: 130, role: 'elite-ace', cooldown: 2.35 },
        ],
    },
    {
        id: 'coordinated-strike',
        at: 274,
        radio: 'ATAQUE COORDENADO!\nMAR E AR ALTERNADOS!',
        members: [
            { family: 'submarine', formation: 'solo', motion: 'stationary', lane: 0.34, role: 'coord-sub', cooldown: 1.85 },
            { family: 'acrobat', formation: 'pair', motion: 'turn', lane: 0.66, speed: 102, role: 'coord-wing', cooldown: 2.45 },
        ],
        hardExtra: [
            { family: 'interceptor', formation: 'solo', motion: 'dive', lane: 0.52, speed: 140, role: 'coord-wing', cooldown: 2.15 },
        ],
    },
];

export const PELAGIC_RARE_EVENT: PelagicSpecialEventSpec = {
    id: 'rare-visitor',
    at: PELAGIC_RARE_EARLY_AT,
    radio: 'SINAL RARO NO RADAR!\nSONDA ESTELAR EVASIVA!',
    members: [
        { family: 'alien', formation: 'solo', motion: 'sine', lane: 0.50, speed: 92, role: 'rare-probe', cooldown: 1.7 },
    ],
};

/**
 * Deterministic eligibility check for the capped rare visitor (max 1 per sortie).
 * Appears early on high-precision runs (0 deaths, >= 10 kills by 66s), or as a late sighting (>= 20 kills by 196s).
 */
export function isRareVisitorEligible(
    up: boolean,
    route: number,
    deaths: number,
    kills: number,
    alreadyTriggered: boolean,
    inBossFight: boolean,
): boolean {
    if (!up || alreadyTriggered || inBossFight) return false;
    if (route >= PELAGIC_RARE_EARLY_AT && route < PELAGIC_RARE_EARLY_AT + 12 && deaths === 0 && kills >= 10) return true;
    if (route >= PELAGIC_RARE_FALLBACK_AT && route < PELAGIC_RARE_FALLBACK_AT + 12 && kills >= 20) return true;
    return false;
}
