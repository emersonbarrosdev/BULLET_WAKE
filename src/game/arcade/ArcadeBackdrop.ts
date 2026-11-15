import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';
import {installPelagicTextures} from './PelagicPresentation';
import {WATER_SCALE,waterScrollOffset} from './PelagicWater';
import {
 installOceanDepthTexture,
 installOceanCausticsTexture,
 installWaveCrestTextures,
 installCoastalShoalTexture,
} from './PelagicCoastAtlas';
import {coastAtScroll} from './PelagicCoastGeometry';
import {PelagicCoastPainting} from './PelagicCoastPainting';
import {installMenuAnims,UI_TEX} from './ArcadeMenuArt';
const STAGE1_LEFT=192,STAGE1_WIDTH=384;
export const MENU_HORIZON=300;
const FAMILIES=['fighter','interceptor','acrobat','bomber','boat','ship','tank','tower'];
/** Connected painted coast at world speed; ocean highlights, wakes and birds animate independently. */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private oceanDepth:Phaser.GameObjects.TileSprite;
 private waterSwell:Phaser.GameObjects.TileSprite;
 private water:Phaser.GameObjects.TileSprite;
 private oceanCaustics:Phaser.GameObjects.TileSprite;
 private seaFx:Phaser.GameObjects.Graphics;
 private deepReefs:Phaser.GameObjects.Image[]=[];
 private waveSprites:Phaser.GameObjects.Image[]=[];
 private shadows:Phaser.GameObjects.Image[]=[];
 private wakes:Phaser.GameObjects.Image[]=[];
 private seagulls:Phaser.GameObjects.Sprite[]=[];
 private seagullShadows:Phaser.GameObjects.Image[]=[];
 private coastPainting:PelagicCoastPainting;
 private menuSky:Phaser.GameObjects.Image;
 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  installMenuAnims(scene);
  this.menuSky=scene.add.image(384,216,UI_TEX.skyPanorama).setDisplaySize(768,432).setDepth(-19.95).setVisible(false);
  installPelagicTextures(scene);
  this.coastPainting=new PelagicCoastPainting(scene);
  const waveKey=installWaveCrestTextures(scene);
  const shoalKey=installCoastalShoalTexture(scene);
  this.oceanDepth=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,installOceanDepthTexture(scene)).setDepth(-19.8).setVisible(false);
  for(let i=0;i<8;i++){
   this.deepReefs.push(scene.add.image(0,0,shoalKey,0).setDepth(-19.55).setTint(0x2d94b8).setAlpha(.3).setVisible(false));
  }
  this.waterSwell=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,'pelagic-water-review').setDepth(-19.35).setAlpha(.42).setVisible(false).setTileScale(WATER_SCALE*1.45,WATER_SCALE*1.45);
  this.water=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,'pelagic-water-review').setDepth(-19.2).setAlpha(.88).setVisible(false).setTileScale(WATER_SCALE,WATER_SCALE);
  this.oceanCaustics=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,installOceanCausticsTexture(scene)).setDepth(-18.9).setAlpha(.15).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setTileScale(.42,.42);
  for(let i=0;i<16;i++){
   this.waveSprites.push(scene.add.image(0,0,waveKey,i%8).setDepth(-18.75).setVisible(false));
  }
  for(let i=0;i<8;i++)this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-15));
  this.seaFx=scene.add.graphics().setDepth(-1);
  for(let i=0;i<5;i++)this.clouds.push(scene.add.image(0,0,'arc-scenery',4).setDepth(-12).setAlpha(.18));

  // Register Phaser 4 2.5D Seagull Spritesheet Animations ('seagull-fly', 'seagull-glide', 'seagull-perch')
  if(scene.textures.exists('pelagic-seagulls')){
   if(!scene.anims.exists('seagull-fly')){
    scene.anims.create({key:'seagull-fly',frames:scene.anims.generateFrameNumbers('pelagic-seagulls',{start:0,end:5}),frameRate:9,repeat:-1});
   }
   if(!scene.anims.exists('seagull-glide')){
    scene.anims.create({key:'seagull-glide',frames:scene.anims.generateFrameNumbers('pelagic-seagulls',{start:6,end:8}),frameRate:4.5,repeat:-1});
   }
   if(!scene.anims.exists('seagull-perch')){
    scene.anims.create({key:'seagull-perch',frames:scene.anims.generateFrameNumbers('pelagic-seagulls',{start:9,end:11}),frameRate:2.2,repeat:-1});
   }
  }
  for(let i=0;i<4;i++){
   this.seagullShadows.push(scene.add.image(0,0,'pelagic-seagulls',0).setTint(0x021833).setAlpha(.24).setDepth(-17.4).setVisible(false));
   this.seagulls.push(scene.add.sprite(0,0,'pelagic-seagulls',0).setDepth(-11).setVisible(false));
  }
  for(let i=0;i<48;i++)this.shadows.push(scene.add.image(0,0,'arc-enemies',0).setTint(0x031d3b).setAlpha(.22).setDepth(-2).setVisible(false));
  for(let i=0;i<16;i++){
   this.wakes.push(scene.add.image(0,0,'pelagic-wakes',0).setOrigin(.5,.85).setDepth(-1.5).setAlpha(.62).setVisible(false));
  }
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  this.ink.clear();this.seaFx.clear();
  this.menuSky.setVisible(false);
  for(const pool of[this.scenery,this.clouds,this.deepReefs,this.waveSprites,this.shadows,this.wakes,this.seagulls,this.seagullShadows])for(const sprite of pool)sprite.setVisible(false);
  const up=!!world?.up;this.coastPainting.draw(world?.scroll??0,up);this.oceanDepth.setVisible(up);this.waterSwell.setVisible(up);this.water.setVisible(up);this.oceanCaustics.setVisible(up);
  if(!world){this.menuSky.setVisible(true);return;}
  if(world.up)this.ocean(world,quality);else this.city(time,world,quality);
 }
 private ocean(w:ArcadeWorld,quality:number):void{
  const time=w.elapsed;
  this.ink.fillStyle(0x053463).fillRect(STAGE1_LEFT,0,STAGE1_WIDTH,432);
  this.oceanDepth.tilePositionY=-(w.scroll*.84+time*.22);
  this.oceanDepth.tilePositionX=Math.cos(time*.11)*1.2;
  this.waterSwell.tilePositionY=-(w.scroll*1.22+time*5.5);
  this.waterSwell.tilePositionX=-Math.sin(time*.18)*2.4;
  this.water.tilePositionY=waterScrollOffset(w.scroll,time);
  this.water.tilePositionX=Math.sin(time*.15)*.6;
  this.oceanCaustics.tilePositionY=-(w.scroll/.42+time*2.1);
  this.oceanCaustics.tilePositionX=Math.sin(time*.24)*2.8;
  this.oceanCaustics.setAlpha(.15+.035*Math.sin(time*.9));

  // Layer 2: Deep submerged parallax reefs drifting beneath the waves along coastal shelves
  if(quality>0){
   for(let i=0;i<this.deepReefs.length;i++){
    const period=620,ry=((i*77+w.scroll*.86)%period+period)%period-70;
    const side=i%2===0?-1:1;
    const rx=side<0?STAGE1_LEFT+36+(i*19)%48:STAGE1_LEFT+STAGE1_WIDTH-36-(i*23)%48;
    this.deepReefs[i].setVisible(true).setFrame(0).setPosition(rx,ry).setDisplaySize(88+(i%3)*14,72+(i%2)*14).setAlpha(.28+.06*Math.sin(time*.7+i));
   }
  }

  // Layer 6: Animated 2.5D wave-crest & whitecap sprites moving slowly and smoothly across the open water
  const waveCount=quality>1?16:quality===1?10:0;
  for(let i=0;i<waveCount;i++){
   const period=460,wy=((i*29+w.scroll*1.02+time*6.5)%period+period)%period-20;
   const leftEdge=STAGE1_LEFT+coastAtScroll(w.scroll,wy,-1)+20;
   const rightEdge=STAGE1_LEFT+coastAtScroll(w.scroll,wy,1)-20;
   if(rightEdge-leftEdge<44)continue;
   const lane=((i*0.37+Math.sin(i*1.9)*.22)%1+1)%1;
   const wx=leftEdge+lane*(rightEdge-leftEdge)+Math.sin(time*.65+i)*3;
   const anim=time*1.85+i*1.37;
   const frame=Math.floor(anim)%8;
   const pulse=.32+.28*Math.sin((anim%8)/8*Math.PI);
   const wSize=34+(i%4)*7;
   this.waveSprites[i].setVisible(true).setFrame(frame).setPosition(wx,wy).setDisplaySize(wSize,wSize*.46).setAlpha(pulse);
  }

  // Actual hull contact, altitude shadows, streamlined naval wakes, and scheduled 2.5D seagulls.
  const g=this.seaFx;
  let shadow=0,wake=0;
  for(const e of w.enemies){
   if(shadow>=this.shadows.length-1)break;
   const naval=e.family==='boat'||e.family==='ship';
   const heading=e.navigation?.heading??Math.PI;
   const rotation=naval?heading:e.ground?heading-Math.PI:e.family==='alien'?0:Math.PI;
   const texture=e.family==='alien'?'arc-ufo':'arc-enemies';
   const frame=e.family==='alien'?0:e.family==='airship'?12:(w.up&&e.family==='tank'?7:FAMILIES.indexOf(e.family));
   if(!naval&&!e.submarine&&e.navigation?.anchor===undefined)this.shadows[shadow++].setVisible(true).setTexture(texture,Math.max(0,frame)).setPosition(e.x+(e.ground?3:12),e.y+(e.ground?4:16)).setDisplaySize(e.size*(e.ground?.96:.82),e.size*(e.ground?.96:.82)).setRotation(rotation).setAlpha(e.ground?.3:.2);
   if(e.submarine){
    const exp=e.submarine.exposure;
    if(exp>.05){
     g.lineStyle(1.4,0x8ef5ff,exp*.42).strokeEllipse(e.x,e.y+2,e.size*.92+Math.sin(time*4+e.id)*4,e.size*.34);
     g.lineStyle(1,0xf0ffff,exp*.52).strokeEllipse(e.x,e.y+2,e.size*.76-Math.cos(time*4+e.id)*3,e.size*.24);
    }
    continue;
   }
   if(!naval)continue;
   const holding=e.navigation?.phase==='hold';
   const angle=heading-Math.PI/2;
   const fx=Math.cos(angle),fy=Math.sin(angle),sx=-fy,sy=fx;
   // Grounded underwater keel shadow + soft stern turbulence + clean tapered Kelvin wave arms
   g.fillStyle(0x031838,.28).fillEllipse(e.x+3,e.y+4,e.size*.52,e.size*.84);
   g.fillStyle(0x28d6f0,holding?.16:.26).fillEllipse(e.x-fx*e.size*.42,e.y-fy*e.size*.42,e.size*.34,e.size*.24);
   const cx=e.x+fx*e.size*.16,cy=e.y+fy*e.size*.16;
   for(const side of[-1,1]){
    g.lineStyle(1.4,0x82f0ff,holding?.26:.46);
    g.beginPath();
    for(let j=0;j<=8;j++){
     const t=j/8,along=(.22-t*1.02)*e.size,across=(Math.sin(t*Math.PI*.75)*e.size*.16+t*e.size*.16)*side;
     const x=cx+fx*along+sx*across,y=cy+fy*along+sy*across;
     if(j===0)g.moveTo(x,y);else g.lineTo(x,y);
    }
    g.strokePath();
    for(let j=0;j<(quality?10:5);j++){
     const t=(j/10+time*.65)%1;
     const aft=e.size*.36+t*e.size*.82,across=(2.5+t*e.size*.22)*side+Math.sin(time*4.5+j)*1.0;
     const x=e.x-fx*aft+sx*across,y=e.y-fy*aft+sy*across;
     g.fillStyle(j%2===0?0xf2ffff:0x66e2f5,(1-t)*(holding?.24:.48));
     g.fillEllipse(x,y,1.4+t*1.7,1.0+t*1.1);
    }
   }
  }

  // Naval Boss Water Displacement, Stern Turbine Wash & Twin-Pontoon Wakes:
  // Grounds PATRULHA PESADA and ENCOURAÇADO PULA-ONDA while fighting/moving; vanishes immediately on defeat.
  const b=w.boss;
  if(b&&b.phase!=='absent'&&b.phase!=='sink'){
   const bob=b.phase==='fight'?Math.sin(time*2.4)*1.4:0;
   const bx=b.x,by=b.y+bob,bs=b.size;
   const vortexY=by-bs*.40;
   g.fillStyle(0x22d6eb,.24).fillEllipse(bx,vortexY,bs*.52,bs*.30);
   g.fillStyle(0xb8fcff,.22).fillEllipse(bx,vortexY+4,bs*.34,bs*.18);
   for(const [k,lane] of [-.27,0,.27].entries()){
    if(wake>=this.wakes.length)break;
    const wIdx=wake++;
    const wakeFrame=Math.floor(time*3.8+k)%4;
    const sideScale=lane===0?1:.76;
    this.wakes[wIdx].setVisible(true).setFrame(wakeFrame)
     .setPosition(bx+lane*bs,by-bs*(lane===0?.18:.12))
     .setDisplaySize(bs*.40*sideScale,bs*.82*sideScale)
     .setRotation(0).setAlpha(lane===0?.44:.34);
   }
   for(const side of[-1,1]){
    for(let j=0;j<12;j++){
     const t=(j/12+time*.45)%1;
     const px=bx+side*(bs*(.28+t*.11)+Math.sin(time*4.5+j)*1.6);
     const py=by+bs*(.28-t*.74);
     g.fillStyle(j%2===0?0xffffff:0x7cebf7,(1-t)*.56);
     g.fillEllipse(px,py,2.6+t*2.4,1.7+t*1.5);
    }
    for(let j=0;j<6;j++){
     const t=j/5;
     const px=bx+side*bs*(.04+t*.22);
     const py=by+bs*(.38-t*.10)+Math.sin(time*5+j)*1.2;
     g.fillStyle(0xf2ffff,.52-t*.22);
     g.fillEllipse(px,py,3.2-t*.8,1.8);
    }
   }
  }

  // Scheduled 2.5D Seagull Director (with long 20s-40s pauses between events, never continuous back-to-back!):
  if(quality>0&&this.scene.textures.exists('pelagic-seagulls')){
   const masterPeriod=112.0;
   const cycleIdx=Math.floor(time/masterPeriod);
   const cycleT=time%masterPeriod;

   if(cycleT>=8.5&&cycleT<=14.0){
    const p=(cycleT-8.5)/5.5;
    const dir=cycleIdx%2===0?1:-1;
    const startX=dir>0?STAGE1_LEFT-24:STAGE1_LEFT+STAGE1_WIDTH+24;
    const endX=dir>0?STAGE1_LEFT+STAGE1_WIDTH+24:STAGE1_LEFT-24;
    const gx=startX+(endX-startX)*p;
    const gy=142+(p-.5)*(dir>0?-46:40)+Math.sin(p*Math.PI)*-14;
    const fade=p<.08?p/.08:p>.90?(1-p)/.10:1;
    const gSprite=this.seagulls[0],gShadow=this.seagullShadows[0];
    const animKey=(p>.36&&p<.68)?'seagull-glide':'seagull-fly';
    if(gSprite.anims.currentAnim?.key!==animKey)gSprite.play(animKey);
    const bankRot=dir>0?-0.10:0.10;
    gSprite.setVisible(true).setPosition(gx,gy).setDisplaySize(22,22).setFlipX(dir<0).setRotation(bankRot).setAlpha(fade*.92);
    gShadow.setVisible(true).setFrame(gSprite.frame.name).setPosition(gx+9,gy+15).setDisplaySize(19,19).setFlipX(dir<0).setRotation(bankRot).setAlpha(fade*.22);
   }else if(cycleT>=36.0&&cycleT<=42.2){
    const p=(cycleT-36.0)/6.2;
    const dir=cycleIdx%2===0?-1:1;
    const startX=dir>0?STAGE1_LEFT-36:STAGE1_LEFT+STAGE1_WIDTH+36;
    const endX=dir>0?STAGE1_LEFT+STAGE1_WIDTH+36:STAGE1_LEFT-36;
    const leadX=startX+(endX-startX)*p;
    const leadY=168+(p-.5)*(dir>0?-38:34)+Math.sin(p*Math.PI)*-10;
    const fade=p<.09?p/.09:p>.89?(1-p)/.11:1;
    const bankRot=dir>0?-0.09:0.09;
    const offsets:readonly[number,number,number][]=[[0,0,19],[-dir*18,-15,17],[-dir*15,16,17]];
    offsets.forEach(([ox,oy,sz],k)=>{
     const gx=leadX+ox+Math.sin(time*2.2+k)*1.2;
     const gy=leadY+oy+Math.cos(time*2.0+k)*1.2;
     const gSprite=this.seagulls[k],gShadow=this.seagullShadows[k];
     const animKey=((p+k*.12)%1>.42&&(p+k*.12)%1<.72)?'seagull-glide':'seagull-fly';
     if(gSprite.anims.currentAnim?.key!==animKey)gSprite.play(animKey);
     gSprite.setVisible(true).setPosition(gx,gy).setDisplaySize(sz,sz).setFlipX(dir<0).setRotation(bankRot).setAlpha(fade*.80);
     gShadow.setVisible(true).setFrame(gSprite.frame.name).setPosition(gx+8,gy+13).setDisplaySize(sz*.86,sz*.86).setFlipX(dir<0).setRotation(bankRot).setAlpha(fade*.18);
    });
   }else if(cycleT>=85.0&&cycleT<=92.6){
    const p=(cycleT-85.0)/7.6;
    const side=cycleIdx%2===0?-1:1;
    const edgeX=side<0?STAGE1_LEFT-18:STAGE1_LEFT+STAGE1_WIDTH+18;
    const hoverX=side<0?STAGE1_LEFT+118:STAGE1_LEFT+STAGE1_WIDTH-118;
    const reach=p<.18?Math.sin(p/.18*Math.PI*.5):p>.82?Math.sin((1-p)/.18*Math.PI*.5):1;
    const gx=edgeX+(hoverX-edgeX)*reach+Math.sin(time*1.9)*3.2;
    const gy=196+Math.cos(time*1.5)*2.8+(p-.5)*14;
    const fade=p<.08?p/.08:p>.90?(1-p)/.10:1;
    const gSprite=this.seagulls[0],gShadow=this.seagullShadows[0];
    const animKey=Math.sin(time*2.6)>-.25?'seagull-glide':'seagull-fly';
    if(gSprite.anims.currentAnim?.key!==animKey)gSprite.play(animKey);
    const flip=p>.82?(side<0):(side>0);
    const bankRot=Math.sin(time*1.8)*.05;
    gSprite.setVisible(true).setPosition(gx,gy).setDisplaySize(20,20).setFlipX(flip).setRotation(bankRot).setAlpha(fade*.92);
    gShadow.setVisible(true).setFrame(gSprite.frame.name).setPosition(gx+3,gy+4.5).setDisplaySize(19,19).setFlipX(flip).setRotation(bankRot).setAlpha(fade*.32);
    if(reach>.7){
     g.lineStyle(1,0xd8ffff,fade*.28).strokeEllipse(gx+1,gy+4,16+Math.sin(time*4)*2.5,7+Math.cos(time*4)*1.2);
    }
   }
  }
  this.shadows[shadow].setVisible(w.state!=='defeat').setTexture('arc-rivet',1).setPosition(w.player.x+11,w.player.y+17).setDisplaySize(25,31).setRotation(0).setAlpha(.22);
 }
 private city(time:number,w:ArcadeWorld,quality:number):void{
  const g=this.ink;g.fillGradientStyle(0x27aee1,0x72d3ee,0xffe4a6,0xc6f7ec,1).fillRect(0,0,768,432);
  g.fillStyle(0xfff1a0).fillCircle(659-w.scroll*.008%40,78,32);
  for(let layer=0;layer<3;layer++){
   const factor=[.13,.3,.6][layer],base=[340,380,427][layer],palette=[[0x92cddc,0xaed5e4,0x95cad9],[0x69b8ce,0x92aadb,0x8ecbbe],[0xffb28d,0x66bdc8,0xb499cc]][layer];
   for(let i=0;i<15;i++){
    const x=((i*79-w.scroll*factor)%1185+1185)%1185-120,h=75+(i*47+layer*31)%130,bw=46+(i%3)*9;
    g.fillStyle(palette[i%3]).fillRoundedRect(x,base-h,bw,h,3);g.fillStyle(0x346d99,.25).fillRect(x+bw-8,base-h,8,h);
    g.fillStyle(0xf4ffcb,layer===2?.65:.35);for(let y=base-h+12;y<base-10;y+=16)for(let xx=x+7;xx<x+bw-10;xx+=13)g.fillRect(xx,y,5,7);
    if(i%3===0){g.lineStyle(2,0x38798e,.6).lineBetween(x+bw/2,base-h,x+bw/2,base-h-14);g.fillStyle(0xffd96b).fillCircle(x+bw/2,base-h-14,2);}
   }
  }
  for(let i=0;i<Math.min(quality+2,4);i++)this.clouds[i].setVisible(true).setPosition(((i*233-w.scroll*.08)%1000+1000)%1000-100,65+i%2*40).setDisplaySize(180,75).setAlpha(.65);
  this.scenery[0].setVisible(true).setFrame(w.region>=5?7:6).setPosition(((900-w.scroll*.44)%1500+1500)%1500-200,355).setDisplaySize(360,200).setAlpha(.9);
  g.fillStyle(0x255f87).fillRect(0,414,768,18);g.lineStyle(3,0xffed8a).lineBetween(0,414,768,414);
  for(let i=0;i<8;i++){const x=((i*140-w.scroll*1.5)%1120+1120)%1120;g.fillStyle(i%2?0xffd252:0xe7f5fc).fillRoundedRect(x,419,18,6,2);}
  void time;
 }
  destroy():void{
  this.ink.destroy();this.seaFx.destroy();this.menuSky.destroy();this.oceanDepth.destroy();this.waterSwell.destroy();this.water.destroy();this.oceanCaustics.destroy();
  this.coastPainting.destroy();
  for(const pool of[this.scenery,this.clouds,this.deepReefs,this.waveSprites,this.shadows,this.wakes,this.seagulls,this.seagullShadows])pool.forEach(s=>s.destroy());
  void this.scene;
 }
}
