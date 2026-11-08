/**
 * Sistema de power-ups e itens coletáveis do BULLET WAKE.
 * Lógica pura desacoplada do motor de renderização.
 */
export type PickupType = 'upgrade' | 'repair' | 'bomb' | 'resonance' | 'shield' | 'score';

export interface PickupModel {
  id: number;
  type: PickupType;
  x: number;
  y: number;
  baseY: number;
  ageMs: number;
  collected: boolean;
}

export const PICKUP_RADIUS = 18;
export const PICKUP_MAGNET_RADIUS = 85;
export const PICKUP_FLOAT_SPEED_X = -38; // Desloca suavemente para a esquerda

export class PickupSystem {
  readonly pickups: PickupModel[] = [];
  private nextId = 1;

  spawn(type: PickupType, x: number, y: number): PickupModel {
    const pickup: PickupModel = {
      id: this.nextId++,
      type,
      x,
      y,
      baseY: y,
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

      // Efeito de flutuação vertical senoidal suave
      const bob = Math.sin(p.ageMs / 260) * 8;

      // Efeito magnético de atração quando o jogador está próximo
      const dx = playerX - p.x;
      const dy = playerY - (p.baseY + bob);
      const dist = Math.hypot(dx, dy);

      if (dist < PICKUP_MAGNET_RADIUS && dist > 1) {
        const pullFactor = (1 - dist / PICKUP_MAGNET_RADIUS) * 220;
        p.x += (dx / dist) * pullFactor * (dt / 1000);
        p.baseY += (dy / dist) * pullFactor * (dt / 1000);
      } else {
        p.x += PICKUP_FLOAT_SPEED_X * (dt / 1000);
      }

      p.y = p.baseY + bob;

      // Remove fora da tela
      if (p.x < -40 || p.x > 1200 || p.y < -30 || p.y > 600 || p.collected) {
        this.pickups.splice(i, 1);
      }
    }
  }

  checkCollection(playerX: number, playerY: number, collectRadius = 26): PickupModel[] {
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

/** Tabela determinística de drops por inimigo abatido. */
export function determineEnemyDrop(
  enemyKind: 'scout' | 'dart' | 'lancer' | 'cutter' | 'miniboss' | 'boss',
  killCount: number,
): PickupType | null {
  if (enemyKind === 'lancer' || enemyKind === 'cutter') {
    // Interceptadores garantem drop útil
    if (killCount % 3 === 1) return 'upgrade';
    if (killCount % 3 === 2) return 'resonance';
    return 'score';
  }
  if (enemyKind === 'scout' || enemyKind === 'dart') {
    // Drones leves dropam periodicamente para recompensar formações limpas
    if (killCount % 12 === 4) return 'upgrade';
    if (killCount % 12 === 8) return 'resonance';
    if (killCount % 12 === 0) return 'repair';
    if (killCount % 7 === 0) return 'score';
    return null;
  }
  if (enemyKind === 'miniboss') {
    return 'bomb';
  }
  if (enemyKind === 'boss') {
    return 'repair';
  }
  return null;
}

