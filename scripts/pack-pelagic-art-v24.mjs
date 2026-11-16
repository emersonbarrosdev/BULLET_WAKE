import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'scripts', 'assets', 'v24');
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'arcade', 'pelagic-review');

const HELIS_SRC = path.join(SRC_DIR, 'helicopters-2x2.jpg');
const COASTAL_SRC = path.join(SRC_DIR, 'coastal-cannons-2x2.jpg');
const NAVAL_SRC = path.join(SRC_DIR, 'naval-turrets-wreck-2x2.jpg');
const ROTORS_SRC = path.join(SRC_DIR, 'rotors-warhawk-2x2.jpg');
const EMPL_ORIG = path.join(OUT_DIR, 'emplacements.png');

const TURRETS_OUT = path.join(OUT_DIR, 'pelagic-turrets.webp');
const HELIS_OUT = path.join(OUT_DIR, 'pelagic-helicopters.webp');
const ROTORS_OUT = path.join(OUT_DIR, 'pelagic-rotors.webp');

function dataUrl(p, mime = 'image/jpeg') {
  return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

function pngToWebp(pngBuf, outPath, quality = 95) {
  const tmpPng = outPath.replace(/\.webp$/, '.tmp.png');
  fs.writeFileSync(tmpPng, pngBuf);
  try {
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-i', tmpPng,
      '-c:v', 'libwebp', '-lossless', '0', '-quality', String(quality),
      '-compression_level', '6', '-pix_fmt', 'yuva420p', outPath,
    ]);
  } finally {
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
  }
}

async function evalInChrome(fnBody, args) {
  const chromePath = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].find(p => p && fs.existsSync(p));
  if (!chromePath) throw new Error('Chrome not found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-pack-v24-'));
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
  const outputs = await evalInChrome(async ({ helisB64, coastalB64, navalB64, rotorsB64, emplB64 }) => {
    const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const makeCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

    /** Extract a 2x2 grid quadrant, flood-fill key pure white (#FFFFFF) background to transparent alpha, and return tight cropped canvas. */
    function extractQuadrant(img, col, row, pad = 2) {
      const qw = Math.floor(img.width / 2);
      const qh = Math.floor(img.height / 2);
      const sx = col * qw;
      const sy = row * qh;
      const cv = makeCv(qw, qh);
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, sx, sy, qw, qh, 0, 0, qw, qh);
      const id = ctx.getImageData(0, 0, qw, qh);
      const d = id.data;
      const vis = new Uint8Array(qw * qh);
      const q = new Int32Array(qw * qh);
      let qs = 0, qe = 0;
      const isWhite = (p) => {
        const i = p * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        return Math.min(r, g, b) > 224 && (Math.max(r, g, b) - Math.min(r, g, b)) < 24;
      };
      const push = (x, y) => {
        const p = y * qw + x;
        if (vis[p] || !isWhite(p)) return;
        vis[p] = 1;
        q[qe++] = p;
      };
      for (let x = 0; x < qw; x++) { push(x, 0); push(x, qh - 1); }
      for (let y = 0; y < qh; y++) { push(0, y); push(qw - 1, y); }
      while (qs < qe) {
        const p = q[qs++];
        d[p * 4 + 3] = 0;
        const x = p % qw, y = (p / qw) | 0;
        if (x > 0) push(x - 1, y);
        if (x + 1 < qw) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y + 1 < qh) push(x, y + 1);
      }
      // Clean AA white fringe
      for (let y = 1; y < qh - 1; y++) {
        for (let x = 1; x < qw - 1; x++) {
          const p = y * qw + x, i = p * 4;
          if (d[i + 3] === 0) continue;
          if (vis[p - 1] || vis[p + 1] || vis[p - qw] || vis[p + qw]) {
            const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
            if (lum > 188) d[i + 3] = Math.max(0, Math.round((238 - lum) * 3.8));
          }
        }
      }
      ctx.putImageData(id, 0, 0);

      let minX = qw, minY = qh, maxX = 0, maxY = 0;
      for (let y = 0; y < qh; y++) {
        for (let x = 0; x < qw; x++) {
          if (d[(y * qw + x) * 4 + 3] > 20) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
          }
        }
      }
      const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
      const cw = Math.min(qw - x0, maxX - minX + 1 + pad * 2);
      const ch = Math.min(qh - y0, maxY - minY + 1 + pad * 2);
      const out = makeCv(cw, ch);
      out.getContext('2d').drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch);
      return out;
    }

    const helisImg = await loadImg(helisB64);
    const coastalImg = await loadImg(coastalB64);
    const navalImg = await loadImg(navalB64);
    const rotorsImg = await loadImg(rotorsB64);
    const emplImg = await loadImg(emplB64);

    // =========================================================================
    // 1. PELAGIC TURRETS SHEET (4 cols x 3 rows @ 160x160 -> 640x480)
    // Pivot = (80, 61) -> (0.5, 0.38125), barrel muzzle = (80, 144) -> (61 + 83).
    // Frames:
    //  0: Boat twin coral turret          (navalImg 0,0)
    //  1: Ship heavy naval dual turret    (navalImg 1,0)
    //  2: Submarine deck gun              (navalImg 0,1)
    //  3: Model A Light Coastal Cannon    (coastalImg 0,0)
    //  4: Model C Heavy Fortress Cannon   (coastalImg 0,1)
    //  5: Warhawk Chin Gatling Turret     (rotorsImg 0,1)
    //  6: Warhawk Wing Missile Pod        (rotorsImg 1,1)
    //  7: Model B Twin Coastal Battery    (coastalImg 1,0)
    //  8: Model D Precision Sniper Cannon (coastalImg 1,1)
    // =========================================================================
    const turretCv = makeCv(640, 480);
    const tCtx = turretCv.getContext('2d');

    function placePaintedTurret(cellIdx, spriteCv, domeFracGuess = 0.28) {
      const col = cellIdx % 4, row = Math.floor(cellIdx / 4);
      const d = spriteCv.getContext('2d').getImageData(0, 0, spriteCv.width, spriteCv.height).data;
      const w = spriteCv.width, h = spriteCv.height;
      // Measure row widths to find widest turret housing dome center vs bottom muzzle tip
      const rowWidths = new Float32Array(h);
      let maxRowW = 0;
      let muzzleY = 0;
      for (let y = 0; y < h; y++) {
        let lx = w, rx = -1;
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 28) {
            if (x < lx) lx = x;
            if (x > rx) rx = x;
            muzzleY = y;
          }
        }
        const rw = rx >= lx ? rx - lx + 1 : 0;
        rowWidths[y] = rw;
        if (rw > maxRowW) maxRowW = rw;
      }
      // Dome vertical band = rows with width >= 62% of maxRowW in upper 62% of height
      let domeTop = h, domeBot = 0;
      for (let y = 0; y < Math.floor(h * 0.68); y++) {
        if (rowWidths[y] >= maxRowW * 0.62) {
          if (y < domeTop) domeTop = y;
          if (y > domeBot) domeBot = y;
        }
      }
      const pivotSrcY = domeBot > domeTop ? (domeTop + domeBot) * 0.5 : h * domeFracGuess;
      const srcDist = Math.max(20, muzzleY - pivotSrcY);
      const maxTopScale = 58 / Math.max(10, pivotSrcY);
      const maxWidthScale = 148 / Math.max(10, maxRowW);
      const idealMuzzleScale = 83 / srcDist;
      const sc = Math.min(idealMuzzleScale, maxWidthScale, maxTopScale);
      const drawW = w * sc, drawH = h * sc;
      const dx = 80 - (w * 0.5) * sc;
      const dy = 61 - pivotSrcY * sc;
      const cell = makeCv(160, 160);
      cell.getContext('2d').drawImage(spriteCv, 0, 0, w, h, dx, dy, drawW, drawH);
      tCtx.drawImage(cell, col * 160, row * 160);
    }

    placePaintedTurret(0, extractQuadrant(navalImg, 0, 0), 0.30);   // Boat
    placePaintedTurret(1, extractQuadrant(navalImg, 1, 0), 0.30);   // Ship
    placePaintedTurret(2, extractQuadrant(navalImg, 0, 1), 0.32);   // Submarine
    placePaintedTurret(3, extractQuadrant(coastalImg, 0, 0), 0.30); // Model A Light Coastal
    placePaintedTurret(4, extractQuadrant(coastalImg, 0, 1), 0.34); // Model C Heavy Tower
    placePaintedTurret(5, extractQuadrant(rotorsImg, 0, 1), 0.38);  // Warhawk Chin Gatling
    placePaintedTurret(6, extractQuadrant(rotorsImg, 1, 1), 0.36);  // Warhawk Missile Pod
    placePaintedTurret(7, extractQuadrant(coastalImg, 1, 0), 0.28); // Model B Twin Coastal
    placePaintedTurret(8, extractQuadrant(coastalImg, 1, 1), 0.30); // Model D Precision Sniper

    // =========================================================================
    // 2. UPGRADE EMPLACEMENTS WRECK CRATER (preserve intact sandstone pad & fire, upgrade crater cells 1..3)
    // =========================================================================
    const emplCv = makeCv(emplImg.width, emplImg.height);
    const eCtx = emplCv.getContext('2d');
    eCtx.drawImage(emplImg, 0, 0);
    const wreckSrc = extractQuadrant(navalImg, 1, 1);
    const cwE = Math.floor(emplImg.width / 4), chE = Math.floor(emplImg.height / 4);
    for (let col = 1; col <= 3; col++) {
      eCtx.clearRect(col * cwE, 0, cwE, chE);
      const cell = makeCv(cwE, chE), c = cell.getContext('2d');
      const pad = 12;
      const sc = Math.min((cwE - pad * 2) / wreckSrc.width, (chE - pad * 2) / wreckSrc.height);
      const dw = wreckSrc.width * sc, dh = wreckSrc.height * sc;
      c.save();
      c.translate(cwE * 0.5, chE * 0.5);
      c.rotate((col - 2) * 0.08);
      c.drawImage(wreckSrc, -dw * 0.5, -dh * 0.5, dw, dh);
      // Warm ember glow pulses per frame
      const eg = c.createRadialGradient(0, 6, 4, 0, 6, dw * 0.28);
      eg.addColorStop(0, `rgba(255, 130, 32, ${0.18 + col * 0.06})`);
      eg.addColorStop(1, 'rgba(255, 60, 0, 0)');
      c.fillStyle = eg;
      c.beginPath(); c.arc(0, 6, dw * 0.28, 0, Math.PI * 2); c.fill();
      c.restore();
      eCtx.drawImage(cell, col * cwE, 0);
    }

    // =========================================================================
    // 3. PELAGIC HELICOPTERS SHEET (6 cols x 4 rows @ 192x192 -> 1152x768)
    // Rows: 0=scout, 1=utility, 2=phantom, 3=warhawk
    // Note: resolveHullVisualTransform applies rotation = Math.PI + yaw, so sprites face UP (-Y) in texture space!
    // Cols 0..4 = 2.5D roll/bank + wing shear + directional rim sheen + exhaust shimmer; Col 5 = attack pose
    // =========================================================================
    const heliCv = makeCv(1152, 768);
    const hCtx = heliCv.getContext('2d');
    const heliSources = [
      { q: extractQuadrant(helisImg, 0, 0), scaleFill: 0.78, flameCol: 'rgba(130,245,255,0.75)' }, // Scout
      { q: extractQuadrant(helisImg, 1, 0), scaleFill: 0.85, flameCol: 'rgba(255,175,75,0.78)' },  // Utility
      { q: extractQuadrant(helisImg, 0, 1), scaleFill: 0.82, flameCol: 'rgba(255,75,145,0.82)' },  // Phantom
      { q: extractQuadrant(helisImg, 1, 1), scaleFill: 0.86, flameCol: 'rgba(255,215,90,0.84)' },  // Warhawk
    ];

    heliSources.forEach(({ q, scaleFill, flameCol }, rowIdx) => {
      const scBase = Math.min((192 * scaleFill) / q.width, (192 * scaleFill) / q.height);
      const dw = q.width * scBase, dh = q.height * scBase;
      const banks = [-0.26, -0.13, 0, 0.13, 0.26, 0];
      for (let col = 0; col < 6; col++) {
        const b = banks[col];
        const attack = col === 5;
        const cell = makeCv(192, 192);
        const c = cell.getContext('2d');
        c.save();
        c.translate(96, 96);
        // Flip 180 deg so painted DOWN-facing nose points straight UP (-Y) in texture space
        c.rotate(Math.PI + b * 0.22);
        // True 2.5D bank roll: horizontal foreshortening + slight perspective skew
        const squashX = 1 - Math.abs(b) * 0.24 + (attack ? 0.04 : 0);
        const stretchY = attack ? 1.05 : 1 + Math.abs(b) * 0.03;
        c.transform(squashX, b * 0.14, 0, stretchY, 0, 0);
        c.drawImage(q, -dw * 0.5, -dh * 0.5, dw, dh);

        // Turbine exhaust glow vents (near aft tail-side while in source +Y-is-nose coord -> -dh*0.14)
        const fl = 8 + (col % 2) * 3 + (attack ? 6 : 0);
        c.fillStyle = flameCol;
        for (const sx of [-dw * 0.11, dw * 0.11]) {
          c.beginPath();
          c.ellipse(sx, -dh * 0.15, 3.2, fl * 0.55, 0, 0, Math.PI * 2);
          c.fill();
        }
        // Attack pose front muzzle/sensor charge highlight (in source coords, nose = +dh * 0.46)
        if (attack) {
          c.fillStyle = 'rgba(255, 240, 140, 0.88)';
          c.beginPath();
          c.arc(0, dh * 0.45, 7.2, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
        hCtx.drawImage(cell, col * 192, rowIdx * 192);
      }
    });

    // =========================================================================
    // 4. PELAGIC ROTORS SHEET (8 cols x 5 rows @ 160x160 -> 1280x800)
    // Using genuine painted rotors extracted from rotors-warhawk-2x2.jpg (0,0 & 1,0) + multi-blade/color variants + circular wind streaks
    // Row 0: Scout 4-blade steel/cyan
    // Row 1: Utility 3-blade cobalt/orange-tip
    // Row 2: Phantom 5-blade petrol-teal/crimson
    // Row 3: Warhawk heavy 4-blade military olive/yellow
    // Row 4: Tail rotor animated side-spin blades
    // =========================================================================
    const rotorCv = makeCv(1280, 800);
    const rCtx = rotorCv.getContext('2d');
    const scoutRotorSrc = extractQuadrant(rotorsImg, 0, 0);
    const warhawkRotorSrc = extractQuadrant(rotorsImg, 1, 0);

    // Extract single painted blade slice (upper-right diagonal blade -> normalized pointing +Y or angle 0) for 3-blade / 5-blade composition
    function makeColoredRotorBase(srcCv, tintHex, tipHex, bladesCount, size = 160) {
      const base = makeCv(size, size);
      const bCtx = base.getContext('2d');
      if (bladesCount === 4) {
        const sc = (size * 0.86) / Math.max(srcCv.width, srcCv.height);
        const dw = srcCv.width * sc, dh = srcCv.height * sc;
        bCtx.drawImage(srcCv, (size - dw) * 0.5, (size - dh) * 0.5, dw, dh);
        return base;
      }
      // Compose custom painted N-blade rotor using full unclipped top diagonal blade scaled inside a 200px workspace
      const bladeCrop = makeCv(200, 200);
      const bc = bladeCrop.getContext('2d');
      bc.save();
      bc.translate(100, 100);
      bc.rotate(Math.PI * 0.25);
      const sc = 136 / Math.max(srcCv.width, srcCv.height);
      bc.drawImage(srcCv, -srcCv.width * sc * 0.5, -srcCv.height * sc * 0.5, srcCv.width * sc, srcCv.height * sc);
      bc.restore();
      // Carve single vertical top blade [x 76..124, y 10..98] completely inside bounds (zero tip clipping!)
      const single = makeCv(48, 86);
      const sg = single.getContext('2d');
      sg.drawImage(bladeCrop, 76, 10, 48, 86, 0, 0, 48, 86);
      // Tint blade body while preserving outline & shading contrast
      const sd = sg.getImageData(0, 0, 48, 86);
      const px = sd.data;
      const tr = parseInt(tintHex.slice(1, 3), 16), tg = parseInt(tintHex.slice(3, 5), 16), tb = parseInt(tintHex.slice(5, 7), 16);
      const kr = parseInt(tipHex.slice(1, 3), 16), kg = parseInt(tipHex.slice(3, 5), 16), kb = parseInt(tipHex.slice(5, 7), 16);
      for (let y = 0; y < 86; y++) {
        for (let x = 0; x < 48; x++) {
          const i = (y * 48 + x) * 4;
          if (px[i + 3] < 20) continue;
          const maxC = Math.max(px[i], px[i + 1], px[i + 2]);
          const minC = Math.min(px[i], px[i + 1], px[i + 2]);
          const isOutline = maxC < 52;
          if (isOutline) continue;
          const isTip = y < 22 && (px[i] > 155 || px[i + 1] > 145) && maxC - minC > 35;
          const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
          const factor = 0.60 + lum * 0.72;
          if (isTip) {
            px[i] = Math.min(255, Math.round(kr * (0.82 + lum * 0.32)));
            px[i + 1] = Math.min(255, Math.round(kg * (0.82 + lum * 0.32)));
            px[i + 2] = Math.min(255, Math.round(kb * (0.82 + lum * 0.32)));
          } else {
            px[i] = Math.min(255, Math.round(tr * factor));
            px[i + 1] = Math.min(255, Math.round(tg * factor));
            px[i + 2] = Math.min(255, Math.round(tb * factor));
          }
        }
      }
      sg.putImageData(sd, 0, 0);

      bCtx.save();
      bCtx.translate(80, 80);
      for (let k = 0; k < bladesCount; k++) {
        bCtx.save();
        bCtx.rotate((k / bladesCount) * Math.PI * 2);
        bCtx.drawImage(single, -24, -76, 48, 86);
        bCtx.restore();
      }
      // Bolted hub cap
      bCtx.strokeStyle = '#182948'; bCtx.lineWidth = 3.2;
      bCtx.fillStyle = tipHex;
      bCtx.beginPath(); bCtx.arc(0, 0, 12, 0, Math.PI * 2); bCtx.fill(); bCtx.stroke();
      bCtx.fillStyle = '#182948';
      bCtx.beginPath(); bCtx.arc(0, 0, 5, 0, Math.PI * 2); bCtx.fill();
      bCtx.restore();
      return base;
    }

    const rotorSpecs = [
      { base: makeColoredRotorBase(scoutRotorSrc, '#cce8ff', '#38bdf8', 4), blurCol: 'rgba(110, 230, 255, 0.36)', blades: 4 },
      { base: makeColoredRotorBase(warhawkRotorSrc, '#5878a8', '#ff8c28', 3), blurCol: 'rgba(255, 160, 75, 0.34)', blades: 3 },
      { base: makeColoredRotorBase(warhawkRotorSrc, '#14627a', '#ff3b72', 5), blurCol: 'rgba(255, 64, 130, 0.34)', blades: 5 },
      { base: makeColoredRotorBase(warhawkRotorSrc, '#4c5e3a', '#facc15', 4), blurCol: 'rgba(228, 240, 150, 0.28)', blades: 4 },
    ];

    rotorSpecs.forEach((spec, row) => {
      for (let col = 0; col < 8; col++) {
        const cell = makeCv(160, 160);
        const c = cell.getContext('2d');
        const rot = (col / 8) * (Math.PI * 2 / spec.blades);
        c.save();
        c.translate(80, 80);
        // Painted sweeping radial motion-blur arcs rotating with the blades
        for (let b = 0; b < spec.blades; b++) {
          const a = rot + (b / spec.blades) * Math.PI * 2;
          c.strokeStyle = spec.blurCol;
          c.lineWidth = 10 - (col % 2) * 2;
          c.beginPath();
          c.arc(0, 0, 58, a - 0.55, a - 0.08);
          c.stroke();
          c.lineWidth = 4;
          c.beginPath();
          c.arc(0, 0, 42, a - 0.42, a - 0.05);
          c.stroke();
        }
        c.rotate(rot);
        c.drawImage(spec.base, -80, -80);
        c.restore();
        rCtx.drawImage(cell, col * 160, row * 160);
      }
    });

    // Row 4: Painted 2.5D edge-on Tail Rotor (8 distinct animated phase frames)
    for (let col = 0; col < 8; col++) {
      const cell = makeCv(160, 160);
      const c = cell.getContext('2d');
      c.save();
      c.translate(80, 80);
      const span = Math.abs(Math.cos((col / 8) * Math.PI * 2)) * 46 + 8;
      // Soft airflow disc
      const dg = c.createRadialGradient(0, 0, 4, 0, 0, 52);
      dg.addColorStop(0, 'rgba(210, 248, 255, 0.34)');
      dg.addColorStop(1, 'rgba(210, 248, 255, 0)');
      c.fillStyle = dg;
      c.beginPath(); c.ellipse(0, 0, span + 10, 14, 0, 0, Math.PI * 2); c.fill();
      // Top & bottom foreshortened painted blades with orange warning stripes
      c.strokeStyle = '#182948'; c.lineWidth = 3.2; c.lineJoin = 'round';
      for (const sgn of [-1, 1]) {
        const g = c.createLinearGradient(0, -6, 0, 6);
        g.addColorStop(0, '#eef7ff'); g.addColorStop(1, '#7892b0');
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(sgn < 0 ? -span : 4, -5.5, span - 4, 11, 3);
        c.fill(); c.stroke();
        if (span > 18) {
          c.fillStyle = '#ff7b24';
          c.fillRect(sgn < 0 ? -span + 3 : span - 9, -4.5, 6, 9);
        }
      }
      // Steel hub spinner
      c.fillStyle = '#2d4157';
      c.beginPath(); c.arc(0, 0, 8.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#9cd2ea';
      c.beginPath(); c.arc(-2, -2, 3, 0, Math.PI * 2); c.fill();
      c.restore();
      rCtx.drawImage(cell, col * 160, 4 * 160);
    }

    return {
      turrets: turretCv.toDataURL('image/png'),
      helis: heliCv.toDataURL('image/png'),
      rotors: rotorCv.toDataURL('image/png'),
      empl: emplCv.toDataURL('image/png'),
    };
  }, {
    helisB64: dataUrl(HELIS_SRC),
    coastalB64: dataUrl(COASTAL_SRC),
    navalB64: dataUrl(NAVAL_SRC),
    rotorsB64: dataUrl(ROTORS_SRC),
    emplB64: dataUrl(EMPL_ORIG, 'image/png'),
  });

  const toBuf = (u) => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64');
  pngToWebp(toBuf(outputs.turrets), TURRETS_OUT, 95);
  pngToWebp(toBuf(outputs.helis), HELIS_OUT, 95);
  pngToWebp(toBuf(outputs.rotors), ROTORS_OUT, 94);
  fs.writeFileSync(EMPL_ORIG, toBuf(outputs.empl));

  console.log('Packed v24 pelagic art:', {
    turretsKB: (fs.statSync(TURRETS_OUT).size / 1024).toFixed(1),
    helisKB: (fs.statSync(HELIS_OUT).size / 1024).toFixed(1),
    rotorsKB: (fs.statSync(ROTORS_OUT).size / 1024).toFixed(1),
    emplKB: (fs.statSync(EMPL_ORIG).size / 1024).toFixed(1),
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
