import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/normal-balance');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-normal-balance-'));

let devServer;
let chrome;
let socket;
const runtimeErrors = [];
const report = { fps: {}, screenshots: {}, errors: runtimeErrors };

try {
  devServer = await createViteDevServer({
    configFile: resolve('vite.config.ts'),
    mode: 'development',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await devServer.listen();
  const devAddr = devServer.httpServer.address();
  const devUrl = `http://127.0.0.1:${typeof devAddr === 'object' && devAddr ? devAddr.port : 5173}/`;

  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--remote-debugging-port=9238',
      '--remote-allow-origins=*',
      '--no-first-run',
      '--user-data-dir=' + profile,
      '--window-size=1280,720',
      devUrl,
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );

  let target;
  for (let i = 0; i < 160; i++) {
    try {
      target = (await (await fetch('http://127.0.0.1:9238/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(120);
  }
  if (!target) throw new Error('Chrome CDP failed to launch');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });

  let seq = 0;
  const pending = new Map();
  socket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(msg.params.exceptionDetails);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      runtimeErrors.push(msg.params.entry);
    }
  };

  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { resolve: res, reject: rej });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(shotDir, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    report.screenshots[name] = file;
    return file;
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  let ready = false;
  for (let i = 0; i < 240; i++) {
    ready = await evaluate(`(() => {
      const g = window.__GAME__;
      const s = g && g.scene && g.scene.getScene('ArcadeScene');
      return !!(s && s.textures && s.textures.exists('arc-orb-0') && s.screen !== 'loading');
    })()`);
    if (ready) break;
    await sleep(100);
  }
  assert.equal(ready, true, 'ArcadeScene must boot cleanly');

  // 1. Opening 0-45s + anticipated 11s POWER crate in Normal mode
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true);
    s.begin(0);
    const w = s.world;
    w.setDifficulty('normal');
    w.devJumpToCheckpoint(10.8, { seed: 1337 });
    w.devInvincible = true;
    for (let i = 0; i < 150; i++) {
      w.step(1 / 60, { x: Math.sin(i * 0.04) * 0.4, y: 0, fire: true, special: false });
    }
    s.renderWorld(1 / 60);
  })()`);
  await sleep(120);
  await shot('01-early-opening-power');

  // 2. Helicopter pair combat under Normal offensive coordination
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    w.devJumpToCheckpoint(54.2, { seed: 1337 });
    w.weapons.weaponLevel = 2;
    w.devInvincible = true;
    for (let i = 0; i < 120; i++) {
      w.step(1 / 60, { x: Math.sin(i * 0.05) * 0.5, y: 0, fire: true, special: false });
    }
    s.renderWorld(1 / 60);
  })()`);
  await sleep(120);
  await shot('02-helicopters-pair-coordinated');

  // 3. Mid-stage ships & submarines (45-135s) with progressive 3-way spreads
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    w.devJumpToCheckpoint(114.8, { seed: 1337 });
    w.weapons.weaponLevel = 3;
    w.devInvincible = true;
    for (let i = 0; i < 180; i++) {
      w.step(1 / 60, { x: Math.sin(i * 0.04) * 0.45, y: 0, fire: true, special: false });
    }
    s.renderWorld(1 / 60);
  })()`);
  await sleep(120);
  await shot('03-ships-submarines-mid');

  // 4. Tide Arch traversal & post-arch Normal flow
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    w.devJumpTideArch('low-flight', false, false);
    w.weapons.weaponLevel = 4;
    w.devInvincible = true;
    for (let i = 0; i < 110; i++) {
      w.step(1 / 60, { x: Math.sin(i * 0.06) * 0.35, y: 0, fire: true, special: false });
    }
    s.renderWorld(1 / 60);
  })()`);
  await sleep(120);
  await shot('04-tide-arch-normal');

  // 5. Boss Colosso Abissal in Normal mode + live FPS sample
  report.fps = await evaluate(`(async () => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    w.devJumpToCheckpoint(300, { seed: 1337 });
    w.weapons.weaponLevel = 5;
    w.devInvincible = true;
    for (let i = 0; i < 210; i++) {
      w.step(1 / 60, { x: Math.sin(i * 0.05) * 0.4, y: 0, fire: true, special: false });
    }
    s.renderWorld(1 / 60);
    const times = [];
    await new Promise((resolve) => {
      let last = performance.now();
      let count = 0;
      const step = (now) => {
        times.push(now - last);
        last = now;
        count++;
        if (count >= 45) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const valid = times.slice(2);
    const avgMs = valid.reduce((a, b) => a + b, 0) / Math.max(1, valid.length);
    return {
      avgFps: Number((1000 / Math.max(1, avgMs)).toFixed(1)),
      avgFrameMs: Number(avgMs.toFixed(2)),
      activeEnemies: w.enemies.length,
      activeBullets: w.bullets.filter((b) => b.active && b.enemy).length,
      bossSection: w.boss?.sub?.activeSection ?? -1,
    };
  })()`);
  await sleep(120);
  await shot('05-boss-colosso-normal');

  assert.equal(runtimeErrors.length, 0, `Runtime errors detected: ${JSON.stringify(runtimeErrors)}`);
  console.log('NORMAL_BALANCE_BROWSER_VERIFY', JSON.stringify(report));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  try { await devServer?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
