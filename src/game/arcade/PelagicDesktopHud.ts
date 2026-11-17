import Phaser from 'phaser';
import { UI_TEX } from './ArcadeMenuArt';
import type { ArcadeWorld } from './ArcadeWorld';
import type { PelagicCommsState } from './PelagicComms';
import { PELAGIC_RIVET_SHEET } from './PelagicActorAnimsMath';
import { subTotalHp } from './PelagicSubmarineBoss';

/**
 * HUD aprovada — Fenda Pelágica desktop, coordenadas virtuais 768x432.
 * Esquerda: 0..184; gameplay: 184..584; direita: 584..768.
 * Sem chassis rasterizado antigo, bordas horizontais ou barra superior.
 */
const FONT = 'Oxanium, Trebuchet MS, sans-serif';
const LEFT = 184;
const RIGHT = 584;
const C = {
  navy: 0x041839, card: 0x082b61, cyan: 0x3fe7ff,
  gold: 0xffde30, white: 0xf0faff, dark: 0x02122e,
  muted: 0x2a4775, red: 0xff516c,
} as const;
type VisibleNode = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

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

export class PelagicDesktopHud {
  readonly chassis: Phaser.GameObjects.Graphics;
  readonly frames: Phaser.GameObjects.Graphics;
  readonly routeThumb: Phaser.GameObjects.Image;
  readonly bayekPortrait: Phaser.GameObjects.Sprite;
  readonly logo: Phaser.GameObjects.Image;
  readonly rivetSide: Phaser.GameObjects.Sprite;
  readonly scoreValue: Phaser.GameObjects.Text;
  private readonly radioMessage: Phaser.GameObjects.Text;
  private readonly missionName: Phaser.GameObjects.Text;
  private readonly allNodes: VisibleNode[];
  private visible = false;
  private lastScoreStr = '';
  private lastRadioExpr = 0;
  private lastWorld?: ArcadeWorld;

  constructor(scene: Phaser.Scene) {
    const mkText = (x: number, y: number, value: string, size: number, color = '#ffffff',
      ox = 0.5, oy = 0.5, depth = 43) => scene.add.text(x, y, value, {
        fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold italic',
        color, stroke: '#03152f', strokeThickness: 2,
      }).setResolution(2).setOrigin(ox, oy).setDepth(depth).setVisible(false);

    this.chassis = scene.add.graphics().setDepth(39.6).setVisible(false);
    this.drawCabinet(this.chassis);
    this.frames = scene.add.graphics().setDepth(41.5).setVisible(false);
    this.drawFrames(this.frames);

    this.routeThumb = scene.add.image(92, 88, UI_TEX.hudRoutePelagic)
      .setDisplaySize(149, 65).setDepth(40.5).setVisible(false);
    const missionTag = mkText(23, 23, 'MISSÃO', 11, '#061e48', 0);
    this.missionName = mkText(92, 44, 'FENDA PELÁGICA', 12);
    const sky = scene.add.image(92, 210, UI_TEX.hudPelagicSky)
      .setDisplaySize(151, 149).setDepth(40.1).setVisible(false);
    this.bayekPortrait = scene.add.sprite(92, 210, 'arc-pilots', 0)
      .setDisplaySize(151, 149).setDepth(40.8).setVisible(false);
    const bayekName = mkText(92, 283, 'BAYEK', 15, '#071b41');
    const radioTitle = mkText(33, 318, 'RÁDIO', 11, '#ffffff', 0);
    this.radioMessage = scene.add.text(19, 342, 'Canal livre.\nRota aberta!', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold italic',
      color: '#e9f7ff', stroke: '#03122b', strokeThickness: 1.4,
      wordWrap: { width: 145, useAdvancedWrap: true }, lineSpacing: 2,
    }).setResolution(2).setOrigin(0, 0).setDepth(43).setVisible(false);
    this.logo = scene.add.image(51, 408, UI_TEX.logo)
      .setDisplaySize(75, 34).setDepth(42).setVisible(false);

    const shipTexture = scene.textures.exists(PELAGIC_RIVET_SHEET) ? PELAGIC_RIVET_SHEET : 'arc-rivet';
    this.rivetSide = scene.add.sprite(676, 144, shipTexture, shipTexture === PELAGIC_RIVET_SHEET ? 3 : 1)
      .setDisplaySize(112, 112).setDepth(43).setVisible(false);
    const shipName = mkText(607, 48, 'RIVET', 16, '#ffffff', 0);
    const shipRole = mkText(614, 67, 'VANGUARDA', 10, '#042f64', 0);
    const weaponTitle = mkText(617, 241, 'ARMAMENTO', 11, '#ffffff', 0);
    const bombTitle = mkText(618, 307, 'BOMBA', 12, '#ffffff', 0);
    const livesTitle = mkText(618, 372, 'VIDAS', 12, '#ffffff', 0);
    this.scoreValue = mkText(384, 9, '0', 16, '#ffffff', 0.5, 0.5, 45);

    this.allNodes = [
      this.chassis, this.frames, this.routeThumb, missionTag, this.missionName,
      sky, this.bayekPortrait, bayekName, radioTitle, this.radioMessage, this.logo,
      this.rivetSide, shipName, shipRole, weaponTitle, bombTitle, livesTitle, this.scoreValue,
    ];
  }

  private card(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(C.dark, 0.98).fillRoundedRect(x, y, w, h, 7);
    g.fillStyle(C.card, 0.5).fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 5);
    g.lineStyle(1.35, C.cyan, 0.86).strokeRoundedRect(x, y, w, h, 7);
    g.lineStyle(0.55, 0xd0faff, 0.3).strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 5);
  }

  private drawCabinet(g: Phaser.GameObjects.Graphics): void {
    // O centro nunca recebe preenchimento: o cenário ocupa 100% da altura.
    g.fillStyle(0x063582, 1).fillRect(0, 0, LEFT, 432);
    g.fillStyle(0x063582, 1).fillRect(RIGHT, 0, 184, 432);
    g.lineStyle(0.5, 0x81cbff, 0.12);
    for (let y = 16; y < 432; y += 18) {
      g.lineBetween(0, y, LEFT, y); g.lineBetween(RIGHT, y, 768, y);
    }
    for (let x = 0; x < LEFT; x += 18) g.lineBetween(x, 0, x, 432);
    for (let x = RIGHT; x < 768; x += 18) g.lineBetween(x, 0, x, 432);

    this.card(g, 9, 12, 166, 110);
    this.card(g, 9, 131, 166, 163);
    this.card(g, 9, 304, 166, 84);
    this.card(g, 593, 31, 166, 191);
    this.card(g, 593, 230, 166, 60);
    this.card(g, 593, 297, 166, 60);
    this.card(g, 593, 363, 166, 61);

    g.fillStyle(C.gold, 1).fillRoundedRect(17, 15, 81, 17, 4);
    g.fillStyle(C.cyan, 1).fillRoundedRect(608, 58, 93, 17, 3);
    g.fillStyle(C.dark, 0.88).fillRoundedRect(605, 81, 141, 128, 7);
    g.lineStyle(0.8, C.cyan, 0.25).strokeCircle(676, 144, 46);

    // Placar minimalista COLADO no topo do campo (não invade rota dos aviões).
    g.fillStyle(C.dark, 0.94).fillRoundedRect(340, 0, 88, 18, 4);
    g.lineStyle(1.1, C.cyan, 0.9).strokeRoundedRect(340, 0, 88, 18, 4);
    g.fillStyle(C.gold, 1).fillRect(347, 0, 11, 3).fillRect(410, 0, 11, 3);

    // Bordas SOMENTE verticais no campo central.
    g.lineStyle(1.2, C.cyan, 0.75);
    g.lineBetween(LEFT, 0, LEFT, 432);
    g.lineBetween(RIGHT, 0, RIGHT, 432);
  }

  private drawFrames(g: Phaser.GameObjects.Graphics): void {
    g.lineStyle(1.35, C.cyan, 0.96).strokeRoundedRect(17, 54, 150, 67, 5);
    g.lineStyle(1.5, C.cyan, 0.96).strokeRoundedRect(17, 136, 150, 148, 5);
    g.fillStyle(C.gold, 1).fillRoundedRect(45, 272, 94, 23, 5);
    g.lineStyle(1, 0x031730, 0.95).strokeRoundedRect(45, 272, 94, 23, 5);
    g.lineStyle(1, C.cyan, 0.5).strokeRoundedRect(14, 338, 156, 44, 5);
    g.lineStyle(1.3, C.cyan, 0.7).strokeRoundedRect(604, 80, 143, 130, 7);
  }

  setVisible(show: boolean): void {
    if (this.visible === show) return;
    this.visible = show;
    for (const node of this.allNodes) node.setVisible(show);
    if (!show) { this.lastScoreStr = ''; this.lastWorld = undefined; }
  }

  isVisible(): boolean { return this.visible; }

  draw(
    world: ArcadeWorld, g: Phaser.GameObjects.Graphics,
    lifeIcons: Phaser.GameObjects.Image[], levelText: Phaser.GameObjects.Text,
    assistBadge: Phaser.GameObjects.Text, bossHudLabel: Phaser.GameObjects.Text,
    comms: PelagicCommsState | null, introRadioActive: boolean, clock: number,
  ): void {
    if (!this.visible) this.setVisible(true);
    if (this.lastWorld !== world) {
      this.lastWorld = world;
      this.radioMessage.setText('Canal livre.\nRota aberta!');
      this.lastRadioExpr = 0;
    }
    this.missionName.setText(world.mission.name.toUpperCase());
    const score = String(Math.max(0, Math.floor(world.score)));
    if (score !== this.lastScoreStr) {
      this.scoreValue.setText(score); this.lastScoreStr = score;
    }
    if (comms?.text && this.radioMessage.text !== comms.text) this.radioMessage.setText(comms.text);
    if (comms) this.lastRadioExpr = comms.expression;

    // Reutilizar o spritesheet REAL da mesma nave da gameplay.
    if (this.rivetSide.texture.key !== PELAGIC_RIVET_SHEET &&
        this.rivetSide.scene.textures.exists(PELAGIC_RIVET_SHEET)) {
      this.rivetSide.setTexture(PELAGIC_RIVET_SHEET, 3);
    }

    // A telemetria segue acessível ao modo DEV, sem exibir uma segunda barra.
    levelText.setStyle({
      fontFamily: FONT, fontSize: '9px', fontStyle: 'bold',
      color: '#ffe98f', stroke: '#04122b', strokeThickness: 2,
    }).setResolution(2).setOrigin(1, 0.5).setPosition(747, 242)
      .setText('NV ' + world.weapons.weaponLevel).setVisible(true);

    for (let i = 0; i < 5; i++) {
      const x = 608 + i * 29;
      const active = i < world.weapons.weaponLevel;
      g.fillStyle(active ? C.gold : C.dark, 1).fillRoundedRect(x, 262, 24, 17, 3);
      g.lineStyle(1, active ? 0xfff5b5 : C.cyan, active ? 1 : 0.65)
        .strokeRoundedRect(x, 262, 24, 17, 3);
      if (active) g.fillStyle(0xffffff, 0.35).fillRoundedRect(x + 2, 264, 20, 3, 1);
    }

    // BOMBA (especial) tem medidor próprio, sem confundir com armamento.
    for (let i = 0; i < 5; i++) {
      const x = 608 + i * 29;
      const active = i < world.weapons.specialCharges;
      g.fillStyle(active ? 0xffac23 : C.dark, 1).fillRoundedRect(x, 328, 24, 17, 3);
      g.lineStyle(1, active ? 0xfff09c : C.cyan, active ? 1 : 0.65)
        .strokeRoundedRect(x, 328, 24, 17, 3);
      if (active) g.fillStyle(0xfff9be, 0.45).fillRoundedRect(x + 2, 330, 20, 3, 1);
    }

    lifeIcons.forEach(sprite => sprite.setVisible(false));
    const maxIcons = 5;
    const slots = Math.max(3, Math.min(maxIcons, Math.round(world.lives)));
    const spacing = slots > 3 ? 28 : 40;
    const start = 676 - spacing * (slots - 1) / 2;
    for (let i = 0; i < slots; i++) heart(g, start + i * spacing, 402, i < world.lives);

    const speaking = !!comms || introRadioActive;
    g.fillStyle(C.cyan, 0.95).fillCircle(22, 318, 2.1);
    for (let i = 0; i < 5; i++) {
      const h = speaking ? 4 + 7 * Math.abs(Math.sin(clock * 10 + i)) : 3;
      g.fillStyle(C.cyan, speaking ? 0.9 : 0.35)
        .fillRoundedRect(138 + i * 6, 318 - h / 2, 3, h, 1);
    }

    assistBadge.setVisible(world.isAssisted);
    if (world.isAssisted) assistBadge.setOrigin(0.5).setPosition(685, 17)
      .setText('ASSISTIDO').setFontSize(8).setColor('#9dfff8');

    if (world.boss?.sub && world.boss.sub.phase !== 'done') {
      const sub = world.boss.sub;
      const section = sub.sections[sub.activeSection];
      const totals = subTotalHp(sub);
      const ratio = totals.max ? Math.max(0, Math.min(1, totals.current / totals.max)) : 0;
      g.fillStyle(C.dark, 0.93).fillRoundedRect(237, 24, 294, 16, 5);
      g.lineStyle(1, C.cyan, 0.8).strokeRoundedRect(237, 24, 294, 16, 5);
      if (ratio) g.fillStyle(C.gold, 0.95).fillRoundedRect(383, 30, 139 * ratio, 6, 2);
      bossHudLabel.setPosition(243, 32).setFontSize(8.5)
        .setText((section.index + 1) + '/5 ' + section.name).setVisible(true);
    } else if (world.boss && world.boss.phase !== 'absent' &&
        world.boss.phase !== 'sink' && world.boss.parts.length > 0) {
      const current = world.boss.parts.reduce((sum, p) => sum + Math.max(0, p.hp), 0);
      const max = Math.max(1, world.boss.parts.reduce((sum, p) => sum + p.maxHp, 0));
      g.fillStyle(C.dark, 0.93).fillRoundedRect(237, 24, 294, 16, 5);
      g.lineStyle(1, C.cyan, 0.8).strokeRoundedRect(237, 24, 294, 16, 5);
      if (current) g.fillStyle(C.red, 0.95).fillRoundedRect(383, 30, 139 * current / max, 6, 2);
      bossHudLabel.setPosition(243, 32).setFontSize(8.5)
        .setText('FORÇA NAVAL').setVisible(current > 0);
    } else bossHudLabel.setVisible(false);
  }

  snapshot(
    world: ArcadeWorld, levelText: Phaser.GameObjects.Text,
    _radioTextNode: Phaser.GameObjects.Text, pauseBtn?: Phaser.GameObjects.Container,
  ): PelagicHudStateSnapshot {
    return {
      visible: this.visible, scoreText: this.scoreValue.text,
      weaponLevel: world.weapons.weaponLevel, weaponLevelText: levelText.text,
      lives: world.lives, specialCharges: world.weapons.specialCharges,
      radioActive: this.radioMessage.text.length > 0,
      radioText: this.radioMessage.text, radioExpression: this.lastRadioExpr,
      assisted: !!world.isAssisted,
      pauseCenter: pauseBtn ? { x: pauseBtn.x, y: pauseBtn.y } : null,
      arena: {
        left: world.arena.left, right: world.arena.right,
        top: world.arena.top, bottom: world.arena.bottom, width: world.arenaWidth,
      },
    };
  }

  getLevelTextPreview(levelText: Phaser.GameObjects.Text): string { return levelText.text; }
}

function heart(g: Phaser.GameObjects.Graphics, x: number, y: number, active: boolean): void {
  g.fillStyle(active ? 0xff526d : C.muted, active ? 1 : 0.4);
  g.fillCircle(x - 5, y - 4, 6);
  g.fillCircle(x + 5, y - 4, 6);
  g.fillTriangle(x - 11, y - 2, x + 11, y - 2, x, y + 11);
  g.lineStyle(1.25, active ? 0xffd4e0 : 0x5b7b9a, active ? 0.9 : 0.35);
  g.lineBetween(x - 9, y + 1, x, y + 10);
  g.lineBetween(x, y + 10, x + 9, y + 1);
}
