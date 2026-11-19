import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer as createViteDevServer } from 'vite';

const isBefore = process.argv.includes('--before');
const out = resolve(`docs/screenshots/fenda-expansion/${isBefore ? 'before' : 'after'}`);
mkdirSync(out, { recursive: true });

const devServer = await createViteDevServer({
  configFile: resolve('vite.config.ts'),
  mode: 'development',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
await devServer.listen();
const addr = devServer.httpServer.address();
const devUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 5173}/`;

const profile = mkdtempSync(join(tmpdir(), 'bw-fenda-verify-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--enable-webgl', '--ignore-gpu-blocklist',
  '--remote-debugging-port=0', '--remote-allow-origins=*', '--no-first-run',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
const errors = [];

try {
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (!target) await sleep(150);
  }
  if (!target) throw new Error('No Chrome target');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  socket.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const h = pending.get(m.id);
      pending.delete(m.id);
      clearTimeout(h.timeout);
      m.error ? h.reject(new Error(JSON.stringify(m.error))) : h.resolve(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push(m.params.exceptionDetails);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); rej(new Error('CDP timeout: ' + method)); }, 60000);
    pending.set(id, { resolve: res, reject: rej, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const waitFor = async (expr, max = 250) => {
    for (let i = 0; i < max; i++) { if (await evaluate(expr)) return; await sleep(80); }
    throw new Error('Timeout: ' + expr);
  };
  const settle = (ms = 120) => sleep(ms).then(() => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))'));
  const snap = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(out, `${name}.png`), Buffer.from(res.data, 'base64'));
  };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: devUrl });
  await waitFor("window.__GAME__?.scene.isActive('ArcadeScene') && ['STUDIO_SPLASH','MAIN_MENU'].includes(window.__GAME__.scene.getScene('ArcadeScene').openingState)");

  await evaluate(`
    window.s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true);
    s.begin(0);
    s.world.setDifficulty('normal');
    s.world.state = 'play';
    s.world.introTime = 0;
    s.world.devInvincible = true;
    s.world.devSandboxIsolated = true;
    s.world.waveIndex = 999;
    s.world.supplyIndex = 999;
    s.devSimulationPaused = true;
    window.stepSim = (sec, input = { x: 0, y: 0, fire: false, special: false }) => {
      const steps = Math.max(1, Math.round(sec * 60));
      for (let i = 0; i < steps; i++) s.world.step(1 / 60, input);
      s.renderWorld(1 / 60);
    };
    true;
  `);
  await settle(160);

  // 1. Side-by-side scale comparison: Fighter vs Scout, Interceptor vs Utility, Bomber vs Phantom, Boat vs Warhawk, all vs RIVET
  const sizes = await evaluate(`(() => {
    const w = s.world;
    w.enemies = []; w.cargo = []; w.bullets.forEach(b => b.active = false);
    w.scroll = 1400; w.route = 60;
    const place = (fam, x, y) => {
      w.devSpawnEncounter({ family: fam, formation: 'solo', motion: 'stationary', lane: 0.5 }, { keepExisting: true, y });
      const actor = w.enemies[w.enemies.length - 1];
      if (actor) {
        actor.x = x; actor.y = y; actor.vx = 0; actor.vy = 0; actor.cooldown = 99; actor.heliNav = undefined;
        if (actor.navigation) actor.navigation.worldY = y - w.scroll;
      }
      return actor ? { family: fam, size: actor.size } : null;
    };
    const cx = w.arenaCenterX;
    const list = [
      // Row 1: Fighter vs Scout | Interceptor vs Utility
      place('fighter', cx - 125, 118),
      place('heli_scout', cx - 60, 118),
      place('interceptor', cx + 45, 118),
      place('heli_utility', cx + 115, 118),
      // Row 2: Bomber vs Phantom | Boat vs Warhawk
      place('bomber', cx - 125, 224),
      place('heli_phantom', cx - 48, 224),
      place('boat', cx + 46, 224),
      place('heli_warhawk', cx + 124, 224),
    ];
    w.player.x = cx; w.player.y = 338;
    s.renderWorld(1 / 60);
    return list;
  })()`);
  console.log(`Scale comparison (${isBefore ? 'BEFORE' : 'AFTER'}):`, JSON.stringify(sizes));
  await settle(80);
  await snap('01-heli-scale-comparison');

  // 2. Tide Arch descent & platforms
  await evaluate(`(() => {
    const w = s.world;
    w.devSandboxIsolated = false;
    w.devJumpTideArch('descent', false, false);
    w.enemies.forEach(e => e.cooldown = 99);
    w.player.x = w.arenaCenterX; w.player.y = 356;
    s.renderWorld(1 / 60);
    return true;
  })()`);
  await settle(80);
  await snap('02-arch-descent');

  // 3. Tide Arch bridge & low-flight
  await evaluate(`(() => {
    const w = s.world;
    w.devJumpTideArch('low-flight', false, false);
    w.enemies.forEach(e => e.cooldown = 99);
    w.player.x = w.arenaCenterX; w.player.y = 350;
    s.renderWorld(1 / 60);
    return true;
  })()`);
  await settle(80);
  await snap('03-arch-bridge');

  if (!isBefore) {
    // 4-10. Capture all 7 regions + 3-submarine formation + Colosso Abissal boss @ 360s!
    const regionSnaps = [
      { file: '04-reg1-ceu-aberto', at: 18, step: 2.2 },
      { file: '05-reg2-costa-coral', at: 72, step: 3.0 },
      { file: '06-reg3-arquipelago', at: 122, step: 2.6 },
      { file: '07-reg4-corrente-expressa-subs', at: 168, step: 3.2 },
      { file: '08-reg6-mar-das-turbinas-helis', at: 256, step: 3.0 },
      { file: '09-reg7-fenda-pelagica-escalada', at: 324, step: 2.8 },
      { file: '10-boss-colosso-360s', at: 360, step: 4.5 },
    ];
    for (const r of regionSnaps) {
      const rep = await evaluate(`(() => {
        s.devJumpToCheckpoint(0, ${r.at}, { pauseDirector: false, isolated: false, seed: 1337 });
        s.world.setDifficulty('normal');
        s.world.devInvincible = true;
        s.devSimulationPaused = true;
        stepSim(${r.step});
        return {
          at: ${r.at},
          route: Number(s.world.route.toFixed(1)),
          region: s.world.region,
          enemies: s.world.enemies.map(e => e.family),
          boss: !!s.world.boss,
        };
      })()`);
      console.log(`Region snap [${r.file}]:`, JSON.stringify(rep));
      await settle(70);
      await snap(r.file);
    }

    // Explicit 3-submarine formation visual verification (no overlap, clear dodge lanes)
    const sub3 = await evaluate(`(() => {
      s.devJumpToCheckpoint(0, 172, { pauseDirector: true, isolated: true, seed: 1337 });
      s.world.devInvincible = true;
      s.devSimulationPaused = true;
      s.world.enemies = [];
      s.world.devSpawnEncounter({ family: 'submarine', formation: 'trio', motion: 'stationary', lane: 0.50 }, { keepExisting: false });
      stepSim(2.0);
      return s.world.enemies.map(e => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), exp: Number((e.submarine?.exposure ?? 0).toFixed(2)) }));
    })()`);
    console.log('3-Submarine formation:', JSON.stringify(sub3));
    assert.equal(sub3.length, 3, '3-submarine trio must spawn 3 distinct submarines');
    for (let i = 0; i < sub3.length; i++) {
      for (let j = i + 1; j < sub3.length; j++) {
        const d = Math.hypot(sub3[i].x - sub3[j].x, sub3[i].y - sub3[j].y);
        assert.ok(d >= 58, `Submarines ${i} & ${j} must not overlap (dist=${d.toFixed(1)}px)`);
      }
    }
    await settle(70);
    await snap('11-three-submarines-trio');

    // Live FPS check during active combat in Region 6 (helicopters + ships + planes)
    const fps = await evaluate(`(async () => {
      s.devJumpToCheckpoint(0, 260, { pauseDirector: false, isolated: false, seed: 1337 });
      s.world.setDifficulty('normal');
      s.world.devInvincible = true;
      s.devSimulationPaused = false;
      return await new Promise(resolve => {
        let frames = 0; const t0 = performance.now();
        function step() {
          frames++;
          if (performance.now() - t0 >= 1000) { resolve(Math.round(frames * 1000 / (performance.now() - t0))); return; }
          requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      });
    })()`);
    console.log('Live gameplay FPS:', fps);
    assert.ok(fps >= 45, `Expected smooth gameplay FPS >= 45, got ${fps}`);
    assert.equal(errors.length, 0, 'Runtime errors occurred: ' + JSON.stringify(errors));
    console.log('ALL LIVE BROWSER FENDA EXPANSION ASSERTIONS PASSED!');
  }
} finally {
  socket?.close();
  chrome.kill();
  await devServer.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
