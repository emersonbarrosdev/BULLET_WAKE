import type { ArcadeScene } from '../game/arcade/ArcadeScene.ts';
import type { DevPanelTab, DevScenario, DevScenarioOptions, DevToolsPrefs } from './types.ts';

const DEV_PREFS_STORAGE_KEY = 'bullet_wake_devtools_prefs_v1';

function defaultPrefs(): DevToolsPrefs {
  return {
    open: false,
    minimized: false,
    activeTab: 'stages',
    x: 16,
    y: 16,
    seed: 1337,
    sandboxIsolated: true,
  };
}

/**
 * Manages temporary debug test sessions, save isolation guards, scenario replay state,
 * and dev-only panel layout preferences (strictly separated from campaign saves).
 */
export class DevStateManager {
  private prefs: DevToolsPrefs;
  private testSessionActive = false;
  private lastScenario?: { scenario: DevScenario; options?: DevScenarioOptions };
  private lastActionFn?: () => void;
  private lastActionLabel = 'Nenhum cenário executado ainda';
  private snapshotQuality?: number;

  constructor() {
    this.prefs = this.loadPrefs();
  }

  private loadPrefs(): DevToolsPrefs {
    const def = defaultPrefs();
    try {
      if (typeof window === 'undefined' || !window.localStorage) return def;
      const raw = window.localStorage.getItem(DEV_PREFS_STORAGE_KEY);
      if (!raw) return def;
      const parsed = JSON.parse(raw) as Partial<DevToolsPrefs>;
      return {
        open: Boolean(parsed.open),
        minimized: Boolean(parsed.minimized),
        activeTab: (parsed.activeTab ?? def.activeTab) as DevPanelTab,
        x: typeof parsed.x === 'number' && Number.isFinite(parsed.x) ? Math.max(4, parsed.x) : def.x,
        y: typeof parsed.y === 'number' && Number.isFinite(parsed.y) ? Math.max(4, parsed.y) : def.y,
        seed: typeof parsed.seed === 'number' && Number.isFinite(parsed.seed) ? Math.floor(parsed.seed) : def.seed,
        sandboxIsolated: typeof parsed.sandboxIsolated === 'boolean' ? parsed.sandboxIsolated : def.sandboxIsolated,
      };
    } catch {
      return def;
    }
  }

  private savePrefs(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(DEV_PREFS_STORAGE_KEY, JSON.stringify(this.prefs));
      }
    } catch {
      // Optional storage in restricted contexts
    }
  }

  getPrefs(): Readonly<DevToolsPrefs> {
    return this.prefs;
  }

  updatePrefs(patch: Partial<DevToolsPrefs>): void {
    this.prefs = { ...this.prefs, ...patch };
    this.savePrefs();
  }

  isTestSessionActive(): boolean {
    return this.testSessionActive;
  }

  beginTestSession(scene?: ArcadeScene): void {
    if (!this.testSessionActive && scene) {
      this.snapshotQuality = scene.quality;
    }
    this.testSessionActive = true;
    scene?.setDevSaveGuard(true);
  }

  endTestSession(scene?: ArcadeScene): void {
    this.testSessionActive = false;
    if (scene) {
      scene.setDevSaveGuard(false);
      scene.setDevSimulationPaused(false);
      scene.setDevTimeScale(1);
      if (this.snapshotQuality !== undefined) {
        scene.setDevQuality(this.snapshotQuality);
        this.snapshotQuality = undefined;
      }
    }
  }

  recordScenario(scenario: DevScenario, options?: DevScenarioOptions): void {
    this.lastScenario = { scenario, options };
    this.lastActionLabel = scenario.name;
    this.lastActionFn = undefined;
  }

  recordReplayAction(label: string, fn: () => void): void {
    this.lastActionLabel = label;
    this.lastActionFn = fn;
    this.lastScenario = undefined;
  }

  getLastLabel(): string {
    return this.lastActionLabel;
  }

  hasReplay(): boolean {
    return Boolean(this.lastScenario || this.lastActionFn);
  }

  replayLast(scene: ArcadeScene): boolean {
    this.beginTestSession(scene);
    if (this.lastScenario) {
      this.lastScenario.scenario.cleanup(scene);
      this.lastScenario.scenario.initialize(scene, this.lastScenario.options);
      return true;
    }
    if (this.lastActionFn) {
      this.lastActionFn();
      return true;
    }
    return false;
  }
}
