import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer as createViteDevServer } from 'vite';
import { steer } from './arcade-route.mjs';
const root = resolve('dist'), out = resolve('docs/screenshots/cartoon'); mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg' };
const server = createServer((req, res) => { const p = new URL(req.url, 'http://localhost').pathname; const file = resolve(root, '.' + (p === '/' ? '/index.html' : p)); if (!file.startsWith(root + sep) || !existsSync(file)) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }); res.end(readFileSync(file)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const devServer = await createViteDevServer({ configFile: resolve('vite.config.ts'), mode: 'development', server: { host: '127.0.0.1', port: 0, strictPort: false } });
await devServer.listen();
const devAddr = devServer.httpServer.address();
const devUrl = `http://127.0.0.1:${typeof devAddr === 'object' && devAddr ? devAddr.port : 5173}/`;
const profile = mkdtempSync(join(tmpdir(), 'bw-cartoon-'));
const chromePath = process.env.CHROME_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');
const chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--remote-debugging-port=9222', '--remote-allow-origins=*', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let chromeErrors = ''; chrome.stderr?.on('data', (chunk) => { chromeErrors += (String(chunk)).slice(-1500); });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let socket; const errors = [], report = { errors, captures: {} };
try {
    let target; for (let i = 0; i < 180; i++) { try { target = (await (await fetch('http://127.0.0.1:9222/json')).json()).find(t => t.type === 'page'); } catch { } if (target) break; await sleep(150); } if (!target) throw new Error('Chrome/CDP não iniciou: ' + chromeErrors.slice(-4500) + ' (exit=' + chrome.exitCode + ')');
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; }); let seq = 0; const pending = new Map();
    socket.onmessage = e => { const msg = JSON.parse(e.data); if (msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(msg.error) : p.resolve(msg.result); } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails); else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry); };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
    const wait = async expr => { for (let i = 0; i < 150; i++) { if (await evaluate(expr)) return; await sleep(100); } throw Error('Timeout ' + expr + ' ' + JSON.stringify(errors)); };
    const shot = async name => {
        await sleep(150);
        const r = await send('Page.captureScreenshot', { format: 'webp', quality: 90 });
        const buf = Buffer.from(r.data, 'base64');
        assert(buf.length > 4096 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP', `Captura inválida ou vazia em ${name}: ${buf.length} bytes`);
        writeFileSync(join(out, name + '.webp'), buf);
        const meta = await evaluate(`(async()=>{const img=new Image();img.src='data:image/webp;base64,'+${JSON.stringify(r.data)};await img.decode();const c=document.createElement('canvas');c.width=64;c.height=36;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,64,36);const d=ctx.getImageData(0,0,64,36).data;let sum=0,sq=0,min=255,max=0,n=d.length/4;for(let i=0;i<d.length;i+=4){const l=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];sum+=l;sq+=l*l;if(l<min)min=l;if(l>max)max=l;}const mean=sum/n;return{width:img.naturalWidth,height:img.naturalHeight,minLuma:Math.round(min),maxLuma:Math.round(max),lumaStd:Number(Math.sqrt(Math.max(0,sq/n-mean*mean)).toFixed(2))};})()`);
        assert(meta.width > 0 && meta.height > 0 && meta.lumaStd > 2, `Captura visualmente uniforme ou corrompida em ${name}: ${JSON.stringify(meta)}`);
        report.captures[name] = { bytes: buf.length, ...meta };
        if (process.env.BW_CAPTURE_LOG === '1' && ['phase1-start', 'phase1-coast', 'phase1-harbor'].includes(name)) { for (let offset = 0; offset < r.data.length; offset += 4000)console.log('BWIMG:' + name + ':' + Math.floor(offset / 4000) + ':' + r.data.slice(offset, offset + 4000)); }
    };
    const key = async (code, key = code) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: code === 'Enter' ? 13 : code === 'Escape' ? 27 : code === 'F9' ? 120 : 32 }); await sleep(130); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key }); await sleep(60); };
    await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    // First verify the production bundle boots clean canvas with ZERO dev globals or DevTools UI.
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?devtools=1&debug=1` });
    await wait(`Boolean(document.querySelector('canvas')?.width>0)`);
    await sleep(400); await key('F9'); await sleep(120);
    report.prodIsolation = await evaluate(`({hasGame:typeof window.__GAME__!=='undefined',hasPhaser:typeof window.Phaser!=='undefined',hasDevTools:typeof window.__BW_DEVTOOLS__!=='undefined',hasDevDom:Boolean(document.querySelector('[data-bw-devtools-toggle],[data-bw-devtools-panel]')),canvasOk:(document.querySelector('canvas')?.width??0)>=768&&(document.querySelector('canvas')?.height??0)>=432})`);
    assert.deepEqual(report.prodIsolation, { hasGame: false, hasPhaser: false, hasDevTools: false, hasDevDom: false, canvasOk: true });
    // Now run full internal gameplay, route, and performance verification inside local Vite dev server.
    await send('Page.navigate', { url: devUrl });
    await wait(`window.__GAME__?.scene.isActive('ArcadeScene')&&!!window.__GAME__.scene.getScene('ArcadeScene').ui`);
    await evaluate(`window.s=window.__GAME__.scene.getScene('ArcadeScene');s.show('title')`); await shot('title');
    const pelagicTextures = await evaluate(`['pelagic-connected-coast-v2','pelagic-coast-harbor-v2','pelagic-coast-leisure-v2','pelagic-water-review','pelagic-depth-review','pelagic-caustics-review','pelagic-wave-crests','pelagic-wakes','pelagic-seagulls','arc-stage1-hud-left','arc-stage1-hud-right','arc-rivet','arc-enemies','arc-boss','arc-red','arc-sub-hull','arc-sub-parts'].map(key=>{const exists=s.textures.exists(key);const img=exists?s.textures.get(key).getSourceImage():null;return{key,exists,actualKey:exists?s.textures.get(key).key:null,width:img?.width??0,height:img?.height??0};})`);
    for (const t of pelagicTextures) { assert(t.exists && t.actualKey === t.key && t.width > 0 && t.height > 0, `Textura Pelágica ausente ou inválida: ${JSON.stringify(t)}`); }
    const titleBackdrop = await evaluate('s.backdrop.pelagicState()');
    assert(!titleBackdrop.coast.visible && !titleBackdrop.water.visible && titleBackdrop.menuSkyVisible, `Cenário Pelágico vazando no menu: ${JSON.stringify(titleBackdrop)}`);
    report.pelagic = { textures: pelagicTextures, title: titleBackdrop };
    const verifyPelagic = async (stage, minScroll = 0, expectCoast = true) => {
        const state = await evaluate(`(()=>{const c=s.cameras.main,a=c.getWorldPoint(c.x,c.y),b=c.getWorldPoint(c.x+c.width,c.y+c.height);return{screen:s.screen,up:s.world?.up,scroll:s.world?.scroll??0,arenaLeft:s.world?.arena?.left??160,arenaWidth:s.world?.arenaWidth??448,playerVisible:s.player.visible,hudVisible:Boolean(s.devPelagicHudState()?.visible),bossVisible:s.bossSprite.visible||(s.subBossArt?.hullSprites?.some(h=>h.visible)??false),cameraWorldBounds:{left:a.x,top:a.y,right:b.x,bottom:b.y},backdrop:s.backdrop.pelagicState()};})()`);
        assert(state.screen === 'play' && state.up === true, `Cena Pelágica inativa em ${stage}: ${JSON.stringify(state)}`);
        assert(state.scroll >= minScroll, `Scroll abaixo do esperado em ${stage}: ${state.scroll} < ${minScroll}`);
        assert(state.playerVisible && state.hudVisible, `HUD ou nave ocultos em ${stage}: ${JSON.stringify(state)}`);
        // Native canvas resolution uses camera zoom; resetting scroll to zero crops the virtual arena.
        const view = state.cameraWorldBounds;
        assert(Math.abs(view.left) < 8 && Math.abs(view.top) < 8 && Math.abs(view.right - 768) < 8 && Math.abs(view.bottom - 432) < 8, `Camera recorta a arena virtual em ${stage}: ${JSON.stringify(view)}`);
        const { coast, water, menuSkyVisible } = state.backdrop;
        assert(!menuSkyVisible, `Sky de menu visível durante gameplay em ${stage}`);
        if (expectCoast) {
            assert(coast.visible && coast.stripCount === 2 && coast.visibleCount === 2 && coast.texture === 'pelagic-connected-coast-v2', `Costa contínua inválida em ${stage}: ${JSON.stringify(coast)}`);
            const [s0, s1] = coast.strips;
            assert(s0.visible && s1.visible && s0.x === state.arenaLeft && s1.x === state.arenaLeft && s0.width === 384 && s1.width === 384 && s0.height === 2048 && s1.height === 2048, `Geometria das faixas da costa inválida em ${stage}: ${JSON.stringify(coast.strips)}`);
            assert(Math.abs((s1.y - s0.y) - 2048) < 1e-3 && s0.y <= 0 && s1.y + s1.height >= 432, `Faixas da costa não cobrem a arena 0..432 em ${stage}: ${JSON.stringify(coast.strips)}`);
            const expectedTop = -(((610 - state.scroll) % 2048 + 2048) % 2048);
            const seamDelta = Math.min(Math.abs(s0.y - expectedTop), 2048 - Math.abs(s0.y - expectedTop));
            assert(seamDelta < 2.5, `Posição da costa dessincronizada do scroll em ${stage}: got ${s0.y}, expected ${expectedTop}`);
        } else {
            assert(!coast.visible, `Margem costeira não deveria aparecer na arena aberta do chefe em ${stage}: ${JSON.stringify(coast)}`);
        }
        assert(water.visible && water.texture === 'pelagic-water-review' && water.depthVisible && water.depthTexture === 'pelagic-depth-review' && water.swellVisible && water.causticsVisible && water.causticsTexture === 'pelagic-caustics-review' && water.activeWaves > 0, `Camadas oceânicas inválidas em ${stage}: ${JSON.stringify(water)}`);
        return state;
    };
    await key('Enter'); await wait(`s.screen === 'pilot'`); assert.equal(await evaluate('s.screen'), 'pilot');
    await evaluate(`window.seek=(time)=>{const w=s.world;w.route=time;w.waveIndex=w.mission.encounters.findIndex(e=>e.at>time);if(w.waveIndex<0)w.waveIndex=w.mission.encounters.length;w.supplyIndex=12;w.miniStarted=time>155;w.bossStarted=false;w.enemies=[];w.cargo=[];w.obstacles=[];w.nextObstacle=time+10;w.boss=undefined;w.bullets.forEach(b=>b.active=false);w.player.invulnerable=100;};`);
    await evaluate(`s.show('pilot')`); await shot('pilots'); await evaluate(`s.show('missions')`); await shot('missions');
    await evaluate(`s.begin(0);s.world.introTime=0;s.controls.SPACE.isDown=true;s.setTouchVisible(false);`); await sleep(1500); await shot('phase1-start');
    report.pelagic.start = await verifyPelagic('phase1-start');
    await evaluate(`seek(85);s.world.weapons.weaponLevel=3;s.world.spawnEncounter({family:'fighter',formation:'trio',motion:'straight',lane:.5});s.setTouchVisible(false)`); await sleep(1000); await shot('phase1-coast');
    report.pelagic.coast = await verifyPelagic('phase1-coast');
    assert.notEqual(report.pelagic.coast.backdrop.water.tilePositionY, report.pelagic.start.backdrop.water.tilePositionY, 'Água deve rolar entre start e coast');
    await evaluate(`s.world.scroll=485;s.world.player.invulnerable=100;s.controls.SPACE.isDown=false;s.setTouchVisible(false)`); await sleep(250); await shot('phase1-harbor');
    report.pelagic.harbor = await verifyPelagic('phase1-harbor', 485);
    assert.notEqual(report.pelagic.harbor.backdrop.water.tilePositionY, report.pelagic.coast.backdrop.water.tilePositionY, 'Água deve rolar entre coast e harbor');
    await evaluate(`s.show('pause')`); await shot('pause'); report.pause = await evaluate(`(()=>{const a=s.world.elapsed;return new Promise(r=>setTimeout(()=>r({before:a,after:s.world.elapsed,audio:s.audio.status()}),200));})()`); assert.equal(report.pause.before, report.pause.after);
    await evaluate(`s.audio.unlock();s.show('controls')`); await shot('controls'); assert.equal(await evaluate('s.audio.status().paused'), true); await evaluate(`s.pauseOrigin='pause';s.show('settings')`); await shot('settings');
    await evaluate(`s.show('play');seek(360)`); await sleep(3500); await shot('phase1-boss');
    report.pelagic.boss = await verifyPelagic('phase1-boss', 0, false); assert(report.pelagic.boss.bossVisible, 'Submarino Colosso Abissal deve estar visível em phase1-boss');
    await evaluate(`s.world.step(1/60,{x:0,y:0,fire:false,special:true});s.world.player.x=s.world.boss.parts[0].x;s.world.player.y=350`); await sleep(750); await shot('phase1-special');
    await evaluate(`(()=>{const w=s.world,sub=w.boss.sub;sub.sections[0].hullHp=0;sub.sections[0].parts.forEach(p=>p.hp=0);for(let i=0;i<300&&sub.activeSection<1;i++)w.step(1/60);for(let i=0;i<220&&sub.phase!=='fight';i++)w.step(1/60);})()`); await shot('phase1-return'); assert.equal(await evaluate('s.world.boss.sub.activeSection'), 1);
    report.pelagic.return = await verifyPelagic('phase1-return', 0, false);
    report.assets = await evaluate(`({textures:s.textures.getTextureKeys().filter(k=>k.startsWith('arc-')),audio:s.audio.status(),objects:s.children.length,screen:s.screen})`);
    if (process.argv.includes('--both')) { await evaluate(`s.begin(1);s.world.introTime=0;seek(99)`); await sleep(1600); await shot('phase2-city'); await evaluate(`seek(300)`); await sleep(3500); await shot('phase2-boss'); }
    // Standard browser gamepad injection exercises the real input adapter, not a physical device.
    await evaluate(`s.begin(0);s.world.introTime=0;window.pad={id:'Virtual Standard',connected:true,mapping:'standard',axes:[1,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.pad]});window.xBefore=s.world.player.x;pad.buttons[1]={pressed:true,value:1};`); await sleep(500);
    report.gamepad = await evaluate(`({moved:s.world.player.x>xBefore,fired:s.world.bullets.some(b=>b.active&&!b.enemy)})`); assert(report.gamepad.moved && report.gamepad.fired);
    await evaluate(`pad.buttons[9]={pressed:true,value:1}`); await sleep(100); assert.equal(await evaluate('s.screen'), 'pause'); await evaluate(`Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});s.show('play');`);
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const layout = await evaluate('s.refreshTouchLayout();s.setTouchVisible(true);s.touchController.getLayout()');
    const point = await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+${layout.fire.x}/768*r.width,y:r.y+${layout.fire.y}/432*r.height};})()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1, radiusX: 5, radiusY: 5, force: 1 }] }); await sleep(200); assert.equal(await evaluate('s.touchController.peek().fire'), true); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(100); assert.equal(await evaluate('s.touchController.peek().fire'), false); report.touch = { firePressAndRelease: true };
    const touchAt = async (x, y) => evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+${x}/768*r.width,y:r.y+${y}/432*r.height,id:1,radiusX:5,radiusY:5,force:1};})()`);
    const beforeMove = await evaluate('s.world.player.y'); await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await touchAt(layout.joystick.x, layout.joystick.y)] }); await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [await touchAt(layout.joystick.x, layout.joystick.y - 40)] }); await sleep(180); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); assert(await evaluate('s.world.player.y') < beforeMove); report.touch.joystick = true;
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await touchAt(layout.special.x, layout.special.y)] }); await sleep(100); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); assert.equal(await evaluate('s.world.weapons.specialCharges'), 1); report.touch.special = true;
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await touchAt(layout.pause.x, layout.pause.y)] }); await sleep(100); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); assert.equal(await evaluate('s.screen'), 'pause'); report.touch.pause = true; await evaluate(`s.show('play')`);
    await send('Emulation.setDeviceMetricsOverride', { width: 854, height: 480, deviceScaleFactor: 1, mobile: false }); await shot('compact-touch'); await send('Emulation.setTouchEmulationEnabled', { enabled: false }); await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    if (process.argv.includes('--routes')) {
        // steer closes over this shared geometry helper; transfer that dependency into the browser too.
        await evaluate(`(async()=>{window.computeArchOpening=(await import('/src/game/arcade/PelagicTideArch.ts')).computeArchOpening;window.steer=${steer.toString()};})()`); report.routes = [];
        for (const index of [0, 1]) {
            const run = await evaluate(`(async()=>{s.begin(${index},${index}===1?s.carried:undefined);s.audio.setMix(0,0,true);s.scene.pause();let ticks=0,peak=0;const initial={level:s.world.weapons.weaponLevel,power:s.world.weapons.powerMeter,lives:s.world.lives,specials:s.world.weapons.specialCharges,score:s.world.score};while(ticks<120*600&&!['victory','defeat'].includes(s.world.state)){for(let i=0;i<240&&!['victory','defeat'].includes(s.world.state);i++){s.world.step(1/120,steer(s.world));s.consumeEvents();if(ticks%2===0)s.renderWorld(1/60);ticks++;peak=Math.max(peak,s.world.bullets.filter(b=>b.active).length);}await new Promise(r=>setTimeout(r,0));}const w=s.world,result={mission:${index}+1,state:w.state,seconds:w.elapsed,initial,lives:w.lives,deaths:w.deaths,level:w.weapons.weaponLevel,power:w.weapons.powerMeter,specials:w.weapons.specialCharges,score:w.score,items:w.collected,peakBullets:peak};if(w.state==='victory'){s.saveClear();s.show('result');}s.scene.resume();return result;})()`);
            report.routes.push(run); await shot('result-phase' + (index + 1)); assert.equal(run.state, 'victory', JSON.stringify(run)); assert(run.seconds >= 300); console.log('Route complete', JSON.stringify(run));
            assert.equal(await evaluate('s.world.bullets.some(b=>b.active)'), false); assert(await evaluate('s.world.up?s.world.player.y<s.world.arena.top-20:s.world.player.x>s.world.arena.right+20'));
        }
        const [one, two] = report.routes; for (const field of ['lives', 'level', 'power', 'specials', 'score']) assert.equal(two.initial[field], one[field]);
        await evaluate(`s.show('ending')`); await shot('ending');
        await evaluate(`s.begin(0);s.world.state='play';s.world.lives=1;s.world.player.invulnerable=0;s.world.hurtPlayer()`); await sleep(100); assert.equal(await evaluate('s.screen'), 'defeat'); await shot('game-over');
        await key('Enter'); await wait(`s.screen === 'play'`); assert.equal(await evaluate('s.screen'), 'play'); await key('Escape'); await wait(`s.screen === 'pause'`); assert.equal(await evaluate('s.screen'), 'pause'); await evaluate(`s.show('confirm-exit')`); await shot('confirm-exit'); await evaluate(`s.buttons[0].action()`); assert.equal(await evaluate('s.screen'), 'pause'); await evaluate(`s.show('confirm-exit');s.buttons[1].action()`); assert.equal(await evaluate('s.screen'), 'title'); assert.equal(await evaluate('!!s.world'), false); report.endFlow = { defeatRetry: true, exitCancelled: true, exitConfirmed: true, automaticFlyout: true };
    }
    report.renderer = await evaluate(`(()=>{const gl=window.__GAME__.renderer.gl;const ext=gl?.getExtension('WEBGL_debug_renderer_info');return {type:window.__GAME__.renderer.type,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};})()`);
    if (process.argv.includes('--performance')) {
        report.performance = [];
        for (const index of [0, 1]) for (const quality of [0, 2]) {
            await evaluate(`s.begin(${index});s.world.introTime=0;seek(${index === 0 ? 360 : 300});s.quality=${quality};s.world.weapons.weaponLevel=5;s.controls.SPACE.isDown=true;s.world.player.invulnerable=100;`); await sleep(2800);
            report.performance.push(await evaluate(`new Promise(resolve=>{const samples=[];let previous=performance.now(),start=previous,peak=0;function sample(now){samples.push(now-previous);previous=now;const w=s.world;peak=Math.max(peak,w.bullets.filter(b=>b.active).length);if(Math.floor((now-start)/1000)%2===0&&w.enemies.length<8)w.spawnEncounter({family:'bomber',formation:'horde',motion:'sine',lane:.5});if(now-start>3000&&now-start<5000)w.specialTime=.5;if(now-start<8000)requestAnimationFrame(sample);else{s.controls.SPACE.isDown=false;samples.shift();samples.sort((a,b)=>a-b);resolve({mission:${index}+1,quality:${quality},frames:samples.length,seconds:(now-start)/1000,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],heap:performance.memory?.usedJSHeapSize,objects:s.children.length,peakBullets:peak});}}requestAnimationFrame(sample);})`));
        }
    }
    assert.deepEqual(errors, []); writeFileSync(join(out, 'browser-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { socket?.close(); chrome.kill(); server.close(); await devServer?.close(); }

