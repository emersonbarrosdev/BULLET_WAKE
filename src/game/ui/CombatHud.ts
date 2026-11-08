import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUD_TOP, HUD_BOTTOM } from '../constants';
import { MAX_HP, type PlayerHealth } from '../systems/combat';
import type { SectorId } from '../systems/stageDirector';

const sectorTitles: Record<SectorId, string> = {
  evacuacao: 'CORREDOR DE EVACUACAO',
  destrocos: 'CAMPO DE DESTROCOS',
  industria: 'ANEL INDUSTRIAL',
  aproximacao: 'APROXIMACAO DA MALHA',
};

/** HUD de jogo de fase: score, integridade e PROGRESSO; sem indicador de ondas. */
export class CombatHud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly livesText: Phaser.GameObjects.Text;
  private readonly pilotText: Phaser.GameObjects.Text;
  private readonly sectorText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly progressBar: Phaser.GameObjects.Rectangle;
  private readonly healthSegments: Phaser.GameObjects.Rectangle[] = [];
  private readonly statusText: Phaser.GameObjects.Text;
  private statusRemainingMs = 0;

  constructor(scene: Phaser.Scene, onRestart: () => void) {
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP / 2, GAME_WIDTH, HUD_TOP, 0x142234, 0.97)
      .setDepth(40);
    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP - 1, GAME_WIDTH, 2, 0x36526c).setDepth(41);

    this.text(scene, 17, 9, 'BULLET WAKE', 19, '#f0f6fa');
    this.sectorText = this.text(scene, 248, 13, sectorTitles.evacuacao, 14, '#98bcca');
    this.text(scene, GAME_WIDTH - 17, 13, 'FASE 01  /  DEMO', 13, '#eab891')
      .setOrigin(1, 0);

    this.pilotText = this.text(scene, 19, 38, 'RIVET', 16, '#92e9de');
    this.text(scene, 193, 41, 'SCORE', 12, '#a9c6d6');
    this.scoreText = this.text(scene, 250, 34, '000000', 19, '#ffffff');

    this.text(scene, 400, 41, 'HP', 12, '#a9c6d6');
    for (let i = 0; i < MAX_HP; i++) {
      const segment = scene.add.rectangle(441 + i * 19, 47, 15, 13, 0x6cdbd3)
        .setStrokeStyle(1, 0xa6f3e4)
        .setDepth(42);
      this.healthSegments.push(segment);
    }
    this.text(scene, 520, 41, 'VIDAS', 12, '#a9c6d6');
    this.livesText = this.text(scene, 572, 34, '03', 19, '#ffffff');
    this.progressText = this.text(scene, GAME_WIDTH - 18, 38, '00%', 16, '#9bcfe3')
      .setOrigin(1, 0);

    scene.add.rectangle(GAME_WIDTH / 2, HUD_TOP + 1, GAME_WIDTH - 28, 3, 0x2b394e)
      .setDepth(41);
    this.progressBar = scene.add.rectangle(14, HUD_TOP + 1, 1, 3, 0x79e5d8)
      .setOrigin(0, 0.5).setDepth(42);
    this.statusText = this.text(scene, GAME_WIDTH / 2, HUD_TOP + 10, '', 15, '#f8bb82')
      .setOrigin(0.5, 0);

    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - HUD_BOTTOM / 2, GAME_WIDTH, HUD_BOTTOM, 0x142234, 0.97)
      .setDepth(40);
    scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - HUD_BOTTOM, GAME_WIDTH, 2, 0x36526c)
      .setDepth(41);
    this.text(scene, 17, GAME_HEIGHT - 28, 'WASD / SETAS   MOVER      ESPACO   TIRO      ESC   PILOTOS',
      13, '#e7f1f5');

    const restartButton = scene.add.rectangle(
      GAME_WIDTH - 95, GAME_HEIGHT - HUD_BOTTOM / 2, 158, 29, 0x2b5266,
    ).setStrokeStyle(1, 0x66cdc7).setInteractive({ useHandCursor: true }).setDepth(41);
    this.text(scene, GAME_WIDTH - 95, GAME_HEIGHT - 28, 'REINICIAR [R]', 13, '#ffffff')
      .setOrigin(0.5, 0);
    restartButton.on('pointerover', () => restartButton.setFillStyle(0x387989));
    restartButton.on('pointerout', () => restartButton.setFillStyle(0x2b5266));
    restartButton.on('pointerdown', onRestart);
  }

  setPilot(shipName: string): void {
    this.pilotText.setText(shipName.toUpperCase());
  }

  setScore(score: number): void {
    this.scoreText.setText(String(Math.max(0, Math.floor(score))).padStart(6, '0'));
  }

  setHealth(state: PlayerHealth): void {
    this.healthSegments.forEach((segment, index) => {
      const active = index < state.hp;
      segment.setFillStyle(active ? 0x6cdbd3 : 0x31485b);
      segment.setStrokeStyle(1, active ? 0xb9fff0 : 0x526b7a);
    });
    this.livesText.setText(String(state.lives).padStart(2, '0'));
  }

  setProgress(value: number): void {
    const progress = Math.max(0, Math.min(1, value));
    this.progressText.setText(String(Math.floor(progress * 100)).padStart(2, '0') + '%');
    this.progressBar.setSize((GAME_WIDTH - 28) * progress, 3);
  }

  setSector(sector: SectorId): void {
    this.sectorText.setText(sectorTitles[sector]);
    this.flash(sectorTitles[sector], '#b5deed', 1300);
  }

  flash(message: string, color = '#f8bb82', durationMs = 1000): void {
    this.statusText.setColor(color).setText(message).setVisible(true);
    this.statusRemainingMs = durationMs;
  }

  update(deltaMs: number): void {
    this.statusRemainingMs = Math.max(0, this.statusRemainingMs - deltaMs);
    if (this.statusRemainingMs === 0) this.statusText.setVisible(false);
  }

  private text(
    scene: Phaser.Scene, x: number, y: number, value: string, size: number, color: string,
  ): Phaser.GameObjects.Text {
    return scene.add.text(x, y, value, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: size + 'px',
      fontStyle: 'bold',
      color,
    }).setResolution(2).setDepth(42);
  }
}
