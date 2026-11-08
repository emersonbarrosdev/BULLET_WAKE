/**
 * Chefe da Fase 01: KRM-17 Excavator.
 * Máquina de mineração industrial convertida pela MALHA.
 * Lógica pura, modular e desacoplada do Phaser.
 */

import type { StageBoss } from './bosses/types.ts';

export type BossPhase = 'intro' | 'phase1_turrets' | 'phase2_drill' | 'phase3_core' | 'defeated';

export interface BossModule {
  id: string;
  name: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface BossShot {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
}

export interface BossSpawnEvent {
  kind: 'scout';
  x: number;
  y: number;
}

export interface BossTick {
  phase: BossPhase;
  phaseChanged: boolean;
  shots: BossShot[];
  spawns: BossSpawnEvent[];
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  telegraph: boolean;
  defeated: boolean;
}

export class BossKrm17 implements StageBoss {
  readonly name = 'KRM-17 Excavator';
  x = 880; // Inicia fora da tela à direita
  y = 216; // Centralizado verticalmente
  targetX = 640;
  baseY = 216;

  phase: BossPhase = 'intro';
  ageMs = 0;
  phaseTimerMs = 2800; // Duração da introdução
  shootTimerMs = 1200;
  specialTimerMs = 3500;
  isTelegraphing = false;

  readonly maxHp = 140;
  hp = 140;

  // Módulos destrutíveis
  readonly modules: BossModule[] = [
    {
      id: 'turret_top',
      name: 'Torre Superior',
      offsetX: 15,
      offsetY: -34,
      width: 32,
      height: 24,
      hp: 20,
      maxHp: 20,
      destroyed: false,
    },
    {
      id: 'turret_bottom',
      name: 'Torre Inferior',
      offsetX: 15,
      offsetY: 34,
      width: 32,
      height: 24,
      hp: 20,
      maxHp: 20,
      destroyed: false,
    },
    {
      id: 'drill',
      name: 'Broca de Mineração',
      offsetX: -62,
      offsetY: 0,
      width: 48,
      height: 40,
      hp: 30,
      maxHp: 30,
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
      // Movimento suave de entrada da direita para o posto de combate
      this.x += (this.targetX - this.x) * Math.min(1, (dt / 1000) * 2.2);
      this.phaseTimerMs -= dt;
      if (this.phaseTimerMs <= 0) {
        this.phase = 'phase1_turrets';
        this.shootTimerMs = 1000;
      }
      return {
        phase: this.phase,
        phaseChanged: previousPhase !== this.phase,
        shots,
        spawns,
        hp: this.hp,
        maxHp: this.maxHp,
        x: this.x,
        y: this.y,
        telegraph: false,
        defeated: false,
      };
    }

    // Movimentação orbital vertical suave
    this.y = this.baseY + Math.sin(this.ageMs / 550) * 65;

    // FASE 1: Armas laterais ativas
    if (this.phase === 'phase1_turrets') {
      this.shootTimerMs -= dt;
      if (this.shootTimerMs <= 0) {
        this.shootTimerMs = 1100;

        // Disparo das torres que ainda não foram destruídas
        const top = this.modules[0];
        const bot = this.modules[1];

        if (!top.destroyed) {
          shots.push(this.aimShot(this.x + top.offsetX, this.y + top.offsetY, playerX, playerY, 220, -0.12));
        }
        if (!bot.destroyed) {
          shots.push(this.aimShot(this.x + bot.offsetX, this.y + bot.offsetY, playerX, playerY, 220, +0.12));
        }
      }

      // Transição de fase por dano recebido
      if (this.hp <= 45) {
        this.phase = 'phase3_core';
        this.shootTimerMs = 1000;
      } else if (this.hp <= 95 || (this.modules[0].destroyed && this.modules[1].destroyed)) {
        this.phase = 'phase2_drill';
        this.phaseTimerMs = 0;
        this.specialTimerMs = 2800;
        this.shootTimerMs = 1100;
      }
    }

    // FASE 2: Broca ativada + Drones Scouts
    else if (this.phase === 'phase2_drill') {
      this.specialTimerMs -= dt;
      this.shootTimerMs -= dt;

      // Telegraph de investida da broca
      if (this.specialTimerMs <= 800 && this.specialTimerMs > 0) {
        this.isTelegraphing = true;
      } else if (this.specialTimerMs <= 0) {
        this.isTelegraphing = false;
        this.specialTimerMs = 4000;
        // Solta 2 drones scouts de apoio de mineração
        spawns.push({ kind: 'scout', x: this.x + 20, y: this.y - 45 });
        spawns.push({ kind: 'scout', x: this.x + 20, y: this.y + 45 });
      }

      if (this.shootTimerMs <= 0) {
        this.shootTimerMs = 1350;
        // Rajada frontal angular da broca em leque de 5 vias
        for (const angle of [-0.40, -0.20, 0, 0.20, 0.40]) {
          shots.push({
            x: this.x - 55,
            y: this.y,
            velocityX: -230 * Math.cos(angle),
            velocityY: 230 * Math.sin(angle),
            damage: 1,
          });
        }
      }

      // Transição para Fase 3 se HP cair abaixo de 45
      if (this.hp <= 45) {
        this.phase = 'phase3_core';
        this.shootTimerMs = 1000;
      }
    }

    // FASE 3: Núcleo aberto exposto — Sobrecarga de emergência
    else if (this.phase === 'phase3_core') {
      this.shootTimerMs -= dt;
      if (this.shootTimerMs <= 0) {
        this.shootTimerMs = 1300;
        // Salva radial de emergência em 10 direções
        const numShots = 10;
        for (let i = 0; i < numShots; i++) {
          const a = (i * 2 * Math.PI) / numShots + (this.ageMs / 900);
          shots.push({
            x: this.x - 10,
            y: this.y,
            velocityX: Math.cos(a) * 200,
            velocityY: Math.sin(a) * 200,
            damage: 1,
          });
        }
      }
    }

    return {
      phase: this.phase,
      phaseChanged: previousPhase !== this.phase,
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

  damage(amount: number, hitX: number, hitY: number): {
    bossDamage: number;
    moduleDestroyed: string | null;
    killed: boolean;
  } {
    if (this.phase === 'intro' || this.phase === 'defeated') {
      return { bossDamage: 0, moduleDestroyed: null, killed: false };
    }

    let actualDamage = amount;
    let destroyedModule: string | null = null;

    // Testa acerto em módulos específicos
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

    // Se estiver na fase 3 com núcleo aberto, ponto fraco recebe dano ampliado
    if (this.phase === 'phase3_core') {
      if (Math.abs(hitX - (this.x - 10)) <= 22 && Math.abs(hitY - this.y) <= 22) {
        actualDamage *= 1.45; // Ponto fraco crítico
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

  private aimShot(fromX: number, fromY: number, toX: number, toY: number, speed: number, angleOffset = 0): BossShot {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const baseAngle = Math.atan2(dy, dx);
    const finalAngle = baseAngle + angleOffset;
    return {
      x: fromX,
      y: fromY,
      velocityX: speed * Math.cos(finalAngle),
      velocityY: speed * Math.sin(finalAngle),
      damage: 1,
    };
  }
}
