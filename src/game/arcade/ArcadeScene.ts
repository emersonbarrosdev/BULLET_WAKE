import Phaser from 'phaser';
import {ArcadeWorld,type WorldEvent,type Controls} from './ArcadeWorld';
import {ArcadeBackdrop} from './ArcadeBackdrop';
import {ArcadeAudio} from './ArcadeAudio';
import {MISSIONS,type Family} from './content';
import {connectedPad,GamepadReader,padLabels} from '../systems/gamepadInput';
import {globalSave} from '../systems/saveSystem';
import {globalAudio} from '../audio/audioSystem';
import {stageFlightSnapshot,type CampaignFlight} from '../systems/campaignFlight';
import {spriteContact} from '../render/SpriteSilhouette';
import {enableCombatResolution} from '../render/combatResolution';
import {clamp} from './geometry';
import {readArcadeProgress,recordArcadeClear} from './progress';
import {surfaceMount} from './PelagicEnvironment';
import {pelagicShotSize} from './PelagicPresentation';
import {rivetShotPresentation} from '../render/rivetPresentation';
import {SUPPLY_ART,SUB_ART,BOMB_ART,BLAST_ART,installCombatArt,HitOverlays,BombArt} from './ArcadeCombatArt';
import {EMPLACEMENT_TEXTURE,GUN_SMOKE_TEXTURE,TOWER_TEXTURE,PelagicEmplacements} from './PelagicEmplacements';
import {
 UI,UI_FONT,UI_TEX,UI_ICON,UI_PIP,
 preloadMenuAssets,installMenuAnims,makePanel,makeRibbon,makeButtonBg,makeGaugeMeter,makeIcon,makeKeyBadge,
 type SpriteButton,
} from './ArcadeMenuArt';

type Screen='loading'|'intro'|'title'|'pilot'|'missions'|'play'|'pause'|'controls'|'settings'|'confirm-exit'|'result'|'defeat'|'ending';
type Effect={sprite:Phaser.GameObjects.Sprite;age:number;duration:number;size:number;vx:number;vy:number;spin:number;};
type MenuButton={node:Phaser.GameObjects.Text;bg:SpriteButton;extras:Phaser.GameObjects.Text[];action:()=>void;onLeft?:()=>void;onRight?:()=>void;};
const FONT=UI_FONT;
const FAMILY_ORDER:Family[]=['fighter','interceptor','acrobat','bomber','boat','ship','tank','tower'];
const BLUE=0x16385b;
/** Cartoon presentation over one shared deterministic UP/SIDE simulation. Legacy content remains registered separately. */
export class ArcadeScene extends Phaser.Scene {
 world?:ArcadeWorld;screen:Screen='intro';audio=new ArcadeAudio();quality=2;
 private backdrop!:ArcadeBackdrop;private hudLeft!:Phaser.GameObjects.Image;private hudRight!:Phaser.GameObjects.Image;private ui!:Phaser.GameObjects.Container;private decor!:Phaser.GameObjects.Graphics;private combatInk!:Phaser.GameObjects.Graphics;private hud!:Phaser.GameObjects.Text;private radio!:Phaser.GameObjects.Text;
 private player!:Phaser.GameObjects.Sprite;private bossSprite!:Phaser.GameObjects.Sprite;private hero!:Phaser.GameObjects.Sprite;private logo!:Phaser.GameObjects.Sprite;private wingmen:Phaser.GameObjects.Sprite[]=[];
 private lifeIcons:Phaser.GameObjects.Image[]=[];
 private introWash!:Phaser.GameObjects.Rectangle;private introHalo!:Phaser.GameObjects.Sprite;private introCrest!:Phaser.GameObjects.Sprite;private introTitle!:Phaser.GameObjects.Text;private introSub!:Phaser.GameObjects.Text;
 private loadStartMs=0;private loadRealProgress=0;private loadVisualProgress=0;
 private loadBg?:Phaser.GameObjects.Rectangle;private loadTitle?:Phaser.GameObjects.Text;private loadBar?:Phaser.GameObjects.Graphics;private loadPct?:Phaser.GameObjects.Text;
 private enemySprites=new Map<number,Phaser.GameObjects.Sprite>();private cargoSprites=new Map<number,Phaser.GameObjects.Sprite>();private partSprites=new Map<number,Phaser.GameObjects.Sprite>();private bulletSprites:Phaser.GameObjects.Sprite[]=[];private effects:Effect[]=[];
 private turrets=new Map<number,Phaser.GameObjects.Sprite>();private effectPool:Phaser.GameObjects.Sprite[]=[];
 private controls!:Record<string,Phaser.Input.Keyboard.Key>;private pad=new GamepadReader();buttons:MenuButton[]=[];private focus=0;
 private clock=0;private introClock=0;private accumulator=0;private lastHud='';private messageUntil=0;private pauseOrigin:Screen='pause';private carried?:CampaignFlight;private currentMission=0;private stageClearSaved=false;
 private touch={x:0,y:0,fire:false,special:false};private touchStart?:{id:number;x:number;y:number};private touchFireId=-1;private touchSpecialId=-1;private touchNodes:(Phaser.GameObjects.Graphics|Phaser.GameObjects.Text)[]=[];
 private mute=false;
 private pelagicLevel!:Phaser.GameObjects.Text;
 private emplacements!:PelagicEmplacements;private hitOverlays!:HitOverlays;private bombArt!:BombArt;
 constructor(){super('ArcadeScene');}
 preload():void{
  const base=import.meta.env.BASE_URL;
  this.load.spritesheet('arc-ufo',`${base}assets/arcade/ufo.webp`,{frameWidth:256,frameHeight:256});
  for(const [key,file] of [[SUPPLY_ART,'supply-items'],[SUB_ART,'submarines'],[BOMB_ART,'bomb-flight'],[BLAST_ART,'colossal-blast']])this.load.image(key,`${base}assets/arcade/pelagic-review/${file}.png`);
  this.load.image('arc-ocean',`${base}assets/arcade/ocean.webp`);
  this.load.image(EMPLACEMENT_TEXTURE,`${base}assets/arcade/pelagic-review/emplacements.png`);
  this.load.image(TOWER_TEXTURE,`${base}assets/arcade/pelagic-review/defense-tower.png`);
  this.load.image(GUN_SMOKE_TEXTURE,`${base}assets/arcade/pelagic-review/gun-smoke.png`);
   this.load.spritesheet('pelagic-coast',`${base}assets/arcade/pelagic-coast.webp`,{frameWidth:512,frameHeight:512});
   this.load.spritesheet('pelagic-archipelago',`${base}assets/arcade/pelagic-archipelago.webp`,{frameWidth:512,frameHeight:512});
   this.load.image('pelagic-water',`${base}assets/arcade/pelagic-water.webp`);
   this.load.spritesheet('pelagic-review-formations',`${base}assets/arcade/pelagic-review/formations.webp`,{frameWidth:768,frameHeight:768});
   this.load.image('pelagic-coast-harbor-v2',`${base}assets/arcade/pelagic-review/coast-harbor-v2.png`);
   this.load.image('pelagic-coast-leisure-v2',`${base}assets/arcade/pelagic-review/coast-leisure-v3.png`);
   this.load.image('pelagic-water-review',`${base}assets/arcade/pelagic-review/water.webp`);
   this.load.spritesheet('pelagic-wakes',`${base}assets/arcade/pelagic-review/wakes.webp`,{frameWidth:256,frameHeight:512});this.load.spritesheet('pelagic-seagulls',`${base}assets/arcade/pelagic-review/seagulls.webp`,{frameWidth:128,frameHeight:128});
   this.load.image('arc-stage1-hud-left',`${base}assets/arcade/stage1-hud-left.webp`);
   this.load.image('arc-stage1-hud-right',`${base}assets/arcade/stage1-hud-right.webp`);
  for(const name of ['rivet','enemies','pilots','scenery'])this.load.spritesheet('arc-'+name,`${base}assets/arcade/${name}.webp`,{frameWidth:256,frameHeight:256});
  this.load.spritesheet('arc-boss',`${base}assets/arcade/boss.webp`,{frameWidth:512,frameHeight:512});
  this.load.spritesheet('arc-red',`${base}assets/combat-hd/polish/rivet-red.webp`,{frameWidth:128,frameHeight:128});
  this.load.spritesheet('arc-explosion',`${base}assets/arcade/explosion.webp`,{frameWidth:256,frameHeight:256});
  this.load.spritesheet('arc-missile',`${base}assets/combat-hd/review/effects-missile.webp`,{frameWidth:256,frameHeight:256});
  preloadMenuAssets(this,base);
  this.loadStartMs=performance.now();this.loadRealProgress=0;this.loadVisualProgress=0;
  this.loadBg=this.add.rectangle(384,216,768,432,0x020611,1).setDepth(90);
  this.loadTitle=this.add.text(384,186,'CARREGANDO...',{fontFamily:FONT,fontSize:'14px',fontStyle:'bold',color:'#e6f6ff',stroke:'#040e24',strokeThickness:3}).setResolution(2).setOrigin(.5).setDepth(92);
  this.loadBar=this.add.graphics().setDepth(92);
  this.loadPct=this.add.text(384,244,'0%',{fontFamily:FONT,fontSize:'12px',fontStyle:'bold',color:UI.cyanHex,stroke:'#040e24',strokeThickness:3}).setResolution(2).setOrigin(.5).setDepth(92);
  this.drawLoadBar(0.02);
  this.load.on('progress',(n:number)=>{
   this.loadRealProgress=n;
   const elapsed=Math.max(0,(performance.now()-this.loadStartMs)/1000);
   this.syncLoadVisual(Math.min(n,clamp(elapsed/2.75,0.02,1)));
  });
  this.load.once('complete',()=>{this.loadRealProgress=1;});
 }
 private drawLoadBar(p:number):void{
  if(!this.loadBar)return;
  const x=214,y=210,w=340,h=16,pad=3,innerW=Math.max(0,(w-pad*2)*clamp(p,0,1));
  this.loadBar.clear();
  this.loadBar.fillStyle(0x07152e,.95).fillRoundedRect(x,y,w,h,8);
  this.loadBar.lineStyle(1.5,0x3edcff,.78).strokeRoundedRect(x,y,w,h,8);
  if(innerW>2){
   this.loadBar.fillGradientStyle(0x2ce0ff,0x5cf2ff,0x1ea8f5,0x45e5ff,1).fillRoundedRect(x+pad,y+pad,Math.max(8,innerW),h-pad*2,5);
   this.loadBar.fillStyle(0xffffff,.28).fillRoundedRect(x+pad+2,y+pad+1,Math.max(4,innerW-4),3,2);
  }
 }
 private syncLoadVisual(p:number,alpha=1):void{
  const shown=clamp(Math.max(this.loadVisualProgress,p),0,1);
  this.loadVisualProgress=shown;
  this.drawLoadBar(shown);
  this.loadPct?.setText(`${Math.round(shown*100)}%`);
  for(const obj of [this.loadTitle,this.loadBar,this.loadPct])obj?.setAlpha(alpha);
 }
 private destroyLoadOverlay():void{
  for(const obj of [this.loadBg,this.loadTitle,this.loadBar,this.loadPct])obj?.destroy();
  this.loadBg=undefined;this.loadTitle=undefined;this.loadBar=undefined;this.loadPct=undefined;
 }
 create():void{
  enableCombatResolution(this);this.input.addPointer(3);
  this.controls=this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,X,ESC,ENTER') as Record<string,Phaser.Input.Keyboard.Key>;
  this.input.keyboard!.addCapture(['SPACE','UP','DOWN','LEFT','RIGHT','ENTER']);
  const settings=globalSave.getSettings();this.mute=settings.isMuted;this.audio.setMix(settings.musicVolume,settings.sfxVolume,this.mute);
  try{const stored=localStorage.getItem('bullet_wake_visual');if(stored!==null)this.quality=clamp(Number(stored)||0,0,2);}catch{/* Optional preference. */}
  installCombatArt(this);installMenuAnims(this);this.hitOverlays=new HitOverlays(this);this.bombArt=new BombArt(this);
  this.backdrop=new ArcadeBackdrop(this);this.emplacements=new PelagicEmplacements(this);this.decor=this.add.graphics().setDepth(40);this.combatInk=this.add.graphics().setDepth(12);
   // Opaque, full-height illustrated cockpit art sits above every action sprite (depth <= 20).
   this.hudLeft=this.add.image(96,216,'arc-stage1-hud-left').setDisplaySize(192,432).setDepth(39).setVisible(false);
   this.hudRight=this.add.image(672,216,'arc-stage1-hud-right').setDisplaySize(192,432).setDepth(39).setVisible(false);
  this.player=this.add.sprite(384,350,'arc-rivet',1).setDisplaySize(31,38).setDepth(18).setVisible(false);
  this.bossSprite=this.add.sprite(384,100,'arc-boss').setDepth(3).setVisible(false);
  this.hero=this.add.sprite(384,246,UI_TEX.rivetCruise,0).setDisplaySize(196,196).setDepth(2).play('ui-rivet-cruise');
  this.logo=this.add.sprite(384,104,UI_TEX.logo).setDisplaySize(368,200).setDepth(5);
  for(let i=0;i<5;i++)this.lifeIcons.push(this.add.image(447+i*17,19,'arc-rivet',1).setDisplaySize(15,19).setDepth(46).setVisible(false));
  for(let i=0;i<3;i++)this.wingmen.push(this.add.sprite(-100,100,UI_TEX.wingmenAnim,i*4).setDisplaySize(40,40).setDepth(1.6).play(`ui-wingman-${i}`));
  this.installIntroActors();
  this.ui=this.add.container(0,0).setDepth(60);
  this.hud=this.add.text(0,0,'',{fontFamily:FONT,fontSize:'11px',fontStyle:'bold',color:'#ffffff',stroke:'#153550',strokeThickness:3}).setResolution(2).setDepth(45);
  this.pelagicLevel=this.add.text(614,86,'',{fontFamily:FONT,fontSize:'11px',fontStyle:'bold',color:'#ffffff'}).setResolution(2).setOrigin(0,.5).setDepth(45).setVisible(false);
  this.radio=this.add.text(384,66,'',{fontFamily:FONT,fontSize:'12px',color:'#16385b',backgroundColor:'#fff7cb',padding:{x:8,y:5},wordWrap:{width:280},align:'center'}).setResolution(2).setOrigin(.5).setDepth(48).setVisible(false);
  for(let i=0;i<640;i++)this.bulletSprites.push(this.add.sprite(0,0,'arc-red').setVisible(false).setDepth(15));
  this.makeOrbTextures();this.installTouch();this.show('loading');
  const blur=()=>{this.touch={x:0,y:0,fire:false,special:false};this.touchStart=undefined;if(this.screen==='play')this.show('pause');};
  window.addEventListener('blur',blur);const visibility=()=>{if(document.hidden)blur();};document.addEventListener('visibilitychange',visibility);
  this.events.once('shutdown',()=>{this.audio.stop();globalAudio.stopCombatEffects();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);this.backdrop.destroy();});
 }
 private makeOrbTextures():void{
  for(const [i,color] of [0xff654c,0xffc53b,0xb764ff].entries()){
   const g=this.make.graphics({x:0,y:0});g.fillStyle(0x173452).fillCircle(16,16,14);g.fillStyle(0xffffff).fillCircle(16,16,12);g.fillStyle(color).fillCircle(16,16,10);g.fillStyle(0xfff4bd).fillCircle(13,12,4);g.generateTexture('arc-orb-'+i,32,32);g.destroy();
  }
 }
 private text(x:number,y:number,text:string,size=18,color='#f4faff',opts?:{stroke?:string;strokeThickness?:number;align?:string;wrap?:number;originX?:number;originY?:number}):Phaser.GameObjects.Text{
  const node=this.add.text(x,y,text,{
   fontFamily:FONT,fontSize:size+'px',fontStyle:'bold',color,
   stroke:opts?.stroke??'#061938',strokeThickness:opts?.strokeThickness??3,
   align:opts?.align??'center',wordWrap:{width:opts?.wrap??640},
  }).setResolution(2).setOrigin(opts?.originX??.5,opts?.originY??.5);
  this.ui.add(node);return node;
 }
 private button(
  x:number,y:number,label:string,action:()=>void,width=230,height=38,
  opts?:{fontSize?:number;extras?:Phaser.GameObjects.Text[];onLeft?:()=>void;onRight?:()=>void;noLabel?:boolean},
 ):MenuButton{
  const bg=makeButtonBg(this,x,y,width,height,this.ui);
  const node=this.text(x,y+1,opts?.noLabel?'':label,opts?.fontSize??14,UI.white,{stroke:'#061938',strokeThickness:3});
  const zone=this.add.zone(x,y,width,height).setInteractive({useHandCursor:true});this.ui.add(zone);
  const index=this.buttons.length;
  zone.on('pointerover',()=>{if(this.focus!==index){this.focus=index;this.focusButtons();}});
  zone.on('pointerdown',(p:Phaser.Input.Pointer)=>{
   this.audio.unlock();this.focus=index;this.focusButtons();globalAudio.playArcade('confirm');
   const btn=this.buttons[index];
   if(btn?.onLeft&&btn?.onRight){
    const q=this.cameras.main.getWorldPoint(p.x,p.y);
    if(q.x<x-width*.12)btn.onLeft();else if(q.x>x+width*.12)btn.onRight();else btn.action();
    return;
   }
   action();
  });
  const item:MenuButton={node,bg,extras:opts?.extras??[],action,onLeft:opts?.onLeft,onRight:opts?.onRight};
  this.buttons.push(item);return item;
 }
 private focusButtons():void{
  this.buttons.forEach((b,i)=>{
   const on=i===this.focus;
   b.bg.setFocused(on);
   b.node.setColor(on?'#081e40':UI.white).setStroke(on?'#fff4ad':'#061938',on?2:3).setScale(on?1.03:1);
   b.extras.forEach(t=>t.setColor(on?'#081e40':UI.cyanHex).setStroke(on?'#fff4ad':'#061938',on?2:3));
  });
 }
 private addModalBackdrop(tint=0x031129,alpha=.52,withScanline=true):void{
  this.ui.add(this.add.rectangle(384,216,768,432,tint,alpha));
  if(withScanline&&this.quality>=1){
   this.ui.add(this.add.tileSprite(384,216,768,432,UI_TEX.scanline).setAlpha(.28));
  }
 }
 private addConfetti():void{
  if(this.quality<1)return;
  this.ui.add(this.add.particles(384,-10,UI_TEX.confetti,{
   x:{min:-340,max:340},speedY:{min:55,max:115},speedX:{min:-28,max:28},
   rotate:{min:0,max:360},scale:{start:.85,end:.4},alpha:{start:.9,end:.2},
   lifespan:4400,frequency:110,quantity:1,tint:[UI.gold,UI.cyan,UI.crimson,0xffffff],
  }));
 }
 show(screen:Screen):void{
  const old=this.screen;this.screen=screen;
  if(screen!=='loading')this.destroyLoadOverlay();
  if(old!==screen&&!['loading','intro','play'].includes(screen)&&old!=='loading'&&old!=='intro')globalAudio.playArcade('navigate');
  this.tweens.killAll();this.ui.removeAll(true);this.buttons=[];this.focus=0;this.hideIntroActors();
  if(screen==='result'||screen==='defeat'){this.messageUntil=0;this.radio.setVisible(false);}
  const game=['play','pause','controls','settings','confirm-exit','result','defeat'].includes(screen)&&!!this.world;
  const stage1Hud=game&&!!this.world?.up;
  this.hudLeft.setVisible(stage1Hud);this.hudRight.setVisible(stage1Hud);this.pelagicLevel.setVisible(stage1Hud);
  const showMenuHero=!game&&['intro','title'].includes(screen);
  this.hero.setVisible(showMenuHero);
  this.logo.setVisible(showMenuHero);
  this.wingmen.forEach(s=>s.setVisible(false));
  if(screen==='pause'){this.audio.pause();this.pauseOrigin='pause';}
  if(screen==='play'&&old!=='play')this.audio.resume();

  if(screen==='intro'){
   this.introClock=0;
   this.audio.play('intro');
  }else if(screen==='title'){
   this.audio.play('menu');
   this.button(384,328,'INICIAR JORNADA',()=>this.show('pilot'),276,42,{fontSize:15});
   this.button(285,377,'CONTROLES',()=>{this.pauseOrigin='title';this.show('controls');},184,34,{fontSize:13});
   this.button(483,377,'OPÇÕES',()=>{this.pauseOrigin='title';this.show('settings');},184,34,{fontSize:13});
  }else if(screen==='pilot'){
   this.audio.play('select');this.addModalBackdrop(0x041530,.36,false);
   makeRibbon(this,384,28,332,38,'gold',this.ui);
   this.text(384,28,'ESCOLHA SEU PILOTO',17,UI.cobaltHex,{stroke:'#fff6b0',strokeThickness:2});
   makePanel(this,384,146,678,170,'cobalt',this.ui);
   makePanel(this,132,146,134,134,'gold',this.ui);
   this.ui.add(this.add.image(132,143,'arc-pilots',3).setDisplaySize(112,112));
   makeRibbon(this,132,206,112,24,'gold',this.ui);
   this.text(132,206,'BAYEK',12,UI.cobaltHex,{stroke:'#fff6b0',strokeThickness:1});
   const plane=this.add.sprite(306,123,UI_TEX.rivetCruise,0).setDisplaySize(96,96).setAngle(-5).play('ui-rivet-cruise');
   this.ui.add(plane);
   this.tweens.add({targets:plane,y:'+=3',duration:1050,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
   this.text(306,172,'RIVET  •  VANGUARDA',12,UI.cyanHex);
   this.text(306,190,'Três motores. Um destino: trazer todos.',10,UI.silver);
   makeIcon(this,225,208,UI_ICON.lightning,16,this.ui);
   this.text(318,208,'ESPECIAL: TORMENTA ESCARLATE',9.5,UI.goldHex);
   const stats:[string,number,number,number][]=[['VELOCIDADE',4,UI_PIP.cyan,98],['ARMAMENTO',5,UI_PIP.gold,142],['BLINDAGEM',3,UI_PIP.green,186]];
   for(const [lbl,val,pip,sy] of stats){
    this.text(558,sy-16,lbl,9.5,UI.silver);
    makeGaugeMeter(this,558,sy+3,164,22,5,val,pip,this.ui);
   }
   const portraits=[0,4,5,6,7],names=['BAYEK','TITA','LEONA','OSVALD','HIEN'];
   for(let i=0;i<5;i++){
    const cx=112+i*136;
    makePanel(this,cx,288,124,98,i===0?'gold':'cobalt',this.ui);
    this.ui.add(this.add.image(cx,272,'arc-pilots',portraits[i]).setDisplaySize(50,50).setAlpha(i? .52:1));
    if(i)makeIcon(this,cx+40,254,UI_ICON.padlock,21,this.ui);
    this.text(cx,305,names[i],11,i?UI.silver:UI.goldHex);
    this.text(cx,318,i?'EM BREVE':'PRONTO',7.5,i?UI.slate:UI.cyanHex);
   }
   this.button(468,382,'DECOLAR COM BAYEK',()=>this.show('missions'),286,40,{fontSize:14});
   this.button(154,382,'VOLTAR',()=>this.show('title'),156,36,{fontSize:13});
  }else if(screen==='missions'){
   this.addModalBackdrop(0x041530,.36,false);
   makeRibbon(this,384,30,318,38,'gold',this.ui);
   this.text(384,30,'ESCOLHA A ROTA',18,UI.cobaltHex,{stroke:'#fff6b0',strokeThickness:2});
   this.text(384,60,'DUAS PERSPECTIVAS. UMA OPERAÇÃO DE RESGATE.',10.5,UI.white);
   const prog=this.arcadeProgress(),unlocked=prog.cleared.includes(1);
   for(let i=0;i<2;i++){
    const cx=i?562:206,m=MISSIONS[i],avail=i===0||unlocked,best=this.bestScoreFor(m.id);
    makePanel(this,cx,214,324,256,'cobalt',this.ui);
    makeRibbon(this,cx,94,160,26,avail?'gold':'red',this.ui);
    this.text(cx,94,`ROTA 0${i+1}`,12,avail?UI.cobaltHex:'#fff5f7',{stroke:avail?'#fff6b0':'#4b0816',strokeThickness:2});
    makePanel(this,cx-84,186,120,120,avail?'gold':'cobalt',this.ui);
    this.ui.add(this.add.image(cx-84,186,i?'arc-scenery':UI_TEX.routePelagic,i?5:undefined).setDisplaySize(104,104).setAlpha(avail?1:.45));
    if(!avail)makeIcon(this,cx-84,186,UI_ICON.padlock,44,this.ui);
    this.text(cx+62,146,m.name,15,avail?UI.goldHex:UI.silver,{wrap:162});
    this.text(cx+62,174,i?'SIDE • CIDADE SOLAR':'UP • FENDA PELÁGICA',9.5,UI.cyanHex,{wrap:160});
    this.text(cx+62,202,avail?`RECORDE\n${best}`:'CONCLUA A\nROTA 01 ANTES',10,avail?UI.white:UI.crimsonHex,{wrap:156});
    this.button(cx,304,avail?'INICIAR MISSÃO':'BLOQUEADA',()=>{if(!avail)return;const carry=i?prog.flights[1]:undefined;this.begin(i,carry);},264,38,{fontSize:13});
   }
   this.button(110,400,'VOLTAR',()=>this.show('pilot'),156,34,{fontSize:13});
  }else if(screen==='play'){
   if(this.world?.up){
    this.radio.setStyle({fontFamily:FONT,fontSize:'10px',color:'#f2fff9',backgroundColor:'rgba(0,0,0,0)',padding:{x:0,y:0},wordWrap:{width:105},align:'left'});
    this.radio.setOrigin(0,0);
   }else{
    this.radio.setStyle({fontFamily:FONT,fontSize:'12px',color:'#16385b',backgroundColor:'#fff7cb',padding:{x:8,y:5},wordWrap:{width:280},align:'center'});
    this.radio.setOrigin(.5);
   }
   const pause=this.text(739,19,'Ⅱ',16,'#fff2a1');pause.setInteractive();pause.on('pointerdown',()=>this.show('pause'));
   if(!this.world?.up&&this.world?.state==='intro'){
    const portrait=this.add.image(144,207,'arc-pilots',0).setDisplaySize(110,110);this.ui.add(portrait);this.time.delayedCall(2300,()=>portrait.destroy());
   }
  }else if(screen==='pause'){
   this.addModalBackdrop(0x031129,.60,true);
   makePanel(this,384,224,380,326,'cobalt',this.ui);
   makeRibbon(this,384,64,228,38,'gold',this.ui);
   this.text(384,64,'PAUSA',18,UI.cobaltHex,{stroke:'#fff6b0',strokeThickness:2});
   const w=this.world;
   if(w){
    makeGaugeMeter(this,384,110,322,26,0,0,UI_PIP.cyan,this.ui);
    this.text(384,110,`ROTA 0${this.currentMission+1}  •  ${w.score} PTS  •  NV ${w.weapons.weaponLevel}`,10.5,UI.cyanHex);
   }
   this.button(384,162,'CONTINUAR',()=>this.show('play'),266,38);
   this.button(384,209,'CONTROLES',()=>this.show('controls'),266,38);
   this.button(384,256,'OPÇÕES',()=>{this.pauseOrigin='pause';this.show('settings');},266,38);
   this.button(384,303,'SAIR DA MISSÃO',()=>this.show('confirm-exit'),266,38);
   this.text(384,358,'ESC: RETOMAR VOO',9.5,UI.slate);
  }else if(screen==='controls'){
   this.addModalBackdrop(0x031129,.60,true);
   const pad=connectedPad(),labels=padLabels(pad?.id);
   makePanel(this,384,220,618,346,'cobalt',this.ui);
   makeRibbon(this,384,50,296,38,'gold',this.ui);
   this.text(384,50,pad?'CONTROLE CONECTADO':'CONTROLES',16,UI.cobaltHex,{stroke:'#fff6b0',strokeThickness:2});
   makePanel(this,186,184,180,192,'cobalt',this.ui);
   makeIcon(this,186,156,UI_ICON.gamepad,110,this.ui);
   this.text(186,232,pad?pad.id.slice(0,18).toUpperCase():'TECLADO + GAMEPAD',9.5,UI.cyanHex,{wrap:158});
   this.text(186,252,pad?'ENTRADA ATIVA':'PLUG & PLAY',8.5,UI.goldHex);
   makeKeyBadge(this,322,114,'W',{size:26,fontSize:11,container:this.ui});
   makeKeyBadge(this,350,114,'A',{size:26,fontSize:11,container:this.ui});
   makeKeyBadge(this,378,114,'S',{size:26,fontSize:11,container:this.ui});
   makeKeyBadge(this,406,114,'D',{size:26,fontSize:11,container:this.ui});
   this.text(438,114,pad?'ANALÓGICO / D-PAD • MOVER':'SETAS OU WASD • MOVER NAVE',11.5,UI.white,{originX:0});
   makeKeyBadge(this,364,166,pad?labels.shoot:'ESPAÇO',{wide:true,size:28,fontSize:9.5,container:this.ui});
   this.text(438,166,'RAJADA DE 3 TIROS',12,UI.goldHex,{originX:0});
   makeKeyBadge(this,364,218,pad?labels.special:'X',{gold:true,size:30,fontSize:12,container:this.ui});
   this.text(438,218,'TORMENTA ESCARLATE',12,UI.cyanHex,{originX:0});
   makeKeyBadge(this,364,270,pad?labels.pause:'ESC',{size:36,fontSize:9.5,container:this.ui});
   this.text(438,270,'PAUSAR / VOLTAR',12,UI.white,{originX:0});
   this.text(476,312,'Segure o disparo para rajada contínua • Ajuste acessível nas opções.',9.5,UI.silver);
   this.button(384,356,'VOLTAR',()=>this.show(this.world?'pause':this.pauseOrigin),214,38);
  }else if(screen==='settings'){
   this.addModalBackdrop(0x031129,.60,true);
   makePanel(this,384,220,620,354,'cobalt',this.ui);
   makeRibbon(this,384,46,232,38,'gold',this.ui);
   this.text(384,46,'OPÇÕES',18,UI.cobaltHex,{stroke:'#fff6b0',strokeThickness:2});
   const addVolumeRow=(y:number,iconFrame:number,label:string,isMusic:boolean)=>{
    const get=()=>isMusic?globalSave.getSettings().musicVolume:globalSave.getSettings().sfxVolume;
    let meter!:ReturnType<typeof makeGaugeMeter>,valText!:Phaser.GameObjects.Text;
    const apply=(next:number)=>{
     const clamped=clamp(Math.round(next*10)/10,0,1);
     globalSave.updateSettings(isMusic?{musicVolume:clamped}:{sfxVolume:clamped});
     const cur=globalSave.getSettings();
     this.audio.setMix(cur.musicVolume,cur.sfxVolume,this.mute);
     const steps=Math.round(clamped*10);
     meter?.setValue(steps);valText?.setText(`${steps*10}%`);
    };
    const btn=this.button(384,y,'',()=>apply(get()>=.99?0:get()+.1),554,38,{
     noLabel:true,
     onLeft:()=>{globalAudio.playArcade('navigate');apply(get()-.1);},
     onRight:()=>{globalAudio.playArcade('navigate');apply(get()+.1);},
    });
    makeIcon(this,136,y,iconFrame,24,this.ui);
    const title=this.text(168,y,label,12,UI.white,{originX:0});
    meter=makeGaugeMeter(this,462,y,192,24,10,Math.round(get()*10),isMusic?UI_PIP.cyan:UI_PIP.gold,this.ui);
    const initSteps=Math.round(get()*10);
    valText=this.text(596,y,`${initSteps*10}%`,12,UI.cyanHex);
    btn.extras=[title,valText];
   };
   const addToggleRow=(y:number,iconFrame:number,label:string,pipCount:number,pipFrame:number,readState:()=>{text:string;filled:number},stepState:(dir:number)=>void)=>{
    const st0=readState();
    let meter!:ReturnType<typeof makeGaugeMeter>,valText!:Phaser.GameObjects.Text;
    const update=(dir:number)=>{stepState(dir);const st=readState();meter.setValue(st.filled);valText.setText(st.text);};
    const btn=this.button(384,y,'',()=>update(1),554,38,{noLabel:true,onLeft:()=>update(-1),onRight:()=>update(1)});
    makeIcon(this,136,y,iconFrame,24,this.ui);
    const title=this.text(168,y,label,12,UI.white,{originX:0});
    meter=makeGaugeMeter(this,442,y,118,22,pipCount,st0.filled,pipFrame,this.ui);
    valText=this.text(584,y,st0.text,11.5,UI.goldHex);
    btn.extras=[title,valText];
   };
   addVolumeRow(104,UI_ICON.music,'MÚSICA',true);
   addVolumeRow(150,UI_ICON.speaker,'EFEITOS',false);
   addToggleRow(196,UI_ICON.lightning,'DISPARO ACESSÍVEL',2,UI_PIP.green,()=>{
    const on=globalSave.getSettings().rapidFire;return{text:on?'ATIVADO':'DESATIVADO',filled:on?2:0};
   },()=>{const next=!globalSave.getSettings().rapidFire;globalSave.updateSettings({rapidFire:next});if(this.world)this.world.accessibility=next;});
   addToggleRow(242,UI_ICON.crown,'DIFICULDADE',2,UI_PIP.gold,()=>{
    const hard=globalSave.getSettings().difficulty!=='normal';return{text:hard?'DIFÍCIL':'NORMAL',filled:hard?2:1};
   },()=>{const next=globalSave.getSettings().difficulty==='normal'?'hard':'normal';globalSave.updateSettings({difficulty:next});if(this.world)this.world.hard=next!=='normal';});
   addToggleRow(288,UI_ICON.radar,'QUALIDADE VISUAL',3,UI_PIP.cyan,()=>{
    return{text:['BAIXA','MÉDIA','ALTA'][this.quality],filled:this.quality+1};
   },(dir)=>{this.quality=(this.quality+(dir<0?2:1))%3;try{localStorage.setItem('bullet_wake_visual',String(this.quality));}catch{/* Optional */} });
   this.button(384,352,'VOLTAR',()=>this.show(this.pauseOrigin),214,38);
  }else if(screen==='confirm-exit'){
   this.addModalBackdrop(0x031129,.64,true);
   makePanel(this,384,218,434,256,'gold',this.ui);
   makeRibbon(this,384,92,268,38,'red',this.ui);
   this.text(384,92,'SAIR DA MISSÃO?',17,'#fff5f7',{stroke:'#4b0816',strokeThickness:2});
   const warn=makeIcon(this,204,174,UI_ICON.warning,56,this.ui);
   this.tweens.add({targets:warn,scaleX:'*=1.08',scaleY:'*=1.08',duration:620,yoyo:true,repeat:-1});
   this.text(406,174,'O progresso da fase atual\nserá perdido ao voltar.',12,UI.white,{wrap:270});
   this.button(384,248,'CANCELAR',()=>this.show('pause'),272,40);
   this.button(384,298,'CONFIRMAR SAÍDA',()=>{this.disposeWorld();this.show('title');},272,40);
  }else if(screen==='result'){
   this.audio.play('results');this.addModalBackdrop(0x031129,.58,true);this.addConfetti();
   const w=this.world!;
   makePanel(this,384,216,628,344,'cobalt',this.ui);
   makeRibbon(this,384,46,328,40,'gold',this.ui);
   this.text(384,46,'MISSÃO CONCLUÍDA!',18,UI.cobaltHex,{stroke:'#fff6b0',strokeThickness:2});
   makePanel(this,180,170,152,152,'gold',this.ui);
   this.ui.add(this.add.image(180,169,'arc-pilots',1).setDisplaySize(128,128));
   const crown=makeIcon(this,144,264,UI_ICON.crown,24,this.ui);
   this.tweens.add({targets:crown,angle:{from:-4,to:4},duration:900,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
   const rank=w.deaths===0&&w.score>=18000?'S':w.score>=10000?'A':w.score>=5000?'B':'C';
   this.text(192,264,`RANK ${rank}`,14,UI.goldHex);
   this.text(468,100,MISSIONS[this.currentMission].name,17,UI.cyanHex);
   makePanel(this,468,148,348,50,'cobalt',this.ui);
   this.text(362,148,'PONTUAÇÃO',10.5,UI.silver);
   const scoreTxt=this.text(506,148,String(w.score),20,UI.goldHex);
   makeIcon(this,616,148,UI_ICON.coin0,28,this.ui).play('ui-coin-spin');
   this.tweens.addCounter({from:Math.round(w.score*.65),to:w.score,duration:300,onUpdate:tw=>{scoreTxt.setText(String(Math.round(tw.getValue()??w.score)));}});
   const secs=Math.floor(w.elapsed);
   this.text(468,198,`TEMPO ${Math.floor(secs/60)}:${String(secs%60).padStart(2,'0')}  •  ${w.kills} ALVOS  •  ${w.collected} ITENS`,12,UI.white);
   makeIcon(this,316,238,UI_ICON.lightning,20,this.ui);
   this.text(476,238,'Potência, vidas e especiais seguem com você.',11,UI.goldHex);
   this.button(384,312,this.currentMission===0?'PRÓXIMA: CIDADE SOLAR':'VER ENCERRAMENTO',()=>{if(this.currentMission===0)this.begin(1,this.carried);else this.show('ending');},346,40);
   this.button(384,358,'MENU',()=>{this.disposeWorld();this.show('title');},184,34);
  }else if(screen==='defeat'){
   this.audio.play('defeat');this.addModalBackdrop(0x260812,.64,true);
   const w=this.world!;
   makePanel(this,384,218,480,342,'gold',this.ui);
   makeRibbon(this,384,50,340,40,'red',this.ui);
   this.text(384,50,'ATERRISSAGEM… CRIATIVA!',17,'#fff5f7',{stroke:'#4b0816',strokeThickness:2});
   makePanel(this,384,146,134,134,'cobalt',this.ui);
   this.ui.add(this.add.image(384,145,'arc-pilots',2).setDisplaySize(112,112));
   this.text(384,236,'Bayek: "O importante é ter estilo na próxima!"',12,UI.goldHex);
   if(w)this.text(384,259,`PONTOS ${w.score}  •  PROGRESSO ${Math.min(100,Math.round(w.route/3))}%`,10.5,UI.silver);
   this.button(384,306,'TENTAR NOVAMENTE',()=>this.begin(this.currentMission),280,40);
   this.button(384,354,'MENU',()=>{this.disposeWorld();this.show('title');},184,36);
  }else if(screen==='ending'){
   this.disposeWorld();this.audio.play('victory');this.addModalBackdrop(0x041530,.32,false);this.addConfetti();
   makeRibbon(this,384,40,326,42,'gold',this.ui);
   this.text(384,40,'DO MAR AO CÉU!',19,UI.cobaltHex,{stroke:'#fff6b0',strokeThickness:2});
   makePanel(this,384,198,600,220,'cobalt',this.ui);
   makePanel(this,194,198,162,162,'gold',this.ui);
   this.ui.add(this.add.image(194,196,'arc-pilots',1).setDisplaySize(138,138));
   this.text(468,142,'OPERAÇÃO CONCLUÍDA COM SUCESSO',11.5,UI.cyanHex);
   this.text(468,186,'Bayek abriu caminho para a equipe de resgate.\nDuas missões concluídas. O próximo recorde é seu!',12,UI.white,{wrap:310});
   const best=this.bestScoreFor();
   makePanel(this,468,252,292,42,'gold',this.ui);
   makeIcon(this,348,252,UI_ICON.crown,24,this.ui);
   this.text(468,252,`RECORDE  ${best}`,14,UI.goldHex);
   makeIcon(this,588,252,UI_ICON.coin0,24,this.ui).play('ui-coin-spin');
   this.button(384,366,'VOAR DE NOVO',()=>this.show('pilot'),278,42);
  }
  this.focusButtons();this.setTouchVisible(screen==='play');
 }
 begin(index:number,carry?:CampaignFlight):void{
  if(index===0)this.messageUntil=0;
  this.disposeWorld();this.currentMission=index;this.stageClearSaved=false;this.world=new ArcadeWorld(MISSIONS[index],carry);this.world.accessibility=globalSave.getSettings().rapidFire;this.world.hard=globalSave.getSettings().difficulty!=='normal';this.accumulator=0;
  this.world.bossContact=(_boss,ax,ay,bx,by,radius)=>spriteContact(this.bossSprite,ax,ay,bx,by,radius);
  this.world.contact=(e,ax,ay,bx,by,radius)=>{const sprite=this.enemySprites.get(e.id),turret=this.turrets.get(e.id);const hits=[sprite?spriteContact(sprite,ax,ay,bx,by,radius):null,turret?spriteContact(turret,ax,ay,bx,by,radius):null].filter((v):v is number=>v!==null);return hits.length?Math.min(...hits):null;};
  this.player.setVisible(true);this.audio.play(index?'stage2':'stage1');this.show('play');
 }
 private disposeWorld():void{
  this.emplacements?.clear();this.hitOverlays?.clear();this.bombArt?.draw();
  this.world=undefined;this.player?.setVisible(false);this.bossSprite?.setVisible(false);this.lifeIcons.forEach(s=>s.setVisible(false));this.hud?.setText('');this.radio?.setVisible(false);this.combatInk?.clear();this.decor?.clear();this.lastHud='';
  for(const map of [this.enemySprites,this.partSprites,this.turrets]){for(const s of map.values())s.destroy();map.clear();}for(const s of this.cargoSprites.values())s.destroy();this.cargoSprites.clear();for(const s of this.bulletSprites)s.setVisible(false);for(const e of this.effects){e.sprite.setVisible(false);this.effectPool.push(e.sprite);}this.effects=[];globalAudio.stopCombatEffects();
 }
 update(_time:number,delta:number):void{
  const dt=Math.min(delta/1000,.05);this.clock+=dt;const gp=this.pad.sample(connectedPad());const just=(k:string)=>Phaser.Input.Keyboard.JustDown(this.controls[k]);
  if(this.screen==='loading'){
   const elapsed=Math.max(0,(performance.now()-this.loadStartMs)/1000);
   const fillRatio=Math.min(this.loadRealProgress||1,clamp(elapsed/2.75,0,1));
   const smoothFade=elapsed>2.90?1-clamp((elapsed-2.90)/.32,0,1):1;
   this.syncLoadVisual(fillRatio,smoothFade);
   if(this.loadRealProgress>=1&&elapsed>=3.22){this.destroyLoadOverlay();this.show('intro');}
   return;
  }
  if(this.screen!=='play'){
   const active=this.buttons[this.focus];
   if(just('DOWN')||gp.down){this.focus=(this.focus+1)%Math.max(1,this.buttons.length);this.focusButtons();globalAudio.playArcade('navigate');}
   if(just('UP')||gp.up){this.focus=(this.focus+this.buttons.length-1)%Math.max(1,this.buttons.length);this.focusButtons();globalAudio.playArcade('navigate');}
   if(just('RIGHT')||gp.right){if(active?.onRight)active.onRight();else{this.focus=(this.focus+1)%Math.max(1,this.buttons.length);this.focusButtons();globalAudio.playArcade('navigate');}}
   if(just('LEFT')||gp.left){if(active?.onLeft)active.onLeft();else{this.focus=(this.focus+this.buttons.length-1)%Math.max(1,this.buttons.length);this.focusButtons();globalAudio.playArcade('navigate');}}
   const confirm=just('ENTER')||just('SPACE')||gp.confirm;
   if(this.screen==='intro'){this.introClock+=dt;if(this.introClock>=4.45)this.show('title');}
   else if(confirm){this.audio.unlock();globalAudio.playArcade('confirm');this.buttons[this.focus]?.action();}
   else if(just('ESC')||gp.back||gp.menuOrBack){if(this.screen==='pause')this.show('play');else if(this.screen==='confirm-exit')this.show('pause');else if(this.screen==='controls')this.show(this.world?'pause':this.pauseOrigin);else if(this.screen==='settings')this.show(this.pauseOrigin);else if(this.screen==='missions')this.show('pilot');else if(this.screen==='pilot')this.show('title');}
  }else if(just('ESC')||gp.menuOrBack)this.show('pause');
  if(this.world&&this.screen==='play'){
   if(just('ENTER')||gp.confirm)this.world.introTime=0;
   const held=(k:string)=>this.controls[k].isDown;
   const input:Controls={x:Number(held('D')||held('RIGHT'))-Number(held('A')||held('LEFT'))+gp.moveX+this.touch.x,y:Number(held('S')||held('DOWN'))-Number(held('W')||held('UP'))+gp.moveY+this.touch.y,fire:held('SPACE')||gp.firePrimary||this.touch.fire,special:held('X')||gp.special||this.touch.special};
   this.accumulator+=dt;while(this.accumulator>=1/120){this.world.step(1/120,input);this.accumulator-=1/120;}this.consumeEvents();
   if(this.world.state==='victory'){this.saveClear();this.show('result');}else if(this.world.state==='defeat')this.show('defeat');
  }
  const animated=this.world&&this.screen!=='play'?this.world.elapsed:this.clock;
  this.backdrop.draw(animated,this.world,this.quality);
  if(this.world)this.renderWorld(this.screen==='play'?dt:0);else this.renderMenu();
 }
 private installIntroActors():void{
  this.introWash=this.add.rectangle(384,216,768,432,0x020611,1).setDepth(30).setVisible(false);
  this.introHalo=this.add.sprite(384,186,UI_TEX.glow).setDisplaySize(290,290).setTint(0x2d8cff).setBlendMode(Phaser.BlendModes.ADD).setDepth(30.5).setVisible(false);
  this.introCrest=this.add.sprite(384,174,UI_TEX.icons,UI_ICON.botan).setDepth(31).setVisible(false);
  this.introTitle=this.add.text(384,248,'BOTAN STUDIO',{fontFamily:FONT,fontSize:'23px',fontStyle:'bold',color:UI.goldHex,stroke:'#040e24',strokeThickness:4}).setResolution(2).setOrigin(.5).setDepth(31).setVisible(false);
  this.introSub=this.add.text(384,282,'A P R E S E N T A',{fontFamily:FONT,fontSize:'11px',fontStyle:'bold',color:UI.cyanHex,stroke:'#040e24',strokeThickness:3}).setResolution(2).setOrigin(.5).setDepth(31).setVisible(false);
 }
 private hideIntroActors():void{
  for(const n of [this.introWash,this.introHalo,this.introCrest,this.introTitle,this.introSub])n.setVisible(false);
 }
 private placeHero(x:number,y:number,size:number,angleDeg:number):void{
  if(this.hero.anims.currentAnim?.key!=='ui-rivet-cruise')this.hero.play('ui-rivet-cruise');
  this.hero.setPosition(x,y).setDisplaySize(size,size).setAngle(angleDeg).setVisible(true);
 }
 private renderMenu():void{
  this.decor.clear();this.hud.setText('');this.combatInk.clear();const time=this.clock;
  if(this.screen==='intro'){this.renderIntro();return;}
  if(this.screen==='title'){
   const hx=384+Math.sin(time*.65)*10,hy=242+Math.sin(time*1.2)*3.5,ang=-3+Math.sin(time*.5)*1.2;
   this.placeHero(hx,hy,196,ang);
   this.hero.setAlpha(1);
   this.logo.setPosition(384,104).setDisplaySize(368,200).setAlpha(1).setVisible(true);
   this.wingmen.forEach((s,i)=>{
    if(i>=2){s.setVisible(false);return;}
    const anim=`ui-wingman-${i}`;if(s.anims.currentAnim?.key!==anim)s.play(anim);
    const speed=i===0?54:74,phase=i===0?160:520;
    const wx=840-((time*speed+phase)%980);
    const wy=(i===0?148:178)+Math.sin(time*(1.3+i*.25))*2.5;
    const fade=Math.max(0,Math.min(1,(wx-12)/70,(756-wx)/70));
    s.setPosition(wx,wy).setDisplaySize(32,32).setAlpha(.78*fade).setVisible(fade>.01);
   });
  }else{
   this.wingmen.forEach(s=>s.setVisible(false));
  }
 }
 private renderIntro():void{
  const t=this.introClock;
  this.hideIntroActors();
  // Studio splash hold (0 .. 3.55s): Obsidian curtain + BOTAN STUDIO + APRESENTA
  const inP=clamp(t/.55,0,1);
  const crestOut=1-clamp((t-3.45)/.45,0,1);
  const crestAlpha=inP*crestOut;
  const sc=.88+.12*(1-(1-inP)**3);
  // Smooth dissolve transition (3.60s .. 4.45s) directly into sunlit 2.5D ocean & title composition
  const veilP=clamp((t-3.60)/.85,0,1);
  const veilSmooth=veilP*veilP*(3-2*veilP);
  const curtainAlpha=1-veilSmooth;
  if(curtainAlpha>.005){
   this.introWash.setAlpha(curtainAlpha).setVisible(true);
  }
  if(crestAlpha>.01){
   this.introHalo.setAlpha((.22+.06*Math.sin(t*2.1))*crestAlpha).setVisible(true);
   this.introCrest.setPosition(384,174).setDisplaySize(98*sc,98*sc).setAlpha(crestAlpha).setVisible(true);
   this.introTitle.setAlpha(crestAlpha).setVisible(true);
   this.introSub.setAlpha(clamp((t-.2)/.4,0,1)*crestOut).setVisible(true);
  }
  if(veilP<=0){
   this.hero.setVisible(false);this.logo.setVisible(false);this.wingmen.forEach(s=>s.setVisible(false));
   return;
  }
  const time=this.clock;
  const hx=344+veilSmooth*40+Math.sin(time*.65)*10;
  const hy=246-veilSmooth*4+Math.sin(time*1.2)*3.5;
  const ang=-5+veilSmooth*2+Math.sin(time*.5)*1.2;
  this.placeHero(hx,hy,196,ang);
  this.hero.setAlpha(veilSmooth);
  this.logo.setPosition(384,104).setDisplaySize(368,200).setAlpha(veilSmooth).setVisible(true);
  this.wingmen.forEach((s,i)=>{
   if(i>=2){s.setVisible(false);return;}
   const anim=`ui-wingman-${i}`;if(s.anims.currentAnim?.key!==anim)s.play(anim);
   const speed=i===0?54:74,phase=i===0?160:520;
   const wx=840-((time*speed+phase)%980);
   const wy=(i===0?148:178)+Math.sin(time*(1.3+i*.25))*2.5;
   const fade=Math.max(0,Math.min(1,(wx-12)/70,(756-wx)/70));
   s.setPosition(wx,wy).setDisplaySize(32,32).setAlpha(.78*fade*veilSmooth).setVisible(fade>.01);
  });
 }
 private renderWorld(dt:number):void{
  const w=this.world!,time=w.elapsed,g=this.combatInk;g.clear();this.hitOverlays.begin();
  this.player.setPosition(w.player.x,w.player.y).setFrame(w.up?(w.player.bank<-.3?0:w.player.bank>.3?2:Math.floor(time*9)%2?1:3):(w.player.bank<-.3?6:w.player.bank>.3?5:Math.floor(time*9)%2?4:7)).setDisplaySize(w.up?31:42,w.up?38:34).setAlpha(1).setVisible(w.state!=='defeat');
  // Temporary invulnerability remains readable without making the ship translucent.
  if(w.player.invulnerable>0)this.player.setAlpha(.72+.28*Math.cos(time*18)**2);
  const alive=new Set<number>();
  this.emplacements.draw(w,this.quality);
  for(const e of w.enemies){if(e.hp<=0)continue;alive.add(e.id);let s=this.enemySprites.get(e.id);if(!s){s=this.add.sprite(e.x,e.y,'arc-enemies').setDepth(e.ground?2:8);this.enemySprites.set(e.id,s);}const enemyFrame=e.family==='alien'?(w.up?0:2)+Math.floor(time*5)%2:e.family==='airship'?12:(w.up&&e.family==='tank'?7:FAMILY_ORDER.indexOf(e.family))+(w.up?0:8);s.setPosition(e.x,e.y).setTexture(e.family==='alien'?'arc-ufo':'arc-enemies',enemyFrame).setDisplaySize(e.size,e.size).setRotation(w.up&&!e.ground&&e.family!=='alien'?Math.PI:0);
   if(w.up&&e.navigation?.anchor!==undefined)s.setTexture(e.family==='tower'?TOWER_TEXTURE:EMPLACEMENT_TEXTURE,0).setOrigin(.5,e.family==='tower'?.78:.5).setDisplaySize(e.size*(e.family==='tower'?1.8:1.3),e.size*(e.family==='tower'?1.8:1.3));
   s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY).setAlpha(1);
   if(w.up&&(e.family==='boat'||e.family==='ship')){
    const hullFrame=Math.floor(time*8+e.id*1.7)%6;
    s.setTexture('arc-wet-hull-'+(e.family==='boat'?4:5),hullFrame);
   }
   if(e.submarine)s.setTexture(SUB_ART,e.submarine.phase==='hold'?1:0).setOrigin(.5,.57).setDisplaySize(e.size*1.06,e.size*1.06).setRotation(0).setFlipX(e.submarine.side>0).setAlpha(e.submarine.exposure).setDepth(2);
   if(e.ground&&!(w.up&&e.family==='tower')&&!e.submarine){let turret=this.turrets.get(e.id);if(!turret){turret=this.add.sprite(e.x,e.y,'arc-boss',w.up?3:6).setDepth(5).setOrigin(.5,w.up?.4:.5);this.turrets.set(e.id,turret);}const mount=w.up?surfaceMount(e):{x:e.x,y:e.y-e.size*.09};const tSize=w.up&&e.navigation?.anchor===undefined?e.size*.28:e.size*.56;turret.setPosition(mount.x,mount.y).setDisplaySize(tSize,tSize).setRotation(Math.atan2(w.player.y-mount.y,w.player.x-mount.x)-(w.up?Math.PI/2:Math.PI));turret.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);this.hitOverlays.draw(turret,e.flash);
    if(w.up&&e.navigation?.anchor===undefined){
     const bob=Math.sin(time*2.8+e.id*1.9)*1.5,roll=Math.sin(time*2.3+e.id*1.3)*.055,swell=e.size*(1+Math.sin(time*2.8+e.id)*.024);
     const heading=e.navigation?.heading??Math.PI,angle=heading-Math.PI/2,fx=Math.cos(angle),fy=Math.sin(angle);
     s.setPosition(e.x,e.y+bob).setDisplaySize(swell,swell).setRotation(heading+roll);
     turret.setPosition(e.x-fx*e.size*.08,e.y+bob-fy*e.size*.08);
    }
   }

   if(!e.ground){g.lineStyle(1,0xb6ffff,.3).lineBetween(e.x+(w.up?0:13),e.y+(w.up?-15:0),e.x+(w.up?0:22+Math.sin(time*25)*2),e.y+(w.up?-25:0));if(['fighter','acrobat','bomber'].includes(e.family)){const nose=w.up?e.y+e.size*.33:e.x-e.size*.35;g.lineStyle(1.5,0xffe36a,.7);if(w.up)g.lineBetween(e.x-Math.cos(time*45+e.id)*e.size*.22,nose,e.x+Math.cos(time*45+e.id)*e.size*.22,nose);else g.lineBetween(nose,e.y-Math.cos(time*45+e.id)*e.size*.22,nose,e.y+Math.cos(time*45+e.id)*e.size*.22);}}
   this.hitOverlays.draw(s,e.flash);
  }for(const [id,s] of this.enemySprites)if(!alive.has(id)){s.destroy();this.enemySprites.delete(id);this.turrets.get(id)?.destroy();this.turrets.delete(id);}
  this.renderBoss(g);
  for(let i=0;i<w.bullets.length;i++){const b=w.bullets[i],s=this.bulletSprites[i];s.setVisible(b.active);if(!b.active)continue;
   if(b.enemy)s.setTexture('arc-orb-'+b.color).setDisplaySize(b.radius*2+3,b.radius*2+3).setRotation(0);
   else{const art=w.up?pelagicShotSize(w.weapons.weaponLevel):rivetShotPresentation(w.weapons.weaponLevel);s.setTexture(b.missile?'arc-missile':w.up?'pelagic-plasma':'arc-red',w.up&&!b.missile?undefined:Math.floor(b.age*20)%8).setDisplaySize(b.missile?17:art.width,b.missile?25:art.height).setRotation(Math.atan2(b.vy,b.vx)+Math.PI/2);}
   s.setPosition(b.x,b.y);
  }
  this.renderCargo();this.renderObstacles(g);
  this.bombArt.draw(w);
  for(const fx of this.effects){fx.age+=dt;fx.sprite.setPosition(fx.sprite.x+fx.vx*dt,fx.sprite.y+fx.vy*dt).setRotation(fx.sprite.rotation+fx.spin*dt).setAlpha(1-fx.age/fx.duration*.7);fx.sprite.setFrame(Math.min(15,Math.floor(fx.age/fx.duration*16)));}
  this.effects=this.effects.filter(f=>{if(f.age>=f.duration){f.sprite.setVisible(false);this.effectPool.push(f.sprite);return false;}return true;});
  this.renderHud();if(this.clock>this.messageUntil){if(w.up&&!['result','defeat'].includes(this.screen))this.radio.setOrigin(0,0).setPosition(646,299).setText('CANAL ABERTO\nAguardando contato…').setVisible(true);else this.radio.setVisible(false);}
 }
 private renderBoss(g:Phaser.GameObjects.Graphics):void{
  const w=this.world!,b=w.boss,live=new Set<number>();
  const bossAlive=!!b&&b.phase!=='absent'&&b.phase!=='sink';
  this.bossSprite.setVisible(bossAlive);
  if(bossAlive){
   const frame=w.up?(b.mini?2:b.configuration===1?0:1):(b.mini?5:4);
   const bob=w.up&&b.phase==='fight'?Math.sin(w.elapsed*2.4)*1.4:0;
   this.bossSprite.setTexture(w.up?'arc-wet-boss-'+frame:'arc-boss',w.up?0:frame).setPosition(b.x,b.y+bob).setDisplaySize(b.size,b.size).setAlpha(1).setAngle(0);
   this.hitOverlays.draw(this.bossSprite,b.flash??0);
   if(w.up){
    for(const sign of[-1,1]){
     const px=b.x+sign*b.size*.27,py=b.y+bob+b.size*.29;
     g.fillStyle(0xf2ffff,.52).fillEllipse(px,py+Math.sin(w.elapsed*5+sign)*1.2,7,3);
     g.fillStyle(0x9cf5ff,.38).fillEllipse(b.x+sign*b.size*.08,b.y+bob+b.size*.36,8,3.2);
    }
   }
   for(const p of b.parts){live.add(p.id);let s=this.partSprites.get(p.id);if(!s){s=this.add.sprite(p.x,p.y,'arc-boss',w.up?3:6).setDepth(7);this.partSprites.set(p.id,s);}s.setTexture(p.hp>0?'arc-boss':EMPLACEMENT_TEXTURE,p.hp>0?(w.up?3:6):1).setPosition(p.x,p.y+bob).setDisplaySize(p.radius*2.65,p.radius*2.65).setVisible(true).setRotation(p.hp>0?p.angle-(w.up?Math.PI/2:Math.PI):0);
    s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);this.hitOverlays.draw(s,p.flash);
    if(p.hp>0&&p.warning>0){g.fillStyle(0xffd77a,p.warning*.65);const a=p.angle;g.fillEllipse(p.x+Math.cos(a)*p.radius,p.y+bob+Math.sin(a)*p.radius,3+p.warning*3,3+p.warning*3);}
   }
   if(!w.up){for(const sign of[-1,1]){const px=b.x+b.size*.27,py=b.y+sign*b.size*.19;g.lineStyle(3,0xceffff,.75);g.lineBetween(px-Math.cos(w.elapsed*35)*13,py-Math.sin(w.elapsed*35)*13,px+Math.cos(w.elapsed*35)*13,py+Math.sin(w.elapsed*35)*13);}}
  }for(const[id,s]of this.partSprites)if(!live.has(id)){s.destroy();this.partSprites.delete(id);}
 }
 private renderCargo():void{
  const w=this.world!,ids=new Set<number>();
  for(const c of w.cargo){
   ids.add(c.id);let sprite=this.cargoSprites.get(c.id);
   if(!sprite){sprite=this.add.sprite(c.x,c.y,SUPPLY_ART,0).setDepth(13);this.cargoSprites.set(c.id,sprite);}
   const start=c.crate?0:c.kind==='power'?4:c.kind==='life'?8:12,frame=start+Math.floor(c.age*6)%4;
   sprite.setFrame(frame).setOrigin(.5,c.crate?.81:.5).setPosition(c.x,c.y).setDisplaySize(c.crate?58:28,c.crate?58:28).setAngle(Math.sin(c.age*2)*2);
  }
  for(const[id,sprite]of this.cargoSprites)if(!ids.has(id)){sprite.destroy();this.cargoSprites.delete(id);}
 }
 private renderObstacles(g:Phaser.GameObjects.Graphics):void{
  for(const o of this.world!.obstacles){g.fillStyle(o.kind==='barrier'?0xffbf59:0x3f7e9c).fillRoundedRect(o.x-o.width/2,o.y-o.height/2,o.width,o.height,4);g.lineStyle(3,0xffec76).strokeRoundedRect(o.x-o.width/2,o.y-o.height/2,o.width,o.height,4);
   if(o.kind==='barrier'){g.lineStyle(2,0xfff5c5).lineBetween(o.x-9,o.y-19,o.x+8,o.y+18);g.lineBetween(o.x+8,o.y-19,o.x-9,o.y+18);}
   else{g.fillStyle(0xa4f0e7,.8);for(let yy=o.y-o.height/2+14;yy<o.y+o.height/2-8;yy+=22)for(let xx=o.x-o.width/2+21;xx<o.x+o.width/2-15;xx+=17)g.fillRoundedRect(xx,yy,10,12,2);g.lineStyle(2,0x214c72).lineBetween(o.x,o.y-o.height/2+6,o.x,o.y+o.height/2-6);}
   for(let y=o.y-o.height/2+5;y<o.y+o.height/2;y+=13){g.lineStyle(4,0x214c72).lineBetween(o.x-o.width/2+2,y,o.x-o.width/2+12,y+8);g.lineBetween(o.x+o.width/2-12,y,o.x+o.width/2-2,y+8);}
   if(o.warning>0||o.x>735){g.fillStyle(0xff6857,.85).fillTriangle(731,o.y-8,731,o.y+8,718,o.y);}
  }
 }
 private renderHud():void{
  const w=this.world!,g=this.decor;g.clear();
  if(w.up){
   // The two approved illustrated cockpit panels frame the 384px gameplay lane.
   g.lineStyle(3,0x17d7ff,.95).lineBetween(192,0,192,432);
   g.lineBetween(576,0,576,432);
   g.lineStyle(1,0xd8ffff,.82).lineBetween(193,0,193,432);
   g.lineBetween(575,0,575,432);
   const line=String(w.score);
   if(line!==this.lastHud){
    this.hud.setFontSize(17).setColor('#ffe654').setStroke('#032f74',2).setOrigin(.5,.5);
    this.hud.setText(line).setPosition(680,50).setLineSpacing(5);
    this.lastHud=line;
   }
   this.pelagicLevel.setText(`NV ${w.weapons.weaponLevel}`);
   for(let i=0;i<5;i++){g.fillStyle(i<w.weapons.weaponLevel?0x21e3f4:0x103d68).fillRoundedRect(650+i*18.5,81,15,10,2);g.lineStyle(.6,0x83edff,.7).strokeRoundedRect(650+i*18.5,81,15,10,2);}
   this.lifeIcons.forEach((sprite,i)=>sprite.setPosition(80+i*19.5,329).setDisplaySize(19,23).setVisible(true).setAlpha(i<w.lives?1:.20));
   for(let i=0;i<5;i++){
    const x=122+i*12.2;
    g.fillStyle(i<w.weapons.specialCharges?0xffdc39:0x1d426b,1).fillRoundedRect(x,356,10,11,2);
    g.lineStyle(1,i<w.weapons.specialCharges?0xfff8ae:0x83c9df,.9).strokeRoundedRect(x,356,10,11,2);
   }
   g.fillStyle(0x092e5a,.95).fillRoundedRect(577,253,170,3,1);
   g.fillStyle(0xffdf51,.98).fillRoundedRect(577,253,170*Math.min(1,w.route/300),3,1);
  }else{
   // Side-scrolling mission and its horizontal score bar are unchanged.
   g.fillStyle(BLUE,.92).fillRoundedRect(9,5,750,29,10);
   g.lineStyle(1,0x8ee5e4,.7).strokeRoundedRect(9,5,750,29,10);
   const line=`BAYEK / RIVET     ${w.score}     NV ${w.weapons.weaponLevel} ${w.weapons.powerMeter?`+${w.weapons.powerMeter}P`:''}`;
   if(line!==this.lastHud){
    this.hud.setFontSize(11).setColor('#ffffff').setStroke('#153550',3).setOrigin(0,0);
    this.hud.setText(line).setPosition(22,13);
    this.lastHud=line;
   }
   this.lifeIcons.forEach((sprite,i)=>sprite.setPosition(447+i*17,19).setDisplaySize(15,19).setVisible(true).setAlpha(i<w.lives?1:.18));
   for(let i=0;i<5;i++){
    const x=589+i*20;g.fillStyle(i<w.weapons.specialCharges?0xffd95a:0x45718a);
    g.beginPath().moveTo(x+2,9).lineTo(x-5,20).lineTo(x,20).lineTo(x-2,29).lineTo(x+7,16).lineTo(x+2,16).closePath().fillPath();
   }
  }
  if(w.state==='intro'&&w.up){
   this.radio.setOrigin(0,0).setText('BAYEK\nRota 01.\nFenda Pelágica.\nVamos decolar!').setPosition(646,295).setVisible(true);this.messageUntil=this.clock+.5;
  }else if(w.state==='intro'){
   g.fillStyle(0xffe77d,.95).fillRoundedRect(220,170,328,75,12);
   const label=w.mission.name;
   this.radio.setOrigin(.5).setText(`MISSÃO ${this.currentMission+1}\n${label}`).setPosition(384,207).setVisible(true);
   this.messageUntil=this.clock+.5;
  }
 }
 private consumeEvents():void{
  const w=this.world!;for(const e of w.events){
   if(e.type==='shot')globalAudio.playShot('nolan',w.weapons.weaponLevel);
   else if(e.type==='missile')globalAudio.playMissile();
   else if(e.type==='enemy-shot')globalAudio.playArcade(w.boss?'cannon':'orb');
   else if(e.type==='impact'){globalAudio.playArcade('impact');if(this.effects.length<18+this.quality*18)this.explosion(e.x,e.y,10,.12);}
   else if(e.type==='explosion'){globalAudio.playArcade((e.size??1)>1.3?'boom':'pop');this.layeredExplosion(e);}
   else if(e.type==='pickup')globalAudio.playPickup(e.text??'power');
   else if(e.type==='special')globalAudio.playArcade('special');
   else if(e.type==='boss'||e.type==='mini'){this.audio.play(e.type==='mini'?(w.up?'mini1':'mini2'):(w.up?'boss1':'boss2'));this.message(e.text??'');}
   else if(e.type==='return'){globalAudio.playArcade('transition');this.message('PULA-ONDA: TURBINAS ABERTAS!');}
   else if(e.type==='victory'){this.audio.play('victory');this.message('BAYEK: ESSA FOI PARA A EQUIPE!');}
   else if(e.type==='radio'){this.message(e.text??'');if(!w.boss&&w.route>155)this.audio.play(w.up?'stage1':'stage2');}
  }w.events.length=0;
 }
 private effectSprite(x:number,y:number,texture:string,frame=0):Phaser.GameObjects.Sprite{return(this.effectPool.pop()??this.add.sprite(x,y,texture)).setTexture(texture,frame).setPosition(x,y).setDepth(20).setRotation(0).setAlpha(1).setVisible(true).clearTint();}
 private explosion(x:number,y:number,size:number,duration=.42,vx=0,vy=0,spin=0):void{if(this.effects.length>80)return;const sprite=this.effectSprite(x,y,'arc-explosion').setDisplaySize(size,size);this.effects.push({sprite,age:0,duration,size,vx,vy,spin});}
 private layeredExplosion(e:WorldEvent):void{const size=e.size??1;this.explosion(e.x,e.y,36*size,.46);if(size>1)for(let i=0;i<3+this.quality;i++)this.explosion(e.x+Math.cos(i*2.4)*size*13,e.y+Math.sin(i*2.4)*size*13,22*size,.3+i*.055,Math.cos(i)*16,Math.sin(i)*16);}
 private message(text:string):void{
   const up=!!this.world?.up;
   this.radio.setOrigin(up?0:.5,up?0:.5).setText(text)
    .setPosition(up?646:384,up?295:65).setVisible(true);
   this.messageUntil=this.clock+(up?6:3.3);
  }
 private bestScoreFor(stageId?:number):number{
  const rec=globalSave.getData().bestScores;
  if(stageId!==undefined)return rec[stageId]?.score??0;
  const vals=Object.values(rec).map(r=>r.score);
  return vals.length?Math.max(0,...vals):0;
 }
 private arcadeProgress(){try{return readArcadeProgress(localStorage.getItem('bullet_wake_arcade_v1'));}catch{return readArcadeProgress(null);}}
 private saveClear():void{
  if(this.stageClearSaved||!this.world)return;this.stageClearSaved=true;const w=this.world;this.carried=stageFlightSnapshot(w.mission.id,w.weapons,w.lives,w.score);
  const data=recordArcadeClear(this.arcadeProgress(),this.carried);try{localStorage.setItem('bullet_wake_arcade_v1',JSON.stringify(data));}catch{/* Memory carry still supports next stage. */}
  globalSave.recordStageClear(w.mission.id,'nolan',w.score,this.carried);
 }
 private installTouch():void{
  const g=this.add.graphics().setDepth(55);g.lineStyle(2,0xe9ffff,.6).strokeCircle(79,347,43);g.fillStyle(0x16385b,.2).fillCircle(79,347,43);g.fillStyle(0xffdf5a,.8).fillCircle(690,353,31);g.fillStyle(0xff805e,.8).fillCircle(612,365,24);
  const label=this.add.text(690,353,'TIRO',{fontFamily:FONT,fontSize:'12px',color:'#173553'}).setOrigin(.5).setDepth(56),special=this.add.text(612,365,'ESP',{fontFamily:FONT,fontSize:'10px',color:'#173553'}).setOrigin(.5).setDepth(56);
  this.touchNodes=[g,label,special];this.setTouchVisible(false);
  this.input.on('pointerdown',(p:Phaser.Input.Pointer)=>{
   this.audio.unlock();if(this.screen==='intro'){this.show('title');return;}if(this.screen!=='play')return;
   const q=this.cameras.main.getWorldPoint(p.x,p.y);if(q.x>724&&q.y<38){this.show('pause');return;}
   if(!p.wasTouch)return;this.setTouchVisible(true);if(q.x<175){this.touchStart={id:p.id,x:q.x,y:q.y};}else if(q.x>650&&q.y>290){this.touch.fire=true;this.touchFireId=p.id;}else if(q.x>570&&q.y>300){this.touch.special=true;this.touchSpecialId=p.id;}
  });
  this.input.on('pointermove',(p:Phaser.Input.Pointer)=>{if(this.touchStart?.id!==p.id)return;const q=this.cameras.main.getWorldPoint(p.x,p.y);this.touch.x=clamp((q.x-this.touchStart.x)/34,-1,1);this.touch.y=clamp((q.y-this.touchStart.y)/34,-1,1);});
  const release=(p:Phaser.Input.Pointer)=>{if(this.touchStart?.id===p.id){this.touchStart=undefined;this.touch.x=0;this.touch.y=0;}if(p.id===this.touchFireId)this.touch.fire=false;if(p.id===this.touchSpecialId)this.touch.special=false;};this.input.on('pointerup',release);this.input.on('pointerupoutside',release);
 }
 private setTouchVisible(visible:boolean):void{const touch=visible&&('ontouchstart'in window||navigator.maxTouchPoints>0);this.touchNodes.forEach(n=>n.setVisible(touch));}
}
