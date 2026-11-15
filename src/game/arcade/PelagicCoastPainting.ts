import Phaser from 'phaser';
import {
 COAST_MAP_KEY,COAST_MAP_OFFSET,COAST_MAP_PERIOD,COAST_MAP_SCALE,
 coastBankShift,rawCoastBoundaryAtMapY,wrapCoast,
} from './PelagicCoastMap';

/** Assemble once. Visibility never chooses art, removes land or changes a connection. */
export function installCoastPainting(scene:Phaser.Scene):string{
 if(scene.textures.exists(COAST_MAP_KEY))return COAST_MAP_KEY;
 const texture=scene.textures.createCanvas(COAST_MAP_KEY,768,4096)!;
 const ctx=texture.context;
 const a=scene.textures.get('pelagic-coast-harbor-v2').getSourceImage() as HTMLImageElement;
 const b=scene.textures.get('pelagic-coast-leisure-v2').getSourceImage() as HTMLImageElement;
 ctx.drawImage(b,0,-2176,768,2304);ctx.drawImage(b,0,1920,768,2304);
 ctx.drawImage(a,0,-128,768,2304);ctx.drawImage(a,0,3968,768,2304);
 // A broad dissolve makes rocks and palms transparent. A minimum-error seam
 // follows matching foliage/water instead; only a 2px antialias band is blended.
 const join=(upper:HTMLImageElement,lower:HTMLImageElement)=>{
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;
  const c=canvas.getContext('2d',{willReadFrequently:true})!;
  c.drawImage(upper,0,upper.height*2048/2304,upper.width,upper.height*256/2304,0,0,768,256);
  const u=c.getImageData(0,0,768,256);
  c.drawImage(lower,0,0,lower.width,lower.height*256/2304,0,0,768,256);
  const l=c.getImageData(0,0,768,256),result=c.createImageData(768,256);
  const parent=new Int16Array(768*256);let previous=new Float64Array(256),next=new Float64Array(256);
  for(let x=0;x<768;x++){
   next.fill(Infinity);
   for(let y=24;y<232;y++){
    const i=(y*768+x)*4;
    const error=Math.abs(u.data[i]-l.data[i])+Math.abs(u.data[i+1]-l.data[i+1])+Math.abs(u.data[i+2]-l.data[i+2]);
    let best=y;
    for(let candidate=Math.max(24,y-2);candidate<=Math.min(231,y+2);candidate++)if(previous[candidate]<previous[best])best=candidate;
    next[y]=previous[best]+error+Math.abs(y-128)*.12;parent[x*256+y]=best;
   }
   [previous,next]=[next,previous];
  }
  const path=new Int16Array(768);let y=128;
  for(let candidate=24;candidate<232;candidate++)if(previous[candidate]<previous[y])y=candidate;
  for(let x=767;x>=0;x--){path[x]=y;y=parent[x*256+y];}
  for(let row=0;row<256;row++)for(let x=0;x<768;x++){
   const i=(row*768+x)*4,t=Math.max(0,Math.min(1,(row-path[x]+1)/2));
   for(let channel=0;channel<3;channel++)result.data[i+channel]=u.data[i+channel]*(1-t)+l.data[i+channel]*t;
   result.data[i+3]=255;
  }
  c.putImageData(result,0,0);return canvas;
 };
 const wrap=join(b,a);ctx.drawImage(wrap,0,-128);ctx.drawImage(wrap,0,3968);
 ctx.drawImage(join(a,b),0,1920);

 const srcImg=ctx.getImageData(0,0,768,4096),src=srcImg.data;
 // Cleanly heal the 3 tiny isolated mid-channel rocks in the source paintings
 // using nearby deep-water rows so boats, submarines and bosses never sit over a rock in open water.
 const healPatches:readonly[number,number,number,number,number][]=[
  [474,394,48,46,-170],   // harbor-v2 upper-right mid-channel rock
  [248,1424,46,44,-180],  // harbor-v2 lower-left mid-channel rock (under submarine)
  [512,2816,46,46,-170],  // leisure-v3 mid-channel rock
 ];
 for(const [cx,cy,rx,ry,dy] of healPatches){
  for(let y=Math.max(0,cy-ry);y<=Math.min(4095,cy+ry);y++){
   const ny=(y-cy)/ry;
   const donorY=(y+dy+4096)%4096;
   for(let x=Math.max(0,cx-rx);x<=Math.min(767,cx+rx);x++){
    const nx=(x-cx)/rx,d2=nx*nx+ny*ny;
    if(d2>=1)continue;
    const w=.5+.5*Math.cos(Math.sqrt(d2)*Math.PI);
    const dstIdx=(y*768+x)*4,srcIdx=(donorY*768+x)*4;
    for(let c=0;c<3;c++)src[dstIdx+c]=src[dstIdx+c]*(1-w)+src[srcIdx+c]*w;
   }
  }
 }

 // 1:1 Horizontal Coastal Translation:
 // Shifts the left shore left by shiftL and the right shore right by shiftR at exact 1:1 scale,
 // smoothly blending into the unmirrored, un-clamped deep-water core of the painting.
 const dstImg=ctx.createImageData(768,4096),dst=dstImg.data;
 const sample=(rowOffset:number,fx:number,ch:number)=>{
  const clamped=Math.max(0,Math.min(767,fx));
  const x0=Math.floor(clamped),x1=Math.min(767,x0+1),f=clamped-x0;
  return src[rowOffset+x0*4+ch]*(1-f)+src[rowOffset+x1*4+ch]*f;
 };
 for(let texY=0;texY<4096;texY++){
  const mapY=texY*COAST_MAP_SCALE;
  const rawL=rawCoastBoundaryAtMapY(mapY,-1)*2;
  const rawR=rawCoastBoundaryAtMapY(mapY,1)*2;
  const shiftL=coastBankShift(mapY,-1)*2;
  const shiftR=coastBankShift(mapY,1)*2;
  const newL=Math.max(28,rawL-shiftL);
  const newR=Math.min(768,rawR+shiftR);
  const center=(newL+newR)*.5;
  const rawCenter=(rawL+rawR)*.5;
  const feather=44;
  const rowOffset=texY*768*4;
  for(let x=0;x<768;x++){
   const out=rowOffset+x*4;
   const sxMid=rawCenter+(x-center)*.66;
   if(x<=newL){
    const sx=x+shiftL;
    for(let c=0;c<3;c++)dst[out+c]=sample(rowOffset,sx,c);
   }else if(x>=newR){
    const sx=x-shiftR;
    for(let c=0;c<3;c++)dst[out+c]=sample(rowOffset,sx,c);
   }else if(x<newL+feather){
    const t=.5-.5*Math.cos(((x-newL)/feather)*Math.PI);
    const sx=x+shiftL;
    for(let c=0;c<3;c++)dst[out+c]=sample(rowOffset,sx,c)*(1-t)+sample(rowOffset,sxMid,c)*t;
   }else if(x>newR-feather){
    const t=.5-.5*Math.cos(((newR-x)/feather)*Math.PI);
    const sx=x-shiftR;
    for(let c=0;c<3;c++)dst[out+c]=sample(rowOffset,sx,c)*(1-t)+sample(rowOffset,sxMid,c)*t;
   }else{
    for(let c=0;c<3;c++)dst[out+c]=sample(rowOffset,sxMid,c);
   }
   dst[out+3]=255;
  }
 }
 ctx.putImageData(dstImg,0,0);
 texture.refresh();return COAST_MAP_KEY;
}

/** Two copies cover every view, including the period seam, with exact world speed. */
export class PelagicCoastPainting{
 readonly strips:Phaser.GameObjects.Image[];
 constructor(scene:Phaser.Scene){
  const key=installCoastPainting(scene);
  this.strips=[0,1].map(()=>scene.add.image(192,0,key).setOrigin(0,0).setScale(COAST_MAP_SCALE).setDepth(-18.8).setVisible(false));
 }
 draw(scroll:number,visible:boolean):void{
  const top=-wrapCoast(COAST_MAP_OFFSET-scroll);
  this.strips.forEach((image,i)=>image.setVisible(visible).setPosition(192,top+i*COAST_MAP_PERIOD));
 }
 destroy():void{this.strips.forEach(image=>image.destroy());}
}
