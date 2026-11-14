import {COAST_ALPHA_PROFILES} from './PelagicAlphaProfiles.ts';

/** Authored maritime itinerary. Connected coastal peninsulas, beaches, harbors, and headlands. */
export const COAST_WIDTH=384;
export const COAST_PERIOD=4200;
export const COAST_PADDING=150;
export type CoastSide=-1|1;
export interface ArchipelagoFormationSpec {
 readonly id:number;readonly side:CoastSide;readonly yStart:number;readonly yEnd:number;
 readonly maxExtent:number;readonly kind:string;readonly legacyFrame:number;
 readonly artFrame:number;readonly width:number;readonly centerX:number;
 /** Ground socket measured on the illustrated beach/quay, relative to image center. */
 readonly groundX:number;readonly groundY:number;
}
function formation(id:number,side:CoastSide,y:number,frame:number,kind:string):ArchipelagoFormationSpec{
 const width=frame===5?120:220;
 const height=width;

 const rows=COAST_ALPHA_PROFILES[frame].filter(([a,b])=>b>a);
 const min=Math.min(...rows.map(r=>r[0])),max=Math.max(...rows.map(r=>r[1]));
 const centerX=side<0?110-(max-.5)*width:COAST_WIDTH-110-(min-.5)*width;
 const mid=((min+max)/2-.5)*width;
 const maxExtent=110;
 return {id,side,yStart:y-height/2,yEnd:y+height/2,maxExtent,
  kind,legacyFrame:frame===2?4:frame===1||frame===9?2:0,artFrame:frame,width,centerX,
  groundX:mid+(side<0?width*.06:-width*.06),
  groundY:frame===2?height*.18:height*.14};
}
export const ARCHIPELAGO_SPECS:ReadonlyArray<ArchipelagoFormationSpec>=Object.freeze([
 formation(0,-1,70,8,'northern-continuous-beach-left'),
 formation(1,1,-180,3,'northern-palm-beach-right'),
 formation(2,-1,440,4,'fishing-village-beach-left'),
 formation(3,1,190,11,'coral-reef-beach-right'),
 formation(4,-1,810,2,'main-harbor-left'),
 formation(5,1,515,5,'northern-coastal-rocks-right'),
 formation(6,-1,1210,8,'mid-golden-beach-left'),
 formation(7,1,835,1,'lighthouse-promontory-right'),
 formation(8,-1,1580,10,'tropical-lagoon-boathouse-left'),
 formation(9,1,1205,11,'mid-coral-palm-cove-right'),
 formation(10,-1,1950,0,'crescent-palm-beach-left'),
 formation(11,1,1575,7,'terraced-cliff-beach-right'),
 formation(12,-1,2320,4,'southern-village-beach-left'),
 formation(13,1,2175,9,'auxiliary-harbor-right'),
 formation(14,-1,2840,6,'southern-palm-islet-left'),
 formation(15,1,2545,3,'southern-palm-beach-right'),
 formation(16,-1,3330,8,'lagoon-palm-beach-left'),
 formation(17,1,2915,7,'boss-approach-cliff-beach-right'),
 formation(18,-1,3780,10,'western-boathouse-beach-left'),
 formation(19,1,3550,11,'eastern-palm-cove-right'),
]);
export const normalizeCoastY=(y:number):number=>((y%COAST_PERIOD)+COAST_PERIOD)%COAST_PERIOD;
/** Conservative silhouette row, including the native shallow-water fringe. */
export function formationRow(spec:ArchipelagoFormationSpec,rawY:number):readonly[number,number]|undefined{
 const y=normalizeCoastY(rawY);
 for(const shift of[0,-COAST_PERIOD,COAST_PERIOD]){
  const t=(y+shift-spec.yStart)/(spec.yEnd-spec.yStart);
  if(t<0||t>=1)continue;
  const profile=COAST_ALPHA_PROFILES[spec.artFrame];
  const [a,b]=profile[Math.min(profile.length-1,Math.floor(t*profile.length))];
  if(b<=a)return;
  return [spec.centerX+(a-.5)*spec.width,spec.centerX+(b-.5)*spec.width];
 }
}
export function coastBoundary(y:number,side:CoastSide):number{
 let boundary=side<0?0:COAST_WIDTH;
 for(const s of ARCHIPELAGO_SPECS){if(s.side!==side)continue;const row=formationRow(s,y);if(row)boundary=side<0?Math.max(boundary,row[1]):Math.min(boundary,row[0]);}
 return Math.max(0,Math.min(COAST_WIDTH,boundary));
}
export function coastAtScroll(scroll:number,y:number,side:CoastSide):number{return coastBoundary(y-scroll,side);}
export function isOpenSeaAt(y:number,side:CoastSide):boolean{return coastBoundary(y,side)===(side<0?0:COAST_WIDTH);}
export function visibleFormations(scroll:number,padding=40):Array<{spec:ArchipelagoFormationSpec;y:number;key:string}>{
 const result:Array<{spec:ArchipelagoFormationSpec;y:number;key:string}>=[];
 const cycle=Math.floor(scroll/COAST_PERIOD);
 for(let c=cycle-1;c<=cycle+1;c++)for(const spec of ARCHIPELAGO_SPECS){
  const y=(spec.yStart+spec.yEnd)/2-c*COAST_PERIOD+scroll,h=(spec.yEnd-spec.yStart)/2;
  if(y+h>=-padding&&y-h<=432+padding)result.push({spec,y,key:c+':'+spec.id});
 }
 return result;
}
