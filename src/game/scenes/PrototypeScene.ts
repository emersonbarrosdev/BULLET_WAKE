import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH } from '../constants';
import { clamp, moveInBounds } from '../systems/movement';
import {
  advanceHealth,
  applyPlayerHit,
  initialPlayerHealth,
  type PlayerHealth,
} from '../systems/combat';

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
 * Arena de teste de GAMEPLAY. As figuras geométricas são marcadores temporários
 * de hitbox e não são os sprites artísticos definitivos das naves e inimigos.
 */
export class PrototypeScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private keyboardControls?: Keys;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private scoreText!: Phaser.GameObjects.Text;
  private healthText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
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
    // Scene.restart reutiliza a instância: reiniciar também campos de lógica.
    this.shots = [];
    this.enemyShots = [];
    this.targets = [];
    this.shootCooldown = 0;
    this.targetWave = 0;
    this.score = 0;
    this.health = initialPlayerHealth();

    this.keyboardControls = this.input.keyboard?.addKeys('W,A,S,D,SPACE,R') as Keys | undefined;
    this.cursors = this.input.keyboard?.createCursorKeys();

    // HUD de teste com fonte regular mais legível e textura de texto em resolução 2x.
    // O design arcade definitivo do HUD é tarefa T04.
    this.add.rectangle(GAME_WIDTH / 2, 23, GAME_WIDTH, 46, 0x19283a);
    this.hudText(9, 6, 'BULLET WAKE  /  T03', '#eaf2f5', 12);
    this.scoreText = this.hudText(9, 25, 'SCORE 00000', '#83e5df', 11);
    this.healthText = this.hudText(160, 25, 'HP 3/3', '#eaf2f5', 11);
    this.livesText = this.hudText(275, 25, 'VIDAS 3', '#eaf2f5', 11);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 11, GAME_WIDTH, 22, 0x19283a);
    this.hudText(9, GAME_HEIGHT - 18, 'WASD/SETAS: MOVER   ESPACO: TIRO   R: REINICIAR', '#d4e1e9', 9);

    // Marcador de nave controlável. NÃO é sprite final.
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

    for (let i = 0; i < 3; i += 1) {
      const node = this.add.rectangle(272 + i * 46, 62 + i * 52, 17, 17, 0xd75e56);
      node.setStrokeStyle(2, 0xf7a96c);
      this.targets.push({ node, row: i, reloadMs: 900 + i * 450 });
    }

    // Um segundo toque após o Game Over reinicia sem precisar de teclado.
    this.input.on('pointerdown', () => {
      if (this.health.gameOver) this.scene.restart();
    });
  }

  update(_time: number, delta: number): void {
    const dt = clamp(delta, 0, 50);
    const key = (name: keyof Keys): boolean => Boolean(this.keyboardControls?.[name].isDown);
    if (key('R')) {
      this.scene.restart();
      return;
    }
    if (this.health.gameOver) return;

    this.health = advanceHealth(this.health, dt);
    this.ship.setAlpha(
      this.health.invulnerableMs > 0 && Math.floor(this.health.invulnerableMs / 100) % 2 === 0
        ? 0.35 : 1,
    );

    let dx = Number(key('D') || this.cursors?.right.isDown) - Number(key('A') || this.cursors?.left.isDown);
    let dy = Number(key('S') || this.cursors?.down.isDown) - Number(key('W') || this.cursors?.up.isDown);
    const pointer = this.input.activePointer;

    // Controle touch temporário: segue o dedo, disparando quando pressiona.
    if (pointer.isDown) {
      dx = Math.abs(pointer.x - this.ship.x) > 8 ? Math.sign(pointer.x - this.ship.x) : 0;
      dy = Math.abs(pointer.y - this.ship.y) > 8 ? Math.sign(pointer.y - this.ship.y) : 0;
    }

    const moved = moveInBounds(
      { x: this.ship.x, y: this.ship.y },
      dx, dy, 190, dt,
      { minX: 23, maxX: GAME_WIDTH - 24, minY: 53, maxY: GAME_HEIGHT - 28 },
    );
    this.ship.setPosition(moved.x, moved.y);

    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if ((key('SPACE') || this.cursors?.space.isDown || pointer.isDown) && this.shootCooldown <= 0) {
      this.fire();
      this.shootCooldown += 125;
    }

    this.advanceTargets(dt);
    this.advancePlayerShots(dt);
    this.advanceEnemyShots(dt);
  }

  private hudText(x: number, y: number, text: string, color: string, fontSize: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: fontSize + 'px',
      fontStyle: 'bold',
      color,
    }).setResolution(2).setDepth(10);
  }

  private fire(): void {
    const node = this.add.rectangle(this.ship.x + 20, this.ship.y, 7, 3, 0x61d7da);
    this.shots.push({ node, velocityX: 300, velocityY: 0 });
  }

  private advanceTargets(dt: number): void {
    for (const target of this.targets) {
      target.node.x -= 18 * dt / 1000;
      if (target.node.x < -20) {
        this.resetTarget(target);
      }
      target.reloadMs -= dt;
      if (target.reloadMs <= 0) {
        this.fireEnemyShot(target);
        target.reloadMs += 1500 + target.row * 280;
      }
      // Contato casco-alvo também provoca dano, apenas uma vez por i-frame.
      if (Math.abs(target.node.x - this.ship.x) <= 13 && Math.abs(target.node.y - this.ship.y) <= 10) {
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
        if (Math.abs(shot.node.x - target.node.x) < 11 && Math.abs(shot.node.y - target.node.y) < 9) {
          this.score += 100;
          this.scoreText.setText('SCORE ' + String(this.score).padStart(5, '0'));
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

      const hit = Math.abs(shot.node.x - this.ship.x) <= 8
        && Math.abs(shot.node.y - this.ship.y) <= 6;
      const outside = shot.node.x < -8 || shot.node.x > GAME_WIDTH + 8
        || shot.node.y < -8 || shot.node.y > GAME_HEIGHT + 8;

      if (hit || outside) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }
      if (hit) {
        this.damageShip();
        // No respawn limpamos todos os projéteis; não iterar índices antigos.
        if (this.health.gameOver || this.health.invulnerableMs > 1500) break;
      }
    }
  }

  private damageShip(): void {
    const result = applyPlayerHit(this.health);
    this.health = result.state;
    if (result.event === 'ignored') return;
    this.healthText.setText('HP ' + this.health.hp + '/3');
    this.livesText.setText('VIDAS ' + this.health.lives);

    if (result.event === 'respawn') {
      this.ship.setPosition(64, GAME_HEIGHT / 2);
      this.ship.setAlpha(1);
      this.clearEnemyShots();
    }
    if (result.event === 'game-over') {
      this.clearEnemyShots();
      this.ship.setVisible(false);
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, 78, 0x101827, 0.95).setDepth(19);
      this.hudText(118, GAME_HEIGHT / 2 - 28, 'GAME OVER', '#ffba76', 24).setDepth(20);
      this.hudText(88, GAME_HEIGHT / 2 + 6, 'R OU TOQUE PARA REINICIAR', '#eaf2f5', 11).setDepth(20);
    }
  }

  private clearEnemyShots(): void {
    for (const bullet of this.enemyShots) bullet.node.destroy();
    this.enemyShots = [];
  }

  private resetTarget(target: Target): void {
    this.targetWave += 1;
    target.reloadMs = 900 + target.row * 300;
    target.node.setPosition(
      GAME_WIDTH + 12 + (this.targetWave % 3) * 20,
      62 + target.row * 52,
    );
  }
}
