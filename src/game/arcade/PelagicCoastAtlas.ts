import Phaser from 'phaser';

/**
 * Fenda Pelágica: a single authored coastal material instead of piled-up island sprites.
 * The canvas is built ONCE at boot using the already-shipped pelagic-coast painted atlas.
 * Both banks meet at the repeating vertical seam; cobalt water stays untouched beneath.
 */
export const COAST_TEXTURE='pelagic-continuous-shores';
import {COAST_WIDTH,COAST_PERIOD,coastBoundary} from './PelagicCoastGeometry';
const TAU=Math.PI*2;
type Side=-1|1;
const fract=(v:number)=>v-Math.floor(v);
const random=(n:number)=>fract(Math.sin(n*127.1+97.39)*43758.5453);

function boundaryPath(ctx:CanvasRenderingContext2D,side:Side):void{
 ctx.beginPath();
 if(side<0){ctx.moveTo(0,0);ctx.lineTo(coastBoundary(0,side),0);}
 else {ctx.moveTo(COAST_WIDTH,0);ctx.lineTo(coastBoundary(0,side),0);}
 for(let y=4;y<=COAST_PERIOD;y+=4)ctx.lineTo(coastBoundary(y,side),y);
 if(side<0){ctx.lineTo(0,COAST_PERIOD);ctx.closePath();}
 else {ctx.lineTo(COAST_WIDTH,COAST_PERIOD);ctx.closePath();}
}

function shoreline(ctx:CanvasRenderingContext2D,side:Side):void{
 const line=(offset:number,color:string,width:number):void=>{
  ctx.beginPath();ctx.moveTo(coastBoundary(0,side)+offset,0);
  for(let y=3;y<=COAST_PERIOD;y+=3)ctx.lineTo(coastBoundary(y,side)+offset,y);
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
 };
 // Light foam is broken into short natural splashes. No continuous neon river.
 line(0,'#137b9f',3.2);
 line(side*1.7,'#72d8ec',1.8);
 for(let i=0;i<160;i++){
  const y=random(i*47+(side<0?20:80))*COAST_PERIOD;
  const shore=coastBoundary(y,side),length=1+random(i*19)*9;
  const x=shore+side*(2+random(i*7)*7);
  ctx.strokeStyle=i%3===0?'rgba(250,255,246,.88)':'rgba(176,240,250,.62)';
  ctx.lineWidth=.65+random(i*19+2)*.9;
  ctx.beginPath();ctx.moveTo(x,y);
  ctx.quadraticCurveTo(x+side*2,y+length*.5,x+side*1.3,y+length);
  ctx.stroke();
 }
}

function makeVegetationStamps(atlas:HTMLImageElement):HTMLCanvasElement[]{
 const frames=[0,1,6];
 return frames.map(frame=>{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas para recorte de vegetação indisponível');
  ctx.drawImage(atlas,(frame%4)*512,Math.floor(frame/4)*512,512,512,0,0,512,512);
  const pixels=ctx.getImageData(0,0,512,512),data=pixels.data;
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
   const i=(y*512+x)*4,r=data[i],g=data[i+1],b=data[i+2];
   const water=b>r*1.10&&g>r*.96&&b>g*.83;
   const sand=r>g*1.06&&g>b*1.07&&r>108;
   const background=r>231&&g>225&&b>214;
   if(water||sand||background){data[i+3]=0;continue;}
   const edge=Math.min(x,511-x,y,511-y);
   const feather=Math.min(1,Math.max(0,(edge-8)/27));
   data[i+3]=Math.round(data[i+3]*feather);
  }
  ctx.putImageData(pixels,0,0);
  return canvas;
 });
}
function detailLayer(ctx:CanvasRenderingContext2D,stamps:HTMLCanvasElement[],side:Side):void{
 const frames=[0,1,2,0,1,2,1,0];
 for(let i=-1;i<7;i++){
  const id=(i+8)%8,stamp=stamps[frames[id]];
  const y=i*173+9+(side<0?0:49);
  const x=side<0?-54+(id%3)*5:COAST_WIDTH-119-(id%3)*5;
  ctx.drawImage(stamp,x,y,175,182);
 }
}

function terrain(ctx:CanvasRenderingContext2D,stamps:HTMLCanvasElement[],side:Side):void{
 ctx.save();boundaryPath(ctx,side);ctx.clip();
 const grad=ctx.createLinearGradient(side<0?0:COAST_WIDTH,0,side<0?132:COAST_WIDTH-132,0);
 grad.addColorStop(0,'#9d9e65');grad.addColorStop(.12,'#bfb77a');
 grad.addColorStop(.28,'#e3c58c');grad.addColorStop(.65,'#f1d19a');grad.addColorStop(1,'#fae4b2');
 ctx.fillStyle=grad;ctx.fillRect(0,0,COAST_WIDTH,COAST_PERIOD);
 for(let i=0;i<1300;i++){
  const y=random(i*31+71)*COAST_PERIOD;
  const x=side<0?random(i*63+11)*124:COAST_WIDTH-random(i*63+11)*124;
  const r=.4+random(i*13+8)*3.6;
  ctx.fillStyle=i%5===0?'rgba(74,99,51,.23)':i%3===0?'rgba(255,245,185,.45)':'rgba(127,94,63,.17)';
  ctx.beginPath();ctx.ellipse(x,y,r,r*.43,random(i*9)*.5,0,TAU);ctx.fill();
 }
 detailLayer(ctx,stamps,side);
 ctx.restore();
 shoreline(ctx,side);
}

export function installCoastTexture(scene:Phaser.Scene):string{
 if(scene.textures.exists(COAST_TEXTURE))return COAST_TEXTURE;
 const atlas=scene.textures.get('pelagic-coast').getSourceImage() as HTMLImageElement;
 if(!atlas||atlas.naturalWidth<2048)throw Error('Spritesheet tropical não carregado');
 const texture=scene.textures.createCanvas(COAST_TEXTURE,COAST_WIDTH,COAST_PERIOD);
 if(!texture)throw Error('Não foi possível montar o litoral contínuo');
 const ctx=texture.context;
 const stamps=makeVegetationStamps(atlas);
 terrain(ctx,stamps,-1);terrain(ctx,stamps,1);
 texture.refresh();
 return COAST_TEXTURE;
}
