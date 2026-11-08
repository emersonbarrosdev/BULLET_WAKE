import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { getPilot, type PilotDefinition } from '../data/pilots';
import { StageBackdrop } from './StageBackdrop';
import { saveSystem } from '../systems/saveSystem.ts';
import { globalAudio } from '../audio/audioSystem.ts';

interface EndingData {
  pilotId: string;
  score: number;
}

export class EndingScene extends Phaser.Scene {
  private pilot: PilotDefinition = getPilot('nolan');
  private finalScore = 0;
  private backdrop!: StageBackdrop;
  private previewDistance = 0;

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
    this.add.rectangle(GAME_WIDTH / 2, 75, GAME_WIDTH, 110, 0x060f18, 0.9);

    const victoryTitle = this.text(
      GAME_WIDTH / 2,
      28,
      'A MALHA FOI CONTIDA',
      32,
      '#7df9ff',
    ).setOrigin(0.5, 0);
    victoryTitle.setStroke('#113848', 4);

    this.text(
      GAME_WIDTH / 2,
      68,
      'CAMPANHA COMPLETA // O RASTRO DO WAKE SE DISSIPA NO VÁCUO',
      14,
      '#d2ebf5',
    ).setOrigin(0.5, 0);

    // Nave voando triunfante no centro
    let shipTexture = 'rivet-v3-idle';
    let shipAnim = 'rivet-v3-idle-anim';
    let shipScale = 1.2;
    if (this.pilot.id === 'cora') {
      shipTexture = 'ship-moth-v2-idle';
      shipAnim = 'moth-v2-idle-anim';
      shipScale = 1.35;
    } else if (this.pilot.id === 'harlan') {
      shipTexture = 'ship-knuckle-v2-idle';
      shipAnim = 'knuckle-v2-idle-anim';
      shipScale = 1.3;
    }
    this.add.sprite(GAME_WIDTH / 2, 165, shipTexture, 0)
      .setScale(shipScale).play(shipAnim);

    // Painel de Epílogo Narrativo do Piloto (fiel à Bíblia docs/01_HISTORIA.md)
    this.add.rectangle(GAME_WIDTH / 2, 260, 640, 115, 0x0c1e2b, 0.94)
      .setStrokeStyle(2, 0x56a6b8);

    this.text(
      GAME_WIDTH / 2,
      212,
      `EPÍLOGO // ${this.pilot.name.toUpperCase()} (${this.pilot.shipName.toUpperCase()})`,
      15,
      '#ffd494',
    ).setOrigin(0.5, 0);

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

    this.text(
      GAME_WIDTH / 2,
      236,
      epilogueText,
      13,
      '#e5f4fa',
    ).setOrigin(0.5, 0);

    // Pontuação Final
    this.text(
      GAME_WIDTH / 2,
      305,
      `PONTUAÇÃO FINAL DA CAMPANHA: ${this.finalScore.toString().padStart(6, '0')} PONTOS`,
      15,
      '#7df9ff',
    ).setOrigin(0.5, 0);

    // Rodapé com botões de ação
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 24, GAME_WIDTH, 48, 0x060f18, 0.92);

    const menuBtn = this.add.rectangle(GAME_WIDTH / 2 - 130, GAME_HEIGHT - 24, 220, 34, 0x1a3848)
      .setStrokeStyle(1, 0x64ded4).setInteractive({ useHandCursor: true });
    this.text(GAME_WIDTH / 2 - 130, GAME_HEIGHT - 32, 'MENU PRINCIPAL [ENTER]', 14, '#ffffff').setOrigin(0.5, 0);
    menuBtn.on('pointerdown', () => this.backToMenu());

    const stageSelectBtn = this.add.rectangle(GAME_WIDTH / 2 + 130, GAME_HEIGHT - 24, 220, 34, 0x244f62)
      .setStrokeStyle(1, 0x7df9ff).setInteractive({ useHandCursor: true });
    this.text(GAME_WIDTH / 2 + 130, GAME_HEIGHT - 32, 'SELEÇÃO DE FASES [ESC]', 14, '#ffffff').setOrigin(0.5, 0);
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
  }

  private backToMenu(): void {
    this.scene.start('TitleScene');
  }

  private backToStageSelect(): void {
    this.scene.start('StageSelectScene');
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
