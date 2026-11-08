import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { STAGES } from '../data/stages';

/** Tela de vitória de fase com pontuação, bônus e transição de missão. */
export class StageCompleteOverlay extends Phaser.GameObjects.Container {
  constructor(
    scene: Phaser.Scene,
    stageNumber: number,
    score: number,
    onNextStage: () => void,
    onReplay: () => void,
    onStageSelect: () => void,
  ) {
    super(scene, 0, 0);

    const stageDef = STAGES[stageNumber - 1] || STAGES[0];

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
      560,
      300,
      0x132435,
    ).setStrokeStyle(2, 0x64ded4);

    const title = this.text(
      scene,
      GAME_WIDTH / 2,
      95,
      'MISSÃO CUMPRIDA!',
      30,
      '#7bf7ea',
    ).setOrigin(0.5, 0);

    const caption = this.text(
      scene,
      GAME_WIDTH / 2,
      138,
      `FASE 0${stageNumber}: ${stageDef.title.toUpperCase()}  /  ${stageDef.bossName.toUpperCase()} CONTIDO`,
      14,
      '#dbebf5',
    ).setOrigin(0.5, 0);

    const scoreText = this.text(
      scene,
      GAME_WIDTH / 2,
      172,
      'PONTUAÇÃO TOTAL: ' + score.toString().padStart(6, '0'),
      20,
      '#ffd494',
    ).setOrigin(0.5, 0);

    const promptText = this.text(
      scene,
      GAME_WIDTH / 2,
      206,
      'ROTA DE CONTENÇÃO ESTABILIZADA. PRÓXIMAS COORDENADAS DESBLOQUEADAS.',
      12,
      '#a2c7dc',
    ).setOrigin(0.5, 0);

    // Botões
    const nextBtn = scene.add.rectangle(
      GAME_WIDTH / 2 - 165,
      262,
      160,
      38,
      0x276a77,
    ).setStrokeStyle(2, 0x8df5ea).setInteractive({ useHandCursor: true });

    const nextText = this.text(
      scene,
      GAME_WIDTH / 2 - 165,
      252,
      'AVANÇAR [ENTER]',
      14,
      '#ffffff',
    ).setOrigin(0.5, 0);

    nextBtn.on('pointerover', () => nextBtn.setFillStyle(0x328a9b));
    nextBtn.on('pointerout', () => nextBtn.setFillStyle(0x276a77));
    nextBtn.on('pointerdown', onNextStage);

    const replayBtn = scene.add.rectangle(
      GAME_WIDTH / 2,
      262,
      150,
      38,
      0x1e3f52,
    ).setStrokeStyle(1, 0x60a0b8).setInteractive({ useHandCursor: true });

    const replayText = this.text(
      scene,
      GAME_WIDTH / 2,
      252,
      'REJOGAR [R]',
      14,
      '#ffffff',
    ).setOrigin(0.5, 0);

    replayBtn.on('pointerover', () => replayBtn.setFillStyle(0x285670));
    replayBtn.on('pointerout', () => replayBtn.setFillStyle(0x1e3f52));
    replayBtn.on('pointerdown', onReplay);

    const selectBtn = scene.add.rectangle(
      GAME_WIDTH / 2 + 165,
      262,
      160,
      38,
      0x192e40,
    ).setStrokeStyle(1, 0x487994).setInteractive({ useHandCursor: true });

    const selectText = this.text(
      scene,
      GAME_WIDTH / 2 + 165,
      252,
      'FASES [ESC]',
      14,
      '#ffffff',
    ).setOrigin(0.5, 0);

    selectBtn.on('pointerover', () => selectBtn.setFillStyle(0x24425b));
    selectBtn.on('pointerout', () => selectBtn.setFillStyle(0x192e40));
    selectBtn.on('pointerdown', onStageSelect);

    this.add([
      backdrop,
      panel,
      title,
      caption,
      scoreText,
      promptText,
      nextBtn,
      nextText,
      replayBtn,
      replayText,
      selectBtn,
      selectText,
    ]);
    this.setDepth(100);
    scene.add.existing(this);

    // Teclado
    const kb = scene.input.keyboard;
    if (kb) {
      kb.once('keydown-ENTER', onNextStage);
      kb.once('keydown-SPACE', onNextStage);
      kb.once('keydown-R', onReplay);
      kb.once('keydown-ESC', onStageSelect);
    }
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
