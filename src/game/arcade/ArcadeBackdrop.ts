import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';
import {visibleCoast} from './PelagicEnvironment';
import {installPelagicTextures} from './PelagicPresentation';
import {WATER_SCALE,waterScrollOffset} from './PelagicWater';

/** Stage-1 portrait ocean is clipped by its fixed TileSprite; the side HUD is opaque. */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private water:Phaser.GameObjects.TileSprite;
 private coast:Phaser.GameObjects.Image[]=[];
 private reefs:Phaser.GameObjects.Image[]=[];
 private seaFx:Phaser.GameObjects.Graphics;
 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  installPelagicTextures(scene);
  this.water=scene.add.tileSprite(384,216,352,432,'pelagic-water').setDepth(-19).setVisible(false);
  this.water.setTileScale(WATER_SCALE,WATER_SCALE);
  for(let i=0;i<12;i++)this.coast.push(scene.add.image(0,0,'pelagic-coast').setDepth(-15).setVisible(false));
  for(let i=0;i<6;i++)this.reefs.push(scene.add.image(0,0,'pelagic-coast',3).setDepth(-18).setVisible(false));
  this.seaFx=scene.add.graphics().setDepth(-18);
  for(let i=0;i<8;i++)this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-15));
  for(let i=0;i<5;i++)this.clouds.push(scene.add.image(0,0,'arc-scenery',4).setDepth(-12).setAlpha(.18));
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  this.ink.clear();this.seaFx.clear();
  for(const sprite of this.scenery)sprite.setVisible(false);
  for(const sprite of this.clouds)sprite.setVisible(false);
  this.water.setVisible(!!world?.up);this.coast.forEach(s=>s.setVisible(false));this.reefs.forEach(s=>s.setVisible(false));
  if(!world){this.sky(time,quality);return;}
  if(world.up)this.ocean(time,world,quality);else this.city(time,world,quality);
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
 private ocean(time:number,w:ArcadeWorld,quality:number):void{
  // Simulation time freezes on pause; switching from menu clock must not jump the water UVs.
  time=w.elapsed;
  // Texture samples scroll opposite the image: negative UV offset moves the world DOWN.
  // One repeatable water material, no stitched maps or transitions between images.
  this.ink.fillStyle(0x03437d).fillRect(208,0,352,432);
  this.water.tilePositionY=waterScrollOffset(w.scroll,time);
  this.water.tilePositionX=Math.sin(time*.16)*1.8;
  const pieces=visibleCoast(w.scroll,40);
  pieces.forEach((p,i)=>this.coast[i]?.setVisible(true).setFrame(p.frame).setPosition(p.x,p.y+w.scroll).setDisplaySize(p.width,p.height));
  // Reefs are below the surface; harbor structures and islands are independent world objects.
  for(let i=0;i<6;i++){
   const worldY=360-i*201-Math.floor((w.scroll+360)/1206)*1206;
   const y=((worldY+w.scroll+100)%1206+1206)%1206-100;
   this.reefs[i].setVisible(y<510).setPosition(i%2?505:263,y).setDisplaySize(87,62).setAlpha(.42);
  }
  // Short curved wavelets follow the same world transform. No chevrons, haze or seam covers.
  const g=this.seaFx;
  const count=quality===0?12:quality===1?18:26;
  for(let i=0;i<count;i++){
   const y=((i*43+w.scroll)%530+530)%530-50,x=225+(i*71%318);
   g.lineStyle(.7,0xb6f9ff,.12+.12*Math.sin(time*.8+i)**2);
   g.beginPath();for(let j=0;j<=8;j++){const xx=x+j*1.8,yy=y+Math.sin(j*.35+i+time*.25)*1.6;if(j===0)g.moveTo(xx,yy);else g.lineTo(xx,yy);}g.strokePath();
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
  this.ink.destroy();this.seaFx.destroy();this.water.destroy();this.coast.forEach(s=>s.destroy());this.reefs.forEach(s=>s.destroy());
  this.scenery.forEach(s=>s.destroy());this.clouds.forEach(s=>s.destroy());
  void this.scene;
 }
}
