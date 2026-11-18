/**
 * Generates high-DPI modular raster thumbnails for Fenda Pelágica Desktop HUD:
 *   - public/assets/arcade/ui/hud-route-pelagic.webp (420x186, exact 140:62 Mission thumbnail ratio)
 *   - public/assets/arcade/ui/hud-bayek-halfbody.webp (432x504, exact 144:168 Bayek half-body ratio)
 * Zero stretching, zero full-screen overlays, zero baked UI chrome.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const uiDir = resolve('public/assets/arcade/ui');
const srcDir = resolve('scripts/assets/hud-v27');

const chromePath =
  process.env.CHROME_BIN ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : '/usr/bin/google-chrome');

const profile = mkdtempSync(join(tmpdir(), 'bw-hud-mod-'));
const port = 9242;
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
      const page = targets.find((t) => t.type === 'page') ?? targets[0];
      if (page?.webSocketDebuggerUrl) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((ok, err) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', err, { once: true }); });
        return ws;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Could not connect to Chrome CDP');
}

function makeEvaluator(ws) {
  let id = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    }
  });
  return async (expression) => {
    const cid = id++;
    const p = new Promise((res, rej) => pending.set(cid, { res, rej }));
    ws.send(JSON.stringify({ id: cid, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    const out = await p;
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.text + ': ' + JSON.stringify(out.exceptionDetails.exception));
    return out.result?.value;
  };
}

const dataUrl = (file, mime) => `data:${mime};base64,` + readFileSync(file).toString('base64');
const saveDataUrl = (path, url) => {
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(path, buf);
  return buf.length;
};

let ws;
try {
  ws = await connectCdp();
  const evaluate = makeEvaluator(ws);
  const routeUrl = dataUrl(join(srcDir, 'route-lighthouse-hd.jpg'), 'image/jpeg');
  const bayekUrl = dataUrl(join(srcDir, 'bayek-halfbody-hd.jpg'), 'image/jpeg');

  const out = await evaluate(`(async () => {
    const load = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
    const [routeImg, bayekImg] = await Promise.all([${JSON.stringify(routeUrl)}, ${JSON.stringify(bayekUrl)}].map(load));

    const coverCrop = (img, tw, th, fx = 0.5, fy = 0.5) => {
      const c = document.createElement('canvas');
      c.width = tw;
      c.height = th;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const ir = img.width / img.height;
      const wr = tw / th;
      let sw, sh;
      if (ir > wr) { sh = img.height; sw = sh * wr; }
      else { sw = img.width; sh = sw / wr; }
      const sx = (img.width - sw) * fx;
      const sy = (img.height - sh) * fy;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
      return c.toDataURL('image/webp', 0.94);
    };

    return {
      route: coverCrop(routeImg, 420, 186, 0.5, 0.14),
      bayek: coverCrop(bayekImg, 432, 504, 0.5, 0.12),
    };
  })()`);

  const routeBytes = saveDataUrl(join(uiDir, 'hud-route-pelagic.webp'), out.route);
  const bayekBytes = saveDataUrl(join(uiDir, 'hud-bayek-halfbody.webp'), out.bayek);
  console.log('Exported modular HD HUD assets:', { routeBytes, bayekBytes });
} finally {
  ws?.close();
  chrome.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
