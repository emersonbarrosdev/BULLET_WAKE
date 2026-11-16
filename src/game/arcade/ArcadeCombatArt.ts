import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';
import {EMPLACEMENT_TEXTURE,GUN_SMOKE_TEXTURE} from './PelagicEmplacements';
import {SUB_HULL_DISPLAY_W,SUB_SECTION_HEIGHT,subSectionCenterY,type SubModule} from './PelagicSubmarineBoss';
import {clamp} from './geometry';
import {spriteContact} from '../render/SpriteSilhouette';
export const SUPPLY_ART='arc-supply-v2',SUB_ART='arc-submarine-v2',BOMB_ART='arc-bomb-v2',BLAST_ART='arc-colossal-v2',SUB_HULL_ART='arc-sub-hull',SUB_SUBMERGED_ART='arc-sub-submerged',SUB_PARTS_ART='arc-sub-parts';
function frames(scene:Phaser.Scene,key:string,columns:number,rows:number):void{
 const t=scene.textures.get(key),s=t.getSourceImage() as HTMLImageElement;
 if(t.has('0'))return;
 for(let i=0;i<columns*rows;i++){
  const x=Math.round(i%columns*s.width/columns),y=Math.round(Math.floor(i/columns)*s.height/rows);
  t.add(i,0,x,y,Math.round((i%columns+1)*s.width/columns)-x,Math.round((Math.floor(i/columns)+1)*s.height/rows)-y);
 }
}
export function installCombatArt(scene:Phaser.Scene):void{
 frames(scene,SUPPLY_ART,4,4);frames(scene,SUB_ART,2,1);frames(scene,BOMB_ART,2,2);frames(scene,BLAST_ART,4,3);frames(scene,SUB_HULL_ART,5,1);frames(scene,SUB_PARTS_ART,4,2);
 if(scene.textures.exists(SUB_SUBMERGED_ART))frames(scene,SUB_SUBMERGED_ART,5,1);
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

   // 2. Draw hull shifted slightly with wave heave across frames (no geometric outer rings around enemies)
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

const SUB_PART_FRAME:{[K in SubModule['kind']]:{alive:number;dead:number;size:number}}={
 turret:{alive:0,dead:7,size:44},
 launcher:{alive:1,dead:5,size:46},
 armor:{alive:4,dead:5,size:48},
 bridge:{alive:2,dead:3,size:86},
 propeller:{alive:6,dead:5,size:50},
 reactor:{alive:4,dead:5,size:60},
};

export class SubmarineBossArt{
 private hullSprites:Phaser.GameObjects.Sprite[]=[];
 private submergedSprites:Phaser.GameObjects.Sprite[]=[];
 private partSprites=new Map<number,Phaser.GameObjects.Sprite>();
 private craterPool:Phaser.GameObjects.Sprite[]=[];
 private firePool:Phaser.GameObjects.Sprite[]=[];
 private smokePool:Phaser.GameObjects.Sprite[]=[];
 constructor(private scene:Phaser.Scene){
  for(let i=0;i<5;i++){
   const hasSub=scene.textures.exists(SUB_SUBMERGED_ART);
   this.submergedSprites.push(scene.add.sprite(384,-300,hasSub?SUB_SUBMERGED_ART:SUB_HULL_ART,i).setDepth(2.15).setVisible(false));
   this.hullSprites.push(scene.add.sprite(384,-300,SUB_HULL_ART,i).setDepth(3.1).setVisible(false));
  }
 }
 private borrow(pool:Phaser.GameObjects.Sprite[],used:number,texture:string,depth:number):Phaser.GameObjects.Sprite{
  let s=pool[used];
  if(!s){s=this.scene.add.sprite(0,0,texture).setDepth(depth);pool.push(s);}
  return s.setTexture(texture).setDepth(depth).setVisible(true);
 }
 hide():void{
  for(const s of this.hullSprites)s.setVisible(false);
  for(const s of this.submergedSprites)s.setVisible(false);
  for(const s of this.partSprites.values())s.setVisible(false);
  for(const s of this.craterPool)s.setVisible(false);
  for(const s of this.firePool)s.setVisible(false);
  for(const s of this.smokePool)s.setVisible(false);
 }
 hullContact(sectionIndex:number,ax:number,ay:number,bx:number,by:number,radius:number):number|null{
  const s=this.hullSprites[sectionIndex];
  if(!s||!s.visible)return null;
  return spriteContact(s,ax,ay,bx,by,radius);
 }
 draw(w:ArcadeWorld,overlays:HitOverlays,_g:Phaser.GameObjects.Graphics,quality:number):void{
  const b=w.boss,sub=b?.sub;
  if(!b||!sub||sub.phase==='done'){this.hide();return;}
  let cratersUsed=0,firesUsed=0,smokeUsed=0;
  const collapseK=sub.phase==='collapse'?clamp(sub.timer/3.6,0,1):0;
  const shakeX=sub.phase==='collapse'?Math.sin(sub.timer*47)*(1-collapseK*.4)*4.2:0;
  const shakeY=sub.phase==='collapse'?Math.cos(sub.timer*39)*(1-collapseK*.4)*2.6:0;
  const bob=sub.phase==='fight'?Math.sin(w.elapsed*1.9)*1.1:0;
  const sinkDrop=sub.phase==='collapse'?collapseK*18:0;
  const sinkScale=sub.phase==='collapse'?1-collapseK*.10:1;
  const subAlpha=sub.phase==='collapse'?(collapseK<.55?1:1-(collapseK-.55)/.45*.78):1;
  const hullTint=sub.phase==='collapse'&&collapseK>.40?0x459dc2:0xffffff;
  const liveParts=new Set<number>();

  for(const sec of sub.sections){
   const cy=subSectionCenterY(sub,sec.index)+bob+shakeY+sinkDrop;
   const visible=cy>-SUB_SECTION_HEIGHT*.75&&cy<432+SUB_SECTION_HEIGHT*.75;
   const submergedSprite=this.submergedSprites[sec.index];
   const hullSprite=this.hullSprites[sec.index];
   submergedSprite.setFrame(sec.index).setPosition(b.x+shakeX,cy).setDisplaySize(SUB_HULL_DISPLAY_W*sinkScale,(SUB_SECTION_HEIGHT+2)*sinkScale).setAlpha(subAlpha*.94).setVisible(visible);
   hullSprite.setFrame(sec.index).setPosition(b.x+shakeX,cy).setDisplaySize(SUB_HULL_DISPLAY_W*sinkScale,(SUB_SECTION_HEIGHT+2)*sinkScale).setAlpha(subAlpha*(sub.phase==='collapse'?Math.max(.18,1-collapseK*.75):1)).setTint(sec.hullFlash>0&&sec.index===sub.activeSection?0xffd0c4:hullTint).setVisible(visible);
   if(!visible)continue;

   for(const m of sec.marks){
    const mx=b.x+shakeX+m.dx*sinkScale,my=cy+m.dy*sinkScale;
    const crater=this.borrow(this.craterPool,cratersUsed++,SUB_PARTS_ART,4.2);
    crater.setFrame(5).setPosition(mx,my).setDisplaySize(30*m.size*sinkScale,30*m.size*sinkScale).setRotation((m.seed%7)*.5).setAlpha(.92*subAlpha);
    if(quality>0){
     const phase=w.elapsed*11+m.seed;
     const fire=this.borrow(this.firePool,firesUsed++,EMPLACEMENT_TEXTURE,8.8);
     fire.setFrame(4+Math.floor(phase)%4).setPosition(mx,my-3).setDisplaySize(22*m.size*sinkScale,22*m.size*sinkScale).setAlpha(.84*subAlpha);
    }
    if(quality>1||(quality===1&&sec.completed)){
     const drift=(w.elapsed*1.6+m.seed*.13)%1;
     const puff=this.borrow(this.smokePool,smokeUsed++,GUN_SMOKE_TEXTURE,9.5);
     puff.setFrame(Math.min(7,Math.floor(drift*8))).setPosition(mx-drift*12,my-8-drift*16).setDisplaySize((18+drift*16)*m.size,(18+drift*16)*m.size).setAlpha((1-drift)*.52*subAlpha);
    }
   }

   for(const p of sec.parts){
    liveParts.add(p.id);
    const spec=SUB_PART_FRAME[p.kind];
    let sprite=this.partSprites.get(p.id);
    if(!sprite){sprite=this.scene.add.sprite(p.x,p.y,SUB_PARTS_ART,spec.alive).setDepth(7);this.partSprites.set(p.id,sprite);}
    const recoilX=p.kind==='turret'&&p.hp>0?-Math.cos(p.angle)*p.recoil*4.5:0;
    const recoilY=p.kind==='turret'&&p.hp>0?-Math.sin(p.angle)*p.recoil*4.5:0;
    const px=b.x+shakeX+p.dx*sinkScale+recoilX,py=cy+p.dy*sinkScale+recoilY;
    const frame=p.hp>0?spec.alive:spec.dead;
    const rot=p.hp>0?(p.kind==='turret'?p.angle-Math.PI/2:p.kind==='propeller'?w.elapsed*3.8*(p.dx<0?1:-1):0):(p.kind==='turret'?((p.id%5)-2)*.22:0);
    const depth=p.kind==='bridge'?8.2:p.kind==='reactor'?7.4:7;
    sprite.setTexture(SUB_PARTS_ART,frame).setPosition(px,py).setDisplaySize(spec.size*sinkScale,spec.size*sinkScale).setRotation(rot).setDepth(depth).setAlpha(subAlpha).setTint(hullTint).setVisible(true);
    if(p.hp>0&&sec.index===sub.activeSection)overlays.draw(sprite,p.flash);
    if(p.hp>0&&p.warning>.35&&sec.index===sub.activeSection&&sub.phase==='fight'&&p.kind==='turret'&&quality>0){
     const fire=this.borrow(this.firePool,firesUsed++,EMPLACEMENT_TEXTURE,8.6);
     fire.setFrame(4+Math.floor(w.elapsed*16)%4).setPosition(px+Math.cos(p.angle)*p.radius*1.02,py+Math.sin(p.angle)*p.radius*1.02).setDisplaySize(10+p.warning*6,10+p.warning*6).setAlpha(p.warning*.82);
    }
    if(p.hp<=0&&p.kind==='bridge'&&quality>0){
     const fire=this.borrow(this.firePool,firesUsed++,EMPLACEMENT_TEXTURE,9.0);
     fire.setFrame(4+Math.floor(w.elapsed*12)%4).setPosition(px,py-8).setDisplaySize(34*sinkScale,34*sinkScale).setAlpha(.9*subAlpha);
    }
   }
  }
  for(const [id,s] of this.partSprites)if(!liveParts.has(id))s.setVisible(false);
  for(let i=cratersUsed;i<this.craterPool.length;i++)this.craterPool[i].setVisible(false);
  for(let i=firesUsed;i<this.firePool.length;i++)this.firePool[i].setVisible(false);
  for(let i=smokeUsed;i<this.smokePool.length;i++)this.smokePool[i].setVisible(false);
 }
 clear():void{
  for(const s of this.hullSprites)s.setVisible(false);
  for(const s of this.submergedSprites)s.setVisible(false);
  for(const s of this.partSprites.values())s.destroy();this.partSprites.clear();
  for(const s of this.craterPool)s.destroy();this.craterPool=[];
  for(const s of this.firePool)s.destroy();this.firePool=[];
  for(const s of this.smokePool)s.destroy();this.smokePool=[];
 }
}
