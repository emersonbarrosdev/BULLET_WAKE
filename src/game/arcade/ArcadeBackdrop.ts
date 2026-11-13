import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';
import {installPelagicTextures} from './PelagicPresentation';
import {WATER_SCALE,waterScrollOffset} from './PelagicWater';
import {visibleShore,shoreAnchoredToEdge,type ShoreSprite} from './PelagicShoreline';

const STAGE1_LEFT=192,STAGE1_WIDTH=384;

/** Stage 1 / approval gate 2: seamless water plus sharp transparent shoreline.
 * Harbor, lighthouse, dynamic boats and boss scenery belong to later approval gates.
 */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private water:Phaser.GameObjects.TileSprite;
 private seaFx:Phaser.GameObjects.Graphics;
 private shoreSprites:Phaser.GameObjects.Image[]=[];
 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  installPelagicTextures(scene);
  // A single opaque, unfiltered source: no doubled ocean, faded coast, cyan fog or panorama.
  this.water=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,'pelagic-water').setDepth(-19).setVisible(false);
  this.water.setTileScale(WATER_SCALE,WATER_SCALE);
  this.seaFx=scene.add.graphics().setDepth(-17);
  // Small fixed pool. 192 authored placements do not become 192 live draw calls.
  for(let i=0;i<24;i++)this.shoreSprites.push(scene.add.image(0,0,'pelagic-coast',0).setDepth(-18).setVisible(false));
  for(let i=0;i<8;i++)this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-15));
  for(let i=0;i<5;i++)this.clouds.push(scene.add.image(0,0,'arc-scenery',4).setDepth(-12).setAlpha(.18));
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  this.ink.clear();this.seaFx.clear();
  for(const sprite of this.scenery)sprite.setVisible(false);
  for(const sprite of this.clouds)sprite.setVisible(false);
  this.water.setVisible(!!world?.up);
  if(!world?.up)this.shoreSprites.forEach(s=>s.setVisible(false));
  if(!world){this.sky(time,quality);return;}
  if(world.up)this.ocean(world,quality);else this.city(time,world,quality);
 }
 private sky(time:number,quality:number):void{
  const g=this.ink;
  g.fillGradientStyle(0x159fda,0x39c7ed,0xd5fcf3,0xc4f3e8,1).fillRect(0,0,768,432);
  g.fillStyle(0xffee89,.9).fillCircle(636,87,39);g.fillStyle(0xffffff,.15).fillCircle(636,87,49);
  g.fillStyle(0x29b6bb).fillRect(0,325,768,107);g.lineStyle(2,0x95fff1,.55);
  for(let i=0;i<10;i++){const y=337+i*9;g.lineBetween(0,y,768,y+Math.sin(time+i)*2);}
  for(let i=0;i<3;i++)this.scenery[i].setVisible(true).setFrame(i%2).setPosition(110+i*300,370+Math.sin(i)*20).setDisplaySize(180,110);
  for(let i=0;i<quality+3;i++)this.clouds[i].setVisible(true).setPosition(((i*215-time*(7+i*2))%1040+1040)%1040-120,60+i*47).setDisplaySize(155+i*16,90).setAlpha(.7);
 }
 private ocean(w:ArcadeWorld,quality:number):void{
  // Tile coordinates move in the opposite direction of visible scenery.
  // Negative tileY means the displayed world drifts DOWN as the ship advances.
  // The ocean remains animated when the boss stops world.scroll.
  const time=w.elapsed;
  this.ink.fillStyle(0x074785).fillRect(STAGE1_LEFT,0,STAGE1_WIDTH,432);
  this.water.tilePositionY=waterScrollOffset(w.scroll,time*2.2);
  this.water.tilePositionX=Math.sin(time*.18)*1.6;
  // All land positions use the SAME positive world.scroll as surface navigation.
  // Objects keep their atlas-native orientation: never rotate or mirror a lighthouse.
  const visible=visibleShore(w.scroll,125);
  for(let i=0;i<this.shoreSprites.length;i++){
   const image=this.shoreSprites[i],p:ShoreSprite|undefined=visible[i];
   if(!p){image.setVisible(false);continue;}
   image.setVisible(true).setTexture('pelagic-coast',p.frame)
    .setPosition(p.x,p.y+w.scroll).setDisplaySize(p.width,p.height).setAlpha(1);
   // All shore texture cells have TRUE transparent padding, not painted ocean.
   if(!shoreAnchoredToEdge(p))throw new Error('Sprite costeiro separado da margem');
  }
  const g=this.seaFx,count=quality===0?8:quality===1?13:19;
  for(let i=0;i<count;i++){
   const y=((i*53+w.scroll*.87)%510+510)%510-39;
   const x=245+(i*79%270);
   g.lineStyle(.7,0xb4efff,.13+.08*Math.sin(time*.95+i)**2);
   g.beginPath();
   for(let j=0;j<=8;j++){
    const xx=x+j*2.5;
    const yy=y+Math.sin(j*.58+i*.9+time*.3)*1.15;
    if(j===0)g.moveTo(xx,yy);else g.lineTo(xx,yy);
   }
   g.strokePath();
  }
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
  this.ink.destroy();this.seaFx.destroy();this.water.destroy();
  this.shoreSprites.forEach(s=>s.destroy());
  this.scenery.forEach(s=>s.destroy());this.clouds.forEach(s=>s.destroy());
  void this.scene;
 }
}
