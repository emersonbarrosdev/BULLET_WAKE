/**
 * Chefe Final da Fase 05: Coração da MALHA.
 * Megaestrutura de processamento de contenção que gerou o Wake orbital.
 * Lógica pura e modular para simulação e testes.
 */
import type { StageBoss, BossTick, BossShot, BossSpawnEvent, BossHitResult, BossModule } from './types.ts';

export class BossMeshCore implements StageBoss {
  readonly name = 'Coração da MALHA';
  x = 880;
  y = 216;
  readonly maxHp = 240;
  hp = 240;

  phase = 'intro';
  ageMs = 0;
  phaseTimerMs = 3000;
  shootTimerMs = 900;
  wakePulseTimerMs = 4500;
  isTelegraphing = false;

  readonly modules: BossModule[] = [
    {
      id: 'subroutine_top',
      name: 'Sub-rotina Superior',
      offsetX: -10,
      offsetY: -60,
      width: 44,
      height: 44,
      hp: 50,
      maxHp: 50,
      destroyed: false,
    },
    {
      id: 'subroutine_bottom',
      name: 'Sub-rotina Inferior',
      offsetX: -10,
      offsetY: 60,
      width: 44,
      height: 44,
      hp: 50,
      maxHp: 50,
      destroyed: false,
    },
    {
      id: 'mesh_conduit',
      name: 'Condutor Central',
      offsetX: -50,
      offsetY: 0,
      width: 46,
      height: 60,
      hp: 60,
      maxHp: 60,
      destroyed: false,
    },
  ];

  update(deltaMs: number, playerX: number, playerY: number): BossTick {
    const dt = Math.max(0, deltaMs);
    this.ageMs += dt;
    const previousPhase = this.phase;
    const shots: BossShot[] = [];
    const spawns: BossSpawnEvent[] = [];

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

    // Flutuação geométrica precisa no centro direito da tela
    const targetY = 216 + Math.sin(this.ageMs / 600) * 50;
    this.y += (targetY - this.y) * Math.min(1, (dt * 2.5) / 1000);

    if (this.phase === 'intro') {
      this.x -= (100 * dt) / 1000;
      this.phaseTimerMs -= dt;
      if (this.phaseTimerMs <= 0 || this.x <= 600) {
        this.phase = 'phase1';
        this.shootTimerMs = 800;
      }
    } else {
      if (this.hp <= 65) {
        this.phase = 'phase3';
      } else if (this.hp <= 140) {
        this.phase = 'phase2';
      }

      this.shootTimerMs -= dt;
      this.wakePulseTimerMs -= dt;

      // Fase 1: Padrões espirais de contenção
      if (this.phase === 'phase1') {
        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 1100;
          for (const angle of [-0.4, -0.2, 0, 0.2, 0.4]) {
            shots.push({
              x: this.x - 45,
              y: this.y,
              velocityX: -240 * Math.cos(angle),
              velocityY: 240 * Math.sin(angle),
              damage: 1,
            });
          }
        }
      }

      // Fase 2: O Pulso do Wake ("faixa de luz cortada por lacunas escuras")
      if (this.phase === 'phase2') {
        if (this.wakePulseTimerMs <= 1200 && this.wakePulseTimerMs > 0) {
          this.isTelegraphing = true;
        } else if (this.wakePulseTimerMs <= 0) {
          this.isTelegraphing = false;
          this.wakePulseTimerMs = 4600;
          // Dispara parede horizontal de projéteis com lacunas seguras
          const gapIndex = Math.floor(Math.random() * 5); // 0 a 4
          for (let row = 0; row < 6; row++) {
            if (row === gapIndex || row === gapIndex + 1) continue; // Lacuna escura segura
            const bulletY = 90 + row * 45;
            shots.push({
              x: this.x - 50,
              y: bulletY,
              velocityX: -280,
              velocityY: 0,
              damage: 1,
            });
          }
          spawns.push({ kind: 'scout', x: this.x - 20, y: this.y > 216 ? 130 : 300 });
        }

        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 900;
          const dx = playerX - (this.x - 45);
          const dy = playerY - this.y;
          const len = Math.hypot(dx, dy) || 1;
          shots.push({
            x: this.x - 45,
            y: this.y,
            velocityX: (dx / len) * 260,
            velocityY: (dy / len) * 260,
            damage: 1,
          });
        }
      }

      // Fase 3: Desconexão da instrução destrutiva - Clímax total
      if (this.phase === 'phase3') {
        this.isTelegraphing = false;
        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 500;
          // Rajadas concentradas com micro deflexões
          const dx = playerX - (this.x - 45);
          const dy = playerY - this.y;
          const len = Math.hypot(dx, dy) || 1;
          for (const spread of [-0.22, 0, 0.22]) {
            shots.push({
              x: this.x - 45,
              y: this.y,
              velocityX: (dx / len) * 290 + spread * 50,
              velocityY: (dy / len) * 290 + spread * 90,
              damage: 1,
            });
          }
        }
      }
    }

    return {
      phase: this.phase,
      phaseChanged: this.phase !== previousPhase,
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

  damage(amount: number, hitX: number, hitY: number): BossHitResult {
    if (this.phase === 'intro' || this.phase === 'defeated') {
      return { bossDamage: 0, moduleDestroyed: null, killed: false };
    }

    let actualDamage = Math.max(0, amount);
    let destroyedModule: string | null = null;

    for (const mod of this.modules) {
      if (mod.destroyed) continue;
      const modX = this.x + mod.offsetX;
      const modY = this.y + mod.offsetY;
      if (
        Math.abs(hitX - modX) <= mod.width / 2 + 10 &&
        Math.abs(hitY - modY) <= mod.height / 2 + 10
      ) {
        mod.hp = Math.max(0, mod.hp - amount);
        if (mod.hp === 0) {
          mod.destroyed = true;
          destroyedModule = mod.id;
        }
        break;
      }
    }

    // Ponto fraco no condutor durante fase 3
    if (this.phase === 'phase3') {
      if (Math.abs(hitX - (this.x - 45)) <= 30 && Math.abs(hitY - this.y) <= 30) {
        actualDamage *= 1.35;
      }
    }

    this.hp = Math.max(0, this.hp - actualDamage);
    const killed = this.hp === 0;
    if (killed) {
      this.phase = 'defeated';
    }

    return {
      bossDamage: actualDamage,
      moduleDestroyed: destroyedModule,
      killed,
    };
  }
}
