import Phaser from 'phaser';
import './style.css';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from './game/constants';
import { ArcadeScene } from './game/arcade/ArcadeScene';
import { renderPixelRatio } from './game/render/combatResolution';

async function bootGame(): Promise<void> {
  // Inicia o carregamento de fontes sem bloquear a criação imediata do canvas Phaser e do loading.
  if (typeof document !== 'undefined' && 'fonts' in document) {
    void Promise.race([
      Promise.allSettled([
        document.fonts.load('600 18px "Oxanium"'),
        document.fonts.load('700 24px "Oxanium"'),
        document.fonts.load('800 32px "Oxanium"'),
        document.fonts.load('500 16px "Rajdhani"'),
        document.fonts.load('600 18px "Rajdhani"'),
        document.fonts.load('700 20px "Rajdhani"'),
      ]),
      new Promise<void>((resolve) => setTimeout(resolve, 300)),
    ]);
  }

  const host = document.getElementById('game');
  if (!host) {
    throw new Error('Elemento #game não encontrado para inicializar BULLET WAKE.');
  }

  // Nasce já no tamanho real do viewport para evitar salto de escala ou faixas no carregamento.
  const initWidth = Math.max(1, Math.round((host.clientWidth || window.innerWidth || GAME_WIDTH) * renderPixelRatio()));
  const initHeight = Math.max(1, Math.round((host.clientHeight || window.innerHeight || GAME_HEIGHT) * renderPixelRatio()));

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO, // Preferir WebGL; fallback Canvas fornecido pelo Phaser.
    parent: host,
    backgroundColor: GAME_BACKGROUND,
    width: initWidth,
    height: initHeight,
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
      width: initWidth,
      height: initHeight,
    },
    // Production entry uses exclusively the unified ArcadeScene; legacy scenes stay archived in src/game/scenes/ for reference tests.
    scene: [ArcadeScene],
  };

  const game = new Phaser.Game(config);

  let cleanupDevTools: (() => void) | undefined;
  if (__BW_DEVTOOLS__ && import.meta.env.DEV) {
    const { mountDevTools } = await import('./devtools/mountDevTools');
    cleanupDevTools = mountDevTools(game, Phaser);
  }

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cleanupDevTools?.();
      game.destroy(true);
    });
  }
}

void bootGame();
