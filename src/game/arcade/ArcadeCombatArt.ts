import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';
export const SUPPLY_ART='arc-supply-v2',SUB_ART='arc-submarine-v2',BOMB_ART='arc-bomb-v2',BLAST_ART='arc-colossal-v2';
function frames(scene:Phaser.Scene,key:string,columns:number,rows:number):void{
 const t=scene.textures.get(key),s=t.getSourceImage() as HTMLImageElement;
 if(t.has('0'))return;
 for(let i=0;i<columns*rows;i++){
  const x=Math.round(i%columns*s.width/columns),y=Math.round(Math.floor(i/columns)*s.height/rows);
  t.add(i,0,x,y,Math.round((i%columns+1)*s.width/columns)-x,Math.round((Math.floor(i/columns)+1)*s.height/rows)-y);
 }
}
export function installCombatArt(scene:Phaser.Scene):void{
 frames(scene,SUPPLY_ART,4,4);frames(scene,SUB_ART,2,1);frames(scene,BOMB_ART,2,2);frames(scene,BLAST_ART,4,3);
 // Build 6-frame animated water-hugging spritesheets for naval hulls (4=boat, 5=ship).
 // Proportions scale by `u = cw / 100` so bow V-foam, side wave collars, and stern churn stay crisp at gameplay scale.
 for(const frame of[4,5]){
  const key='arc-wet-hull-'+frame;if(scene.textures.exists(key))continue;
  const source=scene.textures.get('arc-enemies'),f=source.get(frame),image=source.getSourceImage() as HTMLImageElement;
  const cw=f.cutWidth,ch=f.cutHeight,framesCount=6,u=cw/100;
  const scratch=document.createElement('canvas');scratch.width=cw;scratch.height=ch;
  const sc=scratch.getContext('2d',{willReadFrequently:true})!;
  sc.drawImage(image,f.cutX,f.cutY,cw,ch,0,0,cw,ch);
  const srcImg=sc.getImageData(0,0,cw,ch),sd=srcImg.data;
  let minY=ch,maxY=0;
  const leftEdge=new Int16Array(ch).fill(cw),rightEdge=new Int16Array(ch).fill(-1);
  for(let y=0;y<ch;y++){
   for(let x=0;x<cw;x++){
    if(sd[(y*cw+x)*4+3]>=40){
     if(y<minY)minY=y;if(y>maxY)maxY=y;
     if(x<leftEdge[y])leftEdge[y]=x;
     if(x>rightEdge[y])rightEdge[y]=x;
    }
   }
  }
  const spanY=Math.max(1,maxY-minY);
  const topProbeY=Math.min(maxY,Math.round(minY+spanY*.14));
  const botProbeY=Math.max(minY,Math.round(maxY-spanY*.14));
  const topW=rightEdge[topProbeY]>=0?rightEdge[topProbeY]-leftEdge[topProbeY]:cw;
  const botW=rightEdge[botProbeY]>=0?rightEdge[botProbeY]-leftEdge[botProbeY]:cw;
  // Determine which end is the narrower pointed bow vs the wider stern transom (+1 = down from minY)
  const dir=topW<=botW?1:-1;
  const bowY=dir>0?minY:maxY,sternY=dir>0?maxY:minY;
  const sampleRow=(frac:number)=>Math.max(0,Math.min(ch-1,Math.round(bowY+dir*frac*spanY)));

  // Soften dark cartoon outline around waterline edge into translucent cyan sea-wash so the hull sits IN the water
  const hullPx=sc.createImageData(cw,ch);hullPx.data.set(sd);
  const hd=hullPx.data;
  const rimPad=Math.max(2,Math.round(u*2.8));
  for(let y=1;y<ch-1;y++)for(let x=1;x<cw-1;x++){
   const i=(y*cw+x)*4;if(sd[i+3]<24||rightEdge[y]<0)continue;
   const distSide=Math.min(x-leftEdge[y],rightEdge[y]-x);
   const distEnd=Math.min(Math.abs(y-minY),Math.abs(y-maxY));
   const edgeDist=Math.min(distSide,distEnd);
   const darkInk=(hd[i]+hd[i+1]+hd[i+2])<195;
   if(edgeDist<=rimPad&&darkInk){
    const k=1-edgeDist/(rimPad+1);
    hd[i]=Math.round(hd[i]*(1-k*.55)+42*(k*.55));
    hd[i+1]=Math.round(hd[i+1]*(1-k*.55)+198*(k*.55));
    hd[i+2]=Math.round(hd[i+2]*(1-k*.55)+238*(k*.55));
    hd[i+3]=Math.round(hd[i+3]*(1-k*.32));
   }
  }
  sc.putImageData(hullPx,0,0);

  const t=scene.textures.createCanvas(key,cw*framesCount,ch)!,c=t.context;
  for(let fi=0;fi<framesCount;fi++){
   const ox=fi*cw,phase=fi/framesCount*Math.PI*2;
   const surge=fi/framesCount;

   // 1. Deep submerged shadow pocket under hull so craft rests inside water volume
   c.save();
   for(let s=0;s<16;s++){
    const ry=sampleRow(s/15);
    if(rightEdge[ry]<0)continue;
    const hw=(rightEdge[ry]-leftEdge[ry])*.56+u*4.2,cx=(leftEdge[ry]+rightEdge[ry])*.5;
    c.fillStyle='rgba(2,20,56,0.34)';
    c.beginPath();c.ellipse(ox+cx+u*1.2,ry+u*1.5,hw,u*3.6,0,0,Math.PI*2);c.fill();
   }
   c.restore();

   // 2. Bold outer concentric aqua ripple rings framing hull waterline (animated outward across frames)
   c.save();
   for(let r=0;r<2;r++){
    const exp=(surge+r*.5)%1;
    const pad=u*(2.4+exp*6.8);
    c.strokeStyle=`rgba(116,242,255,${((1-exp)*.66).toFixed(2)})`;
    c.lineWidth=u*(2.2-exp*.9);
    c.lineCap='round';c.lineJoin='round';
    for(const side of[-1,1]){
     c.beginPath();
     let started=false;
     for(let s=0;s<=14;s++){
      const frac=s/14*.98,ry=sampleRow(frac);
      if(rightEdge[ry]<0)continue;
      const ex=side<0?leftEdge[ry]:rightEdge[ry];
      const ripple=Math.sin(frac*9-phase+r*1.8)*u*1.4;
      const px=ox+ex+side*(pad*(.45+frac*.75)+ripple);
      const py=ry-dir*u*exp*2;
      if(!started){c.moveTo(px,py);started=true;}else c.lineTo(px,py);
     }
     if(started)c.stroke();
    }
   }
   c.restore();

   // 3. Draw hull shifted slightly with wave heave across frames
   const frameHeave=Math.sin(phase)*u*1.1;
   c.drawImage(scratch,ox,frameHeave);

   // 4. Smooth continuous undulating waterline surf ribbon hugging hull contours + bow crest (no dotted beads)
   c.save();
   c.lineCap='round';c.lineJoin='round';
   for(const side of[-1,1]){
    // Continuous outer turquoise water-break ribbon sliding bow -> stern
    c.strokeStyle='rgba(72,232,255,0.48)';c.lineWidth=u*4.2;
    c.beginPath();
    for(let s=0;s<=18;s++){
     const frac=s/18*.96,ry=sampleRow(frac);
     if(rightEdge[ry]<0)continue;
     const ex=side<0?leftEdge[ry]:rightEdge[ry];
     const swell=Math.sin(frac*11-phase)*.5+.5;
     const px=ox+ex+side*(u*1.8+swell*u*2.4+frac*u*2.2);
     if(s===0)c.moveTo(px,ry+frameHeave);else c.lineTo(px,ry+frameHeave);
    }
    c.stroke();
    // Inner crisp variable-width white foam contact edge along gunwale
    for(let s=0;s<16;s++){
     const f0=s/16*.94,f1=(s+1)/16*.94,r0=sampleRow(f0),r1=sampleRow(f1);
     if(rightEdge[r0]<0||rightEdge[r1]<0)continue;
     const e0=side<0?leftEdge[r0]:rightEdge[r0],e1=side<0?leftEdge[r1]:rightEdge[r1];
     const crest=Math.sin((f0+.03)*12-phase)*.5+.5;
     c.strokeStyle=`rgba(244,255,255,${(.38+.52*crest)*(1-f0*.32)})`;
     c.lineWidth=u*(1.2+crest*1.9);
     c.beginPath();
     c.moveTo(ox+e0+side*(u*1.0+crest*u*1.1),r0+frameHeave);
     c.lineTo(ox+e1+side*(u*1.0+crest*u*1.1),r1+frameHeave);
     c.stroke();
    }
   }
   // Crisp white bow V-splash collar cutting through water ahead of bow tip
   const tipY=sampleRow(.06)+frameHeave;
   const tipCx=rightEdge[Math.round(tipY)]>=0?(leftEdge[Math.round(tipY)]+rightEdge[Math.round(tipY)])*.5:cw*.5;
   const tipSpread=u*(6.5+Math.sin(phase)*1.6);
   c.strokeStyle='rgba(120,244,255,0.62)';c.lineWidth=u*3.4;
   c.beginPath();c.moveTo(ox+tipCx-tipSpread*1.1,tipY+dir*u*8.5);c.quadraticCurveTo(ox+tipCx,tipY-dir*u*3.6,ox+tipCx+tipSpread*1.1,tipY+dir*u*8.5);c.stroke();
   c.strokeStyle='rgba(248,255,255,0.92)';c.lineWidth=u*1.8;
   c.beginPath();c.moveTo(ox+tipCx-tipSpread,tipY+dir*u*7.2);c.quadraticCurveTo(ox+tipCx,tipY-dir*u*2.8,ox+tipCx+tipSpread,tipY+dir*u*7.2);c.stroke();

   // 5. Smooth feathered stern transom prop-wash fan streaks (continuous curves, not beads)
   const stY=sampleRow(.95);
   const stCx=rightEdge[stY]>=0?(leftEdge[stY]+rightEdge[stY])*.5:cw*.5;
   for(let j=-2;j<=2;j++){
    const sway=Math.sin(phase+j*1.1)*u*2.2;
    const x0=ox+stCx+j*u*2.6,y0=sternY-dir*u*1.5;
    const x1=ox+stCx+j*u*4.8+sway,y1=Math.max(u*2,Math.min(ch-u*2,sternY+dir*u*14));
    c.strokeStyle=j===0?'rgba(240,255,255,0.52)':'rgba(116,242,255,0.44)';
    c.lineWidth=j===0?u*2.8:u*1.8;
    c.beginPath();c.moveTo(x0,y0);c.quadraticCurveTo((x0+x1)*.5+sway*.5,(y0+y1)*.5,x1,y1);c.stroke();
   }
   c.restore();
  }
  for(let fi=0;fi<framesCount;fi++)t.add(fi,0,fi*cw,0,cw,ch);
  t.refresh();
 }
 // Naval boss hulls (frames 0, 1, 2 of arc-boss) also sit in the water:
 // blend the lower bow, stern waterline, and outer pontoon rims into turquoise ocean water
 // so the warship looks submerged in the sea rather than floating in mid-air.
 for(const frame of[0,1,2]){
  const key='arc-wet-boss-'+frame;if(scene.textures.exists(key))continue;
  const source=scene.textures.get('arc-boss'),f=source.get(frame),image=source.getSourceImage() as HTMLImageElement;
  const t=scene.textures.createCanvas(key,f.cutWidth,f.cutHeight)!,c=t.context;
  c.drawImage(image,f.cutX,f.cutY,f.cutWidth,f.cutHeight,0,0,f.cutWidth,f.cutHeight);
  const pixels=c.getImageData(0,0,f.cutWidth,f.cutHeight),d=pixels.data;
  const w=f.cutWidth,h=f.cutHeight;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4;if(d[i+3]<8)continue;
   const nx=Math.abs(x/w-.5)*2,ny=y/h;
   const bowSubmerge=Math.max(0,Math.min(1,(ny-.68)/.24));
   const sternSubmerge=Math.max(0,Math.min(1,(.24-ny)/.18));
   const pontoonEdge=Math.max(0,Math.min(1,(nx-.58)/.26));
   const depth=Math.max(bowSubmerge,sternSubmerge*.6,pontoonEdge*.72);
   const mix=depth*.48;
   d[i]=d[i]*(1-mix)+18*mix;
   d[i+1]=d[i+1]*(1-mix)+152*mix;
   d[i+2]=d[i+2]*(1-mix)+196*mix;
   d[i+3]=Math.max(140,Math.round(d[i+3]*(1-depth*.18)));
  }
  c.putImageData(pixels,0,0);t.refresh();
 }
}

/** A separate 40%-opaque red silhouette keeps 60% of the original art visible. */
export class HitOverlays{
 private sprites:Phaser.GameObjects.Image[]=[];private used=0;
 constructor(private scene:Phaser.Scene){}
 begin():void{this.used=0;for(const s of this.sprites)s.setVisible(false);}
 draw(source:Phaser.GameObjects.Sprite,remaining:number):void{
  if(remaining<=0||!source.visible)return;
  let overlay=this.sprites[this.used++];
  if(!overlay){overlay=this.scene.add.image(0,0,source.texture.key);this.sprites.push(overlay);}
  overlay.setTexture(source.texture.key,source.frame.name).setPosition(source.x,source.y).setOrigin(source.originX,source.originY)
   .setDisplaySize(source.displayWidth,source.displayHeight).setRotation(source.rotation).setFlip(source.flipX,source.flipY)
   .setDepth(source.depth+.01).setTint(0xff3232).setTintMode(Phaser.TintModes.FILL).setAlpha(.4*source.alpha).setVisible(true);
 }
 clear():void{for(const s of this.sprites)s.destroy();this.sprites=[];this.used=0;}
}

export class BombArt{
 private flight:Phaser.GameObjects.Image;
 private blast:Phaser.GameObjects.Image;
 private blend:Phaser.GameObjects.Image;
 constructor(scene:Phaser.Scene){
  this.flight=scene.add.image(0,0,BOMB_ART,0).setDepth(15).setVisible(false);
  this.blast=scene.add.image(0,0,BLAST_ART,0).setDepth(16).setVisible(false);
  this.blend=scene.add.image(0,0,BLAST_ART,1).setDepth(16.01).setVisible(false);
 }
 draw(w?:ArcadeWorld):void{
  this.flight.setVisible(false);this.blast.setVisible(false);this.blend.setVisible(false);
  const b=w?.bomb;if(!b||!w)return;
  if(b.phase==='flight')this.flight.setVisible(true).setFrame(Math.floor(b.age*14)%4).setPosition(b.x,b.y).setDisplaySize(48,48).setRotation(w.up?0:Math.PI/2);
  else{
   const phase=Math.min(11,(b.age-.65)/2.1*12),f=Math.floor(phase),mix=phase-f;
   const size=(w.up?155:180)*2.6,fade=Math.min(1,Math.max(0,(2.75-b.age)/.3));
   this.blast.setVisible(true).setFrame(f).setPosition(b.x,b.y).setDisplaySize(size,size).setAlpha((1-mix)*fade);
   this.blend.setVisible(true).setFrame(Math.min(11,f+1)).setPosition(b.x,b.y).setDisplaySize(size,size).setAlpha(mix*fade);
  }
 }
}
