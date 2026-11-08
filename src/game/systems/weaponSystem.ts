/**
 * BULLET WAKE V2 — Sistema Canônico de Armamentos (Estilo Fire Shark)
 * 
 * Três famílias distintas com identidade visual e evolução real (Níveis 1 a 4):
 * - Pulso Verde: Ampla cobertura em leque de energia esmeralda.
 * - Laser de Íons: Feixe ciano concentrado de alta penetração em blindagens pesadas.
 * - Plasma Vermelho: Dano pesado de impacto térmico concussivo e controle de área.
 */
import { getPilot, type PilotId } from '../data/pilots.ts';

export type WeaponFamily = 'green' | 'ion' | 'red';
export type WeaponLevel = 1 | 2 | 3 | 4;
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
  weaponFamily: WeaponFamily;
  weaponLevel: WeaponLevel;
  bombs: number;
  hasShield: boolean;
  resonance: number; // 0 a 100
  specialActiveMs: number;
  specialDurationMs: number;
  specialType: SpecialType;
  missileCooldownMs: number;
  fireCooldownMs: number;

  // Sistema de Calor e Sobreaquecimento
  heat: number;                 // 0 a 100
  isOverheated: boolean;        // Bloqueio temporário por sobreaquecimento
  overheatCooldownMs: number;   // Tempo restante de cooldown de sobreaquecimento

  // Sistema de Armas Carregáveis (Wave Cannon - C)
  chargeMs: number;             // Milissegundos acumulados de carga
  isCharging: boolean;          // Verdadeiro enquanto o jogador segura C
}

export const MAX_WEAPON_LEVEL: WeaponLevel = 4;
export const MAX_BOMBS = 4;
export const START_BOMBS = 2;
export const MAX_RESONANCE = 100;
export const MISSILE_COOLDOWN_MS = 1500;

export const MAX_HEAT = 100;
export const OVERHEAT_COOLDOWN_MS = 650;
export const MIN_CHARGE_MS = 400;
export const MAX_CHARGE_MS = 1400;
export const FULL_CHARGE_THRESHOLD_MS = 1100;

export interface WeaponSpecs {
  autoIntervalMs: number;
  burstIntervalMs: number;
  heatPerShot: number;
  coolingRatePerSec: number;
  displayName: string;
}

export const WEAPON_FAMILY_SPECS: Record<WeaponFamily, WeaponSpecs> = {
  green: {
    autoIntervalMs: 125,
    burstIntervalMs: 90,
    heatPerShot: 7,
    coolingRatePerSec: 45,
    displayName: 'PULSO VERDE',
  },
  ion: {
    autoIntervalMs: 140,
    burstIntervalMs: 100,
    heatPerShot: 8,
    coolingRatePerSec: 50,
    displayName: 'LASER DE ÍONS',
  },
  red: {
    autoIntervalMs: 185,
    burstIntervalMs: 135,
    heatPerShot: 13,
    coolingRatePerSec: 38,
    displayName: 'PLASMA VERMELHO',
  },
};

export const PILOT_WEAPON_SPECS: Record<string, WeaponSpecs> = {
  nolan: WEAPON_FAMILY_SPECS.green,
  cora: WEAPON_FAMILY_SPECS.ion,
  harlan: WEAPON_FAMILY_SPECS.red,
  green: WEAPON_FAMILY_SPECS.green,
  ion: WEAPON_FAMILY_SPECS.ion,
  red: WEAPON_FAMILY_SPECS.red,
};

export const SPECIAL_DURATIONS: Record<SpecialType, number> = {
  prism: 3800,  // Nolan: Tempestade Prismática
  phantom: 650, // Cora: Salto Fantasma
  nova: 900,    // Harlan: Ruptura Nova
};

export function createPlayerWeapons(pilotId: PilotId = 'nolan', initialFamily: WeaponFamily = 'green'): PlayerWeaponsState {
  const pilot = getPilot(pilotId);
  const specialType: SpecialType =
    pilot.id === 'cora' ? 'phantom' : pilot.id === 'harlan' ? 'nova' : 'prism';

  // Arma inicial associada ao piloto
  const family: WeaponFamily =
    pilot.id === 'cora' ? 'ion' : pilot.id === 'harlan' ? 'red' : initialFamily;

  return {
    pilotId: pilot.id,
    weaponFamily: family,
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

/** Troca a família de arma (Verde, Íon, Vermelho) mantendo o nível atual */
export function switchWeaponFamily(state: PlayerWeaponsState, newFamily: WeaponFamily): PlayerWeaponsState {
  return {
    ...state,
    weaponFamily: newFamily,
  };
}

/** Evolui o nível da arma equipada (1 a 4) */
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
  const specs = WEAPON_FAMILY_SPECS[state.weaponFamily] || WEAPON_FAMILY_SPECS.green;

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
    resonance: Math.floor(state.resonance * 0.5),
  };
}

/** Registra disparo primário e computa calor gerado */
export function recordPrimaryShot(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  overheatedNow: boolean;
} {
  const specs = WEAPON_FAMILY_SPECS[state.weaponFamily] || WEAPON_FAMILY_SPECS.green;
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

/** Atualiza tempo de carga enquanto segura C */
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

/** Libera carga acumulada */
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

  // Cora sob carga máxima ventila 100% do calor
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

/**
 * Retorna definições de projéteis principais em visão superior (top-down vertical, subindo para -Y).
 * Suporta as 3 famílias canônicas (Pulso Verde, Laser de Íons e Plasma Vermelho) nos 4 níveis.
 */
export function getPrimaryProjectiles(
  familyOrPilot: WeaponFamily | PilotId,
  level: WeaponLevel,
  originX: number,
  originY: number,
  overrideFamily?: WeaponFamily,
): ProjectileSpawnDef[] {
  // Resolução da família
  let family: WeaponFamily = 'green';
  if (overrideFamily) {
    family = overrideFamily;
  } else if (familyOrPilot === 'green' || familyOrPilot === 'ion' || familyOrPilot === 'red') {
    family = familyOrPilot;
  } else if (familyOrPilot === 'cora') {
    family = 'ion';
  } else if (familyOrPilot === 'harlan') {
    family = 'red';
  }

  // 1. ARMA A: PULSO VERDE (Green Pulse — Cobertura em leque crescente LV1-4)
  if (family === 'green') {
    const tex = 'shot-rivet';
    const anim = 'shot-rivet-loop';

    if (level === 1) {
      // Disparo duplo frontal paralelo
      return [
        {
          texture: tex,
          animation: anim,
          x: originX - 5,
          y: originY,
          velocityX: 0,
          velocityY: -620,
          damage: 1.1,
          hitRadius: 8,
          scale: 1.4,
        },
        {
          texture: tex,
          animation: anim,
          x: originX + 5,
          y: originY,
          velocityX: 0,
          velocityY: -620,
          damage: 1.1,
          hitRadius: 8,
          scale: 1.4,
        },
      ];
    }
    if (level === 2) {
      // 3 vias: centro reto e 2 diagonais suaves
      return [
        {
          texture: tex,
          animation: anim,
          x: originX,
          y: originY - 2,
          velocityX: 0,
          velocityY: -630,
          damage: 1.15,
          hitRadius: 8,
          scale: 1.45,
        },
        {
          texture: tex,
          animation: anim,
          x: originX - 8,
          y: originY,
          velocityX: -100,
          velocityY: -620,
          damage: 1.1,
          hitRadius: 8,
          scale: 1.4,
        },
        {
          texture: tex,
          animation: anim,
          x: originX + 8,
          y: originY,
          velocityX: 100,
          velocityY: -620,
          damage: 1.1,
          hitRadius: 8,
          scale: 1.4,
        },
      ];
    }
    if (level === 3) {
      // 5 vias em leque amplo
      const angles = [-200, -100, 0, 100, 200];
      return angles.map((vx, i) => ({
        texture: tex,
        animation: anim,
        x: originX + (i - 2) * 5,
        y: originY - (i === 2 ? 3 : 0),
        velocityX: vx,
        velocityY: -640,
        damage: i === 2 ? 1.25 : 1.15,
        hitRadius: 8,
        scale: 1.5,
      }));
    }
    // Nível 4: 7 vias para cobertura total do campo
    const anglesLv4 = [-280, -190, -95, 0, 95, 190, 280];
    return anglesLv4.map((vx, i) => ({
      texture: tex,
      animation: anim,
      x: originX + (i - 3) * 4,
      y: originY - (i === 3 ? 4 : 0),
      velocityX: vx,
      velocityY: -650,
      damage: i === 3 ? 1.35 : 1.2,
      hitRadius: 9,
      scale: 1.6,
    }));
  }

  // 2. ARMA B: LASER DE ÍONS (Ion Laser — Feixe ciano concentrado perfurante)
  if (family === 'ion') {
    const tex = 'shot-moth';
    const anim = 'shot-moth-loop';

    if (level === 1) {
      return [{
        texture: tex,
        animation: anim,
        x: originX,
        y: originY,
        velocityX: 0,
        velocityY: -760,
        damage: 2.0,
        hitRadius: 8,
        scale: 1.7,
        piercing: true,
      }];
    }
    if (level === 2) {
      return [
        {
          texture: tex,
          animation: anim,
          x: originX - 6,
          y: originY,
          velocityX: 0,
          velocityY: -780,
          damage: 1.8,
          hitRadius: 9,
          scale: 1.8,
          piercing: true,
        },
        {
          texture: tex,
          animation: anim,
          x: originX + 6,
          y: originY,
          velocityX: 0,
          velocityY: -780,
          damage: 1.8,
          hitRadius: 9,
          scale: 1.8,
          piercing: true,
        },
      ];
    }
    if (level === 3) {
      return [
        {
          texture: tex,
          animation: anim,
          x: originX,
          y: originY - 4,
          velocityX: 0,
          velocityY: -810,
          damage: 2.6,
          hitRadius: 10,
          scale: 2.0,
          piercing: true,
        },
        {
          texture: tex,
          animation: anim,
          x: originX - 10,
          y: originY,
          velocityX: -40,
          velocityY: -790,
          damage: 1.4,
          hitRadius: 8,
          scale: 1.6,
          piercing: true,
        },
        {
          texture: tex,
          animation: anim,
          x: originX + 10,
          y: originY,
          velocityX: 40,
          velocityY: -790,
          damage: 1.4,
          hitRadius: 8,
          scale: 1.6,
          piercing: true,
        },
      ];
    }
    // Nível 4: Coluna Iônica Devastadora (5 feixes de penetração massiva)
    return [
      {
        texture: tex,
        animation: anim,
        x: originX,
        y: originY - 6,
        velocityX: 0,
        velocityY: -840,
        damage: 3.5,
        hitRadius: 12,
        scale: 2.4,
        piercing: true,
      },
      {
        texture: tex,
        animation: anim,
        x: originX - 8,
        y: originY - 2,
        velocityX: -25,
        velocityY: -820,
        damage: 1.8,
        hitRadius: 9,
        scale: 1.8,
        piercing: true,
      },
      {
        texture: tex,
        animation: anim,
        x: originX + 8,
        y: originY - 2,
        velocityX: 25,
        velocityY: -820,
        damage: 1.8,
        hitRadius: 9,
        scale: 1.8,
        piercing: true,
      },
      {
        texture: tex,
        animation: anim,
        x: originX - 16,
        y: originY,
        velocityX: -60,
        velocityY: -800,
        damage: 1.5,
        hitRadius: 8,
        scale: 1.6,
        piercing: true,
      },
      {
        texture: tex,
        animation: anim,
        x: originX + 16,
        y: originY,
        velocityX: 60,
        velocityY: -800,
        damage: 1.5,
        hitRadius: 8,
        scale: 1.6,
        piercing: true,
      },
    ];
  }

  // 3. ARMA C: PLASMA VERMELHO (Red Plasma — Disparo pesado concussivo com impacto térmico)
  const texRed = 'shot-knuckle';
  const animRed = 'shot-knuckle-loop';

  if (level === 1) {
    return [{
      texture: texRed,
      animation: animRed,
      x: originX,
      y: originY,
      velocityX: 0,
      velocityY: -520,
      damage: 3.2,
      hitRadius: 16,
      scale: 1.7,
    }];
  }
  if (level === 2) {
    return [
      {
        texture: texRed,
        animation: animRed,
        x: originX - 9,
        y: originY,
        velocityX: -20,
        velocityY: -530,
        damage: 2.8,
        hitRadius: 17,
        scale: 1.8,
      },
      {
        texture: texRed,
        animation: animRed,
        x: originX + 9,
        y: originY,
        velocityX: 20,
        velocityY: -530,
        damage: 2.8,
        hitRadius: 17,
        scale: 1.8,
      },
    ];
  }
  if (level === 3) {
    return [
      {
        texture: texRed,
        animation: animRed,
        x: originX,
        y: originY - 4,
        velocityX: 0,
        velocityY: -550,
        damage: 3.8,
        hitRadius: 20,
        scale: 2.0,
      },
      {
        texture: texRed,
        animation: animRed,
        x: originX - 12,
        y: originY,
        velocityX: -60,
        velocityY: -530,
        damage: 2.5,
        hitRadius: 16,
        scale: 1.7,
      },
      {
        texture: texRed,
        animation: animRed,
        x: originX + 12,
        y: originY,
        velocityX: 60,
        velocityY: -530,
        damage: 2.5,
        hitRadius: 16,
        scale: 1.7,
      },
    ];
  }
  // Nível 4: Quádruplo Devastador de Plasma Concussivo
  return [
    {
      texture: texRed,
      animation: animRed,
      x: originX - 6,
      y: originY - 4,
      velocityX: -20,
      velocityY: -570,
      damage: 3.5,
      hitRadius: 22,
      scale: 2.1,
    },
    {
      texture: texRed,
      animation: animRed,
      x: originX + 6,
      y: originY - 4,
      velocityX: 20,
      velocityY: -570,
      damage: 3.5,
      hitRadius: 22,
      scale: 2.1,
    },
    {
      texture: texRed,
      animation: animRed,
      x: originX - 16,
      y: originY,
      velocityX: -80,
      velocityY: -540,
      damage: 2.8,
      hitRadius: 18,
      scale: 1.9,
    },
    {
      texture: texRed,
      animation: animRed,
      x: originX + 16,
      y: originY,
      velocityX: 80,
      velocityY: -540,
      damage: 2.8,
      hitRadius: 18,
      scale: 1.9,
    },
  ];
}

/** Retorna definições de armas carregáveis (Wave Cannon - tecla C) disparando para o norte (-Y) */
export function getChargedProjectiles(
  familyOrPilot: WeaponFamily | PilotId,
  chargeLevel: 1 | 2,
  originX: number,
  originY: number,
): ProjectileSpawnDef[] {
  let family: WeaponFamily = 'green';
  if (familyOrPilot === 'green' || familyOrPilot === 'ion' || familyOrPilot === 'red') {
    family = familyOrPilot;
  } else if (familyOrPilot === 'cora') {
    family = 'ion';
  } else if (familyOrPilot === 'harlan') {
    family = 'red';
  }

  if (family === 'green' || familyOrPilot === 'nolan') {
    if (chargeLevel === 1) {
      return [{
        texture: 'shot-rivet',
        animation: 'shot-rivet-loop',
        x: originX,
        y: originY - 6,
        velocityX: 0,
        velocityY: -740,
        damage: 4.8,
        hitRadius: 16,
        scale: 2.2,
        piercing: true,
      }];
    }
    // Carga Máxima: Mega Feixe Prismático
    return [{
      texture: 'rivet-v3-prism',
      animation: 'rivet-v3-prism-anim',
      x: originX,
      y: originY - 12,
      velocityX: 0,
      velocityY: -900,
      damage: 8.5,
      hitRadius: 24,
      scale: 1.2,
      piercing: true,
    }];
  }

  if (family === 'ion' || familyOrPilot === 'cora') {
    if (chargeLevel === 1) {
      return [
        {
          texture: 'shot-moth',
          animation: 'shot-moth-loop',
          x: originX - 8,
          y: originY,
          velocityX: -80,
          velocityY: -770,
          damage: 3.2,
          hitRadius: 10,
          scale: 1.8,
          piercing: true,
        },
        {
          texture: 'shot-moth',
          animation: 'shot-moth-loop',
          x: originX,
          y: originY - 4,
          velocityX: 0,
          velocityY: -800,
          damage: 3.6,
          hitRadius: 11,
          scale: 1.9,
          piercing: true,
        },
        {
          texture: 'shot-moth',
          animation: 'shot-moth-loop',
          x: originX + 8,
          y: originY,
          velocityX: 80,
          velocityY: -770,
          damage: 3.2,
          hitRadius: 10,
          scale: 1.8,
          piercing: true,
        },
      ];
    }
    // Carga Máxima: Leque de 5 agulhas hiper-velozes
    return [-160, -80, 0, 80, 160].map((vx, i) => ({
      texture: 'shot-moth',
      animation: 'shot-moth-loop',
      x: originX + (i - 2) * 8,
      y: originY - (i === 2 ? 8 : 0),
      velocityX: vx,
      velocityY: -860,
      damage: i === 2 ? 5.2 : 4.2,
      hitRadius: 12,
      scale: 2.2,
      piercing: true,
    }));
  }

  // Plasma Vermelho / Harlan
  if (chargeLevel === 1) {
    return [{
      texture: 'shot-knuckle',
      animation: 'shot-knuckle-loop',
      x: originX,
      y: originY - 6,
      velocityX: 0,
      velocityY: -500,
      damage: 6.5,
      hitRadius: 22,
      scale: 2.4,
      piercing: true,
    }];
  }
  return [{
    texture: 'shot-knuckle',
    animation: 'shot-knuckle-loop',
    x: originX,
    y: originY - 10,
    velocityX: 0,
    velocityY: -530,
    damage: 12.0,
    hitRadius: 32,
    scale: 3.2,
    piercing: true,
  }];
}

/** Retorna munição de mísseis secundários subindo para o norte */
export function getSecondaryProjectiles(
  pilotId: PilotId,
  originX: number,
  originY: number,
): ProjectileSpawnDef[] {
  if (pilotId === 'nolan') {
    return [{
      texture: 'rivet-v3-missile',
      animation: 'rivet-v3-missile-anim',
      x: originX,
      y: originY - 12,
      velocityX: 0,
      velocityY: -460,
      damage: 3.5,
      hitRadius: 18,
      scale: 0.8,
    }];
  }
  if (pilotId === 'cora') {
    return [
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX - 12,
        y: originY,
        velocityX: -70,
        velocityY: -560,
        damage: 1.6,
        hitRadius: 9,
        scale: 1.5,
      },
      {
        texture: 'shot-moth',
        animation: 'shot-moth-loop',
        x: originX + 12,
        y: originY,
        velocityX: 70,
        velocityY: -560,
        damage: 1.6,
        hitRadius: 9,
        scale: 1.5,
      },
    ];
  }
  return [{
    texture: 'shot-knuckle',
    animation: 'shot-knuckle-loop',
    x: originX,
    y: originY - 12,
    velocityX: 0,
    velocityY: -420,
    damage: 5.0,
    hitRadius: 22,
    scale: 2.4,
  }];
}
