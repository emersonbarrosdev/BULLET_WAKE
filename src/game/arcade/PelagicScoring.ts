import type { SubModuleKind } from './PelagicSubmarineBoss.ts';

/**
 * Deterministic arcade scoring rules for Fenda Pelágica (Stage 1 / UP).
 * Base enemy values remain unchanged in `FAMILY`; this module computes and
 * guards finite skill bonuses so neither casual nor hardcore runs are skewed.
 */

export const PELAGIC_SECTOR_SURVIVAL_BONUS = [400, 400, 500, 500, 650, 650, 800] as const;

export const PELAGIC_MINI_BASE_CLEAR = 3000;
export const PELAGIC_MINI_NODEATH_BONUS = 1000;
export const PELAGIC_MINI_FAST_THRESHOLDS = { fast: 26, fastBonus: 500, solid: 38, solidBonus: 250 } as const;

export const PELAGIC_BOSS_BASE_CLEAR = 12000;
export const PELAGIC_BOSS_NODEATH_BONUS = 3000;
export const PELAGIC_BOSS_FAST_THRESHOLDS = { fast: 95, fastBonus: 1500, solid: 130, solidBonus: 750 } as const;

export const SUB_MODULE_LABELS: Record<SubModuleKind, string> = {
    turret: 'TORRETA',
    launcher: 'LANÇADOR',
    armor: 'BLINDAGEM',
    bridge: 'PONTE',
    propeller: 'HÉLICE',
    reactor: 'REATOR',
};

export interface PelagicScoreBreakdown {
    formationBonus: number;
    survivalBonus: number;
    bossBonus: number;
    specialBonus: number;
    formationsCleared: number;
    sectorsClean: number;
    bossPartsDestroyed: number;
    totalBonus: number;
}

interface SquadEntry {
    size: number;
    remaining: number;
    hard: boolean;
    failed: boolean;
    awarded: boolean;
}

/** Multi-member formation clear reward: scales by squadron count and Hard mode, 0 for solo units. */
export function formationBonusPoints(size: number, hard: boolean): number {
    if (size < 2) return 0;
    const tier = size >= 5 ? 200 : size >= 4 ? 100 : 0;
    const base = size * 100 + tier;
    return Math.round((base * (hard ? 1.2 : 1)) / 10) * 10;
}

/** Clean sector traversal reward (0..6). Returns 0 outside valid sector indices. */
export function sectorSurvivalBonus(sector: number, hard: boolean): number {
    const base = PELAGIC_SECTOR_SURVIVAL_BONUS[sector];
    if (!base) return 0;
    return Math.round((base * (hard ? 1.2 : 1)) / 10) * 10;
}

/** Performance bonus on defeating miniboss or Colosso Abissal without stalling exploits. */
export function bossPerformanceBonus(
    mini: boolean,
    noDeath: boolean,
    fightSeconds: number,
    hard: boolean,
): number {
    const mult = hard ? 1.2 : 1;
    if (mini) {
        const clean = noDeath ? PELAGIC_MINI_NODEATH_BONUS : 0;
        const pace = fightSeconds <= PELAGIC_MINI_FAST_THRESHOLDS.fast
            ? PELAGIC_MINI_FAST_THRESHOLDS.fastBonus
            : fightSeconds <= PELAGIC_MINI_FAST_THRESHOLDS.solid
                ? PELAGIC_MINI_FAST_THRESHOLDS.solidBonus
                : 0;
        return Math.round(((clean + pace) * mult) / 10) * 10;
    }
    const clean = noDeath ? PELAGIC_BOSS_NODEATH_BONUS : 0;
    const pace = fightSeconds <= PELAGIC_BOSS_FAST_THRESHOLDS.fast
        ? PELAGIC_BOSS_FAST_THRESHOLDS.fastBonus
        : fightSeconds <= PELAGIC_BOSS_FAST_THRESHOLDS.solid
            ? PELAGIC_BOSS_FAST_THRESHOLDS.solidBonus
            : 0;
    return Math.round(((clean + pace) * mult) / 10) * 10;
}

/** Stateful per-sortie tracker for Fenda Pelágica scoring invariants. */
export class PelagicScoringTracker {
    private squadSeq = 0;
    private squads = new Map<number, SquadEntry>();
    private currentSector = 0;
    private sectorHadDeath = false;
    private awardedSectors = new Set<number>();
    private finalSectorChecked = false;

    private miniActive = false;
    private miniHadDeath = false;
    private miniElapsed = 0;
    private miniAwarded = false;

    private bossActive = false;
    private bossHadDeath = false;
    private bossElapsed = 0;
    private bossAwarded = false;

    private brokenParts = new Set<number>();
    private brokenSubModules = new Set<number>();
    private brokenSubHulls = new Set<number>();

    private totals: PelagicScoreBreakdown = {
        formationBonus: 0,
        survivalBonus: 0,
        bossBonus: 0,
        specialBonus: 0,
        formationsCleared: 0,
        sectorsClean: 0,
        bossPartsDestroyed: 0,
        totalBonus: 0,
    };

    registerSquad(size: number, hard: boolean): number | undefined {
        if (size < 2) return undefined;
        const id = ++this.squadSeq;
        this.squads.set(id, { size, remaining: size, hard, failed: false, awarded: false });
        return id;
    }

    onSquadMemberKilled(squadId?: number): { bonus: number; size: number } | null {
        if (!squadId) return null;
        const s = this.squads.get(squadId);
        if (!s || s.awarded) return null;
        s.remaining = Math.max(0, s.remaining - 1);
        if (s.remaining > 0) return null;
        s.awarded = true;
        this.squads.delete(squadId);
        if (s.failed) return null;
        const bonus = formationBonusPoints(s.size, s.hard);
        if (bonus <= 0) return null;
        this.totals.formationBonus += bonus;
        this.totals.formationsCleared++;
        this.totals.totalBonus += bonus;
        return { bonus, size: s.size };
    }

    onSquadMemberEscaped(squadId?: number): void {
        if (!squadId) return;
        const s = this.squads.get(squadId);
        if (!s || s.awarded) return;
        s.failed = true;
        s.remaining = Math.max(0, s.remaining - 1);
        if (s.remaining === 0) this.squads.delete(squadId);
    }

    advanceSector(newRegion: number, route: number, hard: boolean): Array<{ sector: number; bonus: number }> {
        const awards: Array<{ sector: number; bonus: number }> = [];
        if (newRegion > this.currentSector) {
            for (let s = this.currentSector; s < newRegion; s++) {
                const eligible = s === this.currentSector && !this.sectorHadDeath && !this.awardedSectors.has(s);
                if (eligible) {
                    const bonus = sectorSurvivalBonus(s, hard);
                    this.awardedSectors.add(s);
                    if (bonus > 0) {
                        this.totals.survivalBonus += bonus;
                        this.totals.sectorsClean++;
                        this.totals.totalBonus += bonus;
                        awards.push({ sector: s, bonus });
                    }
                }
            }
            this.currentSector = newRegion;
            this.sectorHadDeath = false;
        }
        if (route >= 360 && !this.finalSectorChecked) {
            this.finalSectorChecked = true;
            if (!this.sectorHadDeath && !this.awardedSectors.has(6)) {
                const bonus = sectorSurvivalBonus(6, hard);
                this.awardedSectors.add(6);
                if (bonus > 0) {
                    this.totals.survivalBonus += bonus;
                    this.totals.sectorsClean++;
                    this.totals.totalBonus += bonus;
                    awards.push({ sector: 6, bonus });
                }
            }
            this.sectorHadDeath = false;
        }
        return awards;
    }

    onPlayerDeath(): void {
        this.sectorHadDeath = true;
        if (this.miniActive) this.miniHadDeath = true;
        if (this.bossActive) this.bossHadDeath = true;
    }

    onBossStart(mini: boolean): void {
        if (mini) {
            this.miniActive = true;
            this.miniHadDeath = false;
            this.miniElapsed = 0;
            this.miniAwarded = false;
        } else {
            this.bossActive = true;
            this.bossHadDeath = false;
            this.bossElapsed = 0;
            this.bossAwarded = false;
        }
    }

    tickBoss(mini: boolean, dt: number): void {
        if (mini && this.miniActive) this.miniElapsed += dt;
        else if (!mini && this.bossActive) this.bossElapsed += dt;
    }

    recordBossPartDestroyed(partId: number): boolean {
        if (this.brokenParts.has(partId)) return false;
        this.brokenParts.add(partId);
        this.totals.bossPartsDestroyed++;
        return true;
    }

    recordSubModuleDestroyed(moduleId: number): boolean {
        if (this.brokenSubModules.has(moduleId)) return false;
        this.brokenSubModules.add(moduleId);
        this.totals.bossPartsDestroyed++;
        return true;
    }

    recordSubHullDestroyed(secIndex: number): boolean {
        if (this.brokenSubHulls.has(secIndex)) return false;
        this.brokenSubHulls.add(secIndex);
        return true;
    }

    completeBoss(mini: boolean, hard: boolean): { bonus: number; noDeath: boolean } {
        if (mini) {
            this.miniActive = false;
            if (this.miniAwarded) return { bonus: 0, noDeath: !this.miniHadDeath };
            this.miniAwarded = true;
            const bonus = bossPerformanceBonus(true, !this.miniHadDeath, this.miniElapsed, hard);
            this.totals.bossBonus += bonus;
            this.totals.totalBonus += bonus;
            return { bonus, noDeath: !this.miniHadDeath };
        }
        this.bossActive = false;
        if (this.bossAwarded) return { bonus: 0, noDeath: !this.bossHadDeath };
        this.bossAwarded = true;
        const bonus = bossPerformanceBonus(false, !this.bossHadDeath, this.bossElapsed, hard);
        this.totals.bossBonus += bonus;
        this.totals.totalBonus += bonus;
        return { bonus, noDeath: !this.bossHadDeath };
    }

    recordSpecialBonus(amount: number): void {
        if (amount <= 0) return;
        this.totals.specialBonus += amount;
        this.totals.totalBonus += amount;
    }

    snapshot(): PelagicScoreBreakdown {
        return { ...this.totals };
    }

    exportState(): {
        currentSector: number;
        sectorHadDeath: boolean;
        awardedSectors: number[];
        finalSectorChecked: boolean;
        totals: PelagicScoreBreakdown;
    } {
        return {
            currentSector: this.currentSector,
            sectorHadDeath: this.sectorHadDeath,
            awardedSectors: [...this.awardedSectors],
            finalSectorChecked: this.finalSectorChecked,
            totals: { ...this.totals },
        };
    }

    restoreState(st: {
        currentSector: number;
        sectorHadDeath: boolean;
        awardedSectors: number[];
        finalSectorChecked: boolean;
        totals: PelagicScoreBreakdown;
    }): void {
        this.currentSector = st.currentSector;
        this.sectorHadDeath = st.sectorHadDeath;
        this.awardedSectors = new Set(st.awardedSectors);
        this.finalSectorChecked = st.finalSectorChecked;
        this.totals = { ...st.totals };
        this.squads.clear();
    }
}
