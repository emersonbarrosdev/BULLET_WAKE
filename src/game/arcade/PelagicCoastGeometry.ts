import {COAST_ALPHA_PROFILES} from './PelagicAlphaProfiles.ts';

/** Authored maritime itinerary. One complete illustration per landmass, no tiled banks. */
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
 const width=frame===5?120:frame===6?170:220;
 const height=width;

 const rows=COAST_ALPHA_PROFILES[frame].filter(([a,b])=>b>a);
 const min=Math.min(...rows.map(r=>r[0])),max=Math.max(...rows.map(r=>r[1]));
 const centerX=side<0?110-(max-.5)*width:COAST_WIDTH-110-(min-.5)*width;
 const maxExtent=110;
 return {id,side,yStart:y-height/2,yEnd:y+height/2,maxExtent,
  kind,legacyFrame:frame===2?4:frame===1?2:0,artFrame:frame,width,centerX,
  groundX:frame===2?width*.22:side<0?width*.13:-width*.12,
  groundY:frame===2?height*.24:height*.19};
}
export const ARCHIPELAGO_SPECS:ReadonlyArray<ArchipelagoFormationSpec>=Object.freeze([
 formation(0,-1,120,0,'crescent-beach'),
 formation(1,1,-120,7,'northern-cliff'),
 formation(2,-1,540,4,'fishing-village'),
 formation(3,1,290,3,'cliff-bay'),
 formation(4,-1,1000,2,'harbor-left'),
 formation(5,1,950,1,'lighthouse-cliff'),
 formation(6,-1,1440,5,'sea-stacks'),
 formation(7,1,1390,6,'palm-islet'),
 formation(8,-1,1840,6,'southern-islet'),
 formation(9,1,1810,3,'outer-cliffs'),
 formation(10,-1,2250,0,'southern-cove'),
 formation(11,1,2230,5,'southern-stacks'),
 formation(12,-1,2700,4,'southern-village'),
 formation(13,1,2650,1,'southern-lighthouse'),
 formation(14,-1,3160,2,'cargo-quay'),
 formation(15,1,3070,7,'last-headland'),
 // 3270..3970 is deliberately unbroken open ocean on BOTH sides.
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
