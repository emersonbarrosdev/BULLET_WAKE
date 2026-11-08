/**
 * Chefe da Fase 04: Interceptador de Tempestade.
 * Aeronave de contenção atmosférica rápida, energizada por tempestades de íons.
 * Lógica pura e modular para simulação e testes.
 */
import type { StageBoss, BossTick, BossShot, BossSpawnEvent, BossHitResult, BossModule } from './types.ts';

export class BossInterceptor implements StageBoss {
  readonly name = 'Interceptador de Tempestade';
  x = 880;
  y = 216;
  readonly maxHp = 190;
  hp = 190;

  phase = 'intro';
  ageMs = 0;
  phaseTimerMs = 2400;
  shootTimerMs = 900;
  dashTimerMs = 3800;
  isTelegraphing = false;

  readonly modules: BossModule[] = [
    {
      id: 'wing_top',
      name: 'Asa Estática Superior',
      offsetX: 10,
      offsetY: -40,
      width: 48,
      height: 24,
      hp: 35,
      maxHp: 35,
      destroyed: false,
    },
    {
      id: 'wing_bottom',
      name: 'Asa Estática Inferior',
      offsetX: 10,
      offsetY: 40,
      width: 48,
      height: 24,
      hp: 35,
      maxHp: 35,
      destroyed: false,
    },
    {
      id: 'railgun',
      name: 'Canhão de Íons',
      offsetX: -55,
      offsetY: 0,
      width: 50,
      height: 26,
      hp: 45,
      maxHp: 45,
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

    if (this.phase === 'intro') {
      this.x -= (160 * dt) / 1000;
      this.phaseTimerMs -= dt;
      if (this.phaseTimerMs <= 0 || this.x <= 620) {
        this.phase = 'phase1';
        this.shootTimerMs = 600;
      }
    } else {
      // Evasão rápida seguindo a altura do jogador com amortecimento
      const followSpeed = this.phase === 'phase3' ? 4.2 : 2.8;
      this.y += (playerY - this.y) * Math.min(1, (dt * followSpeed) / 1000);

      if (this.hp <= 50) {
        this.phase = 'phase3';
      } else if (this.hp <= 110) {
        this.phase = 'phase2';
      }

      this.shootTimerMs -= dt;
      this.dashTimerMs -= dt;

      // Fase 1: Disparos de plasma duplo e minas atmosféricas lentas
      if (this.phase === 'phase1') {
        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 1000;
          shots.push({
            x: this.x - 55,
            y: this.y - 12,
            velocityX: -290,
            velocityY: 0,
            damage: 1,
          });
          shots.push({
            x: this.x - 55,
            y: this.y + 12,
            velocityX: -290,
            velocityY: 0,
            damage: 1,
          });
        }
      }

      // Fase 2: Feixe ionizado telegrafado na linha do jogador
      if (this.phase === 'phase2') {
        if (this.dashTimerMs <= 900 && this.dashTimerMs > 0) {
          this.isTelegraphing = true;
        } else if (this.dashTimerMs <= 0) {
          this.isTelegraphing = false;
          this.dashTimerMs = 3600;
          // Três disparos de alta velocidade formando linha de raio
          for (let step = 0; step < 3; step++) {
            shots.push({
              x: this.x - 55 - step * 30,
              y: this.y,
              velocityX: -360,
              velocityY: 0,
              damage: 1,
            });
          }
          spawns.push({ kind: 'lancer', x: this.x, y: this.y > 216 ? 120 : 310 });
        }

        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 850;
          const dx = playerX - (this.x - 50);
          const dy = playerY - this.y;
          const len = Math.hypot(dx, dy) || 1;
          shots.push({
            x: this.x - 50,
            y: this.y,
            velocityX: (dx / len) * 270,
            velocityY: (dy / len) * 270,
            damage: 1,
          });
        }
      }

      // Fase 3: Sobrecarga de íons, tempestade de descargas em anel
      if (this.phase === 'phase3') {
        this.isTelegraphing = false;
        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 550;
          for (let k = 0; k < 6; k++) {
            const angle = (k / 6) * Math.PI - Math.PI / 2;
            shots.push({
              x: this.x - 50,
              y: this.y,
              velocityX: -250 * Math.cos(angle),
              velocityY: 250 * Math.sin(angle),
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

    const actualDamage = Math.max(0, amount);
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
