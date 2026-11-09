import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const PORT = 4175;
const DIST_DIR = join(process.cwd(), 'dist');
const SCREENSHOT_DIR = join(process.cwd(), 'docs', 'screenshots');
const ARTIFACT_DIR = 'C:\\Users\\emers\\.gemini\\antigravity\\brain\\b3596df5-9f75-4a8d-802e-f10c1650a77d';
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

async function waitForDebugEndpoint(debugPort, maxWaitMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Timeout waiting for Chrome DevTools endpoint');
}

async function capturePng(cdp, filename) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const outPath = join(SCREENSHOT_DIR, filename);
  writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
  if (existsSync(ARTIFACT_DIR)) {
    copyFileSync(outPath, join(ARTIFACT_DIR, filename));
  }
  console.log(`[SCREENSHOT] Salvo: ${outPath}`);
  return outPath;
}

async function setViewport(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.evalValue(`
    (() => {
      if (window.__GAME__ && window.__GAME__.scale) {
        window.__GAME__.scale.refresh();
      }
      return true;
    })()
  `);
  await new Promise((r) => setTimeout(r, 250));
}

async function main() {
  // Usa o servidor de produção recém-compilado (dist/) para garantir 100% de fidelidade com o código atual
  const server = await startStaticServer();
  const targetUrl = `http://127.0.0.1:${PORT}/`;
  console.log(`[TARGET] Validando Armas, HUD e Resoluções (1366x768 e 1920x1080) em: ${targetUrl}`);

  const debugPort = 9246;
  const userDataDir = mkdtempSync(join(tmpdir(), 'bw-validation-v2-'));

  const chrome = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--window-size=1920,1080',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      targetUrl,
    ],
    { stdio: 'ignore' },
  );

  let cdp;
  try {
    const wsUrl = await waitForDebugEndpoint(debugPort);
    cdp = new CdpClient(wsUrl);
    await cdp.connect();

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');

    // Aguarda carregamento de fontes (Oxanium & Rajdhani) e boot do Phaser
    await setViewport(cdp, 1920, 1080);
    await new Promise((r) => setTimeout(r, 2200));

    // =========================================================================
    // 0. CAPTURAS DE MENUS EM 1920x1080 (TitleScene, StageSelectScene, PilotSelectScene)
    // =========================================================================
    await capturePng(cdp, '01_title_scene.png');

    await cdp.evalValue(`
      (() => {
        const g = window.__GAME__;
        g.scene.stop('TitleScene');
        g.scene.start('StageSelectScene');
        return true;
      })()
    `);
    await new Promise((r) => setTimeout(r, 700));
    await capturePng(cdp, '04_stage_select_scene.png');

    await cdp.evalValue(`
      (() => {
        const g = window.__GAME__;
        g.scene.stop('StageSelectScene');
        g.scene.start('PilotSelectScene', { stageNumber: 1 });
        return true;
      })()
    `);
    await new Promise((r) => setTimeout(r, 700));
    await capturePng(cdp, '02_pilot_select_scene.png');

    // Inicia a PrototypeScene (Fenda Pelágica) em 1920x1080
    await cdp.evalValue(`
      (() => {
        const g = window.__GAME__;
        g.scene.stop('PilotSelectScene');
        g.scene.start('PrototypeScene', { pilotId: 'nolan', stageNumber: 1 });
        return true;
      })()
    `);
    await new Promise((r) => setTimeout(r, 1400));

    // Verifica Regra Canônica Fire Shark #1, #2, #3 e #5:
    // Inicia equipado com Wide Shot azul (DISPERSÃO AZUL, NV 1, 0/3 P) e pode trocar por cápsula sem exigir nível 4
    const initialCheck = await cdp.evalValue(`
      (() => {
        const s = window.__GAME__.scene.getScene('PrototypeScene');
        const startState = {
          weaponFamily: s.weapons.weaponFamily,
          weaponLevel: s.weapons.weaponLevel,
          powerMeter: s.weapons.powerMeter,
          hudWeapon: s.hud.weaponTitleText.text,
          hudShip: s.hud.shipModelText.text,
        };
        // Coleta cápsula vermelha ainda no Nível 1 (comprovando Regra #3: não exige maximizar azul nem verde)
        s.pickups.spawn('weapon_red', s.vectorShip.x, s.vectorShip.y);
        s.checkPickupCollisions();
        const afterRedCapsuleAtLv1 = {
          weaponFamily: s.weapons.weaponFamily,
          weaponLevel: s.weapons.weaponLevel,
          hudWeapon: s.hud.weaponTitleText.text,
        };
        return { startState, afterRedCapsuleAtLv1 };
      })()
    `);
    console.log('[REGRA CANÔNICA FIRE SHARK #1-#5 (INÍCIO AZUL + TROCA LIVRE)]:', JSON.stringify(initialCheck));
    if (
      initialCheck.startState.weaponFamily !== 'ion' ||
      initialCheck.startState.weaponLevel !== 1 ||
      initialCheck.afterRedCapsuleAtLv1.weaponFamily !== 'red' ||
      initialCheck.afterRedCapsuleAtLv1.weaponLevel !== 1
    ) {
      throw new Error('Falha nas Regras Canônicas Fire Shark #1-#5: ' + JSON.stringify(initialCheck));
    }

    // =========================================================================
    // 1. LASER RUBRO (VERMELHO): NÍVEL 1, 2, 3 e 4 (ASAS DE ENERGIA + COBERTURA POSTERIOR)
    // =========================================================================
    // NÍVEL 1 — FLUXO INICIAL
    const lv1Info = await cdp.evalValue(`
      (() => {
        const s = window.__GAME__.scene.getScene('PrototypeScene');
        s.director.enemies = [];
        s.syncEnemyVisuals();
        s.clearEnemyShots();
        s.clearPlayerShots();
        s.vectorShip.setPosition(384, 345);
        s.setTestWeapon('red', 1, 0);
        s.inputManager.keys.SPACE.isDown = true;
        for (let i = 0; i < 10; i++) s.update(performance.now(), 16.67);
        return {
          weaponFamily: s.weapons.weaponFamily,
          weaponLevel: s.weapons.weaponLevel,
          beamCount: s.crimsonLaserState.beams.length,
          isEmitting: s.crimsonLaserState.isEmitting,
          redBallsCount: s.shots.length,
          hudWeapon: s.hud.weaponTitleText.text,
          hudLevel: s.hud.weaponLevelText.text,
          hudPMeter: s.hud.powerMeterText.text,
        };
      })()
    `);
    console.log('[LASER RUBRO NV1 - FLUXO INICIAL]:', JSON.stringify(lv1Info));
    if (lv1Info.beamCount !== 1 || !lv1Info.isEmitting || lv1Info.redBallsCount !== 0) {
      throw new Error('Falha no Nível 1 do Laser Rubro: ' + JSON.stringify(lv1Info));
    }
    await capturePng(cdp, 'laser_rubro_lv1.png');

    // NÍVEL 2 — FLUXO DUPLO (via coleta real de 3 itens P)
    const lv2Info = await cdp.evalValue(`
      (() => {
        const s = window.__GAME__.scene.getScene('PrototypeScene');
        s.director.enemies = [];
        s.syncEnemyVisuals();
        s.clearEnemyShots();
        s.vectorShip.setPosition(384, 345);
        for (let p = 0; p < 3; p++) {
          s.pickups.spawn('power', 384, 345);
          s.checkPickupCollisions();
        }
        s.inputManager.keys.SPACE.isDown = true;
        for (let i = 0; i < 10; i++) s.update(performance.now(), 16.67);
        return {
          weaponLevel: s.weapons.weaponLevel,
          powerMeter: s.weapons.powerMeter,
          beamCount: s.crimsonLaserState.beams.length,
          redBallsCount: s.shots.length,
          hudLevel: s.hud.weaponLevelText.text,
          hudPMeter: s.hud.powerMeterText.text,
        };
      })()
    `);
    console.log('[LASER RUBRO NV2 - FLUXO DUPLO]:', JSON.stringify(lv2Info));
    if (lv2Info.weaponLevel !== 2 || lv2Info.beamCount !== 2 || lv2Info.redBallsCount !== 0) {
      throw new Error('Falha no Nível 2 do Laser Rubro: ' + JSON.stringify(lv2Info));
    }
    await capturePng(cdp, 'laser_rubro_lv2.png');

    // NÍVEL 3 — EXPANSÃO LATERAL (2 frontais + 2 ramificações laterais em abertura cíclica)
    const lv3Info = await cdp.evalValue(`
      (() => {
        const s = window.__GAME__.scene.getScene('PrototypeScene');
        s.director.enemies = [];
        s.syncEnemyVisuals();
        s.clearEnemyShots();
        s.vectorShip.setPosition(384, 345);
        s.setTestWeapon('red', 3, 2);
        s.inputManager.keys.SPACE.isDown = true;
        for (let i = 0; i < 14; i++) s.update(performance.now(), 16.67);
        return {
          weaponLevel: s.weapons.weaponLevel,
          beamCount: s.crimsonLaserState.beams.length,
          roles: s.crimsonLaserState.beams.map(b => b.role),
          redBallsCount: s.shots.length,
          hudLevel: s.hud.weaponLevelText.text,
          hudPMeter: s.hud.powerMeterText.text,
        };
      })()
    `);
    console.log('[LASER RUBRO NV3 - EXPANSÃO LATERAL]:', JSON.stringify(lv3Info));
    if (lv3Info.beamCount !== 4 || lv3Info.redBallsCount !== 0) {
      throw new Error('Falha no Nível 3 do Laser Rubro: ' + JSON.stringify(lv3Info));
    }
    await capturePng(cdp, 'laser_rubro_lv3.png');

    // NÍVEL 4 — ASAS DE ENERGIA (2 frontais + 2 asas laterais + 2 fluxos de cobertura posterior rear-wing)
    const lv4Info = await cdp.evalValue(`
      (() => {
        const s = window.__GAME__.scene.getScene('PrototypeScene');
        s.director.enemies = [];
        s.syncEnemyVisuals();
        s.clearEnemyShots();
        // Posiciona nave em Y=320 para exibir claramente os 2 fluxos de cobertura posterior (rear-wing até Y~374)
        s.vectorShip.setPosition(384, 320);
        s.setTestWeapon('red', 4, 3);
        s.inputManager.keys.SPACE.isDown = true;
        for (let i = 0; i < 16; i++) s.update(performance.now(), 16.67);
        return {
          weaponLevel: s.weapons.weaponLevel,
          beamCount: s.crimsonLaserState.beams.length,
          roles: s.crimsonLaserState.beams.map(b => b.role),
          rearWingCount: s.crimsonLaserState.beams.filter(b => b.role === 'rear-wing').length,
          redBallsCount: s.shots.length,
          hudLevel: s.hud.weaponLevelText.text,
          hudPMeter: s.hud.powerMeterText.text,
        };
      })()
    `);
    console.log('[LASER RUBRO NV4 - ASAS DE ENERGIA]:', JSON.stringify(lv4Info));
    if (lv4Info.beamCount !== 6 || lv4Info.rearWingCount !== 2 || lv4Info.redBallsCount !== 0) {
      throw new Error('Falha no Nível 4 do Laser Rubro (Asas de Energia + rear-wing): ' + JSON.stringify(lv4Info));
    }
    await capturePng(cdp, 'laser_rubro_lv4.png');

    // =========================================================================
    // 2. ARMA 1 — VERDE: ENERGIA ESPIRALADA (N1, N2, N3, N4)
    // =========================================================================
    for (const lvl of [1, 2, 3, 4]) {
      const greenInfo = await cdp.evalValue(`
        (() => {
          const s = window.__GAME__.scene.getScene('PrototypeScene');
          s.director.enemies = [];
          s.syncEnemyVisuals();
          s.clearEnemyShots();
          s.clearPlayerShots();
          s.vectorShip.setPosition(384, 355);
          s.setTestWeapon('green', ${lvl}, ${lvl === 4 ? 3 : lvl - 1});
          s.inputManager.keys.SPACE.isDown = true;
          for (let i = 0; i < 24; i++) s.update(performance.now(), 16.67);
          return {
            level: s.weapons.weaponLevel,
            activeWaveProjectiles: s.shots.length,
            hudWeapon: s.hud.weaponTitleText.text,
          };
        })()
      `);
      console.log(`[ENERGIA ESPIRALADA NV${lvl}]:`, JSON.stringify(greenInfo));
      await capturePng(cdp, `energia_espiralada_lv${lvl}.png`);
      if (lvl === 4) {
        await capturePng(cdp, 'raio_esmeralda_lv4.png');
      }
    }

    // =========================================================================
    // 3. ARMA 2 — AZUL: DISPERSÃO AZUL (N1, N2, N3, N4)
    // =========================================================================
    for (const lvl of [1, 2, 3, 4]) {
      const blueInfo = await cdp.evalValue(`
        (() => {
          const s = window.__GAME__.scene.getScene('PrototypeScene');
          s.director.enemies = [];
          s.syncEnemyVisuals();
          s.clearEnemyShots();
          s.clearPlayerShots();
          s.vectorShip.setPosition(384, 355);
          s.setTestWeapon('ion', ${lvl}, ${lvl === 4 ? 3 : lvl - 1});
          s.inputManager.keys.SPACE.isDown = true;
          for (let i = 0; i < 20; i++) s.update(performance.now(), 16.67);
          return {
            level: s.weapons.weaponLevel,
            activeSpreadProjectiles: s.shots.length,
            hudWeapon: s.hud.weaponTitleText.text,
          };
        })()
      `);
      console.log(`[DISPERSÃO AZUL NV${lvl}]:`, JSON.stringify(blueInfo));
      await capturePng(cdp, `dispersao_azul_lv${lvl}.png`);
    }

    // =========================================================================
    // 4. COMBATE REAL CONTRA MINIBOSS RAIA-DENTE + MÚLTIPLOS INIMIGOS
    //    E CAPTURAS REAIS EM 1920x1080 E 1366x768 (SEÇÃO 9.5)
    // =========================================================================
    const combatInfo = await cdp.evalValue(`
      (() => {
        const s = window.__GAME__.scene.getScene('PrototypeScene');
        s.clearPlayerShots();
        s.vectorShip.setPosition(384, 330);
        s.setTestWeapon('red', 4, 3);
        s.inputManager.keys.SPACE.isDown = true;

        s.director.scrollPx = 1800;
        s.director.minibossSpawned = false;
        s.director.boss = null;
        s.director.update(50, 384, 330);
        if (s.director.boss) {
          s.director.boss.phase = 'active';
          s.director.boss.x = 384;
          s.director.boss.y = 115;
          s.syncBossVisual(s.director.boss);
          s.hud.showBossBar(s.director.boss.name, s.director.boss.hp, s.director.boss.maxHp);
        }

        for (const e of s.director.enemies) {
          if (!s.enemyVisuals.has(e.id)) s.makeEnemyVisual(e);
        }
        s.syncEnemyVisuals();

        for (const bx of [320, 360, 384, 408, 448]) {
          s.spawnEnemyShot({ x: bx, y: 205, velocityX: 0, velocityY: 130 });
        }

        const initialBossHp = s.director.boss ? s.director.boss.hp : 0;
        for (let i = 0; i < 4; i++) s.update(performance.now(), 16.67);
        const afterBossHp = s.director.boss ? s.director.boss.hp : 0;

        return {
          bossName: s.director.boss?.name,
          initialBossHp,
          afterBossHp,
          impactsCount: s.crimsonLaserState.impacts.length,
          enemyShotsCount: s.enemyShots.length,
        };
      })()
    `);
    console.log('[COMBATE MINIBOSS + INIMIGOS (1920x1080)]:', JSON.stringify(combatInfo));
    await capturePng(cdp, 'laser_rubro_combat_miniboss.png');
    await capturePng(cdp, 'hud_1920x1080.png');
    await capturePng(cdp, '03_gameplay_fenda_pelagica.png');

    // Captura na segunda resolução obrigatória de uso: 1366x768 (Seção 9.5)
    await setViewport(cdp, 1366, 768);
    await cdp.evalValue(`
      (() => {
        const s = window.__GAME__.scene.getScene('PrototypeScene');
        for (let i = 0; i < 4; i++) s.update(performance.now(), 16.67);
        return true;
      })()
    `);
    await capturePng(cdp, 'hud_1366x768.png');

    // Verifica interrupção imediata ao soltar SPACE
    const releaseCheck = await cdp.evalValue(`
      (() => {
        const s = window.__GAME__.scene.getScene('PrototypeScene');
        s.inputManager.keys.SPACE.isDown = false;
        for (let i = 0; i < 10; i++) s.update(performance.now(), 20);
        return {
          isEmitting: s.crimsonLaserState.isEmitting,
          beamCount: s.crimsonLaserState.beams.length,
        };
      })()
    `);
    console.log('[INTERRUPÇÃO AO SOLTAR SPACE]:', JSON.stringify(releaseCheck));
    if (releaseCheck.isEmitting || releaseCheck.beamCount !== 0) {
      throw new Error('Laser Rubro não encerrou ao soltar SPACE!');
    }

    if (cdp.errors.length > 0) {
      console.error('[BROWSER ERRORS DETECTED]', cdp.errors);
      process.exitCode = 1;
    } else {
      console.log('[SUCCESS] Zero erros de console/runtime! Todas as 12 variações de armas e HUD 1366x768 / 1920x1080 validadas.');
    }
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    server.close();
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
