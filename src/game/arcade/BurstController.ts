/**
 * Sonic Wings-style rapid burst controller.
 * Pressing or holding fire triggers crisp 3-pulse bursts (0 / 42 / 84 ms) immediately on press and repeats
 * continuously at rapid-fire cadence while held (without requiring repeated taps).
 */

export const BURST_PULSE_COUNT = 3;
export const BURST_PULSE_STEP_MS = 42;
export const BURST_MIN_CADENCE_MS = 95;
export const BURST_HOLD_CADENCE_MS = 220;
export const BURST_ACCESSIBILITY_CADENCE_MS = 220;
export const BURST_LEGACY_HOLD_CADENCE_MS = 220;

export type BurstState = 'ready' | 'bursting' | 'holding' | 'cooldown';

export interface BurstUpdateOptions {
  /** Accessibility rapid-fire flag (continuous auto-fire is now enabled by default for all modes). */
  accessibility?: boolean;
  /** Whether holding the fire button repeats bursts continuously (defaults to true). */
  allowHoldRepeat?: boolean;
  /** Cadence in ms between automatic bursts when held. */
  holdIntervalMs?: number;
}

export interface BurstStepResult {
  pulses: number;
  burstStarted: boolean;
  justPressed: boolean;
  justReleased: boolean;
  state: BurstState;
}

const EPSILON_MS = 1e-6;

export class BurstController {
  private clock = 0;
  private nextBurst = 0;
  private pending: number[] = [];
  private held = false;
  private suppressHoldUntilRelease = false;

  /**
   * Advances simulation clock by `dt` milliseconds and returns detailed state + emitted pulses.
   * Starts firing immediately on press and repeats continuously while `held` remains true unless suppressed until release.
   */
  step(dt: number, held: boolean, options: BurstUpdateOptions | boolean = false): BurstStepResult {
    const opts: BurstUpdateOptions = typeof options === 'boolean' ? { accessibility: options } : options;
    const accessibility = !!opts.accessibility;
    const allowHoldRepeat = opts.allowHoldRepeat ?? true;
    const holdIntervalMs = opts.holdIntervalMs ?? BURST_HOLD_CADENCE_MS;

    const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
    this.clock += safeDt;

    if (!held) this.suppressHoldUntilRelease = false;
    const justPressed = held && !this.held;
    const justReleased = !held && this.held;
    this.held = held;

    let burstStarted = false;
    const canRepeatOnHold = (accessibility || allowHoldRepeat) && !this.suppressHoldUntilRelease;
    const wantsBurst = held && (justPressed || canRepeatOnHold);
    const allowWhileTail = justPressed && !accessibility;

    if (wantsBurst && (allowWhileTail || !this.pending.length) && this.clock + EPSILON_MS >= this.nextBurst) {
      burstStarted = true;
      this.pending.length = 0;
      for (let i = 0; i < BURST_PULSE_COUNT; i++) {
        this.pending.push(this.clock + i * BURST_PULSE_STEP_MS);
      }
      const cadence = allowHoldRepeat && !justPressed
        ? holdIntervalMs
        : accessibility
          ? BURST_ACCESSIBILITY_CADENCE_MS
          : BURST_MIN_CADENCE_MS;
      this.nextBurst = this.clock + cadence;
    }

    let pulses = 0;
    while (this.pending.length && this.pending[0] <= this.clock + EPSILON_MS) {
      this.pending.shift();
      pulses++;
    }

    return {
      pulses,
      burstStarted,
      justPressed,
      justReleased,
      state: this.getState(),
    };
  }

  /** Convenience helper returning only emitted primary pulses for this simulation step. */
  update(dt: number, held: boolean, options: BurstUpdateOptions | boolean = false): number {
    return this.step(dt, held, options).pulses;
  }

  getState(): BurstState {
    if (this.pending.length > 0) return 'bursting';
    if (this.held) return 'holding';
    if (this.clock + EPSILON_MS < this.nextBurst) return 'cooldown';
    return 'ready';
  }

  isBurstActive(): boolean {
    return this.pending.length > 0;
  }

  isHeld(): boolean {
    return this.held;
  }

  /**
   * Cancels any in-flight burst and resets cadence timers.
   * Passing `preserveHeld = true` prevents a still-held button from firing on respawn until released.
   */
  reset(preserveHeld = false): void {
    this.clock = 0;
    this.nextBurst = 0;
    this.pending = [];
    if (preserveHeld) {
      this.suppressHoldUntilRelease = this.held;
    } else {
      this.held = false;
      this.suppressHoldUntilRelease = false;
    }
  }
}
