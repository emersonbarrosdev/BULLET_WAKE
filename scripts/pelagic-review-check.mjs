import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {steer} from './arcade-route.mjs';
const root=resolve('dist'),out=resolve('docs/screenshots/pelagic-review');mkdirSync(out,{recursive:true});
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
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{const value=await eval(${JSON.stringify(expression)});return value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype?undefined:value;})()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 const wait=async expr=>{for(let i=0;i<150;i++){if(await evaluate(expr))return;await sleep(100);}throw Error('Timeout '+expr+' '+JSON.stringify(errors));};
 const shot=async name=>{await sleep(150);const png=name.startsWith('clip-');const r=await send('Page.captureScreenshot',png?{format:'png'}:{format:'webp',quality:90});writeFileSync(join(out,name+(png?'.png':'.webp')),Buffer.from(r.data,'base64'));};
 const key=async(code,key=code)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode:code==='Enter'?13:code==='Escape'?27:32});await sleep(90);await send('Input.dispatchKeyEvent',{type:'keyUp',code,key});};
 await send('Runtime.enable');await send('Page.enable');await send('Log.enable');await send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
 await send('Emulation.setTouchEmulationEnabled',{enabled:false,maxTouchPoints:1});
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 await wait(`window.__GAME__?.scene.isActive('ArcadeScene')&&!!window.__GAME__.scene.getScene('ArcadeScene').ui`);
 await evaluate(`window.s=window.__GAME__.scene.getScene('ArcadeScene');s.audio.setMix(0,0,true);window.steer=${steer.toString()};window.render=()=>{s.backdrop.draw(s.clock,s.world,s.quality);s.renderWorld(1/60);};window.advance=async(seconds,fire=true)=>{for(let i=0;i<Math.round(seconds*120)&&!['defeat','victory'].includes(s.world.state);i++){s.world.step(1/120,{...steer(s.world),fire});s.clock+=1/120;s.consumeEvents();if(i%2===0)render();if(i%240===0)await new Promise(r=>setTimeout(r,0));}render();};`);
 const dual=async name=>{for(const [width,height] of [[1366,768],[1920,1080]]){await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate('window.__GAME__.scale.refresh();render();');await shot(name+'-'+width);}};
 // Actual renderer fixtures, explicitly separated from the complete simulated route below.
 const fixture=async(scroll,route,naval=false,level=3)=>{await evaluate(`s.begin(0);s.scene.pause();s.world.state='play';s.world.waveIndex=999;s.world.supplyIndex=999;s.world.scroll=${scroll};s.world.route=${route};s.world.elapsed=${route};s.world.player.invulnerable=20;s.world.weapons.weaponLevel=${level};s.world.spawnEncounter({family:'fighter',formation:'v',motion:'straight',lane:.5});${naval?"s.world.spawnEncounter({family:'boat',formation:'pair',motion:'stationary',lane:.4});":''}advance(3.5,false).then(()=>advance(.45));`);};
 await fixture(0,8,false,1);await dual('01-start');
 await fixture(4200-2250+80,85,true);await dual('02-middle');
 await fixture(4200-1000+90,80,true);await dual('03-harbor-lighthouse');
 if(!process.argv.includes('--preview')){
  await fixture(650,125,true);await dual('04-open-sea');
  await fixture(4200-3160+80,299,true);await evaluate('s.world.miniStarted=true;advance(4);');await dual('05-boss-approach');
  report.fixtureNote='Real Chrome/Phaser captures with controlled scroll and encounters for visual coverage; not claimed as uninterrupted human play.';
  await evaluate('s.begin(0);s.scene.pause();');report.route=[];
  for(const target of[8,80,150,230,305,400]){await evaluate(`advance(${target}-s.world.elapsed)`);report.route.push(await evaluate('({elapsed:s.world.elapsed,scroll:s.world.scroll,state:s.world.state,enemies:s.world.enemies.length})'));if(target===80)await dual('06-uninterrupted-route-80s');}
  report.fullRoute=await evaluate('({state:s.world.state,elapsed:s.world.elapsed,deaths:s.world.deaths})');assert.equal(report.fullRoute.state,'victory');
  await fixture(4200-1000+60,80,true);await evaluate('s.touch.fire=true;s.scene.resume();');
  await evaluate("window.videoChunks=[];window.videoStream=window.__GAME__.canvas.captureStream(30);window.recorder=new MediaRecorder(videoStream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3000000});recorder.ondataavailable=e=>{if(e.data.size)videoChunks.push(e.data)};recorder.start();void 0");
  report.motion=[];
  for(let i=0;i<6;i++){await sleep(300);report.motion.push(await evaluate('({scroll:s.world.scroll,water:s.backdrop.water.tilePositionY,coast:s.backdrop.coast.filter(x=>x.visible).map(x=>({frame:x.frame.name,x:x.x,y:x.y,flipX:x.flipX,flipY:x.flipY,rotation:x.rotation}))})'));await shot('motion-'+i);}
  for(let i=1;i<report.motion.length;i++){assert(report.motion[i].scroll>report.motion[i-1].scroll);assert(report.motion[i].water<report.motion[i-1].water);assert(report.motion[i].coast.every(x=>!x.flipX&&!x.flipY&&x.rotation===0));}
  const video=await evaluate("new Promise(resolve=>{recorder.onstop=()=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(new Blob(videoChunks,{type:'video/webm'}));videoStream.getTracks().forEach(t=>t.stop());};recorder.stop();})");writeFileSync(join(out,'motion.webm'),Buffer.from(video,'base64'));
  await evaluate("s.show('pause')");const frozen=await evaluate('({scroll:s.world.scroll,uv:s.backdrop.water.tilePositionY})');await sleep(250);assert.deepEqual(await evaluate('({scroll:s.world.scroll,uv:s.backdrop.water.tilePositionY})'),frozen);
  report.performance=[];
  for(const [width,height] of[[1366,768],[1920,1080]]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
   await evaluate("s.begin(0);s.world.state='play';s.world.route=300;s.world.scroll=2200;s.world.miniStarted=true;s.world.waveIndex=999;s.world.supplyIndex=999;s.world.weapons.weaponLevel=5;s.world.player.invulnerable=100;s.quality=2;s.touch.fire=true;s.scene.resume();");await sleep(1600);
   report.performance.push(await evaluate(`new Promise(resolve=>{const samples=[];let before=performance.now(),start=before,peak=0;function tick(now){samples.push(now-before);before=now;peak=Math.max(peak,s.world.bullets.filter(b=>b.active).length);if(s.world.enemies.length<5)s.world.spawnEncounter({family:'bomber',formation:'horde',motion:'sine',lane:.5});if(now-start<10000)requestAnimationFrame(tick);else{samples.shift();const total=now-start,count=samples.length;samples.sort((a,b)=>a-b);resolve({width:${width},height:${height},seconds:total/1000,frames:count,fps:count/(total/1000),medianMs:samples[Math.floor(count*.5)],p95Ms:samples[Math.floor(count*.95)],heap:performance.memory?.usedJSHeapSize,peakBullets:peak});}}requestAnimationFrame(tick);})`));
  }
  report.gpu=await evaluate("(()=>{const gl=window.__GAME__.renderer.gl,ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';})()");
  report.radio=await evaluate('({x:s.radio.x,right:s.radio.getBounds().right})');assert(report.radio.x>=560&&report.radio.right<=768);
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{socket?.close();chrome.kill();server.close();}
