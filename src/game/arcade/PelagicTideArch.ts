import { clamp } from './geometry.ts';
import type { PelagicSpecialEventId } from './PelagicSpecialEvents.ts';
import type { GameDifficulty } from './PelagicDifficulty.ts';
import type { WeaponLevel } from '../systems/weaponSystem.ts';

export type TideArchPhase =
    | 'idle'
    | 'approach'
    | 'descent'
    | 'low-flight'
    | 'under-arch'
    | 'ascent'
    | 'checkpoint'
    | 'complete';

export type ArchCannonPattern = 'alternating' | 'aimed-burst' | 'fan3' | 'sweep';

export interface TideArchOpening {
    left: number;
    right: number;
    center: number;
    width: number;
    pierLeftWidth: number;
    pierRightWidth: number;
}

export interface TideArchCannonSpec {
    id: string;
    side: -1 | 1;
    /** Offset along Y relative to `archWorldY` (negative = before arch, positive = exit mouth). */
    relWorldY: number;
    /** Normalized inset fraction inside the flanking pier from the arena outer wall toward center. */
    pierDepth: number;
    pattern: ArchCannonPattern;
    cooldownOffset: number;
    stage: 'approach' | 'descent' | 'low-flight' | 'under-arch';
}

export interface TideArchBoatSpec {
    id: string;
    laneFrac: number;
    speed: number;
    stage: 'approach' | 'descent' | 'low-flight' | 'under-arch' | 'ascent';
    cooldownOffset: number;
}

export interface PelagicCheckpointSnapshot {
    missionId: number;
    checkpointId: 'tide-arch-clear';
    route: number;
    scroll: number;
    region: number;
    waveIndex: number;
    supplyIndex: number;
    specialEventsTriggered: PelagicSpecialEventId[];
    rareSpawnCount: number;
    score: number;
    lives: number;
    weaponLevel: WeaponLevel;
    powerMeter: number;
    specialCharges: number;
    hard: boolean;
    difficulty?: GameDifficulty;
    assisted: boolean;
    tideArchCompleted: true;
    scoringState: {
        currentSector: number;
        sectorHadDeath: boolean;
        awardedSectors: number[];
        finalSectorChecked: boolean;
        totals: {
            formationBonus: number;
            survivalBonus: number;
            bossBonus: number;
            specialBonus: number;
            formationsCleared: number;
            sectorsClean: number;
            bossPartsDestroyed: number;
            totalBonus: number;
        };
    };
}

export const TIDE_ARCH_START_ROUTE = 148;
export const TIDE_ARCH_RESUME_ROUTE = 198;
export const TIDE_ARCH_APPROACH_DUR = 4.6;
export const TIDE_ARCH_DESCENT_DUR = 3.8;
export const TIDE_ARCH_ASCENT_DUR = 3.8;
export const TIDE_ARCH_BRIDGE_ENTRY_HALF_H = 54;
export const TIDE_ARCH_BRIDGE_EXIT_HALF_H = 58;
export const TIDE_ARCH_CHECKPOINT_BONUS = 1500;
export const TIDE_ARCH_CLEAN_BONUS = 2000;

/** Total distance ahead of playerHomeY where the stone arch bridge center is anchored at approach start. */
export const TIDE_ARCH_INITIAL_LEAD_PX = 930;

const smoothstep = (t: number) => {
    const x = clamp(t, 0, 1);
    return x * x * (3 - 2 * x);
};

/**
 * Computes passable sea opening and physical stone pier bounds for any UP arena width
 * (PC horizontal 608px, Android vertical 384px, or custom test bounds).
 */
export function computeArchOpening(arenaLeft: number, arenaRight: number): TideArchOpening {
    const arenaW = Math.max(240, arenaRight - arenaLeft);
    const pierFrac = arenaW >= 500 ? 0.215 : 0.185;
    const pierLeftWidth = Math.round(arenaW * pierFrac);
    const pierRightWidth = Math.round(arenaW * pierFrac);
    const left = arenaLeft + pierLeftWidth;
    const right = arenaRight - pierRightWidth;
    return {
        left,
        right,
        center: (left + right) * 0.5,
        width: right - left,
        pierLeftWidth,
        pierRightWidth,
    };
}

/**
 * Cliffside cannon batteries placed symmetrically across approach, mid-canyon and exit piers.
 * Coordinates are anchored cleanly to `archWorldY` so cannons never drift independently of rocks.
 */
export const TIDE_ARCH_CANNONS: readonly TideArchCannonSpec[] = [
    // Positive relWorldY = ahead (south) of the arch bridge, encountered first during approach & descent.
    // Turrets sit on jutting cliffside ledges along the water lip so RIVET can target and destroy them cleanly.
    // Alternating & aimed cliffside cannons maintain active pressure from approach through exit
    { id: 'arch-app-l', side: -1, relWorldY: 545, pierDepth: 0.86, pattern: 'alternating', cooldownOffset: 0.50, stage: 'approach' },
    { id: 'arch-app-r', side: 1, relWorldY: 485, pierDepth: 0.86, pattern: 'alternating', cooldownOffset: 1.10, stage: 'approach' },
    { id: 'arch-des-l', side: -1, relWorldY: 325, pierDepth: 0.88, pattern: 'aimed-burst', cooldownOffset: 0.65, stage: 'descent' },
    { id: 'arch-des-r', side: 1, relWorldY: 285, pierDepth: 0.88, pattern: 'fan3', cooldownOffset: 1.28, stage: 'descent' },
    { id: 'arch-low-l', side: -1, relWorldY: 165, pierDepth: 0.90, pattern: 'alternating', cooldownOffset: 0.60, stage: 'low-flight' },
    { id: 'arch-low-r', side: 1, relWorldY: 135, pierDepth: 0.90, pattern: 'alternating', cooldownOffset: 1.22, stage: 'low-flight' },
    { id: 'arch-mouth-l', side: -1, relWorldY: 74, pierDepth: 0.92, pattern: 'sweep', cooldownOffset: 0.78, stage: 'low-flight' },
    { id: 'arch-mouth-r', side: 1, relWorldY: 62, pierDepth: 0.92, pattern: 'alternating', cooldownOffset: 1.38, stage: 'low-flight' },
    // Negative relWorldY = north/exit side emerging right as RIVET passes under & clears the arch.
    { id: 'arch-exit-l', side: -1, relWorldY: -98, pierDepth: 0.88, pattern: 'aimed-burst', cooldownOffset: 0.65, stage: 'under-arch' },
    { id: 'arch-exit-r', side: 1, relWorldY: -128, pierDepth: 0.88, pattern: 'alternating', cooldownOffset: 1.28, stage: 'under-arch' },
];

export const TIDE_ARCH_BOATS: readonly TideArchBoatSpec[] = [
    { id: 'boat-app-1', laneFrac: 0.52, speed: 24, stage: 'approach', cooldownOffset: 0.65 },
    { id: 'boat-des-1', laneFrac: 0.36, speed: 26, stage: 'descent', cooldownOffset: 0.90 },
    { id: 'boat-des-2', laneFrac: 0.64, speed: 25, stage: 'descent', cooldownOffset: 1.50 },
    { id: 'boat-low-1', laneFrac: 0.46, speed: 28, stage: 'low-flight', cooldownOffset: 0.85 },
    { id: 'boat-low-2', laneFrac: 0.60, speed: 27, stage: 'low-flight', cooldownOffset: 1.45 },
    { id: 'boat-exit-1', laneFrac: 0.38, speed: 26, stage: 'under-arch', cooldownOffset: 0.90 },
    { id: 'boat-asc-1', laneFrac: 0.56, speed: 24, stage: 'ascent', cooldownOffset: 0.80 },
];

export interface TideArchStepResult {
    enteredPhase?: TideArchPhase;
    spawnCannons: readonly TideArchCannonSpec[];
    spawnBoats: readonly TideArchBoatSpec[];
    activateCheckpoint: boolean;
}

/**
 * Explicit 7-phase state machine controlling O Arco das Marés (mid-stage Fenda Pelágica).
 * Altitude transitions (`1.0` normal -> `0.0` low-flight -> `1.0` restored) and geometric
 * bridge intersection remain strictly synchronized to scroll world coordinates.
 */
export class TideArchController {
    phase: TideArchPhase = 'idle';
    phaseTime = 0;
    eventElapsed = 0;
    altitude = 1;
    altitudeRestored = true;
    archWorldY = -9999;
    crossedArch = false;
    checkpointReached = false;
    bonusAwarded = false;
    hadDamageDuringArch = false;
    private readonly spawnedCannons = new Set<string>();
    private readonly spawnedBoats = new Set<string>();

    reset(): void {
        this.phase = 'idle';
        this.phaseTime = 0;
        this.eventElapsed = 0;
        this.altitude = 1;
        this.altitudeRestored = true;
        this.archWorldY = -9999;
        this.crossedArch = false;
        this.checkpointReached = false;
        this.bonusAwarded = false;
        this.hadDamageDuringArch = false;
        this.spawnedCannons.clear();
        this.spawnedBoats.clear();
    }

    get isActive(): boolean {
        return (
            this.phase === 'approach' ||
            this.phase === 'descent' ||
            this.phase === 'low-flight' ||
            this.phase === 'under-arch' ||
            this.phase === 'ascent'
        );
    }

    /** True from approach onset until full post-ascent altitude restoration (`altitude === 1`). */
    get airSpawnsBlocked(): boolean {
        return this.isActive;
    }

    get allowsAirResumption(): boolean {
        return (this.phase === 'checkpoint' || this.phase === 'complete' || this.phase === 'idle') && this.altitudeRestored;
    }

    /** Live arch stone bridge center screen Y derived from world anchor and ocean scroll. */
    archScreenY(scroll: number): number {
        return this.archWorldY + scroll;
    }

    /** True when the RIVET overlaps the stone arch bridge band horizontally across the water. */
    isInBridgeBand(scroll: number, playerY: number): boolean {
        if (!this.isActive && this.phase !== 'checkpoint') return false;
        const ay = this.archScreenY(scroll);
        return playerY >= ay - TIDE_ARCH_BRIDGE_ENTRY_HALF_H && playerY <= ay + TIDE_ARCH_BRIDGE_EXIT_HALF_H;
    }

    /** True when stone pillar collision is physically active against lateral cliff piers. */
    isPillarCollisionActive(scroll: number, playerY: number): boolean {
        return (this.phase === 'under-arch' || this.phase === 'low-flight') && this.altitude <= 0.35 && this.isInBridgeBand(scroll, playerY);
    }

    /** Longitudinal sea scroll speed tuned per phase to sustain smooth visual travel and intensity. */
    targetScrollSpeed(): number {
        switch (this.phase) {
            case 'approach': return 40;
            case 'descent': return 38;
            case 'low-flight': return 35;
            case 'under-arch': return 30;
            case 'ascent': return 42;
            default: return 38;
        }
    }

    /** Low-flight Y trim range keeps longitudinal framing convincing without letting up/down skip the arch. */
    playerLongitudinalClamp(arenaTop: number, arenaBottom: number, playerHomeY: number): { minY: number; maxY: number } {
        if (!this.isActive || this.phase === 'approach') {
            return { minY: arenaTop + 16, maxY: arenaBottom - 15 };
        }
        const tLow = 1 - this.altitude;
        const topLimit = arenaTop + 16 + tLow * Math.max(0, playerHomeY - arenaTop - 88);
        const botLimit = arenaBottom - 15 - tLow * 8;
        return {
            minY: Math.min(topLimit, botLimit - 24),
            maxY: botLimit,
        };
    }

    start(scroll: number, playerHomeY: number): void {
        this.phase = 'approach';
        this.phaseTime = 0;
        this.eventElapsed = 0;
        this.altitude = 1;
        this.altitudeRestored = false;
        this.crossedArch = false;
        this.hadDamageDuringArch = false;
        this.spawnedCannons.clear();
        this.spawnedBoats.clear();
        this.archWorldY = playerHomeY - TIDE_ARCH_INITIAL_LEAD_PX - scroll;
    }

    /** Direct deterministic jump used by checkpoint recovery and DevTools inspection. */
    jumpTo(
        stage: Exclude<TideArchPhase, 'idle'>,
        scroll: number,
        playerHomeY: number,
    ): { cannons: TideArchCannonSpec[]; boats: TideArchBoatSpec[] } {
        this.spawnedCannons.clear();
        this.spawnedBoats.clear();
        this.phase = stage;
        this.phaseTime = 0;
        this.crossedArch = stage === 'ascent' || stage === 'checkpoint' || stage === 'complete';
        this.checkpointReached = stage === 'checkpoint' || stage === 'complete';
        if (stage === 'checkpoint' || stage === 'complete') {
            this.bonusAwarded = stage === 'complete';
            this.altitude = 1;
            this.altitudeRestored = true;
            this.archWorldY = playerHomeY + 260 - scroll;
            return { cannons: [], boats: [] };
        }
        this.altitudeRestored = false;
        const leadMap: Record<'approach' | 'descent' | 'low-flight' | 'under-arch' | 'ascent', number> = {
            approach: -640,
            descent: -380,
            'low-flight': -175,
            'under-arch': -26,
            ascent: 88,
        };
        this.archWorldY = playerHomeY + leadMap[stage] - scroll;
        this.altitude = stage === 'approach' ? 1 : stage === 'descent' ? 0.55 : stage === 'ascent' ? 0.25 : 0;

        const cannons = stage === 'ascent'
            ? []
            : this.collectCannonsDue(scroll, stage).filter(c => {
                const sy = this.archWorldY + c.relWorldY + scroll;
                return sy >= -120 && sy <= playerHomeY + 55;
            });
        const boats = this.collectBoatsDue(stage);
        return { cannons, boats };
    }

    step(dt: number, route: number, scroll: number, playerY: number, playerHomeY: number): TideArchStepResult {
        const res: TideArchStepResult = { spawnCannons: [], spawnBoats: [], activateCheckpoint: false };
        if (this.phase === 'idle' && !this.checkpointReached && route >= TIDE_ARCH_START_ROUTE && route < TIDE_ARCH_RESUME_ROUTE) {
            this.start(scroll, playerHomeY);
            res.enteredPhase = 'approach';
            res.spawnCannons = this.collectCannonsDue(scroll, 'approach');
            res.spawnBoats = this.collectBoatsDue('approach');
            return res;
        }
        if (this.phase === 'idle' || this.phase === 'complete') return res;

        this.phaseTime += dt;
        this.eventElapsed += dt;
        const archY = this.archScreenY(scroll);

        if (this.phase === 'approach') {
            this.altitude = 1;
            this.altitudeRestored = false;
            if (this.phaseTime >= TIDE_ARCH_APPROACH_DUR) {
                this.transitionTo('descent', res);
                res.spawnCannons = this.collectCannonsDue(scroll, 'descent');
                res.spawnBoats = this.collectBoatsDue('descent');
            }
            return res;
        }

        if (this.phase === 'descent') {
            const u = clamp(this.phaseTime / TIDE_ARCH_DESCENT_DUR, 0, 1);
            this.altitude = 1 - smoothstep(u);
            this.altitudeRestored = false;
            if (u >= 1) {
                this.altitude = 0;
                this.transitionTo('low-flight', res);
                res.spawnCannons = this.collectCannonsDue(scroll, 'low-flight');
                res.spawnBoats = this.collectBoatsDue('low-flight');
            }
            return res;
        }

        if (this.phase === 'low-flight') {
            this.altitude = 0;
            this.altitudeRestored = false;
            res.spawnCannons = this.collectCannonsDue(scroll, 'low-flight');
            if (archY >= playerY - TIDE_ARCH_BRIDGE_ENTRY_HALF_H) {
                this.transitionTo('under-arch', res);
                res.spawnCannons = [...res.spawnCannons, ...this.collectCannonsDue(scroll, 'under-arch')];
                res.spawnBoats = this.collectBoatsDue('under-arch');
            }
            return res;
        }

        if (this.phase === 'under-arch') {
            this.altitude = 0;
            this.altitudeRestored = false;
            if (archY > playerY + TIDE_ARCH_BRIDGE_EXIT_HALF_H) {
                this.crossedArch = true;
                this.transitionTo('ascent', res);
                res.spawnBoats = this.collectBoatsDue('ascent');
            }
            return res;
        }

        if (this.phase === 'ascent') {
            const u = clamp(this.phaseTime / TIDE_ARCH_ASCENT_DUR, 0, 1);
            this.altitude = smoothstep(u);
            this.altitudeRestored = false;
            if (u >= 1 && this.crossedArch) {
                this.altitude = 1;
                this.altitudeRestored = true;
                this.checkpointReached = true;
                this.transitionTo('checkpoint', res);
                res.activateCheckpoint = true;
            }
            return res;
        }

        if (this.phase === 'checkpoint') {
            this.altitude = 1;
            this.altitudeRestored = true;
            if (this.phaseTime >= 1.25) {
                this.transitionTo('complete', res);
            }
        }
        return res;
    }

    private transitionTo(next: TideArchPhase, res: TideArchStepResult): void {
        this.phase = next;
        this.phaseTime = 0;
        res.enteredPhase = next;
    }

    private collectCannonsDue(
        scroll: number,
        stage: 'approach' | 'descent' | 'low-flight' | 'under-arch',
    ): TideArchCannonSpec[] {
        const order: Record<string, number> = { approach: 0, descent: 1, 'low-flight': 2, 'under-arch': 3 };
        const curIdx = order[stage] ?? 0;
        const out: TideArchCannonSpec[] = [];
        for (const c of TIDE_ARCH_CANNONS) {
            if (this.spawnedCannons.has(c.id)) continue;
            const cIdx = order[c.stage] ?? 9;
            const worldScreenY = this.archWorldY + c.relWorldY + scroll;
            if (cIdx <= curIdx && (cIdx < curIdx || worldScreenY >= -190 || stage === 'approach')) {
                this.spawnedCannons.add(c.id);
                out.push(c);
            }
        }
        return out;
    }

    private collectBoatsDue(stage: 'approach' | 'descent' | 'low-flight' | 'under-arch' | 'ascent'): TideArchBoatSpec[] {
        const order: Record<string, number> = { approach: 0, descent: 1, 'low-flight': 2, 'under-arch': 3, ascent: 4 };
        const curIdx = order[stage] ?? 0;
        const out: TideArchBoatSpec[] = [];
        for (const b of TIDE_ARCH_BOATS) {
            if (this.spawnedBoats.has(b.id)) continue;
            if ((order[b.stage] ?? 9) <= curIdx) {
                this.spawnedBoats.add(b.id);
                out.push(b);
            }
        }
        return out;
    }
}
