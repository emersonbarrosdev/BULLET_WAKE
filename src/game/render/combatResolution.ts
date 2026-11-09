import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants';

/** Render Nolan's painted art in Full HD while keeping all world units unchanged. */
export function enableCombatResolution(scene: Phaser.Scene): void {
  const factor = 2.5;
  scene.scale.setGameSize(GAME_WIDTH * factor, GAME_HEIGHT * factor);
  scene.cameras.main.setSize(GAME_WIDTH * factor, GAME_HEIGHT * factor);
  scene.cameras.main.setZoom(factor).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.setGameSize(GAME_WIDTH, GAME_HEIGHT);
  });
}
