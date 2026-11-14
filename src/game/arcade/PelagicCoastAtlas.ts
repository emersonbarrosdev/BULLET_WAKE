import Phaser from 'phaser';

export const FORMATION_TEXTURE='pelagic-review-formations';
export const FORMATION_COUNT=12;
const SIZE=384;
const TAU=Math.PI*2;
// Hand-registered water-contact paths for all 12 connected coastal frames.
const CONTACTS:ReadonlyArray<ReadonlyArray<readonly[number,number]>>=[
 [[.52,.10],[.54,.24],[.50,.40],[.56,.58],[.58,.76],[.54,.92],[.24,.94],[.12,.82]],
 [[.50,.12],[.46,.28],[.40,.46],[.38,.66],[.42,.82],[.50,.94],[.78,.92],[.88,.80]],
 [[.52,.10],[.50,.28],[.64,.44],[.66,.60],[.65,.78],[.54,.92],[.25,.93],[.14,.80]],
 [[.52,.10],[.46,.28],[.42,.48],[.40,.68],[.46,.86],[.66,.93],[.86,.84]],
 [[.52,.10],[.48,.28],[.56,.46],[.58,.64],[.54,.82],[.48,.94],[.22,.92]],
 [[.22,.26],[.18,.52],[.26,.78],[.50,.90],[.76,.82],[.82,.54],[.74,.26]],
 [[.22,.22],[.18,.48],[.24,.74],[.48,.90],[.74,.84],[.80,.56],[.74,.24]],
 [[.48,.10],[.46,.26],[.36,.44],[.36,.64],[.44,.82],[.56,.94],[.82,.90]],
 [[.52,.10],[.54,.28],[.56,.48],[.58,.68],[.56,.88],[.32,.94],[.14,.84]],
 [[.50,.10],[.46,.28],[.40,.48],[.38,.68],[.48,.88],[.72,.94],[.88,.84]],
 [[.48,.10],[.52,.26],[.64,.44],[.66,.62],[.64,.80],[.52,.92],[.24,.93]],
 [[.44,.10],[.46,.28],[.44,.48],[.42,.68],[.46,.88],[.68,.94],[.86,.84]],
];
function contactDistance(x:number,y:number,frame:number):number{
 let distance=Infinity;const path=CONTACTS[frame]??CONTACTS[0];
 for(let i=1;i<path.length;i++){
  const [ax,ay]=path[i-1].map(v=>v*SIZE),[bx,by]=path[i].map(v=>v*SIZE);
  const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
  distance=Math.min(distance,Math.hypot(x-ax-dx*t,y-ay-dy*t));
 }return distance;
}

/** Effects are derived from the unmodified asset alpha, never from a color-key cutout.
 * Native illustration stays intact. These are local water/contact masks, not scene fog. */
export function installFormationEffects(scene:Phaser.Scene):void{
 if(scene.textures.exists('pelagic-shallows-11'))return;
 const source=scene.textures.get(FORMATION_TEXTURE).getSourceImage() as HTMLImageElement;
 for(let frame=0;frame<FORMATION_COUNT;frame++){
  if(scene.textures.exists('pelagic-shallows-'+frame))continue;
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
   if(dist>52||edge<=0)continue;
   const shore=contactDistance(x,y,frame),contact=Math.max(0,1-shore/54);
   if(contact===0)continue;
   const width=34+8*Math.sin(y*.038+x*.044)+5*Math.cos(x*.081-y*.052);
   const t=Math.max(0,1-dist/width),soft=t*t*(3-2*t);
   // Marine blue -> shallow turquoise lagoon glow, softly dissolving into the live ocean.
   p.data[idx]=20+soft*28;p.data[idx+1]=168+soft*64;p.data[idx+2]=196+soft*36;
   p.data[idx+3]=soft*215*edge*contact;
   if(y<SIZE*.08)continue;
   for(let n=0;n<4;n++){
    const phase=n*Math.PI/2,breakup=Math.sin(x*.13+y*.041+phase)+Math.cos(y*.19-x*.07-phase);
    const surge=2.8+Math.sin(phase+y*.035)*1.7;
    const outerBand=Math.max(0,1-Math.abs(dist-(surge+6.5))/3.2)*.52;
    const innerBand=Math.max(0,1-Math.abs(dist-surge)/4.2);
    const alpha=(innerBand+outerBand)*Math.max(.14,breakup)*255*edge*Math.min(1,contact*3);
    frames[n].data.set([242,255,254,Math.min(250,alpha)],idx);
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
  const a=x/512*TAU,b=y/512*TAU;
  const n=.5+.24*Math.sin(a*2+b)+.16*Math.cos(b*3-a*2)+.11*Math.sin(a*5+b*3);
  // Subtle lateral shoaling (shallower turquoise near left/right edges, deeper cobalt trench in center)
  const centerDist=Math.abs(x/512-.5)*2;
  const shoal=Math.pow(centerDist,1.6)*.28;
  const i=(y*512+x)*4;
  p.data.set([
   Math.min(255,4+n*7+shoal*18),
   Math.min(255,40+n*30+shoal*58),
   Math.min(255,84+n*52+shoal*66),
   255
  ],i);
 }
 tex.context.putImageData(p,0,0);tex.refresh();return key;
}
export function installOceanCausticsTexture(scene:Phaser.Scene):string{
 const key='pelagic-caustics-review';if(scene.textures.exists(key))return key;
 const tex=scene.textures.createCanvas(key,512,512)!,p=tex.context.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const a=x/512*TAU,b=y/512*TAU;
  const ridge1=Math.max(0,1-Math.abs(Math.sin(a*5+Math.cos(b*3))+Math.cos(b*6+Math.sin(a*4)))*1.85);
  const ridge2=Math.max(0,1-Math.abs(Math.sin(a*8-b*4)+Math.cos(b*7+a*3))*2.1);
  const c=Math.min(1,ridge1**2.6+ridge2**3*.65);
  p.data.set([135,236,248,c*92],(y*512+x)*4);
 }
 tex.context.putImageData(p,0,0);tex.refresh();return key;
}
/** Creates an 8-frame animated 2.5D ocean wave-crest & whitecap spritesheet (512x64, eight 64x64 frames). */
export function installWaveCrestTextures(scene:Phaser.Scene):string{
 const key='pelagic-wave-crests';if(scene.textures.exists(key))return key;
 const tex=scene.textures.createCanvas(key,512,64)!;
 const ctx=tex.context;
 for(let f=0;f<8;f++){
  const ox=f*64,phase=f/8*TAU;
  const img=ctx.createImageData(64,64);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   const nx=(x-32)/29;
   if(Math.abs(nx)>1)continue;
   const envX=Math.cos(nx*Math.PI*.5)**1.9;
   // Gentle S-curved ocean swell crest with travelling ripple
   const arch=Math.sin(nx*2.6+phase*.5)*3.2-Math.cos(nx*Math.PI*.7)*2.4+Math.sin(nx*5.5+phase)*1.1;
   const dy=y-(32+arch);
   const idx=(y*64+x)*4;
   // 2.5D subsurface turquoise-cobalt trough shadow below the swell
   if(dy>-1&&dy<9){
    const shadowT=Math.max(0,1-Math.abs(dy-3.8)/5.2)*envX;
    img.data.set([6,74,124,shadowT*95],idx);
   }
   // Luminous cyan-turquoise wave face
   if(dy>=-4&&dy<=3.5){
    const swellT=Math.max(0,1-Math.abs(dy+.3)/3.8)*envX;
    img.data.set([64,212,235,swellT*145],idx);
   }
   // Delicate white-foam crest with animated breakup and secondary trailing ripple
   const crestDist=Math.abs(dy+.9-Math.sin(nx*7-phase)*.5);
   const trailDist=Math.abs(dy-4.6-Math.cos(nx*5+phase)*.6);
   if(crestDist<2.2){
    const foamBreak=.6+.4*Math.sin(nx*8+phase*2)+.25*Math.cos(nx*13-phase);
    const foamA=Math.max(0,1-crestDist/2.2)*envX*Math.max(0,Math.min(1,foamBreak))*215;
    if(foamA>img.data[idx+3])img.data.set([238,255,255,foamA],idx);
   }else if(trailDist<1.6){
    const trailA=Math.max(0,1-trailDist/1.6)*envX*.48*190;
    if(trailA>img.data[idx+3])img.data.set([172,248,255,trailA],idx);
   }
  }
  ctx.putImageData(img,ox,0);
  tex.add(f,0,ox,0,64,64);
 }
 tex.refresh();
 return key;
}
/** Creates a 2-frame coastal connector texture (Frame 0: feathered submerged coral reef; Frame 1: coastal stepping-stone boulders & surf). */
export function installCoastalShoalTexture(scene:Phaser.Scene):string{
 const key='pelagic-coastal-shoal';if(scene.textures.exists(key))return key;
 const S=192,tex=scene.textures.createCanvas(key,S*2,S)!,ctx=tex.context;
 // Frame 0: Softly feathered submerged coral reef (eliminates any hard oval outline)
 if(scene.textures.exists('pelagic-archipelago')){
  const src=scene.textures.get('pelagic-archipelago').getSourceImage() as HTMLImageElement;
  ctx.drawImage(src,512,512,512,512,0,0,S,S);
 }
 const f0=ctx.getImageData(0,0,S,S);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const dx=(x-S/2)/(S*.44),dy=(y-S/2)/(S*.42),r=Math.hypot(dx,dy);
  const idx=(y*S+x)*4;
  const noise=.12*Math.sin(x*.09+y*.07)+.08*Math.cos(x*.13-y*.11);
  const fade=Math.max(0,Math.min(1,1-(r+noise-.38)/.55));
  const smooth=fade*fade*(3-2*fade);
  // Tint slightly toward underwater turquoise-cobalt and feather edges smoothly
  f0.data[idx]=Math.round(f0.data[idx]*.68+18*.32);
  f0.data[idx+1]=Math.round(f0.data[idx+1]*.78+165*.22);
  f0.data[idx+2]=Math.round(f0.data[idx+2]*.84+205*.16);
  f0.data[idx+3]=Math.round(f0.data[idx+3]*smooth*.68);
 }
 ctx.putImageData(f0,0,0);
 tex.add(0,0,0,0,S,S);

 // Frame 1: Coastal stepping-stone boulders + turquoise shallows for bridging adjacent coastal formations
 if(scene.textures.exists(FORMATION_TEXTURE)){
  const src=scene.textures.get(FORMATION_TEXTURE).getSourceImage() as HTMLImageElement;
  ctx.drawImage(src,768,768,768,768,S,0,S,S);
 }
 const f1=ctx.getImageData(S,0,S,S);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const dx=(x-S/2)/(S*.46),dy=(y-S/2)/(S*.46),r=Math.hypot(dx,dy);
  const idx=(y*S+x)*4;
  if(f1.data[idx+3]<20&&r<.78){
   const glow=Math.pow(Math.max(0,1-r/.78),1.8);
   f1.data[idx]=24;f1.data[idx+1]=182;f1.data[idx+2]=208;f1.data[idx+3]=Math.round(glow*135);
  }
 }
 ctx.putImageData(f1,S,0);
 tex.add(1,0,S,0,S,S);
 tex.refresh();
 return key;
}
/** Creates a radially feathered abyssal vortex texture for the Pelagic boss approach (matches Reference Image 3 bottom panel). */
export function installVortexTexture(scene:Phaser.Scene):string{
 const key='pelagic-abyssal-vortex';if(scene.textures.exists(key))return key;
 const S=256,tex=scene.textures.createCanvas(key,S,S)!,ctx=tex.context;
 const img=ctx.createImageData(S,S);
 for(let y=0;y<S;y++)for(let x=0;x<S;x++){
  const dx=(x-S/2)/(S/2),dy=(y-S/2)/(S/2),r=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);
  const idx=(y*S+x)*4;
  if(r>=.96){img.data[idx+3]=0;continue;}
  const radial=Math.pow(Math.max(0,1-r/.96),1.35);
  // Multi-arm logarithmic spiral matching the cyan/turquoise maelstrom behind the boss
  const theta=ang+r*9.5;
  const arm1=.5+.5*Math.sin(theta*3);
  const arm2=.5+.5*Math.cos(theta*5-r*6);
  const foamRing=Math.max(0,1-Math.abs(r-.56-Math.sin(ang*3)*.06)/.18)*arm1;
  const innerRing=Math.max(0,1-Math.abs(r-.34-Math.cos(ang*2)*.04)/.14)*arm2;
  const core=Math.pow(Math.max(0,1-r/.32),1.6);
  const turq=Math.min(1,arm1*.65+arm2*.45)*(1-core*.85);
  const foam=Math.min(1,(foamRing+innerRing)*.85)*(1-core);
  img.data[idx]=Math.round(4*core+(24+turq*55)*(1-core)+foam*210);
  img.data[idx+1]=Math.round(18*core+(135+turq*95)*(1-core)+foam*250);
  img.data[idx+2]=Math.round(42*core+(168+turq*72)*(1-core)+foam*255);
  img.data[idx+3]=Math.min(242,Math.round(radial*(core*220+(1-core)*(130+turq*85+foam*90))));
 }
 ctx.putImageData(img,0,0);tex.refresh();
 return key;
}
