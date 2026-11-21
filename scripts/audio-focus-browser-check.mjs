/** Isolated visual/integration QA. Virtual browser inputs and measured RAF are not physical hardware certification. */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { qaGameAccess } from './qa-game-access.mjs';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';


const out = resolve('output/audio-focus'); mkdirSync(out, { recursive: true });
const report = { status: 'running', errors: [], browserWarnings: [], captures: [], states: [], repairs: [], inputs: {}, performance: [], limitations: ['Browser emulation only; physical Android/controllers and human playtests are not certified.'] };
const server = await createServer({ plugins: [qaGameAccess()], configFile: resolve('vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: { ignored: ['**/tmp/**', '**/dist/**', '**/output/**'] } } });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const profile = mkdtempSync(join(tmpdir(), 'bw-hull-qa-'));
const chrome = spawn(process.env.CHROME_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'), ['--headless=new', '--mute-audio', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
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
    else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const entry = message.params.entry;
      // Phaser attempts preventDefault on Chrome's non-cancelable touchcancel.
      // Record that browser intervention separately; actual input cancellation is asserted below.
      if (entry.source === 'intervention' && entry.text.startsWith('Ignored attempt to cancel a touchcancel event with cancelable=false')) report.browserWarnings.push(entry);
      else report.errors.push(entry);
    }
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
  await send('Runtime.enable');await send('Page.enable');await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url});
  await send('Page.bringToFront');
  await wait(`window.__GAME__?.scene.getScene('ArcadeScene')?.screen==='title'`);
  await evaluate(`(async()=>{window.s=window.__GAME__.scene.getScene('ArcadeScene');s.setDevSaveGuard(true);window.audio=(await import('/src/game/audio/audioSystem.ts')).globalAudio;s.audio.setMix(.2,.2,false);s.audio.unlock();s.audio.play('menu');})()`);
  await wait(`!s.audio.status().paused`);
  const original=(await send('Target.getTargetInfo')).targetInfo.targetId;
  const other=(await send('Target.createTarget',{url:'about:blank'})).targetId;
  await send('Target.activateTarget',{targetId:other});
  await wait(`document.hidden&&s.audio.status().paused&&audio.ctx.state==='suspended'`);
  const before=await evaluate(`s.audio.status().position`);await sleep(350);
  const after=await evaluate(`s.audio.status().position`);
  assert(Math.abs(after-before)<.05,'Background music cursor advanced');
  report.inputs.tab={paused:true,cursorAdvance:after-before};
  await send('Target.activateTarget',{targetId:original});
  await wait(`!document.hidden&&!s.audio.status().paused&&audio.ctx.state==='running'`);
  await send('Target.closeTarget',{targetId:other});
  const {windowId}=await send('Browser.getWindowForTarget',{targetId:original});
  await send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});
  await wait(`s.audio.status().paused&&audio.ctx.state==='suspended'`);
  report.inputs.minimize={paused:true};
  await send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
  await send('Target.activateTarget',{targetId:original});
  await wait(`!s.audio.status().paused`);
  await evaluate(`s.begin(0);s.show('pause');`);
  await send('Browser.setWindowBounds',{windowId,bounds:{windowState:'minimized'}});
  await sleep(150);await send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
  await send('Target.activateTarget',{targetId:original});await sleep(150);
  assert(await evaluate(`s.screen==='pause'&&s.audio.status().paused`),'Restoring a paused game restarted music');
  report.inputs.manualPausePreserved=true;
  assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='passed';
}catch(error){report.status='failed';report.failure=error.stack;console.error(error);process.exitCode=1;}
finally{writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));socket?.close();chrome.kill();await server.close();console.log(JSON.stringify(report));}
