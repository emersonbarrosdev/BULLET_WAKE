import { powerItemsForNextLevel, type PlayerWeaponsState } from '../systems/weaponSystem.ts';

export type SurvivalRule = 'classic-v1' | 'hull-v1';
export type HullCondition = 'intact' | 'light' | 'damaged' | 'critical' | 'destroyed';
export interface HullSnapshot { rule: SurvivalRule; current: number; maximum: number; }
export const HULL_RULES = Object.freeze({ maximum: 4, protectionSeconds: 1.8, fullRepairScore: 500, repairScore: 250 });
/** One extra delivery plus the existing LIFE slot converted to REPAIR: two finite opportunities per mission. */
export const HULL_REPAIR_OPPORTUNITY = Object.freeze({ UP: 230, SIDE: 122 });
export const HULL_STATES: Readonly<Record<HullCondition, { label: string; color: number; smoke: number; fire: boolean }>> = {
  intact: { label: 'INTACTO', color: 0x70f9d0, smoke: 0, fire: false },
  light: { label: 'AVARIA LEVE', color: 0xffdd70, smoke: 0, fire: false },
  damaged: { label: 'AVARIADO', color: 0xffae57, smoke: 1, fire: false },
  critical: { label: 'CRÍTICO', color: 0xff637f, smoke: 2, fire: true },
  destroyed: { label: 'DESTRUÍDO', color: 0x8193ac, smoke: 2, fire: false },
};
export function hullCondition(current: number, maximum: number = HULL_RULES.maximum): HullCondition {
  if (current <= 0) return 'destroyed';
  if (current >= maximum) return 'intact';
  if (current === 1) return 'critical';
  return current / maximum <= .5 ? 'damaged' : 'light';
}
/** Versioned, finite capacity. Three/five segments are QA variants, never a difficulty side effect. */
export function normalizeHullSnapshot(value: unknown): HullSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as HullSnapshot;
  if (v.rule !== 'hull-v1' || !Number.isInteger(v.current) || !Number.isInteger(v.maximum) || v.maximum < 3 || v.maximum > 5 || v.current < 0 || v.current > v.maximum) return undefined;
  return { rule: 'hull-v1', current: v.current, maximum: v.maximum };
}
export function loseHullPower(weapons: PlayerWeaponsState): void {
  weapons.weaponLevel = Math.max(1, weapons.weaponLevel - 1) as PlayerWeaponsState['weaponLevel'];
  weapons.powerMeter = Math.min(weapons.powerMeter, Math.max(0, powerItemsForNextLevel(weapons.pilotId, weapons.weaponLevel) - 1));
}
