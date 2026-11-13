import Phaser from 'phaser';

/**
 * Fenda Pelágica: a single authored coastal material instead of piled-up island sprites.
 * The canvas is built ONCE at boot using the already-shipped pelagic-coast painted atlas.
 * Both banks meet at the repeating vertical seam; cobalt water stays untouched beneath.
 */
export const COAST_TEXTURE='pelagic-continuous-shores';
export const COAST_WIDTH=384;
export const COAST_PERIOD=1024;
const TAU=Math.PI*2;
type Side=-1|1;
const fract=(v:number)=>v-Math.floor(v);
const random=(n:number)=>fract(Math.sin(n*127.1+97.39)*43758.5453);

export function coastBoundary(y:number,side:Side):number{
 const t=TAU*y/COAST_PERIOD;
 const wave=16*Math.sin(t*2.0+(side<0?.4:2.7))
            +10*Math.sin(t*3.0+(side<0?1.1:2.1))
            +5*Math.sin(t*5.0+(side<0?.3:1.8));
 const width=77+wave;
 return side<0?width:COAST_WIDTH-width;
}

/** All geometry is periodic: screen terrain scrolls down while the player climbs. */
export function coastAtScroll(scroll:number,y:number,side:Side):number{
 return coastBoundary(((y-scroll)%COAST_PERIOD+COAST_PERIOD)%COAST_PERIOD,side);
}

function boundaryPath(ctx:CanvasRenderingContext2D,side:Side):void{
 ctx.beginPath();
 if(side<0){ctx.moveTo(0,0);ctx.lineTo(coastBoundary(0,side),0);}
 else {ctx.moveTo(COAST_WIDTH,0);ctx.lineTo(coastBoundary(0,side),0);}
 for(let y=4;y<=COAST_PERIOD;y+=4)ctx.lineTo(coastBoundary(y,side),y);
 if(side<0){ctx.lineTo(0,COAST_PERIOD);ctx.closePath();}
 else {ctx.lineTo(COAST_WIDTH,COAST_PERIOD);ctx.closePath();}
}

function shoreline(ctx:CanvasRenderingContext2D,side:Side):void{
 const draw=(color:string,width:number,offset:number):void=>{
  ctx.beginPath();ctx.moveTo(coastBoundary(0,side)+offset,0);
  for(let y=3;y<=COAST_PERIOD;y+=3)ctx.lineTo(coastBoundary(y,side)+offset,y);
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
 };
 // Foam is a narrow, CLEAN shoreline, never an alpha veil painted over the sea.
 draw('#076e97',9,side*1);
 draw('#19bdd4',6,side*1);
 draw('#98eff9',3,side*2);
 draw('#fcfff5',1.25,side*2);
 for(let i=0;i<170;i++){
  const y=random(i*13+(side<0?12:47))*COAST_PERIOD;
  const x=coastBoundary(y,side)+side*(3+random(i*29)*9);
  ctx.fillStyle=i%5===0?'rgba(255,255,255,.6)':'rgba(109,234,247,.32)';
  ctx.beginPath();ctx.ellipse(x,y,1+random(i*3)*3,.4+random(i*7)*1.1,0,0,TAU);ctx.fill();
 }
}

function detailLayer(ctx:CanvasRenderingContext2D,source:CanvasImageSource,side:Side):void{
 // Unlike the previous version: images are stamps INSIDE a single land mask.
 // The source atlas is never drawn as whole islands on the water.
 const frames=[0,1,6,1,0,6,1,0];
 for(let i=-1;i<7;i++){
  const id=(i+8)%8,frame=frames[id];
  const sx=(frame%4)*512,sy=Math.floor(frame/4)*512;
  const y=i*172+16+(side<0?0:53);
  const x=side<0?-54+(id%3)*10:COAST_WIDTH-120-(id%3)*9;
  ctx.globalAlpha=.96;
  ctx.drawImage(source,sx+36,sy+37,430,427,x,y,181,185);
 }
 ctx.globalAlpha=1;
}

function addRock(ctx:CanvasRenderingContext2D,x:number,y:number,size:number,seed:number):void{
 ctx.fillStyle='#263c4c';ctx.beginPath();ctx.ellipse(x+3,y+3,size*.7,size*.42,-.2,0,TAU);ctx.fill();
 ctx.fillStyle=seed%4===0?'#747477':'#918a79';
 ctx.beginPath();ctx.moveTo(x-size*.72,y+size*.28);ctx.lineTo(x-size*.36,y-size*.62);ctx.lineTo(x+size*.25,y-size*.72);ctx.lineTo(x+size*.66,y-size*.13);ctx.lineTo(x+size*.72,y+size*.34);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#d0baa0';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x-size*.36,y-size*.58);ctx.lineTo(x+size*.21,y-size*.62);ctx.lineTo(x+size*.62,y-size*.1);ctx.stroke();
 ctx.strokeStyle='rgba(51,60,64,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-size*.59);ctx.lineTo(x-size*.03,y+size*.1);ctx.lineTo(x-size*.34,y+size*.29);ctx.stroke();
}

function terrain(ctx:CanvasRenderingContext2D,source:CanvasImageSource,side:Side):void{
 ctx.save();boundaryPath(ctx,side);ctx.clip();
 const grad=ctx.createLinearGradient(side<0?0:COAST_WIDTH,0,side<0?132:COAST_WIDTH-132,0);
 grad.addColorStop(0,'#526b44');grad.addColorStop(.43,'#82a452');
 grad.addColorStop(.65,'#b5ac6e');grad.addColorStop(.82,'#f3d69a');grad.addColorStop(1,'#ffebac');
 ctx.fillStyle=grad;ctx.fillRect(0,0,COAST_WIDTH,COAST_PERIOD);
 for(let i=0;i<1300;i++){
  const y=random(i*31+71)*COAST_PERIOD;
  const x=side<0?random(i*63+11)*124:COAST_WIDTH-random(i*63+11)*124;
  const r=.4+random(i*13+8)*3.6;
  ctx.fillStyle=i%5===0?'rgba(74,99,51,.23)':i%3===0?'rgba(255,245,185,.45)':'rgba(127,94,63,.17)';
  ctx.beginPath();ctx.ellipse(x,y,r,r*.43,random(i*9)*.5,0,TAU);ctx.fill();
 }
 detailLayer(ctx,source,side);
 // The cliffs sit ON the continuous coast and never show as separate oval islets.
 for(let i=0;i<22;i++){
  const y=(i*61+random(i*3)*19+(side<0?21:46))%COAST_PERIOD;
  const bx=coastBoundary(y,side);
  const x=side<0?bx-(13+random(i*17)*21):bx+13+random(i*17)*21;
  addRock(ctx,x,y,7+random(i*19)*9,i);
 }
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
 terrain(ctx,atlas,-1);terrain(ctx,atlas,1);
 texture.refresh();
 return COAST_TEXTURE;
}
