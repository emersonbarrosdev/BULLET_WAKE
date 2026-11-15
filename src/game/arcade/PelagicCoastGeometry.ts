import {COAST_MAP_PERIOD,COAST_GUN_SOCKETS,paintedCoastBoundary,wrapCoast} from './PelagicCoastMap.ts';

export const COAST_WIDTH=384;
export const COAST_PERIOD=COAST_MAP_PERIOD;
export const COAST_PADDING=150;
export type CoastSide=-1|1;
/** Ground sockets on one continuous painting; these no longer select scenery sprites. */
export interface ArchipelagoFormationSpec {
 readonly id:number;readonly side:CoastSide;readonly yStart:number;readonly yEnd:number;
 readonly maxExtent:number;readonly kind:string;readonly legacyFrame:number;
 readonly artFrame:number;readonly width:number;readonly centerX:number;
 readonly groundX:number;readonly groundY:number;
}
export const ARCHIPELAGO_SPECS:ReadonlyArray<ArchipelagoFormationSpec>=COAST_GUN_SOCKETS.map(s=>({
 id:s.id,side:s.side,yStart:s.y-24,yEnd:s.y+24,maxExtent:s.side<0?s.x+24:384-s.x+24,
 kind:'painted-gun-socket',legacyFrame:0,artFrame:0,width:48,centerX:s.x,groundX:0,groundY:0,
}));
export const normalizeCoastY=wrapCoast;
export function formationRow(spec:ArchipelagoFormationSpec,rawY:number):readonly[number,number]|undefined{
 const d=wrapCoast(rawY-spec.yStart);if(d>=spec.yEnd-spec.yStart)return;
 return [spec.centerX-spec.width/2,spec.centerX+spec.width/2];
}
export const coastBoundary=paintedCoastBoundary;
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
