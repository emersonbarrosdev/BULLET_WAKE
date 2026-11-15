/** The painting, collision shoreline and gun sockets share this world transform. */
export const COAST_MAP_WIDTH=384;
export const COAST_MAP_PERIOD=2048;
export const COAST_MAP_OFFSET=610;
export const COAST_MAP_KEY='pelagic-connected-coast-v2';
export const COAST_MAP_SCALE=.5;
export const COAST_PANEL_HEIGHT=1152;
export const COAST_PANEL_STRIDE=1024;
export const COAST_PANEL_OVERLAP=128;
export type CoastBank=-1|1;
export const wrapCoast=(y:number)=>((y%COAST_MAP_PERIOD)+COAST_MAP_PERIOD)%COAST_MAP_PERIOD;

// Conservatively traced water-contact silhouettes of the two source paintings.
// Coordinates are normalized source-image rows, never camera-relative props.
const harborLeft=[0,.29,.04,.25,.10,.25,.14,.30,.19,.30,.23,.18,.29,.25,.33,.24,.37,.17,.43,.28,.49,.22,.54,.25,.59,.17,.64,.21,.70,.27,.74,.30,.78,.21,.84,.23,.90,.20,.96,.26,1,.29];
const harborRight=[0,.76,.06,.74,.10,.69,.15,.60,.19,.66,.24,.72,.28,.72,.34,.63,.39,.66,.44,.70,.49,.77,.54,.77,.59,.69,.64,.59,.70,.58,.75,.67,.79,.76,.84,.76,.90,.76,.96,.72,1,.76];
const leisureLeft=[0,.29,.05,.25,.09,.30,.14,.34,.18,.28,.22,.16,.28,.22,.33,.18,.39,.12,.44,.19,.49,.23,.54,.17,.59,.14,.64,.31,.69,.34,.73,.26,.78,.16,.89,.24,.95,.25,1,.29];
const leisureRight=[0,.76,.05,.73,.10,.67,.15,.64,.20,.59,.25,.64,.29,.74,.33,.64,.37,.58,.42,.62,.47,.75,.50,.88,.52,1,.59,1,.62,.88,.66,.79,.70,.64,.75,.53,.79,.50,.83,.62,.88,.70,.94,.75,1,.76];

function interpolate(points:number[],t:number):number{
 for(let i=2;i<points.length;i+=2){if(t<=points[i]){const f=(t-points[i-2])/(points[i]-points[i-2]);return points[i-1]+(points[i+1]-points[i-1])*f;}}
 return points[points.length-1];
}

// 1:1 horizontal outward translation knots [mapY, shiftLeftPx, shiftRightPx] in 384px world space.
// Translating (rather than scaling) keeps every palm tree, hut, crane, lighthouse and wave at 1:1 aspect ratio
// while opening wide central water channels and alternating one-sided coastal stretches.
const BANK_SHIFT_KNOTS:readonly[number,number,number][]=[
 [0,24,30],
 [107,16,52],   // Socket 0 (left stone terrace): left prominent at 1:1, right slides out
 [235,48,18],   // Right cafe & cliff prominent at 1:1, left slides out into wide cove
 [385,18,22],   // Beached boat (left) & lighthouse (right) both at 1:1 with +40px wider channel
 [487,14,62],   // Socket 1 (left sand): one-sided left beach, right slides out to open sea
 [640,16,28],   // Left fishing hut visible in full at 1:1
 [749,34,26],   // Socket 2 (right harbor crane & quay): harbor at 1:1, channel widened by +60px for boss & boats
 [910,46,28],   // Wide southern harbor channel
 [1092,16,44],  // Socket 3 (left northern terrace): left terrace at 1:1, right recessed
 [1187,46,24],  // Socket 4 (right tower forecourt): right forecourt at 1:1, left recessed
 [1345,50,22],  // Right skatepark prominent at 1:1, wide water on left
 [1545,18,56],  // Eastern open-sea bay: coast only on left, open ocean to right edge
 [1720,16,42],  // Socket 5 (left southern terrace): left terrace at 1:1, right recessed
 [1855,52,38],  // Circus headland (right) with wide open water on left (+90px wider channel)
 [2048,24,30],
];

export function coastBankShift(mapY:number,side:CoastBank):number{
 const y=wrapCoast(mapY);
 for(let i=1;i<BANK_SHIFT_KNOTS.length;i++){
  const [y0,l0,r0]=BANK_SHIFT_KNOTS[i-1],[y1,l1,r1]=BANK_SHIFT_KNOTS[i];
  if(y<=y1){
   const t=(y-y0)/Math.max(1,y1-y0),smooth=.5-.5*Math.cos(t*Math.PI);
   return side<0?l0+(l1-l0)*smooth:r0+(r1-r0)*smooth;
  }
 }
 return side<0?24:30;
}

export function rawCoastBoundaryAtMapY(mapY:number,side:CoastBank):number{
 const y=wrapCoast(mapY);
 const bounds:number[]=[];
 for(const [start,points] of [[-64,side<0?harborLeft:harborRight],[1984,side<0?harborLeft:harborRight],[960,side<0?leisureLeft:leisureRight],[-1088,side<0?leisureLeft:leisureRight]] as const){
  if(y>=start&&y<start+COAST_PANEL_HEIGHT)bounds.push(interpolate(points,(y-start)/COAST_PANEL_HEIGHT)*COAST_MAP_WIDTH);
 }
 return side<0?Math.max(...bounds):Math.min(...bounds);
}

function traceCoastBoundary(worldY:number,side:CoastBank):number{
 const mapY=wrapCoast(worldY+COAST_MAP_OFFSET);
 const rawEdge=rawCoastBoundaryAtMapY(mapY,side);
 const shift=coastBankShift(mapY,side);
 const edge=side<0?Math.max(14,rawEdge-shift):Math.min(COAST_MAP_WIDTH,rawEdge+shift);
 // The trace includes the turquoise shelf: hulls may enter its outer 10px of water.
 return side<0?Math.max(0,edge-10):edge>=COAST_MAP_WIDTH-1?COAST_MAP_WIDTH:Math.min(COAST_MAP_WIDTH,edge+10);
}

// Cache the immutable trace once; navigation scans rows many times per frame.
const leftRows=Float64Array.from({length:COAST_MAP_PERIOD},(_,y)=>traceCoastBoundary(y,-1));
const rightRows=Float64Array.from({length:COAST_MAP_PERIOD},(_,y)=>traceCoastBoundary(y,1));
export function paintedCoastBoundary(worldY:number,side:CoastBank):number{
 const y=wrapCoast(worldY),i=Math.floor(y),rows=side<0?leftRows:rightRows;
 return rows[i]+(rows[(i+1)%COAST_MAP_PERIOD]-rows[i])*(y-i);
}

function mapSocketX(rawX:number,rawY:number,side:CoastBank):number{
 const shift=coastBankShift(rawY,side);
 return Math.round(side<0?rawX-shift:rawX+shift);
}

/** Socket positions are on the painted stone platforms, quay and clear sand. */
export const COAST_GUN_SOCKETS=Object.freeze([
 {id:0,side:-1 as const,x:54,y:107}, // harbor stone terrace
 {id:1,side:-1 as const,x:43,y:487}, // clear sand north of fishing hut
 {id:2,side:1 as const,x:345,y:749}, // harbor quay
 {id:3,side:-1 as const,x:54,y:1092}, // leisure northern terrace
 {id:4,side:1 as const,x:313,y:1187}, // center of tower forecourt, clear of stairs
 {id:5,side:-1 as const,x:55,y:1720}, // leisure southern terrace
].map(s=>({...s,x:mapSocketX(s.x,s.y,s.side),y:s.y-COAST_MAP_OFFSET})));
