import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/tide-arch-definitive');
mkdirSync(shotDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-tide-arch-definitive-'));

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
  textureAudit: {},
  moments: {},
  power1All10CannonsByDifficulty: {},
  power1HighAndPortrait: {},
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
      target = (await (await fetch('http://127.0.0.1:9238/json')).json()).find((t) => t.type === 'page');
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
      return !!(s && s.textures && s.textures.exists('pelagic-tide-arch-bridge') && s.textures.exists('pelagic-tide-arch-cliffs') && s.screen !== 'loading');
    })()`);
    if (ready) break;
    await sleep(100);
  }
  assert.equal(ready, true, 'ArcadeScene must boot and preload Tide Arch textures');

  // Helper in page context to drive REAL Power 1 combat cleanly through Chromium Phaser scene (with real world.contact!)
  await evaluate(`(() => {
    window.__TIDE_HELPER__ = {
      startAtArch(s, diff, powerLevel = 1, usePortrait = false) {
        s.audio.setMix(0, 0, true);
        s.begin(0);
        const w = s.world;
        w.setDifficulty(diff);
        if (usePortrait) {
          w.setArenaBounds({ left: 0, right: 384, top: 34, bottom: 654 });
        }
        w.accessibility = true;
        w.devInvincible = false;
        w.introTime = 0;
        w.state = 'play';
        w.route = 147.8;
        w.scroll = 147.8 * 38;
        w.waveIndex = w.mission.encounters.findIndex(e => e.at >= 148);
        w.supplyIndex = 999;
        w.weapons.weaponLevel = powerLevel;
        w.weapons.specialCharges = 0;
        window.__cannonLog = new Map();
      },
      stepRealCombatFrame(s) {
        const w = s.world;
        w.player.invulnerable = 999; // keep run deterministic while using REAL primary weapons (zero DEV enemy damage!)
        const minSafe = (w.tideArch.isInBridgeBand(w.scroll, w.player.y + 12) || w.tideArch.isInBridgeBand(w.scroll, w.player.y - 18))
          ? w.arena.left + (w.arenaWidth >= 500 ? Math.round(w.arenaWidth * 0.215) : w.arenaWidth >= 440 ? Math.round(w.arenaWidth * 0.185) : Math.round(w.arenaWidth * 0.215)) + 11
          : w.arena.left + 20;
        const maxSafe = (w.tideArch.isInBridgeBand(w.scroll, w.player.y + 12) || w.tideArch.isInBridgeBand(w.scroll, w.player.y - 18))
          ? w.arena.right - (w.arenaWidth >= 500 ? Math.round(w.arenaWidth * 0.215) : w.arenaWidth >= 440 ? Math.round(w.arenaWidth * 0.185) : Math.round(w.arenaWidth * 0.215)) - 11
          : w.arena.right - 20;
        const cannons = w.enemies.filter(e => e.hp > 0 && e.navigation?.customAnchor);
        for (const c of cannons) {
          if (!window.__cannonLog.has(c.id)) {
            window.__cannonLog.set(c.id, {
              id: c.id,
              side: c.archSide,
              x: Math.round(c.x),
              maxHp: c.maxHp,
              minHp: c.hp,
              damaged: false,
              destroyed: false,
              firedWhileAlive: false,
              firedAfterDestroy: false,
              wreckSeen: false,
              respawned: false,
            });
          } else {
            const rec = window.__cannonLog.get(c.id);
            if (rec.destroyed) rec.respawned = true;
            if (c.hp < rec.minHp) rec.minHp = c.hp;
            if (c.hp < c.maxHp) rec.damaged = true;
          }
        }
        const destroyedIds = new Set([...window.__cannonLog.values()].filter(r => r.destroyed).map(r => r.id));
        const target = cannons.filter(c => c.y > 0 && c.y < w.player.y - 18).sort((a, b) => b.y - a.y)[0];
        const tx = target ? Math.max(minSafe, Math.min(maxSafe, target.x)) : w.arenaCenterX;
        const dx = Math.max(-1, Math.min(1, (tx - w.player.x) / 5));
        const dy = Math.max(-1, Math.min(1, (w.playerHomeY - w.player.y) / 5));
        w.step(1 / 60, { x: dx, y: dy, fire: true, special: false, charge: false });
        for (const ev of w.events) {
          if (ev.type === 'enemy-shot') {
            for (const rec of window.__cannonLog.values()) {
              if (!destroyedIds.has(rec.id)) {
                const live = w.enemies.find(e => e.id === rec.id);
                if (live && Math.hypot(ev.x - live.x, ev.y - live.y) < 34) rec.firedWhileAlive = true;
              } else {
                const wk = w.wrecks.find(k => k.id === rec.id);
                if (wk && Math.hypot(ev.x - wk.x, ev.y - wk.y) < 12) rec.firedAfterDestroy = true;
              }
            }
          }
        }
        for (const wk of w.wrecks) {
          if (wk.customAnchor && window.__cannonLog.has(wk.id)) {
            const rec = window.__cannonLog.get(wk.id);
            rec.damaged = true;
            rec.minHp = 0;
            rec.destroyed = true;
            rec.wreckSeen = true;
          }
        }
        s.clock += 1 / 60;
        s.consumeEvents();
        s.backdrop.draw(s.clock, w, s.quality);
        s.renderWorld(1 / 60);
      }
    };
  })()`);

  // 1. Moment 1: Approach showing integrated natural rock platforms (no grey circular rings)
  const m1 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    window.__TIDE_HELPER__.startAtArch(s, 'normal', 1, false);
    for (let i = 0; i < 60 * 3.8; i++) {
      window.__TIDE_HELPER__.stepRealCombatFrame(s);
    }
    const ta = s.backdrop.tideArch;
    const platTex = s.textures.get('pelagic-tide-arch-rock-platforms')?.getSourceImage();
    const shTex = s.textures.get('pelagic-tide-arch-bridge-shadow')?.getSourceImage();
    let shadowMaxAlpha = 0;
    let shadowCornerAlpha = -1;
    if (shTex) {
      const d = shTex.getContext('2d').getImageData(0, 0, shTex.width, shTex.height).data;
      shadowCornerAlpha = d[3];
      for (let i = 3; i < d.length; i += 4) if (d[i] > shadowMaxAlpha) shadowMaxAlpha = d[i];
    }
    return {
      phase: s.world.tideArch.phase,
      hasRockPlatformsTex: !!platTex,
      hasShadowTex: !!shTex,
      shadowCornerAlpha,
      shadowMaxAlpha,
      waterfallsRemoved: ta.waterfalls === undefined && ta.padMountGfx === undefined && ta.archShadowGfx === undefined,
      visibleRockPlatforms: ta.rockPlatforms.filter(p => p.visible).length,
      cannonsSpawned: window.__cannonLog.size,
    };
  })()`);
  assert.equal(m1.phase, 'approach');
  assert.equal(m1.hasRockPlatformsTex, true);
  assert.equal(m1.hasShadowTex, true);
  assert.equal(m1.shadowCornerAlpha, 0, 'Silhouette shadow corners must be transparent');
  assert.ok(m1.shadowMaxAlpha > 15 && m1.shadowMaxAlpha <= 78, `Shadow peak alpha must remain soft & translucent (${m1.shadowMaxAlpha})`);
  assert.equal(m1.waterfallsRemoved, true);
  assert.ok(m1.visibleRockPlatforms >= 2);
  report.textureAudit = m1;
  await shot('01-approach-platforms');

  // 2. Moment 2: Track a specific cannon taking REAL Power 1 primary shot damage (e.g. second/third cannon cleanly framed on screen)
  const m2 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    let focusCannon = null;
    for (let i = 0; i < 60 * 16; i++) {
      window.__TIDE_HELPER__.stepRealCombatFrame(s);
      const hit = w.enemies.find(e => e.hp > 0 && e.hp < e.maxHp && e.navigation?.customAnchor && e.y >= 110 && e.y <= 320 && e.flash > 0);
      if (hit) {
        focusCannon = { id: hit.id, x: Math.round(hit.x), y: Math.round(hit.y), hp: hit.hp, maxHp: hit.maxHp, flash: hit.flash };
        window.__focusCannonId = hit.id;
        break;
      }
    }
    return {
      phase: w.tideArch.phase,
      weaponLevel: w.weapons.weaponLevel,
      focusCannon,
    };
  })()`);
  assert.ok(m2.focusCannon, 'A cliffside cannon must visibly take real Power 1 primary shot damage');
  assert.equal(m2.weaponLevel, 1);
  report.moments.cannonTakingDamage = m2;
  await shot('02-cannon-taking-primary-damage');

  // 3. Moment 3: Continue firing ONLY Power 1 primary shots until that exact cannon is destroyed and leaves wreck over the natural rock platform
  const m3 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    const focusId = window.__focusCannonId;
    let wreckSnap = null;
    for (let i = 0; i < 60 * 6; i++) {
      window.__TIDE_HELPER__.stepRealCombatFrame(s);
      const wk = w.wrecks.find(k => k.id === focusId);
      if (wk) {
        for (let j = 0; j < 10; j++) window.__TIDE_HELPER__.stepRealCombatFrame(s);
        const liveCheck = w.enemies.some(e => e.id === focusId);
        const updatedWk = w.wrecks.find(k => k.id === focusId);
        wreckSnap = {
          id: focusId,
          stillInEnemies: liveCheck,
          wreckX: Math.round(updatedWk.x),
          wreckY: Math.round(updatedWk.y),
          customAnchor: !!updatedWk.customAnchor,
          age: Number(updatedWk.age.toFixed(2)),
        };
        break;
      }
    }
    return wreckSnap;
  })()`);
  assert.ok(m3 && !m3.stillInEnemies && m3.customAnchor, 'Focused cannon must be destroyed by Power 1 primary shots and leave a persistent wreck');
  report.moments.cannonDestroyed = m3;
  await shot('03-cannon-destroyed-wreck');

  // 4. Moment 4: Before arch traversal — show bridge + natural silhouette cast shadow over the ocean without dark oval/rectangle
  const m4 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    for (let i = 0; i < 60 * 14; i++) {
      window.__TIDE_HELPER__.stepRealCombatFrame(s);
      const archY = w.tideArch.archScreenY(w.scroll);
      if (w.tideArch.phase === 'low-flight' && archY >= 145 && archY <= 215) break;
    }
    const ta = s.backdrop.tideArch;
    return {
      phase: w.tideArch.phase,
      altitude: Number(w.player.altitude.toFixed(3)),
      archY: Math.round(w.tideArch.archScreenY(w.scroll)),
      playerY: Math.round(w.player.y),
      bridgeVisible: ta.archBridge.visible,
      shadowImageVisible: !!ta.archShadowImage?.visible,
      shadowDepth: ta.archShadowImage?.depth,
    };
  })()`);
  assert.equal(m4.bridgeVisible, true);
  assert.equal(m4.shadowImageVisible, true);
  assert.equal(m4.shadowDepth, 1.18);
  report.moments.beforeArchShadow = m4;
  await shot('04-before-arch-shadow');

  // 5. Moment 5: Under arch traversal — bridge spans over RIVET (depth 18.90 > 16.4) with wingtip locator chevron & natural shadow
  const m5 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    for (let i = 0; i < 60 * 8; i++) {
      window.__TIDE_HELPER__.stepRealCombatFrame(s);
      if (w.tideArch.isInBridgeBand(w.scroll, w.player.y) && Math.abs(w.tideArch.archScreenY(w.scroll) - w.player.y) <= 14) break;
    }
    const ta = s.backdrop.tideArch;
    return {
      phase: w.tideArch.phase,
      altitude: Number(w.player.altitude.toFixed(3)),
      playerDepth: s.player.depth,
      bridgeDepth: ta.archBridge.depth,
      inBridgeBand: w.tideArch.isInBridgeBand(w.scroll, w.player.y),
      beaconVisible: ta.rivetBeaconGfx.visible,
      shadowVisible: !!ta.archShadowImage?.visible,
    };
  })()`);
  assert.equal(m5.inBridgeBand, true);
  assert.ok(m5.playerDepth < m5.bridgeDepth, 'RIVET must render strictly beneath overhead stone arch during under-arch traversal');
  assert.equal(m5.beaconVisible, true);
  report.moments.underArchTraversal = m5;
  await shot('05-under-arch-traversal');

  // 6. Live RAF 60 FPS benchmark during scrolling + continue to ascent & finish normal Power 1 10-cannon audit
  report.fpsBenchmark = await evaluate(`new Promise((resolve) => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const frames = [];
    let last = performance.now();
    const tick = (now) => {
      const dtMs = Math.min(50, now - last);
      last = now;
      frames.push(dtMs);
      window.__TIDE_HELPER__.stepRealCombatFrame(s);
      if (frames.length >= 90) {
        const avgMs = frames.slice(5).reduce((a, b) => a + b, 0) / Math.max(1, frames.length - 5);
        resolve({ samples: frames.length, avgFrameMs: Number(avgMs.toFixed(2)), avgFps: Number((1000 / Math.max(1, avgMs)).toFixed(1)) });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })`);

  const m6 = await evaluate(`(() => {
    const s = window.__GAME__.scene.getScene('ArcadeScene');
    const w = s.world;
    for (let i = 0; i < 60 * 18 && w.tideArch.phase !== 'complete'; i++) {
      window.__TIDE_HELPER__.stepRealCombatFrame(s);
      if (w.tideArch.phase === 'ascent' && w.tideArch.altitude >= 0.72) break;
    }
    return {
      phase: w.tideArch.phase,
      crossedArch: w.tideArch.crossedArch,
      altitude: Number(w.player.altitude.toFixed(3)),
    };
  })()`);
  assert.equal(m6.crossedArch, true);
  report.moments.ascent = m6;
  await shot('06-after-arch-ascent');

  // Finish stepping Normal Power 1 to checkpoint/complete and inspect all 10 cannons, then run Easy, Hard, Power 5, and Portrait
  const finishAndAudit = async (diff, powerLevel, usePortrait) => {
    const res = await evaluate(`(() => {
      const s = window.__GAME__.scene.getScene('ArcadeScene');
      window.__TIDE_HELPER__.startAtArch(s, '${diff}', ${powerLevel}, ${usePortrait});
      for (let i = 0; i < 60 * 48 && s.world.tideArch.phase !== 'complete'; i++) {
        window.__TIDE_HELPER__.stepRealCombatFrame(s);
      }
      const list = [...window.__cannonLog.values()];
      return {
        difficulty: '${diff}',
        powerLevel: ${powerLevel},
        layout: ${usePortrait} ? 'portrait' : 'pc',
        phase: s.world.tideArch.phase,
        crossedArch: s.world.tideArch.crossedArch,
        altitudeRestored: s.world.tideArch.altitudeRestored,
        totalSpawned: list.length,
        damagedCount: list.filter(c => c.damaged).length,
        destroyedCount: list.filter(c => c.destroyed).length,
        wreckCount: list.filter(c => c.wreckSeen).length,
        respawnCount: list.filter(c => c.respawned).length,
        firedAfterDestroyCount: list.filter(c => c.firedAfterDestroy).length,
        cannons: list,
      };
    })()`);
    assert.equal(res.totalSpawned, 10, `Expected 10 cannons in ${diff}/P${powerLevel}`);
    assert.equal(res.damagedCount, 10, `Expected all 10 cannons damaged in ${diff}/P${powerLevel}`);
    assert.equal(res.destroyedCount, 10, `Expected all 10 cannons destroyed in ${diff}/P${powerLevel}`);
    assert.equal(res.wreckCount, 10, `Expected 10 cannon wrecks in ${diff}/P${powerLevel}`);
    assert.equal(res.respawnCount, 0, `Expected 0 respawned cannons in ${diff}/P${powerLevel}`);
    assert.equal(res.firedAfterDestroyCount, 0, `Expected 0 post-destruction shots in ${diff}/P${powerLevel}`);
    assert.equal(res.crossedArch, true);
    assert.equal(res.altitudeRestored, true);
    return res;
  };

  report.power1All10CannonsByDifficulty.easy = await finishAndAudit('easy', 1, false);
  report.power1All10CannonsByDifficulty.normal = await finishAndAudit('normal', 1, false);
  report.power1All10CannonsByDifficulty.hard = await finishAndAudit('hard', 1, false);
  report.power1HighAndPortrait.power5Normal = await finishAndAudit('normal', 5, false);
  report.power1HighAndPortrait.portraitPower1Normal = await finishAndAudit('normal', 1, true);

  assert.equal(runtimeErrors.length, 0, `Expected 0 runtime errors, got: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('DEFINITIVE TIDE ARCH REPORT:', JSON.stringify(report, null, 2));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill('SIGKILL'); } catch {}
  try { await devServer?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
