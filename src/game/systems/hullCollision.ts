export interface Point {
  x: number;
  y: number;
}
/** Visible RIVET hull at 46px. Empty corners and exhaust do not take damage. */
export const RIVET_HULL: readonly Point[] = [
  { x: 0, y: -20 },
  { x: 5, y: -9 },
  { x: 9, y: -5 },
  { x: 18, y: 10 },
  { x: 8, y: 8 },
  { x: 6, y: 16 },
  { x: -6, y: 16 },
  { x: -8, y: 8 },
  { x: -18, y: 10 },
  { x: -9, y: -5 },
  { x: -5, y: -9 },
];
export function circleHitsHull(
  x: number,
  y: number,
  radius: number,
  shipX: number,
  shipY: number,
): boolean {
  const px = x - shipX,
    py = y - shipY;
  let inside = false;
  for (let i = 0, j = RIVET_HULL.length - 1; i < RIVET_HULL.length; j = i++) {
    const a = RIVET_HULL[j],
      b = RIVET_HULL[i];
    if (
      a.y > py !== b.y > py &&
      px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
    const dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(
        0,
        Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)),
      );
    if (Math.hypot(px - a.x - t * dx, py - a.y - t * dy) <= radius) return true;
  }
  return inside;
}

function distanceToSegment(p:Point,a:Point,b:Point):number {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  const t=length===0?0:Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}

/** Swept capsule against the hull: fast projectiles cannot skip the visible nose. */
function pathHitsHull(a:Point,b:Point,radius:number,shipX:number,shipY:number):boolean {
  if(circleHitsHull(a.x,a.y,radius,shipX,shipY)||circleHitsHull(b.x,b.y,radius,shipX,shipY))return true;
  const cross=(p:Point,q:Point,r:Point):number=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  for(let i=0;i<RIVET_HULL.length;i++){
    const p=RIVET_HULL[i],q=RIVET_HULL[(i+1)%RIVET_HULL.length];
    const c={x:p.x+shipX,y:p.y+shipY},d={x:q.x+shipX,y:q.y+shipY};
    const ac=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);
    if(((ac>0&&ad<0)||(ac<0&&ad>0))&&((ca>0&&cb<0)||(ca<0&&cb>0)))return true;
    if(Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),distanceToSegment(c,a,b),distanceToSegment(d,a,b))<=radius)return true;
  }
  return false;
}

export function sweptHullContact(from:Point,to:Point,radius:number,shipX:number,shipY:number):Point|null {
  if(!pathHitsHull(from,to,radius,shipX,shipY))return null;
  if(circleHitsHull(from.x,from.y,radius,shipX,shipY))return from;
  let lo=0,hi=1;
  for(let i=0;i<12;i++){
    const t=(lo+hi)/2,p={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
    if(pathHitsHull(from,p,radius,shipX,shipY))hi=t;else lo=t;
  }
  return {x:from.x+(to.x-from.x)*hi,y:from.y+(to.y-from.y)*hi};
}
