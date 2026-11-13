import Phaser from 'phaser';
import './style.css';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { TitleScene } from './game/scenes/TitleScene';
import { StageSelectScene } from './game/scenes/StageSelectScene';
import { PilotSelectScene } from './game/scenes/PilotSelectScene';
import { PrototypeScene } from './game/scenes/PrototypeScene';
import { EndingScene } from './game/scenes/EndingScene';
import { ArcadeScene } from './game/arcade/ArcadeScene';

// Disponibiliza o Phaser globalmente no escopo do navegador para debug e extensibilidade
(window as unknown as { Phaser: typeof Phaser }).Phaser = Phaser;

async function bootGame(): Promise<void> {
  // Força o download e ativação real das fontes Oxanium e Rajdhani antes de iniciar as cenas Phaser
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.allSettled([
        document.fonts.load('600 18px "Oxanium"'),
        document.fonts.load('700 24px "Oxanium"'),
        document.fonts.load('800 32px "Oxanium"'),
        document.fonts.load('500 16px "Rajdhani"'),
        document.fonts.load('600 18px "Rajdhani"'),
        document.fonts.load('700 20px "Rajdhani"'),
      ]);
      await document.fonts.ready;
    } catch {
      // Fallback gracioso caso offline
    }
  }

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
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: false,
    },
    fps: {
      min: 30,
      target: 60,
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
    scene: [ArcadeScene, TitleScene, StageSelectScene, PilotSelectScene, PrototypeScene, EndingScene],
  };

  const game = new Phaser.Game(config);
  (window as unknown as { __GAME__: Phaser.Game }).__GAME__ = game;

  if (import.meta.hot) {
    import.meta.hot.dispose(() => game.destroy(true));
  }
}

void bootGame();
