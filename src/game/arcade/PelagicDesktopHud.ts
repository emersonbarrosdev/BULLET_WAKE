import Phaser from 'phaser';
import { UI_TEX } from './ArcadeMenuArt';
import { PELAGIC_RIVET_SHEET } from './PelagicActorAnimsMath';
import type { ArcadeWorld } from './ArcadeWorld';
import type { PelagicCommsState } from './PelagicComms';
import { subTotalHp } from './PelagicSubmarineBoss';

/**
 * BULLET WAKE — Fenda Pelágica, HUD desktop aprovada.
 * Virtual resolution: 768 × 432. Left panel: 0..160; arena: 160..608;
 * right panel: 608..768. No horizontal borders covering the arena.
 *
 * All panels use Phaser Graphics directly, not screenshot crops or
 * full-screen Canvas textures. Bayek, ship and route art are real game assets.
 */
const W = 768;
const H = 432;
const LEFT = 160;
const RIGHT = 608;
const FONT = 'Trebuchet MS, Segoe UI, Arial, sans-serif';
const INK = 0x03152f;
const CYAN = 0x38e7ff;
const GOLD = 0xffdc32;

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
  readonly scoreValue: Phaser.GameObjects.Text;
  readonly bayekPortrait: Phaser.GameObjects.Image;
  readonly rivetSide: Phaser.GameObjects.Sprite;

  private readonly trim: Phaser.GameObjects.Graphics;
  private readonly missionTitle: Phaser.GameObjects.Text;
  private readonly radioText: Phaser.GameObjects.Text;
  private readonly livesNumber: Phaser.GameObjects.Text;
  private readonly dynamic: Phaser.GameObjects.Graphics;
  private readonly nodes: VisibleNode[];
  private lastWorld: ArcadeWorld | null = null;
  private lastScore = '';
  private lastRadioText = 'Canal livre.\nRota aberta!';
  private radioPages = ['Canal livre.\nRota aberta!'];
  private radioReceivedAt = 0;
  private radioNeedsTimeReset = true;
  private lastRadioExpr = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    const label = (
      x: number, y: number, value: string, size: number,
      color = '#f4faff', ox = 0.5, strong = false,
    ) => scene.add.text(x, y, value, {
      fontFamily: FONT, fontSize: size + 'px',
      fontStyle: strong ? 'bold' : 'normal',
      color, stroke: '#06162e', strokeThickness: strong ? 0.9 : 0.35,
    }).setResolution(3).setOrigin(ox, 0.5).setDepth(45).setVisible(false);

    // Never draw over the central gameplay. These rectangles are SIDES ONLY.
    this.chassis = scene.add.graphics().setDepth(39.5).setVisible(false);
    this.buildSidePanels(this.chassis);

    const route = scene.add.image(80, 88, UI_TEX.hudRoutePelagic)
      .setDisplaySize(124, 52).setDepth(40.4).setVisible(false);
    // The original HD Bayek illustration is preloaded by ArcadeMenuArt.
    this.bayekPortrait = scene.add.image(80, 211, UI_TEX.hudBayekHd)
      .setDisplaySize(129, 139).setDepth(40.4).setVisible(false);
    this.rivetSide = scene.add.sprite(688, 144, PELAGIC_RIVET_SHEET, 3)
      .setDisplaySize(85, 85).setDepth(43).setVisible(false);

    this.trim = scene.add.graphics().setDepth(42).setVisible(false);
    this.buildTrim(this.trim);

    const missionTag = label(53, 24, 'MISSÃO', 11, '#07254d', 0.5, true);
    this.missionTitle = label(80, 46, 'FENDA PELÁGICA', 12.6, '#ffffff', 0.5, true);
    const bayekName = label(80, 287, 'BAYEK', 15, '#09234a', 0.5, true);
    const radioTitle = label(35, 320, 'RÁDIO', 12.5, '#ffffff', 0, true);

    const shipTitle = label(629, 46, 'RIVET', 17, '#ffffff', 0, true);
    const classTitle = label(644, 66, 'VANGUARDA', 10.7, '#042b57', 0, true);
    const powerTitle = label(642, 230, 'POWER', 12.2, '#ffffff', 0, true);
    const specialTitle = label(642, 289, 'ESPECIAL', 12.2, '#ffffff', 0, true);
    const livesTitle = label(644, 351, 'VIDAS', 12.2, '#ffffff', 0, true);
    this.livesNumber = label(699, 382, '× 3', 21, '#ffffff', 0, true);
    this.scoreValue = label(384, 7.5, '0', 15, '#ffffff', 0.5, true);

    this.radioText = scene.add.text(21, 345, this.lastRadioText, {
      fontFamily: FONT, fontSize: '10.7px', fontStyle: 'normal',
      color: '#f3faff', stroke: '#04152e', strokeThickness: 0.3,
      wordWrap: { width: 118, useAdvancedWrap: true },
      lineSpacing: 1.7,
    }).setResolution(3).setOrigin(0, 0).setDepth(45).setVisible(false);

    this.dynamic = scene.add.graphics().setDepth(44).setVisible(false);

    this.nodes = [
      this.chassis, route, this.bayekPortrait, this.rivetSide, this.trim,
      missionTag, this.missionTitle, bayekName, radioTitle, shipTitle,
      classTitle, powerTitle, specialTitle, livesTitle, this.livesNumber,
      this.scoreValue, this.radioText, this.dynamic,
    ];
  }

  private section(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(INK, 0.97).fillRoundedRect(x, y, w, h, 7);
    g.fillStyle(0x0a3267, 0.53).fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 5);
    g.lineStyle(5, 0x1a9ed4, 0.16).strokeRoundedRect(x, y, w, h, 7);
    g.lineStyle(1.4, CYAN, 0.96).strokeRoundedRect(x, y, w, h, 7);
    g.lineStyle(0.6, 0xb5faff, 0.55).strokeRoundedRect(x + 2.5, y + 2.5, w - 5, h - 5, 5);
  }

  private stripes(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    g.fillStyle(GOLD, 1);
    for (let i = 0; i < 3; i++) {
      const px = x + i * 7.2;
      g.fillTriangle(px + 7, y, px + 12, y, px + 4, y + 10);
      g.fillTriangle(px + 7, y, px + 4, y + 10, px, y + 10);
    }
  }

  private buildSidePanels(g: Phaser.GameObjects.Graphics): void {
    g.fillStyle(0x052c70, 1).fillRect(0, 0, LEFT, H);
    g.fillStyle(0x052c70, 1).fillRect(RIGHT, 0, W - RIGHT, H);
    g.lineStyle(0.45, 0x90cdff, 0.13);
    for (let y = 15; y < H; y += 19) {
      g.lineBetween(0, y, LEFT, y);
      g.lineBetween(RIGHT, y, W, y);
    }
    for (let x = 0; x < LEFT; x += 19) g.lineBetween(x, 0, x, H);
    for (let x = RIGHT; x < W; x += 19) g.lineBetween(x, 0, x, H);

    this.section(g, 7, 9, 146, 111);    // Mission
    this.section(g, 7, 127, 146, 177);  // Bayek
    this.section(g, 7, 311, 146, 111);  // Radio: fills former logo space
    this.section(g, 616, 30, 145, 179); // RIVET
    this.section(g, 616, 217, 145, 54); // Power
    this.section(g, 616, 279, 145, 54); // Special
    this.section(g, 616, 341, 145, 72); // Lives

    // Score plate is the ONLY horizontal overlay, attached to y=0.
    g.fillStyle(INK, 0.94).fillRoundedRect(340, 0, 88, 16, 3);
    g.lineStyle(1, CYAN, 0.95).strokeRoundedRect(340, 0, 88, 16, 3);
    g.fillStyle(GOLD, 1);
    g.fillTriangle(341, 0, 353, 0, 346, 8);
    g.fillTriangle(427, 0, 415, 0, 422, 8);

    // Only subtle vertical arena seams. Never a bar on top or bottom.
    g.lineStyle(1.15, CYAN, 0.75);
    g.lineBetween(LEFT, 0, LEFT, H);
    g.lineBetween(RIGHT, 0, RIGHT, H);
  }

  private buildTrim(g: Phaser.GameObjects.Graphics): void {
    // Mission badge and natural image borders.
    g.fillStyle(GOLD, 1).fillRoundedRect(17, 15, 79, 18, 3);
    this.stripes(g, 124, 19);
    g.lineStyle(1.35, CYAN, 0.95).strokeRoundedRect(17, 61, 126, 54, 4);
    g.lineStyle(1.4, CYAN, 0.9).strokeRoundedRect(15, 140, 130, 142, 5);
    g.fillStyle(GOLD, 1).fillRoundedRect(39, 277, 82, 22, 3);
    this.stripes(g, 123, 281);

    // Radio area: its own larger window, no duplicate portrait.
    g.lineStyle(1.1, CYAN, 0.86).strokeRoundedRect(15, 338, 130, 76, 4);
    this.stripes(g, 125, 316);

    g.fillStyle(0x052149, 0.8).fillRoundedRect(625, 79, 127, 121, 5);
    g.lineStyle(1, CYAN, 0.83).strokeRoundedRect(625, 79, 127, 121, 5);
    g.lineStyle(0.6, 0x3ddcff, 0.3).strokeCircle(688, 143, 43);

    g.fillStyle(0x3fe5f9, 1).fillRoundedRect(635, 58, 103, 17, 3);
    this.stripes(g, 739, 45);
    this.stripes(g, 739, 226);
    this.stripes(g, 739, 287);
    this.stripes(g, 739, 348);

    // Clean heart with a red fill and white specular highlights.
    const hx = 666, hy = 383;
    g.fillStyle(0xff416a, 1);
    g.fillCircle(hx - 6, hy - 4, 8);
    g.fillCircle(hx + 6, hy - 4, 8);
    g.fillTriangle(hx - 13, hy - 2, hx + 13, hy - 2, hx, hy + 13);
    g.lineStyle(1.2, 0xffdfeb, 0.95);
    g.lineBetween(hx - 11, hy + 1, hx, hy + 11);
    g.lineBetween(hx, hy + 11, hx + 11, hy + 1);
    g.lineStyle(1.5, 0xffffff, 0.8);
    g.lineBetween(hx - 9, hy - 8, hx - 4, hy - 10);
  }

  setVisible(show: boolean): void {
    if (this.visible === show) return;
    this.visible = show;
    for (const node of this.nodes) node.setVisible(show);
    if (!show) {
      this.lastScore = '';
      this.lastWorld = null;
    }
  }

  isVisible(): boolean { return this.visible; }

  /** Preserve a transmission until the next one, without overflowing the card. */
  setRadioMessage(text: string): void {
    const next = text.trim().replace(/\\n/g, '\n');
    if (!next || next === this.lastRadioText) return;
    this.lastRadioText = next;
    const lines: string[] = [];
    for (const paragraph of next.split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && (line + ' ' + word).length > 20) {
          lines.push(line);
          line = word;
        } else {
          line = line ? line + ' ' + word : word;
        }
      }
      if (line) lines.push(line);
    }
    const pages: string[] = [];
    for (let i = 0; i < lines.length; i += 4) pages.push(lines.slice(i, i + 4).join('\n'));
    this.radioPages = pages.length ? pages : [next];
    this.radioText.setText(this.radioPages[0]);
    this.radioNeedsTimeReset = true;
  }

  private slot(g: Phaser.GameObjects.Graphics, x: number, y: number, on: boolean, special: boolean): void {
    const activeColor = special ? 0xffb32a : GOLD;
    g.fillStyle(on ? activeColor : 0x031a3c, 1).fillRoundedRect(x, y, 21, 14, 2.3);
    g.lineStyle(1, on ? 0xffef99 : CYAN, on ? 1 : 0.78)
      .strokeRoundedRect(x, y, 21, 14, 2.3);
    if (on) g.fillStyle(0xffffff, 0.36).fillRoundedRect(x + 2, y + 2, 17, 2, 1);
  }

  draw(
    world: ArcadeWorld,
    g: Phaser.GameObjects.Graphics,
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
      this.lastRadioText = 'Canal livre.\nRota aberta!';
      this.radioPages = [this.lastRadioText];
      this.radioText.setText(this.lastRadioText);
      this.radioNeedsTimeReset = true;
    }
    if (comms?.text) {
      this.setRadioMessage(comms.text);
      this.lastRadioExpr = comms.expression;
    }
    if (this.radioNeedsTimeReset) {
      this.radioReceivedAt = clock;
      this.radioNeedsTimeReset = false;
    }
    if (this.radioPages.length > 1) {
      const page = Math.floor(Math.max(0, clock - this.radioReceivedAt) / 4.5) % this.radioPages.length;
      if (this.radioText.text !== this.radioPages[page]) this.radioText.setText(this.radioPages[page]);
    }
    this.missionTitle.setText(world.mission.name.toUpperCase());

    const score = String(Math.max(0, Math.floor(world.score)));
    if (score !== this.lastScore) {
      this.scoreValue.setText(score);
      this.lastScore = score;
    }
    levelText.setText('NV ' + world.weapons.weaponLevel).setVisible(false);
    lifeIcons.forEach(sprite => sprite.setVisible(false));
    assistBadge.setVisible(false);

    const ink = this.dynamic;
    ink.clear();
    for (let i = 0; i < 5; i++) {
      this.slot(ink, 628 + 26 * i, 246, i < world.weapons.weaponLevel, false);
      this.slot(ink, 628 + 26 * i, 307, i < world.weapons.specialCharges, true);
    }
    this.livesNumber.setText('× ' + Math.max(0, Math.floor(world.lives)));

    // Boss meter uses real gameplay HP; only visible during a confrontation.
    if (world.boss?.sub && world.boss.sub.phase !== 'done') {
      const sub = world.boss.sub;
      const section = sub.sections[sub.activeSection];
      const totals = subTotalHp(sub);
      const ratio = totals.max ? Math.max(0, Math.min(1, totals.current / totals.max)) : 0;
      g.fillStyle(INK, 0.95).fillRoundedRect(230, 23, 308, 16, 4);
      g.lineStyle(1.1, CYAN, 0.9).strokeRoundedRect(230, 23, 308, 16, 4);
      if (ratio) g.fillStyle(GOLD, 1).fillRoundedRect(385, 28, 143 * ratio, 6, 2);
      bossHudLabel.setPosition(236, 30).setFontSize(8)
        .setText((section.index + 1) + '/5 ' + section.name).setVisible(true);
    } else if (world.boss && world.boss.phase !== 'absent' &&
      world.boss.phase !== 'sink' && world.boss.parts.length > 0) {
      const current = world.boss.parts.reduce((sum, p) => sum + Math.max(0, p.hp), 0);
      const maximum = Math.max(1, world.boss.parts.reduce((sum, p) => sum + p.maxHp, 0));
      const ratio = current / maximum;
      if (current) {
        g.fillStyle(INK, 0.95).fillRoundedRect(230, 23, 308, 16, 4);
        g.lineStyle(1.1, CYAN, 0.9).strokeRoundedRect(230, 23, 308, 16, 4);
        g.fillStyle(0xff5966, 1).fillRoundedRect(385, 28, 143 * ratio, 6, 2);
      }
      bossHudLabel.setPosition(236, 30).setFontSize(8)
        .setText('FORÇA NAVAL').setVisible(current > 0);
    } else {
      bossHudLabel.setVisible(false);
    }
  }

  snapshot(
    world: ArcadeWorld,
    levelText: Phaser.GameObjects.Text,
    _radioTextNode: Phaser.GameObjects.Text,
    pauseBtn?: Phaser.GameObjects.Container,
  ): PelagicHudStateSnapshot {
    return {
      visible: this.visible,
      scoreText: this.scoreValue.text,
      weaponLevel: world.weapons.weaponLevel,
      weaponLevelText: levelText.text,
      lives: world.lives,
      specialCharges: world.weapons.specialCharges,
      radioActive: !!this.lastRadioText,
      radioText: this.lastRadioText,
      radioExpression: this.lastRadioExpr,
      assisted: world.isAssisted,
      pauseCenter: pauseBtn ? { x: pauseBtn.x, y: pauseBtn.y } : null,
      arena: {
        left: world.arena.left, right: world.arena.right,
        top: world.arena.top, bottom: world.arena.bottom,
        width: world.arenaWidth,
      },
    };
  }
}