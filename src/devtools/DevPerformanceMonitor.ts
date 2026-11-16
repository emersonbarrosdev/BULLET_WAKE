import type Phaser from 'phaser';
import type { ArcadeScene } from '../game/arcade/ArcadeScene.ts';
import type { DevPerfReport } from './types.ts';

/**
 * Non-intrusive real-time frame timing, WebGL renderer & entity profiler.
 * Distinguishes automated/controlled stress runs from live interactive gameplay.
 */
export class DevPerformanceMonitor {
  private readonly samples: number[] = [];
  private recording = false;
  private recordKind: 'interactive' | 'controlled-simulation' = 'interactive';
  private recordScenarioName = 'Sessão Livre';
  private recordedFrames: number[] = [];
  private recordStartMs = 0;
  private lastDeltaMs = 16.67;

  recordFrame(deltaMs: number): void {
    const clean = Number.isFinite(deltaMs) && deltaMs > 0 ? Math.min(250, deltaMs) : 16.67;
    this.lastDeltaMs = clean;
    this.samples.push(clean);
    if (this.samples.length > 240) this.samples.shift();
    if (this.recording) {
      this.recordedFrames.push(clean);
    }
  }

  clear(): void {
    this.samples.length = 0;
    this.recordedFrames.length = 0;
  }

  isRecording(): boolean {
    return this.recording;
  }

  startRecording(scenarioName: string, kind: 'interactive' | 'controlled-simulation'): void {
    this.recordedFrames = [];
    this.recording = true;
    this.recordScenarioName = scenarioName;
    this.recordKind = kind;
    this.recordStartMs = performance.now();
  }

  stopRecording(game: Phaser.Game, scene?: ArcadeScene): DevPerfReport {
    this.recording = false;
    const durationSeconds = Math.max(0.01, (performance.now() - this.recordStartMs) / 1000);
    return this.buildReport(game, scene, this.recordedFrames.length ? this.recordedFrames : this.samples, {
      measurementKind: this.recordKind,
      scenarioName: this.recordScenarioName,
      durationSeconds,
    });
  }

  snapshot(game: Phaser.Game, scene?: ArcadeScene, label = 'Telemetria ao vivo'): DevPerfReport {
    const frames = this.samples.length ? this.samples : [this.lastDeltaMs];
    const sumMs = frames.reduce((a, b) => a + b, 0);
    return this.buildReport(game, scene, frames, {
      measurementKind: 'interactive',
      scenarioName: label,
      durationSeconds: Number((sumMs / 1000).toFixed(2)),
    });
  }

  private buildReport(
    game: Phaser.Game,
    scene: ArcadeScene | undefined,
    rawFrames: readonly number[],
    meta: { measurementKind: 'interactive' | 'controlled-simulation'; scenarioName: string; durationSeconds: number },
  ): DevPerfReport {
    const sorted = [...rawFrames].sort((a, b) => a - b);
    const avgMs = sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length);
    const medianMs = sorted[Math.floor(sorted.length * 0.5)] ?? avgMs;
    const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? avgMs;
    const p99Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? avgMs;

    const w = scene?.world;
    const spriteStats = scene?.devInspectSprites();
    const activeBullets = w ? w.bullets.filter((b) => b.active).length : 0;

    let rendererInfo = `Phaser Renderer (${game.renderer.type === 2 ? 'WebGL' : 'Canvas'})`;
    try {
      const gl = (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      if (ext && gl) {
        const gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        if (gpu) rendererInfo = String(gpu);
      }
    } catch {
      // Optional WebGL debug extension
    }

    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const heapMb = mem ? Number((mem.usedJSHeapSize / (1024 * 1024)).toFixed(1)) : null;

    return {
      generatedAt: new Date().toISOString(),
      measurementKind: meta.measurementKind,
      scenarioName: meta.scenarioName,
      missionId: w ? w.mission.id : null,
      quality: scene?.quality ?? 2,
      resolution: `${game.canvas?.width ?? 768}x${game.canvas?.height ?? 432}`,
      durationSeconds: Number(meta.durationSeconds.toFixed(2)),
      frames: sorted.length,
      currentFps: Number((1000 / Math.max(1, this.lastDeltaMs)).toFixed(1)),
      avgFps: Number((1000 / Math.max(1, avgMs)).toFixed(1)),
      avgMs: Number(avgMs.toFixed(2)),
      medianMs: Number(medianMs.toFixed(2)),
      p95Ms: Number(p95Ms.toFixed(2)),
      p99Ms: Number(p99Ms.toFixed(2)),
      enemies: w ? w.enemies.filter((e) => e.hp > 0).length : 0,
      bullets: activeBullets,
      objects: spriteStats?.children ?? (scene?.children.length ?? 0),
      effects: spriteStats?.effects ?? 0,
      heapMb,
      rendererInfo,
    };
  }
}
