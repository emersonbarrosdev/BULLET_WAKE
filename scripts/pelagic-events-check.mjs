/**
 * Chrome/WebGL acceptance & visual capture for Fenda Pelágica Special Events (Tarefa 11).
 * Tests each event in isolation (Normal & Hard), verifies textures/collisions/non-duplication,
 * measures FPS, and captures PNGs + WebM clips in docs/screenshots/pelagic-events-v1/.
 * Run after `npm run build`: node scripts/pelagic-events-check.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const out = resolve('docs/screenshots/pelagic-events-v1');
mkdirSync(out, { recursive: true });

const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ogg': 'audio/ogg',
};

const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep) || !existsSync(file)) {
        res.writeHead(404).end();
        return;
    }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));

const profile = mkdtempSync(join(tmpdir(), 'bw-events-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=0',
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--user-data-dir=' + profile,
    'about:blank',
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
const errors = [];
const report = { errors, events: {}, performance: {}, captures: [] };
let socket;

try {
    let target;
    for (let i = 0; i < 80 && !target; i++) {
        try {
            const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
            target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page');
        } catch { /* Chrome still starting */ }
        if (!target) await sleep(150);
    }
    assert(target, 'Chrome did not expose a page target');

    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
    let seq = 0;
    const pending = new Map();
    socket.onmessage = event => {
        const msg = JSON.parse(event.data);
        if (msg.id) {
            const h = pending.get(msg.id);
            if (!h) return;
            pending.delete(msg.id);
            clearTimeout(h.timeout);
            msg.error ? h.reject(new Error(JSON.stringify(msg.error))) : h.resolve(msg.result);
        } else if (msg.method === 'Runtime.exceptionThrown') {
            errors.push(msg.params.exceptionDetails);
        } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
            errors.push(msg.params.entry);
        }
    };

    const send = (method, params = {}) => new Promise((res, rej) => {
        const id = ++seq;
        const timeout = setTimeout(() => { pending.delete(id); rej(new Error('CDP timeout: ' + method)); }, 60000);
        pending.set(id, { resolve: res, reject: rej, timeout });
        socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
        return r.result.value;
    };
    const waitFor = async expression => {
        for (let i = 0; i < 200; i++) {
            if (await evaluate(expression)) return;
            await sleep(100);
        }
        throw new Error('Timeout waiting for: ' + expression);
    };
    const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
    const screenshot = async name => {
        await settle();
        report.captures.push(name);
        const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        writeFileSync(join(out, name + '.png'), Buffer.from(result.data, 'base64'));
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await waitFor("window.__GAME__?.scene.isActive('ArcadeScene') && !!window.__GAME__.scene.getScene('ArcadeScene').ui");

    await evaluate(`
        window.s = window.__GAME__.scene.getScene('ArcadeScene');
        s.audio.setMix(0, 0, true);
        window.stepAndDraw = (frames, input = {x:0,y:0,fire:false,special:false}, dt = 1/60) => {
            s.lastInput = input;
            for (let i = 0; i < frames; i++) {
                s.clock += dt;
                s.world.step(dt, input);
                s.consumeEvents();
                s.backdrop.draw(s.clock, s.world, s.quality);
                s.renderWorld(dt);
            }
        };
        window.eventFixture = (route, hard = false) => {
            s.begin(0);
            s.scene.pause();
            s.quality = 2;
            s.world.hard = hard;
            s.world.state = 'play';
            s.world.introTime = 0;
            s.world.waveIndex = 999;
            s.world.supplyIndex = 999;
            s.world.miniStarted = route >= 155;
            s.world.boss = undefined;
            if (route > 115) s.world.specialEventsTriggered.add('naval-convoy');
            if (route > 185) s.world.specialEventsTriggered.add('elite-interception');
            if (route > 242) s.world.specialEventsTriggered.add('coordinated-strike');
            s.world.route = route;
            s.world.elapsed = route;
            s.world.scroll = route * 38;
            s.world.player.x = 384;
            s.world.player.y = 350;
            s.world.player.invulnerable = 999;
            s.world.weapons.weaponLevel = 4;
            s.world.enemies = [];
            s.world.cargo = [];
            s.world.events = [];
            s.world.bullets.forEach(b => b.active = false);
            stepAndDraw(2);
        };
        true;
    `);

    // 1. Comboio Naval (route 115s, Normal & Hard)
    await evaluate(`
        eventFixture(115, false);
        s.world.triggerSpecialEvent('naval-convoy');
        stepAndDraw(145, {x:0,y:0,fire:false,special:false});
        true;
    `);
    report.events.navalConvoyNormal = await evaluate(`({
        count: s.world.enemies.filter(e => e.specialEvent === 'naval-convoy').length,
        vessels: s.world.enemies.filter(e => e.eventRole === 'convoy-lead' || e.eventRole === 'convoy-escort').map(e => ({ family: e.family, x: Math.round(e.x), y: Math.round(e.y), tex: s.enemySprites.get(e.id)?.texture.key })),
        duplicateBlocked: s.world.triggerSpecialEvent('naval-convoy') === false,
    })`);
    assert.equal(report.events.navalConvoyNormal.duplicateBlocked, true);
    assert(report.events.navalConvoyNormal.vessels.length === 3);
    await screenshot('01-naval-convoy-normal');

    await evaluate(`
        eventFixture(115, true);
        s.world.triggerSpecialEvent('naval-convoy');
        stepAndDraw(135, {x:0.3,y:0,fire:false,special:false});
        true;
    `);
    report.events.navalConvoyHardCount = await evaluate(`s.world.enemies.filter(e => e.specialEvent === 'naval-convoy').length`);
    assert(report.events.navalConvoyHardCount >= 5);
    await screenshot('02-naval-convoy-hard');

    // 2. Interceptação de Elite (route 185s, Normal & Hard)
    await evaluate(`
        eventFixture(185, false);
        s.world.triggerSpecialEvent('elite-interception');
        stepAndDraw(115, {x:-0.3,y:0,fire:false,special:false});
        true;
    `);
    report.events.eliteNormal = await evaluate(`({
        aces: s.world.enemies.filter(e => e.eventRole === 'elite-ace').length,
        enemyBullets: s.world.bullets.filter(b => b.active && b.enemy).length,
    })`);
    assert.equal(report.events.eliteNormal.aces, 3);
    await screenshot('03-elite-interception-normal');

    await evaluate(`
        eventFixture(185, true);
        s.world.triggerSpecialEvent('elite-interception');
        stepAndDraw(125, {x:0.4,y:0,fire:false,special:false});
        true;
    `);
    report.events.eliteHardAces = await evaluate(`s.world.enemies.filter(e => e.eventRole === 'elite-ace').length`);
    assert.equal(report.events.eliteHardAces, 4);
    await screenshot('04-elite-interception-hard');

    // 3. Ataque Coordenado (route 242s)
    await evaluate(`
        eventFixture(242, false);
        s.world.triggerSpecialEvent('coordinated-strike');
        stepAndDraw(150, {x:0.2,y:0,fire:false,special:false});
        true;
    `);
    report.events.coordinatedStrike = await evaluate(`({
        total: s.world.enemies.filter(e => e.specialEvent === 'coordinated-strike').length,
        subExposure: s.world.enemies.find(e => e.eventRole === 'coord-sub')?.submarine?.exposure ?? 0,
        enemyBullets: s.world.bullets.filter(b => b.active && b.enemy).length,
    })`);
    assert.equal(report.events.coordinatedStrike.total, 3);
    assert(report.events.coordinatedStrike.subExposure > 0.8);
    await screenshot('05-coordinated-strike');

    // 4. Inimigo Raro (route 66s + native collision kill bonus check)
    await evaluate(`
        eventFixture(66, false);
        s.world.triggerSpecialEvent('rare-visitor');
        stepAndDraw(95, {x:0,y:0,fire:false,special:false});
        true;
    `);
    report.events.rareVisitor = await evaluate(`({
        active: s.world.enemies.filter(e => e.eventRole === 'rare-probe').length,
        tex: s.enemySprites.get(s.world.enemies.find(e => e.eventRole === 'rare-probe')?.id)?.texture.key,
        duplicateBlocked: s.world.triggerSpecialEvent('rare-visitor') === false,
    })`);
    assert.equal(report.events.rareVisitor.active, 1);
    assert.equal(report.events.rareVisitor.tex, 'pelagic-ufo-anim');
    assert.equal(report.events.rareVisitor.duplicateBlocked, true);
    await screenshot('06-rare-visitor');

    // Test killing rare visitor directly through live fire & verify bounded score bonus + FPS
    await evaluate(`
        const rare = s.world.enemies.find(e => e.eventRole === 'rare-probe');
        s.world.player.x = rare.x;
        s.world.player.y = 330;
        window.scoreBeforeRareKill = s.world.score;
        stepAndDraw(48, {x:0,y:0,fire:true,special:false});
        true;
    `);
    report.events.rareKillBonusDelta = await evaluate(`s.world.score - window.scoreBeforeRareKill`);
    assert(report.events.rareKillBonusDelta >= 1850, `Expected rare kill bonus delta >= 1850, got ${report.events.rareKillBonusDelta}`);
    await screenshot('07-rare-visitor-destroyed');

    // Record short live WebM demo combining Naval Convoy + Rare Visitor + Elite Interception
    report.video = await evaluate(`(async () => {
        eventFixture(115, false);
        s.world.triggerSpecialEvent('naval-convoy');
        s.world.triggerSpecialEvent('rare-visitor', true);
        s.scene.resume();
        const stream = s.game.canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2400000 });
        const chunks = [];
        recorder.ondataavailable = ev => { if (ev.data.size > 0) chunks.push(ev.data); };
        const stopped = new Promise(r => { recorder.onstop = r; });
        recorder.start(200);
        const oldSample = s.lastInput;
        s.lastInput = { x: 0.4, y: -0.2, fire: true, special: false };
        await new Promise(r => setTimeout(r, 1500));
        s.world.triggerSpecialEvent('elite-interception');
        s.lastInput = { x: -0.5, y: 0, fire: true, special: false };
        await new Promise(r => setTimeout(r, 1500));
        s.lastInput = oldSample;
        recorder.stop();
        await stopped;
        s.scene.pause();
        const blob = new Blob(chunks, { type: mimeType });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        window.__eventsDemoB64 = btoa(binary);
        return { bytes: bytes.length, mimeType };
    })()`);
    const demoB64 = await evaluate('window.__eventsDemoB64');
    writeFileSync(join(out, 'pelagic-events-demo.webm'), Buffer.from(demoB64, 'base64'));
    report.video.file = 'pelagic-events-demo.webm';

    // Performance sample during combined event
    report.performance = await evaluate(`(() => {
        const samples = [];
        for (let i = 0; i < 60; i++) {
            const t0 = performance.now();
            stepAndDraw(1, { x: Math.sin(i * 0.2), y: 0, fire: true, special: false }, 1/60);
            samples.push(performance.now() - t0);
        }
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        return { frames: samples.length, avgTickMs: Number(avg.toFixed(2)) };
    })()`);

    assert.equal(errors.length, 0, 'Zero console/runtime errors expected: ' + JSON.stringify(errors));
    writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} finally {
    try { socket?.close(); } catch { }
    try { chrome?.kill(); } catch { }
    try { server.close(); } catch { }
    try { rmSync(profile, { recursive: true, force: true }); } catch { }
}
