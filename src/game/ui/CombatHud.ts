import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { MAX_HP, type PlayerHealth } from '../systems/combat';

/**
 * HUD funcional do protótipo.
 * Layout e legibilidade separados da simulação de combate.
 * A identidade visual final será produzida na etapa de arte.
 */
export class CombatHud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly healthSegments: Phaser.GameObjects.Rectangle[] = [];
  private readonly statusText: Phaser.GameObjects.Text;
  private statusRemainingMs = 0;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
    const topBar = scene.add.rectangle(GAME_WIDTH / 2, 22, GAME_WIDTH, 44, 0x19283a);
    topBar.setDepth(50);
    scene.add.rectangle(GAME_WIDTH / 2, 44, GAME_WIDTH, 1, 0x426078).setDepth(50);

    this.makeText(scene, 10, 5, 'BULLET WAKE', 13, '#f1f7fc');
    this.makeText(scene, GAME_WIDTH - 11, 8, 'PROTOTIPO T04', 9, '#b5c9d8').setOrigin(1, 0);

    this.makeText(scene, 10, 26, 'SCORE', 10, '#a9c6d6');
    this.scoreText = this.makeText(scene, 48, 22, '000000', 15, '#83e5df');

    this.makeText(scene, 168, 26, 'HP', 10, '#a9c6d6');
    for (let index = 0; index < MAX_HP; index += 1) {
      const segment = scene.add.rectangle(199 + index * 13, 31, 10, 12, 0x69d8cf);
      segment.setStrokeStyle(1, 0xb8f0e9);
      segment.setDepth(51);
      this.healthSegments.push(segment);
    }

    this.makeText(scene, 280, 26, 'VIDAS', 10, '#a9c6d6');
    this.livesText = this.makeText(scene, 337, 22, '03', 15, '#f1f7fc');

    this.statusText = this.makeText(scene, GAME_WIDTH / 2, 49, '', 12, '#ffbd86')
      .setOrigin(0.5, 0);

    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 12, GAME_WIDTH, 24, 0x19283a)
      .setDepth(50);
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 24, GAME_WIDTH, 1, 0x426078)
      .setDepth(50);

    this.makeText(scene, 8, GAME_HEIGHT - 18, 'WASD / SETAS  |  ESPACO: TIRO', 10, '#f0f5f8');

    // É botão de gameplay mesmo no protótipo: mouse e toque.
    const restartButton = scene.add
      .rectangle(GAME_WIDTH - 49, GAME_HEIGHT - 12, 91, 19, 0x2b5266)
      .setStrokeStyle(1, 0x6bdad6)
      .setInteractive({ useHandCursor: true })
      .setDepth(51);

    this.makeText(scene, GAME_WIDTH - 49, GAME_HEIGHT - 17, 'REINICIAR [R]', 9, '#f3fafc')
      .setOrigin(0.5, 0);

    restartButton.on('pointerover', () => restartButton.setFillStyle(0x37798a));
    restartButton.on('pointerout', () => restartButton.setFillStyle(0x2b5266));
    restartButton.on('pointerdown', onRestart);
  }

  setScore(score: number): void {
    this.scoreText.setText(Math.max(0, Math.floor(score)).toString().padStart(6, '0'));
  }

  setHealth(state: PlayerHealth): void {
    this.healthSegments.forEach((segment, index) => {
      const active = index < state.hp;
      segment.setFillStyle(active ? 0x69d8cf : 0x31485b);
      segment.setStrokeStyle(1, active ? 0xb8f0e9 : 0x526b7a);
    });
    this.livesText.setText(String(state.lives).padStart(2, '0'));
  }

  flash(message: string, color = '#ffbd86', durationMs = 900): void {
    this.statusText.setColor(color).setText(message);
    this.statusText.setVisible(true);
    this.statusRemainingMs = durationMs;
  }

  update(deltaMs: number): void {
    if (this.statusRemainingMs <= 0) return;
    this.statusRemainingMs = Math.max(0, this.statusRemainingMs - deltaMs);
    if (this.statusRemainingMs === 0) this.statusText.setVisible(false);
  }

  private makeText(
    scene: Phaser.Scene, x: number, y: number, value: string, size: number, color: string,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, value, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: size + 'px',
      fontStyle: 'bold',
      color,
    }).setResolution(3).setDepth(52);
  }
}
