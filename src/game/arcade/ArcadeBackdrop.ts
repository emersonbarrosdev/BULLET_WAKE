import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';
import {installPelagicTextures} from './PelagicPresentation';
import {WATER_SCALE,waterScrollOffset} from './PelagicWater';
import {
 installCoastTexture,
 installOceanCausticsTexture,
 installOceanDepthTexture,
 installVortexTexture,
 COAST_PERIOD,
} from './PelagicCoastAtlas';
import {coastAtScroll,isOpenSeaAt} from './PelagicCoastGeometry';

const STAGE1_LEFT=192,STAGE1_WIDTH=384;

/**
 * Fenda Pelágica: Arquipélago tropical em mar aberto com 3 camadas oceânicas
 * (1: Profundidade oceânica, 2: Água intermediária e cáusticas, 3: Superfície, correntes e espuma animada)
 * e formações costeiras assimétricas intercaladas com extensos trechos de mar aberto.
 */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private oceanDepth:Phaser.GameObjects.TileSprite;
 private water:Phaser.GameObjects.TileSprite;
 private oceanCaustics:Phaser.GameObjects.TileSprite;
 private vortex:Phaser.GameObjects.Image;
 private seaFx:Phaser.GameObjects.Graphics;
 private coast:Phaser.GameObjects.TileSprite;
 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  installPelagicTextures(scene);
  // Camada 1 — Profundidade oceânica (azul-cobalto profundo, manchas abissais e recifes submersos discretos)
  const depthKey=installOceanDepthTexture(scene);
  this.oceanDepth=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,depthKey).setDepth(-19.6).setVisible(false);
  // Camada 3 (Base) — Superfície de ondas oceânicas detalhadas
  this.water=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,'pelagic-water').setDepth(-19.2).setAlpha(.84).setVisible(false);
  this.water.setTileScale(WATER_SCALE,WATER_SCALE);
  // Camada 2 — Água intermediária (cáusticas animadas e variações suaves de profundidade)
  const causticsKey=installOceanCausticsTexture(scene);
  this.oceanCaustics=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,causticsKey).setDepth(-18.8).setAlpha(.26).setVisible(false);
  // Vórtice abissal da Fenda Pelágica (visível na aproximação e luta do chefe da Rota 01)
  const vortexKey=installVortexTexture(scene);
  this.vortex=scene.add.image(384,96,vortexKey).setDisplaySize(196,196).setDepth(-18.4).setVisible(false);
  // Arquipélago costeiro assimétrico + zonas rasas azul-turquesa + recifes de coral + espuma irregular
  const coastKey=installCoastTexture(scene);
  this.coast=scene.add.tileSprite(384,216,STAGE1_WIDTH,432,coastKey).setDepth(-18).setVisible(false);
  // Camada 3 (Detalhe) — Correntes, brilhos especulares e espuma animada nas zonas de contato
  this.seaFx=scene.add.graphics().setDepth(-17);
  for(let i=0;i<8;i++)this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-15));
  for(let i=0;i<5;i++)this.clouds.push(scene.add.image(0,0,'arc-scenery',4).setDepth(-12).setAlpha(.18));
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  this.ink.clear();this.seaFx.clear();
  for(const sprite of this.scenery)sprite.setVisible(false);
  for(const sprite of this.clouds)sprite.setVisible(false);
  const up=!!world?.up;
  this.oceanDepth.setVisible(up);
  this.water.setVisible(up);
  this.oceanCaustics.setVisible(up);
  this.coast.setVisible(up);
  if(!up)this.vortex.setVisible(false);
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
  // Camada 1 — Profundidade oceânica (parallax 0.78x)
  this.ink.fillStyle(0x05346b).fillRect(STAGE1_LEFT,0,STAGE1_WIDTH,432);
  this.oceanDepth.tilePositionY=-(w.scroll*.78+time*.55);
  this.oceanDepth.tilePositionX=Math.sin(time*.12)*1.4;

  // Camada 3 (Base) — Superfície oceânica (parallax 1.0x)
  this.water.tilePositionY=waterScrollOffset(w.scroll,time*2.2);
  this.water.tilePositionX=Math.sin(time*.18)*1.6;

  // Camada 2 — Água intermediária e cáusticas animadas (parallax 0.91x)
  this.oceanCaustics.tilePositionY=-(w.scroll*.91+time*3.6);
  this.oceanCaustics.tilePositionX=Math.cos(time*.25)*3.0;
  this.oceanCaustics.setAlpha(.23+.06*Math.sin(time*1.5));

  // Vórtice Abissal da Fenda Pelágica na aproximação/confronto com o chefe
  const bossApproach=w.route>=274||Boolean(w.boss&&!w.boss.mini);
  this.vortex.setVisible(bossApproach);
  if(bossApproach){
   const progress=w.boss&&!w.boss.mini?1:Math.min(1,Math.max(0,(w.route-274)/24));
   this.vortex.setDisplaySize(224,224).setPosition(384,-86+progress*142).setAngle(time*16).setAlpha(.88+.08*Math.sin(time*2.4));
  }

  // Arquipélago costeiro assimétrico sincronizado com world.scroll
  this.coast.tilePositionY=(-w.scroll%COAST_PERIOD+COAST_PERIOD)%COAST_PERIOD;

  // Camada 3 (Detalhe) — Ondas detalhadas, correntes, brilhos especulares e espuma de contato animada
  const g=this.seaFx,waveCount=quality===0?12:quality===1?18:26;
  for(let i=0;i<waveCount;i++){
   const y=((i*47+w.scroll*.94+time*4)%480+480)%480-24;
   const leftEdge=STAGE1_LEFT+coastAtScroll(w.scroll,y,-1)+8;
   const rightEdge=STAGE1_LEFT+coastAtScroll(w.scroll,y,1)-24;
   if(rightEdge<=leftEdge+20)continue;
   const span=rightEdge-leftEdge;
   const x=leftEdge+((i*73+Math.sin(i*1.7)*29)%span+span)%span;
   const alpha=.16+.10*Math.sin(time*1.3+i)**2;
   g.lineStyle(1,i%3===0?0xdcfbff:0x8be6ff,alpha);
   g.beginPath();
   for(let j=0;j<=8;j++){
    const xx=x+j*2.7;
    const yy=y+Math.sin(j*.62+i*.9+time*1.8)*1.35;
    if(j===0)g.moveTo(xx,yy);else g.lineTo(xx,yy);
   }
   g.strokePath();
   // Brilho especular solar sobre a crista da onda
   if(i%2===0){
    const glint=.22+.25*Math.max(0,Math.sin(time*2.8+i*1.9));
    g.fillStyle(0xf5ffff,glint);
    g.fillEllipse(x+9+Math.sin(time*2+i)*2,y-.5,4.2,1.5);
   }
  }

  // Correntes oceânicas longitudinais sutis no canal aberto
  const streamCount=quality===0?4:8;
  for(let s=0;s<streamCount;s++){
   const baseY=((s*112+w.scroll*.88+time*9)%520+520)%520-45;
   const baseX=276+(s*51)%216;
   g.lineStyle(.8,0x49c9ec,.13+.05*Math.cos(time+s));
   g.beginPath();
   for(let k=0;k<=10;k++){
    const yy=baseY+k*4.5;
    const xx=baseX+Math.sin(k*.45+time*1.2+s)*2.8;
    if(k===0)g.moveTo(xx,yy);else g.lineTo(xx,yy);
   }
   g.strokePath();
  }

  // Espuma animada nas zonas de contato terra–água (apenas onde há formação costeira ativa)
  const stepY=quality===0?18:12;
  for(const side of [-1,1] as const){
   for(let y=6;y<428;y+=stepY){
    const texY=((y-w.scroll)%COAST_PERIOD+COAST_PERIOD)%COAST_PERIOD;
    if(isOpenSeaAt(texY,side))continue;
    // Cria interrupções naturais para nunca formar linha contínua
    const wavePhase=Math.sin(texY*.085+time*2.6+side*1.4)+Math.cos(texY*.037-time*1.7);
    if(wavePhase<-.15)continue;
    const boundary=STAGE1_LEFT+coastAtScroll(w.scroll,y,side);
    const surge=Math.sin(time*3.1+texY*.06)*2.2;
    const fx=boundary-side*(2.5+surge);
    const foamAlpha=Math.min(.72,(.24+.22*wavePhase)*(1-Math.abs(surge)/4.2));
    g.lineStyle(1.4,0xf2ffff,foamAlpha);
    g.beginPath();
    g.moveTo(fx,y-3.5);
    g.lineTo(fx-side*1.8,y);
    g.lineTo(fx+side*.6,y+3.8);
    g.strokePath();
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
  this.ink.destroy();this.seaFx.destroy();this.oceanDepth.destroy();this.water.destroy();this.oceanCaustics.destroy();this.vortex.destroy();
  this.coast.destroy();
  this.scenery.forEach(s=>s.destroy());this.clouds.forEach(s=>s.destroy());
  void this.scene;
 }
}
