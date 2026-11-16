import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const outDir = resolve('docs/screenshots/rivet-roll');
const videoDir = resolve('docs/videos');
mkdirSync(outDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-rivet-roll-'));

let viteDev;
let chrome;
let socket;
let send;
const runtimeErrors = [];
const report = {
  poses: {},
  transitions: {},
  combat: {},
  perf: {},
  screenshots: {},
  video: null,
  errors: runtimeErrors,
};

try {
  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=9226',
      '--remote-allow-origins=*',
      '--no-first-run',
      '--autoplay-policy=no-user-gesture-required',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );

  let target;
  for (let i = 0; i < 180; i++) {
    try {
      target = (await (await fetch('http://127.0.0.1:9226/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(150);
  }
  if (!target) throw new Error('Chrome CDP failed on port 9226');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });

  let seq = 0;
  const pending = new Map();
  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
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
  send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { resolve: res, reject: rej });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const wait = async (expr) => {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expr)) return;
      await sleep(100);
    }
    throw Error('Timeout: ' + expr);
  };
  const shot = async (name) => {
    await sleep(140);
    const r = await send('Page.captureScreenshot', { format: 'webp', quality: 92 });
    const buf = Buffer.from(r.data, 'base64');
    assert(buf.length > 4096, `Empty screenshot ${name}`);
    writeFileSync(join(outDir, `${name}.webp`), buf);
    report.screenshots[name] = buf.length;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });

  viteDev = await createViteDevServer({
    configFile: resolve('vite.config.ts'),
    mode: 'development',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await viteDev.listen();
  const devUrl = `http://127.0.0.1:${viteDev.httpServer.address().port}/`;

  await send('Page.navigate', { url: devUrl });
  await wait(`Boolean(window.__BW_DEVTOOLS__ && window.__GAME__?.scene.isActive('ArcadeScene') && window.__BW_DEVTOOLS__.getScene())`);

  await evaluate(`
    window.s = window.__BW_DEVTOOLS__.getScene();
    s.audio.setMix(0, 0, true);
    window.__BW_DEVTOOLS__.state.beginTestSession(s);
    if (window.__BW_DEVTOOLS__.panel.isOpen()) window.__BW_DEVTOOLS__.panel.setOpen(false);
    s.devJumpToCheckpoint(0, 22, { pauseDirector: true });
    s.setDevSimulationPaused(true);
    s.world.devInvincible = true;
    s.world.weapons.weaponLevel = 5;
    s.world.player.x = 464;
    s.world.player.y = 335;
  `);

  // Verify ALL 7 main poses visually & confirm nose stays locked at angle === 0
  const capturePose = async (name, inputX, steps, holdFire = false) => {
    await evaluate(`
      for (let i = 0; i < ${steps}; i++) {
        s.world.step(1 / 60, { x: ${inputX}, y: 0, fire: ${holdFire && 'i % 4 === 0' || 'false'}, special: false });
      }
      s.world.player.x = Math.max(240, Math.min(680, s.world.player.x));
      s.renderWorld(1 / 60);
    `);
    const info = await evaluate(`({
      bank: Number(s.world.player.bank.toFixed(3)),
      frame: Number(s.player.frame.name),
      angle: s.player.angle,
      texture: s.player.texture.key,
    })`);
    assert.equal(info.texture, 'pelagic-rivet-up');
    assert.equal(info.angle, 0, `${name} must have ZERO 2D nose yaw`);
    report.poses[name] = info;
    await shot(name);
    return info;
  };

  // 1. Neutral center (col 3)
  await evaluate(`s.world.player.bank = 0; s.world.player.x = 464; s.renderWorld(1 / 60);`);
  await capturePose('01-neutral', 0, 1);

  // 2..4. Left progression: moderate (col 2) -> strong (col 1) -> extreme (col 0)
  await capturePose('02-left-moderate', -1, 2);
  await capturePose('03-left-strong', -1, 4);
  await capturePose('04-left-max', -1, 14);
  assert.equal(report.poses['04-left-max'].frame % 7, 0);

  // 8. Smooth return to neutral
  await capturePose('05-return-neutral', 0, 28);
  assert.equal(report.poses['05-return-neutral'].frame % 7, 3);

  // 5..7. Right progression: moderate (col 4) -> strong (col 5) -> extreme (col 6)
  await evaluate(`s.world.player.bank = 0; s.world.player.x = 420;`);
  await capturePose('06-right-moderate', 1, 2);
  await capturePose('07-right-strong', 1, 4);
  await capturePose('08-right-max', 1, 14);
  assert.equal(report.poses['08-right-max'].frame % 7, 6);

  // 9. Rapid reversal right -> left (must traverse intermediate columns without skipping)
  const seqCols = await evaluate(`(() => {
    const seen = [];
    for (let i = 0; i < 34; i++) {
      s.world.step(1 / 60, { x: -1, y: 0, fire: false, special: false });
      s.world.player.x = 464;
      s.renderWorld(1 / 60);
      const col = Number(s.player.frame.name) % 7;
      if (seen.at(-1) !== col) seen.push(col);
    }
    return seen;
  })()`);
  report.transitions.rightToLeft = seqCols;
  for (let i = 1; i < seqCols.length; i++) {
    assert(Math.abs(seqCols[i] - seqCols[i - 1]) <= 1, `Skipped intermediate roll pose: ${seqCols.join('->')}`);
  }
  await capturePose('09-reversal-mid-pass', 1, 5);

  // 10. Firing FULL + missiles during max left roll (bullets stay straight UP!)
  await evaluate(`
    s.world.player.x = 464;
    s.world.player.y = 335;
    s.world.player.bank = -1;
    s.world.step(1 / 60, { x: -1, y: 0, fire: true, special: false });
    for (let i = 0; i < 6; i++) s.world.step(1 / 60, { x: -1, y: 0, fire: false, special: false });
    s.renderWorld(1 / 60);
  `);
  report.combat.firingAtMaxRoll = await evaluate(`({
    col: Number(s.player.frame.name) % 7,
    angle: s.player.angle,
    bulletsUp: s.world.bullets.filter(b => b.active && !b.enemy && b.vy < -250).length,
    centerStraight: s.world.bullets.some(b => b.active && !b.enemy && !b.missile && Math.abs(b.vx) < 1e-5 && b.vy < -300),
  })`);
  assert.equal(report.combat.firingAtMaxRoll.col, 0);
  assert.equal(report.combat.firingAtMaxRoll.angle, 0);
  assert(report.combat.firingAtMaxRoll.bulletsUp >= 3 && report.combat.firingAtMaxRoll.centerStraight);
  await shot('10-max-left-firing-full');

  // Animated WebM clip showing full smooth sweeping roll left <-> center <-> right while shooting
  await evaluate(`s.setDevSimulationPaused(false); s.world.player.x = 464; s.world.player.y = 335;`);
  const videoB64 = await evaluate(`new Promise(async (resolve) => {
    const canvas = document.querySelector('canvas');
    if (!canvas?.captureStream || typeof MediaRecorder === 'undefined') { resolve(null); return; }
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 1800000 });
    const chunks = [];
    rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
    s.setDevSimulationPaused(true);
    rec.start();
    const phases = [
      ...Array(20).fill(0),
      ...Array(28).fill(-1),
      ...Array(38).fill(1),
      ...Array(26).fill(0),
    ];
    for (let i = 0; i < phases.length; i++) {
      s.world.step(1 / 60, { x: phases[i], y: 0, fire: i % 5 === 0, special: false });
      s.world.player.x = Math.max(250, Math.min(680, s.world.player.x));
      s.renderWorld(1 / 60);
      await new Promise(r => setTimeout(r, 22));
    }
    rec.onstop = async () => {
      const buf = await new Blob(chunks, { type: mime }).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      resolve(btoa(bin));
    };
    rec.stop();
  })`);
  if (videoB64) {
    const vbuf = Buffer.from(videoB64, 'base64');
    writeFileSync(join(videoDir, 'rivet-roll-sonic-wings.webm'), vbuf);
    report.video = { path: 'docs/videos/rivet-roll-sonic-wings.webm', bytes: vbuf.length };
  }

  // FPS check & Pause/Resume & Cidade Solar non-regression check
  await evaluate(`s.setDevSimulationPaused(false);`);
  report.perf = await evaluate(`new Promise(resolve => {
    const t = []; let p = performance.now(); const end = p + 1800;
    function tick(n) { t.push(n - p); p = n; if (n < end) requestAnimationFrame(tick); else { const avg = t.reduce((a,b)=>a+b,0)/t.length; resolve({ frames: t.length, avgFps: Number((1000/avg).toFixed(1)) }); } }
    requestAnimationFrame(tick);
  })`);
  assert(report.perf.avgFps >= 15);

  await evaluate(`s.devJumpToCheckpoint(1, 15); s.renderWorld(1 / 60);`);
  report.combat.sideUntouched = await evaluate(`!s.world.up && s.player.texture.key === 'arc-rivet'`);
  assert.equal(report.combat.sideUntouched, true);

  assert.deepEqual(runtimeErrors, [], JSON.stringify(runtimeErrors));
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { if (send) await send('Page.navigate', { url: 'about:blank' }); } catch {}
  socket?.close();
  chrome?.kill();
  await viteDev?.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
