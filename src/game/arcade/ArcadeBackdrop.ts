import Phaser from 'phaser';
import type {ArcadeWorld} from './ArcadeWorld';
import {installPelagicTextures} from './PelagicPresentation';
import {WATER_SCALE,waterScrollOffset} from './PelagicWater';
import {
 FORMATION_TEXTURE,
 installFormationEffects,
 installOceanDepthTexture,
 installOceanCausticsTexture,
 installWaveCrestTextures,
 installCoastalShoalTexture,
 installVortexTexture,
} from './PelagicCoastAtlas';
import {COAST_WIDTH,coastAtScroll,visibleFormations} from './PelagicCoastGeometry';
const STAGE1_LEFT=192,STAGE1_WIDTH=384;
const FAMILIES=['fighter','interceptor','acrobat','bomber','boat','ship','tank','tower'];
/** An authored 2.5D archipelago: continuous coastal beaches, multi-layered parallax ocean, animated wave crests, and rich naval wakes. */
export class ArcadeBackdrop {
 private ink:Phaser.GameObjects.Graphics;
 private scenery:Phaser.GameObjects.Image[]=[];
 private clouds:Phaser.GameObjects.Image[]=[];
 private oceanDepth:Phaser.GameObjects.TileSprite;
 private waterSwell:Phaser.GameObjects.TileSprite;
 private water:Phaser.GameObjects.TileSprite;
 private oceanCaustics:Phaser.GameObjects.TileSprite;
 private vortex:Phaser.GameObjects.Image;
 private seaFx:Phaser.GameObjects.Graphics;
 private deepReefs:Phaser.GameObjects.Image[]=[];
 private waveSprites:Phaser.GameObjects.Image[]=[];
 private connectorShallows:Phaser.GameObjects.Image[]=[];
 private connectorShadows:Phaser.GameObjects.Image[]=[];
 private coastConnectors:Phaser.GameObjects.Image[]=[];
 private connectorSurf:Phaser.GameObjects.Image[]=[];
 private coastRocks:Phaser.GameObjects.Image[]=[];
 private coastShadows:Phaser.GameObjects.Image[]=[];
 private coast:Phaser.GameObjects.Image[]=[];
 private shallows:Phaser.GameObjects.Image[]=[];
 private surf:Phaser.GameObjects.Image[]=[];
 private surfBlend:Phaser.GameObjects.Image[]=[];
 private shadows:Phaser.GameObjects.Image[]=[];
 private reefs:Phaser.GameObjects.Image[]=[];
 private wakes:Phaser.GameObjects.Image[]=[];
 private seagulls:Phaser.GameObjects.Sprite[]=[];
 private seagullShadows:Phaser.GameObjects.Image[]=[];
 private harborBoat:Phaser.GameObjects.Image;
 private harborBoatShadow:Phaser.GameObjects.Image;
 constructor(private scene:Phaser.Scene){
  this.ink=scene.add.graphics().setDepth(-20);
  installPelagicTextures(scene);
  installFormationEffects(scene);
  const waveKey=installWaveCrestTextures(scene);
  const shoalKey=installCoastalShoalTexture(scene);
  const vortexKey=installVortexTexture(scene);
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
  this.vortex=scene.add.image(384,82,vortexKey).setDepth(-18.68).setVisible(false);
  for(let i=0;i<20;i++){
   this.connectorShallows.push(scene.add.image(0,0,'pelagic-shallows-0').setDepth(-18.56).setVisible(false));
   this.connectorShadows.push(scene.add.image(0,0,FORMATION_TEXTURE,0).setTint(0x021329).setAlpha(.30).setDepth(-18.36).setVisible(false));
   this.coastConnectors.push(scene.add.image(0,0,FORMATION_TEXTURE,0).setDepth(-18.30).setVisible(false));
   this.connectorSurf.push(scene.add.image(0,0,'pelagic-surf-0-0').setDepth(-18.26).setVisible(false));
  }
  for(let i=0;i<16;i++){
   this.coastRocks.push(scene.add.image(0,0,FORMATION_TEXTURE,5).setDepth(-18.24).setVisible(false));
  }
  for(let i=0;i<8;i++){
   this.reefs.push(scene.add.image(0,0,shoalKey,0).setDepth(-18.6).setAlpha(.46).setVisible(false));
   this.shallows.push(scene.add.image(0,0,'pelagic-shallows-0').setDepth(-18.5).setVisible(false));
   this.coastShadows.push(scene.add.image(0,0,FORMATION_TEXTURE,0).setTint(0x021329).setAlpha(.32).setDepth(-18.2).setVisible(false));
   this.coast.push(scene.add.image(0,0,FORMATION_TEXTURE,0).setDepth(-18).setVisible(false));
   this.surf.push(scene.add.image(0,0,'pelagic-surf-0-0').setDepth(-17.8).setVisible(false));
   this.surfBlend.push(scene.add.image(0,0,'pelagic-surf-0-1').setDepth(-17.78).setVisible(false));
   this.scenery.push(scene.add.image(0,0,'arc-scenery',i%4).setDepth(-15));
  }
  this.harborBoatShadow=scene.add.image(0,0,'arc-enemies',4).setTint(0x021329).setAlpha(.28).setDepth(-17.55).setVisible(false);
  this.harborBoat=scene.add.image(0,0,'arc-enemies',4).setDepth(-17.5).setVisible(false);
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
  for(let i=0;i<12;i++){
   this.wakes.push(scene.add.image(0,0,'pelagic-wakes',0).setOrigin(.5,.85).setDepth(-1.5).setAlpha(.62).setVisible(false));
  }
 }
 draw(time:number,world?:ArcadeWorld,quality=2):void{
  this.ink.clear();this.seaFx.clear();
  for(const pool of[this.scenery,this.clouds,this.deepReefs,this.waveSprites,this.connectorShallows,this.connectorShadows,this.coastConnectors,this.connectorSurf,this.coastRocks,this.coastShadows,this.coast,this.shallows,this.surf,this.surfBlend,this.shadows,this.reefs,this.wakes,this.seagulls,this.seagullShadows])for(const sprite of pool)sprite.setVisible(false);
  this.vortex.setVisible(false);this.harborBoat.setVisible(false);this.harborBoatShadow.setVisible(false);
  const up=!!world?.up;this.oceanDepth.setVisible(up);this.waterSwell.setVisible(up);this.water.setVisible(up);this.oceanCaustics.setVisible(up);
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

  // Boss approach abyssal vortex (matches Reference Image 3 bottom panel)
  if(w.route>=265||(w.boss&&!w.boss.mini)){
   const vAlpha=w.boss&&!w.boss.mini?.9:Math.min(.9,(w.route-265)/25);
   this.vortex.setVisible(true).setPosition(384,68).setDisplaySize(196,158).setRotation(-time*.42).setAlpha(vAlpha);
  }

  // Continuous Coastal Beach Chains: connect consecutive coastal formations on the same side with
  // full-width edge-hugging sandy beaches, palm trees, shallows, and animated surf (never isolated rocks!).
  const extFormations=visibleFormations(w.scroll,220);
  let connIdx=0;
  const leftConnYs:number[]=[];
  for(const side of[-1,1] as const){
   const sideList=extFormations.filter(f=>f.spec.side===side).sort((a,b)=>a.y-b.y);
   const pool=side<0?[0,6,8,10]:[3,7,11];
   for(let j=0;j<sideList.length-1;j++){
    const a=sideList[j],b=sideList[j+1];
    const gapY=b.y-a.y;
    const midY=(a.y+b.y)/2;
    if(midY<-150||midY>580)continue;
    // Leave a side canal open directly below harbors (frames 2, 9), around accent rocks (frame 5), or if a naval unit is entering
    const isHarborCanal=a.spec.artFrame===2||a.spec.artFrame===9||a.spec.artFrame===5||b.spec.artFrame===5;
    const boatEntering=w.enemies.some(e=>(e.family==='boat'||e.family==='ship')&&e.navigation?.entry===side&&e.age<2.6&&Math.abs(e.y-midY)<115);
    // Avoid walling both left and right sides at the exact same vertical band so the route never looks like a corridor
    const oppositeConnected=side>0&&leftConnYs.some(ly=>Math.abs(ly-midY)<155);
    if(!isHarborCanal&&!boatEntering&&!oppositeConnected&&gapY<=500&&connIdx+1<this.coastConnectors.length){
     const candidates=pool.filter(f=>f!==a.spec.artFrame&&f!==b.spec.artFrame);
     const f1=candidates[j%Math.max(1,candidates.length)]??pool[j%pool.length];
     const f2=candidates[(j+1)%Math.max(1,candidates.length)]??pool[(j+1)%pool.length];
     const cx=STAGE1_LEFT+(side<0?74:COAST_WIDTH-74);
     const cw=220,ch=236;
     for(const [stepIdx,t,cFrame] of [[0,0.34,f1],[1,0.67,f2]] as const){
      const cy=a.y+gapY*t;
      this.connectorShallows[connIdx].setVisible(true).setTexture('pelagic-shallows-'+cFrame).setPosition(cx,cy).setDisplaySize(cw,ch).setAlpha(.90);
      this.connectorShadows[connIdx].setVisible(quality>0).setFrame(cFrame).setPosition(cx+(side<0?6:-4),cy+7).setDisplaySize(cw,ch);
      this.coastConnectors[connIdx].setVisible(true).setFrame(cFrame).setPosition(cx,cy).setDisplaySize(cw,ch);
      if(quality>0){
       const surfF=Math.floor(time*1.15+j+stepIdx)%4;
       this.connectorSurf[connIdx].setVisible(true).setTexture('pelagic-surf-'+cFrame+'-'+surfF).setPosition(cx,cy).setDisplaySize(cw,ch).setAlpha(.52);
      }
      connIdx++;
     }
     if(side<0)leftConnYs.push(midY);
    }
   }
  }

  const formations=visibleFormations(w.scroll);
  formations.forEach(({spec,y,key},i)=>{
   if(i>=this.coast.length)return;
   const cycleNum=Math.abs(Number(key.split(':')[0])||0);
   const x=STAGE1_LEFT+spec.centerX,h=spec.yEnd-spec.yStart;
   if(quality>0){
    this.reefs[i].setVisible(true).setFrame(0).setPosition(x-spec.side*8,y+h*.28).setDisplaySize(84,64).setAlpha(.44);
   }
   this.shallows[i].setVisible(true).setTexture('pelagic-shallows-'+spec.artFrame).setPosition(x,y).setDisplaySize(spec.width,h).setAlpha(.92);
   this.coastShadows[i].setVisible(quality>0).setFrame(spec.artFrame).setPosition(x+(spec.side<0?6:-4),y+7).setDisplaySize(spec.width,h);
   this.coast[i].setVisible(true).setFrame(spec.artFrame).setPosition(x,y).setDisplaySize(spec.width,h);
   // Slow, silky-smooth cross-faded shoreline surf animation
   if(quality>0){
    const surfPhase=time*1.15+spec.id*.7;
    const f0=Math.floor(surfPhase)%4,f1=(f0+1)%4,blend=surfPhase-Math.floor(surfPhase);
    const smoothBlend=blend*blend*(3-2*blend);
    const breathe=.52+.14*Math.sin(time*1.3+spec.id);
    this.surf[i].setVisible(true).setTexture('pelagic-surf-'+spec.artFrame+'-'+f0).setPosition(x,y).setDisplaySize(spec.width,h).setAlpha((1-smoothBlend)*breathe);
    this.surfBlend[i].setVisible(true).setTexture('pelagic-surf-'+spec.artFrame+'-'+f1).setPosition(x,y).setDisplaySize(spec.width,h).setAlpha(smoothBlend*breathe);
   }

   // Harbor / Stranded Boat Rule:
   // - Appears AT MOST 2 TIMES across the entire stage (cycleNum === 1 and cycleNum === 2; NEVER on cycleNum >= 3!).
   // - 1st time (cycleNum === 1): normal moored boat in clean harbor water below the pier.
   // - 2nd time (cycleNum === 2): LARGER island extension + boat stranded, turned sideways ('virado') and billowing smoke ('fumaçando')!
   if(spec.artFrame===2&&!this.harborBoat.visible){
    if(cycleNum===1){
     const bx=STAGE1_LEFT+114+Math.sin(time*1.2)*1.1,by=y+54+Math.cos(time*1.0)*1.1;
     const bRot=0.52+Math.sin(time*1.1)*.025;
     this.harborBoatShadow.setVisible(true).setPosition(bx+2.5,by+3.5).setDisplaySize(27,27).setRotation(bRot);
     this.harborBoat.setVisible(true).clearTint().setPosition(bx,by).setDisplaySize(28,28).setRotation(bRot);
     this.seaFx.lineStyle(1.2,0xd8ffff,.46).strokeEllipse(bx,by+1,24+Math.sin(time*2.4)*1.8,14+Math.cos(time*2.4)*1.2);
    }else if(cycleNum===2){
     if(connIdx<this.coastConnectors.length){
      const extX=STAGE1_LEFT+82,extY=y+118;
      this.connectorShallows[connIdx].setVisible(true).setTexture('pelagic-shallows-8').setPosition(extX,extY).setDisplaySize(220,216).setAlpha(.92);
      this.connectorShadows[connIdx].setVisible(quality>0).setFrame(8).setPosition(extX+6,extY+7).setDisplaySize(220,216);
      this.coastConnectors[connIdx].setVisible(true).setFrame(8).setPosition(extX,extY).setDisplaySize(220,216);
      connIdx++;
     }
     const bx=STAGE1_LEFT+104,by=y+68;
     const bRot=-1.98+Math.sin(time*2.8)*.015;
     this.harborBoatShadow.setVisible(true).setPosition(bx+3,by+4).setDisplaySize(32,29).setRotation(bRot);
     this.harborBoat.setVisible(true).setTint(0xd8b49e).setPosition(bx,by).setDisplaySize(32,29).setRotation(bRot);
     for(let s=0;s<10;s++){
      const p=(time*.52+s/10)%1;
      const sx=bx+3+p*26+Math.sin(time*2.4+s*1.7)*5;
      const sy=by-4-p*48;
      const rad=4+p*11;
      const col=p<.25?0x231f20:p<.6?0x4a474c:0x969aa2;
      const alpha=(1-p)*0.76;
      this.seaFx.fillStyle(col,alpha).fillCircle(sx,sy,rad);
     }
     for(let f=0;f<4;f++){
      const fp=(time*1.8+f*.25)%1;
      const fx=bx+2+Math.sin(time*7+f*2)*3.5,fy=by-2-fp*13;
      this.seaFx.fillStyle(f%2===0?0xff6a1a:0xffd448,(1-fp)*.9).fillCircle(fx,fy,2.8-fp*1.3);
     }
    }else if(connIdx<this.coastConnectors.length){
     const extX=STAGE1_LEFT+82,extY=y+112;
     this.connectorShallows[connIdx].setVisible(true).setTexture('pelagic-shallows-6').setPosition(extX,extY).setDisplaySize(220,210).setAlpha(.92);
     this.connectorShadows[connIdx].setVisible(quality>0).setFrame(6).setPosition(extX+6,extY+7).setDisplaySize(220,210);
     this.coastConnectors[connIdx].setVisible(true).setFrame(6).setPosition(extX,extY).setDisplaySize(220,210);
     connIdx++;
    }
   }
  });

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
   this.shadows[shadow++].setVisible(true).setTexture(texture,Math.max(0,frame)).setPosition(e.x+(e.ground?3:12),e.y+(e.ground?4:16)).setDisplaySize(e.size*(e.ground?.96:.82),e.size*(e.ground?.96:.82)).setRotation(rotation).setAlpha(e.ground?.3:.2);
   if(!naval)continue;
   const holding=e.navigation?.phase==='hold';
   const angle=heading-Math.PI/2;
   const fx=Math.cos(angle),fy=Math.sin(angle),sx=-fy,sy=fx;
   if(wake<this.wakes.length){
    const wIdx=wake++;
    const wakeFrame=Math.floor(time*3.2+e.id)%4;
    this.wakes[wIdx].setVisible(true).setFrame(wakeFrame).setPosition(e.x-fx*e.size*.14,e.y-fy*e.size*.14).setDisplaySize(e.size*.88,e.size*1.85).setRotation(heading-Math.PI).setAlpha(holding?.38:.72);
   }
   const cx=e.x+fx*e.size*.12,cy=e.y+fy*e.size*.12;
   for(const side of[-1,1]){
    g.lineStyle(1.4,0xe8ffff,holding?.32:.58);
    g.beginPath();
    for(let j=0;j<=8;j++){
     const t=j/8,along=(.24-t*.92)*e.size,across=(Math.sin(t*Math.PI*.75)*e.size*.18+t*e.size*.14)*side;
     const x=cx+fx*along+sx*across,y=cy+fy*along+sy*across;
     if(j===0)g.moveTo(x,y);else g.lineTo(x,y);
    }
    g.strokePath();
    for(let j=0;j<(quality?10:5);j++){
     const t=(j/10+time*.55)%1;
     const aft=e.size*.34+t*e.size*.78,across=(3+t*e.size*.2)*side+Math.sin(time*4.5+j)*.8;
     const x=e.x-fx*aft+sx*across,y=e.y-fy*aft+sy*across;
     g.fillStyle(j%2===0?0xf2ffff:0x78e2f0,(1-t)*(holding?.28:.52));
     g.fillEllipse(x,y,1.5+t*1.8,1.1+t*1.1);
    }
   }
  }

  // Scheduled 2.5D Seagull Director (with long 20s-40s pauses between events, never continuous back-to-back!):
  // Master 112s cycle:
  //  - [8.5s .. 14.0s]  (5.5s): 1 solo bird crosses from one side of the screen to the other and disappears.
  //    (Followed by a 22.0s pause with zero birds!)
  //  - [36.0s .. 42.2s] (6.2s): A V-formation flock of 3 birds crosses together without interfering with gameplay.
  //    (Followed by a 42.8s pause with zero birds!)
  //  - [85.0s .. 92.6s] (7.6s): 1 low coastal bird flying/hovering almost stationary close to the water surface ('voando mas parado mais perto da água').
  //    (Followed by a 27.9s pause with zero birds!)
  if(quality>0&&this.scene.textures.exists('pelagic-seagulls')){
   const masterPeriod=112.0;
   const cycleIdx=Math.floor(time/masterPeriod);
   const cycleT=time%masterPeriod;

   if(cycleT>=8.5&&cycleT<=14.0){
    // Event 1: Single solo bird crossing ('1 atravessa sozinho')
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
    // Event 2: Small V-flock of 3 birds crossing together ('daqui uns 20s um grupo atravessa sem atrapalhar a gameplay')
    const p=(cycleT-36.0)/6.2;
    const dir=cycleIdx%2===0?-1:1;
    const startX=dir>0?STAGE1_LEFT-36:STAGE1_LEFT+STAGE1_WIDTH+36;
    const endX=dir>0?STAGE1_LEFT+STAGE1_WIDTH+36:STAGE1_LEFT-36;
    const leadX=startX+(endX-startX)*p;
    const leadY=168+(p-.5)*(dir>0?-38:34)+Math.sin(p*Math.PI)*-10;
    const fade=p<.09?p/.09:p>.89?(1-p)/.11:1;
    const bankRot=dir>0?-0.09:0.09;
    // V-formation offsets (leader at 0, two wingmen beside/slightly behind — never single-file!)
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
    // Event 3: Single bird hovering/flying almost stationary low near the water ('voando mas parado mais perto da agua')
    const p=(cycleT-85.0)/7.6;
    const side=cycleIdx%2===0?-1:1;
    const edgeX=side<0?STAGE1_LEFT-18:STAGE1_LEFT+STAGE1_WIDTH+18;
    const hoverX=side<0?STAGE1_LEFT+118:STAGE1_LEFT+STAGE1_WIDTH-118;
    // Glides in during p=0..0.18, hovers nearly stationary over the water during p=0.18..0.82, banks out during p=0.82..1.0
    const reach=p<.18?Math.sin(p/.18*Math.PI*.5):p>.82?Math.sin((1-p)/.18*Math.PI*.5):1;
    const gx=edgeX+(hoverX-edgeX)*reach+Math.sin(time*1.9)*3.2;
    const gy=196+Math.cos(time*1.5)*2.8+(p-.5)*14;
    const fade=p<.08?p/.08:p>.90?(1-p)/.10:1;
    const gSprite=this.seagulls[0],gShadow=this.seagullShadows[0];
    const animKey=Math.sin(time*2.6)>-.25?'seagull-glide':'seagull-fly';
    if(gSprite.anims.currentAnim?.key!==animKey)gSprite.play(animKey);
    const flip=p>.82?(side<0):(side>0);
    const bankRot=Math.sin(time*1.8)*.05;
    // Closer to the water surface: tight shadow offset (+3, +4.5) and delicate surface wind ripple beneath the wings
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
  this.ink.destroy();this.seaFx.destroy();this.oceanDepth.destroy();this.waterSwell.destroy();this.water.destroy();this.oceanCaustics.destroy();
  this.vortex.destroy();this.harborBoat.destroy();this.harborBoatShadow.destroy();
  for(const pool of[this.scenery,this.clouds,this.deepReefs,this.waveSprites,this.connectorShallows,this.connectorShadows,this.coastConnectors,this.connectorSurf,this.coastRocks,this.coastShadows,this.coast,this.shallows,this.surf,this.surfBlend,this.shadows,this.reefs,this.wakes,this.seagulls,this.seagullShadows])pool.forEach(s=>s.destroy());
  void this.scene;
 }
}
