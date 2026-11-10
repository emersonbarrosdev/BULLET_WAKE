import Phaser from 'phaser';
import { MissionResultOverlay } from './MissionResultOverlay';

export class GameOverOverlay extends MissionResultOverlay {
  constructor(scene: Phaser.Scene, score: number, onRestart: () => void, onChoosePilot: () => void) {
    super(scene, 'SISTEMA COMPROMETIDO', 'AERONAVE ABATIDA EM COMBATE', score, 'A operação foi interrompida. Prepare uma nova tentativa.', [
      { label: 'CONTINUAR', key: 'Enter', run: onRestart },
      { label: 'ESCOLHER PILOTO', key: 'Escape', run: onChoosePilot },
    ], true);
  }
}
