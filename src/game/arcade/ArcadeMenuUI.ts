import Phaser from 'phaser';
import { UI, UI_FONT } from './ArcadeMenuArt';
import { padLabels } from '../systems/gamepadInput';

export type MenuButtonVariant = 'primary' | 'secondary' | 'back' | 'tab' | 'optionRow';

export interface ArcadeMenuButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  variant: MenuButtonVariant;
  fontSize?: number;
  disabled?: boolean;
  activeTab?: boolean;
  noLabel?: boolean;
  showArrows?: boolean;
  parent?: Phaser.GameObjects.Container;
  onFocus?: () => void;
  onClick: () => void;
  onLeft?: () => void;
  onRight?: () => void;
}

interface Palette {
  fillTop: number;
  fillBot: number;
  border: number;
  innerRim: number;
  accent: number;
  text: string;
  stroke: string;
  strokeThickness: number;
}

const PALETTES: Record<MenuButtonVariant, { idle: Palette; focus: Palette; disabled: Palette }> = {
  primary: {
    idle: {
      fillTop: 0x164488,
      fillBot: 0x0a224d,
      border: 0xffd24a,
      innerRim: 0x5be8ff,
      accent: 0xffdf5a,
      text: '#fff8d6',
      stroke: '#061938',
      strokeThickness: 3,
    },
    focus: {
      fillTop: 0xffe96b,
      fillBot: 0xf4a11a,
      border: 0xfff8cc,
      innerRim: 0x4ce6ff,
      accent: 0x082147,
      text: '#071a38',
      stroke: '#fff6b8',
      strokeThickness: 2.2,
    },
    disabled: {
      fillTop: 0x12223d,
      fillBot: 0x0a1529,
      border: 0x355078,
      innerRim: 0x203556,
      accent: 0x4f6d96,
      text: '#7f99bd',
      stroke: '#040d1e',
      strokeThickness: 2.5,
    },
  },
  secondary: {
    idle: {
      fillTop: 0x133873,
      fillBot: 0x081d42,
      border: 0x3dc8f5,
      innerRim: 0x7aeaff,
      accent: 0x4ce6ff,
      text: '#edf7ff',
      stroke: '#05142e',
      strokeThickness: 3,
    },
    focus: {
      fillTop: 0x1e60b8,
      fillBot: 0x0e3470,
      border: 0xffdf5a,
      innerRim: 0x8ef3ff,
      accent: 0xffdf5a,
      text: '#fff5b8',
      stroke: '#05142e',
      strokeThickness: 3.2,
    },
    disabled: {
      fillTop: 0x101f38,
      fillBot: 0x091326,
      border: 0x2e466b,
      innerRim: 0x1f3352,
      accent: 0x4b688f,
      text: '#7a94b8',
      stroke: '#040d1e',
      strokeThickness: 2.5,
    },
  },
  back: {
    idle: {
      fillTop: 0x112d5c,
      fillBot: 0x081838,
      border: 0x4aa8d8,
      innerRim: 0x7cd8ff,
      accent: 0x7cd8ff,
      text: '#d6ecff',
      stroke: '#05142e',
      strokeThickness: 2.8,
    },
    focus: {
      fillTop: 0x1b4e96,
      fillBot: 0x0d2b5c,
      border: 0xffdf5a,
      innerRim: 0x62ecff,
      accent: 0xffdf5a,
      text: '#fff4b5',
      stroke: '#05142e',
      strokeThickness: 3,
    },
    disabled: {
      fillTop: 0x101f38,
      fillBot: 0x091326,
      border: 0x2e466b,
      innerRim: 0x1f3352,
      accent: 0x4b688f,
      text: '#7a94b8',
      stroke: '#040d1e',
      strokeThickness: 2.5,
    },
  },
  tab: {
    idle: {
      fillTop: 0x102e61,
      fillBot: 0x081a3d,
      border: 0x3596cc,
      innerRim: 0x5cd8ff,
      accent: 0x4ce6ff,
      text: '#cde7ff',
      stroke: '#05142e',
      strokeThickness: 2.5,
    },
    focus: {
      fillTop: 0xffe462,
      fillBot: 0xf29f18,
      border: 0xfff8cc,
      innerRim: 0x4ce6ff,
      accent: 0x071b3b,
      text: '#071a38',
      stroke: '#fff5b0',
      strokeThickness: 2,
    },
    disabled: {
      fillTop: 0x101f38,
      fillBot: 0x091326,
      border: 0x2e466b,
      innerRim: 0x1f3352,
      accent: 0x4b688f,
      text: '#7a94b8',
      stroke: '#040d1e',
      strokeThickness: 2.5,
    },
  },
  optionRow: {
    idle: {
      fillTop: 0x0f2d5e,
      fillBot: 0x081c40,
      border: 0x2b7cb3,
      innerRim: 0x54d6ff,
      accent: 0x4ce6ff,
      text: '#eaf6ff',
      stroke: '#05142e',
      strokeThickness: 2.8,
    },
    focus: {
      fillTop: 0x1c539e,
      fillBot: 0x0d2f68,
      border: 0xffdf5a,
      innerRim: 0x7ef2ff,
      accent: 0xffdf5a,
      text: '#fff5ba',
      stroke: '#05142e',
      strokeThickness: 3,
    },
    disabled: {
      fillTop: 0x101f38,
      fillBot: 0x091326,
      border: 0x2e466b,
      innerRim: 0x1f3352,
      accent: 0x4b688f,
      text: '#7a94b8',
      stroke: '#040d1e',
      strokeThickness: 2.5,
    },
  },
};

function drawChamferPath(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, cut: number): void {
  const c = Math.min(cut, w * 0.25, h * 0.45);
  g.beginPath();
  g.moveTo(x + c, y);
  g.lineTo(x + w - c, y);
  g.lineTo(x + w, y + c);
  g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - c, y + h);
  g.lineTo(x + c, y + h);
  g.lineTo(x, y + h - c);
  g.lineTo(x, y + c);
  g.closePath();
}

function renderButtonSurface(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  pal: Palette,
  variant: MenuButtonVariant,
  isFocused: boolean,
  isActiveTab = false,
): void {
  const hw = w * 0.5;
  const hh = h * 0.5;
  const cut = variant === 'optionRow' ? 7 : variant === 'tab' ? 8 : Math.min(11, Math.round(h * 0.28));

  g.clear();

  // Outer dark comic/anime ink contour
  g.fillStyle(0x030c1f, 0.94);
  drawChamferPath(g, -hw - 1.5, -hh - 1.5, w + 3, h + 3, cut + 1);
  g.fillPath();

  // Lower bevel fill
  g.fillStyle(pal.fillBot, 0.98);
  drawChamferPath(g, -hw, -hh, w, h, cut);
  g.fillPath();

  // Upper cel-shaded half fill (classic arcade two-tone lighting)
  const splitY = variant === 'optionRow' ? h * 0.46 : h * 0.52;
  g.fillStyle(pal.fillTop, 0.98);
  g.beginPath();
  g.moveTo(-hw + cut, -hh);
  g.lineTo(hw - cut, -hh);
  g.lineTo(hw, -hh + cut);
  g.lineTo(hw, -hh + splitY);
  g.lineTo(-hw, -hh + splitY);
  g.lineTo(-hw, -hh + cut);
  g.closePath();
  g.fillPath();

  // Top glossy specular strip
  g.fillStyle(0xffffff, isFocused ? 0.34 : 0.16);
  g.fillRect(-hw + cut + 4, -hh + 2.5, Math.max(8, w - (cut + 4) * 2), Math.max(2, h * 0.1));

  // Bottom shadow edge inside plaque
  g.fillStyle(0x020a1a, isFocused ? 0.18 : 0.28);
  g.fillRect(-hw + cut + 2, hh - 4, Math.max(8, w - (cut + 2) * 2), 2.5);

  // Subtle aerospace side accent bars
  if (variant === 'primary' || variant === 'secondary' || variant === 'optionRow') {
    const barH = Math.max(10, h - 14);
    const barW = isFocused ? 4.2 : 3;
    g.fillStyle(pal.accent, isFocused ? 0.98 : 0.62);
    g.fillRoundedRect(-hw + 6, -barH * 0.5, barW, barH, 1.5);
    if (variant !== 'optionRow') {
      g.fillRoundedRect(hw - 6 - barW, -barH * 0.5, barW, barH, 1.5);
    }
  }

  // Active tab gold bottom indicator rail
  if (variant === 'tab' && isActiveTab) {
    g.fillStyle(isFocused ? 0x071a38 : 0xffdf5a, 0.96);
    g.fillRoundedRect(-hw + 14, hh - 4.5, w - 28, 3, 1.5);
  }

  // Crisp inner highlight bevel
  g.lineStyle(1, pal.innerRim, isFocused ? 0.72 : 0.35);
  drawChamferPath(g, -hw + 2, -hh + 2, w - 4, h - 4, Math.max(4, cut - 1.5));
  g.strokePath();

  // Outer stylized border
  g.lineStyle(isFocused ? 2.2 : 1.6, pal.border, isFocused ? 1 : 0.88);
  drawChamferPath(g, -hw, -hh, w, h, cut);
  g.strokePath();
}

/**
 * Reusable dynamic Phaser menu button with cartoon/anime arcade styling,
 * unified hover/focus/pressed/disabled/confirm states, and zero texture distortion.
 */
export class ArcadeMenuButton {
  readonly container: Phaser.GameObjects.Container;
  readonly node: Phaser.GameObjects.Text;
  readonly zone: Phaser.GameObjects.Zone;
  readonly variant: MenuButtonVariant;
  readonly disabled: boolean;
  readonly baseX: number;
  readonly baseY: number;
  readonly width: number;
  readonly height: number;
  extras: Phaser.GameObjects.Text[] = [];
  onLeft?: () => void;
  onRight?: () => void;
  action: () => void;

  private readonly scene: Phaser.Scene;
  private readonly focusGfx: Phaser.GameObjects.Graphics;
  private readonly glowGfx: Phaser.GameObjects.Graphics;
  private readonly flashGfx: Phaser.GameObjects.Graphics;
  private readonly sheenGfx: Phaser.GameObjects.Graphics;
  private readonly leftIndicator?: Phaser.GameObjects.Text;
  private readonly rightIndicator?: Phaser.GameObjects.Text;
  private readonly activeTab: boolean;
  private focused = false;
  private pressed = false;
  private confirming = false;
  private pulseTween?: Phaser.Tweens.Tween;
  private scaleTween?: Phaser.Tweens.Tween;
  private entranceTween?: Phaser.Tweens.Tween;
  private focusScale: number;

  constructor(scene: Phaser.Scene, cfg: ArcadeMenuButtonConfig) {
    this.scene = scene;
    this.variant = cfg.variant;
    this.disabled = !!cfg.disabled;
    this.activeTab = !!cfg.activeTab;
    this.baseX = cfg.x;
    this.baseY = cfg.y;
    this.width = cfg.width;
    this.height = cfg.height;
    this.action = cfg.onClick;
    this.onLeft = cfg.onLeft;
    this.onRight = cfg.onRight;
    this.focusScale = cfg.variant === 'optionRow' ? 1.016 : cfg.variant === 'tab' ? 1.03 : 1.04;

    const paletteSet = PALETTES[cfg.variant];
    const idlePal = this.disabled
      ? paletteSet.disabled
      : this.activeTab && cfg.variant === 'tab'
        ? { ...paletteSet.idle, fillTop: 0x1a539c, fillBot: 0x0d2d63, border: 0xffdf5a, text: '#ffef9c' }
        : paletteSet.idle;
    const focusPal = this.disabled
      ? { ...paletteSet.disabled, border: 0x5c84b5, innerRim: 0x406594 }
      : paletteSet.focus;

    this.container = scene.add.container(cfg.x, cfg.y);
    cfg.parent?.add(this.container);

    // Subtle grounded drop shadow
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x020817, 0.45);
    const cut = cfg.variant === 'optionRow' ? 7 : cfg.variant === 'tab' ? 8 : Math.min(11, Math.round(cfg.height * 0.28));
    drawChamferPath(shadow, -cfg.width * 0.5 + 1.5, -cfg.height * 0.5 + 3.5, cfg.width, cfg.height, cut);
    shadow.fillPath();
    this.container.add(shadow);

    // Outer luminous glow layer (visible on hover/focus)
    this.glowGfx = scene.add.graphics().setAlpha(0);
    const glowColor = this.disabled ? 0x4a76ad : cfg.variant === 'primary' || cfg.variant === 'tab' ? 0xffdf5a : 0x4ce6ff;
    this.glowGfx.lineStyle(5, glowColor, 0.24);
    drawChamferPath(this.glowGfx, -cfg.width * 0.5 - 2.5, -cfg.height * 0.5 - 2.5, cfg.width + 5, cfg.height + 5, cut + 2);
    this.glowGfx.strokePath();
    this.glowGfx.lineStyle(2.2, glowColor, 0.55);
    drawChamferPath(this.glowGfx, -cfg.width * 0.5 - 1, -cfg.height * 0.5 - 1, cfg.width + 2, cfg.height + 2, cut + 1);
    this.glowGfx.strokePath();
    this.container.add(this.glowGfx);

    // Idle surface
    const idleGfx = scene.add.graphics();
    renderButtonSurface(idleGfx, cfg.width, cfg.height, idlePal, cfg.variant, false, this.activeTab);
    this.container.add(idleGfx);

    // Focus/Hover surface (cross-faded smoothly with alpha tween)
    this.focusGfx = scene.add.graphics().setAlpha(0);
    renderButtonSurface(this.focusGfx, cfg.width, cfg.height, focusPal, cfg.variant, true, this.activeTab);
    this.container.add(this.focusGfx);

    // Lightweight sheen sweep bar (animated once on entering hover/focus)
    this.sheenGfx = scene.add.graphics().setAlpha(0);
    this.sheenGfx.fillStyle(0xffffff, 0.32);
    const shH = Math.max(8, cfg.height - 8);
    this.sheenGfx.beginPath();
    this.sheenGfx.moveTo(-8, -shH * 0.5);
    this.sheenGfx.lineTo(10, -shH * 0.5);
    this.sheenGfx.lineTo(2, shH * 0.5);
    this.sheenGfx.lineTo(-16, shH * 0.5);
    this.sheenGfx.closePath();
    this.sheenGfx.fillPath();
    this.container.add(this.sheenGfx);

    // Confirm flash overlay
    this.flashGfx = scene.add.graphics().setAlpha(0);
    this.flashGfx.fillStyle(0xfffbe0, 0.85);
    drawChamferPath(this.flashGfx, -cfg.width * 0.5, -cfg.height * 0.5, cfg.width, cfg.height, cut);
    this.flashGfx.fillPath();
    this.container.add(this.flashGfx);

    // Directional focus chevrons or option-row step arrows
    if (cfg.variant === 'optionRow' && cfg.showArrows) {
      const arrowX = cfg.width * 0.5 - 14;
      this.leftIndicator = scene.add.text(-arrowX + 18, 0, '', { fontFamily: UI_FONT, fontSize: '12px', fontStyle: 'bold', color: UI.goldHex }).setResolution(2).setOrigin(0.5).setAlpha(0);
      this.rightIndicator = scene.add.text(arrowX, 0, '◂▸', {
        fontFamily: UI_FONT, fontSize: '9.5px', fontStyle: 'bold', color: UI.cyanHex, stroke: '#041028', strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setAlpha(0.45);
      this.container.add([this.leftIndicator, this.rightIndicator]);
    } else if (cfg.variant === 'back') {
      this.leftIndicator = scene.add.text(-cfg.width * 0.5 + 19, 0.5, '‹', {
        fontFamily: UI_FONT, fontSize: '17px', fontStyle: 'bold', color: UI.cyanHex, stroke: '#041028', strokeThickness: 2.5,
      }).setResolution(2).setOrigin(0.5).setAlpha(0.85);
      this.container.add(this.leftIndicator);
    } else if (!this.disabled && cfg.variant !== 'optionRow') {
      const edgePad = cfg.variant === 'tab' ? 14 : 18;
      const chevCol = cfg.variant === 'primary' || cfg.variant === 'tab' ? '#071a38' : UI.goldHex;
      const chevStroke = cfg.variant === 'primary' || cfg.variant === 'tab' ? '#fff4ad' : '#05142e';
      this.leftIndicator = scene.add.text(-cfg.width * 0.5 + edgePad, 0.5, '▸', {
        fontFamily: UI_FONT, fontSize: cfg.variant === 'tab' ? '10px' : '12px', fontStyle: 'bold', color: chevCol, stroke: chevStroke, strokeThickness: 1.5,
      }).setResolution(2).setOrigin(0.5).setAlpha(0);
      this.rightIndicator = scene.add.text(cfg.width * 0.5 - edgePad, 0.5, '◂', {
        fontFamily: UI_FONT, fontSize: cfg.variant === 'tab' ? '10px' : '12px', fontStyle: 'bold', color: chevCol, stroke: chevStroke, strokeThickness: 1.5,
      }).setResolution(2).setOrigin(0.5).setAlpha(0);
      this.container.add([this.leftIndicator, this.rightIndicator]);
    }

    // Label text (positioned in world coordinates inside container; keep world-aligned getter compatibility via node!)
    // NOTE: External tests inspect `b.node.text` and `b.node.x/y`! Putting `node` directly in parent at (cfg.x, cfg.y)
    // would desync scale tweens; instead we keep `node` inside `this.container` at (0, 0.5) AND mirror world coords on container.
    const labelText = cfg.noLabel ? '' : cfg.label;
    this.node = scene.add.text(cfg.variant === 'back' ? 5 : 0, 0.5, labelText, {
      fontFamily: UI_FONT,
      fontSize: `${cfg.fontSize ?? 13.5}px`,
      fontStyle: 'bold',
      color: idlePal.text,
      stroke: idlePal.stroke,
      strokeThickness: idlePal.strokeThickness,
      align: 'center',
    }).setResolution(2).setOrigin(0.5);
    this.container.add(this.node);

    // Interactive hit zone placed directly in parent (avoids Phaser nested-Container hit-test issues)
    this.zone = scene.add.zone(cfg.x, cfg.y, cfg.width, cfg.height).setInteractive({ useHandCursor: !this.disabled });
    cfg.parent?.add(this.zone);

    this.zone.on('pointerover', () => {
      cfg.onFocus?.();
    });

    this.zone.on('pointerout', () => {
      if (this.pressed) {
        this.pressed = false;
        this.restoreFromPress();
      }
    });

    this.zone.on('pointerdown', () => {
      if (this.confirming) return;
      if (this.disabled) {
        cfg.onFocus?.();
        this.playLockedFeedback();
        return;
      }
      cfg.onFocus?.();
      this.pressed = true;
      this.entranceTween?.stop();
      this.entranceTween = undefined;
      this.container.setAlpha(1).setPosition(this.baseX, this.baseY);
      this.scaleTween?.stop();
      this.scaleTween = this.scene.tweens.add({
        targets: this.container,
        scaleX: 0.965,
        scaleY: 0.965,
        y: this.baseY + 1.5,
        duration: 80,
        ease: 'Quad.easeOut',
      });
    });

    this.zone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.pressed || this.confirming) return;
      this.pressed = false;
      if (this.disabled) return;
      if (this.onLeft && this.onRight) {
        const q = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        if (q.x < this.baseX - this.width * 0.14) {
          this.playStepPulse();
          this.onLeft();
          return;
        }
        if (q.x > this.baseX + this.width * 0.14) {
          this.playStepPulse();
          this.onRight();
          return;
        }
        this.playStepPulse();
        this.action();
        return;
      }
      this.playConfirmAndRun(this.action);
    });
  }

  /** World X center for external inspection & layout helpers. */
  get worldX(): number { return this.baseX; }
  /** World Y center for external inspection & layout helpers. */
  get worldY(): number { return this.baseY; }

  setFocused(focused: boolean, immediate = false): void {
    if (this.focused === focused && !immediate) return;
    const entering = focused && !this.focused;
    this.focused = focused;

    const paletteSet = PALETTES[this.variant];
    const pal = this.disabled
      ? (focused ? { ...paletteSet.disabled, border: 0x5c84b5 } : paletteSet.disabled)
      : focused
        ? paletteSet.focus
        : (this.activeTab && this.variant === 'tab'
          ? { ...paletteSet.idle, text: '#ffef9c', border: 0xffdf5a }
          : paletteSet.idle);

    this.node.setColor(pal.text).setStroke(pal.stroke, pal.strokeThickness);
    this.extras.forEach((t, idx) => {
      if (this.variant === 'optionRow') {
        const valCol = focused ? (idx === 0 ? '#ffffff' : UI.goldHex) : (idx === 0 ? UI.white : UI.cyanHex);
        t.setColor(valCol).setStroke('#05142e', focused ? 3 : 2.6);
      } else {
        t.setColor(pal.text).setStroke(pal.stroke, pal.strokeThickness);
      }
    });

    const targetScale = focused && !this.disabled ? this.focusScale : 1;
    const dur = immediate ? 0 : 145;

    this.pulseTween?.stop();
    this.pulseTween = undefined;
    this.scene.tweens.killTweensOf([this.focusGfx, this.glowGfx, this.sheenGfx]);
    if (!this.pressed && !this.confirming) {
      this.scaleTween?.stop();
      this.scaleTween = undefined;
    }

    if (immediate) {
      if (!this.pressed && !this.confirming) {
        this.container.setScale(targetScale);
        if (!this.entranceTween) this.container.setPosition(this.baseX, this.baseY);
      }
      this.focusGfx.setAlpha(focused ? 1 : 0);
      this.glowGfx.setAlpha(focused ? 0.92 : 0);
    } else {
      if (!this.pressed && !this.confirming) {
        this.scaleTween = this.scene.tweens.add({
          targets: this.container,
          scaleX: targetScale,
          scaleY: targetScale,
          duration: dur,
          ease: 'Cubic.easeOut',
        });
      }
      this.scene.tweens.add({
        targets: this.focusGfx,
        alpha: focused ? 1 : 0,
        duration: dur,
        ease: 'Cubic.easeOut',
      });
      this.scene.tweens.add({
        targets: this.glowGfx,
        alpha: focused ? 0.92 : 0,
        duration: dur + 20,
        ease: 'Cubic.easeOut',
      });
    }

    if (this.variant === 'back' && this.leftIndicator) {
      this.leftIndicator.setColor(focused ? UI.goldHex : UI.cyanHex).setAlpha(focused ? 1 : 0.78);
    } else if (this.variant === 'optionRow' && this.rightIndicator) {
      this.rightIndicator.setColor(focused ? UI.goldHex : UI.cyanHex).setAlpha(focused ? 0.98 : 0.42);
    } else if (this.leftIndicator && this.rightIndicator) {
      this.scene.tweens.killTweensOf([this.leftIndicator, this.rightIndicator]);
      if (immediate) {
        this.leftIndicator.setAlpha(focused ? 1 : 0);
        this.rightIndicator.setAlpha(focused ? 1 : 0);
      } else {
        this.scene.tweens.add({
          targets: [this.leftIndicator, this.rightIndicator],
          alpha: focused ? 1 : 0,
          duration: 130,
          ease: 'Quad.easeOut',
        });
      }
    }

    // Subtle specular sheen sweep + gentle edge pulse when gaining focus
    if (entering && !this.disabled && !immediate) {
      const span = this.width * 0.42;
      this.sheenGfx.setPosition(-span, 0).setAlpha(0.75);
      this.scene.tweens.add({
        targets: this.sheenGfx,
        x: span,
        alpha: 0,
        duration: 240,
        ease: 'Sine.easeOut',
      });
      this.pulseTween = this.scene.tweens.add({
        targets: this.glowGfx,
        alpha: { from: 0.92, to: 0.56 },
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** Plays tactile press + confirm flash then invokes callback once (used by keyboard, gamepad, and mouse). */
  playConfirmAndRun(callback: () => void, onAudio?: () => void): void {
    if (this.confirming) return;
    if (this.disabled) {
      this.playLockedFeedback();
      return;
    }
    this.confirming = true;
    onAudio?.();
    this.entranceTween?.stop();
    this.entranceTween = undefined;
    this.scaleTween?.stop();
    this.container.setAlpha(1);
    this.flashGfx.setAlpha(0.52);
    this.scene.tweens.killTweensOf(this.flashGfx);
    this.scene.tweens.add({
      targets: this.flashGfx,
      alpha: 0,
      duration: 130,
      ease: 'Quad.easeOut',
    });
    this.scaleTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.96,
      scaleY: 0.96,
      y: this.baseY + 1.5,
      duration: 75,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.confirming = false;
        if (!this.container.active) return;
        this.container.setScale(this.focused ? this.focusScale : 1).setPosition(this.baseX, this.baseY);
        callback();
      },
    });
  }

  /** Lightweight tactile pulse when stepping a setting row (volume / toggle / difficulty) without navigating away. */
  playStepPulse(): void {
    if (!this.container.active) return;
    this.flashGfx.setAlpha(0.28);
    this.scaleTween?.stop();
    this.scene.tweens.killTweensOf(this.flashGfx);
    this.scene.tweens.add({ targets: this.flashGfx, alpha: 0, duration: 120, ease: 'Quad.easeOut' });
    this.scaleTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: this.focusScale * 1.01,
      scaleY: this.focusScale * 1.01,
      y: this.baseY,
      duration: 95,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.container.active) this.container.setScale(this.focused ? this.focusScale : 1).setPosition(this.baseX, this.baseY);
      },
    });
  }

  /** Subtle locked shake for disabled items (e.g., locked Mission 02). */
  playLockedFeedback(): void {
    if (!this.container.active) return;
    this.entranceTween?.stop();
    this.entranceTween = undefined;
    this.scaleTween?.stop();
    this.container.setAlpha(1);
    this.scaleTween = this.scene.tweens.add({
      targets: this.container,
      x: { from: this.baseX - 3.5, to: this.baseX + 3.5 },
      duration: 45,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => { if (this.container.active) this.container.setPosition(this.baseX, this.baseY); },
    });
  }

  /** Smooth entrance stagger (200-280ms) while keeping button immediately responsive. */
  animateEntrance(delayMs: number, offsetX = 0, offsetY = 10): void {
    this.entranceTween?.stop();
    this.container.setPosition(this.baseX + offsetX, this.baseY + offsetY).setAlpha(0);
    this.entranceTween = this.scene.tweens.add({
      targets: this.container,
      x: this.baseX,
      y: this.baseY,
      alpha: 1,
      duration: 230,
      delay: delayMs,
      ease: 'Cubic.easeOut',
      onComplete: () => { this.entranceTween = undefined; },
    });
  }

  private restoreFromPress(): void {
    if (!this.container.active) return;
    this.scaleTween?.stop();
    this.scaleTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: this.focused && !this.disabled ? this.focusScale : 1,
      scaleY: this.focused && !this.disabled ? this.focusScale : 1,
      y: this.baseY,
      duration: 110,
      ease: 'Cubic.easeOut',
    });
  }
}

/** Sleek chamfered pill badge for difficulty / assisted status indicators. */
export function makeStatusPill(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  accentHex: number,
  textColor: string,
): Phaser.GameObjects.Container {
  const ct = scene.add.container(x, y);
  const txt = scene.add.text(5, 0.5, label, {
    fontFamily: UI_FONT, fontSize: '9px', fontStyle: 'bold', color: textColor, stroke: '#041028', strokeThickness: 2.2,
  }).setResolution(2).setOrigin(0.5);
  const w = Math.max(118, Math.ceil(txt.width) + 26);
  const h = 20;
  const g = scene.add.graphics();
  g.fillStyle(0x061938, 0.88);
  drawChamferPath(g, -w * 0.5, -h * 0.5, w, h, 5);
  g.fillPath();
  g.lineStyle(1.3, accentHex, 0.85);
  drawChamferPath(g, -w * 0.5, -h * 0.5, w, h, 5);
  g.strokePath();
  g.fillStyle(accentHex, 0.95);
  g.fillCircle(-w * 0.5 + 9, 0, 2.5);
  ct.add([g, txt]);
  parent.add(ct);
  return ct;
}

/** Contextual navigation footer pill showing PlayStation/Xbox/Keyboard prompts clearly without clutter. */
export function makeMenuHintBar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  y: number,
  padId?: string,
  extra?: { adjust?: boolean; noBack?: boolean },
): Phaser.GameObjects.Container {
  const ct = scene.add.container(384, y);
  const hasPad = !!padId;
  const pl = padLabels(padId);
  const parts: string[] = [];
  if (hasPad) {
    parts.push('D-PAD / L: NAVEGAR');
    if (extra?.adjust) parts.push('←/→: AJUSTAR');
    parts.push(`${pl.confirm}: CONFIRMAR`);
    if (!extra?.noBack) parts.push(`${pl.cancel}: VOLTAR`);
  } else {
    parts.push('↑↓: NAVEGAR');
    if (extra?.adjust) parts.push('←/→: AJUSTAR');
    parts.push('ENTER: CONFIRMAR');
    if (!extra?.noBack) parts.push('ESC: VOLTAR');
  }
  const label = parts.join('   •   ');
  const txt = scene.add.text(0, 0.5, label, {
    fontFamily: UI_FONT, fontSize: '9.2px', fontStyle: 'bold', color: '#cfe9ff', stroke: '#040e24', strokeThickness: 2.2,
  }).setResolution(2).setOrigin(0.5);
  const w = Math.min(660, Math.max(280, Math.ceil(txt.width) + 34));
  const h = 21;
  const g = scene.add.graphics();
  g.fillStyle(0x05142e, 0.78);
  drawChamferPath(g, -w * 0.5, -h * 0.5, w, h, 6);
  g.fillPath();
  g.lineStyle(1.1, UI.cyan, 0.42);
  drawChamferPath(g, -w * 0.5, -h * 0.5, w, h, 6);
  g.strokePath();
  ct.add([g, txt]);
  parent.add(ct);
  return ct;
}

/** Smooth, snappy UI container transition (fade + subtle upward settle, ~220ms). */
export function playMenuScreenEntrance(scene: Phaser.Scene, container: Phaser.GameObjects.Container, duration = 220): void {
  scene.tweens.killTweensOf(container);
  container.setAlpha(0).setPosition(0, 6);
  scene.tweens.add({
    targets: container,
    alpha: 1,
    y: 0,
    duration,
    ease: 'Cubic.easeOut',
  });
}
