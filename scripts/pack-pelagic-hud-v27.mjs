import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const uiDir = resolve('public/assets/arcade/ui');
mkdirSync(uiDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const profile = mkdtempSync(join(tmpdir(), 'bw-hud-v27-'));
const port = 9231;

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--no-first-run',
    '--user-data-dir=' + profile,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function connectCdp() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find(t => t.type === 'page') ?? targets[0];
      if (page?.webSocketDebuggerUrl) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((ok, err) => {
          ws.addEventListener('open', ok, { once: true });
          ws.addEventListener('error', err, { once: true });
        });
        return ws;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error('Could not connect to headless Chrome CDP');
}

function makeEvaluator(ws) {
  let id = 1;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve: res, reject: rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message));
      else res(msg.result);
    }
  });
  return async expression => {
    const cid = id++;
    const p = new Promise((res, rej) => pending.set(cid, { resolve: res, reject: rej }));
    ws.send(JSON.stringify({ id: cid, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    const out = await p;
    if (out.exceptionDetails) {
      throw new Error(out.exceptionDetails.text + ': ' + JSON.stringify(out.exceptionDetails.exception));
    }
    return out.result?.value;
  };
}

function saveDataUrl(path, dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(path, buf);
  return buf.length;
}

let ws;
try {
  ws = await connectCdp();
  const evaluate = makeEvaluator(ws);

  // 1. Render crisp sky + cartoon cumulus underlay for the Bayek portrait apertures
  const skyDataUrl = await evaluate(`(() => {
    const W = 512, H = 384;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0a74e6');
    grad.addColorStop(0.58, '#2cb8ff');
    grad.addColorStop(1, '#79e7ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Subtle sunlit diagonal air rays
    ctx.save();
    const ray = ctx.createLinearGradient(0, 0, W, H);
    ray.addColorStop(0, 'rgba(255,255,255,0.16)');
    ray.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    ray.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(60, 0); ctx.lineTo(240, 0); ctx.lineTo(420, H); ctx.lineTo(190, H);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    const drawCloudBank = (puffs, shadowCol, fillCol) => {
      ctx.fillStyle = shadowCol;
      ctx.beginPath();
      for (const [cx, cy, r] of puffs) {
        ctx.moveTo(cx + r, cy + 10);
        ctx.arc(cx, cy + 10, r, 0, Math.PI * 2);
      }
      ctx.fill();

      ctx.fillStyle = fillCol;
      ctx.beginPath();
      for (const [cx, cy, r] of puffs) {
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    drawCloudBank(
      [[30, 326, 62], [112, 294, 72], [202, 312, 64], [308, 286, 78], [414, 306, 74], [492, 322, 60], [160, 360, 90], [360, 362, 95]],
      '#9ad9ff',
      '#ffffff',
    );
    drawCloudBank(
      [[64, 180, 30], [96, 168, 36], [134, 182, 28], [392, 164, 32], [432, 152, 42], [472, 166, 30]],
      'rgba(182,232,255,0.85)',
      '#f7fcff',
    );
    return c.toDataURL('image/webp', 0.94);
  })()`);
  const skyBytes = saveDataUrl(join(uiDir, 'hud-pelagic-sky.webp'), skyDataUrl);

  // 2. Render the unified 2x (1536x864) Fenda Pelágica Desktop HUD Chassis
  // Coordinates inside the canvas follow logical 768x432 multiplied by S = 2.
  const chassisDataUrl = await evaluate(`(() => {
    const S = 2;
    const W = 768 * S, H = 432 * S;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.scale(S, S);

    const chamferPath = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    };

    const chamferRect = (x, y, w, h, tl, tr, br, bl) => chamferPath([
      [x + tl, y],
      [x + w - tr, y],
      [x + w, y + tr],
      [x + w, y + h - br],
      [x + w - br, y + h],
      [x + bl, y + h],
      [x, y + h - bl],
      [x, y + tl],
    ]);

    const glowStroke = (pathFn, strokeCol = '#2be8ff', width = 1.6, glowCol = '#00aaff') => {
      ctx.save();
      pathFn();
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 7;
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      ctx.save();
      pathFn();
      ctx.strokeStyle = '#cffbff';
      ctx.lineWidth = Math.max(0.7, width * 0.45);
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.78;
      ctx.stroke();
      ctx.restore();
    };

    const drawClouds = (clusters) => {
      for (const puffs of clusters) {
        ctx.save();
        ctx.fillStyle = '#a8daff';
        ctx.beginPath();
        for (const [cx, cy, r] of puffs) {
          ctx.moveTo(cx + r, cy + 3);
          ctx.arc(cx, cy + 3, r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        for (const [cx, cy, r] of puffs) {
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }
    };

    // Base cobalt-navy chassis fill over the entire 768x432 canvas
    const bg = ctx.createLinearGradient(0, 0, 0, 432);
    bg.addColorStop(0, '#09398a');
    bg.addColorStop(0.45, '#072a6d');
    bg.addColorStop(1, '#041640');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, 432);

    // Subtle mechanical cobalt paneling seams for cohesive cabinet feel
    ctx.save();
    ctx.strokeStyle = 'rgba(72, 185, 255, 0.14)';
    ctx.lineWidth = 1.2;
    for (const [x1, y1, x2, y2] of [
      [0, 102, 192, 102],
      [0, 396, 192, 396],
      [576, 32, 768, 32],
      [576, 408, 768, 408],
    ]) {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(3, 12, 32, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 240); ctx.lineTo(14, 254); ctx.lineTo(14, 384);
    ctx.moveTo(768, 240); ctx.lineTo(754, 254); ctx.lineTo(754, 384);
    ctx.stroke();
    ctx.restore();

    // Soft anime cumulus clouds peeking cleanly along the side edges like the reference
    drawClouds([
      [[-6, 78, 22], [12, 92, 18], [30, 102, 14], [-4, 110, 18]],
      [[-4, 412, 26], [22, 422, 23], [48, 428, 17], [10, 434, 20]],
      [[772, 412, 26], [746, 420, 23], [720, 428, 17], [758, 434, 20]],
    ]);

    // Bottom corner yellow hazard bevel bars matching reference lower-left / lower-right
    const drawCornerBevel = (isRight) => {
      ctx.save();
      const x0 = isRight ? 768 : 0;
      const dir = isRight ? -1 : 1;
      ctx.fillStyle = '#03122f';
      ctx.beginPath();
      ctx.moveTo(x0 + dir * 138, 432);
      ctx.lineTo(x0 + dir * 176, 394);
      ctx.lineTo(x0 + dir * 192, 394);
      ctx.lineTo(x0 + dir * 192, 432);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffdc24';
      for (let i = 0; i < 2; i++) {
        const off = i * 16;
        ctx.beginPath();
        ctx.moveTo(x0 + dir * (150 + off), 432);
        ctx.lineTo(x0 + dir * (180 + off), 400);
        ctx.lineTo(x0 + dir * (189 + off), 400);
        ctx.lineTo(x0 + dir * (159 + off), 432);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };
    drawCornerBevel(false);
    drawCornerBevel(true);

    // Unified dark navy header strip across the full top (0..768, y=0..28)
    const topGrad = ctx.createLinearGradient(0, 0, 0, 28);
    topGrad.addColorStop(0, '#072a6b');
    topGrad.addColorStop(0.5, '#051d4d');
    topGrad.addColorStop(1, '#041439');
    ctx.fillStyle = topGrad;
    ctx.fillRect(190, 0, 388, 28);

    // Subtle right-panel header plate
    ctx.fillStyle = topGrad;
    ctx.fillRect(576, 0, 192, 28);

    // Center unified top-bar angled trapezoid recessed channel (x = 194..574, y = 2..25)
    chamferPath([
      [194, 4], [574, 4], [566, 25], [202, 25]
    ]);
    const barFill = ctx.createLinearGradient(0, 4, 0, 25);
    barFill.addColorStop(0, '#07255c');
    barFill.addColorStop(1, '#041436');
    ctx.fillStyle = barFill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(54, 214, 255, 0.52)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Left & right yellow diagonal hazard stripes integrated into unified top bar ends
    ctx.save();
    ctx.fillStyle = '#ffdf2b';
    for (let i = 0; i < 2; i++) {
      const lx = 196 + i * 9;
      ctx.beginPath();
      ctx.moveTo(lx, 6); ctx.lineTo(lx + 5, 6); ctx.lineTo(lx + 11, 22); ctx.lineTo(lx + 6, 22);
      ctx.closePath(); ctx.fill();

      const rx = 572 - i * 9;
      ctx.beginPath();
      ctx.moveTo(rx, 6); ctx.lineTo(rx - 5, 6); ctx.lineTo(rx - 11, 22); ctx.lineTo(rx - 6, 22);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Subtle vertical divider in top bar (|) separating PONTUAÇÃO from NV X
    ctx.save();
    ctx.strokeStyle = 'rgba(78, 220, 255, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(394, 7); ctx.lineTo(394, 21); ctx.stroke();
    ctx.restore();

    // Punch clean transparent cutouts (destination-out) for ALL dynamic windows:
    // 1) Center gameplay aperture (192..576, y = 27..424)
    // 2) Left Bayek portrait octagon (17..175, y = 107..225)
    // 3) Right ROTA 01 mission coastal artwork (594..750, y = 84..156)
    // 4) Right RÁDIO Bayek portrait box (598..648, y = 198..248)
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';

    const centerWindow = () => chamferRect(192, 27, 384, 397, 8, 8, 8, 8);
    centerWindow(); ctx.fill();

    const bayekWindow = () => chamferRect(17, 107, 158, 118, 12, 12, 12, 12);
    bayekWindow(); ctx.fill();

    const routeImgWindow = () => chamferRect(594, 84, 156, 72, 4, 4, 4, 4);
    routeImgWindow(); ctx.fill();

    const radioPortraitWindow = () => chamferRect(598, 198, 50, 50, 6, 6, 6, 6);
    radioPortraitWindow(); ctx.fill();
    ctx.restore();

    // Unified continuous outer glowing cyan frame around center gameplay & connecting seamlessly to both sides!
    // Left top transition -> Center Top Bar rim -> Right top header transition
    glowStroke(() => {
      ctx.beginPath();
      ctx.moveTo(0, 27);
      ctx.lineTo(186, 27);
      ctx.lineTo(192, 21);
      ctx.lineTo(202, 4);
      ctx.lineTo(566, 4);
      ctx.lineTo(576, 21);
      ctx.lineTo(582, 27);
      ctx.lineTo(768, 27);
    }, '#2ce8ff', 1.6);

    glowStroke(centerWindow, '#2be8ff', 2.2, '#00b4ff');

    // Left Bayek portrait metallic bezel + yellow upper-left diagonal chamfer accent
    glowStroke(bayekWindow, '#38e9ff', 1.8, '#009eff');
    ctx.save();
    ctx.fillStyle = '#ffdb26';
    ctx.strokeStyle = '#061a3d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(18, 134); ctx.lineTo(18, 118); ctx.lineTo(31, 107); ctx.lineTo(50, 107);
    ctx.lineTo(25, 134);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Left lower HUD info card (RIVET / VIDAS / ESPECIAL, x = 13..179, y = 244..388)
    const leftCard = () => chamferRect(13, 244, 166, 144, 10, 10, 10, 10);
    ctx.save();
    leftCard();
    const cardGrad = ctx.createLinearGradient(0, 244, 0, 388);
    cardGrad.addColorStop(0, 'rgba(6, 29, 74, 0.94)');
    cardGrad.addColorStop(1, 'rgba(4, 18, 48, 0.96)');
    ctx.fillStyle = cardGrad;
    ctx.fill();
    ctx.restore();
    glowStroke(leftCard, '#2ce6ff', 1.7);

    // Inner cyan horizontal separators between RIVET / VIDAS / ESPECIAL
    ctx.save();
    ctx.strokeStyle = 'rgba(54, 215, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(23, 306); ctx.lineTo(169, 306);
    ctx.moveTo(23, 346); ctx.lineTo(169, 346);
    ctx.stroke();
    ctx.restore();

    // Right ROTA 01 / FENDA PELÁGICA card (x = 588..756, y = 38..162)
    const rightTopCard = () => chamferRect(588, 38, 168, 124, 10, 8, 8, 8);
    ctx.save();
    rightTopCard();
    const rCardGrad = ctx.createLinearGradient(0, 38, 0, 162);
    rCardGrad.addColorStop(0, 'rgba(6, 30, 76, 0.95)');
    rCardGrad.addColorStop(1, 'rgba(4, 18, 49, 0.95)');
    ctx.fillStyle = rCardGrad;
    ctx.fill();
    ctx.restore();
    // Re-punch the ROTA 01 image window so its interior stays crystal transparent!
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    routeImgWindow(); ctx.fill();
    ctx.restore();
    glowStroke(rightTopCard, '#2ce6ff', 1.7);
    glowStroke(routeImgWindow, '#54e8ff', 1.2);

    // Upper-right 3 yellow diagonal hazard ticks inside ROTA 01 header
    ctx.save();
    ctx.fillStyle = '#ffdc24';
    for (let i = 0; i < 3; i++) {
      const tx = 720 + i * 9;
      ctx.beginPath();
      ctx.moveTo(tx, 54); ctx.lineTo(tx + 7, 42); ctx.lineTo(tx + 12, 42); ctx.lineTo(tx + 5, 54);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Right RÁDIO card (x = 588..756, y = 170..404)
    const rightRadioCard = () => chamferRect(588, 170, 168, 234, 10, 8, 14, 10);
    ctx.save();
    rightRadioCard();
    const radGrad = ctx.createLinearGradient(0, 170, 0, 404);
    radGrad.addColorStop(0, 'rgba(6, 30, 76, 0.95)');
    radGrad.addColorStop(1, 'rgba(4, 18, 49, 0.96)');
    ctx.fillStyle = radGrad;
    ctx.fill();
    ctx.restore();

    // RÁDIO upper-left angled tab (x = 590..682, y = 171..190)
    ctx.save();
    chamferPath([[592, 172], [684, 172], [674, 189], [592, 189]]);
    ctx.fillStyle = '#0a4094';
    ctx.fill();
    ctx.strokeStyle = '#38dcff';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();

    // Re-punch RÁDIO portrait cutout after filling radio card background
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    radioPortraitWindow(); ctx.fill();
    ctx.restore();
    glowStroke(radioPortraitWindow, '#4ae6ff', 1.5);

    // Lower dark-navy dialogue inset box (x = 597..747, y = 260..390)
    const radioTextBox = () => chamferRect(597, 260, 150, 130, 6, 6, 10, 6);
    ctx.save();
    radioTextBox();
    ctx.fillStyle = '#03122f';
    ctx.fill();
    ctx.strokeStyle = 'rgba(54, 212, 255, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    // Outer RÁDIO glow frame
    glowStroke(rightRadioCard, '#2ce6ff', 1.7);

    // Lower-right 3 yellow diagonal hazard ticks on the RÁDIO frame
    ctx.save();
    ctx.fillStyle = '#ffdc24';
    for (let i = 0; i < 3; i++) {
      const tx = 716 + i * 9;
      ctx.beginPath();
      ctx.moveTo(tx, 402); ctx.lineTo(tx + 6, 394); ctx.lineTo(tx + 11, 394); ctx.lineTo(tx + 5, 402);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    return c.toDataURL('image/webp', 0.94);
  })()`);
  const chassisBytes = saveDataUrl(join(uiDir, 'hud-pelagic-chassis.webp'), chassisDataUrl);

  // 3. Fit official approved coastal lighthouse artwork (route-pelagic.webp) cleanly into 312x144 (2x ROTA 01 window)
  const routeB64 = readFileSync(join(uiDir, 'route-pelagic.webp')).toString('base64');
  const routeFitted = await evaluate(`(async () => {
    const img = new Image();
    img.src = 'data:image/webp;base64,' + ${JSON.stringify(routeB64)};
    await img.decode();
    const W = 312, H = 144;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const ctx = out.getContext('2d');
    // Pre-crop upper-middle band (0, 34, 256, 126) preserving the lighthouse tower + harbor + beach without squish
    const sx = 2, sy = 34, sw = 252, sh = Math.round(252 * (H / W));
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
    return { bounds: { sx, sy, sw, sh }, dataUrl: out.toDataURL('image/webp', 0.94) };
  })()`);
  const routeBytes = saveDataUrl(join(uiDir, 'hud-route-pelagic.webp'), routeFitted.dataUrl);

  console.log('Packed Task 27 Pelagic HUD assets:', { skyBytes, chassisBytes, routeBytes, routeCrop: routeFitted.bounds });
} finally {
  ws?.close();
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
