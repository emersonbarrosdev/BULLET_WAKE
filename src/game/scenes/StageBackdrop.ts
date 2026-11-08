import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { getStage } from '../data/stages';

type BackdropLayer = 'nebula' | 'wreckage' | 'foreground';
const TEXTURE_WIDTH = 1152;
const SCENE_HEIGHT = GAME_HEIGHT;

function random(seed: number): number {
  const value = Math.sin(seed * 91.137 + 12.372) * 47831.141;
  return value - Math.floor(value);
}

function drawStageLayer(
  ctx: CanvasRenderingContext2D,
  layer: BackdropLayer,
  stageNumber: number,
): void {
  const W = TEXTURE_WIDTH;
  const H = SCENE_HEIGHT;
  ctx.clearRect(0, 0, W, H);
  const stage = getStage(stageNumber);

  if (layer === 'nebula') {
    const back = ctx.createLinearGradient(0, 0, W, H);
    back.addColorStop(0, stage.palette.background);
    back.addColorStop(0.5, '#' + stage.palette.farColor.toString(16).padStart(6, '0'));
    back.addColorStop(1, stage.palette.background);
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, W, H);

    // Nuvens de nebulosa / poeira estelar
    for (let i = 0; i < 11; i++) {
      const x = random(i * 3 + 17 + stageNumber * 10) * W;
      const y = random(i * 5 + 33 + stageNumber * 10) * H;
      const radius = 80 + random(i * 13 + 9) * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const colorHex = '#' + stage.palette.midColor.toString(16).padStart(6, '0');
      g.addColorStop(0, colorHex + '44');
      g.addColorStop(1, colorHex + '00');
      ctx.fillStyle = g;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    // Estrelas e partículas de fundo
    for (let i = 0; i < 220; i++) {
      const x = Math.floor(random(i * 7 + 5 + stageNumber * 5) * W);
      const y = Math.floor(random(i * 11 + 29 + stageNumber * 5) * H);
      ctx.fillStyle = i % 6 === 0 ? stage.palette.accentColor : '#b4c8d8';
      ctx.globalAlpha = 0.3 + random(i + 83) * 0.55;
      ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (layer === 'wreckage') {
    // Silhuetas de arquitetura do bioma (estaleiro, dunas, fábrica, plataformas, processador)
    const midColorHex = '#' + stage.palette.midColor.toString(16).padStart(6, '0');
    const nearColorHex = '#' + stage.palette.nearColor.toString(16).padStart(6, '0');

    for (let i = 0; i < 9; i++) {
      const x = i * 160 - 50 + random(i + 2 + stageNumber) * 45;
      const y = i % 2 ? 345 : 75;
      const w = 110 + random(i + 6) * 95;
      ctx.fillStyle = i % 2 ? midColorHex : nearColorHex;
      ctx.beginPath();
      if (i % 2) {
        ctx.moveTo(x, H);
        ctx.lineTo(x + 25, y);
        ctx.lineTo(x + w - 28, y + 15);
        ctx.lineTo(x + w, H);
      } else {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 18, y);
        ctx.lineTo(x + w - 32, y + 16);
        ctx.lineTo(x + w, 0);
      }
      ctx.closePath();
      ctx.fill();

      // Linhas de luz e juntas estruturais no estilo Wake
      ctx.strokeStyle = stage.palette.accentColor + '55';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = stage.palette.accentColor;
      for (let l = 0; l < 4; l++) {
        const px = x + 24 + (l * (w - 48)) / 4;
        const py = i % 2 ? y + 16 : y - 10;
        ctx.fillRect(px, py, 4, 2);
      }
    }
    return;
  }

  // Camada dianteira (partículas e nervuras rápidas com rastro Wake)
  ctx.strokeStyle = '#' + stage.palette.nearColor.toString(16).padStart(6, '0');
  ctx.lineWidth = 2;
  for (let i = 0; i < 15; i++) {
    const x = i * 86 + random(i + 90 + stageNumber) * 18;
    const w = 34 + random(i + 113) * 35;
    const top = i % 3 === 0;
    const y = top ? 3 : H - 4;
    ctx.fillStyle = '#' + stage.palette.farColor.toString(16).padStart(6, '0');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.2, top ? 22 : H - 22);
    ctx.lineTo(x + w, top ? 2 : H - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.2, top ? 22 : H - 22);
    ctx.stroke();
  }

  // Fragmentos de Wake no plano próximo
  for (let i = 0; i < 28; i++) {
    const x = random(i * 3 + 203 + stageNumber * 7) * W;
    const y = 82 + random(i * 17 + 46) * (H - 155);
    const size = 1 + Math.floor(random(i * 23 + 49) * 4);
    ctx.fillStyle = i % 4 === 0 ? stage.palette.accentColor : '#8899aa';
    ctx.globalAlpha = 0.35 + random(i + 67) * 0.45;
    ctx.fillRect(x, y, size, Math.max(1, size / 2));
  }
  ctx.globalAlpha = 1;
}

export class StageBackdrop {
  private layers: { node: Phaser.GameObjects.TileSprite; factor: number }[] = [];

  constructor(scene: Phaser.Scene, stageNumber = 1) {
    const settings: readonly { name: BackdropLayer; factor: number; depth: number }[] = [
      { name: 'nebula', factor: 0.18, depth: -30 },
      { name: 'wreckage', factor: 0.62, depth: -20 },
      { name: 'foreground', factor: 1.16, depth: -10 },
    ];
    for (const setting of settings) {
      const key = `backdrop-stg${stageNumber}-${setting.name}`;
      if (!scene.textures.exists(key)) {
        const canvas = document.createElement('canvas');
        canvas.width = TEXTURE_WIDTH;
        canvas.height = SCENE_HEIGHT;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D indisponível para cenário de teste');
        drawStageLayer(ctx, setting.name, stageNumber);
        scene.textures.addCanvas(key, canvas);
      }
      const node = scene.add
        .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, key)
        .setDepth(setting.depth);
      this.layers.push({ node, factor: setting.factor });
    }
  }

  update(distancePx: number): void {
    for (const layer of this.layers) {
      layer.node.tilePositionX = distancePx * layer.factor;
    }
  }
}
