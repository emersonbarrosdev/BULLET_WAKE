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
import { StageDirector, enemyBodyRadius, type EnemyModel, type EnemyShotEvent } from '../systems/stageDirector';
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
  collectWeaponCapsule,
  collectSpeedItem,
  collectFullPowerItem,
  collectSpecialCharge,
  activateSpecial,
  setShield,
  advanceWeapons,
  getPrimaryProjectiles,
  getSecondaryProjectiles,
  getChargedProjectiles,
  updateWeaponCharge,
  releaseWeaponCharge,
  resetWeaponsOnRespawn,
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
import { CombatParticles } from '../render/CombatParticles';
import { PICKUP_GUIDE } from '../data/pickupGuide';
import { stepTriggerCadence, type TriggerCadence } from '../systems/fireCadence';
import { circleHitsHull } from '../systems/hullCollision';
import { InputManager } from '../systems/inputSystem.ts';
import { PickupSystem, type PickupType } from '../systems/pickupSystem.ts';
import {
  initialScoreCombo,
  registerKill,
  advanceCombo,
  addRawScore,
  getComboMultiplier,
  type ScoreComboState,
} from '../systems/scoreComboSystem.ts';
import { globalAudio } from '../audio/audioSystem.ts';
import { SPECIAL_BOSS_DAMAGE, METAMORPHOSIS_MS } from '../systems/bosses/bossTalassarca';

interface Projectile {
  node: Phaser.GameObjects.Sprite;
  baseX: number;
  baseY: number;
  trail: Array<{x:number;y:number}>;
  ageMs: number;
  velocityX: number;
  velocityY: number;
  damage: number;
  hitRadius: number;
  piercing?: boolean;
  waveAmplitude?: number;
  waveFrequency?: number;
  wavePhase?: number;
  waveVerticalAmplitude?: number;
  sourceLayer?: 'surface';
  hitTargets?: Set<number|string>;
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

  private hud!: PremiumCombatHud;
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

  private specialVisual?: Phaser.GameObjects.Sprite;
  private specialTickMs = 0;
  private checkpointDistance = 0;
  private resumeWeapons?: PlayerWeaponsState;
  private resumeDashes?: DashState;
  private triggerCadence: TriggerCadence = {holdMs:0,tapMs:0};
  private totalKills = 0;
  private completed = false;
  private particles!: CombatParticles;

  constructor() {
    super({ key: 'PrototypeScene' });
  }

  init(data: { pilotId?: string; stageNumber?: number; checkpointDistance?:number; resumeWeapons?:PlayerWeaponsState; resumeDashes?:DashState } = {}): void {
    this.pilot = getPilot(data.pilotId);
    this.stageNumber = 1;
    this.checkpointDistance = data.checkpointDistance ?? 0;
    this.resumeWeapons=data.resumeWeapons;this.resumeDashes=data.resumeDashes;
  }

  preload(): void {
    loadGameSprites(this);
  }

  create(): void {
    registerGameAnimations(this);
    enableCombatResolution(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);

    this.hitPoseMs = 0;
    this.missilePoseMs = 0;
    this.prismPoseMs = 0;
    this.phantomDashTimerMs = 0;

    // Regra Canônica Fire Shark #1: O jogador inicia equipado com Wide Shot azul (DISPERSÃO AZUL, Nível 1, 0/3 P)
    this.weapons = this.resumeWeapons??createPlayerWeapons(this.pilot.id, 'ion');
    this.scoreCombo = initialScoreCombo();
    this.health = initialPlayerHealth();
    this.dashState = this.resumeDashes??createInitialDashState();
    this.totalKills = 0;
    this.completed = false;

    this.shots = [];
    this.enemyShots = [];
    this.enemyVisuals.clear();
    this.pickupVisuals.clear();
    this.pickups.clear();
    this.bossVisual = undefined;

    const difficulty = 'normal' as const;
    this.director = new StageDirector(GAME_WIDTH, true, this.stageNumber, difficulty);
    if(this.checkpointDistance>0)this.director.seekCheckpoint(this.checkpointDistance);
    this.specialVisual=undefined;this.specialTickMs=0;
    this.triggerCadence = {holdMs:0,tapMs:0};
    this.laserAudioTimerMs = 0;

    this.backdrop = new StageBackdrop(this, this.stageNumber, { fullWidth: false, showBezels: true });
    this.inputManager = new InputManager(this);

    this.hud = new PremiumCombatHud(this, () => this.restart());
    this.hud.setPilot(this.pilot.id, this.pilot.shipName);
    this.hud.setScore(0);
    this.hud.setHealth(this.health, false);
    this.hud.setDash(this.dashState.remainingDashes);
    this.hud.setProgress(0);
    this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
    this.hud.setSpecialStock(this.weapons.specialCharges, this.weapons.specialActiveMs > 0);

    const stageDef = STAGES[this.stageNumber - 1] || STAGES[0];
    const diffTag = ' [NORMAL]';
    this.hud.flash(`FASE 0${this.stageNumber}  -  ${stageDef.title.toUpperCase()}${diffTag}`, '#a6e3e2', 2600);

    // Nave do jogador centralizada no corredor vertical, apontando para o Norte (-Y)
    const initialShipX = PLAYFIELD_X + PLAYFIELD_WIDTH / 2;
    const initialShipY = 350;
    this.vectorShip = new VectorShip(this, initialShipX, initialShipY, this.pilot.id);

    // Inicializa sistema e renderizador do Laser Rubro (multifeixes contínuos)
    this.crimsonLaserState = createInitialCrimsonLaserState(this.weapons.weaponLevel);
    this.crimsonLaserRenderer = new CrimsonLaserRenderer(this, true);
    this.particles = new CombatParticles(this);

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
    if (!kb || (!import.meta.env.DEV && !new URLSearchParams(location.search).has('sandbox'))) return;

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
    this.particles.update(dt);

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
    this.hud.setSpecialStock(this.weapons.specialCharges, this.weapons.specialActiveMs > 0);
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

    let speed = this.pilot.speed * PLAYER_SPEED_FACTOR * (1 + this.weapons.speedLevel * 0.08);
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
    const mayFire=!this.weapons.isCharging&&this.weapons.weaponFamily!=='red';
    const cadence=stepTriggerCadence(this.triggerCadence,dt,mayFire&&commands.firePrimary,mayFire&&commands.firePrimaryTap,saveSystem.getSaveData().settings.rapidFire,specs.autoIntervalMs,specs.burstIntervalMs);
    this.triggerCadence=cadence;
    for(let i=0;i<cadence.volleys;i++)this.firePrimary();

      // 3. Disparo Secundário / Mísseis (tecla M)
      if (commands.missile && this.weapons.missileCooldownMs <= 0) {
        this.fireSecondary();
      }

      // V and X share one limited special stock.
      if (commands.special || commands.bomb) {
        this.triggerSpecial();
      }

      // Tempestade Prismática ativa da Rivet (rajada contínua enquanto especial ativo)
      this.updatePrismSpecial(dt);

      // Atualiza diretor da fase
      const tick = this.director.update(dt, this.ship.x, this.ship.y);
      this.backdrop.update(tick.scrollPx,dt);
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
        const boss = this.director.boss;
        const form = boss.layer ? (boss.phase==='metamorphosis'?' · METAMORFOSE':boss.layer==='shell'?' · CASCA 1/2':' · FORMA INTERNA 2/2') : '';
        this.hud.showBossBar(boss.name+form, boss.hp, boss.maxHp);
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
        this.specialVisual?.destroy();this.specialVisual=undefined;
        this.crimsonLaserRenderer.clear();
        this.clearEnemyShots();
        this.clearPlayerShots();
        this.hud.hideBossBar();
        globalAudio.stopMusic();

        const bonusPoints = 5000 + 1000 + Math.floor(this.health.hp/10) * 500;
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

  private continueFromCheckpoint():void {
    const distance=this.director.scrollPx;
    const checkpoint=distance>=3200?3200:distance>=2100?2100:distance>=1000?1000:0;
    this.scene.restart({pilotId:this.pilot.id,stageNumber:1,checkpointDistance:checkpoint,resumeWeapons:resetWeaponsOnRespawn(this.weapons),resumeDashes:{...createInitialDashState(),remainingDashes:this.dashState.remainingDashes}});
  }

  private choosePilot(): void {
    globalAudio.stopMusic();
    this.scene.start('PilotSelectScene', { selectedPilotId: this.pilot.id, stageNumber: this.stageNumber });
  }

  private playEffect(kind:'muzzle'|'hit'|'explosion',x:number,y:number):void {
    if (kind === 'muzzle') {
      const family = this.weapons.weaponFamily === 'ion' ? 'blue' : this.weapons.weaponFamily === 'red' ? 'fire' : 'green';
      const sprite = this.add.sprite(x, y, 'polish-' + family, 0).setDisplaySize(14, 14).setDepth(19).play('polish-'+family+'-loop');
      this.time.delayedCall(85, () => sprite.destroy());
      return;
    }
    const key='polish-explosion',size=kind==='explosion'?72:22;
    const sprite=this.add.sprite(x,y,key,0).setDisplaySize(size,size).setDepth(19).play(key+'-loop');
    sprite.once('animationcomplete',()=>sprite.destroy());
    if (kind==='explosion') this.particles.burst(x,y);
  }

  private createPlayerProjectile(def: ProjectileSpawnDef, tint?: number): void {
    const family=this.weapons.weaponFamily;
    const effect=def.texture==='rivet-v3-missile'?'missile':def.piercing?'charge':family==='green'?'green':'blue';
    const key=(effect==='blue'||effect==='green'?'polish-':'review-effects-')+effect;
    const node=this.add.sprite(def.x,def.y,key,0).setDepth(9).play(key+'-loop');
    node.setRotation(Math.atan2(def.velocityY,def.velocityX)+Math.PI/2);
    const size=effect==='missile'?30:effect==='charge'?50:effect==='green'?32:17;
    node.setDisplaySize(size,size);
    if(tint&&this.pilot.id!=='nolan')node.setTint(tint);
    this.shots.push({
      node,
      baseX: def.x,
      baseY: def.y,
      trail: [],
      ageMs: 0,
      velocityX: def.velocityX,
      velocityY: def.velocityY,
      damage: def.damage,
      hitRadius: def.piercing?6:2.5,
      hitTargets:new Set(),
      piercing: def.piercing,
      waveAmplitude: def.waveAmplitude,
      waveFrequency: def.waveFrequency,
      wavePhase: def.wavePhase,
      waveVerticalAmplitude: def.waveVerticalAmplitude,
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
      if (enemy.submerged) continue;
      const isSmall = enemy.kind === 'scout' || enemy.kind === 'dart';
      targets.push({
        id: enemy.id,
        x: enemy.x,
        y: enemy.y,
        radius: enemyBodyRadius(enemy),
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
        radius: this.director.boss.bodyRadiusY ?? 65,
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
      trail: s.trail,
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
    if (!boss || ['intro', 'metamorphosis', 'defeated'].includes(boss.phase)) return;

    const bossHit = this.director.damageBoss(damage, hitX, hitY);
    if (bossHit.bossDamage > 0) {
      this.playEffect(bossHit.killed ? 'explosion' : 'hit', hitX, hitY);
      globalAudio.playHit();
      this.hud.showBossBar(boss.name, boss.hp, boss.maxHp);
      if (bossHit.moduleDestroyed) {
        this.clearEnemyShots();
        for(let i=0;i<6;i++) this.particles.burst(boss.x-120+i*48,boss.y,1.5);
        this.playEffect('explosion', hitX, hitY);
        globalAudio.playExplosion(true);
        this.hud.flash(boss.phase==='metamorphosis' ? 'CASCA ROMPIDA · METAMORFOSE' : `PARTE DESTRUÍDA: ${bossHit.moduleDestroyed.toUpperCase()}`, '#ffd488', 1800);
      }
      if (bossHit.killed) {
        this.playEffect('explosion', boss.x, boss.y);
        globalAudio.playExplosion(true);
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
    if(this.director.boss?.phase==='metamorphosis') return;
    const result = activateSpecial(this.weapons);
    if (!result.activated) {
      if (!this.weapons.specialCharges) this.hud.flash('SEM CARGAS DE ESPECIAL', '#ffbd72', 700);
      return;
    }
    this.weapons = result.state;
    this.hud.setSpecialStock(this.weapons.specialCharges, true);
    this.clearEnemyShots();
    // Fixed budget per activation, independent of FPS and visual duration.
    const boss = this.director.boss;
    if (boss) this.applyBossDamage(SPECIAL_BOSS_DAMAGE, boss.x, boss.y);
    for (const e of [...this.director.enemies]) if (!e.submerged) this.applyDamageToEnemy(e.id, 8);
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
    this.specialVisual?.destroy();
    this.specialVisual=this.add.sprite(this.ship.x,this.ship.y-125,'polish-special',0).setDisplaySize(350,300).setAlpha(.85).setDepth(11);
    this.specialTickMs=0;
  }

  private updatePrismSpecial(dt:number):void {
    if(this.weapons.specialType!=='prism'||this.weapons.specialActiveMs<=0) {
      this.specialVisual?.destroy();this.specialVisual=undefined;return;
    }
    const elapsed=this.weapons.specialDurationMs-this.weapons.specialActiveMs;
    const fade=Math.min(1,elapsed/180,this.weapons.specialActiveMs/300);
    this.specialVisual?.setPosition(this.ship.x,this.ship.y-125).setFrame(Math.floor(elapsed/75)%8).setAlpha(fade*(.78+.1*Math.sin(elapsed/90)));
    this.clearEnemyShots();
    this.specialTickMs+=dt;
    while(this.specialTickMs>=100) {
      this.specialTickMs-=100;
      for(const e of [...this.director.enemies])if(e.y<this.ship.y-15&&e.y>this.ship.y-260&&Math.abs(e.x-this.ship.x)<105)this.applyDamageToEnemy(e.id,.5);
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
  }

  private makeEnemyVisual(enemy: EnemyModel): void {
    const texture = 'polish-'+(enemy.carrier?'carrier':enemy.layer?(enemy.surfaceVariant==='ambush'?'ambush':'surface'):enemy.kind);
    const size = enemy.carrier?72:enemy.layer?68:({ scout: 38, dart: 48, lancer: 46, cutter: 50 }[enemy.kind]) * (enemy.flight ? 0.74 : 1);
    const body = this.add.sprite(0, 0, texture, 0)
      .setDisplaySize(size, size);
    // Painted sheets already face south; do not rotate their top-down anatomy.
    if (!enemy.layer) body.play(texture + '-loop');
    const warning = this.add.sprite(0, 22, 'hd-shot-enemy', 'orb')
      .setDisplaySize(10, 10).setVisible(false);
    const container = this.add.container(enemy.x, enemy.y, [body, warning]).setDepth(enemy.layer === 'surface' ? -3 : 5);
    this.enemyVisuals.set(enemy.id, { container, body, warning, animationKey: texture + '-loop' });
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
      if (enemy.flight) {
        const t = enemy.ageMs / 3400;
        const vx = (enemy.flight === 'sweep-left' ? 1 : -1) * (PLAYFIELD_WIDTH + 48);
        const vy = Math.PI * 245 * Math.cos(Math.PI * t) + Math.PI * 40 * Math.cos(Math.PI * 2 * t);
        visual.body.setRotation(Math.atan2(vy, vx) - Math.PI / 2);
      }
      const preparing = enemy.phase === 'telegraph';
      if (enemy.layer) visual.body.setFrame(enemy.animationFrame??0);
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
        node = this.createPaintedPickup(p.type);
        this.pickupVisuals.set(p.id, node);
      }
      node.setPosition(p.x, p.y);
      node.setScale(1 + Math.sin(p.ageMs / 230) * .035);
    }
  }

  private createPaintedPickup(type: PickupType): Phaser.GameObjects.Container {
    const key='review-pickups-'+(type==='full_power'?'power':type);
    const icon=this.add.sprite(0,0,key,0).setDisplaySize(31,31).play(key+'-loop');
    if(type==='full_power')icon.setTint(0xff83b8);
    return this.add.container(0,0,[icon]).setDepth(14);
  }

  private checkPickupCollisions(): void {
    const collected = this.pickups.checkCollection(this.ship.x, this.ship.y, this.vectorShip.hitRadius, true);
    for (const item of collected) {
      globalAudio.playPickup(item.type);
      const color=Phaser.Display.Color.HexStringToColor(PICKUP_GUIDE[item.type].color).color;
      this.particles.burst(item.x,item.y,.7,false,color);
      const feedback=this.add.image(item.x,item.y,'review-pickups-'+(item.type==='full_power'?'power':item.type),0).setDisplaySize(31,31).setDepth(22);
      this.tweens.add({targets:feedback,alpha:0,scaleX:feedback.scaleX*1.65,scaleY:feedback.scaleY*1.65,y:item.y-10,duration:180,onComplete:()=>feedback.destroy()});

      if (item.type === 'power') {
        const res = collectPowerItem(this.weapons);
        this.weapons = res.state;
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
        if (res.levelIncreased) {
          this.hud.flash(`UPGRADE DE ARMA! NÍVEL ${this.weapons.weaponLevel} [3/3 P]`, '#facc15', 1400);
        } else if (!res.meterIncreased) {
          this.scoreCombo = addRawScore(this.scoreCombo, 5000);
          this.hud.flash('POTÊNCIA E RESERVA COMPLETAS (+5000 PTS)', '#fbbf24', 1000);
        } else if (this.weapons.weaponLevel >= 4) {
          this.hud.flash('RESERVA P: ' + this.weapons.powerMeter + '/3', '#fbbf24', 1000);
        } else {
          this.hud.flash(`ITEM P COLETADO [${this.weapons.powerMeter}/3]`, '#fde047', 950);
        }
      } else if (item.type === 'full_power') {
        const res = collectFullPowerItem(this.weapons);
        this.weapons = res.state;
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
        this.hud.flash('SUPER P★ COLETADO! POTÊNCIA MÁXIMA NV 4!', '#fde047', 1500);
      } else if (item.type === 'weapon_green' || item.type === 'weapon_ion' || item.type === 'weapon_red') {
        const family = item.type.slice(7) as WeaponFamily;
        const result = collectWeaponCapsule(this.weapons, family);
        this.weapons = result.state;
        this.scoreCombo = addRawScore(this.scoreCombo, result.bonusPoints);
        this.hud.setWeapon(family, this.weapons.weaponLevel, this.weapons.powerMeter);
        this.hud.flash(result.bonusPoints ? 'MESMA COR: +5000 PONTOS' : PICKUP_GUIDE[item.type].label + ' EQUIPADA', PICKUP_GUIDE[item.type].color, 1100);
      } else if (item.type === 'speed') {
        const alreadyMax = this.weapons.speedLevel >= 3;
        this.weapons = collectSpeedItem(this.weapons);
        if (alreadyMax) this.scoreCombo = addRawScore(this.scoreCombo, 5000);
        this.hud.flash(alreadyMax ? 'VELOCIDADE MÁXIMA: +5000 PONTOS' : 'VELOCIDADE S: ' + this.weapons.speedLevel + '/3', '#a5b7ff', 1100);
      } else if (item.type === 'health') {
        if (this.health.hp < 100) {
          this.health = { ...this.health, hp: Math.min(100,this.health.hp + 30) };
          this.hud.setHealth(this.health, this.weapons.hasShield);
          this.hud.flash('REPARO! +30% DE INTEGRIDADE', '#88ffaa', 1000);
        } else {
          this.scoreCombo = addRawScore(this.scoreCombo, 300);
          this.hud.flash('INTEGRIDADE MÁXIMA (+300 PTS)', '#aaffee', 900);
        }
      } else if (item.type === 'bomb' || item.type === 'special') {
        const wasFull = this.weapons.specialCharges >= 3;
        this.weapons = collectSpecialCharge(this.weapons);
        if (wasFull) this.scoreCombo = addRawScore(this.scoreCombo, 500);
        this.hud.setSpecialStock(this.weapons.specialCharges, this.weapons.specialActiveMs > 0);
        this.hud.flash(wasFull ? 'ESPECIAIS NO MÁXIMO: +500' : '+1 CARGA DE ESPECIAL', '#d299ff', 1000);
      } else if (item.type === 'missile') {
        this.weapons.missileCooldownMs = 0;
        this.hud.flash('MÍSSEIS RECARREGADOS!', '#ffd19f', 1000);
      } else if (item.type === 'score') {
        this.scoreCombo = addRawScore(this.scoreCombo, 500);
        this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
        this.hud.flash('+500 PONTOS', '#ffea88', 850);
        this.spawnScorePopup(500, this.vectorShip.x, this.vectorShip.y, '#ffd700');
      }
      this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
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

  private syncBossVisual(boss:NonNullable<StageDirector['boss']>):void {
    if(this.bossVisual?.name!==boss.name){this.bossVisual?.container.destroy();this.bossVisual=undefined;}
    const transforming = boss.phase === 'metamorphosis';
    const key = boss.name==='RAIA-DENTE' ? 'polish-raia' : transforming ? 'polish-metamorphosis' : boss.layer==='inner' ? 'polish-inner' : 'polish-talassarca';
    const size = transforming
      ? PLAYFIELD_WIDTH*(.8+.2*(boss.metamorphosisMs??0)/METAMORPHOSIS_MS)
      : boss.displayWidth ?? 175;
    if(!this.bossVisual){
      const main=this.add.sprite(0,0,key,0);
      this.bossVisual={name:boss.name,main,container:this.add.container(boss.x,boss.y,[main]).setDepth(6)};
    }
    this.bossVisual.container.setPosition(boss.x,boss.y);
    const frame=transforming ? Math.min(7,Math.floor((boss.metamorphosisMs??0)/METAMORPHOSIS_MS*8)) : Math.floor(this.time.now/110)%8;
    this.bossVisual.main.setTexture(key,frame).setDisplaySize(size,size);
    if(transforming) this.clearEnemyShots();
  }

  private spawnEnemyShot(event: EnemyShotEvent): void {
    if(this.enemyShots.length>=84)return;
    const kind=event.kind??(event.sourceLayer?'surface':'scout');
    const art=kind==='talassarca'?'raia':kind==='raia'?'cutter':kind;
    const sizes={scout:18,dart:19,lancer:20,cutter:21,surface:18,raia:23,talassarca:24};
    const key='review-hostile-'+art;
    const bullet=this.add.sprite(event.x,event.y,key,0).setDisplaySize(sizes[kind],sizes[kind]).setDepth(18).play(key+'-loop');
    bullet.setRotation(Math.atan2(event.velocityY,event.velocityX)-Math.PI/2);
    this.enemyShots.push({node:bullet,baseX:event.x,baseY:event.y,trail:[],ageMs:0,velocityX:event.velocityX,velocityY:event.velocityY,damage:kind==='talassarca'?25:kind==='cutter'?22:18,hitRadius:kind==='lancer'||kind==='talassarca'?4:3,sourceLayer:event.sourceLayer});
    globalAudio.playEnemyShot();
  }

  private applyDamageToEnemy(enemyId: number, amount: number): void {
    // Captura posição e tipo ANTES de `this.director.damage` remover o inimigo abatido da lista!
    const targetBefore = this.director.enemies.find(e => e.id === enemyId);
    const x = targetBefore ? targetBefore.x : this.ship.x;
    const y = targetBefore ? targetBefore.y : this.ship.y - 120;
    const hit = this.director.damage(enemyId, amount);

    if (hit.killed) {
      this.totalKills++;
      this.playEffect('explosion', x, y);
      globalAudio.playExplosion(false);

      const killResult = registerKill(this.scoreCombo, hit.score);
      this.scoreCombo = killResult.state;
      this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
      this.spawnScorePopup(hit.score, x, y);


      // Scripted supplies are independent of equipped weapon and kill count.
      const dropType = targetBefore?.carrier ? targetBefore.drop : null;
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
      shot.baseY += (shot.velocityY * dt) / 1000;
      shot.node.y = shot.baseY;

      if (shot.waveAmplitude && shot.waveAmplitude > 0) {
        const freq = shot.waveFrequency ?? 0.017;
        const phase = shot.wavePhase ?? 0;
        const angleArg = shot.ageMs * freq + phase;
        const envelope=Math.min(1,shot.ageMs/90);
        shot.node.x = shot.baseX + Math.sin(angleArg) * shot.waveAmplitude * envelope;
        shot.node.y = shot.baseY + Math.cos(angleArg)*(shot.waveVerticalAmplitude??0)*envelope;
        // Orienta tangente à onda sinusoidal esmeralda
        const instVx = shot.velocityX + Math.cos(angleArg) * shot.waveAmplitude * freq * 1000;
        const instVy = shot.velocityY - Math.sin(angleArg) * (shot.waveVerticalAmplitude??0) * freq * 1000;
        shot.node.setRotation(Math.atan2(instVy, instVx)+Math.PI/2);
        // Fixed time samples retain the same ribbon length at 30, 60 and 120 FPS.
        shot.trail=[];
        for(let past=Math.min(120,shot.ageMs);past>=0;past-=12){
          const t=shot.ageMs-past,env=Math.min(1,t/90),a=t*freq+phase;
          shot.trail.push({x:shot.baseX-shot.velocityX*past/1000+Math.sin(a)*shot.waveAmplitude*env,y:shot.baseY-shot.velocityY*past/1000+Math.cos(a)*(shot.waveVerticalAmplitude??0)*env});
        }
        shot.trail.push({x:shot.node.x,y:shot.node.y});
      } else {
        shot.node.x = shot.baseX;
      }

      let collided = false;

      // Colisão calibrada com inimigos alienígenas no corredor (escala de dano 0.36 evita one-shot no Nível 1)
      for (const enemy of this.director.enemies) {
        if (enemy.submerged) continue;
        if(shot.hitTargets?.has(enemy.id))continue;
        const hx = enemyBodyRadius(enemy);
        const hy = hx;
        if (
          Math.abs(shot.node.x - enemy.x) <= hx + shot.hitRadius &&
          Math.abs(shot.node.y - enemy.y) <= hy + shot.hitRadius
        ) {
          const combatDamage = shot.piercing ? shot.damage * 0.5 : shot.damage * 0.36;
          shot.hitTargets?.add(enemy.id);
          this.applyDamageToEnemy(enemy.id, combatDamage);
          collided = !shot.piercing;
          break;
        }
      }

      // Colisão com Miniboss ou Chefe se ativo
      if (!collided && !shot.hitTargets?.has('boss') && this.director.boss && this.director.boss.phase !== 'intro' && this.director.boss.phase !== 'defeated') {
        const boss = this.director.boss;
        if (
          Math.hypot((shot.node.x-boss.x)/(boss.bodyRadiusX??95),(shot.node.y-boss.y)/(boss.bodyRadiusY??65)) <= 1
        ) {
          shot.hitTargets?.add('boss');
          this.applyBossDamage(shot.damage, shot.node.x, shot.node.y);
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
    for(const enemy of [...this.director.enemies]) {
      if(enemy.layer==='surface')continue;
      if(!circleHitsHull(enemy.x,enemy.y,enemyBodyRadius(enemy),this.ship.x,this.ship.y))continue;
      this.director.remove(enemy.id);
      this.playEffect('explosion',enemy.x,enemy.y);globalAudio.playExplosion(false);
      this.damageShip(isDashActive(this.dashState)?0:30);
      this.syncEnemyVisuals();
      if(this.health.gameOver)return;
    }
    const boss=this.director.boss;
    if(boss&&!['intro','metamorphosis','defeated'].includes(boss.phase)){
      const rx=boss.bodyRadiusX??75,ry=boss.bodyRadiusY??55;
      const points=[[this.ship.x,this.ship.y-20],[this.ship.x-17,this.ship.y+9],[this.ship.x+17,this.ship.y+9]];
      if(points.some(([x,y])=>Math.hypot((x-boss.x)/rx,(y-boss.y)/ry)<=1))this.damageShip(35);
    }
  }

  private advanceEnemyShots(dt: number): void {
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const shot = this.enemyShots[i];
      shot.ageMs += dt;
      shot.node.x += (shot.velocityX * dt) / 1000;
      shot.node.y += (shot.velocityY * dt) / 1000;

      // The visible hull includes the nose and wings, excluding empty sprite corners.
      const hit = circleHitsHull(shot.node.x,shot.node.y,shot.hitRadius,this.ship.x,this.ship.y);

      const outside =
        shot.node.x < PLAYFIELD_X - 20 ||
        shot.node.x > PLAYFIELD_RIGHT + 20 ||
        shot.node.y < -20 ||
        shot.node.y > GAME_HEIGHT + 20;

      const impactX=shot.node.x,impactY=shot.node.y;
      if (hit || outside) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }
      if (hit) {
        // Se estiver em janela de invulnerabilidade do dash ou pós-acerto, ignora o dano
        if (this.health.invulnerableMs > 0 || isDashInvulnerable(this.dashState)) {
          this.playEffect('hit', impactX, impactY);
          continue;
        }
        this.playEffect('hit',impactX,impactY);
        const result = this.damageShip(shot.damage);
        if (result === 'respawn' || result === 'game-over') return;
      }
    }
  }

  private damageShip(damage=20): HitEvent {
    if(damage<=0)return 'ignored';
    if(this.weapons.specialActiveMs>0 || this.director.boss?.phase==='metamorphosis')return 'ignored';
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
      return 'ignored';
    }

    const outcome = applyPlayerHit(this.health,damage);
    this.health = outcome.state;
    if (outcome.event === 'ignored') return outcome.event;

    this.hud.setHealth(this.health, false);

    if (outcome.event === 'damaged') {
      this.hud.flash('CASCO ATINGIDO!', '#f87171', 1100);
      globalAudio.playHit();
      this.hitPoseMs = 320;
      this.playEffect('hit', this.vectorShip.x, this.vectorShip.y);
    } else if (outcome.event === 'game-over') {
      this.specialVisual?.destroy();this.specialVisual=undefined;
      globalAudio.playExplosion(true);
      globalAudio.stopMusic();
      this.crimsonLaserRenderer.clear();
      this.clearEnemyShots();
      this.clearPlayerShots();
      this.hud.hideBossBar();

      this.playEffect('explosion', this.vectorShip.x, this.vectorShip.y);
      this.vectorShip.setVisible(false);
      new GameOverOverlay(
        this,
        this.scoreCombo.score,
        () => this.continueFromCheckpoint(),
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
