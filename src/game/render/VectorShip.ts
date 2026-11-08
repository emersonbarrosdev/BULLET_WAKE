import Phaser from 'phaser';

export interface VectorShipConfig {
  pilotId: string;
}

interface Palette {
  hull: number;
  hullDark: number;
  trim: number;
  canopy: number;
  engineGlow: number;
  engineCore: number;
  muzzle: number;
}

const PALETTES: Record<string, Palette> = {
  nolan: {
    hull: 0x1e3a5f,
    hullDark: 0x0f2238,
    trim: 0x38bdf8,
    canopy: 0xa5f3fc,
    engineGlow: 0x00f0ff,
    engineCore: 0xffffff,
    muzzle: 0x7df9ff,
  },
  cora: {
    hull: 0x4a1d6d,
    hullDark: 0x240a38,
    trim: 0xc084fc,
    canopy: 0x6ee7b7,
    engineGlow: 0xe879f9,
    engineCore: 0xffffff,
    muzzle: 0xf472b6,
  },
  harlan: {
    hull: 0x54361e,
    hullDark: 0x2b1a0e,
    trim: 0xf97316,
    canopy: 0xfde047,
    engineGlow: 0xf59e0b,
    engineCore: 0xffffff,
    muzzle: 0xfdba74,
  },
};

/**
 * BULLET WAKE V2 — Caça Espacial de Combate Vertical em Visão Superior (Top-Down).
 * Fiel à estética dos clássicos shoot 'em up verticais (Sonic Wings, Raiden, Fire Shark, DoDonPachi):
 * - Nariz afilado apontando para o topo da tela (-Y).
 * - Asas delta/aerodinâmicas simétricas se estendendo lateralmente.
 * - Cockpit central com cúpula translúcida e micro-hitbox precisa de 5px.
 * - Propulsores duplos traseiros emitindo chamas contínuas para baixo (+Y).
 * - Inclinação dinâmica em roll (banking) ao se mover para a esquerda (A) ou direita (D).
 * - Efeitos de propulsão de emergência (Dash), muzzle flashes e escudo de blindagem.
 */
export class VectorShip extends Phaser.GameObjects.Container {
  readonly halfWidth = 18;
  readonly halfHeight = 22;
  readonly hitRadius = 5;
  readonly pilotId: string;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly shieldGraphics: Phaser.GameObjects.Graphics;
  private readonly coreDot: Phaser.GameObjects.Graphics;
  private readonly palette: Palette;

  private bankAngle = 0;
  private targetBankAngle = 0;
  private flamePhase = 0;
  private isHit = false;
  private isFiring = false;
  private muzzleFlashTimer = 0;
  private hasShieldActive = false;

  constructor(scene: Phaser.Scene, x: number, y: number, pilotId = 'nolan') {
    super(scene, x, y);

    this.pilotId = pilotId;
    this.palette = PALETTES[pilotId] || PALETTES.nolan;

    this.graphics = scene.add.graphics();
    this.shieldGraphics = scene.add.graphics();
    this.coreDot = scene.add.graphics();

    this.add([this.shieldGraphics, this.graphics, this.coreDot]);
    this.setDepth(15);
    scene.add.existing(this);

    this.redraw(0, 0, false);
  }

  updateShip(
    dt: number,
    dx: number,
    _dy: number,
    hitRemainingMs: number,
    hasShield: boolean,
    isDashing = false,
  ): void {
    // 1. Inclinação aerodinâmica lateral (Banking / Roll ao mover para a esquerda ou direita)
    if (dx < 0) {
      this.targetBankAngle = -0.25; // Rola para a esquerda
    } else if (dx > 0) {
      this.targetBankAngle = 0.25;  // Rola para a direita
    } else {
      this.targetBankAngle = 0;
    }

    const lerpRate = Math.min(1, (dt * 14) / 1000);
    this.bankAngle += (this.targetBankAngle - this.bankAngle) * lerpRate;
    this.rotation = this.bankAngle * 0.45; // Leve rotação de proa combinada ao roll

    // 2. Animação de propulsão e estados de combate
    this.flamePhase += dt * 0.04;
    this.isHit = hitRemainingMs > 0;
    this.hasShieldActive = hasShield;
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    this.isFiring = this.muzzleFlashTimer > 0;

    this.redraw(dt, dx, isDashing);
  }

  triggerMuzzleFlash(): void {
    this.muzzleFlashTimer = 85;
  }

  private redraw(_dt: number, _dx: number, isDashing: boolean): void {
    const g = this.graphics;
    g.clear();

    const p = this.palette;
    const roll = this.bankAngle; // -0.25 a +0.25

    // Renderiza a silhueta top-down autêntica de cada caça
    if (this.pilotId === 'cora') {
      this.drawMothTopDown(g, p, roll, isDashing);
    } else if (this.pilotId === 'harlan') {
      this.drawKnuckleTopDown(g, p, roll, isDashing);
    } else {
      this.drawRivetTopDown(g, p, roll, isDashing);
    }

    // Micro-hitbox central visível no cockpit
    const cd = this.coreDot;
    cd.clear();
    const trimColor = this.isHit ? 0xff2222 : p.trim;
    cd.fillStyle(trimColor, 0.45);
    cd.fillCircle(0, 0, this.hitRadius + 1.5);
    cd.fillStyle(0xffffff, 0.95);
    cd.fillCircle(0, 0, 2);

    // Escudo de energia esférico (se ativo)
    const sg = this.shieldGraphics;
    sg.clear();
    if (this.hasShieldActive) {
      const shieldPulse = Math.sin(this.flamePhase * 3) * 0.12 + 0.55;
      sg.lineStyle(1.8, 0x00f0ff, shieldPulse);
      sg.strokeCircle(0, 0, 26);
      sg.fillStyle(0x00f0ff, 0.10);
      sg.fillCircle(0, 0, 26);
    }
  }

  /**
   * RIVET V3 (Nolan Fitch) — Caça Militar Tático Top-Down.
   * Nariz afilado com blindagem frontal ciano, asas delta swept-back e turbinas duplas.
   */
  private drawRivetTopDown(g: Phaser.GameObjects.Graphics, p: Palette, roll: number, dashing: boolean): void {
    // Compressão de perspectiva no roll (asa esquerda ou direita encurta levemente)
    const leftSpan = 18 * (1 + roll * 0.4);
    const rightSpan = 18 * (1 - roll * 0.4);

    // 1. Chamas dos Propulsores Traseiros (emitidas para baixo, +Y)
    const flameLen = dashing ? 28 : (14 + Math.sin(this.flamePhase) * 4);
    g.fillStyle(p.engineGlow, dashing ? 0.95 : 0.75);
    // Turbina esquerda
    g.fillTriangle(-6, 16, -2, 16, -4, 16 + flameLen);
    // Turbina direita
    g.fillTriangle(2, 16, 6, 16, 4, 16 + flameLen);
    // Núcleo branco das turbinas
    g.fillStyle(p.engineCore, 0.9);
    g.fillTriangle(-5, 16, -3, 16, -4, 16 + flameLen * 0.45);
    g.fillTriangle(3, 16, 5, 16, 4, 16 + flameLen * 0.45);

    // 2. Fuselagem Base / Asas (Delta Wing)
    g.fillStyle(this.isHit ? 0xff4444 : p.hullDark, 1);
    g.beginPath();
    g.moveTo(0, -22);                  // Nariz militar
    g.lineTo(rightSpan, 12);           // Ponta da asa direita
    g.lineTo(rightSpan * 0.7, 16);     // Borda de fuga direita
    g.lineTo(8, 16);                   // Encaixe turbina direita
    g.lineTo(0, 18);                   // Centro traseiro
    g.lineTo(-8, 16);                  // Encaixe turbina esquerda
    g.lineTo(-leftSpan * 0.7, 16);     // Borda de fuga esquerda
    g.lineTo(-leftSpan, 12);           // Ponta da asa esquerda
    g.closePath();
    g.fillPath();

    // 3. Fuselagem Superior Reforçada
    g.fillStyle(this.isHit ? 0xff8888 : p.hull, 1);
    g.beginPath();
    g.moveTo(0, -20);
    g.lineTo(rightSpan * 0.65, 8);
    g.lineTo(5, 14);
    g.lineTo(-5, 14);
    g.lineTo(-leftSpan * 0.65, 8);
    g.closePath();
    g.fillPath();

    // 4. Detalhes de Acabamento e Lâminas Militares (Trim Ciano)
    g.lineStyle(1.5, p.trim, 0.95);
    g.beginPath();
    g.moveTo(0, -18);
    g.lineTo(rightSpan * 0.85, 11);
    g.moveTo(0, -18);
    g.lineTo(-leftSpan * 0.85, 11);
    g.strokePath();

    // 5. Cockpit Central Translúcido (Canopy)
    g.fillStyle(p.canopy, 0.85);
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(3.5, -4);
    g.lineTo(0, 4);
    g.lineTo(-3.5, -4);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(1, -6, 1.4); // Brilho de reflexo solar

    // 6. Muzzle Flash nos Canos das Asas (ao atirar)
    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.9);
      g.fillCircle(-8, -12, 4);
      g.fillCircle(8, -12, 4);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(-8, -12, 2);
      g.fillCircle(8, -12, 2);
    }
  }

  /**
   * MOTH V2 (Cora Wren) — Interceptador Ágil de Asas Invertidas Top-Down.
   */
  private drawMothTopDown(g: Phaser.GameObjects.Graphics, p: Palette, roll: number, dashing: boolean): void {
    const leftSpan = 20 * (1 + roll * 0.45);
    const rightSpan = 20 * (1 - roll * 0.45);

    // Propulsores
    const flameLen = dashing ? 30 : (16 + Math.sin(this.flamePhase) * 5);
    g.fillStyle(p.engineGlow, 0.85);
    g.fillTriangle(-3, 14, 3, 14, 0, 14 + flameLen);
    g.fillStyle(0xffffff, 0.9);
    g.fillTriangle(-1.5, 14, 1.5, 14, 0, 14 + flameLen * 0.5);

    // Asas aerodinâmicas esbeltas
    g.fillStyle(this.isHit ? 0xff4444 : p.hullDark, 1);
    g.beginPath();
    g.moveTo(0, -24);
    g.lineTo(rightSpan, 6);
    g.lineTo(rightSpan * 0.8, 12);
    g.lineTo(4, 14);
    g.lineTo(-4, 14);
    g.lineTo(-leftSpan * 0.8, 12);
    g.lineTo(-leftSpan, 6);
    g.closePath();
    g.fillPath();

    // Corpo central magenta/ametista
    g.fillStyle(this.isHit ? 0xff8888 : p.hull, 1);
    g.beginPath();
    g.moveTo(0, -22);
    g.lineTo(6, 4);
    g.lineTo(0, 14);
    g.lineTo(-6, 4);
    g.closePath();
    g.fillPath();

    // Linhas de luz esmeralda/ametista
    g.lineStyle(1.5, p.trim, 0.9);
    g.lineBetween(-leftSpan * 0.85, 7, 0, -16);
    g.lineBetween(rightSpan * 0.85, 7, 0, -16);

    // Cockpit fino
    g.fillStyle(p.canopy, 0.9);
    g.fillEllipse(0, -6, 4, 11);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0.8, -9, 1.3);

    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.95);
      g.fillCircle(0, -26, 4);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(0, -26, 2);
    }
  }

  /**
   * KNUCKLE V2 (Harlan Greer) — Caça Blindado Pesado Top-Down.
   */
  private drawKnuckleTopDown(g: Phaser.GameObjects.Graphics, p: Palette, roll: number, dashing: boolean): void {
    const leftSpan = 21 * (1 + roll * 0.35);
    const rightSpan = 21 * (1 - roll * 0.35);

    // 4 turbinas pesadas traseiras
    const flameLen = dashing ? 32 : (15 + Math.sin(this.flamePhase) * 4);
    g.fillStyle(p.engineGlow, 0.8);
    for (const offset of [-8, -3, 3, 8]) {
      g.fillTriangle(offset - 1.5, 15, offset + 1.5, 15, offset, 15 + flameLen);
    }

    // Blindagem de chassi pesado
    g.fillStyle(this.isHit ? 0xff4444 : p.hullDark, 1);
    g.beginPath();
    g.moveTo(-6, -18);
    g.lineTo(6, -18);
    g.lineTo(rightSpan, 4);
    g.lineTo(rightSpan * 0.85, 15);
    g.lineTo(-leftSpan * 0.85, 15);
    g.lineTo(-leftSpan, 4);
    g.closePath();
    g.fillPath();

    // Revestimento de titânio
    g.fillStyle(this.isHit ? 0xff8888 : p.hull, 1);
    g.fillRect(-10, -12, 20, 24);

    // Borda angular alaranjada
    g.lineStyle(2, p.trim, 0.95);
    g.strokeRect(-9, -11, 18, 22);

    // Cockpit blindado dourado
    g.fillStyle(p.canopy, 0.85);
    g.fillRect(-4, -8, 8, 10);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(1, -6, 1.4);

    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.9);
      g.fillCircle(-7, -20, 5);
      g.fillCircle(7, -20, 5);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(-7, -20, 2.5);
      g.fillCircle(7, -20, 2.5);
    }
  }
}
