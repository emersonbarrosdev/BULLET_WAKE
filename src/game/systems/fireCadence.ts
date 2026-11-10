/** Carry fractional cooldown across frames; tapping cannot create extra volleys. */
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
