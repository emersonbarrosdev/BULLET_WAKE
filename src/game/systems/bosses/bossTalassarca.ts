/**
 * BULLET WAKE V2 — Boss Colossal da Fase 1 (Fenda Pelágica):
 * TALASSARCA — O DEVORADOR DAS MARÉS
 * 
 * Entidade extraterrestre biomecânica colossal emergindo do abismo oceânico.
 * 3 Fases completas de combate vertical top-down:
 * - Fase 1 (Asas e Pinças): Salvas intercaladas das extensões laterais e leques quíntuplos.
 * - Fase 2 (Tentáculos Energéticos): Projéteis espirais, tentáculos bioelétricos e destruição das partes laterais.
 * - Fase 3 (Núcleo Vulnerável): Núcleo central exposto com 1.5x de dano crítico, anéis concêntricos com corredores seguros.
 */
import type { StageBoss, BossTick, BossShot, BossSpawnEvent, BossHitResult, BossModule } from './types.ts';
import { PLAYFIELD_X, PLAYFIELD_WIDTH } from '../../constants.ts';

export class BossTalassarca implements StageBoss {
  name = 'TALASSARCA';
  readonly maxHp = 160;
  hp = 160;
  x = PLAYFIELD_X + PLAYFIELD_WIDTH / 2; // Centro do corredor: 384
  y = 110; // Posicionado no topo da arena de combate

  phase: 'intro' | 'wings' | 'tentacles' | 'core' | 'defeated' = 'intro';
  isTelegraphing = false;

  private introTimerMs = 1800;
  private attackTimerMs = 0;
  private shotCycle = 0;
  private coreVulnerable = false;
  private ringAngle = 0;

  modules: BossModule[] = [
    {
      id: 'wing_left',
      name: 'Asa Esquerda',
      offsetX: -85,
      offsetY: 10,
      width: 60,
      height: 40,
      hp: 35,
      maxHp: 35,
      destroyed: false,
    },
    {
      id: 'wing_right',
      name: 'Asa Direita',
      offsetX: 85,
      offsetY: 10,
      width: 60,
      height: 40,
      hp: 35,
      maxHp: 35,
      destroyed: false,
    },
    {
      id: 'core',
      name: 'Núcleo Abissal',
      offsetX: 0,
      offsetY: 15,
      width: 44,
      height: 44,
      hp: 90,
      maxHp: 90,
      destroyed: false,
    },
  ];

  update(dt: number, playerX: number, playerY: number): BossTick {
    const shots: BossShot[] = [];
    const spawns: BossSpawnEvent[] = [];
    let phaseChanged = false;

    // 1. Sequência Cinematográfica de Entrada
    if (this.phase === 'intro') {
      this.introTimerMs -= dt;
      // Desce suavemente até a posição de combate
      this.y = Math.min(110, -75 + (1 - this.introTimerMs / 1800) * 185);
      if (this.introTimerMs <= 0) {
        this.phase = 'wings';
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

    // Movimentação lateral suave no topo da arena
    this.x = (PLAYFIELD_X + PLAYFIELD_WIDTH / 2) + Math.sin(Date.now() / 1400) * 55;

    this.attackTimerMs += dt;

    // Transições de fase por HP ou destruição das partes
    if (this.phase === 'wings' && (this.hp <= 110 || (this.modules[0].destroyed && this.modules[1].destroyed))) {
      this.phase = 'tentacles';
      phaseChanged = true;
      this.attackTimerMs = 0;
    } else if (this.phase === 'tentacles' && this.hp <= 55) {
      this.phase = 'core';
      this.coreVulnerable = true;
      phaseChanged = true;
      this.attackTimerMs = 0;
    }

    // ==========================================
    // FASE 1: ASAS E PINÇAS (160 - 110 HP)
    // ==========================================
    if (this.phase === 'wings') {
      if (this.attackTimerMs >= 1100) {
        this.attackTimerMs = 0;
        this.shotCycle++;

        // Salvas alternadas das asas esquerda e direita
        const leftAlive = !this.modules[0].destroyed;
        const rightAlive = !this.modules[1].destroyed;

        if (this.shotCycle % 2 === 0 && leftAlive) {
          // Leque triplo da asa esquerda mirando para baixo
          for (const vx of [-90, -40, 10]) {
            shots.push({
              x: this.x - 70,
              y: this.y + 20,
              velocityX: vx,
              velocityY: 210,
              damage: 1,
            });
          }
        } else if (rightAlive) {
          // Leque triplo da asa direita
          for (const vx of [-10, 40, 90]) {
            shots.push({
              x: this.x + 70,
              y: this.y + 20,
              velocityX: vx,
              velocityY: 210,
              damage: 1,
            });
          }
        }

        // Leque quíntuplo central a cada 3 ciclos
        if (this.shotCycle % 3 === 0) {
          const angles = [-140, -70, 0, 70, 140];
          for (const vx of angles) {
            shots.push({
              x: this.x,
              y: this.y + 25,
              velocityX: vx,
              velocityY: 195,
              damage: 1,
            });
          }
        }
      }
    }

    // ==========================================
    // FASE 2: TENTÁCULOS BIOELÉTRICOS (110 - 55 HP)
    // ==========================================
    else if (this.phase === 'tentacles') {
      if (this.attackTimerMs >= 850) {
        this.attackTimerMs = 0;
        this.shotCycle++;

        // Disparo espiral bioelétrico
        this.ringAngle += 0.35;
        for (let i = 0; i < 6; i++) {
          const ang = this.ringAngle + (i * Math.PI) / 3;
          shots.push({
            x: this.x,
            y: this.y + 15,
            velocityX: Math.cos(ang) * 180,
            velocityY: Math.abs(Math.sin(ang)) * 180 + 40, // Direcionado para baixo
            damage: 1,
          });
        }

        // Tiro direto rápido telegrafado na posição do jogador
        const dx = playerX - this.x;
        const dy = playerY - (this.y + 30);
        const dist = Math.hypot(dx, dy) || 1;
        shots.push({
          x: this.x,
          y: this.y + 30,
          velocityX: (dx / dist) * 260,
          velocityY: (dy / dist) * 260,
          damage: 1,
        });

        // Invoca criatura de suporte esporadicamente
        if (this.shotCycle % 4 === 0) {
          spawns.push({
            kind: 'scout',
            x: this.x + (this.shotCycle % 2 === 0 ? -90 : 90),
            y: this.y,
          });
        }
      }
    }

    // ==========================================
    // FASE 3: NÚCLEO EXPOSTO (55 - 0 HP)
    // ==========================================
    else if (this.phase === 'core') {
      this.isTelegraphing = Math.sin(Date.now() / 90) > 0;

      if (this.attackTimerMs >= 700) {
        this.attackTimerMs = 0;
        this.shotCycle++;
        this.ringAngle += 0.22;

        // Anel com corredores de segurança (aberturas regulares para evasão)
        const totalProjectiles = 10;
        for (let i = 0; i < totalProjectiles; i++) {
          // Pula 2 posições consecutivas para criar corredor seguro de fuga
          if (i === 2 || i === 7) continue;

          const ang = this.ringAngle + (i * Math.PI * 2) / totalProjectiles;
          shots.push({
            x: this.x,
            y: this.y + 20,
            velocityX: Math.cos(ang) * 190,
            velocityY: Math.abs(Math.sin(ang)) * 190 + 50,
            damage: 1,
          });
        }

        // Disparo duplo frontal acelerado
        shots.push(
          { x: this.x - 14, y: this.y + 35, velocityX: -30, velocityY: 280, damage: 1 },
          { x: this.x + 14, y: this.y + 35, velocityX: 30, velocityY: 280, damage: 1 },
        );
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

  damage(amount: number, hitX = this.x, hitY = this.y): BossHitResult {
    return this.takeDamage(amount, hitX, hitY);
  }

  takeDamage(amount: number, hitX?: number, _hitY?: number): BossHitResult {
    if (this.phase === 'intro' || this.phase === 'defeated') {
      return { bossDamage: 0, moduleDestroyed: null, killed: false };
    }

    // Na fase 3, dano no núcleo tem multiplicador crítico de 1.5x
    let finalDamage = amount;
    if (this.coreVulnerable) {
      finalDamage = Math.round(amount * 1.5 * 10) / 10;
    }

    let moduleDestroyed: string | null = null;

    // Verifica impacto nas asas durante a Fase 1
    if (this.phase === 'wings' && hitX !== undefined) {
      if (hitX < this.x - 40 && !this.modules[0].destroyed) {
        this.modules[0].hp = Math.max(0, this.modules[0].hp - amount);
        if (this.modules[0].hp <= 0) {
          this.modules[0].destroyed = true;
          moduleDestroyed = this.modules[0].name;
        }
      } else if (hitX > this.x + 40 && !this.modules[1].destroyed) {
        this.modules[1].hp = Math.max(0, this.modules[1].hp - amount);
        if (this.modules[1].hp <= 0) {
          this.modules[1].destroyed = true;
          moduleDestroyed = this.modules[1].name;
        }
      }
    }

    this.hp = Math.max(0, this.hp - finalDamage);

    const killed = this.hp <= 0;
    if (killed) {
      this.phase = 'defeated';
      this.modules.forEach((m) => { m.destroyed = true; });
    }

    return {
      bossDamage: finalDamage,
      moduleDestroyed,
      killed,
    };
  }
}
