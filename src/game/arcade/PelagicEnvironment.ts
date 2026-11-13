/** Phase 1 geography, shared by scenery and surface navigation. All distances are world pixels.
 * World objects move DOWN: screenY = worldY + scroll. Art is never mirrored/rotated.
 * Conservative rectangular envelopes include foam, rocks and projecting dock fingers.
 */
export interface CoastPiece {id:number;frame:number;x:number;y:number;width:number;height:number;side:-1|1;solid:boolean;}
export interface SurfaceRoute {worldY:number;heading:number;entry:-1|0|1;phase:'enter'|'cruise'|'hold'|'turn'|'exit';anchor?:number;anchorY?:number;}
export interface SurfaceActor {id:number;x:number;y:number;size:number;age:number;speed:number;family:string;navigation?:SurfaceRoute;}
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
// Alternating authored modules: separate island and harbor sprites, never a complete map.
const sequence=[0,2,1,6,4,1,5,0,2,6,4,5,1,2,0,6];
export const PELAGIC_COAST:ReadonlyArray<CoastPiece>=Array.from({length:96},(_,i)=>{
 const side:-1|1=i%2===0?-1:1;
 const frame=sequence[i%sequence.length],port=frame===4||frame===5;
 // A harbor's art is authored for its shoreline; select the corresponding variant.
 return{id:i,frame:port?(side===-1?4:5):frame,x:frame===2?(side===-1?251:517):(side===-1?229:539),
  y:330-i*178,width:frame===2?126:port?166:146+(i%3)*8,height:frame===2?158:port?166:174+(i%3)*14,side,solid:true};
});
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
  const candidates=PELAGIC_COAST.filter(p=>p.y+scroll>-140&&p.y+scroll<120);
  const anchor=candidates[e.id%candidates.length]??visibleCoast(scroll)[0];
  const anchorY=e.id%2?32:-8;
  e.navigation={worldY:anchor.y,heading:Math.PI,entry:0,phase:'hold',anchor:anchor.id,anchorY};
  e.x=anchor.x-anchor.side*20;e.y=anchor.y+scroll+anchorY;return;
 }
 const radius=e.size*.51,entry=entryHint??((e.id%3-1) as -1|0|1);
 let y=-55;
 if(entry){
  // A side entry is legal only in an opening wide enough for the complete hull and its approach.
  for(let candidate=65;candidate<=220;candidate+=10){
   const corridor=waterCorridor(candidate-scroll,radius,48);
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
