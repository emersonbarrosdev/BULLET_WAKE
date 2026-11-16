import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { createServer as createViteDevServer } from 'vite';

const outDir = resolve('docs/screenshots/startup-audit');
const videoDir = resolve('docs/videos');
mkdirSync(outDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'bw-boot-audit-'));
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
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

const probeInitScript = `(() => {
  const samples = [];
  window.__BW_BOOT_SAMPLES__ = samples;
  let running = true;
  window.__BW_STOP_BOOT_PROBE__ = () => { running = false; };
  const tick = () => {
    if (!running) return;
    const root = document.getElementById('bw-boot-loading');
    const frame = document.querySelector('.bw-boot-frame');
    const fill = document.getElementById('bw-boot-fill');
    const pct = document.getElementById('bw-boot-pct');
    const canvases = Array.from(document.querySelectorAll('#game canvas'));
    const cRect = canvases[0]?.getBoundingClientRect();
    const fRect = frame?.getBoundingClientRect();
    const rRect = root?.getBoundingClientRect();
    const rotate = document.getElementById('rotate-hint');
    const sc = window.__GAME__?.scene?.getScene?.('ArcadeScene');
    samples.push({
      t: Math.round(performance.now()),
      vw: window.innerWidth,
      vh: window.innerHeight,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      rotateDisplay: rotate ? getComputedStyle(rotate).display : 'missing',
      requireLandscape: document.body?.dataset?.requireLandscape ?? null,
      overlayPresent: !!root,
      overlayVisible: root ? (getComputedStyle(root).display !== 'none' && getComputedStyle(root).visibility !== 'hidden' && Number(getComputedStyle(root).opacity) > 0.05) : false,
      overlayRect: rRect ? { x: Math.round(rRect.left), y: Math.round(rRect.top), w: Math.round(rRect.width), h: Math.round(rRect.height) } : null,
      frameRect: fRect ? { w: Number(fRect.width.toFixed(2)), h: Number(fRect.height.toFixed(2)), x: Number(fRect.left.toFixed(1)), y: Number(fRect.top.toFixed(1)) } : null,
      fillWidthCss: fill ? fill.style.width : null,
      pctNum: pct ? Number((pct.textContent || '0').replace(/[^0-9.]/g, '')) : null,
      canvasCount: canvases.length,
      canvasRect: cRect ? { x: Math.round(cRect.left), y: Math.round(cRect.top), w: Math.round(cRect.width), h: Math.round(cRect.height) } : null,
      screen: sc?.screen ?? null,
      openingState: sc?.openingState ?? null,
      openingPhase: sc?.openingPhase ?? null,
      logoVisible: !!sc?.logo?.visible,
      skyVisible: !!sc?.backdrop?.menuSky?.visible,
      uiVisible: !!sc?.ui?.visible,
      buttonsCount: sc?.buttons?.length ?? 0,
      introTitleVisible: !!sc?.introTitle?.visible,
      loadErrors: sc?.loadErrors?.slice?.() ?? [],
    });
    if (samples.length < 3600) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

let server;
let devServer;
let chrome;
let socket;
const runtimeErrors = [];
const report = { scenarios: {}, screenshots: {}, video: null, errors: runtimeErrors };

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
  await new Promise((r) => server.listen(4181, '127.0.0.1', r));
  const prodUrl = 'http://127.0.0.1:4181/';

  devServer = await createViteDevServer({
    configFile: resolve('vite.config.ts'),
    mode: 'development',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await devServer.listen();
  const devAddr = devServer.httpServer.address();
  const devUrl = `http://127.0.0.1:${typeof devAddr === 'object' && devAddr ? devAddr.port : 5174}/`;

  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--remote-debugging-port=9226',
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
      target = (await (await fetch('http://127.0.0.1:9226/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (target) break;
    await sleep(150);
  }
  if (!target) throw new Error('Chrome CDP failed to launch on 9226');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });

  let seq = 0;
  const pending = new Map();
  let screencastFrames = [];
  let recordScreencast = false;
  let awaitNavReset = false;
  let fetchInterceptActive = false;

  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { resolve: res, reject: rej });
      socket.send(JSON.stringify({ id, method, params }));
    });

  socket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
    } else if (msg.method === 'Page.frameNavigated') {
      if (!msg.params?.frame?.parentId && awaitNavReset) {
        awaitNavReset = false;
        screencastFrames = [];
      }
    } else if (msg.method === 'Page.screencastFrame') {
      const { data, metadata, sessionId } = msg.params;
      if (recordScreencast) {
        screencastFrames.push({ t: metadata.timestamp ?? Date.now() / 1000, data });
      }
      void send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    } else if (msg.method === 'Fetch.requestPaused' && fetchInterceptActive) {
      const { requestId, request } = msg.params;
      if (/fonts\.(googleapis|gstatic)\.com/i.test(request.url)) {
        void send('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {});
      } else {
        void send('Fetch.continueRequest', { requestId }).catch(() => {});
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(msg.params.exceptionDetails);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const targetUrl = msg.params.entry.url ?? '';
      const text = msg.params.entry.text ?? '';
      if (!/fonts\.(googleapis|gstatic)/i.test(targetUrl + ' ' + text)) runtimeErrors.push(msg.params.entry);
    }
  };

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: probeInitScript });

  const inspectPngBase64 = async (b64) =>
    evaluate(`(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + ${JSON.stringify(b64)};
      await img.decode();
      const w = 96, h = 54;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      let nearWhite = 0, skyPixels = 0, centerGoldCyan = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r = d[i], g = d[i+1], b = d[i+2];
          if (r > 240 && g > 240 && b > 240) nearWhite++;
          if (y < 14 && r < 115 && g > 145 && b > 205) skyPixels++;
          if (x >= 26 && x <= 70 && y >= 14 && y <= 40 && (r > 180 || (g > 180 && b > 210))) centerGoldCyan++;
        }
      }
      return { total: w * h, nearWhite, skyPixels, centerGoldCyan };
    })()`);

  const saveShot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const file = join(outDir, `${name}.png`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    report.screenshots[name] = file;
    return data;
  };

  async function runScenario(name, url, opts = {}) {
    const {
      isDev = false,
      width = 1280,
      height = 720,
      mobile = false,
      touch = false,
      clearCache = true,
      throttle = null,
      blockFonts = false,
      reloadOnly = false,
      captureVideoAndStages = false,
      timeoutMs = 30000,
    } = opts;

    await send('Emulation.setTouchEmulationEnabled', touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile,
      screenOrientation: mobile && height > width ? { type: 'portraitPrimary', angle: 0 } : { type: 'landscapePrimary', angle: 90 },
    });
    if (clearCache) await send('Network.clearBrowserCache');
    if (throttle) {
      await send('Network.emulateNetworkConditions', throttle);
    } else {
      await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    }
    if (blockFonts) {
      fetchInterceptActive = true;
      await send('Fetch.enable', { patterns: [{ urlPattern: '*fonts*' }] });
    } else if (fetchInterceptActive) {
      fetchInterceptActive = false;
      await send('Fetch.disable');
    }

    if (!reloadOnly) {
      await send('Page.navigate', { url: 'data:text/html,<html style="background:%23040d21"></html>' });
      await sleep(120);
    }

    screencastFrames = [];
    awaitNavReset = !reloadOnly;
    recordScreencast = true;
    await send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: width, maxHeight: height });

    if (reloadOnly) {
      await evaluate('window.__BW_OLD_PAGE__ = true');
      await send('Page.reload', { ignoreCache: clearCache });
      while (await evaluate('Boolean(window.__BW_OLD_PAGE__)').catch(() => false)) {
        await sleep(20);
      }
    } else {
      await send('Page.navigate', { url });
    }

    const stageShots = {};
    const captureStageOnce = async (key) => {
      if (!captureVideoAndStages || stageShots[key]) return;
      stageShots[key] = await saveShot(`${name}-${key}`);
    };

    const startWall = Date.now();
    let settled = false;
    let sawOverlayDismissAt = null;
    while (Date.now() - startWall < timeoutMs) {
      const snap = await evaluate(`(() => {
        const sc = window.__GAME__?.scene?.getScene?.('ArcadeScene');
        const root = document.getElementById('bw-boot-loading');
        const overlayVisible = root ? (getComputedStyle(root).display !== 'none' && getComputedStyle(root).visibility !== 'hidden') : false;
        const pct = document.getElementById('bw-boot-pct')?.textContent ?? '';
        return {
          overlayVisible,
          pct,
          screen: sc?.screen ?? null,
          openingState: sc?.openingState ?? null,
          openingPhase: sc?.openingPhase ?? null,
          introClock: sc?.introClock ?? 0,
        };
      })()`);

      if (snap.overlayVisible) {
        const num = Number((snap.pct || '0').replace(/[^0-9]/g, ''));
        if (num >= 1 && num < 50) await captureStageOnce('01-loading-early');
        if (num >= 50 && num < 100) await captureStageOnce('02-loading-mid');
        if (num === 100 || snap.openingPhase === 'LOADING_COMPLETE') await captureStageOnce('03-loading-100');
      } else if (sawOverlayDismissAt === null) {
        sawOverlayDismissAt = Date.now();
      }

      if (isDev) {
        if (snap.openingPhase === 'STUDIO_SPLASH' && !snap.overlayVisible) {
          await captureStageOnce('04-studio-splash-first');
          if ((snap.introClock ?? 0) > 0.55) await captureStageOnce('05-studio-splash-peak');
        }
        if (snap.openingPhase === 'STUDIO_EXIT') await captureStageOnce('06-studio-exit');
        if (snap.openingPhase === 'TITLE_READY' || snap.openingState === 'MAIN_MENU') {
          await captureStageOnce('07-main-menu-first');
        }
        if (snap.openingPhase === 'TITLE_VISIBLE') {
          await captureStageOnce('08-main-menu-settled');
          settled = true;
          break;
        }
      } else {
        if (!snap.overlayVisible && sawOverlayDismissAt !== null) {
          const sinceDismissMs = Date.now() - sawOverlayDismissAt;
          if (sinceDismissMs > 450 && sinceDismissMs < 1800) await captureStageOnce('05-studio-splash-peak');
          if (sinceDismissMs > 3600) {
            await captureStageOnce('08-main-menu-settled');
            settled = true;
            break;
          }
        }
      }
      await sleep(30);
    }

    await send('Page.stopScreencast');
    recordScreencast = false;
    assert.ok(settled, `Scenario ${name} did not settle cleanly within timeout`);

    const telemetry = await evaluate(`(() => {
      window.__BW_STOP_BOOT_PROBE__?.();
      const sc = window.__GAME__?.scene?.getScene?.('ArcadeScene');
      return {
        samples: window.__BW_BOOT_SAMPLES__ || [],
        openingHistory: sc?.openingHistory ?? null,
        openingPhaseHistory: sc?.openingPhaseHistory ?? null,
        loadErrors: sc?.loadErrors ?? [],
        hasDevToolsHook: Boolean(window.__BULLET_WAKE_DEV__),
      };
    })()`);

    const { samples } = telemetry;
    assert.ok(samples.length >= 10, `${name}: expected >=10 RAF frames recorded`);

    let prevPct = -1;
    let baselineFrameSize = null;
    const loadingCanvasSizes = new Set();
    let maxCanvasCount = 0;
    let overlayDismissedT = null;
    const preMenuViolations = [];
    const rotateViolations = [];

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      maxCanvasCount = Math.max(maxCanvasCount, s.canvasCount);
      assert.ok(s.canvasCount <= 1, `${name}: duplicate canvas detected (${s.canvasCount})`);
      if (s.rotateDisplay !== 'none') rotateViolations.push({ i, t: s.t, phase: s.openingPhase, disp: s.rotateDisplay });

      if (s.overlayVisible) {
        assert.ok(s.overlayRect, `${name}: missing overlay rect while visible`);
        assert.ok(
          Math.abs(s.overlayRect.w - width) <= 1 && Math.abs(s.overlayRect.h - height) <= 1,
          `${name}: loading overlay not full viewport: ${JSON.stringify(s.overlayRect)} vs ${width}x${height}`,
        );
        if (s.frameRect) {
          if (!baselineFrameSize) baselineFrameSize = { w: s.frameRect.w, h: s.frameRect.h };
          assert.ok(
            Math.abs(s.frameRect.w - baselineFrameSize.w) <= 0.6 && Math.abs(s.frameRect.h - baselineFrameSize.h) <= 0.6,
            `${name}: loading bar frame shifted size mid-load from ${JSON.stringify(baselineFrameSize)} to ${JSON.stringify(s.frameRect)}`,
          );
        }
        if (typeof s.pctNum === 'number' && !Number.isNaN(s.pctNum)) {
          assert.ok(s.pctNum >= prevPct, `${name}: loading percentage moved backwards (${prevPct} -> ${s.pctNum})`);
          prevPct = s.pctNum;
        }
        if (s.canvasRect) loadingCanvasSizes.add(`${s.canvasRect.w}x${s.canvasRect.h}`);
      } else if (overlayDismissedT === null && i > 0) {
        overlayDismissedT = s.t;
        if (isDev) {
          assert.ok(
            s.openingPhase === 'STUDIO_SPLASH' || s.openingPhase === 'STUDIO_EXIT',
            `${name}: overlay dismissed on invalid phase ${s.openingPhase} instead of STUDIO_SPLASH`,
          );
        }
      }

      if (isDev && ['BOOT', 'LOADING', 'LOADING_COMPLETE', 'STUDIO_SPLASH'].includes(s.openingPhase)) {
        if (s.logoVisible || s.skyVisible || s.uiVisible || s.buttonsCount > 0) {
          preMenuViolations.push({ i, t: s.t, phase: s.openingPhase, logoVisible: s.logoVisible, skyVisible: s.skyVisible, uiVisible: s.uiVisible, buttonsCount: s.buttonsCount });
        }
      }
    }

    assert.equal(preMenuViolations.length, 0, `${name}: menu/logo/sky leak before TITLE_READY: ${JSON.stringify(preMenuViolations)}`);
    assert.equal(rotateViolations.length, 0, `${name}: rotate-hint leaked during boot/menu: ${JSON.stringify(rotateViolations)}`);
    assert.ok(loadingCanvasSizes.size <= 1, `${name}: canvas resized during loading! Sizes observed: ${Array.from(loadingCanvasSizes).join(', ')}`);

    if (isDev) {
      assert.deepEqual(telemetry.openingHistory, ['LOADING', 'STUDIO_SPLASH', 'MAIN_MENU'], `${name}: invalid openingHistory`);
      assert.equal(telemetry.openingPhaseHistory[0], 'BOOT');
      assert.ok(telemetry.openingPhaseHistory.indexOf('LOADING') < telemetry.openingPhaseHistory.indexOf('LOADING_COMPLETE'));
      assert.ok(telemetry.openingPhaseHistory.indexOf('LOADING_COMPLETE') < telemetry.openingPhaseHistory.indexOf('STUDIO_SPLASH'));
      assert.ok(telemetry.openingPhaseHistory.indexOf('STUDIO_SPLASH') < telemetry.openingPhaseHistory.indexOf('TITLE_READY'));
      assert.ok(telemetry.openingPhaseHistory.indexOf('TITLE_READY') < telemetry.openingPhaseHistory.indexOf('TITLE_VISIBLE'));
      assert.equal(telemetry.loadErrors.length, 0, `${name}: asset load errors: ${JSON.stringify(telemetry.loadErrors)}`);
    } else {
      assert.equal(telemetry.hasDevToolsHook, false, `${name}: production build must never expose DevTools hook`);
    }

    // Pixel-level compositor frame audit across ALL recorded screencast frames
    const frameChecks = [];
    for (let i = 0; i < screencastFrames.length; i++) {
      const px = await inspectPngBase64(screencastFrames[i].data);
      assert.ok(px.nearWhite < Math.round(px.total * 0.25), `${name}: blank white screen detected on frame #${i}: ${px.nearWhite}/${px.total}`);
      frameChecks.push({ t: screencastFrames[i].t, ...px });
    }

    // Ensure no menu sky or white flash leaks before MAIN_MENU reveal begins
    const bootStartIdx = reloadOnly ? Math.max(0, frameChecks.findIndex((f) => f.skyPixels === 0)) : 0;
    const postBootFrames = frameChecks.slice(bootStartIdx);
    const firstSkyFadeIdx = postBootFrames.findIndex((f) => f.skyPixels > 45);
    const firstSkyFullIdx = postBootFrames.findIndex((f) => f.skyPixels > 250);
    assert.ok(firstSkyFullIdx >= 0, `${name}: never saw main menu sunlit sky pixels in screencast`);
    const bootToMenuFadeMs = (postBootFrames[firstSkyFadeIdx].t - postBootFrames[0].t) * 1000;
    assert.ok(bootToMenuFadeMs >= 2200, `${name}: menu sky appeared too early (${Math.round(bootToMenuFadeMs)}ms), expected >=2200ms across LOADING + BOTAN STUDIO`);
    for (let i = 0; i < firstSkyFadeIdx; i++) {
      assert.ok(postBootFrames[i].nearWhite < Math.round(postBootFrames[i].total * 0.015), `${name}: pre-menu white flash frame #${i}: ${postBootFrames[i].nearWhite}/${postBootFrames[i].total}`);
    }

    if (captureVideoAndStages && isDev && screencastFrames.length >= 2) {
      const b64Frames = screencastFrames.map((f) => f.data);
      const webmB64 = await evaluate(`(async () => {
        const frames = ${JSON.stringify(b64Frames)};
        const imgs = [];
        for (const f of frames) {
          const im = new Image(); im.src = 'data:image/png;base64,' + f; await im.decode(); imgs.push(im);
        }
        const c = document.createElement('canvas'); c.width = 960; c.height = 540;
        const ctx = c.getContext('2d');
        const stream = c.captureStream(24);
        const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        const stopped = new Promise((r) => (rec.onstop = r));
        rec.start();
        for (const im of imgs) {
          ctx.drawImage(im, 0, 0, c.width, c.height);
          await new Promise((r) => setTimeout(r, 42));
        }
        await new Promise((r) => setTimeout(r, 250));
        rec.stop();
        await stopped;
        const blob = new Blob(chunks, { type: 'video/webm' });
        const buf = await blob.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      })()`);
      const videoPath = join(videoDir, 'startup-sequence.webm');
      writeFileSync(videoPath, Buffer.from(webmB64, 'base64'));
      report.video = videoPath;
    }

    report.scenarios[name] = {
      mode: isDev ? 'dev' : 'prod',
      viewport: `${width}x${height}`,
      mobile,
      samplesCount: samples.length,
      screencastCount: screencastFrames.length,
      firstSkyFrame: firstSkyFadeIdx,
      bootToMenuFadeMs: Math.round(bootToMenuFadeMs),
      maxWhitePixels: Math.max(0, ...frameChecks.map((f) => f.nearWhite)),
      loadingCanvasSizes: Array.from(loadingCanvasSizes),
      maxCanvasCount,
      baselineFrameSize,
      openingHistory: telemetry.openingHistory,
      openingPhaseHistory: telemetry.openingPhaseHistory,
      hasDevToolsHook: telemetry.hasDevToolsHook,
    };
  }

  // Production build matrix (no dev hooks, real built bundle)
  await runScenario('prod-clean-1280x720', prodUrl, { isDev: false, width: 1280, height: 720, clearCache: true, captureVideoAndStages: true });
  await runScenario('prod-warm-1366x768', prodUrl, { isDev: false, width: 1366, height: 768, clearCache: false });
  await runScenario('prod-1920x1080', prodUrl, { isDev: false, width: 1920, height: 1080, clearCache: false });
  await runScenario('prod-slow-net-1280x720', prodUrl, {
    isDev: false,
    width: 1280,
    height: 720,
    clearCache: true,
    timeoutMs: 60000,
    throttle: { offline: false, latency: 80, downloadThroughput: 2800 * 1024, uploadThroughput: 1024 * 1024 },
  });
  await runScenario('prod-blocked-fonts-1280x720', prodUrl, { isDev: false, width: 1280, height: 720, clearCache: true, blockFonts: true });
  await runScenario('android-portrait-1080x1920', prodUrl, { isDev: false, width: 1080, height: 1920, mobile: true, touch: true, clearCache: false });
  await saveShot('android-portrait-1080x1920-menu');
  await runScenario('android-portrait-720x1600', prodUrl, { isDev: false, width: 720, height: 1600, mobile: true, touch: true, clearCache: false });
  await runScenario('android-landscape-844x390', prodUrl, { isDev: false, width: 844, height: 390, mobile: true, touch: true, clearCache: false });

  // Dev server matrix (full internal Phaser state-machine + reload F5 + continuous WebM capture)
  await runScenario('dev-clean-1280x720', devUrl, { isDev: true, width: 1280, height: 720, clearCache: true, captureVideoAndStages: true });
  await runScenario('dev-reload-f5-1280x720', devUrl, { isDev: true, width: 1280, height: 720, clearCache: false, reloadOnly: true });

  assert.equal(runtimeErrors.length, 0, `Runtime console/page errors: ${JSON.stringify(runtimeErrors)}`);
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Task 23 Opening & Boot Frame-by-Frame Audit PASSED:\n', JSON.stringify(report, null, 2));
} finally {
  try { socket?.close(); } catch {}
  try { chrome?.kill(); } catch {}
  try { await devServer?.close(); } catch {}
  try { server?.close(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
