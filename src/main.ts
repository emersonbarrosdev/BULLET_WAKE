import Phaser from 'phaser';
import './style.css';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { BootScene } from './game/scenes/BootScene';

const host = document.getElementById('game');

if (!host) {
  throw new Error('Elemento #game não encontrado para inicializar BULLET WAKE.');
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL quando disponível; fallback Canvas pelo Phaser.
  parent: host,
  backgroundColor: GAME_BACKGROUND,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  render: {
    pixelArt: true, // Recomendado para pixel art arredondada em Phaser 4.
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene],
};

const game = new Phaser.Game(config);

// Facilita descarte controlado em desenvolvimento com hot reload.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
