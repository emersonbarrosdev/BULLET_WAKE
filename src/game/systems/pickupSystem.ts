/**
 * BULLET WAKE V2 — Sistema de Power-ups e Cápsulas Físicas Coletáveis (Estilo Fire Shark)
 * 
 * Regra Crítica:
 * - NENHUM coletável recupera cargas de Dash (as 3 cargas por fase são fixas).
 * - Itens aparecem fisicamente na arena de combate e flutuam descendo suavemente.
 * - Coleta por contato, sem atração magnética ou troca involuntária de arma.
 */
import { PLAYFIELD_X, PLAYFIELD_RIGHT } from '../constants.ts';
import { circleHitsHull } from './hullCollision.ts';

export type PickupType =
  | 'power'         // P: Avança 1/3 no medidor P (3 P = +1 nível de potência até LV4)
  | 'full_power'    // P★: Item P Vermelho Raro — eleva imediatamente ao Nível 4 máximo (nunca troca a arma)
  | 'weapon_green'  // Cápsula Verde: Troca para ENERGIA ESPIRALADA
  | 'weapon_ion'    // Cápsula Azul: Troca para DISPERSÃO AZUL
  | 'weapon_red'    // Cápsula Vermelha: Troca para LASER RUBRO
  | 'health'        // H: Recupera até 30 de integridade
  | 'bomb'          // B: Alias legado de especial; não aparece no Normal
  | 'missile'       // M: Reabastece munição de mísseis
  | 'speed'         // S: Velocidade, até 3 incrementos
  | 'score'         // $: Concede 500 pontos
  | 'special';      // E: Uma carga de especial (máximo três)

export interface PickupModel {
  id: number;
  type: PickupType;
  x: number;
  y: number;
  baseX: number;
  ageMs: number;
  collected: boolean;
  velocityX: number;
}

export const PICKUP_RADIUS = 10;
export const PICKUP_MAGNET_RADIUS = 0;
export const PICKUP_FLOAT_SPEED_Y = 24; // Desloca suavemente para baixo no campo vertical

export class PickupSystem {
  readonly pickups: PickupModel[] = [];
  private nextId = 1;

  spawn(type: PickupType, x: number, y: number): PickupModel {
    // Garante que a cápsula nasça dentro dos limites do campo vertical
    const clampedX = Math.max(PLAYFIELD_X + 24, Math.min(PLAYFIELD_RIGHT - 24, x));
    const pickup: PickupModel = {
      id: this.nextId++,
      type,
      x: clampedX,
      y,
      baseX: clampedX,
      ageMs: 0,
      collected: false,
      velocityX: this.nextId % 2 ? -38 : 38,
    };
    this.pickups.push(pickup);
    return pickup;
  }

  update(deltaMs: number, _playerX: number, _playerY: number): void {
    const dt = Math.max(0, deltaMs);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.ageMs += dt;

      // Movimento de descida com oscilação horizontal senoidal suave
      const sway = Math.sin(p.ageMs / 280) * 8;
      if (p.type.startsWith('weapon_') || p.type === 'speed') {
        p.baseX += p.velocityX * dt / 1000;
        if (p.baseX < PLAYFIELD_X + 20 || p.baseX > PLAYFIELD_RIGHT - 20) {
          p.baseX = Math.max(PLAYFIELD_X + 20, Math.min(PLAYFIELD_RIGHT - 20, p.baseX));
          p.velocityX *= -1;
        }
      }
      // Contact only: collecting a color must be a deliberate movement.
      p.y += PICKUP_FLOAT_SPEED_Y * (dt / 1000);

      p.x = Math.max(PLAYFIELD_X + 16, Math.min(PLAYFIELD_RIGHT - 16, p.baseX + sway));

      // Remove se ultrapassar a borda inferior da tela ou se coletado
      if (p.y > 450 || p.y < -50 || p.ageMs > 10000 || p.collected) {
        this.pickups.splice(i, 1);
      }
    }
  }

  checkCollection(playerX: number, playerY: number, collectRadius = 5, visibleHull = false): PickupModel[] {
    const collected: PickupModel[] = [];
    for (const p of this.pickups) {
      if (p.collected) continue;
      const dist = Math.hypot(playerX - p.x, playerY - p.y);
      if (visibleHull ? circleHitsHull(p.x,p.y,PICKUP_RADIUS,playerX,playerY) : dist <= collectRadius + PICKUP_RADIUS) {
        p.collected = true;
        collected.push(p);
      }
    }
    return collected;
  }

  clear(): void {
    this.pickups.length = 0;
  }
}

/** Tabela determinística de drops por inimigo abatido na Fenda Pelágica */
export function determineEnemyDrop(
  enemyKind: 'scout' | 'dart' | 'lancer' | 'cutter' | 'carrier' | 'miniboss' | 'boss',
  killCount: number,
): PickupType | null {
  // Only the stage's explicit cargo carriers release items. No kill-counter rewards.
  void enemyKind; void killCount;
  return null;
}
