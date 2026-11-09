import Phaser from 'phaser';
import { FONT_HUD, FONT_TECH, FONT_TITLE, GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { getPilot, type PilotDefinition } from '../data/pilots';
import { StageBackdrop } from './StageBackdrop';
import { globalAudio } from '../audio/audioSystem.ts';
import { VectorShip } from '../render/VectorShip';

interface EndingData {
  pilotId: string;
  score: number;
}

export class EndingScene extends Phaser.Scene {
  private pilot: PilotDefinition = getPilot('nolan');
  private finalScore = 0;
  private backdrop!: StageBackdrop;
  private previewDistance = 0;
  private victoryShip?: VectorShip;

  constructor() {
    super({ key: 'EndingScene' });
  }

  init(data: EndingData): void {
    this.pilot = getPilot(data.pilotId || 'nolan');
    this.finalScore = data.score || 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.backdrop = new StageBackdrop(this, 1, { fullWidth: true, showBezels: false });
    this.previewDistance = 0;

    // The combat scene already records the actual cleared stage.

    // Painel Central
    this.add.rectangle(GAME_WIDTH / 2, 70, GAME_WIDTH, 100, 0x050e18, 0.9);

    const victoryTitle = this.add.text(
      GAME_WIDTH / 2,
      22,
      'FENDA PELÁGICA ESTABILIZADA',
      {
        fontFamily: FONT_TITLE,
        fontSize: '26px',
        color: '#00f0ff',
        fontStyle: 'bold',
        letterSpacing: 2,
      },
    ).setOrigin(0.5, 0).setResolution(3);
    victoryTitle.setStroke('#083344', 4);

    this.add.text(
      GAME_WIDTH / 2,
      62,
      'VITÓRIA NA FASE 01 // ENTIDADE ALIENÍGENA TALASSARCA ABATIDA',
      {
        fontFamily: FONT_TECH,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#93c5fd',
        letterSpacing: 1.5,
      },
    ).setOrigin(0.5, 0).setResolution(3);

    // Nave de caça voando triunfante de perfil no centro
    this.victoryShip = new VectorShip(this, GAME_WIDTH / 2, 160, this.pilot.id, 'profile');
    this.victoryShip.setScale(1.75);

    // Painel de Epílogo Narrativo do Piloto (fiel à Bíblia V2 — Invasão Extraterrestre)
    this.add.rectangle(GAME_WIDTH / 2, 260, 640, 115, 0x071320, 0.95)
      .setStrokeStyle(1.5, 0x1e3a5f);

    this.add.text(
      GAME_WIDTH / 2,
      210,
      `RELATÓRIO DE OPERAÇÃO // ${this.pilot.name.toUpperCase()} (${this.pilot.shipName.toUpperCase()})`,
      {
        fontFamily: FONT_HUD,
        fontSize: '14px',
        color: '#fde047',
        fontStyle: 'bold',
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0).setResolution(3);

    let epilogueText = '';
    if (this.pilot.id === 'nolan') {
      epilogueText =
        '"O núcleo bioelétrico de Talassarca colapsou nas profundezas da Fenda Pelágica.\n' +
        'Os enxames de parasitas abissais perderam a coordenação sináptica no setor oceânico.\n' +
        'A costa está segura por enquanto — mas a invasão extraterrestre apenas começou."';
    } else if (this.pilot.id === 'cora') {
      epilogueText =
        '"Sensores confirmam a neutralização do Leviatã alienígena Talassarca.\n' +
        'Os casulos submarinos cessaram a incubação de organismos hostis na fenda.\n' +
        'Retornando à base orbital para rearmamento e análise da bio-colmeia."';
    } else {
      epilogueText =
        '"Blindagem intacta e ameaça colossal abatida no fundo da Fenda Pelágica.\n' +
        'As forças invasoras extraterrestres recuaram das águas costeiras após a queda\n' +
        'de Talassarca. Seguiremos o rastro energético até a origem do enxame."';
    }

    this.add.text(
      GAME_WIDTH / 2,
      235,
      epilogueText,
      {
        fontFamily: FONT_TECH,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#f8fafc',
        align: 'center',
        lineSpacing: 4,
      },
    ).setOrigin(0.5, 0).setResolution(3);

    // Pontuação Final
    this.add.text(
      GAME_WIDTH / 2,
      305,
      `PONTUAÇÃO FINAL DA OPERAÇÃO: ${this.finalScore.toString().padStart(7, '0')} PONTOS`,
      {
        fontFamily: FONT_HUD,
        fontSize: '15px',
        color: '#00f0ff',
        fontStyle: 'bold',
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0).setResolution(3);

    // Rodapé com botões de ação
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 22, GAME_WIDTH, 44, 0x050e18, 0.92);

    const menuBtn = this.add.rectangle(GAME_WIDTH / 2 - 130, GAME_HEIGHT - 22, 224, 32, 0x0e7490)
      .setStrokeStyle(1.5, 0x38bdf8).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2 - 130, GAME_HEIGHT - 22, 'MENU PRINCIPAL [ENTER]', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(3);
    menuBtn.on('pointerdown', () => this.backToMenu());

    const stageSelectBtn = this.add.rectangle(GAME_WIDTH / 2 + 130, GAME_HEIGHT - 22, 224, 32, 0x1e293b)
      .setStrokeStyle(1.5, 0x475569).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2 + 130, GAME_HEIGHT - 22, 'SELEÇÃO DE FASES [ESC]', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      color: '#e2e8f0',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(3);
    stageSelectBtn.on('pointerdown', () => this.backToStageSelect());

    // Teclado
    const kb = this.input.keyboard;
    if (kb) {
      kb.on('keydown-ENTER', () => this.backToMenu());
      kb.on('keydown-SPACE', () => this.backToMenu());
      kb.on('keydown-ESC', () => this.backToStageSelect());
    }

    // Feedback sonoro de vitória
    globalAudio.playPickup('upgrade');
  }

  update(_time: number, delta: number): void {
    this.previewDistance += Math.min(delta, 50) * 0.035;
    this.backdrop.update(this.previewDistance);
    if (this.victoryShip) {
      this.victoryShip.updateShip(delta, 0, 0, 0, false);
    }
  }

  private backToMenu(): void {
    this.scene.start('TitleScene');
  }

  private backToStageSelect(): void {
    this.scene.start('StageSelectScene');
  }
}
