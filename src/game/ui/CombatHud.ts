import Phaser from 'phaser';
import {
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
 * BULLET WAKE V2 — HUD Oficial Neo-Arcade HD 2D de Alta Legibilidade (1366x768 e 1920x1080).
 *
 * Regras P0 aplicadas:
 * - Zero textos ilegíveis de 9px/10px/11px: todos os rótulos usam 13px–14px bold e valores 15px–20px bold.
 * - Renderização nítida com setResolution(3) e antialiasing bilinear ativo.
 * - 8 Indicadores Essenciais de leitura imediata:
 *   1. Vida (Blindagem + Vidas)
 *   2. Pontuação
 *   3. Arma equipada (ENERGIA ESPIRALADA / DISPERSÃO AZUL / LASER RUBRO)
 *   4. Potência atual (NV 1/4 a 4/4)
 *   5. Progresso P 0/3 (blocos visuais + contador)
 *   6. Bombas
 *   7. Especial
 *   8. Dash 3/3
 */
export class CombatHud {
  private readonly scene: Phaser.Scene;

  // --- PAINEL ESQUERDO (X: 0 a 168) ---
  private readonly pilotPortrait: Phaser.GameObjects.Sprite;
  private readonly pilotNameText: Phaser.GameObjects.Text;
  private readonly shipModelText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly comboText: Phaser.GameObjects.Text;
  private readonly healthFill: Phaser.GameObjects.Rectangle;
  private readonly shieldBadge: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly dashCountText: Phaser.GameObjects.Text;
  private readonly dashDotsText: Phaser.GameObjects.Text;

  // --- CORREDOR CENTRAL (Notificações e Barra de Chefe) ---
  private readonly statusToast: Phaser.GameObjects.Text;
  private readonly bossBarContainer: Phaser.GameObjects.Container;
  private readonly bossNameText: Phaser.GameObjects.Text;
  private readonly bossHpFill: Phaser.GameObjects.Rectangle;

  // --- PAINEL DIREITO (X: 600 a 768) ---
  private readonly sectorText: Phaser.GameObjects.Text;
  private readonly weaponTitleText: Phaser.GameObjects.Text;
  private readonly weaponLevelText: Phaser.GameObjects.Text;
  private readonly weaponPips: Phaser.GameObjects.Text;
  private readonly powerMeterText: Phaser.GameObjects.Text;
  private readonly powerSegments: Phaser.GameObjects.Rectangle[] = [];
  private readonly bombText: Phaser.GameObjects.Text;
  private readonly specialBarFill: Phaser.GameObjects.Rectangle;
  private readonly specialText: Phaser.GameObjects.Text;
  private readonly heatText: Phaser.GameObjects.Text;
  private readonly fpsText: Phaser.GameObjects.Text;

  private statusRemainingMs = 0;
  private fpsUpdateTimer = 0;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
    this.scene = scene;

    const leftX = 10;
    const cardW = PLAYFIELD_X - 20; // 148px

    // =========================================================
    // 1. PAINEL LATERAL ESQUERDO (X: 0 a 168)
    // =========================================================

    // Card 1: Identificação do Piloto (Y: 10..76)
    scene.add.rectangle(leftX + cardW / 2, 43, cardW, 64, 0x071422, 0.92)
      .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

    scene.add.rectangle(leftX + 26, 43, 44, 44, 0x040d18)
      .setStrokeStyle(1.5, 0x00f0ff, 0.85).setDepth(41);
    this.pilotPortrait = scene.add.sprite(leftX + 26, 43, 'portrait-nolan', 0)
      .setDisplaySize(40, 40).setDepth(42);

    this.pilotNameText = scene.add.text(leftX + 54, 24, 'NOLAN FITCH', {
      fontFamily: FONT_TITLE,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setDepth(42).setResolution(3);

    this.shipModelText = scene.add.text(leftX + 54, 44, 'RIVET V3', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#38bdf8',
    }).setDepth(42).setResolution(3);

    // Card 2: Pontuação (Y: 84..154)
    scene.add.rectangle(leftX + cardW / 2, 119, cardW, 66, 0x071422, 0.92)
      .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

    scene.add.text(leftX + 8, 90, 'PONTUAÇÃO', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#93c5fd',
    }).setDepth(42).setResolution(3);

    this.scoreText = scene.add.text(leftX + 8, 110, '000000', {
      fontFamily: FONT_TITLE,
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setDepth(42).setResolution(3);

    this.comboText = scene.add.text(leftX + cardW - 8, 90, '', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#facc15',
    }).setOrigin(1, 0).setDepth(42).setResolution(3);

    // Card 3: Vida & Blindagem (Y: 162..258)
    scene.add.rectangle(leftX + cardW / 2, 210, cardW, 92, 0x071422, 0.92)
      .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

    scene.add.text(leftX + 8, 168, 'VIDA / BLINDAGEM', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#93c5fd',
    }).setDepth(42).setResolution(3);

    scene.add.rectangle(leftX+8,200,cardW-16,14,0x222025).setOrigin(0,.5).setStrokeStyle(1,0x77604b).setDepth(42);
    this.healthFill=scene.add.rectangle(leftX+9,200,cardW-18,12,0x78bc72).setOrigin(0,.5).setDepth(43);

    this.livesText = scene.add.text(leftX + 8, 222, 'VIDA: 100 / 100', {
      fontFamily: FONT_TITLE,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setDepth(42).setResolution(3);

    this.shieldBadge = scene.add.text(leftX + cardW - 8, 223, 'ESCUDO', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#00f0ff',
    }).setOrigin(1, 0).setDepth(42).setResolution(3).setVisible(false);

    // Card 4: Dash 3/3 (Y: 266..352)
    scene.add.rectangle(leftX + cardW / 2, 309, cardW, 82, 0x071422, 0.92)
      .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

    this.dashCountText = scene.add.text(leftX + 8, 274, 'DASH 3/3', {
      fontFamily: FONT_TITLE,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#00f0ff',
    }).setDepth(42).setResolution(3);

    this.dashDotsText = scene.add.text(leftX + 8, 298, '◆ ◆ ◆', {
      fontFamily: FONT_TITLE,
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#38bdf8',
    }).setDepth(42).setResolution(3);

    scene.add.text(leftX + 8, 324, 'TECLA: SHIFT ESQ', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#cbd5e1',
    }).setDepth(42).setResolution(3);

    // Botão de Reinício da Fase [R] (Y: 382..414)
    const resetBtn = scene.add.rectangle(leftX + cardW / 2, 398, cardW, 28, 0x0c1e33)
      .setStrokeStyle(1.5, 0x38bdf8, 0.7).setInteractive({ useHandCursor: true }).setDepth(42);
    scene.add.text(leftX + cardW / 2, 398, 'REINICIAR [R]', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f8fafc',
    }).setOrigin(0.5).setDepth(43).setResolution(3);

    resetBtn.on('pointerover', () => resetBtn.setFillStyle(0x163454));
    resetBtn.on('pointerout', () => resetBtn.setFillStyle(0x0c1e33));
    resetBtn.on('pointerdown', onRestart);

    // =========================================================
    // 2. CORREDOR CENTRAL (Notificações e Barra de Chefe)
    // =========================================================
    const centerX = PLAYFIELD_X + (PLAYFIELD_RIGHT - PLAYFIELD_X) / 2;

    // Barra de Chefe de Alta Visibilidade no Topo do Corredor
    const bossBarW = 280;
    const bossBgPanel = scene.add.rectangle(centerX, 24, bossBarW + 16, 34, 0x090d16, 0.9)
      .setStrokeStyle(1.5, 0xef4444);
    this.bossNameText = scene.add.text(centerX, 11, 'ALVO: TALASSARCA', {
      fontFamily: FONT_TITLE,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fecaca',
    }).setOrigin(0.5, 0).setResolution(3);
    const bossHpBg = scene.add.rectangle(centerX, 31, bossBarW, 8, 0x2a0a10)
      .setStrokeStyle(1, 0x7f1d1d);
    this.bossHpFill = scene.add.rectangle(centerX - bossBarW / 2, 31, bossBarW, 6, 0xef4444)
      .setOrigin(0, 0.5);

    this.bossBarContainer = scene.add.container(0, 0, [
      bossBgPanel,
      this.bossNameText,
      bossHpBg,
      this.bossHpFill,
    ]).setDepth(45).setVisible(false);

    this.statusToast = scene.add.text(centerX, 46, '', {
      fontFamily: FONT_HUD,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#fde047',
      stroke: '#020617',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(45).setResolution(3).setAlpha(0.98);

    // =========================================================
    // 3. PAINEL LATERAL DIREITO (X: 600 a 768)
    // =========================================================
    const rightX = PLAYFIELD_RIGHT + 10;

    // Card 1: Fase e Setor (Y: 10..62)
    scene.add.rectangle(rightX + cardW / 2, 36, cardW, 50, 0x071422, 0.92)
      .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

    scene.add.text(rightX + 8, 15, 'FASE 01 · FENDA PELÁGICA', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#38bdf8',
    }).setDepth(42).setResolution(3);

    this.sectorText = scene.add.text(rightX + 8, 35, 'ÁGUAS COSTEIRAS', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#f8fafc',
    }).setDepth(42).setResolution(3);

    // Card 2: Arma Equipada & Potência Atual (Y: 68..166)
    scene.add.rectangle(rightX + cardW / 2, 117, cardW, 94, 0x071422, 0.92)
      .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

    scene.add.text(rightX + 8, 73, 'ARMA EQUIPADA', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#93c5fd',
    }).setDepth(42).setResolution(3);

      this.weaponTitleText = scene.add.text(rightX + 8, 94, 'DISPERSÃO AZUL', {
        fontFamily: FONT_TITLE,
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: '#00f0ff',
      }).setDepth(42).setResolution(3);

      this.weaponLevelText = scene.add.text(rightX + 8, 118, 'POTÊNCIA: NV 1/4', {
        fontFamily: FONT_HUD,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setDepth(42).setResolution(3);

      this.weaponPips = scene.add.text(rightX + 8, 139, '● ○ ○ ○', {
        fontFamily: FONT_TITLE,
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#00f0ff',
      }).setDepth(42).setResolution(3);

      // Card 3: Progresso P 0/3 (Y: 172..236)
      scene.add.rectangle(rightX + cardW / 2, 204, cardW, 60, 0x071422, 0.92)
        .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

      this.powerMeterText = scene.add.text(rightX + 8, 178, 'PROGRESSO P: 0/3', {
        fontFamily: FONT_HUD,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#facc15',
      }).setDepth(42).setResolution(3);

      for(let i = 0; i< 3; i++) {
      const pSeg = scene.add.rectangle(rightX + 27 + i * 44, 214, 38, 12, 0x1e293b)
        .setStrokeStyle(1.5, 0x64748b).setDepth(42);
      this.powerSegments.push(pSeg);
    }

    // Card 4: Bombas & Especial (Y: 242..344)
    scene.add.rectangle(rightX + cardW / 2, 293, cardW, 98, 0x071422, 0.92)
      .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

    this.bombText = scene.add.text(rightX + 8, 248, 'BOMBAS [X]: 02', {
      fontFamily: FONT_TITLE,
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ff8787',
    }).setDepth(42).setResolution(3);

    this.specialText = scene.add.text(rightX + 8, 276, 'ESPECIAL [V]: 0%', {
      fontFamily: FONT_HUD,
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#e9d5ff',
    }).setDepth(42).setResolution(3);

    scene.add.rectangle(rightX + 8 + 64, 306, 128, 10, 0x190d26)
      .setStrokeStyle(1.5, 0x6b21a8).setDepth(41);
    this.specialBarFill = scene.add.rectangle(rightX + 9, 306, 2, 8, 0xa855f7)
      .setOrigin(0, 0.5).setDepth(42);

    // Card 5: Modo de Disparo Autofire & FPS (Y: 350..418)
    scene.add.rectangle(rightX + cardW / 2, 384, cardW, 64, 0x071422, 0.92)
      .setStrokeStyle(1.5, 0x1e3a5f).setDepth(40);

      this.heatText = scene.add.text(rightX + 8, 356, 'TIRO: ESPAÇO [AUTO]', {
        fontFamily: FONT_HUD,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#93c5fd',
      }).setDepth(42).setResolution(3);

        this.fpsText = scene.add.text(rightX + 8, 382, '60 FPS', {
          fontFamily: FONT_TITLE,
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#38bdf8',
      }).setOrigin(0, 0).setDepth(42).setResolution(3);
    }

  setPilot(pilotId: string, shipName: string): void {
      const portraitKey = `portrait-${pilotId}`;
      if(this.scene.textures.exists(portraitKey)) {
      this.pilotPortrait.setTexture(portraitKey);
    }
    const nameUpper =
      pilotId === 'cora'
        ? 'CORA WREN'
        : pilotId === 'harlan'
          ? 'HARLAN GREER'
          : 'NOLAN FITCH';
    this.pilotNameText.setText(nameUpper);
    this.shipModelText.setText(`CAÇA: ${shipName.toUpperCase()}`);
  }

  setScore(score: number, comboCount = 0, multiplier = 1.0): void {
    this.scoreText.setText(String(Math.max(0, Math.floor(score))).padStart(6, '0'));
    if (comboCount > 1) {
      this.comboText.setText(`x${multiplier.toFixed(1)}`).setVisible(true);
    } else {
      this.comboText.setVisible(false);
    }
  }

  setHealth(state: PlayerHealth, hasShield = false): void {
    this.healthFill.setScale(Math.max(0,state.hp/MAX_HP),1);
    this.livesText.setText(`VIDA: ${Math.ceil(state.hp)} / ${MAX_HP}`);
    this.shieldBadge.setVisible(hasShield);
  }

  setDash(remaining: number, max = 3): void {
    const clamped = Math.max(0, Math.min(max, remaining));
    const formatted = formatDashIndicator(clamped, max);
    this.dashCountText.setText(`DASH ${clamped}/${max}`);
    this.dashDotsText.setText(formatted);
    if (clamped === 0) {
      this.dashCountText.setColor('#94a3b8');
      this.dashDotsText.setColor('#64748b');
    } else if (clamped === 1) {
      this.dashCountText.setColor('#fb923c');
      this.dashDotsText.setColor('#f97316');
    } else {
      this.dashCountText.setColor('#00f0ff');
      this.dashDotsText.setColor('#38bdf8');
    }
  }

  setWeapon(family: WeaponFamily, level: WeaponLevel, powerMeter = 0): void {
    const title =
      family === 'green'
        ? 'ENERGIA ESPIRALADA'
        : family === 'ion'
          ? 'DISPERSÃO AZUL'
          : 'LASER RUBRO';
    const color =
      family === 'green' ? '#4ade80' : family === 'ion' ? '#00f0ff' : '#ff4d6d';

    this.weaponTitleText.setText(title).setColor(color);
    this.weaponLevelText.setText(`POTÊNCIA: NV ${level}/4`);

    const pipsStr =
      level === 4
        ? '● ● ● ●'
        : level === 3
          ? '● ● ● ○'
          : level === 2
            ? '● ● ○ ○'
            : '● ○ ○ ○';
    this.weaponPips.setText(pipsStr).setColor(color);
    this.setPowerMeter(powerMeter, level);
  }

  setPowerMeter(powerMeter: number, level: WeaponLevel): void {
    if (level >= 4) {
      this.powerMeterText.setText('PROGRESSO P: MÁX').setColor('#fbbf24');
      this.powerSegments.forEach((seg) => {
        seg.setFillStyle(0xfacc15);
        seg.setStrokeStyle(1.5, 0xfef08a);
      });
      return;
    }
    const clamped = Math.max(0, Math.min(3, Math.floor(powerMeter)));
    this.powerMeterText
      .setText(`PROGRESSO P: ${clamped}/3`)
      .setColor(clamped > 0 ? '#facc15' : '#e2e8f0');

    this.powerSegments.forEach((seg, idx) => {
      const active = idx < clamped;
      seg.setFillStyle(active ? 0xfacc15 : 0x1e293b);
      seg.setStrokeStyle(1.5, active ? 0xfef08a : 0x64748b);
    });
  }

    setHeat(_heat: number, _isOverheated: boolean): void {
      // Regra Canônica Fire Shark #9 e #10: Autofire contínuo sem bloqueio por superaquecimento na HUD
      this.heatText.setText('TIRO: ESPAÇO [AUTO]').setColor('#93c5fd');
    }

    setBombs(bombs: number): void {
      this.bombText.setText(`BOMBAS [X]: ${String(Math.max(0, bombs)).padStart(2, '0')}`);
    }

    setMissileReady(_ready: boolean): void {
      // Mísseis continuam ativos via tecla M com aviso por toast
    }

    setProgress(_ratio: number): void {
      // Telemetria de progresso reservada
    }

    setCharge(_chargeMs: number, _maxMs: number, isCharging: boolean): void {
      if(isCharging) {
        this.statusToast
          .setText('CARREGANDO WAVE CANNON... [C]')
          .setColor('#00f0ff')
          .setVisible(true)
          .setAlpha(0.95);
        this.statusRemainingMs = 250;
      }
    }

    setResonance(percent: number, specialActive = false): void {
      const clamped = Math.max(0, Math.min(100, percent));
      const width = Math.max(2, (126 * clamped) / 100);
      this.specialBarFill.setSize(width, 8);

      if(specialActive) {
        this.specialBarFill.setFillStyle(0x00f0ff);
        this.specialText.setText('ESPECIAL: ATIVO!').setColor('#00f0ff');
      } else if(clamped >= 100) {
      this.specialBarFill.setFillStyle(0xd946ef);
      this.specialText.setText('ESPECIAL [V]: PRONTO!').setColor('#fef08a');
    } else {
      this.specialBarFill.setFillStyle(0xa855f7);
      this.specialText.setText(`ESPECIAL [V]: ${Math.floor(clamped)}%`).setColor('#e9d5ff');
    }
  }

  setSector(sector: SectorId): void {
    const title = sectorTitles[sector] || sector.toUpperCase();
    this.sectorText.setText(title);
    this.flash(`SETOR: ${title}`, '#38bdf8', 650);
  }

  showBossBar(bossName: string, hp: number, maxHp: number): void {
    this.bossBarContainer.setVisible(true);
    this.bossNameText.setText(`ALVO: ${bossName.toUpperCase()}`);
    const ratio = Math.max(0, Math.min(1, hp / (maxHp || 1)));
    this.bossHpFill.setSize(280 * ratio, 6);
  }

  hideBossBar(): void {
    this.bossBarContainer.setVisible(false);
  }

  flash(message: string, color = '#ffd166', durationMs = 700): void {
    this.statusToast.setColor(color).setText(message).setVisible(true).setAlpha(0.98);
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
