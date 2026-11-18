import { clamp } from './geometry.ts';

export type ChargeTier = 'none' | 'partial' | 'full';
export type ChargePhase = 'idle' | 'charging' | 'full' | 'recovery';

export interface ChargedShotConfig {
  /** Tempo mínimo segurando o botão para produzir disparo carregado (segundos). */
  readonly minChargeSeconds: number;
  /** Tempo máximo para atingir 100% de carga (segundos). */
  readonly maxChargeSeconds: number;
  /** Intervalo de recuperação após disparar ataque carregado (segundos). */
  readonly recoverySeconds: number;
  /** Velocidade base do projétil carregado (unidades virtuais / segundo). */
  readonly projectileSpeed: number;
  /** Intervalo mínimo entre impulsos sonoros discretos durante carregamento (segundos). */
  readonly windupAudioIntervalSeconds: number;
}

export const CHARGED_SHOT_CONFIG: ChargedShotConfig = {
  minChargeSeconds: 0.35,
  maxChargeSeconds: 1.2,
  recoverySeconds: 0.25,
  projectileSpeed: 760,
  windupAudioIntervalSeconds: 0.18,
};

export interface ChargedLevelSpec {
  readonly label: string;
  readonly fullDamage: number;
  readonly fullRadius: number;
  readonly fullScale: number;
  readonly fullPierce: number;
  readonly partialScaleFactor: number;
  readonly speedMultiplier: number;
  readonly effectIntensity: number;
}

/**
 * Balanceamento progressivo do Tiro Carregado por nível real de POWER (1..5):
 * considera o tempo sem disparo automático (0.35s-1.2s + 0.25s recuperação)
 * para oferecer vantagem situacional contra alvos resistentes sem anular o tiro automático.
 */
const CHARGED_LEVEL_SPECS: readonly ChargedLevelSpec[] = [
  {
    label: 'CONCENTRADO',
    fullDamage: 6.5,
    fullRadius: 8.5,
    fullScale: 1.35,
    fullPierce: 1,
    partialScaleFactor: 0.62,
    speedMultiplier: 1.0,
    effectIntensity: 1.0,
  },
  {
    label: 'REFORÇADO',
    fullDamage: 9.5,
    fullRadius: 10.5,
    fullScale: 1.6,
    fullPierce: 1,
    partialScaleFactor: 0.64,
    speedMultiplier: 1.04,
    effectIntensity: 1.25,
  },
  {
    label: 'PERFURANTE',
    fullDamage: 13.0,
    fullRadius: 12.0,
    fullScale: 1.85,
    fullPierce: 3,
    partialScaleFactor: 0.65,
    speedMultiplier: 1.08,
    effectIntensity: 1.55,
  },
  {
    label: 'ALTA ENERGIA',
    fullDamage: 16.5,
    fullRadius: 14.0,
    fullScale: 2.15,
    fullPierce: 4,
    partialScaleFactor: 0.66,
    speedMultiplier: 1.12,
    effectIntensity: 1.85,
  },
  {
    label: 'MÁXIMO',
    fullDamage: 21.0,
    fullRadius: 16.5,
    fullScale: 2.45,
    fullPierce: 5,
    partialScaleFactor: 0.68,
    speedMultiplier: 1.16,
    effectIntensity: 2.2,
  },
];

export function resolveChargedLevelSpec(weaponLevel: number, _pilotId = 'nolan'): ChargedLevelSpec {
  const maxIdx = CHARGED_LEVEL_SPECS.length - 1;
  const idx = clamp(Math.floor(weaponLevel) - 1, 0, maxIdx);
  return CHARGED_LEVEL_SPECS[idx];
}

export interface ChargedReleaseSpec {
  readonly tier: Exclude<ChargeTier, 'none'>;
  readonly ratio: number;
  readonly weaponLevel: number;
  readonly damage: number;
  readonly radius: number;
  readonly scale: number;
  readonly pierceCount: number;
  readonly speed: number;
  readonly effectIntensity: number;
  readonly label: string;
}

export interface ChargedShotStepResult {
  readonly justStarted: boolean;
  readonly justReachedFull: boolean;
  readonly shouldPlayWindup: boolean;
  readonly cancelledEarly: boolean;
  readonly released: ChargedReleaseSpec | null;
}

export interface ChargedShotSnapshot {
  readonly phase: ChargePhase;
  readonly tier: ChargeTier;
  readonly percent: number;
  readonly ratio: number;
  readonly isHolding: boolean;
  readonly isPartialReady: boolean;
  readonly isFull: boolean;
  readonly inRecovery: boolean;
}

export class ChargedShotController {
  private readonly cfg: ChargedShotConfig;
  private elapsedSeconds = 0;
  private holding = false;
  private recoveryRemaining = 0;
  private windupTimer = 0;

  constructor(config: ChargedShotConfig = CHARGED_SHOT_CONFIG) {
    this.cfg = config;
  }

  get isHolding(): boolean {
    return this.holding;
  }

  get inRecovery(): boolean {
    return this.recoveryRemaining > 0;
  }

  /** Enquanto o jogador carrega ou está na janela de recuperação, suspende o tiro automático. */
  get shouldSuspendAutoFire(): boolean {
    return this.holding || this.recoveryRemaining > 0;
  }

  get ratio(): number {
    if (this.cfg.maxChargeSeconds <= 0) return 0;
    return clamp(this.elapsedSeconds / this.cfg.maxChargeSeconds, 0, 1);
  }

  get tier(): ChargeTier {
    if (this.elapsedSeconds >= this.cfg.maxChargeSeconds - 1e-6) return 'full';
    if (this.elapsedSeconds >= this.cfg.minChargeSeconds - 1e-6) return 'partial';
    return 'none';
  }

  get phase(): ChargePhase {
    if (this.recoveryRemaining > 0) return 'recovery';
    if (!this.holding) return 'idle';
    return this.tier === 'full' ? 'full' : 'charging';
  }

  snapshot(): ChargedShotSnapshot {
    const r = this.ratio;
    const t = this.tier;
    return {
      phase: this.phase,
      tier: t,
      percent: Math.round(r * 100),
      ratio: r,
      isHolding: this.holding,
      isPartialReady: t !== 'none',
      isFull: t === 'full',
      inRecovery: this.recoveryRemaining > 0,
    };
  }

  cancel(): void {
    this.elapsedSeconds = 0;
    this.holding = false;
    this.recoveryRemaining = 0;
    this.windupTimer = 0;
  }

  step(dtSeconds: number, chargeHeld: boolean, weaponLevel: number, pilotId = 'nolan'): ChargedShotStepResult {
    const dt = Number.isFinite(dtSeconds) && dtSeconds > 0 ? dtSeconds : 0;
    let justStarted = false;
    let justReachedFull = false;
    let shouldPlayWindup = false;
    let cancelledEarly = false;
    let released: ChargedReleaseSpec | null = null;

    if (this.recoveryRemaining > 0) {
      this.recoveryRemaining = Math.max(0, this.recoveryRemaining - dt);
      if (this.recoveryRemaining > 0 || !chargeHeld) {
        return { justStarted, justReachedFull, shouldPlayWindup, cancelledEarly, released };
      }
    }

    if (chargeHeld) {
      const wasHolding = this.holding;
      const wasFull = this.elapsedSeconds >= this.cfg.maxChargeSeconds - 1e-6;
      if (!wasHolding) {
        justStarted = true;
        this.holding = true;
        this.windupTimer = 0;
      }
      this.elapsedSeconds = Math.min(this.cfg.maxChargeSeconds, this.elapsedSeconds + dt);
      const isNowFull = this.elapsedSeconds >= this.cfg.maxChargeSeconds - 1e-6;
      if (isNowFull && !wasFull) {
        justReachedFull = true;
      }
      this.windupTimer += dt;
      if (!isNowFull && this.windupTimer >= this.cfg.windupAudioIntervalSeconds) {
        this.windupTimer = 0;
        shouldPlayWindup = true;
      }
      return { justStarted, justReachedFull, shouldPlayWindup, cancelledEarly, released };
    }

    if (this.holding) {
      const releaseTier = this.tier;
      const r = this.ratio;
      this.holding = false;
      this.elapsedSeconds = 0;
      this.windupTimer = 0;

      if (releaseTier === 'none') {
        cancelledEarly = true;
      } else {
        this.recoveryRemaining = this.cfg.recoverySeconds;
        released = buildChargedReleaseSpec(releaseTier, r, weaponLevel, pilotId, this.cfg.projectileSpeed);
      }
    }

    return { justStarted, justReachedFull, shouldPlayWindup, cancelledEarly, released };
  }
}

export function buildChargedReleaseSpec(
  tier: Exclude<ChargeTier, 'none'>,
  ratio: number,
  weaponLevel: number,
  pilotId = 'nolan',
  baseSpeed = CHARGED_SHOT_CONFIG.projectileSpeed,
): ChargedReleaseSpec {
  const spec = resolveChargedLevelSpec(weaponLevel, pilotId);
  const full = tier === 'full';
  const span = Math.max(0.01, CHARGED_SHOT_CONFIG.maxChargeSeconds - CHARGED_SHOT_CONFIG.minChargeSeconds);
  const minRatio = CHARGED_SHOT_CONFIG.minChargeSeconds / CHARGED_SHOT_CONFIG.maxChargeSeconds;
  const subRatio = full ? 1 : clamp((ratio - minRatio) / (span / CHARGED_SHOT_CONFIG.maxChargeSeconds), 0, 1);
  const dmgFactor = full ? 1 : spec.partialScaleFactor + (0.86 - spec.partialScaleFactor) * subRatio;
  const sizeFactor = full ? 1 : 0.72 + 0.16 * subRatio;
  const pierceCount = full ? spec.fullPierce : Math.max(1, Math.ceil(spec.fullPierce * 0.5));

  return {
    tier,
    ratio: full ? 1 : ratio,
    weaponLevel,
    damage: Number((spec.fullDamage * dmgFactor).toFixed(2)),
    radius: Number((spec.fullRadius * sizeFactor).toFixed(2)),
    scale: Number((spec.fullScale * sizeFactor).toFixed(2)),
    pierceCount,
    speed: Math.round(baseSpeed * spec.speedMultiplier * (full ? 1 : 0.92)),
    effectIntensity: spec.effectIntensity * (full ? 1 : 0.65),
    label: spec.label,
  };
}
