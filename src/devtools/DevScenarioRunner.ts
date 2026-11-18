import type { ArcadeScene } from '../game/arcade/ArcadeScene.ts';
import { ArcadeWorld } from '../game/arcade/ArcadeWorld.ts';
import { MISSIONS, formationOffsets } from '../game/arcade/content.ts';
import { clamp } from '../game/arcade/geometry.ts';
import type { DevCombatControls } from './DevCombatControls.ts';
import type { DevScenarioRegistry } from './DevScenarioRegistry.ts';
import type { DevStateManager } from './DevStateManager.ts';
import type { DevEnemySpawnConfig, DevScenarioOptions } from './types.ts';

export interface DevBossVerificationReport {
  missionId: number;
  missionName: string;
  bossName: string;
  passed: boolean;
  stepsCompleted: string[];
  skippedSteps: string[];
  elapsedSeconds: number;
}

/**
 * Orchestrates safe, repeatable execution of checkpoints, bosses, enemies, events,
 * stress scenarios, and deterministic boss progression verification.
 */
export class DevScenarioRunner {
  private readonly registry: DevScenarioRegistry;
  private readonly state: DevStateManager;
  private readonly combat: DevCombatControls;

  constructor(
    registry: DevScenarioRegistry,
    state: DevStateManager,
    combat: DevCombatControls,
  ) {
    this.registry = registry;
    this.state = state;
    this.combat = combat;
  }

  runScenarioById(scene: ArcadeScene, id: string, options?: DevScenarioOptions): boolean {
    const scenario = this.registry.getScenario(id);
    if (!scenario) return false;
    this.state.beginTestSession(scene);
    scenario.cleanup(scene);
    scenario.initialize(scene, options);
    this.state.recordScenario(scenario, options);
    return true;
  }

  runBoss(
    scene: ArcadeScene,
    missionIndex: number,
    mini: boolean,
    options?: DevScenarioOptions & { subSectionIndex?: number },
  ): void {
    this.state.beginTestSession(scene);
    const apply = () => {
      scene.devJumpToCheckpoint(missionIndex, mini ? 155 : 300, {
        bossMini: mini,
        subSectionIndex: options?.subSectionIndex,
      });
      if (scene.world && options) {
        this.combat.applyPlayerPatch(scene, {
          weaponLevel: options.weaponLevel,
          powerMeter: options.powerMeter,
          lives: options.lives,
          specialCharges: options.specialCharges,
          difficulty: options.difficulty ? (options.difficulty === 'arcade' ? 'hard' : options.difficulty) : undefined,
          assisted: options.assisted,
          rapidFire: options.rapidFire,
          devInvincible: options.invincible,
        });
      }
    };
    apply();
    this.state.recordReplayAction(
      `Boss ${MISSIONS[missionIndex]?.name ?? missionIndex}${mini ? ' (Miniboss)' : ''}`,
      apply,
    );
  }

  spawnEnemyTest(scene: ArcadeScene, cfg: DevEnemySpawnConfig): number {
    this.state.beginTestSession(scene);
    const run = () => {
      const targetMission = cfg.missionIndex;
      if (!scene.world || scene.getCurrentMissionIndex() !== targetMission || scene.screen !== 'play') {
        scene.devJumpToCheckpoint(targetMission, 10, { pauseDirector: true });
      } else if (!cfg.keepExisting) {
        scene.world.clearArenaEntities();
      }
      const w = scene.world!;
      w.setDifficulty(cfg.difficulty);
      w.enemyFireRateScale = clamp(cfg.fireRateScale, 0.25, 4);
      w.enemyShotSpeedScale = clamp(cfg.shotSpeedScale, 0.25, 3);

      const perBatch = formationOffsets(cfg.formation).length;
      const totalRequested = clamp(Math.round(cfg.quantity), 1, 24);
      const batches = cfg.formation === 'solo' ? totalRequested : Math.max(1, Math.ceil(totalRequested / perBatch));
      let spawnedCount = 0;

      for (let b = 0; b < batches; b++) {
        const laneSpread = batches > 1 ? clamp(0.18 + (b / (batches - 1 || 1)) * 0.64, 0.12, 0.88) : clamp(cfg.lane, 0.1, 0.9);
        const batch = w.devSpawnEncounter(
          {
            family: cfg.family,
            formation: cfg.formation,
            motion: cfg.motion,
            lane: cfg.formation === 'solo' && batches > 1 ? laneSpread : cfg.lane,
            speed: cfg.speed,
            entry: cfg.entry,
          },
          {
            keepExisting: cfg.keepExisting || b > 0,
            x: b === 0 ? cfg.spawnX : undefined,
            y: b === 0 ? cfg.spawnY : undefined,
          },
        );
        spawnedCount += batch.length;
      }
      scene.refreshHudVisual();
      return spawnedCount;
    };
    const count = run();
    this.state.recordReplayAction(`Inimigos: ${cfg.family} ×${cfg.quantity} (${cfg.formation})`, () => {
      run();
    });
    return count;
  }

  runStressScenario(
    scene: ArcadeScene,
    preset: 'many-enemies' | 'many-bullets' | 'multi-helis' | 'explosions' | 'boss-components' | 'special-heavy',
    missionIndex = 0,
  ): string {
    this.state.beginTestSession(scene);
    const execute = () => {
      if (preset === 'boss-components') {
        this.runBoss(scene, missionIndex, false, { weaponLevel: 5, specialCharges: 5, invincible: true });
        return;
      }
      scene.devJumpToCheckpoint(missionIndex, 220, { pauseDirector: true });
      const w = scene.world!;
      w.devInvincible = true;
      w.weapons.weaponLevel = 5;
      w.weapons.specialCharges = 5;

      if (preset === 'many-enemies') {
        w.devSpawnEncounter({ family: 'fighter', formation: 'horde', motion: 'sine', lane: 0.35 }, { keepExisting: false });
        w.devSpawnEncounter({ family: 'interceptor', formation: 'horde', motion: 'zigzag', lane: 0.65 }, { keepExisting: true });
        w.devSpawnEncounter({ family: 'heli_scout', formation: 'trio', motion: 'side-cross', entry: 'left', lane: 0.25 }, { keepExisting: true });
      } else if (preset === 'many-bullets') {
        w.enemyFireRateScale = 3.2;
        w.devSpawnEncounter({ family: 'heli_phantom', formation: 'quartet', motion: 'curve', lane: 0.5 }, { keepExisting: false, y: 110 });
        w.devSpawnEncounter({ family: 'ship', formation: 'pair', motion: 'stationary', lane: 0.5 }, { keepExisting: true });
        for (let i = 0; i < 45; i++) w.step(1 / 60, { x: 0, y: 0, fire: true, special: false });
      } else if (preset === 'multi-helis') {
        w.devSpawnEncounter({ family: 'heli_scout', formation: 'pair', motion: 'sine', lane: 0.25 }, { keepExisting: false, y: 120 });
        w.devSpawnEncounter({ family: 'heli_utility', formation: 'pair', motion: 'stationary', lane: 0.5 }, { keepExisting: true, y: 135 });
        w.devSpawnEncounter({ family: 'heli_phantom', formation: 'pair', motion: 'curve', lane: 0.72 }, { keepExisting: true, y: 145 });
        w.devSpawnEncounter({ family: 'heli_warhawk', formation: 'solo', motion: 'curve', lane: 0.5 }, { keepExisting: true, y: 115 });
      } else if (preset === 'explosions') {
        w.devSpawnEncounter({ family: 'fighter', formation: 'horde', motion: 'sine', lane: 0.5 }, { keepExisting: false, y: 150 });
        for (const e of w.enemies) w.emit('explosion', e.x, e.y, 1.5, e.family);
      } else if (preset === 'special-heavy') {
        w.devSpawnEncounter({ family: 'heli_warhawk', formation: 'pair', motion: 'curve', lane: 0.5 }, { keepExisting: false, y: 120 });
        w.devSpawnEncounter({ family: 'interceptor', formation: 'horde', motion: 'sine', lane: 0.5 }, { keepExisting: true });
        w.devTriggerSpecial();
      }
      scene.refreshHudVisual();
    };
    execute();
    this.state.recordReplayAction(`Estresse: ${preset}`, execute);
    return preset;
  }

  runTimelineEvent(
    scene: ArcadeScene,
    missionIndex: number,
    eventId: string,
    opts?: { action?: 'go-to' | 'before' | 'run'; isolated?: boolean; leadSeconds?: number; seed?: number },
  ): string {
    this.state.beginTestSession(scene);
    const seed = opts?.seed ?? this.state.getPrefs().seed;
    const execute = () => scene.devRunStageEvent(missionIndex, eventId, { ...opts, seed });
    const res = execute();
    this.state.recordReplayAction(
      `Evento ${eventId} (${opts?.action ?? 'run'}, ${opts?.isolated ? 'Isolado' : 'Integrado'}, seed=${seed})`,
      () => {
        execute();
      },
    );
    return res.message;
  }

  /**
   * Runs a deterministic isolated simulation verifying that every boss stage and section advances
   * sequentially without skipping phases or stalling. Never touches saves or UI state.
   */
  verifyBossProgression(missionIndex: number): DevBossVerificationReport {
    const mission = MISSIONS[missionIndex] ?? MISSIONS[0];
    const world = new ArcadeWorld(mission);
    world.devInvincible = true;
    world.weapons.weaponLevel = 5;
    world.devStartBoss(false);

    const stepsCompleted: string[] = [];
    const expectedSteps: string[] = [];
    let lastSubSec = -1;
    let sawPhaseReturnOrTransition = false;

    if (world.boss?.sub) {
      for (let i = 0; i < world.boss.sub.sections.length; i++) expectedSteps.push(`section-${i + 1}`);
      expectedSteps.push('collapse', 'victory');
    } else {
      expectedSteps.push('fight-1', ...(mission.perspective === 'UP' ? ['retreat', 'return'] : []), 'sink', 'victory');
    }

    const dt = 1 / 60;
    for (let tick = 0; tick < 60 * 140; tick++) {
      const b = world.boss;
      if (b?.sub) {
        if (b.sub.phase === 'fight' && b.sub.activeSection !== lastSubSec) {
          lastSubSec = b.sub.activeSection;
          stepsCompleted.push(`section-${lastSubSec + 1}`);
        }
        if (b.sub.phase === 'transition') sawPhaseReturnOrTransition = true;
        if (b.sub.phase === 'collapse' && !stepsCompleted.includes('collapse')) stepsCompleted.push('collapse');
        // Deal controlled player DPS against active modules then hull to verify real state transitions
        if (b.sub.phase === 'fight') {
          const sec = b.sub.sections[b.sub.activeSection];
          const alivePart = sec.parts.find((p) => p.hp > 0);
          world.player.x = alivePart ? alivePart.x : b.x;
          if (tick % 6 === 0) {
            if (alivePart) {
              alivePart.hp = Math.max(0, alivePart.hp - 18);
            } else if (sec.hullHp > 0) {
              sec.hullHp = Math.max(0, sec.hullHp - 18);
            }
          }
        }
      } else if (b) {
        if (b.phase === 'fight' && b.configuration === 1 && !stepsCompleted.includes('fight-1')) stepsCompleted.push('fight-1');
        if (b.phase === 'retreat' && !stepsCompleted.includes('retreat')) stepsCompleted.push('retreat');
        if (b.phase === 'return' && !stepsCompleted.includes('return')) stepsCompleted.push('return');
        if (b.phase === 'sink' && !stepsCompleted.includes('sink')) stepsCompleted.push('sink');
        if (b.phase === 'fight') {
          const alivePart = b.parts.find((p) => p.hp > 0);
          if (alivePart) {
            if (world.up) world.player.x = alivePart.x;
            else world.player.y = alivePart.y;
            if (tick % 6 === 0) alivePart.hp = Math.max(0, alivePart.hp - 25);
          }
        }
      }
      world.step(dt, { x: 0, y: 0, fire: tick % 4 === 0, special: false });
      if (world.state === 'victory') {
        stepsCompleted.push('victory');
        break;
      }
    }

    const skippedSteps = expectedSteps.filter((s) => !stepsCompleted.includes(s));
    const subOk = !world.boss?.sub || sawPhaseReturnOrTransition || skippedSteps.length === 0;
    return {
      missionId: mission.id,
      missionName: mission.name,
      bossName: mission.boss,
      passed: skippedSteps.length === 0 && subOk && world.state === 'victory',
      stepsCompleted,
      skippedSteps,
      elapsedSeconds: Number(world.elapsed.toFixed(2)),
    };
  }
}
