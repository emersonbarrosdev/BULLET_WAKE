import Phaser from 'phaser';
import {
  FONT_TECH,
  GAME_BACKGROUND,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_SPEED_FACTOR,
  PLAYFIELD_X,
  PLAYFIELD_WIDTH,
  PLAYFIELD_RIGHT,
} from '../constants';
import { clamp, moveInBounds } from '../systems/movement';
import { advanceHealth, applyPlayerHit, initialPlayerHealth, type HitEvent, type PlayerHealth } from '../systems/combat';
import { StageDirector, type EnemyModel, type EnemyShotEvent } from '../systems/stageDirector';
import { CombatHud } from '../ui/CombatHud';
import { getPilot, type PilotDefinition } from '../data/pilots';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { GameOverOverlay } from '../ui/GameOverOverlay';
import { StageCompleteOverlay } from '../ui/StageCompleteOverlay';
import { StageBackdrop } from './StageBackdrop';
import { STAGES } from '../data/stages';
import { saveSystem } from '../systems/saveSystem.ts';
import { VectorShip } from '../render/VectorShip';
import {
  createInitialDashState,
  triggerDash,
  advanceDash,
  isDashActive,
  isDashInvulnerable,
  type DashState,
} from '../systems/dashSystem.ts';
import {
  createPlayerWeapons,
  upgradeWeapon,
  switchWeaponFamily,
  addResonance,
  activateSpecial,
  useBomb,
  addBomb,
  setShield,
  advanceWeapons,
  resetWeaponsOnRespawn,
  getPrimaryProjectiles,
  getSecondaryProjectiles,
  getChargedProjectiles,
  recordPrimaryShot,
  updateWeaponCharge,
  releaseWeaponCharge,
  WEAPON_FAMILY_SPECS,
  MAX_CHARGE_MS,
  type PlayerWeaponsState,
  type ProjectileSpawnDef,
} from '../systems/weaponSystem.ts';
import { InputManager } from '../systems/inputSystem.ts';
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
  name: string;
  container: Phaser.GameObjects.Container;
  main: Phaser.GameObjects.Sprite;
  sub1?: Phaser.GameObjects.Sprite;
  sub2?: Phaser.GameObjects.Sprite;
  sub3?: Phaser.GameObjects.Sprite;
  core?: Phaser.GameObjects.Sprite;
}

/**
 * Cena principal de combate do BULLET WAKE V2.
 * Shmup vertical top-down em corredor central protegido (384px),
 * 3 dashes fixos por fase, armas Fire Shark evoluindo LV1-4,
 * coletáveis físicos e chefes da Fenda Pelágica.
 */
export class PrototypeScene extends Phaser.Scene {
  private vectorShip!: VectorShip;
  get ship(): VectorShip {
    return this.vectorShip;
  }

  private hitPoseMs = 0;
  private missilePoseMs = 0;
  private prismPoseMs = 0;
  private phantomDashTimerMs = 0;

  private pilot: PilotDefinition = getPilot('nolan');
  private stageNumber = 1;
  private weapons: PlayerWeaponsState = createPlayerWeapons('nolan');
  private scoreCombo: ScoreComboState = initialScoreCombo();
  private health: PlayerHealth = initialPlayerHealth();
  private dashState: DashState = createInitialDashState();

  private hud!: CombatHud;
  private backdrop!: StageBackdrop;
  private inputManager!: InputManager;

  private shots: Projectile[] = [];
  private enemyShots: Projectile[] = [];
  private enemyVisuals = new Map<number, EnemyVisual>();
  private pickupVisuals = new Map<number, Phaser.GameObjects.Sprite>();

  private pickups = new PickupSystem();
  private director = new StageDirector(GAME_WIDTH, true, 1);
  private bossVisual?: BossVisual;

  private shootCooldown = 0;
  private totalKills = 0;
  private completed = false;

  constructor() {
    super({ key: 'PrototypeScene' });
  }

  init(data: { pilotId?: string; stageNumber?: number } = {}): void {
    this.pilot = getPilot(data.pilotId);
    this.stageNumber = data.stageNumber || 1;
  }

  preload(): void {
    loadGameSprites(this);
  }

  create(): void {
    registerGameAnimations(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);

    this.hitPoseMs = 0;
    this.missilePoseMs = 0;
    this.prismPoseMs = 0;
    this.phantomDashTimerMs = 0;

    this.weapons = createPlayerWeapons(this.pilot.id);
    this.scoreCombo = initialScoreCombo();
    this.health = initialPlayerHealth();
    this.dashState = createInitialDashState();
    this.totalKills = 0;
    this.completed = false;

    this.shots = [];
    this.enemyShots = [];
    this.enemyVisuals.clear();
    this.pickupVisuals.clear();
    this.pickups.clear();
    this.bossVisual = undefined;

    const difficulty = saveSystem.getSettings().difficulty || 'normal';
    this.director = new StageDirector(GAME_WIDTH, true, this.stageNumber, difficulty);
    this.shootCooldown = 0;

    this.backdrop = new StageBackdrop(this, this.stageNumber);
    this.inputManager = new InputManager(this);

    this.hud = new CombatHud(this, () => this.restart());
    this.hud.setPilot(this.pilot.shipName, this.pilot.callsign);
    this.hud.setScore(0);
    this.hud.setHealth(this.health, false);
    this.hud.setDash(this.dashState.remainingDashes);
    this.hud.setProgress(0);
    this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel);
    this.hud.setBombs(this.weapons.bombs);
    this.hud.setResonance(0);

    const stageDef = STAGES[this.stageNumber - 1] || STAGES[0];
    const diffTag = difficulty === 'arcade' ? ' [ARCADE]' : difficulty === 'hard' ? ' [HARD]' : '';
    this.hud.flash(`FASE 0${this.stageNumber}  -  ${stageDef.title.toUpperCase()}${diffTag}`, '#a6e3e2', 2600);

    // Nave do jogador centralizada no corredor vertical, apontando para o Norte (-Y)
    const initialShipX = PLAYFIELD_X + PLAYFIELD_WIDTH / 2;
    const initialShipY = 350;
    this.vectorShip = new VectorShip(this, initialShipX, initialShipY, this.pilot.id);

    globalAudio.startStageMusic();
  }

  update(_time: number, delta: number): void {
    const dt = clamp(delta, 0, 50);

    const commands = this.inputManager.sample(this.vectorShip.x, this.vectorShip.y);

    if (commands.restart) {
      this.restart();
      return;
    }
    if (commands.menuOrBack) {
      this.choosePilot();
      return;
    }
    if (this.health.gameOver || this.completed) return;

    // Atualiza timers do combate e dash
    this.health = advanceHealth(this.health, dt);
    this.weapons = advanceWeapons(this.weapons, dt);
    this.scoreCombo = advanceCombo(this.scoreCombo, dt);
    this.dashState = advanceDash(this.dashState, dt);

    this.hitPoseMs = Math.max(0, this.hitPoseMs - dt);
    this.missilePoseMs = Math.max(0, this.missilePoseMs - dt);
    this.prismPoseMs = Math.max(0, this.prismPoseMs - dt);
    this.phantomDashTimerMs = Math.max(0, this.phantomDashTimerMs - dt);

    // 0. Acionamento do Dash de Emergência (LEFT SHIFT no PC)
    if (commands.dashTrigger) {
      const dashResult = triggerDash(this.dashState);
      if (dashResult.triggered) {
        this.dashState = dashResult.state;
        this.hud.setDash(this.dashState.remainingDashes);
        this.hud.flash('DASH DE EMERGÊNCIA!', '#38bdf8', 400);
        this.spawnPhantomAfterimage();
        globalAudio.playSpecial('phantom');
      }
    }

    // Atualiza o HUD
    this.hud.update(dt);
    this.hud.setHealth(this.health, this.weapons.hasShield);
    this.hud.setDash(this.dashState.remainingDashes);
    this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel);
    this.hud.setBombs(this.weapons.bombs);
    this.hud.setResonance(this.weapons.resonance, this.weapons.specialActiveMs > 0);
    this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
    this.hud.setHeat(this.weapons.heat, this.weapons.isOverheated);
    this.hud.setCharge(this.weapons.chargeMs, MAX_CHARGE_MS, this.weapons.isCharging);

    // Efeito de invulnerabilidade (piscar transparente)
    const isInvuln = this.health.invulnerableMs > 0 || isDashInvulnerable(this.dashState);
    this.vectorShip.setAlpha(
      isInvuln && Math.floor(Date.now() / 80) % 2 === 0 ? 0.35 : 1,
    );

    // Movimentação da nave estritamente no corredor vertical
    let dx = commands.moveX;
    let dy = commands.moveY;

    let speed = this.pilot.speed * PLAYER_SPEED_FACTOR;
    const dashing = isDashActive(this.dashState);
    if (dashing) {
      speed *= 2.8;
      this.spawnPhantomAfterimage();
    } else if (this.phantomDashTimerMs > 0) {
      dy = -1.6; // Dash frontal para o Norte
      speed = 650;
      this.spawnPhantomAfterimage();
    }

    const halfW = this.vectorShip.halfWidth;
    const halfH = this.vectorShip.halfHeight;
    const moved = moveInBounds(
      { x: this.vectorShip.x, y: this.vectorShip.y },
      dx, dy, speed, dt,
      {
        minX: PLAYFIELD_X + halfW + 6,
        maxX: PLAYFIELD_RIGHT - halfW - 6,
        minY: halfH + 12,
        maxY: GAME_HEIGHT - halfH - 12,
      },
    );
    this.vectorShip.setPosition(moved.x, moved.y);
    this.vectorShip.updateShip(dt, dx, dy, this.hitPoseMs, this.weapons.hasShield, dashing);

    // 1. Atualização e Liberação de Disparo Carregado (Wave Cannon - tecla C)
    this.weapons = updateWeaponCharge(this.weapons, dt, commands.chargeHeld);
    if (this.weapons.isCharging && this.weapons.chargeMs > 250) {
      const chargeRatio = this.weapons.chargeMs / MAX_CHARGE_MS;
      if (Math.floor(this.weapons.chargeMs / 140) % 2 === 0) {
        globalAudio.playChargeWindup(chargeRatio);
      }
      this.vectorShip.triggerMuzzleFlash();
    }

    if (commands.chargeReleased) {
      const result = releaseWeaponCharge(this.weapons);
      this.weapons = result.state;
      if (result.chargeLevel === 1 || result.chargeLevel === 2) {
        this.fireChargedShot(result.chargeLevel);
      }
    }

    // 2. Disparos Primários: Tapping Rápido (Burst) vs Auto-Fire Contínuo (ESPAÇO no PC)
    const specs = WEAPON_FAMILY_SPECS[this.weapons.weaponFamily] || WEAPON_FAMILY_SPECS.green;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);

    if (!this.weapons.isCharging && !this.weapons.isOverheated) {
      if (commands.firePrimaryTap && this.shootCooldown <= 0) {
        this.firePrimary();
        this.shootCooldown = specs.burstIntervalMs;
      } else if (commands.firePrimary && this.shootCooldown <= 0) {
        this.firePrimary();
        this.shootCooldown = specs.autoIntervalMs;
      }
    } else if (this.weapons.isOverheated && (commands.firePrimary || commands.firePrimaryTap)) {
      if (Math.floor(this.weapons.overheatCooldownMs / 160) % 2 === 0) {
        this.hud.flash('SUPER-AQUECIMENTO! RESFRIANDO...', '#ef4444', 300);
      }
    }

    // 3. Disparo Secundário / Mísseis (tecla M)
    if (commands.missile && this.weapons.missileCooldownMs <= 0) {
      this.fireSecondary();
    }

    // 4. Ativação do Especial de Ressonância (tecla V)
    if (commands.special) {
      this.triggerSpecial();
    }

    // 5. Bomba Defensiva de Emergência (tecla X ou B)
    if (commands.bomb) {
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

    // Atualiza pickups físicos
    this.pickups.update(dt, this.ship.x, this.ship.y);
    this.syncPickupVisuals();
    this.checkPickupCollisions();

    // Atualiza chefe ou miniboss se ativo
    if (tick.bossActive && this.director.boss) {
      this.syncBossVisual(this.director.boss);
      this.hud.showBossBar(this.director.boss.name, this.director.boss.hp, this.director.boss.maxHp);
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

      saveSystem.recordStageClear(this.stageNumber, this.pilot.id, this.scoreCombo.score);

      if (this.stageNumber >= 15) {
        this.scene.start('EndingScene', {
          pilotId: this.pilot.id,
          score: this.scoreCombo.score,
        });
      } else {
        new StageCompleteOverlay(
          this,
          this.stageNumber,
          this.scoreCombo.score,
          () => this.scene.start('PrototypeScene', { pilotId: this.pilot.id, stageNumber: this.stageNumber + 1 }),
          () => this.restart(),
          () => this.scene.start('StageSelectScene'),
        );
      }
    }
  }

  private restart(): void {
    globalAudio.stopMusic();
    this.scene.restart({ pilotId: this.pilot.id, stageNumber: this.stageNumber });
  }

  private choosePilot(): void {
    globalAudio.stopMusic();
    this.scene.start('PilotSelectScene', { selectedPilotId: this.pilot.id, stageNumber: this.stageNumber });
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
    const originX = this.vectorShip.x;
    const originY = this.vectorShip.y - this.vectorShip.halfHeight - 2;
    this.vectorShip.triggerMuzzleFlash();

    const defs = getPrimaryProjectiles(this.weapons.weaponFamily, this.weapons.weaponLevel, originX, originY);
    for (const def of defs) {
      this.createPlayerProjectile(def);
    }

    const result = recordPrimaryShot(this.weapons);
    this.weapons = result.state;
    if (result.overheatedNow) {
      globalAudio.playOverheat();
      this.hud.flash('ARMA SUPER-AQUECIDA! RESFRIANDO...', '#ef4444', 900);
      this.cameras.main.shake(120, 0.005);
    }

    this.playEffect('muzzle', originX, originY);
    globalAudio.playShot(this.pilot.id, this.weapons.weaponLevel);
  }

  private fireChargedShot(chargeLevel: 1 | 2): void {
    const originX = this.vectorShip.x;
    const originY = this.vectorShip.y - this.vectorShip.halfHeight - 4;
    this.vectorShip.triggerMuzzleFlash();

    const defs = getChargedProjectiles(this.pilot.id, chargeLevel, originX, originY);
    for (const def of defs) {
      this.createPlayerProjectile(def);
    }

    globalAudio.playChargedShot(this.pilot.id, chargeLevel);
    this.playEffect('muzzle', originX, originY);
    this.cameras.main.shake(180, chargeLevel === 2 ? 0.009 : 0.004);

    const shotName = this.pilot.id === 'nolan'
      ? (chargeLevel === 2 ? 'FEIXE PRISMÁTICO MÁXIMO!' : 'FEIXE PENETRANTE')
      : this.pilot.id === 'cora'
      ? (chargeLevel === 2 ? 'OVERDRIVE AGULHAS (VENTILADO)!' : 'RAJADA AGULHAS')
      : (chargeLevel === 2 ? 'MEGA-CANHÃO CINÉTICO!' : 'IMPACTO PESADO');

    this.hud.flash(shotName, chargeLevel === 2 ? '#00f0ff' : '#ffd166', 800);
  }

  private fireSecondary(): void {
    this.weapons.missileCooldownMs = 1700;
    this.missilePoseMs = 280;

    const defs = getSecondaryProjectiles(this.pilot.id, this.vectorShip.x, this.vectorShip.y);
    for (const def of defs) {
      this.createPlayerProjectile(def);
    }

    globalAudio.playMissile();
    this.hud.flash('ARMA SECUNDÁRIA / MÍSSEIS', '#ffd19f', 650);
  }

  private triggerSpecial(): void {
    const result = activateSpecial(this.weapons);
    if (!result.activated) {
      if (this.weapons.resonance < 100) {
        this.hud.flash('RESSONÂNCIA INSUFICIENTE', '#ff9e9e', 700);
      }
      return;
    }
    this.weapons = result.state;
    this.cameras.main.shake(220, 0.009);
    globalAudio.playSpecial(this.weapons.specialType);

    if (this.weapons.specialType === 'prism') {
      this.prismPoseMs = 600;
      this.hud.flash('TEMPESTADE PRISMÁTICA ATIVADA!', '#d6b2ff', 1600);
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
    for (const tilt of [-160, 0, 160]) {
      this.createPlayerProjectile({
        texture: 'rivet-v3-prism',
        animation: 'rivet-v3-prism-anim',
        x: this.vectorShip.x,
        y: this.vectorShip.y - 20,
        velocityX: tilt,
        velocityY: -520,
        damage: 1.8,
        hitRadius: 16,
        scale: 0.65,
        piercing: true,
      });
    }
  }

  private spawnPhantomAfterimage(): void {
    const ghost = this.add.graphics();
    ghost.fillStyle(0x38bdf8, 0.45);
    ghost.fillTriangle(
      this.vectorShip.x, this.vectorShip.y - 18,
      this.vectorShip.x - 14, this.vectorShip.y + 14,
      this.vectorShip.x + 14, this.vectorShip.y + 14,
    );
    ghost.setDepth(6);
    this.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: 260,
      onComplete: () => ghost.destroy(),
    });
  }

  private emitRupturaNova(): void {
    const nova = this.add.sprite(this.vectorShip.x, this.vectorShip.y, 'fx-nova-wave', 0)
      .setScale(2.2).setDepth(20);
    nova.once('animationcomplete', () => nova.destroy());
    nova.play('fx-nova-wave-play');

    const radius = 150;
    // Apaga balas hostis no raio
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const shot = this.enemyShots[i];
      if (Math.hypot(shot.node.x - this.vectorShip.x, shot.node.y - this.vectorShip.y) <= radius) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }
    }

    // Causa dano em área
    for (const enemy of this.director.enemies) {
      if (Math.hypot(enemy.x - this.vectorShip.x, enemy.y - this.vectorShip.y) <= radius + 30) {
        this.applyDamageToEnemy(enemy.id, 9.5);
      }
    }
    if (this.director.boss) {
      if (Math.hypot(this.director.boss.x - this.vectorShip.x, this.director.boss.y - this.vectorShip.y) <= radius + 70) {
        this.director.damageBoss(9.5, this.vectorShip.x, this.vectorShip.y);
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
    const bombSprite = this.add.sprite(PLAYFIELD_X + PLAYFIELD_WIDTH / 2, GAME_HEIGHT / 2, 'fx-bomb-wave', 0)
      .setScale(4.2).setDepth(30);
    bombSprite.once('animationcomplete', () => bombSprite.destroy());
    bombSprite.play('fx-bomb-wave-play');

    // Flash e shake
    this.cameras.main.flash(280, 255, 255, 255);
    this.cameras.main.shake(380, 0.016);
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
    const isSmall = enemy.kind === 'scout' || enemy.kind === 'dart';
    const body = this.add.sprite(0, 0, texture, 0)
      .setScale(isSmall ? 2.15 : 1.85);
    // Aponta para o Sul (+Y) em direção ao jogador
    body.setAngle(90);
    body.play(texture + '-fly');
    const warning = this.add.sprite(0, 24, 'fx-warning', 0)
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
        // Mapeia sprites para os tipos canônicos Fire Shark
        let key = 'pickup-upgrade';
        if (p.type === 'power' || p.type === 'weapon_green') key = 'pickup-upgrade';
        else if (p.type === 'weapon_ion') key = 'pickup-shield';
        else if (p.type === 'weapon_red') key = 'pickup-bomb';
        else if (p.type === 'health') key = 'pickup-repair';
        else if (p.type === 'bomb') key = 'pickup-bomb';
        else if (p.type === 'special') key = 'pickup-resonance';
        else if (p.type === 'score') key = 'pickup-score';

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

      if (item.type === 'power') {
        const res = upgradeWeapon(this.weapons);
        this.weapons = res.state;
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel);
        this.hud.flash(`PODER DE ARMA +1! (LV.${this.weapons.weaponLevel})`, '#22c55e', 1100);
      } else if (item.type === 'weapon_green') {
        this.weapons = switchWeaponFamily(this.weapons, 'green');
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel);
        this.hud.flash('ARMA: PULSO VERDE ATIVADO!', '#22c55e', 1200);
      } else if (item.type === 'weapon_ion') {
        this.weapons = switchWeaponFamily(this.weapons, 'ion');
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel);
        this.hud.flash('ARMA: LASER DE ÍONS ATIVADO!', '#06b6d4', 1200);
      } else if (item.type === 'weapon_red') {
        this.weapons = switchWeaponFamily(this.weapons, 'red');
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel);
        this.hud.flash('ARMA: PLASMA VERMELHO ATIVADO!', '#ef4444', 1200);
      } else if (item.type === 'health') {
        if (this.health.hp < 3) {
          this.health = { ...this.health, hp: this.health.hp + 1 };
          this.hud.setHealth(this.health, this.weapons.hasShield);
          this.hud.flash('REPARO! +1 HP', '#88ffaa', 1000);
        } else {
          this.scoreCombo = addRawScore(this.scoreCombo, 300);
          this.hud.flash('INTEGRIDADE MÁXIMA (+300 PTS)', '#aaffee', 900);
        }
      } else if (item.type === 'bomb') {
        this.weapons = addBomb(this.weapons);
        this.hud.setBombs(this.weapons.bombs);
        this.hud.flash('+1 BOMBA ADQUIRIDA!', '#ff9988', 1100);
      } else if (item.type === 'missile') {
        this.weapons.missileCooldownMs = 0;
        this.hud.flash('MÍSSEIS RECARREGADOS!', '#ffd19f', 1000);
      } else if (item.type === 'special') {
        this.weapons = addResonance(this.weapons, 25);
        this.hud.setResonance(this.weapons.resonance);
        this.hud.flash('+25% RESSONÂNCIA!', '#d299ff', 1000);
      } else if (item.type === 'score') {
        this.scoreCombo = addRawScore(this.scoreCombo, 500);
        this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
        this.hud.flash('+500 PONTOS', '#ffea88', 850);
        this.spawnScorePopup(500, this.vectorShip.x, this.vectorShip.y, '#ffd700');
      }
    }
  }

  private spawnScorePopup(points: number, x: number, y: number, color = '#ffd488'): void {
    const text = this.add.text(x, y - 8, `+${points}`, {
      fontFamily: FONT_TECH,
      fontSize: '13px',
      fontStyle: 'bold',
      color,
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({
      targets: text,
      y: y - 32,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private syncBossVisual(boss: NonNullable<StageDirector['boss']>): void {
    if (this.bossVisual && this.bossVisual.name !== boss.name) {
      this.bossVisual.container.destroy();
      this.bossVisual = undefined;
    }

    if (!this.bossVisual) {
      const parts: Phaser.GameObjects.GameObject[] = [];
      let main: Phaser.GameObjects.Sprite;
      let sub1: Phaser.GameObjects.Sprite | undefined;
      let sub2: Phaser.GameObjects.Sprite | undefined;
      let sub3: Phaser.GameObjects.Sprite | undefined;
      let core: Phaser.GameObjects.Sprite | undefined;

      if (boss.name === 'RAIA-DENTE') {
        // Miniboss da Fase 1: Raia-Dente
        main = this.add.sprite(0, 0, 'boss-interceptor-chassis', 0).setScale(1.6).play('boss-interceptor-chassis-flight');
        sub1 = this.add.sprite(-40, 5, 'boss-interceptor-wing', 0).setScale(1.5).play('boss-interceptor-wing-spark');
        sub2 = this.add.sprite(40, 5, 'boss-interceptor-wing', 0).setScale(1.5).play('boss-interceptor-wing-spark');
        parts.push(sub1, sub2, main);
      } else if (boss.name === 'TALASSARCA') {
        // Chefe Colossal da Fase 1: Talassarca
        main = this.add.sprite(0, 0, 'boss-fortress-chassis', 0).setScale(1.8).play('boss-fortress-chassis-loop');
        sub1 = this.add.sprite(-85, 10, 'boss-interceptor-wing', 0).setScale(1.6).play('boss-interceptor-wing-spark');
        sub2 = this.add.sprite(85, 10, 'boss-interceptor-wing', 0).setScale(1.6).play('boss-interceptor-wing-spark');
        core = this.add.sprite(0, 15, 'boss-mesh_core-heart', 0).setScale(1.5).play('boss-mesh_core-heart-pulse');
        parts.push(main, sub1, sub2, core);
      } else {
        // Chefe genérico para outras fases
        main = this.add.sprite(0, 0, 'boss-krm17-hull', 0).setScale(1.5).play('boss-krm17-hull-idle');
        sub1 = this.add.sprite(-78, 0, 'boss-krm17-drill', 0).setScale(1.5).play('boss-krm17-drill-spin');
        sub2 = this.add.sprite(22, -45, 'boss-krm17-turret', 0).setScale(1.4).play('boss-krm17-turret-aim');
        sub3 = this.add.sprite(22, 45, 'boss-krm17-turret', 0).setScale(1.4).play('boss-krm17-turret-aim');
        core = this.add.sprite(-10, 0, 'boss-krm17-core', 0).setScale(1.3).setVisible(false).play('boss-krm17-core-pulse');
        parts.push(main, sub1, sub2, sub3, core);
      }

      const container = this.add.container(boss.x, boss.y, parts).setDepth(6);
      this.bossVisual = { name: boss.name, container, main, sub1, sub2, sub3, core };
    }

    this.bossVisual.container.setPosition(boss.x, boss.y);

    if (boss.name === 'TALASSARCA' && boss.modules) {
      if (this.bossVisual.sub1) this.bossVisual.sub1.setVisible(!boss.modules[0]?.destroyed);
      if (this.bossVisual.sub2) this.bossVisual.sub2.setVisible(!boss.modules[1]?.destroyed);
      if (this.bossVisual.core) this.bossVisual.core.setVisible(boss.phase === 'core' || boss.phase === 'tentacles');
    }

    if (boss.isTelegraphing) {
      this.bossVisual.main.setTint(0xff6644);
      if (this.bossVisual.sub1) this.bossVisual.sub1.setTint(0xff6644);
    } else {
      this.bossVisual.main.clearTint();
      if (this.bossVisual.sub1) this.bossVisual.sub1.clearTint();
    }
  }

  private spawnEnemyShot(event: EnemyShotEvent): void {
    if (this.enemyShots.length >= 84) return;
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
    this.playEffect('muzzle', event.x, event.y + 8);
    globalAudio.playEnemyShot();
  }

  private applyDamageToEnemy(enemyId: number, amount: number): void {
    const hit = this.director.damage(enemyId, amount);
    const enemy = this.director.enemies.find(e => e.id === enemyId);
    const x = enemy ? enemy.x : this.ship.x;
    const y = enemy ? enemy.y : this.ship.y - 120;

    if (hit.killed) {
      this.totalKills++;
      this.playEffect('explosion', x, y);
      globalAudio.playExplosion(false);

      const killResult = registerKill(this.scoreCombo, hit.score);
      this.scoreCombo = killResult.state;
      this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
      this.spawnScorePopup(hit.score, x, y);

      // Ganho de ressonância: 4% para drones leves, 8% para bio-médios
      const resGain = (hit.score >= 250) ? 8 : 4;
      this.weapons = addResonance(this.weapons, resGain);
      this.hud.setResonance(this.weapons.resonance);

      // Drop de itens físicos
      const dropKind = (hit.score >= 300) ? 'lancer' : (hit.score >= 250) ? 'cutter' : (hit.score >= 150) ? 'dart' : 'scout';
      const dropType = determineEnemyDrop(dropKind, this.totalKills);
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
      shot.node.x += (shot.velocityX * dt) / 1000;
      shot.node.y += (shot.velocityY * dt) / 1000;
      let collided = false;

      // Colisão com inimigos alienígenas no corredor
      for (const enemy of this.director.enemies) {
        const isSmall = enemy.kind === 'scout' || enemy.kind === 'dart';
        const hx = isSmall ? 18 : 26;
        const hy = isSmall ? 18 : 26;
        if (
          Math.abs(shot.node.x - enemy.x) <= hx + shot.hitRadius &&
          Math.abs(shot.node.y - enemy.y) <= hy + shot.hitRadius
        ) {
          this.applyDamageToEnemy(enemy.id, shot.damage);
          collided = !shot.piercing;
          break;
        }
      }

      // Colisão com Miniboss ou Chefe se ativo
      if (!collided && this.director.boss && this.director.boss.phase !== 'intro' && this.director.boss.phase !== 'defeated') {
        const boss = this.director.boss;
        if (
          Math.abs(shot.node.x - boss.x) <= 110 &&
          Math.abs(shot.node.y - boss.y) <= 80
        ) {
          const bossHit = this.director.damageBoss(shot.damage, shot.node.x, shot.node.y);
          if (bossHit.bossDamage > 0) {
            this.playEffect(bossHit.killed ? 'explosion' : 'hit', shot.node.x, shot.node.y);
            globalAudio.playHit();
            this.hud.showBossBar(boss.name, boss.hp, boss.maxHp);
            if (bossHit.moduleDestroyed) {
              this.playEffect('explosion', shot.node.x, shot.node.y);
              globalAudio.playExplosion(true);
              this.cameras.main.shake(260, 0.012);
              this.hud.flash(`PARTE DESTRUÍDA: ${bossHit.moduleDestroyed.toUpperCase()}`, '#ffd488', 1200);
            }
            if (bossHit.killed) {
              this.playEffect('explosion', boss.x, boss.y);
              globalAudio.playExplosion(true);
              this.cameras.main.shake(450, 0.02);
              this.hud.flash(`${boss.name.toUpperCase()} ELIMINADO!`, '#a3ffb8', 2500);
            }
          }
          collided = !shot.piercing;
        }
      }

      if (
        collided ||
        shot.node.y < -30 ||
        shot.node.y > GAME_HEIGHT + 30 ||
        shot.node.x < PLAYFIELD_X - 30 ||
        shot.node.x > PLAYFIELD_RIGHT + 30
      ) {
        shot.node.destroy();
        this.shots.splice(i, 1);
      }
    }
  }

  private checkEnemyContacts(): void {
    // Dash de emergência ou Salto Fantasma ativo causa dano de abalroamento sem sofrer dano
    if (isDashActive(this.dashState) || this.phantomDashTimerMs > 0) {
      for (const enemy of [...this.director.enemies]) {
        if (Math.hypot(enemy.x - this.vectorShip.x, enemy.y - this.vectorShip.y) <= 55) {
          this.applyDamageToEnemy(enemy.id, 10);
        }
      }
      return;
    }

    for (const enemy of this.director.enemies) {
      const isSmall = enemy.kind === 'scout' || enemy.kind === 'dart';
      const hx = isSmall ? 18 : 28;
      const hy = isSmall ? 14 : 20;
      const dist = Math.hypot(this.vectorShip.x - enemy.x, this.vectorShip.y - enemy.y);
      if (dist < Math.hypot(hx, hy) * 0.75 + this.vectorShip.hitRadius + 3) {
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
      shot.node.x += (shot.velocityX * dt) / 1000;
      shot.node.y += (shot.velocityY * dt) / 1000;

      // Micro-hitbox euclidiana de Shmup: precisão milimétrica e graze
      const dist = Math.hypot(shot.node.x - this.vectorShip.x, shot.node.y - this.vectorShip.y);
      const hit = dist <= (shot.hitRadius + this.vectorShip.hitRadius);

      const outside =
        shot.node.x < PLAYFIELD_X - 20 ||
        shot.node.x > PLAYFIELD_RIGHT + 20 ||
        shot.node.y < -20 ||
        shot.node.y > GAME_HEIGHT + 20;

      if (hit || outside) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }
      if (hit) {
        // Se estiver em janela de invulnerabilidade do dash, ignora o dano
        if (isDashInvulnerable(this.dashState)) {
          this.playEffect('hit', this.vectorShip.x, this.vectorShip.y);
          continue;
        }
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
      this.playEffect('hit', this.vectorShip.x, this.vectorShip.y);
      globalAudio.playHit();
      this.cameras.main.shake(120, 0.005);
      return 'ignored';
    }

    const outcome = applyPlayerHit(this.health);
    this.health = outcome.state;
    if (outcome.event === 'ignored') return outcome.event;

    this.hud.setHealth(this.health, false);

    if (outcome.event === 'damaged') {
      this.hud.flash('ACERTO! -1 HP', '#ffd099', 950);
      globalAudio.playHit();
      this.hitPoseMs = 280;
      this.playEffect('hit', this.vectorShip.x, this.vectorShip.y);
      this.cameras.main.shake(180, 0.009);
    } else if (outcome.event === 'respawn') {
      globalAudio.playExplosion(true);
      this.cameras.main.shake(380, 0.02);
      this.weapons = resetWeaponsOnRespawn(this.weapons);
      this.hud.setWeapon(this.weapons.weaponFamily, 1);
      this.hud.setResonance(this.weapons.resonance);

      this.missilePoseMs = 0;
      this.prismPoseMs = 0;
      const oldX = this.vectorShip.x, oldY = this.vectorShip.y;
      this.playEffect('explosion', oldX, oldY);
      this.clearEnemyShots();
      this.hitPoseMs = 0;
      // Reposiciona na base do corredor
      this.vectorShip.setPosition(PLAYFIELD_X + PLAYFIELD_WIDTH / 2, 350).setAlpha(1);
      this.hud.flash('VIDA PERDIDA / REINICIANDO SISTEMAS', '#ffcf9e', 1800);
    } else if (outcome.event === 'game-over') {
      globalAudio.playExplosion(true);
      globalAudio.stopMusic();
      this.cameras.main.shake(500, 0.025);
      this.clearEnemyShots();
      this.clearPlayerShots();
      this.hud.hideBossBar();

      this.playEffect('explosion', this.vectorShip.x, this.vectorShip.y);
      this.vectorShip.setVisible(false);
      new GameOverOverlay(
        this,
        this.scoreCombo.score,
        () => this.restart(),
        () => this.choosePilot(),
      );
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
