import type { Encounter, EntrySide } from './content.ts';
import { DIFFICULTY_PROFILES, type GameDifficulty } from './PelagicDifficulty.ts';
import { FENDA_STAGE_DURATION, isFamilyUnlockedAtFendaRoute } from './PelagicProgression.ts';
import { TIDE_ARCH_START_ROUTE } from './PelagicTideArch.ts';
import type { UpLayoutMode } from './ArcadeWorld.ts';

export interface DirectorLogEntry {
    at: number;
    region: number;
    kind: 'anticipate' | 'reinforce' | 'suppress';
    detail: string;
}

export interface PelagicPacingSnapshot {
    playableSeconds: number;
    visibleEnemySeconds: number;
    threatSeconds: number;
    pctWithVisibleEnemy: number;
    pctWithThreat: number;
    maxEnemyGapSeconds: number;
    maxThreatGapSeconds: number;
    idleGapsOver2s: number;
    idleGapsOver3s: number;
    totalEncounters: number;
    totalEnemyShots: number;
    enemyShotsPerMinute: number;
    peakSimultaneousEnemies: number;
    peakSimultaneousBullets: number;
    reinforcementsSpawned: number;
    wavesAnticipated: number;
    bossDurationSeconds: number;
    bossShotsFired: number;
    bossShotsPerMinute: number;
    suppressedReason: string | null;
    timelineLog: readonly DirectorLogEntry[];
}

export interface DirectorDecision {
    kind: 'none' | 'anticipate' | 'reinforce' | 'arch-boat';
    reason: string;
    encounter?: Omit<Encounter, 'at'>;
}

export interface DirectorContext {
    up: boolean;
    dt: number;
    route: number;
    region: number;
    upLayout: UpLayoutMode;
    arenaWidth: number;
    difficulty?: GameDifficulty;
    effectiveHard: boolean;
    isAssisted: boolean;
    inBossFight: boolean;
    tideArchActive: boolean;
    tideArchPhase: string;
    playerInvulnerable: number;
    playerX: number;
    arenaCenterX: number;
    visibleEnemies: number;
    approachingEnemies: number;
    activeEnemyBullets: number;
    hasActiveWarning: boolean;
    frameEnemyShots: number;
    nextEncounter?: Encounter;
    specialEventActive: boolean;
}

/**
 * Real-time deterministic pacing controller & metrics tracker for Fenda Pelagica.
 * Anticipates upcoming scripted encounters when fast-clearing players empty the arena,
 * injects tightly capped, biome-accurate reinforcements only during prolonged dead air,
 * and respects post-death recovery windows, Tide Arch boundaries, and Boss phases.
 */
export class PelagicCombatDirector {
    private playableSeconds = 0;
    private visibleEnemySeconds = 0;
    private threatSeconds = 0;
    private emptySeconds = 0;
    private noThreatSeconds = 0;
    private maxEnemyGapSeconds = 0;
    private maxThreatGapSeconds = 0;
    private idleGapsOver2s = 0;
    private idleGapsOver3s = 0;
    private inGap2 = false;
    private inGap3 = false;

    private totalEncounters = 0;
    private totalEnemyShots = 0;
    private peakSimultaneousEnemies = 0;
    private peakSimultaneousBullets = 0;

    private bossDurationSeconds = 0;
    private bossShotsFired = 0;

    private reinforcementsSpawned = 0;
    private wavesAnticipated = 0;
    private sectorReinforcements = new Map<number, number>();
    private lastReinforceAt = -99;
    private reinforceSideToggle: EntrySide = 'left';
    private reinforceVariant = 0;
    private archBoatsInjected = 0;
    private lastArchBoatAt = -99;
    private suppressedReason: string | null = null;
    private lastSuppressionLogAt = -99;
    private timelineLog: DirectorLogEntry[] = [];

    reset(): void {
        this.playableSeconds = 0;
        this.visibleEnemySeconds = 0;
        this.threatSeconds = 0;
        this.emptySeconds = 0;
        this.noThreatSeconds = 0;
        this.maxEnemyGapSeconds = 0;
        this.maxThreatGapSeconds = 0;
        this.idleGapsOver2s = 0;
        this.idleGapsOver3s = 0;
        this.inGap2 = false;
        this.inGap3 = false;
        this.totalEncounters = 0;
        this.totalEnemyShots = 0;
        this.peakSimultaneousEnemies = 0;
        this.peakSimultaneousBullets = 0;
        this.bossDurationSeconds = 0;
        this.bossShotsFired = 0;
        this.reinforcementsSpawned = 0;
        this.wavesAnticipated = 0;
        this.sectorReinforcements.clear();
        this.lastReinforceAt = -99;
        this.reinforceSideToggle = 'left';
        this.reinforceVariant = 0;
        this.archBoatsInjected = 0;
        this.lastArchBoatAt = -99;
        this.suppressedReason = null;
        this.lastSuppressionLogAt = -99;
        this.timelineLog = [];
    }

    noteEncounterSpawned(): void {
        this.totalEncounters++;
    }

    evaluate(ctx: DirectorContext): DirectorDecision {
        if (!ctx.up) return { kind: 'none', reason: 'side-mode' };

        if (ctx.inBossFight) {
            this.bossDurationSeconds += ctx.dt;
            this.bossShotsFired += ctx.frameEnemyShots;
            this.suppressedReason = 'boss-fight';
            return { kind: 'none', reason: 'boss-fight' };
        }

        if (ctx.route < FENDA_STAGE_DURATION) {
            this.playableSeconds += ctx.dt;
            this.totalEnemyShots += ctx.frameEnemyShots;
            this.peakSimultaneousEnemies = Math.max(this.peakSimultaneousEnemies, ctx.visibleEnemies);
            this.peakSimultaneousBullets = Math.max(this.peakSimultaneousBullets, ctx.activeEnemyBullets);

            if (ctx.visibleEnemies > 0) {
                this.visibleEnemySeconds += ctx.dt;
                this.emptySeconds = 0;
            } else {
                this.emptySeconds += ctx.dt;
                this.maxEnemyGapSeconds = Math.max(this.maxEnemyGapSeconds, this.emptySeconds);
            }

            const hasThreat = ctx.visibleEnemies > 0 || ctx.activeEnemyBullets > 0 || ctx.hasActiveWarning;
            if (hasThreat) {
                this.threatSeconds += ctx.dt;
                this.noThreatSeconds = 0;
                this.inGap2 = false;
                this.inGap3 = false;
            } else {
                this.noThreatSeconds += ctx.dt;
                this.maxThreatGapSeconds = Math.max(this.maxThreatGapSeconds, this.noThreatSeconds);
                if (this.noThreatSeconds >= 2 && !this.inGap2) {
                    this.idleGapsOver2s++;
                    this.inGap2 = true;
                }
                if (this.noThreatSeconds >= 3 && !this.inGap3) {
                    this.idleGapsOver3s++;
                    this.inGap3 = true;
                }
            }
        }

        // Strict suppression windows: never punish recovery or disrupt intentional pauses
        if (ctx.route < 1.0) {
            this.suppressedReason = 'opening-buffer';
            return { kind: 'none', reason: 'opening-buffer' };
        }
        if (ctx.route >= FENDA_STAGE_DURATION - 2.8) {
            this.suppressedReason = 'pre-boss-buildup';
            return { kind: 'none', reason: 'pre-boss-buildup' };
        }
        if (ctx.playerInvulnerable > 1.25) {
            this.logSuppression(ctx.route, ctx.region, 'post-death-recovery');
            return { kind: 'none', reason: 'post-death-recovery' };
        }

        const diff: GameDifficulty = ctx.isAssisted ? 'easy' : (ctx.difficulty ?? (ctx.effectiveHard ? 'normal' : 'easy'));
        const cfg = DIFFICULTY_PROFILES[diff].director;

        // During Tide Arch, aircraft stay grounded; allow spaced patrol boats when canal clears
        if (ctx.tideArchActive) {
            if (
                this.archBoatsInjected < cfg.maxArchBoats &&
                ctx.route - this.lastArchBoatAt >= (diff === 'hard' ? 3.2 : 4.0) &&
                (ctx.tideArchPhase === 'descent' || ctx.tideArchPhase === 'low-flight' || ctx.tideArchPhase === 'under-arch' || ctx.tideArchPhase === 'ascent') &&
                ctx.visibleEnemies <= (diff === 'hard' ? 1 : 0) &&
                ctx.approachingEnemies === 0 &&
                ctx.activeEnemyBullets <= (diff === 'hard' ? 4 : 1) &&
                (diff === 'hard' || this.emptySeconds >= 1.5)
            ) {
                this.archBoatsInjected++;
                this.lastArchBoatAt = ctx.route;
                this.logEvent(ctx.route, ctx.region, 'reinforce', `arch-patrol-boat#${this.archBoatsInjected}`);
                this.suppressedReason = null;
                return { kind: 'arch-boat', reason: 'arch-canal-empty' };
            }
            this.logSuppression(ctx.route, ctx.region, `tide-arch:${ctx.tideArchPhase}`);
            return { kind: 'none', reason: 'tide-arch-active' };
        }

        // Keep deliberate short breathing buffer right before Tide Arch entry (177.6..180s)
        if (ctx.route >= TIDE_ARCH_START_ROUTE - 2.4 && ctx.route < TIDE_ARCH_START_ROUTE) {
            this.suppressedReason = 'pre-arch-window';
            return { kind: 'none', reason: 'pre-arch-window' };
        }

        const narrowArena = ctx.upLayout === 'portrait' || ctx.arenaWidth <= 420;
        const softMaxEnemies = narrowArena ? cfg.softMaxEnemiesPortrait : cfg.softMaxEnemiesPc;
        const softMaxBullets = narrowArena ? cfg.softMaxBulletsPortrait : cfg.softMaxBulletsPc;
        if (ctx.visibleEnemies + ctx.approachingEnemies >= softMaxEnemies || ctx.activeEnemyBullets >= softMaxBullets) {
            this.logSuppression(ctx.route, ctx.region, 'high-density');
            return { kind: 'none', reason: 'high-density' };
        }

        if (ctx.specialEventActive && ctx.visibleEnemies >= (diff === 'hard' ? 10 : 2)) {
            this.suppressedReason = 'special-event';
            return { kind: 'none', reason: 'special-event' };
        }

        // Priority 1: Smoothly pull forward the next authored encounter only by a short window
        // Never pull an encounter across a region unlock boundary, Tide Arch boundary, or Boss boundary!
        const next = ctx.nextEncounter;
        if (next && next.at < FENDA_STAGE_DURATION) {
            const lead = next.at - ctx.route;
            const crossesRegionBoundary =
                (ctx.route < 60 && next.at >= 60) ||
                (ctx.route < 115 && next.at >= 115) ||
                (ctx.route < 160 && next.at >= 160) ||
                (ctx.route < 240 && next.at >= 240) ||
                (ctx.route < 300 && next.at >= 300);
            const crossesUnlockThreshold = !isFamilyUnlockedAtFendaRoute(next.family, ctx.route);
            const crossesArchBoundary = ctx.route < TIDE_ARCH_START_ROUTE && next.at >= TIDE_ARCH_START_ROUTE;
            const crossesBossBoundary = ctx.route < FENDA_STAGE_DURATION - 4 && next.at >= FENDA_STAGE_DURATION - 4;
            const lowPressureForAnticipate = diff === 'hard'
                ? ctx.visibleEnemies <= (narrowArena ? 3 : 4)
                : ctx.visibleEnemies === 0 && ctx.approachingEnemies === 0 && this.emptySeconds >= cfg.minEmptyForAnticipate;
            if (
                !crossesRegionBoundary &&
                !crossesUnlockThreshold &&
                !crossesArchBoundary &&
                !crossesBossBoundary &&
                lead > 0 &&
                lead <= cfg.maxLead &&
                lowPressureForAnticipate &&
                ctx.activeEnemyBullets <= (diff === 'hard' ? 14 : 2)
            ) {
                this.wavesAnticipated++;
                this.suppressedReason = null;
                this.logEvent(ctx.route, ctx.region, 'anticipate', `wave@${next.at}s(${next.family})`);
                return { kind: 'anticipate', reason: 'fast-clear-anticipation' };
            }
        }

        // Priority 2: Difficulty-scaled tactical reinforcements to eliminate dead air and sustain intended pressure
        const sectorUsed = this.sectorReinforcements.get(ctx.region) ?? 0;
        const sectorCap = ctx.region === 3 ? cfg.region3Cap : ctx.region === 4 ? cfg.region4Cap : cfg.sectorCap;
        const rawMinTrigger = narrowArena ? cfg.minEnemiesForReinforcePortrait : cfg.minEnemiesForReinforcePc;
        const minEnemiesTrigger = ctx.route < 28 ? Math.min(2, rawMinTrigger) : rawMinTrigger;
        const maxApproaching = diff === 'hard' ? 3 : 0;
        const needsDensity = diff === 'hard'
            ? (ctx.visibleEnemies === 0 && this.emptySeconds >= cfg.reinforceDelay) ||
            (ctx.visibleEnemies <= minEnemiesTrigger && ctx.route - this.lastReinforceAt >= cfg.minSpacing)
            : (ctx.visibleEnemies === 0 && this.emptySeconds >= cfg.reinforceDelay);
        const nextFarEnough = !next || next.at - ctx.route > (diff === 'hard' ? 0.55 : diff === 'normal' ? 0.95 : 1.5);

        if (
            needsDensity &&
            ctx.approachingEnemies <= maxApproaching &&
            ctx.activeEnemyBullets <= (diff === 'hard' ? softMaxBullets * 0.65 : 4) &&
            sectorUsed < sectorCap &&
            ctx.route - this.lastReinforceAt >= cfg.minSpacing &&
            !(ctx.region === 3 && ctx.route >= (diff === 'hard' ? TIDE_ARCH_START_ROUTE - 4.5 : TIDE_ARCH_START_ROUTE - 3.2)) &&
            nextFarEnough
        ) {
            this.reinforcementsSpawned++;
            this.sectorReinforcements.set(ctx.region, sectorUsed + 1);
            this.lastReinforceAt = ctx.route;
            const encounter = this.buildReinforcement(ctx.region, ctx.route, diff, ctx.playerX, ctx.arenaCenterX);
            this.suppressedReason = null;
            this.logEvent(ctx.route, ctx.region, 'reinforce', `${encounter.family}/${encounter.formation}/${encounter.motion}`);
            return { kind: 'reinforce', reason: 'prolonged-idle-fill', encounter };
        }

        this.suppressedReason = null;
        return { kind: 'none', reason: 'steady-flow' };
    }

    private buildReinforcement(region: number, route: number, diff: GameDifficulty, playerX: number, arenaCenterX: number): Omit<Encounter, 'at'> {
        const hard = diff !== 'easy';
        const extreme = diff === 'hard';
        const entry: EntrySide = this.reinforceSideToggle;
        this.reinforceSideToggle = entry === 'left' ? 'right' : 'left';
        const v = this.reinforceVariant++;
        const awayLane = playerX < arenaCenterX ? 0.68 : 0.32;

        // Region 0 (0-60s, Céu Aberto): strictly conventional propeller planes (NO yellow jet, boats, helis, subs)
        if (region === 0) {
            const opts: Omit<Encounter, 'at'>[] = [
                { family: 'fighter', formation: extreme ? 'v' : hard ? 'trio' : 'pair', motion: 'side-curve', lane: 0.24, speed: 118, entry },
                { family: 'acrobat', formation: extreme ? 'quartet' : 'pair', motion: 'diagonal', lane: awayLane, speed: 110 },
                { family: 'fighter', formation: extreme ? 'trio' : 'pair', motion: 'sine', lane: awayLane, speed: 108 },
            ];
            return opts[v % opts.length];
        }
        // Region 1 (60-115s, Costa Coral): conventional planes + boat (NO yellow jet, coastal, helis, subs)
        if (region === 1) {
            const opts: Omit<Encounter, 'at'>[] = [
                { family: 'fighter', formation: extreme ? 'horde' : hard ? 'trio' : 'pair', motion: 'curve', lane: awayLane, speed: 114 },
                { family: 'acrobat', formation: extreme ? 'quartet' : 'pair', motion: 'side-curve', lane: 0.24, speed: 122, entry },
                { family: 'boat', formation: extreme ? 'pair' : 'solo', motion: 'stationary', lane: awayLane > 0.5 ? 0.72 : 0.34 },
            ];
            return opts[v % opts.length];
        }
        // Region 2 (115-160s, Arquipélago): adds interceptor (NO subs, NO helis)
        if (region === 2) {
            const opts: Omit<Encounter, 'at'>[] = [
                { family: 'interceptor', formation: extreme ? 'trio' : 'pair', motion: 'side-cross', lane: 0.20, speed: 162, entry },
                { family: 'fighter', formation: extreme ? 'v' : hard ? 'trio' : 'pair', motion: 'curve', lane: awayLane, speed: 114 },
                { family: 'boat', formation: extreme ? 'pair' : 'solo', motion: 'stationary', lane: awayLane > 0.5 ? 0.72 : 0.34 },
                { family: 'acrobat', formation: extreme ? 'quartet' : 'pair', motion: 'side-curve', lane: 0.24, speed: 124, entry },
            ];
            return opts[v % opts.length];
        }
        // Region 3 (160-180s, Corrente Expressa): fast readable air passes (NO helis)
        if (region === 3) {
            const opts: Omit<Encounter, 'at'>[] = [
                { family: 'interceptor', formation: extreme ? 'pair' : 'solo', motion: 'side-cross', lane: 0.22, speed: 164, entry },
                { family: 'fighter', formation: extreme ? 'trio' : 'pair', motion: 'side-curve', lane: 0.24, speed: 124, entry },
            ];
            return opts[v % opts.length];
        }
        // Region 4 post-arch (214-240s, Arco das Marés): air/naval resume (STILL NO helicopters!)
        if (region === 4) {
            const opts: Omit<Encounter, 'at'>[] = [
                { family: 'fighter', formation: extreme ? 'v' : hard ? 'trio' : 'pair', motion: 'side-curve', lane: 0.24, speed: 124, entry },
                { family: 'interceptor', formation: extreme ? 'trio' : 'pair', motion: 'diagonal', lane: awayLane, speed: 156 },
                { family: 'acrobat', formation: extreme ? 'quartet' : hard ? 'trio' : 'pair', motion: 'side-cross', lane: 0.22, speed: 126, entry },
                { family: 'boat', formation: extreme ? 'pair' : 'solo', motion: 'stationary', lane: awayLane > 0.5 ? 0.70 : 0.34 },
            ];
            return opts[v % opts.length];
        }
        // Region 5 (240-300s, Mar das Turbinas): progressive helicopters + jets/planes
        if (region === 5) {
            const opts: Omit<Encounter, 'at'>[] = [
                { family: 'heli_scout', formation: extreme ? 'trio' : 'pair', motion: 'sine', lane: awayLane, speed: 114 },
                { family: 'interceptor', formation: extreme ? 'trio' : 'pair', motion: 'diagonal', lane: awayLane, speed: 158 },
                { family: 'fighter', formation: extreme ? 'v' : hard ? 'trio' : 'pair', motion: 'side-curve', lane: 0.24, speed: 124, entry },
                ...(route >= 254 ? [{ family: 'heli_utility' as const, formation: (extreme ? 'pair' : 'solo') as 'pair' | 'solo', motion: 'stationary' as const, lane: awayLane, speed: 76 }] : []),
                ...(extreme && route >= 268 ? [{ family: 'heli_phantom' as const, formation: 'pair' as const, motion: 'side-curve' as const, lane: 0.24, speed: 130, entry }] : []),
            ];
            return opts[v % opts.length];
        }
        // Region 6 (300-360s, Fenda Pelágica): full arsenal escalation
        const lateOpts: Omit<Encounter, 'at'>[] = [
            { family: 'interceptor', formation: extreme ? 'quartet' : hard ? 'trio' : 'pair', motion: 'side-cross', lane: 0.22, speed: 168, entry },
            { family: 'heli_phantom', formation: extreme ? 'trio' : hard ? 'pair' : 'solo', motion: 'side-curve', lane: 0.24, speed: 128, entry },
            { family: 'fighter', formation: extreme ? 'v' : 'trio', motion: 'accelerate', lane: awayLane, speed: 120 },
            { family: 'heli_scout', formation: extreme ? 'trio' : 'pair', motion: 'side-curve', lane: 0.22, speed: 120, entry },
        ];
        return lateOpts[v % lateOpts.length];
    }

    private logSuppression(route: number, region: number, reason: string): void {
        this.suppressedReason = reason;
        if (route - this.lastSuppressionLogAt >= 6) {
            this.lastSuppressionLogAt = route;
            this.logEvent(route, region, 'suppress', reason);
        }
    }

    private logEvent(route: number, region: number, kind: DirectorLogEntry['kind'], detail: string): void {
        this.timelineLog.push({ at: Number(route.toFixed(1)), region, kind, detail });
        if (this.timelineLog.length > 40) this.timelineLog.shift();
    }

    snapshot(): PelagicPacingSnapshot {
        const play = Math.max(0.001, this.playableSeconds);
        const bossDur = Math.max(0, this.bossDurationSeconds);
        return {
            playableSeconds: Number(this.playableSeconds.toFixed(1)),
            visibleEnemySeconds: Number(this.visibleEnemySeconds.toFixed(1)),
            threatSeconds: Number(this.threatSeconds.toFixed(1)),
            pctWithVisibleEnemy: Number(((this.visibleEnemySeconds / play) * 100).toFixed(1)),
            pctWithThreat: Number(((this.threatSeconds / play) * 100).toFixed(1)),
            maxEnemyGapSeconds: Number(this.maxEnemyGapSeconds.toFixed(2)),
            maxThreatGapSeconds: Number(this.maxThreatGapSeconds.toFixed(2)),
            idleGapsOver2s: this.idleGapsOver2s,
            idleGapsOver3s: this.idleGapsOver3s,
            totalEncounters: this.totalEncounters,
            totalEnemyShots: this.totalEnemyShots,
            enemyShotsPerMinute: Number(((this.totalEnemyShots / play) * 60).toFixed(1)),
            peakSimultaneousEnemies: this.peakSimultaneousEnemies,
            peakSimultaneousBullets: this.peakSimultaneousBullets,
            reinforcementsSpawned: this.reinforcementsSpawned,
            wavesAnticipated: this.wavesAnticipated,
            bossDurationSeconds: Number(bossDur.toFixed(1)),
            bossShotsFired: this.bossShotsFired,
            bossShotsPerMinute: bossDur > 0 ? Number(((this.bossShotsFired / bossDur) * 60).toFixed(1)) : 0,
            suppressedReason: this.suppressedReason,
            timelineLog: [...this.timelineLog],
        };
    }
}
