import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {steer} from './arcade-route.mjs';
const root=resolve('dist'),out=resolve('docs/screenshots/cartoon');mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.ogg':'audio/ogg'};
const server=createServer((req,res)=>{const file=resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+sep)||!existsSync(file)){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});res.end(readFileSync(file));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=mkdtempSync(join(tmpdir(),'bw-cartoon-'));const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--no-first-run','--autoplay-policy=no-user-gesture-required','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;const errors=[],report={errors};
try{
 let target;for(let i=0;i<60;i++){try{const port=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0].trim();target=(await(await fetch('http://127.0.0.1:'+port+'/json')).json()).find(t=>t.type==='page');}catch{}if(target)break;await sleep(150);}assert(target);
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});let seq=0;const pending=new Map();
 socket.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);else if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')errors.push(msg.params.entry);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expr=>{for(let i=0;i<150;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('Timeout '+expr+' '+JSON.stringify(errors));};
 const shot=async name=>{await sleep(150);const r=await send('Page.captureScreenshot',{format:'webp',quality:90});writeFileSync(join(out,name+'.webp'),Buffer.from(r.data,'base64'));};
 const key=async(code,key=code)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode:code==='Enter'?13:code==='Escape'?27:32});await sleep(90);await send('Input.dispatchKeyEvent',{type:'keyUp',code,key});};
 await send('Runtime.enable');await send('Page.enable');await send('Log.enable');await send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 await wait(`window.__GAME__?.scene.isActive('ArcadeScene')&&!!window.__GAME__.scene.getScene('ArcadeScene').ui`);
 await evaluate(`window.s=window.__GAME__.scene.getScene('ArcadeScene');s.show('title')`);await shot('title');
 await key('Enter');assert.equal(await evaluate('s.screen'),'pilot');
 await evaluate(`window.seek=(time)=>{const w=s.world;w.route=time;w.waveIndex=w.mission.encounters.findIndex(e=>e.at>time);if(w.waveIndex<0)w.waveIndex=w.mission.encounters.length;w.supplyIndex=11;w.miniStarted=time>155;w.bossStarted=false;w.enemies=[];w.cargo=[];w.obstacles=[];w.nextObstacle=time+10;w.boss=undefined;w.bullets.forEach(b=>b.active=false);w.player.invulnerable=100;};`);
 await evaluate(`s.show('pilot')`);await shot('pilots');await evaluate(`s.show('missions')`);await shot('missions');
 await evaluate(`s.begin(0);s.world.introTime=0;`);await sleep(1500);await shot('phase1-start');
 await evaluate(`seek(85);s.world.weapons.weaponLevel=3`);await sleep(1000);await shot('phase1-coast');
 await evaluate(`s.show('pause')`);await shot('pause');report.pause=await evaluate(`(()=>{const a=s.world.elapsed;return new Promise(r=>setTimeout(()=>r({before:a,after:s.world.elapsed,audio:s.audio.status()}),200));})()`);assert.equal(report.pause.before,report.pause.after);
 await evaluate(`s.audio.unlock();s.show('controls')`);await shot('controls');assert.equal(await evaluate('s.audio.status().paused'),true);await evaluate(`s.pauseOrigin='pause';s.show('settings')`);await shot('settings');
 await evaluate(`s.show('play');seek(300)`);await sleep(3500);await shot('phase1-boss');
 await evaluate(`s.world.specialTime=3;s.world.player.x=s.world.boss.parts[0].x;s.world.player.y=350`);await sleep(200);await shot('phase1-special');
 await evaluate(`s.world.boss.parts.forEach(p=>p.hp=0)`);await sleep(11000);await shot('phase1-return');assert.equal(await evaluate('s.world.boss.configuration'),2);
 report.assets=await evaluate(`({textures:s.textures.getTextureKeys().filter(k=>k.startsWith('arc-')),audio:s.audio.status(),objects:s.children.length,screen:s.screen})`);
 if(process.argv.includes('--both')){await evaluate(`s.begin(1);s.world.introTime=0;seek(99)`);await sleep(1600);await shot('phase2-city');await evaluate(`seek(300)`);await sleep(3500);await shot('phase2-boss');}
 // Standard browser gamepad injection exercises the real input adapter, not a physical device.
 await evaluate(`s.begin(0);s.world.introTime=0;window.pad={id:'Virtual Standard',connected:true,mapping:'standard',axes:[1,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.pad]});window.xBefore=s.world.player.x;pad.buttons[0]={pressed:true,value:1};`);await sleep(500);
 report.gamepad=await evaluate(`({moved:s.world.player.x>xBefore,fired:s.world.bullets.some(b=>b.active&&!b.enemy)})`);assert(report.gamepad.moved&&report.gamepad.fired);
 await evaluate(`pad.buttons[9]={pressed:true,value:1}`);await sleep(100);assert.equal(await evaluate('s.screen'),'pause');await evaluate(`Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[]});s.show('play');`);
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 const point=await evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+690/768*r.width,y:r.y+353/432*r.height};})()`);
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1,radiusX:5,radiusY:5,force:1}]});await sleep(200);assert.equal(await evaluate('s.touch.fire'),true);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(100);assert.equal(await evaluate('s.touch.fire'),false);report.touch={firePressAndRelease:true};
 const touchAt=async(x,y)=>evaluate(`(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return{x:r.x+${x}/768*r.width,y:r.y+${y}/432*r.height,id:1,radiusX:5,radiusY:5,force:1};})()`);
 const beforeMove=await evaluate('s.world.player.y');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await touchAt(80,347)]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[await touchAt(80,307)]});await sleep(180);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await evaluate('s.world.player.y')<beforeMove);report.touch.joystick=true;
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await touchAt(612,365)]});await sleep(100);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await evaluate('s.world.weapons.specialCharges'),1);report.touch.special=true;
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await touchAt(739,19)]});await sleep(100);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await evaluate('s.screen'),'pause');report.touch.pause=true;await evaluate(`s.show('play')`);
 await send('Emulation.setDeviceMetricsOverride',{width:854,height:480,deviceScaleFactor:1,mobile:false});await shot('compact-touch');await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
 if(process.argv.includes('--routes')){
  await evaluate(`window.steer=${steer.toString()}`);report.routes=[];
  for(const index of [0,1]){
   const run=await evaluate(`(async()=>{s.begin(${index},${index}===1?s.carried:undefined);s.audio.setMix(0,0,true);s.scene.pause();let ticks=0,peak=0;const initial={level:s.world.weapons.weaponLevel,power:s.world.weapons.powerMeter,lives:s.world.lives,specials:s.world.weapons.specialCharges,score:s.world.score};while(ticks<120*600&&!['victory','defeat'].includes(s.world.state)){for(let i=0;i<240&&!['victory','defeat'].includes(s.world.state);i++){s.world.step(1/120,steer(s.world));s.consumeEvents();if(ticks%2===0)s.renderWorld(1/60);ticks++;peak=Math.max(peak,s.world.bullets.filter(b=>b.active).length);}await new Promise(r=>setTimeout(r,0));}const w=s.world,result={mission:${index}+1,state:w.state,seconds:w.elapsed,initial,lives:w.lives,deaths:w.deaths,level:w.weapons.weaponLevel,power:w.weapons.powerMeter,specials:w.weapons.specialCharges,score:w.score,items:w.collected,peakBullets:peak};if(w.state==='victory'){s.saveClear();s.show('result');}s.scene.resume();return result;})()`);
   report.routes.push(run);await shot('result-phase'+(index+1));assert.equal(run.state,'victory',JSON.stringify(run));assert(run.seconds>=300);console.log('Route complete',JSON.stringify(run));
   assert.equal(await evaluate('s.world.bullets.some(b=>b.active)'),false);assert(await evaluate('s.world.up?s.world.player.y<s.world.arena.top-20:s.world.player.x>s.world.arena.right+20'));
  }
  const [one,two]=report.routes;for(const field of ['lives','level','power','specials','score'])assert.equal(two.initial[field],one[field]);
  await evaluate(`s.show('ending')`);await shot('ending');
  await evaluate(`s.begin(0);s.world.state='play';s.world.lives=1;s.world.player.invulnerable=0;s.world.hurtPlayer()`);await sleep(100);assert.equal(await evaluate('s.screen'),'defeat');await shot('game-over');
  await key('Enter');assert.equal(await evaluate('s.screen'),'play');await key('Escape');assert.equal(await evaluate('s.screen'),'pause');await evaluate(`s.show('confirm-exit')`);await shot('confirm-exit');await evaluate(`s.buttons[0].action()`);assert.equal(await evaluate('s.screen'),'pause');await evaluate(`s.show('confirm-exit');s.buttons[1].action()`);assert.equal(await evaluate('s.screen'),'title');assert.equal(await evaluate('!!s.world'),false);report.endFlow={defeatRetry:true,exitCancelled:true,exitConfirmed:true,automaticFlyout:true};
 }
 report.renderer=await evaluate(`(()=>{const gl=window.__GAME__.renderer.gl;const ext=gl?.getExtension('WEBGL_debug_renderer_info');return {type:window.__GAME__.renderer.type,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};})()`);
 if(process.argv.includes('--performance')){
  report.performance=[];
  for(const index of [0,1])for(const quality of [0,2]){
   await evaluate(`s.begin(${index});s.world.introTime=0;seek(300);s.quality=${quality};s.world.weapons.weaponLevel=5;s.touch.fire=true;s.world.player.invulnerable=100;`);await sleep(2800);
   report.performance.push(await evaluate(`new Promise(resolve=>{const samples=[];let previous=performance.now(),start=previous,peak=0;function sample(now){samples.push(now-previous);previous=now;const w=s.world;peak=Math.max(peak,w.bullets.filter(b=>b.active).length);if(Math.floor((now-start)/1000)%2===0&&w.enemies.length<8)w.spawnEncounter({family:'bomber',formation:'horde',motion:'sine',lane:.5});if(now-start>3000&&now-start<5000)w.specialTime=.5;if(now-start<8000)requestAnimationFrame(sample);else{samples.shift();samples.sort((a,b)=>a-b);resolve({mission:${index}+1,quality:${quality},frames:samples.length,seconds:(now-start)/1000,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],heap:performance.memory?.usedJSHeapSize,objects:s.children.length,peakBullets:peak});}}requestAnimationFrame(sample);})`));
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{socket?.close();chrome.kill();server.close();}

