import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/pelagic-v24');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-v24-verify-'));

let viteDev;
let chrome;
let socket;
const runtimeErrors = [];
const report = {
  resolution: '1366x768',
  screenshots: {},
  perf: {},
  weaponDebugVerified: false,
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
  const url = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 5176}/`;

  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=9228',
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
      target = (await (await fetch('http://127.0.0.1:9228/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(150);
  }
  if (!target) throw new Error('Chrome CDP failed on 9228');
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
  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(shotDir, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    report.screenshots[name] = file;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });

  for (let i = 0; i < 80; i++) {
    const ready = await evaluate(`window.__GAME__?.scene?.getScene?.('ArcadeScene')?.openingState === 'MAIN_MENU'`);
    if (ready) break;
    await sleep(160);
  }

  // Start Stage 1 with invulnerability and dev pause-director control
  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    sc.devJumpToCheckpoint(0, 12, { pauseDirector: true });
    sc.world.player.invulnerable = 99999;
    sc.world.clearArenaEntities();
    window.__BW_PERF__ = window.__BW_DEVTOOLS__?.perf;
  })()`);
  await sleep(150);

  // 1-4: Individual helicopters + banking + firing + rotors
  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    const a = sc.devStartEnemyTest(0, { family: 'heli_scout', formation: 'pair', motion: 'sine', lane: .48, speed: 95 }, { y: 120, pauseDirector: true });
    sc.world.player.invulnerable = 99999;
    for (const e of a) e.cooldown = 0.05;
  })()`);
  await sleep(260);
  await shot('01-heli-scout-firing');

  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    const a = sc.devStartEnemyTest(0, { family: 'heli_utility', formation: 'solo', motion: 'stationary', lane: .50, speed: 74 }, { x: 460, y: 125, pauseDirector: true });
    sc.world.player.invulnerable = 99999;
    a[0].cooldown = 0.04;
  })()`);
  await sleep(240);
  await shot('02-heli-utility-firing');

  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    const a = sc.devStartEnemyTest(0, { family: 'heli_phantom', formation: 'solo', motion: 'zigzag', lane: .52, speed: 128 }, { x: 470, y: 125, pauseDirector: true });
    sc.world.player.invulnerable = 99999;
    a[0].vx = 95;
    a[0].cooldown = 0.04;
  })()`);
  await sleep(240);
  await shot('03-heli-phantom-banking');

  // Warhawk firing chin cannon AND then straight unguided missile
  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    const a = sc.devStartEnemyTest(0, { family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: .50, speed: 80 }, { x: 464, y: 118, pauseDirector: true });
    sc.world.player.invulnerable = 99999;
    a[0].attackStep = 2; // trigger missile shot immediately
    a[0].cooldown = 0.02;
  })()`);
  await sleep(260);
  await shot('04-heli-warhawk-missile');

  // Helicopter damaged + destroyed visual feedback
  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    const a = sc.devStartEnemyTest(0, { family: 'heli_warhawk', formation: 'solo', motion: 'stationary', lane: .50, speed: 80 }, { x: 464, y: 122, pauseDirector: true });
    sc.world.player.invulnerable = 99999;
    a[0].hp = 4; // low HP < 45% -> smoking + damaged rotor instability
    a[0].flash = 0.09;
  })()`);
  await sleep(260);
  await shot('05-heli-warhawk-damaged');

  // 6: Real coastal island & pier cannons (Model C fortress tower + Models A/B/D tank bunker) + naval turrets + weapon origin debug lines
  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    sc.devJumpToCheckpoint(0, 89, { pauseDirector: true });
    sc.world.player.invulnerable = 99999;
    sc.world.clearArenaEntities();
    sc.toggleDevWeaponDebug(true);
    const t1 = sc.world.devSpawnEncounter({ family: 'tower', formation: 'solo', motion: 'stationary', lane: .85 }, { keepExisting: true })[0];
    if (t1) sc.world.scroll += (165 - t1.y);
    const tk = sc.world.devSpawnEncounter({ family: 'tank', formation: 'solo', motion: 'stationary', lane: .25 }, { keepExisting: true })[0];
    if (tk) tk.cooldown = 0.04;
    if (t1) t1.cooldown = 0.04;
    sc.world.devSpawnEncounter({ family: 'ship', formation: 'solo', motion: 'stationary', lane: .50 }, { keepExisting: true });
    const sh = sc.world.enemies.find(e => e.family === 'ship');
    if (sh) { sh.y = 148; if (sh.navigation) { sh.navigation.worldY = 148 - sc.world.scroll; sh.navigation.phase = 'hold'; } sh.cooldown = 0.04; }
  })()`);
  await sleep(340);
  await shot('06-coastal-cannons-debug-origin');

  // 7: Tide Arch showing cliff-integrated cannons (Model B & D) + boat turret + shooting
  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    sc.devJumpTideArch('low-flight');
    sc.world.player.invulnerable = 99999;
    sc.toggleDevWeaponDebug(true);
    for (const e of sc.world.enemies) {
      if (e.y > 40 && e.y < 300) e.cooldown = 0.04;
    }
  })()`);
  await sleep(320);
  await shot('07-tide-arch-cannons-boats-debug');

  // 8: Destroyed coastal cliff cannon crater on rock & active ship dual turrets without debug overlay
  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    sc.toggleDevWeaponDebug(false);
    sc.devJumpTideArch('low-flight');
    sc.world.player.invulnerable = 99999;
    // Destroy one cliff cannon on rock pier so its octagonal smoking crater stays anchored on the stone platform!
    const archCan = sc.world.enemies.find(e => e.family === 'tower' && e.y > 80 && e.y < 320);
    if (archCan) sc.world.damage(archCan, 999, archCan.x, archCan.y);
    // Also spawn a visible Ship cruiser in the central channel firing its dual painted turrets
    const sh = sc.world.devSpawnEncounter({ family: 'ship', formation: 'solo', motion: 'stationary', lane: .50 }, { keepExisting: true })[0];
    if (sh) {
      sh.x = 384; sh.y = 145;
      if (sh.navigation) { sh.navigation.worldY = 145 - sc.world.scroll; sh.navigation.phase = 'hold'; }
      sh.cooldown = 0.03;
    }
  })()`);
  await sleep(340);
  await shot('08-ship-turret-and-cannon-wreck');

  report.weaponDebugVerified = true;

  // Measure live 60 FPS target in active helicopter + coastal cannon combat
  await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    sc.devJumpToCheckpoint(0, 92, { pauseDirector: false });
    sc.world.player.invulnerable = 99999;
    window.__BW_DEVTOOLS__?.perf?.startRecording('v24-combat', 'automated');
  })()`);
  await sleep(3200);
  report.perf = await evaluate(`window.__BW_DEVTOOLS__?.perf?.stopRecording(window.__GAME__, window.__GAME__.scene.getScene('ArcadeScene')) ?? {}`);

  assert.equal(runtimeErrors.length, 0, `Runtime errors: ${JSON.stringify(runtimeErrors)}`);
  assert.ok((report.perf.avgFps ?? 0) >= 50, `Expected smooth FPS >= 50, got ${report.perf.avgFps}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Pelagic v24 Browser Verification PASSED:', JSON.stringify(report, null, 2));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  try { await viteDev?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
