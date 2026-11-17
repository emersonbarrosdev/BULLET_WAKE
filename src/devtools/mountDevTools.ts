import Phaser from 'phaser';
import type { ArcadeScene } from '../game/arcade/ArcadeScene';
import { DevAnimationPreviewer } from './DevAnimationPreviewer';
import { DevCollisionOverlay } from './DevCollisionOverlay';
import { DevCombatControls } from './DevCombatControls';
import { DevEventLogger } from './DevEventLogger';
import { DevPerformanceMonitor } from './DevPerformanceMonitor';
import { DevScenarioRegistry } from './DevScenarioRegistry';
import { DevScenarioRunner } from './DevScenarioRunner';
import { DevStateManager } from './DevStateManager';
import { DevToolsPanel } from './DevToolsPanel';

export interface DevToolsGlobalApi {
  readonly panel: DevToolsPanel;
  readonly state: DevStateManager;
  readonly registry: DevScenarioRegistry;
  readonly runner: DevScenarioRunner;
  readonly combat: DevCombatControls;
  readonly collisions: DevCollisionOverlay;
  readonly logger: DevEventLogger;
  readonly perf: DevPerformanceMonitor;
  readonly previewer: DevAnimationPreviewer;
  getScene(): ArcadeScene | undefined;
}

/**
 * Mounts the full dev-only instrumentation & visual DevTools overlay inside `npm run dev`.
 * Compiled out cleanly in every production or alternative `vite build`.
 */
export function mountDevTools(game: Phaser.Game, phaserLib: typeof Phaser): () => void {
  const getScene = (): ArcadeScene | undefined => {
    try {
      return game.scene.getScene('ArcadeScene') as ArcadeScene | undefined;
    } catch {
      return undefined;
    }
  };

  const state = new DevStateManager();
  const registry = new DevScenarioRegistry();
  const combat = new DevCombatControls();
  const runner = new DevScenarioRunner(registry, state, combat);
  const collisions = new DevCollisionOverlay();
  const logger = new DevEventLogger();
  const perf = new DevPerformanceMonitor();
  const previewer = new DevAnimationPreviewer();

  const panel = new DevToolsPanel({
    game,
    getScene,
    state,
    registry,
    runner,
    combat,
    collisions,
    logger,
    perf,
    previewer,
  });

  const api: DevToolsGlobalApi = {
    panel,
    state,
    registry,
    runner,
    combat,
    collisions,
    logger,
    perf,
    previewer,
    getScene,
  };

  const win = window as unknown as {
    __GAME__?: Phaser.Game;
    Phaser?: typeof Phaser;
    __BW_DEVTOOLS__?: DevToolsGlobalApi;
  };
  win.__GAME__ = game;
  win.Phaser = phaserLib;
  win.__BW_DEVTOOLS__ = api;

  let attachedScene: ArcadeScene | undefined;
  let hudTickCounter = 0;

  const ensureSceneHooks = () => {
    const sc = getScene();
    if (!sc || sc === attachedScene) return;
    attachedScene = sc;
    sc.setDevSaveGuard(state.isTestSessionActive());
    sc.setDevHandlers({
      onEscape: () => {
        if (panel.isFocused()) {
          panel.setOpen(false);
          return true;
        }
        return false;
      },
      onRender: (activeScene, deltaMs) => {
        perf.recordFrame(deltaMs);
        logger.observeScene(activeScene);
        collisions.draw(activeScene);
        hudTickCounter++;
        if (hudTickCounter % 4 === 0) panel.tickVisualUpdate();
      },
    });
  };

  const onStep = () => {
    ensureSceneHooks();
    if (!attachedScene || attachedScene.screen === 'title' || attachedScene.screen === 'missions') {
      hudTickCounter++;
      if (hudTickCounter % 6 === 0) panel.tickVisualUpdate();
    }
  };
  game.events.on(Phaser.Core.Events.POST_STEP, onStep);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'F9') {
      e.preventDefault();
      panel.toggleOpen();
    } else if (e.key === 'Escape' && panel.isFocused()) {
      e.stopPropagation();
      panel.setOpen(false);
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
    game.events.off(Phaser.Core.Events.POST_STEP, onStep);
    attachedScene?.setDevHandlers({});
    state.endTestSession(attachedScene);
    collisions.destroy();
    panel.destroy();
    delete win.__BW_DEVTOOLS__;
    delete win.__GAME__;
    delete win.Phaser;
  };
}
