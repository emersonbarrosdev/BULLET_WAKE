import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

/** Tela de fim de tentativa com reinício por clique/toque ou tecla R. */
export class GameOverOverlay extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, score: number, onRestart: () => void) {
    super(scene, 0, 0);

    const blackout = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x080f19, 0.84,
    );
    const panel = scene.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, 290, 144, 0x15263a,
    ).setStrokeStyle(2, 0x77d5d1);

    const header = this.label(scene, GAME_WIDTH / 2, 62, 'GAME OVER', 27, '#f4b77a')
      .setOrigin(0.5, 0);
    const caption = this.label(
      scene, GAME_WIDTH / 2, 100, 'PONTUACAO FINAL: ' + score.toString().padStart(6, '0'),
      12, '#edf5fa',
    ).setOrigin(0.5, 0);
    const button = scene.add.rectangle(
      GAME_WIDTH / 2, 146, 190, 29, 0x2c6472,
    ).setStrokeStyle(1, 0x80e3d7).setInteractive({ useHandCursor: true });
    const buttonText = this.label(
      scene, GAME_WIDTH / 2, 137, 'JOGAR NOVAMENTE', 14, '#f9ffff',
    ).setOrigin(0.5, 0);
    const hint = this.label(
      scene, GAME_WIDTH / 2, 171, 'APERTE R OU CLIQUE NO BOTAO', 9, '#c0d5df',
    ).setOrigin(0.5, 0);

    button.on('pointerover', () => button.setFillStyle(0x377e89));
    button.on('pointerout', () => button.setFillStyle(0x2c6472));
    button.on('pointerdown', onRestart);

    this.add([blackout, panel, header, caption, button, buttonText, hint]);
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
