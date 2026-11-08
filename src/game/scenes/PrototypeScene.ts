import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { clamp, moveInBounds } from '../systems/movement';
import {
  advanceHealth,
  applyPlayerHit,
  initialPlayerHealth,
  type HitEvent,
  type PlayerHealth,
} from '../systems/combat';
import { CombatHud } from '../ui/CombatHud';
import { GameOverOverlay } from '../ui/GameOverOverlay';

type Keys = Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R', Phaser.Input.Keyboard.Key>;
interface Projectile {
  node: Phaser.GameObjects.Rectangle;
  velocityX: number;
  velocityY: number;
}
interface Target {
  node: Phaser.GameObjects.Rectangle;
  row: number;
  reloadMs: number;
}

/**
 * T04: combate de teste com HUD funcional, três vidas e Game Over.
 * Marcadores geométricos = debug de gameplay, NÃO sprites definitivos.
 */
export class PrototypeScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private hud!: CombatHud;
  private keyboardControls?: Keys;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private shots: Projectile[] = [];
  private enemyShots: Projectile[] = [];
  private targets: Target[] = [];
  private shootCooldown = 0;
  private targetWave = 0;
  private score = 0;
  private health: PlayerHealth = initialPlayerHealth();

  constructor() {
    super({ key: 'PrototypeScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.shots = [];
    this.enemyShots = [];
    this.targets = [];
    this.shootCooldown = 0;
    this.targetWave = 0;
    this.score = 0;
    this.health = initialPlayerHealth();

    this.keyboardControls = this.input.keyboard?.addKeys('W,A,S,D,SPACE,R') as Keys | undefined;
    this.cursors = this.input.keyboard?.createCursorKeys();

    this.hud = new CombatHud(this, () => this.restart());
    this.hud.setScore(this.score);
    this.hud.setHealth(this.health);

    // Marcador de prototipagem, não arte final.
    const marker = this.add.graphics();
    marker.fillStyle(0x263447, 1);
    marker.fillRect(-13, -4, 25, 8);
    marker.fillRect(-8, -7, 14, 3);
    marker.fillRect(-8, 4, 14, 3);
    marker.fillStyle(0x61d7da, 1);
    marker.fillRect(12, -2, 8, 4);
    marker.fillStyle(0xeaf2f5, 1);
    marker.fillRect(-17, -2, 4, 4);
    this.ship = this.add.container(64, GAME_HEIGHT / 2, [marker]);

    for (let row = 0; row < 3; row += 1) {
      const node = this.add.rectangle(272 + row * 46, 67 + row * 48, 17, 17, 0xd75e56);
      node.setStrokeStyle(2, 0xf7a96c);
      this.targets.push({ node, row, reloadMs: 900 + row * 450 });
    }
  }

  update(_time: number, delta: number): void {
    const dt = clamp(delta, 0, 50);

    // JustDown impede reinício em loop se R permanecer pressionado.
    if (this.keyboardControls && Phaser.Input.Keyboard.JustDown(this.keyboardControls.R)) {
      this.restart();
      return;
    }

    if (this.health.gameOver) return;
    this.health = advanceHealth(this.health, dt);
    this.hud.update(dt);

    // Piscar é feedback visual; a hitbox não muda enquanto há i-frames.
    this.ship.setAlpha(
      this.health.invulnerableMs > 0 && Math.floor(this.health.invulnerableMs / 110) % 2 === 0
        ? 0.3 : 1,
    );

    const key = (name: keyof Keys): boolean => Boolean(this.keyboardControls?.[name].isDown);
    let dx = Number(key('D') || this.cursors?.right.isDown) - Number(key('A') || this.cursors?.left.isDown);
    let dy = Number(key('S') || this.cursors?.down.isDown) - Number(key('W') || this.cursors?.up.isDown);
    const pointer = this.input.activePointer;

    // Controle de toque é provisório. O botão de restart recebe clique próprio.
    if (pointer.isDown && pointer.y > 45 && pointer.y < GAME_HEIGHT - 25) {
      dx = Math.abs(pointer.x - this.ship.x) > 8 ? Math.sign(pointer.x - this.ship.x) : 0;
      dy = Math.abs(pointer.y - this.ship.y) > 8 ? Math.sign(pointer.y - this.ship.y) : 0;
    }

    const moved = moveInBounds(
      { x: this.ship.x, y: this.ship.y },
      dx, dy, 190, dt,
      { minX: 23, maxX: GAME_WIDTH - 24, minY: 56, maxY: GAME_HEIGHT - 32 },
    );
    this.ship.setPosition(moved.x, moved.y);

    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if ((key('SPACE') || this.cursors?.space.isDown || (
      pointer.isDown && pointer.y > 45 && pointer.y < GAME_HEIGHT - 25
    )) && this.shootCooldown <= 0) {
      this.fire();
      this.shootCooldown += 125;
    }

    this.advanceTargets(dt);
    if (this.health.gameOver) return;
    this.advancePlayerShots(dt);
    this.advanceEnemyShots(dt);
  }

  private restart(): void {
    this.scene.restart();
  }

  private fire(): void {
    const node = this.add.rectangle(this.ship.x + 20, this.ship.y, 7, 3, 0x61d7da);
    this.shots.push({ node, velocityX: 300, velocityY: 0 });
  }

  private advanceTargets(dt: number): void {
    for (const target of this.targets) {
      target.node.x -= 18 * dt / 1000;
      if (target.node.x < -20) this.resetTarget(target);
      target.reloadMs -= dt;
      if (target.reloadMs <= 0) {
        this.fireEnemyShot(target);
        target.reloadMs += 1500 + target.row * 280;
      }
      if (Math.abs(target.node.x - this.ship.x) <= 13 &&
          Math.abs(target.node.y - this.ship.y) <= 10) {
        this.damageShip();
        this.resetTarget(target);
        if (this.health.gameOver) return;
      }
    }
  }

  private fireEnemyShot(target: Target): void {
    if (target.node.x < 0 || target.node.x > GAME_WIDTH || this.enemyShots.length >= 32) return;
    const deltaX = this.ship.x - target.node.x;
    const deltaY = this.ship.y - target.node.y;
    const length = Math.hypot(deltaX, deltaY) || 1;
    const bullet = this.add.rectangle(target.node.x - 12, target.node.y, 5, 5, 0xffba76);
    bullet.setStrokeStyle(1, 0xd75e56);
    this.enemyShots.push({
      node: bullet,
      velocityX: 105 * deltaX / length,
      velocityY: 105 * deltaY / length,
    });
  }

  private advancePlayerShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i -= 1) {
      const shot = this.shots[i];
      shot.node.x += shot.velocityX * dt / 1000;
      let hit = false;
      for (const target of this.targets) {
        if (Math.abs(shot.node.x - target.node.x) < 11 &&
            Math.abs(shot.node.y - target.node.y) < 9) {
          this.score += 100;
          this.hud.setScore(this.score);
          this.resetTarget(target);
          hit = true;
          break;
        }
      }
      if (hit || shot.node.x > GAME_WIDTH + 6) {
        shot.node.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  private advanceEnemyShots(dt: number): void {
    for (let i = this.enemyShots.length - 1; i >= 0; i -= 1) {
      const shot = this.enemyShots[i];
      shot.node.x += shot.velocityX * dt / 1000;
      shot.node.y += shot.velocityY * dt / 1000;

      const hit = Math.abs(shot.node.x - this.ship.x) <= 8 &&
        Math.abs(shot.node.y - this.ship.y) <= 6;
      const outside = shot.node.x < -8 || shot.node.x > GAME_WIDTH + 8 ||
        shot.node.y < -8 || shot.node.y > GAME_HEIGHT + 8;

      if (hit || outside) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }

      if (hit) {
        const event = this.damageShip();
        // No respawn, todo o array foi limpo: retornar e nunca iterar índices inválidos.
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
      this.hud.flash('VIDA PERDIDA  /  PROTEGIDO', '#f4c480', 1600);
    }
    if (result.event === 'game-over') {
      this.clearEnemyShots();
      this.clearPlayerShots();
      this.ship.setVisible(false);
      new GameOverOverlay(this, this.score, () => this.restart());
    }
    return result.event;
  }

  private clearEnemyShots(): void {
    for (const bullet of this.enemyShots) bullet.node.destroy();
    this.enemyShots = [];
  }

  private clearPlayerShots(): void {
    for (const bullet of this.shots) bullet.node.destroy();
    this.shots = [];
  }

  private resetTarget(target: Target): void {
    this.targetWave += 1;
    target.reloadMs = 900 + target.row * 300;
    target.node.setPosition(
      GAME_WIDTH + 12 + (this.targetWave % 3) * 20,
      67 + target.row * 48,
    );
  }
}
