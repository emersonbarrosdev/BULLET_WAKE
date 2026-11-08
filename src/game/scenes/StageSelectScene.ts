import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
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

    this.backdrop = new StageBackdrop(this, 1);

    // Cabeçalho
    this.add.rectangle(GAME_WIDTH / 2, 45, GAME_WIDTH, 90, 0x081320, 0.88);
    this.text(GAME_WIDTH / 2, 14, 'BULLET WAKE', 28, '#ffffff').setOrigin(0.5, 0);
    this.text(GAME_WIDTH / 2, 48, 'SELEÇÃO DE FASES E COORDENADAS DO WAKE', 15, '#7bf7ea').setOrigin(0.5, 0);

    // Cards horizontais das 5 fases
    const startX = 84;
    const spacingX = 150;
    const cardY = 175;

    STAGES.forEach((stageDef: StageDefinition, index: number) => {
      const x = startX + index * spacingX;
      const unlocked = data.unlockedStages.includes(stageDef.stageNumber);
      const bestScore = data.bestScores[stageDef.stageNumber]?.score || 0;

      const panel = this.add
        .rectangle(x, cardY, 138, 160, unlocked ? 0x132737 : 0x0d161f, 0.94)
        .setStrokeStyle(1, unlocked ? 0x487994 : 0x223544)
        .setInteractive({ useHandCursor: unlocked });

      const title = this.text(
        x,
        cardY - 68,
        `FASE 0${stageDef.stageNumber}`,
        14,
        unlocked ? '#7df9ff' : '#527282',
      ).setOrigin(0.5, 0);

      const subtitle = this.text(
        x,
        cardY - 48,
        stageDef.title.toUpperCase(),
        11,
        unlocked ? '#e5f3fa' : '#698190',
      ).setOrigin(0.5, 0);

      const bossText = this.text(
        x,
        cardY - 10,
        unlocked ? `CHEFE:\n${stageDef.bossName}` : '[BLOQUEADA]',
        10,
        unlocked ? '#ffd79e' : '#885555',
      ).setOrigin(0.5, 0);

      const scoreText = this.text(
        x,
        cardY + 45,
        unlocked ? `RECORDE:\n${bestScore.toString().padStart(6, '0')}` : '---',
        10,
        unlocked ? '#97e8c3' : '#455966',
      ).setOrigin(0.5, 0);

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
    this.add.rectangle(GAME_WIDTH / 2, 310, GAME_WIDTH - 80, 80, 0x0c1b28, 0.92)
      .setStrokeStyle(1, 0x3d6b82);

    this.briefingText = this.text(
      GAME_WIDTH / 2,
      282,
      '',
      13,
      '#dbebf5',
    ).setOrigin(0.5, 0);

    // Rodapé de navegação
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 20, GAME_WIDTH, 40, 0x081320, 0.9);

    const backBtn = this.add.rectangle(120, GAME_HEIGHT - 20, 180, 30, 0x1b3547)
      .setStrokeStyle(1, 0x599bb8).setInteractive({ useHandCursor: true });
    this.text(120, GAME_HEIGHT - 27, 'VOLTAR AO MENU [ESC]', 13, '#ffffff').setOrigin(0.5, 0);
    backBtn.on('pointerdown', () => this.backToMenu());

    const startBtn = this.add.rectangle(GAME_WIDTH - 130, GAME_HEIGHT - 20, 200, 30, 0x245a6c)
      .setStrokeStyle(1, 0x7df9ff).setInteractive({ useHandCursor: true });
    this.text(GAME_WIDTH - 130, GAME_HEIGHT - 27, 'INICIAR MISSÃO [ENTER]', 13, '#ffffff').setOrigin(0.5, 0);
    startBtn.on('pointerdown', () => this.launchStage());

    this.selectStage(0);

    // Teclado
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-LEFT', () => this.moveSelection(-1));
      kb.on('keydown-A', () => this.moveSelection(-1));
      kb.on('keydown-RIGHT', () => this.moveSelection(1));
      kb.on('keydown-D', () => this.moveSelection(1));
      kb.on('keydown-ONE', () => this.selectStage(0));
      kb.on('keydown-TWO', () => this.selectStage(1));
      kb.on('keydown-THREE', () => this.selectStage(2));
      kb.on('keydown-FOUR', () => this.selectStage(3));
      kb.on('keydown-FIVE', () => this.selectStage(4));
      kb.on('keydown-ENTER', () => this.launchStage());
      kb.on('keydown-SPACE', () => this.launchStage());
      kb.on('keydown-ESC', () => this.backToMenu());
    }
  }

  update(_time: number, delta: number): void {
    this.previewDistance += Math.min(delta, 50) * 0.024;
    this.backdrop.update(this.previewDistance);
  }

  private moveSelection(dir: number): void {
    const total = this.cards.length;
    let next = (this.selectedIndex + dir + total) % total;
    while (!this.cards[next].unlocked && next !== this.selectedIndex) {
      next = (next + dir + total) % total;
    }
    this.selectStage(next);
  }

  private selectStage(index: number): void {
    this.selectedIndex = index;
    const stage = STAGES[index];
    this.cards.forEach((card, idx) => {
      const isSelected = idx === index;
      if (card.unlocked) {
        card.panel.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x7df9ff : 0x487994);
        card.panel.setFillStyle(isSelected ? 0x22435b : 0x132737, 0.95);
      }
    });

    this.briefingText.setText(
      `BIOMA: ${stage.biome.toUpperCase()}  |  ALVO HOSTIL: ${stage.bossName.toUpperCase()}\n` +
      `DIRETRIZ: ${stage.briefing}`,
    );
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

  private text(x: number, y: number, value: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, value, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: size + 'px',
        color,
        fontStyle: 'bold',
        align: 'center',
      })
      .setResolution(2);
  }
}
