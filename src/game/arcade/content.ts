/** The new campaign is authored in seconds, not padded by spawn timers. */
import { SUB_BOSS_NAME } from './PelagicSubmarineBoss.ts';
export type Perspective = 'UP' | 'SIDE';
export type StageKind = 'main' | 'extra' | 'secret' | 'remix';
export type Motion = 'straight' | 'diagonal' | 'curve' | 'sine' | 'zigzag' | 'turn' | 'dive' | 'accelerate' | 'retreat' | 'stationary' | 'side-cross' | 'side-curve';
export type Formation = 'solo' | 'pair' | 'trio' | 'quartet' | 'v' | 'stagger' | 'horde' | 'escort' | 'pincer' | 'successive';
export type EntrySide = 'top' | 'left' | 'right';
export type Family = 'fighter' | 'interceptor' | 'acrobat' | 'bomber' | 'boat' | 'ship' | 'tank' | 'tower' | 'airship' | 'alien' | 'submarine' | 'heli_scout' | 'heli_utility' | 'heli_phantom' | 'heli_warhawk';
export interface Encounter { at: number; family: Family; formation: Formation; motion: Motion; lane: number; speed?: number; entry?: EntrySide; }
export interface Mission { id: number; name: string; perspective: Perspective; kind: StageKind; allowedPilots: string[]; boss: string; regions: string[]; encounters: Encounter[]; }
const wave = (at: number, family: Family, formation: Formation, motion: Motion, lane: number, speed?: number, entry?: EntrySide): Encounter => ({ at, family, formation, motion, lane, speed, ...(entry ? { entry } : {}) });
export const FENDA: Mission = {
    id: 1, name: 'FENDA PELÁGICA', perspective: 'UP', kind: 'main', allowedPilots: ['nolan'], boss: SUB_BOSS_NAME, regions: ['CÉU ABERTO', 'COSTA CORAL', 'ARQUIPÉLAGO', 'CORRENTE EXPRESSA', 'ARCO DAS MARÉS', 'MAR DAS TURBINAS', 'FENDA PELÁGICA'], encounters: [
        // 0–45s: Trecho 1 — Abertura intensa com caças, entradas laterais, formação em V, canhão costeiro, barco e dupla de Scout
        wave(1.2, 'fighter', 'trio', 'straight', .42, 104),
        wave(4.2, 'interceptor', 'pair', 'side-curve', .22, 134, 'left'),
        wave(7.5, 'acrobat', 'successive', 'curve', .62, 114),
        wave(11.0, 'fighter', 'v', 'sine', .50, 108),
        wave(15.0, 'tower', 'solo', 'stationary', .85),
        wave(16.2, 'interceptor', 'pair', 'side-cross', .20, 166, 'right'),
        wave(20.0, 'fighter', 'horde', 'sine', .48, 104),
        wave(24.8, 'heli_scout', 'pair', 'sine', .60, 114),
        wave(28.5, 'boat', 'solo', 'stationary', .42),
        wave(30.8, 'acrobat', 'pair', 'side-curve', .24, 128, 'left'),
        wave(34.2, 'tank', 'solo', 'stationary', .25),
        wave(38.4, 'interceptor', 'pair', 'diagonal', .28, 148),
        wave(42.2, 'acrobat', 'trio', 'curve', .44, 114),

        // 45–90s: Trecho 2 — Costa Coral com alternância contínua ar / costa / mar e estreia do Utilitário
        wave(45.5, 'boat', 'solo', 'stationary', .48),
        wave(47.5, 'fighter', 'pair', 'side-curve', .20, 132, 'right'),
        wave(51.0, 'submarine', 'solo', 'stationary', .36),
        wave(54.5, 'heli_scout', 'pair', 'side-curve', .24, 120, 'left'),
        wave(58.0, 'tower', 'solo', 'stationary', .85),
        wave(60.2, 'interceptor', 'pincer', 'diagonal', .50, 150),
        wave(64.0, 'acrobat', 'trio', 'turn', .42, 116),
        wave(68.0, 'tank', 'solo', 'stationary', .26),
        wave(69.5, 'fighter', 'pair', 'side-cross', .22, 140, 'right'),
        wave(73.5, 'alien', 'pair', 'sine', .55, 106),
        wave(77.2, 'ship', 'solo', 'stationary', .48),
        wave(80.5, 'heli_utility', 'solo', 'stationary', .64, 76),
        wave(84.0, 'fighter', 'pair', 'side-cross', .20, 142, 'left'),
        wave(87.2, 'tower', 'solo', 'stationary', .85),

        // 90–135s: Trecho 3 — Patrulhas marítimas mistas, V, bombardeiro, comboio naval (115s) e Phantom
        wave(90.5, 'fighter', 'v', 'sine', .50, 110),
        wave(94.2, 'interceptor', 'pair', 'side-cross', .18, 168, 'right'),
        wave(98.0, 'boat', 'pair', 'stationary', .50),
        wave(100.5, 'tank', 'solo', 'stationary', .25),
        wave(103.5, 'heli_utility', 'solo', 'stationary', .38, 76),
        wave(107.2, 'interceptor', 'pair', 'side-curve', .22, 144, 'left'),
        wave(110.5, 'bomber', 'escort', 'straight', .58, 84),
        wave(120.5, 'acrobat', 'quartet', 'curve', .38, 114),
        wave(124.5, 'heli_phantom', 'solo', 'side-curve', .24, 128, 'left'),
        wave(128.5, 'submarine', 'solo', 'stationary', .64),
        wave(131.8, 'interceptor', 'pair', 'diagonal', .66, 154),

        // 135–148s: Corrente Expressa — ritmo rápido reduzido antes do Arco das Marés (<= 6 naves, respiro >= 3s)
        wave(136.2, 'interceptor', 'pair', 'side-cross', .20, 170, 'left'),
        wave(140.2, 'interceptor', 'solo', 'dive', .66, 156),
        wave(144.4, 'acrobat', 'pair', 'side-curve', .22, 130, 'right'),

        // 148–200s: Trecho 4/5 — Arco das Marés (148–178s só barcos/canhões) seguido de retomada aérea progressiva
        wave(180.5, 'fighter', 'pair', 'side-curve', .24, 132, 'right'),
        wave(184.0, 'heli_scout', 'pair', 'sine', .56, 118),
        wave(187.8, 'interceptor', 'pair', 'diagonal', .30, 154),
        wave(191.5, 'acrobat', 'trio', 'curve', .48, 116),
        wave(195.0, 'boat', 'solo', 'stationary', .50),
        wave(197.2, 'interceptor', 'pair', 'side-cross', .22, 162, 'left'),

        // 200–255s: Trecho 5 — Mar das Turbinas: baterias, submarinos, Elite (214s), Ataque Coordenado (242s) e Warhawk
        wave(200.8, 'tower', 'pair', 'stationary', .85),
        wave(204.5, 'fighter', 'horde', 'sine', .52, 110),
        wave(209.5, 'submarine', 'solo', 'stationary', .38),
        wave(219.5, 'heli_utility', 'pair', 'stationary', .50, 76),
        wave(223.8, 'interceptor', 'pair', 'side-cross', .18, 170, 'right'),
        wave(227.5, 'boat', 'pair', 'stationary', .50),
        wave(231.5, 'alien', 'pair', 'retreat', .44, 106),
        wave(235.5, 'heli_phantom', 'solo', 'side-curve', .22, 132, 'right'),
        wave(238.8, 'tower', 'solo', 'stationary', .85),
        wave(246.5, 'heli_warhawk', 'solo', 'stationary', .50, 82),
        wave(251.5, 'interceptor', 'pair', 'side-cross', .20, 170, 'left'),

        // 255–280s: Trecho 6 — Escalada Final (costa + mar + ar)
        wave(255.2, 'fighter', 'horde', 'accelerate', .50, 116),
        wave(259.0, 'heli_scout', 'pair', 'side-curve', .22, 124, 'left'),
        wave(262.0, 'boat', 'solo', 'stationary', .70),
        wave(264.5, 'tower', 'solo', 'stationary', .85),
        wave(266.2, 'interceptor', 'pincer', 'diagonal', .50, 154),
        wave(269.8, 'submarine', 'pair', 'stationary', .50),
        wave(274.0, 'acrobat', 'quartet', 'zigzag', .46, 118),
        wave(277.8, 'tank', 'solo', 'stationary', .25),
        wave(279.0, 'heli_phantom', 'pair', 'side-cross', .24, 136, 'right'),

        // 280–300s: Trecho 7 — Oceano Aberto (zero ameaças terrestres, pressão naval/aérea até o Colosso Abissal)
        wave(283.0, 'bomber', 'escort', 'straight', .56, 84),
        wave(287.0, 'boat', 'pair', 'stationary', .50),
        wave(288.2, 'heli_warhawk', 'solo', 'stationary', .52, 82),
        wave(292.8, 'fighter', 'v', 'accelerate', .50, 118),
        wave(296.4, 'interceptor', 'pair', 'dive', .50, 158),
    ]
};
export const SOLAR: Mission = {
    id: 2, name: 'CIDADE SOLAR', perspective: 'SIDE', kind: 'main', allowedPilots: ['nolan'], boss: 'MEGA DIRIGÍVEL GIRO', regions: ['HORIZONTE SOLAR', 'AVENIDA AÉREA', 'PONTES DO AMANHÃ', 'VIA EXPRESSA', 'ESCOLTA GIRO', 'DISTRITO DAS CORES', 'ALTOS DA CIDADE'], encounters: [
        wave(4, 'fighter', 'pair', 'sine', .35), wave(14, 'acrobat', 'trio', 'curve', .65), wave(26, 'interceptor', 'pair', 'diagonal', .3), wave(36, 'fighter', 'stagger', 'straight', .55),
        wave(47, 'tank', 'pair', 'stationary', .9), wave(54, 'bomber', 'escort', 'straight', .25), wave(65, 'tower', 'solo', 'stationary', .9), wave(73, 'acrobat', 'quartet', 'turn', .45), wave(83, 'interceptor', 'pair', 'dive', .2),
        wave(94, 'fighter', 'trio', 'straight', .35), wave(107, 'acrobat', 'pair', 'sine', .55), wave(120, 'fighter', 'stagger', 'curve', .4),
        wave(155, 'ship', 'solo', 'stationary', .45),
        wave(202, 'tower', 'pair', 'stationary', .9), wave(209, 'interceptor', 'pincer', 'diagonal', .5), wave(220, 'bomber', 'escort', 'retreat', .35), wave(231, 'acrobat', 'successive', 'zigzag', .5), wave(244, 'tank', 'pair', 'stationary', .9),
        wave(256, 'fighter', 'horde', 'sine', .5), wave(265, 'interceptor', 'quartet', 'accelerate', .4), wave(273, 'bomber', 'pair', 'straight', .7), wave(280, 'acrobat', 'trio', 'turn', .3),
    ]
};
export const MISSIONS = [FENDA, SOLAR];
SOLAR.encounters.push(wave(20, 'fighter', 'pair', 'turn', .7), wave(42, 'acrobat', 'pair', 'curve', .25), wave(59, 'boat', 'pair', 'sine', .65), wave(87, 'fighter', 'pair', 'straight', .5), wave(116, 'interceptor', 'pair', 'diagonal', .5), wave(138, 'fighter', 'trio', 'accelerate', .4), wave(147, 'acrobat', 'pair', 'curve', .65), wave(175, 'boat', 'pair', 'sine', .35), wave(185, 'fighter', 'v', 'straight', .65), wave(196, 'interceptor', 'pair', 'dive', .3), wave(215, 'fighter', 'pair', 'turn', .65), wave(237, 'ship', 'solo', 'retreat', .25), wave(250, 'acrobat', 'trio', 'curve', .55), wave(289, 'interceptor', 'quartet', 'straight', .3), wave(297, 'fighter', 'pair', 'sine', .7));
for (const e of SOLAR.encounters) if (e.family === 'boat' || e.family === 'ship' && e.at !== 155) e.family = 'airship';
SOLAR.encounters.push(wave(77, 'alien', 'pair', 'sine', .45), wave(227, 'alien', 'pair', 'retreat', .3));
SOLAR.encounters.sort((a, b) => a.at - b.at);
/** Reserved data is deliberately not a playable/unlocked mission. */
export const FUTURE_ROUTES = [{ id: 'secret-side', kind: 'secret', perspective: 'SIDE', duration: 120, unlock: null }, { id: 'secret-up-a', kind: 'secret', perspective: 'UP', duration: 180, unlock: null }, { id: 'secret-up-b', kind: 'secret', perspective: 'UP', duration: 180, unlock: null }, { id: 'sixth-campaign', kind: 'extra', perspective: 'SIDE', unlock: 'campaign-complete' }, { id: 'remix', kind: 'remix', perspective: null, unlock: null }] as const;
export const SUPPLIES = [{ at: 18, kind: 'power' }, { at: 42, kind: 'power' }, { at: 68, kind: 'power' }, { at: 94, kind: 'power' }, { at: 118, kind: 'power' }, { at: 145, kind: 'special' }, { at: 201, kind: 'power' }, { at: 219, kind: 'power' }, { at: 239, kind: 'life' }, { at: 253, kind: 'power' }, { at: 275, kind: 'power' }] as const;
export const FAMILY = {
    fighter: { hp: 2, size: 20, score: 160, fire: .80 }, interceptor: { hp: 3, size: 22, score: 220, fire: .64 }, acrobat: { hp: 3, size: 21, score: 200, fire: .86 }, bomber: { hp: 16, size: 38, score: 700, fire: 1.00 },
    boat: { hp: 11, size: 41, score: 600, fire: 1.06 }, ship: { hp: 25, size: 63, score: 1200, fire: .96 }, tank: { hp: 12, size: 34, score: 500, fire: 1.04 }, tower: { hp: 14, size: 36, score: 550, fire: 1.02 },
    airship: { hp: 18, size: 46, score: 950, fire: 2.6 }, alien: { hp: 5, size: 22, score: 350, fire: 1.02 }, submarine: { hp: 22, size: 64, score: 1000, fire: .86 },
    heli_scout: { hp: 7, size: 40, score: 420, fire: .74 }, heli_utility: { hp: 14, size: 48, score: 780, fire: .92 },
    heli_phantom: { hp: 20, size: 52, score: 1150, fire: .82 }, heli_warhawk: { hp: 36, size: 62, score: 1850, fire: .70 },
} satisfies Record<Family, { hp: number; size: number; score: number; fire: number }>;
export function regionAt(time: number): number { return time < 45 ? 0 : time < 90 ? 1 : time < 135 ? 2 : time < 148 ? 3 : time < 200 ? 4 : time < 255 ? 5 : 6; }
export function formationOffsets(f: Formation): [number, number][] {
    switch (f) { case 'solo': return [[0, 0]]; case 'pair': return [[-.12, 0], [.12, 0]]; case 'trio': return [[-.17, 0], [0, .1], [.17, 0]]; case 'quartet': return [[-.21, 0], [-.07, .08], [.07, .08], [.21, 0]]; case 'v': return [[-.28, -.16], [-.14, -.08], [0, 0], [.14, -.08], [.28, -.16]]; case 'stagger': return [[-.18, 0], [-.06, -.12], [.06, -.24], [.18, -.36]]; case 'horde': return Array.from({ length: 8 }, (_, i) => [(i % 4 - 1.5) * .13, -Math.floor(i / 4) * .18]); case 'escort': return [[0, 0], [-.17, -.1], [.17, -.1]]; case 'pincer': return [[-.35, 0], [.35, 0]]; case 'successive': return [[0, 0], [.12, -.22], [-.12, -.44], [0, -.66]]; }
}

/** Fixed silhouette, color and speed per enemy; aircraft do not resize bullets between volleys. */
export const ENEMY_SHOTS: Record<Family, { radius: number; speed: number; color: number }> = {
    fighter: { radius: 2.2, speed: 196, color: 0 }, interceptor: { radius: 2.3, speed: 244, color: 1 }, acrobat: { radius: 2.2, speed: 192, color: 2 },
    bomber: { radius: 3.1, speed: 166, color: 1 }, boat: { radius: 2.9, speed: 184, color: 0 }, ship: { radius: 3.3, speed: 188, color: 1 },
    tank: { radius: 3.0, speed: 186, color: 0 }, tower: { radius: 3.2, speed: 192, color: 1 }, airship: { radius: 3.1, speed: 140, color: 1 },
    alien: { radius: 2.6, speed: 198, color: 2 }, submarine: { radius: 3.2, speed: 194, color: 0 },
    heli_scout: { radius: 2.3, speed: 208, color: 0 }, heli_utility: { radius: 2.8, speed: 178, color: 1 },
    heli_phantom: { radius: 2.5, speed: 202, color: 2 }, heli_warhawk: { radius: 2.9, speed: 196, color: 1 },
};

/** Legacy Stage 2 (Cidade Solar) cadence & projectile table so Stage 2 gameplay stays untouched. */
export const LEGACY_SOLAR_FIRE: Partial<Record<Family, number>> = {
    fighter: 2.4, interceptor: 1.8, acrobat: 2.8, bomber: 2.1, boat: 2.5, ship: 2.3, tank: 2.6, tower: 2.2, airship: 2.6, alien: 2.9, submarine: 1.8,
};
export const LEGACY_SOLAR_SHOTS: Partial<Record<Family, { radius: number; speed: number; color: number }>> = {
    fighter: { radius: 2.1, speed: 145, color: 0 }, interceptor: { radius: 2.2, speed: 185, color: 1 }, acrobat: { radius: 2.1, speed: 155, color: 2 },
    bomber: { radius: 3.0, speed: 140, color: 1 }, boat: { radius: 2.9, speed: 140, color: 0 }, ship: { radius: 3.3, speed: 145, color: 1 },
    tank: { radius: 2.9, speed: 150, color: 0 }, tower: { radius: 3.2, speed: 145, color: 1 }, airship: { radius: 3.1, speed: 140, color: 1 },
    alien: { radius: 2.5, speed: 165, color: 2 }, submarine: { radius: 3.2, speed: 155, color: 0 },
};
export const WARHAWK_MISSILE_SPEED_NORMAL = 365;
export const WARHAWK_MISSILE_SPEED_HARD = 405;
