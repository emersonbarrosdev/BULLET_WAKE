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
import {
  createPlayerWeapons,
  upgradeWeapon,
  addResonance,
  activateSpecial,
  useBomb,
  addBomb,
  setShield,
  advanceWeapons,
  resetWeaponsOnRespawn,
  getPrimaryProjectiles,
  getSecondaryProjectiles,
  type PlayerWeaponsState,
  type ProjectileSpawnDef,
} from '../systems/weaponSystem.ts';
import { PickupSystem, determineEnemyDrop } from '../systems/pickupSystem.ts';
import {
  initialScoreCombo,
  registerKill,
  advanceCombo,
  addRawScore,
  getComboMultiplier,
  type ScoreComboState,
} from '../systems/scoreComboSystem.ts';
import { globalAudio } from '../audio/audioSystem.ts';

type Keys = Record<
  'W' | 'A' | 'S' | 'D' | 'SPACE' | 'R' | 'ESC' | 'M' | 'X' | 'K' | 'B' | 'L' | 'SHIFT' | 'ENTER' | 'ONE' | 'TWO' | 'THREE',
  Phaser.Input.Keyboard.Key
>;

interface Projectile {
  node: Phaser.GameObjects.Sprite;
  velocityX: number;
  velocityY: number;
  damage: number;
  hitRadius: number;
  piercing?: boolean;
}

interface EnemyVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Sprite;
  warning: Phaser.GameObjects.Sprite;
  animationKey: string;
}

interface BossVisual {
  container: Phaser.GameObjects.Container;
  hull: Phaser.GameObjects.Sprite;
  drill: Phaser.GameObjects.Sprite;
  turretTop: Phaser.GameObjects.Sprite;
  turretBottom: Phaser.GameObjects.Sprite;
  core: Phaser.GameObjects.Sprite;
}

/** Cena principal de combate do BULLET WAKE com progressão contínua e chefe final. */
export class PrototypeScene extends Phaser.Scene {
  private ship!: Phaser.GameObjects.Container;
  private shipSprite!: Phaser.GameObjects.Sprite;
  private shipEngine?: Phaser.GameObjects.Sprite;
  private shieldVisual?: Phaser.GameObjects.Sprite;
  private shipAnimation = '';

  private firePoseMs = 0;
  private hitPoseMs = 0;
  private missilePoseMs = 0;
  private prismPoseMs = 0;
  private phantomDashTimerMs = 0;

  private pilot: PilotDefinition = getPilot('nolan');
  private weapons: PlayerWeaponsState = createPlayerWeapons('nolan');
  private scoreCombo: ScoreComboState = initialScoreCombo();
  private health: PlayerHealth = initialPlayerHealth();

  private hud!: CombatHud;
  private backdrop!: StageBackdrop;
  private keyboardControls?: Keys;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  private shots: Projectile[] = [];
  private enemyShots: Projectile[] = [];
  private enemyVisuals = new Map<number, EnemyVisual>();
  private pickupVisuals = new Map<number, Phaser.GameObjects.Sprite>();

  private pickups = new PickupSystem();
  private director = new StageDirector(GAME_WIDTH, true);
  private bossVisual?: BossVisual;

  private shootCooldown = 0;
  private totalKills = 0;
  private completed = false;

  constructor() {
    super({ key: 'PrototypeScene' });
  }

  init(data: { pilotId?: string } = {}): void {
    this.pilot = getPilot(data.pilotId);
  }

  preload(): void {
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
    this.phantomDashTimerMs = 0;

    this.weapons = createPlayerWeapons(this.pilot.id);
    this.scoreCombo = initialScoreCombo();
    this.health = initialPlayerHealth();
    this.totalKills = 0;
    this.completed = false;

    this.shots = [];
    this.enemyShots = [];
    this.enemyVisuals.clear();
    this.pickupVisuals.clear();
    this.pickups.clear();
    this.bossVisual = undefined;

    this.director = new StageDirector(GAME_WIDTH, true);
    this.shootCooldown = 0;

    this.backdrop = new StageBackdrop(this);
    this.keyboardControls = this.input.keyboard?.addKeys(
      'W,A,S,D,SPACE,R,ESC,M,X,K,B,L,SHIFT,ENTER,ONE,TWO,THREE',
    ) as Keys | undefined;
    this.cursors = this.input.keyboard?.createCursorKeys();

    this.hud = new CombatHud(this, () => this.restart());
    this.hud.setPilot(this.pilot.shipName);
    this.hud.setScore(0);
    this.hud.setHealth(this.health, false);
    this.hud.setProgress(0);
    this.hud.setWeapon(this.pilot.shipName === 'Rivet' ? 'Pulso' : this.pilot.shipName === 'Moth' ? 'Laser' : 'Canhao', 1);
    this.hud.setBombs(this.weapons.bombs);
    this.hud.setResonance(0);
    this.hud.flash('FASE 01  -  CINTURAO DE FERRUGEM', '#a6e3e2', 2400);

    // Nave do jogador
    const rivet = this.pilot.id === 'nolan';
    const texture = rivet ? 'rivet-v3-idle' : 'ship-' + this.pilot.id;
    this.shipSprite = this.add.sprite(0, 0, texture, 0);
    this.shipSprite.setScale(rivet ? 0.98 : 1.95);

    const children: Phaser.GameObjects.GameObject[] = [];
    if (rivet) {
      this.shipEngine = this.add.sprite(-71, 0, 'rivet-v3-engine', 0)
        .setScale(0.9).play('rivet-v3-engine-anim');
      children.push(this.shipEngine);
    } else {
      this.shipEngine = undefined;
    }
    children.push(this.shipSprite);

    // Escudo de energia visual
    this.shieldVisual = this.add.sprite(0, 0, 'fx-shield', 0)
      .setScale(1.4).play('fx-shield-loop').setVisible(false).setDepth(8);
    children.push(this.shieldVisual);

    this.ship = this.add.container(135, GAME_HEIGHT / 2, children).setDepth(7);
    this.changeShipAnimation('idle');

    globalAudio.startStageMusic();
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

    // Atualiza timers do combate
    this.health = advanceHealth(this.health, dt);
    this.weapons = advanceWeapons(this.weapons, dt);
    this.scoreCombo = advanceCombo(this.scoreCombo, dt);

    this.firePoseMs = Math.max(0, this.firePoseMs - dt);
    this.hitPoseMs = Math.max(0, this.hitPoseMs - dt);
    this.missilePoseMs = Math.max(0, this.missilePoseMs - dt);
    this.prismPoseMs = Math.max(0, this.prismPoseMs - dt);
    this.phantomDashTimerMs = Math.max(0, this.phantomDashTimerMs - dt);

    // Atualiza o HUD
    this.hud.update(dt);
    this.hud.setHealth(this.health, this.weapons.hasShield);
    this.hud.setBombs(this.weapons.bombs);
    this.hud.setResonance(this.weapons.resonance, this.weapons.specialActiveMs > 0);
    this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));

    // Efeito de invulnerabilidade (piscar transparente)
    this.ship.setAlpha(
      this.health.invulnerableMs > 0 && Math.floor(this.health.invulnerableMs / 110) % 2 === 0
        ? 0.35 : 1,
    );

    // Escudo visual visível se o jogador tem escudo
    if (this.shieldVisual) {
      this.shieldVisual.setVisible(this.weapons.hasShield);
    }

    // Input do jogador
    const key = (name: keyof Keys): boolean => Boolean(this.keyboardControls?.[name].isDown);
    const justDown = (name: keyof Keys): boolean => Boolean(this.keyboardControls && Phaser.Input.Keyboard.JustDown(this.keyboardControls[name]));

    let dx = Number(key('D') || this.cursors?.right.isDown) - Number(key('A') || this.cursors?.left.isDown);
    let dy = Number(key('S') || this.cursors?.down.isDown) - Number(key('W') || this.cursors?.up.isDown);
    const pointer = this.input.activePointer;
    const finger = pointer.isDown && pointer.y > HUD_TOP + 6 && pointer.y < GAME_HEIGHT - HUD_BOTTOM - 5;

    if (finger) {
      dx = Math.abs(pointer.x - this.ship.x) > 12 ? Math.sign(pointer.x - this.ship.x) : 0;
      dy = Math.abs(pointer.y - this.ship.y) > 12 ? Math.sign(pointer.y - this.ship.y) : 0;
    }

    // Se estiver executando o Salto Fantasma (Cora), move em dash de alta velocidade
    let speed = this.pilot.speed * PLAYER_SPEED_FACTOR;
    if (this.phantomDashTimerMs > 0) {
      dx = 1.6; // Dash para frente
      speed = 650;
      this.spawnPhantomAfterimage();
    }

    const shipHalfWidth = this.pilot.id === 'nolan' ? 79 : 47;
    const shipHalfHeight = this.pilot.id === 'nolan' ? 55 : 28;
    const moved = moveInBounds(
      { x: this.ship.x, y: this.ship.y },
      dx, dy, speed, dt,
      {
        minX: shipHalfWidth,
        maxX: GAME_WIDTH - shipHalfWidth,
        minY: HUD_TOP + shipHalfHeight + 8,
        maxY: GAME_HEIGHT - HUD_BOTTOM - shipHalfHeight - 8,
      },
    );
    this.ship.setPosition(moved.x, moved.y);

    // Estado da animação
    const state = this.pilot.id === 'nolan' && this.hitPoseMs > 0 ? 'hit'
      : this.pilot.id === 'nolan' && this.prismPoseMs > 0 ? 'prism_charge'
      : this.pilot.id === 'nolan' && this.missilePoseMs > 0 ? 'missile_launch'
      : dy < 0 ? 'up' : dy > 0 ? 'down'
      : this.pilot.id === 'nolan' && this.firePoseMs > 0 ? 'fire' : 'idle';
    this.changeShipAnimation(state);

    // Disparo principal contínuo
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if ((key('SPACE') || this.cursors?.space.isDown || finger) && this.shootCooldown <= 0) {
      this.firePrimary();
      this.shootCooldown += shotIntervalMs(this.pilot);
    }

    // Disparo secundário / Mísseis (tecla M)
    if ((justDown('M') || key('M')) && this.weapons.missileCooldownMs <= 0) {
      this.fireSecondary();
    }

    // Ativação do Especial (tecla X, K ou Shift)
    if (justDown('X') || justDown('K') || justDown('SHIFT')) {
      this.triggerSpecial();
    }

    // Bomba (tecla B ou L)
    if (justDown('B') || justDown('L')) {
      this.detonateBomb();
    }

    // Tempestade Prismática ativa da Rivet (rajada contínua enquanto especial ativo)
    if (this.weapons.specialType === 'prism' && this.weapons.specialActiveMs > 0) {
      if (Math.floor(this.weapons.specialActiveMs / 100) % 2 === 0) {
        this.emitPrismBurst();
      }
    }

    // Atualiza diretor da fase
    const tick = this.director.update(dt, this.ship.x, this.ship.y);
    this.backdrop.update(tick.scrollPx);
    this.hud.setProgress(tick.progress);
    if (tick.sectorChanged) this.hud.setSector(tick.sector);

    for (const enemy of tick.spawned) this.makeEnemyVisual(enemy);
    for (const event of tick.shots) this.spawnEnemyShot(event);
    this.syncEnemyVisuals();

    // Atualiza pickups
    this.pickups.update(dt, this.ship.x, this.ship.y);
    this.syncPickupVisuals();
    this.checkPickupCollisions();

    // Atualiza chefe KRM-17 se ativo
    if (tick.bossActive && this.director.boss) {
      this.syncBossVisual(this.director.boss);
      this.hud.showBossBar('KRM-17 Excavator', this.director.boss.hp, this.director.boss.maxHp);
      globalAudio.startBossMusic();
    } else {
      if (this.bossVisual) {
        this.bossVisual.container.destroy();
        this.bossVisual = undefined;
        this.hud.hideBossBar();
      }
    }

    // Atualiza projéteis
    this.advancePlayerShots(dt);
    this.checkEnemyContacts();
    if (this.health.gameOver) return;

    this.advanceEnemyShots(dt);

    // Verificação de conclusão da fase
    if (tick.completed) {
      this.completed = true;
      this.clearEnemyShots();
      this.clearPlayerShots();
      this.hud.hideBossBar();
      globalAudio.stopMusic();

      const bonusPoints = 5000 + this.health.lives * 1000 + this.health.hp * 500;
      this.scoreCombo = addRawScore(this.scoreCombo, bonusPoints);
      this.hud.setScore(this.scoreCombo.score);

      new StageCompleteOverlay(
        this,
        this.scoreCombo.score,
        () => this.restart(),
        () => this.choosePilot(),
      );
    }
  }

  private restart(): void {
    globalAudio.stopMusic();
    this.scene.restart({ pilotId: this.pilot.id });
  }

  private choosePilot(): void {
    globalAudio.stopMusic();
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

  private createPlayerProjectile(def: ProjectileSpawnDef): void {
    const node = this.add.sprite(def.x, def.y, def.texture, 0)
      .setScale(def.scale)
      .setDepth(9);
    node.play(def.animation);
    this.shots.push({
      node,
      velocityX: def.velocityX,
      velocityY: def.velocityY,
      damage: def.damage,
      hitRadius: def.hitRadius,
      piercing: def.piercing,
    });
  }

  private firePrimary(): void {
    const originX = this.ship.x + (this.pilot.id === 'nolan' ? 69 : 42);
    const originY = this.ship.y;
    if (this.pilot.id === 'nolan' && this.hitPoseMs === 0 && this.prismPoseMs === 0) {
      this.firePoseMs = 150;
    }

    const defs = getPrimaryProjectiles(this.pilot.id, this.weapons.weaponLevel, originX, originY);
    for (const def of defs) {
      this.createPlayerProjectile(def);
    }

    if (this.pilot.id === 'nolan') {
      const fx = this.add.sprite(originX - 8, originY + 3, 'rivet-v3-muzzle', 0)
        .setScale(0.8).setDepth(11);
      fx.once('animationcomplete', () => fx.destroy());
      fx.play('rivet-v3-muzzle-anim');
    } else {
      this.playEffect('muzzle', originX - 10, originY);
    }

    globalAudio.playShot(this.pilot.id, this.weapons.weaponLevel);
  }

  private fireSecondary(): void {
    this.weapons.missileCooldownMs = 1700;
    this.missilePoseMs = 280;
    this.changeShipAnimation('missile_launch');

    const defs = getSecondaryProjectiles(this.pilot.id, this.ship.x, this.ship.y);
    for (const def of defs) {
      this.createPlayerProjectile(def);
    }

    globalAudio.playMissile();
    this.hud.flash('ARMA SECUNDARIA / MISSEIS', '#ffd19f', 650);
  }

  private triggerSpecial(): void {
    const result = activateSpecial(this.weapons);
    if (!result.activated) {
      if (this.weapons.resonance < 100) {
        this.hud.flash('RESSONANCIA INSUFICIENTE', '#ff9e9e', 700);
      }
      return;
    }
    this.weapons = result.state;
    globalAudio.playSpecial(this.weapons.specialType);

    if (this.weapons.specialType === 'prism') {
      this.prismPoseMs = 600;
      this.hud.flash('TEMPESTADE PRISMATICA ATIVADA!', '#d6b2ff', 1600);
      this.emitPrismBurst();
    } else if (this.weapons.specialType === 'phantom') {
      this.phantomDashTimerMs = 650;
      this.hud.flash('SALTO FANTASMA!', '#7df9ff', 1200);
    } else if (this.weapons.specialType === 'nova') {
      this.hud.flash('RUPTURA NOVA!', '#ffb66a', 1500);
      this.emitRupturaNova();
    }
  }

  private emitPrismBurst(): void {
    for (const tilt of [-0.36, 0, 0.36]) {
      this.createPlayerProjectile({
        texture: 'rivet-v3-prism',
        animation: 'rivet-v3-prism-anim',
        x: this.ship.x + 55,
        y: this.ship.y,
        velocityX: 480,
        velocityY: 480 * tilt,
        damage: 1.8,
        hitRadius: 16,
        scale: 0.65,
        piercing: true,
      });
    }
  }

  private spawnPhantomAfterimage(): void {
    const afterimage = this.add.sprite(this.ship.x, this.ship.y, this.shipSprite.texture.key, this.shipSprite.frame.name)
      .setScale(this.shipSprite.scaleX, this.shipSprite.scaleY)
      .setTint(0x55ffff)
      .setAlpha(0.65)
      .setDepth(6);
    this.tweens.add({
      targets: afterimage,
      alpha: 0,
      duration: 350,
      onComplete: () => afterimage.destroy(),
    });
  }

  private emitRupturaNova(): void {
    const nova = this.add.sprite(this.ship.x, this.ship.y, 'fx-nova-wave', 0)
      .setScale(2.2).setDepth(20);
    nova.once('animationcomplete', () => nova.destroy());
    nova.play('fx-nova-wave-play');

    const radius = 150;
    // Apaga balas hostis no raio
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const shot = this.enemyShots[i];
      if (Math.hypot(shot.node.x - this.ship.x, shot.node.y - this.ship.y) <= radius) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }
    }

    // Causa dano em área
    for (const enemy of this.director.enemies) {
      if (Math.hypot(enemy.x - this.ship.x, enemy.y - this.ship.y) <= radius + 30) {
        this.applyDamageToEnemy(enemy.id, 9.5);
      }
    }
    if (this.director.boss) {
      if (Math.hypot(this.director.boss.x - this.ship.x, this.director.boss.y - this.ship.y) <= radius + 70) {
        this.director.damageBoss(9.5, this.ship.x, this.ship.y);
      }
    }
  }

  private detonateBomb(): void {
    const result = useBomb(this.weapons);
    if (!result.used) {
      this.hud.flash('SEM BOMBAS RESTANTES', '#ff9a9a', 700);
      return;
    }
    this.weapons = result.state;
    this.hud.setBombs(this.weapons.bombs);
    globalAudio.playBomb();

    // Onda de choque massiva de tela
    const bombSprite = this.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'fx-bomb-wave', 0)
      .setScale(4.2).setDepth(30);
    bombSprite.once('animationcomplete', () => bombSprite.destroy());
    bombSprite.play('fx-bomb-wave-play');

    // Flash branco na tela
    this.cameras.main.flash(280, 255, 255, 255);
    this.hud.flash('BOMBA DETONADA!', '#ffae7a', 1200);

    // Limpa todos os projéteis hostis
    this.clearEnemyShots();

    // Causa dano pesado a todos os inimigos da tela
    for (const enemy of [...this.director.enemies]) {
      this.applyDamageToEnemy(enemy.id, 12);
    }
    if (this.director.boss) {
      this.director.damageBoss(12, this.director.boss.x, this.director.boss.y);
    }
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

  private syncPickupVisuals(): void {
    const active = new Set(this.pickups.pickups.map(p => p.id));
    for (const [id, sprite] of this.pickupVisuals) {
      if (active.has(id)) continue;
      sprite.destroy();
      this.pickupVisuals.delete(id);
    }
    for (const p of this.pickups.pickups) {
      let sprite = this.pickupVisuals.get(p.id);
      if (!sprite) {
        const key = 'pickup-' + p.type;
        sprite = this.add.sprite(p.x, p.y, key, 0).setScale(1.2).setDepth(6);
        sprite.play(key + '-loop');
        this.pickupVisuals.set(p.id, sprite);
      } else {
        sprite.setPosition(p.x, p.y);
      }
    }
  }

  private checkPickupCollisions(): void {
    const collected = this.pickups.checkCollection(this.ship.x, this.ship.y, 28);
    for (const item of collected) {
      globalAudio.playPickup(item.type);

      if (item.type === 'upgrade') {
        const res = upgradeWeapon(this.weapons);
        this.weapons = res.state;
        this.hud.setWeapon(this.pilot.shipName === 'Rivet' ? 'Pulso' : this.pilot.shipName === 'Moth' ? 'Laser' : 'Canhao', this.weapons.weaponLevel);
        this.hud.flash(`UPGRADE! ARMA LV.${this.weapons.weaponLevel}`, '#ffe27a', 1100);
      } else if (item.type === 'repair') {
        if (this.health.hp < 3) {
          this.health = { ...this.health, hp: this.health.hp + 1 };
          this.hud.setHealth(this.health, this.weapons.hasShield);
          this.hud.flash('REPARO! +1 HP', '#88ffaa', 1000);
        } else {
          this.scoreCombo = addRawScore(this.scoreCombo, 300);
          this.hud.flash('INTEGRIDADE MAXIMA (+300 PTS)', '#aaffee', 900);
        }
      } else if (item.type === 'bomb') {
        this.weapons = addBomb(this.weapons);
        this.hud.setBombs(this.weapons.bombs);
        this.hud.flash('+1 BOMBA ADQUIRIDA!', '#ff9988', 1100);
      } else if (item.type === 'resonance') {
        this.weapons = addResonance(this.weapons, 25);
        this.hud.setResonance(this.weapons.resonance);
        this.hud.flash('+25% RESSONANCIA!', '#d299ff', 1000);
      } else if (item.type === 'shield') {
        this.weapons = setShield(this.weapons, true);
        this.hud.setHealth(this.health, true);
        this.hud.flash('ESCUDO DEFENSIVO ATIVADO!', '#7df9ff', 1200);
      } else if (item.type === 'score') {
        this.scoreCombo = addRawScore(this.scoreCombo, 500);
        this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
        this.hud.flash('+500 PONTOS DE DADOS', '#ffea88', 850);
      }
    }
  }

  private syncBossVisual(boss: NonNullable<StageDirector['boss']>): void {
    if (!this.bossVisual) {
      const hull = this.add.sprite(0, 0, 'boss-krm17-hull', 0).setScale(1.5);
      hull.play('boss-krm17-hull-idle');
      const drill = this.add.sprite(-78, 0, 'boss-krm17-drill', 0).setScale(1.5);
      drill.play('boss-krm17-drill-spin');
      const turretTop = this.add.sprite(22, -45, 'boss-krm17-turret', 0).setScale(1.4);
      turretTop.play('boss-krm17-turret-aim');
      const turretBottom = this.add.sprite(22, 45, 'boss-krm17-turret', 0).setScale(1.4);
      turretBottom.play('boss-krm17-turret-aim');
      const core = this.add.sprite(-10, 0, 'boss-krm17-core', 0).setScale(1.3).setVisible(false);
      core.play('boss-krm17-core-pulse');

      const container = this.add.container(boss.x, boss.y, [
        hull, drill, turretTop, turretBottom, core,
      ]).setDepth(6);

      this.bossVisual = { container, hull, drill, turretTop, turretBottom, core };
    }

    this.bossVisual.container.setPosition(boss.x, boss.y);
    this.bossVisual.turretTop.setVisible(!boss.modules[0].destroyed);
    this.bossVisual.turretBottom.setVisible(!boss.modules[1].destroyed);
    this.bossVisual.drill.setVisible(!boss.modules[2].destroyed);
    this.bossVisual.core.setVisible(boss.phase === 'phase3_core');

    if (boss.isTelegraphing) {
      this.bossVisual.drill.setTint(0xff6644);
    } else {
      this.bossVisual.drill.clearTint();
    }
  }

  private spawnEnemyShot(event: EnemyShotEvent): void {
    if (this.enemyShots.length >= 72) return;
    const bullet = this.add.sprite(event.x, event.y, 'shot-enemy', 0)
      .setScale(1.55).setDepth(10);
    bullet.play('shot-enemy-loop');
    this.enemyShots.push({
      node: bullet,
      velocityX: event.velocityX,
      velocityY: event.velocityY,
      damage: 1,
      hitRadius: 8,
    });
    this.playEffect('muzzle', event.x + 11, event.y);
    globalAudio.playEnemyShot();
  }

  private applyDamageToEnemy(enemyId: number, amount: number): void {
    const hit = this.director.damage(enemyId, amount);
    const enemy = this.director.enemies.find(e => e.id === enemyId);
    const x = enemy ? enemy.x : this.ship.x + 150;
    const y = enemy ? enemy.y : this.ship.y;

    if (hit.killed) {
      this.totalKills++;
      this.playEffect('explosion', x, y);
      globalAudio.playExplosion(false);

      const killResult = registerKill(this.scoreCombo, hit.score);
      this.scoreCombo = killResult.state;
      this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));

      // Ganha ressonância
      this.weapons = addResonance(this.weapons, 6);
      this.hud.setResonance(this.weapons.resonance);

      // Drop de itens
      const dropType = determineEnemyDrop(hit.score >= 300 ? 'lancer' : 'scout', this.totalKills);
      if (dropType) {
        this.pickups.spawn(dropType, x, y);
      }
      this.syncEnemyVisuals();
    } else {
      this.playEffect('hit', x, y);
      globalAudio.playHit();
    }
  }

  private advancePlayerShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      const prevX = shot.node.x;
      shot.node.x += (shot.velocityX * dt) / 1000;
      shot.node.y += (shot.velocityY * dt) / 1000;
      let collided = false;

      // Colisão com inimigos normais
      for (const enemy of this.director.enemies) {
        const hx = enemy.kind === 'scout' ? 19 : 29;
        const hy = enemy.kind === 'scout' ? 15 : 21;
        if (
          shot.node.x + shot.hitRadius >= enemy.x - hx &&
          prevX - shot.hitRadius <= enemy.x + hx &&
          Math.abs(shot.node.y - enemy.y) <= hy + shot.hitRadius * 0.4
        ) {
          this.applyDamageToEnemy(enemy.id, shot.damage);
          collided = !shot.piercing;
          break;
        }
      }

      // Colisão com Chefe KRM-17 se ativo
      if (!collided && this.director.boss && this.director.boss.phase !== 'intro' && this.director.boss.phase !== 'defeated') {
        const boss = this.director.boss;
        if (
          Math.abs(shot.node.x - boss.x) <= 100 &&
          Math.abs(shot.node.y - boss.y) <= 65
        ) {
          const bossHit = this.director.damageBoss(shot.damage, shot.node.x, shot.node.y);
          if (bossHit.bossDamage > 0) {
            this.playEffect(bossHit.killed ? 'explosion' : 'hit', shot.node.x, shot.node.y);
            globalAudio.playHit();
            this.hud.showBossBar('KRM-17 Excavator', boss.hp, boss.maxHp);
            if (bossHit.moduleDestroyed) {
              this.playEffect('explosion', shot.node.x, shot.node.y);
              globalAudio.playExplosion(true);
              this.hud.flash(`MODULO DESTRUIDO: ${bossHit.moduleDestroyed.toUpperCase()}`, '#ffd488', 1200);
            }
            if (bossHit.killed) {
              this.playEffect('explosion', boss.x, boss.y);
              globalAudio.playExplosion(true);
              this.hud.flash('KRM-17 EXCAVATOR ELIMINADO!', '#a3ffb8', 2500);
            }
          }
          collided = !shot.piercing;
        }
      }

      if (collided || shot.node.x > GAME_WIDTH + 30 || shot.node.x < -30) {
        shot.node.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  private checkEnemyContacts(): void {
    // Salto Fantasma ativo causa dano de contato aos inimigos
    if (this.phantomDashTimerMs > 0) {
      for (const enemy of [...this.director.enemies]) {
        if (Math.hypot(enemy.x - this.ship.x, enemy.y - this.ship.y) <= 55) {
          this.applyDamageToEnemy(enemy.id, 12);
        }
      }
      return;
    }

    for (const enemy of this.director.enemies) {
      const hx = enemy.kind === 'scout' ? 29 : 42;
      const hy = enemy.kind === 'scout' ? 21 : 29;
      if (
        Math.abs(this.ship.x - enemy.x) < hx + 15 &&
        Math.abs(this.ship.y - enemy.y) < hy + 12
      ) {
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
      shot.node.x += (shot.velocityX * dt) / 1000;
      shot.node.y += (shot.velocityY * dt) / 1000;

      const hit =
        Math.min(previousX, shot.node.x) - 8 <= this.ship.x + 16 &&
        Math.max(previousX, shot.node.x) + 8 >= this.ship.x - 16 &&
        Math.min(previousY, shot.node.y) - 8 <= this.ship.y + 11 &&
        Math.max(previousY, shot.node.y) + 8 >= this.ship.y - 11;

      const outside =
        shot.node.x < -15 ||
        shot.node.x > GAME_WIDTH + 15 ||
        shot.node.y < HUD_TOP - 20 ||
        shot.node.y > GAME_HEIGHT - HUD_BOTTOM + 20;

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
    // Se o escudo de energia estiver ativo, absorve o golpe completamente
    if (this.weapons.hasShield) {
      this.weapons = setShield(this.weapons, false);
      this.hud.setHealth(this.health, false);
      this.hud.flash('ESCUDO DISSIPADO!', '#7df9ff', 900);
      this.playEffect('hit', this.ship.x, this.ship.y);
      globalAudio.playHit();
      return 'ignored';
    }

    const outcome = applyPlayerHit(this.health);
    this.health = outcome.state;
    if (outcome.event === 'ignored') return outcome.event;

    this.hud.setHealth(this.health, false);

    if (outcome.event === 'damaged') {
      this.hud.flash('ACERTO! -1 HP', '#ffd099', 950);
      globalAudio.playHit();
      if (this.pilot.id === 'nolan') {
        this.hitPoseMs = 280;
        this.changeShipAnimation('hit');
      }
      this.playEffect('hit', this.ship.x, this.ship.y);
    } else if (outcome.event === 'respawn') {
      globalAudio.playExplosion(true);
      this.weapons = resetWeaponsOnRespawn(this.weapons);
      this.hud.setWeapon(this.pilot.shipName === 'Rivet' ? 'Pulso' : this.pilot.shipName === 'Moth' ? 'Laser' : 'Canhao', 1);
      this.hud.setResonance(this.weapons.resonance);

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
      this.hud.flash('VIDA PERDIDA / REINICIANDO SISTEMAS', '#ffcf9e', 1800);
    } else if (outcome.event === 'game-over') {
      globalAudio.playExplosion(true);
      globalAudio.stopMusic();
      this.clearEnemyShots();
      this.clearPlayerShots();
      this.hud.hideBossBar();

      this.shipSprite.play(
        this.pilot.id === 'nolan'
          ? 'rivet-v3-destruction-anim'
          : 'ship-' + this.pilot.id + '-death',
      );
      this.playEffect('explosion', this.ship.x, this.ship.y);
      this.shipSprite.once('animationcomplete', () => {
        this.ship.setVisible(false);
        new GameOverOverlay(
          this,
          this.scoreCombo.score,
          () => this.restart(),
          () => this.choosePilot(),
        );
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
