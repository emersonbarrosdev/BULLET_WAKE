import Phaser from 'phaser';
import { GAME_BACKGROUND, GAME_HEIGHT, GAME_WIDTH, HUD_BOTTOM, HUD_TOP, PLAYER_SPEED_FACTOR } from '../constants';
import { clamp, moveInBounds } from '../systems/movement';
import { advanceHealth, applyPlayerHit, initialPlayerHealth, type HitEvent, type PlayerHealth } from '../systems/combat';
import { StageDirector, type EnemyModel, type EnemyShotEvent } from '../systems/stageDirector';
import { CombatHud } from '../ui/CombatHud';
import { getPilot, shotIntervalMs, type PilotDefinition } from '../data/pilots';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { GameOverOverlay } from '../ui/GameOverOverlay';
import { StageCompleteOverlay } from '../ui/StageCompleteOverlay';
import { StageBackdrop } from './StageBackdrop';

type Keys = Record<'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ESC' | 'M' | 'X' | 'ONE' | 'TWO' | 'THREE', Phaser.Input.Keyboard.Key>;
interface Projectile { node: Phaser.GameObjects.Sprite; velocityX: number; velocityY: number; damage: number; hitRadius: number }
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
  private shipEngine?: Phaser.GameObjects.Sprite;
  private shipAnimation = '';
  private firePoseMs = 0;
  private hitPoseMs = 0;
  private missilePoseMs = 0;
  private prismPoseMs = 0;
  private missileCooldownMs = 0;
  private prismCooldownMs = 0;
  // Teclas 1–3 testam os visuais de nível. Pickups e evolução real virão depois.
  private rivetWeaponLevel: 1 | 2 | 3 = 1;
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

  preload(): void {
    // Segunda chance de carregamento se a seleção não tiver baixado
    // algum spritesheet (ex.: erro transitório ou cache incompleto).
    loadGameSprites(this);
  }

  create(): void {
    registerGameAnimations(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);
    this.shipAnimation = '';
    this.firePoseMs = 0;
    this.hitPoseMs = 0;
    this.missilePoseMs = 0;
    this.prismPoseMs = 0;
    this.missileCooldownMs = 0;
    this.prismCooldownMs = 0;
    this.rivetWeaponLevel = 1;
    this.shots = [];
    this.enemyShots = [];
    this.enemyVisuals.clear();
    this.director = new StageDirector(GAME_WIDTH);
    this.shootCooldown = 0;
    this.score = 0;
    this.completed = false;
    this.health = initialPlayerHealth();

    this.backdrop = new StageBackdrop(this);
    this.keyboardControls = this.input.keyboard?.addKeys('W,A,S,D,SPACE,R,ESC,M,X,ONE,TWO,THREE') as Keys | undefined;
    this.cursors = this.input.keyboard?.createCursorKeys();

    this.hud = new CombatHud(this, () => this.restart());
    this.hud.setPilot(this.pilot.shipName);
    this.hud.setScore(0);
    this.hud.setHealth(this.health);
    this.hud.setProgress(0);
    this.hud.flash('FASE 01  -  CINTURAO DE FERRUGEM', '#a6e3e2', 2100);

    const rivet = this.pilot.id === 'nolan';
    const texture = rivet ? 'rivet-v3-idle' : 'ship-' + this.pilot.id;
    this.shipSprite = this.add.sprite(0, 0, texture, 0);
    this.shipSprite.setScale(rivet ? 0.98 : 1.95);
    const children: Phaser.GameObjects.GameObject[] = [];
    if (rivet) {
      // Propulsão independente do casco, trocando frames em loop.
      this.shipEngine = this.add.sprite(-71, 0, 'rivet-v3-engine', 0)
        .setScale(0.9).play('rivet-v3-engine-anim');
      children.push(this.shipEngine);
    } else {
      this.shipEngine = undefined;
    }
    children.push(this.shipSprite);
    this.ship = this.add.container(135, GAME_HEIGHT / 2, children).setDepth(7);
    this.changeShipAnimation('idle');
    if (rivet) this.hud.flash('RIVET V3  |  M MISSIL  X PRISM  1/2/3 TESTE DE NIVEL', '#9ff4e9', 2300);
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
    this.missilePoseMs = Math.max(0, this.missilePoseMs - dt);
    this.prismPoseMs = Math.max(0, this.prismPoseMs - dt);
    this.missileCooldownMs = Math.max(0, this.missileCooldownMs - dt);
    this.prismCooldownMs = Math.max(0, this.prismCooldownMs - dt);
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

    const shipHalfWidth = this.pilot.id === 'nolan' ? 79 : 47;
    const shipHalfHeight = this.pilot.id === 'nolan' ? 55 : 28;
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
      : this.pilot.id === 'nolan' && this.prismPoseMs > 0 ? 'prism_charge'
      : this.pilot.id === 'nolan' && this.missilePoseMs > 0 ? 'missile_launch'
      : dy < 0 ? 'up' : dy > 0 ? 'down'
      : this.pilot.id === 'nolan' && this.firePoseMs > 0 ? 'fire' : 'idle';
    this.changeShipAnimation(state);

    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if ((key('SPACE') || this.cursors?.space.isDown || finger) && this.shootCooldown <= 0) {
      this.fire();
      this.shootCooldown += shotIntervalMs(this.pilot);
    }
    if (this.pilot.id === 'nolan') {
      if (this.keyboardControls) {
        if (Phaser.Input.Keyboard.JustDown(this.keyboardControls.ONE)) this.rivetWeaponLevel = 1;
        if (Phaser.Input.Keyboard.JustDown(this.keyboardControls.TWO)) this.rivetWeaponLevel = 2;
        if (Phaser.Input.Keyboard.JustDown(this.keyboardControls.THREE)) this.rivetWeaponLevel = 3;
      }
      if (key('M') && this.missileCooldownMs === 0) this.launchMissile();
      if (key('X') && this.prismCooldownMs === 0) this.launchPrism();
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

  private changeShipAnimation(
    state: 'idle' | 'up' | 'down' | 'fire' | 'hit' | 'missile_launch' | 'prism_charge',
  ): void {
    if (this.pilot.id === 'nolan') {
      const v3state = state === 'up' ? 'climb' : state === 'down' ? 'dive' : state;
      if (this.shipAnimation === v3state) return;
      this.shipAnimation = v3state;
      this.shipSprite.play('rivet-v3-' + v3state + '-anim', true);
    } else {
      if (state === 'fire' || state === 'hit' || state === 'missile_launch' || state === 'prism_charge') state = 'idle';
      if (this.shipAnimation === state) return;
      this.shipAnimation = state;
      this.shipSprite.play('ship-' + this.pilot.id + '-' + state, true);
    }
  }

  private playEffect(kind: 'muzzle' | 'hit' | 'explosion', x: number, y: number): void {
    const sprite = this.add.sprite(x, y, 'fx-' + kind, 0).setScale(1.5).setDepth(15);
    sprite.once('animationcomplete', () => sprite.destroy());
    sprite.play('fx-' + kind + '-play');
  }

  private createPlayerProjectile(
    texture: string, animation: string,
    x: number, y: number, speedX: number, speedY: number,
    damage: number, hitRadius: number, scale: number,
  ): void {
    const node = this.add.sprite(x, y, texture, 0).setScale(scale).setDepth(9);
    node.play(animation);
    this.shots.push({ node, velocityX: speedX, velocityY: speedY, damage, hitRadius });
  }

  private fire(): void {
    const rivet = this.pilot.id === 'nolan';
    const x = this.ship.x + (rivet ? 69 : 42);
    if (rivet) {
      if (this.hitPoseMs === 0 && this.prismPoseMs === 0) this.firePoseMs = 150;
      const key = 'rivet-v3-pulse-' + this.rivetWeaponLevel;
      this.createPlayerProjectile(
        key, key + '-anim', x, this.ship.y + 3, 550, 0,
        this.pilot.damage * (1 + (this.rivetWeaponLevel - 1) * 0.3), 12, 0.68,
      );
      const fx = this.add.sprite(x - 8, this.ship.y + 3, 'rivet-v3-muzzle', 0)
        .setScale(0.8).setDepth(11);
      fx.once('animationcomplete', () => fx.destroy());
      fx.play('rivet-v3-muzzle-anim');
    } else {
      this.createPlayerProjectile(
        'shot-' + this.pilot.id, 'shot-' + this.pilot.id + '-loop',
        x, this.ship.y, 535, 0, this.pilot.damage, 7, 1.7,
      );
      this.playEffect('muzzle', x - 10, this.ship.y);
    }
  }

  private launchMissile(): void {
    this.missileCooldownMs = 1900;
    this.missilePoseMs = 280;
    this.changeShipAnimation('missile_launch');
    this.createPlayerProjectile(
      'rivet-v3-missile', 'rivet-v3-missile-anim',
      this.ship.x + 40, this.ship.y - 24, 400, -32, 3.0, 18, 0.7,
    );
    this.hud.flash('MISSIL  /  RIVET', '#ffd19f', 600);
  }

  private launchPrism(): void {
    this.prismCooldownMs = 10500; // Temporario ate o medidor de ressonancia existir.
    this.prismPoseMs = 550;
    this.changeShipAnimation('prism_charge');
    for (const tilt of [-0.36, 0, 0.36]) {
      this.createPlayerProjectile(
        'rivet-v3-prism', 'rivet-v3-prism-anim',
        this.ship.x + 55, this.ship.y, 410, 410 * tilt,
        1.65, 16, 0.62,
      );
    }
    this.hud.flash('TEMPESTADE PRISMATICA  /  TESTE', '#d6b2ff', 900);
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
      damage: 1, hitRadius: 8,
    });
    this.playEffect('muzzle', event.x + 11, event.y);
  }

  private advancePlayerShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      const prevX = shot.node.x;
      shot.node.x += shot.velocityX * dt / 1000;
      shot.node.y += shot.velocityY * dt / 1000;
      let collided = false;
      for (const enemy of this.director.enemies) {
        const hx = enemy.kind === 'scout' ? 19 : 29;
        const hy = enemy.kind === 'scout' ? 15 : 21;
        // Teste varrido no eixo X para não atravessar inimigos entre frames.
        if (shot.node.x + shot.hitRadius >= enemy.x - hx
          && prevX - shot.hitRadius <= enemy.x + hx
          && Math.abs(shot.node.y - enemy.y) <= hy + shot.hitRadius * 0.4) {
          const hit = this.director.damage(enemy.id, shot.damage);
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
      this.missilePoseMs = 0;
      this.prismPoseMs = 0;
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
      this.shipSprite.play(
        this.pilot.id === 'nolan' ? 'rivet-v3-destruction-anim' : 'ship-' + this.pilot.id + '-death',
      );
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
