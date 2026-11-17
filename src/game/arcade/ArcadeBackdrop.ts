import Phaser from 'phaser';
import type { ArcadeWorld } from './ArcadeWorld';
import { installPelagicTextures } from './PelagicPresentation';
import {
  causticsScrollOffset,
  swellScrollOffset,
  waterDriftX,
  WATER_SCALE,
  waterScrollOffset,
} from './PelagicWater';
import {
  installOceanDepthTexture,
  installOceanCausticsTexture,
  installWaveCrestTextures,
  installCoastalShoalTexture,
} from './PelagicCoastAtlas';
import { coastWorldEdgeX } from './PelagicCoastGeometry';
import { PelagicCoastPainting } from './PelagicCoastPainting';
import { PelagicTideArchRenderer } from './PelagicTideArchArt';
import { installMenuAnims, UI_TEX } from './ArcadeMenuArt';
import { clamp } from './geometry';
import { getCombatVirtualSize } from '../render/combatResolution';
import { SUB_BEAM_HALF_W, SUB_SECTION_HEIGHT, subSectionCenterY } from './PelagicSubmarineBoss';

const STAGE1_LEFT = 184, STAGE1_WIDTH = 400;
export const MENU_HORIZON = 300;
const FAMILIES = ['fighter', 'interceptor', 'acrobat', 'bomber', 'boat', 'ship', 'tank', 'tower'];

interface NavHistory {
  x: number;
  worldY: number;
  heading: number;
  speedRatio: number;
  turnRate: number;
  prevElapsed: number;
}

export interface PelagicCoastStripState {
  x: number;
  y: number;
  visible: boolean;
  width: number;
  height: number;
}

export interface PelagicBackdropState {
  coast: {
    visible: boolean;
    visibleCount: number;
    stripCount: number;
    texture: string;
    strips: PelagicCoastStripState[];
  };
  water: {
    visible: boolean;
    texture: string;
    tilePositionY: number;
    depthVisible: boolean;
    depthTexture: string;
    swellVisible: boolean;
    causticsVisible: boolean;
    causticsTexture: string;
    activeWaves: number;
  };
  menuSkyVisible: boolean;
}

/** Connected painted coast at world speed; ocean highlights, shoreline surf, wakes and birds animate independently. */
export class ArcadeBackdrop {
  private ink: Phaser.GameObjects.Graphics;
  private waterGlint: Phaser.GameObjects.Graphics;
  private scenery: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private oceanDepth: Phaser.GameObjects.TileSprite;
  private waterSwell: Phaser.GameObjects.TileSprite;
  private water: Phaser.GameObjects.TileSprite;
  private oceanCaustics: Phaser.GameObjects.TileSprite;
  private seaFx: Phaser.GameObjects.Graphics;
  private surfaceSplash: Phaser.GameObjects.Graphics;
  private deepReefs: Phaser.GameObjects.Image[] = [];
  private waveSprites: Phaser.GameObjects.Image[] = [];
  private shadows: Phaser.GameObjects.Image[] = [];
  private wakes: Phaser.GameObjects.Image[] = [];
  private seagulls: Phaser.GameObjects.Sprite[] = [];
  private seagullShadows: Phaser.GameObjects.Image[] = [];
  private coastPainting: PelagicCoastPainting;
  private tideArch: PelagicTideArchRenderer;
  private menuSky: Phaser.GameObjects.Image;
  private navTrack = new Map<number, NavHistory>();

  constructor(private scene: Phaser.Scene) {
    this.ink = scene.add.graphics().setDepth(-20);
    installMenuAnims(scene);
    this.menuSky = scene.add.image(384, 216, UI_TEX.skyPanorama).setDisplaySize(768, 432).setDepth(-19.95).setVisible(false);
    installPelagicTextures(scene);
    this.coastPainting = new PelagicCoastPainting(scene);
    this.tideArch = new PelagicTideArchRenderer(scene);
    const waveKey = installWaveCrestTextures(scene);
    const shoalKey = installCoastalShoalTexture(scene);
    this.oceanDepth = scene.add.tileSprite(384, 216, STAGE1_WIDTH, 432, installOceanDepthTexture(scene)).setDepth(-19.8).setVisible(false);
    for (let i = 0; i < 8; i++) {
      this.deepReefs.push(scene.add.image(0, 0, shoalKey, 0).setDepth(-19.55).setTint(0x2d94b8).setAlpha(.3).setVisible(false));
    }
    this.waterSwell = scene.add.tileSprite(384, 216, STAGE1_WIDTH, 432, 'pelagic-water-review').setDepth(-19.35).setAlpha(.30).setVisible(false).setTileScale(WATER_SCALE * 1.45, WATER_SCALE * 1.45);
    this.water = scene.add.tileSprite(384, 216, STAGE1_WIDTH, 432, 'pelagic-water-review').setDepth(-19.2).setAlpha(.78).setTint(0xd0e9ff).setVisible(false).setTileScale(WATER_SCALE, WATER_SCALE);
    this.oceanCaustics = scene.add.tileSprite(384, 216, STAGE1_WIDTH, 432, installOceanCausticsTexture(scene)).setDepth(-18.9).setAlpha(.12).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setTileScale(.42, .42);
    this.waveSprites = Array.from({ length: 16 }, (_, i) => scene.add.image(0, 0, waveKey, i % 8).setDepth(-18.75).setVisible(false));
    this.waterGlint = scene.add.graphics().setDepth(-18.74);
    for (let i = 0; i < 8; i++) this.scenery.push(scene.add.image(0, 0, 'arc-scenery', i % 4).setDepth(-15));
    this.seaFx = scene.add.graphics().setDepth(-1);
    this.surfaceSplash = scene.add.graphics().setDepth(2.4);
    for (let i = 0; i < 5; i++) this.clouds.push(scene.add.image(0, 0, 'arc-scenery', 4).setDepth(-12).setAlpha(.18));

    // Register Phaser 4 2.5D Seagull Spritesheet Animations ('seagull-fly', 'seagull-glide', 'seagull-perch')
    if (scene.textures.exists('pelagic-seagulls')) {
      if (!scene.anims.exists('seagull-fly')) {
        scene.anims.create({ key: 'seagull-fly', frames: scene.anims.generateFrameNumbers('pelagic-seagulls', { start: 0, end: 5 }), frameRate: 9, repeat: -1 });
      }
      if (!scene.anims.exists('seagull-glide')) {
        scene.anims.create({ key: 'seagull-glide', frames: scene.anims.generateFrameNumbers('pelagic-seagulls', { start: 6, end: 8 }), frameRate: 4.5, repeat: -1 });
      }
      if (!scene.anims.exists('seagull-perch')) {
        scene.anims.create({ key: 'seagull-perch', frames: scene.anims.generateFrameNumbers('pelagic-seagulls', { start: 9, end: 11 }), frameRate: 2.2, repeat: -1 });
      }
    }
    for (let i = 0; i < 4; i++) {
      this.seagullShadows.push(scene.add.image(0, 0, 'pelagic-seagulls', 0).setTint(0x021833).setAlpha(.24).setDepth(-17.4).setVisible(false));
      this.seagulls.push(scene.add.sprite(0, 0, 'pelagic-seagulls', 0).setDepth(-11).setVisible(false));
    }
    for (let i = 0; i < 48; i++) this.shadows.push(scene.add.image(0, 0, 'arc-enemies', 0).setTint(0x031d3b).setAlpha(.22).setDepth(-2).setVisible(false));
    for (let i = 0; i < 16; i++) {
      this.wakes.push(scene.add.image(0, 0, 'pelagic-wakes', 0).setOrigin(.5, .85).setDepth(-1.5).setAlpha(.62).setVisible(false));
    }
  }

  draw(time: number, world?: ArcadeWorld, quality = 2, showMenuBackdrop = true): void {
    this.ink.clear(); this.waterGlint.clear(); this.seaFx.clear(); this.surfaceSplash.clear();
    this.menuSky.setVisible(false);
    for (const pool of [this.scenery, this.clouds, this.deepReefs, this.waveSprites, this.shadows, this.wakes, this.seagulls, this.seagullShadows]) {
      for (const sprite of pool) sprite.setVisible(false);
    }
    const vSize = getCombatVirtualSize(this.scene);
    const up = !!world?.up;
    const areaLeft = up ? world!.arena.left : STAGE1_LEFT;
    const areaWidth = up ? world!.arenaWidth : STAGE1_WIDTH;
    const areaCenter = areaLeft + areaWidth * 0.5;
    const viewH = Math.max(432, vSize.h);
    const openOcean = up ? (world?.boss?.sub || world?.state === 'exit' ? 1 : clamp(((world?.route ?? 0) - 285) / 11, 0, 1)) : 0;
    const coastAlpha = (1 - openOcean) * (up && world!.tideArch.isActive ? 0.55 : 1);
    this.coastPainting.draw(world?.scroll ?? 0, up, coastAlpha, world?.elapsed ?? time, quality, areaLeft, areaWidth);
    this.oceanDepth.setPosition(areaCenter, viewH * 0.5).setSize(areaWidth, viewH).setVisible(up);
    this.waterSwell.setPosition(areaCenter, viewH * 0.5).setSize(areaWidth, viewH).setVisible(up && quality >= 1);
    this.water.setPosition(areaCenter, viewH * 0.5).setSize(areaWidth, viewH).setVisible(up);
    this.oceanCaustics.setPosition(areaCenter, viewH * 0.5).setSize(areaWidth, viewH).setVisible(up && quality >= 1);
    if (!world) {
      this.navTrack.clear();
      this.tideArch.hide();
      // Static menu sky never reveals behind LOADING or STUDIO_SPLASH
      const skyCenterX = vSize.cx ?? vSize.w * 0.5;
      const skyCenterY = vSize.cy ?? vSize.h * 0.5;
      const skyW = Math.max(vSize.w, Math.round((vSize.h * 16) / 9));
      const skyH = Math.max(vSize.h, Math.round((skyW * 9) / 16));
      this.menuSky.setPosition(skyCenterX, skyCenterY).setDisplaySize(skyW, skyH).setVisible(showMenuBackdrop);
      return;
    }
    if (world.up) {
      this.ocean(world, quality, openOcean, coastAlpha, areaLeft, areaWidth, viewH);
      this.tideArch.draw(world, quality);
    } else {
      this.navTrack.clear();
      this.tideArch.hide();
      this.city(time, world, quality);
    }
  }

  /** Read-only snapshot of live Pelagic scene layers for automated visual checks. */
  pelagicState(): PelagicBackdropState {
    const strips = this.coastPainting.strips.map(strip => ({
      x: strip.x,
      y: strip.y,
      visible: strip.visible,
      width: strip.displayWidth,
      height: strip.displayHeight,
    }));
    return {
      coast: {
        visible: strips.length > 0 && strips.every(s => s.visible),
        visibleCount: strips.filter(s => s.visible).length,
        stripCount: strips.length,
        texture: this.coastPainting.strips[0]?.texture.key ?? '',
        strips,
      },
      water: {
        visible: this.water.visible,
        texture: this.water.texture.key,
        tilePositionY: this.water.tilePositionY,
        depthVisible: this.oceanDepth.visible,
        depthTexture: this.oceanDepth.texture.key,
        swellVisible: this.waterSwell.visible,
        causticsVisible: this.oceanCaustics.visible,
        causticsTexture: this.oceanCaustics.texture.key,
        activeWaves: this.waveSprites.filter(w => w.visible).length,
      },
      menuSkyVisible: this.menuSky.visible,
    };
  }

  private ocean(w: ArcadeWorld, quality: number, openOcean = 0, coastAlpha = 1, areaLeft = STAGE1_LEFT, areaWidth = STAGE1_WIDTH, viewH = 432): void {
    const time = w.elapsed;
    this.ink.fillStyle(0x042b62).fillRect(areaLeft, 0, areaWidth, viewH);
    this.oceanDepth.tilePositionY = -(w.scroll * .84 + time * 1.1);
    this.oceanDepth.tilePositionX = Math.cos(time * .16) * 2.1;

    const swell = swellScrollOffset(w.scroll, time);
    this.waterSwell.tilePositionY = swell.y;
    this.waterSwell.tilePositionX = swell.x;
    this.waterSwell.setAlpha(.34 + .08 * Math.sin(time * 1.15));

    this.water.tilePositionY = waterScrollOffset(w.scroll, time);
    this.water.tilePositionX = waterDriftX(time);

    const caustics = causticsScrollOffset(w.scroll, time);
    this.oceanCaustics.tilePositionY = caustics.y;
    this.oceanCaustics.tilePositionX = caustics.x;
    this.oceanCaustics.setAlpha(caustics.alpha * (quality > 1 ? 1.05 : .78));

    // Submerged parallax reefs drifting beneath waves along coastal shelves (fades out into open sea)
    if (quality > 0 && coastAlpha > .02) {
      const reefPeriod = Math.max(620, viewH + 180);
      for (let i = 0; i < this.deepReefs.length; i++) {
        const ry = ((i * 77 + w.scroll * .86) % reefPeriod + reefPeriod) % reefPeriod - 70;
        const side = i % 2 === 0 ? -1 : 1;
        const rx = side < 0 ? areaLeft + 36 + (i * 19) % 48 : areaLeft + areaWidth - 36 - (i * 23) % 48;
        this.deepReefs[i].setVisible(true).setFrame(0).setPosition(rx, ry).setDisplaySize(88 + (i % 3) * 14, 72 + (i % 2) * 14).setAlpha((.26 + .06 * Math.sin(time * .8 + i)) * coastAlpha);
      }
    }

    // Animated 2.5D wave crests with natural birth -> peak -> dissipate lifecycle even when scroll pauses
    const waveCount = quality > 1 ? 16 : quality === 1 ? 10 : 0;
    const wavePeriod = Math.max(460, viewH + 40);
    for (let i = 0; i < waveCount; i++) {
      const wy = ((i * 29 + w.scroll * 1.02 + time * 9.5) % wavePeriod + wavePeriod) % wavePeriod - 20;
      const cLeft = coastWorldEdgeX(wy - w.scroll, -1, areaLeft, areaWidth) + 22;
      const cRight = coastWorldEdgeX(wy - w.scroll, 1, areaLeft, areaWidth) - 22;
      const leftEdge = cLeft + (areaLeft + 18 - cLeft) * openOcean;
      const rightEdge = cRight + (areaLeft + areaWidth - 18 - cRight) * openOcean;
      if (rightEdge - leftEdge < 42) continue;
      const lane = ((i * 0.37 + Math.sin(i * 1.9) * .22) % 1 + 1) % 1;
      const wx = leftEdge + lane * (rightEdge - leftEdge) + Math.sin(time * .8 + i * 1.4) * 5.2;
      const life = ((time * .44 + i * .31) % 1 + 1) % 1;
      const envelope = Math.sin(life * Math.PI);
      const anim = time * 2.2 + i * 1.37;
      const frame = Math.floor(anim) % 8;
      const pulse = (.22 + .36 * envelope);
      const wSize = (32 + (i % 4) * 7) * (.88 + envelope * .2);
      this.waveSprites[i].setVisible(true).setFrame(frame).setPosition(wx, wy).setDisplaySize(wSize, wSize * .46).setAlpha(pulse);
    }

    // Soft underwater sunlight glints (strictly beneath ships/shots at depth -18.74, never orange/red)
    if (quality >= 1) {
      const glintCount = quality > 1 ? 14 : 7;
      const glintPeriod = Math.max(460, viewH + 40);
      const wg = this.waterGlint;
      for (let i = 0; i < glintCount; i++) {
        const gy = ((i * 37 + w.scroll * 1.08 + time * 14) % glintPeriod + glintPeriod) % glintPeriod - 14;
        const cLeft = coastWorldEdgeX(gy - w.scroll, -1, areaLeft, areaWidth) + 18;
        const cRight = coastWorldEdgeX(gy - w.scroll, 1, areaLeft, areaWidth) - 18;
        const leftEdge = cLeft + (areaLeft + 14 - cLeft) * openOcean;
        const rightEdge = cRight + (areaLeft + areaWidth - 14 - cRight) * openOcean;
        if (rightEdge - leftEdge < 34) continue;
        const u = ((i * .618 + Math.cos(i * 2.3) * .18) % 1 + 1) % 1;
        const gx = leftEdge + u * (rightEdge - leftEdge) + Math.sin(time * 1.4 + i) * 4;
        const twinkle = Math.max(0, Math.sin(time * 3.1 + i * 2.4));
        if (twinkle < .25) continue;
        const a = (twinkle - .25) / .75 * (quality > 1 ? .28 : .2);
        wg.fillStyle(0xdcf8ff, a).fillEllipse(gx, gy, 5 + twinkle * 5, 1.3);
      }
    }

    // Actual hull contact, altitude shadows, speed-aware naval wakes, coherent submarine ripples and seagulls
    const g = this.seaFx, splash = this.surfaceSplash;
    const seenActors = new Set<number>();
    let shadow = 0, wake = 0;
    for (const e of w.enemies) {
      if (shadow >= this.shadows.length - 1) break;
      const naval = e.family === 'boat' || e.family === 'ship';
      const heading = e.navigation?.heading ?? Math.PI;
      const rotation = naval ? heading : e.ground ? heading - Math.PI : e.family === 'alien' ? 0 : Math.PI;
      const texture = e.family === 'alien' ? 'arc-ufo' : 'arc-enemies';
      const frame = e.family === 'alien' ? 0 : e.family === 'airship' ? 12 : (w.up && e.family === 'tank' ? 7 : FAMILIES.indexOf(e.family));
      if (!naval && !e.submarine && e.navigation?.anchor === undefined) {
        this.shadows[shadow++].setVisible(true).setTexture(texture, Math.max(0, frame))
          .setPosition(e.x + (e.ground ? 3 : 12), e.y + (e.ground ? 4 : 16))
          .setDisplaySize(e.size * (e.ground ? .96 : .82), e.size * (e.ground ? .96 : .82))
          .setRotation(rotation).setAlpha(e.ground ? .3 : .2);
      }

      if (e.submarine) {
        const { phase, exposure } = e.submarine;
        const keelAlpha = phase === 'emerge' ? .32 * Math.min(1, exposure * 1.8) : phase === 'submerge' ? .30 * Math.max(.22, exposure) : .32;
        g.fillStyle(0x021736, keelAlpha).fillEllipse(e.x + 1, e.y + 4, e.size * .82, e.size * .30);

        // Soft organic shoreline foam hugging submerged/emerged submarine hull without concentric vector circles
        if (phase === 'emerge' || phase === 'hold') {
          const boilAlpha = phase === 'emerge' ? clamp(Math.sin(clamp(exposure, 0, 1) * Math.PI) * .48 + .16, 0, .54) : .36;
          g.fillStyle(0x28d6f0, boilAlpha * .42).fillEllipse(e.x, e.y + 2, e.size * (.68 + exposure * .14), e.size * .22);
          splash.lineStyle(1.5, 0xf2ffff, boilAlpha).beginPath();
          for (let s = 0; s <= 10; s++) {
            const u = s / 10 - .5, px = e.x + u * e.size * .78;
            const py = e.y + 5 + Math.cos(u * Math.PI) * 3.2 + Math.sin(time * 7 + s + e.id) * 1.0;
            if (s === 0) splash.moveTo(px, py); else splash.lineTo(px, py);
          }
          splash.strokePath();
        } else {
          const dive = 1 - exposure;
          const foamFade = clamp(.46 * Math.max(.15, 1 - dive * .82), .08, .48);
          g.fillStyle(0x22c8e8, foamFade * .38).fillEllipse(e.x, e.y + 2, e.size * (.60 - dive * .14), e.size * (.18 - dive * .04));
        }
        continue;
      }

      if (!naval) continue;

      seenActors.add(e.id);
      const navPhase = e.navigation?.phase ?? 'cruise';
      const holding = navPhase === 'hold';
      const worldY = e.navigation?.worldY ?? e.y - w.scroll;
      const fallbackSpeed = holding ? .16 : navPhase === 'enter' ? .55 : navPhase === 'exit' ? 1.15 : clamp(e.speed / 28, .48, 1.08);
      const prev = this.navTrack.get(e.id);
      let speedRatio = fallbackSpeed, turnRate = 0;
      if (prev && time > prev.prevElapsed) {
        const dt = Math.min(.15, time - prev.prevElapsed);
        if (dt > .001) {
          const instSpeed = Math.hypot(e.x - prev.x, worldY - prev.worldY) / dt;
          const instRatio = clamp(instSpeed / 30, holding ? .12 : .25, 1.35);
          speedRatio = prev.speedRatio + (instRatio - prev.speedRatio) * .35;
          const dHead = Math.atan2(Math.sin(heading - prev.heading), Math.cos(heading - prev.heading));
          turnRate = prev.turnRate + (clamp(dHead / dt, -2.5, 2.5) - prev.turnRate) * .35;
        }
        prev.x = e.x; prev.worldY = worldY; prev.heading = heading; prev.speedRatio = speedRatio; prev.turnRate = turnRate; prev.prevElapsed = time;
      } else {
        this.navTrack.set(e.id, { x: e.x, worldY, heading, speedRatio, turnRate, prevElapsed: time });
      }

      const angle = heading - Math.PI / 2;
      const fx = Math.cos(angle), fy = Math.sin(angle), sx = -fy, sy = fx;

      // 1. Anchored underwater keel contact pocket directly aligned to heading (replaces buoy rings)
      g.fillStyle(0x021735, .30).fillEllipse(e.x + fx * e.size * .02 + 1.5, e.y + fy * e.size * .02 + 2.5, e.size * .42, e.size * .72);

      // 2. Animated propeller wash sprite aligned strictly behind the stern
      if (wake < this.wakes.length) {
        const sternLen = e.size * (.38 + speedRatio * .42);
        const sternWidth = e.size * (.28 + speedRatio * .14);
        this.wakes[wake++].setVisible(true).setFrame(Math.floor(time * (holding ? 3 : 6) + e.id) % 4)
          .setPosition(e.x - fx * e.size * .22, e.y - fy * e.size * .22)
          .setDisplaySize(sternWidth, sternLen).setRotation(angle + Math.PI / 2)
          .setAlpha(holding ? .18 : clamp(.26 + speedRatio * .28, .22, .56));
      }

      // 3. Stern churning foam pocket scaled by velocity
      g.fillStyle(0x28d6f0, holding ? .16 : .30 * clamp(speedRatio, .4, 1.2)).fillEllipse(e.x - fx * e.size * .38, e.y - fy * e.size * .38, e.size * (.26 + speedRatio * .08), e.size * (.18 + speedRatio * .06));
      g.fillStyle(0xe8ffff, holding ? .14 : .32 * clamp(speedRatio, .4, 1.2)).fillEllipse(e.x - fx * e.size * .41, e.y - fy * e.size * .41, e.size * .16, e.size * .10);

      // 4. Bow cutwater splash & Kelvin V-wakes reacting smoothly to speed & turn direction
      if (speedRatio > .28) {
        const bowX = e.x + fx * e.size * .36, bowY = e.y + fy * e.size * .36;
        const flareAlpha = clamp((speedRatio - .25) * .68, .15, .64);
        splash.lineStyle(1.6, 0xf2ffff, flareAlpha).beginPath();
        for (const side of [-1, 1]) {
          const kx = bowX - fx * e.size * .16 + sx * side * e.size * (.16 + speedRatio * .05);
          const ky = bowY - fy * e.size * .16 + sy * side * e.size * (.16 + speedRatio * .05);
          splash.moveTo(bowX, bowY).lineTo(kx, ky);
        }
        splash.strokePath();
      }

      const wakeLen = e.size * (.32 + speedRatio * .72);
      const wakeSpread = e.size * (.12 + speedRatio * .18);
      const segs = quality > 1 ? 8 : quality === 1 ? 6 : 4;
      for (const side of [-1, 1]) {
        const turnBias = 1 + clamp(-side * turnRate * .28, -.28, .38);
        for (let j = 0; j < segs; j++) {
          const t0 = j / segs, t1 = (j + 1) / segs;
          const fade = (1 - t0) * clamp((holding ? .22 : .50) * (.65 + speedRatio * .45) * turnBias, .12, .62);
          const bend0 = clamp(-turnRate * 9, -8, 8) * t0 * t0;
          const bend1 = clamp(-turnRate * 9, -8, 8) * t1 * t1;
          const a0 = e.size * .22 + t0 * wakeLen, a1 = e.size * .22 + t1 * wakeLen;
          const w0 = (e.size * .10 + t0 * wakeSpread) * side + bend0 + Math.sin(time * 5.6 - t0 * 8 + e.id) * 1.4;
          const w1 = (e.size * .10 + t1 * wakeSpread) * side + bend1 + Math.sin(time * 5.6 - t1 * 8 + e.id) * 1.4;
          g.lineStyle((2.5 - t0 * 1.5) * (.8 + speedRatio * .25), j < 2 ? 0xe8ffff : 0x56e4fb, fade);
          g.lineBetween(e.x - fx * a0 + sx * w0, e.y - fy * a0 + sy * w0, e.x - fx * a1 + sx * w1, e.y - fy * a1 + sy * w1);
        }
      }
    }
    for (const id of this.navTrack.keys()) if (!seenActors.has(id)) this.navTrack.delete(id);

    // Naval Boss Water Displacement & Submarine Hydrodynamic Wash (depth 2.4 between submerged lower hull 2.15 and emerged dorsal spine 3.1):
    const b = w.boss;
    if (b?.sub && b.sub.phase !== 'done') {
      const sub = b.sub, bx = b.x;
      const bob = sub.phase === 'fight' ? Math.sin(time * 1.9) * 1.1 : 0;
      const collapseFade = sub.phase === 'collapse' ? Math.max(.2, 1 - sub.timer / 3.6) : 1;
      const surgeSpeed = sub.phase === 'transition' ? 1.45 : sub.phase === 'enter' ? 1.2 : 0.85;
      for (const sec of sub.sections) {
        const cy = subSectionCenterY(sub, sec.index) + bob;
        if (cy < -SUB_SECTION_HEIGHT * .75 || cy > 432 + SUB_SECTION_HEIGHT * .75) continue;
        const topY = cy - SUB_SECTION_HEIGHT * .49, botY = cy + SUB_SECTION_HEIGHT * .49;
        const hullWidthAt = (u: number): number => {
          if (sec.index === 0) return SUB_BEAM_HALF_W * 0.72 * Math.sin(clamp(u, 0, .99) * Math.PI * .5 + .08);
          if (sec.index === 4) return SUB_BEAM_HALF_W * (.28 + u * .44);
          return SUB_BEAM_HALF_W * 0.76;
        };
        // Organic curved waterline foam hugging the emerged pressure hull contour (no stiff polygon slab)
        for (const side of [-1, 1]) {
          for (let j = 0; j < 7; j++) {
            const u0 = j / 7, u1 = (j + .78) / 7;
            const y0 = topY + (botY - topY) * u0, y1 = topY + (botY - topY) * u1;
            const hw0 = sec.index === 0 ? SUB_BEAM_HALF_W * 0.72 * (1 - u0 * u0 * .84) : hullWidthAt(u0);
            const hw1 = sec.index === 0 ? SUB_BEAM_HALF_W * 0.72 * (1 - u1 * u1 * .84) : hullWidthAt(u1);
            const wave0 = Math.sin(time * 4.2 + j * 1.4 + sec.index) * 2.4;
            const wave1 = Math.sin(time * 4.2 + (j + .78) * 1.4 + sec.index) * 2.4;
            const alphaScale = ((sec.index === 0 && u0 > .86) ? .32 : .52) * Math.min(1.2, surgeSpeed);
            splash.lineStyle(3.4, 0x3adff6, alphaScale * .52 * collapseFade).lineBetween(bx + side * (hw0 + 2 + wave0), y0, bx + side * (hw1 + 2 + wave1), y1);
            splash.lineStyle(1.7, 0xf2ffff, alphaScale * .85 * collapseFade).lineBetween(bx + side * (hw0 + wave0 * .6), y0, bx + side * (hw1 + wave1 * .6), y1);
          }
        }
        // Soft curved organic bow surf crest hugging bow cone (replaces stiff geometric angular V triangles)
        if (sec.index === 0) {
          const tipY = cy + 106 + Math.sin(time * 3.6) * 1.4;
          for (const [spanX, crestY, lw, col, a] of [
            [52, tipY + 11, 5.2, 0x4ae7ff, .36],
            [40, tipY + 5, 2.5, 0xf2ffff, .72],
          ] as const) {
            splash.lineStyle(lw, col, a * collapseFade * Math.min(1.15, surgeSpeed)).beginPath();
            for (let s = 0; s <= 12; s++) {
              const t = s / 12, u = 1 - t;
              const px = u * u * (bx - spanX) + 2 * u * t * bx + t * t * (bx + spanX);
              const py = u * u * (tipY - spanX * .64) + 2 * u * t * crestY + t * t * (tipY - spanX * .64);
              if (s === 0) splash.moveTo(px, py); else splash.lineTo(px, py);
            }
            splash.strokePath();
          }
        }
        // Twin shrouded stern pump-jet cavitation boil off top of Section 4
        if (sec.index === 4) {
          for (const side of [-1, 1]) {
            const sx = bx + side * 34, sy = cy - 112;
            if (wake < this.wakes.length) {
              this.wakes[wake++].setVisible(true).setFrame(Math.floor(time * 4.8 + (side > 0 ? 1 : 0)) % 4)
                .setPosition(sx, sy - 20).setDisplaySize(48, 96).setRotation(0).setAlpha(.48 * collapseFade);
            }
          }
        }
      }
    } else if (b && b.phase !== 'absent' && b.phase !== 'sink') {
      const bob = b.phase === 'fight' ? Math.sin(time * 2.4) * 1.4 : 0;
      const bx = b.x, by = b.y + bob, bs = b.size;
      const vortexY = by - bs * .40;
      g.fillStyle(0x021735, .28).fillEllipse(bx + 2, by + 5, bs * .68, bs * .76);
      g.fillStyle(0x22d6eb, .24).fillEllipse(bx, vortexY, bs * .52, bs * .30);
      g.fillStyle(0xb8fcff, .22).fillEllipse(bx, vortexY + 4, bs * .34, bs * .18);
      for (const [k, lane] of [-.27, 0, .27].entries()) {
        if (wake >= this.wakes.length) break;
        const wIdx = wake++;
        const wakeFrame = Math.floor(time * 3.8 + k) % 4;
        const sideScale = lane === 0 ? 1 : .76;
        this.wakes[wIdx].setVisible(true).setFrame(wakeFrame)
          .setPosition(bx + lane * bs, by - bs * (lane === 0 ? .18 : .12))
          .setDisplaySize(bs * .40 * sideScale, bs * .82 * sideScale)
          .setRotation(0).setAlpha(lane === 0 ? .44 : .34);
      }
      for (const side of [-1, 1]) {
        for (let j = 0; j < 12; j++) {
          const t = (j / 12 + time * .45) % 1;
          const px = bx + side * (bs * (.28 + t * .11) + Math.sin(time * 4.5 + j) * 1.6);
          const py = by + bs * (.28 - t * .74);
          g.fillStyle(j % 2 === 0 ? 0xffffff : 0x7cebf7, (1 - t) * .56);
          g.fillEllipse(px, py, 2.6 + t * 2.4, 1.7 + t * 1.5);
        }
        for (let j = 0; j < 6; j++) {
          const t = j / 5;
          const px = bx + side * bs * (.04 + t * .22);
          const py = by + bs * (.38 - t * .10) + Math.sin(time * 5 + j) * 1.2;
          g.fillStyle(0xf2ffff, .52 - t * .22);
          g.fillEllipse(px, py, 3.2 - t * .8, 1.8);
        }
      }
    }

    // Scheduled 2.5D Seagull Director (paused during Colosso battle & Tide Arch canyon!):
    if (!b?.sub && !w.tideArch.isActive && quality > 0 && this.scene.textures.exists('pelagic-seagulls')) {
      const masterPeriod = 112.0;
      const cycleIdx = Math.floor(time / masterPeriod);
      const cycleT = time % masterPeriod;

      if (cycleT >= 8.5 && cycleT <= 14.0) {
        const p = (cycleT - 8.5) / 5.5;
        const dir = cycleIdx % 2 === 0 ? 1 : -1;
        const startX = dir > 0 ? areaLeft - 24 : areaLeft + areaWidth + 24;
        const endX = dir > 0 ? areaLeft + areaWidth + 24 : areaLeft - 24;
        const gx = startX + (endX - startX) * p;
        const gy = 142 + (p - .5) * (dir > 0 ? -46 : 40) + Math.sin(p * Math.PI) * -14;
        const fade = p < .08 ? p / .08 : p > .90 ? (1 - p) / .10 : 1;
        const gSprite = this.seagulls[0], gShadow = this.seagullShadows[0];
        const animKey = (p > .36 && p < .68) ? 'seagull-glide' : 'seagull-fly';
        if (gSprite.anims.currentAnim?.key !== animKey) gSprite.play(animKey);
        const bankRot = dir > 0 ? -0.10 : 0.10;
        gSprite.setVisible(true).setPosition(gx, gy).setDisplaySize(22, 22).setFlipX(dir < 0).setRotation(bankRot).setAlpha(fade * .92);
        gShadow.setVisible(true).setFrame(gSprite.frame.name).setPosition(gx + 9, gy + 15).setDisplaySize(19, 19).setFlipX(dir < 0).setRotation(bankRot).setAlpha(fade * .22);
      } else if (cycleT >= 36.0 && cycleT <= 42.2) {
        const p = (cycleT - 36.0) / 6.2;
        const dir = cycleIdx % 2 === 0 ? -1 : 1;
        const startX = dir > 0 ? areaLeft - 36 : areaLeft + areaWidth + 36;
        const endX = dir > 0 ? areaLeft + areaWidth + 36 : areaLeft - 36;
        const leadX = startX + (endX - startX) * p;
        const leadY = 168 + (p - .5) * (dir > 0 ? -38 : 34) + Math.sin(p * Math.PI) * -10;
        const fade = p < .09 ? p / .09 : p > .89 ? (1 - p) / .11 : 1;
        const bankRot = dir > 0 ? -0.09 : 0.09;
        const offsets: readonly [number, number, number][] = [[0, 0, 19], [-dir * 18, -15, 17], [-dir * 15, 16, 17]];
        offsets.forEach(([ox, oy, sz], k) => {
          const gx = leadX + ox + Math.sin(time * 2.2 + k) * 1.2;
          const gy = leadY + oy + Math.cos(time * 2.0 + k) * 1.2;
          const gSprite = this.seagulls[k], gShadow = this.seagullShadows[k];
          const animKey = ((p + k * .12) % 1 > .42 && (p + k * .12) % 1 < .72) ? 'seagull-glide' : 'seagull-fly';
          if (gSprite.anims.currentAnim?.key !== animKey) gSprite.play(animKey);
          gSprite.setVisible(true).setPosition(gx, gy).setDisplaySize(sz, sz).setFlipX(dir < 0).setRotation(bankRot).setAlpha(fade * .80);
          gShadow.setVisible(true).setFrame(gSprite.frame.name).setPosition(gx + 8, gy + 13).setDisplaySize(sz * .86, sz * .86).setFlipX(dir < 0).setRotation(bankRot).setAlpha(fade * .18);
        });
      } else if (cycleT >= 85.0 && cycleT <= 92.6) {
        const p = (cycleT - 85.0) / 7.6;
        const side = cycleIdx % 2 === 0 ? -1 : 1;
        const edgeX = side < 0 ? areaLeft - 18 : areaLeft + areaWidth + 18;
        const hoverX = side < 0 ? areaLeft + 118 : areaLeft + areaWidth - 118;
        const reach = p < .18 ? Math.sin(p / .18 * Math.PI * .5) : p > .82 ? Math.sin((1 - p) / .18 * Math.PI * .5) : 1;
        const gx = edgeX + (hoverX - edgeX) * reach + Math.sin(time * 1.9) * 3.2;
        const gy = 196 + Math.cos(time * 1.5) * 2.8 + (p - .5) * 14;
        const fade = p < .08 ? p / .08 : p > .90 ? (1 - p) / .10 : 1;
        const gSprite = this.seagulls[0], gShadow = this.seagullShadows[0];
        const animKey = Math.sin(time * 2.6) > -.25 ? 'seagull-glide' : 'seagull-fly';
        if (gSprite.anims.currentAnim?.key !== animKey) gSprite.play(animKey);
        const flip = p > .82 ? (side < 0) : (side > 0);
        const bankRot = Math.sin(time * 1.8) * .05;
        gSprite.setVisible(true).setPosition(gx, gy).setDisplaySize(20, 20).setFlipX(flip).setRotation(bankRot).setAlpha(fade * .92);
        gShadow.setVisible(true).setFrame(gSprite.frame.name).setPosition(gx + 3, gy + 4.5).setDisplaySize(19, 19).setFlipX(flip).setRotation(bankRot).setAlpha(fade * .32);
        if (reach > .7) {
          g.lineStyle(1, 0xd8ffff, fade * .28).strokeEllipse(gx + 1, gy + 4, 16 + Math.sin(time * 4) * 2.5, 7 + Math.cos(time * 4) * 1.2);
        }
      }
    }
    const shadowBank = clamp(w.player.bank, -1, 1);
    const alt = clamp(w.player.altitude ?? 1, 0, 1);
    const altScale = 0.78 + alt * 0.22;
    this.shadows[shadow].setVisible(w.state !== 'defeat').setTexture('arc-rivet', 1)
      .setPosition(w.player.x + 3.5 + alt * 8.5, w.player.y + 5 + alt * 12)
      .setDisplaySize(25 * altScale * (1 - Math.abs(shadowBank) * .22), 31 * altScale)
      .setRotation(shadowBank * .16)
      .setAlpha(.36 - alt * .14);
  }

  private city(time: number, w: ArcadeWorld, quality: number): void {
    const g = this.ink; g.fillGradientStyle(0x27aee1, 0x72d3ee, 0xffe4a6, 0xc6f7ec, 1).fillRect(0, 0, 768, 432);
    g.fillStyle(0xfff1a0).fillCircle(659 - w.scroll * .008 % 40, 78, 32);
    for (let layer = 0; layer < 3; layer++) {
      const factor = [.13, .3, .6][layer], base = [340, 380, 427][layer], palette = [[0x92cddc, 0xaed5e4, 0x95cad9], [0x69b8ce, 0x92aadb, 0x8ecbbe], [0xffb28d, 0x66bdc8, 0xb499cc]][layer];
      for (let i = 0; i < 15; i++) {
        const x = ((i * 79 - w.scroll * factor) % 1185 + 1185) % 1185 - 120, h = 75 + (i * 47 + layer * 31) % 130, bw = 46 + (i % 3) * 9;
        g.fillStyle(palette[i % 3]).fillRoundedRect(x, base - h, bw, h, 3); g.fillStyle(0x346d99, .25).fillRect(x + bw - 8, base - h, 8, h);
        g.fillStyle(0xf4ffcb, layer === 2 ? .65 : .35); for (let y = base - h + 12; y < base - 10; y += 16)for (let xx = x + 7; xx < x + bw - 10; xx += 13)g.fillRect(xx, y, 5, 7);
        if (i % 3 === 0) { g.lineStyle(2, 0x38798e, .6).lineBetween(x + bw / 2, base - h, x + bw / 2, base - h - 14); g.fillStyle(0xffd96b).fillCircle(x + bw / 2, base - h - 14, 2); }
      }
    }
    for (let i = 0; i < Math.min(quality + 2, 4); i++)this.clouds[i].setVisible(true).setPosition(((i * 233 - w.scroll * .08) % 1000 + 1000) % 1000 - 100, 65 + i % 2 * 40).setDisplaySize(180, 75).setAlpha(.65);
    this.scenery[0].setVisible(true).setFrame(w.region >= 5 ? 7 : 6).setPosition(((900 - w.scroll * .44) % 1500 + 1500) % 1500 - 200, 355).setDisplaySize(360, 200).setAlpha(.9);
    g.fillStyle(0x255f87).fillRect(0, 414, 768, 18); g.lineStyle(3, 0xffed8a).lineBetween(0, 414, 768, 414);
    for (let i = 0; i < 8; i++) { const x = ((i * 140 - w.scroll * 1.5) % 1120 + 1120) % 1120; g.fillStyle(i % 2 ? 0xffd252 : 0xe7f5fc).fillRoundedRect(x, 419, 18, 6, 2); }
    void time;
  }

  destroy(): void {
    this.ink.destroy(); this.waterGlint.destroy(); this.seaFx.destroy(); this.surfaceSplash.destroy(); this.menuSky.destroy();
    this.oceanDepth.destroy(); this.waterSwell.destroy(); this.water.destroy(); this.oceanCaustics.destroy();
    this.coastPainting.destroy();
    this.tideArch.destroy();
    for (const pool of [this.scenery, this.clouds, this.deepReefs, this.waveSprites, this.shadows, this.wakes, this.seagulls, this.seagullShadows]) pool.forEach(s => s.destroy());
    void this.scene;
  }
}
