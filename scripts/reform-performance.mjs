import assert from 'node:assert/strict';

export async function runReformPerformance({send,evaluate,waitFor,shot,report,errors}){
 await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await evaluate(`(()=>{const g=window.__GAME__;(g.scene.getScenes(true)[0]??g.scene.getScene('PrototypeScene')).scene.start('PrototypeScene',{pilotId:'nolan',skipBriefing:true});return true;})()`);
 await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')`);
 report.regression.physicalGamepadInventory=await evaluate(`window.__QA_REAL_GAMEPADS__?.()??[]`);
 report.regression.audioTracks=[];
 for(const [track,method]of [['menu','startMenuMusic'],['stage1','startStageMusic'],['boss','startBossMusic'],['victory','startVictoryMusic']]){
  await evaluate(`window.__GAME__.registry.get('audio').${method}()`);
  await waitFor(`(()=>{const a=window.__GAME__.registry.get('audio').getStatus();return a.track==='${track}'&&a.voices===1&&!a.musicLoadFailed})()`);
  const state=await evaluate(`(async()=>{const a=window.__GAME__.registry.get('audio'),b=await a.transport.buffers.get('${track}');return {status:a.getStatus(),seconds:b.duration,loop:a.transport.source.loop};})()`);
  assert.equal(state.status.voices,1);assert.equal(state.loop,track!=='victory');report.regression.audioTracks.push({track,...state});
 }
 report.regression.pause=await evaluate(`(async()=>{const a=window.__GAME__.registry.get('audio');a.startStageMusic();await new Promise(r=>setTimeout(r,150));a.pauseMusic();const before=a.getStatus().position;await new Promise(r=>setTimeout(r,350));const after=a.getStatus().position;a.resumeMusic();return {before,after};})()`);
 assert.ok(Math.abs(report.regression.pause.before-report.regression.pause.after)<.02);
 // This is an explicitly constructed render-load fixture, not a balance/clear-time measurement.
 const fixture=await evaluate(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');s.director.minibossSpawned=true;s.director.scrollPx=4600;s.director.backgroundScrollPx=4800;s.director.eventIndex=999;s.director.enemies.splice(0);s.director.update(0,384,350);const b=s.director.boss;b.update(1800,384,350);b.damageArea(600);b.update(1000,384,350);b.update(5000,384,350);b.update(1800,384,350);s.weapons.weaponLevel=5;s.health.invulnerableMs=1e9;s.ship.setPosition(384,375);const sample=s.inputManager.sample.bind(s.inputManager),base=sample();s.inputManager.sample=()=>({...base,moveX:Math.sin(s.time.now/1400)*.35,moveY:0,firePrimary:true,firePrimaryTap:false,special:false,menuOrBack:false});s.applyBossDamage=()=>{};s.time.addEvent({delay:240,loop:true,callback:()=>s.playEffect('explosion',340+Math.sin(s.time.now/700)*80,180,.6)});s.time.delayedCall(2000,()=>s.triggerSpecial());return {size:{width:s.game.canvas.width,height:s.game.canvas.height},fixture:'FULL RIVET, fixed inner boss, protection and boss damage disabled solely to sustain render load'};})()`);
 await new Promise(r=>setTimeout(r,1800));
 const timing=await evaluate(`(async()=>{
  const s=window.__GAME__.scene.getScene('PrototypeScene'),audio=s.registry.get('audio'),ctx=audio.ctx;
  const analyser=ctx.createAnalyser();analyser.fftSize=2048;audio.masterGain.connect(analyser);const samples=new Float32Array(2048);
  const intervals=[],updates=[];let last=performance.now(),start=last,peak=0,maxShots=0,maxParticles=0,maxPool=0,maxSfx=0;
  const original=s.sys.sceneUpdate;s.sys.sceneUpdate=function(time,dt){const begin=performance.now();original.call(s,time,dt);updates.push(performance.now()-begin);};
  await new Promise(resolve=>{const frame=now=>{
    intervals.push(now-last);last=now;analyser.getFloatTimeDomainData(samples);for(const v of samples)peak=Math.max(peak,Math.abs(v));
    maxShots=Math.max(maxShots,s.shots.length+s.enemyShots.length);maxParticles=Math.max(maxParticles,s.particles.activeCount);maxPool=Math.max(maxPool,s.projectilePool.length);maxSfx=Math.max(maxSfx,audio.getStatus().sfxVoices);
    if(now-start<8000)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});
  s.sys.sceneUpdate=original;audio.masterGain.disconnect(analyser);analyser.disconnect();s.scene.pause();
  const sorted=[...intervals].sort((a,b)=>a-b),u=[...updates].sort((a,b)=>a-b),gl=s.game.renderer.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {browser:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),durationMs:last-start,frames:intervals.length,averageFps:intervals.length*1000/(last-start),frameMedianMs:sorted[Math.floor(sorted.length*.5)],frameP95Ms:sorted[Math.floor(sorted.length*.95)],updateP95Ms:u[Math.floor(u.length*.95)],maxShots,maxParticles,maxPool,maxSfx,preLimiterPeak:peak,canvas:{width:s.game.canvas.width,height:s.game.canvas.height}};
 })()`);
 assert.ok(timing.frames>10);assert.ok(timing.maxParticles<=120&&timing.maxPool<=128);assert.ok(Number.isFinite(timing.preLimiterPeak));
 report.regression.performance={...fixture,...timing};await shot('render-load-1920');
 report.regression.audioCleanup=await evaluate(`(()=>{const a=window.__GAME__.registry.get('audio');a.playSpecial('scarlet');const active=a.getStatus().sfxVoices;a.stopCombatEffects();return {active,after:a.getStatus().sfxVoices};})()`);
 assert.ok(report.regression.audioCleanup.active>0);assert.equal(report.regression.audioCleanup.after,0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({performance:report.regression.performance}));
}
