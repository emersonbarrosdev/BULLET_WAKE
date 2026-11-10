import { OceanSurface } from '../render/OceanSurface';
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYFIELD_X, PLAYFIELD_WIDTH, PLAYFIELD_RIGHT } from '../constants';

type BackdropLayer = 'abyss' | 'reefs' | 'surface' | 'mist';
const TEXTURE_WIDTH = GAME_WIDTH; // 768px para cobrir menus e o corredor widescreen sem esticar
const TEXTURE_HEIGHT = 768; // Altura para tiling vertical perfeito

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 91.137 + 12.372) * 47831.141;
  return value - Math.floor(value);
}

/**
 * Renderizador de Texturas Procedurais HD 2D para a Fenda Pelágica (Stage 1).
 * Recria a atmosfera de um oceano alienígena profundo: fossas abissais,
 * bioluminescência submarina, corais extraterrestres e cáusticas de luz vivas.
 */
function drawPelagicLayer(
  ctx: CanvasRenderingContext2D,
  layer: BackdropLayer,
): void {
  const W = TEXTURE_WIDTH;
  const H = TEXTURE_HEIGHT;
  ctx.clearRect(0, 0, W, H);

  if (layer === 'abyss') {
    // 1. Fundo Abissal Profundo: gradiente oceânico azul-marinho / petróleo
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#010a14');
    grad.addColorStop(0.25, '#03182a');
    grad.addColorStop(0.55, '#06253c');
    grad.addColorStop(0.85, '#031b2d');
    grad.addColorStop(1, '#010a14');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Fenda Tectônica Abissal (chasm central profundo sinuoso)
    ctx.beginPath();
    ctx.moveTo(W * 0.48, 0);
    ctx.bezierCurveTo(W * 0.42, H * 0.3, W * 0.58, H * 0.7, W * 0.51, H);
    ctx.lineWidth = 90;
    ctx.strokeStyle = '#00060d';
    ctx.stroke();

    // Núcleo hiper-profundo da fenda
    ctx.beginPath();
    ctx.moveTo(W * 0.48, 0);
    ctx.bezierCurveTo(W * 0.42, H * 0.3, W * 0.58, H * 0.7, W * 0.51, H);
    ctx.lineWidth = 42;
    ctx.strokeStyle = '#000307';
    ctx.stroke();

    // Falhas hidrotermais com bioluminescência ciano e esmeralda emanando do fundo
    for (let i = 0; i < 9; i++) {
      const fy = i * 90 + 35;
      const t = fy / H;
      const fx = (1 - t) * (1 - t) * (W * 0.48) + 2 * (1 - t) * t * (W * 0.50) + t * t * (W * 0.51);
      const rad = 50 + pseudoRandom(i * 13 + 3) * 45;

      const ventGrad = ctx.createRadialGradient(fx, fy, 4, fx, fy, rad);
      ventGrad.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
      ventGrad.addColorStop(0.4, 'rgba(13, 148, 136, 0.12)');
      ventGrad.addColorStop(0.8, 'rgba(6, 78, 59, 0.04)');
      ventGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ventGrad;
      ctx.beginPath();
      ctx.arc(fx, fy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Silhueta de Behemoth Abissal passando nas profundezas (forma aerodinâmica marinha)
    ctx.save();
    ctx.fillStyle = 'rgba(1, 8, 15, 0.75)';
    ctx.beginPath();
    // Corpo central e asas de raia colossal
    const bX = W * 0.45;
    const bY = H * 0.42;
    ctx.ellipse(bX, bY, 135, 42, -0.08, 0, Math.PI * 2);
    ctx.fill();
    // Cauda longa que afina
    ctx.beginPath();
    ctx.moveTo(bX - 25, bY + 38);
    ctx.quadraticCurveTo(bX - 45, bY + 110, bX - 30, bY + 160);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(1, 8, 15, 0.75)';
    ctx.stroke();

    // Nós bioluminescentes na espinha do leviathan
    for (let n = 0; n < 6; n++) {
      const ny = bY - 26 + n * 11;
      const nx = bX + Math.sin(n * 0.7) * 4;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.beginPath();
      ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  if (layer === 'reefs') {
    // 2. Recifes Vivos Submarinos e Formações de Rocha Oceânica (Formas Orgânicas)
    // Posicionados nas margens do corredor central (X ~ 175..265 e X ~ 495..590) para emoldurar o combate
    for (let i = 0; i < 8; i++) {
      const isLeft = i % 2 === 0;
      const baseY = i * 105 + 20;
      const rx = isLeft
        ? 172 + pseudoRandom(i * 7) * 32
        : W - 172 - 145 - pseudoRandom(i * 11) * 30;
      const rw = 125 + pseudoRandom(i * 5) * 45;
      const rh = 65 + pseudoRandom(i * 9) * 38;

      // Base rochosa com contornos orgânicos
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rx, baseY);
      ctx.bezierCurveTo(rx + rw * 0.3, baseY - 12, rx + rw * 0.7, baseY - 6, rx + rw, baseY + 10);
      ctx.bezierCurveTo(rx + rw + 15, baseY + rh * 0.5, rx + rw - 10, baseY + rh, rx + rw * 0.8, baseY + rh + 12);
      ctx.bezierCurveTo(rx + rw * 0.4, baseY + rh + 8, rx + 15, baseY + rh + 18, rx - 10, baseY + rh * 0.6);
      ctx.closePath();

      // Gradiente de rocha submarina com profundidade
      const rockGrad = ctx.createLinearGradient(rx, baseY, rx + rw, baseY + rh);
      rockGrad.addColorStop(0, '#0a2335');
      rockGrad.addColorStop(0.5, '#061724');
      rockGrad.addColorStop(1, '#040f18');
      ctx.fillStyle = rockGrad;
      ctx.fill();

      // Borda luminosa de musgo bioluminescente
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
      ctx.stroke();

      // Colônias de pólipos bioluminescentes (cianobactérias marinhas)
      const colonyCount = 8;
      for (let c = 0; c < colonyCount; c++) {
        const px = rx + 18 + pseudoRandom(i * 17 + c) * (rw - 36);
        const py = baseY + 12 + pseudoRandom(i * 23 + c) * (rh - 24);
        const pRad = 2 + pseudoRandom(c * 3) * 3;

        // Halo suave
        const pGrad = ctx.createRadialGradient(px, py, 1, px, py, pRad * 2.5);
        pGrad.addColorStop(0, c % 3 === 0 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(45, 212, 191, 0.75)');
        pGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(px, py, pRad * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Ponto central
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Monólitos e ruínas de arcos biomecânicos submersos
    for (let m = 0; m < 3; m++) {
      const my = m * 260 + 60;
      const mx = m % 2 === 0 ? W * 0.32 : W * 0.68;
      ctx.strokeStyle = 'rgba(14, 116, 144, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(mx, my, 28, Math.PI, 0);
      ctx.stroke();

      // Conduíte de energia interna alienígena
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.32)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(mx, my, 24, Math.PI * 0.9, Math.PI * 0.1);
      ctx.stroke();
    }
    return;
  }

  if (layer === 'surface') {
    // 3. Superfície Oceânica com Rede de Cáusticas de Luz Submarina e Marolas
    // Malha de cáusticas ondulantes (intersecções orgânicas de luz solar)
    ctx.strokeStyle = 'rgba(125, 249, 255, 0.18)';
    ctx.lineWidth = 1.2;

    for (let cy = 15; cy < H; cy += 48) {
      ctx.beginPath();
      ctx.moveTo(0, cy);
      for (let cx = 0; cx < W; cx += 56) {
        const waveY = cy + Math.sin((cx + cy) * 0.035) * 12 + Math.cos(cx * 0.06) * 6;
        ctx.lineTo(cx, waveY);
      }
      ctx.stroke();
    }

    // Segunda família de cáusticas entrecruzadas em ângulo suave
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1.0;
    for (let cy = 35; cy < H; cy += 52) {
      ctx.beginPath();
      ctx.moveTo(0, cy);
      for (let cx = 0; cx < W; cx += 64) {
        const waveY = cy + Math.cos((cx - cy) * 0.04) * 14;
        ctx.lineTo(cx, waveY);
      }
      ctx.stroke();
    }

    // Ondas de superfície com espuma líquida suave (ocean wake)
    ctx.strokeStyle = 'rgba(200, 245, 255, 0.26)';
    ctx.lineWidth = 1.4;
    for (let y = 20; y < H; y += 75) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.bezierCurveTo(
        W * 0.28, y - 8,
        W * 0.72, y + 10,
        W - 10, y + 2,
      );
      ctx.stroke();
    }

    // Partículas de espuma marinha e plâncton em suspensão (Wake)
    ctx.fillStyle = 'rgba(186, 230, 253, 0.40)';
    for (let i = 0; i < 90; i++) {
      const px = pseudoRandom(i * 19 + 7) * (W - 30) + 15;
      const py = pseudoRandom(i * 31 + 13) * H;
      const size = 1.2 + pseudoRandom(i) * 1.8;
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // 4. Feixes de Luz Solar Submarina (God Rays / Crepuscular Rays) e Névoa
  ctx.save();
  for (let r = 0; r < 4; r++) {
    const rx = r * 200 + 40;
    const rayGrad = ctx.createLinearGradient(rx, 0, rx + 160, H);
    rayGrad.addColorStop(0, 'rgba(165, 243, 252, 0.07)');
    rayGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.03)');
    rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = rayGrad;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx + 80, 0);
    ctx.lineTo(rx + 220, H);
    ctx.lineTo(rx + 110, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export interface StageBackdropOptions {
  fullWidth?: boolean;
  showBezels?: boolean;
}

/**
 * Cenário Vertical Neo-Arcade da Fase 1 (Fenda Pelágica).
 * Configurado SEMPRE com z-index/depth negativo (-10 a -4) para jamais encobrir
 * qualquer elemento de UI, cards, textos ou HUD de combate.
 */
export class StageBackdrop {
  readonly water?: OceanSurface;
  private readonly spray: Phaser.GameObjects.Graphics;
  private waterTimeMs=0;
  private readonly abyssTile: Phaser.GameObjects.TileSprite;
  private readonly reefsTile: Phaser.GameObjects.TileSprite;
  private readonly surfaceTile: Phaser.GameObjects.TileSprite;
  private readonly mistTile: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene, _stageNumber = 1, options: StageBackdropOptions = {}) {
    this.spray = scene.add.graphics().setDepth(-6);
    const fullWidth = Boolean(options.fullWidth);
    const showBezels = options.showBezels ?? !fullWidth;
    const painted = scene.textures.exists('hd-ocean') && !fullWidth;
    if (painted && !scene.textures.exists('bg-pelagic-painted-loop')) {
      // Mirror the second half: identical edge pixels at both vertical joins.
      const source = scene.textures.get('hd-ocean').getSourceImage() as HTMLImageElement;
      const loop = scene.textures.createCanvas('bg-pelagic-painted-loop', 1024, 3072);
      if (loop) {
        loop.context.drawImage(source, 0, 0, 1024, 1536);
        loop.context.save(); loop.context.translate(0, 3072); loop.context.scale(1, -1);
        loop.context.drawImage(source, 0, 0, 1024, 1536); loop.context.restore();
        loop.refresh(); loop.setFilter(Phaser.Textures.FilterMode.LINEAR);
      }
    }

    // 1. Cria ou reutiliza texturas de canvas procedural para cada camada
    const layers: BackdropLayer[] = ['abyss', 'reefs', 'surface', 'mist'];
    for (const layer of layers) {
      const key = `bg-pelagic-${layer}-hd`;
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, TEXTURE_WIDTH, TEXTURE_HEIGHT);
        if (canvas) {
          drawPelagicLayer(canvas.context, layer);
          canvas.refresh();
        }
      }
    }

    const width = fullWidth ? GAME_WIDTH : PLAYFIELD_WIDTH;
    const centerX = fullWidth ? GAME_WIDTH / 2 : PLAYFIELD_X + PLAYFIELD_WIDTH / 2;
    const centerY = GAME_HEIGHT / 2;

    // 2. Camadas de Tiling Vertical com profundidade negativa (-10 a -7)
    // Alinha tilePositionX em PLAYFIELD_X quando em modo corredor para centralizar a fenda abissal e os recifes
    const tileOffsetX = fullWidth ? 0 : PLAYFIELD_X;

    this.abyssTile = scene.add.tileSprite(centerX, centerY, width, GAME_HEIGHT, painted ? 'bg-pelagic-painted-loop' : 'bg-pelagic-abyss-hd')
      .setDepth(-10);
    this.abyssTile.tilePositionX = painted ? 0 : tileOffsetX;
    if (painted) this.abyssTile.setTileScale(width / 1024);

    this.reefsTile = scene.add.tileSprite(centerX, centerY, width, GAME_HEIGHT, 'bg-pelagic-reefs-hd')
      .setDepth(-9);
    this.reefsTile.tilePositionX = tileOffsetX;

    this.surfaceTile = scene.add.tileSprite(centerX, centerY, width, GAME_HEIGHT, 'bg-pelagic-surface-hd')
      .setDepth(-8);
    this.surfaceTile.tilePositionX = tileOffsetX;

    this.mistTile = scene.add.tileSprite(centerX, centerY, width, GAME_HEIGHT, 'bg-pelagic-mist-hd')
      .setDepth(-7);
    this.mistTile.tilePositionX = tileOffsetX;
    if (painted) {
      if(scene.game.renderer.type===Phaser.WEBGL && scene.textures.exists('polish-ocean')) {
        this.water=new OceanSurface(scene);
        this.abyssTile.setVisible(false);
      }
      this.reefsTile.setVisible(false);
      this.surfaceTile.setVisible(false);
      this.mistTile.setVisible(false);
    }

    // 3. Molduras de painel lateral (Bezels Arcade Neo-Retro) - APENAS no gameplay
    if (showBezels) {
      // Painel Esquerdo (X: 0 a 192)
      scene.add.rectangle(PLAYFIELD_X / 2, GAME_HEIGHT / 2, PLAYFIELD_X, GAME_HEIGHT, 0x050b12, 1)
        .setDepth(-5);
      scene.add.rectangle(PLAYFIELD_X, GAME_HEIGHT / 2, 1, GAME_HEIGHT, 0xff8520, 0.4)
        .setDepth(-4);

      // Painel Direito (X: 576 a 768)
      const rightPanelCenterX = PLAYFIELD_RIGHT + (GAME_WIDTH - PLAYFIELD_RIGHT) / 2;
      scene.add.rectangle(rightPanelCenterX, GAME_HEIGHT / 2, GAME_WIDTH - PLAYFIELD_RIGHT, GAME_HEIGHT, 0x050b12, 1)
        .setDepth(-5);
      scene.add.rectangle(PLAYFIELD_RIGHT, GAME_HEIGHT / 2, 1, GAME_HEIGHT, 0xff8520, 0.4)
        .setDepth(-4);
    }
  }

  /**
   * Atualiza o deslocamento vertical das camadas do oceano com base no scrollPx cumulativo.
   * Atribuição direta (=) e NÃO incremento (-=), garantindo velocidade constante e sem aberração.
   */
  update(scrollPx: number, deltaMs = 16.667): void {
    this.waterTimeMs += Math.max(0,deltaMs);
    this.water?.update(scrollPx,deltaMs);
    const invasion=Phaser.Math.Clamp((scrollPx-1100)/1300,0,1);
    const rift=Phaser.Math.Clamp((scrollPx-3150)/950,0,1);
    // Near-surface flecks have independent trajectories, not a scrolling photograph.
    this.spray.clear();
    if(this.water){
      for(let i=0;i<42;i++){
        const x=PLAYFIELD_X+8+((i*97+Math.sin(this.waterTimeMs/1300+i)*9)% (PLAYFIELD_WIDTH-16));
        const y=((i*71+scrollPx*.9+this.waterTimeMs*.008)%(GAME_HEIGHT+24))-12;
        const alpha=(.035+invasion*.08+rift*.025)*( .6+.4*Math.sin(this.waterTimeMs/700+i));
        this.spray.lineStyle(.6,0xb3e4df,alpha);
        this.spray.beginPath();this.spray.moveTo(x,y);this.spray.lineTo(x+2+invasion*3,y+3);this.spray.strokePath();
      }
    }
    this.abyssTile.tilePositionY = -scrollPx * 0.72 / this.abyssTile.tileScaleY;
    this.reefsTile.tilePositionY = -scrollPx * 0.55;
    this.surfaceTile.tilePositionY = -scrollPx * 1.0;
    this.mistTile.tilePositionY = -scrollPx * 1.4;
  }
}
