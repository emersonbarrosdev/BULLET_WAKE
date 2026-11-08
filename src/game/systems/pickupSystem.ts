/**
 * BULLET WAKE V2 — Sistema de Power-ups e Cápsulas Físicas Coletáveis (Estilo Fire Shark)
 * 
 * Regra Crítica:
 * - NENHUM coletável recupera cargas de Dash (as 3 cargas por fase são fixas).
 * - Itens aparecem fisicamente na arena de combate e flutuam descendo suavemente.
 * - Coleta automática por contato com atração magnética quando o jogador está próximo.
 */
import { PLAYFIELD_X, PLAYFIELD_RIGHT } from '../constants.ts';

export type PickupType =
  | 'power'         // P: Aumenta o nível da arma equipada (1 a 4)
  | 'weapon_green'  // W: Troca para Pulso Verde
  | 'weapon_ion'    // W: Troca para Laser de Íons
  | 'weapon_red'    // W: Troca para Plasma Vermelho
  | 'health'        // H: Recupera 1 ponto de vida
  | 'bomb'          // B: Concede 1 bomba (máx 4)
  | 'missile'       // M: Reabastece munição de mísseis
  | 'score'         // S: Concede pontos (1.000 pts)
  | 'special';      // E: Energia de ressonância especial (+35%)

export interface PickupModel {
  id: number;
  type: PickupType;
  x: number;
  y: number;
  baseX: number;
  ageMs: number;
  collected: boolean;
}

export const PICKUP_RADIUS = 16;
export const PICKUP_MAGNET_RADIUS = 75;
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
    };
    this.pickups.push(pickup);
    return pickup;
  }

  update(deltaMs: number, playerX: number, playerY: number): void {
    const dt = Math.max(0, deltaMs);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.ageMs += dt;

      // Movimento de descida com oscilação horizontal senoidal suave
      const sway = Math.sin(p.ageMs / 280) * 10;

      // Atração magnética quando a nave se aproxima
      const dx = playerX - (p.baseX + sway);
      const dy = playerY - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < PICKUP_MAGNET_RADIUS && dist > 1) {
        const pull = (1 - dist / PICKUP_MAGNET_RADIUS) * 240;
        p.baseX += (dx / dist) * pull * (dt / 1000);
        p.y += (dy / dist) * pull * (dt / 1000);
      } else {
        p.y += PICKUP_FLOAT_SPEED_Y * (dt / 1000);
      }

      p.x = Math.max(PLAYFIELD_X + 16, Math.min(PLAYFIELD_RIGHT - 16, p.baseX + sway));

      // Remove se ultrapassar a borda inferior da tela ou se coletado
      if (p.y > 450 || p.y < -50 || p.collected) {
        this.pickups.splice(i, 1);
      }
    }
  }

  checkCollection(playerX: number, playerY: number, collectRadius = 24): PickupModel[] {
    const collected: PickupModel[] = [];
    for (const p of this.pickups) {
      if (p.collected) continue;
      const dist = Math.hypot(playerX - p.x, playerY - p.y);
      if (dist <= collectRadius + PICKUP_RADIUS) {
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
  if (enemyKind === 'carrier') {
    // Casulos Marinhos portadores garantem power-up ou arma
    const r = killCount % 4;
    if (r === 0) return 'power';
    if (r === 1) return 'weapon_ion';
    if (r === 2) return 'weapon_red';
    return 'weapon_green';
  }

  if (enemyKind === 'lancer' || enemyKind === 'cutter') {
    if (killCount % 4 === 1) return 'power';
    if (killCount % 4 === 2) return 'special';
    if (killCount % 4 === 3) return 'bomb';
    return 'score';
  }

  if (enemyKind === 'scout' || enemyKind === 'dart') {
    if (killCount % 7 === 3) return 'score';
    if (killCount % 11 === 5) return 'health';
  }

  if (enemyKind === 'miniboss') {
    return 'power';
  }

  return null;
}
