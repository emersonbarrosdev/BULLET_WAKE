import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

/** Fim de tentativa: repetir com piloto atual ou voltar à seleção. */
export class GameOverOverlay extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    score: number,
    onRestart: () => void,
    onChoosePilot: () => void,
  ) {
    super(scene, 0, 0);

    const blackout = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x080f19, 0.88,
    );
    const panel = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, 290, 168, 0x15263a,
    ).setStrokeStyle(2, 0x77d5d1);

    const header = this.label(scene, GAME_WIDTH / 2, 47, 'GAME OVER', 27, '#f4b77a')
      .setOrigin(0.5, 0);
    const caption = this.label(
      scene, GAME_WIDTH / 2, 86, 'PONTUACAO FINAL: ' + score.toString().padStart(6, '0'),
      12, '#edf5fa',
    ).setOrigin(0.5, 0);

    const again = scene.add.rectangle(
      GAME_WIDTH / 2, 127, 190, 28, 0x2c6472,
    ).setStrokeStyle(1, 0x80e3d7).setInteractive({ useHandCursor: true });
    const againText = this.label(scene, GAME_WIDTH / 2, 119, 'JOGAR NOVAMENTE', 13, '#f9ffff')
      .setOrigin(0.5, 0);
    again.on('pointerdown', onRestart);

    const choose = scene.add.rectangle(
      GAME_WIDTH / 2, 163, 190, 26, 0x29445b,
    ).setStrokeStyle(1, 0x8cacc1).setInteractive({ useHandCursor: true });
    const chooseText = this.label(scene, GAME_WIDTH / 2, 156, 'TROCAR PILOTO', 13, '#f9ffff')
      .setOrigin(0.5, 0);
    choose.on('pointerdown', onChoosePilot);

    const hint = this.label(scene, GAME_WIDTH / 2, 192, 'R: REPETIR     ESC: PILOTOS', 10, '#c0d5df')
      .setOrigin(0.5, 0);

    this.add([
      blackout, panel, header, caption, again, againText, choose, chooseText, hint,
    ]);
    this.setDepth(100);
    scene.add.existing(this);
  }

  private label(
    scene: Phaser.Scene, x: number, y: number, text: string, size: number, color: string,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, text, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: size + 'px',
      color,
      fontStyle: 'bold',
    }).setResolution(3);
  }
}
