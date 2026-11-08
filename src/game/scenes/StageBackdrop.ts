import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

type BackdropLayer = 'nebula' | 'wreckage' | 'foreground';
const TEXTURE_WIDTH = 1152;
const SCENE_HEIGHT = GAME_HEIGHT;
const colors = {
  void: '#101827', deep: '#172238', violet: '#292d47', dust: '#663f43',
  hull: '#34465a', steel: '#45505d', copper: '#855b50', rust: '#ad7460',
};

/** Pseudo-random visual decor only, deterministic and independent of game logic. */
function random(seed: number): number {
  const value = Math.sin(seed * 91.137 + 12.372) * 47831.141;
  return value - Math.floor(value);
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: BackdropLayer): void {
  const W = TEXTURE_WIDTH;
  const H = SCENE_HEIGHT;
  ctx.clearRect(0, 0, W, H);

  if (layer === 'nebula') {
    const back = ctx.createLinearGradient(0, 0, W, H);
    back.addColorStop(0, colors.void);
    back.addColorStop(0.43, colors.deep);
    back.addColorStop(0.72, '#1d2537');
    back.addColorStop(1, colors.void);
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 11; i++) {
      const x = random(i * 3 + 17) * W;
      const y = random(i * 5 + 33) * H;
      const radius = 80 + random(i * 13 + 9) * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const tint = i % 3 === 0 ? '110,67,72' : '51,69,113';
      g.addColorStop(0, 'rgba(' + tint + ',0.19)');
      g.addColorStop(1, 'rgba(' + tint + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (let i = 0; i < 215; i++) {
      const x = Math.floor(random(i * 7 + 5) * W);
      const y = Math.floor(random(i * 11 + 29) * H);
      ctx.fillStyle = i % 6 === 0 ? '#91aabd' : '#50647c';
      ctx.globalAlpha = 0.3 + random(i + 83) * 0.53;
      ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (layer === 'wreckage') {
    // Fuselagens distantes e plataformas industriais; cenário temporário de fase.
    for (let i = 0; i < 8; i++) {
      const x = i * 176 - 55 + random(i + 2) * 52;
      const y = i % 2 ? 354 : 70;
      const w = 100 + random(i + 6) * 105;
      ctx.fillStyle = i % 2 ? '#263447' : '#27364a';
      ctx.beginPath();
      if (i % 2) {
        ctx.moveTo(x, H);
        ctx.lineTo(x + 25, y);
        ctx.lineTo(x + w - 28, y + 12);
        ctx.lineTo(x + w, H);
      } else {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 14, y);
        ctx.lineTo(x + w - 36, y + 16);
        ctx.lineTo(x + w, 0);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#425368';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(199,124,82,0.43)';
      ctx.beginPath();
      ctx.moveTo(x + 17, i % 2 ? H : 6);
      ctx.lineTo(x + w - 34, y + (i % 2 ? 3 : 4));
      ctx.stroke();
      ctx.fillStyle = '#b58b67';
      for (let l = 0; l < 4; l++) {
        const px = x + 24 + l * (w - 48) / 4;
        const py = i % 2 ? y + 18 : y - 12;
        ctx.fillRect(px, py, 4, 2);
      }
    }
    return;
  }

  // Partículas e nervuras próximas são mais velozes: perspectiva de auto-scroll.
  ctx.strokeStyle = '#5f4c50';
  ctx.lineWidth = 2;
  for (let i = 0; i < 15; i++) {
    const x = i * 86 + random(i + 90) * 18;
    const w = 34 + random(i + 113) * 35;
    const top = i % 3 === 0;
    const y = top ? 3 : H - 4;
    ctx.fillStyle = '#293340';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.2, top ? 20 : H - 20);
    ctx.lineTo(x + w, top ? 2 : H - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.2, top ? 20 : H - 20);
    ctx.stroke();
  }
  for (let i = 0; i < 27; i++) {
    const x = random(i * 3 + 203) * W;
    const y = 82 + random(i * 17 + 46) * (H - 155);
    const size = 1 + Math.floor(random(i * 23 + 49) * 4);
    ctx.fillStyle = i % 3 ? '#5a5560' : '#88726a';
    ctx.globalAlpha = 0.33 + random(i + 67) * 0.45;
    ctx.fillRect(x, y, size, Math.max(1, size / 2));
  }
  ctx.globalAlpha = 1;
}

/**
 * Cenário com três velocidades de parallax. Texturas Canvas são geradas uma
 * única vez e desenhadas pelo Phaser em TileSprites; sem shapes verdes de debug.
 */
export class StageBackdrop {
  private layers: { node: Phaser.GameObjects.TileSprite; factor: number }[] = [];

  constructor(scene: Phaser.Scene) {
    const settings: readonly { name: BackdropLayer; factor: number; depth: number }[] = [
      { name: 'nebula', factor: 0.18, depth: -30 },
      { name: 'wreckage', factor: 0.62, depth: -20 },
      { name: 'foreground', factor: 1.16, depth: -10 },
    ];
    for (const setting of settings) {
      const key = 'rustbelt-backdrop-' + setting.name;
      if (!scene.textures.exists(key)) {
        const canvas = document.createElement('canvas');
        canvas.width = TEXTURE_WIDTH;
        canvas.height = SCENE_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D indisponível para cenário de teste');
        drawLayer(ctx, setting.name);
        scene.textures.addCanvas(key, canvas);
      }
      const node = scene.add.tileSprite(
        GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, key,
      ).setDepth(setting.depth);
      this.layers.push({ node, factor: setting.factor });
    }
  }

  update(distancePx: number): void {
    for (const layer of this.layers) layer.node.tilePositionX = distancePx * layer.factor;
  }
}
