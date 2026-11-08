import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { clamp, moveInBounds } from '../systems/movement';
import {
  advanceHealth, applyPlayerHit, initialPlayerHealth, type HitEvent, type PlayerHealth,
} from '../systems/combat';
import {
  EnemyDirector, type EnemyModel, type EnemyShotEvent,
} from '../systems/enemyDirector';
import { CombatHud } from '../ui/CombatHud';
import { getPilot, shotIntervalMs, type PilotDefinition } from '../data/pilots';
import { createPrototypeShip } from '../ui/PrototypeShip';
import { GameOverOverlay } from '../ui/GameOverOverlay';

type Keys = Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ESC', Phaser.Input.Keyboard.Key>;
interface Projectile {
  node: Phaser.GameObjects.Rectangle;
  velocityX: number;
  velocityY: number;
}
interface EnemyVisual {
  container: Phaser.GameObjects.Container;
  warning: Phaser.GameObjects.Rectangle;
  damagePlate: Phaser.GameObjects.Rectangle;
}

/**
 * T05: ondas de Scouts e Lancers com FSM e telegraph.
 * Marcadores geométricos ainda são DEBUG, nunca sprites de arte final.
 */
export class PrototypeScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private pilot: PilotDefinition = getPilot('nolan');
  private hud!: CombatHud;
  private keyboardControls?: Keys;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private shots: Projectile[] = [];
  private enemyShots: Projectile[] = [];
  private enemyVisuals = new Map<number, EnemyVisual>();
  private director = new EnemyDirector();
  private shootCooldown = 0;
  private score = 0;
  private health: PlayerHealth = initialPlayerHealth();

  constructor() {
    super({ key: 'PrototypeScene' });
  }

  init(data: { pilotId?: string } = {}): void {
    this.pilot = getPilot(data?.pilotId);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    // Scene.restart reusa instância; esvaziar absolutamente todo estado de gameplay.
    this.shots = [];
    this.enemyShots = [];
    this.enemyVisuals.clear();
    this.director = new EnemyDirector();
    this.shootCooldown = 0;
    this.score = 0;
    this.health = initialPlayerHealth();

    this.keyboardControls = this.input.keyboard?.addKeys('W,A,S,D,SPACE,R,ESC') as Keys | undefined;
    this.cursors = this.input.keyboard?.createCursorKeys();

    this.hud = new CombatHud(this, () => this.restart());
    this.hud.setScore(this.score);
    this.hud.setHealth(this.health);
    this.hud.setWave(1);
    this.hud.setPilot(this.pilot.shipName);

    // Nave ainda representada por silhueta temporária de gameplay.
    this.ship = this.add.container(
      64, GAME_HEIGHT / 2, [createPrototypeShip(this, this.pilot)],
    );
  }

  update(_time: number, delta: number): void {
    const dt = clamp(delta, 0, 50);
    if (this.keyboardControls && Phaser.Input.Keyboard.JustDown(this.keyboardControls.R)) {
      this.restart();
      return;
    }
    if (this.keyboardControls && Phaser.Input.Keyboard.JustDown(this.keyboardControls.ESC)) {
      this.choosePilot();
      return;
    }
    if (this.health.gameOver) return;

    this.health = advanceHealth(this.health, dt);
    this.hud.update(dt);
    this.ship.setAlpha(
      this.health.invulnerableMs > 0 && Math.floor(this.health.invulnerableMs / 110) % 2 === 0
        ? 0.30 : 1,
    );

    const key = (name: keyof Keys): boolean => Boolean(this.keyboardControls?.[name].isDown);
    let dx = Number(key('D') || this.cursors?.right.isDown) - Number(key('A') || this.cursors?.left.isDown);
    let dy = Number(key('S') || this.cursors?.down.isDown) - Number(key('W') || this.cursors?.up.isDown);
    const pointer = this.input.activePointer;
    const touchingArena = pointer.isDown && pointer.y > 45 && pointer.y < GAME_HEIGHT - 25;

    if (touchingArena) {
      dx = Math.abs(pointer.x - this.ship.x) > 8 ? Math.sign(pointer.x - this.ship.x) : 0;
      dy = Math.abs(pointer.y - this.ship.y) > 8 ? Math.sign(pointer.y - this.ship.y) : 0;
    }

    const moved = moveInBounds(
      { x: this.ship.x, y: this.ship.y },
      dx, dy, this.pilot.speed, dt,
      { minX: 23, maxX: GAME_WIDTH - 24, minY: 56, maxY: GAME_HEIGHT - 32 },
    );
    this.ship.setPosition(moved.x, moved.y);

    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if ((key('SPACE') || this.cursors?.space.isDown || touchingArena) && this.shootCooldown <= 0) {
      this.fire();
      this.shootCooldown += shotIntervalMs(this.pilot);
    }

    const tick = this.director.update(dt, this.ship.x, this.ship.y);
    for (const spawned of tick.spawned) this.makeEnemyVisual(spawned);
    if (tick.waveChanged) {
      this.hud.setWave(tick.wave);
      this.hud.flash('ONDA ' + String(tick.wave).padStart(2, '0'), '#d5b8f1', 1100);
    }
    for (const enemyShot of tick.shots) this.spawnEnemyShot(enemyShot);
    this.syncEnemyVisuals();
    this.advancePlayerShots(dt);
    this.checkEnemyContacts();
    if (this.health.gameOver) return;
    this.advanceEnemyShots(dt);
  }

  private restart(): void {
    this.scene.restart({ pilotId: this.pilot.id });
  }

  private choosePilot(): void {
    this.scene.start('PilotSelectScene', { selectedPilotId: this.pilot.id });
  }

  private fire(): void {
    const heavy = this.pilot.id === 'harlan';
    const needle = this.pilot.id === 'cora';
    const node = this.add.rectangle(
      this.ship.x + (heavy ? 25 : 21),
      this.ship.y,
      heavy ? 11 : needle ? 9 : 7,
      heavy ? 5 : needle ? 2 : 3,
      this.pilot.projectileColor,
    );
    this.shots.push({ node, velocityX: 300, velocityY: 0 });
  }

  private makeEnemyVisual(enemy: EnemyModel): void {
    const isScout = enemy.kind === 'scout';
    const hull = this.add.graphics();
    hull.fillStyle(isScout ? 0x803c53 : 0x533c62);
    hull.fillRect(isScout ? -8 : -13, isScout ? -5 : -7, isScout ? 16 : 26, isScout ? 10 : 14);
    hull.fillStyle(isScout ? 0xd95f61 : 0xb9757f);
    hull.fillRect(isScout ? -7 : -10, isScout ? -8 : -11, isScout ? 12 : 20, 3);
    hull.fillRect(isScout ? -7 : -10, isScout ? 5 : 8, isScout ? 12 : 20, 3);
    hull.fillStyle(0xffba76);
    hull.fillRect(-10, -2, 3, 4);

    const damagePlate = this.add.rectangle(0, 0, isScout ? 11 : 17, 3, 0xffbc83)
      .setAlpha(0);
    const warning = this.add.rectangle(-14, 0, 4, isScout ? 10 : 16, 0xffd48e)
      .setAlpha(0);
    const container = this.add.container(enemy.x, enemy.y, [hull, damagePlate, warning]);
    container.setDepth(3);
    this.enemyVisuals.set(enemy.id, { container, warning, damagePlate });
  }

  private syncEnemyVisuals(): void {
    const active = new Set(this.director.enemies.map(enemy => enemy.id));
    for (const [id, visual] of this.enemyVisuals) {
      if (!active.has(id)) {
        visual.container.destroy();
        this.enemyVisuals.delete(id);
      }
    }
    for (const enemy of this.director.enemies) {
      const visual = this.enemyVisuals.get(enemy.id);
      if (!visual) continue;
      visual.container.setPosition(enemy.x, enemy.y);
      // Indicador de preparação piscante; a bala só dispara após este aviso.
      visual.warning.setAlpha(
        enemy.phase === 'telegraph'
          ? (Math.floor(enemy.ageMs / 120) % 2 === 0 ? 1 : 0.45)
          : enemy.phase === 'attack' ? 0.7 : 0,
      );
      visual.damagePlate.setAlpha(enemy.hp < enemy.maxHp ? 0.9 : 0);
    }
  }

  private spawnEnemyShot(event: EnemyShotEvent): void {
    if (this.enemyShots.length >= 45) return;
    const bullet = this.add.rectangle(event.x, event.y, 5, 5, 0xffba76);
    bullet.setStrokeStyle(1, 0xd75e56);
    this.enemyShots.push({
      node: bullet,
      velocityX: event.velocityX,
      velocityY: event.velocityY,
    });
  }

  private advancePlayerShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i];
      shot.node.x += shot.velocityX * dt / 1000;
      let collided = false;
      for (const enemy of this.director.enemies) {
        const extentX = enemy.kind === 'scout' ? 10 : 16;
        const extentY = enemy.kind === 'scout' ? 8 : 10;
        if (Math.abs(shot.node.x - enemy.x) <= extentX
          && Math.abs(shot.node.y - enemy.y) <= extentY) {
          const outcome = this.director.damage(enemy.id, this.pilot.damage);
          if (outcome.killed) {
            this.score += outcome.score;
            this.hud.setScore(this.score);
            this.syncEnemyVisuals();
          }
          collided = true;
          break;
        }
      }
      if (collided || shot.node.x > GAME_WIDTH + 8) {
        shot.node.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  private checkEnemyContacts(): void {
    for (const enemy of this.director.enemies) {
      const extentX = enemy.kind === 'scout' ? 15 : 20;
      const extentY = enemy.kind === 'scout' ? 11 : 13;
      if (Math.abs(this.ship.x - enemy.x) <= extentX
        && Math.abs(this.ship.y - enemy.y) <= extentY) {
        const result = this.damageShip();
        // Evita um inimigo colado repetir contato quando a proteção acaba.
        this.director.remove(enemy.id);
        this.syncEnemyVisuals();
        if (result === 'game-over') return;
        break;
      }
    }
  }

  private advanceEnemyShots(dt: number): void {
    for (let i = this.enemyShots.length - 1; i >= 0; i -= 1) {
      const shot = this.enemyShots[i];
      shot.node.x += shot.velocityX * dt / 1000;
      shot.node.y += shot.velocityY * dt / 1000;
      const hit = Math.abs(shot.node.x - this.ship.x) <= 8
        && Math.abs(shot.node.y - this.ship.y) <= 6;
      const outside = shot.node.x < -8 || shot.node.x > GAME_WIDTH + 8
        || shot.node.y < -8 || shot.node.y > GAME_HEIGHT + 8;
      if (hit || outside) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }
      if (hit) {
        const event = this.damageShip();
        if (event === 'respawn' || event === 'game-over') return;
      }
    }
  }

  private damageShip(): HitEvent {
    const result = applyPlayerHit(this.health);
    this.health = result.state;
    if (result.event === 'ignored') return result.event;
    this.hud.setHealth(this.health);
    if (result.event === 'damaged') {
      this.hud.flash('ACERTO!  -1 HP', '#ffb77b', 1000);
    }
    if (result.event === 'respawn') {
      this.clearEnemyShots();
      this.ship.setPosition(64, GAME_HEIGHT / 2);
      this.ship.setAlpha(1);
      this.hud.flash('VIDA PERDIDA  /  PROTEGIDO', '#f4c480', 1500);
    }
    if (result.event === 'game-over') {
      this.clearEnemyShots();
      this.clearPlayerShots();
      this.ship.setVisible(false);
      new GameOverOverlay(this, this.score, () => this.restart(), () => this.choosePilot());
    }
    return result.event;
  }

  private clearEnemyShots(): void {
    for (const shot of this.enemyShots) shot.node.destroy();
    this.enemyShots = [];
  }

  private clearPlayerShots(): void {
    for (const shot of this.shots) shot.node.destroy();
    this.shots = [];
  }
}
