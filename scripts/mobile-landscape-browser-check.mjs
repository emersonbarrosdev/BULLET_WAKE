/** Isolated visual/integration QA. Virtual browser inputs and measured RAF are not physical hardware certification. */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { qaGameAccess } from './qa-game-access.mjs';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const out = resolve('output/android-layout/landscape'); mkdirSync(out, { recursive: true });
const report = { status: 'running', errors: [], captures: [], states: [], repairs: [], inputs: {}, performance: [], limitations: ['Browser emulation only; physical Android/controllers and human playtests are not certified.'] };
const server = await createServer({ plugins: [qaGameAccess()], configFile: resolve('vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: { ignored: ['**/tmp/**', '**/dist/**', '**/output/**'] } } });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const profile = mkdtempSync(join(tmpdir(), 'bw-hull-qa-'));
const chrome = spawn(process.env.CHROME_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'), ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 120 && !target; i++) {
    try { const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* Browser startup. */ }
    if (!target) await sleep(100);
  }
  assert(target, 'Isolated Chrome did not start');
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
  const pending = new Map(); let seq = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); if (!p) return; pending.delete(message.id); clearTimeout(p.timer); message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result); }
    else if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails);
    else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') report.errors.push(message.params.entry);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timed out: ' + method)); }, 40000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const wait = async expression => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await sleep(100); } throw new Error('Timed out: ' + expression); };
  const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))');
  const shot = async (name, crop = false) => {
    await settle();
    const params = { format: 'png', captureBeyondViewport: false };
    if (crop) params.clip = await evaluate(`(()=>{const c=s.cameras.main,r=s.game.canvas.getBoundingClientRect(),a=c.getWorldPoint(0,0),b=c.getWorldPoint(c.width,c.height),side=160;const px=r.left+(s.world.player.x-a.x)/(b.x-a.x)*r.width,py=r.top+(s.world.player.y-a.y)/(b.y-a.y)*r.height;const x=Math.max(0,Math.min(innerWidth-side,px-side/2)),y=Math.max(0,Math.min(innerHeight-side,py-side/2));return{x,y,width:side,height:side,scale:3};})()`);
    const result = await send('Page.captureScreenshot', params), buffer = Buffer.from(result.data, 'base64');
    assert(buffer.length > 2000 && buffer.subarray(1, 4).toString() === 'PNG', 'Invalid screenshot ' + name);
    writeFileSync(join(out, name + '.png'), buffer);
    report.captures.push({ name, bytes: buffer.length, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 774, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url });
  await wait(`!!window.__GAME__?.scene.getScene('ArcadeScene')?.hullArt`);
  await evaluate(`(async()=>{window.s=window.__GAME__.scene.getScene('ArcadeScene');s.setDevSaveGuard(true);s.audio.setMix(0,0,true);const p=await import('/src/game/arcade/ArcadeProfileStore.ts');window.store=p.globalProfileStore;store.updateSettings({survivalRule:'hull-v1'});window.save=(await import('/src/game/systems/saveSystem.ts')).globalSave;s.show('title');s.scene.pause();})()`);
  const inspect = async name => {
    await evaluate(`Promise.all([...document.querySelectorAll('.bw-mobile img')].map(i=>i.decode()))`);
    await settle();
    const layout = await evaluate(`(()=>{const r=document.querySelector('.bw-mobile');return{screen:r?.dataset.screen,overflow:document.documentElement.scrollWidth>innerWidth||r.scrollWidth>r.clientWidth,small:[...r.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height<43).map(b=>b.textContent),zoomX:s.cameras.main.zoomX,zoomY:s.cameras.main.zoomY,canvas:[s.game.canvas.width,s.game.canvas.height],viewport:[innerWidth,innerHeight],footer:r.querySelector('footer').getBoundingClientRect().bottom};})()`);
    assert(!layout.overflow, 'Horizontal overflow: '+name);
    assert.equal(layout.small.length,0,'Undersized targets: '+name+' '+layout.small.join(','));
    assert(Math.abs(layout.zoomX-layout.zoomY)<.0001,'Distorted camera '+name);
    assert(layout.canvas[0]>=layout.viewport[0]*1.9,'Low-density canvas '+name);
    assert(layout.footer<=layout.viewport[1]+1,'Footer clipped '+name);
    report.states.push({name,...layout}); await shot(name);
  };

  const click = async label => { await evaluate("(()=>{const b=[...document.querySelectorAll('.bw-mobile button')].find(b=>b.textContent.trim()==="+JSON.stringify(label)+"||b.getAttribute('aria-label')==="+JSON.stringify(label)+");if(!b)throw Error('Missing button: '+"+JSON.stringify(label)+");b.click();return true})()"); await sleep(150); };
  await evaluate("store.markWelcomeSeen();s.show('title');true");
  await inspect('portrait-dashboard');
  await evaluate("document.querySelector('.bw-dash-profile').click();true"); await sleep(150);
  assert.equal(await evaluate('s.screen'),'hangar');
  assert.equal(await evaluate('s.hangarTab'),'profile');
  assert.deepEqual(await evaluate("[...document.querySelectorAll('.bw-mobile-tabs button')].map(b=>b.textContent.trim())"),['Perfil','Pinturas','Conquistas']);
  await click('Voltar');assert.equal(await evaluate('s.screen'),'title');
  for(const label of ['Pilotos','Hangar','Controles','Créditos']){await click(label);await click('Voltar');assert.equal(await evaluate('s.screen'),'title');}
  await click('Configurações');
  assert.equal(await evaluate('s.screen'),'settings');
  assert(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Paisagem').disabled"));
  await click('Voltar');assert.equal(await evaluate('s.screen'),'title');
  const start=await evaluate("getComputedStyle(document.querySelector('.bw-mobile-flyby')).transform");await sleep(250);
  assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.bw-mobile-flyby')).transform"),start,'Planes are not flying');
  // Real scene updates + virtual standard controller; the connection press cannot accept its own dialog.
  await evaluate("window.pad={id:'GameSir standard USB/Bluetooth test',mapping:'standard',connected:true,axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};pad.buttons[0]={pressed:true,value:1};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>pad.connected?[pad]:[]});s.scene.resume();true");
  await wait("s.screen==='controller-orientation'");await sleep(200);assert.equal(await evaluate('s.screen'),'controller-orientation');
  await inspect('controller-connect-dialog');
  await click('Continuar em retrato');await sleep(350);assert.equal(await evaluate('s.screen'),'title');
  await evaluate("pad.buttons[0]={pressed:false,value:0};true");await sleep(60);
  const tap = async i => {await evaluate('pad.buttons['+i+']={pressed:true,value:1};true');await sleep(65);await evaluate('pad.buttons['+i+']={pressed:false,value:0};true');await sleep(65);};
  await tap(13); // focuses first interactive element: profile chip
  assert(await evaluate("document.activeElement.classList.contains('bw-dash-profile')"));
  await tap(0);assert.equal(await evaluate('s.screen'),'hangar');assert.equal(await evaluate('s.hangarTab'),'profile');
  await tap(1);assert.equal(await evaluate('s.screen'),'title');
  await evaluate("pad.connected=false;true");await sleep(100);
  await evaluate("pad.connected=true;true");await wait("s.screen==='controller-orientation'");
  await click('Usar paisagem');await wait('s.landscapeEnabled');
  for(const [width,height] of [[800,360],[640,320],[915,412]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await sleep(150);
    await evaluate("s.disposeWorld();s.show('title');s.scene.pause();true");
    for(const screen of ['title','pilot','hangar','controls','settings','touch-settings','credits']){
      await evaluate('s.show('+JSON.stringify(screen)+')');await inspect(width+'-landscape-'+screen);
      if (screen === 'pilot') {
        const diff = await evaluate("(()=>{const sc=document.querySelector('.bw-mobile-scroll');return sc.scrollHeight-sc.clientHeight;})()");
        assert(diff <= 2, `Landscape pilot select overflowed (${width}x${height}): ${diff}px`);
      }
    }
    await evaluate("s.begin(0,undefined,{practiceMode:true});s.world.state='play';s.world.introTime=0;s.world.player.invulnerable=1000;s.backdrop.draw(s.clock,s.world,s.quality,true);s.renderWorld(0);true");
    const fit=await evaluate("(()=>{const c=s.cameras.main,h=document.querySelector('.bw-mobile-flight').getBoundingClientRect();return{x:c.x,width:c.width,zoomX:c.zoomX,zoomY:c.zoomY,sidebar:h.width,touch:s.touchShown,desktop:s.pelagicDesktopHud.visible,arena:{...s.world.arena}}})()");
    assert(fit.x>0&&fit.sidebar>=136);assert.equal(fit.zoomX,fit.zoomY);assert(!fit.touch&&!fit.desktop);report.inputs[width+'-landscape']=fit;await shot(width+'-landscape-gameplay');
    const arena=await evaluate('JSON.stringify(s.world.arena)');
    for(const screen of ['pause','controls','settings','confirm-exit','defeat','result']){await evaluate('s.show('+JSON.stringify(screen)+')');await inspect(width+'-landscape-'+screen);assert.equal(await evaluate('JSON.stringify(s.world.arena)'),arena);}
  }
  // Rotate an ongoing portrait sortie: all actor/player/projectile coordinates and replay geometry stay intact.
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:774,deviceScaleFactor:2,mobile:true});await sleep(150);
  await evaluate("s.begin(0,undefined,{practiceMode:true});s.world.state='play';s.world.introTime=0;s.world.player.invulnerable=1000;s.world.step(.1,{x:0,y:0,fire:true,special:false});s.show('pause');true");
  const geometry=await evaluate('JSON.stringify({arena:s.world.arena,player:s.world.player,bullets:s.world.bullets.filter(b=>b.active),enemies:s.world.enemies})');
  await send('Emulation.setDeviceMetricsOverride',{width:800,height:360,deviceScaleFactor:2,mobile:true});await sleep(150);
  assert.equal(await evaluate('JSON.stringify({arena:s.world.arena,player:s.world.player,bullets:s.world.bullets.filter(b=>b.active),enemies:s.world.enemies})'),geometry);
  const beforeMove=await evaluate('s.world.player.x');
  await evaluate("s.show('play');s.scene.resume();pad.axes=[1,0];true");await sleep(200);
  assert(await evaluate('s.world.player.x')>beforeMove,'Landscape controller did not move the ship');
  assert(await evaluate('s.lastInput.x>.5&&s.lastInput.fire'),'Landscape controller movement/automatic fire');
  await evaluate("pad.axes=[0,0];pad.buttons[2]={pressed:true,value:1};true");await wait('s.world.chargedShot.ratio>.55');
  assert(await evaluate('s.world.chargedShot.ratio>.55'),'Landscape controller charge');
  await evaluate("pad.buttons[2]={pressed:false,value:0};true");await wait('s.world.bullets.some(b=>b.active&&b.charged)');
  const beforeSpecial=await evaluate('s.world.weapons.specialCharges');
  await evaluate("pad.buttons[0]={pressed:true,value:1};true");await wait('s.world.weapons.specialCharges<'+beforeSpecial);
  await evaluate("pad.connected=false;true");await wait("s.screen==='controller-lost'");
  const elapsed=await evaluate('s.world.elapsed');await sleep(250);assert.equal(await evaluate('s.world.elapsed'),elapsed,'Disconnect must pause simulation');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:774,deviceScaleFactor:2,mobile:true});await sleep(150);await inspect('controller-lost-portrait');
  await click('Continuar');assert.equal(await evaluate('s.screen'),'pause');await evaluate("s.show('play');true");await sleep(100);assert(await evaluate('s.touchShown'),'Touch controls not restored');
  await shot('portrait-restored-after-disconnect');

  await evaluate("pad.connected=true;pad.buttons[0]={pressed:false,value:0};true");await wait("s.screen==='controller-orientation'");await click('Usar paisagem');await wait('s.landscapeEnabled');
  await send('Emulation.setDeviceMetricsOverride',{width:800,height:360,deviceScaleFactor:2,mobile:true});await sleep(150);
  await evaluate("s.begin(0,undefined,{practiceMode:true});s.world.state='play';s.world.introTime=0;s.world.player.invulnerable=1000;s.show('pause');true");
  const wideArena=await evaluate('JSON.stringify(s.world.arena)');
  await evaluate("s.pauseOrigin='pause';s.show('settings');true");await click('Retrato');await wait('!s.landscapeEnabled');
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:774,deviceScaleFactor:2,mobile:true});await sleep(150);
  await evaluate("s.show('play');true");await sleep(150);
  assert.equal(await evaluate('JSON.stringify(s.world.arena)'),wideArena);
  const targets=await evaluate("(()=>{const l=s.touchController.getLayout(),c=s.cameras.main,r=s.game.canvas.getBoundingClientRect();return ['joystick','charge','special','pause'].map(k=>{const p=l[k];return{k,x:r.left+(c.x+(p.x-c.scrollX)*c.zoomX)*r.width/s.game.canvas.width,y:r.top+(c.y+(p.y-c.scrollY)*c.zoomY)*r.height/s.game.canvas.height}})})()");
  assert(targets.every(p=>p.x>=0&&p.x<=360&&p.y>=0&&p.y<=774),'Touch targets after rotation: '+JSON.stringify(targets));
  report.inputs.wideSortiePortraitTargets=targets;
  await evaluate("(()=>{const p=s.touchController.getLayout().charge;s.touchController.onPointerDown(88,p.x,p.y)})()");await wait('s.world.chargedShot.ratio>.55');
  await evaluate('s.touchController.onPointerUp(88)');await wait('s.world.bullets.some(b=>b.active&&b.charged)');
  await shot('portrait-controls-after-wide-sortie');
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='passed';
} catch(error) {report.status='failed';report.failure=error.stack;console.error(error);process.exitCode=1;}
finally {writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));socket?.close();chrome.kill();await server.close();console.log(JSON.stringify({status:report.status,captures:report.captures.length,states:report.states.length,errors:report.errors.length,failure:report.failure,inputs:report.inputs}));}
