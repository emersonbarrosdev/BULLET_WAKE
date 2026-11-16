/** Packs Colossal Submarine v3 continuous hull, submerged lower hull tier, and modular combat parts
 * from the illustrated master plates into true-alpha RGBA PNG sprite sheets.
 * Usage: node scripts/pack-colossal-sub.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const BRAIN = 'C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d';
const HULL_SRC = join(BRAIN, 'boss_submarine_hull_1794806871301.jpg');
const PARTS_SRC = join(BRAIN, 'colossal_submarine_sprite_atlas_1794806876678.jpg');
const OUT_DIR = resolve('public/assets/arcade/pelagic-review');
mkdirSync(OUT_DIR, { recursive: true });
assert(existsSync(HULL_SRC), 'Missing v3 hull master JPEG: ' + HULL_SRC);
assert(existsSync(PARTS_SRC), 'Missing v3 parts atlas JPEG: ' + PARTS_SRC);

const TMP = mkdtempSync(join(tmpdir(), 'bw-sub-pack-v3-'));
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><html><body></body></html>'); return; }
  if (path === '/hull.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(readFileSync(HULL_SRC)); return; }
  if (path === '/parts.jpg') { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(readFileSync(PARTS_SRC)); return; }
  res.writeHead(404).end();
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const profile = mkdtempSync(join(tmpdir(), 'bw-sub-chrome-v3-'));
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
  await sleep(200);
  await new Promise((res) => {
    socket.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: `http://127.0.0.1:${server.address().port}/` } }));
    const onMsg = ev => { const m = JSON.parse(ev.data); if (m.id === 1) { socket.removeEventListener('message', onMsg); res(); } };
    socket.addEventListener('message', onMsg);
  });
  await sleep(250);

  let seq = 2;
  const pending = new Map();
  socket.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (!m.id) return;
    const h = pending.get(m.id);
    if (!h) return;
    pending.delete(m.id);
    clearTimeout(h.timeout);
    m.error ? h.reject(new Error(JSON.stringify(m.error))) : h.resolve(m.result);
  };
  const evalFn = async fn => {
    const id = ++seq;
    const res = await new Promise((r, j) => {
      const timeout = setTimeout(() => { pending.delete(id); j(new Error('Timeout')); }, 60000);
      pending.set(id, { resolve: r, reject: j, timeout });
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: `(${fn})()`, awaitPromise: true, returnByValue: true } }));
    });
    if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
    return res.result.value;
  };

  const result = await evalFn(async () => {
    const load = url => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url; });
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, x: c.getContext('2d', { willReadFrequently: true }) }; };

    const keyWhiteBg = (canvas, whiteFloor = 224) => {
      const x = canvas.getContext('2d', { willReadFrequently: true });
      const w = canvas.width, h = canvas.height;
      const imgData = x.getImageData(0, 0, w, h);
      const d = imgData.data;
      const vis = new Uint8Array(w * h), q = new Int32Array(w * h);
      let head = 0, tail = 0;
      const isWhite = i => {
        const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
        const min = Math.min(r, g, b), max = Math.max(r, g, b);
        return min >= whiteFloor && (max - min) <= 24;
      };
      const push = i => { if (!vis[i]) { vis[i] = 1; q[tail++] = i; } };
      for (let cx = 0; cx < w; cx++) { push(cx); push((h - 1) * w + cx); }
      for (let cy = 0; cy < h; cy++) { push(cy * w); push(cy * w + w - 1); }
      while (head < tail) {
        const i = q[head++];
        if (!isWhite(i)) continue;
        d[i * 4 + 3] = 0;
        const cx = i % w, cy = (i / w) | 0;
        if (cx > 0) push(i - 1);
        if (cx < w - 1) push(i + 1);
        if (cy > 0) push(i - w);
        if (cy < h - 1) push(i + w);
      }
      const copyA = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) copyA[i] = d[i * 4 + 3];
      for (let cy = 1; cy < h - 1; cy++) {
        for (let cx = 1; cx < w - 1; cx++) {
          const i = cy * w + cx;
          if (!copyA[i]) continue;
          if (!copyA[i - 1] || !copyA[i + 1] || !copyA[i - w] || !copyA[i + w]) {
            const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
            const lum = (r + g + b) / 3;
            if (lum > 180 && Math.max(r, g, b) - Math.min(r, g, b) < 28) {
              d[i * 4 + 3] = Math.round(copyA[i] * Math.max(0, (244 - lum) / 68));
            }
          }
        }
      }
      x.putImageData(imgData, 0, 0);
      return canvas;
    };

    const alphaBounds = (canvas) => {
      const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          if (d[(y * canvas.width + x) * 4 + 3] > 28) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    };

    const CELL = 512;
    const TOTAL_H = CELL * 5; // 2560px continuous vertical submarine canvas (Stern top -> Bow bottom)

    // --- 1. CONTINUOUS MASTER SUBMARINE (512 x 2560) ---
    // Loads the illustrated continuous war submarine and adapts its silhouette cleanly:
    //  * Bow (0), Forward Hull (1), Command Spine (2), Aft Hull (3), Stern Propulsion (4)
    //  * Undistorted bow/stern cones + extended streamlined saddle deck across Secs 1..3
    //  * Clean dorsal surface free of duplicate cockpit slits, with integrated steel turret barbettes
    const hullImg = await load('/hull.jpg');
    const hRaw = mk(hullImg.width, hullImg.height);
    hRaw.x.drawImage(hullImg, 0, 0);
    keyWhiteBg(hRaw.c, 224);
    const hb = alphaBounds(hRaw.c);

    // Symmetrize subtly and center-align source hull horizontally
    const hCent = mk(CELL, Math.round(hb.h * (360 / hb.w)));
    const targetSrcW = 368;
    const scSrc = targetSrcW / hb.w;
    hCent.x.imageSmoothingEnabled = true;
    hCent.x.imageSmoothingQuality = 'high';
    hCent.x.drawImage(
      hRaw.c, hb.x0, hb.y0, hb.w, hb.h,
      (CELL - targetSrcW) * 0.5, 0, targetSrcW, hCent.c.height
    );

    const SH = hCent.c.height;
    // Build seamless 512 x 2560 master hull with ZERO horizontal seams, ZERO modulo jumps, ZERO width steps:
    // Smooth monotonic C1 beam width envelope + normalized cylindrical texture sampling from boss_submarine_hull
    const master = mk(CELL, TOTAL_H);
    const mx = master.x;
    mx.imageSmoothingEnabled = true;
    mx.imageSmoothingQuality = 'high';

    // 1. Measure real row span [lx, rx] on centered source hull hCent
    const hData = hCent.x.getImageData(0, 0, CELL, SH).data;
    const srcSpan = Array.from({ length: SH }, (_, y) => {
      let lx = CELL, rx = -1;
      for (let x = 0; x < CELL; x++) {
        if (hData[(y * CELL + x) * 4 + 3] > 35) { if (x < lx) lx = x; if (x > rx) rx = x; }
      }
      return { lx, rx, w: rx >= lx ? rx - lx + 1 : 0 };
    });

    // Helper: draw one source row from hCent horizontally rescaled smoothly to target beam width `targetW`
    const drawRescaledSrcRow = (dstY, srcRowF, targetW, alpha = 1) => {
      const sy = Math.max(0, Math.min(SH - 1, Math.round(srcRowF)));
      const sp = srcSpan[sy];
      if (!sp || sp.w < 6) return;
      mx.save();
      mx.globalAlpha = alpha;
      mx.drawImage(hCent.c, sp.lx, sy, sp.w, 1, (CELL - targetW) * 0.5, dstY, targetW, 1);
      mx.restore();
    };

    // Clean cylindrical mid-hull source sample row range [0.39*SH .. 0.48*SH] where flank ballast + spine + yellow hazard lines are super clean
    const midYLo = Math.round(SH * 0.39);
    const midYHi = Math.round(SH * 0.48);
    // Erase any tiny dark center porthole inside hCent over [0.35*SH .. 0.54*SH] before sampling!
    {
      const hd = hCent.x.getImageData(0, 0, CELL, SH);
      const dd = hd.data;
      const yA = Math.round(SH * 0.33), yB = Math.round(SH * 0.54);
      for (let y = yA; y <= yB; y++) {
        const offL = (y * CELL + 218) * 4, offR = (y * CELL + 294) * 4;
        for (let x = 219; x <= 293; x++) {
          const idx = (y * CELL + x) * 4;
          const t = (x - 219) / 74;
          const dome = Math.sin(t * Math.PI);
          const isSeam = Math.abs(x - 256) <= 1;
          const lum = (dd[idx] + dd[idx + 1] + dd[idx + 2]) / 3;
          if (lum < 155 || (x > 228 && x < 284)) {
            const lift = isSeam ? -20 : dome * 24;
            dd[idx] = Math.max(0, Math.min(255, Math.round(dd[offL] * (1 - t) + dd[offR] * t + lift * 0.72)));
            dd[idx + 1] = Math.max(0, Math.min(255, Math.round(dd[offL + 1] * (1 - t) + dd[offR + 1] * t + lift * 0.92)));
            dd[idx + 2] = Math.max(0, Math.min(255, Math.round(dd[offL + 2] * (1 - t) + dd[offR + 2] * t + lift * 1.04)));
          }
        }
      }
      hCent.x.putImageData(hd, 0, 0);
    }

    // Recompute clean srcSpan after center-spine touchup
    const hData2 = hCent.x.getImageData(0, 0, CELL, SH).data;
    for (let y = 0; y < SH; y++) {
      let lx = CELL, rx = -1;
      for (let x = 0; x < CELL; x++) if (hData2[(y * CELL + x) * 4 + 3] > 35) { if (x < lx) lx = x; if (x > rx) rx = x; }
      srcSpan[y] = { lx, rx, w: rx >= lx ? rx - lx + 1 : 0 };
    }

    // Target continuous submarine envelope across full 2560px height:
    // - Top y = 14..450: Stern thruster pods + X-planes (from hCent 0 .. 0.30*SH)
    // - Mid y = 450..2130: Smooth tapered cylindrical saddle (monotonic width transition!)
    // - Bot y = 2130..2546: Bow dive hydroplanes + coral-red chevrons + nose cone (from hCent 0.785*SH .. SH-1, ZERO duplicate cockpit window!)
    const sternEndY = 450;
    const sternSrcEnd = SH * 0.30;
    const bowStartY = 2130;
    const bowEndY = 2546;
    const bowSrcStart = SH * 0.785;

    const sternBaseW = srcSpan[Math.round(sternSrcEnd)]?.w || 270;
    const bowBaseW = srcSpan[Math.round(bowSrcStart)]?.w || 310;
    const maxMidW = 358; // Leaves 77px margin cleanly inside 512px -> ~106px hull half-width in game

    const targetBeamWidthAt = (y) => {
      if (y <= sternEndY) {
        const sy = Math.round((y / sternEndY) * sternSrcEnd);
        return (srcSpan[sy]?.w || 0) * 0.96;
      }
      if (y >= bowStartY) {
        const k = Math.min(1, (y - bowStartY) / (bowEndY - bowStartY));
        const sy = Math.min(SH - 1, Math.round(bowSrcStart + k * (SH - 1 - bowSrcStart)));
        return (srcSpan[sy]?.w || 0) * 0.98;
      }
      // Smooth C1 cosine-spline connecting sternBaseW*0.96 -> maxMidW -> bowBaseW*0.98
      const t = (y - sternEndY) / (bowStartY - sternEndY);
      const sW = sternBaseW * 0.96, bW = bowBaseW * 0.98;
      if (t < 0.35) {
        const u = t / 0.35;
        return sW + (maxMidW - sW) * (0.5 - 0.5 * Math.cos(u * Math.PI));
      }
      if (t > 0.72) {
        const u = (t - 0.72) / 0.28;
        return maxMidW + (bW - maxMidW) * (0.5 - 0.5 * Math.cos(u * Math.PI));
      }
      return maxMidW;
    };

    // Draw row-by-row with smooth cross-fading at stern/mid and mid/bow boundaries (zero step!)
    for (let y = 14; y <= bowEndY; y++) {
      const tw = targetBeamWidthAt(y);
      if (tw < 6) continue;
      if (y <= sternEndY) {
        const sy = (y - 14) / (sternEndY - 14) * sternSrcEnd;
        drawRescaledSrcRow(y, sy, tw, 1);
      } else if (y >= bowStartY) {
        const sy = bowSrcStart + ((y - bowStartY) / (bowEndY - bowStartY)) * (SH - 1 - bowSrcStart);
        drawRescaledSrcRow(y, sy, tw, 1);
      } else {
        // Mirror-cosine seamless sampling inside clean cylindrical mid-band [midYLo .. midYHi] (smooth derivative = 0 at turnarounds!)
        const t = (y - sternEndY) / (bowStartY - sternEndY);
        const wave = 0.5 - 0.5 * Math.cos(t * Math.PI * 4); // Smooth 2-cycle cosine (zero jumps anywhere!)
        const syMid = midYLo + wave * (midYHi - midYLo);
        drawRescaledSrcRow(y, syMid, tw, 1);
        // Smooth 72px cross-fade with adjacent stern/bow ends
        if (y < sternEndY + 72) {
          const k = 1 - (y - sternEndY) / 72;
          const syStern = Math.min(SH - 1, sternSrcEnd + (y - sternEndY) * 0.25);
          drawRescaledSrcRow(y, syStern, tw, k * k);
        } else if (y > bowStartY - 72) {
          const k = 1 - (bowStartY - y) / 72;
          const syBow = Math.max(0, bowSrcStart - (bowStartY - y) * 0.22);
          drawRescaledSrcRow(y, syBow, tw, k * k);
        }
      }
    }

    // Add curved submarine transverse bulkhead ribs clipped strictly inside solid hull
    mx.save();
    mx.globalCompositeOperation = 'source-atop';
    for (let ry = 220; ry < TOTAL_H - 220; ry += 128) {
      mx.strokeStyle = 'rgba(11, 28, 54, 0.30)';
      mx.lineWidth = 2.0;
      mx.beginPath();
      mx.moveTo(96, ry - 4);
      mx.quadraticCurveTo(256, ry + 6, 416, ry - 4);
      mx.stroke();
      mx.strokeStyle = 'rgba(165, 224, 250, 0.20)';
      mx.lineWidth = 1.4;
      mx.beginPath();
      mx.moveTo(108, ry - 1.8);
      mx.quadraticCurveTo(256, ry + 8.2, 404, ry - 1.8);
      mx.stroke();
    }
    mx.restore();

    // --- 2. SPLIT MASTER INTO CRISP EMERGED DORSAL HULL + SUBMERGED LOWER SADDLE & HYDROPLANES ---
    const emergedMaster = mk(CELL, TOTAL_H);
    const subMaster = mk(CELL, TOTAL_H);
    const mData = mx.getImageData(0, 0, CELL, TOTAL_H).data;
    const emImg = emergedMaster.x.createImageData(CELL, TOTAL_H);
    const subImg = subMaster.x.createImageData(CELL, TOTAL_H);

    for (let y = 0; y < TOTAL_H; y++) {
      let lx = CELL, rx = -1;
      for (let x = 0; x < CELL; x++) {
        if (mData[(y * CELL + x) * 4 + 3] > 35) {
          if (x < lx) lx = x;
          if (x > rx) rx = x;
        }
      }
      if (rx - lx < 12) continue;
      const cxRow = (lx + rx) * 0.5;
      const hwRow = (rx - lx) * 0.5;
      const relY = y / TOTAL_H;
      const emergeFrac = relY < 0.16 ? 0.58 + (relY / 0.16) * 0.18 : relY > 0.88 ? 0.72 : 0.77;
      const emergedHalf = hwRow * emergeFrac;

      for (let x = 0; x < CELL; x++) {
        const i = (y * CELL + x) * 4;
        const a = mData[i + 3];
        if (a < 8) continue;
        const r = mData[i], g = mData[i + 1], b = mData[i + 2];
        const dist = Math.abs(x - cxRow);

        const flankDepth = Math.max(0, Math.min(1, (dist - emergedHalf * 0.74) / Math.max(10, hwRow * 0.34)));
        const deepMix = 0.42 + flankDepth * 0.34;
        subImg.data[i] = Math.round(r * (1 - deepMix) + 12 * deepMix);
        subImg.data[i + 1] = Math.round(g * (1 - deepMix) + 150 * deepMix);
        subImg.data[i + 2] = Math.round(b * (1 - deepMix) + 202 * deepMix);
        subImg.data[i + 3] = Math.round(a * (0.86 - flankDepth * 0.28));

        const innerDist = dist / Math.max(1, emergedHalf);
        if (innerDist <= 1.0) {
          // Crisp 2.5px anime waterline trim bevel along emerged dorsal silhouette instead of soft muddy blur
          const isRim = innerDist > 0.945;
          const rimAlpha = innerDist > 0.975 ? Math.max(0, 1 - (innerDist - 0.975) / 0.025) : 1;
          emImg.data[i] = isRim ? 12 : r;
          emImg.data[i + 1] = isRim ? 32 : g;
          emImg.data[i + 2] = isRim ? 58 : b;
          emImg.data[i + 3] = Math.round(a * rimAlpha);
        }
      }
    }
    emergedMaster.x.putImageData(emImg, 0, 0);
    subMaster.x.putImageData(subImg, 0, 0);

    // Add soft abyssal underwater keel pocket glow directly under subMaster (NO polygon jagged outlines)
    const subFinal = mk(CELL, TOTAL_H);
    subFinal.x.save();
    subFinal.x.shadowColor = 'rgba(2, 18, 44, 0.56)';
    subFinal.x.shadowBlur = 18;
    subFinal.x.shadowOffsetX = 4;
    subFinal.x.shadowOffsetY = 8;
    subFinal.x.drawImage(subMaster.c, 0, 0);
    subFinal.x.restore();
    // Subtle underwater sonar bulb extension under bow tip
    subFinal.x.save();
    const bulbGrad = subFinal.x.createRadialGradient(256, bowEndY - 24, 4, 256, bowEndY - 12, 42);
    bulbGrad.addColorStop(0, 'rgba(18, 138, 178, 0.58)');
    bulbGrad.addColorStop(0.55, 'rgba(8, 86, 134, 0.42)');
    bulbGrad.addColorStop(1, 'rgba(4, 36, 72, 0)');
    subFinal.x.fillStyle = bulbGrad;
    subFinal.x.beginPath();
    subFinal.x.ellipse(256, bowEndY - 12, 34, 46, 0, 0, Math.PI * 2);
    subFinal.x.fill();
    subFinal.x.restore();

    // Slice emergedMaster & subFinal cleanly into 5 horizontal 512x512 frames:
    // Cell 0 = Bow (bottom 2048..2560), Cell 1 = 1536..2048, Cell 2 = 1024..1536, Cell 3 = 512..1024, Cell 4 = Stern (0..512)
    const hullSheet = mk(CELL * 5, CELL);
    const subSheet = mk(CELL * 5, CELL);
    for (let sec = 0; sec < 5; sec++) {
      const srcY = (4 - sec) * CELL;
      hullSheet.x.drawImage(emergedMaster.c, 0, srcY, CELL, CELL, sec * CELL, 0, CELL, CELL);
      subSheet.x.drawImage(subFinal.c, 0, srcY, CELL, CELL, sec * CELL, 0, CELL, CELL);
    }

    // Visual stitched assembly preview (Stern top -> Bow bottom, Submerged + Emerged composited over ocean blue)
    const preview = mk(CELL, TOTAL_H);
    preview.x.fillStyle = '#0d4f8a';
    preview.x.fillRect(0, 0, CELL, TOTAL_H);
    for (let i = 0; i < 5; i++) {
      const sec = 4 - i;
      preview.x.drawImage(subSheet.c, sec * CELL, 0, CELL, CELL, 0, i * CELL, CELL, CELL);
      preview.x.drawImage(hullSheet.c, sec * CELL, 0, CELL, CELL, 0, i * CELL, CELL, CELL);
    }

    // --- 3. PACK MODULAR PARTS ATLAS (4x2 x 512x512 = 2048x1024) ---
    // Remaps source 4x2 cells directly into exact SUB_PART_FRAME slots:
    //  dst 0 = (0,0) Twin Turret alive
    //  dst 1 = (1,0) VLS Silo alive
    //  dst 2 = (2,0) Conning Tower Sail alive
    //  dst 3 = (2,1) Ruined Burning Conning Tower dead
    //  dst 4 = (3,0) Pressurized Cyan Reactor / Armor Hatch alive
    //  dst 5 = (0,1) Molten Breached Crater dead
    //  dst 6 = (1,1) Shrouded Ducted Pump-Jet Thruster alive
    //  dst 7 = (3,1) Destroyed Twin Turret Wreck dead
    const partsImg = await load('/parts.jpg');
    const pCols = 4, pRows = 2;
    const partsSheet = mk(CELL * pCols, CELL * pRows);
    const srcCW = partsImg.width / pCols, srcCH = partsImg.height / pRows;
    const remap = [
      { dst: 0, sx: 0, sy: 0, cyBias: 0.42 }, // Shift turret gun-house center up slightly so turret pivots around octagonal collar
      { dst: 1, sx: 1, sy: 0, cyBias: 0.50 },
      { dst: 2, sx: 2, sy: 0, cyBias: 0.54 },
      { dst: 3, sx: 2, sy: 1, cyBias: 0.52 },
      { dst: 4, sx: 3, sy: 0, cyBias: 0.50 },
      { dst: 5, sx: 0, sy: 1, cyBias: 0.50 },
      { dst: 6, sx: 1, sy: 1, cyBias: 0.50 },
      { dst: 7, sx: 3, sy: 1, cyBias: 0.44 },
    ];
    for (const item of remap) {
      const cellC = mk(Math.ceil(srcCW), Math.ceil(srcCH));
      cellC.x.drawImage(partsImg, item.sx * srcCW, item.sy * srcCH, srcCW, srcCH, 0, 0, cellC.c.width, cellC.c.height);
      keyWhiteBg(cellC.c, 224);
      const b = alphaBounds(cellC.c);
      const targetMax = Math.round(CELL * 0.84);
      const sc = Math.min(targetMax / b.w, targetMax / b.h);
      const dw = b.w * sc, dh = b.h * sc;
      const dCol = item.dst % pCols, dRow = Math.floor(item.dst / pCols);
      const dstX = dCol * CELL + (CELL - dw) * 0.5;
      const dstY = dRow * CELL + (CELL * 0.5 - dh * item.cyBias);
      partsSheet.x.imageSmoothingEnabled = true;
      partsSheet.x.imageSmoothingQuality = 'high';
      partsSheet.x.drawImage(cellC.c, b.x0, b.y0, b.w, b.h, dstX, Math.max(dRow * CELL + 8, Math.min(dRow * CELL + CELL - dh - 8, dstY)), dw, dh);
    }

    return {
      hullUrl: hullSheet.c.toDataURL('image/png'),
      subUrl: subSheet.c.toDataURL('image/png'),
      partsUrl: partsSheet.c.toDataURL('image/png'),
      previewUrl: preview.c.toDataURL('image/png'),
      metrics: { hullSrc: [hullImg.width, hullImg.height], scaledH: SH, partsImg: [partsImg.width, partsImg.height] }
    };
  });

  writeFileSync(join(OUT_DIR, 'colossal-sub-hull.png'), Buffer.from(result.hullUrl.split(',')[1], 'base64'));
  writeFileSync(join(OUT_DIR, 'colossal-sub-submerged.png'), Buffer.from(result.subUrl.split(',')[1], 'base64'));
  writeFileSync(join(OUT_DIR, 'colossal-sub-parts.png'), Buffer.from(result.partsUrl.split(',')[1], 'base64'));
  writeFileSync(join(BRAIN, 'scratch/colossal-sub-v3-preview.png'), Buffer.from(result.previewUrl.split(',')[1], 'base64'));
  console.log('Packed v3 Colossal Submarine sheets:', JSON.stringify(result.metrics));
} finally {
  socket?.close(); chrome.kill(); server.close();
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
