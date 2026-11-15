/** Phase 1 geography, shared by scenery and surface navigation. All distances are world pixels.
 * World objects move DOWN: screenY = worldY + scroll. Art is never mirrored/rotated.
 * Conservative rectangular envelopes align with the rendered archipelago formations in PelagicCoastGeometry.
 */
import {ARCHIPELAGO_SPECS,COAST_PERIOD,coastBoundary} from './PelagicCoastGeometry.ts';

export interface CoastPiece {id:number;frame:number;x:number;y:number;width:number;height:number;side:-1|1;solid:boolean;groundX:number;groundY:number;}
export interface SurfaceRoute {worldY:number;heading:number;entry:-1|0|1;phase:'enter'|'cruise'|'hold'|'turn'|'exit';anchor?:number;anchorY?:number;lane?:number;}
export interface SurfaceActor {id:number;x:number;y:number;size:number;age:number;speed:number;family:string;navigation?:SurfaceRoute;}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

// Generate world-space CoastPiece envelopes directly from ARCHIPELAGO_SPECS across all scroll cycles.
const rawPieces:Omit<CoastPiece,'id'>[]=[];
for(let cycle=-1;cycle<=7;cycle++){
 for(const spec of ARCHIPELAGO_SPECS){
  const centerY=(spec.yStart+spec.yEnd)/2-cycle*COAST_PERIOD;
  const height=spec.yEnd-spec.yStart;
  const offset=0,x=192+spec.centerX;
  rawPieces.push({
   frame:spec.legacyFrame,
   x,
   y:Math.round(centerY),
   width:spec.width,
   height:Math.round(height),
   side:spec.side,
   solid:true,
   groundX:spec.groundX-offset,groundY:spec.groundY,
  });
 }
}
rawPieces.sort((a,b)=>b.y-a.y);

export const PELAGIC_COAST:ReadonlyArray<CoastPiece>=rawPieces.map((p,id)=>({id,...p}));

export function visibleCoast(scroll:number,pad=150):CoastPiece[]{return PELAGIC_COAST.filter(p=>p.y+scroll+p.height/2>=-pad&&p.y+scroll-p.height/2<=432+pad);}
/** Safe corridor at a world-space ordinate. A radius covers the entire rotating boat, not just its center. */
export function waterCorridor(worldY:number,radius:number,lookAhead=0):{left:number;right:number}{
 let left=208+radius,right=560-radius;
 // Sweep every silhouette row covered by the whole hull and its look-ahead.
 for(let y=Math.floor(worldY-radius);y<=Math.ceil(worldY+radius+lookAhead);y+=2){
  const l=coastBoundary(y,-1),r=coastBoundary(y,1);
  left=Math.max(left,192+l+radius+4);right=Math.min(right,192+r-radius-4);
 }
 return{left,right};
}
export function touchesCoast(x:number,worldY:number,radius:number):boolean{
 for(let y=Math.floor(worldY-radius);y<=Math.ceil(worldY+radius);y+=2){
  const l=coastBoundary(y,-1),r=coastBoundary(y,1);
  if((l>0&&x-radius<192+l)||(r<384&&x+radius>192+r))return true;
 }
 return false;
}
export function prepareSurface(e:SurfaceActor,scroll:number,entryHint?:-1|0|1,occupied:ReadonlySet<number>=new Set()):void{
 if(e.family==='tank'||e.family==='tower'){
  // Prefer a near-future large coastal formation/port (never a tiny sea-stack rock).
  const candidates=PELAGIC_COAST.filter(p=>!occupied.has(p.id)&&p.y+scroll<-50&&p.side===(e.family==='tower'?1:-1)).sort((a,b)=>b.y-a.y);
  const fallback=PELAGIC_COAST.filter(p=>p.y+scroll<0).sort((a,b)=>b.y-a.y)[0]??PELAGIC_COAST[0];
  const anchor=candidates[0]??fallback;
  const anchorY=anchor.groundY;
  e.navigation={worldY:anchor.y,heading:Math.PI,entry:0,phase:'hold',anchor:anchor.id,anchorY};
  e.x=anchor.x+anchor.groundX;e.y=anchor.y+scroll+anchorY;return;
 }
 const radius=e.size*.51,entry=entryHint??((e.id%3-1) as -1|0|1);
 let y=-55;
 if(entry){
  // A side entry is legal only in an opening wide enough for the complete hull and its approach.
  for(let candidate=55;candidate<=240;candidate+=10){
   const corridor=waterCorridor(candidate-scroll,radius,64);
   let clear=true;for(let row=Math.floor(candidate-scroll-radius-4);row<=Math.ceil(candidate-scroll+radius+4);row++){if(entry<0?coastBoundary(row,-1)>0:coastBoundary(row,1)<384){clear=false;break;}}
   if(clear&&(entry<0?corridor.left===208+radius:corridor.right===560-radius)){y=candidate;break;}
  }
 }
 const actualEntry=y<0?0:entry,corridor=waterCorridor(y-scroll,radius,24);
 const lane=entry||((e.id%2)?-1:1);
 e.x=actualEntry<0?208-radius:actualEntry>0?560+radius:(corridor.left+corridor.right)/2+lane*Math.min(45,(corridor.right-corridor.left)/2-1);
 e.y=y;e.navigation={worldY:y-scroll,heading:actualEntry<0?Math.PI/2:actualEntry>0?-Math.PI/2:Math.PI,entry:actualEntry,lane,phase:'enter'};
}
export function moveSurface(e:SurfaceActor,scroll:number,dt:number):void{
 if(!e.navigation)prepareSurface(e,scroll);
 const n=e.navigation!;
 if(n.anchor!==undefined){const p=PELAGIC_COAST[n.anchor];e.x=p.x+p.groundX;e.y=p.y+scroll+(n.anchorY??p.groundY);return;}
 const radius=e.size*.51,oldX=e.x,oldY=n.worldY;
 const current=waterCorridor(n.worldY,radius);
 const crossing=n.entry!==0&&(e.x<current.left||e.x>current.right);
 n.phase=crossing||e.age<2?'enter':e.age<4?'cruise':e.age<6?'hold':e.age<9?'turn':'exit';
 const speed=n.phase==='hold'||crossing?0:n.phase==='enter'?8:n.phase==='exit'?Math.max(30,e.speed*1.5):e.speed;
 const ahead=waterCorridor(n.worldY,radius,24),target=(ahead.left+ahead.right)/2+(n.lane??1)*Math.min(45,(ahead.right-ahead.left)/2-1);
 e.x+=clamp(target-e.x,-48*dt,48*dt);
 const nextY=n.worldY+speed*dt,corridor=waterCorridor(nextY,radius);
 // While entering, the hull may be offscreen, but never on a coastal object.
 const entrance=n.phase==='enter'&&n.entry!==0;
 if(!entrance||touchesCoast(e.x,nextY,radius))e.x=clamp(e.x,corridor.left,corridor.right);
 n.worldY=nextY;e.y=n.worldY+scroll;
 const vx=(e.x-oldX)/dt,vy=(n.worldY-oldY)/dt;
 if(Math.hypot(vx,vy)>.2||n.phase==='hold'){
  const desired=Math.atan2(Math.max(12,vy),vx*.85)+Math.PI/2;
  const delta=Math.atan2(Math.sin(desired-n.heading),Math.cos(desired-n.heading));
  n.heading+=clamp(delta*2.6*dt,-dt*1.5,dt*1.5);
 }
}
/** Hull art faces down; rotate its turret socket with the actual hull heading. */
export function surfaceMount(e:SurfaceActor):{x:number;y:number}{
 if(e.navigation?.anchor!==undefined)return{x:e.x,y:e.y-e.size*.08};
 const rotation=(e.navigation?.heading??Math.PI)-Math.PI,d=e.size*.12;
 return{x:e.x-Math.sin(rotation)*d,y:e.y+Math.cos(rotation)*d};
}
