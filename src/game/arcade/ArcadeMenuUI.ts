import Phaser from 'phaser';
import { UI, UI_FONT } from './ArcadeMenuArt';
import {
  getOrMakeVectorTex,
  makeVectorHintBar,
  traceChamferRect,
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
  const padX = 12;
  const padY = 10;
  const tw = Math.ceil(w + padX * 2);
  const th = Math.ceil(h + padY * 2);
  const key = `mv-ubtn-${variant}-${state}-${Math.round(w)}x${Math.round(h)}`;

  getOrMakeVectorTex(scene, key, tw, th, (ctx) => {
    const x = padX;
    const y = padY;
    const isYellow = (state === 'focus' && variant !== 'optionRow') || (state === 'activeTab' && variant === 'tab');
    const isDisabled = state === 'disabled';
    const isRowFocus = state === 'focus' && variant === 'optionRow';

    // All action & tab buttons share the exact same clean symmetric hexagonal silhouette.
    const traceShape = (inset = 0) => {
      const ix = x + inset;
      const iy = y + inset;
      const iw = w - inset * 2;
      const ih = h - inset * 2;
      if (variant === 'optionRow') {
        traceChamferRect(ctx, ix, iy, iw, ih, 8);
      } else {
        const tip = Math.min(11, Math.round(ih * 0.38));
        traceWingedHex(ctx, ix, iy, iw, ih, tip);
      }
    };

    // Soft grounded shadow / warm focus glow
    ctx.save();
    if (isYellow || isRowFocus) {
      ctx.shadowColor = 'rgba(255, 218, 72, 0.58)';
      ctx.shadowBlur = 9;
      ctx.shadowOffsetY = 1;
    } else {
      ctx.shadowColor = 'rgba(2, 9, 26, 0.65)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2.5;
    }
    traceShape(-1);
    ctx.fillStyle = '#041028';
    ctx.fill();
    ctx.restore();

    // Rich multi-stop anime gradient body
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (isDisabled) {
      grad.addColorStop(0, '#142542');
      grad.addColorStop(1, '#0a1529');
    } else if (isYellow) {
      grad.addColorStop(0, '#fff27a');
      grad.addColorStop(0.48, '#ffd02b');
      grad.addColorStop(0.88, '#f59810');
      grad.addColorStop(1, '#dd7606');
    } else if (isRowFocus) {
      grad.addColorStop(0, '#1d58ad');
      grad.addColorStop(0.55, '#123b7a');
      grad.addColorStop(1, '#092252');
    } else if (variant === 'optionRow') {
      grad.addColorStop(0, '#0f3066');
      grad.addColorStop(1, '#071c42');
    } else {
      grad.addColorStop(0, '#1c65cb');
      grad.addColorStop(0.50, '#0f3f8c');
      grad.addColorStop(1, '#082254');
    }

    traceShape(0);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glossy cel-shaded top reflection clipped inside button
    ctx.save();
    traceShape(1.5);
    ctx.clip();
    const gloss = ctx.createLinearGradient(x, y, x, y + h * 0.48);
    gloss.addColorStop(0, isYellow ? 'rgba(255, 255, 240, 0.52)' : isDisabled ? 'rgba(180, 215, 255, 0.08)' : 'rgba(145, 238, 255, 0.28)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(x, y + 1, w, h * 0.45);

    ctx.fillStyle = isYellow ? 'rgba(160, 56, 0, 0.18)' : 'rgba(3, 12, 32, 0.30)';
    ctx.fillRect(x, y + h - 3.5, w, 3.5);

    if (variant === 'optionRow') {
      ctx.fillStyle = isRowFocus ? '#ffdf5a' : '#3ed4ff';
      ctx.fillRect(x + 5, y + 5, isRowFocus ? 3.8 : 2.5, h - 10);
    }
    ctx.restore();

    // Crisp inner highlight bevel
    traceShape(1.8);
    ctx.strokeStyle = isDisabled
      ? 'rgba(72, 108, 156, 0.32)'
      : isYellow
        ? 'rgba(255, 253, 224, 0.82)'
        : isRowFocus
          ? 'rgba(255, 236, 138, 0.65)'
          : 'rgba(128, 238, 255, 0.40)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Outer stylized border
    traceShape(0);
    ctx.strokeStyle = isDisabled
      ? '#344f78'
      : isYellow
        ? '#fff6ba'
        : isRowFocus
          ? '#ffdf5a'
          : '#43d9ff';
    ctx.lineWidth = isYellow || isRowFocus ? 2 : 1.55;
    ctx.stroke();

    // Crisp dark ink contour
    traceShape(-1.1);
    ctx.strokeStyle = 'rgba(4, 15, 36, 0.92)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
  });

  return { key, padX, padY };
}

/**
 * Pure-vector cartoon/anime arcade button with uniform symmetric geometry,
 * strictly centered typography, and butter-smooth dual-layer hover/focus crossfade.
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
  private readonly focusNode: Phaser.GameObjects.Text;
  private readonly flashGfx: Phaser.GameObjects.Graphics;
  private readonly rightIndicator?: Phaser.GameObjects.Text;
  private readonly activeTab: boolean;
  private focused = false;
  private pressed = false;
  private confirming = false;
  private scaleTween?: Phaser.Tweens.Tween;
  private entranceTween?: Phaser.Tweens.Tween;
  private crossfadeTween?: Phaser.Tweens.Tween;
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
    this.focusScale = cfg.variant === 'optionRow' ? 1.012 : cfg.variant === 'tab' ? 1.024 : 1.032;

    this.container = scene.add.container(cfg.x, cfg.y);
    cfg.parent?.add(this.container);

    const idleState = this.disabled ? 'disabled' : this.activeTab && cfg.variant === 'tab' ? 'activeTab' : 'idle';
    const focusState = this.disabled ? 'disabled' : 'focus';

    const idleTex = buildButtonTexture(scene, cfg.variant, cfg.width, cfg.height, idleState);
    const focusTex = buildButtonTexture(scene, cfg.variant, cfg.width, cfg.height, focusState);

    this.idleImg = scene.add.image(0, 0, idleTex.key).setScale(1 / DPR);
    this.focusImg = scene.add.image(0, 0, focusTex.key).setScale(1 / DPR).setAlpha(0);
    this.container.add([this.idleImg, this.focusImg]);

    // Specular confirm flash overlay
    this.flashGfx = scene.add.graphics().setAlpha(0);
    this.flashGfx.fillStyle(0xfffde6, 0.72);
    this.flashGfx.fillRoundedRect(-cfg.width * 0.44, -cfg.height * 0.40, cfg.width * 0.88, cfg.height * 0.80, 6);
    this.container.add(this.flashGfx);

    // Strictly centered dual-layer typography (idle + focus crossfade smoothly in lockstep with surface!)
    const isYellowIdle = idleState === 'activeTab';
    const labelText = cfg.noLabel ? '' : cfg.label;
    const fontSize = `${cfg.fontSize ?? 12.5}px`;

    this.node = scene.add.text(0, 0, labelText, {
      fontFamily: UI_FONT,
      fontSize,
      fontStyle: 'bold',
      color: this.disabled ? '#7f99bd' : isYellowIdle ? '#071a38' : '#f2f9ff',
      stroke: this.disabled ? '#040d1e' : isYellowIdle ? '#fff6bd' : '#051530',
      strokeThickness: isYellowIdle ? 1.8 : 2.6,
      align: 'center',
    }).setResolution(2).setOrigin(0.5, 0.5);

    this.focusNode = scene.add.text(0, 0, labelText, {
      fontFamily: UI_FONT,
      fontSize,
      fontStyle: 'bold',
      color: this.disabled ? '#9db6d9' : '#071a38',
      stroke: this.disabled ? '#040d1e' : '#fff6bd',
      strokeThickness: this.disabled ? 2.4 : 1.8,
      align: 'center',
    }).setResolution(2).setOrigin(0.5, 0.5).setAlpha(0);

    this.container.add([this.node, this.focusNode]);

    // Subtle step arrows ONLY on optionRow settings bars
    if (cfg.variant === 'optionRow' && cfg.showArrows) {
      this.rightIndicator = scene.add.text(cfg.width * 0.5 - 15, 0, '◂▸', {
        fontFamily: UI_FONT, fontSize: '9.5px', fontStyle: 'bold', color: UI.cyanHex, stroke: '#041028', strokeThickness: 2,
      }).setResolution(2).setOrigin(0.5).setAlpha(0.45);
      this.container.add(this.rightIndicator);
    }

    // Hit zone placed directly in parent container (reliable Phaser 4 hit-testing)
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
        scaleX: 0.968,
        scaleY: 0.968,
        y: this.baseY + 1.2,
        duration: 85,
        ease: 'Quad.easeOut',
      });
    });

    this.zone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.pressed || this.confirming) return;
      this.pressed = false;
      if (this.disabled) return;
      // Tabs always switch immediately without left/right click splitting or locking!
      if (this.variant === 'tab') {
        this.restoreFromPress();
        this.action();
        return;
      }
      // Option rows allow clicking left/right halves to adjust values smoothly
      if (this.variant === 'optionRow' && this.onLeft && this.onRight) {
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
    this.focused = focused;

    const targetScale = focused && !this.disabled ? this.focusScale : 1;
    const focusAlpha = !this.disabled && focused ? 1 : 0;
    const useFocusText = !this.disabled && focused && this.variant !== 'optionRow' && !(this.activeTab && this.variant === 'tab');
    const dur = immediate ? 0 : 215;

    this.crossfadeTween?.stop();
    this.crossfadeTween = undefined;
    if (!this.pressed && !this.confirming) {
      this.scaleTween?.stop();
      this.scaleTween = undefined;
    }

    this.extras.forEach((t, idx) => {
      if (this.variant === 'optionRow') {
        const col = focused ? (idx === 0 ? '#ffffff' : UI.goldHex) : (idx === 0 ? '#e6f4ff' : UI.cyanHex);
        t.setColor(col).setStroke('#05142e', focused ? 2.8 : 2.2);
      }
    });

    if (this.rightIndicator) {
      this.rightIndicator.setColor(focused ? UI.goldHex : UI.cyanHex).setAlpha(focused ? 0.95 : 0.42);
    }

    if (immediate) {
      if (!this.pressed && !this.confirming) {
        this.container.setScale(targetScale);
        if (!this.entranceTween) this.container.setPosition(this.baseX, this.baseY);
      }
      this.focusImg.setAlpha(focusAlpha);
      this.node.setAlpha(useFocusText ? 0 : 1);
      this.focusNode.setAlpha(useFocusText ? 1 : 0);
      return;
    }

    if (!this.pressed && !this.confirming) {
      this.scaleTween = this.scene.tweens.add({
        targets: this.container,
        scaleX: targetScale,
        scaleY: targetScale,
        duration: dur,
        ease: 'Sine.easeInOut',
      });
    }

    const state = { t: this.focusImg.alpha };
    const startNodeA = this.node.alpha;
    const startFocusNodeA = this.focusNode.alpha;
    const endNodeA = useFocusText ? 0 : 1;
    const endFocusNodeA = useFocusText ? 1 : 0;
    this.crossfadeTween = this.scene.tweens.add({
      targets: state,
      t: focusAlpha,
      duration: dur,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        if (!this.container.active) return;
        const p = tw.progress;
        this.focusImg.setAlpha(state.t);
        this.node.setAlpha(startNodeA + (endNodeA - startNodeA) * p);
        this.focusNode.setAlpha(startFocusNodeA + (endFocusNodeA - startFocusNodeA) * p);
      },
      onComplete: () => {
        if (!this.container.active) return;
        this.focusImg.setAlpha(focusAlpha);
        this.node.setAlpha(endNodeA);
        this.focusNode.setAlpha(endFocusNodeA);
        this.crossfadeTween = undefined;
      },
    });
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
    this.flashGfx.setAlpha(0.42);
    this.scene.tweens.killTweensOf(this.flashGfx);
    this.scene.tweens.add({ targets: this.flashGfx, alpha: 0, duration: 140, ease: 'Sine.easeOut' });
    this.scaleTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.968,
      scaleY: 0.968,
      y: this.baseY + 1.2,
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
    this.flashGfx.setAlpha(0.22);
    this.scaleTween?.stop();
    this.scene.tweens.killTweensOf(this.flashGfx);
    this.scene.tweens.add({ targets: this.flashGfx, alpha: 0, duration: 120, ease: 'Sine.easeOut' });
    this.scaleTween = this.scene.tweens.add({
      targets: this.container,
      scaleX: this.focusScale * 1.008,
      scaleY: this.focusScale * 1.008,
      y: this.baseY,
      duration: 95,
      yoyo: true,
      ease: 'Sine.easeOut',
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

  animateEntrance(delayMs: number, offsetX = 0, offsetY = 8): void {
    this.entranceTween?.stop();
    this.container.setPosition(this.baseX + offsetX, this.baseY + offsetY).setAlpha(0);
    this.entranceTween = this.scene.tweens.add({
      targets: this.container,
      x: this.baseX,
      y: this.baseY,
      alpha: 1,
      duration: 240,
      delay: delayMs,
      ease: 'Sine.easeOut',
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
      duration: 140,
      ease: 'Sine.easeOut',
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
  const txt = scene.add.text(4, 0, label, {
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
  container.setAlpha(0).setPosition(0, 5);
  scene.tweens.add({
    targets: container,
    alpha: 1,
    y: 0,
    duration,
    ease: 'Sine.easeOut',
  });
}
