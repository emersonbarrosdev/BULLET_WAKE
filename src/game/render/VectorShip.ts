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
    hull: 0x1f364d,
    hullDark: 0x122232,
    trim: 0x5eead4,
    canopy: 0xa5f3fc,
    engineGlow: 0x38bdf8,
    engineCore: 0xffffff,
    muzzle: 0x7df9ff,
  },
  cora: {
    hull: 0x361f49,
    hullDark: 0x1e102b,
    trim: 0xc084fc,
    canopy: 0x6ee7b7,
    engineGlow: 0xd946ef,
    engineCore: 0xffffff,
    muzzle: 0xf472b6,
  },
  harlan: {
    hull: 0x3a2c24,
    hullDark: 0x221813,
    trim: 0xf97316,
    canopy: 0xfde047,
    engineGlow: 0xf59e0b,
    engineCore: 0xffffff,
    muzzle: 0xfdba74,
  },
};

/**
 * Nave de caça vetorial ultranítida, ágil e compacta.
 * Substitui o sprite excessivamente volumoso por uma geometria de caça espacial moderna,
 * permitindo movimentação livre até o topo e rodapé da tela com micro-hitbox precisa.
 */
export class VectorShip extends Phaser.GameObjects.Container {
  readonly halfWidth = 19;
  readonly halfHeight = 11;
  readonly hitRadius = 5;

  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly shieldGraphics: Phaser.GameObjects.Graphics;
  private readonly coreDot: Phaser.GameObjects.Graphics;
  private readonly palette: Palette;

  private targetRotation = 0;
  private flamePhase = 0;
  private isHit = false;
  private isFiring = false;
  private muzzleFlashTimer = 0;
  private hasShieldActive = false;

  constructor(scene: Phaser.Scene, x: number, y: number, pilotId = 'nolan') {
    super(scene, x, y);

    this.palette = PALETTES[pilotId] || PALETTES.nolan;

    this.graphics = scene.add.graphics();
    this.shieldGraphics = scene.add.graphics();
    this.coreDot = scene.add.graphics();

    this.add([this.shieldGraphics, this.graphics, this.coreDot]);
    this.setDepth(15);
    scene.add.existing(this);

    this.redraw(0, false, 0);
  }

  updateShip(dt: number, dy: number, isMovingForward: boolean, hitRemainingMs: number, hasShield: boolean): void {
    // 1. Inclinação (banking) aerodinâmica fluida ao subir/descer
    if (dy < 0) {
      this.targetRotation = -0.19; // Inclinando para cima (~-11°)
    } else if (dy > 0) {
      this.targetRotation = 0.19;  // Inclinando para baixo (~+11°)
    } else {
      this.targetRotation = 0;
    }
    this.rotation += (this.targetRotation - this.rotation) * Math.min(1, (dt * 12) / 1000);

    // 2. Animação de propulsão e dano
    this.flamePhase += dt * 0.035;
    this.isHit = hitRemainingMs > 0;
    this.hasShieldActive = hasShield;
    this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
    this.isFiring = this.muzzleFlashTimer > 0;

    this.redraw(dt, isMovingForward, dy);
  }

  triggerMuzzleFlash(): void {
    this.muzzleFlashTimer = 90;
  }

  private redraw(_dt: number, isForward: boolean, _dy: number): void {
    const g = this.graphics;
    g.clear();

    const p = this.palette;
    const bodyColor = this.isHit ? 0xffffff : p.hull;
    const darkColor = this.isHit ? 0xff7777 : p.hullDark;
    const trimColor = this.isHit ? 0xff3333 : p.trim;

    // --- A. Chamas dos Motores Duplos Traseiros ---
    const flameStretch = isForward ? 1.6 : 1.0;
    const flicker1 = Math.sin(this.flamePhase) * 3 + Math.random() * 2;
    const flicker2 = Math.cos(this.flamePhase * 1.3) * 3 + Math.random() * 2;
    const flameLenTop = (13 + flicker1) * flameStretch;
    const flameLenBot = (13 + flicker2) * flameStretch;

    // Chama superior (offset Y = -4.5)
    g.fillStyle(p.engineGlow, 0.7);
    g.beginPath();
    g.moveTo(-18, -2.5);
    g.lineTo(-18 - flameLenTop, -4.5);
    g.lineTo(-18, -6.5);
    g.closePath();
    g.fillPath();

    g.fillStyle(p.engineCore, 0.95);
    g.beginPath();
    g.moveTo(-18, -3.5);
    g.lineTo(-18 - flameLenTop * 0.55, -4.5);
    g.lineTo(-18, -5.5);
    g.closePath();
    g.fillPath();

    // Chama inferior (offset Y = 4.5)
    g.fillStyle(p.engineGlow, 0.7);
    g.beginPath();
    g.moveTo(-18, 6.5);
    g.lineTo(-18 - flameLenBot, 4.5);
    g.lineTo(-18, 2.5);
    g.closePath();
    g.fillPath();

    g.fillStyle(p.engineCore, 0.95);
    g.beginPath();
    g.moveTo(-18, 5.5);
    g.lineTo(-18 - flameLenBot * 0.55, 4.5);
    g.lineTo(-18, 3.5);
    g.closePath();
    g.fillPath();

    // --- B. Asas e Envergadura (Geometria em Cunha / Flecha) ---
    // Asa superior
    g.fillStyle(darkColor, 1);
    g.beginPath();
    g.moveTo(-5, 0);
    g.lineTo(-17, -11);
    g.lineTo(-6, -11);
    g.lineTo(7, -3);
    g.closePath();
    g.fillPath();

    // Asa inferior
    g.beginPath();
    g.moveTo(-5, 0);
    g.lineTo(-17, 11);
    g.lineTo(-6, 11);
    g.lineTo(7, 3);
    g.closePath();
    g.fillPath();

    // Borda de ataque com brilho metálico
    g.lineStyle(1.5, trimColor, 1);
    g.strokeLineShape(new Phaser.Geom.Line(-6, -11, 7, -3));
    g.strokeLineShape(new Phaser.Geom.Line(-6, 11, 7, 3));

    // Canhões nas pontas das asas
    g.fillStyle(0x0a1017, 1);
    g.fillRect(-8, -12, 10, 2);
    g.fillRect(-8, 10, 10, 2);

    // Muzzle flashes quando disparando
    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.9);
      g.fillCircle(3, -11, 3);
      g.fillCircle(3, 11, 3);
    }

    // --- C. Fuselagem Principal ---
    g.fillStyle(bodyColor, 1);
    g.beginPath();
    g.moveTo(20, 0);       // Nariz afilado
    g.lineTo(3, -5.5);
    g.lineTo(-18, -4.5);
    g.lineTo(-16, 0);
    g.lineTo(-18, 4.5);
    g.lineTo(3, 5.5);
    g.closePath();
    g.fillPath();

    // Relevo do chassi e contorno
    g.lineStyle(1, trimColor, 0.85);
    g.strokeLineShape(new Phaser.Geom.Line(20, 0, -16, 0));
    g.strokeLineShape(new Phaser.Geom.Line(12, -2, -12, -4));
    g.strokeLineShape(new Phaser.Geom.Line(12, 2, -12, 4));

    // --- D. Canopy / Cockpit com reflexo de vidro ---
    g.fillStyle(0x06111a, 1);
    g.fillRoundedRect(0, -2.5, 10, 5, 2);

    g.fillStyle(p.canopy, 0.9);
    g.beginPath();
    g.moveTo(9, 0);
    g.lineTo(2, -1.8);
    g.lineTo(1, 1.8);
    g.closePath();
    g.fillPath();

    // Glint branco no vidro
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(5, -0.8, 1);

    // --- E. Micro-Hitbox Dot (Núcleo Vulnerável Visível) ---
    const cd = this.coreDot;
    cd.clear();
    // Halo suave
    cd.fillStyle(trimColor, 0.35);
    cd.fillCircle(0, 0, this.hitRadius + 1.5);
    // Ponto central nítido
    cd.fillStyle(0xffffff, 0.95);
    cd.fillCircle(0, 0, 2.5);

    // --- F. Campo de Força de Escudo ---
    const sg = this.shieldGraphics;
    sg.clear();
    if (this.hasShieldActive) {
      const pulse = Math.sin(this.flamePhase * 1.5) * 1.5;
      sg.lineStyle(1.8, 0x67e8f9, 0.85);
      sg.fillStyle(0x38bdf8, 0.15);
      sg.strokeEllipse(0, 0, (this.halfWidth + 7 + pulse) * 2, (this.halfHeight + 6 + pulse) * 2);
      sg.fillEllipse(0, 0, (this.halfWidth + 7 + pulse) * 2, (this.halfHeight + 6 + pulse) * 2);
    }
  }
}
