import type { ArcadeScene } from '../game/arcade/ArcadeScene.ts';
import { clamp } from '../game/arcade/geometry.ts';
import type { GameDifficulty } from '../game/arcade/PelagicDifficulty.ts';
import type { WeaponLevel } from '../game/systems/weaponSystem.ts';
import type { DevScenarioOptions } from './types.ts';

export interface DevBossResistancePreset {
  id: string;
  label: string;
  options: DevScenarioOptions;
}

export const BOSS_RESISTANCE_PRESETS: readonly DevBossResistancePreset[] = [
  {
    id: 'nv1-0esp',
    label: 'NV1 sem Especiais',
    options: { weaponLevel: 1, powerMeter: 0, specialCharges: 0, lives: 3, invincible: false },
  },
  {
    id: 'nv3-2esp',
    label: 'NV3 com 2 Especiais',
    options: { weaponLevel: 3, powerMeter: 0, specialCharges: 2, lives: 3, invincible: false },
  },
  {
    id: 'full-0esp',
    label: 'FULL sem Especiais',
    options: { weaponLevel: 5, powerMeter: 0, specialCharges: 0, lives: 3, invincible: false },
  },
  {
    id: 'full-5esp',
    label: 'FULL + 5 Especiais',
    options: { weaponLevel: 5, powerMeter: 2, specialCharges: 5, lives: 5, invincible: false },
  },
  {
    id: 'full-5esp-inv',
    label: 'FULL + 5 ESP + Invencível',
    options: { weaponLevel: 5, powerMeter: 2, specialCharges: 5, lives: 5, invincible: true },
  },
];

export interface DevPlayerConfigPatch {
  weaponLevel?: number;
  powerMeter?: number;
  lives?: number;
  specialCharges?: number;
  score?: number;
  difficulty?: GameDifficulty;
  assisted?: boolean;
  rapidFire?: boolean;
  devInvincible?: boolean;
}

/**
 * Applies live temporary RIVET weapon, resource, difficulty, and dev-invincibility settings
 * directly over the active simulation without mutating campaign progression rules or saves.
 */
export class DevCombatControls {
  applyPlayerPatch(scene: ArcadeScene, patch: DevPlayerConfigPatch): void {
    const w = scene.world;
    if (!w) return;
    if (patch.weaponLevel !== undefined) w.weapons.weaponLevel = clamp(Math.round(patch.weaponLevel), 1, 5) as WeaponLevel;
    if (patch.powerMeter !== undefined) w.weapons.powerMeter = clamp(Math.round(patch.powerMeter), 0, 2);
    if (patch.lives !== undefined) w.lives = clamp(Math.round(patch.lives), 1, 5);
    if (patch.specialCharges !== undefined) w.weapons.specialCharges = clamp(Math.round(patch.specialCharges), 0, 5);
    if (patch.score !== undefined && Number.isFinite(patch.score)) w.score = Math.max(0, Math.round(patch.score));
    if (patch.difficulty !== undefined) w.setDifficulty(patch.difficulty);
    if (patch.assisted !== undefined) w.assisted = w.up && patch.assisted;
    if (patch.rapidFire !== undefined) w.accessibility = patch.rapidFire;
    if (patch.devInvincible !== undefined) w.devInvincible = patch.devInvincible;
    scene.refreshHudVisual();
  }

  resetRivet(scene: ArcadeScene): void {
    const w = scene.world;
    if (!w) return;
    w.weapons.weaponLevel = 1;
    w.weapons.powerMeter = 0;
    w.lives = 3;
    w.weapons.specialCharges = 2;
    w.player.x = w.up ? 384 : 100;
    w.player.y = w.up ? 376 : 228;
    w.player.bank = 0;
    w.player.invulnerable = 1.5;
    w.specialTime = 0;
    w.bomb = undefined;
    scene.refreshHudVisual();
  }

  triggerBurst(scene: ArcadeScene): void {
    scene.world?.devTriggerBurst();
  }

  triggerMissile(scene: ArcadeScene): void {
    scene.world?.devTriggerMissile();
  }

  triggerSpecial(scene: ArcadeScene): void {
    scene.world?.devTriggerSpecial();
    scene.refreshHudVisual();
  }

  triggerControlledDeath(scene: ArcadeScene): void {
    scene.world?.devTriggerControlledDeath();
    scene.refreshHudVisual();
  }

  spawnCargo(scene: ArcadeScene, kind: 'power' | 'life' | 'special'): void {
    scene.world?.devSpawnCargoItem(kind);
  }

  getLiveTuning(scene?: ArcadeScene): {
    playerSpeedScale: number;
    enemySpeedScale: number;
    enemyFireRateScale: number;
    enemyShotSpeedScale: number;
    specialDurationScale: number;
  } {
    const w = scene?.world;
    return {
      playerSpeedScale: w?.playerSpeedScale ?? 1,
      enemySpeedScale: w?.enemySpeedScale ?? 1,
      enemyFireRateScale: w?.enemyFireRateScale ?? 1,
      enemyShotSpeedScale: w?.enemyShotSpeedScale ?? 1,
      specialDurationScale: w?.specialDurationScale ?? 1,
    };
  }

  applyLiveTuning(
    scene: ArcadeScene,
    patch: {
      playerSpeedScale?: number;
      enemySpeedScale?: number;
      enemyFireRateScale?: number;
      enemyShotSpeedScale?: number;
      specialDurationScale?: number;
    },
  ): void {
    scene.devApplyLiveTuning(patch);
  }

  resetLiveTuning(scene: ArcadeScene): void {
    scene.devApplyLiveTuning({
      playerSpeedScale: 1,
      enemySpeedScale: 1,
      enemyFireRateScale: 1,
      enemyShotSpeedScale: 1,
      specialDurationScale: 1,
    });
  }
}
