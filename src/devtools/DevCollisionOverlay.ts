import Phaser from 'phaser';
import type { ArcadeScene } from '../game/arcade/ArcadeScene';
import {
  hasArticulatedMounts,
  resolveActorMounts,
  resolveUnmountedMuzzle,
} from '../game/arcade/PelagicWeaponMounts';
import {
  SUB_BEAM_HALF_W,
  SUB_SECTION_HEIGHT,
  subSectionCenterY,
} from '../game/arcade/PelagicSubmarineBoss';
import {
  TIDE_ARCH_BRIDGE_ENTRY_HALF_H,
  TIDE_ARCH_BRIDGE_EXIT_HALF_H,
  computeArchOpening,
} from '../game/arcade/PelagicTideArch';
import type { DevCollisionFlags } from './types';

export function defaultCollisionFlags(): DevCollisionFlags {
  return {
    enabled: false,
    player: true,
    enemies: true,
    bullets: true,
    bulletVectors: true,
    bosses: true,
    mounts: true,
    armorAndHull: true,
    obstaclesAndCargo: true,
    specialRadius: true,
    sensorsAndTriggers: true,
    spawnZones: false,
  };
}

/**
 * Non-intrusive technical vector visualizer reading real collision bounds, sockets,
 * projectile sweep paths, and boss hulls straight from the active simulation.
 */
export class DevCollisionOverlay {
  private gfx?: Phaser.GameObjects.Graphics;
  private flags: DevCollisionFlags = defaultCollisionFlags();

  getFlags(): Readonly<DevCollisionFlags> {
    return this.flags;
  }

  setFlags(patch: Partial<DevCollisionFlags>): void {
    this.flags = { ...this.flags, ...patch };
    if (!this.flags.enabled) this.clear();
  }

  clear(): void {
    this.gfx?.clear().setVisible(false);
  }

  destroy(): void {
    this.gfx?.destroy();
    this.gfx = undefined;
  }

  draw(scene: ArcadeScene): void {
    if (!this.flags.enabled || !scene.world || scene.screen === 'title' || scene.screen === 'intro') {
      this.clear();
      return;
    }
    if (!this.gfx || this.gfx.scene !== scene) {
      this.gfx?.destroy();
      this.gfx = scene.add.graphics().setDepth(75);
    }
    const g = this.gfx;
    const w = scene.world;
    g.clear().setVisible(true);

    // Arena safe combat boundary outline
    g.lineStyle(1, 0x38bdf8, 0.35).strokeRect(
      w.arena.left,
      w.arena.top,
      w.arena.right - w.arena.left,
      w.arena.bottom - w.arena.top,
    );

    // 1. Player real hitbox (sweepEllipse rx=5, ry=7) & pickup radius (22)
    if (this.flags.player && w.state !== 'defeat') {
      g.lineStyle(1.5, 0x00f5ff, 0.95).strokeEllipse(w.player.x, w.player.y, 10, 14);
      g.fillStyle(0x00f5ff, 0.2).fillEllipse(w.player.x, w.player.y, 10, 14);
      g.lineStyle(1, 0x38bdf8, 0.35).strokeCircle(w.player.x, w.player.y, 22);
    }

    // 2. Enemy hitboxes + silhouette contact boxes + non-ground crash zone + gun mounts & muzzles
    const stats = this.flags.enemies ? scene.devInspectSprites() : null;
    for (const e of w.enemies) {
      if (e.hp <= 0) continue;
      if (this.flags.enemies) {
        const subLocked = Boolean(e.submarine && e.submarine.exposure < 0.6);
        const col = subLocked ? 0x64748b : 0x4ade80;
        g.lineStyle(1.3, col, 0.9).strokeEllipse(e.x, e.y, e.size * 0.64, e.size * 0.74);
        if (!e.ground) {
          g.lineStyle(1, 0xfbbf24, 0.65).strokeCircle(e.x, e.y, e.size * 0.28 + 7);
        }
        const spBound = stats?.enemyBounds.find((b) => b.id === e.id);
        if (spBound) {
          g.lineStyle(0.8, 0x94a3b8, 0.45).strokeRect(
            spBound.x - spBound.width / 2,
            spBound.y - spBound.height / 2,
            spBound.width,
            spBound.height,
          );
        }
      }

      if (this.flags.mounts && w.up) {
        if (hasArticulatedMounts(e.family)) {
          const mounts = resolveActorMounts(e, w.player.x, w.player.y, w.elapsed);
          for (const m of mounts) {
            if (!m.visible) continue;
            g.lineStyle(1.2, 0xf472b6, 0.9).strokeCircle(m.pivotX, m.pivotY, 4);
            g.lineStyle(1.4, 0xfacc15, 0.95).lineBetween(m.pivotX, m.pivotY, m.muzzleX, m.muzzleY);
            g.fillStyle(0xfacc15, 1).fillCircle(m.muzzleX, m.muzzleY, 2.5);
          }
        } else {
          const u = resolveUnmountedMuzzle(e, w.player.x, w.player.y, w.elapsed);
          g.fillStyle(0xe879f9, 0.95).fillCircle(u.muzzleX, u.muzzleY, 2.2);
          g.lineStyle(1, 0xf472b6, 0.55).lineBetween(u.mountX, u.mountY, u.muzzleX, u.muzzleY);
        }
      }
    }

    // 3. Bullets hitboxes, sweep segment, and velocity vectors
    if (this.flags.bullets || this.flags.bulletVectors) {
      for (const b of w.bullets) {
        if (!b.active) continue;
        const col = b.enemyMissile ? 0xff453a : b.enemy ? 0xf87171 : 0x34d399;
        if (this.flags.bullets) {
          g.lineStyle(1.2, col, 0.95).strokeCircle(b.x, b.y, b.radius);
          g.lineStyle(1, col, 0.65).lineBetween(b.px, b.py, b.x, b.y);
        }
        if (this.flags.bulletVectors) {
          const mag = Math.max(1, Math.hypot(b.vx, b.vy));
          const len = Math.min(20, Math.max(8, mag * 0.06));
          g.lineStyle(1, b.enemy ? 0xfde047 : 0x67e8f9, 0.8).lineBetween(
            b.x,
            b.y,
            b.x + (b.vx / mag) * len,
            b.y + (b.vy / mag) * len,
          );
        }
      }
    }

    // 4. Boss & Armor & Submarine section real collision shapes
    if ((this.flags.bosses || this.flags.armorAndHull || this.flags.mounts) && w.boss) {
      const b = w.boss;
      if (b.sub) {
        const sub = b.sub;
        const sec = sub.sections[sub.activeSection];
        const cy = subSectionCenterY(sub, sub.activeSection);
        if (this.flags.armorAndHull && sec.hullHp > 0) {
          const halfH = SUB_SECTION_HEIGHT * 0.5;
          if (sub.activeSection === 0 || sub.activeSection === 4) {
            const rx = sub.activeSection === 0 ? SUB_BEAM_HALF_W * 0.88 : SUB_BEAM_HALF_W * 0.86;
            const ry = sub.activeSection === 0 ? halfH * 0.92 : halfH * 0.9;
            g.lineStyle(1.5, 0x38bdf8, 0.9).strokeEllipse(b.x, cy, rx * 2, ry * 2);
          } else {
            g.lineStyle(1.5, 0x38bdf8, 0.9).strokeRect(
              b.x - SUB_BEAM_HALF_W,
              cy - halfH,
              SUB_BEAM_HALF_W * 2,
              SUB_SECTION_HEIGHT,
            );
          }
        }
        for (const p of sec.parts) {
          const alive = p.hp > 0;
          const color = p.kind === 'armor' || p.kind === 'bridge' ? 0xfbbf24 : 0xf43f5e;
          if (this.flags.bosses) {
            g.lineStyle(alive ? 1.6 : 0.8, alive ? color : 0x64748b, alive ? 0.95 : 0.35).strokeCircle(p.x, p.y, p.radius);
          }
          if (this.flags.mounts && alive) {
            const mx = p.x + Math.cos(p.angle) * (p.radius * 0.95);
            const my = p.y + Math.sin(p.angle) * (p.radius * 0.95);
            g.lineStyle(1.4, 0xfacc15, 0.95).lineBetween(p.x, p.y, mx, my);
            g.fillStyle(0xfacc15, 1).fillCircle(mx, my, 2.5);
          }
        }
      } else {
        if (this.flags.armorAndHull) {
          g.lineStyle(1.4, 0x38bdf8, 0.85).strokeEllipse(
            b.x,
            b.y,
            b.size * 0.86,
            b.size * (w.up ? 0.74 : 0.58),
          );
          const sectorW = b.size * 0.065;
          g.lineStyle(1, 0x38bdf8, 0.45)
            .lineBetween(b.x - sectorW, b.y - b.size * 0.35, b.x - sectorW, b.y + b.size * 0.35)
            .lineBetween(b.x + sectorW, b.y - b.size * 0.35, b.x + sectorW, b.y + b.size * 0.35);
        }
        for (const p of b.parts) {
          if (this.flags.bosses) {
            g.lineStyle(p.hp > 0 ? 1.5 : 0.7, p.hp > 0 ? 0xf43f5e : 0x64748b, p.hp > 0 ? 0.95 : 0.35).strokeCircle(p.x, p.y, p.radius);
          }
          if (this.flags.mounts && p.hp > 0) {
            const mx = p.x + Math.cos(p.angle) * p.radius * 1.1;
            const my = p.y + Math.sin(p.angle) * p.radius * 1.1;
            g.lineStyle(1.4, 0xfacc15, 0.95).lineBetween(p.x, p.y, mx, my);
            g.fillStyle(0xfacc15, 1).fillCircle(mx, my, 2.5);
          }
        }
      }
    }

    // 5. Obstacles & Supplies (cargo)
    if (this.flags.obstaclesAndCargo) {
      for (const o of w.obstacles) {
        if (o.hp <= 0) continue;
        g.lineStyle(1.5, 0xf97316, 0.9).strokeRect(o.x - o.width / 2, o.y - o.height / 2, o.width, o.height);
      }
      for (const c of w.cargo) {
        g.lineStyle(1.3, c.crate ? 0xfacc15 : 0x2dd4bf, 0.9).strokeCircle(c.x, c.y, c.crate ? 12 : 11);
      }
    }

    // 6. Special / Bomb active AoE
    if (this.flags.specialRadius && w.bomb) {
      g.lineStyle(1.6, 0xfde047, 0.95).strokeCircle(
        w.bomb.x,
        w.bomb.y,
        w.bomb.phase === 'blast' ? Math.max(8, w.bomb.radius) : 14,
      );
    }

    // 7. Real Sensors, Tide Arch Passage Trigger & Checkpoint Zone (read-only over live sim bounds)
    if (this.flags.sensorsAndTriggers && w.up && w.tideArch.isActive) {
      const archY = w.tideArch.archScreenY(w.scroll);
      const bandTop = Math.max(w.arena.top, archY - TIDE_ARCH_BRIDGE_ENTRY_HALF_H);
      const bandBot = Math.min(w.arena.bottom, archY + TIDE_ARCH_BRIDGE_EXIT_HALF_H);
      const opening = computeArchOpening(w.arena.left, w.arena.right);
      if (bandBot > bandTop) {
        const bandH = bandBot - bandTop;
        const hazardActive = w.tideArch.isPillarCollisionActive(w.scroll, w.player.y);
        // Safe center opening corridor
        g.fillStyle(hazardActive ? 0x22d3ee : 0x38bdf8, 0.14).fillRect(opening.left, bandTop, opening.width, bandH);
        g.lineStyle(1.6, 0x22d3ee, 0.92).strokeRect(opening.left, bandTop, opening.width, bandH);
        // Flanking pier collision hazard walls
        g.fillStyle(hazardActive ? 0xef4444 : 0xf97316, hazardActive ? 0.24 : 0.1).fillRect(
          w.arena.left,
          bandTop,
          Math.max(0, opening.left - w.arena.left),
          bandH,
        );
        g.fillRect(opening.right, bandTop, Math.max(0, w.arena.right - opening.right), bandH);
        g.lineStyle(1.4, hazardActive ? 0xf87171 : 0xfb923c, 0.9).strokeRect(
          w.arena.left,
          bandTop,
          Math.max(0, opening.left - w.arena.left),
          bandH,
        );
        g.strokeRect(opening.right, bandTop, Math.max(0, w.arena.right - opening.right), bandH);
      }
    }

    // 8. Spawn Zones / Entry Lanes
    if (this.flags.spawnZones) {
      const wSpan = w.arena.right - w.arena.left;
      g.lineStyle(1, 0xa78bfa, 0.7).strokeRect(w.arena.left + 8, w.arena.top - 6, wSpan - 16, 22);
      if (w.up) {
        g.lineStyle(1, 0xc084fc, 0.55)
          .strokeRect(w.arena.left - 14, w.arena.top + 38, 16, 130)
          .strokeRect(w.arena.right - 2, w.arena.top + 38, 16, 130);
      }
    }
  }
}
