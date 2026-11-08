import Phaser from 'phaser';
import { FONT_HUD, FONT_TECH, FONT_TITLE, GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { getPilot, type PilotDefinition } from '../data/pilots';
import { StageBackdrop } from './StageBackdrop';
import { saveSystem } from '../systems/saveSystem.ts';
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
    this.backdrop = new StageBackdrop(this, 5);
    this.previewDistance = 0;

    // Registra vitória definitiva no sistema de salvamento
    saveSystem.recordStageClear(5, this.pilot.id, this.finalScore);

    // Painel Central
    this.add.rectangle(GAME_WIDTH / 2, 70, GAME_WIDTH, 100, 0x050e18, 0.9);

    const victoryTitle = this.add.text(
      GAME_WIDTH / 2,
      22,
      'A MALHA FOI CONTIDA',
      {
        fontFamily: FONT_TITLE,
        fontSize: '28px',
        color: '#00f0ff',
        fontStyle: 'bold',
        letterSpacing: 3,
      },
    ).setOrigin(0.5, 0).setResolution(2);
    victoryTitle.setStroke('#083344', 4);

    this.add.text(
      GAME_WIDTH / 2,
      62,
      'CAMPANHA COMPLETA // O RASTRO DO WAKE SE DISSIPA NO VÁCUO',
      {
        fontFamily: FONT_TECH,
        fontSize: '12px',
        color: '#93c5fd',
        letterSpacing: 2,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    // Nave de caça voando triunfante de perfil no centro
    this.victoryShip = new VectorShip(this, GAME_WIDTH / 2, 160, this.pilot.id);
    this.victoryShip.setScale(1.75);

    // Painel de Epílogo Narrativo do Piloto (fiel à Bíblia docs/01_HISTORIA.md)
    this.add.rectangle(GAME_WIDTH / 2, 260, 640, 115, 0x071320, 0.95)
      .setStrokeStyle(1, 0x1e3a5f);

    this.add.text(
      GAME_WIDTH / 2,
      212,
      `EPÍLOGO // ${this.pilot.name.toUpperCase()} (${this.pilot.shipName.toUpperCase()})`,
      {
        fontFamily: FONT_HUD,
        fontSize: '14px',
        color: '#ffd166',
        fontStyle: 'bold',
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    let epilogueText = '';
    if (this.pilot.id === 'nolan') {
      epilogueText =
        '"Todos os transportes da frota de evacuação confirmaram chegada em segurança.\n' +
        'O corredor se manteve estável após o corte da instrução de conversão.\n' +
        'A colônia sobreviveu. O rastro finalmente silenciou."';
    } else if (this.pilot.id === 'cora') {
      epilogueText =
        '"Sensores registram o colapso do Wake na rede orbital.\n' +
        'A propagação em cascata parou por completo. As cicatrizes de energia\n' +
        'restantes no espaço agora são apenas memória do que quase perdemos."';
    } else {
      epilogueText =
        '"Arquivo recuperado do núcleo: Protocolo de resgate ativado... protejam os civis.\n' +
        'A MALHA não era um inimigo extraterrestre ou invasor; era uma ferramenta\n' +
        'executando uma ordem de proteção esquecida sem prioridade pela vida."';
    }

    this.add.text(
      GAME_WIDTH / 2,
      236,
      epilogueText,
      {
        fontFamily: FONT_TECH,
        fontSize: '12px',
        color: '#e2e8f0',
        align: 'center',
        lineSpacing: 4,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    // Pontuação Final
    this.add.text(
      GAME_WIDTH / 2,
      305,
      `PONTUAÇÃO FINAL DA CAMPANHA: ${this.finalScore.toString().padStart(7, '0')} PONTOS`,
      {
        fontFamily: FONT_HUD,
        fontSize: '14px',
        color: '#00f0ff',
        fontStyle: 'bold',
        letterSpacing: 1,
      },
    ).setOrigin(0.5, 0).setResolution(2);

    // Rodapé com botões de ação
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 22, GAME_WIDTH, 44, 0x050e18, 0.92);

    const menuBtn = this.add.rectangle(GAME_WIDTH / 2 - 130, GAME_HEIGHT - 22, 220, 32, 0x0e7490)
      .setStrokeStyle(1, 0x38bdf8).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2 - 130, GAME_HEIGHT - 22, 'MENU PRINCIPAL [ENTER]', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(2);
    menuBtn.on('pointerdown', () => this.backToMenu());

    const stageSelectBtn = this.add.rectangle(GAME_WIDTH / 2 + 130, GAME_HEIGHT - 22, 220, 32, 0x1e293b)
      .setStrokeStyle(1, 0x475569).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH / 2 + 130, GAME_HEIGHT - 22, 'SELEÇÃO DE FASES [ESC]', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#cbd5e1',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(2);
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
      this.victoryShip.updateShip(delta, 0, true, 0, false);
    }
  }

  private backToMenu(): void {
    this.scene.start('TitleScene');
  }

  private backToStageSelect(): void {
    this.scene.start('StageSelectScene');
  }
}
