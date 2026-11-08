import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH, FONT_TITLE, FONT_HUD } from '../constants';
import { StageBackdrop } from './StageBackdrop';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { globalAudio } from '../audio/audioSystem.ts';
import { saveSystem } from '../systems/saveSystem.ts';

interface MenuItem {
  text: string;
  badge?: string;
  isPrimary?: boolean;
  action: () => void;
}

/**
 * Menu principal tático do BULLET WAKE (docs/24_DIRETRIZ_UI_HUD_MENUS.md).
 * Transmite atmosfera de ficção militar, centro de operações e arcade premium.
 * Destaque visual evidente para a ação principal e estados de interação limpos.
 */
export class TitleScene extends Phaser.Scene {
  private backdrop!: StageBackdrop;
  private previewDistance = 0;
  private selectedIndex = 0;
  private menuItems: MenuItem[] = [];
  private menuButtons: {
    bg: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    border: Phaser.GameObjects.Rectangle;
    isPrimary?: boolean;
  }[] = [];
  private modalContainer?: Phaser.GameObjects.Container;
  private glowTimer = 0;
  private titleGlow!: Phaser.GameObjects.Text;
  private primaryGlow?: Phaser.GameObjects.Rectangle;

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

    // Fundo de vinheta de centro de comando
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x040b15, 0.48);

    // Barra superior de status da operação militar
    this.add.rectangle(GAME_WIDTH / 2, 10, GAME_WIDTH, 20, 0x050e18, 0.9);
    this.add.text(
      GAME_WIDTH / 2,
      4,
      'COMANDO DE DEFESA ORBITAL  //  PROTOCOLO WAKE INICIADO  //  SISTEMA ESTÁVEL [60-240 FPS]',
      {
        fontFamily: FONT_HUD,
        fontSize: '10px',
        color: '#64748b',
        letterSpacing: 2,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    // Moldura cibernética do Título com linhas duplas
    this.add.rectangle(GAME_WIDTH / 2, 75, 620, 94, 0x071322, 0.92)
      .setStrokeStyle(1.5, 0x1f3c4d);
    this.add.rectangle(GAME_WIDTH / 2, 75, 628, 102, 0x00f0ff, 0.1)
      .setStrokeStyle(1, 0x00f0ff, 0.3);

    // Efeito de brilho neon no título
    this.titleGlow = this.add.text(GAME_WIDTH / 2, 38, 'BULLET WAKE', {
      fontFamily: FONT_TITLE,
      fontSize: '40px',
      color: '#00f0ff',
    }).setOrigin(0.5, 0).setAlpha(0.35);

    this.add.text(GAME_WIDTH / 2, 38, 'BULLET WAKE', {
      fontFamily: FONT_TITLE,
      fontSize: '40px',
      color: '#ffffff',
    }).setOrigin(0.5, 0).setStroke('#0a1d2e', 5);

    this.add.text(
      GAME_WIDTH / 2,
      88,
      'EVERY SHOT LEAVES A TRACE',
      {
        fontFamily: FONT_HUD,
        fontSize: '13px',
        color: '#00f0ff',
        letterSpacing: 4,
      },
    ).setOrigin(0.5, 0);

    this.add.text(
      GAME_WIDTH / 2,
      107,
      'FASE 01: FENDA PELÁGICA  //  INVASÃO ALIENÍGENA ABISSAL',
      {
        fontFamily: FONT_HUD,
        fontSize: '10px',
        color: '#94a3b8',
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0);

    // Itens de Menu (com ação principal em destaque absoluto)
    this.menuItems = [
      {
        text: 'INICIAR MISSÃO: FENDA PELÁGICA',
        badge: '[ESPAÇO / ENTER]',
        isPrimary: true,
        action: () => this.startStage1(),
      },
      {
        text: 'SELEÇÃO DE PILOTOS DE COMBATE',
        badge: '[P]',
        action: () => this.openPilotSelect(),
      },
      {
        text: 'COORDENADAS DE FASES & CAMPANHA',
        badge: '[S]',
        action: () => this.openStageSelect(),
      },
      {
        text: 'CONFIGURAÇÕES DE ÁUDIO & TAXA DE QUADROS',
        badge: '[C]',
        action: () => this.openSettingsModal(),
      },
      {
        text: 'CONTROLES DE VOO & MANUAL TÁTICO',
        badge: '[H]',
        action: () => this.openControlsModal(),
      },
    ];

    const startY = 168;

    this.menuItems.forEach((item, index) => {
      const isPrimary = Boolean(item.isPrimary);
      const y = isPrimary ? startY : startY + 44 + (index - 1) * 34;
      const width = isPrimary ? 480 : 440;
      const height = isPrimary ? 38 : 28;

      if (isPrimary) {
        this.primaryGlow = this.add
          .rectangle(GAME_WIDTH / 2, y, width + 6, height + 6, 0x00f0ff, 0.15)
          .setStrokeStyle(1.5, 0x00f0ff, 0.6);
      }

      const bg = this.add
        .rectangle(GAME_WIDTH / 2, y, width, height, isPrimary ? 0x0d2838 : 0x081320, 0.94)
        .setStrokeStyle(isPrimary ? 2 : 1, isPrimary ? 0x00f0ff : 0x1f3c4d)
        .setInteractive({ useHandCursor: true });

      const border = this.add
        .rectangle(GAME_WIDTH / 2 - width / 2 + 3, y, 3.5, height - 6, isPrimary ? 0x00f0ff : 0x38bdf8)
        .setVisible(index === 0);

      const label = this.add.text(
        GAME_WIDTH / 2 - width / 2 + 18,
        y - (isPrimary ? 8 : 7),
        item.text,
        {
          fontFamily: isPrimary ? FONT_TITLE : FONT_HUD,
          fontSize: isPrimary ? '13px' : '12px',
          color: isPrimary ? '#ffffff' : '#94a3b8',
          letterSpacing: 1,
        },
      ).setResolution(2);

      if (item.badge) {
        this.add.text(
          GAME_WIDTH / 2 + width / 2 - 16,
          y - (isPrimary ? 8 : 7),
          item.badge,
          {
            fontFamily: FONT_HUD,
            fontSize: isPrimary ? '12px' : '11px',
            color: isPrimary ? '#ffd166' : '#38bdf8',
            fontStyle: 'bold',
          },
        ).setOrigin(1, 0).setResolution(2);
      }

      bg.on('pointerover', () => this.selectItem(index));
      bg.on('pointerdown', () => this.activateItem(index));

      this.menuButtons.push({ bg, label, border, isPrimary });
    });

    // Rodapé de navegação e ajuda
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 16, GAME_WIDTH, 32, 0x050e18, 0.96);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 32, GAME_WIDTH, 1.5, 0x1f3c4d);
    this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 22,
      'W / S / SETAS: NAVEGAR   |   ENTER / ESPAÇO: CONFIRMAR   |   P: PILOTOS   |   C: CONFIGURAÇÕES',
      {
        fontFamily: FONT_HUD,
        fontSize: '11px',
        color: '#64748b',
      },
    ).setOrigin(0.5, 0).setResolution(2);

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

    // Pulso neon suave no título e no botão primário
    this.glowTimer += delta * 0.003;
    if (this.titleGlow) {
      this.titleGlow.setAlpha(0.25 + Math.sin(this.glowTimer) * 0.15);
    }
    if (this.primaryGlow) {
      this.primaryGlow.setAlpha(0.12 + Math.sin(this.glowTimer * 1.5) * 0.08);
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
      if (btn.isPrimary) {
        btn.bg.setStrokeStyle(isSelected ? 2 : 1.5, isSelected ? 0x00f0ff : 0x0284c7);
        btn.bg.setFillStyle(isSelected ? 0x14405a : 0x0d2838, 0.96);
        btn.label.setColor('#ffffff');
      } else {
        btn.bg.setStrokeStyle(isSelected ? 1.5 : 1, isSelected ? 0x00f0ff : 0x1f3c4d);
        btn.bg.setFillStyle(isSelected ? 0x122438 : 0x081320, 0.94);
        btn.label.setColor(isSelected ? '#ffffff' : '#94a3b8');
      }
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
    const currentDiff = data.settings.difficulty || 'normal';
    const diffLabels = {
      normal: 'NORMAL (EQUILIBRADO ARCADE)',
      hard: 'DIFÍCIL (ALTA DENSIDADE)',
      arcade: 'ARCADE EXPERT (LEQUE QUÍNTUPLO)',
    };

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x040a12, 0.88);
    const box = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 310, 0x081320)
      .setStrokeStyle(1.5, 0x00f0ff);

    const title = this.add.text(GAME_WIDTH / 2, 80, 'CONFIGURAÇÕES & TAXA DE QUADROS', {
      fontFamily: FONT_TITLE,
      fontSize: '18px',
      color: '#00f0ff',
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(2);

    const sfxBtn = this.add.rectangle(GAME_WIDTH / 2, 130, 420, 30, 0x122438)
      .setStrokeStyle(1, 0x1f3c4d).setInteractive({ useHandCursor: true });
    const sfxLabel = this.add.text(GAME_WIDTH / 2, 130, `EFEITOS SONOROS (SFX): ${currentSfx ? 'ATIVADO' : 'MUTADO'}`, {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5).setResolution(2);

    sfxBtn.on('pointerdown', () => {
      const next = !saveSystem.getSaveData().settings.sfxVolume;
      saveSystem.updateSettings({ sfxVolume: next ? 1 : 0 });
      sfxLabel.setText(`EFEITOS SONOROS (SFX): ${next ? 'ATIVADO' : 'MUTADO'}`);
    });

    const bgmBtn = this.add.rectangle(GAME_WIDTH / 2, 170, 420, 30, 0x122438)
      .setStrokeStyle(1, 0x1f3c4d).setInteractive({ useHandCursor: true });
    const bgmLabel = this.add.text(GAME_WIDTH / 2, 170, `MÚSICA RETRO-SYNTH: ${currentBgm ? 'ATIVADO' : 'MUTADO'}`, {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffffff',
    }).setOrigin(0.5).setResolution(2);

    bgmBtn.on('pointerdown', () => {
      const next = !saveSystem.getSaveData().settings.musicVolume;
      saveSystem.updateSettings({ musicVolume: next ? 1 : 0 });
      bgmLabel.setText(`MÚSICA RETRO-SYNTH: ${next ? 'ATIVADO' : 'MUTADO'}`);
      if (!next) globalAudio.stopMusic();
    });

    const diffBtn = this.add.rectangle(GAME_WIDTH / 2, 210, 420, 30, 0x162c45)
      .setStrokeStyle(1, 0x38bdf8).setInteractive({ useHandCursor: true });
    const diffLabel = this.add.text(GAME_WIDTH / 2, 210, `DIFICULDADE: ${diffLabels[currentDiff]}`, {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffd166',
      fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(2);

    diffBtn.on('pointerdown', () => {
      const cur = saveSystem.getSaveData().settings.difficulty || 'normal';
      const order = ['normal', 'hard', 'arcade'] as const;
      const nextIdx = (order.indexOf(cur as any) + 1) % order.length;
      const nextDiff = order[nextIdx];
      saveSystem.updateSettings({ difficulty: nextDiff });
      diffLabel.setText(`DIFICULDADE: ${diffLabels[nextDiff]}`);
      globalAudio.playPickup('upgrade');
    });

    const fpsHint = this.add.text(
      GAME_WIDTH / 2,
      245,
      'SUPORTE A TAXAS DE QUADROS DESBLOQUEADAS: 60Hz / 120Hz / 144Hz / 240Hz',
      {
        fontFamily: FONT_HUD,
        fontSize: '11px',
        color: '#38bdf8',
      },
    ).setOrigin(0.5, 0).setResolution(2);

    const closeBtn = this.add.rectangle(GAME_WIDTH / 2, 280, 140, 26, 0x0e7490)
      .setStrokeStyle(1, 0x00f0ff).setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(GAME_WIDTH / 2, 280, 'FECHAR [ESC]', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(2);
    closeBtn.on('pointerdown', () => this.closeModal());

    this.modalContainer = this.add.container(0, 0, [
      overlay, box, title, sfxBtn, sfxLabel, bgmBtn, bgmLabel, diffBtn, diffLabel, fpsHint, closeBtn, closeLabel,
    ]).setDepth(50);
  }

  private openControlsModal(): void {
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x040a12, 0.88);
    const box = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 310, 0x081320)
      .setStrokeStyle(1.5, 0x00f0ff);

    const title = this.add.text(GAME_WIDTH / 2, 75, 'CONTROLES DE VOO & COMBATE', {
      fontFamily: FONT_TITLE,
      fontSize: '18px',
      color: '#00f0ff',
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(2);

    const controls = this.add.text(
      GAME_WIDTH / 2,
      105,
      '• MOVIMENTAÇÃO: W/A/S/D ou SETAS (Voo vertical top-down, diagonais normalizadas)\n' +
      '• DISPARO PRINCIPAL: BARRA DE ESPAÇO (Contínuo mantendo ou burst com tapping)\n' +
      '• DASH DE EMERGÊNCIA: SHIFT ESQUERDO (Exatamente 3 por fase, invulnerabilidade curta)\n' +
      '• DISPARO CARREGADO (WAVE CANNON): TECLA C (Segurar e soltar feixe penetrante)\n' +
      '• ARMA SECUNDÁRIA / MÍSSEIS: TECLA M\n' +
      '• HABILIDADE ESPECIAL: TECLA V (Requer 100% de Ressonância)\n' +
      '• BOMBA DEFENSIVA: TECLA X ou B (Limpa balas da tela e causa dano massivo)\n' +
      '• REINICIAR: TECLA R    |    MENU / PAUSA: TECLA ESC\n\n' +
      '※ NO PC: MOUSE ATIVO EXCLUSIVAMENTE NOS MENUS DE INTERFACE',
      {
        fontFamily: FONT_HUD,
        fontSize: '11px',
        color: '#e2e8f0',
        lineSpacing: 3,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    const closeBtn = this.add.rectangle(GAME_WIDTH / 2, 312, 140, 28, 0x0e7490)
      .setStrokeStyle(1, 0x00f0ff).setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(GAME_WIDTH / 2, 312, 'FECHAR [ESC]', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setResolution(2);
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
