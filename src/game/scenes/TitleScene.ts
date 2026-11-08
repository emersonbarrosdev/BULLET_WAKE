import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH, FONT_TITLE, FONT_HUD, FONT_TECH } from '../constants';
import { StageBackdrop } from './StageBackdrop';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { globalAudio } from '../audio/audioSystem.ts';
import { saveSystem } from '../systems/saveSystem.ts';

interface MenuItem {
  text: string;
  badge?: string;
  action: () => void;
}

export class TitleScene extends Phaser.Scene {
  private backdrop!: StageBackdrop;
  private previewDistance = 0;
  private selectedIndex = 0;
  private menuItems: MenuItem[] = [];
  private menuButtons: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; border: Phaser.GameObjects.Rectangle }[] = [];
  private modalContainer?: Phaser.GameObjects.Container;
  private glowTimer = 0;
  private titleGlow!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TitleScene' });
  }

  preload(): void {
    loadGameSprites(this);
  }

  create(): void {
    registerGameAnimations(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.backdrop = new StageBackdrop(this, 1);
    this.previewDistance = 0;
    this.selectedIndex = 0;
    this.menuButtons = [];

    // Fundo de vinheta translúcida central
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050c17, 0.45);

    // Moldura cibernética do Título
    this.add.rectangle(GAME_WIDTH / 2, 78, 640, 110, 0x071322, 0.88)
      .setStrokeStyle(1.5, 0x224d63);

    // Efeito de brilho neon no título
    this.titleGlow = this.add.text(GAME_WIDTH / 2, 36, 'BULLET WAKE', {
      fontFamily: FONT_TITLE,
      fontSize: '44px',
      color: '#38bdf8',
    }).setOrigin(0.5, 0).setAlpha(0.4);

    this.add.text(GAME_WIDTH / 2, 36, 'BULLET WAKE', {
      fontFamily: FONT_TITLE,
      fontSize: '44px',
      color: '#ffffff',
    }).setOrigin(0.5, 0).setStroke('#0f2b3c', 6);

    this.add.text(
      GAME_WIDTH / 2,
      90,
      'EVERY SHOT LEAVES A TRACE',
      {
        fontFamily: FONT_TECH,
        fontSize: '14px',
        color: '#5eead4',
        letterSpacing: 4,
      },
    ).setOrigin(0.5, 0);

    this.add.text(
      GAME_WIDTH / 2,
      112,
      'FASE 01: CINTURÃO DE FERRUGEM  //  SISTEMA ESTÁVEL',
      {
        fontFamily: FONT_HUD,
        fontSize: '11px',
        color: '#94a3b8',
      },
    ).setOrigin(0.5, 0);

    // Itens de Menu principais
    this.menuItems = [
      {
        text: 'JOGAR FASE 1: CINTURÃO DE FERRUGEM',
        badge: '[ENTER]',
        action: () => this.startStage1(),
      },
      {
        text: 'ESCOLHA DE PILOTO & CAÇA',
        badge: '[P]',
        action: () => this.openPilotSelect(),
      },
      {
        text: 'SELEÇÃO DE FASES (1 - 5)',
        badge: '[S]',
        action: () => this.openStageSelect(),
      },
      {
        text: 'CONFIGURAÇÕES & FPS',
        badge: '[C]',
        action: () => this.openSettingsModal(),
      },
      {
        text: 'CONTROLES & GUIA',
        badge: '[H]',
        action: () => this.openControlsModal(),
      },
    ];

    const startY = 175;
    const itemHeight = 39;

    this.menuItems.forEach((item, index) => {
      const y = startY + index * itemHeight;

      const bg = this.add
        .rectangle(GAME_WIDTH / 2, y, 420, 32, 0x0c1b2a, 0.92)
        .setStrokeStyle(1, 0x244a5e)
        .setInteractive({ useHandCursor: true });

      const border = this.add
        .rectangle(GAME_WIDTH / 2 - 206, y, 3, 26, 0x5eead4)
        .setVisible(index === 0);

      const label = this.add.text(GAME_WIDTH / 2 - 180, y - 8, item.text, {
        fontFamily: FONT_HUD,
        fontSize: '13px',
        color: '#d1e6f5',
      });

      if (item.badge) {
        this.add.text(GAME_WIDTH / 2 + 185, y - 8, item.badge, {
          fontFamily: FONT_TECH,
          fontSize: '11px',
          color: '#67e8f9',
        }).setOrigin(1, 0);
      }

      bg.on('pointerover', () => this.selectItem(index));
      bg.on('pointerdown', () => this.activateItem(index));

      this.menuButtons.push({ bg, label, border });
    });

    // Rodapé de navegação e créditos
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 18, GAME_WIDTH, 36, 0x050c16, 0.94);
    this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 25,
      'W/S / SETAS: NAVEGAR   |   ENTER / ESPAÇO: INICIAR   |   DISPARO: ESPAÇO   |   ESPECIAL: X',
      {
        fontFamily: FONT_TECH,
        fontSize: '11px',
        color: '#64748b',
      },
    ).setOrigin(0.5, 0);

    this.selectItem(0);

    // Controles de teclado
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-UP', () => this.navigate(-1));
      kb.on('keydown-W', () => this.navigate(-1));
      kb.on('keydown-DOWN', () => this.navigate(1));
      kb.on('keydown-S', () => this.navigate(1));
      kb.on('keydown-ENTER', () => this.onConfirm());
      kb.on('keydown-SPACE', () => this.onConfirm());
      kb.on('keydown-P', () => { if (!this.modalContainer) this.openPilotSelect(); });
      kb.on('keydown-S', () => { if (!this.modalContainer) this.openStageSelect(); });
      kb.on('keydown-C', () => { if (!this.modalContainer) this.openSettingsModal(); });
      kb.on('keydown-H', () => { if (!this.modalContainer) this.openControlsModal(); });
      kb.on('keydown-ESC', () => { if (this.modalContainer) this.closeModal(); });
    }
  }

  update(_time: number, delta: number): void {
    this.previewDistance += Math.min(delta, 50) * 0.024;
    this.backdrop.update(this.previewDistance);

    // Pulso neon suave no título
    this.glowTimer += delta * 0.003;
    if (this.titleGlow) {
      this.titleGlow.setAlpha(0.25 + Math.sin(this.glowTimer) * 0.15);
    }
  }

  private navigate(dir: number): void {
    if (this.modalContainer) return;
    const total = this.menuItems.length;
    this.selectItem((this.selectedIndex + dir + total) % total);
    globalAudio.playShot('cora', 1);
  }

  private onConfirm(): void {
    if (this.modalContainer) {
      this.closeModal();
      return;
    }
    this.activateItem(this.selectedIndex);
  }

  private selectItem(index: number): void {
    this.selectedIndex = index;
    this.menuButtons.forEach((btn, idx) => {
      const isSelected = idx === index;
      btn.bg.setStrokeStyle(isSelected ? 1.5 : 1, isSelected ? 0x5eead4 : 0x244a5e);
      btn.bg.setFillStyle(isSelected ? 0x17364b : 0x0c1b2a, 0.95);
      btn.label.setColor(isSelected ? '#ffffff' : '#94a3b8');
      btn.border.setVisible(isSelected);
    });
  }

  private activateItem(index: number): void {
    globalAudio.playPickup('upgrade');
    this.menuItems[index].action();
  }

  private startStage1(): void {
    this.scene.start('PrototypeScene', { pilotId: 'nolan', stageNumber: 1 });
  }

  private openPilotSelect(): void {
    this.scene.start('PilotSelectScene', { stageNumber: 1 });
  }

  private openStageSelect(): void {
    this.scene.start('StageSelectScene');
  }

  private openSettingsModal(): void {
    const data = saveSystem.getSaveData();
    const currentSfx = data.settings.sfxVolume > 0;
    const currentBgm = data.settings.musicVolume > 0;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x040a12, 0.88);
    const box = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 500, 280, 0x0a1928)
      .setStrokeStyle(1.5, 0x5eead4);

    const title = this.add.text(GAME_WIDTH / 2, 95, 'CONFIGURAÇÕES & TAXA DE QUADROS', {
      fontFamily: FONT_TITLE,
      fontSize: '18px',
      color: '#5eead4',
    }).setOrigin(0.5, 0);

    const sfxBtn = this.add.rectangle(GAME_WIDTH / 2, 155, 360, 34, 0x152c3e)
      .setStrokeStyle(1, 0x3b728a).setInteractive({ useHandCursor: true });
    const sfxLabel = this.add.text(GAME_WIDTH / 2, 147, `EFEITOS SONOROS (SFX): ${currentSfx ? 'ATIVADO' : 'MUTADO'}`, {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    sfxBtn.on('pointerdown', () => {
      const next = !saveSystem.getSaveData().settings.sfxVolume;
      saveSystem.updateSettings({ sfxVolume: next ? 1 : 0 });
      sfxLabel.setText(`EFEITOS SONOROS (SFX): ${next ? 'ATIVADO' : 'MUTADO'}`);
    });

    const bgmBtn = this.add.rectangle(GAME_WIDTH / 2, 200, 360, 34, 0x152c3e)
      .setStrokeStyle(1, 0x3b728a).setInteractive({ useHandCursor: true });
    const bgmLabel = this.add.text(GAME_WIDTH / 2, 192, `MÚSICA RETRO-SYNTH: ${currentBgm ? 'ATIVADO' : 'MUTADO'}`, {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    bgmBtn.on('pointerdown', () => {
      const next = !saveSystem.getSaveData().settings.musicVolume;
      saveSystem.updateSettings({ musicVolume: next ? 1 : 0 });
      bgmLabel.setText(`MÚSICA RETRO-SYNTH: ${next ? 'ATIVADO' : 'MUTADO'}`);
      if (!next) globalAudio.stopMusic();
    });

    const fpsHint = this.add.text(
      GAME_WIDTH / 2,
      242,
      'TARGET FPS: ATÉ 240 FPS (SUPORTE NATIVO A 120Hz / 144Hz / 240Hz)',
      {
        fontFamily: FONT_TECH,
        fontSize: '11px',
        color: '#67e8f9',
      },
    ).setOrigin(0.5, 0);

    const closeBtn = this.add.rectangle(GAME_WIDTH / 2, 285, 140, 28, 0x22485a)
      .setStrokeStyle(1, 0x5eead4).setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(GAME_WIDTH / 2, 278, 'FECHAR [ESC]', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);
    closeBtn.on('pointerdown', () => this.closeModal());

    this.modalContainer = this.add.container(0, 0, [
      overlay, box, title, sfxBtn, sfxLabel, bgmBtn, bgmLabel, fpsHint, closeBtn, closeLabel,
    ]).setDepth(50);
  }

  private openControlsModal(): void {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x040a12, 0.88);
    const box = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 540, 310, 0x0a1928)
      .setStrokeStyle(1.5, 0x5eead4);

    const title = this.add.text(GAME_WIDTH / 2, 75, 'CONTROLES DE VOO & COMBATE', {
      fontFamily: FONT_TITLE,
      fontSize: '18px',
      color: '#5eead4',
    }).setOrigin(0.5, 0);

    const controls = this.add.text(
      GAME_WIDTH / 2,
      115,
      '• MOVIMENTAÇÃO: W/A/S/D ou TECLAS DIRECIONAIS\n' +
      '  (Alcance total da tela com inclinação de voo)\n\n' +
      '• DISPARO PRINCIPAL: BARRA DE ESPAÇO ou TOQUE\n\n' +
      '• ARMA SECUNDÁRIA / MÍSSEIS: TECLA M\n\n' +
      '• HABILIDADE ESPECIAL: TECLA X ou SHIFT (100% de Ressonância)\n\n' +
      '• BOMBA DEVASTADORA: TECLA B ou L (Limpa balas e causa dano de tela)\n\n' +
      '• REINICIAR FASE: TECLA R    |    MENU / PAUSA: ESC',
      {
        fontFamily: FONT_HUD,
        fontSize: '12px',
        color: '#d1e6f5',
        lineSpacing: 4,
      },
    ).setOrigin(0.5, 0);

    const closeBtn = this.add.rectangle(GAME_WIDTH / 2, 312, 140, 28, 0x22485a)
      .setStrokeStyle(1, 0x5eead4).setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(GAME_WIDTH / 2, 305, 'FECHAR [ESC]', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);
    closeBtn.on('pointerdown', () => this.closeModal());

    this.modalContainer = this.add.container(0, 0, [
      overlay, box, title, controls, closeBtn, closeLabel,
    ]).setDepth(50);
  }

  private closeModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = undefined;
    }
  }
}
