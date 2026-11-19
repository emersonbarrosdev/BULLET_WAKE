import { clamp, type Box } from './geometry.ts';

export type SupplyEntrySide = 'top' | 'right';
export type SupplyDronePhase = 'descend';

export interface SupplyDroneState {
  entrySide: SupplyEntrySide;
  phase: SupplyDronePhase;
  phaseTime: number;
  baseX: number;
  baseY: number;
  driftVx: number;
  descentVy: number;
  swayPhase: number;
  swayAmp: number;
  swayFreq: number;
  rotorAngle: number;
  rotorSpeed: number;
  hitRecoil: number;
  supplyKey?: string;
}

export const SUPPLY_DRONE_DESCENT_SPEED = 32;            // calm, readable power-up delivery speed (px/s)
export const SUPPLY_DRONE_DRIFT_SPEED = 14;              // subtle lateral drift nuance (px/s)
export const SUPPLY_DRONE_BASE_ROTOR_SPEED = 14.5;       // steady, clearly visible spinning propeller (rad/s)
export const SUPPLY_DRONE_DISPLAY_SIZE = 28;             // compact size matching planes / slightly smaller than player ship
export const SUPPLY_DRONE_PROP_SIZE = 27;                // separate spinning propeller matched to 28px chassis
export const SUPPLY_DRONE_HIT_RADIUS = 13;               // player shot hit radius
export const SUPPLY_DRONE_PLAYER_COLLISION_RADIUS = 12;  // tight fair player contact radius

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
  opts?: { supplyKey?: string },
): SupplyDroneSpawnPlan {
  const arenaW = Math.max(180, arena.right - arena.left);
  const arenaH = Math.max(180, arena.bottom - arena.top);
  const laneFracs = [0.30, 0.68, 0.48, 0.24, 0.74, 0.40, 0.60];
  const laneFrac = laneFracs[Math.abs(spawnIndex) % laneFracs.length];
  const marginX = Math.min(44, arenaW * 0.14);

  const entrySide: SupplyEntrySide = up ? 'top' : 'right';
  const startX = up
    ? clamp(arena.left + arenaW * laneFrac, arena.left + marginX, arena.right - marginX)
    : arena.right + 20;
  const startY = up
    ? arena.top - 22
    : clamp(arena.top + 80 + laneFrac * (arenaH - 160), arena.top + 64, arena.bottom - 64);

  const driftSign = spawnIndex % 2 === 0 ? 1 : -1;
  const driftVx = up ? driftSign * SUPPLY_DRONE_DRIFT_SPEED : -SUPPLY_DRONE_DESCENT_SPEED;
  const descentVy = up ? SUPPLY_DRONE_DESCENT_SPEED : driftSign * 12;

  return {
    x: startX,
    y: startY,
    vx: driftVx,
    vy: descentVy,
    drone: {
      entrySide,
      phase: 'descend',
      phaseTime: 0,
      baseX: startX,
      baseY: startY,
      driftVx,
      descentVy,
      swayPhase: (spawnIndex * 1.45) % (Math.PI * 2),
      swayAmp: up ? 10 : 8,
      swayFreq: 1.15,
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
  drone.rotorAngle = (drone.rotorAngle + drone.rotorSpeed * dt) % (Math.PI * 2);

  let x: number;
  let y: number;
  let escaped = false;

  if (drone.entrySide === 'top') {
    const minX = arena.left + 28;
    const maxX = arena.right - 28;
    drone.baseX += drone.driftVx * dt;
    if (drone.baseX < minX) {
      drone.baseX = minX;
      drone.driftVx = Math.abs(drone.driftVx);
    } else if (drone.baseX > maxX) {
      drone.baseX = maxX;
      drone.driftVx = -Math.abs(drone.driftVx);
    }
    drone.baseY += drone.descentVy * dt;

    const swayOffset =
      (Math.sin(drone.phaseTime * drone.swayFreq + drone.swayPhase) - Math.sin(drone.swayPhase)) *
      drone.swayAmp;
    x = clamp(drone.baseX + swayOffset, arena.left + 22, arena.right - 22);
    y = drone.baseY;
    escaped = y > arena.bottom + 32;
  } else {
    const minY = arena.top + 36;
    const maxY = arena.bottom - 36;
    drone.baseX += drone.driftVx * dt;
    drone.baseY += drone.descentVy * dt;
    if (drone.baseY < minY) {
      drone.baseY = minY;
      drone.descentVy = Math.abs(drone.descentVy);
    } else if (drone.baseY > maxY) {
      drone.baseY = maxY;
      drone.descentVy = -Math.abs(drone.descentVy);
    }
    const swayOffset =
      (Math.sin(drone.phaseTime * drone.swayFreq + drone.swayPhase) - Math.sin(drone.swayPhase)) *
      drone.swayAmp;
    x = drone.baseX;
    y = clamp(drone.baseY + swayOffset, arena.top + 28, arena.bottom - 28);
    escaped = x < arena.left - 36;
  }

  return {
    x,
    y,
    vx: (x - prevX) / safeDt,
    vy: (y - prevY) / safeDt,
    escaped,
  };
}
