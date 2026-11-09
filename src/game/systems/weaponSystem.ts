/**
 * BULLET WAKE V2 — Sistema Canônico de Armamentos (Inspirado em Fire Shark / Toaplan)
 *
 * Três famílias distintas com identidade visual e mecânica real (Níveis 1 a 4):
 * - VERDE (Raio Esmeralda): Feixes energéticos ondulantes concentrados com aumento de ondas e potência.
 * - AZUL (Dispersão Azul): Tiros em leque crescente com mais direções conforme o nível aumenta.
 * - VERMELHO (Laser Rubro): Feixes energéticos vermelhos contínuos com multiplicação (1, 2, 4, 6 feixes)
 *   e varredura lateral sincronizada nos níveis avançados (gerenciado em tempo real por CrimsonLaserSystem).
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
  /** Amplitude em pixels para oscilação senoidal do Raio Esmeralda */
  waveAmplitude?: number;
  /** Frequência em rad/ms para oscilação senoidal do Raio Esmeralda */
  waveFrequency?: number;
  /** Fase inicial em radianos da onda */
  wavePhase?: number;
  /** Indica descritor de feixe contínuo (Laser Rubro) */
  isContinuousBeam?: boolean;
}

export interface PlayerWeaponsState {
  pilotId: PilotId;
  weaponFamily: WeaponFamily;
  weaponLevel: WeaponLevel;
  /** Medidor de potência P (0 a 3): 3 itens P aumentam 1 nível de arma */
  powerMeter: number;
  speedLevel: number;
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
export const POWER_ITEMS_PER_LEVEL = 3;
export const MAX_BOMBS = 10;
export const START_BOMBS = 3;
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
    autoIntervalMs: 240,
    burstIntervalMs: 240,
    heatPerShot: 7,
    coolingRatePerSec: 45,
    displayName: 'ENERGIA ESPIRALADA',
  },
  ion: {
    autoIntervalMs: 220,
    burstIntervalMs: 220,
    heatPerShot: 8,
    coolingRatePerSec: 50,
    displayName: 'DISPERSÃO AZUL',
  },
  red: {
    autoIntervalMs: 60,
    burstIntervalMs: 60,
    heatPerShot: 0, // O Laser Rubro contínuo nunca é interrompido arbitrariamente por calor
    coolingRatePerSec: 65,
    displayName: 'LASER RUBRO',
  },
};

export const PILOT_WEAPON_SPECS: Record<string, WeaponSpecs> = {
  nolan: WEAPON_FAMILY_SPECS.ion,
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

export function createPlayerWeapons(pilotId: PilotId = 'nolan', initialFamily: WeaponFamily = 'ion'): PlayerWeaponsState {
  const pilot = getPilot(pilotId);
  const specialType: SpecialType =
    pilot.id === 'cora' ? 'phantom' : pilot.id === 'harlan' ? 'nova' : 'prism';

  // Arma inicial canônica da Fase 1: TODOS os pilotos iniciam no Nível 1 com medidor P zerado.
  const family: WeaponFamily = initialFamily;

  return {
    pilotId: pilot.id,
    weaponFamily: family,
    weaponLevel: 1,
    powerMeter: 0,
    speedLevel: 0,
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

/** Troca a família de arma (Verde, Azul/Íon, Laser Rubro) mantendo o nível e o medidor P atuais */
export function switchWeaponFamily(state: PlayerWeaponsState, newFamily: WeaponFamily): PlayerWeaponsState {
  return {
    ...state,
    weaponFamily: newFamily,
    isOverheated: newFamily === 'red' ? false : state.isOverheated,
    heat: newFamily === 'red' ? 0 : state.heat,
  };
}

/** Colored capsules select a weapon; duplicates award points, never power. */
export function collectWeaponCapsule(state: PlayerWeaponsState, family: WeaponFamily): {
  state: PlayerWeaponsState; bonusPoints: number;
} {
  return state.weaponFamily === family
    ? { state, bonusPoints: 5000 }
    : { state: switchWeaponFamily(state, family), bonusPoints: 0 };
}

export function collectSpeedItem(state: PlayerWeaponsState): PlayerWeaponsState {
  return { ...state, speedLevel: Math.min(3, state.speedLevel + 1) };
}

/** Coleta 1 item P: a cada 3 itens P completos, aumenta 1 nível de potência (até o Nível 4) */
export function collectPowerItem(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  meterIncreased: boolean;
  levelIncreased: boolean;
} {
  if (state.weaponLevel >= MAX_WEAPON_LEVEL) {
    return {
      state: { ...state, powerMeter: Math.min(POWER_ITEMS_PER_LEVEL, state.powerMeter + 1) },
      meterIncreased: state.powerMeter < POWER_ITEMS_PER_LEVEL,
      levelIncreased: false,
    };
  }

  const nextMeter = state.powerMeter + 1;
  if (nextMeter >= POWER_ITEMS_PER_LEVEL) {
    const nextLevel = (state.weaponLevel + 1) as WeaponLevel;
    return {
      state: {
        ...state,
        weaponLevel: nextLevel,
        powerMeter: 0,
      },
      meterIncreased: true,
      levelIncreased: true,
    };
  }

  return {
    state: {
      ...state,
      powerMeter: nextMeter,
    },
    meterIncreased: true,
    levelIncreased: false,
  };
}

/** Evolui diretamente 1 nível da arma equipada (1 a 4) */
export function upgradeWeapon(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  upgraded: boolean;
} {
  if (state.weaponLevel >= MAX_WEAPON_LEVEL) {
    return { state, upgraded: false };
  }
  const nextLevel = (state.weaponLevel + 1) as WeaponLevel;
  return {
    state: {
      ...state,
      weaponLevel: nextLevel,
      powerMeter: 0,
    },
    upgraded: true,
  };
}

/** Item P Vermelho Raro (P★ Full Power): eleva a arma equipada diretamente à Potência Máxima (Nível 4) sem trocar a família da arma */
export function collectFullPowerItem(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  upgradedToMax: boolean;
} {
  const alreadyMax = state.weaponLevel >= MAX_WEAPON_LEVEL;
  return {
    state: {
      ...state,
      weaponLevel: MAX_WEAPON_LEVEL,
      powerMeter: POWER_ITEMS_PER_LEVEL,
    },
    upgradedToMax: !alreadyMax,
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
  const reserveReady = state.weaponLevel === MAX_WEAPON_LEVEL && state.powerMeter === POWER_ITEMS_PER_LEVEL;
  return {
    ...state,
    weaponFamily: 'ion',
    weaponLevel: reserveReady ? 2 : 1,
    powerMeter: reserveReady ? 0 : state.powerMeter,
    speedLevel: 0,
    bombs: START_BOMBS,
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

  // 1. ARMA VERDE: ENERGIA ESPIRALADA (Feixes de energia ondulantes/espiralados concentrados LV1-4)
  if (family === 'green') {
    const tex = 'shot-rivet';
    const anim = 'shot-rivet-loop';

    if (level === 1) {
      // Nível 1: 2 filamentos esmeralda finos e próximos (baixa amplitude = 8px)
      return [
        {
          texture: tex,
          animation: anim,
          x: originX - 3,
          y: originY,
          velocityX: 0,
          velocityY: -640,
          damage: 1.05,
          hitRadius: 6,
          scale: 0.95,
          waveAmplitude: 8,
          waveFrequency: 0.019,
          wavePhase: 0,
        },
        {
          texture: tex,
          animation: anim,
          x: originX + 3,
          y: originY,
          velocityX: 0,
          velocityY: -640,
          damage: 1.05,
          hitRadius: 6,
          scale: 0.95,
          waveAmplitude: 8,
          waveFrequency: 0.019,
          wavePhase: Math.PI,
        },
      ];
    }
    if (level === 2) {
      // Nível 2: 3 ondas esmeralda concentradas (eixo central + dupla hélice lateral média = 14px)
      return [
        {
          texture: tex,
          animation: anim,
          x: originX,
          y: originY - 2,
          velocityX: 0,
          velocityY: -660,
          damage: 1.2,
          hitRadius: 7,
          scale: 1.15,
          waveAmplitude: 7,
          waveFrequency: 0.02,
          wavePhase: Math.PI * 0.5,
        },
        {
          texture: tex,
          animation: anim,
          x: originX - 7,
          y: originY,
          velocityX: -18,
          velocityY: -655,
          damage: 1.1,
          hitRadius: 7,
          scale: 1.12,
          waveAmplitude: 14,
          waveFrequency: 0.019,
          wavePhase: 0,
        },
        {
          texture: tex,
          animation: anim,
          x: originX + 7,
          y: originY,
          velocityX: 18,
          velocityY: -655,
          damage: 1.1,
          hitRadius: 7,
          scale: 1.12,
          waveAmplitude: 14,
          waveFrequency: 0.019,
          wavePhase: Math.PI,
        },
      ];
    }
    if (level === 3) {
      // Nível 3: 5 ondas esmeralda espiraladas (amplitude 21px, soma de dano ~6.0 para compatibilidade tática)
      const offsets = [-13, -6, 0, 6, 13];
      const vxs = [-46, -22, 0, 22, 46];
      const amps = [21, 15, 8, 15, 21];
      return offsets.map((ox, i) => ({
        texture: tex,
        animation: anim,
        x: originX + ox,
        y: originY - (i === 2 ? 3 : 0),
        velocityX: vxs[i],
        velocityY: -680,
        damage: i === 2 ? 1.32 : 1.18,
        hitRadius: 8,
        scale: 1.35,
        waveAmplitude: amps[i],
        waveFrequency: 0.02,
        wavePhase: (i * Math.PI) / 2,
      }));
    }
    // Nível 4: 7 ondas esmeralda espiraladas em vórtice helicoidal de saturação concentrada
    const offsetsLv4 = [-20, -13, -6, 0, 6, 13, 20];
    const vxsLv4 = [-78, -50, -24, 0, 24, 50, 78];
    const ampsLv4 = [29, 23, 16, 9, 16, 23, 29];
    return offsetsLv4.map((ox, i) => ({
      texture: tex,
      animation: anim,
      x: originX + ox,
      y: originY - (i === 3 ? 4 : 0),
      velocityX: vxsLv4[i],
      velocityY: -700,
      damage: i === 3 ? 1.45 : 1.25,
      hitRadius: 9,
      scale: 1.55,
      waveAmplitude: ampsLv4[i],
      waveFrequency: 0.021,
      wavePhase: (i * Math.PI) / 3,
    }));
  }

  // 2. ARMA AZUL: DISPERSÃO AZUL (Wide Shot — começa estreita e modesta no Nível 1 e abre o leque até o Nível 4)
  if (family === 'ion') {
    const tex = 'shot-moth';
    const anim = 'shot-moth-loop';

    if (level === 1) {
      // Nível 1: 3 direções frontais estreitas e discretas (tiro inicial contido)
      const vxs = [-72, 0, 72];
      return vxs.map((vx, i) => ({
        texture: tex,
        animation: anim,
        x: originX + (i - 1) * 4,
        y: originY - (i === 1 ? 2 : 0),
        velocityX: vx,
        velocityY: -720,
        damage: 0.95,
        hitRadius: 6,
        scale: 0.95,
      }));
    }
    if (level === 2) {
      // Nível 2: 5 direções em leque médio
      const vxs = [-156, -78, 0, 78, 156];
      return vxs.map((vx, i) => ({
        texture: tex,
        animation: anim,
        x: originX + (i - 2) * 3.5,
        y: originY - (i === 2 ? 3 : 0),
        velocityX: vx,
        velocityY: -745,
        damage: 1.0,
        hitRadius: 7,
        scale: 1.12,
      }));
    }
    if (level === 3) {
      // Nível 3: 7 direções em leque aberto
      const vxs = [-246, -164, -82, 0, 82, 164, 246];
      return vxs.map((vx, i) => ({
        texture: tex,
        animation: anim,
        x: originX + (i - 3) * 3.5,
        y: originY - (i === 3 ? 4 : 0),
        velocityX: vx,
        velocityY: -765,
        damage: i === 3 ? 1.12 : 1.02,
        hitRadius: 8,
        scale: 1.30,
      }));
    }
    // Nível 4: 9 direções de cobertura total do corredor
    const vxsLv4 = [-336, -252, -168, -84, 0, 84, 168, 252, 336];
    return vxsLv4.map((vx, i) => ({
      texture: tex,
      animation: anim,
      x: originX + (i - 4) * 3.5,
      y: originY - (i === 4 ? 5 : 0),
      velocityX: vx,
      velocityY: -785,
      damage: i === 4 ? 1.22 : 1.08,
      hitRadius: 8,
      scale: 1.48,
    }));
  }

  // 3. ARMA VERMELHA: LASER RUBRO (Continuous Crimson Energy Multi-Beam — Fire Shark Super Fire style)
  // Nota: Em gameplay real, o Laser Rubro é emitido continuamente por `crimsonLaserSystem.ts`
  // enquanto SPACE estiver pressionado, NUNCA instanciando bolas/projéteis vermelhos avulsos.
  // Os descritores abaixo representam os feixes contínuos de cada nível (1, 2, 4, 6 feixes) para inspeção e testes.
  const texRed = 'shot-knuckle';
  const animRed = 'shot-knuckle-loop';

  if (level === 1) {
    // Nível 1 — Laser Rubro Inicial: 1 feixe frontal contínuo
    return [
      {
        texture: texRed,
        animation: animRed,
        x: originX,
        y: originY,
        velocityX: 0,
        velocityY: -1200,
        damage: 1.35,
        hitRadius: 11,
        scale: 1.6,
        piercing: true,
        isContinuousBeam: true,
      },
    ];
  }
  if (level === 2) {
    // Nível 2 — Laser Rubro Duplo: 2 feixes frontais paralelos contínuos
    return [-9, 9].map((ox) => ({
      texture: texRed,
      animation: animRed,
      x: originX + ox,
      y: originY,
      velocityX: 0,
      velocityY: -1200,
      damage: 1.15,
      hitRadius: 12,
      scale: 1.75,
      piercing: true,
      isContinuousBeam: true,
    }));
  }
  if (level === 3) {
    // Nível 3 — Laser Rubro Expandido: 2 feixes centrais + 2 feixes laterais com varredura oscilante (4 feixes)
    return [
      { ox: -8, vx: 0, dmg: 1.15 },
      { ox: 8, vx: 0, dmg: 1.15 },
      { ox: -22, vx: -180, dmg: 0.95 },
      { ox: 22, vx: 180, dmg: 0.95 },
    ].map((b) => ({
      texture: texRed,
      animation: animRed,
      x: originX + b.ox,
      y: originY,
      velocityX: b.vx,
      velocityY: -1200,
      damage: b.dmg,
      hitRadius: 14,
      scale: 1.9,
      piercing: true,
      isContinuousBeam: true,
    }));
  }
  // Nível 4 — Laser Rubro Máximo: 6 feixes contínuos sincronizados com varredura lateral ampla
  return [
    { ox: -8, vx: 0, dmg: 1.25 },
    { ox: 8, vx: 0, dmg: 1.25 },
    { ox: -18, vx: -130, dmg: 1.0 },
    { ox: 18, vx: 130, dmg: 1.0 },
    { ox: -28, vx: -280, dmg: 1.05 },
    { ox: 28, vx: 280, dmg: 1.05 },
  ].map((b) => ({
    texture: texRed,
    animation: animRed,
    x: originX + b.ox,
    y: originY,
    velocityX: b.vx,
    velocityY: -1200,
    damage: b.dmg,
    hitRadius: 15,
    scale: 2.1,
    piercing: true,
    isContinuousBeam: true,
  }));
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
