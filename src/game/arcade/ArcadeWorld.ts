import { BurstController } from './BurstController.ts';
import {
    ENEMY_SHOTS,
    FAMILY,
    LEGACY_SOLAR_FIRE,
    LEGACY_SOLAR_SHOTS,
    MISSIONS,
    SUPPLIES,
    WARHAWK_MISSILE_SPEED_HARD,
    WARHAWK_MISSILE_SPEED_NORMAL,
    formationOffsets,
    regionAt,
    type Encounter,
    type EntrySide,
    type Family,
    type Mission,
    type Motion,
} from './content.ts';
import {
    ArcadeStageDirector,
    type StageDirectorSnapshot,
    type StageEventDef,
} from './ArcadeStageDirector.ts';
import {
    getMountSpecs,
    hasArticulatedMounts,
    resolveActorMounts,
    resolveUnmountedMuzzle,
    slewAngle,
} from './PelagicWeaponMounts.ts';
import { clamp, sweepEllipse, type Box } from './geometry.ts';
import { collectPowerItem, createPlayerWeapons, getPrimaryProjectiles, getSecondaryProjectiles, type PlayerWeaponsState } from '../systems/weaponSystem.ts';
import { enterStage, type CampaignFlight } from '../systems/campaignFlight.ts';
import { prepareSurface, moveSurface, waterCorridor, type SurfaceRoute } from './PelagicEnvironment.ts';
import {
    PELAGIC_CONVOY_CLEAR_BONUS,
    PELAGIC_RARE_BONUS,
    PELAGIC_RARE_EARLY_AT,
    PELAGIC_RARE_EVENT,
    PELAGIC_TIMED_EVENTS,
    isRareVisitorEligible,
    type PelagicEventRole,
    type PelagicSpecialEventId,
    type PelagicSpecialEventSpec,
} from './PelagicSpecialEvents.ts';
import {
    SUB_BOSS_NAME,
    SUB_BEAM_HALF_W,
    SUB_ANCHOR_Y,
    SUB_HULL_DISPLAY_W,
    SUB_SECTION_HEIGHT,
    SUB_MAX_BOMB_HULL_DAMAGE,
    SUB_MAX_BOMB_PART_DAMAGE,
    SUB_MAX_BOMB_SECTION_DAMAGE,
    createSubmarineBoss,
    subActiveSectionComplete,
    subHullGeometricContact,
    subSectionCenterY,
    syncSubmarinePositions,
    type SubmarineBossState,
    type SubModule,
    type SubModuleKind,
    type SubSection,
} from './PelagicSubmarineBoss.ts';
import {
    PELAGIC_BOSS_BASE_CLEAR,
    PELAGIC_MINI_BASE_CLEAR,
    PelagicScoringTracker,
    SUB_MODULE_LABELS,
} from './PelagicScoring.ts';
import {
    ASSISTED_LOWER_LANE_ENEMY_COOLDOWN,
    ASSISTED_RESPAWN_BULLET_CLEAR_RADIUS,
    ASSISTED_RESPAWN_INVULNERABLE,
    applyRecoveryPower,
    computeAssistedDeathRecovery,
} from './PelagicAssist.ts';

import {
    TIDE_ARCH_CHECKPOINT_BONUS,
    TIDE_ARCH_CLEAN_BONUS,
    TideArchController,
    computeArchOpening,
    type ArchCannonPattern,
    type PelagicCheckpointSnapshot,
    type TideArchBoatSpec,
    type TideArchCannonSpec,
    type TideArchPhase,
} from './PelagicTideArch.ts';
import { PelagicCombatDirector, type PelagicPacingSnapshot } from './PelagicCombatDirector.ts';

export interface Controls { x: number; y: number; fire: boolean; special: boolean; }
export interface SubmarineState { phase: 'emerge' | 'hold' | 'submerge'; exposure: number; side: -1 | 1; }
export interface Actor {
    id: number; x: number; y: number; size: number; hp: number; maxHp: number; age: number; flash: number;
    family: Family; motion: Motion; lane: number; offset: number; speed: number; cooldown: number; warning: number; ground: boolean;
    entry?: EntrySide; vx?: number; vy?: number;
    mountAngles?: number[]; mountRecoil?: number[]; attackStep?: number; altitude?: number;
    archPattern?: ArchCannonPattern; archSide?: -1 | 1; archBoat?: boolean; archRetiring?: boolean;
    squadId?: number; navigation?: SurfaceRoute; submarine?: SubmarineState; specialEvent?: PelagicSpecialEventId; eventRole?: PelagicEventRole;
}
export interface ArcadeBomb { id: number; x: number; y: number; age: number; phase: 'flight' | 'blast'; radius: number; }
export interface Bullet { active: boolean; x: number; y: number; px: number; py: number; vx: number; vy: number; damage: number; radius: number; enemy: boolean; missile: boolean; enemyMissile?: boolean; homing: boolean; age: number; scale: number; color: number; }
export interface Cargo { id: number; x: number; y: number; vx: number; vy: number; kind: 'power' | 'life' | 'special'; crate: boolean; hp: number; age: number; recoveryP?: number; }
export interface Component { id: number; x: number; y: number; dx: number; dy: number; hp: number; maxHp: number; radius: number; flash: number; warning: number; angle: number; }
export interface Boss { mini: boolean; x: number; y: number; size: number; age: number; phase: 'enter' | 'fight' | 'retreat' | 'absent' | 'return' | 'sink'; configuration: number; timer: number; attack: number; attackTime: number; volley: number; aimX: number; aimY: number; parts: Component[]; flash?: number; sub?: SubmarineBossState; }
export interface Obstacle { id: number; x: number; y: number; width: number; height: number; kind: 'roof' | 'gate' | 'barrier'; warning: number; hp: number; age: number; }
/** A destroyed coastal emplacement remains attached to its original terrain. */
export interface CoastalWreck { anchor?: number; customAnchor?: boolean; family?: 'tank' | 'tower'; id: number; x: number; y: number; worldY: number; size: number; age: number; }
export interface WorldEvent { type: 'shot' | 'missile' | 'enemy-shot' | 'impact' | 'explosion' | 'pickup' | 'death' | 'special' | 'boss' | 'return' | 'mini' | 'victory' | 'defeat' | 'radio' | 'bonus' | 'comms' | 'arch' | 'checkpoint'; x: number; y: number; size?: number; text?: string; }
export type BossContactQuery = (boss: Boss, ax: number, ay: number, bx: number, by: number, radius: number) => number | null;
export type SubHullContactQuery = (sub: SubmarineBossState, sectionIndex: number, ax: number, ay: number, bx: number, by: number, radius: number) => number | null;
export type ContactQuery = (actor: Actor, ax: number, ay: number, bx: number, by: number, radius: number) => number | null;
const TAU = Math.PI * 2;
const BASE_CONTROL: Controls = { x: 0, y: 0, fire: false, special: false };
/** Fixed-step deterministic simulation. Rendering quality never enters these rules. */
export type UpLayoutMode = 'classic' | 'pc' | 'portrait';
export interface ArcadeWorldOptions {
    upLayout?: UpLayoutMode;
    arena?: Box;
    seed?: number;
}

export class ArcadeWorld {
    readonly arena: Box; readonly bullets: Bullet[] = Array.from({ length: 640 }, () => ({ active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, damage: 0, radius: 0, enemy: false, missile: false, enemyMissile: false, homing: false, age: 0, scale: 1, color: 0 }));
    enemies: Actor[] = []; cargo: Cargo[] = []; obstacles: Obstacle[] = []; wrecks: CoastalWreck[] = []; boss?: Boss; bomb?: ArcadeBomb; events: WorldEvent[] = [];
    weapons: PlayerWeaponsState = createPlayerWeapons('nolan'); lives = 3; score = 0; kills = 0; deaths = 0; collected = 0; elapsed = 0; route = 0; scroll = 0; scrollSpeed = 38; region = 0; player = { x: 384, y: 368, invulnerable: 2.5, bank: 0, altitude: 1 };
    state: 'intro' | 'play' | 'exit' | 'victory' | 'defeat' = 'intro'; introTime = 2.2; exitTime = 0; specialTime = 0; missileTime = 0; specialEdge = false; specialImpact?: { x: number; y: number };
    contact?: ContactQuery; bossContact?: BossContactQuery; subHullContact?: SubHullContactQuery; accessibility = false; hard = false; assisted = false;
    devInvincible = false; devSandboxIsolated = false; devIsolatedEventId?: string; enemyFireRateScale = 1; enemyShotSpeedScale = 1; enemySpeedScale = 1; playerSpeedScale = 1; specialDurationScale = 1;
    seed = 1337;
    readonly specialEventsTriggered = new Set<PelagicSpecialEventId>();
    readonly pelagicScoring = new PelagicScoringTracker();
    readonly tideArch = new TideArchController();
    readonly pacingDirector = new PelagicCombatDirector();
    readonly stageDirector: ArcadeStageDirector;
    checkpoint?: PelagicCheckpointSnapshot;
    private rngState = 1337;
    private burst = new BurstController(); private sequence = 0; private waveIndex = 0; private supplyIndex = 0; private miniStarted = false; private bossStarted = false; private nextObstacle = 98;
    private rareSpawnCount = 0; private rareRewardClaimed = false; private convoyBonusClaimed = false; private assistedDeathHinted = false;
    private stepEnemyShots = 0; private directorPaused = false;
    readonly mission: Mission;
    readonly upLayout: UpLayoutMode;
    constructor(mission: Mission, carry?: CampaignFlight, options?: ArcadeWorldOptions) {
        this.mission = mission;
        const mIdx = Math.max(0, MISSIONS.indexOf(mission));
        this.stageDirector = new ArcadeStageDirector(mission, mIdx);
        this.setSeed(options?.seed ?? 1337);
        this.upLayout = options?.upLayout ?? 'classic';
        if (options?.arena) {
            this.arena = { ...options.arena };
        } else if (mission.perspective === 'UP') {
            this.arena = this.upLayout === 'pc'
                ? { left: 192, right: 576, top: 28, bottom: 420 }
                : this.upLayout === 'portrait'
                    ? { left: 0, right: 384, top: 34, bottom: 668 }
                    : { left: 192, right: 576, top: 38, bottom: 420 };
        } else {
            this.arena = { left: 16, right: 752, top: 40, bottom: 414 };
        }
        const restored = enterStage('nolan', mission.id, carry); this.weapons = restored.weapons; this.lives = restored.health.lives; this.score = restored.score;
        this.player.x = this.arenaCenterX; this.player.y = this.playerHomeY;
    }
    setSeed(seed: number): void {
        const clean = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 1337;
        this.seed = clean || 1337;
        this.rngState = this.seed;
    }
    nextRandom(): number {
        let t = (this.rngState += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    get up(): boolean { return this.mission.perspective === 'UP'; }
    get arenaWidth(): number { return this.arena.right - this.arena.left; }
    get arenaCenterX(): number { return (this.arena.left + this.arena.right) * 0.5; }
    get playerHomeY(): number { return this.up ? this.arena.bottom - 52 : 228; }
    get hasActiveCheckpoint(): boolean { return !!this.checkpoint; }
    get isAssisted(): boolean { return this.up && this.assisted; }
    private get effectiveHard(): boolean { return this.hard && !this.isAssisted; }
    setArenaBounds(bounds: Box): void {
        const oldCenter = this.arenaCenterX;
        const oldW = Math.max(1, this.arenaWidth);
        const relX = (this.player.x - oldCenter) / oldW;
        const prevHomeY = this.playerHomeY;
        Object.assign(this.arena, bounds);
        this.player.x = clamp(this.arenaCenterX + relX * this.arenaWidth, this.arena.left + 14, this.arena.right - 14);
        this.player.y = clamp(this.player.y + (this.playerHomeY - prevHomeY), this.arena.top + 16, this.arena.bottom - 15);
    }
    emit(type: WorldEvent['type'], x = this.player.x, y = this.player.y, size = 1, text?: string): void { this.events.push({ type, x, y, size, text }); }
    step(seconds: number, input: Controls = BASE_CONTROL): void {
        const dt = clamp(seconds, 0, .05); if (this.state === 'victory' || this.state === 'defeat') return;
        if (this.state === 'intro') { this.introTime -= dt; this.scroll += 25 * dt; if (this.introTime <= 0) { this.state = 'play'; if (this.up) this.emit('comms', 0, 0, 1, 'start'); else this.emit('radio', 0, 0, 1, 'Cidade Solar, a RIVET chegou!'); } return; }
        if (this.state === 'exit') { this.exitTime += dt; this.scroll += 30 * dt; this.updateWrecks(dt); if (this.up) this.player.y -= 130 * dt; else this.player.x += 250 * dt; if (this.exitTime >= 3.4) this.state = 'victory'; return; }
        this.elapsed += dt;
        const advanceRoute = !this.directorPaused && (!this.devSandboxIsolated || Boolean(this.devIsolatedEventId));
        if (advanceRoute) {
            this.route = Math.min(300, this.route + dt);
            this.region = regionAt(this.route);
            this.stageDirector.markRegionReached(this.region, this.route);
        }
        this.stepEnemyShots = 0;
        if (this.up) {
            for (const award of this.pelagicScoring.advanceSector(this.region, this.route, this.effectiveHard)) {
                this.score += award.bonus;
                this.emit('bonus', this.player.x, Math.max(72, this.player.y - 24), award.bonus, `SETOR ${award.sector + 1} INTACTO`);
            }
        }
        this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
        const speedMul = this.playerSpeedScale !== 1 ? clamp(this.playerSpeedScale, 0.35, 2.5) : 1;
        const n = Math.max(1, Math.hypot(input.x, input.y)), speed = 174 * speedMul;
        this.player.x = clamp(this.player.x + input.x / n * speed * dt, this.arena.left + 14, this.arena.right - 14);
        const yRange = this.up
            ? this.tideArch.playerLongitudinalClamp(this.arena.top, this.arena.bottom, this.playerHomeY)
            : { minY: this.arena.top + 16, maxY: this.arena.bottom - 15 };
        this.player.y = clamp(this.player.y + input.y / n * speed * dt, yRange.minY, yRange.maxY);
        this.player.bank += ((this.up ? input.x : -input.y) - this.player.bank) * Math.min(1, dt * 10.5);
        const burstStep = this.burst.step(dt * 1000, input.fire, {
            accessibility: this.accessibility,
            allowHoldRepeat: !this.up,
        });
        for (let i = 0; i < burstStep.pulses; i++) this.firePrimary();
        this.missileTime = Math.max(0, this.missileTime - dt);
        const missileTrigger = this.up ? burstStep.burstStarted : input.fire;
        if (missileTrigger && this.weapons.weaponLevel >= 3 && this.missileTime <= 0) {
            this.fireMissiles();
            this.missileTime = this.weapons.weaponLevel === 5 ? 1.1 : 1.5;
        }
        if (input.special && !this.specialEdge && this.weapons.specialCharges > 0 && this.specialTime <= 0) {
            this.weapons.specialCharges--;
            const durMul = this.specialDurationScale !== 1 ? clamp(this.specialDurationScale, 0.3, 2.5) : 1;
            this.specialTime = 2.75 * durMul;
            this.bomb = { id: ++this.sequence, x: this.player.x, y: this.player.y, age: 0, phase: 'flight', radius: 0 };
            this.emit('special');
        }
        this.specialEdge = input.special;
        if (this.specialTime > 0) { this.specialImpact = undefined; this.applySpecial(dt); }
        if (this.up && !this.boss) {
            const archStep = this.tideArch.step(dt, this.route, this.scroll, this.player.y, this.playerHomeY);
            this.player.altitude = this.tideArch.altitude;
            if (archStep.enteredPhase) {
                this.stageDirector.markArchPhase(archStep.enteredPhase, this.route);
                if (archStep.enteredPhase === 'approach') {
                    for (const rem of this.enemies) if (!rem.ground) rem.archRetiring = true;
                    this.emit('comms', 0, 0, 1, 'arch:approach');
                    this.emit('arch', 0, 0, 1, 'approach');
                } else if (archStep.enteredPhase === 'descent') {
                    this.emit('comms', 0, 0, 1, 'arch:descent');
                    this.emit('arch', 0, 0, 1, 'descent');
                } else if (archStep.enteredPhase === 'low-flight') {
                    this.emit('arch', 0, 0, 1, 'low-flight');
                } else if (archStep.enteredPhase === 'under-arch') {
                    this.emit('arch', 0, 0, 1, 'under-arch');
                } else if (archStep.enteredPhase === 'ascent') {
                    this.emit('comms', 0, 0, 1, 'arch:ascent');
                    this.emit('arch', 0, 0, 1, 'ascent');
                }
            }
            for (const cannon of archStep.spawnCannons) this.spawnArchCannon(cannon);
            for (const boat of archStep.spawnBoats) this.spawnArchBoat(boat);
            if (archStep.activateCheckpoint && this.tideArch.altitudeRestored && this.tideArch.crossedArch) {
                this.activateTideArchCheckpoint();
            }
        } else {
            this.player.altitude = 1;
        }
        if (!this.directorPaused) {
            const iso = this.devSandboxIsolated ? this.devIsolatedEventId : undefined;
            while (this.waveIndex < this.mission.encounters.length && this.route >= this.mission.encounters[this.waveIndex].at) {
                const idx = this.waveIndex++;
                const e = this.mission.encounters[idx];
                const encId = `stage-${this.mission.id}-enc-${idx}`;
                if (iso && iso !== encId) continue;
                if (this.up && (e.at === 155 || this.tideArch.airSpawnsBlocked)) {
                    this.stageDirector.markEncounterSkipped(idx, e.at === 155 ? 'Substituído pelo Arco das Marés' : 'Bloqueado pelo Arco das Marés');
                    continue;
                }
                if (!this.up && e.at === 155) {
                    this.stageDirector.markEncounterSkipped(idx, 'Substituído pelo Miniboss');
                    continue;
                }
                this.stageDirector.markEncounterTriggered(idx, this.route);
                this.dispatchScriptedEncounter(e);
            }
            if (this.up && !this.boss && !this.tideArch.airSpawnsBlocked) {
                for (const spec of PELAGIC_TIMED_EVENTS) {
                    const evId = `stage-${this.mission.id}-special-${spec.id}`;
                    if (iso && iso !== evId) continue;
                    if (this.route >= spec.at && !this.specialEventsTriggered.has(spec.id)) this.triggerSpecialEvent(spec.id);
                }
                const rareId = `stage-${this.mission.id}-special-rare-visitor`;
                if ((!iso || iso === rareId) && isRareVisitorEligible(true, this.route, this.deaths, this.kills, this.rareSpawnCount > 0 || this.specialEventsTriggered.has('rare-visitor'), false)) {
                    this.triggerSpecialEvent('rare-visitor');
                }
            }
            while (this.supplyIndex < SUPPLIES.length && this.route >= SUPPLIES[this.supplyIndex].at) {
                const idx = this.supplyIndex++;
                const c = SUPPLIES[idx];
                const supId = `stage-${this.mission.id}-supply-${idx}-${c.kind}`;
                if (iso && iso !== supId) continue;
                const lane = .25 + (this.supplyIndex % 3) * .24;
                this.cargo.push({ id: ++this.sequence, x: this.up ? this.arena.left + lane * this.arenaWidth : this.arena.right + 15, y: this.up ? -25 : 85 + lane * 250, vx: this.up ? 20 : -32, vy: this.up ? 25 : 0, kind: c.kind, crate: true, hp: 3, age: 0 });
                this.stageDirector.markSupplyTriggered(idx, this.route);
            }
            if (!this.up && this.route >= 155 && !this.miniStarted && (!iso || iso === `stage-${this.mission.id}-miniboss`)) {
                this.miniStarted = true;
                this.startBoss(true);
            }
            if (this.route >= 300 && !this.bossStarted && !this.boss && (!iso || iso === `stage-${this.mission.id}-boss`)) {
                this.bossStarted = true;
                if (this.up) for (const rem of this.enemies) if (rem.hp > 0) this.pelagicScoring.onSquadMemberEscaped(rem.squadId);
                this.enemies = []; this.clearHostileBullets(); this.startBoss(false);
            }
            if (!iso && !this.up && this.route >= this.nextObstacle && this.route < 270) { this.spawnObstacle(); this.nextObstacle += this.route < 135 ? 12 : 33; }
        }
        let targetScroll = !this.up && this.region === 3 ? 85 : this.up && this.tideArch.isActive ? this.tideArch.targetScrollSpeed() : 38;
        if (this.boss && !this.boss.mini) targetScroll = this.boss.sub ? (this.boss.sub.phase === 'transition' ? 115 : this.boss.sub.phase === 'collapse' ? 35 : 42) : (this.boss.phase === 'absent' ? 20 : 0);
        else if (this.boss) targetScroll = 16;
        this.scrollSpeed += (targetScroll - this.scrollSpeed) * Math.min(1, dt * 1.5); this.scroll += this.scrollSpeed * dt;
        this.updateWrecks(dt); this.updateEnemies(dt); this.updateBoss(dt); this.updateCargo(dt); this.updateObstacles(dt); this.updateBullets(dt);
        if (!this.devSandboxIsolated && this.up && !this.directorPaused && this.state === 'play') {
            this.stepDynamicDirector(dt);
        }
        if (this.up && this.tideArch.isPillarCollisionActive(this.scroll, this.player.y)) {
            const opening = computeArchOpening(this.arena.left, this.arena.right);
            if (this.player.x - 10 < opening.left || this.player.x + 10 > opening.right) {
                this.hurtPlayer();
                if (this.state === 'play') this.player.x = clamp(this.player.x, opening.left + 32, opening.right - 32);
            }
        }
    }
    /** Triggers a deterministic Fenda Pelágica special event once (unless forced for isolated inspection). */
    triggerSpecialEvent(id: PelagicSpecialEventId, force = false): boolean {
        const spec: PelagicSpecialEventSpec | undefined = id === 'rare-visitor'
            ? PELAGIC_RARE_EVENT
            : PELAGIC_TIMED_EVENTS.find(s => s.id === id);
        if (!this.up || !spec || (!force && this.specialEventsTriggered.has(id))) return false;
        if (id === 'rare-visitor') {
            if (!force && this.rareSpawnCount >= 1) return false;
            this.rareSpawnCount++;
        }
        this.specialEventsTriggered.add(id);
        this.stageDirector.markSpecialTriggered(id, this.route);
        this.emit('radio', 0, 0, 1, spec.radio);
        const roster = this.effectiveHard && spec.hardExtra ? [...spec.members, ...spec.hardExtra] : spec.members;
        for (const member of roster) {
            this.spawnEncounter(member, { specialEvent: id, eventRole: member.role, cooldown: member.cooldown });
        }
        return true;
    }

    private spawnArchCannon(spec: TideArchCannonSpec): void {
        if (!this.up) return;
        const def = FAMILY.tower;
        const opening = computeArchOpening(this.arena.left, this.arena.right);
        const outerX = spec.side < 0 ? this.arena.left : this.arena.right;
        const edgeX = spec.side < 0 ? opening.left : opening.right;
        const anchorX = outerX + (edgeX - outerX) * spec.pierDepth;
        const worldY = this.tideArch.archWorldY + spec.relWorldY;
        const mountCount = getMountSpecs('tower').length;
        const actor: Actor = {
            id: ++this.sequence,
            x: anchorX,
            y: worldY + this.scroll,
            size: def.size,
            hp: def.hp,
            maxHp: def.hp,
            age: 0,
            flash: 0,
            family: 'tower',
            motion: 'stationary',
            lane: anchorX,
            offset: spec.side < 0 ? 0 : 0.7,
            speed: 0,
            cooldown: spec.cooldownOffset,
            warning: 0,
            ground: true,
            archPattern: spec.pattern,
            archSide: spec.side,
            ...(mountCount > 0 ? { mountAngles: Array(mountCount).fill(Math.PI / 2), mountRecoil: Array(mountCount).fill(0), attackStep: 0 } : {}),
            navigation: {
                worldY,
                heading: Math.PI,
                entry: 0,
                phase: 'hold',
                customAnchor: true,
                anchorX,
                anchorY: 0,
            },
        };
        if (actor.mountAngles) {
            const m = resolveActorMounts(actor, this.player.x, this.player.y, this.elapsed);
            for (let k = 0; k < actor.mountAngles.length; k++) {
                if (m[k]) actor.mountAngles[k] = m[k].aimAngle;
            }
        }
        this.enemies.push(actor);
    }

    private spawnArchBoat(spec: TideArchBoatSpec): void {
        if (!this.up) return;
        const def = FAMILY.boat;
        const opening = computeArchOpening(this.arena.left, this.arena.right);
        const pad = def.size * 0.65;
        const laneX = clamp(opening.left + (opening.width) * spec.laneFrac, opening.left + pad, opening.right - pad);
        const startY = spec.stage === 'approach' ? -6 : -28;
        const worldY = startY - this.scroll;
        const mountCount = getMountSpecs('boat').length;
        const actor: Actor = {
            id: ++this.sequence,
            x: laneX,
            y: startY,
            size: def.size,
            hp: def.hp,
            maxHp: def.hp,
            age: 0,
            flash: 0,
            family: 'boat',
            motion: 'stationary',
            lane: laneX,
            offset: spec.laneFrac,
            speed: spec.speed,
            cooldown: spec.cooldownOffset,
            warning: 0,
            ground: true,
            archBoat: true,
            ...(mountCount > 0 ? { mountAngles: Array(mountCount).fill(Math.PI / 2), mountRecoil: Array(mountCount).fill(0), attackStep: 0 } : {}),
            navigation: {
                worldY,
                heading: Math.PI,
                entry: 0,
                lane: spec.laneFrac < 0.45 ? -1 : spec.laneFrac > 0.55 ? 1 : 0,
                phase: 'enter',
            },
        };
        if (actor.mountAngles) {
            const m = resolveActorMounts(actor, this.player.x, this.player.y, this.elapsed);
            for (let k = 0; k < actor.mountAngles.length; k++) {
                if (m[k]) actor.mountAngles[k] = m[k].aimAngle;
            }
        }
        this.enemies.push(actor);
    }

    private activateTideArchCheckpoint(): void {
        if (!this.up || !this.tideArch.altitudeRestored || !this.tideArch.crossedArch) return;
        if (!this.tideArch.bonusAwarded) {
            this.tideArch.bonusAwarded = true;
            const cleanBonus = this.tideArch.hadDamageDuringArch ? 0 : TIDE_ARCH_CLEAN_BONUS;
            const total = TIDE_ARCH_CHECKPOINT_BONUS + cleanBonus;
            this.score += total;
            this.pelagicScoring.recordSpecialBonus(total);
            this.emit('bonus', this.player.x, Math.max(82, this.player.y - 32), total, cleanBonus > 0 ? 'ARCO PERFEITO' : 'ARCO ATRAVESSADO');
        }
        this.checkpoint = {
            missionId: this.mission.id,
            checkpointId: 'tide-arch-clear',
            route: Math.max(182, this.route),
            scroll: this.scroll,
            region: this.region,
            waveIndex: this.waveIndex,
            supplyIndex: this.supplyIndex,
            specialEventsTriggered: [...this.specialEventsTriggered],
            rareSpawnCount: this.rareSpawnCount,
            score: this.score,
            lives: Math.min(3, Math.max(1, this.lives)),
            weaponLevel: this.weapons.weaponLevel,
            powerMeter: this.weapons.powerMeter,
            specialCharges: Math.min(2, this.weapons.specialCharges),
            hard: this.hard,
            assisted: this.assisted,
            tideArchCompleted: true,
            scoringState: this.pelagicScoring.exportState(),
        };
        this.stageDirector.markArchPhase('checkpoint', this.route);
        this.emit('checkpoint', this.player.x, this.player.y, 1, 'CHECKPOINT ALCANÇADO');
        this.emit('comms', 0, 0, 1, 'arch:checkpoint');
    }

    /** Restores gameplay from an activated Arco das Marés checkpoint without infinite resources or score-farming. */
    restartFromCheckpoint(snapshot = this.checkpoint): boolean {
        if (!this.up || !snapshot || !snapshot.tideArchCompleted) return false;
        this.clearArenaEntities();
        this.events.length = 0;
        this.state = 'play';
        this.introTime = 0;
        this.elapsed = snapshot.route;
        this.route = snapshot.route;
        this.scroll = snapshot.scroll;
        this.scrollSpeed = 38;
        this.region = regionAt(this.route);
        this.waveIndex = snapshot.waveIndex;
        this.supplyIndex = snapshot.supplyIndex;
        this.specialEventsTriggered.clear();
        for (const id of snapshot.specialEventsTriggered) this.specialEventsTriggered.add(id);
        this.rareSpawnCount = snapshot.rareSpawnCount;
        this.hard = snapshot.hard;
        this.assisted = snapshot.assisted;
        this.score = snapshot.score;
        this.lives = 3;
        this.weapons = createPlayerWeapons('nolan');
        this.weapons.weaponLevel = snapshot.weaponLevel;
        this.weapons.powerMeter = snapshot.powerMeter;
        this.weapons.specialCharges = Math.min(2, snapshot.specialCharges);
        this.pelagicScoring.restoreState(snapshot.scoringState);
        this.tideArch.jumpTo('complete', this.scroll, this.playerHomeY);
        this.tideArch.bonusAwarded = true;
        this.bossStarted = false;
        this.stageDirector.syncAfterJump(this.route, this.region);
        this.player.x = this.arenaCenterX;
        this.player.y = this.playerHomeY;
        this.player.bank = 0;
        this.player.altitude = 1;
        this.player.invulnerable = 2.0;
        this.emit('comms', 0, 0, 1, 'arch:resume');
        return true;
    }

    private dispatchScriptedEncounter(e: Encounter): void {
        this.spawnEncounter(e);
        const autoEscortEligible = !this.up || e.family === 'ship' || e.family === 'bomber' || e.family === 'heli_utility';
        if (this.effectiveHard && e.formation === 'solo' && e.family !== 'tower' && autoEscortEligible && (!this.up || this.enemies.length <= 5 || e.family === 'ship')) {
            if (this.up) {
                const naval = e.family === 'boat' || e.family === 'ship' || e.family === 'submarine';
                const escortFamily = naval ? 'fighter' : 'interceptor';
                const escortFormation = e.family === 'ship' || (this.region === 0 && !naval) ? 'solo' : this.region >= 5 && !naval ? 'pincer' : 'pair';
                const escortMotion = this.region === 0 && !naval ? 'diagonal' : escortFormation === 'pincer' ? 'diagonal' : 'curve';
                const escortLane = escortFormation === 'pincer' ? .5 : clamp(1 - e.lane, .22, .78);
                this.spawnEncounter({ ...e, family: escortFamily, formation: escortFormation, motion: escortMotion, lane: escortLane });
            } else {
                this.spawnEncounter({ ...e, family: 'interceptor', formation: 'pair', motion: 'curve', lane: 1 - e.lane });
            }
        }
    }

    private stepDynamicDirector(dt: number): void {
        if (!this.up) return;
        let visibleEnemies = 0;
        let approachingEnemies = 0;
        let hasActiveWarning = false;
        let specialEventActive = false;
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            if (e.warning > 0.05) hasActiveWarning = true;
            if (e.specialEvent) specialEventActive = true;
            if (e.x > this.arena.left - 12 && e.x < this.arena.right + 12 && e.y > this.arena.top - 12 && e.y < this.arena.bottom + 12) {
                visibleEnemies++;
            } else if (e.y >= this.arena.top - 60 && e.x >= this.arena.left - 65 && e.x <= this.arena.right + 65) {
                approachingEnemies++;
            }
        }
        let activeEnemyBullets = 0;
        for (const b of this.bullets) if (b.active && b.enemy) activeEnemyBullets++;
        const nextEncounter = this.waveIndex < this.mission.encounters.length ? this.mission.encounters[this.waveIndex] : undefined;
        const decision = this.pacingDirector.evaluate({
            up: this.up,
            dt,
            route: this.route,
            region: this.region,
            upLayout: this.upLayout,
            arenaWidth: this.arenaWidth,
            effectiveHard: this.effectiveHard,
            isAssisted: this.isAssisted,
            inBossFight: !!this.boss,
            tideArchActive: this.tideArch.airSpawnsBlocked,
            tideArchPhase: this.tideArch.phase,
            playerInvulnerable: this.player.invulnerable,
            playerX: this.player.x,
            arenaCenterX: this.arenaCenterX,
            visibleEnemies,
            approachingEnemies,
            activeEnemyBullets,
            hasActiveWarning,
            frameEnemyShots: this.stepEnemyShots,
            nextEncounter,
            specialEventActive,
        });
        if (decision.kind === 'anticipate' && this.waveIndex < this.mission.encounters.length) {
            const e = this.mission.encounters[this.waveIndex++];
            if (e.at !== 155 && !this.tideArch.airSpawnsBlocked) {
                this.dispatchScriptedEncounter(e);
            }
        } else if (decision.kind === 'reinforce' && decision.encounter) {
            this.spawnEncounter(decision.encounter);
        } else if (decision.kind === 'arch-boat') {
            this.spawnArchBoat({ id: 'arch-dyn-boat', laneFrac: 0.48, speed: 27, stage: 'ascent', cooldownOffset: 0.42 });
        }
    }
    private spawnEncounter(
        e: Omit<Mission['encounters'][number], 'at'>,
        special?: { specialEvent: PelagicSpecialEventId; eventRole: PelagicEventRole; cooldown?: number },
    ): void {
        const offsets = formationOffsets(e.formation);
        if (this.up) this.pacingDirector.noteEncounterSpawned();
        const squadId = this.up && offsets.length >= 2 ? this.pelagicScoring.registerSquad(offsets.length, this.effectiveHard) : undefined;
        offsets.forEach(([offset, delay], i) => {
            const family = e.formation === 'escort' && i > 0 ? 'fighter' : e.family; const def = FAMILY[family];
            const ground = (this.up ? ['boat', 'ship', 'tank', 'tower', 'submarine'] : ['tank', 'tower']).includes(family);
            const isHeli = family.startsWith('heli_');
            const isSideEntry = this.up && !ground && (e.entry === 'left' || e.entry === 'right' || e.motion === 'side-cross' || e.motion === 'side-curve');
            const entry: EntrySide | undefined = isSideEntry ? (e.entry === 'left' || e.entry === 'right' ? e.entry : e.lane < .5 ? 'left' : 'right') : undefined;
            const lane = clamp(e.lane + offset, .09, .91);
            const cross = this.up ? this.arena.left + lane * this.arenaWidth : ground ? 390 : this.arena.top + lane * 350;
            const baseSpeed = family === 'interceptor' ? 128 : family === 'acrobat' ? 100 : family === 'fighter' ? 92 : family === 'alien' ? 95 : family === 'bomber' ? 72 : family === 'airship' ? 62 : family === 'heli_scout' ? 112 : family === 'heli_utility' ? 74 : family === 'heli_phantom' ? 122 : family === 'heli_warhawk' ? 80 : ground ? 24 : 80;
            const spd = e.speed ?? baseSpeed;
            let spawnX = this.up ? cross : 800 - delay * 220;
            let spawnY = this.up ? -30 + delay * 220 : cross;
            let laneRef = cross;
            if (isSideEntry && entry) {
                const sideDir = entry === 'left' ? 1 : -1;
                const bandY = clamp(this.arena.top + 28 + clamp(e.lane, .06, .82) * 110 + (i % 4) * 20, this.arena.top + 24, 178);
                spawnX = entry === 'left' ? this.arena.left - 34 - i * 28 : this.arena.right + 34 + i * 28;
                spawnY = bandY;
                laneRef = bandY;
                if (sideDir < 0) spawnX = Math.max(spawnX, this.arena.right + 34);
            }
            const initCooldown = special?.cooldown !== undefined
                ? special.cooldown + i * .22
                : this.up
                    ? (isHeli ? .38 + i * .16 : ground ? .42 + i * .16 : .24 + i * .13)
                    : (1.6 + i * .2);
            const mountCount = getMountSpecs(family).length;
            const actor: Actor = {
                id: ++this.sequence,
                x: spawnX,
                y: spawnY,
                size: def.size,
                hp: def.hp,
                maxHp: def.hp,
                age: 0,
                flash: 0,
                family,
                motion: e.motion,
                lane: laneRef,
                offset: i * .7,
                speed: spd,
                cooldown: initCooldown,
                warning: 0,
                ground,
                vx: isSideEntry ? (entry === 'left' ? spd : -spd) : this.up ? 0 : -spd,
                vy: isSideEntry ? 24 : this.up ? spd : 0,
                ...(entry ? { entry } : {}),
                ...(isHeli ? { altitude: family === 'heli_warhawk' ? .96 : family === 'heli_utility' ? .92 : .85 } : {}),
                ...(mountCount > 0 ? { mountAngles: Array(mountCount).fill(Math.PI / 2), mountRecoil: Array(mountCount).fill(0), attackStep: 0 } : {}),
                ...(squadId !== undefined ? { squadId } : {}),
                ...(special ? { specialEvent: special.specialEvent, eventRole: special.eventRole } : {}),
            };
            this.enemies.push(actor);
            if (this.up && family === 'submarine') {
                if (i === 0) this.emit('comms', actor.x, actor.y, 1, 'submarine');
                const solo = e.formation === 'solo';
                let y = solo ? 120 : 80 + i * 100, corridor = waterCorridor(y - this.scroll, actor.size * .52, 0, this.arena.left, this.arenaWidth), span = corridor.right - corridor.left;
                if (solo) {
                    for (const candidateY of [90, 115, 140, 165]) {
                        const c = waterCorridor(candidateY - this.scroll, actor.size * .52, 0, this.arena.left, this.arenaWidth);
                        if (c.right - c.left > span) { y = candidateY; corridor = c; span = c.right - c.left; }
                    }
                }
                const side: (-1 | 1) = solo ? (e.lane < .5 ? -1 : 1) : (i % 2 === 0 ? -1 : 1);
                actor.x = solo ? (corridor.left + corridor.right) / 2 + side * Math.min(26, span * .16) : (side < 0 ? corridor.left + span * .16 : corridor.right - span * .16);
                actor.y = y;
                actor.navigation = { worldY: y - this.scroll, heading: side < 0 ? Math.PI / 2 : -Math.PI / 2, entry: 0, phase: 'hold' };
                actor.submarine = { phase: 'emerge', exposure: 0, side };
                actor.cooldown = special?.cooldown ?? (1.24 + i * .18);
            } else if (this.up && (actor.eventRole === 'convoy-lead' || actor.eventRole === 'convoy-escort')) {
                const startY = actor.eventRole === 'convoy-lead' ? -68 : -30;
                const worldY = startY - this.scroll;
                const corridor = waterCorridor(worldY, actor.size * .51, 24, this.arena.left, this.arenaWidth);
                const span = Math.max(2, corridor.right - corridor.left);
                const escortSide: -1 | 0 | 1 = actor.eventRole === 'convoy-lead' ? 0 : (e.lane < .5 ? -1 : 1);
                actor.x = escortSide === 0 ? (corridor.left + corridor.right) / 2 : escortSide < 0 ? corridor.left + Math.min(24, span * .24) : corridor.right - Math.min(24, span * .24);
                actor.y = startY;
                actor.navigation = { worldY, heading: Math.PI, entry: 0, lane: escortSide, phase: 'enter' };
            } else if (this.up && ground) {
                const occupied = new Set([...this.enemies.map(a => a.navigation?.anchor), ...this.wrecks.map(w => w.anchor)].filter((id): id is number => id !== undefined));
                prepareSurface(actor, this.scroll, family === 'boat' ? (e.formation === 'solo' ? (e.lane > .68 ? 1 : 0) : (i % 2 === 0 ? -1 : 1)) : 0, occupied, this.arena.left, this.arenaWidth);
            }
            if (actor.mountAngles && this.up) {
                const initialMounts = resolveActorMounts(actor, this.player.x, this.player.y, this.elapsed);
                for (let m = 0; m < actor.mountAngles.length; m++) {
                    if (initialMounts[m]) actor.mountAngles[m] = initialMounts[m].aimAngle;
                }
            }
            if (this.up && !special && i === 0 && ['bomber', 'ship', 'airship', 'interceptor', 'heli_warhawk'].includes(family)) {
                this.emit('comms', actor.x, actor.y, 1, `threat:${family}`);
            }
        });
    }
    private updateEnemies(dt: number): void {
        const spdMul = this.enemySpeedScale !== 1 ? clamp(this.enemySpeedScale, 0.25, 3) : 1;
        const mDt = dt * spdMul;
        for (const e of this.enemies) {
            if (e.hp <= 0) continue;
            const prevX = e.x, prevY = e.y;
            e.age += mDt; e.flash = Math.max(0, e.flash - dt); const t = e.age;
            let advance = e.speed, cross = 0;
            switch (e.motion) { case 'sine': cross = Math.sin(t * 2.6 + e.offset) * 26; break; case 'curve': cross = Math.sin(t * 1.25 + e.offset) * 58; break; case 'zigzag': cross = 2 / Math.PI * Math.asin(Math.sin(t * 2.8)) * 32; break; case 'diagonal': cross = (e.lane < (this.up ? this.arenaCenterX : 216) ? 1 : -1) * t * 36; break; case 'turn': cross = Math.sin(Math.min(Math.PI, t * 1.05)) * 66; advance = t > 3.2 ? -42 : e.speed * 1.08; break; case 'dive': advance = e.speed * 1.1 + Math.min(175, t * t * 32); cross = Math.sin(t * 2.2) * 32; break; case 'accelerate': advance = e.speed * .85 + Math.min(155, t * 42); break; case 'retreat': advance = t > 3.8 ? -65 : e.speed * .9; cross = Math.sin(t * 1.6) * 16; break; case 'stationary': advance = t < 1.8 ? 62 : 16; break; }
            if (e.archRetiring && this.up && !e.ground) {
                e.y += Math.max(155, e.speed * 1.35) * mDt;
                e.x += (e.x < this.arenaCenterX ? -42 : 42) * mDt;
            } else if (e.submarine) {
                const sub = e.submarine; sub.phase = t < 1.2 ? 'emerge' : t < 8.2 ? 'hold' : 'submerge';
                sub.exposure = clamp(t < 1.2 ? t / 1.2 : t < 8.2 ? 1 : 1 - (t - 8.2) / 1.2, 0, 1);
                e.y = e.navigation!.worldY + this.scroll;
            } else if (this.up && e.eventRole === 'rare-probe') {
                if (t < 7.8) {
                    const enterOffset = t < 1.1 ? (1 - t / 1.1) * -135 : 0;
                    e.x = clamp(this.arenaCenterX + Math.sin(t * 1.45) * 124, this.arena.left + 26, this.arena.right - 26);
                    e.y = clamp(108 + Math.sin(t * 2.55) * 34 + enterOffset, enterOffset < 0 ? -90 : this.arena.top + 18, 225);
                } else {
                    e.y -= 155 * mDt;
                    e.x = clamp(e.x + (e.x < this.arenaCenterX ? -45 : 45) * mDt, this.arena.left - 30, this.arena.right + 30);
                }
            } else if (this.up && e.eventRole === 'elite-ace') {
                if (t < 1.3) {
                    e.y += e.speed * 1.08 * mDt;
                    e.x = clamp(e.lane + Math.sin(t * 2.2 + e.offset) * 44, this.arena.left + 16, this.arena.right - 16);
                } else if (t < 5.0) {
                    e.y = clamp(e.y + Math.sin(t * 2.1 + e.offset) * 20 * mDt, this.arena.top + 28, 178);
                    e.x = clamp(e.lane + Math.sin(t * 2.35 + e.offset) * 58, this.arena.left + 16, this.arena.right - 16);
                } else {
                    e.y += e.speed * 1.15 * mDt;
                    const peel = (e.lane < this.arenaCenterX ? -1 : 1) * (t - 5.0) * 62;
                    e.x = clamp(e.lane + peel + Math.sin(t * 2.35 + e.offset) * 26, this.arena.left + 14, this.arena.right - 14);
                }
            } else if (this.up && e.ground) {
                const archClamp = e.archBoat ? computeArchOpening(this.arena.left, this.arena.right) : undefined;
                moveSurface(e, this.scroll, mDt, this.arena.left, this.arenaWidth, archClamp);
            } else if (this.up && e.family === 'heli_utility') {
                e.altitude = .88 + Math.sin(t * 2.2 + e.offset) * .16;
                if (t < 1.25) {
                    e.y += (e.speed + 26) * mDt;
                    e.x = clamp(e.lane + Math.sin(t * 1.4 + e.offset) * 18, this.arena.left + 26, this.arena.right - 26);
                } else if (t < 6.0) {
                    const hoverY = clamp(96 + (e.offset % 2) * 24 + Math.sin(t * 2.0 + e.offset) * 8, this.arena.top + 26, 168);
                    e.y += (hoverY - e.y) * Math.min(1, mDt * 3.5);
                    e.x = clamp(e.lane + Math.sin((t - 1.25) * 1.25 + e.offset) * 48, this.arena.left + 26, this.arena.right - 26);
                } else {
                    e.y += Math.max(this.scrollSpeed + 28, e.speed * 1.05) * mDt;
                    e.x = clamp(e.x + (e.x < this.arenaCenterX ? -32 : 32) * mDt, this.arena.left + 20, this.arena.right - 20);
                }
            } else if (this.up && e.family === 'heli_phantom') {
                e.altitude = .82 + Math.sin(t * 3.6 + e.offset) * .12;
                const dir = e.entry === 'right' ? -1 : 1;
                if (t < 1.1) {
                    if (e.entry === 'left' || e.entry === 'right') {
                        e.x += dir * (e.speed * 1.15) * mDt;
                        e.y = clamp(e.y + 42 * mDt, this.arena.top + 22, 165);
                    } else {
                        e.y += (e.speed * 1.02) * mDt;
                        e.x = clamp(e.lane + Math.sin(t * 3 + e.offset) * 32, this.arena.left + 24, this.arena.right - 24);
                    }
                } else if (t < 6.4) {
                    const phase = (t - 1.1) % 1.95;
                    if (phase < 1.05) {
                        // Fast lateral-diagonal stealth dash
                        const dSign = Math.floor((t - 1.1) / 1.95) % 2 === 0 ? dir : -dir;
                        e.x = clamp(e.x + dSign * (e.speed * 1.38) * mDt, this.arena.left + 24, this.arena.right - 24);
                        e.y = clamp(e.y + Math.sin(t * 3.2) * 26 * mDt, this.arena.top + 24, 175);
                    } else {
                        // Brief stabilized lock window to align 3-way fan
                        e.y = clamp(e.y + Math.sin(t * 2.4) * 10 * mDt, this.arena.top + 24, 175);
                    }
                } else {
                    e.y += (e.speed * 1.2) * mDt;
                }
            } else if (this.up && e.family === 'heli_warhawk') {
                e.altitude = .94 + Math.sin(t * 1.8) * .08;
                if (t < 1.35) {
                    e.y += 96 * mDt;
                    e.x = clamp(e.x + (this.arenaCenterX - e.x) * mDt * .9, this.arena.left + 36, this.arena.right - 36);
                } else if (t < 11.2) {
                    const stationY = clamp(98 + Math.sin(t * 1.35) * 14, this.arena.top + 32, 152);
                    e.y += (stationY - e.y) * Math.min(1, mDt * 3.2);
                    e.x = clamp(this.arenaCenterX + Math.sin((t - 1.35) * 0.92 + e.offset) * 92, this.arena.left + 38, this.arena.right - 38);
                } else {
                    e.y += 108 * mDt;
                }
            } else if (this.up && e.family === 'heli_scout') {
                e.altitude = .85 + Math.sin(t * 4.2 + e.offset) * .10;
                if (e.entry === 'left' || e.entry === 'right') {
                    const dir = e.entry === 'left' ? 1 : -1;
                    const curveTurn = clamp((t - .9) / 1.3, 0, 1);
                    e.x = clamp(e.x + dir * (e.speed * (1.15 - curveTurn * .65) + Math.sin(t * 4.2 + e.offset) * 32) * mDt, this.arena.left - 120, this.arena.right + 120);
                    e.y += Math.max(this.scrollSpeed + 18, 34 + curveTurn * (e.speed * .85)) * mDt;
                } else {
                    e.y += Math.max(this.scrollSpeed + 20, e.speed * .82) * mDt;
                    e.x = clamp(e.lane + Math.sin(t * 3.6 + e.offset) * 74, this.arena.left + 20, this.arena.right - 20);
                }
            } else if (this.up && (e.entry === 'left' || e.entry === 'right' || e.motion === 'side-cross' || e.motion === 'side-curve')) {
                const dir = e.entry === 'right' ? -1 : 1;
                if (e.motion === 'side-cross') {
                    e.x += dir * e.speed * mDt;
                    e.y += (34 + Math.sin(t * 2.2 + e.offset) * 20) * mDt;
                } else {
                    // side-curve: sweep aggressively horizontally from wing edge then bank smoothly down into arena
                    const turn = clamp((t - .55) / 1.45, 0, 1);
                    const vxLocal = dir * e.speed * (1.05 - turn * .78) + Math.sin(t * 2.8 + e.offset) * 18;
                    const vyLocal = Math.max(this.scrollSpeed + 16, 28 + turn * e.speed * .98);
                    e.x = clamp(e.x + vxLocal * mDt, this.arena.left - 140, this.arena.right + 140);
                    e.y += vyLocal * mDt;
                }
            } else if (this.up) { advance = Math.max(this.scrollSpeed + 16, advance); e.y += advance * mDt; e.x = clamp(e.lane + cross, this.arena.left + 12, this.arena.right - 12); }
            else { e.x -= Math.max(32, advance) * mDt; e.y = clamp(e.lane + cross, this.arena.top + 12, this.arena.bottom - 12); }

            if (dt > 0) {
                e.vx = (e.x - prevX) / dt;
                e.vy = (e.y - prevY) / dt;
            }
            if (this.up && e.mountRecoil) {
                for (let m = 0; m < e.mountRecoil.length; m++) e.mountRecoil[m] = Math.max(0, e.mountRecoil[m] - dt * 5.2);
            }
            if (this.up && e.mountAngles && hasArticulatedMounts(e.family)) {
                const slewRate = e.family === 'heli_warhawk' ? 4.8 : e.family === 'submarine' ? 4.5 : e.family === 'boat' ? 4.2 : 3.4;
                const liveMounts = resolveActorMounts(e, this.player.x, this.player.y, this.elapsed);
                for (let m = 0; m < liveMounts.length; m++) {
                    const spec = getMountSpecs(e.family)[m];
                    if (spec?.canRotate) {
                        const targetAim = Math.atan2(this.player.y - liveMounts[m].pivotY, this.player.x - liveMounts[m].pivotX);
                        e.mountAngles[m] = slewAngle(e.mountAngles[m], targetAim, slewRate * dt);
                    } else if (liveMounts[m]) {
                        e.mountAngles[m] = liveMounts[m].aimAngle;
                    }
                }
            }

            e.cooldown -= dt; e.warning = e.cooldown < .48 && e.cooldown > 0 ? 1 - e.cooldown / .48 : 0;
            const beat = Math.floor(this.elapsed * 1.15) % 2;
            const waitCoordBeat = (e.eventRole === 'coord-sub' && beat !== 0) || (e.eventRole === 'coord-wing' && beat !== 1)
                || (e.archPattern === 'alternating' && e.archSide !== undefined && ((e.archSide < 0 && beat !== 0) || (e.archSide > 0 && beat !== 1)));
            const subReady = !e.submarine || (e.submarine.phase === 'hold' && e.submarine.exposure >= .88);
            const horizMargin = this.up ? (e.ground ? 2 : 10) : 0;
            const topMargin = this.up ? (e.ground ? 8 : 18) : 0;
            const inSafeArena = e.x > this.arena.left + horizMargin && e.x < this.arena.right - horizMargin && e.y > this.arena.top + topMargin && e.y < this.arena.bottom - (this.up ? 18 : 0);
            if (e.cooldown <= 0 && subReady && inSafeArena && !e.archRetiring) {
                if (waitCoordBeat) {
                    e.cooldown = .04;
                    e.warning = .92;
                } else {
                    const behind = this.up ? e.y > this.player.y - 44 : e.x < this.player.x + 28;
                    if (!behind) {
                        const shot = (!this.up ? LEGACY_SOLAR_SHOTS[e.family] : undefined) ?? ENEMY_SHOTS[e.family];
                        const spdScale = this.enemyShotSpeedScale !== 1 ? clamp(this.enemyShotSpeedScale, .25, 3) : 1;
                        let shotSpd = (shot.speed + (this.effectiveHard ? 26 : 0)) * spdScale;
                        if (this.up && hasArticulatedMounts(e.family)) {
                            const mounts = resolveActorMounts(e, this.player.x, this.player.y, this.elapsed);
                            if (e.family === 'heli_warhawk') {
                                const phase = (e.attackStep ?? 0) % 3;
                                if (phase < 2) {
                                    // Chin gatling burst directly from chin turret muzzle
                                    const m0 = mounts[0];
                                    const spread = this.effectiveHard ? [-.14, 0, .14] : [-.09, .09];
                                    for (const a of spread) this.hostile(m0.muzzleX, m0.muzzleY, m0.aimAngle + a, shotSpd, shot.radius, shot.color);
                                    if (e.mountRecoil) e.mountRecoil[0] = 1;
                                    this.stepEnemyShots++;
                                    this.emit('enemy-shot', m0.muzzleX, m0.muzzleY, 1.0);
                                } else {
                                    // Single straight unguided fast missile from right-wing pod muzzle
                                    const m1 = mounts[1];
                                    const mSpd = (this.effectiveHard ? WARHAWK_MISSILE_SPEED_HARD : WARHAWK_MISSILE_SPEED_NORMAL) * spdScale;
                                    this.hostile(m1.muzzleX, m1.muzzleY, m1.aimAngle, mSpd, 4.6, 1, true);
                                    if (e.mountRecoil) e.mountRecoil[1] = 1;
                                    this.stepEnemyShots++;
                                    this.emit('enemy-shot', m1.muzzleX, m1.muzzleY, 1.55);
                                }
                                e.attackStep = phase + 1;
                            } else {
                                // Submarine, Boat, Ship, Tank, Tower fire strictly from each active turret's barrel tip
                                const step = e.attackStep ?? 0;
                                const firingMounts = (e.family === 'ship' || e.family === 'submarine') && e.eventRole !== 'coord-sub'
                                    ? [mounts[step % mounts.length]]
                                    : mounts;
                                if (e.family === 'ship' || e.family === 'submarine' || e.family === 'boat' || e.family === 'tank' || e.archPattern || e.archBoat) e.attackStep = step + 1;
                                for (const m of firingMounts) {
                                    let angles: number[] = e.family === 'ship'
                                        ? (this.effectiveHard ? [-.22, -.07, .07, .22] : [-.14, .14])
                                        : e.submarine
                                            ? (this.effectiveHard ? [-.16, 0, .16] : [-.10, .10])
                                            : e.family === 'boat'
                                                ? (this.effectiveHard ? [-.09, .09] : [0])
                                                : e.family === 'tank'
                                                    ? (this.effectiveHard ? [-.08, .08] : [0])
                                                    : e.family === 'tower' && !e.archPattern
                                                        ? (this.effectiveHard ? [-.11, .11] : [0])
                                                        : [0];
                                    if (e.eventRole === 'coord-sub') {
                                        angles = [-.22, 0, .22];
                                        shotSpd = 172 + (this.effectiveHard ? 28 : 0);
                                    } else if (e.eventRole === 'convoy-lead') {
                                        angles = this.effectiveHard ? [-.20, 0, .20] : [-.14, .14];
                                    } else if (e.archPattern === 'alternating') {
                                        angles = this.effectiveHard ? [-.12, .12] : [0];
                                    } else if (e.archPattern === 'aimed-burst') {
                                        angles = this.effectiveHard ? [-.11, .11] : [0];
                                        shotSpd = (shot.speed + (this.effectiveHard ? 28 : 12)) * spdScale;
                                    } else if (e.archPattern === 'fan3') {
                                        angles = this.effectiveHard ? [-.26, 0, .26] : [-.19, 0, .19];
                                    } else if (e.archPattern === 'sweep') {
                                        const sweepShift = Math.sin(step * 0.9) * 0.16;
                                        angles = this.effectiveHard ? [-.10 + sweepShift, .10 + sweepShift] : [sweepShift];
                                    } else if (e.archBoat) {
                                        angles = this.effectiveHard
                                            ? (step % 2 === 0 ? [-.15, 0, .15] : [-.09, .09])
                                            : (step % 2 === 0 ? [0] : [-.09, .09]);
                                    }
                                    for (const a of angles) this.hostile(m.muzzleX, m.muzzleY, m.aimAngle + a, shotSpd, shot.radius, shot.color);
                                    if (e.mountRecoil && m.id < e.mountRecoil.length) e.mountRecoil[m.id] = 1;
                                    this.stepEnemyShots++;
                                    this.emit('enemy-shot', m.muzzleX, m.muzzleY, e.family === 'tower' || e.family === 'ship' ? 1.3 : 1.0);
                                }
                            }
                        } else {
                            const unmounted = this.up
                                ? resolveUnmountedMuzzle(e, this.player.x, this.player.y, this.elapsed)
                                : { mountX: e.x, mountY: e.y + (e.ground ? -e.size * .09 : 0), muzzleX: e.x + Math.cos(Math.atan2(this.player.y - e.y, this.player.x - e.x)) * (e.ground ? e.size * .2 : 5), muzzleY: e.y + Math.sin(Math.atan2(this.player.y - e.y, this.player.x - e.x)) * (e.ground ? e.size * .2 : 5), aimAngle: Math.atan2(this.player.y - (e.y + (e.ground ? -e.size * .09 : 0)), this.player.x - e.x) };
                            const aim = unmounted.aimAngle;
                            const airStep = e.attackStep ?? 0;
                            if (this.up) e.attackStep = airStep + 1;
                            let angles: number[] = e.family === 'bomber' ? (this.effectiveHard ? [-.32, -.16, 0, .16, .32] : [-.26, 0, .26])
                                : e.family === 'heli_utility' ? (this.effectiveHard ? [-.16, 0, .16] : [-.10, .10])
                                    : e.family === 'heli_phantom' ? (this.effectiveHard ? [-.26, 0, .26] : [-.18, 0, .18])
                                        : e.family === 'heli_scout' ? (this.effectiveHard ? [-.09, .09] : [0])
                                            : e.family === 'interceptor' ? (this.up && this.effectiveHard && airStep % 2 === 1 ? [-.06, .06] : [0])
                                                : e.family === 'acrobat' ? (this.up && this.effectiveHard && airStep % 2 === 1 ? [-.10, .10] : [0])
                                                    : e.family === 'fighter' ? (this.up && this.effectiveHard && airStep % 3 === 2 ? [-.06, .06] : [0])
                                                        : e.family === 'ship' || e.submarine ? [-.16, .16]
                                                            : [0];
                            if (e.eventRole === 'elite-ace') {
                                angles = this.effectiveHard && e.offset === 0 ? [-.12, 0, .12] : [-.08, .08];
                                shotSpd = 212 + (this.effectiveHard ? 28 : 0);
                            } else if (e.eventRole === 'coord-wing') {
                                angles = e.family === 'acrobat' ? [-.12, .12] : [0];
                            } else if (e.eventRole === 'convoy-escort') {
                                angles = [-.06, .06];
                            } else if (e.eventRole === 'rare-probe') {
                                angles = [-.42, -.14, .14, .42];
                                shotSpd = 178 + (this.effectiveHard ? 24 : 0);
                            }
                            for (const a of angles) this.hostile(unmounted.muzzleX, unmounted.muzzleY, aim + a, shotSpd, shot.radius, shot.color);
                            this.stepEnemyShots++;
                            this.emit('enemy-shot', unmounted.muzzleX, unmounted.muzzleY, 1.0);
                        }
                    }
                    const baseCd = (!this.up ? LEGACY_SOLAR_FIRE[e.family] : undefined) ?? FAMILY[e.family].fire;
                    const archCd = e.archPattern ? 2.24 : e.archBoat ? 2.30 : baseCd;
                    const roleCd = e.eventRole === 'rare-probe' ? 1.65 : e.eventRole === 'elite-ace' ? 1.32 : e.family === 'heli_warhawk' && (e.attackStep ?? 0) % 3 === 2 ? .84 : archCd;
                    const fireScale = this.enemyFireRateScale !== 1 ? clamp(this.enemyFireRateScale, .2, 5) : 1;
                    const hardFactor = (e.archPattern || e.archBoat) ? .80 : .78;
                    const modeFactor = this.effectiveHard ? hardFactor : 1;
                    e.cooldown = (roleCd * modeFactor) / fireScale;
                }
            }
            if (!e.ground && Math.hypot(e.x - this.player.x, e.y - this.player.y) < e.size * .28 + 7) this.hurtPlayer();
        }
        const cullBottom = Math.max(470, this.arena.bottom + 55);
        this.enemies = this.enemies.filter(e => {
            const sideExited = this.up && (e.entry === 'left' || e.entry === 'right' || e.motion === 'side-cross') && e.age > 1.8 && (e.x < this.arena.left - 65 || e.x > this.arena.right + 65);
            const isAnchored = e.navigation?.anchor !== undefined || e.navigation?.customAnchor === true;
            const keep = !sideExited && e.hp > 0 && (!e.submarine || e.age < 9.4) && (isAnchored || e.age < 23) && e.y < cullBottom && (isAnchored || e.y > -240) && e.x > -140 && e.x < 930;
            if (!keep && e.hp > 0 && this.up) this.pelagicScoring.onSquadMemberEscaped(e.squadId);
            return keep;
        });
    }
    private bullet(x: number, y: number, vx: number, vy: number, damage: number, radius: number, enemy = false, missile = false, scale = 1, homing = false, color?: number, enemyMissile = false): void {
        const b = this.bullets.find(b => !b.active); if (!b) return;
        Object.assign(b, { active: true, x, y, px: x, py: y, vx, vy, damage, radius, enemy, missile, enemyMissile, scale, homing, age: 0, color: color ?? (radius > 7 ? 2 : radius > 4 ? 1 : 0) });
    }
    private firePrimary(): void {
        for (const p of getPrimaryProjectiles('nolan', this.weapons.weaponLevel, 0, 0)) {
            const x = this.player.x + (this.up ? p.x : 17 - p.y), y = this.player.y + (this.up ? p.y - 15 : p.x);
            this.bullet(x, y, this.up ? p.velocityX : -p.velocityY, this.up ? p.velocityY : p.velocityX, p.damage, 3.6, false, false, p.scale);
        } this.emit('shot');
    }
    private fireMissiles(): void { for (const p of getSecondaryProjectiles('nolan', 0, 0, this.weapons.weaponLevel)) this.bullet(this.player.x + (this.up ? p.x : -p.y), this.player.y + (this.up ? p.y : p.x), this.up ? p.velocityX : -p.velocityY, this.up ? p.velocityY : p.velocityX, p.damage, p.hitRadius, false, true, p.scale, p.homing); this.emit('missile'); }
    private hostile(x: number, y: number, angle: number, speed: number, radius: number, color?: number, enemyMissile = false): void { this.bullet(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1, radius, true, false, 1, false, color, enemyMissile); }
    private updateBullets(dt: number): void {
        for (const b of this.bullets) {
            if (!b.active) continue; b.px = b.x; b.py = b.y; b.age += dt;
            if (b.homing) {
                const subFight = this.boss?.sub?.phase === 'fight' ? this.boss.sub : undefined;
                const subSec = subFight ? subFight.sections[subFight.activeSection] : undefined;
                const bossTargets = subFight && subSec ? subSec.parts.filter(p => p.hp > 0) : (this.boss?.phase === 'fight' ? this.boss.parts.filter(p => p.hp > 0) : []);
                const targets = [...this.enemies.filter(e => e.hp > 0 && e.x >= this.arena.left && e.x <= this.arena.right && e.y >= this.arena.top && e.y <= this.arena.bottom && (!e.submarine || e.submarine.exposure >= .6)), ...bossTargets];
                let best: { x: number; y: number } | undefined, d = Infinity;
                for (const e of targets) { const distance = Math.hypot(e.x - b.x, e.y - b.y); if (distance < d) { d = distance; best = e; } }
                if (!best && subFight && subSec && subSec.hullHp > 0 && this.boss) best = { x: this.boss.x, y: subSectionCenterY(subFight, subFight.activeSection) };
                if (best) { const a = Math.atan2(best.y - b.y, best.x - b.x); b.vx += (Math.cos(a) * 330 - b.vx) * dt * 4; b.vy += (Math.sin(a) * 330 - b.vy) * dt * 4; }
            }
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.enemy) { if (this.bomb?.phase === 'blast' && Math.hypot(b.x - this.bomb.x, b.y - this.bomb.y) < this.bomb.radius) { b.active = false; continue; } if (sweepEllipse(b.px, b.py, b.x, b.y, this.player.x, this.player.y, 5 + b.radius, 7 + b.radius) !== null) { b.active = false; this.hurtPlayer(); } }
            else {
                if (this.up && this.tideArch.isPillarCollisionActive(this.scroll, b.y)) {
                    const opening = computeArchOpening(this.arena.left, this.arena.right);
                    if (b.x < opening.left - 8 || b.x > opening.right + 8) { b.active = false; this.emit('impact', b.x, b.y, .25); continue; }
                }
                this.collideFriendly(b);
            }
            if (b.age > 9 || b.x < this.arena.left - 35 || b.x > this.arena.right + 35 || b.y < this.arena.top - 60 || b.y > this.arena.bottom + 40) b.active = false;
        }
    }
    private collideFriendly(b: Bullet): void {
        let nearest = Infinity;
        let target: Actor | Cargo | Obstacle | Boss | undefined;
        let subHit: { sec: SubSection; part?: SubModule } | undefined;
        for (const e of this.enemies) { if (e.hp <= 0 || (e.submarine && e.submarine.exposure < .6) || Math.abs(e.x - b.x) > e.size || Math.abs(e.y - b.y) > e.size + 40) continue; const t = this.contact ? this.contact(e, b.px, b.py, b.x, b.y, b.radius) : sweepEllipse(b.px, b.py, b.x, b.y, e.x, e.y, e.size * .32 + b.radius, e.size * .37 + b.radius); if (t !== null && t < nearest) { nearest = t; target = e; } }
        if (this.boss?.sub) {
            const sub = this.boss.sub;
            if (sub.phase === 'fight') {
                const sec = sub.sections[sub.activeSection];
                let tPartBest = Infinity; let hitPart: SubModule | undefined;
                for (const p of sec.parts) {
                    if (p.hp <= 0) continue;
                    const tp = sweepEllipse(b.px, b.py, b.x, b.y, p.x, p.y, p.radius + b.radius, p.radius + b.radius);
                    if (tp !== null && tp < tPartBest) { tPartBest = tp; hitPart = p; }
                }
                if (hitPart && tPartBest < nearest) { nearest = tPartBest; target = undefined; subHit = { sec, part: hitPart }; }
                else if (sec.hullHp > 0) {
                    const th = this.subHullContact ? this.subHullContact(sub, sub.activeSection, b.px, b.py, b.x, b.y, b.radius) : subHullGeometricContact(sub, this.boss.x, sub.activeSection, b.px, b.py, b.x, b.y, b.radius);
                    if (th !== null && th < nearest) { nearest = th; target = undefined; subHit = { sec }; }
                }
            }
        } else if (this.boss?.phase === 'fight') {
            const boss = this.boss, t = this.bossContact ? this.bossContact(boss, b.px, b.py, b.x, b.y, b.radius) : sweepEllipse(b.px, b.py, b.x, b.y, boss.x, boss.y, boss.size * .43 + b.radius, boss.size * (this.up ? .37 : .29) + b.radius);
            if (t !== null && t < nearest) { nearest = t; target = boss; }
        }
        for (const c of this.cargo) { if (!c.crate) continue; const t = sweepEllipse(b.px, b.py, b.x, b.y, c.x, c.y, 12 + b.radius, 12 + b.radius); if (t !== null && t < nearest) { nearest = t; target = c; subHit = undefined; } }
        for (const o of this.obstacles) { if (o.kind !== 'barrier' || o.hp <= 0) continue; const t = sweepEllipse(b.px, b.py, b.x, b.y, o.x, o.y, o.width / 2 + b.radius, o.height / 2 + b.radius); if (t !== null && t < nearest) { nearest = t; target = o; subHit = undefined; } }
        if (!target && !subHit) return; b.x = b.px + (b.x - b.px) * nearest; b.y = b.py + (b.y - b.py) * nearest; b.active = false;
        if (subHit && this.boss?.sub) {
            if (subHit.part) this.damageSubModule(this.boss.sub, subHit.sec, subHit.part, b.damage, b.x, b.y);
            else this.damageSubHull(this.boss.sub, subHit.sec, b.damage, b.x, b.y);
        } else if (target && 'parts' in target) { this.damageBossAt(b.x, b.y, b.damage); }
        else if (target && 'crate' in target) { target.hp -= b.damage; if (target.hp <= 0) { target.crate = false; target.age = 0; target.vx = this.up ? 58 : -58; target.vy = this.up ? 37 : 35; this.emit('explosion', target.x, target.y, .35); } }
        else if (target && 'kind' in target) { target.hp -= b.damage; if (target.hp <= 0) this.emit('explosion', target.x, target.y, 1); }
        else if (target) this.damage(target, b.damage, b.x, b.y);
    }
    private damage(target: Actor | Component, amount: number, x: number, y: number, emitImpact = true): void {
        if (target.hp <= 0) return; target.hp = Math.max(0, target.hp - amount); target.flash = .095; if (emitImpact) this.emit('impact', x, y, .3);
        if (target.hp === 0) {
            if ('family' in target && this.up && (target.navigation?.anchor !== undefined || target.navigation?.customAnchor)) {
                this.wrecks.push({ anchor: target.navigation.anchor, customAnchor: target.navigation.customAnchor, family: target.family === 'tower' && !target.navigation.customAnchor ? 'tower' : 'tank', id: target.id, x: target.x, y: target.y, worldY: target.y - this.scroll, size: target.size, age: 0 });
            }
            const rareKill = 'eventRole' in target && target.eventRole === 'rare-probe';
            const size = rareKill ? 1.85 : 'family' in target ? target.size / 30 : 1.3;
            this.emit('explosion', x, y, size, 'family' in target ? target.family : undefined);
            if ('family' in target) {
                this.score += FAMILY[target.family].score;
                this.kills++;
                if (this.up && target.squadId) {
                    const squadAward = this.pelagicScoring.onSquadMemberKilled(target.squadId);
                    if (squadAward) {
                        this.score += squadAward.bonus;
                        this.emit('bonus', x, y, squadAward.bonus, 'FORMAÇÃO');
                    }
                }
            } else if (!this.up || this.pelagicScoring.recordBossPartDestroyed(target.id)) {
                this.score += 1500;
                this.kills++;
                if (this.up) this.emit('bonus', x, y, 1500, 'TORRETA');
            }
            if (rareKill && !this.rareRewardClaimed) {
                this.rareRewardClaimed = true;
                this.score += PELAGIC_RARE_BONUS;
                if (this.up) { this.pelagicScoring.recordSpecialBonus(PELAGIC_RARE_BONUS); this.emit('bonus', x, y, PELAGIC_RARE_BONUS, 'SONDA RARA'); }
                this.emit('radio', 0, 0, 1, `SONDA RARA ABATIDA!\nBÔNUS +${PELAGIC_RARE_BONUS}!`);
            } else if (
                'specialEvent' in target && target.specialEvent === 'naval-convoy' &&
                (target.eventRole === 'convoy-lead' || target.eventRole === 'convoy-escort') &&
                !this.convoyBonusClaimed &&
                !this.enemies.some(o => o.hp > 0 && o.specialEvent === 'naval-convoy' && (o.eventRole === 'convoy-lead' || o.eventRole === 'convoy-escort'))
            ) {
                this.convoyBonusClaimed = true;
                this.score += PELAGIC_CONVOY_CLEAR_BONUS;
                if (this.up) { this.pelagicScoring.recordSpecialBonus(PELAGIC_CONVOY_CLEAR_BONUS); this.emit('bonus', x, y, PELAGIC_CONVOY_CLEAR_BONUS, 'COMBOIO'); }
                this.emit('radio', 0, 0, 1, `COMBOIO DESMANTELADO!\nBÔNUS +${PELAGIC_CONVOY_CLEAR_BONUS}!`);
            }
        }
    }
    private damageSubModule(sub: SubmarineBossState, sec: SubSection, p: SubModule, amount: number, x: number, y: number, emitImpact = true): void {
        if (p.hp <= 0) return;
        p.hp = Math.max(0, p.hp - amount); p.flash = .095; if (this.boss) this.boss.flash = .06;
        if (emitImpact) this.emit('impact', x, y, .32);
        if (p.hp === 0) {
            p.warning = 0;
            this.emit('explosion', p.x, p.y, p.kind === 'bridge' ? 2.1 : p.kind === 'reactor' ? 1.8 : 1.35);
            if (this.pelagicScoring.recordSubModuleDestroyed(p.id)) {
                const modScore = p.kind === 'bridge' ? 2500 : p.kind === 'reactor' ? 2000 : 1200;
                this.score += modScore;
                this.kills++;
                this.emit('bonus', p.x, p.y, modScore, SUB_MODULE_LABELS[p.kind]);
            }
            sec.marks.push({ dx: p.dx, dy: p.dy, size: p.kind === 'bridge' ? 1.2 : 0.9, seed: (p.id * 37) % 100 });
            if (p.kind === 'bridge' && !sub.bridgeDestroyed) { sub.bridgeDestroyed = true; this.emit('radio', 0, 0, 1, 'TORRE DE COMANDO DESTRUÍDA!\nO SUBMARINO ACELERA EM EMERGÊNCIA!'); }
        }
    }
    private damageSubHull(sub: SubmarineBossState, sec: SubSection, amount: number, x: number, y: number, emitImpact = true): void {
        if (sec.hullHp <= 0 || !this.boss) return;
        const prevRatio = sec.hullHp / sec.hullMaxHp;
        sec.hullHp = Math.max(0, sec.hullHp - amount); sec.hullFlash = .095; this.boss.flash = .095;
        if (emitImpact) this.emit('impact', x, y, .3);
        const nextRatio = sec.hullHp / sec.hullMaxHp;
        const secY = subSectionCenterY(sub, sec.index);
        const markX = clamp(x - this.boss.x, -78, 78), markY = clamp(y - secY, -88, 88);
        if ((prevRatio > .66 && nextRatio <= .66) || (prevRatio > .33 && nextRatio <= .33)) {
            sec.marks.push({ dx: markX, dy: markY, size: .72, seed: Math.abs(Math.round(x * 13 + y * 7)) % 100 });
            this.emit('explosion', x, y, .7);
        }
        if (sec.hullHp === 0) {
            sec.marks.push({ dx: markX, dy: markY, size: 1.1, seed: (sec.index * 41 + 19) % 100 });
            this.emit('explosion', this.boss.x + markX * .5, secY + markY * .5, 1.6);
            if (this.pelagicScoring.recordSubHullDestroyed(sec.index)) {
                this.score += 650;
                this.emit('bonus', this.boss.x + markX * .5, secY + markY * .5, 650, `CASCO S${sec.index + 1}`);
            }
        }
    }
    private updateWrecks(dt: number): void {
        for (const wreck of this.wrecks) { wreck.age += dt; wreck.y = wreck.worldY + this.scroll; }
        // Smoke has headroom above its base; recycle only once the entire remnant has passed the bottom.
        this.wrecks = this.wrecks.filter(wreck => wreck.y - wreck.size * 2 < this.arena.bottom + 24);
    }
    /** Every hull point belongs to one of three physical weapon sectors. */
    private damageBossAt(x: number, y: number, amount: number): void {
        const boss = this.boss; if (!boss || boss.phase !== 'fight') return;
        const sector = (dx: number) => dx < -boss.size * .065 ? -1 : dx > boss.size * .065 ? 1 : 0;
        const hitSector = sector(x - boss.x), local = boss.parts.filter(p => sector(p.dx) === hitSector && p.hp > 0);
        boss.flash = .095;
        if (local.length) { const target = local.sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0]; this.damage(target, amount, x, y); }
        else {
            const remaining = boss.parts.filter(p => p.hp > 0); if (!remaining.length) return;
            const reduced = amount * .25 / remaining.length;
            for (const target of remaining) this.damage(target, reduced, x, y);
        }
    }
    private applySpecial(dt: number): void {
        const bomb = this.bomb; if (!bomb) return;
        const durScale = this.specialDurationScale !== 1 ? clamp(this.specialDurationScale, 0.3, 2.5) : 1;
        const flightEnd = 0.65 * durScale;
        const totalDur = 2.75 * durScale;
        const before = bomb.age; bomb.age += dt;
        if (bomb.phase === 'flight') {
            const travel = Math.min(dt, Math.max(0, flightEnd - before)) * (280 / durScale);
            if (this.up) bomb.y = Math.max(this.arena.top + 65, bomb.y - travel); else bomb.x = Math.min(this.arena.right - 65, bomb.x + travel);
            if (bomb.age >= flightEnd) { bomb.phase = 'blast'; this.emit('explosion', bomb.x, bomb.y, 3, 'special-blast'); }
        }
        if (bomb.phase === 'blast') {
            const start = Math.max(flightEnd, before), end = Math.min(totalDur, bomb.age), blastDt = Math.max(0, end - start) / durScale;
            const age = Math.min(2.1 * durScale, bomb.age - flightEnd);
            bomb.radius = (this.up ? 155 : 180) * Math.min(1, age / (0.35 * durScale)); this.specialImpact = { x: bomb.x, y: bomb.y };
            for (const target of this.enemies) {
                if (target.hp <= 0 || (target.submarine && target.submarine.exposure < .6)) continue;
                const d = Math.hypot(target.x - bomb.x, target.y - bomb.y);
                if (d < bomb.radius + target.size * .3) this.damage(target, 90 * blastDt, target.x, target.y, false);
            }
            if (this.boss?.sub) {
                const sub = this.boss.sub;
                if (sub.phase === 'fight') {
                    const sec = sub.sections[sub.activeSection], secY = subSectionCenterY(sub, sec.index);
                    const rec = sub.bombDamage[bomb.id] ??= { total: 0, hull: 0, parts: {} };
                    let remSec = Math.max(0, SUB_MAX_BOMB_SECTION_DAMAGE - rec.total), bossHit = false;
                    for (const target of sec.parts) {
                        if (remSec <= 0) break;
                        if (target.hp > 0 && Math.hypot(target.x - bomb.x, target.y - bomb.y) < bomb.radius + target.radius) {
                            const done = rec.parts[target.id] ?? 0, partRem = Math.min(remSec, Math.max(0, SUB_MAX_BOMB_PART_DAMAGE - done));
                            const amt = Math.min(partRem, 90 * blastDt, target.hp);
                            if (amt > 0) { rec.parts[target.id] = done + amt; rec.total += amt; remSec -= amt; this.damageSubModule(sub, sec, target, amt, target.x, target.y, false); bossHit = true; }
                        }
                    }
                    if (remSec > 0 && sec.hullHp > 0 && Math.abs(bomb.x - this.boss.x) < bomb.radius + SUB_BEAM_HALF_W && Math.abs(bomb.y - secY) < bomb.radius + SUB_SECTION_HEIGHT * .45) {
                        const hullRem = Math.min(remSec, Math.max(0, SUB_MAX_BOMB_HULL_DAMAGE - rec.hull));
                        const amt = Math.min(hullRem, 90 * blastDt, sec.hullHp);
                        if (amt > 0) { rec.hull += amt; rec.total += amt; remSec -= amt; this.damageSubHull(sub, sec, amt, clamp(bomb.x, this.boss.x - 60, this.boss.x + 60), secY, false); bossHit = true; }
                    }
                    if (bossHit) this.boss.flash = .095;
                }
            } else if (this.boss?.phase === 'fight') {
                let bossHit = false;
                for (const target of this.boss.parts) {
                    if (target.hp > 0 && Math.hypot(target.x - bomb.x, target.y - bomb.y) < bomb.radius + target.radius) { this.damage(target, 90 * blastDt, target.x, target.y, false); bossHit = true; }
                }
                if (bossHit) this.boss.flash = .095;
            }
            for (const shot of this.bullets) if (shot.active && shot.enemy && Math.hypot(shot.x - bomb.x, shot.y - bomb.y) < bomb.radius) shot.active = false;
        }
        if (bomb.age >= totalDur) { this.bomb = undefined; this.specialTime = 0; this.specialImpact = undefined; }
        else this.specialTime = Math.max(0, totalDur - bomb.age);
    }
    private hurtPlayer(): void {
        if (this.devInvincible || this.player.invulnerable > 0 || this.specialTime > 0 || this.state !== 'play') return;
        this.lives--; this.deaths++; this.emit('death'); this.emit('explosion', this.player.x, this.player.y, 1.2);
        if (this.up) {
            this.pelagicScoring.onPlayerDeath();
            if (this.tideArch.isActive) this.tideArch.hadDamageDuringArch = true;
        }
        const safeRespawnX = this.up
            ? (this.tideArch.isActive
                ? clamp(this.arenaCenterX, computeArchOpening(this.arena.left, this.arena.right).left + 32, computeArchOpening(this.arena.left, this.arena.right).right - 32)
                : this.arenaCenterX)
            : 80;
        const safeRespawnY = this.playerHomeY;
        const assist = this.isAssisted;
        if (!assist) {
            if (this.weapons.weaponLevel > 1 || this.weapons.powerMeter > 0) this.cargo.push({ id: ++this.sequence, x: this.player.x, y: this.player.y - 20, vx: 55, vy: -35, kind: 'power', crate: false, hp: 1, age: 0 });
            this.weapons.weaponLevel = 1; this.weapons.powerMeter = 0; this.specialTime = 0; this.bomb = undefined; this.burst.reset(this.up); this.player.invulnerable = 3;
            if (this.lives <= 0) { this.state = 'defeat'; this.emit('defeat'); return; }
            this.player.x = safeRespawnX; this.player.y = safeRespawnY;
            for (const b of this.bullets) if (b.enemy && Math.hypot(b.x - this.player.x, b.y - this.player.y) < 75) b.active = false;
            return;
        }
        const recovery = computeAssistedDeathRecovery(this.weapons.weaponLevel, this.weapons.powerMeter);
        this.weapons.weaponLevel = recovery.nextLevel; this.weapons.powerMeter = recovery.nextMeter;
        this.specialTime = 0; this.bomb = undefined; this.burst.reset(this.up); this.player.invulnerable = ASSISTED_RESPAWN_INVULNERABLE;
        if (this.lives <= 0) { this.state = 'defeat'; this.emit('defeat'); return; }
        if (recovery.dropP > 0) {
            // Keep at most one death-dropped recovery capsule active at once to prevent stacking on consecutive deaths.
            this.cargo = this.cargo.filter(c => c.crate || c.kind !== 'power' || !c.recoveryP);
            this.cargo.push({
                id: ++this.sequence,
                x: clamp(this.player.x, this.arena.left + 44, this.arena.right - 44),
                y: clamp(this.player.y - 26, 130, safeRespawnY - 60),
                vx: this.player.x > this.arenaCenterX ? -22 : 22,
                vy: -12,
                kind: 'power',
                crate: false,
                hp: 1,
                age: 0,
                recoveryP: recovery.dropP,
            });
            if (!this.assistedDeathHinted) {
                this.assistedDeathHinted = true;
                this.emit('comms', 0, 0, 1, 'assist-drop');
            }
        }
        this.player.x = safeRespawnX; this.player.y = safeRespawnY;
        for (const b of this.bullets) if (b.enemy && Math.hypot(b.x - this.player.x, b.y - this.player.y) < ASSISTED_RESPAWN_BULLET_CLEAR_RADIUS) b.active = false;
        for (const e of this.enemies) if (!e.ground && e.y > safeRespawnY - 125) e.cooldown = Math.max(e.cooldown, ASSISTED_LOWER_LANE_ENEMY_COOLDOWN);
    }
    private updateCargo(dt: number): void {
        for (const c of this.cargo) {
            c.age += dt; c.x += c.vx * dt; c.y += c.vy * dt;
            if (!c.crate) {
                if (c.x < this.arena.left + 12 || c.x > this.arena.right - 12) { c.vx *= -1; c.x = clamp(c.x, this.arena.left + 12, this.arena.right - 12); } if (c.y < this.arena.top + 18 || c.y > this.arena.bottom - 12) { c.vy *= -1; c.y = clamp(c.y, this.arena.top + 18, this.arena.bottom - 12); }
                if (Math.hypot(c.x - this.player.x, c.y - this.player.y) < 22) {
                    const prevWeaponLevel = this.weapons.weaponLevel;
                    if (c.kind === 'power') {
                        if (c.recoveryP && c.recoveryP > 0) {
                            const rec = applyRecoveryPower(this.weapons, c.recoveryP);
                            this.weapons = rec.state;
                            this.score += Math.max(100, rec.appliedSteps * 100);
                            this.player.invulnerable = Math.max(this.player.invulnerable, 0.9);
                            for (const eb of this.bullets) if (eb.enemy && Math.hypot(eb.x - this.player.x, eb.y - this.player.y) < 55) eb.active = false;
                            if (this.up) this.emit('comms', c.x, c.y, 1, 'pickup:recovery');
                        } else {
                            const result = collectPowerItem(this.weapons);
                            this.weapons = result.state;
                            this.score += result.meterIncreased ? 100 : 5000;
                            if (this.up && prevWeaponLevel < 5 && this.weapons.weaponLevel === 5) this.emit('comms', c.x, c.y, 1, 'pickup:full');
                        }
                    } else if (c.kind === 'life') { this.score += this.lives === 5 ? 5000 : 250; this.lives = Math.min(5, this.lives + 1); if (this.up) this.emit('comms', c.x, c.y, 1, 'pickup:life'); }
                    else { this.score += this.weapons.specialCharges === 5 ? 5000 : 250; this.weapons.specialCharges = Math.min(5, this.weapons.specialCharges + 1); if (this.up) this.emit('comms', c.x, c.y, 1, 'pickup:special'); }
                    c.age = 100; this.collected++; this.emit('pickup', c.x, c.y, 1, c.kind);
                }
            } else if (this.up && (c.x < this.arena.left + 20 || c.x > this.arena.right - 20)) c.vx *= -1;
        } this.cargo = this.cargo.filter(c => c.age < (c.crate ? 23 : 24) && c.y < this.arena.bottom + 45 && c.x > this.arena.left - 60);
    }
    private startBoss(mini: boolean): void {
        if (mini && this.up) return;
        this.stageDirector.setStatus(mini ? `stage-${this.mission.id}-miniboss` : `stage-${this.mission.id}-boss`, 'active', this.route);
        if (this.up) this.pelagicScoring.onBossStart(mini);
        if (!mini && this.up) {
            const sub = createSubmarineBoss(() => ++this.sequence, this.arenaCenterX);
            const boss: Boss = { mini: false, x: this.arenaCenterX, y: subSectionCenterY(sub, 0), size: SUB_HULL_DISPLAY_W, age: 0, phase: 'enter', configuration: 1, timer: 0, attack: 0, attackTime: 0, volley: 0, aimX: this.arenaCenterX, aimY: this.playerHomeY, parts: sub.sections[0].parts, sub };
            this.boss = boss; this.emit('boss', 0, 0, 1, SUB_BOSS_NAME); this.emit('radio', 0, 0, 1, sub.sections[0].radio);
            return;
        }
        const boss: Boss = { mini, x: this.up ? this.arenaCenterX : 820, y: this.up ? -140 : 215, size: mini ? (this.up ? 132 : 175) : (this.up ? 216 : 310), age: 0, phase: 'enter', configuration: 1, timer: 0, attack: 0, attackTime: 0, volley: 0, aimX: this.arenaCenterX, aimY: this.playerHomeY, parts: [] };
        this.boss = boss; this.installParts(boss, 3); this.emit(mini ? 'mini' : 'boss', 0, 0, 1, mini ? 'PATRULHA PESADA' : this.mission.boss);
    }
    private installParts(b: Boss, count: number): void {
        // Sockets are registered to the painted atlas, not distributed over an arbitrary circle.
        const mounts = this.up ? (count === 6 ? [[-.143, .015], [0, .015], [.143, .015], [-.143, .17], [0, .17], [.143, .17]] : b.mini ? [[-.19, 0], [.19, 0], [0, .135]] : [[-.17, .07], [.17, .07], [0, .14]]) : [[-.24, .23], [-.04, .23], [.16, .23]];
        b.parts = mounts.map(([mx, my]) => { const dx = mx * b.size, dy = my * b.size, hp = b.mini ? 95 : this.up ? (b.configuration === 1 ? 200 : 90) : 200; return { id: ++this.sequence, x: b.x + dx, y: b.y + dy, dx, dy, hp, maxHp: hp, radius: b.mini ? 10 : 13, flash: 0, warning: 0, angle: this.up ? Math.PI / 2 : Math.PI }; });
    }
    private updateBoss(dt: number): void {
        const b = this.boss; if (!b) return;
        if (b.sub) { this.updateSubmarineBoss(b, b.sub, dt); return; }
        b.age += dt; b.timer += dt; b.flash = Math.max(0, (b.flash ?? 0) - dt);
        if (b.phase === 'enter' || b.phase === 'return') {
            const t = clamp(b.timer / 2.5, 0, 1), ease = 1 - (1 - t) ** 3;
            if (this.up) { b.x = this.arenaCenterX; b.y = -170 + ease * (b.mini ? 300 : b.configuration === 1 ? 336 : 350); } else { b.x = 830 - ease * 250; b.y = 215; }
            if (t >= 1) { b.phase = 'fight'; b.timer = 0; }
        } else if (b.phase === 'retreat') {
            if (this.up) b.y -= 85 * dt; else b.x += 85 * dt;
            if (b.timer > 2.8) { b.phase = 'absent'; b.timer = 0; this.emit('radio', 0, 0, 1, 'Ei... aquilo está voltando por baixo!'); }
        } else if (b.phase === 'absent') {
            if (b.timer >= 5) { b.configuration = 2; b.size = this.up ? 236 : 324; b.phase = 'return'; b.timer = 0; this.installParts(b, 6); this.emit('return'); }
        } else if (b.phase === 'sink') {
            if (b.timer < .42 && Math.floor(b.timer * 10) !== Math.floor((b.timer - dt) * 10)) this.emit('explosion', b.x + Math.sin(b.timer * 31) * b.size * .3, b.y + Math.cos(b.timer * 23) * b.size * .25, b.mini ? 1.2 : 1.6);
            if (b.timer > .75) { const mini = b.mini; this.boss = undefined; this.clearHostileBullets(); this.stageDirector.setStatus(mini ? `stage-${this.mission.id}-miniboss` : `stage-${this.mission.id}-boss`, 'completed', this.route); if (!mini) { this.state = 'exit'; this.exitTime = 0; this.specialTime = 0; this.bomb = undefined; this.cargo = []; this.enemies = []; this.obstacles = []; for (const shot of this.bullets) shot.active = false; this.score += 10000 + this.lives * 1000; this.emit('victory'); } else { if (this.up) { const perf = this.pelagicScoring.completeBoss(true, this.effectiveHard); const totalMini = PELAGIC_MINI_BASE_CLEAR + perf.bonus; this.score += totalMini; this.emit('bonus', this.arenaCenterX, 150, totalMini, perf.noDeath ? 'PATRULHA INTACTA' : 'PATRULHA VENCIDA'); } else { this.score += 3000; } this.emit('radio', 0, 0, 1, this.up ? 'A pista está livre. Próxima parada: a fenda!' : 'Patrulha vencida! Vamos ao distrito das cores!'); } } return;
        } else {
            if (this.up && b.mini) this.pelagicScoring.tickBoss(true, dt);
            if (this.up) b.x = this.arenaCenterX + Math.sin(b.age * .65) * 14; else b.y = 210 + Math.sin(b.age * .65) * 65;
            const alive = b.parts.filter(p => p.hp > 0);
            if (!alive.length) { if (!b.mini && this.up && b.configuration === 1) { b.phase = 'retreat'; b.timer = 0; this.clearHostileBullets(); this.emit('explosion', b.x, b.y, 2); } else { b.phase = 'sink'; b.timer = 0; this.clearHostileBullets(); this.emit('explosion', b.x, b.y, b.mini ? 2.5 : 3.3); for (const a of [.55, 2.15, 3.7, 5.25]) { const r = b.size * .34; this.emit('explosion', b.x + Math.cos(a) * r, b.y + Math.sin(a) * r * .75, b.mini ? 1.5 : 2); } } return; }
            b.attackTime += dt; const warning = b.attack % 4 === 3 ? 1.35 : .8, shootEnd = warning + (b.attack % 4 === 2 ? 1.2 : .65), cycle = shootEnd + (b.mini ? 1.2 : 1.05);
            if (b.attackTime < warning) { for (const [i, p] of alive.entries()) { const active = b.attack % 4 === 3 ? i === b.attack % alive.length : alive.length <= 2 || i % 2 === b.attack % 2; p.warning = active ? b.attackTime / warning : 0; } b.aimX = this.player.x; b.aimY = this.player.y; }
            else if (b.attackTime < shootEnd) { const volley = Math.floor((b.attackTime - warning) / .3); if (volley >= b.volley) { b.volley = volley + 1; this.bossVolley(b, alive, volley); } for (const p of alive) p.warning = 0; }
            if (b.attackTime >= cycle) { b.attack++; b.attackTime = 0; b.volley = 0; }
        }
        for (const p of b.parts) { p.x = b.x + p.dx; p.y = b.y + p.dy; p.flash = Math.max(0, p.flash - dt); p.angle = b.attack % 4 === 0 ? (this.up ? Math.PI / 2 : Math.PI) : Math.atan2(b.aimY - p.y, b.aimX - p.x); }
    }
    private bossVolley(b: Boss, parts: Component[], volley: number): void {
        const forward = this.up ? Math.PI / 2 : Math.PI, pattern = b.attack % 4;
        parts.forEach((p, i) => {
            if (i % 2 !== b.attack % 2 && parts.length > 2 && pattern !== 3) return;
            const aim = Math.atan2(b.aimY - p.y, b.aimX - p.x), mx = p.x + Math.cos(pattern === 0 ? forward : aim) * p.radius * 1.1, my = p.y + Math.sin(pattern === 0 ? forward : aim) * p.radius * 1.1;
            if (!this.up) {
                // Giro builds moving horizontal lanes; Pula-Onda owns the radial naval pattern below.
                if (pattern === 0) for (const a of [-.32, 0, .32]) this.hostile(mx, my, forward + a + (volley - 1) * .08, 102 + (this.effectiveHard ? 20 : 0), 3.1);
                else if (pattern === 1) for (const a of [-.13, .13]) this.hostile(mx, my, aim + a, 145 + volley * 12, 2.7);
                else if (pattern === 2) for (const a of [-.09, .09]) this.hostile(mx, my, aim + Math.sin(volley * 1.7) * .24 + a, 170, 2.4);
                else if (i === b.attack % parts.length) for (const a of [-.28, 0, .28]) this.hostile(mx, my, aim + a, 88 + volley * 8, 7.5);
                return;
            }
            if (pattern === 0) { for (const a of [-.48, -.24, 0, .24, .48]) this.hostile(mx, my, forward + a, 125 + (this.effectiveHard ? 20 : 0), 3.1); }
            else if (pattern === 1) { for (const a of [-.10, .10]) this.hostile(mx, my, aim + a, 155 + (this.effectiveHard ? 25 : 0), 2.7); }
            else if (pattern === 2) this.hostile(mx, my, aim + (volley - 1) * .16, 180, 2.4);
            else if (i === b.attack % parts.length) { for (let j = 0; j < 12; j++)this.hostile(mx, my, TAU * j / 12 + volley * .14, 105, 7.4); }
        }); this.emit('enemy-shot', b.x, b.y);
    }
    private updateSubmarineBoss(b: Boss, sub: SubmarineBossState, dt: number): void {
        b.age += dt; b.timer += dt; sub.age += dt; sub.timer += dt;
        b.flash = Math.max(0, (b.flash ?? 0) - dt);
        for (const sec of sub.sections) {
            sec.hullFlash = Math.max(0, sec.hullFlash - dt);
            for (const p of sec.parts) {
                p.flash = Math.max(0, p.flash - dt);
                p.recoil = Math.max(0, p.recoil - dt * 4.5);
                if (sub.phase !== 'fight' || sec.index !== sub.activeSection || p.hp <= 0) p.warning = Math.max(0, p.warning - dt * 3);
            }
        }
        b.x = this.arenaCenterX + Math.sin(sub.age * .48) * 10;
        b.aimX = this.player.x; b.aimY = this.player.y;
        if (sub.phase === 'enter') {
            b.phase = 'enter';
            const t = clamp(sub.timer / 2.4, 0, 1), ease = 1 - (1 - t) ** 3;
            sub.anchorY = -160 + ease * (SUB_ANCHOR_Y + 160);
            if (t >= 1) { sub.phase = 'fight'; b.phase = 'fight'; sub.timer = 0; b.timer = 0; }
        } else if (sub.phase === 'transition') {
            this.pelagicScoring.tickBoss(false, dt);
            b.phase = 'return';
            sub.subScroll = Math.min(sub.targetScroll, sub.subScroll + 175 * dt);
            this.scroll += 110 * dt;
            if (sub.subScroll >= sub.targetScroll - .5) {
                sub.subScroll = sub.targetScroll;
                sub.phase = 'fight'; b.phase = 'fight'; sub.timer = 0; b.timer = 0;
                const nextSecParts = sub.sections[sub.activeSection].parts;
                b.parts = nextSecParts;
                for (const p of nextSecParts) if (p.hp > 0) p.cooldown = Math.min(p.cooldown, .45);
            }
        } else if (sub.phase === 'collapse') {
            b.phase = 'sink';
            const prevSlot = Math.floor((sub.timer - dt) / .18), curSlot = Math.floor(sub.timer / .18);
            if (sub.timer < 3.1 && curSlot !== prevSlot) {
                const ex = b.x + Math.sin(curSlot * 2.3) * 74, ey = subSectionCenterY(sub, sub.activeSection) + Math.cos(curSlot * 1.7) * 82;
                this.emit('explosion', ex, ey, curSlot % 4 === 0 ? 2.1 : 1.35);
            }
            if (sub.timer - dt < 2.85 && sub.timer >= 2.85) this.emit('explosion', b.x, subSectionCenterY(sub, sub.activeSection), 3.5);
            if (sub.timer >= 3.6) {
                sub.phase = 'done';
                this.boss = undefined; this.clearHostileBullets();
                this.stageDirector.setStatus(`stage-${this.mission.id}-boss`, 'completed', this.route);
                this.state = 'exit'; this.exitTime = 0; this.specialTime = 0; this.bomb = undefined;
                this.cargo = []; this.enemies = []; this.obstacles = [];
                for (const shot of this.bullets) shot.active = false;
                const perf = this.pelagicScoring.completeBoss(false, this.effectiveHard);
                const clearBonus = PELAGIC_BOSS_BASE_CLEAR + this.lives * 1000 + perf.bonus;
                this.score += clearBonus;
                this.emit('bonus', this.arenaCenterX, 155, clearBonus, perf.noDeath ? 'COLOSSO PERFEITO' : 'COLOSSO ABATIDO');
                this.emit('victory');
                return;
            }
        } else if (sub.phase === 'fight') {
            this.pelagicScoring.tickBoss(false, dt);
            b.phase = 'fight';
            const sec = sub.sections[sub.activeSection];
            b.parts = sec.parts;
            if (subActiveSectionComplete(sec)) {
                sec.completed = true; this.clearHostileBullets();
                const secY = subSectionCenterY(sub, sec.index);
                this.emit('explosion', b.x - 38, secY + 18, 1.85);
                this.emit('explosion', b.x + 38, secY - 20, 1.85);
                this.score += 1800;
                this.emit('bonus', b.x, secY, 1800, `SEÇÃO ${sec.index + 1}/5`);
                if (sub.activeSection < sub.sections.length - 1) {
                    sub.activeSection++;
                    sub.targetScroll = sub.activeSection * SUB_SECTION_HEIGHT;
                    sub.phase = 'transition'; b.phase = 'return'; sub.timer = 0; b.timer = 0;
                    this.emit('radio', 0, 0, 1, sub.sections[sub.activeSection].radio);
                    return;
                } else {
                    sub.phase = 'collapse'; b.phase = 'sink'; sub.timer = 0; b.timer = 0;
                    this.emit('explosion', b.x, secY, 3.1);
                    this.emit('radio', 0, 0, 1, 'REATOR CRÍTICO! O COLOSSO ABISSAL ESTÁ PARTINDO!');
                    return;
                }
            }
            const pace = (sub.bridgeDestroyed ? 1.18 : 1) * (this.effectiveHard ? 1.15 : 1);
            for (const p of sec.parts) {
                if (p.hp <= 0) { p.warning = 0; continue; }
                p.cooldown -= dt * pace;
                p.warning = p.cooldown > 0 && p.cooldown < .62 ? 1 - p.cooldown / .62 : 0;
                if (p.cooldown <= 0) {
                    p.warning = 0; p.recoil = 1;
                    this.fireSubModule(sub, sec, p);
                    p.cooldown = this.subModuleCooldown(sec.index, p.kind);
                }
            }
        }
        syncSubmarinePositions(sub, b.x, b.aimX, b.aimY);
        b.y = subSectionCenterY(sub, sub.activeSection);
    }
    private subModuleCooldown(secIdx: number, kind: SubModuleKind): number {
        const s = Math.max(.76, 1 - secIdx * .05);
        switch (kind) {
            case 'turret': return 1.62 * s;
            case 'launcher': return 2.1 * s;
            case 'armor': return 2.38 * s;
            case 'bridge': return 2.25;
            case 'propeller': return 2.18;
            case 'reactor': return 2.4;
        }
    }
    private fireSubModule(sub: SubmarineBossState, sec: SubSection, p: SubModule): void {
        if (p.hp <= 0) return;
        const aim = Math.atan2(this.player.y - p.y, this.player.x - p.x);
        const muzzle = p.radius * .95;
        const mx = p.x + Math.cos(aim) * muzzle, my = p.y + Math.sin(aim) * muzzle;
        const hardBoost = this.effectiveHard ? 18 : 0;
        switch (p.kind) {
            case 'turret': {
                const spd = 142 + sec.index * 7 + hardBoost;
                const offsets = this.effectiveHard || (sec.index >= 3 && Math.abs(p.dx) < 8) ? [-.22, 0, .22] : [-.12, .12];
                for (const a of offsets) this.hostile(mx, my, aim + a, spd, 2.8, 1);
                break;
            }
            case 'launcher': {
                const spd = 118 + hardBoost;
                const fan = this.effectiveHard ? [-.62, -.36, -.12, .12, .36, .62] : [-.50, -.24, 0, .24, .50];
                for (const a of fan) this.hostile(p.x, p.y + 10, Math.PI / 2 + a, spd, 3.1, 1);
                break;
            }
            case 'armor': {
                const spd = 110 + hardBoost;
                const angles = this.effectiveHard ? [.88, 1.18, 1.45, 1.69, 1.96, 2.26] : [1.0, 1.28, 1.57, 1.86, 2.14];
                for (const a of angles) this.hostile(p.x, p.y + 12, a, spd, 3.4, 2);
                break;
            }
            case 'bridge': {
                const spd = 124 + hardBoost;
                const count = this.effectiveHard ? 8 : 6;
                const phase = Math.sin(sub.age * 1.9) * .18;
                for (let i = 0; i < count; i++) {
                    const a = Math.PI / 2 + (i / (count - 1) - .5) * 1.42 + phase;
                    this.hostile(p.x, p.y + 16, a, spd, 3.1, 2);
                }
                break;
            }
            case 'propeller': {
                const spd = 102 + hardBoost;
                const offsets = this.effectiveHard ? [-.48, -.24, 0, .24, .48] : [-.36, 0, .36];
                for (const a of offsets) this.hostile(p.x, p.y + 12, Math.PI / 2 + a, spd, 3.8, 2);
                break;
            }
            case 'reactor': {
                const spd = 100 + hardBoost;
                const n = this.effectiveHard ? 12 : 10;
                const spin = sub.age * .55;
                for (let j = 0; j < n; j++)this.hostile(p.x, p.y, TAU * j / n + spin, spd, 3.4, 2);
                break;
            }
        }
        this.emit('enemy-shot', p.kind === 'turret' ? mx : p.x, p.kind === 'turret' ? my : p.y);
        this.stepEnemyShots++;
    }
    private spawnObstacle(): void {
        const bottom = Math.floor(this.nextObstacle) % 2 === 0, h = this.nextObstacle < 140 ? 106 : 85;
        this.obstacles.push({ id: ++this.sequence, x: 820, y: bottom ? 414 - h / 2 : 40 + h / 2, width: 80, height: h, kind: bottom ? 'roof' : 'gate', warning: 1.5, hp: Infinity, age: 0 });
        if (this.nextObstacle > 108 && this.nextObstacle < 135) this.obstacles.push({ id: ++this.sequence, x: 900, y: bottom ? 72 : 372, width: 140, height: 64, kind: bottom ? 'gate' : 'roof', warning: 1.5, hp: Infinity, age: 0 });
        if (this.nextObstacle > 200) this.obstacles.push({ id: ++this.sequence, x: 940, y: 220, width: 32, height: 58, kind: 'barrier', warning: 1.5, hp: 8, age: 0 });
    }
    private updateObstacles(dt: number): void { for (const o of this.obstacles) { o.age += dt; o.warning = Math.max(0, o.warning - dt); o.x -= 42 * dt; if (o.kind === 'gate') o.y = 70 + Math.sin(o.age * .7) * 16; if (o.warning <= 0 && o.hp > 0 && Math.abs(this.player.x - o.x) < o.width / 2 + 5 && Math.abs(this.player.y - o.y) < o.height / 2 + 6) this.hurtPlayer(); } this.obstacles = this.obstacles.filter(o => o.x > -80 && o.hp > 0); }
    private clearHostileBullets(): void { for (const b of this.bullets) if (b.enemy) b.active = false; }

    /** Clears all active entities/projectiles cleanly without altering campaign saves. */
    clearArenaEntities(): void {
        this.enemies = [];
        this.cargo = [];
        this.obstacles = [];
        this.wrecks = [];
        this.boss = undefined;
        this.bomb = undefined;
        this.specialTime = 0;
        this.specialImpact = undefined;
        this.clearBullets();
    }

    clearBullets(): void {
        for (const b of this.bullets) b.active = false;
    }

    /** Jumps safely to a deterministic checkpoint time in the current mission without leaving stale entities. */
    devJumpToCheckpoint(
        targetSeconds: number,
        opts?: { pauseDirector?: boolean; isolated?: boolean; seed?: number },
    ): void {
        const t = clamp(targetSeconds, 0, 300);
        this.clearArenaEntities();
        this.events.length = 0;
        this.introTime = 0;
        this.state = 'play';
        this.elapsed = t;
        this.route = t;
        this.region = regionAt(t);
        if (opts?.seed !== undefined) this.setSeed(opts.seed);
        let scrollPos = 0;
        if (this.up) {
            scrollPos = t * 38;
        } else {
            const express = Math.max(0, Math.min(t, 155) - 135);
            scrollPos = (t - express) * 38 + express * 85;
        }
        this.scroll = scrollPos;
        this.scrollSpeed = !this.up && this.region === 3 ? 85 : 38;
        this.player.x = this.up ? this.arenaCenterX : 100;
        this.player.y = this.playerHomeY;
        this.player.bank = 0;
        this.player.altitude = 1;
        this.player.invulnerable = 1.5;

        this.tideArch.reset();
        this.pacingDirector.reset();
        this.directorPaused = Boolean(opts?.pauseDirector);
        this.devSandboxIsolated = Boolean(opts?.isolated);
        this.devIsolatedEventId = undefined;
        this.checkpoint = undefined;
        this.rareSpawnCount = 0;
        this.rareRewardClaimed = false;
        this.convoyBonusClaimed = false;
        this.assistedDeathHinted = false;
        const scState = this.pelagicScoring.exportState();
        this.pelagicScoring.restoreState({ ...scState, currentSector: this.region, sectorHadDeath: false });

        this.waveIndex = this.mission.encounters.findIndex(e => e.at >= t);
        if (this.waveIndex < 0) this.waveIndex = this.mission.encounters.length;
        if (opts?.pauseDirector || opts?.isolated) this.waveIndex = this.mission.encounters.length;
        this.supplyIndex = SUPPLIES.findIndex(s => s.at >= t);
        if (this.supplyIndex < 0) this.supplyIndex = SUPPLIES.length;

        this.nextObstacle = 98;
        if (!this.up) {
            while (this.nextObstacle < t && this.nextObstacle < 270) {
                this.nextObstacle += this.nextObstacle < 135 ? 12 : 33;
            }
        }

        this.specialEventsTriggered.clear();
        if (this.up) {
            for (const spec of PELAGIC_TIMED_EVENTS) {
                if (spec.at < t) this.specialEventsTriggered.add(spec.id);
            }
            if (t > PELAGIC_RARE_EARLY_AT) this.rareSpawnCount = 1;
        }

        this.miniStarted = !this.up && t >= 155;
        this.bossStarted = t >= 300;
        this.stageDirector.syncAfterJump(t, this.region, {
            pauseDirector: this.directorPaused || this.devSandboxIsolated,
        });

        if (this.bossStarted) {
            this.startBoss(false);
        } else if (!this.up && t >= 155 && t < 185) {
            this.startBoss(true);
        } else if (this.up && t >= 148 && t < 185) {
            const stage: Exclude<TideArchPhase, 'idle'> = t < 153 ? 'approach' : t < 158 ? 'descent' : t < 171 ? 'low-flight' : t < 177 ? 'under-arch' : t < 181 ? 'ascent' : 'checkpoint';
            this.devJumpTideArch(stage, this.directorPaused, this.devSandboxIsolated);
        } else if (this.up) {
            if (t >= 185) this.tideArch.jumpTo('complete', this.scroll, this.playerHomeY);
            if (t <= 2) this.emit('comms', 0, 0, 1, 'start');
        }
    }

    /** Jumps deterministically to any Arco das Marés stage for DevTools and automated verification. */
    devJumpTideArch(stage: Exclude<TideArchPhase, 'idle'>, pauseDirector = false, isolated = false): void {
        if (!this.up) return;
        this.clearArenaEntities();
        this.events.length = 0;
        this.introTime = 0;
        this.state = 'play';
        this.directorPaused = pauseDirector;
        this.devSandboxIsolated = isolated;
        const routeMap: Record<Exclude<TideArchPhase, 'idle'>, number> = {
            approach: 148,
            descent: 153,
            'low-flight': 162,
            'under-arch': 173,
            ascent: 177,
            checkpoint: 181,
            complete: 192,
        };
        const t = routeMap[stage];
        this.elapsed = t;
        this.route = t;
        this.region = regionAt(t);
        this.scroll = t * 38;
        this.scrollSpeed = this.tideArch.targetScrollSpeed();
        this.player.x = this.arenaCenterX;
        this.player.y = this.playerHomeY;
        this.player.bank = 0;
        this.player.invulnerable = 1.5;
        this.waveIndex = (pauseDirector || isolated) ? this.mission.encounters.length : Math.max(0, this.mission.encounters.findIndex(e => e.at >= t));
        if (this.waveIndex < 0) this.waveIndex = this.mission.encounters.length;
        this.supplyIndex = Math.max(0, SUPPLIES.findIndex(s => s.at >= t));
        if (this.supplyIndex < 0) this.supplyIndex = SUPPLIES.length;
        this.miniStarted = false;
        this.bossStarted = false;
        const scState = this.pelagicScoring.exportState();
        this.pelagicScoring.restoreState({ ...scState, currentSector: this.region, sectorHadDeath: false });
        this.stageDirector.syncAfterJump(t, this.region, { pauseDirector: pauseDirector || isolated });
        this.stageDirector.markArchPhase(stage, t);

        const { cannons, boats } = this.tideArch.jumpTo(stage, this.scroll, this.playerHomeY);
        this.player.altitude = this.tideArch.altitude;
        for (const c of cannons) this.spawnArchCannon(c);
        for (const b of boats) this.spawnArchBoat(b);
        if (stage === 'checkpoint') this.activateTideArchCheckpoint();
        else this.emit('comms', 0, 0, 1, `arch:${stage}`);
    }

    /** Spawns any registered enemy formation immediately via real production spawnEncounter logic. */
    devSpawnEncounter(
        e: Omit<Mission['encounters'][number], 'at'>,
        overrides?: { x?: number; y?: number; keepExisting?: boolean },
    ): Actor[] {
        const prevLen = this.enemies.length;
        this.introTime = 0;
        this.state = 'play';
        if (!overrides?.keepExisting) this.enemies = [];
        this.spawnEncounter(e);
        const spawned = this.enemies.slice(overrides?.keepExisting ? prevLen : 0);
        if (overrides?.x !== undefined || overrides?.y !== undefined) {
            spawned.forEach((a, idx) => {
                if (overrides.x !== undefined) a.x = overrides.x + idx * 18;
                if (overrides.y !== undefined) {
                    a.y = overrides.y;
                    if (a.navigation) a.navigation.worldY = a.y - this.scroll;
                }
            });
        }
        return spawned;
    }

    /** Starts miniboss, standard boss, or a specific section of Colosso Abissal cleanly. */
    devStartBoss(mini: boolean, subSectionIndex?: number): void {
        this.clearArenaEntities();
        this.events.length = 0;
        this.introTime = 0;
        this.state = 'play';
        this.route = mini ? 155 : 300;
        this.elapsed = this.route;
        this.region = regionAt(this.route);
        this.waveIndex = this.mission.encounters.length;
        this.miniStarted = true;
        this.bossStarted = !mini;
        this.startBoss(mini);
        if (!mini && this.boss?.sub && typeof subSectionIndex === 'number') {
            const sub = this.boss.sub;
            const secIdx = clamp(Math.floor(subSectionIndex), 0, sub.sections.length - 1);
            sub.activeSection = secIdx;
            sub.subScroll = secIdx * SUB_SECTION_HEIGHT;
            sub.targetScroll = sub.subScroll;
            sub.anchorY = SUB_ANCHOR_Y;
            sub.phase = 'fight';
            sub.timer = 0;
            this.boss.phase = 'fight';
            this.boss.timer = 0;
            for (let i = 0; i < sub.sections.length; i++) {
                const sec = sub.sections[i];
                if (i < secIdx) {
                    sec.completed = true;
                    sec.hullHp = 0;
                    for (const p of sec.parts) p.hp = 0;
                } else {
                    sec.completed = false;
                    sec.hullHp = sec.hullMaxHp;
                    for (const p of sec.parts) { p.hp = p.maxHp; p.flash = 0; p.warning = 0; }
                }
            }
            this.boss.parts = sub.sections[secIdx].parts;
            syncSubmarinePositions(sub, this.boss.x, this.player.x, this.player.y);
            this.boss.y = subSectionCenterY(sub, secIdx);
            this.emit('radio', 0, 0, 1, sub.sections[secIdx].radio);
        }
    }

    /** Restores current boss hull & component HP without resetting stage settings. */
    devRestoreBossParts(): void {
        const b = this.boss;
        if (!b) return;
        if (b.sub) {
            const sub = b.sub;
            for (let i = sub.activeSection; i < sub.sections.length; i++) {
                const sec = sub.sections[i];
                sec.completed = false;
                sec.hullHp = sec.hullMaxHp;
                sec.marks = [];
                for (const p of sec.parts) { p.hp = p.maxHp; p.flash = 0; p.warning = 0; }
            }
            sub.bridgeDestroyed = sub.activeSection > 2 && sub.sections[2]?.parts.every(p => p.kind !== 'bridge' || p.hp <= 0);
            b.parts = sub.sections[sub.activeSection].parts;
            syncSubmarinePositions(sub, b.x, this.player.x, this.player.y);
            return;
        }
        for (const p of b.parts) { p.hp = p.maxHp; p.flash = 0; p.warning = 0; }
    }

    devTriggerControlledDeath(): void {
        const prevDev = this.devInvincible;
        this.devInvincible = false;
        this.player.invulnerable = 0;
        this.specialTime = 0;
        this.bomb = undefined;
        this.state = 'play';
        this.hurtPlayer();
        this.devInvincible = prevDev;
    }

    devTriggerBurst(): void {
        this.state = 'play';
        this.burst.reset(this.up);
        this.burst.step(1000 / 120, true, { accessibility: this.accessibility, allowHoldRepeat: !this.up });
        this.firePrimary();
    }

    devTriggerMissile(): void {
        this.state = 'play';
        this.missileTime = 0;
        this.fireMissiles();
    }

    devTriggerSpecial(): void {
        if (this.specialTime > 0) return;
        if (this.weapons.specialCharges <= 0) this.weapons.specialCharges = 1;
        this.weapons.specialCharges--;
        this.specialTime = 2.75;
        this.bomb = { id: ++this.sequence, x: this.player.x, y: this.player.y, age: 0, phase: 'flight', radius: 0 };
        this.emit('special');
    }

    devSpawnCargoItem(kind: Cargo['kind']): void {
        this.cargo.push({
            id: ++this.sequence,
            x: this.player.x,
            y: clamp(this.player.y - 36, this.arena.top + 18, this.arena.bottom - 24),
            vx: 0,
            vy: 42,
            kind,
            crate: false,
            hp: 1,
            age: 0,
        });
    }

    devPacingReport(): PelagicPacingSnapshot {
        return this.pacingDirector.snapshot();
    }

    devStageDirectorSnapshot(): StageDirectorSnapshot {
        return this.stageDirector.snapshot(this.route, this.region);
    }

    devSensorSnapshot(): {
        tideArchPhase: TideArchPhase;
        archScreenY: number;
        bridgeBandActive: boolean;
        pierCollisionActive: boolean;
        opening: ReturnType<typeof computeArchOpening>;
        altitude: number;
        altitudeRestored: boolean;
        crossedArch: boolean;
        checkpointReached: boolean;
        airSpawnsBlocked: boolean;
        bossActive: boolean;
        subActiveSection: number | null;
    } {
        const opening = computeArchOpening(this.arena.left, this.arena.right);
        return {
            tideArchPhase: this.tideArch.phase,
            archScreenY: Number(this.tideArch.archScreenY(this.scroll).toFixed(1)),
            bridgeBandActive: this.up && this.tideArch.isInBridgeBand(this.scroll, this.player.y),
            pierCollisionActive: this.up && this.tideArch.isPillarCollisionActive(this.scroll, this.player.y),
            opening,
            altitude: Number(this.player.altitude.toFixed(2)),
            altitudeRestored: this.tideArch.altitudeRestored,
            crossedArch: this.tideArch.crossedArch,
            checkpointReached: this.tideArch.checkpointReached,
            airSpawnsBlocked: this.tideArch.airSpawnsBlocked,
            bossActive: Boolean(this.boss),
            subActiveSection: this.boss?.sub ? this.boss.sub.activeSection : null,
        };
    }

    devRunStageEvent(
        eventId: string,
        opts?: { action?: 'go-to' | 'before' | 'run'; isolated?: boolean; leadSeconds?: number; seed?: number },
    ): { ok: boolean; message: string; def?: StageEventDef } {
        const def = this.stageDirector.defs.find((d) => d.id === eventId);
        if (!def) return { ok: false, message: `Evento '${eventId}' não pertence à missão ${this.mission.name}.` };
        const action = opts?.action ?? 'run';
        const isolated = opts?.isolated ?? false;

        if (action === 'before') {
            const lead = opts?.leadSeconds ?? 4;
            const anchor = def.atSeconds !== undefined ? Math.max(0, def.atSeconds - lead) : def.preJumpSeconds;
            this.devJumpToCheckpoint(anchor, {
                pauseDirector: false,
                isolated,
                seed: opts?.seed,
            });
            if (isolated) this.devIsolatedEventId = def.id;
            if (def.payload.kind === 'arch-phase' && def.payload.phase !== 'approach') {
                const prevMap: Record<string, Exclude<TideArchPhase, 'idle'>> = {
                    descent: 'approach',
                    'low-flight': 'descent',
                    'under-arch': 'low-flight',
                    ascent: 'under-arch',
                    checkpoint: 'low-flight',
                };
                const prev = prevMap[def.payload.phase];
                if (prev) this.devJumpTideArch(prev, false, isolated);
                if (isolated) this.devIsolatedEventId = def.id;
            }
            if (def.payload.kind === 'special-event' && def.payload.eventId === 'rare-visitor') {
                this.deaths = 0;
                this.kills = Math.max(10, this.kills);
                this.rareSpawnCount = 0;
                this.specialEventsTriggered.delete('rare-visitor');
            }
            return {
                ok: true,
                def,
                message: `Inicializado antes de '${def.name}' (${isolated ? 'Isolado' : 'Integrado'}).`,
            };
        }

        if (action === 'go-to') {
            if (def.payload.kind === 'arch-phase') {
                this.devJumpTideArch(def.payload.phase, isolated, isolated);
                if (isolated) this.devIsolatedEventId = def.id;
                return { ok: true, def, message: `Saltou para '${def.name}'.` };
            }
            const t = def.atSeconds ?? def.preJumpSeconds;
            this.devJumpToCheckpoint(t, { pauseDirector: isolated, isolated, seed: opts?.seed });
            if (isolated) this.devIsolatedEventId = def.id;
            return { ok: true, def, message: `Saltou para ${t}s (${def.name}).` };
        }

        // action === 'run'
        switch (def.payload.kind) {
            case 'region': {
                this.devJumpToCheckpoint(def.payload.at, { pauseDirector: isolated, isolated, seed: opts?.seed });
                return { ok: true, def, message: `Setor '${def.name}' iniciado (${isolated ? 'Isolado' : 'Integrado'}).` };
            }
            case 'arch-phase': {
                this.devJumpTideArch(def.payload.phase, false, isolated);
                if (isolated) this.devIsolatedEventId = def.id;
                return { ok: true, def, message: `'${def.name}' em execução (${isolated ? 'Isolado' : 'Integrado'}).` };
            }
            case 'special-event': {
                const baseAt = def.atSeconds ?? 66;
                this.devJumpToCheckpoint(Math.max(4, baseAt - 0.5), { pauseDirector: isolated, isolated, seed: opts?.seed });
                if (isolated) this.devIsolatedEventId = def.id;
                if (def.payload.eventId === 'rare-visitor') {
                    this.deaths = 0;
                    this.kills = Math.max(10, this.kills);
                    this.rareSpawnCount = 0;
                }
                this.specialEventsTriggered.delete(def.payload.eventId);
                this.triggerSpecialEvent(def.payload.eventId, true);
                return { ok: true, def, message: `Evento '${def.name}' disparado (${isolated ? 'Isolado' : 'Integrado'}).` };
            }
            case 'supply': {
                this.devJumpToCheckpoint(def.payload.at, { pauseDirector: isolated, isolated, seed: opts?.seed });
                this.devSpawnCargoItem(def.payload.supplyKind);
                this.stageDirector.markSupplyTriggered(def.payload.supplyIndex, this.route);
                return { ok: true, def, message: `Suprimento '${def.payload.supplyKind.toUpperCase()}' lançado.` };
            }
            case 'encounter': {
                this.devJumpToCheckpoint(def.payload.encounter.at, { pauseDirector: isolated, isolated, seed: opts?.seed });
                if (isolated) this.devIsolatedEventId = def.id;
                this.stageDirector.markEncounterTriggered(def.payload.encounterIndex, this.route);
                this.devSpawnEncounter(def.payload.encounter, { keepExisting: false });
                return { ok: true, def, message: `'${def.name}' em execução (${isolated ? 'Isolado' : 'Integrado'}).` };
            }
            case 'miniboss': {
                this.devJumpToCheckpoint(155, { pauseDirector: isolated, isolated, seed: opts?.seed });
                this.devStartBoss(true);
                return { ok: true, def, message: `Miniboss iniciado (${isolated ? 'Isolado' : 'Integrado'}).` };
            }
            case 'boss': {
                this.devJumpToCheckpoint(300, { pauseDirector: isolated, isolated, seed: opts?.seed });
                this.devStartBoss(false);
                return { ok: true, def, message: `'${def.name}' iniciado (${isolated ? 'Isolado' : 'Integrado'}).` };
            }
        }
    }

    devDirectorSnapshot(): {
        route: number;
        region: number;
        waveIndex: number;
        totalEncounters: number;
        nextEncounterAt: number | null;
        triggeredEvents: PelagicSpecialEventId[];
        pacing: PelagicPacingSnapshot;
        stageDirector: StageDirectorSnapshot;
    } {
        return {
            route: Number(this.route.toFixed(2)),
            region: this.region,
            waveIndex: this.waveIndex,
            totalEncounters: this.mission.encounters.length,
            nextEncounterAt: this.waveIndex < this.mission.encounters.length ? this.mission.encounters[this.waveIndex].at : null,
            triggeredEvents: [...this.specialEventsTriggered],
            pacing: this.pacingDirector.snapshot(),
            stageDirector: this.stageDirector.snapshot(this.route, this.region),
        };
    }

    devJumpNextEncounter(): Encounter | null {
        if (this.waveIndex >= this.mission.encounters.length) return null;
        const enc = this.mission.encounters[this.waveIndex++];
        if (enc.at > this.route) {
            this.route = enc.at;
            this.elapsed = enc.at;
            this.region = regionAt(enc.at);
        }
        if (!this.up && enc.at === 155) { if (!this.miniStarted) { this.miniStarted = true; this.startBoss(true); } }
        else if (this.up && enc.at === 155) return enc;
        else this.spawnEncounter(enc);
        return enc;
    }
}

