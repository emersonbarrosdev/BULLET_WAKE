import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { PILOTS, type PilotDefinition } from '../data/pilots';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { StageBackdrop } from './StageBackdrop';

type MenuKeys = Record<'LEFT' | 'RIGHT' | 'ENTER' | 'SPACE' | 'ONE' | 'TWO' | 'THREE' | 'ESC',
  Phaser.Input.Keyboard.Key>;
interface PilotCard {
  panel: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/** Escolha de piloto para a missão ativa do BULLET WAKE. */
export class PilotSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private stageNumber = 1;
  private keys?: MenuKeys;
  private cards: PilotCard[] = [];
  private specialText!: Phaser.GameObjects.Text;
  private backdrop!: StageBackdrop;
  private previewDistance = 0;

  constructor() { super({ key: 'PilotSelectScene' }); }

  init(data: { selectedPilotId?: string; stageNumber?: number } = {}): void {
    this.selectedIndex = Math.max(0, PILOTS.findIndex(p => p.id === data.selectedPilotId));
    this.stageNumber = data.stageNumber || 1;
  }

  preload(): void { loadGameSprites(this); }

  create(): void {
    registerGameAnimations(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.backdrop = new StageBackdrop(this, this.stageNumber);
    this.previewDistance = 0;
    this.cards = [];
    this.keys = this.input.keyboard?.addKeys('LEFT,RIGHT,ENTER,SPACE,ONE,TWO,THREE,ESC') as MenuKeys | undefined;

    this.add.rectangle(GAME_WIDTH / 2, 46, GAME_WIDTH, 92, 0x0a1628, 0.84);
    this.text(GAME_WIDTH / 2, 15, 'BULLET WAKE', 33, '#f5f9fd').setOrigin(0.5, 0);
    this.text(GAME_WIDTH / 2, 57, 'SELECIONE SEU PILOTO', 18, '#8ee3dd').setOrigin(0.5, 0);

    PILOTS.forEach((pilot, index) => this.buildCard(pilot, index));
    this.specialText = this.text(GAME_WIDTH / 2, 350, '', 17, '#f0d8b5').setOrigin(0.5, 0);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 24, GAME_WIDTH, 48, 0x0d1c2b, 0.89);
    this.text(24, GAME_HEIGHT - 34, '1 / 2 / 3 OU SETAS', 16, '#d5e9f1');
    const start = this.add.rectangle(GAME_WIDTH - 133, GAME_HEIGHT - 24, 238, 36, 0x2a6a77)
      .setStrokeStyle(1, 0x88e4df).setInteractive({ useHandCursor: true });
    this.text(GAME_WIDTH - 133, GAME_HEIGHT - 35, 'INICIAR [ENTER]', 18, '#ffffff').setOrigin(0.5, 0);
    start.on('pointerover', () => start.setFillStyle(0x348893));
    start.on('pointerout', () => start.setFillStyle(0x2a6a77));
    start.on('pointerdown', () => this.startGame());

    this.select(this.selectedIndex);
  }

  update(_time: number, delta: number): void {
    this.previewDistance += Math.min(delta, 50) * 0.026;
    this.backdrop.update(this.previewDistance);
    if (!this.keys) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.select(0);
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.select(1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.select(2);
    if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT))
      this.select((this.selectedIndex + PILOTS.length - 1) % PILOTS.length);
    if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT))
      this.select((this.selectedIndex + 1) % PILOTS.length);
    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
      || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.startGame();
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.scene.start('StageSelectScene');
    }
  }

  private buildCard(pilot: PilotDefinition, index: number): void {
    const x = 146 + index * 238;
    const panel = this.add.rectangle(x, 222, 219, 235, 0x1b2939, 0.94)
      .setStrokeStyle(2, 0x39556a).setInteractive({ useHandCursor: true });
    panel.on('pointerdown', () => this.select(index));
    const label = this.text(x, 111, String(index + 1) + '  ' + pilot.name, 19, '#e3f2fa')
      .setOrigin(0.5, 0);
    this.text(x, 143, pilot.shipName.toUpperCase(), 25, '#f5fafc').setOrigin(0.5, 0);
    let texture = 'rivet-v3-idle';
    let anim = 'rivet-v3-idle-anim';
    let scale = 1.0;
    if (pilot.id === 'cora') {
      texture = 'ship-moth-v2-idle';
      anim = 'moth-v2-idle-anim';
      scale = 1.1;
    } else if (pilot.id === 'harlan') {
      texture = 'ship-knuckle-v2-idle';
      anim = 'knuckle-v2-idle-anim';
      scale = 1.05;
    }
    const ship = this.add.sprite(x, 227, texture, 0);
    ship.setScale(scale).play(anim);
    this.text(x, 281, pilot.role, 15, '#a5d4e0').setOrigin(0.5, 0);
    this.text(x, 306, 'VEL ' + pilot.speed + '   TIROS ' + pilot.shotsPerSecond + '/s', 14, '#dae8ef')
      .setOrigin(0.5, 0);
    this.text(x, 326, 'DANO ' + pilot.damage.toFixed(2), 14, '#f4c69d').setOrigin(0.5, 0);
    this.cards.push({ panel, label });
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.cards.forEach((card, idx) => {
      card.panel.setStrokeStyle(idx === index ? 2 : 1, idx === index ? 0x85f4e4 : 0x3b5269);
      card.panel.setFillStyle(idx === index ? 0x243c4e : 0x1b2939, 0.95);
      card.label.setColor(idx === index ? '#9bf7e6' : '#dcecf5');
    });
    this.specialText.setText('ESPECIAL: ' + PILOTS[index].specialName.toUpperCase() + ' (CARGA 100% RESSONÂNCIA)');
  }

  private startGame(): void {
    this.scene.start('PrototypeScene', {
      pilotId: PILOTS[this.selectedIndex].id,
      stageNumber: this.stageNumber,
    });
  }

  private text(x: number, y: number, message: string, size: number, color: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, message, {
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: size + 'px',
      fontStyle: 'bold', color,
    }).setResolution(2);
  }
}
