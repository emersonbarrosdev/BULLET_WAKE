import Phaser from 'phaser';
import { FONT_HUD, FONT_TITLE, GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { PILOTS, type PilotDefinition } from '../data/pilots';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { StageBackdrop } from './StageBackdrop';
import { VectorShip } from '../render/VectorShip';
import { globalAudio } from '../audio/audioSystem';

type MenuKeys = Record<
  'LEFT' | 'RIGHT' | 'ENTER' | 'SPACE' | 'ONE' | 'TWO' | 'THREE' | 'ESC',
  Phaser.Input.Keyboard.Key
>;

interface PilotCardUI {
  panel: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  callsignText: Phaser.GameObjects.Text;
  portrait: Phaser.GameObjects.Sprite;
  portraitFrame: Phaser.GameObjects.Rectangle;
  shipVisual: VectorShip;
}

/**
 * Tela oficial de Seleção de Pilotos do BULLET WAKE (espírito Sonic Wings / Aero Fighters).
 * Dá protagonismo aos operadores humanos com retratos em pixel art, callsigns táticos,
 * especial característico e a aeronave apresentada em perfil de forma subordinada.
 */
export class PilotSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private stageNumber = 1;
  private keys?: MenuKeys;
  private cards: PilotCardUI[] = [];
  private shipVisuals: VectorShip[] = [];
  private briefingText!: Phaser.GameObjects.Text;
  private specialDetailText!: Phaser.GameObjects.Text;
  private backdrop!: StageBackdrop;
  private previewDistance = 0;

  constructor() {
    super({ key: 'PilotSelectScene' });
  }

  init(data: { selectedPilotId?: string; stageNumber?: number } = {}): void {
    this.selectedIndex = Math.max(0, PILOTS.findIndex(p => p.id === data.selectedPilotId));
    this.stageNumber = data.stageNumber || 1;
  }

  preload(): void {
    loadGameSprites(this);
  }

  create(): void {
    registerGameAnimations(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.backdrop = new StageBackdrop(this, this.stageNumber);
    this.previewDistance = 0;
    this.cards = [];
    this.shipVisuals = [];
    this.keys = this.input.keyboard?.addKeys('LEFT,RIGHT,ENTER,SPACE,ONE,TWO,THREE,ESC') as MenuKeys | undefined;

    // Cabeçalho militar de inteligência tática (Zona Superior)
    this.add.rectangle(GAME_WIDTH / 2, 38, GAME_WIDTH, 68, 0x050e18, 0.92);
    this.add.rectangle(GAME_WIDTH / 2, 71, GAME_WIDTH, 1.5, 0x1f3c4d);

    this.add.text(GAME_WIDTH / 2, 10, 'BULLET WAKE // CENTRO DE OPERAÇÕES', {
      fontFamily: FONT_TITLE,
      fontSize: '20px',
      color: '#ffffff',
      letterSpacing: 3,
    }).setOrigin(0.5, 0).setResolution(2);

    this.add.text(GAME_WIDTH / 2, 42, 'SELEÇÃO DE PILOTO DE COMBATE — ESCOLHA SEU OPERADOR', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#00f0ff',
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(2);

    // Constrói os 3 cards focados nos pilotos
    const cardCenters = [136, 384, 632];
    PILOTS.forEach((pilot, index) => this.buildPilotCard(pilot, index, cardCenters[index]));

    // Painel inferior de Briefing Narrativo do Piloto Selecionado
    const briefY = 356;
    this.add.rectangle(GAME_WIDTH / 2, briefY, GAME_WIDTH - 48, 44, 0x060f1b, 0.94)
      .setStrokeStyle(1, 0x1b384c);

    this.briefingText = this.add.text(GAME_WIDTH / 2, briefY - 14, '', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#e2e8f0',
      align: 'center',
    }).setOrigin(0.5, 0).setResolution(2);

    this.specialDetailText = this.add.text(GAME_WIDTH / 2, briefY + 4, '', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#ffd166',
      align: 'center',
    }).setOrigin(0.5, 0).setResolution(2);

    // Rodapé de navegação e confirmação
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 18, GAME_WIDTH, 36, 0x050e18, 0.96);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 36, GAME_WIDTH, 1.5, 0x1f3c4d);

    this.add.text(24, GAME_HEIGHT - 26, '[1 / 2 / 3] OU [SETAS] SELECIONAR  |  [ESC] VOLTAR', {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#64748b',
    }).setResolution(2);

    // Botão de ação principal altamente evidente (com borda ciano e destaque luminoso)
    const startBtn = this.add.rectangle(GAME_WIDTH - 130, GAME_HEIGHT - 18, 220, 26, 0x0e7490)
      .setStrokeStyle(1.5, 0x00f0ff).setInteractive({ useHandCursor: true });

    this.add.text(GAME_WIDTH - 130, GAME_HEIGHT - 18, 'INICIAR OPERAÇÃO [ENTER]', {
      fontFamily: FONT_HUD,
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(2);

    startBtn.on('pointerover', () => {
      startBtn.setFillStyle(0x0284c7);
      startBtn.setStrokeStyle(2, 0x7df9ff);
    });
    startBtn.on('pointerout', () => {
      startBtn.setFillStyle(0x0e7490);
      startBtn.setStrokeStyle(1.5, 0x00f0ff);
    });
    startBtn.on('pointerdown', () => this.startGame());

    this.select(this.selectedIndex);
  }

  update(_time: number, delta: number): void {
    this.previewDistance += Math.min(delta, 50) * 0.026;
    this.backdrop.update(this.previewDistance);
    this.shipVisuals.forEach(s => s.updateShip(delta, 0, false, 0, false));

    if (!this.keys) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.select(0);
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.select(1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.select(2);
    if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT))
      this.select((this.selectedIndex + PILOTS.length - 1) % PILOTS.length);
    if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT))
      this.select((this.selectedIndex + 1) % PILOTS.length);
    if (
      Phaser.Input.Keyboard.JustDown(this.keys.ENTER) ||
      Phaser.Input.Keyboard.JustDown(this.keys.SPACE)
    )
      this.startGame();
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.scene.start('StageSelectScene');
    }
  }

  private buildPilotCard(pilot: PilotDefinition, index: number, x: number): void {
    const cardY = 210;
    const cardWidth = 232;
    const cardHeight = 250;

    // Fundo do card com relevo
    const panel = this.add.rectangle(x, cardY, cardWidth, cardHeight, 0x091422, 0.94)
      .setStrokeStyle(1, 0x1f3c4d).setInteractive({ useHandCursor: true });

    const glow = this.add.rectangle(x, cardY, cardWidth + 4, cardHeight + 4, 0x00f0ff, 0.12)
      .setStrokeStyle(2, 0x00f0ff).setVisible(false);

    panel.on('pointerdown', () => this.select(index));
    panel.on('pointerover', () => this.select(index));

    // 1. Identidade do Piloto (Topo do Card)
    const nameText = this.add.text(x, 96, pilot.name.toUpperCase(), {
      fontFamily: FONT_TITLE,
      fontSize: '15px',
      color: '#f8fafc',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setResolution(2);

    const callsignText = this.add.text(x, 114, `"${pilot.callsign}"`, {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#38bdf8',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setResolution(2);

    // 2. Retrato em Pixel Art do Piloto (Protagonismo Central)
    const portraitFrame = this.add.rectangle(x, 160, 68, 68, 0x0e1c2d, 1)
      .setStrokeStyle(1.5, 0x38bdf8);

    const portrait = this.add.sprite(x, 160, pilot.portraitKey)
      .setScale(1.0);

    // 3. Função Tática e Especial
    this.add.text(x, 202, pilot.role, {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#94a3b8',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setResolution(2);

    this.add.text(x, 218, `ESP: ${pilot.specialName}`, {
      fontFamily: FONT_HUD,
      fontSize: '11px',
      color: '#ffd166',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0).setResolution(2);

    // 4. Aeronave Subordinada em Perfil Lateral
    this.add.rectangle(x, 252, cardWidth - 24, 30, 0x060f1b, 0.9)
      .setStrokeStyle(1, 0x182c3c);

    this.add.text(x - 42, 244, `NAVE: ${pilot.shipName.toUpperCase()}`, {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#64748b',
    }).setResolution(2);

    const shipVisual = new VectorShip(this, x + 58, 252, pilot.id);
    shipVisual.setScale(0.85);
    this.shipVisuals.push(shipVisual);

    // 5. Estatísticas Comparativas
    const speedBars = index === 1 ? '■■■■■' : index === 0 ? '■■■■□' : '■■■□□';
    const rateBars = index === 0 ? '■■■■■' : index === 1 ? '■■■■□' : '■■■□□';
    const dmgBars = index === 2 ? '■■■■■' : index === 1 ? '■■■■□' : '■■■□□';

    this.add.text(x, 276, `VEL [${speedBars}]  CAD [${rateBars}]  PWR [${dmgBars}]`, {
      fontFamily: FONT_HUD,
      fontSize: '10px',
      color: '#94a3b8',
    }).setOrigin(0.5, 0).setResolution(2);

    this.cards.push({
      panel,
      glow,
      nameText,
      callsignText,
      portrait,
      portraitFrame,
      shipVisual,
    });
  }

  private select(index: number): void {
    if (this.selectedIndex !== index) {
      globalAudio.playPickup('upgrade');
    }
    this.selectedIndex = index;
    const pilot = PILOTS[index];

    this.cards.forEach((card, idx) => {
      const isSelected = idx === index;
      card.glow.setVisible(isSelected);
      card.panel.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x00f0ff : 0x1f3c4d);
      card.panel.setFillStyle(isSelected ? 0x122438 : 0x091422, 0.95);
      card.nameText.setColor(isSelected ? '#00f0ff' : '#f8fafc');
      card.callsignText.setColor(isSelected ? '#ffd166' : '#38bdf8');
      card.portraitFrame.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x00f0ff : 0x38bdf8);
    });

    this.briefingText.setText(`${pilot.name} // "${pilot.bio}"`);
    this.specialDetailText.setText(`HABILIDADE ESPECIAL: ${pilot.specialDescription} (100% RESSONÂNCIA)`);
  }

  private startGame(): void {
    globalAudio.playPickup('upgrade');
    this.scene.start('PrototypeScene', {
      pilotId: PILOTS[this.selectedIndex].id,
      stageNumber: this.stageNumber,
    });
  }
}
