import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';

/** Lightweight painted-ocean layers; decorative scenery never changes collisions. */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private coast:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private water:Phaser.GameObjects.TileSprite;
 private shimmer:Phaser.GameObjects.TileSprite;

 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  // Extend the same moving ocean behind the HUD, rather than masking a narrow rectangle.
  this.water=scene.add.tileSprite(384,216,768,432,'arc-ocean').setDepth(-19).setTileScale(.94);
  this.shimmer=scene.add.tileSprite(384,216,768,432,'arc-ocean').setDepth(-18).setTileScale(1.2).setAlpha(.12);
  this.coast=scene.add.graphics().setDepth(-16);
  for(let i=0;i<12;i++)this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-15));
  for(let i=0;i<5;i++)this.clouds.push(scene.add.image(0,0,'arc-scenery',4).setDepth(-12).setAlpha(.18));
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  this.ink.clear();this.coast.clear();
  for(const s of this.scenery)s.setVisible(false).clearMask();
  for(const s of this.clouds)s.setVisible(false).clearMask();
  this.water.setVisible(!!world?.up);this.shimmer.setVisible(!!world?.up);
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
  const g=this.ink,c=this.coast;
  g.fillGradientStyle(0x044c87,0x075e98,0x12b2bb,0x078ca4,1).fillRect(0,0,768,432);
  this.water.tilePositionY=-w.scroll*.67-time*1.7;
  this.water.tilePositionX=Math.sin(time*.12)*7;
  this.shimmer.tilePositionY=-w.scroll*.28+time*1.2;
  this.shimmer.tilePositionX=67+Math.sin(time*.19)*12;

  // Shallow reefs, underwater shadows and broad bands of current cross the entire screen.
  // Static art is shared, but its perceived depth is shaped by light, foam and ground shadow.
  for(let side=0;side<2;side++){
   const x=side?756:12;
   for(let i=0;i<3;i++){
    const y=((i*189+w.scroll*(.19+i*.02))%680)-120;
    c.fillStyle(0x76f2d8,.055).fillEllipse(x,y,side?250:230,260);
    c.fillStyle(0x043f75,.095).fillEllipse(x+(side?-15:15),y+29,165,195);
   }
  }
  const landmarks=[
   {x:119,y:45,frame:0,size:122},{x:652,y:285,frame:1,size:139},
   {x:105,y:550,frame:2,size:135},{x:650,y:755,frame:0,size:127},
   {x:133,y:995,frame:1,size:144},{x:643,y:1210,frame:2,size:146},
   {x:92,y:1450,frame:0,size:128},{x:664,y:1640,frame:1,size:133},
   {x:117,y:1860,frame:2,size:140},
  ];
  // Stable world positions: islands slide with the ocean, not with frame time or spawn order.
  const cycle=2170;
  for(let i=0;i<landmarks.length;i++){
   const p=landmarks[i],y=((p.y+w.scroll*.82)%cycle+cycle)%cycle-180;
   if(y< -145||y>570)continue;
   const island=this.scenery[i],sz=p.size*(p.frame===2?1.04:1);
   // The shadow and foam contour visually embed each island/dock in the water.
   c.fillStyle(0x00496d,.37).fillEllipse(p.x+4,y+13,sz*1.24,sz*.75);
   c.fillStyle(0x79eacb,.20).fillEllipse(p.x,y+3,sz*1.12,sz*.86);
   c.lineStyle(2,0xd5fff1,.38).strokeEllipse(p.x,y+3,sz*1.13,sz*.87);
   island.setVisible(true).setFrame(p.frame).setPosition(p.x,y).setDisplaySize(sz,sz);
  }
  // Thin moving highlights read as ocean currents rather than a drawn rectangle.
  const strokes=quality===0?8:quality===1?13:19;
  for(let i=0;i<strokes;i++){
   const y=((i*57+w.scroll*(.36+i%3*.06))%590+590)%590-90;
   const cx=130+((i*131+49)%520);
   c.lineStyle(i%4===0?2:1,0xc9fff0,i%4===0?.24:.13);
   c.beginPath();c.moveTo(cx-29,y+Math.sin(time*.4+i)*3);
   c.lineTo(cx,y-3);c.lineTo(cx+25,y+Math.sin(time*.4+i)*3);c.strokePath();
  }
  // Subtle outer sea tint for the HUD: no hard playfield mask, no giant triangles.
  c.fillStyle(0x022b51,.22).fillRect(0,0,184,432).fillRect(584,0,184,432);
  if(w.region===6){
   const r=this.scenery[9];r.setVisible(true).setFrame(3).setPosition(384,45+Math.sin(time*.22)*6).setDisplaySize(205,205).setAlpha(.65);
   c.lineStyle(2,0xd2fff8,.2).strokeEllipse(384,60,170+Math.sin(time)*7,98);
  }
  for(let i=0;i<Math.min(quality+1,3);i++)this.clouds[i].setVisible(true).setPosition(126+i*230,((time*(7+i*2)+i*235)%640)-100).setDisplaySize(145,76).setAlpha(.08);
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
  this.ink.destroy();this.coast.destroy();this.water.destroy();this.shimmer.destroy();
  this.scenery.forEach(s=>s.destroy());this.clouds.forEach(s=>s.destroy());void this.scene;
 }
}
