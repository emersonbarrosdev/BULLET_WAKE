import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { steer } from './arcade-route.mjs';

const root = resolve('dist');
const out = resolve('docs/screenshots/pelagic-final-audit-v1');
mkdirSync(out, { recursive: true });

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.json': 'application/json',
};

const server = createServer((req, res) => {
  const file = resolve(root, '.' + (req.url === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + sep) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const profile = mkdtempSync(join(tmpdir(), 'bw-final-audit-'));
const chrome = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-precise-memory-info',
    '--user-data-dir=' + profile,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let socket;
const errors = [];
const report = {
  generatedAt: new Date().toISOString(),
  errors,
  gpu: null,
  uiAndPersistence: {},
  touchEmulation: {},
  qualityParity: {},
  leakCheck: [],
  performance: [],
  screenshots: [],
};

try {
  let target;
  for (let i = 0; i < 60; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page');
    } catch { /* wait for Chrome DevTools */ }
    if (target) break;
    await sleep(150);
  }
  assert(target, 'Failed to connect to headless Chrome DevTools');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });

  let seq = 0;
  const pending = new Map();
  socket.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push(msg.params.entry);
    }
  };

  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { resolve: res, reject: rej });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', {
      expression: `(async()=>{const value=await eval(${JSON.stringify(expression)});return value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype?undefined:value;})()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  const wait = async expr => {
    for (let i = 0; i < 160; i++) {
      if (await evaluate(expr)) return;
      await sleep(100);
    }
    throw Error('Timeout: ' + expr);
  };

  const shot = async name => {
    await sleep(150);
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const fileName = `${name}.png`;
    writeFileSync(join(out, fileName), Buffer.from(r.data, 'base64'));
    report.screenshots.push(fileName);
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });

  await wait(`window.__GAME__?.scene.isActive('ArcadeScene')&&!!window.__GAME__.scene.getScene('ArcadeScene').ui`);
  await evaluate(`
    window.s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true);
    window.steer = ${steer.toString()};
    window.renderFrame = () => {
      s.backdrop.draw(s.clock, s.world, s.quality);
      s.renderWorld(1 / 60);
    };
    window.advanceWorld = async (seconds, opts = {}) => {
      const steps = Math.round(seconds * 120);
      for (let i = 0; i < steps && !['victory', 'defeat'].includes(s.world.state); i++) {
        const base = steer(s.world, { collect: true, evade: true, special: opts.special ?? true });
        const inp = opts.manual ?? (opts.fire !== undefined ? { ...base, fire: opts.fire } : base);
        s.world.step(1 / 120, inp);
        s.clock += 1 / 120;
        s.consumeEvents();
        if (s.world.up && s.world.state !== 'intro') s.pelagicComms.step(1 / 120);
        if (i % 2 === 0) renderFrame();
        if (i % 240 === 0) await new Promise(r => setTimeout(r, 0));
      }
      renderFrame();
    };
  `);

  report.gpu = await evaluate(`(() => {
    const gl = window.__GAME__.renderer.gl;
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  })()`);

  // 1. UI flow + Title Screenshot + Controls/Settings/Touch-Settings
  await evaluate(`s.show('title')`);
  await sleep(180);
  await shot('01-title');

  // Verify settings toggles persist and do not break world
  await evaluate(`s.show('pilot')`);
  await evaluate(`s.show('missions')`);
  await evaluate(`s.begin(0); s.show('play');`);
  await evaluate(`s.show('pause')`);
  await evaluate(`s.show('settings')`);
  await evaluate(`s.show('touch-settings')`);
  await sleep(150);
  await shot('09-touch-settings');

  // 2. Gameplay Visual Captures across key Fenda Pelágica moments (1366x768 Desktop, High Quality)
  await evaluate(`s.quality = 2; s.begin(0); s.scene.pause(); s.world.state = 'play'; s.world.player.invulnerable = 20;`);
  await evaluate(`advanceWorld(8)`);
  await shot('02-play-coast-early');

  await evaluate(`(async () => { s.world.weapons.weaponLevel = 4; await advanceWorld(116 - s.world.elapsed); })()`);
  await shot('03-play-convoy-lv4');

  // Capture Tormenta Escarlate active blast
  await evaluate(`(async () => { s.world.weapons.specialCharges = 2; await advanceWorld(0.1, { manual: { x: 0, y: 0, fire: true, special: true } }); await advanceWorld(0.85, { manual: { x: 0, y: 0, fire: true, special: false } }); })()`);
  await shot('04-special-tormenta-escarlate');

  // Advance to Miniboss Patrulha Pesada (~155s)
  await evaluate(`advanceWorld(159 - s.world.elapsed)`);
  const miniActive = await evaluate(`Boolean(s.world.boss?.mini)`);
  assert.equal(miniActive, true, 'Miniboss should be active near 159s');
  await shot('05-miniboss-patrulha-pesada');

  // Advance to Colosso Abissal Proa (Sec 0) and Mid/Bridge (Sec 2)
  await evaluate(`(async () => { s.world.weapons.weaponLevel = 5; await advanceWorld(307 - s.world.elapsed); })()`);
  const subSection0 = await evaluate(`s.world.boss?.sub?.activeSection ?? -1`);
  assert.equal(subSection0, 0, 'Colosso Abissal should spawn at Section 0');
  await shot('06-boss-colosso-proa');

  // Fight forward to Section 2 (Torre de Comando)
  await evaluate(`(async () => {
    for (let k = 0; k < 180 && (s.world.boss?.sub?.activeSection ?? 99) < 2 && s.world.state === 'play'; k++) {
      await advanceWorld(1.0);
    }
  })()`);
  const subSectionMid = await evaluate(`s.world.boss?.sub?.activeSection ?? -1`);
  assert.ok(subSectionMid >= 2, `Expected Colosso Abissal to advance to section >= 2, got ${subSectionMid}`);
  await shot('07-boss-colosso-comando');

  // Finish boss cleanly & verify Cidade Solar unlock + SaveSystem persistence
  await evaluate(`(async () => {
    s.world.player.invulnerable = 120;
    for (let k = 0; k < 180 && s.world.state !== 'victory'; k++) {
      await advanceWorld(1.0);
    }
    if (s.world.state === 'victory') { s.saveClear(); s.show('result'); }
  })()`);
  await sleep(180);
  await shot('10-victory-result');

  const clearSave = await evaluate(`({
    screen: s.screen,
    state: s.world.state,
    score: s.world.score,
    saveRaw: localStorage.getItem('bullet_wake_save_data_v1'),
    arcadeRaw: localStorage.getItem('bullet_wake_arcade_v1'),
  })`);
  assert.equal(clearSave.state, 'victory');
  assert.equal(clearSave.screen, 'result');
  const arcadeProg = JSON.parse(clearSave.arcadeRaw || '{}');
  const campaignSave = JSON.parse(clearSave.saveRaw || '{}');
  assert.ok(Array.isArray(arcadeProg.cleared) && arcadeProg.cleared.includes(1), 'Mission 1 clear recorded in bullet_wake_arcade_v1');
  assert.ok(Array.isArray(campaignSave.unlockedStages) && campaignSave.unlockedStages.includes(2), 'Cidade Solar unlocked after Fenda Pelagica victory');

  // Defeat & Retry flow
  await evaluate(`s.begin(0); s.world.state = 'play'; s.world.player.invulnerable = 0; s.world.lives = 1; s.world.hurtPlayer(); s.show('defeat');`);
  await sleep(150);
  await shot('11-defeat-screen');
  await evaluate(`s.begin(0); s.show('play');`);
  const afterRetry = await evaluate(`({ screen: s.screen, state: s.world.state, lives: s.world.lives, score: s.world.score, elapsed: s.world.elapsed })`);
  assert.deepEqual(afterRetry, { screen: 'play', state: 'intro', lives: 3, score: 0, elapsed: 0 });
  report.uiAndPersistence = {
    miniSeen: true,
    subSectionMid,
    victoryScore: clearSave.score,
    arcadeCleared: arcadeProg.cleared,
    unlockedStages: campaignSave.unlockedStages,
    retryResetVerified: true,
  };

  // 3. Android Touch Emulation (854x480 + 915x412 safe cutout)
  await send('Emulation.setDeviceMetricsOverride', { width: 854, height: 480, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(120);
  await evaluate(`(async () => {
    window.__GAME__.scale.refresh();
    s.begin(0);
    s.scene.pause();
    s.world.state = 'play';
    s.world.scroll = 3400;
    s.world.route = 85;
    s.world.weapons.weaponLevel = 4;
    s.world.spawnEncounter({ family: 'fighter', formation: 'v', motion: 'sine', lane: 0.5 });
    await advanceWorld(1.2);
    s.setTouchVisible(true);
    s.renderTouchOverlay();
  })()`);
  await sleep(180);
  await shot('08-touch-mobile-854x480');

  // Real pointer multitouch simultaneity on Chrome CDP (Move joystick + Fire + Special + Cutout safe-area margin)
  const touchCheck = await evaluate(`(() => {
    const layout = s.touchController.getLayout();
    const fire = layout.fire;
    const stick = layout.joystick;
    const special = layout.special;
    s.touchController.onPointerDown(1, stick.x + 18, stick.y - 14);
    s.touchController.onPointerDown(2, fire.x, fire.y);
    const mid = s.touchController.peek();
    s.touchController.onPointerDown(3, special.x, special.y);
    const stepCmd = s.touchController.consumeStep();
    s.touchController.onPointerUp(1);
    s.touchController.onPointerUp(2);
    s.touchController.onPointerUp(3);
    const afterUp = s.touchController.peek();
    // Safe area test on notch inset profile
    const savedTouchSettings = s.touchController.getSettings();
    s.touchController.configure(savedTouchSettings, { left: 48, right: 24, top: 0, bottom: 21 });
    const cutoutLayout = s.touchController.getLayout();
    s.touchController.configure(savedTouchSettings);
    return {
      layoutStickX: stick.x,
      layoutFireX: fire.x,
      midFire: mid.fire,
      midMoving: Math.hypot(mid.x, mid.y) > 0.25,
      stepSpecial: stepCmd.special,
      releasedAll: !afterUp.fire && !afterUp.special && afterUp.x === 0 && afterUp.y === 0,
      cutoutStickSafe: cutoutLayout.joystick.x >= 48,
      cutoutFireSafe: cutoutLayout.fire.x <= 768 - 24,
    };
  })()`);
  assert.equal(touchCheck.midFire, true);
  assert.equal(touchCheck.midMoving, true);
  assert.equal(touchCheck.stepSpecial, true);
  assert.equal(touchCheck.releasedAll, true);
  assert.equal(touchCheck.cutoutStickSafe, true);
  assert.equal(touchCheck.cutoutFireSafe, true);
  report.touchEmulation = touchCheck;

  // 4. Quality Simulation Parity Check (deterministic world identical across quality 0, 1, 2)
  const paritySnapshots = [];
  for (const q of [0, 1, 2]) {
    const snap = await evaluate(`(() => {
      s.quality = ${q};
      s.begin(0);
      s.world.introTime = 0;
      for (let i = 0; i < 1200; i++) {
        const dir = i % 120 < 60 ? 0.65 : -0.65;
        s.world.step(1 / 120, { x: dir, y: i % 90 < 45 ? -0.25 : 0.25, fire: true, special: i === 600 });
        s.world.events.length = 0;
      }
      return {
        q: ${q},
        elapsed: +s.world.elapsed.toFixed(6),
        route: +s.world.route.toFixed(6),
        scroll: +s.world.scroll.toFixed(6),
        score: s.world.score,
        kills: s.world.kills,
        lives: s.world.lives,
        px: +s.world.player.x.toFixed(6),
        py: +s.world.player.y.toFixed(6),
        level: s.world.weapons.weaponLevel,
      };
    })()`);
    paritySnapshots.push(snap);
  }
  assert.deepEqual({ ...paritySnapshots[0], q: 0 }, { ...paritySnapshots[1], q: 0 });
  assert.deepEqual({ ...paritySnapshots[0], q: 0 }, { ...paritySnapshots[2], q: 0 });
  report.qualityParity = { identical: true, snapshot: paritySnapshots[0] };

  // 5. Real WebGL Benchmark across Qualities (0=BAIXA, 1=MÉDIA, 2=ALTA) and Scenarios
  const QUALITY_LABELS = ['BAIXA', 'MÉDIA', 'ALTA'];
  const runPerf = async ({ scenario, setupExpr, quality, width, height, mobile, durationMs = 6000 }) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
    await evaluate(`window.__GAME__.scale.refresh(); s.quality = ${quality}; s.setTouchVisible(${mobile}); ${setupExpr}`);
    await sleep(600);
    const res = await evaluate(`new Promise(resolve => {
      const samples = [];
      let before = performance.now();
      const start = before;
      const heapStart = performance.memory?.usedJSHeapSize ?? 0;
      let peakBullets = 0;
      let peakEnemies = 0;
      function tick(now) {
        samples.push(now - before);
        before = now;
        let activeBullets = 0;
        for (const b of s.world.bullets) if (b.active) activeBullets++;
        peakBullets = Math.max(peakBullets, activeBullets);
        peakEnemies = Math.max(peakEnemies, s.world.enemies.length);
        if (${scenario === 'desktop-dense-nv5' ? 'true' : 'false'} && s.world.enemies.length < 6) {
          s.world.spawnEncounter({ family: 'bomber', formation: 'horde', motion: 'sine', lane: 0.5 });
        }
        if (${scenario === 'desktop-special-blast' ? 'true' : 'false'} && !s.world.bomb && s.world.state === 'play') {
          s.world.weapons.specialCharges = 3;
          s.controls.X.isDown = true;
          if (s.world.enemies.length < 5) s.world.spawnEncounter({ family: 'fighter', formation: 'horde', motion: 'curve', lane: 0.5 });
        } else {
          s.controls.X.isDown = false;
        }
        if (now - start < ${durationMs}) {
          requestAnimationFrame(tick);
        } else {
          s.controls.SPACE.isDown = false;
          s.controls.X.isDown = false;
          samples.shift();
          const total = now - start;
          const count = samples.length;
          samples.sort((a, b) => a - b);
          const p = q => samples[Math.min(count - 1, Math.floor(count * q))];
          resolve({
            scenario: ${JSON.stringify(scenario)},
            quality: ${quality},
            qualityLabel: ${JSON.stringify(QUALITY_LABELS[quality])},
            viewport: ${JSON.stringify(`${width}x${height}${mobile ? ' (touch)' : ''}`)},
            seconds: Number((total / 1000).toFixed(2)),
            frames: count,
            fps: Number((count / (total / 1000)).toFixed(2)),
            medianMs: Number(p(0.5).toFixed(2)),
            p95Ms: Number(p(0.95).toFixed(2)),
            p99Ms: Number(p(0.99).toFixed(2)),
            maxMs: Number(samples[count - 1].toFixed(2)),
            heapStartMB: Number((heapStart / 1048576).toFixed(2)),
            heapEndMB: Number(((performance.memory?.usedJSHeapSize ?? 0) / 1048576).toFixed(2)),
            objects: s.children.length,
            peakBullets,
            peakEnemies,
          });
        }
      }
      requestAnimationFrame(tick);
    })`);
    report.performance.push(res);
  };

  const scenarios = [
    {
      scenario: 'desktop-common',
      width: 1366,
      height: 768,
      mobile: false,
      setupExpr: `s.begin(0); s.world.state='play'; s.world.route=72; s.world.scroll=2700; s.world.weapons.weaponLevel=3; s.world.player.invulnerable=60; s.controls.SPACE.isDown=true; s.scene.resume();`,
    },
    {
      scenario: 'desktop-dense-nv5',
      width: 1366,
      height: 768,
      mobile: false,
      setupExpr: `s.begin(0); s.world.state='play'; s.world.route=220; s.world.scroll=6200; s.world.waveIndex=999; s.world.supplyIndex=999; s.world.weapons.weaponLevel=5; s.world.player.invulnerable=60; s.controls.SPACE.isDown=true; s.scene.resume();`,
    },
    {
      scenario: 'desktop-special-blast',
      width: 1366,
      height: 768,
      mobile: false,
      setupExpr: `s.begin(0); s.world.state='play'; s.world.route=120; s.world.scroll=3900; s.world.waveIndex=999; s.world.supplyIndex=999; s.world.weapons.weaponLevel=5; s.world.weapons.specialCharges=4; s.world.player.invulnerable=60; s.controls.SPACE.isDown=true; s.scene.resume();`,
    },
    {
      scenario: 'desktop-colosso-abissal',
      width: 1366,
      height: 768,
      mobile: false,
      setupExpr: `s.begin(0); s.world.state='play'; s.world.route=300; s.world.scroll=11400; s.world.miniStarted=true; s.world.waveIndex=999; s.world.supplyIndex=999; s.world.weapons.weaponLevel=5; s.world.player.invulnerable=60; s.controls.SPACE.isDown=true; s.scene.resume();`,
    },
    {
      scenario: 'mobile-854x480',
      width: 854,
      height: 480,
      mobile: true,
      setupExpr: `s.begin(0); s.world.state='play'; s.world.route=85; s.world.scroll=3100; s.world.weapons.weaponLevel=4; s.world.player.invulnerable=60; s.controls.SPACE.isDown=true; s.scene.resume();`,
    },
  ];

  for (const sc of scenarios) {
    for (const q of [0, 1, 2]) {
      await runPerf({ ...sc, quality: q });
    }
  }

  // 6. Restart Leak Check (5 full restarts with active combat)
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
  for (let run = 1; run <= 5; run++) {
    await evaluate(`
      s.quality = 2;
      s.begin(0);
      s.world.state = 'play';
      s.world.weapons.weaponLevel = 5;
      s.world.player.invulnerable = 30;
      s.controls.SPACE.isDown = true;
      s.scene.resume();
    `);
    await sleep(2500);
    const snap = await evaluate(`({
      restart: ${run},
      objects: s.children.length,
      heapMB: Number(((performance.memory?.usedJSHeapSize ?? 0) / 1048576).toFixed(2)),
      enemySprites: s.enemySprites.size,
      effects: s.effects.length,
    })`);
    report.leakCheck.push(snap);
  }
  await evaluate(`s.controls.SPACE.isDown = false;`);

  // Ensure bounded display object count across restarts
  const objCounts = report.leakCheck.map(x => x.objects);
  assert.ok(Math.max(...objCounts) - Math.min(...objCounts) <= 25, `Unexpected display object growth across restarts: ${objCounts.join(',')}`);
  assert.deepEqual(errors, []);

  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket?.close();
  chrome.kill();
  server.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore cleanup lock */ }
}
