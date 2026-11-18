import Phaser from 'phaser';
import type { ArcadeWorld, Controls } from './ArcadeWorld';
import { clamp } from './geometry';
import {
  PELAGIC_RIVET_SHEET,
  PELAGIC_ENEMY_AIR_SHEET,
  PELAGIC_UFO_SHEET,
  PELAGIC_VFX_SHEET,
  rivetBankColumn,
  rivetSheetFrame,
  enemyAirFrame,
  ufoAnimFrame,
  isHelicopterFamily,
  heliSheetFrame,
  rotorSheetFrame,
} from './PelagicActorAnimsMath';
import {
  PELAGIC_ENEMY_MISSILE_SHEET,
  PELAGIC_HELI_SHEET,
  PELAGIC_ROTOR_SHEET,
  PELAGIC_SUB_CLEAN_SHEET,
  PELAGIC_TOWER_CLEAN_SHEET,
  PELAGIC_TURRETS_SHEET,
  TURRET_PIVOT_ORIGIN_Y,
  hasArticulatedMounts,
  localToWorldPoint,
  resolveActorMounts,
  resolveHullVisualTransform,
} from './PelagicWeaponMounts';

export {
  PELAGIC_RIVET_SHEET,
  PELAGIC_ENEMY_AIR_SHEET,
  PELAGIC_UFO_SHEET,
  PELAGIC_VFX_SHEET,
  PELAGIC_HELI_SHEET,
  PELAGIC_ROTOR_SHEET,
  PELAGIC_TURRETS_SHEET,
  PELAGIC_SUB_CLEAN_SHEET,
  PELAGIC_TOWER_CLEAN_SHEET,
  PELAGIC_ENEMY_MISSILE_SHEET,
  rivetBankColumn,
  rivetSheetFrame,
  enemyAirFrame,
  ufoAnimFrame,
};

/** Preload Fenda Pelágica's multi-frame cel-shaded spritesheets (UP-only; Cidade Solar unchanged). */
export function preloadPelagicActorAnims(scene: Phaser.Scene, base: string): void {
  const p = `${base}assets/arcade/pelagic-review/`;
  scene.load.spritesheet(PELAGIC_RIVET_SHEET, `${p}rivet-up-sheet.webp`, { frameWidth: 256, frameHeight: 256 });
  scene.load.spritesheet(PELAGIC_ENEMY_AIR_SHEET, `${p}pelagic-enemy-air.webp`, { frameWidth: 128, frameHeight: 128 });
  scene.load.spritesheet(PELAGIC_UFO_SHEET, `${p}pelagic-ufo-anim.webp`, { frameWidth: 128, frameHeight: 128 });
  scene.load.spritesheet(PELAGIC_VFX_SHEET, `${p}pelagic-vfx.webp`, { frameWidth: 128, frameHeight: 128 });
  scene.load.spritesheet(PELAGIC_SUB_CLEAN_SHEET, `${p}submarines-clean.webp`, { frameWidth: 887, frameHeight: 887 });
  scene.load.spritesheet(PELAGIC_TOWER_CLEAN_SHEET, `${p}defense-tower-clean.webp`, { frameWidth: 887, frameHeight: 887 });
  scene.load.spritesheet(PELAGIC_TURRETS_SHEET, `${p}pelagic-turrets.webp`, { frameWidth: 160, frameHeight: 160 });
  scene.load.spritesheet(PELAGIC_HELI_SHEET, `${p}pelagic-helicopters.webp`, { frameWidth: 192, frameHeight: 192 });
  scene.load.spritesheet(PELAGIC_ROTOR_SHEET, `${p}pelagic-rotors.webp`, { frameWidth: 160, frameHeight: 160 });
  scene.load.spritesheet(PELAGIC_ENEMY_MISSILE_SHEET, `${p}pelagic-enemy-missile.webp`, { frameWidth: 128, frameHeight: 128 });
}

type TrailPoint = { x: number; y: number; alpha: number };
type EnemyTrack = { x: number; y: number; vx: number; vy: number; smoothBank: number; cooldown: number; shotFlash: number; recoil: number; flashPrev: number; smokeTimer: number; };
type SparkParticle = { sprite: Phaser.GameObjects.Sprite; x: number; y: number; vx: number; vy: number; age: number; duration: number; size0: number; size1: number; rotSpeed: number; frameStart: number; frameCount: number; alpha: number; };

export class PelagicActorAnims {
  private booster: Phaser.GameObjects.Sprite;
  private muzzle: Phaser.GameObjects.Sprite;
  private pylonL: Phaser.GameObjects.Sprite;
  private pylonR: Phaser.GameObjects.Sprite;
  private shield: Phaser.GameObjects.Sprite;
  private recoveryRing: Phaser.GameObjects.Sprite;
  private energyCore: Phaser.GameObjects.Sprite;
  private speedGfx: Phaser.GameObjects.Graphics;
  private shadowGfx: Phaser.GameObjects.Graphics;
  private groundShadowGfx: Phaser.GameObjects.Graphics;

  private playerPrevX = 384;
  private playerPrevY = 376;
  private playerSmoothVx = 0;
  private playerSmoothVy = 0;
  private prevInvuln = 0;
  private prevLives = 3;
  private recoil = 0;
  private muzzleAge = 9;
  private missileAge = 9;
  private recoveryAge = 9;
  private damageAge = 9;
  private trailL: TrailPoint[] = [];
  private trailR: TrailPoint[] = [];
  private slipstreaks: Array<{ x: number; y: number; len: number; speed: number; alpha: number }> = [];

  private enemyTracks = new Map<number, EnemyTrack>();
  private mountSprites = new Map<number, Phaser.GameObjects.Sprite[]>();
  private rotorSprites = new Map<number, Phaser.GameObjects.Sprite[]>();
  private missileTrailClock = 0;
  private pool: Phaser.GameObjects.Sprite[] = [];
  private particles: SparkParticle[] = [];
  private splashRings: Array<{ x: number; y: number; age: number; duration: number; maxRadius: number }> = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.groundShadowGfx = scene.add.graphics().setDepth(1.85).setVisible(false);
    this.shadowGfx = scene.add.graphics().setDepth(4.5).setVisible(false);
    this.speedGfx = scene.add.graphics().setDepth(11.6).setVisible(false);
    this.booster = scene.add.sprite(0, 0, PELAGIC_VFX_SHEET, 0).setDepth(17.7).setVisible(false);
    this.energyCore = scene.add.sprite(0, 0, PELAGIC_VFX_SHEET, 8).setDepth(17.8).setVisible(false);
    this.muzzle = scene.add.sprite(0, 0, PELAGIC_VFX_SHEET, 4).setDepth(18.3).setVisible(false);
    this.pylonL = scene.add.sprite(0, 0, PELAGIC_VFX_SHEET, 4).setDepth(18.25).setVisible(false);
    this.pylonR = scene.add.sprite(0, 0, PELAGIC_VFX_SHEET, 4).setDepth(18.25).setVisible(false);
    this.shield = scene.add.sprite(0, 0, PELAGIC_VFX_SHEET, 8).setDepth(18.4).setVisible(false);
    this.recoveryRing = scene.add.sprite(0, 0, PELAGIC_VFX_SHEET, 8).setDepth(18.45).setVisible(false);
    for (let i = 0; i < 14; i++) {
      this.slipstreaks.push({ x: 210 + i * 26, y: (i * 37) % 432, len: 16 + (i % 4) * 8, speed: 260 + (i % 3) * 55, alpha: .08 + (i % 3) * .04 });
    }
  }

  clear(): void {
    this.speedGfx.clear().setVisible(false);
    this.shadowGfx.clear().setVisible(false);
    this.groundShadowGfx.clear().setVisible(false);
    for (const s of [this.booster, this.energyCore, this.muzzle, this.pylonL, this.pylonR, this.shield, this.recoveryRing]) s.setVisible(false);
    for (const arr of this.mountSprites.values()) for (const s of arr) { s.setVisible(false); this.pool.push(s); }
    for (const arr of this.rotorSprites.values()) for (const s of arr) { s.setVisible(false); this.pool.push(s); }
    this.mountSprites.clear(); this.rotorSprites.clear();
    this.enemyTracks.clear();
    this.trailL = []; this.trailR = []; this.splashRings = [];
    for (const p of this.particles) { p.sprite.setVisible(false); this.pool.push(p.sprite); }
    this.particles = [];
    this.recoil = 0; this.muzzleAge = 9; this.missileAge = 9; this.recoveryAge = 9; this.damageAge = 9; this.missileTrailClock = 0;
    this.prevInvuln = 0; this.prevLives = 3; this.playerSmoothVx = 0; this.playerSmoothVy = 0;
  }

  hide(): void {
    this.speedGfx.clear().setVisible(false);
    this.shadowGfx.clear().setVisible(false);
    this.groundShadowGfx.clear().setVisible(false);
    for (const s of [this.booster, this.energyCore, this.muzzle, this.pylonL, this.pylonR, this.shield, this.recoveryRing]) s.setVisible(false);
    for (const arr of this.mountSprites.values()) for (const s of arr) s.setVisible(false);
    for (const arr of this.rotorSprites.values()) for (const s of arr) s.setVisible(false);
    for (const p of this.particles) p.sprite.setVisible(false);
  }

  destroy(): void {
    this.clear();
    this.groundShadowGfx.destroy();
    this.shadowGfx.destroy();
    this.speedGfx.destroy();
    for (const s of [this.booster, this.energyCore, this.muzzle, this.pylonL, this.pylonR, this.shield, this.recoveryRing]) s.destroy();
    for (const s of this.pool) s.destroy();
    this.pool = [];
  }

  triggerShot(): void { this.recoil = 1; this.muzzleAge = 0; }
  triggerMissile(): void { this.missileAge = 0; }
  triggerPlayerDamage(): void { this.damageAge = 0; this.recoil = 1; }

  triggerEnemyShot(x: number, y: number, size = 1): void {
    if (this.particles.length > 64) return;
    const isMissile = size >= 1.45;
    const flash = this.borrowSprite(PELAGIC_VFX_SHEET, 4, 18.95);
    const f0 = isMissile ? 15 : 9;
    const f1 = isMissile ? 28 : 18;
    this.particles.push({
      sprite: flash, x, y, vx: 0, vy: isMissile ? -18 : 10, age: 0, duration: isMissile ? .18 : .10,
      size0: f0, size1: f1, rotSpeed: 5, frameStart: 4, frameCount: 4, alpha: isMissile ? .95 : .85,
    });
    const smoke = this.borrowSprite(PELAGIC_VFX_SHEET, 12, 18.85);
    this.particles.push({
      sprite: smoke, x, y, vx: (Math.random() - .5) * 10, vy: isMissile ? -26 : 12, age: 0, duration: isMissile ? .42 : .26,
      size0: isMissile ? 12 : 8, size1: isMissile ? 26 : 16, rotSpeed: 2.4, frameStart: 12, frameCount: 4, alpha: isMissile ? .75 : .50,
    });
  }

  spawnHitSpark(x: number, y: number, size = 16): void {
    if (this.particles.length > 64) return;
    const sprite = this.borrowSprite(PELAGIC_VFX_SHEET, 4, 19.2);
    this.particles.push({
      sprite, x, y, vx: (Math.random() - .5) * 22, vy: 18, age: 0, duration: .14,
      size0: size * .9, size1: size * 1.35, rotSpeed: 6, frameStart: 4, frameCount: 4, alpha: .88,
    });
  }

  spawnEnemyDestruction(x: number, y: number, family: string | undefined, size: number, quality: number): void {
    const naval = family === 'boat' || family === 'ship' || family === 'submarine';
    const heli = !!family && family.startsWith('heli_');
    if (naval) this.splashRings.push({ x, y, age: 0, duration: .55, maxRadius: Math.max(24, size * 15) });
    const sparkCount = quality === 0 ? 2 : heli ? 7 : naval ? 5 : 4;
    for (let i = 0; i < sparkCount; i++) {
      if (this.particles.length > 64) break;
      const a = i * (Math.PI * 2 / sparkCount) + (x + y) * .03;
      const spd = (heli ? 72 : naval ? 44 : 58) + i * 9;
      const useFlash = heli && i % 2 === 1;
      const sprite = this.borrowSprite(PELAGIC_VFX_SHEET, useFlash ? 4 : 12, 19.5);
      const puffSize = Math.max(14, size * (heli ? 13 : 11));
      this.particles.push({
        sprite, x: x + Math.cos(a) * (heli ? 7 : 4), y: y + Math.sin(a) * (heli ? 7 : 4),
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd + (naval ? 8 : heli ? 28 : 18),
        age: 0, duration: heli ? (useFlash ? .26 : .56) : naval ? .48 : .38, size0: puffSize * .7, size1: puffSize * (heli ? 1.45 : 1.25),
        rotSpeed: (i % 2 ? 1 : -1) * (heli ? 5.4 : 3.2), frameStart: useFlash ? 4 : 12, frameCount: 4, alpha: heli ? .9 : .82,
      });
    }
  }

  /** Animate RIVET's 7-bank x 4-flame spritesheet, thrusters, firing recoil/muzzle, speed streaks, damage & shield recovery. */
  updatePlayer(
    w: ArcadeWorld, playerSprite: Phaser.GameObjects.Sprite, dt: number, input: Controls, quality: number,
  ): void {
    const alive = w.state !== 'defeat';
    const time = w.elapsed;
    const g = this.speedGfx;
    g.clear();

    if (!alive) {
      this.hide(); this.trailL = []; this.trailR = [];
      return;
    }

    g.setVisible(true);
    const safeDt = Math.max(dt, 1 / 240);
    const rawVx = dt > 0 ? (w.player.x - this.playerPrevX) / safeDt : 0;
    const rawVy = dt > 0 ? (w.player.y - this.playerPrevY) / safeDt : 0;
    // Detect respawn jump so wingtip trails reset cleanly without long teleports across the screen
    if (Math.hypot(w.player.x - this.playerPrevX, w.player.y - this.playerPrevY) > 64) {
      this.trailL = []; this.trailR = []; this.playerSmoothVx = 0; this.playerSmoothVy = 0;
    } else if (dt > 0) {
      const k = Math.min(1, dt * 14);
      this.playerSmoothVx += (rawVx - this.playerSmoothVx) * k;
      this.playerSmoothVy += (rawVy - this.playerSmoothVy) * k;
    }
    this.playerPrevX = w.player.x; this.playerPrevY = w.player.y;

    // Transition detection: lives lost -> damage shock; invuln -> 0 -> crisp recovery lock-in
    if (w.lives < this.prevLives) this.damageAge = 0;
    this.prevLives = w.lives;
    if (this.prevInvuln > 0 && w.player.invulnerable <= 0) this.recoveryAge = 0;
    this.prevInvuln = w.player.invulnerable;

    if (dt > 0) {
      this.recoil = Math.max(0, this.recoil - dt * 11.5);
      this.muzzleAge += dt;
      this.missileAge += dt;
      this.recoveryAge += dt;
      this.damageAge += dt;
    }

    const advancing = input.y < -.15 || this.playerSmoothVy < -55 || w.state === 'exit';
    const braking = input.y > .2 || this.playerSmoothVy > 65;
    const bank = w.player.bank;
    const sheetReady = this.scene.textures.exists(PELAGIC_RIVET_SHEET);
    const frame = sheetReady ? rivetSheetFrame(bank, time, advancing) : (bank < -.3 ? 0 : bank > .3 ? 2 : Math.floor(time * 9) % 2 ? 1 : 3);

    const alt = clamp(w.player.altitude ?? 1, 0, 1);
    const altScale = 0.78 + alt * 0.22;
    // Pure longitudinal roll via 2.5D spritesheet frames: nose stays strictly pointed UP (0 deg 2D yaw in flight).
    const damageShakeDeg = this.damageAge < .22 ? Math.sin(this.damageAge * 58) * 7 * (1 - this.damageAge / .22) : 0;
    const recoilY = this.recoil * 2.1;
    const divingPose = w.tideArch.phase === 'descent' ? 0.95 : w.tideArch.phase === 'ascent' ? 1.04 : 1;
    const stretchY = (advancing ? 1.03 : braking ? .97 : 1) * divingPose;
    const dispW = 37 * (1 + this.recoil * .03) * altScale;
    const dispH = 38 * (stretchY - this.recoil * .04) * altScale;
    const underBridge = w.tideArch.isInBridgeBand(w.scroll, w.player.y);

    const flicker = (w.player.invulnerable > 0 && w.player.invulnerable < .85) ? (.55 + .45 * Math.cos(time * 28) ** 2) : (w.player.invulnerable > 0 ? (.80 + .20 * Math.cos(time * 15) ** 2) : 1);
    playerSprite
      .setTexture(sheetReady ? PELAGIC_RIVET_SHEET : 'arc-rivet', frame)
      .setPosition(w.player.x, w.player.y + recoilY)
      .setDisplaySize(dispW, dispH)
      .setDepth(underBridge ? 16.4 : 18)
      .setAngle(damageShakeDeg)
      .setAlpha(flicker)
      .setVisible(true);

    if (this.damageAge < .18) {
      playerSprite.setTint(0xff9292);
    } else {
      playerSprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }

    // Low-altitude ocean wave wake spray beneath RIVET when skimming near the waves
    if (alt < 0.72 && quality > 0) {
      const wash = 1 - alt / 0.72;
      const waveY = w.player.y + 18 * altScale;
      const waveW = 14 + wash * 14 + Math.sin(time * 24) * 2.5;
      g.fillStyle(0x8ff4ff, wash * 0.28).fillEllipse(w.player.x, waveY + 4, waveW * 1.25, 7 + wash * 5);
      g.lineStyle(1.4, 0xf2ffff, wash * 0.56).lineBetween(w.player.x - waveW * 0.7, waveY + 2, w.player.x - waveW * 1.1, waveY + 14);
      g.lineBetween(w.player.x + waveW * 0.7, waveY + 2, w.player.x + waveW * 1.1, waveY + 14);
    }

    // Overboost cyan plasma plumes when advancing/exiting/climbing
    if (this.scene.textures.exists(PELAGIC_VFX_SHEET)) {
      const vfxF = Math.floor(time * 22) % 4;
      const archBoost = w.tideArch.phase === 'ascent' || w.tideArch.phase === 'descent' ? 0.42 : 0;
      const boostAlpha = advancing ? (.72 + .18 * Math.sin(time * 24)) : braking ? archBoost : Math.max(.22, archBoost + .18);
      if (boostAlpha > .02) {
        const boostLen = (advancing || w.tideArch.phase === 'ascent' ? 24 : 14) * altScale;
        this.booster
          .setTexture(PELAGIC_VFX_SHEET, vfxF)
          .setPosition(w.player.x, w.player.y + 17 * altScale + recoilY)
          .setDisplaySize(16 * altScale * Math.max(.42, Math.cos(bank * 1.15)), boostLen)
          .setDepth(underBridge ? 16.2 : 17.7)
          .setAngle(damageShakeDeg)
          .setAlpha(boostAlpha)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(true);
      } else {
        this.booster.setVisible(false);
      }

      // Subtle power/energy intake aura at NV4 / FULL or special readiness
      if ((w.weapons.weaponLevel >= 4 || w.specialTime > 0) && quality > 0) {
        const pulse = .5 + .5 * Math.sin(time * 7.5);
        this.energyCore
          .setTexture(PELAGIC_VFX_SHEET, 8 + Math.floor(time * 10) % 4)
          .setPosition(w.player.x, w.player.y + recoilY + 1)
          .setDisplaySize(22 + pulse * 3, 22 + pulse * 3)
          .setAlpha(w.specialTime > 0 ? .45 : .14 + .08 * pulse)
          .setTint(w.specialTime > 0 ? 0xffe46b : 0x5cecff)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(true);
      } else {
        this.energyCore.setVisible(false);
      }

      // Muzzle flash sprite on primary shot
      if (this.muzzleAge < .095) {
        const mp = this.muzzleAge / .095;
        const mFrame = 4 + Math.min(3, Math.floor(mp * 4));
        const lvScale = 1 + (w.weapons.weaponLevel - 1) * .11;
        this.muzzle
          .setTexture(PELAGIC_VFX_SHEET, mFrame)
          .setPosition(w.player.x, w.player.y - 17 * altScale + recoilY * .3)
          .setDisplaySize(18 * lvScale, 20 * lvScale)
          .setAngle(damageShakeDeg + mp * 35)
          .setAlpha((1 - mp * .6) * .92)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(true);
      } else {
        this.muzzle.setVisible(false);
      }

      // Wing pylon flashes on guided/automatic missile launch (NV3..5)
      if (this.missileAge < .14) {
        const mp = this.missileAge / .14;
        const f = 4 + Math.min(3, Math.floor(mp * 4));
        const span = 10 * Math.max(.26, Math.cos(Math.abs(bank) * 1.28));
        this.pylonL.setTexture(PELAGIC_VFX_SHEET, f).setPosition(w.player.x - span, w.player.y - 2 + recoilY).setDisplaySize(12, 12).setAlpha((1 - mp) * .85).setTint(0xffdf68).setBlendMode(Phaser.BlendModes.ADD).setVisible(true);
        this.pylonR.setTexture(PELAGIC_VFX_SHEET, f).setPosition(w.player.x + span, w.player.y - 2 + recoilY).setDisplaySize(12, 12).setAlpha((1 - mp) * .85).setTint(0xffdf68).setBlendMode(Phaser.BlendModes.ADD).setVisible(true);
      } else {
        this.pylonL.setVisible(false); this.pylonR.setVisible(false);
      }

      // Invulnerability holographic barrier shimmer
      if (w.player.invulnerable > 0) {
        const sFrame = 8 + Math.floor(time * 12) % 4;
        const warnPulse = w.player.invulnerable < .85 ? (.4 + .6 * Math.abs(Math.sin(time * 18))) : 1;
        this.shield
          .setTexture(PELAGIC_VFX_SHEET, sFrame)
          .setPosition(w.player.x, w.player.y + recoilY)
          .setDisplaySize(44, 44)
          .setRotation(time * 2.6)
          .setTint(this.damageAge < .3 ? 0xff7676 : 0x8cf4ff)
          .setAlpha(.52 * warnPulse)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(true);
      } else {
        this.shield.setVisible(false);
      }

      // Smooth lock-in pulse ring when recovering from invulnerability or taking damage
      if (this.recoveryAge < .28) {
        const rp = this.recoveryAge / .28;
        const sz = 36 + rp * 20;
        this.recoveryRing
          .setTexture(PELAGIC_VFX_SHEET, 8 + Math.min(3, Math.floor(rp * 4)))
          .setPosition(w.player.x, w.player.y)
          .setDisplaySize(sz, sz)
          .setTint(0x98ffe8)
          .setAlpha((1 - rp) * .68)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(true);
      } else if (this.damageAge < .26) {
        const dp = this.damageAge / .26;
        const sz = 26 + dp * 34;
        this.recoveryRing
          .setTexture(PELAGIC_VFX_SHEET, 8)
          .setPosition(w.player.x, w.player.y)
          .setDisplaySize(sz, sz)
          .setTint(0xff5252)
          .setAlpha((1 - dp) * .78)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setVisible(true);
      } else {
        this.recoveryRing.setVisible(false);
      }
    }

    // Wingtip contrail ribbons & subtle air-speed slipstream streaks (low alpha, below bullets!)
    if (quality > 0) {
      const moveMag = Math.hypot(this.playerSmoothVx, this.playerSmoothVy);
      const spanX = 13.5 * Math.max(.25, Math.cos(Math.abs(bank) * 1.32));
      const lx = w.player.x - spanX, ly = w.player.y + 8 - bank * 4.2;
      const rx = w.player.x + spanX, ry = w.player.y + 8 + bank * 4.2;
      const trailStrength = clamp(Math.abs(bank) * .68 + (advancing ? .42 : moveMag > 45 ? .22 : .08), 0, 1);
      if (dt > 0) {
        for (const pt of this.trailL) { pt.y += 155 * dt; pt.alpha *= Math.max(0, 1 - dt * 7); }
        for (const pt of this.trailR) { pt.y += 155 * dt; pt.alpha *= Math.max(0, 1 - dt * 7); }
        if (trailStrength > .14) {
          this.trailL.unshift({ x: lx, y: ly, alpha: trailStrength });
          this.trailR.unshift({ x: rx, y: ry, alpha: trailStrength });
          if (this.trailL.length > 8) this.trailL.length = 8;
          if (this.trailR.length > 8) this.trailR.length = 8;
        }
      }
      for (const ribbon of [this.trailL, this.trailR]) {
        for (let i = 0; i < ribbon.length - 1; i++) {
          const a = ribbon[i], b = ribbon[i + 1];
          const fade = (1 - i / ribbon.length) * Math.min(a.alpha, b.alpha) * .30;
          if (fade <= .02) continue;
          g.lineStyle(1.4 * (1 - i / ribbon.length * .5), 0xdcfaff, fade).lineBetween(a.x, a.y, b.x, b.y);
        }
      }

      // Subtle slipstream streaks across lane scaled by climb / exit velocity
      const speedScale = w.state === 'exit' ? 1.9 : advancing ? 1.45 : braking ? .55 : 1.0;
      const streakCount = quality > 1 ? this.slipstreaks.length : 7;
      const laneLeft = w.arena.left + 12;
      const laneSpan = Math.max(120, w.arenaWidth - 24);
      const maxBottom = Math.max(452, w.arena.bottom + 24);
      for (let i = 0; i < streakCount; i++) {
        const st = this.slipstreaks[i];
        if (dt > 0) {
          st.y += st.speed * speedScale * dt;
          if (st.y > maxBottom) { st.y = -20 - (i * 17) % 40; st.x = laneLeft + ((i * 53 + Math.round(time * 40)) % laneSpan); }
        }
        const sx = clamp(st.x, laneLeft, laneLeft + laneSpan);
        const alpha = st.alpha * (advancing ? 1.5 : w.state === 'exit' ? 1.8 : w.tideArch.isActive ? 1.35 : .85);
        g.lineStyle(.9, 0xdbf8ff, alpha).lineBetween(sx, st.y, sx, st.y + st.len * speedScale);
      }
    }
  }

  /** Drive family-specific bank frames, helicopters/rotors, articulated mounts, muzzle recoil/flashes, and damage smoke in Fenda Pelágica. */
  updateEnemies(
    w: ArcadeWorld,
    enemySprites: Map<number, Phaser.GameObjects.Sprite>,
    _turrets: Map<number, Phaser.GameObjects.Sprite>,
    dt: number,
    quality: number,
    applyHitFlash?: (sprite: Phaser.GameObjects.Sprite, flash: number) => void,
    debugWeaponOrigins = false,
  ): void {
    const time = w.elapsed;
    const g = this.speedGfx;
    const sh = this.shadowGfx;
    const gsh = this.groundShadowGfx;
    sh.clear().setVisible(true);
    gsh.clear().setVisible(true);
    const seen = new Set<number>();

    for (const e of w.enemies) {
      if (e.hp <= 0) continue;
      seen.add(e.id);
      const s = enemySprites.get(e.id); if (!s) continue;
      let tr = this.enemyTracks.get(e.id);
      if (!tr) {
        tr = { x: e.x, y: e.y, vx: e.vx ?? 0, vy: e.vy ?? e.speed, smoothBank: 0, cooldown: e.cooldown, shotFlash: 0, recoil: 0, flashPrev: e.flash, smokeTimer: 0 };
        this.enemyTracks.set(e.id, tr);
      }
      if (dt > 0) {
        const invDt = 1 / Math.max(dt, 1 / 240);
        const vx = e.vx !== undefined ? e.vx : (e.x - tr.x) * invDt;
        const vy = e.vy !== undefined ? e.vy : (e.y - tr.y) * invDt;
        const isHeliUnit = isHelicopterFamily(e.family);
        if (Math.hypot(e.x - tr.x, e.y - tr.y) < 95) {
          if (isHeliUnit) {
            const velLerp = Math.min(1, dt * 8.5);
            tr.vx += (vx - tr.vx) * velLerp;
            tr.vy += (vy - tr.vy) * velLerp;
          } else {
            tr.vx = vx; tr.vy = vy;
          }
          const bankDivisor = e.family === 'bomber' ? 55 : isHeliUnit ? (e.family === 'heli_warhawk' ? 105 : 96) : 82;
          const targetBank = clamp(tr.vx / bankDivisor, -1, 1);
          const bankRate = e.family === 'bomber' ? 5.5 : e.family === 'acrobat' ? 13 : isHeliUnit ? 6.5 : 9.5;
          tr.smoothBank += (targetBank - tr.smoothBank) * Math.min(1, dt * bankRate);
        }
        if (e.cooldown > tr.cooldown + .22) { tr.shotFlash = .13; tr.recoil = 1; }
        tr.cooldown = e.cooldown;
        if (e.flash > tr.flashPrev + .02) this.spawnHitSpark(e.x, e.y, e.size * .55);
        tr.flashPrev = e.flash;
        tr.shotFlash = Math.max(0, tr.shotFlash - dt);
        tr.recoil = Math.max(0, tr.recoil - dt * 9);
      }
      tr.x = e.x; tr.y = e.y;

      const isAir = !e.ground;
      const isHeli = isHelicopterFamily(e.family);
      const hull = resolveHullVisualTransform(isHeli ? { ...e, vx: tr.vx, vy: tr.vy } : e, time);

      if (isHeli && this.scene.textures.exists(PELAGIC_HELI_SHEET)) {
        let bankEff = tr.smoothBank;
        if (e.family === 'heli_scout' || e.family === 'heli_phantom') bankEff = clamp(bankEff * 1.12, -1, 1);
        const localBank = -bankEff;
        const warhawkMissilePhase = e.family === 'heli_warhawk' && ((e.attackStep ?? 0) % 3 === 2) && (e.warning > .2 || tr.shotFlash > 0);
        const attackPose = warhawkMissilePhase || tr.shotFlash > .04;
        const hitSquash = e.flash > 0 ? .06 * (e.flash / .095) : 0;
        const frame = heliSheetFrame(e.family, localBank, attackPose);
        s.setTexture(PELAGIC_HELI_SHEET, frame)
          .setPosition(hull.drawX, hull.drawY)
          .setDisplaySize(e.size * (1 + hitSquash), e.size * (1 - hitSquash))
          .setRotation(hull.rotation)
          .setDepth(hull.depth);

        // Altitude-driven 2.5D shadow offset beneath helicopter
        const alt = e.altitude ?? .9;
        const shOffX = 9 + alt * 11, shOffY = 11 + alt * 13;
        const shScale = clamp(1.06 - alt * .22, .66, 1);
        sh.fillStyle(0x06162c, .27).fillEllipse(hull.drawX + shOffX, hull.drawY + shOffY, e.size * .88 * shScale, e.size * .58 * shScale);

        // Animated spinning main + tail rotors anchored cleanly on painted swashplate hub
        if (this.scene.textures.exists(PELAGIC_ROTOR_SHEET)) {
          const damaged = e.hp < e.maxHp * .45;
          const spinRate = damaged ? .62 : 1;
          const wobble = damaged ? Math.sin(time * 28 + e.id) * .045 : 0;
          const specs: Array<{ lx: number; ly: number; size: number; tail: boolean; rotOffset: number }> = e.family === 'heli_utility'
            ? [
              { lx: 0, ly: .05, size: e.size * 1.06, tail: false, rotOffset: 0 },
              { lx: .02, ly: .42, size: e.size * .30, tail: true, rotOffset: Math.PI / 2 },
            ]
            : e.family === 'heli_phantom'
              ? [{ lx: 0, ly: .09, size: e.size * 1.02, tail: false, rotOffset: 0 }]
              : [
                { lx: 0, ly: .04, size: e.size * (e.family === 'heli_warhawk' ? 1.12 : 1.04), tail: false, rotOffset: 0 },
                { lx: .03, ly: .40, size: e.size * .32, tail: true, rotOffset: Math.PI / 2 },
              ];
          const arr = this.syncSpritePool(this.rotorSprites, e.id, specs.length, PELAGIC_ROTOR_SHEET, 9.1);
          specs.forEach((sp, idx) => {
            const wp = localToWorldPoint(hull, sp.lx + wobble, sp.ly);
            const rf = rotorSheetFrame(e.family, time * spinRate, e.id + idx, sp.tail);
            const smoothSpin = sp.tail ? hull.rotation + sp.rotOffset : (time * (e.family === 'heli_scout' ? 18 : 14) * spinRate + e.id + sp.rotOffset);
            arr[idx].setTexture(PELAGIC_ROTOR_SHEET, rf).setPosition(wp.x, wp.y).setDisplaySize(sp.size, sp.size).setRotation(smoothSpin).setAlpha(sp.tail ? .88 : .94).setDepth(9.1).setVisible(true);
          });
        }
      } else if (isAir && e.family !== 'alien' && this.scene.textures.exists(PELAGIC_ENEMY_AIR_SHEET)) {
        let bankEff = tr.smoothBank;
        if (e.family === 'acrobat' && (e.motion === 'turn' || e.motion === 'zigzag')) {
          bankEff = clamp(bankEff + Math.sin(e.age * 5.4 + e.id) * .65, -1, 1);
        }
        const localBank = -bankEff;
        const frame = enemyAirFrame(e.family, localBank, time, e.id);
        const leanRot = hull.rotation - bankEff * (e.family === 'bomber' ? .08 : e.family === 'acrobat' ? .22 : .16);
        const surgeScale = (e.motion === 'dive' || e.motion === 'accelerate') ? 1 + Math.min(.09, e.age * .03) : 1;
        const hitSquash = e.flash > 0 ? .06 * (e.flash / .095) : 0;
        s.setTexture(PELAGIC_ENEMY_AIR_SHEET, frame)
          .setDisplaySize(e.size * (1 + hitSquash), e.size * (surgeScale - hitSquash))
          .setRotation(leanRot);

        if (quality > 0 && (Math.abs(bankEff) > .28 || e.motion === 'dive' || e.motion === 'turn' || e.entry === 'left' || e.entry === 'right')) {
          const tipR = e.size * .42 * (1 - Math.abs(bankEff) * .18);
          const perpX = Math.cos(leanRot) * tipR, perpY = Math.sin(leanRot) * tipR;
          const trailA = clamp(Math.abs(bankEff) * .45 + .14, 0, .38);
          const col = e.eventRole === 'elite-ace' || e.eventRole === 'convoy-air' ? 0xffdf6a : e.eventRole === 'coord-wing' ? 0x7ff5ff : e.family === 'acrobat' ? 0xffb6e0 : e.family === 'interceptor' ? 0xffe58c : 0xcaf8ff;
          for (const sign of [-1, 1]) {
            const sx = e.x + sign * perpX, sy = e.y + sign * perpY;
            g.lineStyle(e.eventRole === 'elite-ace' ? 1.6 : 1.1, col, trailA).lineBetween(sx, sy, sx - tr.vx * .06, sy - tr.vy * .06);
          }
        }
        if (e.eventRole === 'elite-ace') {
          if (e.flash <= 0) s.setTint(0xfff0a8);
        } else if (e.eventRole === 'coord-wing') {
          if (e.flash <= 0) s.setTint(0xdaf9ff);
        }
      } else if (e.family === 'alien' && this.scene.textures.exists(PELAGIC_UFO_SHEET)) {
        const rare = e.eventRole === 'rare-probe';
        const wobble = Math.sin(time * (rare ? 6.2 : 4.8) + e.id * 1.3) * (rare ? .15 : .09) + tr.smoothBank * .18;
        const hitPop = e.flash > 0 ? 1 + .08 * (e.flash / .095) : 1;
        const rareScale = rare ? 1.45 : 1;
        s.setTexture(PELAGIC_UFO_SHEET, ufoAnimFrame(time * (rare ? 1.85 : 1), e.id))
          .setDisplaySize(e.size * rareScale * hitPop, e.size * rareScale * (2 - hitPop))
          .setRotation(wobble);
        if (rare && e.flash <= 0) {
          s.setTint(0xffea75);
        }
      } else if (e.submarine) {
        s.setRotation(hull.rotation);
      } else if (e.eventRole === 'convoy-lead' || e.eventRole === 'convoy-escort') {
        if (e.eventRole === 'convoy-lead' && e.flash <= 0) s.setTint(0xfff2ba);
      }

      // Rock/island contact shadow beneath anchored coastal turrets & bunkers
      if (e.family === 'tank' || e.family === 'tower') {
        const customAnchor = !!e.navigation?.customAnchor;
        const isCastle = e.family === 'tower' && !customAnchor;
        const shW = e.size * (isCastle ? 1.55 : customAnchor ? 0.98 : 1.24);
        const shH = e.size * (isCastle ? 0.68 : customAnchor ? 0.82 : 0.86);
        const shX = e.x + (customAnchor ? 1.5 : 3);
        const shY = e.y + (isCastle ? 4 : customAnchor ? 2 : 3);
        gsh.fillStyle(0x041224, customAnchor ? .38 : .34).fillEllipse(shX, shY, shW, shH);
      }

      // Articulated cannon & launcher turret rendering synced with PelagicWeaponMounts
      if (hasArticulatedMounts(e.family) && this.scene.textures.exists(PELAGIC_TURRETS_SHEET)) {
        const mounts = resolveActorMounts(e, w.player.x, w.player.y, time);
        const arr = this.syncSpritePool(this.mountSprites, e.id, mounts.length, PELAGIC_TURRETS_SHEET, 5);
        mounts.forEach((m, idx) => {
          const ts = arr[idx];
          ts.setTexture(PELAGIC_TURRETS_SHEET, m.turretFrame)
            .setOrigin(.5, TURRET_PIVOT_ORIGIN_Y)
            .setPosition(m.drawX, m.drawY)
            .setDisplaySize(m.displaySize, m.displaySize)
            .setRotation(m.spriteRotation)
            .setDepth(m.depth)
            .setAlpha(m.alpha * s.alpha)
            .setVisible(m.visible && s.alpha > .05);
          ts.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
          if (e.submarine) {
            const subVis = clamp(e.submarine.exposure / .72, 0, 1);
            if (subVis < 1) {
              const rC = Math.round(58 + 197 * subVis), gC = Math.round(148 + 107 * subVis), bC = Math.round(202 + 53 * subVis);
              ts.setTint((rC << 16) | (gC << 8) | bC);
            }
          } else if (e.hp < e.maxHp * .45 && (e.family === 'tank' || e.family === 'tower')) {
            ts.setTint(0xffbfa8);
          }
          if (applyHitFlash && m.visible) applyHitFlash(ts, e.flash);
          if (debugWeaponOrigins && m.visible) {
            g.lineStyle(1.4, 0x38bdf8, .92)
              .lineBetween(m.pivotX - 4, m.pivotY, m.pivotX + 4, m.pivotY)
              .lineBetween(m.pivotX, m.pivotY - 4, m.pivotX, m.pivotY + 4)
              .lineBetween(m.pivotX, m.pivotY, m.muzzleX, m.muzzleY);
            g.lineStyle(1.6, 0x22ff88, .95).strokeCircle(m.muzzleX, m.muzzleY, 3.6);
            g.lineStyle(1.2, 0xffef5a, .78).lineBetween(m.muzzleX, m.muzzleY, m.muzzleX + Math.cos(m.aimAngle) * 46, m.muzzleY + Math.sin(m.aimAngle) * 46);
          }
        });

        // Exact muzzle-tip directional glow & active firing flashes (zero encircling target rings)
        if (e.warning > 0 || tr.shotFlash > 0) {
          const warhawkMissileAim = e.family === 'heli_warhawk' && ((e.attackStep ?? 0) % 3 === 2);
          mounts.forEach((m, idx) => {
            if (!m.visible) return;
            if (e.family === 'heli_warhawk') {
              const activeIdx = warhawkMissileAim ? 1 : 0;
              if (idx !== activeIdx) return;
            } else if ((e.family === 'ship' || e.family === 'submarine') && e.eventRole !== 'coord-sub') {
              const expectedIdx = (e.attackStep ?? 0) % mounts.length;
              if (idx !== expectedIdx) return;
            }
            if (e.warning > .22) {
              const lineLen = warhawkMissileAim ? 58 : 24;
              g.lineStyle(warhawkMissileAim ? 1.8 : 1.2, warhawkMissileAim ? 0xff5b3d : 0xff9a66, (e.warning - .22) * .72)
                .lineBetween(m.muzzleX, m.muzzleY, m.muzzleX + Math.cos(m.aimAngle) * lineLen, m.muzzleY + Math.sin(m.aimAngle) * lineLen);
            }
            if (tr.shotFlash > 0) g.fillStyle(0xfff1a6, tr.shotFlash / .13 * .92).fillCircle(m.muzzleX, m.muzzleY, warhawkMissileAim ? 6.5 : 4.5);
          });
        }
      } else if (e.warning > 0 || tr.shotFlash > 0) {
        const heavy = e.family === 'bomber' || e.family === 'heli_utility' || e.family === 'heli_phantom';
        const nose = localToWorldPoint(hull, 0, e.family === 'alien' ? .16 : -.40);
        const aim = Math.atan2(w.player.y - nose.y, w.player.x - nose.x);
        if (e.warning > .35 && (heavy || e.family === 'interceptor' || e.family === 'heli_scout')) {
          g.lineStyle(1.1, 0xff8e72, (e.warning - .35) * .52).lineBetween(nose.x, nose.y, nose.x + Math.cos(aim) * 20, nose.y + Math.sin(aim) * 20);
        }
        if (tr.shotFlash > 0) g.fillStyle(0xfff4b0, tr.shotFlash / .13 * .85).fillCircle(nose.x, nose.y, 4.2);
      }

      // Progressive structural damage smoke for sturdy enemies below 55% HP
      if (quality > 0 && dt > 0 && e.maxHp >= 6 && e.hp < e.maxHp * .55) {
        tr.smokeTimer += dt;
        const rate = e.hp < e.maxHp * .28 ? .15 : .26;
        if (tr.smokeTimer >= rate && this.particles.length < 64) {
          tr.smokeTimer = 0;
          const sp = this.borrowSprite(PELAGIC_VFX_SHEET, 12, 18.9);
          const sz = clamp(e.size * .42, 10, 20);
          this.particles.push({
            sprite: sp, x: e.x + (Math.random() - .5) * e.size * .28, y: e.y - e.size * .1,
            vx: (Math.random() - .5) * 14, vy: -22, age: 0, duration: .45,
            size0: sz * .65, size1: sz * 1.35, rotSpeed: 1.8, frameStart: 12, frameCount: 4, alpha: .62,
          });
        }
      }
    }

    for (const id of this.enemyTracks.keys()) if (!seen.has(id)) this.enemyTracks.delete(id);
    for (const [id, arr] of this.mountSprites) if (!seen.has(id)) { for (const sp of arr) { sp.setVisible(false); this.pool.push(sp); } this.mountSprites.delete(id); }
    for (const [id, arr] of this.rotorSprites) if (!seen.has(id)) { for (const sp of arr) { sp.setVisible(false); this.pool.push(sp); } this.rotorSprites.delete(id); }

    // Controlled short smoke trail for enemy straight missiles
    if (quality > 0 && dt > 0) {
      this.missileTrailClock += dt;
      if (this.missileTrailClock >= .045) {
        this.missileTrailClock = 0;
        for (const b of w.bullets) {
          if (!b.active || !b.enemy || !b.enemyMissile || this.particles.length >= 64) continue;
          const spMag = Math.max(1, Math.hypot(b.vx, b.vy));
          const sp = this.borrowSprite(PELAGIC_VFX_SHEET, 12, 14.8);
          this.particles.push({
            sprite: sp, x: b.x - (b.vx / spMag) * 11, y: b.y - (b.vy / spMag) * 11,
            vx: (Math.random() - .5) * 8, vy: -12, age: 0, duration: .24,
            size0: 7, size1: 15, rotSpeed: 2.5, frameStart: 12, frameCount: 4, alpha: .54,
          });
        }
      }
    }

    // Update active spark/smoke particles & naval water-plume shock rings
    if (dt > 0) {
      this.particles = this.particles.filter(p => {
        p.age += dt;
        if (p.age >= p.duration) { p.sprite.setVisible(false); this.pool.push(p.sprite); return false; }
        const k = p.age / p.duration;
        const sz = p.size0 + (p.size1 - p.size0) * k;
        const f = p.frameStart + Math.min(p.frameCount - 1, Math.floor(k * p.frameCount));
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.sprite.setTexture(PELAGIC_VFX_SHEET, f).setPosition(p.x, p.y).setDisplaySize(sz, sz)
          .setRotation(p.sprite.rotation + p.rotSpeed * dt).setAlpha(p.alpha * (1 - k * .85)).setVisible(true);
        return true;
      });
      this.splashRings = this.splashRings.filter(r => {
        r.age += dt;
        if (r.age >= r.duration) return false;
        const k = r.age / r.duration;
        const rad = 6 + k * r.maxRadius;
        g.lineStyle(2 * (1 - k * .5), 0xdcfbff, (1 - k) * .75).strokeEllipse(r.x, r.y, rad * 2, rad * 1.1);
        return true;
      });
    } else {
      for (const p of this.particles) p.sprite.setVisible(true);
      for (const r of this.splashRings) {
        const k = r.age / r.duration, rad = 6 + k * r.maxRadius;
        g.lineStyle(2 * (1 - k * .5), 0xdcfbff, (1 - k) * .75).strokeEllipse(r.x, r.y, rad * 2, rad * 1.1);
      }
    }
  }

  private syncSpritePool(map: Map<number, Phaser.GameObjects.Sprite[]>, id: number, count: number, texture: string, depth: number): Phaser.GameObjects.Sprite[] {
    let arr = map.get(id);
    if (!arr) { arr = []; map.set(id, arr); }
    while (arr.length < count) arr.push(this.borrowSprite(texture, 0, depth));
    while (arr.length > count) { const sp = arr.pop()!; sp.setVisible(false); this.pool.push(sp); }
    return arr;
  }

  private borrowSprite(texture: string, frame: number, depth: number): Phaser.GameObjects.Sprite {
    return (this.pool.pop() ?? this.scene.add.sprite(0, 0, texture, frame))
      .setTexture(texture, frame).setDepth(depth).setBlendMode(Phaser.BlendModes.NORMAL)
      .setOrigin(.5, .5).setRotation(0).setAlpha(1).clearTint().setVisible(true);
  }
}
