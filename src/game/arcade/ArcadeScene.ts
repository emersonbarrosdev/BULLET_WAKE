import Phaser from 'phaser';
import { ArcadeWorld, type Actor, type WorldEvent, type Controls } from './ArcadeWorld';
import { ArcadeBackdrop } from './ArcadeBackdrop';
import { ArcadeAudio } from './ArcadeAudio';
import { MISSIONS, type Encounter, type Family } from './content';
import { connectedPad, GamepadReader } from '../systems/gamepadInput';
import { globalSave } from '../systems/saveSystem';
import { globalAudio } from '../audio/audioSystem';
import { stageFlightSnapshot, type CampaignFlight } from '../systems/campaignFlight';
import { spriteContact } from '../render/SpriteSilhouette';
import { enableCombatResolution, getCombatVirtualSize, setCombatVirtualSize } from '../render/combatResolution';
import { clamp } from './geometry';
import { readArcadeProgress, recordArcadeClear } from './progress';
import { pelagicShotSize } from './PelagicPresentation';
import { rivetShotPresentation } from '../render/rivetPresentation';
import { SUPPLY_ART, SUB_ART, BOMB_ART, BLAST_ART, SUB_HULL_ART, SUB_SUBMERGED_ART, SUB_PARTS_ART, installCombatArt, HitOverlays, BombArt, SubmarineBossArt } from './ArcadeCombatArt';
import { subTotalHp } from './PelagicSubmarineBoss';
import { EMPLACEMENT_TEXTURE, GUN_SMOKE_TEXTURE, TOWER_TEXTURE, PelagicEmplacements } from './PelagicEmplacements';
import { PelagicActorAnims, preloadPelagicActorAnims } from './PelagicActorAnims';
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
import {
  TouchInputController,
  computeWorldSafeInsets,
  defaultTouchSettings,
  type SafeAreaInsets,
  type TouchControlSettings,
} from './TouchControls';
import {
  UI, UI_FONT, UI_TEX, UI_ICON, UI_PIP,
  preloadMenuAssets, installMenuAnims, makePanel, makeRibbon, makeButtonBg, makeGaugeMeter, makeIcon, makeKeyBadge,
  type SpriteButton,
} from './ArcadeMenuArt';

type Screen = 'loading' | 'intro' | 'title' | 'pilot' | 'missions' | 'play' | 'pause' | 'controls' | 'settings' | 'touch-settings' | 'confirm-exit' | 'result' | 'defeat' | 'ending';
type OpeningState = 'LOADING' | 'STUDIO_SPLASH' | 'MAIN_MENU' | 'READY';
type OpeningPhase = 'BOOT' | 'LOADING' | 'LOADING_COMPLETE' | 'STUDIO_SPLASH' | 'STUDIO_EXIT' | 'TITLE_READY' | 'TITLE_VISIBLE';
type ControlsTab = 'pc' | 'gamepad' | 'android';
type Effect = { sprite: Phaser.GameObjects.Sprite; age: number; duration: number; size: number; vx: number; vy: number; spin: number; };
type BonusPopup = { node: Phaser.GameObjects.Text; age: number; duration: number; y0: number; };
type MenuButton = { node: Phaser.GameObjects.Text; bg: SpriteButton; extras: Phaser.GameObjects.Text[]; action: () => void; onLeft?: () => void; onRight?: () => void; primaryGold?: boolean; titleSecondary?: boolean; };
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
  private controlsTab: ControlsTab = 'pc'; private lastControlsPadId = ''; private nextControlsFocus?: number;
  private enemySprites = new Map<number, Phaser.GameObjects.Sprite>(); private cargoSprites = new Map<number, Phaser.GameObjects.Sprite>(); private partSprites = new Map<number, Phaser.GameObjects.Sprite>(); private bulletSprites: Phaser.GameObjects.Sprite[] = []; private effects: Effect[] = [];
  private bonusPopups: BonusPopup[] = []; private bonusPopupPool: Phaser.GameObjects.Text[] = [];
  private turrets = new Map<number, Phaser.GameObjects.Sprite>(); private effectPool: Phaser.GameObjects.Sprite[] = [];
  private controls!: Record<string, Phaser.Input.Keyboard.Key>; private pad = new GamepadReader(); buttons: MenuButton[] = []; private focus = 0;
  private clock = 0; private introClock = 0; private accumulator = 0; private lastHud = ''; private messageUntil = 0; private pauseOrigin: Screen = 'pause'; private carried?: CampaignFlight; private currentMission = 0; private stageClearSaved = false;
  private touchController = new TouchInputController(globalSave.getSettings().touch);
  private touchGfx!: Phaser.GameObjects.Graphics; private touchFireText!: Phaser.GameObjects.Text; private touchSpecialText!: Phaser.GameObjects.Text;
  private touchNodes: (Phaser.GameObjects.Graphics | Phaser.GameObjects.Text)[] = [];
  private touchShown = false; private touchDeviceActive = false; private pauseBtn?: Phaser.GameObjects.Container;
  private suppressHeldFireUntilRelease = false;
  private mute = false;
  private pelagicLevel!: Phaser.GameObjects.Text; private pelagicAssistBadge!: Phaser.GameObjects.Text; private pelagicCheckpointBadge!: Phaser.GameObjects.Text; private pelagicSpecialText!: Phaser.GameObjects.Text; private bossHudLabel!: Phaser.GameObjects.Text;
  private checkpointBannerUntil = 0; private activeCheckpointSnapshot?: PelagicCheckpointSnapshot; private portraitUpActive = false;
  private emplacements!: PelagicEmplacements; private hitOverlays!: HitOverlays; private bombArt!: BombArt; private subBossArt!: SubmarineBossArt;
  private pelagicAnims!: PelagicActorAnims; private pelagicComms = new PelagicComms(); private lastInput: Controls = { x: 0, y: 0, fire: false, special: false };
  private devSaveGuard = false; private devSimulationPaused = false; private devTimeScale = 1; private devWeaponDebug = false;
  private devEscapeHandler?: () => boolean; private devOverlayCallback?: (scene: ArcadeScene, deltaMs: number) => void;
  constructor() { super('ArcadeScene'); }
  preload(): void {
    enableCombatResolution(this);
    const base = import.meta.env.BASE_URL;
    this.load.spritesheet('arc-ufo', `${base}assets/arcade/ufo.webp`, { frameWidth: 256, frameHeight: 256 });
    for (const [key, file] of [[SUPPLY_ART, 'supply-items'], [SUB_ART, 'submarines'], [BOMB_ART, 'bomb-flight'], [BLAST_ART, 'colossal-blast'], [SUB_HULL_ART, 'colossal-sub-hull'], [SUB_SUBMERGED_ART, 'colossal-sub-submerged'], [SUB_PARTS_ART, 'colossal-sub-parts']]) this.load.image(key, `${base}assets/arcade/pelagic-review/${file}.png`);
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
    this.load.spritesheet('arc-missile', `${base}assets/combat-hd/review/effects-missile.webp`, { frameWidth: 256, frameHeight: 256 });
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
    return [UI_TEX.logo, UI_TEX.skyPanorama, UI_TEX.wingmenAnim, UI_TEX.menuHeliSide, UI_TEX.menuHeliPatrolSide, UI_TEX.padDualSense, UI_TEX.mobileLandscape, UI_TEX.icons, UI_TEX.glow, UI_TEX.hudPelagicSky, UI_TEX.hudPelagicChassis, UI_TEX.hudRoutePelagic, UI_TEX.hudBayekHd]
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
    this.controls = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,X,ESC,ENTER,ONE,TWO,THREE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER']);
    const settings = globalSave.getSettings(); this.mute = settings.isMuted; this.audio.setMix(settings.musicVolume, settings.sfxVolume, this.mute);
    try { const stored = localStorage.getItem('bullet_wake_visual'); if (stored !== null) this.quality = clamp(Number(stored) || 0, 0, 2); } catch {/* Optional preference. */ }
    installCombatArt(this); installMenuAnims(this); this.hitOverlays = new HitOverlays(this); this.bombArt = new BombArt(this); this.subBossArt = new SubmarineBossArt(this);
    this.pelagicAnims = new PelagicActorAnims(this);
    this.backdrop = new ArcadeBackdrop(this); this.emplacements = new PelagicEmplacements(this); this.decor = this.add.graphics().setDepth(40); this.combatInk = this.add.graphics().setDepth(12);
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
    for (let i = 0; i < 640; i++)this.bulletSprites.push(this.add.sprite(0, 0, 'arc-red').setVisible(false).setDepth(19.5));
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
    for (const i of [0, 1, 2]) {
      const tex = this.textures.createCanvas('arc-orb-' + i, 32, 32)!, c = tex.context;
      // Illustrated cel-shaded coral-ruby orb matching aircraft line art (#182948) and sunlit sea/sky scenery
      c.fillStyle = '#182948'; c.beginPath(); c.arc(16, 16, 14.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe8e2'; c.beginPath(); c.arc(16, 16, 13.1, 0, Math.PI * 2); c.fill();
      const body = c.createRadialGradient(13.5, 13, 1, 16, 16, 11.6);
      body.addColorStop(0, '#ff665e');
      body.addColorStop(.45, '#f43542');
      body.addColorStop(1, '#ce1b2e');
      c.fillStyle = body; c.beginPath(); c.arc(16, 16, 11.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff6ea'; c.beginPath(); c.arc(13, 12.5, 3.2, 0, Math.PI * 2); c.fill();
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
  private button(
    x: number, y: number, label: string, action: () => void, width = 230, height = 38,
    opts?: { fontSize?: number; extras?: Phaser.GameObjects.Text[]; onLeft?: () => void; onRight?: () => void; noLabel?: boolean; primaryGold?: boolean; titleSecondary?: boolean },
  ): MenuButton {
    const bg = makeButtonBg(this, x, y, width, height, this.ui, !!opts?.primaryGold);
    const node = this.text(x, y + 1, opts?.noLabel ? '' : label, opts?.fontSize ?? 14, opts?.primaryGold ? '#081e40' : UI.white, { stroke: opts?.primaryGold ? '#fff4ad' : '#061938', strokeThickness: opts?.primaryGold ? 2 : 3 });
    const zone = this.add.zone(x, y, width, height).setInteractive({ useHandCursor: true }); this.ui.add(zone);
    const index = this.buttons.length;
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
  private focusButtons(): void {
    this.buttons.forEach((b, i) => {
      const on = i === this.focus;
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
          : { left: 160, right: 608, top: 28, bottom: 420 },
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
    this.tweens.killAll(); this.ui.removeAll(true); this.pauseBtn = undefined; this.buttons = []; this.focus = 0; this.hideIntroActors();
    this.ui.setVisible(!['loading', 'intro'].includes(screen));
    if (screen === 'result' || screen === 'defeat') { this.messageUntil = 0; this.radio.setVisible(false); }
    if (screen !== 'play') { this.touchController.clearAll(); this.pelagicAnims?.hide(); this.clearBonusPopups(); }
    const game = ['play', 'pause', 'controls', 'settings', 'touch-settings', 'confirm-exit', 'result', 'defeat'].includes(screen) && !!this.world;
    const stage1Hud = game && !!this.world?.up;
    const showPcPanel = stage1Hud && !this.portraitUpActive;
    this.pelagicDesktopHud.setVisible(showPcPanel); this.pelagicLevel.setVisible(stage1Hud);
    this.pelagicSpecialText?.setVisible(stage1Hud && this.portraitUpActive);
    this.pelagicAssistBadge.setVisible(stage1Hud && !!this.world?.isAssisted && !this.portraitUpActive);
    if (this.world?.up && (showPcPanel || !['result', 'defeat'].includes(screen))) this.radio.setVisible(false);
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
      this.suppressHeldFireUntilRelease = !['loading', 'intro', 'missions'].includes(old);
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
      this.button(384, 264, 'INICIAR JORNADA', () => this.show('pilot'), 236, 36, { fontSize: 13.5 });
      this.button(384, 306, 'CONTROLES', () => { this.pauseOrigin = 'title'; this.show('controls'); }, 236, 36, { fontSize: 13.5 });
      this.button(384, 348, 'OPÇÕES', () => { this.pauseOrigin = 'title'; this.show('settings'); }, 236, 36, { fontSize: 13.5 });
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
    } else if (screen === 'pilot') {
      this.audio.play('select'); this.addModalBackdrop(0x041530, .36, false);
      makeRibbon(this, 384, 28, 332, 38, 'gold', this.ui);
      this.text(384, 28, 'ESCOLHA SEU PILOTO', 17, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 2 });
      makePanel(this, 384, 146, 678, 174, 'cobalt', this.ui);
      makePanel(this, 132, 144, 136, 136, 'gold', this.ui);
      this.ui.add(this.add.image(132, 140, 'arc-pilots', 3).setDisplaySize(114, 114));
      makeRibbon(this, 132, 206, 114, 24, 'gold', this.ui);
      this.text(132, 206, 'BAYEK', 12, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 1 });
      const bay = this.add.graphics()
        .fillStyle(0x05214d, .82).fillRoundedRect(218, 72, 188, 92, 10)
        .lineStyle(1.4, UI.cyan, .62).strokeRoundedRect(218, 72, 188, 92, 10)
        .lineStyle(1, UI.cyan, .22).lineBetween(428, 74, 428, 218);
      this.ui.add(bay);
      const plane = this.add.image(312, 118, UI_TEX.rivetProfile).setDisplaySize(134, 80);
      this.ui.add(plane);
      this.text(312, 176, 'RIVET  •  VANGUARDA', 12, UI.cyanHex);
      this.text(312, 193, 'Asas da Vanguarda. Um destino: trazer todos.', 9.5, UI.silver);
      makeIcon(this, 224, 212, UI_ICON.lightning, 16, this.ui);
      this.text(318, 212, 'ESPECIAL: TORMENTA ESCARLATE', 9.5, UI.goldHex);
      const stats: [string, number, number, number][] = [['VELOCIDADE', 4, UI_PIP.cyan, 96], ['ARMAMENTO', 5, UI_PIP.gold, 140], ['BLINDAGEM', 3, UI_PIP.green, 184]];
      for (const [lbl, val, pip, sy] of stats) {
        this.text(566, sy - 16, lbl, 9.5, UI.silver);
        makeGaugeMeter(this, 566, sy + 3, 170, 22, 5, val, pip, this.ui);
      }
      const portraits = [0, 4, 5, 6, 7], names = ['BAYEK', 'TITA', 'LEONA', 'OSVALD', 'HIEN'];
      for (let i = 0; i < 5; i++) {
        const cx = 112 + i * 136;
        makePanel(this, cx, 290, 124, 96, i === 0 ? 'gold' : 'cobalt', this.ui);
        this.ui.add(this.add.image(cx, 274, 'arc-pilots', portraits[i]).setDisplaySize(50, 50).setAlpha(i ? .52 : 1));
        if (i) makeIcon(this, cx + 40, 256, UI_ICON.padlock, 21, this.ui);
        this.text(cx, 307, names[i], 11, i ? UI.silver : UI.goldHex);
        this.text(cx, 320, i ? 'EM BREVE' : 'PRONTO', 7.5, i ? UI.slate : UI.cyanHex);
      }
      this.button(468, 384, 'DECOLAR COM BAYEK', () => this.show('missions'), 286, 40, { fontSize: 14 });
      this.button(154, 384, 'VOLTAR', () => this.show('title'), 156, 36, { fontSize: 13 });
    } else if (screen === 'missions') {
      this.addModalBackdrop(0x041530, .36, false);
      makeRibbon(this, 384, 30, 318, 38, 'gold', this.ui);
      this.text(384, 30, 'ESCOLHA A ROTA', 18, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 2 });
      this.text(384, 60, 'DUAS PERSPECTIVAS. UMA OPERAÇÃO DE RESGATE.', 10.5, UI.white);
      const prog = this.arcadeProgress(), unlocked = prog.cleared.includes(1);
      for (let i = 0; i < 2; i++) {
        const cx = i ? 562 : 206, m = MISSIONS[i], avail = i === 0 || unlocked, best = this.bestScoreFor(m.id);
        makePanel(this, cx, 214, 324, 256, 'cobalt', this.ui);
        makeRibbon(this, cx, 94, 160, 26, avail ? 'gold' : 'red', this.ui);
        this.text(cx, 94, `ROTA 0${i + 1}`, 12, avail ? UI.cobaltHex : '#fff5f7', { stroke: avail ? '#fff6b0' : '#4b0816', strokeThickness: 2 });
        makePanel(this, cx - 84, 186, 120, 120, avail ? 'gold' : 'cobalt', this.ui);
        this.ui.add(this.add.image(cx - 84, 186, i ? 'arc-scenery' : UI_TEX.routePelagic, i ? 5 : undefined).setDisplaySize(104, 104).setAlpha(avail ? 1 : .45));
        if (!avail) makeIcon(this, cx - 84, 186, UI_ICON.padlock, 44, this.ui);
        this.text(cx + 62, 146, m.name, 15, avail ? UI.goldHex : UI.silver, { wrap: 162 });
        this.text(cx + 62, 174, i ? 'SIDE • CIDADE SOLAR' : 'UP • FENDA PELÁGICA', 9.5, UI.cyanHex, { wrap: 160 });
        this.text(cx + 62, 202, avail ? `RECORDE\n${best}` : 'CONCLUA A\nROTA 01 ANTES', 10, avail ? UI.white : UI.crimsonHex, { wrap: 156 });
        if (i === 0) {
          const st = globalSave.getSettings();
          const modeLabel = st.assisted ? 'MODO ASSISTIDO ATIVO' : st.difficulty !== 'normal' ? 'MODO DIFÍCIL' : 'MODO NORMAL';
          const modeCol = st.assisted ? '#88fff2' : st.difficulty !== 'normal' ? UI.goldHex : UI.silver;
          this.text(cx, 266, modeLabel, 9.5, modeCol);
        }
        this.button(cx, 304, avail ? 'INICIAR MISSÃO' : 'BLOQUEADA', () => { if (!avail) return; const carry = i ? prog.flights[1] : undefined; this.begin(i, carry); }, 264, 38, { fontSize: 13 });
      }
      this.button(110, 400, 'VOLTAR', () => this.show('pilot'), 156, 34, { fontSize: 13 });
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
        const portrait = this.add.image(144, 207, 'arc-pilots', 0).setDisplaySize(110, 110); this.ui.add(portrait); this.time.delayedCall(2300, () => portrait.destroy());
      }
    } else if (screen === 'pause') {
      this.addModalBackdrop(0x031129, .60, true);
      makePanel(this, 384, 224, 380, 326, 'cobalt', this.ui);
      makeRibbon(this, 384, 64, 228, 38, 'gold', this.ui);
      this.text(384, 64, 'PAUSA', 18, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 2 });
      const w = this.world;
      if (w) {
        makeGaugeMeter(this, 384, 110, 322, 26, 0, 0, UI_PIP.cyan, this.ui);
        const modeTag = w.up ? (w.isAssisted ? '  •  ASSISTIDO' : w.hard ? '  •  DIFÍCIL' : '') : '';
        this.text(384, 110, `ROTA 0${this.currentMission + 1}${modeTag}  •  ${w.score} PTS  •  NV ${w.weapons.weaponLevel}`, 10, UI.cyanHex);
      }
      this.button(384, 162, 'CONTINUAR', () => this.show('play'), 266, 38);
      this.button(384, 209, 'CONTROLES', () => this.show('controls'), 266, 38);
      this.button(384, 256, 'OPÇÕES', () => { this.pauseOrigin = 'pause'; this.show('settings'); }, 266, 38);
      this.button(384, 303, 'SAIR DA MISSÃO', () => this.show('confirm-exit'), 266, 38);
      this.text(384, 358, 'ESC: RETOMAR VOO', 9.5, UI.slate);
    } else if (screen === 'controls') {
      this.addModalBackdrop(0x031129, .62, true);
      const pad = connectedPad();
      this.lastControlsPadId = pad?.id ?? '';
      if (old !== 'controls') {
        const hasTouchOnly = this.touchDeviceActive || (typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches);
        if (pad) this.controlsTab = 'gamepad';
        else if (hasTouchOnly) this.controlsTab = 'android';
        else this.controlsTab = 'pc';
      }
      makePanel(this, 384, 218, 678, 368, 'cobalt', this.ui);
      makeRibbon(this, 384, 42, 260, 34, 'gold', this.ui);
      this.text(384, 42, 'CONTROLES', 17, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 2 });
      const tabs: Array<{ id: ControlsTab; label: string; x: number }> = [
        { id: 'pc', label: 'PC', x: 224 },
        { id: 'gamepad', label: 'CONTROLE', x: 384 },
        { id: 'android', label: 'ANDROID', x: 544 },
      ];
      const switchTab = (next: ControlsTab, focusIdx: number) => {
        if (this.controlsTab === next) return;
        this.controlsTab = next;
        this.nextControlsFocus = focusIdx;
        this.show('controls');
      };
      tabs.forEach((t, idx) => {
        const active = this.controlsTab === t.id;
        if (active) makePanel(this, t.x, 80, 152, 32, 'gold', this.ui);
        this.button(t.x, 80, active ? `▸ ${t.label} ◂` : t.label, () => switchTab(t.id, idx), 146, 26, {
          fontSize: 11.5,
          onLeft: () => { const prev = (idx + 2) % 3; switchTab(tabs[prev].id, prev); },
          onRight: () => { const nxt = (idx + 1) % 3; switchTab(tabs[nxt].id, nxt); },
        });
      });

      const cmdRow = (xBadge: number, y: number, badgeText: string, desc: string, opts?: { wide?: boolean; gold?: boolean; descColor?: string; badgeFont?: number }) => {
        makeKeyBadge(this, xBadge, y, badgeText, { wide: opts?.wide ?? badgeText.length > 3, gold: opts?.gold, size: 24, fontSize: opts?.badgeFont ?? 8.5, container: this.ui });
        this.text(xBadge + 42, y, desc, 10, opts?.descColor ?? UI.white, { originX: 0, wrap: 230 });
      };

      if (this.controlsTab === 'pc') {
        makePanel(this, 198, 224, 228, 222, 'cobalt', this.ui);
        this.text(198, 128, 'TECLADO PC', 11.5, UI.goldHex);
        makeKeyBadge(this, 162, 162, 'W', { size: 24, fontSize: 10, container: this.ui });
        makeKeyBadge(this, 190, 162, 'A', { size: 24, fontSize: 10, container: this.ui });
        makeKeyBadge(this, 218, 162, 'S', { size: 24, fontSize: 10, container: this.ui });
        makeKeyBadge(this, 246, 162, 'D', { size: 24, fontSize: 10, container: this.ui });
        makeKeyBadge(this, 162, 198, '↑', { size: 24, fontSize: 10.5, container: this.ui });
        makeKeyBadge(this, 190, 198, '←', { size: 24, fontSize: 10.5, container: this.ui });
        makeKeyBadge(this, 218, 198, '↓', { size: 24, fontSize: 10.5, container: this.ui });
        makeKeyBadge(this, 246, 198, '→', { size: 24, fontSize: 10.5, container: this.ui });
        makeKeyBadge(this, 198, 238, 'ESPAÇO', { wide: true, size: 26, fontSize: 9, container: this.ui });
        makeKeyBadge(this, 168, 276, 'X', { gold: true, size: 26, fontSize: 10.5, container: this.ui });
        makeKeyBadge(this, 226, 276, 'ESC', { wide: true, size: 26, fontSize: 8.5, container: this.ui });
        this.text(198, 312, 'MOUSE NÃO MOVE NEM ATIRA EM COMBATE', 8, UI.cyanHex, { wrap: 204 });

        makePanel(this, 504, 224, 344, 222, 'cobalt', this.ui);
        this.text(504, 128, 'DISPARO ARCADE MANUAL', 11.5, UI.goldHex);
        cmdRow(378, 162, 'WASD/SETAS', 'Mover RIVET em 8 direções', { wide: true, badgeFont: 7.5 });
        cmdRow(378, 198, 'ESPAÇO', 'Rajada manual (3 pulsos por toque)', { wide: true, descColor: UI.goldHex, badgeFont: 8 });
        cmdRow(378, 234, 'TECLA X', 'Tormenta Escarlate (Especial)', { wide: true, gold: true, descColor: UI.cyanHex, badgeFont: 8 });
        cmdRow(378, 270, 'ESC / ENTER', 'Pausar / Confirmar menus', { wide: true, badgeFont: 7.5 });
        this.text(504, 310, 'Segurar ESPAÇO não repete no modo padrão.\nTiro contínuo só com Disparo Acessível ativo.', 8.2, UI.silver, { wrap: 318 });
      } else if (this.controlsTab === 'gamepad') {
        const idLower = (pad?.id ?? '').toLowerCase();
        const isXbox = /xbox|xinput|045e/.test(idLower);
        const padTex = isXbox ? UI_TEX.padXbox : UI_TEX.padDualSense;
        makePanel(this, 212, 224, 256, 222, 'cobalt', this.ui);
        this.text(212, 126, isXbox ? 'CONTROLE XBOX / PC' : 'PS5 DUALSENSE', 11, UI.goldHex);
        this.ui.add(this.add.image(212, 214, padTex).setDisplaySize(226, 134));
        this.text(212, 305, pad ? `CONECTADO: ${pad.id.slice(0, 20).toUpperCase()}` : 'DUALSENSE VIA USB / BLUETOOTH', 8, pad ? UI.cyanHex : UI.silver, { wrap: 232 });

        makePanel(this, 518, 224, 320, 222, 'cobalt', this.ui);
        this.text(518, 126, isXbox ? 'COMANDOS XBOX / DUALSENSE' : 'COMANDOS PS5 DUALSENSE', 10.5, UI.goldHex);
        cmdRow(400, 158, 'L / D-PAD', 'Mover nave (analógico ou direcional)', { wide: true, badgeFont: 7.5 });
        cmdRow(400, 190, isXbox ? 'A' : '✕', 'Disparar rajada (3 pulsos) / Confirmar', { wide: false, descColor: UI.goldHex, badgeFont: isXbox ? 11 : 13.5 });
        cmdRow(400, 222, isXbox ? 'X' : '□', 'Tormenta Escarlate (Especial)', { wide: false, gold: true, descColor: UI.cyanHex, badgeFont: isXbox ? 11 : 14 });
        cmdRow(400, 254, isXbox ? 'START' : 'OPTIONS', 'Pausar / Retomar partida', { wide: true, badgeFont: 7.5 });
        cmdRow(400, 286, isXbox ? 'B' : '○', 'Voltar nos menus', { wide: false, badgeFont: isXbox ? 11 : 14 });
        this.text(518, 316, 'Botão △ e gatilhos sem função ativa neste modo.', 8, UI.silver, { wrap: 296 });
      } else {
        makePanel(this, 222, 224, 276, 222, 'cobalt', this.ui);
        this.text(222, 126, 'ANDROID TOUCH (PAISAGEM)', 10.5, UI.goldHex);
        this.ui.add(this.add.image(222, 214, UI_TEX.mobileLandscape).setDisplaySize(248, 140));
        this.text(222, 306, 'MULTITOQUE LIVRE  •  ÁREA SEGURA ATIVA', 8, UI.cyanHex, { wrap: 256 });

        makePanel(this, 528, 224, 300, 222, 'cobalt', this.ui);
        this.text(528, 126, 'COMANDOS NA TELA', 11, UI.goldHex);
        cmdRow(414, 160, 'JOYSTICK', 'Voo preciso em 8 direções', { wide: true, badgeFont: 7.5 });
        cmdRow(414, 196, 'TIRO', 'Toque no botão para rajada', { wide: true, descColor: UI.goldHex, badgeFont: 8.5 });
        cmdRow(414, 232, 'ESP', 'Ativar especial sem erro', { wide: true, gold: true, descColor: UI.cyanHex, badgeFont: 8.5 });
        cmdRow(414, 268, 'PAUSA', 'Botão no topo direito', { wide: true, badgeFont: 8 });
        this.text(528, 310, 'Personalize tamanho, lado e transparência\nem OPÇÕES > CONTROLES TOUCH.', 8.2, UI.silver, { wrap: 280 });
      }

      this.button(384, 372, 'VOLTAR', () => { this.nextControlsFocus = undefined; this.show(this.world ? 'pause' : this.pauseOrigin); }, 204, 34, { fontSize: 13 });
      this.focus = this.nextControlsFocus ?? tabs.findIndex(t => t.id === this.controlsTab);
      this.nextControlsFocus = undefined;
    } else if (screen === 'settings') {
      this.addModalBackdrop(0x031129, .60, true);
      makePanel(this, 384, 222, 620, 368, 'cobalt', this.ui);
      makeRibbon(this, 384, 42, 232, 36, 'gold', this.ui);
      this.text(384, 42, 'OPÇÕES', 18, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 2 });
      const syncWorldDifficulty = () => {
        if (!this.world) return;
        const cur = globalSave.getSettings();
        this.world.assisted = this.currentMission === 0 && cur.assisted;
        this.world.hard = (this.currentMission > 0 || !cur.assisted) && cur.difficulty !== 'normal';
        this.pelagicAssistBadge.setVisible(!!this.world.up && this.world.isAssisted);
      };
      const addVolumeRow = (y: number, iconFrame: number, label: string, isMusic: boolean) => {
        const get = () => isMusic ? globalSave.getSettings().musicVolume : globalSave.getSettings().sfxVolume;
        let meter!: ReturnType<typeof makeGaugeMeter>, valText!: Phaser.GameObjects.Text;
        const apply = (next: number) => {
          const clamped = clamp(Math.round(next * 10) / 10, 0, 1);
          globalSave.updateSettings(isMusic ? { musicVolume: clamped } : { sfxVolume: clamped });
          const cur = globalSave.getSettings();
          this.audio.setMix(cur.musicVolume, cur.sfxVolume, this.mute);
          const steps = Math.round(clamped * 10);
          meter?.setValue(steps); valText?.setText(`${steps * 10}%`);
        };
        const btn = this.button(384, y, '', () => apply(get() >= .99 ? 0 : get() + .1), 554, 34, {
          noLabel: true,
          onLeft: () => { globalAudio.playArcade('navigate'); apply(get() - .1); },
          onRight: () => { globalAudio.playArcade('navigate'); apply(get() + .1); },
        });
        makeIcon(this, 136, y, iconFrame, 22, this.ui);
        const title = this.text(168, y, label, 11.5, UI.white, { originX: 0 });
        meter = makeGaugeMeter(this, 462, y, 192, 22, 10, Math.round(get() * 10), isMusic ? UI_PIP.cyan : UI_PIP.gold, this.ui);
        const initSteps = Math.round(get() * 10);
        valText = this.text(596, y, `${initSteps * 10}%`, 11.5, UI.cyanHex);
        btn.extras = [title, valText];
      };
      const addToggleRow = (y: number, iconFrame: number, label: string, pipCount: number, pipFrame: number, readState: () => { text: string; filled: number }, stepState: (dir: number) => void) => {
        const st0 = readState();
        let meter!: ReturnType<typeof makeGaugeMeter>, valText!: Phaser.GameObjects.Text;
        const update = (dir: number) => { stepState(dir); const st = readState(); meter.setValue(st.filled); valText.setText(st.text); };
        const btn = this.button(384, y, '', () => update(1), 554, 34, { noLabel: true, onLeft: () => update(-1), onRight: () => update(1) });
        makeIcon(this, 136, y, iconFrame, 22, this.ui);
        const title = this.text(168, y, label, 11.5, UI.white, { originX: 0 });
        meter = makeGaugeMeter(this, 442, y, 118, 20, pipCount, st0.filled, pipFrame, this.ui);
        valText = this.text(584, y, st0.text, 11, UI.goldHex);
        btn.extras = [title, valText];
      };
      addVolumeRow(92, UI_ICON.music, 'MÚSICA', true);
      addVolumeRow(132, UI_ICON.speaker, 'EFEITOS', false);
      addToggleRow(172, UI_ICON.lightning, 'DISPARO ACESSÍVEL', 2, UI_PIP.green, () => {
        const on = globalSave.getSettings().rapidFire; return { text: on ? 'ATIVADO' : 'DESATIVADO', filled: on ? 2 : 0 };
      }, () => { const next = !globalSave.getSettings().rapidFire; globalSave.updateSettings({ rapidFire: next }); if (this.world) this.world.accessibility = next; });
      addToggleRow(212, UI_ICON.crown, 'DIFICULDADE', 2, UI_PIP.gold, () => {
        const hard = globalSave.getSettings().difficulty !== 'normal'; return { text: hard ? 'DIFÍCIL' : 'NORMAL', filled: hard ? 2 : 1 };
      }, () => { const next = globalSave.getSettings().difficulty === 'normal' ? 'hard' : 'normal'; globalSave.updateSettings({ difficulty: next }); syncWorldDifficulty(); });
      addToggleRow(252, UI_ICON.botan, 'MODO ASSISTIDO', 2, UI_PIP.cyan, () => {
        const on = globalSave.getSettings().assisted; return { text: on ? 'ATIVADO' : 'DESATIVADO', filled: on ? 2 : 0 };
      }, () => { const next = !globalSave.getSettings().assisted; globalSave.updateSettings({ assisted: next }); syncWorldDifficulty(); });
      addToggleRow(292, UI_ICON.radar, 'QUALIDADE VISUAL', 3, UI_PIP.cyan, () => {
        return { text: ['BAIXA', 'MÉDIA', 'ALTA'][this.quality], filled: this.quality + 1 };
      }, (dir) => { this.quality = (this.quality + (dir < 0 ? 2 : 1)) % 3; try { localStorage.setItem('bullet_wake_visual', String(this.quality)); } catch {/* Optional */ } });
      this.text(384, 326, 'Modo Assistido (Rota 01): recuperação facilitada sem alterar Normal/Difícil.', 9, UI.silver);
      this.button(262, 362, 'CONTROLES TOUCH', () => this.show('touch-settings'), 228, 36, { fontSize: 12.5 });
      this.button(506, 362, 'VOLTAR', () => this.show(this.pauseOrigin), 214, 36);
    } else if (screen === 'touch-settings') {
      this.addModalBackdrop(0x031129, .54, true);
      makePanel(this, 384, 170, 524, 290, 'cobalt', this.ui);
      makeRibbon(this, 384, 32, 276, 34, 'gold', this.ui);
      this.text(384, 32, 'CONTROLES TOUCH', 16, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 2 });
      const patchTouch = (patch: Partial<TouchControlSettings>) => {
        const cur = globalSave.getSettings().touch;
        globalSave.updateSettings({ touch: { ...cur, ...patch } });
        this.refreshTouchLayout();
      };
      const addTouchRow = (
        y: number,
        iconFrame: number,
        label: string,
        pipCount: number,
        pipFrame: number,
        readState: () => { text: string; filled: number },
        stepState: (dir: number) => void,
      ) => {
        const st0 = readState();
        let meter!: ReturnType<typeof makeGaugeMeter>, valText!: Phaser.GameObjects.Text;
        const update = (dir: number) => { stepState(dir); const st = readState(); meter.setValue(st.filled); valText.setText(st.text); };
        const btn = this.button(384, y, '', () => update(1), 472, 30, { noLabel: true, onLeft: () => update(-1), onRight: () => update(1) });
        makeIcon(this, 174, y, iconFrame, 20, this.ui);
        const title = this.text(200, y, label, 10.5, UI.white, { originX: 0 });
        meter = makeGaugeMeter(this, 424, y, 104, 18, pipCount, st0.filled, pipFrame, this.ui);
        valText = this.text(552, y, st0.text, 10.5, UI.goldHex);
        btn.extras = [title, valText];
      };
      addTouchRow(76, UI_ICON.gamepad, 'MÃO DOMINANTE', 2, UI_PIP.gold, () => {
        const left = globalSave.getSettings().touch.handedness === 'left';
        return { text: left ? 'CANHOTO' : 'DESTRO', filled: left ? 2 : 1 };
      }, () => patchTouch({ handedness: globalSave.getSettings().touch.handedness === 'left' ? 'right' : 'left' }));

      const posOrder: TouchControlSettings['position'][] = ['corner', 'raised', 'wide'];
      const posNames = { corner: 'CANTO', raised: 'ELEVADA', wide: 'ABERTA' } as const;
      addTouchRow(112, UI_ICON.radar, 'POSIÇÃO (MÃO)', 3, UI_PIP.cyan, () => {
        const pos = globalSave.getSettings().touch.position;
        return { text: posNames[pos], filled: posOrder.indexOf(pos) + 1 };
      }, (dir) => {
        const idx = posOrder.indexOf(globalSave.getSettings().touch.position);
        patchTouch({ position: posOrder[(idx + (dir < 0 ? 2 : 1)) % 3] });
      });

      const sizeOrder: TouchControlSettings['size'][] = ['compact', 'standard', 'large'];
      const sizeNames = { compact: 'PEQUENO', standard: 'PADRÃO', large: 'GRANDE' } as const;
      addTouchRow(148, UI_ICON.lightning, 'TAMANHO', 3, UI_PIP.green, () => {
        const sz = globalSave.getSettings().touch.size;
        return { text: sizeNames[sz], filled: sizeOrder.indexOf(sz) + 1 };
      }, (dir) => {
        const idx = sizeOrder.indexOf(globalSave.getSettings().touch.size);
        patchTouch({ size: sizeOrder[(idx + (dir < 0 ? 2 : 1)) % 3] });
      });

      const opSteps = [0.30, 0.45, 0.60, 0.75];
      addTouchRow(184, UI_ICON.botan, 'TRANSPARÊNCIA', 4, UI_PIP.cyan, () => {
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
      addTouchRow(220, UI_ICON.crown, 'ALTURA FINA', 4, UI_PIP.gold, () => {
        const oy = globalSave.getSettings().touch.offsetY;
        const idx = ySteps.reduce((best, v, i) => (Math.abs(v - oy) < Math.abs(ySteps[best] - oy) ? i : best), 2);
        return { text: yNames[idx], filled: idx + 1 };
      }, (dir) => {
        const oy = globalSave.getSettings().touch.offsetY;
        const idx = ySteps.reduce((best, v, i) => (Math.abs(v - oy) < Math.abs(ySteps[best] - oy) ? i : best), 2);
        patchTouch({ offsetY: ySteps[(idx + (dir < 0 ? 3 : 1)) % ySteps.length] });
      });

      this.button(272, 272, 'RESTAURAR PADRÃO', () => {
        globalSave.updateSettings({ touch: defaultTouchSettings() });
        this.refreshTouchLayout();
        this.show('touch-settings');
      }, 206, 34, { fontSize: 11.5 });
      this.button(496, 272, 'VOLTAR', () => this.show('settings'), 190, 34, { fontSize: 12.5 });
    } else if (screen === 'confirm-exit') {
      this.addModalBackdrop(0x031129, .64, true);
      makePanel(this, 384, 218, 434, 256, 'gold', this.ui);
      makeRibbon(this, 384, 92, 268, 38, 'red', this.ui);
      this.text(384, 92, 'SAIR DA MISSÃO?', 17, '#fff5f7', { stroke: '#4b0816', strokeThickness: 2 });
      const warn = makeIcon(this, 204, 174, UI_ICON.warning, 56, this.ui);
      this.tweens.add({ targets: warn, scaleX: '*=1.08', scaleY: '*=1.08', duration: 620, yoyo: true, repeat: -1 });
      this.text(406, 174, 'O progresso da fase atual\nserá perdido ao voltar.', 12, UI.white, { wrap: 270 });
      this.button(384, 248, 'CANCELAR', () => this.show('pause'), 272, 40);
      this.button(384, 298, 'CONFIRMAR SAÍDA', () => { this.disposeWorld(); this.show('title'); }, 272, 40);
    } else if (screen === 'result') {
      this.audio.play('results'); this.addModalBackdrop(0x031129, .58, true); this.addConfetti();
      const w = this.world!;
      makePanel(this, 384, 216, 628, 344, 'cobalt', this.ui);
      makeRibbon(this, 384, 46, 328, 40, 'gold', this.ui);
      this.text(384, 46, 'MISSÃO CONCLUÍDA!', 18, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 2 });
      makePanel(this, 180, 170, 152, 152, 'gold', this.ui);
      this.ui.add(this.add.image(180, 169, 'arc-pilots', 1).setDisplaySize(128, 128));
      const crown = makeIcon(this, 144, 264, UI_ICON.crown, 24, this.ui);
      this.tweens.add({ targets: crown, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const rank = w.deaths === 0 && w.score >= 18000 ? 'S' : w.score >= 10000 ? 'A' : w.score >= 5000 ? 'B' : 'C';
      this.text(192, 264, `RANK ${rank}`, 14, UI.goldHex);
      this.text(468, 100, MISSIONS[this.currentMission].name, 17, UI.cyanHex);
      makePanel(this, 468, 148, 348, 50, 'cobalt', this.ui);
      this.text(362, 148, 'PONTUAÇÃO', 10.5, UI.silver);
      const scoreTxt = this.text(506, 148, String(w.score), 20, UI.goldHex);
      makeIcon(this, 616, 148, UI_ICON.coin0, 28, this.ui).play('ui-coin-spin');
      this.tweens.addCounter({ from: Math.round(w.score * .65), to: w.score, duration: 300, onUpdate: tw => { scoreTxt.setText(String(Math.round(tw.getValue() ?? w.score))); } });
      const secs = Math.floor(w.elapsed);
      this.text(468, 198, `TEMPO ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}  •  ${w.kills} ALVOS  •  ${w.collected} ITENS`, 12, UI.white);
      makeIcon(this, 316, 232, UI_ICON.lightning, 20, this.ui);
      this.text(476, 232, 'Potência, vidas e especiais seguem com você.', 11, UI.goldHex);
      if (w.up) {
        const b = w.pelagicScoring.snapshot();
        this.text(468, 260, `ESQUADRÕES ${b.formationsCleared}  •  SETORES ${b.sectorsClean}/7  •  BÔNUS +${b.totalBonus}`, 10, UI.cyanHex);
        if (w.isAssisted) this.text(468, 279, 'MODO ASSISTIDO ATIVO', 9, '#88fff2');
      }
      this.button(384, 312, this.currentMission === 0 ? 'PRÓXIMA: CIDADE SOLAR' : 'VER ENCERRAMENTO', () => { if (this.currentMission === 0) this.begin(1, this.carried); else this.show('ending'); }, 346, 40);
      this.button(384, 358, 'MENU', () => { this.disposeWorld(); this.show('title'); }, 184, 34);
    } else if (screen === 'defeat') {
      this.audio.play('defeat'); this.addModalBackdrop(0x260812, .64, true);
      const w = this.world!;
      makePanel(this, 384, 218, 480, 342, 'gold', this.ui);
      makeRibbon(this, 384, 50, 340, 40, 'red', this.ui);
      this.text(384, 50, 'ATERRISSAGEM… CRIATIVA!', 17, '#fff5f7', { stroke: '#4b0816', strokeThickness: 2 });
      makePanel(this, 384, 146, 134, 134, 'cobalt', this.ui);
      this.ui.add(this.add.image(384, 145, 'arc-pilots', 2).setDisplaySize(112, 112));
      this.text(384, 236, 'Bayek: "O importante é ter estilo na próxima!"', 12, UI.goldHex);
      if (w) this.text(384, 252, `PONTOS ${w.score}  •  PROGRESSO ${Math.min(100, Math.round(w.route / 3))}%${w.isAssisted ? '  •  ASSISTIDO' : ''}`, 10.5, UI.silver);
      const hasCp = !!(w?.up && this.activeCheckpointSnapshot);
      if (hasCp) {
        this.button(384, 292, 'CONTINUAR DO CHECKPOINT', () => {
          if (!this.world || !this.activeCheckpointSnapshot) { this.begin(this.currentMission); return; }
          if (this.world.restartFromCheckpoint(this.activeCheckpointSnapshot)) {
            this.stageClearSaved = false;
            this.audio.play('stage1');
            this.show('play');
          } else {
            this.begin(this.currentMission);
          }
        }, 296, 36, { fontSize: 12.5 });
      }
      this.button(384, hasCp ? 334 : 306, 'REINICIAR FASE', () => this.begin(this.currentMission), 260, 36, { fontSize: 12.5 });
      this.button(384, hasCp ? 372 : 354, 'MENU', () => { this.disposeWorld(); this.show('title'); }, 184, 34);
    } else if (screen === 'ending') {
      this.disposeWorld(); this.audio.play('victory'); this.addModalBackdrop(0x041530, .32, false); this.addConfetti();
      makeRibbon(this, 384, 40, 326, 42, 'gold', this.ui);
      this.text(384, 40, 'DO MAR AO CÉU!', 19, UI.cobaltHex, { stroke: '#fff6b0', strokeThickness: 2 });
      makePanel(this, 384, 198, 600, 220, 'cobalt', this.ui);
      makePanel(this, 194, 198, 162, 162, 'gold', this.ui);
      this.ui.add(this.add.image(194, 196, 'arc-pilots', 1).setDisplaySize(138, 138));
      this.text(468, 142, 'OPERAÇÃO CONCLUÍDA COM SUCESSO', 11.5, UI.cyanHex);
      this.text(468, 186, 'Bayek abriu caminho para a equipe de resgate.\nDuas missões concluídas. O próximo recorde é seu!', 12, UI.white, { wrap: 310 });
      const best = this.bestScoreFor();
      makePanel(this, 468, 252, 292, 42, 'gold', this.ui);
      makeIcon(this, 348, 252, UI_ICON.crown, 24, this.ui);
      this.text(468, 252, `RECORDE  ${best}`, 14, UI.goldHex);
      makeIcon(this, 588, 252, UI_ICON.coin0, 24, this.ui).play('ui-coin-spin');
      this.button(384, 366, 'VOAR DE NOVO', () => this.show('pilot'), 278, 42);
    }
    this.focusButtons();
    this.setTouchVisible(screen === 'play' || screen === 'touch-settings');
    if (screen === 'touch-settings') this.refreshTouchLayout();
  }
  begin(index: number, carry?: CampaignFlight): void {
    if (index === 0) { this.messageUntil = 0; this.activeCheckpointSnapshot = undefined; this.checkpointBannerUntil = 0; }
    this.disposeWorld(); this.currentMission = index; this.stageClearSaved = false; this.pelagicComms.reset();
    const settings = globalSave.getSettings();
    const usePortrait = index === 0 && this.isPortraitMobileMode();
    const portH = usePortrait ? this.portraitCanvasHeight() : 432;
    this.world = new ArcadeWorld(MISSIONS[index], carry, index === 0 ? {
      upLayout: usePortrait ? 'portrait' : 'pc',
      arena: usePortrait ? { left: 0, right: 384, top: 34, bottom: portH - 14 } : { left: 160, right: 608, top: 28, bottom: 420 },
    } : undefined);
    this.world.accessibility = settings.rapidFire;
    this.world.assisted = index === 0 && settings.assisted;
    this.world.hard = (index > 0 || !settings.assisted) && settings.difficulty !== 'normal';
    this.accumulator = 0;
    this.world.bossContact = (_boss, ax, ay, bx, by, radius) => spriteContact(this.bossSprite, ax, ay, bx, by, radius);
    this.world.subHullContact = (_sub, secIdx, ax, ay, bx, by, radius) => this.subBossArt.hullContact(secIdx, ax, ay, bx, by, radius);
    this.world.contact = (e, ax, ay, bx, by, radius) => { const sprite = this.enemySprites.get(e.id), turret = this.turrets.get(e.id); const hits = [sprite ? spriteContact(sprite, ax, ay, bx, by, radius) : null, turret ? spriteContact(turret, ax, ay, bx, by, radius) : null].filter((v): v is number => v !== null); return hits.length ? Math.min(...hits) : null; };
    this.player.setVisible(true); this.audio.play(index ? 'stage2' : 'stage1'); this.show('play');
  }
  private disposeWorld(): void {
    this.touchController?.clearAll(); this.emplacements?.clear(); this.hitOverlays?.clear(); this.bombArt?.draw(); this.subBossArt?.clear(); this.bossHudLabel?.setVisible(false); this.pelagicAssistBadge?.setVisible(false); this.pelagicCheckpointBadge?.setVisible(false); this.pelagicSpecialText?.setVisible(false); this.pelagicAnims?.clear(); this.pelagicComms.reset();
    this.clearBonusPopups();
    this.world = undefined; this.pelagicDesktopHud?.setVisible(false); this.player?.setVisible(false); this.bossSprite?.setVisible(false); this.lifeIcons.forEach(s => s.setVisible(false)); this.hud?.setText(''); this.radio?.setVisible(false); this.combatInk?.clear(); this.decor?.clear(); this.lastHud = '';
    for (const map of [this.enemySprites, this.partSprites, this.turrets]) { for (const s of map.values()) s.destroy(); map.clear(); } for (const s of this.cargoSprites.values()) s.destroy(); this.cargoSprites.clear(); for (const s of this.bulletSprites) s.setVisible(false); for (const e of this.effects) { e.sprite.setVisible(false); this.effectPool.push(e.sprite); } this.effects = []; globalAudio.stopCombatEffects();
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
      if (just('DOWN') || gp.down) { this.audio.unlock(); this.focus = (this.focus + 1) % Math.max(1, this.buttons.length); this.focusButtons(); globalAudio.playArcade('navigate'); }
      if (just('UP') || gp.up) { this.audio.unlock(); this.focus = (this.focus + this.buttons.length - 1) % Math.max(1, this.buttons.length); this.focusButtons(); globalAudio.playArcade('navigate'); }
      if (just('RIGHT') || gp.right) { this.audio.unlock(); if (active?.onRight) active.onRight(); else { this.focus = (this.focus + 1) % Math.max(1, this.buttons.length); this.focusButtons(); globalAudio.playArcade('navigate'); } }
      if (just('LEFT') || gp.left) { this.audio.unlock(); if (active?.onLeft) active.onLeft(); else { this.focus = (this.focus + this.buttons.length - 1) % Math.max(1, this.buttons.length); this.focusButtons(); globalAudio.playArcade('navigate'); } }
      const confirm = just('ENTER') || just('SPACE') || gp.confirm;
      if (confirm) { this.audio.unlock(); globalAudio.playArcade('confirm'); this.buttons[this.focus]?.action(); }
      else if (escPressed || gp.back || gp.menuOrBack) { if (this.screen === 'pause') this.show('play'); else if (this.screen === 'confirm-exit') this.show('pause'); else if (this.screen === 'controls') this.show(this.world ? 'pause' : this.pauseOrigin); else if (this.screen === 'touch-settings') this.show('settings'); else if (this.screen === 'settings') this.show(this.pauseOrigin); else if (this.screen === 'missions') this.show('pilot'); else if (this.screen === 'pilot') this.show('title'); }
    } else if (escPressed || gp.menuOrBack) this.show('pause');
    const resumedFromMenu = !startedInPlay && this.screen === 'play';
    if (this.world && this.screen === 'play' && !resumedFromMenu) {
      if (just('ENTER') || gp.confirm) this.world.introTime = 0;
      const held = (k: string) => !domInputFocused && this.controls[k].isDown;
      const touchCmd = this.touchController.consumeStep();
      const rawFire = held('SPACE') || gp.firePrimary || touchCmd.fire;
      if (this.suppressHeldFireUntilRelease && !rawFire) this.suppressHeldFireUntilRelease = false;
      const fireInput = this.suppressHeldFireUntilRelease ? false : rawFire;
      const moveX = clamp(Number(held('D') || held('RIGHT')) - Number(held('A') || held('LEFT')) + gp.moveX + touchCmd.x, -1, 1);
      const moveY = clamp(Number(held('S') || held('DOWN')) - Number(held('W') || held('UP')) + gp.moveY + touchCmd.y, -1, 1);
      const input: Controls = { x: moveX, y: moveY, fire: fireInput, special: held('X') || gp.special || touchCmd.special };
      this.lastInput = input;
      if (!this.devSimulationPaused) {
        this.accumulator += dt * this.devTimeScale;
        while (this.accumulator >= 1 / 120) { this.world.step(1 / 120, input); this.accumulator -= 1 / 120; }
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
      this.logo.setPosition(384, portraitTitle ? 74 : 116).setDisplaySize(portraitTitle ? 268 : 292, portraitTitle ? 190 : 208).setAlpha(1).setVisible(true);
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
    const alive = new Set<number>();
    this.emplacements.draw(w, this.quality);
    for (const e of w.enemies) {
      if (e.hp <= 0) continue; alive.add(e.id); let s = this.enemySprites.get(e.id); if (!s) { s = this.add.sprite(e.x, e.y, 'arc-enemies').setDepth(e.ground ? 2 : 8); this.enemySprites.set(e.id, s); } const enemyFrame = e.family === 'alien' ? (w.up ? 0 : 2) + Math.floor(time * 5) % 2 : e.family === 'airship' ? 12 : (w.up && e.family === 'tank' ? 7 : Math.max(0, FAMILY_ORDER.indexOf(e.family))) + (w.up ? 0 : 8); s.setOrigin(.5, .5).setFlipX(false).setPosition(e.x, e.y).setTexture(e.family === 'alien' ? 'arc-ufo' : 'arc-enemies', enemyFrame).setDisplaySize(e.size, e.size).setRotation(w.up && !e.ground && e.family !== 'alien' ? Math.PI : 0);
      if (w.up && (e.navigation?.anchor !== undefined || e.navigation?.customAnchor)) {
        const isFortressTower = e.family === 'tower' && !e.navigation?.customAnchor;
        const towerTex = this.textures.exists(PELAGIC_TOWER_CLEAN_SHEET) ? PELAGIC_TOWER_CLEAN_SHEET : TOWER_TEXTURE;
        const scl = isFortressTower ? 1.8 : e.navigation?.customAnchor ? 1.38 : 1.3;
        s.setTexture(isFortressTower ? towerTex : EMPLACEMENT_TEXTURE, 0).setOrigin(.5, isFortressTower ? .78 : .5).setDisplaySize(e.size * scl, e.size * scl);
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
    } for (const [id, s] of this.enemySprites) if (!alive.has(id)) { s.destroy(); this.enemySprites.delete(id); this.turrets.get(id)?.destroy(); this.turrets.delete(id); }
    if (w.up) {
      this.pelagicAnims.updateEnemies(w, this.enemySprites, this.turrets, dt, this.quality, (sp, fl) => this.hitOverlays.draw(sp, fl), this.devWeaponDebug);
      for (const e of w.enemies) {
        if (e.hp <= 0) continue;
        const s = this.enemySprites.get(e.id); if (s) this.hitOverlays.draw(s, e.flash);
      }
    }
    this.renderBoss(g);
    for (let i = 0; i < w.bullets.length; i++) {
      const b = w.bullets[i], s = this.bulletSprites[i]; s.setVisible(b.active); if (!b.active) continue;
      if (b.enemy && b.enemyMissile && this.textures.exists(PELAGIC_ENEMY_MISSILE_SHEET)) {
        s.setTexture(PELAGIC_ENEMY_MISSILE_SHEET, Math.floor(b.age * 18) % 4).setDisplaySize(18, 28).setRotation(Math.atan2(b.vy, b.vx) - Math.PI / 2);
      } else if (b.enemy) {
        s.setTexture('arc-orb-' + b.color).setDisplaySize(b.radius * 2 + 1.2, b.radius * 2 + 1.2).setRotation(0);
      } else {
        const art = w.up ? pelagicShotSize(w.weapons.weaponLevel) : rivetShotPresentation(w.weapons.weaponLevel); s.setTexture(b.missile ? 'arc-missile' : w.up ? 'pelagic-plasma' : 'arc-red', w.up && !b.missile ? undefined : Math.floor(b.age * 20) % 8).setDisplaySize(b.missile ? 17 : art.width, b.missile ? 25 : art.height).setRotation(Math.atan2(b.vy, b.vx) + Math.PI / 2);
      }
      s.setPosition(b.x, b.y);
    }
    this.renderCargo(); this.renderObstacles(g);
    this.bombArt.draw(w);
    for (const fx of this.effects) { fx.age += dt; fx.sprite.setPosition(fx.sprite.x + fx.vx * dt, fx.sprite.y + fx.vy * dt).setRotation(fx.sprite.rotation + fx.spin * dt).setAlpha(1 - fx.age / fx.duration * .7); fx.sprite.setFrame(Math.min(15, Math.floor(fx.age / fx.duration * 16))); }
    this.effects = this.effects.filter(f => { if (f.age >= f.duration) { f.sprite.setVisible(false); this.effectPool.push(f.sprite); return false; } return true; });
    this.updateBonusPopups(dt);
    this.renderHud();
    if (w.up) {
      if (w.state !== 'intro') {
        const comms = this.pelagicComms.current();
        if (comms && !this.portraitUpActive && !this.pelagicDesktopHud.isVisible() && !['result', 'defeat'].includes(this.screen)) {
          this.radio.setOrigin(0, 0).setPosition(602, 281)
            .setStyle({
              fontFamily: FONT,
              fontSize: '9.5px',
              fontStyle: 'bold italic',
              color: '#eef8ff',
              stroke: '#031029',
              strokeThickness: 2,
              lineSpacing: 2.2,
              wordWrap: { width: 146 },
              align: 'left',
            })
            .setText(comms.text.replace(/\n/g, ' ')).setVisible(true);
        } else {
          this.radio.setVisible(false);
        }
      } else if (this.portraitUpActive) {
        this.radio.setVisible(false);
      }
    } else if (this.clock > this.messageUntil) {
      this.radio.setVisible(false);
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
      ids.add(c.id); let sprite = this.cargoSprites.get(c.id);
      if (!sprite) { sprite = this.add.sprite(c.x, c.y, SUPPLY_ART, 0).setDepth(13); this.cargoSprites.set(c.id, sprite); }
      const start = c.crate ? 0 : c.kind === 'power' ? 4 : c.kind === 'life' ? 8 : 12, frame = start + Math.floor(c.age * 6) % 4;
      const recoveryCapsule = !c.crate && c.kind === 'power' && (c.recoveryP ?? 0) > 0;
      const displaySize = c.crate ? 58 : recoveryCapsule ? 32 : 28;
      sprite.setFrame(frame).setOrigin(.5, c.crate ? .81 : .5).setPosition(c.x, c.y).setDisplaySize(displaySize, displaySize).setAngle(Math.sin(c.age * 2) * 2);
      if (recoveryCapsule) sprite.setTint(0xffe970); else sprite.clearTint();
    }
    for (const [id, sprite] of this.cargoSprites) if (!ids.has(id)) { sprite.destroy(); this.cargoSprites.delete(id); }
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
  private renderHud(): void {
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

      // HUD aprovada: missão/Bayek/rádio à esquerda, gameplay 160..608, RIVET/power/especial/vidas à direita.
      this.hud.setVisible(false);
      this.radio.setVisible(false); // Mensagem desktop fica somente na HUD esquerda.
      this.pelagicSpecialText.setVisible(false);
      this.pelagicCheckpointBadge.setPosition(384, 44).setVisible(cpVisible);
      this.pelagicDesktopHud.draw(
        w,
        g,
        this.lifeIcons,
        this.pelagicLevel,
        this.pelagicAssistBadge,
        this.bossHudLabel,
        this.pelagicComms.current(),
        w.state === 'intro',
        this.clock,
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
      const line = `BAYEK / RIVET     ${w.score}     NV ${w.weapons.weaponLevel} ${w.weapons.powerMeter ? `+${w.weapons.powerMeter}P` : ''}`;
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
    }
    if (w.state === 'intro' && w.up && !this.portraitUpActive) {
      this.pelagicDesktopHud.setRadioMessage(
        'Entrando na Fenda Pelágica. Radar limpo por enquanto... Mas fiquem atentos, é uma rota instável!',
      );
      this.radio.setVisible(false);
      this.messageUntil = this.clock + .5;
    } else if (w.state === 'intro' && !w.up) {
      g.fillStyle(0xffe77d, .95).fillRoundedRect(220, 170, 328, 75, 12);
      const label = w.mission.name;
      this.radio.setOrigin(.5).setText(`MISSÃO ${this.currentMission + 1}\n${label}`).setPosition(384, 207).setVisible(true);
      this.messageUntil = this.clock + .5;
    }
  }
  private consumeEvents(): void {
    const w = this.world!; for (const e of w.events) {
      if (e.type === 'shot') { globalAudio.playShot('nolan', w.weapons.weaponLevel); if (w.up) this.pelagicAnims.triggerShot(); }
      else if (e.type === 'missile') { globalAudio.playMissile(); if (w.up) this.pelagicAnims.triggerMissile(); }
      else if (e.type === 'death') { if (w.up) { this.pelagicAnims.triggerPlayerDamage(); this.pelagicComms.trigger({ category: 'damage', detail: w.lives <= 1 ? 'low-lives' : undefined }); } }
      else if (e.type === 'enemy-shot') { globalAudio.playArcade(w.boss ? 'cannon' : 'orb'); if (w.up) this.pelagicAnims.triggerEnemyShot(e.x, e.y, e.size ?? 1); }
      else if (e.type === 'impact') { globalAudio.playArcade('impact'); if (this.effects.length < 18 + this.quality * 18) this.explosion(e.x, e.y, 10, .12); }
      else if (e.type === 'explosion') { globalAudio.playArcade((e.size ?? 1) > 1.3 ? 'boom' : 'pop'); if (e.text !== 'special-blast') { this.layeredExplosion(e); if (w.up) this.pelagicAnims.spawnEnemyDestruction(e.x, e.y, e.text, e.size ?? 1, this.quality); } }
      else if (e.type === 'pickup') globalAudio.playPickup(e.text ?? 'power');
      else if (e.type === 'special') globalAudio.playArcade('special');
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
    if (up && !this.portraitUpActive && this.pelagicDesktopHud.isVisible()) {
      this.pelagicDesktopHud.setRadioMessage(text);
      this.radio.setVisible(false);
      this.messageUntil = this.clock + 6;
      return;
    }
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
    if (this.devSaveGuard || this.stageClearSaved || !this.world) return; this.stageClearSaved = true; const w = this.world; this.carried = stageFlightSnapshot(w.mission.id, w.weapons, w.lives, w.score);
    const data = recordArcadeClear(this.arcadeProgress(), this.carried); try { localStorage.setItem('bullet_wake_arcade_v1', JSON.stringify(data)); } catch {/* Memory carry still supports next stage. */ }
    globalSave.recordStageClear(w.mission.id, 'nolan', w.score, this.carried);
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
      // Botão minimalista no painel direito, sem ocupar a rota dos aviões.
      container.setPosition(739, 16).setSize(40, 26);
      const bg = this.add.graphics();
      const drawCompactPc = (focused: boolean) => {
        bg.clear()
          .fillStyle(focused ? 0x0d3d75 : 0x041b3e, 0.98)
          .fillRoundedRect(-17, -10, 34, 20, 5)
          .lineStyle(1.15, focused ? 0xffdf4b : 0x41eaff, 0.98)
          .strokeRoundedRect(-17, -10, 34, 20, 5)
          .fillStyle(focused ? 0xffffff : 0xffdd31, 1)
          .fillRoundedRect(-5, -5, 3.3, 10, 1)
          .fillRoundedRect(2, -5, 3.3, 10, 1);
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
  }
  private installTouch(): void {
    this.touchGfx = this.add.graphics().setDepth(65);
    this.touchFireText = this.add.text(0, 0, 'TIRO', { fontFamily: FONT, fontSize: '10.5px', fontStyle: 'bold', color: '#fff8d4', stroke: '#081b38', strokeThickness: 2.5 }).setResolution(2).setOrigin(.5).setDepth(66);
    this.touchSpecialText = this.add.text(0, 0, 'ESP', { fontFamily: FONT, fontSize: '9.5px', fontStyle: 'bold', color: '#ffe4dc', stroke: '#081b38', strokeThickness: 2.5 }).setResolution(2).setOrigin(.5).setDepth(66);
    this.touchNodes = [this.touchGfx, this.touchFireText, this.touchSpecialText];
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
      if (targetSeconds >= 300) this.audio.play(w.up ? 'boss1' : 'boss2');
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
    const cur = this.pelagicComms.current();
    if (cur && !this.portraitUpActive && this.pelagicDesktopHud.isVisible()) {
      this.pelagicDesktopHud.setRadioMessage(cur.text);
      this.radio.setVisible(false);
    } else if (cur && !this.portraitUpActive) {
      this.radio
        .setOrigin(0, 0)
        .setStyle({
          fontFamily: FONT,
          fontSize: '9.5px',
          fontStyle: 'bold italic',
          color: '#eef8ff',
          stroke: '#031029',
          strokeThickness: 2,
          lineSpacing: 2.2,
          wordWrap: { width: 146 },
          align: 'left',
        })
        .setPosition(602, 281)
        .setText(cur.text.replace(/\n/g, ' '))
        .setVisible(true);
    }
  }
  devPelagicHudState() {
    if (!this.world) return null;
    return this.pelagicDesktopHud.snapshot(this.world, this.pelagicLevel, this.radio, this.pauseBtn);
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
