import type { ArcadeScene } from '../game/arcade/ArcadeScene';
import type { StageEventStatus } from '../game/arcade/ArcadeStageDirector';
import type { TideArchPhase } from '../game/arcade/PelagicTideArch';

export type DevLogKind =
  | 'sensor-enter'
  | 'sensor-exit'
  | 'collision'
  | 'activation'
  | 'condition-fail'
  | 'completed'
  | 'error';

export interface DevLogEntry {
  readonly seq: number;
  readonly routeSeconds: number;
  readonly kind: DevLogKind;
  readonly source: string;
  readonly detail: string;
}

const MAX_LOG_ENTRIES = 120;

/**
 * Edge-triggered deduplicated logger observing sensors, triggers, collisions,
 * Stage Director transitions, and condition outcomes without emitting per-frame spam.
 */
export class DevEventLogger {
  private entries: DevLogEntry[] = [];
  private seq = 0;

  private lastMissionId?: number;
  private lastArchPhase?: TideArchPhase;
  private lastBridgeBand = false;
  private lastPierCollision = false;
  private lastCrossedArch = false;
  private lastCheckpoint = false;
  private lastLives?: number;
  private lastWeaponLevel?: number;
  private lastBossActive = false;
  private lastSubSection: number | null = null;
  private lastCollectedCount?: number;
  private lastStatuses = new Map<string, StageEventStatus>();

  getEntries(): readonly DevLogEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
  }

  resetBaselines(): void {
    this.lastMissionId = undefined;
    this.lastArchPhase = undefined;
    this.lastBridgeBand = false;
    this.lastPierCollision = false;
    this.lastCrossedArch = false;
    this.lastCheckpoint = false;
    this.lastLives = undefined;
    this.lastWeaponLevel = undefined;
    this.lastBossActive = false;
    this.lastSubSection = null;
    this.lastCollectedCount = undefined;
    this.lastStatuses.clear();
  }

  push(kind: DevLogKind, source: string, detail: string, routeSeconds = 0): void {
    const last = this.entries[this.entries.length - 1];
    if (
      last &&
      last.kind === kind &&
      last.source === source &&
      last.detail === detail &&
      Math.abs(last.routeSeconds - routeSeconds) < 0.05
    ) {
      return;
    }
    this.entries.push({
      seq: ++this.seq,
      routeSeconds: Number(routeSeconds.toFixed(2)),
      kind,
      source,
      detail,
    });
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_LOG_ENTRIES);
    }
  }

  observeScene(scene: ArcadeScene | undefined): void {
    const w = scene?.world;
    if (!w) {
      if (this.lastMissionId !== undefined) this.resetBaselines();
      return;
    }

    const r = w.route;
    if (this.lastMissionId !== w.mission.id) {
      this.resetBaselines();
      this.lastMissionId = w.mission.id;
      this.lastLives = w.lives;
      if (this.lastWeaponLevel !== undefined && w.weapons.weaponLevel !== this.lastWeaponLevel) {
      this.push('activation', 'Armamento', `Nível da arma: NV ${this.lastWeaponLevel} -> NV ${w.weapons.weaponLevel}`, r);
    }
    this.lastWeaponLevel = w.weapons.weaponLevel;
      this.lastCollectedCount = w.collected;
      for (const e of w.stageDirector.snapshot(w.route, w.region).entries) {
        this.lastStatuses.set(e.id, e.status);
      }
      this.push('activation', 'stage', `Sessão iniciada em ${w.mission.name} (${w.mission.perspective})`, r);
      return;
    }

    const sensor = w.devSensorSnapshot();

    if (this.lastArchPhase !== undefined && sensor.tideArchPhase !== this.lastArchPhase) {
      if (sensor.tideArchPhase === 'complete') {
        this.push('completed', 'Arco das Marés', 'Travessia e subida concluídas com sucesso.', r);
      } else if (sensor.tideArchPhase !== 'idle') {
        this.push('activation', 'Arco das Marés', `Fase '${this.lastArchPhase}' -> '${sensor.tideArchPhase}' (alt=${sensor.altitude})`, r);
      }
    }
    this.lastArchPhase = sensor.tideArchPhase;

    if (sensor.bridgeBandActive !== this.lastBridgeBand) {
      this.push(
        sensor.bridgeBandActive ? 'sensor-enter' : 'sensor-exit',
        'Sensor Ponte/Arco',
        sensor.bridgeBandActive
          ? `RIVET entrou na banda do arco (scrollY=${sensor.archScreenY}, vão=${Math.round(sensor.opening.left)}..${Math.round(sensor.opening.right)})`
          : `RIVET saiu da banda do arco (crossedArch=${sensor.crossedArch})`,
        r,
      );
      this.lastBridgeBand = sensor.bridgeBandActive;
    }

    if (sensor.pierCollisionActive !== this.lastPierCollision) {
      this.push(
        sensor.pierCollisionActive ? 'sensor-enter' : 'sensor-exit',
        'Colisor Rocha Arco',
        sensor.pierCollisionActive ? 'Ativo: altura < nível do arco' : 'Desativado',
        r,
      );
      this.lastPierCollision = sensor.pierCollisionActive;
    }

    if (sensor.crossedArch && !this.lastCrossedArch) {
      this.push('completed', 'Sensor Arco', 'Passagem válida pelo vão central registrada.', r);
    }
    this.lastCrossedArch = sensor.crossedArch;

    if (sensor.checkpointReached && !this.lastCheckpoint) {
      this.push('activation', 'Checkpoint', 'Checkpoint oficial gravado e bônus concedido.', r);
    }
    this.lastCheckpoint = sensor.checkpointReached;

    if (this.lastLives !== undefined && w.lives < this.lastLives) {
      this.push('collision', 'RIVET', `Dano/abate sofrido: vidas ${this.lastLives} -> ${w.lives}`, r);
    }
    this.lastLives = w.lives;

    if (this.lastCollectedCount !== undefined && w.collected > this.lastCollectedCount) {
      this.push('collision', 'Coleta', `Suprimento recolhido (${w.collected}) • NV ${w.weapons.weaponLevel} P=${w.weapons.powerMeter}`, r);
    }
    this.lastCollectedCount = w.collected;
    if (this.lastWeaponLevel !== undefined && w.weapons.weaponLevel !== this.lastWeaponLevel) {
      this.push('activation', 'Armamento', `Nível da arma: NV ${this.lastWeaponLevel} -> NV ${w.weapons.weaponLevel}`, r);
    }
    this.lastWeaponLevel = w.weapons.weaponLevel;

    if (sensor.bossActive !== this.lastBossActive) {
      this.push(
        sensor.bossActive ? 'activation' : 'completed',
        'Boss',
        sensor.bossActive ? `${w.mission.boss} ativado` : `${w.mission.boss} encerrado`,
        r,
      );
      this.lastBossActive = sensor.bossActive;
    }
    if (sensor.subActiveSection !== this.lastSubSection && sensor.subActiveSection !== null) {
      this.push('activation', 'Colosso Abissal', `Seção ativa alterada -> ${sensor.subActiveSection + 1}/5`, r);
    }
    this.lastSubSection = sensor.subActiveSection;

    const dirSnap = w.stageDirector.snapshot(w.route, w.region);
    for (const e of dirSnap.entries) {
      const prev = this.lastStatuses.get(e.id);
      if (prev !== undefined && prev !== e.status && (e.status === 'active' || e.status === 'completed' || e.status === 'blocked')) {
        const logKind: DevLogKind = e.status === 'completed' ? 'completed' : e.status === 'blocked' ? 'condition-fail' : 'activation';
        this.push(logKind, e.id, `${e.name}: ${prev} -> ${e.status}`, r);
      }
      this.lastStatuses.set(e.id, e.status);
    }
  }
}
