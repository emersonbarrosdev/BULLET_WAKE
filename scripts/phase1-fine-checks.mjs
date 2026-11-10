import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';

/** Focused production-browser regression for the defects reported in Phase 1. */
export async function runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors}){
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  const run=code=>evaluate(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
  const capture=async(width,height)=>{
    await pause(70);
    return (await send('Page.captureScreenshot',{format:'png',clip:{x:Math.ceil(width*168/768)+2,y:0,width:Math.floor(width*432/768)-4,height,scale:1}})).data;
  };
  const pixels=async(a,b)=>evaluate(`(async()=>{
    const decode=async data=>{const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);return {data:x.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};};
    const a=await decode(${JSON.stringify(a)}),b=await decode(${JSON.stringify(b)});let diff=0,sum=0,maxRow=0;
    for(let i=0;i<a.data.length;i+=4)for(let c=0;c<3;c++)diff+=Math.abs(a.data[i+c]-b.data[i+c]);
    for(let y=1;y<a.h;y++){let row=0;for(let x=0;x<a.w;x++)for(let c=0;c<3;c++)row+=Math.abs(a.data[(y*a.w+x)*4+c]-a.data[((y-1)*a.w+x)*4+c]);row/=a.w*3;sum+=row;maxRow=Math.max(maxRow,row);}
    return {meanDifference:diff/(a.w*a.h*3),maxRowDelta:maxRow,meanRowDelta:sum/(a.h-1)};
  })()`);
  for(const[width,height]of [[1366,768],[1920,1080]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await click('[data-pilot-index="0"]');await click('[data-action="start"]:not([hidden])');
    await waitFor("window.__GAME__.scene.isActive('PrototypeScene')&&!!document.querySelector('#bw-combat-hud')");
    await run('s.scene.pause();s.director.enemies.length=0;s.syncEnemyVisuals();s.clearEnemyShots();s.clearPlayerShots();s.pickups.clear();s.syncPickupVisuals();');
    const hud=await evaluate(`(()=>{const root=document.querySelector('#bw-combat-hud'),left=root.querySelector('.bw-combat-left'),right=root.querySelector('.bw-combat-right');return {survival:['health','dash','special-stock'].every(n=>left.querySelector('[data-field="'+n+'"]')),offense:['weapon','power','score','progress'].every(n=>right.querySelector('[data-field="'+n+'"]')),bars:root.querySelectorAll('.bw-hull-bar').length,panels:root.querySelectorAll('section').length,fps:!!root.querySelector('[data-field="fps"]'),fits:[...root.querySelectorAll('section,button')].every(n=>{const r=n.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight&&n.scrollWidth<=n.clientWidth+1;}),scroll:document.documentElement.scrollHeight>innerHeight};})()`);
    assert.deepEqual(hud,{survival:true,offense:true,bars:1,panels:5,fps:false,fits:true,scroll:false});
    const alpha=await run(`return ['scout','dart','lancer','cutter','surface','raia'].map(name=>{const t=s.textures.get('review-hostile-'+name),im=t.getSourceImage(),c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);let max=0;for(let f=0;f<4;f++)for(let x=0;x<5;x++)for(let y=0;y<5;y++)for(const[p,q]of [[x,y],[63-x,y],[x,63-y],[63-x,63-y]])max=Math.max(max,ctx.getImageData(f*64+p,q,1,1).data[3]);return {name,cornerMax:max};});`);
    assert.ok(alpha.every(a=>a.cornerMax<=2),JSON.stringify(alpha));
    await run('document.querySelector("#bw-combat-hud").style.visibility="hidden";s.savedVisibility=s.children.list.map(o=>[o,o.visible]);for(const[o]of s.savedVisibility)o.setVisible(false);s.backdrop.water.surface.setVisible(true);s.backdrop.water.elapsedMs=2000;s.backdrop.water.update(959.8,0);');
    const before=await capture(width,height);
    await run('s.backdrop.water.update(960.2,0);');
    const after=await capture(width,height),seam=await pixels(before,after);
    assert.ok(seam.meanDifference<1.2,'Ocean jumps at repeat boundary: '+JSON.stringify(seam));
    assert.ok(seam.maxRowDelta<Math.max(10,seam.meanRowDelta*7),'Horizontal seam: '+JSON.stringify(seam));
    await run('s.backdrop.water.update(960.2,350);');
    const motion=await pixels(after,await capture(width,height));
    assert.ok(motion.meanDifference>.015&&motion.meanDifference<5,'Water must move gently with scroll held fixed: '+JSON.stringify(motion));
    const timing=[];let reference;
    for(const fps of [30,60,120]){
      await run(`s.backdrop.water.elapsedMs=0;for(let i=0;i<${fps};i++)s.backdrop.water.update(800,1000/${fps});`);
      const frame=await capture(width,height);if(!reference)reference=frame;
      const m=await pixels(reference,frame);timing.push({fps,meanDifference:m.meanDifference});assert.ok(m.meanDifference<.02,'Water speed depends on FPS');
    }
    await run('document.querySelector("#bw-combat-hud").style.visibility="visible";for(const[o,v]of s.savedVisibility)o.setVisible(v);s.backdrop.update(0,0);s.firePrimary();for(let i=0;i<7;i++)s.advancePlayerShots(16.667);');
    await shot(`muzzle-${width}x${height}`);
    await run(`s.clearPlayerShots();for(const[i,kind]of ['scout','dart','lancer','cutter','surface','raia','talassarca'].entries())for(let j=0;j<3;j++)s.spawnEnemyShot({kind,x:210+i*55,y:100+j*65,velocityX:0,velocityY:150});`);
    await shot(`hostile-alpha-${width}x${height}`);
    const contact=await run(`s.clearEnemyShots();s.health.hp=100;s.health.invulnerableMs=0;s.weapons.hasShield=false;s.spawnEnemyShot({kind:'scout',x:s.ship.x,y:s.ship.y-60,velocityX:0,velocityY:2200});s.advanceEnemyShots(50);const damaged=s.health.hp;s.spawnEnemyShot({kind:'scout',x:s.ship.x,y:s.ship.y-60,velocityX:0,velocityY:2200});s.advanceEnemyShots(50);return {damaged,afterInvulnerable:s.health.hp,remaining:s.enemyShots.length};`);
    assert.deepEqual(contact,{damaged:82,afterInvulnerable:82,remaining:0});
    const pickup=await run(`s.health.hp=40;s.pickups.spawn('health',s.ship.x,s.ship.y-22);s.checkPickupCollisions();const first=s.health.hp;s.checkPickupCollisions();return {first,second:s.health.hp,marked:s.pickups.pickups[0].collected};`);
    assert.deepEqual(pickup,{first:70,second:70,marked:true});
    await run(`s.pickups.clear();s.syncPickupVisuals();s.playEffect('explosion',384,200);s.scene.resume();`);
    await pause(65);await run('s.scene.pause();');await shot(`fire-explosion-${width}x${height}`);await run('s.scene.resume();');await pause(450);await run('s.scene.pause();');
    const cleanup=await run(`return {particles:s.particles.activeCount,explosions:s.children.list.filter(n=>n.type==='Sprite'&&n.texture.key==='polish-explosion').length};`);
    assert.deepEqual(cleanup,{particles:0,explosions:0});
    await run(`s.backdrop.update(4250,0);s.hud.setSector('aproximacao');s.health.invulnerableMs=999999;`);
    await shot(`rift-${width}x${height}`);
    report.viewports.push({width,height,hud,alpha,seam,motion,timing,contact,pickup,cleanup});
    // The scene is deliberately frozen for pixel comparisons; use the result-dialog
    // navigation path, whose input listener does not depend on a live scene update.
    await run('s.health.invulnerableMs=0;s.weapons.specialActiveMs=0;s.damageShip(100);');
    await waitFor("!!document.querySelector('.bw-result-defeat')");await key('Escape','Escape',27);
    await waitFor("!!document.querySelector('.bw-pilot-card')");
  }
  const source=ts.transpileModule(readFileSync('src/game/audio/audioSystem.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /gm,'');
  await evaluate(`(()=>{${source};globalThis.QAAudio=AudioSystem;})()`);
  report.audio=await evaluate(`(async()=>{
    const render=async(method,args=[],repeat=1)=>{
      const offline=new OfflineAudioContext(1,44100*.8,44100),original=window.AudioContext;
      let oscillators=0;const createOscillator=offline.createOscillator.bind(offline);
      offline.createOscillator=()=>{oscillators++;return createOscillator();};
      let audio;try{window.AudioContext=function(){return offline;};audio=new QAAudio();audio.unlock();}finally{window.AudioContext=original;}
      if(method==='mix'){
        audio.playShot('nolan',4);audio.playEnemyShot('talassarca');audio.playExplosion(true);audio.playHit('hull');audio.playPickup('upgrade');audio.playSpecial('prism');
      }else for(let i=0;i<repeat;i++)audio[method](...args);
      const data=(await offline.startRendering()).getChannelData(0);let peak=0,energy=0,tail=0,hash=0;
      for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));energy+=data[i]*data[i];if(i>22050)tail+=data[i]*data[i];hash=(Math.imul(hash,31)+Math.round(data[i]*1000000))|0;}
      return {peak,rms:Math.sqrt(energy/data.length),tailRms:Math.sqrt(tail/13230),hash,oscillators};
    };
    const voices={};for(const kind of ['scout','dart','lancer','cutter','surface','raia','talassarca'])voices[kind]=await render('playEnemyShot',[kind]);
    const human=await render('playShot',['nolan',1]),salvo=await render('playEnemyShot',['scout'],24);
    const events={};for(const target of ['alien','hull','shield'])events['hit-'+target]=await render('playHit',[target]);
    for(const type of ['power','health','special','upgrade','weapon_green','weapon_red'])events['pickup-'+type]=await render('playPickup',[type]);
    events.explosion=await render('playExplosion',[false]);events.largeExplosion=await render('playExplosion',[true]);
    return {voices,human,salvo,events,mix:await render('mix')};
  })()`);
  const all=[...Object.values(report.audio.voices),report.audio.human,...Object.values(report.audio.events)];
  assert.ok(all.every(a=>a.peak>.001&&a.peak<.98&&a.rms>0&&a.tailRms<.00001),JSON.stringify(report.audio));
  assert.equal(new Set([...Object.values(report.audio.voices),report.audio.human].map(a=>a.hash)).size,8,'Alien voices must differ from each other and RIVET');
  assert.equal(report.audio.salvo.oscillators,2,'A salvo must create one carrier/modulator voice, not 24');
  assert.ok(Math.abs(report.audio.salvo.rms-report.audio.voices.scout.rms)<.00001,'A salvo must not increase playback energy');
  assert.equal(new Set(Object.values(report.audio.events).map(a=>a.hash)).size,Object.keys(report.audio.events).length,'Feedback events must sound distinct');
  assert.ok(report.audio.mix.peak<.98&&report.audio.mix.rms>0,'Busy combat mix clips or is silent');
  assert.deepEqual(errors,[]);
  writeFileSync('docs/screenshots/phase1-fine/validation.json',JSON.stringify(report,null,2)+'\n');
  console.log('PASS: clean hostile alpha, compact HUD groups, continuous ocean across wrap and frame rates, swept nose contact, once-only physical repair, fiery effects cleaned within 500ms, distinct offline-rendered audio and salvo limiting; both resolutions; zero browser errors.');
}
