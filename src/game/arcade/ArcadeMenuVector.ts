import Phaser from 'phaser';
import { UI_FONT } from './ArcadeMenuArt';
import { padLabels } from '../systems/gamepadInput';

export type VectorIconId =
  | 'play'
  | 'jet'
  | 'gamepad'
  | 'gear'
  | 'back'
  | 'music'
  | 'speaker'
  | 'lightning'
  | 'crown'
  | 'shield'
  | 'monitor'
  | 'touch'
  | 'phone'
  | 'helmet'
  | 'route'
  | 'lock'
  | 'star';

const DPR = 2;

/** Creates or retrieves a cached 2x-resolution procedural vector CanvasTexture. */
export function getOrMakeVectorTex(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): string {
  if (scene.textures.exists(key)) return key;
  const cw = Math.max(2, Math.ceil(w * DPR));
  const ch = Math.max(2, Math.ceil(h * DPR));
  const tex = scene.textures.createCanvas(key, cw, ch);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(DPR, DPR);
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);
  ctx.restore();
  tex.refresh();
  return key;
}

export function traceChamferRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
): void {
  const c = Math.min(cut, w * 0.35, h * 0.45);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/** Aerodynamic slanted hex/parallelogram button silhouette matching Bullet Wake anime arcade style. */
export function traceAeroPlaque(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  skew = 9,
  bevel = 6,
): void {
  const s = Math.min(skew, w * 0.14);
  const b = Math.min(bevel, h * 0.32);
  ctx.beginPath();
  ctx.moveTo(x + s + b, y);
  ctx.lineTo(x + w - b, y);
  ctx.lineTo(x + w, y + b);
  ctx.lineTo(x + w - s, y + h - b);
  ctx.lineTo(x + w - s - b, y + h);
  ctx.lineTo(x + b, y + h);
  ctx.lineTo(x, y + h - b);
  ctx.lineTo(x + s, y + b);
  ctx.closePath();
}

/** Pointed hexagonal wing plaque (used for prominent primary CTA & winged banners). */
export function traceWingedHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tip = 13,
): void {
  const t = Math.min(tip, w * 0.16, h * 0.46);
  const cy = y + h * 0.5;
  ctx.beginPath();
  ctx.moveTo(x + t, y);
  ctx.lineTo(x + w - t, y);
  ctx.lineTo(x + w, cy);
  ctx.lineTo(x + w - t, y + h);
  ctx.lineTo(x + t, y + h);
  ctx.lineTo(x, cy);
  ctx.closePath();
}

export function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/** Draws crisp procedural vector icons in Canvas2D at arbitrary scale with zero external sprites. */
export function drawVectorIcon(
  ctx: CanvasRenderingContext2D,
  icon: VectorIconId,
  cx: number,
  cy: number,
  size: number,
  color: string,
  accent = '#ffdf5a',
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (icon) {
    case 'play': {
      ctx.beginPath();
      ctx.moveTo(-5.5, -8.5);
      ctx.lineTo(8.5, 0);
      ctx.lineTo(-5.5, 8.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'jet': {
      ctx.rotate(-Math.PI * 0.25);
      ctx.beginPath();
      ctx.moveTo(0, -10.5);
      ctx.lineTo(3.2, -3.5);
      ctx.lineTo(10, 2);
      ctx.lineTo(9.5, 4.8);
      ctx.lineTo(3, 2.5);
      ctx.lineTo(2.4, 7.5);
      ctx.lineTo(5.2, 9.8);
      ctx.lineTo(4.6, 11);
      ctx.lineTo(0, 9.2);
      ctx.lineTo(-4.6, 11);
      ctx.lineTo(-5.2, 9.8);
      ctx.lineTo(-2.4, 7.5);
      ctx.lineTo(-3, 2.5);
      ctx.lineTo(-9.5, 4.8);
      ctx.lineTo(-10, 2);
      ctx.lineTo(-3.2, -3.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'gamepad': {
      ctx.beginPath();
      ctx.moveTo(-6, -5);
      ctx.lineTo(6, -5);
      ctx.quadraticCurveTo(10.5, -5, 11, 1);
      ctx.lineTo(11.4, 5.2);
      ctx.quadraticCurveTo(11.4, 8.2, 8.4, 7.6);
      ctx.lineTo(5.2, 3.8);
      ctx.lineTo(-5.2, 3.8);
      ctx.lineTo(-8.4, 7.6);
      ctx.quadraticCurveTo(-11.4, 8.2, -11.4, 5.2);
      ctx.lineTo(-11, 1);
      ctx.quadraticCurveTo(-10.5, -5, -6, -5);
      ctx.closePath();
      ctx.fill();
      // Cutout D-pad & face dots
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillRect(-7.6, -1.6, 4.4, 1.8);
      ctx.fillRect(-6.3, -2.9, 1.8, 4.4);
      ctx.beginPath();
      ctx.arc(4.8, -1.8, 1.2, 0, Math.PI * 2);
      ctx.arc(7.4, -0.4, 1.2, 0, Math.PI * 2);
      ctx.arc(4.8, 1.0, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'gear': {
      const teeth = 8;
      ctx.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i * Math.PI) / teeth;
        const r = i % 2 === 0 ? 10.2 : 7.4;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, 3.7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'back': {
      ctx.lineWidth = 3.1;
      ctx.beginPath();
      ctx.moveTo(7.5, 0);
      ctx.lineTo(-6.5, 0);
      ctx.moveTo(-1.2, -5.8);
      ctx.lineTo(-7.2, 0);
      ctx.lineTo(-1.2, 5.8);
      ctx.stroke();
      break;
    }
    case 'music': {
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-3.5, 6);
      ctx.lineTo(-3.5, -6.5);
      ctx.lineTo(7, -9);
      ctx.lineTo(7, 3.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-6, 6.2, 3.2, 2.3, -0.3, 0, Math.PI * 2);
      ctx.ellipse(4.5, 4.0, 3.2, 2.3, -0.3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'speaker': {
      ctx.beginPath();
      ctx.moveTo(-9, -3.5);
      ctx.lineTo(-4.5, -3.5);
      ctx.lineTo(1.2, -8);
      ctx.lineTo(1.2, 8);
      ctx.lineTo(-4.5, 3.5);
      ctx.lineTo(-9, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.arc(2.5, 0, 4.2, -0.75, 0.75);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(2.5, 0, 7.6, -0.85, 0.85);
      ctx.stroke();
      break;
    }
    case 'lightning': {
      ctx.beginPath();
      ctx.moveTo(2.2, -10.5);
      ctx.lineTo(-7, 1.2);
      ctx.lineTo(-0.5, 1.2);
      ctx.lineTo(-2.5, 10.5);
      ctx.lineTo(7, -1.5);
      ctx.lineTo(0.8, -1.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'crown': {
      ctx.beginPath();
      ctx.moveTo(-9.5, 6.5);
      ctx.lineTo(-10.5, -4.5);
      ctx.lineTo(-4.5, 0.8);
      ctx.lineTo(0, -7.5);
      ctx.lineTo(4.5, 0.8);
      ctx.lineTo(10.5, -4.5);
      ctx.lineTo(9.5, 6.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-9.2, 7.8, 18.4, 2.2);
      break;
    }
    case 'shield': {
      ctx.beginPath();
      ctx.moveTo(0, -9.8);
      ctx.lineTo(8.5, -6.2);
      ctx.lineTo(7.4, 2.4);
      ctx.quadraticCurveTo(5.8, 7.8, 0, 10.4);
      ctx.quadraticCurveTo(-5.8, 7.8, -7.4, 2.4);
      ctx.lineTo(-8.5, -6.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.moveTo(0, -5.2);
      ctx.lineTo(2, -1);
      ctx.lineTo(6.2, -0.6);
      ctx.lineTo(3, 2.1);
      ctx.lineTo(3.8, 6.2);
      ctx.lineTo(0, 4.1);
      ctx.lineTo(-3.8, 6.2);
      ctx.lineTo(-3, 2.1);
      ctx.lineTo(-6.2, -0.6);
      ctx.lineTo(-2, -1);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'monitor': {
      ctx.lineWidth = 2.1;
      traceRoundedRect(ctx, -9.8, -8, 19.6, 13, 2.4);
      ctx.stroke();
      ctx.fillRect(-2.4, 5, 4.8, 3.2);
      ctx.fillRect(-6, 7.8, 12, 2.2);
      break;
    }
    case 'phone': {
      ctx.lineWidth = 2.1;
      traceRoundedRect(ctx, -6, -9.8, 12, 19.6, 2.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 6.6, 1.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'touch': {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-1, -4.5, 4.8, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-2.2, -4.5);
      ctx.lineTo(-2.2, 4.2);
      ctx.lineTo(-5.6, 2.4);
      ctx.quadraticCurveTo(-7.2, 3.6, -5.4, 5.5);
      ctx.lineTo(-1, 9.6);
      ctx.lineTo(5.6, 9.6);
      ctx.lineTo(6.8, 2.5);
      ctx.quadraticCurveTo(6.8, 0.2, 4.6, 0.2);
      ctx.lineTo(1.4, 0.2);
      ctx.lineTo(1.4, -4.5);
      ctx.arc(-0.4, -4.5, 1.8, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'helmet': {
      ctx.beginPath();
      ctx.arc(0, -1, 8.8, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(8.5, 6.5);
      ctx.lineTo(4.2, 8.5);
      ctx.lineTo(-4.2, 8.5);
      ctx.lineTo(-8.5, 6.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = accent;
      traceRoundedRect(ctx, -6.2, -3.6, 12.4, 5.4, 2.6);
      ctx.fill();
      break;
    }
    case 'route': {
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, 8.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(3.2, 0);
      ctx.lineTo(0, 6.5);
      ctx.lineTo(-3.2, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'lock': {
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -3.5, 4.4, Math.PI, 0);
      ctx.lineTo(4.4, 0);
      ctx.moveTo(-4.4, -3.5);
      ctx.lineTo(-4.4, 0);
      ctx.stroke();
      traceRoundedRect(ctx, -6.8, -0.5, 13.6, 10, 2.2);
      ctx.fill();
      ctx.fillStyle = '#071a38';
      ctx.beginPath();
      ctx.arc(0, 3.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-0.8, 4.2, 1.6, 2.8);
      break;
    }
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI * 0.5 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? 10 : 4.6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

/** Crisp standalone vector icon image (cached 2x CanvasTexture). */
export function makeVectorIconSprite(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  icon: VectorIconId,
  size: number,
  color: string,
  accent = '#ffdf5a',
): Phaser.GameObjects.Image {
  const key = `mv-ico-${icon}-${Math.round(size)}-${color.replace('#', '')}-${accent.replace('#', '')}`;
  const pad = 6;
  const dim = Math.ceil(size + pad * 2);
  getOrMakeVectorTex(scene, key, dim, dim, (ctx) => {
    ctx.shadowColor = 'rgba(2, 10, 28, 0.72)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    drawVectorIcon(ctx, icon, dim * 0.5, dim * 0.5, size, color, accent);
  });
  const img = scene.add.image(cx, cy, key).setScale(1 / DPR);
  parent.add(img);
  return img;
}

/**
 * Pure vector anime/arcade cockpit panel with deep navy gradient, double neon-cyan border,
 * and bold golden diagonal corner brackets (replaces NineSlice panels in pre-gameplay menus).
 */
export function makeVectorPanel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  w: number,
  h: number,
  opts?: { kind?: 'main' | 'sub' | 'gold' | 'card' | 'cardActive'; cut?: number; alpha?: number },
): Phaser.GameObjects.Image {
  const kind = opts?.kind ?? 'main';
  const cut = opts?.cut ?? (kind === 'main' ? 16 : kind === 'sub' ? 12 : 9);
  const pad = 10;
  const tw = Math.ceil(w + pad * 2);
  const th = Math.ceil(h + pad * 2);
  const key = `mv-panel-${kind}-${Math.round(w)}x${Math.round(h)}-c${cut}`;

  getOrMakeVectorTex(scene, key, tw, th, (ctx) => {
    const x = pad;
    const y = pad;

    // Grounded outer shadow
    ctx.save();
    ctx.shadowColor = kind === 'cardActive' || kind === 'gold' ? 'rgba(255, 214, 70, 0.35)' : 'rgba(2, 9, 26, 0.72)';
    ctx.shadowBlur = kind === 'main' ? 12 : 8;
    ctx.shadowOffsetY = kind === 'main' ? 4 : 2;
    traceChamferRect(ctx, x, y, w, h, cut);
    ctx.fillStyle = '#041028';
    ctx.fill();
    ctx.restore();

    // Rich vertical gradient interior
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    if (kind === 'sub') {
      bg.addColorStop(0, 'rgba(9, 32, 76, 0.93)');
      bg.addColorStop(1, 'rgba(5, 19, 48, 0.96)');
    } else if (kind === 'card' || kind === 'cardActive') {
      bg.addColorStop(0, 'rgba(13, 42, 94, 0.94)');
      bg.addColorStop(1, 'rgba(6, 22, 54, 0.97)');
    } else {
      bg.addColorStop(0, 'rgba(11, 38, 86, 0.93)');
      bg.addColorStop(0.5, 'rgba(7, 25, 62, 0.95)');
      bg.addColorStop(1, 'rgba(5, 17, 44, 0.97)');
    }
    traceChamferRect(ctx, x, y, w, h, cut);
    ctx.fillStyle = bg;
    ctx.fill();

    // Subtle top interior horizon sheen
    ctx.save();
    traceChamferRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(4, cut - 2));
    ctx.clip();
    const sheen = ctx.createLinearGradient(x, y, x, y + Math.min(48, h * 0.35));
    sheen.addColorStop(0, 'rgba(96, 226, 255, 0.14)');
    sheen.addColorStop(1, 'rgba(96, 226, 255, 0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, w, Math.min(48, h * 0.35));
    ctx.restore();

    // Inner hairline frame
    traceChamferRect(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(4, cut - 3));
    ctx.strokeStyle = kind === 'gold' || kind === 'cardActive' ? 'rgba(255, 223, 90, 0.45)' : 'rgba(76, 230, 255, 0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Outer primary neon border
    ctx.save();
    ctx.shadowColor = kind === 'gold' || kind === 'cardActive' ? 'rgba(255, 220, 82, 0.55)' : 'rgba(76, 230, 255, 0.45)';
    ctx.shadowBlur = 5;
    traceChamferRect(ctx, x, y, w, h, cut);
    ctx.strokeStyle = kind === 'gold' || kind === 'cardActive' ? '#ffdf5a' : '#43d9ff';
    ctx.lineWidth = kind === 'main' || kind === 'cardActive' ? 2.2 : 1.7;
    ctx.stroke();
    ctx.restore();

    // Bold golden diagonal corner brackets (signature Bullet Wake anime cockpit accent)
    const bracketCol = '#ffdf5a';
    ctx.strokeStyle = bracketCol;
    ctx.lineWidth = kind === 'main' ? 3.4 : 2.6;
    ctx.lineCap = 'square';
    const bLen = kind === 'main' ? 16 : 11;

    // Top-left gold corner bracket
    ctx.beginPath();
    ctx.moveTo(x, y + cut + bLen);
    ctx.lineTo(x, y + cut);
    ctx.lineTo(x + cut, y);
    ctx.lineTo(x + cut + bLen, y);
    ctx.stroke();

    // Bottom-right gold corner bracket
    ctx.beginPath();
    ctx.moveTo(x + w, y + h - cut - bLen);
    ctx.lineTo(x + w, y + h - cut);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x + w - cut - bLen, y + h);
    ctx.stroke();

    if (kind === 'gold' || kind === 'cardActive') {
      // Top-right & bottom-left brackets on active/gold frames
      ctx.beginPath();
      ctx.moveTo(x + w - cut - bLen, y);
      ctx.lineTo(x + w - cut, y);
      ctx.lineTo(x + w, y + cut);
      ctx.lineTo(x + w, y + cut + bLen);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + cut + bLen, y + h);
      ctx.lineTo(x + cut, y + h);
      ctx.lineTo(x, y + h - cut);
      ctx.lineTo(x, y + h - cut - bLen);
      ctx.stroke();
    }
  });

  const img = scene.add.image(cx, cy, key).setScale(1 / DPR).setAlpha(opts?.alpha ?? 1);
  parent.add(img);
  return img;
}

/**
 * Pure vector winged golden (or crimson) header banner straddling the top edge of menu panels.
 */
export function makeVectorBanner(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  w: number,
  h: number,
  label: string,
  opts?: { kind?: 'gold' | 'red'; icon?: VectorIconId; fontSize?: number; wings?: boolean },
): Phaser.GameObjects.Container {
  const kind = opts?.kind ?? 'gold';
  const wings = opts?.wings ?? true;
  const padX = wings ? 34 : 12;
  const padY = 10;
  const tw = Math.ceil(w + padX * 2);
  const th = Math.ceil(h + padY * 2);
  const key = `mv-banner-${kind}-${Math.round(w)}x${Math.round(h)}-w${wings ? 1 : 0}`;

  getOrMakeVectorTex(scene, key, tw, th, (ctx) => {
    const x = padX;
    const y = padY;
    const skew = Math.min(12, h * 0.34);

    // Optional golden side wings (matches concept prints 3-5!)
    if (wings) {
      const wg = ctx.createLinearGradient(0, y, 0, y + h);
      wg.addColorStop(0, kind === 'red' ? '#ff7c8c' : '#ffe96b');
      wg.addColorStop(1, kind === 'red' ? '#b81d38' : '#e08206');
      ctx.fillStyle = wg;
      ctx.strokeStyle = '#05122b';
      ctx.lineWidth = 1.6;
      // Left upper & lower wing fins
      for (const [dy, len] of [[4, 24], [h * 0.44, 17]] as const) {
        ctx.beginPath();
        ctx.moveTo(x + 4, y + dy);
        ctx.lineTo(x - len, y + dy - 1);
        ctx.lineTo(x - len + 6, y + dy + 6.5);
        ctx.lineTo(x + 2, y + dy + 6.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Right mirrored wing fins
        ctx.beginPath();
        ctx.moveTo(x + w - 4, y + dy);
        ctx.lineTo(x + w + len, y + dy - 1);
        ctx.lineTo(x + w + len - 6, y + dy + 6.5);
        ctx.lineTo(x + w - 2, y + dy + 6.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Main slanted banner trapezoid
    ctx.save();
    ctx.shadowColor = 'rgba(2, 9, 24, 0.72)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.moveTo(x + skew, y);
    ctx.lineTo(x + w - skew, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    if (kind === 'red') {
      grad.addColorStop(0, '#ff687b');
      grad.addColorStop(0.52, '#e02a46');
      grad.addColorStop(1, '#9e1129');
    } else {
      grad.addColorStop(0, '#fff27a');
      grad.addColorStop(0.48, '#ffd238');
      grad.addColorStop(1, '#ed8d0c');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Glossy top specular strip
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + skew, y);
    ctx.lineTo(x + w - skew, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.fillRect(x, y + 1.5, w, h * 0.28);
    ctx.restore();

    // Crisp dark ink + bright inner border
    ctx.beginPath();
    ctx.moveTo(x + skew, y);
    ctx.lineTo(x + w - skew, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.strokeStyle = '#05122b';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + skew + 1.5, y + 2);
    ctx.lineTo(x + w - skew - 1.5, y + 2);
    ctx.lineTo(x + w - 2.5, y + h - 2);
    ctx.lineTo(x + 2.5, y + h - 2);
    ctx.closePath();
    ctx.strokeStyle = kind === 'red' ? 'rgba(255, 210, 218, 0.65)' : 'rgba(255, 252, 210, 0.78)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });

  const ct = scene.add.container(cx, cy);
  ct.add(scene.add.image(0, 0, key).setScale(1 / DPR));

  const fs = opts?.fontSize ?? 16.5;
  const txtColor = kind === 'red' ? '#fff7f8' : '#071b3b';
  const strokeColor = kind === 'red' ? '#4a0715' : '#fff7bd';
  const txt = scene.add.text(opts?.icon ? 12 : 0, 1, label, {
    fontFamily: UI_FONT,
    fontSize: `${fs}px`,
    fontStyle: 'bold',
    color: txtColor,
    stroke: strokeColor,
    strokeThickness: 2,
  }).setResolution(2).setOrigin(0.5);
  ct.add(txt);

  if (opts?.icon) {
    const icoX = -txt.width * 0.5 - 3;
    makeVectorIconSprite(scene, ct, icoX, 0.5, opts.icon, Math.min(18, h * 0.56), txtColor, kind === 'red' ? '#ffdf5a' : '#4ce6ff');
  }

  parent.add(ct);
  return ct;
}

export interface VectorGaugeMeter {
  container: Phaser.GameObjects.Container;
  setValue: (filled: number) => void;
}

/**
 * Pure vector slanted-segment gauge meter (matches `/////` cyan, gold & green bars in prints 2-5!).
 */
export function makeVectorGauge(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  w: number,
  h: number,
  total: number,
  initialFilled: number,
  kind: 'cyan' | 'gold' | 'green' = 'cyan',
): VectorGaugeMeter {
  const ct = scene.add.container(cx, cy);
  const gfx = scene.add.graphics();
  ct.add(gfx);
  parent.add(ct);

  const colors = {
    cyan: { top: 0x7ef3ff, bot: 0x1ea8f2, glow: 0x4ce6ff },
    gold: { top: 0xfff078, bot: 0xf49b12, glow: 0xffdf5a },
    green: { top: 0x8cff7a, bot: 0x22c55e, glow: 0x4ade80 },
  }[kind];

  const draw = (filled: number) => {
    const n = Math.max(0, Math.min(total, Math.round(filled)));
    gfx.clear();
    const hw = w * 0.5;
    const hh = h * 0.5;
    const cut = Math.min(6, hh * 0.55);

    // Recessed track
    gfx.fillStyle(0x04122b, 0.94);
    gfx.beginPath();
    gfx.moveTo(-hw + cut, -hh);
    gfx.lineTo(hw - cut, -hh);
    gfx.lineTo(hw, -hh + cut);
    gfx.lineTo(hw, hh - cut);
    gfx.lineTo(hw - cut, hh);
    gfx.lineTo(-hw + cut, hh);
    gfx.lineTo(-hw, hh - cut);
    gfx.lineTo(-hw, -hh + cut);
    gfx.closePath();
    gfx.fillPath();

    gfx.lineStyle(1.3, 0x389fd4, 0.72);
    gfx.strokePath();

    if (total <= 0) return;

    const padX = 7;
    const padY = 3.5;
    const innerW = w - padX * 2;
    const gap = total >= 8 ? 3 : 4;
    const skew = Math.min(5, (h - padY * 2) * 0.36);
    const segW = (innerW - gap * (total - 1) - skew) / total;
    const topY = -hh + padY;
    const botY = hh - padY;
    const midY = (topY + botY) * 0.5;

    for (let i = 0; i < total; i++) {
      const sx = -hw + padX + i * (segW + gap);
      const on = i < n;
      // Full slanted segment
      gfx.fillStyle(on ? colors.bot : 0x10274c, on ? 1 : 0.85);
      gfx.beginPath();
      gfx.moveTo(sx + skew, topY);
      gfx.lineTo(sx + skew + segW, topY);
      gfx.lineTo(sx + segW, botY);
      gfx.lineTo(sx, botY);
      gfx.closePath();
      gfx.fillPath();

      if (on) {
        // Upper glossy cel highlight
        gfx.fillStyle(colors.top, 0.95);
        gfx.beginPath();
        gfx.moveTo(sx + skew, topY);
        gfx.lineTo(sx + skew + segW, topY);
        gfx.lineTo(sx + skew * 0.5 + segW, midY);
        gfx.lineTo(sx + skew * 0.5, midY);
        gfx.closePath();
        gfx.fillPath();
      } else {
        gfx.lineStyle(0.8, 0x22497a, 0.55);
        gfx.strokePath();
      }
    }
  };

  draw(initialFilled);
  return { container: ct, setValue: draw };
}

export interface VectorTogglePill {
  container: Phaser.GameObjects.Container;
  setValue: (on: boolean) => void;
}

/**
 * Crisp inline vector `NÃO | SIM` segmented toggle pill (matches Image 5 top-right!).
 */
export function makeVectorTogglePill(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  w: number,
  h: number,
  initialOn: boolean,
  labels: [string, string] = ['NÃO', 'SIM'],
): VectorTogglePill {
  const ct = scene.add.container(cx, cy);
  const gfx = scene.add.graphics();
  const leftTxt = scene.add.text(-w * 0.25, 0.5, labels[0], {
    fontFamily: UI_FONT, fontSize: '9.5px', fontStyle: 'bold', color: '#ffffff', stroke: '#05142e', strokeThickness: 2,
  }).setResolution(2).setOrigin(0.5);
  const rightTxt = scene.add.text(w * 0.25, 0.5, labels[1], {
    fontFamily: UI_FONT, fontSize: '9.5px', fontStyle: 'bold', color: '#ffffff', stroke: '#05142e', strokeThickness: 2,
  }).setResolution(2).setOrigin(0.5);
  ct.add([gfx, leftTxt, rightTxt]);
  parent.add(ct);

  const draw = (on: boolean) => {
    gfx.clear();
    const hw = w * 0.5;
    const hh = h * 0.5;
    const r = hh;
    // Outer track
    gfx.fillStyle(0x06193b, 0.96);
    gfx.fillRoundedRect(-hw, -hh, w, h, r);
    gfx.lineStyle(1.3, 0x3ea8e0, 0.8);
    gfx.strokeRoundedRect(-hw, -hh, w, h, r);

    // Highlighted active side
    const segW = hw - 2;
    const ax = on ? 1 : -hw + 2;
    gfx.fillStyle(on ? 0xffd23a : 0x19539e, 1);
    gfx.fillRoundedRect(ax, -hh + 2, segW, h - 4, Math.max(4, r - 2));
    gfx.fillStyle(0xffffff, on ? 0.34 : 0.16);
    gfx.fillRoundedRect(ax + 3, -hh + 3, segW - 6, (h - 6) * 0.42, 3);
    gfx.lineStyle(1.1, on ? 0xfff7bd : 0x5be8ff, 0.9);
    gfx.strokeRoundedRect(ax, -hh + 2, segW, h - 4, Math.max(4, r - 2));

    leftTxt.setColor(!on ? '#eef8ff' : '#7b9ec7').setStroke('#05142e', !on ? 2.4 : 1.5);
    rightTxt.setColor(on ? '#071a38' : '#7b9ec7').setStroke(on ? '#fff5b0' : '#05142e', on ? 1.8 : 1.5);
  };

  draw(initialOn);
  return { container: ct, setValue: draw };
}

/**
 * Pure 3D glossy vector keycap (replaces `icons.webp` bitmap key sprites in Controls!).
 */
export function makeVectorKeycap(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  label: string,
  opts?: { wide?: boolean; gold?: boolean; size?: number; fontSize?: number; width?: number },
): Phaser.GameObjects.Container {
  const h = opts?.size ?? 24;
  const wide = opts?.wide ?? label.length > 2;
  const w = opts?.width ?? (wide ? Math.max(Math.round(h * 2.55), Math.round(label.length * 7.2 + 16)) : h);
  const gold = !!opts?.gold;
  const pad = 4;
  const key = `mv-key-${gold ? 'g' : 'w'}-${w}x${h}`;

  getOrMakeVectorTex(scene, key, w + pad * 2, h + pad * 2, (ctx) => {
    const x = pad;
    const y = pad;
    const r = Math.min(6, h * 0.25);

    // 3D lower bevel thickness
    ctx.fillStyle = '#041028';
    traceRoundedRect(ctx, x - 1, y - 0.5, w + 2, h + 3, r + 1);
    ctx.fill();

    ctx.fillStyle = gold ? '#c96f04' : '#7aa4c7';
    traceRoundedRect(ctx, x, y + 2, w, h - 0.5, r);
    ctx.fill();

    // Key face gradient
    const face = ctx.createLinearGradient(x, y, x, y + h - 2);
    if (gold) {
      face.addColorStop(0, '#fff27a');
      face.addColorStop(0.55, '#ffc928');
      face.addColorStop(1, '#f08b0c');
    } else {
      face.addColorStop(0, '#ffffff');
      face.addColorStop(0.65, '#e2f1ff');
      face.addColorStop(1, '#bdd9f2');
    }
    traceRoundedRect(ctx, x, y, w, h - 2, r);
    ctx.fillStyle = face;
    ctx.fill();

    // Crisp rim
    ctx.strokeStyle = gold ? '#fff9cf' : '#ffffff';
    ctx.lineWidth = 1;
    traceRoundedRect(ctx, x + 0.8, y + 0.8, w - 1.6, h - 3.6, Math.max(2, r - 0.8));
    ctx.stroke();
  });

  const ct = scene.add.container(cx, cy);
  ct.add(scene.add.image(0, 0, key).setScale(1 / DPR));
  const fs = opts?.fontSize ?? (label.length > 6 ? 7.5 : label.length > 2 ? 8.5 : 10);
  const txt = scene.add.text(0, -0.5, label, {
    fontFamily: UI_FONT,
    fontSize: `${fs}px`,
    fontStyle: 'bold',
    color: gold ? '#3d1b00' : '#092347',
  }).setResolution(2).setOrigin(0.5);
  ct.add(txt);
  parent.add(ct);
  return ct;
}

/**
 * Pure vector winged footer hint bar with golden diagonal end-wings and miniature keycap pills!
 */
export function makeVectorHintBar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  y: number,
  padId?: string,
  extra?: { adjust?: boolean; noBack?: boolean },
): Phaser.GameObjects.Container {
  const hasPad = !!padId;
  const pl = padLabels(padId);

  const items: Array<{ key: string; label: string; badgeColor?: string }> = hasPad
    ? [
        { key: 'D-PAD', label: 'NAVEGAR' },
        ...(extra?.adjust ? [{ key: '←/→', label: 'AJUSTAR' }] : []),
        { key: pl.confirm, label: 'CONFIRMAR', badgeColor: pl.profile === 'playstation' ? '#ff5c8a' : '#ef4444' },
        ...(!extra?.noBack ? [{ key: pl.cancel, label: 'VOLTAR', badgeColor: pl.profile === 'playstation' ? '#4ea8ff' : '#22c55e' }] : []),
      ]
    : [
        { key: '↑↓', label: 'NAVEGAR' },
        ...(extra?.adjust ? [{ key: '←/→', label: 'AJUSTAR' }] : []),
        { key: 'ENTER', label: 'CONFIRMAR' },
        ...(!extra?.noBack ? [{ key: 'ESC', label: 'VOLTAR' }] : []),
      ];

  const ct = scene.add.container(384, y);
  const content = scene.add.container(0, 0);

  let cursorX = 0;
  const nodes: Phaser.GameObjects.GameObject[] = [];
  items.forEach((it, idx) => {
    if (idx > 0) {
      const sep = scene.add.text(cursorX + 6, 0, '•', {
        fontFamily: UI_FONT, fontSize: '9px', fontStyle: 'bold', color: '#4ce6ff',
      }).setResolution(2).setOrigin(0.5);
      nodes.push(sep);
      cursorX += 14;
    }
    const kw = Math.max(20, Math.round(it.key.length * 6.2 + 10));
    const pill = scene.add.graphics();
    if (it.badgeColor) {
      pill.fillStyle(0x091d42, 0.96).fillCircle(cursorX + 9, 0, 7.5);
      pill.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(it.badgeColor).color, 0.95).strokeCircle(cursorX + 9, 0, 7.5);
      const kt = scene.add.text(cursorX + 9, -0.5, it.key, {
        fontFamily: UI_FONT, fontSize: '9px', fontStyle: 'bold', color: '#ffffff',
      }).setResolution(2).setOrigin(0.5);
      nodes.push(pill, kt);
      cursorX += 21;
    } else {
      pill.fillStyle(0xf2f8ff, 0.96).fillRoundedRect(cursorX, -6.5, kw, 13, 3);
      pill.lineStyle(1, 0x0b254f, 0.85).strokeRoundedRect(cursorX, -6.5, kw, 13, 3);
      const kt = scene.add.text(cursorX + kw * 0.5, 0, it.key, {
        fontFamily: UI_FONT, fontSize: '7.5px', fontStyle: 'bold', color: '#071b3b',
      }).setResolution(2).setOrigin(0.5);
      nodes.push(pill, kt);
      cursorX += kw + 5;
    }
    const lt = scene.add.text(cursorX, 0.5, it.label, {
      fontFamily: UI_FONT, fontSize: '8.5px', fontStyle: 'bold', color: '#e6f5ff', stroke: '#040e24', strokeThickness: 2,
    }).setResolution(2).setOrigin(0, 0.5);
    nodes.push(lt);
    cursorX += lt.width + 4;
  });

  const totalW = Math.max(250, Math.ceil(cursorX) + 46);
  const h = 22;
  const barKey = `mv-hintbar-${totalW}x${h}`;
  getOrMakeVectorTex(scene, barKey, totalW + 24, h + 8, (ctx) => {
    const x = 12;
    const y0 = 4;
    // Main winged dark-navy bar
    ctx.save();
    ctx.shadowColor = 'rgba(2, 8, 22, 0.72)';
    ctx.shadowBlur = 6;
    traceWingedHex(ctx, x, y0, totalW, h, 12);
    const bg = ctx.createLinearGradient(x, y0, x, y0 + h);
    bg.addColorStop(0, 'rgba(13, 44, 98, 0.92)');
    bg.addColorStop(1, 'rgba(6, 20, 48, 0.95)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    // Cyan border
    traceWingedHex(ctx, x, y0, totalW, h, 12);
    ctx.strokeStyle = '#3ed8ff';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Golden chevron tips at left and right ends (exact match to prints!)
    const goldG = ctx.createLinearGradient(0, y0, 0, y0 + h);
    goldG.addColorStop(0, '#fff078');
    goldG.addColorStop(1, '#f08c0c');
    ctx.fillStyle = goldG;
    // Left gold tip
    ctx.beginPath();
    ctx.moveTo(x + 12, y0 + 2);
    ctx.lineTo(x + 18, y0 + 2);
    ctx.lineTo(x + 9, y0 + h * 0.5);
    ctx.lineTo(x + 18, y0 + h - 2);
    ctx.lineTo(x + 12, y0 + h - 2);
    ctx.lineTo(x + 3, y0 + h * 0.5);
    ctx.closePath();
    ctx.fill();
    // Right gold tip
    ctx.beginPath();
    ctx.moveTo(x + totalW - 12, y0 + 2);
    ctx.lineTo(x + totalW - 18, y0 + 2);
    ctx.lineTo(x + totalW - 9, y0 + h * 0.5);
    ctx.lineTo(x + totalW - 18, y0 + h - 2);
    ctx.lineTo(x + totalW - 12, y0 + h - 2);
    ctx.lineTo(x + totalW - 3, y0 + h * 0.5);
    ctx.closePath();
    ctx.fill();
  });

  ct.add(scene.add.image(0, 0, barKey).setScale(1 / DPR));
  content.add(nodes);
  content.setX(-cursorX * 0.5);
  ct.add(content);
  parent.add(ct);
  return ct;
}
