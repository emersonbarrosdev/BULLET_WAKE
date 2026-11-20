/** Isolated visual/integration QA. Virtual browser inputs and measured RAF are not physical hardware certification. */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { PELAGIC_RIVET_SHEET } from '../src/game/arcade/PelagicActorAnimsMath.ts';

const out = resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'docs/screenshots/hull'); mkdirSync(out, { recursive: true });
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
  const snapshot = () => evaluate(`(()=>{const w=s.world;return{mission:w.mission.id,hull:w.hull,maximum:w.hullMaximum,condition:w.hullState,power:w.weapons.weaponLevel,meter:w.weapons.powerMeter,hits:w.hitsReceived,deaths:w.deaths,state:w.state,repairs:w.repairsCollected,art:s.hullArt.snapshot(),playerVisible:s.player.visible,playerTexture:s.player.texture.key,oldLivesVisible:s.lifeIcons.some(i=>i.visible),footer:{visible:s.footerScore.visible,text:s.footerScore.text,y:s.footerScore.y},hud:s.hud.text};})()`);
  const reset = async index => {
    await evaluate(`(()=>{s.scene.resume();s.setDevSaveGuard(true);s.begin(${index});s.setDevSimulationPaused(true);const w=s.world;w.state='play';w.introTime=0;w.enemies=[];w.cargo=[];w.obstacles=[];w.bullets.forEach(b=>b.active=false);w.weapons.weaponLevel=5;w.weapons.powerMeter=0;w.player.invulnerable=0;w.player.x=w.up?w.arenaCenterX:310;w.player.y=w.up?Math.min(w.arena.bottom-125,295):230;s.shakeTime=0;s.damageFlashAlpha=0;s.backdrop.draw(w.elapsed,w,s.quality,false);s.renderWorld(0);s.scene.pause();})()`);
    await settle();
  };
  const damage = async (advance = .28) => evaluate(`(()=>{const w=s.world;w.player.invulnerable=0;w.hurtPlayer();const events=w.events.map(e=>e.type);const hull=w.hull,hits=w.hitsReceived;w.hurtPlayer();const guarded=w.hull===hull&&w.hitsReceived===hits;s.consumeEvents();s.renderWorld(${advance});return{events,guarded,hull:w.hull,condition:w.hullState,power:w.weapons.weaponLevel};})()`);
  const point = async (x, y) => evaluate(`(()=>{const c=s.cameras.main,r=s.game.canvas.getBoundingClientRect(),p=c.matrix.transformPoint(${x}-c.scrollX,${y}-c.scrollY);return{x:r.left+p.x*r.width/s.game.canvas.width,y:r.top+p.y*r.height/s.game.canvas.height};})()`);
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url });
  await wait(`window.__GAME__?.scene.isActive('ArcadeScene')&&!!window.__GAME__.scene.getScene('ArcadeScene').hullArt`);
  await evaluate(`(async()=>{window.s=window.__GAME__.scene.getScene('ArcadeScene');s.setDevSaveGuard(true);const{globalProfileStore}=await import('/src/game/arcade/ArcadeProfileStore.ts');globalProfileStore.updateSettings({survivalRule:'hull-v1',difficulty:'normal'});s.selectedPilotId='nolan';s.audio.setMix(0,0,true);})()`);
  report.textures = await evaluate(`['hull-scars-up','hull-scars-side','hull-smoke','hull-flame','hull-spark','hull-repair','hull-destruction','hull-repair-pickup','arc-rivet',${JSON.stringify(PELAGIC_RIVET_SHEET)}].map(key=>{const t=s.textures.get(key),im=t.getSourceImage();return{key,actualKey:t.key,width:im.width,height:im.height,frames:t.frameTotal-1};})`);
  // Original UP key is obtained from the actual renderer, not guessed from the new overlays.
  await reset(0);
  const originalUp = (await snapshot()).playerTexture;
  assert.equal(originalUp, PELAGIC_RIVET_SHEET, 'Approved animated UP RIVET texture must remain');
  assert(report.textures.every(t => t.actualKey === t.key && t.width > 0 && t.height > 0), 'Missing original or hull texture');

  for (const index of [0, 1]) {
    await reset(index);
    for (const [hit, state] of ['intact', 'light', 'damaged', 'critical', 'destroyed'].entries()) {
      if (hit) {
        const result = await damage(hit === 1 ? .2 : .28);
        assert(result.guarded, 'Invulnerability/defeat must block duplicate damage');
        assert.equal(result.condition, state); assert.equal(result.hull, 4 - hit);
        if (hit < 4) assert.equal(result.power, 5 - hit);
        else { assert.equal(result.events.filter(e => e === 'death').length, 1); assert.equal(result.events.filter(e => e === 'defeat').length, 1); }
      }
      const record = await snapshot();
      assert.equal(record.condition, state); assert.equal(record.art.objects, 12); assert(!record.oldLivesVisible, 'Classic lives icons leaked into hull HUD');
      assert.equal(record.playerTexture, index === 0 ? originalUp : 'arc-rivet', 'Ship texture replaced by damage art');
      if (hit === 4) { assert.equal(record.deaths, 1); assert.equal(record.state, 'defeat'); assert.equal(record.playerVisible, false, 'Destroyed RIVET must disappear'); }
      else assert(record.playerVisible);
      if (index === 1) assert(record.footer.visible && record.footer.y >= 420, 'SIDE score must be below the combat arena');
      report.states.push(record); await shot(`mission-${index + 1}-${state}`); await shot(`mission-${index + 1}-${state}-detail`, true);
    }
    await reset(index); await damage(); await damage(); await damage();
    for (let expected = 2; expected <= 4; expected++) {
      const before = await snapshot();
      await evaluate(`(()=>{s.world.devSpawnCargoItem('repair');const c=s.world.cargo.at(-1);c.y=s.world.player.y-55;c.vy=0;s.renderWorld(0);})()`);
      await shot(`mission-${index + 1}-repair-${expected}-item`, true);
      const collection = await evaluate(`(()=>{const w=s.world,c=w.cargo.at(-1);c.x=w.player.x;c.y=w.player.y;c.vx=c.vy=0;const id=c.id;w.step(1/120,{x:0,y:0,fire:false,special:false});const events=w.events.map(e=>({type:e.type,text:e.text}));s.consumeEvents();s.renderWorld(.12);return{id,removed:!w.cargo.some(item=>item.id===id),events};})()`);
      const after = await snapshot();
      assert(collection.removed, 'Physical repair capsule must be consumed'); assert(collection.events.some(e => e.type === 'repair'));
      assert.equal(after.hull, expected); assert.equal(after.power, before.power, 'REPAIR must not restore POWER'); assert.equal(after.meter, before.meter); assert.equal(after.repairs, expected - 1);
      assert(after.art.repairActive); report.repairs.push({ before, after, collection });
      await shot(`mission-${index + 1}-repair-${expected}`); await shot(`mission-${index + 1}-repair-${expected}-detail`, true);
    }
  }

  await reset(0); await damage(); await damage(); await damage();
  report.pause = await evaluate(`(()=>{const before=s.hullArt.snapshot();const state=JSON.stringify({h:s.world.hull,p:s.world.player,weapons:s.world.weapons});for(let i=0;i<60;i++)s.renderWorld(0);return{before,after:s.hullArt.snapshot(),gameplayUnchanged:state===JSON.stringify({h:s.world.hull,p:s.world.player,weapons:s.world.weapons})};})()`);
  assert.equal(report.pause.after.clock, report.pause.before.clock); assert(report.pause.gameplayUnchanged);
  report.renderRates = await evaluate(`(()=>{const results=[];for(const fps of [30,60,120]){s.hullArt.clear();const p=s.player,w=s.world;const before={x:p.x,y:p.y,width:p.displayWidth,height:p.displayHeight,hull:w.hull};for(let i=0;i<fps*2;i++)s.hullArt.update(w,p,1/fps);results.push({fps,clock:s.hullArt.snapshot().clock,objects:s.hullArt.snapshot().objects,unchanged:JSON.stringify(before)===JSON.stringify({x:p.x,y:p.y,width:p.displayWidth,height:p.displayHeight,hull:w.hull})});}return results;})()`);
  for (const rate of report.renderRates) { assert(Math.abs(rate.clock - 2) < 1e-8); assert.equal(rate.objects, 12); assert(rate.unchanged); }
  const counts = [];
  for (let i = 0; i < 8; i++) { await reset(i % 2); counts.push(await evaluate(`s.children.list.filter(o=>o.texture?.key.startsWith('hull-')).length`)); }
  assert(counts.every(n => n === 12), 'Restart leaked hull sprites: ' + JSON.stringify(counts)); report.restartCounts = counts;

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await sleep(200);
  await reset(0); await damage(); await damage(); await damage();
  report.mobile = await snapshot();
  const mobileLayout = await evaluate(`(()=>{s.refreshTouchLayout();s.setTouchVisible(true);s.renderTouchOverlay();return{controls:s.touchController.getLayout(),height:s.cameras.main.height/s.cameras.main.zoomY,portrait:s.portraitUpActive};})()`);
  assert(mobileLayout.portrait); assert(report.mobile.footer.visible && report.mobile.footer.y > mobileLayout.height - 15); assert.match(report.mobile.hud, /1\/4/); assert(!report.mobile.oldLivesVisible);
  await shot('mobile-portrait-critical');
  await evaluate(`(()=>{s.scene.resume();s.setDevSimulationPaused(false);s.world.player.invulnerable=100;s.world.player.y=390;s.world.enemies=[];s.world.bullets.forEach(b=>b.active=false);})()`);
  await sleep(100);
  assert(await evaluate('s.lastInput.fire&&!s.touchFireText.visible'), 'Android must auto-fire without a primary-fire button');
  const layout = mobileLayout.controls, joy = await point(layout.joystick.x, layout.joystick.y), drag = await point(layout.joystick.x + 20, layout.joystick.y - 28), charge = await point(layout.charge.x, layout.charge.y);
  const beforeY = await evaluate('s.world.player.y');
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...joy, id: 0 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...drag, id: 0 }] });
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...drag, id: 0 }, { ...charge, id: 1 }] }); await sleep(250);
  report.inputs.touch = await evaluate(`({moved:s.world.player.y<${beforeY},fired:s.world.bullets.some(b=>b.active&&!b.enemy),held:s.touchController.peek().charge,charging:s.world.chargedShot.ratio>0,critical:s.world.hull===1})`);
  assert(report.inputs.touch.moved && report.inputs.touch.held && report.inputs.touch.charging && report.inputs.touch.critical, 'Touch movement/charge failed in critical state');
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(70); assert.equal(await evaluate('s.touchController.peek().charge'), false);
  const pausePoint = await point(layout.pause.x, layout.pause.y);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...pausePoint, id: 2 }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(80); assert.equal(await evaluate('s.screen'), 'pause'); report.inputs.touch.pause = true;
  await shot('mobile-touch-pause');

  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false }); await sleep(180);
  report.inputs.gamepads = [];
  for (const id of ['Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'Sony DualSense Wireless Controller (Vendor: 054c Product: 0ce6)']) {
    await reset(0);
    await evaluate(`(()=>{s.scene.resume();s.setDevSimulationPaused(false);s.world.player.invulnerable=100;window.pad={id:${JSON.stringify(id)},connected:true,mapping:'standard',axes:[.8,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});window.beforePadX=s.world.player.x;})()`);
    // Returning from a menu deliberately suppresses held FIRE until a release is sampled.
    await sleep(70); await evaluate(`pad.buttons[1]={pressed:true,value:1}`);
    await sleep(220);
    const result = await evaluate(`({id:pad.id,moved:s.world.player.x>beforePadX,fired:s.world.bullets.some(b=>b.active&&!b.enemy),screen:s.screen,x:s.world.player.x,beforeX:beforePadX,lastInput:s.lastInput,suppressed:s.suppressHeldFireUntilRelease})`); report.inputs.gamepads.push(result); assert(result.moved && result.fired, JSON.stringify(result));
    await evaluate(`pad.buttons[9]={pressed:true,value:1}`); await sleep(100); assert.equal(await evaluate('s.screen'), 'pause'); result.pause = true;
    await evaluate(`Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]})`); await sleep(50);
  }

  if (!process.argv.includes('--skip-performance')) for (const quality of [0, 2]) {
    await reset(0); await damage(); await damage(); await damage();
    await evaluate(`(()=>{s.quality=${quality};s.world.player.invulnerable=100;s.scene.resume();s.setDevSimulationPaused(false);})()`);
    const measured = await evaluate(`new Promise(resolve=>{const samples=[];let previous=performance.now(),start=previous,peak=0;function frame(now){samples.push(now-previous);previous=now;peak=Math.max(peak,s.hullArt.snapshot().visible);if(now-start<8000)requestAnimationFrame(frame);else{samples.shift();samples.sort((a,b)=>a-b);resolve({quality:${quality},seconds:(now-start)/1000,frames:samples.length,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],objects:s.hullArt.snapshot().objects,peakVisible:peak,critical:s.world.hull===1,heap:performance.memory?.usedJSHeapSize});}}requestAnimationFrame(frame);})`);
    assert(measured.frames > 30 && measured.critical && measured.objects === 12); report.performance.push(measured);
  }
  report.renderer = await evaluate(`(()=>{const gl=s.game.renderer.gl,ext=gl?.getExtension('WEBGL_debug_renderer_info');return{type:s.game.renderer.type,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};})()`);
  assert.deepEqual(report.errors, [], 'Browser runtime errors'); report.status = 'passed';
  console.log(JSON.stringify({ status: report.status, captures: report.captures.length, states: report.states.length, repairs: report.repairs.length, performance: report.performance, errors: report.errors.length }, null, 2));
} catch (error) {
  report.status = 'failed'; report.failure = error.stack ?? String(error); throw error;
} finally {
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  socket?.close(); chrome.kill(); await server.close();
}
