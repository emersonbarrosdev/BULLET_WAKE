import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/sonic-wings-projectiles');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-sonic-wings-shots-'));

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
  orbTextureAudit: {},
  speedTable: [],
  bossAndSizes: {},
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
      '--remote-debugging-port=9237',
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
      target = (await (await fetch('http://127.0.0.1:9237/json')).json()).find((t) => t.type === 'page');
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
      return !!(s && s.textures && s.textures.exists('arc-orb-0') && s.textures.exists('arc-orb-1') && s.textures.exists('arc-orb-2') && s.screen !== 'loading');
    })()`);
    if (ready) break;
    await sleep(100);
  }
  assert.equal(ready, true, 'ArcadeScene must finish boot & build arc-orb-0/1/2 textures');

  // 1. Audit arc-orb-0..2 pixel palette & transparency directly from canvas textures
  report.orbTextureAudit = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const res = {};
    for (const key of ['arc-orb-0', 'arc-orb-1', 'arc-orb-2']) {
      const src = s.textures.get(key).getSourceImage();
      const ctx = src.getContext('2d');
      const d = ctx.getImageData(0, 0, src.width, src.height).data;
      const px = (x, y) => {
        const i = (y * src.width + x) * 4;
        return { r: d[i], g: d[i+1], b: d[i+2], a: d[i+3] };
      };
      const mid = Math.floor(src.width * 0.5);
      res[key] = {
        width: src.width,
        height: src.height,
        cornerAlpha: px(1, 1).a,
        center: px(mid, mid),
        innerOrange: px(mid + 12, mid),
        crimsonRim: px(mid + 23, mid),
      };
    }
    return res;
  })()`);
  for (const key of ['arc-orb-0', 'arc-orb-1', 'arc-orb-2']) {
    const o = report.orbTextureAudit[key];
    assert.equal(o.width, 64);
    assert.equal(o.cornerAlpha, 0, `${key} corners must be 100% transparent`);
    assert(o.center.r >= 245 && o.center.g >= 240 && o.center.b >= 220, `${key} center must be near-white yellow hot core`);
    assert(o.innerOrange.r >= 220 && o.innerOrange.g >= 60 && o.innerOrange.b <= 40, `${key} body must be vivid orange-red`);
    assert(o.crimsonRim.r >= 80 && o.crimsonRim.g <= 30 && o.crimsonRim.b <= 20 && o.crimsonRim.a === 255, `${key} outer rim must be sharp dark crimson`);
  }

  // 2. Capture comparable real encounters across all 3 difficulties (`easy`, `normal`, `hard`)
  const stageShots = [
    { diff: 'easy', file: '01-facil' },
    { diff: 'normal', file: '02-normal' },
    { diff: 'hard', file: '03-dificil' },
  ];
  for (const item of stageShots) {
    const snap = await evaluate(`(() => {
      const s = window.__GAME__.scene.getScene('ArcadeScene');
      s.audio.setMix(0, 0, true);
      s.begin(0);
      const w = s.world;
      w.setSeed(1337);
      w.setDifficulty('${item.diff}');
      w.devInvincible = true;
      w.introTime = 0;
      w.state = 'play';
      w.waveIndex = 999;
      w.supplyIndex = 999;
      w.directorPaused = true;
      w.clearArenaEntities();
      w.route = 24;
      w.scroll = 24 * 38;
      w.spawnEncounter({ family: 'bomber', formation: 'solo', motion: 'straight', lane: 0.5 });
      w.spawnEncounter({ family: 'fighter', formation: 'pair', motion: 'straight', lane: 0.34 });
      w.spawnEncounter({ family: 'heli_utility', formation: 'solo', motion: 'stationary', lane: 0.72 });
      for (const e of w.enemies) {
        if (e.family === 'bomber') { e.x = 384; e.y = 104; e.cooldown = 0.01; }
        else if (e.family === 'heli_utility') { e.x = 492; e.y = 152; e.cooldown = 0.01; }
        else { e.y = 132; e.cooldown = 0.01; }
      }
      for (let i = 0; i < 42; i++) {
        w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
        s.clock += 1 / 60;
        s.consumeEvents();
      }
      s.backdrop.draw(s.clock, w, s.quality);
      s.renderWorld(1 / 60);
      const activeOrbs = w.bullets.filter(b => b.active && b.enemy && !b.enemyMissile);
      const visibleSprites = s.bulletSprites.filter((sp, idx) => w.bullets[idx]?.active && w.bullets[idx]?.enemy && !w.bullets[idx]?.enemyMissile);
      return {
        difficulty: w.difficulty,
        label: w.difficultyProfile.label,
        multiplier: w.difficultyProfile.shotSpeedMultiplier,
        orbCount: activeOrbs.length,
        radii: [...new Set(activeOrbs.map(b => b.radius))].sort((a, b) => a - b),
        textures: [...new Set(visibleSprites.map(sp => sp.texture.key))].sort(),
        fighterSpeed: Math.round(Math.max(...activeOrbs.filter(b => Math.abs(b.radius - 2.2) < 0.05).map(b => Math.hypot(b.vx, b.vy))) * 10) / 10,
        bomberSpeed: Math.round(Math.max(...activeOrbs.filter(b => Math.abs(b.radius - 3.1) < 0.05).map(b => Math.hypot(b.vx, b.vy))) * 10) / 10,
      };
    })()`);
    assert.ok(snap.orbCount >= 6, `Expected >=6 visible enemy orbs on ${item.diff}`);
    assert.ok(snap.radii.length >= 2, `Expected multiple projectile sizes on ${item.diff}`);
    assert.ok(snap.textures.every(t => t.startsWith('arc-orb-')), `All conventional orbs must use arc-orb-*`);
    report[item.diff] = snap;
    await shot(item.file);
  }

  // 3. Boss + mixed enemy category screenshot verifying boss spheres + submarine + cannons
  report.bossAndSizes = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.begin(0);
    const w = s.world;
    w.setDifficulty('normal');
    w.devInvincible = true;
    w.devStartBoss(false, 2);
    w.boss.sub.phase = 'fight';
    for (const p of w.boss.sub.sections[2].parts) {
      if (p.hp > 0) p.cooldown = 0.01;
    }
    for (let i = 0; i < 48; i++) {
      w.step(1 / 60, { x: 0, y: 0, fire: false, special: false });
      s.clock += 1 / 60;
      s.consumeEvents();
    }
    s.backdrop.draw(s.clock, w, s.quality);
    s.renderWorld(1 / 60);
    const bullets = w.bullets.filter(b => b.active && b.enemy);
    return {
      bulletCount: bullets.length,
      radii: [...new Set(bullets.map(b => b.radius))].sort((a, b) => a - b),
      speeds: [...new Set(bullets.map(b => Math.round(Math.hypot(b.vx, b.vy))))].sort((a, b) => a - b),
    };
  })()`);
  assert.ok(report.bossAndSizes.bulletCount >= 10);
  await shot('04-boss-and-sizes');

  // 4. Measure real frame-by-frame travel speeds and crossing times across all 9 enemy types + bosses
  report.speedTable = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const categories = ['fighter', 'interceptor', 'bomber', 'heli_scout', 'heli_utility', 'heli_phantom', 'heli_warhawk', 'boat', 'ship', 'submarine', 'tower'];
    const rows = [];
    for (const fam of categories) {
      const row = { family: fam };
      for (const diff of ['easy', 'normal', 'hard']) {
        s.begin(0);
        const w = s.world;
        w.setDifficulty(diff);
        w.devInvincible = true;
        w.introTime = 0;
        w.state = 'play';
        w.waveIndex = 999;
        w.supplyIndex = 999;
        w.directorPaused = true;
        w.clearArenaEntities();
        w.spawnEncounter({ family: fam, formation: 'solo', motion: 'straight', lane: 0.5 });
        const e = w.enemies[0];
        e.x = 384;
        e.y = 110;
        if (e.navigation) {
          e.navigation.anchor = undefined;
          e.navigation.worldY = 110 - w.scroll;
          e.navigation.phase = 'hold';
          if (fam === 'tower' || fam === 'tank') {
            e.navigation.customAnchor = true;
            e.navigation.anchorX = 384;
            e.navigation.anchorY = 0;
          }
        }
        if (e.submarine) {
          e.age = 2.0;
          e.submarine.phase = 'hold';
          e.submarine.exposure = 1;
        }
        e.cooldown = 0;
        w.updateEnemies(1 / 60);
        const b = w.bullets.find(bl => bl.active && bl.enemy && !bl.enemyMissile);
        const x0 = b.x, y0 = b.y;
        const speed = Math.hypot(b.vx, b.vy);
        let ticks = 0;
        while (b.active && Math.hypot(b.x - x0, b.y - y0) < 300 && ticks < 600) {
          b.px = b.x; b.py = b.y;
          b.x += b.vx / 120; b.y += b.vy / 120;
          ticks++;
        }
        row[diff] = {
          radius: b.radius,
          speedPxPerSec: Number(speed.toFixed(1)),
          time300PxSec: Number((ticks / 120).toFixed(3)),
        };
      }
      rows.push(row);
    }
    return rows;
  })()`);
  for (const r of report.speedTable) {
    assert(r.easy.speedPxPerSec < r.normal.speedPxPerSec && r.normal.speedPxPerSec < r.hard.speedPxPerSec, `Invalid speed order on ${r.family}`);
    assert(r.easy.time300PxSec > r.normal.time300PxSec && r.normal.time300PxSec > r.hard.time300PxSec, `Invalid crossing time on ${r.family}`);
  }

  // 5. Measure live FPS benchmark in normal active scene
  report.fpsBenchmark = await evaluate(`new Promise((resolve) => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    s.begin(0);
    const w = s.world;
    w.setDifficulty('normal');
    w.devInvincible = true;
    w.introTime = 0;
    w.state = 'play';
    const frames = [];
    let last = performance.now();
    const tick = (now) => {
      frames.push(Math.min(50, now - last));
      last = now;
      w.step(1 / 60, { x: 0, y: 0, fire: true, special: false });
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

  assert.equal(runtimeErrors.length, 0, `Runtime errors detected: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('SONIC WINGS PROJECTILE VERIFICATION:', JSON.stringify(report, null, 2));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill('SIGKILL'); } catch {}
  try { await devServer?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
