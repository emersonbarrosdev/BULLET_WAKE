/** The new campaign is authored in seconds, not padded by spawn timers. */
import { SUB_BOSS_NAME } from './PelagicSubmarineBoss.ts';
import { regionIndexForRoute } from './PelagicProgression.ts';
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
        // 0–60s: Região 1 — CÉU ABERTO (somente aviões convencionais: fighter, acrobat, bomber moderado; zero jato amarelo/barcos/costa/helis/subs)
        wave(1.5, 'fighter', 'solo', 'straight', .50, 96),
        wave(4.8, 'fighter', 'pair', 'straight', .36, 100),
        wave(8.4, 'fighter', 'pair', 'sine', .64, 102),
        wave(12.2, 'acrobat', 'pair', 'curve', .42, 106),
        wave(16.0, 'fighter', 'trio', 'straight', .50, 104),
        wave(20.0, 'acrobat', 'pair', 'side-curve', .24, 118, 'left'),
        wave(24.2, 'fighter', 'v', 'sine', .50, 106),
        wave(28.4, 'acrobat', 'successive', 'curve', .62, 110),
        wave(32.6, 'fighter', 'pair', 'side-curve', .22, 124, 'right'),
        wave(36.8, 'acrobat', 'trio', 'turn', .46, 112),
        wave(41.0, 'fighter', 'stagger', 'diagonal', .32, 108),
        wave(45.2, 'bomber', 'solo', 'straight', .54, 80),
        wave(49.4, 'fighter', 'horde', 'sine', .48, 106),
        wave(53.4, 'acrobat', 'pair', 'side-curve', .24, 126, 'left'),
        wave(56.8, 'bomber', 'escort', 'straight', .44, 82),

        // 60–115s: Região 2 — COSTA CORAL (libera boat e ship + aviões convencionais; zero jatos/costa/subs/helis/UFO)
        wave(60.8, 'boat', 'solo', 'stationary', .44),
        wave(63.6, 'fighter', 'pair', 'side-curve', .22, 128, 'right'),
        wave(67.2, 'acrobat', 'trio', 'curve', .58, 114),
        wave(71.0, 'boat', 'pair', 'stationary', .50),
        wave(74.4, 'fighter', 'v', 'sine', .50, 108),
        wave(78.2, 'ship', 'solo', 'stationary', .48),
        wave(82.4, 'acrobat', 'pair', 'side-curve', .24, 128, 'left'),
        wave(86.0, 'fighter', 'pair', 'side-cross', .22, 134, 'right'),
        wave(89.6, 'boat', 'solo', 'stationary', .66),
        wave(92.8, 'bomber', 'escort', 'straight', .40, 84),
        // Comboio naval especial entra em 96s (ship + 2 boats + fighter pair)
        wave(101.8, 'fighter', 'trio', 'diagonal', .32, 112),
        wave(105.4, 'ship', 'solo', 'stationary', .52),
        wave(108.8, 'acrobat', 'quartet', 'curve', .46, 114),
        wave(112.0, 'boat', 'pair', 'stationary', .50),

        // 115–160s: Região 3 — ARQUIPÉLAGO (libera interceptor [jato amarelo], tower e tank; zero submarinos/helis/UFO)
        wave(115.8, 'interceptor', 'solo', 'diagonal', .52, 146),
        wave(119.0, 'tower', 'solo', 'stationary', .85),
        wave(121.8, 'interceptor', 'pair', 'side-curve', .22, 144, 'left'),
        wave(125.6, 'boat', 'solo', 'stationary', .42),
        wave(128.4, 'tank', 'solo', 'stationary', .25),
        wave(131.2, 'fighter', 'v', 'sine', .50, 110),
        wave(134.8, 'interceptor', 'pair', 'side-cross', .20, 162, 'right'),
        wave(138.6, 'ship', 'solo', 'stationary', .50),
        wave(142.2, 'tower', 'solo', 'stationary', .85),
        wave(144.8, 'acrobat', 'trio', 'turn', .42, 116),
        wave(148.4, 'interceptor', 'pincer', 'diagonal', .50, 150),
        wave(152.0, 'tank', 'solo', 'stationary', .26),
        wave(154.6, 'bomber', 'escort', 'straight', .58, 84),
        wave(157.4, 'interceptor', 'trio', 'diagonal', .48, 152),

        // 160–180s: Região 4 — CORRENTE EXPRESSA (libera submarine: 1, 2 e 3 unidades espaçadas; zero helis/UFO)
        wave(160.8, 'submarine', 'solo', 'stationary', .36),
        wave(163.6, 'fighter', 'pair', 'side-curve', .22, 130, 'left'),
        wave(167.2, 'submarine', 'pair', 'stationary', .50),
        wave(170.6, 'interceptor', 'pair', 'side-cross', .20, 162, 'right'),
        wave(173.8, 'submarine', 'trio', 'stationary', .50),
        wave(176.6, 'acrobat', 'pair', 'side-curve', .22, 128, 'left'),

        // 180–240s: Região 5 — ARCO DAS MARÉS (180–212s travessia com canhões/barcos; 214–240s retomada sem helicópteros)
        wave(214.5, 'fighter', 'pair', 'side-curve', .24, 132, 'right'),
        wave(217.8, 'boat', 'pair', 'stationary', .50),
        wave(221.2, 'interceptor', 'pair', 'diagonal', .32, 154),
        // Esquadrão Ás (elite-interception) entra em 225s
        wave(229.8, 'submarine', 'pair', 'stationary', .50),
        wave(233.2, 'tower', 'solo', 'stationary', .85),
        wave(235.6, 'acrobat', 'trio', 'curve', .48, 116),
        wave(238.2, 'tank', 'solo', 'stationary', .25),

        // 240–300s: Região 6 — MAR DAS TURBINAS (libera helicópteros gradualmente: Scout -> Utility -> Phantom -> Warhawk + alien/UFO)
        wave(241.0, 'heli_scout', 'solo', 'sine', .56, 108),
        wave(244.4, 'fighter', 'horde', 'sine', .50, 110),
        wave(247.8, 'heli_scout', 'pair', 'side-curve', .24, 118, 'left'),
        wave(251.2, 'alien', 'pair', 'sine', .54, 106),
        wave(254.6, 'heli_utility', 'solo', 'stationary', .62, 76),
        wave(258.2, 'boat', 'pair', 'stationary', .50),
        wave(261.4, 'interceptor', 'pair', 'side-cross', .18, 168, 'right'),
        wave(264.8, 'tower', 'pair', 'stationary', .85),
        wave(268.2, 'heli_phantom', 'solo', 'side-curve', .24, 126, 'left'),
        // Ataque Coordenado especial entra em 274s (submarine + acrobat pair)
        wave(279.0, 'heli_utility', 'pair', 'stationary', .50, 76),
        wave(282.6, 'ship', 'solo', 'stationary', .48),
        wave(285.8, 'heli_warhawk', 'solo', 'stationary', .50, 82),
        wave(290.2, 'alien', 'pair', 'retreat', .44, 106),
        wave(293.6, 'heli_phantom', 'solo', 'side-curve', .22, 130, 'right'),
        wave(296.8, 'interceptor', 'pair', 'side-cross', .20, 168, 'left'),

        // 300–360s: Região 7 — FENDA PELÁGICA (escalada final até 360s; defesas costeiras só até 336s, oceano aberto 340–360s)
        wave(300.6, 'fighter', 'horde', 'accelerate', .50, 116),
        wave(304.2, 'heli_scout', 'pair', 'side-curve', .22, 124, 'left'),
        wave(307.6, 'tower', 'solo', 'stationary', .85),
        wave(310.0, 'interceptor', 'pincer', 'diagonal', .50, 154),
        wave(313.6, 'submarine', 'pair', 'stationary', .50),
        wave(317.4, 'heli_utility', 'pair', 'stationary', .50, 76),
        wave(321.2, 'acrobat', 'quartet', 'zigzag', .46, 118),
        wave(324.8, 'tank', 'solo', 'stationary', .25),
        wave(327.4, 'heli_phantom', 'pair', 'side-cross', .24, 134, 'right'),
        wave(331.4, 'submarine', 'trio', 'stationary', .50),
        wave(335.2, 'tower', 'solo', 'stationary', .85),
        wave(337.6, 'alien', 'pair', 'sine', .52, 108),
        // 340–360s: Oceano Aberto — zero defesas costeiras, preparação intensa para o Colosso Abissal aos 360s
        wave(341.0, 'bomber', 'escort', 'straight', .56, 84),
        wave(344.6, 'boat', 'pair', 'stationary', .50),
        wave(347.2, 'heli_warhawk', 'solo', 'stationary', .52, 82),
        wave(351.4, 'fighter', 'v', 'accelerate', .50, 118),
        wave(354.6, 'heli_phantom', 'pair', 'side-curve', .22, 134, 'left'),
        wave(356.8, 'interceptor', 'pair', 'dive', .50, 158),
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
export const FENDA_BASE_SUPPLIES = [{ at: 20, kind: 'power' }, { at: 50, kind: 'power' }, { at: 84, kind: 'power' }, { at: 118, kind: 'power' }, { at: 150, kind: 'power' }, { at: 174, kind: 'special' }, { at: 224, kind: 'power' }, { at: 262, kind: 'power' }, { at: 288, kind: 'life' }, { at: 312, kind: 'power' }, { at: 340, kind: 'power' }] as const;
export const FAMILY = {
    fighter: { hp: 2, size: 20, score: 160, fire: .80 }, interceptor: { hp: 3, size: 22, score: 220, fire: .64 }, acrobat: { hp: 3, size: 21, score: 200, fire: .86 }, bomber: { hp: 16, size: 38, score: 700, fire: 1.00 },
    boat: { hp: 11, size: 41, score: 600, fire: 1.06 }, ship: { hp: 25, size: 63, score: 1200, fire: .96 }, tank: { hp: 12, size: 34, score: 500, fire: 1.04 }, tower: { hp: 14, size: 36, score: 550, fire: 1.02 },
    airship: { hp: 18, size: 46, score: 950, fire: 2.6 }, alien: { hp: 5, size: 22, score: 350, fire: 1.02 }, submarine: { hp: 22, size: 64, score: 1000, fire: .86 },
    heli_scout: { hp: 7, size: 30, score: 420, fire: .74 }, heli_utility: { hp: 14, size: 35, score: 780, fire: .92 },
    heli_phantom: { hp: 20, size: 38, score: 1150, fire: .82 }, heli_warhawk: { hp: 36, size: 44, score: 1850, fire: .70 },
} satisfies Record<Family, { hp: number; size: number; score: number; fire: number }>;
export function regionAt(time: number, perspective: Perspective = 'UP'): number { return regionIndexForRoute(time, perspective); }
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
