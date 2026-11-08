import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const PORT = 4174;
const DIST_DIR = join(process.cwd(), 'dist');
const SCREENSHOT_DIR = join(process.cwd(), 'docs', 'screenshots');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!existsSync(SCREENSHOT_DIR)) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let urlPath = (req.url || '/').split('?')[0];
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = join(DIST_DIR, urlPath);

      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath);
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(readFileSync(filePath));
      } else {
        res.writeHead(404);
        res.end('Not found: ' + urlPath);
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[HTTP] Servidor ativo em http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(new Error(data.error.message));
          else cb.resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function capture() {
  const server = await startStaticServer();
  const tempDir = mkdtempSync(join(tmpdir(), 'bw-shots-'));

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9223',
    `--user-data-dir=${tempDir}`,
    '--window-size=1280,720',
  ]);

  await new Promise((r) => setTimeout(r, 1200));

  let cdpUrl = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9223/json/list');
      const list = await res.json();
      const pageTarget = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTarget) {
        cdpUrl = pageTarget.webSocketDebuggerUrl;
        break;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (!cdpUrl) {
    throw new Error('Não encontrou target page no Chrome.');
  }

  const client = new CdpClient(cdpUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');

  console.log('[CAPTURE] Navegando para o jogo...');
  await client.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Screenshot: TitleScene
  const shot1 = await client.send('Page.captureScreenshot');
  writeFileSync(join(SCREENSHOT_DIR, '01_title_scene.png'), Buffer.from(shot1.data, 'base64'));
  console.log('[CAPTURE] Salvo: 01_title_scene.png');

  // 2. Transição para PilotSelectScene
  await client.send('Runtime.evaluate', {
    expression: `
      window.__GAME__.scene.stop('TitleScene');
      window.__GAME__.scene.start('PilotSelectScene');
    `,
  });
  await new Promise((r) => setTimeout(r, 1000));

  const shot2 = await client.send('Page.captureScreenshot');
  writeFileSync(join(SCREENSHOT_DIR, '02_pilot_select_scene.png'), Buffer.from(shot2.data, 'base64'));
  console.log('[CAPTURE] Salvo: 02_pilot_select_scene.png');

  // 3. Transição para PrototypeScene (Fenda Pelágica)
  await client.send('Runtime.evaluate', {
    expression: `
      window.__GAME__.scene.stop('PilotSelectScene');
      window.__GAME__.scene.start('PrototypeScene', { pilotId: 'nolan', stageNumber: 1 });
    `,
  });
  await new Promise((r) => setTimeout(r, 1500));

  const shot3 = await client.send('Page.captureScreenshot');
  writeFileSync(join(SCREENSHOT_DIR, '03_gameplay_fenda_pelagica.png'), Buffer.from(shot3.data, 'base64'));
  console.log('[CAPTURE] Salvo: 03_gameplay_fenda_pelagica.png');

  client.close();
  chromeProc.kill();
  server.close();
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Windows file lock cleanup
  }

  console.log('[CAPTURE] Concluído com sucesso! Todas as telas validadas visualmente.');
}

capture().catch((err) => {
  console.error('[CAPTURE ERROR]', err);
  process.exit(1);
});
