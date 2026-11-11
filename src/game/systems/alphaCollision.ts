/** Solid spans preserve concavities and holes; transparent sprite rectangles never collide. */
export interface AlphaMask { width:number; height:number; rows: number[][]; left:number; top:number; right:number; bottom:number; }
export function makeAlphaMask(width:number,height:number,alpha:ArrayLike<number>,threshold=128):AlphaMask {
  const rows:number[][]=[];let left=width,top=height,right=0,bottom=0;
  for(let y=0;y<height;y++){
    const spans:number[]=[];let start=-1;
    for(let x=0;x<=width;x++){
      const solid=x<width&&alpha[y*width+x]>=threshold;
      if(solid&&start<0)start=x;
      if(!solid&&start>=0){spans.push(start,x);left=Math.min(left,start);right=Math.max(right,x);top=Math.min(top,y);bottom=y+1;start=-1;}
    }
    rows.push(spans);
  }
  return {width,height,rows,left,top,right,bottom};
}
export function maskTouches(mask:AlphaMask,x:number,y:number,rx=0,ry=rx):boolean {
  if(x+rx<mask.left||x-rx>mask.right||y+ry<mask.top||y-ry>mask.bottom)return false;
  for(let row=Math.max(0,Math.floor(y-ry));row<=Math.min(mask.height-1,Math.floor(y+ry));row++){
    const dy=Math.max(row-y,0,y-row-1),spans=mask.rows[row];
    for(let i=0;i<spans.length;i+=2){
      const dx=Math.max(spans[i]-x,0,x-spans[i+1]);
      if(rx===0||ry===0){if(dx===0&&dy===0)return true;}
      else if(dx*dx/(rx*rx)+dy*dy/(ry*ry)<=1)return true;
    }
  }
  return false;
}
/** Earliest contact along a fast projectile path. Coordinates use mask pixels. */
export function sweepAlpha(mask:AlphaMask,ax:number,ay:number,bx:number,by:number,rx=0,ry=rx):number|null {
  let lo=0,hi=1;const dx=bx-ax,dy=by-ay;
  for(const [a,d,min,max] of [[ax,dx,mask.left-rx,mask.right+rx],[ay,dy,mask.top-ry,mask.bottom+ry]]){
    if(Math.abs(d)<1e-9){if(a<min||a>max)return null;continue;}
    const t0=(min-a)/d,t1=(max-a)/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
    if(lo>hi)return null;
  }
  const count=Math.max(1,Math.ceil(Math.hypot(dx,dy)*(hi-lo)/.5));
  for(let i=0;i<=count;i++){
    const t=lo+(hi-lo)*i/count;
    if(!maskTouches(mask,ax+dx*t,ay+dy*t,rx,ry))continue;
    let a=i?lo+(hi-lo)*(i-1)/count:lo,b=t;
    for(let j=0;j<6;j++){const mid=(a+b)/2;if(maskTouches(mask,ax+dx*mid,ay+dy*mid,rx,ry))b=mid;else a=mid;}
    return b;
  }
  return null;
}
