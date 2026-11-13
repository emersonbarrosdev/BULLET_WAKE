import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { steer } from './arcade-route.mjs';

const root = resolve('dist');
const out = resolve('docs/screenshots/pelagic-archipelago');
const artifactDir = 'C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d';
mkdirSync(out, { recursive: true });

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
};

const server = createServer((req, res) => {
  const file = resolve(
    root,
    '.' + (req.url === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname),
  );
  if (!file.startsWith(root + sep) || !existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const profile = mkdtempSync(join(tmpdir(), 'bw-archipelago-'));
const chrome = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--remote-debugging-port=0',
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + profile,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
const errors = [];
const report = { errors, scenes: {}, scrollCheck: [], fps: null };

try {
  let target;
  for (let i = 0; i < 60; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(
        (t) => t.type === 'page',
      );
    } catch {}
    if (target) break;
    await sleep(150);
  }
  assert(target, 'Chrome target page not found');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    socket.onopen = r;
    socket.onerror = j;
  });

  let seq = 0;
  const pending = new Map();
  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(msg.error) : p.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      errors.push(msg.params.entry);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression: `(async()=>{const value=await eval(${JSON.stringify(expression)});return value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype?undefined:value;})()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  const wait = async (expr) => {
    for (let i = 0; i < 150; i++) {
      if (await evaluate(expr)) return;
      await sleep(100);
    }
    throw Error('Timeout ' + expr + ' ' + JSON.stringify(errors));
  };

  const captureDualRes = async (baseName) => {
    for (const [w, h, suffix] of [
      [1366, 768, '1366x768'],
      [1920, 1080, '1920x1080'],
    ]) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(`window.__GAME__.scale.refresh(); s.backdrop.draw(s.clock, s.world, s.quality); s.renderWorld(0);`);
      await sleep(140);
      const r = await send('Page.captureScreenshot', { format: 'png' });
      const fileName = `${baseName}_${suffix}.png`;
      const destPath = join(out, fileName);
      writeFileSync(destPath, Buffer.from(r.data, 'base64'));
      if (existsSync(artifactDir)) {
        copyFileSync(destPath, join(artifactDir, fileName));
      }
    }
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` });

  await wait(`window.__GAME__?.scene.isActive('ArcadeScene') && !!window.__GAME__.scene.getScene('ArcadeScene').ui`);

  await evaluate(`
    window.s = window.__GAME__.scene.getScene('ArcadeScene');
    window.steer = ${steer.toString()};
    s.audio.setMix(0, 0, true);
    s.begin(0);
    s.scene.pause();
    window.renderFrame = () => {
      s.backdrop.draw(s.clock, s.world, s.quality);
      s.renderWorld(1/60);
    };
    window.stepFrames = (frames, input = { x: 0, y: 0, fire: true, special: false }) => {
      for (let i = 0; i < frames; i++) {
        s.world.step(1/120, input);
        s.clock += 1/120;
        s.consumeEvents();
        if (i % 2 === 0) renderFrame();
      }
      renderFrame();
    };
  `);

  // Export full composed coast strip for inspection
  const stripBase64 = await evaluate(`(() => {
    const tex = s.textures.get('pelagic-continuous-shores').getSourceImage();
    return tex.toDataURL('image/png').split(',')[1];
  })()`);
  const stripPath = join(out, 'pelagic-continuous-shores-strip.png');
  writeFileSync(stripPath, Buffer.from(stripBase64, 'base64'));
  if (existsSync(artifactDir)) {
    copyFileSync(stripPath, join(artifactDir, 'pelagic-continuous-shores-strip.png'));
  }

  // --- CENA 1: INÍCIO DA FASE ---
  // Avança pela introdução (2.2s) + primeiros segundos (scroll ~ 90, Enseada da Vila à esquerda + Falésia/Ilhota à direita + primeiras formações aéreas)
  await evaluate(`
    s.begin(0);
    s.scene.pause();
    s.world.state = 'play';
    s.world.introTime = 0;
    s.world.scroll = 72;
    s.world.route = 3.8;
    s.world.elapsed = 3.8;
    s.world.score = 480;
    s.world.weapons.weaponLevel = 1;
    s.world.player.x = 384;
    s.world.player.y = 366;
    s.world.player.invulnerable = 0;
    s.message('BAYEK:\\nIniciando a\\nRota 01.\\nFenda Pelágica!');
    stepFrames(95, { x: 0, y: 0, fire: true, special: false });
  `);
  await captureDualRes('01_inicio_da_fase');
  report.scenes.start = await evaluate(`({ scroll: s.world.scroll, route: s.world.route, enemies: s.world.enemies.length, bullets: s.world.bullets.filter(b => b.active).length })`);

  // --- CENA 2: COMBATE INTERMEDIÁRIO ---
  // Península de Cabanas/Palmeiras à esquerda + Píer Portuário Direito + Barcos, Caças, Explosão e Power-up P
  await evaluate(`
    s.begin(0);
    s.scene.pause();
    s.world.state = 'play';
    s.world.introTime = 0;
    s.world.waveIndex = 999;
    s.world.supplyIndex = 999;
    // scroll = 1415 coloca ty = screenY - 1415 mod 2400 -> [985 .. 1417], mostrando id=2 (esq) e id=7 (píer dir) + mar aberto!
    s.world.scroll = 1415;
    s.world.route = 68;
    s.world.elapsed = 68;
    s.world.score = 7200;
    s.world.weapons.weaponLevel = 3;
    s.world.weapons.powerMeter = 2;
    s.world.player.x = 384;
    s.world.player.y = 362;
    s.world.player.invulnerable = 10;
    s.world.spawnEncounter({ at: 68, family: 'boat', formation: 'pair', motion: 'stationary', lane: 0.35 });
    s.world.spawnEncounter({ at: 68, family: 'fighter', formation: 'trio', motion: 'straight', lane: 0.48 });
    s.world.cargo.push({ id: 701, x: 422, y: 215, vx: 12, vy: 18, kind: 'power', crate: false, hp: 1, age: 0.4 });
    s.message('BAYEK:\\nMar aberto.\\nVamos abrir\\ncaminho!');
    stepFrames(90, { x: 0, y: 0, fire: true, special: false });
    if (s.world.enemies[1]) {
      s.world.enemies[1].x = 396;
      s.world.enemies[1].y = 148;
      s.explosion(396, 148, 44, 0.45);
    }
    renderFrame();
  `);
  await captureDualRes('02_combate_intermediario');
  report.scenes.midCombat = await evaluate(`({ scroll: s.world.scroll, route: s.world.route, enemies: s.world.enemies.length })`);

  // --- CENA 3: PORTO, GUINDASTES, BARCOS E FAROL ---
  // Complexo Portuário Conectado à esquerda (silo, galpão azul, 2 guindastes, contêineres, corais) + Promontório do Farol e Enseada de Praia/Corais à direita!
  await evaluate(`
    s.begin(0);
    s.scene.pause();
    s.world.state = 'play';
    s.world.introTime = 0;
    s.world.waveIndex = 999;
    s.world.supplyIndex = 999;
    // scroll = 895 coloca ty = screenY - 895 mod 2400 -> [1505 .. 1937], alinhando id=3 (porto esq) + id=8 (farol dir) + mar aberto + id=9 (praia/corais dir)!
    s.world.scroll = 895;
    s.world.route = 96;
    s.world.elapsed = 96;
    s.world.score = 7200;
    s.world.weapons.weaponLevel = 3;
    s.world.weapons.powerMeter = 2;
    s.world.player.x = 384;
    s.world.player.y = 364;
    s.world.player.invulnerable = 10;
    s.world.spawnEncounter({ at: 96, family: 'boat', formation: 'pair', motion: 'stationary', lane: 0.42 });
    s.world.spawnEncounter({ at: 96, family: 'bomber', formation: 'escort', motion: 'straight', lane: 0.52 });
    s.world.cargo.push({ id: 702, x: 438, y: 188, vx: 0, vy: 14, kind: 'power', crate: true, hp: 3, age: 0.6 });
    s.message('BAYEK:\\nMar aberto.\\nVamos abrir\\ncaminho!');
    stepFrames(96, { x: 0, y: 0, fire: true, special: false });
    // Ajusta barcos no canal entre o porto e o farol com esteira branca e tiros
    const boats = s.world.enemies.filter(e => e.family === 'boat');
    if (boats[0]) { boats[0].x = 324; boats[0].y = 248; boats[0].flash = 0; boats[0].navigation.heading = Math.PI * 0.82; }
    if (boats[1]) { boats[1].x = 434; boats[1].y = 266; boats[1].flash = 0; boats[1].navigation.heading = Math.PI * 1.14; }
    for (const e of s.world.enemies) e.flash = 0;
    s.explosion(428, 122, 46, 0.45);
    renderFrame();
  `);
  await captureDualRes('03_porto_guindastes_barcos_farol');
  report.scenes.harborLighthouse = await evaluate(`({ scroll: s.world.scroll, route: s.world.route, enemies: s.world.enemies.length })`);

  // --- CENA 4: TRECHO DE MAR ABERTO ---
  // Águas abertas alcançando 100% das bordas laterais com ilhotas/recifes esparsos e combate naval/aéreo
  await evaluate(`
    s.begin(0);
    s.scene.pause();
    s.world.state = 'play';
    s.world.introTime = 0;
    s.world.waveIndex = 999;
    s.world.supplyIndex = 999;
    // scroll = 1970 coloca ty = screenY - 1970 mod 2400 -> [430 .. 862], onde >75% das bordas são mar aberto profundo com apenas afloramentos rochosos!
    s.world.scroll = 1970;
    s.world.route = 132;
    s.world.elapsed = 132;
    s.world.score = 12400;
    s.world.weapons.weaponLevel = 3;
    s.world.player.x = 384;
    s.world.player.y = 360;
    s.world.player.invulnerable = 10;
    s.world.spawnEncounter({ at: 132, family: 'fighter', formation: 'v', motion: 'sine', lane: 0.5 });
    s.world.spawnEncounter({ at: 132, family: 'boat', formation: 'solo', motion: 'stationary', lane: 0.35 });
    s.message('BAYEK:\\nCanal oceânico\\naberto à frente!');
    stepFrames(76, { x: 0, y: 0, fire: true, special: false });
  `);
  await captureDualRes('04_trecho_mar_aberto');
  report.scenes.openSea = await evaluate(`({ scroll: s.world.scroll, route: s.world.route, enemies: s.world.enemies.length })`);

  // --- CENA 5: APROXIMAÇÃO DO CHEFE (CENA 3 DA REFERÊNCIA) ---
  // Encouraçado Pula-Onda sobre o Vórtice Abissal da Fenda Pelágica, ladeado pelo Porto e pelo Farol!
  await evaluate(`
    s.begin(0);
    s.scene.pause();
    s.world.state = 'play';
    s.world.introTime = 0;
    s.world.waveIndex = 999;
    s.world.supplyIndex = 999;
    s.world.miniStarted = true;
    // scroll = 918 alinha o Porto à esquerda e o Farol à direita enquanto o Vórtice Abissal gira no topo do canal atrás do Encouraçado Pula-Onda!
    s.world.scroll = 918;
    s.world.route = 299.9;
    s.world.elapsed = 299.9;
    s.world.score = 23200;
    s.world.weapons.weaponLevel = 4;
    s.world.weapons.powerMeter = 2;
    s.world.player.x = 384;
    s.world.player.y = 374;
    s.world.player.invulnerable = 10;
    // Avança 3.8s para o chefe entrar em posição e o leque de projéteis se expandir no canal
    stepFrames(455, { x: 0, y: 0, fire: true, special: false });
    if (s.world.boss) {
      for (const p of s.world.boss.parts) p.flash = 0;
    }
    s.message('BAYEK:\\nContato à frente!\\nÉ o chefe da\\nFenda Pelágica!');
    renderFrame();
  `);
  await captureDualRes('05_aproximacao_do_chefe');
  report.scenes.bossApproach = await evaluate(`({ scroll: s.world.scroll, route: s.world.route, boss: s.world.boss ? { x: s.world.boss.x, y: s.world.boss.y, phase: s.world.boss.phase } : null, vortexVisible: s.backdrop.vortex.visible })`);
  assert(report.scenes.bossApproach.boss, 'Boss must be active in boss-approach scene');
  assert(report.scenes.bossApproach.vortexVisible, 'Abyssal vortex must be visible in boss-approach scene');

  // --- VALIDAÇÃO DE DIREÇÃO DO SCROLL E MEDIÇÃO REAL DE FPS ---
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(`
    s.begin(0);
    s.world.state = 'play';
    s.world.introTime = 0;
    s.world.scroll = 800;
    s.world.route = 46;
    s.world.player.invulnerable = 100;
    s.touch.fire = true;
    s.scene.resume();
  `);

  for (let i = 0; i < 5; i++) {
    await sleep(250);
    report.scrollCheck.push(
      await evaluate(`({
        scroll: s.world.scroll,
        waterUV: s.backdrop.water.tilePositionY,
        depthUV: s.backdrop.oceanDepth.tilePositionY,
        causticsUV: s.backdrop.oceanCaustics.tilePositionY,
        coastTileY: s.backdrop.coast.tilePositionY,
      })`),
    );
  }
  for (let i = 1; i < report.scrollCheck.length; i++) {
    assert(report.scrollCheck[i].scroll > report.scrollCheck[i - 1].scroll, 'world.scroll must increase');
    assert(report.scrollCheck[i].waterUV < report.scrollCheck[i - 1].waterUV, 'waterUV must move negatively so waves drift down');
    assert(report.scrollCheck[i].depthUV < report.scrollCheck[i - 1].depthUV, 'depthUV must move negatively so ocean depth drifts down');
  }

  report.fps = await evaluate(`new Promise(resolve => {
    const deltas = [];
    let prev = performance.now();
    const start = prev;
    function tick(now) {
      deltas.push(now - prev);
      prev = now;
      if (now - start < 2500) {
        requestAnimationFrame(tick);
      } else {
        deltas.shift();
        deltas.sort((a, b) => a - b);
        const medianMs = deltas[Math.floor(deltas.length * 0.5)];
        const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        resolve({
          frames: deltas.length,
          medianMs: Number(medianMs.toFixed(2)),
          avgFps: Number((1000 / avgMs).toFixed(1)),
          p95Ms: Number(deltas[Math.floor(deltas.length * 0.95)].toFixed(2)),
        });
      }
    }
    requestAnimationFrame(tick);
  })`);

  assert.deepEqual(errors, [], 'Zero console/runtime errors allowed');
  writeFileSync(join(out, 'verification-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket?.close();
  chrome.kill();
  server.close();
}
