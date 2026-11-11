import assert from 'node:assert/strict';
import {runPhase1Review as fullRoutes} from './phase1-final-checks.mjs';

export async function runPhase1Review(api) {
 const {send,evaluate,waitFor,shot,report,errors,click}=api;
 const run=code=>evaluate(`(async()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
 async function start(id='nolan') {
  await evaluate(`(()=>{const g=window.__GAME__,active=g.scene.getScenes(true)[0]??g.scene.getScene('PrototypeScene');active.scene.start('PrototypeScene',{pilotId:'${id}',skipBriefing:true});return true;})()`);
  await waitFor(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');return s.scene.isActive()&&s.health.lives===3&&s.pilot.id==='${id}'})()`);
  await run('s.scene.pause();return true;');
 }
 for(const [width,height] of [[1366,768],[1920,1080]]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await start();
  const hud=await run(`s.hud.setRadio('Olha pra tela, não pra mensagem, caramba!',true);const root=document.querySelector('#bw-combat-hud'),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}};const q=x=>root.querySelector(x);return {progressCount:root.querySelectorAll('[data-field="progress"]').length,progressLeft:!!q('.bw-combat-left [data-field="progress"]'),progress:rect(q('.bw-combat-results')),score:rect(q('.bw-combat-score-panel')),radio:rect(q('.bw-combat-radio')),radioColor:getComputedStyle(q('.bw-combat-radio p')).color,radioBorder:getComputedStyle(q('.bw-combat-radio')).borderTopStyle,pauseText:q('[data-action="restart"]').textContent,pauseLabel:q('[data-action="restart"]').getAttribute('aria-label'),weapon:q('[data-field="weapon"]').textContent,overflow:[...root.querySelectorAll('section,button')].filter(e=>{const r=e.getBoundingClientRect();return r.bottom>innerHeight+1||r.right>innerWidth+1||e.scrollWidth>e.clientWidth+1}).map(e=>e.className)};`);
  assert.equal(hud.progressCount,1);assert.equal(hud.progressLeft,true);assert.ok(hud.progress.bottom<=hud.score.y,'Progress above score');
  assert.equal(hud.pauseText,'');assert.equal(hud.pauseLabel,'Pausar jogo');assert.equal(hud.weapon,'RAJADA ESCARLATE');
  assert.equal(hud.radioBorder,'solid');assert.equal(hud.radioColor,'rgb(255, 119, 112)');assert.ok(hud.radio.y<height*.7,'Radio raised');assert.deepEqual(hud.overflow,[]);
  await shot('hud-red-radio-'+width);
  const lives=await run(`const nodes=[...document.querySelectorAll('.bw-life-icons i')],positions=[],frames=[];for(const time of [0,350,700,1050]){for(const n of nodes){const a=n.getAnimations()[0];a.pause();a.currentTime=time;}await new Promise(r=>requestAnimationFrame(r));positions.push(nodes.map(n=>n.getBoundingClientRect().x));frames.push(getComputedStyle(nodes[0]).backgroundImage);}return {positions,frames,backgroundPosition:getComputedStyle(nodes[0]).backgroundPosition};`);
  for(const p of lives.positions)assert.deepEqual(p,lives.positions[0],'Life slots must not move');assert.equal(new Set(lives.frames).size,4);assert.equal(lives.backgroundPosition,'50% 50%');
  const banks=[];
  for(const [name,dx] of [['left',-1],['right',1],['neutral',0]]) {
   const bank=await run(`s.ship.setPosition(384,340);for(let i=0;i<15;i++)s.ship.updateShip(20,${dx},0,0,false);s.clearPlayerShots();s.weapons.weaponLevel=3;s.firePrimary();return {texture:s.ship.hullSprite.texture.key,frame:s.ship.hullSprite.frame.name,rotation:s.ship.rotation,x:s.ship.x,y:s.ship.y,shots:s.shots.map(p=>({x:p.baseX,y:p.baseY,texture:p.node.texture.key,originX:p.node.originX}))};`);
   assert.equal(bank.rotation,0);assert.equal(bank.texture,name==='neutral'?'hd-rivet':'hd-rivet-bank');if(name!=='neutral')assert.equal(Math.floor(Number(bank.frame)/4),name==='left'?1:0);
   for(const p of bank.shots){assert.equal(p.x,bank.x);assert.equal(p.y,bank.y-16.45);assert.equal(p.texture,'polish-rivet-red');assert.equal(p.originX,.5);}
   banks.push({name,...bank});await shot('bank-'+name+'-'+width);
  }
  const levels=[];
  for(const level of [1,2,3,4,5]) {
   const volley=await run(`s.clearPlayerShots();s.ship.setPosition(384,355);s.weapons.weaponLevel=${level};s.hud.setWeapon('ion',${level},0);s.firePrimary();${level>=3?'s.fireSecondary();':''}s.advancePlayerShots(100);return s.shots.map(p=>({texture:p.node.texture.key,width:p.node.displayWidth,height:p.node.displayHeight,radius:p.hitRadius,homing:!!p.homing}));`);
   assert.equal(volley.length,[1,2,5,8,10][level-1]);assert.equal(volley.filter(p=>p.texture==='review-effects-missile').length,level===5?3:level>=3?2:0);
   const primary=volley.find(p=>p.texture==='polish-rivet-red');if(level>1)assert.ok(primary.width>levels[level-2].width,'Each red stage must gain body');
   levels.push({level,width:primary.width,height:primary.height,shots:volley.length});await shot('red-shot-nv'+level+'-'+width);
  }
  const parachute=await run(`s.director.scrollPx=420;s.director.update(0,384,350);const carrier=s.director.enemies.find(e=>e.carrier);s.makeEnemyVisual(carrier);const v=s.enemyVisuals.get(carrier.id);v.container.setPosition(384,160);return {texture:v.body.texture.key,frames:s.anims.get('hd-supply-parachute-loop').frames.length,fps:s.anims.get('hd-supply-parachute-loop').frameRate};`);
  assert.equal(parachute.frames,8);assert.equal(parachute.fps,8);await shot('parachute-'+width);
  report.viewports.push({width,height,hud,lives,banks,levels,parachute});
 }
 report.regression.deathPenalty=[];
 for(const pilot of ['nolan','cora','lyra','harlan','bento']) {
  await start(pilot);
  const death=await run(`s.weapons.weaponLevel=s.pilot.id==='nolan'?5:4;s.weapons.powerMeter=0;s.pickups.clear();s.health.invulnerableMs=0;const event=s.damageShip(1,s.ship.x,s.ship.y);const dropped=s.pickups.pickups.map(p=>({type:p.type,...(p.recovery?{unexpectedSnapshot:true}:{})}));const afterDeath={level:s.weapons.weaponLevel,meter:s.weapons.powerMeter,lives:s.health.lives};const p=s.pickups.pickups[0];p.x=s.ship.x;p.y=s.ship.y;s.checkPickupCollisions();return {pilot:s.pilot.name,event,dropped,afterDeath,afterCollect:{level:s.weapons.weaponLevel,meter:s.weapons.powerMeter},special:s.weapons.specialCharges};`);
  assert.equal(death.event,'respawn');assert.deepEqual(death.dropped,[{type:'power'}]);assert.deepEqual(death.afterDeath,{level:1,meter:0,lives:2});assert.deepEqual(death.afterCollect,{level:1,meter:1});assert.equal(death.special,2);report.regression.deathPenalty.push(death);
 }
 // Accessible icon-only pause retains the existing compact controls and leave confirmation.
 await start();await run('s.scene.resume();return true;');await click('[data-action="restart"]');
 await waitFor(`!!document.querySelector('.bw-pause')`);await shot('pause-icon');
 assert.equal(await evaluate(`document.querySelector('.bw-pause').textContent.includes('CONTINUAR')`),true);
 if(!process.argv.includes('--visual-only')) {process.argv.push('--extra');await fullRoutes(api);}
 assert.deepEqual(errors,[]);
}
