/**
 * BULLET WAKE — Fenda Pelágica Desktop HUD chassis (Task 27, HD rebuild).
 *
 * Composes a single 1920x1080 (2.5x of the 768x432 logical canvas) chassis that reproduces the
 * approved HUD reference (scripts/assets/hud-v27/approved-hud-reference.jpg):
 *   - every frame, card, ribbon, stripe, glow and static label is drawn as crisp vector art at 2.5x;
 *   - raster art comes ONLY from HD sources (logo-arcade.webp + HD redraws in scripts/assets/hud-v27);
 *   - the centre gameplay window [192..576 x 28..424] is fully transparent;
 *   - dynamic slots (score, POWER squares, lives, specials, waveform, radio text, pause) are left empty
 *     and drawn live by PelagicDesktopHud / ArcadeScene.
 * Also exports the keyed static RIVET side profile (ui/rivet-profile.webp) used by the HUD and pilot select.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const uiDir = resolve('public/assets/arcade/ui');
const srcDir = resolve('scripts/assets/hud-v27');
mkdirSync(uiDir, { recursive: true });

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const profile = mkdtempSync(join(tmpdir(), 'bw-hud-v27-hd-'));
const port = 9241;
const chrome = spawn(
  chromePath,
  ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${port}`, '--remote-allow-origins=*', '--no-first-run', '--user-data-dir=' + profile, 'about:blank'],
  { stdio: 'ignore' },
);

async function connectCdp() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find(t => t.type === 'page') ?? targets[0];
      if (page?.webSocketDebuggerUrl) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((ok, err) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', err, { once: true }); });
        return ws;
      }
    } catch { }
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
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  });
  return async expression => {
    const cid = id++;
    const p = new Promise((res, rej) => pending.set(cid, { res, rej }));
    ws.send(JSON.stringify({ id: cid, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    const out = await p;
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.text + ': ' + JSON.stringify(out.exceptionDetails.exception));
    return out.result?.value;
  };
}

const dataUrl = (file, mime) => `data:${mime};base64,` + readFileSync(file).toString('base64');
function saveDataUrl(path, url) {
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(path, buf);
  return buf.length;
}

const sources = {
  logo: dataUrl(join(uiDir, 'logo-arcade.webp'), 'image/webp'),
  portrait: dataUrl(join(srcDir, 'bayek-portrait-hd.jpg'), 'image/jpeg'),
  rivet: dataUrl(join(srcDir, 'rivet-profile-hd.jpg'), 'image/jpeg'),
  route: dataUrl(join(srcDir, 'route-lighthouse-hd.jpg'), 'image/jpeg'),
  clouds: dataUrl(join(srcDir, 'clouds-bank-hd.jpg'), 'image/jpeg'),
};

let ws;
try {
  ws = await connectCdp();
  const evaluate = makeEvaluator(ws);
  const result = await evaluate(`(async () => {
    const SRC = ${JSON.stringify(sources)};
    const load = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
    const [logo, portrait, rivetRaw, route, cloudsRaw] = await Promise.all([SRC.logo, SRC.portrait, SRC.rivet, SRC.route, SRC.clouds].map(load));
    await document.fonts.load('italic 900 20px "Segoe UI"');

    // ---------- Chroma keying helpers ----------
    const keyImage = (img, mode) => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const id = x.getImageData(0, 0, c.width, c.height), d = id.data;
      let minX = c.width, minY = c.height, maxX = 0, maxY = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let a;
        if (mode === 'green') {
          const dom = g - Math.max(r, b);
          a = dom >= 70 ? 0 : dom <= 18 ? 1 : 1 - (dom - 18) / 52;
          if (dom > 0) d[i + 1] = Math.max(r, b) + Math.min(dom, 6);
        } else {
          const dom = Math.min(r, b) - g;
          a = dom >= 90 ? 0 : dom <= 25 ? 1 : 1 - (dom - 25) / 65;
          if (dom > 8) { d[i] = Math.min(r, g + 30); d[i + 2] = Math.max(b, g + 40); }
        }
        d[i + 3] = Math.round(a * 255);
        if (a > 0.05) { const p = i / 4, px = p % c.width, py = (p / c.width) | 0; if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; }
      }
      x.putImageData(id, 0, 0);
      const t = document.createElement('canvas'); t.width = maxX - minX + 1; t.height = maxY - minY + 1;
      t.getContext('2d').drawImage(c, minX, minY, t.width, t.height, 0, 0, t.width, t.height);
      return t;
    };
    const rivet = keyImage(rivetRaw, 'green');
    const clouds = keyImage(cloudsRaw, 'magenta');

    // Export the static RIVET side profile (1024px wide, transparent) for HUD + pilot select.
    const rv = document.createElement('canvas'); rv.width = 1024; rv.height = Math.round(1024 * rivet.height / rivet.width);
    const rvx = rv.getContext('2d'); rvx.imageSmoothingQuality = 'high'; rvx.drawImage(rivet, 0, 0, rv.width, rv.height);
    const rivetProfileUrl = rv.toDataURL('image/webp', 0.95);

    // ---------- Chassis canvas ----------
    const S = 2.5, LW = 768, LH = 432;
    const c = document.createElement('canvas'); c.width = LW * S; c.height = LH * S;
    const ctx = c.getContext('2d'); ctx.scale(S, S); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

    const poly = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };
    const cham = (x, y, w, h, tl, tr, br, bl) => poly([[x + tl, y], [x + w - tr, y], [x + w, y + tr], [x + w, y + h - br], [x + w - br, y + h], [x + bl, y + h], [x, y + h - bl], [x, y + tl]]);
    const rrect = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
    const glow = (path, width = 1.7, outer = '#22c8ff', core = '#c9fbff') => {
      ctx.save(); path(); ctx.lineJoin = 'round'; ctx.shadowColor = '#00a8ff'; ctx.shadowBlur = 6; ctx.strokeStyle = outer; ctx.lineWidth = width + 0.9; ctx.stroke(); ctx.restore();
      ctx.save(); path(); ctx.lineJoin = 'round'; ctx.strokeStyle = core; ctx.lineWidth = Math.max(0.6, width * 0.5); ctx.stroke(); ctx.restore();
    };
    const fillPath = (path, style) => { ctx.save(); path(); ctx.fillStyle = style; ctx.fill(); ctx.restore(); };
    const vgrad = (y0, y1, stops) => { const g = ctx.createLinearGradient(0, y0, 0, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
    const cardFill = (y0, y1) => vgrad(y0, y1, [[0, '#04265f'], [0.5, '#022051'], [1, '#011a44']]);
    const label = (txt, x, y, size, color, align = 'left', stroke = '#03122f', sw = 3) => {
      ctx.save(); ctx.font = 'italic 900 ' + size + 'px "Segoe UI", "Arial Black", sans-serif'; ctx.textAlign = align; ctx.textBaseline = 'middle';
      if (sw > 0) { ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.strokeText(txt, x, y); }
      ctx.fillStyle = color; ctx.fillText(txt, x, y); ctx.restore();
    };
    const coverDraw = (img, x, y, w, h, fx = 0.5, fy = 0.5, sxOverride) => {
      const ir = img.width / img.height, wr = w / h;
      let sw, sh; if (ir > wr) { sh = img.height; sw = sh * wr; } else { sw = img.width; sh = sw / wr; }
      const sx = sxOverride ? sxOverride.sx : (img.width - sw) * fx; const sy = sxOverride ? sxOverride.sy : (img.height - sh) * fy;
      ctx.drawImage(img, sx, sy, sxOverride ? sxOverride.sw : sw, sxOverride ? sxOverride.sh : sh, x, y, w, h);
    };
    const stripe = (pts, col = '#ffd91f') => fillPath(() => poly(pts), col);

    // 1) Panel background: deep cobalt with diagonal light streaks + fine tech grid
    ctx.fillStyle = vgrad(0, LH, [[0, '#0340a6'], [0.45, '#02338e'], [1, '#022a78']]); ctx.fillRect(0, 0, LW, LH);
    ctx.save();
    for (const [x0, w, a] of [[-120, 40, 0.10], [-40, 16, 0.07], [40, 60, 0.08], [150, 22, 0.06], [470, 52, 0.08], [560, 18, 0.07], [640, 70, 0.09], [770, 30, 0.06]]) {
      ctx.fillStyle = 'rgba(70,150,255,' + a + ')';
      poly([[x0, LH], [x0 + w, LH], [x0 + w + 300, 0], [x0 + 300, 0]]); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(120,190,255,0.05)'; ctx.lineWidth = 0.5;
    for (let gx = 0; gx <= LW; gx += 8) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, LH); ctx.stroke(); }
    for (let gy = 0; gy <= LH; gy += 8) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(LW, gy); ctx.stroke(); }
    ctx.restore();

    // 2) Clouds (HD keyed anime cumulus)
    const cloudW = clouds.width, cloudH = clouds.height;
    ctx.save(); ctx.globalAlpha = 0.98;
    ctx.drawImage(clouds, 0, 0, cloudW * 0.42, cloudH * 0.5, -8, 78, 70, 70 * (cloudH * 0.5) / (cloudW * 0.42)); // small puff behind portrait top-left
    ctx.drawImage(clouds, -14, 360, 176, 176 * cloudH / cloudW);                                                   // bottom-left bank
    ctx.translate(LW, 0); ctx.scale(-1, 1); ctx.drawImage(clouds, -14, 358, 176, 176 * cloudH / cloudW);          // bottom-right bank (mirrored)
    ctx.restore();

    // 3) Big yellow corner hazard stripes
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 189, LH); ctx.clip();
    stripe([[136, 432], [150, 432], [192, 376], [178, 376]]); stripe([[160, 432], [174, 432], [216, 376], [202, 376]]);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(579, 0, 189, LH); ctx.clip();
    stripe([[718, 432], [732, 432], [774, 376], [760, 376]]); stripe([[742, 432], [756, 432], [798, 376], [784, 376]]);
    ctx.restore();

    // 4) Unified top bar (score | POWER) with slanted ends, yellow hazard stripes and divider
    const topBar = () => poly([[166, 25], [179, 2], [589, 2], [602, 25]]);
    fillPath(topBar, vgrad(2, 25, [[0, '#032a66'], [1, '#011a45']]));
    stripe([[178, 23], [186, 23], [197, 5], [189, 5]]); stripe([[190, 23], [198, 23], [209, 5], [201, 5]]);
    stripe([[590, 23], [582, 23], [571, 5], [579, 5]]); stripe([[578, 23], [570, 23], [559, 5], [567, 5]]);
    glow(topBar, 1.6);
    ctx.save(); ctx.strokeStyle = '#3fe3ff'; ctx.lineWidth = 1.5; ctx.shadowColor = '#00b4ff'; ctx.shadowBlur = 4; ctx.beginPath(); ctx.moveTo(368, 8); ctx.lineTo(368, 20); ctx.stroke(); ctx.restore();
    // right header line under the pause badge, continuing the top bar edge
    glow(() => { ctx.beginPath(); ctx.moveTo(602, 25); ctx.lineTo(610, 33); ctx.lineTo(768, 33); }, 1.3);

    // 5) LEFT PANEL ---------------------------------------------------------
    // Logo (HD webp)
    { const w = 162, h = w * logo.height / logo.width; ctx.drawImage(logo, 99 - w / 2, 53 - h / 2, w, h); }

    // Bayek portrait (HD) inside chamfered frame
    const portFrame = () => cham(12, 113, 172, 123, 18, 8, 12, 10);
    ctx.save(); portFrame(); ctx.clip();
    coverDraw(portrait, 12, 113, 172, 123, 0.5, 0.15);
    ctx.restore();
    glow(portFrame, 1.9);
    stripe([[16, 150], [16, 140], [39, 117], [49, 117]]);
    stripe([[160, 239], [167, 239], [178, 226], [171, 226]], '#d9fbff');

    // BAYEK gold ribbon
    const ribbon = () => poly([[42, 231], [53, 217.5], [151, 217.5], [162, 231], [151, 244.5], [53, 244.5]]);
    fillPath(ribbon, vgrad(217.5, 244.5, [[0, '#fff27a'], [0.45, '#ffd51c'], [1, '#f0a800']]));
    ctx.save(); ribbon(); ctx.strokeStyle = '#061a3d'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(255,252,210,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(56, 220); ctx.lineTo(148, 220); ctx.stroke(); ctx.restore();
    label('BAYEK', 102, 231.5, 17, '#0b1c45', 'center', '#fff6b8', 0);

    // Lower info card (RIVET / VIDAS / ESPECIAL)
    const infoCard = () => cham(12, 249, 172, 123, 6, 10, 10, 6);
    fillPath(infoCard, cardFill(249, 372));
    // section dividers with stepped right ends (reference style)
    glow(() => { ctx.beginPath(); ctx.moveTo(14, 299); ctx.lineTo(176, 299); ctx.lineTo(182, 293); }, 1.2);
    glow(() => { ctx.beginPath(); ctx.moveTo(14, 335); ctx.lineTo(176, 335); ctx.lineTo(182, 329); }, 1.2);
    glow(infoCard, 1.8);
    // RIVET static side profile (HD keyed)
    { const w = 80, h = w * rivet.height / rivet.width; ctx.drawImage(rivet, 62 - w / 2, 273 - h / 2, w, h); }
    label('RIVET', 176, 265, 20, '#ffffff', 'right', '#03122f', 3.2);
    const pill = () => poly([[106, 291], [110, 279], [178, 279], [174, 291]]);
    fillPath(pill, vgrad(279, 291, [[0, '#5cf0ff'], [1, '#12c4ef']]));
    label('VANGUARDA', 142, 285.3, 9.5, '#062a5a', 'center', '#000', 0);
    label('VIDAS', 23, 317.5, 13, '#ffffff', 'left', '#03122f', 3);
    label('ESPECIAL', 23, 352, 12, '#ffffff', 'left', '#03122f', 3);
    // ESPECIAL lightning bolt
    ctx.save(); poly([[104, 341], [93, 354], [99.5, 354], [96, 364], [108, 349.5], [101.5, 349.5], [106, 341]]);
    ctx.fillStyle = vgrad(341, 364, [[0, '#fff27a'], [1, '#ffb800']]); ctx.fill(); ctx.strokeStyle = '#061a3d'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();

    // 6) RIGHT PANEL --------------------------------------------------------
    // ROTA 01 card
    const rotaCard = () => cham(586, 45, 176, 113, 4, 8, 10, 10);
    fillPath(rotaCard, cardFill(45, 158));
    const routeWin = () => cham(591, 89, 166, 63, 3, 3, 8, 3);
    ctx.save(); routeWin(); ctx.clip(); coverDraw(route, 591, 89, 166, 63, 0.5, 0.06); ctx.restore();
    glow(routeWin, 1.1, '#2ad0ff', '#bff8ff');
    glow(rotaCard, 1.8);
    const rotaTag = () => poly([[593, 42], [686, 42], [676, 63], [589, 63], [589, 46]]);
    fillPath(rotaTag, vgrad(42, 63, [[0, '#fff27a'], [0.45, '#ffd51c'], [1, '#f0a800']]));
    ctx.save(); rotaTag(); ctx.strokeStyle = '#061a3d'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
    label('ROTA 01', 633, 53, 15, '#0b1c45', 'center', '#000', 0);
    for (const tx of [727, 736, 745]) stripe([[tx, 62], [tx + 6, 62], [tx + 12, 51], [tx + 6, 51]]);
    label('FENDA PELÁGICA', 595, 76.5, 17.5, '#ffffff', 'left', '#03122f', 3.2);

    // RÁDIO card + tab
    const radioCard = () => cham(586, 176, 176, 184, 0, 10, 10, 10);
    fillPath(radioCard, cardFill(176, 360));
    glow(radioCard, 1.8);
    const radioTab = () => poly([[590, 165], [672, 165], [683, 177.5], [672, 190], [590, 190], [586, 186], [586, 169]]);
    fillPath(radioTab, vgrad(165, 190, [[0, '#04306f'], [1, '#021d4c']]));
    glow(radioTab, 1.5);
    // radio icon ((•))
    ctx.save(); ctx.strokeStyle = '#38f0ff'; ctx.fillStyle = '#38f0ff'; ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.shadowColor = '#00c8ff'; ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.arc(606, 177.5, 2.6, 0, Math.PI * 2); ctx.fill();
    for (const r of [6, 9.6]) { ctx.beginPath(); ctx.arc(606, 177.5, r, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(606, 177.5, r, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke(); }
    ctx.restore();
    label('RÁDIO', 621, 178, 14, '#ffffff', 'left', '#03122f', 3);
    // radio portrait (HD, same art as the left portrait)
    const radioPort = () => rrect(594, 201, 60, 60, 7);
    ctx.save(); radioPort(); ctx.clip();
    ctx.drawImage(portrait, 395, 10, 500, 500, 594, 201, 60, 60);
    ctx.restore();
    glow(radioPort, 1.6, '#3bd9ff', '#f0ffff');
    // BAYEK nameplate + accent
    const plate = () => poly([[661, 205], [743, 205], [736, 222], [661, 222]]);
    fillPath(plate, vgrad(205, 222, [[0, '#fff27a'], [0.45, '#ffd51c'], [1, '#f0a800']]));
    stripe([[747, 205], [757, 205], [750, 222], [740, 222]]);
    label('BAYEK', 669, 214, 14, '#0b1c45', 'left', '#000', 0);
    // dialogue box with pointer toward the portrait
    const dialog = () => { ctx.beginPath(); ctx.moveTo(601, 274); ctx.lineTo(618, 274); ctx.lineTo(626, 267); ctx.lineTo(634, 274); ctx.lineTo(749, 274); ctx.quadraticCurveTo(756, 274, 756, 281); ctx.lineTo(756, 337); ctx.quadraticCurveTo(756, 344, 749, 344); ctx.lineTo(601, 344); ctx.quadraticCurveTo(594, 344, 594, 337); ctx.lineTo(594, 281); ctx.quadraticCurveTo(594, 274, 601, 274); ctx.closePath(); };
    fillPath(dialog, vgrad(274, 344, [[0, '#01214f'], [1, '#011a42']]));
    glow(dialog, 1.3);
    for (const tx of [728, 737, 746]) stripe([[tx, 356], [tx + 6, 356], [tx + 11, 347], [tx + 5, 347]]);

    // 7) Centre gameplay window: fully transparent + glow frame
    const centre = () => cham(192, 28, 384, 396, 7, 7, 7, 7);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; centre(); ctx.fill(); ctx.restore();
    glow(centre, 2.0);

    return { chassis: c.toDataURL('image/webp', 0.95), rivetProfile: rivetProfileUrl, rivetSize: [rv.width, rv.height] };
  })()`);

  const chassisBytes = saveDataUrl(join(uiDir, 'hud-pelagic-chassis.webp'), result.chassis);
  const rivetBytes = saveDataUrl(join(uiDir, 'rivet-profile.webp'), result.rivetProfile);
  console.log('Packed HD Pelagic HUD chassis (1920x1080):', { chassisBytes, rivetBytes, rivetSize: result.rivetSize });
} finally {
  ws?.close();
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch { }
}
