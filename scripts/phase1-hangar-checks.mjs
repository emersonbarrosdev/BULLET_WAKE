import assert from 'node:assert/strict';
export async function runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors}){
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const run=code=>evaluate(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
 const select=async(index)=>{
  await click(`[data-pilot-index="${index}"]`);await click('[data-action="start"]:not([hidden])');
  await waitFor(`!!document.querySelector('.bw-mission-select')`);
  await waitFor(`document.querySelector('.bw-mission-story img')?.complete&&document.querySelector('.bw-mission-story img')?.naturalWidth>0`);await shot('personal-mission-'+index+'-'+(await evaluate('innerWidth')));
  assert.ok(!(await evaluate(`document.body.innerText`)).includes('PRONTO PARA DECOLAR'));
  await click('[data-mission-action="launch"]');
  await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')&&!document.querySelector('.bw-loading')&&!document.querySelector('.bw-briefing')`);
  await pause(120);
 };
 for(const [width,height]of [[1366,768],[1920,1080]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate(`document.querySelectorAll('.bw-pilot-card').length`),5);await shot('five-owned-weapons-'+width);
  const profiles=[];for(let i=0;i<5;i++){await click('[data-profile-index="'+i+'"]');const profile=await evaluate(`(()=>{const r=document.querySelector('#bw-pilot-select'),p=r.querySelector('.bw-pilot-profile');return {scroll:r.scrollHeight>innerHeight,clipped:p.getBoundingClientRect().bottom>innerHeight,name:p.querySelector('h2').textContent}})()`);assert.equal(profile.scroll,false);assert.equal(profile.clipped,false);profiles.push(profile);await shot('profile-'+i+'-'+width);await click('[data-action="cards"]');}
  await select(0);
  const layout=await run(`return {lives:s.health.lives,special:s.weapons.specialCharges,family:s.weapons.weaponFamily,hud:document.querySelector('#bw-combat-hud').innerText,lifeIcons:document.querySelectorAll('[data-field="lives"] i').length,specialIcons:document.querySelectorAll('[data-field="special-stock"] i').length};`);
  assert.equal(layout.lives,3);assert.equal(layout.special,2);assert.equal(layout.family,'ion');assert.equal(layout.lifeIcons,5);assert.equal(layout.specialIcons,5);assert.ok(!layout.hud.includes('ESCUDO'));
  await run(`s.health.invulnerableMs=999999;s.director.enemies.length=0;s.syncEnemyVisuals();s.weapons.weaponLevel=3;`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await pause(550);
  await shot('flat-rivet-dense-shot-'+width);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
  const shooting=await run(`s.scene.pause();return {rotation:s.ship.rotation,missileCooldown:s.weapons.missileCooldownMs,shots:s.shots.length};`);assert.equal(shooting.rotation,0);assert.ok(shooting.missileCooldown>0);
  const caps=await run(`
    s.clearEnemyShots();s.clearPlayerShots();s.pickups.clear();s.weapons.specialActiveMs=0;
    for(let i=0;i<5;i++){s.pickups.spawn('life',s.ship.x,s.ship.y);s.checkPickupCollisions();}
    for(let i=0;i<7;i++){s.pickups.spawn('special',s.ship.x,s.ship.y);s.checkPickupCollisions();}
    s.hud.setScore(s.scoreCombo.score);return {lives:s.health.lives,special:s.weapons.specialCharges,score:s.scoreCombo.score};
  `);assert.equal(caps.lives,5);assert.equal(caps.special,5);assert.ok(caps.score>=15000);
  const radio=await run(`s.health.invulnerableMs=0;s.damageShip(1);const a=s.radio.message;s.health.invulnerableMs=0;s.damageShip(1);const b=s.radio.message;s.hud.setRadio(b,true);return {first:a,second:b,lives:s.health.lives};`);assert.notEqual(radio.first,radio.second);assert.equal(radio.lives,3);
  await shot('radio-five-stocks-'+width);
  const boss=await run(`
    s.director.enemies.length=0;s.syncEnemyVisuals();s.director.boss=null;s.director.minibossSpawned=false;s.director.scrollPx=1800;s.director.update(0,384,350);window.qaMini=s.director.boss.constructor;s.director.boss=null;s.director.minibossSpawned=true;s.director.minibossActive=false;s.director.scrollPx=4600;s.director.eventIndex=999;s.director.update(0,384,350);
    const b=s.director.boss;window.qaTal=b.constructor;b.update(1800,384,350);b.isTelegraphing=true;s.syncBossVisual(b);s.hud.showBossBar(b.name,b.hp,b.maxHp);s.ship.setPosition(384,365);
    return {modules:b.modules.length,weapons:b.modules.filter(m=>m.kind==='weapon').length};
  `);assert.equal(boss.modules,6);assert.equal(boss.weapons,3);await shot('biomechanical-batteries-'+width);
  const part=await run(`const b=s.director.boss,m=b.modules[3];const before=b.hp;s.applyBossDamage(m.hp,b.x+m.offsetX,b.y+m.offsetY);s.syncBossVisual(b);return {destroyed:m.destroyed,hp:b.hp,before,visible:s.bossVisual.mounts[3].visible};`);assert.equal(part.destroyed,true);assert.equal(part.visible,true);assert.ok(part.hp<part.before);
  await run(`s.health.invulnerableMs=999999;s.explodeLayers(384,220,90,410,230,true);s.scene.resume();`);await pause(420);await shot('layered-explosions-'+width);
  await key('Escape','Escape',27);await waitFor(`!!document.querySelector('.bw-pause')`);
  const frozen=await run(`return s.director.scrollPx;`);await pause(200);assert.equal(await run(`return s.director.scrollPx;`),frozen);
  const pauseView=await evaluate(`(()=>{const root=document.querySelector('.bw-pause'),p=root.querySelector('.bw-brief-panel');return {labels:[...root.querySelectorAll('button')].map(b=>b.textContent),width:p.getBoundingClientRect().width,background:getComputedStyle(root).backgroundColor}})()`);
  assert.deepEqual(pauseView.labels,['CONTINUAR','CONTROLES','VOLTAR AO MENU']);assert.ok(pauseView.width<=400);assert.ok(pauseView.background.startsWith('rgba'));await shot('transparent-pause-'+width);
  await click('[data-brief-action="1"]');assert.equal(await evaluate(`document.querySelectorAll('.bw-pause').length`),1);assert.equal(await evaluate(`document.querySelectorAll('.bw-pause kbd').length`),4);await shot('compact-controls-'+width);
  await click('[data-brief-action="0"]');await click('[data-brief-action="2"]');assert.ok((await evaluate(`document.querySelector('.bw-pause').innerText`)).includes('perde o progresso'));await shot('confirm-exit-'+width);
  await click('[data-brief-action="0"]');assert.ok(await evaluate(`!!document.querySelector('.bw-pause')`));
  await click('[data-brief-action="0"]');await pause(100);assert.ok(await evaluate(`window.__GAME__.scene.isActive('PrototypeScene')`));assert.equal(await evaluate(`window.__GAME__.registry.get('audio').getStatus().track`),'boss');
  await key('Escape','Escape',27);await waitFor(`!!document.querySelector('.bw-pause')`);await click('[data-brief-action="2"]');await click('[data-brief-action="1"]');await waitFor(`!!document.querySelector('.bw-press-activation')`);
  await click('.bw-press-activation');await click('[data-action="pilots"]');await waitFor(`!!document.querySelector('.bw-pilot-card')`);
  const owners=[];
  for(const [index,id,family]of [[0,'nolan','ion'],[1,'cora','green'],[2,'lyra','ion'],[3,'harlan','red'],[4,'bento','ion']]){
   await select(index);
   const owner=await run(`s.scene.pause();return {id:s.pilot.id,family:s.weapons.weaponFamily,level:s.weapons.weaponLevel};`);assert.equal(owner.id,id);assert.equal(owner.family,family);assert.equal(owner.level,1);owners.push(owner);
   const ttks=await run(`
    const fx=s.playEffect;s.playEffect=()=>{};const results=[];s.completed=false;s.health.gameOver=false;
    for(const [bossName,level] of [['raia',2],['talassarca',2],['talassarca',3]]){
      s.clearPlayerShots();s.clearEnemyShots();s.director.enemies.length=0;s.syncEnemyVisuals();
      s.director.boss=new (bossName==='raia'?window.qaMini:window.qaTal)();s.weapons.weaponLevel=level;s.weapons.specialActiveMs=0;s.ship.setPosition(384,380);
      let elapsed=0,cooldown=0,missile=0;
      for(;elapsed<180000;elapsed+=20){const b=s.director.boss;b.update(20,384,380);s.syncBossVisual(b);
        if(bossName==='talassarca'){const m=b.modules.filter(m=>!m.destroyed).sort((a,b)=>b.offsetY-a.offsetY)[0];if(m)s.ship.setPosition(b.x+m.offsetX,Math.min(390,b.y+m.offsetY+85));}
        if(s.weapons.weaponFamily==='red')s.updateCrimsonLaser(20,true);
        else{cooldown-=20;if(cooldown<=0){s.firePrimary();cooldown+=(s.weapons.weaponFamily==='green'?180:160)*8/s.pilot.shotsPerSecond;}s.advancePlayerShots(20);}
        if(s.pilot.id==='nolan'&&level>=3){missile-=20;if(missile<=0){s.fireSecondary();missile=1500;}}
        if(b.phase==='defeated')break;
      }
      results.push({boss:bossName,level,seconds:elapsed/1000,defeated:s.director.boss.phase==='defeated'});
    }
    s.playEffect=fx;s.clearPlayerShots();s.crimsonLaserRenderer.clear();s.director.boss=null;return results;
   `);assert.ok(ttks.every(t=>t.defeated),'Owned weapons must defeat both boss layers without specials');owner.ttks=ttks;console.log(JSON.stringify({width,id,ttks}));
   await run(`s.weapons.weaponLevel=3;s.health.invulnerableMs=999999;if(s.weapons.weaponFamily==='red')s.updateCrimsonLaser(300,true);else{s.firePrimary();s.advancePlayerShots(100);}s.hud.setWeapon(s.weapons.weaponFamily,3,0);`);await shot('owned-'+id+'-'+width);
   if(id==='bento'){await run(`s.weapons.specialActiveMs=0;s.triggerSpecial();s.scene.resume();`);await pause(500);await shot('bento-special-'+width);}
   await evaluate(`(()=>{window.__GAME__.scene.getScene('PrototypeScene').scene.start('EndingScene',{pilotId:'${id}',score:12345,stageNumber:1});return true;})()`);await waitFor(`!!document.querySelector('.bw-ending')`);assert.ok(!(await evaluate(`document.querySelector('.bw-ending').innerText`)).includes('UM CAMINHO PARA CASA'));await shot('personal-aftermath-'+id+'-'+width);
   await evaluate(`(()=>{window.__GAME__.scene.getScene('EndingScene').scene.start('PilotSelectScene');return true;})()`);await waitFor(`!!document.querySelector('.bw-pilot-card')`);
  }
  const audio=await evaluate(`(async()=>{const a=window.__GAME__.registry.get('audio');a.setEnvironment('space');a.playShot('nolan');a.startStageMusic();a.setMute(false);await new Promise(r=>setTimeout(r,100));const silent=a.getStatus();a.setEnvironment('atmosphere');a.startMenuMusic();return {silent,menu:a.getStatus()}})()`);assert.equal(audio.silent.master,0);assert.equal(audio.silent.track,'none');assert.equal(audio.silent.voices,0);assert.equal(audio.menu.track,'menu');await waitFor(`window.__GAME__.registry.get('audio').getStatus().voices===1`);assert.equal(await evaluate(`window.__GAME__.registry.get('audio').getStatus().musicLoadFailed`),false);
  assert.ok(await evaluate(`document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth`));
  report.viewports.push({width,height,layout,profiles,shooting,caps,radio,boss,part,pauseView,owners,audio});
 }
 await select(0);await run('s.scene.pause();');
 const camping=await run(`const sample=s.inputManager.sample,commands=sample.call(s.inputManager,s.ship.x,s.ship.y);s.inputManager.sample=()=>({...commands,moveX:0,moveY:0,firePrimary:true,firePrimaryTap:false,special:false,menuOrBack:false});let elapsed=0,peakEnemies=0,peakShots=0;const costs=[];for(;elapsed<90000&&!s.health.gameOver;elapsed+=20){const start=performance.now();s.sys.step(s.time.now+20,20);costs.push(performance.now()-start);peakEnemies=Math.max(peakEnemies,s.director.enemies.length);peakShots=Math.max(peakShots,s.enemyShots.length);}s.inputManager.sample=sample;costs.sort((a,b)=>a-b);return {seconds:elapsed/1000,lives:s.health.lives,gameOver:s.health.gameOver,peakEnemies,peakShots,updateP95Ms:costs[Math.floor(costs.length*.95)]};`);
 assert.ok(camping.lives<3,'A stationary held-fire player must lose lives');assert.ok(camping.peakShots<=84);report.regression.camping=camping;console.log(JSON.stringify({camping}));
 assert.deepEqual(errors,[]);console.log('PASS: pilot→mission→combat without preflight, owned weapons, five-stock caps, contextual radio, targetable batteries, staggered destruction, transparent pause, controls, cancel/confirm exit, and absolute space silence; both viewports.');
}
