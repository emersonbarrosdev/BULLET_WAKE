import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUD_TOP, HUD_BOTTOM } from '../constants';
import { MAX_HP, type PlayerHealth } from '../systems/combat';
import type { SectorId } from '../systems/stageDirector';
import type { WeaponLevel } from '../systems/weaponSystem';

const sectorTitles: Record<SectorId, string> = {
  evacuacao: 'CORREDOR DE EVACUACAO',
  destrocos: 'CAMPO DE DESTROCOS',
  industria: 'ANEL INDUSTRIAL',
  aproximacao: 'APROXIMACAO DA MALHA',
};

/** HUD de combate do BULLET WAKE conforme as especificações de design. */
export class CombatHud {
  private readonly scene: Phaser.Scene;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly pilotText: Phaser.GameObjects.Text;
  private readonly sectorText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly progressBar: Phaser.GameObjects.Rectangle;
  private readonly healthSegments: Phaser.GameObjects.Rectangle[] = [];
  private readonly shieldBadge: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;

  // Painel inferior
  private readonly weaponText: Phaser.GameObjects.Text;
  private readonly resonanceBarFill: Phaser.GameObjects.Rectangle;
  private readonly resonanceText: Phaser.GameObjects.Text;
  private readonly bombText: Phaser.GameObjects.Text;

  // Boss bar
  private readonly bossBarContainer: Phaser.GameObjects.Container;
  private readonly bossNameText: Phaser.GameObjects.Text;
  private readonly bossHpFill: Phaser.GameObjects.Rectangle;
  private readonly bossHpBg: Phaser.GameObjects.Rectangle;

  private statusRemainingMs = 0;
  private pulseTimer = 0;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
    this.scene = scene;

    // Barra superior de status (64px)
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x101a28, 0.96)
      .setDepth(40);
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP - 1, GAME_WIDTH, 2, 0x36526c).setDepth(41);

    // Linha 1 superior: Título, Setor, Modo/Fase
    this.text(17, 8, 'BULLET WAKE', 18, '#f0f6fa');
    this.sectorText = this.text(220, 11, sectorTitles.evacuacao, 13, '#98bcca');
    this.text(GAME_WIDTH - 17, 11, 'FASE 01  /  CINTURAO', 12, '#eab891').setOrigin(1, 0);

    // Linha 2 superior: Piloto, Score, Combo, HP, Vidas, Progresso
    this.pilotText = this.text(19, 36, 'RIVET', 16, '#92e9de');

    this.text(140, 39, 'SCORE', 11, '#8ea6b8');
    this.scoreText = this.text(188, 33, '000000', 18, '#ffffff');

    this.comboText = this.text(285, 36, '', 14, '#ffdd88');

    this.text(388, 39, 'HP', 11, '#8ea6b8');
    for (let i = 0; i < MAX_HP; i++) {
      const segment = scene.add.rectangle(416 + i * 18, 44, 14, 12, 0x6cdbd3)
        .setStrokeStyle(1, 0xa6f3e4)
        .setDepth(42);
      this.healthSegments.push(segment);
    }

    this.shieldBadge = this.text(478, 38, '[ESCUDO]', 11, '#7df9ff').setVisible(false);

    this.text(548, 39, 'VIDAS', 11, '#8ea6b8');
    this.livesText = this.text(592, 33, '03', 18, '#ffffff');

    this.progressText = this.text(GAME_WIDTH - 18, 35, '00%', 15, '#9bcfe3').setOrigin(1, 0);

    // Barra de progresso da fase sob o HUD superior
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP + 1, GAME_WIDTH - 28, 3, 0x1d2938).setDepth(41);
    this.progressBar = scene.add.rectangle(14, HUD_TOP + 1, 1, 3, 0x79e5d8)
      .setOrigin(0, 0.5).setDepth(42);

    this.statusText = this.text(GAME_WIDTH / 2, HUD_TOP + 8, '', 15, '#f8bb82')
      .setOrigin(0.5, 0);

    // Barra inferior de combate (40px)
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - HUD_BOTTOM / 2, GAME_WIDTH, HUD_BOTTOM, 0x101a28, 0.96)
      .setDepth(40);
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - HUD_BOTTOM, GAME_WIDTH, 2, 0x36526c)
      .setDepth(41);

    // Inferior esquerdo: Arma e Nível
    this.weaponText = this.text(17, GAME_HEIGHT - 27, 'PULSO LV.1', 14, '#7de0db');

    // Inferior centro: Medidor de Ressonância (Especial)
    const resX = GAME_WIDTH / 2 - 30;
    this.text(resX - 95, GAME_HEIGHT - 26, 'RESSONANCIA', 11, '#b09ed4').setOrigin(0.5, 0);
    scene.add.rectangle(resX + 35, GAME_HEIGHT - 20, 160, 12, 0x1f1b34)
      .setStrokeStyle(1, 0x584482).setDepth(41);
    this.resonanceBarFill = scene.add.rectangle(resX + 35 - 79, GAME_HEIGHT - 20, 1, 10, 0xa378f5)
      .setOrigin(0, 0.5).setDepth(42);
    this.resonanceText = this.text(resX + 35, GAME_HEIGHT - 27, '0%', 10, '#ffffff')
      .setOrigin(0.5, 0);

    // Inferior direito: Bombas e Reiniciar
    this.bombText = this.text(GAME_WIDTH - 235, GAME_HEIGHT - 27, 'BOMBAS x2 [B/L]', 13, '#f59e8b');

    const restartButton = scene.add.rectangle(
      GAME_WIDTH - 65, GAME_HEIGHT - HUD_BOTTOM / 2, 105, 26, 0x244254,
    ).setStrokeStyle(1, 0x5dbbb5).setInteractive({ useHandCursor: true }).setDepth(41);
    this.text(GAME_WIDTH - 65, GAME_HEIGHT - 27, 'REINICIAR [R]', 11, '#ffffff').setOrigin(0.5, 0);
    restartButton.on('pointerover', () => restartButton.setFillStyle(0x32627a));
    restartButton.on('pointerout', () => restartButton.setFillStyle(0x244254));
    restartButton.on('pointerdown', onRestart);

    // Barra de Chefe (oculta por padrão)
    const bossWidth = 420;
    this.bossNameText = scene.add.text(0, -12, '', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffb2a3',
    }).setOrigin(0.5, 1);
    this.bossHpBg = scene.add.rectangle(0, 0, bossWidth, 10, 0x221318)
      .setStrokeStyle(1, 0x7a3138);
    this.bossHpFill = scene.add.rectangle(-bossWidth / 2, 0, bossWidth, 8, 0xf04848)
      .setOrigin(0, 0.5);

    this.bossBarContainer = scene.add.container(GAME_WIDTH / 2, HUD_TOP + 28, [
      this.bossNameText,
      this.bossHpBg,
      this.bossHpFill,
    ]).setDepth(45).setVisible(false);
  }

  setPilot(shipName: string): void {
    this.pilotText.setText(shipName.toUpperCase());
  }

  setScore(score: number, comboCount = 0, multiplier = 1.0): void {
    this.scoreText.setText(String(Math.max(0, Math.floor(score))).padStart(6, '0'));
    if (comboCount > 1) {
      this.comboText.setText(`COMBO x${comboCount} (${multiplier.toFixed(1)}x)`).setVisible(true);
    } else {
      this.comboText.setVisible(false);
    }
  }

  setHealth(state: PlayerHealth, hasShield = false): void {
    this.healthSegments.forEach((segment, index) => {
      const active = index < state.hp;
      segment.setFillStyle(active ? 0x6cdbd3 : 0x293947);
      segment.setStrokeStyle(1, active ? 0xb9fff0 : 0x465d6c);
    });
    this.livesText.setText(String(state.lives).padStart(2, '0'));
    this.shieldBadge.setVisible(hasShield);
  }

  setWeapon(weaponName: string, level: WeaponLevel): void {
    this.weaponText.setText(`${weaponName.toUpperCase()} LV.${level}`);
    if (level === 3) {
      this.weaponText.setColor('#ffe085');
    } else if (level === 2) {
      this.weaponText.setColor('#9ff0ff');
    } else {
      this.weaponText.setColor('#7de0db');
    }
  }

  setResonance(percent: number, specialActive = false): void {
    const clamped = Math.max(0, Math.min(100, percent));
    const width = Math.max(1, (158 * clamped) / 100);
    this.resonanceBarFill.setSize(width, 10);

    if (specialActive) {
      this.resonanceBarFill.setFillStyle(0x56e8ff);
      this.resonanceText.setText('ESPECIAL ATIVO!');
      this.resonanceText.setColor('#ffffff');
    } else if (clamped >= 100) {
      this.resonanceBarFill.setFillStyle(0xd468ff);
      this.resonanceText.setText('ESPECIAL PRONTO [K/SHIFT]');
      this.resonanceText.setColor('#fff4a8');
    } else {
      this.resonanceBarFill.setFillStyle(0xa378f5);
      this.resonanceText.setText(`${Math.floor(clamped)}%`);
      this.resonanceText.setColor('#ffffff');
    }
  }

  setBombs(bombs: number): void {
    this.bombText.setText(`BOMBAS x${Math.max(0, bombs)} [B/L]`);
  }

  setProgress(value: number): void {
    const progress = Math.max(0, Math.min(1, value));
    this.progressText.setText(String(Math.floor(progress * 100)).padStart(2, '0') + '%');
    this.progressBar.setSize((GAME_WIDTH - 28) * progress, 3);
  }

  setSector(sector: SectorId): void {
    this.sectorText.setText(sectorTitles[sector]);
    this.flash(sectorTitles[sector], '#b5deed', 1300);
  }

  showBossBar(bossName: string, hp: number, maxHp: number): void {
    this.bossBarContainer.setVisible(true);
    this.bossNameText.setText(bossName.toUpperCase());
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 1)));
    this.bossHpFill.setSize(420 * ratio, 8);
  }

  hideBossBar(): void {
    this.bossBarContainer.setVisible(false);
  }

  flash(message: string, color = '#f8bb82', durationMs = 1000): void {
    this.statusText.setColor(color).setText(message).setVisible(true);
    this.statusRemainingMs = durationMs;
  }

  update(deltaMs: number): void {
    this.statusRemainingMs = Math.max(0, this.statusRemainingMs - deltaMs);
    if (this.statusRemainingMs === 0) this.statusText.setVisible(false);

    this.pulseTimer += deltaMs;
    // Animação de pulso na ressonância quando cheia
    if (this.shieldBadge.visible) {
      const alpha = 0.6 + Math.sin(this.pulseTimer / 180) * 0.4;
      this.shieldBadge.setAlpha(alpha);
    }
  }

  private text(
    x: number, y: number, value: string, size: number, color: string,
  ): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: size + 'px',
      fontStyle: 'bold',
      color,
    }).setResolution(2).setDepth(42);
  }
}
