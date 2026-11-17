import {
    MISSIONS,
    SUPPLIES,
    type Encounter,
    type Mission,
} from './content.ts';

export type SupplyKind = (typeof SUPPLIES)[number]['kind'];
import {
    PELAGIC_RARE_EARLY_AT,
    PELAGIC_RARE_EVENT,
    PELAGIC_RARE_FALLBACK_AT,
    PELAGIC_TIMED_EVENTS,
    type PelagicSpecialEventId,
} from './PelagicSpecialEvents.ts';
import { SUB_BOSS_NAME, createSubmarineBoss } from './PelagicSubmarineBoss.ts';
import type { TideArchPhase } from './PelagicTideArch.ts';

export type StageEventCategory =
    | 'region'
    | 'encounter'
    | 'supply'
    | 'special-event'
    | 'checkpoint'
    | 'miniboss'
    | 'boss';

export type StageEventTriggerKind = 'timed' | 'conditional';

export type StageEventRepeatPolicy = 'once' | 'capped' | 'repeatable';

export type StageEventStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'blocked';

export interface StageEventDef {
    readonly id: string;
    readonly stageId: number;
    readonly missionIndex: number;
    readonly name: string;
    readonly category: StageEventCategory;
    readonly triggerKind: StageEventTriggerKind;
    /** Exact activation route time for timed events. Undefined for purely conditional triggers. */
    readonly atSeconds?: number;
    /** Safe lead-in route time when jumping right before an event (`START BEFORE EVENT`). */
    readonly preJumpSeconds: number;
    /** Human-readable condition expression (mandatory for conditional triggers). */
    readonly conditionLabel: string;
    readonly dependencies: readonly string[];
    readonly entities: readonly string[];
    readonly repeatPolicy: StageEventRepeatPolicy;
    readonly description: string;
    /** Structured payload linking straight back to real simulation handlers. */
    readonly payload:
        | { kind: 'region'; regionIndex: number; at: number }
        | { kind: 'encounter'; encounterIndex: number; encounter: Encounter }
        | { kind: 'supply'; supplyIndex: number; supplyKind: SupplyKind; at: number }
        | { kind: 'special-event'; eventId: PelagicSpecialEventId }
        | { kind: 'arch-phase'; phase: Exclude<TideArchPhase, 'idle' | 'complete'> }
        | { kind: 'miniboss'; at: number }
        | { kind: 'boss'; at: number; sectionCount: number };
}

export interface StageEventRuntimeEntry extends StageEventDef {
    status: StageEventStatus;
    activations: number;
    triggeredAtRoute?: number;
    note?: string;
}

export interface StageDirectorSnapshot {
    stageId: number;
    missionIndex: number;
    missionName: string;
    route: number;
    region: number;
    counts: Record<StageEventStatus, number>;
    activeIds: string[];
    entries: StageEventRuntimeEntry[];
}

const REGION_START_TIMES_UP = [0, 45, 90, 135, 148, 200, 255] as const;
const REGION_START_TIMES_SIDE = [0, 45, 90, 135, 155, 200, 255] as const;

/**
 * Builds the canonical declarative event graph for any mission registered in `MISSIONS`.
 * Both normal gameplay (`ArcadeWorld`) and DEV tools consume this exact single source of truth.
 */
export function buildMissionStageEvents(mission: Mission, missionIndex: number): StageEventDef[] {
    const events: StageEventDef[] = [];
    const stageId = mission.id;
    const isUp = mission.perspective === 'UP';
    const regionStarts = isUp ? REGION_START_TIMES_UP : REGION_START_TIMES_SIDE;

    mission.regions.forEach((regName, idx) => {
        const at = regionStarts[idx] ?? idx * 45;
        events.push({
            id: `stage-${stageId}-reg-${idx}`,
            stageId,
            missionIndex,
            name: idx === 0 ? `Início: ${regName}` : `Setor ${idx + 1}: ${regName}`,
            category: 'region',
            triggerKind: 'timed',
            atSeconds: at,
            preJumpSeconds: Math.max(0, at - 4),
            conditionLabel: `route >= ${at}s`,
            dependencies: idx > 0 ? [`stage-${stageId}-reg-${idx - 1}`] : [],
            entities: [`Setor ${idx + 1}`],
            repeatPolicy: 'once',
            description: `Transição de setor para ${regName} aos ${at}s`,
            payload: { kind: 'region', regionIndex: idx, at },
        });
    });

    if (isUp) {
        const archSpecs: ReadonlyArray<{
            phase: Exclude<TideArchPhase, 'idle' | 'complete'>;
            name: string;
            triggerKind: StageEventTriggerKind;
            atSeconds?: number;
            preJumpSeconds: number;
            conditionLabel: string;
            deps: string[];
            category: StageEventCategory;
            entities: string[];
            desc: string;
        }> = [
            {
                phase: 'approach',
                name: 'Arco das Marés — 1. Aproximação',
                triggerKind: 'timed',
                atSeconds: 148,
                preJumpSeconds: 143,
                conditionLabel: 'route >= 148s && !boss',
                deps: [`stage-${stageId}-reg-3`],
                category: 'special-event',
                entities: ['TideArchBridge', '4x cannon_cliff', '5x boat'],
                desc: 'Bloqueia spawns aéreos e inicia aproximação ao Arco das Marés.',
            },
            {
                phase: 'descent',
                name: 'Arco das Marés — 2. Descida Automática',
                triggerKind: 'conditional',
                preJumpSeconds: 148,
                conditionLabel: 'Após 4.6s em approach',
                deps: [`stage-${stageId}-arch-approach`],
                category: 'special-event',
                entities: ['PlayerAltitude 1 -> 0'],
                desc: 'Descida controlada de altitude antes dos rochedos.',
            },
            {
                phase: 'low-flight',
                name: 'Arco das Marés — 3. Voo Baixo & Canal',
                triggerKind: 'conditional',
                preJumpSeconds: 152,
                conditionLabel: 'Após 3.8s de descent (altitude === 0)',
                deps: [`stage-${stageId}-arch-descent`],
                category: 'special-event',
                entities: ['cannon_cliff', 'boat'],
                desc: 'Voo rasante dentro do canal fluvial alinhando com o vão.',
            },
            {
                phase: 'under-arch',
                name: 'Arco das Marés — 4. Passagem Sob o Arco',
                triggerKind: 'conditional',
                preJumpSeconds: 158,
                conditionLabel: 'scroll + archWorldY atinge banda da ponte [scrollY in bridgeBand]',
                deps: [`stage-${stageId}-arch-low-flight`],
                category: 'special-event',
                entities: ['PierHazardSensor', 'ArchOpening'],
                desc: 'Sensor geométrico do vão central e paredes laterais de rocha.',
            },
            {
                phase: 'ascent',
                name: 'Arco das Marés — 5. Subida Automática',
                triggerKind: 'conditional',
                preJumpSeconds: 170,
                conditionLabel: 'Após cruzar a banda da ponte sem derrota',
                deps: [`stage-${stageId}-arch-under-arch`],
                category: 'special-event',
                entities: ['PlayerAltitude 0 -> 1'],
                desc: 'Retorno automático de altitude liberando a rota aérea.',
            },
            {
                phase: 'checkpoint',
                name: 'Arco das Marés — 6. Checkpoint Concluído',
                triggerKind: 'conditional',
                preJumpSeconds: 173,
                conditionLabel: 'tideArch.altitudeRestored && tideArch.crossedArch',
                deps: [`stage-${stageId}-arch-ascent`],
                category: 'checkpoint',
                entities: ['CheckpointSnapshot', '+1500/+2000 Bonus'],
                desc: 'Grava snapshot oficial do Arco das Marés e reabilita spawns aéreos.',
            },
        ];

        for (const spec of archSpecs) {
            events.push({
                id: `stage-${stageId}-arch-${spec.phase}`,
                stageId,
                missionIndex,
                name: spec.name,
                category: spec.category,
                triggerKind: spec.triggerKind,
                atSeconds: spec.atSeconds,
                preJumpSeconds: spec.preJumpSeconds,
                conditionLabel: spec.conditionLabel,
                dependencies: spec.deps,
                entities: spec.entities,
                repeatPolicy: 'once',
                description: spec.desc,
                payload: { kind: 'arch-phase', phase: spec.phase },
            });
        }

        for (const spec of PELAGIC_TIMED_EVENTS) {
            events.push({
                id: `stage-${stageId}-special-${spec.id}`,
                stageId,
                missionIndex,
                name: `Evento Especial: ${spec.id}`,
                category: 'special-event',
                triggerKind: 'timed',
                atSeconds: spec.at,
                preJumpSeconds: Math.max(2, spec.at - 4),
                conditionLabel: `route >= ${spec.at}s && !tideArch.airSpawnsBlocked && !boss`,
                dependencies: spec.at > 200 ? [`stage-${stageId}-arch-checkpoint`] : [],
                entities: spec.members.map((m) => `${m.family}(${m.formation})`),
                repeatPolicy: 'once',
                description: spec.radio.replace(/\n/g, ' '),
                payload: { kind: 'special-event', eventId: spec.id },
            });
        }

        events.push({
            id: `stage-${stageId}-special-${PELAGIC_RARE_EVENT.id}`,
            stageId,
            missionIndex,
            name: 'Evento Condicional: Visitante Raro',
            category: 'special-event',
            triggerKind: 'conditional',
            preJumpSeconds: PELAGIC_RARE_EARLY_AT - 4,
            conditionLabel: `((${PELAGIC_RARE_EARLY_AT}-${PELAGIC_RARE_EARLY_AT + 12}s & 0 mortes & >=10 abates) || (${PELAGIC_RARE_FALLBACK_AT}-${PELAGIC_RARE_FALLBACK_AT + 12}s & >=20 abates)) && !boss`,
            dependencies: [],
            entities: PELAGIC_RARE_EVENT.members.map((m) => `${m.family}(${m.formation})`),
            repeatPolicy: 'capped',
            description: PELAGIC_RARE_EVENT.radio.replace(/\n/g, ' '),
            payload: { kind: 'special-event', eventId: 'rare-visitor' },
        });
    } else {
        events.push({
            id: `stage-${stageId}-miniboss`,
            stageId,
            missionIndex,
            name: 'Miniboss: PATRULHA PESADA AÉREA',
            category: 'miniboss',
            triggerKind: 'timed',
            atSeconds: 155,
            preJumpSeconds: 151,
            conditionLabel: 'route >= 155s && !miniStarted',
            dependencies: [`stage-${stageId}-reg-3`],
            entities: ['PATRULHA PESADA AÉREA (3 módulos)'],
            repeatPolicy: 'once',
            description: 'Encontro com miniboss aéreo aos 155s na rota Cidade Solar.',
            payload: { kind: 'miniboss', at: 155 },
        });
    }

    SUPPLIES.forEach((sup, idx) => {
        events.push({
            id: `stage-${stageId}-supply-${idx}-${sup.kind}`,
            stageId,
            missionIndex,
            name: `Suprimento #${idx + 1}: ${sup.kind.toUpperCase()}`,
            category: 'supply',
            triggerKind: 'timed',
            atSeconds: sup.at,
            preJumpSeconds: Math.max(0, sup.at - 3),
            conditionLabel: `route >= ${sup.at}s`,
            dependencies: [],
            entities: [`Caixa(${sup.kind})`],
            repeatPolicy: 'once',
            description: `Caixa de suprimento ${sup.kind.toUpperCase()} aos ${sup.at}s`,
            payload: { kind: 'supply', supplyIndex: idx, supplyKind: sup.kind, at: sup.at },
        });
    });

    mission.encounters.forEach((enc, idx) => {
        if (enc.at === 155) return; // Managed explicitly by Tide Arch (UP) / Miniboss (SIDE)
        events.push({
            id: `stage-${stageId}-enc-${idx}`,
            stageId,
            missionIndex,
            name: `Onda #${idx + 1}: ${enc.family} (${enc.formation})`,
            category: 'encounter',
            triggerKind: 'timed',
            atSeconds: enc.at,
            preJumpSeconds: Math.max(0, enc.at - 3),
            conditionLabel: isUp && enc.at >= 148 && enc.at < 198
                ? `route >= ${enc.at}s && !tideArch.airSpawnsBlocked`
                : `route >= ${enc.at}s`,
            dependencies: [],
            entities: [`${enc.family} (${enc.formation}, ${enc.motion})`],
            repeatPolicy: 'once',
            description: `lane=${enc.lane}${enc.entry ? ` entry=${enc.entry}` : ''} speed=${enc.speed ?? 'padrão'}`,
            payload: { kind: 'encounter', encounterIndex: idx, encounter: enc },
        });
    });

    const sectionCount = isUp && mission.boss === SUB_BOSS_NAME
        ? createSubmarineBoss(() => 1, 384).sections.length
        : 1;
    events.push({
        id: `stage-${stageId}-boss`,
        stageId,
        missionIndex,
        name: `Boss Final: ${mission.boss}`,
        category: 'boss',
        triggerKind: 'timed',
        atSeconds: 300,
        preJumpSeconds: 294,
        conditionLabel: 'route >= 300s && !bossStarted',
        dependencies: isUp ? [`stage-${stageId}-arch-checkpoint`] : [`stage-${stageId}-miniboss`],
        entities: [mission.boss, `${sectionCount} seção(ões)`],
        repeatPolicy: 'once',
        description: `Confronto final da missão ${mission.name}`,
        payload: { kind: 'boss', at: 300, sectionCount },
    });

    // Keep stable chronological ordering (timed events first at each timestamp, conditional arch steps grouped right after 148s)
    events.sort((a, b) => {
        const ta = a.atSeconds ?? a.preJumpSeconds + 4;
        const tb = b.atSeconds ?? b.preJumpSeconds + 4;
        if (ta !== tb) return ta - tb;
        const order: Record<StageEventCategory, number> = {
            region: 0,
            checkpoint: 1,
            miniboss: 2,
            'special-event': 3,
            supply: 4,
            encounter: 5,
            boss: 6,
        };
        return order[a.category] - order[b.category];
    });

    return events;
}

/** Lookup helper across all playable missions without needing a running world. */
export function buildAllMissionStageEvents(): Map<number, StageEventDef[]> {
    const out = new Map<number, StageEventDef[]>();
    MISSIONS.forEach((m, idx) => {
        out.set(idx, buildMissionStageEvents(m, idx));
    });
    return out;
}

/**
 * Runtime Stage Director instance owned by each `ArcadeWorld`.
 * Single source of truth driving event state transitions in both live gameplay and DEV jumps.
 */
export class ArcadeStageDirector {
    readonly mission: Mission;
    readonly missionIndex: number;
    readonly defs: readonly StageEventDef[];
    private readonly runtime = new Map<string, StageEventRuntimeEntry>();
    private paused = false;

    constructor(mission: Mission, missionIndex: number) {
        this.mission = mission;
        this.missionIndex = missionIndex;
        this.defs = buildMissionStageEvents(mission, missionIndex);
        this.reset();
    }

    reset(): void {
        this.runtime.clear();
        for (const def of this.defs) {
            this.runtime.set(def.id, {
                ...def,
                status: 'pending',
                activations: 0,
            });
        }
    }

    setPaused(paused: boolean): void {
        this.paused = paused;
    }

    isPaused(): boolean {
        return this.paused;
    }

    getEntry(id: string): StageEventRuntimeEntry | undefined {
        return this.runtime.get(id);
    }

    setStatus(id: string, status: StageEventStatus, atRoute?: number, note?: string): void {
        const entry = this.runtime.get(id);
        if (!entry) return;
        entry.status = status;
        if (status === 'active' || status === 'completed') {
            if (atRoute !== undefined && entry.triggeredAtRoute === undefined) {
                entry.triggeredAtRoute = Number(atRoute.toFixed(2));
            }
            if (status === 'active') entry.activations++;
        }
        if (note !== undefined) entry.note = note;
    }

    markEncounterTriggered(encounterIndex: number, atRoute: number): void {
        const id = `stage-${this.mission.id}-enc-${encounterIndex}`;
        this.setStatus(id, 'completed', atRoute);
    }

    markEncounterSkipped(encounterIndex: number, reason: string): void {
        const id = `stage-${this.mission.id}-enc-${encounterIndex}`;
        this.setStatus(id, 'skipped', undefined, reason);
    }

    markSupplyTriggered(supplyIndex: number, atRoute: number): void {
        const sup = SUPPLIES[supplyIndex];
        if (!sup) return;
        this.setStatus(`stage-${this.mission.id}-supply-${supplyIndex}-${sup.kind}`, 'completed', atRoute);
    }

    markSpecialTriggered(eventId: PelagicSpecialEventId, atRoute: number): void {
        this.setStatus(`stage-${this.mission.id}-special-${eventId}`, 'active', atRoute);
    }

    markSpecialCompleted(eventId: PelagicSpecialEventId): void {
        const id = `stage-${this.mission.id}-special-${eventId}`;
        const cur = this.runtime.get(id);
        if (cur && cur.status === 'active') cur.status = 'completed';
    }

    markArchPhase(phase: TideArchPhase, atRoute: number): void {
        const sid = this.mission.id;
        if (phase === 'idle') return;
        const order: Array<Exclude<TideArchPhase, 'idle' | 'complete'>> = [
            'approach',
            'descent',
            'low-flight',
            'under-arch',
            'ascent',
            'checkpoint',
        ];
        const idx = phase === 'complete' ? order.length : order.indexOf(phase);
        order.forEach((step, i) => {
            const id = `stage-${sid}-arch-${step}`;
            if (i < idx) {
                const cur = this.runtime.get(id);
                if (cur && cur.status !== 'completed') {
                    this.setStatus(id, 'completed', cur.triggeredAtRoute ?? atRoute);
                }
            } else if (i === idx) {
                this.setStatus(id, phase === 'checkpoint' ? 'completed' : 'active', atRoute);
            }
        });
    }

    markRegionReached(regionIndex: number, atRoute: number): void {
        const sid = this.mission.id;
        for (let i = 0; i <= regionIndex; i++) {
            const id = `stage-${sid}-reg-${i}`;
            const cur = this.runtime.get(id);
            if (!cur) continue;
            if (i < regionIndex && cur.status !== 'completed') {
                this.setStatus(id, 'completed', cur.triggeredAtRoute ?? atRoute);
            } else if (i === regionIndex && cur.status === 'pending') {
                this.setStatus(id, 'active', atRoute);
            }
        }
    }

    /**
     * Synchronizes director event state coherently after any DEV Stage Jump or checkpoint restore.
     * Prevents prior events from firing again while keeping upcoming events eligible.
     */
    syncAfterJump(targetSeconds: number, currentRegion: number, opts?: { pauseDirector?: boolean }): void {
        this.reset();
        this.paused = Boolean(opts?.pauseDirector);
        const sid = this.mission.id;
        const isUp = this.mission.perspective === 'UP';

        for (const def of this.defs) {
            const entry = this.runtime.get(def.id)!;
            if (def.payload.kind === 'region') {
                if (def.payload.regionIndex < currentRegion) {
                    entry.status = 'completed';
                    entry.triggeredAtRoute = def.atSeconds;
                } else if (def.payload.regionIndex === currentRegion) {
                    entry.status = 'active';
                    entry.triggeredAtRoute = Number(targetSeconds.toFixed(2));
                }
                continue;
            }
            if (def.triggerKind === 'timed' && def.atSeconds !== undefined) {
                if (def.atSeconds < targetSeconds) {
                    entry.status = 'skipped';
                    entry.note = `Anterior ao salto (${targetSeconds}s)`;
                } else if (def.payload.kind === 'boss' && targetSeconds >= 300) {
                    entry.status = 'active';
                    entry.triggeredAtRoute = 300;
                    entry.activations = 1;
                } else if (def.payload.kind === 'miniboss' && !isUp && targetSeconds >= 155 && targetSeconds < 185) {
                    entry.status = 'active';
                    entry.triggeredAtRoute = 155;
                    entry.activations = 1;
                } else if (def.payload.kind === 'miniboss' && !isUp && targetSeconds >= 185) {
                    entry.status = 'skipped';
                    entry.note = `Anterior ao salto (${targetSeconds}s)`;
                }
            } else if (def.payload.kind === 'arch-phase' && isUp) {
                if (targetSeconds >= 185) {
                    entry.status = 'completed';
                    entry.triggeredAtRoute = targetSeconds;
                } else if (targetSeconds >= 148) {
                    const phase: Exclude<TideArchPhase, 'idle'> =
                        targetSeconds < 153 ? 'approach'
                        : targetSeconds < 158 ? 'descent'
                        : targetSeconds < 171 ? 'low-flight'
                        : targetSeconds < 177 ? 'under-arch'
                        : targetSeconds < 181 ? 'ascent'
                        : 'checkpoint';
                    this.markArchPhase(phase, targetSeconds);
                }
            } else if (def.payload.kind === 'special-event' && def.payload.eventId === 'rare-visitor' && isUp) {
                if (targetSeconds > PELAGIC_RARE_EARLY_AT + 12 && targetSeconds < PELAGIC_RARE_FALLBACK_AT) {
                    entry.note = 'Janela inicial (66-78s) já encerrada; janela fallback (204-216s) disponível';
                } else if (targetSeconds >= PELAGIC_RARE_FALLBACK_AT + 12) {
                    entry.status = 'skipped';
                    entry.note = `Janelas de elegibilidade anteriores ao salto (${targetSeconds}s)`;
                }
            }
        }

        if (opts?.pauseDirector) {
            const bossId = `stage-${sid}-boss`;
            const bossEntry = this.runtime.get(bossId);
            if (bossEntry && targetSeconds < 300) bossEntry.note = 'Diretor pausado em modo isolado';
        }
    }

    snapshot(route: number, region: number): StageDirectorSnapshot {
        const counts: Record<StageEventStatus, number> = {
            pending: 0,
            active: 0,
            completed: 0,
            skipped: 0,
            blocked: 0,
        };
        const activeIds: string[] = [];
        const entries: StageEventRuntimeEntry[] = [];
        for (const e of this.runtime.values()) {
            counts[e.status]++;
            if (e.status === 'active') activeIds.push(e.id);
            entries.push({ ...e });
        }
        return {
            stageId: this.mission.id,
            missionIndex: this.missionIndex,
            missionName: this.mission.name,
            route: Number(route.toFixed(2)),
            region,
            counts,
            activeIds,
            entries,
        };
    }
}
