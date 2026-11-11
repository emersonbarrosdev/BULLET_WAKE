export interface ScarletBeam { ax:number; ay:number; bx:number; by:number; radius:number; }
export const SCARLET_DURATION_MS = 3000;
export const SCARLET_BOSS_BUDGET = 120;

/** Front propagation, then sustained exposure, then a short fade. All timings are in simulation time. */
export function scarletBeams(elapsed:number,x:number,y:number):ScarletBeam[] {
  if(elapsed<=120||elapsed>=SCARLET_DURATION_MS)return [];
  const reach=Math.min(480,(elapsed-120)*1.8);
  return [-.24,0,.24].map(angle=>({ax:x,ay:y,bx:x+Math.sin(angle)*reach,by:y-Math.cos(angle)*reach,radius:angle===0?26:11}));
}

/** Total is 120 only with continuous contact; missed frames cannot be banked for a later hit. */
export function scarletDamageBetween(from:number,to:number):number {
  const exposure=(ms:number)=>Math.max(0,Math.min(1,(ms-400)/2400));
  return SCARLET_BOSS_BUDGET*Math.max(0,exposure(to)-exposure(from));
}

/** Narrow emitter opens into a broad plasma body, avoiding an invisible wide hit near the nose. */
export function scarletSegments(beam:ScarletBeam):ScarletBeam[] {
  return Array.from({length:12},(_,i)=>{
    const t=i/12,u=(i+1)/12;
    return {ax:beam.ax+(beam.bx-beam.ax)*t,ay:beam.ay+(beam.by-beam.ay)*t,
      bx:beam.ax+(beam.bx-beam.ax)*u,by:beam.ay+(beam.by-beam.ay)*u,radius:beam.radius*Math.min(1,.16+t*4)};
  });
}
