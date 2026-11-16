import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/tide-arch');
const videoDir = resolve('docs/videos');
mkdirSync(shotDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-tide-arch-e2e-'));

let viteDev;
let chrome;
let socket;
let send;
const runtimeErrors = [];

const report = {
  pc: { resolutions: ['1366x768', '1920x1080'], checks: {}, perf: {}, screenshots: {}, video: null },
  androidPortrait: {
    resolutions: ['720x1600', '1080x1920'],
    note: 'Tested via Chromium DevTools mobile portrait + touch emulation (physical Android hardware not connected).',
    checks: {},
    perf: {},
    screenshots: {},
  },
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
      '--remote-debugging-port=9225',
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
      target = (await (await fetch('http://127.0.0.1:9225/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(150);
  }
  if (!target) throw new Error('Chrome CDP did not start on port 9225');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    socket.onopen = res;
    socket.onerror = rej;
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
    throw Error('Timeout waiting for: ' + expr);
  };
  const shot = async (bucket, name) => {
    await sleep(180);
    const r = await send('Page.captureScreenshot', { format: 'webp', quality: 92 });
    const buf = Buffer.from(r.data, 'base64');
    assert(buf.length > 4096, `Empty screenshot ${name}`);
    writeFileSync(join(shotDir, `${name}.webp`), buf);
    bucket[name] = buf.length;
  };
  const measureFps = async (durationMs = 2200) => {
    return evaluate(`new Promise(resolve => {
      const times = [];
      let prev = performance.now();
      const endAt = prev + ${durationMs};
      function tick(now) {
        times.push(now - prev);
        prev = now;
        if (now < endAt) requestAnimationFrame(tick);
        else {
          const sorted = [...times].sort((a, b) => a - b);
          const avg = times.reduce((a, b) => a + b, 0) / Math.max(1, times.length);
          resolve({
            frames: times.length,
            avgFps: Number((1000 / Math.max(1, avg)).toFixed(1)),
            p50Ms: Number((sorted[Math.floor(sorted.length * 0.5)] ?? 0).toFixed(2)),
            p95Ms: Number((sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2)),
          });
        }
      }
      requestAnimationFrame(tick);
    })`);
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');

  viteDev = await createViteDevServer({
    configFile: resolve('vite.config.ts'),
    mode: 'development',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await viteDev.listen();
  const devAddr = viteDev.httpServer.address();
  const devUrl = `http://127.0.0.1:${devAddr.port}/`;

  // ==========================================================
  // PART 1: PC HORIZONTAL (1366x768 & 1920x1080)
  // ==========================================================
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await send('Page.navigate', { url: devUrl });
  await wait(`Boolean(window.__BW_DEVTOOLS__ && window.__GAME__?.scene.isActive('ArcadeScene') && window.__BW_DEVTOOLS__.getScene()?.ui)`);

  await evaluate(`
    window.s = window.__BW_DEVTOOLS__.getScene();
    s.audio.setMix(0, 0, true);
    window.__BW_DEVTOOLS__.state.beginTestSession(s);
    if (window.__BW_DEVTOOLS__.panel.isOpen()) window.__BW_DEVTOOLS__.panel.setOpen(false);
    s.devJumpTideArch('approach');
    s.world.devInvincible = true;
    s.world.weapons.weaponLevel = 3;
    s.renderWorld(1 / 60);
  `);

  report.pc.checks.layout = await evaluate(`({
    upLayout: s.world.upLayout,
    arena: s.world.arena,
    hudTopY: s.hud.y,
    hudVisible: s.hud.visible,
    hudLeftVisible: s.hudLeft.visible,
    hudRightVisible: s.hudRight.visible,
    pauseVisible: Boolean(s.pauseBtn?.visible),
    portraitUpActive: s.portraitUpActive,
    rotateHintHidden: getComputedStyle(document.getElementById('rotate-hint')).display === 'none',
  })`);
  assert.equal(report.pc.checks.layout.upLayout, 'pc');
  assert.equal(report.pc.checks.layout.arena.left, 160);
  assert.equal(report.pc.checks.layout.arena.right, 768);
  assert.equal(report.pc.checks.layout.hudVisible, true);
  assert(report.pc.checks.layout.hudTopY < 32, 'Score HUD must be on top bar in PC UP mode');
  assert.equal(report.pc.checks.layout.hudLeftVisible, true);
  assert.equal(report.pc.checks.layout.hudRightVisible, false);
  assert.equal(report.pc.checks.layout.pauseVisible, true);
  assert.equal(report.pc.checks.layout.portraitUpActive, false);
  assert.equal(report.pc.checks.layout.rotateHintHidden, true);

  await shot(report.pc.screenshots, 'pc-01-approach');

  // 2. Descent (altitude drops 1 -> ~0.45)
  await evaluate(`
    s.devJumpTideArch('descent');
    s.world.devInvincible = true;
    s.world.weapons.weaponLevel = 3;
    for (let i = 0; i < 60; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  report.pc.checks.descentAlt = await evaluate(`Number(s.world.player.altitude.toFixed(2))`);
  assert(report.pc.checks.descentAlt < 0.95 && report.pc.checks.descentAlt >= 0);
  await shot(report.pc.screenshots, 'pc-02-descent');

  // 3. Low-Flight + Cannons + Patrol Boats
  await evaluate(`
    s.devJumpTideArch('low-flight');
    s.world.devInvincible = true;
    s.world.weapons.weaponLevel = 3;
    for (let i = 0; i < 75; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  report.pc.checks.lowFlightAirBlocked = await evaluate(`s.world.tideArch.airSpawnsBlocked && !s.world.enemies.some(e => !e.ground)`);
  assert.equal(report.pc.checks.lowFlightAirBlocked, true);
  await shot(report.pc.screenshots, 'pc-03-low-flight');

  // Record a crisp WebM video crossing from low-flight -> under-arch -> ascent -> checkpoint!
  const videoB64 = await evaluate(`new Promise(async (resolve) => {
    const canvas = document.querySelector('canvas');
    if (!canvas || !canvas.captureStream || typeof MediaRecorder === 'undefined') {
      resolve(null);
      return;
    }
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
    const stream = canvas.captureStream(30);
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 });
    rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
    s.devJumpTideArch('descent');
    s.world.devInvincible = true;
    s.world.weapons.weaponLevel = 3;
    rec.start();
    const start = performance.now();
    while (performance.now() - start < 4800) {
      await new Promise(r => setTimeout(r, 40));
    }
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: mime });
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      resolve(btoa(bin));
    };
    rec.stop();
  })`);
  if (videoB64) {
    const vbuf = Buffer.from(videoB64, 'base64');
    const vpath = join(videoDir, 'arco-das-mares-pc.webm');
    writeFileSync(vpath, vbuf);
    report.pc.video = { path: 'docs/videos/arco-das-mares-pc.webm', bytes: vbuf.length };
  }

  // 4. Under Arch (bridge over RIVET + bullets above arch)
  await evaluate(`
    s.devJumpTideArch('under-arch');
    s.world.devInvincible = true;
    s.world.weapons.weaponLevel = 3;
    s.world.player.y = s.world.tideArch.archScreenY(s.world.scroll) + 4;
    for (let i = 0; i < 18; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  report.pc.checks.underArchDepth = await evaluate(`({
    inBand: s.world.tideArch.isInBridgeBand(s.world.scroll, s.world.player.y),
    altitude: s.world.player.altitude,
  })`);
  await shot(report.pc.screenshots, 'pc-04-under-arch');

  // Measure live PC FPS
  report.pc.perf = await measureFps(2200);
  assert(report.pc.perf.frames > 20 && report.pc.perf.avgFps >= 15);

  // 5. Ascent (zero air spawns before altitudeRestored)
  await evaluate(`
    s.devJumpTideArch('ascent');
    s.world.devInvincible = true;
    for (let i = 0; i < 35; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  await shot(report.pc.screenshots, 'pc-05-ascent');

  // 6. Checkpoint Achieved banner + snapshot
  await evaluate(`
    s.devJumpTideArch('checkpoint');
    s.renderWorld(1 / 60);
  `);
  report.pc.checks.checkpointActive = await evaluate(`s.world.hasActiveCheckpoint && s.world.tideArch.altitudeRestored && s.world.score >= 3500`);
  assert.equal(report.pc.checks.checkpointActive, true);
  await shot(report.pc.screenshots, 'pc-06-checkpoint');

  // 7. Air return after checkpoint (191.5s -> wave @ 192s)
  await evaluate(`
    s.devJumpToCheckpoint(0, 191.5);
    s.world.devInvincible = true;
    for (let i = 0; i < 120; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  report.pc.checks.airResumed = await evaluate(`s.world.enemies.some(e => !e.ground)`);
  assert.equal(report.pc.checks.airResumed, true);
  await shot(report.pc.screenshots, 'pc-07-air-return');

  // 8. 1920x1080 wide desktop under-arch capture
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await sleep(180);
  await evaluate(`
    s.devJumpTideArch('under-arch');
    s.world.devInvincible = true;
    s.world.weapons.weaponLevel = 3;
    s.world.player.y = s.world.tideArch.archScreenY(s.world.scroll) + 2;
    s.renderWorld(1 / 60);
  `);
  await shot(report.pc.screenshots, 'pc-1080p-under-arch');

  // ==========================================================
  // PART 2: ANDROID PORTRAIT (EMULATED TOUCH 720x1600 & 1080x1920)
  // ==========================================================
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 2, mobile: true });
  await sleep(220);
  await evaluate(`
    window.dispatchEvent(new Event('resize'));
    s.devJumpTideArch('approach');
    s.world.devInvincible = true;
    s.world.weapons.weaponLevel = 3;
    s.renderWorld(1 / 60);
  `);
  report.androidPortrait.checks.layout = await evaluate(`({
    upLayout: s.world.upLayout,
    arena: s.world.arena,
    portraitUpActive: s.portraitUpActive,
    hudLeftHidden: !s.hudLeft.visible,
    hudRightHidden: !s.hudRight.visible,
    hudVisible: s.hud.visible,
    hudTopY: s.hud.y,
    touchShown: s.touchShown,
    touchLayout: s.touchController.getLayout(),
    requireLandscape: document.body.dataset.requireLandscape,
    rotateHintHidden: getComputedStyle(document.getElementById('rotate-hint')).display === 'none',
  })`);
  assert.equal(report.androidPortrait.checks.layout.upLayout, 'portrait');
  assert.equal(report.androidPortrait.checks.layout.arena.left, 0);
  assert.equal(report.androidPortrait.checks.layout.arena.right, 384);
  assert.equal(report.androidPortrait.checks.layout.portraitUpActive, true);
  assert.equal(report.androidPortrait.checks.layout.hudLeftHidden, true);
  assert.equal(report.androidPortrait.checks.layout.hudRightHidden, true);
  assert.equal(report.androidPortrait.checks.layout.hudVisible, true);
  assert(report.androidPortrait.checks.layout.hudTopY < 32);
  assert.equal(report.androidPortrait.checks.layout.touchShown, true);
  assert.equal(report.androidPortrait.checks.layout.requireLandscape, 'false');
  assert.equal(report.androidPortrait.checks.layout.rotateHintHidden, true);

  // Verify ESP is strictly above TIRO on the right and joystick is bottom-left
  const ts = report.androidPortrait.checks.layout.touchLayout;
  assert(ts.joystick.x < 192 && ts.fire.x > 192 && ts.special.y < ts.fire.y, `Portrait touch anchors invalid: ${JSON.stringify(ts)}`);

  await shot(report.androidPortrait.screenshots, 'android-01-approach-720x1600');

  await evaluate(`
    s.devJumpTideArch('descent');
    s.world.devInvincible = true;
    for (let i = 0; i < 65; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  await shot(report.androidPortrait.screenshots, 'android-02-descent-720x1600');

  // Switch emulated device to 540x960 @ 2x (= 1080x1920)
  await send('Emulation.setDeviceMetricsOverride', { width: 540, height: 960, deviceScaleFactor: 2, mobile: true });
  await sleep(240);
  await evaluate(`
    s.devJumpTideArch('low-flight');
    s.world.devInvincible = true;
    for (let i = 0; i < 70; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  await shot(report.androidPortrait.screenshots, 'android-03-low-flight-1080x1920');

  await evaluate(`
    s.devJumpTideArch('under-arch');
    s.world.devInvincible = true;
    s.world.player.y = s.world.tideArch.archScreenY(s.world.scroll) + 4;
    for (let i = 0; i < 14; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  await shot(report.androidPortrait.screenshots, 'android-04-under-arch-1080x1920');

  report.androidPortrait.perf = await measureFps(2200);
  assert(report.androidPortrait.perf.frames > 20 && report.androidPortrait.perf.avgFps >= 15);

  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 2, mobile: true });
  await sleep(200);
  await evaluate(`
    s.devJumpTideArch('checkpoint');
    s.renderWorld(1 / 60);
  `);
  await shot(report.androidPortrait.screenshots, 'android-05-checkpoint-720x1600');

  await evaluate(`
    s.devJumpToCheckpoint(0, 191.5);
    s.world.devInvincible = true;
    for (let i = 0; i < 120; i++) s.stepDevSimulation(1 / 60);
    s.renderWorld(1 / 60);
  `);
  await shot(report.androidPortrait.screenshots, 'android-06-air-return-720x1600');

  // Verify SIDE (Cidade Solar) still requires landscape and triggers #rotate-hint in portrait!
  await evaluate(`s.devJumpToCheckpoint(1, 10)`);
  await sleep(160);
  report.androidPortrait.checks.sideRotateHint = await evaluate(`({
    requireLandscape: document.body.dataset.requireLandscape,
    rotateHintVisible: getComputedStyle(document.getElementById('rotate-hint')).display === 'flex',
  })`);
  assert.equal(report.androidPortrait.checks.sideRotateHint.requireLandscape, 'true');
  assert.equal(report.androidPortrait.checks.sideRotateHint.rotateHintVisible, true);

  assert.deepEqual(runtimeErrors, [], JSON.stringify(runtimeErrors));
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { await send('Page.navigate', { url: 'about:blank' }); } catch {}
  socket?.close();
  chrome?.kill();
  await viteDev?.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
