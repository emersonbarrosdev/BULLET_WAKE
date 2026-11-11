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
export type ClassicWeaponLevel = 1 | 2 | 3 | 4;
export type WeaponLevel = ClassicWeaponLevel | 5;
export type SpecialType = 'scarlet' | 'phantom' | 'nova' | 'orbital' | 'comet';

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
  homing?: boolean;
  /** Amplitude em pixels para oscilação senoidal do Raio Esmeralda */
  waveAmplitude?: number;
  /** Frequência em rad/ms para oscilação senoidal do Raio Esmeralda */
  waveFrequency?: number;
  /** Fase inicial em radianos da onda */
  wavePhase?: number;
  waveVerticalAmplitude?: number;
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
  specialCharges: number;
  hasShield: boolean;
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
/** RIVET has five stages; nine scheduled P still reach FULL without extra carriers. */
export function maxWeaponLevel(pilotId:string):WeaponLevel { return pilotId==='nolan'?5:4; }
export function powerItemsForNextLevel(pilotId:string,level:WeaponLevel):number { return pilotId==='nolan'&&level<4?2:3; }
export function powerProgress(pilotId:string,level:WeaponLevel,meter=0):number {
  let n=meter;for(let i=1;i<level;i++)n+=powerItemsForNextLevel(pilotId,i as WeaponLevel);return n;
}
export const MAX_SPECIAL_CHARGES = 5;
export const START_SPECIAL_CHARGES = 2;
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
    autoIntervalMs: 180,
    burstIntervalMs: 180,
    heatPerShot: 7,
    coolingRatePerSec: 45,
    displayName: 'ENERGIA ESPIRALADA',
  },
  ion: {
    autoIntervalMs: 160,
    burstIntervalMs: 160,
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
  nolan: { ...WEAPON_FAMILY_SPECS.ion, displayName: 'RAJADA ESCARLATE' },
  cora: WEAPON_FAMILY_SPECS.green,
  harlan: WEAPON_FAMILY_SPECS.red,
  green: WEAPON_FAMILY_SPECS.green,
  ion: WEAPON_FAMILY_SPECS.ion,
  red: WEAPON_FAMILY_SPECS.red,
};

export const SPECIAL_DURATIONS: Record<SpecialType, number> = {
  comet: 2400,
  orbital: 2400,
  scarlet: 3000, // Bayek: Tormenta Escarlate
  phantom: 2400, // Cora: Salto Fantasma
  nova: 2400,    // Harlan: Ruptura Nova
};

/** Each pilot owns one evolving primary weapon; families no longer form a cascade. */
export function pilotWeaponFamily(id: string): WeaponFamily {
  return id==='cora'?'green':id==='harlan'?'red':'ion';
}

export function createPlayerWeapons(pilotId: PilotId = 'nolan', initialFamily?: WeaponFamily): PlayerWeaponsState {
  const pilot = getPilot(pilotId);
  const specialType: SpecialType =
    pilot.id === 'bento' ? 'comet' : pilot.id === 'lyra' ? 'orbital' : pilot.id === 'cora' ? 'phantom' : pilot.id === 'harlan' ? 'nova' : 'scarlet';

  // Arma inicial canônica da Fase 1: TODOS os pilotos iniciam no Nível 1 com medidor P zerado.
  const family: WeaponFamily = initialFamily ?? pilotWeaponFamily(pilot.id);

  return {
    pilotId: pilot.id,
    weaponFamily: family,
    weaponLevel: 1,
    powerMeter: 0,
    speedLevel: 0,
    specialCharges: START_SPECIAL_CHARGES,
    hasShield: false,
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

/** Compatibility helpers for old saves/sandbox: no production capsule can swap a pilot's weapon. */
export function nextWeaponFamily(_family: WeaponFamily): WeaponFamily | null { return null; }
export function switchWeaponFamily(state: PlayerWeaponsState, _family: WeaponFamily): PlayerWeaponsState { return state; }
export function collectWeaponCapsule(state: PlayerWeaponsState, _family: WeaponFamily): {state:PlayerWeaponsState;bonusPoints:number} {
  return {state,bonusPoints:5000};
}
export function evolutionCargo(_state:PlayerWeaponsState): 'power' { return 'power'; }

export function collectSpeedItem(state: PlayerWeaponsState): PlayerWeaponsState {
  return { ...state, speedLevel: Math.min(3, state.speedLevel + 1) };
}

/** Coleta 1 item P: a cada 3 itens P completos, aumenta 1 nível de potência (até o Nível 4) */
export function collectPowerItem(state: PlayerWeaponsState): {
  state: PlayerWeaponsState;
  meterIncreased: boolean;
  levelIncreased: boolean;
} {
  if (state.weaponLevel >= maxWeaponLevel(state.pilotId)) {
    return {
      state,
      meterIncreased: false,
      levelIncreased: false,
    };
  }

  const nextMeter = state.powerMeter + 1;
  if (nextMeter >= powerItemsForNextLevel(state.pilotId,state.weaponLevel)) {
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
  if (state.weaponLevel >= maxWeaponLevel(state.pilotId)) {
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
  const alreadyMax = state.weaponLevel >= maxWeaponLevel(state.pilotId);
  return {
    state: {
      ...state,
      weaponLevel: maxWeaponLevel(state.pilotId),
      powerMeter: POWER_ITEMS_PER_LEVEL,
    },
    upgradedToMax: !alreadyMax,
  };
}

export function collectSpecialCharge(state: PlayerWeaponsState): PlayerWeaponsState {
  return { ...state, specialCharges: Math.min(MAX_SPECIAL_CHARGES, state.specialCharges + 1) };
}

export function canActivateSpecial(state: PlayerWeaponsState): boolean {
  return state.specialCharges > 0 && state.specialActiveMs <= 0;
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
      specialCharges: state.specialCharges - 1,
      specialActiveMs: state.specialDurationMs,
    },
    activated: true,
  };
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
    weaponFamily: pilotWeaponFamily(state.pilotId),
    weaponLevel: 1,
    powerMeter: 0,
    speedLevel: 0,
    hasShield: false,
    specialActiveMs: 0,
    missileCooldownMs: 0,
    fireCooldownMs: 0,
    heat: 0,
    isOverheated: false,
    overheatCooldownMs: 0,
    chargeMs: 0,
    isCharging: false,
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
  const family:WeaponFamily=overrideFamily??(familyOrPilot==='ion'||familyOrPilot==='green'||familyOrPilot==='red'?familyOrPilot:pilotWeaponFamily(familyOrPilot));

  if(familyOrPilot==='nolan'&&family==='ion'){
    const lanes=level===1?[[0,0]]:level===2?[[-3,0],[3,0]]:level===3?[[0,-14],[0,0],[0,14]]:level===4?[[-3,-18],[3,-18],[-3,0],[3,0],[-3,18],[3,18]]:[[0,-24],[0,-16],[0,-8],[0,0],[0,8],[0,16],[0,24]];
    return lanes.map(([x,angle])=>({texture:'shot-moth',animation:'shot-moth-loop',x:originX+x,y:originY,
      velocityX:640*Math.sin(angle*Math.PI/180),velocityY:-640*Math.cos(angle*Math.PI/180),
      damage:level===1?2.35:level===2?1.65:level===3?1.8:level===4?1.35:1.5,hitRadius:2.5,scale:1}));
  }

  // Paired, phase-shifted wave components form the forward Shark Beam.
  // World-unit timings are Bullet Wake calibration, not claimed ROM constants.
  if (family === 'green') {
    const components = level * 2;
    return Array.from({length:components},(_,i)=>({
      texture:'shot-rivet', animation:'shot-rivet-loop',
      x:originX, y:originY, velocityX:0, velocityY:-460,
      damage:1.6, hitRadius:4, scale:1,
      waveAmplitude:16+level*8, waveVerticalAmplitude:9+level*5,
      waveFrequency:.014, wavePhase:i*Math.PI*2/components,
    }));
  }

  // 2. ARMA AZUL: DISPERSÃO AZUL (Wide Shot — começa estreita e modesta no Nível 1 e abre o leque até o Nível 4)
  if (family === 'ion') {
    const tex = 'shot-moth';
    const anim = 'shot-moth-loop';

    if (level === 1) {
      // Nível 1: 3 direções frontais estreitas e discretas (tiro inicial contido)
      const vxs = [-12,0,12].map(a=>640*Math.sin(a*Math.PI/180));
      return vxs.map((vx) => ({
        texture: tex,
        animation: anim,
        x: originX,
        y: originY,
        velocityX: vx,
        velocityY: -Math.sqrt(640*640-vx*vx),
        damage: 0.95,
        hitRadius: 2.5,
        scale: 0.95,
      }));
    }
    if (level === 2) {
      // Nível 2: 5 direções em leque médio
      const vxs = [-27,-13.5,0,13.5,27].map(a=>640*Math.sin(a*Math.PI/180));
      return vxs.map((vx) => ({
        texture: tex,
        animation: anim,
        x: originX,
        y: originY,
        velocityX: vx,
        velocityY: -Math.sqrt(640*640-vx*vx),
        damage: 1.0,
        hitRadius: 2.5,
        scale: 1.12,
      }));
    }
    if (level === 3) {
      // Nível 3: 9 direções em leque aberto
      const vxs = [-48,-36,-24,-12,0,12,24,36,48].map(a=>640*Math.sin(a*Math.PI/180));
      return vxs.map((vx, i) => ({
        texture: tex,
        animation: anim,
        x: originX,
        y: originY,
        velocityX: vx,
        velocityY: -Math.sqrt(640*640-vx*vx),
        damage: i === 4 ? 1.12 : 1.02,
        hitRadius: 2.5,
        scale: 1.30,
      }));
    }
    // Nível 4: 16 direções de cobertura total do corredor
    const vxsLv4 = Array.from({length:16},(_,i)=>640*Math.sin((-75+i*10)*Math.PI/180));
    return vxsLv4.map((vx) => ({
      texture: tex,
      animation: anim,
      x: originX,
      y: originY,
      velocityX: vx,
      velocityY: -Math.sqrt(640*640-vx*vx),
      damage: 0.95,
      hitRadius: 2.5,
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
  // Nível 4 — Laser Rubro Máximo: 4 feixes contínuos sincronizados com varredura lateral ampla
  return [
    { ox: -8, vx: 0, dmg: 1.25 },
    { ox: 8, vx: 0, dmg: 1.25 },
    { ox: -18, vx: -130, dmg: 1.0 },
    { ox: 18, vx: 130, dmg: 1.0 },
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
  level:WeaponLevel=3,
): ProjectileSpawnDef[] {
  if (pilotId === 'nolan') {
    return (level===5?[-1,0,1]:[-1,1]).map(side=>({texture:'rivet-v3-missile',animation:'rivet-v3-missile-loop',x:originX+side*9,y:originY-4,velocityX:side*28,velocityY:-400,damage:3.2,hitRadius:3,scale:.65,homing:level===5}));
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
