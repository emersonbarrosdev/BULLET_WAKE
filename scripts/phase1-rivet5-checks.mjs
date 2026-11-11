import assert from 'node:assert/strict';
import {runPhase1Review as fullRoutes} from './phase1-final-checks.mjs';

export async function runPhase1Review(api){
 const {send,evaluate,waitFor,shot,report,errors}=api;
 if(process.argv.includes('--audio-only')){
  report.regression.renderedAudio=await evaluate(`(async()=>{
   const meta=await (await fetch('/assets/audio/score.json')).json(),ctx=new AudioContext(),tracks=[];
   for(const name of ['menu','stage1','boss']){
    const response=await fetch('/assets/audio/'+name+'.ogg');if(!response.ok)throw new Error(name+' missing');
    const buffer=await ctx.decodeAudioData(await response.arrayBuffer());let peak=0,squares=0,count=0;
    for(let c=0;c<buffer.numberOfChannels;c++){const samples=buffer.getChannelData(c);for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));squares+=samples[i]*samples[i];count++;}}
    tracks.push({name,seconds:buffer.duration,channels:buffer.numberOfChannels,peakDb:20*Math.log10(peak),rmsDb:10*Math.log10(squares/count),expectedSeconds:meta[name].seconds,guitarSource:meta[name].guitarSource,replyRegister:meta[name].replyRegister});
   }
   await ctx.close();return tracks;
  })()`);
  for(const t of report.regression.renderedAudio){assert.ok(Math.abs(t.seconds-t.expectedSeconds)<.1,'Loop duration '+t.name);assert.equal(t.channels,2);assert.ok(t.peakDb<-.2,'Decoded headroom '+t.name);assert.ok(t.rmsDb>-25&&t.rmsDb<-10,'Music level '+t.name);assert.ok(t.guitarSource.includes('METAL-GTX'));}
  const transport=[];
  for(const [track,method]of [['menu','startMenuMusic'],['stage1','startStageMusic'],['boss','startBossMusic']]){
   await evaluate(`window.__GAME__.registry.get('audio').${method}()`);
   await waitFor(`(()=>{const a=window.__GAME__.registry.get('audio').getStatus();return a.track==='${track}'&&a.voices===1&&!a.musicLoadFailed})()`);
   transport.push(await evaluate(`window.__GAME__.registry.get('audio').getStatus()`));
  }
  report.regression.audioTransport=transport;assert.deepEqual(errors,[]);return;
 }
 const run=code=>evaluate(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
 const start=async(key,data={})=>{
  await evaluate(`(()=>{const g=window.__GAME__,s=g.scene.getScenes(true)[0]??g.scene.getScene('PrototypeScene');s.scene.start('${key}',${JSON.stringify(data)});return true;})()`);
  await waitFor(`window.__GAME__.scene.isActive('${key}')`);
 };
 report.regression.titleContain=[];
 for(const [width,height]of [[1366,768],[1920,1080],[2560,1080],[1280,1024]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await start('TitleScene');await waitFor(`!!document.querySelector('.bw-art-frame')`);
  const box=await evaluate(`(()=>{const b=document.querySelector('.bw-art-frame').getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}})()`);
  assert.ok(box.x>=-.1&&box.y>=-.1&&box.right<=width+.1&&box.bottom<=height+.1,'All title art must fit the viewport');
  report.regression.titleContain.push({width,height,...box});await shot('title-uncropped-'+width);
 }
 report.viewports=[];
 for(const [width,height]of [[1366,768],[1920,1080]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await start('PrototypeScene',{pilotId:'nolan',skipBriefing:true});
  await waitFor(`window.__GAME__.scene.getScene('PrototypeScene').health?.lives===3`);
  await run(`s.scene.pause();s.tweens.getDelta=()=>20;s.director.eventIndex=999;s.director.minibossSpawned=true;return true;`);
  const levels=[];
  for(let level=1;level<=5;level++){
   const result=await run(`s.clearPlayerShots();s.weapons.weaponLevel=${level};s.ship.setPosition(384,365);s.firePrimary();if(${level}>=3)s.fireSecondary();s.advancePlayerShots(130);s.hud.setWeapon('ion',${level},0);return {level:${level},shots:s.shots.length,missiles:s.shots.filter(p=>p.node.texture.key==='review-effects-missile').length,homing:s.shots.filter(p=>p.homing).length,shipWidth:s.ship.hullSprite.displayWidth*s.ship.scaleX,hud:document.querySelector('[data-field="level"]').textContent};`);
   assert.equal(result.shots,[0,1,2,5,8,10][level]);assert.equal(result.missiles,level<3?0:level===5?3:2);assert.equal(result.homing,level===5?3:0);
   assert.ok(result.shipWidth<35,'Aircraft scale should be modest relative to the arena');levels.push(result);await shot('rivet-nv'+level+'-'+width);
  }
  await run(`s.clearPlayerShots();s.director.scrollPx=4600;s.director.minibossSpawned=true;s.director.update(0,384,350);const b=s.director.boss;window.qaTal=b.constructor;b.update(1800,384,350);s.syncBossVisual(b);s.hud.showBossBar(b.name,b.hp,b.maxHp);return true;`);
  const targets=await run(`const b=s.director.boss,gun=b.modules[3],x=b.x+gun.offsetX,y=b.y+gun.offsetY;const crossing=s.bossPartContact(x,b.y+190,x,b.y-190,2.5);const overflight=s.bossPartContact(b.x+28,b.y+190,b.x+28,b.y+120,2.5);const before=b.hp;s.weapons.weaponLevel=1;s.ship.setPosition(x,y+55);s.firePrimary();s.advancePlayerShots(120);return {crossing,overflight,before,after:b.hp,gunHp:gun.hp,unhit:b.modules.filter(m=>m.id!==gun.id).map(m=>m.hp),legacyGuns:s.bossVisual.mounts.some(m=>m.texture.key==='hd-biogun')};`);
  assert.equal(targets.crossing?.moduleId,'battery-left','Shot from below must reach the dorsal gun');assert.equal(targets.overflight,null,'Empty hull must not intercept');assert.ok(targets.after<targets.before,'Actual blue shot must hit the gun');assert.ok(targets.unhit.every(h=>h===100));assert.equal(targets.legacyGuns,false);
  await shot('integrated-shell-'+width);
  const broken=await run(`const b=s.director.boss,m=b.modules[3];b.damage(1000,b.x+m.offsetX,b.y+m.offsetY,m.id);s.syncBossVisual(b);return {destroyed:m.destroyed,scar:s.bossVisual.mounts[3].visible,next:s.bossPartContact(b.x+m.offsetX,b.y+190,b.x+m.offsetX,b.y-190,2.5)?.moduleId};`);
  assert.ok(broken.destroyed&&broken.scar);assert.notEqual(broken.next,'battery-left');await shot('destroyed-anatomical-gun-'+width);
  const guided=await run(`s.clearPlayerShots();s.weapons.weaponLevel=5;s.ship.setPosition(500,380);s.fireSecondary();const p=s.shots[1],before=p.velocityX;s.advancePlayerShots(120);return {before,after:p.velocityX};`);
  assert.ok(guided.after<guided.before,'FULL center missile must steer toward a real live target');
  await run(`s.clearPlayerShots();const b=s.director.boss;b.damageArea(9999);b.update(2400,384,350);s.syncBossVisual(b);s.ship.setPosition(384,370);return true;`);await shot('integrated-inner-'+width);
  await start('PrototypeScene',{pilotId:'harlan',skipBriefing:true});
  await waitFor(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id==='harlan'&&window.__GAME__.scene.getScene('PrototypeScene').health?.lives===3`);
  const laser=await run(`s.scene.pause();s.director.scrollPx=4600;s.director.minibossSpawned=true;s.director.eventIndex=999;s.director.update(0,384,350);const b=s.director.boss;b.update(1800,384,350);s.syncBossVisual(b);const m=b.modules[3];s.ship.setPosition(b.x+m.offsetX,b.y+m.offsetY+80);s.weapons.weaponLevel=4;for(let i=0;i<30;i++)s.updateCrimsonLaser(20,true);return {hp:b.hp,gun:m.hp,events:s.crimsonLaserState.impacts.map(p=>p.targetId)};`);
  assert.ok(laser.hp<600&&laser.gun<100,'The actual wide laser must damage the specific gun its edge touches');await shot('laser-real-anatomical-target-'+width);
  report.viewports.push({width,height,levels,targets,broken,guided,laser});
 }
 // Actual browser gamepad inventory before any virtual-input regression is installed.
 report.regression.physicalGamepads=await evaluate(`Array.from(navigator.getGamepads?.()??[]).filter(Boolean).map(p=>({id:p.id,connected:p.connected,mapping:p.mapping,axes:p.axes.length,buttons:p.buttons.length}))`);
 if(process.argv.includes('--visual-only')){assert.deepEqual(errors,[]);return;}
 process.argv.push('--extra');await fullRoutes(api);
 assert.deepEqual(errors,[]);
}
