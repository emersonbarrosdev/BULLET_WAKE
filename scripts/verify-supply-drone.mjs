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

  // 1-4. Verify all 4 entry sides + separate body/propeller textures + independent propeller rotation + fast entry speed
  for (const [idx, side] of ['left', 'right', 'top', 'bottom'].entries()) {
    const info = await evaluate(`(() => {
      const w = s.world;
      w.cargo = []; w.enemies = []; w.bullets.forEach(b => b.active = false);
      w.player.x = w.arenaCenterX; w.player.y = 362;
      const c = w.devSpawnSupplyDrone('power', '${side}');
      const startX = c.x, startY = c.y;
      stepSim(0.45);
      const midX = c.x, midY = c.y;
      const spr = s.cargoSprites.get(c.id);
      const ex = s.cargoExtras.get(c.id);
      const rot0 = ex?.prop?.rotation ?? 0;
      stepSim(0.55);
      const rot1 = ex?.prop?.rotation ?? 0;
      const dist = Math.hypot(c.x - startX, c.y - startY);
      return {
        side: c.drone?.entrySide,
        phase: c.drone?.phase,
        startX: Math.round(startX), startY: Math.round(startY),
        midX: Math.round(midX), midY: Math.round(midY),
        endX: Math.round(c.x), endY: Math.round(c.y),
        avgSpeed: Math.round(dist / 1.0),
        bodyTex: spr?.texture?.key,
        propTex: ex?.prop?.texture?.key,
        propVisible: ex?.prop?.visible,
        rotDelta: Number(Math.abs(rot1 - rot0).toFixed(3)),
      };
    })()`);
    console.log(`Entry [${side}]:`, JSON.stringify(info));
    assert.equal(info.bodyTex, 'arc-supply-drone-body', `${side}: drone body must use supply-drone-body`);
    assert.equal(info.propTex, 'arc-supply-drone-propeller', `${side}: propeller must use supply-drone-propeller`);
    assert.equal(info.propVisible, true, `${side}: propeller must be visible`);
    assert.ok(info.rotDelta > 0.05, `${side}: propeller must rotate independently`);
    assert.ok(info.avgSpeed >= 120, `${side}: drone entry speed must be fast arcade pace, got ${info.avgSpeed} px/s`);
    await settle(60);
    await snap(`0${idx + 1}-drone-enter-${side}`);
  }

  // 5. Destruction + lively icons showcase (shoot drone down & inspect P, Heart, Bomb together!)
  const dropReport = await evaluate(`(() => {
    const w = s.world;
    w.cargo = []; w.enemies = []; w.bullets.forEach(b => b.active = false);
    w.weapons.powerMeter = 0; w.lives = 3; w.weapons.specialCharges = 1;
    const dPower = w.devSpawnSupplyDrone('power', 'left');
    stepSim(1.05);
    w.player.x = dPower.x; w.player.y = 355;
    for (let i = 0; i < 65 && dPower.crate; i++) { w.player.x = dPower.x; stepSim(1 / 60, { x: 0, y: 0, fire: true, special: false }); }
    const brokenByFire = !dPower.crate;
    const itemTex = s.cargoSprites.get(dPower.id)?.texture?.key;
    const itemFrame = Number(s.cargoSprites.get(dPower.id)?.frame?.name);
    const propHiddenAfterDrop = s.cargoExtras.get(dPower.id)?.prop?.visible === false;

    // Also place Heart and Bomb dropped items + one hovering drone so screenshot shows all 3 vibrant icons + drone!
    dPower.x = w.arenaCenterX - 96; dPower.y = 248; dPower.vx = 0; dPower.vy = 0;
    const life = { id: 9901, x: w.arenaCenterX, y: 248, vx: 0, vy: 0, kind: 'life', crate: false, hp: 1, age: 0.35, dropPop: 0.25 };
    const spec = { id: 9902, x: w.arenaCenterX + 96, y: 248, vx: 0, vy: 0, kind: 'special', crate: false, hp: 1, age: 0.35, dropPop: 0.25 };
    w.cargo.push(life, spec);
    const liveDrone = w.devSpawnSupplyDrone('power', 'top');
    stepSim(1.05);
    w.player.x = w.arenaCenterX; w.player.y = 365;
    s.renderWorld(1 / 60);
    return { brokenByFire, itemTex, itemFrame, propHiddenAfterDrop, liveDroneY: Math.round(liveDrone.y) };
  })()`);
  console.log('Drop & Icons report:', JSON.stringify(dropReport));
  assert.equal(dropReport.brokenByFire, true, 'Primary fire must destroy supply drone');
  assert.equal(dropReport.itemTex, 'arc-supply-v2', 'Dropped item must render from supply-items sheet');
  assert.ok(dropReport.itemFrame >= 4 && dropReport.itemFrame <= 7, `Dropped POWER icon must use frames 4..7 (not balloon 0..3), got ${dropReport.itemFrame}`);
  assert.equal(dropReport.propHiddenAfterDrop, true, 'Propeller sprite must hide once drone breaks into item');
  await settle(60);
  await snap('05-drone-and-supply-icons');

  // 6. Retreat without drop + player collision check
  const behaviorReport = await evaluate(`(() => {
    const w = s.world;
    w.cargo = []; w.enemies = []; w.bullets.forEach(b => b.active = false);
    w.devSandboxIsolated = false; w.waveIndex = 999; w.supplyIndex = 999;
    w.player.x = w.arenaCenterX; w.player.y = 385;
    const ret = w.devSpawnSupplyDrone('power', 'right');
    stepSim(6.2);
    const inRetreat = ret.drone?.phase === 'retreat';
    return { inRetreat, y: Math.round(ret.y), cargoCount: w.cargo.length };
  })()`);
  await settle(60);
  await snap('06-drone-retreating');

  const retreatFinish = await evaluate(`(() => {
    const w = s.world;
    stepSim(2.4);
    const countAfterEscape = w.cargo.length;
    // Now test player collision with drone (with invincibility OFF)
    w.devInvincible = false; w.player.invulnerable = 0; w.lives = 3;
    const colDrone = w.devSpawnSupplyDrone('special', 'top');
    stepSim(1.05);
    w.player.x = colDrone.x; w.player.y = colDrone.y;
    stepSim(1 / 60);
    return {
      countAfterEscape,
      collidedBroken: !colDrone.crate,
      livesAfterCollision: w.lives,
      invulnAfterCollision: Number(w.player.invulnerable.toFixed(2)),
    };
  })()`);
  console.log('Retreat & Collision report:', JSON.stringify({ ...behaviorReport, ...retreatFinish }));
  assert.equal(behaviorReport.inRetreat, true, 'Undestroyed drone must enter retreat phase');
  assert.equal(retreatFinish.countAfterEscape, 0, 'Retreated drone must exit without dropping item');
  assert.equal(retreatFinish.collidedBroken, true, 'Drone colliding with player must be destroyed and release item');
  assert.equal(retreatFinish.livesAfterCollision, 2, 'Drone colliding with player must apply collision damage');
  assert.ok(retreatFinish.invulnAfterCollision > 0, 'Standard invulnerability must activate after drone collision');

  assert.equal(errors.length, 0, 'Runtime errors occurred: ' + JSON.stringify(errors));
  console.log('ALL LIVE BROWSER SUPPLY DRONE ASSERTIONS PASSED!');
} finally {
  socket?.close();
  chrome.kill();
  await devServer.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
