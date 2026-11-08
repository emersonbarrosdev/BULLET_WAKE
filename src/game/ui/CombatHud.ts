import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUD_TOP, HUD_BOTTOM, FONT_TITLE, FONT_HUD, FONT_TECH } from '../constants';
import { MAX_HP, type PlayerHealth } from '../systems/combat';
import type { SectorId } from '../systems/stageDirector';
import type { WeaponLevel } from '../systems/weaponSystem';

const sectorTitles: Record<SectorId, string> = {
  evacuacao: 'EVACUAÇÃO',
  destrocos: 'DESTROÇOS',
  industria: 'ANEL INDUSTRIAL',
  aproximacao: 'KRM-17 RADAR',
};

/** HUD de combate futurista de alta visibilidade com suporte a altas taxas de quadros (>60 FPS). */
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
  private readonly fpsText: Phaser.GameObjects.Text;

  // Painel inferior
  private readonly weaponText: Phaser.GameObjects.Text;
  private readonly resonanceBarFill: Phaser.GameObjects.Rectangle;
  private readonly resonanceText: Phaser.GameObjects.Text;
  private readonly bombText: Phaser.GameObjects.Text;

  // Barra de vida do Chefe
  private readonly bossBarContainer: Phaser.GameObjects.Container;
  private readonly bossNameText: Phaser.GameObjects.Text;
  private readonly bossHpFill: Phaser.GameObjects.Rectangle;
  private readonly bossHpBg: Phaser.GameObjects.Rectangle;

  private statusRemainingMs = 0;
  private pulseTimer = 0;
  private fpsUpdateTimer = 0;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
    this.scene = scene;

    // Barra superior translúcida de 28px (não obstrui o combate)
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x07111c, 0.82)
      .setDepth(40);
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP - 1, GAME_WIDTH, 1.5, 0x22485a)
      .setDepth(41);

    // Topo Esquerdo: Título e Piloto
    this.titleText(14, 5, 'BULLET WAKE', 14, '#ffffff');
    this.pilotText = this.techText(124, 7, 'RIVET', 12, '#5eead4');
    this.sectorText = this.techText(185, 7, `[${sectorTitles.evacuacao}]`, 11, '#8ea6b8');

    // Topo Centro: Pontuação e Combo
    this.techText(300, 7, 'SCORE', 10, '#648498');
    this.scoreText = this.titleText(345, 5, '000000', 15, '#ffd494');
    this.comboText = this.techText(435, 7, '', 12, '#ffea75');

    // Topo Direita: HP, Vidas, Progresso e FPS
    this.techText(505, 7, 'HP', 10, '#648498');
    for (let i = 0; i < MAX_HP; i++) {
      const segment = scene.add.rectangle(530 + i * 14, 14, 10, 10, 0x5eead4)
        .setStrokeStyle(1, 0xa7f3d0)
        .setDepth(42);
      this.healthSegments.push(segment);
    }
    this.shieldBadge = this.techText(580, 7, '[SHIELD]', 10, '#67e8f9').setVisible(false);

    this.livesText = this.titleText(640, 5, 'x3', 14, '#ffffff');
    this.progressText = this.techText(670, 7, '00%', 11, '#94a3b8');

    // Medidor de FPS em tempo real (>60 FPS verificado)
    this.fpsText = this.techText(GAME_WIDTH - 14, 7, '60 FPS', 11, '#67e8f9')
      .setOrigin(1, 0);

    // Linha de progresso da fase
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP + 1, GAME_WIDTH - 24, 2, 0x111c28).setDepth(41);
    this.progressBar = scene.add.rectangle(12, HUD_TOP + 1, 1, 2, 0x5eead4)
      .setOrigin(0, 0.5).setDepth(42);

    this.statusText = this.titleText(GAME_WIDTH / 2, HUD_TOP + 10, '', 14, '#fde047')
      .setOrigin(0.5, 0);

    // Barra inferior translúcida de 28px
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - HUD_BOTTOM / 2, GAME_WIDTH, HUD_BOTTOM, 0x07111c, 0.82)
      .setDepth(40);
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - HUD_BOTTOM, GAME_WIDTH, 1.5, 0x22485a)
      .setDepth(41);

    // Inferior Esquerdo: Arma e Nível
    this.weaponText = this.hudText(14, GAME_HEIGHT - 21, 'PULSO LV.1', 13, '#5eead4');

    // Inferior Centro: Medidor de Ressonância
    const resX = GAME_WIDTH / 2 - 20;
    this.techText(resX - 70, GAME_HEIGHT - 20, 'RESSONÂNCIA', 11, '#c084fc').setOrigin(0.5, 0);
    scene.add.rectangle(resX + 35, GAME_HEIGHT - 14, 140, 10, 0x1f1430)
      .setStrokeStyle(1, 0x583570).setDepth(41);
    this.resonanceBarFill = scene.add.rectangle(resX + 35 - 69, GAME_HEIGHT - 14, 1, 8, 0xa855f7)
      .setOrigin(0, 0.5).setDepth(42);
    this.resonanceText = this.techText(resX + 35, GAME_HEIGHT - 20, '0%', 10, '#ffffff')
      .setOrigin(0.5, 0);

    // Inferior Direito: Bombas e Reiniciar
    this.bombText = this.hudText(GAME_WIDTH - 210, GAME_HEIGHT - 21, 'BOMBAS: [B] [B]', 12, '#f87171');

    const restartBtn = scene.add.rectangle(
      GAME_WIDTH - 55, GAME_HEIGHT - HUD_BOTTOM / 2, 85, 20, 0x1e3646,
    ).setStrokeStyle(1, 0x5eead4).setInteractive({ useHandCursor: true }).setDepth(41);
    this.techText(GAME_WIDTH - 55, GAME_HEIGHT - 21, 'RESET [R]', 11, '#ffffff').setOrigin(0.5, 0);
    restartBtn.on('pointerdown', onRestart);

    // Barra de Vida do Chefe
    const bossWidth = 440;
    this.bossNameText = scene.add.text(0, -12, '', {
      fontFamily: FONT_TITLE,
      fontSize: '12px',
      color: '#f87171',
    }).setOrigin(0.5, 1);

    this.bossHpBg = scene.add.rectangle(0, 0, bossWidth, 8, 0x241116)
      .setStrokeStyle(1, 0x7f1d1d);
    this.bossHpFill = scene.add.rectangle(-bossWidth / 2, 0, bossWidth, 6, 0xef4444)
      .setOrigin(0, 0.5);

    this.bossBarContainer = scene.add.container(GAME_WIDTH / 2, HUD_TOP + 18, [
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
      this.comboText.setText(`x${comboCount} (${multiplier.toFixed(1)}x)`).setVisible(true);
    } else {
      this.comboText.setVisible(false);
    }
  }

  setHealth(state: PlayerHealth, hasShield = false): void {
    this.healthSegments.forEach((segment, index) => {
      const active = index < state.hp;
      segment.setFillStyle(active ? 0x5eead4 : 0x1f2937);
      segment.setStrokeStyle(1, active ? 0xa7f3d0 : 0x374151);
    });
    this.livesText.setText(`x${state.lives}`);
    this.shieldBadge.setVisible(hasShield);
  }

  setWeapon(weaponName: string, level: WeaponLevel): void {
    this.weaponText.setText(`${weaponName.toUpperCase()} LV.${level}`);
    if (level === 3) {
      this.weaponText.setColor('#fde047');
    } else if (level === 2) {
      this.weaponText.setColor('#67e8f9');
    } else {
      this.weaponText.setColor('#5eead4');
    }
  }

  setResonance(percent: number, specialActive = false): void {
    const clamped = Math.max(0, Math.min(100, percent));
    const width = Math.max(1, (138 * clamped) / 100);
    this.resonanceBarFill.setSize(width, 8);

    if (specialActive) {
      this.resonanceBarFill.setFillStyle(0x38bdf8);
      this.resonanceText.setText('ESPECIAL ATIVO!');
      this.resonanceText.setColor('#ffffff');
    } else if (clamped >= 100) {
      this.resonanceBarFill.setFillStyle(0xd946ef);
      this.resonanceText.setText('ESPECIAL PRONTO [X/SHIFT]');
      this.resonanceText.setColor('#fef08a');
    } else {
      this.resonanceBarFill.setFillStyle(0xa855f7);
      this.resonanceText.setText(`${Math.floor(clamped)}%`);
      this.resonanceText.setColor('#ffffff');
    }
  }

  setBombs(bombs: number): void {
    const count = Math.max(0, bombs);
    const icons = count === 0 ? 'NENHUMA' : Array(count).fill('[B]').join(' ');
    this.bombText.setText(`BOMBAS: ${icons}`);
  }

  setProgress(value: number): void {
    const progress = Math.max(0, Math.min(1, value));
    this.progressText.setText(String(Math.floor(progress * 100)).padStart(2, '0') + '%');
    this.progressBar.setSize((GAME_WIDTH - 24) * progress, 2);
  }

  setSector(sector: SectorId): void {
    const title = sectorTitles[sector] || sector.toUpperCase();
    this.sectorText.setText(`[${title}]`);
    this.flash(`SETOR: ${title}`, '#38bdf8', 1200);
  }

  showBossBar(bossName: string, hp: number, maxHp: number): void {
    this.bossBarContainer.setVisible(true);
    this.bossNameText.setText(bossName.toUpperCase());
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 1)));
    this.bossHpFill.setSize(440 * ratio, 6);
  }

  hideBossBar(): void {
    this.bossBarContainer.setVisible(false);
  }

  flash(message: string, color = '#fde047', durationMs = 1000): void {
    this.statusText.setColor(color).setText(message).setVisible(true);
    this.statusRemainingMs = durationMs;
  }

  update(deltaMs: number): void {
    this.statusRemainingMs = Math.max(0, this.statusRemainingMs - deltaMs);
    if (this.statusRemainingMs === 0) this.statusText.setVisible(false);

    this.pulseTimer += deltaMs;
    this.fpsUpdateTimer += deltaMs;

    if (this.fpsUpdateTimer >= 200) {
      this.fpsUpdateTimer = 0;
      const actualFps = Math.round(this.scene.game.loop.actualFps || 60);
      this.fpsText.setText(`${actualFps} FPS`);
      if (actualFps >= 100) {
        this.fpsText.setColor('#4ade80'); // Verde neon em altas taxas
      } else if (actualFps >= 55) {
        this.fpsText.setColor('#67e8f9'); // Ciano estável em 60 FPS
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

  private techText(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, {
      fontFamily: FONT_TECH,
      fontSize: size + 'px',
      color,
    }).setResolution(2).setDepth(42);
  }
}
