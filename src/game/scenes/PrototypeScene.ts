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
import { PremiumCombatHud } from '../ui/PremiumCombatHud';
import { getPilot, type PilotDefinition } from '../data/pilots';
import { loadGameSprites, registerGameAnimations } from '../assets/spriteAssets';
import { GameOverOverlay } from '../ui/GameOverOverlay';
import { StageCompleteOverlay } from '../ui/StageCompleteOverlay';
import { StageBackdrop } from './StageBackdrop';
import { STAGES } from '../data/stages';
import { saveSystem } from '../systems/saveSystem.ts';
import { VectorShip } from '../render/VectorShip';
import { enableCombatResolution } from '../render/combatResolution';
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
  collectPowerItem,
  collectFullPowerItem,
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
  updateWeaponCharge,
  releaseWeaponCharge,
  WEAPON_FAMILY_SPECS,
  MAX_CHARGE_MS,
  type PlayerWeaponsState,
  type ProjectileSpawnDef,
  type WeaponFamily,
  type WeaponLevel,
} from '../systems/weaponSystem.ts';
import {
  LASER_RUBRO_SPECS,
  createInitialCrimsonLaserState,
  stepCrimsonLaser,
  type CrimsonLaserState,
  type LaserTargetCircle,
} from '../systems/crimsonLaserSystem.ts';
import { CrimsonLaserRenderer } from '../render/CrimsonLaserRenderer.ts';
import { InputManager } from '../systems/inputSystem.ts';
import { PickupSystem, determineEnemyDrop, type PickupType } from '../systems/pickupSystem.ts';
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
  baseX: number;
  ageMs: number;
  velocityX: number;
  velocityY: number;
  damage: number;
  hitRadius: number;
  piercing?: boolean;
  waveAmplitude?: number;
  waveFrequency?: number;
  wavePhase?: number;
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

  private hud!: CombatHud | PremiumCombatHud;
  private backdrop!: StageBackdrop;
  private inputManager!: InputManager;

  private shots: Projectile[] = [];
  private enemyShots: Projectile[] = [];
  private enemyVisuals = new Map<number, EnemyVisual>();
  private pickupVisuals = new Map<number, Phaser.GameObjects.Container>();

  private pickups = new PickupSystem();
  private director = new StageDirector(GAME_WIDTH, true, 1);
  private bossVisual?: BossVisual;

  private crimsonLaserState: CrimsonLaserState = createInitialCrimsonLaserState(1);
  private crimsonLaserRenderer!: CrimsonLaserRenderer;
  private laserAudioTimerMs = 0;

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
    if (this.pilot.id === 'nolan') enableCombatResolution(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);

    this.hitPoseMs = 0;
    this.missilePoseMs = 0;
    this.prismPoseMs = 0;
    this.phantomDashTimerMs = 0;

    // Regra Canônica Fire Shark #1: O jogador inicia equipado com Wide Shot azul (DISPERSÃO AZUL, Nível 1, 0/3 P)
    this.weapons = createPlayerWeapons(this.pilot.id, 'ion');
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
    this.laserAudioTimerMs = 0;

    this.backdrop = new StageBackdrop(this, this.stageNumber, { fullWidth: false, showBezels: true });
    this.inputManager = new InputManager(this);

    this.hud = this.pilot.id === 'nolan'
      ? new PremiumCombatHud(this, () => this.restart())
      : new CombatHud(this, () => this.restart());
    this.hud.setPilot(this.pilot.id, this.pilot.shipName);
    this.hud.setScore(0);
    this.hud.setHealth(this.health, false);
    this.hud.setDash(this.dashState.remainingDashes);
    this.hud.setProgress(0);
    this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
    this.hud.setBombs(this.weapons.bombs);
    this.hud.setResonance(0);

    const stageDef = STAGES[this.stageNumber - 1] || STAGES[0];
    const diffTag = difficulty === 'arcade' ? ' [ARCADE]' : difficulty === 'hard' ? ' [HARD]' : '';
    this.hud.flash(`FASE 0${this.stageNumber}  -  ${stageDef.title.toUpperCase()}${diffTag}`, '#a6e3e2', 2600);

    // Nave do jogador centralizada no corredor vertical, apontando para o Norte (-Y)
    const initialShipX = PLAYFIELD_X + PLAYFIELD_WIDTH / 2;
    const initialShipY = 350;
    this.vectorShip = new VectorShip(this, initialShipX, initialShipY, this.pilot.id);

    // Inicializa sistema e renderizador do Laser Rubro (multifeixes contínuos)
    this.crimsonLaserState = createInitialCrimsonLaserState(this.weapons.weaponLevel);
    this.crimsonLaserRenderer = new CrimsonLaserRenderer(this, this.pilot.id === 'nolan');

    // Atalhos de Sandbox / Validação de Desenvolvimento (Teclas 1, 2, 3, 4 selecionam Laser Rubro LV1–LV4)
    this.registerSandboxShortcuts();

    globalAudio.startStageMusic();
  }

  /**
   * Registra atalhos de teclado e métodos públicos para validação imediata
   * dos 4 níveis das 3 armas e das cápsulas/itens P sem precisar jogar a fase inteira:
   * - Teclas 1..4: seleciona Nível 1..4 da arma atual
   * - Tecla 5: alterna ciclicamente entre Dispersão Azul, Energia Espiralada e Laser Rubro
   * - Tecla 6: seleciona diretamente DISPERSÃO AZUL (mantém nível)
   * - Tecla 7: seleciona diretamente ENERGIA ESPIRALADA (mantém nível)
   * - Tecla 8: seleciona diretamente LASER RUBRO (mantém nível)
   * - Tecla 9: gera no corredor as 5 cápsulas canônicas (AZUL, VERDE, RUBRO, P, P★)
   */
  private registerSandboxShortcuts(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    kb.on('keydown-ONE', () => this.setTestWeapon(this.weapons.weaponFamily, 1));
    kb.on('keydown-TWO', () => this.setTestWeapon(this.weapons.weaponFamily, 2));
    kb.on('keydown-THREE', () => this.setTestWeapon(this.weapons.weaponFamily, 3));
    kb.on('keydown-FOUR', () => this.setTestWeapon(this.weapons.weaponFamily, 4));
    kb.on('keydown-FIVE', () => {
      const nextFamily: WeaponFamily =
        this.weapons.weaponFamily === 'ion'
          ? 'green'
          : this.weapons.weaponFamily === 'green'
            ? 'red'
            : 'ion';
      this.setTestWeapon(nextFamily, this.weapons.weaponLevel);
    });
    kb.on('keydown-SIX', () => this.setTestWeapon('ion', this.weapons.weaponLevel));
    kb.on('keydown-SEVEN', () => this.setTestWeapon('green', this.weapons.weaponLevel));
    kb.on('keydown-EIGHT', () => this.setTestWeapon('red', this.weapons.weaponLevel));
    kb.on('keydown-NINE', () => this.spawnShowcasePickups());
  }

  /** Gera no corredor as 5 cápsulas canônicas (AZUL, VERDE, RUBRO, P e P★) para inspeção e coleta */
  public spawnShowcasePickups(): void {
    const baseY = Math.max(96, this.vectorShip.y - 145);
    const items: Array<{ type: 'weapon_ion' | 'weapon_green' | 'weapon_red' | 'power' | 'full_power'; dx: number }> = [
      { type: 'weapon_ion', dx: -136 },
      { type: 'weapon_green', dx: -68 },
      { type: 'weapon_red', dx: 0 },
      { type: 'power', dx: 68 },
      { type: 'full_power', dx: 136 },
    ];
    const centerX = PLAYFIELD_X + PLAYFIELD_WIDTH / 2;
    for (const item of items) {
      this.pickups.spawn(item.type, centerX + item.dx, baseY);
    }
    this.syncPickupVisuals();
    this.hud.flash('CÁPSULAS E ITENS P GERADOS NO CORREDOR', '#fde047', 1200);
  }

  /** Permite selecionar diretamente qualquer família e nível (1..4) para validação isolada */
  public setTestWeapon(family: WeaponFamily, level: WeaponLevel, powerMeter = 0): void {
    this.weapons = {
      ...this.weapons,
      weaponFamily: family,
      weaponLevel: level,
      powerMeter,
      heat: 0,
      isOverheated: false,
      overheatCooldownMs: 0,
    };
    this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
    const label =
      family === 'red'
        ? `LASER RUBRO — NV ${level} (${LASER_RUBRO_SPECS[level].title})`
        : family === 'green'
          ? `ENERGIA ESPIRALADA — NÍVEL ${level}`
          : `DISPERSÃO AZUL — NÍVEL ${level}`;
    const color = family === 'red' ? '#ff1e42' : family === 'green' ? '#4ade80' : '#00f0ff';
    this.hud.flash(label, color, 1100);
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
    this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
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
        minX: PLAYFIELD_X + halfW + 4,
        maxX: PLAYFIELD_RIGHT - halfW - 4,
        minY: halfH + 6,
        maxY: GAME_HEIGHT - halfH - 8,
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

    // 2. Disparos Primários:
    // - Se LASER RUBRO ('red') estiver equipado, NUNCA dispara bolas/projéteis vermelhos avulsos!
    //   A emissão contínua de feixes energéticos é processada por `updateCrimsonLaser(dt, commands)`.
    // - Se RAIO ESMERALDA ('green') ou DISPERSÃO AZUL ('ion') estiver equipado, usa cadência de projéteis.
    const specs = WEAPON_FAMILY_SPECS[this.weapons.weaponFamily] || WEAPON_FAMILY_SPECS.green;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);

    if (this.weapons.weaponFamily !== 'red') {
        // Regras Canônicas Fire Shark #9 e #10: Segurar ESPAÇO permite autofire contínuo sem bloqueio por superaquecimento
        if (!this.weapons.isCharging) {
          if (commands.firePrimaryTap && this.shootCooldown <= 0) {
            this.firePrimary();
            this.shootCooldown = specs.burstIntervalMs;
          } else if (commands.firePrimary && this.shootCooldown <= 0) {
            this.firePrimary();
            this.shootCooldown = specs.autoIntervalMs;
          }
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

      // Atualiza projéteis (ENERGIA ESPIRALADA / DISPERSÃO AZUL)
      this.advancePlayerShots(dt);

      // Atualiza emissão contínua, varredura lateral, colisões e renderização HD das 3 armas
      this.updateCrimsonLaser(dt, commands.firePrimary || commands.firePrimaryTap);

      this.checkEnemyContacts();
      if (this.health.gameOver) return;

      this.advanceEnemyShots(dt);

      // Verificação de conclusão da fase
      if (tick.completed) {
        this.completed = true;
        this.crimsonLaserRenderer.clear();
        this.clearEnemyShots();
        this.clearPlayerShots();
        this.hud.hideBossBar();
        globalAudio.stopMusic();

        const bonusPoints = 5000 + this.health.lives * 1000 + this.health.hp * 500;
        this.scoreCombo = addRawScore(this.scoreCombo, bonusPoints);
        this.hud.setScore(this.scoreCombo.score);

        saveSystem.recordStageClear(this.stageNumber, this.pilot.id, this.scoreCombo.score);

        new StageCompleteOverlay(
          this,
          this.stageNumber,
          this.scoreCombo.score,
          () => this.scene.start('EndingScene', { pilotId: this.pilot.id, score: this.scoreCombo.score }),
          () => this.restart(),
          () => this.scene.start('StageSelectScene'),
        );
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
    if (this.pilot.id === 'nolan') {
      const size = kind === 'explosion' ? 62 : kind === 'hit' ? 25 : 14;
      const effect = this.add.sprite(x, y, 'hd-bomb', 0).setDisplaySize(size, size).setDepth(13);
      effect.once('animationcomplete', () => effect.destroy());
      effect.play('hd-bomb-play');
      return;
    }
    const sprite = this.add.sprite(x, y, 'fx-' + kind, 0).setScale(1.5).setDepth(15);
    if (kind === 'muzzle') {
      sprite.setAngle(-90);
    }
    sprite.once('animationcomplete', () => sprite.destroy());
    sprite.play('fx-' + kind + '-play');
  }

  private createPlayerProjectile(def: ProjectileSpawnDef, tint?: number): void {
    const painted = this.pilot.id === 'nolan' && !def.piercing && def.texture.startsWith('shot-');
    const texture = painted ? `hd-shot-${this.weapons.weaponFamily === 'green' ? 'green' : 'blue'}` : def.texture;
    const node = this.add.sprite(def.x, def.y, texture, 0)
      .setScale(def.scale)
      .setDepth(9);
    // Orienta o sprite ao longo do vetor de disparo (Norte -Y = -90 graus)
    node.setRotation(Math.atan2(def.velocityY, def.velocityX));
    if (tint && !painted) {
      node.setTint(tint);
    }
    if (painted) node.setDisplaySize(18 + this.weapons.weaponLevel * 2, 9 + this.weapons.weaponLevel);
    else node.play(def.animation);
    this.shots.push({
      node,
      baseX: def.x,
      ageMs: 0,
      velocityX: def.velocityX,
      velocityY: def.velocityY,
      damage: def.damage,
      hitRadius: def.hitRadius,
      piercing: def.piercing,
      waveAmplitude: def.waveAmplitude,
      waveFrequency: def.waveFrequency,
      wavePhase: def.wavePhase,
    });
  }

  /**
   * Processa a emissão contínua, oscilação lateral dos feixes (LV3 e LV4),
   * colisão por polilinhas e aplicação de dano por ticks determinísticos do LASER RUBRO.
   */
  private updateCrimsonLaser(dt: number, isHoldingFire: boolean): void {
    const isRubyEquipped = this.weapons.weaponFamily === 'red';
    const canEmit =
      isRubyEquipped &&
      isHoldingFire &&
      !this.weapons.isCharging &&
      !this.health.gameOver &&
      !this.completed;

    // Constrói lista de alvos circulares ativos no corredor
    const targets: LaserTargetCircle[] = [];
    for (const enemy of this.director.enemies) {
      const isSmall = enemy.kind === 'scout' || enemy.kind === 'dart';
      targets.push({
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        radius: isSmall ? 18 : 25,
        stopsBeam: !isSmall && this.weapons.weaponLevel < 3,
      });
    }

    if (
      this.director.boss &&
      this.director.boss.phase !== 'intro' &&
      this.director.boss.phase !== 'defeated'
    ) {
      targets.push({
        id: 'boss',
        x: this.director.boss.x,
        y: this.director.boss.y,
        radius: 82,
        stopsBeam: true, // Feixes colidem e geram fagulhas intensas no casco blindado do chefe/miniboss
      });
    }

    const originX = this.vectorShip.x;
    const originY = this.vectorShip.y - this.vectorShip.halfHeight + 4;

    const step = stepCrimsonLaser(this.crimsonLaserState, {
      deltaMs: dt,
      isHoldingFire: canEmit,
      isRubyEquipped,
      level: this.weapons.weaponLevel,
      shipX: originX,
      shipY: originY,
      targets,
    });

    this.crimsonLaserState = step.state;
    const shotTrails = this.shots.map((s) => ({
      x: s.node.x,
      y: s.node.y,
      baseX: s.baseX,
      ageMs: s.ageMs,
      velocityX: s.velocityX,
      velocityY: s.velocityY,
      waveAmplitude: s.waveAmplitude,
      waveFrequency: s.waveFrequency,
      wavePhase: s.wavePhase,
    }));
    this.crimsonLaserRenderer.render(
      this.crimsonLaserState,
      shotTrails,
      this.weapons.weaponFamily,
      this.weapons.weaponLevel,
      this.time.now,
    );

    if (this.crimsonLaserState.isEmitting) {
      this.vectorShip.triggerMuzzleFlash();
      this.laserAudioTimerMs -= dt;
      if (this.laserAudioTimerMs <= 0) {
        this.laserAudioTimerMs = 135;
        globalAudio.playShot(this.pilot.id, this.weapons.weaponLevel);
      }
    } else {
      this.laserAudioTimerMs = 0;
    }

    // Aplica eventos de dano gerados pelos ticks do Laser Rubro
    for (const dmgEvent of step.damageEvents) {
      if (typeof dmgEvent.targetId === 'number') {
        const stillAlive = this.director.enemies.some((e) => e.id === dmgEvent.targetId);
        if (stillAlive) {
          this.applyDamageToEnemy(dmgEvent.targetId, dmgEvent.damage);
        }
      } else if (dmgEvent.targetId === 'boss' && this.director.boss) {
        this.applyBossDamage(dmgEvent.damage, dmgEvent.hitX, dmgEvent.hitY);
      }
    }
  }

  private applyBossDamage(damage: number, hitX: number, hitY: number): void {
    const boss = this.director.boss;
    if (!boss || boss.phase === 'intro' || boss.phase === 'defeated') return;

    const bossHit = this.director.damageBoss(damage, hitX, hitY);
    if (bossHit.bossDamage > 0) {
      this.playEffect(bossHit.killed ? 'explosion' : 'hit', hitX, hitY);
      globalAudio.playHit();
      this.hud.showBossBar(boss.name, boss.hp, boss.maxHp);
      if (bossHit.moduleDestroyed) {
        this.playEffect('explosion', hitX, hitY);
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
  }

  private firePrimary(): void {
    const originX = this.vectorShip.x;
    const originY = this.vectorShip.y - this.vectorShip.halfHeight - 2;
    this.vectorShip.triggerMuzzleFlash();

    const familyTint = this.weapons.weaponFamily === 'green'
      ? 0x4ade80
      : this.weapons.weaponFamily === 'ion'
        ? 0x00f0ff
        : 0xff4d6d;
    const defs = getPrimaryProjectiles(this.weapons.weaponFamily, this.weapons.weaponLevel, originX, originY);
    for (const def of defs) {
      this.createPlayerProjectile(def, familyTint);
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
    if (this.pilot.id === 'nolan') {
      const ghost = this.add.image(this.vectorShip.x, this.vectorShip.y, 'hd-rivet', 0)
        .setDisplaySize(54, 54).setTint(0xffa457).setAlpha(.3).setDepth(6);
      this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
      return;
    }
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
    const painted = this.pilot.id === 'nolan';
    const bombSprite = this.add.sprite(PLAYFIELD_X + PLAYFIELD_WIDTH / 2, GAME_HEIGHT / 2, painted ? 'hd-bomb' : 'fx-bomb-wave', 0)
      .setDisplaySize(painted ? 410 : 403, painted ? 410 : 403).setDepth(painted ? 12 : 30);
    bombSprite.once('animationcomplete', () => bombSprite.destroy());
    bombSprite.play(painted ? 'hd-bomb-play' : 'fx-bomb-wave-play');

    // Flash e shake
    if (!painted) this.cameras.main.flash(280, 255, 255, 255);
    this.cameras.main.shake(painted ? 180 : 380, painted ? 0.004 : 0.016);
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
    const texture = 'hd-' + enemy.kind;
    const size = { scout: 47, dart: 62, lancer: 61, cutter: 66 }[enemy.kind];
    const body = this.add.sprite(0, 0, texture, 0)
      .setDisplaySize(size, size);
    // Painted sheets already face south; do not rotate their top-down anatomy.
    body.play(texture + '-fly');
    const warning = this.add.sprite(0, 22, 'hd-shot-enemy', 'orb')
      .setDisplaySize(10, 10).setVisible(false);
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
      const desired = 'hd-' + enemy.kind + (preparing ? '-warning' : '-fly');
      if (desired !== visual.animationKey) {
        visual.body.play(desired, true);
        visual.animationKey = desired;
      }
      if (preparing && !visual.warning.visible) {
        visual.warning.setVisible(true);
      } else if (!preparing && visual.warning.visible) {
        visual.warning.setVisible(false).stop();
      }
      if (preparing) visual.warning.setAlpha(.5 + .4 * Math.sin(enemy.phaseMs / 75));
      if (enemy.hp < enemy.maxHp) visual.body.setTint(0xffb1a7);
      else visual.body.clearTint();
    }
  }

  private syncPickupVisuals(): void {
    const active = new Set(this.pickups.pickups.map(p => p.id));
    for (const [id, node] of this.pickupVisuals) {
      if (active.has(id)) continue;
      node.destroy();
      this.pickupVisuals.delete(id);
    }
    for (const p of this.pickups.pickups) {
      let node = this.pickupVisuals.get(p.id);
      if (!node) {
        if (this.pilot.id === 'nolan') {
          node = this.createPaintedPickup(p.type).setPosition(p.x, p.y);
          this.pickupVisuals.set(p.id, node);
          continue;
        }
        const isWeaponCapsule =
          p.type === 'weapon_ion' || p.type === 'weapon_green' || p.type === 'weapon_red';

        let key = 'pickup-upgrade';
        let label = 'P';
        let centerSymbol = '';
        let badgeHex = '#fde047';
        let ringColor = 0xfacc15;
        let coreColor = 0xfef08a;
        let spriteTint: number | undefined;

        if (p.type === 'power') {
          key = 'pickup-upgrade';
          label = 'P';
          badgeHex = '#fde047';
          ringColor = 0xfacc15;
          spriteTint = 0xfde047;
        } else if (p.type === 'full_power') {
          key = 'pickup-resonance';
          label = 'P★';
          badgeHex = '#fde047';
          ringColor = 0xff1e42;
          spriteTint = 0xff1e42;
        } else if (p.type === 'weapon_ion') {
          label = 'AZUL';
          centerSymbol = 'W';
          badgeHex = '#7dd3fc';
          ringColor = 0x00f0ff;
          coreColor = 0xe0f2fe;
        } else if (p.type === 'weapon_green') {
          label = 'VERDE';
          centerSymbol = 'W';
          badgeHex = '#86efac';
          ringColor = 0x22c55e;
          coreColor = 0xdcfce7;
        } else if (p.type === 'weapon_red') {
          label = 'RUBRO';
          centerSymbol = 'W';
          badgeHex = '#fda4af';
          ringColor = 0xff1e42;
          coreColor = 0xffe4e6;
        } else if (p.type === 'health') {
          key = 'pickup-repair';
          label = 'HP';
          badgeHex = '#86efac';
          ringColor = 0x4ade80;
        } else if (p.type === 'bomb') {
          key = 'pickup-bomb';
          label = 'B';
          badgeHex = '#fdba74';
          ringColor = 0xf97316;
        } else if (p.type === 'special') {
          key = 'pickup-resonance';
          label = 'ESP';
          badgeHex = '#d8b4fe';
          ringColor = 0xa855f7;
        } else if (p.type === 'score') {
          key = 'pickup-score';
          label = 'PTS';
          badgeHex = '#fde047';
          ringColor = 0xeab308;
        }

        const halo = this.add.graphics();
        halo.fillStyle(0x020617, 0.84);
        halo.fillCircle(0, -2, 13);
        halo.lineStyle(2, ringColor, 0.95);
        halo.strokeCircle(0, -2, 13);
        halo.fillStyle(0x020617, 0.92);
        halo.fillRoundedRect(-20, 9, 40, 13, 3);
        halo.lineStyle(1, ringColor, 0.88);
        halo.strokeRoundedRect(-20, 9, 40, 13, 3);

        const children: Phaser.GameObjects.GameObject[] = [halo];

        if (isWeaponCapsule) {
          // Cápsula de Troca de Arma Fire Shark (Orbe colorido com símbolo W — NUNCA usa a letra P!)
          halo.fillStyle(ringColor, 0.35);
          halo.fillCircle(0, -2, 10);
          halo.lineStyle(1.5, coreColor, 0.9);
          halo.strokeCircle(0, -2, 8);

          const wGlyph = this.add.text(0, -2, centerSymbol, {
            fontFamily: FONT_TECH,
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#ffffff',
          }).setOrigin(0.5).setResolution(3);
          children.push(wGlyph);
        } else {
          const sprite = this.add.sprite(0, -2, key, 0).setScale(1.25);
          if (spriteTint !== undefined) {
            sprite.setTint(spriteTint);
          }
          sprite.play(key + '-loop');
          children.push(sprite);
        }

        const badge = this.add.text(0, 15.5, label, {
          fontFamily: FONT_TECH,
          fontSize: '10px',
          fontStyle: 'bold',
          color: badgeHex,
        }).setOrigin(0.5).setResolution(3);
        children.push(badge);

        node = this.add.container(p.x, p.y, children).setDepth(14);
        this.pickupVisuals.set(p.id, node);
      } else {
        node.setPosition(p.x, p.y);
        if (this.pilot.id === 'nolan') node.setScale(1 + Math.sin(p.ageMs / 230) * .035);
      }
    }
  }

  private createPaintedPickup(type: PickupType): Phaser.GameObjects.Container {
    const looks: Record<PickupType, [string, string, number]> = {
      power: ['P', 'POTÊNCIA', 0xffcc55], full_power: ['P★', 'MÁXIMO', 0xff7660],
      weapon_ion: ['W', 'AZUL', 0x77d9ff], weapon_green: ['W', 'VERDE', 0x8aea9b],
      weapon_red: ['W', 'RUBRO', 0xff7d6b], health: ['H', 'REPARO', 0x8aea9b],
      bomb: ['B', 'BOMBA', 0xffb45d], missile: ['M', 'MÍSSIL', 0xf2deca],
      score: ['S', 'PONTOS', 0xffd778], special: ['E', 'ESPECIAL', 0xe6a2e8],
    };
    const [glyph, label, color] = looks[type];
    const hex = '#' + color.toString(16).padStart(6, '0');
    const shell = this.add.image(0, 0, 'hd-capsule').setDisplaySize(39, 39);
    const light = this.add.graphics();
    light.fillStyle(color, .2); light.fillCircle(0, 0, 9);
    light.lineStyle(1, color, .7); light.strokeCircle(0, 0, type.startsWith('weapon_') ? 10 : 8);
    const symbol = this.add.text(0, 0, glyph, { fontFamily: FONT_TECH, fontSize: type === 'full_power' ? '13px' : '17px', fontStyle: 'bold', color: hex, stroke: '#10080e', strokeThickness: 2 }).setOrigin(.5).setResolution(3);
    const badgeBg = this.add.rectangle(0, 23, 47, 11, 0x160b10, .94).setStrokeStyle(.5, color, .6);
    const badge = this.add.text(0, 23, label, { fontFamily: FONT_TECH, fontSize: '9px', fontStyle: 'bold', color: hex }).setOrigin(.5).setResolution(3);
    return this.add.container(0, 0, [shell, light, symbol, badgeBg, badge]).setDepth(14);
  }

  private checkPickupCollisions(): void {
    const collected = this.pickups.checkCollection(this.ship.x, this.ship.y, 24);
    for (const item of collected) {
      globalAudio.playPickup(item.type);

      if (item.type === 'power') {
        const res = collectPowerItem(this.weapons);
        this.weapons = res.state;
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
        if (res.levelIncreased) {
          this.hud.flash(`UPGRADE DE ARMA! NÍVEL ${this.weapons.weaponLevel} [3/3 P]`, '#facc15', 1400);
        } else if (this.weapons.weaponLevel >= 4) {
          this.scoreCombo = addRawScore(this.scoreCombo, 400);
          this.hud.flash('ARMA EM POTÊNCIA MÁXIMA (+400 PTS)', '#fbbf24', 1000);
        } else {
          this.hud.flash(`ITEM P COLETADO [${this.weapons.powerMeter}/3]`, '#fde047', 950);
        }
      } else if (item.type === 'full_power') {
        const res = collectFullPowerItem(this.weapons);
        this.weapons = res.state;
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
        this.hud.flash('SUPER P★ COLETADO! POTÊNCIA MÁXIMA NV 4!', '#fde047', 1500);
      } else if (item.type === 'weapon_green') {
        if (this.weapons.weaponFamily === 'green') {
          const res = collectPowerItem(this.weapons);
          this.weapons = res.state;
          this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
          this.hud.flash(`CÁPSULA VERDE (+1 P) [${this.weapons.powerMeter}/3]`, '#4ade80', 1100);
        } else {
          this.weapons = switchWeaponFamily(this.weapons, 'green');
          this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
          this.hud.flash('ARMA: ENERGIA ESPIRALADA ATIVADA!', '#4ade80', 1200);
        }
      } else if (item.type === 'weapon_ion') {
        if (this.weapons.weaponFamily === 'ion') {
          const res = collectPowerItem(this.weapons);
          this.weapons = res.state;
          this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
          this.hud.flash(`CÁPSULA AZUL (+1 P) [${this.weapons.powerMeter}/3]`, '#00f0ff', 1100);
        } else {
          this.weapons = switchWeaponFamily(this.weapons, 'ion');
          this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
          this.hud.flash('ARMA: DISPERSÃO AZUL ATIVADA!', '#00f0ff', 1200);
        }
      } else if (item.type === 'weapon_red') {
        if (this.weapons.weaponFamily === 'red') {
          const res = collectPowerItem(this.weapons);
          this.weapons = res.state;
          this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
          this.hud.flash(`CÁPSULA RUBRA (+1 P) [${this.weapons.powerMeter}/3]`, '#ff1e42', 1100);
        } else {
          this.weapons = switchWeaponFamily(this.weapons, 'red');
          this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
          this.hud.flash('ARMA: LASER RUBRO ATIVADO!', '#ff1e42', 1200);
        }
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
    }).setOrigin(0.5).setDepth(25).setResolution(3);
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
        // Miniboss da Fase 1: Raia-Dente (orientado para o Sul +Y)
        main = this.add.sprite(0, 0, 'boss-interceptor-chassis', 0).setScale(1.6).setAngle(-90).play('boss-interceptor-chassis-flight');
        sub1 = this.add.sprite(-42, -8, 'boss-interceptor-wing', 0).setScale(1.5).setAngle(-90).play('boss-interceptor-wing-spark');
        sub2 = this.add.sprite(42, -8, 'boss-interceptor-wing', 0).setScale(1.5).setAngle(-90).setFlipY(true).play('boss-interceptor-wing-spark');
        parts.push(sub1, sub2, main);
      } else if (boss.name === 'TALASSARCA') {
        // Chefe Colossal da Fase 1: Talassarca (orientado para o Sul +Y)
        main = this.add.sprite(0, 0, 'boss-fortress-chassis', 0).setScale(1.8).setAngle(-90).play('boss-fortress-chassis-loop');
        sub1 = this.add.sprite(-85, 10, 'boss-interceptor-wing', 0).setScale(1.6).setAngle(-90).play('boss-interceptor-wing-spark');
        sub2 = this.add.sprite(85, 10, 'boss-interceptor-wing', 0).setScale(1.6).setAngle(-90).setFlipY(true).play('boss-interceptor-wing-spark');
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
    // Depth 18 garante que projéteis inimigos fiquem sempre visíveis e legíveis sobre os feixes do Laser Rubro (depth 8)
    const bullet = this.add.sprite(event.x, event.y, 'hd-shot-enemy', 'orb')
      .setDisplaySize(12, 12).setDepth(18);
    this.enemyShots.push({
      node: bullet,
      baseX: event.x,
      ageMs: 0,
      velocityX: event.velocityX,
      velocityY: event.velocityY,
      damage: 1,
      hitRadius: 8,
    });
    this.playEffect('muzzle', event.x, event.y + 8);
    globalAudio.playEnemyShot();
  }

  private applyDamageToEnemy(enemyId: number, amount: number): void {
    // Captura posição e tipo ANTES de `this.director.damage` remover o inimigo abatido da lista!
    const targetBefore = this.director.enemies.find(e => e.id === enemyId);
    const x = targetBefore ? targetBefore.x : this.ship.x;
    const y = targetBefore ? targetBefore.y : this.ship.y - 120;
    const dropKind = targetBefore
      ? targetBefore.kind
      : (amount >= 300 ? 'lancer' : 'scout');

    const hit = this.director.damage(enemyId, amount);

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

      // Drop de itens físicos nas coordenadas reais do inimigo abatido:
      // Enquanto o jogador estiver no Nível 1 (Tiro 1), portadores priorizam itens P
      // para evoluir o tiro inicial antes de soltar cápsulas de troca de cor.
      let dropType = determineEnemyDrop(dropKind, this.totalKills);
      if (
        this.weapons.weaponLevel === 1 &&
        (dropType === 'weapon_green' || dropType === 'weapon_red' || dropType === 'weapon_ion')
      ) {
        dropType = 'power';
      }
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
      shot.ageMs += dt;
      shot.baseX += (shot.velocityX * dt) / 1000;
      shot.node.y += (shot.velocityY * dt) / 1000;

      if (shot.waveAmplitude && shot.waveAmplitude > 0) {
        const freq = shot.waveFrequency ?? 0.017;
        const phase = shot.wavePhase ?? 0;
        const angleArg = shot.ageMs * freq + phase;
        shot.node.x = shot.baseX + Math.sin(angleArg) * shot.waveAmplitude;
        // Orienta tangente à onda sinusoidal esmeralda
        const instVx = shot.velocityX + Math.cos(angleArg) * shot.waveAmplitude * freq * 1000;
        shot.node.setRotation(Math.atan2(shot.velocityY, instVx));
      } else {
        shot.node.x = shot.baseX;
      }

      let collided = false;

      // Colisão calibrada com inimigos alienígenas no corredor (escala de dano 0.36 evita one-shot no Nível 1)
      for (const enemy of this.director.enemies) {
        const isSmall = enemy.kind === 'scout' || enemy.kind === 'dart';
        const hx = isSmall ? 13 : 19;
        const hy = isSmall ? 13 : 19;
        if (
          Math.abs(shot.node.x - enemy.x) <= hx + shot.hitRadius &&
          Math.abs(shot.node.y - enemy.y) <= hy + shot.hitRadius
        ) {
          const combatDamage = shot.piercing ? shot.damage * 0.5 : shot.damage * 0.36;
          this.applyDamageToEnemy(enemy.id, combatDamage);
          collided = !shot.piercing;
          break;
        }
      }

      // Colisão com Miniboss ou Chefe se ativo
      if (!collided && this.director.boss && this.director.boss.phase !== 'intro' && this.director.boss.phase !== 'defeated') {
        const boss = this.director.boss;
        if (
          Math.abs(shot.node.x - boss.x) <= 105 &&
          Math.abs(shot.node.y - boss.y) <= 75
        ) {
          this.applyBossDamage(shot.damage * 0.34, shot.node.x, shot.node.y);
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

    // Se a nave estiver em invulnerabilidade pós-acerto ou durante o Dash, ignora colisão
    const isProtected = this.health.invulnerableMs > 0 || isDashInvulnerable(this.dashState);
    if (isProtected) return;

    for (const enemy of this.director.enemies) {
      const isSmall = enemy.kind === 'scout' || enemy.kind === 'dart';
      const enemyRadius = isSmall ? 10 : 16;
      const dist = Math.hypot(this.vectorShip.x - enemy.x, this.vectorShip.y - enemy.y);
      if (dist <= enemyRadius + this.vectorShip.hitRadius) {
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
        // Se estiver em janela de invulnerabilidade do dash ou pós-acerto, ignora o dano
        if (this.health.invulnerableMs > 0 || isDashInvulnerable(this.dashState)) {
          this.playEffect('hit', this.vectorShip.x, this.vectorShip.y);
          continue;
        }
        const result = this.damageShip();
        if (result === 'respawn' || result === 'game-over') return;
      }
    }
  }

  private damageShip(): HitEvent {
    // Se o jogador estiver em invulnerabilidade ativa, descarta qualquer dano
    if (this.health.invulnerableMs > 0 || isDashInvulnerable(this.dashState)) {
      return 'ignored';
    }

    // Se o escudo de energia estiver ativo, absorve o golpe completamente e concede buffer de 1.2s
    if (this.weapons.hasShield) {
      this.weapons = setShield(this.weapons, false);
      this.health = { ...this.health, invulnerableMs: 1200 };
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
      this.hud.flash('BLINDAGEM COMPROMETIDA! -1 HP', '#f87171', 1100);
      globalAudio.playHit();
      this.hitPoseMs = 320;
      this.playEffect('hit', this.vectorShip.x, this.vectorShip.y);
      this.cameras.main.shake(150, 0.007);
    } else if (outcome.event === 'respawn') {
      globalAudio.playExplosion(true);
      this.cameras.main.shake(320, 0.015);
      this.weapons = resetWeaponsOnRespawn(this.weapons);
      this.crimsonLaserState = createInitialCrimsonLaserState(1);
      this.crimsonLaserRenderer.clear();
      this.hud.setWeapon(this.weapons.weaponFamily, 1, 0);
      this.hud.setResonance(this.weapons.resonance);
      this.hud.flash('REINICIANDO CAÇA...', '#38bdf8', 1400);

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
      this.crimsonLaserRenderer.clear();
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
