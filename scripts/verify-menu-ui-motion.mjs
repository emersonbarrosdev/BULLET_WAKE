import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer as createViteDevServer } from 'vite';

const isBefore = process.argv.includes('--before');
const outArg = process.argv.find((a) => a.startsWith('--out='));
const out = resolve(outArg ? outArg.slice(6) : isBefore ? 'docs/screenshots/menu-ui-before' : 'docs/screenshots/menu-ui-after');
mkdirSync(out, { recursive: true });

const devServer = await createViteDevServer({
  configFile: resolve('vite.config.ts'),
  mode: 'development',
  server: { host: '127.0.0.1', port: 0, strictPort: false },
});
await devServer.listen();
const addr = devServer.httpServer.address();
const devUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 5173}/`;

const profile = mkdtempSync(join(tmpdir(), 'bw-menu-verify-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
  '--enable-webgl', '--ignore-gpu-blocklist',
  '--remote-debugging-port=0', '--remote-allow-origins=*', '--no-first-run',
  '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let socket;
const errors = [];

try {
  let target;
  for (let i = 0; i < 80 && !target; i++) {
    try {
      const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim();
      target = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find((t) => t.type === 'page');
    } catch {}
    if (!target) await sleep(150);
  }
  if (!target) throw new Error('No Chrome target');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  socket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id) {
      const h = pending.get(msg.id); if (!h) return;
      pending.delete(msg.id); clearTimeout(h.timeout);
      msg.error ? h.reject(new Error(JSON.stringify(msg.error))) : h.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails);
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); rej(new Error('CDP timeout: ' + method)); }, 60000);
    pending.set(id, { resolve: res, reject: rej, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async (expr, max = 250) => {
    for (let i = 0; i < max; i++) { if (await evaluate(expr)) return; await sleep(80); }
    throw new Error('Timeout: ' + expr);
  };
  const settle = (ms = 320) => sleep(ms).then(() => evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))'));
  const snap = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(out, `${name}.png`), Buffer.from(res.data, 'base64'));
  };

  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: devUrl });

  // Wait for ArcadeScene to reach STUDIO_SPLASH or MAIN_MENU
  await waitFor("window.__GAME__?.scene.isActive('ArcadeScene') && ['STUDIO_SPLASH','MAIN_MENU'].includes(window.__GAME__.scene.getScene('ArcadeScene').openingState)");
  await evaluate(`window.s = window.__GAME__.scene.getScene('ArcadeScene'); s.audio.setMix(0, 0, true); true;`);

  // 1. Studio splash
  await evaluate(`s.show('intro'); s.introClock = 1.1; s.renderIntro(); true;`);
  await settle(100);
  await snap('01-studio-splash');

  // 2. Main Menu / Title Screen (default focus 0 = INICIAR JORNADA)
  await evaluate(`s.show('title'); true;`);
  await settle(480);
  if (!isBefore) {
    const alphas = await evaluate(`s.buttons.map(b => Number((b.modern?.container.alpha ?? 1).toFixed(2)))`);
    assert.ok(alphas.every((a) => a >= 0.99), `All title buttons must be fully visible after entrance: ${JSON.stringify(alphas)}`);
  }
  await snap('02-title-main-menu');

  // 3. Mouse hover over button 1 (CONTROLES) — real mouseMoved event!
  const btnCoords = await evaluate(`(() => {
    const canvas = window.__GAME__.canvas;
    const rect = canvas.getBoundingClientRect();
    const wv = s.cameras.main.worldView;
    return s.buttons.map((b, i) => {
      const wx = b.modern ? b.modern.worldX : b.node.x;
      const wy = b.modern ? b.modern.worldY : b.node.y;
      const sx = rect.left + ((wx - wv.x) / wv.width) * rect.width;
      const sy = rect.top + ((wy - wv.y) / wv.height) * rect.height;
      return { i, label: b.node.text, wx, wy, sx: Math.round(sx), sy: Math.round(sy) };
    });
  })()`);
  console.log('Title buttons:', JSON.stringify(btnCoords));

  if (btnCoords[1]) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btnCoords[1].sx, y: btnCoords[1].sy });
    await settle(260);
    await snap('03-title-hover-controles');
    if (!isBefore) {
      const hoverState = await evaluate(`({
        focus: s.focus,
        btn1Scale: Number((s.buttons[1]?.modern?.container.scaleX ?? 1).toFixed(3)),
        btn0Scale: Number((s.buttons[0]?.modern?.container.scaleX ?? 1).toFixed(3)),
      })`);
      console.log('Hover state:', JSON.stringify(hoverState));
      assert.equal(hoverState.focus, 1, 'Mouse hover on CONTROLES must focus button 1');
      assert.ok(hoverState.btn1Scale > 1.02, `Hovered button must scale up smoothly, got ${hoverState.btn1Scale}`);
      assert.ok(hoverState.btn0Scale <= 1.01, `Unfocused button must return to scale 1, got ${hoverState.btn0Scale}`);
    }
  }

  // 4. Button pressed state on OPÇÕES (mousePressed without releasing yet, then snap)
  if (btnCoords[2]) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btnCoords[2].sx, y: btnCoords[2].sy });
    await settle(240);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btnCoords[2].sx, y: btnCoords[2].sy, button: 'left', clickCount: 1 });
    await settle(95);
    await snap('04-title-pressed-opcoes');
    if (!isBefore) {
      const pressedScale = await evaluate(`Number((s.buttons[2]?.modern?.container.scaleX ?? 1).toFixed(3))`);
      console.log('Pressed scale on OPÇÕES:', pressedScale);
      assert.ok(pressedScale < 0.99, `Pressed button must compress visually, got ${pressedScale}`);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btnCoords[2].sx, y: btnCoords[2].sy, button: 'left', clickCount: 1 });
    await settle(420);
  }

  // 5. Settings screen
  await evaluate(`s.pauseOrigin = 'title'; s.show('settings'); true;`);
  await settle(460);
  await snap('05-settings');

  // 6. Controls screen — PC tab
  await evaluate(`s.pauseOrigin = 'title'; s.controlsTab = 'pc'; s.show('controls'); true;`);
  await settle(460);
  await snap('06-controls-pc');

  // 7. Controls screen — Gamepad (PlayStation) tab
  await evaluate(`s.controlsTab = 'gamepad'; s.controlsPadPreview = 'playstation'; s.show('controls'); true;`);
  await settle(460);
  await snap('07-controls-gamepad');

  // 8. Pilot select screen
  await evaluate(`s.show('pilot'); true;`);
  await settle(460);
  await snap('08-pilot-select');

  // 9. Mission select screen
  await evaluate(`s.show('missions'); true;`);
  await settle(460);
  await snap('09-mission-select');

  // 10. Touch settings screen
  await evaluate(`s.show('touch-settings'); true;`);
  await settle(460);
  await snap('10-touch-settings');

  if (!isBefore) {
    // Interactive Keyboard, Mouse, and PlayStation Gamepad navigation verification (no gameplay started!)
    // A) Keyboard navigation on title -> pilot -> missions -> back -> title
    await evaluate(`s.show('title'); true;`);
    await settle(350);
    const k0 = await evaluate(`s.focus`);
    assert.equal(k0, 0, 'Title should start focused on button 0 (INICIAR JORNADA)');

    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await settle(80);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
    await settle(200);
    const k1 = await evaluate(`s.focus`);
    assert.equal(k1, 1, 'ArrowDown should move focus to button 1 (CONTROLES)');

    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await settle(80);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await settle(350);
    assert.equal(await evaluate(`s.screen`), 'controls', 'Enter on CONTROLES should open controls screen');

    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await settle(80);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await settle(350);
    assert.equal(await evaluate(`s.screen`), 'title', 'Escape on controls should return to title');

    // B) PlayStation Gamepad navigation (○ confirm = button 1, × back = button 0, D-pad = 12..15)
    const gpResult = await evaluate(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      let mockButtons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
      let mockAxes = [0, 0, 0, 0];
      const fakePad = { id: 'DualSense Wireless Controller (054c)', mapping: 'standard', connected: true, get buttons() { return mockButtons; }, get axes() { return mockAxes; } };
      const origGetGamepads = navigator.getGamepads?.bind(navigator);
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [fakePad] });
      const tapBtn = async (idx) => {
        mockButtons[idx] = { pressed: true, value: 1 };
        await sleep(70);
        mockButtons[idx] = { pressed: false, value: 0 };
        await sleep(240);
      };
      try {
        s.show('title');
        await sleep(320);
        const startFocus = s.focus;
        // Confirm ○ (1) on INICIAR JORNADA -> pilot
        await tapBtn(1);
        const afterCircle1 = s.screen;
        // Confirm ○ (1) on DECOLAR COM BAYEK -> missions
        await tapBtn(1);
        const afterCircle2 = s.screen;
        // Verify locked mission (button 1) cannot start gameplay when confirmed
        await tapBtn(13); // D-pad down -> focus button 1 (BLOQUEADA)
        const lockedFocus = s.focus;
        await tapBtn(1); // ○ on locked button
        const afterLockedConfirm = s.screen;
        // × (0) -> back to pilot
        await tapBtn(0);
        const afterCross1 = s.screen;
        // × (0) -> back to title
        await tapBtn(0);
        const afterCross2 = s.screen;
        return { startFocus, afterCircle1, afterCircle2, lockedFocus, afterLockedConfirm, afterCross1, afterCross2, worldExists: !!s.world };
      } finally {
        if (origGetGamepads) Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: origGetGamepads });
      }
    })()`);
    console.log('PlayStation Gamepad Nav:', JSON.stringify(gpResult));
    assert.equal(gpResult.startFocus, 0);
    assert.equal(gpResult.afterCircle1, 'pilot', '○ on title should enter pilot select');
    assert.equal(gpResult.afterCircle2, 'missions', '○ on pilot select should enter missions');
    assert.equal(gpResult.afterLockedConfirm, 'missions', '○ on locked mission must not start match or leave missions');
    assert.equal(gpResult.afterCross1, 'pilot', '× on missions should return to pilot');
    assert.equal(gpResult.afterCross2, 'title', '× on pilot should return to title');
    assert.equal(gpResult.worldExists, false, 'Menu validation must never start gameplay');

    // C) FPS check on animated title menu
    const fps = await evaluate(`new Promise(resolve => {
      let frames = 0; const t0 = performance.now();
      function step() {
        frames++;
        if (performance.now() - t0 >= 800) { resolve(Math.round(frames * 1000 / (performance.now() - t0))); return; }
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    })`);
    console.log('Title menu live FPS:', fps);
    assert.ok(fps >= 45, `Expected smooth menu FPS >= 45, got ${fps}`);
    assert.equal(errors.length, 0, 'Runtime errors occurred: ' + JSON.stringify(errors));
    console.log('ALL MENU UI, INTERACTION, GAMEPAD & PERFORMANCE ASSERTIONS PASSED!');
  }
} finally {
  socket?.close();
  chrome.kill();
  await devServer.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
