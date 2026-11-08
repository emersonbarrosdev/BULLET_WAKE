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
import { registerGameAnimations } from '../assets/spriteAssets';
import { GameOverOverlay } from '../ui/GameOverOverlay';

type Keys = Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ESC', Phaser.Input.Keyboard.Key>;
interface Projectile {
  node: Phaser.GameObjects.Sprite;
  velocityX: number;
  velocityY: number;
}
interface EnemyVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  warning: Phaser.GameObjects.Sprite;
  animationKey: string;
}

/**
 * T05: ondas de Scouts e Lancers com FSM e telegraph.
 * Marcadores geométricos ainda são DEBUG, nunca sprites de arte final.
 */
export class PrototypeScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private shipSprite!: Phaser.GameObjects.Sprite;
  private shipAnimation = '';
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
    registerGameAnimations(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    // Scene.restart reusa instância; esvaziar absolutamente todo estado de gameplay.
    this.shipAnimation = '';
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

    // Sprite PNG animado em perfil; hurtbox continua independente do desenho.
    this.shipSprite = this.add.sprite(0, 0, 'ship-' + this.pilot.id, 0);
    this.ship = this.add.container(64, GAME_HEIGHT / 2, [this.shipSprite]);
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
    this.changeShipAnimation(dy < 0 ? 'up' : dy > 0 ? 'down' : 'idle');

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

  private changeShipAnimation(state: 'idle' | 'up' | 'down'): void {
    if (this.shipAnimation === state) return;
    this.shipAnimation = state;
    this.shipSprite.play('ship-' + this.pilot.id + '-' + state, true);
  }

  private playEffect(kind: 'muzzle' | 'hit' | 'explosion', x: number, y: number): void {
    const fx = this.add.sprite(x, y, 'fx-' + kind, 0).setDepth(15);
    fx.once('animationcomplete', () => fx.destroy());
    fx.play('fx-' + kind + '-play');
  }

  private fire(): void {
    const offset = this.pilot.id === 'harlan' ? 24 : 21;
    const x = this.ship.x + offset;
    const node = this.add.sprite(x, this.ship.y, 'shot-' + this.pilot.id, 0)
      .setDepth(8);
    node.play('shot-' + this.pilot.id + '-loop');
    this.shots.push({ node, velocityX: 300, velocityY: 0 });
    this.playEffect('muzzle', x - 5, this.ship.y);
  }

  private makeEnemyVisual(enemy: EnemyModel): void {
    const key = 'enemy-' + enemy.kind;
    const body = this.add.sprite(0, 0, key, 0);
    body.play(key + '-fly');
    const warning = this.add.sprite(enemy.kind === 'scout' ? -13 : -20, 0, 'fx-warning', 0)
      .setVisible(false).setScale(0.65);
    const container = this.add.container(enemy.x, enemy.y, [body, warning]).setDepth(5);
    this.enemyVisuals.set(enemy.id, {
      container, body, warning, animationKey: key + '-fly',
    });
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
      const warning = enemy.phase === 'telegraph';
      const nextKey = 'enemy-' + enemy.kind + (warning ? '-warning' : '-fly');
      if (nextKey !== visual.animationKey) {
        visual.body.play(nextKey, true);
        visual.animationKey = nextKey;
      }
      if (warning && !visual.warning.visible) {
        visual.warning.setVisible(true).play('fx-warning-loop');
      } else if (!warning && visual.warning.visible) {
        visual.warning.setVisible(false).stop();
      }
      if (enemy.hp < enemy.maxHp) visual.body.setTint(0xffb1a7);
      else visual.body.clearTint();
    }
  }

  private spawnEnemyShot(event: EnemyShotEvent): void {
    if (this.enemyShots.length >= 45) return;
    const bullet = this.add.sprite(event.x, event.y, 'shot-enemy', 0).setDepth(9);
    bullet.play('shot-enemy-loop');
    this.playEffect('muzzle', event.x + 7, event.y);
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
          this.playEffect(outcome.killed ? 'explosion' : 'hit', enemy.x, enemy.y);
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
        this.playEffect('explosion', enemy.x, enemy.y);
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
      this.playEffect('hit', this.ship.x, this.ship.y);
    }
    if (result.event === 'respawn') {
      this.clearEnemyShots();
      this.ship.setPosition(64, GAME_HEIGHT / 2);
      this.ship.setAlpha(1);
      this.playEffect('explosion', this.ship.x, this.ship.y);
      this.hud.flash('VIDA PERDIDA  /  PROTEGIDO', '#f4c480', 1500);
    }
    if (result.event === 'game-over') {
      this.clearEnemyShots();
      this.clearPlayerShots();
      this.shipSprite.play('ship-' + this.pilot.id + '-death');
      this.playEffect('explosion', this.ship.x, this.ship.y);
      this.shipSprite.once('animationcomplete', () => {
        this.ship.setVisible(false);
        new GameOverOverlay(this, this.score, () => this.restart(), () => this.choosePilot());
      });
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
