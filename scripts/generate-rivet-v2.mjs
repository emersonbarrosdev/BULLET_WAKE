// Rivet V2 - original high-detail pixel sprite generator. All outputs are PNG alpha sheets.

// Based on the approved Rivet concept. Angled poses are derived from the base hull.

// node scripts/generate-rivet-v2.mjs

import {mkdirSync,writeFileSync} from 'node:fs';

import {dirname} from 'node:path';

const WIDTH=112, HEIGHT=54, SRC_COLORS=96;

const PAL_B64="YB0h/yYYJZ9kVWj/GaPs/59aX/+cJCT/HhorXKPk8/9b4Pn/Mhoj6KGVpf/XYFz/5Nnd/yNjov/enZz/EChW5xMVJRsKZ9f/n6rL/yTR+v/MLjD/dYip/11slP9Xo9r/ChtFYipJZf9eNkv/AzCe/6FJKv/MXx3/ExlGnpQ2Rv+bdIv/5Jxj//OiGv8GG0A/No+y/9M6RP//wBT//MSk/3JAL/+5gnX/AAAAAPb7+/8OGzMPNTVM/8zH1f8NKVj6DjVu/xQbNC5zdpD/sLbP/wwJFS2sma3/tKW1/8a3xf/r5u3/DCVNrwxGjf9LJzD/CyJFbw0gOS4JLGf/CSFBUTQoNfpsaYf/CAINbw0kSI8HZ87/LitJ/LAoLP/HqK7/CgUQUQmI7f9KNkv/UFVu/5CGlP+1x+X/DFSv/w121v9MRlf/iniN/9LV5P9JGSX/jiQr/9D6+/9yJS3/jpSw/wgBCI8ISav/y7O1/9bU2/8KOIj/JRkrdDoaLfosRnH/";

const RLE_B64="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";

function decode64(str) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out=[];let bit=0,buf=0;
  for(const ch of str){if(ch==="=")break;const n=alphabet.indexOf(ch);if(n<0)continue;buf=(buf<<6)|n;bit+=6;if(bit>=8){bit-=8;out.push((buf>>bit)&255)}}
  return Uint8Array.from(out);
}

function unpackBase() {
  const compressed=decode64(RLE_B64),pixels=new Uint8Array(WIDTH*HEIGHT);
  let cursor=0;
  for(let i=0;i<compressed.length;i++){let value=compressed[i];if(value===255){const count=compressed[++i],color=compressed[++i];pixels.fill(color,cursor,cursor+count);cursor+=count}else{pixels[cursor++]=value}}
  if(cursor!==pixels.length)throw Error("Rivet base map corrupt "+cursor);
  return pixels;
}

function makePalette() {
  const p=Array.from(decode64(PAL_B64));if(p.length!==SRC_COLORS*4)throw Error("Invalid palette size");
  const extra=[
    [5,34,58,0], // 96 transparent
    [45,214,255,245], // 97 cyan
    [182,251,255,255], // 98 white-blue
    [30,126,233,240], // 99 blue
    [14,83,165,155], // 100 trail
    [255,235,166,255], // 101 gold
    [255,152,74,255], // 102 orange
    [233,71,97,240], // 103 red
    [255,244,218,255], // 104 white
    [243,77,103,180], // 105 hit glow
    [112,235,255,200], // 106 halo
    [92,47,54,180], // 107 debris
    [160,83,83,190] // 108 debris
  ];
  for(const e of extra)p.push(...e);
  return Uint8Array.from(p);
}

function put(frame,x,y,color){
 x=Math.round(x);y=Math.round(y);
 if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT)frame[y*WIDTH+x]=color;
}

function rect(frame,x,y,w,h,c){
 for(let yy=Math.round(y);yy<y+h;yy++)for(let xx=Math.round(x);xx<x+w;xx++)put(frame,xx,yy,c);
}

function stroke(frame,x0,y0,x1,y1,c){
 let x=Math.round(x0),y=Math.round(y0),tx=Math.round(x1),ty=Math.round(y1),dx=Math.abs(tx-x),sx=x<tx?1:-1,dy=-Math.abs(ty-y),sy=y<ty?1:-1,err=dx+dy;
 for(;;){put(frame,x,y,c);if(x===tx&&y===ty)break;const e=2*err;if(e>=dy){err+=dy;x+=sx}if(e<=dx){err+=dx;y+=sy}}
}

function rotatePose(base, angleDeg, offX, offY) {
  const out=new Uint8Array(WIDTH*HEIGHT).fill(96),angle=angleDeg*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const dx=x-54-offX,dy=y-27-offY;
    const sx=Math.round(54+dx*c+dy*s),sy=Math.round(27-dx*s+dy*c);
    if(sx>=0&&sx<WIDTH&&sy>=0&&sy<HEIGHT)out[y*WIDTH+x]=base[sy*WIDTH+sx];
  }
  return out;
}

function flame(f,t,boost=false){
  const pulse=t%4,tailX=22-(t%2),y=29;
  // The approved Rivet already has an engine; append a short 3-layer pulsating plume.
  const reach=(boost?11:7)+(pulse%3)*2;
  for(let x=tailX-reach;x<tailX;x++){
    const w=Math.round((x-(tailX-reach))/3)+1;
    if(x>=4)for(let k=-Math.min(3,w);k<=Math.min(3,w);k++)put(f,x,y+k,boost?97:99);
  }
  stroke(f,Math.max(3,tailX-reach+4),y,tailX+1,y,98);
  put(f,tailX-5,y-2,97);put(f,tailX-8,y+2,106);
}

function muzzle(f,t){
  const x=102,y=26, r=3+(t%4);
  stroke(f,x,y,x+Math.min(9,r+3),y,101);
  stroke(f,x+1,y-r,x+Math.min(8,r+5),y,102);
  stroke(f,x+1,y+r,x+Math.min(8,r+5),y,102);
  put(f,x+2,y,104);put(f,x+4,y,101);
}

function collision(f,t){
  const x=81,y=24,r=2+(t%3);
  stroke(f,x-r,y,x+r,y,101);
  stroke(f,x,y-r,x,y+r,103);
  stroke(f,x-r,y-r,x+r,y+r,104);
  put(f,x,y,104);put(f,x+r+2,y-1,102);
}

function destruction(base,t){
  const f=new Uint8Array(WIDTH*HEIGHT).fill(96);
  if(t<2){
    const pose=rotatePose(base,(t===0?-1:2),0,0);
    f.set(pose);
    for(let i=0;i<f.length;i++)if(f[i]!==96 && ((i+t)%5)===0)f[i]=t?103:102;
    collision(f,t);
    return f;
  }
  const degree=t-1,centerX=57,centerY=27;
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const src=base[y*WIDTH+x];
    if(src===96)continue;
    const bx=Math.floor(x/9),by=Math.floor(y/7),seed=((bx*17+by*11)%9);
    if((bx*3+by+t)%11<degree-1)continue;
    const ox=Math.round((x-centerX)/16*(degree*.7)+(seed-4)*degree*.28);
    const oy=Math.round((y-centerY)/12*(degree*.7)+(((seed*5)%9)-4)*degree*.23);
    put(f,x+ox,y+oy,degree>4 && (x+y)%3===0 ? 102:src);
  }
  for(let ring=0;ring<11-degree;ring++){
    const a=(ring*2.399+t*.9),r=3+degree*2+ring*.5;
    const px=centerX+Math.cos(a)*r,py=centerY+Math.sin(a)*r*.6;
    put(f,px,py,ring%3===0?104:ring%2?101:103);
  }
  if(t<6){
    for(let y=-Math.max(1,6-degree);y<=Math.max(1,6-degree);y++)
      for(let x=-Math.max(1,8-degree);x<=Math.max(1,8-degree);x++)
        if((x*x+y*y)<(10-degree)*(8-degree))put(f,centerX+x,centerY+y,(x+y+t)%3===0?104:(x+t)%2?101:102);
  }
  return f;
}

function generateSheets() {
  const base=unpackBase(),states=[
    ["idle",8],["subida",8],["descida",8],["disparo",8],["dano",6],["destruicao",8]
  ],sheets={};
  for(const [name,count] of states){
    const frames=[];
    for(let t=0;t<count;t++){
      let f;
      if(name==="destruicao")f=destruction(base,t);
      else {
        const angle=name==="subida"?[-1,-3,-4,-6,-7,-7,-6,-4][t] :name==="descida"?[1,3,4,6,7,7,6,4][t] :name==="idle"?[0,0,-1,0,0,1,0,-1][t] : 0;
        const x=name==="disparo" ? (t%3===0?-2:-1) : 0;
        const y=name==="subida"?-1:name==="descida"?1:0;
        f=rotatePose(base,angle,x,y);
        if(name==="dano"){
          for(let k=0;k<f.length;k++)if(f[k]!==96 && (t===1||t===3||t===5) && (k%5!==0))f[k]=((k+t)%4===0?104:103);
          collision(f,t);
        } else {
          flame(f,t,name==="subida");
          if(name==="disparo")muzzle(f,t);
        }
      }
      frames.push(f);
    }
    const width=WIDTH*count,pixels=new Uint8Array(width*HEIGHT).fill(96);
    for(let i=0;i<frames.length;i++)for(let y=0;y<HEIGHT;y++)
      pixels.set(frames[i].subarray(y*WIDTH,(y+1)*WIDTH),y*width+i*WIDTH);
    sheets[name]={width,height:HEIGHT,count,pixels};
  }
  return sheets;
}

function u32(n){return [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]}

function crc32(data){
 let c=-1;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^(-1))>>>0;
}

function chunk(type, data){
 const tag=Array.from(type).map(x=>x.charCodeAt(0));
 return [...u32(data.length),...tag,...data,...u32(crc32([...tag,...data]))];
}

function adler32(data){
 let a=1,b=0;for(const v of data){a=(a+v)%65521;b=(b+a)%65521}return ((b<<16)|a)>>>0;
}

function zlibStore(data){
 const out=[0x78,0x01];for(let s=0;s<data.length;s+=65535){
   const len=Math.min(65535,data.length-s);
   out.push(s+len===data.length?1:0,len&255,(len>>8)&255,(~len)&255,((~len)>>8)&255);
   for(let i=s;i<s+len;i++)out.push(data[i]);
 }
 out.push(...u32(adler32(data)));
 return out;
}

function encodePNG(sheet,palette){
 const {width,height,pixels}=sheet;
 const scan=new Uint8Array((width+1)*height);
 for(let y=0;y<height;y++)scan.set(pixels.subarray(y*width,(y+1)*width),y*(width+1)+1);
 const colors=[],alpha=[];
 for(let i=0;i<palette.length;i+=4){colors.push(palette[i],palette[i+1],palette[i+2]);alpha.push(palette[i+3]);}
 return Uint8Array.from([
 137,80,78,71,13,10,26,10,
 ...chunk("IHDR",[...u32(width),...u32(height),8,3,0,0,0]),
 ...chunk("PLTE",colors),
 ...chunk("tRNS",alpha),
 ...chunk("IDAT",zlibStore(scan)),
 ...chunk("IEND",[])
 ]);
}

const atlas=generateSheets(), palette=makePalette();

for(const [name,sheet] of Object.entries(atlas)){

 const target=`public/assets/ships/rivet/v2/${name}.png`;

 mkdirSync(dirname(target),{recursive:true});

 writeFileSync(target,encodePNG(sheet,palette));

 console.log(target+' '+sheet.width+'x'+sheet.height+' / '+sheet.count+' frames');

}
