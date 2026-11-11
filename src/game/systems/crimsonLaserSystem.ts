/**
 * BULLET WAKE — Sistema Canônico do LASER RUBRO (Estilo Fire Shark / Super Fire)
 *
 * Arquitetura modular desacoplada do motor de renderização e 100% independente de FPS:
 * 1. Controle de emissão (ativação contínua com ESPAÇO, fade-out curto ao soltar, sem corte por calor).
 * 2. Geometria dos feixes (1 feixe no LV1, 2 no LV2, 4 com varredura lateral no LV3, 4 no LV4).
 * 3. Animação contínua (pulsos energéticos ascendentes e oscilação harmônica dos feixes laterais).
 * 4. Colisões contínuas (intersecção segmento-círculo ao longo de toda a extensão de cada feixe).
 * 5. Aplicação de dano por intervalo fixo de tempo (acumulador determinístico independente de FPS).
 * 6. Progressão dos 4 níveis de potência.
 * 7. Efeitos de impacto nas coordenadas exatas de contato.
 */
import { GAME_HEIGHT, PLAYFIELD_X, PLAYFIELD_RIGHT } from '../constants.ts';
import type { WeaponLevel } from './weaponSystem.ts';

export type BeamRole = 'central' | 'inner-wave' | 'lateral-sweep';

export interface LaserPoint {
  x: number;
  y: number;
}

export interface LaserBeamGeometry {
  id: string;
  role: BeamRole;
  points: LaserPoint[];
  outerWidth: number;
  midWidth: number;
  coreWidth: number;
  dpsPerBeam: number;
}

export interface LaserImpactPoint {
  beamId: string;
  targetId: number | 'boss';
  x: number;
  y: number;
  intensity: number;
}

export interface LaserTargetCircle {
  id: number | 'boss';
  x: number;
  y: number;
  radius: number;
  stopsBeam?: boolean;
  /** Render integration supplies the actual animated silhouette, including holes. */
  contact?: (ax:number,ay:number,bx:number,by:number,radius:number)=>number|null;
}

export interface LaserDamageEvent {
  targetId: number | 'boss';
  damage: number;
  hitX: number;
  hitY: number;
}

export interface CrimsonLaserState {
  isEmitting: boolean;
  /** Intensidade visual e de emissão (0.0 a 1.0) para ativação rápida e encerramento curto ao soltar ESPAÇO */
  intensity: number;
  /** Fase acumulada em milissegundos para animação dos feixes e varredura lateral */
  phaseMs: number;
  /** Acumulador de tempo para ticks de dano independentes de FPS */
  damageTickAccumulatorMs: number;
  /** Nível atual do Laser Rubro (1 a 4) */
  level: WeaponLevel;
  /** Feixes calculados no frame atual */
  beams: LaserBeamGeometry[];
  /** Pontos de impacto ativos no frame atual */
  impacts: LaserImpactPoint[];
}

export interface LaserLevelSpec {
  level: WeaponLevel;
  title: string;
  beamCount: number;
  hasLateralSweep: boolean;
  hasRearCoverage: boolean;
  maxHorizontalSpreadPx: number;
  totalDps: number;
}

/** Intervalo fixo entre aplicações de dano contínuo (60ms = 16.67 ticks/s) */
export const LASER_DAMAGE_TICK_MS = 60;
/** Tempo de subida da emissão ao pressionar ESPAÇO */
export const LASER_RAMP_UP_MS = 35;
/** Tempo de encerramento visual curto ao soltar ESPAÇO */
export const LASER_DECAY_MS = 110;
/** Número de subdivisões por feixe para curvatura orgânica e colisão precisa */
export const LASER_SEGMENTS = 18;

export const LASER_RUBRO_SPECS: Record<WeaponLevel, LaserLevelSpec> = {
  1: {
    level: 1,
    title: 'FLUXO INICIAL',
    beamCount: 1,
    hasLateralSweep: false,
    hasRearCoverage: false,
    maxHorizontalSpreadPx: 10,
    totalDps: 8.5,
  },
  2: {
    level: 2,
    title: 'FLUXO DUPLO',
    beamCount: 2,
    hasLateralSweep: false,
    hasRearCoverage: false,
    maxHorizontalSpreadPx: 28,
    totalDps: 13,
  },
  3: {
    level: 3,
    title: 'EXPANSÃO LATERAL',
    beamCount: 4,
    hasLateralSweep: true,
    hasRearCoverage: false,
    maxHorizontalSpreadPx: 122,
    totalDps: 18,
  },
  4: {
    level: 4,
    title: 'ASAS DE ENERGIA',
    beamCount: 4,
    hasLateralSweep: true,
    hasRearCoverage: true,
    maxHorizontalSpreadPx: 220,
    totalDps: 24,
  },
};

export function createInitialCrimsonLaserState(level: WeaponLevel = 1): CrimsonLaserState {
  return {
    isEmitting: false,
    intensity: 0,
    phaseMs: 0,
    damageTickAccumulatorMs: 0,
    level,
    beams: [],
    impacts: [],
  };
}

function clampPlayfieldX(x: number): number {
  return Math.max(PLAYFIELD_X + 6, Math.min(PLAYFIELD_RIGHT - 6, x));
}

function clampPlayfieldY(y: number): number {
  return Math.max(0, Math.min(GAME_HEIGHT - 4, y));
}

/**
 * 2 & 6. Calcula a geometria contínua dos fluxos de plasma do Laser Rubro para os níveis 1, 2, 3 e 4.
 * Segue imediatamente as coordenadas (shipX, shipY) da nave.
 */
export function computeLaserBeams(
  shipX: number,
  shipY: number,
  level: WeaponLevel,
  phaseMs: number,
  intensity = 1,
  topLimitY = 0,
): LaserBeamGeometry[] {
  if (intensity <= 0.01) return [];

  const emitterY = shipY - 14;
  const spanY = Math.max(20, emitterY - topLimitY);
  const phaseSec = phaseMs / 1000;
  const scale = 0.68 + 0.32 * intensity;
  const beams: LaserBeamGeometry[] = [];

  const buildFrontalPolyline = (
    offsetFn: (t: number) => { dx: number; dy?: number },
    maxReachPx = spanY,
  ): LaserPoint[] => {
    const reach = Math.min(spanY, maxReachPx);
    const pts: LaserPoint[] = [];
    for (let i = 0; i <= LASER_SEGMENTS; i++) {
      const t = i / LASER_SEGMENTS;
      const { dx, dy = 0 } = offsetFn(t);
      pts.push({
        x: clampPlayfieldX(shipX + dx),
        y: clampPlayfieldY(emitterY - t * reach + dy),
      });
    }
    return pts;
  };

  if (level === 1) {
    // NÍVEL 1 — FLUXO INICIAL: 1 fluxo frontal contido (até o topo) de plasma rubro-alaranjado fino e pulsante
    beams.push({
      id: 'lv1-center',
      role: 'central',
      points: buildFrontalPolyline(
        (t) => ({
          dx:
            Math.sin(phaseSec * 16 - t * 9.5) * (2.2 * Math.sin(t * Math.PI)) +
            Math.cos(phaseSec * 23 - t * 14) * (0.9 * t),
        }),
        spanY,
      ),
      outerWidth: 6.4 * scale,
      midWidth: 3.8 * scale,
      coreWidth: 1.8 * scale,
      dpsPerBeam: LASER_RUBRO_SPECS[1].totalDps,
    });
    return beams;
  }

  if (level === 2) {
    // NÍVEL 2 — FLUXO DUPLO: 2 fluxos energéticos frontais (até o topo) com emissores separados e pulsação própria
    const perBeamDps = LASER_RUBRO_SPECS[2].totalDps / 2;
    for (const side of [-1, 1] as const) {
      const phaseOffset = side < 0 ? 0 : Math.PI * 0.85;
      beams.push({
        id: side < 0 ? 'lv2-left' : 'lv2-right',
        role: 'central',
        points: buildFrontalPolyline(
          (t) => ({
            dx:
              side * 10.5 +
              Math.sin(phaseSec * 16 - t * 9.0 + phaseOffset) * (2.6 * Math.sin(t * Math.PI)),
          }),
          spanY,
        ),
        outerWidth: 8.2 * scale,
        midWidth: 4.8 * scale,
        coreWidth: 2.2 * scale,
        dpsPerBeam: perBeamDps,
      });
    }
    return beams;
  }

  if (level === 3) {
    // NÍVEL 3 — EXPANSÃO LATERAL:
    // 2 fluxos principais (até o topo) + 2 ramificações laterais (~225px) que se abrem e retornam ciclicamente
    const centralDps = (LASER_RUBRO_SPECS[3].totalDps * 0.56) / 2;
    const lateralDps = (LASER_RUBRO_SPECS[3].totalDps * 0.44) / 2;

    for (const side of [-1, 1] as const) {
      const phaseOffset = side < 0 ? 0 : Math.PI;
      beams.push({
        id: side < 0 ? 'lv3-center-left' : 'lv3-center-right',
        role: 'central',
        points: buildFrontalPolyline(
          (t) => ({
            dx:
              side * 9.5 +
              Math.sin(phaseSec * 17 - t * 8.5 + phaseOffset) * (2.6 * Math.sin(t * Math.PI)),
          }),
          spanY,
        ),
        outerWidth: 9.6 * scale,
        midWidth: 5.5 * scale,
        coreWidth: 2.5 * scale,
        dpsPerBeam: centralDps,
      });
    }

    // Ramificações laterais com ciclo real de abertura e fechamento (0.0 -> 1.0 -> 0.0)
    const openCycle = 0.5 + 0.5 * Math.sin(phaseSec * 4.2);
    for (const side of [-1, 1] as const) {
      beams.push({
        id: side < 0 ? 'lv3-sweep-left' : 'lv3-sweep-right',
        role: 'lateral-sweep',
        points: buildFrontalPolyline(
          (t) => {
            const branchArch = Math.pow(t, 0.78) * (24 + openCycle * 82);
            const plasmaRipple = Math.sin(phaseSec * 14 - t * 8.0) * (3.8 * t);
            return {
              dx: side * (13 + branchArch + plasmaRipple),
              dy: t === 0 ? 6 : 0,
            };
          },
          spanY,
        ),
        outerWidth: 8.4 * scale,
        midWidth: 4.8 * scale,
        coreWidth: 2.1 * scale,
        dpsPerBeam: lateralDps,
      });
    }
    return beams;
  }

  // NÍVEL 4 — ASAS DE ENERGIA (Transformação Completa de Geometria):
  // - 2 fluxos principais frontais aprimorados (até o topo)
  // - 2 asas contínuas varrem frente, flancos e retaguarda ao longo do ciclo.
  // Quatro fluxos totais; geometria e DPS são calibração própria de Bullet Wake.
  const coreDps = (LASER_RUBRO_SPECS[4].totalDps * 0.44) / 2;
  const wingDps = (LASER_RUBRO_SPECS[4].totalDps * 0.56) / 2;

  const wingCycle = 0.5 + 0.5 * Math.sin(phaseSec * 4.0);

  for (const side of [-1, 1] as const) {
    const phaseOffset = side < 0 ? 0 : Math.PI;

    // 1. Par central aprimorado de alta intensidade
    beams.push({
      id: side < 0 ? 'lv4-core-left' : 'lv4-core-right',
      role: 'central',
      points: buildFrontalPolyline(
        (t) => ({
          dx:
            side * 9.5 +
            Math.sin(phaseSec * 18 - t * 9.0 + phaseOffset) * (3.2 * Math.sin(t * Math.PI)),
        }),
        spanY,
      ),
      outerWidth: 11.8 * scale,
      midWidth: 6.8 * scale,
      coreWidth: 3.1 * scale,
      dpsPerBeam: coreDps,
    });

    // 2. Grandes Asas de Energia Laterais (abertura e fechamento amplo em arco orgânico)
    beams.push({
      id: side < 0 ? 'lv4-wing-left' : 'lv4-wing-right',
      role: 'lateral-sweep',
      points: buildFrontalPolyline(
        (t) => {
          // Curva em forma de asa luminosa que abre amplamente na metade da coluna e varre o topo
          const wingCurve = Math.sin(t * Math.PI * 0.72) * (70 + wingCycle * 128);
          const plasmaWave = Math.sin(phaseSec * 15 - t * 7.5 + phaseOffset) * (5.5 * t);
          return {
            dx: side * (16 + wingCurve + plasmaWave),
            dy: t * spanY * (1.65 - wingCycle * 1.65) + Math.sin(t * Math.PI) * 14,
          };
        },
        spanY,
      ),
      outerWidth: 10.2 * scale,
      midWidth: 5.8 * scale,
      coreWidth: 2.5 * scale,
      dpsPerBeam: wingDps,
    });


  }

  return beams;
}

/** Distância mínima de um ponto (px, py) ao segmento AB, retornando também o ponto mais próximo */
function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { x: number; y: number; dist: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 1e-6) {
    return { x: ax, y: ay, dist: Math.hypot(px - ax, py - ay) };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
}

/**
 * 4. Avalia colisões contínuas dos feixes com todos os alvos circulares (inimigos e chefe).
 * Se um alvo tiver `stopsBeam: true` (ex.: casco principal de chefe/miniboss), trunca o feixe no impacto.
 */
function targetContact(target:LaserTargetCircle,a:LaserPoint,b:LaserPoint,radius:number):{x:number;y:number;dist:number} {
  if(!target.contact)return closestPointOnSegment(target.x,target.y,a.x,a.y,b.x,b.y);
  const t=target.contact(a.x,a.y,b.x,b.y,radius);
  return t===null?{x:a.x,y:a.y,dist:Infinity}:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,dist:0};
}

export function evaluateLaserCollisions(
  beams: LaserBeamGeometry[],
  targets: readonly LaserTargetCircle[],
  intensity: number,
): {
  clippedBeams: LaserBeamGeometry[];
  impacts: LaserImpactPoint[];
  hitDpsByTarget: Map<number | 'boss', { dps: number; hitX: number; hitY: number }>;
} {
  const impacts: LaserImpactPoint[] = [];
  const hitDpsByTarget = new Map<number | 'boss', { dps: number; hitX: number; hitY: number }>();
  const clippedBeams: LaserBeamGeometry[] = [];

  for (const beam of beams) {
    let pts = beam.points;
    const beamHitRadius = beam.midWidth * 0.65;

    // 1. Verifica se algum alvo bloqueador (ex.: boss/miniboss) intercepta este feixe primeiro
    for (const target of targets) {
      if (!target.stopsBeam) continue;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const cp = targetContact(target,a,b,beamHitRadius);
        if (cp.dist <= target.radius + beamHitRadius) {
          pts = [...pts.slice(0, i + 1), { x: cp.x, y: cp.y }];
          break;
        }
      }
    }

    clippedBeams.push({ ...beam, points: pts });

    // 2. Verifica todos os alvos atingidos pela extensão ativa do feixe
    for (const target of targets) {
      let bestHit: { x: number; y: number; dist: number } | null = null;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const cp = targetContact(target,a,b,beamHitRadius);
        if (cp.dist <= target.radius + beamHitRadius) {
          if (!bestHit || cp.dist < bestHit.dist) {
            bestHit = cp;
          }
        }
      }

      if (bestHit) {
        impacts.push({
          beamId: beam.id,
          targetId: target.id,
          x: bestHit.x,
          y: bestHit.y,
          intensity,
        });
        const prev = hitDpsByTarget.get(target.id);
        hitDpsByTarget.set(target.id, {
          dps: (prev?.dps || 0) + beam.dpsPerBeam,
          hitX: bestHit.x,
          hitY: bestHit.y,
        });
      }
    }
  }

  return { clippedBeams, impacts, hitDpsByTarget };
}

/**
 * 1, 3, 5 & 7. Atualiza o estado completo do Laser Rubro em um passo de tempo `deltaMs` (independente de FPS).
 * Retorna o novo estado e os eventos de dano contínuo gerados nos ticks deste frame.
 */
export function stepCrimsonLaser(
  state: CrimsonLaserState,
  params: {
    deltaMs: number;
    isHoldingFire: boolean;
    isRubyEquipped: boolean;
    level: WeaponLevel;
    shipX: number;
    shipY: number;
    targets: readonly LaserTargetCircle[];
  },
): {
  state: CrimsonLaserState;
  damageEvents: LaserDamageEvent[];
} {
  const dt = Math.max(0, params.deltaMs);
  const shouldEmit = Boolean(params.isHoldingFire && params.isRubyEquipped);

  let intensity = state.intensity;
  if (shouldEmit) {
    intensity = Math.min(1, intensity + dt / LASER_RAMP_UP_MS);
  } else {
    intensity = Math.max(0, intensity - dt / LASER_DECAY_MS);
  }

  const isEmitting = intensity > 0.01;
  const phaseMs = isEmitting ? state.phaseMs + dt : 0;

  if (!isEmitting) {
    return {
      state: {
        isEmitting: false,
        intensity: 0,
        phaseMs: 0,
        damageTickAccumulatorMs: 0,
        level: params.level,
        beams: [],
        impacts: [],
      },
      damageEvents: [],
    };
  }

  // Geometria bruta dos feixes acompanhando a nave imediatamente
  const rawBeams = computeLaserBeams(params.shipX, params.shipY, params.level, phaseMs, intensity);

  // Colisões contínuas e pontos de impacto
  const { clippedBeams, impacts, hitDpsByTarget } = evaluateLaserCollisions(
    rawBeams,
    params.targets,
    intensity,
  );

  // Aplicação de dano por intervalo fixo de tempo (independente de FPS)
  let accumulator = state.damageTickAccumulatorMs + dt;
  const damageEvents: LaserDamageEvent[] = [];

  if (shouldEmit && hitDpsByTarget.size > 0) {
    while (accumulator >= LASER_DAMAGE_TICK_MS) {
      accumulator -= LASER_DAMAGE_TICK_MS;
      const tickSeconds = LASER_DAMAGE_TICK_MS / 1000;
      for (const [targetId, info] of hitDpsByTarget.entries()) {
        damageEvents.push({
          targetId,
          damage: Number((info.dps * tickSeconds).toFixed(4)),
          hitX: info.hitX,
          hitY: info.hitY,
        });
      }
    }
  } else {
    accumulator = Math.min(accumulator, LASER_DAMAGE_TICK_MS * 0.5);
  }

  return {
    state: {
      isEmitting,
      intensity,
      phaseMs,
      damageTickAccumulatorMs: accumulator,
      level: params.level,
      beams: clippedBeams,
      impacts,
    },
    damageEvents,
  };
}
