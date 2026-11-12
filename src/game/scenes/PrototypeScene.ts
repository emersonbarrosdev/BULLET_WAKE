import { MissionResultOverlay } from '../ui/MissionResultOverlay';
import { combatBossRegions, bossDamageable } from '../systems/bosses/combatBossRegions';
import { enterStage, stageFlightSnapshot, type CampaignFlight } from '../systems/campaignFlight';
import { segmentEllipseHit } from '../systems/normalBalance';
import { talassarcaRegions } from '../systems/bosses/talassarcaRig';
import { destructionPlan } from '../systems/destructionSystem';
import { DamageRegions } from '../systems/damageRegions';
import { PilotRadio, type RadioSnapshot } from '../systems/pilotRadioSystem';
import { deathPowerDropCount } from '../systems/recoverySystem';
import { rivetShotPresentation } from '../render/rivetPresentation';
import { spriteContact, spritesOverlap } from '../render/SpriteSilhouette';
import { continueWeapons, primaryBossFactor, NORMAL_BOSS_SHOT_SCALE, RIVET_MISSILE_INTERVAL_MS } from '../systems/normalBalance';
import { ScarletStorm } from '../render/ScarletStorm';
import { scarletSegments, scarletDamageBetween } from '../systems/scarletStorm';
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
  maxWeaponLevel,
  powerItemsForNextLevel,
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
  PILOT_WEAPON_SPECS,
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
import { SPECIAL_BOSS_DAMAGE } from '../systems/bosses/bossTalassarca';

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
  homing?: boolean;
  piercing?: boolean;
  waveAmplitude?: number;
  waveFrequency?: number;
  wavePhase?: number;
  waveVerticalAmplitude?: number;
  sourceLayer?: 'surface';
  weight?:'weak'|'medium'|'heavy'|'special';
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
 * Três vidas, armamento próprio de cinco pilotos,
 * coletáveis físicos e chefes da Fenda Pelágica.
 */
export class PrototypeScene extends Phaser.Scene {
  private vectorShip!: VectorShip;
  get ship(): VectorShip {
    return this.vectorShip;
  }

  private hitPoseMs = 0;
  private missilePoseMs = 0;
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
  private projectilePool:Phaser.GameObjects.Sprite[]=[];
  private enemyVisuals = new Map<number, EnemyVisual>();
  private pickupVisuals = new Map<number, Phaser.GameObjects.Container>();

  private pickups = new PickupSystem();
  private director = new StageDirector(GAME_WIDTH, true, 1);
  private bossVisual?: BossVisual;

  private crimsonLaserState: CrimsonLaserState = createInitialCrimsonLaserState(1);
  private crimsonLaserRenderer!: CrimsonLaserRenderer;
  private laserAudioTimerMs = 0;

  private specialVisual?: ScarletStorm;
  private scarletLastDamageMs = 0;
  private checkpointDistance = 0;
  private resumeWeapons?: PlayerWeaponsState;
  private resumeRadio?:RadioSnapshot;
  private damageRegions=new Map<string|number,DamageRegions>();
  private triggerCadence: TriggerCadence = {holdMs:0,tapMs:0};
  private bentoBarrel=1;
  private orbitalDrones:Array<{node:Phaser.GameObjects.Sprite;age:number;index:number;launched:boolean}>=[];
  private totalKills = 0;
  private completed = false;
  private carry?:CampaignFlight;
  private exitMs=0;
  private exitStart={x:384,y:350};
  private resultShown=false;
  private bossSequence='';
  private encounterEffects!:Phaser.GameObjects.Graphics;
  private briefing?: CombatBriefing;
  private skipBriefing = false;
  private entryLoading?: CombatLoading;
  private entryLoadFailed = false;
  private particles!: CombatParticles;

  constructor() {
    super({ key: 'PrototypeScene' });
  }

  init(data: { pilotId?: string; stageNumber?: number; skipBriefing?: boolean; checkpointDistance?:number; resumeWeapons?:PlayerWeaponsState; radioSnapshot?:RadioSnapshot; carry?:CampaignFlight } = {}): void {
    this.pilot = getPilot(data.pilotId);
    this.skipBriefing = !!data.skipBriefing || !!data.resumeWeapons;
    this.stageNumber = STAGES.some(s=>s.number===data.stageNumber&&s.number===1)?data.stageNumber!:1;this.carry=data.carry;globalAudio.setEnvironment('atmosphere');
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>globalAudio.stopCombatEffects());
    enableCombatResolution(this);
    this.cameras.main.setBackgroundColor(GAME_BACKGROUND);

    this.hitPoseMs = 0;
    this.missilePoseMs = 0;
    this.phantomDashTimerMs = 0;

    // Each pilot starts with the owned primary at level 1 and zero P.
    const entry=enterStage(this.pilot.id,this.stageNumber,this.carry);
    this.weapons = this.resumeWeapons??entry.weapons;
    this.scoreCombo = {...initialScoreCombo(),score:entry.score};
    this.health = entry.health;
    this.radio=new PilotRadio(this.pilot.id);if(this.resumeRadio)this.radio.restore(this.resumeRadio);this.radioBossLayer='';this.damageRegions.clear();
    if(this.resumeWeapons)this.health.invulnerableMs=2000;
    this.totalKills = 0;this.bentoBarrel=1;this.orbitalDrones=[];
    this.completed = false;this.exitMs=0;this.resultShown=false;this.bossSequence='';

    this.shots = [];
    this.enemyShots = [];this.projectilePool=[];
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
    this.hud.setPilot(this.pilot.id, this.pilot.shipName);this.registry.set('activePilot',this.pilot.id);
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
    this.encounterEffects=this.add.graphics().setDepth(17);

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
    globalAudio.pauseMusic();globalAudio.stopCombatEffects();
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
        ? `LASER RUBRO — NV ${level} (${LASER_RUBRO_SPECS[Math.min(4,level) as 1|2|3|4].title})`
        : family === 'green'
          ? `ENERGIA ESPIRALADA — NÍVEL ${level}`
          : `${this.pilot.id === 'nolan' ? 'RAJADA ESCARLATE' : 'DISPERSÃO AZUL'} — NÍVEL ${level}`;
    const color = family === 'red' ? '#ff1e42' : family === 'green' ? '#4ade80' : '#00f0ff';
    this.hud.flash(label, color, 1100);
  }

  update(_time: number, delta: number): void {
    const dt = clamp(delta, 0, 50);
    this.particles.update(dt);
    if(this.completed){this.updateVictoryExit(dt);return;}

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

    // Atualiza timers de combate e ações especiais
    this.health = advanceHealth(this.health, dt);
    this.weapons = advanceWeapons(this.weapons, dt);
    this.scoreCombo = advanceCombo(this.scoreCombo, dt);

    this.hitPoseMs = Math.max(0, this.hitPoseMs - dt);
    this.missilePoseMs = Math.max(0, this.missilePoseMs - dt);
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
      if(Math.hypot(dx,dy)<.1)dy=-1;speed=650;this.spawnPhantomAfterimage();
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
    const specs = this.pilot.id==='nolan'?WEAPON_FAMILY_SPECS[this.weapons.weaponFamily]:(PILOT_WEAPON_SPECS[this.pilot.id]??WEAPON_FAMILY_SPECS.ion);
    const mayFire=!this.weapons.isCharging&&!(this.weapons.weaponFamily==='red'&&this.pilot.id!=='harlan');
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

      // Tormenta Escarlate: emissão frontal acompanhando o bico da RIVET.
      this.updateScarletSpecial();
      this.updateOrbitalDrones(dt);

      // Atualiza diretor da fase
      const tick = this.director.update(dt, this.ship.x, this.ship.y);
      this.backdrop.update(tick.backgroundScrollPx,dt,tick.scrollPx);
      this.updateEncounterEffects(dt);
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
        const form = boss.layer ? (['escape','submerged','emerge'].includes(boss.phase)?' · RECONFIGURAÇÃO':boss.layer==='shell'?' · BATALHA AÉREA':' · COLOSSO OCEÂNICO') : '';
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
      if(tick.failed){
        this.clearEnemyShots();this.clearPlayerShots();this.crimsonLaserRenderer.clear();this.specialVisual?.destroy();this.specialVisual=undefined;
        this.hud.hideBossBar();globalAudio.stopMusic();globalAudio.stopCombatEffects();this.scene.pause();
        new MissionResultOverlay(this,'ALVO FORA DE ALCANCE','TEMPO DE CONTATO EXCEDIDO',this.scoreCombo.score,
          'Talassarca deixou a área de combate. A missão não foi concluída.',[
            {label:'RETOMAR DO SETOR',key:'Enter',run:()=>this.continueFromCheckpoint()},
            {label:'VOLTAR AO MENU',key:'Escape',run:()=>this.scene.start('TitleScene')}
          ],true);
      }else if (tick.completed) this.beginVictoryExit();
    }

  private restart(): void {
    globalAudio.stopMusic();
    this.scene.restart({ pilotId: this.pilot.id, stageNumber: this.stageNumber, skipBriefing: true });
  }

  private beginVictoryExit():void {
    if(this.completed)return;
    this.completed=true;this.exitMs=0;this.exitStart={x:this.ship.x,y:this.ship.y};
    this.specialVisual?.destroy();this.specialVisual=undefined;
    this.weapons.specialActiveMs=0;this.phantomDashTimerMs=0;
    for(const d of this.orbitalDrones)d.node.destroy();this.orbitalDrones=[];
    this.crimsonLaserRenderer.clear();this.clearEnemyShots();this.clearPlayerShots();
    this.hud.hideBossBar();this.encounterEffects.clear();this.ship.setAlpha(1);
    this.scoreCombo=addRawScore(this.scoreCombo,6000+this.health.lives*1000);
    this.hud.setScore(this.scoreCombo.score);
    const carry=stageFlightSnapshot(this.stageNumber,this.weapons,this.health.lives,this.scoreCombo.score);
    saveSystem.recordStageClear(this.stageNumber,this.pilot.id,this.scoreCombo.score,carry);
    this.hud.flash('SETOR LIVRE · RETORNANDO À FORMAÇÃO','#b6f7c5',2600);
    globalAudio.startVictoryMusic();
  }

  private updateVictoryExit(dt:number):void {
    this.exitMs+=dt;this.hud.update(dt);
    this.radio.update(dt,{enemies:0,bullets:0,lives:this.health.lives,specials:this.weapons.specialCharges});
    this.hud.setRadio(this.radio.message,this.radio.remaining>0);
    this.director.backgroundScrollPx+=dt*.036;
    this.backdrop.update(this.director.backgroundScrollPx,dt,this.director.scrollPx);
    // Let the layered detonation finish, align gently, then climb entirely off-screen.
    const align=Math.min(1,Math.max(0,(this.exitMs-850)/650));
    const flight=Math.max(0,this.exitMs-1500)/1000;
    this.ship.setPosition(this.exitStart.x+(384-this.exitStart.x)*align,this.exitStart.y-75*flight-100*flight*flight);
    this.ship.updateShip(dt,0,flight>0?-1:0,0,false,false);
    if(this.ship.y < -this.ship.halfHeight-40)this.ship.setVisible(false);
    if(this.exitMs<4200||this.resultShown)return;
    this.resultShown=true;
    const carry=stageFlightSnapshot(this.stageNumber,this.weapons,this.health.lives,this.scoreCombo.score);
    new StageCompleteOverlay(this,this.stageNumber,this.scoreCombo.score,
      ()=>this.scene.start('EndingScene',{pilotId:this.pilot.id,score:this.scoreCombo.score,stageNumber:this.stageNumber,carry}),
      ()=>this.restart(),()=>this.choosePilot(),this.pilot.name+' — '+this.radio.message);
  }

  private updateEncounterEffects(dt:number):void {
    const fx=this.encounterEffects;fx.clear();const boss=this.director.boss;
    if(!boss)return;
    const sequence=boss.name+':'+boss.phase;
    if(sequence!==this.bossSequence){
      this.bossSequence=sequence;globalAudio.setBossSuspense(['escape','submerged'].includes(boss.phase));
      if(boss.phase==='escape'){this.radio.offer('escape',true);globalAudio.playBossTransition('escape');}
      if(boss.phase==='submerged')globalAudio.playBossTransition('submerged');
      if(boss.phase==='emerge'){this.radio.offer('return',true);globalAudio.playBossTransition('emerge');this.clearEnemyShots();}
    }
    if(boss.phase==='submerged'||boss.phase==='emerge'){
      const time=(boss.transitionMs??0)/1000;
      for(let i=0;i<4;i++){
        const r=40+((time*60+i*50)%210);
        fx.lineStyle(1.3,0x9ce8df,.3*(1-r/260));fx.strokeEllipse(384,225,r*1.7,r*.7);
      }
      this.particles.burst(384+Math.sin(time*5)*100,230+Math.cos(time*3)*70,.12,true);
    }
    const eclipse=boss.eclipse;
    if(!eclipse)return;
    if(eclipse.phase==='warning'){
      for(const x of eclipse.lanes){
        const origin=boss.y+(boss.modules?.find(m=>Math.abs(boss.x+m.offsetX-x)<1)?.offsetY??0);
        fx.lineStyle(1.5,0xff6aaf,.6);fx.strokeRect(x-20,origin,40,435-origin);
        for(let y=origin+15;y<420;y+=28){fx.lineBetween(x-13,y,x,y+9);fx.lineBetween(x,y+9,x+13,y);}
      }
      this.hud.flash('ECLIPSE ABISSAL · SAIA DOS CORREDORES','#f3a1cf',150);
    }else if(eclipse.phase==='fire'){
      const activeLane=Math.min(eclipse.lanes.length-1,Math.floor((eclipse.elapsed-1400)/800));
      for(const x of eclipse.lanes.filter((_,i)=>i===activeLane)){
        const origin=boss.y+(boss.modules?.find(m=>Math.abs(boss.x+m.offsetX-x)<1)?.offsetY??0);
        fx.lineStyle(28,0x931456,.35);fx.lineBetween(x,origin,x,435);
        fx.lineStyle(13,0xff458f,.8);fx.lineBetween(x,origin,x,435);
        fx.lineStyle(4,0xfff4fc,1);fx.lineBetween(x,origin,x,435);
        if(Math.abs(this.ship.x-x)<21+this.ship.halfWidth*.6)this.damageShip(1);
      }
      if(Math.floor(eclipse.elapsed/200)!==Math.floor((eclipse.elapsed-dt)/200))globalAudio.playBossTransition('eclipse');
    }
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

  private playEffect(kind:'muzzle'|'hit'|'explosion',x:number,y:number,scale=1,material:'metal'|'organic'|'energy'='metal'):void {
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
    const sprite=this.add.sprite(x,y,key,0).setTint(material==='organic'?0xe184ff:material==='energy'?0xaff6ff:0xffffff).setDisplaySize(size,size).setDepth(19).play(key+'-loop');
    sprite.once('animationcomplete',()=>sprite.destroy());
    this.particles.burst(x,y,Math.min(1,scale),false,material==='organic'?0xc974ff:material==='energy'?0x95eafa:undefined);
  }

  private createPlayerProjectile(def: ProjectileSpawnDef, tint?: number): void {
    const family=this.weapons.weaponFamily;
    const effect=def.texture==='rivet-v3-missile'?'missile':def.piercing?'charge':family==='green'?'green':'blue';
    const rivetRed = this.pilot.id === 'nolan' && effect === 'blue';
    const key=def.presentation?'reform-'+def.presentation:rivetRed?'polish-rivet-red':(effect==='blue'||effect==='green'?'polish-':'review-effects-')+effect;
    const animation=def.presentation?key+'-loop':effect==='blue'&&!rivetRed?'polish-blue-single':key+'-loop';
    const node=this.acquireProjectile(def.x,def.y,key).setDepth(9).play(animation);
    node.setRotation(Math.atan2(def.velocityY,def.velocityX)+Math.PI/2);
    const size=effect==='missile'?25:effect==='charge'?50:effect==='green'?32:this.weapons.weaponLevel>=4?29:this.weapons.weaponLevel>=3?25:19;
    node.setDisplaySize(effect==='blue'?size*(this.weapons.weaponLevel>=3?.72:.5):size,size);
    const redArt = rivetShotPresentation(this.weapons.weaponLevel);
    if(rivetRed)node.setDisplaySize(redArt.width,redArt.height);
    else if(effect==='blue')node.setOrigin(.84,.5);
    if(def.presentation){const lv=this.weapons.weaponLevel;node.setOrigin(.5,.5).setDisplaySize(def.presentation==='amber'?12+lv*3:def.presentation==='violet'?18+lv*3:7+lv*1.5,def.presentation==='amber'?23+lv*3:26+lv*3);}
    else if(tint&&this.pilot.id!=='nolan')node.setTint(tint);
    this.shots.push({
      node,
      baseX: def.x,
      baseY: def.y,
      trail: [],
      ageMs: 0,
      velocityX: def.velocityX,
      velocityY: def.velocityY,
      damage: def.damage,
      hitRadius: rivetRed ? redArt.radius : def.presentation?def.hitRadius:Math.min(def.hitRadius,def.piercing?6:effect==='missile'?3:2.5),
      hitTargets:new Set(),
      homing:def.homing,
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
    const isRubyEquipped = this.weapons.weaponFamily === 'red' && this.pilot.id!=='harlan';
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
      bossDamageable(this.director.boss)
    ) {
      const boss=this.director.boss;
      if(boss.modules?.length){
        for(const region of combatBossRegions(boss)){
          const m=boss.modules?.find(m=>m.id===region.id);if(!m||m.destroyed)continue;
          targets.push({id:`boss:${m.id}`,x:boss.x+m.offsetX,y:boss.y+m.offsetY,radius:m.width/2,stopsBeam:true,
            contact:(ax,ay,bx,by,r)=>this.bossVisual?spriteContact(this.bossVisual.main,ax,ay,bx,by,r,region):null});
        }
      }else targets.push({id:'boss',x:boss.x,y:boss.y,radius:boss.bodyRadiusY??65,
        contact:(ax,ay,bx,by,r)=>this.bossContact(ax,ay,bx,by,r),stopsBeam:true});
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
      } else if (typeof dmgEvent.targetId==='string' && this.director.boss) {
        this.applyBossDamage(dmgEvent.damage*this.pilot.damage*primaryBossFactor(this.pilot.id,this.director.boss.name), dmgEvent.hitX, dmgEvent.hitY,false,dmgEvent.targetId.startsWith('boss:')?dmgEvent.targetId.slice(5):undefined);
      }
    }
  }

  private applyBossDamage(damage: number, hitX: number, hitY: number, area = false, exactModuleId?:string): void {
    const boss = this.director.boss;
    if (!boss || ['intro', 'metamorphosis', 'escape', 'submerged', 'emerge', 'defeated'].includes(boss.phase)) return;

    const moduleId=exactModuleId??this.bossPartContact(hitX,hitY,hitX,hitY,3)?.moduleId;
    const bossHit = area&&boss.damageArea ? boss.damageArea(damage) : this.director.damageBoss(damage, hitX, hitY,moduleId);
    if (bossHit.bossDamage > 0) {
      this.trackDamage(boss.name+boss.layer,hitX-boss.x,hitY-boss.y,bossHit.bossDamage);
      this.playEffect(bossHit.killed ? 'explosion' : 'hit', hitX, hitY);
      globalAudio.playHit(boss.modules?.find(m=>m.id===moduleId)?.kind==='weapon'?'metal':'energy');
      this.particles.burst(hitX,hitY,.2,false,boss.modules?.find(m=>m.id===moduleId)?.kind==='weapon'?0xffc76c:0xc28bff);
      this.hud.showBossBar(boss.name, boss.hp, boss.maxHp);
      if (bossHit.moduleDestroyed) {
        if(boss.phase==='escape')this.clearEnemyShots();
        this.explodeLayers(hitX,hitY,24,hitX,hitY,false);
        globalAudio.playExplosion(true);
        this.hud.flash(boss.phase==='escape' ? 'ALVO RECUANDO · MANTENHA A FORMAÇÃO' : `PARTE DESTRUÍDA: ${bossHit.moduleDestroyed.toUpperCase()}`, '#ffd488', 1800);
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
    const defs = getPrimaryProjectiles(this.pilot.id, this.weapons.weaponLevel, originX, originY,this.weapons.weaponFamily);
    const barrel=this.bentoBarrel;this.bentoBarrel*=-1;
    for (const def of defs) {
      if(this.pilot.id==='bento')def.x+=barrel*5;
      const focus=1;
      this.createPlayerProjectile({...def,velocityX:def.velocityX*focus,damage:def.damage*this.pilot.damage}, familyTint);
    }

    // Painted projectiles originate at the current, unrotated nose.
    globalAudio.playShot(this.pilot.id, this.weapons.weaponLevel);
  }

  private fireSecondary(): void {
    this.weapons.missileCooldownMs = this.pilot.id==='nolan'?(this.weapons.weaponLevel===5?1100:RIVET_MISSILE_INTERVAL_MS):1700;
    this.missilePoseMs = 280;

    const defs = getSecondaryProjectiles(this.pilot.id, this.vectorShip.x, this.vectorShip.y,this.weapons.weaponLevel);
    for (const def of defs) {
      this.createPlayerProjectile(def);
    }

    globalAudio.playMissile();

  }

  private triggerSpecial(): void {
    if(this.director.boss&&!bossDamageable(this.director.boss))return;
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

    if (this.weapons.specialType === 'scarlet') {
      this.hud.flash('TORMENTA ESCARLATE!', '#ff6250', 1400);
      this.specialVisual?.destroy();
      this.specialVisual = new ScarletStorm(this);
      this.scarletLastDamageMs = 0;
    } else if (this.weapons.specialType === 'phantom') {
      this.phantomDashTimerMs = 350;
      this.hud.flash('SALTO FANTASMA!', '#cb8cff', 1200);
      for(const delay of [150,350,550])this.time.delayedCall(delay,()=>{const target=this.director.boss;this.specialImpact(target?.x??this.ship.x,target?.y??this.ship.y,SPECIAL_BOSS_DAMAGE/3,150);});
    } else if (this.weapons.specialType === 'orbital') {
      this.hud.flash('COROA ORBITAL!', '#90f5c0', 1400);
      for(let i=0;i<6;i++)this.orbitalDrones.push({node:this.add.sprite(this.ship.x,this.ship.y,'reform-orbital',0).setDisplaySize(26,40).setDepth(13).play('reform-orbital-loop'),age:0,index:i,launched:false});
     } else if (this.weapons.specialType === 'comet') {
      this.hud.flash('CHUVA DE COMETAS!', '#99ceff', 1400);
      for(let i=0;i<8;i++)this.time.delayedCall(i*170,()=>{
        const fromLeft=i%2===0,x=fromLeft?PLAYFIELD_X-30:PLAYFIELD_RIGHT+30;
        const targetY=boss?.y??70+(i%4)*75;
        const comet=this.add.sprite(x,targetY-45,'reform-comet',0).setDisplaySize(76,90).play('reform-comet-loop').setRotation(fromLeft?Math.PI/3:-Math.PI/3).setDepth(18);
        this.tweens.add({targets:comet,x:boss?.x??PLAYFIELD_X+PLAYFIELD_WIDTH/2,y:targetY,duration:400,onComplete:()=>{
          this.specialImpact(comet.x,comet.y,SPECIAL_BOSS_DAMAGE/8,110);comet.setRotation(0);this.finishSpecialSprite(comet,'reform-comet');
        }});
      });
    } else if (this.weapons.specialType === 'nova') {
      this.hud.flash('RUPTURA NOVA!', '#ffb66a', 1500);
      this.emitRupturaNova();
      this.time.delayedCall(180,()=>{const target=this.director.boss;this.specialImpact(target?.x??this.ship.x,target?.y??this.ship.y,SPECIAL_BOSS_DAMAGE,500);});
    }
  }

  private updateScarletSpecial():void {
    if(this.weapons.specialType!=='scarlet'||this.weapons.specialActiveMs<=0) {
      this.specialVisual?.destroy();this.specialVisual=undefined;return;
    }
    const elapsed=this.weapons.specialDurationMs-this.weapons.specialActiveMs;
    const beams=this.specialVisual?.update(elapsed,this.ship.x,this.ship.y-this.ship.halfHeight-2)??[];
    if(elapsed-this.scarletLastDamageMs<80)return;
    const damage=scarletDamageBetween(this.scarletLastDamageMs,elapsed);
    this.scarletLastDamageMs=elapsed;
    if(damage<=0)return;
    const segments=[...beams].sort((a,b)=>b.radius-a.radius).flatMap(b=>scarletSegments(b).map(s=>({...s,power:b.radius>20?1:.55})));
    const contact=(body:Phaser.GameObjects.Sprite,region?:ReturnType<typeof talassarcaRegions>[number])=>{
      for(const b of segments){
        const t=spriteContact(body,b.ax,b.ay,b.bx,b.by,b.radius,region);
        if(t!==null)return {x:b.ax+(b.bx-b.ax)*t,y:b.ay+(b.by-b.ay)*t,power:b.power};
      }
      return null;
    };
    for(const e of [...this.director.enemies]) {
      const v=this.enemyVisuals.get(e.id),hit=!e.submerged&&v?contact(v.body):null;
      if(hit)this.applyDamageToEnemy(e.id,damage*.5*hit.power,hit.x,hit.y);
    }
    const boss=this.director.boss,visual=this.bossVisual;
    if(boss&&visual&&!['intro','metamorphosis','escape','submerged','emerge','defeated'].includes(boss.phase)) {
      if(boss.modules?.length) {
        const hits=combatBossRegions(boss).filter(r=>!boss.modules?.find(m=>m.id===r.id)?.destroyed)
          .flatMap(r=>{const hit=contact(visual.main,r);return hit?[{...hit,id:r.id}]:[];});
        const weight=Math.max(1,hits.reduce((n,h)=>n+h.power,0));
        for(const hit of hits)this.applyBossDamage(damage*hit.power/weight,hit.x,hit.y,false,hit.id);
        if(hits.length)this.particles.burst(hits[0].x,hits[0].y,.22,false,0xff5b24);
      } else {
        const hit=contact(visual.main);
        if(hit)this.applyBossDamage(damage*hit.power,hit.x,hit.y);
      }
    }
    for(let i=this.enemyShots.length-1;i>=0;i--)if(contact(this.enemyShots[i].node)) {
      this.releaseProjectile(this.enemyShots[i].node);this.enemyShots.splice(i,1);
    }
  }

  private specialImpact(x:number,y:number,budget:number,radius:number):void {
    if(this.completed||this.health.gameOver)return;
    const boss=this.director.boss;
    if(boss&&Math.hypot(boss.x-x,boss.y-y)<=radius+(boss.bodyRadiusY??65))this.applyBossDamage(budget,x,y,true);
    for(const e of [...this.director.enemies])if(!e.submerged&&Math.hypot(e.x-x,e.y-y)<radius)this.applyDamageToEnemy(e.id,8*budget/SPECIAL_BOSS_DAMAGE,e.x,e.y);
    this.clearEnemyShots();this.particles.burst(x,y,.8);globalAudio.playExplosion(budget>=100);
  }
  private updateOrbitalDrones(dt:number):void {
    for(let i=this.orbitalDrones.length-1;i>=0;i--){
      const d=this.orbitalDrones[i];d.age+=dt;
      if(d.age>2300||this.health.gameOver){d.node.destroy();this.orbitalDrones.splice(i,1);continue;}
      const old={x:d.node.x,y:d.node.y};
      if(d.age<600+d.index*75){
        const angle=d.index*Math.PI/3+d.age*.004;
        d.node.setPosition(this.ship.x+Math.cos(angle)*35,this.ship.y+Math.sin(angle)*23);
        d.node.setRotation(angle);
        for(let j=this.enemyShots.length-1;j>=0;j--){const shot=this.enemyShots[j];if(shot.weight==='weak'&&Math.hypot(shot.node.x-d.node.x,shot.node.y-d.node.y)<18){this.releaseProjectile(shot.node);this.enemyShots.splice(j,1);}}
        continue;
      }
      d.launched=true;
      const boss=this.director.boss;
      const modules=boss&&bossDamageable(boss)?boss.modules?.filter(m=>!m.destroyed):undefined;
      const module=modules?.[d.index%Math.max(1,modules.length)];
      const enemy=this.director.enemies.filter(e=>!e.submerged)[d.index%Math.max(1,this.director.enemies.length)];
      const target=module&&boss?{x:boss.x+module.offsetX,y:boss.y+module.offsetY}:enemy??{x:d.node.x,y:-80};
      const distance=Math.hypot(target.x-old.x,target.y-old.y)||1,travel=Math.min(distance,dt*.7);
      d.node.setPosition(old.x+(target.x-old.x)/distance*travel,old.y+(target.y-old.y)/distance*travel).setRotation(Math.atan2(target.y-old.y,target.x-old.x)+Math.PI/2);
      const hit=boss&&bossDamageable(boss)?this.bossPartContact(old.x,old.y,d.node.x,d.node.y,5):null;
      if(hit){this.applyBossDamage(20,d.node.x,d.node.y,false,hit.moduleId);this.particles.burst(d.node.x,d.node.y,.4,false,0x8af0a8);globalAudio.playHit('energy');}
      else if(enemy){const visual=this.enemyVisuals.get(enemy.id);if(!visual||spriteContact(visual.body,old.x,old.y,d.node.x,d.node.y,5)===null)continue;this.applyDamageToEnemy(enemy.id,4,d.node.x,d.node.y);}
      else continue;
      d.node.destroy();this.orbitalDrones.splice(i,1);
    }
  }
  private finishSpecialSprite(sprite:Phaser.GameObjects.Sprite,key:string):void {
    sprite.setTexture(key,2).setDisplaySize(95,95);
    this.time.delayedCall(120,()=>sprite.setFrame(3));
    this.tweens.add({targets:sprite,alpha:0,duration:320,onComplete:()=>sprite.destroy()});
  }
  private spawnPhantomAfterimage(): void {
    const hull=this.ship.hullSprite;if(!hull)return;
    const ghost=this.add.image(this.ship.x,this.ship.y,hull.texture.key,hull.frame.name).setDisplaySize(40,40).setTint(0xc185ff).setAlpha(.45).setDepth(6);
    this.tweens.add({targets:ghost,alpha:0,duration:280,onComplete:()=>ghost.destroy()});
  }

  private emitRupturaNova(): void {
    const nova = this.add.sprite(this.vectorShip.x, this.vectorShip.y, 'fx-nova-wave', 0)
      .setScale(2.2).setTint(0xffb35d).setDepth(20);
    nova.once('animationcomplete', () => nova.destroy());
    nova.play('fx-nova-wave-play');

    const radius = 150;
    // Apaga balas hostis no raio
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const shot = this.enemyShots[i];
      if (Math.hypot(shot.node.x - this.vectorShip.x, shot.node.y - this.vectorShip.y) <= radius) {
        this.releaseProjectile(shot.node);
        this.enemyShots.splice(i, 1);
      }
    }

  }

  private makeEnemyVisual(enemy: EnemyModel): void {
    const texture = enemy.carrier?'hd-supply-parachute':enemy.layer?'polish-'+(enemy.surfaceVariant==='ambush'?'ambush':'surface'):'reform-'+enemy.kind;
    const size = (enemy.carrier?72:enemy.layer?68:({ scout: 32, dart: 40, lancer: 39, cutter: 42 }[enemy.kind]) * (enemy.flight ? 0.74 : 1))*.88;
    const body = this.add.sprite(0, 0, texture, 0)
      .setDisplaySize(size, size);
    // Painted sheets already face south; do not rotate their top-down anatomy.
    if (enemy.carrier) body.play({key:texture+'-loop',startFrame:enemy.id%8});
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
      else if(!enemy.carrier)visual.body.setFrame(preparing?1:enemy.phase==='attack'?2:enemy.phase==='recover'?3:0);
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

      if (item.type === 'power') {
        const res = collectPowerItem(this.weapons);
        globalAudio.playPickup(res.levelIncreased?'upgrade':'power');
        this.weapons = res.state;
        this.hud.setWeapon(this.weapons.weaponFamily, this.weapons.weaponLevel, this.weapons.powerMeter);
        if (res.levelIncreased) {
          this.radio.offer('upgrade');
          this.hud.flash(`UPGRADE DE ARMA! NÍVEL ${this.weapons.weaponLevel}`, '#facc15', 1400);
        } else if (!res.meterIncreased) {
          this.scoreCombo = addRawScore(this.scoreCombo, 5000);
          this.hud.flash('POTÊNCIA MÁXIMA (+5000 PTS)', '#fbbf24', 1000);
        } else if (this.weapons.weaponLevel >= maxWeaponLevel(this.pilot.id)) {
          this.hud.flash('POTÊNCIA MÁXIMA · +5.000', '#fbbf24', 1000);
        } else {
          this.hud.flash(`ITEM P COLETADO [${this.weapons.powerMeter}/${powerItemsForNextLevel(this.pilot.id,this.weapons.weaponLevel)}]`, '#fde047', 950);
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
    const layer=boss.name+boss.layer;if(layer!==this.radioBossLayer){this.radioBossLayer=layer;if(boss.phase==='intro'||boss.phase==='shell')this.radio.offer('boss',true);}
    if(this.bossVisual?.name!==boss.name){this.bossVisual?.container.destroy();this.bossVisual=undefined;}
    const emerging=boss.phase==='emerge';
    const key=boss.name==='RAIA-DENTE'?'reform-captain':emerging?'reform-emerge':boss.layer==='inner'?'reform-colossus':'reform-aerial';
    const size=boss.displayWidth??136;
    if(!this.bossVisual){const main=this.add.sprite(0,0,key,0);this.bossVisual={name:boss.name,main,container:this.add.container(boss.x,boss.y,[main]).setDepth(6)};}
    const visual=this.bossVisual;
    visual.container.setPosition(boss.x,boss.y).setVisible(boss.visible!==false);
    const frame=emerging?Math.min(3,Math.floor((boss.transitionMs??0)/450)):boss.phase==='escape'?3:boss.isTelegraphing?1:(boss.modules??[]).some(m=>(m.firedMs??0)>0)?2:Math.floor(this.time.now/210)%4;
    visual.main.setTexture(key,frame).setDisplaySize(size,size).setAlpha(1).clearTint();
    if(boss.phase==='escape')visual.main.setTint(0xa78b83);
    const regions=combatBossRegions(boss),sourceSize=boss.name==='RAIA-DENTE'?256:512;
    visual.mounts??=[];
    for(const [i,m]of(boss.modules??[]).entries()){
      let scar=visual.mounts[i];const r=regions[i],scarKey=key+'-scar-'+i;
      if(!this.textures.exists(scarKey)&&!emerging){
        const tex=this.textures.createCanvas(scarKey,r.width,r.height)!;
        const frame=visual.main.frame;
        tex.context.drawImage(frame.source.image as CanvasImageSource,frame.cutX+r.x-r.width/2,frame.cutY+r.y-r.height/2,r.width,r.height,0,0,r.width,r.height);
        tex.refresh();
      }
      if(!scar){scar=this.add.sprite(0,0,key,0);visual.mounts.push(scar);visual.container.add(scar);}
      if(!emerging)scar.setTexture(scarKey).setDisplaySize(r.width*size/sourceSize,r.height*size/sourceSize).setPosition(m.offsetX,m.offsetY).setTint(0x302329);
      scar.setVisible(m.destroyed&&!emerging);
    }
  }

  private spawnEnemyShot(event: EnemyShotEvent): void {
    if(this.enemyShots.length>=84)return;
    const kind=event.kind??(event.sourceLayer?'surface':'scout');
    const art=kind==='talassarca'?'raia':kind==='raia'?'cutter':kind;
    const sizes={scout:18,dart:19,lancer:20,cutter:21,surface:18,raia:23,talassarca:24};
    const key='review-hostile-'+art;
    const bullet=this.acquireProjectile(event.x,event.y,key).setDisplaySize(sizes[kind],sizes[kind]).setDepth(18).play(key+'-loop');
    bullet.setRotation(Math.atan2(event.velocityY,event.velocityX)-Math.PI/2);
    const weight=event.weight??(kind==='scout'?'weak':kind==='dart'?'medium':'heavy');
    if(weight==='weak')bullet.setDisplaySize(12,12).setTint(0xb8a2dc);
    else if(weight==='heavy')bullet.setDisplaySize(23,23).setTint(0xffbe72);
    else if(weight==='special')bullet.setTint(0xff448b);
    this.enemyShots.push({weight:event.weight??(kind==='scout'?'weak':kind==='dart'?'medium':'heavy'),node:bullet,baseX:event.x,baseY:event.y,trail:[],ageMs:0,velocityX:event.velocityX,velocityY:event.velocityY,damage:kind==='talassarca'?25:kind==='cutter'?22:18,hitRadius:kind==='lancer'||kind==='talassarca'?4:3,sourceLayer:event.sourceLayer});
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
      if(!targetBefore.carrier&&(targetBefore.kind==='cutter'||targetBefore.maxHp>=5)){const hot=this.damageRegions.get(enemyId)?.strongest();this.explodeLayers(x,y,23,x+(hot?.x??0),y+(hot?.y??0));if(!targetBefore.layer&&enemyId%3===0)this.fallCorpse(this.enemyVisuals.get(enemyId)?.body);else this.fadeCorpse(this.enemyVisuals.get(enemyId)?.body);}
      this.damageRegions.delete(enemyId);
      if(targetBefore.carrier||targetBefore.maxHp<5){if(!targetBefore.carrier&&!targetBefore.layer&&enemyId%3===0)this.fallCorpse(this.enemyVisuals.get(enemyId)?.body);else this.playEffect('explosion',x,y,targetBefore.flight?.4:.65,targetBefore.layer||targetBefore.kind==='scout'?'organic':'metal');}
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
      const metallic=!targetBefore.layer&&targetBefore.kind!=='scout';
      this.playEffect('hit', impactX??x, impactY??y);
      this.particles.burst(impactX??x,impactY??y,.22,false,metallic?0xffce79:0xcc86ff);
      globalAudio.playHit(metallic?'metal':'alien');
    }
  }

  private advancePlayerShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const shot = this.shots[i];
      const fromX=shot.node.x,fromY=shot.node.y;
      if(shot.homing){
        const boss=this.director.boss;
        const targets=[...this.director.enemies.filter(e=>!e.submerged).map(e=>({x:e.x,y:e.y})),...(boss&&!['intro','metamorphosis','escape','submerged','emerge','defeated'].includes(boss.phase)?boss.name==='TALASSARCA'?(boss.modules??[]).filter(m=>!m.destroyed).map(m=>({x:boss.x+m.offsetX,y:boss.y+m.offsetY})):[{x:boss.x,y:boss.y}]:[])].filter(p=>p.y<shot.node.y+12);
        targets.sort((a,b)=>Math.hypot(a.x-shot.node.x,a.y-shot.node.y)-Math.hypot(b.x-shot.node.x,b.y-shot.node.y));
        const target=targets[0];if(target){const angle=Math.atan2(shot.velocityY,shot.velocityX),desired=Math.atan2(target.y-shot.node.y,target.x-shot.node.x),turn=Phaser.Math.Angle.Wrap(desired-angle),next=angle+Phaser.Math.Clamp(turn,-dt*.0032,dt*.0032),speed=Math.hypot(shot.velocityX,shot.velocityY);shot.velocityX=Math.cos(next)*speed;shot.velocityY=Math.sin(next)*speed;shot.node.setRotation(next+Math.PI/2);}
      }
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

      if(this.weapons.weaponLevel>=maxWeaponLevel(this.pilot.id)){
        for(let j=this.enemyShots.length-1;j>=0;j--){
          const hostile=this.enemyShots[j];if(hostile.weight!=='weak')continue;
          const t=segmentEllipseHit(fromX,fromY,shot.node.x-hostile.velocityX*dt/1000,shot.node.y-hostile.velocityY*dt/1000,hostile.node.x,hostile.node.y,shot.hitRadius+hostile.hitRadius,shot.hitRadius+hostile.hitRadius);
          if(t===null)continue;
          this.particles.burst(hostile.node.x,hostile.node.y,.2,false,0xc3fff1);
          this.releaseProjectile(hostile.node);this.enemyShots.splice(j,1);
        }
      }
      let collided = false;

      // Resolve crossings in physical order, including the boss and thin fast targets.
      const contacts:Array<{id:number|'boss';t:number;moduleId?:string}>=[];
      for(const enemy of this.director.enemies){
        if(enemy.submerged||shot.hitTargets?.has(enemy.id))continue;
        const visual=this.enemyVisuals.get(enemy.id);
        const t=visual?spriteContact(visual.body,fromX,fromY,shot.node.x,shot.node.y,shot.hitRadius):null;
        if(t!==null)contacts.push({id:enemy.id,t});
      }
      const boss=this.director.boss;
      if(boss&&!['intro','metamorphosis','escape','submerged','emerge','defeated'].includes(boss.phase)&&!shot.hitTargets?.has('boss')){
        const hit=this.bossPartContact(fromX,fromY,shot.node.x,shot.node.y,shot.hitRadius);
        if(hit)contacts.push({id:'boss',...hit});
      }
      contacts.sort((a,b)=>a.t-b.t);
      for(const contact of contacts){
        const x=fromX+(shot.node.x-fromX)*contact.t,y=fromY+(shot.node.y-fromY)*contact.t;
        shot.hitTargets?.add(contact.id);
        if(contact.id==='boss')this.applyBossDamage(shot.damage*NORMAL_BOSS_SHOT_SCALE*primaryBossFactor(this.pilot.id,boss!.name),x,y,false,contact.moduleId);
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
        this.releaseProjectile(shot.node);
        this.shots.splice(i, 1);
      }
    }
  }

  private bossPartContact(ax:number,ay:number,bx:number,by:number,radius:number):{t:number;moduleId?:string}|null {
    const boss=this.director.boss,visual=this.bossVisual;if(!boss||!visual)return null;
    if(!boss.modules?.length){const t=spriteContact(visual.main,ax,ay,bx,by,radius);return t===null?null:{t};}
    let first:{t:number;moduleId:string}|null=null;
    for(const r of combatBossRegions(boss)){
      if(boss.modules?.find(m=>m.id===r.id)?.destroyed)continue;
      const t=spriteContact(visual.main,ax,ay,bx,by,radius,r);
      if(t!==null&&(!first||t<first.t))first={t,moduleId:r.id};
    }
    return first;
  }
  private bossContact(ax:number,ay:number,bx:number,by:number,radius:number):number|null {
    return this.bossPartContact(ax,ay,bx,by,radius)?.t??null;
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
    if(boss&&!['intro','metamorphosis','escape','submerged','emerge','defeated'].includes(boss.phase)){
      // The ocean form is overflown; the aerial form and captain have solid body contact.
      if((boss.name!=='TALASSARCA'||boss.layer==='shell')&&this.bossVisual&&this.hullTouchesSprite(this.bossVisual.main))this.damageShip(35);
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
        this.releaseProjectile(shot.node);
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
      this.weapons = resetWeaponsOnRespawn(this.weapons);
      this.specialVisual?.destroy(); this.specialVisual=undefined;
      for(const d of this.orbitalDrones)d.node.destroy();this.orbitalDrones=[];globalAudio.stopCombatEffects();
      this.crimsonLaserRenderer.clear(); this.clearPlayerShots(); this.clearEnemyShots();
      globalAudio.playExplosion(true);
      this.playEffect('explosion', this.ship.x, this.ship.y);
      this.particles.burst(this.ship.x,this.ship.y,1.3,true,0xffa43b);
      this.vectorShip.setPosition(PLAYFIELD_X+PLAYFIELD_WIDTH/2,GAME_HEIGHT-65);
      this.hud.setWeapon(this.weapons.weaponFamily,1,0);
      this.hud.flash('NAVE ABATIDA · POTÊNCIA REINICIADA', '#ffca80',1200);
    } else if (outcome.event === 'game-over') {
      this.specialVisual?.destroy();this.specialVisual=undefined;
      for(const d of this.orbitalDrones)d.node.destroy();this.orbitalDrones=[];globalAudio.stopCombatEffects();
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
    if (deathPowerDropCount(this.weapons)) this.pickups.spawn('power', this.ship.x, this.ship.y - 30);
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
  private fallCorpse(body?:Phaser.GameObjects.Sprite):void {
    if(!body)return;const matrix=body.getWorldTransformMatrix();
    const falling=this.add.image(matrix.tx,matrix.ty,body.texture.key,body.frame.name).setDisplaySize(body.displayWidth,body.displayHeight).setDepth(3);
    const shadow=this.add.ellipse(matrix.tx+4,matrix.ty+5,body.displayWidth*.7,body.displayHeight*.35,0x020c10,.25).setDepth(-2);
    body.setVisible(false);
    this.tweens.add({targets:falling,y:falling.y+27,rotation:.7,scaleX:falling.scaleX*.45,scaleY:falling.scaleY*.45,alpha:.4,duration:650,
      onUpdate:()=>{shadow.setPosition(falling.x+5,falling.y+8);if(Math.floor(this.time.now/80)%2===0)this.particles.burst(falling.x,falling.y,.08,false,0x776c70);},
      onComplete:()=>{this.particles.burst(falling.x,falling.y,.65,true);this.playEffect('explosion',falling.x,falling.y,.6);shadow.destroy();falling.destroy();}});
  }

  private acquireProjectile(x:number,y:number,key:string):Phaser.GameObjects.Sprite {
    return (this.projectilePool.pop()??this.add.sprite(x,y,key,0)).setTexture(key,0).setPosition(x,y).setActive(true).setVisible(true).setAlpha(1).setOrigin(.5).clearTint().setRotation(0);
  }
  private releaseProjectile(node:Phaser.GameObjects.Sprite):void {
    node.stop().setVisible(false).setActive(false);
    if(this.projectilePool.length<128)this.projectilePool.push(node);else node.destroy();
  }

  private explodeLayers(x:number,y:number,radius:number,impactX=x,impactY=y,boss=false):void {
    for(const blast of destructionPlan(x,y,radius,impactX,impactY,boss))this.time.delayedCall(blast.delay,()=>{
      this.playEffect('explosion',blast.x,blast.y,blast.scale);
      this.particles.burst(blast.x,blast.y,blast.scale,false,blast.major?0xffbc5c:0xff793c);
      globalAudio.playExplosion(blast.major);
    });
  }

  private clearEnemyShots(): void {
    for (const shot of this.enemyShots) this.releaseProjectile(shot.node);
    this.enemyShots = [];
  }

  private clearPlayerShots(): void {
    for (const shot of this.shots) this.releaseProjectile(shot.node);
    this.shots = [];
  }
}
