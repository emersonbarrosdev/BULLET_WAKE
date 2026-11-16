import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const shotDir = resolve('docs/screenshots/menu-rework-v1');
mkdirSync(shotDir, { recursive: true });
const frameDir = join(shotDir, 'frames');
mkdirSync(frameDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-menu-rework-'));
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
};

let server;
let devServer;
let chrome;
let socket;
const runtimeErrors = [];
const report = {
  previewBootCheck: {},
  sequenceTransitions: [],
  whiteFlashCheck: { checkedFrames: 0, maxWhitePixels: 0 },
  loadingFrameChecks: [],
  staticSkyCheck: {},
  menuLayoutCheck: {},
  controlsTabsCheck: {},
  responsiveViewports: {},
  mobilePortraitCheck: {},
  skipCheck: {},
  gamepadMockCheck: {},
  screenshots: {},
  errors: runtimeErrors,
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

try {
  await spawnBuild();

  server = createServer((req, res) => {
    const cleanPath = (req.url ?? '/').split('?')[0];
    const rel = cleanPath === '/' ? 'index.html' : cleanPath.slice(1);
    const filePath = resolve('dist', rel);
    if (!existsSync(filePath)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': mime[extname(filePath)] ?? 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });
  await new Promise((r) => server.listen(4179, '127.0.0.1', r));

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
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=9225',
      '--remote-allow-origins=*',
      '--no-first-run',
      '--autoplay-policy=no-user-gesture-required',
      '--user-data-dir=' + profile,
      'about:blank',
    ],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
  );

  let target;
  for (let i = 0; i < 160; i++) {
    try {
      target = (await (await fetch('http://127.0.0.1:9225/json')).json()).find((t) => t.type === 'page');
    } catch { }
    if (target) break;
    await sleep(150);
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
  const analyzePng = async (base64Png) => {
    return evaluate(`(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + ${JSON.stringify(base64Png)};
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 64; c.height = 36;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 64, 36);
      const d = ctx.getImageData(0, 0, 64, 36).data;
      let bright = 0, skyTop = 0, nearWhite = 0;
      for (let y = 0; y < 36; y++) {
        for (let x = 0; x < 64; x++) {
          const i = (y * 64 + x) * 4;
          const r = d[i], g = d[i+1], b = d[i+2];
          if (r > 240 && g > 240 && b > 240) nearWhite++;
          if (y < 10 && r < 155 && g > 80 && b > 185) skyTop++;
          if (r + g + b > 260) bright++;
        }
      }
      return { total: 64 * 36, nearWhite, skyTop, bright };
    })()`);
  };
  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(shotDir, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    report.screenshots[name] = file;
    return data;
  };
  const setViewport = async (width, height, mobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await sleep(220);
  };
  const clickWorld = async (wx, wy) => {
    const pt = await evaluate(`(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      return { x: r.left + (${wx} / 768) * r.width, y: r.top + (${wy} / 432) * r.height };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: pt.x, y: pt.y });
    await sleep(60);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: pt.x, y: pt.y });
  };
  const key = async (code, keyName = code, vk = 0) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName, windowsVirtualKeyCode: vk });
    await sleep(70);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: vk });
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await setViewport(1366, 768, false);

  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => {
      window.__BW_POLL = () => {
        const bg = getComputedStyle(document.documentElement).backgroundColor;
        const bodyBg = document.body ? getComputedStyle(document.body).backgroundColor : bg;
        const root = document.getElementById('bw-boot-loading');
        const frame = document.querySelector('.bw-boot-frame');
        const pct = document.getElementById('bw-boot-pct')?.textContent || '';
        const rot = document.getElementById('rotate-hint');
        const rotDisplay = rot ? getComputedStyle(rot).display : 'none';
        return {
          t: performance.now(),
          bg, bodyBg,
          loadingVisible: root ? !root.classList.contains('bw-hidden') && getComputedStyle(root).opacity !== '0' && getComputedStyle(root).display !== 'none' : false,
          loadingRect: root ? root.getBoundingClientRect().toJSON() : null,
          frameRect: frame ? frame.getBoundingClientRect().toJSON() : null,
          pct,
          rotDisplay,
        };
      };
    })()`,
  });

  // ---- TIER A: PRODUCTION BUILD (preview) BOOT & FULL OPENING VISUAL VERIFICATION ----
  await send('Page.navigate', { url: 'http://127.0.0.1:4179/' });
  let previewSkySteps = 0;
  let previewSawLoading = false;
  let previewSawMenu = false;
  for (let i = 0; i < 42; i++) {
    const dom = await evaluate('window.__BW_POLL()');
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const px = await analyzePng(data);
    report.whiteFlashCheck.checkedFrames++;
    if (px.nearWhite > report.whiteFlashCheck.maxWhitePixels) report.whiteFlashCheck.maxWhitePixels = px.nearWhite;
    assert.notEqual(dom.bg, 'rgb(255, 255, 255)', `White html background in preview frame ${i}`);
    assert.notEqual(dom.bodyBg, 'rgb(255, 255, 255)', `White body background in preview frame ${i}`);
    assert.equal(dom.rotDisplay, 'none', `Desktop rotate-hint showed in preview frame ${i}`);
    if (dom.loadingVisible) {
      previewSawLoading = true;
      assert.equal(px.skyTop, 0, `Premature sky leaked behind loading overlay at preview step ${i}`);
    }
    if (px.skyTop > 120) previewSkySteps++;
    if (i > 20 && px.skyTop > 160 && !dom.loadingVisible) {
      previewSawMenu = true;
      await shot('18-preview-prod-main-menu');
      break;
    }
    await sleep(140);
  }
  report.previewBootCheck = { previewSawLoading, previewSawMenu, maxWhitePixelsDuringBoot: report.whiteFlashCheck.maxWhitePixels };
  assert.ok(previewSawLoading && previewSawMenu, 'Production preview must boot through loading and reach MAIN_MENU cleanly');

  // ---- TIER B: VITE DEV FULL STATE SEQUENCE, LAYOUT, TABS, CORRIDORS, RESPONSIVE ----
  await send('Page.navigate', { url: devUrl });
  let sawLoadingEarly = false;
  let sawLoadingMid = false;
  let sawLoadingFull = false;
  let sawSplash = false;
  let reachedMainMenu = false;

  for (let step = 0; step < 95; step++) {
    const info = await evaluate(`(() => {
      const dom = window.__BW_POLL();
      const sc = window.__GAME__?.scene?.getScene?.('ArcadeScene');
      const sceneState = sc ? {
        screen: sc.screen,
        openingState: sc.openingState,
        openingHistory: [...sc.openingHistory],
        logoVisible: !!sc.logo?.visible,
        heroVisible: !!sc.hero?.visible,
        skyVisible: !!sc.backdrop?.menuSky?.visible,
        introWashVisible: !!sc.introWash?.visible,
        introTitleVisible: !!sc.introTitle?.visible,
      } : null;
      return { dom, sceneState };
    })()`);

    assert.notEqual(info.dom.bg, 'rgb(255, 255, 255)', `White html background at step ${step}`);
    assert.notEqual(info.dom.bodyBg, 'rgb(255, 255, 255)', `White body background at step ${step}`);
    assert.equal(info.dom.rotDisplay, 'none', `Desktop rotate-hint appeared at dev step ${step}`);

    const snapFrame = async (tag) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const px = await analyzePng(data);
      const outPath = join(shotDir, `${tag}.png`);
      writeFileSync(outPath, Buffer.from(data, 'base64'));
      report.screenshots[tag] = outPath;
      return px;
    };

    if (info.dom.loadingVisible && info.dom.frameRect) {
      report.loadingFrameChecks.push({
        pct: info.dom.pct,
        frameW: Math.round(info.dom.frameRect.width),
        frameH: Math.round(info.dom.frameRect.height),
        overlayW: Math.round(info.dom.loadingRect.width),
        overlayH: Math.round(info.dom.loadingRect.height),
      });
      assert.equal(Math.round(info.dom.loadingRect.width), 1366, 'Loading overlay must cover full viewport width');
      assert.equal(Math.round(info.dom.loadingRect.height), 768, 'Loading overlay must cover full viewport height');
      const pctNum = parseInt(info.dom.pct || '0', 10);
      if (!sawLoadingEarly) {
        sawLoadingEarly = true;
        const px = await snapFrame('01-loading-early');
        assert.equal(px.skyTop, 0, 'Premature sky visible during early loading');
      } else if (!sawLoadingMid && pctNum >= 35 && pctNum < 90) {
        sawLoadingMid = true;
        const px = await snapFrame('02-loading-mid');
        assert.equal(px.skyTop, 0, 'Premature sky visible during mid loading');
      } else if (!sawLoadingFull && pctNum >= 90) {
        sawLoadingFull = true;
        const px = await snapFrame('03-loading-full');
        assert.equal(px.skyTop, 0, 'Premature sky visible during 100% loading');
      }
    }

    if (info.sceneState) {
      report.sequenceTransitions = info.sceneState.openingHistory;
      const st = info.sceneState.openingState;
      if (st === 'LOADING' || st === 'STUDIO_SPLASH') {
        assert.equal(info.sceneState.logoVisible, false, `Premature logo during ${st} at step ${step}`);
        assert.equal(info.sceneState.heroVisible, false, `Hero must stay hidden during ${st}`);
        assert.equal(info.sceneState.skyVisible, false, `Premature sky visible during ${st} at step ${step}`);
      }
      if (st === 'STUDIO_SPLASH' && info.sceneState.introTitleVisible && !sawSplash) {
        sawSplash = true;
        const px = await snapFrame('04-botan-studio');
        assert.equal(px.skyTop, 0, 'Sky pixels appeared behind BOTAN STUDIO splash');
      }
      if (st === 'MAIN_MENU' && !reachedMainMenu) {
        reachedMainMenu = true;
        await snapFrame('05-transition-to-menu');
        await sleep(500);
        await shot('06-main-menu-1366x768');
        break;
      }
    }
    await sleep(65);
  }

  assert.deepEqual(report.sequenceTransitions, ['LOADING', 'STUDIO_SPLASH', 'MAIN_MENU']);
  assert.ok(sawSplash, 'Must capture BOTAN STUDIO APRESENTA state before MAIN_MENU');
  assert.ok(report.loadingFrameChecks.length >= 2, 'Must observe fixed-frame loading samples');
  const firstW = report.loadingFrameChecks[0].frameW;
  const firstH = report.loadingFrameChecks[0].frameH;
  for (const c of report.loadingFrameChecks) {
    assert.equal(c.frameW, firstW, `Loading frame width drifted from ${firstW} to ${c.frameW}`);
    assert.equal(c.frameH, firstH, `Loading frame height drifted from ${firstH} to ${c.frameH}`);
  }

  const frameStats = await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    return {
      screen: sc.screen,
      openingState: sc.openingState,
      heroVisible: sc.hero.visible,
      logoVisible: sc.logo.visible,
      logoBounds: { x: sc.logo.x, y: sc.logo.y, w: sc.logo.displayWidth, h: sc.logo.displayHeight },
      buttons: sc.buttons.map(b => ({ label: b.node.text, x: b.node.x, y: b.node.y })),
      planes: sc.menuPlanes.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), visible: p.visible })),
      skyStatic: !!sc.backdrop.menuSky?.visible && !('tilePositionX' in sc.backdrop.menuSky),
    };
  })()`);
  report.menuLayoutCheck = frameStats;
  assert.equal(frameStats.heroVisible, false, 'Large RIVET hero ship must stay removed from MAIN_MENU');
  assert.equal(frameStats.skyStatic, true, 'Menu sky backdrop must remain static Image without scrolling');
  assert.deepEqual(
    frameStats.buttons.map((b) => b.label),
    ['INICIAR JORNADA', 'CONTROLES', 'OPÇÕES'],
  );

  // Verify sky static & planes animate over 1.6s
  const shotT0 = await shot('07-menu-planes-t0');
  const planesT0 = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').menuPlanes.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))`);
  await sleep(1600);
  const shotT2 = await shot('08-menu-planes-t2s');
  const planesT2 = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').menuPlanes.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))`);
  const moved = planesT0.some((p, idx) => Math.abs(p.x - planesT2[idx].x) > 8 || Math.abs(p.y - planesT2[idx].y) > 4);
  const skyStable = await evaluate(`(async () => {
    const load = async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = 768; c.height = 432;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, 768, 432);
      return ctx.getImageData(18, 10, 90, 32).data; // static top-left clear blue sky strip above flyby corridor (y=76..168)
    };
    const a = await load(${JSON.stringify(shotT0)}), b = await load(${JSON.stringify(shotT2)});
    let diff = 0; for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2]);
    return { avgPixelDiff: Number((diff / (a.length / 4 * 3)).toFixed(3)) };
  })()`);
  assert.ok(moved, 'Decorative aircraft in menu must animate');
  assert.ok(skyStable.avgPixelDiff < 1.5, `Menu sky must remain static across 1.6s: avgPixelDiff=${skyStable.avgPixelDiff}`);
  report.staticSkyCheck = { moved, ...skyStable, planesT0, planesT2 };

  // CONTROLES -> PC -> CONTROLE (PS5 DualSense) -> ANDROID -> DualSense hot-plug mock -> VOLTAR
  await clickWorld(384, 306);
  await sleep(320);
  await shot('09-controls-pc');
  const pcInfo = await evaluate(`(() => {
    const sc = window.__GAME__.scene.getScene('ArcadeScene');
    return { screen: sc.screen, tab: sc.controlsTab };
  })()`);
  assert.equal(pcInfo.screen, 'controls');
  assert.equal(pcInfo.tab, 'pc');

  await clickWorld(384, 80); // CONTROLE tab
  await sleep(320);
  await shot('10-controls-ps5-dualsense');
  const padTab = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').controlsTab`);
  assert.equal(padTab, 'gamepad');

  await clickWorld(544, 80); // ANDROID tab
  await sleep(320);
  await shot('11-controls-android');
  const androidTab = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').controlsTab`);
  assert.equal(androidTab, 'android');

  // Hotkey 1 -> PC
  await key('Digit1', '1', 49);
  await sleep(200);
  assert.equal(await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').controlsTab`), 'pc');

  // Dynamic DualSense hotplug mock
  await evaluate(`(() => {
    navigator.getGamepads = () => [{
      index: 0, connected: true, mapping: 'standard',
      id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)',
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      axes: [0, 0, 0, 0], timestamp: performance.now()
    }];
  })()`);
  await sleep(320);
  const autoSwitchedTab = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').controlsTab`);
  assert.equal(autoSwitchedTab, 'gamepad', 'DualSense connection must dynamically select CONTROLE tab');
  report.gamepadMockCheck = { autoSwitchedTab };
  await evaluate(`navigator.getGamepads = () => [];`);
  report.controlsTabsCheck = { pcInfo, padTab, androidTab };

  // Return to menu -> OPÇÕES -> VOLTAR -> INICIAR JORNADA (pilot) -> VOLTAR
  await clickWorld(384, 372);
  await sleep(250);
  assert.equal(await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').screen`), 'title');
  await clickWorld(384, 348);
  await sleep(300);
  await shot('12-options');
  await key('Escape', 'Escape', 27);
  await sleep(250);
  await clickWorld(384, 264);
  await sleep(300);
  await shot('13-pilot');
  await key('Escape', 'Escape', 27);
  await sleep(250);

  // Responsive viewports
  for (const [w, h, tag] of [
    [1920, 1080, '14-main-menu-1920x1080'],
    [1280, 720, '15-main-menu-1280x720'],
    [854, 480, '16-main-menu-854x480'],
  ]) {
    await setViewport(w, h, false);
    const rect = await evaluate(`(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(document.body).backgroundColor };
    })()`);
    report.responsiveViewports[`${w}x${h}`] = rect;
    assert.ok(rect.w <= w && rect.h <= h && rect.w > 300, `Canvas out of bounds on ${w}x${h}: ${JSON.stringify(rect)}`);
    await shot(tag);
  }

  // Narrow desktop window portrait -> rotate-hint stays HIDDEN
  await setViewport(600, 900, false);
  const narrowDesktopRot = await evaluate(`getComputedStyle(document.getElementById('rotate-hint')).display`);
  assert.equal(narrowDesktopRot, 'none', 'Narrow desktop window must never trigger mobile rotate-hint');

  // Mobile coarse portrait -> custom dark-navy #rotate-hint visible
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    screenOrientation: { type: 'portraitPrimary', angle: 0 },
  });
  await sleep(350);
  const mobileStyle = await evaluate(`(() => {
    const el = document.getElementById('rotate-hint');
    const st = getComputedStyle(el);
    return { display: st.display, bg: st.backgroundColor, coarse: matchMedia('(pointer: coarse)').matches };
  })()`);
  report.mobilePortraitCheck = mobileStyle;
  await shot('17-mobile-portrait-menu');
  assert.equal(mobileStyle.display, 'none', 'Mobile portrait must not block opening/menus with rotate-hint (Stage 1 UP & menus support portrait)');
  const landscapeGateDisplay = await evaluate(`(() => {
    document.body.dataset.requireLandscape = 'true';
    const d = getComputedStyle(document.getElementById('rotate-hint')).display;
    document.body.dataset.requireLandscape = 'false';
    return d;
  })()`);
  if (mobileStyle.coarse) {
    assert.equal(landscapeGateDisplay, 'flex', 'Mobile coarse portrait must display custom dark rotate prompt only when SIDE stage requires landscape');
  }

  // Controlled skip test during BOTAN STUDIO APRESENTA
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: devUrl });
  for (let i = 0; i < 45; i++) {
    const st = await evaluate(`window.__GAME__?.scene?.getScene?.('ArcadeScene')?.openingState ?? null`);
    if (st === 'STUDIO_SPLASH') {
      await sleep(500);
      await clickWorld(384, 216);
      await sleep(450);
      const afterSkip = await evaluate(`window.__GAME__.scene.getScene('ArcadeScene').openingState`);
      report.skipCheck = { skippedTo: afterSkip };
      assert.equal(afterSkip, 'MAIN_MENU', 'Controlled skip during STUDIO_SPLASH must advance cleanly to MAIN_MENU');
      break;
    }
    await sleep(120);
  }

  assert.equal(runtimeErrors.length, 0, `Runtime console/page errors detected: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(shotDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Opening & Menu Rework Browser Verification PASSED:', JSON.stringify(report, null, 2));
} finally {
  try { socket?.close(); } catch { }
  try { chrome?.kill(); } catch { }
  try { await devServer?.close(); } catch { }
  try { server?.close(); } catch { }
  try { rmSync(profile, { recursive: true, force: true }); } catch { }
}
