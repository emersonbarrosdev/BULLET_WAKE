/** Packs drawn animated spritesheets for RIVET (UP) and Fenda Pelágica airborne/VFX actors.
 * Preserves approved cel-shaded silhouettes, dark #182948 outlines, and palette from rivet.webp, enemies.webp, and ufo.webp.
 * Outputs clean RGBA WebP sheets in public/assets/arcade/pelagic-review/:
 *  - rivet-up-sheet.webp (7 bank columns x 4 thruster flame rows, 256x256 per cell = 1792x1024)
 *  - pelagic-enemy-air.webp (7 columns x 16 rows, 128x128 per cell = 896x2048)
 *  - pelagic-ufo-anim.webp (6 columns x 1 row, 128x128 per cell = 768x128)
 *  - pelagic-vfx.webp (4 columns x 4 rows, 128x128 per cell = 512x512)
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,execFileSync} from 'node:child_process';

const OUT=resolve('public/assets/arcade/pelagic-review');
mkdirSync(OUT,{recursive:true});
const TMP=mkdtempSync(join(tmpdir(),'bw-anim-pack-'));

const SRC={
 rivet:resolve('public/assets/arcade/rivet.webp'),
 rivetRollLeft:resolve('scripts/assets/rivet-roll-left-poses.png'),
 enemies:resolve('public/assets/arcade/enemies.webp'),
 ufo:resolve('public/assets/arcade/ufo.webp'),
};
for(const [k,p]of Object.entries(SRC))assert(existsSync(p),`Missing ${k}: ${p}`);

const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><body></body></html>');return;}
 const isPng=path.endsWith('.png');
 const key=path.slice(1).replace(/\.(webp|png)$/,'');
 if(SRC[key]){res.writeHead(200,{'Content-Type':isPng?'image/png':'image/webp'});res.end(readFileSync(SRC[key]));return;}
 res.writeHead(404).end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;

const profile=mkdtempSync(join(tmpdir(),'bw-anim-chrome-'));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
 '--headless=new','--remote-debugging-port=0','--no-first-run','--user-data-dir='+profile,`http://127.0.0.1:${port}/`,
],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let socket;

try{
 let target;
 for(let i=0;i<80&&!target;i++){
  try{
   const dbgPort=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0].trim();
   target=(await(await fetch(`http://127.0.0.1:${dbgPort}/json`)).json()).find(t=>t.type==='page');
  }catch{/* wait */}
  if(!target)await sleep(120);
 }
 assert(target,'Chrome target failed');
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});

 let seq=0;
 const pending=new Map();
 socket.onmessage=ev=>{
  const m=JSON.parse(ev.data);if(!m.id)return;
  const h=pending.get(m.id);if(!h)return;
  pending.delete(m.id);clearTimeout(h.timeout);
  m.error?h.reject(new Error(JSON.stringify(m.error))):h.resolve(m.result);
 };
 const evalJs=expression=>new Promise((resolve,reject)=>{
  const id=++seq;
  const timeout=setTimeout(()=>{pending.delete(id);reject(new Error('Eval timeout'));},120000);
  pending.set(id,{
   resolve:r=>{if(r.exceptionDetails)reject(new Error(JSON.stringify(r.exceptionDetails)));else resolve(r.result.value);},
   reject,
   timeout,
  });
  socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
 });

 const result=await evalJs(`(async()=>{
  const load=src=>new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src;});
  const [rivetImg,rollLeftImg,enemiesImg,ufoImg]=await Promise.all([load('/rivet.webp'),load('/rivetRollLeft.png'),load('/enemies.webp'),load('/ufo.webp')]);

  const makeCv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  const cropCell=(img,col,row,w=256,h=256)=>{
   const c=makeCv(w,h),x=c.getContext('2d');
   x.drawImage(img,col*w,row*h,w,h,0,0,w,h);
   return c;
  };

  // Strip warm exhaust flames below RIVET's 3 nozzles (y >= 208, orange/amber/gold pixels)
  const cleanRivetBase=cropCell(rivetImg,1,0,256,256);
  {
   const ctx=cleanRivetBase.getContext('2d');
   const id=ctx.getImageData(0,0,256,256),d=id.data;
   for(let y=207;y<256;y++){
    for(let x=90;x<166;x++){
     const i=(y*256+x)*4;
     if(d[i+3]<16)continue;
     const r=d[i],g=d[i+1],b=d[i+2];
     const isFlame=(r>155&&g>45&&b<115)||(r>120&&r>g*1.35&&b<80);
     if(isFlame||y>=212){d[i+3]=0;}
    }
   }
   ctx.putImageData(id,0,0);
  }

  // Paint cel-shaded thruster flame cone aligned downward from nozzle (nx, ny)
  const drawNozzleFlame=(ctx,nx,ny,len,wid,phase,leanX,boost=0)=>{
   const flutter=Math.sin(phase*Math.PI*2)*1.3;
   const tipX=nx+leanX+flutter*.55,tipY=ny+len;
   // Outer warm glow (semi-transparent)
   ctx.save();
   const glow=ctx.createRadialGradient(nx+leanX*.3,ny+len*.4,1,nx+leanX*.4,ny+len*.48,len*.72);
   glow.addColorStop(0,boost?'rgba(140,248,255,0.52)':'rgba(255,180,55,0.42)');
   glow.addColorStop(1,boost?'rgba(24,160,255,0)':'rgba(255,95,20,0)');
   ctx.fillStyle=glow;
   ctx.beginPath();ctx.ellipse(nx+leanX*.4,ny+len*.48,wid*1.65,len*.7,0,0,Math.PI*2);ctx.fill();
   // Dark outline / deep scarlet outer tongue
   ctx.fillStyle=boost?'#116fa8':'#b82b12';
   ctx.beginPath();
   ctx.moveTo(nx-wid,ny-1);
   ctx.quadraticCurveTo(nx-wid*1.12+leanX*.35,ny+len*.45,tipX,tipY+1.5);
   ctx.quadraticCurveTo(nx+wid*1.12+leanX*.35,ny+len*.45,nx+wid,ny-1);
   ctx.closePath();ctx.fill();
   // Vibrant mid-flame
   ctx.fillStyle=boost?'#38e4ff':'#ff7a18';
   ctx.beginPath();
   ctx.moveTo(nx-wid*.82,ny);
   ctx.quadraticCurveTo(nx-wid*.88+leanX*.3,ny+len*.42,tipX,tipY-1);
   ctx.quadraticCurveTo(nx+wid*.88+leanX*.3,ny+len*.42,nx+wid*.82,ny);
   ctx.closePath();ctx.fill();
   // Golden-amber core
   ctx.fillStyle=boost?'#c8ffff':'#ffe14d';
   ctx.beginPath();
   ctx.moveTo(nx-wid*.52,ny);
   ctx.quadraticCurveTo(nx-wid*.48+leanX*.22,ny+len*.34,nx+leanX*.65,ny+len*.72);
   ctx.quadraticCurveTo(nx+wid*.48+leanX*.22,ny+len*.34,nx+wid*.52,ny);
   ctx.closePath();ctx.fill();
   // Incandescent plasma root
   ctx.fillStyle='#ffffff';
   ctx.beginPath();
   ctx.ellipse(nx,ny+len*.15,wid*.36,len*.18,0,0,Math.PI*2);
   ctx.fill();
   ctx.restore();
  };

  // Banked airframe projection around nose-tail axis (128,128), returning transform params for locked attachments
  const drawBankedAirframe=(dstCtx,srcCanvas,bank,yawMax=0.16,rollMax=0.62,cx=128,cy=128,size=256,drawAfter)=>{
   const scale=size/256;
   const phi=bank*rollMax;
   const sx=Math.max(0.54,Math.cos(phi));
   const yaw=bank*yawMax;
   // Render rolled & shaded airframe onto temp canvas first so lighting masks cleanly inside silhouette
   const tmp=makeCv(256,256),tx=tmp.getContext('2d');
   tx.save();
   tx.translate(cx,cy);
   tx.rotate(yaw);
   tx.scale(sx,1);
   // Subtle perspective vertical offset on wing tilt (left vs right halves)
   tx.drawImage(srcCanvas,-cx,-cy);
   // Directional roll light/shade (raised wing sunlit, lowered wing shaded)
   if(Math.abs(bank)>0.06){
    tx.globalCompositeOperation='source-atop';
    const grad=tx.createLinearGradient(-95,0,95,0);
    const shadeAlpha=Math.min(0.28,Math.abs(bank)*0.24).toFixed(2);
    const hiAlpha=Math.min(0.22,Math.abs(bank)*0.18).toFixed(2);
    if(bank<0){
     grad.addColorStop(0,'rgba(10,24,62,'+shadeAlpha+')');
     grad.addColorStop(0.45,'rgba(10,24,62,0)');
     grad.addColorStop(0.55,'rgba(255,255,255,0)');
     grad.addColorStop(1,'rgba(245,252,255,'+hiAlpha+')');
    }else{
     grad.addColorStop(0,'rgba(245,252,255,'+hiAlpha+')');
     grad.addColorStop(0.45,'rgba(255,255,255,0)');
     grad.addColorStop(0.55,'rgba(10,24,62,0)');
     grad.addColorStop(1,'rgba(10,24,62,'+shadeAlpha+')');
    }
    tx.fillStyle=grad;tx.fillRect(-128,-128,256,256);
   }
   tx.restore();

   dstCtx.save();
   dstCtx.scale(scale,scale);
   if(drawAfter?.under){
    dstCtx.save();dstCtx.translate(cx,cy);dstCtx.rotate(yaw);dstCtx.scale(sx,1);
    drawAfter.under(dstCtx,cx,cy);
    dstCtx.restore();
   }
   dstCtx.drawImage(tmp,0,0);
   if(drawAfter?.over){
    dstCtx.save();dstCtx.translate(cx,cy);dstCtx.rotate(yaw);dstCtx.scale(sx,1);
    drawAfter.over(dstCtx,cx,cy);
    dstCtx.restore();
   }
   dstCtx.restore();
  };

  // 1. RIVET UP SHEET (7 cols x 4 rows, 256x256 -> 1792x1024) — True Sonic Wings 2.5D longitudinal barrel roll
  const rivetSheet=makeCv(256*7,256*4),rc=rivetSheet.getContext('2d');

  // Helper: cel-shaded metallic thruster bell matching rivet.webp steel/slate palette and #182948 ink outline
  const drawNozzleBell=(ctx,cx,topY,w,h,shadeFactor=1)=>{
   ctx.save();
   const hw=w*.5;
   // Dark navy #182948 outer silhouette
   ctx.fillStyle='#182948';
   ctx.beginPath();
   ctx.moveTo(cx-hw-1.8,topY-2);
   ctx.lineTo(cx+hw+1.8,topY-2);
   ctx.lineTo(cx+hw*.90+1.8,topY+h+1.5);
   ctx.quadraticCurveTo(cx,topY+h+4.2,cx-hw*.90-1.8,topY+h+1.5);
   ctx.closePath();ctx.fill();

   // Metallic body gradient across cylindrical taper
   const g=ctx.createLinearGradient(cx-hw,topY,cx+hw,topY);
   g.addColorStop(0,shadeFactor<0.85?'#293548':'#3b4960');
   g.addColorStop(0.35,shadeFactor<0.85?'#46566f':'#6a7b96');
   g.addColorStop(0.65,shadeFactor<0.85?'#647692':'#94a6c2');
   g.addColorStop(1,'#2d384c');
   ctx.fillStyle=g;
   ctx.beginPath();
   ctx.moveTo(cx-hw,topY);
   ctx.lineTo(cx+hw,topY);
   ctx.lineTo(cx+hw*.90,topY+h);
   ctx.quadraticCurveTo(cx,topY+h+2.2,cx-hw*.90,topY+h);
   ctx.closePath();ctx.fill();

   // Mid ribbed collar band
   ctx.fillStyle='#1f2c44';
   ctx.fillRect(cx-hw*.96,topY+h*.42,hw*1.92,2.2);
   // Exhaust warm rim ring at bell mouth
   ctx.fillStyle='#d97b24';
   ctx.beginPath();
   ctx.ellipse(cx,topY+h-0.5,hw*.72,1.8,0,0,Math.PI*2);
   ctx.fill();
   ctx.fillStyle='#3a2218';
   ctx.beginPath();
   ctx.ellipse(cx,topY+h-0.9,hw*.52,1.1,0,0,Math.PI*2);
   ctx.fill();
   ctx.restore();
  };

  // Pre-build the 4 clean left-to-neutral airframes (cols 0, 1, 2 from 2.5D roll + col 3 original cleanRivetBase)
  const leftNozzleDefs=[
   // col 0 (-84 deg): tight depth-stacked cluster where foreground nozzle covers ~60% of deeper bells
   [{x:119,y:188,w:9.6,h:15,shade:.75},{x:123.5,y:187,w:11,h:15.5,shade:.88},{x:128,y:185.5,w:12.6,h:16,shade:1}],
   // col 1 (-55 deg): clear progressive 2.5D overlap
   [{x:118.5,y:189,w:11,h:15.5,shade:.80},{x:126.5,y:188,w:12.4,h:16,shade:.92},{x:134.5,y:186.5,w:13,h:16.5,shade:1}],
   // col 2 (-28 deg): mild horizontal compression + subtle stagger
   [{x:117.5,y:190,w:12.2,h:16,shade:.88},{x:130.5,y:189.5,w:13.2,h:16.5,shade:1},{x:143,y:188.5,w:12.8,h:16,shade:1}],
  ];
  const neutralNozzles=[{x:108,y:206,w:13,h:0,shade:1},{x:128,y:208,w:14,h:0,shade:1},{x:148,y:206,w:13,h:0,shade:1}];

  // Row variations per TAREFA 22: 0 = normal cruise, 1 = overboost plasma flare, 2 = engine flutter, 3 = firing recoil glint
  const rowConfigs=[
   {cLen:22,sLen:19,wid:6.2,boost:false,recoilGlint:false,phase:0.0},
   {cLen:32,sLen:27,wid:7.6,boost:true, recoilGlint:false,phase:0.25},
   {cLen:19,sLen:24,wid:5.8,boost:false,recoilGlint:false,phase:0.5},
   {cLen:28,sLen:24,wid:7.2,boost:false,recoilGlint:true, phase:0.75},
  ];

  // Prepare 4 clean left hulls (0..2 cropped from rollLeftImg with residual specks wiped, 3 = exact cleanRivetBase)
  const hullFrames=[];
  for(let c=0;c<4;c++){
   const hCv=makeCv(256,256),hx=hCv.getContext('2d');
   if(c<3){
    hx.drawImage(rollLeftImg,c*256,0,256,256,0,0,256,256);
    // Wipe any stray speck below y=197 inside centerline channel
    const id=hx.getImageData(0,0,256,256),dd=id.data;
    for(let y=195;y<225;y++){
     for(let x=98;x<158;x++){
      const i=(y*256+x)*4;
      if(dd[i+3]===0)continue;
      if(dd[i]<dd[i+1]+20)dd[i+3]=0;
     }
    }
    hx.putImageData(id,0,0);
   }else{
    hx.drawImage(cleanRivetBase,0,0);
   }
   hullFrames.push(hCv);
  }

  for(let r=0;r<4;r++){
   const rcCfg=rowConfigs[r];
   for(let c=0;c<7;c++){
    const isRightMirror=c>3;
    const srcCol=isRightMirror?(6-c):c;
    const cell=makeCv(256,256),cc=cell.getContext('2d');
    const nozzles=srcCol<3?leftNozzleDefs[srcCol]:neutralNozzles;

    // 1. Draw thruster flames behind nozzles
    for(let n=0;n<nozzles.length;n++){
     const nz=nozzles[n];
     const isCenter=n===1;
     const len=(isCenter?rcCfg.cLen:rcCfg.sLen)*(srcCol===0&&n===0?0.85:1);
     const wid=rcCfg.wid*(nz.w/13.2);
     const flameTopY=srcCol<3?(nz.y+nz.h-1.5):nz.y;
     drawNozzleFlame(cc,nz.x,flameTopY,len,wid,rcCfg.phase+n*0.2,0,rcCfg.boost);
    }

    // 2. For rolled cols (0..2), paint perspective-overlapping metallic nozzle bells tucked under fuselage & behind wingtips
    if(srcCol<3){
     for(let n=0;n<nozzles.length;n++){
      const nz=nozzles[n];
      drawNozzleBell(cc,nz.x,nz.y,nz.w,nz.h,nz.shade);
     }
    }

    // 3. Composite airframe silhouette on top
    cc.drawImage(hullFrames[srcCol],0,0);

    // 4. Subtle muzzle light shimmer on row 3 (disparo feedback on nose cannon/wing roots)
    if(rcCfg.recoilGlint){
     cc.save();
     cc.fillStyle='rgba(255,244,185,0.45)';
     cc.beginPath();cc.ellipse(128,22,4.5,6.5,0,0,Math.PI*2);cc.fill();
     cc.restore();
    }

    // 5. Mirror horizontally around center axis x=128 for right roll poses (cols 4, 5, 6)
    if(isRightMirror){
     rc.save();
     rc.translate(c*256+256,r*256);
     rc.scale(-1,1);
     rc.drawImage(cell,0,0);
     rc.restore();
    }else{
     rc.drawImage(cell,c*256,r*256);
    }
   }
  }

  // Helper: strip yellow frozen propeller blades inside a bounding window while keeping dark spinner center
  const stripFrozenProp=(imgCell,x0,x1,y0,y1,cx,cy,keepR)=>{
   const c=makeCv(256,256),x=c.getContext('2d');
   x.drawImage(imgCell,0,0);
   const id=x.getImageData(0,0,256,256),d=id.data;
   for(let y=y0;y<=y1;y++)for(let px=x0;px<=x1;px++){
    if(Math.hypot(px-cx,y-cy)<=keepR)continue;
    const i=(y*256+px)*4;
    if(d[i+3]<12)continue;
    // Remove blade yellow + dark ink border attached to horizontal blade span
    const r=d[i],g=d[i+1],b=d[i+2];
    const isBladeYellow=r>165&&g>120&&b<125;
    const isDarkEdge=(r+g+b)<240;
    if(isBladeYellow||isDarkEdge)d[i+3]=0;
   }
   x.putImageData(id,0,0);
   return c;
  };

  // Paint a cel-shaded spinning front-mounted propeller in top-down 2.5D perspective at (cx, cy) relative to (128,128)
  const drawSpinProp=(ctx,cx,cy,span,phaseIdx,blades=2,blurTint='rgba(235,252,255,0.34)')=>{
   // Top-down foreshortened front prop: sweeps width across X with subtle 2.5D vertical tilt & crescent streak disc
   ctx.save();
   ctx.translate(cx,cy);
   const phases=blades===3?[1.0,0.46,-0.55,-0.92]:[1.0,0.58,0.22,-0.62];
   const k=phases[phaseIdx%4];
   const tiltY=(phaseIdx%2===1?1:-1)*(phaseIdx===2?0:3.2);
   // Subtle translucent wind-blur disc aligned perpendicular to fuselage nose (alpha < 95 so collision ignores it)
   ctx.strokeStyle=blurTint;
   ctx.lineWidth=6.5;
   ctx.lineCap='round';
   ctx.beginPath();ctx.ellipse(0,0,span*.92,7.5,0,0,Math.PI*2);ctx.stroke();
   ctx.strokeStyle='rgba(255,244,165,0.28)';
   ctx.lineWidth=3.2;
   ctx.beginPath();
   const arcA=phaseIdx*(Math.PI/2);
   ctx.ellipse(0,0,span*.96,7.0,0,arcA,arcA+Math.PI*1.15);
   ctx.stroke();
   // Dark-outlined cel-shaded foreshortened propeller blades
   const bw=Math.max(10,span*Math.abs(k));
   if(phaseIdx!==2){
    for(const dir of[-1,1]){
     const tx=dir*bw,ty=dir*tiltY;
     ctx.fillStyle='#182948';
     ctx.beginPath();
     ctx.moveTo(0,-3.6);ctx.quadraticCurveTo(tx*.65,ty-4.4,tx,ty);ctx.quadraticCurveTo(tx*.65,ty+4.4,0,3.6);ctx.closePath();ctx.fill();
     ctx.fillStyle=dir*k>0?'#ffe55a':'#f2bf2c';
     ctx.beginPath();
     ctx.moveTo(0,-2.0);ctx.quadraticCurveTo(tx*.62,ty-2.8,tx*.92,ty);ctx.quadraticCurveTo(tx*.62,ty+2.8,0,2.0);ctx.closePath();ctx.fill();
     ctx.fillStyle='#fffbe0';
     ctx.beginPath();ctx.ellipse(tx*.52,ty-0.7,bw*.22,0.9,0,0,Math.PI*2);ctx.fill();
    }
   }else{
    // High-RPM cross-flash phase: bright golden strobe fan streaks
    ctx.strokeStyle='#ffe975';ctx.lineWidth=4.2;
    ctx.beginPath();ctx.moveTo(-span*.88,-2);ctx.lineTo(span*.88,2);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,0.72)';ctx.lineWidth=2.0;
    ctx.beginPath();ctx.moveTo(-span*.78,2);ctx.lineTo(span*.78,-2);ctx.stroke();
   }
   // Crisp central spinner cone
   ctx.fillStyle='#182948';ctx.beginPath();ctx.arc(0,0,5.2,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#ffd844';ctx.beginPath();ctx.arc(0,0,3.5,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(-1.1,-1.1,1.3,0,Math.PI*2);ctx.fill();
   ctx.restore();
  };

  // Clean fighter, acrobat, bomber, interceptor bases (protecting green bomber wing leading edge!)
  const fighterBase=stripFrozenProp(cropCell(enemiesImg,0,0),62,193,31,51,128,44,12);
  const jetBase=cropCell(enemiesImg,1,0);
  const acrobatBase=stripFrozenProp(cropCell(enemiesImg,2,0),72,185,37,56,128,48,11);
  let bomberBase=stripFrozenProp(cropCell(enemiesImg,3,0),40,109,57,70,77,72,11);
  bomberBase=stripFrozenProp(bomberBase,148,215,57,70,179,72,11);

  // 2. PELAGIC ENEMY AIR SHEET (7 cols x 16 rows, 128x128 per cell -> 896x2048)
  // Rows 0..3: fighter (5 bank cols 0..4), Rows 4..7: interceptor (5 cols 0..4),
  // Rows 8..11: acrobat (7 stunt bank/roll cols 0..6), Rows 12..15: bomber (5 heavy bank cols 0..4)
  const enemySheet=makeCv(128*7,128*16),ec=enemySheet.getContext('2d');
  const banks5=[-0.95,-0.48,0,0.48,0.95];
  const banks7=[-1.0,-0.66,-0.32,0,0.32,0.66,1.0];

  for(let p=0;p<4;p++){
   // Fighter (rows p, cols 0..4)
   for(let c=0;c<5;c++){
    const cell=makeCv(128,128),cc=cell.getContext('2d');
    drawBankedAirframe(cc,fighterBase,banks5[c],0.16,0.58,128,128,128,{
     over:(ctx)=>drawSpinProp(ctx,0,41-128,54,p,2)
    });
    ec.drawImage(cell,c*128,p*128);
   }
   // Interceptor (rows 4+p, cols 0..4)
   for(let c=0;c<5;c++){
    const cell=makeCv(128,128),cc=cell.getContext('2d');
    const b=banks5[c];
    const jetLens=[16,22,14,25];
    drawBankedAirframe(cc,jetBase,b,0.20,0.62,128,128,128,{
     under:(ctx)=>{
      const lean=-b*4.5;
      drawNozzleFlame(ctx,95-128,229-128,jetLens[p],5.4,p/4,lean,false);
      drawNozzleFlame(ctx,159-128,229-128,jetLens[(p+2)%4],5.4,(p+2)/4,lean,false);
     }
    });
    ec.drawImage(cell,c*128,(4+p)*128);
   }
   // Acrobat (rows 8+p, cols 0..6 — deeper roll for barrel-roll/knife-edge stunt maneuvers!)
   for(let c=0;c<7;c++){
    const cell=makeCv(128,128),cc=cell.getContext('2d');
    const b=banks7[c];
    drawBankedAirframe(cc,acrobatBase,b,0.24,0.92,128,128,128,{
     over:(ctx)=>drawSpinProp(ctx,0,47-128,51,p,2,'rgba(255,220,248,0.28)')
    });
    ec.drawImage(cell,c*128,(8+p)*128);
   }
   // Bomber (rows 12+p, cols 0..4 — twin wing-mounted props!)
   for(let c=0;c<5;c++){
    const cell=makeCv(128,128),cc=cell.getContext('2d');
    drawBankedAirframe(cc,bomberBase,banks5[c],0.11,0.44,128,128,128,{
     over:(ctx)=>{
      drawSpinProp(ctx,77-128,67-128,33,p,3,'rgba(235,255,215,0.28)');
      drawSpinProp(ctx,178-128,67-128,33,(p+2)%4,3,'rgba(235,255,215,0.28)');
     }
    });
    ec.drawImage(cell,c*128,(12+p)*128);
   }
  }

  // 3. PELAGIC UFO ANIM (6 cols x 1 row, 128x128 -> 768x128)
  const ufoSheet=makeCv(128*6,128),uc=ufoSheet.getContext('2d');
  const ufo0=cropCell(ufoImg,0,0),ufo1=cropCell(ufoImg,1,0);
  const rimLights=[[128,53],[198,126],[128,197],[60,126]];
  for(let c=0;c<6;c++){
   const cell=makeCv(128,128),cc=cell.getContext('2d');
   const src=(c%3===0)?ufo1:ufo0;
   const tilt=Math.sin(c/6*Math.PI*2)*0.07;
   const sx=1-Math.abs(tilt)*0.55;
   cc.save();
   cc.translate(64,64);cc.rotate(tilt);cc.scale(sx,1);
   // Soft underside cyan glow halo (alpha <= 90, outside alpha>=128 collision mask)
   const ug=cc.createRadialGradient(0,0,18,0,0,58);
   const glowAlpha=(0.24+0.12*Math.sin(c/6*Math.PI*2)).toFixed(2);
   ug.addColorStop(0,'rgba(72,248,255,'+glowAlpha+')');
   ug.addColorStop(1,'rgba(72,248,255,0)');
   cc.fillStyle=ug;cc.beginPath();cc.arc(0,0,58,0,Math.PI*2);cc.fill();
   cc.drawImage(src,0,0,256,256,-64,-64,128,128);
   // Rotating rim beacon pulse across all 4 dome ports
   const activeIdx=c%4;
   for(let k=0;k<4;k++){
    const [lx,ly]=rimLights[k];
    const px=(lx-128)*.5,py=(ly-128)*.5;
    const isBright=k===activeIdx||k===(activeIdx+2)%4;
    if(isBright){
     cc.fillStyle='rgba(175,255,255,0.88)';
     cc.beginPath();cc.arc(px,py,5.6,0,Math.PI*2);cc.fill();
     cc.fillStyle='#ffffff';
     cc.beginPath();cc.arc(px,py,2.8,0,Math.PI*2);cc.fill();
    }
   }
   cc.restore();
   uc.drawImage(cell,c*128,0);
  }

  // 4. PELAGIC VFX SHEET (4 cols x 4 rows, 128x128 -> 512x512)
  // Row 0: Triple-nozzle overboost plasma plume (0..3)
  // Row 1: Cartoon muzzle burst star/cone (4..7)
  // Row 2: Cyan-gold invulnerability/recovery barrier ring (8..11)
  // Row 3: Damage smoke & electrical spark burst (12..15)
  const vfxSheet=makeCv(512,512),vc=vfxSheet.getContext('2d');
  for(let f=0;f<4;f++){
   // Row 0: Overboost plasma plumes
   {
    const x=f*128+64,y=28;
    const boostLens=[58,72,54,78];
    drawNozzleFlame(vc,x-21,y,boostLens[(f+1)%4]*.78,6.5,f/4,0,true);
    drawNozzleFlame(vc,x+21,y,boostLens[(f+1)%4]*.78,6.5,(f+2)/4,0,true);
    drawNozzleFlame(vc,x,y+2,boostLens[f],8.5,(f+1)/4,0,true);
   }
   // Row 1: Muzzle flash burst (frames 4..7)
   {
    const cx=f*128+64,cy=128+64;
    const scale=[1.0,0.86,0.68,0.45][f];
    const rot=f*0.38;
    vc.save();vc.translate(cx,cy);vc.rotate(rot);vc.scale(scale,scale);
    const mg=vc.createRadialGradient(0,0,2,0,0,48);
    mg.addColorStop(0,'rgba(255,252,220,0.95)');
    mg.addColorStop(0.45,'rgba(255,196,64,0.58)');
    mg.addColorStop(1,'rgba(255,90,32,0)');
    vc.fillStyle=mg;vc.beginPath();vc.arc(0,0,48,0,Math.PI*2);vc.fill();
    const spikes=8;
    vc.fillStyle='#ff5830';
    vc.beginPath();
    for(let s=0;s<spikes*2;s++){
     const a=s*Math.PI/spikes;
     const rad=s%2===0?(s%4===0?42:29):11;
     if(s===0)vc.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);
     else vc.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
    }
    vc.closePath();vc.fill();
    vc.fillStyle='#fff6b5';
    vc.beginPath();
    for(let s=0;s<spikes*2;s++){
     const a=s*Math.PI/spikes;
     const rad=s%2===0?(s%4===0?31:20):7;
     if(s===0)vc.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);
     else vc.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
    }
    vc.closePath();vc.fill();
    vc.fillStyle='#ffffff';vc.beginPath();vc.arc(0,0,9,0,Math.PI*2);vc.fill();
    vc.restore();
   }
   // Row 2: Shield / recovery holographic shimmer ring (frames 8..11)
   {
    const cx=f*128+64,cy=256+64,rot=f*Math.PI/8;
    vc.save();vc.translate(cx,cy);vc.rotate(rot);
    const rg=vc.createRadialGradient(0,0,34,0,0,58);
    rg.addColorStop(0,'rgba(88,244,255,0)');
    rg.addColorStop(0.55,'rgba(88,244,255,0.46)');
    rg.addColorStop(0.82,'rgba(255,232,120,0.42)');
    rg.addColorStop(1,'rgba(88,244,255,0)');
    vc.fillStyle=rg;vc.beginPath();vc.arc(0,0,58,0,Math.PI*2);vc.fill();
    for(let aIdx=0;aIdx<4;aIdx++){
     const a0=aIdx*Math.PI/2+0.14,a1=a0+0.92;
     vc.strokeStyle=aIdx%2===0?'rgba(148,252,255,0.92)':'rgba(255,235,130,0.88)';
     vc.lineWidth=3.6;vc.lineCap='round';
     vc.beginPath();vc.arc(0,0,46,a0,a1);vc.stroke();
    }
    vc.restore();
   }
   // Row 3: Cartoon damage smoke & hit spark puff (frames 12..15, unified cel-shaded cloud silhouette)
   {
    const smokeCell=makeCv(128,128),sc=smokeCell.getContext('2d');
    const expand=0.72+f*0.11,fade=0.92-f*0.18;
    const puffs=[[-13,-5,19],[11,-9,17],[4,11,20],[-9,12,15]];
    sc.save();sc.translate(64,64);sc.scale(expand,expand);
    // Pass 1: unified dark ink outline across entire cloud
    sc.fillStyle='#1b2e4b';
    for(const [px,py,pr]of puffs){sc.beginPath();sc.arc(px,py,pr+2.8,0,Math.PI*2);sc.fill();}
    // Pass 2: unified mid-slate cloud body (no internal circle seams!)
    sc.fillStyle='#6c85a6';
    for(const [px,py,pr]of puffs){sc.beginPath();sc.arc(px,py,pr,0,Math.PI*2);sc.fill();}
    // Pass 3: unified top-left sunlit highlight lobes
    sc.fillStyle='#c4d9ef';
    for(const [px,py,pr]of puffs){sc.beginPath();sc.arc(px-3.5,py-3.5,pr*.52,0,Math.PI*2);sc.fill();}
    if(f<3){
     sc.fillStyle='#ffe868';
     for(let s=0;s<4;s++){
      const ang=s*1.57+f*0.7,r=28+f*5;
      sc.beginPath();sc.arc(Math.cos(ang)*r,Math.sin(ang)*r,3.6,0,Math.PI*2);sc.fill();
     }
    }
    sc.restore();
    vc.save();vc.globalAlpha=fade;vc.drawImage(smokeCell,f*128,384);vc.restore();
   }
  }

  const b64=cv=>cv.toDataURL('image/png').split(',')[1];
  return {
   rivetUp:b64(rivetSheet),
   enemyAir:b64(enemySheet),
   ufoAnim:b64(ufoSheet),
   vfx:b64(vfxSheet),
  };
 })()`);

 const saveWebp=(name,pngB64)=>{
  const pngPath=join(TMP,name+'.png');
  const webpPath=join(OUT,name+'.webp');
  writeFileSync(pngPath,Buffer.from(pngB64,'base64'));
  execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',pngPath,'-c:v','libwebp','-lossless','0','-quality','93',webpPath]);
  return webpPath;
 };

 const paths=[
  saveWebp('rivet-up-sheet',result.rivetUp),
  saveWebp('pelagic-enemy-air',result.enemyAir),
  saveWebp('pelagic-ufo-anim',result.ufoAnim),
  saveWebp('pelagic-vfx',result.vfx),
 ];
 console.log('Packed animated sheets:',paths);
}finally{
 socket?.close();chrome.kill();server.close();
 try{rmSync(TMP,{recursive:true,force:true});}catch{}
 try{rmSync(profile,{recursive:true,force:true});}catch{}
}
