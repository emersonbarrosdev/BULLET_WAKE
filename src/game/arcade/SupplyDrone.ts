import { clamp, type Box } from './geometry.ts';

export type SupplyEntrySide = 'left' | 'right' | 'top' | 'bottom';
export type SupplyDronePhase = 'enter' | 'deliver' | 'retreat';

export interface SupplyDroneState {
  entrySide: SupplyEntrySide;
  phase: SupplyDronePhase;
  phaseTime: number;
  enterDuration: number;
  deliverDuration: number;
  startX: number;
  startY: number;
  ctrlX: number;
  ctrlY: number;
  targetX: number;
  targetY: number;
  retreatStartX: number;
  retreatStartY: number;
  retreatDirX: number;
  retreatDirY: number;
  swayPhase: number;
  rotorAngle: number;
  rotorSpeed: number;
  hitRecoil: number;
  supplyKey?: string;
}

export const SUPPLY_DRONE_ENTRY_CYCLE: readonly SupplyEntrySide[] = [
  'left',
  'top',
  'right',
  'bottom',
  'right',
  'top',
  'left',
  'bottom',
];

export const SUPPLY_DRONE_BASE_ROTOR_SPEED = 18.5; // rad/s (~3 full rotations/sec, clearly visible spinning blades)
export const SUPPLY_DRONE_DELIVER_DURATION = 5.0;  // seconds hovering in central delivery zone
export const SUPPLY_DRONE_RETRY_DELAY = 7.5;       // seconds before another drone can appear if missed
export const SUPPLY_DRONE_MAX_RETRIES = 1;         // at most one re-approach per missed mission supply
export const SUPPLY_DRONE_HIT_RADIUS = 16;         // player shot hit radius
export const SUPPLY_DRONE_PLAYER_COLLISION_RADIUS = 15; // tight fair player contact radius

export function pickSupplyEntrySide(
  spawnIndex: number,
  up: boolean,
  avoidSide?: SupplyEntrySide,
): SupplyEntrySide {
  const cycle: readonly SupplyEntrySide[] = up
    ? SUPPLY_DRONE_ENTRY_CYCLE
    : ['right', 'top', 'bottom', 'left'];
  const baseIdx = Math.abs(Math.floor(spawnIndex)) % cycle.length;
  let side = cycle[baseIdx];
  if (avoidSide && side === avoidSide) {
    for (let step = 1; step < cycle.length; step++) {
      const candidate = cycle[(baseIdx + step) % cycle.length];
      if (candidate !== avoidSide) {
        side = candidate;
        break;
      }
    }
  }
  return side;
}

export interface SupplyDroneSpawnPlan {
  x: number;
  y: number;
  vx: number;
  vy: number;
  drone: SupplyDroneState;
}

export function createSupplyDronePlan(
  arena: Box,
  up: boolean,
  spawnIndex: number,
  playerX: number,
  opts?: { forcedSide?: SupplyEntrySide; avoidSide?: SupplyEntrySide; supplyKey?: string },
): SupplyDroneSpawnPlan {
  const arenaW = Math.max(180, arena.right - arena.left);
  const arenaH = Math.max(180, arena.bottom - arena.top);
  const centerX = (arena.left + arena.right) * 0.5;
  const entrySide = opts?.forcedSide ?? pickSupplyEntrySide(spawnIndex, up, opts?.avoidSide);

  // Varied delivery target strictly inside the comfortable mid/central combat corridor
  const laneFracs = [0.34, 0.64, 0.48, 0.28, 0.70, 0.42, 0.58];
  const yFracs = [0.33, 0.41, 0.29, 0.45, 0.36];
  const laneFrac = laneFracs[Math.abs(spawnIndex) % laneFracs.length];
  const yFrac = yFracs[Math.abs(spawnIndex * 3 + 1) % yFracs.length];

  const marginX = Math.min(62, arenaW * 0.18);
  const targetX = up
    ? clamp(arena.left + arenaW * laneFrac, arena.left + marginX, arena.right - marginX)
    : clamp(arena.left + arenaW * (0.48 + (laneFrac - 0.5) * 0.48), arena.left + marginX, arena.right - marginX);
  const targetY = up
    ? clamp(arena.top + arenaH * yFrac, arena.top + 96, arena.top + arenaH * 0.52)
    : clamp(arena.top + arenaH * (0.26 + laneFrac * 0.46), arena.top + 68, arena.bottom - 68);

  const edgePad = 24;
  let startX = targetX;
  let startY = arena.top - edgePad;

  if (entrySide === 'left') {
    startX = arena.left - edgePad;
    const verticalBias = (spawnIndex % 2 === 0 ? -1 : 1) * 32;
    startY = clamp(targetY + verticalBias, arena.top + 62, arena.top + arenaH * 0.60);
  } else if (entrySide === 'right') {
    startX = arena.right + edgePad;
    const verticalBias = (spawnIndex % 2 === 0 ? 1 : -1) * 32;
    startY = clamp(targetY + verticalBias, arena.top + 62, arena.top + arenaH * 0.60);
  } else if (entrySide === 'top') {
    const horizBias = (spawnIndex % 2 === 0 ? -1 : 1) * Math.min(46, arenaW * 0.12);
    startX = clamp(targetX + horizBias, arena.left + marginX, arena.right - marginX);
    startY = arena.top - edgePad;
  } else {
    // 'bottom': sweep up the far flank away from player before curving inward to central delivery zone
    const safeRight = arena.right - Math.max(42, arenaW * 0.11);
    const safeLeft = arena.left + Math.max(42, arenaW * 0.11);
    const preferredX = playerX < centerX ? safeRight : safeLeft;
    startX = clamp(preferredX, arena.left + 38, arena.right - 38);
    startY = arena.bottom + edgePad;
  }

  // Gentle perpendicular arc control point for lively, readable arcade flight curve
  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.max(40, Math.hypot(dx, dy));
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const curveSign = entrySide === 'left' ? -1 : entrySide === 'right' ? 1 : spawnIndex % 2 === 0 ? 1 : -1;
  const curveAmp = clamp(dist * 0.13, 18, 36) * curveSign;
  const ctrlX = entrySide === 'bottom' ? startX : (startX + targetX) * 0.5 + perpX * curveAmp;
  const ctrlY = entrySide === 'bottom' ? targetY + 26 : (startY + targetY) * 0.5 + perpY * curveAmp;

  // Brisk arcade approach (~250 px/s average, completing entry in ~0.78–1.18s)
  const enterDuration = clamp(dist / 255, 0.78, 1.18);

  // Ascend / peel away smoothly on retreat (never descending into the player)
  const retreatRawX = up ? (targetX < centerX ? -0.42 : 0.42) : 0.86;
  const retreatRawY = up ? -0.91 : (targetY < arena.top + arenaH * 0.5 ? -0.51 : 0.51);
  const rLen = Math.hypot(retreatRawX, retreatRawY) || 1;

  const initialVx = (ctrlX - startX) * (2 / enterDuration);
  const initialVy = (ctrlY - startY) * (2 / enterDuration);

  return {
    x: startX,
    y: startY,
    vx: initialVx,
    vy: initialVy,
    drone: {
      entrySide,
      phase: 'enter',
      phaseTime: 0,
      enterDuration,
      deliverDuration: SUPPLY_DRONE_DELIVER_DURATION,
      startX,
      startY,
      ctrlX,
      ctrlY,
      targetX,
      targetY,
      retreatStartX: targetX,
      retreatStartY: targetY,
      retreatDirX: retreatRawX / rLen,
      retreatDirY: retreatRawY / rLen,
      swayPhase: (spawnIndex * 1.7) % (Math.PI * 2),
      rotorAngle: (spawnIndex * 0.9) % (Math.PI * 2),
      rotorSpeed: SUPPLY_DRONE_BASE_ROTOR_SPEED,
      hitRecoil: 0,
      supplyKey: opts?.supplyKey,
    },
  };
}

export interface SupplyDroneStepResult {
  x: number;
  y: number;
  vx: number;
  vy: number;
  escaped: boolean;
}

export function stepSupplyDrone(
  drone: SupplyDroneState,
  prevX: number,
  prevY: number,
  dt: number,
  arena: Box,
): SupplyDroneStepResult {
  const safeDt = Math.max(0.0001, dt);
  drone.phaseTime += dt;
  drone.hitRecoil = Math.max(0, drone.hitRecoil - dt * 6.5);

  // Rotor spins continuously and accelerates slightly during approach / climb-out
  const departureWarning =
    drone.phase === 'deliver' && drone.phaseTime >= drone.deliverDuration - 0.85;
  drone.rotorSpeed =
    drone.phase === 'retreat'
      ? SUPPLY_DRONE_BASE_ROTOR_SPEED * 1.48
      : drone.phase === 'enter'
        ? SUPPLY_DRONE_BASE_ROTOR_SPEED * 1.18
        : departureWarning
          ? SUPPLY_DRONE_BASE_ROTOR_SPEED * 1.32
          : SUPPLY_DRONE_BASE_ROTOR_SPEED;
  drone.rotorAngle = (drone.rotorAngle + drone.rotorSpeed * dt) % (Math.PI * 2);

  let x = prevX;
  let y = prevY;
  let escaped = false;

  if (drone.phase === 'enter') {
    const rawU = clamp(drone.phaseTime / Math.max(0.05, drone.enterDuration), 0, 1);
    // Smooth cubic ease-out: enters fast and settles naturally into delivery hover
    const u = 1 - Math.pow(1 - rawU, 3);
    const inv = 1 - u;
    x = inv * inv * drone.startX + 2 * inv * u * drone.ctrlX + u * u * drone.targetX;
    y = inv * inv * drone.startY + 2 * inv * u * drone.ctrlY + u * u * drone.targetY;
    if (rawU >= 1) {
      drone.phase = 'deliver';
      drone.phaseTime = 0;
    }
  } else if (drone.phase === 'deliver') {
    const t = drone.phaseTime;
    // Gentle arcade hover weave so the drone feels alive while remaining easy to track & shoot
    const ramp = clamp(t / 0.35, 0, 1);
    const swayX = Math.sin(t * 2.15 + drone.swayPhase) * 24 * ramp;
    const swayY = Math.sin(t * 3.1 + drone.swayPhase * 0.7) * 8.5 * ramp;
    x = clamp(drone.targetX + swayX, arena.left + 32, arena.right - 32);
    y = clamp(drone.targetY + swayY, arena.top + 38, arena.bottom - 70);
    if (t >= drone.deliverDuration) {
      drone.phase = 'retreat';
      drone.phaseTime = 0;
      drone.retreatStartX = x;
      drone.retreatStartY = y;
    }
  } else {
    // 'retreat': accelerate briskly upward/away off-screen without dropping the supply
    const t = drone.phaseTime;
    const travel = 96 * t + 280 * t * t;
    const weave = Math.sin(t * 6.5) * 6 * Math.min(1, t * 2);
    x = drone.retreatStartX + drone.retreatDirX * travel - drone.retreatDirY * weave;
    y = drone.retreatStartY + drone.retreatDirY * travel + drone.retreatDirX * weave;
    escaped =
      x < arena.left - 44 ||
      x > arena.right + 44 ||
      y < arena.top - 44 ||
      y > arena.bottom + 44 ||
      t > 3.2;
  }

  return {
    x,
    y,
    vx: (x - prevX) / safeDt,
    vy: (y - prevY) / safeDt,
    escaped,
  };
}
