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
    this.backdrop = new StageBackdrop(this, this.stageNumber, { fullWidth: true, showBezels: false });
    this.previewDistance = 0;
    this.cards = [];
    this.shipVisuals = [];
    this.keys = this.input.keyboard?.addKeys('LEFT,RIGHT,ENTER,SPACE,ONE,TWO,THREE,ESC') as MenuKeys | undefined;

    // Cabeçalho militar de inteligência tática (Zona Superior)
    this.add.rectangle(GAME_WIDTH / 2, 38, GAME_WIDTH, 68, 0x050e18, 0.92).setDepth(10);
    this.add.rectangle(GAME_WIDTH / 2, 71, GAME_WIDTH, 1.5, 0x1f3c4d).setDepth(10);

    this.add.text(GAME_WIDTH / 2, 10, 'BULLET WAKE // CENTRO DE OPERAÇÕES', {
      fontFamily: FONT_TITLE,
      fontSize: '21px',
      fontStyle: 'bold',
      color: '#ffffff',
    letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(3).setDepth(11);

      this.add.text(GAME_WIDTH / 2, 41, 'SELEÇÃO DE PILOTO DE COMBATE — ESCOLHA SEU OPERADOR', {
        fontFamily: FONT_HUD,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#00f0ff',
      letterSpacing: 1.5,
    }).setOrigin(0.5, 0).setResolution(3).setDepth(11);

// Constrói os 3 cards focados nos pilotos
const cardCenters = [136, 384, 632];
PILOTS.forEach((pilot, index) => this.buildPilotCard(pilot, index, cardCenters[index]));

// Painel inferior de Briefing Narrativo do Piloto Selecionado
const briefY = 356;
this.add.rectangle(GAME_WIDTH / 2, briefY, GAME_WIDTH - 48, 44, 0x060f1b, 0.94)
  .setStrokeStyle(1, 0x1b384c).setDepth(10);

  this.briefingText = this.add.text(GAME_WIDTH / 2, briefY - 16, '', {
    fontFamily: FONT_HUD,
    fontSize: '13px',
    fontStyle: 'bold',
    color: '#f8fafc',
    align: 'center',
}).setOrigin(0.5, 0).setResolution(3).setDepth(11);

  this.specialDetailText = this.add.text(GAME_WIDTH / 2, briefY + 3, '', {
    fontFamily: FONT_HUD,
    fontSize: '13px',
    fontStyle: 'bold',
    color: '#fde047',
    align: 'center',
}).setOrigin(0.5, 0).setResolution(3).setDepth(11);

// Rodapé de navegação e confirmação
this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 18, GAME_WIDTH, 36, 0x050e18, 0.96).setDepth(10);
this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 36, GAME_WIDTH, 1.5, 0x1f3c4d).setDepth(10);

  this.add.text(24, GAME_HEIGHT - 27, '[1 / 2 / 3] OU [SETAS] SELECIONAR   ·   [ESC] VOLTAR', {
    fontFamily: FONT_HUD,
  fontSize: '13px',
  fontStyle: 'bold',
  color: '#cbd5e1',
}).setResolution(3).setDepth(11);

// Botão de ação principal altamente evidente (com borda ciano e destaque luminoso)
const startBtn = this.add.rectangle(GAME_WIDTH - 130, GAME_HEIGHT - 18, 224, 28, 0x0e7490)
  .setStrokeStyle(1.5, 0x00f0ff).setInteractive({ useHandCursor: true }).setDepth(11);

this.add.text(GAME_WIDTH - 130, GAME_HEIGHT - 18, 'INICIAR OPERAÇÃO [ENTER]', {
  fontFamily: FONT_HUD,
  fontSize: '13px',
  color: '#ffffff',
  fontStyle: 'bold',
  letterSpacing: 1,
    }).setOrigin(0.5).setResolution(3).setDepth(12);

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
  this.shipVisuals.forEach(s => s.updateShip(delta, 0, 0, 0, false, false));

  if(!this.keys) return;
  const isJustDown = (k?: unknown) => {
    if (!k || typeof k !== 'object') return false;
    const anyKey = k as { _justDown?: boolean };
    if (anyKey._justDown) {
      anyKey._justDown = false;
      return true;
    }
    return false;
  };

  if(isJustDown(this.keys.ONE)) this.select(0);
if (isJustDown(this.keys.TWO)) this.select(1);
if (isJustDown(this.keys.THREE)) this.select(2);
if (isJustDown(this.keys.LEFT))
  this.select((this.selectedIndex + PILOTS.length - 1) % PILOTS.length);
if (isJustDown(this.keys.RIGHT))
  this.select((this.selectedIndex + 1) % PILOTS.length);
if (isJustDown(this.keys.ENTER) || isJustDown(this.keys.SPACE))
  this.startGame();
if (isJustDown(this.keys.ESC)) {
  this.scene.start('StageSelectScene');
}
  }

  private buildPilotCard(pilot: PilotDefinition, index: number, x: number): void {
  const cardY = 210;
  const cardWidth = 232;
  const cardHeight = 250;

  // Fundo do card com relevo
  const panel = this.add.rectangle(x, cardY, cardWidth, cardHeight, 0x091422, 0.94)
    .setStrokeStyle(1, 0x1f3c4d).setInteractive({ useHandCursor: true }).setDepth(10);

  const glow = this.add.rectangle(x, cardY, cardWidth + 4, cardHeight + 4, 0x00f0ff, 0.12)
    .setStrokeStyle(2, 0x00f0ff).setVisible(false).setDepth(10);

  panel.on('pointerdown', () => this.select(index));
  panel.on('pointerover', () => this.select(index));

  // 1. Identidade do Piloto (Topo do Card)
    const nameText = this.add.text(x, 93, pilot.name.toUpperCase(), {
      fontFamily: FONT_TITLE,
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#f8fafc',
    letterSpacing: 0.8,
  }).setOrigin(0.5, 0).setResolution(3).setDepth(11);

    const callsignText = this.add.text(x, 113, `"${pilot.callsign}"`, {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      color: '#38bdf8',
      fontStyle: 'bold',
      letterSpacing: 1,
  }).setOrigin(0.5, 0).setResolution(3).setDepth(11);

  // 2. Retrato em Pixel Art do Piloto (Protagonismo Central)
  const portraitFrame = this.add.rectangle(x, 160, 68, 68, 0x0e1c2d, 1)
    .setStrokeStyle(1.5, 0x38bdf8).setDepth(11);

  const portrait = this.add.sprite(x, 160, pilot.portraitKey)
    .setScale(1.0).setDepth(12);

  // 3. Função Tática e Especial
    this.add.text(x, 200, pilot.role, {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      color: '#e2e8f0',
      fontStyle: 'bold',
  }).setOrigin(0.5, 0).setResolution(3).setDepth(11);

  this.add.text(x, 218, `ESP: ${pilot.specialName}`, {
    fontFamily: FONT_HUD,
    fontSize: '13px',
    color: '#fde047',
    fontStyle: 'bold',
}).setOrigin(0.5, 0).setResolution(3).setDepth(11);

// 4. Aeronave Subordinada em Perfil Lateral
this.add.rectangle(x, 252, cardWidth - 24, 30, 0x060f1b, 0.9)
  .setStrokeStyle(1, 0x182c3c).setDepth(11);

  this.add.text(x - 92, 244, `NAVE: ${pilot.shipName.toUpperCase()}`, {
    fontFamily: FONT_HUD,
  fontSize: '13px',
  fontStyle: 'bold',
  color: '#93c5fd',
}).setResolution(3).setDepth(12);

const shipVisual = new VectorShip(this, x + 58, 252, pilot.id, 'profile');
shipVisual.setScale(0.85);
shipVisual.setDepth(12);
this.shipVisuals.push(shipVisual);

// 5. Estatísticas Comparativas
const speedBars = index === 1 ? '■■■■■' : index === 0 ? '■■■■□' : '■■■□□';
const rateBars = index === 0 ? '■■■■■' : index === 1 ? '■■■■□' : '■■■□□';
const dmgBars = index === 2 ? '■■■■■' : index === 1 ? '■■■■□' : '■■■□□';

  this.add.text(x, 274, `VEL ${speedBars} · CAD ${rateBars} · PWR ${dmgBars}`, {
    fontFamily: FONT_HUD,
  fontSize: '12px',
  fontStyle: 'bold',
  color: '#cbd5e1',
}).setOrigin(0.5, 0).setResolution(3).setDepth(11);

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
  if(this.selectedIndex !== index) {
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
