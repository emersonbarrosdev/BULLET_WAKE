import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer as createStaticServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/devtools-v1');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-devtools-e2e-'));

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
};

let viteDev;
let previewProc;
let socket;
let chrome;
const runtimeErrors = [];
const report = {
  testA_devServer: {},
  testB_prodBuild: {},
  testC_preview: {},
  testD_devModeBuild: {},
  functional30: {},
  screenshots: {},
  errors: runtimeErrors,
};

function spawnBuild(args) {
  const proc = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), ...args], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolveDone, rejectDone) => {
    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (c) => { stdout += String(c); });
    proc.stderr?.on('data', (c) => { stderr += String(c); });
    proc.on('exit', (code) => {
      if (code === 0) resolveDone(stdout);
      else rejectDone(new Error(`vite ${args.join(' ')} exited ${code}: ${stderr}\n${stdout}`));
    });
  });
}

function assertDistClean(label) {
  const assetsDir = resolve('dist/assets');
  const files = readdirSync(assetsDir);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  assert.equal(jsFiles.length, 1, `[${label}] Expected 1 JS chunk, got: ${jsFiles.join(', ')}`);
  const bundle = readFileSync(join(assetsDir, jsFiles[0]), 'utf8');
  for (const token of [
    'BULLET WAKE — DEVTOOLS',
    'mountDevTools',
    'DevToolsPanel',
    'DevCollisionOverlay',
    'DevScenarioRegistry',
    '__BW_DEVTOOLS__',
    '__GAME__',
    'bullet_wake_devtools_prefs_v1',
  ]) {
    assert(!bundle.includes(token), `[${label}] Forbidden debug artifact '${token}' found in ${jsFiles[0]}`);
  }
  return { jsChunks: jsFiles.length, bundleBytes: bundle.length, mainChunk: jsFiles[0] };
}

try {
  // ---- TESTE B & D: builds de produção padrão e --mode development ----
  await spawnBuild(['build', '--mode', 'development']);
  report.testD_devModeBuild = assertDistClean('Teste D (--mode development)');

  await spawnBuild(['build']);
  report.testB_prodBuild = assertDistClean('Teste B (production)');

  // Launch headless Chrome CDP
  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=9224',
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
      target = (await (await fetch('http://127.0.0.1:9224/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(150);
  }
  if (!target) throw new Error('Chrome CDP did not start');
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
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const wait = async (expr) => {
    for (let i = 0; i < 180; i++) {
      if (await evaluate(expr)) return;
      await sleep(100);
    }
    throw Error('Timeout waiting for: ' + expr);
  };
  const key = async (code, keyName = code, vk = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName, windowsVirtualKeyCode: vk });
    await sleep(80);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: vk });
  };
  const shot = async (name) => {
    await sleep(160);
    const r = await send('Page.captureScreenshot', { format: 'webp', quality: 90 });
    const buf = Buffer.from(r.data, 'base64');
    assert(buf.length > 4096, `Empty screenshot for ${name}`);
    writeFileSync(join(shotDir, `${name}.webp`), buf);
    report.screenshots[name] = buf.length;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });

  // ---- TESTE A: Vite Dev Server + All 30 Functional Cases + 11 Visual Screenshots ----
  viteDev = await createViteDevServer({
    configFile: resolve('vite.config.ts'),
    mode: 'development',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await viteDev.listen();
  const devAddr = viteDev.httpServer.address();
  const devUrl = `http://127.0.0.1:${devAddr.port}/`;

  await send('Page.navigate', { url: devUrl });
  await wait(`Boolean(window.__BW_DEVTOOLS__ && window.__GAME__?.scene.isActive('ArcadeScene') && window.__BW_DEVTOOLS__.getScene()?.ui)`);
  await evaluate(`
    window.s = window.__BW_DEVTOOLS__.getScene();
    s.audio.setMix(0, 0, true);
    localStorage.setItem('bullet_wake_save_data_v1', JSON.stringify({ schemaVersion: 2, unlockedStages: [1], bestScores: {}, settings: {} }));
    localStorage.setItem('bullet_wake_arcade_v1', JSON.stringify({ cleared: [], flights: {} }));
    window.__PRE_SAVE_MAIN = localStorage.getItem('bullet_wake_save_data_v1');
    window.__PRE_SAVE_ARC = localStorage.getItem('bullet_wake_arcade_v1');
    s.show('title');
  `);

  // 1. Open & close via F9 + toggle button + Escape when focused
  assert.equal(await evaluate(`Boolean(document.querySelector('[data-bw-devtools-toggle]'))`), true);
  await key('F9', 'F9', 120);
  assert.equal(await evaluate(`window.__BW_DEVTOOLS__.panel.isOpen()`), true);
  await shot('01-title-with-devtools');

  await evaluate(`document.querySelector('[data-bw-devtools-panel]').focus()`);
  await key('Escape', 'Escape', 27);
  assert.equal(await evaluate(`window.__BW_DEVTOOLS__.panel.isOpen()`), false);
  await evaluate(`document.querySelector('[data-bw-devtools-toggle]').click()`);
  assert.equal(await evaluate(`window.__BW_DEVTOOLS__.panel.isOpen()`), true);

  // Tab: FASES & Checkpoints (2, 3, 4, 5, 6, 7)
  await evaluate(`window.__BW_DEVTOOLS__.panel.setActiveTab('stages')`);
  await shot('02-stages-tab');
  await evaluate(`window.__BW_DEVTOOLS__.runner.runScenarioById(s, 'stage-1-reg-2')`); // Arquipélago 90s
  await shot('03-pelagic-checkpoint-archipelago');
  assert.equal(await evaluate(`s.world.mission.id`), 1);
  assert.equal(await evaluate(`s.world.region`), 2);

  await evaluate(`window.__BW_DEVTOOLS__.runner.runScenarioById(s, 'stage-2-reg-3')`); // Cidade Solar Via Expressa
  assert.equal(await evaluate(`s.world.mission.id`), 2);
  assert.equal(await evaluate(`s.world.region`), 3);

  // Checkpoints, Tide Arch (Fenda) & Miniboss (Cidade Solar) (6, 7)
  await evaluate(`s.devJumpTideArch('under-arch')`);
  assert.equal(await evaluate(`s.world.tideArch.phase`), 'under-arch');
  await evaluate(`window.__BW_DEVTOOLS__.runner.runBoss(s, 1, true)`);
  assert.equal(await evaluate(`Boolean(s.world.boss?.mini)`), true);
  await shot('06-miniboss-gameplay');

  // Boss Final & Seções & Restaurar componentes (7, 8, 9, 10)
  await evaluate(`window.__BW_DEVTOOLS__.panel.setActiveTab('bosses')`);
  await shot('04-bosses-tab');

  await evaluate(`window.__BW_DEVTOOLS__.runner.runBoss(s, 0, false, { weaponLevel: 5, specialCharges: 5, invincible: true, subSectionIndex: 2 })`);
  assert.equal(await evaluate(`s.world.boss?.sub?.activeSection`), 2);
  await evaluate(`s.world.boss.sub.sections[2].parts[0].hp = 0;`);
  await evaluate(`s.world.devRestoreBossParts();`);
  assert.equal(await evaluate(`s.world.boss.sub.sections[2].parts[0].hp > 0`), true);
  await shot('05-boss-final-section3');

  // FULL + 5 Especiais + Invencibilidade (11, 12, 13, 14)
  await evaluate(`
    window.__BW_DEVTOOLS__.panel.setActiveTab('player');
    window.__BW_DEVTOOLS__.combat.applyPlayerPatch(s, { weaponLevel: 1, specialCharges: 0, invincible: false });
  `);
  assert.equal(await evaluate(`s.world.weapons.weaponLevel`), 1);
  await evaluate(`
    window.__BW_DEVTOOLS__.combat.applyPlayerPatch(s, { weaponLevel: 5, specialCharges: 5, invincible: true });
    s.world.player.x = 384; s.world.player.y = 365;
  `);
  assert.equal(await evaluate(`s.world.weapons.weaponLevel`), 5);
  assert.equal(await evaluate(`s.world.weapons.specialCharges`), 5);
  assert.equal(await evaluate(`s.world.devInvincible`), true);
  await shot('07-player-full-5esp');

  // Enemies & Formations + Clear bullets/enemies (15, 16, 17, 18)
  await evaluate(`
    window.__BW_DEVTOOLS__.panel.setActiveTab('enemies');
    window.__BW_DEVTOOLS__.runner.spawnEnemyTest(s, {
      missionIndex: 0, family: 'heli_warhawk', quantity: 1, formation: 'solo',
      motion: 'stationary', entry: 'top', lane: 0.5, spawnY: 118,
      fireRateScale: 1, shotSpeedScale: 1, difficulty: 'normal', keepExisting: false
    });
    window.__BW_DEVTOOLS__.runner.spawnEnemyTest(s, {
      missionIndex: 0, family: 'heli_phantom', quantity: 2, formation: 'pair',
      motion: 'curve', entry: 'left', lane: 0.3, spawnY: 145,
      fireRateScale: 1, shotSpeedScale: 1, difficulty: 'normal', keepExisting: true
    });
    for (let i = 0; i < 60; i++) s.world.step(1/60);
    s.renderWorld(1/60);
  `);
  assert.equal(await evaluate(`s.world.enemies.length >= 2`), true);
  await shot('08-enemy-spawner');

  // Hitboxes, origins & clear (19, 20, 21)
  await evaluate(`
    window.__BW_DEVTOOLS__.panel.setActiveTab('collisions');
    window.__BW_DEVTOOLS__.collisions.setFlags({ enabled: true, player: true, enemies: true, bullets: true, bulletVectors: true, mounts: true, bosses: true, armorAndHull: true, obstaclesAndCargo: true, specialRadius: true });
    window.__BW_DEVTOOLS__.panel.setActiveTab('collisions');
    s.renderWorld(1/60);
  `);
  await shot('09-collision-hitboxes-overlay');
  await evaluate(`window.__BW_DEVTOOLS__.collisions.setFlags({ enabled: false })`);
  await evaluate(`s.world.clearBullets(); s.world.clearArenaEntities();`);
  assert.equal(await evaluate(`s.world.enemies.length`), 0);

  // Simulation pause, 1/120s step, speed 0.5x/1x, performance measurement, restart & menu & leak check (22..29)
  await evaluate(`
    window.__BW_DEVTOOLS__.panel.setActiveTab('performance');
    window.__BW_DEVTOOLS__.runner.runStressScenario(s, 'multi-helis', 0);
    s.setDevSimulationPaused(true);
    window.__T_BEFORE = s.world.elapsed;
    s.stepDevSimulation(1/120);
    window.__T_AFTER = s.world.elapsed;
    s.setDevTimeScale(0.5);
    s.setDevTimeScale(1);
  `);
  assert.equal(await evaluate(`Math.abs((window.__T_AFTER - window.__T_BEFORE) - 1/120) < 1e-6`), true);
  await evaluate(`window.__BW_DEVTOOLS__.perf.startRecording('Stress Check', 'controlled-simulation')`);
  await sleep(750);
  await evaluate(`window.__PERF_REP = window.__BW_DEVTOOLS__.perf.stopRecording(window.__GAME__, s)`);
  assert.equal(await evaluate(`window.__PERF_REP.frames > 5 && window.__PERF_REP.avgFps > 0`), true);
  await shot('10-performance-tab');

  // Visual Animation Previewer
  await evaluate(`
    window.__BW_DEVTOOLS__.panel.setActiveTab('visual');
    s.setDevSimulationPaused(false);
  `);
  await sleep(300);
  await shot('11-visual-animation-previewer');

  // Repeated stage switches -> zero leaked display objects & save non-mutation (26, 27, 28, 29)
  await evaluate(`
    window.__OBJ_START = s.children.length;
    for (let i = 0; i < 6; i++) {
      window.__BW_DEVTOOLS__.runner.runScenarioById(s, i % 2 === 0 ? 'stage-1-reg-1' : 'stage-2-reg-1');
    }
    window.__OBJ_END = s.children.length;
    // Simulate a victory under dev test session -> saveClear MUST NOT overwrite real save!
    s.world.state = 'victory';
    s.saveClear();
    window.__POST_SAVE_MAIN = localStorage.getItem('bullet_wake_save_data_v1');
    window.__POST_SAVE_ARC = localStorage.getItem('bullet_wake_arcade_v1');
    window.__BW_DEVTOOLS__.state.endTestSession(s);
    s.devExitToMenu();
  `);
  assert.equal(await evaluate(`window.__POST_SAVE_MAIN === window.__PRE_SAVE_MAIN && window.__POST_SAVE_ARC === window.__PRE_SAVE_ARC`), true);
  assert.equal(await evaluate(`Math.abs(window.__OBJ_END - window.__OBJ_START) <= 25`), true);
  assert.equal(await evaluate(`s.screen`), 'title');

  // Navigate to blank page before closing dev server so background audio retries never hit closed port
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(100);
  await viteDev.close();
  viteDev = undefined;

  // ---- TESTE C: `vite preview` real server serving dist/ ----
  previewProc = spawn(
    process.execPath,
    [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4179', '--strictPort'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4179/');
      if (res.ok) break;
    } catch {}
    await sleep(100);
  }

  await send('Page.navigate', { url: 'http://127.0.0.1:4179/?devtools=1&debug=1' });
  await wait(`Boolean(document.querySelector('canvas')?.width > 0)`);
  await evaluate(`localStorage.setItem('bullet_wake_devtools_prefs_v1', JSON.stringify({ open: true }));`);
  await sleep(8200); // Allow loading (3.22s) + BOTAN intro (4.45s) -> title screen
  await key('F9', 'F9', 120);
  await sleep(250);

  report.testC_preview = await evaluate(`({
    hasGameGlobal: typeof window.__GAME__ !== 'undefined',
    hasPhaserGlobal: typeof window.Phaser !== 'undefined',
    hasDevToolsGlobal: typeof window.__BW_DEVTOOLS__ !== 'undefined',
    hasDevButtonOrPanel: Boolean(document.querySelector('[data-bw-devtools-toggle],[data-bw-devtools-panel]')),
    canvasOk: (document.querySelector('canvas')?.width ?? 0) >= 768 && (document.querySelector('canvas')?.height ?? 0) >= 432
  })`);
  assert.deepEqual(report.testC_preview, {
    hasGameGlobal: false,
    hasPhaserGlobal: false,
    hasDevToolsGlobal: false,
    hasDevButtonOrPanel: false,
    canvasOk: true,
  });
  await shot('12-preview-no-devtools');

  assert.deepEqual(runtimeErrors, [], JSON.stringify(runtimeErrors));
  writeFileSync(join(shotDir, 'devtools-e2e-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket?.close();
  chrome?.kill();
  previewProc?.kill();
  await viteDev?.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
