import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/helicopter-difficulty-rework');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-heli-diff-verify-'));

let devServer;
let chrome;
let socket;
const runtimeErrors = [];
const report = {
  menuCheck: {},
  formations: {},
  hardCombat: {},
  fpsBenchmark: {},
  screenshots: {},
  errors: runtimeErrors,
};

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
      target = (await (await fetch('http://127.0.0.1:9238/json')).json()).find(t => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(120);
  }
  if (!target) throw new Error('Chrome CDP failed to launch on port 9238');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });

  let seq = 0;
  const pending = new Map();
  socket.onmessage = ev => {
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
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const shot = async name => {
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
      return !!(s && s.textures && s.textures.exists('pelagic-enemy-air') && s.screen !== 'loading');
    })()`);
    if (ready) break;
    await sleep(100);
  }
  assert.equal(ready, true, 'ArcadeScene must finish boot & preload');

  // 1. Verify Options Menu 3-mode difficulty toggle: NORMAL -> DIFÍCIL -> FÁCIL -> DIFÍCIL
  report.menuCheck = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true);
    s.show('settings');
    const getDiffText = () => {
      const texts = s.ui.list.filter(c => c.type === 'Text').map(c => c.text);
      return texts.find(t => ['FÁCIL', 'NORMAL', 'DIFÍCIL'].includes(t));
    };
    const seen = [getDiffText()];
    // Find button matching the DIFICULDADE row (near y = 212) and step it through all 3 modes
    const diffBtn = s.buttons.find(b => b.extras?.some(ex => ex.text === 'DIFICULDADE'));
    for (let i = 0; i < 3; i++) {
      diffBtn.action();
      seen.push(getDiffText());
    }
    // Land cleanly on DIFÍCIL for screenshot
    while (getDiffText() !== 'DIFÍCIL') diffBtn.action();
    return { initialAndCycled: seen, finalLabel: getDiffText() };
  })()`);
  await sleep(180);
  assert.ok(report.menuCheck.initialAndCycled.includes('FÁCIL'));
  assert.ok(report.menuCheck.initialAndCycled.includes('NORMAL'));
  assert.ok(report.menuCheck.initialAndCycled.includes('DIFÍCIL'));
  assert.equal(report.menuCheck.finalLabel, 'DIFÍCIL');
  await shot('01-difficulty-menu');

  // Helper to run an isolated helicopter formation scenario inside real rendered ArcadeScene
  const runHeliCheck = async (name, encSpec, stepCount) => {
    const snap = await evaluate(`(() => {
      const s = window.__GAME__.scene.getScene('ArcadeScene');
      s.begin(0);
      const w = s.world;
      w.devInvincible = true;
      w.devJumpToCheckpoint(10, { pauseDirector: true, isolated: true, seed: 1337 });
      w.clearArenaEntities();
      const spawned = w.devSpawnEncounter(${JSON.stringify(encSpec)});
      const ids = spawned.map(a => a.id);
      let crossings = 0;
      let order = null;
      let minDist = 999;
      for (let i = 0; i < ${stepCount}; i++) {
        w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
        s.clock += 1 / 60;
        s.consumeEvents();
        const live = ids.map(id => w.enemies.find(e => e.id === id)).filter(Boolean);
        if (live.length >= 2) {
          for (let a = 0; a < live.length; a++) {
            for (let b = a + 1; b < live.length; b++) {
              minDist = Math.min(minDist, Math.hypot(live[a].x - live[b].x, live[a].y - live[b].y));
            }
          }
          if (!order && live.every(u => u.x >= w.arena.left && u.x <= w.arena.right)) {
            order = [...live].sort((a, b) => a.x - b.x).map(u => u.id);
          }
          if (order && live.length === order.length) {
            for (let k = 1; k < order.length; k++) {
              const l = live.find(u => u.id === order[k - 1]);
              const r = live.find(u => u.id === order[k]);
              if (l && r && l.x > r.x - 4) crossings++;
            }
          }
        }
      }
      s.backdrop.draw(s.clock, w, s.quality);
      s.renderWorld(1 / 60);
      const finalUnits = ids
        .map(id => w.enemies.find(e => e.id === id))
        .filter(Boolean)
        .map(u => ({
          id: u.id,
          x: Math.round(u.x),
          y: Math.round(u.y),
          rotDeg: Number((((s.enemySprites.get(u.id)?.rotation ?? Math.PI) * 180) / Math.PI).toFixed(1)),
          visible: !!s.enemySprites.get(u.id)?.visible,
        }));
      return { spawned: spawned.length, crossings, minDist: Math.round(minDist), finalUnits };
    })()`);
    await sleep(160);
    assert.equal(snap.crossings, 0, `${name} had trajectory crossings`);
    assert.ok(snap.finalUnits.length >= 2, `${name} should still be visible on screen at capture`);
    assert.ok(snap.finalUnits.every(u => u.visible), `${name} sprites must be visible`);
    report.formations[name] = snap;
    return snap;
  };

  await runHeliCheck('heli_scout_pair_curve', { family: 'heli_scout', formation: 'pair', motion: 'curve', lane: 0.50, speed: 118 }, 155);
  await shot('02-heli-scout-pair-curve');

  await runHeliCheck('heli_utility_pair_hover', { family: 'heli_utility', formation: 'pair', motion: 'stationary', lane: 0.50, speed: 76 }, 185);
  await shot('03-heli-utility-pair-hover');

  await runHeliCheck('heli_phantom_trio_sweep', { family: 'heli_phantom', formation: 'trio', motion: 'side-curve', entry: 'right', lane: 0.30, speed: 128 }, 165);
  await shot('04-heli-phantom-trio-sweep');

  // 5. High-density DIFÍCIL mode combat + live RAF FPS measurement
  await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.begin(0);
    const w = s.world;
    w.setDifficulty('hard');
    w.devInvincible = true;
    w.devJumpToCheckpoint(92, { pauseDirector: false, isolated: false, seed: 1337 });
    w.weapons.weaponLevel = 4;
    for (let i = 0; i < 60 * 6.5; i++) {
      const dx = Math.sin(i * 0.04) * 0.85;
      w.step(1 / 60, { x: dx, y: 0, fire: true, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
    }
    s.backdrop.draw(s.clock, w, s.quality);
    s.renderWorld(1 / 60);
  })()`);
  await sleep(160);

  report.hardCombat = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    return {
      difficulty: w.difficulty,
      label: w.difficultyProfile.label,
      route: Number(w.route.toFixed(1)),
      activeEnemies: w.enemies.length,
      activeEnemyBullets: w.bullets.filter(b => b.active && b.enemy).length,
      weaponLevel: w.weapons.weaponLevel,
      playerVisible: s.player.visible,
    };
  })()`);
  assert.equal(report.hardCombat.difficulty, 'hard');
  assert.equal(report.hardCombat.label, 'DIFÍCIL');
  assert.ok(report.hardCombat.activeEnemies >= 5, `Expected dense hard combat, got ${report.hardCombat.activeEnemies} enemies`);
  await shot('05-hard-mode-combat');

  report.fpsBenchmark = await evaluate(`new Promise((resolve) => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    const frames = [];
    let last = performance.now();
    const tick = now => {
      const dtMs = Math.min(50, now - last);
      last = now;
      frames.push(dtMs);
      w.step(1 / 60, { x: Math.sin(w.elapsed * 2) * 0.7, y: 0, fire: true, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
      s.backdrop.draw(s.clock, w, s.quality);
      s.renderWorld(1 / 60);
      if (frames.length >= 90) {
        const avgMs = frames.slice(5).reduce((a, b) => a + b, 0) / Math.max(1, frames.length - 5);
        resolve({ samples: frames.length, avgFrameMs: Number(avgMs.toFixed(2)), avgFps: Number((1000 / Math.max(1, avgMs)).toFixed(1)) });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })`);
  assert.ok(report.fpsBenchmark.avgFps >= 45, `Live FPS too low: ${report.fpsBenchmark.avgFps}`);

  assert.equal(runtimeErrors.length, 0, `Expected 0 runtime errors, got: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('VERIFICATION REPORT:', JSON.stringify(report, null, 2));
} finally {
  try {
    socket?.close();
  } catch {}
  try {
    chrome?.kill();
  } catch {}
  try {
    await devServer?.close();
  } catch {}
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
