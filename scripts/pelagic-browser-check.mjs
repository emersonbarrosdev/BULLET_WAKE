import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {steer} from './arcade-route.mjs';
const root=resolve('dist'),out=resolve('docs/screenshots/pelagic-audit');mkdirSync(out,{recursive:true});
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
 await evaluate(`window.s=window.__GAME__.scene.getScene('ArcadeScene');window.steer=${steer.toString()};s.audio.setMix(0,0,true);s.begin(0);s.scene.pause();window.render=()=>{s.backdrop.draw(s.clock,s.world,s.quality);s.renderWorld(1/60);};window.advance=async(seconds,bot=true)=>{for(let i=0;i<Math.round(seconds*120)&&!['defeat','victory'].includes(s.world.state);i++){s.world.step(1/120,bot?steer(s.world):{x:0,y:0,fire:true,special:false});s.clock+=1/120;s.consumeEvents();if(i%2===0)render();if(i%240===0)await new Promise(r=>setTimeout(r,0));}render();};`);
 await evaluate(`render()`);await shot('01-intro-radio-right');
 report.radioIntro=await evaluate(`({x:s.radio.x,y:s.radio.y,right:s.radio.getBounds().right,text:s.radio.text})`);assert(report.radioIntro.x>=560&&report.radioIntro.right<=768);
 await evaluate(`advance(8)`);await shot('02-start-nv1');
 if(process.argv.includes('--preview')){await evaluate(`advance(74)`);await shot('preview-harbor');writeFileSync(join(out,'preview-report.json'),JSON.stringify(report,null,2));}
 else{
  report.routeFrames=[];
  for(const [target,name] of [[50,'03-side-boats'],[81,'04-harbor'],[158,'05-miniboss'],[222,'06-mid-combat'],[304,'07-final-boss']]){
   await evaluate(`advance(${target}-s.world.elapsed)`);await shot(name);report.routeFrames.push(await evaluate(`({time:s.world.elapsed,level:s.world.weapons.weaponLevel,boats:s.world.enemies.filter(e=>e.navigation).map(e=>({family:e.family,x:e.x,y:e.y,phase:e.navigation.phase})),state:s.world.state,scroll:s.world.scroll})`));
  }
  await evaluate(`advance(80)`);await shot('08-route-conclusion');
  report.fullRoute=await evaluate(`({state:s.world.state,elapsed:s.world.elapsed,lives:s.world.lives,deaths:s.world.deaths,score:s.world.score,level:s.world.weapons.weaponLevel,collected:s.world.collected})`);assert.equal(report.fullRoute.state,'victory');
  // Explicit visual fixture: compare five gun levels at one coordinate, without changing weapon rules.
  report.levels=[];
  for(let level=1;level<=5;level++){
   await evaluate(`s.begin(0);s.scene.pause();s.world.state='play';s.world.waveIndex=s.world.mission.encounters.length;s.world.supplyIndex=11;s.world.weapons.weaponLevel=${level};s.world.player.invulnerable=10;s.world.scroll=1750;s.world.route=80;s.world.miniStarted=true;s.message('BAYEK: Mar aberto. Vamos abrir caminho!');advance(.4,false);`);await shot('weapon-nv'+level);
   report.levels.push(await evaluate(`({level:s.world.weapons.weaponLevel,projectiles:s.world.bullets.filter(b=>b.active&&!b.enemy).length,texture:s.bulletSprites.find(b=>b.visible)?.texture.key,radio:{x:s.radio.x,right:s.radio.getBounds().right}})`));
  }
  // Geometry/render registration and downwards motion over actual RAF frames.
  await evaluate(`s.begin(0);s.world.state='play';s.world.scroll=1750;s.world.route=46;s.world.waveIndex=999;s.world.supplyIndex=11;s.world.player.invulnerable=100;s.world.spawnEncounter({family:'boat',formation:'pair',motion:'stationary',lane:.5});s.touch.fire=true;s.scene.resume();`);
  await evaluate(`window.motionChunks=[];window.motionStream=window.__GAME__.canvas.captureStream(30);window.motionRecorder=new MediaRecorder(motionStream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2500000});motionRecorder.ondataavailable=e=>{if(e.data.size)motionChunks.push(e.data)};motionRecorder.start();void 0`);
  report.motion=[];
  for(let i=0;i<8;i++){await sleep(500);await shot('motion-'+i);report.motion.push(await evaluate(`({scroll:s.world.scroll,coast:s.backdrop.coast.filter(x=>x.visible).map(x=>({x:x.x,y:x.y,frame:x.frame.name,flipX:x.flipX,flipY:x.flipY,rotation:x.rotation})),waterUV:s.backdrop.water.tilePositionY,boats:s.world.enemies.filter(e=>e.navigation).map(e=>({id:e.id,x:e.x,y:e.y,heading:e.navigation.heading}))})`));}
  const video=await evaluate(`new Promise(resolve=>{motionRecorder.onstop=async()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob(motionChunks,{type:'video/webm'}));motionStream.getTracks().forEach(t=>t.stop());};motionRecorder.stop();})`);writeFileSync(join(out,'motion.webm'),Buffer.from(video,'base64'));
  for(let i=1;i<report.motion.length;i++){assert(report.motion[i].scroll>report.motion[i-1].scroll);assert(report.motion[i].waterUV<report.motion[i-1].waterUV);assert(report.motion[i].coast.every(x=>!x.flipX&&!x.flipY&&x.rotation===0));}
  await evaluate(`s.show('pause')`);await sleep(100);const frozen=await evaluate('({scroll:s.world.scroll,uv:s.backdrop.water.tilePositionY})');await sleep(200);assert.deepEqual(await evaluate('({scroll:s.world.scroll,uv:s.backdrop.water.tilePositionY})'),frozen);await shot('09-pause');
  // Opaque cockpit: inspect source alpha; place adversarial effects beyond both arena boundaries.
  await evaluate(`s.show('play');s.scene.pause();s.world.enemies=[];s.world.bullets.forEach(b=>b.active=false);s.renderWorld(0);s.backdrop.draw(s.clock,s.world,s.quality);`);await shot('clip-before');
  await evaluate(`for(const x of[180,207,561,590]){s.explosion(x,210,140,10);s.world.bullet(x,130,0,0,1,25,true);s.world.cargo.push({id:900+x,x,y:300,vx:0,vy:0,kind:'power',crate:true,hp:3,age:0});}s.renderWorld(0);`);await shot('clip-after');
  report.opacity=await evaluate(`['arc-stage1-hud-left','arc-stage1-hud-right'].map(key=>{const source=s.textures.get(key).getSourceImage();const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const ctx=c.getContext('2d');ctx.drawImage(source,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let min=255;for(let i=3;i<pixels.length;i+=4)min=Math.min(min,pixels[i]);return{key,minAlpha:min};})`);assert(report.opacity.every(p=>p.minAlpha===255));
  report.waterEdges=await evaluate(`(()=>{const im=s.textures.get('pelagic-water').getSourceImage(),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data,diff=(a,b)=>[0,1,2].reduce((n,k)=>n+Math.abs(p[a+k]-p[b+k]),0)/3;const rows=[];for(let y=1;y<c.height;y++){let sum=0;for(let x=0;x<c.width;x++)sum+=diff((y*c.width+x)*4,((y-1)*c.width+x)*4);rows.push(sum/c.width);}let vertical=0,horizontal=0;for(let x=0;x<c.width;x++)vertical+=diff(x*4,((c.height-1)*c.width+x)*4)/c.width;for(let y=0;y<c.height;y++)horizontal+=diff(y*c.width*4,(y*c.width+c.width-1)*4)/c.height;rows.sort((a,b)=>a-b);return{vertical,horizontal,internalMedian:rows[Math.floor(rows.length*.5)],internalP95:rows[Math.floor(rows.length*.95)]};})()`);assert(report.waterEdges.vertical<report.waterEdges.internalP95&&report.waterEdges.horizontal<report.waterEdges.internalP95);
  report.performance=[];
  for(const quality of[0,2]){
   await evaluate(`s.begin(0);s.world.state='play';s.world.route=300;s.world.scroll=12500;s.world.waveIndex=999;s.world.supplyIndex=11;s.world.miniStarted=true;s.world.player.invulnerable=100;s.world.weapons.weaponLevel=5;s.quality=${quality};s.touch.fire=true;s.scene.resume();`);await sleep(2800);
   report.performance.push(await evaluate(`new Promise(resolve=>{const samples=[],heaps=[];let previous=performance.now(),start=previous,peak=0;function sample(now){samples.push(now-previous);previous=now;const w=s.world;peak=Math.max(peak,w.bullets.filter(b=>b.active).length);if(Math.floor((now-start)/1000)%2===0&&w.enemies.length<8)w.spawnEncounter({family:'bomber',formation:'horde',motion:'sine',lane:.5});if(now-start>3000&&now-start<5000)w.specialTime=.5;if(samples.length%60===0)heaps.push(performance.memory?.usedJSHeapSize);if(now-start<10000)requestAnimationFrame(sample);else{samples.shift();samples.sort((a,b)=>a-b);resolve({quality:${quality},frames:samples.length,seconds:(now-start)/1000,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],heaps,objects:s.children.length,peakBullets:peak});}}requestAnimationFrame(sample);})`));
  }
  report.renderer=await evaluate(`(()=>{const gl=window.__GAME__.renderer.gl;const ext=gl?.getExtension('WEBGL_debug_renderer_info');return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,viewport:[innerWidth,innerHeight],resolution:window.__GAME__.renderer.resolution};})()`);
  await send('Emulation.setDeviceMetricsOverride',{width:854,height:480,deviceScaleFactor:1,mobile:false});await shot('10-compact');
  assert.deepEqual(errors,[]);writeFileSync(join(out,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }
}finally{socket?.close();chrome.kill();server.close();}
