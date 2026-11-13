import Phaser from 'phaser';

export const FORMATION_TEXTURE='pelagic-review-formations';
const SIZE=384;
const TAU=Math.PI*2;
// Hand-registered water-contact paths. Elevated tree crowns, crane booms and roofs
// are deliberately excluded: their alpha outline is NOT the shoreline.
const CONTACTS:ReadonlyArray<ReadonlyArray<readonly[number,number]>>=[
 [[.85,.32],[.80,.42],[.65,.47],[.58,.55],[.62,.65],[.74,.70],[.84,.83],[.70,.92],[.44,.88],[.23,.79],[.15,.67]],
 [[.86,.42],[.90,.62],[.78,.79],[.60,.83],[.45,.94],[.21,.88],[.08,.78],[.12,.64],[.18,.53]],
 [[.73,.48],[.90,.50],[.90,.56],[.72,.58],[.73,.72],[.89,.74],[.89,.81],[.63,.83],[.54,.92],[.37,.91],[.17,.79]],
 [[.12,.47],[.26,.45],[.40,.50],[.44,.61],[.34,.72],[.18,.75],[.13,.86],[.32,.93],[.67,.91],[.84,.85],[.89,.69]],
 [[.87,.44],[.76,.54],[.63,.60],[.68,.74],[.48,.86],[.22,.89],[.10,.77]],
 [[.18,.65],[.42,.80],[.61,.86],[.84,.84],[.92,.72]],
 [[.16,.63],[.28,.79],[.51,.89],[.78,.86],[.91,.72]],
 [[.87,.38],[.86,.53],[.66,.61],[.65,.70],[.84,.79],[.88,.88],[.62,.92],[.25,.87],[.11,.73]],
];
function contactDistance(x:number,y:number,frame:number):number{
 let distance=Infinity;const path=CONTACTS[frame];
 for(let i=1;i<path.length;i++){
  const [ax,ay]=path[i-1].map(v=>v*SIZE),[bx,by]=path[i].map(v=>v*SIZE);
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  distance=Math.min(distance,Math.hypot(x-ax-dx*t,y-ay-dy*t));
 }return distance;
}

/** Effects are derived from the unmodified asset alpha, never from a color-key cutout.
 * Native illustration stays intact. These are local water/contact masks, not scene fog. */
export function installFormationEffects(scene:Phaser.Scene):void{
 if(scene.textures.exists('pelagic-shallows-0'))return;
 const source=scene.textures.get(FORMATION_TEXTURE).getSourceImage() as HTMLImageElement;
 for(let frame=0;frame<8;frame++){
  const c=document.createElement('canvas');c.width=c.height=SIZE;
  const ctx=c.getContext('2d',{willReadFrequently:true})!;
  ctx.drawImage(source,(frame%4)*768,Math.floor(frame/4)*768,768,768,0,0,SIZE,SIZE);
  const rgba=ctx.getImageData(0,0,SIZE,SIZE).data,d=new Float32Array(SIZE*SIZE);
  for(let i=0;i<d.length;i++)d[i]=rgba[i*4+3]>128?0:64;
  for(let y=1;y<SIZE;y++)for(let x=1;x<SIZE-1;x++){
   const i=y*SIZE+x;d[i]=Math.min(d[i],d[i-1]+1,d[i-SIZE]+1,d[i-SIZE-1]+1.414,d[i-SIZE+1]+1.414);
  }
  for(let y=SIZE-2;y>=0;y--)for(let x=SIZE-2;x>0;x--){
   const i=y*SIZE+x;d[i]=Math.min(d[i],d[i+1]+1,d[i+SIZE]+1,d[i+SIZE+1]+1.414,d[i+SIZE-1]+1.414);
  }
  const shelf=scene.textures.createCanvas('pelagic-shallows-'+frame,SIZE,SIZE)!;
  const p=shelf.context.createImageData(SIZE,SIZE);
  const foam=Array.from({length:4},(_,n)=>scene.textures.createCanvas('pelagic-surf-'+frame+'-'+n,SIZE,SIZE)!);
  const frames=foam.map(t=>t.context.createImageData(SIZE,SIZE));
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   const i=y*SIZE+x,idx=i*4,dist=d[i],edge=1-rgba[idx+3]/255;
   if(dist>48||edge<=0)continue;
   const shore=contactDistance(x,y,frame),contact=Math.max(0,1-shore/34);
   if(contact===0)continue;
   const width=30+7*Math.sin(y*.038+x*.044)+4*Math.cos(x*.081-y*.052);
   const t=Math.max(0,1-dist/width),soft=t*t*(3-2*t);
   // Marine blue -> shallow turquoise, softly dissolving into the live ocean.
   p.data[idx]=22+soft*22;p.data[idx+1]=160+soft*60;p.data[idx+2]=190+soft*30;
   p.data[idx+3]=soft*195*edge*contact;
   // Broken surf only at lower shoreline contacts, never around tree crowns.
   if(y<SIZE*.34)continue;
   for(let n=0;n<4;n++){
    const phase=n*Math.PI/2,breakup=Math.sin(x*.13+y*.041+phase)+Math.cos(y*.19-x*.07-phase);
    const surge=2.6+Math.sin(phase+y*.035)*1.6;
    const alpha=Math.max(0,1-Math.abs(dist-surge)/4)*Math.max(.1,breakup)*255*edge*Math.min(1,contact*3);
    frames[n].data.set([238,255,253,Math.min(245,alpha)],idx);
   }
  }
  shelf.context.putImageData(p,0,0);shelf.refresh();
  foam.forEach((tex,i)=>{tex.context.putImageData(frames[i],0,0);tex.refresh();});
 }
}
export function installOceanDepthTexture(scene:Phaser.Scene):string{
 const key='pelagic-depth-review';if(scene.textures.exists(key))return key;
 const tex=scene.textures.createCanvas(key,512,512)!,p=tex.context.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const a=x/512*TAU,b=y/512*TAU,n=.5+.22*Math.sin(a*2+b)+.15*Math.cos(b*3-a*2)+.1*Math.sin(a*5+b*3);
  const i=(y*512+x)*4;p.data.set([5+n*5,44+n*26,86+n*48,255],i);
 }
 tex.context.putImageData(p,0,0);tex.refresh();return key;
}
export function installOceanCausticsTexture(scene:Phaser.Scene):string{
 const key='pelagic-caustics-review';if(scene.textures.exists(key))return key;
 const tex=scene.textures.createCanvas(key,512,512)!,p=tex.context.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const a=x/512*TAU,b=y/512*TAU;
  const ridge=Math.max(0,1-Math.abs(Math.sin(a*5+Math.cos(b*3))+Math.cos(b*6+Math.sin(a*4)))*2);
  p.data.set([119,223,234,ridge**3*65],(y*512+x)*4);
 }
 tex.context.putImageData(p,0,0);tex.refresh();return key;
}
