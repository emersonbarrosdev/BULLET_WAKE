import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

/** Encerramento honesto do trecho de teste; boss e fase completa virão depois. */
export class StageCompleteOverlay extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene, score: number,
    onReplay: () => void, onChoosePilot: () => void,
  ) {
    super(scene, 0, 0);
    const backdrop = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x081522, 0.86);
    const panel = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 490, 270, 0x172c3b)
      .setStrokeStyle(2, 0x7be1d6);
    const title = this.text(scene, GAME_WIDTH / 2, 109, 'TRECHO CONCLUIDO', 31, '#9aede0').setOrigin(0.5, 0);
    const caption = this.text(scene, GAME_WIDTH / 2, 156, 'CINTURAO DE FERRUGEM  /  DEMO', 16, '#e6f0f7').setOrigin(0.5, 0);
    const scoreText = this.text(scene, GAME_WIDTH / 2, 186, 'SCORE ' + score.toString().padStart(6, '0'),
      20, '#ffcb95').setOrigin(0.5, 0);
    const button = scene.add.rectangle(GAME_WIDTH / 2 - 124, 270, 213, 42, 0x326e75)
      .setStrokeStyle(1, 0x9efcf3).setInteractive({ useHandCursor: true });
    const buttonText = this.text(scene, GAME_WIDTH / 2 - 124, 258, 'REJOGAR [R]', 17, '#ffffff').setOrigin(0.5, 0);
    button.on('pointerdown', onReplay);
    const choice = scene.add.rectangle(GAME_WIDTH / 2 + 124, 270, 213, 42, 0x31516a)
      .setStrokeStyle(1, 0xa1bbd4).setInteractive({ useHandCursor: true });
    const choiceText = this.text(scene, GAME_WIDTH / 2 + 124, 258, 'PILOTOS [ESC]', 17, '#ffffff').setOrigin(0.5, 0);
    choice.on('pointerdown', onChoosePilot);
    const note = this.text(scene, GAME_WIDTH / 2, 316, 'A FASE COMPLETA E O CHEFE ESTAO EM DESENVOLVIMENTO', 12, '#bdd0dc')
      .setOrigin(0.5, 0);
    this.add([backdrop, panel, title, caption, scoreText, button, buttonText, choice, choiceText, note]);
    this.setDepth(100);
    scene.add.existing(this);
  }

  private text(
    scene: Phaser.Scene, x: number, y: number, value: string, size: number, color: string,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, value, {
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: size + 'px', color, fontStyle: 'bold',
    }).setResolution(2);
  }
}
