import { resetWeaponsOnRespawn, type PlayerWeaponsState } from './weaponSystem.ts';

/** Bullet Wake Normal calibration. These are not measurements from a reference ROM. */
export const NORMAL_BOSS_SHOT_SCALE = .55;
export const RIVET_MISSILE_INTERVAL_MS = 3200;

/** A late Continue must remain viable with no special stock and no perfect P route. */
export function continueWeapons(state: PlayerWeaponsState, checkpoint: number): PlayerWeaponsState {
  const reset=resetWeaponsOnRespawn(state);
  if(checkpoint<2100)return reset;
  return {...reset,weaponLevel:Math.max(2,reset.weaponLevel) as 2|3|4};
}

/** Swept shot vs ellipse, including its radius: a fast charge cannot skip a thin target. */
export function segmentEllipseHit(ax:number,ay:number,bx:number,by:number,cx:number,cy:number,rx:number,ry:number):number|null {
  const x=(ax-cx)/rx,y=(ay-cy)/ry,dx=(bx-ax)/rx,dy=(by-ay)/ry;
  const c=x*x+y*y-1;
  if(c<=0)return 0;
  const a=dx*dx+dy*dy,b=2*(x*dx+y*dy),disc=b*b-4*a*c;
  if(a<1e-12||disc<0)return null;
  const t=(-b-Math.sqrt(disc))/(2*a);
  return t>=0&&t<=1?t:null;
}
