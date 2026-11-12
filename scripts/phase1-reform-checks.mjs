import assert from 'node:assert/strict';
import {runReformPerformance} from './reform-performance.mjs';
import {runReformRoutes} from './reform-routes.mjs';

export async function runPhase1Review(api){
 const {send,evaluate,waitFor,shot,report,errors}=api;
 const run=code=>evaluate(`(async()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
 async function restart(id='nolan'){
  await evaluate(`(()=>{const g=window.__GAME__;window.__qaPreviousDirector=g.scene.getScene('PrototypeScene').director;(g.scene.getScenes(true)[0]??g.scene.getScene('PrototypeScene')).scene.start('PrototypeScene',{pilotId:'${id}',skipBriefing:true});return true;})()`);
  await waitFor(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');return s.scene.isActive()&&s.director!==window.__qaPreviousDirector&&s.health.lives===3&&s.pilot.id==='${id}'})()`);
  await run('s.scene.pause();s.tweens.getDelta=()=>20;return true;');
 }
 if(process.argv.includes('--performance-only')){await runReformPerformance(api);return;}
 if(process.argv.includes('--routes-only')){await runReformRoutes(api);assert.deepEqual(errors,[]);return;}
 for(const [width,height]of ((process.argv.includes('--victory-only')||process.argv.includes('--flow-only'))?[]:[[1366,768],[1920,1080]])){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const pilots=[];
  for(const id of ['nolan','cora','lyra','harlan','bento']){
   await restart(id);
   const levels=[];
   for(let lv=1;lv<=(id==='nolan'?5:4);lv++){
    const state=await run(`s.clearPlayerShots();s.weapons.weaponLevel=${lv};s.ship.setPosition(384,350);s.firePrimary();s.advancePlayerShots(150);s.hud.setWeapon(s.weapons.weaponFamily,${lv},0);return {level:${lv},count:s.shots.length,texture:s.shots[0]?.node.texture.key,label:document.querySelector('[data-field="weapon"]').textContent};`);
    assert.ok(state.count>0);if(id!=='nolan')assert.ok(state.texture.startsWith('reform-'));levels.push(state);
    if(lv===1||lv===(id==='nolan'?5:4))await shot('weapon-'+id+'-'+lv+'-'+width);
   }
   const special=await run(`s.clearPlayerShots();s.director.minibossSpawned=true;s.director.scrollPx=4600;s.director.eventIndex=999;s.director.enemies.splice(0);s.director.update(0,384,350);const b=s.director.boss;b.update(1800,384,350);s.syncBossVisual(b);const m=b.modules[2];s.ship.setPosition(b.x+m.offsetX,Math.min(390,b.y+m.offsetY+120));s.triggerSpecial();const immediate=b.hp;for(let i=0;i<75;i++)s.sys.step(s.time.now+20,20);return {immediate,after:b.hp,type:s.weapons.specialType,stock:s.weapons.specialCharges,drones:s.orbitalDrones.length};`);
   assert.equal(special.immediate,600,'Special damage waits for impact');assert.ok(special.after<600,'Special must damage a real target: '+JSON.stringify({id,special}));assert.equal(special.stock,1);await shot('special-'+id+'-'+width);
   pilots.push({id,levels,special});
  }
  await restart();
  const boss=await run(`s.director.minibossSpawned=true;s.director.scrollPx=4600;s.director.eventIndex=999;s.director.update(0,384,350);const b=s.director.boss;b.update(1800,384,350);s.syncBossVisual(b);s.radio.offer('boss',true);s.hud.setRadio(s.radio.message,true);const m=b.modules[3];s.ship.setPosition(b.x+m.offsetX,b.y+m.offsetY+60);s.firePrimary();s.advancePlayerShots(120);return {texture:s.bossVisual.main.texture.key,damaged:m.hp<100,radioColor:getComputedStyle(document.querySelector('[data-field="radio"]')).color,font:getComputedStyle(document.querySelector('[data-field="radio"]')).fontFamily};`);
  assert.equal(boss.texture,'reform-aerial');assert.ok(boss.damaged,'An actual RIVET projectile must hit the integrated gun');assert.ok(boss.font.includes('Console'));await shot('aerial-guns-terminal-'+width);
  const absence=await run(`const b=s.director.boss;b.damageArea(9999);b.update(1000,384,350);s.syncBossVisual(b);const hidden=!s.bossVisual.container.visible;b.update(4999,384,350);const phase=b.phase;b.update(1,384,350);b.update(950,384,350);s.syncBossVisual(b);s.updateEncounterEffects(20);return {hidden,phase,emerge:b.phase,texture:s.bossVisual.main.texture.key};`);
  assert.ok(absence.hidden);assert.equal(absence.phase,'submerged');assert.equal(absence.emerge,'emerge');await shot('ocean-emergence-'+width);
  await run(`const b=s.director.boss;b.update(850,384,350);for(let i=0;i<460;i++)b.update(20,384,350);s.syncBossVisual(b);s.updateEncounterEffects(20);return true;`);await shot('eclipse-warning-'+width);
  await run(`const b=s.director.boss;for(let i=0;i<70;i++)b.update(20,384,350);s.updateEncounterEffects(20);return true;`);await shot('eclipse-fire-'+width);
  const water=await run(`const w=s.backdrop.water;const before=w.elapsedMs;s.backdrop.update(5000,2000,4600);return {delta:w.elapsedMs-before,scroll:w.scrollPx};`);assert.equal(water.delta,2000);
  report.viewports.push({width,height,pilots,boss,absence,water});
 }
 await restart();
 report.regression.neutralization=await run(`
  s.ship.setPosition(384,350);s.spawnEnemyShot({x:384,y:230,velocityX:0,velocityY:0,weight:'weak'});s.weapons.weaponLevel=1;s.firePrimary();s.advancePlayerShots(170);const low=s.enemyShots.length;
  s.clearPlayerShots();s.weapons.weaponLevel=5;s.spawnEnemyShot({x:384,y:220,velocityX:0,velocityY:0,weight:'heavy'});s.firePrimary();s.advancePlayerShots(190);
  return {low,remaining:s.enemyShots.map(p=>p.weight),pool:s.projectilePool.length};`);
 assert.equal(report.regression.neutralization.low,1);assert.deepEqual(report.regression.neutralization.remaining,['heavy']);
 await restart();
 await run(`s.director.minibossSpawned=true;s.director.scrollPx=4600;s.director.eventIndex=999;s.director.update(0,384,350);const b=s.director.boss;b.update(1800,384,350);b.damageArea(600);b.update(1000,384,350);b.update(5000,384,350);b.update(1800,384,350);s.syncBossVisual(b);s.weapons.weaponLevel=5;s.applyBossDamage(9999,b.x,b.y,true);s.sys.step(s.time.now+20,20);return true;`);
 const immediate=await run(`return {completed:s.completed,result:!!document.querySelector('.bw-mission-result'),track:s.registry.get('audio').getStatus().track,phase:s.director.boss?.phase,hp:s.director.boss?.hp,gameOver:s.health.gameOver,paused:s.scene.isPaused(),miniboss:s.director.minibossActive,exitMs:s.exitMs};`);
 assert.ok(immediate.completed,JSON.stringify(immediate));assert.equal(immediate.result,false);assert.equal(immediate.track,'victory');
 await run(`for(let i=0;i<115;i++)s.sys.step(s.time.now+20,20);return true;`);await shot('victory-autopilot-climb');
 const clear=await run(`for(let i=0;i<110;i++)s.sys.step(s.time.now+20,20);return {visible:s.ship.visible,y:s.ship.y,result:!!document.querySelector('.bw-mission-result'),saved:JSON.parse(localStorage.getItem('bullet_wake_save_data_v1')).pilotProgress.nolan.flight};`);
 assert.equal(clear.visible,false);assert.ok(clear.y<0);assert.ok(clear.result);assert.equal(clear.saved.weapons.weaponLevel,5);await new Promise(r=>setTimeout(r,400));await shot('arcade-stage-clear');
 report.regression.victory={immediate,clear};
 await api.click('[data-result-action="0"]');await waitFor(`window.__GAME__.scene.isActive('EndingScene')`);await shot('aftermath-clean');
 report.regression.aftermath=await evaluate(`({results:document.querySelectorAll('.bw-mission-result').length,hud:document.querySelectorAll('#bw-combat-hud').length,panels:document.querySelectorAll('.bw-ending').length,opacity:getComputedStyle(document.querySelector('.bw-ending .bw-brief-panel')).opacity})`);
 assert.equal(report.regression.aftermath.results,0);assert.equal(report.regression.aftermath.hud,0);assert.equal(report.regression.aftermath.panels,1);assert.equal(Number(report.regression.aftermath.opacity),1);
 await api.click('[data-ending="missions"]');await waitFor(`!!document.querySelector('[data-mission-action="launch"]')`);await shot('mission-after-clear');
 await restart();
 report.regression.virtualGamepad=await run(`
  const original=Object.getOwnPropertyDescriptor(navigator,'getGamepads');
  const pad={id:'Xbox Standard QA',connected:true,index:0,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});s.inputManager.resetPad();
  const before=s.ship.x;pad.axes=[1,0];pad.buttons[0]={pressed:true,value:1};for(let i=0;i<10;i++)s.sys.step(s.time.now+20,20);
  const moved=s.ship.x-before,shots=s.shots.length;pad.axes=[0,0];pad.buttons[2]={pressed:true,value:1};s.sys.step(s.time.now+20,20);const stock=s.weapons.specialCharges;
  pad.buttons[9]={pressed:true,value:1};s.sys.step(s.time.now+20,20);const paused=s.scene.isPaused(),dialog=!!document.querySelector('.bw-pause');
  if(original)Object.defineProperty(navigator,'getGamepads',original);else delete navigator.getGamepads;
  return {moved,shots,stock,paused,dialog,physicalController:false};
 `);
 assert.ok(report.regression.virtualGamepad.moved>0&&report.regression.virtualGamepad.shots>0);assert.equal(report.regression.virtualGamepad.stock,1);assert.ok(report.regression.virtualGamepad.paused&&report.regression.virtualGamepad.dialog);await shot('pause-transparent');
 await evaluate(`document.querySelector('.bw-pause [data-brief-action="0"]')?.click()`);
 report.regression.physicalGamepads=await evaluate(`window.__QA_REAL_GAMEPADS__?.()??[]`);
 assert.deepEqual(errors,[],'No browser errors');
}
