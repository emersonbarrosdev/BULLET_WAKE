import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LOGO_SRC = 'C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d/.user_uploaded/media_1794854699978_628bc69b.png';
const BG_SRC = 'C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d/.user_uploaded/media_1794854699954_24ce3ec7.jpg';
const HELI_SIDE_SRC = 'C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d/arcade_helicopter_sprite_1794855186620.jpg';
const HELI_PATROL_SRC = 'C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d/patrol_helicopter_sprite_1794861428601.jpg';

const UI_DIR = path.resolve('public/assets/arcade/ui');
const BRAND_DIR = path.resolve('public/assets/brand');
fs.mkdirSync(UI_DIR, { recursive: true });
fs.mkdirSync(BRAND_DIR, { recursive: true });

function pngToWebp(pngBuf, outPath, quality = 95) {
  const tmp = outPath.replace(/\.webp$/, '.tmp.png');
  fs.writeFileSync(tmp, pngBuf);
  try {
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', tmp,
      '-c:v', 'libwebp', '-lossless', '0', '-quality', String(quality),
      '-compression_level', '6', '-pix_fmt', 'yuva420p', outPath,
    ]);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

async function evalInChrome(fnBody, args) {
  const chromePath = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].find(p => p && fs.existsSync(p));
  if (!chromePath) throw new Error('Chrome not found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-title-pack-'));
  const chrome = spawn(chromePath, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', '--no-first-run', '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let socket;
  try {
    let target;
    for (let i = 0; i < 80 && !target; i++) {
      try {
        const dbgPort = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
        target = (await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json()).find(t => t.type === 'page');
      } catch {}
      if (!target) await sleep(100);
    }
    if (!target) throw new Error('Chrome target failed');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
    let seq = 0;
    const pending = new Map();
    socket.onmessage = ev => {
      const m = JSON.parse(ev.data); if (!m.id) return;
      const h = pending.get(m.id); if (!h) return;
      pending.delete(m.id); clearTimeout(h.timeout);
      m.error ? h.reject(new Error(JSON.stringify(m.error))) : h.resolve(m.result);
    };
    const expr = `(${fnBody})(${JSON.stringify(args)})`;
    return await new Promise((resolve, reject) => {
      const id = ++seq;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Eval timeout')); }, 120000);
      pending.set(id, {
        resolve: r => r.exceptionDetails ? reject(new Error(JSON.stringify(r.exceptionDetails))) : resolve(r.result.value),
        reject,
        timeout,
      });
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
    });
  } finally {
    try { socket?.close(); } catch {}
    try { chrome.kill(); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  const logoB64 = 'data:image/png;base64,' + fs.readFileSync(LOGO_SRC).toString('base64');
  const bgB64 = 'data:image/jpeg;base64,' + fs.readFileSync(BG_SRC).toString('base64');
  const heliB64 = 'data:image/jpeg;base64,' + fs.readFileSync(HELI_SIDE_SRC).toString('base64');
  const patrolB64 = 'data:image/jpeg;base64,' + fs.readFileSync(HELI_PATROL_SRC).toString('base64');

  const res = await evalInChrome(async ({ logoB64, bgB64, heliB64, patrolB64 }) => {
    const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const makeCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

    // 1. Process user logo PNG (tight trim preserving crisp crest & star alpha)
    const lImg = await loadImg(logoB64);
    const lc = makeCv(lImg.width, lImg.height);
    const lctx = lc.getContext('2d');
    lctx.drawImage(lImg, 0, 0);
    const ld = lctx.getImageData(0, 0, lc.width, lc.height).data;
    let minX = lc.width, minY = lc.height, maxX = 0, maxY = 0;
    for (let y = 0; y < lc.height; y++) {
      for (let x = 0; x < lc.width; x++) {
        if (ld[(y * lc.width + x) * 4 + 3] > 12) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    const trimW = maxX - minX + 1, trimH = maxY - minY + 1;
    const outW = 1024, outH = Math.round((trimH / trimW) * 1024);
    const logoOut = makeCv(outW, outH);
    logoOut.getContext('2d').drawImage(lc, minX, minY, trimW, trimH, 0, 0, outW, outH);

    // Compact badge 480x360
    const compOut = makeCv(480, Math.round((trimH / trimW) * 480));
    compOut.getContext('2d').drawImage(logoOut, 0, 0, compOut.width, compOut.height);

    async function buildHeliStrip(srcB64) {
      const hImg = await loadImg(srcB64);
      const hc = makeCv(hImg.width, hImg.height);
      const hctx = hc.getContext('2d');
      hctx.drawImage(hImg, 0, 0);
      const hImgData = hctx.getImageData(0, 0, hc.width, hc.height);
      const hd = hImgData.data;
      const W = hc.width, H = hc.height;
      const vis = new Uint8Array(W * H);
      const q = new Int32Array(W * H);
      let qs = 0, qe = 0;
      const isNearWhite = (idx) => {
        const r = hd[idx], g = hd[idx + 1], b = hd[idx + 2];
        const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
        return minC > 224 && (maxC - minC) < 22;
      };
      const pushSeed = (x, y) => {
        const p = y * W + x;
        if (vis[p] || !isNearWhite(p * 4)) return;
        vis[p] = 1;
        q[qe++] = p;
      };
      for (let x = 0; x < W; x++) { pushSeed(x, 0); pushSeed(x, H - 1); }
      for (let y = 0; y < H; y++) { pushSeed(0, y); pushSeed(W - 1, y); }
      while (qs < qe) {
        const p = q[qs++];
        const x = p % W, y = (p / W) | 0;
        hd[p * 4 + 3] = 0;
        if (x > 0) pushSeed(x - 1, y);
        if (x + 1 < W) pushSeed(x + 1, y);
        if (y > 0) pushSeed(x, y - 1);
        if (y + 1 < H) pushSeed(x, y + 1);
      }
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const p = y * W + x, i = p * 4;
          if (hd[i + 3] === 0) continue;
          if (vis[p - 1] || vis[p + 1] || vis[p - W] || vis[p + W]) {
            const lum = (hd[i] + hd[i + 1] + hd[i + 2]) / 3;
            if (lum > 185) hd[i + 3] = Math.max(0, Math.round((235 - lum) * 3.5));
          }
        }
      }
      hctx.putImageData(hImgData, 0, 0);
      let hMinX = W, hMinY = H, hMaxX = 0, hMaxY = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (hd[(y * W + x) * 4 + 3] > 18) {
            if (x < hMinX) hMinX = x; if (x > hMaxX) hMaxX = x;
            if (y < hMinY) hMinY = y; if (y > hMaxY) hMaxY = y;
          }
        }
      }
      const hTrimW = hMaxX - hMinX + 1, hTrimH = hMaxY - hMinY + 1;
      const heliStrip = makeCv(1024, 256);
      const hsCtx = heliStrip.getContext('2d');
      const drawScale = Math.min(228 / hTrimW, 180 / hTrimH);
      const dw = hTrimW * drawScale, dh = hTrimH * drawScale;
      for (let f = 0; f < 4; f++) {
        const cx = f * 256 + 128;
        const cy = 136 + Math.sin((f / 4) * Math.PI * 2) * 1.4;
        hsCtx.save();
        hsCtx.translate(cx, cy);
        hsCtx.drawImage(hc, hMinX, hMinY, hTrimW, hTrimH, -dw * 0.5, -dh * 0.5, dw, dh);
        const hubX = -dw * 0.085, hubY = -dh * 0.35;
        const blurRx = dw * (0.44 - (f % 2) * 0.05);
        hsCtx.fillStyle = `rgba(218, 245, 255, ${f % 2 === 0 ? 0.34 : 0.22})`;
        hsCtx.beginPath();
        hsCtx.ellipse(hubX, hubY, blurRx, 4.8, 0, 0, Math.PI * 2);
        hsCtx.fill();
        hsCtx.strokeStyle = 'rgba(24, 41, 72, 0.45)';
        hsCtx.lineWidth = 1.4;
        hsCtx.beginPath();
        hsCtx.ellipse(hubX, hubY, blurRx * 0.92, 3.2, 0, f % 2 ? 0.1 : Math.PI * 0.6, f % 2 ? Math.PI * 1.1 : Math.PI * 1.7);
        hsCtx.stroke();
        const tX = dw * 0.405, tY = -dh * 0.275;
        hsCtx.fillStyle = `rgba(218, 245, 255, ${f % 2 === 0 ? 0.42 : 0.24})`;
        hsCtx.beginPath();
        hsCtx.arc(tX, tY, 13 + (f % 2) * 2, 0, Math.PI * 2);
        hsCtx.fill();
        hsCtx.restore();
      }
      return heliStrip.toDataURL('image/png');
    }

    const bgImg = await loadImg(bgB64);
    const bgCv = makeCv(1536, 864);
    bgCv.getContext('2d').drawImage(bgImg, 0, 0, 1536, 864);

    return {
      logo: logoOut.toDataURL('image/png'),
      compact: compOut.toDataURL('image/png'),
      heliSide: await buildHeliStrip(heliB64),
      heliPatrol: await buildHeliStrip(patrolB64),
      bg: bgCv.toDataURL('image/png'),
    };
  }, { logoB64, bgB64, heliB64, patrolB64 });

  const b64ToBuf = (u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
  const logoBuf = b64ToBuf(res.logo);
  const compBuf = b64ToBuf(res.compact);
  const heliBuf = b64ToBuf(res.heliSide);
  const patrolBuf = b64ToBuf(res.heliPatrol);
  const bgBuf = b64ToBuf(res.bg);

  pngToWebp(logoBuf, path.join(UI_DIR, 'logo-arcade.webp'), 96);
  pngToWebp(bgBuf, path.join(UI_DIR, 'sky-panorama.webp'), 94);
  pngToWebp(heliBuf, path.join(UI_DIR, 'menu-heli-side.webp'), 95);
  pngToWebp(patrolBuf, path.join(UI_DIR, 'menu-heli-patrol-side.webp'), 95);

  for (const name of ['bullet-wake-logo-main.png', 'bullet-wake-logo-transparent.png', 'bullet-wake-logo-light-bg.png', 'bullet-wake-logo-dark-bg.png']) {
    fs.writeFileSync(path.join(BRAND_DIR, name), logoBuf);
  }
  fs.writeFileSync(path.join(BRAND_DIR, 'bullet-wake-logo-compact.png'), compBuf);

  console.log('Installed title assets:', {
    logoBytes: fs.statSync(path.join(UI_DIR, 'logo-arcade.webp')).size,
    bgBytes: fs.statSync(path.join(UI_DIR, 'sky-panorama.webp')).size,
    heliBytes: fs.statSync(path.join(UI_DIR, 'menu-heli-side.webp')).size,
  });
}

main();
