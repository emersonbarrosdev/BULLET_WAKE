import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';
import {installPelagicTextures} from './PelagicPresentation';
import {WATER_SCALE,waterScrollOffset} from './PelagicWater';
import {FORMATION_TEXTURE,installFormationEffects,installOceanDepthTexture,installOceanCausticsTexture} from './PelagicCoastAtlas';
import {visibleFormations} from './PelagicCoastGeometry';
const STAGE1_LEFT=192,STAGE1_WIDTH=384;
const FAMILIES=['fighter','interceptor','acrobat','bomber','boat','ship','tank','tower'];
/** An authored archipelago: original land art, local contact effects and independent ocean layers. */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private oceanDepth:Phaser.GameObjects.TileSprite;
 private water:Phaser.GameObjects.TileSprite;
 private oceanCaustics:Phaser.GameObjects.TileSprite;
 private seaFx:Phaser.GameObjects.Graphics;
 private coast:Phaser.GameObjects.Image[]=[];
 private shallows:Phaser.GameObjects.Image[]=[];
 private surf:Phaser.GameObjects.Image[]=[];
 private shadows:Phaser.GameObjects.Image[]=[];
 private reefs:Phaser.GameObjects.Image[]=[];
 private wakes:Phaser.GameObjects.Image[]=[];
 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  installPelagicTextures(scene);installFormationEffects(scene);
  this.oceanDepth=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,installOceanDepthTexture(scene)).setDepth(-19.6).setVisible(false);
  this.water=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,'pelagic-water-review').setDepth(-19.2).setAlpha(.86).setVisible(false).setTileScale(WATER_SCALE,WATER_SCALE);
  this.oceanCaustics=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,installOceanCausticsTexture(scene)).setDepth(-18.8).setAlpha(.13).setVisible(false).setTileScale(.4,.4);
  for(let i=0;i<8;i++){
   this.reefs.push(scene.add.image(0,0,'pelagic-archipelago',5).setDepth(-19.4).setAlpha(.65).setVisible(false));
   this.shallows.push(scene.add.image(0,0,'pelagic-shallows-0').setDepth(-18.6).setVisible(false));
   this.coast.push(scene.add.image(0,0,FORMATION_TEXTURE,0).setDepth(-18).setVisible(false));
   this.surf.push(scene.add.image(0,0,'pelagic-surf-0-0').setDepth(-17.8).setVisible(false));
   this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-15));
  }
  this.seaFx=scene.add.graphics().setDepth(-1);
  for(let i=0;i<5;i++)this.clouds.push(scene.add.image(0,0,'arc-scenery',4).setDepth(-12).setAlpha(.18));
  for(let i=0;i<48;i++)this.shadows.push(scene.add.image(0,0,'arc-enemies',0).setTint(0x031d3b).setAlpha(.22).setDepth(-2).setVisible(false));
  for(let i=0;i<12;i++)this.wakes.push(scene.add.image(0,0,'pelagic-wakes',0).setOrigin(.5,.83).setDepth(-1.5).setAlpha(.48).setVisible(false));
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  this.ink.clear();this.seaFx.clear();
  for(const pool of[this.scenery,this.clouds,this.coast,this.shallows,this.surf,this.shadows,this.reefs,this.wakes])for(const sprite of pool)sprite.setVisible(false);
  const up=!!world?.up;this.oceanDepth.setVisible(up);this.water.setVisible(up);this.oceanCaustics.setVisible(up);
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
  const time=w.elapsed;
  this.ink.fillStyle(0x073b6d).fillRect(STAGE1_LEFT,0,STAGE1_WIDTH,432);
  this.oceanDepth.tilePositionY=-(w.scroll*.96+time*.25);
  this.water.tilePositionY=waterScrollOffset(w.scroll,time);
  this.water.tilePositionX=Math.sin(time*.15)*.6;
  this.oceanCaustics.tilePositionY=-(w.scroll/.4+time*1.8);
  this.oceanCaustics.tilePositionX=Math.sin(time*.21)*2;
  this.oceanCaustics.setAlpha(.11+.025*Math.sin(time*.8));
  const formations=visibleFormations(w.scroll);
  formations.forEach(({spec,y},i)=>{
   if(i>=this.coast.length)return;
   const x=STAGE1_LEFT+spec.centerX,h=spec.yEnd-spec.yStart;
   this.reefs[i].setVisible(quality>0).setPosition(x-spec.side*30,y+h*.3).setDisplaySize(90,65);
   this.coast[i].setVisible(true).setFrame(spec.artFrame).setPosition(x,y).setDisplaySize(spec.width,h);
   this.shallows[i].setVisible(true).setTexture('pelagic-shallows-'+spec.artFrame).setPosition(x,y).setDisplaySize(spec.width,h);
   this.surf[i].setVisible(quality>0).setTexture('pelagic-surf-'+spec.artFrame+'-'+(Math.floor(time*5+spec.id)%4)).setPosition(x,y).setDisplaySize(spec.width,h).setAlpha(.68);
  });
  // Actual hull contact and altitude shadows; no collision or movement changes.
  const g=this.seaFx;
  let shadow=0,wake=0;
  for(const e of w.enemies){
   if(shadow>=this.shadows.length-1)break;
   const naval=e.family==='boat'||e.family==='ship';
   const rotation=e.ground?(e.navigation?.heading??Math.PI)-Math.PI:e.family==='alien'?0:Math.PI;
   const texture=e.family==='alien'?'arc-ufo':'arc-enemies';
   const frame=e.family==='alien'?0:e.family==='airship'?12:FAMILIES.indexOf(e.family);
   this.shadows[shadow++].setVisible(true).setTexture(texture,Math.max(0,frame)).setPosition(e.x+(e.ground?2:12),e.y+(e.ground?3:16)).setDisplaySize(e.size*(e.ground?.96:.82),e.size*(e.ground?.96:.82)).setRotation(rotation).setAlpha(e.ground?.28:.18);
   if(!naval)continue;
   if(wake<this.wakes.length)this.wakes[wake++].setVisible(true).setFrame(Math.floor(time*7+e.id)%4).setPosition(e.x,e.y).setDisplaySize(e.size*1.05,e.size*1.8).setRotation(rotation).setAlpha(e.navigation?.phase==='hold'?.22:.48);
   // Foam around the wetted hull and two diverging, broken trailing wakes.
   const angle=(e.navigation?.heading??Math.PI)-Math.PI/2;
   const fx=Math.cos(angle),fy=Math.sin(angle),sx=-fy,sy=fx;
   const cx=e.x-fx*e.size*.08,cy=e.y-fy*e.size*.08;
   for(const side of[-1,1]){
    g.lineStyle(1,0xc1f1ed,.45);
    g.beginPath();
    for(let j=0;j<=8;j++){
     const t=j/8,along=(.28-t*.72)*e.size,across=Math.sin(t*Math.PI)*e.size*.22*side;
     const x=cx+fx*along+sx*across,y=cy+fy*along+sy*across;
     if(j===0)g.moveTo(x,y);else g.lineTo(x,y);
    }g.strokePath();
    for(let j=0;j<(quality?14:7);j++){
     const t=(j/14+time*.65)%1;
     const aft=e.size*.34+t*e.size*.75,across=(4+t*e.size*.24)*side;
     const x=e.x-fx*aft+sx*across,y=e.y-fy*aft+sy*across;
     g.fillStyle(j%3===0?0xf0ffff:0x71cddd,(1-t)*.52);
     g.fillEllipse(x,y,1.5+t*2.2,1+t);
    }
   }
  }
  this.shadows[shadow].setVisible(w.state!=='defeat').setTexture('arc-rivet',1).setPosition(w.player.x+11,w.player.y+17).setDisplaySize(25,31).setRotation(0).setAlpha(.2);
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
  this.ink.destroy();this.seaFx.destroy();this.oceanDepth.destroy();this.water.destroy();this.oceanCaustics.destroy();
  for(const pool of[this.scenery,this.clouds,this.coast,this.shallows,this.surf,this.shadows,this.reefs,this.wakes])pool.forEach(s=>s.destroy());
  void this.scene;
 }
}
