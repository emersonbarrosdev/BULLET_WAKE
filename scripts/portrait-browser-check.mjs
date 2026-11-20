/** Isolated visual/integration QA. Virtual browser inputs and measured RAF are not physical hardware certification. */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { PELAGIC_RIVET_SHEET } from '../src/game/arcade/PelagicActorAnimsMath.ts';

const out = resolve('output/android-layout'); mkdirSync(out, { recursive: true });
const report = { status: 'running', errors: [], captures: [], states: [], repairs: [], inputs: {}, performance: [], limitations: ['Browser emulation only; physical Android/controllers and human playtests are not certified.'] };
const server = await createServer({ configFile: resolve('vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false } });
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
  for (const [width,height] of (process.argv.includes('--side-only') ? [] : [[360,774],[320,640],[412,915]])) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});await sleep(180);
    await evaluate(`s.disposeWorld();s.show('title');`);
    await evaluate(`Promise.all([...document.querySelectorAll('.bw-mobile img')].map(i=>i.decode()))`);
    const title=await evaluate(`(()=>{const logo=document.querySelector('.bw-mobile-brand img').getBoundingClientRect(),buttons=[...document.querySelectorAll('.bw-mobile-body>.bw-mobile-button')].map(b=>b.getBoundingClientRect());return{logo:{top:logo.top,width:logo.width},gap:buttons[1].top-buttons[0].bottom,height:buttons[0].height};})()`);
    assert(title.logo.width>=width*.80,'Small title logo');assert(title.logo.top<height*.2,'Logo too low');assert(title.gap>=14,'Crowded title buttons');assert(title.height>=54);
    for (const screen of ['title','pilot','missions','practice','credits','controls','settings','touch-settings','hangar']) {
      await evaluate(`s.show(${JSON.stringify(screen)})`);await inspect(`${width}-${screen}`);
    }
    for (const tab of ['pc','gamepad','android']) {await evaluate(`s.controlsTab='${tab}';s.show('controls')`);await inspect(`${width}-controls-${tab}`);}
    for (const tab of ['achievements','profile']) {await evaluate(`s.hangarTab='${tab}';s.show('hangar')`);await inspect(`${width}-hangar-${tab}`);}
    await evaluate(`s.hangarTab='hangar';s.begin(0);s.world.introTime=0;s.world.state='play';s.world.player.invulnerable=1000;`);
    const arena=await evaluate('JSON.stringify(s.world.arena)');
    for (const screen of ['pause','controls','settings','touch-settings','confirm-exit','defeat','result']) {
      await evaluate(`if('${screen}'==='defeat'){s.world.hull=0;s.world.state='defeat';}if('${screen}'==='result'){s.world.hull=2;s.world.state='victory';}s.show('${screen}')`);await inspect(`${width}-${screen}-ingame`);
      assert.equal(await evaluate('JSON.stringify(s.world.arena)'),arena,'Opening '+screen+' changed portrait arena');
    }
    await evaluate(`s.show('ending')`);await inspect(`${width}-ending`);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:774,deviceScaleFactor:2,mobile:true});await sleep(150);
  await evaluate(`s.begin(0);s.world.introTime=0;s.world.state='play';s.world.player.invulnerable=1000;s.scene.resume();true`);
  await sleep(600);
  const auto=await evaluate(`({fire:s.lastInput.fire,primaryButton:s.touchFireText.visible,bullets:s.world.bullets.filter(b=>b.active&&!b.enemy).length,touch:s.touchShown,ratio:s.game.canvas.width/s.game.canvas.clientWidth})`);
  assert(auto.fire&&!auto.primaryButton&&auto.bullets>0,'Android must shoot without touching FIRE: '+JSON.stringify(auto));report.inputs.autofire=auto;
  await shot('360-gameplay-autofire');
  await evaluate(`(()=>{const l=s.touchController.getLayout();s.touchController.onPointerDown(80,l.charge.x,l.charge.y)})()`);await sleep(400);
  assert(await evaluate('s.world.chargedShot.ratio>0'),'Charge hold did not charge');
  await evaluate('s.touchController.onPointerUp(80)');await sleep(100);
  assert(await evaluate('s.world.bullets.some(b=>b.active&&b.charged)'),'Charge release did not fire');
  await evaluate(`s.show('pause');s.scene.pause();true`);await inspect('360-pause-after-charge');
  await evaluate(`s.begin(1);s.world.state='play';s.world.introTime=0;s.backdrop.draw(s.clock,s.world,s.quality,true);s.renderWorld(0);s.scene.pause();true`);await shot('360-side-proportions');
  console.log(JSON.stringify(await evaluate(`({pause:s.pauseBtn?{x:s.pauseBtn.x,y:s.pauseBtn.y,visible:s.pauseBtn.visible,parent:s.pauseBtn.parentContainer?.visible}:null,ui:{x:s.ui.x,y:s.ui.y,visible:s.ui.visible},layout:s.touchController.getLayout().pause,camera:{scrollY:s.cameras.main.scrollY,zoomY:s.cameras.main.zoomY}})`)));
  assert(await evaluate('s.cameras.main.zoomX===s.cameras.main.zoomY'),'SIDE distorted');
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='passed';
} catch(error) {report.status='failed';report.failure=error.stack;console.error(error);process.exitCode=1;}
finally {writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));socket?.close();chrome.kill();await server.close();console.log(JSON.stringify({status:report.status,captures:report.captures.length,states:report.states.length,errors:report.errors.length,failure:report.failure,inputs:report.inputs}));}
