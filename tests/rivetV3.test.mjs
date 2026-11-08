import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const sheets = [
 ['ship/idle',160,110,4], ['ship/climb',160,110,4],
 ['ship/dive',160,110,4], ['ship/fire',160,110,4],
 ['ship/missile_launch',160,110,4], ['ship/prism_charge',160,110,4],
 ['ship/hit',160,110,4], ['ship/destruction',160,110,8],
 ['fx/engine',48,54,8], ['fx/muzzle',38,28,4],
 ['weapons/pulse_lv1',64,24,4], ['weapons/pulse_lv2',64,24,4],
 ['weapons/pulse_lv3',64,24,4], ['weapons/missile',72,32,4],
 ['weapons/tempestade_prismatica',96,52,4],
];
for (const [key,fw,fh,count] of sheets) {
 test('V3 '+key+' tem PNG alfa e frames animados',()=>{
  const b=readFileSync('public/assets/ships/rivet/v3/'+key+'.png');
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(b.readUInt32BE(16),fw*count);
  assert.equal(b.readUInt32BE(20),fh);
  assert.equal(b[25],6); // RGBA, alpha real
  let pos=8,payload=[];
  while(pos<b.length){
   const n=b.readUInt32BE(pos),kind=b.toString('ascii',pos+4,pos+8);
   if(kind==='IDAT')payload.push(b.subarray(pos+8,pos+8+n));
   pos+=n+12;
  }
  const raw=inflateSync(Buffer.concat(payload));
  assert.equal(raw.length,(fw*count*4+1)*fh);
  const seen=new Set();
  for(let f=0;f<count;f++){
   let a=0,px=[];
   for(let y=0;y<fh;y++){
    const start=y*(fw*count*4+1);
    assert.equal(raw[start],0);
    for(let x=0;x<fw;x++){
     const p=start+1+(f*fw+x)*4;
     const alpha=raw[p+3];if(alpha>0)a++;
     px.push(raw[p],raw[p+1],raw[p+2],alpha);
    }
   }
   assert.ok(a>0,'frame vazio '+f);
   assert.ok(a<fw*fh*.85,'frame sem transparencia '+f);
   seen.add(Buffer.from(px).toString('base64'));
  }
  assert.ok(seen.size>=2,'animacao estatica: '+key);
 });
}
