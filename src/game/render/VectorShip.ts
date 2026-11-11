import Phaser from 'phaser';

export type VectorShipViewMode = 'top-down' | 'profile';

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
 * BULLET WAKE V2 — Renderizador Vetorial Neo-Arcade de Caças Espaciais.
 * 
 * Modos de Apresentação:
 * 1. 'top-down': Visão superior de combate vertical, nariz ao norte -Y; colisão pelo casco visível.
 * 2. 'profile': Perfil lateral aeronáutico elegante para cards e interfaces de seleção.
 */
export class VectorShip extends Phaser.GameObjects.Container {
  get hullSprite(): Phaser.GameObjects.Sprite | undefined { return this.paintedRivet; }
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly hitRadius = 4.5; // Pickup collection only; damage uses hullCollision.ts.
  readonly pilotId: string;
  readonly viewMode: VectorShipViewMode;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly shieldGraphics: Phaser.GameObjects.Graphics;
  private readonly coreDot: Phaser.GameObjects.Graphics;
  private readonly palette: Palette;
  private readonly paintedRivet?: Phaser.GameObjects.Sprite;


  private bankAngle = 0;
  private targetBankAngle = 0;
  private flamePhase = 0;
  private isHit = false;
  private isFiring = false;
  private muzzleFlashTimer = 0;
  private hasShieldActive = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    pilotId = 'nolan',
    viewMode: VectorShipViewMode = 'top-down',
  ) {
    super(scene, x, y);

    this.pilotId = pilotId;
    this.viewMode = viewMode;
    this.palette = PALETTES[pilotId] || PALETTES.nolan;

    this.halfWidth = viewMode === 'profile' ? 22 : pilotId==='nolan'?16:14;
    this.halfHeight = viewMode === 'profile' ? 10 : pilotId==='nolan'?17:16;

    this.graphics = scene.add.graphics();
    this.shieldGraphics = scene.add.graphics();
    this.coreDot = scene.add.graphics();

    this.add([this.shieldGraphics, this.graphics, this.coreDot]);
    if ((pilotId === 'nolan'||pilotId==='lyra') && viewMode === 'top-down' && scene.textures.exists(pilotId==='lyra'?'hd-kestrel':'hd-rivet')) {
      this.paintedRivet = scene.add.sprite(0, 0, pilotId==='lyra'?'hd-kestrel':'hd-rivet', 0).setDisplaySize(40, 40);
      this.addAt(this.paintedRivet, 2);
    }
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
    if (this.viewMode === 'profile') {
      this.flamePhase += dt * 0.035;
      this.redraw(dt, 0, isDashing);
      return;
    }

    // 1. Inclinação aerodinâmica lateral (Banking / Roll ao mover para a esquerda ou direita)
    if (dx < 0) {
      this.targetBankAngle = -0.22; // Rola para a esquerda
    } else if (dx > 0) {
      this.targetBankAngle = 0.22;  // Rola para a direita
    } else {
      this.targetBankAngle = 0;
    }

    const lerpRate = Math.min(1, (dt * 14) / 1000);
    this.bankAngle += (this.targetBankAngle - this.bankAngle) * lerpRate;
    this.rotation = 0; // Orthographic view; lateral travel never tilts the image plane.

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

    if (this.viewMode === 'profile') {
      if (this.pilotId === 'cora') {
        this.drawMothProfile(g, p, isDashing);
      } else if (this.pilotId === 'harlan') {
        this.drawKnuckleProfile(g, p, isDashing);
      } else {
        this.drawRivetProfile(g, p, isDashing);
      }
      return;
    }

    const roll = 0;

    // Renderiza a silhueta top-down autêntica de cada caça
    if (this.pilotId === 'cora') {
      this.drawMothTopDown(g, p, roll, isDashing);
    } else if (this.pilotId === 'harlan') {
      this.drawKnuckleTopDown(g, p, roll, isDashing);
    } else if (this.paintedRivet) {
      const frame = Math.floor(this.flamePhase / 5) % 2;
      this.paintedRivet.setFrame(frame);
      if (this.isHit) this.paintedRivet.setTint(0xffbdb4);
      else this.paintedRivet.clearTint();
      // The animated muzzle sprite owns firing feedback; no flat oval over the nose.

    } else {
      this.drawRivetTopDown(g, p, roll, isDashing);
    }

    // Micro-hitbox central visível no cockpit
    const cd = this.coreDot;
    cd.clear();
    const trimColor = this.isHit ? 0xff2222 : p.trim;
    if(this.isHit) { cd.fillStyle(trimColor, .4); cd.fillEllipse(0,0,15,28); }

    // Escudo de energia esférico (se ativo)
    const sg = this.shieldGraphics;
    sg.clear();
    if (this.hasShieldActive) {
      const shieldPulse = Math.sin(this.flamePhase * 3) * 0.12 + 0.55;
      sg.lineStyle(1.8, 0x00f0ff, shieldPulse);
      sg.strokeCircle(0, 0, 22);
      sg.fillStyle(0x00f0ff, 0.10);
      sg.fillCircle(0, 0, 22);
    }
  }

  // =========================================================================
  // RENDERIZAÇÃO EM PERFIL LATERAL (Aeronave Subordinada para Menus e Cards)
  // =========================================================================

  /**
   * RIVET V3 — Perfil Lateral Aerodinâmico (Nolan Fitch)
   */
  private drawRivetProfile(g: Phaser.GameObjects.Graphics, p: Palette, isDashing: boolean): void {
    const flameLen = isDashing ? 24 : (12 + Math.sin(this.flamePhase) * 3);

    // 1. Chama da Turbina de Pós-Combustor (ejetada para trás / esquerda -X)
    g.fillStyle(p.engineGlow, 0.85);
    g.fillTriangle(-18, -2, -18, 2, -18 - flameLen, 0);
    g.fillStyle(p.engineCore, 0.95);
    g.fillTriangle(-18, -1.2, -18, 1.2, -18 - flameLen * 0.5, 0);

    // 2. Fuselagem Inferior / Intake
    g.fillStyle(p.hullDark, 1);
    g.beginPath();
    g.moveTo(20, 0);          // Ponta do nariz militar
    g.lineTo(12, 4);          // Queixo aerodinâmico
    g.lineTo(-10, 4);         // Linha ventral
    g.lineTo(-18, 2);         // Bocal de exaustão
    g.lineTo(-18, -2);
    g.lineTo(-10, -1);
    g.lineTo(10, -1);
    g.closePath();
    g.fillPath();

    // 3. Fuselagem Superior com Estabilizador Dorsal
    g.fillStyle(p.hull, 1);
    g.beginPath();
    g.moveTo(20, 0);
    g.lineTo(6, -3);          // Cobertura do nariz
    g.lineTo(-2, -3);         // Base do cockpit
    g.lineTo(-12, -8);        // Topo da deriva vertical dorsal
    g.lineTo(-16, -8);
    g.lineTo(-18, -2);
    g.lineTo(10, 0);
    g.closePath();
    g.fillPath();

    // 4. Asa em Diedro de Perfil
    g.fillStyle(p.trim, 0.9);
    g.beginPath();
    g.moveTo(2, 0);
    g.lineTo(-12, 5);
    g.lineTo(-15, 4);
    g.lineTo(-6, 0);
    g.closePath();
    g.fillPath();

    // 5. Cockpit Canopy em Bolha Translúcida Ciano
    g.fillStyle(p.canopy, 0.95);
    g.beginPath();
    g.moveTo(10, -1);
    g.lineTo(2, -5);
    g.lineTo(-4, -5);
    g.lineTo(-7, -2);
    g.closePath();
    g.fillPath();

    // Reflexo de luz
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(1, -4.5, 4, 1.2);
  }

  /**
   * MOTH V2 — Perfil Lateral Curvo e Esguio (Cora Vance)
   */
  private drawMothProfile(g: Phaser.GameObjects.Graphics, p: Palette, isDashing: boolean): void {
    const flameLen = isDashing ? 26 : (13 + Math.sin(this.flamePhase) * 3);

    // Chama magenta
    g.fillStyle(p.engineGlow, 0.85);
    g.fillTriangle(-18, -2, -18, 2, -18 - flameLen, 0);
    g.fillStyle(0xffffff, 0.9);
    g.fillTriangle(-18, -1, -18, 1, -18 - flameLen * 0.5, 0);

    // Fuselagem fluida
    g.fillStyle(p.hullDark, 1);
    g.beginPath();
    g.moveTo(22, 1);
    g.lineTo(8, 5);
    g.lineTo(-12, 3);
    g.lineTo(-18, 1);
    g.lineTo(-18, -1);
    g.lineTo(8, -2);
    g.closePath();
    g.fillPath();

    g.fillStyle(p.hull, 1);
    g.beginPath();
    g.moveTo(22, 1);
    g.lineTo(4, -4);
    g.lineTo(-10, -9);
    g.lineTo(-14, -8);
    g.lineTo(-18, -1);
    g.closePath();
    g.fillPath();

    // Cockpit esmeralda alongado
    g.fillStyle(p.canopy, 0.95);
    g.beginPath();
    g.moveTo(12, 0);
    g.lineTo(2, -5);
    g.lineTo(-5, -4);
    g.lineTo(-7, 0);
    g.closePath();
    g.fillPath();
  }

  /**
   * KNUCKLE V2 — Perfil Lateral Blindado e Robusto (Harlan Cruz)
   */
  private drawKnuckleProfile(g: Phaser.GameObjects.Graphics, p: Palette, isDashing: boolean): void {
    const flameLen = isDashing ? 26 : (14 + Math.sin(this.flamePhase) * 3);

    // Chama alaranjada dupla
    g.fillStyle(p.engineGlow, 0.85);
    g.fillTriangle(-18, -4, -18, -1, -18 - flameLen, -2.5);
    g.fillTriangle(-18, 1, -18, 4, -18 - flameLen, 2.5);

    // Chassi blindado espesso
    g.fillStyle(p.hullDark, 1);
    g.fillRect(-18, -3, 34, 8);

    g.fillStyle(p.hull, 1);
    g.fillRect(-14, -6, 26, 4);

    // Borda de titânio laranja
    g.lineStyle(1.5, p.trim, 0.95);
    g.strokeRect(-16, -5, 30, 9);

    // Cockpit blindado dourado
    g.fillStyle(p.canopy, 0.95);
    g.fillRect(0, -5, 8, 3);
  }

  // =========================================================================
  // RENDERIZAÇÃO TOP-DOWN (Visão Superior de Combate Vertical)
  // =========================================================================

  /**
   * RIVET V3 (Nolan Fitch) — Caça Militar Tático Top-Down (28×32px).
   */
  private drawRivetTopDown(g: Phaser.GameObjects.Graphics, p: Palette, roll: number, dashing: boolean): void {
    const leftSpan = 14 * (1 + roll * 0.35);
    const rightSpan = 14 * (1 - roll * 0.35);

    // 1. Chamas das Turbinas Traseiras (+Y)
    const flameLen = dashing ? 22 : (12 + Math.sin(this.flamePhase) * 3);
    g.fillStyle(p.engineGlow, dashing ? 0.95 : 0.75);
    g.fillTriangle(-5, 12, -1, 12, -3, 12 + flameLen);
    g.fillTriangle(1, 12, 5, 12, 3, 12 + flameLen);
    g.fillStyle(p.engineCore, 0.9);
    g.fillTriangle(-4, 12, -2, 12, -3, 12 + flameLen * 0.45);
    g.fillTriangle(2, 12, 4, 12, 3, 12 + flameLen * 0.45);

    // 2. Fuselagem Base / Asas Delta
    g.fillStyle(this.isHit ? 0xff4444 : p.hullDark, 1);
    g.beginPath();
    g.moveTo(0, -16);                  // Nariz militar
    g.lineTo(rightSpan, 8);            // Asa direita
    g.lineTo(rightSpan * 0.75, 12);
    g.lineTo(6, 12);
    g.lineTo(0, 14);
    g.lineTo(-6, 12);
    g.lineTo(-leftSpan * 0.75, 12);
    g.lineTo(-leftSpan, 8);            // Asa esquerda
    g.closePath();
    g.fillPath();

    // 3. Fuselagem Superior Reforçada
    g.fillStyle(this.isHit ? 0xff8888 : p.hull, 1);
    g.beginPath();
    g.moveTo(0, -15);
    g.lineTo(rightSpan * 0.6, 6);
    g.lineTo(4, 11);
    g.lineTo(-4, 11);
    g.lineTo(-leftSpan * 0.6, 6);
    g.closePath();
    g.fillPath();

    // 4. Detalhes de Acabamento e Lâminas Militares (Trim Ciano)
    g.lineStyle(1.2, p.trim, 0.95);
    g.beginPath();
    g.moveTo(0, -13);
    g.lineTo(rightSpan * 0.8, 8);
    g.moveTo(0, -13);
    g.lineTo(-leftSpan * 0.8, 8);
    g.strokePath();

    // 5. Cockpit Central Translúcido (Canopy)
    g.fillStyle(p.canopy, 0.9);
    g.beginPath();
    g.moveTo(0, -10);
    g.lineTo(2.8, -2);
    g.lineTo(0, 4);
    g.lineTo(-2.8, -2);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0.8, -4, 1.2);

    // 6. Muzzle Flash
    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.95);
      g.fillCircle(-6, -8, 3.5);
      g.fillCircle(6, -8, 3.5);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(-6, -8, 1.8);
      g.fillCircle(6, -8, 1.8);
    }
  }

  /**
   * MOTH V2 (Cora Vance) — Interceptador Ágil Top-Down (28×32px).
   */
  private drawMothTopDown(g: Phaser.GameObjects.Graphics, p: Palette, roll: number, dashing: boolean): void {
    const leftSpan = 15 * (1 + roll * 0.4);
    const rightSpan = 15 * (1 - roll * 0.4);

    const flameLen = dashing ? 24 : (13 + Math.sin(this.flamePhase) * 4);
    g.fillStyle(p.engineGlow, 0.85);
    g.fillTriangle(-2.5, 12, 2.5, 12, 0, 12 + flameLen);
    g.fillStyle(0xffffff, 0.9);
    g.fillTriangle(-1.2, 12, 1.2, 12, 0, 12 + flameLen * 0.5);

    g.fillStyle(this.isHit ? 0xff4444 : p.hullDark, 1);
    g.beginPath();
    g.moveTo(0, -17);
    g.lineTo(rightSpan, 5);
    g.lineTo(rightSpan * 0.75, 10);
    g.lineTo(3, 12);
    g.lineTo(-3, 12);
    g.lineTo(-leftSpan * 0.75, 10);
    g.lineTo(-leftSpan, 5);
    g.closePath();
    g.fillPath();

    g.fillStyle(this.isHit ? 0xff8888 : p.hull, 1);
    g.beginPath();
    g.moveTo(0, -15);
    g.lineTo(5, 3);
    g.lineTo(0, 11);
    g.lineTo(-5, 3);
    g.closePath();
    g.fillPath();

    g.lineStyle(1.2, p.trim, 0.9);
    g.lineBetween(-leftSpan * 0.8, 6, 0, -12);
    g.lineBetween(rightSpan * 0.8, 6, 0, -12);

    g.fillStyle(p.canopy, 0.9);
    g.fillEllipse(0, -4, 3.2, 8);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0.7, -6, 1.1);

    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.95);
      g.fillCircle(0, -18, 3.5);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(0, -18, 1.8);
    }
  }

  /**
   * KNUCKLE V2 (Harlan Cruz) — Caça Blindado Top-Down (28×32px).
   */
  private drawKnuckleTopDown(g: Phaser.GameObjects.Graphics, p: Palette, roll: number, dashing: boolean): void {
    const leftSpan = 15 * (1 + roll * 0.3);
    const rightSpan = 15 * (1 - roll * 0.3);

    const flameLen = dashing ? 24 : (12 + Math.sin(this.flamePhase) * 3);
    g.fillStyle(p.engineGlow, 0.8);
    for (const offset of [-6, -2, 2, 6]) {
      g.fillTriangle(offset - 1.2, 12, offset + 1.2, 12, offset, 12 + flameLen);
    }

    g.fillStyle(this.isHit ? 0xff4444 : p.hullDark, 1);
    g.beginPath();
    g.moveTo(-5, -14);
    g.lineTo(5, -14);
    g.lineTo(rightSpan, 3);
    g.lineTo(rightSpan * 0.8, 12);
    g.lineTo(-leftSpan * 0.8, 12);
    g.lineTo(-leftSpan, 3);
    g.closePath();
    g.fillPath();

    g.fillStyle(this.isHit ? 0xff8888 : p.hull, 1);
    g.fillRect(-8, -9, 16, 18);

    g.lineStyle(1.5, p.trim, 0.95);
    g.strokeRect(-7, -8, 14, 16);

    g.fillStyle(p.canopy, 0.85);
    g.fillRect(-3, -6, 6, 7);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(0.8, -4, 1.1);

    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.9);
      g.fillCircle(-5, -15, 4);
      g.fillCircle(5, -15, 4);
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(-5, -15, 2);
      g.fillCircle(5, -15, 2);
    }
  }
}
