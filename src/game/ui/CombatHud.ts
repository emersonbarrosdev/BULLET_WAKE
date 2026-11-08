import Phaser from 'phaser';
import {
  GAME_WIDTH,
  PLAYFIELD_X,
  PLAYFIELD_RIGHT,
  FONT_TITLE,
  FONT_HUD,
} from '../constants';
import { MAX_HP, type PlayerHealth } from '../systems/combat';
import type { SectorId } from '../systems/stageDirector';
import type { WeaponLevel, WeaponFamily } from '../systems/weaponSystem';
import { formatDashIndicator } from '../systems/dashSystem';

const sectorTitles: Record<SectorId, string> = {
  evacuacao: 'ÁGUAS COSTEIRAS',
  destrocos: 'RECIFE DOS CASULOS',
  industria: 'FOSSA ABISSAL',
  aproximacao: 'DOMÍNIO DE TALASSARCA',
};

/**
 * BULLET WAKE V2 — HUD Oficial Neo-Arcade Widescreen com Bezel TATE.
 * 
 * Separação Total entre Informação e Combate:
 * - Painel Esquerdo (X: 0 a 192): Telemetria de Piloto, Blindagem/HP, Vidas, Score e Dash (◆ ◆ ◆).
 * - Campo Central (X: 192 a 576): Corredor Vertical 100% Desobstruído de combate.
 * - Painel Direito (X: 576 a 768): Armamento LV1-4, Bombas, Especial, Radar e Barra de Chefe.
 * 
 * Tipografia estrita a 2 famílias: Oxanium (títulos) e Rajdhani (interface/dados).
 */
export class CombatHud {
  private readonly scene: Phaser.Scene;

  // --- PAINEL ESQUERDO (Telemetria do Piloto) ---
  private readonly pilotPortrait: Phaser.GameObjects.Sprite;
  private readonly pilotNameText: Phaser.GameObjects.Text;
  private readonly shipModelText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly healthSegments: Phaser.GameObjects.Rectangle[] = [];
  private readonly shieldBadge: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly dashText: Phaser.GameObjects.Text;

  // --- CORREDOR CENTRAL (Notificações Flutuantes Não-Intrusivas) ---
  private readonly statusToast: Phaser.GameObjects.Text;

  // --- PAINEL DIREITO (Telemetria de Armamento & Missão) ---
  private readonly weaponTitleText: Phaser.GameObjects.Text;
  private readonly weaponLevelText: Phaser.GameObjects.Text;
  private readonly weaponPips: Phaser.GameObjects.Text;
  private readonly heatBarFill: Phaser.GameObjects.Rectangle;
  private readonly heatText: Phaser.GameObjects.Text;
  private readonly bombText: Phaser.GameObjects.Text;
  private readonly missileText: Phaser.GameObjects.Text;
  private readonly specialBarFill: Phaser.GameObjects.Rectangle;
  private readonly specialText: Phaser.GameObjects.Text;
  private readonly sectorText: Phaser.GameObjects.Text;
  private readonly fpsText: Phaser.GameObjects.Text;

  // --- TELEMETRIA DE CHEFE (No topo do Painel Direito) ---
  private readonly bossBarContainer: Phaser.GameObjects.Container;
  private readonly bossNameText: Phaser.GameObjects.Text;
  private readonly bossHpFill: Phaser.GameObjects.Rectangle;

  private statusRemainingMs = 0;
  private fpsUpdateTimer = 0;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
    this.scene = scene;

    // ==========================================
    // 1. PAINEL LATERAL ESQUERDO (X: 0 a 192)
    // ==========================================
    const leftX = 14;

    // Retrato do Piloto (64x64 com moldura cibernética)
    scene.add.rectangle(leftX + 32, 48, 68, 68, 0x071524)
      .setStrokeStyle(1.5, 0x00f0ff, 0.7).setDepth(41);
    this.pilotPortrait = scene.add.sprite(leftX + 32, 48, 'portrait-nolan', 0)
      .setDisplaySize(64, 64).setDepth(42);

    // Identificação do Piloto e Nave
    this.pilotNameText = scene.add.text(leftX, 88, 'NOLAN FITCH', {
      fontFamily: FONT_TITLE,
      fontSize: '12px',
      color: '#f8fafc',
      letterSpacing: 1,
    }).setDepth(42).setResolution(2);

    this.shipModelText = scene.add.text(leftX, 103, 'CAÇA // RIVET V3', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#38bdf8',
      letterSpacing: 0.5,
    }).setDepth(42).setResolution(2);

    // Score e Multiplicador de Combo
    scene.add.text(leftX, 126, 'PONTUAÇÃO', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#64748b',
    }).setDepth(42).setResolution(2);

    this.scoreText = scene.add.text(leftX, 138, '000000', {
      fontFamily: FONT_TITLE,
      fontSize: '16px',
      color: '#ffffff',
      letterSpacing: 1,
    }).setDepth(42).setResolution(2);

    this.comboText = scene.add.text(leftX + 110, 142, '', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#ffd166',
    }).setDepth(42).setResolution(2);

    // Blindagem (HP) e Escudo
    scene.add.text(leftX, 166, 'BLINDAGEM', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#64748b',
    }).setDepth(42).setResolution(2);

    for (let i = 0; i < MAX_HP; i++) {
      const seg = scene.add.rectangle(leftX + 6 + i * 20, 185, 16, 8, 0x10b981)
        .setStrokeStyle(1, 0x34d399).setDepth(42);
      this.healthSegments.push(seg);
    }

    this.shieldBadge = scene.add.text(leftX + 70, 165, '[ESCUDO]', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#00f0ff',
    }).setDepth(42).setResolution(2).setVisible(false);

    // Vidas
    this.livesText = scene.add.text(leftX, 202, 'VIDAS: 3', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#f8fafc',
    }).setDepth(42).setResolution(2);

    // ==========================================
    // NOVO DASH — EXATAMENTE 3 CARGAS POR FASE
    // ==========================================
    scene.add.text(leftX, 230, 'PROPULSÃO DE EMERGÊNCIA', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#64748b',
    }).setDepth(42).setResolution(2);

    this.dashText = scene.add.text(leftX, 244, 'DASH: ◆ ◆ ◆', {
      fontFamily: FONT_TITLE,
      fontSize: '13px',
      color: '#00f0ff',
      letterSpacing: 2,
    }).setDepth(42).setResolution(2);

    // Informação de comando de Dash
    scene.add.text(leftX, 264, '[SHIFT ESQUERDO]', {
      fontFamily: FONT_HUD,
      fontSize: '9px',
      color: '#475569',
    }).setDepth(42).setResolution(2);

    // Botão de Reinício da Fase [R]
    const resetBtn = scene.add.rectangle(leftX + 80, 395, 140, 22, 0x0a1622)
      .setStrokeStyle(1, 0x1e3a5f).setInteractive({ useHandCursor: true }).setDepth(42);
    scene.add.text(leftX + 80, 395, 'REINICIAR FASE [R]', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#94a3b8',
    }).setOrigin(0.5).setDepth(43).setResolution(2);

    resetBtn.on('pointerover', () => resetBtn.setFillStyle(0x13283e));
    resetBtn.on('pointerout', () => resetBtn.setFillStyle(0x0a1622));
    resetBtn.on('pointerdown', onRestart);

    // ==========================================
    // 2. CORREDOR CENTRAL (Campo de Combate)
    // ==========================================
    // Toast rápido no topo do campo (Y=30), discreto e não-intrusivo
    const centerX = PLAYFIELD_X + (PLAYFIELD_RIGHT - PLAYFIELD_X) / 2;
    this.statusToast = scene.add.text(centerX, 25, '', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffd166',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(45).setResolution(2).setAlpha(0.95);

    // ==========================================
    // 3. PAINEL LATERAL DIREITO (X: 576 a 768)
    // ==========================================
    const rightX = PLAYFIELD_RIGHT + 14;

    // Telemetria do Chefe (quando ativo)
    const bossWidth = 150;
    this.bossNameText = scene.add.text(rightX, 24, 'ALVO: TALASSARCA', {
      fontFamily: FONT_TITLE,
      fontSize: '10px',
      color: '#f87171',
      letterSpacing: 1,
    }).setDepth(42).setResolution(2);

    const bossHpBg = scene.add.rectangle(rightX + bossWidth / 2, 42, bossWidth, 8, 0x190d10)
      .setStrokeStyle(1, 0x7f1d1d);
    this.bossHpFill = scene.add.rectangle(rightX, 42, bossWidth, 6, 0xef4444)
      .setOrigin(0, 0.5);

    this.bossBarContainer = scene.add.container(0, 0, [
      this.bossNameText,
      bossHpBg,
      this.bossHpFill,
    ]).setDepth(45).setVisible(false);

    // Setor e Fase
    this.sectorText = scene.add.text(rightX, 64, 'FASE 01 // [FENDA PELÁGICA]', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#38bdf8',
    }).setDepth(42).setResolution(2);

    // Armamento Ativo (Estilo Fire Shark)
    scene.add.text(rightX, 94, 'SISTEMA DE ARMAS', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#64748b',
    }).setDepth(42).setResolution(2);

    this.weaponTitleText = scene.add.text(rightX, 107, 'PULSO VERDE', {
      fontFamily: FONT_TITLE,
      fontSize: '13px',
      color: '#22c55e',
      letterSpacing: 1,
    }).setDepth(42).setResolution(2);

    this.weaponLevelText = scene.add.text(rightX, 126, 'NÍVEL 1', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#94a3b8',
    }).setDepth(42).setResolution(2);

    this.weaponPips = scene.add.text(rightX + 54, 127, '● ○ ○ ○', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#22c55e',
    }).setDepth(42).setResolution(2);

    // Medidor Térmico (Calor)
    scene.add.text(rightX, 150, 'CALOR DO ARMA', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#64748b',
    }).setDepth(42).setResolution(2);

    scene.add.rectangle(rightX + 45, 168, 90, 7, 0x111d28)
      .setStrokeStyle(1, 0x1f3c4d).setDepth(41);
    this.heatBarFill = scene.add.rectangle(rightX, 168, 1, 5, 0x38bdf8)
      .setOrigin(0, 0.5).setDepth(42);
    this.heatText = scene.add.text(rightX + 100, 161, '0%', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#94a3b8',
    }).setDepth(42).setResolution(2);

    // Bombas
    this.bombText = scene.add.text(rightX, 192, 'BOMBAS [X]: 💣 02', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ff6b6b',
    }).setDepth(42).setResolution(2);

    // Mísseis
    this.missileText = scene.add.text(rightX, 214, 'MÍSSEIS [M]: PRONTO', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#ffd166',
    }).setDepth(42).setResolution(2);

    // Especial de Ressonância
    scene.add.text(rightX, 240, 'ESPECIAL [V]', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#c084fc',
    }).setDepth(42).setResolution(2);

    scene.add.rectangle(rightX + 50, 258, 100, 7, 0x190d26)
      .setStrokeStyle(1, 0x4a1d6d).setDepth(41);
    this.specialBarFill = scene.add.rectangle(rightX, 258, 1, 5, 0xa855f7)
      .setOrigin(0, 0.5).setDepth(42);
    this.specialText = scene.add.text(rightX + 108, 251, '0%', {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#ffffff',
    }).setDepth(42).setResolution(2);

    // FPS (Medição Real via game.loop.actualFps)
    this.fpsText = scene.add.text(GAME_WIDTH - 14, 398, '-- FPS', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#38bdf8',
    }).setOrigin(1, 0).setDepth(42).setResolution(2);
  }

  setPilot(pilotId: string, shipName: string): void {
    const portraitKey = `portrait-${pilotId}`;
    if (this.scene.textures.exists(portraitKey)) {
      this.pilotPortrait.setTexture(portraitKey);
    }
    const nameUpper = pilotId === 'cora' ? 'CORA WREN' : pilotId === 'harlan' ? 'HARLAN GREER' : 'NOLAN FITCH';
    this.pilotNameText.setText(nameUpper);
    this.shipModelText.setText(`CAÇA // ${shipName.toUpperCase()}`);
  }

  setScore(score: number, comboCount = 0, multiplier = 1.0): void {
    this.scoreText.setText(String(Math.max(0, Math.floor(score))).padStart(6, '0'));
    if (comboCount > 1) {
      this.comboText.setText(`[x${multiplier.toFixed(1)}]`).setVisible(true);
    } else {
      this.comboText.setVisible(false);
    }
  }

  setHealth(state: PlayerHealth, hasShield = false): void {
    this.healthSegments.forEach((seg, index) => {
      const active = index < state.hp;
      seg.setFillStyle(active ? 0x10b981 : 0x1f2937);
      seg.setStrokeStyle(1, active ? 0x34d399 : 0x374151);
    });
    this.livesText.setText(`VIDAS: ${state.lives}`);
    this.shieldBadge.setVisible(hasShield);
  }

  setDash(remaining: number, max = 3): void {
    const formatted = formatDashIndicator(remaining, max);
    this.dashText.setText(`DASH: ${formatted}`);
    if (remaining === 0) {
      this.dashText.setColor('#64748b');
    } else if (remaining === 1) {
      this.dashText.setColor('#f97316');
    } else {
      this.dashText.setColor('#00f0ff');
    }
  }

  setWeapon(family: WeaponFamily, level: WeaponLevel): void {
    const title = family === 'green' ? 'PULSO VERDE' : family === 'ion' ? 'LASER DE ÍONS' : 'PLASMA VERMELHO';
    const color = family === 'green' ? '#22c55e' : family === 'ion' ? '#38bdf8' : '#f97316';

    this.weaponTitleText.setText(title).setColor(color);
    this.weaponLevelText.setText(`NÍVEL ${level}`);

    const pipsStr = level === 4 ? '● ● ● ●' : level === 3 ? '● ● ● ○' : level === 2 ? '● ● ○ ○' : '● ○ ○ ○';
    this.weaponPips.setText(pipsStr).setColor(color);
  }

  setHeat(heat: number, isOverheated: boolean): void {
    const clamped = Math.max(0, Math.min(100, heat));
    const width = Math.max(1, (88 * clamped) / 100);
    this.heatBarFill.setSize(width, 5);

    if (isOverheated) {
      this.heatBarFill.setFillStyle(0xef4444);
      this.heatText.setText('VENT!').setColor('#ef4444');
    } else if (clamped >= 75) {
      this.heatBarFill.setFillStyle(0xf97316);
      this.heatText.setText(`${Math.floor(clamped)}%`).setColor('#f97316');
    } else {
      this.heatBarFill.setFillStyle(0x38bdf8);
      this.heatText.setText(`${Math.floor(clamped)}%`).setColor('#94a3b8');
    }
  }

  setBombs(bombs: number): void {
    this.bombText.setText(`BOMBAS [X]: 💣 ${String(Math.max(0, bombs)).padStart(2, '0')}`);
  }

  setMissileReady(ready: boolean): void {
    this.missileText.setText(ready ? 'MÍSSEIS [M]: PRONTO' : 'MÍSSEIS [M]: RECARREGANDO');
    this.missileText.setColor(ready ? '#ffd166' : '#64748b');
  }

  setProgress(_ratio: number): void {
    // Telemetria de progresso reservada
  }

  setCharge(_chargeMs: number, _maxMs: number, isCharging: boolean): void {
    if (isCharging) {
      this.statusToast.setText('CARREGANDO WAVE CANNON... [C]').setColor('#00f0ff').setVisible(true).setAlpha(0.9);
      this.statusRemainingMs = 250;
    }
  }

  setResonance(percent: number, specialActive = false): void {
    const clamped = Math.max(0, Math.min(100, percent));
    const width = Math.max(1, (98 * clamped) / 100);
    this.specialBarFill.setSize(width, 5);

    if (specialActive) {
      this.specialBarFill.setFillStyle(0x00f0ff);
      this.specialText.setText('ATIVO!').setColor('#00f0ff');
    } else if (clamped >= 100) {
      this.specialBarFill.setFillStyle(0xd946ef);
      this.specialText.setText('PRONTO [V]').setColor('#fef08a');
    } else {
      this.specialBarFill.setFillStyle(0xa855f7);
      this.specialText.setText(`${Math.floor(clamped)}%`).setColor('#ffffff');
    }
  }

  setSector(sector: SectorId): void {
    const title = sectorTitles[sector] || sector.toUpperCase();
    this.sectorText.setText(`FASE 01 // [${title}]`);
    this.flash(`SETOR: ${title}`, '#38bdf8', 650);
  }

  showBossBar(bossName: string, hp: number, maxHp: number): void {
    this.bossBarContainer.setVisible(true);
    this.bossNameText.setText(`ALVO: ${bossName.toUpperCase()}`);
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 1)));
    this.bossHpFill.setSize(150 * ratio, 6);
  }

  hideBossBar(): void {
    this.bossBarContainer.setVisible(false);
  }

  flash(message: string, color = '#ffd166', durationMs = 700): void {
    this.statusToast.setColor(color).setText(message).setVisible(true).setAlpha(0.95);
    this.statusRemainingMs = durationMs;
  }

  update(deltaMs: number): void {
    if (this.statusRemainingMs > 0) {
      this.statusRemainingMs = Math.max(0, this.statusRemainingMs - deltaMs);
      if (this.statusRemainingMs <= 180) {
        this.statusToast.setAlpha(this.statusRemainingMs / 180);
      }
      if (this.statusRemainingMs === 0) this.statusToast.setVisible(false);
    }

    this.fpsUpdateTimer += deltaMs;
    if (this.fpsUpdateTimer >= 200) {
      this.fpsUpdateTimer = 0;
      const actualFps = Math.round(this.scene.game.loop.actualFps);
      this.fpsText.setText(`${actualFps} FPS`);
      if (actualFps >= 55) {
        this.fpsText.setColor('#38bdf8');
      } else {
        this.fpsText.setColor('#f87171');
      }
    }
  }
}
