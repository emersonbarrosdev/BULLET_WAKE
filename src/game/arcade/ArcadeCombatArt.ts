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
 // Build 6-frame animated water-hugging spritesheets for naval hulls (4=boat, 5=ship)
 // with bow wave cut, gunwale spray droplets, stern churn, and crisp submerged rim shadow.
 for(const frame of[4,5]){
  const key='arc-wet-hull-'+frame;if(scene.textures.exists(key))continue;
  const source=scene.textures.get('arc-enemies'),f=source.get(frame),image=source.getSourceImage() as HTMLImageElement;
  const cw=f.cutWidth,ch=f.cutHeight,framesCount=6;
  const scratch=document.createElement('canvas');scratch.width=cw;scratch.height=ch;
  const sc=scratch.getContext('2d',{willReadFrequently:true})!;
  sc.drawImage(image,f.cutX,f.cutY,cw,ch,0,0,cw,ch);
  const srcImg=sc.getImageData(0,0,cw,ch),sd=srcImg.data;
  let bowY=ch,sternY=0;
  const leftEdge=new Int16Array(ch).fill(cw),rightEdge=new Int16Array(ch).fill(-1);
  for(let y=0;y<ch;y++){
   for(let x=0;x<cw;x++){
    if(sd[(y*cw+x)*4+3]>=40){
     if(y<bowY)bowY=y;if(y>sternY)sternY=y;
     if(x<leftEdge[y])leftEdge[y]=x;
     if(x>rightEdge[y])rightEdge[y]=x;
    }
   }
  }
  // Subtle meniscus edge softening ONLY on outer 3px rim hugging water (never bleaching bow deck)
  const hullPx=sc.createImageData(cw,ch);hullPx.data.set(sd);
  const hd=hullPx.data;
  for(let y=1;y<ch-1;y++)for(let x=1;x<cw-1;x++){
   const i=(y*cw+x)*4;if(sd[i+3]<24)continue;
   const nearWater=x<=leftEdge[y]+3||x>=rightEdge[y]-3||y>=sternY-4;
   if(nearWater){
    const mix=y>=sternY-4?.32:.22;
    hd[i]=hd[i]*(1-mix)+20*mix;hd[i+1]=hd[i+1]*(1-mix)+152*mix;hd[i+2]=hd[i+2]*(1-mix)+198*mix;
   }
  }
  sc.putImageData(hullPx,0,0);

  const t=scene.textures.createCanvas(key,cw*framesCount,ch)!,c=t.context;
  const hullSpan=Math.max(1,sternY-bowY);
  for(let fi=0;fi<framesCount;fi++){
   const ox=fi*cw,ph=fi/framesCount*Math.PI*2;
   // 1. Subtle dark navy underwater keel shadow grounding hull into sea
   c.save();
   for(let y=bowY+6;y<=sternY+8;y+=3){
    if(y<0||y>=ch||rightEdge[y]<0)continue;
    const hw=(rightEdge[y]-leftEdge[y])*.52+5,cx=(leftEdge[y]+rightEdge[y])*.5;
    c.fillStyle='rgba(4,24,62,0.22)';
    c.beginPath();c.ellipse(ox+cx+2,y+3,hw,3.2,0,0,Math.PI*2);c.fill();
   }
   c.restore();

   // 2. Outer turquoise hull water displacement collar animated backward along sides
   c.save();
   for(let y=bowY+2;y<=Math.min(ch-4,sternY+12);y+=2){
    if(rightEdge[y]<0)continue;
    const prog=(y-bowY)/hullSpan;
    const wave=Math.sin(prog*11-ph);
    const flare=prog*4+2.5+wave*1.6;
    const lx=ox+leftEdge[y]-flare*.4,rx=ox+rightEdge[y]+flare*.4;
    c.fillStyle=`rgba(56,226,255,${(.34-.12*prog).toFixed(2)})`;
    c.beginPath();c.ellipse(lx,y,4.2+Math.max(0,wave)*2,2.4,0,0,Math.PI*2);c.fill();
    c.beginPath();c.ellipse(rx,y,4.2+Math.max(0,wave)*2,2.4,0,0,Math.PI*2);c.fill();
   }
   c.restore();

   // 3. Paint crisp hull sprite
   c.drawImage(scratch,ox,0);

   // 4. Crisp animated white seafoam ribbons hugging bow cut-water & gunwales + splash droplets
   c.save();
   for(const side of[-1,1]){
    for(let s=0;s<14;s++){
     const frac=(s/14+fi/framesCount*.18)%1;
     const y=Math.round(bowY+4+frac*hullSpan*.95);
     if(y<0||y>=ch||rightEdge[y]<0)continue;
     const edgeX=side<0?leftEdge[y]:rightEdge[y];
     const crest=Math.sin(frac*12-ph)*.5+.5;
     const px=ox+edgeX+side*(2+frac*8+crest*3.5);
     c.fillStyle=`rgba(244,255,255,${(.82-.45*frac)*(.55+.45*crest)})`;
     c.beginPath();c.ellipse(px,y,2.2+crest*1.8,4.2,side*(.22-frac*.15),0,Math.PI*2);c.fill();
     if(s%3===0){
      const dShift=((fi+s)%framesCount)/framesCount;
      const sx=ox+edgeX+side*(5+dShift*12+frac*6),sy=y+dShift*7;
      c.fillStyle=`rgba(236,255,255,${(1-dShift)*.72})`;
      c.beginPath();c.arc(sx,sy,1.4+(1-dShift)*1.4,0,Math.PI*2);c.fill();
     }
    }
   }
   // 5. Stern propeller wash boil trailing transom
   const cxHull=rightEdge[sternY-4]>=0?(leftEdge[sternY-4]+rightEdge[sternY-4])*.5:cw*.5;
   for(let j=0;j<8;j++){
    const flow=(j/8+fi/framesCount)%1;
    const wy=Math.min(ch-3,sternY+2+flow*22);
    const spread=Math.sin(j*2.3+ph)*(4+flow*11);
    c.fillStyle=j%2===0?`rgba(248,255,255,${((1-flow)*.72).toFixed(2)})`:`rgba(92,238,255,${((1-flow)*.55).toFixed(2)})`;
    c.beginPath();c.ellipse(ox+cxHull+spread,wy,4.5+flow*4,2.2+flow*1.5,0,0,Math.PI*2);c.fill();
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
