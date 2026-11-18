import { FAMILY, type EntrySide, type Family, type Formation, type Motion } from './content.ts';
import type { Box } from './geometry.ts';
import { clamp } from './geometry.ts';

export interface HelicopterFormationState {
  slot: number;
  count: number;
  refX: number;
  slotOffsetX: number;
  slotOffsetY: number;
  maxSlotExtentX: number;
  timeLag: number;
  smoothVx: number;
  smoothVy: number;
}

export interface HelicopterActorLike {
  id: number;
  x: number;
  y: number;
  size: number;
  hp: number;
  age: number;
  family: Family;
  motion: Motion;
  lane: number;
  offset: number;
  speed: number;
  entry?: EntrySide;
  vx?: number;
  vy?: number;
  altitude?: number;
  squadId?: number;
  archRetiring?: boolean;
  heliNav?: HelicopterFormationState;
}

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export function isHelicopter(family: Family): boolean {
  return (
    family === 'heli_scout' ||
    family === 'heli_utility' ||
    family === 'heli_phantom' ||
    family === 'heli_warhawk'
  );
}

/**
 * Computes disciplined formation slot geometry using real sprite footprints and a shared reference trajectory.
 * Members maintain consistent left-to-right ordering so companions never cross or stack unintentionally.
 */
export function computeHelicopterSlotLayout(
  family: Family,
  formation: Formation,
  count: number,
  slot: number,
  arena: Box,
  refCenterX: number,
  entry?: EntrySide,
): { spawnX: number; spawnYOffset: number; state: HelicopterFormationState } {
  const size = FAMILY[family].size;
  const sep = Math.max(size * 1.44, 62);
  const lateralSpacing = sep * 0.92;

  let slotOffsetX = 0;
  let slotOffsetY = 0;
  let maxExtent = 0;

  if (count <= 1 || formation === 'solo') {
    slotOffsetX = 0;
    slotOffsetY = 0;
    maxExtent = size * 0.45;
  } else if (formation === 'pair' || count === 2) {
    slotOffsetX = (slot === 0 ? -0.56 : 0.56) * lateralSpacing;
    slotOffsetY = slot === 0 ? 0 : -10;
    maxExtent = 0.56 * lateralSpacing + size * 0.4;
  } else if (formation === 'trio' || (formation === 'v' && count === 3) || count === 3) {
    const offsetsX = [-0.96 * lateralSpacing, 0, 0.96 * lateralSpacing];
    const offsetsY = [-20, 4, -20];
    slotOffsetX = offsetsX[slot] ?? 0;
    slotOffsetY = offsetsY[slot] ?? -16;
    maxExtent = 0.96 * lateralSpacing + size * 0.4;
  } else if (formation === 'quartet' || count === 4) {
    const offsetsX = [-1.42 * lateralSpacing, -0.48 * lateralSpacing, 0.48 * lateralSpacing, 1.42 * lateralSpacing];
    const offsetsY = [-24, 2, 2, -24];
    slotOffsetX = offsetsX[slot] ?? 0;
    slotOffsetY = offsetsY[slot] ?? 0;
    maxExtent = 1.42 * lateralSpacing + size * 0.4;
  } else {
    const mid = (count - 1) * 0.5;
    const rank = slot - mid;
    slotOffsetX = rank * lateralSpacing * 0.86;
    slotOffsetY = formation === 'v' ? -Math.abs(rank) * 18 : -slot * 14;
    maxExtent = Math.max(size * 0.5, mid * lateralSpacing * 0.86 + size * 0.4);
  }

  const arenaSpan = arena.right - arena.left;
  const edgePad = Math.max(24, size * 0.55);
  const maxSafeRefOffset = Math.max(0, arenaSpan * 0.5 - edgePad - maxExtent);
  const arenaMid = (arena.left + arena.right) * 0.5;
  const clampedRefX = clamp(refCenterX, arenaMid - maxSafeRefOffset, arenaMid + maxSafeRefOffset);

  const dir = entry === 'right' ? -1 : 1;
  const sideWingCenterX = entry === 'left' ? arena.left - 36 - maxExtent : arena.right + 36 + maxExtent;
  const spawnX = entry === 'left' || entry === 'right'
    ? sideWingCenterX + slotOffsetX
    : clamp(clampedRefX + slotOffsetX, arena.left + edgePad, arena.right - edgePad);

  const timeLag = slot * 0.11;
  const initVx = entry === 'left' || entry === 'right' ? dir * FAMILY[family].size * 1.4 : 0;
  const initVy = entry === 'left' || entry === 'right' ? 18 : 65;

  return {
    spawnX,
    spawnYOffset: slotOffsetY,
    state: {
      slot,
      count,
      refX: clampedRefX,
      slotOffsetX,
      slotOffsetY,
      maxSlotExtentX: maxExtent,
      timeLag,
      smoothVx: initVx,
      smoothVy: initVy,
    },
  };
}

/**
 * Steps a helicopter's continuous C1/C2 trajectory without sudden velocity snaps or formation overlap.
 * Shared group trajectory keeps squad mates flying in coherent Sonic-Wings formations across curves & sweeps.
 */
export function stepHelicopterActor(
  e: HelicopterActorLike,
  arena: Box,
  scrollSpeed: number,
  mDt: number,
): void {
  if (!e.heliNav) {
    e.heliNav = {
      slot: 0,
      count: 1,
      refX: e.lane,
      slotOffsetX: 0,
      slotOffsetY: 0,
      maxSlotExtentX: e.size * 0.45,
      timeLag: 0,
      smoothVx: e.vx ?? 0,
      smoothVy: e.vy ?? e.speed,
    };
  }

  const nav = e.heliNav;
  const t = e.age;
  const arenaMid = (arena.left + arena.right) * 0.5;
  const arenaW = arena.right - arena.left;
  const margin = e.family === 'heli_warhawk' ? 38 : e.family === 'heli_utility' ? 30 : 24;
  const usableHalf = Math.max(24, arenaW * 0.5 - margin - nav.maxSlotExtentX);
  const minRefX = arenaMid - usableHalf;
  const maxRefX = arenaMid + usableHalf;
  const safeRefX = clamp(nav.refX, minRefX, maxRefX);

  let targetX = e.x;
  let baseVx = 0;
  let baseVy = scrollSpeed + 20;
  let accelRate = 6.5;

  if (e.archRetiring) {
    const peelDir = e.x < arenaMid ? -1 : 1;
    baseVx = peelDir * 44;
    baseVy = Math.max(155, e.speed * 1.35);
    accelRate = 5.5;
    nav.smoothVx += (baseVx - nav.smoothVx) * clamp(mDt * accelRate, 0, 1);
    nav.smoothVy += (baseVy - nav.smoothVy) * clamp(mDt * accelRate, 0, 1);
    e.x += nav.smoothVx * mDt;
    e.y += nav.smoothVy * mDt;
    return;
  }

  if (e.family === 'heli_scout') {
    e.altitude = 0.85 + Math.sin(t * 3.4) * 0.08;
    accelRate = 7.4;

    if (e.entry === 'left' || e.entry === 'right') {
      const dir = e.entry === 'left' ? 1 : -1;
      // Shared group trajectory keeps left/right wingmates strictly ordered without overtaking
      const sweepIn = smoothstep(0, 1.35, t);
      const turnDown = smoothstep(0.85, 2.55, t);
      const waveOffset = Math.sin(Math.max(0, t - 0.5) * 2.15) * Math.min(36, usableHalf * 0.42);
      const arcRefX = entryRefProgressX(arena, dir, sweepIn, t, e.speed, nav.maxSlotExtentX);
      targetX = clamp(arcRefX + nav.slotOffsetX * 0.92 + waveOffset, arena.left - 140, arena.right + 140);
      baseVx = (targetX - e.x) * 4.2;
      baseVy = Math.max(scrollSpeed + 18, 28 + turnDown * (e.speed * 0.92));
      nav.smoothVx += (baseVx - nav.smoothVx) * clamp(mDt * accelRate, 0, 1);
      nav.smoothVy += (baseVy - nav.smoothVy) * clamp(mDt * accelRate, 0, 1);
      e.x = clamp(e.x + nav.smoothVx * mDt, arena.left - 140, arena.right + 140);
      e.y += nav.smoothVy * mDt;
      return;
    }

    // Coordinated top-down S-curve descent: zero phase lag on X so Wingmates sweep identically side-by-side
    const amp = Math.min(54, Math.max(16, usableHalf * 0.72));
    const swayAngle = t * 2.35;
    const desiredRefX = clamp(safeRefX + Math.sin(swayAngle) * amp, minRefX, maxRefX);
    targetX = desiredRefX + nav.slotOffsetX;
    const rampDown = smoothstep(0, 0.85, t);
    const exitAccel = smoothstep(4.2, 5.6, t);
    baseVy = Math.max(scrollSpeed + 16, e.speed * (0.72 + 0.16 * rampDown + 0.34 * exitAccel));
    baseVx = (targetX - e.x) * 5.2;
    nav.smoothVx += (baseVx - nav.smoothVx) * clamp(mDt * accelRate, 0, 1);
    nav.smoothVy += (baseVy - nav.smoothVy) * clamp(mDt * accelRate, 0, 1);
    e.x = clamp(e.x + nav.smoothVx * mDt, arena.left + 16, arena.right - 16);
    e.y += nav.smoothVy * mDt;
    return;
  }

  if (e.family === 'heli_utility') {
    e.altitude = 0.86 + Math.sin(t * 2.2) * 0.14;
    accelRate = 5.0;
    const settleWeight = smoothstep(0.15, 1.55, t);
    const departWeight = smoothstep(5.9, 7.1, t);

    const patrolAmp = Math.min(44, Math.max(14, usableHalf * 0.65));
    const hoverX = clamp(safeRefX + Math.sin(Math.max(0, t - 0.8) * 1.12) * patrolAmp, minRefX, maxRefX) + nav.slotOffsetX;
    const hoverY = clamp(arena.top + 86 + nav.slotOffsetY * 0.45 + Math.sin(t * 1.6) * 7, arena.top + 28, 168);

    if (departWeight < 0.05) {
      targetX = hoverX;
      baseVx = (targetX - e.x) * 3.8;
      baseVy = t < 1.1
        ? e.speed * (1 - 0.45 * settleWeight)
        : (hoverY - e.y) * 3.2;
    } else {
      const sidePeel = (safeRefX < arenaMid ? -1 : 1) * 24 * departWeight;
      targetX = e.x + sidePeel * mDt;
      baseVx = sidePeel + Math.cos(t * 1.12) * 10 * (1 - departWeight);
      baseVy = Math.max(scrollSpeed + 22, e.speed * (0.45 + 0.72 * departWeight));
    }

    nav.smoothVx += (baseVx - nav.smoothVx) * clamp(mDt * accelRate, 0, 1);
    nav.smoothVy += (baseVy - nav.smoothVy) * clamp(mDt * accelRate, 0, 1);
    e.x = clamp(e.x + nav.smoothVx * mDt, arena.left + 20, arena.right - 20);
    e.y += nav.smoothVy * mDt;
    return;
  }

  if (e.family === 'heli_phantom') {
    e.altitude = 0.82 + Math.sin(t * 3.1) * 0.09;
    accelRate = 6.2;
    const isSide = e.entry === 'left' || e.entry === 'right';
    const dir = e.entry === 'right' ? -1 : 1;

    if (t < 1.25 && isSide) {
      // Graceful banked entry curving cleanly from wing border into central strike lane
      const enterP = smoothstep(0, 1.25, t);
      const startX = e.entry === 'left' ? arena.left - 32 : arena.right + 32;
      const enterRefX = startX + (arenaMid - startX) * enterP;
      targetX = enterRefX + nav.slotOffsetX;
      const enterHoverY = clamp(arena.top + 88 + nav.slotOffsetY * 0.55 + Math.sin(enterP * Math.PI) * 18, arena.top + 24, 170);
      baseVx = (targetX - e.x) * 5.8;
      baseVy = (enterHoverY - e.y) * 4.4;
    } else if (t < 6.8) {
      // Smooth harmonic strike sweep: decelerates gently near endpoints for 3-way fan fire, never snaps
      const tStrike = Math.max(0, t - (isSide ? 1.25 : 0.75));
      const settle = isSide ? 1 : smoothstep(0, 1.15, t);
      const sweepSpan = Math.min(116, Math.max(46, usableHalf * 0.92));
      const baseOrigin = isSide ? arenaMid : safeRefX;
      const centerMin = arena.left + margin + nav.maxSlotExtentX;
      const centerMax = arena.right - margin - nav.maxSlotExtentX;
      const phase = isSide ? (dir > 0 ? 0 : Math.PI) : 0;
      const primary = Math.sin(tStrike * 1.48 + phase);
      const flattenTurn = Math.sin((tStrike * 1.48 + phase) * 3) * 0.14;
      const curveX = clamp(baseOrigin + (primary - flattenTurn) * sweepSpan * settle, centerMin, centerMax);
      targetX = curveX + nav.slotOffsetX;
      const targetHoverY = clamp(
        arena.top + 92 + nav.slotOffsetY * 0.5 + Math.sin(tStrike * 2.2) * 15,
        arena.top + 26,
        172,
      );
      baseVx = (targetX - e.x) * 4.6;
      baseVy = t < 0.9 && !isSide ? e.speed * (0.95 - 0.5 * settle) : (targetHoverY - e.y) * 3.8;
    } else {
      // Smooth outward peel withdrawal
      const outP = smoothstep(6.8, 7.8, t);
      const peelSide = e.x >= arenaMid ? 1 : -1;
      baseVx = peelSide * 38 * outP;
      baseVy = Math.max(scrollSpeed + 28, e.speed * (0.65 + 0.65 * outP));
    }

    nav.smoothVx += (baseVx - nav.smoothVx) * clamp(mDt * accelRate, 0, 1);
    nav.smoothVy += (baseVy - nav.smoothVy) * clamp(mDt * accelRate, 0, 1);
    const nextX = e.x + nav.smoothVx * mDt;
    const insideX = e.x >= arena.left + 20 && e.x <= arena.right - 20;
    const minBoundX = (!isSide || insideX) ? arena.left + 20 : arena.left - 140;
    const maxBoundX = (!isSide || insideX) ? arena.right - 20 : arena.right + 140;
    e.x = clamp(nextX, minBoundX, maxBoundX);
    e.y += nav.smoothVy * mDt;
    return;
  }

  // heli_warhawk: Heavy gunship with clear mass, stable slow sweep, continuous chin + wing firing
  e.altitude = 0.94 + Math.sin(t * 1.7) * 0.06;
  accelRate = 3.8;
  const enterW = smoothstep(0, 1.55, t);
  const exitW = smoothstep(11.0, 12.2, t);
  const sweepW = Math.min(84, Math.max(30, usableHalf * 0.85));
  const stationRefX = clamp(arenaMid + Math.sin(Math.max(0, t - 1.3) * 0.82) * sweepW * enterW, minRefX, maxRefX);
  const stationY = clamp(arena.top + 96 + nav.slotOffsetY * 0.4 + Math.sin(t * 1.25) * 12, arena.top + 32, 152);

  if (exitW < 0.05) {
    targetX = stationRefX + nav.slotOffsetX;
    baseVx = (targetX - e.x) * 3.2;
    baseVy = t < 1.2 ? e.speed * (1.05 - 0.55 * enterW) : (stationY - e.y) * 2.8;
  } else {
    baseVx = (e.x < arenaMid ? -1 : 1) * 18 * exitW;
    baseVy = Math.max(scrollSpeed + 24, 108 * exitW);
  }

  nav.smoothVx += (baseVx - nav.smoothVx) * clamp(mDt * accelRate, 0, 1);
  nav.smoothVy += (baseVy - nav.smoothVy) * clamp(mDt * accelRate, 0, 1);
  e.x = clamp(e.x + nav.smoothVx * mDt, arena.left + 32, arena.right - 32);
  e.y += nav.smoothVy * mDt;
}

function entryRefProgressX(
  arena: Box,
  dir: number,
  sweepIn: number,
  tEff: number,
  speed: number,
  maxSlotExtentX: number,
): number {
  const startX = dir > 0 ? arena.left - 36 - maxSlotExtentX : arena.right + 36 + maxSlotExtentX;
  const sweepDist = (arena.right - arena.left) * 0.62;
  const cruiseX = startX + dir * (sweepDist * sweepIn + Math.max(0, tEff - 1.35) * speed * 0.42);
  return clamp(cruiseX, arena.left - 140, arena.right + 140);
}

/**
 * Enforces minimum visual separation between live helicopters without letting same-squad members swap left/right slots.
 */
export function enforceHelicopterSeparation(
  enemies: readonly HelicopterActorLike[],
  arenaLeft: number,
  arenaRight: number,
  mDt: number,
): void {
  const helis = enemies.filter(e => e.hp > 0 && isHelicopter(e.family));
  if (helis.length < 2) return;

  for (let i = 0; i < helis.length; i++) {
    for (let j = i + 1; j < helis.length; j++) {
      const a = helis[i];
      const b = helis[j];
      const minSepX = (a.size + b.size) * 0.58;
      const minSepY = (a.size + b.size) * 0.45;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dy) >= minSepY || Math.abs(dx) >= minSepX) continue;

      const sameSquad = a.squadId !== undefined && a.squadId === b.squadId;
      const desiredSign = sameSquad && a.heliNav && b.heliNav
        ? (a.heliNav.slot <= b.heliNav.slot ? 1 : -1)
        : (dx >= 0 ? 1 : -1);

      const push = clamp((minSepX - Math.abs(dx)) * Math.min(1, mDt * 9.5 + 0.12), 0, minSepX * 0.5);
      if (push <= 0.01) continue;

      a.x -= desiredSign * push * 0.5;
      b.x += desiredSign * push * 0.5;

      if (a.age > 1.8 && a.x >= arenaLeft + 18 && a.x <= arenaRight - 18) a.x = clamp(a.x, arenaLeft + 18, arenaRight - 18);
      if (b.age > 1.8 && b.x >= arenaLeft + 18 && b.x <= arenaRight - 18) b.x = clamp(b.x, arenaLeft + 18, arenaRight - 18);
    }
  }
}
