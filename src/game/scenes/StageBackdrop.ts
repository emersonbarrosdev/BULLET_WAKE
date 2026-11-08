import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYFIELD_X, PLAYFIELD_WIDTH, PLAYFIELD_RIGHT } from '../constants';

type BackdropLayer = 'abyss' | 'reefs' | 'surface' | 'mist';
const TEXTURE_WIDTH = PLAYFIELD_WIDTH; // 384px
const TEXTURE_HEIGHT = 768; // Altura para tiling vertical perfeito

function random(seed: number): number {
  const value = Math.sin(seed * 91.137 + 12.372) * 47831.141;
  return value - Math.floor(value);
}

function drawPelagicLayer(
  ctx: CanvasRenderingContext2D,
  layer: BackdropLayer,
): void {
  const W = TEXTURE_WIDTH;
  const H = TEXTURE_HEIGHT;
  ctx.clearRect(0, 0, W, H);

  if (layer === 'abyss') {
    // 1. Fundo do Oceano Profundo: gradiente abissal azul-petróleo / marinho
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#020b14');
    grad.addColorStop(0.3, '#041525');
    grad.addColorStop(0.7, '#061c30');
    grad.addColorStop(1, '#020b14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Fossas abissais e veios de bioluminescência submarina alienígena
    for (let i = 0; i < 7; i++) {
      const cy = (i * 120 + 30) % H;
      const cx = (random(i * 19 + 7) * (W - 80)) + 40;
      const radius = 60 + random(i + 13) * 70;

      const g = ctx.createRadialGradient(cx, cy, 5, cx, cy, radius);
      g.addColorStop(0, 'rgba(0, 240, 255, 0.14)');
      g.addColorStop(0.6, 'rgba(12, 100, 160, 0.06)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
    return;
  }

  if (layer === 'reefs') {
    // 2. Recifes submersos e silhuetas de bio-estruturas alienígenas sob as águas
    ctx.fillStyle = '#08253a';
    ctx.strokeStyle = '#00f0ff22';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 8; i++) {
      const y = i * 95 + 20;
      const isLeft = i % 2 === 0;
      const x = isLeft ? 15 : W - 85;
      const w = 70 + random(i + 4) * 45;
      const h = 50 + random(i + 8) * 35;

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, [14, 18, 12, 16]);
      ctx.fill();
      ctx.stroke();

      // Pólipos bioluminescentes sobre os recifes
      ctx.fillStyle = '#00f0ff55';
      for (let p = 0; p < 4; p++) {
        const px = x + 12 + p * 14;
        const py = y + 10 + (p % 2) * 16;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#08253a';
    }

    // Sombras gigantescas de criaturas abissais passando sob as águas
    ctx.fillStyle = 'rgba(2, 10, 18, 0.45)';
    ctx.beginPath();
    ctx.ellipse(W * 0.45, H * 0.35, 110, 35, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W * 0.6, H * 0.75, 130, 42, 0.15, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (layer === 'surface') {
    // 3. Ondas da Superfície Oceânica com reflexos e cáusticas de luz
    ctx.strokeStyle = 'rgba(80, 200, 255, 0.22)';
    ctx.lineWidth = 1.2;

    for (let y = 10; y < H; y += 22) {
      ctx.beginPath();
      const waveOffset = Math.sin(y * 0.08) * 15;
      ctx.moveTo(10, y);
      ctx.bezierCurveTo(
        W * 0.33 + waveOffset, y - 6,
        W * 0.66 - waveOffset, y + 6,
        W - 10, y,
      );
      ctx.stroke();
    }

    // Espuma marítima cintilante (wake do oceano)
    ctx.fillStyle = 'rgba(160, 240, 255, 0.35)';
    for (let i = 0; i < 90; i++) {
      const x = random(i * 17 + 5) * (W - 20) + 10;
      const y = random(i * 29 + 11) * H;
      ctx.fillRect(x, y, 2.5, 1.2);
    }
    return;
  }

  // 4. Neblina Atmosférica e Nuvens Altas
  ctx.fillStyle = 'rgba(180, 225, 255, 0.04)';
  for (let i = 0; i < 5; i++) {
    const y = i * 160 + 30;
    const x = random(i * 11 + 3) * (W - 140) + 20;
    ctx.beginPath();
    ctx.ellipse(x + 50, y, 90, 45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Cenário Vertical Neo-Arcade da Fase 1 (Fenda Pelágica).
 * Renderiza o oceano verticalmente no corredor central de 384px,
 * e molduras de gabinete arcade nos painéis laterais (0-192 e 576-768).
 */
export class StageBackdrop {
  private readonly abyssTile: Phaser.GameObjects.TileSprite;
  private readonly reefsTile: Phaser.GameObjects.TileSprite;
  private readonly surfaceTile: Phaser.GameObjects.TileSprite;
  private readonly mistTile: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene, _stageNumber = 1) {

    // 1. Cria ou reutiliza texturas de canvas procedural para cada camada
    const layers: BackdropLayer[] = ['abyss', 'reefs', 'surface', 'mist'];
    for (const layer of layers) {
      const key = `bg-pelagic-${layer}`;
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, TEXTURE_WIDTH, TEXTURE_HEIGHT);
        if (canvas) {
          drawPelagicLayer(canvas.context, layer);
          canvas.refresh();
        }
      }
    }

    // 2. Molduras de painel lateral (Bezels Arcade Neo-Retro)
    // Painel Esquerdo (X: 0 a 192)
    scene.add.rectangle(PLAYFIELD_X / 2, GAME_HEIGHT / 2, PLAYFIELD_X, GAME_HEIGHT, 0x050b12, 1)
      .setDepth(1);
    scene.add.rectangle(PLAYFIELD_X, GAME_HEIGHT / 2, 2, GAME_HEIGHT, 0x00f0ff, 0.4)
      .setDepth(2);

    // Painel Direito (X: 576 a 768)
    const rightPanelCenterX = PLAYFIELD_RIGHT + (GAME_WIDTH - PLAYFIELD_RIGHT) / 2;
    scene.add.rectangle(rightPanelCenterX, GAME_HEIGHT / 2, GAME_WIDTH - PLAYFIELD_RIGHT, GAME_HEIGHT, 0x050b12, 1)
      .setDepth(1);
    scene.add.rectangle(PLAYFIELD_RIGHT, GAME_HEIGHT / 2, 2, GAME_HEIGHT, 0x00f0ff, 0.4)
      .setDepth(2);

    // 3. Camadas de Tiling Vertical no Corredor Central (X: 192 a 576)
    const centerX = PLAYFIELD_X + PLAYFIELD_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    this.abyssTile = scene.add.tileSprite(centerX, centerY, PLAYFIELD_WIDTH, GAME_HEIGHT, 'bg-pelagic-abyss')
      .setDepth(2);
    this.reefsTile = scene.add.tileSprite(centerX, centerY, PLAYFIELD_WIDTH, GAME_HEIGHT, 'bg-pelagic-reefs')
      .setDepth(3);
    this.surfaceTile = scene.add.tileSprite(centerX, centerY, PLAYFIELD_WIDTH, GAME_HEIGHT, 'bg-pelagic-surface')
      .setDepth(4);
    this.mistTile = scene.add.tileSprite(centerX, centerY, PLAYFIELD_WIDTH, GAME_HEIGHT, 'bg-pelagic-mist')
      .setDepth(5);
  }

  /**
   * Atualiza o deslocamento vertical das camadas do oceano (rolagem para baixo).
   * A nave voa para o norte (-Y), logo o cenário avança predominantemente para baixo (+Y).
   */
  update(scrollPx: number): void {
    // Parallax proporcional a cada profundidade da água
    this.abyssTile.tilePositionY -= scrollPx * 0.25;
    this.reefsTile.tilePositionY -= scrollPx * 0.55;
    this.surfaceTile.tilePositionY -= scrollPx * 1.0;
    this.mistTile.tilePositionY -= scrollPx * 1.4;
  }
}
