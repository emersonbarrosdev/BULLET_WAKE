/** Real Chrome/Phaser visual verification for Tarefa 07 (Assisted Mode) and Tarefa 09 (Dynamic Bayek Comms). */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const out = resolve('docs/screenshots/pelagic-assist-comms-v1');
mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg' };
const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(root + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const profile = mkdtempSync(join(tmpdir(), 'bw-assist-comms-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--remote-debugging-port=0', '--no-first-run',
    '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errors = [];
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
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });

    let seq = 0;
    const pending = new Map();
    socket.onmessage = event => {
        const msg = JSON.parse(event.data);
        if (msg.id) {
            const h = pending.get(msg.id); if (!h) return;
            pending.delete(msg.id); clearTimeout(h.timeout);
            msg.error ? h.reject(new Error(JSON.stringify(msg.error))) : h.resolve(msg.result);
        } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
        else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry);
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++seq;
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 60000);
        pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const waitFor = async expression => {
        for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await sleep(100); }
        throw new Error('Timeout: ' + expression + ' ' + JSON.stringify(errors));
    };
    const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
    const screenshot = async name => {
        await settle();
        const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        writeFileSync(join(out, name + '.png'), Buffer.from(res.data, 'base64'));
    };

    await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await waitFor("window.__GAME__?.scene.isActive('ArcadeScene') && !!window.__GAME__.scene.getScene('ArcadeScene').ui");

    // 1. Settings modal with MODO ASSISTIDO enabled via real UI toggle button
    const settingsInfo = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        s.audio.setMix(0, 0, true);
        s.pauseOrigin = 'title';
        s.show('settings');
        // Row order: MÚSICA (0), EFEITOS (1), DISPARO ACESSÍVEL (2), DIFICULDADE (3), MODO ASSISTIDO (4)
        s.buttons[4].action();
        const labels = s.ui.list.filter(n => n.type === 'Text' && n.text).map(n => n.text);
        return { labels, count: labels.length };
    })()`);
    assert(settingsInfo.labels.includes('MODO ASSISTIDO'), 'Settings modal missing MODO ASSISTIDO');
    assert(settingsInfo.labels.includes('ATIVADO'), 'MODO ASSISTIDO did not toggle to ATIVADO');
    await screenshot('settings-assisted');

    // 2. Assisted active in Fenda Pelágica with dropped golden recovery capsule + active comms
    const dropState = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        s.begin(0);
        s.world.assisted = true;
        s.world.hard = false;
        s.world.state = 'play';
        s.world.player.invulnerable = 0;
        s.world.weapons.weaponLevel = 5;
        s.world.hurtPlayer();
        s.consumeEvents();
        if (s.world.cargo[0]) {
            s.world.cargo[0].x = 384;
            s.world.cargo[0].y = 260;
        }
        s.show('play');
        s.pelagicAnims.updatePlayer(s.world, s.player, { x: 0, y: 0, fire: false, special: false }, 0, 2);
        s.backdrop.draw(s.clock, s.world, s.quality);
        s.renderWorld(0);
        return {
            isAssisted: s.world.isAssisted,
            level: s.world.weapons.weaponLevel,
            badgeVisible: s.pelagicAssistBadge.visible,
            radioVisible: s.radio.visible,
            radioText: s.radio.text,
            dropRecovery: s.world.cargo[0]?.recoveryP,
        };
    })()`);
    assert.equal(dropState.isAssisted, true);
    assert.equal(dropState.level, 3);
    assert.equal(dropState.badgeVisible, true);
    assert.equal(dropState.radioVisible, true);
    assert(!dropState.radioText.includes('Aguardando contato'));
    await screenshot('assisted-hud-and-drop');

    // 3. Active submarine Bayek dialogue cleanly framed on right comms panel
    const subComms = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        s.pelagicComms.reset();
        s.pelagicComms.trigger({ category: 'submarine' });
        s.backdrop.draw(s.clock, s.world, s.quality);
        s.renderWorld(0);
        return {
            radioVisible: s.radio.visible,
            radioText: s.radio.text,
            x: s.radio.x,
            y: s.radio.y,
        };
    })()`);
    assert.equal(subComms.radioVisible, true);
    assert.equal(subComms.x, 645);
    await screenshot('comms-active-submarine');

    // 4. Resting state after active comms expires -> right comms panel clean with zero idle placeholder text
    const idleState = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        s.pelagicComms.step(10);
        s.backdrop.draw(s.clock, s.world, s.quality);
        s.renderWorld(0);
        return {
            radioVisible: s.radio.visible,
            radioText: s.radio.text,
        };
    })()`);
    assert.equal(idleState.radioVisible, false);
    await screenshot('comms-idle-clear');

    assert.equal(errors.length, 0, 'Unexpected runtime/console errors: ' + JSON.stringify(errors));
    console.log(JSON.stringify({ ok: true, settingsInfo, dropState, subComms, idleState }, null, 2));
} finally {
    try { socket?.close(); } catch { /* ignore */ }
    try { chrome.kill(); } catch { /* ignore */ }
    server.close();
}
