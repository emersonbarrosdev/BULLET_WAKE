import Phaser from 'phaser';
import { UI, UI_FONT } from './ArcadeMenuArt';
import {
  drawVectorIcon,
  getOrMakeVectorTex,
  makeVectorHintBar,
  traceAeroPlaque,
  traceChamferRect,
  traceRoundedRect,
  traceWingedHex,
  type VectorIconId,
} from './ArcadeMenuVector';

export type MenuButtonVariant = 'primary' | 'secondary' | 'back' | 'tab' | 'optionRow';

export interface ArcadeMenuButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  variant: MenuButtonVariant;
  icon?: VectorIconId;
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

const DPR = 2;

function buildButtonTexture(
  scene: Phaser.Scene,
  variant: MenuButtonVariant,
  w: number,
  h: number,
  state: 'idle' | 'focus' | 'disabled' | 'activeTab',
): { key: string; padX: number; padY: number } {
  const isAero = variant === 'primary' || variant === 'secondary' || variant === 'back';
  const padX = isAero ? 22 : 10;
  const padY = 10;
  const tw = Math.ceil(w + padX * 2);
  const th = Math.ceil(h + padY * 2);
  const key = `mv-btn-${variant}-${state}-${Math.round(w)}x${Math.round(h)}`;

  getOrMakeVectorTex(scene, key, tw, th, (ctx) => {
    const x = padX;
    const y = padY;
    const isYellow = (state === 'focus' && variant !== 'optionRow') || (state === 'activeTab' && variant === 'tab');
    const isDisabled = state === 'disabled';
    const isRowFocus = state === 'focus' && variant === 'optionRow';

    const traceShape = (inset = 0) => {
      const ix = x + inset;
      const iy = y + inset;
      const iw = w - inset * 2;
      const ih = h - inset * 2;
      if (variant === 'tab') {
        traceRoundedRect(ctx, ix, iy, iw, ih, Math.min(12, ih * 0.48));
      } else if (variant === 'optionRow') {
        traceChamferRect(ctx, ix, iy, iw, ih, 8);
      } else if (variant === 'primary') {
        traceWingedHex(ctx, ix, iy, iw, ih, Math.min(13, ih * 0.42));
      } else {
        traceAeroPlaque(ctx, ix, iy, iw, ih, Math.min(10, ih * 0.30), Math.min(6, ih * 0.22));
      }
    };

    // Golden speed-slashes `//` flanking selected yellow buttons (faithful to Bullet Wake prints 3-5!)
    if (isYellow && isAero) {
      ctx.save();
      ctx.shadowColor = 'rgba(255, 214, 64, 0.72)';
      ctx.shadowBlur = 6;
      const sg = ctx.createLinearGradient(0, y, 0, y + h);
      sg.addColorStop(0, '#fff382');
      sg.addColorStop(1, '#f4900a');
      ctx.fillStyle = sg;
      ctx.strokeStyle = '#05122b';
      ctx.lineWidth = 1.4;
      const sh = Math.max(12, h * 0.56);
      const sy = y + (h - sh) * 0.5;
      // Left slashes
      for (const ox of [-10, -16]) {
        ctx.beginPath();
        ctx.moveTo(x + ox + 4, sy);
        ctx.lineTo(x + ox + 8, sy);
        ctx.lineTo(x + ox + 3, sy + sh);
        ctx.lineTo(x + ox - 1, sy + sh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      // Right slashes
      for (const ox of [3, 9]) {
        ctx.beginPath();
        ctx.moveTo(x + w + ox + 4, sy);
        ctx.lineTo(x + w + ox + 8, sy);
        ctx.lineTo(x + w + ox + 3, sy + sh);
        ctx.lineTo(x + w + ox - 1, sy + sh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Outer glow & drop shadow
    ctx.save();
    if (isYellow || isRowFocus) {
      ctx.shadowColor = 'rgba(255, 216, 68, 0.72)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 1;
    } else {
      ctx.shadowColor = 'rgba(2, 9, 26, 0.72)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
    }
    traceShape(-1.2);
    ctx.fillStyle = '#041028';
    ctx.fill();
    ctx.restore();

    // Rich multi-stop anime gradient body
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (isDisabled) {
      grad.addColorStop(0, '#142542');
      grad.addColorStop(1, '#0a1529');
    } else if (isYellow) {
      grad.addColorStop(0, '#fff37d');
      grad.addColorStop(0.46, '#ffd22b');
      grad.addColorStop(0.86, '#f69910');
      grad.addColorStop(1, '#df7606');
    } else if (isRowFocus) {
      grad.addColorStop(0, '#1c56a8');
      grad.addColorStop(0.55, '#113a78');
      grad.addColorStop(1, '#092252');
    } else if (variant === 'optionRow') {
      grad.addColorStop(0, '#0f3066');
      grad.addColorStop(1, '#071c42');
    } else {
      grad.addColorStop(0, '#1b64c9');
      grad.addColorStop(0.48, '#0f3f8c');
      grad.addColorStop(1, '#082254');
    }

    traceShape(0);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glossy anime cel-shaded top reflection clipped inside button
    ctx.save();
    traceShape(1.5);
    ctx.clip();
    const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.48);
    gloss.addColorStop(0, isYellow ? 'rgba(255, 255, 240, 0.56)' : isDisabled ? 'rgba(180, 215, 255, 0.08)' : 'rgba(145, 238, 255, 0.30)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y + 1, w, h * 0.46);

    // Subtle bottom energy rim inside button
    ctx.fillStyle = isYellow ? 'rgba(160, 56, 0, 0.20)' : 'rgba(3, 12, 32, 0.34)';
    ctx.fillRect(x, y + h - 4, w, 4);

    // Left vertical golden energy bar on focused option rows
    if (variant === 'optionRow') {
      ctx.fillStyle = isRowFocus ? '#ffdf5a' : '#3ed4ff';
      ctx.fillRect(x + 5, y + 5, isRowFocus ? 4 : 2.6, h - 10);
    }
    ctx.restore();

    // Crisp inner highlight bevel
    traceShape(2);
    ctx.strokeStyle = isDisabled
      ? 'rgba(72, 108, 156, 0.32)'
      : isYellow
        ? 'rgba(255, 253, 224, 0.85)'
        : isRowFocus
          ? 'rgba(255, 236, 138, 0.65)'
          : 'rgba(128, 238, 255, 0.42)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Crisp outer border contour
    traceShape(0);
    ctx.strokeStyle = isDisabled
      ? '#344f78'
      : isYellow
        ? '#fff6ba'
        : isRowFocus
          ? '#ffdf5a'
          : '#43d9ff';
    ctx.lineWidth = isYellow || isRowFocus ? 2.2 : 1.7;
    ctx.stroke();

    // Outer dark ink stroke for razor cartoon contrast
    traceShape(-1.2);
    ctx.strokeStyle = 'rgba(4, 15, 36, 0.92)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  });

  return { key, padX, padY };
}

/**
 * Pure-vector cartoon/anime arcade button with unified hover/focus/pressed/disabled/confirm states.
 * Selected/hovered buttons glow radiant arcade yellow-gold; unselected buttons stay sleek cobalt-blue.
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
  private readonly idleImg: Phaser.GameObjects.Image;
  private readonly focusImg: Phaser.GameObjects.Image;
  private readonly idleIcon?: Phaser.GameObjects.Image;
  private readonly focusIcon?: Phaser.GameObjects.Image;
  private readonly sheenGfx: Phaser.GameObjects.Graphics;
  private readonly flashGfx: Phaser.GameObjects.Graphics;
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
    this.focusScale = cfg.variant === 'optionRow' ? 1.015 : cfg.variant === 'tab' ? 1.03 : 1.045;

    this.container = scene.add.container(cfg.x, cfg.y);
    cfg.parent?.add(this.container);

    const idleState = this.disabled ? 'disabled' : this.activeTab && cfg.variant === 'tab' ? 'activeTab' : 'idle';
    const focusState = this.disabled ? 'disabled' : 'focus';

    const idleTex = buildButtonTexture(scene, cfg.variant, cfg.width, cfg.height, idleState);
    const focusTex = buildButtonTexture(scene, cfg.variant, cfg.width, cfg.height, focusState);

    this.idleImg = scene.add.image(0, 0, idleTex.key).setScale(1 / DPR);
    this.focusImg = scene.add.image(0, 0, focusTex.key).setScale(1 / DPR).setAlpha(0);
    this.container.add([this.idleImg, this.focusImg]);

    // Lightweight sheen sweep bar on entering hover/focus
    this.sheenGfx = scene.add.graphics().setAlpha(0);
    this.sheenGfx.fillStyle(0xffffff, 0.36);
    const shH = Math.max(8, cfg.height - 6);
    this.sheenGfx.beginPath();
    this.sheenGfx.moveTo(-6, -shH * 0.5);
    this.sheenGfx.lineTo(12, -shH * 0.5);
    this.sheenGfx.lineTo(4, shH * 0.5);
    this.sheenGfx.lineTo(-14, shH * 0.5);
    this.sheenGfx.closePath();
    this.sheenGfx.fillPath();
    this.container.add(this.sheenGfx);

    // Specular confirm flash overlay
    this.flashGfx = scene.add.graphics().setAlpha(0);
    this.flashGfx.fillStyle(0xfffde6, 0.78);
    this.flashGfx.fillRoundedRect(-cfg.width * 0.46, -cfg.height * 0.42, cfg.width * 0.92, cfg.height * 0.84, 6);
    this.container.add(this.flashGfx);

    // Label text
    const isYellowIdle = idleState === 'activeTab';
    const labelText = cfg.noLabel ? '' : cfg.label;
    const iconId: VectorIconId | undefined = this.disabled ? (cfg.icon ?? 'lock') : cfg.icon ?? (cfg.variant === 'back' ? 'back' : undefined);
    const textShiftX = iconId && !cfg.noLabel ? (cfg.variant === 'tab' ? 9 : 11) : 0;

    this.node = scene.add.text(textShiftX, 0.5, labelText, {
      fontFamily: UI_FONT,
      fontSize: `${cfg.fontSize ?? 13}px`,
      fontStyle: 'bold',
      color: this.disabled ? '#7f99bd' : isYellowIdle ? '#071a38' : '#f2f9ff',
      stroke: this.disabled ? '#040d1e' : isYellowIdle ? '#fff6bd' : '#051530',
      strokeThickness: isYellowIdle ? 1.8 : 2.8,
      align: 'center',
    }).setResolution(2).setOrigin(0.5);
    this.container.add(this.node);

    // Crisp vector icon inside button (dual color: bright white/cyan when idle -> bold dark-navy on yellow focus!)
    if (iconId && !cfg.noLabel) {
      const icoSize = Math.min(18, Math.max(12, cfg.height * 0.5));
      const icoX = cfg.variant === 'tab'
        ? -this.node.width * 0.5 - 3
        : Math.max(-cfg.width * 0.5 + 28, -this.node.width * 0.5 - 8);
      const idleCol = this.disabled ? '#7f99bd' : isYellowIdle ? '#071a38' : '#e8f7ff';
      const focusCol = this.disabled ? '#9db6d6' : '#071a38';
      const mkIco = (col: string) => {
        const k = `mv-bico-${iconId}-${Math.round(icoSize)}-${col.replace('#', '')}`;
        const dim = Math.ceil(icoSize + 8);
        getOrMakeVectorTex(scene, k, dim, dim, (ctx) => {
          drawVectorIcon(ctx, iconId, dim * 0.5, dim * 0.5, icoSize, col, col === '#071a38' ? '#ffe066' : '#4ce6ff');
        });
        return scene.add.image(icoX, 0.5, k).setScale(1 / DPR);
      };
      this.idleIcon = mkIco(idleCol);
      this.focusIcon = mkIco(focusCol).setAlpha(0);
      this.container.add([this.idleIcon, this.focusIcon]);
    }

    // Right-side indicator (`»` chevron on focused primary/aero buttons, `◂▸` on option rows)
    if (cfg.variant === 'optionRow' && cfg.showArrows) {
      this.rightIndicator = scene.add.text(cfg.width * 0.5 - 15, 0.5, '◂▸', {
        fontFamily: UI_FONT, fontSize: '9.5px', fontStyle: 'bold', color: UI.cyanHex, stroke: '#041028', strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setAlpha(0.5);
      this.container.add(this.rightIndicator);
    } else if (!this.disabled && (cfg.variant === 'primary' || cfg.variant === 'secondary')) {
      this.rightIndicator = scene.add.text(cfg.width * 0.5 - 20, 0, '»', {
        fontFamily: UI_FONT, fontSize: `${Math.min(16, cfg.height * 0.52)}px`, fontStyle: 'bold', color: '#071a38', stroke: '#fff7bd', strokeThickness: 1.5,
      }).setResolution(2).setOrigin(0.5).setAlpha(0);
      this.container.add(this.rightIndicator);
    }

    // Hit zone directly in parent container (reliable Phaser 4 hit-testing across all viewports)
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
        scaleX: 0.962,
        scaleY: 0.962,
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

  get worldX(): number { return this.baseX; }
  get worldY(): number { return this.baseY; }

  setFocused(focused: boolean, immediate = false): void {
    if (this.focused === focused && !immediate) return;
    const entering = focused && !this.focused;
    this.focused = focused;

    const isYellow = (!this.disabled && focused && this.variant !== 'optionRow') || (!this.disabled && this.activeTab && this.variant === 'tab');

    if (this.disabled) {
      this.node.setColor(focused ? '#9cb6d9' : '#7f99bd').setStroke('#040d1e', 2.5);
    } else if (isYellow) {
      this.node.setColor('#071a38').setStroke('#fff6bd', 1.8);
    } else {
      this.node.setColor('#f2f9ff').setStroke('#051530', 2.8);
    }

    this.extras.forEach((t, idx) => {
      if (this.variant === 'optionRow') {
        const col = focused ? (idx === 0 ? '#ffffff' : UI.goldHex) : (idx === 0 ? '#e6f4ff' : UI.cyanHex);
        t.setColor(col).setStroke('#05142e', focused ? 3 : 2.4);
      } else {
        t.setColor(isYellow ? '#071a38' : '#f2f9ff');
      }
    });

    const targetScale = focused && !this.disabled ? this.focusScale : 1;
    const dur = immediate ? 0 : 140;

    this.pulseTween?.stop();
    this.pulseTween = undefined;
    this.scene.tweens.killTweensOf([this.focusImg, this.sheenGfx]);
    if (this.idleIcon && this.focusIcon) this.scene.tweens.killTweensOf([this.idleIcon, this.focusIcon]);
    if (!this.pressed && !this.confirming) {
      this.scaleTween?.stop();
      this.scaleTween = undefined;
    }

    const focusAlpha = !this.disabled && focused ? 1 : 0;
    const iconSwap = isYellow && !(this.activeTab && this.variant === 'tab');

    if (immediate) {
      if (!this.pressed && !this.confirming) {
        this.container.setScale(targetScale);
        if (!this.entranceTween) this.container.setPosition(this.baseX, this.baseY);
      }
      this.focusImg.setAlpha(focusAlpha);
      if (this.idleIcon && this.focusIcon) {
        this.idleIcon.setAlpha(iconSwap ? 0 : 1);
        this.focusIcon.setAlpha(iconSwap ? 1 : 0);
      }
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
        targets: this.focusImg,
        alpha: focusAlpha,
        duration: dur,
        ease: 'Cubic.easeOut',
      });
      if (this.idleIcon && this.focusIcon) {
        this.scene.tweens.add({ targets: this.idleIcon, alpha: iconSwap ? 0 : 1, duration: dur, ease: 'Cubic.easeOut' });
        this.scene.tweens.add({ targets: this.focusIcon, alpha: iconSwap ? 1 : 0, duration: dur, ease: 'Cubic.easeOut' });
      }
    }

    if (this.rightIndicator) {
      this.scene.tweens.killTweensOf(this.rightIndicator);
      if (this.variant === 'optionRow') {
        this.rightIndicator.setColor(focused ? UI.goldHex : UI.cyanHex).setAlpha(focused ? 1 : 0.48);
      } else if (immediate) {
        this.rightIndicator.setAlpha(focused ? 0.92 : 0);
      } else {
        this.scene.tweens.add({
          targets: this.rightIndicator,
          alpha: focused ? 0.92 : 0,
          duration: 130,
          ease: 'Quad.easeOut',
        });
      }
    }

    // Crisp diagonal specular sheen sweep on gaining focus
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
        targets: this.focusImg,
        alpha: { from: 1, to: 0.92 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

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
    this.flashGfx.setAlpha(0.55);
    this.scene.tweens.killTweensOf(this.flashGfx);
    this.scene.tweens.add({ targets: this.flashGfx, alpha: 0, duration: 130, ease: 'Quad.easeOut' });
    this.scaleTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.958,
      scaleY: 0.958,
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

  playStepPulse(): void {
    if (!this.container.active) return;
    this.flashGfx.setAlpha(0.26);
    this.scaleTween?.stop();
    this.scene.tweens.killTweensOf(this.flashGfx);
    this.scene.tweens.add({ targets: this.flashGfx, alpha: 0, duration: 120, ease: 'Quad.easeOut' });
    this.scaleTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: this.focusScale * 1.01,
      scaleY: this.focusScale * 1.01,
      y: this.baseY,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.container.active) this.container.setScale(this.focused ? this.focusScale : 1).setPosition(this.baseX, this.baseY);
      },
    });
  }

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

/** Crisp vector chamfered status pill for difficulty / assisted indicator. */
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
  const w = Math.max(122, Math.ceil(txt.width) + 28);
  const h = 20;
  const g = scene.add.graphics();
  g.fillStyle(0x061938, 0.92);
  g.fillRoundedRect(-w * 0.5, -h * 0.5, w, h, 10);
  g.lineStyle(1.3, accentHex, 0.88);
  g.strokeRoundedRect(-w * 0.5, -h * 0.5, w, h, 10);
  g.fillStyle(accentHex, 0.96);
  g.fillCircle(-w * 0.5 + 10, 0, 2.6);
  ct.add([g, txt]);
  parent.add(ct);
  return ct;
}

export const makeMenuHintBar = makeVectorHintBar;

/** Smooth, snappy UI container transition (fade + subtle upward settle, ~210ms). */
export function playMenuScreenEntrance(scene: Phaser.Scene, container: Phaser.GameObjects.Container, duration = 210): void {
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
