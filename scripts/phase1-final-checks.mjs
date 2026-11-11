import assert from 'node:assert/strict';
import {runPhase1Review as hangar} from './phase1-hangar-checks.mjs';

export async function runPhase1Review(api){
 if(!process.argv.includes('--extra')&&!process.argv.includes('--water-only'))await hangar(api);
 const {evaluate,waitFor,shot,report}=api;
 const run=code=>evaluate(`(async()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
 async function restart(id='nolan'){
  await evaluate(`(()=>{const game=window.__GAME__,active=game.scene.getScenes(true)[0]??game.scene.getScene('PrototypeScene');active.scene.start('PrototypeScene',{pilotId:'${id}',skipBriefing:true});return true;})()`);
  await waitFor(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');return s.scene.isActive()&&s.health.lives===3&&s.pilot.id==='${id}'})()`);
  await run('s.scene.pause();s.tweens.getDelta=()=>20;return true;');
 }
 if(process.argv.includes('--water-only')){
  assert.equal(report.viewports.length,2);assert.equal(report.regression.fullRoutes.length,6);
  assert.ok(report.regression.fullRoutes.every(r=>r.completed),'Cached full routes must have finished');
  assert.equal(report.regression.specialImpact.length,4);assert.equal(report.regression.virtualGamepad.paused,true);
  assert.equal(report.regression.musicPause.resumed.voices,1);
  await api.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await restart();await run(`s.backdrop.update(3900,0);return true;`);await shot('water-fixed-scroll-before');
  report.regression.water=await run(`const w=s.backdrop.water,before=w.elapsedMs;for(let i=0;i<100;i++)s.backdrop.update(3900,20);return {before,after:w.elapsedMs,scroll:w.scrollPx};`);
  await shot('water-fixed-scroll-after');assert.ok(Math.abs(report.regression.water.after-report.regression.water.before-2000)<1e-6,'Water advances independently of scroll');assert.equal(report.regression.water.scroll,3900);
  report.regression.waterRetest='Floating-point tolerance corrected; previous desktop/route/Continue/audio/gamepad results retained.';return;
 }
 await restart();
 await run(`s.director.scrollPx=4600;s.director.eventIndex=999;s.director.minibossSpawned=true;s.director.update(0,384,350);window.qaTal=s.director.boss.constructor;return true;`);
 report.regression.silhouettes=await run(`
  const textureKeys=['hd-rivet','hd-moth','hd-kestrel','hd-knuckle','hd-peregrine'];
  return textureKeys.map(key=>{const f=s.textures.get(key).get(0);return {key,width:f.width,height:f.height,frames:s.textures.get(key).frameTotal-1};});
 `);assert.ok(report.regression.silhouettes.every(s=>s.frames===4),JSON.stringify(report.regression.silhouettes));
 report.regression.specialImpact=[];
 for(const [id,type]of [['lyra','orbital'],['bento','comet'],['cora','phantom'],['harlan','nova']]){
  await restart(id);
  const trace=await run(`
   const b=new window.qaTal();b.update(1800,384,350);s.director.boss=b;s.director.scrollPx=4600;s.director.minibossSpawned=true;s.director.minibossActive=false;s.director.eventIndex=999;s.syncBossVisual(b);
   s.triggerSpecial();const immediate=b.hp;let first=null;const hp=[];
   for(let t=0;t<2900;t+=20){s.sys.step(s.time.now+20,20);if(b.hp<immediate&&first===null)first=t+20;hp.push(b.hp);}
   return {id:s.pilot.id,type:s.weapons.specialType,immediate,firstMs:first,damage:600-b.hp};
  `);console.log(JSON.stringify({specialTrace:trace}));assert.equal(trace.immediate,600);assert.ok(trace.firstMs>=100,'Damage must wait for visual impact: '+JSON.stringify(trace));assert.equal(trace.damage,120);report.regression.specialImpact.push(trace);
  await shot('special-'+id);
 }
 await restart();
 await run(`const b=new window.qaTal();b.update(1800,384,350);b.damageArea(600);b.update(1250,384,350);s.director.boss=b;s.syncBossVisual(b);return true;`);await shot('metamorphosis-shell-opening');
 report.regression.fullRoutes=[];
 for(const [id,skipP]of [['nolan',0],['cora',0],['lyra',0],['harlan',0],['bento',0],['nolan',3]]){
  await restart(id);
  const route=await run(`
   const original=s.inputManager.sample,base=original.call(s.inputManager,s.ship.x,s.ship.y);
   const skipped=new Set(),picked=new Set(),pickedTypes={};let supplies=0,peakEnemies=0,peakBullets=0,elapsed=0;const costs=[],levels=[],deaths=[];
   const originalCollection=s.checkPickupCollisions.bind(s);
   s.checkPickupCollisions=function(){const before=new Map(s.pickups.pickups.filter(p=>!p.collected).map(p=>[p.id,p.type]));originalCollection();for(const p of s.pickups.pickups)if(p.collected&&before.has(p.id)&&!picked.has(p.id)){picked.add(p.id);pickedTypes[p.type]=(pickedTypes[p.type]??0)+1;supplies++;}};
   s.inputManager.sample=()=>{
    let goalX=384+Math.sin(elapsed/3700)*100,goalY=350;
    const items=s.pickups.pickups.filter(p=>!p.collected);
    for(const p of items)if(p.type==='power'&&!p.recovery&&skipped.size<${skipP}&&!picked.has(p.id))skipped.add(p.id);
    const item=items.filter(p=>!skipped.has(p.id)&&p.y>145).sort((a,b)=>Math.hypot(a.x-s.ship.x,a.y-s.ship.y)-Math.hypot(b.x-s.ship.x,b.y-s.ship.y))[0];
    const cargo=s.director.enemies.find(e=>e.carrier);
    if(item){goalX=item.x;goalY=item.y+3;}else if(cargo){goalX=cargo.x;goalY=Math.max(280,cargo.y+130);}else if(s.director.boss){goalX=s.director.boss.x;goalY=s.director.boss.name==='TALASSARCA'?370:330;}
    let best=null;const speed=s.pilot.speed*.9;
    for(let i=-1;i<16;i++){
      const x=i<0?0:Math.cos(i*Math.PI/8),y=i<0?0:Math.sin(i*Math.PI/8),vx=x*speed,vy=y*speed;
      const nx=s.ship.x+vx*.22,ny=s.ship.y+vy*.22;
      if(nx<192||nx>576||ny<38||ny>400)continue;
      let score=Math.hypot(nx-goalX,ny-goalY);
      for(const shot of s.enemyShots){const dx=shot.node.x-s.ship.x,dy=shot.node.y-s.ship.y,rx=shot.velocityX-vx,ry=shot.velocityY-vy;
       const t=Math.max(0,Math.min(.52,-(dx*rx+dy*ry)/Math.max(1,rx*rx+ry*ry))),d=Math.hypot(dx+rx*t,dy+ry*t);
       score+=Math.max(0,30-d)*130+Math.max(0,60-d)*.8;
      }
      for(const e of s.director.enemies)if(!e.layer){const d=Math.hypot(nx-e.x,ny-e.y);score+=Math.max(0,(e.carrier?44:34)-d)*170;}
      for(const p of items)if(skipped.has(p.id))score+=Math.max(0,40-Math.hypot(nx-p.x,ny-p.y))*220;
      if(!best||score<best.score)best={x,y,score};
    }
    const close=s.enemyShots.filter(p=>Math.hypot(p.node.x-s.ship.x,p.node.y-s.ship.y)<85).length;
    const special=s.weapons.specialCharges>0&&s.weapons.specialActiveMs===0&&(close>=4||(s.director.boss&&s.director.boss.phase!=='intro'&&elapsed%14000<30));
    return {...base,moveX:best?.x??0,moveY:best?.y??0,firePrimary:true,firePrimaryTap:false,special:!!special,menuOrBack:false};
   };
   let life=s.health.lives,level=s.weapons.weaponLevel;
   for(;elapsed<420000&&!s.health.gameOver&&!s.completed;elapsed+=20){
    const start=performance.now();s.sys.step(s.time.now+20,20);costs.push(performance.now()-start);
    peakEnemies=Math.max(peakEnemies,s.director.enemies.length);peakBullets=Math.max(peakBullets,s.enemyShots.length);
    if(s.health.lives<life)deaths.push(elapsed/1000);life=s.health.lives;
    if(s.weapons.weaponLevel!==level){level=s.weapons.weaponLevel;levels.push({seconds:elapsed/1000,level});}
    if(elapsed%20000===0)await new Promise(r=>setTimeout(r,0));
   }
   s.inputManager.sample=original;s.checkPickupCollisions=originalCollection;costs.sort((a,b)=>a-b);
   return {pilot:s.pilot.name,skipPolicy:${skipP},actuallySkipped:[...skipped].filter(id=>!picked.has(id)).length,seconds:elapsed/1000,completed:s.completed,gameOver:s.health.gameOver,lives:s.health.lives,level:s.weapons.weaponLevel,powerMeter:s.weapons.powerMeter,collected:supplies,pickedTypes,kills:s.totalKills,levels,deaths,peakEnemies,peakBullets,updateP95Ms:costs[Math.floor(costs.length*.95)]};
  `);report.regression.fullRoutes.push(route);console.log(JSON.stringify({fullRoute:route}));await shot('route-'+id+'-skip'+skipP);
 }
 // Record outcomes honestly; an automated route is a stress test, not a human Normal-difficulty approval.
 assert.ok(report.regression.fullRoutes.every(r=>r.peakBullets<=84));
 await restart();
 const beforeContinue=await run(`const original=s.inputManager.sample,base=original.call(s.inputManager,s.ship.x,s.ship.y);s.inputManager.sample=()=>({...base,moveX:0,moveY:0,firePrimary:true,menuOrBack:false});for(let t=0;t<90000&&!s.health.gameOver;t+=20)s.sys.step(s.time.now+20,20);s.inputManager.sample=original;return {deaths:s.radio.deaths,gameOver:s.health.gameOver,special:s.weapons.specialCharges};`);
 assert.equal(beforeContinue.gameOver,true);await run(`s.continueFromCheckpoint();return true;`);
 await waitFor(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');return s.health.lives===3&&!s.health.gameOver})()`);
 const afterContinue=await run(`s.scene.pause();return {deaths:s.radio.deaths,lives:s.health.lives,special:s.weapons.specialCharges};`);
 assert.equal(afterContinue.deaths,beforeContinue.deaths);assert.equal(afterContinue.special,beforeContinue.special);
 report.regression.continue={before:beforeContinue,after:afterContinue};
 await restart();
 report.regression.virtualGamepad=await run(`
  const original=Object.getOwnPropertyDescriptor(navigator,'getGamepads');
  const pad={id:'Xbox Standard QA',connected:true,index:0,mapping:'standard',axes:[1,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
  const before=s.ship.x;pad.buttons[0]={pressed:true,value:1};for(let i=0;i<10;i++)s.sys.step(s.time.now+20,20);
  const moved=s.ship.x-before,shots=s.shots.length;pad.axes=[0,0];pad.buttons[2]={pressed:true,value:1};s.sys.step(s.time.now+20,20);
  const stock=s.weapons.specialCharges;pad.buttons[9]={pressed:true,value:1};s.sys.step(s.time.now+20,20);
  const pauseDialog=!!document.querySelector('.bw-pause');pad.buttons=pad.buttons.map(()=>({pressed:false,value:0}));
  if(original)Object.defineProperty(navigator,'getGamepads',original);else delete navigator.getGamepads;
  return {moved,shots,stock,pauseDialog,physicalController:false};
 `);assert.ok(report.regression.virtualGamepad.moved>0,'Standard stick must move');assert.ok(report.regression.virtualGamepad.shots>0,'South must fire');assert.equal(report.regression.virtualGamepad.stock,1);assert.equal(report.regression.virtualGamepad.pauseDialog,true);
 await waitFor(`window.__GAME__.scene.isPaused('PrototypeScene')`);report.regression.virtualGamepad.paused=true;
 await api.click('[data-brief-action="0"]');await new Promise(r=>setTimeout(r,250));
 const music=await run(`const audio=window.__GAME__.registry.get('audio');audio.pauseMusic();const before=audio.getStatus();await new Promise(r=>setTimeout(r,350));const frozen=audio.getStatus();audio.resumeMusic();await new Promise(r=>setTimeout(r,100));return {before,frozen,resumed:audio.getStatus()};`);
 assert.ok(Math.abs(music.before.position-music.frozen.position)<.02,'Music advances while paused');assert.ok(music.resumed.position>=music.before.position);assert.equal(music.resumed.voices,1);report.regression.musicPause=music;
 await run(`s.scene.pause();s.backdrop.update(3900,0);return true;`);await shot('water-fixed-scroll-before');
 report.regression.water=await run(`const w=s.backdrop.water,before=w.elapsedMs;for(let i=0;i<100;i++)s.backdrop.update(3900,20);return {before,after:w.elapsedMs,scroll:w.scrollPx};`);
 await shot('water-fixed-scroll-after');assert.ok(Math.abs(report.regression.water.after-report.regression.water.before-2000)<1e-6,'Water advances independently of scroll');assert.equal(report.regression.water.scroll,3900);
}
