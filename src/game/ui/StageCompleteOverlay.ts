import Phaser from 'phaser';
import { STAGES } from '../data/stages';
import { MissionResultOverlay } from './MissionResultOverlay';

export class StageCompleteOverlay extends MissionResultOverlay {
  constructor(scene: Phaser.Scene, stageNumber: number, score: number, onNextStage: () => void, onReplay: () => void, onStageSelect: () => void, radioMessage?:string) {
    const stage = STAGES[stageNumber - 1] || STAGES[0];
    super(scene, 'MISSÃO CUMPRIDA!', 'FASE ' + String(stageNumber).padStart(2, '0') + ' · ' + stage.title.toUpperCase() + ' // ' + stage.bossName.toUpperCase() + ' NEUTRALIZADO', score,
      radioMessage??'Setor contido. Ameaça alienígena neutralizada. Operador autorizado a retornar à base.', [
        { label: 'ENCERRAR OPERAÇÃO', key: 'Enter', run: onNextStage },
        { label: 'REJOGAR', key: 'R', run: onReplay },
        { label: 'ESCOLHER PILOTO', key: 'Escape', run: onStageSelect },
      ]);
  }
}
