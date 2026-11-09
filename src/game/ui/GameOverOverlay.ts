import Phaser from 'phaser';
import { FONT_HUD, FONT_TECH, FONT_TITLE, GAME_HEIGHT, GAME_WIDTH } from '../constants';

/** Overlay de Game Over com estética sci-fi e tipografia arcade moderna. */
export class GameOverOverlay extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, score: number, onRestart: () => void, onChoosePilot: () => void) {
    super(scene, 0, 0);

    const backdrop = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050a14, 0.88);

    const panel = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 460, 270, 0x0b1626, 0.94)
      .setStrokeStyle(2, 0xff4d6d);

    const title = scene.add.text(GAME_WIDTH / 2, 108, 'SISTEMA COMPROMETIDO', {
      fontFamily: FONT_TITLE,
      fontSize: '23px',
      color: '#ff4d6d',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(3);

    const subTitle = scene.add.text(GAME_WIDTH / 2, 142, '// AERONAVE ABATIDA EM COMBATE //', {
      fontFamily: FONT_TECH,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fda4af',
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(3);

    const points = scene.add.text(GAME_WIDTH / 2, 175, 'SCORE FINAL: ' + score.toString().padStart(7, '0'), {
      fontFamily: FONT_HUD,
      fontSize: '19px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setResolution(3);

    // Botão Replay [R]
    const replay = scene.add.rectangle(GAME_WIDTH / 2, 235, 290, 38, 0x1e3a5f, 0.95)
      .setStrokeStyle(1.5, 0x38bdf8).setInteractive({ useHandCursor: true });
    const replayText = scene.add.text(GAME_WIDTH / 2, 235, 'REINICIAR MISSÃO [R]', {
      fontFamily: FONT_HUD,
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(3);

    replay.on('pointerover', () => {
      replay.setFillStyle(0x2563eb);
      replay.setStrokeStyle(2, 0x7dd3fc);
    });
    replay.on('pointerout', () => {
      replay.setFillStyle(0x1e3a5f);
      replay.setStrokeStyle(1.5, 0x38bdf8);
    });
    replay.on('pointerdown', onRestart);

    // Botão Trocar Piloto [ESC]
    const change = scene.add.rectangle(GAME_WIDTH / 2, 285, 290, 38, 0x132338, 0.95)
      .setStrokeStyle(1.5, 0x64748b).setInteractive({ useHandCursor: true });
    const changeText = scene.add.text(GAME_WIDTH / 2, 285, 'TROCAR PILOTO [ESC]', {
      fontFamily: FONT_HUD,
      fontSize: '14px',
      color: '#cbd5e1',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(3);

    change.on('pointerover', () => {
      change.setFillStyle(0x1e293b);
      changeText.setColor('#ffffff');
      change.setStrokeStyle(2, 0x94a3b8);
    });
    change.on('pointerout', () => {
      change.setFillStyle(0x132338);
      changeText.setColor('#94a3b8');
      change.setStrokeStyle(1, 0x64748b);
    });
    change.on('pointerdown', onChoosePilot);

    this.add([backdrop, panel, title, subTitle, points, replay, replayText, change, changeText]);
    this.setDepth(100);
    scene.add.existing(this);
  }
}
