import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';

/**
 * Tela diagnóstica exclusiva do bootstrap T01.
 * NÃO é o menu final e NÃO substitui sprites ou arte do jogo.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, 'BULLET WAKE', {
        fontFamily: 'monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#eaf2f5',
        align: 'center',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 12, 'T01 | BOOTSTRAP', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#61d7da',
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 34, 'Phaser 4 + TypeScript + Vite', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#95b0c3',
      })
      .setOrigin(0.5);
  }
}
