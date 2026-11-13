/** One artist-authored repeatable water tile. No complete maps, seam covers or region swaps.
 * UV coordinates move opposite the visible image. Coast and water therefore both move down.
 */
export const WATER_TILE_SIZE=1024;
export const WATER_SCALE=.5;
export function waterScrollOffset(scroll:number,time:number):number{return -(scroll+time*.7)/WATER_SCALE;}
