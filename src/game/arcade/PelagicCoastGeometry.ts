/** Renderer-independent world geometry shared by tests and the authored coast. */
export const COAST_WIDTH=384;
export const COAST_PERIOD=1024;
const TAU=Math.PI*2;
export function coastBoundary(y:number,side:-1|1):number{
 const t=TAU*y/COAST_PERIOD;
 const wave=16*Math.sin(t*2.0+(side<0?.4:2.7))
            +10*Math.sin(t*3.0+(side<0?1.1:2.1))
            +5*Math.sin(t*5.0+(side<0?.3:1.8));
 const width=77+wave;
 return side<0?width:COAST_WIDTH-width;
}
export function coastAtScroll(scroll:number,y:number,side:-1|1):number{
 return coastBoundary(((y-scroll)%COAST_PERIOD+COAST_PERIOD)%COAST_PERIOD,side);
}
