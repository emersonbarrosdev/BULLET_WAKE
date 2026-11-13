import {PELAGIC_COAST} from './PelagicEnvironment.ts';

/** Vertical shoreline strips: two independent banks, not detached island props.
 * All artwork is from the existing transparent tropical atlas. No water-colored
 * rectangle, opacity gradient, fog or rotation is placed over the approved ocean.
 */
export interface ShoreSprite {
 readonly id:number;
 readonly frame:0|1|3|6;
 readonly x:number;
 readonly y:number;
 readonly width:number;
 readonly height:number;
 readonly side:-1|1;
 readonly reef:boolean;
}
const COAST_FRAMES:ReadonlyArray<0|1|6>=[0,1,6,1,0,6,0,1,6,1];
const VIEW_LEFT=192,VIEW_RIGHT=576;
const bank=(side:-1|1,deep:boolean,jitter:number):number=>
 side<0?(deep?202:168)+jitter:(deep?566:600)-jitter;
const authored:ShoreSprite[]=[];
for(const p of PELAGIC_COAST){
 const k=Math.floor(p.id/2),side=p.side,variance=(k*7+(side>0?3:0))%5;
 const frame=COAST_FRAMES[(k+(side>0?4:0))%COAST_FRAMES.length];
 // The main illustrated island remains physically attached to the outside edge:
 // its western/eastern half is hidden by the opaque cockpit border.
 authored.push({
  id:p.id,side,frame,
  x:bank(side,true,(variance-2)*4),y:p.y,
  width:210+variance*6,height:258+variance*7,reef:false
 });
 // The joining bank reaches less far into the navigable channel. It visually
 // links neighboring bays without creating a detached oval in mid-water.
 authored.push({
  id:1000+p.id,side,frame:COAST_FRAMES[(k+6+(side>0?2:0))%COAST_FRAMES.length],
  x:bank(side,false,(variance-2)*3),y:p.y-178,
  width:212+(4-variance)*6,height:265+variance*6,reef:false
 });
 if(k%5===2){
  // Narrow reef line just offshore; source PNG already contains localized foam.
  authored.push({
   id:2000+p.id,side,frame:3,
   x:side<0?239:529,y:p.y-95,
   width:58,height:53,reef:true
  });
 }
}
export const PELAGIC_SHORE:ReadonlyArray<ShoreSprite>=Object.freeze(authored.sort((a,b)=>b.y-a.y));

export function visibleShore(scroll:number,pad=170):ShoreSprite[]{
 return PELAGIC_SHORE.filter(p=>p.y+scroll+p.height/2>=-pad&&p.y+scroll-p.height/2<=432+pad);
}
/** Runtime validation: land/reef sprites always attach to their respective coast. */
export function shoreAnchoredToEdge(p:ShoreSprite):boolean{
 return p.side<0?p.x-p.width*.5<=VIEW_LEFT:p.x+p.width*.5>=VIEW_RIGHT;
}
