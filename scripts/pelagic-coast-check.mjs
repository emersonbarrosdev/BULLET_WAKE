/** Real Chrome/Phaser coastline fixtures; inspect the PNGs before approving the art.
 * Run after a production build: node scripts/pelagic-coast-check.mjs [--quick]
 * This checks renderer continuity, not visual equivalence to the user's reference.
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {COAST_MAP_PERIOD,COAST_MAP_KEY,COAST_MAP_SCALE,COAST_MAP_OFFSET,wrapCoast} from '../src/game/arcade/PelagicCoastMap.ts';

const root=resolve('dist');
const out=resolve('docs/screenshots/pelagic-coast-v2');
const quick=process.argv.includes('--quick');
mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg'};
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+sep)||!existsSync(file)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});
 res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profile=mkdtempSync(join(tmpdir(),'bw-coast-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--remote-debugging-port=0','--no-first-run',
 '--autoplay-policy=no-user-gesture-required','--user-data-dir='+profile,'about:blank',
],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const errors=[],report={note:'Controlled real Chrome/Phaser fixtures, not uninterrupted play or reference-image approval.',errors,fixtures:[]};
let socket;
try{
 let target;
 for(let i=0;i<80&&!target;i++){
  try{
   const port=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0].trim();
   target=(await(await fetch('http://127.0.0.1:'+port+'/json')).json()).find(t=>t.type==='page');
  }catch{/* Chrome is still starting. */}
  if(!target)await sleep(150);
 }
 assert(target,'Chrome did not expose a page target');
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let seq=0;
 const pending=new Map();
 socket.onmessage=event=>{
  const msg=JSON.parse(event.data);
  if(msg.id){
   const handler=pending.get(msg.id);if(!handler)return;
   pending.delete(msg.id);clearTimeout(handler.timeout);
   msg.error?handler.reject(new Error(JSON.stringify(msg.error))):handler.resolve(msg.result);
  }else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);
  else if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')errors.push(msg.params.entry);
 };
 const send=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++seq;
  const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},60000);
  pending.set(id,{resolve,reject,timeout});socket.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expression=>{
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
 };
 const waitFor=async expression=>{
  for(let i=0;i<200;i++){if(await evaluate(expression))return;await sleep(100);}
  throw new Error('Timeout: '+expression+' '+JSON.stringify(errors));
 };
 const settle=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
 const screenshot=async(name,clip)=>{
  await settle();
  const result=await send('Page.captureScreenshot',{format:'png',...(clip?{clip}:{}),captureBeyondViewport:false});
  writeFileSync(join(out,name+'.png'),Buffer.from(result.data,'base64'));
  return result.data;
 };
 const resize=async(width,height)=>{
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await evaluate('window.__GAME__?.scale.refresh();true');await settle();
 };
 await send('Runtime.enable');await send('Page.enable');await send('Log.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 await waitFor("window.__GAME__?.scene.isActive('ArcadeScene')&&!!window.__GAME__.scene.getScene('ArcadeScene').ui");
 await evaluate(`
  window.s=window.__GAME__.scene.getScene('ArcadeScene');
  s.audio.setMix(0,0,true);s.begin(0);s.scene.pause();s.quality=2;
  window.coastRender=()=>{s.backdrop.draw(s.clock,s.world,s.quality);s.renderWorld(0);};
  window.coastFixture=(scroll,actors=false)=>{
   s.begin(0);s.scene.pause();s.world.state='play';s.world.waveIndex=999;s.world.supplyIndex=999;
   s.world.route=30;s.world.elapsed=24;s.world.scroll=scroll;s.world.player.invulnerable=0;
   s.world.enemies=[];s.world.cargo=[];s.world.events=[];s.world.bullets.forEach(b=>b.active=false);
   if(actors){
    s.world.spawnEncounter({family:'tank',formation:'pair',motion:'stationary',lane:.25});
    s.world.spawnEncounter({family:'tower',formation:'solo',motion:'stationary',lane:.8});
    s.world.spawnEncounter({family:'boat',formation:'pair',motion:'stationary',lane:.5});
   }
   coastRender();
   if(!actors){s.player.setVisible(false);s.backdrop.shadows?.forEach(x=>x.setVisible(false));}
  };true;
 `);
 const runtimePeriod=await evaluate(`(()=>{
  const key=${JSON.stringify(COAST_MAP_KEY)};
  if(!s.textures.exists(key))return null;
  const image=s.textures.get(key).getSourceImage();
  return{key,height:image.height,width:image.width};
 })()`);
 const period=COAST_MAP_PERIOD;
 assert(runtimePeriod,'The replacement painted coastline is not installed');
 assert.equal(runtimePeriod.height*COAST_MAP_SCALE,period,'Rendered coast period must match geometry');
 report.period=period;report.coastTexture=runtimePeriod;
 const samples=quick?[0,Math.round(period*.35),COAST_MAP_OFFSET+216,wrapCoast(COAST_MAP_OFFSET-period/2+216)]:[
  0,Math.round(period*.16),Math.round(period*.32),Math.round(period*.48),
  Math.round(period*.64),Math.round(period*.8),COAST_MAP_OFFSET+216,
  wrapCoast(COAST_MAP_OFFSET-period/2+216),period-1,period,period+1,
 ];
 for(const [i,scroll] of samples.entries()){
  await evaluate(`coastFixture(${scroll});true`);
  const name=String(i+1).padStart(2,'0')+'-coast-'+scroll;
  await screenshot(name);
  report.fixtures.push({name,scroll,width:1366,height:768,actors:false});
 }
 for(const [width,height] of [[1366,768],[1920,1080]]){
  await resize(width,height);
  await evaluate(`coastFixture(${Math.round(period*.35)},true);true`);
  await screenshot('cannons-and-boats-'+width);
  report.fixtures.push({name:'cannons-and-boats-'+width,scroll:Math.round(period*.35),width,height,actors:true});
 }
 // Exercise the real destruction path, keeping the resulting wreck world-anchored.
 await resize(1366,768);
 report.emplacement=await evaluate(`(()=>{
  coastFixture(${Math.round(period*.35)},true);
  const target=s.world.enemies.find(e=>e.family==='tank'||e.family==='tower');
  if(!target)throw new Error('No coastal emplacement in fixture');
  const shift=180-target.y;s.world.scroll+=shift;
  for(const e of s.world.enemies)if(e.ground)e.y+=shift;
  coastRender();return{id:target.id,x:target.x,y:target.y,scroll:s.world.scroll};
 })()`);
 await screenshot('emplacement-intact');
 report.wreck=await evaluate(`(()=>{
  const target=s.world.enemies.find(e=>e.id===${report.emplacement.id});
  s.world.damage(target,target.hp,target.x,target.y);s.world.events=[];
  s.world.updateWrecks(1.5);coastRender();
  return s.world.wrecks.map(w=>({id:w.id,x:w.x,y:w.y,worldY:w.worldY,age:w.age}));
 })()`);
 assert.equal(report.wreck.length,1,'Destroyed emplacement must leave one persistent wreck');
 assert.equal(report.wreck[0].y,report.emplacement.y,'Wreck must remain on its original ground socket');
 await screenshot('emplacement-destroyed-smoke');
 // Separate tower art must replace the painted tower and leave its own rubble.
 await evaluate("coastFixture(0,true);window.tower=s.world.enemies.find(e=>e.family==='tower');const dy=180-tower.y;s.world.scroll+=dy;for(const e of s.world.enemies)if(e.ground)e.y+=dy;coastRender();true");
 await screenshot('tower-intact');
 await evaluate("s.world.damage(tower,tower.hp,tower.x,tower.y);s.world.events=[];s.world.updateWrecks(1);coastRender();true");
 await screenshot('tower-destroyed');
 // A native-scale three-frame sequence makes any one-pixel boundary pop inspectable.
 await resize(768,432);
 const clip=await evaluate(`(()=>{const r=window.__GAME__.canvas.getBoundingClientRect();return{x:r.x+r.width*.25,y:r.y,width:r.width*.5,height:r.height,scale:1};})()`);
 report.singlePixel=[];
 const pixelFrames=[];
 for(const scroll of[COAST_MAP_OFFSET-1,COAST_MAP_OFFSET,COAST_MAP_OFFSET+1]){
  await evaluate(`coastFixture(${scroll});true`);
  // Hide all dynamic water, actors and overlay effects: only the painted terrain
  // remains, so a camera step must equal a pixel translation of the previous frame.
  await evaluate(`s.children.list.forEach(node=>{if(node.texture?.key!==${JSON.stringify(COAST_MAP_KEY)})node.setVisible(false)});true`);
  pixelFrames.push(await screenshot('seam-pixel-'+scroll,clip));
  report.singlePixel.push({scroll,elapsed:24});
 }
 report.pixelContinuity=await evaluate(`(async()=>{
  const sources=${JSON.stringify(pixelFrames)};
  const frames=[];
  for(const data of sources){
   const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
   frames.push({width:img.width,height:img.height,data:ctx.getImageData(0,0,img.width,img.height).data});
  }
  return frames.slice(1).map((frame,i)=>{
   const previous=frames[i];let total=0,peak=0,changed=0,count=0;
   for(let y=1;y<frame.height;y++)for(let x=0;x<frame.width;x++)for(let c=0;c<3;c++){
    const error=Math.abs(frame.data[(y*frame.width+x)*4+c]-previous.data[((y-1)*frame.width+x)*4+c]);
    total+=error;peak=Math.max(peak,error);if(error>3)changed++;count++;
   }
   return{mean:total/count,peak,changedFraction:changed/count,width:frame.width,height:frame.height};
  });
 })()`);
 for(const delta of report.pixelContinuity){
  assert(delta.mean<.3&&delta.changedFraction<.005,`Visible coast changes across 1px wrap: ${JSON.stringify(delta)}`);
 }
 if(!quick){
  // Hold elapsed fixed while scrolling 1 px/frame: every visible change is spatial.
  await evaluate(`coastFixture(${COAST_MAP_OFFSET-120});
   window.coastFrames=[];window.coastStream=window.__GAME__.canvas.captureStream(30);
   window.coastRecorder=new MediaRecorder(coastStream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3000000});
   coastRecorder.ondataavailable=e=>{if(e.data.size)coastFrames.push(e.data)};coastRecorder.start();true;`);
  report.motion=await evaluate(`new Promise(resolve=>{
   let frame=0;const start=${COAST_MAP_OFFSET-120};const samples=[];
   function tick(){s.world.scroll=start+frame;s.world.elapsed=24;coastRender();s.player.setVisible(false);
    s.backdrop.shadows?.forEach(x=>x.setVisible(false));
    if(frame%30===0)samples.push({frame,scroll:s.world.scroll});
    if(++frame<=240)setTimeout(tick,1000/30);else resolve(samples);
   }tick();
  })`);
  const video=await evaluate(`new Promise(resolve=>{
   coastRecorder.onstop=()=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(new Blob(coastFrames,{type:'video/webm'}));coastStream.getTracks().forEach(t=>t.stop());};coastRecorder.stop();
  })`);
  writeFileSync(join(out,'seam-motion.webm'),Buffer.from(video,'base64'));
  for(let i=1;i<report.motion.length;i++)assert.equal(report.motion[i].scroll-report.motion[i-1].scroll,30);
 }
 assert.deepEqual(errors,[],'Browser reported an error');
 writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{
 socket?.close();chrome.kill();server.close();
}
