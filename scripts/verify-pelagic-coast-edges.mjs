import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer as createViteDevServer } from 'vite';

const auditOnly = process.argv.includes('--audit-only');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const out = resolve(outArg ? outArg.slice(6) : 'docs/screenshots/coast-edge-fix');
mkdirSync(out, { recursive: true });

const devServer = await createViteDevServer({
  configFile: resolve('vite.config.ts'),
  mode: 'development',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
await devServer.listen();
const addr = devServer.httpServer.address();
const devUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 5173}/`;

const profile = mkdtempSync(join(tmpdir(), 'bw-coast-audit-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--enable-webgl', '--ignore-gpu-blocklist',
  '--remote-debugging-port=0', '--remote-allow-origins=*', '--no-first-run',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;

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
  const waitFor = async (expr) => {
    for (let i = 0; i < 200; i++) { if (await evaluate(expr)) return; await sleep(100); }
    throw new Error('Timeout: ' + expr);
  };
  const settle = () => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: devUrl });
  await waitFor("window.__GAME__?.scene.isActive('ArcadeScene') && !!window.__GAME__.scene.getScene('ArcadeScene').ui");

  await evaluate(`
    window.s = window.__GAME__.scene.getScene('ArcadeScene');
    s.audio.setMix(0, 0, true); s.begin(0); s.scene.pause(); s.quality = 2;
    true;
  `);

  // Pixel-level audit of all 3 generated coast textures
  const audit = await evaluate(`(() => {
    function auditTex(key, alphaThresh, splitX) {
      const src = s.textures.get(key).getSourceImage();
      const W = src.width, H = src.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0);
      const d = ctx.getImageData(0, 0, W, H).data;

      // 1. Check split boundary (left strip right edge = splitX-1, right strip left edge = splitX)
      let splitLeftNonZero = 0, splitRightNonZero = 0;
      const splitRows = [];
      for (let y = 0; y < H; y++) {
        const aL = d[(y * W + splitX - 1) * 4 + 3];
        const aR = d[(y * W + splitX) * 4 + 3];
        if (aL > 4) splitLeftNonZero++;
        if (aR > 4) splitRightNonZero++;
        if (aL > 10 || aR > 10) {
          if (splitRows.length < 30) splitRows.push({ y, aL, aR });
        }
      }

      function findDetached(thresh) {
        const visited = new Uint8Array(W * H);
        const qx = new Int32Array(W * H);
        const qy = new Int32Array(W * H);
        const detached = [];
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            if (visited[idx] || d[idx * 4 + 3] < thresh) continue;
            let head = 0, tail = 0;
            qx[tail] = x; qy[tail] = y; tail++;
            visited[idx] = 1;
            let touchesBorder = false;
            let minX = x, maxX = x, minY = y, maxY = y, maxA = 0, sumR = 0, sumG = 0, sumB = 0;
            while (head < tail) {
              const cx = qx[head], cy = qy[head]; head++;
              if (cx <= 2 || cx >= W - 3) touchesBorder = true;
              if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
              if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
              const p = (cy * W + cx) * 4;
              if (d[p + 3] > maxA) maxA = d[p + 3];
              sumR += d[p]; sumG += d[p + 1]; sumB += d[p + 2];
              const nbs = [[cx - 1, cy], [cx + 1, cy], [cx, (cy - 1 + H) % H], [cx, (cy + 1) % H]];
              for (const [nx, ny] of nbs) {
                if (nx < 0 || nx >= W) continue;
                const ni = ny * W + nx;
                if (!visited[ni] && d[ni * 4 + 3] >= thresh) {
                  visited[ni] = 1;
                  qx[tail] = nx; qy[tail] = ny; tail++;
                }
              }
            }
            if (!touchesBorder) {
              detached.push({
                x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area: tail,
                maxA, avgR: Math.round(sumR / tail), avgG: Math.round(sumG / tail), avgB: Math.round(sumB / tail),
              });
            }
          }
        }
        detached.sort((a, b) => b.area - a.area);
        return detached;
      }

      const detached = findDetached(alphaThresh);
      const detachedHi = findDetached(80);

      // 4. Vertical wrap seam diff (row 0 vs row H-1)
      let seamDiffSum = 0, seamMaxDiff = 0;
      for (let x = 0; x < W; x++) {
        const p0 = x * 4, p1 = ((H - 1) * W + x) * 4;
        const diff = Math.abs(d[p0] - d[p1]) + Math.abs(d[p0 + 1] - d[p1 + 1]) + Math.abs(d[p0 + 2] - d[p1 + 2]) + Math.abs(d[p0 + 3] - d[p1 + 3]);
        seamDiffSum += diff;
        if (diff > seamMaxDiff) seamMaxDiff = diff;
      }

      return {
        key, W, H,
        splitLeftNonZero, splitRightNonZero, splitRowsSample: splitRows.slice(0, 10),
        detachedCount: detached.length, detachedTop: detached.slice(0, 20),
        detachedHiCount: detachedHi.length, detachedHiTop: detachedHi.slice(0, 25),
        seamAvgDiff: +(seamDiffSum / W).toFixed(2), seamMaxDiff,
      };
    }

    // Also check surf & shoal alignment against connected opaque coast
    function auditBandAlignment(texKey, maxDistHalf, minAlpha) {
      const coastSrc = s.textures.get('pelagic-connected-coast-v2').getSourceImage();
      const bandSrc = s.textures.get(texKey).getSourceImage();
      const c1 = document.createElement('canvas'); c1.width = coastSrc.width; c1.height = coastSrc.height;
      c1.getContext('2d').drawImage(coastSrc, 0, 0);
      const cd = c1.getContext('2d').getImageData(0, 0, coastSrc.width, coastSrc.height).data;
      const c2 = document.createElement('canvas'); c2.width = bandSrc.width; c2.height = bandSrc.height;
      c2.getContext('2d').drawImage(bandSrc, 0, 0);
      const sd = c2.getContext('2d').getImageData(0, 0, bandSrc.width, bandSrc.height).data;
      const W = bandSrc.width, H = bandSrc.height;
      let total = 0, orphan = 0;
      const samples = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const a = sd[(y * W + x) * 4 + 3];
          if (a < minAlpha) continue;
          total++;
          let hasOpaqueCoastNearby = false;
          for (let dy = -maxDistHalf; dy <= maxDistHalf && !hasOpaqueCoastNearby; dy += 2) {
            const cy = ((y + dy + H) % H) * 2;
            for (let dx = -maxDistHalf; dx <= maxDistHalf; dx += 2) {
              const cx = (x + dx) * 2;
              if (cx < 0 || cx >= coastSrc.width) continue;
              if (cd[(cy * coastSrc.width + cx) * 4 + 3] >= 240) { hasOpaqueCoastNearby = true; break; }
            }
          }
          if (!hasOpaqueCoastNearby) {
            orphan++;
            if (samples.length < 15) samples.push({ x, y, a });
          }
        }
      }
      return { total, orphan, samples };
    }

    return {
      coast: auditTex('pelagic-connected-coast-v2', 16, 332),
      shoal: auditTex('pelagic-coast-shoal-v1', 8, 166),
      surf: auditTex('pelagic-coast-surf-v1', 8, 166),
      surfAlignment: auditBandAlignment('pelagic-coast-surf-v1', 8, 16),
      shoalAlignment: auditBandAlignment('pelagic-coast-shoal-v1', 22, 16),
    };
  })()`);

  writeFileSync(join(out, 'audit.json'), JSON.stringify(audit, null, 2));
  console.log('=== COAST AUDIT SUMMARY ===');
  for (const name of ['coast', 'shoal', 'surf']) {
    const a = audit[name];
    console.log(`\n[${name}] ${a.W}x${a.H} | splitL=${a.splitLeftNonZero} splitR=${a.splitRightNonZero} | detached=${a.detachedCount} | detachedHi(a>=80)=${a.detachedHiCount} | seamAvg=${a.seamAvgDiff} seamMax=${a.seamMaxDiff}`);
    if (a.splitRowsSample.length) {
      console.log('  Split boundary hits (sample):', JSON.stringify(a.splitRowsSample.slice(0, 6)));
    }
    if (name === 'coast' && a.detachedHiTop.length) {
      console.log('  Top detachedHi (a>=80):');
      for (const c of a.detachedHiTop.slice(0, 12)) {
        console.log(`    pos=(${c.x},${c.y}) size=${c.w}x${c.h} area=${c.area} maxA=${c.maxA} rgb=(${c.avgR},${c.avgG},${c.avgB})`);
      }
    } else if (name === 'coast' && a.detachedTop.length) {
      console.log('  Top detached:');
      for (const c of a.detachedTop.slice(0, 8)) {
        console.log(`    pos=(${c.x},${c.y}) size=${c.w}x${c.h} area=${c.area} maxA=${c.maxA} rgb=(${c.avgR},${c.avgG},${c.avgB})`);
      }
    }
  }
  console.log('\n[surfAlignment]', JSON.stringify(audit.surfAlignment));
  console.log('[shoalAlignment]', JSON.stringify(audit.shoalAlignment));

  // Capture 10 screenshots covering the entire 2048px vertical scroll loop + both vertical wrap/panel seams
  const scrolls = [
    ['01-scroll-0-harbor', 0],
    ['02-scroll-256-cove', 256],
    ['03-scroll-512-lighthouse', 512],
    ['04-scroll-610-wrap-seam', 610],
    ['05-scroll-768-cafe', 768],
    ['06-scroll-1024-circus-headland', 1024],
    ['07-scroll-1280-skatepark-bay', 1280],
    ['08-scroll-1536-skatepark', 1536],
    ['09-scroll-1634-panel-seam', 1634],
    ['10-scroll-1792-tower', 1792],
  ];
  for (const [label, sc] of scrolls) {
    await evaluate(`
      s.world.state = 'play'; s.world.waveIndex = 999; s.world.supplyIndex = 999;
      s.world.route = 30; s.world.elapsed = 12; s.world.scroll = ${sc};
      s.world.enemies = []; s.world.cargo = []; s.world.events = [];
      s.world.bullets.forEach(b => b.active = false);
      s.backdrop.draw(s.clock, s.world, s.quality);
      s.renderWorld(0);
      s.player.setVisible(false);
      true;
    `);
    await settle();
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(out, `${label}.png`), Buffer.from(res.data, 'base64'));
  }

  // Also verify Portrait 384px mode at the Circus Headland (where left & right strips meet at COAST_SPLIT_X)
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate('window.__GAME__?.scale.refresh(); true');
  await settle();
  await evaluate(`
    s.world.scroll = 1024;
    s.backdrop.draw(s.clock, s.world, s.quality);
    s.renderWorld(0);
    s.player.setVisible(false);
    true;
  `);
  await settle();
  const portraitRes = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(out, '11-portrait-circus-1024.png'), Buffer.from(portraitRes.data, 'base64'));
  console.log('\nSaved 10 desktop full-loop + seam screenshots and 1 portrait screenshot to ' + out);

  if (!auditOnly) {
    assert.equal(audit.coast.splitLeftNonZero, 0, 'Left coast strip must not clip non-transparent pixels at split boundary');
    assert.equal(audit.coast.splitRightNonZero, 0, 'Right coast strip must not clip non-transparent pixels at split boundary');
    assert.equal(audit.shoal.splitLeftNonZero, 0, 'Left shoal strip must not clip at split boundary');
    assert.equal(audit.shoal.splitRightNonZero, 0, 'Right shoal strip must not clip at split boundary');
    assert.equal(audit.surf.splitLeftNonZero, 0, 'Left surf strip must not clip at split boundary');
    assert.equal(audit.surf.splitRightNonZero, 0, 'Right surf strip must not clip at split boundary');
    assert.equal(audit.coast.detachedCount, 0, 'Coast texture must have zero detached floating fragments');
    assert.equal(audit.coast.detachedHiCount, 0, 'Coast texture must have zero detached opaque fragments');
    assert.equal(audit.surfAlignment.orphan, 0, 'Coastal surf must only exist next to connected opaque coast');
    assert.equal(audit.shoalAlignment.orphan, 0, 'Coastal shoal must only exist next to connected opaque coast');
    console.log('\nALL COAST EDGE ASSERTIONS PASSED!');
  }
} finally {
  socket?.close();
  chrome.kill();
  await devServer.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
