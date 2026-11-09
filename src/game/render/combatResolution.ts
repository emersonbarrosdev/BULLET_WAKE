import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

/** Fill the viewport at native resolution, retaining the 768×432 world. */
export function enableCombatResolution(scene: Phaser.Scene): void {
  const resize = (): void => {
    const parent = scene.game.canvas.parentElement!;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    scene.scale.setGameSize(width, height);
    scene.cameras.main.setSize(width, height)
      .setZoom(width / GAME_WIDTH, height / GAME_HEIGHT)
      .centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  };
  resize();
  window.addEventListener('resize', resize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('resize', resize);
    scene.scale.setGameSize(GAME_WIDTH, GAME_HEIGHT);
  });
}
