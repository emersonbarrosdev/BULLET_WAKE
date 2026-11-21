import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

const resizeHandlers = new WeakMap<Phaser.Scene, () => void>();
const virtualSizes = new WeakMap<Phaser.Scene, { w: number; h: number; cx?: number; cy?: number }>();
const leftInsets = new WeakMap<Phaser.Scene, number>();

/** Reserve a mobile sidebar outside the world camera, including camera/input coordinates. */
export function setCombatLeftInset(scene: Phaser.Scene, fraction: number): void {
  if ((leftInsets.get(scene) ?? 0) === fraction) return;
  leftInsets.set(scene, fraction);
  resizeHandlers.get(scene)?.();
}

/** Render above CSS resolution on dense phone displays, with a bounded GPU budget. */
export function renderPixelRatio(): number {
  return Math.min(2, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
}

/** Returns current logical/virtual world bounds rendered by the scene camera. */
export function getCombatVirtualSize(scene: Phaser.Scene): { w: number; h: number; cx?: number; cy?: number } {
  return virtualSizes.get(scene) ?? { w: GAME_WIDTH, h: GAME_HEIGHT };
}

/** Updates logical world dimensions while keeping crisp native canvas scaling across the viewport. */
export function setCombatVirtualSize(scene: Phaser.Scene, w: number, h: number, cx?: number, cy?: number): void {
  const prev = virtualSizes.get(scene);
  if (prev && prev.w === w && prev.h === h && prev.cx === cx && prev.cy === cy) return;
  virtualSizes.set(scene, { w, h, cx, cy });
  resizeHandlers.get(scene)?.();
}

/** Fill the viewport at native resolution, retaining the active virtual world size. */
export function enableCombatResolution(scene: Phaser.Scene): void {
  const existing = resizeHandlers.get(scene);
  if (existing) {
    existing();
    return;
  }

  const resize = (): void => {
    const parent = scene.game.canvas?.parentElement;
    if (!parent) return;
    const width = Math.round(parent.clientWidth * renderPixelRatio());
    const height = Math.round(parent.clientHeight * renderPixelRatio());
    if (width <= 0 || height <= 0) return;
    scene.scale.setGameSize(width, height);
    // Scale listeners may update mobile layout synchronously; use their final dimensions.
    const v = getCombatVirtualSize(scene);
    const left = Math.round(width * (leftInsets.get(scene) ?? 0));
    scene.cameras.main
      .setViewport(left, 0, width - left, height)
      .setSize(width - left, height)
      .setZoom(Math.min((width - left) / v.w, height / v.h))
      .centerOn(v.cx ?? v.w / 2, v.cy ?? v.h / 2);
  };
  resizeHandlers.set(scene, resize);
  resize();
  window.addEventListener('resize', resize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('resize', resize);
    resizeHandlers.delete(scene);
    virtualSizes.delete(scene);
    leftInsets.delete(scene);
    scene.scale.setGameSize(GAME_WIDTH, GAME_HEIGHT);
  });
}
