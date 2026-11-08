import Phaser from 'phaser';
import type { PilotDefinition } from '../data/pilots';

/**
 * Silhuetas de DEBUG para diferenciar nave na seleção e no combate.
 * Não são sprites finais e serão substituídas por spritesheets autorais.
 * Todas apontam para a direita, sem alterar a hurtbox do jogador.
 */
export function createPrototypeShip(
  scene: Phaser.Scene,
  pilot: PilotDefinition,
): Phaser.GameObjects.Graphics {
  const shape = scene.add.graphics();
  shape.fillStyle(pilot.hullColor);

  switch (pilot.id) {
    case 'nolan': {
      // Dardo compacto com dois motores.
      shape.fillRect(-13, -4, 25, 8);
      shape.fillRect(-8, -7, 14, 3);
      shape.fillRect(-8, 4, 14, 3);
      shape.fillStyle(pilot.accentColor);
      shape.fillRect(12, -2, 8, 4);
      shape.fillStyle(0xeaf2f5);
      shape.fillRect(-17, -5, 4, 3);
      shape.fillRect(-17, 2, 4, 3);
      break;
    }
    case 'cora': {
      // Agulha longa, cauda aberta e propulsor estreito.
      shape.fillRect(-17, -3, 29, 6);
      shape.fillRect(-12, -5, 20, 2);
      shape.fillRect(-12, 3, 20, 2);
      shape.fillRect(-19, -8, 6, 4);
      shape.fillRect(-19, 4, 6, 4);
      shape.fillStyle(pilot.accentColor);
      shape.fillRect(12, -1, 10, 2);
      shape.fillStyle(0xeaf2f5);
      shape.fillRect(-21, -1, 4, 2);
      break;
    }
    case 'harlan': {
      // Cunha blindada, placas pesadas e canhão frontal largo.
      shape.fillRect(-16, -9, 25, 18);
      shape.fillRect(-11, -12, 17, 3);
      shape.fillRect(-11, 9, 17, 3);
      shape.fillRect(6, -6, 8, 12);
      shape.fillStyle(pilot.accentColor);
      shape.fillRect(14, -3, 10, 6);
      shape.fillStyle(0x87959a);
      shape.fillRect(-19, -7, 4, 5);
      shape.fillRect(-19, 2, 4, 5);
      break;
    }
  }
  return shape;
}
