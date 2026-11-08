import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

/** Overlay centralizado na nova resolução; mantém escolhas de reinício/piloto. */
export class GameOverOverlay extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, score: number, onRestart: () => void, onChoosePilot: () => void) {
    super(scene, 0, 0);
    const backdrop = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x060e1b, 0.87);
    const panel = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 420, 268, 0x172739)
      .setStrokeStyle(2, 0x7bd3d0);

    const title = this.label(scene, GAME_WIDTH / 2, 111, 'GAME OVER', 37, '#ffb780').setOrigin(0.5, 0);
    const points = this.label(scene, GAME_WIDTH / 2, 165, 'SCORE FINAL: ' + score.toString().padStart(6, '0'),
      19, '#e4f2fa').setOrigin(0.5, 0);
    const replay = scene.add.rectangle(GAME_WIDTH / 2, 230, 268, 40, 0x2d6877)
      .setStrokeStyle(1, 0x9cfcf0).setInteractive({ useHandCursor: true });
    const replayText = this.label(scene, GAME_WIDTH / 2, 218, 'JOGAR NOVAMENTE [R]', 18, '#ffffff')
      .setOrigin(0.5, 0);
    replay.on('pointerdown', onRestart);
    const change = scene.add.rectangle(GAME_WIDTH / 2, 286, 268, 40, 0x29465b)
      .setStrokeStyle(1, 0x8cacc1).setInteractive({ useHandCursor: true });
    const changeText = this.label(scene, GAME_WIDTH / 2, 274, 'TROCAR PILOTO [ESC]', 18, '#ffffff')
      .setOrigin(0.5, 0);
    change.on('pointerdown', onChoosePilot);

    this.add([backdrop, panel, title, points, replay, replayText, change, changeText]);
    this.setDepth(100);
    scene.add.existing(this);
  }

  private label(
    scene: Phaser.Scene, x: number, y: number, value: string, size: number, color: string,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, value, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: size + 'px', color, fontStyle: 'bold',
    }).setResolution(2);
  }
}
