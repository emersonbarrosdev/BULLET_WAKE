import Phaser from 'phaser';
import { FONT_HUD, FONT_TECH, FONT_TITLE, GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { STAGES, type StageDefinition } from '../data/stages';
import { StageBackdrop } from './StageBackdrop';
import { saveSystem } from '../systems/saveSystem.ts';
import { globalAudio } from '../audio/audioSystem.ts';

interface StageCard {
  panel: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
  bossText: Phaser.GameObjects.Text;
  scoreText: Phaser.GameObjects.Text;
  stageNumber: number;
  unlocked: boolean;
}

export class StageSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private backdrop!: StageBackdrop;
  private previewDistance = 0;
  private cards: StageCard[] = [];
  private briefingText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'StageSelectScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.selectedIndex = 0;
    this.cards = [];
    this.previewDistance = 0;

    const data = saveSystem.getSaveData();

    this.backdrop = new StageBackdrop(this, 1, { fullWidth: true, showBezels: false });

    // Cabeçalho
    this.add.rectangle(GAME_WIDTH / 2, 44, GAME_WIDTH, 84, 0x050e18, 0.88).setDepth(10);
    this.add.text(GAME_WIDTH / 2, 12, 'BULLET WAKE', {
      fontFamily: FONT_TITLE,
      fontSize: '26px',
      color: '#ffffff',
      letterSpacing: 3,
    }).setOrigin(0.5, 0).setResolution(2).setDepth(11);

    this.add.text(GAME_WIDTH / 2, 48, 'COORDENADAS DE MISSÃO E SELEÇÃO DE SETORES', {
      fontFamily: FONT_TECH,
      fontSize: '13px',
      color: '#00f0ff',
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(2).setDepth(11);

    // Cards horizontais das 5 fases
    const startX = 84;
    const spacingX = 150;
    const cardY = 175;

    STAGES.forEach((stageDef: StageDefinition, index: number) => {
      const x = startX + index * spacingX;
      const unlocked = data.unlockedStages.includes(stageDef.stageNumber);
      const bestScore = data.bestScores[stageDef.stageNumber]?.score || 0;

      const panel = this.add
        .rectangle(x, cardY, 138, 160, unlocked ? 0x0c1b2c : 0x081018, 0.94)
        .setStrokeStyle(1, unlocked ? 0x22425e : 0x14212e)
        .setInteractive({ useHandCursor: unlocked })
        .setDepth(10);

      const title = this.add.text(
        x,
        cardY - 68,
        `FASE 0${stageDef.stageNumber}`,
        {
          fontFamily: FONT_TITLE,
          fontSize: '14px',
          fontStyle: 'bold',
          color: unlocked ? '#00f0ff' : '#64748b',
        },
      ).setOrigin(0.5, 0).setResolution(3).setDepth(11);

      const subtitle = this.add.text(
        x,
        cardY - 46,
        stageDef.title.toUpperCase(),
        {
          fontFamily: FONT_TECH,
          fontSize: '12px',
          color: unlocked ? '#ffffff' : '#475569',
          fontStyle: 'bold',
        },
      ).setOrigin(0.5, 0).setResolution(3).setDepth(11);

      const bossText = this.add.text(
        x,
        cardY - 12,
        unlocked ? `CHEFE:\n${stageDef.bossName}` : '[BLOQUEADA]',
        {
          fontFamily: FONT_TECH,
          fontSize: '12px',
          fontStyle: 'bold',
          color: unlocked ? '#facc15' : '#64748b',
          align: 'center',
        },
      ).setOrigin(0.5, 0).setResolution(3).setDepth(11);

      const scoreText = this.add.text(
        x,
        cardY + 40,
        unlocked ? `RECORDE:\n${bestScore.toString().padStart(6, '0')}` : '---',
        {
          fontFamily: FONT_TECH,
          fontSize: '12px',
          fontStyle: 'bold',
          color: unlocked ? '#34d399' : '#475569',
          align: 'center',
        },
      ).setOrigin(0.5, 0).setResolution(3).setDepth(11);

      panel.on('pointerdown', () => {
        if (unlocked) {
          this.selectStage(index);
          this.launchStage();
        }
      });
      panel.on('pointerover', () => {
        if (unlocked) this.selectStage(index);
      });

      this.cards.push({
        panel,
        title,
        subtitle,
        bossText,
        scoreText,
        stageNumber: stageDef.stageNumber,
        unlocked,
      });
    });

    // Painel de Briefing e Inteligência da Missão
    this.add.rectangle(GAME_WIDTH / 2, 310, GAME_WIDTH - 80, 80, 0x071320, 0.94)
      .setStrokeStyle(1, 0x1e3a5f).setDepth(10);

    this.briefingText = this.add.text(
      GAME_WIDTH / 2,
      282,
      '',
      {
        fontFamily: FONT_TECH,
        fontSize: '12px',
        color: '#93c5fd',
        align: 'center',
      },
    ).setOrigin(0.5, 0).setResolution(2).setDepth(11);

    // Rodapé de navegação
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 22, GAME_WIDTH, 44, 0x050e18, 0.92).setDepth(10);

    const backBtn = this.add.rectangle(130, GAME_HEIGHT - 22, 190, 32, 0x1e293b)
      .setStrokeStyle(1, 0x475569).setInteractive({ useHandCursor: true }).setDepth(11);
    this.add.text(130, GAME_HEIGHT - 22, 'VOLTAR AO MENU [ESC]', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#94a3b8',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(2).setDepth(12);
    backBtn.on('pointerdown', () => this.backToMenu());

    const startBtn = this.add.rectangle(GAME_WIDTH - 140, GAME_HEIGHT - 22, 210, 32, 0x0e7490)
      .setStrokeStyle(1, 0x38bdf8).setInteractive({ useHandCursor: true }).setDepth(11);
    this.add.text(GAME_WIDTH - 140, GAME_HEIGHT - 22, 'INICIAR MISSÃO [ENTER]', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(2).setDepth(12);
    startBtn.on('pointerdown', () => this.launchStage());

    this.selectStage(0);

    // Teclado
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-LEFT', () => this.moveSelection(-1));
      kb.on('keydown-RIGHT', () => this.moveSelection(1));
      kb.on('keydown-ENTER', () => this.launchStage());
      kb.on('keydown-SPACE', () => this.launchStage());
      kb.on('keydown-ESC', () => this.backToMenu());
    }
  }

  update(_time: number, delta: number): void {
    this.previewDistance += Math.min(delta, 50) * 0.026;
    this.backdrop.update(this.previewDistance);
  }

  private moveSelection(dir: number): void {
    const next = (this.selectedIndex + dir + STAGES.length) % STAGES.length;
    this.selectStage(next);
  }

  private selectStage(index: number): void {
    this.selectedIndex = index;
    const stageDef = STAGES[index];
    const card = this.cards[index];

    this.cards.forEach((c, idx) => {
      const isSelected = idx === index;
      if (c.unlocked) {
        c.panel.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x00f0ff : 0x22425e);
        c.panel.setFillStyle(isSelected ? 0x16304a : 0x0c1b2c, 0.95);
      }
    });

    if (card && card.unlocked) {
      this.briefingText.setText(
        `BRIEFING DE COMBATE // FASE 0${stageDef.stageNumber}: ${stageDef.title.toUpperCase()}\n` +
        `BIOMA: ${stageDef.biome.toUpperCase()}  |  ALVO PRIMÁRIO: ${stageDef.bossName.toUpperCase()}\n` +
        `RELATÓRIO: Setor hostil ativo com patrulhas pesadas e armamentos de área.`,
      );
    } else {
      this.briefingText.setText(
        `COORDENADAS BLOQUEADAS // CONCLUA AS FASES ANTERIORES PARA SINTONIZAR O SINAL DE RASTRO.`,
      );
    }
  }

  private launchStage(): void {
    const card = this.cards[this.selectedIndex];
    if (!card || !card.unlocked) return;
    globalAudio.playPickup('upgrade');
    this.scene.start('PilotSelectScene', { stageNumber: card.stageNumber });
  }

  private backToMenu(): void {
    this.scene.start('TitleScene');
  }
}
