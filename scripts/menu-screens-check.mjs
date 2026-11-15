/** Real Chrome/Phaser capture of every non-gameplay screen (intro, title, menus, pause stack, results).
 * Run after a production build: node scripts/menu-screens-check.mjs [outDir]
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';

const root=resolve('dist');
const out=resolve(process.argv[2]??'docs/screenshots/menus-v2');
mkdirSync(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ogg':'audio/ogg','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 const file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+sep)||!existsSync(file)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});
 res.end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=mkdtempSync(join(tmpdir(),'bw-menu-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--remote-debugging-port=0','--no-first-run',
 '--autoplay-policy=no-user-gesture-required','--user-data-dir='+profile,'about:blank',
],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[],report={errors,shots:[],fps:{}};
let socket;
try{
 let target;
 for(let i=0;i<80&&!target;i++){
  try{
   const port=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0].trim();
   target=(await(await fetch('http://127.0.0.1:'+port+'/json')).json()).find(t=>t.type==='page');
  }catch{/* starting */}
  if(!target)await sleep(150);
 }
 assert(target,'Chrome did not expose a page target');
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 let seq=0;const pending=new Map();
 socket.onmessage=event=>{
  const msg=JSON.parse(event.data);
  if(msg.id){const h=pending.get(msg.id);if(!h)return;pending.delete(msg.id);clearTimeout(h.timeout);msg.error?h.reject(new Error(JSON.stringify(msg.error))):h.resolve(msg.result);}
  else if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);
  else if(msg.method==='Log.entryAdded'&&msg.params.entry.level==='error')errors.push(msg.params.entry);
 };
 const send=(method,params={})=>new Promise((r,j)=>{const id=++seq;const timeout=setTimeout(()=>{pending.delete(id);j(new Error('CDP timeout: '+method));},60000);pending.set(id,{resolve:r,reject:j,timeout});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 const waitFor=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await sleep(100);}throw new Error('Timeout: '+expression);};
 const settle=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true))))');
 const shot=async name=>{await settle();report.shots.push(name);const result=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(out,name+'.png'),Buffer.from(result.data,'base64'));};
 const resize=async(width,height)=>{await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await evaluate('window.__GAME__?.scale.refresh();true');await settle();};
 const fps=async(label,ms=2500)=>{report.fps[label]=await evaluate(`new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;if(performance.now()-t0<${ms})requestAnimationFrame(f);else r(Math.round(n*1000/(performance.now()-t0)));};requestAnimationFrame(f);})`);};
 await send('Runtime.enable');await send('Page.enable');await send('Log.enable');
 await resize(1366,768);
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 await waitFor("window.__GAME__?.scene.isActive('ArcadeScene')&&!!window.__GAME__.scene.getScene('ArcadeScene').ui");
 await evaluate("window.s=window.__GAME__.scene.getScene('ArcadeScene');s.audio.setMix(0,0,true);true");
 // Intro beats (real time).
 await evaluate("s.show('intro');true");
 await sleep(900);await shot('01-intro-a');
 await sleep(1700);await shot('02-intro-b');
 await sleep(1600);await shot('03-intro-c');
 await fps('intro');
 await evaluate("s.show('title');true");await sleep(1400);await shot('04-title');
 await fps('title');
 await evaluate("s.show('pilot');true");await sleep(900);await shot('05-pilot');
 await evaluate("s.show('missions');true");await sleep(900);await shot('06-missions');
 await evaluate("s.pauseOrigin='title';s.show('settings');true");await sleep(700);await shot('07-settings-title');
 await evaluate("s.begin(0);true");await sleep(3200);
 await evaluate("s.show('pause');true");await sleep(700);await shot('08-pause');
 await evaluate("s.show('controls');true");await sleep(700);await shot('09-controls');
 await evaluate("s.pauseOrigin='pause';s.show('settings');true");await sleep(700);await shot('10-settings-pause');
 await evaluate("s.show('confirm-exit');true");await sleep(700);await shot('11-confirm-exit');
 await evaluate("s.world.score=123450;s.world.kills=87;s.world.collected=12;s.world.elapsed=245;s.show('result');true");await sleep(900);await shot('12-result');
 await evaluate("s.show('defeat');true");await sleep(900);await shot('13-defeat');
 await evaluate("s.show('ending');true");await sleep(900);await shot('14-ending');
 await resize(1920,1080);
 await evaluate("s.show('title');true");await sleep(900);await shot('15-title-1920');
 await evaluate("s.begin(0);true");await sleep(1500);await evaluate("s.show('pause');true");await sleep(700);await shot('16-pause-1920');
 await evaluate("s.show('play');true");await sleep(300);await fps('gameplay',3000);
 report.screen=await evaluate('s.screen');
 assert.deepEqual(errors,[]);
 writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{socket?.close();chrome.kill();server.close();}
