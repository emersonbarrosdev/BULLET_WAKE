import { clamp, sweepEllipse } from './geometry.ts';

export const SUB_BOSS_NAME = 'COLOSSO ABISSAL';
export const SUB_SECTION_HEIGHT = 240;
export const SUB_HULL_DISPLAY_W = 304;
/** Waist spans ~356/512 of the painted frame -> ~211px steel hull inside 384px UP lane (~86px clear dodge lane on each side). */
export const SUB_BEAM_HALF_W = 105;
export const SUB_ANCHOR_Y = 148;
export const SUB_MAX_BOMB_SECTION_DAMAGE = 220;
export const SUB_MAX_BOMB_PART_DAMAGE = 90;
export const SUB_MAX_BOMB_HULL_DAMAGE = 110;

export type SubModuleKind = 'turret' | 'launcher' | 'armor' | 'bridge' | 'propeller' | 'reactor';

export interface SubModule {
 id: number;
 sectionIndex: number;
 kind: SubModuleKind;
 x: number;
 y: number;
 dx: number;
 dy: number;
 hp: number;
 maxHp: number;
 radius: number;
 flash: number;
 warning: number;
 angle: number;
 recoil: number;
 cooldown: number;
}

export interface SubDamageMark {
 dx: number;
 dy: number;
 size: number;
 seed: number;
}

export interface SubSection {
 index: number;
 name: string;
 radio: string;
 hullHp: number;
 hullMaxHp: number;
 hullFlash: number;
 completed: boolean;
 parts: SubModule[];
 marks: SubDamageMark[];
}

export interface SubmarineBossState {
 activeSection: number;
 subScroll: number;
 targetScroll: number;
 anchorY: number;
 phase: 'enter' | 'fight' | 'transition' | 'collapse' | 'done';
 age: number;
 timer: number;
 bridgeDestroyed: boolean;
 sections: SubSection[];
 bombDamage: Record<number, { total: number; hull: number; parts: Record<number, number> }>;
}

interface SectionSpec {
 name: string;
 radio: string;
 hullHp: number;
 parts: { kind: SubModuleKind; dx: number; dy: number; hp: number; radius: number; delay: number }[];
}

const SECTION_SPECS: readonly SectionSpec[] = [
 {
  name: 'PROA BLINDADA',
  radio: 'A PROA DO COLOSSO EMERGIU!\nMIRAR NOS CANHÕES E NO CASCO!',
  hullHp: 180,
  parts: [
   { kind: 'turret', dx: -46, dy: -22, hp: 115, radius: 16, delay: 0.7 },
   { kind: 'turret', dx: 46, dy: -22, hp: 115, radius: 16, delay: 1.25 },
   { kind: 'armor', dx: 0, dy: 28, hp: 130, radius: 20, delay: 1.55 },
  ],
 },
 {
  name: 'ARMAMENTO FRONTAL',
  radio: 'AVANÇANDO PELO CONVÉS DIANTEIRO!\nSILOS VLS ARMADOS!',
  hullHp: 200,
  parts: [
   { kind: 'turret', dx: -54, dy: 48, hp: 120, radius: 16, delay: 0.65 },
   { kind: 'turret', dx: 54, dy: 48, hp: 120, radius: 16, delay: 1.2 },
   { kind: 'launcher', dx: -38, dy: -36, hp: 115, radius: 18, delay: 0.9 },
   { kind: 'launcher', dx: 38, dy: -36, hp: 115, radius: 18, delay: 1.45 },
  ],
 },
 {
  name: 'TORRE DE COMANDO',
  radio: 'TORRE DE COMANDO À VISTA!\nDERRUBEM A PONTE CENTRAL!',
  hullHp: 210,
  parts: [
   { kind: 'bridge', dx: 0, dy: -8, hp: 230, radius: 28, delay: 0.85 },
   { kind: 'turret', dx: -58, dy: 34, hp: 115, radius: 16, delay: 0.6 },
   { kind: 'turret', dx: 58, dy: 34, hp: 115, radius: 16, delay: 1.15 },
   { kind: 'launcher', dx: 0, dy: -78, hp: 115, radius: 18, delay: 1.5 },
  ],
 },
 {
  name: 'ARMAMENTO TRASEIRO',
  radio: 'CONTORNANDO A POPA ARMADA!\nCUIDADO COM O FOGO CRUZADO!',
  hullHp: 210,
  parts: [
   { kind: 'turret', dx: -54, dy: -26, hp: 120, radius: 16, delay: 0.55 },
   { kind: 'turret', dx: 54, dy: -26, hp: 120, radius: 16, delay: 1.1 },
   { kind: 'turret', dx: 0, dy: 34, hp: 140, radius: 18, delay: 1.4 },
   { kind: 'armor', dx: 0, dy: -68, hp: 130, radius: 20, delay: 1.75 },
  ],
 },
 {
  name: 'PROPULSÃO ABISSAL',
  radio: 'ÚLTIMA SEÇÃO: HÉLICES E REATOR!\nDESTRUAM O COLOSSO ABISSAL!',
  hullHp: 230,
  parts: [
   { kind: 'propeller', dx: -46, dy: -46, hp: 135, radius: 20, delay: 0.7 },
   { kind: 'propeller', dx: 46, dy: -46, hp: 135, radius: 20, delay: 1.25 },
   { kind: 'turret', dx: -58, dy: 48, hp: 115, radius: 16, delay: 0.55 },
   { kind: 'turret', dx: 58, dy: 48, hp: 115, radius: 16, delay: 1.05 },
   { kind: 'reactor', dx: 0, dy: 4, hp: 195, radius: 22, delay: 1.5 },
  ],
 },
];

export function createSubmarineBoss(nextId: () => number, centerX = 384): SubmarineBossState {
 const sections: SubSection[] = SECTION_SPECS.map((spec, sIdx) => ({
  index: sIdx,
  name: spec.name,
  radio: spec.radio,
  hullHp: spec.hullHp,
  hullMaxHp: spec.hullHp,
  hullFlash: 0,
  completed: false,
  marks: [],
  parts: spec.parts.map(p => ({
   id: nextId(),
   sectionIndex: sIdx,
   kind: p.kind,
   x: centerX + p.dx,
   y: -160 + p.dy,
   dx: p.dx,
   dy: p.dy,
   hp: p.hp,
   maxHp: p.hp,
   radius: p.radius,
   flash: 0,
   warning: 0,
   angle: Math.PI / 2,
   recoil: 0,
   cooldown: p.delay,
  })),
 }));
 return {
  activeSection: 0,
  subScroll: 0,
  targetScroll: 0,
  anchorY: -160,
  phase: 'enter',
  age: 0,
  timer: 0,
  bridgeDestroyed: false,
  sections,
  bombDamage: {},
 };
}

export function subSectionCenterY(sub: SubmarineBossState, sectionIndex: number): number {
 return sub.anchorY + sub.subScroll - sectionIndex * SUB_SECTION_HEIGHT;
}

/** Deterministic geometric silhouette fallback matching painted hull contours for each section. */
export function subHullGeometricContact(
 sub: SubmarineBossState,
 hullX: number,
 sectionIndex: number,
 ax: number,
 ay: number,
 bx: number,
 by: number,
 radius: number,
): number | null {
 const cy = subSectionCenterY(sub, sectionIndex);
 const halfH = SUB_SECTION_HEIGHT * 0.5;
 // Tapered bow (Sec 0) and tapered stern (Sec 4) keep authentic angled bounds; mid-sections match straight waist.
 const rx = sectionIndex === 0 ? SUB_BEAM_HALF_W * 0.88 : sectionIndex === 4 ? SUB_BEAM_HALF_W * 0.86 : SUB_BEAM_HALF_W;
 const ry = sectionIndex === 0 ? halfH * 0.92 : sectionIndex === 4 ? halfH * 0.9 : halfH;
 if (sectionIndex === 0 || sectionIndex === 4) {
  return sweepEllipse(ax, ay, bx, by, hullX, cy, rx + radius, ry + radius);
 }
 // Straight rectangular mid-hull deck box swept test
 const minX = hullX - rx - radius, maxX = hullX + rx + radius;
 const minY = cy - ry - radius, maxY = cy + ry + radius;
 const dx = bx - ax, dy = by - ay;
 let tMin = 0, tMax = 1;
 for (const [p, d, lo, hi] of [[ax, dx, minX, maxX], [ay, dy, minY, maxY]] as const) {
  if (Math.abs(d) < 1e-8) {
   if (p < lo || p > hi) return null;
  } else {
   let t1 = (lo - p) / d, t2 = (hi - p) / d;
   if (t1 > t2) [t1, t2] = [t2, t1];
   tMin = Math.max(tMin, t1);
   tMax = Math.min(tMax, t2);
   if (tMin > tMax) return null;
  }
 }
 return clamp(tMin, 0, 1);
}

export function syncSubmarinePositions(sub: SubmarineBossState, hullX: number, aimX: number, aimY: number): void {
 for (const sec of sub.sections) {
  const cy = subSectionCenterY(sub, sec.index);
  for (const p of sec.parts) {
   p.x = hullX + p.dx;
   p.y = cy + p.dy;
   if (p.hp > 0) {
    if (p.kind === 'turret') {
     p.angle = Math.atan2(aimY - p.y, aimX - p.x);
    } else {
     p.angle = Math.PI / 2;
    }
   }
  }
 }
}

export function subActiveSectionComplete(sec: SubSection): boolean {
 return sec.hullHp <= 0 && sec.parts.every(p => p.hp <= 0);
}

export function subTotalHp(sub: SubmarineBossState): { current: number; max: number } {
 let current = 0, max = 0;
 for (const sec of sub.sections) {
  current += Math.max(0, sec.hullHp);
  max += sec.hullMaxHp;
  for (const p of sec.parts) {
   current += Math.max(0, p.hp);
   max += p.maxHp;
  }
 }
 return { current, max };
}
