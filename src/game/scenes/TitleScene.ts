import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { StageBackdrop } from './StageBackdrop';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { globalAudio } from '../audio/audioSystem.ts';
import { saveSystem } from '../systems/saveSystem.ts';

interface MenuItem {
  text: string;
  action: () => void;
}

export class TitleScene extends Phaser.Scene {
  private backdrop!: StageBackdrop;
  private previewDistance = 0;
  private selectedIndex = 0;
  private menuItems: MenuItem[] = [];
  private menuButtons: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private modalContainer?: Phaser.GameObjects.Container;

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

    // Título e Tagline
    this.add.rectangle(GAME_WIDTH / 2, 85, GAME_WIDTH, 140, 0x07111c, 0.85);

    const title = this.text(GAME_WIDTH / 2, 38, 'BULLET WAKE', 44, '#ffffff').setOrigin(0.5, 0);
    title.setStroke('#1c4250', 6);

    const tagline = this.text(
      GAME_WIDTH / 2,
      92,
      'EVERY SHOT LEAVES A TRACE',
      15,
      '#7bf7ea',
    ).setOrigin(0.5, 0);
    tagline.setLetterSpacing(4);

    this.text(
      GAME_WIDTH / 2,
      116,
      'SHOOT \'EM UP 2D HORIZONTAL // VERSÃO COMPLETA',
      12,
      '#8fbcd4',
    ).setOrigin(0.5, 0);

    // Itens de Menu
    this.menuItems = [
      {
        text: 'INICIAR CAMPANHA [ENTER]',
        action: () => this.startCampaign(),
      },
      {
        text: 'SELEÇÃO DE FASES (1 - 5)',
        action: () => this.openStageSelect(),
      },
      {
        text: 'CONFIGURAÇÕES DE ÁUDIO',
        action: () => this.openSettingsModal(),
      },
      {
        text: 'REGISTROS & CRÉDITOS',
        action: () => this.openCreditsModal(),
      },
    ];

    const startY = 185;
    const itemHeight = 44;

    this.menuItems.forEach((item, index) => {
      const y = startY + index * itemHeight;
      const bg = this.add
        .rectangle(GAME_WIDTH / 2, y, 360, 36, 0x112130, 0.92)
        .setStrokeStyle(1, 0x3b667e)
        .setInteractive({ useHandCursor: true });

      const label = this.text(GAME_WIDTH / 2, y - 9, item.text, 15, '#d0e5f2').setOrigin(0.5, 0);

      bg.on('pointerover', () => this.selectItem(index));
      bg.on('pointerdown', () => this.activateItem(index));

      this.menuButtons.push({ bg, label });
    });

    // Rodapé
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 20, GAME_WIDTH, 40, 0x091420, 0.9);
    this.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 28,
      'W/S OU SETAS: NAVEGAR   |   ENTER / ESPAÇO: SELECIONAR   |   ESC: VOLTAR',
      12,
      '#7ea2b7',
    ).setOrigin(0.5, 0);

    this.selectItem(0);

    // Controles de teclado
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-UP', () => {
        if (this.modalContainer) return;
        this.selectItem((this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length);
      });
      kb.on('keydown-W', () => {
        if (this.modalContainer) return;
        this.selectItem((this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length);
      });
      kb.on('keydown-DOWN', () => {
        if (this.modalContainer) return;
        this.selectItem((this.selectedIndex + 1) % this.menuItems.length);
      });
      kb.on('keydown-S', () => {
        if (this.modalContainer) return;
        this.selectItem((this.selectedIndex + 1) % this.menuItems.length);
      });
      kb.on('keydown-ENTER', () => {
        if (this.modalContainer) {
          this.closeModal();
          return;
        }
        this.activateItem(this.selectedIndex);
      });
      kb.on('keydown-SPACE', () => {
        if (this.modalContainer) {
          this.closeModal();
          return;
        }
        this.activateItem(this.selectedIndex);
      });
      kb.on('keydown-ESC', () => {
        if (this.modalContainer) {
          this.closeModal();
        }
      });
    }
  }

  update(_time: number, delta: number): void {
    this.previewDistance += Math.min(delta, 50) * 0.024;
    this.backdrop.update(this.previewDistance);
  }

  private selectItem(index: number): void {
    this.selectedIndex = index;
    this.menuButtons.forEach((btn, idx) => {
      const isSelected = idx === index;
      btn.bg.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x7df9ff : 0x3b667e);
      btn.bg.setFillStyle(isSelected ? 0x1f3c4d : 0x112130, 0.95);
      btn.label.setColor(isSelected ? '#ffffff' : '#c0dceb');
    });
  }

  private activateItem(index: number): void {
    globalAudio.playPickup('upgrade');
    this.menuItems[index].action();
  }

  private startCampaign(): void {
    this.scene.start('PilotSelectScene', { stageNumber: 1 });
  }

  private openStageSelect(): void {
    this.scene.start('StageSelectScene');
  }

  private openSettingsModal(): void {
    const data = saveSystem.getSaveData();
    const currentSfx = data.settings.sfxVolume > 0;
    const currentBgm = data.settings.musicVolume > 0;

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050c14, 0.85);
    const box = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 480, 260, 0x102130).setStrokeStyle(2, 0x64ded4);

    const title = this.text(GAME_WIDTH / 2, 105, 'CONFIGURAÇÕES', 24, '#7bf7ea').setOrigin(0.5, 0);

    const sfxBtn = this.add.rectangle(GAME_WIDTH / 2, 170, 340, 36, 0x1a3344)
      .setStrokeStyle(1, 0x5da8be).setInteractive({ useHandCursor: true });
    const sfxLabel = this.text(GAME_WIDTH / 2, 160, `EFEITOS SONOROS (SFX): ${currentSfx ? 'LIGADO' : 'MUTADO'}`, 15, '#ffffff').setOrigin(0.5, 0);

    sfxBtn.on('pointerdown', () => {
      const next = !saveSystem.getSaveData().settings.sfxVolume;
      saveSystem.updateSettings({ sfxVolume: next ? 1 : 0 });
      sfxLabel.setText(`EFEITOS SONOROS (SFX): ${next ? 'LIGADO' : 'MUTADO'}`);
    });

    const bgmBtn = this.add.rectangle(GAME_WIDTH / 2, 220, 340, 36, 0x1a3344)
      .setStrokeStyle(1, 0x5da8be).setInteractive({ useHandCursor: true });
    const bgmLabel = this.text(GAME_WIDTH / 2, 210, `MÚSICA RETRO-SYNTH: ${currentBgm ? 'LIGADO' : 'MUTADO'}`, 15, '#ffffff').setOrigin(0.5, 0);

    bgmBtn.on('pointerdown', () => {
      const next = !saveSystem.getSaveData().settings.musicVolume;
      saveSystem.updateSettings({ musicVolume: next ? 1 : 0 });
      bgmLabel.setText(`MÚSICA RETRO-SYNTH: ${next ? 'LIGADO' : 'MUTADO'}`);
      if (!next) {
        globalAudio.stopMusic();
      }
    });

    const closeBtn = this.add.rectangle(GAME_WIDTH / 2, 280, 160, 32, 0x22485a)
      .setStrokeStyle(1, 0x76eae0).setInteractive({ useHandCursor: true });
    const closeLabel = this.text(GAME_WIDTH / 2, 272, 'FECHAR [ESC]', 14, '#ffffff').setOrigin(0.5, 0);
    closeBtn.on('pointerdown', () => this.closeModal());

    this.modalContainer = this.add.container(0, 0, [
      overlay, box, title, sfxBtn, sfxLabel, bgmBtn, bgmLabel, closeBtn, closeLabel,
    ]).setDepth(50);
  }

  private openCreditsModal(): void {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050c14, 0.88);
    const box = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 600, 320, 0x102130).setStrokeStyle(2, 0x64ded4);

    const title = this.text(GAME_WIDTH / 2, 70, 'REGISTROS DO WAKE & CRÉDITOS', 22, '#7bf7ea').setOrigin(0.5, 0);

    const logline = this.text(
      GAME_WIDTH / 2,
      110,
      'O espaço registra um rastro antes de registrar o movimento que o produziu.\nAo segui-lo, três pilotos descobrem que a arma mais perigosa não é uma frota,\nmas um sistema de proteção que esqueceu o que deveria proteger.',
      13,
      '#dbebf5',
    ).setOrigin(0.5, 0);

    const pilots = this.text(
      GAME_WIDTH / 2,
      180,
      'PILOTOS DA COLÔNIA:\n- Nolan Fitch (Rivet V3): Disparos rápidos, Tempestade Prismática\n- Cora Wren (Moth V2): Agilidade e evasão, Salto Fantasma\n- Harlan Greer (Knuckle V2): Poder de fogo bruto, Ruptura Nova',
      12,
      '#a2cbdd',
    ).setOrigin(0.5, 0);

    const credits = this.text(
      GAME_WIDTH / 2,
      250,
      'BULLET WAKE © 2026 // Desenvolvido com Phaser 4, TypeScript & Web Audio Procedural',
      11,
      '#6aa0bc',
    ).setOrigin(0.5, 0);

    const closeBtn = this.add.rectangle(GAME_WIDTH / 2, 310, 160, 32, 0x22485a)
      .setStrokeStyle(1, 0x76eae0).setInteractive({ useHandCursor: true });
    const closeLabel = this.text(GAME_WIDTH / 2, 302, 'FECHAR [ESC]', 14, '#ffffff').setOrigin(0.5, 0);
    closeBtn.on('pointerdown', () => this.closeModal());

    this.modalContainer = this.add.container(0, 0, [
      overlay, box, title, logline, pilots, credits, closeBtn, closeLabel,
    ]).setDepth(50);
  }

  private closeModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = undefined;
    }
  }

  private text(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, value, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: size + 'px',
        color,
        fontStyle: 'bold',
      })
      .setResolution(2);
  }
}
