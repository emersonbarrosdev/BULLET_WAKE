import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/hud-final-approved');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-hud-final-verify-'));

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
let chrome;
let socket;
const runtimeErrors = [];
const report = {
  resolutions: {},
  functionalChecks: {},
  fpsBenchmark: {},
  androidPortraitCheck: {},
  solarIsolationCheck: {},
  devToolsCheck: {},
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
      '--remote-debugging-port=9235',
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
      target = (await (await fetch('http://127.0.0.1:9235/json')).json()).find((t) => t.type === 'page');
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
  const setViewport = async (width, height, mobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await sleep(280);
  };
  const clickWorld = async (wx, wy) => {
    const pt = await evaluate(`(() => {
      const s = window.__GAME__.scene.getScene('ArcadeScene');
      const rect = document.querySelector('canvas').getBoundingClientRect();
      const cam = s.cameras.main;
      return {
        x: rect.left + (rect.width * ((${wx} - cam.worldView.x) / cam.worldView.width)),
        y: rect.top + (rect.height * ((${wy} - cam.worldView.y) / cam.worldView.height)),
      };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
    await sleep(50);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await sleep(40);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await sleep(140);
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await setViewport(1280, 720, false);

  let ready = false;
  for (let i = 0; i < 240; i++) {
    ready = await evaluate(`(() => {
      const g = window.__GAME__;
      const s = g && g.scene && g.scene.getScene('ArcadeScene');
      return !!(s && s.ui && s.textures && s.textures.exists('ui-hud-bayek-halfbody') && s.textures.exists('ui-hud-route-pelagic') && s.screen !== 'loading');
    })()`);
    if (ready) break;
    await sleep(100);
  }
  assert.equal(ready, true, 'ArcadeScene must finish boot & preload modular HUD textures');

  // 0. Title & Pilot isolation check
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true);
    s.show('title');
  })()`);
  await sleep(220);
  const titleState = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    return { screen: s.screen, planeCount: s.menuPlanes.length };
  })()`);
  assert.equal(titleState.planeCount, 3);
  await shot('00-title-check');

  await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').show('pilot')`);
  await sleep(200);
  const pilotState = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const imgs = s.ui.list.filter(o => o && o.texture && o.texture.key === 'ui-rivet-profile');
    return { screen: s.screen, profileCount: imgs.length };
  })()`);
  assert.equal(pilotState.profileCount, 1);
  report.functionalChecks.menus = { titleState, pilotState };

  // 1. State 1: Start of Fenda Pelágica gameplay (1280x720)
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.begin(0);
    s.world.devInvincible = true;
    s.devTriggerPilotComms('start');
    s.renderWorld(1 / 60);
  })()`);
  await sleep(600);

  const startHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.equal(startHud.visible, true);
  assert.equal(startHud.arena.left, 160);
  assert.equal(startHud.arena.right, 608);
  assert.equal(startHud.arena.width, 448);
  assert.equal(startHud.scoreText, '0', 'Score must show plain numeric 0 without leading zeros');
  assert.equal(startHud.weaponLevel, 1);
  assert.equal(startHud.weaponLevelText, 'POWER');
  assert.equal(startHud.lives, 3);
  assert.equal(startHud.livesText, '× 3');
  assert.equal(startHud.specialCharges, 2);
  assert.equal(startHud.hasLogoInGameplay, false, 'Bullet Wake logo must be absent in gameplay HUD');
  assert.equal(startHud.hasBayekInRadio, false, 'Bayek miniature must be absent in Rádio');
  assert.equal(startHud.bayekTextureKey, 'ui-hud-bayek-halfbody');
  assert.equal(startHud.rivetTextureKey, 'pelagic-rivet-up');
  assert.ok(startHud.pauseCenter && startHud.pauseCenter.x >= 728 && startHud.pauseCenter.y <= 22);
  report.functionalChecks.startHud = startHud;
  await shot('01-start');

  // Resolution scaling checks (1280x720, 1920x1080)
  for (const [rw, rh] of [[1280, 720], [1920, 1080]]) {
    await setViewport(rw, rh, false);
    const meta = await evaluate(`(() => {
      const s = window.__GAME__.scene.getScene('ArcadeScene');
      const rect = document.querySelector('canvas').getBoundingClientRect();
      return {
        rect: { w: Math.round(rect.width), h: Math.round(rect.height), aspect: Number((rect.width / rect.height).toFixed(3)) },
        hud: s.devPelagicHudState(),
      };
    })()`);
    assert.equal(meta.hud.visible, true);
    assert.equal(meta.hud.arena.width, 448);
    assert.ok(Math.abs(meta.rect.aspect - 16 / 9) < 0.02);
    report.resolutions[`${rw}x${rh}`] = meta;
  }
  await setViewport(1280, 720, false);

  // 2. State 2: Active combat + updated score + persistent radio + Pause test
  await evaluate(`(async () => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.world.route = 24;
    s.world.state = 'play';
    s.world.introTime = 0;
    for (let i = 0; i < 60 * 14; i++) {
      const xAim = Math.sin(i * 0.08) * 0.65;
      s.world.step(1 / 60, { x: xAim, y: 0, fire: i % 10 < 2, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
      if (i % 4 === 0) s.renderWorld(1 / 60);
    }
    s.pelagicComms.reset();
    s.devTriggerPilotComms('threat', 'heli_warhawk');
    // Advance PelagicComms past normal auto-hide timer (10s) to prove persistent radio stays displayed
    for (let i = 0; i < 60 * 10; i++) s.pelagicComms.step(1 / 60);
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(160);
  const combatHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.ok(Number(combatHud.scoreText) > 0, `Expected real score > 0 during combat, got ${combatHud.scoreText}`);
  assert.ok(!/^0\d+/.test(combatHud.scoreText), `Score must have no leading zeros, got ${combatHud.scoreText}`);
  assert.equal(combatHud.radioActive, true, 'Radio message must stay persistent after comms expiry timer');
  assert.ok(combatHud.radioText.length > 0, 'Radio text must stay visible');
  report.functionalChecks.combatScoreAndRadio = combatHud;
  await shot('02-combat-radio-score');

  // Test interactive Pause button click & resume
  await clickWorld(combatHud.pauseCenter.x, combatHud.pauseCenter.y);
  const pausedScreen = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').screen`);
  assert.equal(pausedScreen, 'pause', 'Clicking top-right pause button must open pause menu');
  await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').show('play')`);
  await sleep(120);
  const resumedScreen = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').screen`);
  assert.equal(resumedScreen, 'play');
  report.functionalChecks.pauseClickAndResume = { pausedScreen, resumedScreen };

  // 3. State 3: Evolved POWER + changed ESPECIAL + changed cumulative VIDAS + long auto-paginated radio
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.world.score = 128450;
    s.world.weapons.weaponLevel = 4;
    s.world.weapons.specialCharges = 4;
    s.world.lives = 5;
    s.devTriggerPilotComms('boss');
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(180);
  const evolvedHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.equal(evolvedHud.scoreText, '128450');
  assert.equal(evolvedHud.weaponLevel, 4);
  assert.equal(evolvedHud.specialCharges, 4);
  assert.equal(evolvedHud.lives, 5);
  assert.equal(evolvedHud.livesText, '× 5');
  assert.equal(evolvedHud.radioActive, true);
  report.functionalChecks.evolvedHud = evolvedHud;
  await shot('03-power-especial-vidas');

  // Also test LV 5, 1 special, 2 lives + Boss HP bar alignment
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.world.weapons.weaponLevel = 5;
    s.world.weapons.specialCharges = 1;
    s.world.lives = 2;
    s.world.devStartBoss(false, 0);
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(160);
  const bossHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.equal(bossHud.weaponLevel, 5);
  assert.equal(bossHud.specialCharges, 1);
  assert.equal(bossHud.livesText, '× 2');
  await shot('04-boss-colosso');

  // 4. FPS & HUD CPU benchmark
  await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').begin(0)`);
  await sleep(300);
  const fpsRes = await evaluate(`(async () => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const hStart = performance.now();
    for (let i = 0; i < 240; i++) {
      s.world.score = i * 150;
      s.renderHud(1 / 60);
    }
    const hudCpuMsPerFrame = (performance.now() - hStart) / 240;
    const times = [];
    await new Promise(done => {
      let count = 0;
      const tick = (t) => {
        times.push(t);
        count++;
        if (count >= 60) done();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const deltas = [];
    for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);
    const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    return {
      avgFrameMs: Number(avgMs.toFixed(2)),
      fps: Number((1000 / avgMs).toFixed(1)),
      hudCpuMsPerFrame: Number(hudCpuMsPerFrame.toFixed(3)),
    };
  })()`);
  report.fpsBenchmark = fpsRes;

  // 5. DevTools non-regression check
  const devToolsState = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    return { devModeEnabled: s.devRuntime?.enabled ?? null, hasStageJump: !!s.devStageJump };
  })()`);
  report.devToolsCheck = devToolsState;

  // 6. Android Portrait isolation check
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await setViewport(412, 915, true);
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.syncResponsiveViewport();
    s.renderWorld(1 / 60);
  })()`);
  await sleep(200);
  const portraitCheck = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    return { portraitUpActive: s.portraitUpActive, hud: s.devPelagicHudState() };
  })()`);
  assert.equal(portraitCheck.portraitUpActive, true);
  assert.equal(portraitCheck.hud.visible, false);
  assert.equal(portraitCheck.hud.arena.left, 0);
  assert.equal(portraitCheck.hud.arena.right, 384);
  report.androidPortraitCheck = portraitCheck;

  // 7. Cidade Solar isolation check
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await setViewport(1280, 720, false);
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.begin(1);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(160);
  const solarCheck = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    return { mission: s.world.mission.id, up: s.world.up, desktopHudVisible: s.devPelagicHudState().visible };
  })()`);
  assert.equal(solarCheck.up, false);
  assert.equal(solarCheck.desktopHudVisible, false);
  report.solarIsolationCheck = solarCheck;

  assert.equal(runtimeErrors.length, 0, `Runtime errors detected: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Pelagic Final HUD Verification PASSED!', JSON.stringify({ fps: fpsRes, runtimeErrors: runtimeErrors.length }));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  try { await devServer?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
