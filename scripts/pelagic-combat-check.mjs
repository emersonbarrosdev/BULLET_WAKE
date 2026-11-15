/** Real Chrome/Phaser coastline fixtures; inspect the PNGs before approving the art.
 * Run after a production build: node scripts/pelagic-coast-check.mjs [--quick]
 * This checks renderer continuity, not visual equivalence to the user's reference.
 */
import assert from 'node:assert/strict';
import {steer} from './arcade-route.mjs';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {COAST_MAP_PERIOD,COAST_MAP_KEY,COAST_MAP_SCALE,COAST_MAP_OFFSET,wrapCoast} from '../src/game/arcade/PelagicCoastMap.ts';

const root=resolve('dist');
const out=resolve('docs/screenshots/pelagic-combat-v2');
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
  await settle();report.fixtures.push({name});
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

 await evaluate("coastFixture(0);s.world.spawnEncounter({family:'submarine',formation:'pair',motion:'stationary',lane:.5});s.world.updateEnemies(.6);coastRender();true");
 await screenshot('01-submarines-emerge');
 await evaluate("s.world.updateEnemies(.7);coastRender();true");await screenshot('02-submarines-hold');
 report.submarines=await evaluate("s.world.enemies.filter(e=>e.submarine).map(e=>({x:e.x,y:e.y,phase:e.submarine.phase,key:s.enemySprites.get(e.id).texture.key,alpha:s.enemySprites.get(e.id).alpha,rotation:s.enemySprites.get(e.id).rotation}))");
 assert.equal(report.submarines.length,2);assert(report.submarines.every(e=>e.key==='arc-submarine-v2'&&e.rotation===0&&e.alpha===1));
 await evaluate("coastFixture(0);s.world.cargo=[{id:901,x:330,y:150,vx:0,vy:0,kind:'power',crate:true,hp:3,age:.25},{id:902,x:410,y:190,vx:0,vy:0,kind:'power',crate:false,hp:1,age:.25},{id:903,x:360,y:240,vx:0,vy:0,kind:'life',crate:false,hp:1,age:.25},{id:904,x:415,y:290,vx:0,vy:0,kind:'special',crate:false,hp:1,age:.25}];coastRender();true");
 await screenshot('03-balloon-and-pickups');
 await evaluate("coastFixture(0);s.world.player.invulnerable=0;s.world.spawnEncounter({family:'boat',formation:'pair',motion:'stationary',lane:.5});s.world.enemies.forEach((e,i)=>{e.navigation.worldY=130+i*100;e.y=e.navigation.worldY;e.x=335+i*70;});s.world.firePrimary();coastRender();true");
 await screenshot('04-wet-hulls-and-round-shot');
 await evaluate("s.world.enemies[0].flash=.09;coastRender();true");await screenshot('05-hit-overlay');
 report.flash=await evaluate("s.hitOverlays.sprites.filter(x=>x.visible).map(x=>({alpha:x.alpha,key:x.texture.key}))");assert(report.flash.length>0&&report.flash.every(x=>x.alpha<=.4));
 await evaluate("coastFixture(0);s.world.step(.05,{x:0,y:0,fire:false,special:true});for(let i=0;i<5;i++)s.world.step(.05);coastRender();true");await screenshot('06-bomb-flight');
 await evaluate("for(let i=0;i<14;i++)s.world.step(.05);coastRender();true");await screenshot('07-colossal-blast');
 report.bomb=await evaluate("({phase:s.world.bomb?.phase,age:s.world.bomb?.age,radius:s.world.bomb?.radius,key:s.bombArt.blast.texture.key})");assert.equal(report.bomb.phase,'blast');
 await resize(1920,1080);await screenshot('08-colossal-blast-1920');await resize(1366,768);
 await evaluate("coastFixture(0);s.world.startBoss(false);s.world.boss.timer=2.5;s.world.updateBoss(.01);s.world.updateBoss(.01);coastRender();true");await screenshot('09-boss-intact');
 report.sectors=await evaluate("(()=>{const b=s.world.boss;const left=b.parts.find(p=>p.dx<0);s.world.damageBossAt(b.x-b.size*.2,b.y,left.hp);const before=b.parts.reduce((v,p)=>v+p.hp,0);s.world.damageBossAt(b.x-b.size*.2,b.y,20);const after=b.parts.reduce((v,p)=>v+p.hp,0);coastRender();return{leftHp:left.hp,reducedDamage:before-after}})()");assert.equal(report.sectors.leftHp,0);assert(Math.abs(report.sectors.reducedDamage-5)<1e-7);await screenshot('10-boss-left-destroyed');
 await evaluate("s.world.boss.phase='sink';s.world.boss.timer=2.61;s.world.updateBoss(.01);for(let i=0;i<35;i++)s.world.step(.05,{x:0,y:1,fire:true,special:false});coastRender();true");await screenshot('11-automatic-flyout');
 report.flyout=await evaluate("({state:s.world.state,y:s.world.player.y})");assert.equal(report.flyout.state,'exit');

 if(process.argv.includes('--routes')){
  await evaluate('window.steer='+steer.toString());report.routes=[];
  for(const index of[0,1]){
   const run=await evaluate('(async()=>{s.begin('+index+');s.scene.pause();let ticks=0;while(ticks<120*440&&!['+JSON.stringify('victory')+','+JSON.stringify('defeat')+'].includes(s.world.state)){for(let j=0;j<240&&!['+JSON.stringify('victory')+','+JSON.stringify('defeat')+'].includes(s.world.state);j++){s.world.step(1/120,steer(s.world));s.consumeEvents();if(ticks%2===0)s.renderWorld(1/60);ticks++;}await new Promise(r=>setTimeout(r,0));}coastRender();return{mission:'+index+',state:s.world.state,seconds:s.world.elapsed,deaths:s.world.deaths,lives:s.world.lives,x:s.world.player.x,y:s.world.player.y};})()');
   report.routes.push(run);console.log('Native collision route',run);await screenshot('route-'+index+'-result');assert.equal(run.state,'victory');
  }
 }
 assert.deepEqual(errors,[]);writeFileSync(join(out,process.argv.includes('--routes')?'report.json':'report-fixtures.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{socket?.close();chrome.kill();server.close();}
