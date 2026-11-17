import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/devtools-v28');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-devtools-arch-'));
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
};

function spawnBuild() {
  const proc = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'build'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((res, rej) => {
    let out = '';
    let err = '';
    proc.stdout?.on('data', (d) => (out += String(d)));
    proc.stderr?.on('data', (d) => (err += String(d)));
    proc.on('exit', (code) => (code === 0 ? res(out) : rej(new Error(`vite build failed (${code}): ${err}\n${out}`))));
  });
}

let devServer;
let prodServer;
let chrome;
let socket;
const runtimeErrors = [];
const report = {
  functionalTests: {},
  fpsMeasurements: {},
  productionIsolation: {},
  screenshots: {},
  errors: runtimeErrors,
};

try {
  await spawnBuild();

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
      '--remote-debugging-port=9239',
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
      target = (await (await fetch('http://127.0.0.1:9239/json')).json()).find((t) => t.type === 'page');
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

  let nextId = 1;
  const pending = new Map();
  socket.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.rej(new Error(msg.error.message));
      else p.res(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(msg.params?.exceptionDetails?.text ?? 'exception');
    }
  };

  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, { res, rej });
      socket.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (out.exceptionDetails) {
      throw new Error(out.exceptionDetails.text + ': ' + JSON.stringify(out.exceptionDetails.exception));
    }
    return out.result?.value;
  };

  const shot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(shotDir, `${name}.png`);
    writeFileSync(file, Buffer.from(res.data, 'base64'));
    report.screenshots[name] = file;
  };

  const measureLiveFps = async (durationFrames = 60) => {
    return evaluate(`(async () => {
      const times = [];
      let n = 0;
      await new Promise((ok) => {
        const tick = (t) => {
          times.push(t);
          if (++n >= ${durationFrames}) ok();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const deltas = [];
      for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);
      deltas.sort((a, b) => a - b);
      const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      return {
        frames: deltas.length,
        avgMs: Number(avgMs.toFixed(2)),
        p95Ms: Number(deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))].toFixed(2)),
        fps: Number((1000 / avgMs).toFixed(1)),
      };
    })()`);
  };

  await send('Runtime.enable');
  await send('Page.enable');

  // Wait until ArcadeScene & __BW_DEVTOOLS__ are booted
  for (let i = 0; i < 120; i++) {
    const ready = await evaluate(`Boolean(window.__BW_DEVTOOLS__ && window.__GAME__?.scene?.getScene('ArcadeScene')?.scene?.isActive())`);
    if (ready) break;
    await sleep(100);
  }

  // Open DevTools via F9 key and verify panel state
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'F9', code: 'F9', windowsVirtualKeyCode: 120 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'F9', code: 'F9', windowsVirtualKeyCode: 120 });
  await sleep(160);
  const devOpen = await evaluate(`window.__BW_DEVTOOLS__.panel.isOpen()`);
  assert.equal(devOpen, true, 'F9 must open DEV panel');

  // TEST 1 — CHECKPOINT (Start before Arco das Marés checkpoint in Isolated Sandbox with Sensor Overlay ON)
  await evaluate(`(() => {
    const dt = window.__BW_DEVTOOLS__;
    const sc = dt.getScene();
    dt.collisions.setFlags({ enabled: true, sensorsAndTriggers: true, player: true, enemies: true, bullets: true });
    dt.panel.setActiveTab('events');
    dt.runner.runTimelineEvent(sc, 0, 'stage-1-arch-checkpoint', { action: 'before', isolated: true, seed: 2026 });
    sc.world.devInvincible = true;
    for (let i = 0; i < 60 * 14; i++) {
      sc.world.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
      dt.logger.observeScene(sc);
      if (sc.world.devSensorSnapshot().checkpointReached) break;
    }
    sc.backdrop.draw(sc.world.elapsed, sc.world, sc.quality);
    sc.renderWorld(0);
    dt.collisions.draw(sc);
    dt.panel.tickVisualUpdate();
  })()`);
  await sleep(140);
  const test1 = await evaluate(`(() => {
    const dt = window.__BW_DEVTOOLS__;
    const sc = dt.getScene();
    const sensor = sc.world.devSensorSnapshot();
    const logs = dt.logger.getEntries();
    return {
      sensor,
      hasCheckpoint: sc.world.hasActiveCheckpoint,
      logKinds: [...new Set(logs.map(l => l.kind))],
      logCount: logs.length,
    };
  })()`);
  assert.equal(test1.hasCheckpoint, true, 'Test 1: Checkpoint must activate after real sensor crossing');
  assert.equal(test1.sensor.checkpointReached, true);
  assert(test1.logKinds.includes('sensor-enter') && test1.logKinds.includes('completed'));
  report.functionalTests.test1Checkpoint = test1;
  await shot('01-checkpoint-sensor-overlay');

  // TEST 2 — BOSS (Colosso Abissal Section 3 + Section 1 -> real combat & attacks)
  await evaluate(`(() => {
    const dt = window.__BW_DEVTOOLS__;
    const sc = dt.getScene();
    dt.panel.setActiveTab('bosses');
    dt.runner.runBoss(sc, 0, false, { subSectionIndex: 2, weaponLevel: 5, specialCharges: 3, invincible: true });
    for (let i = 0; i < 60 * 3; i++) {
      sc.world.step(1 / 60, { x: 0, y: 0, fire: i % 8 < 2, special: false });
    }
    sc.backdrop.draw(sc.world.elapsed, sc.world, sc.quality);
    sc.renderWorld(0);
    dt.collisions.draw(sc);
    dt.panel.tickVisualUpdate();
  })()`);
  await sleep(140);
  const test2 = await evaluate(`(() => {
    const sc = window.__BW_DEVTOOLS__.getScene();
    const b = sc.world.boss;
    return {
      bossPhase: b?.phase,
      activeSection: b?.sub?.activeSection,
      sectionName: b?.sub?.sections[b.sub.activeSection]?.name,
      enemyBullets: sc.world.bullets.filter(x => x.active && x.enemy).length,
      playerShotsFired: sc.world.bullets.filter(x => x.active && !x.enemy).length,
    };
  })()`);
  assert.equal(test2.activeSection, 2, 'Test 2: Direct boss section jump must land cleanly in Section 3 (index 2)');
  assert.equal(test2.bossPhase, 'fight');
  report.functionalTests.test2Boss = test2;
  await shot('02-boss-colosso-devtools');

  // TEST 3 — ONDA & LIVE TUNING (Run Naval Convoy wave event + temporary speed tuning + reset)
  const test3 = await evaluate(`(() => {
    const dt = window.__BW_DEVTOOLS__;
    const sc = dt.getScene();
    dt.runner.runTimelineEvent(sc, 0, 'stage-1-special-naval-convoy', { action: 'run', isolated: false, seed: 1337 });
    const initialCount = sc.world.enemies.length;
    dt.combat.applyLiveTuning(sc, { enemySpeedScale: 1.5, playerSpeedScale: 1.25 });
    const tunedX0 = sc.world.player.x;
    sc.world.step(1 / 60, { x: 1, y: 0, fire: false, special: false });
    const deltaTuned = sc.world.player.x - tunedX0;
    dt.combat.resetLiveTuning(sc);
    const baseX0 = sc.world.player.x;
    sc.world.step(1 / 60, { x: 1, y: 0, fire: false, special: false });
    const deltaBase = sc.world.player.x - baseX0;
    return {
      initialCount,
      deltaTuned: Number(deltaTuned.toFixed(3)),
      deltaBase: Number(deltaBase.toFixed(3)),
    };
  })()`);
  assert(test3.initialCount >= 4, 'Test 3: Naval Convoy must spawn multi-unit formation');
  assert(test3.deltaTuned > test3.deltaBase * 1.15, 'Test 3: Live Tuning speed scaling must take effect immediately');
  report.functionalTests.test3WaveAndTuning = test3;

  // TEST 4 — UPGRADES (Test NV1 -> NV5 FULL + 5 Especiais + HUD reflection + Tormenta Escarlate)
  const test4 = await evaluate(`(() => {
    const dt = window.__BW_DEVTOOLS__;
    const sc = dt.getScene();
    dt.panel.setActiveTab('player');
    dt.combat.applyPlayerPatch(sc, { weaponLevel: 5, powerMeter: 2, lives: 4, specialCharges: 5, devInvincible: true });
    dt.combat.triggerBurst(sc);
    const fullBullets = sc.world.bullets.filter(b => b.active && !b.enemy).length;
    dt.combat.triggerSpecial(sc);
    const specialActive = Boolean(sc.world.bomb);
    const hud = sc.devPelagicHudState();
    return { fullBullets, specialActive, hudWeaponLevel: hud.weaponLevel, hudLives: hud.lives, hudSpecials: hud.specialCharges };
  })()`);
  assert.equal(test4.hudWeaponLevel, 5);
  assert.equal(test4.specialActive, true);
  assert(test4.fullBullets >= 5);
  report.functionalTests.test4Upgrades = test4;

  // TEST 5 — TROCA DE FASES (Stage Switch: Fenda Pelágica <-> Cidade Solar <-> Fenda Pelágica @ 2:28)
  const test5 = await evaluate(`(() => {
    const dt = window.__BW_DEVTOOLS__;
    const sc = dt.getScene();
    dt.panel.setActiveTab('stages');
    sc.devJumpToCheckpoint(1, 155, { seed: 999 }); // Cidade Solar Miniboss
    const solarMission = sc.world.mission.id;
    const solarBossMini = Boolean(sc.world.boss?.mini);
    sc.devJumpToCheckpoint(0, 148, { seed: 999 }); // Back to Fenda Pelágica @ 02:28
    dt.collisions.draw(sc);
    dt.panel.tickVisualUpdate();
    return {
      solarMission,
      solarBossMini,
      fendaMission: sc.world.mission.id,
      fendaRoute: sc.world.route,
      fendaBossNull: sc.world.boss === undefined,
      staleSolarSprites: sc.world.enemies.filter(e => e.family === 'bomber' && e.x > 600).length,
      stageDirMissionId: sc.world.stageDirector.mission.id,
    };
  })()`);
  assert.equal(test5.solarMission, 2);
  assert.equal(test5.solarBossMini, true);
  assert.equal(test5.fendaMission, 1);
  assert.equal(test5.fendaBossNull, true, 'Test 5: Previous mission miniboss must NOT leak after switching stage');
  assert.equal(test5.stageDirMissionId, 1);
  report.functionalTests.test5StageSwitch = test5;
  await shot('03-stage-switch-cleanup');

  // TEST 7 — REINÍCIO (3 consecutive restarts with same seed produce identical initial state)
  const test7 = await evaluate(`(() => {
    const dt = window.__BW_DEVTOOLS__;
    const sc = dt.getScene();
    const runs = [];
    for (let k = 0; k < 3; k++) {
      if (k === 0) dt.runner.runTimelineEvent(sc, 0, 'stage-1-special-naval-convoy', { action: 'run', isolated: true, seed: 5150 });
      else dt.state.replayLast(sc);
      runs.push({
        route: sc.world.route,
        seed: sc.world.seed,
        px: sc.world.player.x,
        py: sc.world.player.y,
        enemyCount: sc.world.enemies.length,
        lives: sc.world.lives,
      });
    }
    return runs;
  })()`);
  assert.deepEqual(test7[0], test7[1]);
  assert.deepEqual(test7[1], test7[2]);
  report.functionalTests.test7RestartConsistency = test7;

  // TEST 6 — GAMEPLAY NORMAL + FPS MEASUREMENTS (With DEV Overlay ON -> Panel Closed Normal Gameplay)
  const fpsDevOverlay = await measureLiveFps(60);
  await evaluate(`(() => {
    const dt = window.__BW_DEVTOOLS__;
    const sc = dt.getScene();
    dt.collisions.setFlags({ enabled: false });
    dt.state.endTestSession(sc);
    dt.panel.setOpen(false);
    sc.devExitToMenu();
    sc.begin(0);
    sc.world.introTime = 0;
    sc.world.state = 'play';
  })()`);
  await sleep(1600);
  const test6 = await evaluate(`(() => {
    const sc = window.__BW_DEVTOOLS__.getScene();
    return {
      saveGuard: sc.devSaveGuard,
      route: Number(sc.world.route.toFixed(2)),
      state: sc.world.state,
      stageDirActiveOrDone: sc.world.stageDirector.snapshot(sc.world.route, sc.world.region).counts,
    };
  })()`);
  assert.equal(test6.saveGuard, false, 'Test 6: Normal gameplay outside DEV session must have devSaveGuard = false');
  assert(test6.route > 0.5, 'Test 6: Normal route progression must advance naturally');
  const fpsNormal = await measureLiveFps(60);
  report.functionalTests.test6NormalGameplay = test6;
  report.fpsMeasurements = { fpsDevOverlay, fpsNormal };

  // TEST 8 — PRODUCTION BUILD ISOLATION IN REAL CHROMIUM (dist/)
  const distDir = resolve('dist');
  prodServer = createServer((req, res) => {
    const urlPath = (req.url || '/').split('?')[0];
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    const file = join(distDir, rel);
    try {
      const data = readFileSync(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise((r) => prodServer.listen(0, '127.0.0.1', r));
  const prodPort = prodServer.address().port;
  await send('Page.navigate', { url: `http://127.0.0.1:${prodPort}/` });
  await sleep(900);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'F9', code: 'F9', windowsVirtualKeyCode: 120 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'F9', code: 'F9', windowsVirtualKeyCode: 120 });
  await sleep(200);
  const prodCheck = await evaluate(`(() => ({
    hasDevtoolsGlobal: typeof window.__BW_DEVTOOLS__ !== 'undefined',
    hasGameGlobal: typeof window.__GAME__ !== 'undefined',
    hasDevToggleDom: Boolean(document.querySelector('[data-bw-devtools-toggle]')),
    hasDevPanelDom: Boolean(document.querySelector('[data-bw-devtools-panel]')),
  }))()`);
  assert.equal(prodCheck.hasDevtoolsGlobal, false);
  assert.equal(prodCheck.hasGameGlobal, false);
  assert.equal(prodCheck.hasDevToggleDom, false);
  assert.equal(prodCheck.hasDevPanelDom, false);
  report.productionIsolation = prodCheck;

  assert.equal(runtimeErrors.length, 0, `Unexpected runtime errors: ${runtimeErrors.join('; ')}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('DEVTOOLS ARCHITECTURAL VERIFICATION PASSED:', JSON.stringify(report.fpsMeasurements));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  try { await devServer?.close(); } catch {}
  try { prodServer?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
  // Force clean exit if Vite/HTTP keepalive lingers
  setTimeout(() => process.exit(process.exitCode ?? 0), 150).unref();
}
