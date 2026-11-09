/** Production-build visual QA: both desktop viewports, all pilots and profiles. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const stage1 = process.argv.includes('--stage1');
const normal = process.argv.includes('--normal');
const confirmation = !stage1 && !normal;
const screenshots = resolve(normal ? 'docs/screenshots/normal-phase1' : confirmation ? 'docs/screenshots/pilot-confirmation' : 'docs/screenshots/stage1-visual');
mkdirSync(screenshots, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' };
const server = createServer((req, res) => {
  const file = resolve(root, '.' + (req.url === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9231', '--no-first-run',
  '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'bw-pilot-qa-')), 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(r => setTimeout(r, ms));
let socket;
const errors = [];
const report = { viewports: [], regression: {}, errors };
try {
  let target;
  for (let i = 0; i < 50; i++) {
    try { target = (await (await fetch('http://127.0.0.1:9231/json')).json()).find(t => t.type === 'page'); } catch {}
    if (target) break;
    await pause(200);
  }
  assert(target, 'Chrome debugging endpoint unavailable');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, reject) => { socket.onopen = r; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.id) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) cb.reject(new Error(msg.error.message)); else cb.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args);
    else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error' && !msg.params.entry.url?.endsWith('favicon.ico')) errors.push(msg.params.entry);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    assert(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(100); }
    throw new Error('Timed out: ' + expression + '\n' + JSON.stringify({errors, state:await evaluate(`({scenes:window.__GAME__?.scene.scenes.map(s=>({key:s.sys.settings.key,status:s.sys.settings.status})),text:document.body.innerText.slice(-500)})`)}));
  };
  const key = async (key, code = key, virtualKey = key.charCodeAt(0)) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey });
    await pause(60);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey });
    await pause(80);
  };
  const click = async selector => {
    const pos = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...pos, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...pos, button: 'left', clickCount: 1 });
    await pause(120);
  };
  const shot = async name => {
    if (stage1) await evaluate(`{const s=window.__GAME__.scene.getScene('PrototypeScene');if(s.ship)s.ship.setAlpha(1);void 0;}`);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(screenshots, name + '.png'), Buffer.from(r.data, 'base64'));
  };
  const imagesReady = () => waitFor(`Array.from(document.querySelectorAll('#bw-pilot-select img')).every(i=>i.complete&&i.naturalWidth>0)`);
  const geometry = () => evaluate(`(() => {
    const root=document.querySelector('#bw-pilot-select');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    const content=[...root.querySelectorAll('button,h1,h2,p,.bw-pilot-profile,.bw-pilot-profile-content,.bw-pilot-ship-row,.bw-pilot-stats')];
    return {
      root:{clientHeight:root.clientHeight,scrollHeight:root.scrollHeight,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth},
      page:{height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth},
      cards:[...root.querySelectorAll('.bw-pilot-card')].map(rect),
      profile:root.querySelector('.bw-pilot-profile')?rect(root.querySelector('.bw-pilot-profile')):null,
      footer:rect(root.querySelector('.bw-pilot-footer')),
      clipped:content.filter(e=>{const r=e.getBoundingClientRect();return r.top < -1||r.left < -1||r.bottom>innerHeight+1||r.right>innerWidth+1;}).map(e=>e.className),
      overflowing:content.filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1).map(e=>e.className)
    };
  })()`);
  const checkGeometry = (g, width, height) => {
    assert(g.root.scrollHeight <= height && g.root.scrollWidth <= width, 'Selection scrolls');
    assert(g.page.height <= height && g.page.width <= width, 'Document scrolls');
    assert.deepEqual(g.clipped, [], 'Clipped content');
    assert.deepEqual(g.overflowing, [], 'Content overflows');
    assert(g.footer.bottom <= height, 'Footer outside viewport');
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Page.navigate', { url });
  await waitFor(`Boolean(window.__GAME__?.isBooted&&document.querySelector('.bw-press-activation'))`);
  report.regression.title = await evaluate(`window.__GAME__.scene.isActive('TitleScene')`);
  await click('.bw-press-activation');
  await click('[data-action="pilots"]');
  await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
  if (normal) {
    await click('[data-pilot-index="0"]'); await click('[data-action="start"]');
    const active = `window.__GAME__.scene.getScene('PrototypeScene')`;
    const start = async () => {
      await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')&&Boolean(document.querySelector('#bw-combat-hud'))`);
      await pause(150);
      await evaluate(`{const s=${active};s.health.invulnerableMs=600000;s.scene.pause();void 0;}`);
    };
    await start();
    await evaluate(`{${active}.scene.resume();void 0;}`);await key('4','Digit4',52);
    assert.equal(await evaluate(`${active}.weapons.weaponLevel`),1,'Production shortcut must not grant free power');
    await evaluate(`{${active}.scene.pause();void 0;}`);report.regression.productionSandboxDisabled=true;
    const inspect = selector => evaluate(`(() => {
      const r=document.querySelector(${JSON.stringify(selector)}), rect=r.getBoundingClientRect();
      const bad=[...r.querySelectorAll('button,h1,h2,p,aside *')].filter(e=>{const b=e.getBoundingClientRect();return b.top<-.5||b.left<-.5||b.bottom>innerHeight+.5||b.right>innerWidth+.5;}).map(e=>e.className||e.tagName);
      return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,clipped:bad,scroll:r.scrollHeight>r.clientHeight+1,pageScroll:document.documentElement.scrollHeight>innerHeight};
    })()`);
    for (const [width,height] of [[1366,768],[1920,1080],[1280,800],[2560,1080]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false}); await pause(250);
      const layout=await inspect('#bw-combat-hud');
      assert.equal(layout.x,0);assert.equal(layout.y,0);assert.equal(layout.width,width);assert.equal(layout.height,height);
      assert.deepEqual(layout.clipped,[]);assert.equal(layout.scroll,false);assert.equal(layout.pageScroll,false);
      const canvas=await evaluate(`(()=>{const s=${active},c=s.game.canvas.getBoundingClientRect();return {x:c.x,y:c.y,w:c.width,h:c.height,nativeW:s.game.canvas.width,nativeH:s.game.canvas.height,world:s.cameras.main.getWorldPoint(c.width/2,c.height/2)};})()`);
      assert.equal(canvas.x,0);assert.equal(canvas.y,0);assert.equal(canvas.w,width);assert.equal(canvas.h,height);
      assert.equal(canvas.nativeW,width);assert.equal(canvas.nativeH,height);assert.ok(Math.abs(canvas.world.x-384)<.001);assert.ok(Math.abs(canvas.world.y-216)<.001);
      await evaluate(`(()=>{const s=${active};s.clearEnemyShots();s.clearPlayerShots();s.pickups.clear();s.director.enemies.length=0;s.syncEnemyVisuals();s.director.boss=null;s.director.minibossSpawned=false;s.director.eventIndex=0;s.director.scrollPx=0;s.completed=false;
        for(let i=0;i<160;i++)s.update(i*50,50);
        s.ship.setAlpha(1);
      })()`);
      const flock=await evaluate(`(()=>{const s=${active};return {flock:s.director.enemies.filter(e=>e.flight).length,actors:s.director.enemies.length,distance:s.director.scrollPx,normal:s.director.difficulty,background:s.backdrop.abyssTile.tilePositionY};})()`);
      assert.ok(flock.flock>=4);assert.ok(flock.actors>=7);assert.equal(flock.normal,'normal');assert.ok(flock.background < -500);
      await shot(`combat-${width}x${height}`);
      const collect=await evaluate(`(()=>{const s=${active};s.setTestWeapon('ion',1);s.weapons.powerMeter=0;const before=s.scoreCombo.score;
        const pickup=t=>{s.pickups.clear();s.pickups.spawn(t,s.ship.x,s.ship.y);s.checkPickupCollisions();};
        pickup('weapon_ion');const duplicate={level:s.weapons.weaponLevel,meter:s.weapons.powerMeter,points:s.scoreCombo.score-before};
        pickup('weapon_red');const red={family:s.weapons.weaponFamily,level:s.weapons.weaponLevel};
        pickup('power');pickup('power');pickup('weapon_green');const swap={family:s.weapons.weaponFamily,meter:s.weapons.powerMeter};
        pickup('power');const power={level:s.weapons.weaponLevel,meter:s.weapons.powerMeter};
        pickup('speed');const speed=s.weapons.speedLevel;
        s.pickups.clear();s.clearEnemyShots();s.syncPickupVisuals();
        for(const[i,t]of ['power','weapon_ion','weapon_green','weapon_red','health','bomb','speed','missile','score','special'].entries())s.pickups.spawn(t,205+(i%5)*88,220+Math.floor(i/5)*65);
        s.syncPickupVisuals();return{duplicate,red,swap,power,speed};})()`);
      assert.deepEqual(collect.duplicate,{level:1,meter:0,points:5000});assert.deepEqual(collect.red,{family:'red',level:1});assert.deepEqual(collect.swap,{family:'green',meter:2});assert.deepEqual(collect.power,{level:2,meter:0});assert.equal(collect.speed,1);
      await shot(`items-${width}x${height}`);
      const surface = await evaluate(`(()=>{const s=${active};s.pickups.clear();s.syncPickupVisuals();
        for(let i=0;i<200;i++)s.update(i*50,50);
        const pod=s.director.enemies.find(e=>e.layer==='surface');
        s.clearEnemyShots();s.spawnEnemyShot({x:280,y:100,velocityX:0,velocityY:125,sourceLayer:'surface'});s.advanceEnemyShots(100);
        return {exists:!!pod,depth:pod?s.enemyVisuals.get(pod.id).container.depth:null,bulletSize:s.enemyShots[0].node.displayWidth,hitRadius:s.enemyShots[0].hitRadius};})()`);
      assert.equal(surface.exists,true);assert.equal(surface.depth,-3);assert.ok(surface.bulletSize>5&&surface.bulletSize<12);assert.ok(surface.hitRadius<3);
      await shot(`surface-${width}x${height}`);
      const noSurfaceContact=await evaluate(`(()=>{const s=${active},pod=s.director.enemies.find(e=>e.layer==='surface'),others=[...s.director.enemies],pos={x:pod.x,y:pod.y};
        s.director.enemies.length=0;s.director.enemies.push(pod);pod.x=s.ship.x;pod.y=s.ship.y;s.health.invulnerableMs=0;const hp=s.health.hp;s.checkEnemyContacts();
        const safe=s.health.hp===hp&&s.director.enemies.includes(pod);Object.assign(pod,pos);s.director.enemies.length=0;s.director.enemies.push(...others);return safe;})()`);
      assert.ok(noSurfaceContact);
      const respawn = await evaluate(`(()=>{const s=${active};s.setTestWeapon('red',4,3);s.weapons.speedLevel=3;s.weapons.bombs=0;s.health={hp:1,lives:2,invulnerableMs:0,gameOver:false};
        const outcome=s.damageShip();return{outcome,family:s.weapons.weaponFamily,level:s.weapons.weaponLevel,meter:s.weapons.powerMeter,speed:s.weapons.speedLevel,bombs:s.weapons.bombs,hudLevel:document.querySelector('[data-field="level"]').textContent,hudBombs:document.querySelector('[data-field="bombs"]').textContent};})()`);
      assert.deepEqual(respawn,{outcome:'respawn',family:'ion',level:2,meter:0,speed:0,bombs:3,hudLevel:'NV 2/4',hudBombs:'03'});
      await evaluate(`(()=>{const s=${active};s.pickups.clear();s.syncPickupVisuals();s.director.enemies.length=0;s.director.scrollPx=4251;s.director.eventIndex=999;s.director.minibossSpawned=true;s.director.boss=null;s.director.update(50,s.ship.x,s.ship.y);const boss=s.director.boss;boss.phase='core';boss.hp=1;boss.damage(999,boss.x,boss.y);s.update(0,16);})()`);
      await waitFor(`Boolean(document.querySelector('.bw-mission-result'))`);
      const victory=await inspect('.bw-mission-result');assert.deepEqual(victory.clipped,[]);assert.equal(victory.scroll,false);assert.equal(victory.width,width);
      const layered=await evaluate(`(()=>{const b=document.querySelector('[data-result-action="0"]').getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2).closest('.bw-mission-result')!==null&&document.querySelector('#bw-combat-hud').inert;})()`);
      assert.ok(layered);await shot(`victory-${width}x${height}`);
      if(width===2560) {
        await key('Enter','Enter',13);await waitFor(`window.__GAME__.scene.isActive('EndingScene')`);
        const save=await evaluate(`JSON.parse(localStorage.getItem('bullet_wake_save_data_v1'))`);
        assert.ok(save.bestScores['1']);assert.equal(save.bestScores['5'],undefined);assert.deepEqual(save.completedCampaignPilots,[]);
        assert.equal(await evaluate(`document.querySelectorAll('#bw-combat-hud,.bw-mission-result').length`),0);
        await evaluate(`{window.__GAME__.scene.getScene('EndingScene').scene.start('PrototypeScene',{pilotId:'nolan',stageNumber:1});void 0;}`);
        report.regression.correctStageSavedAfterEpilogue=true;
      } else if(width===1280) {
        await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
        const p=await evaluate(`(()=>{const b=document.querySelector('[data-result-action="1"]').getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2};})()`);
        await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,radiusX:1,radiusY:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await send('Emulation.setTouchEmulationEnabled',{enabled:false});
      } else if(width===1366) await key('r','KeyR',82);
      else await click('[data-result-action="1"]');
      await waitFor(`!document.querySelector('.bw-mission-result')&&${active}.completed===false`);await start();
      report.viewports.push({width,height,layout,canvas,flock,collect,surface,noSurfaceContact,respawn,victory,layered});
    }
    await evaluate(`{const s=${active};s.scene.resume();s.scene.start('TitleScene');void 0;}`);
    await waitFor(`Boolean(document.querySelector('.bw-press-activation'))`);assert.equal(await evaluate(`document.querySelectorAll('#bw-combat-hud,.bw-mission-result').length`),0);
    await click('.bw-press-activation');await click('[data-action="options"]');await click('[data-action="guide"]');
    for(const[width,height]of [[1366,768],[1920,1080]]){
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await pause(180);
      const guide=await inspect('#bw-title-screen');assert.deepEqual(guide.clipped,[]);assert.equal(guide.pageScroll,false);
      assert.equal(await evaluate(`document.querySelectorAll('.bw-item-guide article').length`),10);await shot(`guide-${width}x${height}`);
      report.regression['guide'+width]=guide;
    }
    await key('Escape','Escape',27);assert.ok(await evaluate(`Boolean(document.querySelector('[data-action="guide"]'))`));
    await key('Escape','Escape',27);await click('[data-action="pilots"]');
    await click('[data-action="profile"]');await imagesReady();checkGeometry(await geometry(),1920,1080);await key('Escape','Escape',27);
    await click('[data-pilot-index="0"]');await click('[data-action="start"]');await start();
    await evaluate(`{const s=${active};s.health={hp:1,lives:1,invulnerableMs:0,gameOver:false};s.damageShip();void 0;}`);
    assert.deepEqual((await inspect('.bw-mission-result')).clipped,[]);await shot('game-over-1920x1080');
    await key('Escape','Escape',27);await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
    assert.equal(await evaluate(`document.querySelectorAll('#bw-combat-hud,.bw-mission-result').length`),0);
    for(const[index,id]of [[1,'cora'],[2,'harlan']]) {
      await click(`[data-pilot-index="${index}"]`);await click('[data-action="start"]');await start();
      const other=await evaluate(`(()=>{const s=${active};return{id:s.pilot.id,painted:!!s.ship.paintedRivet,width:s.game.canvas.width,height:s.game.canvas.height,portrait:document.querySelector('[data-field="portrait"]').getAttribute('src')};})()`);
      assert.equal(other.id,id);assert.equal(other.painted,false);assert.equal(other.width,1920);assert.equal(other.height,1080);assert.ok(other.portrait.includes(id));
      report.regression[id+'ShipPreserved']=other;
      await evaluate(`{const s=${active};s.scene.resume();s.scene.start('PilotSelectScene');void 0;}`);await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
    }
    report.regression.profileAfterCombat=true;report.regression.gameOver=true;report.regression.touchReplay=true;
    assert.deepEqual(errors,[],'Browser errors');
    writeFileSync(join(screenshots,'validation.json'),JSON.stringify(report,null,2)+'\n');
    console.log('PASS: native full viewport, carbon HUD, Normal flocks, real collection rules, distinct icons, complete victory/game-over dialogs, replay by keyboard/mouse/touch, options guide, clean scene lifecycle.');
  } else if (confirmation) {
    const baseline = JSON.parse(readFileSync(resolve('docs/screenshots/pilot-selection-final/validation.json'),'utf8'));
    const ready = () => evaluate(`!document.querySelector('[data-action="start"]').hidden`);
    const chosen = () => evaluate(`window.__GAME__.scene.getScene('PilotSelectScene').chosenIndex`);
    const checkCards = (actual,approved) => actual.forEach((card,i)=>{
      assert.equal(card.width,approved[i].width);assert.equal(card.height,approved[i].height);
      assert(Math.abs(card.x-approved[i].x)<1&&Math.abs(card.y-approved[i].y)<1,'Card spacing changed');
    });
    const touch = async selector => {
      const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(120);
    };
    for(const [width,height]of [[1366,768],[1920,1080]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await imagesReady();await pause(120);
      assert.equal(await ready(),false);assert.equal(await chosen(),null);
      assert.equal(await evaluate(`document.querySelectorAll('.bw-pilot-card [data-action="profile"]').length`),3);
      assert.equal(await evaluate(`document.querySelectorAll('button button').length`),0);
      const initial = await geometry();checkGeometry(initial,width,height);
      const approved=baseline.viewports.find(v=>v.width===width).cards.cards;
      checkCards(initial.cards,approved);
      await shot(`initial-${width}x${height}`);
      const pos=await evaluate(`(()=>{const r=document.querySelector('[data-pilot-index="1"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});await pause(80);
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      await key('ArrowRight','ArrowRight',39);await key('Enter','Enter',13);
      assert.equal(await chosen(),1);assert.equal(await ready(),true);
      assert.equal(await evaluate(`window.__GAME__.scene.isActive('PilotSelectScene')`),true);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,autoRepeat:true});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      assert.equal(await evaluate(`window.__GAME__.scene.isActive('PilotSelectScene')`),true);
      await key('ArrowRight','ArrowRight',39);
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      for(let i=0;i<3;i++){
        await click(`[data-profile-index="${i}"]`);await imagesReady();
        assert.equal(await evaluate(`document.querySelector('.bw-pilot-profile-name h2').textContent`),['Nolan Fitch','Cora Wren','Harlan Greer'][i]);
        assert.equal(await chosen(),null);assert.equal(await ready(),false);
        const g=await geometry();checkGeometry(g,width,height);
        await shot(`profile-${i}-${width}x${height}`);
        await key('Escape','Escape',27);
      }
      await evaluate(`document.querySelector('[data-profile-index="0"]').focus()`);
      await key('Enter','Enter',13);
      assert.equal(await evaluate(`document.querySelector('.bw-pilot-profile-name h2').textContent`),'Nolan Fitch');
      assert.equal(await chosen(),null);await key('i','KeyI',73);
      await click('[data-pilot-index="0"]');await click('[data-pilot-index="0"]');
      assert.equal(await chosen(),0);assert.equal(await ready(),true);
      assert.equal(await evaluate(`window.__GAME__.scene.isActive('PilotSelectScene')`),true);
      await click('[data-profile-index="1"]');
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      await click('[data-action="choose"]');
      assert.equal(await chosen(),1);assert.equal(await ready(),true);
      await key('Escape','Escape',27);
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      await send('Emulation.setTouchEmulationEnabled',{enabled:true});
      await touch('[data-profile-index="1"]');
      assert.equal(await evaluate(`document.querySelector('.bw-pilot-profile-name h2').textContent`),'Cora Wren');
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      await touch('[data-action="cards"]');
      await touch('[data-pilot-index="2"]');
      assert.equal(await chosen(),2);assert.equal(await ready(),true);
      const selected=await geometry();checkGeometry(selected,width,height);checkCards(selected.cards,approved);
      await shot(`chosen-${width}x${height}`);
      await touch('[data-action="start"]');
      await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')`);
      assert.equal(await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id`),'harlan');
      await send('Emulation.setTouchEmulationEnabled',{enabled:false});
      await evaluate(`{window.__GAME__.scene.getScene('PrototypeScene').scene.start('PilotSelectScene');void 0;}`);
      await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
      report.viewports.push({width,height,initial,selected,cardGeometryPreserved:true,mouseKeyboardTouch:true,profilesDoNotChoose:true});
    }
    await key('2');await key('Enter','Enter',13);
    assert.equal(await chosen(),1);assert.equal(await evaluate(`window.__GAME__.scene.isActive('PilotSelectScene')`),true);
    await key('Enter','Enter',13);await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')`);
    assert.equal(await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id`),'cora');
    await evaluate(`{window.__GAME__.scene.getScene('PrototypeScene').scene.start('PilotSelectScene');void 0;}`);
    await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
    await click('[data-pilot-index="0"]');await click('[data-action="start"]');
    await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')`);
    assert.equal(await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id`),'nolan');
    assert.deepEqual(errors,[]);
    writeFileSync(join(screenshots,'validation.json'),JSON.stringify(report,null,2)+'\n');
    console.log('PASS: profile buttons inside all cards; explicit choice then confirmation by mouse, keyboard and touch; hover/repeat/profile never launch; changing/cancelling clears choice; both resolutions without scroll or card growth; correct pilots launched; zero browser errors.');
  } else if (stage1) {
    await key('1'); await key('Enter', 'Enter', 13); await key('Enter', 'Enter', 13);
    await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')&&Boolean(document.querySelector('#bw-combat-hud'))`);
    report.regression.artAudit = await evaluate(`(()=>{
      const s=window.__GAME__.scene.getScene('PrototypeScene');
      return ['rivet','scout','dart','lancer','cutter','bomb'].map(name=>{
        const image=s.textures.get('hd-'+name).getSourceImage(),c=document.createElement('canvas');c.width=1024;c.height=256;
        const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const hashes=[],bounds=[];
        for(let f=0;f<4;f++){
          const d=ctx.getImageData(f*256,0,256,256).data;let hash=2166136261,x0=256,y0=256,x1=0,y1=0;
          for(let y=0;y<256;y++)for(let x=0;x<256;x++){
            const at=(y*256+x)*4;hash=Math.imul(hash^d[at],16777619);hash=Math.imul(hash^d[at+3],16777619);
            if(d[at+3]>24){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
          }
          hashes.push(hash>>>0);bounds.push({x0,y0,x1,y1});
        }
        return {name,width:image.width,height:image.height,distinctFrames:new Set(hashes).size,bounds};
      });
    })()`);
    for(const sheet of report.regression.artAudit){
      assert.equal(sheet.width,1024);assert.equal(sheet.height,256);assert.equal(sheet.distinctFrames,4);
      for(const b of sheet.bounds)assert(b.x0>0&&b.y0>0&&b.x1<255&&b.y1<255,'Clipped sprite: '+sheet.name);
    }
    for (const [width, height] of [[1366, 768], [1920, 1080]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await pause(250);
      const layout = await evaluate(`(()=>{
        const r=document.querySelector('#bw-combat-hud'), c=document.querySelector('canvas').getBoundingClientRect(),h=r.getBoundingClientRect();
        const clipped=[...r.querySelectorAll('aside *')].filter(e=>{const b=e.getBoundingClientRect();return b.bottom>c.bottom+1||b.right>c.right+1||b.left<c.left-1||b.top<c.top-1;}).map(e=>e.className);
        return {width:h.width,height:h.height,x:h.x,y:h.y,canvasWidth:c.width,canvasHeight:c.height,clipped,scroll:r.scrollHeight>r.clientHeight+1};
      })()`);
      assert.deepEqual(layout.clipped, [], 'HUD content clipped'); assert.equal(layout.scroll, false);
      assert(Math.abs(layout.width-layout.canvasWidth)<1&&Math.abs(layout.height-layout.canvasHeight)<1);
      assert.deepEqual(await evaluate(`({width:window.__GAME__.canvas.width,height:window.__GAME__.canvas.height})`),{width,height});
      const counts = [];
      for (const level of [1, 2, 3, 4]) {
        const count = await evaluate(`(()=>{
          const s=window.__GAME__.scene.getScene('PrototypeScene');s.scene.resume();
          s.health.invulnerableMs=60000;s.director.enemies.length=0;s.syncEnemyVisuals();s.clearEnemyShots();s.clearPlayerShots();
          s.setTestWeapon('ion',${level});s.firePrimary();
          const n=s.shots.length;
          for(const [i,kind]of ['scout','dart','lancer','cutter'].entries()){
            const e={id:9000+i,kind,phase:i===2?'telegraph':'approach',x:220+i*100,y:95+(i%2)*55,baseX:220+i*100,baseY:95,ageMs:0,phaseMs:0,hp:100,maxHp:100,secondShotFired:false};
            s.director.enemies.push(e);s.makeEnemyVisual(e);
          }
          s.syncEnemyVisuals();return n;
        })()`);
        assert.equal(count, level * 2 + 1); counts.push(count);
        await pause(190);
        await evaluate(`{window.__GAME__.scene.getScene('PrototypeScene').scene.pause();void 0;}`);
        await shot(`nolan-level-${level}-${width}x${height}`);
      }
      await evaluate(`(()=>{
        const s=window.__GAME__.scene.getScene('PrototypeScene');s.clearPlayerShots();s.pickups.clear();
        for(const[i,type]of ['power','full_power','weapon_ion','weapon_green','weapon_red','health','bomb','missile','score','special'].entries())s.pickups.spawn(type,210+(i%5)*85,220+Math.floor(i/5)*65);
        s.syncPickupVisuals();
      })()`);
      await shot(`nolan-pickups-${width}x${height}`);
      const progression = await evaluate(`(()=>{
        const s=window.__GAME__.scene.getScene('PrototypeScene');s.pickups.clear();s.setTestWeapon('ion',1,0);
        for(let i=0;i<3;i++){s.pickups.spawn('power',s.ship.x,s.ship.y);s.checkPickupCollisions();s.pickups.update(0,s.ship.x,s.ship.y);}
        const result={level:s.weapons.weaponLevel,meter:s.weapons.powerMeter,dashes:s.dashState.remainingDashes};
        s.pickups.clear();s.syncPickupVisuals();s.weapons.bombs=2;s.hud.setBombs(2);s.scene.resume();s.detonateBomb();
        result.bombs=s.weapons.bombs;result.hostileShots=s.enemyShots.length;return result;
      })()`);
      assert.equal(progression.level,2);assert.equal(progression.meter,0);assert.equal(progression.dashes,3);assert.equal(progression.bombs,1);assert.equal(progression.hostileShots,0);
      await pause(260);
      await evaluate(`{window.__GAME__.scene.getScene('PrototypeScene').scene.pause();void 0;}`);
      await shot(`nolan-bomb-${width}x${height}`);
      report.viewports.push({width,height,layout,shotCounts:counts,progression});
    }
    await evaluate(`{const s=window.__GAME__.scene.getScene('PrototypeScene');s.scene.resume();s.scene.restart({pilotId:'nolan',stageNumber:1});void 0;}`);
    await pause(300);
    const start = await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').ship.x`);
    await send('Input.dispatchKeyEvent', {type:'keyDown',key:'d',code:'KeyD',windowsVirtualKeyCode:68});
    await send('Input.dispatchKeyEvent', {type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await pause(200);
    await send('Input.dispatchKeyEvent', {type:'keyUp',key:'d',code:'KeyD',windowsVirtualKeyCode:68});
    await send('Input.dispatchKeyEvent', {type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
    assert(await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').ship.x`) > start+5);
    await key('Shift','ShiftLeft',16);
    assert.equal(await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').dashState.remainingDashes`),2);
    report.regression.movementFireDash=true;
    await click('#bw-combat-hud [data-action="restart"]');
    await waitFor(`document.querySelectorAll('#bw-combat-hud').length===1&&window.__GAME__.scene.getScene('PrototypeScene').dashState.remainingDashes===3`);
    await key('Escape','Escape',27);
    await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))&&!document.querySelector('#bw-combat-hud')`);
    await click('[data-action="profile"]');
    await imagesReady();
    const profileAfterCombat = await geometry();checkGeometry(profileAfterCombat,1920,1080);
    await key('Enter','Enter',13);await key('Enter','Enter',13);
    await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')&&Boolean(document.querySelector('#bw-combat-hud'))`);
    report.regression.restartAndProfileAfterCombat=true;
    for(const id of ['cora','harlan']) {
      await evaluate(`{const s=window.__GAME__.scene.getScene('PrototypeScene');s.scene.restart({pilotId:'${id}',stageNumber:1});void 0;}`);
      await waitFor(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id==='${id}'&&Boolean(document.querySelector('#bw-combat-hud'))`);
      await pause(100);
      assert.equal(await evaluate(`Boolean(window.__GAME__.scene.getScene('PrototypeScene').ship.paintedRivet)`),false);
      assert.deepEqual(await evaluate(`({width:window.__GAME__.canvas.width,height:window.__GAME__.canvas.height})`),{width:1920,height:1080});
      report.regression[id+'Unchanged']=true;
    }
    await evaluate(`{window.__GAME__.scene.getScene('PrototypeScene').scene.start('TitleScene');void 0;}`);
    await waitFor(`Boolean(document.querySelector('#bw-title-screen'))`);
    assert.equal(await evaluate(`document.querySelectorAll('#bw-combat-hud').length`),0);
    assert.deepEqual(errors,[], 'Browser errors');
    writeFileSync(join(screenshots,'validation.json'),JSON.stringify(report,null,2)+'\n');
    console.log('PASS: Stage 1 painted art, HUD at both resolutions, 3/5/7/9 projectiles, P collection, bombs, movement/dash, other ships preserved, HUD lifecycle, zero browser errors.');
  }
} finally {
  socket?.close(); chrome.kill(); server.close();
}
