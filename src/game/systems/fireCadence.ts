/** Independent trigger lock and held-fire clock. RAPID off rewards deliberate taps. */
export interface TriggerCadence { holdMs: number; tapMs: number; }
export function stepTriggerCadence(state: TriggerCadence, deltaMs: number, held: boolean, pressed: boolean, rapid: boolean, heldIntervalMs: number, tapIntervalMs: number): TriggerCadence & { volleys: number } {
  const dt = Math.max(0,deltaMs);
  let holdMs = state.holdMs-dt, tapMs = Math.max(0,state.tapMs-dt), volleys = 0;
  const interval = rapid ? tapIntervalMs : heldIntervalMs;
  if (pressed && tapMs <= 0) {
    volleys=1;holdMs=interval;tapMs=tapIntervalMs;
  } else if (held && holdMs <= 0 && tapMs <= 0) {
    volleys=1;holdMs+=interval;tapMs=tapIntervalMs;
  }
  if (!held) holdMs = Math.max(0,holdMs);
  return {holdMs,tapMs,volleys};
}

/** Basic timer retained for deterministic clock tests. */
export function stepFireCadence(
  cooldown: number,
  deltaMs: number,
  firing: boolean,
  intervalMs: number,
): { cooldown: number; volleys: number } {
  let remaining = cooldown - Math.max(0, deltaMs),
    volleys = 0;
  if (!firing) return { cooldown: Math.max(0, remaining), volleys };
  while (remaining <= 0 && volleys < 4) {
    volleys++;
    remaining += intervalMs;
  }
  return { cooldown: remaining, volleys };
}
