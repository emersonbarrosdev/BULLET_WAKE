/** Production-build visual QA: both desktop viewports, all pilots and profiles. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const stage1 = process.argv.includes('--stage1');
const confirmation = !stage1;
const screenshots = resolve(confirmation ? 'docs/screenshots/pilot-confirmation' : stage1 ? 'docs/screenshots/stage1-visual' : 'docs/screenshots/pilot-selection-final');
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
    throw new Error('Timed out: ' + expression);
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
  if (confirmation) {
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
      assert.deepEqual(await evaluate(`({width:window.__GAME__.canvas.width,height:window.__GAME__.canvas.height,zoom:window.__GAME__.scene.getScene('PrototypeScene').cameras.main.zoom})`),{width:1920,height:1080,zoom:2.5});
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
      await waitFor(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id==='${id}'&&!document.querySelector('#bw-combat-hud')`);
      await pause(100);
      assert.equal(await evaluate(`Boolean(window.__GAME__.scene.getScene('PrototypeScene').ship.paintedRivet)`),false);
      assert.deepEqual(await evaluate(`({width:window.__GAME__.canvas.width,zoom:window.__GAME__.scene.getScene('PrototypeScene').cameras.main.zoom})`),{width:768,zoom:1});
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
