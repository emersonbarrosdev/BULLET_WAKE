import Phaser from 'phaser';
import { ArcadeWorld, type Actor, type WorldEvent, type Controls } from './ArcadeWorld';
import { ArcadeBackdrop } from './ArcadeBackdrop';
import { ArcadeAudio } from './ArcadeAudio';
import { MISSIONS, type Encounter, type Family } from './content';
import { connectedPad, detectPadProfile, GamepadReader, padLabels, type PadProfile } from '../systems/gamepadInput';
import { globalSave } from '../systems/saveSystem';
import { globalAudio } from '../audio/audioSystem';
import { stageFlightSnapshot, type CampaignFlight } from '../systems/campaignFlight';
import { spriteContact } from '../render/SpriteSilhouette';
import { enableCombatResolution, getCombatVirtualSize, setCombatVirtualSize } from '../render/combatResolution';
import { clamp, sweepEllipse } from './geometry';
import { readArcadeProgress, recordArcadeClear } from './progress';
import { pelagicShotSize } from './PelagicPresentation';
import { rivetShotPresentation } from '../render/rivetPresentation';
import { SUPPLY_ART, SUPPLY_DRONE_BODY_ART, SUPPLY_DRONE_PROP_ART, SUPPLY_GLOW_ART, SUPPLY_SHADOW_ART, SUB_ART, BOMB_ART, BLAST_ART, SUB_HULL_ART, SUB_SUBMERGED_ART, SUB_PARTS_ART, installCombatArt, HitOverlays, BombArt, SubmarineBossArt } from './ArcadeCombatArt';
import { SUPPLY_DRONE_DISPLAY_SIZE, SUPPLY_DRONE_PROP_SIZE } from './SupplyDrone';
import { subTotalHp } from './PelagicSubmarineBoss';
import { EMPLACEMENT_TEXTURE, GUN_SMOKE_TEXTURE, TOWER_TEXTURE, PelagicEmplacements } from './PelagicEmplacements';
import { PelagicActorAnims, preloadPelagicActorAnims } from './PelagicActorAnims';
import { PELAGIC_RIVET_SHEET } from './PelagicActorAnimsMath';
import { preloadTideArchArt } from './PelagicTideArchArt';
import type { PelagicCheckpointSnapshot, TideArchPhase } from './PelagicTideArch';
import {
  PELAGIC_ENEMY_MISSILE_SHEET,
  PELAGIC_SUB_CLEAN_SHEET,
  PELAGIC_TOWER_CLEAN_SHEET,
  resolveHullVisualTransform,
} from './PelagicWeaponMounts';
import { PelagicComms } from './PelagicComms';
import { PelagicDesktopHud } from './PelagicDesktopHud';
import { DIFFICULTY_PROFILES, normalizeGameDifficulty, stepGameDifficulty } from './PelagicDifficulty';
import {
  TouchInputController,
  computeWorldSafeInsets,
  defaultTouchSettings,
  type SafeAreaInsets,
  type TouchControlSettings,
} from './TouchControls';
import {
  UI, UI_FONT, UI_TEX, UI_ICON, UI_PIP,
  preloadMenuAssets, installMenuAnims, makePanel, makeButtonBg, makeIcon,
  type SpriteButton,
} from './ArcadeMenuArt';
import {
  ArcadeMenuButton, makeMenuHintBar, makeStatusPill, playMenuScreenEntrance,
  type MenuButtonVariant,
} from './ArcadeMenuUI';
import {
  makePilotNameplate, makeVectorBanner, makeVectorGauge, makeVectorIconSprite, makeVectorKeycap,
  makeVectorPanel, makeVectorTogglePill, type VectorIconId,
} from './ArcadeMenuVector';
import {
  getPilotContract, listPilotContracts, perspectiveLabelPt, type PilotId,
} from './ArcadeContracts';
import { ACHIEVEMENTS } from './ArcadeAchievements';
import type { RunEvaluationResult } from './ArcadeRanking';
import {
  ArcadeProfileStore, HANGAR_CATALOG, globalProfileStore,
} from './ArcadeProfileStore';
import { stageDurationFor } from './PelagicProgression';
import { ReplayRecorder } from './ArcadeReplay';

type HangarTab = 'hangar' | 'achievements' | 'profile';
type RunOutcome = ReturnType<ArcadeProfileStore['recordRunResult']> & { evaluation: RunEvaluationResult };

type Screen = 'loading' | 'intro' | 'title' | 'pilot' | 'missions' | 'practice' | 'hangar' | 'play' | 'pause' | 'controls' | 'settings' | 'touch-settings' | 'credits' | 'confirm-exit' | 'result' | 'defeat' | 'ending';
type OpeningState = 'LOADING' | 'STUDIO_SPLASH' | 'MAIN_MENU' | 'READY';
type OpeningPhase = 'BOOT' | 'LOADING' | 'LOADING_COMPLETE' | 'STUDIO_SPLASH' | 'STUDIO_EXIT' | 'TITLE_READY' | 'TITLE_VISIBLE';
type ControlsTab = 'pc' | 'gamepad' | 'android';
type Effect = { sprite: Phaser.GameObjects.Sprite; age: number; duration: number; size: number; vx: number; vy: number; spin: number; };
type BonusPopup = { node: Phaser.GameObjects.Text; age: number; duration: number; y0: number; };
type MenuButton = { node: Phaser.GameObjects.Text; bg?: SpriteButton; modern?: ArcadeMenuButton; extras: Phaser.GameObjects.Text[]; action: () => void; onLeft?: () => void; onRight?: () => void; primaryGold?: boolean; titleSecondary?: boolean; disabled?: boolean; };
const FONT = UI_FONT;
const FAMILY_ORDER: Family[] = ['fighter', 'interceptor', 'acrobat', 'bomber', 'boat', 'ship', 'tank', 'tower'];
const BLUE = 0x16385b;
/** Cartoon presentation over one shared deterministic UP/SIDE simulation. Legacy content remains registered separately. */
export class ArcadeScene extends Phaser.Scene {
  world?: ArcadeWorld; screen: Screen = 'loading'; openingState: OpeningState = 'LOADING'; readonly openingHistory: OpeningState[] = ['LOADING']; openingPhase: OpeningPhase = 'BOOT'; readonly openingPhaseHistory: OpeningPhase[] = ['BOOT']; audio = new ArcadeAudio(); quality = 2;
  private backdrop!: ArcadeBackdrop; private pelagicDesktopHud!: PelagicDesktopHud; private ui!: Phaser.GameObjects.Container; private decor!: Phaser.GameObjects.Graphics; private combatInk!: Phaser.GameObjects.Graphics; private hud!: Phaser.GameObjects.Text; private radio!: Phaser.GameObjects.Text;
  private player!: Phaser.GameObjects.Sprite; private bossSprite!: Phaser.GameObjects.Sprite; private hero!: Phaser.GameObjects.Sprite; private logo!: Phaser.GameObjects.Sprite; private wingmen: Phaser.GameObjects.Sprite[] = [];
  private menuPlanes: Phaser.GameObjects.Sprite[] = [];
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private introWash!: Phaser.GameObjects.Rectangle; private introHalo!: Phaser.GameObjects.Sprite; private introCrest!: Phaser.GameObjects.Sprite; private introTitle!: Phaser.GameObjects.Text; private introSub!: Phaser.GameObjects.Text;
  private titleRevealVeil?: Phaser.GameObjects.Rectangle;
  private introSkipFade?: number;
  private loadStartMs = 0; private loadCompleteAtMs?: number; private loadRealProgress = 0; private loadVisualProgress = 0;
  private splashHandoffCommitted = false; private bootOverlayDismissed = false; private loadErrors: string[] = [];
  private controlsTab: ControlsTab = 'pc'; private lastControlsPadId = ''; private nextControlsFocus?: number; private controlsPadPreview: 'auto' | 'playstation' | 'xbox' = 'auto';
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>(); private cargoSprites = new Map<number, Phaser.GameObjects.Sprite>(); private cargoExtras = new Map<number, { shadow: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image; prop: Phaser.GameObjects.Sprite }>(); private partSprites = new Map<number, Phaser.GameObjects.Sprite>(); private bulletSprites: Phaser.GameObjects.Sprite[] = []; private effects: Effect[] = [];
  private bonusPopups: BonusPopup[] = []; private bonusPopupPool: Phaser.GameObjects.Text[] = [];
  private turrets = new Map<number, Phaser.GameObjects.Sprite>(); private effectPool: Phaser.GameObjects.Sprite[] = [];
  private controls!: Record<string, Phaser.Input.Keyboard.Key>; private pad = new GamepadReader(); buttons: MenuButton[] = []; private focus = 0;
  private menuActionLocked = false;
  private clock = 0; private introClock = 0; private accumulator = 0; private lastHud = ''; private messageUntil = 0; private pauseOrigin: Screen = 'pause'; private carried?: CampaignFlight; private currentMission = 0; private stageClearSaved = false;
  private touchController = new TouchInputController(globalSave.getSettings().touch);
  private touchGfx!: Phaser.GameObjects.Graphics; private touchFireText!: Phaser.GameObjects.Text; private touchChargeText!: Phaser.GameObjects.Text; private touchSpecialText!: Phaser.GameObjects.Text;
  private touchNodes: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private touchShown = false; private touchDeviceActive = false; private pauseBtn?: Phaser.GameObjects.Container;
  private suppressHeldFireUntilRelease = false;
  private suppressChargeUntilRelease = false;
  private suppressSpecialUntilRelease = false;
  private mute = false;
  private pelagicLevel!: Phaser.GameObjects.Text; private pelagicAssistBadge!: Phaser.GameObjects.Text; private pelagicCheckpointBadge!: Phaser.GameObjects.Text; private pelagicSpecialText!: Phaser.GameObjects.Text; private bossHudLabel!: Phaser.GameObjects.Text;
  private checkpointBannerUntil = 0; private activeCheckpointSnapshot?: PelagicCheckpointSnapshot; private portraitUpActive = false;
  private emplacements!: PelagicEmplacements; private hitOverlays!: HitOverlays; private bombArt!: BombArt; private subBossArt!: SubmarineBossArt;
  private pelagicAnims!: PelagicActorAnims; private pelagicComms = new PelagicComms(); private lastInput: Controls = { x: 0, y: 0, fire: false, special: false };
  private devSaveGuard = false; private devSimulationPaused = false; private devTimeScale = 1; private devWeaponDebug = false;
  private devEscapeHandler?: () => boolean; private devOverlayCallback?: (scene: ArcadeScene, deltaMs: number) => void;
  private selectedPilotId: PilotId = 'nolan';
  private hangarTab: HangarTab = 'hangar';
  private nextHangarFocus?: number;
  private practiceMission = 0;
  private lastRunOutcome?: RunOutcome;
  private replayRecorder?: ReplayRecorder;
  private shakeTime = 0;
  private shakeAmp = 0;
  private damageFlashAlpha = 0;
  private bossWarningUntil = 0;
  private firstSortieHintUntil = 0;
  private defeatRecorded = false;
  private vfxGfx!: Phaser.GameObjects.Graphics;
  private warningBannerText!: Phaser.GameObjects.Text;
  private sortieHintText!: Phaser.GameObjects.Text;
  constructor() { super('ArcadeScene'); }
  preload(): void {
    enableCombatResolution(this);
    const base = import.meta.env.BASE_URL;
    this.load.spritesheet('arc-ufo', `${base}assets/arcade/ufo.webp`, { frameWidth: 256, frameHeight: 256 });
    for (const [key, file] of [[SUPPLY_ART, 'supply-items'], [SUPPLY_DRONE_BODY_ART, 'supply-drone-body'], [SUPPLY_DRONE_PROP_ART, 'supply-drone-propeller'], [SUB_ART, 'submarines'], [BOMB_ART, 'bomb-flight'], [BLAST_ART, 'colossal-blast'], [SUB_HULL_ART, 'colossal-sub-hull'], [SUB_SUBMERGED_ART, 'colossal-sub-submerged'], [SUB_PARTS_ART, 'colossal-sub-parts']]) this.load.image(key, `${base}assets/arcade/pelagic-review/${file}.png`);
    this.load.image('arc-ocean', `${base}assets/arcade/ocean.webp`);
    this.load.image(EMPLACEMENT_TEXTURE, `${base}assets/arcade/pelagic-review/emplacements.png`);
    this.load.image(TOWER_TEXTURE, `${base}assets/arcade/pelagic-review/defense-tower.png`);
    this.load.image(GUN_SMOKE_TEXTURE, `${base}assets/arcade/pelagic-review/gun-smoke.png`);
    this.load.spritesheet('pelagic-coast', `${base}assets/arcade/pelagic-coast.webp`, { frameWidth: 512, frameHeight: 512 });
    this.load.spritesheet('pelagic-archipelago', `${base}assets/arcade/pelagic-archipelago.webp`, { frameWidth: 512, frameHeight: 512 });
    this.load.image('pelagic-water', `${base}assets/arcade/pelagic-water.webp`);
    this.load.spritesheet('pelagic-review-formations', `${base}assets/arcade/pelagic-review/formations.webp`, { frameWidth: 768, frameHeight: 768 });
    this.load.image('pelagic-coast-harbor-v2', `${base}assets/arcade/pelagic-review/coast-harbor-v2.png`);
    this.load.image('pelagic-coast-leisure-v2', `${base}assets/arcade/pelagic-review/coast-leisure-v3.png`);
    this.load.image('pelagic-water-review', `${base}assets/arcade/pelagic-review/water.webp`);
    this.load.spritesheet('pelagic-wakes', `${base}assets/arcade/pelagic-review/wakes.webp`, { frameWidth: 256, frameHeight: 512 }); this.load.spritesheet('pelagic-seagulls', `${base}assets/arcade/pelagic-review/seagulls.webp`, { frameWidth: 128, frameHeight: 128 });
    this.load.image('arc-stage1-hud-left', `${base}assets/arcade/stage1-hud-left.webp`);
    this.load.image('arc-stage1-hud-right', `${base}assets/arcade/stage1-hud-right.webp`);
    for (const name of ['rivet', 'enemies', 'pilots', 'scenery']) this.load.spritesheet('arc-' + name, `${base}assets/arcade/${name}.webp`, { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('arc-boss', `${base}assets/arcade/boss.webp`, { frameWidth: 512, frameHeight: 512 });
    this.load.spritesheet('arc-red', `${base}assets/combat-hd/polish/rivet-red.webp`, { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('arc-explosion', `${base}assets/arcade/explosion.webp`, { frameWidth: 256, frameHeight: 256 });
    this.load.spritesheet('arc-missile', `${base}assets/combat-hd/review/effects-missile.webp`, { frameWidth: 128, frameHeight: 128 });
    preloadPelagicActorAnims(this, base);
    preloadTideArchArt(this, base);
    preloadMenuAssets(this, base);
    this.cameras.main.setBackgroundColor('#040d21');
    this.loadStartMs = performance.now();
    this.loadCompleteAtMs = undefined;
    this.loadRealProgress = 0;
    this.loadVisualProgress = 0;
    this.splashHandoffCommitted = false;
    this.bootOverlayDismissed = false;
    this.loadErrors = [];
    this.openingState = 'LOADING';
    this.setOpeningPhase('LOADING');
    this.updateBootLoadingOverlay(0, true);
    this.load.on('progress', (n: number) => {
      this.loadRealProgress = Math.max(this.loadRealProgress, clamp(n, 0, 1));
      const elapsed = Math.max(0, (performance.now() - this.loadStartMs) / 1000);
      this.syncLoadVisual(Math.min(this.loadRealProgress * 0.98, clamp(elapsed / 0.55, 0.02, 0.98)));
    });
    this.load.on('loaderror', (file: { key?: string; url?: string }) => {
      this.loadErrors.push(String(file?.url ?? file?.key ?? 'unknown'));
    });
    this.load.once('complete', () => { this.loadRealProgress = 1; });
  }
  private setOpeningPhase(phase: OpeningPhase): void {
    if (this.openingPhase === phase) return;
    this.openingPhase = phase;
    if (this.openingPhaseHistory.at(-1) !== phase) this.openingPhaseHistory.push(phase);
  }
  private updateBootLoadingOverlay(p: number, visible: boolean): void {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('bw-boot-loading');
    const fill = document.getElementById('bw-boot-fill');
    const pct = document.getElementById('bw-boot-pct');
    if (!root) return;
    if (visible) {
      this.bootOverlayDismissed = false;
      root.classList.remove('bw-hidden');
      root.setAttribute('aria-hidden', 'false');
      const pctVal = Math.round(clamp(p, 0, 1) * 100);
      if (fill) fill.style.width = `${pctVal}%`;
      if (pct) pct.textContent = `${pctVal}%`;
    } else {
      this.bootOverlayDismissed = true;
      root.classList.add('bw-hidden');
      root.setAttribute('aria-hidden', 'true');
    }
  }
  private criticalOpeningAssetsReady(): boolean {
    return [UI_TEX.logo, UI_TEX.skyPanorama, UI_TEX.wingmenAnim, UI_TEX.menuHeliSide, UI_TEX.menuHeliPatrolSide, UI_TEX.padDualSense, UI_TEX.mobileLandscape, UI_TEX.icons, UI_TEX.glow, UI_TEX.hudPelagicSky, UI_TEX.hudBayekPortrait, UI_TEX.hudRoutePelagic]
      .every(key => this.textures.exists(key));
  }
  private syncLoadVisual(p: number, visible = true): void {
    const shown = clamp(Math.max(this.loadVisualProgress, p), 0, 1);
    this.loadVisualProgress = shown;
    this.updateBootLoadingOverlay(shown, visible);
  }
  private destroyLoadOverlay(): void {
    this.updateBootLoadingOverlay(1, false);
  }
  create(): void {
    enableCombatResolution(this); this.input.addPointer(3);
    this.controls = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,X,Z,SHIFT,ESC,ENTER,ONE,TWO,THREE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER']);
    this.selectedPilotId = globalProfileStore.getProfile().selectedPilotId;
    const settings = globalSave.getSettings(); this.mute = settings.isMuted; this.audio.setMix(settings.musicVolume, settings.sfxVolume, this.mute);
    try { const stored = localStorage.getItem('bullet_wake_visual'); if (stored !== null) this.quality = clamp(Number(stored) || 0, 0, 2); } catch {/* Optional preference. */ }
    installCombatArt(this); installMenuAnims(this); this.hitOverlays = new HitOverlays(this); this.bombArt = new BombArt(this); this.subBossArt = new SubmarineBossArt(this);
    this.pelagicAnims = new PelagicActorAnims(this);
    this.backdrop = new ArcadeBackdrop(this); this.emplacements = new PelagicEmplacements(this); this.decor = this.add.graphics().setDepth(40); this.combatInk = this.add.graphics().setDepth(12);
    this.vfxGfx = this.add.graphics().setDepth(52);
    this.warningBannerText = this.add.text(384, 108, '', { fontFamily: FONT, fontSize: '13.5px', fontStyle: 'bold', color: '#ffe654', stroke: '#3a0612', strokeThickness: 3.5, align: 'center' }).setResolution(2).setOrigin(.5).setDepth(53).setVisible(false);
    this.sortieHintText = this.add.text(384, 416, '', { fontFamily: FONT, fontSize: '8.5px', fontStyle: 'bold', color: '#c8f4ff', stroke: '#04122e', strokeThickness: 2.5, align: 'center' }).setResolution(2).setOrigin(.5).setDepth(53).setVisible(false);
    // Illustrated left cockpit frame (160px on PC horizontal; hidden in Android vertical). Right HUD panel removed per Task 21.
    this.pelagicDesktopHud = new PelagicDesktopHud(this);
    this.player = this.add.sprite(384, 350, 'arc-rivet', 1).setDisplaySize(31, 38).setDepth(18).setVisible(false);
    this.bossSprite = this.add.sprite(384, 100, 'arc-boss').setDepth(3).setVisible(false);
    this.hero = this.add.sprite(384, 246, UI_TEX.rivetCruise, 0).setDisplaySize(196, 196).setDepth(2).setVisible(false);
    this.logo = this.add.sprite(384, 116, UI_TEX.logo).setDisplaySize(292, 208).setDepth(5).setVisible(false);
    for (let i = 0; i < 5; i++)this.lifeIcons.push(this.add.image(447 + i * 17, 19, 'arc-rivet', 1).setDisplaySize(15, 19).setDepth(46).setVisible(false));
    for (let i = 0; i < 3; i++)this.wingmen.push(this.add.sprite(-100, 100, UI_TEX.wingmenAnim, i * 4).setDisplaySize(40, 40).setDepth(1.6).setVisible(false));
    // Only the 3 approved wingman aircraft (blue prop, yellow jet, pink prop) fly across the Title Screen one at a time.
    this.menuPlanes.push(
      this.add.sprite(-120, 92, UI_TEX.wingmenAnim, 0).setDisplaySize(58, 58).setDepth(2.0).setVisible(false).play('ui-wingman-0'),
      this.add.sprite(-120, 140, UI_TEX.wingmenAnim, 4).setDisplaySize(56, 56).setDepth(2.0).setVisible(false).play('ui-wingman-1'),
      this.add.sprite(-120, 168, UI_TEX.wingmenAnim, 8).setDisplaySize(58, 58).setDepth(2.0).setVisible(false).play('ui-wingman-2'),
    );
    this.installIntroActors();
    this.ui = this.add.container(0, 0).setDepth(60);
    this.hud = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffffff', stroke: '#153550', strokeThickness: 3 }).setResolution(2).setDepth(45);
    this.pelagicLevel = this.add.text(408, 14.5, '', { fontFamily: FONT, fontSize: '11.5px', fontStyle: 'bold italic', color: '#ffffff', stroke: '#04122b', strokeThickness: 2.8 }).setResolution(2).setOrigin(0, .5).setDepth(45).setVisible(false);
    this.pelagicAssistBadge = this.add.text(648, 14.5, 'ASSISTIDO', { fontFamily: FONT, fontSize: '8.5px', fontStyle: 'bold italic', color: '#8cfff3', stroke: '#041430', strokeThickness: 2 }).setResolution(2).setOrigin(.5).setDepth(46).setVisible(false);
    this.pelagicCheckpointBadge = this.add.text(384, 44, 'CHECKPOINT ALCANÇADO', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#ffe654', backgroundColor: '#061c40', padding: { x: 10, y: 4 }, stroke: '#041430', strokeThickness: 3 }).setResolution(2).setOrigin(.5).setDepth(48).setVisible(false);
    this.pelagicSpecialText = this.add.text(224, 15, '', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#ffe159', stroke: '#041430', strokeThickness: 2 }).setResolution(2).setOrigin(0, .5).setDepth(46).setVisible(false);
    this.bossHudLabel = this.add.text(207, 16, '', { fontFamily: FONT, fontSize: '9.5px', fontStyle: 'bold', color: '#ffe654', stroke: '#041430', strokeThickness: 2 }).setResolution(2).setOrigin(0, .5).setDepth(46).setVisible(false);
    this.radio = this.add.text(384, 66, '', { fontFamily: FONT, fontSize: '12px', color: '#16385b', backgroundColor: '#fff7cb', padding: { x: 8, y: 5 }, wordWrap: { width: 280 }, align: 'center' }).setResolution(2).setOrigin(.5).setDepth(48).setVisible(false);
    for (let i = 0; i < 960; i++)this.bulletSprites.push(this.add.sprite(0, 0, 'arc-red').setVisible(false).setDepth(19.5));
    this.makeOrbTextures(); this.installTouch(); this.show('loading');
    const blur = () => { this.touchController.clearAll(); this.input.keyboard?.resetKeys(); this.renderTouchOverlay(); if (this.screen === 'play') this.show('pause'); };
    const onResize = () => { this.touchController.clearAll(); this.syncResponsiveViewport(); this.refreshTouchLayout(); };
    window.addEventListener('blur', blur);
    const visibility = () => { if (document.hidden) blur(); };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      this.audio.stop(); globalAudio.stopCombatEffects();
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      this.scale.off('resize', onResize);
      this.backdrop.destroy(); this.pelagicAnims?.destroy();
    });
  }
  private makeOrbTextures(): void {
    // Sonic Wings-inspired circular orange-red energy orbs with hot yellow-white core, sharp dark-red rim, and subtle halo
    const size = 64;
    const mid = size * 0.5;
    for (const i of [0, 1, 2]) {
      const tex = this.textures.createCanvas('arc-orb-' + i, size, size)!;
      const c = tex.context;
      c.clearRect(0, 0, size, size);

      // 1. Subtle outer thermal glow (does not inflate gameplay hitbox)
      const halo = c.createRadialGradient(mid, mid, 21.5, mid, mid, 31.2);
      halo.addColorStop(0, 'rgba(255, 86, 18, 0.40)');
      halo.addColorStop(0.52, 'rgba(255, 52, 8, 0.16)');
      halo.addColorStop(1, 'rgba(200, 18, 0, 0)');
      c.fillStyle = halo;
      c.beginPath();
      c.arc(mid, mid, 31.2, 0, Math.PI * 2);
      c.fill();

      // 2. Crisp dark-crimson outline ring for immediate contrast over blue ocean, foam, islands & explosions
      c.fillStyle = '#5c0602';
      c.beginPath();
      c.arc(mid, mid, 24.4, 0, Math.PI * 2);
      c.fill();

      // 3. Spherical orange-red energy core smoothly radiating from bright near-white yellow center
      const coreTint = i === 2 ? '#ffe96b' : i === 1 ? '#fff294' : '#fff7ae';
      const midOrange = i === 2 ? '#ff640c' : i === 1 ? '#ff7c10' : '#ff8c14';
      const body = c.createRadialGradient(mid, mid, 0.8, mid, mid, 22.8);
      body.addColorStop(0, '#ffffff');
      body.addColorStop(0.24, coreTint);
      body.addColorStop(0.50, midOrange);
      body.addColorStop(0.80, '#ea2b08');
      body.addColorStop(1, '#8c0d04');
      c.fillStyle = body;
      c.beginPath();
      c.arc(mid, mid, 22.8, 0, Math.PI * 2);
      c.fill();

      tex.refresh();
    }
  }
  private text(x: number, y: number, text: string, size = 18, color = '#f4faff', opts?: { stroke?: string; strokeThickness?: number; align?: string; wrap?: number; originX?: number; originY?: number }): Phaser.GameObjects.Text {
    const node = this.add.text(x, y, text, {
      fontFamily: FONT, fontSize: size + 'px', fontStyle: 'bold', color,
      stroke: opts?.stroke ?? '#061938', strokeThickness: opts?.strokeThickness ?? 3,
      align: opts?.align ?? 'center', wordWrap: { width: opts?.wrap ?? 640 },
    }).setResolution(2).setOrigin(opts?.originX ?? .5, opts?.originY ?? .5);
    this.ui.add(node); return node;
  }
  private isPreGameplayMenu(): boolean {
    return ['title', 'pilot', 'missions', 'practice', 'hangar', 'controls', 'settings', 'touch-settings', 'credits', 'pause', 'confirm-exit', 'result', 'defeat', 'ending'].includes(this.screen);
  }
  private button(
    x: number, y: number, label: string, action: () => void, width = 230, height = 38,
    opts?: {
      fontSize?: number; extras?: Phaser.GameObjects.Text[]; onLeft?: () => void; onRight?: () => void;
      noLabel?: boolean; primaryGold?: boolean; titleSecondary?: boolean;
      variant?: MenuButtonVariant; icon?: VectorIconId; disabled?: boolean; activeTab?: boolean; showArrows?: boolean;
    },
  ): MenuButton {
    const index = this.buttons.length;
    if (this.isPreGameplayMenu()) {
      const variant: MenuButtonVariant = opts?.variant
        ?? (opts?.noLabel ? 'optionRow' : opts?.primaryGold ? 'primary' : 'secondary');
      const runGuarded = () => {
        if (this.menuActionLocked || opts?.disabled) return;
        this.audio.unlock();
        if (variant !== 'tab') globalAudio.playArcade('confirm');
        else globalAudio.playArcade('navigate');
        if (variant !== 'tab' && !(opts?.onLeft && opts?.onRight)) this.menuActionLocked = true;
        action();
      };
      const modern = new ArcadeMenuButton(this, {
        x, y, width, height, label, variant,
        icon: opts?.icon,
        fontSize: opts?.fontSize,
        disabled: opts?.disabled,
        activeTab: opts?.activeTab,
        noLabel: opts?.noLabel,
        showArrows: opts?.showArrows ?? !!(opts?.onLeft && opts?.onRight),
        parent: this.ui,
        onFocus: () => {
          if (this.menuActionLocked) return;
          if (this.focus !== index) {
            this.focus = index;
            this.focusButtons();
            globalAudio.playArcade('navigate');
          }
        },
        onClick: runGuarded,
        onLeft: opts?.onLeft ? () => { this.audio.unlock(); opts.onLeft!(); } : undefined,
        onRight: opts?.onRight ? () => { this.audio.unlock(); opts.onRight!(); } : undefined,
      });
      const item: MenuButton = {
        node: modern.node, modern, extras: opts?.extras ?? [], action,
        onLeft: opts?.onLeft, onRight: opts?.onRight,
        primaryGold: opts?.primaryGold, titleSecondary: opts?.titleSecondary, disabled: opts?.disabled,
      };
      this.buttons.push(item); return item;
    }
    const bg = makeButtonBg(this, x, y, width, height, this.ui, !!opts?.primaryGold);
    const node = this.text(x, y + 1, opts?.noLabel ? '' : label, opts?.fontSize ?? 14, opts?.primaryGold ? '#081e40' : UI.white, { stroke: opts?.primaryGold ? '#fff4ad' : '#061938', strokeThickness: opts?.primaryGold ? 2 : 3 });
    const zone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true }); this.ui.add(zone);
    zone.on('pointerover', () => { if (this.focus !== index) { this.focus = index; this.focusButtons(); } });
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.audio.unlock(); this.focus = index; this.focusButtons(); globalAudio.playArcade('confirm');
      const btn = this.buttons[index];
      if (btn?.onLeft && btn?.onRight) {
        const q = this.cameras.main.getWorldPoint(p.x, p.y);
        if (q.x < x - width * .12) btn.onLeft(); else if (q.x > x + width * .12) btn.onRight(); else btn.action();
        return;
      }
      action();
    });
    const item: MenuButton = { node, bg, extras: opts?.extras ?? [], action, onLeft: opts?.onLeft, onRight: opts?.onRight, primaryGold: opts?.primaryGold, titleSecondary: opts?.titleSecondary };
    this.buttons.push(item); return item;
  }
  private focusButtons(immediate = false): void {
    this.buttons.forEach((b, i) => {
      const on = i === this.focus;
      if (b.modern) {
        b.modern.extras = b.extras;
        b.modern.setFocused(on, immediate);
        return;
      }
      if (!b.bg) return;
      if (b.primaryGold) {
        b.bg.setFocused(on);
        b.node.setColor('#081e40').setStroke('#fff4ad', 2.2).setScale(on ? 1.04 : 1);
        b.extras.forEach(t => t.setColor('#081e40').setStroke('#fff4ad', 2));
        return;
      }
      if (b.titleSecondary) {
        b.bg.setFocused(false);
        b.bg.idle.setTint(on ? 0x99efff : 0xffffff);
        b.node.setColor(on ? '#ffdf5a' : UI.white).setStroke('#061938', 3).setScale(on ? 1.04 : 1);
        b.extras.forEach(t => t.setColor(on ? '#ffdf5a' : UI.cyanHex).setStroke('#061938', 3));
        return;
      }
      b.bg.setFocused(on);
      b.node.setColor(on ? '#081e40' : UI.white).setStroke(on ? '#fff4ad' : '#061938', on ? 2 : 3).setScale(on ? 1.03 : 1);
      b.extras.forEach(t => t.setColor(on ? '#081e40' : UI.cyanHex).setStroke(on ? '#fff4ad' : '#061938', on ? 2 : 3));
    });
  }
  private addModalBackdrop(tint = 0x031129, alpha = .52, withScanline = true): void {
    this.ui.add(this.add.rectangle(384, 216, 768, 432, tint, alpha));
    if (withScanline && this.quality >= 1) {
      this.ui.add(this.add.tileSprite(384, 216, 768, 432, UI_TEX.scanline).setAlpha(.28));
    }
  }
  private addConfetti(): void {
    if (this.quality < 1) return;
    this.ui.add(this.add.particles(384, -10, UI_TEX.confetti, {
      x: { min: -340, max: 340 }, speedY: { min: 55, max: 115 }, speedX: { min: -28, max: 28 },
      rotate: { min: 0, max: 360 }, scale: { start: .85, end: .4 }, alpha: { start: .9, end: .2 },
      lifespan: 4400, frequency: 110, quantity: 1, tint: [UI.gold, UI.cyan, UI.crimson, 0xffffff],
    }));
  }
  private isPortraitMobileMode(): boolean {
    if (typeof window === 'undefined') return false;
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const touchCapable = this.touchDeviceActive || matchMedia('(pointer: coarse)').matches || (('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 900);
    return portrait && touchCapable;
  }
  private portraitCanvasHeight(): number {
    if (typeof window === 'undefined' || window.innerWidth <= 0) return 682;
    return clamp(Math.round((384 * window.innerHeight) / window.innerWidth), 600, 860);
  }
  private syncResponsiveViewport(): void {
    const mobilePortrait = this.isPortraitMobileMode();
    const usePortraitPlay = this.screen === 'play' && !!this.world?.up && mobilePortrait;
    const usePortraitTitle = !this.world && this.screen === 'title' && mobilePortrait;
    if (typeof document !== 'undefined') {
      document.body.dataset.requireLandscape = (!!this.world && !this.world.up) ? 'true' : 'false';
    }
    this.portraitUpActive = usePortraitPlay;
    const targetH = this.portraitCanvasHeight();
    if (usePortraitPlay) {
      setCombatVirtualSize(this, 384, targetH);
    } else if (usePortraitTitle) {
      setCombatVirtualSize(this, 384, targetH, 384, 152);
    } else {
      setCombatVirtualSize(this, 768, 432);
    }
    if (this.world?.up) {
      const inGameScreen = ['play', 'pause', 'controls', 'settings', 'touch-settings', 'confirm-exit', 'result', 'defeat'].includes(this.screen);
      this.pelagicDesktopHud?.setVisible(inGameScreen && !usePortraitPlay);
      this.pelagicAssistBadge?.setVisible(inGameScreen && !!this.world.isAssisted && !usePortraitPlay);
      this.world.setArenaBounds(
        usePortraitPlay
          ? { left: 0, right: 384, top: 34, bottom: targetH - 14 }
          : { left: 160, right: 608, top: 18, bottom: 424 },
      );
      this.lastHud = '';
    }
    if (usePortraitPlay && this.touchGfx) {
      this.touchDeviceActive = true;
      this.setTouchVisible(true);
    }
  }
  show(screen: Screen): void {
    const old = this.screen; this.screen = screen;
    this.syncResponsiveViewport();
    if (screen !== 'loading' && screen !== 'intro') this.destroyLoadOverlay();
    this.titleRevealVeil?.destroy(); this.titleRevealVeil = undefined;
    if (screen === 'loading') {
      this.openingState = 'LOADING';
      this.setOpeningPhase(this.loadCompleteAtMs !== undefined ? 'LOADING_COMPLETE' : 'LOADING');
    } else if (screen === 'intro') {
      this.openingState = 'STUDIO_SPLASH';
      this.setOpeningPhase('STUDIO_SPLASH');
    } else if (screen === 'title') {
      this.openingState = 'MAIN_MENU';
      this.setOpeningPhase(old === 'intro' ? 'TITLE_READY' : 'TITLE_VISIBLE');
    } else {
      this.openingState = 'READY';
    }
    if (this.openingHistory.at(-1) !== this.openingState) this.openingHistory.push(this.openingState);
    if (old !== screen && !['loading', 'intro', 'play'].includes(screen) && old !== 'loading' && old !== 'intro') globalAudio.playArcade('navigate');
    this.tweens.killAll(); this.ui.removeAll(true); this.ui.setAlpha(1).setPosition(0, 0); this.pauseBtn = undefined; this.buttons = []; this.focus = 0; this.menuActionLocked = false; this.hideIntroActors();
    this.ui.setVisible(!['loading', 'intro'].includes(screen));
    if (screen === 'result' || screen === 'defeat') { this.messageUntil = 0; this.radio.setVisible(false); }
    if (screen !== 'play') { this.touchController.clearAll(); this.pelagicAnims?.hide(); this.clearBonusPopups(); }
    const game = ['play', 'pause', 'controls', 'settings', 'touch-settings', 'confirm-exit', 'result', 'defeat'].includes(screen) && !!this.world;
    const stage1Hud = game && !!this.world?.up;
    const showPcPanel = stage1Hud && !this.portraitUpActive;
    this.pelagicDesktopHud.setVisible(showPcPanel); this.pelagicLevel.setVisible(stage1Hud);
    this.pelagicSpecialText?.setVisible(stage1Hud && this.portraitUpActive);
    this.pelagicAssistBadge.setVisible(stage1Hud && !!this.world?.isAssisted && !this.portraitUpActive);
    if (!showPcPanel && !['result', 'defeat'].includes(screen) && this.world?.up) this.radio.setVisible(false);
    const showTitleScene = !game && screen === 'title';
    this.hero.setVisible(false);
    this.logo.setVisible(showTitleScene);
    this.wingmen.forEach(s => s.setVisible(false));
    this.menuPlanes.forEach(s => s.setVisible(showTitleScene));
    if (!showTitleScene) this.menuPlanes.forEach(s => s.setVisible(false));
    if (screen === 'pause') { this.audio.pause(); this.pauseOrigin = 'pause'; this.input.keyboard?.resetKeys(); }
    if (screen === 'play' && old !== 'play') {
      this.audio.resume();
      this.accumulator = 0;
      this.suppressHeldFireUntilRelease = true;
      this.suppressChargeUntilRelease = true;
      this.suppressSpecialUntilRelease = true;
    }

    if (screen === 'loading' || screen === 'intro') {
      this.audio.stop();
      if (screen === 'intro') {
        this.introClock = 0;
        this.introSkipFade = undefined;
        this.renderIntro();
        if (!this.bootOverlayDismissed) {
          // Atomic handoff: dismiss DOM loading layer only after WebGL paints BOTAN STUDIO frame.
          this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
            if (this.screen === 'intro' && !this.bootOverlayDismissed) {
              this.destroyLoadOverlay();
            }
          });
        }
      }
    } else if (screen === 'title') {
      this.audio.play('menu');
      const prof = globalProfileStore.getProfile();
      const b0 = this.button(384, 242, 'INICIAR JORNADA', () => this.show('pilot'), 192, 26, { fontSize: 11.5, variant: 'primary' });
      const b1 = this.button(384, 276, 'CONTROLES', () => { this.pauseOrigin = 'title'; this.show('controls'); }, 192, 26, { fontSize: 11.5, variant: 'secondary' });
      const b2 = this.button(384, 310, 'OPÇÕES', () => { this.pauseOrigin = 'title'; this.show('settings'); }, 192, 26, { fontSize: 11.5, variant: 'secondary' });
      const b3 = this.button(384, 344, 'CRÉDITOS', () => this.show('credits'), 192, 26, { fontSize: 11.5, variant: 'secondary' });
      let b4: MenuButton | undefined;
      if (!this.isPortraitMobileMode()) {
        makeStatusPill(this, this.ui, 682, 18, `${prof.wallet.credits} CR  •  ${Object.keys(prof.achievements).length}/${ACHIEVEMENTS.length}`, UI.cyan, '#9aefff');
        b4 = this.button(682, 42, 'HANGAR / PERFIL', () => { this.hangarTab = 'hangar'; this.show('hangar'); }, 144, 22, { fontSize: 9.5, variant: 'secondary' });
        const hint = makeMenuHintBar(this, this.ui, 417, connectedPad()?.id, { noBack: true });
        hint.setAlpha(0);
        this.tweens.add({ targets: hint, alpha: 1, duration: 260, delay: 140, ease: 'Sine.easeOut' });
      }
      [b0, b1, b2, b3, ...(b4 ? [b4] : [])].forEach((btn, idx) => btn.modern?.animateEntrance(idx * 34, 0, 8));
      if (old === 'intro') {
        const vSize = getCombatVirtualSize(this);
        const veil = this.add.rectangle(vSize.w * 0.5, vSize.h * 0.5, vSize.w + 16, vSize.h + 16, 0x040d21, 1).setDepth(85);
        this.titleRevealVeil = veil;
        this.tweens.add({
          targets: veil, alpha: 0, duration: 340, ease: 'Sine.easeOut',
          onComplete: () => {
            if (this.titleRevealVeil === veil) this.titleRevealVeil = undefined;
            veil.destroy();
            if (this.screen === 'title') this.setOpeningPhase('TITLE_VISIBLE');
          },
        });
      } else {
        this.setOpeningPhase('TITLE_VISIBLE');
      }
    } else if (screen === 'credits') {
      this.addModalBackdrop(0x030e24, .62, false);
      makeVectorPanel(this, this.ui, 384, 208, 650, 344, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 36, 210, 32, 'CRÉDITOS', { fontSize: 15.5 });

      // Left sub-panel: Studio & Core Direction
      makeVectorPanel(this, this.ui, 218, 194, 276, 226, { kind: 'sub' });
      makeIcon(this, 218, 118, UI_ICON.botan, 48, this.ui);
      this.text(218, 152, 'BOTAN STUDIO', 14.5, UI.goldHex);
      this.text(218, 169, 'BULLET WAKE  •  VERSÃO 0.1.0', 8.5, UI.cyanHex);
      const leftSep = this.add.graphics().lineStyle(1, UI.cyan, 0.28).lineBetween(118, 184, 318, 184);
      this.ui.add(leftSep);
      const leftCredits: [string, string, number][] = [
        ['DIREÇÃO E CRIAÇÃO', 'Emerson Barros', 206],
        ['GAME DESIGN E BALANCEAMENTO', 'Emerson Barros', 240],
        ['PROGRAMAÇÃO E ARQUITETURA', 'Emerson Barros', 274],
      ];
      for (const [role, person, cy] of leftCredits) {
        this.text(218, cy - 8, role, 7.8, UI.cyanHex);
        this.text(218, cy + 5, person, 11, UI.white);
      }

      // Right sub-panel: Production, Audio, Platforms & Tech
      makeVectorPanel(this, this.ui, 530, 194, 316, 226, { kind: 'sub' });
      const rightCredits: [string, string, number][] = [
        ['DIREÇÃO DE ARTE E CENÁRIOS', 'Botan Studio  •  Estilo Cartoon / Anime', 108],
        ['TRILHA SONORA E EFEITOS (SFX)', 'Botan Studio Audio  •  Web Audio Synth', 142],
        ['CONTROLES E PLATAFORMAS', 'PC Teclado  •  PlayStation  •  Xbox  •  Android', 176],
        ['TECNOLOGIA E ENGINE', 'Phaser 4  •  TypeScript  •  Vite  •  WebGL', 210],
      ];
      for (const [role, detail, cy] of rightCredits) {
        this.text(530, cy - 8, role, 7.8, UI.goldHex);
        this.text(530, cy + 5, detail, 9, UI.silver, { wrap: 290 });
      }
      const rightSep = this.add.graphics().lineStyle(1, UI.cyan, 0.25).lineBetween(404, 234, 656, 234);
      this.ui.add(rightSep);
      this.text(530, 250, 'AGRADECIMENTO ESPECIAL', 7.8, UI.goldHex);
      this.text(530, 274, 'Aos fãs de shoot \'em ups arcade clássicos e a todos\nque acompanham a evolução de Bullet Wake.', 8.8, UI.silver, { wrap: 288 });

      const cBack = this.button(384, 344, 'VOLTAR', () => this.show('title'), 188, 30, { fontSize: 12, variant: 'back' });
      cBack.modern?.animateEntrance(60, 0, 8);
      makeMenuHintBar(this, this.ui, 417, connectedPad()?.id);
      playMenuScreenEntrance(this, this.ui, 210);
    } else if (screen === 'pilot') {
      if (old !== 'pilot') this.audio.play('select');
      this.addModalBackdrop(0x030d22, .60, false);
      makeVectorPanel(this, this.ui, 384, 214, 672, 356, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 36, 260, 32, 'ESCOLHA SEU PILOTO', { fontSize: 15 });

      const pilots = listPilotContracts();
      const activeIdx = Math.max(0, pilots.findIndex(p => p.id === this.selectedPilotId));
      const activePilot = pilots[activeIdx] ?? pilots[0];
      const profile = globalProfileStore.getProfile();
      const isUnlocked = globalProfileStore.isPilotUnlocked(activePilot.id);
      const canAfford = profile.wallet.credits >= activePilot.creditCost;

      const stepPilot = (dir: -1 | 1) => {
        const next = pilots[(activeIdx + dir + pilots.length) % pilots.length];
        this.selectedPilotId = next.id;
        if (globalProfileStore.isPilotUnlocked(next.id)) globalProfileStore.selectPilot(next.id);
        this.menuActionLocked = false;
        this.show('pilot');
      };

      // Portrait frame (left) with clean integrated nameplate
      makeVectorPanel(this, this.ui, 134, 130, 122, 122, { kind: isUnlocked ? 'gold' : 'sub', cut: 10 });
      const bigPortraitFrame = activePilot.id === 'nolan' ? 3 : activePilot.portraitFrame;
      this.ui.add(this.add.image(134, 126, 'arc-pilots', bigPortraitFrame).setDisplaySize(100, 100).setAlpha(isUnlocked ? 1 : .58));
      if (!isUnlocked) makeVectorIconSprite(this, this.ui, 174, 84, 'lock', 18, UI.goldHex);
      makePilotNameplate(this, this.ui, 134, 189, 108, 20, activePilot.name.toUpperCase());

      // Hangar bay (center) — displays active ship with distinct livery tint
      makeVectorPanel(this, this.ui, 336, 114, 214, 84, { kind: 'sub', cut: 10 });
      const bay = this.add.graphics()
        .lineStyle(0.9, UI.cyan, .22).strokeCircle(336, 114, 32).strokeCircle(336, 114, 18)
        .lineStyle(0.7, UI.cyan, .18).lineBetween(282, 114, 390, 114).lineBetween(336, 78, 336, 150);
      this.ui.add(bay);
      const radarPulse = this.add.graphics().lineStyle(1.4, UI.cyan, 0.55).strokeCircle(0, 0, 15).setPosition(336, 114);
      this.ui.add(radarPulse);
      this.tweens.add({ targets: radarPulse, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 1650, repeat: -1, ease: 'Sine.easeOut' });
      const plane = this.add.sprite(336, 114, PELAGIC_RIVET_SHEET, 3).setDisplaySize(62, 62);
      if (activePilot.id !== 'nolan') plane.setTint(activePilot.hullColor);
      this.ui.add(plane);
      this.tweens.add({ targets: plane, y: { from: 111.5, to: 116.5 }, duration: 1450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.text(336, 168, `${activePilot.shipName}  •  ${activePilot.callsign}`, 11, UI.cyanHex);
      this.text(336, 183, `ARMA: ${activePilot.weaponName}`, 8.2, UI.white);
      this.text(336, 197, `ESPECIAL: ${activePilot.specialName.toUpperCase()}`, 8.4, UI.goldHex);

      // Slanted vector stat meters (right)
      const stats: [string, number, 'cyan' | 'gold' | 'green', number][] = [
        ['VELOCIDADE', activePilot.stats.speed, 'cyan', 92],
        ['ARMAMENTO', activePilot.stats.firepower, 'gold', 132],
        ['BLINDAGEM', activePilot.stats.armor, 'green', 172],
      ];
      for (const [lbl, val, kind, sy] of stats) {
        this.text(584, sy - 13, lbl, 9, UI.silver);
        makeVectorGauge(this, this.ui, 584, sy + 3, 162, 18, 5, val, kind);
      }

      // 5 Clickable vector pilot cards
      for (let i = 0; i < pilots.length; i++) {
        const p = pilots[i];
        const pUnlocked = globalProfileStore.isPilotUnlocked(p.id);
        const selected = p.id === activePilot.id;
        const cx = 128 + i * 128;
        const card = this.add.container(cx, 260);
        makeVectorPanel(this, card, 0, 0, 114, 82, { kind: selected ? 'cardActive' : 'card', cut: 9 });
        card.add(this.add.image(0, -14, 'arc-pilots', p.portraitFrame).setDisplaySize(44, 44).setAlpha(pUnlocked ? 1 : .52));
        if (!pUnlocked) makeVectorIconSprite(this, card, 40, -26, 'lock', 13, UI.goldHex);
        card.add(this.add.text(0, 15, p.name.toUpperCase(), { fontFamily: FONT, fontSize: '10.5px', fontStyle: 'bold', color: selected ? UI.goldHex : (pUnlocked ? UI.white : UI.silver), stroke: '#061938', strokeThickness: 3 }).setResolution(2).setOrigin(.5));
        const statusStr = selected && pUnlocked ? 'PRONTO' : pUnlocked ? 'DISPONÍVEL' : `${p.creditCost} CR`;
        const statusCol = selected && pUnlocked ? UI.cyanHex : pUnlocked ? '#9ae6b4' : UI.goldHex;
        card.add(this.add.text(0, 28, statusStr, { fontFamily: FONT, fontSize: '7.5px', fontStyle: 'bold', color: statusCol, stroke: '#061938', strokeThickness: 2.5 }).setResolution(2).setOrigin(.5));
        const cardZone = this.add.zone(0, 0, 114, 82).setInteractive({ useHandCursor: true });
        cardZone.on('pointerdown', () => {
          this.audio.unlock();
          globalAudio.playArcade('navigate');
          this.selectedPilotId = p.id;
          if (pUnlocked) globalProfileStore.selectPilot(p.id);
          this.menuActionLocked = false;
          this.show('pilot');
        });
        card.add(cardZone);
        this.ui.add(card);
        if (old !== 'pilot') {
          card.setAlpha(0).setY(269);
          this.tweens.add({ targets: card, alpha: 1, y: 260, duration: 190, delay: 30 + i * 26, ease: 'Sine.easeOut' });
        }
      }

      // Bio or unlock requirement line cleanly above bottom buttons
      const infoLine = isUnlocked
        ? `${activePilot.bio}  •  SALDO: ${profile.wallet.credits} CR  •  ←/→ TROCAR PILOTO`
        : `${activePilot.unlockHint} (SALDO: ${profile.wallet.credits} CR)`;
      this.text(384, 315, infoLine, 8.2, isUnlocked ? UI.silver : UI.goldHex, { wrap: 620 });

      const launchLabel = isUnlocked
        ? `DECOLAR COM ${activePilot.name.toUpperCase()}`
        : canAfford
          ? `DESBLOQUEAR (${activePilot.creditCost} CR)`
          : `BLOQUEADO (${activePilot.creditCost} CR)`;
      const pLaunch = this.button(486, 352, launchLabel, () => {
        if (isUnlocked) {
          globalProfileStore.selectPilot(activePilot.id);
          this.show('missions');
        } else if (canAfford) {
          globalProfileStore.buyHangarItem(`pilot:${activePilot.id}`);
          globalProfileStore.selectPilot(activePilot.id);
          globalAudio.playArcade('level-up');
          this.menuActionLocked = false;
          this.show('pilot');
        }
      }, 272, 32, {
        fontSize: 11.8,
        variant: isUnlocked || canAfford ? 'primary' : 'secondary',
        disabled: !isUnlocked && !canAfford,
        onLeft: () => { globalAudio.playArcade('navigate'); stepPilot(-1); },
        onRight: () => { globalAudio.playArcade('navigate'); stepPilot(1); },
      });
      const pBack = this.button(176, 352, 'VOLTAR', () => this.show('title'), 166, 32, { fontSize: 12, variant: 'back' });
      if (old !== 'pilot') {
        pLaunch.modern?.animateEntrance(75, 0, 8);
        pBack.modern?.animateEntrance(45, 0, 8);
        playMenuScreenEntrance(this, this.ui, 200);
      }
      makeMenuHintBar(this, this.ui, 417, connectedPad()?.id, { adjust: true });
    } else if (screen === 'missions') {
      this.addModalBackdrop(0x041530, .42, false);
      makeVectorBanner(this, this.ui, 384, 28, 250, 32, 'ESCOLHA A ROTA', { fontSize: 15.5 });
      const activePilot = getPilotContract(this.selectedPilotId);
      const st = globalSave.getSettings();
      const diff = normalizeGameDifficulty(st.difficulty);
      this.text(384, 56, `PILOTO: ${activePilot.name.toUpperCase()} (${activePilot.shipName})  •  DUAS PERSPECTIVAS, UMA OPERAÇÃO DE RESGATE`, 9.2, UI.white);
      const prog = this.arcadeProgress(), unlocked = prog.cleared.includes(1);
      for (let i = 0; i < 2; i++) {
        const cx = i ? 562 : 206, m = MISSIONS[i], avail = i === 0 || unlocked;
        const bestScoreRec = globalProfileStore.bestScoreForMission(m.id, this.selectedPilotId);
        const bestRankRec = globalProfileStore.bestRankForMission(m.id, this.selectedPilotId);
        const best = Math.max(bestScoreRec, this.bestScoreFor(m.id));
        const rankStr = bestRankRec ? `  •  RANK ${bestRankRec}` : '';
        makeVectorPanel(this, this.ui, cx, 204, 326, 238, { kind: 'main', cut: 14 });
        makeVectorBanner(this, this.ui, cx, 88, 152, 24, `ROTA 0${i + 1}`, { kind: avail ? 'gold' : 'red', fontSize: 11.5, wings: false });
        makeVectorPanel(this, this.ui, cx - 84, 178, 116, 116, { kind: avail ? 'gold' : 'sub', cut: 10 });
        this.ui.add(this.add.image(cx - 84, 178, i ? 'arc-scenery' : UI_TEX.routePelagic, i ? 5 : undefined).setDisplaySize(100, 100).setAlpha(avail ? 1 : .40));
        if (!avail) makeVectorIconSprite(this, this.ui, cx - 84, 178, 'lock', 34, UI.goldHex);
        this.text(cx + 62, 138, m.name, 14.5, avail ? UI.goldHex : UI.silver, { wrap: 162 });
        this.text(cx + 62, 166, `${perspectiveLabelPt(m.perspective)}  •  ${Math.round(stageDurationFor(m.perspective) / 60)} MIN`, 9, UI.cyanHex, { wrap: 162 });
        this.text(cx + 62, 196, avail ? `RECORDE: ${best}${rankStr}` : 'CONCLUA A\nROTA 01 ANTES', 9.5, avail ? UI.white : UI.crimsonHex, { wrap: 160 });
        if (i === 0) {
          const modeLabel = st.assisted ? `${DIFFICULTY_PROFILES[diff].label} • ASSISTIDO` : `DIFICULDADE: ${DIFFICULTY_PROFILES[diff].label}`;
          const modeHex = st.assisted ? 0x52f2e2 : diff === 'hard' ? UI.gold : diff === 'normal' ? UI.cyan : 0x9ec5e8;
          const modeCol = st.assisted ? '#88fff2' : diff === 'hard' ? UI.goldHex : diff === 'normal' ? UI.cyanHex : UI.silver;
          makeStatusPill(this, this.ui, cx, 248, modeLabel, modeHex, modeCol);
        } else if (avail) {
          makeStatusPill(this, this.ui, cx, 248, 'CAMPANHA DESBLOQUEADA', UI.gold, UI.goldHex);
        }
        const mBtn = this.button(cx, 286, avail ? 'INICIAR MISSÃO' : 'BLOQUEADA', () => { if (!avail) return; const carry = i ? prog.flights[1] : undefined; this.begin(i, carry); }, 236, 31, {
          fontSize: 12,
          variant: avail ? 'primary' : 'secondary',
          disabled: !avail,
        });
        if (old !== 'missions') mBtn.modern?.animateEntrance(50 + i * 40, i ? 10 : -10, 0);
      }

      // Bottom utility bar: VOLTAR | DIFICULDADE inline | ASSISTIDO inline | TREINO
      this.button(114, 366, 'VOLTAR', () => this.show('pilot'), 132, 28, { fontSize: 11, variant: 'back' });
      const stepDiff = (dir: -1 | 1) => {
        globalSave.updateSettings({ difficulty: stepGameDifficulty(globalSave.getSettings().difficulty, dir) });
        this.menuActionLocked = false;
        this.show('missions');
      };
      this.button(294, 366, `◄ ${DIFFICULTY_PROFILES[diff].label} ►`, () => stepDiff(1), 184, 28, {
        fontSize: 10.5,
        variant: 'secondary',
        onLeft: () => { globalAudio.playArcade('navigate'); stepDiff(-1); },
        onRight: () => { globalAudio.playArcade('navigate'); stepDiff(1); },
      });
      this.button(484, 366, st.assisted ? 'ASSISTIDO: SIM' : 'ASSISTIDO: NÃO', () => {
        globalSave.updateSettings({ assisted: !globalSave.getSettings().assisted });
        this.menuActionLocked = false;
        this.show('missions');
      }, 158, 28, { fontSize: 10.2, variant: 'secondary' });
      this.button(654, 366, 'MODO TREINO', () => { this.practiceMission = 0; this.show('practice'); }, 144, 28, { fontSize: 10.5, variant: 'secondary' });
      makeMenuHintBar(this, this.ui, 417, connectedPad()?.id, { adjust: true });
      if (old !== 'missions') playMenuScreenEntrance(this, this.ui, 200);
    } else if (screen === 'practice') {
      this.addModalBackdrop(0x030e24, .64, false);
      makeVectorPanel(this, this.ui, 384, 208, 668, 348, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 34, 248, 32, 'MODO TREINO', { fontSize: 15 });
      const prog = this.arcadeProgress();
      const stage2Unlocked = prog.cleared.includes(1);
      this.text(384, 66, 'Pratique qualquer setor ou chefe diretamente. Não altera recordes competitivos nem 1CC.', 8.6, UI.silver);

      const mTabs: Array<{ id: number; label: string; x: number; enabled: boolean }> = [
        { id: 0, label: 'ROTA 01 — FENDA PELÁGICA', x: 254, enabled: true },
        { id: 1, label: stage2Unlocked ? 'ROTA 02 — CIDADE SOLAR' : 'ROTA 02 (BLOQUEADA)', x: 514, enabled: stage2Unlocked },
      ];
      for (const mt of mTabs) {
        this.button(mt.x, 96, mt.label, () => {
          if (!mt.enabled) return;
          this.practiceMission = mt.id;
          this.menuActionLocked = false;
          this.show('practice');
        }, 244, 24, { fontSize: 9.8, variant: 'tab', activeTab: this.practiceMission === mt.id, disabled: !mt.enabled });
      }

      const checkpoints = this.practiceMission === 0
        ? [
            { label: '01 • CÉU ABERTO (0s)', at: 0 },
            { label: '02 • COSTA CORAL (60s)', at: 60 },
            { label: '03 • ARQUIPÉLAGO (115s)', at: 115 },
            { label: '04 • CORRENTE NORTE (160s)', at: 160 },
            { label: '05 • ARCO DAS MARÉS (180s)', at: 180 },
            { label: '06 • BLOQUEIO NAVAL (230s)', at: 230 },
            { label: '07 • MAR ABERTO (295s)', at: 295 },
            { label: 'CHEFE • COLOSSO ABISSAL', at: 360 },
          ]
        : [
            { label: '01 • ENTRADA SOLAR (0s)', at: 0 },
            { label: '02 • DISTRITO CENTRAL (85s)', at: 85 },
            { label: '03 • MINI-CHEFE GIRO (155s)', at: 155 },
            { label: '04 • ALTA ATMOSFERA (225s)', at: 225 },
            { label: 'CHEFE • FORTALEZA SOLAR', at: 300 },
          ];
      checkpoints.forEach((cp, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const bx = col === 0 ? 236 : 532;
        const by = 144 + row * 42;
        this.button(bx, by, cp.label, () => this.beginPractice(this.practiceMission, cp.at), 272, 32, {
          fontSize: 10.5,
          variant: cp.at >= (this.practiceMission === 0 ? 360 : 300) ? 'primary' : 'secondary',
        });
      });

      this.button(384, 348, 'VOLTAR', () => this.show('missions'), 188, 30, { fontSize: 12, variant: 'back' });
      makeMenuHintBar(this, this.ui, 417, connectedPad()?.id);
      if (old !== 'practice') playMenuScreenEntrance(this, this.ui, 190);
    } else if (screen === 'hangar') {
      this.addModalBackdrop(0x030e24, .64, false);
      makeVectorPanel(this, this.ui, 384, 210, 678, 354, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 34, 248, 32, 'HANGAR & PERFIL', { fontSize: 15 });
      const prof = globalProfileStore.getProfile();
      const achCount = Object.keys(prof.achievements).length;
      const eqSkinId = prof.unlocks.equippedSkins[prof.selectedPilotId] ?? 'skin:classic';
      this.text(648, 34, `${prof.wallet.credits} CR`, 12, UI.goldHex);

      const hTabs: Array<{ id: HangarTab; label: string; x: number }> = [
        { id: 'hangar', label: 'PINTURAS', x: 228 },
        { id: 'achievements', label: `CONQUISTAS (${achCount}/${ACHIEVEMENTS.length})`, x: 384 },
        { id: 'profile', label: 'PERFIL', x: 540 },
      ];
      const switchHangar = (next: HangarTab, focusIdx: number) => {
        if (this.hangarTab === next) return;
        this.hangarTab = next;
        this.nextHangarFocus = focusIdx;
        this.menuActionLocked = false;
        this.show('hangar');
      };
      hTabs.forEach((t, idx) => {
        this.button(t.x, 76, t.label, () => switchHangar(t.id, idx), 148, 25, {
          fontSize: 10,
          variant: 'tab',
          activeTab: this.hangarTab === t.id,
          onLeft: () => { const prev = (idx + 2) % 3; switchHangar(hTabs[prev].id, prev); },
          onRight: () => { const nxt = (idx + 1) % 3; switchHangar(hTabs[nxt].id, nxt); },
        });
      });

      if (this.hangarTab === 'hangar') {
        this.text(384, 108, 'ITENS 100% COSMÉTICOS — SEM VANTAGEM EM COMBATE (SEM PAY-TO-WIN)', 8.4, UI.cyanHex);
        const skins = HANGAR_CATALOG.filter(it => it.kind === 'skin');
        skins.forEach((skin, idx) => {
          const y = 136 + idx * 36;
          const owned = prof.unlocks.skins.includes(skin.id);
          const equipped = eqSkinId === skin.id;
          const canBuy = prof.wallet.credits >= skin.cost;
          const status = equipped ? 'EQUIPADA (ATIVA)' : owned ? 'DESBLOQUEADA — EQUIPAR' : `COMPRAR POR ${skin.cost} CR`;
          this.button(384, y, `${skin.name.toUpperCase()}  •  ${status}`, () => {
            if (equipped) {
              globalProfileStore.equipSkin(prof.selectedPilotId, 'skin:classic');
            } else if (owned) {
              globalProfileStore.equipSkin(prof.selectedPilotId, skin.id);
            } else if (canBuy) {
              globalProfileStore.buyHangarItem(skin.id);
              globalAudio.playArcade('level-up');
            }
            this.nextHangarFocus = 3 + idx;
            this.menuActionLocked = false;
            this.show('hangar');
          }, 580, 29, {
            fontSize: 10.2,
            variant: equipped ? 'primary' : 'secondary',
            disabled: !owned && !canBuy,
          });
        });
      } else if (this.hangarTab === 'achievements') {
        makeVectorPanel(this, this.ui, 384, 214, 624, 224, { kind: 'sub' });
        const shown = ACHIEVEMENTS.slice(0, 12);
        shown.forEach((ach, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const ax = col === 0 ? 96 : 396;
          const ay = 122 + row * 34;
          const done = Boolean(prof.achievements[ach.id]);
          this.text(ax, ay - 4, `${done ? '★' : '○'} ${ach.title}  (+${ach.rewardCredits} CR)`, 9.2, done ? UI.goldHex : UI.silver, { originX: 0 });
          this.text(ax + 12, ay + 8, ach.description, 7.6, done ? UI.cyanHex : UI.slate, { originX: 0, wrap: 274 });
        });
        this.text(384, 314, `Conquistas verificadas diretamente na simulação (${achCount}/${ACHIEVEMENTS.length}).`, 8, UI.silver);
      } else {
        makeVectorPanel(this, this.ui, 214, 212, 282, 218, { kind: 'sub' });
        this.text(214, 126, 'CONTA LOCAL (CONVIDADO)', 11, UI.goldHex);
        this.text(214, 152, `PILOTO ATIVO: ${getPilotContract(prof.selectedPilotId).name.toUpperCase()}`, 9.5, UI.cyanHex);
        this.text(214, 176, `PILOTOS DESBLOQUEADOS: ${prof.unlocks.pilots.length} / 5`, 9.5, UI.white);
        this.text(214, 198, `FASES CONCLUÍDAS: ${prof.clearedStages.length} / 2`, 9.5, UI.white);
        this.text(214, 220, `CONQUISTAS: ${achCount} / ${ACHIEVEMENTS.length}`, 9.5, UI.white);
        this.text(214, 242, `CRÉDITOS DE CAMPANHA: ${prof.wallet.credits} CR`, 10, UI.goldHex);
        this.text(214, 274, `SCHEMA DE PERFIL: v${prof.schemaVersion} (OFFLINE)`, 8, UI.silver);

        makeVectorPanel(this, this.ui, 526, 212, 314, 218, { kind: 'sub' });
        this.text(526, 126, 'SERVIÇOS ONLINE & NUVEM', 11, UI.goldHex);
        this.text(526, 174, 'Status atual: MODO CONVIDADO OFFLINE.\nTodo o seu progresso, recordes, pilotos e pinturas\nficam salvos localmente neste navegador/dispositivo.', 8.8, UI.white, { wrap: 286 });
        this.text(526, 244, 'Sincronização em nuvem, login externo e placares\nglobais requerem backend configurado e não estão\nativos nesta compilação.', 8.2, UI.silver, { wrap: 286 });
      }

      this.button(384, 356, 'VOLTAR', () => { this.nextHangarFocus = undefined; this.show('title'); }, 188, 30, { fontSize: 12, variant: 'back' });
      this.focus = this.nextHangarFocus ?? hTabs.findIndex(t => t.id === this.hangarTab);
      this.nextHangarFocus = undefined;
      makeMenuHintBar(this, this.ui, 417, connectedPad()?.id);
      if (old !== 'hangar') playMenuScreenEntrance(this, this.ui, 190);
    } else if (screen === 'play') {
      if (this.world?.up) {
        this.radio.setStyle({ fontFamily: FONT, fontSize: '10px', color: '#f2fff9', backgroundColor: 'rgba(0,0,0,0)', padding: { x: 0, y: 0 }, wordWrap: { width: 105 }, align: 'left' });
        this.radio.setOrigin(0, 0);
      } else {
        this.radio.setStyle({ fontFamily: FONT, fontSize: '12px', color: '#16385b', backgroundColor: '#fff7cb', padding: { x: 8, y: 5 }, wordWrap: { width: 280 }, align: 'center' });
        this.radio.setOrigin(.5);
      }
      this.refreshTouchLayout();
      this.syncPauseButton();
      if (!this.world?.up && this.world?.state === 'intro') {
        const pIdx = this.world?.pilotContract.portraitFrame ?? 0;
        const portrait = this.add.image(144, 207, 'arc-pilots', pIdx).setDisplaySize(110, 110); this.ui.add(portrait); this.time.delayedCall(2300, () => portrait.destroy());
      }
    } else if (screen === 'pause') {
      this.addModalBackdrop(0x031129, .62, false);
      makeVectorPanel(this, this.ui, 384, 218, 410, 324, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 58, 224, 32, 'PAUSA', { fontSize: 16 });
      const w = this.world;
      if (w) {
        const pct = Math.round(w.progressRatio * 100);
        const modeTag = w.practiceMode
          ? 'TREINO'
          : w.isAssisted
            ? `${w.difficultyProfile.label} • ASSISTIDO`
            : w.difficultyProfile.label;
        makeStatusPill(this, this.ui, 384, 102, `ROTA 0${this.currentMission + 1} • ${w.pilotContract.name.toUpperCase()} • ${modeTag}`, UI.cyan, UI.cyanHex);
        this.text(384, 126, `PROGRESSO ${pct}%  •  ${w.score} PTS  •  NV ${w.weapons.weaponLevel}`, 9.5, UI.white);
      }
      this.button(384, 166, 'CONTINUAR', () => this.show('play'), 256, 32, { fontSize: 12, variant: 'primary' });
      this.button(384, 206, 'CONTROLES', () => this.show('controls'), 256, 32, { fontSize: 11.5, variant: 'secondary' });
      this.button(384, 246, 'OPÇÕES', () => { this.pauseOrigin = 'pause'; this.show('settings'); }, 256, 32, { fontSize: 11.5, variant: 'secondary' });
      this.button(384, 286, 'SAIR DA MISSÃO', () => this.show('confirm-exit'), 256, 32, { fontSize: 11.5, variant: 'back' });
      const pPad = connectedPad();
      const pLabels = padLabels(pPad?.id);
      this.text(384, 344, pPad ? `${pLabels.pause}: RETOMAR  •  ${pLabels.confirm}: CONFIRMAR  •  ${pLabels.cancel}: VOLTAR` : 'ESC: RETOMAR VOO', 8.5, UI.silver);
    } else if (screen === 'controls') {
      this.addModalBackdrop(0x031129, .62, false);
      const preGame = true;
      const pad = connectedPad();
      this.lastControlsPadId = pad?.id ?? '';
      if (old !== 'controls') {
        const hasTouchOnly = this.touchDeviceActive || (typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches);
        if (pad) this.controlsTab = 'gamepad';
        else if (hasTouchOnly) this.controlsTab = 'android';
        else this.controlsTab = 'pc';
      }
      makeVectorPanel(this, this.ui, 384, 210, 678, 352, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 34, 218, 32, 'CONTROLES', { fontSize: 15.5 });
      const tabs: Array<{ id: ControlsTab; label: string; x: number }> = [
        { id: 'pc', label: 'PC', x: 228 },
        { id: 'gamepad', label: 'CONTROLE', x: 384 },
        { id: 'android', label: 'ANDROID', x: 540 },
      ];
      const switchTab = (next: ControlsTab, focusIdx: number) => {
        if (this.controlsTab === next) return;
        this.controlsTab = next;
        this.nextControlsFocus = focusIdx;
        this.menuActionLocked = false;
        this.show('controls');
      };
      tabs.forEach((t, idx) => {
        const active = this.controlsTab === t.id;
        this.button(t.x, 76, t.label, () => switchTab(t.id, idx), 138, 26, {
          fontSize: 11.5,
          variant: 'tab',
          activeTab: active,
          onLeft: () => { const prev = (idx + 2) % 3; switchTab(tabs[prev].id, prev); },
          onRight: () => { const nxt = (idx + 1) % 3; switchTab(tabs[nxt].id, nxt); },
        });
      });

      const drawKey = (kx: number, ky: number, lbl: string, opts?: { wide?: boolean; gold?: boolean; size?: number; fontSize?: number; width?: number }) => {
        makeVectorKeycap(this, this.ui, kx, ky, lbl, opts);
      };
      const cmdRow = (xBadge: number, y: number, badgeText: string, desc: string, opts?: { wide?: boolean; gold?: boolean; descColor?: string; badgeFont?: number }) => {
        drawKey(xBadge, y, badgeText, { wide: opts?.wide ?? badgeText.length > 3, gold: opts?.gold, size: 22, width: 72, fontSize: opts?.badgeFont ?? 8.2 });
        this.text(xBadge + 44, y, desc, 9.6, opts?.descColor ?? UI.white, { originX: 0, wrap: 230 });
      };

      if (this.controlsTab === 'pc') {
        makeVectorPanel(this, this.ui, 198, 218, 228, 214, { kind: 'sub' });
        this.text(198, 128, 'TECLADO PC', 11.5, UI.goldHex);
        drawKey(158, 158, 'W', { size: 24, fontSize: 10 });
        drawKey(186, 158, 'A', { size: 24, fontSize: 10 });
        drawKey(214, 158, 'S', { size: 24, fontSize: 10 });
        drawKey(242, 158, 'D', { size: 24, fontSize: 10 });
        drawKey(158, 190, '↑', { size: 24, fontSize: 11 });
        drawKey(186, 190, '←', { size: 24, fontSize: 11 });
        drawKey(214, 190, '↓', { size: 24, fontSize: 11 });
        drawKey(242, 190, '→', { size: 24, fontSize: 11 });
        drawKey(198, 226, 'ESPAÇO', { wide: true, size: 23, width: 92, fontSize: 9.2 });
        drawKey(136, 260, 'Z', { size: 23, fontSize: 10 });
        drawKey(166, 260, 'X', { gold: true, size: 23, fontSize: 10 });
        drawKey(208, 260, 'SHIFT', { wide: true, size: 23, width: 48, fontSize: 8.2 });
        drawKey(258, 260, 'ESC', { wide: true, size: 23, width: 40, fontSize: 8.2 });
        this.text(198, 298, 'MOUSE NÃO MOVE NEM ATIRA EM COMBATE', 7.8, UI.cyanHex, { wrap: 204 });

        makeVectorPanel(this, this.ui, 504, 218, 344, 214, { kind: 'sub' });
        this.text(504, 128, 'COMANDOS DE COMBATE', 11, UI.goldHex);
        cmdRow(380, 154, 'WASD/SETAS', 'Mover nave em 8 direções', { wide: true, badgeFont: 7.2 });
        cmdRow(380, 181, 'ESPAÇO', 'Tiro principal / rajada contínua', { wide: true, descColor: UI.goldHex, badgeFont: 8 });
        cmdRow(380, 208, 'TECLA Z', 'Tiro carregado (segurar / soltar)', { wide: true, descColor: '#67e8f9', badgeFont: 8 });
        cmdRow(380, 235, 'TECLA X', 'Especial do piloto', { wide: true, gold: true, descColor: UI.cyanHex, badgeFont: 8 });
        cmdRow(380, 262, 'SHIFT', 'Foco (voo preciso + núcleo hitbox)', { wide: true, descColor: '#a5f3fc', badgeFont: 8 });
        cmdRow(380, 289, 'ESC / ENTER', 'Pausar / Confirmar menus', { wide: true, badgeFont: 7.2 });
        this.text(504, 314, 'Segure Z para carregar energia e solte para disparar.', 8, UI.silver, { wrap: 318 });
      } else if (this.controlsTab === 'gamepad') {
        const detected = pad ? detectPadProfile(pad.id) : 'playstation';
        const activeProfile: Extract<PadProfile, 'playstation' | 'xbox'> =
          this.controlsPadPreview === 'auto'
            ? (detected === 'xbox' ? 'xbox' : 'playstation')
            : this.controlsPadPreview;
        const isXbox = activeProfile === 'xbox';
        const padTex = isXbox ? UI_TEX.padXbox : UI_TEX.padDualSense;
        if (preGame) makeVectorPanel(this, this.ui, 212, 218, 256, 214, { kind: 'sub' });
        else makePanel(this, 212, 224, 256, 222, 'cobalt', this.ui);
        this.text(212, 126, isXbox ? 'CONTROLE XBOX / PC' : 'PS5 DUALSENSE', 11, UI.goldHex);
        this.ui.add(this.add.image(212, 200, padTex).setDisplaySize(218, 126));
        this.text(212, 274, pad ? `CONECTADO: ${pad.id.slice(0, 22).toUpperCase()}` : (isXbox ? 'PERFIL XBOX / XINPUT' : 'DUALSENSE VIA USB / BLUETOOTH'), 7.6, pad ? UI.cyanHex : UI.silver, { wrap: 232 });
        this.button(212, 302, isXbox ? 'VER PLAYSTATION' : 'VER XBOX', () => {
          this.controlsPadPreview = isXbox ? 'playstation' : 'xbox';
          this.nextControlsFocus = 1;
          this.menuActionLocked = false;
          this.show('controls');
        }, 168, 24, { fontSize: 9.5, variant: 'tab' });

        if (preGame) makeVectorPanel(this, this.ui, 518, 218, 320, 214, { kind: 'sub' });
        else makePanel(this, 518, 224, 320, 222, 'cobalt', this.ui);
        this.text(518, 126, isXbox ? 'COMANDOS XBOX' : 'COMANDOS PLAYSTATION', 10.5, UI.goldHex);

        const drawFaceOrb = (cx: number, cy: number, sym: string, ringColor: number, textColor: string, r = 9.5, fontSize = 10.5) => {
          const g = this.add.graphics()
            .fillStyle(0x091933, 0.96).fillCircle(cx, cy, r)
            .lineStyle(1.8, ringColor, 0.98).strokeCircle(cx, cy, r);
          this.ui.add(g);
          this.text(cx, cy - 0.5, sym, fontSize, textColor, { stroke: '#040d1e', strokeThickness: 1.5 });
        };
        const drawShoulderPill = (cx: number, cy: number, lbl: string, w = 26) => {
          const g = this.add.graphics()
            .fillStyle(0x1e293b, 0.96).fillRoundedRect(cx - w / 2, cy - 8, w, 16, 4)
            .lineStyle(1.3, 0x94a3b8, 0.92).strokeRoundedRect(cx - w / 2, cy - 8, w, 16, 4);
          this.ui.add(g);
          this.text(cx, cy, lbl, lbl.length > 4 ? 7 : 8.5, '#f8fafc');
        };
        const padRow = (y: number, drawIcons: () => void, actionLabel: string, detailColor: string = UI.white) => {
          drawIcons();
          this.text(448, y, actionLabel, 9.5, detailColor, { originX: 0, wrap: 224 });
        };

        padRow(152, () => drawShoulderPill(404, 152, 'L / D-PAD', 58), 'MOVIMENTAR NAVE');
        if (isXbox) {
          padRow(179, () => {
            drawFaceOrb(386, 179, 'B', 0xef4444, '#fca5a5');
            this.text(401, 179, '/', 9, UI.slate);
            drawShoulderPill(420, 179, 'RB', 24);
          }, 'TIRO AUTOMÁTICO', UI.goldHex);
          padRow(206, () => drawFaceOrb(404, 206, 'X', 0x3b82f6, '#93c5fd'), 'TIRO CARREGADO (segurar)', '#67e8f9');
          padRow(233, () => {
            drawFaceOrb(386, 233, 'A', 0x22c55e, '#86efac');
            this.text(401, 233, '/', 9, UI.slate);
            drawShoulderPill(420, 233, 'RT', 24);
          }, 'ESPECIAL (Tormenta)', UI.cyanHex);
          padRow(260, () => {
            drawFaceOrb(386, 260, 'A', 0x22c55e, '#86efac', 8.5, 9.5);
            this.text(401, 260, '/', 9, UI.slate);
            drawFaceOrb(418, 260, 'B', 0xef4444, '#fca5a5', 8.5, 9.5);
          }, 'CONFIRMAR / VOLTAR (menus)');
          padRow(287, () => drawShoulderPill(404, 287, 'START', 48), 'PAUSAR / RETOMAR');
          this.text(518, 316, 'Segure X para carregar (1.2s máx) e solte para disparar  •  LB: movimento preciso', 7.6, UI.silver, { wrap: 296 });
        } else {
          padRow(179, () => {
            drawFaceOrb(386, 179, '○', 0xff4f7a, '#ff8aa8', 9.5, 11);
            this.text(401, 179, '/', 9, UI.slate);
            drawShoulderPill(420, 179, 'R1', 24);
          }, 'TIRO AUTOMÁTICO', UI.goldHex);
          padRow(206, () => drawFaceOrb(404, 206, '□', 0xf472b6, '#f9a8d4', 9.5, 11), 'TIRO CARREGADO (segurar)', '#67e8f9');
          padRow(233, () => {
            drawFaceOrb(386, 233, '×', 0x4ea8ff, '#93c5fd', 9.5, 12.5);
            this.text(401, 233, '/', 9, UI.slate);
            drawShoulderPill(420, 233, 'R2', 24);
          }, 'ESPECIAL (Tormenta)', UI.cyanHex);
          padRow(260, () => {
            drawFaceOrb(386, 260, '×', 0x4ea8ff, '#93c5fd', 8.5, 11);
            this.text(401, 260, '/', 9, UI.slate);
            drawFaceOrb(418, 260, '○', 0xff4f7a, '#ff8aa8', 8.5, 10);
          }, 'CONFIRMAR / VOLTAR (menus)');
          padRow(287, () => drawShoulderPill(404, 287, 'OPTIONS', 54), 'PAUSAR / RETOMAR');
          this.text(518, 316, 'Segure □ para carregar (1.2s máx) e solte para disparar  •  L1: movimento preciso', 7.6, UI.silver, { wrap: 296 });
        }
      } else {
        if (preGame) makeVectorPanel(this, this.ui, 222, 220, 276, 218, { kind: 'sub' });
        else makePanel(this, 222, 224, 276, 222, 'cobalt', this.ui);
        this.text(222, 126, 'ANDROID TOUCH (PAISAGEM)', 10.5, UI.goldHex);
        this.ui.add(this.add.image(222, 210, UI_TEX.mobileLandscape).setDisplaySize(244, 138));
        this.text(222, 302, 'MULTITOQUE LIVRE  •  ÁREA SEGURA ATIVA', 8, UI.cyanHex, { wrap: 256 });

        if (preGame) makeVectorPanel(this, this.ui, 528, 220, 300, 218, { kind: 'sub' });
        else makePanel(this, 528, 224, 300, 222, 'cobalt', this.ui);
        this.text(528, 126, 'COMANDOS NA TELA', 11, UI.goldHex);
        cmdRow(414, 156, 'JOYSTICK', 'Voo preciso em 8 direções', { wide: true, badgeFont: 7.5 });
        cmdRow(414, 187, 'TIRO', 'Segure para tiro automático', { wide: true, descColor: UI.goldHex, badgeFont: 8.5 });
        cmdRow(414, 218, 'CARGA', 'Segure e solte (quando disponível)', { wide: true, descColor: '#67e8f9', badgeFont: 8 });
        cmdRow(414, 249, 'ESP', 'Ativar especial sem erro', { wide: true, gold: true, descColor: UI.cyanHex, badgeFont: 8.5 });
        cmdRow(414, 280, 'PAUSA', 'Botão no topo direito', { wide: true, badgeFont: 8 });
        this.text(528, 312, 'Personalize tamanho, lado e transparência em OPÇÕES.', 8, UI.silver, { wrap: 280 });
      }

      this.button(384, preGame ? 356 : 372, 'VOLTAR', () => { this.nextControlsFocus = undefined; this.show(this.world ? 'pause' : this.pauseOrigin); }, preGame ? 188 : 204, preGame ? 30 : 34, { fontSize: 12, variant: 'back' });
      this.focus = this.nextControlsFocus ?? tabs.findIndex(t => t.id === this.controlsTab);
      this.nextControlsFocus = undefined;
      if (!this.world) {
        makeMenuHintBar(this, this.ui, 417, connectedPad()?.id);
        // Only animate screen entrance when arriving from another screen (instant, non-flickering tab switches!)
        if (old !== 'controls') playMenuScreenEntrance(this, this.ui, 200);
      }
    } else if (screen === 'settings') {
      this.addModalBackdrop(0x031129, .62, false);
      const preGame = true;
      makeVectorPanel(this, this.ui, 384, 212, 634, 356, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 32, 210, 30, 'OPÇÕES', { fontSize: 15 });
      const syncWorldDifficulty = () => {
        if (!this.world) return;
        const cur = globalSave.getSettings();
        this.world.assisted = this.currentMission === 0 && cur.assisted;
        this.world.setDifficulty(cur.difficulty);
        this.pelagicAssistBadge.setVisible(!!this.world.up && this.world.isAssisted);
      };
      const labelX = 122;
      const addVolumeRow = (y: number, label: string, isMusic: boolean) => {
        const get = () => isMusic ? globalSave.getSettings().musicVolume : globalSave.getSettings().sfxVolume;
        let meter!: { setValue: (n: number) => void }, valText!: Phaser.GameObjects.Text;
        const apply = (next: number) => {
          const clamped = clamp(Math.round(next * 10) / 10, 0, 1);
          globalSave.updateSettings(isMusic ? { musicVolume: clamped } : { sfxVolume: clamped });
          const cur = globalSave.getSettings();
          this.audio.setMix(cur.musicVolume, cur.sfxVolume, this.mute);
          const steps = Math.round(clamped * 10);
          meter?.setValue(steps); valText?.setText(`${steps * 10}%`);
        };
        const btn = this.button(384, y, '', () => apply(get() >= .99 ? 0 : get() + .1), 564, 27, {
          noLabel: true,
          variant: 'optionRow',
          showArrows: true,
          onLeft: () => { globalAudio.playArcade('navigate'); apply(get() - .1); },
          onRight: () => { globalAudio.playArcade('navigate'); apply(get() + .1); },
        });
        const title = this.text(labelX, y, label, 10.2, UI.white, { originX: 0 });
        meter = makeVectorGauge(this, this.ui, 444, y, 200, 16, 10, Math.round(get() * 10), isMusic ? 'cyan' : 'gold');
        const initSteps = Math.round(get() * 10);
        valText = this.text(596, y, `${initSteps * 10}%`, 10.2, UI.cyanHex);
        btn.extras = [title, valText];
      };
      const addBoolRow = (y: number, label: string, readOn: () => boolean, toggle: () => void) => {
        const initOn = readOn();
        let pill!: { setValue: (on: boolean) => void };
        const flip = () => {
          toggle();
          pill?.setValue(readOn());
        };
        const btn = this.button(384, y, '', flip, 564, 27, {
          noLabel: true,
          variant: 'optionRow',
          showArrows: true,
          onLeft: () => { globalAudio.playArcade('navigate'); flip(); },
          onRight: () => { globalAudio.playArcade('navigate'); flip(); },
        });
        const title = this.text(labelX, y, label, 10.2, UI.white, { originX: 0 });
        pill = makeVectorTogglePill(this, this.ui, 536, y, 146, 19, initOn, ['NÃO', 'SIM']);
        btn.extras = [title];
      };
      const addToggleRow = (y: number, label: string, pipCount: number, gaugeKind: 'cyan' | 'gold' | 'green', readState: () => { text: string; filled: number }, stepState: (dir: number) => void) => {
        const st0 = readState();
        let meter!: { setValue: (n: number) => void }, valText!: Phaser.GameObjects.Text;
        const update = (dir: number) => { stepState(dir); const st = readState(); meter.setValue(st.filled); valText.setText(st.text); };
        const btn = this.button(384, y, '', () => update(1), 564, 27, {
          noLabel: true,
          variant: 'optionRow',
          showArrows: true,
          onLeft: () => { globalAudio.playArcade('navigate'); update(-1); },
          onRight: () => { globalAudio.playArcade('navigate'); update(1); },
        });
        const title = this.text(labelX, y, label, 10.2, UI.white, { originX: 0 });
        meter = makeVectorGauge(this, this.ui, 436, y, 138, 16, pipCount, st0.filled, gaugeKind);
        valText = this.text(578, y, st0.text, 10, UI.goldHex);
        btn.extras = [title, valText];
      };
      addVolumeRow(70, 'MÚSICA', true);
      addVolumeRow(101, 'EFEITOS', false);
      addBoolRow(132, 'DISPARO ACESSÍVEL (AUTO)',
        () => globalSave.getSettings().rapidFire,
        () => { const next = !globalSave.getSettings().rapidFire; globalSave.updateSettings({ rapidFire: next }); if (this.world) this.world.accessibility = next; });
      addToggleRow(163, 'DIFICULDADE', 3, 'gold', () => {
        const diff = normalizeGameDifficulty(globalSave.getSettings().difficulty);
        const filled = diff === 'hard' ? 3 : diff === 'normal' ? 2 : 1;
        return { text: DIFFICULTY_PROFILES[diff].label, filled };
      }, (dir) => {
        const next = stepGameDifficulty(globalSave.getSettings().difficulty, dir < 0 ? -1 : 1);
        globalSave.updateSettings({ difficulty: next });
        syncWorldDifficulty();
      });
      addBoolRow(194, 'MODO ASSISTIDO',
        () => globalSave.getSettings().assisted,
        () => { const next = !globalSave.getSettings().assisted; globalSave.updateSettings({ assisted: next }); syncWorldDifficulty(); });
      addToggleRow(225, 'QUALIDADE VISUAL', 3, 'cyan', () => {
        return { text: ['BAIXA', 'MÉDIA', 'ALTA'][this.quality], filled: this.quality + 1 };
      }, (dir) => { this.quality = (this.quality + (dir < 0 ? 2 : 1)) % 3; try { localStorage.setItem('bullet_wake_visual', String(this.quality)); } catch {/* Optional */ } });
      addBoolRow(256, 'REDUZIR TREMOR DE TELA',
        () => globalProfileStore.getSettings().reducedShake,
        () => { globalProfileStore.updateSettings({ reducedShake: !globalProfileStore.getSettings().reducedShake }); });
      addBoolRow(287, 'REDUZIR FLASHES INTENSOS',
        () => globalProfileStore.getSettings().reducedFlash,
        () => { globalProfileStore.updateSettings({ reducedFlash: !globalProfileStore.getSettings().reducedFlash }); });
      this.text(384, 316, 'Disparo Acessível: tiro contínuo mãos-livres. Assistido: recuperação facilitada (fora do ranking puro).', 7.9, UI.silver);
      this.button(268, 350, 'CONTROLES TOUCH', () => this.show('touch-settings'), 204, 30, { fontSize: 11.2, variant: 'secondary' });
      this.button(500, 350, 'VOLTAR', () => this.show(this.pauseOrigin), 204, 30, { fontSize: 11.5, variant: 'back' });
      if (preGame) {
        makeMenuHintBar(this, this.ui, 417, connectedPad()?.id, { adjust: true });
        if (!this.world) playMenuScreenEntrance(this, this.ui, 200);
      }
    } else if (screen === 'touch-settings') {
      this.addModalBackdrop(0x031129, .58, false);
      makeVectorPanel(this, this.ui, 384, 170, 536, 290, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 30, 240, 30, 'CONTROLES TOUCH', { fontSize: 14.5 });
      const patchTouch = (patch: Partial<TouchControlSettings>) => {
        const cur = globalSave.getSettings().touch;
        globalSave.updateSettings({ touch: { ...cur, ...patch } });
        this.refreshTouchLayout();
      };
      const addTouchRow = (
        y: number,
        _iconFrame: number,
        label: string,
        pipCount: number,
        _pipFrame: number,
        gaugeKind: 'cyan' | 'gold' | 'green',
        readState: () => { text: string; filled: number },
        stepState: (dir: number) => void,
      ) => {
        const st0 = readState();
        let meter!: { setValue: (n: number) => void }, valText!: Phaser.GameObjects.Text;
        const update = (dir: number) => { stepState(dir); const st = readState(); meter.setValue(st.filled); valText.setText(st.text); };
        const btn = this.button(384, y, '', () => update(1), 478, 30, {
          noLabel: true,
          variant: 'optionRow',
          showArrows: true,
          onLeft: () => { globalAudio.playArcade('navigate'); update(-1); },
          onRight: () => { globalAudio.playArcade('navigate'); update(1); },
        });
        const title = this.text(168, y, label, 10.5, UI.white, { originX: 0 });
        meter = makeVectorGauge(this, this.ui, 412, y, 114, 18, pipCount, st0.filled, gaugeKind);
        valText = this.text(540, y, st0.text, 10.5, UI.goldHex);
        btn.extras = [title, valText];
      };
      addTouchRow(76, UI_ICON.gamepad, 'MÃO DOMINANTE', 2, UI_PIP.gold, 'gold', () => {
        const left = globalSave.getSettings().touch.handedness === 'left';
        return { text: left ? 'CANHOTO' : 'DESTRO', filled: left ? 2 : 1 };
      }, () => patchTouch({ handedness: globalSave.getSettings().touch.handedness === 'left' ? 'right' : 'left' }));

      const posOrder: TouchControlSettings['position'][] = ['corner', 'raised', 'wide'];
      const posNames = { corner: 'CANTO', raised: 'ELEVADA', wide: 'ABERTA' } as const;
      addTouchRow(112, UI_ICON.radar, 'POSIÇÃO (MÃO)', 3, UI_PIP.cyan, 'cyan', () => {
        const pos = globalSave.getSettings().touch.position;
        return { text: posNames[pos], filled: posOrder.indexOf(pos) + 1 };
      }, (dir) => {
        const idx = posOrder.indexOf(globalSave.getSettings().touch.position);
        patchTouch({ position: posOrder[(idx + (dir < 0 ? 2 : 1)) % 3] });
      });

      const sizeOrder: TouchControlSettings['size'][] = ['compact', 'standard', 'large'];
      const sizeNames = { compact: 'PEQUENO', standard: 'PADRÃO', large: 'GRANDE' } as const;
      addTouchRow(148, UI_ICON.lightning, 'TAMANHO', 3, UI_PIP.green, 'green', () => {
        const sz = globalSave.getSettings().touch.size;
        return { text: sizeNames[sz], filled: sizeOrder.indexOf(sz) + 1 };
      }, (dir) => {
        const idx = sizeOrder.indexOf(globalSave.getSettings().touch.size);
        patchTouch({ size: sizeOrder[(idx + (dir < 0 ? 2 : 1)) % 3] });
      });

      const opSteps = [0.30, 0.45, 0.60, 0.75];
      addTouchRow(184, UI_ICON.botan, 'TRANSPARÊNCIA', 4, UI_PIP.cyan, 'cyan', () => {
        const op = globalSave.getSettings().touch.opacity;
        const filled = opSteps.reduce((best, v, i) => (Math.abs(v - op) < Math.abs(opSteps[best] - op) ? i : best), 0) + 1;
        return { text: `${Math.round(op * 100)}%`, filled };
      }, (dir) => {
        const op = globalSave.getSettings().touch.opacity;
        const idx = opSteps.reduce((best, v, i) => (Math.abs(v - op) < Math.abs(opSteps[best] - op) ? i : best), 0);
        patchTouch({ opacity: opSteps[(idx + (dir < 0 ? 3 : 1)) % opSteps.length] });
      });

      const ySteps = [-24, -12, 0, 12];
      const yNames = ['ALTA', 'MÉDIA', 'PADRÃO', 'BAIXA'];
      addTouchRow(220, UI_ICON.crown, 'ALTURA FINA', 4, UI_PIP.gold, 'gold', () => {
        const oy = globalSave.getSettings().touch.offsetY;
        const idx = ySteps.reduce((best, v, i) => (Math.abs(v - oy) < Math.abs(ySteps[best] - oy) ? i : best), 2);
        return { text: yNames[idx], filled: idx + 1 };
      }, (dir) => {
        const oy = globalSave.getSettings().touch.offsetY;
        const idx = ySteps.reduce((best, v, i) => (Math.abs(v - oy) < Math.abs(ySteps[best] - oy) ? i : best), 2);
        patchTouch({ offsetY: ySteps[(idx + (dir < 0 ? 3 : 1)) % ySteps.length] });
      });

      this.button(274, 272, 'RESTAURAR PADRÃO', () => {
        globalSave.updateSettings({ touch: defaultTouchSettings() });
        this.refreshTouchLayout();
        this.show('touch-settings');
      }, 198, 30, { fontSize: 11, variant: 'secondary' });
      this.button(494, 272, 'VOLTAR', () => this.show('settings'), 198, 30, { fontSize: 12, variant: 'back' });
      if (!this.world) playMenuScreenEntrance(this, this.ui, 200);
    } else if (screen === 'confirm-exit') {
      this.addModalBackdrop(0x031129, .66, false);
      makeVectorPanel(this, this.ui, 384, 214, 434, 248, { kind: 'gold' });
      makeVectorBanner(this, this.ui, 384, 92, 244, 34, 'SAIR DA MISSÃO?', { kind: 'red', fontSize: 15 });
      this.text(384, 158, 'O progresso da fase atual\nserá perdido ao voltar ao menu.', 11.5, UI.white, { wrap: 340 });
      this.button(384, 232, 'CANCELAR', () => this.show('pause'), 252, 34, { fontSize: 12, variant: 'primary' });
      this.button(384, 280, 'CONFIRMAR SAÍDA', () => { this.disposeWorld(); this.show('title'); }, 252, 34, { fontSize: 11.5, variant: 'back' });
    } else if (screen === 'result') {
      this.audio.play('results'); this.addModalBackdrop(0x031129, .62, false); this.addConfetti();
      const w = this.world!;
      const evalRes = this.lastRunOutcome?.evaluation ?? w.evaluateRun().evaluation;
      const outcome = this.lastRunOutcome;
      makeVectorPanel(this, this.ui, 384, 212, 650, 356, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 36, 300, 34, 'MISSÃO CONCLUÍDA!', { fontSize: 16 });
      makeVectorPanel(this, this.ui, 168, 146, 138, 138, { kind: 'gold', cut: 10 });
      const winFrame = w.pilotId === 'nolan' ? 1 : w.pilotContract.portraitFrame;
      this.ui.add(this.add.image(168, 144, 'arc-pilots', winFrame).setDisplaySize(116, 116));
      makePilotNameplate(this, this.ui, 168, 206, 114, 20, w.pilotContract.name.toUpperCase());
      this.text(168, 240, `RANK ${evalRes.rank}`, 18, evalRes.rank === 'S+' || evalRes.rank === 'S' ? UI.goldHex : UI.cyanHex);
      const modeLabel = evalRes.competitiveEligible ? 'ARCADE PURO' : w.practiceMode ? 'MODO TREINO' : w.isAssisted ? 'MODO ASSISTIDO' : `CONTINUE ×${w.continuesUsed}`;
      makeStatusPill(this, this.ui, 168, 268, modeLabel, evalRes.competitiveEligible ? UI.gold : UI.cyan, evalRes.competitiveEligible ? UI.goldHex : '#88fff2');

      this.text(466, 84, `${MISSIONS[this.currentMission].name}  •  ${w.difficultyProfile.label}`, 13.5, UI.cyanHex);
      makeVectorPanel(this, this.ui, 466, 126, 366, 44, { kind: 'sub' });
      this.text(336, 126, 'PONTUAÇÃO', 9.5, UI.silver, { originX: 0 });
      const scoreTxt = this.text(534, 126, String(w.score), 19, UI.goldHex);
      this.tweens.addCounter({ from: Math.round(w.score * .65), to: w.score, duration: 320, onUpdate: tw => { scoreTxt.setText(String(Math.round(tw.getValue() ?? w.score))); } });
      const secs = Math.floor(w.elapsed);
      this.text(466, 166, `TEMPO ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}  •  ${w.kills} ALVOS  •  GRAZE ${w.grazeCount}  •  CHAIN ×${w.maxChain}`, 9.4, UI.white);
      if (w.up) {
        const b = w.pelagicScoring.snapshot();
        this.text(466, 188, `ESQUADRÕES ${b.formationsCleared}  •  SETORES ${b.sectorsClean}/7  •  BÔNUS +${b.totalBonus}`, 9.2, UI.cyanHex);
      }
      if (evalRes.badges.length > 0) {
        this.text(466, 212, `SELOS: ${evalRes.badges.join('  •  ')}`, 9.5, UI.goldHex);
      } else {
        this.text(466, 212, 'Potência, vidas e especiais seguem para a próxima rota.', 9.2, UI.silver);
      }
      const creditsWon = outcome ? outcome.creditsAdded : evalRes.creditsEarned;
      const unlockParts: string[] = [];
      if (creditsWon > 0) unlockParts.push(`+${creditsWon} CR`);
      if (outcome && outcome.newlyUnlockedAchievements.length > 0) unlockParts.push(`${outcome.newlyUnlockedAchievements.length} CONQUISTA(S)`);
      if (outcome && outcome.newlyUnlockedPilots.length > 0) unlockParts.push(`PILOTO: ${outcome.newlyUnlockedPilots.map((id: PilotId) => getPilotContract(id).name.toUpperCase()).join(', ')}`);
      if (unlockParts.length > 0) {
        makeStatusPill(this, this.ui, 466, 244, unlockParts.join('  •  '), UI.gold, UI.goldHex);
      }
      this.button(466, 304, w.practiceMode ? 'VOLTAR AO TREINO' : (this.currentMission === 0 ? 'PRÓXIMA: CIDADE SOLAR' : 'VER ENCERRAMENTO'), () => {
        if (w.practiceMode) { this.disposeWorld(); this.show('practice'); return; }
        if (this.currentMission === 0) this.begin(1, this.carried);
        else this.show('ending');
      }, 300, 34, { fontSize: 12, variant: 'primary' });
      this.button(466, 348, 'MENU', () => { this.disposeWorld(); this.show('title'); }, 188, 30, { fontSize: 11.5, variant: 'back' });
    } else if (screen === 'defeat') {
      this.audio.play('defeat'); this.addModalBackdrop(0x260812, .68, false);
      const w = this.world!;
      const defeatOutcome = this.recordDefeatProgress();
      makeVectorPanel(this, this.ui, 384, 214, 520, 352, { kind: 'gold' });
      makeVectorBanner(this, this.ui, 384, 42, 316, 34, 'ATERRISSAGEM… CRIATIVA!', { kind: 'red', fontSize: 15 });
      makeVectorPanel(this, this.ui, 384, 124, 114, 114, { kind: 'sub', cut: 10 });
      const loseFrame = w?.pilotId === 'nolan' ? 2 : (w?.pilotContract.portraitFrame ?? 2);
      this.ui.add(this.add.image(384, 123, 'arc-pilots', loseFrame).setDisplaySize(96, 96));
      const pName = w?.pilotContract.name.toUpperCase() ?? 'BAYEK';
      this.text(384, 196, `${pName}: "O importante é voltar ainda mais forte!"`, 10.5, UI.goldHex);
      if (w) {
        const pct = Math.round(w.progressRatio * 100);
        const crTag = defeatOutcome && defeatOutcome.creditsAdded > 0 ? `  •  +${defeatOutcome.creditsAdded} CR` : '';
        this.text(384, 218, `PONTOS ${w.score}  •  PROGRESSO ${pct}%${w.isAssisted ? '  •  ASSISTIDO' : ''}${crTag}`, 9.6, UI.silver);
      }
      const canInstantContinue = !!(w && !w.practiceMode && w.difficulty !== 'hard');
      const hasCp = !!(w?.up && this.activeCheckpointSnapshot);
      let nextBtnY = 256;
      if (hasCp) {
        this.button(384, nextBtnY, 'CONTINUAR DO CHECKPOINT', () => {
          if (!this.world || !this.activeCheckpointSnapshot) { this.begin(this.currentMission); return; }
          if (this.world.restartFromCheckpoint(this.activeCheckpointSnapshot)) {
            this.stageClearSaved = false;
            this.defeatRecorded = false;
            this.audio.play('stage1');
            this.show('play');
          } else {
            this.begin(this.currentMission);
          }
        }, 296, 30, { fontSize: 11.2, variant: 'primary' });
        nextBtnY += 36;
      } else if (canInstantContinue) {
        this.button(384, nextBtnY, 'CONTINUAR (NÃO-1CC)', () => {
          if (!this.world) { this.begin(this.currentMission); return; }
          this.world.continueFromDefeat();
          this.defeatRecorded = false;
          this.audio.play(this.currentMission ? 'stage2' : 'stage1');
          this.show('play');
        }, 296, 30, { fontSize: 11.2, variant: 'primary' });
        nextBtnY += 36;
      }
      this.button(384, nextBtnY, 'REINICIAR FASE', () => this.begin(this.currentMission), 260, 30, { fontSize: 11.2, variant: hasCp || canInstantContinue ? 'secondary' : 'primary' });
      nextBtnY += 36;
      this.button(384, nextBtnY, 'MENU', () => { this.disposeWorld(); this.show('title'); }, 184, 28, { fontSize: 11, variant: 'back' });
    } else if (screen === 'ending') {
      const activePilot = getPilotContract(this.selectedPilotId);
      this.disposeWorld(); this.audio.play('victory'); this.addModalBackdrop(0x041530, .42, false); this.addConfetti();
      makeVectorPanel(this, this.ui, 384, 206, 624, 336, { kind: 'main' });
      makeVectorBanner(this, this.ui, 384, 40, 296, 36, 'DO MAR AO CÉU!', { fontSize: 17 });
      makeVectorPanel(this, this.ui, 186, 188, 152, 152, { kind: 'gold', cut: 10 });
      this.ui.add(this.add.image(186, 186, 'arc-pilots', activePilot.id === 'nolan' ? 1 : activePilot.portraitFrame).setDisplaySize(130, 130));
      makePilotNameplate(this, this.ui, 186, 256, 118, 20, activePilot.name.toUpperCase());
      this.text(468, 126, 'OPERAÇÃO CONCLUÍDA COM SUCESSO', 11.5, UI.cyanHex);
      this.text(468, 170, `${activePilot.name.toUpperCase()} abriu caminho para a equipe de resgate.\nDuas missões concluídas. Experimente novos pilotos e busque o Rank S+!`, 11, UI.white, { wrap: 332 });
      const best = this.bestScoreFor();
      const prof = globalProfileStore.getProfile();
      makeVectorPanel(this, this.ui, 468, 238, 314, 44, { kind: 'gold' });
      this.text(468, 238, `RECORDE ${best}  •  SALDO ${prof.wallet.credits} CR`, 12.5, UI.goldHex);
      this.text(468, 282, `PILOTOS: ${prof.unlocks.pilots.length}/5  •  CONQUISTAS: ${Object.keys(prof.achievements).length}/${ACHIEVEMENTS.length}`, 9.5, UI.cyanHex);
      this.button(384, 342, 'VOAR DE NOVO', () => this.show('pilot'), 264, 34, { fontSize: 12.5, variant: 'primary' });
    }
    this.focusButtons(true);
    this.setTouchVisible(screen === 'play' || screen === 'touch-settings');
    if (screen === 'touch-settings') this.refreshTouchLayout();
  }
  begin(index: number, carry?: CampaignFlight, opts?: { practiceMode?: boolean }): void {
    if (index === 0) { this.messageUntil = 0; this.activeCheckpointSnapshot = undefined; this.checkpointBannerUntil = 0; }
    this.disposeWorld(); this.currentMission = index; this.stageClearSaved = false; this.defeatRecorded = false; this.lastRunOutcome = undefined; this.pelagicComms.reset();
    const settings = globalSave.getSettings();
    const usePortrait = index === 0 && this.isPortraitMobileMode();
    const portH = usePortrait ? this.portraitCanvasHeight() : 432;
    const practiceMode = Boolean(opts?.practiceMode);
    const pilotId = globalProfileStore.isPilotUnlocked(this.selectedPilotId) ? this.selectedPilotId : 'nolan';
    this.selectedPilotId = pilotId;
    this.world = new ArcadeWorld(MISSIONS[index], carry, {
      ...(index === 0 ? {
        upLayout: usePortrait ? 'portrait' : 'pc',
        arena: usePortrait ? { left: 0, right: 384, top: 34, bottom: portH - 14 } : { left: 160, right: 608, top: 18, bottom: 424 },
      } : {}),
      pilotId,
      practiceMode,
    });
    this.world.accessibility = settings.rapidFire;
    this.world.assisted = index === 0 && settings.assisted;
    this.world.setDifficulty(settings.difficulty);
    this.accumulator = 0;
    this.shakeTime = 0;
    this.shakeAmp = 0;
    this.damageFlashAlpha = 0;
    this.bossWarningUntil = 0;
    this.firstSortieHintUntil = this.clock + 3.8;
    this.replayRecorder = new ReplayRecorder({
      missionId: MISSIONS[index].id,
      pilotId,
      difficulty: this.world.difficulty,
      assisted: this.world.isAssisted,
      seed: this.world.seed,
    });
    this.world.bossContact = (_boss, ax, ay, bx, by, radius) => spriteContact(this.bossSprite, ax, ay, bx, by, radius);
    this.world.subHullContact = (_sub, secIdx, ax, ay, bx, by, radius) => this.subBossArt.hullContact(secIdx, ax, ay, bx, by, radius);
    this.world.contact = (e, ax, ay, bx, by, radius) => {
      const sprite = this.enemySprites.get(e.id), turret = this.turrets.get(e.id), mounts = this.pelagicAnims?.mountSpritesFor(e.id);
      const customBase = e.navigation?.customAnchor ? sweepEllipse(ax, ay, bx, by, e.x, e.y, e.size * 0.34 + radius, e.size * 0.38 + radius) : null;
      const hits = [
        sprite ? spriteContact(sprite, ax, ay, bx, by, radius) : null,
        turret ? spriteContact(turret, ax, ay, bx, by, radius) : null,
        customBase,
        ...(mounts ? mounts.map(ms => spriteContact(ms, ax, ay, bx, by, radius)) : []),
      ].filter((v): v is number => v !== null);
      return hits.length ? Math.min(...hits) : null;
    };
    this.player.setVisible(true); this.audio.play(index ? 'stage2' : 'stage1'); this.show('play');
  }
  beginPractice(missionIndex: number, targetSeconds: number): void {
    this.begin(missionIndex, undefined, { practiceMode: true });
    const w = this.world;
    if (!w) return;
    w.introTime = 0;
    if (targetSeconds > 0) {
      w.devJumpToCheckpoint(targetSeconds);
      if (targetSeconds >= w.stageDuration) this.audio.play(w.up ? 'boss1' : 'boss2');
      else if (!w.up && targetSeconds >= 155 && targetSeconds < 185) this.audio.play('mini2');
    }
    this.consumeEvents();
    this.backdrop.draw(w.elapsed, w, this.quality);
    this.renderWorld(0);
    this.refreshHudVisual();
  }
  private disposeWorld(): void {
    this.touchController?.clearAll(); this.emplacements?.clear(); this.hitOverlays?.clear(); this.bombArt?.draw(); this.subBossArt?.clear(); this.bossHudLabel?.setVisible(false); this.pelagicAssistBadge?.setVisible(false); this.pelagicCheckpointBadge?.setVisible(false); this.pelagicSpecialText?.setVisible(false); this.pelagicAnims?.clear(); this.pelagicComms.reset(); this.pelagicDesktopHud?.resetComms();
    this.clearBonusPopups();
    this.vfxGfx?.clear();
    this.warningBannerText?.setVisible(false);
    this.sortieHintText?.setVisible(false);
    this.shakeTime = 0;
    this.damageFlashAlpha = 0;
    this.bossWarningUntil = 0;
    this.firstSortieHintUntil = 0;
    const viewport = getCombatVirtualSize(this);
    this.cameras?.main?.centerOn(viewport.cx ?? viewport.w / 2, viewport.cy ?? viewport.h / 2);
    this.world = undefined; this.pelagicDesktopHud?.setVisible(false); this.player?.setVisible(false); this.bossSprite?.setVisible(false); this.lifeIcons.forEach(s => s.setVisible(false)); this.hud?.setText(''); this.radio?.setVisible(false); this.combatInk?.clear(); this.decor?.clear(); this.lastHud = '';
    for (const map of [this.enemySprites, this.partSprites, this.turrets]) { for (const s of map.values()) s.destroy(); map.clear(); } for (const s of this.cargoSprites.values()) s.destroy(); this.cargoSprites.clear(); for (const ex of this.cargoExtras.values()) { ex.shadow.destroy(); ex.glow.destroy(); ex.prop.destroy(); } this.cargoExtras.clear(); for (const s of this.bulletSprites) s.setVisible(false); for (const e of this.effects) { e.sprite.setVisible(false); this.effectPool.push(e.sprite); } this.effects = []; globalAudio.stopCombatEffects();
    this.syncResponsiveViewport();
  }
  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, .05); this.clock += dt;
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const domInputFocused = !!activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
    const gp = this.pad.sample(connectedPad());
    const just = (k: string) => !domInputFocused && Phaser.Input.Keyboard.JustDown(this.controls[k]);
    if (this.screen === 'loading') {
      const nowMs = performance.now();
      const elapsed = Math.max(0, (nowMs - this.loadStartMs) / 1000);
      const ready = this.loadRealProgress >= 1 && this.criticalOpeningAssetsReady();
      if (ready && this.loadCompleteAtMs === undefined) {
        this.loadCompleteAtMs = nowMs;
        this.setOpeningPhase('LOADING_COMPLETE');
        this.syncLoadVisual(1, true);
      } else if (!ready) {
        this.syncLoadVisual(Math.min(this.loadRealProgress * 0.98, clamp(elapsed / 0.55, 0.02, 0.98)), true);
      }
      const heldAfterComplete = this.loadCompleteAtMs === undefined ? 0 : (nowMs - this.loadCompleteAtMs) / 1000;
      if (ready && !this.splashHandoffCommitted && elapsed >= 0.72 && heldAfterComplete >= 0.14) {
        this.splashHandoffCommitted = true;
        this.show('intro');
      }
      this.backdrop.draw(this.clock, undefined, this.quality, false);
      this.renderMenu();
      return;
    }
    const escDown = just('ESC');
    const escHandledByDev = escDown && !!this.devEscapeHandler?.();
    const escPressed = escDown && !escHandledByDev;
    const startedInPlay = this.screen === 'play';
    if (this.screen === 'intro') {
      this.introClock += dt;
      if (this.introSkipFade === undefined && this.introClock >= 0.35 && (just('ENTER') || just('SPACE') || escPressed || gp.confirm)) {
        this.introSkipFade = 0;
      }
      if (this.introSkipFade !== undefined || this.introClock >= 2.32) {
        this.setOpeningPhase('STUDIO_EXIT');
      }
      if (this.introSkipFade !== undefined) {
        this.introSkipFade += dt;
        if (this.introSkipFade >= 0.24) this.show('title');
      } else if (this.introClock >= 2.85) {
        this.show('title');
      }
    } else if (this.screen !== 'play') {
      if (this.screen === 'controls') {
        const curPadId = connectedPad()?.id ?? '';
        if (curPadId !== this.lastControlsPadId) {
          this.lastControlsPadId = curPadId;
          if (curPadId) { this.controlsTab = 'gamepad'; this.nextControlsFocus = 1; }
          this.show('controls');
          return;
        }
        if (just('ONE') && this.controlsTab !== 'pc') { this.controlsTab = 'pc'; this.nextControlsFocus = 0; this.show('controls'); return; }
        if (just('TWO') && this.controlsTab !== 'gamepad') { this.controlsTab = 'gamepad'; this.nextControlsFocus = 1; this.show('controls'); return; }
        if (just('THREE') && this.controlsTab !== 'android') { this.controlsTab = 'android'; this.nextControlsFocus = 2; this.show('controls'); return; }
      }
      const active = this.buttons[this.focus];
      if (!this.menuActionLocked) {
        if (just('DOWN') || gp.down) { this.audio.unlock(); this.focus = (this.focus + 1) % Math.max(1, this.buttons.length); this.focusButtons(); globalAudio.playArcade('navigate'); }
        if (just('UP') || gp.up) { this.audio.unlock(); this.focus = (this.focus + this.buttons.length - 1) % Math.max(1, this.buttons.length); this.focusButtons(); globalAudio.playArcade('navigate'); }
        if (just('RIGHT') || gp.right) {
          this.audio.unlock();
          if (active?.onRight) { active.modern?.playStepPulse(); active.onRight(); }
          else { this.focus = (this.focus + 1) % Math.max(1, this.buttons.length); this.focusButtons(); globalAudio.playArcade('navigate'); }
        }
        if (just('LEFT') || gp.left) {
          this.audio.unlock();
          if (active?.onLeft) { active.modern?.playStepPulse(); active.onLeft(); }
          else { this.focus = (this.focus + this.buttons.length - 1) % Math.max(1, this.buttons.length); this.focusButtons(); globalAudio.playArcade('navigate'); }
        }
        const confirm = just('ENTER') || just('SPACE') || gp.confirm;
        const backPressed = escPressed || gp.cancel;
        const pausePressed = gp.pause;
        if (confirm && active) {
          this.audio.unlock();
          if (active.modern) {
            if (active.modern.disabled) {
              active.modern.playLockedFeedback();
            } else if (active.modern.variant === 'tab') {
              globalAudio.playArcade('navigate');
              active.action();
            } else if (active.onLeft && active.onRight) {
              globalAudio.playArcade('confirm');
              active.modern.playStepPulse();
              active.action();
            } else {
              this.menuActionLocked = true;
              active.modern.playConfirmAndRun(active.action, () => globalAudio.playArcade('confirm'));
            }
          } else {
            globalAudio.playArcade('confirm');
            active.action();
          }
        }
        else if (this.screen === 'pause' && (pausePressed || backPressed)) { this.show('play'); }
        else if (backPressed || pausePressed) {
          if (this.screen === 'confirm-exit') this.show('pause');
          else if (this.screen === 'controls') this.show(this.world ? 'pause' : this.pauseOrigin);
          else if (this.screen === 'touch-settings') this.show('settings');
          else if (this.screen === 'settings') this.show(this.pauseOrigin);
          else if (this.screen === 'practice') this.show('missions');
          else if (this.screen === 'missions') this.show('pilot');
          else if (this.screen === 'pilot' || this.screen === 'credits' || this.screen === 'hangar') this.show('title');
          else if (backPressed && ['result', 'defeat', 'ending'].includes(this.screen)) { this.disposeWorld(); this.show('title'); }
        }
      }
    } else if (escPressed || gp.pause) this.show('pause');
    const resumedFromMenu = !startedInPlay && this.screen === 'play';
    if (this.world && this.screen === 'play' && !resumedFromMenu) {
      if (just('ENTER')) this.world.introTime = 0;
      const held = (k: string) => !domInputFocused && Boolean(this.controls[k]?.isDown);
      const touchCmd = this.touchController.consumeStep();
      const rawFire = held('SPACE') || gp.firePrimary || touchCmd.fire;
      if (this.suppressHeldFireUntilRelease && !rawFire) this.suppressHeldFireUntilRelease = false;
      const fireInput = this.suppressHeldFireUntilRelease ? false : rawFire;
      const rawCharge = held('Z') || gp.chargeHeld || touchCmd.charge;
      if (this.suppressChargeUntilRelease && !rawCharge) this.suppressChargeUntilRelease = false;
      const chargeInput = this.suppressChargeUntilRelease ? false : rawCharge;
      const rawSpecialHeld = held('X') || gp.specialHeld || touchCmd.special;
      if (this.suppressSpecialUntilRelease && !rawSpecialHeld) this.suppressSpecialUntilRelease = false;
      const specialInput = this.suppressSpecialUntilRelease ? false : (held('X') || gp.special || touchCmd.special);
      const focusInput = held('SHIFT') || gp.focusHeld;
      const moveX = clamp(Number(held('D') || held('RIGHT')) - Number(held('A') || held('LEFT')) + gp.moveX + touchCmd.x, -1, 1);
      const moveY = clamp(Number(held('S') || held('DOWN')) - Number(held('W') || held('UP')) + gp.moveY + touchCmd.y, -1, 1);
      const input: Controls = { x: moveX, y: moveY, fire: fireInput, special: specialInput, charge: chargeInput, focus: focusInput };
      this.lastInput = input;
      if (!this.devSimulationPaused) {
        this.accumulator += dt * this.devTimeScale;
        while (this.accumulator >= 1 / 120) {
          this.replayRecorder?.record(input);
          this.world.step(1 / 120, input);
          this.accumulator -= 1 / 120;
        }
        if (this.world.up && this.world.state !== 'intro') this.pelagicComms.step(dt * this.devTimeScale);
      }
      this.consumeEvents();
      this.renderTouchOverlay();
      if (this.world.state === 'victory') { this.saveClear(); this.show('result'); } else if (this.world.state === 'defeat') this.show('defeat');
    }
    const animated = this.world && this.screen !== 'play' ? this.world.elapsed : this.clock;
    const showMenuBackdrop = !['loading', 'intro'].includes(this.screen);
    this.backdrop.draw(animated, this.world, this.quality, showMenuBackdrop);
    if (this.world) this.renderWorld(this.screen === 'play' && !this.devSimulationPaused ? dt * this.devTimeScale : 0); else this.renderMenu();
    this.devOverlayCallback?.(this, delta);
  }
  private installIntroActors(): void {
    this.introWash = this.add.rectangle(384, 216, 768, 432, 0x040d21, 1).setDepth(30).setVisible(false);
    this.introHalo = this.add.sprite(384, 186, UI_TEX.glow).setDisplaySize(290, 290).setTint(0x2d8cff).setBlendMode(Phaser.BlendModes.ADD).setDepth(30.5).setVisible(false);
    this.introCrest = this.add.sprite(384, 174, UI_TEX.icons, UI_ICON.botan).setDepth(31).setVisible(false);
    this.introTitle = this.add.text(384, 248, 'BOTAN STUDIO', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: UI.goldHex, stroke: '#040e24', strokeThickness: 4 }).setResolution(2).setOrigin(.5).setDepth(31).setVisible(false);
    this.introSub = this.add.text(384, 282, 'A P R E S E N T A', { fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: UI.cyanHex, stroke: '#040e24', strokeThickness: 3 }).setResolution(2).setOrigin(.5).setDepth(31).setVisible(false);
  }
  private hideIntroActors(): void {
    for (const n of [this.introWash, this.introHalo, this.introCrest, this.introTitle, this.introSub]) n.setVisible(false);
  }
  private renderMenuAircraft(time: number): void {
    // Passagem contínua de um lado ao outro apenas com os 3 aviões aprovados (sem helicópteros, sem verde, sem RIVET), 1 por vez.
    const portraitTitle = !this.world && this.screen === 'title' && this.isPortraitMobileMode();
    for (const s of this.menuPlanes) s.setVisible(false);
    if (!this.menuPlanes.length) return;
    const legs: ReadonlyArray<{ idx: number; anim: string; dir: 1 | -1; dur: number; y: number; size: number; amp: number }> = [
      { idx: 0, anim: 'ui-wingman-0', dir: 1, dur: 5.6, y: portraitTitle ? -68 : 88, size: portraitTitle ? 54 : 62, amp: 5 },
      { idx: 1, anim: 'ui-wingman-1', dir: -1, dur: 5.0, y: portraitTitle ? 182 : 128, size: portraitTitle ? 52 : 58, amp: 4 },
      { idx: 2, anim: 'ui-wingman-2', dir: 1, dur: 5.6, y: portraitTitle ? 196 : 168, size: portraitTitle ? 54 : 62, amp: 5 },
    ];
    const totalDur = legs.reduce((acc, l) => acc + l.dur, 0);
    // Offset +2.0s so opening frame greets player with the blue prop plane mid-sky
    let cursor = (time + 2.0) % totalDur;
    let active = legs[0];
    let progress = 0;
    for (const leg of legs) {
      if (cursor < leg.dur) {
        active = leg;
        progress = cursor / leg.dur;
        break;
      }
      cursor -= leg.dur;
    }
    const sp = this.menuPlanes[active.idx];
    if (!sp) return;
    if (sp.anims.currentAnim?.key !== active.anim) sp.play(active.anim);
    const minX = portraitTitle ? 128 : -86;
    const maxX = portraitTitle ? 640 : 854;
    const x = active.dir > 0 ? minX + (maxX - minX) * progress : maxX - (maxX - minX) * progress;
    const y = active.y + Math.sin(progress * Math.PI * 3) * active.amp;
    const vy = Math.cos(progress * Math.PI * 3) * active.amp * 3;
    const tilt = clamp((vy / 38) * 3.5 * active.dir, -5, 5);
    // All wingmen sprites natively face LEFT in wingmen-anim.webp -> flipX when flying RIGHT
    sp.setFlipX(active.dir > 0).setPosition(x, y).setDisplaySize(active.size, active.size).setAngle(tilt).setAlpha(0.96).setVisible(true);
  }
  private renderMenu(): void {
    this.decor.clear(); this.hud.setText(''); this.combatInk.clear(); const time = this.clock;
    this.hero.setVisible(false);
    this.wingmen.forEach(s => s.setVisible(false));
    if (this.screen === 'loading') {
      this.hideIntroActors();
      this.logo.setVisible(false);
      this.menuPlanes.forEach(s => s.setVisible(false));
      return;
    }
    if (this.screen === 'intro') {
      this.logo.setVisible(false);
      this.menuPlanes.forEach(s => s.setVisible(false));
      this.renderIntro();
      return;
    }
    if (this.screen === 'title') {
      const portraitTitle = !this.world && this.isPortraitMobileMode();
      this.logo.setPosition(384, portraitTitle ? 74 : 114).setDisplaySize(portraitTitle ? 236 : 254, portraitTitle ? 168 : 181).setAlpha(1).setVisible(true);
      this.renderMenuAircraft(time);
    } else {
      this.logo.setVisible(false);
      this.menuPlanes.forEach(s => s.setVisible(false));
    }
  }
  private renderIntro(): void {
    const t = this.introClock;
    const vSize = getCombatVirtualSize(this);
    const cx = vSize.w * 0.5;
    const cy = vSize.h * 0.5;
    this.hideIntroActors();
    this.hero.setVisible(false);
    this.logo.setVisible(false);
    this.wingmen.forEach(s => s.setVisible(false));
    this.menuPlanes.forEach(s => s.setVisible(false));
    // Studio splash occupies the full screen on #040d21; title menu/sky never render behind it.
    this.introWash.setPosition(cx, cy).setSize(vSize.w + 16, vSize.h + 16).setAlpha(1).setVisible(true);
    const inP = clamp(t / .42, 0, 1);
    const naturalOut = 1 - clamp((t - 2.32) / .46, 0, 1);
    const skipOut = this.introSkipFade === undefined ? 1 : 1 - clamp(this.introSkipFade / .22, 0, 1);
    const crestAlpha = inP * naturalOut * skipOut;
    const sc = .90 + .10 * (1 - (1 - inP) ** 3);
    if (crestAlpha > .01) {
      this.introHalo.setPosition(cx, cy - 30).setAlpha((.22 + .06 * Math.sin(t * 2.1)) * crestAlpha).setVisible(true);
      this.introCrest.setPosition(cx, cy - 42).setDisplaySize(98 * sc, 98 * sc).setAlpha(crestAlpha).setVisible(true);
      this.introTitle.setPosition(cx, cy + 32).setAlpha(crestAlpha).setVisible(true);
      this.introSub.setPosition(cx, cy + 66).setAlpha(clamp((t - .18) / .35, 0, 1) * naturalOut * skipOut).setVisible(true);
    }
  }
  private renderWorld(dt: number): void {
    const w = this.world!, time = w.elapsed, g = this.combatInk; g.clear(); this.hitOverlays.begin();
    if (w.up) {
      this.pelagicAnims.updatePlayer(w, this.player, dt, this.lastInput, this.quality);
    } else {
      this.pelagicAnims.hide();
      this.player.setTexture('arc-rivet', w.player.bank < -.3 ? 6 : w.player.bank > .3 ? 5 : Math.floor(time * 9) % 2 ? 4 : 7).setPosition(w.player.x, w.player.y).setDisplaySize(42, 34).setAngle(0).setAlpha(1).clearTint().setVisible(w.state !== 'defeat');
      // Temporary invulnerability remains readable without making the ship translucent.
      if (w.player.invulnerable > 0) this.player.setAlpha(.72 + .28 * Math.cos(time * 18) ** 2);
    }
    // Apply equipped cosmetic skin tint or distinct livery tint for alternate pilots (Bayek default remains pristine)
    const skinTint = globalProfileStore.getEquippedSkinTint(w.pilotId);
    if (skinTint !== 0xffffff) {
      this.player.setTint(skinTint);
    } else if (w.pilotId !== 'nolan') {
      this.player.setTint(w.pilotContract.hullColor);
    }
    // Precision FOCUS hitbox indicator (exact 5×7px core + soft cyan ring)
    if (w.player.focusActive && w.state === 'play') {
      g.lineStyle(1.3, 0x67e8f9, 0.92).strokeCircle(w.player.x, w.player.y, 6.2 + Math.sin(this.clock * 14) * 0.6);
      g.fillStyle(0xffffff, 0.96).fillRoundedRect(w.player.x - 2.5, w.player.y - 3.5, 5, 7, 2);
      g.lineStyle(1, 0x0ea5e9, 0.9).strokeRoundedRect(w.player.x - 2.5, w.player.y - 3.5, 5, 7, 2);
    }
    if (w.chargedShot.isHolding && w.state === 'play') {
      const cSnap = w.chargedShot.snapshot();
      const nx = w.player.x + (w.up ? 0 : 18);
      const ny = w.player.y + (w.up ? -18 : 0);
      const col = cSnap.isFull ? 0xfef08a : cSnap.ratio >= 0.72 ? 0x99f6e4 : 0x38bdf8;
      const pulse = 1 + Math.sin(this.clock * (cSnap.isFull ? 22 : 12)) * 0.16;
      const rCore = (3.5 + cSnap.ratio * 6.5) * pulse;
      g.fillStyle(col, 0.25 + cSnap.ratio * 0.35).fillCircle(nx, ny, rCore * 1.45);
      g.fillStyle(0xffffff, 0.65 + cSnap.ratio * 0.3).fillCircle(nx, ny, rCore * 0.6);
      if (cSnap.isFull) {
        g.lineStyle(1.4, 0xfde047, 0.88).strokeCircle(w.player.x, w.player.y, 19 + Math.sin(this.clock * 16) * 2.5);
      } else if (cSnap.isPartialReady) {
        g.lineStyle(1.1, 0x67e8f9, 0.55).strokeCircle(nx, ny, rCore * 1.8);
      }
    }
    const alive = new Set<number>();
    this.emplacements.draw(w, this.quality);
    for (const e of w.enemies) {
      if (e.hp <= 0) continue; alive.add(e.id); let s = this.enemySprites.get(e.id); if (!s) { s = this.add.sprite(e.x, e.y, 'arc-enemies').setDepth(e.ground ? 2 : 8); this.enemySprites.set(e.id, s); } const enemyFrame = e.family === 'alien' ? (w.up ? 0 : 2) + Math.floor(time * 5) % 2 : e.family === 'airship' ? 12 : (w.up && e.family === 'tank' ? 7 : Math.max(0, FAMILY_ORDER.indexOf(e.family))) + (w.up ? 0 : 8); s.setOrigin(.5, .5).setFlipX(false).setPosition(e.x, e.y).setTexture(e.family === 'alien' ? 'arc-ufo' : 'arc-enemies', enemyFrame).setDisplaySize(e.size, e.size).setRotation(w.up && !e.ground && e.family !== 'alien' ? Math.PI : 0);
      if (w.up && e.navigation?.customAnchor) {
        s.setVisible(false);
      } else if (w.up && e.navigation?.anchor !== undefined) {
        const isFortressTower = e.family === 'tower';
        const towerTex = this.textures.exists(PELAGIC_TOWER_CLEAN_SHEET) ? PELAGIC_TOWER_CLEAN_SHEET : TOWER_TEXTURE;
        const scl = isFortressTower ? 1.8 : 1.3;
        s.setVisible(true).setTexture(isFortressTower ? towerTex : EMPLACEMENT_TEXTURE, 0).setOrigin(.5, isFortressTower ? .78 : .5).setDisplaySize(e.size * scl, e.size * scl);
      }
      s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
      if (w.up && (e.family === 'boat' || e.family === 'ship')) {
        const hullFrame = Math.floor(time * 10 + e.id * 1.7) % 6;
        const hull = resolveHullVisualTransform(e, time);
        s.setTexture('arc-wet-hull-' + (e.family === 'boat' ? 4 : 5), hullFrame).setPosition(hull.drawX, hull.drawY).setDisplaySize(hull.displayW, hull.displayH).setRotation(hull.rotation).setDepth(hull.depth);
      }
      if (e.submarine) {
        const subTex = this.textures.exists(PELAGIC_SUB_CLEAN_SHEET) ? PELAGIC_SUB_CLEAN_SHEET : SUB_ART;
        s.setTexture(subTex, e.submarine.phase === 'hold' ? 1 : 0).setOrigin(.5, .57).setDisplaySize(e.size * 1.06, e.size * 1.06).setRotation(0).setFlipX(e.submarine.side > 0).setAlpha(e.submarine.exposure).setDepth(2);
        const subVis = clamp(e.submarine.exposure / .72, 0, 1);
        if (subVis < 1) {
          const rC = Math.round(58 + 197 * subVis), gC = Math.round(148 + 107 * subVis), bC = Math.round(202 + 53 * subVis);
          s.setTint((rC << 16) | (gC << 8) | bC);
        }
      }
      if (!w.up && e.ground) {
        let turret = this.turrets.get(e.id); if (!turret) { turret = this.add.sprite(e.x, e.y, 'arc-boss', 6).setDepth(5).setOrigin(.5, .5); this.turrets.set(e.id, turret); } const mount = { x: e.x, y: e.y - e.size * .09 }; const tSize = e.size * .56; turret.setPosition(mount.x, mount.y).setDisplaySize(tSize, tSize).setRotation(Math.atan2(w.player.y - mount.y, w.player.x - mount.x) - Math.PI); turret.clearTint().setTintMode(Phaser.TintModes.MULTIPLY); this.hitOverlays.draw(turret, e.flash);
      }

      if (!w.up && !e.ground) { g.lineStyle(1, 0xb6ffff, .3).lineBetween(e.x + e.size * .42, e.y, e.x + e.size * .76 + Math.sin(time * 25) * 2, e.y); if (['fighter', 'acrobat', 'bomber'].includes(e.family)) { const nose = e.x - e.size * .35; g.lineStyle(1.3, 0xffe36a, .7); g.lineBetween(nose, e.y - Math.cos(time * 45 + e.id) * e.size * .22, nose, e.y + Math.cos(time * 45 + e.id) * e.size * .22); } }
      if (!w.up) this.hitOverlays.draw(s, e.flash);
      // Discrete HP bar on damaged heavy enemies for clear damage readability
      const isHeavy = e.maxHp >= 120 || e.family === 'ship' || e.family === 'tower' || e.family === 'airship' || e.family === 'heli_warhawk' || Boolean(e.submarine);
      if (isHeavy && e.hp > 0 && e.hp < e.maxHp && e.y > w.arena.top + 8 && e.y < w.arena.bottom - 8) {
        const bw = clamp(e.size * 0.72, 24, 52);
        const bx = e.x - bw * 0.5;
        const by = e.y - e.size * 0.48 - 5;
        const ratio = clamp(e.hp / Math.max(1, e.maxHp), 0, 1);
        g.fillStyle(0x04122a, 0.85).fillRoundedRect(bx - 1, by - 1, bw + 2, 4.5, 2);
        g.fillStyle(ratio < 0.3 ? 0xff5a52 : ratio < 0.65 ? 0xffd84d : 0x38e4ff, 0.95).fillRoundedRect(bx, by, Math.max(2, bw * ratio), 2.5, 1);
      }
    } for (const [id, s] of this.enemySprites) if (!alive.has(id)) { s.destroy(); this.enemySprites.delete(id); this.turrets.get(id)?.destroy(); this.turrets.delete(id); }
    if (w.up) {
      this.pelagicAnims.updateEnemies(w, this.enemySprites, this.turrets, dt, this.quality, (sp, fl) => this.hitOverlays.draw(sp, fl), this.devWeaponDebug);
      for (const e of w.enemies) {
        if (e.hp <= 0) continue;
        const s = this.enemySprites.get(e.id); if (s && s.visible) this.hitOverlays.draw(s, e.flash);
      }
    }
    this.renderBoss(g);
    for (let i = 0; i < w.bullets.length; i++) {
      const b = w.bullets[i], s = this.bulletSprites[i]; s.setVisible(b.active); if (!b.active) continue;
      if (b.enemy && b.enemyMissile && this.textures.exists(PELAGIC_ENEMY_MISSILE_SHEET)) {
        s.clearTint().setTexture(PELAGIC_ENEMY_MISSILE_SHEET, Math.floor(b.age * 18) % 4).setDisplaySize(18, 28).setRotation(Math.atan2(b.vy, b.vx) - Math.PI / 2);
      } else if (b.enemy) {
        s.clearTint().setTexture('arc-orb-' + b.color).setDisplaySize(b.radius * 2 + 2.0, b.radius * 2 + 2.0).setRotation(0);
      } else if (b.charged) {
        const isFull = b.chargeTier === 'full';
        const art = w.up ? pelagicShotSize(w.weapons.weaponLevel) : rivetShotPresentation(w.weapons.weaponLevel);
        const bw = art.width * Math.max(1.25, b.scale * 0.9);
        const bh = art.height * Math.max(1.4, b.scale * 1.05);
        s.setTexture(w.up ? 'pelagic-plasma' : 'arc-red', w.up ? undefined : Math.floor(b.age * 20) % 8)
          .setDisplaySize(bw, bh)
          .setTint(isFull ? 0xfef08a : 0x67e8f9)
          .setRotation(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        const spd = Math.max(1, Math.hypot(b.vx, b.vy));
        const dx = (b.vx / spd) * (b.radius * 2.2 + 8);
        const dy = (b.vy / spd) * (b.radius * 2.2 + 8);
        g.lineStyle(b.radius * 1.1, isFull ? 0xfde047 : 0x38bdf8, 0.35).lineBetween(b.x, b.y, b.x - dx, b.y - dy);
        g.fillStyle(isFull ? 0xfef08a : 0xa5f3fc, 0.72).fillCircle(b.x, b.y, b.radius * 0.78);
        g.fillStyle(0xffffff, 0.92).fillCircle(b.x, b.y, b.radius * 0.38);
      } else {
        const art = w.up ? pelagicShotSize(w.weapons.weaponLevel) : rivetShotPresentation(w.weapons.weaponLevel);
        s.clearTint().setTexture(b.missile ? 'arc-missile' : w.up ? 'pelagic-plasma' : 'arc-red', w.up && !b.missile ? undefined : Math.floor(b.age * 20) % (b.missile ? 4 : 8)).setDisplaySize(b.missile ? 17 : art.width, b.missile ? 25 : art.height).setRotation(Math.atan2(b.vy, b.vx) + Math.PI / 2);
        if (!b.missile && w.pilotId !== 'nolan') s.setTint(w.pilotContract.projectileTint);
      }
      s.setPosition(b.x, b.y);
    }
    this.renderCargo(); this.renderObstacles(g);
    this.renderSpecialVisuals(w, g);
    for (const fx of this.effects) { fx.age += dt; fx.sprite.setPosition(fx.sprite.x + fx.vx * dt, fx.sprite.y + fx.vy * dt).setRotation(fx.sprite.rotation + fx.spin * dt).setAlpha(1 - fx.age / fx.duration * .7); fx.sprite.setFrame(Math.min(15, Math.floor(fx.age / fx.duration * 16))); }
    this.effects = this.effects.filter(f => { if (f.age >= f.duration) { f.sprite.setVisible(false); this.effectPool.push(f.sprite); return false; } return true; });
    this.updateBonusPopups(dt);
    this.updateCombatVfx(w, dt);
    this.renderHud(dt);
    if (w.up) {
      // Desktop Fenda Pelágica owns persistent radio inside Left Panel via PelagicDesktopHud
      this.radio.setVisible(false);
    } else if (this.clock > this.messageUntil) {
      this.radio.setVisible(false);
    }
  }
  private renderSpecialVisuals(w: ArcadeWorld, g: Phaser.GameObjects.Graphics): void {
    const spec = w.pilotContract.specialType;
    if (spec === 'scarlet' || w.specialTime <= 0) {
      this.bombArt.draw(w);
      return;
    }
    this.bombArt.draw(); // hide scarlet bomb sprite when other pilot special runs
    const t = this.clock;
    const p = clamp(w.specialTime / 2.2, 0, 1);
    if (spec === 'phantom') {
      const r = 104 + Math.sin(t * 14) * 8;
      g.fillStyle(0xb980ff, 0.14 * p).fillCircle(w.player.x, w.player.y, r);
      g.lineStyle(2.4, 0xd8b4fe, 0.85 * p).strokeCircle(w.player.x, w.player.y, r);
      g.lineStyle(1.4, 0x67e8f9, 0.65 * p).strokeCircle(w.player.x, w.player.y, r * 0.64);
    } else if (spec === 'orbital') {
      const cx = (w.arena.left + w.arena.right) * 0.5;
      for (const off of [-88, 0, 88]) {
        const bx = cx + off + Math.sin(t * 8 + off) * 14;
        g.fillStyle(0x34d399, 0.24 * p).fillRect(bx - 12, w.arena.top, 24, w.arena.bottom - w.arena.top);
        g.fillStyle(0xd1fae5, 0.68 * p).fillRect(bx - 3.5, w.arena.top, 7, w.arena.bottom - w.arena.top);
      }
    } else if (spec === 'nova') {
      const prog = 1 - p;
      const r = 36 + prog * 230;
      g.lineStyle(5 * p + 1.5, 0xff9f43, 0.9 * p).strokeCircle(w.player.x, w.player.y, r);
      g.lineStyle(2.2, 0xfef08a, 0.78 * p).strokeCircle(w.player.x, w.player.y, r * 0.72);
    } else if (spec === 'comet') {
      for (let i = 0; i < 4; i++) {
        const phase = ((t * 1.9 + i * 0.25) % 1);
        const sx = w.arena.left + ((i + 0.5) / 4) * w.arenaWidth;
        const sy = w.arena.bottom - phase * (w.arena.bottom - w.arena.top + 80);
        g.lineStyle(4, 0xfde047, 0.85 * p).lineBetween(sx - 18, sy + 52, sx + 12, sy - 20);
        g.fillStyle(0xffffff, 0.9 * p).fillCircle(sx + 12, sy - 20, 5.5);
      }
    }
  }
  private updateCombatVfx(w: ArcadeWorld, dt: number): void {
    const prefs = globalProfileStore.getSettings();
    const viewport = getCombatVirtualSize(this);
    const centerX = viewport.cx ?? viewport.w / 2;
    const centerY = viewport.cy ?? viewport.h / 2;
    // 1. Camera shake (only during active play, respects reducedShake accessibility option)
    if (this.screen === 'play' && this.shakeTime > 0 && !prefs.reducedShake) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      const decay = clamp(this.shakeTime / 0.25, 0, 1);
      const amp = this.shakeAmp * decay;
      this.cameras.main.centerOn(centerX + Math.sin(this.clock * 78) * amp, centerY + Math.cos(this.clock * 91) * amp);
    } else {
      this.shakeTime = 0;
      this.cameras.main.centerOn(centerX, centerY);
    }

    // 2. Screen-space damage vignette & banners
    const g = this.vfxGfx;
    g.clear();
    if (this.damageFlashAlpha > 0) {
      this.damageFlashAlpha = Math.max(0, this.damageFlashAlpha - dt * 1.4);
      if (!prefs.reducedFlash && this.screen === 'play') {
        const a = this.damageFlashAlpha * 0.45;
        g.lineStyle(18, 0xff2a4d, a).strokeRect(w.arena.left + 9, w.arena.top + 9, w.arenaWidth - 18, (w.arena.bottom - w.arena.top) - 18);
      }
    }

    const showBossWarn = this.screen === 'play' && this.clock < this.bossWarningUntil;
    if (showBossWarn) {
      const pulse = prefs.reducedFlash ? 0.85 : (0.58 + 0.42 * Math.abs(Math.sin(this.clock * 10)));
      const cx = (w.arena.left + w.arena.right) * 0.5;
      g.fillStyle(0x4a0614, 0.78 * pulse).fillRoundedRect(cx - 170, 92, 340, 32, 6);
      g.lineStyle(1.8, 0xff5a52, 0.92 * pulse).strokeRoundedRect(cx - 170, 92, 340, 32, 6);
      this.warningBannerText.setPosition(cx, 108).setText(w.up ? '⚠ ALERTA — COLOSSO ABISSAL' : '⚠ ALERTA — FORTALEZA SOLAR').setAlpha(pulse).setVisible(true);
    } else {
      this.warningBannerText.setVisible(false);
    }

    const showHint = this.screen === 'play' && this.clock < this.firstSortieHintUntil && !this.touchShown && w.state !== 'defeat';
    if (showHint) {
      const fade = clamp((this.firstSortieHintUntil - this.clock) / 0.8, 0, 1);
      const cx = (w.arena.left + w.arena.right) * 0.5;
      g.fillStyle(0x04122e, 0.68 * fade).fillRoundedRect(cx - 196, 405, 392, 20, 6);
      this.sortieHintText.setPosition(cx, 415).setText('WASD/SETAS MOVER  •  ESPAÇO TIRO  •  Z CARGA  •  X ESP  •  SHIFT FOCO').setAlpha(fade).setVisible(true);
    } else {
      this.sortieHintText.setVisible(false);
    }
  }
  private renderBoss(g: Phaser.GameObjects.Graphics): void {
    const w = this.world!, b = w.boss, live = new Set<number>();
    if (b?.sub) {
      this.bossSprite.setVisible(false);
      for (const [id, s] of this.partSprites) { s.destroy(); this.partSprites.delete(id); }
      this.subBossArt.draw(w, this.hitOverlays, g, this.quality);
      return;
    }
    this.subBossArt.hide();
    const bossAlive = !!b && b.phase !== 'absent' && b.phase !== 'sink';
    this.bossSprite.setVisible(bossAlive);
    if (bossAlive) {
      const frame = w.up ? (b.mini ? 2 : b.configuration === 1 ? 0 : 1) : (b.mini ? 5 : 4);
      const bob = w.up && b.phase === 'fight' ? Math.sin(w.elapsed * 2.4) * 1.4 : 0;
      this.bossSprite.setTexture(w.up ? 'arc-wet-boss-' + frame : 'arc-boss', w.up ? 0 : frame).setPosition(b.x, b.y + bob).setDisplaySize(b.size, b.size).setAlpha(1).setAngle(0);
      this.hitOverlays.draw(this.bossSprite, b.flash ?? 0);
      if (w.up) {
        for (const sign of [-1, 1]) {
          const px = b.x + sign * b.size * .27, py = b.y + bob + b.size * .29;
          g.fillStyle(0xf2ffff, .52).fillEllipse(px, py + Math.sin(w.elapsed * 5 + sign) * 1.2, 7, 3);
          g.fillStyle(0x9cf5ff, .38).fillEllipse(b.x + sign * b.size * .08, b.y + bob + b.size * .36, 8, 3.2);
        }
      }
      for (const p of b.parts) {
        live.add(p.id); let s = this.partSprites.get(p.id); if (!s) { s = this.add.sprite(p.x, p.y, 'arc-boss', w.up ? 3 : 6).setDepth(7); this.partSprites.set(p.id, s); } s.setTexture(p.hp > 0 ? 'arc-boss' : EMPLACEMENT_TEXTURE, p.hp > 0 ? (w.up ? 3 : 6) : 1).setPosition(p.x, p.y + bob).setDisplaySize(p.radius * 2.65, p.radius * 2.65).setVisible(true).setRotation(p.hp > 0 ? p.angle - (w.up ? Math.PI / 2 : Math.PI) : 0);
        s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY); this.hitOverlays.draw(s, p.flash);
        if (p.hp > 0 && p.warning > 0) { g.fillStyle(0xff5a52, p.warning * .65); const a = p.angle; g.fillEllipse(p.x + Math.cos(a) * p.radius, p.y + bob + Math.sin(a) * p.radius, 3 + p.warning * 3, 3 + p.warning * 3); }
      }
      if (!w.up) { for (const sign of [-1, 1]) { const px = b.x + b.size * .27, py = b.y + sign * b.size * .19; g.lineStyle(3, 0xceffff, .75); g.lineBetween(px - Math.cos(w.elapsed * 35) * 13, py - Math.sin(w.elapsed * 35) * 13, px + Math.cos(w.elapsed * 35) * 13, py + Math.sin(w.elapsed * 35) * 13); } }
    } for (const [id, s] of this.partSprites) if (!live.has(id)) { s.destroy(); this.partSprites.delete(id); }
  }
  private renderCargo(): void {
    const w = this.world!, ids = new Set<number>();
    for (const c of w.cargo) {
      ids.add(c.id);
      let sprite = this.cargoSprites.get(c.id);
      let extras = this.cargoExtras.get(c.id);
      if (!sprite || !extras) {
        sprite?.destroy();
        if (extras) { extras.shadow.destroy(); extras.glow.destroy(); extras.prop.destroy(); }
        sprite = this.add.sprite(c.x, c.y, c.crate ? SUPPLY_DRONE_BODY_ART : SUPPLY_ART, 0).setDepth(13);
        const shadow = this.add.image(c.x, c.y + 8, SUPPLY_SHADOW_ART).setDepth(12.6);
        const glow = this.add.image(c.x, c.y, SUPPLY_GLOW_ART).setDepth(12.8).setBlendMode(Phaser.BlendModes.ADD);
        const prop = this.add.sprite(c.x, c.y, SUPPLY_DRONE_PROP_ART).setDepth(13.2).setVisible(false);
        this.cargoSprites.set(c.id, sprite);
        extras = { shadow, glow, prop };
        this.cargoExtras.set(c.id, extras);
      }

      if (c.crate) {
        const d = c.drone;
        const hoverBob = Math.sin(c.age * 4.8 + c.id) * 1.1;
        const recoilX = d ? Math.sin(c.age * 55) * d.hitRecoil * 1.8 : 0;
        const recoilY = d ? -d.hitRecoil * 1.4 : 0;
        const rx = c.x + recoilX;
        const ry = c.y + hoverBob + recoilY;
        const breathe = 1 + Math.sin(c.age * 4.5 + c.id) * 0.02;
        const bodySize = SUPPLY_DRONE_DISPLAY_SIZE * breathe;
        const propSize = SUPPLY_DRONE_PROP_SIZE * breathe;
        const tiltDeg = clamp(c.vx * 0.14, -5, 5);

        if (sprite.texture.key !== SUPPLY_DRONE_BODY_ART) sprite.setTexture(SUPPLY_DRONE_BODY_ART);
        sprite
          .setOrigin(0.5, 0.5)
          .setPosition(rx, ry)
          .setDisplaySize(bodySize, bodySize)
          .setAngle(tiltDeg)
          .setAlpha(1)
          .clearTint();
        this.hitOverlays.draw(sprite, c.flash ?? 0);

        const rotorAngle = d ? d.rotorAngle : (c.age * 14.5) % (Math.PI * 2);
        extras.prop
          .setVisible(true)
          .setOrigin(0.5, 0.5)
          .setPosition(rx, ry)
          .setDisplaySize(propSize, propSize)
          .setRotation(rotorAngle)
          .setAlpha(1)
          .clearTint();

        const washPulse = 0.22 + Math.sin(c.age * 11 + c.id) * 0.06;
        extras.glow
          .setVisible(true)
          .setPosition(rx, ry)
          .setDisplaySize(bodySize * 1.42, bodySize * 1.42)
          .setTint(0x3ce6ff)
          .setAlpha(washPulse);

        extras.shadow
          .setVisible(true)
          .setPosition(c.x + 3, c.y + 7 + hoverBob * 0.35)
          .setDisplaySize(bodySize * 0.96, bodySize * 0.74)
          .setAlpha(0.68);
      } else {
        // Released supply icon (rows 1..3 of supply-items.png: P, Heart, Bomb — never balloon row 0)
        const start = c.kind === 'power' ? 4 : c.kind === 'life' ? 8 : 12;
        const frame = start + (Math.floor(c.age * 8) % 4);
        const recoveryCapsule = c.kind === 'power' && (c.recoveryP ?? 0) > 0;
        const pop = c.dropPop ?? 0;
        const popScale = pop > 0 ? 1 + Math.sin(pop * Math.PI) * 0.28 : 1;
        const breathe = 1 + Math.sin(c.age * 5.4 + c.id) * 0.055;
        const baseSize = recoveryCapsule ? 34 : 31;
        const displaySize = baseSize * popScale * breathe;
        const bobY = Math.sin(c.age * 5.2 + c.id) * 2.4;
        const swayDeg = Math.sin(c.age * 3.8 + c.id) * 5.5;
        const auraColor = recoveryCapsule ? 0xffe45e : c.kind === 'power' ? 0x38dfff : c.kind === 'life' ? 0xff5a7a : 0xff9b36;
        const auraAlpha = 0.44 + Math.sin(c.age * 6.4 + c.id) * 0.14;

        if (sprite.texture.key !== SUPPLY_ART) sprite.setTexture(SUPPLY_ART, frame);
        sprite
          .setFrame(frame)
          .setOrigin(0.5, 0.5)
          .setPosition(c.x, c.y + bobY)
          .setDisplaySize(displaySize, displaySize)
          .setAngle(swayDeg)
          .setAlpha(1);
        if (recoveryCapsule) sprite.setTint(0xffe970); else sprite.clearTint();

        extras.prop.setVisible(false);
        extras.glow
          .setVisible(true)
          .setPosition(c.x, c.y + bobY)
          .setDisplaySize(displaySize * 1.65, displaySize * 1.65)
          .setTint(auraColor)
          .setAlpha(auraAlpha);
        extras.shadow
          .setVisible(true)
          .setPosition(c.x + 2.5, c.y + 8)
          .setDisplaySize(displaySize * 0.96, displaySize * 0.64)
          .setAlpha(0.68);
      }
    }
    for (const [id, sprite] of this.cargoSprites) {
      if (!ids.has(id)) {
        sprite.destroy();
        this.cargoSprites.delete(id);
        const ex = this.cargoExtras.get(id);
        if (ex) { ex.shadow.destroy(); ex.glow.destroy(); ex.prop.destroy(); this.cargoExtras.delete(id); }
      }
    }
  }
  private renderObstacles(g: Phaser.GameObjects.Graphics): void {
    for (const o of this.world!.obstacles) {
      g.fillStyle(o.kind === 'barrier' ? 0xffbf59 : 0x3f7e9c).fillRoundedRect(o.x - o.width / 2, o.y - o.height / 2, o.width, o.height, 4); g.lineStyle(3, 0xffec76).strokeRoundedRect(o.x - o.width / 2, o.y - o.height / 2, o.width, o.height, 4);
      if (o.kind === 'barrier') { g.lineStyle(2, 0xfff5c5).lineBetween(o.x - 9, o.y - 19, o.x + 8, o.y + 18); g.lineBetween(o.x + 8, o.y - 19, o.x - 9, o.y + 18); }
      else { g.fillStyle(0xa4f0e7, .8); for (let yy = o.y - o.height / 2 + 14; yy < o.y + o.height / 2 - 8; yy += 22)for (let xx = o.x - o.width / 2 + 21; xx < o.x + o.width / 2 - 15; xx += 17)g.fillRoundedRect(xx, yy, 10, 12, 2); g.lineStyle(2, 0x214c72).lineBetween(o.x, o.y - o.height / 2 + 6, o.x, o.y + o.height / 2 - 6); }
      for (let y = o.y - o.height / 2 + 5; y < o.y + o.height / 2; y += 13) { g.lineStyle(4, 0x214c72).lineBetween(o.x - o.width / 2 + 2, y, o.x - o.width / 2 + 12, y + 8); g.lineBetween(o.x + o.width / 2 - 12, y, o.x + o.width / 2 - 2, y + 8); }
      if (o.warning > 0 || o.x > 735) { g.fillStyle(0xff6857, .85).fillTriangle(731, o.y - 8, 731, o.y + 8, 718, o.y); }
    }
  }
  private renderHud(dt = 0): void {
    const w = this.world!, g = this.decor; g.clear();
    if (w.up) {
      const cpVisible = this.clock < this.checkpointBannerUntil && this.screen === 'play';
      if (this.portraitUpActive) {
        this.pelagicDesktopHud.setVisible(false);
        this.hud.setVisible(true);
        // Android Portrait HUD: compact essential top strip only (no side panels, no Bayek portrait, no radio).
        g.fillStyle(0x051936, .90).fillRoundedRect(4, 3, 376, 26, 7);
        g.lineStyle(1.3, 0x26dcff, .85).strokeRoundedRect(4, 3, 376, 26, 7);
        this.lifeIcons.forEach((sprite, i) => sprite.setPosition(16 + i * 13.5, 16).setDisplaySize(12.5, 15).setVisible(true).setAlpha(i < w.lives ? 1 : .20));
        this.pelagicLevel.setFontSize(9.5).setOrigin(0, .5).setPosition(90, 16).setText(`NV ${w.weapons.weaponLevel}`).setVisible(true);
        for (let i = 0; i < 5; i++) {
          g.fillStyle(i < w.weapons.weaponLevel ? 0x21e3f4 : 0x103d68).fillRoundedRect(122 + i * 11, 11.5, 9, 8.5, 2);
          g.lineStyle(.6, 0x83edff, .7).strokeRoundedRect(122 + i * 11, 11.5, 9, 8.5, 2);
        }
        const sx = 188;
        g.fillStyle(0xffdc39).beginPath().moveTo(sx + 2, 8).lineTo(sx - 3, 16).lineTo(sx, 16).lineTo(sx - 2, 24).lineTo(sx + 5, 14).lineTo(sx + 1, 14).closePath().fillPath();
        this.pelagicSpecialText.setPosition(sx + 9, 16).setText(`${w.weapons.specialCharges}`).setVisible(true);
        const cPort = w.chargedShot.snapshot();
        if (cPort.ratio > 0) {
          g.fillStyle(0x051936, 0.9).fillRoundedRect(122, 23, 53, 4, 2);
          g.fillStyle(cPort.isFull ? 0xfef08a : 0x38bdf8, 0.96).fillRoundedRect(122, 23, Math.max(3, 53 * cPort.ratio), 4, 2);
        }
        const scoreLine = String(w.score).padStart(6, '0');
        if (scoreLine !== this.lastHud) {
          this.hud.setFontSize(13).setColor('#ffe654').setStroke('#032f74', 2).setOrigin(1, .5);
          this.hud.setText(scoreLine).setPosition(344, 16);
          this.lastHud = scoreLine;
        }
        this.pelagicAssistBadge.setVisible(false);
        this.pelagicCheckpointBadge.setPosition(192, 46).setVisible(cpVisible);
        if (w.boss?.sub && w.boss.sub.phase !== 'done') {
          const sub = w.boss.sub, sec = sub.sections[sub.activeSection], totals = subTotalHp(sub);
          const ratio = totals.max > 0 ? clamp(totals.current / totals.max, 0, 1) : 0;
          g.fillStyle(0x051936, .88).fillRoundedRect(8, 32, 368, 12, 4);
          if (ratio > 0) g.fillStyle(ratio < .25 ? 0xff6e54 : 0xffd84d, .95).fillRoundedRect(12, 35, 360 * ratio, 6, 2);
          this.bossHudLabel.setPosition(16, 38).setFontSize(8).setText(`${sec.index + 1}/5 ${sec.name}`).setVisible(true);
        } else {
          this.bossHudLabel.setVisible(false);
        }
        return;
      }

      // PC Horizontal Layout: 160 / 448 / 160 modular arcade HUD (X = 160..608, Y = 0..432)
      this.hud.setVisible(false);
      this.radio.setVisible(false);
      this.pelagicSpecialText.setVisible(false);
      this.pelagicCheckpointBadge.setPosition(384, 40).setVisible(cpVisible);
      this.pelagicDesktopHud.draw(
        w,
        this.lifeIcons,
        this.pelagicLevel,
        this.pelagicAssistBadge,
        this.bossHudLabel,
        this.pelagicComms.current(),
        '',
        w.state === 'intro',
        this.clock,
        dt,
      );
    } else {
      this.pelagicDesktopHud.setVisible(false);
      this.hud.setVisible(true);
      this.bossHudLabel.setVisible(false);
      this.pelagicAssistBadge.setVisible(false);
      this.pelagicCheckpointBadge.setVisible(false);
      this.pelagicSpecialText.setVisible(false);
      // Side-scrolling mission and its horizontal score bar are unchanged.
      g.fillStyle(BLUE, .92).fillRoundedRect(9, 5, 750, 29, 10);
      g.lineStyle(1, 0x8ee5e4, .7).strokeRoundedRect(9, 5, 750, 29, 10);
      const line = `${w.pilotContract.name.toUpperCase()} / ${w.pilotContract.shipName}     ${w.score}     NV ${w.weapons.weaponLevel} ${w.weapons.powerMeter ? `+${w.weapons.powerMeter}P` : ''}`;
      if (line !== this.lastHud) {
        this.hud.setFontSize(11).setColor('#ffffff').setStroke('#153550', 3).setOrigin(0, 0);
        this.hud.setText(line).setPosition(22, 13);
        this.lastHud = line;
      }
      this.lifeIcons.forEach((sprite, i) => sprite.setPosition(447 + i * 17, 19).setDisplaySize(15, 19).setVisible(true).setAlpha(i < w.lives ? 1 : .18));
      for (let i = 0; i < 5; i++) {
        const x = 589 + i * 20; g.fillStyle(i < w.weapons.specialCharges ? 0xffd95a : 0x45718a);
        g.beginPath().moveTo(x + 2, 9).lineTo(x - 5, 20).lineTo(x, 20).lineTo(x - 2, 29).lineTo(x + 7, 16).lineTo(x + 2, 16).closePath().fillPath();
      }
      const cSide = w.chargedShot.snapshot();
      if (cSide.ratio > 0) {
        g.fillStyle(0x041430, 0.92).fillRoundedRect(326, 22, 96, 6, 3);
        g.fillStyle(cSide.isFull ? 0xfef08a : 0x38bdf8, 0.96).fillRoundedRect(326, 22, Math.max(4, 96 * cSide.ratio), 6, 3);
        g.lineStyle(0.9, cSide.isFull ? 0xfef08a : 0x67e8f9, 0.9).strokeRoundedRect(326, 22, 96, 6, 3);
      }
    }
    if (w.state === 'intro' && !w.up) {
      g.fillStyle(0xffe77d, .95).fillRoundedRect(220, 170, 328, 75, 12);
      const label = w.mission.name;
      this.radio.setOrigin(.5).setText(`MISSÃO ${this.currentMission + 1}\n${label}`).setPosition(384, 207).setVisible(true);
      this.messageUntil = this.clock + .5;
    }
  }
  private consumeEvents(): void {
    const w = this.world!; for (const e of w.events) {
      if (e.type === 'shot') { globalAudio.playShot(w.pilotId, w.weapons.weaponLevel); if (w.up) this.pelagicAnims.triggerShot(); }
      else if (e.type === 'charge-windup') { globalAudio.playChargeWindup(e.size ?? 0); }
      else if (e.type === 'charge-full') { globalAudio.playArcade('bonus'); }
      else if (e.type === 'charged-shot') {
        const intensity = e.size ?? 1;
        globalAudio.playChargedShot(w.pilotId, intensity >= 1.5 ? 2 : 1);
        if (w.up) this.pelagicAnims.triggerShot();
        this.explosion(e.x, e.y, intensity >= 1.5 ? 18 : 12, .16);
      }
      else if (e.type === 'missile') { globalAudio.playMissile(); if (w.up) this.pelagicAnims.triggerMissile(); }
      else if (e.type === 'level-up') {
        globalAudio.playArcade('level-up');
        this.spawnBonusPopup(e.x, e.y - 8, 100, e.text ?? `NV ${w.weapons.weaponLevel}`);
      }
      else if (e.type === 'boss-warning') {
        globalAudio.playArcade('boss-warning');
        this.bossWarningUntil = this.clock + 3.0;
        this.shakeTime = 0.25;
        this.shakeAmp = 2.6;
      }
      else if (e.type === 'graze') {
        globalAudio.playArcade('graze');
        if (w.grazeCount % 5 === 1) this.spawnBonusPopup(e.x, e.y, 25, 'GRAZE');
      }
      else if (e.type === 'death') {
        this.shakeTime = 0.34;
        this.shakeAmp = 4.6;
        this.damageFlashAlpha = 1;
        if (w.lives <= 1) globalAudio.playArcade('low-life');
        if (w.up) { this.pelagicAnims.triggerPlayerDamage(); this.pelagicComms.trigger({ category: 'damage', detail: w.lives <= 1 ? 'low-lives' : undefined }); }
      }
      else if (e.type === 'enemy-shot') { globalAudio.playArcade(w.boss ? 'cannon' : 'orb'); if (w.up) this.pelagicAnims.triggerEnemyShot(e.x, e.y, e.size ?? 1); }
      else if (e.type === 'impact') { globalAudio.playArcade('impact'); if (this.effects.length < 18 + this.quality * 18) this.explosion(e.x, e.y, 10, .12); }
      else if (e.type === 'explosion') {
        const sz = e.size ?? 1;
        globalAudio.playArcade(sz > 1.3 ? 'boom' : 'pop');
        if (sz >= 1.6) { this.shakeTime = Math.max(this.shakeTime, 0.2); this.shakeAmp = Math.max(this.shakeAmp, 3.0); }
        if (e.text !== 'special-blast') { this.layeredExplosion(e); if (w.up) this.pelagicAnims.spawnEnemyDestruction(e.x, e.y, e.text, sz, this.quality); }
      }
      else if (e.type === 'pickup') globalAudio.playPickup(e.text ?? 'power');
      else if (e.type === 'special') {
        globalAudio.playSpecial(w.pilotContract.specialType);
        this.shakeTime = Math.max(this.shakeTime, 0.28);
        this.shakeAmp = Math.max(this.shakeAmp, 3.8);
      }
      else if (e.type === 'bonus') { globalAudio.playArcade('bonus'); this.spawnBonusPopup(e.x, e.y, e.size ?? 0, e.text); }
      else if (e.type === 'arch') {
        if (e.text === 'descent') globalAudio.playArcade('arch-descent');
        else if (e.text === 'ascent') globalAudio.playArcade('arch-ascent');
      }
      else if (e.type === 'checkpoint') {
        globalAudio.playArcade('checkpoint');
        this.checkpointBannerUntil = this.clock + 3.4;
        if (w.checkpoint) this.activeCheckpointSnapshot = structuredClone(w.checkpoint);
      }
      else if (e.type === 'comms' && w.up) { this.pushPelagicCommsEvent(e.text ?? ''); }
      else if (e.type === 'boss' || e.type === 'mini') {
        this.audio.play(e.type === 'mini' ? (w.up ? 'mini1' : 'mini2') : (w.up ? 'boss1' : 'boss2'));
        if (w.up) {
          if (e.type === 'mini') this.pelagicComms.trigger({ category: 'miniboss' });
          else if (!w.boss?.sub) this.pelagicComms.trigger({ category: 'boss', text: e.text });
        } else {
          this.message(e.text ?? '');
        }
      }
      else if (e.type === 'return') { globalAudio.playArcade('transition'); if (w.up) this.pelagicComms.trigger({ category: 'boss', text: e.text ?? 'Avançando sobre o colosso!' }); else this.message(e.text ?? 'AVANÇANDO!'); }
      else if (e.type === 'victory') { this.audio.play('victory'); if (w.up) this.pelagicComms.trigger({ category: 'victory' }); else this.message('BAYEK: ESSA FOI PARA A EQUIPE!'); }
      else if (e.type === 'radio') {
        if (w.up) {
          const txt = e.text ?? '';
          if (txt.includes('REATOR CRÍTICO')) this.pelagicComms.trigger({ category: 'boss', detail: 'collapse', text: txt });
          else if (txt.includes('COLOSSO') || w.boss?.sub) this.pelagicComms.trigger({ category: 'boss', text: txt });
          else if (txt.includes('pista está livre')) this.pelagicComms.trigger({ category: 'miniboss', detail: 'clear', text: txt });
          else if (txt) this.pelagicComms.trigger({ category: 'special-event', text: txt });
        } else {
          this.message(e.text ?? '');
        }
        if (!w.boss && w.route > 155) this.audio.play(w.up ? 'stage1' : 'stage2');
      }
    } w.events.length = 0;
  }
  private pushPelagicCommsEvent(code: string): void {
    if (code === 'start') {
      this.pelagicComms.trigger({ category: 'start' });
    } else if (code === 'submarine') {
      this.pelagicComms.trigger({ category: 'submarine' });
    } else if (code.startsWith('threat:')) {
      this.pelagicComms.trigger({ category: 'threat', detail: code.slice(7) });
    } else if (code.startsWith('pickup:')) {
      this.pelagicComms.trigger({ category: 'pickup', detail: code.slice(7) });
    } else if (code === 'assist-drop') {
      this.pelagicComms.trigger({ category: 'special-event', text: 'Modo Assistido!\nColete o P dourado!' });
    } else if (code.startsWith('arch:')) {
      this.pelagicComms.trigger({ category: 'arch', detail: code.slice(5) });
    }
  }
  private clearBonusPopups(): void {
    for (const p of this.bonusPopups) { p.node.setVisible(false); this.bonusPopupPool.push(p.node); }
    this.bonusPopups = [];
  }
  private spawnBonusPopup(x: number, y: number, points: number, label?: string): void {
    if (!this.world?.up || points <= 0) return;
    if (this.bonusPopups.length >= 10) {
      const oldest = this.bonusPopups.shift();
      if (oldest) { oldest.node.setVisible(false); this.bonusPopupPool.push(oldest.node); }
    }
    const px = clamp(x, this.world.arena.left + 32, this.world.arena.right - 32);
    let py = clamp(y - 10, this.world.arena.top + 18, this.world.arena.bottom - 38);
    for (const active of this.bonusPopups) {
      if (active.age < 0.35 && Math.abs(active.node.x - px) < 76 && Math.abs(active.node.y - py) < 16) py = clamp(py - 16, this.world.arena.top + 14, this.world.arena.bottom - 38);
    }
    const sectorOrPerf = !!label && (label.startsWith('SETOR') || label.startsWith('COLOSSO') || label.startsWith('PATRULHA'));
    const color = sectorOrPerf ? '#8ef6ff' : '#ffe654';
    const text = label ? `+${points} ${label}` : `+${points}`;
    const node = (this.bonusPopupPool.pop() ?? this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '10.5px', fontStyle: 'bold', color: '#ffe654',
      stroke: '#041430', strokeThickness: 2, align: 'center',
    }).setResolution(2).setOrigin(.5).setDepth(14.2))
      .setText(text).setColor(color).setPosition(px, py).setScale(.86).setAlpha(0).setVisible(true);
    this.bonusPopups.push({ node, age: 0, duration: .95, y0: py });
  }
  private updateBonusPopups(dt: number): void {
    if (!this.bonusPopups.length) return;
    this.bonusPopups = this.bonusPopups.filter(p => {
      p.age += dt;
      if (p.age >= p.duration) { p.node.setVisible(false); this.bonusPopupPool.push(p.node); return false; }
      const u = p.age / p.duration;
      const fadeIn = Math.min(1, u / .14);
      const fadeOut = u > .55 ? 1 - (u - .55) / .45 : 1;
      const scale = u < .18 ? .86 + .18 * (u / .18) : 1.04 - .04 * ((u - .18) / .82);
      p.node.setPosition(p.node.x, p.y0 - 24 * u).setScale(scale).setAlpha(.92 * fadeIn * fadeOut);
      return true;
    });
  }
  private effectSprite(x: number, y: number, texture: string, frame = 0): Phaser.GameObjects.Sprite { return (this.effectPool.pop() ?? this.add.sprite(x, y, texture)).setTexture(texture, frame).setPosition(x, y).setDepth(20).setRotation(0).setAlpha(1).setVisible(true).clearTint(); }
  private explosion(x: number, y: number, size: number, duration = .42, vx = 0, vy = 0, spin = 0): void { if (this.effects.length > 80) return; const sprite = this.effectSprite(x, y, 'arc-explosion').setDisplaySize(size, size); this.effects.push({ sprite, age: 0, duration, size, vx, vy, spin }); }
  private layeredExplosion(e: WorldEvent): void { const size = e.size ?? 1; this.explosion(e.x, e.y, 36 * size, .46); if (size > 1) for (let i = 0; i < 3 + this.quality; i++)this.explosion(e.x + Math.cos(i * 2.4) * size * 13, e.y + Math.sin(i * 2.4) * size * 13, 22 * size, .3 + i * .055, Math.cos(i) * 16, Math.sin(i) * 16); }
  private message(text: string): void {
    const up = !!this.world?.up;
    this.radio.setOrigin(up ? 0 : .5, up ? 0 : .5).setText(text)
      .setPosition(up ? 602 : 384, up ? 281 : 65).setVisible(true);
    this.messageUntil = this.clock + (up ? 6 : 3.3);
  }
  private bestScoreFor(stageId?: number): number {
    const rec = globalSave.getData().bestScores;
    if (stageId !== undefined) return rec[stageId]?.score ?? 0;
    const vals = Object.values(rec).map(r => r.score);
    return vals.length ? Math.max(0, ...vals) : 0;
  }
  private arcadeProgress() { try { return readArcadeProgress(localStorage.getItem('bullet_wake_arcade_v1')); } catch { return readArcadeProgress(null); } }
  private saveClear(): void {
    if (this.devSaveGuard || this.stageClearSaved || !this.world) return;
    this.stageClearSaved = true;
    const w = this.world;
    this.carried = stageFlightSnapshot(w.mission.id, w.weapons, w.lives, w.score);
    if (!w.practiceMode) {
      const data = recordArcadeClear(this.arcadeProgress(), this.carried);
      try { localStorage.setItem('bullet_wake_arcade_v1', JSON.stringify(data)); } catch {/* Memory carry still supports next stage. */ }
      globalSave.recordStageClear(w.mission.id, w.pilotId, w.score, this.carried);
      this.replayRecorder?.finish();
      const { evaluation, achievements } = w.evaluateRun(true);
      const outcome = globalProfileStore.recordRunResult({
        runId: `m${w.mission.id}:${w.seed}:${Math.round(w.elapsed * 100)}:${w.score}:win`,
        missionId: w.mission.id,
        pilotId: w.pilotId,
        difficulty: w.difficulty,
        score: w.score,
        rank: evaluation.rank,
        victory: true,
        competitiveEligible: evaluation.competitiveEligible,
        assisted: w.isAssisted,
        noMiss: evaluation.badges.includes('NO-MISS'),
        noBomb: evaluation.badges.includes('NO-BOMB'),
        oneCC: evaluation.badges.includes('1CC'),
        creditsEarned: evaluation.creditsEarned,
        achievements,
        flight: this.carried,
      });
      this.lastRunOutcome = { ...outcome, evaluation };
    } else {
      this.lastRunOutcome = undefined;
    }
  }
  private recordDefeatProgress(): RunOutcome | undefined {
    if (this.devSaveGuard || this.defeatRecorded || !this.world) return this.lastRunOutcome;
    this.defeatRecorded = true;
    const w = this.world;
    if (w.practiceMode) return undefined;
    const { evaluation, achievements } = w.evaluateRun(false);
    const outcome = globalProfileStore.recordRunResult({
      runId: `m${w.mission.id}:${w.seed}:${Math.round(w.elapsed * 100)}:${w.score}:loss`,
      missionId: w.mission.id,
      pilotId: w.pilotId,
      difficulty: w.difficulty,
      score: w.score,
      rank: evaluation.rank,
      victory: false,
      competitiveEligible: evaluation.competitiveEligible,
      assisted: w.isAssisted,
      noMiss: evaluation.badges.includes('NO-MISS'),
      noBomb: evaluation.badges.includes('NO-BOMB'),
      oneCC: evaluation.badges.includes('1CC'),
      creditsEarned: evaluation.creditsEarned,
      achievements,
    });
    this.lastRunOutcome = { ...outcome, evaluation };
    return this.lastRunOutcome;
  }
  private readViewportSafeInsets(): SafeAreaInsets {
    try {
      const cs = getComputedStyle(document.documentElement);
      const px = (name: string) => Number.parseFloat(cs.getPropertyValue(name) || '0') || 0;
      const vSize = getCombatVirtualSize(this);
      const rect = this.game.canvas?.getBoundingClientRect();
      return computeWorldSafeInsets(rect, { width: window.innerWidth, height: window.innerHeight }, {
        top: px('--sat'),
        right: px('--sar'),
        bottom: px('--sab'),
        left: px('--sal'),
      }, vSize.w, vSize.h);
    } catch {
      return { top: 0, right: 0, bottom: 0, left: 0 };
    }
  }
  private triggerPause(): void {
    if (this.screen !== 'play') return;
    this.touchController.clearAll();
    this.renderTouchOverlay();
    this.show('pause');
  }
  private syncPauseButton(): void {
    if (this.screen !== 'play' || !this.world) return;
    this.pauseBtn?.destroy();
    const isDesktopPelagic = !!this.world.up && !this.touchShown && !this.portraitUpActive;
    const container = this.add.container(0, 0).setDepth(68);
    if (isDesktopPelagic) {
      // Discrete futuristic top-right Pause button inside Right Panel [608..768], clear of RIVET/VANGUARDA
      container.setPosition(746, 18).setSize(32, 24);
      const bg = this.add.graphics();
      const drawCompactPc = (focused: boolean) => {
        bg.clear()
          .fillStyle(focused ? 0x0f3b76 : 0x041a44, .96)
          .fillRoundedRect(-11, -8, 22, 16, 4.5)
          .lineStyle(1.4, focused ? 0xffe46b : 0x4ee6ff, .96)
          .strokeRoundedRect(-11, -8, 22, 16, 4.5)
          .fillStyle(focused ? 0xffffff : 0xffdf33, 1)
          .fillRoundedRect(-3.6, -4.2, 2.4, 8.4, 0.8)
          .fillRoundedRect(1.2, -4.2, 2.4, 8.4, 0.8);
      };
      drawCompactPc(false);
      container.add(bg);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', () => drawCompactPc(true));
      container.on('pointerout', () => drawCompactPc(false));
    } else {
      const pPos = this.world.up ? this.touchController.getLayout().pause : { x: 734, y: 19 };
      const w = 36, h = 19;
      container.setPosition(pPos.x, pPos.y).setSize(44, 24);
      const bg = this.add.graphics();
      const drawCompact = (focused: boolean) => {
        bg.clear()
          .fillStyle(focused ? 0x10407c : 0x07214a, .94)
          .fillRoundedRect(-w / 2, -h / 2, w, h, 6)
          .lineStyle(1.4, focused ? 0xffe46b : 0x3ce5ff, .96)
          .strokeRoundedRect(-w / 2, -h / 2, w, h, 6)
          .fillStyle(focused ? 0xffffff : 0xfff2a1, 1)
          .fillRoundedRect(-5, -4.5, 3, 9, 1)
          .fillRoundedRect(2, -4.5, 3, 9, 1);
      };
      drawCompact(false);
      container.add(bg);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', () => drawCompact(true));
      container.on('pointerout', () => drawCompact(false));
    }
    container.on('pointerdown', () => this.triggerPause());
    this.ui.add(container);
    this.pauseBtn = container;
  }
  private refreshTouchLayout(): void {
    const portH = this.portraitUpActive ? getCombatVirtualSize(this).h : undefined;
    this.touchController.configure(globalSave.getSettings().touch, this.readViewportSafeInsets(), portH);
    this.syncPauseButton();
    this.renderTouchOverlay();
  }
  private renderTouchOverlay(): void {
    if (!this.touchGfx) return;
    if (!this.touchShown) {
      this.touchGfx.clear();
      return;
    }
    const g = this.touchGfx;
    const l = this.touchController.getLayout();
    const out = this.touchController.peek();
    const op = l.opacity;
    g.clear();

    // 1. Virtual joystick (translucent cockpit-harmonized ring + 8-way ticks + live puck)
    const ox = out.stickOriginX, oy = out.stickOriginY, jr = l.joystick.radius;
    g.fillStyle(0x071a38, op * 0.34).fillCircle(ox, oy, jr);
    g.lineStyle(1.7, out.stickActive ? 0xa3fbff : 0x5be0ff, Math.min(0.95, op * (out.stickActive ? 1.45 : 1.05))).strokeCircle(ox, oy, jr);
    g.lineStyle(1, 0xd8ffff, op * 0.42).strokeCircle(ox, oy, jr * 0.54);
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4;
      const r0 = jr - 4.5, r1 = jr - 1.2;
      g.lineStyle(1.1, 0x7aefff, op * 0.6).lineBetween(ox + Math.cos(ang) * r0, oy + Math.sin(ang) * r0, ox + Math.cos(ang) * r1, oy + Math.sin(ang) * r1);
    }
    if (out.stickActive) {
      g.lineStyle(2, 0x8ef7ff, op * 0.65).lineBetween(ox, oy, out.knobX, out.knobY);
    }
    g.fillStyle(out.stickActive ? 0x2a7ec2 : 0x154470, Math.min(0.88, op * 1.05)).fillCircle(out.knobX, out.knobY, l.joystick.knobRadius);
    g.lineStyle(1.5, 0xe8ffff, Math.min(0.95, op * 1.35)).strokeCircle(out.knobX, out.knobY, l.joystick.knobRadius);

    // 2. Primary FIRE button (separated cleanly from Special)
    const fx = l.fire.x, fy = l.fire.y, fr = l.fire.radius;
    g.fillStyle(out.firePressed ? 0xffe062 : 0x261f0b, op * (out.firePressed ? 0.72 : 0.36)).fillCircle(fx, fy, fr);
    g.lineStyle(1.8, 0xffdf5a, Math.min(0.96, op * (out.firePressed ? 1.5 : 1.2))).strokeCircle(fx, fy, fr);
    g.lineStyle(1, 0xfff8c8, op * 0.45).strokeCircle(fx, fy, fr - 4);
    this.touchFireText.setPosition(fx, fy).setFontSize(`${Math.round(10.5 * l.scale)}px`).setAlpha(Math.min(1, op + 0.28)).setScale(out.firePressed ? 0.94 : 1);

    // 3. Dedicated SPECIAL button (guarded against accidental drags; dims gracefully at 0 charges)
    const sx = l.special.x, sy = l.special.y, sr = l.special.radius;
    const hasSpecial = (this.world?.weapons.specialCharges ?? 1) > 0;
    const specColor = hasSpecial ? 0xff7e60 : 0x768ea6;
    g.fillStyle(out.specialPressed ? 0xff6e52 : 0x261018, op * (out.specialPressed ? 0.76 : 0.36)).fillCircle(sx, sy, sr);
    g.lineStyle(1.8, specColor, Math.min(0.96, op * (hasSpecial ? 1.2 : 0.6))).strokeCircle(sx, sy, sr);
    this.touchSpecialText.setPosition(sx, sy).setFontSize(`${Math.round(9.5 * l.scale)}px`).setAlpha(Math.min(1, hasSpecial ? op + 0.28 : op * 0.7)).setScale(out.specialPressed ? 0.92 : 1);

    // 4. Optional ergonomic CHARGED SHOT button (shown when touch layout provides room)
    if (l.charge) {
      const cx = l.charge.x, cy = l.charge.y, cr = l.charge.radius;
      const chargeRatio = this.world?.chargedShot.ratio ?? 0;
      const activeCol = chargeRatio >= 0.99 ? 0xfef08a : 0x38bdf8;
      g.fillStyle(out.chargePressed ? 0x0ea5e9 : 0x082246, op * (out.chargePressed ? 0.75 : 0.38)).fillCircle(cx, cy, cr);
      g.lineStyle(1.7, activeCol, Math.min(0.96, op * (out.chargePressed ? 1.5 : 1.1))).strokeCircle(cx, cy, cr);
      if (chargeRatio > 0) {
        g.lineStyle(2.4, activeCol, 0.95).beginPath().arc(cx, cy, cr - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio, false).strokePath();
      }
      this.touchChargeText.setVisible(true).setPosition(cx, cy).setFontSize(`${Math.round(8.2 * l.scale)}px`).setAlpha(Math.min(1, op + 0.28)).setScale(out.chargePressed ? 0.92 : 1);
    } else {
      this.touchChargeText.setVisible(false);
    }
  }
  private installTouch(): void {
    this.touchGfx = this.add.graphics().setDepth(65);
    this.touchFireText = this.add.text(0, 0, 'TIRO', { fontFamily: FONT, fontSize: '10.5px', fontStyle: 'bold', color: '#fff8d4', stroke: '#081b38', strokeThickness: 2.5 }).setResolution(2).setOrigin(.5).setDepth(66);
    this.touchChargeText = this.add.text(0, 0, 'CARGA', { fontFamily: FONT, fontSize: '8.2px', fontStyle: 'bold', color: '#a5f3fc', stroke: '#081b38', strokeThickness: 2.2 }).setResolution(2).setOrigin(.5).setDepth(66);
    this.touchSpecialText = this.add.text(0, 0, 'ESP', { fontFamily: FONT, fontSize: '9.5px', fontStyle: 'bold', color: '#ffe4dc', stroke: '#081b38', strokeThickness: 2.5 }).setResolution(2).setOrigin(.5).setDepth(66);
    this.touchNodes = [this.touchGfx, this.touchFireText, this.touchChargeText, this.touchSpecialText];
    this.setTouchVisible(false);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.audio.unlock();
      if (this.screen === 'intro') {
        if (this.introClock >= 0.35 && this.introSkipFade === undefined) this.introSkipFade = 0;
        return;
      }
      if (this.screen !== 'play') return;
      const q = this.cameras.main.getWorldPoint(p.x, p.y);
      if (p.wasTouch || this.touchShown) {
        const pauseTarget = this.touchController.getLayout().pause;
        if (Math.hypot(q.x - pauseTarget.x, q.y - pauseTarget.y) <= pauseTarget.hitRadius) {
          this.triggerPause();
          return;
        }
      }
      // Regra Canônica V2: cliques do mouse no PC jamais movimentam ou disparam.
      if (!p.wasTouch) return;
      this.touchDeviceActive = true;
      this.setTouchVisible(true);
      this.touchController.onPointerDown(p.id, q.x, q.y);
      this.renderTouchOverlay();
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch || this.screen !== 'play') return;
      const q = this.cameras.main.getWorldPoint(p.x, p.y);
      this.touchController.onPointerMove(p.id, q.x, q.y);
      this.renderTouchOverlay();
    });
    const release = (p: Phaser.Input.Pointer) => {
      this.touchController.onPointerUp(p.id);
      this.renderTouchOverlay();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on('pointercancel', release);
    this.input.on('gameout', () => {
      this.touchController.clearAll();
      this.renderTouchOverlay();
    });
  }
  private setTouchVisible(visible: boolean): void {
    const hasTouchCap = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0 || this.touchDeviceActive);
    const show = visible && (hasTouchCap || this.screen === 'touch-settings');
    this.touchShown = show;
    this.touchNodes.forEach(n => n.setVisible(show));
    if (show) this.refreshTouchLayout();
    else { this.touchGfx?.clear(); this.syncPauseButton(); }
  }

  // ---- Runtime adapters consumed exclusively when dev tooling attaches (zero prod UI) ----
  getCurrentMissionIndex(): number { return this.currentMission; }
  setDevSaveGuard(active: boolean): void { this.devSaveGuard = active; }
  setDevHandlers(handlers: { onEscape?: () => boolean; onRender?: (scene: ArcadeScene, deltaMs: number) => void }): void {
    this.devEscapeHandler = handlers.onEscape;
    this.devOverlayCallback = handlers.onRender;
  }
  setDevSimulationPaused(paused: boolean): void { this.devSimulationPaused = paused; }
  isDevSimulationPaused(): boolean { return this.devSimulationPaused; }
  setDevTimeScale(scale: number): void { this.devTimeScale = clamp(scale, 0.1, 4); }
  getDevTimeScale(): number { return this.devTimeScale; }
  stepDevSimulation(dtSeconds = 1 / 120): void {
    if (!this.world || this.screen !== 'play') return;
    this.world.step(dtSeconds, this.lastInput);
    if (this.world.up && this.world.state !== 'intro') this.pelagicComms.step(dtSeconds);
    this.consumeEvents();
    this.backdrop.draw(this.world.elapsed, this.world, this.quality);
    this.renderWorld(dtSeconds);
    this.devOverlayCallback?.(this, dtSeconds * 1000);
  }
  setDevQuality(quality: number): void {
    this.quality = clamp(Math.round(quality), 0, 2);
  }
  toggleDevWeaponDebug(force?: boolean): boolean {
    this.devWeaponDebug = force ?? !this.devWeaponDebug;
    return this.devWeaponDebug;
  }
  devExitToMenu(): void {
    this.devSimulationPaused = false;
    this.devTimeScale = 1;
    this.carried = undefined;
    this.disposeWorld();
    this.show('title');
  }
  devJumpToCheckpoint(
    missionIndex: number,
    targetSeconds: number,
    opts?: { pauseDirector?: boolean; isolated?: boolean; seed?: number; bossMini?: boolean; subSectionIndex?: number; tideArchStage?: Exclude<TideArchPhase, 'idle'> },
  ): void {
    this.devSaveGuard = true;
    this.devSimulationPaused = false;
    this.begin(missionIndex);
    const w = this.world!;
    w.introTime = 0;
    if (opts?.seed !== undefined) w.setSeed(opts.seed);
    if (opts?.tideArchStage && w.up) {
      w.devJumpTideArch(opts.tideArchStage, opts.pauseDirector, opts.isolated);
      this.audio.play('stage1');
    } else if (opts?.bossMini !== undefined && !(opts.bossMini && w.up)) {
      w.devStartBoss(opts.bossMini, opts.subSectionIndex);
      w.devSandboxIsolated = Boolean(opts.isolated);
      this.audio.play(opts.bossMini ? (w.up ? 'mini1' : 'mini2') : (w.up ? 'boss1' : 'boss2'));
    } else {
      w.devJumpToCheckpoint(targetSeconds, { pauseDirector: opts?.pauseDirector, isolated: opts?.isolated, seed: opts?.seed });
      if (targetSeconds >= w.stageDuration) this.audio.play(w.up ? 'boss1' : 'boss2');
      else if (!w.up && targetSeconds >= 155 && targetSeconds < 185) this.audio.play('mini2');
      else this.audio.play(missionIndex ? 'stage2' : 'stage1');
    }
    this.consumeEvents();
    this.backdrop.draw(w.elapsed, w, this.quality);
    this.renderWorld(0);
    this.refreshHudVisual();
  }
  devJumpTideArch(stage: Exclude<TideArchPhase, 'idle'>, isolated = false): void {
    this.devJumpToCheckpoint(0, 148, { tideArchStage: stage, isolated });
  }
  devRunStageEvent(
    missionIndex: number,
    eventId: string,
    opts?: { action?: 'go-to' | 'before' | 'run'; isolated?: boolean; leadSeconds?: number; seed?: number },
  ): { ok: boolean; message: string } {
    this.devSaveGuard = true;
    this.devSimulationPaused = false;
    this.begin(missionIndex);
    const w = this.world!;
    const res = w.devRunStageEvent(eventId, opts);
    if (w.boss && !w.boss.mini) this.audio.play(w.up ? 'boss1' : 'boss2');
    else if (w.boss && w.boss.mini) this.audio.play(w.up ? 'mini1' : 'mini2');
    else this.audio.play(missionIndex ? 'stage2' : 'stage1');
    this.consumeEvents();
    this.backdrop.draw(w.elapsed, w, this.quality);
    this.renderWorld(0);
    this.refreshHudVisual();
    return { ok: res.ok, message: res.message };
  }
  devApplyLiveTuning(patch: {
    playerSpeedScale?: number;
    enemySpeedScale?: number;
    enemyFireRateScale?: number;
    enemyShotSpeedScale?: number;
    specialDurationScale?: number;
  }): void {
    const w = this.world;
    if (!w) return;
    if (patch.playerSpeedScale !== undefined) w.playerSpeedScale = clamp(patch.playerSpeedScale, 0.35, 2.5);
    if (patch.enemySpeedScale !== undefined) w.enemySpeedScale = clamp(patch.enemySpeedScale, 0.25, 3);
    if (patch.enemyFireRateScale !== undefined) w.enemyFireRateScale = clamp(patch.enemyFireRateScale, 0.25, 4);
    if (patch.enemyShotSpeedScale !== undefined) w.enemyShotSpeedScale = clamp(patch.enemyShotSpeedScale, 0.25, 3);
    if (patch.specialDurationScale !== undefined) w.specialDurationScale = clamp(patch.specialDurationScale, 0.3, 2.5);
  }
  devStartEnemyTest(
    missionIndex: number,
    e: Omit<Encounter, 'at'>,
    opts?: { x?: number; y?: number; keepExisting?: boolean; pauseDirector?: boolean },
  ): Actor[] {
    this.devSaveGuard = true;
    if (!this.world || this.currentMission !== missionIndex || this.screen !== 'play') {
      this.devJumpToCheckpoint(missionIndex, 10, { pauseDirector: opts?.pauseDirector ?? true, isolated: true });
    } else {
      this.world.clearArenaEntities();
    }
    const w = this.world!;
    const spawned = w.devSpawnEncounter(e, opts);
    this.consumeEvents();
    this.renderWorld(0);
    return spawned;
  }
  devTriggerPilotComms(category: 'start' | 'threat' | 'submarine' | 'pickup' | 'damage' | 'miniboss' | 'boss' | 'victory' | 'special-event', detail?: string, text?: string): void {
    if (!this.world?.up) return;
    this.pelagicComms.trigger({ category, detail, text });
    if (!this.portraitUpActive) {
      this.renderHud(0);
    }
  }
  devPelagicHudState() {
    if (!this.world) return null;
    return this.pelagicDesktopHud.snapshot(this.world, this.pauseBtn);
  }
  refreshHudVisual(): void {
    if (!this.world) return;
    this.lastHud = '';
    this.pelagicAssistBadge?.setVisible(!!this.world.up && this.world.isAssisted);
    this.renderHud();
  }
  devInspectSprites(): {
    enemySprites: number;
    turrets: number;
    partSprites: number;
    cargoSprites: number;
    effects: number;
    children: number;
    enemyBounds: Array<{ id: number; width: number; height: number; x: number; y: number }>;
  } {
    const enemyBounds: Array<{ id: number; width: number; height: number; x: number; y: number }> = [];
    for (const [id, sp] of this.enemySprites) {
      if (sp.visible) enemyBounds.push({ id, width: sp.displayWidth, height: sp.displayHeight, x: sp.x, y: sp.y });
    }
    return {
      enemySprites: this.enemySprites.size,
      turrets: this.turrets.size,
      partSprites: this.partSprites.size,
      cargoSprites: this.cargoSprites.size,
      effects: this.effects.length,
      children: this.children.length,
      enemyBounds,
    };
  }
}
