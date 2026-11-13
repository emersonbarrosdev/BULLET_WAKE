export interface Box {left:number;right:number;top:number;bottom:number;}
export function clamp(v:number,a:number,b:number):number{return Math.max(a,Math.min(b,v));}
/** Earliest contact, including shots born above a boss's silhouette. */
export function sweepEllipse(ax:number,ay:number,bx:number,by:number,cx:number,cy:number,rx:number,ry:number):number|null{
 const x=(ax-cx)/rx,y=(ay-cy)/ry,dx=(bx-ax)/rx,dy=(by-ay)/ry,c=x*x+y*y-1;
 if(c<=0)return 0;const a=dx*dx+dy*dy;if(a<1e-10)return null;
 const b=2*(x*dx+y*dy),d=b*b-4*a*c;if(d<0)return null;
 const t=(-b-Math.sqrt(d))/(2*a);return t>=0&&t<=1?t:null;
}
