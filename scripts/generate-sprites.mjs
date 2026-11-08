// Hand-authored, deterministic pixel-art sheets for BULLET WAKE.

// Run: node scripts/generate-sprites.mjs

import { writeFileSync, mkdirSync } from 'node:fs';

import { dirname } from 'node:path';

const PAL = ["#000000","#121b28","#263447","#405669","#809baa","#dceef5","#54dade","#affaf4","#233d51","#547f91","#b5c7d3","#7ad9d2","#303640","#57636d","#b4774c","#f8c078","#522a3d","#b14a56","#e96b69","#ffb0a6","#382d55","#685278","#b96da0","#ffd89c","#4f566d","#797c94","#f48d61","#fff0b6","#163854","#354a77","#3487aa","#6f3848","#35293b","#99565c","#e98775","#283e45","#7299a0","#b5ffff"];

function cvs(w,h){return {w,h,d:new Uint8Array(w*h)}}

function pix(c,x,y,k){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<c.w&&y<c.h)c.d[y*c.w+x]=k}

function rect(c,x,y,w,h,k){for(let yy=Math.round(y);yy<y+h;yy++)for(let xx=Math.round(x);xx<x+w;xx++)pix(c,xx,yy,k)}

function poly(c,points,k){
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.max(0,Math.floor(Math.min(...xs))),maxX=Math.min(c.w-1,Math.ceil(Math.max(...xs)));
 const minY=Math.max(0,Math.floor(Math.min(...ys))),maxY=Math.min(c.h-1,Math.ceil(Math.max(...ys)));
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[i],b=points[j];
   if((a[1]>y+.5)!==(b[1]>y+.5)&&x+.5 < (b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  if(inside)pix(c,x,y,k);
 }
}

function line(c,x1,y1,x2,y2,k){
 x1=Math.round(x1);y1=Math.round(y1);x2=Math.round(x2);y2=Math.round(y2);
 let dx=Math.abs(x2-x1),sx=x1<x2?1:-1,dy=-Math.abs(y2-y1),sy=y1<y2?1:-1,err=dx+dy;
 while(true){pix(c,x1,y1,k);if(x1===x2&&y1===y2)break;let e=2*err;if(e>=dy){err+=dy;x1+=sx}if(e<=dx){err+=dx;y1+=sy}}
}

function ellipse(c,cx,cy,rx,ry,k){
 for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
  if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)pix(c,x,y,k);
 }
}

function scatter(c, cx,cy, stage, seed, palette){
 const n=6+stage*3;
 for(let i=0;i<n;i++){
  const a=(i*2.399+seed*.44);
  const r=(stage*1.2)+(i%5)*1.7;
  const x=cx+Math.round(Math.cos(a)*r),y=cy+Math.round(Math.sin(a)*r*.75);
  rect(c,x,y,i%4===0?2:1,i%3===0?2:1,palette[(i+stage)%palette.length]);
 }
}

function shipFrame(c,ship,f){
 const kind=f<4?"idle":f<7?"up":f<10?"down":f<12?"hit":"death";
 const phase=kind==="idle"?f:kind==="up"?f-4:kind==="down"?f-7:kind==="hit"?f-10:f-12;
 const tilt=kind==="up"?(-1-phase):kind==="down"?(1+phase):0;
 const Y=(x,y)=>y+Math.round((x-24)*tilt/30);
 const P=(pts,k)=>poly(c,pts.map(v=>[v[0],Y(v[0],v[1])]),k);
 const L=(a,b,d,e,k)=>line(c,a,Y(a,b),d,Y(d,e),k);
 const B=(x,y,w,h,k)=>rect(c,x,Y(x,y),w,h,k);
 if(kind==="death"){
  if(phase<3){
   shipFrame(c,ship,phase%2);
   scatter(c,24,12,phase+1,ship, [27,26,5,7]);
   return;
  }
  const p=phase-2;
  scatter(c,24,12,p+2,ship,[26,27,5,6,15,19]);
  if(phase<6){ellipse(c,24,12,Math.min(17,phase*3),Math.min(10,phase*2),phase%2?26:27);ellipse(c,24,12,Math.max(1,phase),Math.max(1,phase/2),28)}
  return;
 }
 const hit=kind==="hit";
 if(ship===0){ // RIVET compact, double-engine arrow.
  P([[6,9],[11,7],[23,7],[29,8],[36,9],[45,12],[37,15],[26,17],[11,17],[6,14]],1);
  P([[9,9],[15,8],[28,8],[38,11],[43,12],[37,13],[26,15],[11,15]],2);
  P([[14,8],[20,4],[27,4],[31,9],[23,10]],3);
  P([[14,16],[20,20],[27,20],[31,15],[23,14]],3);
  P([[19,6],[24,5],[27,5],[30,8]],4);
  P([[19,18],[24,19],[27,19],[30,16]],4);
  P([[25,8],[31,8],[37,11],[28,11]],4);
  P([[26,9],[32,9],[35,11],[28,11]],29);
  B(29,9,3,1,7);
  L(11,12,24,12,4); L(33,13,40,12,5);
  B(15,10,2,1,6);B(19,10,2,1,6);
  B(7,9,4,3,13);B(7,13,4,3,13);
  B(5-(phase%2),10,4+(phase%2),2,phase%2?7:6);
  B(5-(phase%2),14,4+(phase%2),2,phase%2?6:7);
  B(2-(phase%2),10,2,1,31);B(2-(phase%2),15,2,1,31);
  B(41,11,4,1,5);
 }else if(ship===1){ // MOTH needle, negative-space tail and narrow profile.
  P([[3,5],[9,3],[15,7],[24,8],[35,9],[47,12],[35,15],[23,16],[15,17],[9,21],[3,19],[10,13],[10,11]],1);
  P([[6,5],[12,7],[24,9],[35,10],[45,12],[34,14],[23,15],[12,17],[6,19],[14,13],[14,11]],8);
  P([[14,9],[25,8],[33,10],[38,12],[29,13],[14,13]],9);
  P([[10,5],[15,7],[23,8],[19,10]],10);
  P([[10,19],[15,17],[23,16],[19,14]],10);
  B(17,11,18,1,11);B(24,9,5,2,30);
  L(33,12,44,12,5);
  B(4,4,4,2,11);B(4,18,4,2,11);
  B(9,11,5,2,1);
  B(2-(phase%3),11,8+(phase%3),2,phase%2?7:11);
  B(0,11,2,1,30);
  B(42,11,4,1,7);
 }else{ // KNUCKLE heavy industrial broadside gunship.
  P([[5,5],[12,3],[30,3],[35,6],[41,8],[42,16],[35,18],[30,21],[12,21],[5,19]],1);
  P([[8,5],[13,4],[30,4],[36,8],[39,9],[39,15],[35,17],[30,19],[13,20],[8,18]],12);
  P([[15,5],[31,5],[37,9],[21,10],[14,8]],13);
  P([[15,19],[31,19],[37,15],[21,14],[14,16]],13);
  rect(c,12,Y(12,9),24,6,14);
  B(24,10,14,4,13);
  B(33,9,8,6,15);
  B(37,10,7,4,16);
  B(42,11,4,2,27);
  B(13,6,5,2,4);B(13,16,5,2,4);
  B(21,7,5,1,15);B(21,16,5,1,15);
  B(10,10,5,4,1);
  B(5-(phase%2),7,5+(phase%2),4,phase%2?16:26);
  B(5-(phase%2),13,5+(phase%2),4,phase%2?26:16);
  B(2-(phase%2),8,3,2,15);B(2-(phase%2),14,3,2,15);
  B(30,6,3,2,4);
 }
 if(hit){
  const mask=(phase===0)?5:27;
  P([[19,10],[29,9],[36,12],[28,14],[19,13]],mask);
  scatter(c,24,12,2,ship,[5,27,28]);
 }
}

function enemyFrame(c,kind,f){
 const isScout=kind==="scout";
 const idle=4, tele=3, hit=2, death=isScout?6:8;
 const state=f<idle?"fly":f<idle+tele?"warning":f<idle+tele+hit?"hit":"death";
 const phase=state==="fly"?f:state==="warning"?f-idle:state==="hit"?f-idle-tele:f-idle-tele-hit;
 const cx=isScout?12:20,cy=isScout?8:12;
 if(state==="death"){
  scatter(c,cx,cy,phase+1,isScout?5:9,[19,18,23,26,27,28]);
  if(phase<4){ellipse(c,cx,cy,3+phase*2,2+phase,phase%2?26:27);ellipse(c,cx,cy,Math.max(1,phase),1,28)}
  return;
 }
 if(isScout){
  poly(c,[[1,8],[7,3],[14,3],[19,5],[22,8],[19,11],[14,13],[7,13]],1);
  poly(c,[[3,8],[8,5],[14,5],[18,7],[20,8],[18,9],[14,11],[8,11]],16);
  poly(c,[[7,5],[11,1],[16,3],[17,5]],17);
  poly(c,[[7,11],[11,15],[16,13],[17,11]],17);
  line(c,4,8,12,8,18);rect(c,9,6,3,1,19);
  rect(c,17,7,5,2,f%2?26:23);
  rect(c,3,7,4,2,23);
 }else{
  poly(c,[[1,11],[8,6],[13,4],[29,4],[35,7],[39,11],[35,17],[29,20],[13,20],[8,16]],1);
  poly(c,[[4,11],[12,7],[29,7],[35,10],[37,11],[35,14],[29,17],[12,17]],20);
  poly(c,[[11,6],[19,1],[29,2],[30,6]],21);
  poly(c,[[11,18],[19,23],[29,22],[30,18]],21);
  rect(c,12,8,20,2,22);rect(c,12,14,20,2,22);
  rect(c,23,10,7,4,17);
  rect(c,5,10,7,3,18);
  rect(c,33,9,5,5,f%2?26:23);
  rect(c,18,5,6,1,23);
  rect(c,18,18,6,1,23);
 }
 if(state==="warning"){
  const glow=phase%2===0?28:19;
  rect(c,isScout?1:2,cy-2,isScout?4:5,4,glow);
  rect(c,isScout?7:15,cy-1,isScout?8:11,2,23);
  if(phase===2)line(c,isScout?1:2,cy-4,isScout?1:2,cy+4,28);
 }
 if(state==="hit"){
  rect(c,cx-4,cy-2,9,4,phase===0?28:19);
  scatter(c,cx,cy,2,phase,[28,27,19]);
 }
}

function projectileFrame(c,kind,f){
 const cy=Math.floor(c.h/2),cy1=cy-1;
 if(kind==="enemy"){
  ellipse(c,5,5,3+(f%2),3+(f%2),17);
  ellipse(c,5,5,2,2,f%2?27:19);rect(c,4,4,2,2,28);
  if(f%2===0){pix(c,1,5,18);pix(c,9,5,18)}
  pix(c,2+f,1,f%2?28:26);
  return;
 }
 const heavy=kind==="knuckle",moth=kind==="moth";
 const core=heavy?16:moth?7:6,shadow=heavy?15:moth?11:31;
 if(heavy){
  poly(c,[[0,3],[8,2],[15,5],[9,8],[0,7]],14);
  rect(c,2,3,10,4,shadow);rect(c,7,4,7,2,core);rect(c,12,4,3,2,28);
  rect(c,0,4,2+(f%2),2,26);
  pix(c,1+f,2,f%2?28:15);
 }else if(moth){
  poly(c,[[0,cy],[4,cy-2],[10,cy-1],[11,cy],[10,cy+1],[4,cy+2]],31);
  line(c,1,cy,11,cy,moth?7:6);
  pix(c,10,cy,5);pix(c,2+(f%3),cy-1,11);
 }else{
  rect(c,0,cy1,8,3,shadow);
  rect(c,4,cy1,8,3,core);
  rect(c,8,cy1,3,2,7);
  pix(c,f%4,cy-2,31);
 }
}

function effectFrame(c,kind,f){
 const cx=Math.floor(c.w/2),cy=Math.floor(c.h/2);
 if(kind==="muzzle"){
  poly(c,[[0,cy],[5,cy-4-(f%2)],[11+f,cy],[5,cy+4+(f%2)]],26);
  poly(c,[[1,cy],[6,cy-2],[11+f,cy],[6,cy+2]],28);
  line(c,2,cy,14,cy,7);pix(c,5,cy-6,6);pix(c,5,cy+6,6);
 }else if(kind==="hit"){
  const r=2+f*2;
  for(let i=0;i<8;i++){let a=i*Math.PI/4;line(c,cx+Math.round(Math.cos(a)*2),cy+Math.round(Math.sin(a)*2),cx+Math.round(Math.cos(a)*r),cy+Math.round(Math.sin(a)*r),i%2?27:7)}
  ellipse(c,cx,cy,Math.max(1,5-Math.floor(f/2)),Math.max(1,4-Math.floor(f/2)),f%2?28:5);
 }else if(kind==="explosion"){
  const r=2+Math.min(f,5)*2;
  if(f<6){
   ellipse(c,cx,cy,r,Math.max(1,Math.floor(r*.77)),f%2?26:18);
   ellipse(c,cx,cy,Math.max(1,r-3),Math.max(1,Math.floor((r-3)*.75)),f%2?27:19);
   ellipse(c,cx,cy,Math.max(1,r-6),Math.max(1,Math.floor((r-6)*.7)),28);
  }
  scatter(c,cx,cy,f+1,12,[26,27,28,19,23]);
 }else if(kind==="warning"){
  const r=3+f%3;
  line(c,cx-r,cy,cx+r,cy,f%2?19:28);line(c,cx,cy-r,cx,cy+r,f%2?23:28);
  rect(c,cx-1,cy-1,3,3,f%2?28:19);
  if(f===3){pix(c,cx-6,cy,18);pix(c,cx+6,cy,18)}
 }
}

function sheet(fw,fh,n,draw){
 const w=fw*n,h=fh,atlas=new Uint8Array(w*h);
 for(let f=0;f<n;f++){
  const c=cvs(fw,fh);draw(c,f);
  for(let y=0;y<fh;y++)atlas.set(c.d.subarray(y*fw,(y+1)*fw),y*w+f*fw);
 }
 return {w,h,data:atlas,frameWidth:fw,frameHeight:fh,frames:n};
}

function generateAssets(){
 const result={};
 const ships=["rivet","moth","knuckle"];
 ships.forEach((name,i)=>result[`public/assets/ships/${name}/flight.png`]=sheet(48,24,20,(c,f)=>shipFrame(c,i,f)));
 result["public/assets/enemies/scout.png"]=sheet(24,16,15,(c,f)=>enemyFrame(c,"scout",f));
 result["public/assets/enemies/lancer.png"]=sheet(40,24,17,(c,f)=>enemyFrame(c,"lancer",f));
 result["public/assets/projectiles/rivet.png"]=sheet(12,8,4,(c,f)=>projectileFrame(c,"rivet",f));
 result["public/assets/projectiles/moth.png"]=sheet(12,8,4,(c,f)=>projectileFrame(c,"moth",f));
 result["public/assets/projectiles/knuckle.png"]=sheet(16,10,4,(c,f)=>projectileFrame(c,"knuckle",f));
 result["public/assets/projectiles/enemy.png"]=sheet(10,10,4,(c,f)=>projectileFrame(c,"enemy",f));
 result["public/assets/fx/muzzle.png"]=sheet(16,16,4,(c,f)=>effectFrame(c,"muzzle",f));
 result["public/assets/fx/hit.png"]=sheet(16,16,6,(c,f)=>effectFrame(c,"hit",f));
 result["public/assets/fx/explosion.png"]=sheet(24,24,8,(c,f)=>effectFrame(c,"explosion",f));
 result["public/assets/fx/warning.png"]=sheet(16,16,4,(c,f)=>effectFrame(c,"warning",f));
 return result;
}

function u32be(n){return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]}

function crc32(arr){
 let crc=-1;
 for(const v of arr){crc^=v;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
 return (crc^(-1))>>>0;
}

function adler32(arr){let a=1,b=0;for(const v of arr){a=(a+v)%65521;b=(b+a)%65521}return ((b<<16)|a)>>>0}

function chunk(name,bytes){
 const t=Array.from(name).map(s=>s.charCodeAt(0));
 const arr=[...t,...bytes];
 return [...u32be(bytes.length),...arr,...u32be(crc32(arr))];
}

function zlibRawStore(bytes){
 let out=[0x78,0x01];
 for(let offset=0;offset<bytes.length;offset+=65535){
  const n=Math.min(65535,bytes.length-offset),last=offset+n===bytes.length;
  out.push(last?1:0,n&255,(n>>>8)&255,(~n)&255,((~n)>>>8)&255);
  for(let i=offset;i<offset+n;i++)out.push(bytes[i]);
 }
 out.push(...u32be(adler32(bytes)));
 return out;
}

function pngBytes(asset){
 const {w,h,data}=asset,raw=new Uint8Array((w+1)*h);
 for(let y=0;y<h;y++)raw.set(data.subarray(y*w,(y+1)*w),y*(w+1)+1);
 const plte=[];
 for(const h of PAL){plte.push(parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16))}
 const ihdr=[...u32be(w),...u32be(h),8,3,0,0,0]; // indexed PNG, 8 bits, alpha via tRNS
 return Uint8Array.from([
  137,80,78,71,13,10,26,10,
  ...chunk("IHDR",ihdr),
  ...chunk("PLTE",plte),
  ...chunk("tRNS",[0]),
  ...chunk("IDAT",zlibRawStore(raw)),
  ...chunk("IEND",[])
 ]);
}

function base64(arr){
 const abc="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
 let out="";
 for(let i=0;i<arr.length;i+=3){
  let a=arr[i],b=arr[i+1],c=arr[i+2];
  out+=abc[a>>>2]+abc[((a&3)<<4)|((b??0)>>>4)]
      +(i+1<arr.length?abc[((b&15)<<2)|((c??0)>>>6)]:"=")
      +(i+2<arr.length?abc[c&63]:"=");
 }
 return out;
}

const assets = generateAssets();

for (const [path,atlas] of Object.entries(assets)) {

  mkdirSync(dirname(path), { recursive: true });

  writeFileSync(path, pngBytes(atlas));

  console.log(path + ' (' + atlas.w + 'x' + atlas.h + ', ' + atlas.frames + ' frames)');

}
