import assert from 'node:assert/strict';

export async function runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors}) {
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const run=code=>evaluate(`(()=>{const s=window.__GAME__.scene.getScene('PrototypeScene');${code}})()`);
  const fit=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.right<=innerWidth&&e.scrollHeight<=e.clientHeight&&document.documentElement.scrollHeight<=innerHeight;})()`);
  for(const [width,height] of [[1366,768],[1920,1080]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await click('[data-pilot-index="0"]');await click('[data-action="start"]:not([hidden])');
    await waitFor("!!document.querySelector('.bw-loading')");
    assert.equal(await evaluate("document.querySelectorAll('.bw-loading').length"),1);
    assert.ok(await fit('.bw-loading-panel'));
    await shot(`loading-resources-${width}x${height}`);
    await waitFor("!!document.querySelector('.bw-briefing')&&!document.querySelector('.bw-loading')");
    assert.ok(await fit('.bw-brief-panel'));
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.bw-brief-controls kbd')).backgroundColor"),'rgb(36, 36, 36)');
    await shot(`briefing-carbon-${width}x${height}`);
    const before=await run('return s.director.scrollPx;');
    // Timestamp the actual action and first resumed update inside the browser.
    await evaluate(`window.qaLaunchAt=0;window.qaResumeAt=0;document.querySelector('[data-brief-action="0"]').addEventListener('click',()=>{window.qaLaunchAt=performance.now();window.__GAME__.scene.getScene('PrototypeScene').events.once('update',()=>window.qaResumeAt=performance.now());},{once:true});`);
    await click('[data-brief-action="0"]');
    await waitFor("document.querySelector('.bw-loading h1')?.textContent==='PREPARANDO DECOLAGEM'");
    await shot(`loading-launch-${width}x${height}`);
    await key('Enter','Enter',13);await key('Escape','Escape',27);
    await evaluate(`document.querySelector('[data-brief-action="0"]').click()`);
    await pause(650);
    assert.equal(await run('return s.director.scrollPx;'),before);
    assert.equal(await run("return s.scene.isPaused();"),true);
    assert.equal(await evaluate("document.querySelectorAll('.bw-loading').length"),1);
    await waitFor("window.qaResumeAt>0");
    const elapsed=await evaluate('window.qaResumeAt-window.qaLaunchAt');
    assert.ok(elapsed>=2450&&elapsed<=3000,`Transition must take 2–3 seconds, got ${elapsed}`);
    assert.equal(await evaluate("document.querySelectorAll('.bw-loading,.bw-briefing').length"),0);
    await pause(150);assert.ok(await run('return s.director.scrollPx;')>before);
    assert.ok(await fit('#bw-combat-hud'));
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.bw-combat-mission strong')).color"),'rgb(238, 238, 238)');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-field=weapon]')).color"),'rgb(121, 222, 255)');
    await shot(`gameplay-carbon-${width}x${height}`);
    await key('Escape','Escape',27);await waitFor("!!document.querySelector('.bw-briefing')");
    await shot(`pause-carbon-${width}x${height}`);
    await key('Escape','Escape',27);
    assert.equal(await run("return s.scene.isActive();"),true,'Pause resumes immediately');
    assert.equal(await evaluate("!!document.querySelector('.bw-loading')"),false);
    await run("s.scene.start('PilotSelectScene');");await waitFor("!!document.querySelector('.bw-pilot-card')");
    report.viewports.push({width,height,launchDurationMs:elapsed,neutralCarbon:true,semanticWeaponColor:true,simulationFrozen:true,noOverflow:true});
  }
  // Teardown during launch must cancel delayed resume and remove input blockers.
  await click('[data-pilot-index="0"]');await click('[data-action="start"]:not([hidden])');
  await waitFor("!!document.querySelector('.bw-briefing')&&!document.querySelector('.bw-loading')");
  await evaluate(`window.qaPad={id:'Xbox Standard Test',connected:true,mapping:'standard',axes:[0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};window.originalGetPads=navigator.getGamepads.bind(navigator);Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.qaPad]});`);
  await waitFor("document.querySelector('.bw-brief-device')?.textContent.includes('CONTROLE CONECTADO')");
  await evaluate('window.qaPad.buttons[0].pressed=true');
  await waitFor("document.querySelector('.bw-loading h1')?.textContent==='PREPARANDO DECOLAGEM'");
  await pause(350);assert.equal(await run('return s.director.scrollPx;'),0);
  await evaluate('Object.defineProperty(navigator,"getGamepads",{configurable:true,value:window.originalGetPads})');
  await run("s.scene.start('PilotSelectScene');");
  await waitFor("!!document.querySelector('.bw-pilot-card')");await pause(2700);
  assert.equal(await evaluate("document.querySelectorAll('.bw-loading,.bw-briefing,#bw-combat-hud').length"),0);
  assert.equal(await run("return s.scene.isActive();"),false);
  await key('Enter','Enter',13);
  assert.equal(await evaluate("document.querySelectorAll('[data-confirm-index]:not([hidden])').length"),1);
  report.regression.loadingTeardown=true;
  report.regression.standardGamepadLaunch=true;
  assert.deepEqual(errors,[]);
  // Inject the loader's failure signal: stay out of combat and offer recovery.
  await click('[data-action="start"]:not([hidden])');
  await waitFor("!!document.querySelector('.bw-loading')");
  await run("s.load.emit('loaderror', {key:'qa-resource'});");
  await pause(800);
  assert.equal(await run('return s.scene.isPaused();'),true);
  assert.equal(await evaluate("document.querySelectorAll('.bw-briefing').length"),0);
  await click('.bw-loading button');await waitFor("!!document.querySelector('.bw-pilot-card')");
  assert.equal(await evaluate("document.querySelectorAll('.bw-loading,#bw-combat-hud').length"),0);
  report.regression.loadingFailureRecovery=true;
  assert.deepEqual(errors,[[{type:'string',value:'[BULLET WAKE] Falha ao carregar sprite:'},{type:'string',value:'qa-resource'}]]);
  report.regression.expectedResourceFailure=errors.splice(0);
  assert.deepEqual(errors,[]);
  console.log('PASS: real asset loading, 2.5s launch, blocked duplicate input, neutral carbon, frozen simulation, cached re-entry and teardown; both viewports.');
}
