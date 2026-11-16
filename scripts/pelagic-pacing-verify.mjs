import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/pelagic-pacing-v1');
const videoDir = resolve('docs/videos');
mkdirSync(shotDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-pacing-e2e-'));

let viteDev;
let chrome;
let socket;
const runtimeErrors = [];
const report = {
  pc: { resolution: '1366x768', screenshots: {}, perf: {}, pacing: null, video: null },
  androidPortrait: {
    resolution: '720x1600',
    note: 'Chromium DevTools mobile portrait + touch emulation (physical Android hardware not connected).',
    screenshots: {},
    pacing: null,
  },
  devtoolsCheck: {},
  errors: runtimeErrors,
};

try {
  viteDev = await createViteDevServer({
    configFile: resolve('vite.config.ts'),
    mode: 'development',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await viteDev.listen();
  const addr = viteDev.httpServer.address();
  const url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 5175}/`;

  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=9227',
      '--remote-allow-origins=*',
      '--no-first-run',
      '--autoplay-policy=no-user-gesture-required',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );

  let target;
  for (let i = 0; i < 160; i++) {
    try {
      target = (await (await fetch('http://127.0.0.1:9227/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(150);
  }
  if (!target) throw new Error('Chrome CDP failed on 9227');
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
  const shot = async (name, bucket = report.pc.screenshots) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(shotDir, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    bucket[name] = file;
    return file;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });

  for (let i = 0; i < 80; i++) {
    const ready = await evaluate(`Boolean(window.__GAME__ && window.__BW_DEVTOOLS__ && window.__GAME__.scene.getScene('ArcadeScene')?.openingPhase === 'TITLE_VISIBLE')`);
    if (ready) break;
    await sleep(150);
  }

  // Begin isolated DevTools test session + jump to start of Fenda Pelagica (invincible pilot)
  await evaluate(`(() => {
    const dev = window.__BW_DEVTOOLS__;
    const sc = dev.getScene();
    dev.state.beginTestSession(sc);
    sc.devJumpToCheckpoint(0, 0);
    sc.world.devInvincible = true;
    sc.world.weapons.weaponLevel = 3;
    window.__BW_DEVTOOLS__.perf.startRecording('Fenda Pelagica Ritmo v25 (1366x768)', 'controlled-simulation');
    const c = document.querySelector('#game canvas');
    const stream = c.captureStream(24);
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks = [];
    rec.ondataavailable = (ev) => { if (ev.data.size > 0) chunks.push(ev.data); };
    window.__BW_REC__ = { rec, chunks };
    rec.start(250);
  })()`);

  // Step through authentic live showcase clips across all 14 moments while recording WebM
  const captureMoment = async (name, setupExpr, waitMs = 1500) => {
    await evaluate(setupExpr);
    await sleep(waitMs);
    await shot(name);
  };

  // 1. Opening combat (1.2s..3.5s)
  await captureMoment('01-opening-combat', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.devJumpToCheckpoint(0, 1); sc.world.devInvincible = true; sc.world.weapons.weaponLevel = 2; })()`, 2200);
  // 2. Fighters attacking & firing
  await captureMoment('02-fighters-attack', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'fighter', formation: 'v', motion: 'sine', lane: 0.5 }); sc.world.enemies.forEach(e => { e.y = 115; e.cooldown = 0.05; }); })()`, 950);
  // 3. Side-entry planes from left/right
  await captureMoment('03-side-entry-planes', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'interceptor', formation: 'pair', motion: 'side-cross', lane: 0.25, speed: 155, entry: 'left' }); sc.world.devSpawnEncounter({ family: 'acrobat', formation: 'pair', motion: 'side-curve', lane: 0.35, speed: 128, entry: 'right' }, { keepExisting: true }); })()`, 950);
  // 4. Boat firing in coastal channel
  await captureMoment('04-boat-firing', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'boat', formation: 'pair', motion: 'stationary', lane: 0.5 }); for (const b of sc.world.enemies) { b.y = 148; if (b.navigation) b.navigation.worldY = 148 - sc.world.scroll; b.cooldown = 0.05; } })()`, 900);
  // 5. Submarine emerging and attacking
  await captureMoment('05-submarine-attack', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'submarine', formation: 'solo', motion: 'stationary', lane: 0.4 }); for (const s of sc.world.enemies) { s.age = 1.6; if (s.submarine) { s.submarine.phase = 'hold'; s.submarine.exposure = 1; } s.cooldown = 0.05; } })()`, 750);
  // 6. Coastal cannon firing
  await captureMoment('06-coastal-cannon', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'tower', formation: 'solo', motion: 'stationary', lane: 0.85 }); for (const t of sc.world.enemies) { t.y = 142; if (t.navigation) t.navigation.worldY = 142 - sc.world.scroll; t.cooldown = 0.05; } })()`, 750);
  // 7. Helicopter Scout
  await captureMoment('07-heli-scout', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'heli_scout', formation: 'pair', motion: 'sine', lane: 0.5 }, { y: 120 }); sc.world.enemies.forEach(e => e.cooldown = 0.05); })()`, 750);
  // 8. Helicopter Utility
  await captureMoment('08-heli-utility', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'heli_utility', formation: 'solo', motion: 'stationary', lane: 0.5 }, { y: 112 }); sc.world.enemies.forEach(e => e.cooldown = 0.05); })()`, 850);
  // 9. Helicopter Phantom
  await captureMoment('09-heli-phantom', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'heli_phantom', formation: 'solo', motion: 'side-curve', lane: 0.35, entry: 'left' }, { x: 350, y: 120 }); sc.world.enemies.forEach(e => e.cooldown = 0.05); })()`, 750);
  // 10. Warhawk firing straight fast missile
  await captureMoment('10-warhawk-missile', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: 0.5 }, { y: 108 }); for (const w of sc.world.enemies) { w.attackStep = 2; w.cooldown = 0.05; } })()`, 420);
  // 11. Mixed aircraft + coastal cannons attack
  await captureMoment('11-mixed-air-cannon', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.world.clearArenaEntities(); sc.world.devSpawnEncounter({ family: 'tower', formation: 'solo', motion: 'stationary', lane: 0.85 }); for (const t of sc.world.enemies) { t.y = 148; if (t.navigation) t.navigation.worldY = 148 - sc.world.scroll; t.cooldown = 0.08; } sc.world.devSpawnEncounter({ family: 'interceptor', formation: 'pair', motion: 'side-cross', lane: 0.25, speed: 150, entry: 'right' }, { keepExisting: true }); sc.world.devSpawnEncounter({ family: 'heli_scout', formation: 'solo', motion: 'sine', lane: 0.42 }, { y: 100, keepExisting: true }); })()`, 750);
  // 12. Arco das Marés (boats & cannons only)
  await captureMoment('12-tide-arch', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.devJumpTideArch('low-flight'); sc.world.devInvincible = true; })()`, 1450);
  // 13. Escalada final (~255-278s)
  await captureMoment('13-final-escalation', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.devJumpToCheckpoint(0, 265); sc.world.devInvincible = true; })()`, 2400);
  // 14. Entrance of Colosso Abissal submarine boss (300s)
  await captureMoment('14-colosso-entrance', `(() => { const sc = window.__BW_DEVTOOLS__.getScene(); sc.devJumpToCheckpoint(0, 300, { bossMini: false }); sc.world.devInvincible = true; })()`, 2600);

  // Stop Perf & WebM Recording cleanly
  const perfAndVideo = await evaluate(`(async () => {
    const dev = window.__BW_DEVTOOLS__;
    const sc = dev.getScene();
    const perf = dev.perf.stopRecording(window.__GAME__, sc);
    const pacing = sc.world.devPacingReport();
    const { rec, chunks } = window.__BW_REC__;
    const stopped = new Promise((r) => (rec.onstop = r));
    rec.stop();
    await stopped;
    const blob = new Blob(chunks, { type: 'video/webm' });
    const buf = await blob.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { perf, pacing, videoB64: btoa(bin) };
  })()`);
  const videoPath = join(videoDir, 'fenda-pelagica-ritmo-v25.webm');
  writeFileSync(videoPath, Buffer.from(perfAndVideo.videoB64, 'base64'));
  report.pc.perf = perfAndVideo.perf;
  report.pc.pacing = perfAndVideo.pacing;
  report.pc.video = videoPath;
  assert.ok(perfAndVideo.perf.avgFps >= 30, `Live WebGL FPS too low in headless SwiftShader: ${perfAndVideo.perf.avgFps}`);

  // DevTools Events & Pacing Analysis Tab verification
  await evaluate(`(() => {
    const dev = window.__BW_DEVTOOLS__;
    dev.panel.setOpen(true);
    const tabs = Array.from(document.querySelectorAll('.bw-dev-tab'));
    const evtTab = tabs.find((b) => b.textContent === 'EVENTOS');
    evtTab?.click();
  })()`);
  await sleep(350);
  const dtText = await evaluate(`document.querySelector('[data-bw-devtools-panel="true"] pre')?.textContent ?? ''`);
  assert.ok(dtText.includes('Presença:') && dtText.includes('Cadência:'), `DevTools Events/Rhythm readout missing expected metrics: ${dtText}`);
  await shot('16-devtools-pacing');
  report.devtoolsCheck = { openOk: true, textSample: dtText.slice(0, 180) };
  await evaluate(`window.__BW_DEVTOOLS__.panel.setOpen(false)`);

  // Android Vertical Portrait (720x1600 touch emulation) gameplay check
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 720, height: 1600, deviceScaleFactor: 1, mobile: true,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await sleep(300);
  await evaluate(`(() => {
    const sc = window.__BW_DEVTOOLS__.getScene();
    sc.devJumpToCheckpoint(0, 48);
    sc.world.devInvincible = true;
    sc.world.weapons.weaponLevel = 3;
  })()`);
  await sleep(2400);
  await shot('15-android-portrait-combat', report.androidPortrait.screenshots);
  const portraitSnap = await evaluate(`(() => {
    const sc = window.__BW_DEVTOOLS__.getScene();
    const rotateDisp = getComputedStyle(document.getElementById('rotate-hint')).display;
    return {
      upLayout: sc.world.upLayout,
      arenaWidth: sc.world.arenaWidth,
      rotateDisplay: rotateDisp,
      pacing: sc.world.devPacingReport(),
    };
  })()`);
  assert.equal(portraitSnap.rotateDisplay, 'none', 'Android Portrait UP gameplay must not be blocked by rotate-hint');
  report.androidPortrait.pacing = portraitSnap;

  assert.equal(runtimeErrors.length, 0, `Runtime errors detected: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Task 25 Pacing Visual & Browser Verification PASSED:\n', JSON.stringify(report, null, 2));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  try { await viteDev?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
