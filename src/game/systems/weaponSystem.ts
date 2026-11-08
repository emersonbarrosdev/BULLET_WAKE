/**
 * Sistema de armas e habilidades dos três pilotos do BULLET WAKE.
 * Implementação pura sem dependência do Phaser ou DOM.
 */
import { getPilot, type PilotId } from '../data/pilots.ts';

export type WeaponLevel = 1 | 2 | 3;
export type SpecialType = 'prism' | 'phantom' | 'nova';

export interface ProjectileSpawnDef {
  texture: string;
  animation: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  damage: number;
  hitRadius: number;
  scale: number;
  piercing?: boolean;
}

export interface PlayerWeaponsState {
  pilotId: PilotId;
  weaponLevel: WeaponLevel;
  bombs: number;
  hasShield: boolean;
  resonance: number; // 0 a 100
  specialActiveMs: number;
  specialDurationMs: number;
  specialType: SpecialType;
  missileCooldownMs: number;
  fireCooldownMs: number;

  // Sistema de Calor e Sobreaquecimento (Diretriz 26)
  heat: number;                 // 0 a 100
  isOverheated: boolean;        // Bloqueio temporário por sobreaquecimento
  overheatCooldownMs: number;   // Tempo restante de cooldown de sobreaquecimento

  // Sistema de Armas Carregáveis (Wave Cannon)
  chargeMs: number;             // Milissegundos acumulados de carga
  isCharging: boolean;          // Verdadeiro enquanto o jogador segura o comando de carga
}

export const MAX_WEAPON_LEVEL: WeaponLevel = 3;
export const MAX_BOMBS = 4;
export const START_BOMBS = 2;
export const MAX_RESONANCE = 100;
export const MISSILE_COOLDOWN_MS = 1600;

export const MAX_HEAT = 100;
export const OVERHEAT_COOLDOWN_MS = 650;
export const MIN_CHARGE_MS = 400;
export const MAX_CHARGE_MS = 1400;
export const FULL_CHARGE_THRESHOLD_MS = 1100;

export interface PilotWeaponSpecs {
  autoIntervalMs: number;
  burstIntervalMs: number;
  heatPerShot: number;
  coolingRatePerSec: number;
}

export const PILOT_WEAPON_SPECS: Record<PilotId, PilotWeaponSpecs> = {
  nolan: {
    autoIntervalMs: 125,
    burstIntervalMs: 90,
    heatPerShot: 8,
    coolingRatePerSec: 42,
  },
  cora: {
    autoIntervalMs: 147,
    burstIntervalMs: 105,
    heatPerShot: 6,
    coolingRatePerSec: 52,
  },
  harlan: {
    autoIntervalMs: 200,
    burstIntervalMs: 145,
    heatPerShot: 14,
    coolingRatePerSec: 36,
  },
};

export const SPECIAL_DURATIONS: Record<SpecialType, number> = {
  prism: 3800,  // Nolan: Tempestade Prismática (~4 segundos)
  phantom: 650, // Cora: Salto Fantasma (~0.65 segundo dash rápido)
  nova: 900,    // Harlan: Ruptura Nova (~0.9 segundo pulso expansivo)
};

export function createPlayerWeapons(pilotId: PilotId = 'nolan'): PlayerWeaponsState {
  const pilot = getPilot(pilotId);
  const specialType: SpecialType =
    pilot.id === 'cora' ? 'phantom' : pilot.id === 'harlan' ? 'nova' : 'prism';

  return {
    pilotId: pilot.id,
    weaponLevel: 1,
    bombs: START_BOMBS,
    hasShield: false,
    resonance: 0,
    specialActiveMs: 0,
    specialDurationMs: SPECIAL_DURATIONS[specialType],
    specialType,
    missileCooldownMs: 0,
    fireCooldownMs: 0,
    heat: 0,
    isOverheated: false,
    overheatCooldownMs: 0,
    chargeMs: 0,
    isCharging: false,
  };
}

export function upgradeWeapon(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  upgraded: boolean;
} {
  if (state.weaponLevel >= MAX_WEAPON_LEVEL) {
    return { state, upgraded: false };
  }
  const nextLevel = (state.weaponLevel + 1) as WeaponLevel;
  return {
    state: { ...state, weaponLevel: nextLevel },
    upgraded: true,
  };
}

export function addResonance(state: PlayerWeaponsState, amount: number): PlayerWeaponsState {
  const next = Math.max(0, Math.min(MAX_RESONANCE, state.resonance + Math.max(0, amount)));
  return { ...state, resonance: next };
}

export function canActivateSpecial(state: PlayerWeaponsState): boolean {
  return state.resonance >= MAX_RESONANCE && state.specialActiveMs <= 0;
}

export function activateSpecial(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  activated: boolean;
} {
  if (!canActivateSpecial(state)) {
    return { state, activated: false };
  }
  return {
    state: {
      ...state,
      resonance: 0,
      specialActiveMs: state.specialDurationMs,
    },
    activated: true,
  };
}

export function canUseBomb(state: PlayerWeaponsState): boolean {
  return state.bombs > 0;
}

export function useBomb(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  used: boolean;
} {
  if (!canUseBomb(state)) {
    return { state, used: false };
  }
  return {
    state: { ...state, bombs: state.bombs - 1 },
    used: true,
  };
}

export function addBomb(state: PlayerWeaponsState): PlayerWeaponsState {
  return { ...state, bombs: Math.min(MAX_BOMBS, state.bombs + 1) };
}

export function setShield(state: PlayerWeaponsState, active: boolean): PlayerWeaponsState {
  return { ...state, hasShield: active };
}

export function advanceWeapons(state: PlayerWeaponsState, deltaMs: number): PlayerWeaponsState {
  const dt = Math.max(0, deltaMs);
  const specs = PILOT_WEAPON_SPECS[state.pilotId] || PILOT_WEAPON_SPECS.nolan;

  let overheatCooldownMs = Math.max(0, state.overheatCooldownMs - dt);
  let isOverheated = state.isOverheated;
  if (isOverheated && overheatCooldownMs <= 0) {
    isOverheated = false;
  }

  // Resfriamento contínuo
  const coolingAmount = (specs.coolingRatePerSec * dt) / 1000;
  const nextHeat = Math.max(0, state.heat - coolingAmount);

  return {
    ...state,
    specialActiveMs: Math.max(0, state.specialActiveMs - dt),
    missileCooldownMs: Math.max(0, state.missileCooldownMs - dt),
    fireCooldownMs: Math.max(0, state.fireCooldownMs - dt),
    overheatCooldownMs,
    isOverheated,
    heat: nextHeat,
  };
}

export function resetWeaponsOnRespawn(state: PlayerWeaponsState): PlayerWeaponsState {
  return {
    ...state,
    weaponLevel: 1,
    hasShield: false,
    specialActiveMs: 0,
    missileCooldownMs: 0,
    fireCooldownMs: 0,
    heat: 0,
    isOverheated: false,
    overheatCooldownMs: 0,
    chargeMs: 0,
    isCharging: false,
    resonance: Math.floor(state.resonance * 0.5), // preserva metade da ressonância
  };
}

/** Registra um disparo primário e computa calor gerado */
export function recordPrimaryShot(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  overheatedNow: boolean;
} {
  const specs = PILOT_WEAPON_SPECS[state.pilotId] || PILOT_WEAPON_SPECS.nolan;
  const nextHeat = Math.min(MAX_HEAT, state.heat + specs.heatPerShot);
  const overheated = nextHeat >= MAX_HEAT;

  return {
    state: {
      ...state,
      heat: nextHeat,
      isOverheated: overheated || state.isOverheated,
      overheatCooldownMs: overheated ? OVERHEAT_COOLDOWN_MS : state.overheatCooldownMs,
    },
    overheatedNow: overheated && !state.isOverheated,
  };
}

/** Atualiza tempo de carga acumulado enquanto o jogador segura comando de carga */
export function updateWeaponCharge(
  state: PlayerWeaponsState,
  deltaMs: number,
  isHoldingCharge: boolean,
): PlayerWeaponsState {
  if (state.isOverheated) {
    return {
      ...state,
      isCharging: false,
      chargeMs: 0,
    };
  }

  if (isHoldingCharge) {
    const nextCharge = Math.min(MAX_CHARGE_MS, state.chargeMs + Math.max(0, deltaMs));
    return {
      ...state,
      isCharging: true,
      chargeMs: nextCharge,
    };
  }

  return {
    ...state,
    isCharging: false,
  };
}

/** Libera a carga acumulada e retorna o nível de disparo gerado */
export function releaseWeaponCharge(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  chargeMs: number;
  chargeLevel: 0 | 1 | 2;
} {
  const accumulated = state.chargeMs;
  let chargeLevel: 0 | 1 | 2 = 0;
  if (accumulated >= FULL_CHARGE_THRESHOLD_MS) {
    chargeLevel = 2;
  } else if (accumulated >= MIN_CHARGE_MS) {
    chargeLevel = 1;
  }

  // Cora: sob carga máxima (Overdrive), ventila instantaneamente 100% do calor acumulado!
  const heat = state.pilotId === 'cora' && chargeLevel === 2 ? 0 : state.heat;

  return {
    state: {
      ...state,
      isCharging: false,
      chargeMs: 0,
      heat,
    },
    chargeMs: accumulated,
    chargeLevel,
  };
}

/** Retorna definições de projéteis principais de acordo com piloto e nível (LV1-3). */
export function getPrimaryProjectiles(
  pilotId: PilotId,
  level: WeaponLevel,
  originX: number,
  originY: number,
): ProjectileSpawnDef[] {
  const pilot = getPilot(pilotId);
  const baseDmg = pilot.damage;

  if (pilotId === 'nolan') {
    // RIVET: Canhão de pulso rápido
    const key = 'rivet-v3-pulse-' + level;
    if (level === 1) {
      return [{
        texture: key,
        animation: key + '-anim',
        x: originX,
        y: originY + 2,
        velocityX: 560,
        velocityY: 0,
        damage: baseDmg,
        hitRadius: 10,
        scale: 0.7,
      }];
    }
    if (level === 2) {
      return [
        {
          texture: key,
          animation: key + '-anim',
          x: originX,
          y: originY - 6,
          velocityX: 575,
          velocityY: 0,
          damage: baseDmg * 0.85,
          hitRadius: 11,
          scale: 0.72,
        },
        {
          texture: key,
          animation: key + '-anim',
          x: originX,
          y: originY + 8,
          velocityX: 575,
          velocityY: 0,
          damage: baseDmg * 0.85,
          hitRadius: 11,
          scale: 0.72,
        },
      ];
    }
    // Level 3: 3 fluxos paralelos e penetrantes
    return [
      {
        texture: key,
        animation: key + '-anim',
        x: originX,
        y: originY - 12,
        velocityX: 590,
        velocityY: -30,
        damage: baseDmg * 0.8,
        hitRadius: 12,
        scale: 0.75,
      },
      {
        texture: key,
        animation: key + '-anim',
        x: originX + 6,
        y: originY + 2,
        velocityX: 610,
        velocityY: 0,
        damage: baseDmg * 1.1,
        hitRadius: 13,
        scale: 0.8,
        piercing: true,
      },
      {
        texture: key,
        animation: key + '-anim',
        x: originX,
        y: originY + 14,
        velocityX: 590,
        velocityY: 30,
        damage: baseDmg * 0.8,
        hitRadius: 12,
        scale: 0.75,
      },
    ];
  }

  if (pilotId === 'cora') {
    // MOTH: Agulha laser concentrada de alta velocidade e perfuração
    if (level === 1) {
      return [{
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX,
        y: originY,
        velocityX: 680,
        velocityY: 0,
        damage: baseDmg * 1.05,
        hitRadius: 8,
        scale: 1.7,
        piercing: true,
      }];
    }
    if (level === 2) {
      return [
        {
          texture: 'shot-moth',
          animation: 'shot-moth-loop',
          x: originX,
          y: originY - 5,
          velocityX: 700,
          velocityY: -15,
          damage: baseDmg * 0.9,
          hitRadius: 9,
          scale: 1.75,
          piercing: true,
        },
        {
          texture: 'shot-moth',
          animation: 'shot-moth-loop',
          x: originX,
          y: originY + 5,
          velocityX: 700,
          velocityY: 15,
          damage: baseDmg * 0.9,
          hitRadius: 9,
          scale: 1.75,
          piercing: true,
        },
      ];
    }
    // Level 3: feixe duplo perfurante frontal + leque de dispersão
    return [
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX + 8,
        y: originY - 4,
        velocityX: 730,
        velocityY: 0,
        damage: baseDmg * 1.15,
        hitRadius: 10,
        scale: 1.9,
        piercing: true,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX + 8,
        y: originY + 4,
        velocityX: 730,
        velocityY: 0,
        damage: baseDmg * 1.15,
        hitRadius: 10,
        scale: 1.9,
        piercing: true,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX,
        y: originY - 14,
        velocityX: 660,
        velocityY: -60,
        damage: baseDmg * 0.7,
        hitRadius: 8,
        scale: 1.5,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX,
        y: originY + 14,
        velocityX: 660,
        velocityY: 60,
        damage: baseDmg * 0.7,
        hitRadius: 8,
        scale: 1.5,
      },
    ];
  }

  // HARLAN (KNUCKLE): Canhão cinético pesado
  if (level === 1) {
    return [{
      texture: 'shot-knuckle',
      animation: 'shot-knuckle-loop',
      x: originX,
      y: originY,
      velocityX: 490,
      velocityY: 0,
      damage: baseDmg,
      hitRadius: 12,
      scale: 1.8,
    }];
  }
  if (level === 2) {
    return [
      {
        texture: 'shot-knuckle',
        animation: 'shot-knuckle-loop',
        x: originX,
        y: originY - 8,
        velocityX: 505,
        velocityY: 0,
        damage: baseDmg * 0.95,
        hitRadius: 13,
        scale: 1.9,
      },
      {
        texture: 'shot-knuckle',
        animation: 'shot-knuckle-loop',
        x: originX,
        y: originY + 8,
        velocityX: 505,
        velocityY: 0,
        damage: baseDmg * 0.95,
        hitRadius: 13,
        scale: 1.9,
      },
    ];
  }
  // Level 3: Disparo triplo maciço de concussão
  return [
    {
      texture: 'shot-knuckle',
      animation: 'shot-knuckle-loop',
      x: originX,
      y: originY - 14,
      velocityX: 480,
      velocityY: -40,
      damage: baseDmg * 0.85,
      hitRadius: 14,
      scale: 1.9,
    },
    {
      texture: 'shot-knuckle',
      animation: 'shot-knuckle-loop',
      x: originX + 10,
      y: originY,
      velocityX: 530,
      velocityY: 0,
      damage: baseDmg * 1.35,
      hitRadius: 17,
      scale: 2.2,
      piercing: true,
    },
    {
      texture: 'shot-knuckle',
      animation: 'shot-knuckle-loop',
      x: originX,
      y: originY + 14,
      velocityX: 480,
      velocityY: 40,
      damage: baseDmg * 0.85,
      hitRadius: 14,
      scale: 1.9,
    },
  ];
}

/** Retorna definições de disparos carregados (Wave Cannon) de acordo com o nível de carga */
export function getChargedProjectiles(
  pilotId: PilotId,
  chargeLevel: 1 | 2,
  originX: number,
  originY: number,
): ProjectileSpawnDef[] {
  if (pilotId === 'nolan') {
    // Nolan: Carga de Feixe Penetrante (Rivet V3)
    if (chargeLevel === 1) {
      return [{
        texture: 'rivet-v3-pulse-3',
        animation: 'rivet-v3-pulse-3-anim',
        x: originX + 12,
        y: originY,
        velocityX: 720,
        velocityY: 0,
        damage: 4.8,
        hitRadius: 15,
        scale: 0.9,
        piercing: true,
      }];
    }
    // Carga Máxima (Level 2): Mega Feixe Penetrante Prismático
    return [{
      texture: 'rivet-v3-prism',
      animation: 'rivet-v3-prism-anim',
      x: originX + 24,
      y: originY,
      velocityX: 880,
      velocityY: 0,
      damage: 8.5,
      hitRadius: 22,
      scale: 1.05,
      piercing: true,
    }];
  }

  if (pilotId === 'cora') {
    // Cora: Sobrecarga de Agulhas Perfurantes e ventilação de calor
    if (chargeLevel === 1) {
      return [
        {
          texture: 'shot-moth',
          animation: 'shot-moth-loop',
          x: originX + 8,
          y: originY - 8,
          velocityX: 750,
          velocityY: -90,
          damage: 3.2,
          hitRadius: 10,
          scale: 1.8,
          piercing: true,
        },
        {
          texture: 'shot-moth',
          animation: 'shot-moth-loop',
          x: originX + 12,
          y: originY,
          velocityX: 770,
          velocityY: 0,
          damage: 3.6,
          hitRadius: 10,
          scale: 1.9,
          piercing: true,
        },
        {
          texture: 'shot-moth',
          animation: 'shot-moth-loop',
          x: originX + 8,
          y: originY + 8,
          velocityX: 750,
          velocityY: 90,
          damage: 3.2,
          hitRadius: 10,
          scale: 1.8,
          piercing: true,
        },
      ];
    }
    // Carga Máxima (Level 2): Leque de 5 agulhas hiper-velozes perfurantes
    return [
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX,
        y: originY - 14,
        velocityX: 800,
        velocityY: -180,
        damage: 4.2,
        hitRadius: 11,
        scale: 2.0,
        piercing: true,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX + 8,
        y: originY - 7,
        velocityX: 820,
        velocityY: -90,
        damage: 4.2,
        hitRadius: 11,
        scale: 2.0,
        piercing: true,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX + 16,
        y: originY,
        velocityX: 850,
        velocityY: 0,
        damage: 5.2,
        hitRadius: 12,
        scale: 2.2,
        piercing: true,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX + 8,
        y: originY + 7,
        velocityX: 820,
        velocityY: 90,
        damage: 4.2,
        hitRadius: 11,
        scale: 2.0,
        piercing: true,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX,
        y: originY + 14,
        velocityX: 800,
        velocityY: 180,
        damage: 4.2,
        hitRadius: 11,
        scale: 2.0,
        piercing: true,
      },
    ];
  }

  // Harlan: Mega-Canhão Cinético de Sobrecarga (Knuckle V2)
  if (chargeLevel === 1) {
    return [{
      texture: 'shot-knuckle',
      animation: 'shot-knuckle-loop',
      x: originX + 10,
      y: originY,
      velocityX: 480,
      velocityY: 0,
      damage: 6.5,
      hitRadius: 20,
      scale: 2.2,
      piercing: true,
    }];
  }
  // Carga Máxima (Level 2): Projétil colossal de concussão
  return [{
    texture: 'shot-knuckle',
    animation: 'shot-knuckle-loop',
    x: originX + 16,
    y: originY,
    velocityX: 520,
    velocityY: 0,
    damage: 12.0,
    hitRadius: 30,
    scale: 3.0,
    piercing: true,
  }];
}

/** Retorna definições de armas secundárias / mísseis da nave. */
export function getSecondaryProjectiles(
  pilotId: PilotId,
  originX: number,
  originY: number,
): ProjectileSpawnDef[] {
  if (pilotId === 'nolan') {
    // Míssil perfurante guiado da Rivet
    return [{
      texture: 'rivet-v3-missile',
      animation: 'rivet-v3-missile-anim',
      x: originX + 25,
      y: originY - 18,
      velocityX: 420,
      velocityY: -25,
      damage: 3.2,
      hitRadius: 18,
      scale: 0.72,
    }];
  }
  if (pilotId === 'cora') {
    // Feixes auxiliares da Moth
    return [
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX + 10,
        y: originY - 18,
        velocityX: 560,
        velocityY: -75,
        damage: 1.5,
        hitRadius: 9,
        scale: 1.4,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX + 10,
        y: originY + 18,
        velocityX: 560,
        velocityY: 75,
        damage: 1.5,
        hitRadius: 9,
        scale: 1.4,
      },
    ];
  }
  // Harlan (Knuckle): Foguete pesado de impacto
  return [{
    texture: 'shot-knuckle',
    animation: 'shot-knuckle-loop',
    x: originX + 20,
    y: originY,
    velocityX: 380,
    velocityY: 0,
    damage: 4.8,
    hitRadius: 22,
    scale: 2.3,
  }];
}
