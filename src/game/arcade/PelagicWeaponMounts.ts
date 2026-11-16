import type { Family } from './content';

export const PELAGIC_TURRETS_SHEET = 'pelagic-turrets';
export const PELAGIC_SUB_CLEAN_SHEET = 'pelagic-sub-clean';
export const PELAGIC_TOWER_CLEAN_SHEET = 'pelagic-tower-clean';
export const PELAGIC_HELI_SHEET = 'pelagic-helicopters';
export const PELAGIC_ROTOR_SHEET = 'pelagic-rotors';
export const PELAGIC_ENEMY_MISSILE_SHEET = 'pelagic-enemy-missile';

/** Normalized pivot (0.5, 61/160) -> (0.5, 0.38125), painted muzzle tip at y=144/160=0.90 */
export const TURRET_PIVOT_ORIGIN_Y = 0.38125;
export const TURRET_MUZZLE_FRACTION = 0.51875;

export interface MountSpec {
  id: number;
  turretFrame: number;
  localX: number;
  localY: number;
  turretScale: number;
  muzzleFraction: number;
  recoilMaxPx: number;
  canRotate: boolean;
  depthOffset: number;
}

export interface MountActorInput {
  id: number;
  x: number;
  y: number;
  size: number;
  hp: number;
  family: Family;
  vx?: number;
  vy?: number;
  heading?: number;
  anchor?: number;
  navigation?: { anchor?: number; heading?: number };
  submarine?: { side: number; phase: string; exposure: number };
  archPattern?: string;
  mountAngles?: number[];
  mountRecoil?: number[];
}

export interface ResolvedMountPose {
  id: number;
  turretFrame: number;
  pivotX: number;
  pivotY: number;
  drawX: number;
  drawY: number;
  aimAngle: number;
  spriteRotation: number;
  displaySize: number;
  muzzleX: number;
  muzzleY: number;
  recoilPx: number;
  canRotate: boolean;
  visible: boolean;
  alpha: number;
  depth: number;
}

export interface HullVisualTransform {
  drawX: number;
  drawY: number;
  displayW: number;
  displayH: number;
  rotation: number;
  flipX: boolean;
  depth: number;
  alpha: number;
}

const MOUNT_SPECS: Partial<Record<Family, MountSpec[]>> = {
  boat: [
    { id: 0, turretFrame: 0, localX: -0.005, localY: 0.086, turretScale: 0.36, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 3.0, canRotate: true, depthOffset: 5 },
  ],
  ship: [
    { id: 0, turretFrame: 1, localX: -0.006, localY: 0.053, turretScale: 0.36, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 3.4, canRotate: true, depthOffset: 5.2 },
    { id: 1, turretFrame: 1, localX: -0.006, localY: -0.17, turretScale: 0.29, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 2.8, canRotate: true, depthOffset: 5.1 },
  ],
  submarine: [
    { id: 0, turretFrame: 2, localX: -0.218, localY: -0.064, turretScale: 0.31, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 3.0, canRotate: true, depthOffset: 5 },
    { id: 1, turretFrame: 2, localX: 0.222, localY: -0.062, turretScale: 0.31, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 3.0, canRotate: true, depthOffset: 5 },
  ],
  tank: [
    { id: 0, turretFrame: 3, localX: -0.01, localY: -0.06, turretScale: 0.62, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 3.8, canRotate: true, depthOffset: 5 },
  ],
  tower: [
    { id: 0, turretFrame: 4, localX: 0.006, localY: -0.426, turretScale: 0.66, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 4.2, canRotate: true, depthOffset: 5 },
  ],
  heli_warhawk: [
    { id: 0, turretFrame: 5, localX: 0, localY: -0.32, turretScale: 0.34, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 2.4, canRotate: true, depthOffset: 8.6 },
    { id: 1, turretFrame: 6, localX: -0.30, localY: -0.03, turretScale: 0.32, muzzleFraction: TURRET_MUZZLE_FRACTION, recoilMaxPx: 3.6, canRotate: false, depthOffset: 8.55 },
  ],
};

/** Resolves coastal cannon visual variant across Models A (3=Light), B (7=Twin), C (4=Heavy Tower), D (8=Precision). */
export function resolveTurretFrame(e: MountActorInput, spec: MountSpec): number {
  if (e.family === 'tank') {
    const mod = Math.abs(e.id) % 3;
    return mod === 0 ? 3 : mod === 1 ? 7 : 8;
  }
  if (e.family === 'tower') {
    if (e.navigation && 'customAnchor' in e.navigation && (e.navigation as { customAnchor?: boolean }).customAnchor) {
      if (e.archPattern === 'aimed-burst' || e.archPattern === 'sweep') return 8; // Model D Precision Sniper
      if (e.archPattern === 'fan3') return 7; // Model B Twin Battery
      return Math.abs(e.id) % 2 === 0 ? 3 : 4; // Alternate Model A Light / Model C Heavy
    }
    return 4; // Model C Fortress Heavy Tower
  }
  return spec.turretFrame;
}

export function hasArticulatedMounts(family: Family): boolean {
  return (MOUNT_SPECS[family]?.length ?? 0) > 0;
}

export function getMountSpecs(family: Family): readonly MountSpec[] {
  return MOUNT_SPECS[family] ?? [];
}

export function normalizeAngle(a: number): number {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function slewAngle(current: number, target: number, maxDelta: number): number {
  const diff = normalizeAngle(target - current);
  if (Math.abs(diff) <= maxDelta) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(diff) * maxDelta);
}

/**
 * Computes exact hull visual transform used by both ArcadeScene/PelagicActorAnims rendering
 * AND ArcadeWorld weapon mount / bullet origin resolution.
 */
export function resolveHullVisualTransform(e: MountActorInput, time: number): HullVisualTransform {
  if (e.submarine) {
    const trim = e.submarine.phase === 'emerge'
      ? -0.04 * (1 - e.submarine.exposure)
      : e.submarine.phase === 'submerge'
        ? 0.045 * (1 - e.submarine.exposure)
        : Math.sin(time * 2.2 + e.id) * 0.015;
    const flipX = e.submarine.side > 0;
    return {
      drawX: e.x,
      drawY: e.y,
      displayW: e.size * 1.06,
      displayH: e.size * 1.06,
      rotation: trim * (flipX ? -1 : 1),
      flipX,
      depth: 2,
      alpha: e.submarine.exposure,
    };
  }
  const anchor = e.anchor ?? e.navigation?.anchor;
  const customAnchor = !!(e.navigation && (e.navigation as { customAnchor?: boolean }).customAnchor);
  if (anchor !== undefined || customAnchor || e.family === 'tower' || e.family === 'tank') {
    const scale = e.family === 'tower' && !customAnchor ? 1.8 : customAnchor ? 1.38 : 1.3;
    return {
      drawX: e.x,
      drawY: e.y,
      displayW: e.size * scale,
      displayH: e.size * scale,
      rotation: 0,
      flipX: false,
      depth: 2,
      alpha: 1,
    };
  }
  if (e.family === 'boat' || e.family === 'ship') {
    const phase = time * 3.0 + e.id * 1.9;
    const bob = Math.sin(phase) * 1.8;
    const roll = Math.sin(time * 2.5 + e.id * 1.3) * 0.065;
    const crest = Math.sin(phase);
    const heading = e.heading ?? e.navigation?.heading ?? Math.PI;
    return {
      drawX: e.x,
      drawY: e.y + bob,
      displayW: e.size * (1 + crest * 0.03),
      displayH: e.size * (1 - crest * 0.02),
      rotation: heading + roll,
      flipX: false,
      depth: 2,
      alpha: 1,
    };
  }
  if (e.family.startsWith('heli_')) {
    const vx = e.vx ?? 0;
    const yaw = Math.max(-0.26, Math.min(0.26, vx * 0.0014));
    return {
      drawX: e.x,
      drawY: e.y,
      displayW: e.size,
      displayH: e.size,
      rotation: Math.PI + yaw,
      flipX: false,
      depth: 8.2,
      alpha: 1,
    };
  }
  // Standard aircraft facing velocity vector in flight
  const vx = e.vx ?? 0;
  const vy = e.vy ?? 90;
  const speed = Math.hypot(vx, vy);
  const flightRot = speed > 14 ? Math.atan2(vy, vx) + Math.PI / 2 : Math.PI;
  return {
    drawX: e.x,
    drawY: e.y,
    displayW: e.size,
    displayH: e.size,
    rotation: e.family === 'alien' ? 0 : flightRot,
    flipX: false,
    depth: 8,
    alpha: 1,
  };
}

/** Transforms a local hull fraction offset into world coordinates respecting flipX and rotation. */
export function localToWorldPoint(
  hull: HullVisualTransform,
  localX: number,
  localY: number,
): { x: number; y: number } {
  const sx = (hull.flipX ? -localX : localX) * hull.displayW;
  const sy = localY * hull.displayH;
  const c = Math.cos(hull.rotation);
  const s = Math.sin(hull.rotation);
  return {
    x: hull.drawX + sx * c - sy * s,
    y: hull.drawY + sx * s + sy * c,
  };
}

/**
 * Resolves exact world-space turret pivots, rotation, recoil slide, and exact barrel muzzle tips
 * for every cannon/launcher mount on an actor. Zero mismatch between visuals and bullets.
 */
export function resolveActorMounts(
  e: MountActorInput,
  playerX: number,
  playerY: number,
  time: number,
): ResolvedMountPose[] {
  const specs = MOUNT_SPECS[e.family];
  if (!specs || specs.length === 0) return [];
  const hull = resolveHullVisualTransform(e, time);
  const dead = e.hp <= 0;
  const subHidden = e.submarine ? e.submarine.phase !== 'hold' || e.submarine.exposure < 0.72 : false;
  const subAlpha = e.submarine ? Math.max(0, Math.min(1, (e.submarine.exposure - 0.35) / 0.55)) : 1;

  const isCliffBunker = e.family === 'tower' && !!(e.navigation && (e.navigation as { customAnchor?: boolean }).customAnchor);
  return specs.map((spec, i) => {
    const lx = isCliffBunker ? -0.01 : spec.localX;
    const ly = isCliffBunker ? -0.06 : spec.localY;
    const tScale = isCliffBunker ? 0.64 : spec.turretScale;
    const pivot = localToWorldPoint(hull, lx, ly);
    const defaultAim = spec.canRotate
      ? Math.atan2(playerY - pivot.y, playerX - pivot.x)
      : hull.rotation - Math.PI / 2;
    const storedAim = e.mountAngles?.[i];
    const aimAngle = spec.canRotate && typeof storedAim === 'number' && Number.isFinite(storedAim)
      ? storedAim
      : defaultAim;
    const recoilFrac = Math.max(0, Math.min(1, e.mountRecoil?.[i] ?? 0));
    const recoilPx = recoilFrac * spec.recoilMaxPx;
    const ux = Math.cos(aimAngle);
    const uy = Math.sin(aimAngle);
    const displaySize = e.size * tScale;
    const drawX = pivot.x - ux * recoilPx;
    const drawY = pivot.y - uy * recoilPx;
    const muzzleDist = Math.max(4, displaySize * spec.muzzleFraction - recoilPx * 0.4);
    const visible = !dead && (!e.submarine || (!subHidden && e.submarine.exposure > 0.36));

    return {
      id: spec.id,
      turretFrame: resolveTurretFrame(e, spec),
      pivotX: pivot.x,
      pivotY: pivot.y,
      drawX,
      drawY,
      aimAngle,
      spriteRotation: aimAngle - Math.PI / 2,
      displaySize,
      muzzleX: pivot.x + ux * muzzleDist,
      muzzleY: pivot.y + uy * muzzleDist,
      recoilPx,
      canRotate: spec.canRotate,
      visible,
      alpha: visible ? (e.submarine ? subAlpha : 1) : 0,
      depth: spec.depthOffset,
    };
  });
}

/**
 * Fallback non-turret aircraft / UFO muzzle point directly aligned with forward nose / flight axis.
 */
export function resolveUnmountedMuzzle(
  e: MountActorInput,
  playerX: number,
  playerY: number,
  time: number,
): { mountX: number; mountY: number; muzzleX: number; muzzleY: number; aimAngle: number } {
  const hull = resolveHullVisualTransform(e, time);
  // Aircraft nose in unrotated cell points toward -Y (localY = -0.40)
  const nose = localToWorldPoint(hull, 0, e.family === 'alien' ? 0.16 : -0.40);
  const aimAngle = Math.atan2(playerY - nose.y, playerX - nose.x);
  return {
    mountX: nose.x,
    mountY: nose.y,
    muzzleX: nose.x + Math.cos(aimAngle) * 5,
    muzzleY: nose.y + Math.sin(aimAngle) * 5,
    aimAngle,
  };
}
