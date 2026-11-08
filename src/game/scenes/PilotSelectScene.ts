import Phaser from 'phaser';
import { FONT_HUD, FONT_TECH, FONT_TITLE, GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { PILOTS, type PilotDefinition } from '../data/pilots';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { StageBackdrop } from './StageBackdrop';
import { VectorShip } from '../render/VectorShip';

type MenuKeys = Record<
  'LEFT' | 'RIGHT' | 'ENTER' | 'SPACE' | 'ONE' | 'TWO' | 'THREE' | 'ESC',
  Phaser.Input.Keyboard.Key
>;

interface PilotCard {
  panel: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/** Escolha de piloto para a missão ativa do BULLET WAKE com visual arcade futurista. */
export class PilotSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private stageNumber = 1;
  private keys?: MenuKeys;
  private cards: PilotCard[] = [];
  private shipVisuals: VectorShip[] = [];
  private specialText!: Phaser.GameObjects.Text;
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

    // Cabeçalho
    this.add.rectangle(GAME_WIDTH / 2, 44, GAME_WIDTH, 84, 0x050e18, 0.88);
    this.add.text(GAME_WIDTH / 2, 12, 'BULLET WAKE', {
      fontFamily: FONT_TITLE,
      fontSize: '26px',
      color: '#ffffff',
      letterSpacing: 3,
    }).setOrigin(0.5, 0).setResolution(2);

    this.add.text(GAME_WIDTH / 2, 48, 'SELECIONE SUA NAVE DE COMBATE', {
      fontFamily: FONT_TECH,
      fontSize: '13px',
      color: '#00f0ff',
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(2);

    PILOTS.forEach((pilot, index) => this.buildCard(pilot, index));

    this.specialText = this.add.text(GAME_WIDTH / 2, 350, '', {
      fontFamily: FONT_TECH,
      fontSize: '13px',
      color: '#ffd166',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setResolution(2);

    // Rodapé de navegação
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 22, GAME_WIDTH, 44, 0x07121f, 0.92);
    this.add.text(24, GAME_HEIGHT - 32, '[1 / 2 / 3] OU SETAS PARA NAVEGAR', {
      fontFamily: FONT_TECH,
      fontSize: '12px',
      color: '#64748b',
    }).setResolution(2);

    const start = this.add.rectangle(GAME_WIDTH - 130, GAME_HEIGHT - 22, 220, 32, 0x0e7490)
      .setStrokeStyle(1, 0x38bdf8).setInteractive({ useHandCursor: true });
    this.add.text(GAME_WIDTH - 130, GAME_HEIGHT - 22, 'CONFIRMAR [ENTER]', {
      fontFamily: FONT_HUD,
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setResolution(2);

    start.on('pointerover', () => start.setFillStyle(0x0284c7));
    start.on('pointerout', () => start.setFillStyle(0x0e7490));
    start.on('pointerdown', () => this.startGame());

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

  private buildCard(pilot: PilotDefinition, index: number): void {
    const x = 146 + index * 238;
    const panel = this.add.rectangle(x, 222, 224, 235, 0x0c1b2c, 0.94)
      .setStrokeStyle(1, 0x22425e).setInteractive({ useHandCursor: true });
    panel.on('pointerdown', () => this.select(index));

    const label = this.add.text(x, 114, `${index + 1}. ${pilot.name.toUpperCase()}`, {
      fontFamily: FONT_HUD,
      fontSize: '15px',
      color: '#94a3b8',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setResolution(2);

    this.add.text(x, 138, pilot.shipName.toUpperCase(), {
      fontFamily: FONT_TITLE,
      fontSize: '20px',
      color: '#f8fafc',
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setResolution(2);

    const ship = new VectorShip(this, x, 224, pilot.id);
    ship.setScale(1.55);
    this.shipVisuals.push(ship);

    this.add.text(x, 278, pilot.role.toUpperCase(), {
      fontFamily: FONT_TECH,
      fontSize: '12px',
      color: '#38bdf8',
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setResolution(2);

    this.add.text(x, 302, `VEL ${pilot.speed}  //  CAD ${pilot.shotsPerSecond}/s`, {
      fontFamily: FONT_TECH,
      fontSize: '12px',
      color: '#cbd5e1',
    }).setOrigin(0.5, 0).setResolution(2);

    this.add.text(x, 322, `PODER DE IMPACTO: ${pilot.damage.toFixed(2)}x`, {
      fontFamily: FONT_TECH,
      fontSize: '11px',
      color: '#f59e0b',
    }).setOrigin(0.5, 0).setResolution(2);

    this.cards.push({ panel, label });
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.cards.forEach((card, idx) => {
      card.panel.setStrokeStyle(idx === index ? 2 : 1, idx === index ? 0x00f0ff : 0x22425e);
      card.panel.setFillStyle(idx === index ? 0x16304a : 0x0c1b2c, 0.95);
      card.label.setColor(idx === index ? '#00f0ff' : '#94a3b8');
    });
    this.specialText.setText(
      `ESPECIAL: ${PILOTS[index].specialName.toUpperCase()}  //  REQUER 100% RESSONÂNCIA`,
    );
  }

  private startGame(): void {
    this.scene.start('PrototypeScene', {
      pilotId: PILOTS[this.selectedIndex].id,
      stageNumber: this.stageNumber,
    });
  }
}
