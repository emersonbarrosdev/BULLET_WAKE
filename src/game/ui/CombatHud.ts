import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUD_TOP, HUD_BOTTOM, FONT_TITLE, FONT_HUD } from '../constants';
import { MAX_HP, type PlayerHealth } from '../systems/combat';
import type { SectorId } from '../systems/stageDirector';
import type { WeaponLevel } from '../systems/weaponSystem';

const sectorTitles: Record<SectorId, string> = {
  evacuacao: 'EVACUAÇÃO',
  destrocos: 'DESTROÇOS',
  industria: 'ANEL INDUSTRIAL',
  aproximacao: 'KRM-17 RADAR',
};

/**
 * HUD oficial do BULLET WAKE baseado na Arquitetura de 3 Zonas (docs/24_DIRETRIZ_UI_HUD_MENUS.md):
 * - ZONA A (Topo - 28px): Score, Multiplicador, Fase/Boss HP, Vidas, HP e FPS.
 * - ZONA B (Centro): Campo de jogo 100% limpo e desobstruído.
 * - ZONA C (Base - 28px): Arma/Nível, Barra de Ressonância, Bombas e Mísseis.
 * Tipografia restrita a no máximo 2 famílias: Orbitron (Títulos) e Chakra Petch (Interface).
 */
export class CombatHud {
  private readonly scene: Phaser.Scene;

  // ZONA A: Topo
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly sectorText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly healthSegments: Phaser.GameObjects.Rectangle[] = [];
  private readonly shieldBadge: Phaser.GameObjects.Text;
  private readonly fpsText: Phaser.GameObjects.Text;
  private readonly progressBar: Phaser.GameObjects.Rectangle;

  // ZONA A (Boss Integrado ao Topo - sem poluir o centro de gameplay)
  private readonly bossBarContainer: Phaser.GameObjects.Container;
  private readonly bossNameText: Phaser.GameObjects.Text;
  private readonly bossHpFill: Phaser.GameObjects.Rectangle;
  private readonly bossHpBg: Phaser.GameObjects.Rectangle;

  // ZONA B: Alerta Curto e Não-Intrusivo (logo abaixo do HUD superior)
  private readonly statusToast: Phaser.GameObjects.Text;

  // ZONA C: Base
  private readonly weaponText: Phaser.GameObjects.Text;
  private readonly weaponPips: Phaser.GameObjects.Text;
  private readonly resonanceBarFill: Phaser.GameObjects.Rectangle;
  private readonly resonanceText: Phaser.GameObjects.Text;
  private readonly bombText: Phaser.GameObjects.Text;

  private statusRemainingMs = 0;
  private pulseTimer = 0;
  private fpsUpdateTimer = 0;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
    this.scene = scene;

    // ==========================================
    // 1. ZONA A — TOPO (HUD SUPERIOR, 28px)
    // ==========================================
    // Fundo da moldura superior com linha laser inferior
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x050e18, 0.94)
      .setDepth(40);
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP - 1, GAME_WIDTH, 1.5, 0x1f3c4d)
      .setDepth(41);

    // Linha de progresso ultra-fina da fase na base do topo
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP, GAME_WIDTH, 1, 0x102130).setDepth(41);
    this.progressBar = scene.add.rectangle(0, HUD_TOP, 1, 1.5, 0x00f0ff)
      .setOrigin(0, 0.5).setDepth(42);

    // Topo Esquerdo: Score e Combo Multiplier
    this.hudText(12, 6, 'SCORE', 11, '#64748b');
    this.scoreText = this.titleText(56, 5, '000000', 14, '#f8fafc');
    this.comboText = this.hudText(135, 6, '', 11, '#ffd166');

    // Topo Centro: Identificação de Fase / Setor (visível quando chefe NÃO está ativo)
    this.sectorText = this.hudText(
      GAME_WIDTH / 2,
      6,
      `FASE 01 // [${sectorTitles.evacuacao}]`,
      11,
      '#94a3b8',
    ).setOrigin(0.5, 0);

    // Topo Centro: Barra de Boss integrada diretamente no topo da tela (sem poluir o centro de mira)
    const bossWidth = 260;
    this.bossNameText = scene.add.text(0, -2, '', {
      fontFamily: FONT_TITLE,
      fontSize: '10px',
      color: '#f87171',
      letterSpacing: 1,
    }).setOrigin(0.5, 1).setResolution(2);

    this.bossHpBg = scene.add.rectangle(0, 6, bossWidth, 7, 0x1f0b0f)
      .setStrokeStyle(1, 0x7f1d1d);
    this.bossHpFill = scene.add.rectangle(-bossWidth / 2, 6, bossWidth, 5, 0xef4444)
      .setOrigin(0, 0.5);

    this.bossBarContainer = scene.add.container(GAME_WIDTH / 2, 7, [
      this.bossNameText,
      this.bossHpBg,
      this.bossHpFill,
    ]).setDepth(45).setVisible(false);

    // Topo Direito: HP da Blindagem, Escudo, Vidas e FPS
    this.hudText(GAME_WIDTH - 240, 6, 'HP', 11, '#64748b');
    for (let i = 0; i < MAX_HP; i++) {
      const seg = scene.add.rectangle(GAME_WIDTH - 215 + i * 14, 14, 10, 9, 0x10b981)
        .setStrokeStyle(1, 0x34d399)
        .setDepth(42);
      this.healthSegments.push(seg);
    }
    this.shieldBadge = this.hudText(GAME_WIDTH - 170, 6, '[SHIELD]', 10, '#00f0ff')
      .setVisible(false);

    this.livesText = this.hudText(GAME_WIDTH - 110, 6, 'VIDAS: 3', 11, '#f8fafc');

    this.fpsText = this.hudText(GAME_WIDTH - 12, 6, '60 FPS', 10, '#38bdf8')
      .setOrigin(1, 0);

    // ==========================================
    // 2. ZONA B — ÁREA DE JOGO (100% LIMPA)
    // ==========================================
    // Toast rápido no topo do campo (Y=36), discreto e de duração curta (<700ms)
    this.statusToast = scene.add.text(GAME_WIDTH / 2, HUD_TOP + 8, '', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffd166',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(45).setResolution(2).setAlpha(0.9);

    // ==========================================
    // 3. ZONA C — BASE (HUD INFERIOR, 28px)
    // ==========================================
    const botY = GAME_HEIGHT - HUD_BOTTOM;
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - HUD_BOTTOM / 2, GAME_WIDTH, HUD_BOTTOM, 0x050e18, 0.94)
      .setDepth(40);
    scene.add.rectangle(GAME_WIDTH / 2, botY, GAME_WIDTH, 1.5, 0x1f3c4d)
      .setDepth(41);

    // Base Esquerda: Arma e Nível
    this.weaponText = this.hudText(12, botY + 6, 'PULSO', 12, '#38bdf8');
    this.weaponPips = this.hudText(90, botY + 7, '● ○ ○', 11, '#38bdf8');

    // Base Centro: Medidor de Ressonância
    const resX = GAME_WIDTH / 2;
    this.hudText(resX - 85, botY + 6, 'RESSONÂNCIA', 11, '#c084fc').setOrigin(1, 0);
    scene.add.rectangle(resX + 5, botY + 14, 120, 8, 0x190d26)
      .setStrokeStyle(1, 0x4a1d6d).setDepth(41);
    this.resonanceBarFill = scene.add.rectangle(resX + 5 - 59, botY + 14, 1, 6, 0xa855f7)
      .setOrigin(0, 0.5).setDepth(42);
    this.resonanceText = this.hudText(resX + 72, botY + 6, '0%', 11, '#ffffff');

    // Base Direita: Bombas, Mísseis e Reset
    this.bombText = this.hudText(GAME_WIDTH - 210, botY + 6, 'BOMBAS: 💣 02', 11, '#ff6b6b');

    const resetBtn = scene.add.rectangle(
      GAME_WIDTH - 50, botY + HUD_BOTTOM / 2, 76, 18, 0x132338, 0.9,
    ).setStrokeStyle(1, 0x38bdf8).setInteractive({ useHandCursor: true }).setDepth(42);
    this.hudText(GAME_WIDTH - 50, botY + 6, 'RESET [R]', 10, '#94a3b8').setOrigin(0.5, 0);

    resetBtn.on('pointerover', () => resetBtn.setFillStyle(0x1e3a5f));
    resetBtn.on('pointerout', () => resetBtn.setFillStyle(0x132338));
    resetBtn.on('pointerdown', onRestart);
  }

  setPilot(_shipName: string): void {
    // Opcional para telemetria de nave
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

  setWeapon(weaponName: string, level: WeaponLevel): void {
    this.weaponText.setText(weaponName.toUpperCase());
    const pips = level === 3 ? '● ● ●' : level === 2 ? '● ● ○' : '● ○ ○';
    this.weaponPips.setText(pips);

    if (level === 3) {
      this.weaponText.setColor('#ffd166');
      this.weaponPips.setColor('#ffd166');
    } else if (level === 2) {
      this.weaponText.setColor('#38bdf8');
      this.weaponPips.setColor('#38bdf8');
    } else {
      this.weaponText.setColor('#94a3b8');
      this.weaponPips.setColor('#94a3b8');
    }
  }

  setResonance(percent: number, specialActive = false): void {
    const clamped = Math.max(0, Math.min(100, percent));
    const width = Math.max(1, (118 * clamped) / 100);
    this.resonanceBarFill.setSize(width, 6);

    if (specialActive) {
      this.resonanceBarFill.setFillStyle(0x00f0ff);
      this.resonanceText.setText('ATIVO!');
      this.resonanceText.setColor('#00f0ff');
    } else if (clamped >= 100) {
      this.resonanceBarFill.setFillStyle(0xd946ef);
      this.resonanceText.setText('PRONTO [X]');
      this.resonanceText.setColor('#fef08a');
    } else {
      this.resonanceBarFill.setFillStyle(0xa855f7);
      this.resonanceText.setText(`${Math.floor(clamped)}%`);
      this.resonanceText.setColor('#ffffff');
    }
  }

  setBombs(bombs: number): void {
    const count = Math.max(0, bombs);
    this.bombText.setText(`BOMBAS: 💣 ${String(count).padStart(2, '0')}`);
  }

  setProgress(value: number): void {
    const progress = Math.max(0, Math.min(1, value));
    this.progressBar.setSize(GAME_WIDTH * progress, 1.5);
  }

  setSector(sector: SectorId): void {
    const title = sectorTitles[sector] || sector.toUpperCase();
    this.sectorText.setText(`FASE 01 // [${title}]`);
    this.flash(`SETOR: ${title}`, '#38bdf8', 650);
  }

  showBossBar(bossName: string, hp: number, maxHp: number): void {
    this.sectorText.setVisible(false);
    this.bossBarContainer.setVisible(true);
    this.bossNameText.setText(`ALVO: ${bossName.toUpperCase()}`);
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 1)));
    this.bossHpFill.setSize(260 * ratio, 5);
  }

  hideBossBar(): void {
    this.bossBarContainer.setVisible(false);
    this.sectorText.setVisible(true);
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

    this.pulseTimer += deltaMs;
    this.fpsUpdateTimer += deltaMs;

    if (this.fpsUpdateTimer >= 200) {
      this.fpsUpdateTimer = 0;
      const actualFps = Math.round(this.scene.game.loop.actualFps || 60);
      this.fpsText.setText(`${actualFps} FPS`);
      if (actualFps >= 100) {
        this.fpsText.setColor('#4ade80');
      } else if (actualFps >= 55) {
        this.fpsText.setColor('#38bdf8');
      } else {
        this.fpsText.setColor('#f87171');
      }
    }

    if (this.shieldBadge.visible) {
      const alpha = 0.6 + Math.sin(this.pulseTimer / 180) * 0.4;
      this.shieldBadge.setAlpha(alpha);
    }
  }

  private titleText(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, {
      fontFamily: FONT_TITLE,
      fontSize: size + 'px',
      color,
    }).setResolution(2).setDepth(42);
  }

  private hudText(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, {
      fontFamily: FONT_HUD,
      fontSize: size + 'px',
      color,
    }).setResolution(2).setDepth(42);
  }
}
