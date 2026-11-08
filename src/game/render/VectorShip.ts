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
    hull: 0x224460,
    hullDark: 0x122232,
    trim: 0x38bdf8,
    canopy: 0xa5f3fc,
    engineGlow: 0x00f0ff,
    engineCore: 0xffffff,
    muzzle: 0x7df9ff,
  },
  cora: {
    hull: 0x3d1d52,
    hullDark: 0x200e2e,
    trim: 0xc084fc,
    canopy: 0x6ee7b7,
    engineGlow: 0xe879f9,
    engineCore: 0xffffff,
    muzzle: 0xf472b6,
  },
  harlan: {
    hull: 0x422f22,
    hullDark: 0x231710,
    trim: 0xf97316,
    canopy: 0xfde047,
    engineGlow: 0xf59e0b,
    engineCore: 0xffffff,
    muzzle: 0xfdba74,
  },
};

/**
 * Caça espacial de combate horizontal desenhado estritamente DE PERFIL (side-view / perfil lateral).
 * Fiel à estética dos clássicos shoot 'em up horizontais (R-Type, Vic Viper, Thunder Force):
 * - Nariz militar afilado apontando à frente (+X)
 * - Cúpula do cockpit no topo (-Y) com reflexo translúcido
 * - Quilha e entradas de ar inferiores (+Y)
 * - Asas e pods de armas em perfil lateral
 * - Propulsor traseiro emitindo jato de plasma contínuo à esquerda (-X)
 * - Inclinação aerodinâmica dinâmica (pitch / banking tilt)
 * - Micro-hitbox precisa de 5px centralizada no cockpit
 */
export class VectorShip extends Phaser.GameObjects.Container {
  readonly halfWidth = 22;
  readonly halfHeight = 11;
  readonly hitRadius = 5;
  readonly pilotId: string;

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

    this.pilotId = pilotId;
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
    // 1. Inclinação aerodinâmica de perfil (nariz empina ao subir e mergulha ao descer)
    if (dy < 0) {
      this.targetRotation = -0.20; // Nariz inclinado para cima (~-11.5°)
    } else if (dy > 0) {
      this.targetRotation = 0.20;  // Nariz inclinado para baixo (~+11.5°)
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

    // Renderiza a silhueta de perfil lateral autêntica correspondente ao caça
    if (this.pilotId === 'cora') {
      this.drawMothProfile(g, p, isForward);
    } else if (this.pilotId === 'harlan') {
      this.drawKnuckleProfile(g, p, isForward);
    } else {
      this.drawRivetProfile(g, p, isForward);
    }

    // Micro-hitbox visível (ponto de precisão no núcleo da cabine)
    const cd = this.coreDot;
    cd.clear();
    const trimColor = this.isHit ? 0xff3333 : p.trim;
    cd.fillStyle(trimColor, 0.35);
    cd.fillCircle(0, 0, this.hitRadius + 1.5);
    cd.fillStyle(0xffffff, 0.95);
    cd.fillCircle(0, 0, 2);

    // Campo de força de escudo (quando ativo)
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

  /** NOLAN FITCH — RIVET: Caça Militar de Interceptação Espacial (Perfil Lateral) */
  private drawRivetProfile(g: Phaser.GameObjects.Graphics, p: Palette, isForward: boolean): void {
    const bodyColor = this.isHit ? 0xffffff : p.hull;
    const darkColor = this.isHit ? 0xff7777 : p.hullDark;
    const trimColor = this.isHit ? 0xff3333 : p.trim;

    // 1. Propulsor Traseiro e Chama de Plasma (saindo para a esquerda, -X)
    const flameStretch = isForward ? 1.7 : 1.0;
    const flick = Math.sin(this.flamePhase) * 3 + (Math.random() - 0.5) * 2;
    const flameLen = (16 + flick) * flameStretch;

    // Pluma externa de plasma (ciano neon)
    g.fillStyle(p.engineGlow, 0.75);
    g.beginPath();
    g.moveTo(-18, -4.5);
    g.lineTo(-18 - flameLen, 0);
    g.lineTo(-18, 4.5);
    g.closePath();
    g.fillPath();

    // Núcleo incandescente de plasma (branco quente)
    g.fillStyle(p.engineCore, 0.95);
    g.beginPath();
    g.moveTo(-18, -2.5);
    g.lineTo(-18 - flameLen * 0.55, 0);
    g.lineTo(-18, 2.5);
    g.closePath();
    g.fillPath();

    // Bocal da turbina em titânio escuro
    g.fillStyle(0x0e1722, 1);
    g.fillRect(-20, -5, 4, 10);
    g.lineStyle(1, 0x38bdf8, 0.8);
    g.strokeRect(-20, -5, 4, 10);

    // 2. Barbatana Dorsal / Estabilizador Vertical Superior
    g.fillStyle(darkColor, 1);
    g.beginPath();
    g.moveTo(-6, -4);
    g.lineTo(-17, -13);
    g.lineTo(-19, -13);
    g.lineTo(-19, -4);
    g.closePath();
    g.fillPath();

    g.lineStyle(1.2, trimColor, 1);
    g.strokeLineShape(new Phaser.Geom.Line(-6, -4, -17, -13));

    // 3. Quilha / Aleta Estabilizadora Ventral Inferior
    g.fillStyle(darkColor, 1);
    g.beginPath();
    g.moveTo(-4, 4);
    g.lineTo(-14, 10);
    g.lineTo(-16, 10);
    g.lineTo(-16, 4);
    g.closePath();
    g.fillPath();

    g.lineStyle(1, trimColor, 0.8);
    g.strokeLineShape(new Phaser.Geom.Line(-4, 4, -14, 10));

    // 4. Fuselagem Principal em Perfil Lateral (Silhueta de Caça Estilo R-Type)
    g.fillStyle(bodyColor, 1);
    g.beginPath();
    g.moveTo(23, 1);       // Bico afilado frontal
    g.lineTo(12, -2.5);    // Subida suave até base do cockpit
    g.lineTo(3, -3.5);     // Frente da cabine
    g.lineTo(-17, -4);     // Costas dorsal até o motor
    g.lineTo(-17, 4.5);    // Traseira
    g.lineTo(-4, 4.5);     // Ventral traseira
    g.lineTo(6, 4);        // Entrada de ar ventral
    g.lineTo(15, 2.5);     // Rampa inferior do nariz
    g.closePath();
    g.fillPath();

    // Relevo de blindagem e linha de painel longitudinal
    g.lineStyle(1, trimColor, 0.9);
    g.strokeLineShape(new Phaser.Geom.Line(23, 1, -16, 1));
    g.strokeLineShape(new Phaser.Geom.Line(10, 3, -12, 3));

    // 5. Asa em Perfil Lateral (Corte transversal afiado no flanco da fuselagem)
    g.fillStyle(darkColor, 1);
    g.beginPath();
    g.moveTo(8, 2);
    g.lineTo(-8, 7);
    g.lineTo(-15, 7);
    g.lineTo(-7, 2);
    g.closePath();
    g.fillPath();

    g.lineStyle(1.2, trimColor, 1);
    g.strokeLineShape(new Phaser.Geom.Line(8, 2, -8, 7));

    // Pod de arma / Míssil sob a asa
    g.fillStyle(0x0a141e, 1);
    g.fillRect(-4, 7, 12, 2.5);
    g.fillStyle(trimColor, 1);
    g.fillRect(8, 7.5, 2, 1.5);

    // 6. Cockpit / Canopy Superior em Perfil Lateral (Cúpula de Vidro Aeronáutica)
    g.fillStyle(0x07131f, 1);
    g.beginPath();
    g.moveTo(9, -2.5);
    g.lineTo(2, -7.5);
    g.lineTo(-5, -7.5);
    g.lineTo(-8, -3.5);
    g.closePath();
    g.fillPath();

    g.fillStyle(p.canopy, 0.95);
    g.beginPath();
    g.moveTo(7.5, -3);
    g.lineTo(1.8, -6.5);
    g.lineTo(-4.2, -6.5);
    g.lineTo(-6.5, -3);
    g.closePath();
    g.fillPath();

    // Brilho especular
    g.fillStyle(0xffffff, 0.95);
    g.beginPath();
    g.moveTo(5, -3.8);
    g.lineTo(1.5, -6);
    g.lineTo(-2, -6);
    g.closePath();
    g.fillPath();

    // 7. Muzzle Flash na Ponta do Bico
    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.95);
      g.fillCircle(25, 1, 4.5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(24, 1, 2.5);
    }
  }

  /** CORA WREN — MOTH: Interceptador Ultra-Ágil e Evasivo (Perfil Lateral) */
  private drawMothProfile(g: Phaser.GameObjects.Graphics, p: Palette, isForward: boolean): void {
    const bodyColor = this.isHit ? 0xffffff : p.hull;
    const darkColor = this.isHit ? 0xff7777 : p.hullDark;
    const trimColor = this.isHit ? 0xff3333 : p.trim;

    // 1. Motores Duplos de Íons Rápidos (offset Y = -2.5 e +2.5)
    const flameStretch = isForward ? 1.8 : 1.1;
    const flick1 = Math.sin(this.flamePhase * 1.5) * 2.5;
    const flick2 = Math.cos(this.flamePhase * 1.7) * 2.5;
    const len1 = (14 + flick1) * flameStretch;
    const len2 = (14 + flick2) * flameStretch;

    // Jato superior
    g.fillStyle(p.engineGlow, 0.7);
    g.beginPath();
    g.moveTo(-17, -1);
    g.lineTo(-17 - len1, -3);
    g.lineTo(-17, -4.5);
    g.closePath();
    g.fillPath();

    // Jato inferior
    g.fillStyle(p.engineGlow, 0.7);
    g.beginPath();
    g.moveTo(-17, 1);
    g.lineTo(-17 - len2, 3);
    g.lineTo(-17, 4.5);
    g.closePath();
    g.fillPath();

    // Núcleos brancos
    g.fillStyle(p.engineCore, 0.95);
    g.fillRect(-17 - len1 * 0.45, -3.5, len1 * 0.45, 1.5);
    g.fillRect(-17 - len2 * 0.45, 2, len2 * 0.45, 1.5);

    // Bocal duplo metálico
    g.fillStyle(0x181020, 1);
    g.fillRect(-19, -4.5, 3, 3);
    g.fillRect(-19, 1.5, 3, 3);

    // 2. Cauda em V / Aletas traseiras esguias de perfil
    g.fillStyle(darkColor, 1);
    g.beginPath();
    g.moveTo(-6, -3);
    g.lineTo(-18, -10);
    g.lineTo(-19, -7);
    g.lineTo(-10, -2);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, trimColor, 1);
    g.strokeLineShape(new Phaser.Geom.Line(-6, -3, -18, -10));

    g.fillStyle(darkColor, 1);
    g.beginPath();
    g.moveTo(-6, 3);
    g.lineTo(-18, 9);
    g.lineTo(-19, 6);
    g.lineTo(-10, 2);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, trimColor, 1);
    g.strokeLineShape(new Phaser.Geom.Line(-6, 3, -18, 9));

    // 3. Fuselagem Agulha Aerodinâmica Ultra-Afilada
    g.fillStyle(bodyColor, 1);
    g.beginPath();
    g.moveTo(26, 0);     // Agulha frontal extremamente longa
    g.lineTo(11, -2);
    g.lineTo(0, -3);
    g.lineTo(-16, -3);
    g.lineTo(-16, 3);
    g.lineTo(0, 3);
    g.lineTo(11, 2);
    g.closePath();
    g.fillPath();

    g.lineStyle(1, trimColor, 0.9);
    g.strokeLineShape(new Phaser.Geom.Line(26, 0, -15, 0));

    // 4. Asa Fina de Alta Velocidade (em perfil lateral)
    g.fillStyle(darkColor, 1);
    g.beginPath();
    g.moveTo(5, 1);
    g.lineTo(-10, 5.5);
    g.lineTo(-17, 5.5);
    g.lineTo(-7, 1);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.2, trimColor, 1);
    g.strokeLineShape(new Phaser.Geom.Line(5, 1, -10, 5.5));

    // 5. Canopy Embutido de Vidro Esmeralda / Menta
    g.fillStyle(0x0d1f1c, 1);
    g.beginPath();
    g.moveTo(8, -1.5);
    g.lineTo(1, -5);
    g.lineTo(-5, -5);
    g.lineTo(-7, -2);
    g.closePath();
    g.fillPath();

    g.fillStyle(p.canopy, 0.95);
    g.beginPath();
    g.moveTo(6.5, -1.8);
    g.lineTo(0.5, -4.2);
    g.lineTo(-4, -4.2);
    g.lineTo(-5.5, -1.8);
    g.closePath();
    g.fillPath();

    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(3, -2.8, 1);

    // 6. Muzzle Flash de Alta Energia
    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.95);
      g.fillCircle(28, 0, 4);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(27, 0, 2);
    }
  }

  /** HARLAN GREER — KNUCKLE: Destróier Blindado e Canhoneiro Pesado (Perfil Lateral) */
  private drawKnuckleProfile(g: Phaser.GameObjects.Graphics, p: Palette, isForward: boolean): void {
    const bodyColor = this.isHit ? 0xffffff : p.hull;
    const darkColor = this.isHit ? 0xff7777 : p.hullDark;
    const trimColor = this.isHit ? 0xff3333 : p.trim;

    // 1. Propulsor Pesado Maciço com Coluna de Fogo Alaranjada / Âmbar
    const flameStretch = isForward ? 1.6 : 1.0;
    const flick = Math.sin(this.flamePhase * 1.2) * 3 + (Math.random() - 0.5) * 3;
    const flameLen = (18 + flick) * flameStretch;

    g.fillStyle(p.engineGlow, 0.8);
    g.beginPath();
    g.moveTo(-18, -6);
    g.lineTo(-18 - flameLen, 0);
    g.lineTo(-18, 6);
    g.closePath();
    g.fillPath();

    g.fillStyle(p.engineCore, 0.95);
    g.beginPath();
    g.moveTo(-18, -3);
    g.lineTo(-18 - flameLen * 0.6, 0);
    g.lineTo(-18, 3);
    g.closePath();
    g.fillPath();

    // Bocal industrial reforçado
    g.fillStyle(0x19120e, 1);
    g.fillRect(-20, -7, 4, 14);
    g.lineStyle(1.2, 0xf59e0b, 0.9);
    g.strokeRect(-20, -7, 4, 14);

    // 2. Blindagem Dorsal Corcunda (perfil de couraçado)
    g.fillStyle(darkColor, 1);
    g.beginPath();
    g.moveTo(-2, -5);
    g.lineTo(-16, -11);
    g.lineTo(-20, -11);
    g.lineTo(-20, -6);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, trimColor, 1);
    g.strokeLineShape(new Phaser.Geom.Line(-2, -5, -16, -11));

    // 3. Fuselagem de Blindagem Angular Pesada
    g.fillStyle(bodyColor, 1);
    g.beginPath();
    g.moveTo(21, -2);      // Proa em cunha de aríete
    g.lineTo(21, 5);
    g.lineTo(10, 6.5);
    g.lineTo(-18, 6.5);
    g.lineTo(-18, -5);
    g.lineTo(8, -5);
    g.closePath();
    g.fillPath();

    // Relevo de placas de blindagem
    g.lineStyle(1.5, trimColor, 0.9);
    g.strokeLineShape(new Phaser.Geom.Line(21, 2, -17, 2));
    g.strokeLineShape(new Phaser.Geom.Line(6, -4, 6, 6));
    g.strokeLineShape(new Phaser.Geom.Line(-7, -4, -7, 6));

    // 4. Canhão Pesado / Railgun Inferior Proeminente
    g.fillStyle(0x130d0a, 1);
    g.fillRect(-4, 7, 28, 3.5);
    g.lineStyle(1, trimColor, 1);
    g.strokeRect(-4, 7, 28, 3.5);
    // Freio de boca da arma pesada
    g.fillStyle(0xfde047, 1);
    g.fillRect(22, 6.5, 3, 4.5);

    // 5. Cabine Blindada com Visor Angular Âmbar Reforçado
    g.fillStyle(0x120c08, 1);
    g.beginPath();
    g.moveTo(8, -3);
    g.lineTo(2, -8.5);
    g.lineTo(-5, -8.5);
    g.lineTo(-8, -4);
    g.closePath();
    g.fillPath();

    g.fillStyle(p.canopy, 0.95);
    g.beginPath();
    g.moveTo(6.5, -3.5);
    g.lineTo(1.5, -7.5);
    g.lineTo(-3.5, -7.5);
    g.lineTo(-5.5, -3.5);
    g.closePath();
    g.fillPath();

    // Slat blindado do visor
    g.lineStyle(1, 0x1a110a, 1);
    g.strokeLineShape(new Phaser.Geom.Line(0, -7.5, 0, -3.5));

    // 6. Muzzle Flash de Canhão Pesado
    if (this.isFiring) {
      g.fillStyle(p.muzzle, 0.95);
      g.fillCircle(27, 8.5, 5.5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(26, 8.5, 3);
    }
  }
}
