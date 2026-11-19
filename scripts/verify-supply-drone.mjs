import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer as createViteDevServer } from 'vite';

const out = resolve('docs/screenshots/supply-drone');
mkdirSync(out, { recursive: true });

const devServer = await createViteDevServer({
  configFile: resolve('vite.config.ts'),
  mode: 'development',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
await devServer.listen();
const addr = devServer.httpServer.address();
const devUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 5173}/`;

const profile = mkdtempSync(join(tmpdir(), 'bw-drone-verify-'));
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
    const msg = JSON.parse(ev.data);
    if (msg.id) {
      const h = pending.get(msg.id); if (!h) return;
      pending.delete(msg.id); clearTimeout(h.timeout);
      msg.error ? h.reject(new Error(JSON.stringify(msg.error))) : h.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); rej(new Error('CDP timeout: ' + method)); }, 60000);
    pending.set(id, { resolve: res, reject: rej, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
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
    s.world.state = 'play';
    s.world.introTime = 0;
    s.world.waveIndex = 999;
    s.world.supplyIndex = 999;
    s.world.devInvincible = true;
    s.world.devSandboxIsolated = true;
    s.world.enemies = [];
    s.world.cargo = [];
    s.devSimulationPaused = true;
    window.stepSim = (sec, input = { x: 0, y: 0, fire: false, special: false }) => {
      const steps = Math.max(1, Math.round(sec * 60));
      for (let i = 0; i < steps; i++) s.world.step(1 / 60, input);
      s.renderWorld(1 / 60);
    };
    true;
  `);
  await settle(160);

  // 1. Verify top-only calm descent, compact size vs player ship & enemy planes, separate spinning propeller
  const descent = await evaluate(`(() => {
    const w = s.world;
    w.cargo = []; w.enemies = []; w.bullets.forEach(b => b.active = false);
    w.player.x = w.arenaCenterX; w.player.y = 330;
    const c = w.devSpawnSupplyDrone('power');
    const startX = c.x, startY = c.y;
    // Also spawn a reference fighter pair nearby so screenshot directly compares drone size vs planes & Bayek's ship!
    w.spawnEncounter({ family: 'fighter', formation: 'pair', motion: 'straight', lane: 0.65 });
    stepSim(1.6);
    const spr = s.cargoSprites.get(c.id);
    const ex = s.cargoExtras.get(c.id);
    const rot0 = ex?.prop?.rotation ?? 0;
    stepSim(3.8);
    const rot1 = ex?.prop?.rotation ?? 0;
    return {
      entrySide: c.drone?.entrySide,
      startY: Math.round(startY),
      endY: Math.round(c.y),
      avgVy: Number(((c.y - startY) / 5.4).toFixed(1)),
      driftDx: Math.round(c.x - startX),
      bodyTex: spr?.texture?.key,
      bodySize: Math.round(spr?.displayWidth ?? 0),
      propTex: ex?.prop?.texture?.key,
      propSize: Math.round(ex?.prop?.displayWidth ?? 0),
      propVisible: ex?.prop?.visible,
      rotDelta: Number(Math.abs(rot1 - rot0).toFixed(3)),
    };
  })()`);
  console.log('Top calm descent:', JSON.stringify(descent));
  assert.equal(descent.entrySide, 'top', 'Drone must enter strictly from top');
  assert.equal(descent.bodyTex, 'arc-supply-drone-body');
  assert.equal(descent.propTex, 'arc-supply-drone-propeller');
  assert.equal(descent.propVisible, true);
  assert.ok(descent.bodySize >= 26 && descent.bodySize <= 30, `Drone must be compact (~28px, plane-sized), got ${descent.bodySize}px`);
  assert.ok(descent.avgVy >= 26 && descent.avgVy <= 38, `Drone must descend slowly (~32 px/s), got ${descent.avgVy} px/s`);
  assert.ok(descent.rotDelta > 0.05, 'Propeller must rotate independently');
  await settle(60);
  await snap('01-compact-drone-size-comparison');

  // 2. Destruction + lively icons showcase (P, Heart, Bomb + compact drone above)
  const dropReport = await evaluate(`(() => {
    const w = s.world;
    w.cargo = []; w.enemies = []; w.bullets.forEach(b => b.active = false);
    w.weapons.powerMeter = 0; w.lives = 3; w.weapons.specialCharges = 1;
    const dPower = w.devSpawnSupplyDrone('power');
    stepSim(5.5);
    w.player.x = dPower.x; w.player.y = Math.min(365, dPower.y + 90);
    for (let i = 0; i < 65 && dPower.crate; i++) { w.player.x = dPower.x; stepSim(1 / 60, { x: 0, y: 0, fire: true, special: false }); }
    const brokenByFire = !dPower.crate;
    const itemTex = s.cargoSprites.get(dPower.id)?.texture?.key;
    const itemFrame = Number(s.cargoSprites.get(dPower.id)?.frame?.name);
    const propHiddenAfterDrop = s.cargoExtras.get(dPower.id)?.prop?.visible === false;

    dPower.x = w.arenaCenterX - 90; dPower.y = 250; dPower.vx = 0; dPower.vy = 0;
    const life = { id: 9901, x: w.arenaCenterX, y: 250, vx: 0, vy: 0, kind: 'life', crate: false, hp: 1, age: 0.35, dropPop: 0.25 };
    const spec = { id: 9902, x: w.arenaCenterX + 90, y: 250, vx: 0, vy: 0, kind: 'special', crate: false, hp: 1, age: 0.35, dropPop: 0.25 };
    w.cargo.push(life, spec);
    const liveDrone = w.devSpawnSupplyDrone('power');
    stepSim(5.2);
    w.player.x = w.arenaCenterX; w.player.y = 358;
    s.renderWorld(1 / 60);
    return { brokenByFire, itemTex, itemFrame, propHiddenAfterDrop, liveDroneY: Math.round(liveDrone.y) };
  })()`);
  console.log('Drop & Icons report:', JSON.stringify(dropReport));
  assert.equal(dropReport.brokenByFire, true);
  assert.equal(dropReport.itemTex, 'arc-supply-v2');
  assert.ok(dropReport.itemFrame >= 4 && dropReport.itemFrame <= 7);
  assert.equal(dropReport.propHiddenAfterDrop, true);
  await settle(60);
  await snap('02-compact-drone-and-icons');

  // 3. Undestroyed exit off bottom without drop + player collision check
  const behaviorReport = await evaluate(`(() => {
    const w = s.world;
    w.cargo = []; w.enemies = []; w.bullets.forEach(b => b.active = false);
    w.player.x = w.arenaCenterX + 120; w.player.y = 385;
    w.devSpawnSupplyDrone('power');
    stepSim(16.5);
    const countAfterEscape = w.cargo.length;

    w.devInvincible = false; w.player.invulnerable = 0; w.lives = 3;
    const colDrone = w.devSpawnSupplyDrone('special');
    stepSim(4.5);
    w.player.x = colDrone.x; w.player.y = colDrone.y;
    stepSim(1 / 60);
    return {
      countAfterEscape,
      collidedBroken: !colDrone.crate,
      livesAfterCollision: w.lives,
      invulnAfterCollision: Number(w.player.invulnerable.toFixed(2)),
    };
  })()`);
  console.log('Exit & Collision report:', JSON.stringify(behaviorReport));
  assert.equal(behaviorReport.countAfterEscape, 0, 'Undestroyed drone must leave bottom without dropping item');
  assert.equal(behaviorReport.collidedBroken, true, 'Player collision must destroy drone and release item');
  assert.equal(behaviorReport.livesAfterCollision, 2, 'Player collision must apply standard damage');
  assert.ok(behaviorReport.invulnAfterCollision > 0);
  assert.equal(errors.length, 0, 'Runtime errors occurred: ' + JSON.stringify(errors));
  console.log('ALL COMPACT TOP-DOWN SUPPLY DRONE CHECKS PASSED!');
} finally {
  socket?.close();
  chrome.kill();
  await devServer.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
