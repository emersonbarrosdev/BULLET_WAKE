import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'arcade', 'pelagic-review');
const SUB_PATH = path.join(OUT_DIR, 'submarines.png');
const TOWER_PATH = path.join(OUT_DIR, 'defense-tower.png');

const SUB_CLEAN_PATH = path.join(OUT_DIR, 'submarines-clean.webp');
const TOWER_CLEAN_PATH = path.join(OUT_DIR, 'defense-tower-clean.webp');
const TURRETS_PATH = path.join(OUT_DIR, 'pelagic-turrets.webp');
const HELIS_PATH = path.join(OUT_DIR, 'pelagic-helicopters.webp');
const ROTORS_PATH = path.join(OUT_DIR, 'pelagic-rotors.webp');
const ENEMY_MISSILE_PATH = path.join(OUT_DIR, 'pelagic-enemy-missile.webp');

function dataUrl(p) {
  return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
}

function pngToWebp(pngBuf, outPath, quality = 94) {
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

  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><html><body style="margin:0;background:transparent"></body></html>');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bw-pack-v2-'));
  const chrome = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=0', '--no-first-run',
    '--user-data-dir=' + profile, `http://127.0.0.1:${port}/`,
  ], { windowsHide: true, stdio: 'ignore' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let socket;
  try {
    let target;
    for (let i = 0; i < 80 && !target; i++) {
      try {
        const dbgPort = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
        target = (await (await fetch(`http://127.0.0.1:${dbgPort}/json`)).json()).find(t => t.type === 'page');
      } catch { /* wait */ }
      if (!target) await sleep(120);
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
    try { server.close(); } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}

async function main() {
  const subB64 = dataUrl(SUB_PATH);
  const towerB64 = dataUrl(TOWER_PATH);

  const outputs = await evalInChrome(async ({ subB64, towerB64 }) => {
      const loadImg = (src) => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = src;
      });
      const makeCv = (w, h) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        return c;
      };
      const INK = '#182948';

      // =========================================================================
      // 1. CLEAN SUBMARINE HULLS (2 cells x 887x887 -> remove static deck guns, keep hulls + splashes + conning tower)
      // =========================================================================
      const subImg = await loadImg(subB64);
      const subCv = makeCv(subImg.width, subImg.height);
      const subCtx = subCv.getContext('2d');
      subCtx.drawImage(subImg, 0, 0);
      const cellW = subImg.width / 2, cellH = subImg.height;
      // Sample deck turret positions: stern left turret & bow right turret in unflipped sprite
      for (let col = 0; col < 2; col++) {
        const ox = col * cellW;
        const mounts = [
          { cx: ox + cellW * 0.282, cy: cellH * 0.518, rx: 52, ry: 34 },
          { cx: ox + cellW * 0.722, cy: cellH * 0.520, rx: 52, ry: 34 },
        ];
        for (const m of mounts) {
          // Erase upper barrel protruding up-right above turret ring & gun dome silhouette cleanly
          subCtx.save();
          // First erase only the protruding diagonal gun tube region (right & slightly up from dome center)
          const data = subCtx.getImageData(ox, 0, cellW, cellH);
          const d = data.data;
          const localCx = m.cx - ox;
          const eraseTop = Math.floor(m.cy - 76);
          const eraseBot = Math.floor(m.cy + 2);
          const eraseLeft = Math.floor(localCx - 56);
          const eraseRight = Math.floor(localCx + 122);
          for (let y = Math.max(0, eraseTop); y <= Math.min(cellH - 1, eraseBot); y++) {
            for (let x = Math.max(0, eraseLeft); x <= Math.min(cellW - 1, eraseRight); x++) {
              const dx = (x - localCx) / 56;
              const dy = (y - (m.cy - 2)) / 24;
              if (y < m.cy - 3 && (dx * dx + dy * dy < 2.2 || (x >= localCx - 6 && y < m.cy - 3))) {
                const i = (y * cellW + x) * 4;
                const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
                if (a < 8) continue;
                const isSpray = col === 0 && b > r + 28 && b > 175 && g > 158;
                if (!isSpray) d[i + 3] = 0;
              }
            }
          }
          subCtx.putImageData(data, ox, 0);
          subCtx.restore();

          // Paint crisp flat submarine deck turret base collar matching hull palette
          subCtx.save();
          subCtx.translate(m.cx, m.cy - 4);
          // Flat 2.5D steel collar base ring
          const grad = subCtx.createLinearGradient(-34, -8, 34, 10);
          grad.addColorStop(0, '#3a8697');
          grad.addColorStop(0.5, '#255c6b');
          grad.addColorStop(1, '#183b47');
          subCtx.fillStyle = grad;
          subCtx.strokeStyle = INK;
          subCtx.lineWidth = 3.2;
          subCtx.beginPath();
          subCtx.ellipse(0, 4, 38, 12, 0, 0, Math.PI * 2);
          subCtx.fill();
          subCtx.stroke();

          // Orange band accent around socket rim
          subCtx.fillStyle = '#e77e22';
          subCtx.beginPath();
          subCtx.ellipse(0, 1, 31, 9, 0, 0, Math.PI * 2);
          subCtx.fill();
          subCtx.stroke();

          // Inner recessed dark socket pit for dynamic turret
          subCtx.fillStyle = '#142934';
          subCtx.beginPath();
          subCtx.ellipse(0, -1, 22, 6.5, 0, 0, Math.PI * 2);
          subCtx.fill();
          subCtx.stroke();

          // Metallic bolts along flange
          subCtx.fillStyle = '#8ad3df';
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            subCtx.beginPath();
            subCtx.arc(Math.cos(ang) * 26.5, 1 + Math.sin(ang) * 7.2, 1.8, 0, Math.PI * 2);
            subCtx.fill();
          }
          subCtx.restore();
        }
      }

      // =========================================================================
      // 2. CLEAN DEFENSE TOWER (2 cells x 887x887 -> keep ruined col 1, clean courtyard pit on col 0)
      // =========================================================================
      const twImg = await loadImg(towerB64);
      const twCv = makeCv(twImg.width, twImg.height);
      const twCtx = twCv.getContext('2d');
      twCtx.drawImage(twImg, 0, 0);
      {
        // Cell 0 top parapet courtyard covers static diagonal cannon inside lower-centered ellipse (0.506*cw, 0.368*ch)
        const cw = twImg.width / 2, ch = twImg.height;
        const cx = cw * 0.506, cy = ch * 0.368;
        const origCanvas = makeCv(cw, ch);
        origCanvas.getContext('2d').drawImage(twImg, 0, 0, cw, ch, 0, 0, cw, ch);

        twCtx.save();
        twCtx.beginPath();
        twCtx.ellipse(cx, cy, 178, 112, 0, 0, Math.PI * 2);
        twCtx.clip();

        // Warm textured sandstone cobble base matching defense-tower.png parapet floor
        const floorGrad = twCtx.createRadialGradient(cx - 28, cy - 20, 12, cx, cy, 176);
        floorGrad.addColorStop(0, '#ddb073');
        floorGrad.addColorStop(0.55, '#c18f54');
        floorGrad.addColorStop(1, '#8c6035');
        twCtx.fillStyle = floorGrad;
        twCtx.fillRect(cx - 190, cy - 120, 380, 240);

        for (let i = 0; i < 650; i++) {
          const sx = cx + ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 172;
          const sy = cy + ((Math.sin(i * 78.233) * 19341.123) % 1) * 108;
          twCtx.fillStyle = i % 2 === 0 ? 'rgba(255,228,175,0.22)' : 'rgba(92,58,28,0.20)';
          twCtx.fillRect(sx, sy, 3.4, 2.4);
        }

        twCtx.strokeStyle = 'rgba(72,44,20,0.44)';
        twCtx.lineWidth = 2.6;
        for (let r = 46; r <= 160; r += 28) {
          twCtx.beginPath();
          twCtx.ellipse(cx, cy, r * 1.05, r * 0.64, 0, 0, Math.PI * 2);
          twCtx.stroke();
        }
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2 + 0.18;
          twCtx.beginPath();
          twCtx.moveTo(cx + Math.cos(ang) * 46, cy + Math.sin(ang) * 28);
          twCtx.lineTo(cx + Math.cos(ang) * 172, cy + Math.sin(ang) * 108);
          twCtx.stroke();
        }
        twCtx.restore();

        // Restore ONLY the outer battlement wall / merlons OUTSIDE the inner parapet floor ellipse,
        // and NEVER restore dark grey/iron cannon pixels!
        const cur = twCtx.getImageData(0, 0, cw, ch);
        const orig = origCanvas.getContext('2d').getImageData(0, 0, cw, ch);
        const cd = cur.data, od = orig.data;
        for (let y = Math.floor(cy - 122); y < Math.min(ch, Math.floor(cy + 130)); y++) {
          for (let x = Math.floor(cx - 190); x < Math.min(cw, Math.floor(cx + 190)); x++) {
            const dx = (x - (cx - 6)) / 154;
            const dy = (y - (cy + 4)) / 92;
            const idx = (y * cw + x) * 4;
            const r = od[idx], g = od[idx + 1], b = od[idx + 2], a = od[idx + 3];
            const isBrightStone = a > 180 && r > b + 36 && r > 155;
            if (dx * dx + dy * dy >= 1.0 && (y < cy + 10 || isBrightStone || dx * dx + dy * dy >= 1.32)) {
              cd[idx] = r; cd[idx + 1] = g; cd[idx + 2] = b; cd[idx + 3] = a;
            }
          }
        }
        twCtx.putImageData(cur, 0, 0);

        // Dark riveted circular turret base ring in center of tower courtyard (0.506, 0.354)
        twCtx.save();
        twCtx.translate(cx, ch * 0.354);
        twCtx.fillStyle = '#3b424c';
        twCtx.strokeStyle = INK;
        twCtx.lineWidth = 4;
        twCtx.beginPath();
        twCtx.ellipse(0, 2, 72, 46, 0, 0, Math.PI * 2);
        twCtx.fill();
        twCtx.stroke();

        twCtx.fillStyle = '#586475';
        twCtx.beginPath();
        twCtx.ellipse(0, -1, 60, 38, 0, 0, Math.PI * 2);
        twCtx.fill();
        twCtx.stroke();

        twCtx.fillStyle = '#252a32';
        twCtx.beginPath();
        twCtx.ellipse(0, -2, 42, 26, 0, 0, Math.PI * 2);
        twCtx.fill();
        twCtx.stroke();

        twCtx.fillStyle = '#92a3b6';
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          twCtx.beginPath();
          twCtx.arc(Math.cos(ang) * 65, -0.5 + Math.sin(ang) * 41, 3.2, 0, Math.PI * 2);
          twCtx.fill();
        }
        twCtx.restore();
      }

      // =========================================================================
      // 3. PELAGIC TURRETS SHEET (4 cols x 2 rows, 160x160 -> 640x320)
      // Pivot ALWAYS at (80, 61) -> (0.5, 0.38125), barrel points STRAIGHT DOWN (+Y),
      // muzzle tip ALWAYS at y = 144 -> (144 - 61) / 160 = 0.51875 * displaySize!
      // Frame 0: Boat Twin Turret
      // Frame 1: Ship Heavy Naval Twin Cannon
      // Frame 2: Submarine Deck Gun (Teal & Orange)
      // Frame 3: Bunker Heavy Coastal Turret (Brass/Gunmetal)
      // Frame 4: Tower Fortress Iron Cannon
      // Frame 5: Warhawk Chin Gatling Turret
      // Frame 6: Warhawk Armored Missile Pod (top hatch)
      // =========================================================================
      const turretCv = makeCv(640, 320);
      const tCtx = turretCv.getContext('2d');
      const drawTurretCell = (col, row, drawFn) => {
        const cell = makeCv(160, 160);
        const cx = cell.getContext('2d');
        cx.save();
        cx.translate(80, 61);
        drawFn(cx);
        cx.restore();
        tCtx.drawImage(cell, col * 160, row * 160);
      };

      const roundRect = (ctx, x, y, w, h, r) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, r);
      };

      // Frame 0: Boat Coral-Chrome Dual Light Turret
      drawTurretCell(0, 0, (ctx) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.lineJoin = 'round';
        // Twin barrels down to +83
        for (const bx of [-10, 10]) {
          const bg = ctx.createLinearGradient(bx - 5, 0, bx + 5, 0);
          bg.addColorStop(0, '#c8d6e6'); bg.addColorStop(0.5, '#ffffff'); bg.addColorStop(1, '#6f85a3');
          ctx.fillStyle = bg;
          roundRect(ctx, bx - 4.8, 12, 9.6, 71, 3);
          ctx.fill(); ctx.stroke();
          // Muzzle collar
          ctx.fillStyle = '#334866';
          roundRect(ctx, bx - 6, 72, 12, 11, 2.5);
          ctx.fill(); ctx.stroke();
        }
        // Circular armored turret base
        const dg = ctx.createRadialGradient(-6, -8, 4, 0, 0, 29);
        dg.addColorStop(0, '#ff8e72'); dg.addColorStop(0.55, '#eb5b42'); dg.addColorStop(1, '#9e2e24');
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Top hatch + highlight
        ctx.fillStyle = '#ffe3cc';
        ctx.beginPath(); ctx.arc(-4, -5, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });

      // Frame 1: Ship Heavy Armored Twin Naval Cannon
      drawTurretCell(1, 0, (ctx) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.lineJoin = 'round';
        // Bolted deck mount shadow ring
        ctx.fillStyle = '#25384b';
        ctx.beginPath(); ctx.arc(0, 2, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Long heavy twin gun barrels down to y = +83
        for (const bx of [-12, 12]) {
          const bg = ctx.createLinearGradient(bx - 6, 0, bx + 6, 0);
          bg.addColorStop(0, '#62788e'); bg.addColorStop(0.45, '#d5e4f0'); bg.addColorStop(1, '#394a5c');
          ctx.fillStyle = bg;
          roundRect(ctx, bx - 5.5, 18, 11, 65, 3);
          ctx.fill(); ctx.stroke();
          // Heavy muzzle brake
          ctx.fillStyle = '#2c3d4f';
          roundRect(ctx, bx - 7.5, 70, 15, 13, 3);
          ctx.fill(); ctx.stroke();
        }
        // Faceted angular warship turret housing
        const dg = ctx.createLinearGradient(-28, -28, 28, 28);
        dg.addColorStop(0, '#6ae0df'); dg.addColorStop(0.38, '#239ca3'); dg.addColorStop(1, '#125361');
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.moveTo(-22, -26); ctx.lineTo(22, -26);
        ctx.lineTo(31, -4); ctx.lineTo(26, 24);
        ctx.lineTo(-26, 24); ctx.lineTo(-31, -4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Roof hatch & rangefinder bar
        ctx.fillStyle = '#b4c8d8';
        roundRect(ctx, -18, -14, 36, 12, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffe174';
        ctx.beginPath(); ctx.arc(0, -19, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });

      // Frame 2: Submarine Articulated Teal & Orange Deck Gun
      drawTurretCell(2, 0, (ctx) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.lineJoin = 'round';
        // Single thick naval deck barrel pointing straight down (+83)
        const bg = ctx.createLinearGradient(-9, 0, 9, 0);
        bg.addColorStop(0, '#366575'); bg.addColorStop(0.42, '#8ac6d4'); bg.addColorStop(1, '#183844');
        ctx.fillStyle = bg;
        roundRect(ctx, -8.5, 14, 17, 69, 4); ctx.fill(); ctx.stroke();
        // Barrel band + flared muzzle brake
        ctx.fillStyle = '#f28c28';
        roundRect(ctx, -10.5, 42, 21, 10, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1c3b47';
        roundRect(ctx, -11, 71, 22, 12, 3); ctx.fill(); ctx.stroke();
        // Rounded submarine dome matching submarines.png
        const dg = ctx.createRadialGradient(-8, -8, 4, 0, 0, 31);
        dg.addColorStop(0, '#59a7b8'); dg.addColorStop(0.55, '#276475'); dg.addColorStop(1, '#133540');
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Signature orange band across turret dome
        ctx.fillStyle = '#f28c28';
        roundRect(ctx, -27, -6, 54, 11, 5); ctx.fill(); ctx.stroke();
        // Optical hatch sight
        ctx.fillStyle = '#ffdf6b';
        ctx.beginPath(); ctx.arc(0, -14, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });

      // Frame 3: Coastal Bunker Heavy Turret (Tank/Emplacement)
      drawTurretCell(3, 0, (ctx) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 4.2; ctx.lineJoin = 'round';
        // Heavy siege barrel pointing down to +83
        const bg = ctx.createLinearGradient(-10, 0, 10, 0);
        bg.addColorStop(0, '#4f5866'); bg.addColorStop(0.45, '#b6c2cf'); bg.addColorStop(1, '#282f38');
        ctx.fillStyle = bg;
        roundRect(ctx, -9.5, 16, 19, 67, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c88432';
        roundRect(ctx, -12, 68, 24, 15, 3.5); ctx.fill(); ctx.stroke();
        // Armored riveted octagonal turret housing
        const dg = ctx.createLinearGradient(-30, -30, 30, 30);
        dg.addColorStop(0, '#f0bb62'); dg.addColorStop(0.5, '#b57b33'); dg.addColorStop(1, '#68421b');
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.moveTo(-20, -28); ctx.lineTo(20, -28); ctx.lineTo(32, -8); ctx.lineTo(28, 22);
        ctx.lineTo(-28, 22); ctx.lineTo(-32, -8); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Gunmetal top cupola
        ctx.fillStyle = '#505b69';
        ctx.beginPath(); ctx.arc(0, -4, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd573';
        ctx.beginPath(); ctx.arc(-4, -7, 4.5, 0, Math.PI * 2); ctx.fill();
      });

      // Frame 4 (col 0 row 1): Defense Tower Heavy Iron Fortress Cannon
      drawTurretCell(0, 1, (ctx) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 4.4; ctx.lineJoin = 'round';
        // Massive cast-iron barrel pointing down (+83)
        const bg = ctx.createLinearGradient(-13, 0, 13, 0);
        bg.addColorStop(0, '#404856'); bg.addColorStop(0.42, '#96a5b8'); bg.addColorStop(1, '#1e242c');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(-13, 6); ctx.lineTo(13, 6); ctx.lineTo(10, 72); ctx.lineTo(14, 83);
        ctx.lineTo(-14, 83); ctx.lineTo(-10, 72); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Cascading cast iron reinforcing rings
        for (const ry of [24, 48, 72]) {
          ctx.fillStyle = '#627082';
          roundRect(ctx, -14.5, ry, 29, 7.5, 3); ctx.fill(); ctx.stroke();
        }
        // Riveted iron swiveling carriage cheeks & breach knob
        const dg = ctx.createLinearGradient(-28, -28, 28, 24);
        dg.addColorStop(0, '#6e7c8e'); dg.addColorStop(0.55, '#434d5b'); dg.addColorStop(1, '#252a33');
        ctx.fillStyle = dg;
        roundRect(ctx, -28, -24, 56, 44, 14); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#333b46';
        ctx.beginPath(); ctx.arc(0, -25, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Highlight rivets
        ctx.fillStyle = '#c5d4e6';
        for (const [rx, ry] of [[-18,-12],[18,-12],[-18,10],[18,10]]) {
          ctx.beginPath(); ctx.arc(rx, ry, 2.8, 0, Math.PI * 2); ctx.fill();
        }
      });

      // Frame 5 (col 1 row 1): Warhawk Chin Gatling Turret
      drawTurretCell(1, 1, (ctx) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        // Twin-rotary chin barrels pointing down (+83)
        ctx.fillStyle = '#3a4249';
        roundRect(ctx, -8, 12, 16, 71, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9aa6b2';
        for (const bx of [-4.5, 0, 4.5]) {
          ctx.fillRect(bx - 1.5, 18, 3, 60);
        }
        ctx.fillStyle = '#252b30';
        roundRect(ctx, -10.5, 68, 21, 15, 3); ctx.fill(); ctx.stroke();
        // Olive-drab & gunmetal chin dome
        const dg = ctx.createRadialGradient(-5, -5, 2, 0, 0, 22);
        dg.addColorStop(0, '#7c8e50'); dg.addColorStop(0.6, '#4f6632'); dg.addColorStop(1, '#283619');
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Yellow targeting lens
        ctx.fillStyle = '#ffd64d';
        ctx.beginPath(); ctx.arc(0, -8, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });

      // Frame 6 (col 2 row 1): Warhawk Right-Wing Missile Pod (faces straight down +Y)
      drawTurretCell(2, 1, (ctx) => {
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        // Armored olive/khaki rectangular pod
        const dg = ctx.createLinearGradient(-22, -26, 22, 34);
        dg.addColorStop(0, '#819453'); dg.addColorStop(0.55, '#4b5f2e'); dg.addColorStop(1, '#2a371a');
        ctx.fillStyle = dg;
        roundRect(ctx, -22, -22, 44, 58, 7); ctx.fill(); ctx.stroke();
        // Hazard yellow stripe
        ctx.fillStyle = '#f4b932';
        ctx.fillRect(-19, 10, 38, 10);
        ctx.strokeRect(-19, 10, 38, 10);
        // Dark quad launcher mouths pointing down (+Y) + extended launch rail to +83
        ctx.fillStyle = '#24292e';
        roundRect(ctx, -18, 26, 36, 57, 4); ctx.fill(); ctx.stroke();
        // Red warhead nose tips seated inside tubes
        for (const wx of [-9, 9]) {
          ctx.fillStyle = '#ff4b3a';
          ctx.beginPath(); ctx.arc(wx, 68, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      });

      // =========================================================================
      // 4. FOUR DISTINCT 2.5D HELICOPTERS (6 cols x 4 rows @ 192x192 -> 1152x768)
      // Orientation: Nose pointing UP (-Y) just like enemies.webp / pelagic-enemy-air.webp!
      // Cols 0..4: smooth bank [-1, -0.5, 0, +0.5, +1], Col 5: attack pitch / recoil pose
      // =========================================================================
      const drawBanked = (srcCv, bank, pitchY = 0, yawMax = 0.14, rollMax = 0.56) => {
        const out = makeCv(192, 192);
        const octx = out.getContext('2d');
        const tmp = makeCv(192, 192);
        const tx = tmp.getContext('2d');
        const phi = bank * rollMax;
        const sx = Math.max(0.56, Math.cos(phi));
        const yaw = bank * yawMax;
        tx.save();
        tx.translate(96, 96 + pitchY);
        tx.rotate(yaw);
        tx.scale(sx, 1);
        tx.drawImage(srcCv, -96, -96);
        if (Math.abs(bank) > 0.05) {
          tx.globalCompositeOperation = 'source-atop';
          const grad = tx.createLinearGradient(-72, 0, 72, 0);
          const sa = Math.min(0.28, Math.abs(bank) * 0.24).toFixed(2);
          const ha = Math.min(0.24, Math.abs(bank) * 0.20).toFixed(2);
          if (bank < 0) {
            grad.addColorStop(0, `rgba(12,24,58,${sa})`); grad.addColorStop(0.45, 'rgba(12,24,58,0)');
            grad.addColorStop(0.55, 'rgba(255,255,255,0)'); grad.addColorStop(1, `rgba(245,252,255,${ha})`);
          } else {
            grad.addColorStop(0, `rgba(245,252,255,${ha})`); grad.addColorStop(0.45, 'rgba(255,255,255,0)');
            grad.addColorStop(0.55, 'rgba(12,24,58,0)'); grad.addColorStop(1, `rgba(12,24,58,${sa})`);
          }
          tx.fillStyle = grad; tx.fillRect(-96, -96, 192, 192);
        }
        tx.restore();
        octx.drawImage(tmp, 0, 0);
        return out;
      };

      const drawHeliScoutBase = (pitchMode = false) => {
        const c = makeCv(192, 192), ctx = c.getContext('2d');
        ctx.translate(96, 96); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        // Twin sleek tailbooms & V-fin at +Y
        ctx.fillStyle = '#cbe7f8';
        ctx.beginPath(); ctx.moveTo(-16, 18); ctx.lineTo(-10, 68); ctx.lineTo(-4, 68); ctx.lineTo(-8, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, 18); ctx.lineTo(10, 68); ctx.lineTo(4, 68); ctx.lineTo(8, 18); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Lime rear stabilizer crossbar
        ctx.fillStyle = '#84e635';
        roundRect(ctx, -20, 56, 40, 10, 4); ctx.fill(); ctx.stroke();
        // Landing skids
        ctx.strokeStyle = '#3c556e'; ctx.lineWidth = 3.2;
        for (const sx of [-24, 24]) {
          ctx.beginPath(); ctx.moveTo(sx, -24); ctx.lineTo(sx, 26); ctx.stroke();
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 4;
        // Side cyan thruster pods
        for (const sx of [-26, 26]) {
          ctx.fillStyle = '#1fd2f5';
          roundRect(ctx, sx - 8, -16, 16, 36, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#84e635';
          ctx.fillRect(sx - 5, -8, 10, 6);
        }
        // Streamlined pearl-white scout hull (nose -Y)
        const hg = ctx.createLinearGradient(-22, -52, 22, 34);
        hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.55, '#d6eeff'); hg.addColorStop(1, '#79a8ce');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(0, -56); ctx.bezierCurveTo(22, -46, 25, -8, 19, 28);
        ctx.lineTo(0, 36); ctx.lineTo(-19, 28);
        ctx.bezierCurveTo(-25, -8, -22, -46, 0, -56);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Gloss cyan canopy bubble
        const cg = ctx.createRadialGradient(-4, -30, 2, 0, -24, 22);
        cg.addColorStop(0, '#a6f9ff'); cg.addColorStop(0.55, '#26a9ff'); cg.addColorStop(1, '#124e8a');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.ellipse(0, -26, 13, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.ellipse(-4, -33, 4.2, 7.5, -0.25, 0, Math.PI * 2); ctx.fill();
        // Twin nose micro-blaster ports
        for (const gx of [-8, 8]) {
          ctx.fillStyle = pitchMode ? '#fff282' : '#1fd2f5';
          roundRect(ctx, gx - 2.6, -61, 5.2, 9, 2); ctx.fill(); ctx.stroke();
        }
        // Center mast hub socket
        ctx.fillStyle = '#2d4766';
        ctx.beginPath(); ctx.arc(0, -2, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        return c;
      };

      const drawHeliUtilityBase = (pitchMode = false) => {
        const c = makeCv(192, 192), ctx = c.getContext('2d');
        ctx.translate(96, 96); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        // Twin side outrigger pylons holding twin turbine rotor pods at (-38,-6) and (+38,-6)
        ctx.fillStyle = '#5d7490';
        roundRect(ctx, -46, -15, 92, 18, 6); ctx.fill(); ctx.stroke();
        // Rugged cargo skids
        ctx.strokeStyle = '#334254'; ctx.lineWidth = 3.8;
        for (const sx of [-28, 28]) {
          ctx.beginPath(); ctx.moveTo(sx, -34); ctx.lineTo(sx, 36); ctx.stroke();
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 4;
        // Twin outboard turbine nacelles
        for (const nx of [-42, 42]) {
          const ng = ctx.createLinearGradient(nx - 11, -28, nx + 11, 20);
          ng.addColorStop(0, '#ffae4c'); ng.addColorStop(0.5, '#f27c24'); ng.addColorStop(1, '#984210');
          ctx.fillStyle = ng;
          roundRect(ctx, nx - 11.5, -24, 23, 42, 9); ctx.fill(); ctx.stroke();
          // Intake rim + rotor mast
          ctx.fillStyle = '#2b3848';
          ctx.beginPath(); ctx.arc(nx, -3, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        // Boxy industrial tail boom + cream hazard V-tail
        ctx.fillStyle = '#6f87a3';
        roundRect(ctx, -11, 26, 22, 42, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff942e';
        roundRect(ctx, -28, 56, 56, 12, 4); ctx.fill(); ctx.stroke();
        // Main chunky armored utility fuselage (Safety Tangerine + Slate + Cream)
        const fg = ctx.createLinearGradient(-26, -54, 26, 38);
        fg.addColorStop(0, '#ffba5c'); fg.addColorStop(0.45, '#f48628'); fg.addColorStop(1, '#9f4712');
        ctx.fillStyle = fg;
        roundRect(ctx, -25, -52, 50, 84, 15); ctx.fill(); ctx.stroke();
        // Spine titanium armor plate + hazard chevron
        ctx.fillStyle = '#637a95';
        roundRect(ctx, -16, -24, 32, 50, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff3d2';
        ctx.fillRect(-13, 8, 26, 8); ctx.strokeRect(-13, 8, 26, 8);
        // Wide futuristic visor cockpit
        const cg = ctx.createLinearGradient(-18, -50, 18, -28);
        cg.addColorStop(0, '#c8f8ff'); cg.addColorStop(0.5, '#3fa5dc'); cg.addColorStop(1, '#1d4b75');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(-18, -32); ctx.quadraticCurveTo(0, -54, 18, -32);
        ctx.lineTo(14, -22); ctx.lineTo(-14, -22); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Twin under-nose turret cannon stubs (-12, -55) & (+12, -55)
        for (const cx2 of [-13, 13]) {
          ctx.fillStyle = pitchMode ? '#fff282' : '#435469';
          roundRect(ctx, cx2 - 3.5, -60, 7, 11, 2); ctx.fill(); ctx.stroke();
        }
        return c;
      };

      const drawHeliPhantomBase = (pitchMode = false) => {
        const c = makeCv(192, 192), ctx = c.getContext('2d');
        ctx.translate(96, 96); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        // Swept stealth canards & jagged bat-like stub wings
        const wg = ctx.createLinearGradient(-56, -20, 56, 32);
        wg.addColorStop(0, '#3a2c72'); wg.addColorStop(0.5, '#684bb5'); wg.addColorStop(1, '#261e4a');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(-18, -12); ctx.lineTo(-56, 10); ctx.lineTo(-48, 28); ctx.lineTo(-16, 20);
        ctx.lineTo(16, 20); ctx.lineTo(48, 28); ctx.lineTo(56, 10); ctx.lineTo(18, -12);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Split stealth V-tail
        ctx.fillStyle = '#473688';
        ctx.beginPath();
        ctx.moveTo(-10, 26); ctx.lineTo(-28, 70); ctx.lineTo(-14, 74); ctx.lineTo(0, 42);
        ctx.lineTo(14, 74); ctx.lineTo(28, 70); ctx.lineTo(10, 26); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Faceted angular stealth fuselage
        const hg = ctx.createLinearGradient(-22, -62, 22, 42);
        hg.addColorStop(0, '#8565d6'); hg.addColorStop(0.45, '#4b388c'); hg.addColorStop(1, '#221847');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(0, -64); ctx.lineTo(22, -26); ctx.lineTo(24, 18); ctx.lineTo(10, 44);
        ctx.lineTo(-10, 44); ctx.lineTo(-24, 18); ctx.lineTo(-22, -26);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Neon magenta stealth glow slits along chine edges
        ctx.fillStyle = pitchMode ? '#fff299' : '#ff4eb8';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 18, -22); ctx.lineTo(s * 22, 8); ctx.lineTo(s * 16, 10); ctx.lineTo(s * 13, -18);
          ctx.closePath(); ctx.fill();
        }
        // Shrouded dorsal ducted-fan shroud ring around main hub
        ctx.strokeStyle = INK; ctx.lineWidth = 3.8;
        ctx.fillStyle = '#2d3354';
        ctx.beginPath(); ctx.arc(0, -2, 23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff4eb8';
        ctx.beginPath(); ctx.arc(0, -2, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1f233b';
        ctx.beginPath(); ctx.arc(0, -2, 11, 0, Math.PI * 2); ctx.fill();
        // Razor V-shaped neon magenta/cyan canopy
        const cg = ctx.createLinearGradient(-10, -54, 10, -26);
        cg.addColorStop(0, '#ffb6ec'); cg.addColorStop(0.55, '#c42e96'); cg.addColorStop(1, '#4c1456');
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.moveTo(0, -55); ctx.lineTo(11, -34); ctx.lineTo(0, -24); ctx.lineTo(-11, -34);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Triple micro emitters on wings & nose
        ctx.fillStyle = pitchMode ? '#ffffff' : '#ff72cb';
        for (const [ex, ey] of [[-32, 8], [0, -64], [32, 8]]) {
          ctx.beginPath(); ctx.arc(ex, ey, 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        return c;
      };

      const drawHeliWarhawkBase = (launcherRecoil = false) => {
        const c = makeCv(192, 192), ctx = c.getContext('2d');
        ctx.translate(96, 96); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        // Long armored military tailboom & horizontal T-stabilizer (+Y)
        const tg = ctx.createLinearGradient(-10, 22, 10, 74);
        tg.addColorStop(0, '#6a7d44'); tg.addColorStop(1, '#313d1e');
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(-12, 20); ctx.lineTo(12, 20); ctx.lineTo(7, 74); ctx.lineTo(-7, 74); ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Horizontal tail stabilizer fins + vertical fin
        ctx.fillStyle = '#4e612d';
        roundRect(ctx, -28, 56, 56, 11, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f4b932';
        ctx.fillRect(-24, 58, 7, 7); ctx.fillRect(17, 58, 7, 7);

        // Heavy armored stub wings carrying ordnance racks
        const wg = ctx.createLinearGradient(-64, -14, 64, 18);
        wg.addColorStop(0, '#445428'); wg.addColorStop(0.5, '#778a4b'); wg.addColorStop(1, '#374420');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(-18, -16); ctx.lineTo(-62, -2); ctx.lineTo(-56, 16); ctx.lineTo(-18, 12);
        ctx.lineTo(18, 12); ctx.lineTo(56, 16); ctx.lineTo(62, -2); ctx.lineTo(18, -16);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Left-wing auxiliary fuel/sensor pod
        ctx.fillStyle = '#38424a';
        roundRect(ctx, -50, -10, 14, 30, 5); ctx.fill(); ctx.stroke();
        // Right-wing SIGNATURE ARMORED MISSILE LAUNCHER POD (also overlaid by dynamic Mount 1!)
        ctx.fillStyle = '#4d5d2f';
        roundRect(ctx, 34, -16, 24, 34, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f4b932';
        ctx.fillRect(36, 4, 20, 6);
        if (launcherRecoil) {
          ctx.fillStyle = 'rgba(255,215,90,0.85)';
          ctx.beginPath(); ctx.arc(46, -20, 8, 0, Math.PI * 2); ctx.fill();
        }

        // Main bulky Apache/Hind gunmetal-olive armored airframe
        const hg = ctx.createLinearGradient(-24, -60, 24, 36);
        hg.addColorStop(0, '#7c8f51'); hg.addColorStop(0.5, '#4b5f2d'); hg.addColorStop(1, '#2a3719');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(0, -64); ctx.lineTo(17, -46); ctx.lineTo(24, -10); ctx.lineTo(20, 28);
        ctx.lineTo(0, 38); ctx.lineTo(-20, 28); ctx.lineTo(-24, -10); ctx.lineTo(-17, -46);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Twin outboard turbine housings flanking rotor mast
        for (const tx of [-18, 18]) {
          ctx.fillStyle = '#313a42';
          roundRect(ctx, tx - 7, -18, 14, 32, 5); ctx.fill(); ctx.stroke();
        }
        // Tactical chevron badge
        ctx.fillStyle = '#f4b932';
        ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(11, 22); ctx.lineTo(0, 26); ctx.lineTo(-11, 22); ctx.closePath(); ctx.fill();
        // Stepped armored tandem canopy
        const cg = ctx.createLinearGradient(-10, -52, 10, -18);
        cg.addColorStop(0, '#9be4ff'); cg.addColorStop(0.55, '#3b88b8'); cg.addColorStop(1, '#1a3a54');
        ctx.fillStyle = cg;
        roundRect(ctx, -10, -50, 20, 30, 6); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#252e36'; ctx.lineWidth = 2.6;
        ctx.beginPath(); ctx.moveTo(-10, -35); ctx.lineTo(10, -35); ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 4;
        // Chin mount ring at nose (0, -58)
        ctx.fillStyle = '#2d363e';
        ctx.beginPath(); ctx.arc(0, -55, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Heavy main mast armor cap
        ctx.fillStyle = '#333d45';
        ctx.beginPath(); ctx.arc(0, -2, 9.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        return c;
      };

      const banks = [-1, -0.5, 0, 0.5, 1];
      const heliBases = [drawHeliScoutBase, drawHeliUtilityBase, drawHeliPhantomBase, drawHeliWarhawkBase];
      const heliSheet = makeCv(192 * 6, 192 * 4);
      const hc = heliSheet.getContext('2d');
      for (let r = 0; r < 4; r++) {
        const normalBase = heliBases[r](false);
        const attackBase = heliBases[r](true);
        for (let c = 0; c < 5; c++) {
          hc.drawImage(drawBanked(normalBase, banks[c], 0), c * 192, r * 192);
        }
        hc.drawImage(drawBanked(attackBase, 0, r === 3 ? 3 : -2), 5 * 192, r * 192);
      }

      // =========================================================================
      // 5. ANIMATED HELICOPTER ROTORS SHEET (8 cols x 5 rows @ 160x160 -> 1280x800)
      // Row 0: Scout 4-blade white/cyan swept rotor
      // Row 1: Utility 3-blade industrial tangerine/slate rotor (used on both side nacelles!)
      // Row 2: Phantom 5-blade stealth indigo/magenta rotor
      // Row 3: Warhawk 4-blade wide military olive/yellow-tip heavy rotor
      // Row 4: Spinning Tail Rotors (horizontal/angled high-RPM discs)
      // =========================================================================
      const rotorCv = makeCv(160 * 8, 160 * 5);
      const rc = rotorCv.getContext('2d');
      const rotorSpecs = [
        { blades: 4, len: 68, wid: 8, body: '#eef8ff', tip: '#1fd2f5', blur: 'rgba(31,210,245,0.22)', hub: '#2d4766' },
        { blades: 3, len: 62, wid: 10, body: '#6e849e', tip: '#ff942e', blur: 'rgba(255,148,46,0.22)', hub: '#3d4c5c' },
        { blades: 5, len: 66, wid: 7.5, body: '#3c2e6b', tip: '#ff4eb8', blur: 'rgba(255,78,184,0.24)', hub: '#ff4eb8' },
        { blades: 4, len: 74, wid: 11.5, body: '#4a545c', tip: '#f4b932', blur: 'rgba(220,235,210,0.20)', hub: '#2c353d' },
      ];
      for (let r = 0; r < 4; r++) {
        const sp = rotorSpecs[r];
        for (let c = 0; c < 8; c++) {
          const cell = makeCv(160, 160), x = cell.getContext('2d');
          x.translate(80, 80);
          const stepAng = (c / 8) * (Math.PI * 2 / sp.blades);
          // Translucent swept motion blur arc sectors behind blades (non-static look!)
          for (let b = 0; b < sp.blades; b++) {
            const a = stepAng + (b * Math.PI * 2) / sp.blades;
            x.save();
            x.rotate(a);
            const ag = x.createRadialGradient(0, 0, 10, 0, 0, sp.len);
            ag.addColorStop(0, 'rgba(255,255,255,0)');
            ag.addColorStop(0.55, sp.blur);
            ag.addColorStop(1, 'rgba(255,255,255,0.04)');
            x.fillStyle = ag;
            x.beginPath();
            x.moveTo(0, 0);
            x.arc(0, 0, sp.len - 2, -0.52, 0.08);
            x.closePath();
            x.fill();

            // Crisp cel blade
            x.strokeStyle = INK; x.lineWidth = 2.6; x.lineJoin = 'round';
            x.fillStyle = sp.body;
            x.beginPath();
            x.roundRect(6, -sp.wid / 2, sp.len - 6, sp.wid, 3);
            x.fill(); x.stroke();
            // Bright blade tip stripe
            x.fillStyle = sp.tip;
            x.fillRect(sp.len - 13, -sp.wid / 2 + 1.2, 10, sp.wid - 2.4);
            // Gloss highlight edge
            x.fillStyle = 'rgba(255,255,255,0.38)';
            x.fillRect(10, -sp.wid / 2 + 1.5, sp.len - 25, 2.2);
            x.restore();
          }
          // Outer aerodynamic whisper tip ring (very subtle, animated rotation ticks)
          x.strokeStyle = sp.blur; x.lineWidth = 2.2;
          x.beginPath(); x.arc(0, 0, sp.len - 1, stepAng, stepAng + 1.1); x.stroke();
          x.beginPath(); x.arc(0, 0, sp.len - 1, stepAng + Math.PI, stepAng + Math.PI + 1.1); x.stroke();
          // Central spinner hub cap
          x.strokeStyle = INK; x.lineWidth = 3;
          x.fillStyle = sp.hub;
          x.beginPath(); x.arc(0, 0, 9.5, 0, Math.PI * 2); x.fill(); ctx_dot(x, 0, 0, 3.8, '#e8f5ff');
          x.stroke();
          rc.drawImage(cell, c * 160, r * 160);
        }
      }
      function ctx_dot(ctx, x, y, r, col) {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      // Row 4: Animated tail rotor spin frames (8 cols)
      for (let c = 0; c < 8; c++) {
        const cell = makeCv(160, 160), x = cell.getContext('2d');
        x.translate(80, 80);
        const phase = (c / 8) * Math.PI * 2;
        const w = Math.abs(Math.cos(phase)) * 46 + 10;
        x.fillStyle = 'rgba(230,248,255,0.28)';
        x.beginPath(); x.ellipse(0, 0, 44, 14, 0, 0, Math.PI * 2); x.fill();
        x.strokeStyle = INK; x.lineWidth = 3;
        x.fillStyle = '#dce8f2';
        x.beginPath(); x.roundRect(-w, -5.5, w * 2, 11, 4); x.fill(); x.stroke();
        x.fillStyle = '#ff6a42';
        x.fillRect(-w + 2, -4, 7, 8); x.fillRect(w - 9, -4, 7, 8);
        x.fillStyle = '#334252';
        x.beginPath(); x.arc(0, 0, 6.5, 0, Math.PI * 2); x.fill(); x.stroke();
        rc.drawImage(cell, c * 160, 4 * 160);
      }

      // =========================================================================
      // 6. DEDICATED ANIMATED ENEMY STRAIGHT MISSILE (4 cols x 1 row @ 128x128 -> 512x128)
      // Nose points straight UP (-Y) so angle + PI/2 aligns cleanly along flight path!
      // =========================================================================
      const misCv = makeCv(512, 128), mc = misCv.getContext('2d');
      for (let f = 0; f < 4; f++) {
        const cell = makeCv(128, 128), x = cell.getContext('2d');
        x.translate(64, 58);
        const flLen = 30 + (f % 2) * 11 + (f === 3 ? 6 : 0);
        const flW = 10 + (f % 3) * 2.2;
        // Rocket booster flame tail (+Y)
        const fg = x.createLinearGradient(0, 20, 0, 22 + flLen);
        fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.28, '#ffef78'); fg.addColorStop(0.68, '#ff6a22'); fg.addColorStop(1, 'rgba(255,48,20,0)');
        x.fillStyle = fg;
        x.beginPath();
        x.moveTo(-flW, 22);
        x.quadraticCurveTo(0, 26 + flLen * 1.15, flW, 22);
        x.closePath(); x.fill();
        // Hot inner core tongue
        x.fillStyle = '#ffffff';
        x.beginPath(); x.ellipse(0, 29, 4.2, flLen * 0.34, 0, 0, Math.PI * 2); x.fill();

        x.strokeStyle = INK; x.lineWidth = 3.8; x.lineJoin = 'round';
        // Swept tail stabilizer fins
        x.fillStyle = '#c83c32';
        x.beginPath();
        x.moveTo(-8, 8); x.lineTo(-22, 24); x.lineTo(-10, 26); x.lineTo(-6, 18);
        x.lineTo(6, 18); x.lineTo(10, 26); x.lineTo(22, 24); x.lineTo(8, 8);
        x.closePath(); x.fill(); x.stroke();
        // Cylindrical fuselage
        const bg = x.createLinearGradient(-10, -28, 10, 22);
        bg.addColorStop(0, '#eef5fa'); bg.addColorStop(0.55, '#a8bccb'); bg.addColorStop(1, '#586978');
        x.fillStyle = bg;
        x.beginPath();
        x.moveTo(0, -48);
        x.bezierCurveTo(10, -34, 11, -18, 10, 24);
        x.lineTo(-10, 24);
        x.bezierCurveTo(-11, -18, -10, -34, 0, -48);
        x.closePath(); x.fill(); x.stroke();
        // Distinct red high-visibility warhead cone + yellow hazard band
        x.fillStyle = '#ff4338';
        x.beginPath();
        x.moveTo(0, -48);
        x.bezierCurveTo(9, -35, 10, -24, 10, -18);
        x.lineTo(-10, -18);
        x.bezierCurveTo(-10, -24, -9, -35, 0, -48);
        x.closePath(); x.fill(); x.stroke();
        x.fillStyle = '#ffd53e';
        x.fillRect(-9.5, -16, 19, 8);
        x.strokeRect(-9.5, -16, 19, 8);
        // Specular stripe
        x.fillStyle = 'rgba(255,255,255,0.6)';
        x.fillRect(-5.5, -6, 3.2, 26);

        mc.drawImage(cell, f * 128, 0);
      }

      return {
        subClean: subCv.toDataURL('image/png'),
        towerClean: twCv.toDataURL('image/png'),
        turrets: turretCv.toDataURL('image/png'),
        helis: heliSheet.toDataURL('image/png'),
        rotors: rotorCv.toDataURL('image/png'),
        missile: misCv.toDataURL('image/png'),
    };
  }, { subB64, towerB64 });

  const save = (b64, outPath, q = 94) => {
    const buf = Buffer.from(b64.split(',')[1], 'base64');
    pngToWebp(buf, outPath, q);
    const sz = fs.statSync(outPath).size;
    console.log('Wrote', path.relative(ROOT, outPath), `${(sz / 1024).toFixed(1)} KB`);
  };

  save(outputs.subClean, SUB_CLEAN_PATH, 94);
  save(outputs.towerClean, TOWER_CLEAN_PATH, 94);
  save(outputs.turrets, TURRETS_PATH, 95);
  save(outputs.helis, HELIS_PATH, 95);
  save(outputs.rotors, ROTORS_PATH, 94);
  save(outputs.missile, ENEMY_MISSILE_PATH, 95);
}

main().catch(err => { console.error(err); process.exit(1); });
