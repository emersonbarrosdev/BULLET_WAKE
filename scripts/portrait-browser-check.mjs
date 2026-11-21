/** Isolated visual/integration QA. Virtual browser inputs and measured RAF are not physical hardware certification. */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { qaGameAccess } from './qa-game-access.mjs';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { PELAGIC_RIVET_SHEET } from '../src/game/arcade/PelagicActorAnimsMath.ts';

const out = resolve('output/android-layout'); mkdirSync(out, { recursive: true });
const report = { status: 'running', errors: [], browserWarnings: [], captures: [], states: [], repairs: [], inputs: {}, performance: [], limitations: ['Browser emulation only; physical Android/controllers and human playtests are not certified.'] };
const server = await createServer({ plugins: [qaGameAccess()], configFile: resolve('vite.config.ts'), server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: { ignored: ['**/tmp/**', '**/dist/**', '**/output/**'] } } });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const profile = mkdtempSync(join(tmpdir(), 'bw-hull-qa-'));
const chrome = spawn(process.env.CHROME_BIN ?? (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'), ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let target;
  for (let i = 0; i < 120 && !target; i++) {
    try { const port = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { /* Browser startup. */ }
    if (!target) await sleep(100);
  }
  assert(target, 'Isolated Chrome did not start');
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { socket.onopen = r; socket.onerror = j; });
  const pending = new Map(); let seq = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); if (!p) return; pending.delete(message.id); clearTimeout(p.timer); message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result); }
    else if (message.method === 'Runtime.exceptionThrown') report.errors.push(message.params.exceptionDetails);
    else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const entry = message.params.entry;
      // Phaser attempts preventDefault on Chrome's non-cancelable touchcancel.
      // Record that browser intervention separately; actual input cancellation is asserted below.
      if (entry.source === 'intervention' && entry.text.startsWith('Ignored attempt to cancel a touchcancel event with cancelable=false')) report.browserWarnings.push(entry);
      else report.errors.push(entry);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timed out: ' + method)); }, 40000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const wait = async expression => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await sleep(100); } throw new Error('Timed out: ' + expression); };
  const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))');
  const shot = async (name, crop = false) => {
    await settle();
    const params = { format: 'png', captureBeyondViewport: false };
    if (crop) params.clip = await evaluate(`(()=>{const c=s.cameras.main,r=s.game.canvas.getBoundingClientRect(),a=c.getWorldPoint(0,0),b=c.getWorldPoint(c.width,c.height),side=160;const px=r.left+(s.world.player.x-a.x)/(b.x-a.x)*r.width,py=r.top+(s.world.player.y-a.y)/(b.y-a.y)*r.height;const x=Math.max(0,Math.min(innerWidth-side,px-side/2)),y=Math.max(0,Math.min(innerHeight-side,py-side/2));return{x,y,width:side,height:side,scale:3};})()`);
    const result = await send('Page.captureScreenshot', params), buffer = Buffer.from(result.data, 'base64');
    assert(buffer.length > 2000 && buffer.subarray(1, 4).toString() === 'PNG', 'Invalid screenshot ' + name);
    writeFileSync(join(out, name + '.png'), buffer);
    report.captures.push({ name, bytes: buffer.length, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) });
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 774, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.navigate', { url });
  await wait(`!!window.__GAME__?.scene.getScene('ArcadeScene')?.hullArt`);
  await wait(`window.__GAME__.scene.getScene('ArcadeScene').screen==='title'`);
  await evaluate(`(async()=>{window.s=window.__GAME__.scene.getScene('ArcadeScene');s.setDevSaveGuard(true);s.audio.setMix(0,0,true);const p=await import('/src/game/arcade/ArcadeProfileStore.ts');window.store=p.globalProfileStore;store.updateSettings({survivalRule:'hull-v1'});window.save=(await import('/src/game/systems/saveSystem.ts')).globalSave;s.show('title');s.scene.pause();})()`);
  const masks = await evaluate(`(async()=>{
    const {spriteContact}=await import('/src/game/render/SpriteSilhouette.ts');
    const warmup=s.contactWarmup, prototype=CanvasRenderingContext2D.prototype, original=prototype.getImageData;
    let reads=0,hits=0;prototype.getImageData=function(...args){reads++;return original.apply(this,args)};
    const sprite=s.add.sprite(-1000,-1000,'arc-enemies');
    try{for(const frame of warmup.frames){sprite.setTexture(frame.texture.key,frame.name);if(spriteContact(sprite,-2000,-1000,0,-1000)!==null)hits++;}}
    finally{prototype.getImageData=original;sprite.destroy();}
    return{ready:warmup.done,progress:warmup.progress,frames:warmup.frames.length,reads,hits};
  })()`);
  assert(masks.ready && masks.progress === 1 && masks.frames > 150 && masks.hits > 0, 'Collision preparation incomplete: ' + JSON.stringify(masks));
  assert.equal(masks.reads, 0, 'First contact must not read pixels during combat'); report.performance.push({ name: 'collision-cache', ...masks });
  const audioFocus = await evaluate(`(async()=>{
    const audio=(await import('/src/game/audio/audioSystem.ts')).globalAudio;
    window.dispatchEvent(new Event('focus'));s.audio.setMix(.2,.2,false);s.audio.unlock();s.audio.play('menu');
    await new Promise(r=>setTimeout(r,150));const playing=!s.audio.status().paused;
    window.dispatchEvent(new Event('blur'));await new Promise(r=>setTimeout(r,100));
    const background={paused:s.audio.status().paused,context:audio.ctx.state};
    s.audio.play('select');const changedWhileHidden=s.audio.status().paused;
    window.dispatchEvent(new Event('focus'));await new Promise(r=>setTimeout(r,100));const returned=!s.audio.status().paused;
    s.audio.pause();window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));const manualPause=s.audio.status().paused;
    s.audio.setMix(0,0,true);return{playing,background,changedWhileHidden,returned,manualPause};
  })()`);
  assert(audioFocus.playing && audioFocus.background.paused && audioFocus.background.context === 'suspended' && audioFocus.changedWhileHidden && audioFocus.returned && audioFocus.manualPause, JSON.stringify(audioFocus));
  report.inputs.audioFocus = audioFocus;
  const inspect = async name => {
    await evaluate(`Promise.all([...document.querySelectorAll('.bw-mobile img')].map(i=>i.decode()))`);
    await settle();
    const layout = await evaluate(`(()=>{const r=document.querySelector('.bw-mobile');return{screen:r?.dataset.screen,overflow:document.documentElement.scrollWidth>innerWidth||r.scrollWidth>r.clientWidth,small:[...r.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().height<43).map(b=>b.textContent),zoomX:s.cameras.main.zoomX,zoomY:s.cameras.main.zoomY,canvas:[s.game.canvas.width,s.game.canvas.height],viewport:[innerWidth,innerHeight],footer:r.querySelector('footer').getBoundingClientRect().bottom};})()`);
    assert(!layout.overflow, 'Horizontal overflow: ' + name);
    assert.equal(layout.small.length, 0, 'Undersized targets: ' + name + ' ' + layout.small.join(','));
    assert(Math.abs(layout.zoomX - layout.zoomY) < .0001, 'Distorted camera ' + name);
    assert(layout.canvas[0] >= layout.viewport[0] * 1.9, 'Low-density canvas ' + name);
    assert(layout.footer <= layout.viewport[1] + 1, 'Footer clipped ' + name);
    report.states.push({ name, ...layout }); await shot(name);
  };
  for (const [width, height] of (process.argv.includes('--side-only') ? [] : [[360, 774], [320, 640], [412, 915]])) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true }); await sleep(180);
    if (width === 360) {
      await evaluate(`store.resetAll();store.updateSettings({survivalRule:'hull-v1'});s.selectedHomeStage=undefined;s.disposeWorld();s.show('title');`);
      await inspect('360-welcome-login');
      const welcomeBefore = await evaluate(`(()=>{const m=document.querySelector('.bw-modal-overlay');const btns=[...(m?.querySelectorAll('.bw-dialog-actions button')??[])].map(b=>({t:b.textContent.trim(),d:b.disabled}));return{present:!!m,hasCheck:!!m?.querySelector('.bw-consent-check'),btns};})()`);
      assert(welcomeBefore.present && welcomeBefore.hasCheck && welcomeBefore.btns.every(b => b.d), 'LGPD checkbox must gate continuation buttons initially: ' + JSON.stringify(welcomeBefore));
      await evaluate(`(()=>{const c=document.querySelector('.bw-consent-check');c.click();})()`);
      await sleep(80);
      const welcomeAfter = await evaluate(`[...document.querySelectorAll('.bw-modal-overlay .bw-dialog-actions button')].map(b=>({t:b.textContent.trim(),d:b.disabled}))`);
      assert(welcomeAfter.every(b => !b.d), 'Checking LGPD consent must enable buttons: ' + JSON.stringify(welcomeAfter));
      await evaluate(`(()=>{const b=[...document.querySelectorAll('.bw-modal-overlay button')].find(b=>b.textContent.trim()==='Continuar como convidado');b.click();})()`);
      await sleep(160);
      assert.equal(await evaluate(`store.getProfile().account.privacyAccepted && store.getProfile().account.welcomePromptSeen`), true, 'Privacy & welcome dismissal did not persist');
      assert.equal(await evaluate(`!!document.querySelector('.bw-modal-overlay')`), false, 'Welcome modal did not close');
    } else {
      await evaluate(`store.markWelcomeSeen();s.selectedHomeStage=0;s.disposeWorld();s.show('title');`);
    }
    await evaluate(`Promise.all([...document.querySelectorAll('.bw-mobile img')].map(i=>i.decode()))`);
    const dash = await evaluate(`(()=>{
      const logo=document.querySelector('.bw-dash-logo img')?.getBoundingClientRect();
      const creditsBtn=document.querySelector('.bw-dash-credits')?.getBoundingClientRect();
      const controlsBtn=document.querySelector('.bw-dash-controls')?.getBoundingClientRect();
      const gear=document.querySelector('.bw-dash-gear')?.getBoundingClientRect();
      const profile=document.querySelector('.bw-dash-profile')?.getBoundingClientRect();
      const crPill=document.querySelector('.bw-currency-pill.cr')?.textContent?.trim();
      const gemPill=document.querySelector('.bw-currency-pill.gem')?.textContent?.trim();
      const skyFlyby=!!document.querySelector('.bw-dash-sky-lane .bw-mobile-flyby');
      const stageCard=document.querySelector('.bw-stage-hero-card')?.getBoundingClientRect();
      const stageImg=document.querySelector('.bw-stage-hero-img');
      const dots=document.querySelectorAll('.bw-stage-dot').length;
      const arrows=document.querySelectorAll('.bw-stage-arrow').length;
      const play=document.querySelector('.bw-dash-play');
      const tiles=[...document.querySelectorAll('.bw-dash-tile')].map(b=>({label:b.textContent.trim(),disabled:b.disabled,hasLock:!!b.querySelector('.bw-lock-badge svg'),isShop:b.classList.contains('is-shop'),height:b.getBoundingClientRect().height}));
      const scroll=document.querySelector('.bw-mobile-scroll');
      return{logo:logo?.width,creditsBtn:creditsBtn?.height,controlsBtn:controlsBtn?.height,gear:gear?.height,profile:profile?.height,crPill,gemPill,skyFlyby,stage:stageCard?.height,stageImgW:stageImg?.naturalWidth ?? 0,dots,arrows,playText:play?.textContent.trim(),playH:play?.getBoundingClientRect().height,tiles,scrollDiff:scroll.scrollHeight-scroll.clientHeight};
    })()`);
    assert(dash.logo >= 54 && dash.creditsBtn >= 44 && dash.controlsBtn >= 44 && dash.gear >= 44 && dash.profile >= 44 && dash.skyFlyby && dash.stage >= 170 && dash.stageImgW >= 900 && dash.dots === 2 && dash.arrows === 0 && dash.playText === 'Iniciar missão' && dash.playH >= 46, 'Dashboard proportions invalid: ' + JSON.stringify(dash));
    assert(dash.crPill && dash.gemPill !== undefined, 'Currencies missing in status strip: ' + JSON.stringify(dash));
    assert.deepEqual(dash.tiles.map(t => t.label), ['Pilotos', 'Hangar', 'Loja']);
    const shopTile = dash.tiles.find(t => t.label === 'Loja');
    assert(shopTile?.disabled && shopTile?.hasLock && shopTile?.isShop, 'Shop card must be highlighted and locked with padlock icon: ' + JSON.stringify(shopTile));
    assert(dash.scrollDiff <= 2, 'Home dashboard must fit without vertical scroll: ' + JSON.stringify(dash));
    if (width === 360) {
      await evaluate(`document.querySelectorAll('.bw-stage-dot')[1].click()`); await sleep(360);
      const lockedStage = await evaluate(`({locked:document.querySelectorAll('.bw-stage-hero-card')[1].classList.contains('is-locked'),hasCenterLock:!!document.querySelectorAll('.bw-stage-hero-card')[1].querySelector('.bw-center-lock svg'),playDisabled:document.querySelector('.bw-dash-play').disabled,trackTransform:document.querySelector('.bw-stage-track').style.transform})`);
      assert(lockedStage.locked && lockedStage.hasCenterLock && lockedStage.playDisabled && lockedStage.trackTransform.includes('-100%'), 'Locked stage 2 in carousel invalid: ' + JSON.stringify(lockedStage));
      await inspect('360-title-stage2-locked');
      await evaluate(`document.querySelectorAll('.bw-stage-hero-card')[1].click()`); await sleep(150);
      const gridInfo = await evaluate(`(()=>{const cards=[...document.querySelectorAll('.bw-stage-mini-card')].map(c=>({name:c.querySelector('.bw-stage-mini-name').textContent,locked:c.classList.contains('is-locked'),hasLock:!!c.querySelector('.bw-center-lock svg'),disabled:c.disabled}));return{open:!!document.querySelector('.bw-stages-sheet'),cards};})()`);
      assert(gridInfo.open && gridInfo.cards.length === 2 && !gridInfo.cards[0].locked && gridInfo.cards[1].locked && gridInfo.cards[1].hasLock && gridInfo.cards[1].disabled, 'All-stages modal invalid: ' + JSON.stringify(gridInfo));
      await inspect('360-all-stages-modal');
      await evaluate(`document.querySelectorAll('.bw-stage-mini-card')[0].click()`); await sleep(150);
      assert.equal(await evaluate(`!!document.querySelector('.bw-stages-sheet')`), false, 'Picking unlocked stage did not close modal');
      assert.equal(await evaluate(`document.querySelector('.bw-dash-play').disabled`), false, 'Picking unlocked stage 1 did not re-enable launch');
    }
    for (const screen of ['title', 'pilot', 'credits', 'controls', 'settings', 'touch-settings', 'hangar']) {
      await evaluate(`s.show(${JSON.stringify(screen)})`); await inspect(`${width}-${screen}`);
      if (screen === 'pilot') {
        const pilotCheck = await evaluate(`(()=>{
          const sc=document.querySelector('.bw-mobile-scroll');
          const bars=[...document.querySelectorAll('.bw-stat-row')].map(r=>({label:r.querySelector('.bw-stat-label').textContent,segs:r.querySelectorAll('.bw-stat-seg').length,filled:r.querySelectorAll('.bw-stat-seg.filled').length}));
          const tiles=[...document.querySelectorAll('.bw-mobile-pilots button')].map(b=>({name:b.querySelector('.bw-pilot-name').textContent,locked:!!b.querySelector('.bw-lock-badge svg'),text:b.textContent}));
          const hist=[...document.querySelectorAll('.bw-pilot-hist-cell')].map(c=>c.textContent);
          const footerBtns=[...document.querySelectorAll('.bw-mobile-footer button')].map(b=>b.textContent.trim());
          return{scrollDiff:sc.scrollHeight-sc.clientHeight,bars,tiles,hist,footerBtns};
        })()`);
        assert(pilotCheck.scrollDiff <= 2, `Pilot select must fit in one screen without scroll (${width}x${height}): ` + JSON.stringify(pilotCheck));
        assert.equal(pilotCheck.bars.length, 3, 'Expected 3 segmented stat bars');
        assert(pilotCheck.bars.every(b => b.segs === 5), 'Each stat bar must have 5 segments');
        assert.equal(pilotCheck.tiles.filter(t => t.locked).length, 4, 'Only Bayek should start unlocked; 4 pilots locked with padlock');
        assert(pilotCheck.tiles.every(t => !t.text.includes('Bloqueado')), 'Locked pilots must use padlock icon instead of Bloqueado text');
        assert.equal(pilotCheck.hist.length, 3, 'Expected pilot history metrics (Histórico, Abates, Recorde)');
        assert(pilotCheck.footerBtns.includes('Confirmar piloto'), 'Unlocked pilot action must be Confirmar piloto (not Decolar): ' + JSON.stringify(pilotCheck.footerBtns));
      }
      if (screen === 'controls') {
        const tabs = await evaluate(`[...document.querySelectorAll('.bw-mobile-tabs button')].map(b=>b.textContent.trim())`);
        assert.deepEqual(tabs, ['Touch', 'Controle'], 'Mobile controls must only show Touch and Controle tabs');
      }
    }
    if (width === 360) {
      // Double-confirmation purchase flow on Pilot Select
      await evaluate(`store.recordRunResult({runId:'qa-buy-pilot',missionId:1,pilotId:'nolan',difficulty:'normal',score:10000,rank:'B',victory:false,competitiveEligible:true,assisted:false,noMiss:false,noBomb:false,oneCC:false,creditsEarned:600,kills:15,achievements:[]});s.selectedPilotId='cora';s.show('pilot');`);
      await sleep(140);
      await evaluate(`[...document.querySelectorAll('.bw-mobile-footer button')].find(b=>b.textContent.includes('Comprar')).click()`);
      await sleep(160);
      assert(await evaluate(`!!document.querySelector('.bw-purchase-overlay')`), 'Buying a pilot must open double-confirmation modal');
      await inspect('360-pilot-purchase-confirm');
      await evaluate(`[...document.querySelectorAll('.bw-purchase-overlay button')].find(b=>b.textContent.trim()==='Cancelar').click()`);
      await sleep(160);
      assert.equal(await evaluate(`store.isPilotUnlocked('cora')`), false, 'Cancelling confirmation must not unlock pilot');
      await evaluate(`s.selectedPilotId='nolan';store.resetAll();store.markWelcomeSeen();store.updateSettings({survivalRule:'hull-v1'});`);
    }
    for (const tab of ['android', 'gamepad']) { await evaluate(`s.controlsTab='${tab}';s.show('controls')`); await inspect(`${width}-controls-${tab}`); }
    for (const tab of ['achievements', 'profile']) { await evaluate(`s.hangarTab='${tab}';s.show('hangar')`); await inspect(`${width}-hangar-${tab}`); }
    if (width === 360) {
      await evaluate(`(()=>{const i=document.querySelector('.bw-account-form input');i.value='PilotoQA';document.querySelector('.bw-account-form button').click();})()`);
      await sleep(160);
      assert.equal(await evaluate(`store.getProfile().account.mode`), 'linked', 'Profile local login failed');
      await inspect('360-hangar-profile-linked');
      await evaluate(`(()=>{const b=[...document.querySelectorAll('.bw-account-card button')].find(b=>b.textContent.includes('Sair da conta'));b.click();})()`);
      await sleep(160);
      assert.equal(await evaluate(`store.getProfile().account.mode`), 'guest', 'Profile local logout failed');
    }
    await evaluate(`s.hangarTab='hangar';s.begin(0);s.world.introTime=0;s.world.state='play';s.world.player.invulnerable=1000;`);
    const arena = await evaluate('JSON.stringify(s.world.arena)');
    for (const screen of ['pause', 'controls', 'settings', 'touch-settings', 'confirm-exit', 'defeat', 'result']) {
      await evaluate(`if('${screen}'==='defeat'){s.world.hull=0;s.world.state='defeat';}if('${screen}'==='result'){s.world.hull=2;s.world.state='victory';}s.show('${screen}')`); await inspect(`${width}-${screen}-ingame`);
      assert.equal(await evaluate('JSON.stringify(s.world.arena)'), arena, 'Opening ' + screen + ' changed portrait arena');
      if (screen === 'pause' || screen === 'confirm-exit') {
        const liveCheck = await evaluate(`({camVis:s.cameras.main.visible,hasLiveCls:document.querySelector('.bw-mobile').classList.contains('bw-live-backdrop')})`);
        assert(liveCheck.camVis && liveCheck.hasLiveCls, screen + ' must keep frozen gameplay visible behind translucent dialog: ' + JSON.stringify(liveCheck));
      }
      if (screen === 'confirm-exit') {
        const dialogBox = await evaluate(`(()=>{const b=document.querySelector('.bw-mobile-body').getBoundingClientRect();return{top:b.top,bottom:b.bottom,mid:(b.top+b.bottom)/2,vh:innerHeight};})()`);
        assert(Math.abs(dialogBox.mid - dialogBox.vh / 2) < dialogBox.vh * 0.14, 'confirm-exit must be vertically centered: ' + JSON.stringify(dialogBox));
      }
    }
    await evaluate(`s.show('ending')`); await inspect(`${width}-ending`);
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 774, deviceScaleFactor: 2, mobile: true }); await sleep(150);
  // Classic arcade countdown on mission launch (3 -> 2 -> 1 -> READY!)
  await evaluate(`s.disposeWorld();s.show('title');true`); await sleep(120);
  await evaluate(`document.querySelector('.bw-dash-play').click();true`); await sleep(160);
  await evaluate(`s.update(0, 16);true`);
  await settle();
  const cdStart = await evaluate(`({num:document.querySelector('.bw-countdown-num')?.textContent,active:s.launchCountdown>0,elapsed:s.world?.elapsed})`);
  assert(cdStart.num === '3' && cdStart.active && cdStart.elapsed === 0, 'Mission launch must start classic 3-2-1-READY countdown: ' + JSON.stringify(cdStart));
  await shot('360-countdown');
  await evaluate(`for(let i=0;i<160;i++)s.update(0, 20);true`);
  const cdDone = await evaluate(`({overlay:!!document.querySelector('.bw-countdown-overlay'),left:s.launchCountdown,elapsed:s.world?.elapsed})`);
  assert(!cdDone.overlay && cdDone.left === 0 && cdDone.elapsed > 0, 'Countdown must finish cleanly into active combat: ' + JSON.stringify(cdDone));
  const hudTexture = await evaluate(`(()=>{
    s.begin(0);s.renderWorld(0);const footer=s.footerScore,spec=s.touchSpecialText,chg=s.touchChargeText;
    const origFooter=footer.updateText,origSpec=spec.updateText,origChg=chg.updateText;
    let uploads=0,touchUploads=0;
    footer.updateText=function(...args){uploads++;return origFooter.apply(this,args)};
    spec.updateText=function(...args){touchUploads++;return origSpec.apply(this,args)};
    chg.updateText=function(...args){touchUploads++;return origChg.apply(this,args)};
    let stable,changed;
    try{
      for(let i=0;i<120;i++){s.renderHud();s.renderTouchOverlay();}
      stable=uploads;s.world.score++;s.renderHud();changed=uploads-stable;
    } finally {
      footer.updateText=origFooter;spec.updateText=origSpec;chg.updateText=origChg;
    }
    return{stable,changed,touchUploads,scale:footer.scaleX,font:footer.style.fontSize};
  })()`);
  assert.equal(hudTexture.stable, 0, 'Stable score must reuse its GPU texture'); assert.equal(hudTexture.changed, 1, 'Score change should redraw once'); assert.equal(hudTexture.touchUploads, 0, 'Touch labels must never re-upload GPU textures per frame'); assert.equal(hudTexture.scale, .875); report.performance.push({ name: 'score-texture', ...hudTexture });
  await evaluate(`s.begin(0);s.world.introTime=0;s.world.state='play';s.world.player.invulnerable=1000;s.scene.resume();true`);
  await sleep(600);
  const auto = await evaluate(`({fire:s.lastInput.fire,primaryButton:s.touchFireText.visible,bullets:s.world.bullets.filter(b=>b.active&&!b.enemy).length,touch:s.touchShown,ratio:s.game.canvas.width/s.game.canvas.clientWidth})`);
  assert(auto.fire && !auto.primaryButton && auto.bullets > 0, 'Android must shoot without touching FIRE: ' + JSON.stringify(auto)); report.inputs.autofire = auto;
  await shot('360-gameplay-autofire');
  await evaluate(`(()=>{const l=s.touchController.getLayout();s.touchController.onPointerDown(80,l.charge.x,l.charge.y)})()`); await sleep(400);
  assert(await evaluate('s.world.chargedShot.ratio>0'), 'Charge hold did not charge');
  await evaluate('s.touchController.onPointerUp(80)'); await sleep(100);
  assert(await evaluate('s.world.bullets.some(b=>b.active&&b.charged)'), 'Charge release did not fire');
  // Browser touch events exercise Phaser's actual canvas -> camera -> world mapping.
  const touch = async (type, points) => send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 6, radiusY: 6, force: 1 })) });
  const player = () => evaluate('({x:s.world.player.x,y:s.world.player.y})');
  const beforeTouch = await player();
  await touch('touchStart', [[1, 260, 470]]); await sleep(100);
  const neutral = await player();
  assert(Math.hypot(neutral.x - beforeTouch.x, neutral.y - beforeTouch.y) < .01, 'Touchdown moved the plane before dragging');
  await touch('touchMove', [[1, 290, 450]]); await sleep(160);
  const moved = await player();
  assert(moved.x > neutral.x + 5 && moved.y < neutral.y - 5, 'Free movement in right half did not reach simulation');
  await shot('360-floating-movement');
  await touch('touchCancel', []); await sleep(80);
  assert(await evaluate('!s.touchController.peek().stickActive&&s.lastInput.x===0&&s.lastInput.y===0'), 'Cancel did not stop movement');
  const stopped = await player(); await sleep(100);
  assert.deepEqual(await player(), stopped, 'Plane drifted after releasing the finger');
  report.inputs.freeMovement = { beforeTouch, neutral, moved, stopped };
  // Actual rendered sprite and full arena must fit at every reachable corner.
  for (const [width, height] of [[320, 568], [360, 774], [412, 915]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true }); await sleep(180);
    await evaluate(`if(s.scene.isActive())s.scene.pause();s.begin(0);s.world.state='play';s.world.introTime=0;s.world.waveIndex=999;s.world.supplyIndex=999;s.world.player.invulnerable=1000;s.backdrop.draw(s.world.elapsed,s.world,s.quality);s.renderWorld(0);true`);
    await settle();
    const fit = await evaluate(`(()=>{const c=s.cameras.main,r=s.game.canvas.getBoundingClientRect(),a=c.getWorldPoint(0,0),b=c.getWorldPoint(c.width,c.height),w=s.world;return{arena:{...w.arena},view:{left:a.x,right:b.x,top:a.y,bottom:b.y},playerPixels:s.player.displayWidth*c.zoom*r.width/s.game.canvas.width,zoomX:c.zoomX,zoomY:c.zoomY,density:s.game.canvas.width/r.width}})()`);
    const epsilon = .001; // Floating-point camera inversion at the exact viewport edge.
    assert(fit.view.left <= fit.arena.left + epsilon && fit.view.right >= fit.arena.right - epsilon && fit.view.top <= fit.arena.top + epsilon && fit.view.bottom >= fit.arena.bottom - epsilon, 'Arena cropped ' + JSON.stringify({ width, fit }));
    assert(fit.playerPixels >= width * 37 * 1.15 / 336 * .97, 'Gameplay scale too small ' + width);
    assert.equal(fit.zoomX, fit.zoomY); assert(fit.density >= 1.99);
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      await evaluate(`(()=>{for(let i=0;i<300;i++)s.world.step(1/60,{x:${x},y:${y},fire:false,special:false});s.lastInput={x:0,y:0,fire:false,special:false};s.renderWorld(0);})()`);
      await settle();
      const edge = await evaluate(`(()=>{const c=s.cameras.main,a=c.getWorldPoint(0,0),b=c.getWorldPoint(c.width,c.height),p=s.player.getBounds();return{fits:p.left>=a.x&&p.right<=b.x&&p.top>=a.y&&p.bottom<=b.y,player:{left:p.left,right:p.right,top:p.top,bottom:p.bottom}}})()`);
      assert(edge.fits, 'Player art clipped at ' + JSON.stringify({ width, x, y, edge }));
    }
    await shot(width + '-player-edge');
    await evaluate(`s.world.devJumpTideArch('low-flight',true);s.backdrop.draw(s.world.elapsed,s.world,s.quality);s.renderWorld(0);true`); await shot(width + '-portrait-arch');
    await evaluate(`s.world.devJumpTideArch('complete',true);s.world.startBoss(false);for(let i=0;i<200;i++)s.world.updateBoss(1/60);s.backdrop.draw(s.world.elapsed,s.world,s.quality);s.renderWorld(0);true`);
    assert(await evaluate(`!!s.world.boss?.sub&&s.world.boss.x-152>=0&&s.world.boss.x+152<=336`), 'Submarine does not fit portrait');
    await shot(width + '-portrait-boss');
    report.states.push({ name: width + '-gameplay-fit', ...fit });
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 774, deviceScaleFactor: 2, mobile: true }); await sleep(150);
  await evaluate(`s.show('pause');s.scene.pause();true`); await inspect('360-pause-after-charge');
  await evaluate(`s.begin(1);s.world.state='play';s.world.introTime=0;s.backdrop.draw(s.clock,s.world,s.quality,true);s.renderWorld(0);s.scene.pause();true`); await shot('360-side-proportions');
  console.log(JSON.stringify(await evaluate(`({pause:s.pauseBtn?{x:s.pauseBtn.x,y:s.pauseBtn.y,visible:s.pauseBtn.visible,parent:s.pauseBtn.parentContainer?.visible}:null,ui:{x:s.ui.x,y:s.ui.y,visible:s.ui.visible},layout:s.touchController.getLayout().pause,camera:{scrollY:s.cameras.main.scrollY,zoomY:s.cameras.main.zoomY}})`)));
  assert(await evaluate('s.cameras.main.zoomX===s.cameras.main.zoomY'), 'SIDE distorted');
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors)); report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack; console.error(error); process.exitCode = 1; }
finally { writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2)); socket?.close(); chrome.kill(); await server.close(); console.log(JSON.stringify({ status: report.status, captures: report.captures.length, states: report.states.length, errors: report.errors.length, failure: report.failure, inputs: report.inputs })); }
