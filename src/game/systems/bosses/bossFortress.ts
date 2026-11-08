/**
 * Chefe da Fase 03: Fortaleza de Núcleos.
 * Fábrica orbital de suporte vital reconfigurada pela MALHA em fortaleza armada.
 * Lógica pura e modular para simulação e testes.
 */
import type { StageBoss, BossTick, BossShot, BossSpawnEvent, BossHitResult, BossModule } from './types.ts';

export class BossFortress implements StageBoss {
  readonly name = 'Fortaleza de Núcleos';
  x = 880;
  y = 216;
  readonly maxHp = 160;
  hp = 160;

  phase = 'intro';
  ageMs = 0;
  phaseTimerMs = 2800;
  shootTimerMs = 1300;
  barrierTimerMs = 5000;
  isTelegraphing = false;

  readonly modules: BossModule[] = [
    {
      id: 'core_top',
      name: 'Núcleo Superior',
      offsetX: -20,
      offsetY: -55,
      width: 40,
      height: 40,
      hp: 35,
      maxHp: 35,
      destroyed: false,
    },
    {
      id: 'core_bottom',
      name: 'Núcleo Inferior',
      offsetX: -20,
      offsetY: 55,
      width: 40,
      height: 40,
      hp: 35,
      maxHp: 35,
      destroyed: false,
    },
    {
      id: 'barrier',
      name: 'Escudo Protetor',
      offsetX: -65,
      offsetY: 0,
      width: 30,
      height: 90,
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

    // Movimentação lenta e majestosa oscilando verticalmente
    const targetY = 216 + Math.sin(this.ageMs / 800) * 45;
    this.y += (targetY - this.y) * Math.min(1, (dt * 2.0) / 1000);

    if (this.phase === 'intro') {
      this.x -= (110 * dt) / 1000;
      this.phaseTimerMs -= dt;
      if (this.phaseTimerMs <= 0 || this.x <= 610) {
        this.phase = 'phase1';
        this.shootTimerMs = 700;
      }
    } else {
      if (this.hp <= 45) {
        this.phase = 'phase3';
      } else if (this.hp <= 100) {
        this.phase = 'phase2';
      }

      this.shootTimerMs -= dt;
      this.barrierTimerMs -= dt;

      // Fase 1: Disparos alternados dos núcleos superior e inferior
      if (this.phase === 'phase1') {
        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 1200;
          shots.push({
            x: this.x - 40,
            y: this.y - 45,
            velocityX: -250,
            velocityY: 0,
            damage: 1,
          });
          shots.push({
            x: this.x - 40,
            y: this.y + 45,
            velocityX: -250,
            velocityY: 0,
            damage: 1,
          });
        }
      }

      // Fase 2: Padrão cruzado de energia e fabricação de sentinelas
      if (this.phase === 'phase2') {
        if (this.barrierTimerMs <= 1100 && this.barrierTimerMs > 0) {
          this.isTelegraphing = true;
        } else if (this.barrierTimerMs <= 0) {
          this.isTelegraphing = false;
          this.barrierTimerMs = 5200;
          spawns.push({ kind: 'scout', x: this.x - 50, y: this.y });
        }

        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 950;
          for (const angle of [-0.35, -0.15, 0.15, 0.35]) {
            shots.push({
              x: this.x - 40,
              y: this.y,
              velocityX: -240 * Math.cos(angle),
              velocityY: 240 * Math.sin(angle),
              damage: 1,
            });
          }
        }
      }

      // Fase 3: Reator central instável, rajadas omnidirecionais
      if (this.phase === 'phase3') {
        this.isTelegraphing = false;
        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 650;
          const dx = playerX - (this.x - 40);
          const dy = playerY - this.y;
          const len = Math.hypot(dx, dy) || 1;
          shots.push({
            x: this.x - 40,
            y: this.y,
            velocityX: (dx / len) * 270,
            velocityY: (dy / len) * 270,
            damage: 1,
          });
          shots.push({
            x: this.x - 40,
            y: this.y - 30,
            velocityX: -220,
            velocityY: -80,
            damage: 1,
          });
          shots.push({
            x: this.x - 40,
            y: this.y + 30,
            velocityX: -220,
            velocityY: 80,
            damage: 1,
          });
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

    // Se o escudo frontal ainda estiver intacto, reduz dano direto ao chassi
    const barrier = this.modules.find(m => m.id === 'barrier');
    if (barrier && !barrier.destroyed && hitX > this.x - 65) {
      actualDamage *= 0.65;
    }

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
