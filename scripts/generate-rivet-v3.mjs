/**
 * BULLET WAKE — Rivet V3 sprite build, only Nolan Fitch.
 * Compact indexed source sampled from the original approved Rivet V3 concept.
 * Converts the source to alpha PNG spritesheets; builds separate weapon/FX sheets.
 * Source is palette-reduced for the first playable pass; artistic polish remains.
 * Node 22+, no external dependencies.
 */
import { inflateSync, deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const WIDTH=160, HEIGHT=110;
const INDEXED="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";
const PALETTE="AAAAABYZH/1ZHB7+WFpf/ho2R/4gTl39oaOj/trd3P6aJSX+EN7t/Qmu0OvaXVP+m2Nd/hgYG1oVlaT9HSAlnWeVnf4i2uAXEXCQ/tA0Mv7OrKb+Wufu/qfk5v4Ks82hXl5hG114h/4hx9RbpEsv/h63yl7///8DE2ttDMrHtv8=";
const indices=inflateSync(Buffer.from(INDEXED,'base64'));
const palette=Buffer.from(PALETTE,'base64');
if(indices.length!==WIDTH*HEIGHT || palette.length!==128)throw new Error('Rivet V3 source corrupted');
const rgba=Buffer.alloc(WIDTH*HEIGHT*4);
for(let i=0;i<indices.length;i++){
 const p=indices[i]*4;
 for(let c=0;c<4;c++)rgba[i*4+c]=palette[p+c];
}
const image=(w,h)=>({w,h,data:Buffer.alloc(w*h*4)});
function paint(im,x,y,r,g,b,a=255){
 x=Math.round(x); y=Math.round(y);
 if(x<0||y<0||x>=im.w||y>=im.h)return;
 const p=(y*im.w+x)*4;
 im.data[p]=r; im.data[p+1]=g; im.data[p+2]=b; im.data[p+3]=a;
}
function rect(im,x,y,w,h,col){
 for(let v=0;v<h;v++)for(let u=0;u<w;u++)paint(im,x+u,y+v,...col);
}
function line(im,x0,y0,x1,y1,col){
 const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)));
 for(let i=0;i<=n;i++)paint(im,x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,...col);
}
function ellipse(im,cx,cy,rx,ry,col){
 for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){
  if(((x-cx)/rx)**2+((y-cy)/ry)**2<=1)paint(im,x,y,...col);
 }
}
const C={cyan:[38,222,255,248],white:[222,248,255,255],blue:[24,104,248,220],
 gold:[255,202,106,242],red:[242,83,70,242],purple:[180,112,245,220],smoke:[74,92,118,205]};
function hull(pitch=0,bob=0,light=0){
 const im=image(WIDTH,HEIGHT),angle=pitch*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  let dx=x-80,dy=y-55-bob;
  let sx=Math.round(80+dx*c+dy*s),sy=Math.round(55-dx*s+dy*c);
  if(sx<0||sy<0||sx>=WIDTH||sy>=HEIGHT)continue;
  const from=(sy*WIDTH+sx)*4,to=(y*WIDTH+x)*4;
  for(let k=0;k<4;k++)im.data[to+k]=rgba[from+k];
 }
 // Secondary thrusters follow the rear of the armored hull.
 for(const offset of [-12,11]){
  const cy=57+offset+Math.round(bob/2);
  const n=5+(light%4)*4;
  for(let x=19-n;x<25;x++){
   const height=Math.max(1,Math.round((x-(19-n))/7));
   for(let y=cy-height;y<=cy+height;y++){
    if(x<19)paint(im,x,y,23,160+(light%3)*27,245,140+light%2*75);
   }
  }
  line(im,19-n+2,cy,26,cy,C.white);
 }
 return im;
}
function ship(state,frame){
 const flick=frame%4;
 if(state==='destruction'){
  const im=image(WIDTH,HEIGHT);
  const source=hull(0,0,flick);
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
   const from=(y*WIDTH+x)*4;
   if(source.data[from+3]<65)continue;
   const cell=(Math.floor(x/8)*7+Math.floor(y/9)*11+frame*3)%13;
   if(cell<frame)continue;
   const ox=Math.round((x-84)*(frame/33))+((cell%5)-2)*frame/3;
   const oy=Math.round((y-57)*(frame/28))+((cell%3)-1)*frame/3;
   paint(im,x+ox,y+oy,source.data[from],source.data[from+1],source.data[from+2],source.data[from+3]);
  }
  for(let j=0;j<frame*5;j++){
   const x=82+Math.cos(j*2.37+frame)*((j%5)+frame*2);
   const y=54+Math.sin(j*1.9+frame)*((j%4)+frame*2);
   paint(im,x,y,...(j%3?C.gold:C.cyan));
  }
  if(frame<5)ellipse(im,86,56,Math.max(1,frame*2),Math.max(1,frame),C.gold);
  return im;
 }
 const pitch=state==='climb'?[-2,-4,-7,-4][flick]:state==='dive'?[2,4,7,4][flick]:0;
 const im=hull(pitch,[-1,0,1,0][flick],flick);
 if(state==='fire'){
  ellipse(im,143,56,2+flick,2,C.gold);
  line(im,143,56,153+flick,56,C.white);
 }
 if(state==='missile_launch'){
  line(im,107,38,143+flick*3,34-flick,C.gold);
  ellipse(im,146+flick*2,34-flick,2,2,C.white);
 }
 if(state==='prism_charge'){
  for(const y of [38,75]){
   ellipse(im,113,y,3+flick*2,2+flick,C.purple);
   line(im,114,y,151,y+(y===38?-10:10),C.cyan);
  }
 }
 if(state==='hit'){
  for(let j=0;j<8;j++){
   const a=j*Math.PI/4;
   line(im,92+Math.cos(a)*3,45+Math.sin(a)*3,92+Math.cos(a)*(9+flick*3),45+Math.sin(a)*(9+flick*3),j%2?C.red:C.gold);
  }
 }
 return im;
}
function engine(f){
 const im=image(48,54),len=7+(f%4)*4;
 for(const cy of [16,39]){
  for(let x=47-len;x<46;x++){
   const spread=Math.max(1,Math.floor((x-(47-len))/4));
   for(let y=cy-spread;y<=cy+spread;y++)paint(im,x,y,25,168+(f%3)*22,251,177);
  }
  line(im,47-len+2,cy,47,cy,C.white);
 }return im;
}
function pulse(level,f){
 const im=image(64,24),h=level*2+1,n=24+level*9;
 for(let y=-h;y<=h;y++)line(im,9,12+y,9+n,12+y,y===0?C.white:(Math.abs(y)>h-2?C.blue:C.cyan));
 line(im,3+f,11,12,11,C.blue);
 if(level===3){line(im,14,5,42,10,C.purple);line(im,14,19,42,14,C.purple)}
 return im;
}
function missile(f){
 const im=image(72,32),y=16;
 rect(im,20,y-5,37,10,C.smoke);
 for(let i=0;i<18;i++)paint(im,56+i,y+Math.floor(i/4)-2,...C.gold);
 rect(im,26,y-3,29,6,C.white);
 line(im,24,y-6,10,y-11,C.red);line(im,24,y+6,10,y+11,C.red);
 line(im,22,y,3+(f%4)*2,y,C.cyan);
 return im;
}
function prismatic(f){
 const im=image(96,52),cy=26;
 for(let k=-1;k<=1;k++){
  const y=cy+k*(12+f);
  line(im,7,cy,84,y,C.purple);
  line(im,12,cy+k*2,88,y,C.cyan);
  ellipse(im,88,y,4,3,C.white);
 }
 return im;
}
function muzzle(f){
 const im=image(38,28),y=14;
 for(let k=-1;k<=1;k++)line(im,2,y,24+f*3,y+k*(4+f),k===0?C.white:C.gold);
 return im;
}
function makePNG(frames){
 const w=frames[0].w,h=frames[0].h,count=frames.length;
 if(!frames.every(x=>x.w===w&&x.h===h))throw Error('Inconsistent frame size');
 const pw=w*count,raw=Buffer.alloc((pw*4+1)*h);
 for(let y=0;y<h;y++){
  let row=y*(pw*4+1);
  for(let f=0;f<count;f++)frames[f].data.copy(raw,row+1+f*w*4,y*w*4,(y+1)*w*4);
 }
 function crc32(data){
  let c=-1;for(const b of data){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0)}
  return(c^(-1))>>>0;
 }
 function chunk(type,data){
  const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);
  length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([length,name,data,crc]);
 }
 const ih=Buffer.alloc(13);ih.writeUInt32BE(pw,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
 chunk('IHDR',ih),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const defs=[
 ['ship/idle',4,f=>ship('idle',f)],
 ['ship/climb',4,f=>ship('climb',f)],
 ['ship/dive',4,f=>ship('dive',f)],
 ['ship/fire',4,f=>ship('fire',f)],
 ['ship/missile_launch',4,f=>ship('missile_launch',f)],
 ['ship/prism_charge',4,f=>ship('prism_charge',f)],
 ['ship/hit',4,f=>ship('hit',f)],
 ['ship/destruction',8,f=>ship('destruction',f)],
 ['fx/engine',8,engine],['fx/muzzle',4,muzzle],
 ...[1,2,3].map(l=>['weapons/pulse_lv'+l,4,f=>pulse(l,f)]),
 ['weapons/missile',4,missile],['weapons/tempestade_prismatica',4,prismatic]
];
for(const [path,count,draw] of defs){
 const dest='public/assets/ships/rivet/v3/'+path+'.png';
 mkdirSync(dirname(dest),{recursive:true});
 writeFileSync(dest,makePNG(Array.from({length:count},(_,i)=>draw(i))));
 console.log(dest);
}
