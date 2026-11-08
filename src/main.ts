import Phaser from 'phaser';
import './style.css';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { TitleScene } from './game/scenes/TitleScene';
import { StageSelectScene } from './game/scenes/StageSelectScene';
import { PilotSelectScene } from './game/scenes/PilotSelectScene';
import { PrototypeScene } from './game/scenes/PrototypeScene';
import { EndingScene } from './game/scenes/EndingScene';

const host = document.getElementById('game');

if (!host) {
  throw new Error('Elemento #game não encontrado para inicializar BULLET WAKE.');
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // Preferir WebGL; fallback Canvas fornecido pelo Phaser.
  parent: host,
  backgroundColor: GAME_BACKGROUND,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  render: { pixelArt: true },
  fps: {
    min: 30,
    target: 240, // Permite rodar acima de 60fps (120Hz, 144Hz, 240Hz)
    forceSetTimeOut: false,
    smoothStep: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    // O CSS Flexbox centraliza o Canvas.
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [TitleScene, StageSelectScene, PilotSelectScene, PrototypeScene, EndingScene],
};

const game = new Phaser.Game(config);
(window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.destroy(true));
}
