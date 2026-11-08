import Phaser from 'phaser';
import { FONT_HUD, FONT_TECH, FONT_TITLE, GAME_HEIGHT, GAME_WIDTH } from '../constants';
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
      0x050d18,
      0.88,
    );

    const panel = scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      570,
      300,
      0x0a1626,
      0.95,
    ).setStrokeStyle(2, 0x00f0ff);

    const title = scene.add.text(
      GAME_WIDTH / 2,
      95,
      'MISSÃO CUMPRIDA!',
      {
        fontFamily: FONT_TITLE,
        fontSize: '24px',
        color: '#00f0ff',
        fontStyle: 'bold',
        letterSpacing: 2,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    const caption = scene.add.text(
      GAME_WIDTH / 2,
      136,
      `FASE 0${stageNumber}: ${stageDef.title.toUpperCase()}  //  ${stageDef.bossName.toUpperCase()} NEUTRALIZADO`,
      {
        fontFamily: FONT_TECH,
        fontSize: '12px',
        color: '#93c5fd',
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    const scoreText = scene.add.text(
      GAME_WIDTH / 2,
      168,
      'PONTUAÇÃO TOTAL: ' + score.toString().padStart(7, '0'),
      {
        fontFamily: FONT_HUD,
        fontSize: '20px',
        color: '#ffd166',
        fontStyle: 'bold',
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    const promptText = scene.add.text(
      GAME_WIDTH / 2,
      204,
      'ROTA DE CONTENÇÃO ESTABILIZADA. PRÓXIMAS COORDENADAS DESBLOQUEADAS.',
      {
        fontFamily: FONT_TECH,
        fontSize: '11px',
        color: '#64748b',
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    // Botão Próxima Fase [ENTER]
    const nextBtn = scene.add.rectangle(
      GAME_WIDTH / 2 - 165,
      262,
      160,
      38,
      0x0e7490,
      0.95,
    ).setStrokeStyle(2, 0x38bdf8).setInteractive({ useHandCursor: true });

    const nextText = scene.add.text(
      GAME_WIDTH / 2 - 165,
      262,
      'AVANÇAR [ENTER]',
      {
        fontFamily: FONT_HUD,
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
        letterSpacing: 1,
      },
    ).setOrigin(0.5).setResolution(2);

    nextBtn.on('pointerover', () => {
      nextBtn.setFillStyle(0x0284c7);
      nextBtn.setStrokeStyle(2, 0x7dd3fc);
    });
    nextBtn.on('pointerout', () => {
      nextBtn.setFillStyle(0x0e7490);
      nextBtn.setStrokeStyle(2, 0x38bdf8);
    });
    nextBtn.on('pointerdown', onNextStage);

    // Botão Rejogar [R]
    const replayBtn = scene.add.rectangle(
      GAME_WIDTH / 2,
      262,
      150,
      38,
      0x1e293b,
      0.95,
    ).setStrokeStyle(1, 0x475569).setInteractive({ useHandCursor: true });

    const replayText = scene.add.text(
      GAME_WIDTH / 2,
      262,
      'REJOGAR [R]',
      {
        fontFamily: FONT_HUD,
        fontSize: '13px',
        color: '#cbd5e1',
        fontStyle: 'bold',
        letterSpacing: 1,
      },
    ).setOrigin(0.5).setResolution(2);

    replayBtn.on('pointerover', () => {
      replayBtn.setFillStyle(0x334155);
      replayText.setColor('#ffffff');
    });
    replayBtn.on('pointerout', () => {
      replayBtn.setFillStyle(0x1e293b);
      replayText.setColor('#cbd5e1');
    });
    replayBtn.on('pointerdown', onReplay);

    // Botão Fases [ESC]
    const selectBtn = scene.add.rectangle(
      GAME_WIDTH / 2 + 165,
      262,
      160,
      38,
      0x1e293b,
      0.95,
    ).setStrokeStyle(1, 0x475569).setInteractive({ useHandCursor: true });

    const selectText = scene.add.text(
      GAME_WIDTH / 2 + 165,
      262,
      'FASES [ESC]',
      {
        fontFamily: FONT_HUD,
        fontSize: '13px',
        color: '#cbd5e1',
        fontStyle: 'bold',
        letterSpacing: 1,
      },
    ).setOrigin(0.5).setResolution(2);

    selectBtn.on('pointerover', () => {
      selectBtn.setFillStyle(0x334155);
      selectText.setColor('#ffffff');
    });
    selectBtn.on('pointerout', () => {
      selectBtn.setFillStyle(0x1e293b);
      selectText.setColor('#cbd5e1');
    });
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
}
