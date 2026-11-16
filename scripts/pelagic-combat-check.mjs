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
  window.subFixture=(route=300)=>{
   s.begin(0);s.scene.pause();s.world.state='play';s.world.waveIndex=999;s.world.supplyIndex=999;
   s.world.miniStarted=true;s.world.bossStarted=false;
   s.world.route=route;s.world.elapsed=route;s.world.scroll=route*38;s.world.player.invulnerable=999;
   s.world.enemies=[];s.world.cargo=[];s.world.events=[];s.world.boss=undefined;s.world.bullets.forEach(b=>b.active=false);
   s.world.step(1/60);
   coastRender();
  };true;
 `);

 // 01: Colossal Submarine Bow entering open ocean arena (zero coastal beaches behind boss)
 await evaluate("subFixture(300);for(let i=0;i<50;i++)s.world.step(1/60);coastRender();true");
 await screenshot('01-sub-enter');
 const openOceanCheck=await evaluate("({coastVisible:s.backdrop.pelagicState().coast.visible,subVisible:s.subBossArt.hullSprites[0].visible})");
 assert.equal(openOceanCheck.coastVisible,false);assert.equal(openOceanCheck.subVisible,true);

 // 02: Section 0 (PROA BLINDADA) active combat with turrets warning & spherical shots
 await evaluate("for(let i=0;i<130;i++)s.world.step(1/60,{x:0,y:0,fire:true,special:false});coastRender();true");
 await screenshot('02-sub-sec0-bow');

 // 03: Direct hull damage craters, broken turret base, fire & smoke
 await evaluate("(()=>{const sub=s.world.boss.sub,s0=sub.sections[0];s0.parts[0].hp=0;s0.parts[1].hp=0;s0.marks.push({dx:-46,dy:-22,size:.9,seed:7},{dx:-24,dy:20,size:.85,seed:19});s0.hullHp=40;s0.hullFlash=.09;coastRender();})()");
 await screenshot('03-sub-hull-damage-crater');

 // 04: Smooth transition scroll between Sec 0 ruined bow and Sec 1 Armamento Frontal
 await evaluate("(()=>{const sub=s.world.boss.sub,s0=sub.sections[0];s0.hullHp=0;s0.parts.forEach(p=>p.hp=0);for(let i=0;i<52;i++)s.world.step(1/60);coastRender();})()");
 await screenshot('04-sub-transition');
 assert.equal(await evaluate("s.world.boss.sub.phase"),'transition');

 // 05: Section 2 (TORRE DE COMANDO) intact towering bridge & flanking fire
 await evaluate("(()=>{const sub=s.world.boss.sub;sub.activeSection=2;sub.subScroll=sub.targetScroll=480;sub.phase='fight';for(let i=0;i<60;i++)s.world.step(1/60,{x:0,y:0,fire:true,special:false});coastRender();})()");
 await screenshot('05-sub-sec2-conning-intact');

 // 06: Section 2 with Conning Tower destroyed -> burning ruined wreck + red hull flash
 await evaluate("(()=>{const sub=s.world.boss.sub,s2=sub.sections[2],br=s2.parts.find(p=>p.kind==='bridge');s.world.damageSubModule(sub,s2,br,999,br.x,br.y);s2.hullHp=80;for(let i=0;i<30;i++)s.world.step(1/60);coastRender();})()");
 await screenshot('06-sub-sec2-conning-ruined');
 assert.equal(await evaluate("s.world.boss.sub.bridgeDestroyed"),true);

 // 07: Section 4 (PROPULSÃO ABISSAL) stern shrouded turbines + glowing reactor spiral
 await evaluate("(()=>{const sub=s.world.boss.sub;sub.activeSection=4;sub.subScroll=sub.targetScroll=960;sub.phase='fight';for(let i=0;i<115;i++)s.world.step(1/60,{x:.35,y:0,fire:true,special:false});coastRender();})()");
 await screenshot('07-sub-sec4-stern-reactor');

 // 08: Tormenta Escarlate special blast over Section 4
 await evaluate("s.world.weapons.weaponLevel=5;s.world.step(1/60,{x:0,y:0,fire:false,special:true});for(let i=0;i<50;i++)s.world.step(1/60);coastRender();true");
 await screenshot('08-sub-special-blast');
 assert.equal(await evaluate("s.world.bomb?.phase"),'blast');

 // 09: Staged 3.6s collapse + chain explosions + submerge
 await evaluate("(()=>{const sub=s.world.boss.sub,s4=sub.sections[4];s4.hullHp=0;s4.parts.forEach(p=>p.hp=0);for(let i=0;i<90;i++){s.world.step(1/60);s.consumeEvents();}s.backdrop.draw(s.clock,s.world,2);s.renderWorld(1/60);})()");
 await screenshot('09-sub-collapse-destruction');
 assert.equal(await evaluate("s.world.boss.sub.phase"),'collapse');

 // 10: Automatic flyout after collapse -> Result screen, plus 1920x1080 & 854x480 compact touch
 await resize(1920,1080);
 await evaluate("(()=>{const sub=s.world.boss.sub;sub.activeSection=2;sub.subScroll=sub.targetScroll=480;sub.phase='fight';s.world.boss.phase='fight';coastRender();})()");
 await screenshot('11-sub-1920x1080');
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await resize(854,480);
 await evaluate("s.setTouchVisible(true);coastRender();true");
 await screenshot('12-sub-mobile-854x480-touch');
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});
 await resize(1366,768);
 await evaluate("subFixture(300);(()=>{const sub=s.world.boss.sub;sub.phase='collapse';sub.timer=3.58;for(let i=0;i<60;i++)s.world.step(1/60);coastRender();})()");
 await screenshot('10-sub-flyout');
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
