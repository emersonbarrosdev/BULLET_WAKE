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
import {rivetShotPresentation} from '../render/rivetPresentation';
import {enableCombatResolution} from '../render/combatResolution';
import {clamp} from './geometry';
import {readArcadeProgress,recordArcadeClear} from './progress';

type Screen='intro'|'title'|'pilot'|'missions'|'play'|'pause'|'controls'|'settings'|'confirm-exit'|'result'|'defeat'|'ending';
type Effect={sprite:Phaser.GameObjects.Sprite;age:number;duration:number;size:number;vx:number;vy:number;spin:number;falling?:boolean;};
const FONT='Oxanium, Arial, sans-serif';
const FAMILY_ORDER:Family[]=['fighter','interceptor','acrobat','bomber','boat','ship','tank','tower'];
const BLUE=0x16385b,YELLOW=0xffdf5a;
/** Cartoon presentation over one shared deterministic UP/SIDE simulation. Legacy content remains registered separately. */
export class ArcadeScene extends Phaser.Scene {
 world?:ArcadeWorld;screen:Screen='intro';audio=new ArcadeAudio();quality=2;
 private backdrop!:ArcadeBackdrop;private ui!:Phaser.GameObjects.Container;private decor!:Phaser.GameObjects.Graphics;private combatInk!:Phaser.GameObjects.Graphics;private hud!:Phaser.GameObjects.Text;private radio!:Phaser.GameObjects.Text;
 private player!:Phaser.GameObjects.Sprite;private bossSprite!:Phaser.GameObjects.Sprite;private hero!:Phaser.GameObjects.Image;private logo!:Phaser.GameObjects.Image;private wingmen:Phaser.GameObjects.Image[]=[];
 private logoParts:Phaser.GameObjects.Image[]=[];private lifeIcons:Phaser.GameObjects.Image[]=[];
 private enemySprites=new Map<number,Phaser.GameObjects.Sprite>();private cargoSprites=new Map<number,Phaser.GameObjects.Container>();private partSprites=new Map<number,Phaser.GameObjects.Sprite>();private bulletSprites:Phaser.GameObjects.Sprite[]=[];private effects:Effect[]=[];
 private turrets=new Map<number,Phaser.GameObjects.Sprite>();private effectPool:Phaser.GameObjects.Sprite[]=[];
 private controls!:Record<string,Phaser.Input.Keyboard.Key>;private pad=new GamepadReader();private buttons:{node:Phaser.GameObjects.Text;action:()=>void}[]=[];private focus=0;
 private clock=0;private introClock=0;private accumulator=0;private lastHud='';private messageUntil=0;private pauseOrigin:Screen='pause';private carried?:CampaignFlight;private currentMission=0;private stageClearSaved=false;
 private touch={x:0,y:0,fire:false,special:false};private touchStart?:{id:number;x:number;y:number};private touchFireId=-1;private touchSpecialId=-1;private touchNodes:(Phaser.GameObjects.Graphics|Phaser.GameObjects.Text)[]=[];
 private mute=false;
 constructor(){super('ArcadeScene');}
 preload():void{
  const base=import.meta.env.BASE_URL;
  this.load.spritesheet('arc-ufo',`${base}assets/arcade/ufo.webp`,{frameWidth:256,frameHeight:256});
  this.load.image('arc-ocean',`${base}assets/arcade/ocean.webp`);
  for(const name of ['rivet','enemies','pilots','scenery'])this.load.spritesheet('arc-'+name,`${base}assets/arcade/${name}.webp`,{frameWidth:256,frameHeight:256});
  this.load.spritesheet('arc-boss',`${base}assets/arcade/boss.webp`,{frameWidth:512,frameHeight:512});
  this.load.spritesheet('arc-red',`${base}assets/combat-hd/polish/rivet-red.webp`,{frameWidth:128,frameHeight:128});
  this.load.spritesheet('arc-explosion',`${base}assets/arcade/explosion.webp`,{frameWidth:256,frameHeight:256});
  this.load.spritesheet('arc-missile',`${base}assets/combat-hd/review/effects-missile.webp`,{frameWidth:256,frameHeight:256});
  for(const name of ['main','bullet','wake'])this.load.svg('arc-logo-'+name,`${base}assets/arcade/logo-${name}.svg`);
  const loading=this.add.text(384,216,'PREPARANDO A PISTA…',{fontFamily:FONT,fontSize:'18px',color:'#fff2a1'}).setOrigin(.5);
  this.load.on('progress',(n:number)=>loading.setText(`PREPARANDO A PISTA  ${Math.round(n*100)}%`));this.load.once('complete',()=>loading.destroy());
 }
 create():void{
  enableCombatResolution(this);this.input.addPointer(3);
  this.controls=this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,X,ESC,ENTER') as Record<string,Phaser.Input.Keyboard.Key>;
  this.input.keyboard!.addCapture(['SPACE','UP','DOWN','LEFT','RIGHT','ENTER']);
  const settings=globalSave.getSettings();this.mute=settings.isMuted;this.audio.setMix(settings.musicVolume,settings.sfxVolume,this.mute);
  try{const stored=localStorage.getItem('bullet_wake_visual');if(stored!==null)this.quality=clamp(Number(stored)||0,0,2);}catch{/* Optional preference. */}
  this.backdrop=new ArcadeBackdrop(this);this.decor=this.add.graphics().setDepth(40);this.combatInk=this.add.graphics().setDepth(12);
  this.player=this.add.sprite(384,350,'arc-rivet',1).setDisplaySize(31,38).setDepth(18).setVisible(false);
  this.bossSprite=this.add.sprite(384,100,'arc-boss').setDepth(3).setVisible(false);
  this.hero=this.add.image(384,280,'arc-rivet',4).setDisplaySize(245,245).setDepth(1);
  this.logo=this.add.image(384,145,'arc-logo-main').setDisplaySize(475,148).setDepth(4);
  this.logoParts=['bullet','wake'].map(name=>this.add.image(384,112,'arc-logo-'+name).setDisplaySize(475,148).setDepth(4).setVisible(false));
  for(let i=0;i<5;i++)this.lifeIcons.push(this.add.image(447+i*17,19,'arc-rivet',1).setDisplaySize(15,19).setDepth(46).setVisible(false));
  for(let i=0;i<3;i++)this.wingmen.push(this.add.image(-100,100,'arc-enemies',8).setDisplaySize(45,45).setDepth(-2));
  this.ui=this.add.container(0,0).setDepth(60);
  this.hud=this.add.text(0,0,'',{fontFamily:FONT,fontSize:'11px',fontStyle:'bold',color:'#ffffff',stroke:'#153550',strokeThickness:3}).setResolution(2).setDepth(45);
  this.radio=this.add.text(384,66,'',{fontFamily:FONT,fontSize:'12px',color:'#16385b',backgroundColor:'#fff7cb',padding:{x:8,y:5},wordWrap:{width:280},align:'center'}).setResolution(2).setOrigin(.5).setDepth(48).setVisible(false);
  for(let i=0;i<640;i++)this.bulletSprites.push(this.add.sprite(0,0,'arc-red').setVisible(false).setDepth(15));
  this.makeOrbTextures();this.installTouch();this.show('intro');
  const blur=()=>{this.touch={x:0,y:0,fire:false,special:false};this.touchStart=undefined;if(this.screen==='play')this.show('pause');};
  window.addEventListener('blur',blur);const visibility=()=>{if(document.hidden)blur();};document.addEventListener('visibilitychange',visibility);
  this.events.once('shutdown',()=>{this.audio.stop();globalAudio.stopCombatEffects();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);this.backdrop.destroy();});
 }
 private makeOrbTextures():void{
  for(const [i,color] of [0xff654c,0xffc53b,0xb764ff].entries()){
   const g=this.make.graphics({x:0,y:0});g.fillStyle(0x173452).fillCircle(16,16,14);g.fillStyle(0xffffff).fillCircle(16,16,12);g.fillStyle(color).fillCircle(16,16,10);g.fillStyle(0xfff4bd).fillCircle(13,12,4);g.generateTexture('arc-orb-'+i,32,32);g.destroy();
  }
 }
 private text(x:number,y:number,text:string,size=18,color='#16385b'):Phaser.GameObjects.Text{
  const node=this.add.text(x,y,text,{fontFamily:FONT,fontSize:size+'px',fontStyle:'bold',color,align:'center',wordWrap:{width:660}}).setResolution(2).setOrigin(.5);this.ui.add(node);return node;
 }
 private button(x:number,y:number,label:string,action:()=>void,width=230):void{
  const bg=this.add.graphics();bg.fillStyle(BLUE).fillRoundedRect(x-width/2+3,y-16+4,width,34,9);bg.fillStyle(YELLOW).fillRoundedRect(x-width/2,y-16,width,34,9);bg.lineStyle(2,BLUE).strokeRoundedRect(x-width/2,y-16,width,34,9);this.ui.add(bg);
  const n=this.text(x,y+1,label,14);n.setInteractive(new Phaser.Geom.Rectangle((n.width-width)/2,(n.height-36)/2,width,36),Phaser.Geom.Rectangle.Contains);const index=this.buttons.length;
  n.on('pointerover',()=>{this.focus=index;this.focusButtons();});n.on('pointerdown',()=>{this.audio.unlock();globalAudio.playArcade('confirm');action();});this.buttons.push({node:n,action});
 }
 private focusButtons():void{this.buttons.forEach((b,i)=>b.node.setColor(i===this.focus?'#ce3441':'#16385b').setScale(i===this.focus?1.045:1));}
 show(screen:Screen):void{
  const old=this.screen;this.screen=screen;if(old!==screen&&screen!=='play')globalAudio.playArcade('navigate');this.ui.removeAll(true);this.buttons=[];this.focus=0;
  if(screen==='result'||screen==='defeat'){this.messageUntil=0;this.radio.setVisible(false);}
  const game=['play','pause','controls','settings','confirm-exit','result','defeat'].includes(screen)&&!!this.world;
  this.logo.setVisible(!game&&screen==='title');this.logoParts.forEach(s=>s.setVisible(screen==='intro'));this.hero.setVisible(!game&&['intro','title'].includes(screen));this.wingmen.forEach(s=>s.setVisible(!game));
  if(screen==='pause'){this.audio.pause();this.pauseOrigin='pause';}
  if(screen==='play'&&old!=='play')this.audio.resume();
  if(screen==='intro'){this.introClock=0;this.text(384,404,'ENTER / START • PULAR',11);this.audio.play('intro');}
  else if(screen==='title'){
   this.audio.play('menu');this.button(384,334,'APERTE START',()=>this.show('pilot'));this.button(384,379,'OPÇÕES',()=>{this.pauseOrigin='title';this.show('settings');},155);this.text(384,422,'BOTAN STUDIO  •  VOE. DESVIE. VOLTE MAIS FORTE.',9);
  }else if(screen==='pilot'){
   this.audio.play('select');this.text(384,35,'ESCOLHA SEU PILOTO',27);
   const portraits=[0,4,5,6,7],names=['BAYEK','TITA','LEONA','OSVALD','HIEN'];
   for(let i=0;i<5;i++){const x=128+i*128;const halo=this.add.graphics().fillStyle(i===0?0xffdc57:0xd0f5eb,.85).fillCircle(x,170,62);this.ui.add(halo);this.ui.add(this.add.image(x,168,'arc-pilots',portraits[i]).setDisplaySize(122,122).setAlpha(i? .65:1));this.text(x,248,names[i],16);if(i)this.text(x,269,'EM PREPARAÇÃO',8);}
   this.text(384,296,'BAYEK / RIVET  •  RAJADA ESCARLATE',16);this.text(384,322,'Três motores. Um destino: trazer todo mundo de volta.',12);this.button(384,367,'DECOLAR COM BAYEK',()=>this.show('missions'));this.button(92,406,'VOLTAR',()=>this.show('title'),130);
  }else if(screen==='missions'){
   this.text(384,38,'ESCOLHA A ROTA',28);this.text(384,69,'DUAS PERSPECTIVAS. UMA AVENTURA.',11);
   const unlocked=this.arcadeProgress().cleared.includes(1);
   for(let i=0;i<2;i++){const x=i?560:208;const art=this.add.image(x,177,'arc-scenery',i?5:0).setDisplaySize(180,180);this.ui.add(art);this.text(x,279,MISSIONS[i].name,19);this.text(x,302,i?'SIDE • CIDADE E PASSAGENS':'UP • OCEANO E ARQUIPÉLAGO',10);this.button(x,351,i&&!unlocked?'CONCLUA A FASE 1':'INICIAR MISSÃO',()=>{if(i&&!unlocked)return;const carry=i?this.arcadeProgress().flights[1]:undefined;this.begin(i,carry);},270);}
   this.button(92,406,'VOLTAR',()=>this.show('pilot'),130);
  }else if(screen==='play'){
   if(this.world?.up){
    this.ui.add(this.add.image(104,124,'arc-pilots',0).setDisplaySize(133,133));
    this.text(102,29,'BULLET WAKE',16,'#ffde59');
    this.text(103,205,'BAYEK',22,'#fff19a');
    this.text(103,229,'RIVET • VANGUARDA',10,'#d5fffb');
    this.text(53,256,'VIDAS',10,'#efffff');
    this.text(60,293,'ESPECIAL',10,'#efffff');
    this.text(656,48,'PONTUAÇÃO',12,'#fff2a1');
    this.text(658,163,'ROTA 01',18,'#fff2a1');
    this.text(658,188,'FENDA PELÁGICA',11,'#defffa');
    this.text(657,246,'RÁDIO • BAYEK',11,'#ffe58a');
    this.radio.setStyle({fontFamily:FONT,fontSize:'11px',color:'#eafff8',backgroundColor:'#14496a',padding:{x:6,y:5},wordWrap:{width:145},align:'left'});
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
   this.panel(232,82,304,278);this.text(384,119,'PAUSA',28);this.button(384,179,'CONTINUAR',()=>this.show('play'));this.button(384,226,'CONTROLES',()=>this.show('controls'));this.button(384,273,'OPÇÕES',()=>{this.pauseOrigin='pause';this.show('settings');});this.button(384,320,'VOLTAR AO MENU',()=>this.show('confirm-exit'));
  }else if(screen==='controls'){
   this.panel(182,58,404,321);const pad=connectedPad();const labels=padLabels(pad?.id);this.text(384,93,pad?'CONTROLE CONECTADO':'CONTROLES',22);
   this.text(384,143,pad?'ANALÓGICO / DIRECIONAL • MOVER':'WASD / SETAS • MOVER',14);this.text(384,182,`${pad?labels.shoot:'ESPAÇO'} • RAJADA DE 3 TIROS`,14);this.text(384,220,`${pad?labels.special:'X'} • TORMENTA ESCARLATE`,14);this.text(384,257,`${pad?labels.pause:'ESC'} • PAUSA`,14);this.text(384,286,'Segure para repetir. Disparo acessível nas opções.',11);this.button(384,336,'VOLTAR',()=>this.show('pause'));
  }else if(screen==='settings'){
   this.panel(164,39,440,355);const s=globalSave.getSettings();this.text(384,74,'OPÇÕES',25);
   const volume=(music:boolean,delta:number)=>{const current=globalSave.getSettings();globalSave.updateSettings(music?{musicVolume:clamp(current.musicVolume+delta,0,1)}:{sfxVolume:clamp(current.sfxVolume+delta,0,1)});this.audio.setMix(globalSave.getSettings().musicVolume,globalSave.getSettings().sfxVolume,this.mute);this.show('settings');};
   this.text(384,112,`MÚSICA ${Math.round(s.musicVolume*100)}%  /  EFEITOS ${Math.round(s.sfxVolume*100)}%`,13);
   this.button(286,151,'MÚSICA −',()=>volume(true,-.1),170);this.button(482,151,'MÚSICA +',()=>volume(true,.1),170);this.button(286,196,'EFEITOS −',()=>volume(false,-.1),170);this.button(482,196,'EFEITOS +',()=>volume(false,.1),170);
   this.button(384,241,`DISPARO ACESSÍVEL: ${s.rapidFire?'SIM':'NÃO'}`,()=>{globalSave.updateSettings({rapidFire:!s.rapidFire});if(this.world)this.world.accessibility=!s.rapidFire;this.show('settings');},330);
   this.button(286,286,`VISUAL: ${['LOW','MED','HIGH'][this.quality]}`,()=>{this.quality=(this.quality+1)%3;try{localStorage.setItem('bullet_wake_visual',String(this.quality));}catch{/* Optional preference. */}this.show('settings');},170);this.button(482,286,s.difficulty==='normal'?'NORMAL':'DIFÍCIL',()=>{globalSave.updateSettings({difficulty:s.difficulty==='normal'?'hard':'normal'});if(this.world)this.world.hard=s.difficulty==='normal';this.show('settings');},170);
   this.button(384,348,'VOLTAR',()=>this.show(this.pauseOrigin));
  }else if(screen==='confirm-exit'){
   this.panel(202,104,364,240);this.text(384,147,'SAIR DA MISSÃO?',23);this.text(384,196,'O progresso da fase atual será perdido.',12);this.button(384,250,'CANCELAR',()=>this.show('pause'));this.button(384,300,'CONFIRMAR SAÍDA',()=>{this.disposeWorld();this.show('title');});
  }else if(screen==='result'){
   this.audio.play('results');this.panel(150,48,468,342);this.ui.add(this.add.image(230,171,'arc-pilots',1).setDisplaySize(150,150));this.text(439,97,'MISSÃO CONCLUÍDA!',24);this.text(444,146,MISSIONS[this.currentMission].name,16);
   const w=this.world!;this.text(445,191,`${String(w.score).padStart(8,'0')} PONTOS`,19);this.text(445,223,`${Math.floor(w.elapsed/60)}:${String(Math.floor(w.elapsed%60)).padStart(2,'0')}  •  ${w.kills} ALVOS  •  ${w.collected} ITENS`,11);this.text(384,275,'Potência, vidas e especiais seguem com você.',12);
   this.button(384,322,this.currentMission===0?'PRÓXIMA: CIDADE SOLAR':'VER ENCERRAMENTO',()=>{if(this.currentMission===0)this.begin(1,this.carried);else this.show('ending');},340);this.button(384,367,'MENU',()=>{this.disposeWorld();this.show('title');},140);
  }else if(screen==='defeat'){
   this.audio.play('defeat');this.panel(172,45,424,350);this.ui.add(this.add.image(384,153,'arc-pilots',2).setDisplaySize(155,155));this.text(384,253,'ATERRISSAGEM… CRIATIVA!',24);this.text(384,279,'Bayek: o importante é ter estilo na próxima!',12);this.button(384,324,'TENTAR NOVAMENTE',()=>this.begin(this.currentMission));this.button(384,371,'MENU',()=>{this.disposeWorld();this.show('title');},140);
  }else if(screen==='ending'){
   this.disposeWorld();this.audio.play('victory');this.ui.add(this.add.image(384,157,'arc-pilots',1).setDisplaySize(220,220));this.text(384,37,'DO MAR AO CÉU!',29);this.text(384,286,'Bayek abriu caminho para a equipe de resgate.',17);this.text(384,317,'Duas missões concluídas. O próximo recorde é seu.',12);this.button(384,368,'VOAR DE NOVO',()=>this.show('pilot'));
  }
  this.focusButtons();this.setTouchVisible(screen==='play');
 }
 private panel(x:number,y:number,width:number,height:number):void{
  const g=this.add.graphics();g.fillStyle(0x0c5170,.18).fillRect(0,0,768,432);g.fillStyle(0xfff7df,.94).fillRoundedRect(x,y,width,height,18);g.lineStyle(4,BLUE).strokeRoundedRect(x,y,width,height,18);this.ui.add(g);
 }
 begin(index:number,carry?:CampaignFlight):void{
  this.disposeWorld();this.currentMission=index;this.stageClearSaved=false;this.world=new ArcadeWorld(MISSIONS[index],carry);this.world.accessibility=globalSave.getSettings().rapidFire;this.world.hard=globalSave.getSettings().difficulty!=='normal';this.accumulator=0;
  this.world.contact=(e,ax,ay,bx,by,radius)=>{const sprite=this.enemySprites.get(e.id),turret=this.turrets.get(e.id);const hits=[sprite?spriteContact(sprite,ax,ay,bx,by,radius):null,turret?spriteContact(turret,ax,ay,bx,by,radius):null].filter((v):v is number=>v!==null);return hits.length?Math.min(...hits):null;};
  this.player.setVisible(true);this.audio.play(index?'stage2':'stage1');this.show('play');
 }
 private disposeWorld():void{
  this.world=undefined;this.player?.setVisible(false);this.bossSprite?.setVisible(false);this.lifeIcons.forEach(s=>s.setVisible(false));this.hud?.setText('');this.radio?.setVisible(false);this.combatInk?.clear();this.decor?.clear();this.lastHud='';
  for(const map of [this.enemySprites,this.partSprites,this.turrets]){for(const s of map.values())s.destroy();map.clear();}for(const s of this.cargoSprites.values())s.destroy();this.cargoSprites.clear();for(const s of this.bulletSprites)s.setVisible(false);for(const e of this.effects){e.sprite.setVisible(false);this.effectPool.push(e.sprite);}this.effects=[];globalAudio.stopCombatEffects();
 }
 update(_time:number,delta:number):void{
  const dt=Math.min(delta/1000,.05);this.clock+=dt;const gp=this.pad.sample(connectedPad());const just=(k:string)=>Phaser.Input.Keyboard.JustDown(this.controls[k]);
  if(this.screen!=='play'){
   if(just('DOWN')||just('RIGHT')||gp.down||gp.right){this.focus=(this.focus+1)%Math.max(1,this.buttons.length);this.focusButtons();}
   if(just('UP')||just('LEFT')||gp.up||gp.left){this.focus=(this.focus+this.buttons.length-1)%Math.max(1,this.buttons.length);this.focusButtons();}
   const confirm=just('ENTER')||just('SPACE')||gp.confirm;
   if(this.screen==='intro'){this.introClock+=dt;if(confirm||gp.menuOrBack||this.introClock>=7)this.show('title');}
   else if(confirm){this.audio.unlock();this.buttons[this.focus]?.action();}
   else if(just('ESC')||gp.back||gp.menuOrBack){if(this.screen==='pause')this.show('play');else if(['controls','confirm-exit'].includes(this.screen))this.show('pause');else if(this.screen==='settings')this.show(this.pauseOrigin);else if(this.screen==='missions')this.show('pilot');else if(this.screen==='pilot')this.show('title');}
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
 private renderMenu():void{
  this.decor.clear();this.hud.setText('');this.combatInk.clear();const time=this.clock;
  this.hero.setPosition(385+Math.sin(time*.7)*14,248+Math.sin(time*1.3)*7).setFrame(Math.floor(time*8)%2?4:7).setAngle(-6+Math.sin(time*.5)*2);
  this.logo.setPosition(384,112+Math.sin(time*1.7)*3).setScale(475/720);
  if(this.screen==='intro'){const t=this.introClock;this.hero.x=-180+Math.min(1,t/4)*565;const progress=clamp((t-2.2)/.85,0,1),ease=1-(1-progress)**3;this.logoParts.forEach((s,i)=>s.setPosition(384+(i?1:-1)*(1-ease)*650,112).setAlpha(progress));}else this.logo.setAlpha(1);
  this.wingmen.forEach((s,i)=>s.setPosition(850-((time*65+i*270)%1100),82+i*51).setFrame(8+i));
 }
 private renderWorld(dt:number):void{
  const w=this.world!,time=w.elapsed,g=this.combatInk;g.clear();
  this.player.setPosition(w.player.x,w.player.y).setFrame(w.up?(w.player.bank<-.3?0:w.player.bank>.3?2:Math.floor(time*9)%2?1:3):(w.player.bank<-.3?6:w.player.bank>.3?5:Math.floor(time*9)%2?4:7)).setDisplaySize(w.up?31:42,w.up?38:34).setAlpha(w.player.invulnerable>0&&Math.floor(time*14)%2?.45:1).setVisible(w.state!=='defeat');
  const alive=new Set<number>();
  for(const e of w.enemies){alive.add(e.id);let s=this.enemySprites.get(e.id);if(!s){s=this.add.sprite(e.x,e.y,'arc-enemies').setDepth(e.ground?2:8);this.enemySprites.set(e.id,s);}s.setPosition(e.x,e.y).setTexture(e.family==='alien'?'arc-ufo':'arc-enemies',e.family==='alien'?(w.up?0:2)+Math.floor(time*5)%2:e.family==='airship'?12:FAMILY_ORDER.indexOf(e.family)+(w.up?0:8)).setDisplaySize(e.size,e.size).setRotation(w.up&&!e.ground&&e.family!=='alien'?Math.PI:0);
   if(e.flash>0)s.setTint(0xff4b48).setTintMode(Phaser.TintModes.FILL);else s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
   if(e.ground){let turret=this.turrets.get(e.id);if(!turret){turret=this.add.sprite(e.x,e.y,'arc-boss',w.up?3:6).setDepth(5).setOrigin(.5,w.up?.4:.5);this.turrets.set(e.id,turret);}const y=e.y+(w.up?e.size*.12:-e.size*.09);turret.setPosition(e.x,y).setDisplaySize(e.size*.58,e.size*.58).setRotation(Math.atan2(w.player.y-y,w.player.x-e.x)-(w.up?Math.PI/2:Math.PI));if(e.flash>0)turret.setTint(0xff4b48).setTintMode(Phaser.TintModes.FILL);else turret.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);}
   if(e.warning>0){g.lineStyle(1.5,0xffe46b,.9).strokeCircle(e.x,e.y,e.size*.35+e.warning*4);}
   if(!e.ground){g.lineStyle(1,0xb6ffff,.3).lineBetween(e.x+(w.up?0:13),e.y+(w.up?-15:0),e.x+(w.up?0:22+Math.sin(time*25)*2),e.y+(w.up?-25:0));if(['fighter','acrobat','bomber'].includes(e.family)){const nose=w.up?e.y+e.size*.33:e.x-e.size*.35;g.lineStyle(1.5,0xffe36a,.7);if(w.up)g.lineBetween(e.x-Math.cos(time*45+e.id)*e.size*.22,nose,e.x+Math.cos(time*45+e.id)*e.size*.22,nose);else g.lineBetween(nose,e.y-Math.cos(time*45+e.id)*e.size*.22,nose,e.y+Math.cos(time*45+e.id)*e.size*.22);}}
  }for(const [id,s] of this.enemySprites)if(!alive.has(id)){s.destroy();this.enemySprites.delete(id);this.turrets.get(id)?.destroy();this.turrets.delete(id);}
  this.renderBoss(g);
  for(let i=0;i<w.bullets.length;i++){const b=w.bullets[i],s=this.bulletSprites[i];s.setVisible(b.active);if(!b.active)continue;
   if(b.enemy)s.setTexture('arc-orb-'+b.color).setDisplaySize(b.radius*2+3,b.radius*2+3).setRotation(0);
   else{const art=rivetShotPresentation(w.weapons.weaponLevel);s.setTexture(b.missile?'arc-missile':'arc-red',Math.floor(b.age*20)%8).setDisplaySize(b.missile?17:art.width,b.missile?25:art.height).setRotation(Math.atan2(b.vy,b.vx)+Math.PI/2);}
   s.setPosition(b.x,b.y);
  }
  this.renderCargo(g);this.renderObstacles(g);
  if(w.specialTime>0){const x=w.player.x,y=w.player.y,end=w.specialImpact??(w.up?{x,y:w.arena.top}:{x:w.arena.right,y});
   for(const [width,color,alpha] of [[38,0xff3f32,.22],[22,0xff7735,.6],[9,0xffffca,.95]]){g.lineStyle(width,color,alpha);g.lineBetween(x,y,end.x,end.y);}
   for(let i=0;i<12;i++){const t=(time*4+i/12)%1,offset=Math.sin(time*33+i)*12;g.fillStyle(i%2?0xffd360:0xffffff,.85);g.fillEllipse(x+(end.x-x)*t+(w.up?offset:0),y+(end.y-y)*t+(w.up?0:offset),w.up?3:12,w.up?12:3);}
   if(w.specialImpact){g.lineStyle(3,0xffe469,.8).strokeCircle(end.x,end.y,12+Math.sin(time*45)*6);}
  }
  for(const fx of this.effects){fx.age+=dt;fx.sprite.setPosition(fx.sprite.x+fx.vx*dt,fx.sprite.y+fx.vy*dt).setRotation(fx.sprite.rotation+fx.spin*dt).setAlpha(1-fx.age/fx.duration*.7);if(!fx.falling)fx.sprite.setFrame(Math.min(15,Math.floor(fx.age/fx.duration*16)));else fx.sprite.setDisplaySize(fx.size*(1-fx.age/fx.duration*.6),fx.size*(1-fx.age/fx.duration*.6));}
  this.effects=this.effects.filter(f=>{if(f.age>=f.duration){f.sprite.setVisible(false);this.effectPool.push(f.sprite);return false;}return true;});
  this.renderHud();if(this.clock>this.messageUntil)this.radio.setVisible(false);
 }
 private renderBoss(g:Phaser.GameObjects.Graphics):void{
  const w=this.world!,b=w.boss,live=new Set<number>();this.bossSprite.setVisible(!!b&&b.phase!=='absent');
  if(b){const frame=w.up?(b.mini?2:b.configuration===1?0:1):(b.mini?5:4);this.bossSprite.setTexture('arc-boss',frame).setPosition(b.x,b.y).setDisplaySize(b.size,b.size).setAlpha(b.phase==='sink'?Math.max(0,1-b.timer/3):1).setAngle(!w.up&&b.phase==='sink'?b.timer*12:0);
   for(const p of b.parts){if(b.phase==='absent')continue;live.add(p.id);let s=this.partSprites.get(p.id);if(!s){s=this.add.sprite(p.x,p.y,'arc-boss',w.up?3:6).setDepth(7);this.partSprites.set(p.id,s);}s.setPosition(p.x,p.y).setDisplaySize(p.radius*2.65,p.radius*2.65).setVisible(p.hp>0).setRotation(p.angle-(w.up?Math.PI/2:Math.PI));
    if(p.flash>0)s.setTint(0xff5b4b).setTintMode(Phaser.TintModes.FILL);else s.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    if(p.hp<=0){g.fillStyle(0x174564,.9).fillCircle(p.x,p.y,p.radius*.7);g.lineStyle(2,0xf5b755).strokeCircle(p.x,p.y,p.radius*.78);}
    else if(p.warning>0){g.lineStyle(2,p.warning>.75?0xff5445:0xffe88d,.9).strokeCircle(p.x,p.y,p.radius+5+p.warning*4);const a=p.angle;g.lineBetween(p.x+Math.cos(a)*18,p.y+Math.sin(a)*18,p.x+Math.cos(a)*32,p.y+Math.sin(a)*32);}
   }
   if(!w.up){for(const sign of[-1,1]){const px=b.x+b.size*.27,py=b.y+sign*b.size*.19;g.lineStyle(3,0xceffff,.75);g.lineBetween(px-Math.cos(w.elapsed*35)*13,py-Math.sin(w.elapsed*35)*13,px+Math.cos(w.elapsed*35)*13,py+Math.sin(w.elapsed*35)*13);}}
  }for(const[id,s]of this.partSprites)if(!live.has(id)){s.destroy();this.partSprites.delete(id);}
 }
 private renderCargo(g:Phaser.GameObjects.Graphics):void{
  const w=this.world!,ids=new Set<number>();for(const c of w.cargo){ids.add(c.id);let node=this.cargoSprites.get(c.id);if(!node){const plate=this.add.graphics();plate.fillStyle(BLUE).fillRoundedRect(-13,-13,26,26,5);plate.fillStyle(c.kind==='power'?0xffd94c:c.kind==='life'?0x96ec91:0xff9e8d).fillRoundedRect(-10,-10,20,20,4);const label=this.add.text(0,0,c.kind==='power'?'P':c.kind==='life'?'1UP':'S',{fontFamily:FONT,fontSize:c.kind==='life'?'9px':'16px',fontStyle:'bold',color:'#173553'}).setOrigin(.5);node=this.add.container(c.x,c.y,[plate,label]).setDepth(13);this.cargoSprites.set(c.id,node);}node.setPosition(c.x,c.y).setAngle(Math.sin(c.age*2.5)*(c.crate?7:3));
   if(c.crate){const sway=Math.sin(c.age*2)*4,canopyY=c.y-32;g.lineStyle(1,0xf8ffef,.9);for(const d of[-18,0,18])g.lineBetween(c.x+d+sway,canopyY,c.x+(d===0?0:Math.sign(d)*9),c.y-10);g.fillStyle(0xffefc6).fillEllipse(c.x+sway,canopyY-5,42,20);g.fillStyle(0xff8056).fillEllipse(c.x+sway,canopyY-5,13,20);g.lineStyle(1.5,BLUE).strokeEllipse(c.x+sway,canopyY-5,42,20);}
  }for(const[id,s]of this.cargoSprites)if(!ids.has(id)){s.destroy();this.cargoSprites.delete(id);}
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
    // The same animated ocean extends behind compact side panels.
    const panel=(x:number,y:number,width:number,height:number)=>{
     g.fillStyle(0x063b63,.73).fillRoundedRect(x,y,width,height,12);
     g.lineStyle(1,0x83eeea,.70).strokeRoundedRect(x,y,width,height,12);
    };
    panel(12,11,185,232);panel(16,246,177,70);
    panel(572,11,182,125);panel(572,145,182,80);panel(572,235,182,78);
    g.fillStyle(0xffdf5a,.88).fillRoundedRect(30,43,150,3,2);
    g.fillStyle(0xffdf5a,.86).fillRoundedRect(590,61,145,3,2);
    g.lineStyle(3,0x124969,.95).lineBetween(588,214,737,214);
    g.lineStyle(3,0xffe069,.95).lineBetween(588,214,588+149*Math.min(1,w.route/300),214);
    const line=`${String(w.score).padStart(8,'0')}\nNV ${w.weapons.weaponLevel}${w.weapons.powerMeter?`  +${w.weapons.powerMeter}P`:''}`;
    if(line!==this.lastHud){this.hud.setText(line).setPosition(594,79);this.lastHud=line;}
    this.lifeIcons.forEach((sprite,i)=>sprite.setPosition(78+i*26,261).setVisible(true).setAlpha(i<w.lives?1:.18));
    for(let i=0;i<5;i++){
     const x=102+i*16;
     g.fillStyle(i<w.weapons.specialCharges?0xffdf5a:0x45718a,.95);
     g.beginPath().moveTo(x,282).lineTo(x-6,296).lineTo(x-1,296).lineTo(x-4,307).lineTo(x+7,290).lineTo(x+2,290).closePath().fillPath();
    }
   }else{
    // Side-scrolling mission retains its original compact horizontal score bar.
    g.fillStyle(BLUE,.92).fillRoundedRect(9,5,750,29,10);
    g.lineStyle(1,0x8ee5e4,.7).strokeRoundedRect(9,5,750,29,10);
    const line=`BAYEK / RIVET     ${String(w.score).padStart(8,'0')}     NV ${w.weapons.weaponLevel} ${w.weapons.powerMeter?`+${w.weapons.powerMeter}P`:''}`;
    if(line!==this.lastHud){this.hud.setText(line).setPosition(22,13);this.lastHud=line;}
    this.lifeIcons.forEach((sprite,i)=>sprite.setPosition(447+i*17,19).setVisible(true).setAlpha(i<w.lives?1:.18));
    for(let i=0;i<5;i++){
     const x=589+i*20;
     g.fillStyle(i<w.weapons.specialCharges?0xffd95a:0x45718a);
     g.beginPath().moveTo(x+2,9).lineTo(x-5,20).lineTo(x,20).lineTo(x-2,29).lineTo(x+7,16).lineTo(x+2,16).closePath().fillPath();
    }
   }
   if(w.state==='intro'){
    g.fillStyle(0xffe77d,.95).fillRoundedRect(220,170,328,75,12);
    const label=this.world!.mission.name;
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
 private layeredExplosion(e:WorldEvent):void{const size=e.size??1;this.explosion(e.x,e.y,36*size,.46);if(size>1)for(let i=0;i<3+this.quality;i++)this.explosion(e.x+Math.cos(i*2.4)*size*13,e.y+Math.sin(i*2.4)*size*13,22*size,.3+i*.055,Math.cos(i)*16,Math.sin(i)*16);
  if(e.text&&['fighter','interceptor','acrobat','bomber'].includes(e.text)&&this.effects.length<75){const sprite=this.effectSprite(e.x,e.y,'arc-enemies',FAMILY_ORDER.indexOf(e.text as Family)+(this.world!.up?0:8)).setDisplaySize(size*30,size*30).setAngle(this.world!.up?180:0).setDepth(6);this.effects.push({sprite,age:0,duration:.6,size:size*30,vx:this.world!.up?12:-35,vy:35,spin:4,falling:true});}
 }
 private message(text:string):void{
   const up=!!this.world?.up;
   this.radio.setOrigin(up?0:.5,up?0:.5).setText(text).setPosition(up?582:384,up?264:65).setVisible(true);
   this.messageUntil=this.clock+3.3;
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
