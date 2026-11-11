/** Production-build visual QA: both desktop viewports, all pilots and profiles. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const root = resolve('dist');
const review = ['--title-hornet','--scarlet','--red-rivet','--rivet','--final','--hangar','--arcade','--review','--normal','--stage1','--polish','--fine','--cascade','--loading','--balance'].some(flag=>process.argv.includes(flag));
const confirmation = !review;
const screenshots = resolve(review ? (process.argv.includes('--title-hornet')?'docs/screenshots/title-hornet':process.argv.includes('--scarlet')?'docs/screenshots/phase1-scarlet':process.argv.includes('--red-rivet')?'docs/screenshots/phase1-rivet-red':process.argv.includes('--rivet')?'docs/screenshots/phase1-rivet5':process.argv.includes('--final')?'docs/screenshots/phase1-final':process.argv.includes('--hangar') ? 'docs/screenshots/phase1-hangar' : process.argv.includes('--arcade') ? 'docs/screenshots/phase1-arcade' : process.argv.includes('--balance') ? 'docs/screenshots/phase1-normal' : process.argv.includes('--loading') ? 'docs/screenshots/phase1-loading' : process.argv.includes('--cascade') ? 'docs/screenshots/phase1-cascade' : process.argv.includes('--fine') ? 'docs/screenshots/phase1-fine' : process.argv.includes('--polish') ? 'docs/screenshots/phase1-polish' : 'docs/screenshots/phase1-review') : 'docs/screenshots/pilot-confirmation');
mkdirSync(screenshots, { recursive: true });
const reportFileName=process.argv.includes('--audio-only')?'audio-validation.json':process.argv.includes('--visual-only')?'visual-validation.json':'validation.json';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png' };
const server = createServer((req, res) => {
  const file = resolve(root, '.' + (req.url === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + sep) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9231', '--no-first-run',
  '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'bw-pilot-qa-')), 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const pause = ms => new Promise(r => setTimeout(r, ms));
let socket;
const errors = [];
const cached=process.argv.includes('--water-only')?JSON.parse(readFileSync(join(screenshots,reportFileName),'utf8')):undefined;
const report = { completed:false,viewports: cached?.viewports??[], regression: cached?.regression??{}, errors };
try {
  let target;
  for (let i = 0; i < 50; i++) {
    try { target = (await (await fetch('http://127.0.0.1:9231/json')).json()).find(t => t.type === 'page'); } catch {}
    if (target) break;
    await pause(200);
  }
  assert(target, 'Chrome debugging endpoint unavailable');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, reject) => { socket.onopen = r; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.id) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) cb.reject(new Error(msg.error.message)); else cb.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
    else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args);
    else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error' && !msg.params.entry.url?.endsWith('favicon.ico')) errors.push(msg.params.entry);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 150; i++) {
      if(!process.argv.includes('--cascade') && !process.argv.includes('--loading') && expression.includes("isActive('PrototypeScene')"))await evaluate(`document.querySelector('.bw-briefing [data-brief-action="0"]')?.click()`);
      if (await evaluate(expression)) return; await pause(100); }
    throw new Error('Timed out: ' + expression + '\n' + JSON.stringify({errors, state:await evaluate(`({scenes:window.__GAME__?.scene.scenes.map(s=>({key:s.sys.settings.key,status:s.sys.settings.status})),text:document.body.innerText.slice(-500)})`)}));
  };
  const key = async (key, code = key, virtualKey = key.charCodeAt(0)) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey });
    await pause(60);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey });
    await pause(80);
  };
  const click = async selector => {
    if(selector.includes('start'))await pause(280);
    const pos = await evaluate(`(() => { const r = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>!e.hidden&&e.getBoundingClientRect().width>0).getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...pos, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...pos, button: 'left', clickCount: 1 });
    await pause(120);
  };
  const shot = async name => {
    await pause(100); // Allow a rendered frame after the CDP mutation before capturing pixels.
    const r = await send('Page.captureScreenshot', review ? { format: 'webp', quality: 92 } : { format: 'png' });
    writeFileSync(join(screenshots, name + (review ? '.webp' : '.png')), Buffer.from(r.data, 'base64'));
  };
  const imagesReady = () => waitFor(`Array.from(document.querySelectorAll('#bw-pilot-select img')).every(i=>i.complete&&i.naturalWidth>0)`);
  const geometry = () => evaluate(`(() => {
    const root=document.querySelector('#bw-pilot-select');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};};
    const content=[...root.querySelectorAll('button,h1,h2,p,.bw-pilot-profile,.bw-pilot-profile-content,.bw-pilot-ship-row,.bw-pilot-stats')];
    return {
      root:{clientHeight:root.clientHeight,scrollHeight:root.scrollHeight,clientWidth:root.clientWidth,scrollWidth:root.scrollWidth},
      page:{height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth},
      cards:[...root.querySelectorAll('.bw-pilot-card')].map(rect),
      profile:root.querySelector('.bw-pilot-profile')?rect(root.querySelector('.bw-pilot-profile')):null,
      footer:rect(root.querySelector('.bw-pilot-footer')),
      clipped:content.filter(e=>{const r=e.getBoundingClientRect();return r.top < -1||r.left < -1||r.bottom>innerHeight+1||r.right>innerWidth+1;}).map(e=>e.className),
      overflowing:content.filter(e=>e.scrollHeight>e.clientHeight+1||e.scrollWidth>e.clientWidth+1).map(e=>e.className)
    };
  })()`);
  const checkGeometry = (g, width, height) => {
    assert(g.root.scrollHeight <= height && g.root.scrollWidth <= width, 'Selection scrolls');
    assert(g.page.height <= height && g.page.width <= width, 'Document scrolls');
    assert.deepEqual(g.clipped, [], 'Clipped content');
    assert.deepEqual(g.overflowing, [], 'Content overflows');
    assert(g.footer.bottom <= height, 'Footer outside viewport');
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Page.navigate', { url });
  await waitFor(`Boolean(window.__GAME__?.isBooted&&document.querySelector('.bw-press-activation'))`);
  report.regression.title = await evaluate(`window.__GAME__.scene.isActive('TitleScene')`);
  await click('.bw-press-activation');
  await click('[data-action="pilots"]');
  if(!process.argv.includes('--title-hornet')&&!process.argv.includes('--scarlet')&&!process.argv.includes('--red-rivet')&&!process.argv.includes('--rivet')&&!process.argv.includes('--hangar')&&!process.argv.includes('--final')){
    await waitFor(`Boolean(document.querySelector('[data-mission-action="launch"]'))`);
    report.regression.missionSelection=true;
    await click('[data-mission-action="launch"]');
  }
  await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
  if (review) {
    const {runPhase1Review}=await import(process.argv.includes('--title-hornet')?'./title-hornet-checks.mjs':process.argv.includes('--scarlet')?'./phase1-scarlet-checks.mjs':process.argv.includes('--red-rivet')?'./phase1-rivet-red-checks.mjs':process.argv.includes('--rivet')?'./phase1-rivet5-checks.mjs':process.argv.includes('--final')?'./phase1-final-checks.mjs':process.argv.includes('--hangar')?'./phase1-hangar-checks.mjs':process.argv.includes('--arcade')?'./phase1-arcade-checks.mjs':process.argv.includes('--balance')?'./phase1-normal-checks.mjs':process.argv.includes('--loading')?'./phase1-loading-checks.mjs':process.argv.includes('--cascade')?'./phase1-cascade-checks.mjs':process.argv.includes('--fine')?'./phase1-fine-checks.mjs':process.argv.includes('--polish')?'./phase1-polish-checks.mjs':'./phase1-review-checks.mjs');
    await runPhase1Review({send,evaluate,waitFor,key,click,shot,report,errors});
    report.completed=true;
    writeFileSync(join(screenshots,reportFileName),JSON.stringify(report,null,2)+'\n');
    if(!process.argv.includes('--polish')&&!process.argv.includes('--fine'))console.log(process.argv.includes('--title-hornet')?'PASS: title artwork contained in four viewports; decoded assets and mouse/keyboard navigation; zero browser errors.':process.argv.includes('--audio-only')?'PASS: three final OGG tracks decoded with headroom; one music voice per track; zero browser errors.':'PASS: phase-one review checks; both desktop viewports; zero browser errors.');
  } else if (confirmation) {
    const baseline = JSON.parse(readFileSync(resolve('docs/screenshots/pilot-selection-final/validation.json'),'utf8'));
    const ready = () => evaluate("document.querySelectorAll('[data-confirm-index]:not([hidden])').length === 1");
    const chosen = () => evaluate(`window.__GAME__.scene.getScene('PilotSelectScene').chosenIndex`);
    const checkCards = (actual,approved) => actual.forEach((card,i)=>{
      assert.equal(card.width,approved[i].width);assert.equal(card.height,approved[i].height);
      assert(Math.abs(card.x-approved[i].x)<1&&Math.abs(card.y-approved[i].y)<1,'Card spacing changed');
    });
    const touch = async selector => {
      const p=await evaluate(`(()=>{const r=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>!e.hidden&&e.getBoundingClientRect().width>0).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...p,id:1}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(120);
    };
    for(const [width,height]of [[1366,768],[1920,1080]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await imagesReady();await pause(120);
      assert.equal(await ready(),false);assert.equal(await chosen(),null);
      assert.equal(await evaluate(`document.querySelectorAll('.bw-pilot-card [data-action="profile"]').length`),3);
      assert.equal(await evaluate(`document.querySelectorAll('button button').length`),0);
      const initial = await geometry();checkGeometry(initial,width,height);
      const approved=baseline.viewports.find(v=>v.width===width).cards.cards;
      checkCards(initial.cards,approved);
      await shot(`initial-${width}x${height}`);
      const pos=await evaluate(`(()=>{const r=document.querySelector('[data-pilot-index="1"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await send('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});await pause(80);
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      await key('ArrowRight','ArrowRight',39);await key('Enter','Enter',13);
      assert.equal(await chosen(),1);assert.equal(await ready(),true);
      assert.equal(await evaluate(`window.__GAME__.scene.isActive('PilotSelectScene')`),true);
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,autoRepeat:true});
      await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      assert.equal(await evaluate(`window.__GAME__.scene.isActive('PilotSelectScene')`),true);
      await key('ArrowRight','ArrowRight',39);
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      for(let i=0;i<3;i++){
        await click(`[data-profile-index="${i}"]`);await imagesReady();
        assert.equal(await evaluate(`document.querySelector('.bw-pilot-profile-name h2').textContent`),['Nolan Fitch','Cora Wren','Harlan Greer'][i]);
        assert.equal(await chosen(),null);assert.equal(await ready(),false);
        const g=await geometry();checkGeometry(g,width,height);
        await shot(`profile-${i}-${width}x${height}`);
        await key('Escape','Escape',27);
      }
      await evaluate(`document.querySelector('[data-profile-index="0"]').focus()`);
      await key('Enter','Enter',13);
      assert.equal(await evaluate(`document.querySelector('.bw-pilot-profile-name h2').textContent`),'Nolan Fitch');
      assert.equal(await chosen(),null);await key('i','KeyI',73);
      await click('[data-pilot-index="0"]');await click('[data-pilot-index="0"]');
      assert.equal(await chosen(),0);assert.equal(await ready(),true);
      assert.equal(await evaluate(`window.__GAME__.scene.isActive('PilotSelectScene')`),true);
      await click('[data-profile-index="1"]');
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      await click('[data-action="choose"]');
      assert.equal(await chosen(),1);assert.equal(await ready(),true);
      await key('Escape','Escape',27);
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      await send('Emulation.setTouchEmulationEnabled',{enabled:true});
      await touch('[data-profile-index="1"]');
      assert.equal(await evaluate(`document.querySelector('.bw-pilot-profile-name h2').textContent`),'Cora Wren');
      assert.equal(await chosen(),null);assert.equal(await ready(),false);
      await touch('[data-action="cards"]');
      await touch('[data-pilot-index="2"]');
      assert.equal(await chosen(),2);assert.equal(await ready(),true);
      const selected=await geometry();checkGeometry(selected,width,height);checkCards(selected.cards,approved);
      await shot(`chosen-${width}x${height}`);
      await touch('[data-action="start"]');
      await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')`);
      assert.equal(await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id`),'harlan');
      await send('Emulation.setTouchEmulationEnabled',{enabled:false});
      await evaluate(`{window.__GAME__.scene.getScene('PrototypeScene').scene.start('PilotSelectScene');void 0;}`);
      await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
      report.viewports.push({width,height,initial,selected,cardGeometryPreserved:true,mouseKeyboardTouch:true,profilesDoNotChoose:true});
    }
    await key('2');await key('Enter','Enter',13);
    assert.equal(await chosen(),1);assert.equal(await evaluate(`window.__GAME__.scene.isActive('PilotSelectScene')`),true);
    await key('Enter','Enter',13);await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')`);
    assert.equal(await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id`),'cora');
    await evaluate(`{window.__GAME__.scene.getScene('PrototypeScene').scene.start('PilotSelectScene');void 0;}`);
    await waitFor(`Boolean(document.querySelector('.bw-pilot-card'))`);
    await click('[data-pilot-index="0"]');await click('[data-action="start"]');
    await waitFor(`window.__GAME__.scene.isActive('PrototypeScene')`);
    assert.equal(await evaluate(`window.__GAME__.scene.getScene('PrototypeScene').pilot.id`),'nolan');
    assert.deepEqual(errors,[]);
    writeFileSync(join(screenshots,reportFileName),JSON.stringify(report,null,2)+'\n');
    console.log('PASS: profile buttons inside all cards; explicit choice then confirmation by mouse, keyboard and touch; hover/repeat/profile never launch; changing/cancelling clears choice; both resolutions without scroll or card growth; correct pilots launched; zero browser errors.');
  }

} finally {
  if(review)writeFileSync(join(screenshots,reportFileName),JSON.stringify(report,null,2)+'\n');
  socket?.close(); chrome.kill(); server.close();
}
