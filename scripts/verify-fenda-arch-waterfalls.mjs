import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/tide-arch-cleaned');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-tide-arch-cleaned-'));

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
  moments: {},
  fpsBenchmark: {},
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
      '--remote-debugging-port=9236',
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
      target = (await (await fetch('http://127.0.0.1:9236/json')).json()).find((t) => t.type === 'page');
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
      return !!(s && s.textures && s.textures.exists('pelagic-tide-arch-bridge') && s.screen !== 'loading');
    })()`);
    if (ready) break;
    await sleep(100);
  }
  assert.equal(ready, true, 'ArcadeScene must finish boot & preload Tide Arch bridge texture');

  // Moment 1: Continuous scroll entry into the islands / Arco das Mares stretch (approach -> descent)
  const m1 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true);
    s.begin(0);
    s.world.setDifficulty('normal');
    s.world.devInvincible = true;
    s.world.introTime = 0;
    s.world.state = 'play';
    s.world.route = 147.2;
    s.world.scroll = 147.2 * 38;
    s.world.waveIndex = s.world.mission.encounters.findIndex(e => e.at >= 148);
    s.world.supplyIndex = 999;
    s.world.weapons.weaponLevel = 3;
    for (let i = 0; i < 60 * 3.5; i++) {
      s.world.step(1 / 60, { x: 0, y: 0, fire: i % 14 === 0, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
    }
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(1 / 60);
    const ta = s.backdrop.tideArch;
    return {
      route: Number(s.world.route.toFixed(2)),
      phase: s.world.tideArch.phase,
      difficulty: s.world.difficulty,
      archY: Math.round(s.world.tideArch.archScreenY(s.world.scroll)),
      waterfallsRemoved: ta.waterfalls === undefined && ta.upperStreamGfx === undefined && ta.waterfallMistGfx === undefined && ta.bridgeWaterfallGfx === undefined,
      padsAndCutoutsRemoved: ta.padMountGfx === undefined && ta.piers === undefined && ta.backingCliffs === undefined,
      coastAlpha: s.backdrop.coastPainting.strips[0]?.alpha ?? 0,
      cannons: s.world.enemies.filter(e => e.navigation?.customAnchor).map(e => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp })),
    };
  })()`);
  assert.equal(m1.phase, 'approach');
  assert.equal(m1.waterfallsRemoved, true, 'All artificial waterfalls objects must be removed');
  assert.equal(m1.padsAndCutoutsRemoved, true, 'All grey circular pad and cutout cliff objects must be removed');
  assert.equal(m1.coastAlpha, 1);
  report.moments.entryIslands = m1;
  await shot('01-entry-islands');

  // Moment 2: Mid-passage (low-flight) with active cannons integrated into natural coastal terrain
  const m2 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    for (let i = 0; i < 60 * 14; i++) {
      const dx = (384 - w.player.x) * 0.025;
      w.step(1 / 60, { x: Math.max(-1, Math.min(1, dx)), y: 0, fire: i % 16 === 0, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
      const archY = w.tideArch.archScreenY(w.scroll);
      if (w.tideArch.phase === 'low-flight' && archY >= -110) break;
    }
    s.backdrop.draw(s.clock, w, s.quality);
    s.renderWorld(1 / 60);
    return {
      route: Number(w.route.toFixed(2)),
      phase: w.tideArch.phase,
      altitude: Number(w.player.altitude.toFixed(3)),
      archY: Math.round(w.tideArch.archScreenY(w.scroll)),
      cannons: w.enemies.filter(e => e.navigation?.customAnchor).map(e => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp })),
      boats: w.enemies.filter(e => e.archBoat).map(e => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y) })),
    };
  })()`);
  assert.equal(m2.phase, 'low-flight');
  assert.ok(m2.cannons.length >= 2, 'Multiple cliff cannons must be active in low-flight mid-passage');
  report.moments.midActiveCannons = m2;
  await shot('02-mid-passage-active-cannons');

  // Moment 2b: Destroy two visible cannons to verify wreck + smoke renders WITHOUT exposing grey circles underneath
  const m2b = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    const targets = w.enemies.filter(e => e.navigation?.customAnchor && e.hp > 0 && e.y >= 10 && e.y <= 395).slice(0, 2);
    for (const t of targets) {
      w.bullet(t.x, t.y + 8, 0, -600, 999, 10);
    }
    for (let i = 0; i < 20; i++) {
      w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
    }
    s.backdrop.draw(s.clock, w, s.quality);
    s.renderWorld(1 / 60);
    return {
      route: Number(w.route.toFixed(2)),
      phase: w.tideArch.phase,
      destroyedTargets: targets.length,
      wrecks: w.wrecks.map(wk => ({ id: wk.id, x: Math.round(wk.x), y: Math.round(wk.y), customAnchor: !!wk.customAnchor, family: wk.family })),
      remainingCannons: w.enemies.filter(e => e.navigation?.customAnchor).length,
    };
  })()`);
  assert.ok(m2b.destroyedTargets >= 1 && m2b.wrecks.some(wk => wk.customAnchor), 'Destroyed arch cannons must create customAnchor wrecks');
  report.moments.midDestroyedCannons = m2b;
  await shot('03-mid-passage-destroyed-cannons');

  // Moment 3: Continuous scroll into arch traversal (`under-arch` — RIVET flying underneath the stone bridge)
  const m3 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    for (let i = 0; i < 60 * 24; i++) {
      const dx = (384 - w.player.x) * 0.03;
      w.step(1 / 60, { x: Math.max(-1, Math.min(1, dx)), y: 0, fire: i % 8 < 2, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
      if (w.tideArch.isInBridgeBand(w.scroll, w.player.y) && Math.abs(w.tideArch.archScreenY(w.scroll) - w.player.y) <= 18) break;
    }
    s.backdrop.draw(s.clock, w, s.quality);
    s.renderWorld(1 / 60);
    const ta = s.backdrop.tideArch;
    return {
      route: Number(w.route.toFixed(2)),
      phase: w.tideArch.phase,
      altitude: Number(w.player.altitude.toFixed(3)),
      archY: Math.round(w.tideArch.archScreenY(w.scroll)),
      playerY: Math.round(w.player.y),
      inBridgeBand: w.tideArch.isInBridgeBand(w.scroll, w.player.y),
      bridgeVisible: ta.archBridge.visible,
      shadowVisible: ta.archShadowGfx.visible,
      surfVisible: ta.waterSurfGfx.visible,
      beaconVisible: ta.rivetBeaconGfx.visible,
      coastAlpha: s.backdrop.coastPainting.strips[0]?.alpha ?? 0,
    };
  })()`);
  assert.equal(m3.inBridgeBand, true);
  assert.equal(m3.bridgeVisible, true);
  assert.equal(m3.shadowVisible, true);
  assert.equal(m3.surfVisible, true);
  assert.equal(m3.beaconVisible, true);
  assert.equal(m3.coastAlpha, 1);
  report.moments.traversal = m3;
  await shot('04-arch-traversal');

  // Live RAF FPS measurement during active scrolling
  report.fpsBenchmark = await evaluate(`new Promise((resolve) => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    const frames = [];
    let last = performance.now();
    const tick = (now) => {
      const dtMs = Math.min(50, now - last);
      last = now;
      frames.push(dtMs);
      w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
      s.renderWorld(1 / 60);
      if (frames.length >= 90) {
        const avgMs = frames.slice(5).reduce((a, b) => a + b, 0) / Math.max(1, frames.length - 5);
        resolve({ samples: frames.length, avgFrameMs: Number(avgMs.toFixed(2)), avgFps: Number((1000 / Math.max(1, avgMs)).toFixed(1)) });
        return;
      }
      s.backdrop.draw(s.clock, w, s.quality);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })`);

  // Moment 4: Exit (`ascent`) & multi-difficulty Hard validation check
  const m4 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    for (let i = 0; i < 60 * 10; i++) {
      w.step(1 / 60, { x: 0, y: 0, fire: i % 14 === 0, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
      if (w.tideArch.phase === 'ascent' && w.tideArch.altitude >= 0.72) break;
    }
    s.backdrop.draw(s.clock, w, s.quality);
    s.renderWorld(1 / 60);
    const exitSnap = {
      route: Number(w.route.toFixed(2)),
      phase: w.tideArch.phase,
      crossedArch: w.tideArch.crossedArch,
      altitude: Number(w.player.altitude.toFixed(3)),
    };
    // Also verify Easy & Hard difficulty runs through low-flight produce clean cannons on rock with zero grey pads
    const diffChecks = {};
    for (const diff of ['easy', 'hard']) {
      s.begin(0);
      s.world.setDifficulty(diff);
      s.world.devJumpTideArch('low-flight', true);
      s.world.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
      s.backdrop.draw(s.clock, s.world, s.quality);
      s.renderWorld(1 / 60);
      diffChecks[diff] = {
        cannonCount: s.world.enemies.filter(e => e.navigation?.customAnchor).length,
        archBridgeVisible: s.backdrop.tideArch.archBridge.visible,
        waterfallsRemoved: s.backdrop.tideArch.waterfalls === undefined,
        padsRemoved: s.backdrop.tideArch.padMountGfx === undefined,
      };
    }
    return { exitSnap, diffChecks };
  })()`);
  assert.equal(m4.exitSnap.crossedArch, true);
  assert.ok(m4.diffChecks.easy.cannonCount >= 2 && m4.diffChecks.hard.cannonCount >= 2);
  assert.equal(m4.diffChecks.hard.waterfallsRemoved, true);
  assert.equal(m4.diffChecks.hard.padsRemoved, true);
  report.moments.exitAndDifficulties = m4;
  await shot('05-arch-exit-hard');

  assert.equal(runtimeErrors.length, 0, `Expected 0 runtime errors, got: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('VERIFICATION REPORT:', JSON.stringify(report, null, 2));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill('SIGKILL'); } catch {}
  try { await devServer?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
