/** Phase 1 geography, shared by scenery and surface navigation. All distances are world pixels.
 * World objects move DOWN: screenY = worldY + scroll. Art is never mirrored/rotated.
 * Conservative rectangular envelopes align with the rendered archipelago formations in PelagicCoastGeometry.
 */
import {ARCHIPELAGO_SPECS,COAST_PERIOD} from './PelagicCoastGeometry.ts';

export interface CoastPiece {id:number;frame:number;x:number;y:number;width:number;height:number;side:-1|1;solid:boolean;}
export interface SurfaceRoute {worldY:number;heading:number;entry:-1|0|1;phase:'enter'|'cruise'|'hold'|'turn'|'exit';anchor?:number;anchorY?:number;}
export interface SurfaceActor {id:number;x:number;y:number;size:number;age:number;speed:number;family:string;navigation?:SurfaceRoute;}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

// Generate world-space CoastPiece envelopes directly from ARCHIPELAGO_SPECS across all scroll cycles.
const rawPieces:Omit<CoastPiece,'id'>[]=[];
for(let cycle=-1;cycle<=7;cycle++){
 for(const spec of ARCHIPELAGO_SPECS){
  const centerY=(spec.yStart+spec.yEnd)/2-cycle*COAST_PERIOD;
  const height=spec.yEnd-spec.yStart;
  const halfW=Math.max(38,spec.maxExtent-36);
  const x=spec.side<0?192+spec.maxExtent-halfW:576-spec.maxExtent+halfW;
  rawPieces.push({
   frame:spec.legacyFrame,
   x:Math.round(x),
   y:Math.round(centerY),
   width:Math.round(halfW*2),
   height:Math.round(height),
   side:spec.side,
   solid:true,
  });
 }
}
rawPieces.sort((a,b)=>b.y-a.y);

export const PELAGIC_COAST:ReadonlyArray<CoastPiece>=rawPieces.map((p,id)=>({id,...p}));

export function visibleCoast(scroll:number,pad=150):CoastPiece[]{return PELAGIC_COAST.filter(p=>p.y+scroll+p.height/2>=-pad&&p.y+scroll-p.height/2<=432+pad);}
/** Safe corridor at a world-space ordinate. A radius covers the entire rotating boat, not just its center. */
export function waterCorridor(worldY:number,radius:number,lookAhead=0):{left:number;right:number}{
 let left=208+radius,right=560-radius;
 for(const p of PELAGIC_COAST){
  if(p.y+p.height/2<worldY-radius||p.y-p.height/2>worldY+radius+lookAhead)continue;
  if(p.side<0)left=Math.max(left,p.x+p.width/2+radius+3);else right=Math.min(right,p.x-p.width/2-radius-3);
 }
 return{left,right};
}
export function touchesCoast(x:number,worldY:number,radius:number):boolean{
 return PELAGIC_COAST.some(p=>Math.abs(x-p.x)<p.width/2+radius&&Math.abs(worldY-p.y)<p.height/2+radius);
}
export function prepareSurface(e:SurfaceActor,scroll:number,entryHint?:-1|0|1):void{
 if(e.family==='tank'||e.family==='tower'){
  // Prefer a near-future island/port. The unit and its terrain share exactly the same scroll transform.
  const candidates=PELAGIC_COAST.filter(p=>p.y+scroll>-220&&p.y+scroll<160);
  const anchor=candidates[e.id%Math.max(1,candidates.length)]??visibleCoast(scroll,260)[0]??PELAGIC_COAST[0];
  const anchorY=e.id%2?26:-10;
  e.navigation={worldY:anchor.y,heading:Math.PI,entry:0,phase:'hold',anchor:anchor.id,anchorY};
  e.x=anchor.x-anchor.side*20;e.y=anchor.y+scroll+anchorY;return;
 }
 const radius=e.size*.51,entry=entryHint??((e.id%3-1) as -1|0|1);
 let y=-55;
 if(entry){
  // A side entry is legal only in an opening wide enough for the complete hull and its approach.
  for(let candidate=55;candidate<=240;candidate+=10){
   const corridor=waterCorridor(candidate-scroll,radius,64);
   if(entry<0?corridor.left===208+radius:corridor.right===560-radius){y=candidate;break;}
  }
 }
 const actualEntry=y<0?0:entry,corridor=waterCorridor(y-scroll,radius,70);
 e.x=actualEntry<0?208-radius:actualEntry>0?560+radius:clamp(e.x,corridor.left,corridor.right);
 e.y=y;e.navigation={worldY:y-scroll,heading:actualEntry<0?Math.PI/2:actualEntry>0?-Math.PI/2:Math.PI,entry:actualEntry,phase:'enter'};
}
export function moveSurface(e:SurfaceActor,scroll:number,dt:number):void{
 if(!e.navigation)prepareSurface(e,scroll);
 const n=e.navigation!;
 if(n.anchor!==undefined){const p=PELAGIC_COAST[n.anchor];e.x=p.x-p.side*20;e.y=p.y+scroll+(n.anchorY??12);return;}
 const radius=e.size*.51,oldX=e.x,oldY=n.worldY;
 n.phase=e.age<2?'enter':e.age<4?'cruise':e.age<6?'hold':e.age<9?'turn':'exit';
 const speed=n.phase==='hold'?0:n.phase==='enter'?8:n.phase==='exit'?Math.max(30,e.speed*1.5):e.speed;
 const ahead=waterCorridor(n.worldY,radius,75),target=clamp(384+Math.sin(e.id*2.1)*(n.phase==='turn'?45:23),ahead.left,ahead.right);
 e.x+=clamp(target-e.x,-48*dt,48*dt);
 const nextY=n.worldY+speed*dt,corridor=waterCorridor(nextY,radius);
 // While entering, the hull may be offscreen, but never on a coastal object.
 const entrance=n.phase==='enter'&&n.entry!==0;
 if(!entrance||touchesCoast(e.x,nextY,radius))e.x=clamp(e.x,corridor.left,corridor.right);
 n.worldY=nextY;e.y=n.worldY+scroll;
 const vx=(e.x-oldX)/dt,vy=(n.worldY-oldY)/dt;
 if(Math.hypot(vx,vy)>1){const desired=Math.atan2(vy,vx)+Math.PI/2;const delta=Math.atan2(Math.sin(desired-n.heading),Math.cos(desired-n.heading));n.heading+=clamp(delta,-dt*2.4,dt*2.4);}
}
/** Hull art faces down; rotate its turret socket with the actual hull heading. */
export function surfaceMount(e:SurfaceActor):{x:number;y:number}{
 const rotation=(e.navigation?.heading??Math.PI)-Math.PI,d=e.size*.12;
 return{x:e.x-Math.sin(rotation)*d,y:e.y+Math.cos(rotation)*d};
}
