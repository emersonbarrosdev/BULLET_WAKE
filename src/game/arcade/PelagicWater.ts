/** One artist-authored repeatable water tile. No complete maps, seam covers or region swaps.
 * UV coordinates move opposite the visible image. Coast and water therefore both move down.
 */
export const WATER_TILE_SIZE=1024;
export const WATER_SCALE=.5;
export function waterScrollOffset(scroll:number,time:number):number{return -(scroll+time*.7)/WATER_SCALE;}
/** Gentle ambient surface sway so open water stays alive even when scroll decelerates. */
export function waterDriftX(time:number):number{
 return Math.sin(time*.36)*3.8+Math.cos(time*.19)*1.9;
}
/** Secondary deeper swell drifting faster with subtle cross-current. */
export function swellScrollOffset(scroll:number,time:number):{x:number;y:number}{
 return{
  x:-Math.sin(time*.24)*5.4+Math.cos(time*.13)*2.2,
  y:-(scroll*1.16+time*9.2)/(WATER_SCALE*1.45),
 };
}
/** Subsurface caustic shimmer independent of scroll pauses. */
export function causticsScrollOffset(scroll:number,time:number):{x:number;y:number;alpha:number}{
 return{
  x:Math.sin(time*.31)*4.6+Math.cos(time*.17)*2.1,
  y:-(scroll/.42+time*5.4),
  alpha:.14+.045*Math.sin(time*1.15)+.02*Math.cos(time*2.3),
 };
}
