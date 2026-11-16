import type { ArcadeScene } from '../game/arcade/ArcadeScene.ts';
import type { WeaponLevel } from '../game/systems/weaponSystem.ts';
import { createPlayableStageAdapters } from './DevStageAdapter.ts';
import type { DevScenario, DevScenarioOptions, DevStageAdapter } from './types.ts';

function applyScenarioOptions(scene: ArcadeScene, options?: DevScenarioOptions): void {
  const w = scene.world;
  if (!w) return;
  if (options?.difficulty !== undefined) w.hard = options.difficulty !== 'normal';
  if (options?.assisted !== undefined) w.assisted = w.up && options.assisted;
  if (options?.rapidFire !== undefined) w.accessibility = options.rapidFire;
  if (options?.weaponLevel !== undefined) w.weapons.weaponLevel = Math.max(1, Math.min(5, Math.round(options.weaponLevel))) as WeaponLevel;
  if (options?.powerMeter !== undefined) w.weapons.powerMeter = Math.max(0, Math.min(2, Math.round(options.powerMeter)));
  if (options?.lives !== undefined) w.lives = Math.max(1, Math.min(5, Math.round(options.lives)));
  if (options?.specialCharges !== undefined) w.weapons.specialCharges = Math.max(0, Math.min(5, Math.round(options.specialCharges)));
  if (options?.invincible !== undefined) w.devInvincible = options.invincible;
  scene.refreshHudVisual();
}

/**
 * Central extensible scenario catalog built dynamically from all registered playable MISSIONS.
 * Future implemented stages added to MISSIONS are auto-registered without rewriting the panel.
 */
export class DevScenarioRegistry {
  private readonly adapters: DevStageAdapter[];
  private readonly scenarios = new Map<string, DevScenario>();

  constructor() {
    this.adapters = createPlayableStageAdapters();
    for (const adapter of this.adapters) {
      this.registerStageScenarios(adapter);
    }
  }

  private registerStageScenarios(adapter: DevStageAdapter): void {
    for (const cp of adapter.checkpoints) {
      this.register({
        id: cp.id,
        stageId: adapter.stageId,
        missionIndex: adapter.missionIndex,
        name: `${adapter.name} — ${cp.label}`,
        category: cp.kind === 'boss' ? 'boss' : cp.kind === 'miniboss' ? 'miniboss' : 'checkpoint',
        description: `Checkpoint aos ${cp.atSeconds}s (${adapter.perspective})`,
        initialize: (scene, options) => {
          scene.devJumpToCheckpoint(adapter.missionIndex, cp.atSeconds, {
            pauseDirector: options?.pauseDirector,
          });
          applyScenarioOptions(scene, options);
        },
        cleanup: (scene) => {
          scene.world?.clearArenaEntities();
        },
      });
    }

    for (const boss of adapter.bosses) {
      this.register({
        id: boss.id,
        stageId: adapter.stageId,
        missionIndex: adapter.missionIndex,
        name: `${adapter.name} — ${boss.name}`,
        category: boss.mini ? 'miniboss' : 'boss',
        description: boss.mini ? 'Confronto direto com Miniboss' : 'Confronto direto com Chefe Final',
        initialize: (scene, options) => {
          scene.devJumpToCheckpoint(adapter.missionIndex, boss.mini ? 155 : 300, {
            bossMini: boss.mini,
          });
          applyScenarioOptions(scene, options);
        },
        cleanup: (scene) => {
          scene.world?.clearArenaEntities();
        },
      });

      if (!boss.mini && boss.sections.length > 1) {
        for (const sec of boss.sections) {
          this.register({
            id: sec.id,
            stageId: adapter.stageId,
            missionIndex: adapter.missionIndex,
            name: `${boss.name} — ${sec.name}`,
            category: 'boss-section',
            description: `Seção ${sec.index + 1} (${sec.partCount} componentes, casco ${sec.hullMaxHp} HP)`,
            initialize: (scene, options) => {
              scene.devJumpToCheckpoint(adapter.missionIndex, 300, {
                bossMini: false,
                subSectionIndex: sec.index,
              });
              applyScenarioOptions(scene, options);
            },
            cleanup: (scene) => {
              scene.world?.clearArenaEntities();
            },
          });
        }
      }
    }
  }

  register(scenario: DevScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  getAdapters(): readonly DevStageAdapter[] {
    return this.adapters;
  }

  getAdapterByMissionIndex(missionIndex: number): DevStageAdapter | undefined {
    return this.adapters.find((a) => a.missionIndex === missionIndex);
  }

  getScenario(id: string): DevScenario | undefined {
    return this.scenarios.get(id);
  }

  listScenarios(filter?: { stageId?: number; category?: DevScenario['category'] }): DevScenario[] {
    const out: DevScenario[] = [];
    for (const s of this.scenarios.values()) {
      if (filter?.stageId !== undefined && s.stageId !== filter.stageId) continue;
      if (filter?.category !== undefined && s.category !== filter.category) continue;
      out.push(s);
    }
    return out;
  }
}
