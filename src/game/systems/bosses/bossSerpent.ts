/**
 * Chefe da Fase 02: Serpente de Extração.
 * Máquina escavadora segmentada que opera no Mar de Vidro.
 * Lógica pura e modular para simulação e testes.
 */
import type { StageBoss, BossTick, BossShot, BossSpawnEvent, BossHitResult, BossModule } from './types.ts';

export class BossSerpent implements StageBoss {
  readonly name = 'Serpente de Extração';
  x = 880;
  y = 216;
  readonly maxHp = 130;
  hp = 130;

  phase = 'intro';
  ageMs = 0;
  phaseTimerMs = 2600;
  shootTimerMs = 1100;
  chargeTimerMs = 4500;
  isTelegraphing = false;

  readonly modules: BossModule[] = [
    {
      id: 'tail',
      name: 'Segmento Cauda',
      offsetX: 70,
      offsetY: 0,
      width: 44,
      height: 36,
      hp: 25,
      maxHp: 25,
      destroyed: false,
    },
    {
      id: 'body',
      name: 'Corpo Blindado',
      offsetX: 10,
      offsetY: 0,
      width: 50,
      height: 42,
      hp: 35,
      maxHp: 35,
      destroyed: false,
    },
    {
      id: 'head',
      name: 'Cabeça Perfuradora',
      offsetX: -60,
      offsetY: 0,
      width: 54,
      height: 48,
      hp: 40,
      maxHp: 40,
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

    // Ondulação contínua senoidal
    const targetY = 216 + Math.sin(this.ageMs / 420) * 85;
    this.y += (targetY - this.y) * Math.min(1, (dt * 3.5) / 1000);

    if (this.phase === 'intro') {
      this.x -= (130 * dt) / 1000;
      this.phaseTimerMs -= dt;
      if (this.phaseTimerMs <= 0 || this.x <= 630) {
        this.phase = 'phase1';
        this.shootTimerMs = 800;
      }
    } else {
      // Checagem de transição de fase por HP
      if (this.hp <= 30) {
        this.phase = 'phase3';
      } else if (this.hp <= 75) {
        this.phase = 'phase2';
      }

      this.shootTimerMs -= dt;
      this.chargeTimerMs -= dt;

      // Fase 1: Disparos radiais de fragmentos de vidro
      if (this.phase === 'phase1') {
        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 1250;
          for (const angle of [-0.28, 0, 0.28]) {
            shots.push({
              x: this.x - 65,
              y: this.y,
              velocityX: -240 * Math.cos(angle),
              velocityY: 240 * Math.sin(angle),
              damage: 1,
            });
          }
        }
      }

      // Fase 2: Investida telegrafada e drones escavadores
      if (this.phase === 'phase2') {
        if (this.chargeTimerMs <= 1000 && this.chargeTimerMs > 0) {
          this.isTelegraphing = true;
        } else if (this.chargeTimerMs <= 0) {
          this.isTelegraphing = false;
          this.chargeTimerMs = 4000;
          // Spawn de drone na investida
          spawns.push({ kind: 'scout', x: this.x, y: this.y - 45 });
          spawns.push({ kind: 'scout', x: this.x, y: this.y + 45 });
        }

        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 1000;
          const dx = playerX - (this.x - 60);
          const dy = playerY - this.y;
          const len = Math.hypot(dx, dy) || 1;
          shots.push({
            x: this.x - 60,
            y: this.y,
            velocityX: (dx / len) * 230,
            velocityY: (dy / len) * 230,
            damage: 1,
          });
        }
      }

      // Fase 3: Núcleo fundido exposto, rajada contínua acelerada
      if (this.phase === 'phase3') {
        this.isTelegraphing = false;
        if (this.shootTimerMs <= 0) {
          this.shootTimerMs = 600;
          for (const spread of [-0.18, 0.18]) {
            const dx = playerX - (this.x - 60);
            const dy = playerY - this.y;
            const len = Math.hypot(dx, dy) || 1;
            shots.push({
              x: this.x - 60,
              y: this.y,
              velocityX: (dx / len) * 260 + spread * 40,
              velocityY: (dy / len) * 260 + spread * 80,
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

    // Ponto fraco na cabeça durante fase 3
    if (this.phase === 'phase3') {
      if (Math.abs(hitX - (this.x - 60)) <= 30 && Math.abs(hitY - this.y) <= 30) {
        actualDamage *= 1.4;
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

