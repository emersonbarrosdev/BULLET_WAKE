import assert from 'node:assert/strict';
import {runPhase1Review as redHud} from './phase1-rivet-red-checks.mjs';
import {runPhase1Review as fullRoutes} from './phase1-final-checks.mjs';

export async function runPhase1Review(api) {
 const profiles=[];
 for(const [width,height]of [[1366,768],[1920,1080]]) {
  await api.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await api.click('[data-profile-index="0"]');
  const profile=await api.evaluate(`(()=>{const p=document.querySelector('.bw-pilot-profile'),r=p.getBoundingClientRect();return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight>innerHeight,clipped:r.bottom>innerHeight,text:p.textContent};})()`);
  assert.equal(profile.scroll,false);assert.equal(profile.clipped,false);assert.ok(profile.text.includes('TORMENTA ESCARLATE'));
  profiles.push(profile);await api.shot('bayek-profile-'+width);await api.click('[data-action="cards"]');
 }
 api.report.regression.bayekProfiles=profiles;
 const visualOnly=process.argv.includes('--visual-only');
 if(!visualOnly)process.argv.push('--visual-only');
 await redHud(api);
 if(!visualOnly)process.argv.splice(process.argv.indexOf('--visual-only'),1);
 const {send,evaluate,waitFor,shot,report,errors}=api;
 const run=code=>evaluate(`(async()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
 async function start(withBoss=true) {
  await evaluate(`(()=>{const g=window.__GAME__,a=g.scene.getScenes(true)[0]??g.scene.getScene('PrototypeScene');a.scene.start('PrototypeScene',{pilotId:'nolan',skipBriefing:true});return true;})()`);
  await waitFor(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');return s.scene.isActive()&&s.health.lives===3})()`);
  await run(`s.scene.pause();${withBoss?'s.director.scrollPx=4600;s.director.minibossSpawned=true;s.director.eventIndex=999;s.director.update(0,384,350);s.director.boss.update(1800,384,350);s.syncBossVisual(s.director.boss);':''}return true;`);
 }
 report.regression.scarlet=[];
 for(const [width,height] of [[1366,768],[1920,1080]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await start();
  const trace=await run(`const b=s.director.boss;s.ship.setPosition(b.x,b.y+185);s.triggerSpecial();const immediate=b.hp;s.weapons.specialActiveMs=2900;s.updateScarletSpecial();const warmup=b.hp;const hp=[];for(let t=120;t<=1800;t+=20){s.weapons.specialActiveMs=3000-t;s.updateScarletSpecial();hp.push(b.hp);}const visual=s.specialVisual,beams=visual.nodes.map(n=>({x:n.x,y:n.y,rotation:n.rotation,texture:n.texture.key}));return {immediate,warmup,after:b.hp,modules:b.modules.map(m=>({id:m.id,hp:m.hp})),beams,specialName:s.pilot.specialName,stock:s.weapons.specialCharges,frames:s.textures.get('polish-scarlet-storm').frameTotal-1};`);
  assert.equal(trace.immediate,600);assert.equal(trace.warmup,600);assert.ok(trace.after<600,'Forward contact must damage real parts');assert.equal(trace.stock,1);assert.equal(trace.frames,8);assert.equal(trace.specialName,'TORMENTA ESCARLATE');assert.equal(trace.beams[1].rotation,0);
  await shot('tormenta-boss-'+width);
  const movement=await run(`s.ship.setPosition(s.ship.x+40,s.ship.y-15);s.specialVisual.update(1800,s.ship.x,s.ship.y-s.ship.halfHeight-2);return {shipX:s.ship.x,noseY:s.ship.y-s.ship.halfHeight-2,beams:s.specialVisual.nodes.map(n=>({x:n.x,y:n.y}))};`);
  assert.ok(movement.beams.every(b=>b.x===movement.shipX&&b.y===movement.noseY),'All streams follow the moving nose');
  await shot('tormenta-moving-'+width);report.regression.scarlet.push({width,height,trace,movement});
 }
 await start();
 const miss=await run(`const b=s.director.boss;s.ship.setPosition(b.x,35);s.triggerSpecial();for(let t=20;t<3000;t+=20){s.weapons.specialActiveMs=3000-t;s.updateScarletSpecial();}s.weapons.specialActiveMs=0;s.updateScarletSpecial();return {hp:b.hp,disposed:!s.specialVisual};`);
 assert.equal(miss.hp,600,'Enemies behind the emitter cannot receive automatic area damage');assert.equal(miss.disposed,true);report.regression.scarletMiss=miss;
 await start(false);
 const sides=await run(`s.director.scrollPx=420;s.director.eventIndex=0;s.director.update(0,384,350);const template=s.director.enemies[0];s.director.enemies.length=0;s.ship.setPosition(384,340);for(const [id,y]of [[900,210],[901,390]]){const e={...template,id,x:384,y,hp:4,carrier:false,layer:undefined,submerged:false};s.director.enemies.push(e);s.makeEnemyVisual(e);}s.triggerSpecial();for(let t=20;t<=1400;t+=20){s.weapons.specialActiveMs=3000-t;s.updateScarletSpecial();}return {front:s.director.enemies.some(e=>e.id===900),behind:s.director.enemies.some(e=>e.id===901)};`);
 assert.equal(sides.front,false);assert.equal(sides.behind,true);report.regression.scarletDirection=sides;
 await shot('tormenta-forward-only');
 if(!visualOnly){process.argv.push('--extra');await fullRoutes(api);}
 assert.deepEqual(errors,[]);
}
