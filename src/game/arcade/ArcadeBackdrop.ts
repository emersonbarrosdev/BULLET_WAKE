import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';

/** Stage-1 portrait ocean is clipped by its fixed TileSprite; the side HUD is opaque. */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private oceanMaps:Phaser.GameObjects.Image[]=[];
 private seaFx:Phaser.GameObjects.Graphics;
 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  // x=208..560: actual UP simulation bounds; never fill the HUD strips with gameplay.
  for(let i=0;i<2;i++){
   this.oceanMaps.push(scene.add.image(384,216,'arc-stage1-world-'+i)
    .setDisplaySize(352,1856*352/713).setDepth(-19).setVisible(false));
  }
  this.seaFx=scene.add.graphics().setDepth(-18);
  for(let i=0;i<8;i++)this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-15));
  for(let i=0;i<5;i++)this.clouds.push(scene.add.image(0,0,'arc-scenery',4).setDepth(-12).setAlpha(.18));
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  this.ink.clear();this.seaFx.clear();
  for(const sprite of this.scenery)sprite.setVisible(false);
  for(const sprite of this.clouds)sprite.setVisible(false);
  this.oceanMaps.forEach(map=>map.setVisible(!!world?.up));
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
  // Continuous detailed sea and coastal landmarks live on a long illustration map.
  // Two small sequential atlases (<= 1856px tall) stay compatible with Android GPUs.
  this.ink.fillStyle(0x03437d).fillRect(208,0,352,432);
  const h=1856*352/713,period=h*2,scroll=(w.scroll*.92)%period;
  for(let i=0;i<2;i++){
   let top=i*h-scroll;
   if(top< -h)top+=period;
   this.oceanMaps[i].setPosition(384,top+h/2);
  }
  // Foam overlays stay sparse and behind enemies to maintain projectile legibility.
  const g=this.seaFx;
  const count=quality===0?4:quality===1?7:10;
  for(let i=0;i<count;i++){
   const y=((i*95+w.scroll*(.35+i%3*.05))%610+610)%610-95;
   const x=235+((i*109+19)%303);
   g.lineStyle(i%4===0?2:1,0xe0fff5,i%4===0?.34:.2);
   g.beginPath();g.moveTo(x-20,y+Math.sin(time*.3+i)*2);
   g.lineTo(x,y-2);g.lineTo(x+18,y+Math.sin(time*.3+i)*2);g.strokePath();
  }
  if(w.region===6){
   // An environmental warning only; the boss stays in its own gameplay layer.
   g.lineStyle(2,0x9ff9ed,.32);
   for(let i=0;i<3;i++){
    const radius=50+i*24+Math.sin(time*.65+i)*6;
    g.strokeEllipse(384,70,radius*2,radius*.8);
   }
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
  this.ink.destroy();this.seaFx.destroy();this.oceanMaps.forEach(s=>s.destroy());
  this.scenery.forEach(s=>s.destroy());this.clouds.forEach(s=>s.destroy());
  void this.scene;
 }
}