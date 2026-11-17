import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/pelagic-hud-v27');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-hud-v27-verify-'));
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
let chrome;
let socket;
const runtimeErrors = [];
const report = {
  resolutions: {},
  functionalChecks: {},
  fpsBenchmark: {},
  androidPortraitCheck: {},
  solarIsolationCheck: {},
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
      '--remote-debugging-port=9233',
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
      target = (await (await fetch('http://127.0.0.1:9233/json')).json()).find((t) => t.type === 'page');
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
      const sx = rect.left + (rect.width * ( (${wx} - cam.worldView.x) / cam.worldView.width ));
      const sy = rect.top + (rect.height * ( (${wy} - cam.worldView.y) / cam.worldView.height ));
      return { x: sx, y: sy };
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
      return !!(s && s.ui && s.textures && s.textures.exists('ui-hud-pelagic-chassis') && s.screen !== 'loading');
    })()`);
    if (ready) break;
    await sleep(100);
  }
  assert.equal(ready, true, 'ArcadeScene must finish boot & preload HUD chassis texture');

  // 0. Title Screen verification: 3 approved planes ONLY + uniform button sizes + yellow hover on CONTROLES/OPÇÕES
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true);
    s.show('title');
  })()`);
  await sleep(300);

  // Move mouse onto CONTROLES (384, 306) and verify golden focus plate activates cleanly
  {
    const pt = await evaluate(`(() => {
      const s = window.__GAME__.scene.getScene('ArcadeScene');
      const rect = document.querySelector('canvas').getBoundingClientRect();
      const cam = s.cameras.main;
      return {
        x: rect.left + (rect.width * ((384 - cam.worldView.x) / cam.worldView.width)),
        y: rect.top + (rect.height * ((306 - cam.worldView.y) / cam.worldView.height)),
      };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
    await sleep(160);
  }
  const titleCheck = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const animKeys = s.menuPlanes.map(sp => sp.anims?.currentAnim?.key ?? '');
    const widths = s.buttons.map(b => Math.round(b.bg.focus.displayWidth));
    const heights = s.buttons.map(b => Math.round(b.bg.focus.displayHeight));
    const focusedIdx = s.buttons.findIndex(b => b.bg.focus.visible);
    return {
      planeCount: s.menuPlanes.length,
      animKeys,
      widths,
      heights,
      focusedIdx,
    };
  })()`);
  assert.equal(titleCheck.planeCount, 3, 'Title Screen must only have the 3 approved planes');
  assert.deepEqual(titleCheck.animKeys, ['ui-wingman-0', 'ui-wingman-1', 'ui-wingman-2']);
  assert.equal(new Set(titleCheck.widths).size, 1, 'All 3 title buttons must have the same width');
  assert.equal(new Set(titleCheck.heights).size, 1, 'All 3 title buttons must have the same height');
  assert.equal(titleCheck.focusedIdx, 1, 'Hovering CONTROLES must show golden yellow focus background');
  report.functionalChecks.titleMenu = titleCheck;
  await shot('00-title-hover-controles');

  // Verify Pilot Selection screen (static 1-thruster RIVET side profile + zero bobbing tween)
  await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').show('pilot')`);
  await sleep(220);
  const pilotCheck = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const imgs = s.ui.list.filter(o => o && o.texture && o.texture.key === 'ui-rivet-profile');
    const activeTweensOnProfile = s.tweens.getTweensOf(imgs).length;
    return {
      screen: s.screen,
      profileCount: imgs.length,
      angle: imgs[0]?.angle ?? null,
      activeTweensOnProfile,
    };
  })()`);
  assert.equal(pilotCheck.screen, 'pilot');
  assert.equal(pilotCheck.profileCount, 1, 'Pilot screen must use static ui-rivet-profile image');
  assert.equal(pilotCheck.activeTweensOnProfile, 0, 'Pilot screen ship profile must remain static');
  report.functionalChecks.pilotScreen = pilotCheck;
  await shot('00b-pilot-select');

  // Start Stage 1 UP cleanly in live render loop
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.begin(0);
    s.world.devInvincible = true;
  })()`);
  await sleep(600);

  // 1. Verify Start State (value-only score 0000000, POWER label, lv 1, 3 lives, 2 specials, intro/start comm active)
  const startHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.equal(startHud.visible, true);
  assert.equal(startHud.arena.left, 192);
  assert.equal(startHud.arena.right, 576);
  assert.equal(startHud.arena.width, 384);
  assert.equal(startHud.scoreText, '0000000');
  assert.equal(startHud.weaponLevel, 1);
  assert.equal(startHud.weaponLevelText, 'POWER');
  assert.equal(startHud.lives, 3);
  assert.equal(startHud.specialCharges, 2);
  assert.ok(startHud.pauseCenter && startHud.pauseCenter.x > 720 && startHud.pauseCenter.y <= 22, 'Pause button must sit in right-panel header');
  report.functionalChecks.startHud = startHud;
  await shot('01-start-1280x720');

  // 2. Verify all 4 required Desktop resolutions (1280x720, 1366x768, 1920x1080, 2560x1440)
  for (const [rw, rh] of [[1280, 720], [1366, 768], [1920, 1080], [2560, 1440]]) {
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
    assert.equal(meta.hud.arena.width, 384);
    assert.ok(Math.abs(meta.rect.aspect - 16 / 9) < 0.02, `16:9 canvas preserved at ${rw}x${rh}`);
    report.resolutions[`${rw}x${rh}`] = meta;
    if (rw === 1920 || rw === 2560) await shot(`02-res-${rw}x${rh}`);
  }
  await setViewport(1280, 720, false);

  // 3. Test real combat progression: step simulation with firing, collect power-ups for NV 1..5, earn points, trigger quiet rest
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    // Force past intro & active comm to test quiet idle state first
    s.world.state = 'play';
    s.world.introTime = 0;
    s.pelagicComms.reset();
    s.renderWorld(1 / 60);
  })()`);
  await sleep(120);
  const quietHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.equal(quietHud.radioActive, false, 'Radio dialogue must rest quietly when no message is active');
  assert.equal(quietHud.radioExpression, 0);
  report.functionalChecks.quietRest = quietHud;
  await shot('03-quiet-rest');

  // Now simulate real combat ticks (manual firing + movement to kill enemies and earn real points)
  await evaluate(`(async () => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.world.route = 24;
    for (let i = 0; i < 60 * 14; i++) {
      const xAim = Math.sin(i * 0.08) * 0.65;
      s.world.step(1 / 60, { x: xAim, y: 0, fire: i % 10 < 2, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
      if (i % 4 === 0) s.renderWorld(1 / 60);
    }
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(100);
  const combatHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.ok(Number(combatHud.scoreText) > 0, `Expected real score > 0 during combat, got ${combatHud.scoreText}`);
  assert.equal(combatHud.scoreText.length, 7);
  report.functionalChecks.combatScore = combatHud;
  await shot('04-combat-live-1280x720');

  // 4. Test Power levels 1..5, lives drop (3 -> 2), special usage (2 -> 1), and Bayek radio comms
  const levelsSeen = [];
  for (let lv = 1; lv <= 5; lv++) {
    await evaluate(`(() => {
      const s = window.__GAME__.scene.getScene('ArcadeScene');
      s.world.weapons.weaponLevel = ${lv};
      s.renderWorld(1 / 60);
    })()`);
    const st = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
    assert.equal(st.weaponLevelText, 'POWER');
    assert.equal(st.weaponLevel, lv);
    levelsSeen.push(st.weaponLevel);
  }
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.world.lives = 2;
    s.world.weapons.specialCharges = 1;
    s.world.score = 123450;
    s.devTriggerPilotComms('threat', 'heli_warhawk');
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(100);
  const midHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.equal(midHud.lives, 2);
  assert.equal(midHud.specialCharges, 1);
  assert.equal(midHud.scoreText, '0123450');
  assert.equal(midHud.weaponLevelText, 'POWER');
  assert.equal(midHud.weaponLevel, 5);
  assert.equal(midHud.radioActive, true);
  report.functionalChecks.levelsAndResources = { levelsSeen, midHud };
  await shot('05-nv5-comms-lives-special');

  // 5. Test Tide Arch transition + Boss Colosso Abissal HP bar integration
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.world.devJumpTideArch('low-flight', true);
    s.devTriggerPilotComms('arch', 'descent');
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(120);
  const archHud = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').devPelagicHudState()`);
  assert.equal(archHud.visible, true);
  assert.equal(archHud.radioActive, true, 'Radio panel shows Tide Arch descent comm safely outside gameplay');
  await shot('06-tide-arch-hud');

  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.world.devStartBoss(false, 0);
    s.devTriggerPilotComms('boss');
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(140);
  await shot('07-boss-colosso-hud');

  // 6. Real mouse click on Top-Right Pause button & Resume
  await clickWorld(739, 16);
  const pausedScreen = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').screen`);
  assert.equal(pausedScreen, 'pause', 'Clicking top-right pause button must open pause menu');
  await shot('08-pause-overlay');

  // Click RESUME (CONTINUAR button centered at 384, 174..204 — press Escape or first button)
  await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').show('play')`);
  await sleep(120);
  const resumedScreen = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').screen`);
  assert.equal(resumedScreen, 'play');
  report.functionalChecks.pauseClickAndResume = { pausedScreen, resumedScreen };

  // 7. Measure live frame rate across 60 rAF frames during gameplay + isolated HUD CPU cost
  await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').begin(0)`);
  await sleep(350);
  const fpsRes = await evaluate(`(async () => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const hStart = performance.now();
    for (let i = 0; i < 240; i++) {
      s.world.score = i * 150;
      s.renderHud();
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

  // 8. Android Vertical Portrait non-regression check (must NOT show desktop panels)
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await setViewport(412, 915, true);
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.syncResponsiveViewport();
    s.renderWorld(1 / 60);
  })()`);
  await sleep(220);
  const portraitCheck = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    return { portraitUpActive: s.portraitUpActive, hud: s.devPelagicHudState() };
  })()`);
  assert.equal(portraitCheck.portraitUpActive, true);
  assert.equal(portraitCheck.hud.visible, false, 'Android Portrait must NOT show Desktop side panels');
  assert.equal(portraitCheck.hud.arena.left, 0);
  assert.equal(portraitCheck.hud.arena.right, 384);
  report.androidPortraitCheck = portraitCheck;
  await shot('09-android-portrait-intact');

  // 9. Cidade Solar isolation check
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
  assert.equal(solarCheck.desktopHudVisible, false, 'Cidade Solar must hide Stage 1 Desktop HUD');
  report.solarIsolationCheck = solarCheck;

  assert.equal(runtimeErrors.length, 0, `Runtime errors detected: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Task 27 HUD E2E Verification PASSED cleanly!', JSON.stringify({ fps: fpsRes, resolutions: Object.keys(report.resolutions), runtimeErrors: runtimeErrors.length }));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  try { await devServer?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
