import { destructionPlan } from '../systems/destructionSystem';
import { DamageRegions } from '../systems/damageRegions';
import { PilotRadio, type RadioSnapshot } from '../systems/pilotRadioSystem';
import { recoveryPayloads, recoverArmament } from '../systems/recoverySystem';
import { spriteContact, spritesOverlap } from '../render/SpriteSilhouette';
import { continueWeapons, primaryBossFactor, NORMAL_BOSS_SHOT_SCALE, RIVET_MISSILE_INTERVAL_MS } from '../systems/normalBalance';
import { PrismStrike } from '../render/PrismStrike';
import { CombatBriefing } from '../ui/CombatBriefing';
import { CombatLoading } from '../ui/CombatLoading';
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
import { advanceHealth, applyPlayerHit, collectLife, initialPlayerHealth, type HitEvent, type PlayerHealth } from '../systems/combat';
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
  createPlayerWeapons,
  collectPowerItem,
  collectWeaponCapsule,
  evolutionCargo,
  collectSpeedItem,
  collectFullPowerItem,
  collectSpecialCharge,
  activateSpecial,
  advanceWeapons,
  getPrimaryProjectiles,
  getSecondaryProjectiles,
  WEAPON_FAMILY_SPECS,
  resetWeaponsOnRespawn,
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
import { sweptHullContact } from '../systems/hullCollision';
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
  morphNext?:Phaser.GameObjects.Sprite;
  mounts?: Phaser.GameObjects.Sprite[];
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
 * Três vidas, armas em cascata LV1-4,
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
  private radio = new PilotRadio('nolan');
  private radioBossLayer='';
  private health: PlayerHealth = initialPlayerHealth();

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

  private specialVisual?: PrismStrike;
  private specialBossHit = false;
  private checkpointDistance = 0;
  private resumeWeapons?: PlayerWeaponsState;
  private resumeRadio?:RadioSnapshot;
  private damageRegions=new Map<string|number,DamageRegions>();
  private triggerCadence: TriggerCadence = {holdMs:0,tapMs:0};
  private bentoBarrel=1;
  private totalKills = 0;
  private completed = false;
  private briefing?: CombatBriefing;
  private skipBriefing = false;
  private entryLoading?: CombatLoading;
  private entryLoadFailed = false;
  private particles!: CombatParticles;

  constructor() {
    super({ key: 'PrototypeScene' });
  }

  init(data: { pilotId?: string; stageNumber?: number; skipBriefing?: boolean; checkpointDistance?:number; resumeWeapons?:PlayerWeaponsState; radioSnapshot?:RadioSnapshot } = {}): void {
    this.pilot = getPilot(data.pilotId);
    this.skipBriefing = !!data.skipBriefing || !!data.resumeWeapons;
    this.stageNumber = 1;globalAudio.setEnvironment('atmosphere');
    this.checkpointDistance = data.checkpointDistance ?? 0;
    this.resumeWeapons=data.resumeWeapons;this.resumeRadio=data.radioSnapshot;
    this.entryLoadFailed=false;
    if(!this.skipBriefing){
      this.entryLoading=new CombatLoading('CARREGANDO OPERAÇÃO', 'Preparando a Fenda Pelágica.');
      this.load.on('progress',this.onLoadProgress);
      this.load.on('loaderror',this.onLoadError);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN,this.clearEntryLoading);
      this.events.once(Phaser.Scenes.Events.DESTROY,this.clearEntryLoading);
    }
  }

  private onLoadProgress = (value:number) => this.entryLoading?.setProgress(value * .95);
  private onLoadError = () => {
    this.entryLoadFailed=true;
    this.entryLoading?.fail(()=>this.scene.start('PilotSelectScene'));
  };
  private clearEntryLoading = () => {
    this.entryLoading?.destroy();this.entryLoading=undefined;
    this.load.off('progress',this.onLoadProgress);this.load.off('loaderror',this.onLoadError);
    this.events.off(Phaser.Scenes.Events.SHUTDOWN,this.clearEntryLoading);
    this.events.off(Phaser.Scenes.Events.DESTROY,this.clearEntryLoading);
  };

  preload(): void {
    loadGameSprites(this);
  }

  create(): void {
    if(this.entryLoadFailed){globalAudio.stopMusic();this.scene.pause();return;}
    registerGameAnimations(this);
    enableCombatResolution(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);

    this.hitPoseMs = 0;
    this.missilePoseMs = 0;
    this.prismPoseMs = 0;
    this.phantomDashTimerMs = 0;

    // Each pilot starts with the owned primary at level 1 and zero P.
    this.weapons = this.resumeWeapons??createPlayerWeapons(this.pilot.id);
    this.scoreCombo = initialScoreCombo();
    this.health = initialPlayerHealth();
    this.radio=new PilotRadio(this.pilot.id);if(this.resumeRadio)this.radio.restore(this.resumeRadio);this.radioBossLayer='';this.damageRegions.clear();
    if(this.resumeWeapons)this.health.invulnerableMs=2000;
    this.totalKills = 0;this.bentoBarrel=1;
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
    this.specialVisual=undefined;
    this.triggerCadence = {holdMs:0,tapMs:0};
    this.laserAudioTimerMs = 0;

    this.backdrop = new StageBackdrop(this, this.stageNumber, { fullWidth: false, showBezels: true });
    this.inputManager = new InputManager(this);

    this.hud = new PremiumCombatHud(this, () => this.openBriefing(false));
    this.hud.setPilot(this.pilot.id, this.pilot.shipName);
    this.hud.setScore(0);
    this.hud.setHealth(this.health, false);
    this.hud.setProgress(0);
    this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
    this.hud.setSpecialStock(this.weapons.specialCharges, this.weapons.specialActiveMs > 0);

    const stageDef = STAGES[this.stageNumber - 1] || STAGES[0];
    const diffTag = ' [NORMAL]';
    this.hud.flash(`FASE 0${this.stageNumber}  -  ${stageDef.title.toUpperCase()}${diffTag}`, '#dedede', 2600);

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

    this.briefing=undefined;
    if (this.entryLoading) {
      globalAudio.stopMusic();this.scene.pause();
      this.entryLoading.setProgress(1);
      this.entryLoading.ready(2500,()=>{this.clearEntryLoading();this.scene.resume();globalAudio.startStageMusic();},true);
    }
    else globalAudio.startStageMusic();
  }

  private openBriefing(preflight: boolean): void {
    if (this.briefing || this.health.gameOver || this.completed) return;
    globalAudio.pauseMusic();
    this.briefing = new CombatBriefing(this, preflight,
      () => { this.briefing=undefined;this.inputManager.resetPad();globalAudio.resumeMusic(); },
      () => { this.briefing=undefined;this.restart(); },
      () => { this.briefing=undefined;globalAudio.stopMusic();this.scene.start('TitleScene'); });
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
      this.openBriefing(false);
      return;
    }
    if (this.health.gameOver || this.completed) return;

    // Atualiza timers do combate e dash
    this.health = advanceHealth(this.health, dt);
    this.weapons = advanceWeapons(this.weapons, dt);
    this.scoreCombo = advanceCombo(this.scoreCombo, dt);

    this.hitPoseMs = Math.max(0, this.hitPoseMs - dt);
    this.missilePoseMs = Math.max(0, this.missilePoseMs - dt);
    this.prismPoseMs = Math.max(0, this.prismPoseMs - dt);
    this.phantomDashTimerMs = Math.max(0, this.phantomDashTimerMs - dt);

    // Atualiza o HUD
    this.hud.update(dt);
    this.radio.update(dt,{enemies:this.director.enemies.length,bullets:this.enemyShots.length,lives:this.health.lives,specials:this.weapons.specialCharges});
    this.hud.setRadio(this.radio.remaining>0?this.radio.message:'Canal aberto.',this.radio.remaining>0);
    this.hud.setHealth(this.health, false);
    this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
    this.hud.setSpecialStock(this.weapons.specialCharges, this.weapons.specialActiveMs > 0);
    this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
    this.hud.setHeat(this.weapons.heat, this.weapons.isOverheated);

    // Efeito de invulnerabilidade (piscar transparente)
    const isInvuln = this.health.invulnerableMs > 0;
    this.vectorShip.setAlpha(
      isInvuln && Math.floor(Date.now() / 80) % 2 === 0 ? 0.35 : 1,
    );

    // Movimentação da nave estritamente no corredor vertical
    let dx = commands.moveX;
    let dy = commands.moveY;

    let speed = this.pilot.speed * PLAYER_SPEED_FACTOR * (1 + this.weapons.speedLevel * 0.08);
    // Cora's limited special retains its invulnerable phase shift; there is no dash action.
    if (this.phantomDashTimerMs > 0) {
      dy = -1.6; speed = 650; this.spawnPhantomAfterimage();
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
    this.vectorShip.updateShip(dt, dx, dy, this.hitPoseMs, false, false);

    // 2. Disparos Primários:
    // - Se LASER RUBRO ('red') estiver equipado, NUNCA dispara bolas/projéteis vermelhos avulsos!
    //   A emissão contínua de feixes energéticos é processada por `updateCrimsonLaser(dt, commands)`.
    // - Se RAIO ESMERALDA ('green') ou DISPERSÃO AZUL ('ion') estiver equipado, usa cadência de projéteis.
    const specs = WEAPON_FAMILY_SPECS[this.weapons.weaponFamily] || WEAPON_FAMILY_SPECS.green;
    const mayFire=!this.weapons.isCharging&&this.weapons.weaponFamily!=='red';
    const cadence=stepTriggerCadence(this.triggerCadence,dt,mayFire&&commands.firePrimary,mayFire&&commands.firePrimaryTap,true,specs.autoIntervalMs*8/this.pilot.shotsPerSecond,specs.burstIntervalMs*8/this.pilot.shotsPerSecond);
    this.triggerCadence=cadence;
    for(let i=0;i<cadence.volleys;i++)this.firePrimary();

      // Paired automatic missiles at NV3+, independent of primary family.
      if (this.pilot.id==='nolan' && this.weapons.weaponLevel>=3 && commands.firePrimary && this.weapons.missileCooldownMs <= 0) {
        this.fireSecondary();
      }

      // X and gamepad West activate the single special stock.
      if (commands.special) {
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
          this.hud.hideBossBar();globalAudio.startStageMusic();
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

        const bonusPoints = 6000 + this.health.lives * 1000;
        this.scoreCombo = addRawScore(this.scoreCombo, bonusPoints);
        this.hud.setScore(this.scoreCombo.score);

        saveSystem.recordStageClear(this.stageNumber, this.pilot.id, this.scoreCombo.score);

        this.time.delayedCall(1250,()=>new StageCompleteOverlay(
          this,
          this.stageNumber,
          this.scoreCombo.score,
          () => this.scene.start('EndingScene',{pilotId:this.pilot.id,score:this.scoreCombo.score,stageNumber:1}),
          () => this.restart(),
          () => this.choosePilot(),
          this.pilot.name+' — '+this.radio.message,
        ));
      }
    }

  private restart(): void {
    globalAudio.stopMusic();
    this.scene.restart({ pilotId: this.pilot.id, stageNumber: this.stageNumber, skipBriefing: true });
  }

  private continueFromCheckpoint():void {
    const distance=this.director.scrollPx;
    const checkpoint=distance>=3200?3200:distance>=2100?2100:distance>=1000?1000:0;
    this.scene.restart({pilotId:this.pilot.id,stageNumber:1,checkpointDistance:checkpoint,resumeWeapons:continueWeapons(this.weapons,checkpoint),radioSnapshot:this.radio.snapshot()});
  }

  private choosePilot(): void {
    globalAudio.stopMusic();
    this.scene.start('PilotSelectScene', { selectedPilotId: this.pilot.id, stageNumber: this.stageNumber });
  }

  private playEffect(kind:'muzzle'|'hit'|'explosion',x:number,y:number,scale=1):void {
    if (kind === 'muzzle') {
      const family = this.weapons.weaponFamily === 'ion' ? 'blue' : this.weapons.weaponFamily === 'red' ? 'fire' : 'green';
      const sprite = this.add.sprite(x, y, 'polish-' + family, 0).setDisplaySize(14, 14).setDepth(19).play('polish-'+family+'-loop');
      this.time.delayedCall(85, () => sprite.destroy());
      return;
    }
    if(kind==='hit'){
      const spark=this.add.image(x,y,'polish-explosion',0).setDisplaySize(13,13).setDepth(19);
      this.tweens.add({targets:spark,alpha:0,duration:65,onComplete:()=>spark.destroy()});
      return;
    }
    const key='polish-explosion',size=64*scale;
    const sprite=this.add.sprite(x,y,key,0).setDisplaySize(size,size).setDepth(19).play(key+'-loop');
    sprite.once('animationcomplete',()=>sprite.destroy());
    this.particles.burst(x,y,Math.min(1,scale));
  }

  private createPlayerProjectile(def: ProjectileSpawnDef, tint?: number): void {
    const family=this.weapons.weaponFamily;
    const effect=def.texture==='rivet-v3-missile'?'missile':def.piercing?'charge':family==='green'?'green':'blue';
    const key=(effect==='blue'||effect==='green'?'polish-':'review-effects-')+effect;
    const animation=effect==='blue'?'polish-blue-single':key+'-loop';
    const node=this.add.sprite(def.x,def.y,key,0).setDepth(9).play(animation);
    node.setRotation(Math.atan2(def.velocityY,def.velocityX)+Math.PI/2);
    const size=effect==='missile'?30:effect==='charge'?50:effect==='green'?32:this.weapons.weaponLevel>=3?23:17;
    node.setDisplaySize(effect==='blue'?size*(this.weapons.weaponLevel>=3?.72:.5):size,size);
    if(effect==='blue')node.setOrigin(.84,.5);
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
      hitRadius: Math.min(def.hitRadius,def.piercing?6:effect==='missile'?3:2.5),
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
        contact:(ax,ay,bx,by,r)=>{const v=this.enemyVisuals.get(enemy.id);return v?spriteContact(v.body,ax,ay,bx,by,r):null;},
        stopsBeam: !isSmall && this.weapons.weaponLevel < 3,
      });
    }

    if (
      this.director.boss &&
      this.director.boss.phase !== 'intro' &&
      this.director.boss.phase !== 'defeated' && this.director.boss.phase !== 'metamorphosis'
    ) {
      targets.push({
        id: 'boss',
        x: this.director.boss.x,
        y: this.director.boss.y,
        radius: this.director.boss.bodyRadiusY ?? 65,
        contact:(ax,ay,bx,by,r)=>this.bossContact(ax,ay,bx,by,r),
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
          this.applyDamageToEnemy(dmgEvent.targetId, dmgEvent.damage*this.pilot.damage, dmgEvent.hitX, dmgEvent.hitY);
        }
      } else if (dmgEvent.targetId === 'boss' && this.director.boss) {
        this.applyBossDamage(dmgEvent.damage*this.pilot.damage*primaryBossFactor(this.pilot.id,this.director.boss.name), dmgEvent.hitX, dmgEvent.hitY);
      }
    }
  }

  private applyBossDamage(damage: number, hitX: number, hitY: number, area = false): void {
    const boss = this.director.boss;
    if (!boss || ['intro', 'metamorphosis', 'defeated'].includes(boss.phase)) return;

    const moduleIndex=this.bossVisual?.mounts?.findIndex(m=>spriteContact(m,hitX,hitY,hitX,hitY,3)!==null)??-1;
    const moduleId=moduleIndex>=0?boss.modules?.[moduleIndex]?.id??null:null;
    const bossHit = area&&boss.damageArea ? boss.damageArea(damage) : this.director.damageBoss(damage, hitX, hitY,moduleId);
    if (bossHit.bossDamage > 0) {
      this.trackDamage(boss.name+boss.layer,hitX-boss.x,hitY-boss.y,bossHit.bossDamage);
      this.playEffect(bossHit.killed ? 'explosion' : 'hit', hitX, hitY);
      globalAudio.playHit();
      this.hud.showBossBar(boss.name, boss.hp, boss.maxHp);
      if (bossHit.moduleDestroyed) {
        if(boss.phase==='metamorphosis')this.clearEnemyShots();
        this.explodeLayers(hitX,hitY,boss.phase==='metamorphosis'?100:24,hitX,hitY,boss.phase==='metamorphosis');
        globalAudio.playExplosion(true);
        this.hud.flash(boss.phase==='metamorphosis' ? 'CASCA ROMPIDA · METAMORFOSE' : `PARTE DESTRUÍDA: ${bossHit.moduleDestroyed.toUpperCase()}`, '#ffd488', 1800);
      }
      if (bossHit.killed) {
        this.bossVisual?.mounts?.forEach(m=>m.setVisible(false));this.bossVisual?.morphNext?.setVisible(false);
        this.radio.offer(boss.name==='RAIA-DENTE'?'miniboss':'victory',true);
        const hot=this.damageRegions.get(boss.name+boss.layer)?.strongest();
        this.explodeLayers(boss.x,boss.y,boss.name==='TALASSARCA'?150:65,boss.x+(hot?.x??0),boss.y+(hot?.y??0),true);
        this.fadeCorpse(this.bossVisual?.main,true);
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
    const barrel=this.bentoBarrel;this.bentoBarrel*=-1;
    for (const def of defs) {
      if(this.pilot.id==='bento')def.x+=barrel*5;
      const focus=this.pilot.id==='bento'?.58:this.pilot.id==='lyra'?.28:this.pilot.id==='harlan'?.6:this.pilot.id==='cora'?.8:1;
      this.createPlayerProjectile({...def,velocityX:def.velocityX*focus,damage:def.damage*this.pilot.damage}, familyTint);
    }

    // Painted projectiles originate at the current, unrotated nose.
    globalAudio.playShot(this.pilot.id, this.weapons.weaponLevel);
  }

  private fireSecondary(): void {
    this.weapons.missileCooldownMs = this.pilot.id==='nolan'?RIVET_MISSILE_INTERVAL_MS:1700;
    this.missilePoseMs = 280;

    const defs = getSecondaryProjectiles(this.pilot.id, this.vectorShip.x, this.vectorShip.y);
    for (const def of defs) {
      this.createPlayerProjectile(def);
    }

    globalAudio.playMissile();

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
    const boss = this.director.boss;
    globalAudio.playSpecial(this.weapons.specialType);

    if (this.weapons.specialType === 'prism') {
      this.prismPoseMs = 600;
      this.hud.flash('TEMPESTADE PRISMÁTICA ATIVADA!', '#d6b2ff', 1600);
      this.emitPrismBurst();
    } else if (this.weapons.specialType === 'phantom') {
      this.phantomDashTimerMs = 650;
      this.hud.flash('SALTO FANTASMA!', '#7df9ff', 1200);
      for(const delay of [150,350,550])this.time.delayedCall(delay,()=>{const target=this.director.boss;this.specialImpact(target?.x??this.ship.x,target?.y??this.ship.y,SPECIAL_BOSS_DAMAGE/3,150);});
    } else if (this.weapons.specialType === 'orbital') {
      this.hud.flash('COROA ORBITAL!', '#90f5c0', 1400);
      for(let i=0;i<6;i++){
        const x=PLAYFIELD_X+PLAYFIELD_WIDTH*(i+1)/7;
        const target=boss??this.director.enemies.filter(e=>!e.submerged)[i%Math.max(1,this.director.enemies.length)];
        const tx=target?.x??x,ty=target?.y??130;
        const lance=this.add.sprite(x,-30,'hd-special-orbital',0).setDisplaySize(58,110).setDepth(12);
        this.tweens.add({targets:lance,x:tx,y:ty,delay:i*120,duration:700,onUpdate:()=>lance.setFrame(Math.floor(this.time.now/120)%2),onComplete:()=>{this.specialImpact(tx,ty,SPECIAL_BOSS_DAMAGE/6,90);this.finishSpecialSprite(lance,'hd-special-orbital');}});
      }
     } else if (this.weapons.specialType === 'comet') {
      this.hud.flash('CHUVA DE COMETAS!', '#99ceff', 1400);
      for(let i=0;i<8;i++)this.time.delayedCall(i*170,()=>{
        const fromLeft=i%2===0,x=fromLeft?PLAYFIELD_X-30:PLAYFIELD_RIGHT+30;
        const targetY=boss?.y??70+(i%4)*75;
        const comet=this.add.sprite(x,targetY-45,'hd-special-comet',0).setDisplaySize(76,90).setRotation(fromLeft?Math.PI/3:-Math.PI/3).setDepth(18);
        this.tweens.add({targets:comet,x:boss?.x??PLAYFIELD_X+PLAYFIELD_WIDTH/2,y:targetY,duration:400,onComplete:()=>{
          this.specialImpact(comet.x,comet.y,SPECIAL_BOSS_DAMAGE/8,110);comet.setRotation(0);this.finishSpecialSprite(comet,'hd-special-comet');
        }});
      });
    } else if (this.weapons.specialType === 'nova') {
      this.hud.flash('RUPTURA NOVA!', '#ffb66a', 1500);
      this.emitRupturaNova();
      this.time.delayedCall(180,()=>{const target=this.director.boss;this.specialImpact(target?.x??this.ship.x,target?.y??this.ship.y,SPECIAL_BOSS_DAMAGE,500);});
    }
  }

  private emitPrismBurst(): void {
    this.specialVisual?.destroy();
    this.specialVisual=new PrismStrike(this);
    this.specialBossHit=false;
  }

  private updatePrismSpecial(_dt:number):void {
    if(this.weapons.specialType!=='prism'||this.weapons.specialActiveMs<=0) {
      this.specialVisual?.destroy();this.specialVisual=undefined;return;
    }
    const elapsed=this.weapons.specialDurationMs-this.weapons.specialActiveMs;
    const impacts=this.specialVisual?.update(elapsed)??[];
    this.clearEnemyShots();
    for(const impact of impacts){
      globalAudio.playExplosion(false);
      this.particles.burst(impact.x,impact.y,1.1,false,0xffae56);
      for(const e of [...this.director.enemies])if(!e.submerged&&Math.hypot(e.x-impact.x,e.y-impact.y)<95)this.applyDamageToEnemy(e.id,8);
    }
    if(elapsed>=580&&!this.specialBossHit){
      this.specialBossHit=true;
      const boss=this.director.boss;
      if(boss)this.applyBossDamage(SPECIAL_BOSS_DAMAGE,boss.x,boss.y,true);
    }
  }

  private specialImpact(x:number,y:number,budget:number,radius:number):void {
    if(this.completed||this.health.gameOver)return;
    const boss=this.director.boss;
    if(boss&&Math.hypot(boss.x-x,boss.y-y)<=radius+(boss.bodyRadiusY??65))this.applyBossDamage(budget,x,y,true);
    for(const e of [...this.director.enemies])if(!e.submerged&&Math.hypot(e.x-x,e.y-y)<radius)this.applyDamageToEnemy(e.id,8*budget/SPECIAL_BOSS_DAMAGE,e.x,e.y);
    this.clearEnemyShots();this.particles.burst(x,y,.8);globalAudio.playExplosion(budget>=100);
  }
  private finishSpecialSprite(sprite:Phaser.GameObjects.Sprite,key:string):void {
    sprite.setTexture(key,2).setDisplaySize(95,95);
    this.time.delayedCall(120,()=>sprite.setFrame(3));
    this.tweens.add({targets:sprite,alpha:0,duration:320,onComplete:()=>sprite.destroy()});
  }
  private spawnPhantomAfterimage(): void {
    const hull=this.ship.hullSprite;if(!hull)return;
    const ghost=this.add.image(this.ship.x,this.ship.y,hull.texture.key,hull.frame.name).setDisplaySize(40,40).setTint(0x93eeff).setAlpha(.45).setDepth(6);
    this.tweens.add({targets:ghost,alpha:0,duration:280,onComplete:()=>ghost.destroy()});
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

  }

  private makeEnemyVisual(enemy: EnemyModel): void {
    const texture = enemy.carrier?'hd-supply-parachute':'polish-'+(enemy.layer?(enemy.surfaceVariant==='ambush'?'ambush':'surface'):enemy.kind);
    const size = enemy.carrier?72:enemy.layer?68:({ scout: 32, dart: 40, lancer: 39, cutter: 42 }[enemy.kind]) * (enemy.flight ? 0.74 : 1);
    const body = this.add.sprite(0, 0, texture, 0)
      .setDisplaySize(size, size);
    // Painted sheets already face south; do not rotate their top-down anatomy.
    if (!enemy.layer) body.play({key:texture+'-loop',startFrame:enemy.id%(enemy.carrier?4:8)});
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
      visual.body.rotation=0;
      const preparing = enemy.phase === 'telegraph';
      if (enemy.layer) visual.body.setFrame(enemy.animationFrame??0);
      if (preparing && !visual.warning.visible) {
        visual.warning.setVisible(true);
      } else if (!preparing && visual.warning.visible) {
        visual.warning.setVisible(false).stop();
      }
      if (preparing) visual.warning.setAlpha(.5 + .4 * Math.sin(enemy.phaseMs / 75));
      if ((enemy.hitFlashMs??0)>0) visual.body.setTint(0xffe0cd);

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
    const key='review-pickups-'+(type==='life'?'life-'+this.pilot.id:type==='full_power'?'power':type);
    const icon=this.add.sprite(0,0,key,0).setDisplaySize(31,31).play(key+'-loop');
    if(type==='full_power')icon.setTint(0xff83b8);
    return this.add.container(0,0,[icon]).setDepth(14);
  }

  private checkPickupCollisions(): void {
    const collected = this.pickups.checkCollection(this.ship.x, this.ship.y, this.vectorShip.hitRadius, false, (x,y,r)=>{const hull=this.ship.hullSprite;return !!hull&&spriteContact(hull,x,y,x,y,r)!==null;});
    for (const item of collected) {
      if(item.type!=='power')globalAudio.playPickup(item.type);
      const color=Phaser.Display.Color.HexStringToColor(PICKUP_GUIDE[item.type].color).color;
      this.particles.burst(item.x,item.y,.7,false,color);
      const feedback=this.add.image(item.x,item.y,'review-pickups-'+(item.type==='life'?'life-'+this.pilot.id:item.type==='full_power'?'power':item.type),0).setDisplaySize(25,25).setDepth(22);
      this.tweens.add({targets:feedback,alpha:0,scaleX:feedback.scaleX*.3,scaleY:feedback.scaleY*.3,x:this.ship.x,y:this.ship.y,duration:110,onComplete:()=>feedback.destroy()});

      if (item.recovery) {
        this.weapons = recoverArmament(this.weapons,item.recovery);
        this.hud.setWeapon(this.weapons.weaponFamily,this.weapons.weaponLevel,this.weapons.powerMeter);
        this.hud.flash('ARMAMENTO RECUPERADO', '#ffd23f',700);
        continue;
      }
      if (item.type === 'power') {
        const res = collectPowerItem(this.weapons);
        globalAudio.playPickup(res.levelIncreased?'upgrade':'power');
        this.weapons = res.state;
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
        if (res.levelIncreased) {
          this.radio.offer('upgrade');
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
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
        this.hud.flash(result.bonusPoints ? 'BÔNUS: +5000 PONTOS' : this.weapons.weaponFamily === family ? PICKUP_GUIDE[item.type].label + ' · NV 1' : 'EVOLUÇÃO BLOQUEADA · ATINJA NV 4 DA ARMA ANTERIOR', PICKUP_GUIDE[item.type].color, 1100);
      } else if (item.type === 'speed') {
        const alreadyMax = this.weapons.speedLevel >= 3;
        this.weapons = collectSpeedItem(this.weapons);
        if (alreadyMax) this.scoreCombo = addRawScore(this.scoreCombo, 5000);
        this.hud.flash(alreadyMax ? 'VELOCIDADE MÁXIMA: +5000 PONTOS' : 'VELOCIDADE S: ' + this.weapons.speedLevel + '/3', '#a5b7ff', 1100);
      } else if (item.type === 'life' || item.type === 'health') {
        const life=collectLife(this.health);this.health=life.state;
        if(life.bonusPoints)this.scoreCombo=addRawScore(this.scoreCombo,life.bonusPoints);
        this.hud.setHealth(this.health);
        this.hud.flash(life.bonusPoints?'VIDAS NO MÁXIMO · +5000':'NOVA NAVE · +1 VIDA','#f6e8ba',900);
      } else if (item.type === 'bomb' || item.type === 'special') {
        const wasFull = this.weapons.specialCharges >= 5;
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
    const layer=boss.name+boss.layer;if(layer!==this.radioBossLayer){this.radioBossLayer=layer;this.radio.offer('boss');}
    if(this.bossVisual?.name!==boss.name){this.bossVisual?.container.destroy();this.bossVisual=undefined;}
    const transforming = boss.phase === 'metamorphosis';
    const key = transforming?'hd-metamorphosis-top':boss.name==='RAIA-DENTE' ? 'polish-raia' : boss.layer==='inner' ? 'hd-inner-top' : 'hd-talassarca-top';
    const size = transforming
      ? PLAYFIELD_WIDTH*(1.20+.18*(boss.metamorphosisMs??0)/METAMORPHOSIS_MS)
      : boss.displayWidth ?? 175;
    if(!this.bossVisual){
      const main=this.add.sprite(0,0,key,0);
      this.bossVisual={name:boss.name,main,container:this.add.container(boss.x,boss.y,[main]).setDepth(6)};
    }
    this.bossVisual.container.setPosition(boss.x,boss.y);
    if(boss.name==='TALASSARCA'){
      this.bossVisual.mounts??=[];
      for(const [i,module]of (boss.modules??[]).entries()){
        let mount=this.bossVisual.mounts[i];
        if(!mount){mount=this.add.sprite(0,0,module.kind==='weapon'?'hd-biogun':'review-hostile-raia',0);this.bossVisual.mounts.push(mount);this.bossVisual.container.add(mount);}
        mount.setPosition(module.offsetX,module.offsetY).setDisplaySize(module.kind==='weapon'?34:22,module.kind==='weapon'?34:22)
          .setVisible(!module.destroyed&&!transforming).setFrame(module.kind==='weapon'?((module.firedMs??0)>70?2:(module.firedMs??0)>0?3:boss.isTelegraphing?1:0):Math.floor(this.time.now/130)%4)
          .setAlpha(module.kind==='weapon'?1:boss.isTelegraphing?.9:.45);
      }

    }
    const frameMs=boss.name==='RAIA-DENTE'?125:boss.layer==='inner'?110:160;
    const frame=transforming ? Math.min(3,Math.floor((boss.metamorphosisMs??0)/(METAMORPHOSIS_MS/4))) : Math.floor(this.time.now/frameMs)%(boss.name==='RAIA-DENTE'?8:4);
    this.bossVisual.main.setTexture(key,frame).setDisplaySize(size,size);
    if(transforming){
      this.bossVisual.morphNext??=this.add.sprite(0,0,key,0);
      if(!this.bossVisual.container.exists(this.bossVisual.morphNext))this.bossVisual.container.add(this.bossVisual.morphNext);
      const phase=(boss.metamorphosisMs??0)/(METAMORPHOSIS_MS/4),mix=Phaser.Math.SmoothStep(phase%1,0,1);
      this.bossVisual.morphNext.setTexture(key,Math.min(3,frame+1)).setDisplaySize(size,size).setAlpha(frame<3?mix:0).setVisible(true);
    }else this.bossVisual.morphNext?.setVisible(false);
    if(boss.isTelegraphing&&!transforming) this.bossVisual.main.setTint(0xffdfcc);else this.bossVisual.main.clearTint();
    this.bossVisual.main.setAlpha(1);
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
    globalAudio.playEnemyShot(kind);
  }

  private applyDamageToEnemy(enemyId: number, amount: number, impactX?:number, impactY?:number): void {
    // Captura posição e tipo ANTES de `this.director.damage` remover o inimigo abatido da lista!
    const targetBefore = this.director.enemies.find(e => e.id === enemyId);
    if(!targetBefore || targetBefore.submerged || amount<=0)return;
    const {x,y} = targetBefore;
    this.trackDamage(enemyId,(impactX??x)-x,(impactY??y)-y,Math.min(amount,targetBefore.hp));
    const hit = this.director.damage(enemyId, amount);

    if (hit.killed) {
      this.radio.kill();
      this.totalKills++;
      if(!targetBefore.carrier&&(targetBefore.kind==='cutter'||targetBefore.maxHp>=5)){const hot=this.damageRegions.get(enemyId)?.strongest();this.explodeLayers(x,y,23,x+(hot?.x??0),y+(hot?.y??0));this.fadeCorpse(this.enemyVisuals.get(enemyId)?.body);}
      this.damageRegions.delete(enemyId);
      if(targetBefore.carrier||targetBefore.maxHp<5)this.playEffect('explosion', x, y);
      globalAudio.playExplosion(false);

      const killResult = registerKill(this.scoreCombo, hit.score);
      this.scoreCombo = killResult.state;
      this.hud.setScore(this.scoreCombo.score, this.scoreCombo.comboCount, getComboMultiplier(this.scoreCombo.comboCount));
      this.spawnScorePopup(hit.score, x, y);


      // Explicit supply carriers are the only source of ordinary drops.
      const dropType = targetBefore?.carrier ? targetBefore.drop : null;
      if (dropType) {
        this.pickups.spawn(dropType === 'weapon_green' ? evolutionCargo(this.weapons) : dropType, x, y);
      }
      this.syncEnemyVisuals();
    } else {
      this.playEffect('hit', impactX??x, impactY??y);
      globalAudio.playHit();
    }
  }

  private advancePlayerShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      const fromX=shot.node.x,fromY=shot.node.y;
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

      // Resolve crossings in physical order, including the boss and thin fast targets.
      const contacts:Array<{id:number|'boss';t:number}>=[];
      for(const enemy of this.director.enemies){
        if(enemy.submerged||shot.hitTargets?.has(enemy.id))continue;
        const visual=this.enemyVisuals.get(enemy.id);
        const t=visual?spriteContact(visual.body,fromX,fromY,shot.node.x,shot.node.y,shot.hitRadius):null;
        if(t!==null)contacts.push({id:enemy.id,t});
      }
      const boss=this.director.boss;
      if(boss&&!['intro','metamorphosis','defeated'].includes(boss.phase)&&!shot.hitTargets?.has('boss')){
        const t=this.bossContact(fromX,fromY,shot.node.x,shot.node.y,shot.hitRadius);
        if(t!==null)contacts.push({id:'boss',t});
      }
      contacts.sort((a,b)=>a.t-b.t);
      for(const contact of contacts){
        const x=fromX+(shot.node.x-fromX)*contact.t,y=fromY+(shot.node.y-fromY)*contact.t;
        shot.hitTargets?.add(contact.id);
        if(contact.id==='boss')this.applyBossDamage(shot.damage*NORMAL_BOSS_SHOT_SCALE*primaryBossFactor(this.pilot.id,boss!.name),x,y);
        else this.applyDamageToEnemy(contact.id,shot.damage*(shot.piercing?.5:.36),x,y);
        if(!shot.piercing){collided=true;break;}
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

  private bossContact(ax:number,ay:number,bx:number,by:number,radius:number):number|null {
    if(!this.bossVisual)return null;
    let first:number|null=null;
    const boss=this.director.boss;
    const parts=boss?.name==='TALASSARCA'?(this.bossVisual.mounts??[]):[this.bossVisual.main];
    for(const sprite of parts){
      const t=spriteContact(sprite,ax,ay,bx,by,radius);if(t!==null&&(first===null||t<first))first=t;
    }
    if(boss?.name==='TALASSARCA'){
      const dx=bx-ax,dy=by-ay,ox=ax-boss.x,oy=ay-boss.y;
      const r=32+radius,A=dx*dx+dy*dy,B=2*(ox*dx+oy*dy),C=ox*ox+oy*oy-r*r,D=B*B-4*A*C;
      const t=C<=0?0:A>0&&D>=0?(-B-Math.sqrt(D))/(2*A):-1;
      if(t>=0&&t<=1&&(first===null||t<first))first=t;
    }
    return first;
  }

  private hullTouchesSprite(body:Phaser.GameObjects.Sprite):boolean {
    const hull=this.ship.hullSprite;
    return hull ? spritesOverlap(hull,body) : false;
  }

  private checkEnemyContacts(): void {
    for(const enemy of [...this.director.enemies]) {
      if(enemy.layer==='surface')continue;
      const body=this.enemyVisuals.get(enemy.id)?.body;
      if(!body||!this.hullTouchesSprite(body))continue;
      this.director.remove(enemy.id);
      if(enemy.maxHp>=5){const hot=this.damageRegions.get(enemy.id)?.strongest();this.explodeLayers(enemy.x,enemy.y,23,enemy.x+(hot?.x??0),enemy.y+(hot?.y??0));this.fadeCorpse(body);}else this.playEffect('explosion',enemy.x,enemy.y);
      this.damageRegions.delete(enemy.id);globalAudio.playExplosion(false);
      this.damageShip(30);
      this.syncEnemyVisuals();
      if(this.health.gameOver)return;
    }
    const boss=this.director.boss;
    if(boss&&!['intro','metamorphosis','defeated'].includes(boss.phase)){
      // Talassarca is an aquatic organism beneath the aircraft; its body is overflown.
      if(boss.name!=='TALASSARCA'&&this.bossVisual&&this.hullTouchesSprite(this.bossVisual.main))this.damageShip(35);
    }
  }

  private advanceEnemyShots(dt: number): void {
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const shot = this.enemyShots[i];
      const previous={x:shot.node.x,y:shot.node.y};
      shot.ageMs += dt;
      shot.node.x += (shot.velocityX * dt) / 1000;
      shot.node.y += (shot.velocityY * dt) / 1000;

      // The visible hull includes the nose and wings, excluding empty sprite corners.
      const painted=this.ship.hullSprite;
      const t=painted?spriteContact(painted,previous.x,previous.y,shot.node.x,shot.node.y,shot.hitRadius):null;
      const hit=painted?(t===null?null:{x:previous.x+(shot.node.x-previous.x)*t,y:previous.y+(shot.node.y-previous.y)*t}):sweptHullContact(previous,{x:shot.node.x,y:shot.node.y},shot.hitRadius,this.ship.x,this.ship.y);

      const outside =
        shot.node.x < PLAYFIELD_X - 20 ||
        shot.node.x > PLAYFIELD_RIGHT + 20 ||
        shot.node.y < -20 ||
        shot.node.y > GAME_HEIGHT + 20;

      const impactX=hit?.x??shot.node.x,impactY=hit?.y??shot.node.y;
      if (hit || outside) {
        shot.node.destroy();
        this.enemyShots.splice(i, 1);
      }
      if (hit) {
        // Se estiver em janela de invulnerabilidade do dash ou pós-acerto, ignora o dano
        if (this.health.invulnerableMs > 0) {
          continue;
        }
        const result = this.damageShip(shot.damage,impactX,impactY);
        if (result === 'respawn' || result === 'game-over') return;
      }
    }
  }

  private damageShip(damage=20, impactX=this.ship.x, impactY=this.ship.y): HitEvent {
    if(damage<=0)return 'ignored';
    if((this.weapons.specialActiveMs>0&&this.weapons.specialDurationMs-this.weapons.specialActiveMs<1800) || this.director.boss?.phase==='metamorphosis')return 'ignored';
    // Se o jogador estiver em invulnerabilidade ativa, descarta qualquer dano
    if (this.health.invulnerableMs > 0) {
      return 'ignored';
    }

    const outcome = applyPlayerHit(this.health,damage);
    if(outcome.event==='respawn'||outcome.event==='game-over')this.radio.death();
    this.health = outcome.state;
    if (outcome.event === 'ignored') return outcome.event;

    this.hud.setHealth(this.health, false);

    if (outcome.event === 'damaged') {
      this.hud.flash('CASCO ATINGIDO!', '#f87171', 1100);
      globalAudio.playHit('hull');
      this.hitPoseMs = 180;
      this.particles.burst(impactX,impactY,.4,false,0xff8855);
      this.playEffect('hit', impactX, impactY);
    } else if (outcome.event === 'respawn') {
      this.releaseRecoveryItems();
      this.weapons = {...resetWeaponsOnRespawn(this.weapons), weaponLevel:1, powerMeter:0};
      this.specialVisual?.destroy(); this.specialVisual=undefined;
      this.crimsonLaserRenderer.clear(); this.clearPlayerShots(); this.clearEnemyShots();
      globalAudio.playExplosion(true);
      this.playEffect('explosion', this.ship.x, this.ship.y);
      this.particles.burst(this.ship.x,this.ship.y,1.3,true,0xffa43b);
      this.vectorShip.setPosition(PLAYFIELD_X+PLAYFIELD_WIDTH/2,GAME_HEIGHT-65);
      this.hud.setWeapon(this.weapons.weaponFamily,1,0);
      this.hud.flash('NAVE ABATIDA · RECUPERE SEU ARMAMENTO', '#ffca80',1200);
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

  private releaseRecoveryItems(): void {
    recoveryPayloads(this.weapons).forEach((recovery,i,items)=>{
      const item=this.pickups.spawn('power',
        this.ship.x+(i-(items.length-1)/2)*28,this.ship.y-30-i*10);
      item.recovery=recovery;
    });
    this.syncPickupVisuals();
  }

  private trackDamage(id:string|number,x:number,y:number,damage:number):void {
    let heat=this.damageRegions.get(id);if(!heat){heat=new DamageRegions();this.damageRegions.set(id,heat);}heat.add(x,y,damage);
  }
  private fadeCorpse(body?:Phaser.GameObjects.Sprite,boss=false):void {
    if(!body)return;const matrix=body.getWorldTransformMatrix();
    const corpse=this.add.image(matrix.tx,matrix.ty,body.texture.key,body.frame.name).setDisplaySize(body.displayWidth,body.displayHeight).setDepth(4).setTint(0x9a5f53).setAlpha(.55);
    this.tweens.add({targets:corpse,alpha:0,y:corpse.y+(boss?28:14),scaleX:corpse.scaleX*.92,scaleY:corpse.scaleY*.92,duration:boss?1050:480,onComplete:()=>corpse.destroy()});
    body.setVisible(false);
  }

  private explodeLayers(x:number,y:number,radius:number,impactX=x,impactY=y,boss=false):void {
    for(const blast of destructionPlan(x,y,radius,impactX,impactY,boss))this.time.delayedCall(blast.delay,()=>{
      this.playEffect('explosion',blast.x,blast.y,blast.scale);
      this.particles.burst(blast.x,blast.y,blast.scale,false,blast.major?0xffbc5c:0xff793c);
      globalAudio.playExplosion(blast.major);
    });
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
