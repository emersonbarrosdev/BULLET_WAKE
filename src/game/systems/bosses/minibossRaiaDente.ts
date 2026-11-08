/**
 * BULLET WAKE V2 — Miniboss da Fase 1 (Fenda Pelágica):
 * RAIA-DENTE
 * 
 * Grande criatura biomecânica alienígena de vista superior (top-down).
 * Desce na metade da fase (aprox. 1800m), com asas extensas e múltiplos padrões de tiro.
 */
import type { StageBoss, BossTick, BossShot, BossSpawnEvent, BossHitResult } from './types.ts';
import { PLAYFIELD_X, PLAYFIELD_WIDTH } from '../../constants.ts';

export class MinibossRaiaDente implements StageBoss {
  name = 'RAIA-DENTE';
  readonly maxHp = 45;
  hp = 45;
  x = PLAYFIELD_X + PLAYFIELD_WIDTH / 2; // Centro do corredor: 384
  y = 85;

  phase: 'intro' | 'active' | 'defeated' = 'intro';
  isTelegraphing = false;

  private introTimerMs = 1200;
  private attackTimerMs = 0;
  private shotCycle = 0;

  update(dt: number, playerX: number, playerY: number): BossTick {
    const shots: BossShot[] = [];
    const spawns: BossSpawnEvent[] = [];
    let phaseChanged = false;

    if (this.phase === 'intro') {
      this.introTimerMs -= dt;
      this.y = Math.min(85, -40 + (1 - this.introTimerMs / 1200) * 125);
      if (this.introTimerMs <= 0) {
        this.phase = 'active';
        phaseChanged = true;
      }
      return {
        phase: this.phase,
        phaseChanged,
        shots,
        spawns,
        hp: this.hp,
        maxHp: this.maxHp,
        x: this.x,
        y: this.y,
        telegraph: true,
        defeated: false,
      };
    }

    if (this.phase === 'defeated') {
      return {
        phase: this.phase,
        phaseChanged: false,
        shots,
        spawns,
        hp: 0,
        maxHp: this.maxHp,
        x: this.x,
        y: this.y,
        telegraph: false,
        defeated: true,
      };
    }

    // Movimentação sinusoidal lateral no corredor
    this.x = (PLAYFIELD_X + PLAYFIELD_WIDTH / 2) + Math.sin(Date.now() / 900) * 65;
    this.attackTimerMs += dt;

    if (this.attackTimerMs >= 1000) {
      this.attackTimerMs = 0;
      this.shotCycle++;

      const pattern = this.shotCycle % 3;

      // Padrão A: Rajadas alternadas das pontas das asas
      if (pattern === 0) {
        shots.push(
          { x: this.x - 38, y: this.y + 15, velocityX: -40, velocityY: 220, damage: 1 },
          { x: this.x + 38, y: this.y + 15, velocityX: 40, velocityY: 220, damage: 1 },
        );
      }
      // Padrão B: Arco de 4 projéteis com abertura central de esquiva
      else if (pattern === 1) {
        for (const vx of [-130, -50, 50, 130]) {
          shots.push({
            x: this.x,
            y: this.y + 20,
            velocityX: vx,
            velocityY: 200,
            damage: 1,
          });
        }
      }
      // Padrão C: Disparo direto mirado na nave do jogador
      else if (pattern === 2) {
        const dx = playerX - this.x;
        const dy = playerY - (this.y + 20);
        const dist = Math.hypot(dx, dy) || 1;
        shots.push(
          {
            x: this.x - 10,
            y: this.y + 20,
            velocityX: (dx / dist) * 240,
            velocityY: (dy / dist) * 240,
            damage: 1,
          },
          {
            x: this.x + 10,
            y: this.y + 20,
            velocityX: (dx / dist) * 240,
            velocityY: (dy / dist) * 240,
            damage: 1,
          },
        );

        // Libera criatura de suporte esporadicamente
        if (this.shotCycle % 6 === 5) {
          spawns.push({
            kind: 'scout',
            x: this.x + (Math.random() > 0.5 ? 50 : -50),
            y: this.y - 10,
          });
        }
      }
    }

    return {
      phase: this.phase,
      phaseChanged,
      shots,
      spawns,
      hp: this.hp,
      maxHp: this.maxHp,
      x: this.x,
      y: this.y,
      telegraph: this.isTelegraphing,
      defeated: false,
    };
  }

  damage(amount: number, _hitX = this.x, _hitY = this.y): BossHitResult {
    return this.takeDamage(amount);
  }

  takeDamage(amount: number): BossHitResult {
    if (this.phase === 'intro' || this.phase === 'defeated') {
      return { bossDamage: 0, moduleDestroyed: null, killed: false };
    }

    this.hp = Math.max(0, this.hp - amount);
    const killed = this.hp <= 0;
    if (killed) {
      this.phase = 'defeated';
    }

    return {
      bossDamage: amount,
      moduleDestroyed: null,
      killed,
    };
  }
}
