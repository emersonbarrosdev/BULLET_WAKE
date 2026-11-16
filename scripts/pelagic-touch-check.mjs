/** Real Chrome/Phaser Android touch emulation verification for Tarefa 08. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const out = resolve('docs/screenshots/pelagic-touch-v1');
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

const profile = mkdtempSync(join(tmpdir(), 'bw-touch-'));
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
        } catch { /* Starting Chrome */ }
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
    const worldToClient = async (wx, wy) => evaluate(`(() => {
        const r = window.__GAME__.canvas.getBoundingClientRect();
        return { x: Math.round(r.left + (${wx} / 768) * r.width), y: Math.round(r.top + (${wy} / 432) * r.height) };
    })()`);

    await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setDeviceMetricsOverride', { width: 854, height: 480, deviceScaleFactor: 2, mobile: true });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await waitFor("window.__GAME__?.scene.isActive('ArcadeScene') && !!window.__GAME__.scene.getScene('ArcadeScene').ui");

    // 1. Customize touch controls via CONTROLES TOUCH screen and verify live mirrored preview + reset
    const touchSettingsState = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        s.audio.setMix(0, 0, true);
        s.begin(0);
        s.show('pause');
        s.pauseOrigin = 'pause';
        s.show('touch-settings');
        // Toggle left-handed (0), raised position (1), large size (2), opacity step (3), height step (4)
        s.buttons[0].action();
        s.buttons[1].action();
        s.buttons[2].action();
        const l = s.touchController.getLayout();
        const txt = s.ui.list.filter(n => n.type === 'Text' && n.text).map(n => n.text);
        return { txt, layout: l };
    })()`);
    assert(touchSettingsState.txt.includes('CANHOTO'));
    assert(touchSettingsState.txt.includes('ELEVADA'));
    assert(touchSettingsState.txt.includes('GRANDE'));
    assert(touchSettingsState.layout.joystick.x > 576, 'Left-handed joystick should move to right column');
    assert(touchSettingsState.layout.fire.x < 192, 'Left-handed fire should move to left column');
    await screenshot('touch-settings-left-handed');

    // Reset to default and verify storage persistence
    const afterReset = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        s.buttons[5].action(); // RESTAURAR PADRÃO
        const st = s.touchController.getSettings();
        return { st, l: s.touchController.getLayout() };
    })()`);
    assert.equal(afterReset.st.handedness, 'right');
    assert.equal(afterReset.st.size, 'standard');
    assert.equal(afterReset.st.position, 'corner');

    // 2. Real CDP Multi-Touch test in Stage 1 (854x480): Diagonal stick + Hold/Release Fire + Special + Pause
    await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        s.begin(0);
        s.world.state = 'play';
        s.world.player.x = 384;
        s.world.player.y = 320;
        s.world.player.invulnerable = 999;
        s.show('play');
        return true;
    })()`);
    await settle();

    const layout = await evaluate("window.__GAME__.scene.getScene('ArcadeScene').touchController.getLayout()");
    const pJoy0 = await worldToClient(layout.joystick.x, layout.joystick.y);
    const pJoyDiag = await worldToClient(layout.joystick.x + 28, layout.joystick.y - 28);
    const pFire = await worldToClient(layout.fire.x, layout.fire.y);
    const pSpec = await worldToClient(layout.special.x, layout.special.y);
    const pPause = await worldToClient(layout.pause.x, layout.pause.y);

    // Finger 0 touches & moves joystick diagonally Up-Right
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pJoy0.x, y: pJoy0.y, id: 0 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pJoyDiag.x, y: pJoyDiag.y, id: 0 }] });
    await sleep(180);

    // Finger 1 holds FIRE while finger 0 keeps moving diagonally
    await send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
            { x: pJoyDiag.x, y: pJoyDiag.y, id: 0 },
            { x: pFire.x, y: pFire.y, id: 1 },
        ],
    });
    await sleep(220);

    const midMulti = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        return {
            px: s.world.player.x,
            py: s.world.player.y,
            activeBullets: s.world.bullets.filter(b => b.active && !b.enemy).length,
            peek: s.touchController.peek(),
        };
    })()`);
    assert(midMulti.px > 395 && midMulti.py < 312, 'Ship must move diagonally Up-Right via touch joystick');
    assert(midMulti.activeBullets > 0, 'Holding TIRO must fire while moving');
    assert.equal(midMulti.peek.stickActive, true);
    assert.equal(midMulti.peek.firePressed, true);
    await screenshot('play-right-multitouch-854x480');

    // Finger 2 taps SPECIAL while moving and firing
    await send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
            { x: pJoyDiag.x, y: pJoyDiag.y, id: 0 },
            { x: pFire.x, y: pFire.y, id: 1 },
            { x: pSpec.x, y: pSpec.y, id: 2 },
        ],
    });
    await sleep(90);
    await send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [
            { x: pJoyDiag.x, y: pJoyDiag.y, id: 0 },
            { x: pFire.x, y: pFire.y, id: 1 },
        ],
    });
    const afterSpecial = await evaluate("({ bomb: Boolean(window.__GAME__.scene.getScene('ArcadeScene').world.bomb), charges: window.__GAME__.scene.getScene('ArcadeScene').world.weapons.specialCharges })");
    assert.equal(afterSpecial.bomb, true, 'Special must activate during simultaneous movement and firing');
    assert.equal(afterSpecial.charges, 1);

    // Release FIRE -> verify fire stops cleanly while releasing stick
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: pJoyDiag.x, y: pJoyDiag.y, id: 0 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(100);
    const afterRelease = await evaluate("window.__GAME__.scene.getScene('ArcadeScene').touchController.peek()");
    assert.equal(afterRelease.fire, false);
    assert.equal(afterRelease.x, 0);
    assert.equal(afterRelease.y, 0);

    // Tap PAUSE button and resume
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pPause.x, y: pPause.y, id: 3 }] });
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(80);
    assert.equal(await evaluate("window.__GAME__.scene.getScene('ArcadeScene').screen"), 'pause');
    await evaluate("window.__GAME__.scene.getScene('ArcadeScene').show('play')");
    assert.equal(await evaluate("window.__GAME__.scene.getScene('ArcadeScene').screen"), 'play');

    // Focus loss (`blur`) auto-pauses and clears active touches
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pFire.x, y: pFire.y, id: 4 }] });
    await evaluate("window.dispatchEvent(new Event('blur'))");
    await sleep(50);
    assert.equal(await evaluate("window.__GAME__.scene.getScene('ArcadeScene').screen"), 'pause');
    assert.equal(await evaluate("window.__GAME__.scene.getScene('ArcadeScene').touchController.peek().fire"), false);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    // 3. Rotation check: Portrait (412x915) shows rotate-hint -> Landscape (915x412) hides hint & applies cutout insets
    await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
    await sleep(100);
    const portraitDisplay = await evaluate("getComputedStyle(document.getElementById('rotate-hint')).display");
    assert.equal(portraitDisplay, 'flex');

    await send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 2, mobile: true });
    await evaluate(`(() => {
        document.documentElement.style.setProperty('--sal', '40px');
        document.documentElement.style.setProperty('--sar', '40px');
        document.documentElement.style.setProperty('--sab', '20px');
        window.__GAME__.scene.getScene('ArcadeScene').show('play');
        window.__GAME__.scale.refresh();
        window.dispatchEvent(new Event('orientationchange'));
        return true;
    })()`);
    await sleep(100);
    const cutoutState = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        return {
            rotateHint: getComputedStyle(document.getElementById('rotate-hint')).display,
            layout: s.touchController.getLayout(),
        };
    })()`);
    assert.equal(cutoutState.rotateHint, 'none');
    assert(cutoutState.layout.joystick.x >= 55, 'Cutout safe inset must push joystick inside safe right of notch');
    await screenshot('play-cutout-915x412');

    // 4. Narrower 4:3 tablet resolution (800x600) + Left-handed persistence across page reload
    await evaluate(`(() => {
        document.documentElement.style.removeProperty('--sal');
        document.documentElement.style.removeProperty('--sar');
        document.documentElement.style.removeProperty('--sab');
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        const cur = s.touchController.getSettings();
        // Save left-handed preference via saveSystem in localStorage, then verify reload restores it
        const raw = JSON.parse(localStorage.getItem('bullet_wake_save_data_v1') || '{}');
        raw.schemaVersion = 2;
        raw.settings = { ...(raw.settings || {}), touch: { ...cur, handedness: 'left', opacity: 0.60 } };
        localStorage.setItem('bullet_wake_save_data_v1', JSON.stringify(raw));
        return true;
    })()`);
    await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: true });
    await send('Page.reload', { ignoreCache: false });
    await waitFor("window.__GAME__?.scene.isActive('ArcadeScene') && !!window.__GAME__.scene.getScene('ArcadeScene').ui");
    const persisted = await evaluate(`(() => {
        const s = window.__GAME__.scene.getScene('ArcadeScene');
        s.audio.setMix(0, 0, true);
        s.begin(0);
        s.world.state = 'play';
        s.show('play');
        return {
            st: s.touchController.getSettings(),
            l: s.touchController.getLayout(),
        };
    })()`);
    assert.equal(persisted.st.handedness, 'left');
    assert.equal(persisted.st.opacity, 0.60);
    assert(persisted.l.joystick.x > 576);
    assert(persisted.l.fire.x < 192);
    await screenshot('play-left-narrow-800x600');

    assert.equal(errors.length, 0, 'Unexpected runtime errors: ' + JSON.stringify(errors));
    console.log(JSON.stringify({ ok: true, midMulti, afterSpecial, cutoutState, persisted }, null, 2));
} finally {
    try { socket?.close(); } catch { /* ignore */ }
    try { chrome.kill(); } catch { /* ignore */ }
    server.close();
}
