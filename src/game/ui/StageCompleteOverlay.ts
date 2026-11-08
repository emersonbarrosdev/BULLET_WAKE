import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

/** Tela de vitória de fase com pontuação, bônus e transição de missão. */
export class StageCompleteOverlay extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    score: number,
    onReplay: () => void,
    onChoosePilot: () => void,
  ) {
    super(scene, 0, 0);

    const backdrop = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x07111c,
      0.88,
    );

    const panel = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      540,
      290,
      0x132435,
    ).setStrokeStyle(2, 0x64ded4);

    const title = this.text(
      scene,
      GAME_WIDTH / 2,
      100,
      'MISSAO CUMPRIDA!',
      30,
      '#7bf7ea',
    ).setOrigin(0.5, 0);

    const caption = this.text(
      scene,
      GAME_WIDTH / 2,
      142,
      'FASE 01: CINTURAO DE FERRUGEM  /  KRM-17 DESTRUÍDO',
      15,
      '#dbebf5',
    ).setOrigin(0.5, 0);

    const scoreText = this.text(
      scene,
      GAME_WIDTH / 2,
      176,
      'PONTUACAO TOTAL: ' + score.toString().padStart(6, '0'),
      21,
      '#ffd494',
    ).setOrigin(0.5, 0);

    const promptText = this.text(
      scene,
      GAME_WIDTH / 2,
      214,
      'ROTA DE EVACUACAO PROTEGIDA. COORDENADAS DO WAKE LOCALIZADAS.',
      12,
      '#a2c7dc',
    ).setOrigin(0.5, 0);

    // Botões
    const replayButton = scene.add.rectangle(
      GAME_WIDTH / 2 - 130,
      268,
      210,
      40,
      0x275a68,
    ).setStrokeStyle(1, 0x76eae0).setInteractive({ useHandCursor: true });

    const replayText = this.text(
      scene,
      GAME_WIDTH / 2 - 130,
      258,
      'REJOGAR FASE [R]',
      16,
      '#ffffff',
    ).setOrigin(0.5, 0);

    replayButton.on('pointerover', () => replayButton.setFillStyle(0x347c8f));
    replayButton.on('pointerout', () => replayButton.setFillStyle(0x275a68));
    replayButton.on('pointerdown', onReplay);

    const pilotButton = scene.add.rectangle(
      GAME_WIDTH / 2 + 130,
      268,
      210,
      40,
      0x243e54,
    ).setStrokeStyle(1, 0x8baec9).setInteractive({ useHandCursor: true });

    const pilotText = this.text(
      scene,
      GAME_WIDTH / 2 + 130,
      258,
      'TROCAR PILOTO [ESC]',
      16,
      '#ffffff',
    ).setOrigin(0.5, 0);

    pilotButton.on('pointerover', () => pilotButton.setFillStyle(0x335773));
    pilotButton.on('pointerout', () => pilotButton.setFillStyle(0x243e54));
    pilotButton.on('pointerdown', onChoosePilot);

    this.add([
      backdrop,
      panel,
      title,
      caption,
      scoreText,
      promptText,
      replayButton,
      replayText,
      pilotButton,
      pilotText,
    ]);
    this.setDepth(100);
    scene.add.existing(this);
  }

  private text(
    scene: Phaser.Scene,
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, value, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: size + 'px',
      color,
      fontStyle: 'bold',
    }).setResolution(2);
  }
}
