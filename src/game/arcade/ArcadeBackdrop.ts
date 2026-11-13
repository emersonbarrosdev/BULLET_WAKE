import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';

/** Reusable illustrated scenery and analytic water: no frame-by-frame texture uploads. */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private borders:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private waterMask:Phaser.Display.Masks.GeometryMask;
 private maskShape:Phaser.GameObjects.Graphics;
 private water:Phaser.GameObjects.TileSprite;
 private shimmer:Phaser.GameObjects.TileSprite;
 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  this.borders=scene.add.graphics().setDepth(-11);
  this.maskShape=scene.make.graphics({x:0,y:0});this.maskShape.fillStyle(0xffffff).fillRect(208,38,352,382);this.waterMask=this.maskShape.createGeometryMask();
  this.water=scene.add.tileSprite(384,229,352,382,'arc-ocean').setDepth(-19).setAlpha(.82).setTileScale(.9);
  this.shimmer=scene.add.tileSprite(384,229,352,382,'arc-ocean').setDepth(-18).setAlpha(.12).setTileScale(1.25);
  for(let i=0;i<8;i++)this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-17));
  for(let i=0;i<5;i++)this.clouds.push(scene.add.image(0,0,'arc-scenery',4).setDepth(-12).setAlpha(.35));
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  const g=this.ink;g.clear();for(const s of this.scenery)s.setVisible(false).clearMask();for(const s of this.clouds)s.setVisible(false).clearMask();
  this.borders.clear();
  this.water.setVisible(!!world?.up);this.shimmer.setVisible(!!world?.up);
  if(!world){this.sky(time,quality);return;}
  if(world.up)this.ocean(time,world,quality);else this.city(time,world,quality);
 }
 private sky(time:number,quality:number):void{
  const g=this.ink;g.fillGradientStyle(0x159fda,0x39c7ed,0xd5fcf3,0xc4f3e8,1);g.fillRect(0,0,768,432);
  g.fillStyle(0xffee89,.9).fillCircle(636,87,39);g.fillStyle(0xffffff,.15).fillCircle(636,87,49);
  g.fillStyle(0x29b6bb).fillRect(0,325,768,107);g.lineStyle(2,0x95fff1,.55);
  for(let i=0;i<10;i++){const y=337+i*9;g.lineBetween(0,y,768,y+Math.sin(time+i)*2);}
  for(let i=0;i<3;i++)this.scenery[i].setVisible(true).setFrame(i%2).setPosition(110+i*300,370+Math.sin(i)*20).setDisplaySize(180,110);
  for(let i=0;i<quality+3;i++)this.clouds[i].setVisible(true).setPosition(((i*215-time*(7+i*2))%1040+1040)%1040-120,60+i*47).setDisplaySize(155+i*16,90).setAlpha(.7);
 }
 private ocean(time:number,w:ArcadeWorld,quality:number):void{
  const g=this.ink,a=w.arena;
  const border=this.borders;border.fillStyle(0x075c85).fillRect(0,0,208,432).fillRect(560,0,208,432);
  border.fillStyle(0x137fa2).fillTriangle(0,0,206,0,0,432);border.fillStyle(0x1da7bc).fillTriangle(768,0,562,0,768,432);
  border.lineStyle(2,0x40d7d4,.3);for(let i=0;i<12;i++){border.lineBetween(0,i*44-time*4%44,198,i*44-90-time*4%44);border.lineBetween(570,i*44+time*4%44,768,i*44+90+time*4%44);}
  this.water.tilePositionY=-w.scroll*.4-time*3;this.water.tilePositionX=Math.sin(time*.15)*6;
  this.shimmer.tilePositionY=-w.scroll*.27+time*2;this.shimmer.tilePositionX=80+time*2;
  g.fillStyle(0x075c85).fillRect(0,0,768,432);
  // Bright illustrated cabinet borders frame a portrait playfield in a landscape device.
  g.fillStyle(0x137fa2).fillTriangle(0,0,206,0,0,432);g.fillStyle(0x1da7bc).fillTriangle(768,0,562,0,768,432);
  g.lineStyle(2,0x40d7d4,.3);for(let i=0;i<12;i++){g.lineBetween(0,i*44-time*4%44,198,i*44-90-time*4%44);g.lineBetween(570,i*44+time*4%44,768,i*44+90+time*4%44);}
  g.fillGradientStyle(0x087fad,0x138fac,0x23b4b5,0x169eaf,1);g.fillRect(a.left,a.top,352,382);
  // Continuous phase functions are spatially periodic: no seam or stepped animation.
  for(let row=0;row<30;row++){
   const y=((row*23+w.scroll*.64)%690)-160;if(y<62||y>396)continue;g.lineStyle(row%3===0?2:1,row%3===0?0x94f2dc:0x064f8d,row%3===0?.18:.11);g.beginPath();
   for(let x=a.left;x<=a.right;x+=8){const yy=y+Math.sin(x*.035+row*.7+time*.6)*8+Math.sin(x*.016-time*.3)*9;if(x===a.left)g.moveTo(x,yy);else g.lineTo(x,yy);}g.strokePath();
  }
  const region=w.region;
  for(let i=0;i<5;i++){
   const y=((i*196+w.scroll*.85)%980)-170;
   const frame=region<1?0:region<3?i%3:region<5?2:i%2;
   const x=i%2?a.right-22:a.left+20;
   this.scenery[i].setVisible(region>0||i%2===0).setFrame(frame).setPosition(x,y).setDisplaySize(region>=4?130:108,region>=4?148:115).setDepth(-17).setMask(this.waterMask);
  }
  if(region===6){this.scenery[5].setVisible(true).setFrame(3).setPosition(384,90+Math.sin(time*.2)*7).setDisplaySize(280,280).setAlpha(.65);g.lineStyle(2,0xc6fff0,.3);for(let i=0;i<3;i++)g.strokeEllipse(384,100,100+((time*15+i*45)%150),50+((time*8+i*25)%70));}
  if(w.boss?.phase==='absent'){g.fillStyle(0x053d70,.35).fillEllipse(384,160,230+Math.sin(time*4)*20,180);g.lineStyle(3,0xebfff0,.6);g.strokeEllipse(384,160,210+time*20%45,150+time*16%30);}
  for(let i=0;i<Math.min(quality+1,3);i++)this.clouds[i].setVisible(true).setPosition(240+i*130,((time*(9+i*3)+i*210)%650)-100).setDisplaySize(160,80).setAlpha(.10);
  // Mask decorative islands at the portrait field boundary without covering gameplay.
  g.fillStyle(0x075c85).fillRect(0,0,0,0);
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
 destroy():void{this.ink.destroy();this.borders.destroy();this.water.destroy();this.shimmer.destroy();this.waterMask.destroy();this.maskShape.destroy();this.scenery.forEach(s=>s.destroy());this.clouds.forEach(s=>s.destroy());void this.scene;}
}
