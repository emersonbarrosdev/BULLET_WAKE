import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { PILOTS, type PilotDefinition } from '../data/pilots';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';

type MenuKeys = Record<
  'LEFT' | 'RIGHT' | 'ENTER' | 'SPACE' | 'ONE' | 'TWO' | 'THREE',
  Phaser.Input.Keyboard.Key
>;

interface PilotCard {
  panel: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/** T06: seleção de piloto com teclado, mouse ou toque, antes de cada tentativa. */
export class PilotSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private keys?: MenuKeys;
  private cards: PilotCard[] = [];
  private specialText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PilotSelectScene' });
  }

  init(data: { selectedPilotId?: string } = {}): void {
    const index = PILOTS.findIndex(pilot => pilot.id === data?.selectedPilotId);
    this.selectedIndex = index >= 0 ? index : 0;
  }

  preload(): void {
    loadGameSprites(this);
  }

  create(): void {
    registerGameAnimations(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.cards = [];
    this.keys = this.input.keyboard?.addKeys(
      'LEFT,RIGHT,ENTER,SPACE,ONE,TWO,THREE',
    ) as MenuKeys | undefined;

    this.text(GAME_WIDTH / 2, 8, 'BULLET WAKE', 23, '#f2f7fa')
      .setOrigin(0.5, 0);
    this.text(GAME_WIDTH / 2, 36, 'SELECIONE SEU PILOTO', 11, '#89d9d5')
      .setOrigin(0.5, 0);

    PILOTS.forEach((pilot, index) => this.buildCard(pilot, index));
    this.specialText = this.text(12, 187, '', 10, '#d5e4ed');

    const startButton = this.add.rectangle(
      313, GAME_HEIGHT - 13, 117, 25, 0x2b6974,
    ).setStrokeStyle(1, 0x84dfd7).setInteractive({ useHandCursor: true });
    this.text(313, GAME_HEIGHT - 19, 'INICIAR [ENTER]', 11, '#ffffff')
      .setOrigin(0.5, 0);
    startButton.on('pointerover', () => startButton.setFillStyle(0x387f89));
    startButton.on('pointerout', () => startButton.setFillStyle(0x2b6974));
    startButton.on('pointerdown', () => this.startGame());
    this.text(12, GAME_HEIGHT - 18, '1/2/3 OU SETAS', 10, '#b7d5dc');

    this.select(this.selectedIndex);
  }

  update(): void {
    if (!this.keys) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.select(0);
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.select(1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.select(2);
    if (Phaser.Input.Keyboard.JustDown(this.keys.LEFT)) {
      this.select((this.selectedIndex + PILOTS.length - 1) % PILOTS.length);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.RIGHT)) {
      this.select((this.selectedIndex + 1) % PILOTS.length);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER)
      || Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.startGame();
    }
  }

  private buildCard(pilot: PilotDefinition, index: number): void {
    const x = 66 + index * 126;
    const panel = this.add.rectangle(x, 115, 116, 130, 0x1b2b3e)
      .setStrokeStyle(1, 0x385b70)
      .setInteractive({ useHandCursor: true });
    panel.on('pointerdown', () => this.select(index));
    const label = this.text(x, 54, String(index + 1) + '  ' + pilot.name, 11, '#d2e1e9')
      .setOrigin(0.5, 0);
    this.text(x, 77, pilot.shipName.toUpperCase(), 15, '#f2f7fa')
      .setOrigin(0.5, 0);
    const ship = this.add.sprite(x, 111, 'ship-' + pilot.id, 0);
    ship.setScale(1.25).play('ship-' + pilot.id + '-idle');
    this.text(x, 133, pilot.role, 10, '#b5d9df').setOrigin(0.5, 0);
    this.text(x, 148, 'VEL ' + pilot.speed + '   TIROS ' + pilot.shotsPerSecond + '/s', 9, '#e2e9ef')
      .setOrigin(0.5, 0);
    this.text(x, 163, 'DANO ' + pilot.damage.toFixed(2), 10, '#cbdde8')
      .setOrigin(0.5, 0);
    this.cards.push({ panel, label });
  }

  private select(index: number): void {
    this.selectedIndex = index;
    this.cards.forEach((card, i) => {
      card.panel.setStrokeStyle(i === index ? 2 : 1, i === index ? 0x7de5df : 0x385b70);
      card.panel.setFillStyle(i === index ? 0x263f54 : 0x1b2b3e);
      card.label.setColor(i === index ? '#91ebe3' : '#d2e1e9');
    });
    const pilot = PILOTS[this.selectedIndex];
    this.specialText.setText('ESPECIAL: ' + pilot.specialName);
  }

  private startGame(): void {
    this.scene.start('PrototypeScene', { pilotId: PILOTS[this.selectedIndex].id });
  }

  private text(
    x: number, y: number, value: string, size: number, color: string,
  ): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: size + 'px',
      fontStyle: 'bold',
      color,
    }).setResolution(3);
  }
}
