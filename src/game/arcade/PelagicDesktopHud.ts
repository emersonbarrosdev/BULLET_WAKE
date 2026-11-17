import Phaser from 'phaser';
import { UI_TEX } from './ArcadeMenuArt';
import { PELAGIC_RIVET_SHEET } from './PelagicActorAnimsMath';
import type { ArcadeWorld } from './ArcadeWorld';
import type { PelagicCommsState } from './PelagicComms';
import { subTotalHp } from './PelagicSubmarineBoss';

/**
 * FENDA PELÁGICA — HUD desktop aprovada (arte nativa e editável).
 *
 * Canvas lógico: 768x432.
 *   Missão / Bayek / rádio:  x=0..160
 *   Gameplay sem tampas:    x=160..608, y=0..432
 *   RIVET / status:         x=608..768
 *
 * Molduras são desenhadas uma vez em Canvas2D com gradientes e contornos,
 * não são recortes do mockup. Os dados são elementos Phaser independentes.
 * Android portrait e a Cidade Solar continuam a usar suas próprias HUDs.
 */
const W = 768;
const H = 432;
const LEFT = 160;
const RIGHT = 608;
const SCALE = 2;
const FONT = 'Trebuchet MS, Segoe UI, Arial, sans-serif';
const COLORS = {
  yellow: 0xffdf33,
  cyan: 0x42eaff,
  dark: 0x03152d,
  blue: 0x07336d,
} as const;

export interface PelagicHudStateSnapshot {
  visible: boolean;
  scoreText: string;
  weaponLevel: number;
  weaponLevelText: string;
  lives: number;
  specialCharges: number;
  radioActive: boolean;
  radioText: string;
  radioExpression: number;
  assisted: boolean;
  pauseCenter: { x: number; y: number } | null;
  arena: { left: number; right: number; top: number; bottom: number; width: number };
}

type VisibleNode = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

function poly(ctx: CanvasRenderingContext2D, coords: number[]): void {
  ctx.beginPath();
  ctx.moveTo(coords[0], coords[1]);
  for (let i = 2; i < coords.length; i += 2) ctx.lineTo(coords[i], coords[i + 1]);
  ctx.closePath();
}

function bezelPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bevel = 8): void {
  poly(ctx, [
    x + bevel, y, x + w - bevel, y, x + w, y + bevel,
    x + w, y + h - bevel, x + w - bevel, y + h,
    x + bevel, y + h, x, y + h - bevel, x, y + bevel,
  ]);
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + w * 0.2, y + h);
  grad.addColorStop(0, '#072657');
  grad.addColorStop(0.52, '#041736');
  grad.addColorStop(1, '#061a40');
  bezelPath(ctx, x, y, w, h, 8);
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(16,196,255,.42)';
  ctx.shadowBlur = 11;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.1;
  ctx.strokeStyle = '#22d7ff';
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = 'rgba(231,254,255,.85)';
  ctx.stroke();
  bezelPath(ctx, x + 3, y + 3, w - 6, h - 6, 6);
  ctx.lineWidth = 0.65;
  ctx.strokeStyle = 'rgba(79,206,255,.35)';
  ctx.stroke();
  ctx.restore();
}

function titlePlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = '#ffde30'): void {
  ctx.save();
  poly(ctx, [x + 6, y, x + w, y, x + w - 8, y + h, x, y + h]);
  ctx.fillStyle = fill;
  ctx.shadowColor = fill;
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#08224e';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.65)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x + 8, y + 2); ctx.lineTo(x + w - 9, y + 2); ctx.stroke();
  ctx.restore();
}

function hazard(ctx: CanvasRenderingContext2D, x: number, y: number, n = 3): void {
  ctx.save();
  ctx.fillStyle = '#ffe12b';
  for (let i = 0; i < n; i++) {
    const xx = x + i * 7;
    poly(ctx, [xx + 6, y, xx + 12, y, xx + 5, y + 12, xx - 1, y + 12]);
    ctx.fill();
  }
  ctx.restore();
}

function imageWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#36e8ff';
  ctx.shadowColor = '#24baff';
  ctx.shadowBlur = 8;
  bezelPath(ctx, x, y, w, h, 5);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 0.75;
  ctx.strokeStyle = '#d2fbff';
  bezelPath(ctx, x + 2, y + 2, w - 4, h - 4, 4);
  ctx.stroke();
  ctx.restore();
}

function buildStaticTextures(scene: Phaser.Scene): void {
  const backdropKey = 'bw-fenda-hud-native-base-v4';
  const trimKey = 'bw-fenda-hud-native-trim-v4';
  if (!scene.textures.exists(backdropKey)) {
    const texture = scene.textures.createCanvas(backdropKey, W * SCALE, H * SCALE);
    if (texture) {
      const c = texture.context;
      c.save(); c.scale(SCALE, SCALE);
      for (const x of [0, RIGHT]) {
        const width = LEFT;
        const bg = c.createLinearGradient(x, 0, x + width, H);
        bg.addColorStop(0, '#06458f');
        bg.addColorStop(0.3, '#072a68');
        bg.addColorStop(0.72, '#061d50');
        bg.addColorStop(1, '#06183d');
        c.fillStyle = bg; c.fillRect(x, 0, width, H);
        c.strokeStyle = 'rgba(77,165,245,.10)'; c.lineWidth = 0.5;
        for (let yy = 8; yy < H; yy += 18) {
          c.beginPath(); c.moveTo(x, yy); c.lineTo(x + width, yy); c.stroke();
        }
        for (let xx = 0; xx < width; xx += 18) {
          c.beginPath(); c.moveTo(x + xx, 0); c.lineTo(x + xx, H); c.stroke();
        }
      }
      // Camadas separadas por função, com espaço reservado ao pause no topo direito.
      card(c, 7, 8, 146, 115);    // Missão
      card(c, 7, 130, 146, 166);  // Bayek
      card(c, 7, 303, 146, 88);   // Rádio
      card(c, 616, 28, 145, 182); // Nave
      card(c, 616, 216, 145, 55); // Armamento
      card(c, 616, 277, 145, 55); // Bomba
      card(c, 616, 338, 145, 73); // Vidas

      const radar = c.createRadialGradient(688, 131, 8, 688, 131, 58);
      radar.addColorStop(0, '#104e7e');
      radar.addColorStop(0.74, '#06254d');
      radar.addColorStop(1, '#04132f');
      bezelPath(c, 624, 78, 129, 123, 8);
      c.fillStyle = radar; c.fill();
      c.lineWidth = 0.7; c.strokeStyle = 'rgba(41,218,255,.48)'; c.stroke();
      c.beginPath(); c.arc(688, 140, 48, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(34,178,255,.35)'; c.stroke();
      c.beginPath(); c.arc(688, 140, 32, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(634, 140); c.lineTo(742, 140);
      c.moveTo(688, 89); c.lineTo(688, 190); c.stroke();
      c.restore(); texture.refresh();
    }
  }

  if (!scene.textures.exists(trimKey)) {
    const texture = scene.textures.createCanvas(trimKey, W * SCALE, H * SCALE);
    if (texture) {
      const c = texture.context;
      c.save(); c.scale(SCALE, SCALE);
      // Riscos verticais finos: o gameplay não tem bordas horizontais.
      c.lineWidth = 1.1; c.shadowColor = '#37edff'; c.shadowBlur = 6;
      c.strokeStyle = '#35e7ff';
      for (const x of [LEFT + 0.5, RIGHT - 0.5]) {
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
      }
      c.shadowBlur = 0;
      titlePlate(c, 15, 15, 76, 18);
      imageWindow(c, 14, 64, 132, 52);
      imageWindow(c, 14, 145, 132, 137);
      titlePlate(c, 27, 270, 106, 23);
      // Detalhes de metal amarelo, como a referência.
      hazard(c, 122, 18, 3);
      hazard(c, 125, 309, 2);
      hazard(c, 124, 279, 2);
      hazard(c, 735, 45, 2);
      hazard(c, 735, 228, 2);
      hazard(c, 735, 289, 2);
      hazard(c, 735, 350, 2);
      titlePlate(c, 632, 57, 94, 16, '#3ae5ff');
      imageWindow(c, 623, 77, 130, 126);
      // Rádio com janela de texto sem fotografia duplicada.
      imageWindow(c, 15, 333, 130, 50);

      // Pontuação, integrada à linha y=0, SEM barra atravessando a arena.
      const topGrad = c.createLinearGradient(0, 0, 0, 16);
      topGrad.addColorStop(0, '#0a3970'); topGrad.addColorStop(1, '#041631');
      c.fillStyle = topGrad;
      poly(c, [341, 0, 427, 0, 419, 16, 349, 16]); c.fill();
      c.lineWidth = 1.3; c.strokeStyle = '#54e9ff';
      c.shadowColor = '#22c9ff'; c.shadowBlur = 5; c.stroke();
      c.shadowBlur = 0;
      c.fillStyle = '#ffdf24';
      poly(c, [342, 0, 353, 0, 361, 5, 355, 5]); c.fill();
      poly(c, [426, 0, 415, 0, 407, 5, 413, 5]); c.fill();

      // Logo só recebe fundo discreto; o próprio asset fica pequeno no canto inferior.
      c.fillStyle = 'rgba(32,152,235,.19)';
      poly(c, [12, 400, 111, 400, 100, 426, 0, 426]); c.fill();
      c.restore(); texture.refresh();
    }
  }

  // Corações originais, criados via curva Bézier e brilho; nenhum recorte do mockup.
  if (!scene.textures.exists('bw-hud-heart-native-v4')) {
    const texture = scene.textures.createCanvas('bw-hud-heart-native-v4', 96, 96);
    if (texture) {
      const c = texture.context;
      const path = () => {
        c.beginPath(); c.moveTo(48, 80);
        c.bezierCurveTo(24, 64, 10, 48, 12, 29);
        c.bezierCurveTo(14, 12, 35, 12, 48, 26);
        c.bezierCurveTo(61, 12, 82, 12, 84, 29);
        c.bezierCurveTo(87, 48, 72, 65, 48, 80);
        c.closePath();
      };
      const red = c.createLinearGradient(25, 17, 65, 80);
      red.addColorStop(0, '#fff0f5'); red.addColorStop(.26, '#ff7b9d');
      red.addColorStop(.64, '#ee2b5f'); red.addColorStop(1, '#9c1236');
      c.save(); c.shadowColor = '#ff547d'; c.shadowBlur = 9;
      path(); c.fillStyle = red; c.fill(); c.shadowBlur = 0;
      c.lineWidth = 4; c.strokeStyle = '#ffe3ec'; c.stroke();
      c.lineWidth = 1.4; c.strokeStyle = '#850c36'; c.stroke();
      c.beginPath(); c.ellipse(34, 29, 11, 5, -.35, 0, Math.PI * 2);
      c.fillStyle = 'rgba(255,255,255,.68)'; c.fill();
      c.restore(); texture.refresh();
    }
  }
}

export class PelagicDesktopHud {
  readonly chassis: Phaser.GameObjects.Image;
  readonly bayekPortrait: Phaser.GameObjects.Sprite;
  readonly routeThumb: Phaser.GameObjects.Image;
  readonly logo: Phaser.GameObjects.Image;
  readonly rivetSide: Phaser.GameObjects.Sprite;
  readonly scoreValue: Phaser.GameObjects.Text;

  private readonly allNodes: VisibleNode[];
  private readonly indicatorInk: Phaser.GameObjects.Graphics;
  private readonly hearts: Phaser.GameObjects.Image[] = [];
  private readonly radioMessage: Phaser.GameObjects.Text;
  private readonly missionName: Phaser.GameObjects.Text;
  private visible = false;
  private lastWorld: ArcadeWorld | null = null;
  private lastScore = '';
  private lastRadioExpr = 0;
  private radioFullText = 'Canal livre.\nRota aberta!';
  private radioPages: string[] = ['Canal livre.\nRota aberta!'];
  private radioChanged = true;
  private radioSince = 0;

  constructor(scene: Phaser.Scene) {
    buildStaticTextures(scene);
    const label = (x: number, y: number, value: string, size: number,
      color = '#ffffff', originX = 0.5) => scene.add.text(x, y, value, {
        fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold',
        color, stroke: '#02132c', strokeThickness: 1.1,
      }).setResolution(3).setOrigin(originX, 0.5).setDepth(44).setVisible(false);

    this.chassis = scene.add.image(384, 216, 'bw-fenda-hud-native-base-v4')
      .setDisplaySize(768, 432).setDepth(39.5).setVisible(false);

    const missionArt = scene.add.image(80, 90, UI_TEX.hudRoutePelagic)
      .setDisplaySize(126, 52).setDepth(40).setVisible(false);
    this.routeThumb = missionArt;
    const sky = scene.add.image(80, 212, UI_TEX.hudPelagicSky)
      .setDisplaySize(128, 136).setDepth(40).setVisible(false);
    // Sprite real de pilots.webp, frame 0 — sem imagem do mockup.
    this.bayekPortrait = scene.add.sprite(80, 214, 'arc-pilots', 0)
      .setDisplaySize(132, 132).setDepth(41).setVisible(false);
    // Mesma arte original do Bayek, exibida inteira em vez de ampliar o rosto.
    // Logo original HD logo-arcade.webp: preservar proporção 1024:650.
    this.logo = scene.add.image(49, 410, UI_TEX.logo)
      .setDisplaySize(62, 39.4).setDepth(43).setVisible(false);

    const trim = scene.add.image(384, 216, 'bw-fenda-hud-native-trim-v4')
      .setDisplaySize(768, 432).setDepth(42).setVisible(false);

    const missionHeader = label(50, 24, 'MISSÃO', 12.5, '#08214d');
    this.missionName = label(81, 47, 'FENDA PELÁGICA', 13.25);
    const bayekName = label(80, 282, 'BAYEK', 17, '#071c3d');
    const radioHeader = label(28, 318, 'RÁDIO', 14, '#ffffff', 0);

    const shipName = label(630, 44, 'RIVET', 18, '#ffffff', 0);
    const shipClass = label(643, 65, 'VANGUARDA', 11.5, '#073364', 0);
    const weaponsHeader = label(643, 229, 'ARMAMENTO', 12.25, '#ffffff', 0);
    const bombHeader = label(650, 291, 'BOMBA', 13.5, '#ffffff', 0);
    const livesHeader = label(647, 351, 'VIDAS', 13.5, '#ffffff', 0);

    this.rivetSide = scene.add.sprite(688, 143, PELAGIC_RIVET_SHEET, 3)
      .setDisplaySize(114, 114).setDepth(43).setVisible(false);
    this.scoreValue = label(384, 8, '0', 16, '#ffffff');

    this.radioMessage = scene.add.text(22, 343, 'Canal livre.\nRota aberta!', {
      fontFamily: FONT, fontSize: '11.5px', fontStyle: 'bold',
      color: '#ffffff', stroke: '#06162e', strokeThickness: 0.9,
      wordWrap: { width: 117, useAdvancedWrap: true }, lineSpacing: 1.5,
    }).setResolution(3).setOrigin(0, 0).setDepth(45).setVisible(false);

    this.indicatorInk = scene.add.graphics().setDepth(44).setVisible(false);
    for (let i = 0; i < 5; i++) {
      this.hearts.push(scene.add.image(688, 385, 'bw-hud-heart-native-v4')
        .setDisplaySize(28, 28).setDepth(45).setVisible(false));
    }

    this.allNodes = [
      this.chassis, missionArt, sky, this.bayekPortrait, this.logo, trim,
      missionHeader, this.missionName, bayekName, radioHeader, shipName,
      shipClass, weaponsHeader, bombHeader, livesHeader, this.rivetSide,
      this.scoreValue, this.radioMessage, this.indicatorInk, ...this.hearts,
    ];
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.allNodes.forEach(node => node.setVisible(visible));
    if (!visible) {
      this.lastWorld = null;
      this.lastScore = '';
    }
  }

  isVisible(): boolean { return this.visible; }

  /** Mantém o texto completo enquanto houver gameplay; troca somente em nova transmissão. */
  setRadioMessage(value: string): void {
    const next = value.trim();
    if (!next || next === this.radioFullText) return;
    this.radioFullText = next;
    this.radioPages = this.paginateRadio(next);
    this.radioMessage.setText(this.radioPages[0]);
    this.radioChanged = true;
  }

  /** Quebra linhas longas em páginas legíveis; não apaga a mensagem entre transmissões. */
  private paginateRadio(message: string): string[] {
    const result: string[] = [];
    const lines: string[] = [];
    for (const paragraph of message.replace(/\\n/g, '\n').split('\n')) {
      let line = '';
      for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
        if (line && (line + ' ' + word).length > 20) {
          lines.push(line);
          line = word;
        } else line = line ? line + ' ' + word : word;
      }
      if (line) lines.push(line);
    }
    for (let i = 0; i < lines.length; i += 3) result.push(lines.slice(i, i + 3).join('\n'));
    return result.length ? result : [message];
  }

  private slot(g: Phaser.GameObjects.Graphics, x: number, y: number, active: boolean, bomb: boolean): void {
    const color = bomb ? 0xffac26 : COLORS.yellow;
    g.fillStyle(active ? color : 0x031733, 1).fillRoundedRect(x, y, 21, 13, 2.2);
    g.lineStyle(1.05, active ? 0xfff2a5 : COLORS.cyan, active ? 1 : .72)
      .strokeRoundedRect(x, y, 21, 13, 2.2);
    if (active) g.fillStyle(0xffffff, .42).fillRoundedRect(x + 2, y + 2, 17, 2, 1);
  }

  draw(
    world: ArcadeWorld,
    _decor: Phaser.GameObjects.Graphics,
    lifeIcons: Phaser.GameObjects.Image[],
    levelText: Phaser.GameObjects.Text,
    assistBadge: Phaser.GameObjects.Text,
    bossHudLabel: Phaser.GameObjects.Text,
    comms: PelagicCommsState | null,
    _introRadioActive: boolean,
    clock: number,
  ): void {
    if (!this.visible) this.setVisible(true);

    if (this.lastWorld !== world) {
      this.lastWorld = world;
      this.radioFullText = 'Canal livre.\nRota aberta!';
      this.radioPages = [this.radioFullText];
      this.radioMessage.setText(this.radioFullText);
      this.radioChanged = true;
      this.lastRadioExpr = 0;
    }
    if (comms?.text) this.setRadioMessage(comms.text);
    if (comms) this.lastRadioExpr = comms.expression;
    if (this.radioChanged) {
      this.radioChanged = false;
      this.radioSince = clock;
    }
    if (this.radioPages.length > 1) {
      const currentPage = Math.floor(Math.max(0, clock - this.radioSince) / 4.6) % this.radioPages.length;
      if (this.radioMessage.text !== this.radioPages[currentPage]) this.radioMessage.setText(this.radioPages[currentPage]);
    }

    this.missionName.setText(world.mission.name.toUpperCase());
    const score = String(Math.max(0, Math.floor(world.score)));
    if (this.lastScore !== score) {
      this.scoreValue.setText(score);
      this.lastScore = score;
    }

    // O texto de nível serve apenas à inspeção técnica. A UI mostra os 5 slots.
    levelText.setText('NV ' + world.weapons.weaponLevel).setVisible(false);
    lifeIcons.forEach(icon => icon.setVisible(false));

    assistBadge.setVisible(world.isAssisted);
    if (world.isAssisted) {
      assistBadge.setOrigin(.5).setPosition(687, 17)
        .setFontSize(8).setText('ASSISTIDO').setColor('#c5fff9');
    }

    // Indicadores reais: armamento, bomba e corações.
    const g = this.indicatorInk; g.clear();
    for (let i = 0; i < 5; i++) {
      this.slot(g, 627 + i * 26, 243, i < world.weapons.weaponLevel, false);
      this.slot(g, 627 + i * 26, 304, i < world.weapons.specialCharges, true);
    }
    const count = Math.max(0, Math.min(5, Math.floor(world.lives)));
    const show = count > 3 ? 5 : 3;
    const spacing = show === 3 ? 34 : 25;
    const startX = 688 - spacing * (show - 1) / 2;
    for (let i = 0; i < this.hearts.length; i++) {
      this.hearts[i].setVisible(i < show)
        .setPosition(startX + i * spacing, 381)
        .setDisplaySize(show === 3 ? 29 : 24, show === 3 ? 29 : 24)
        .setAlpha(i < count ? 1 : .17);
    }

    // Boss HP: só aparece em combate, sem obstruir a descida normal dos inimigos.
    if (world.boss?.sub && world.boss.sub.phase !== 'done') {
      const sub = world.boss.sub;
      const section = sub.sections[sub.activeSection];
      const hp = subTotalHp(sub);
      const ratio = hp.max > 0 ? Math.max(0, Math.min(1, hp.current / hp.max)) : 0;
      g.fillStyle(COLORS.dark, .92).fillRoundedRect(235, 22, 298, 16, 4);
      g.lineStyle(1, COLORS.cyan, .86).strokeRoundedRect(235, 22, 298, 16, 4);
      if (ratio) g.fillStyle(COLORS.yellow, .95).fillRoundedRect(382, 28, 143 * ratio, 6, 2);
      bossHudLabel.setPosition(242, 30).setFontSize(8)
        .setText((section.index + 1) + '/5 ' + section.name).setVisible(true);
    } else if (world.boss && world.boss.phase !== 'absent' &&
        world.boss.phase !== 'sink' && world.boss.parts.length) {
      const hp = world.boss.parts.reduce((sum, p) => sum + Math.max(0, p.hp), 0);
      const max = Math.max(1, world.boss.parts.reduce((sum, p) => sum + p.maxHp, 0));
      g.fillStyle(COLORS.dark, .92).fillRoundedRect(235, 22, 298, 16, 4);
      g.lineStyle(1, COLORS.cyan, .86).strokeRoundedRect(235, 22, 298, 16, 4);
      if (hp) g.fillStyle(0xff5870, .95).fillRoundedRect(382, 28, 143 * hp / max, 6, 2);
      bossHudLabel.setPosition(242, 30).setFontSize(8)
        .setText('FORÇA NAVAL').setVisible(hp > 0);
    } else bossHudLabel.setVisible(false);
  }

  snapshot(
    world: ArcadeWorld, levelText: Phaser.GameObjects.Text,
    _radioNode: Phaser.GameObjects.Text, pauseBtn?: Phaser.GameObjects.Container,
  ): PelagicHudStateSnapshot {
    return {
      visible: this.visible,
      scoreText: this.scoreValue.text,
      weaponLevel: world.weapons.weaponLevel,
      weaponLevelText: levelText.text,
      lives: world.lives,
      specialCharges: world.weapons.specialCharges,
      radioActive: this.radioFullText.length > 0,
      radioText: this.radioFullText,
      radioExpression: this.lastRadioExpr,
      assisted: world.isAssisted,
      pauseCenter: pauseBtn ? { x: pauseBtn.x, y: pauseBtn.y } : null,
      arena: {
        left: world.arena.left, right: world.arena.right,
        top: world.arena.top, bottom: world.arena.bottom, width: world.arenaWidth,
      },
    };
  }

  getLevelTextPreview(levelText: Phaser.GameObjects.Text): string {
    return levelText.text;
  }
}
