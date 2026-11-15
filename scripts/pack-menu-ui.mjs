/** Packs generated Neo-Arcade UI, horizon, logo, and animated VFX art into crisp RGBA WebP sheets.
 * Uses headless Chrome 2D Canvas for exact perimeter flood-fill alpha + tight NineSlice cropping, and FFmpeg for WebP encoding.
 * Run once after image generation: node scripts/pack-menu-ui.mjs
 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn,execFileSync} from 'node:child_process';

const BRAIN='C:/Users/emers/.gemini/antigravity/brain/b3596df5-9f75-4a8d-802e-f10c1650a77d';
const OUT=resolve('public/assets/arcade/ui');
mkdirSync(OUT,{recursive:true});
const TMP=mkdtempSync(join(tmpdir(),'bw-ui-pack-'));

const SRC={
 frames:join(BRAIN,'src_ui_frames_blackbg_1794749865633.jpg'),
 icons:join(BRAIN,'src_ui_icons_1794749916739.jpg'),
 logo:join(BRAIN,'src_logo_arcade_1794749816063.jpg'),
 afterburner:join(BRAIN,'src_afterburner_clean_1794753841948.jpg'),
 vfxA:join(BRAIN,'src_menu_vfx_1794749886522.jpg'),
 vfxB:join(BRAIN,'src_menu_vfx_1794749847000.jpg'),
 sky:join(BRAIN,'src_sky_panorama_seamless_1794749840327.jpg'),
 cloudsIso:join(BRAIN,'src_clouds_waves_isolated_1794749911305.jpg'),
 cloudsGrid:join(BRAIN,'src_clouds_waves_grid_1794749942400.jpg'),
 ribbons:join(BRAIN,'src_ui_ribbons_1794750287708.jpg'),
 rivet:resolve('public/assets/arcade/rivet.webp'),
 enemies:resolve('public/assets/arcade/enemies.webp'),
 water:resolve('public/assets/arcade/pelagic-review/water.webp'),
 pelagicWater:resolve('public/assets/arcade/pelagic-water.webp'),
 coastHarbor:resolve('public/assets/arcade/pelagic-review/coast-harbor-v2.png'),
};
for(const [k,p]of Object.entries(SRC))assert(existsSync(p),`Missing source ${k}: ${p}`);

const srcMap=Object.fromEntries(Object.entries(SRC).map(([k,p])=>[`/${k}${extname(p)}`,p]));
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html><body></body></html>');return;}
 if(srcMap[path]){
  const ext=extname(srcMap[path]).toLowerCase();
  res.writeHead(200,{'Content-Type':ext==='.webp'?'image/webp':ext==='.png'?'image/png':'image/jpeg'});
  res.end(readFileSync(srcMap[path]));return;
 }
 res.writeHead(404).end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;

const profile=mkdtempSync(join(tmpdir(),'bw-chrome-pack-'));
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
  }catch{/* Wait for Chrome */}
  if(!target)await sleep(120);
 }
 assert(target,'Chrome target failed');
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});
 await sleep(300);
 let seq=0;const pending=new Map();
 socket.onmessage=ev=>{const m=JSON.parse(ev.data);if(!m.id)return;const h=pending.get(m.id);if(!h)return;pending.delete(m.id);clearTimeout(h.timeout);m.error?h.reject(new Error(JSON.stringify(m.error))):h.resolve(m.result);};
 const send=(method,params={})=>new Promise((r,j)=>{const id=++seq;const timeout=setTimeout(()=>{pending.delete(id);j(new Error('Timeout '+method));},60000);pending.set(id,{resolve:r,reject:j,timeout});socket.send(JSON.stringify({id,method,params}));});
 const evalFn=async fn=>{const res=await send('Runtime.evaluate',{expression:`(${fn})()`,awaitPromise:true,returnByValue:true});if(res.exceptionDetails)throw new Error(JSON.stringify(res.exceptionDetails));return res.result.value;};

 const saveWebp=(dataUrl,outName,lossless=false,q=93)=>{
  const raw=Buffer.from(dataUrl.split(',')[1],'base64');
  const pngPath=join(TMP,outName+'.png');
  writeFileSync(pngPath,raw);
  const outPath=join(OUT,outName+'.webp');
  execFileSync('ffmpeg',['-v','error','-y','-i',pngPath,'-c:v','libwebp',...(lossless?['-lossless','1']:['-quality',String(q)]),outPath]);
  console.log('Packed ->',outPath);
 };

 const results=await evalFn(async()=>{
  const load=url=>new Promise((res,rej)=>{const img=new Image();img.onload=()=>res(img);img.onerror=rej;img.src=url;});
  const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return{c,x:c.getContext('2d',{willReadFrequently:true})};};
  const slice=(img,sx,sy,sw,sh)=>{const{c,x}=mk(sw,sh);x.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);return{c,x,d:x.getImageData(0,0,sw,sh)};};

  // Flood-fill near-black outer background from cell borders; preserve navy interiors and dark outlines.
  const floodAlpha=(imgData,blackSum=38,seedHoles=false,holeMaxSum=20)=>{
   const {width:w,height:h,data:d}=imgData;
   const vis=new Uint8Array(w*h);
   const q=new Int32Array(w*h);
   let head=0,tail=0;
   const isBg=(i,lim)=>{const r=d[i*4],g=d[i*4+1],b=d[i*4+2];return r+g+b<=lim&&Math.max(r,g,b)<=Math.max(18,lim*.52)&&(b-r)<=8;};
   const push=i=>{if(!vis[i]){vis[i]=1;q[tail++]=i;}};
   for(let x=0;x<w;x++){push(x);push((h-1)*w+x);}
   for(let y=0;y<h;y++){push(y*w);push(y*w+w-1);}
   while(head<tail){
    const i=q[head++];
    if(!isBg(i,blackSum))continue;
    d[i*4+3]=0;
    const x=i%w,y=(i/w)|0;
    if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);
   }
   if(seedHoles){
    for(let i=0;i<w*h;i++){
     if(d[i*4+3]>0&&d[i*4]+d[i*4+1]+d[i*4+2]<=holeMaxSum&&Math.max(d[i*4],d[i*4+1],d[i*4+2])<=10&&d[i*4+2]-d[i*4]<=4){
      d[i*4+3]=0;
     }
    }
   }
   const alphaCopy=new Uint8Array(w*h);
   for(let i=0;i<w*h;i++)alphaCopy[i]=d[i*4+3];
   for(let y=1;y<h-1;y++){
    for(let x=1;x<w-1;x++){
     const i=y*w+x;if(!alphaCopy[i])continue;
     if(!alphaCopy[i-1]||!alphaCopy[i+1]||!alphaCopy[i-w]||!alphaCopy[i+w]){
      const lum=d[i*4]+d[i*4+1]+d[i*4+2];
      if(lum<blackSum*2){
       const keep=Math.max(0,Math.min(1,(lum-blackSum*0.75)/(blackSum*1.25)));
       d[i*4+3]=Math.round(alphaCopy[i]*keep);
      }
     }
    }
   }
   return imgData;
  };

  // Connected-component pocket removal: clears enclosed pure-black cutouts without eating navy ink fills.
  const clearEnclosedBlack=(imgData,maxSum=26,minArea=22)=>{
   const {width:w,height:h,data:d}=imgData;
   const vis=new Uint8Array(w*h),q=new Int32Array(w*h);
   const isBlack=i=>d[i*4+3]>0&&d[i*4]+d[i*4+1]+d[i*4+2]<=maxSum&&Math.max(d[i*4],d[i*4+1],d[i*4+2])<=13&&d[i*4+2]-d[i*4]<=5;
   for(let s=0;s<w*h;s++){
    if(vis[s]||!isBlack(s))continue;
    let head=0,tail=0;vis[s]=1;q[tail++]=s;
    while(head<tail){
     const i=q[head++],x=i%w,y=(i/w)|0;
     for(const n of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){
      if(n>=0&&!vis[n]&&isBlack(n)){vis[n]=1;q[tail++]=n;}
     }
    }
    if(tail>=minArea){
     for(let k=0;k<tail;k++)d[q[k]*4+3]=0;
    }
   }
   return imgData;
  };

  // Black-matte eradication & outward color bleed for borderless elements (clouds, foam crests).
  const decontaminateMatte=(imgData,blackCutoff=44,coreSum=330,coreMax=155,passes=10)=>{
   const {width:w,height:h,data:d}=imgData;
   const core=new Uint8Array(w*h);
   for(let i=0;i<w*h;i++){
    const idx=i*4;if(!d[idx+3])continue;
    const r=d[idx],g=d[idx+1],b=d[idx+2],m=Math.max(r,g,b),sum=r+g+b;
    if(m<=blackCutoff){d[idx+3]=0;continue;}
    if(sum>=coreSum&&m>=coreMax){core[i]=1;continue;}
    const t=Math.max(0,Math.min(1,(m-blackCutoff)/(coreMax-blackCutoff)));
    d[idx+3]=Math.round(Math.pow(t,0.75)*d[idx+3]);
   }
   // Propagate crisp core RGB outward so semi-transparent boundary pixels carry cloud/foam color instead of dark matte.
   for(let p=0;p<passes;p++){
    const nextCore=new Uint8Array(core);
    const snap=new Uint8ClampedArray(d);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
     const i=y*w+x;if(core[i])continue;
     let sr=0,sg=0,sb=0,cnt=0;
     for(const n of [i-1,i+1,i-w,i+w]){
      if(core[n]){sr+=snap[n*4];sg+=snap[n*4+1];sb+=snap[n*4+2];cnt++;}
     }
     if(cnt){
      d[i*4]=Math.round(sr/cnt);d[i*4+1]=Math.round(sg/cnt);d[i*4+2]=Math.round(sb/cnt);
      nextCore[i]=1;
     }
    }
    core.set(nextCore);
   }
   return imgData;
  };

  // Glow/additive VFX sheet conversion: smooth alpha from max RGB luminosity, zero muddy halo!
  const lumAlpha=(imgData,floor=14,ceil=150)=>{
   const {width:w,height:h,data:d}=imgData;
   for(let i=0;i<w*h;i++){
    const r=d[i*4],g=d[i*4+1],b=d[i*4+2],m=Math.max(r,g,b);
    if(m<=floor){d[i*4+3]=0;continue;}
    const t=Math.min(1,(m-floor)/(ceil-floor));
    const a=Math.pow(t,0.72);
    d[i*4+3]=Math.round(a*255);
    d[i*4]=Math.min(255,Math.round(r/Math.max(0.12,a)));
    d[i*4+1]=Math.min(255,Math.round(g/Math.max(0.12,a)));
    d[i*4+2]=Math.min(255,Math.round(b/Math.max(0.12,a)));
   }
   return imgData;
  };

  const bbox=(d,alphaMin=24)=>{
   const {width:w,height:h,data}=d;
   let minX=w,minY=h,maxX=-1,maxY=-1;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=alphaMin){
    if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
   }
   return maxX>=minX?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:null;
  };

  const packNine=(img,sx,sy,sw,sh,tw,th,padX=6,padY=3,blackSum=42)=>{
   const s=slice(img,sx,sy,sw,sh);
   floodAlpha(s.d,blackSum,false,24);s.x.putImageData(s.d,0,0);
   const b=bbox(s.d,24);
   const out=mk(tw,th);
   if(!b)return out.c.toDataURL('image/png');
   out.x.imageSmoothingQuality='high';
   out.x.drawImage(s.c,b.x,b.y,b.w,b.h,padX,padY,tw-padX*2,th-padY*2);
   return out.c.toDataURL('image/png');
  };

  const out={};

  // 1. Sky Panorama (clean sunlit clouds + distant horizon sun + 2.5D perspective-projected Stage 1 ocean sprites)
  const skyImg=await load('/sky.jpg');
  const oceanImg=await load('/water.webp');
  const crestImg=await load('/pelagicWater.webp');
  {
   const W=1376,H=768;
   const base=slice(skyImg,0,0,W,H);
   const sd=base.d.data;
   // Detect true horizon line across open water on the right side (x=760..1240)
   let horizonY=488;
   {
    let bestY=488,bestDrop=-1;
    for(let y=455;y<525;y++){
     let lumAbove=0,lumBelow=0,cnt=0;
     for(let x=780;x<=1220;x+=8){
      const ia=((y-2)*W+x)*4,ib=((y+3)*W+x)*4;
      lumAbove+=sd[ia]+sd[ia+1]+sd[ia+2];
      lumBelow+=sd[ib]+sd[ib+1]+sd[ib+2];
      cnt++;
     }
     const drop=(lumAbove-lumBelow)/cnt;
     if(drop>bestDrop){bestDrop=drop;bestY=y;}
    }
    horizonY=bestY;
   }

   // Build monotonic smooth cloudless clear-sky reference from unobstructed open-sky column x=740..795
   // with broad vertical smoothing so no drifting cloud sliver stains any horizontal band.
   const skyRowR=new Float32Array(horizonY+10);
   const skyRowG=new Float32Array(horizonY+10);
   const skyRowB=new Float32Array(horizonY+10);
   for(let y=0;y<horizonY+10;y++){
    let sr=0,sg=0,sb=0,n=0;
    for(let x=740;x<=795;x+=3){
     const i=(y*W+x)*4,r=sd[i],g=sd[i+1],b=sd[i+2];
     if(b-r>=18){sr+=r;sg+=g;sb+=b;n++;}
    }
    if(n===0){const i=(y*W+760)*4;sr=sd[i];sg=sd[i+1];sb=sd[i+2];n=1;}
    skyRowR[y]=sr/n;skyRowG[y]=sg/n;skyRowB[y]=sb/n;
   }
   for(let pass=0;pass<6;pass++){
    const nr=new Float32Array(skyRowR),ng=new Float32Array(skyRowG),nb=new Float32Array(skyRowB);
    for(let y=1;y<horizonY+9;y++){
     nr[y]=(skyRowR[y-1]+skyRowR[y]*2+skyRowR[y+1])/4;
     ng[y]=(skyRowG[y-1]+skyRowG[y]*2+skyRowG[y+1])/4;
     nb[y]=(skyRowB[y-1]+skyRowB[y]*2+skyRowB[y+1])/4;
    }
    skyRowR.set(nr);skyRowG.set(ng);skyRowB.set(nb);
   }

   // Erase old oversized close sun + full warm glow halo around ~(962, 198) cleanly
   const oldSunX=962,oldSunY=198,eraseInner=96,eraseOuter=215;
   for(let y=0;y<horizonY;y++){
    const refR=skyRowR[y],refG=skyRowG[y],refB=skyRowB[y];
    for(let x=Math.max(0,oldSunX-eraseOuter);x<Math.min(W,oldSunX+eraseOuter);x++){
     const dist=Math.hypot(x-oldSunX,y-oldSunY);
     if(dist>=eraseOuter)continue;
     const i=(y*W+x)*4,r=sd[i],g=sd[i+1],b=sd[i+2];
     const cloudProt=(x>1035&&y>225)?Math.max(0,Math.min(1,((g-refG)-(r-refR)*.65)/22))*0.96:0;
     const t=Math.max(0,Math.min(1,(dist-eraseInner)/(eraseOuter-eraseInner)));
     const smoothK=(1-(t*t*(3-2*t)))*(1-cloudProt);
     const isSunWarm=(r-refR)>(b-refB)*0.5+1.5||dist<eraseInner+10;
     const k=isSunWarm?smoothK:smoothK*0.65;
     sd[i]=Math.round(r+(refR-r)*k);
     sd[i+1]=Math.round(g+(refG-g)*k);
     sd[i+2]=Math.round(b+(refB-b)*k);
    }
   }

   // Paint small, delicate, truly distant sun high in the upper-right horizon distance (~x=1032, y=126)
   const newSunX=1032,newSunY=126,sunCoreR=11,haloR=92;
   for(let y=Math.max(0,Math.floor(newSunY-haloR));y<Math.min(horizonY,Math.ceil(newSunY+haloR));y++){
    for(let x=Math.max(0,Math.floor(newSunX-haloR));x<Math.min(W,Math.ceil(newSunX+haloR));x++){
     const d=Math.hypot(x-newSunX,y-newSunY);
     if(d>=haloR)continue;
     const i=(y*W+x)*4;
     const halo=Math.pow(1-d/haloR,2.8)*.17;
     let r=sd[i]*(1-halo)+255*halo;
     let g=sd[i+1]*(1-halo)+247*halo;
     let b=sd[i+2]*(1-halo)+216*halo;
     if(d<sunCoreR+14){
      const corona=Math.pow(Math.max(0,1-d/(sunCoreR+14)),2.4)*.38;
      r=r*(1-corona)+255*corona;
      g=g*(1-corona)+250*corona;
      b=b*(1-corona)+222*corona;
     }
     if(d<sunCoreR+1.4){
      const disc=Math.max(0,Math.min(1,(sunCoreR+1.4-d)/2.0));
      const rim=Math.min(1,d/sunCoreR);
      const cr=255,cg=253-rim*13,cb=240-rim*44;
      r=r*(1-disc)+cr*disc;
      g=g*(1-disc)+cg*disc;
      b=b*(1-disc)+cb*disc;
     }
     sd[i]=Math.min(255,Math.round(r));
     sd[i+1]=Math.min(255,Math.round(g));
     sd[i+2]=Math.min(255,Math.round(b));
    }
   }

   // Build 4-level mipmap pyramids for crisp alias-free 2.5D ocean sampling
   const makeMips=img=>{
    const mips=[];let cw=img.width,ch=img.height;
    let cur=slice(img,0,0,cw,ch);mips.push({w:cw,h:ch,d:cur.d.data});
    while(cw>64){
     const nw=cw>>1,nh=ch>>1,nxt=mk(nw,nh);
     nxt.x.imageSmoothingEnabled=true;nxt.x.imageSmoothingQuality='high';
     nxt.x.drawImage(cur.c,0,0,cw,ch,0,0,nw,nh);
     const id=nxt.x.getImageData(0,0,nw,nh);
     mips.push({w:nw,h:nh,d:id.data});
     cur=nxt;cw=nw;ch=nh;
    }
    return mips;
   };
   const waterMips=makeMips(oceanImg);
   const crestMips=makeMips(crestImg);

   const sampleMip=(mips,u,v,lod)=>{
    const maxL=mips.length-1;
    const lClamped=Math.max(0,Math.min(maxL,lod));
    const l0=Math.floor(lClamped),l1=Math.min(maxL,l0+1),lf=lClamped-l0;
    const sample1=(m)=>{
     const w=m.w,h=m.h,d=m.d;
     const fu=((u%1)+1)%1*w,fv=((v%1)+1)%1*h;
     const x0=Math.floor(fu)%w,y0=Math.floor(fv)%h,x1=(x0+1)%w,y1=(y0+1)%h;
     const fx=fu-Math.floor(fu),fy=fv-Math.floor(fv);
     const i00=(y0*w+x0)*4,i10=(y0*w+x1)*4,i01=(y1*w+x0)*4,i11=(y1*w+x1)*4;
     const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
     return [
      d[i00]*w00+d[i10]*w10+d[i01]*w01+d[i11]*w11,
      d[i00+1]*w00+d[i10+1]*w10+d[i01+1]*w01+d[i11+1]*w11,
      d[i00+2]*w00+d[i10+2]*w10+d[i01+2]*w01+d[i11+2]*w11,
     ];
    };
    const a=sample1(mips[l0]);
    if(lf<=.01)return a;
    const b=sample1(mips[l1]);
    return [a[0]+(b[0]-a[0])*lf,a[1]+(b[1]-a[1])*lf,a[2]+(b[2]-a[2])*lf];
   };

   // Render 2.5D perspective-projected Stage 1 ocean below horizonY
   const seaH=H-horizonY;
   for(let y=horizonY;y<H;y++){
    const dy=(y-horizonY)+5.0;
    const tNorm=(y-horizonY)/Math.max(1,seaH-1);
    // Perspective ground-plane inverse depth: dense distant swells -> spacious readable foreground sprite waves
    const depthZ=132/Math.pow(dy,0.86);
    const vCoord=depthZ*0.60+0.12;
    const duPerPx=depthZ*0.00205;
    const lod=Math.max(0,Math.log2(Math.max(1,duPerPx*1024)));
    const horizonMist=Math.exp(-tNorm*8.6);
    const mistR=142,mistG=227,mistB=253;
    const sparkleRowSpread=16+tNorm*74;

    for(let x=0;x<W;x++){
     const i=(y*W+x)*4;
     const swellWarp=Math.sin(x*0.0085+dy*0.045)*0.025;
     const worldX=(x-W*0.5)*duPerPx+swellWarp;
     const [wr,wg,wb]=sampleMip(waterMips,worldX+0.5,vCoord,lod);
     const [cr,cg,cb]=sampleMip(crestMips,worldX*1.28+0.21,vCoord*1.12+0.38,lod+0.35);

     // Blend Stage 1 water facets + crisp royal-blue anime wave crests
     let r=wr*0.74+cr*0.26;
     let g=wg*0.72+cg*0.28;
     let b=wb*0.70+cb*0.30;

     // Enhance cerulean-to-emerald foreground translucency & crisp mid-distance cobalt contrast
     const midDepth=Math.sin(tNorm*Math.PI);
     r=r*(0.84+tNorm*0.18)-midDepth*7;
     g=g*(0.96+tNorm*0.22)+midDepth*5;
     b=b*(1.02+tNorm*0.10)+midDepth*14;

     // Amplify crisp glittering water highlights along natural wave crests
     const crestVal=Math.max(0,(wr+wg*1.25-210)/155);
     if(crestVal>0.05){
      const boost=crestVal*crestVal*(0.42+0.48*tNorm);
      r+=boost*118;g+=boost*152;b+=boost*140;
     }

     // Delicate sunlit water sparkle path under the small distant sun (~x=1026)
     const dxSun=Math.abs(x-newSunX);
     if(dxSun<sparkleRowSpread*1.8){
      const sunCol=Math.exp(-Math.pow(dxSun/sparkleRowSpread,1.8));
      const wavePeak=Math.max(0,Math.min(1,(wg+wb*0.8-226)/125));
      const glint=sunCol*(0.18+0.78*Math.pow(wavePeak,1.65))*(1-tNorm*0.35);
      r+=glint*125;g+=glint*112;b+=glint*64;
     }

     const seamSoft=y<horizonY+4?(1-(y-horizonY)/4)*0.36:0;
     const mistAmt=Math.min(0.84,horizonMist*0.58+seamSoft);
     r=r*(1-mistAmt)+mistR*mistAmt;
     g=g*(1-mistAmt)+mistG*mistAmt;
     b=b*(1-mistAmt)+mistB*mistAmt;

     if(x<575&&y<horizonY+10){
      const keepIsl=Math.max(0,1-(y-horizonY)/10)*0.48;
      r=r*(1-keepIsl)+sd[i]*keepIsl;
      g=g*(1-keepIsl)+sd[i+1]*keepIsl;
      b=b*(1-keepIsl)+sd[i+2]*keepIsl;
     }

     sd[i]=Math.max(0,Math.min(255,Math.round(r)));
     sd[i+1]=Math.max(0,Math.min(255,Math.round(g)));
     sd[i+2]=Math.max(0,Math.min(255,Math.round(b)));
    }
   }

   base.x.putImageData(base.d,0,0);
   out['sky-panorama']=base.c.toDataURL('image/png');
  }

  // 3. Logo Arcade: Ultra-clean anti-aliased extraction protecting 100% of dark navy borders + 2px smooth navy silhouette halo
  //    Downsampled in 2 steps to 820px width (~native gameplay HUD & menu DPI) to eliminate WebGL minification shimmer!
  const logoImg=await load('/logo.jpg');
  {
   const s=slice(logoImg,0,0,1376,768);
   floodAlpha(s.d,16,false);
   clearEnclosedBlack(s.d,16,18);
   const {width:lw,height:lh,data:ld}=s.d;
   // Prune tiny isolated compression specks (<60 connected opaque pixels)
   {
    const vis=new Uint8Array(lw*lh),q=new Int32Array(lw*lh);
    for(let p=0;p<lw*lh;p++){
     if(vis[p]||ld[p*4+3]<24)continue;
     let hd=0,tl=0;vis[p]=1;q[tl++]=p;
     while(hd<tl){
      const cur=q[hd++],cx=cur%lw,cy=(cur/lw)|0;
      for(const n of [cx>0?cur-1:-1,cx<lw-1?cur+1:-1,cy>0?cur-lw:-1,cy<lh-1?cur+lw:-1]){
       if(n>=0&&!vis[n]&&ld[n*4+3]>=24){vis[n]=1;q[tl++]=n;}
      }
     }
     if(tl<60)for(let k=0;k<tl;k++)ld[q[k]*4+3]=0;
    }
   }
   const a0=new Uint8Array(lw*lh);
   for(let i=0;i<lw*lh;i++)a0[i]=ld[i*4+3];
   // Anti-alias matte recovery ONLY along black-halo transitions outside bright rims (protecting rich blue navy outlines)
   for(let y=1;y<lh-1;y++)for(let x=1;x<lw-1;x++){
    const i=y*lw+x;if(!a0[i])continue;
    if(!a0[i-1]||!a0[i+1]||!a0[i-lw]||!a0[i+lw]){
     const r=ld[i*4],g=ld[i*4+1],b=ld[i*4+2],mx=Math.max(r,g,b);
     let br=0,bg=0,bb=0,bCnt=0;
     for(const n of [i-1,i+1,i-lw,i+lw,i-lw-1,i-lw+1,i+lw-1,i+lw+1]){
      if(a0[n]){
       const nr=ld[n*4],ng=ld[n*4+1],nb=ld[n*4+2];
       if(Math.max(nr,ng,nb)>145){br+=nr;bg+=ng;bb+=nb;bCnt++;}
      }
     }
     if(bCnt>0&&(b-r)<14&&mx<130){
      const cov=Math.max(0.08,Math.min(1,(mx-10)/120));
      ld[i*4]=Math.round(br/bCnt);ld[i*4+1]=Math.round(bg/bCnt);ld[i*4+2]=Math.round(bb/bCnt);
      ld[i*4+3]=Math.round(cov*255);
     }else if((b-r)>=14&&mx<45){
      const cov=Math.max(0.25,Math.min(1,(mx-8)/36));
      ld[i*4+3]=Math.round(cov*255);
     }
    }
   }
   s.x.putImageData(s.d,0,0);
   const b=bbox(s.d,24);
   const pad=18,rawW=(b?b.w:1125)+pad*2,rawH=(b?b.h:611)+pad*2;
   // Step 1: Composite clean silhouette with subtle smooth #04153e navy drop-contour so bright cyan borders stay razor crisp over clouds
   const full=mk(rawW,rawH);
   if(b){
    full.x.save();
    full.x.shadowColor='rgba(4,21,62,0.96)';
    full.x.shadowBlur=4;
    for(const [dx,dy] of [[-1.5,0],[1.5,0],[0,-1.5],[0,1.5]]){
     full.x.drawImage(s.c,b.x,b.y,b.w,b.h,pad+dx,pad+dy,b.w,b.h);
    }
    full.x.restore();
    full.x.imageSmoothingQuality='high';
    full.x.drawImage(s.c,b.x,b.y,b.w,b.h,pad,pad,b.w,b.h);
   }
   // Step 2: 2-stage Skia bicubic downscale to 820px width (~0.8x at 768p, ~1.12x at 1080p) -> zero broken WebGL outlines
   const targetW=820,targetH=Math.round(rawH*(targetW/rawW));
   const mid=mk(Math.round((rawW+targetW)/2),Math.round((rawH+targetH)/2));
   mid.x.imageSmoothingQuality='high';mid.x.drawImage(full.c,0,0,mid.c.width,mid.c.height);
   const final=mk(targetW,targetH);
   final.x.imageSmoothingQuality='high';final.x.drawImage(mid.c,0,0,targetW,targetH);
   out['logo-arcade']=final.c.toDataURL('image/png');
  }

  // 3b. Pixel-Locked Triple-Nozzle RIVET Cruise Spritesheet (1024x256, 4 frames):
  //     Aligns Frame 7 onto Frame 4 by exact -8px shift so wing/canopy/nose never flickers while all 3 nozzles pulse cleanly!
  const rivetImg=await load('/rivet.webp');
  {
   const f4C=slice(rivetImg,0,256,256,256);
   const f7Raw=slice(rivetImg,768,256,256,256);
   const f7Al=mk(256,256);
   f7Al.x.drawImage(f7Raw.c,-8,0);
   const f4=f4C.d.data,f7=f7Al.x.getImageData(0,0,256,256).data;
   const strip=mk(1024,256);
   const weights=[0.0,0.48,1.0,0.52];
   for(let frame=0;frame<4;frame++){
    const w=weights[frame];
    const cell=mk(256,256),id=cell.x.createImageData(256,256),od=id.data;
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
     const i=(y*256+x)*4;
     // Only blend inside the triple exhaust region (x <= 54 behind nozzle rings, or flame-glow extenders x <= 68)
     const r4=f4[i],g4=f4[i+1],b4=f4[i+2],a4=f4[i+3];
     const r7=f7[i],g7=f7[i+1],b7=f7[i+2],a7=f7[i+3];
     const isFlamePixel=(x<54)||((x<70)&&((r4>170&&r4-b4>45)||(r7>170&&r7-b7>45)));
     if(!isFlamePixel){
      od[i]=r4;od[i+1]=g4;od[i+2]=b4;od[i+3]=a4;
     }else{
      // Premultiplied clean blend so thruster alpha never darkens mid-animation
      const p4=a4/255,p7=a7/255,a=p4*(1-w)+p7*w;
      if(a<0.04){od[i]=od[i+1]=od[i+2]=od[i+3]=0;continue;}
      od[i]=Math.round((r4*p4*(1-w)+r7*p7*w)/a);
      od[i+1]=Math.round((g4*p4*(1-w)+g7*p7*w)/a);
      od[i+2]=Math.round((b4*p4*(1-w)+b7*p7*w)/a);
      od[i+3]=Math.round(a*255);
     }
    }
    cell.x.putImageData(id,0,0);
    strip.x.drawImage(cell.c,frame*256,0);
   }
   out['rivet-cruise']=strip.c.toDataURL('image/png');
  }

  // 3c. Animated Squadron Wingmen Spritesheet (1024x1024, 4x4 of 256x256 from enemies.webp row 3):
  //     Animates spinning propeller discs/blade glints on prop aircraft (8,10,11 — including dual props on 11)
  //     and flush rear exhaust plume at true engine nozzle (x=229, y=141.5) on yellow jet (9).
  const enImg=await load('/enemies.webp');
  {
   const sheet=mk(1024,1024);
   const propColor=(r,g,b,isBomber)=>r>175&&g>(isBomber?145:135)&&b<120;
   for(let row=0;row<4;row++){
    const base=slice(enImg,row*256,512,256,256);
    const bd=base.d.data;
    const zones=row===3?[[0,52],[52,92]]:row===1?[]:[[0,60]];
    const props=zones.map(([xLo,xHi])=>{
     let pxMin=256,pxMax=0,pyMin=256,pyMax=0,pCnt=0;
     for(let y=0;y<256;y++)for(let x=xLo;x<xHi;x++){
      const i=(y*256+x)*4;if(bd[i+3]<40)continue;
      if(propColor(bd[i],bd[i+1],bd[i+2],row===3)){
       if(x<pxMin)pxMin=x;if(x>pxMax)pxMax=x;if(y<pyMin)pyMin=y;if(y>pyMax)pyMax=y;pCnt++;
      }
     }
     return pCnt?{cx:(pxMin+pxMax)/2,cy:(pyMin+pyMax)/2,rh:Math.max(12,(pyMax-pyMin)/2)}:null;
    }).filter(Boolean);
    for(let col=0;col<4;col++){
     const cell=mk(256,256);
     cell.x.drawImage(base.c,0,0);
     const ctx=cell.x;
     if(row===1){
      // Yellow jet rear exhaust anchored flush inside engine nozzle (x=224..232, y=141.5) under destination-over
      const len=[22,32,26,36][col],nx=224,ey=141.5;
      ctx.save();
      ctx.globalCompositeOperation='destination-over';
      const jg=ctx.createLinearGradient(nx,ey,nx+len,ey);
      jg.addColorStop(0,'rgba(255,254,212,0.98)');
      jg.addColorStop(0.45,'rgba(255,176,42,0.88)');
      jg.addColorStop(1,'rgba(255,96,12,0)');
      ctx.fillStyle=jg;
      ctx.beginPath();ctx.moveTo(nx,ey-6.5);ctx.lineTo(nx+len,ey);ctx.lineTo(nx,ey+6.5);ctx.closePath();ctx.fill();
      ctx.restore();
     }else{
      props.forEach((p,pIdx)=>{
       const f=(col+pIdx*2)%4;
       const a=[0.22,0.46,0.18,0.52][f],ang=[0.1,0.55,-0.25,0.85][f];
       ctx.save();ctx.translate(p.cx,p.cy);
       ctx.fillStyle=`rgba(235,248,255,${a})`;
       ctx.beginPath();ctx.ellipse(0,0,4.5,p.rh*1.12,0,0,Math.PI*2);ctx.fill();
       ctx.strokeStyle=`rgba(255,232,102,${a+0.28})`;ctx.lineWidth=2.6;
       ctx.beginPath();ctx.moveTo(-Math.sin(ang)*5,-p.rh*Math.cos(ang));ctx.lineTo(Math.sin(ang)*5,p.rh*Math.cos(ang));ctx.stroke();
       ctx.restore();
      });
     }
     sheet.x.drawImage(cell.c,col*256,row*256);
    }
   }
   out['wingmen-anim']=sheet.c.toDataURL('image/png');
  }

  // 4. Menu VFX Spritesheet (4x4 grid of 256x256): preserved for UI highlights/confetti/effects if needed
  const abImg=await load('/afterburner.jpg'),vfxA=await load('/vfxA.jpg'),vfxB=await load('/vfxB.jpg');
  {
   const sheet=mk(1024,1024);
   const abCells=[];
   let abMaxW=1,abMaxH=1;
   for(let i=0;i<4;i++){
    const sx=(i%2)*512,sy=Math.floor(i/2)*512;
    const s=slice(abImg,sx,sy,512,512);
    lumAlpha(s.d,12,135);s.x.putImageData(s.d,0,0);
    const b=bbox(s.d,16);
    abCells.push({s,b});
    if(b){abMaxW=Math.max(abMaxW,b.w);abMaxH=Math.max(abMaxH,b.h);}
   }
   const abScale=Math.min(206/abMaxW,176/abMaxH);
   for(let c=0;c<4;c++){
    const {s,b}=abCells[c];if(!b)continue;
    const dw=b.w*abScale,dh=b.h*abScale;
    sheet.x.imageSmoothingQuality='high';
    sheet.x.drawImage(s.c,b.x,b.y,b.w,b.h,c*256+236-dw,(256-dh)/2,dw,dh);
   }
   for(let r=1;r<4;r++){
    const srcImg=r<2?vfxA:vfxB;
    for(let c=0;c<4;c++){
     const s=slice(srcImg,c*256,r*256,256,256);
     lumAlpha(s.d,16,140);s.x.putImageData(s.d,0,0);
     sheet.x.drawImage(s.c,c*256,r*256);
    }
   }
   out['vfx-sheet']=sheet.c.toDataURL('image/png');
  }

  // 5. NineSlice Panels & Buttons from frames sheet (exact outer alignment between cobalt/gold and idle/focus)
  const frImg=await load('/frames.jpg');
  out['panel-cobalt']=packNine(frImg,0,0,512,512,256,256,3,3,42);
  out['panel-gold']=packNine(frImg,512,0,512,512,256,256,3,3,42);
  out['btn-idle']=packNine(frImg,0,512,512,512,384,96,6,3,42);
  out['btn-focus']=packNine(frImg,512,512,512,512,384,96,6,3,42);

  // 6. Ribbons, Gauge Tray (wide TL..BL 0..645!) & 4 Pips cleanly cropped from BR (655..1024)
  const rbImg=await load('/ribbons.jpg');
  out['ribbon-gold']=packNine(rbImg,0,0,505,500,384,96,6,3,42);
  out['ribbon-red']=packNine(rbImg,505,0,519,500,384,96,6,3,42);
  out['gauge-tray']=packNine(rbImg,0,512,645,512,384,96,4,3,42);
  {
   const pips=mk(256,64);
   const boxes=[[655,575,155,174],[822,575,190,174],[655,768,155,168],[822,768,190,168]];
   for(let i=0;i<4;i++){
    const [bx,by,bw,bh]=boxes[i];
    const s=slice(rbImg,bx,by,bw,bh);
    floodAlpha(s.d,52,false);s.x.putImageData(s.d,0,0);
    const b=bbox(s.d,24);if(!b)continue;
    const sc=Math.min(50/b.w,54/b.h),dw=b.w*sc,dh=b.h*sc;
    pips.x.imageSmoothingQuality='high';
    pips.x.drawImage(s.c,b.x,b.y,b.w,b.h,i*64+(64-dw)/2,(64-dh)/2,dw,dh);
   }
   out['pips']=pips.c.toDataURL('image/png');
  }

  // 7. 4x4 Icons Sheet (tight-centered per 256x256 cell, clean alpha & shackle/crest cutouts)
  const icImg=await load('/icons.jpg');
  {
   const sheet=mk(1024,1024);
   for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    const s=slice(icImg,c*256,r*256,256,256);
    const seedHoles=(r===1&&c===0)||(r===3&&c===2);
    floodAlpha(s.d,58,seedHoles,22);s.x.putImageData(s.d,0,0);
    const b=bbox(s.d,24);if(!b)continue;
    const sc=Math.min(224/b.w,224/b.h),dw=b.w*sc,dh=b.h*sc;
    sheet.x.imageSmoothingQuality='high';
    sheet.x.drawImage(s.c,b.x,b.y,b.w,b.h,c*256+(256-dw)/2,r*256+(256-dh)/2,dw,dh);
   }
   out['icons']=sheet.c.toDataURL('image/png');
  }

  // 8. Route 01 Fenda Pelágica Card Preview: direct crisp crop from gameplay coast-harbor map (lighthouse cliff, cove boat & sea strait)
  const harborImg=await load('/coastHarbor.png');
  {
   const card=mk(256,256);
   card.x.imageSmoothingQuality='high';
   card.x.drawImage(harborImg,0,430,724,724,0,0,256,256);
   out['route-pelagic']=card.c.toDataURL('image/png');
  }

  return out;
 });

 for(const [name,dataUrl]of Object.entries(results)){
  const isLossless=['logo-arcade','rivet-cruise','wingmen-anim','route-pelagic','sky-panorama'].includes(name);
  saveWebp(dataUrl,name,isLossless,name.startsWith('panel-')||name.startsWith('btn-')||name.startsWith('ribbon-')?96:94);
 }
}finally{
 socket?.close();chrome.kill();server.close();
 await sleep(200);
 try{rmSync(TMP,{recursive:true,force:true});}catch{/* Windows file lock */}
 try{rmSync(profile,{recursive:true,force:true});}catch{/* Windows file lock */}
}
