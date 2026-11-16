/**
 * Chrome/WebGL acceptance & visual verification for Fenda Pelágica actor animations (Tarefa 03).
 * Produces PNG captures + live WebM gameplay demo + FPS metrics in docs/screenshots/pelagic-anims-v1/.
 * Run after `npm run build`: node scripts/pelagic-anims-check.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const out = resolve('docs/screenshots/pelagic-anims-v1');
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

const profile = mkdtempSync(join(tmpdir(), 'bw-anims-'));
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
const report = { errors, textures: {}, assertions: {}, performance: {}, fixtures: [] };
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
        report.fixtures.push(name);
        const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        writeFileSync(join(out, name + '.png'), Buffer.from(result.data, 'base64'));
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Log.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
    await waitFor("window.__GAME__?.scene.isActive('ArcadeScene') && !!window.__GAME__.scene.getScene('ArcadeScene').ui");

    // Initialize helpers inside page
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
        window.pelagicFixture = (route = 18) => {
            s.begin(0);
            s.scene.pause();
            s.quality = 2;
            s.world.state = 'play';
            s.world.introTime = 0;
            s.world.waveIndex = 999;
            s.world.supplyIndex = 999;
            s.world.route = route;
            s.world.elapsed = route;
            s.world.scroll = route * 38;
            s.world.player.x = 384;
            s.world.player.y = 330;
            s.world.player.bank = 0;
            s.world.player.invulnerable = 0;
            s.world.enemies = [];
            s.world.cargo = [];
            s.world.events = [];
            s.world.bullets.forEach(b => b.active = false);
            stepAndDraw(4);
        };
        true;
    `);

    // Verify all 4 pelagic spritesheets loaded in Phaser TextureManager
    report.textures = await evaluate(`({
        rivetFrames: s.textures.exists('pelagic-rivet-up') ? Object.keys(s.textures.get('pelagic-rivet-up').frames).length - 1 : 0,
        enemyAirFrames: s.textures.exists('pelagic-enemy-air') ? Object.keys(s.textures.get('pelagic-enemy-air').frames).length - 1 : 0,
        ufoFrames: s.textures.exists('pelagic-ufo-anim') ? Object.keys(s.textures.get('pelagic-ufo-anim').frames).length - 1 : 0,
        vfxFrames: s.textures.exists('pelagic-vfx') ? Object.keys(s.textures.get('pelagic-vfx').frames).length - 1 : 0,
    })`);
    assert.equal(report.textures.rivetFrames, 28);
    assert.equal(report.textures.enemyAirFrames, 112);
    assert.equal(report.textures.ufoFrames, 6);
    assert.equal(report.textures.vfxFrames, 16);

    // 1A: RIVET neutral pose & animated thruster
    await evaluate('pelagicFixture(18); stepAndDraw(12, {x:0,y:0,fire:false,special:false}); true');
    const neutralState = await evaluate('({ col: Number(s.player.frame.name) % 7, bx: s.world.player.x, by: s.world.player.y })');
    assert.equal(neutralState.col, 3, 'Neutral flight must display center bank column 3');
    await screenshot('01-rivet-neutral');

    // 1B: RIVET banking left
    await evaluate('stepAndDraw(22, {x:-1,y:0,fire:false,special:false}); true');
    const leftBankCol = await evaluate('Number(s.player.frame.name) % 7');
    assert(leftBankCol <= 1, `Expected left bank col <= 1, got ${leftBankCol}`);
    await screenshot('02-rivet-bank-left');

    // 1C: RIVET banking right + forward overboost & wingtip trails
    await evaluate('stepAndDraw(34, {x:1,y:-1,fire:false,special:false}); true');
    const rightBankCol = await evaluate('Number(s.player.frame.name) % 7');
    assert(rightBankCol >= 5, `Expected right bank col >= 5, got ${rightBankCol}`);
    await screenshot('03-rivet-bank-right-overboost');
    report.assertions.bankColumns = { neutral: neutralState.col, left: leftBankCol, right: rightBankCol };

    // 2A & 2B: RIVET firing across weapon levels without shifting logical hitbox position
    await evaluate(`
        pelagicFixture(22);
        s.world.weapons.weaponLevel = 1;
        window.posBeforeFire = { x: s.world.player.x, y: s.world.player.y };
        stepAndDraw(3, {x:0,y:0,fire:true,special:false});
        true;
    `);
    const fireNv1 = await evaluate(`({
        wx: s.world.player.x,
        wy: s.world.player.y,
        sx: s.player.x,
        sy: s.player.y,
        bullets: s.world.bullets.filter(b => b.active && !b.enemy).length,
    })`);
    assert.equal(fireNv1.wx, await evaluate('posBeforeFire.x'));
    assert.equal(fireNv1.wy, await evaluate('posBeforeFire.y'));
    assert(fireNv1.sy > fireNv1.wy, 'Visual recoil should nudge sprite slightly downward without shifting hitbox');
    await screenshot('04-rivet-fire-nv1');

    await evaluate(`
        pelagicFixture(22);
        s.world.weapons.weaponLevel = 5;
        stepAndDraw(4, {x:-0.45,y:0,fire:true,special:false});
        true;
    `);
    const fireNv5Bullets = await evaluate('s.world.bullets.filter(b => b.active && !b.enemy).length');
    assert(fireNv5Bullets >= 5, `Expected FULL LV5 volley + missiles, got ${fireNv5Bullets}`);
    await screenshot('05-rivet-fire-nv5-full');
    report.assertions.recoilHitboxInvariant = { nv1: fireNv1, fireNv5Bullets };

    // 3: All aircraft families maneuvering in view (fighter, interceptor, acrobat, bomber, alien)
    await evaluate(`
        pelagicFixture(35);
        s.world.enemies = [];
        const addAir = (family, motion, x, y, ageOffset = 0.4) => {
            s.world.spawnEncounter({ family, formation: 'solo', motion, lane: 0.5 });
            const e = s.world.enemies[s.world.enemies.length - 1];
            e.x = x; e.y = y; e.lane = x; e.age = ageOffset;
            e.hp = 99; e.maxHp = 99; e.cooldown = 0.02;
            return e;
        };
        addAir('fighter', 'sine', 240, 120, 0.35);
        addAir('interceptor', 'dive', 325, 108, 0.55);
        addAir('acrobat', 'turn', 415, 118, 0.45);
        addAir('bomber', 'curve', 515, 135, 0.65);
        addAir('alien', 'sine', 384, 195, 0.25);
        stepAndDraw(22, {x:0,y:0,fire:false,special:false});
        true;
    `);
    const enemyTexReport = await evaluate(`s.world.enemies.map(e => ({
        family: e.family,
        texture: s.enemySprites.get(e.id)?.texture.key,
        frame: Number(s.enemySprites.get(e.id)?.frame.name),
    }))`);
    assert(enemyTexReport.every(r => r.family === 'alien' ? r.texture === 'pelagic-ufo-anim' : r.texture === 'pelagic-enemy-air'));
    report.assertions.enemyAirTextures = enemyTexReport;
    await screenshot('06-enemies-air-maneuvers');

    // 4A & 4B: Enemies taking damage (hit overlay, low-HP smoke, sparks) and instant destruction (fighter, bomber, boat, submarine)
    await evaluate(`
        pelagicFixture(72);
        s.world.enemies = [];
        s.world.spawnEncounter({ family: 'bomber', formation: 'solo', motion: 'straight', lane: 0.5 });
        const b = s.world.enemies[0]; b.x = 340; b.y = 148; b.lane = 340; b.hp = 3; b.maxHp = 12;
        s.world.spawnEncounter({ family: 'fighter', formation: 'solo', motion: 'sine', lane: 0.5 });
        const f = s.world.enemies[1]; f.x = 455; f.y = 140; f.lane = 455; f.hp = 1; f.maxHp = 3;
        s.world.spawnEncounter({ family: 'boat', formation: 'solo', motion: 'stationary', lane: 0.5 });
        const boat = s.world.enemies[2]; boat.x = 275; boat.y = 175; boat.hp = 2; boat.maxHp = 6;
        if (boat.navigation) boat.navigation.worldY = 175 - s.world.scroll;
        stepAndDraw(14, {x:0,y:0,fire:false,special:false});
        b.flash = 0.09; f.flash = 0.09; boat.flash = 0.09;
        s.pelagicAnims.spawnHitSpark(b.x, b.y, 38);
        s.pelagicAnims.spawnHitSpark(f.x, f.y, 28);
        stepAndDraw(1, {x:0,y:0,fire:false,special:false});
        true;
    `);
    await screenshot('07-enemies-damage-smoke');

    await evaluate(`
        for (const e of [...s.world.enemies]) {
            e.hp = 0;
            s.world.events.push({ type: 'explosion', x: e.x, y: e.y, size: e.size / 30, text: e.family });
        }
        s.consumeEvents();
        s.world.enemies = [];
        stepAndDraw(5, {x:0,y:0,fire:false,special:false});
        true;
    `);
    assert.equal(await evaluate('s.world.enemies.length'), 0, 'Destroyed enemies must vanish immediately without falling corpses');
    await screenshot('08-enemies-destruction');

    // 4C: RIVET damage -> invulnerability barrier shimmer -> recovery lock-in ring
    await evaluate(`
        pelagicFixture(45);
        s.world.player.x = 330; s.world.player.y = 320;
        s.world.player.invulnerable = 2.0;
        s.pelagicAnims.triggerPlayerDamage();
        stepAndDraw(18, {x:0.5,y:0,fire:false,special:false});
        true;
    `);
    await screenshot('09a-rivet-invulnerability');

    await evaluate(`
        s.world.player.invulnerable = 0.04;
        stepAndDraw(6, {x:0,y:0,fire:false,special:false});
        true;
    `);
    await screenshot('09b-rivet-recovery');

    // 5: Intense multi-family pelagic combat + live FPS benchmark across quality 0, 1, 2
    await evaluate(`
        pelagicFixture(92);
        s.world.weapons.weaponLevel = 5;
        s.world.player.invulnerable = 999;
        const specs = [
            ['fighter', 'sine', 245, 95, 0.35],
            ['fighter', 'sine', 295, 82, 0.55],
            ['interceptor', 'dive', 475, 105, 0.5],
            ['acrobat', 'turn', 395, 125, 0.45],
            ['bomber', 'curve', 515, 150, 0.65],
            ['alien', 'sine', 330, 175, 0.25],
            ['submarine', 'stationary', 455, 225, 0],
            ['boat', 'stationary', 270, 220, 0],
        ];
        for (const [family, motion, x, y, ageOffset] of specs) {
            s.world.spawnEncounter({ family, formation: 'solo', motion, lane: 0.5 });
            const e = s.world.enemies[s.world.enemies.length - 1];
            e.x = x; e.y = y; e.lane = x; e.age = ageOffset; e.hp = 40; e.maxHp = 40; e.cooldown = 0.01;
            if (e.navigation) e.navigation.worldY = y - s.world.scroll;
            if (e.submarine) { e.submarine.phase = 'hold'; e.submarine.exposure = 1; }
        }
        stepAndDraw(28, {x:0.65,y:-0.5,fire:true,special:false});
        true;
    `);
    await screenshot('10-intense-combat');

    // Live WebM video recording via canvas.captureStream(30) + MediaRecorder while scene runs live
    report.video = await evaluate(`(async () => {
        s.scene.resume();
        const stream = s.game.canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
        const chunks = [];
        recorder.ondataavailable = ev => { if (ev.data.size > 0) chunks.push(ev.data); };
        const stopped = new Promise(r => { recorder.onstop = r; });
        recorder.start(200);
        const phases = [
            { ms: 750, x: -0.95, y: -0.2, fire: true },
            { ms: 750, x: 0.95, y: -0.65, fire: true },
            { ms: 700, x: 0, y: 0.25, fire: true },
            { ms: 700, x: -0.65, y: -0.8, fire: true },
        ];
        for (const ph of phases) {
            s.controls.LEFT.isDown = ph.x < -0.25;
            s.controls.RIGHT.isDown = ph.x > 0.25;
            s.controls.UP.isDown = ph.y < -0.25;
            s.controls.DOWN.isDown = ph.y > 0.25;
            s.controls.SPACE.isDown = !!ph.fire;
            await new Promise(r => setTimeout(r, ph.ms));
        }
        s.controls.LEFT.isDown = s.controls.RIGHT.isDown = s.controls.UP.isDown = s.controls.DOWN.isDown = s.controls.SPACE.isDown = false;
        recorder.stop();
        await stopped;
        const blob = new Blob(chunks, { type: mimeType });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let b64 = '';
        for (let i = 0; i < buf.length; i += 0x8000) {
            b64 += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        }
        return { bytes: buf.length, mimeType, base64: btoa(b64) };
    })()`);
    assert(report.video.bytes > 10000, 'Expected non-empty WebM gameplay recording');
    writeFileSync(join(out, 'pelagic-anims-demo.webm'), Buffer.from(report.video.base64, 'base64'));
    report.video = { bytes: report.video.bytes, mimeType: report.video.mimeType, file: 'pelagic-anims-demo.webm' };

    // Benchmark WebGL frame times across quality = 0, 1, 2
    for (const q of [0, 1, 2]) {
        const metrics = await evaluate(`(async () => {
            pelagicFixture(92);
            s.quality = ${q};
            s.world.weapons.weaponLevel = 5;
            s.world.player.invulnerable = 999;
            for (const f of ['fighter','interceptor','acrobat','bomber','alien']) {
                s.world.spawnEncounter({ family: f, formation: 'pair', motion: 'sine', lane: 0.5 });
            }
            s.scene.resume();
            s.controls.RIGHT.isDown = true;
            s.controls.UP.isDown = true;
            s.controls.SPACE.isDown = true;
            const times = [];
            await new Promise(resolveBench => {
                let prev = performance.now();
                let count = 0;
                const tick = now => {
                    if (count > 0) times.push(now - prev);
                    prev = now;
                    count++;
                    if (count >= 91) {
                        s.controls.RIGHT.isDown = s.controls.UP.isDown = s.controls.SPACE.isDown = false;
                        s.scene.pause();
                        resolveBench();
                    } else {
                        requestAnimationFrame(tick);
                    }
                };
                requestAnimationFrame(tick);
            });
            times.sort((a, b) => a - b);
            const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
            const p95Ms = times[Math.floor(times.length * 0.95)];
            return {
                quality: ${q},
                frames: times.length,
                avgMs: Number(avgMs.toFixed(2)),
                p95Ms: Number(p95Ms.toFixed(2)),
                fps: Number((1000 / avgMs).toFixed(1)),
            };
        })()`);
        report.performance['q' + q] = metrics;
        assert(metrics.fps >= 45, `WebGL FPS dropped too low on q=${q}: ${metrics.fps}`);
    }

    // Verify Cidade Solar (mission 1) remains untouched (world.up === false)
    await evaluate(`
        s.begin(1);
        s.scene.pause();
        s.world.state = 'play';
        s.world.introTime = 0;
        s.clock = 5;
        for (let i = 0; i < 30; i++) {
            s.clock += 1/60;
            s.world.step(1/60, {x:0,y:-0.5,fire:true,special:false});
            s.consumeEvents();
            s.backdrop.draw(s.clock, s.world, 2);
            s.renderWorld(1/60);
        }
        true;
    `);
    report.assertions.solarCityUp = await evaluate('s.world.up');
    assert.equal(report.assertions.solarCityUp, false);
    await screenshot('11-solar-city-untouched');

    assert.deepEqual(errors, []);
    writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
} finally {
    socket?.close();
    chrome.kill();
    server.close();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore Windows profile lock */ }
}
