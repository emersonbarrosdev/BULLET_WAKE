import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

const resizeHandlers = new WeakMap<Phaser.Scene, () => void>();
const virtualSizes = new WeakMap<Phaser.Scene, { w: number; h: number; cx?: number; cy?: number }>();

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
    const v = getCombatVirtualSize(scene);
    const parent = scene.game.canvas?.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width <= 0 || height <= 0) return;
    scene.scale.setGameSize(width, height);
    scene.cameras.main
      .setViewport(0, 0, width, height)
      .setSize(width, height)
      .setZoom(width / v.w, height / v.h)
      .centerOn(v.cx ?? v.w / 2, v.cy ?? v.h / 2);
  };
  resizeHandlers.set(scene, resize);
  resize();
  window.addEventListener('resize', resize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('resize', resize);
    resizeHandlers.delete(scene);
    virtualSizes.delete(scene);
    scene.scale.setGameSize(GAME_WIDTH, GAME_HEIGHT);
  });
}
