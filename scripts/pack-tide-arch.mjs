/** Packs Arco das Marés cel-shaded stone arch bridge, cliff gun piers, and 4-frame waterfalls
 * from generated master plates into true-alpha RGBA PNG spritesheets in public/assets/arcade/pelagic-review/.
 * Usage: node scripts/pack-tide-arch.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const BRAIN = 'C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d';
const ARCH_SRC = join(BRAIN, 'coastal_arch_and_cliffs_spritesheet_1794833972080.jpg');
const WATERFALL_SRC = join(BRAIN, 'waterfall_spritesheet_1794833969979.jpg');
const OUT_DIR = resolve('public/assets/arcade/pelagic-review');
const PREVIEW_OUT = resolve('docs/screenshots/tide-arch-pack-preview.png');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(resolve('docs/screenshots'), { recursive: true });
assert(existsSync(ARCH_SRC), 'Missing arch/cliff master plate: ' + ARCH_SRC);
assert(existsSync(WATERFALL_SRC), 'Missing waterfall master plate: ' + WATERFALL_SRC);

const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><html><body></body></html>'); return; }
  if (path === '/arch.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(readFileSync(ARCH_SRC)); return; }
  if (path === '/waterfall.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(readFileSync(WATERFALL_SRC)); return; }
  res.writeHead(404).end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const profile = mkdtempSync(join(tmpdir(), 'bw-arch-pack-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-gpu',
  '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let socket;

try {
  let target;
  for (let i = 0; i < 90 && !target; i++) {
    try {
      const dbgPort = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      target = (await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json()).find(t => t.type === 'page');
    } catch { /* wait */ }
    if (!target) await sleep(120);
  }
  assert(target, 'Chrome target failed');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });

  let seq = 0;
  const pending = new Map();
  socket.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (!m.id) return;
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.error) p.reject(new Error(m.error.message));
    else p.resolve(m.result);
  };
  const cdp = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    pending.set(id, { resolve: res, reject: rej });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await cdp('Page.enable');
  await cdp('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });
  await sleep(300);

  const script = `
  (async () => {
    const loadImg = (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const archImg = await loadImg('/arch.jpg');
    const wfImg = await loadImg('/waterfall.jpg');

    function removeMagentaChroma(canvas) {
      const w = canvas.width, h = canvas.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const isMag = (i) => {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        // Pure or JPEG-compressed magenta surround (#FF00FF): red & blue bright, green much lower
        return (r > 135 && b > 135 && g < Math.min(r, b) - 52 && Math.abs(r - b) < 85);
      };
      const visited = new Uint8Array(w * h);
      const q = new Int32Array(w * h);
      let head = 0, tail = 0;
      for (let x = 0; x < w; x++) {
        for (const y of [0, h - 1]) {
          const p = y * w + x;
          if (!visited[p] && isMag(p * 4)) { visited[p] = 1; q[tail++] = p; }
        }
      }
      for (let y = 0; y < h; y++) {
        for (const x of [0, w - 1]) {
          const p = y * w + x;
          if (!visited[p] && isMag(p * 4)) { visited[p] = 1; q[tail++] = p; }
        }
      }
      // Also seed interior holes in the upper bridge canvas (arch hollow vault / gaps between palm fronds)
      while (head < tail) {
        const p = q[head++];
        const x = p % w, y = (p - x) / w;
        if (x > 0 && !visited[p - 1] && isMag((p - 1) * 4)) { visited[p - 1] = 1; q[tail++] = p - 1; }
        if (x + 1 < w && !visited[p + 1] && isMag((p + 1) * 4)) { visited[p + 1] = 1; q[tail++] = p + 1; }
        if (y > 0 && !visited[p - w] && isMag((p - w) * 4)) { visited[p - w] = 1; q[tail++] = p - w; }
        if (y + 1 < h && !visited[p + w] && isMag((p + w) * 4)) { visited[p + w] = 1; q[tail++] = p + w; }
      }
      // Interior enclosed pockets between vines/palms that are clearly magenta get cleared too
      for (let p = 0; p < w * h; p++) {
        const i = p * 4;
        if (visited[p] || (d[i] > 180 && d[i + 2] > 180 && d[i + 1] < 85)) {
          d[i + 3] = 0;
        }
      }
      // Edge despill (2px soft magenta fringe removal on boundary pixels adjacent to alpha=0)
      const alphaCopy = new Uint8Array(w * h);
      for (let p = 0; p < w * h; p++) alphaCopy[p] = d[p * 4 + 3];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p = y * w + x, i = p * 4;
          if (alphaCopy[p] === 0) continue;
          const border = !alphaCopy[p - 1] || !alphaCopy[p + 1] || !alphaCopy[p - w] || !alphaCopy[p + w];
          if (!border) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (r > g + 22 && b > g + 22) {
            const magStrength = Math.min(r, b) - g;
            d[i] = Math.max(0, Math.round(r - magStrength * 0.85));
            d[i + 2] = Math.max(0, Math.round(b - magStrength * 0.85));
            d[i + 3] = Math.max(40, Math.round(255 - magStrength * 1.1));
          }
        }
      }
      ctx.putImageData(img, 0, 0);
      return canvas;
    }

    function trimAndCenter(srcCanvas, sx, sy, sw, sh, outW, outH, padFrac = 0.04, anchorBottom = false) {
      const crop = document.createElement('canvas');
      crop.width = sw; crop.height = sh;
      crop.getContext('2d').drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
      removeMagentaChroma(crop);
      const ctx = crop.getContext('2d');
      const d = ctx.getImageData(0, 0, sw, sh).data;
      let minX = sw, minY = sh, maxX = -1, maxY = -1;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          if (d[(y * sw + x) * 4 + 3] > 20) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      const bw = Math.max(1, maxX - minX + 1), bh = Math.max(1, maxY - minY + 1);
      const out = document.createElement('canvas');
      out.width = outW; out.height = outH;
      const octx = out.getContext('2d');
      const maxW = outW * (1 - padFrac * 2), maxH = outH * (1 - padFrac * 2);
      const sc = Math.min(maxW / bw, maxH / bh);
      const dw = bw * sc, dh = bh * sc;
      const dx = (outW - dw) * 0.5;
      const dy = anchorBottom ? outH * (1 - padFrac) - dh : (outH - dh) * 0.5;
      octx.drawImage(crop, minX, minY, bw, bh, dx, dy, dw, dh);
      return out;
    }

    function extractComponents(srcImage) {
      const w = srcImage.width, h = srcImage.height;
      const tmp = document.createElement('canvas');
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext('2d', { willReadFrequently: true });
      tctx.drawImage(srcImage, 0, 0);
      removeMagentaChroma(tmp);
      const data = tctx.getImageData(0, 0, w, h).data;

      const compId = new Int32Array(w * h);
      const boxes = [];
      const queue = new Int32Array(w * h);
      let nextId = 1;
      for (let p = 0; p < w * h; p++) {
        if (compId[p] || data[p * 4 + 3] <= 20) continue;
        const id = nextId++;
        let head = 0, tail = 0;
        queue[tail++] = p;
        compId[p] = id;
        let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
        while (head < tail) {
          const cur = queue[head++];
          const x = cur % w, y = (cur - x) / w;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          count++;
          // Check 8-neighborhood within 2px radius to keep nearby hanging vine pixels with their parent island
          for (let dy = -2; dy <= 2; dy++) {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -2; dx <= 2; dx++) {
              const nx = x + dx;
              if (nx < 0 || nx >= w) continue;
              const np = ny * w + nx;
              if (!compId[np] && data[np * 4 + 3] > 20) {
                compId[np] = id;
                queue[tail++] = np;
              }
            }
          }
        }
        if (count > 1200) boxes.push({ id, minX, minY, maxX, maxY, count, cx: (minX + maxX) * 0.5, cy: (minY + maxY) * 0.5 });
      }

      const renderComponent = (comp, outW, outH, padFrac = 0.02) => {
        const bw = comp.maxX - comp.minX + 1, bh = comp.maxY - comp.minY + 1;
        const isolated = document.createElement('canvas');
        isolated.width = bw; isolated.height = bh;
        const ictx = isolated.getContext('2d');
        const outImg = ictx.createImageData(bw, bh);
        for (let y = 0; y < bh; y++) {
          for (let x = 0; x < bw; x++) {
            const sp = (comp.minY + y) * w + (comp.minX + x);
            if (compId[sp] === comp.id) {
              const di = (y * bw + x) * 4, si = sp * 4;
              outImg.data[di] = data[si];
              outImg.data[di + 1] = data[si + 1];
              outImg.data[di + 2] = data[si + 2];
              outImg.data[di + 3] = data[si + 3];
            }
          }
        }
        ictx.putImageData(outImg, 0, 0);
        const out = document.createElement('canvas');
        out.width = outW; out.height = outH;
        const octx = out.getContext('2d');
        const maxW = outW * (1 - padFrac * 2), maxH = outH * (1 - padFrac * 2);
        const sc = Math.min(maxW / bw, maxH / bh);
        const dw = bw * sc, dh = bh * sc;
        octx.drawImage(isolated, 0, 0, bw, bh, (outW - dw) * 0.5, (outH - dh) * 0.5, dw, dh);
        return out;
      };

      boxes.sort((a, b) => a.cy - b.cy);
      const bridgeComp = boxes[0];
      const lowerTwo = boxes.slice(1).sort((a, b) => a.cx - b.cx);
      return {
        bridge: renderComponent(bridgeComp, 1024, 420, 0.02),
        leftCliff: renderComponent(lowerTwo[0], 512, 512, 0.03),
        rightCliff: renderComponent(lowerTwo[1], 512, 512, 0.03),
      };
    }

    const { bridge, leftCliff, rightCliff } = extractComponents(archImg);

    // 2. Left & Right Cliff Piers -> 1024x512 (2 cells 512x512)
    const cliffs = document.createElement('canvas');
    cliffs.width = 1024; cliffs.height = 512;
    const cctx = cliffs.getContext('2d');
    cctx.drawImage(leftCliff, 0, 0);
    cctx.drawImage(rightCliff, 512, 0);

    // 3. 4-Frame Waterfall Cascade -> 512x256 (4 equal 128x256 frames)
    const wf = document.createElement('canvas');
    wf.width = 512; wf.height = 256;
    const wctx = wf.getContext('2d');
    const cellW = wfImg.width / 4;
    for (let i = 0; i < 4; i++) {
      const fCanvas = trimAndCenter(
        wfImg,
        Math.floor(i * cellW), 0, Math.floor(cellW), wfImg.height,
        128, 256, 0.03, true
      );
      wctx.drawImage(fCanvas, i * 128, 0);
    }

    // 4. Composite QA Preview on ocean blue checkerboard
    const prev = document.createElement('canvas');
    prev.width = 1024; prev.height = 960;
    const pctx = prev.getContext('2d');
    pctx.fillStyle = '#0e4e92'; pctx.fillRect(0, 0, 1024, 960);
    for (let gy = 0; gy < 960; gy += 32) {
      for (let gx = 0; gx < 1024; gx += 32) {
        if (((gx + gy) >> 5) & 1) { pctx.fillStyle = '#135ba4'; pctx.fillRect(gx, gy, 32, 32); }
      }
    }
    pctx.drawImage(bridge, 48, 12, 928, 380);
    pctx.drawImage(cliffs, 0, 0, 512, 512, 48, 405, 300, 300);
    pctx.drawImage(cliffs, 512, 0, 512, 512, 676, 405, 300, 300);
    for (let i = 0; i < 4; i++) {
      pctx.drawImage(wf, i * 128, 0, 128, 256, 40 + i * 240, 700, 128, 256);
    }

    return {
      bridge: bridge.toDataURL('image/png'),
      cliffs: cliffs.toDataURL('image/png'),
      waterfalls: wf.toDataURL('image/png'),
      preview: prev.toDataURL('image/png'),
    };
  })()`;

  const res = await cdp('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  const data = res.result.value;
  assert(data && data.bridge && data.cliffs && data.waterfalls, 'Packing failed to return data URLs');
  const writeDataUrl = (url, filePath) => writeFileSync(filePath, Buffer.from(url.split(',')[1], 'base64'));
  writeDataUrl(data.bridge, join(OUT_DIR, 'tide-arch-bridge.png'));
  writeDataUrl(data.cliffs, join(OUT_DIR, 'tide-arch-cliffs.png'));
  writeDataUrl(data.waterfalls, join(OUT_DIR, 'tide-arch-waterfalls.png'));
  writeDataUrl(data.preview, PREVIEW_OUT);
  console.log('Packed tide-arch-bridge.png, tide-arch-cliffs.png, tide-arch-waterfalls.png cleanly.');
} finally {
  try { socket?.close(); } catch { /* ok */ }
  try { chrome.kill(); } catch { /* ok */ }
  server.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows file lock */ }
}
