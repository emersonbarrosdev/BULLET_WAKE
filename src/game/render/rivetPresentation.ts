import type { WeaponLevel } from '../systems/weaponSystem.ts';

/** Roll around the longitudinal axis; the aircraft's nose always faces north. */
export function stepRivetBank(bank: number, dx: number, deltaMs: number): number {
  const target = Math.abs(dx) > .01 ? Math.sign(dx) : 0;
  return bank + (target - bank) * (1 - Math.exp(-Math.max(0, deltaMs) / 65));
}

export function rivetBankPose(bank: number): -1 | 0 | 1 {
  return Math.abs(bank) < .35 ? 0 : bank < 0 ? -1 : 1;
}

/** Atlas row zero lowers the RIGHT wing; row one lowers the LEFT wing. */
export function rivetBankFrame(bank: number, engineFrame: number): number {
  return engineFrame % 4 + (rivetBankPose(bank) < 0 ? 4 : 0);
}

/** Bullet Wake art calibration, not purported Sonic Wings ROM measurements. */
export function rivetShotPresentation(level: WeaponLevel): { width: number; height: number; radius: number } {
  const sizes = [[22, 26, 2.5], [26, 30, 3], [36, 34, 3.8], [42, 38, 4.5], [48, 42, 5.3]];
  const [width, height, radius] = sizes[level - 1];
  return { width, height, radius };
}
