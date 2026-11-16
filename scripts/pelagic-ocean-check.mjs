/** Real Chrome/WebGL verification & comparative captures for Tarefa 04 (Oceano Vivo e Interação Naval).
 * Captures coast, harbor, lighthouse, speed/turn-responsive naval combat, submarine emerge/hold/submerge,
 * boss open-ocean arena, and evaluates LOW (0), MED (1), and HIGH (2) real-time performance & simulation parity.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const out = resolve('docs/screenshots/pelagic-ocean-v4');
mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg' };
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (!file.startsWith(root + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = mkdtempSync(join(tmpdir(), 'bw-ocean-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const errors = [];
const report = { errors, captures: [], frozenScrollDelta: {}, simulationParity: {}, performance: [] };
let socket;

try {
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page');
    } catch { /* Chrome is still starting. */ }
    if (!target) await sleep(150);
  }
  assert(target, 'Chrome did not expose a page target');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const handler = pending.get(msg.id); if (!handler) return;
      pending.delete(msg.id); clearTimeout(handler.timeout);
      msg.error ? handler.reject(new Error(JSON.stringify(msg.error))) : handler.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
    else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 60000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await sleep(100); }
    throw new Error('Timeout: ' + expression);
  };
  const settle = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
  const screenshot = async name => {
    await settle();
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(out, name + '.png'), Buffer.from(result.data, 'base64'));
    report.captures.push(name + '.png');
  };

  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await waitFor("window.__GAME__?.scene.isActive('ArcadeScene')&&!!window.__GAME__.scene.getScene('ArcadeScene').ui");

  await evaluate(`
    window.s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true); s.begin(0); s.scene.pause(); s.quality = 2;
    window.renderNow = () => { s.backdrop.draw(s.clock, s.world, s.quality); s.renderWorld(0); };
    window.setupCoast = (scroll, elapsed = 24, quality = 2) => {
      s.begin(0); s.scene.pause(); s.quality = quality;
      s.world.state = 'play'; s.world.waveIndex = 999; s.world.supplyIndex = 999;
      s.world.route = 30; s.world.elapsed = elapsed; s.world.scroll = scroll;
      s.world.player.invulnerable = 0;
      s.world.enemies = []; s.world.cargo = []; s.world.events = [];
      s.world.bullets.forEach(b => b.active = false);
      renderNow();
    };
    true;
  `);

  // 1. Verify Pelagic surf & shoal textures exist cleanly
  const texCheck = await evaluate(`['pelagic-connected-coast-v2','pelagic-coast-shoal-v1','pelagic-coast-surf-v1','pelagic-water-review','pelagic-depth-review','pelagic-caustics-review','pelagic-wave-crests'].every(k => s.textures.exists(k))`);
  assert.equal(texCheck, true, 'All living-ocean and shoreline textures must exist');

  // 2. Coast (praias & rochas)
  await evaluate('setupCoast(1850, 24, 2); true');
  await screenshot('01-costa-praia-rochas');

  // 3. Harbor (Porto com guindaste, trapiche e estacas) + barcos navegando
  await evaluate(`
    setupCoast(148, 12.6, 2);
    s.world.spawnEncounter({ family: 'boat', formation: 'pair', motion: 'stationary', lane: .46 });
    for (let i = 0; i < 140; i++) {
      s.world.step(1/120, { x: 0, y: 0, fire: false, special: false });
      s.world.scroll = 148;
      renderNow();
    }
    true;
  `);
  await screenshot('02-porto-navio');

  // 4. Lighthouse (Farol + barquinho encalhado + enseada)
  await evaluate('setupCoast(480, 18.4, 2); true');
  await screenshot('03-farol-enseada');

  // 5. Naval combat: moving & turning (wide speed-responsive Kelvin wakes) vs stationary hold
  await evaluate(`
    setupCoast(680, 14, 2);
    s.world.spawnEncounter({ family: 'boat', formation: 'pair', motion: 'curve', lane: .48 });
    s.world.spawnEncounter({ family: 'ship', formation: 'solo', motion: 'stationary', lane: .55 });
    for (let i = 0; i < 240; i++) {
      s.world.step(1/120, { x: 0, y: 0, fire: false, special: false });
      renderNow();
    }
    true;
  `);
  await screenshot('04-combate-naval-movimento');

  await evaluate(`
    for (let i = 0; i < 360; i++) {
      s.world.step(1/120, { x: 0, y: 0, fire: false, special: false });
      renderNow();
    }
    true;
  `);
  await screenshot('05-combate-naval-hold');

  // 6. Submarines: emerge, surfaced hold, submerge
  await evaluate(`
    setupCoast(135, 30, 2);
    s.world.spawnEncounter({ family: 'submarine', formation: 'pair', motion: 'stationary', lane: .5 });
    for (let i = 0; i < 66; i++) s.world.step(1/120, { x: 0, y: 0, fire: false, special: false }); // ~0.55s -> emerge
    renderNow(); true;
  `);
  await screenshot('06-submarinos-emergindo');

  await evaluate(`
    for (let i = 0; i < 210; i++) s.world.step(1/120, { x: 0, y: 0, fire: false, special: false }); // ~2.3s -> hold surfaced
    renderNow(); true;
  `);
  await screenshot('07-submarinos-superficie');

  await evaluate(`
    for (let i = 0; i < 790; i++) s.world.step(1/120, { x: 0, y: 0, fire: false, special: false }); // ~8.9s -> submerge
    renderNow(); true;
  `);
  await screenshot('08-submarinos-submergindo');

  // 7. Boss Colosso Abissal in open ocean + verify wave continuity while scroll is paused
  await evaluate(`
    s.begin(0); s.scene.pause(); s.quality = 2;
    s.world.state = 'play'; s.world.route = 300; s.world.scroll = 1200;
    s.world.waveIndex = 999; s.world.supplyIndex = 999;
    s.world.miniStarted = true; s.world.bossStarted = true;
    s.world.enemies = []; s.world.cargo = []; s.world.bullets.forEach(b => b.active = false);
    s.world.startBoss(false);
    for (let i = 0; i < 360; i++) s.world.step(1/120, { x: 0, y: 0, fire: false, special: false });
    renderNow(); true;
  `);
  await screenshot('09-chefe-colosso-mar-aberto');

  // Verify wave tiles & caustics still animate when world.scroll stays fixed
  report.frozenScrollDelta = await evaluate(`(() => {
    const scrollFixed = s.world.scroll;
    const before = {
      waterY: s.backdrop.water.tilePositionY,
      swellY: s.backdrop.waterSwell.tilePositionY,
      causticsY: s.backdrop.oceanCaustics.tilePositionY,
    };
    s.world.elapsed += 1.4;
    s.world.scroll = scrollFixed;
    renderNow();
    const after = {
      waterY: s.backdrop.water.tilePositionY,
      swellY: s.backdrop.waterSwell.tilePositionY,
      causticsY: s.backdrop.oceanCaustics.tilePositionY,
    };
    return {
      waterDeltaY: Math.abs(after.waterY - before.waterY),
      swellDeltaY: Math.abs(after.swellY - before.swellY),
      causticsDeltaY: Math.abs(after.causticsY - before.causticsY),
    };
  })()`);
  assert(report.frozenScrollDelta.waterDeltaY > 1 && report.frozenScrollDelta.swellDeltaY > 1 && report.frozenScrollDelta.causticsDeltaY > 1,
    'Ocean waves and caustics must keep animating when scroll is stationary');

  // 8. Visual captures & simulation parity across BAIXA (0), MÉDIA (1), ALTA (2)
  for (const [q, name] of [[0, '10-qualidade-baixa'], [1, '11-qualidade-media'], [2, '12-qualidade-alta']]) {
    await evaluate(`setupCoast(148, 12.6, ${q}); true`);
    await screenshot(name);
  }
  report.simulationParity = await evaluate(`(() => {
    const runs = [0, 1, 2].map(q => {
      s.begin(0); s.scene.pause(); s.quality = q;
      s.world.state = 'play'; s.world.player.invulnerable = 999;
      for (let i = 0; i < 600; i++) s.world.step(1/120, { x: .35, y: -.15, fire: true, special: false });
      return { q, score: s.world.score, kills: s.world.kills, px: s.world.player.x, py: s.world.player.y, scroll: s.world.scroll, enemies: s.world.enemies.map(e => [e.id, e.x, e.y, e.hp]) };
    });
    const base = JSON.stringify({ ...runs[0], q: 0 });
    return { equal: runs.every(r => JSON.stringify({ ...r, q: 0 }) === base), sampleScore: runs[0].score, scroll: runs[0].scroll };
  })()`);
  assert.equal(report.simulationParity.equal, true, 'Gameplay simulation and hitboxes must be identical across LOW, MED, and HIGH');

  // 9. Measure live 6s WebGL frame timing in Chrome across quality 0 (BAIXA), 1 (MÉDIA), 2 (ALTA)
  for (const q of [0, 1, 2]) {
    await evaluate(`s.begin(0); s.quality = ${q}; s.world.state = 'play'; s.world.route = 60; s.world.elapsed = 32; s.world.scroll = 150; s.world.player.invulnerable = 999; s.scene.resume(); true`);
    const perf = await evaluate(`new Promise(resolve => {
      const times = []; let last = performance.now(); const start = last;
      function frame(now) {
        times.push(now - last); last = now;
        if (now - start < 6000) requestAnimationFrame(frame);
        else {
          const sorted = times.slice(1).sort((a, b) => a - b);
          resolve({
            quality: ${q},
            frames: times.length,
            fps: +((times.length - 1) / ((now - start) / 1000)).toFixed(1),
            medianMs: +(sorted[Math.floor(sorted.length * .5)] ?? 0).toFixed(2),
            p95Ms: +(sorted[Math.floor(sorted.length * .95)] ?? 0).toFixed(2),
            heapMB: +((performance.memory?.usedJSHeapSize ?? 0) / (1024 * 1024)).toFixed(1),
          });
        }
      }
      requestAnimationFrame(frame);
    })`);
    report.performance.push(perf);
  }

  assert.deepEqual(errors, [], 'Browser reported console/runtime errors');
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket?.close(); chrome.kill(); server.close();
}
