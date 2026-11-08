import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const PORT = 4174;
const DEV_PORT = 5173;
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
      console.log(`[HTTP] Servidor de build ativo em http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.errors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.method === 'Runtime.exceptionThrown') {
          const details = data.params?.exceptionDetails;
          const text = details?.exception?.description || details?.text || JSON.stringify(details);
          this.errors.push(`[UncaughtException] ${text}`);
        } else if (data.method === 'Runtime.consoleAPICalled' && data.params?.type === 'error') {
          const args = (data.params.args || []).map((a) => a.value || a.description || '').join(' ');
          this.errors.push(`[ConsoleError] ${args}`);
        } else if (data.method === 'Log.entryAdded' && data.params?.entry?.level === 'error') {
          const entry = data.params.entry;
          if (!String(entry.url || '').endsWith('favicon.ico')) {
            this.errors.push(`[BrowserLogError] ${entry.text} (${entry.url || ''})`);
          }
        }
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

  async evalValue(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval Exception: ${res.exceptionDetails.text}`);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function checkDevServerActive() {
  try {
    const res = await fetch(`http://localhost:${DEV_PORT}/src/game/scenes/StageBackdrop.ts`);
    if (res.ok) {
      const text = await res.text();
      return text.includes('StageBackdrop');
    }
  } catch {
    // Dev server not active
  }
  return false;
}

async function capture() {
  const server = await startStaticServer();
  const devActive = await checkDevServerActive();
  const targetUrl = devActive ? `http://localhost:${DEV_PORT}/` : `http://127.0.0.1:${PORT}/`;
  console.log(`[QUALITY GATE] Alvo principal de validação: ${targetUrl} (DevServer Ativo: ${devActive})`);

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
  await client.send('Log.enable');

  console.log(`[CAPTURE] Navegando para ${targetUrl}...`);
  await client.send('Page.navigate', { url: targetUrl });
  await new Promise((r) => setTimeout(r, 2200));

  if (client.errors.length > 0) {
    throw new Error(`Erros detectados na inicialização:\n${client.errors.join('\n')}`);
  }

  // Validação 1: TitleScene & Menus
  const titleCheck = await client.evalValue(`(() => {
    const g = window.__GAME__;
    if (!g || !g.isBooted) return { ok: false, reason: 'Game not booted' };
    const s = g.scene.getScene('TitleScene');
    if (!s || !s.scene.isActive()) return { ok: false, reason: 'TitleScene not active' };
    const texts = s.children.list.filter(c => c.type === 'Text').map(t => t.text);
    const hasFakeFps = texts.some(t => t.includes('60-240 FPS'));
    s.navigate(1);
    const navWorked = s.selectedIndex === 1;
    s.navigate(-1);
    return { ok: !hasFakeFps && navWorked && s.menuItems.length === 5, hasFakeFps, navWorked, count: s.menuItems.length };
  })()`);

  if (!titleCheck?.ok) {
    throw new Error(`Falha na validação da TitleScene: ${JSON.stringify(titleCheck)}`);
  }
  console.log('[QUALITY GATE] TitleScene validada com sucesso (sem FPS falso, navegação ativa).');

  const shot1 = await client.send('Page.captureScreenshot');
  writeFileSync(join(SCREENSHOT_DIR, '01_title_scene.png'), Buffer.from(shot1.data, 'base64'));
  console.log('[CAPTURE] Salvo: 01_title_scene.png');

  // Validação 2: StageSelectScene
  await client.evalValue(`(() => {
    window.__GAME__.scene.stop('TitleScene');
    window.__GAME__.scene.start('StageSelectScene');
  })()`);
  await new Promise((r) => setTimeout(r, 800));

  const stageSelectCheck = await client.evalValue(`(() => {
    const s = window.__GAME__.scene.getScene('StageSelectScene');
    if (!s || !s.scene.isActive()) return { ok: false, reason: 'StageSelectScene not active' };
    const texts = s.children.list.filter(c => c.type === 'Text').map(t => t.text).join(' | ');
    const hasFenda = texts.includes('FENDA PELÁGICA');
    return { ok: hasFenda, cardsCount: s.cards?.length || 0 };
  })()`);
  if (!stageSelectCheck?.ok) {
    throw new Error(`Falha na validação da StageSelectScene: ${JSON.stringify(stageSelectCheck)}`);
  }
  console.log('[QUALITY GATE] StageSelectScene validada com sucesso.');

  const shotStage = await client.send('Page.captureScreenshot');
  writeFileSync(join(SCREENSHOT_DIR, '04_stage_select_scene.png'), Buffer.from(shotStage.data, 'base64'));
  console.log('[CAPTURE] Salvo: 04_stage_select_scene.png');

  // Validação 3: PilotSelectScene
  await client.evalValue(`(() => {
    window.__GAME__.scene.stop('StageSelectScene');
    window.__GAME__.scene.start('PilotSelectScene');
  })()`);
  await new Promise((r) => setTimeout(r, 1000));

  const pilotCheck = await client.evalValue(`(() => {
    const s = window.__GAME__.scene.getScene('PilotSelectScene');
    if (!s || !s.scene.isActive()) return { ok: false, reason: 'PilotSelectScene not active' };
    s.select(1);
    const coraSelected = s.selectedIndex === 1;
    s.select(0);
    const allProfile = s.shipVisuals.every(v => v.viewMode === 'profile');
    return { ok: coraSelected && allProfile && s.cards.length === 3, cards: s.cards.length, allProfile };
  })()`);
  if (!pilotCheck?.ok) {
    throw new Error(`Falha na validação da PilotSelectScene: ${JSON.stringify(pilotCheck)}`);
  }
  console.log('[QUALITY GATE] PilotSelectScene validada com sucesso (3 pilotos, naves em perfil).');

  const shot2 = await client.send('Page.captureScreenshot');
  writeFileSync(join(SCREENSHOT_DIR, '02_pilot_select_scene.png'), Buffer.from(shot2.data, 'base64'));
  console.log('[CAPTURE] Salvo: 02_pilot_select_scene.png');

  // Validação 4: PrototypeScene (Fenda Pelágica) — Cenário, Arma Inicial, Movimento e Disparo
  await client.evalValue(`(() => {
    window.__GAME__.scene.stop('PilotSelectScene');
    window.__GAME__.scene.start('PrototypeScene', { pilotId: 'nolan', stageNumber: 1 });
  })()`);
  await new Promise((r) => setTimeout(r, 2600));

  const combatCheck = await client.evalValue(`(() => {
    const s = window.__GAME__.scene.getScene('PrototypeScene');
    if (!s || !s.scene.isActive()) return { ok: false, reason: 'PrototypeScene not active' };
    const initialWeapon = s.weapons.weaponFamily;
    const initialLevel = s.weapons.weaponLevel;
    const startX = s.vectorShip.x;
    // Simula comando real de teclado (SPACE para disparo contínuo + D para movimento lateral)
    if (s.inputManager && s.inputManager.keys) {
      s.inputManager.keys.SPACE.isDown = true;
      s.inputManager.keys.D.isDown = true;
    }
    return {
      ok: initialWeapon === 'green' && initialLevel === 1 && Boolean(s.backdrop),
      initialWeapon,
      initialLevel,
      startX,
      hasBackdrop: Boolean(s.backdrop),
    };
  })()`);
  if (!combatCheck?.ok) {
    throw new Error(`Falha na validação da PrototypeScene: ${JSON.stringify(combatCheck)}`);
  }

  await new Promise((r) => setTimeout(r, 400));
  await client.evalValue(`(() => {
    const s = window.__GAME__.scene.getScene('PrototypeScene');
    if (s?.inputManager?.keys) {
      s.inputManager.keys.D.isDown = false;
    }
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  const postFireCheck = await client.evalValue(`(() => {
    const s = window.__GAME__.scene.getScene('PrototypeScene');
    return {
      shotsFired: s.shots.length,
      shipMoved: Math.abs(s.vectorShip.x - ${combatCheck.startX}) > 5,
      shipX: Math.round(s.vectorShip.x),
      enemiesActive: s.director.enemies.length,
      scrollPx: Math.round(s.director.scrollPx),
      hp: s.health.hp,
      lives: s.health.lives,
    };
  })()`);
  console.log('[QUALITY GATE] PrototypeScene em execução real:', JSON.stringify(postFireCheck));
  if (!postFireCheck.shipMoved || postFireCheck.shotsFired === 0) {
    throw new Error(`Controles de movimento ou disparo não responderam: ${JSON.stringify(postFireCheck)}`);
  }

  const shot3 = await client.send('Page.captureScreenshot');
  writeFileSync(join(SCREENSHOT_DIR, '03_gameplay_fenda_pelagica.png'), Buffer.from(shot3.data, 'base64'));
  console.log('[CAPTURE] Salvo: 03_gameplay_fenda_pelagica.png');

  if (client.errors.length > 0) {
    throw new Error(`Erros de console/runtime detectados durante a execução:\n${client.errors.join('\n')}`);
  }

  client.close();
  chromeProc.kill();
  server.close();
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Windows file lock cleanup
  }

  console.log('[QUALITY GATE] 100% APROVADO — Zero erros no console, todas as cenas e mecânicas verificadas em execução real.');
}

capture().catch((err) => {
  console.error('[QUALITY GATE ERROR]', err);
  process.exit(1);
});
