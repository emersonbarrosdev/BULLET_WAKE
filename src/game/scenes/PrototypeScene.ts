import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP, PLAYER_SPEED_FACTOR } from '../constants';
import { clamp, moveInBounds } from '../systems/movement';
import { advanceHealth, applyPlayerHit, initialPlayerHealth, type HitEvent, type PlayerHealth } from '../systems/combat';
import { StageDirector, type EnemyModel, type EnemyShotEvent } from '../systems/stageDirector';
import { CombatHud } from '../ui/CombatHud';
import { getPilot, shotIntervalMs, type PilotDefinition } from '../data/pilots';
import { registerGameAnimations } from '../assets/spriteAssets';
import { GameOverOverlay } from '../ui/GameOverOverlay';
import { StageCompleteOverlay } from '../ui/StageCompleteOverlay';
import { StageBackdrop } from './StageBackdrop';

type Keys = Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ESC', Phaser.Input.Keyboard.Key>;
interface Projectile { node: Phaser.GameObjects.Sprite; velocityX: number; velocityY: number }
interface EnemyVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  warning: Phaser.GameObjects.Sprite;
  animationKey: string;
}

/** Primeiro trecho de fase com auto-scroll lateral — sem ondas ou arena. */
export class PrototypeScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private shipSprite!: Phaser.GameObjects.Sprite;
  private shipAnimation = '';
  private firePoseMs = 0;
  private hitPoseMs = 0;
  private pilot: PilotDefinition = getPilot('nolan');
  private hud!: CombatHud;
  private backdrop!: StageBackdrop;
  private keyboardControls?: Keys;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private shots: Projectile[] = [];
  private enemyShots: Projectile[] = [];
  private enemyVisuals = new Map<number, EnemyVisual>();
  private director = new StageDirector(GAME_WIDTH);
  private shootCooldown = 0;
  private score = 0;
  private completed = false;
  private health: PlayerHealth = initialPlayerHealth();

  constructor() { super({ key: 'PrototypeScene' }); }

  init(data: { pilotId?: string } = {}): void {
    this.pilot = getPilot(data.pilotId);
  }

  create(): void {
    registerGameAnimations(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.shipAnimation = '';
    this.firePoseMs = 0;
    this.hitPoseMs = 0;
    this.shots = [];
    this.enemyShots = [];
    this.enemyVisuals.clear();
    this.director = new StageDirector(GAME_WIDTH);
    this.shootCooldown = 0;
    this.score = 0;
    this.completed = false;
    this.health = initialPlayerHealth();

    this.backdrop = new StageBackdrop(this);
    this.keyboardControls = this.input.keyboard?.addKeys('W,A,S,D,SPACE,R,ESC') as Keys | undefined;
    this.cursors = this.input.keyboard?.createCursorKeys();

    this.hud = new CombatHud(this, () => this.restart());
    this.hud.setPilot(this.pilot.shipName);
    this.hud.setScore(0);
    this.hud.setHealth(this.health);
    this.hud.setProgress(0);
    this.hud.flash('FASE 01  -  CINTURAO DE FERRUGEM', '#a6e3e2', 2100);

    const key = this.pilot.id === 'nolan' ? 'ship-rivet-v2-idle' : 'ship-' + this.pilot.id;
    this.shipSprite = this.add.sprite(0, 0, key, 0);
    // Aumenta a densidade do canvas sem ampliar exageradamente os pixels da Rivet.
    this.shipSprite.setScale(this.pilot.id === 'nolan' ? 1.08 : 1.95);
    this.ship = this.add.container(135, GAME_HEIGHT / 2, [this.shipSprite]).setDepth(7);
    this.changeShipAnimation('idle');
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
    if (this.health.gameOver || this.completed) return;

    this.health = advanceHealth(this.health, dt);
    this.firePoseMs = Math.max(0, this.firePoseMs - dt);
    this.hitPoseMs = Math.max(0, this.hitPoseMs - dt);
    this.hud.update(dt);
    this.ship.setAlpha(
      this.health.invulnerableMs > 0 && Math.floor(this.health.invulnerableMs / 110) % 2 === 0
        ? 0.3 : 1,
    );

    const key = (name: keyof Keys): boolean => Boolean(this.keyboardControls?.[name].isDown);
    let dx = Number(key('D') || this.cursors?.right.isDown) - Number(key('A') || this.cursors?.left.isDown);
    let dy = Number(key('S') || this.cursors?.down.isDown) - Number(key('W') || this.cursors?.up.isDown);
    const pointer = this.input.activePointer;
    const finger = pointer.isDown && pointer.y > HUD_TOP + 6 && pointer.y < GAME_HEIGHT - HUD_BOTTOM - 5;

    if (finger) {
      dx = Math.abs(pointer.x - this.ship.x) > 12 ? Math.sign(pointer.x - this.ship.x) : 0;
      dy = Math.abs(pointer.y - this.ship.y) > 12 ? Math.sign(pointer.y - this.ship.y) : 0;
    }

    const shipHalfWidth = this.pilot.id === 'nolan' ? 61 : 47;
    const shipHalfHeight = this.pilot.id === 'nolan' ? 30 : 28;
    const moved = moveInBounds(
      { x: this.ship.x, y: this.ship.y },
      dx, dy, this.pilot.speed * PLAYER_SPEED_FACTOR, dt,
      {
        minX: shipHalfWidth,
        maxX: GAME_WIDTH - shipHalfWidth,
        minY: HUD_TOP + shipHalfHeight + 8,
        maxY: GAME_HEIGHT - HUD_BOTTOM - shipHalfHeight - 8,
      },
    );
    this.ship.setPosition(moved.x, moved.y);
    const state = this.pilot.id === 'nolan' && this.hitPoseMs > 0 ? 'hit'
      : dy < 0 ? 'up' : dy > 0 ? 'down'
      : this.pilot.id === 'nolan' && this.firePoseMs > 0 ? 'fire' : 'idle';
    this.changeShipAnimation(state);

    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if ((key('SPACE') || this.cursors?.space.isDown || finger) && this.shootCooldown <= 0) {
      this.fire();
      this.shootCooldown += shotIntervalMs(this.pilot);
    }

    const tick = this.director.update(dt, this.ship.x, this.ship.y);
    this.backdrop.update(tick.scrollPx);
    this.hud.setProgress(tick.progress);
    if (tick.sectorChanged) this.hud.setSector(tick.sector);
    for (const enemy of tick.spawned) this.makeEnemyVisual(enemy);
    for (const event of tick.shots) this.spawnEnemyShot(event);
    this.syncEnemyVisuals();
    this.advancePlayerShots(dt);
    this.checkEnemyContacts();
    if (this.health.gameOver) return;
    this.advanceEnemyShots(dt);
    if (tick.completed) {
      this.completed = true;
      this.clearEnemyShots();
      this.clearPlayerShots();
      new StageCompleteOverlay(this, this.score, () => this.restart(), () => this.choosePilot());
    }
  }

  private restart(): void { this.scene.restart({ pilotId: this.pilot.id }); }
  private choosePilot(): void {
    this.scene.start('PilotSelectScene', { selectedPilotId: this.pilot.id });
  }

  private changeShipAnimation(state: 'idle' | 'up' | 'down' | 'fire' | 'hit'): void {
    if (this.pilot.id !== 'nolan' && (state === 'fire' || state === 'hit')) state = 'idle';
    if (this.shipAnimation === state) return;
    this.shipAnimation = state;
    this.shipSprite.play('ship-' + this.pilot.id + '-' + state, true);
  }

  private playEffect(kind: 'muzzle' | 'hit' | 'explosion', x: number, y: number): void {
    const sprite = this.add.sprite(x, y, 'fx-' + kind, 0).setScale(1.5).setDepth(15);
    sprite.once('animationcomplete', () => sprite.destroy());
    sprite.play('fx-' + kind + '-play');
  }

  private fire(): void {
    const x = this.ship.x + (this.pilot.id === 'nolan' ? 65 : 42);
    if (this.pilot.id === 'nolan' && this.hitPoseMs === 0) this.firePoseMs = 150;
    const shot = this.add.sprite(x, this.ship.y, 'shot-' + this.pilot.id, 0)
      .setScale(1.7).setDepth(9);
    shot.play('shot-' + this.pilot.id + '-loop');
    this.shots.push({ node: shot, velocityX: 535, velocityY: 0 });
    this.playEffect('muzzle', x - 10, this.ship.y);
  }

  private makeEnemyVisual(enemy: EnemyModel): void {
    const texture = 'enemy-' + enemy.kind;
    const body = this.add.sprite(0, 0, texture, 0)
      .setScale(enemy.kind === 'scout' ? 2.15 : 1.85);
    body.play(texture + '-fly');
    const warning = this.add.sprite(enemy.kind === 'scout' ? -28 : -40, 0, 'fx-warning', 0)
      .setScale(1.15).setVisible(false);
    const container = this.add.container(enemy.x, enemy.y, [body, warning]).setDepth(5);
    this.enemyVisuals.set(enemy.id, { container, body, warning, animationKey: texture + '-fly' });
  }

  private syncEnemyVisuals(): void {
    const active = new Set(this.director.enemies.map(e => e.id));
    for (const [id, visual] of this.enemyVisuals) {
      if (active.has(id)) continue;
      visual.container.destroy();
      this.enemyVisuals.delete(id);
    }
    for (const enemy of this.director.enemies) {
      const visual = this.enemyVisuals.get(enemy.id);
      if (!visual) continue;
      visual.container.setPosition(enemy.x, enemy.y);
      const preparing = enemy.phase === 'telegraph';
      const desired = 'enemy-' + enemy.kind + (preparing ? '-warning' : '-fly');
      if (desired !== visual.animationKey) {
        visual.body.play(desired, true);
        visual.animationKey = desired;
      }
      if (preparing && !visual.warning.visible) {
        visual.warning.setVisible(true).play('fx-warning-loop');
      } else if (!preparing && visual.warning.visible) {
        visual.warning.setVisible(false).stop();
      }
      if (enemy.hp < enemy.maxHp) visual.body.setTint(0xffb1a7);
      else visual.body.clearTint();
    }
  }

  private spawnEnemyShot(event: EnemyShotEvent): void {
    if (this.enemyShots.length >= 64) return;
    const bullet = this.add.sprite(event.x, event.y, 'shot-enemy', 0)
      .setScale(1.55).setDepth(10);
    bullet.play('shot-enemy-loop');
    this.enemyShots.push({
      node: bullet, velocityX: event.velocityX, velocityY: event.velocityY,
    });
    this.playEffect('muzzle', event.x + 11, event.y);
  }

  private advancePlayerShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      const prevX = shot.node.x;
      shot.node.x += shot.velocityX * dt / 1000;
      let collided = false;
      for (const enemy of this.director.enemies) {
        const hx = enemy.kind === 'scout' ? 19 : 29;
        const hy = enemy.kind === 'scout' ? 15 : 21;
        // Teste varrido no eixo X para não atravessar inimigos entre frames.
        if (shot.node.x + 6 >= enemy.x - hx && prevX - 6 <= enemy.x + hx
          && Math.abs(shot.node.y - enemy.y) <= hy) {
          const hit = this.director.damage(enemy.id, this.pilot.damage);
          this.playEffect(hit.killed ? 'explosion' : 'hit', enemy.x, enemy.y);
          if (hit.killed) {
            this.score += hit.score;
            this.hud.setScore(this.score);
            this.syncEnemyVisuals();
          }
          collided = true;
          break;
        }
      }
      if (collided || shot.node.x > GAME_WIDTH + 20) {
        shot.node.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  private checkEnemyContacts(): void {
    for (const enemy of this.director.enemies) {
      const hx = enemy.kind === 'scout' ? 29 : 42;
      const hy = enemy.kind === 'scout' ? 21 : 29;
      if (Math.abs(this.ship.x - enemy.x) < hx + 15
        && Math.abs(this.ship.y - enemy.y) < hy + 12) {
        const response = this.damageShip();
        this.director.remove(enemy.id);
        this.playEffect('explosion', enemy.x, enemy.y);
        this.syncEnemyVisuals();
        if (response === 'game-over') return;
        break;
      }
    }
  }

  private advanceEnemyShots(dt: number): void {
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const shot = this.enemyShots[i];
      const previousX = shot.node.x;
      const previousY = shot.node.y;
      shot.node.x += shot.velocityX * dt / 1000;
      shot.node.y += shot.velocityY * dt / 1000;
      const hit = Math.min(previousX, shot.node.x) - 8 <= this.ship.x + 16
        && Math.max(previousX, shot.node.x) + 8 >= this.ship.x - 16
        && Math.min(previousY, shot.node.y) - 8 <= this.ship.y + 11
        && Math.max(previousY, shot.node.y) + 8 >= this.ship.y - 11;
      const outside = shot.node.x < -15 || shot.node.x > GAME_WIDTH + 15
        || shot.node.y < HUD_TOP - 20 || shot.node.y > GAME_HEIGHT - HUD_BOTTOM + 20;
      if (hit || outside) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }
      if (hit) {
        const result = this.damageShip();
        if (result === 'respawn' || result === 'game-over') return;
      }
    }
  }

  private damageShip(): HitEvent {
    const outcome = applyPlayerHit(this.health);
    this.health = outcome.state;
    if (outcome.event === 'ignored') return outcome.event;
    this.hud.setHealth(this.health);
    if (outcome.event === 'damaged') {
      this.hud.flash('ACERTO! -1 HP', '#ffd099', 950);
      if (this.pilot.id === 'nolan') {
        this.hitPoseMs = 280;
        this.changeShipAnimation('hit');
      }
      this.playEffect('hit', this.ship.x, this.ship.y);
    } else if (outcome.event === 'respawn') {
      const oldX = this.ship.x, oldY = this.ship.y;
      this.playEffect('explosion', oldX, oldY);
      this.clearEnemyShots();
      this.firePoseMs = 0;
      this.hitPoseMs = 0;
      this.shipAnimation = '';
      this.ship.setPosition(135, GAME_HEIGHT / 2).setAlpha(1);
      this.changeShipAnimation('idle');
      this.hud.flash('VIDA PERDIDA  /  PROTECAO TEMPORARIA', '#ffcf9e', 1700);
    } else if (outcome.event === 'game-over') {
      this.clearEnemyShots();
      this.clearPlayerShots();
      this.shipSprite.play('ship-' + this.pilot.id + '-death');
      this.playEffect('explosion', this.ship.x, this.ship.y);
      this.shipSprite.once('animationcomplete', () => {
        this.ship.setVisible(false);
        new GameOverOverlay(this, this.score, () => this.restart(), () => this.choosePilot());
      });
    }
    return outcome.event;
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
